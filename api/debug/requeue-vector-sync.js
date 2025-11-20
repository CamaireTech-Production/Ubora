/**
 * RE-QUEUE SCRIPT: Re-queue form entries for vector sync
 * 
 * This script:
 * 1. Finds form entries that are missing from Qdrant
 * 2. Updates their vectorSyncStatus to 'pending'
 * 3. Resets vectorChunksCount to 0
 * 
 * USAGE:
 *   node api/debug/requeue-vector-sync.js [--dry-run] [--directorId DIRECTOR_ID] [--agencyId AGENCY_ID]
 * 
 * Options:
 *   --dry-run: Show what would be done without making changes
 *   --directorId: Only process entries for a specific director
 *   --agencyId: Only process entries for a specific agency
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const loadedLocalEnv = dotenv.config({ path: path.join(__dirname, '../../.env.local') });
if (!loadedLocalEnv || !loadedLocalEnv.parsed) {
  dotenv.config({ path: path.join(__dirname, '../../.env') });
}

import { adminDb, admin } from '../lib/firebaseAdmin.js';
import { qdrantRequest, COLLECTION_NAME } from '../lib/vectorDb.js';

const FieldValue = admin.firestore.FieldValue;

const DRY_RUN = process.argv.includes('--dry-run');
const SPECIFIC_DIRECTOR = process.argv.includes('--directorId') 
  ? process.argv[process.argv.indexOf('--directorId') + 1]
  : null;
const SPECIFIC_AGENCY = process.argv.includes('--agencyId')
  ? process.argv[process.argv.indexOf('--agencyId') + 1]
  : null;

/**
 * Get all entry IDs from Qdrant for an agency
 */
async function getQdrantEntryIds(agencyId, universInstanceId = null) {
  try {
    const filter = {
      must: [
        {
          key: 'agencyId',
          match: { value: agencyId }
        }
      ]
    };

    if (universInstanceId) {
      filter.must.push({
        key: 'universInstanceId',
        match: { value: universInstanceId }
      });
    }

    const scrollResponse = await qdrantRequest(
      `/collections/${COLLECTION_NAME}/points/scroll`,
      {
        method: 'POST',
        body: JSON.stringify({
          filter,
          limit: 10000,
          with_payload: true,
          with_vector: false
        })
      }
    );

    const points = scrollResponse.result?.points || [];
    const entryIds = new Set();
    
    for (const point of points) {
      const entryId = point.payload?.entryId;
      if (entryId) {
        entryIds.add(entryId);
      }
    }

    return entryIds;
  } catch (error) {
    console.warn(`⚠️ Error fetching Qdrant entries:`, error.message);
    return new Set();
  }
}

/**
 * Re-queue form entries for vector sync
 */
async function requeueEntriesForSync(directorId = null, agencyId = null, dryRun = false) {
  let totalRequeued = 0;
  let totalChecked = 0;

  try {
    // Build query
    let query = adminDb.collection('formEntries');
    
    if (agencyId) {
      query = query.where('agencyId', '==', agencyId);
    }
    
    if (directorId) {
      query = query.where('userId', '==', directorId);
    }

    // Get all entries (limit to 5000 for safety)
    const snapshot = await query.limit(5000).get();
    totalChecked = snapshot.size;

    console.log(`📋 Checking ${totalChecked} form entry/entries...`);

    // Group by agencyId and universInstanceId for efficient Qdrant queries
    const entriesByAgencyAndInstance = new Map();
    
    for (const entryDoc of snapshot.docs) {
      const data = entryDoc.data();
      const agency = data.agencyId;
      const instanceId = data.universInstanceId || 'no-instance';
      
      const key = `${agency}:${instanceId}`;
      if (!entriesByAgencyAndInstance.has(key)) {
        entriesByAgencyAndInstance.set(key, []);
      }
      entriesByAgencyAndInstance.get(key).push({
        id: entryDoc.id,
        data
      });
    }

    console.log(`📊 Grouped into ${entriesByAgencyAndInstance.size} group(s) for Qdrant check\n`);

    // Process each group
    for (const [key, entries] of entriesByAgencyAndInstance.entries()) {
      const [agency, instanceId] = key.split(':');
      const instanceIdForQuery = instanceId === 'no-instance' ? null : instanceId;

      console.log(`🔍 Checking group: agency=${agency}, instance=${instanceId || 'N/A'}, entries=${entries.length}`);

      // Get Qdrant entry IDs for this group
      const qdrantEntryIds = await getQdrantEntryIds(agency, instanceIdForQuery);
      console.log(`   📦 Found ${qdrantEntryIds.size} entry/entries in Qdrant`);

      // Find entries missing from Qdrant
      const missingEntries = entries.filter(entry => !qdrantEntryIds.has(entry.id));
      
      if (missingEntries.length === 0) {
        console.log(`   ✅ All entries are synced\n`);
        continue;
      }

      console.log(`   ⚠️  ${missingEntries.length} entry/entries missing from Qdrant`);

      // Re-queue missing entries
      const batch = adminDb.batch();
      let batchCount = 0;

      for (const entry of missingEntries) {
        const entryRef = adminDb.collection('formEntries').doc(entry.id);
        
        if (!dryRun) {
          batch.update(entryRef, {
            vectorSyncStatus: 'pending',
            vectorChunksCount: 0,
            updatedAt: FieldValue.serverTimestamp()
          });
        }
        
        batchCount++;
        totalRequeued++;

        if (batchCount >= 500) {
          if (!dryRun) await batch.commit();
          batchCount = 0;
        }
      }

      if (batchCount > 0 && !dryRun) {
        await batch.commit();
      }

      console.log(`   ✅ ${missingEntries.length} entry/entries re-queued for sync\n`);
    }

  } catch (error) {
    console.error(`❌ Error re-queuing entries:`, error);
    throw error;
  }

  return { totalChecked, totalRequeued };
}

/**
 * Main function
 */
async function main() {
  console.log('🔄 Vector Sync Re-queue Script');
  console.log('===============================\n');
  
  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  }

  try {
    const { totalChecked, totalRequeued } = await requeueEntriesForSync(
      SPECIFIC_DIRECTOR,
      SPECIFIC_AGENCY,
      DRY_RUN
    );

    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 SUMMARY:');
    console.log(`   Entries checked: ${totalChecked}`);
    console.log(`   Entries re-queued: ${totalRequeued}`);
    
    if (DRY_RUN) {
      console.log('\n⚠️  This was a DRY RUN - no changes were made');
      console.log('   Run without --dry-run to apply changes');
    } else {
      console.log('\n✅ Re-queue completed');
      console.log('   Entries will be synced by the vector sync worker');
    }
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });


/**
 * SYNC PENDING ENTRIES: Sync all pending form entries to Qdrant vector database
 * 
 * This script:
 * 1. Finds all form entries with vectorSyncStatus = 'pending'
 * 2. Syncs them to Qdrant using the vector sync worker
 * 3. Updates their status to 'completed' or 'failed'
 * 
 * USAGE:
 *   node api/debug/sync-pending-entries.js [--limit LIMIT] [--agencyId AGENCY_ID] [--directorId DIRECTOR_ID]
 * 
 * Options:
 *   --limit: Maximum number of entries to sync (default: 100)
 *   --agencyId: Only sync entries for a specific agency
 *   --directorId: Only sync entries for a specific director
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

import { adminDb } from '../lib/firebaseAdmin.js';
import { initializeQdrant } from '../lib/vectorDb.js';
import { syncFormEntryToVector } from '../workers/vectorSync.js';

const LIMIT = process.argv.includes('--limit')
  ? parseInt(process.argv[process.argv.indexOf('--limit') + 1])
  : 100;
const SPECIFIC_AGENCY = process.argv.includes('--agencyId')
  ? process.argv[process.argv.indexOf('--agencyId') + 1]
  : null;
const SPECIFIC_DIRECTOR = process.argv.includes('--directorId')
  ? process.argv[process.argv.indexOf('--directorId') + 1]
  : null;

/**
 * Sync pending entries
 */
async function syncPendingEntries() {
  console.log('🔄 Initializing Qdrant connection...');
  await initializeQdrant();
  console.log('✅ Qdrant initialized\n');

  // Build query
  let query = adminDb.collection('formEntries')
    .where('vectorSyncStatus', '==', 'pending')
    .limit(LIMIT);

  if (SPECIFIC_AGENCY) {
    query = query.where('agencyId', '==', SPECIFIC_AGENCY);
  }

  if (SPECIFIC_DIRECTOR) {
    query = query.where('userId', '==', SPECIFIC_DIRECTOR);
  }

  console.log(`📋 Fetching pending entries (limit: ${LIMIT})...`);
  const snapshot = await query.get();
  const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  if (entries.length === 0) {
    console.log('✅ No pending entries found');
    return { total: 0, synced: 0, failed: 0, skipped: 0 };
  }

  console.log(`📊 Found ${entries.length} pending entry/entries\n`);

  let synced = 0;
  let failed = 0;
  let skipped = 0;

  // Process entries in batches to avoid overwhelming the system
  const BATCH_SIZE = 10;
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    
    console.log(`\n📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(entries.length / BATCH_SIZE)} (${batch.length} entries)...`);

    const batchPromises = batch.map(async (entry) => {
      try {
        const result = await syncFormEntryToVector(entry.id, 'create');
        
        if (result.success) {
          if (result.skipped) {
            skipped++;
            console.log(`   ⏭️  ${entry.id.substring(0, 8)}... - skipped (no content)`);
          } else {
            synced++;
            console.log(`   ✅ ${entry.id.substring(0, 8)}... - synced`);
          }
        } else {
          failed++;
          console.log(`   ❌ ${entry.id.substring(0, 8)}... - failed: ${result.error || 'Unknown error'}`);
        }
      } catch (error) {
        failed++;
        console.log(`   ❌ ${entry.id.substring(0, 8)}... - error: ${error.message}`);
      }
    });

    await Promise.all(batchPromises);
    
    // Small delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < entries.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return { total: entries.length, synced, failed, skipped };
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Sync Pending Entries Script');
  console.log('================================\n');

  try {
    const { total, synced, failed, skipped } = await syncPendingEntries();

    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 SUMMARY:');
    console.log(`   Total entries processed: ${total}`);
    console.log(`   ✅ Successfully synced: ${synced}`);
    console.log(`   ⏭️  Skipped (no content): ${skipped}`);
    console.log(`   ❌ Failed: ${failed}`);
    
    if (total > 0) {
      const successRate = ((synced + skipped) / total * 100).toFixed(1);
      console.log(`   📈 Success rate: ${successRate}%`);
    }

    if (failed > 0) {
      console.log(`\n⚠️  ${failed} entry/entries failed to sync. Check logs for details.`);
    } else if (total > 0) {
      console.log('\n✅ All entries processed successfully');
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


/**
 * CLEANUP SCRIPT: Clean up duplicate univers instances and fix orphaned resources
 * 
 * This script:
 * 1. Consolidates multiple instances per univers per director into one active instance
 * 2. Reattaches orphaned resources to the correct instance
 * 3. Backfills missing universInstanceId on form entries
 * 4. Re-queues entries for vector sync
 * 
 * USAGE:
 *   node api/debug/cleanup-univers-instances.js [--dry-run] [--directorId DIRECTOR_ID]
 * 
 * Options:
 *   --dry-run: Show what would be done without making changes
 *   --directorId: Only process a specific director
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

/**
 * Get all directors
 */
async function getAllDirectors() {
  const snapshot = await adminDb.collection('users')
    .where('role', '==', 'directeur')
    .get();
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

/**
 * Get active univers for a director
 */
async function getActiveUnivers(directorId) {
  const doc = await adminDb.collection('activeUnivers').doc(directorId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

/**
 * Get all instances for a director
 */
async function getInstancesByUser(directorId, agencyId) {
  const snapshot = await adminDb.collection('universInstances')
    .where('userId', '==', directorId)
    .where('agencyId', '==', agencyId)
    .get();
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

/**
 * Reattach orphaned resources to target instance
 */
async function reattachOrphanedResources(universId, targetInstanceId, agencyId, directorId, dryRun = false) {
  let reattached = 0;
  const collections = [
    { name: 'forms', field: 'title' },
    { name: 'dashboards', field: 'name' },
    { name: 'lists', field: 'name' },
    { name: 'reports', field: 'name' },
    { name: 'scheduledQuestions', field: 'title' }
  ];

  for (const { name, field } of collections) {
    try {
      const snapshot = await adminDb.collection(name)
        .where('agencyId', '==', agencyId)
        .where('universId', '==', universId)
        .get();

      const batch = adminDb.batch();
      let batchCount = 0;

      for (const resourceDoc of snapshot.docs) {
        const data = resourceDoc.data();
        const currentInstanceId = data.universInstanceId;

        if (currentInstanceId === targetInstanceId) {
          continue; // Already correct
        }

        // Check if current instance exists
        let shouldReattach = false;
        if (!currentInstanceId) {
          shouldReattach = true;
        } else {
          try {
            const instanceDoc = await adminDb.collection('universInstances').doc(currentInstanceId).get();
            if (!instanceDoc.exists || instanceDoc.data()?.userId !== directorId) {
              shouldReattach = true;
            }
          } catch {
            shouldReattach = true;
          }
        }

        if (shouldReattach) {
          const resourceRef = adminDb.collection(name).doc(resourceDoc.id);
          if (!dryRun) {
            batch.update(resourceRef, {
              universInstanceId: targetInstanceId,
              updatedAt: FieldValue.serverTimestamp()
            });
          }
          batchCount++;
          reattached++;

          if (batchCount >= 500) {
            if (!dryRun) await batch.commit();
            batchCount = 0;
          }
        }
      }

      if (batchCount > 0 && !dryRun) {
        await batch.commit();
      }
    } catch (error) {
      console.warn(`⚠️ Erreur lors de la réattachement des ${name}:`, error.message);
    }
  }

  return reattached;
}

/**
 * Backfill universInstanceId on form entries
 */
async function backfillFormEntriesInstanceId(universId, targetInstanceId, agencyId, dryRun = false) {
  let updated = 0;
  
  try {
    const snapshot = await adminDb.collection('formEntries')
      .where('agencyId', '==', agencyId)
      .where('universId', '==', universId)
      .limit(5000)
      .get();

    const batch = adminDb.batch();
    let batchCount = 0;

    for (const entryDoc of snapshot.docs) {
      const data = entryDoc.data();
      
      // Only update if missing or wrong
      if (data.universInstanceId !== targetInstanceId) {
        const entryRef = adminDb.collection('formEntries').doc(entryDoc.id);
        if (!dryRun) {
          batch.update(entryRef, {
            universInstanceId: targetInstanceId,
            vectorSyncStatus: 'pending', // Re-queue for sync
            updatedAt: FieldValue.serverTimestamp()
          });
        }
        batchCount++;
        updated++;

        if (batchCount >= 500) {
          if (!dryRun) await batch.commit();
          batchCount = 0;
        }
      }
    }

    if (batchCount > 0 && !dryRun) {
      await batch.commit();
    }
  } catch (error) {
    console.warn(`⚠️ Erreur lors de la mise à jour des formEntries:`, error.message);
  }

  return updated;
}

/**
 * Consolidate instances for a director
 */
async function consolidateInstancesForDirector(director, dryRun = false) {
  const directorId = director.id;
  const agencyId = director.agencyId;

  if (!agencyId) {
    console.log(`⚠️ Director ${directorId} has no agencyId, skipping`);
    return { consolidated: 0, reattached: 0, entriesUpdated: 0 };
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`👤 Director: ${director.name || director.email || directorId}`);
  console.log(`   ID: ${directorId}`);
  console.log(`   Agency: ${agencyId}`);

  // Get active univers
  const activeUnivers = await getActiveUnivers(directorId);
  if (!activeUnivers) {
    console.log(`   ⚠️ No active univers found`);
    return { consolidated: 0, reattached: 0, entriesUpdated: 0 };
  }

  console.log(`   📌 Active Univers: ${activeUnivers.activeUniversId}`);
  console.log(`   📦 Active Instance: ${activeUnivers.activeInstanceId || 'N/A'}`);

  // Get all instances
  const instances = await getInstancesByUser(directorId, agencyId);
  
  // Group by universId
  const instancesByUnivers = new Map();
  for (const instance of instances) {
    if (!instancesByUnivers.has(instance.universId)) {
      instancesByUnivers.set(instance.universId, []);
    }
    instancesByUnivers.get(instance.universId).push(instance);
  }

  let totalConsolidated = 0;
  let totalReattached = 0;
  let totalEntriesUpdated = 0;

  for (const [universId, universInstances] of instancesByUnivers.entries()) {
    if (universInstances.length <= 1) {
      continue; // No duplicates
    }

    console.log(`\n   🔍 Univers ${universId}: ${universInstances.length} instance(s) found`);

    // Find target instance (prefer active, then most recent)
    let targetInstance = universInstances.find(inst => inst.isActive);
    if (!targetInstance && activeUnivers.activeInstanceId) {
      targetInstance = universInstances.find(inst => inst.id === activeUnivers.activeInstanceId);
    }
    if (!targetInstance) {
      targetInstance = universInstances.sort((a, b) => {
        const aTime = a.updatedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
        const bTime = b.updatedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      })[0];
    }

    const targetInstanceId = targetInstance.id;
    const otherInstances = universInstances.filter(inst => inst.id !== targetInstanceId);

    console.log(`      ✅ Target instance: ${targetInstanceId} (keeping)`);
    console.log(`      🗑️  Other instances: ${otherInstances.map(i => i.id).join(', ')} (will be deactivated)`);

    // Reattach orphaned resources
    if (!dryRun) {
      const reattached = await reattachOrphanedResources(universId, targetInstanceId, agencyId, directorId, dryRun);
      totalReattached += reattached;
      if (reattached > 0) {
        console.log(`      ✅ ${reattached} ressource(s) réattachée(s)`);
      }

      // Backfill form entries
      const entriesUpdated = await backfillFormEntriesInstanceId(universId, targetInstanceId, agencyId, dryRun);
      totalEntriesUpdated += entriesUpdated;
      if (entriesUpdated > 0) {
        console.log(`      ✅ ${entriesUpdated} form entry/entries mis(es) à jour`);
      }

      // Deactivate other instances
      for (const otherInstance of otherInstances) {
        await adminDb.collection('universInstances').doc(otherInstance.id).update({
          isActive: false,
          updatedAt: FieldValue.serverTimestamp()
        });
      }
    } else {
      console.log(`      [DRY RUN] Would reattach resources and deactivate ${otherInstances.length} instance(s)`);
    }

    totalConsolidated += otherInstances.length;
  }

  return {
    consolidated: totalConsolidated,
    reattached: totalReattached,
    entriesUpdated: totalEntriesUpdated
  };
}

/**
 * Main function
 */
async function main() {
  console.log('🧹 Univers Instances Cleanup Script');
  console.log('====================================\n');
  
  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  }

  try {
    const directors = SPECIFIC_DIRECTOR
      ? [{ id: SPECIFIC_DIRECTOR, ...(await adminDb.collection('users').doc(SPECIFIC_DIRECTOR).get()).data() }]
      : await getAllDirectors();

    console.log(`📋 Found ${directors.length} director(s) to process\n`);

    let totalConsolidated = 0;
    let totalReattached = 0;
    let totalEntriesUpdated = 0;

    for (const director of directors) {
      try {
        const result = await consolidateInstancesForDirector(director, DRY_RUN);
        totalConsolidated += result.consolidated;
        totalReattached += result.reattached;
        totalEntriesUpdated += result.entriesUpdated;
      } catch (error) {
        console.error(`❌ Error processing director ${director.id}:`, error.message);
      }
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 SUMMARY:');
    console.log(`   Instances consolidated: ${totalConsolidated}`);
    console.log(`   Resources reattached: ${totalReattached}`);
    console.log(`   Form entries updated: ${totalEntriesUpdated}`);
    
    if (DRY_RUN) {
      console.log('\n⚠️  This was a DRY RUN - no changes were made');
      console.log('   Run without --dry-run to apply changes');
    } else {
      console.log('\n✅ Cleanup completed');
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


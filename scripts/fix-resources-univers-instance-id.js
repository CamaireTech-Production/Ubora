/**
 * Script de migration pour corriger les ressources existantes
 * qui ont un mauvais universInstanceId ou qui n'en ont pas
 * 
 * Ce script :
 * 1. Récupère toutes les instances Univers
 * 2. Pour chaque instance, vérifie les ressources (forms, dashboards, lists, instructions, reports)
 * 3. Met à jour les ressources qui ont un universInstanceId incorrect ou manquant
 * 
 * Usage: node scripts/fix-resources-univers-instance-id.js [--write]
 *   - Sans --write : mode dry-run (affiche seulement ce qui serait corrigé)
 *   - Avec --write : applique les corrections
 */

import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialiser Firebase Admin
let initialized = false;
try {
  const serviceAccountPath = join(__dirname, '..', 'studio-gpnfx-firebase-adminsdk-fbsvc-49cf718bd7.json');
  
  if (!existsSync(serviceAccountPath)) {
    console.error('❌ Fichier de compte de service Firebase introuvable:', serviceAccountPath);
    process.exit(1);
  }
  
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
  initialized = true;
} catch (error) {
  try {
    if (!admin.apps.length) admin.initializeApp();
    initialized = true;
  } catch (ee) {
    console.error('❌ Erreur lors de l\'initialisation de Firebase Admin:', error);
    process.exit(1);
  }
}

const db = admin.firestore();

// Collections
const INSTANCES_COLLECTION = 'universInstances';
const FORMS_COLLECTION = 'forms';
const DASHBOARDS_COLLECTION = 'dashboards';
const LISTS_COLLECTION = 'lists';
const INSTRUCTIONS_COLLECTION = 'scheduledQuestions';
const REPORTS_COLLECTION = 'reports';

const MAX_BATCH_SIZE = 500; // Limite Firestore

/**
 * Mettre à jour les ressources d'un type donné avec le bon universInstanceId
 */
async function updateResourcesForInstance(
  instanceId,
  instanceData,
  resourceType,
  collectionName,
  resourceIds,
  write
) {
  if (!resourceIds || resourceIds.length === 0) {
    return { updated: 0, skipped: 0, errors: 0 };
  }

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  try {
    // Récupérer toutes les ressources de cette instance
    const resources = await Promise.all(
      resourceIds.map(async (resourceId) => {
        try {
          const resourceDoc = await db.collection(collectionName).doc(resourceId).get();
          if (resourceDoc.exists) {
            return { id: resourceId, data: resourceDoc.data(), exists: true };
          }
          return { id: resourceId, exists: false };
        } catch (error) {
          console.warn(`   ⚠️ Erreur lors de la récupération de ${resourceType} ${resourceId}:`, error.message);
          return { id: resourceId, exists: false, error: true };
        }
      })
    );

    // Filtrer les ressources qui existent
    const existingResources = resources.filter(r => r.exists && !r.error);

    // Vérifier et mettre à jour les ressources
    const batch = db.batch();
    let batchCount = 0;

    for (const resource of existingResources) {
      const resourceData = resource.data;
      const currentInstanceId = resourceData.universInstanceId;

      // Vérifier si la ressource a besoin d'être mise à jour
      if (currentInstanceId !== instanceId) {
        if (write) {
          const resourceRef = db.collection(collectionName).doc(resource.id);
          batch.update(resourceRef, {
            universInstanceId: instanceId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          batchCount++;
          updated++;

          if (batchCount >= MAX_BATCH_SIZE) {
            await batch.commit();
            batchCount = 0;
          }
        } else {
          updated++;
        }
      } else {
        skipped++;
      }
    }

    // Commit les dernières mises à jour
    if (write && batchCount > 0) {
      await batch.commit();
    }

    // Compter les ressources qui n'existent pas
    const missingResources = resources.filter(r => !r.exists && !r.error);
    if (missingResources.length > 0) {
      console.warn(`   ⚠️ ${missingResources.length} ${resourceType} listés dans l'instance n'existent pas`);
    }

  } catch (error) {
    console.error(`   ❌ Erreur lors de la mise à jour des ${resourceType}:`, error.message);
    errors++;
  }

  return { updated, skipped, errors };
}

/**
 * Corriger les ressources d'une instance
 */
async function fixInstanceResources(instance, write) {
  const instanceId = instance.id;
  const instanceData = instance.data();
  const agencyId = instanceData.agencyId;
  const universId = instanceData.universId;

  console.log(`\n📦 Instance ${instanceId} (Univers: ${universId}, Agency: ${agencyId})`);

  const instances = instanceData.instances || {};
  const forms = instances.forms || [];
  const dashboards = instances.dashboards || [];
  const lists = instances.lists || [];
  const instructions = instances.instructions || [];
  const reports = instances.reports || [];

  const stats = {
    forms: { updated: 0, skipped: 0, errors: 0 },
    dashboards: { updated: 0, skipped: 0, errors: 0 },
    lists: { updated: 0, skipped: 0, errors: 0 },
    instructions: { updated: 0, skipped: 0, errors: 0 },
    reports: { updated: 0, skipped: 0, errors: 0 }
  };

  // Mettre à jour les formulaires
  if (forms.length > 0) {
    console.log(`   📝 Formulaires: ${forms.length}`);
    stats.forms = await updateResourcesForInstance(
      instanceId,
      instanceData,
      'formulaires',
      FORMS_COLLECTION,
      forms,
      write
    );
    if (stats.forms.updated > 0) {
      console.log(`      ✅ ${stats.forms.updated} mis à jour, ${stats.forms.skipped} déjà corrects`);
    }
  }

  // Mettre à jour les dashboards
  if (dashboards.length > 0) {
    console.log(`   📊 Dashboards: ${dashboards.length}`);
    stats.dashboards = await updateResourcesForInstance(
      instanceId,
      instanceData,
      'dashboards',
      DASHBOARDS_COLLECTION,
      dashboards,
      write
    );
    if (stats.dashboards.updated > 0) {
      console.log(`      ✅ ${stats.dashboards.updated} mis à jour, ${stats.dashboards.skipped} déjà corrects`);
    }
  }

  // Mettre à jour les listes
  if (lists.length > 0) {
    console.log(`   📋 Listes: ${lists.length}`);
    stats.lists = await updateResourcesForInstance(
      instanceId,
      instanceData,
      'listes',
      LISTS_COLLECTION,
      lists,
      write
    );
    if (stats.lists.updated > 0) {
      console.log(`      ✅ ${stats.lists.updated} mis à jour, ${stats.lists.skipped} déjà corrects`);
    }
  }

  // Mettre à jour les instructions
  if (instructions.length > 0) {
    console.log(`   📚 Instructions: ${instructions.length}`);
    stats.instructions = await updateResourcesForInstance(
      instanceId,
      instanceData,
      'instructions',
      INSTRUCTIONS_COLLECTION,
      instructions,
      write
    );
    if (stats.instructions.updated > 0) {
      console.log(`      ✅ ${stats.instructions.updated} mis à jour, ${stats.instructions.skipped} déjà corrects`);
    }
  }

  // Mettre à jour les rapports
  if (reports.length > 0) {
    console.log(`   📄 Rapports: ${reports.length}`);
    stats.reports = await updateResourcesForInstance(
      instanceId,
      instanceData,
      'rapports',
      REPORTS_COLLECTION,
      reports,
      write
    );
    if (stats.reports.updated > 0) {
      console.log(`      ✅ ${stats.reports.updated} mis à jour, ${stats.reports.skipped} déjà corrects`);
    }
  }

  return stats;
}

/**
 * Corriger les ressources qui ont un universId mais pas de universInstanceId
 * ou qui ont un universInstanceId qui ne correspond à aucune instance
 */
async function fixOrphanResources(write) {
  console.log('\n🔍 Recherche des ressources orphelines...');

  const stats = {
    forms: { updated: 0, skipped: 0, errors: 0 },
    dashboards: { updated: 0, skipped: 0, errors: 0 },
    lists: { updated: 0, skipped: 0, errors: 0 },
    instructions: { updated: 0, skipped: 0, errors: 0 },
    reports: { updated: 0, skipped: 0, errors: 0 }
  };

  // Récupérer toutes les instances actives
  const instancesSnapshot = await db.collection(INSTANCES_COLLECTION).get();
  const activeInstances = new Map(); // Map<agencyId_universId, instanceId>

  instancesSnapshot.docs.forEach(doc => {
    const instanceData = doc.data();
    const key = `${instanceData.agencyId}_${instanceData.universId}`;
    // Garder seulement les instances actives
    if (instanceData.isActive) {
      activeInstances.set(key, doc.id);
    }
  });

  console.log(`   📊 ${activeInstances.size} instance(s) active(s) trouvée(s)`);

  // Pour chaque type de ressource
  const resourceTypes = [
    { name: 'formulaires', collection: FORMS_COLLECTION, key: 'forms' },
    { name: 'dashboards', collection: DASHBOARDS_COLLECTION, key: 'dashboards' },
    { name: 'listes', collection: LISTS_COLLECTION, key: 'lists' },
    { name: 'instructions', collection: INSTRUCTIONS_COLLECTION, key: 'instructions' },
    { name: 'rapports', collection: REPORTS_COLLECTION, key: 'reports' }
  ];

  for (const resourceType of resourceTypes) {
    try {
      console.log(`\n   🔍 Vérification des ${resourceType.name}...`);
      
      // Récupérer toutes les ressources avec un universId
      const resourcesSnapshot = await db.collection(resourceType.collection)
        .where('universId', '!=', null)
        .get();

      const batch = db.batch();
      let batchCount = 0;
      let updated = 0;
      let skipped = 0;

      for (const resourceDoc of resourcesSnapshot.docs) {
        const resourceData = resourceDoc.data();
        const universId = resourceData.universId;
        const agencyId = resourceData.agencyId;
        const currentInstanceId = resourceData.universInstanceId;

        if (!universId || !agencyId) {
          continue;
        }

        const key = `${agencyId}_${universId}`;
        const activeInstanceId = activeInstances.get(key);

        // Si la ressource n'a pas de universInstanceId ou a un universInstanceId incorrect
        if (!currentInstanceId || (activeInstanceId && currentInstanceId !== activeInstanceId)) {
          if (activeInstanceId) {
            // Mettre à jour avec l'instance active
            if (write) {
              const resourceRef = db.collection(resourceType.collection).doc(resourceDoc.id);
              batch.update(resourceRef, {
                universInstanceId: activeInstanceId,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });
              batchCount++;
              updated++;

              if (batchCount >= MAX_BATCH_SIZE) {
                await batch.commit();
                batchCount = 0;
              }
            } else {
              updated++;
            }
          } else {
            // Pas d'instance active pour ce Univers, on ne peut pas corriger
            skipped++;
          }
        } else {
          skipped++;
        }
      }

      // Commit les dernières mises à jour
      if (write && batchCount > 0) {
        await batch.commit();
      }

      stats[resourceType.key] = { updated, skipped, errors: 0 };
      console.log(`      ✅ ${updated} ${resourceType.name} à mettre à jour, ${skipped} déjà corrects`);

    } catch (error) {
      console.error(`   ❌ Erreur lors de la vérification des ${resourceType.name}:`, error.message);
      stats[resourceType.key].errors++;
    }
  }

  return stats;
}

/**
 * Script principal
 */
async function main() {
  const write = process.argv.includes('--write');
  
  console.log('🚀 Script de migration des ressources Univers');
  console.log(`   Mode: ${write ? 'ÉCRITURE (les modifications seront appliquées)' : 'DRY-RUN (simulation uniquement)'}`);
  console.log('');

  if (!write) {
    console.log('⚠️  Mode DRY-RUN : aucune modification ne sera appliquée');
    console.log('   Ajoutez --write pour appliquer les modifications\n');
  }

  try {
    // 1. Corriger les ressources listées dans les instances
    console.log('📦 Étape 1 : Correction des ressources listées dans les instances...');
    const instancesSnapshot = await db.collection(INSTANCES_COLLECTION).get();
    console.log(`   ${instancesSnapshot.docs.length} instance(s) trouvée(s)`);

    let totalStats = {
      forms: { updated: 0, skipped: 0, errors: 0 },
      dashboards: { updated: 0, skipped: 0, errors: 0 },
      lists: { updated: 0, skipped: 0, errors: 0 },
      instructions: { updated: 0, skipped: 0, errors: 0 },
      reports: { updated: 0, skipped: 0, errors: 0 }
    };

    for (const instance of instancesSnapshot.docs) {
      const stats = await fixInstanceResources(instance, write);
      
      // Agréger les statistiques
      Object.keys(totalStats).forEach(key => {
        totalStats[key].updated += stats[key].updated;
        totalStats[key].skipped += stats[key].skipped;
        totalStats[key].errors += stats[key].errors;
      });
    }

    // 2. Corriger les ressources orphelines
    console.log('\n📦 Étape 2 : Correction des ressources orphelines...');
    const orphanStats = await fixOrphanResources(write);

    // Agréger les statistiques
    Object.keys(totalStats).forEach(key => {
      totalStats[key].updated += orphanStats[key].updated;
      totalStats[key].skipped += orphanStats[key].skipped;
      totalStats[key].errors += orphanStats[key].errors;
    });

    // Résumé final
    console.log('\n📊 Résumé final :');
    console.log(`   Formulaires: ${totalStats.forms.updated} mis à jour, ${totalStats.forms.skipped} déjà corrects`);
    console.log(`   Dashboards: ${totalStats.dashboards.updated} mis à jour, ${totalStats.dashboards.skipped} déjà corrects`);
    console.log(`   Listes: ${totalStats.lists.updated} mis à jour, ${totalStats.lists.skipped} déjà corrects`);
    console.log(`   Instructions: ${totalStats.instructions.updated} mis à jour, ${totalStats.instructions.skipped} déjà corrects`);
    console.log(`   Rapports: ${totalStats.reports.updated} mis à jour, ${totalStats.reports.skipped} déjà corrects`);

    const totalUpdated = Object.values(totalStats).reduce((sum, stat) => sum + stat.updated, 0);
    const totalErrors = Object.values(totalStats).reduce((sum, stat) => sum + stat.errors, 0);

    if (totalUpdated > 0) {
      if (write) {
        console.log(`\n✅ ${totalUpdated} ressource(s) mise(s) à jour avec succès !`);
      } else {
        console.log(`\n✅ ${totalUpdated} ressource(s) seraient mise(s) à jour en mode écriture`);
      }
    } else {
      console.log('\n✅ Aucune ressource à mettre à jour');
    }

    if (totalErrors > 0) {
      console.log(`\n⚠️  ${totalErrors} erreur(s) rencontrée(s)`);
    }

  } catch (error) {
    console.error('\n❌ Erreur lors de l\'exécution du script:', error);
    process.exit(1);
  }
}

// Exécuter le script
main().then(() => {
  console.log('\n✅ Script terminé');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Erreur fatale:', error);
  process.exit(1);
});


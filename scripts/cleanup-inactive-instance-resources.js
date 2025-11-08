/**
 * Script pour supprimer les ressources des instances inactives
 * Garde seulement les ressources de l'instance active
 * 
 * Usage: node scripts/cleanup-inactive-instance-resources.js [directorId] [agencyId] [--write]
 *   - Sans --write : mode dry-run (affiche seulement ce qui serait supprimé)
 *   - Avec --write : supprime les ressources des instances inactives
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
const ACTIVE_UNIVERS_COLLECTION = 'activeUnivers';
const INSTANCES_COLLECTION = 'universInstances';
const FORMS_COLLECTION = 'forms';
const DASHBOARDS_COLLECTION = 'dashboards';
const LISTS_COLLECTION = 'lists';
const INSTRUCTIONS_COLLECTION = 'scheduledQuestions';
const REPORTS_COLLECTION = 'reports';

const MAX_BATCH_SIZE = 500; // Limite Firestore

/**
 * Supprimer les ressources d'une instance inactive
 */
async function cleanupInactiveInstanceResources(
  activeInstanceId,
  universId,
  agencyId,
  write
) {
  try {
    // Récupérer toutes les instances pour ce Univers
    const instancesSnapshot = await db.collection(INSTANCES_COLLECTION)
      .where('universId', '==', universId)
      .where('agencyId', '==', agencyId)
      .get();

    const inactiveInstances = instancesSnapshot.docs.filter(doc => {
      const instance = doc.data();
      return !instance.isActive && doc.id !== activeInstanceId;
    });

    if (inactiveInstances.length === 0) {
      console.log('   ✅ Aucune instance inactive trouvée');
      return { deleted: 0, errors: 0 };
    }

    console.log(`   📦 ${inactiveInstances.length} instance(s) inactive(s) trouvée(s)`);

    let totalDeleted = 0;
    let errors = 0;

    // Pour chaque instance inactive, supprimer ses ressources
    for (const instanceDoc of inactiveInstances) {
      const instanceId = instanceDoc.id;
      const instanceData = instanceDoc.data();
      const instances = instanceData.instances || {};

      console.log(`\n   🔍 Instance inactive: ${instanceId}`);

      const resourceTypes = [
        { name: 'formulaires', collection: FORMS_COLLECTION, ids: instances.forms || [] },
        { name: 'dashboards', collection: DASHBOARDS_COLLECTION, ids: instances.dashboards || [] },
        { name: 'listes', collection: LISTS_COLLECTION, ids: instances.lists || [] },
        { name: 'instructions', collection: INSTRUCTIONS_COLLECTION, ids: instances.instructions || [] },
        { name: 'rapports', collection: REPORTS_COLLECTION, ids: instances.reports || [] }
      ];

      for (const resourceType of resourceTypes) {
        if (resourceType.ids.length === 0) {
          continue;
        }

        console.log(`      📝 ${resourceType.name}: ${resourceType.ids.length} ressource(s)`);

        if (write) {
          // Supprimer les ressources par batch
          const batch = db.batch();
          let batchCount = 0;
          let deleted = 0;

          for (const resourceId of resourceType.ids) {
            try {
              // Vérifier que la ressource existe et appartient à cette instance
              const resourceDoc = await db.collection(resourceType.collection).doc(resourceId).get();
              if (resourceDoc.exists) {
                const resourceData = resourceDoc.data();
                // Vérifier que la ressource appartient bien à cette instance inactive
                if (resourceData.universInstanceId === instanceId) {
                  const resourceRef = db.collection(resourceType.collection).doc(resourceId);
                  batch.delete(resourceRef);
                  batchCount++;
                  deleted++;

                  if (batchCount >= MAX_BATCH_SIZE) {
                    await batch.commit();
                    batchCount = 0;
                  }
                }
              }
            } catch (error) {
              console.warn(`         ⚠️ Erreur lors de la suppression de ${resourceType.name} ${resourceId}:`, error.message);
              errors++;
            }
          }

          // Commit les dernières suppressions
          if (batchCount > 0) {
            await batch.commit();
          }

          totalDeleted += deleted;
          console.log(`         ✅ ${deleted} ${resourceType.name} supprimé(s)`);
        } else {
          // Mode dry-run : juste compter
          let count = 0;
          for (const resourceId of resourceType.ids) {
            try {
              const resourceDoc = await db.collection(resourceType.collection).doc(resourceId).get();
              if (resourceDoc.exists) {
                const resourceData = resourceDoc.data();
                if (resourceData.universInstanceId === instanceId) {
                  count++;
                }
              }
            } catch (error) {
              // Ignorer les erreurs en mode dry-run
            }
          }
          totalDeleted += count;
          console.log(`         ✅ ${count} ${resourceType.name} seraient supprimé(s)`);
        }
      }
    }

    return { deleted: totalDeleted, errors };
  } catch (error) {
    console.error('   ❌ Erreur lors du nettoyage des ressources des instances inactives:', error.message);
    return { deleted: 0, errors: 1 };
  }
}

/**
 * Script principal
 */
async function main() {
  const directorId = process.argv[2];
  const agencyId = process.argv[3] || 'agency1';
  const write = process.argv.includes('--write');
  
  console.log('🚀 Script de nettoyage des ressources des instances inactives');
  console.log(`   Mode: ${write ? 'ÉCRITURE (les ressources seront supprimées)' : 'DRY-RUN (simulation uniquement)'}`);
  console.log('');

  if (!write) {
    console.log('⚠️  Mode DRY-RUN : aucune suppression ne sera effectuée');
    console.log('   Ajoutez --write pour supprimer les ressources\n');
  }

  if (!directorId) {
    console.log('❌ Veuillez fournir un directorId');
    console.log('   Usage: node scripts/cleanup-inactive-instance-resources.js [directorId] [agencyId] [--write]');
    process.exit(1);
  }

  try {
    // Récupérer l'ActiveUnivers
    const activeUniversSnapshot = await db.collection(ACTIVE_UNIVERS_COLLECTION)
      .where('directorId', '==', directorId)
      .where('agencyId', '==', agencyId)
      .get();

    if (activeUniversSnapshot.empty) {
      console.log('❌ Aucun Univers actif trouvé pour ce directeur');
      process.exit(1);
    }

    const activeUnivers = activeUniversSnapshot.docs[0].data();
    const activeUniversId = activeUnivers.activeUniversId;
    const activeInstanceId = activeUnivers.activeInstanceId;

    if (!activeInstanceId || activeInstanceId === 'AUCUNE') {
      console.log('❌ Aucune instance active trouvée pour ce directeur');
      process.exit(1);
    }

    console.log(`📊 Univers actif: ${activeUniversId}`);
    console.log(`📦 Instance active: ${activeInstanceId}\n`);

    // Nettoyer les ressources des instances inactives
    const stats = await cleanupInactiveInstanceResources(
      activeInstanceId,
      activeUniversId,
      agencyId,
      write
    );

    // Résumé
    console.log(`\n📊 Résumé:`);
    console.log(`   Ressources supprimées: ${stats.deleted}`);
    if (stats.errors > 0) {
      console.log(`   Erreurs: ${stats.errors}`);
    }

    if (stats.deleted > 0) {
      if (write) {
        console.log(`\n✅ ${stats.deleted} ressource(s) supprimée(s) avec succès !`);
      } else {
        console.log(`\n✅ ${stats.deleted} ressource(s) seraient supprimée(s) en mode écriture`);
      }
    } else {
      console.log('\n✅ Aucune ressource à supprimer');
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


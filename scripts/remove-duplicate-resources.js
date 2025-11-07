/**
 * Script pour supprimer les ressources dupliquées
 * Garde seulement la première occurrence de chaque ressource (par titre/nom)
 * 
 * Usage: node scripts/remove-duplicate-resources.js [directorId] [agencyId] [--write]
 *   - Sans --write : mode dry-run (affiche seulement ce qui serait supprimé)
 *   - Avec --write : supprime les doublons
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
 * Supprimer les doublons pour un type de ressource
 */
async function removeDuplicatesForResourceType(
  instanceId,
  universId,
  agencyId,
  resourceType,
  collectionName,
  getTitle,
  write
) {
  try {
    // Récupérer toutes les ressources de cette instance
    const resourcesSnapshot = await db.collection(collectionName)
      .where('agencyId', '==', agencyId)
      .where('universId', '==', universId)
      .where('universInstanceId', '==', instanceId)
      .get();

    if (resourcesSnapshot.empty) {
      return { kept: 0, deleted: 0, errors: 0 };
    }

    // Grouper par titre/nom
    const resourcesByTitle = {};
    resourcesSnapshot.docs.forEach(doc => {
      const resource = doc.data();
      const title = getTitle(resource) || 'Sans titre';
      
      if (!resourcesByTitle[title]) {
        resourcesByTitle[title] = [];
      }
      resourcesByTitle[title].push({
        id: doc.id,
        data: resource,
        createdAt: resource.createdAt?.toDate?.() || resource.createdAt || new Date(0)
      });
    });

    // Pour chaque titre, garder la première occurrence (la plus ancienne) et supprimer les autres
    const toDelete = [];
    const toKeep = [];

    Object.keys(resourcesByTitle).forEach(title => {
      const resources = resourcesByTitle[title];
      
      if (resources.length > 1) {
        // Trier par date de création (la plus ancienne en premier)
        resources.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        
        // Garder la première (la plus ancienne)
        toKeep.push(resources[0]);
        
        // Supprimer les autres
        for (let i = 1; i < resources.length; i++) {
          toDelete.push(resources[i]);
        }
      } else {
        // Une seule occurrence, la garder
        toKeep.push(resources[0]);
      }
    });

    if (toDelete.length === 0) {
      return { kept: toKeep.length, deleted: 0, errors: 0 };
    }

    console.log(`   📦 ${resourceType}: ${toKeep.length} à garder, ${toDelete.length} à supprimer`);

    if (write) {
      // Supprimer les doublons par batch
      const batch = db.batch();
      let batchCount = 0;
      let deleted = 0;

      for (const resource of toDelete) {
        const resourceRef = db.collection(collectionName).doc(resource.id);
        batch.delete(resourceRef);
        batchCount++;
        deleted++;

        if (batchCount >= MAX_BATCH_SIZE) {
          await batch.commit();
          batchCount = 0;
        }
      }

      // Commit les dernières suppressions
      if (batchCount > 0) {
        await batch.commit();
      }

      // Mettre à jour l'instance pour refléter les ressources restantes
      const instanceRef = db.collection(INSTANCES_COLLECTION).doc(instanceId);
      const instanceDoc = await instanceRef.get();
      
      if (instanceDoc.exists) {
        const instanceData = instanceDoc.data();
        const instances = instanceData.instances || {};
        
        // Mettre à jour la liste des ressources dans l'instance
        const resourceKey = resourceType === 'formulaires' ? 'forms' :
                           resourceType === 'dashboards' ? 'dashboards' :
                           resourceType === 'listes' ? 'lists' :
                           resourceType === 'instructions' ? 'instructions' :
                           resourceType === 'rapports' ? 'reports' : null;
        
        if (resourceKey) {
          const keptIds = toKeep.map(r => r.id);
          await instanceRef.update({
            [`instances.${resourceKey}`]: keptIds,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }

      return { kept: toKeep.length, deleted, errors: 0 };
    } else {
      // Mode dry-run : afficher ce qui serait supprimé
      console.log(`      Doublons à supprimer:`);
      Object.keys(resourcesByTitle).forEach(title => {
        const resources = resourcesByTitle[title];
        if (resources.length > 1) {
          resources.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
          console.log(`         "${title}": garder ${resources[0].id} (${resources[0].createdAt.toISOString()}), supprimer ${resources.length - 1} autre(s)`);
        }
      });
      
      return { kept: toKeep.length, deleted: toDelete.length, errors: 0 };
    }
  } catch (error) {
    console.error(`   ❌ Erreur lors de la suppression des doublons pour ${resourceType}:`, error.message);
    return { kept: 0, deleted: 0, errors: 1 };
  }
}

/**
 * Supprimer les doublons pour une instance
 */
async function removeDuplicatesForInstance(directorId, agencyId, write) {
  console.log(`\n🔍 Analyse pour directeur: ${directorId}, agence: ${agencyId}\n`);

  // 1. Récupérer l'ActiveUnivers
  const activeUniversSnapshot = await db.collection(ACTIVE_UNIVERS_COLLECTION)
    .where('directorId', '==', directorId)
    .where('agencyId', '==', agencyId)
    .get();

  if (activeUniversSnapshot.empty) {
    console.log('❌ Aucun Univers actif trouvé pour ce directeur');
    return { kept: 0, deleted: 0, errors: 0 };
  }

  const activeUnivers = activeUniversSnapshot.docs[0].data();
  const activeUniversId = activeUnivers.activeUniversId;
  const activeInstanceId = activeUnivers.activeInstanceId;

  if (!activeInstanceId || activeInstanceId === 'AUCUNE') {
    console.log('❌ Aucune instance active trouvée pour ce directeur');
    return { kept: 0, deleted: 0, errors: 0 };
  }

  console.log(`📊 Univers actif: ${activeUniversId}`);
  console.log(`📦 Instance active: ${activeInstanceId}\n`);

  const stats = {
    forms: { kept: 0, deleted: 0, errors: 0 },
    dashboards: { kept: 0, deleted: 0, errors: 0 },
    lists: { kept: 0, deleted: 0, errors: 0 },
    instructions: { kept: 0, deleted: 0, errors: 0 },
    reports: { kept: 0, deleted: 0, errors: 0 }
  };

  // Supprimer les doublons pour chaque type de ressource
  console.log('📝 Formulaires:');
  stats.forms = await removeDuplicatesForResourceType(
    activeInstanceId,
    activeUniversId,
    agencyId,
    'formulaires',
    FORMS_COLLECTION,
    (resource) => resource.title,
    write
  );

  console.log('📊 Dashboards:');
  stats.dashboards = await removeDuplicatesForResourceType(
    activeInstanceId,
    activeUniversId,
    agencyId,
    'dashboards',
    DASHBOARDS_COLLECTION,
    (resource) => resource.name || resource.title,
    write
  );

  console.log('📋 Listes:');
  stats.lists = await removeDuplicatesForResourceType(
    activeInstanceId,
    activeUniversId,
    agencyId,
    'listes',
    LISTS_COLLECTION,
    (resource) => resource.title,
    write
  );

  console.log('📚 Instructions:');
  stats.instructions = await removeDuplicatesForResourceType(
    activeInstanceId,
    activeUniversId,
    agencyId,
    'instructions',
    INSTRUCTIONS_COLLECTION,
    (resource) => resource.title,
    write
  );

  console.log('📄 Rapports:');
  stats.reports = await removeDuplicatesForResourceType(
    activeInstanceId,
    activeUniversId,
    agencyId,
    'rapports',
    REPORTS_COLLECTION,
    (resource) => resource.title || resource.name,
    write
  );

  return stats;
}

/**
 * Script principal
 */
async function main() {
  const directorId = process.argv[2];
  const agencyId = process.argv[3] || 'agency1';
  const write = process.argv.includes('--write');
  
  console.log('🚀 Script de suppression des ressources dupliquées');
  console.log(`   Mode: ${write ? 'ÉCRITURE (les doublons seront supprimés)' : 'DRY-RUN (simulation uniquement)'}`);
  console.log('');

  if (!write) {
    console.log('⚠️  Mode DRY-RUN : aucune suppression ne sera effectuée');
    console.log('   Ajoutez --write pour supprimer les doublons\n');
  }

  try {
    if (directorId) {
      // Supprimer les doublons pour un directeur spécifique
      const stats = await removeDuplicatesForInstance(directorId, agencyId, write);
      
      // Résumé
      console.log('\n📊 Résumé:');
      console.log(`   Formulaires: ${stats.forms.kept} gardés, ${stats.forms.deleted} supprimés`);
      console.log(`   Dashboards: ${stats.dashboards.kept} gardés, ${stats.dashboards.deleted} supprimés`);
      console.log(`   Listes: ${stats.lists.kept} gardées, ${stats.lists.deleted} supprimées`);
      console.log(`   Instructions: ${stats.instructions.kept} gardées, ${stats.instructions.deleted} supprimées`);
      console.log(`   Rapports: ${stats.reports.kept} gardés, ${stats.reports.deleted} supprimés`);

      const totalDeleted = Object.values(stats).reduce((sum, stat) => sum + stat.deleted, 0);
      const totalKept = Object.values(stats).reduce((sum, stat) => sum + stat.kept, 0);

      if (totalDeleted > 0) {
        if (write) {
          console.log(`\n✅ ${totalDeleted} ressource(s) dupliquée(s) supprimée(s) avec succès !`);
          console.log(`   ${totalKept} ressource(s) unique(s) conservée(s)`);
        } else {
          console.log(`\n✅ ${totalDeleted} ressource(s) dupliquée(s) seraient supprimée(s) en mode écriture`);
          console.log(`   ${totalKept} ressource(s) unique(s) seraient conservée(s)`);
        }
      } else {
        console.log('\n✅ Aucun doublon trouvé');
      }
    } else {
      console.log('❌ Veuillez fournir un directorId');
      console.log('   Usage: node scripts/remove-duplicate-resources.js [directorId] [agencyId] [--write]');
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


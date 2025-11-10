/**
 * Script pour supprimer tous les doublons détectés par le script de vérification exhaustive
 * 
 * Pour chaque Univers avec instance active :
 * 1. Détecte les doublons dans les collections
 * 2. Supprime les doublons en gardant la plus ancienne ressource (par createdAt)
 * 3. Met à jour l'instance pour retirer les IDs des ressources supprimées
 * 
 * Usage: node scripts/remove-all-duplicates.js [--write]
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
const UNIVERS_COLLECTION = 'univers';
const INSTANCES_COLLECTION = 'universInstances';
const ACTIVE_UNIVERS_COLLECTION = 'activeUnivers';
const FORMS_COLLECTION = 'forms';
const DASHBOARDS_COLLECTION = 'dashboards';
const LISTS_COLLECTION = 'lists';
const INSTRUCTIONS_COLLECTION = 'scheduledQuestions';
const REPORTS_COLLECTION = 'reports';

const MAX_BATCH_SIZE = 500;

/**
 * Trouver toutes les ressources dans les collections pour une instance
 */
async function findAllResourcesInCollections(instanceId, universId, agencyId) {
  const allResources = {
    forms: [],
    dashboards: [],
    lists: [],
    instructions: [],
    reports: []
  };

  // Trouver tous les formulaires pour cette instance
  try {
    const formsSnapshot = await db.collection(FORMS_COLLECTION)
      .where('agencyId', '==', agencyId)
      .where('universId', '==', universId)
      .where('universInstanceId', '==', instanceId)
      .get();

    for (const formDoc of formsSnapshot.docs) {
      const formData = formDoc.data();
      allResources.forms.push({
        id: formDoc.id,
        title: formData.title || 'Sans titre',
        createdAt: formData.createdAt?.toDate?.() || formData.createdAt || new Date(0)
      });
    }
  } catch (error) {
    console.warn(`      ⚠️ Erreur lors de la recherche des formulaires: ${error.message}`);
  }

  // Trouver tous les dashboards pour cette instance
  try {
    const dashboardsSnapshot = await db.collection(DASHBOARDS_COLLECTION)
      .where('agencyId', '==', agencyId)
      .where('universId', '==', universId)
      .where('universInstanceId', '==', instanceId)
      .get();

    for (const dashboardDoc of dashboardsSnapshot.docs) {
      const dashboardData = dashboardDoc.data();
      allResources.dashboards.push({
        id: dashboardDoc.id,
        name: dashboardData.name || dashboardData.title || 'Sans titre',
        createdAt: dashboardData.createdAt?.toDate?.() || dashboardData.createdAt || new Date(0)
      });
    }
  } catch (error) {
    console.warn(`      ⚠️ Erreur lors de la recherche des dashboards: ${error.message}`);
  }

  // Trouver toutes les listes pour cette instance
  try {
    const listsSnapshot = await db.collection(LISTS_COLLECTION)
      .where('agencyId', '==', agencyId)
      .where('universId', '==', universId)
      .where('universInstanceId', '==', instanceId)
      .get();

    for (const listDoc of listsSnapshot.docs) {
      const listData = listDoc.data();
      allResources.lists.push({
        id: listDoc.id,
        title: listData.title || 'Sans titre',
        createdAt: listData.createdAt?.toDate?.() || listData.createdAt || new Date(0)
      });
    }
  } catch (error) {
    console.warn(`      ⚠️ Erreur lors de la recherche des listes: ${error.message}`);
  }

  // Trouver toutes les instructions pour cette instance
  try {
    const instructionsSnapshot = await db.collection(INSTRUCTIONS_COLLECTION)
      .where('agencyId', '==', agencyId)
      .where('universId', '==', universId)
      .where('universInstanceId', '==', instanceId)
      .get();

    for (const instructionDoc of instructionsSnapshot.docs) {
      const instructionData = instructionDoc.data();
      allResources.instructions.push({
        id: instructionDoc.id,
        title: instructionData.title || 'Sans titre',
        createdAt: instructionData.createdAt?.toDate?.() || instructionData.createdAt || new Date(0)
      });
    }
  } catch (error) {
    console.warn(`      ⚠️ Erreur lors de la recherche des instructions: ${error.message}`);
  }

  // Trouver tous les rapports pour cette instance
  try {
    const reportsSnapshot = await db.collection(REPORTS_COLLECTION)
      .where('agencyId', '==', agencyId)
      .where('universId', '==', universId)
      .where('universInstanceId', '==', instanceId)
      .get();

    for (const reportDoc of reportsSnapshot.docs) {
      const reportData = reportDoc.data();
      allResources.reports.push({
        id: reportDoc.id,
        title: reportData.title || reportData.name || 'Sans titre',
        createdAt: reportData.createdAt?.toDate?.() || reportData.createdAt || new Date(0)
      });
    }
  } catch (error) {
    console.warn(`      ⚠️ Erreur lors de la recherche des rapports: ${error.message}`);
  }

  return allResources;
}

/**
 * Détecter les doublons dans une liste de ressources
 */
function detectDuplicates(resources, getTitle) {
  const byTitle = new Map();
  const duplicates = [];
  const toKeep = new Set();
  
  // Trier par date de création (la plus ancienne en premier)
  const sortedResources = [...resources].sort((a, b) => {
    const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt || 0);
    const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt || 0);
    return dateA.getTime() - dateB.getTime();
  });
  
  sortedResources.forEach(resource => {
    const title = getTitle(resource);
    if (byTitle.has(title)) {
      // C'est un doublon
      duplicates.push({
        id: resource.id,
        title,
        duplicateOf: byTitle.get(title),
        createdAt: resource.createdAt
      });
    } else {
      // Première occurrence, la garder
      byTitle.set(title, resource.id);
      toKeep.add(resource.id);
    }
  });
  
  return { duplicates, toKeep };
}

/**
 * Supprimer les doublons pour une instance
 */
async function removeDuplicatesForInstance(instanceId, universId, agencyId, write = false) {
  console.log(`\n   🔍 Analyse de l'instance ${instanceId}...`);
  
  // Trouver toutes les ressources dans les collections
  const allResources = await findAllResourcesInCollections(instanceId, universId, agencyId);
  
  // Détecter les doublons
  const formsDuplicates = detectDuplicates(allResources.forms, r => r.title);
  const dashboardsDuplicates = detectDuplicates(allResources.dashboards, r => r.name);
  const listsDuplicates = detectDuplicates(allResources.lists, r => r.title);
  const instructionsDuplicates = detectDuplicates(allResources.instructions, r => r.title);
  const reportsDuplicates = detectDuplicates(allResources.reports, r => r.title);
  
  const totalDuplicates = 
    formsDuplicates.duplicates.length +
    dashboardsDuplicates.duplicates.length +
    listsDuplicates.duplicates.length +
    instructionsDuplicates.duplicates.length +
    reportsDuplicates.duplicates.length;
  
  if (totalDuplicates === 0) {
    console.log(`      ✅ Aucun doublon détecté pour cette instance`);
    return { deleted: 0 };
  }
  
  console.log(`      🔴 ${totalDuplicates} doublon(s) détecté(s):`);
  console.log(`         - Formulaires: ${formsDuplicates.duplicates.length}`);
  console.log(`         - Dashboards: ${dashboardsDuplicates.duplicates.length}`);
  console.log(`         - Listes: ${listsDuplicates.duplicates.length}`);
  console.log(`         - Instructions: ${instructionsDuplicates.duplicates.length}`);
  console.log(`         - Rapports: ${reportsDuplicates.duplicates.length}`);
  
  if (!write) {
    console.log(`      ⚠️ Mode dry-run: les doublons ne seront pas supprimés`);
    return { deleted: 0, wouldDelete: totalDuplicates };
  }
  
  // Supprimer les doublons
  let batch = db.batch();
  let batchCount = 0;
  let totalDeleted = 0;
  
  const commitBatch = async () => {
    if (batchCount > 0) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  };
  
  // Supprimer les formulaires dupliqués
  for (const duplicate of formsDuplicates.duplicates) {
    const formRef = db.collection(FORMS_COLLECTION).doc(duplicate.id);
    batch.delete(formRef);
    batchCount++;
    totalDeleted++;
    
    if (batchCount >= MAX_BATCH_SIZE) {
      await commitBatch();
    }
  }
  
  // Supprimer les dashboards dupliqués
  for (const duplicate of dashboardsDuplicates.duplicates) {
    const dashboardRef = db.collection(DASHBOARDS_COLLECTION).doc(duplicate.id);
    batch.delete(dashboardRef);
    batchCount++;
    totalDeleted++;
    
    if (batchCount >= MAX_BATCH_SIZE) {
      await commitBatch();
    }
  }
  
  // Supprimer les listes dupliquées
  for (const duplicate of listsDuplicates.duplicates) {
    const listRef = db.collection(LISTS_COLLECTION).doc(duplicate.id);
    batch.delete(listRef);
    batchCount++;
    totalDeleted++;
    
    if (batchCount >= MAX_BATCH_SIZE) {
      await commitBatch();
    }
  }
  
  // Supprimer les instructions dupliquées
  for (const duplicate of instructionsDuplicates.duplicates) {
    const instructionRef = db.collection(INSTRUCTIONS_COLLECTION).doc(duplicate.id);
    batch.delete(instructionRef);
    batchCount++;
    totalDeleted++;
    
    if (batchCount >= MAX_BATCH_SIZE) {
      await commitBatch();
    }
  }
  
  // Supprimer les rapports dupliqués
  for (const duplicate of reportsDuplicates.duplicates) {
    const reportRef = db.collection(REPORTS_COLLECTION).doc(duplicate.id);
    batch.delete(reportRef);
    batchCount++;
    totalDeleted++;
    
    if (batchCount >= MAX_BATCH_SIZE) {
      await commitBatch();
    }
  }
  
  await commitBatch();
  
  // Mettre à jour l'instance pour retirer les IDs des ressources supprimées et ajouter les ressources orphelines
  const instanceRef = db.collection(INSTANCES_COLLECTION).doc(instanceId);
  const instanceDoc = await instanceRef.get();
  
  if (instanceDoc.exists) {
    const instanceData = instanceDoc.data();
    const instances = instanceData.instances || {};
    
    // Filtrer les IDs supprimés
    const deletedFormIds = new Set(formsDuplicates.duplicates.map(d => d.id));
    const deletedDashboardIds = new Set(dashboardsDuplicates.duplicates.map(d => d.id));
    const deletedListIds = new Set(listsDuplicates.duplicates.map(d => d.id));
    const deletedInstructionIds = new Set(instructionsDuplicates.duplicates.map(d => d.id));
    const deletedReportIds = new Set(reportsDuplicates.duplicates.map(d => d.id));
    
    // Créer des sets des IDs à garder (ressources non supprimées)
    const keptFormIds = new Set(allResources.forms.filter(r => !deletedFormIds.has(r.id)).map(r => r.id));
    const keptDashboardIds = new Set(allResources.dashboards.filter(r => !deletedDashboardIds.has(r.id)).map(r => r.id));
    const keptListIds = new Set(allResources.lists.filter(r => !deletedListIds.has(r.id)).map(r => r.id));
    const keptInstructionIds = new Set(allResources.instructions.filter(r => !deletedInstructionIds.has(r.id)).map(r => r.id));
    const keptReportIds = new Set(allResources.reports.filter(r => !deletedReportIds.has(r.id)).map(r => r.id));
    
    // Combiner les IDs existants (filtrés) avec les IDs des ressources gardées
    const existingFormIds = new Set((instances.forms || []).filter(id => !deletedFormIds.has(id)));
    const existingDashboardIds = new Set((instances.dashboards || []).filter(id => !deletedDashboardIds.has(id)));
    const existingListIds = new Set((instances.lists || []).filter(id => !deletedListIds.has(id)));
    const existingInstructionIds = new Set((instances.instructions || []).filter(id => !deletedInstructionIds.has(id)));
    const existingReportIds = new Set((instances.reports || []).filter(id => !deletedReportIds.has(id)));
    
    // Fusionner : garder les IDs existants et ajouter les IDs des ressources gardées qui ne sont pas déjà dans l'instance
    const updatedInstances = {
      forms: Array.from(new Set([...existingFormIds, ...keptFormIds])),
      dashboards: Array.from(new Set([...existingDashboardIds, ...keptDashboardIds])),
      lists: Array.from(new Set([...existingListIds, ...keptListIds])),
      instructions: Array.from(new Set([...existingInstructionIds, ...keptInstructionIds])),
      reports: Array.from(new Set([...existingReportIds, ...keptReportIds]))
    };
    
    await instanceRef.update({
      instances: updatedInstances,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`      ✅ Instance mise à jour pour retirer les IDs des ressources supprimées et ajouter les ressources orphelines`);
  }
  
  console.log(`      ✅ ${totalDeleted} doublon(s) supprimé(s)`);
  
  return { deleted: totalDeleted };
}

/**
 * Script principal
 */
async function main() {
  const write = process.argv.includes('--write');
  
  console.log('🔍 Suppression des doublons pour tous les Univers actifs');
  console.log(`   Mode: ${write ? 'SUPPRESSION' : 'DRY-RUN (simulation)'}`);
  console.log('');

  try {
    // Récupérer tous les Univers
    const universSnapshot = await db.collection(UNIVERS_COLLECTION).get();
    console.log(`📦 ${universSnapshot.size} Univers trouvé(s)\n`);

    let totalDeleted = 0;
    let totalWouldDelete = 0;
    let instancesProcessed = 0;

    for (const universDoc of universSnapshot.docs) {
      const universId = universDoc.id;
      const univers = universDoc.data();
      
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📦 Univers: ${universId}`);
      console.log(`   Nom: ${univers.metadata?.name || 'Sans nom'}`);

      // Trouver les instances actives pour ce Univers
      const activeUniversSnapshot = await db.collection(ACTIVE_UNIVERS_COLLECTION)
        .where('activeUniversId', '==', universId)
        .get();

      if (activeUniversSnapshot.empty) {
        console.log(`   ⚠️ Aucune instance active trouvée pour ce Univers`);
        continue;
      }

      for (const activeUniversDoc of activeUniversSnapshot.docs) {
        const activeUnivers = activeUniversDoc.data();
        const directorId = activeUnivers.directorId;
        const agencyId = activeUnivers.agencyId;
        const activeInstanceId = activeUnivers.activeInstanceId;

        console.log(`\n   👤 Directeur: ${directorId}, Agence: ${agencyId}`);
        console.log(`   📦 Instance active: ${activeInstanceId || 'AUCUNE'}`);

        if (!activeInstanceId || activeInstanceId === 'AUCUNE') {
          console.log(`   ⚠️ Pas d'instance active pour ce directeur`);
          continue;
        }

        // Vérifier que l'instance existe
        const instanceDoc = await db.collection(INSTANCES_COLLECTION).doc(activeInstanceId).get();
        if (!instanceDoc.exists) {
          console.log(`   ❌ Instance ${activeInstanceId} n'existe pas !`);
          continue;
        }

        // Supprimer les doublons pour cette instance
        const result = await removeDuplicatesForInstance(activeInstanceId, universId, agencyId, write);
        
        if (result.deleted) {
          totalDeleted += result.deleted;
        }
        if (result.wouldDelete) {
          totalWouldDelete += result.wouldDelete;
        }
        
        instancesProcessed++;
      }
    }

    // Résumé
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 RÉSUMÉ`);
    console.log(`${'='.repeat(80)}`);
    console.log(`   Instances traitées: ${instancesProcessed}`);
    
    if (write) {
      console.log(`   Doublons supprimés: ${totalDeleted}`);
    } else {
      console.log(`   Doublons qui seraient supprimés: ${totalWouldDelete}`);
      console.log(`   Exécutez avec --write pour supprimer réellement les doublons`);
    }

    if (totalDeleted === 0 && totalWouldDelete === 0) {
      console.log(`\n✅ Aucun doublon trouvé !`);
    } else if (write) {
      console.log(`\n✅ ${totalDeleted} doublon(s) supprimé(s) avec succès !`);
    } else {
      console.log(`\n⚠️  ${totalWouldDelete} doublon(s) seraient supprimés en mode --write`);
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


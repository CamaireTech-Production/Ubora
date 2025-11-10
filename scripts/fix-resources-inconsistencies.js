/**
 * Script pour corriger les incohérences entre les ressources réelles et les définitions du Univers
 * 
 * Pour chaque Univers avec instance active :
 * 1. Compare les ressources réelles avec les définitions du Univers
 * 2. Pour les ressources en trop : garde celles qui correspondent aux définitions (par titre/nom), supprime les autres
 * 3. Pour les ressources manquantes : les crée si possible
 * 4. Met à jour l'instance avec les IDs corrects
 * 
 * Usage: node scripts/fix-resources-inconsistencies.js [--write] [--user=email]
 *   - Sans --write : mode dry-run (affiche seulement ce qui serait corrigé)
 *   - Avec --write : corrige les incohérences
 *   - Avec --user=email : corrige uniquement pour cet utilisateur
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
const USERS_COLLECTION = 'users';
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
 * Normaliser un titre/nom pour la comparaison
 */
function normalizeTitle(title) {
  if (!title) return '';
  return title.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Comparer deux titres pour voir s'ils correspondent
 */
function titlesMatch(title1, title2) {
  return normalizeTitle(title1) === normalizeTitle(title2);
}

/**
 * Trouver la ressource qui correspond le mieux à une définition
 */
function findMatchingResource(resources, definitionTitle) {
  // Essayer d'abord une correspondance exacte
  const exactMatch = resources.find(r => titlesMatch(r.title || r.name || r.question, definitionTitle));
  if (exactMatch) return exactMatch;

  // Essayer une correspondance partielle (contient le titre de la définition)
  const partialMatch = resources.find(r => {
    const resourceTitle = normalizeTitle(r.title || r.name || r.question);
    const defTitle = normalizeTitle(definitionTitle);
    return resourceTitle.includes(defTitle) || defTitle.includes(resourceTitle);
  });
  if (partialMatch) return partialMatch;

  return null;
}

/**
 * Récupérer toutes les ressources pour une instance
 */
async function getResourcesForInstance(instanceId, universId, agencyId) {
  const resources = {
    forms: [],
    dashboards: [],
    lists: [],
    instructions: [],
    reports: []
  };

  try {
    // Forms
    const formsQuery = db.collection(FORMS_COLLECTION)
      .where('agencyId', '==', agencyId)
      .where('universId', '==', universId)
      .where('universInstanceId', '==', instanceId);
    const formsSnapshot = await formsQuery.get();
    resources.forms = formsSnapshot.docs.map(doc => ({
      id: doc.id,
      title: doc.data().title || 'Sans titre',
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt || new Date(0)
    })).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    // Dashboards
    const dashboardsQuery = db.collection(DASHBOARDS_COLLECTION)
      .where('agencyId', '==', agencyId)
      .where('universId', '==', universId)
      .where('universInstanceId', '==', instanceId);
    const dashboardsSnapshot = await dashboardsQuery.get();
    resources.dashboards = dashboardsSnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name || doc.data().title || 'Sans nom',
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt || new Date(0)
    })).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    // Lists
    const listsQuery = db.collection(LISTS_COLLECTION)
      .where('agencyId', '==', agencyId)
      .where('universId', '==', universId)
      .where('universInstanceId', '==', instanceId);
    const listsSnapshot = await listsQuery.get();
    resources.lists = listsSnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name || 'Sans nom',
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt || new Date(0)
    })).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    // Instructions
    const instructionsQuery = db.collection(INSTRUCTIONS_COLLECTION)
      .where('agencyId', '==', agencyId)
      .where('universId', '==', universId)
      .where('universInstanceId', '==', instanceId);
    const instructionsSnapshot = await instructionsQuery.get();
    resources.instructions = instructionsSnapshot.docs.map(doc => ({
      id: doc.id,
      question: doc.data().question || 'Sans question',
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt || new Date(0)
    })).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    // Reports
    const reportsQuery = db.collection(REPORTS_COLLECTION)
      .where('agencyId', '==', agencyId)
      .where('universId', '==', universId)
      .where('universInstanceId', '==', instanceId);
    const reportsSnapshot = await reportsQuery.get();
    resources.reports = reportsSnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name || doc.data().title || 'Sans nom',
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt || new Date(0)
    })).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  } catch (error) {
    console.warn(`⚠️  Erreur lors de la récupération des ressources: ${error.message}`);
  }

  return resources;
}

/**
 * Corriger les incohérences pour une instance
 */
async function fixInconsistenciesForInstance(instanceId, universId, agencyId, universData, write = false) {
  const definitions = universData.definitions || {};
  const expectedForms = definitions.forms || [];
  const expectedDashboards = definitions.dashboards || [];
  const expectedLists = definitions.lists || [];
  const expectedInstructions = definitions.instructions || [];
  const expectedReports = definitions.reports || [];

  // Récupérer les ressources réelles
  const actualResources = await getResourcesForInstance(instanceId, universId, agencyId);

  const corrections = {
    toKeep: { forms: [], dashboards: [], lists: [], instructions: [], reports: [] },
    toDelete: { forms: [], dashboards: [], lists: [], instructions: [], reports: [] },
    toCreate: { forms: [], dashboards: [], lists: [], instructions: [], reports: [] }
  };

  // Traiter les formulaires
  const matchedForms = [];
  for (const formDef of expectedForms) {
    const matchingForm = findMatchingResource(actualResources.forms, formDef.title || formDef.name);
    if (matchingForm) {
      matchedForms.push(matchingForm.id);
      corrections.toKeep.forms.push(matchingForm);
    } else {
      corrections.toCreate.forms.push(formDef);
    }
  }
  // Les formulaires non correspondants sont à supprimer
  actualResources.forms.forEach(form => {
    if (!matchedForms.includes(form.id)) {
      corrections.toDelete.forms.push(form);
    }
  });

  // Traiter les dashboards
  const matchedDashboards = [];
  for (const dashboardDef of expectedDashboards) {
    const matchingDashboard = findMatchingResource(actualResources.dashboards, dashboardDef.name || dashboardDef.title);
    if (matchingDashboard) {
      matchedDashboards.push(matchingDashboard.id);
      corrections.toKeep.dashboards.push(matchingDashboard);
    } else {
      corrections.toCreate.dashboards.push(dashboardDef);
    }
  }
  actualResources.dashboards.forEach(dashboard => {
    if (!matchedDashboards.includes(dashboard.id)) {
      corrections.toDelete.dashboards.push(dashboard);
    }
  });

  // Traiter les listes
  const matchedLists = [];
  for (const listDef of expectedLists) {
    const matchingList = findMatchingResource(actualResources.lists, listDef.name || listDef.title);
    if (matchingList) {
      matchedLists.push(matchingList.id);
      corrections.toKeep.lists.push(matchingList);
    } else {
      corrections.toCreate.lists.push(listDef);
    }
  }
  actualResources.lists.forEach(list => {
    if (!matchedLists.includes(list.id)) {
      corrections.toDelete.lists.push(list);
    }
  });

  // Traiter les instructions
  const matchedInstructions = [];
  for (const instructionDef of expectedInstructions) {
    const matchingInstruction = findMatchingResource(actualResources.instructions, instructionDef.question || instructionDef.text);
    if (matchingInstruction) {
      matchedInstructions.push(matchingInstruction.id);
      corrections.toKeep.instructions.push(matchingInstruction);
    } else {
      corrections.toCreate.instructions.push(instructionDef);
    }
  }
  actualResources.instructions.forEach(instruction => {
    if (!matchedInstructions.includes(instruction.id)) {
      corrections.toDelete.instructions.push(instruction);
    }
  });

  // Traiter les rapports
  const matchedReports = [];
  for (const reportDef of expectedReports) {
    const matchingReport = findMatchingResource(actualResources.reports, reportDef.name || reportDef.title);
    if (matchingReport) {
      matchedReports.push(matchingReport.id);
      corrections.toKeep.reports.push(matchingReport);
    } else {
      corrections.toCreate.reports.push(reportDef);
    }
  }
  actualResources.reports.forEach(report => {
    if (!matchedReports.includes(report.id)) {
      corrections.toDelete.reports.push(report);
    }
  });

  // Afficher les corrections
  const totalToDelete = corrections.toDelete.forms.length + corrections.toDelete.dashboards.length +
    corrections.toDelete.lists.length + corrections.toDelete.instructions.length + corrections.toDelete.reports.length;
  const totalToCreate = corrections.toCreate.forms.length + corrections.toCreate.dashboards.length +
    corrections.toCreate.lists.length + corrections.toCreate.instructions.length + corrections.toCreate.reports.length;

  if (totalToDelete > 0 || totalToCreate > 0) {
    console.log(`\n      🔧 Corrections nécessaires:`);
    
    if (corrections.toDelete.forms.length > 0) {
      console.log(`         ❌ ${corrections.toDelete.forms.length} formulaire(s) à supprimer:`);
      corrections.toDelete.forms.forEach(form => {
        console.log(`            - ${form.title} (${form.id})`);
      });
    }
    if (corrections.toDelete.dashboards.length > 0) {
      console.log(`         ❌ ${corrections.toDelete.dashboards.length} dashboard(s) à supprimer:`);
      corrections.toDelete.dashboards.forEach(dashboard => {
        console.log(`            - ${dashboard.name} (${dashboard.id})`);
      });
    }
    if (corrections.toDelete.lists.length > 0) {
      console.log(`         ❌ ${corrections.toDelete.lists.length} liste(s) à supprimer:`);
      corrections.toDelete.lists.forEach(list => {
        console.log(`            - ${list.name} (${list.id})`);
      });
    }
    if (corrections.toDelete.instructions.length > 0) {
      console.log(`         ❌ ${corrections.toDelete.instructions.length} instruction(s) à supprimer:`);
      corrections.toDelete.instructions.forEach(instruction => {
        console.log(`            - ${instruction.question.substring(0, 50)}... (${instruction.id})`);
      });
    }
    if (corrections.toDelete.reports.length > 0) {
      console.log(`         ❌ ${corrections.toDelete.reports.length} rapport(s) à supprimer:`);
      corrections.toDelete.reports.forEach(report => {
        console.log(`            - ${report.name} (${report.id})`);
      });
    }

    if (totalToCreate > 0) {
      console.log(`         ⚠️  ${totalToCreate} ressource(s) manquante(s) (nécessite une instanciation manuelle)`);
    }

    // Appliquer les corrections si --write
    if (write) {
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

      // Supprimer les formulaires
      for (const form of corrections.toDelete.forms) {
        const formRef = db.collection(FORMS_COLLECTION).doc(form.id);
        batch.delete(formRef);
        batchCount++;
        totalDeleted++;
        if (batchCount >= MAX_BATCH_SIZE) await commitBatch();
      }

      // Supprimer les dashboards
      for (const dashboard of corrections.toDelete.dashboards) {
        const dashboardRef = db.collection(DASHBOARDS_COLLECTION).doc(dashboard.id);
        batch.delete(dashboardRef);
        batchCount++;
        totalDeleted++;
        if (batchCount >= MAX_BATCH_SIZE) await commitBatch();
      }

      // Supprimer les listes
      for (const list of corrections.toDelete.lists) {
        const listRef = db.collection(LISTS_COLLECTION).doc(list.id);
        batch.delete(listRef);
        batchCount++;
        totalDeleted++;
        if (batchCount >= MAX_BATCH_SIZE) await commitBatch();
      }

      // Supprimer les instructions
      for (const instruction of corrections.toDelete.instructions) {
        const instructionRef = db.collection(INSTRUCTIONS_COLLECTION).doc(instruction.id);
        batch.delete(instructionRef);
        batchCount++;
        totalDeleted++;
        if (batchCount >= MAX_BATCH_SIZE) await commitBatch();
      }

      // Supprimer les rapports
      for (const report of corrections.toDelete.reports) {
        const reportRef = db.collection(REPORTS_COLLECTION).doc(report.id);
        batch.delete(reportRef);
        batchCount++;
        totalDeleted++;
        if (batchCount >= MAX_BATCH_SIZE) await commitBatch();
      }

      await commitBatch();

      // Mettre à jour l'instance avec les IDs des ressources à garder
      const instanceRef = db.collection(INSTANCES_COLLECTION).doc(instanceId);
      const updatedInstances = {
        forms: corrections.toKeep.forms.map(f => f.id),
        dashboards: corrections.toKeep.dashboards.map(d => d.id),
        lists: corrections.toKeep.lists.map(l => l.id),
        instructions: corrections.toKeep.instructions.map(i => i.id),
        reports: corrections.toKeep.reports.map(r => r.id)
      };
      batch.update(instanceRef, {
        instances: updatedInstances,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      await batch.commit();

      console.log(`         ✅ ${totalDeleted} ressource(s) supprimée(s) et instance mise à jour`);
    }
  } else {
    console.log(`         ✅ Aucune correction nécessaire`);
  }

  return corrections;
}

/**
 * Script principal
 */
async function main() {
  const write = process.argv.includes('--write');
  const userEmail = process.argv.find(arg => arg.startsWith('--user='))?.split('=')[1];

  console.log('🔧 Correction des incohérences entre ressources réelles et définitions du Univers');
  console.log(`   Mode: ${write ? 'CORRECTION' : 'DRY-RUN (simulation)'}`);
  if (userEmail) {
    console.log(`   Utilisateur: ${userEmail}`);
  }
  console.log('');

  try {
    // Récupérer tous les directeurs ou un utilisateur spécifique
    let usersQuery = db.collection(USERS_COLLECTION).where('role', '==', 'directeur');
    if (userEmail) {
      usersQuery = db.collection(USERS_COLLECTION)
        .where('role', '==', 'directeur')
        .where('email', '==', userEmail);
    }
    const usersSnapshot = await usersQuery.get();
    const users = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      data: doc.data()
    }));

    if (users.length === 0) {
      console.log('⚠️  Aucun utilisateur trouvé');
      return;
    }

    console.log(`📦 ${users.length} utilisateur(s) trouvé(s)\n`);

    // Pour chaque utilisateur
    for (const user of users) {
      const userId = user.id;
      const agencyId = user.data.agencyId;
      const email = user.data.email || user.data.emailAddress || 'N/A';

      console.log(`\n${'='.repeat(100)}`);
      console.log(`👤 UTILISATEUR: ${email}`);
      console.log(`${'='.repeat(100)}`);

      // Récupérer l'Univers actif
      const activeUniversDoc = await db.collection(ACTIVE_UNIVERS_COLLECTION).doc(userId).get();
      if (!activeUniversDoc.exists) {
        console.log(`   ⚠️  Aucun Univers actif trouvé`);
        continue;
      }

      const activeUnivers = activeUniversDoc.data();
      const universId = activeUnivers.activeUniversId;
      const instanceId = activeUnivers.activeInstanceId;

      if (!universId) {
        console.log(`   ⚠️  Aucun Univers actif`);
        continue;
      }

      if (!instanceId || instanceId === 'AUCUNE') {
        console.log(`   ⚠️  Aucune instance active (pas d'activation effectuée)`);
        continue;
      }

      // Récupérer le Univers
      const universDoc = await db.collection(UNIVERS_COLLECTION).doc(universId).get();
      if (!universDoc.exists) {
        console.log(`   ❌ Univers ${universId} non trouvé`);
        continue;
      }

      const universData = universDoc.data();
      const universName = universData.metadata?.name || universData.name || 'Sans nom';

      console.log(`   📚 UNIVERS: ${universName} (${universId})`);
      console.log(`   🔹 INSTANCE: ${instanceId}`);

      // Corriger les incohérences
      await fixInconsistenciesForInstance(instanceId, universId, agencyId, universData, write);
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


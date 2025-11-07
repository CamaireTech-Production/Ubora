/**
 * Script pour vérifier les doublons de formulaires et dashboards
 * 
 * Usage: node scripts/check-duplicates.js [directorId]
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

const FORMS_COLLECTION = 'forms';
const DASHBOARDS_COLLECTION = 'dashboards';
const LISTS_COLLECTION = 'lists';
const INSTRUCTIONS_COLLECTION = 'scheduledQuestions'; // Instructions sont stockées comme scheduledQuestions
const REPORTS_COLLECTION = 'reports';
const ACTIVE_UNIVERS_COLLECTION = 'activeUnivers';
const INSTANCES_COLLECTION = 'universInstances';
const USERS_COLLECTION = 'users';

/**
 * Vérifier les doublons pour un directeur
 */
async function checkDuplicates(directorId) {
  console.log(`\n${'═'.repeat(80)}`);
  console.log(`🔍 Vérification des doublons pour le directeur: ${directorId}`);
  console.log('');

  // 1. Récupérer l'ActiveUnivers
  const activeUniversDoc = await db.collection(ACTIVE_UNIVERS_COLLECTION).doc(directorId).get();
  if (!activeUniversDoc.exists) {
    console.log('   ❌ Aucun ActiveUnivers trouvé');
    return;
  }

  const activeUniversData = activeUniversDoc.data();
  const activeUniversId = activeUniversData.activeUniversId;
  const activeInstanceId = activeUniversData.activeInstanceId || null;
  const agencyId = activeUniversData.agencyId;

  console.log(`   📋 Univers actif: ${activeUniversId}`);
  console.log(`   📋 Instance active: ${activeInstanceId || 'AUCUNE'}`);
  console.log(`   📋 Agence: ${agencyId}`);
  console.log('');

  // 2. Récupérer TOUS les formulaires de l'agence avec ce universId
  const allFormsSnapshot = await db.collection(FORMS_COLLECTION)
    .where('agencyId', '==', agencyId)
    .where('universId', '==', activeUniversId)
    .get();

  console.log(`   📊 Total formulaires avec universId=${activeUniversId}: ${allFormsSnapshot.size}`);

  // Grouper par titre pour trouver les doublons
  const formsByTitle = new Map();
  const formsByInstance = new Map();

  for (const formDoc of allFormsSnapshot.docs) {
    const formData = formDoc.data();
    const title = formData.title || 'Sans titre';
    const instanceId = formData.universInstanceId || 'SANS_INSTANCE';

    // Grouper par titre
    if (!formsByTitle.has(title)) {
      formsByTitle.set(title, []);
    }
    formsByTitle.get(title).push({
      id: formDoc.id,
      title,
      instanceId,
      createdAt: formData.createdAt?.toDate?.() || formData.createdAt || 'N/A'
    });

    // Grouper par instance
    if (!formsByInstance.has(instanceId)) {
      formsByInstance.set(instanceId, []);
    }
    formsByInstance.get(instanceId).push({
      id: formDoc.id,
      title
    });
  }

  // Afficher les doublons par titre
  console.log('\n   📋 Formulaires groupés par TITRE:');
  let duplicateCount = 0;
  for (const [title, forms] of formsByTitle.entries()) {
    if (forms.length > 1) {
      duplicateCount += forms.length - 1;
      console.log(`   ⚠️  "${title}" - ${forms.length} doublon(s):`);
      forms.forEach(form => {
        console.log(`      - ID: ${form.id} | Instance: ${form.instanceId} | Créé: ${form.createdAt}`);
      });
    }
  }

  if (duplicateCount === 0) {
    console.log('   ✅ Aucun doublon trouvé par titre');
  } else {
    console.log(`   ❌ Total: ${duplicateCount} doublon(s) trouvé(s) par titre`);
  }

  // Afficher les formulaires groupés par instance
  console.log('\n   📋 Formulaires groupés par INSTANCE:');
  for (const [instanceId, forms] of formsByInstance.entries()) {
    const isActive = instanceId === activeInstanceId;
    console.log(`   ${isActive ? '✅' : '  '} Instance: ${instanceId} - ${forms.length} formulaire(s)`);
    if (forms.length <= 5) {
      forms.forEach(form => {
        console.log(`      - ${form.title} (${form.id})`);
      });
    } else {
      forms.slice(0, 3).forEach(form => {
        console.log(`      - ${form.title} (${form.id})`);
      });
      console.log(`      ... et ${forms.length - 3} autres`);
    }
  }

  // 3. Même chose pour les dashboards
  console.log('\n   📊 Dashboards:');
  const allDashboardsSnapshot = await db.collection(DASHBOARDS_COLLECTION)
    .where('agencyId', '==', agencyId)
    .where('universId', '==', activeUniversId)
    .get();

  console.log(`   📊 Total dashboards avec universId=${activeUniversId}: ${allDashboardsSnapshot.size}`);

  const dashboardsByTitle = new Map();
  const dashboardsByInstance = new Map();

  for (const dashboardDoc of allDashboardsSnapshot.docs) {
    const dashboardData = dashboardDoc.data();
    const name = dashboardData.name || 'Sans nom';
    const instanceId = dashboardData.universInstanceId || 'SANS_INSTANCE';

    // Grouper par nom
    if (!dashboardsByTitle.has(name)) {
      dashboardsByTitle.set(name, []);
    }
    dashboardsByTitle.get(name).push({
      id: dashboardDoc.id,
      name,
      instanceId
    });

    // Grouper par instance
    if (!dashboardsByInstance.has(instanceId)) {
      dashboardsByInstance.set(instanceId, []);
    }
    dashboardsByInstance.get(instanceId).push({
      id: dashboardDoc.id,
      name
    });
  }

  // Afficher les doublons de dashboards
  console.log('\n   📋 Dashboards groupés par NOM:');
  let duplicateDashboards = 0;
  for (const [name, dashboards] of dashboardsByTitle.entries()) {
    if (dashboards.length > 1) {
      duplicateDashboards += dashboards.length - 1;
      console.log(`   ⚠️  "${name}" - ${dashboards.length} doublon(s):`);
      dashboards.forEach(dashboard => {
        console.log(`      - ID: ${dashboard.id} | Instance: ${dashboard.instanceId}`);
      });
    }
  }

  if (duplicateDashboards === 0) {
    console.log('   ✅ Aucun doublon trouvé par nom');
  } else {
    console.log(`   ❌ Total: ${duplicateDashboards} doublon(s) trouvé(s) par nom`);
  }

  // Afficher les dashboards groupés par instance
  console.log('\n   📋 Dashboards groupés par INSTANCE:');
  for (const [instanceId, dashboards] of dashboardsByInstance.entries()) {
    const isActive = instanceId === activeInstanceId;
    console.log(`   ${isActive ? '✅' : '  '} Instance: ${instanceId} - ${dashboards.length} dashboard(s)`);
    if (dashboards.length <= 5) {
      dashboards.forEach(dashboard => {
        console.log(`      - ${dashboard.name} (${dashboard.id})`);
      });
    } else {
      dashboards.slice(0, 3).forEach(dashboard => {
        console.log(`      - ${dashboard.name} (${dashboard.id})`);
      });
      console.log(`      ... et ${dashboards.length - 3} autres`);
    }
  }

  // 4. Vérifier les LISTES
  console.log('\n   📊 LISTES:');
  const allListsSnapshot = await db.collection(LISTS_COLLECTION)
    .where('agencyId', '==', agencyId)
    .where('universId', '==', activeUniversId)
    .get();

  console.log(`   📊 Total listes avec universId=${activeUniversId}: ${allListsSnapshot.size}`);

  const listsByTitle = new Map();
  const listsByInstance = new Map();

  for (const listDoc of allListsSnapshot.docs) {
    const listData = listDoc.data();
    const name = listData.name || 'Sans nom';
    const instanceId = listData.universInstanceId || 'SANS_INSTANCE';

    if (!listsByTitle.has(name)) {
      listsByTitle.set(name, []);
    }
    listsByTitle.get(name).push({
      id: listDoc.id,
      name,
      instanceId
    });

    if (!listsByInstance.has(instanceId)) {
      listsByInstance.set(instanceId, []);
    }
    listsByInstance.get(instanceId).push({
      id: listDoc.id,
      name
    });
  }

  let duplicateLists = 0;
  for (const [name, lists] of listsByTitle.entries()) {
    if (lists.length > 1) {
      duplicateLists += lists.length - 1;
      console.log(`   ⚠️  "${name}" - ${lists.length} doublon(s):`);
      lists.forEach(list => {
        console.log(`      - ID: ${list.id} | Instance: ${list.instanceId}`);
      });
    }
  }

  if (duplicateLists === 0 && allListsSnapshot.size > 0) {
    console.log('   ✅ Aucun doublon trouvé par nom');
  } else if (allListsSnapshot.size === 0) {
    console.log('   ℹ️  Aucune liste trouvée');
  } else {
    console.log(`   ❌ Total: ${duplicateLists} doublon(s) trouvé(s) par nom`);
  }

  console.log('\n   📋 Listes groupées par INSTANCE:');
  for (const [instanceId, lists] of listsByInstance.entries()) {
    const isActive = instanceId === activeInstanceId;
    console.log(`   ${isActive ? '✅' : '  '} Instance: ${instanceId} - ${lists.length} liste(s)`);
    if (lists.length <= 5) {
      lists.forEach(list => {
        console.log(`      - ${list.name} (${list.id})`);
      });
    } else {
      lists.slice(0, 3).forEach(list => {
        console.log(`      - ${list.name} (${list.id})`);
      });
      console.log(`      ... et ${lists.length - 3} autres`);
    }
  }

  // 5. Vérifier les INSTRUCTIONS
  console.log('\n   📊 INSTRUCTIONS:');
  const allInstructionsSnapshot = await db.collection(INSTRUCTIONS_COLLECTION)
    .where('agencyId', '==', agencyId)
    .where('universId', '==', activeUniversId)
    .get();

  console.log(`   📊 Total instructions avec universId=${activeUniversId}: ${allInstructionsSnapshot.size}`);

  const instructionsByTitle = new Map();
  const instructionsByInstance = new Map();

  for (const instructionDoc of allInstructionsSnapshot.docs) {
    const instructionData = instructionDoc.data();
    const title = instructionData.title || instructionData.question || 'Sans titre';
    const instanceId = instructionData.universInstanceId || 'SANS_INSTANCE';

    if (!instructionsByTitle.has(title)) {
      instructionsByTitle.set(title, []);
    }
    instructionsByTitle.get(title).push({
      id: instructionDoc.id,
      title,
      instanceId
    });

    if (!instructionsByInstance.has(instanceId)) {
      instructionsByInstance.set(instanceId, []);
    }
    instructionsByInstance.get(instanceId).push({
      id: instructionDoc.id,
      title
    });
  }

  let duplicateInstructions = 0;
  for (const [title, instructions] of instructionsByTitle.entries()) {
    if (instructions.length > 1) {
      duplicateInstructions += instructions.length - 1;
      console.log(`   ⚠️  "${title}" - ${instructions.length} doublon(s):`);
      instructions.forEach(instruction => {
        console.log(`      - ID: ${instruction.id} | Instance: ${instruction.instanceId}`);
      });
    }
  }

  if (duplicateInstructions === 0 && allInstructionsSnapshot.size > 0) {
    console.log('   ✅ Aucun doublon trouvé par titre');
  } else if (allInstructionsSnapshot.size === 0) {
    console.log('   ℹ️  Aucune instruction trouvée');
  } else {
    console.log(`   ❌ Total: ${duplicateInstructions} doublon(s) trouvé(s) par titre`);
  }

  console.log('\n   📋 Instructions groupées par INSTANCE:');
  for (const [instanceId, instructions] of instructionsByInstance.entries()) {
    const isActive = instanceId === activeInstanceId;
    console.log(`   ${isActive ? '✅' : '  '} Instance: ${instanceId} - ${instructions.length} instruction(s)`);
    if (instructions.length <= 5) {
      instructions.forEach(instruction => {
        console.log(`      - ${instruction.title} (${instruction.id})`);
      });
    } else {
      instructions.slice(0, 3).forEach(instruction => {
        console.log(`      - ${instruction.title} (${instruction.id})`);
      });
      console.log(`      ... et ${instructions.length - 3} autres`);
    }
  }

  // 6. Vérifier les RAPPORTS
  console.log('\n   📊 RAPPORTS:');
  const allReportsSnapshot = await db.collection(REPORTS_COLLECTION)
    .where('agencyId', '==', agencyId)
    .where('universId', '==', activeUniversId)
    .get();

  console.log(`   📊 Total rapports avec universId=${activeUniversId}: ${allReportsSnapshot.size}`);

  const reportsByTitle = new Map();
  const reportsByInstance = new Map();

  for (const reportDoc of allReportsSnapshot.docs) {
    const reportData = reportDoc.data();
    const name = reportData.name || reportData.title || 'Sans nom';
    const instanceId = reportData.universInstanceId || 'SANS_INSTANCE';

    if (!reportsByTitle.has(name)) {
      reportsByTitle.set(name, []);
    }
    reportsByTitle.get(name).push({
      id: reportDoc.id,
      name,
      instanceId
    });

    if (!reportsByInstance.has(instanceId)) {
      reportsByInstance.set(instanceId, []);
    }
    reportsByInstance.get(instanceId).push({
      id: reportDoc.id,
      name
    });
  }

  let duplicateReports = 0;
  for (const [name, reports] of reportsByTitle.entries()) {
    if (reports.length > 1) {
      duplicateReports += reports.length - 1;
      console.log(`   ⚠️  "${name}" - ${reports.length} doublon(s):`);
      reports.forEach(report => {
        console.log(`      - ID: ${report.id} | Instance: ${report.instanceId}`);
      });
    }
  }

  if (duplicateReports === 0 && allReportsSnapshot.size > 0) {
    console.log('   ✅ Aucun doublon trouvé par nom');
  } else if (allReportsSnapshot.size === 0) {
    console.log('   ℹ️  Aucun rapport trouvé');
  } else {
    console.log(`   ❌ Total: ${duplicateReports} doublon(s) trouvé(s) par nom`);
  }

  console.log('\n   📋 Rapports groupés par INSTANCE:');
  for (const [instanceId, reports] of reportsByInstance.entries()) {
    const isActive = instanceId === activeInstanceId;
    console.log(`   ${isActive ? '✅' : '  '} Instance: ${instanceId} - ${reports.length} rapport(s)`);
    if (reports.length <= 5) {
      reports.forEach(report => {
        console.log(`      - ${report.name} (${report.id})`);
      });
    } else {
      reports.slice(0, 3).forEach(report => {
        console.log(`      - ${report.name} (${report.id})`);
      });
      console.log(`      ... et ${reports.length - 3} autres`);
    }
  }

  // 7. Résumé complet
  console.log('\n   📊 RÉSUMÉ COMPLET:');
  console.log(`   📋 Formulaires:`);
  console.log(`      - Total: ${allFormsSnapshot.size}`);
  console.log(`      - Avec instance active: ${formsByInstance.get(activeInstanceId)?.length || 0}`);
  console.log(`      - Doublons: ${duplicateCount}`);
  console.log(`   📋 Dashboards:`);
  console.log(`      - Total: ${allDashboardsSnapshot.size}`);
  console.log(`      - Avec instance active: ${dashboardsByInstance.get(activeInstanceId)?.length || 0}`);
  console.log(`      - Doublons: ${duplicateDashboards}`);
  console.log(`   📋 Listes:`);
  console.log(`      - Total: ${allListsSnapshot.size}`);
  console.log(`      - Avec instance active: ${listsByInstance.get(activeInstanceId)?.length || 0}`);
  console.log(`      - Doublons: ${duplicateLists}`);
  console.log(`   📋 Instructions:`);
  console.log(`      - Total: ${allInstructionsSnapshot.size}`);
  console.log(`      - Avec instance active: ${instructionsByInstance.get(activeInstanceId)?.length || 0}`);
  console.log(`      - Doublons: ${duplicateInstructions}`);
  console.log(`   📋 Rapports:`);
  console.log(`      - Total: ${allReportsSnapshot.size}`);
  console.log(`      - Avec instance active: ${reportsByInstance.get(activeInstanceId)?.length || 0}`);
  console.log(`      - Doublons: ${duplicateReports}`);
  console.log(`\n   📊 TOTAL DOUBLONS: ${duplicateCount + duplicateDashboards + duplicateLists + duplicateInstructions + duplicateReports}`);
}

/**
 * Fonction principale
 */
async function main() {
  const directorIdArg = process.argv[2];

  try {
    console.log('🔍 Vérification des doublons de formulaires et dashboards');
    console.log('='.repeat(80));

    if (directorIdArg) {
      // Vérifier un directeur spécifique
      const directorDoc = await db.collection(USERS_COLLECTION).doc(directorIdArg).get();
      if (!directorDoc.exists) {
        console.error(`❌ Directeur ${directorIdArg} non trouvé`);
        process.exit(1);
      }
      const directorData = directorDoc.data();
      console.log(`\n👤 Directeur: ${directorData.name || directorData.email || directorIdArg}`);
      await checkDuplicates(directorIdArg);
    } else {
      // Vérifier tous les directeurs avec une instance active
      const activeUniversSnapshot = await db.collection(ACTIVE_UNIVERS_COLLECTION).get();
      
      for (const activeDoc of activeUniversSnapshot.docs) {
        const directorId = activeDoc.id;
        const activeData = activeDoc.data();
        
        // Seulement ceux avec une instance active
        if (activeData.activeInstanceId) {
          const directorDoc = await db.collection(USERS_COLLECTION).doc(directorId).get();
          if (directorDoc.exists) {
            const directorData = directorDoc.data();
            console.log(`\n👤 Directeur: ${directorData.name || directorData.email || directorId}`);
            await checkDuplicates(directorId);
          }
        }
      }
    }

    console.log('\n✅ Vérification terminée');
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

main().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});


import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
let initialized = false;
try {
  const serviceAccountPath = join(__dirname, '../studio-gpnfx-firebase-adminsdk-fbsvc-49cf718bd7.json');
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  initialized = true;
} catch (e) {
  try {
    if (!admin.apps.length) admin.initializeApp();
    initialized = true;
  } catch (ee) {
    console.error('❌ Failed to initialize Firebase Admin SDK:', ee.message);
    process.exit(1);
  }
}

const db = admin.firestore();

/**
 * Compter les ressources réelles associées à un Univers
 */
async function countResourcesForUnivers(universId) {
  const counts = {
    forms: 0,
    dashboards: 0,
    instructions: 0,
    lists: 0,
    reports: 0,
    totalUsages: 0
  };

  try {
    // Compter les formulaires
    const formsSnapshot = await db.collection('forms')
      .where('universId', '==', universId)
      .get();
    counts.forms = formsSnapshot.size;

    // Compter les tableaux de bord
    const dashboardsSnapshot = await db.collection('dashboards')
      .where('universId', '==', universId)
      .get();
    counts.dashboards = dashboardsSnapshot.size;

    // Compter les instructions
    const instructionsSnapshot = await db.collection('scheduledQuestions')
      .where('universId', '==', universId)
      .get();
    counts.instructions = instructionsSnapshot.size;

    // Compter les listes
    const listsSnapshot = await db.collection('lists')
      .where('universId', '==', universId)
      .get();
    counts.lists = listsSnapshot.size;

    // Compter les rapports
    const reportsSnapshot = await db.collection('reports')
      .where('universId', '==', universId)
      .get();
    counts.reports = reportsSnapshot.size;

    // Compter les instances (pour totalUsages)
    const instancesSnapshot = await db.collection('universInstances')
      .where('universId', '==', universId)
      .get();
    counts.totalUsages = instancesSnapshot.size;

  } catch (error) {
    console.error(`❌ Erreur lors du comptage des ressources pour Univers ${universId}:`, error);
  }

  return counts;
}

/**
 * Récupérer les IDs réels des ressources pour créer des définitions
 */
async function getResourceIdsForUnivers(universId) {
  const resourceIds = {
    forms: [],
    dashboards: [],
    instructions: [],
    lists: [],
    reports: []
  };

  try {
    // Récupérer les IDs des formulaires
    const formsSnapshot = await db.collection('forms')
      .where('universId', '==', universId)
      .get();
    resourceIds.forms = formsSnapshot.docs.map(doc => doc.id);

    // Récupérer les IDs des tableaux de bord
    const dashboardsSnapshot = await db.collection('dashboards')
      .where('universId', '==', universId)
      .get();
    resourceIds.dashboards = dashboardsSnapshot.docs.map(doc => doc.id);

    // Récupérer les IDs des instructions
    const instructionsSnapshot = await db.collection('scheduledQuestions')
      .where('universId', '==', universId)
      .get();
    resourceIds.instructions = instructionsSnapshot.docs.map(doc => doc.id);

    // Récupérer les IDs des listes
    const listsSnapshot = await db.collection('lists')
      .where('universId', '==', universId)
      .get();
    resourceIds.lists = listsSnapshot.docs.map(doc => doc.id);

    // Récupérer les IDs des rapports
    const reportsSnapshot = await db.collection('reports')
      .where('universId', '==', universId)
      .get();
    resourceIds.reports = reportsSnapshot.docs.map(doc => doc.id);

  } catch (error) {
    console.error(`❌ Erreur lors de la récupération des IDs pour Univers ${universId}:`, error);
  }

  return resourceIds;
}

/**
 * Mettre à jour les compteurs d'un Univers avec les définitions basées sur les ressources réelles
 */
async function updateUniversCounts(universId, counts, write) {
  // Récupérer les IDs réels des ressources
  const resourceIds = await getResourceIdsForUnivers(universId);

  // Créer des définitions minimales basées sur les ressources réelles
  const updates = {
    'definitions.forms': resourceIds.forms.map(id => ({ id, title: 'Ressource migrée', placeholder: true })),
    'definitions.dashboards': resourceIds.dashboards.map(id => ({ id, name: 'Ressource migrée', placeholder: true })),
    'definitions.instructions': resourceIds.instructions.map(id => ({ id, title: 'Ressource migrée', placeholder: true })),
    'definitions.lists': resourceIds.lists.map(id => ({ id, title: 'Ressource migrée', placeholder: true })),
    'definitions.reports': resourceIds.reports.map(id => ({ id, title: 'Ressource migrée', placeholder: true })),
    'usage.totalUsages': counts.totalUsages
  };

  if (write) {
    const universRef = db.collection('univers').doc(universId);
    await universRef.update(updates);
    console.log(`   ✅ Univers ${universId} mis à jour`);
  } else {
    console.log(`   📊 Univers ${universId} serait mis à jour avec:`);
    console.log(`      - Formulaires: ${counts.forms} (${resourceIds.forms.length} IDs)`);
    console.log(`      - Tableaux de bord: ${counts.dashboards} (${resourceIds.dashboards.length} IDs)`);
    console.log(`      - Instructions: ${counts.instructions} (${resourceIds.instructions.length} IDs)`);
    console.log(`      - Listes: ${counts.lists} (${resourceIds.lists.length} IDs)`);
    console.log(`      - Rapports: ${counts.reports} (${resourceIds.reports.length} IDs)`);
    console.log(`      - Utilisations: ${counts.totalUsages}`);
  }
}

/**
 * Script principal
 */
async function main() {
  const write = process.argv.includes('--write');
  console.log(`🔧 Fix Univers counts (dry-run=${!write})`);
  console.log('');

  // Récupérer tous les Univers
  console.log('📋 Étape 1: Recherche des Univers...');
  const universSnapshot = await db.collection('univers').get();
  
  console.log(`   ✅ Trouvé ${universSnapshot.size} Univers(s)`);
  console.log('');

  const stats = {
    totalUnivers: universSnapshot.size,
    updated: 0,
    errors: []
  };

  // Pour chaque Univers, compter les ressources réelles et mettre à jour
  for (const universDoc of universSnapshot.docs) {
    const universId = universDoc.id;
    const universData = universDoc.data();
    const universName = universData.metadata?.name || universId;

    console.log(`\n🔍 Univers: ${universName} (${universId})`);

    try {
      // Compter les ressources réelles
      const counts = await countResourcesForUnivers(universId);
      
      console.log(`   📊 Compteurs actuels:`);
      console.log(`      - Formulaires: ${counts.forms}`);
      console.log(`      - Tableaux de bord: ${counts.dashboards}`);
      console.log(`      - Instructions: ${counts.instructions}`);
      console.log(`      - Listes: ${counts.lists}`);
      console.log(`      - Rapports: ${counts.reports}`);
      console.log(`      - Utilisations: ${counts.totalUsages}`);

      // Comparer avec les compteurs actuels
      const currentForms = (universData.definitions?.forms || []).length;
      const currentDashboards = (universData.definitions?.dashboards || []).length;
      const currentInstructions = (universData.definitions?.instructions || []).length;
      const currentLists = (universData.definitions?.lists || []).length;
      const currentReports = (universData.definitions?.reports || []).length;
      const currentUsages = universData.usage?.totalUsages || 0;

      const needsUpdate = 
        counts.forms !== currentForms ||
        counts.dashboards !== currentDashboards ||
        counts.instructions !== currentInstructions ||
        counts.lists !== currentLists ||
        counts.reports !== currentReports ||
        counts.totalUsages !== currentUsages;

      if (needsUpdate) {
        console.log(`   ⚠️  Compteurs incorrects, mise à jour nécessaire...`);
        await updateUniversCounts(universId, counts, write);
        stats.updated++;
      } else {
        console.log(`   ✅ Compteurs déjà à jour`);
      }

    } catch (error) {
      console.error(`   ❌ Erreur pour Univers ${universId}:`, error.message);
      stats.errors.push({
        universId,
        universName,
        error: error.message
      });
    }
  }

  // Résumé
  console.log('\n' + '='.repeat(60));
  console.log('📊 RÉSUMÉ');
  console.log('='.repeat(60));
  console.log(`Mode: ${write ? 'ÉCRITURE' : 'DRY-RUN (simulation)'}`);
  console.log('');
  console.log(`Univers traités: ${stats.totalUnivers}`);
  console.log(`  - Univers mis à jour: ${stats.updated}`);
  console.log('');

  if (stats.errors.length > 0) {
    console.log(`⚠️  Erreurs rencontrées: ${stats.errors.length}`);
    stats.errors.forEach((err, index) => {
      console.log(`   ${index + 1}. ${err.universName} (${err.universId}): ${err.error}`);
    });
    console.log('');
  }

  if (!write) {
    console.log('💡 Pour appliquer les corrections, exécutez:');
    console.log('   node scripts/fix-univers-counts.js --write');
    console.log('');
  } else {
    console.log('✅ Correction terminée avec succès!');
    console.log('');
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('❌ Erreur lors de la correction:', e);
    process.exit(1);
  });


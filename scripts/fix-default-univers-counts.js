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
 * Récupérer les ressources réelles avec leurs données complètes
 */
async function getRealResourcesForUnivers(universId) {
  const resources = {
    forms: [],
    dashboards: [],
    instructions: [],
    lists: [],
    reports: []
  };

  try {
    // Récupérer les formulaires
    const formsSnapshot = await db.collection('forms')
      .where('universId', '==', universId)
      .get();
    resources.forms = formsSnapshot.docs.map(doc => ({
      id: doc.id,
      title: doc.data().title || 'Formulaire sans titre',
      ...doc.data()
    }));

    // Récupérer les tableaux de bord
    const dashboardsSnapshot = await db.collection('dashboards')
      .where('universId', '==', universId)
      .get();
    resources.dashboards = dashboardsSnapshot.docs.map(doc => ({
      id: doc.id,
      title: doc.data().title || 'Tableau de bord sans titre',
      ...doc.data()
    }));

    // Récupérer les instructions
    const instructionsSnapshot = await db.collection('scheduledQuestions')
      .where('universId', '==', universId)
      .get();
    resources.instructions = instructionsSnapshot.docs.map(doc => ({
      id: doc.id,
      title: doc.data().title || doc.data().question || 'Instruction sans titre',
      ...doc.data()
    }));

    // Récupérer les listes
    const listsSnapshot = await db.collection('lists')
      .where('universId', '==', universId)
      .get();
    resources.lists = listsSnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name || 'Liste sans nom',
      ...doc.data()
    }));

    // Récupérer les rapports
    const reportsSnapshot = await db.collection('reports')
      .where('universId', '==', universId)
      .get();
    resources.reports = reportsSnapshot.docs.map(doc => ({
      id: doc.id,
      title: doc.data().title || 'Rapport sans titre',
      ...doc.data()
    }));

  } catch (error) {
    console.error(`❌ Erreur lors de la récupération des ressources pour Univers ${universId}:`, error);
  }

  return resources;
}

/**
 * Créer des définitions basées sur les ressources réelles
 */
function createDefinitionsFromResources(resources) {
  return {
    forms: resources.forms.map(form => ({
      id: form.id,
      title: form.title,
      description: form.description || '',
      fields: form.fields || []
    })),
    dashboards: resources.dashboards.map(dashboard => ({
      id: dashboard.id,
      title: dashboard.title,
      description: dashboard.description || '',
      metrics: dashboard.metrics || []
    })),
    instructions: resources.instructions.map(instruction => ({
      id: instruction.id,
      title: instruction.title || instruction.question,
      question: instruction.question || '',
      scheduledAt: instruction.scheduledAt || null
    })),
    lists: resources.lists.map(list => ({
      id: list.id,
      name: list.name,
      description: list.description || '',
      items: list.items || []
    })),
    reports: resources.reports.map(report => ({
      id: report.id,
      title: report.title,
      description: report.description || '',
      mappings: report.mappings || {}
    }))
  };
}

/**
 * Script principal
 */
async function main() {
  const write = process.argv.includes('--write');
  console.log(`🔧 FIX UNIVERS PAR DÉFAUT - COMPTEURS (dry-run=${!write})`);
  console.log('='.repeat(80));
  console.log('');

  // Récupérer tous les Univers par défaut
  console.log('📋 Étape 1: Recherche des Univers par défaut...');
  const defaultUniversSnapshot = await db.collection('univers')
    .where('metadata.isDefault', '==', true)
    .get();
  
  console.log(`   ✅ Trouvé ${defaultUniversSnapshot.size} Univers par défaut\n`);

  const stats = {
    total: defaultUniversSnapshot.size,
    updated: 0,
    errors: []
  };

  // Pour chaque Univers par défaut
  for (const universDoc of defaultUniversSnapshot.docs) {
    const universId = universDoc.id;
    const universData = universDoc.data();
    const metadata = universData.metadata || {};
    const universName = metadata.name || 'Sans nom';

    console.log(`\n🔍 Univers: ${universName} (${universId})`);
    console.log('-'.repeat(80));

    try {
      // 1. Récupérer les ressources réelles
      console.log('   📊 Récupération des ressources réelles...');
      const realResources = await getRealResourcesForUnivers(universId);
      
      const realCounts = {
        forms: realResources.forms.length,
        dashboards: realResources.dashboards.length,
        instructions: realResources.instructions.length,
        lists: realResources.lists.length,
        reports: realResources.reports.length
      };

      console.log(`   ✅ Ressources réelles trouvées:`);
      console.log(`      - Formulaires: ${realCounts.forms}`);
      console.log(`      - Tableaux de bord: ${realCounts.dashboards}`);
      console.log(`      - Instructions: ${realCounts.instructions}`);
      console.log(`      - Listes: ${realCounts.lists}`);
      console.log(`      - Rapports: ${realCounts.reports}`);

      // 2. Vérifier les compteurs actuels dans definitions
      const currentDefinitions = universData.definitions || {};
      const currentCounts = {
        forms: Array.isArray(currentDefinitions.forms) ? currentDefinitions.forms.length : 0,
        dashboards: Array.isArray(currentDefinitions.dashboards) ? currentDefinitions.dashboards.length : 0,
        instructions: Array.isArray(currentDefinitions.instructions) ? currentDefinitions.instructions.length : 0,
        lists: Array.isArray(currentDefinitions.lists) ? currentDefinitions.lists.length : 0,
        reports: Array.isArray(currentDefinitions.reports) ? currentDefinitions.reports.length : 0
      };

      console.log(`\n   📊 Compteurs actuels dans definitions:`);
      console.log(`      - Formulaires: ${currentCounts.forms}`);
      console.log(`      - Tableaux de bord: ${currentCounts.dashboards}`);
      console.log(`      - Instructions: ${currentCounts.instructions}`);
      console.log(`      - Listes: ${currentCounts.lists}`);
      console.log(`      - Rapports: ${currentCounts.reports}`);

      // 3. Comparer
      const needsUpdate = 
        realCounts.forms !== currentCounts.forms ||
        realCounts.dashboards !== currentCounts.dashboards ||
        realCounts.instructions !== currentCounts.instructions ||
        realCounts.lists !== currentCounts.lists ||
        realCounts.reports !== currentCounts.reports;

      if (needsUpdate) {
        console.log(`\n   ⚠️  PROBLÈME DÉTECTÉ: Les compteurs ne correspondent pas!`);
        console.log(`   🔧 Création des définitions basées sur les ressources réelles...`);

        // Créer les nouvelles définitions
        const newDefinitions = createDefinitionsFromResources(realResources);

        if (write) {
          // Mettre à jour le Univers
          const universRef = db.collection('univers').doc(universId);
          await universRef.update({
            'definitions.forms': newDefinitions.forms,
            'definitions.dashboards': newDefinitions.dashboards,
            'definitions.instructions': newDefinitions.instructions,
            'definitions.lists': newDefinitions.lists,
            'definitions.reports': newDefinitions.reports
          });

          console.log(`   ✅ Univers mis à jour avec succès!`);
          console.log(`      - ${newDefinitions.forms.length} formulaire(s) dans definitions`);
          console.log(`      - ${newDefinitions.dashboards.length} tableau(x) de bord dans definitions`);
          console.log(`      - ${newDefinitions.instructions.length} instruction(s) dans definitions`);
          console.log(`      - ${newDefinitions.lists.length} liste(s) dans definitions`);
          console.log(`      - ${newDefinitions.reports.length} rapport(s) dans definitions`);
          
          stats.updated++;
        } else {
          console.log(`   📝 (DRY-RUN) Serait mis à jour avec:`);
          console.log(`      - ${newDefinitions.forms.length} formulaire(s)`);
          console.log(`      - ${newDefinitions.dashboards.length} tableau(x) de bord`);
          console.log(`      - ${newDefinitions.instructions.length} instruction(s)`);
          console.log(`      - ${newDefinitions.lists.length} liste(s)`);
          console.log(`      - ${newDefinitions.reports.length} rapport(s)`);
        }
      } else {
        console.log(`\n   ✅ Les compteurs correspondent correctement, pas de mise à jour nécessaire`);
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
  console.log('\n' + '='.repeat(80));
  console.log('📊 RÉSUMÉ');
  console.log('='.repeat(80));
  console.log(`Mode: ${write ? 'ÉCRITURE' : 'DRY-RUN (simulation)'}`);
  console.log('');
  console.log(`Univers par défaut traités: ${stats.total}`);
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
    console.log('   node scripts/fix-default-univers-counts.js --write');
    console.log('');
  } else {
    console.log('✅ Correction terminée avec succès!');
    console.log('');
    console.log('🔄 Rafraîchissez votre page pour voir les nouveaux compteurs.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('❌ Erreur lors de la correction:', e);
    process.exit(1);
  });


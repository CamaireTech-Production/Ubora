/**
 * Script pour corriger les ressources orphelines
 * Ajoute les ressources orphelines (qui existent dans les collections mais pas dans l'instance) à l'instance
 * 
 * Usage: node scripts/fix-orphan-resources.js [--write]
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

const ACTIVE_UNIVERS_COLLECTION = 'activeUnivers';
const INSTANCES_COLLECTION = 'universInstances';
const FORMS_COLLECTION = 'forms';
const DASHBOARDS_COLLECTION = 'dashboards';
const LISTS_COLLECTION = 'lists';
const INSTRUCTIONS_COLLECTION = 'scheduledQuestions';
const REPORTS_COLLECTION = 'reports';

async function findAllResourcesInCollections(instanceId, universId, agencyId) {
  const allResources = {
    forms: [],
    dashboards: [],
    lists: [],
    instructions: [],
    reports: []
  };

  try {
    const formsSnapshot = await db.collection(FORMS_COLLECTION)
      .where('agencyId', '==', agencyId)
      .where('universId', '==', universId)
      .where('universInstanceId', '==', instanceId)
      .get();
    allResources.forms = formsSnapshot.docs.map(doc => doc.id);
  } catch (error) {
    console.warn(`      ⚠️ Erreur lors de la recherche des formulaires: ${error.message}`);
  }

  try {
    const dashboardsSnapshot = await db.collection(DASHBOARDS_COLLECTION)
      .where('agencyId', '==', agencyId)
      .where('universId', '==', universId)
      .where('universInstanceId', '==', instanceId)
      .get();
    allResources.dashboards = dashboardsSnapshot.docs.map(doc => doc.id);
  } catch (error) {
    console.warn(`      ⚠️ Erreur lors de la recherche des dashboards: ${error.message}`);
  }

  try {
    const listsSnapshot = await db.collection(LISTS_COLLECTION)
      .where('agencyId', '==', agencyId)
      .where('universId', '==', universId)
      .where('universInstanceId', '==', instanceId)
      .get();
    allResources.lists = listsSnapshot.docs.map(doc => doc.id);
  } catch (error) {
    console.warn(`      ⚠️ Erreur lors de la recherche des listes: ${error.message}`);
  }

  try {
    const instructionsSnapshot = await db.collection(INSTRUCTIONS_COLLECTION)
      .where('agencyId', '==', agencyId)
      .where('universId', '==', universId)
      .where('universInstanceId', '==', instanceId)
      .get();
    allResources.instructions = instructionsSnapshot.docs.map(doc => doc.id);
  } catch (error) {
    console.warn(`      ⚠️ Erreur lors de la recherche des instructions: ${error.message}`);
  }

  try {
    const reportsSnapshot = await db.collection(REPORTS_COLLECTION)
      .where('agencyId', '==', agencyId)
      .where('universId', '==', universId)
      .where('universInstanceId', '==', instanceId)
      .get();
    allResources.reports = reportsSnapshot.docs.map(doc => doc.id);
  } catch (error) {
    console.warn(`      ⚠️ Erreur lors de la recherche des rapports: ${error.message}`);
  }

  return allResources;
}

async function fixOrphanResources(instanceId, universId, agencyId, write = false) {
  const instanceRef = db.collection(INSTANCES_COLLECTION).doc(instanceId);
  const instanceDoc = await instanceRef.get();
  
  if (!instanceDoc.exists) {
    console.log(`      ❌ Instance ${instanceId} n'existe pas !`);
    return { fixed: 0 };
  }
  
  const instanceData = instanceDoc.data();
  const instances = instanceData.instances || {};
  
  // Trouver toutes les ressources dans les collections
  const allResources = await findAllResourcesInCollections(instanceId, universId, agencyId);
  
  // Identifier les ressources orphelines
  const listedFormIds = new Set(instances.forms || []);
  const listedDashboardIds = new Set(instances.dashboards || []);
  const listedListIds = new Set(instances.lists || []);
  const listedInstructionIds = new Set(instances.instructions || []);
  const listedReportIds = new Set(instances.reports || []);
  
  const orphanForms = allResources.forms.filter(id => !listedFormIds.has(id));
  const orphanDashboards = allResources.dashboards.filter(id => !listedDashboardIds.has(id));
  const orphanLists = allResources.lists.filter(id => !listedListIds.has(id));
  const orphanInstructions = allResources.instructions.filter(id => !listedInstructionIds.has(id));
  const orphanReports = allResources.reports.filter(id => !listedReportIds.has(id));
  
  const totalOrphans = orphanForms.length + orphanDashboards.length + orphanLists.length + orphanInstructions.length + orphanReports.length;
  
  if (totalOrphans === 0) {
    console.log(`      ✅ Aucune ressource orpheline pour cette instance`);
    return { fixed: 0 };
  }
  
  console.log(`      ⚠️ ${totalOrphans} ressource(s) orpheline(s) détectée(s):`);
  console.log(`         - Formulaires: ${orphanForms.length}`);
  console.log(`         - Dashboards: ${orphanDashboards.length}`);
  console.log(`         - Listes: ${orphanLists.length}`);
  console.log(`         - Instructions: ${orphanInstructions.length}`);
  console.log(`         - Rapports: ${orphanReports.length}`);
  
  if (!write) {
    console.log(`      ⚠️ Mode dry-run: les ressources orphelines ne seront pas ajoutées à l'instance`);
    return { fixed: 0, wouldFix: totalOrphans };
  }
  
  // Mettre à jour l'instance pour ajouter les ressources orphelines
  const updatedInstances = {
    forms: Array.from(new Set([...(instances.forms || []), ...orphanForms])),
    dashboards: Array.from(new Set([...(instances.dashboards || []), ...orphanDashboards])),
    lists: Array.from(new Set([...(instances.lists || []), ...orphanLists])),
    instructions: Array.from(new Set([...(instances.instructions || []), ...orphanInstructions])),
    reports: Array.from(new Set([...(instances.reports || []), ...orphanReports]))
  };
  
  await instanceRef.update({
    instances: updatedInstances,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  console.log(`      ✅ Instance mise à jour avec ${totalOrphans} ressource(s) orpheline(s)`);
  
  return { fixed: totalOrphans };
}

async function main() {
  const write = process.argv.includes('--write');
  
  console.log('🔍 Correction des ressources orphelines pour tous les Univers actifs');
  console.log(`   Mode: ${write ? 'CORRECTION' : 'DRY-RUN (simulation)'}`);
  console.log('');

  try {
    // Récupérer tous les ActiveUnivers
    const activeUniversSnapshot = await db.collection(ACTIVE_UNIVERS_COLLECTION).get();
    
    let totalFixed = 0;
    let totalWouldFix = 0;
    let instancesProcessed = 0;

    for (const activeUniversDoc of activeUniversSnapshot.docs) {
      const activeUnivers = activeUniversDoc.data();
      const directorId = activeUnivers.directorId;
      const agencyId = activeUnivers.agencyId;
      const universId = activeUnivers.activeUniversId;
      const activeInstanceId = activeUnivers.activeInstanceId;

      if (!activeInstanceId || activeInstanceId === 'AUCUNE') {
        continue;
      }

      console.log(`\n${'='.repeat(80)}`);
      console.log(`👤 Directeur: ${directorId}, Agence: ${agencyId}`);
      console.log(`📦 Instance active: ${activeInstanceId}`);
      console.log(`📦 Univers: ${universId}`);

      const result = await fixOrphanResources(activeInstanceId, universId, agencyId, write);
      
      if (result.fixed) {
        totalFixed += result.fixed;
      }
      if (result.wouldFix) {
        totalWouldFix += result.wouldFix;
      }
      
      instancesProcessed++;
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 RÉSUMÉ`);
    console.log(`${'='.repeat(80)}`);
    console.log(`   Instances traitées: ${instancesProcessed}`);
    
    if (write) {
      console.log(`   Ressources orphelines corrigées: ${totalFixed}`);
    } else {
      console.log(`   Ressources orphelines qui seraient corrigées: ${totalWouldFix}`);
      console.log(`   Exécutez avec --write pour corriger réellement`);
    }

    if (totalFixed === 0 && totalWouldFix === 0) {
      console.log(`\n✅ Aucune ressource orpheline trouvée !`);
    } else if (write) {
      console.log(`\n✅ ${totalFixed} ressource(s) orpheline(s) corrigée(s) avec succès !`);
    } else {
      console.log(`\n⚠️  ${totalWouldFix} ressource(s) orpheline(s) seraient corrigées en mode --write`);
    }

  } catch (error) {
    console.error('\n❌ Erreur lors de l\'exécution du script:', error);
    process.exit(1);
  }
}

main().then(() => {
  console.log('\n✅ Script terminé');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Erreur fatale:', error);
  process.exit(1);
});


/**
 * Script pour supprimer les instances orphelines (sans ressources alors qu'elles devraient en avoir)
 * 
 * Une instance est considérée comme orpheline si :
 * 1. Le Univers a des définitions (formulaires, dashboards, etc.)
 * 2. L'instance n'a aucune ressource créée (ou très peu par rapport aux définitions)
 * 3. L'instance est INACTIVE (pour éviter de supprimer une instance active)
 * 
 * Usage: node scripts/remove-orphan-instances.js [--write]
 *   - Sans --write : mode dry-run (affiche seulement ce qui serait supprimé)
 *   - Avec --write : supprime les instances orphelines
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

/**
 * Récupérer toutes les ressources pour une instance
 */
async function getResourcesForInstance(instanceId, universId, agencyId) {
  const resources = {
    forms: 0,
    dashboards: 0,
    lists: 0,
    instructions: 0,
    reports: 0
  };

  try {
    // Forms
    const formsQuery = db.collection(FORMS_COLLECTION)
      .where('agencyId', '==', agencyId)
      .where('universId', '==', universId)
      .where('universInstanceId', '==', instanceId);
    const formsSnapshot = await formsQuery.get();
    resources.forms = formsSnapshot.size;

    // Dashboards
    const dashboardsQuery = db.collection(DASHBOARDS_COLLECTION)
      .where('agencyId', '==', agencyId)
      .where('universId', '==', universId)
      .where('universInstanceId', '==', instanceId);
    const dashboardsSnapshot = await dashboardsQuery.get();
    resources.dashboards = dashboardsSnapshot.size;

    // Lists
    const listsQuery = db.collection(LISTS_COLLECTION)
      .where('agencyId', '==', agencyId)
      .where('universId', '==', universId)
      .where('universInstanceId', '==', instanceId);
    const listsSnapshot = await listsQuery.get();
    resources.lists = listsSnapshot.size;

    // Instructions
    const instructionsQuery = db.collection(INSTRUCTIONS_COLLECTION)
      .where('agencyId', '==', agencyId)
      .where('universId', '==', universId)
      .where('universInstanceId', '==', instanceId);
    const instructionsSnapshot = await instructionsQuery.get();
    resources.instructions = instructionsSnapshot.size;

    // Reports
    const reportsQuery = db.collection(REPORTS_COLLECTION)
      .where('agencyId', '==', agencyId)
      .where('universId', '==', universId)
      .where('universInstanceId', '==', instanceId);
    const reportsSnapshot = await reportsQuery.get();
    resources.reports = reportsSnapshot.size;
  } catch (error) {
    console.warn(`⚠️  Erreur lors de la récupération des ressources pour l'instance ${instanceId}:`, error.message);
  }

  return resources;
}

/**
 * Récupérer les définitions d'un Univers
 */
function getUniversDefinitions(univers) {
  const definitions = univers.definitions || {};
  return {
    forms: (definitions.forms || []).length,
    dashboards: (definitions.dashboards || []).length,
    lists: (definitions.lists || []).length,
    instructions: (definitions.instructions || []).length,
    reports: (definitions.reports || []).length
  };
}

/**
 * Calculer le total de ressources attendues et réelles
 */
function calculateResourceTotals(expected, actual) {
  const expectedTotal = expected.forms + expected.dashboards + expected.lists + 
                        expected.instructions + expected.reports;
  const actualTotal = actual.forms + actual.dashboards + actual.lists + 
                      actual.instructions + actual.reports;
  
  return { expectedTotal, actualTotal };
}

/**
 * Vérifier si une instance est orpheline
 */
function isOrphanInstance(expected, actual, isActive) {
  // Ne pas supprimer les instances actives
  if (isActive) {
    return false;
  }

  const { expectedTotal, actualTotal } = calculateResourceTotals(expected, actual);

  // Si le Univers n'a pas de définitions, ce n'est pas une instance orpheline
  if (expectedTotal === 0) {
    return false;
  }

  // Si l'instance a moins de 20% des ressources attendues, elle est considérée comme orpheline
  // (permet de tolérer quelques ressources manquantes mais pas une instance vide)
  const percentage = expectedTotal > 0 ? (actualTotal / expectedTotal) * 100 : 0;
  
  return percentage < 20;
}

/**
 * Récupérer l'email d'un utilisateur
 */
async function getUserEmail(userId) {
  try {
    const userDoc = await db.collection(USERS_COLLECTION).doc(userId).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      return userData.email || userData.emailAddress || 'N/A';
    }
    return 'N/A';
  } catch (error) {
    return 'N/A';
  }
}

/**
 * Script principal
 */
async function main() {
  const write = process.argv.includes('--write');

  console.log('🔍 Identification et suppression des instances orphelines');
  console.log(`   Mode: ${write ? 'SUPPRESSION' : 'DRY-RUN (simulation)'}`);
  console.log('');

  try {
    // Récupérer tous les directeurs
    const usersQuery = db.collection(USERS_COLLECTION).where('role', '==', 'directeur');
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

    const orphanInstances = [];

    // Pour chaque utilisateur
    for (const user of users) {
      const userId = user.id;
      const agencyId = user.data.agencyId;
      const email = await getUserEmail(userId);

      // Récupérer toutes les instances de l'utilisateur
      const instancesQuery = db.collection(INSTANCES_COLLECTION)
        .where('userId', '==', userId)
        .where('agencyId', '==', agencyId);
      const instancesSnapshot = await instancesQuery.get();

      if (instancesSnapshot.empty) {
        continue;
      }

      // Pour chaque instance
      for (const instanceDoc of instancesSnapshot.docs) {
        const instanceId = instanceDoc.id;
        const instanceData = instanceDoc.data();
        const universId = instanceData.universId;
        const isActive = instanceData.isActive || false;

        if (!universId) {
          continue;
        }

        // Récupérer le Univers
        const universDoc = await db.collection(UNIVERS_COLLECTION).doc(universId).get();
        if (!universDoc.exists) {
          console.warn(`⚠️  Univers ${universId} non trouvé pour l'instance ${instanceId}`);
          continue;
        }

        const universData = universDoc.data();
        const universName = universData.metadata?.name || universData.name || 'Sans nom';

        // Récupérer les définitions attendues
        const expected = getUniversDefinitions(universData);

        // Récupérer les ressources réelles
        const actual = await getResourcesForInstance(instanceId, universId, agencyId);

        // Vérifier si l'instance est orpheline
        if (isOrphanInstance(expected, actual, isActive)) {
          const { expectedTotal, actualTotal } = calculateResourceTotals(expected, actual);
          const percentage = expectedTotal > 0 ? ((actualTotal / expectedTotal) * 100).toFixed(1) : 0;

          orphanInstances.push({
            instanceId,
            userId,
            email,
            agencyId,
            universId,
            universName,
            instanceVersion: instanceData.universVersion || instanceData.metadata?.universVersion || 1,
            isActive,
            expected,
            actual,
            expectedTotal,
            actualTotal,
            percentage,
            createdAt: instanceData.createdAt?.toDate?.() || null
          });
        }
      }
    }

    // Afficher les instances orphelines
    if (orphanInstances.length === 0) {
      console.log('✅ Aucune instance orpheline trouvée');
      return;
    }

    console.log(`\n${'='.repeat(100)}`);
    console.log(`📊 INSTANCES ORPHELINES DÉTECTÉES: ${orphanInstances.length}`);
    console.log(`${'='.repeat(100)}\n`);

    for (const orphan of orphanInstances) {
      console.log(`🔴 INSTANCE ORPHELINE: ${orphan.instanceId}`);
      console.log(`   Utilisateur: ${orphan.email} (${orphan.userId})`);
      console.log(`   Univers: ${orphan.universName} (${orphan.universId})`);
      console.log(`   Version: v${orphan.instanceVersion}`);
      console.log(`   Statut: ${orphan.isActive ? '✅ ACTIVE' : '❌ INACTIVE'}`);
      if (orphan.createdAt) {
        console.log(`   Créée le: ${orphan.createdAt.toLocaleString('fr-FR')}`);
      }
      console.log(`\n   📋 RESSOURCES ATTENDUES:`);
      console.log(`      - Formulaires: ${orphan.expected.forms}`);
      console.log(`      - Dashboards: ${orphan.expected.dashboards}`);
      console.log(`      - Listes: ${orphan.expected.lists}`);
      console.log(`      - Instructions: ${orphan.expected.instructions}`);
      console.log(`      - Rapports: ${orphan.expected.reports}`);
      console.log(`      Total attendu: ${orphan.expectedTotal}`);
      console.log(`\n   📊 RESSOURCES RÉELLES:`);
      console.log(`      - Formulaires: ${orphan.actual.forms}`);
      console.log(`      - Dashboards: ${orphan.actual.dashboards}`);
      console.log(`      - Listes: ${orphan.actual.lists}`);
      console.log(`      - Instructions: ${orphan.actual.instructions}`);
      console.log(`      - Rapports: ${orphan.actual.reports}`);
      console.log(`      Total réel: ${orphan.actualTotal} (${orphan.percentage}% des ressources attendues)`);
      console.log(`\n   ${'─'.repeat(98)}\n`);
    }

    // Supprimer les instances si --write
    if (!write) {
      console.log(`\n⚠️  Mode dry-run: ${orphanInstances.length} instance(s) seraient supprimée(s)`);
      console.log(`   Exécutez avec --write pour supprimer ces instances`);
      return;
    }

    console.log(`\n${'='.repeat(100)}`);
    console.log(`🗑️  SUPPRESSION DES INSTANCES ORPHELINES`);
    console.log(`${'='.repeat(100)}\n`);

    let deletedCount = 0;
    let errorCount = 0;

    for (const orphan of orphanInstances) {
      try {
        // Vérifier si l'instance est référencée dans ActiveUnivers
        const activeUniversDoc = await db.collection(ACTIVE_UNIVERS_COLLECTION).doc(orphan.userId).get();
        let needsActiveUniversUpdate = false;
        
        if (activeUniversDoc.exists) {
          const activeUniversData = activeUniversDoc.data();
          if (activeUniversData.activeInstanceId === orphan.instanceId) {
            needsActiveUniversUpdate = true;
            console.log(`   ⚠️  Instance ${orphan.instanceId} est référencée dans ActiveUnivers, mise à jour nécessaire...`);
          }
        }

        // Supprimer l'instance
        await db.collection(INSTANCES_COLLECTION).doc(orphan.instanceId).delete();
        deletedCount++;

        console.log(`   ✅ Instance ${orphan.instanceId} supprimée (${orphan.email} - ${orphan.universName})`);

        // Mettre à jour ActiveUnivers si nécessaire
        if (needsActiveUniversUpdate) {
          const activeUniversRef = db.collection(ACTIVE_UNIVERS_COLLECTION).doc(orphan.userId);
          await activeUniversRef.update({
            activeInstanceId: null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log(`   ✅ ActiveUnivers mis à jour pour ${orphan.email}`);
        }
      } catch (error) {
        errorCount++;
        console.error(`   ❌ Erreur lors de la suppression de l'instance ${orphan.instanceId}:`, error.message);
      }
    }

    console.log(`\n${'='.repeat(100)}`);
    console.log(`📊 RÉSUMÉ`);
    console.log(`${'='.repeat(100)}`);
    console.log(`   Instances orphelines détectées: ${orphanInstances.length}`);
    console.log(`   Instances supprimées: ${deletedCount}`);
    if (errorCount > 0) {
      console.log(`   Erreurs: ${errorCount}`);
    }
    console.log('');

  } catch (error) {
    console.error('\n❌ Erreur lors de l\'exécution du script:', error);
    process.exit(1);
  }
}

// Exécuter le script
main().then(() => {
  console.log('✅ Script terminé');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Erreur fatale:', error);
  process.exit(1);
});


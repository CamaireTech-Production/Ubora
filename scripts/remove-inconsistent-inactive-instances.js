/**
 * Script pour supprimer les instances incohérentes et inactives
 * 
 * Une instance est considérée comme incohérente si :
 * 1. Le Univers a des définitions
 * 2. L'instance a des ressources mais avec des incohérences significatives (ressources en trop ou manquantes)
 * 3. L'instance est INACTIVE (pour éviter de supprimer une instance active)
 * 
 * Usage: node scripts/remove-inconsistent-inactive-instances.js [--write]
 *   - Sans --write : mode dry-run (affiche seulement ce qui serait supprimé)
 *   - Avec --write : supprime les instances incohérentes
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
 * Vérifier si une instance est incohérente
 */
function isInconsistentInstance(expected, actual, isActive) {
  // Ne pas supprimer les instances actives
  if (isActive) {
    return false;
  }

  // Vérifier les incohérences par type de ressource
  const inconsistencies = [];
  let hasSignificantInconsistency = false;
  
  // Formulaires : tolérance de ±1
  if (Math.abs(actual.forms - expected.forms) > 1) {
    inconsistencies.push(`Formulaires: ${actual.forms} trouvé(s) au lieu de ${expected.forms}`);
  }
  
  // Dashboards : tolérance de ±1
  if (Math.abs(actual.dashboards - expected.dashboards) > 1) {
    inconsistencies.push(`Dashboards: ${actual.dashboards} trouvé(s) au lieu de ${expected.dashboards}`);
  }
  
  // Listes : tolérance de ±1, mais si manque plus de 2 listes, c'est une incohérence significative
  const listsDiff = Math.abs(actual.lists - expected.lists);
  if (listsDiff > 1) {
    inconsistencies.push(`Listes: ${actual.lists} trouvée(s) au lieu de ${expected.lists}`);
    // Si manque plus de 2 listes, c'est une incohérence significative
    if (listsDiff > 2) {
      hasSignificantInconsistency = true;
    }
  }
  
  // Instructions : tolérance de ±1
  if (Math.abs(actual.instructions - expected.instructions) > 1) {
    inconsistencies.push(`Instructions: ${actual.instructions} trouvée(s) au lieu de ${expected.instructions}`);
  }
  
  // Rapports : tolérance de ±1
  if (Math.abs(actual.reports - expected.reports) > 1) {
    inconsistencies.push(`Rapports: ${actual.reports} trouvé(s) au lieu de ${expected.reports}`);
  }

  // Si au moins 2 types de ressources sont incohérents OU une incohérence significative (ex: 1 liste au lieu de 5)
  return inconsistencies.length >= 2 || hasSignificantInconsistency;
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

  console.log('🔍 Identification et suppression des instances incohérentes et inactives');
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

    const inconsistentInstances = [];

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
          continue;
        }

        const universData = universDoc.data();
        const universName = universData.metadata?.name || universData.name || 'Sans nom';

        // Récupérer les définitions attendues
        const expected = getUniversDefinitions(universData);

        // Récupérer les ressources réelles
        const actual = await getResourcesForInstance(instanceId, universId, agencyId);

        // Vérifier si l'instance est incohérente
        if (isInconsistentInstance(expected, actual, isActive)) {
          inconsistentInstances.push({
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
            createdAt: instanceData.createdAt?.toDate?.() || null
          });
        }
      }
    }

    // Afficher les instances incohérentes
    if (inconsistentInstances.length === 0) {
      console.log('✅ Aucune instance incohérente trouvée');
      return;
    }

    console.log(`\n${'='.repeat(100)}`);
    console.log(`📊 INSTANCES INCOHÉRENTES DÉTECTÉES: ${inconsistentInstances.length}`);
    console.log(`${'='.repeat(100)}\n`);

    for (const instance of inconsistentInstances) {
      console.log(`🔴 INSTANCE INCOHÉRENTE: ${instance.instanceId}`);
      console.log(`   Utilisateur: ${instance.email} (${instance.userId})`);
      console.log(`   Univers: ${instance.universName} (${instance.universId})`);
      console.log(`   Version: v${instance.instanceVersion}`);
      console.log(`   Statut: ${instance.isActive ? '✅ ACTIVE' : '❌ INACTIVE'}`);
      if (instance.createdAt) {
        console.log(`   Créée le: ${instance.createdAt.toLocaleString('fr-FR')}`);
      }
      console.log(`\n   📋 RESSOURCES ATTENDUES:`);
      console.log(`      - Formulaires: ${instance.expected.forms}`);
      console.log(`      - Dashboards: ${instance.expected.dashboards}`);
      console.log(`      - Listes: ${instance.expected.lists}`);
      console.log(`      - Instructions: ${instance.expected.instructions}`);
      console.log(`      - Rapports: ${instance.expected.reports}`);
      console.log(`\n   📊 RESSOURCES RÉELLES:`);
      console.log(`      - Formulaires: ${instance.actual.forms} ${instance.actual.forms !== instance.expected.forms ? '⚠️' : '✅'}`);
      console.log(`      - Dashboards: ${instance.actual.dashboards} ${instance.actual.dashboards !== instance.expected.dashboards ? '⚠️' : '✅'}`);
      console.log(`      - Listes: ${instance.actual.lists} ${instance.actual.lists !== instance.expected.lists ? '⚠️' : '✅'}`);
      console.log(`      - Instructions: ${instance.actual.instructions} ${instance.actual.instructions !== instance.expected.instructions ? '⚠️' : '✅'}`);
      console.log(`      - Rapports: ${instance.actual.reports} ${instance.actual.reports !== instance.expected.reports ? '⚠️' : '✅'}`);
      console.log(`\n   ${'─'.repeat(98)}\n`);
    }

    // Supprimer les instances si --write
    if (!write) {
      console.log(`\n⚠️  Mode dry-run: ${inconsistentInstances.length} instance(s) seraient supprimée(s)`);
      console.log(`   Exécutez avec --write pour supprimer ces instances`);
      return;
    }

    console.log(`\n${'='.repeat(100)}`);
    console.log(`🗑️  SUPPRESSION DES INSTANCES INCOHÉRENTES`);
    console.log(`${'='.repeat(100)}\n`);

    let deletedCount = 0;
    let errorCount = 0;

    for (const instance of inconsistentInstances) {
      try {
        // Vérifier si l'instance est référencée dans ActiveUnivers
        const activeUniversDoc = await db.collection(ACTIVE_UNIVERS_COLLECTION).doc(instance.userId).get();
        let needsActiveUniversUpdate = false;
        
        if (activeUniversDoc.exists) {
          const activeUniversData = activeUniversDoc.data();
          if (activeUniversData.activeInstanceId === instance.instanceId) {
            needsActiveUniversUpdate = true;
            console.log(`   ⚠️  Instance ${instance.instanceId} est référencée dans ActiveUnivers, mise à jour nécessaire...`);
          }
        }

        // Supprimer l'instance
        await db.collection(INSTANCES_COLLECTION).doc(instance.instanceId).delete();
        deletedCount++;

        console.log(`   ✅ Instance ${instance.instanceId} supprimée (${instance.email} - ${instance.universName})`);

        // Mettre à jour ActiveUnivers si nécessaire
        if (needsActiveUniversUpdate) {
          const activeUniversRef = db.collection(ACTIVE_UNIVERS_COLLECTION).doc(instance.userId);
          await activeUniversRef.update({
            activeInstanceId: null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log(`   ✅ ActiveUnivers mis à jour pour ${instance.email}`);
        }
      } catch (error) {
        errorCount++;
        console.error(`   ❌ Erreur lors de la suppression de l'instance ${instance.instanceId}:`, error.message);
      }
    }

    console.log(`\n${'='.repeat(100)}`);
    console.log(`📊 RÉSUMÉ`);
    console.log(`${'='.repeat(100)}`);
    console.log(`   Instances incohérentes détectées: ${inconsistentInstances.length}`);
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


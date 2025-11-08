/**
 * Script pour lister tous les utilisateurs, leurs Univers, instances et ressources
 * 
 * Pour chaque utilisateur (directeur) :
 * 1. Affiche l'email
 * 2. Liste tous leurs Univers avec leurs définitions (nombre de ressources)
 * 3. Liste toutes les instances par Univers
 * 4. Liste toutes les ressources par instance, par Univers
 * 
 * Usage: node scripts/list-users-univers-instances-resources.js [--format=table|json]
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
      createdAt: doc.data().createdAt?.toDate?.() || null
    }));

    // Dashboards
    const dashboardsQuery = db.collection(DASHBOARDS_COLLECTION)
      .where('agencyId', '==', agencyId)
      .where('universId', '==', universId)
      .where('universInstanceId', '==', instanceId);
    const dashboardsSnapshot = await dashboardsQuery.get();
    resources.dashboards = dashboardsSnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name || doc.data().title || 'Sans nom',
      createdAt: doc.data().createdAt?.toDate?.() || null
    }));

    // Lists
    const listsQuery = db.collection(LISTS_COLLECTION)
      .where('agencyId', '==', agencyId)
      .where('universId', '==', universId)
      .where('universInstanceId', '==', instanceId);
    const listsSnapshot = await listsQuery.get();
    resources.lists = listsSnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name || 'Sans nom',
      createdAt: doc.data().createdAt?.toDate?.() || null
    }));

    // Instructions (scheduledQuestions)
    const instructionsQuery = db.collection(INSTRUCTIONS_COLLECTION)
      .where('agencyId', '==', agencyId)
      .where('universId', '==', universId)
      .where('universInstanceId', '==', instanceId);
    const instructionsSnapshot = await instructionsQuery.get();
    resources.instructions = instructionsSnapshot.docs.map(doc => ({
      id: doc.id,
      question: doc.data().question || 'Sans question',
      createdAt: doc.data().createdAt?.toDate?.() || null
    }));

    // Reports
    const reportsQuery = db.collection(REPORTS_COLLECTION)
      .where('agencyId', '==', agencyId)
      .where('universId', '==', universId)
      .where('universInstanceId', '==', instanceId);
    const reportsSnapshot = await reportsQuery.get();
    resources.reports = reportsSnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name || doc.data().title || 'Sans nom',
      createdAt: doc.data().createdAt?.toDate?.() || null
    }));
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
    forms: definitions.forms || [],
    dashboards: definitions.dashboards || [],
    lists: definitions.lists || [],
    instructions: definitions.instructions || [],
    reports: definitions.reports || []
  };
}

/**
 * Récupérer toutes les instances pour un Univers et un utilisateur
 */
async function getInstancesForUnivers(universId, userId, agencyId) {
  try {
    const instancesQuery = db.collection(INSTANCES_COLLECTION)
      .where('universId', '==', universId)
      .where('userId', '==', userId)
      .where('agencyId', '==', agencyId);
    const instancesSnapshot = await instancesQuery.get();
    
    return instancesSnapshot.docs.map(doc => ({
      id: doc.id,
      data: doc.data()
    }));
  } catch (error) {
    console.warn(`⚠️  Erreur lors de la récupération des instances pour Univers ${universId}:`, error.message);
    return [];
  }
}

/**
 * Récupérer tous les Univers pour un utilisateur
 */
async function getUniversForUser(userId, agencyId) {
  try {
    // Récupérer l'Univers actif
    const activeUniversDoc = await db.collection(ACTIVE_UNIVERS_COLLECTION).doc(userId).get();
    const activeUnivers = activeUniversDoc.exists ? activeUniversDoc.data() : null;

    // Récupérer toutes les instances de l'utilisateur
    const instancesQuery = db.collection(INSTANCES_COLLECTION)
      .where('userId', '==', userId)
      .where('agencyId', '==', agencyId);
    const instancesSnapshot = await instancesQuery.get();

    // Extraire les Univers uniques
    const universIds = new Set();
    instancesSnapshot.docs.forEach(doc => {
      const instanceData = doc.data();
      if (instanceData.universId) {
        universIds.add(instanceData.universId);
      }
    });

    // Si un Univers actif existe, l'ajouter
    if (activeUnivers && activeUnivers.activeUniversId) {
      universIds.add(activeUnivers.activeUniversId);
    }

    // Récupérer les Univers
    const universList = [];
    for (const universId of universIds) {
      try {
        const universDoc = await db.collection(UNIVERS_COLLECTION).doc(universId).get();
        if (universDoc.exists) {
          const universData = universDoc.data();
          universList.push({
            id: universId,
            data: universData,
            isActive: activeUnivers && activeUnivers.activeUniversId === universId,
            activeInstanceId: activeUnivers && activeUnivers.activeUniversId === universId ? activeUnivers.activeInstanceId : null
          });
        }
      } catch (error) {
        console.warn(`⚠️  Erreur lors de la récupération du Univers ${universId}:`, error.message);
      }
    }

    return universList;
  } catch (error) {
    console.error(`❌ Erreur lors de la récupération des Univers pour l'utilisateur ${userId}:`, error);
    return [];
  }
}

/**
 * Récupérer tous les directeurs
 */
async function getAllDirectors() {
  try {
    const usersQuery = db.collection(USERS_COLLECTION)
      .where('role', '==', 'directeur');
    const usersSnapshot = await usersQuery.get();
    
    return usersSnapshot.docs.map(doc => ({
      id: doc.id,
      data: doc.data()
    }));
  } catch (error) {
    console.warn('⚠️  Erreur lors de la récupération des directeurs, tentative avec tous les utilisateurs...');
    // Fallback : récupérer tous les utilisateurs
    const allUsersSnapshot = await db.collection(USERS_COLLECTION).get();
    return allUsersSnapshot.docs.map(doc => ({
      id: doc.id,
      data: doc.data()
    }));
  }
}

/**
 * Afficher les informations d'un utilisateur
 */
async function displayUserInfo(user, format = 'table') {
  const userId = user.id;
  const userData = user.data;
  const email = userData.email || userData.emailAddress || 'N/A';
  const agencyId = userData.agencyId || 'N/A';
  const role = userData.role || 'N/A';

  console.log(`\n${'='.repeat(100)}`);
  console.log(`👤 UTILISATEUR: ${email}`);
  console.log(`${'='.repeat(100)}`);
  console.log(`   ID: ${userId}`);
  console.log(`   Rôle: ${role}`);
  console.log(`   Agence: ${agencyId}`);

  // Récupérer les Univers de l'utilisateur
  const universList = await getUniversForUser(userId, agencyId);

  if (universList.length === 0) {
    console.log(`\n   ⚠️  Aucun Univers trouvé pour cet utilisateur`);
    return;
  }

  console.log(`\n   📦 ${universList.length} Univers trouvé(s)`);

  // Pour chaque Univers
  for (const univers of universList) {
    const universId = univers.id;
    const universData = univers.data;
    const universName = universData.metadata?.name || universData.name || 'Sans nom';
    const universVersion = universData.metadata?.version || 1;
    const isActive = univers.isActive;
    const activeInstanceId = univers.activeInstanceId;

    console.log(`\n   ${'─'.repeat(98)}`);
    console.log(`   📚 UNIVERS: ${universName} (${universId})`);
    console.log(`   ${'─'.repeat(98)}`);
    console.log(`      Version: v${universVersion}`);
    console.log(`      Statut: ${isActive ? '✅ ACTIF' : '❌ INACTIF'}`);
    if (isActive && activeInstanceId) {
      console.log(`      Instance active: ${activeInstanceId}`);
    }

    // Afficher les définitions
    const definitions = getUniversDefinitions(universData);
    console.log(`\n      📋 DÉFINITIONS (nombre de ressources attendues):`);
    console.log(`         - Formulaires: ${definitions.forms.length}`);
    console.log(`         - Tableaux de bord: ${definitions.dashboards.length}`);
    console.log(`         - Listes: ${definitions.lists.length}`);
    console.log(`         - Instructions: ${definitions.instructions.length}`);
    console.log(`         - Rapports: ${definitions.reports.length}`);

    // Récupérer toutes les instances pour ce Univers
    const instances = await getInstancesForUnivers(universId, userId, agencyId);

    if (instances.length === 0) {
      console.log(`\n      ⚠️  Aucune instance trouvée pour ce Univers`);
      continue;
    }

    console.log(`\n      🔄 ${instances.length} instance(s) trouvée(s):`);

    // Pour chaque instance
    for (const instance of instances) {
      const instanceId = instance.id;
      const instanceData = instance.data;
      const instanceVersion = instanceData.universVersion || instanceData.metadata?.universVersion || 1;
      const instanceIsActive = instanceData.isActive || false;
      const createdAt = instanceData.createdAt?.toDate?.() || null;
      const updatedAt = instanceData.updatedAt?.toDate?.() || null;

      console.log(`\n      ${'·'.repeat(96)}`);
      console.log(`      🔹 INSTANCE: ${instanceId}`);
      console.log(`      ${'·'.repeat(96)}`);
      console.log(`         Version: v${instanceVersion}`);
      console.log(`         Statut: ${instanceIsActive ? '✅ ACTIVE' : '❌ INACTIVE'}`);
      if (createdAt) {
        console.log(`         Créée le: ${createdAt.toLocaleString('fr-FR')}`);
      }
      if (updatedAt) {
        console.log(`         Mise à jour le: ${updatedAt.toLocaleString('fr-FR')}`);
      }

      // Récupérer toutes les ressources pour cette instance
      const resources = await getResourcesForInstance(instanceId, universId, agencyId);

      console.log(`\n         📊 RESSOURCES ACTUELLES:`);
      console.log(`            - Formulaires: ${resources.forms.length} (attendu: ${definitions.forms.length})`);
      console.log(`            - Tableaux de bord: ${resources.dashboards.length} (attendu: ${definitions.dashboards.length})`);
      console.log(`            - Listes: ${resources.lists.length} (attendu: ${definitions.lists.length})`);
      console.log(`            - Instructions: ${resources.instructions.length} (attendu: ${definitions.instructions.length})`);
      console.log(`            - Rapports: ${resources.reports.length} (attendu: ${definitions.reports.length})`);

      // Afficher les détails des ressources si demandé
      if (resources.forms.length > 0) {
        console.log(`\n            📝 Formulaires:`);
        resources.forms.forEach((form, index) => {
          const dateStr = form.createdAt ? form.createdAt.toLocaleString('fr-FR') : 'Date inconnue';
          console.log(`               ${index + 1}. ${form.title} (${form.id}) - Créé le: ${dateStr}`);
        });
      }

      if (resources.dashboards.length > 0) {
        console.log(`\n            📊 Tableaux de bord:`);
        resources.dashboards.forEach((dashboard, index) => {
          const dateStr = dashboard.createdAt ? dashboard.createdAt.toLocaleString('fr-FR') : 'Date inconnue';
          console.log(`               ${index + 1}. ${dashboard.name} (${dashboard.id}) - Créé le: ${dateStr}`);
        });
      }

      if (resources.lists.length > 0) {
        console.log(`\n            📋 Listes:`);
        resources.lists.forEach((list, index) => {
          const dateStr = list.createdAt ? list.createdAt.toLocaleString('fr-FR') : 'Date inconnue';
          console.log(`               ${index + 1}. ${list.name} (${list.id}) - Créé le: ${dateStr}`);
        });
      }

      if (resources.instructions.length > 0) {
        console.log(`\n            📌 Instructions:`);
        resources.instructions.forEach((instruction, index) => {
          const dateStr = instruction.createdAt ? instruction.createdAt.toLocaleString('fr-FR') : 'Date inconnue';
          console.log(`               ${index + 1}. ${instruction.question} (${instruction.id}) - Créé le: ${dateStr}`);
        });
      }

      if (resources.reports.length > 0) {
        console.log(`\n            📄 Rapports:`);
        resources.reports.forEach((report, index) => {
          const dateStr = report.createdAt ? report.createdAt.toLocaleString('fr-FR') : 'Date inconnue';
          console.log(`               ${index + 1}. ${report.name} (${report.id}) - Créé le: ${dateStr}`);
        });
      }

      // Vérifier les incohérences
      const inconsistencies = [];
      if (resources.forms.length !== definitions.forms.length) {
        inconsistencies.push(`Formulaires: ${resources.forms.length} trouvé(s) au lieu de ${definitions.forms.length}`);
      }
      if (resources.dashboards.length !== definitions.dashboards.length) {
        inconsistencies.push(`Tableaux de bord: ${resources.dashboards.length} trouvé(s) au lieu de ${definitions.dashboards.length}`);
      }
      if (resources.lists.length !== definitions.lists.length) {
        inconsistencies.push(`Listes: ${resources.lists.length} trouvée(s) au lieu de ${definitions.lists.length}`);
      }
      if (resources.instructions.length !== definitions.instructions.length) {
        inconsistencies.push(`Instructions: ${resources.instructions.length} trouvée(s) au lieu de ${definitions.instructions.length}`);
      }
      if (resources.reports.length !== definitions.reports.length) {
        inconsistencies.push(`Rapports: ${resources.reports.length} trouvé(s) au lieu de ${definitions.reports.length}`);
      }

      if (inconsistencies.length > 0) {
        console.log(`\n            ⚠️  INCOHÉRENCES DÉTECTÉES:`);
        inconsistencies.forEach(inc => {
          console.log(`               - ${inc}`);
        });
      } else {
        console.log(`\n            ✅ Toutes les ressources correspondent aux définitions`);
      }
    }
  }
}

/**
 * Script principal
 */
async function main() {
  const format = process.argv.find(arg => arg.startsWith('--format='))?.split('=')[1] || 'table';

  console.log('🔍 Liste complète des utilisateurs, Univers, instances et ressources');
  console.log(`   Format: ${format}`);
  console.log('');

  try {
    // Récupérer tous les directeurs
    const directors = await getAllDirectors();
    console.log(`📦 ${directors.length} utilisateur(s) trouvé(s)\n`);

    if (directors.length === 0) {
      console.log('⚠️  Aucun utilisateur trouvé');
      return;
    }

    // Pour chaque utilisateur
    for (const director of directors) {
      await displayUserInfo(director, format);
    }

    // Résumé global
    console.log(`\n${'='.repeat(100)}`);
    console.log(`📊 RÉSUMÉ GLOBAL`);
    console.log(`${'='.repeat(100)}`);
    console.log(`   Total d'utilisateurs: ${directors.length}`);

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


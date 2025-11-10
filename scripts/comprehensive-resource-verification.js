/**
 * Script de vérification exhaustive des ressources Univers
 * 
 * Pour chaque Univers :
 * 1. Trouve les instances actives
 * 2. Pour chaque instance, vérifie chaque ressource dans le tableau d'objets créés
 * 3. Pour chaque ID, vérifie l'existence réelle dans la collection correspondante
 * 4. Détecte les doublons, les ressources orphelines, et les incohérences
 * 
 * Usage: node scripts/comprehensive-resource-verification.js [--fix]
 *   - Sans --fix : mode diagnostic uniquement
 *   - Avec --fix : corrige automatiquement les problèmes détectés
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
 * Vérifier une ressource spécifique
 */
async function verifyResource(
  resourceId,
  resourceType,
  collectionName,
  expectedInstanceId,
  expectedUniversId,
  expectedAgencyId
) {
  try {
    const resourceDoc = await db.collection(collectionName).doc(resourceId).get();
    
    if (!resourceDoc.exists) {
      return {
        exists: false,
        error: 'RESSOURCE_INEXISTANTE',
        message: `La ressource ${resourceId} n'existe pas dans ${collectionName}`
      };
    }

    const resourceData = resourceDoc.data();
    const actualInstanceId = resourceData.universInstanceId || null;
    const actualUniversId = resourceData.universId || null;
    const actualAgencyId = resourceData.agencyId || null;

    const issues = [];

    if (actualInstanceId !== expectedInstanceId) {
      issues.push({
        type: 'MAUVAIS_INSTANCE_ID',
        expected: expectedInstanceId,
        actual: actualInstanceId,
        message: `universInstanceId incorrect: attendu ${expectedInstanceId}, trouvé ${actualInstanceId || 'null'}`
      });
    }

    if (actualUniversId !== expectedUniversId) {
      issues.push({
        type: 'MAUVAIS_UNIVERS_ID',
        expected: expectedUniversId,
        actual: actualUniversId,
        message: `universId incorrect: attendu ${expectedUniversId}, trouvé ${actualUniversId || 'null'}`
      });
    }

    if (actualAgencyId !== expectedAgencyId) {
      issues.push({
        type: 'MAUVAIS_AGENCY_ID',
        expected: expectedAgencyId,
        actual: actualAgencyId,
        message: `agencyId incorrect: attendu ${expectedAgencyId}, trouvé ${actualAgencyId || 'null'}`
      });
    }

    return {
      exists: true,
      data: resourceData,
      issues: issues.length > 0 ? issues : null
    };
  } catch (error) {
    return {
      exists: false,
      error: 'ERREUR_LECTURE',
      message: `Erreur lors de la lecture de la ressource: ${error.message}`
    };
  }
}

/**
 * Vérifier toutes les ressources d'une instance
 */
async function verifyInstanceResources(instance, universId, agencyId) {
  const instanceId = instance.id;
  const instanceData = instance.data || instance;
  const instances = instanceData.instances || {};

  const results = {
    forms: { verified: [], missing: [], issues: [], duplicates: [] },
    dashboards: { verified: [], missing: [], issues: [], duplicates: [] },
    lists: { verified: [], missing: [], issues: [], duplicates: [] },
    instructions: { verified: [], missing: [], issues: [], duplicates: [] },
    reports: { verified: [], missing: [], issues: [], duplicates: [] }
  };

  // Vérifier les formulaires
  const formIds = instances.forms || [];
  const formTitles = new Map(); // Pour détecter les doublons par titre

  for (const formId of formIds) {
    const verification = await verifyResource(
      formId,
      'formulaire',
      FORMS_COLLECTION,
      instanceId,
      universId,
      agencyId
    );

    if (!verification.exists) {
      results.forms.missing.push({ id: formId, reason: verification.message });
    } else {
      const title = verification.data.title || 'Sans titre';
      
      // Détecter les doublons par titre
      if (formTitles.has(title)) {
        results.forms.duplicates.push({
          id: formId,
          title,
          duplicateOf: formTitles.get(title)
        });
      } else {
        formTitles.set(title, formId);
      }

      if (verification.issues) {
        results.forms.issues.push({ id: formId, issues: verification.issues });
      } else {
        results.forms.verified.push({ id: formId, title });
      }
    }
  }

  // Vérifier les dashboards
  const dashboardIds = instances.dashboards || [];
  const dashboardNames = new Map();

  for (const dashboardId of dashboardIds) {
    const verification = await verifyResource(
      dashboardId,
      'dashboard',
      DASHBOARDS_COLLECTION,
      instanceId,
      universId,
      agencyId
    );

    if (!verification.exists) {
      results.dashboards.missing.push({ id: dashboardId, reason: verification.message });
    } else {
      const name = verification.data.name || verification.data.title || 'Sans titre';
      
      if (dashboardNames.has(name)) {
        results.dashboards.duplicates.push({
          id: dashboardId,
          name,
          duplicateOf: dashboardNames.get(name)
        });
      } else {
        dashboardNames.set(name, dashboardId);
      }

      if (verification.issues) {
        results.dashboards.issues.push({ id: dashboardId, issues: verification.issues });
      } else {
        results.dashboards.verified.push({ id: dashboardId, name });
      }
    }
  }

  // Vérifier les listes
  const listIds = instances.lists || [];
  const listTitles = new Map();

  for (const listId of listIds) {
    const verification = await verifyResource(
      listId,
      'liste',
      LISTS_COLLECTION,
      instanceId,
      universId,
      agencyId
    );

    if (!verification.exists) {
      results.lists.missing.push({ id: listId, reason: verification.message });
    } else {
      const title = verification.data.title || 'Sans titre';
      
      if (listTitles.has(title)) {
        results.lists.duplicates.push({
          id: listId,
          title,
          duplicateOf: listTitles.get(title)
        });
      } else {
        listTitles.set(title, listId);
      }

      if (verification.issues) {
        results.lists.issues.push({ id: listId, issues: verification.issues });
      } else {
        results.lists.verified.push({ id: listId, title });
      }
    }
  }

  // Vérifier les instructions
  const instructionIds = instances.instructions || [];
  const instructionTitles = new Map();

  for (const instructionId of instructionIds) {
    const verification = await verifyResource(
      instructionId,
      'instruction',
      INSTRUCTIONS_COLLECTION,
      instanceId,
      universId,
      agencyId
    );

    if (!verification.exists) {
      results.instructions.missing.push({ id: instructionId, reason: verification.message });
    } else {
      const title = verification.data.title || 'Sans titre';
      
      if (instructionTitles.has(title)) {
        results.instructions.duplicates.push({
          id: instructionId,
          title,
          duplicateOf: instructionTitles.get(title)
        });
      } else {
        instructionTitles.set(title, instructionId);
      }

      if (verification.issues) {
        results.instructions.issues.push({ id: instructionId, issues: verification.issues });
      } else {
        results.instructions.verified.push({ id: instructionId, title });
      }
    }
  }

  // Vérifier les rapports
  const reportIds = instances.reports || [];
  const reportTitles = new Map();

  for (const reportId of reportIds) {
    const verification = await verifyResource(
      reportId,
      'rapport',
      REPORTS_COLLECTION,
      instanceId,
      universId,
      agencyId
    );

    if (!verification.exists) {
      results.reports.missing.push({ id: reportId, reason: verification.message });
    } else {
      const title = verification.data.title || verification.data.name || 'Sans titre';
      
      if (reportTitles.has(title)) {
        results.reports.duplicates.push({
          id: reportId,
          title,
          duplicateOf: reportTitles.get(title)
        });
      } else {
        reportTitles.set(title, reportId);
      }

      if (verification.issues) {
        results.reports.issues.push({ id: reportId, issues: verification.issues });
      } else {
        results.reports.verified.push({ id: reportId, title });
      }
    }
  }

  return results;
}

/**
 * Vérifier toutes les ressources dans les collections pour une instance
 * (pour détecter les doublons et les ressources orphelines)
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
 * Vérifier un Univers complet
 */
async function verifyUnivers(universDoc) {
  const universId = universDoc.id;
  const univers = universDoc.data();
  const definitions = univers.definitions || {};

  console.log(`\n${'='.repeat(80)}`);
  console.log(`📦 Univers: ${universId}`);
  console.log(`   Nom: ${univers.metadata?.name || 'Sans nom'}`);
  console.log(`   Version: ${univers.metadata?.version || 'N/A'}`);
  console.log(`   Définitions: ${(definitions.forms || []).length} formulaires, ${(definitions.dashboards || []).length} dashboards, ${(definitions.lists || []).length} listes, ${(definitions.instructions || []).length} instructions, ${(definitions.reports || []).length} rapports`);

  // Trouver les instances actives pour ce Univers
  const activeUniversSnapshot = await db.collection(ACTIVE_UNIVERS_COLLECTION)
    .where('activeUniversId', '==', universId)
    .get();

  if (activeUniversSnapshot.empty) {
    console.log(`   ⚠️ Aucune instance active trouvée pour ce Univers`);
    return { universId, instances: [] };
  }

  const instancesResults = [];

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

    // Récupérer l'instance
    const instanceDoc = await db.collection(INSTANCES_COLLECTION).doc(activeInstanceId).get();
    
    if (!instanceDoc.exists) {
      console.log(`   ❌ Instance ${activeInstanceId} n'existe pas !`);
      continue;
    }

    const instanceData = instanceDoc.data();
    const instance = { id: activeInstanceId, data: instanceData };
    const instances = instanceData.instances || {};

    console.log(`\n   🔍 Vérification de l'instance ${activeInstanceId}:`);
    console.log(`      Formulaires listés: ${(instances.forms || []).length}`);
    console.log(`      Dashboards listés: ${(instances.dashboards || []).length}`);
    console.log(`      Listes listées: ${(instances.lists || []).length}`);
    console.log(`      Instructions listées: ${(instances.instructions || []).length}`);
    console.log(`      Rapports listés: ${(instances.reports || []).length}`);

    // Vérifier toutes les ressources de l'instance
    const verificationResults = await verifyInstanceResources(instance, universId, agencyId);

    // Trouver toutes les ressources dans les collections pour cette instance
    const allResourcesInCollections = await findAllResourcesInCollections(activeInstanceId, universId, agencyId);
    
    // Comparer avec les ressources listées dans l'instance
    const listedFormIds = new Set(instances.forms || []);
    const listedDashboardIds = new Set(instances.dashboards || []);
    const listedListIds = new Set(instances.lists || []);
    const listedInstructionIds = new Set(instances.instructions || []);
    const listedReportIds = new Set(instances.reports || []);

    // Détecter les ressources orphelines (dans les collections mais pas dans l'instance)
    const orphans = {
      forms: allResourcesInCollections.forms.filter(r => !listedFormIds.has(r.id)),
      dashboards: allResourcesInCollections.dashboards.filter(r => !listedDashboardIds.has(r.id)),
      lists: allResourcesInCollections.lists.filter(r => !listedListIds.has(r.id)),
      instructions: allResourcesInCollections.instructions.filter(r => !listedInstructionIds.has(r.id)),
      reports: allResourcesInCollections.reports.filter(r => !listedReportIds.has(r.id))
    };

    // Détecter les doublons dans les collections (même titre/nom)
    // Pour chaque ressource, on garde la première occurrence (la plus ancienne) et on marque les autres comme doublons
    const detectDuplicates = (resources, getTitle) => {
      const byTitle = new Map();
      const duplicates = [];
      
      // Trier par date de création (la plus ancienne en premier)
      const sortedResources = [...resources].sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt || 0);
        const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt || 0);
        return dateA.getTime() - dateB.getTime();
      });
      
      sortedResources.forEach(resource => {
        const title = getTitle(resource);
        if (byTitle.has(title)) {
          // C'est un doublon, garder l'ID de la première occurrence
          duplicates.push({
            id: resource.id,
            title,
            duplicateOf: byTitle.get(title),
            createdAt: resource.createdAt
          });
        } else {
          // Première occurrence, la garder
          byTitle.set(title, resource.id);
        }
      });
      
      return duplicates;
    };

    // Détecter les doublons dans les collections
    const duplicatesInCollections = {
      forms: detectDuplicates(allResourcesInCollections.forms, r => r.title),
      dashboards: detectDuplicates(allResourcesInCollections.dashboards, r => r.name),
      lists: detectDuplicates(allResourcesInCollections.lists, r => r.title),
      instructions: detectDuplicates(allResourcesInCollections.instructions, r => r.title),
      reports: detectDuplicates(allResourcesInCollections.reports, r => r.title)
    };

    // Ajouter les doublons trouvés dans les collections aux résultats
    verificationResults.forms.duplicates.push(...duplicatesInCollections.forms);
    verificationResults.dashboards.duplicates.push(...duplicatesInCollections.dashboards);
    verificationResults.lists.duplicates.push(...duplicatesInCollections.lists);
    verificationResults.instructions.duplicates.push(...duplicatesInCollections.instructions);
    verificationResults.reports.duplicates.push(...duplicatesInCollections.reports);

    // Afficher les résultats
    let hasIssues = false;

    // Compter le total de ressources dans les collections
    const totalFormsInCollections = allResourcesInCollections.forms.length;
    const totalDashboardsInCollections = allResourcesInCollections.dashboards.length;
    const totalListsInCollections = allResourcesInCollections.lists.length;
    const totalInstructionsInCollections = allResourcesInCollections.instructions.length;
    const totalReportsInCollections = allResourcesInCollections.reports.length;

    // Vérifier s'il y a des problèmes
    const hasFormsIssues = verificationResults.forms.missing.length > 0 || 
        verificationResults.forms.issues.length > 0 || 
        verificationResults.forms.duplicates.length > 0 ||
        orphans.forms.length > 0 ||
        totalFormsInCollections !== (instances.forms || []).length;

    const hasDashboardsIssues = verificationResults.dashboards.missing.length > 0 || 
        verificationResults.dashboards.issues.length > 0 || 
        verificationResults.dashboards.duplicates.length > 0 ||
        orphans.dashboards.length > 0 ||
        totalDashboardsInCollections !== (instances.dashboards || []).length;

    const hasListsIssues = verificationResults.lists.missing.length > 0 || 
        verificationResults.lists.issues.length > 0 || 
        verificationResults.lists.duplicates.length > 0 ||
        orphans.lists.length > 0 ||
        totalListsInCollections !== (instances.lists || []).length;

    const hasInstructionsIssues = verificationResults.instructions.missing.length > 0 || 
        verificationResults.instructions.issues.length > 0 || 
        verificationResults.instructions.duplicates.length > 0 ||
        orphans.instructions.length > 0 ||
        totalInstructionsInCollections !== (instances.instructions || []).length;

    const hasReportsIssues = verificationResults.reports.missing.length > 0 || 
        verificationResults.reports.issues.length > 0 || 
        verificationResults.reports.duplicates.length > 0 ||
        orphans.reports.length > 0 ||
        totalReportsInCollections !== (instances.reports || []).length;

    // Formulaires
    if (hasFormsIssues) {
      hasIssues = true;
      console.log(`\n      📝 Formulaires:`);
      console.log(`         📊 Dans l'instance: ${(instances.forms || []).length}, Dans les collections: ${totalFormsInCollections}`);
      if (totalFormsInCollections !== (instances.forms || []).length) {
        console.log(`         ⚠️ INCOHÉRENCE: ${totalFormsInCollections - (instances.forms || []).length} formulaire(s) supplémentaire(s) dans les collections`);
      }
      console.log(`         ✅ Vérifiés: ${verificationResults.forms.verified.length}`);
      if (verificationResults.forms.missing.length > 0) {
        console.log(`         ❌ Manquants: ${verificationResults.forms.missing.length}`);
        verificationResults.forms.missing.forEach(m => {
          console.log(`            - ${m.id}: ${m.reason}`);
        });
      }
      if (verificationResults.forms.issues.length > 0) {
        console.log(`         ⚠️ Problèmes: ${verificationResults.forms.issues.length}`);
        verificationResults.forms.issues.forEach(i => {
          i.issues.forEach(issue => {
            console.log(`            - ${i.id}: ${issue.message}`);
          });
        });
      }
      if (verificationResults.forms.duplicates.length > 0) {
        console.log(`         🔴 Doublons: ${verificationResults.forms.duplicates.length}`);
        verificationResults.forms.duplicates.forEach(d => {
          console.log(`            - ${d.id} ("${d.title}") est un doublon de ${d.duplicateOf}`);
        });
      }
      if (orphans.forms.length > 0) {
        console.log(`         ⚠️ Orphelins: ${orphans.forms.length} ressource(s) existent dans la collection mais ne sont pas listées dans l'instance`);
        orphans.forms.forEach(o => {
          console.log(`            - ${o.id} ("${o.title}") créé le ${o.createdAt.toISOString()}`);
        });
      }
    }

    // Dashboards
    if (hasDashboardsIssues) {
      hasIssues = true;
      console.log(`\n      📊 Dashboards:`);
      console.log(`         📊 Dans l'instance: ${(instances.dashboards || []).length}, Dans les collections: ${totalDashboardsInCollections}`);
      if (totalDashboardsInCollections !== (instances.dashboards || []).length) {
        console.log(`         ⚠️ INCOHÉRENCE: ${totalDashboardsInCollections - (instances.dashboards || []).length} dashboard(s) supplémentaire(s) dans les collections`);
      }
      console.log(`         ✅ Vérifiés: ${verificationResults.dashboards.verified.length}`);
      if (verificationResults.dashboards.missing.length > 0) {
        console.log(`         ❌ Manquants: ${verificationResults.dashboards.missing.length}`);
        verificationResults.dashboards.missing.forEach(m => {
          console.log(`            - ${m.id}: ${m.reason}`);
        });
      }
      if (verificationResults.dashboards.issues.length > 0) {
        console.log(`         ⚠️ Problèmes: ${verificationResults.dashboards.issues.length}`);
        verificationResults.dashboards.issues.forEach(i => {
          i.issues.forEach(issue => {
            console.log(`            - ${i.id}: ${issue.message}`);
          });
        });
      }
      if (verificationResults.dashboards.duplicates.length > 0) {
        console.log(`         🔴 Doublons: ${verificationResults.dashboards.duplicates.length}`);
        verificationResults.dashboards.duplicates.forEach(d => {
          console.log(`            - ${d.id} ("${d.name}") est un doublon de ${d.duplicateOf}`);
        });
      }
      if (orphans.dashboards.length > 0) {
        console.log(`         ⚠️ Orphelins: ${orphans.dashboards.length} ressource(s) existent dans la collection mais ne sont pas listées dans l'instance`);
        orphans.dashboards.forEach(o => {
          console.log(`            - ${o.id} ("${o.name}") créé le ${o.createdAt.toISOString()}`);
        });
      }
    }

    // Listes
    if (hasListsIssues) {
      hasIssues = true;
      console.log(`\n      📋 Listes:`);
      console.log(`         📊 Dans l'instance: ${(instances.lists || []).length}, Dans les collections: ${totalListsInCollections}`);
      if (totalListsInCollections !== (instances.lists || []).length) {
        console.log(`         ⚠️ INCOHÉRENCE: ${totalListsInCollections - (instances.lists || []).length} liste(s) supplémentaire(s) dans les collections`);
      }
      console.log(`         ✅ Vérifiées: ${verificationResults.lists.verified.length}`);
      if (verificationResults.lists.missing.length > 0) {
        console.log(`         ❌ Manquantes: ${verificationResults.lists.missing.length}`);
      }
      if (verificationResults.lists.duplicates.length > 0) {
        console.log(`         🔴 Doublons: ${verificationResults.lists.duplicates.length}`);
        verificationResults.lists.duplicates.forEach(d => {
          console.log(`            - ${d.id} ("${d.title}") est un doublon de ${d.duplicateOf}`);
        });
      }
      if (orphans.lists.length > 0) {
        console.log(`         ⚠️ Orphelins: ${orphans.lists.length} ressource(s) existent dans la collection mais ne sont pas listées dans l'instance`);
      }
    }

    // Instructions
    if (hasInstructionsIssues) {
      hasIssues = true;
      console.log(`\n      📚 Instructions:`);
      console.log(`         📊 Dans l'instance: ${(instances.instructions || []).length}, Dans les collections: ${totalInstructionsInCollections}`);
      if (totalInstructionsInCollections !== (instances.instructions || []).length) {
        console.log(`         ⚠️ INCOHÉRENCE: ${totalInstructionsInCollections - (instances.instructions || []).length} instruction(s) supplémentaire(s) dans les collections`);
      }
      console.log(`         ✅ Vérifiées: ${verificationResults.instructions.verified.length}`);
      if (verificationResults.instructions.missing.length > 0) {
        console.log(`         ❌ Manquantes: ${verificationResults.instructions.missing.length}`);
      }
      if (verificationResults.instructions.duplicates.length > 0) {
        console.log(`         🔴 Doublons: ${verificationResults.instructions.duplicates.length}`);
        verificationResults.instructions.duplicates.forEach(d => {
          console.log(`            - ${d.id} ("${d.title}") est un doublon de ${d.duplicateOf}`);
        });
      }
      if (orphans.instructions.length > 0) {
        console.log(`         ⚠️ Orphelins: ${orphans.instructions.length} ressource(s) existent dans la collection mais ne sont pas listées dans l'instance`);
      }
    }

    // Rapports
    if (hasReportsIssues) {
      hasIssues = true;
      console.log(`\n      📄 Rapports:`);
      console.log(`         📊 Dans l'instance: ${(instances.reports || []).length}, Dans les collections: ${totalReportsInCollections}`);
      if (totalReportsInCollections !== (instances.reports || []).length) {
        console.log(`         ⚠️ INCOHÉRENCE: ${totalReportsInCollections - (instances.reports || []).length} rapport(s) supplémentaire(s) dans les collections`);
      }
      console.log(`         ✅ Vérifiés: ${verificationResults.reports.verified.length}`);
      if (verificationResults.reports.missing.length > 0) {
        console.log(`         ❌ Manquants: ${verificationResults.reports.missing.length}`);
      }
      if (verificationResults.reports.duplicates.length > 0) {
        console.log(`         🔴 Doublons: ${verificationResults.reports.duplicates.length}`);
        verificationResults.reports.duplicates.forEach(d => {
          console.log(`            - ${d.id} ("${d.title}") est un doublon de ${d.duplicateOf}`);
        });
      }
      if (orphans.reports.length > 0) {
        console.log(`         ⚠️ Orphelins: ${orphans.reports.length} ressource(s) existent dans la collection mais ne sont pas listées dans l'instance`);
      }
    }

    if (!hasIssues) {
      console.log(`\n      ✅ Aucun problème détecté pour cette instance`);
    }

    instancesResults.push({
      directorId,
      agencyId,
      instanceId: activeInstanceId,
      verification: verificationResults,
      orphans,
      hasIssues
    });
  }

  return { universId, instances: instancesResults };
}

/**
 * Script principal
 */
async function main() {
  const fix = process.argv.includes('--fix');
  
  console.log('🔍 Vérification exhaustive des ressources Univers');
  console.log(`   Mode: ${fix ? 'CORRECTION AUTOMATIQUE' : 'DIAGNOSTIC UNIQUEMENT'}`);
  console.log('');

  try {
    // Récupérer tous les Univers
    const universSnapshot = await db.collection(UNIVERS_COLLECTION).get();
    console.log(`📦 ${universSnapshot.size} Univers trouvé(s)\n`);

    const allResults = [];

    for (const universDoc of universSnapshot.docs) {
      const result = await verifyUnivers(universDoc);
      allResults.push(result);
    }

    // Résumé global
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 RÉSUMÉ GLOBAL`);
    console.log(`${'='.repeat(80)}`);

    let totalIssues = 0;
    let totalUniversWithIssues = 0;

    allResults.forEach(result => {
      const universIssues = result.instances.filter(i => i.hasIssues).length;
      if (universIssues > 0) {
        totalUniversWithIssues++;
        console.log(`\n📦 Univers ${result.universId}: ${universIssues} instance(s) avec problème(s)`);
        
        result.instances.forEach(instance => {
          if (instance.hasIssues) {
            const issues = [
              ...instance.verification.forms.missing,
              ...instance.verification.forms.issues,
              ...instance.verification.forms.duplicates,
              ...instance.verification.dashboards.missing,
              ...instance.verification.dashboards.issues,
              ...instance.verification.dashboards.duplicates,
              ...instance.verification.lists.missing,
              ...instance.verification.lists.duplicates,
              ...instance.verification.instructions.missing,
              ...instance.verification.instructions.duplicates,
              ...instance.verification.reports.missing,
              ...instance.verification.reports.duplicates
            ];
            totalIssues += issues.length;
            console.log(`   Instance ${instance.instanceId}: ${issues.length} problème(s)`);
          }
        });
      }
    });

    console.log(`\n📊 Statistiques:`);
    console.log(`   Univers vérifiés: ${allResults.length}`);
    console.log(`   Univers avec problèmes: ${totalUniversWithIssues}`);
    console.log(`   Total de problèmes: ${totalIssues}`);

    if (totalIssues === 0) {
      console.log(`\n✅ Aucun problème détecté !`);
    } else {
      console.log(`\n⚠️  ${totalIssues} problème(s) détecté(s)`);
      if (!fix) {
        console.log(`   Exécutez avec --fix pour corriger automatiquement les problèmes`);
      }
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


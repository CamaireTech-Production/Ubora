/**
 * Script d'audit complet des ressources et leur association avec les Univers et instances
 * 
 * Pour chaque ressource (forms, dashboards, lists, instructions, reports) :
 * 1. Vérifie l'Univers auquel elle appartient (universId)
 * 2. Vérifie l'instance à laquelle elle appartient (universInstanceId)
 * 3. Vérifie si l'instance existe et est correcte
 * 4. Vérifie si la ressource est listée dans l'instance
 * 5. Génère un rapport détaillé
 * 
 * Usage: node scripts/audit-resources-univers-instances.js [--fix]
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
 * Vérifier une ressource et son association avec Univers/Instance
 */
async function auditResource(
  resourceId,
  resourceType,
  collectionName,
  resourceData
) {
  const universId = resourceData.universId || null;
  const universInstanceId = resourceData.universInstanceId || null;
  const agencyId = resourceData.agencyId || null;
  const createdBy = resourceData.createdBy || resourceData.userId || null;

  const audit = {
    resourceId,
    resourceType,
    collectionName,
    universId,
    universInstanceId,
    agencyId,
    createdBy,
    issues: [],
    recommendations: []
  };

  // 1. Vérifier si la ressource a un universId
  if (!universId) {
    audit.issues.push({
      type: 'MISSING_UNIVERS_ID',
      severity: 'WARNING',
      message: 'La ressource n\'a pas de universId'
    });
    audit.recommendations.push('Ajouter un universId si la ressource appartient à un Univers');
    return audit;
  }

  // 2. Vérifier si l'Univers existe
  let univers = null;
  try {
    const universDoc = await db.collection(UNIVERS_COLLECTION).doc(universId).get();
    if (universDoc.exists) {
      univers = { id: universId, data: universDoc.data() };
    } else {
      audit.issues.push({
        type: 'UNIVERS_NOT_FOUND',
        severity: 'ERROR',
        message: `L'Univers ${universId} n'existe pas`
      });
      return audit;
    }
  } catch (error) {
    audit.issues.push({
      type: 'UNIVERS_READ_ERROR',
      severity: 'ERROR',
      message: `Erreur lors de la lecture de l'Univers ${universId}: ${error.message}`
    });
    return audit;
  }

  // 3. Vérifier si la ressource a un universInstanceId
  if (!universInstanceId || universInstanceId === 'AUCUNE' || universInstanceId === null) {
    audit.issues.push({
      type: 'MISSING_INSTANCE_ID',
      severity: 'WARNING',
      message: 'La ressource n\'a pas de universInstanceId'
    });

    // Trouver l'instance active pour cet Univers et cette agence
    try {
      const activeUniversSnapshot = await db.collection(ACTIVE_UNIVERS_COLLECTION)
        .where('activeUniversId', '==', universId)
        .where('agencyId', '==', agencyId)
        .get();

      if (!activeUniversSnapshot.empty) {
        const activeUnivers = activeUniversSnapshot.docs[0].data();
        const activeInstanceId = activeUnivers.activeInstanceId;

        if (activeInstanceId && activeInstanceId !== 'AUCUNE') {
          audit.recommendations.push({
            action: 'UPDATE_INSTANCE_ID',
            targetInstanceId: activeInstanceId,
            message: `Mettre à jour universInstanceId à ${activeInstanceId} (instance active)`
          });
        } else {
          // Chercher toutes les instances pour cet Univers et cette agence
          const instancesSnapshot = await db.collection(INSTANCES_COLLECTION)
            .where('universId', '==', universId)
            .where('agencyId', '==', agencyId)
            .get();

          if (!instancesSnapshot.empty) {
            // Prendre la première instance trouvée (ou la plus récente)
            const instances = instancesSnapshot.docs.map(doc => ({
              id: doc.id,
              data: doc.data(),
              createdAt: doc.data().createdAt?.toDate?.() || new Date(0)
            })).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

            if (instances.length > 0) {
              audit.recommendations.push({
                action: 'UPDATE_INSTANCE_ID',
                targetInstanceId: instances[0].id,
                message: `Mettre à jour universInstanceId à ${instances[0].id} (instance trouvée)`
              });
            }
          } else {
            audit.recommendations.push({
              action: 'CREATE_INSTANCE',
              message: 'Créer une nouvelle instance pour cet Univers'
            });
          }
        }
      } else {
        audit.recommendations.push({
          action: 'CREATE_INSTANCE',
          message: 'Aucun Univers actif trouvé, créer une instance'
        });
      }
    } catch (error) {
      audit.issues.push({
        type: 'INSTANCE_SEARCH_ERROR',
        severity: 'WARNING',
        message: `Erreur lors de la recherche d'instance: ${error.message}`
      });
    }

    return audit;
  }

  // 4. Vérifier si l'instance existe
  let instance = null;
  try {
    const instanceDoc = await db.collection(INSTANCES_COLLECTION).doc(universInstanceId).get();
    if (instanceDoc.exists) {
      instance = { id: universInstanceId, data: instanceDoc.data() };
    } else {
      audit.issues.push({
        type: 'INSTANCE_NOT_FOUND',
        severity: 'ERROR',
        message: `L'instance ${universInstanceId} n'existe pas`
      });
      audit.recommendations.push({
        action: 'FIND_OR_CREATE_INSTANCE',
        message: 'Trouver ou créer une instance valide pour cette ressource'
      });
      return audit;
    }
  } catch (error) {
    audit.issues.push({
      type: 'INSTANCE_READ_ERROR',
      severity: 'ERROR',
      message: `Erreur lors de la lecture de l'instance ${universInstanceId}: ${error.message}`
    });
    return audit;
  }

  // 5. Vérifier si l'instance correspond au bon Univers
  if (instance.data.universId !== universId) {
    audit.issues.push({
      type: 'INSTANCE_UNIVERS_MISMATCH',
      severity: 'ERROR',
      message: `L'instance ${universInstanceId} appartient à l'Univers ${instance.data.universId}, pas à ${universId}`
    });
  }

  // 6. Vérifier si l'instance correspond à la bonne agence
  if (instance.data.agencyId !== agencyId) {
    audit.issues.push({
      type: 'INSTANCE_AGENCY_MISMATCH',
      severity: 'ERROR',
      message: `L'instance ${universInstanceId} appartient à l'agence ${instance.data.agencyId}, pas à ${agencyId}`
    });
  }

  // 7. Vérifier si la ressource est listée dans l'instance
  const instances = instance.data.instances || {};
  const resourceTypeKey = resourceType === 'instruction' ? 'instructions' : `${resourceType}s`;
  const listedResources = instances[resourceTypeKey] || [];

  if (!listedResources.includes(resourceId)) {
    audit.issues.push({
      type: 'RESOURCE_NOT_IN_INSTANCE',
      severity: 'WARNING',
      message: `La ressource n'est pas listée dans l'instance ${universInstanceId}`
    });
    audit.recommendations.push({
      action: 'ADD_TO_INSTANCE',
      message: `Ajouter la ressource ${resourceId} à l'instance ${universInstanceId}`
    });
  }

  return audit;
}

/**
 * Auditer toutes les ressources d'un type
 */
async function auditResourcesByType(collectionName, resourceType) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔍 Audit des ${resourceType}s (collection: ${collectionName})`);
  console.log(`${'='.repeat(80)}`);

  try {
    const snapshot = await db.collection(collectionName).get();
    console.log(`📦 ${snapshot.size} ${resourceType}(s) trouvé(s)\n`);

    const audits = [];
    let totalIssues = 0;
    let totalWithUnivers = 0;
    let totalWithInstance = 0;
    let totalWithoutUnivers = 0;
    let totalWithoutInstance = 0;

    for (const doc of snapshot.docs) {
      const resourceData = doc.data();
      const audit = await auditResource(doc.id, resourceType, collectionName, resourceData);

      audits.push(audit);

      if (audit.universId) {
        totalWithUnivers++;
      } else {
        totalWithoutUnivers++;
      }

      if (audit.universInstanceId && audit.universInstanceId !== 'AUCUNE') {
        totalWithInstance++;
      } else {
        totalWithoutInstance++;
      }

      if (audit.issues.length > 0) {
        totalIssues += audit.issues.length;
      }
    }

    // Afficher le résumé
    console.log(`\n📊 Résumé pour les ${resourceType}s:`);
    console.log(`   Total: ${snapshot.size}`);
    console.log(`   Avec universId: ${totalWithUnivers}`);
    console.log(`   Sans universId: ${totalWithoutUnivers}`);
    console.log(`   Avec universInstanceId: ${totalWithInstance}`);
    console.log(`   Sans universInstanceId: ${totalWithoutInstance}`);
    console.log(`   Total de problèmes: ${totalIssues}`);

    // Afficher les ressources avec problèmes
    const resourcesWithIssues = audits.filter(a => a.issues.length > 0);
    if (resourcesWithIssues.length > 0) {
      console.log(`\n⚠️  ${resourcesWithIssues.length} ${resourceType}(s) avec problème(s):`);
      
      for (const audit of resourcesWithIssues.slice(0, 10)) { // Limiter à 10 pour l'affichage
        console.log(`\n   ${resourceType.toUpperCase()}: ${audit.resourceId}`);
        console.log(`      Univers: ${audit.universId || 'AUCUN'}`);
        console.log(`      Instance: ${audit.universInstanceId || 'AUCUNE'}`);
        console.log(`      Agence: ${audit.agencyId || 'AUCUNE'}`);
        
        audit.issues.forEach(issue => {
          const icon = issue.severity === 'ERROR' ? '❌' : '⚠️';
          console.log(`      ${icon} ${issue.type}: ${issue.message}`);
        });

        if (audit.recommendations.length > 0) {
          console.log(`      💡 Recommandations:`);
          audit.recommendations.forEach(rec => {
            if (typeof rec === 'string') {
              console.log(`         - ${rec}`);
            } else {
              console.log(`         - ${rec.message}`);
            }
          });
        }
      }

      if (resourcesWithIssues.length > 10) {
        console.log(`\n   ... et ${resourcesWithIssues.length - 10} autre(s) ${resourceType}(s) avec problème(s)`);
      }
    } else {
      console.log(`\n✅ Aucun problème détecté pour les ${resourceType}s`);
    }

    return {
      resourceType,
      total: snapshot.size,
      withUnivers: totalWithUnivers,
      withoutUnivers: totalWithoutUnivers,
      withInstance: totalWithInstance,
      withoutInstance: totalWithoutInstance,
      totalIssues,
      resourcesWithIssues: resourcesWithIssues.length,
      audits
    };
  } catch (error) {
    console.error(`❌ Erreur lors de l'audit des ${resourceType}s:`, error);
    return {
      resourceType,
      total: 0,
      withUnivers: 0,
      withoutUnivers: 0,
      withInstance: 0,
      withoutInstance: 0,
      totalIssues: 0,
      resourcesWithIssues: 0,
      audits: [],
      error: error.message
    };
  }
}

/**
 * Corriger les problèmes détectés
 */
async function fixIssues(audits) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔧 CORRECTION DES PROBLÈMES`);
  console.log(`${'='.repeat(80)}`);

  let batch = db.batch();
  let batchCount = 0;
  let totalFixed = 0;

  const commitBatch = async () => {
    if (batchCount > 0) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  };

  for (const auditResult of audits) {
    for (const audit of auditResult.audits) {
      if (audit.issues.length === 0) continue;

      // Corriger les ressources sans universInstanceId
      const missingInstanceIssue = audit.issues.find(i => i.type === 'MISSING_INSTANCE_ID');
      if (missingInstanceIssue) {
        const recommendation = audit.recommendations.find(r => 
          typeof r === 'object' && r.action === 'UPDATE_INSTANCE_ID'
        );

        if (recommendation && recommendation.targetInstanceId) {
          try {
            const resourceRef = db.collection(audit.collectionName).doc(audit.resourceId);
            batch.update(resourceRef, {
              universInstanceId: recommendation.targetInstanceId,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            batchCount++;
            totalFixed++;

            console.log(`✅ ${audit.resourceType.toUpperCase()} ${audit.resourceId}: universInstanceId mis à jour à ${recommendation.targetInstanceId}`);

            if (batchCount >= MAX_BATCH_SIZE) {
              await commitBatch();
            }
          } catch (error) {
            console.error(`❌ Erreur lors de la correction de ${audit.resourceId}:`, error.message);
          }
        }
      }

      // Corriger les ressources avec des instances inexistantes
      const instanceNotFoundIssue = audit.issues.find(i => i.type === 'INSTANCE_NOT_FOUND');
      if (instanceNotFoundIssue && audit.universId && audit.agencyId) {
        // Chercher une instance valide pour cet Univers et cette agence
        try {
          const activeUniversSnapshot = await db.collection(ACTIVE_UNIVERS_COLLECTION)
            .where('activeUniversId', '==', audit.universId)
            .where('agencyId', '==', audit.agencyId)
            .get();

          let targetInstanceId = null;

          if (!activeUniversSnapshot.empty) {
            const activeUnivers = activeUniversSnapshot.docs[0].data();
            targetInstanceId = activeUnivers.activeInstanceId;
          }

          if (!targetInstanceId || targetInstanceId === 'AUCUNE') {
            // Chercher toutes les instances pour cet Univers et cette agence
            const instancesSnapshot = await db.collection(INSTANCES_COLLECTION)
              .where('universId', '==', audit.universId)
              .where('agencyId', '==', audit.agencyId)
              .get();

            if (!instancesSnapshot.empty) {
              const instances = instancesSnapshot.docs.map(doc => ({
                id: doc.id,
                data: doc.data(),
                createdAt: doc.data().createdAt?.toDate?.() || new Date(0)
              })).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

              if (instances.length > 0) {
                targetInstanceId = instances[0].id;
              }
            }
          }

          if (targetInstanceId && targetInstanceId !== 'AUCUNE') {
            try {
              const resourceRef = db.collection(audit.collectionName).doc(audit.resourceId);
              batch.update(resourceRef, {
                universInstanceId: targetInstanceId,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });
              batchCount++;
              totalFixed++;

              console.log(`✅ ${audit.resourceType.toUpperCase()} ${audit.resourceId}: universInstanceId corrigé de ${audit.universInstanceId} à ${targetInstanceId}`);

              if (batchCount >= MAX_BATCH_SIZE) {
                await commitBatch();
              }
            } catch (error) {
              console.error(`❌ Erreur lors de la correction de ${audit.resourceId}:`, error.message);
            }
          } else {
            console.warn(`⚠️  ${audit.resourceType.toUpperCase()} ${audit.resourceId}: Aucune instance valide trouvée pour Univers ${audit.universId}`);
          }
        } catch (error) {
          console.error(`❌ Erreur lors de la recherche d'instance pour ${audit.resourceId}:`, error.message);
        }
      }

      // Ajouter la ressource à l'instance si elle n'y est pas listée
      const notInInstanceIssue = audit.issues.find(i => i.type === 'RESOURCE_NOT_IN_INSTANCE');
      if (notInInstanceIssue && audit.universInstanceId && audit.universInstanceId !== 'AUCUNE') {
        try {
          const instanceRef = db.collection(INSTANCES_COLLECTION).doc(audit.universInstanceId);
          const instanceDoc = await instanceRef.get();

          if (instanceDoc.exists) {
            const instanceData = instanceDoc.data();
            const instances = instanceData.instances || {};
            const resourceTypeKey = audit.resourceType === 'instruction' ? 'instructions' : `${audit.resourceType}s`;
            const listedResources = instances[resourceTypeKey] || [];

            if (!listedResources.includes(audit.resourceId)) {
              listedResources.push(audit.resourceId);
              batch.update(instanceRef, {
                [`instances.${resourceTypeKey}`]: listedResources,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });
              batchCount++;
              totalFixed++;

              console.log(`✅ ${audit.resourceType.toUpperCase()} ${audit.resourceId}: ajouté à l'instance ${audit.universInstanceId}`);

              if (batchCount >= MAX_BATCH_SIZE) {
                await commitBatch();
              }
            }
          }
        } catch (error) {
          console.error(`❌ Erreur lors de l'ajout de ${audit.resourceId} à l'instance:`, error.message);
        }
      }
    }
  }

  await commitBatch();

  console.log(`\n✅ ${totalFixed} problème(s) corrigé(s)`);
  return totalFixed;
}

/**
 * Script principal
 */
async function main() {
  const fix = process.argv.includes('--fix');
  
  console.log('🔍 Audit complet des ressources et leur association avec les Univers et instances');
  console.log(`   Mode: ${fix ? 'CORRECTION AUTOMATIQUE' : 'DIAGNOSTIC UNIQUEMENT'}`);
  console.log('');

  try {
    // Auditer tous les types de ressources
    const formsAudit = await auditResourcesByType(FORMS_COLLECTION, 'form');
    const dashboardsAudit = await auditResourcesByType(DASHBOARDS_COLLECTION, 'dashboard');
    const listsAudit = await auditResourcesByType(LISTS_COLLECTION, 'list');
    const instructionsAudit = await auditResourcesByType(INSTRUCTIONS_COLLECTION, 'instruction');
    const reportsAudit = await auditResourcesByType(REPORTS_COLLECTION, 'report');

    // Résumé global
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 RÉSUMÉ GLOBAL`);
    console.log(`${'='.repeat(80)}`);

    const allAudits = [formsAudit, dashboardsAudit, listsAudit, instructionsAudit, reportsAudit];
    
    let grandTotal = 0;
    let grandTotalWithUnivers = 0;
    let grandTotalWithoutUnivers = 0;
    let grandTotalWithInstance = 0;
    let grandTotalWithoutInstance = 0;
    let grandTotalIssues = 0;
    let grandTotalWithIssues = 0;

    console.log(`\n📊 Statistiques par type de ressource:`);
    console.log(`\n${'Type'.padEnd(15)} | Total | Avec Univers | Sans Univers | Avec Instance | Sans Instance | Problèmes`);
    console.log(`${'-'.repeat(100)}`);

    for (const audit of allAudits) {
      grandTotal += audit.total;
      grandTotalWithUnivers += audit.withUnivers;
      grandTotalWithoutUnivers += audit.withoutUnivers;
      grandTotalWithInstance += audit.withInstance;
      grandTotalWithoutInstance += audit.withoutInstance;
      grandTotalIssues += audit.totalIssues;
      grandTotalWithIssues += audit.resourcesWithIssues;

      console.log(
        `${audit.resourceType.padEnd(15)} | ${String(audit.total).padStart(5)} | ${String(audit.withUnivers).padStart(12)} | ${String(audit.withoutUnivers).padStart(12)} | ${String(audit.withInstance).padStart(13)} | ${String(audit.withoutInstance).padStart(13)} | ${String(audit.totalIssues).padStart(9)}`
      );
    }

    console.log(`${'-'.repeat(100)}`);
    console.log(
      `${'TOTAL'.padEnd(15)} | ${String(grandTotal).padStart(5)} | ${String(grandTotalWithUnivers).padStart(12)} | ${String(grandTotalWithoutUnivers).padStart(12)} | ${String(grandTotalWithInstance).padStart(13)} | ${String(grandTotalWithoutInstance).padStart(13)} | ${String(grandTotalIssues).padStart(9)}`
    );

    console.log(`\n📊 Résumé global:`);
    console.log(`   Total de ressources: ${grandTotal}`);
    console.log(`   Ressources avec universId: ${grandTotalWithUnivers} (${((grandTotalWithUnivers / grandTotal) * 100).toFixed(1)}%)`);
    console.log(`   Ressources sans universId: ${grandTotalWithoutUnivers} (${((grandTotalWithoutUnivers / grandTotal) * 100).toFixed(1)}%)`);
    console.log(`   Ressources avec universInstanceId: ${grandTotalWithInstance} (${((grandTotalWithInstance / grandTotal) * 100).toFixed(1)}%)`);
    console.log(`   Ressources sans universInstanceId: ${grandTotalWithoutInstance} (${((grandTotalWithoutInstance / grandTotal) * 100).toFixed(1)}%)`);
    console.log(`   Total de problèmes: ${grandTotalIssues}`);
    console.log(`   Ressources avec problèmes: ${grandTotalWithIssues} (${((grandTotalWithIssues / grandTotal) * 100).toFixed(1)}%)`);

    // Détails sur les ressources sans universInstanceId
    if (grandTotalWithoutInstance > 0) {
      console.log(`\n⚠️  ${grandTotalWithoutInstance} ressource(s) sans universInstanceId:`);
      
      for (const audit of allAudits) {
        const withoutInstance = audit.audits.filter(a => !a.universInstanceId || a.universInstanceId === 'AUCUNE');
        if (withoutInstance.length > 0) {
          console.log(`\n   ${audit.resourceType.toUpperCase()}s (${withoutInstance.length}):`);
          for (const a of withoutInstance.slice(0, 5)) {
            console.log(`      - ${a.resourceId}: Univers=${a.universId || 'AUCUN'}, Instance=${a.universInstanceId || 'AUCUNE'}`);
            if (a.recommendations.length > 0) {
              a.recommendations.forEach(rec => {
                if (typeof rec === 'object' && rec.action === 'UPDATE_INSTANCE_ID') {
                  console.log(`        💡 Recommandation: Mettre à jour avec instanceId=${rec.targetInstanceId}`);
                }
              });
            }
          }
          if (withoutInstance.length > 5) {
            console.log(`      ... et ${withoutInstance.length - 5} autre(s)`);
          }
        }
      }
    }

    if (grandTotalIssues === 0) {
      console.log(`\n✅ Aucun problème détecté !`);
    } else {
      console.log(`\n⚠️  ${grandTotalIssues} problème(s) détecté(s)`);
      if (!fix) {
        console.log(`   Exécutez avec --fix pour corriger automatiquement les problèmes`);
      } else {
        // Corriger les problèmes
        const allAudits = [formsAudit, dashboardsAudit, listsAudit, instructionsAudit, reportsAudit];
        const fixedCount = await fixIssues(allAudits);
        
        if (fixedCount > 0) {
          console.log(`\n✅ ${fixedCount} problème(s) corrigé(s) avec succès`);
        } else {
          console.log(`\n⚠️  Aucun problème n'a pu être corrigé automatiquement`);
        }
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


/**
 * Script de migration : Créer des instances pour les Univers actifs qui n'en ont pas
 * 
 * Ce script détecte tous les Univers actifs (ActiveUnivers) qui n'ont pas d'instance
 * et crée une instance pour chacun, permettant ainsi le tracking des versions.
 * 
 * Usage: node scripts/migrate-active-univers-to-instances.js [--write]
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

// Collection names
const ACTIVE_UNIVERS_COLLECTION = 'activeUnivers';
const UNIVERS_COLLECTION = 'univers';
const INSTANCES_COLLECTION = 'universInstances';
const USERS_COLLECTION = 'users';

/**
 * Vérifier si les ressources existent pour un Univers
 */
async function checkIfResourcesExist(universId, agencyId) {
  try {
    // Vérifier si des formulaires existent pour ce Univers et cette agence
    const formsSnapshot = await db.collection('forms')
      .where('agencyId', '==', agencyId)
      .where('universId', '==', universId)
      .limit(1)
      .get();
    
    return !formsSnapshot.empty;
  } catch (error) {
    console.error(`Erreur lors de la vérification des ressources pour Univers ${universId}:`, error);
    return false;
  }
}

/**
 * Créer une instance pour un Univers
 */
async function createInstanceForUnivers(univers, directorId, agencyId) {
  try {
    console.log(`   📦 Création d'une instance pour Univers ${univers.id}...`);
    
    // 1. Générer un ID d'instance
    const instanceId = `instance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 2. Récupérer les ressources existantes (forms, dashboards, lists, reports)
    const formsSnapshot = await db.collection('forms')
      .where('agencyId', '==', agencyId)
      .where('universId', '==', univers.id)
      .get();
    
    const dashboardsSnapshot = await db.collection('dashboards')
      .where('agencyId', '==', agencyId)
      .where('universId', '==', univers.id)
      .get();
    
    const listsSnapshot = await db.collection('lists')
      .where('agencyId', '==', agencyId)
      .where('universId', '==', univers.id)
      .get();
    
    const reportsSnapshot = await db.collection('reports')
      .where('agencyId', '==', agencyId)
      .where('universId', '==', univers.id)
      .get();
    
    const formIds = formsSnapshot.docs.map(doc => doc.id);
    const dashboardIds = dashboardsSnapshot.docs.map(doc => doc.id);
    const listIds = listsSnapshot.docs.map(doc => doc.id);
    const reportIds = reportsSnapshot.docs.map(doc => doc.id);
    
    // 3. Déterminer la version actuelle du Univers
    const currentVersion = univers.metadata?.version || 1;
    
    // 4. Créer l'instance
    const instanceData = {
      universId: univers.id,
      universVersion: currentVersion,
      userId: directorId,
      agencyId: agencyId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      isActive: true, // L'instance sera active car le Univers est actif
      instances: {
        forms: formIds,
        dashboards: dashboardIds,
        lists: listIds,
        reports: reportIds
      },
      metadata: {
        universName: univers.metadata?.name || 'Univers',
        universVersion: currentVersion,
        isFromMarketplace: univers.ownership?.isMarketplaceTemplate || false
      },
      updateAvailable: false
    };
    
    await db.collection(INSTANCES_COLLECTION).doc(instanceId).set(instanceData);
    
    console.log(`   ✅ Instance créée: ${instanceId}`);
    console.log(`      - Formulaires: ${formIds.length}`);
    console.log(`      - Tableaux de bord: ${dashboardIds.length}`);
    console.log(`      - Listes: ${listIds.length}`);
    console.log(`      - Rapports: ${reportIds.length}`);
    console.log(`      - Version: v${currentVersion}`);
    
    return instanceId;
  } catch (error) {
    console.error(`   ❌ Erreur lors de la création de l'instance:`, error);
    throw error;
  }
}

/**
 * Migration principale
 */
async function migrate() {
  const write = process.argv.includes('--write');
  
  if (!write) {
    console.log('🔍 Mode DRY-RUN : Aucune modification ne sera effectuée');
    console.log('   Ajoutez --write pour exécuter la migration\n');
  } else {
    console.log('✍️  Mode WRITE : Les modifications seront effectuées\n');
  }
  
  try {
    // 1. Récupérer tous les ActiveUnivers
    const activeUniversSnapshot = await db.collection(ACTIVE_UNIVERS_COLLECTION).get();
    
    if (activeUniversSnapshot.empty) {
      console.log('ℹ️  Aucun Univers actif trouvé');
      return;
    }
    
    console.log(`📋 ${activeUniversSnapshot.size} Univers actif(s) trouvé(s)\n`);
    
    const stats = {
      total: 0,
      migrated: 0,
      skipped: 0,
      errors: 0
    };
    
    // 2. Pour chaque ActiveUnivers, vérifier s'il a une instance
    for (const activeDoc of activeUniversSnapshot.docs) {
      const activeData = activeDoc.data();
      const directorId = activeDoc.id; // L'ID du document est le directorId
      const universId = activeData.activeUniversId;
      const activeInstanceId = activeData.activeInstanceId;
      
      stats.total++;
      
      console.log(`\n${'═'.repeat(80)}`);
      console.log(`📋 Univers actif #${stats.total}`);
      console.log(`   Directeur: ${directorId}`);
      console.log(`   Univers ID: ${universId}`);
      console.log(`   Instance ID actuelle: ${activeInstanceId || 'AUCUNE'}`);
      
      // Si une instance existe déjà, passer
      if (activeInstanceId) {
        console.log(`   ✅ Instance déjà existante, pas de migration nécessaire`);
        stats.skipped++;
        continue;
      }
      
      // 3. Récupérer le Univers
      const universDoc = await db.collection(UNIVERS_COLLECTION).doc(universId).get();
      if (!universDoc.exists) {
        console.log(`   ⚠️  Univers ${universId} non trouvé, ignoré`);
        stats.skipped++;
        continue;
      }
      
      const univers = { id: universDoc.id, ...universDoc.data() };
      console.log(`   Univers: ${univers.metadata?.name || 'Sans nom'}`);
      console.log(`   Marketplace: ${univers.ownership?.isMarketplaceTemplate ? 'Oui' : 'Non'}`);
      console.log(`   Propriétaire: ${univers.ownership?.createdBy || 'Inconnu'}`);
      
      // 4. Vérifier que c'est le propriétaire
      const isOwner = univers.ownership?.createdBy === directorId;
      if (!isOwner) {
        console.log(`   ⚠️  Le directeur n'est pas le propriétaire, ignoré (cas d'achat marketplace)`);
        stats.skipped++;
        continue;
      }
      
      // 5. Récupérer les informations du directeur
      const directorDoc = await db.collection(USERS_COLLECTION).doc(directorId).get();
      if (!directorDoc.exists) {
        console.log(`   ⚠️  Directeur ${directorId} non trouvé, ignoré`);
        stats.skipped++;
        continue;
      }
      
      const directorData = directorDoc.data();
      const agencyId = directorData.agencyId;
      
      if (!agencyId) {
        console.log(`   ⚠️  Directeur sans agencyId, ignoré`);
        stats.skipped++;
        continue;
      }
      
      console.log(`   Agence: ${agencyId}`);
      
      // 6. Vérifier si une instance existe déjà pour ce Univers et ce directeur
      const existingInstancesSnapshot = await db.collection(INSTANCES_COLLECTION)
        .where('universId', '==', universId)
        .where('userId', '==', directorId)
        .where('agencyId', '==', agencyId)
        .limit(1)
        .get();
      
      if (!existingInstancesSnapshot.empty) {
        const existingInstance = existingInstancesSnapshot.docs[0];
        console.log(`   ✅ Instance existante trouvée: ${existingInstance.id}`);
        console.log(`   📝 Mise à jour de ActiveUnivers avec l'instance existante...`);
        
        if (write) {
          await db.collection(ACTIVE_UNIVERS_COLLECTION).doc(directorId).update({
            activeInstanceId: existingInstance.id
          });
          console.log(`   ✅ ActiveUnivers mis à jour`);
        } else {
          console.log(`   [DRY-RUN] ActiveUnivers serait mis à jour avec instanceId: ${existingInstance.id}`);
        }
        
        stats.migrated++;
        continue;
      }
      
      // 7. Créer une nouvelle instance
      console.log(`   📦 Création d'une nouvelle instance...`);
      
      if (write) {
        try {
          const instanceId = await createInstanceForUnivers(univers, directorId, agencyId);
          
          // 8. Mettre à jour ActiveUnivers avec l'instanceId
          console.log(`   📝 Mise à jour de ActiveUnivers avec la nouvelle instance...`);
          await db.collection(ACTIVE_UNIVERS_COLLECTION).doc(directorId).update({
            activeInstanceId: instanceId
          });
          
          console.log(`   ✅ Migration réussie pour Univers ${universId}`);
          stats.migrated++;
        } catch (error) {
          console.error(`   ❌ Erreur lors de la migration:`, error);
          stats.errors++;
        }
      } else {
        console.log(`   [DRY-RUN] Instance serait créée pour Univers ${universId}`);
        stats.migrated++;
      }
    }
    
    // Résumé
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`📊 RÉSUMÉ DE LA MIGRATION`);
    console.log(`${'═'.repeat(80)}`);
    console.log(`Total de Univers actifs: ${stats.total}`);
    console.log(`✅ Migrés: ${stats.migrated}`);
    console.log(`⏭️  Ignorés (déjà avec instance): ${stats.skipped}`);
    console.log(`❌ Erreurs: ${stats.errors}`);
    
    if (!write) {
      console.log(`\n💡 Pour exécuter la migration, relancez avec --write`);
    } else {
      console.log(`\n✅ Migration terminée !`);
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    process.exit(1);
  }
}

// Exécuter la migration
migrate()
  .then(() => {
    console.log('\n✅ Script terminé');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });


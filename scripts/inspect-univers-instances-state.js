/**
 * Script d'inspection : Analyser l'état actuel des Univers et leurs instances
 * 
 * Ce script parcourt tous les Univers et leurs instances pour fournir un résumé détaillé
 * de l'état actuel de la base de données.
 * 
 * Usage: node scripts/inspect-univers-instances-state.js
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
const UNIVERS_COLLECTION = 'univers';
const INSTANCES_COLLECTION = 'universInstances';
const ACTIVE_UNIVERS_COLLECTION = 'activeUnivers';
const USERS_COLLECTION = 'users';

/**
 * Récupérer le nom d'un utilisateur
 */
async function getUserName(userId) {
  try {
    const userDoc = await db.collection(USERS_COLLECTION).doc(userId).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      return userData.name || userData.email || userId;
    }
    return userId;
  } catch (error) {
    return userId;
  }
}

/**
 * Inspection principale
 */
async function inspect() {
  try {
    console.log('🔍 Inspection de l\'état des Univers et Instances');
    console.log('='.repeat(80));
    console.log('');

    // 1. Récupérer tous les Univers
    const universSnapshot = await db.collection(UNIVERS_COLLECTION).get();
    console.log(`📋 ${universSnapshot.size} Univers trouvé(s)\n`);

    // 2. Récupérer tous les ActiveUnivers
    const activeUniversSnapshot = await db.collection(ACTIVE_UNIVERS_COLLECTION).get();
    const activeUniversMap = new Map();
    activeUniversSnapshot.forEach(doc => {
      const data = doc.data();
      activeUniversMap.set(doc.id, data); // doc.id = directorId
    });
    console.log(`📋 ${activeUniversSnapshot.size} ActiveUnivers trouvé(s)\n`);

    // 3. Récupérer toutes les instances
    const instancesSnapshot = await db.collection(INSTANCES_COLLECTION).get();
    const instancesByUnivers = new Map();
    instancesSnapshot.forEach(doc => {
      const data = doc.data();
      const universId = data.universId;
      if (!instancesByUnivers.has(universId)) {
        instancesByUnivers.set(universId, []);
      }
      instancesByUnivers.get(universId).push({ id: doc.id, ...data });
    });
    console.log(`📋 ${instancesSnapshot.size} Instance(s) trouvée(s)\n`);

    // 4. Analyser par créateur
    const byCreator = new Map();
    const stats = {
      total: 0,
      marketplace: 0,
      private: 0,
      active: 0,
      inactive: 0,
      withInstances: 0,
      withoutInstances: 0,
      activeWithInstance: 0,
      activeWithoutInstance: 0,
      marketplaceWithInstance: 0,
      marketplaceWithoutInstance: 0,
      privateWithInstance: 0,
      privateWithoutInstance: 0
    };

    for (const universDoc of universSnapshot.docs) {
      const univers = { id: universDoc.id, ...universDoc.data() };
      const creatorId = univers.ownership?.createdBy || 'unknown';
      const isMarketplace = univers.ownership?.isMarketplaceTemplate === true;
      const version = univers.metadata?.version || 1;
      const isActive = univers.metadata?.isActive === true;

      // Trouver l'ActiveUnivers pour ce Univers
      let activeUnivers = null;
      for (const [directorId, activeData] of activeUniversMap.entries()) {
        if (activeData.activeUniversId === univers.id) {
          activeUnivers = { directorId, ...activeData };
          break;
        }
      }

      const instances = instancesByUnivers.get(univers.id) || [];
      const hasInstances = instances.length > 0;
      const activeInstanceId = activeUnivers?.activeInstanceId;

      if (!byCreator.has(creatorId)) {
        byCreator.set(creatorId, {
          creatorName: null,
          universes: [],
          stats: {
            total: 0,
            marketplace: 0,
            private: 0,
            active: 0,
            inactive: 0,
            withInstances: 0,
            withoutInstances: 0,
            activeWithInstance: 0,
            activeWithoutInstance: 0
          }
        });
      }

      const creatorData = byCreator.get(creatorId);
      creatorData.universes.push({
        id: univers.id,
        name: univers.metadata?.name || 'Sans nom',
        isMarketplace,
        version,
        isActive,
        activeInstanceId,
        instancesCount: instances.length,
        instances: instances.map(inst => ({
          id: inst.id,
          userId: inst.userId,
          agencyId: inst.agencyId,
          universVersion: inst.universVersion,
          isActive: inst.isActive,
          updateAvailable: inst.updateAvailable || false
        }))
      });

      // Stats globales
      stats.total++;
      if (isMarketplace) stats.marketplace++;
      else stats.private++;
      if (isActive) stats.active++;
      else stats.inactive++;
      if (hasInstances) stats.withInstances++;
      else stats.withoutInstances++;

      // Stats par créateur
      creatorData.stats.total++;
      if (isMarketplace) creatorData.stats.marketplace++;
      else creatorData.stats.private++;
      if (isActive) {
        creatorData.stats.active++;
        if (activeInstanceId) {
          stats.activeWithInstance++;
          creatorData.stats.activeWithInstance++;
        } else {
          stats.activeWithoutInstance++;
          creatorData.stats.activeWithoutInstance++;
        }
      } else {
        creatorData.stats.inactive++;
      }
      if (hasInstances) {
        creatorData.stats.withInstances++;
        if (isMarketplace) stats.marketplaceWithInstance++;
        else stats.privateWithInstance++;
      } else {
        creatorData.stats.withoutInstances++;
        if (isMarketplace) stats.marketplaceWithoutInstance++;
        else stats.privateWithoutInstance++;
      }
    }

    // Récupérer les noms des créateurs
    for (const [creatorId, creatorData] of byCreator.entries()) {
      creatorData.creatorName = await getUserName(creatorId);
    }

    // 5. Afficher le résumé global
    console.log('═'.repeat(80));
    console.log('📊 RÉSUMÉ GLOBAL');
    console.log('═'.repeat(80));
    console.log(`Total de Univers: ${stats.total}`);
    console.log(`  - Marketplace: ${stats.marketplace}`);
    console.log(`  - Privé: ${stats.private}`);
    console.log(`  - Actif: ${stats.active}`);
    console.log(`  - Inactif: ${stats.inactive}`);
    console.log(`  - Avec instance(s): ${stats.withInstances}`);
    console.log(`  - Sans instance: ${stats.withoutInstances}`);
    console.log(`  - Actif avec instance: ${stats.activeWithInstance}`);
    console.log(`  - Actif sans instance: ${stats.activeWithoutInstance}`);
    console.log(`  - Marketplace avec instance: ${stats.marketplaceWithInstance}`);
    console.log(`  - Marketplace sans instance: ${stats.marketplaceWithoutInstance}`);
    console.log(`  - Privé avec instance: ${stats.privateWithInstance}`);
    console.log(`  - Privé sans instance: ${stats.privateWithoutInstance}`);
    console.log('');

    // 6. Afficher le résumé par créateur
    console.log('═'.repeat(80));
    console.log('📊 RÉSUMÉ PAR CRÉATEUR');
    console.log('═'.repeat(80));
    console.log('');

    for (const [creatorId, creatorData] of byCreator.entries()) {
      console.log(`👤 ${creatorData.creatorName} (${creatorId})`);
      console.log(`   Total: ${creatorData.stats.total}`);
      console.log(`   - Marketplace: ${creatorData.stats.marketplace}`);
      console.log(`   - Privé: ${creatorData.stats.private}`);
      console.log(`   - Actif: ${creatorData.stats.active}`);
      console.log(`   - Inactif: ${creatorData.stats.inactive}`);
      console.log(`   - Avec instance(s): ${creatorData.stats.withInstances}`);
      console.log(`   - Sans instance: ${creatorData.stats.withoutInstances}`);
      console.log(`   - Actif avec instance: ${creatorData.stats.activeWithInstance}`);
      console.log(`   - Actif sans instance: ${creatorData.stats.activeWithoutInstance}`);
      console.log('');

      // Détails des Univers
      for (const univers of creatorData.universes) {
        console.log(`   📦 ${univers.name} (${univers.id})`);
        console.log(`      Type: ${univers.isMarketplace ? 'Marketplace' : 'Privé'}`);
        console.log(`      Version: v${univers.version}`);
        console.log(`      État: ${univers.isActive ? 'Actif' : 'Inactif'}`);
        console.log(`      Instance(s): ${univers.instancesCount}`);
        
        if (univers.activeInstanceId) {
          console.log(`      ActiveInstanceId: ${univers.activeInstanceId}`);
        } else if (univers.isActive) {
          console.log(`      ⚠️  Actif mais sans activeInstanceId`);
        }

        if (univers.instances.length > 0) {
          console.log(`      Détails des instances:`);
          for (const inst of univers.instances) {
            const instUserName = await getUserName(inst.userId);
            console.log(`        - ${inst.id}`);
            console.log(`          Utilisateur: ${instUserName} (${inst.userId})`);
            console.log(`          Agence: ${inst.agencyId}`);
            console.log(`          Version: v${inst.universVersion}`);
            console.log(`          Actif: ${inst.isActive ? 'Oui' : 'Non'}`);
            console.log(`          Mise à jour disponible: ${inst.updateAvailable ? 'Oui' : 'Non'}`);
          }
        }
        console.log('');
      }
    }

    // 7. Analyser les problèmes potentiels
    console.log('═'.repeat(80));
    console.log('⚠️  PROBLÈMES POTENTIELS');
    console.log('═'.repeat(80));
    console.log('');

    let problemCount = 0;

    // Univers privés actifs avec instance (ne devraient pas avoir d'instance)
    const privateActiveWithInstance = [];
    for (const [creatorId, creatorData] of byCreator.entries()) {
      for (const univers of creatorData.universes) {
        if (!univers.isMarketplace && univers.isActive && univers.instancesCount > 0) {
          privateActiveWithInstance.push({
            creator: creatorData.creatorName,
            univers: univers.name,
            universId: univers.id,
            instancesCount: univers.instancesCount
          });
          problemCount++;
        }
      }
    }

    if (privateActiveWithInstance.length > 0) {
      console.log(`❌ Univers privés actifs avec instance(s) (${privateActiveWithInstance.length}):`);
      for (const item of privateActiveWithInstance) {
        console.log(`   - ${item.univers} (${item.universId})`);
        console.log(`     Créateur: ${item.creator}`);
        console.log(`     Instance(s): ${item.instancesCount}`);
      }
      console.log('');
    }

    // Univers marketplace actifs sans instance (devraient avoir une instance)
    const marketplaceActiveWithoutInstance = [];
    for (const [creatorId, creatorData] of byCreator.entries()) {
      for (const univers of creatorData.universes) {
        if (univers.isMarketplace && univers.isActive && univers.instancesCount === 0) {
          marketplaceActiveWithoutInstance.push({
            creator: creatorData.creatorName,
            univers: univers.name,
            universId: univers.id
          });
          problemCount++;
        }
      }
    }

    if (marketplaceActiveWithoutInstance.length > 0) {
      console.log(`❌ Univers marketplace actifs sans instance (${marketplaceActiveWithoutInstance.length}):`);
      for (const item of marketplaceActiveWithoutInstance) {
        console.log(`   - ${item.univers} (${item.universId})`);
        console.log(`     Créateur: ${item.creator}`);
      }
      console.log('');
    }

    // Univers actifs sans activeInstanceId
    const activeWithoutActiveInstanceId = [];
    for (const [creatorId, creatorData] of byCreator.entries()) {
      for (const univers of creatorData.universes) {
        if (univers.isActive && !univers.activeInstanceId) {
          activeWithoutActiveInstanceId.push({
            creator: creatorData.creatorName,
            univers: univers.name,
            universId: univers.id,
            isMarketplace: univers.isMarketplace
          });
          problemCount++;
        }
      }
    }

    if (activeWithoutActiveInstanceId.length > 0) {
      console.log(`⚠️  Univers actifs sans activeInstanceId (${activeWithoutActiveInstanceId.length}):`);
      for (const item of activeWithoutActiveInstanceId) {
        console.log(`   - ${item.univers} (${item.universId})`);
        console.log(`     Créateur: ${item.creator}`);
        console.log(`     Type: ${item.isMarketplace ? 'Marketplace' : 'Privé'}`);
      }
      console.log('');
    }

    if (problemCount === 0) {
      console.log('✅ Aucun problème détecté !');
    }

    console.log('');
    console.log('✅ Inspection terminée !');

  } catch (error) {
    console.error('❌ Erreur lors de l\'inspection:', error);
    process.exit(1);
  }
}

// Exécuter l'inspection
inspect()
  .then(() => {
    console.log('\n✅ Script terminé');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });


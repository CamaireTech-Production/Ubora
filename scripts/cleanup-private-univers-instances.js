/**
 * Script de nettoyage : Supprimer les instances créées par erreur pour les Univers privés
 * 
 * Ce script identifie et supprime les instances créées pour les Univers privés actifs,
 * car les Univers privés n'ont pas besoin d'instance pour le propriétaire.
 * 
 * Usage: node scripts/cleanup-private-univers-instances.js [--write]
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
 * Nettoyage principal
 */
async function cleanup() {
  const write = process.argv.includes('--write');
  
  if (!write) {
    console.log('🔍 Mode DRY-RUN : Aucune modification ne sera effectuée');
    console.log('   Ajoutez --write pour exécuter le nettoyage\n');
  } else {
    console.log('✍️  Mode WRITE : Les modifications seront effectuées\n');
  }
  
  try {
    console.log('🧹 Nettoyage des instances des Univers privés');
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
      activeUniversMap.set(doc.id, { directorId: doc.id, ...data });
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

    // 4. Identifier les Univers privés actifs avec instance(s)
    const privateUniversToClean = [];
    
    for (const universDoc of universSnapshot.docs) {
      const univers = { id: universDoc.id, ...universDoc.data() };
      const isMarketplace = univers.ownership?.isMarketplaceTemplate === true;
      const isActive = univers.metadata?.isActive === true;
      const creatorId = univers.ownership?.createdBy || 'unknown';

      // Ignorer les Univers marketplace
      if (isMarketplace) {
        continue;
      }

      // Ignorer les Univers inactifs
      if (!isActive) {
        continue;
      }

      // Trouver l'ActiveUnivers pour ce Univers
      let activeUnivers = null;
      for (const [directorId, activeData] of activeUniversMap.entries()) {
        if (activeData.activeUniversId === univers.id) {
          activeUnivers = activeData;
          break;
        }
      }

      // Vérifier si ce Univers a des instances
      const instances = instancesByUnivers.get(univers.id) || [];
      if (instances.length === 0) {
        continue; // Pas d'instance à nettoyer
      }

      // Vérifier si le directeur est le propriétaire (devrait être le cas pour les Univers privés)
      const isOwner = creatorId === activeUnivers?.directorId;
      if (!isOwner && activeUnivers) {
        console.log(`⚠️  Univers privé ${univers.id} activé par un non-propriétaire, ignoré`);
        continue;
      }

      privateUniversToClean.push({
        univers,
        activeUnivers,
        instances,
        creatorId
      });
    }

    console.log(`📋 ${privateUniversToClean.length} Univers privé(s) actif(s) avec instance(s) à nettoyer\n`);

    if (privateUniversToClean.length === 0) {
      console.log('✅ Aucun Univers privé avec instance à nettoyer');
      return;
    }

    // 5. Afficher les détails et nettoyer
    const stats = {
      total: 0,
      instancesDeleted: 0,
      activeUniversUpdated: 0,
      errors: 0
    };

    for (const item of privateUniversToClean) {
      stats.total++;
      const { univers, activeUnivers, instances, creatorId } = item;
      const creatorName = await getUserName(creatorId);
      
      console.log(`${'═'.repeat(80)}`);
      console.log(`📦 Univers: ${univers.metadata?.name || 'Sans nom'} (${univers.id})`);
      console.log(`   Créateur: ${creatorName} (${creatorId})`);
      console.log(`   Version: v${univers.metadata?.version || 1}`);
      console.log(`   Instance(s) à supprimer: ${instances.length}`);
      
      if (activeUnivers) {
        console.log(`   ActiveUnivers: ${activeUnivers.directorId}`);
        console.log(`   ActiveInstanceId actuel: ${activeUnivers.activeInstanceId || 'AUCUN'}`);
      }

      // Supprimer les instances
      for (const instance of instances) {
        const instanceUserName = await getUserName(instance.userId);
        console.log(`   📦 Instance: ${instance.id}`);
        console.log(`      Utilisateur: ${instanceUserName} (${instance.userId})`);
        console.log(`      Agence: ${instance.agencyId}`);
        console.log(`      Version: v${instance.universVersion}`);
        
        if (write) {
          try {
            await db.collection(INSTANCES_COLLECTION).doc(instance.id).delete();
            console.log(`      ✅ Instance supprimée`);
            stats.instancesDeleted++;
          } catch (error) {
            console.error(`      ❌ Erreur lors de la suppression:`, error);
            stats.errors++;
          }
        } else {
          console.log(`      [DRY-RUN] Instance serait supprimée`);
          stats.instancesDeleted++;
        }
      }

      // Mettre à jour ActiveUnivers pour retirer activeInstanceId
      if (activeUnivers && activeUnivers.activeInstanceId) {
        console.log(`   📝 Mise à jour de ActiveUnivers...`);
        
        if (write) {
          try {
            await db.collection(ACTIVE_UNIVERS_COLLECTION).doc(activeUnivers.directorId).update({
              activeInstanceId: admin.firestore.FieldValue.delete()
            });
            console.log(`      ✅ ActiveInstanceId retiré de ActiveUnivers`);
            stats.activeUniversUpdated++;
          } catch (error) {
            console.error(`      ❌ Erreur lors de la mise à jour:`, error);
            stats.errors++;
          }
        } else {
          console.log(`      [DRY-RUN] ActiveInstanceId serait retiré de ActiveUnivers`);
          stats.activeUniversUpdated++;
        }
      } else if (activeUnivers && !activeUnivers.activeInstanceId) {
        console.log(`   ℹ️  ActiveUnivers sans activeInstanceId, pas de mise à jour nécessaire`);
      } else {
        console.log(`   ℹ️  Aucun ActiveUnivers trouvé pour ce Univers`);
      }

      console.log('');
    }

    // Résumé
    console.log(`${'═'.repeat(80)}`);
    console.log(`📊 RÉSUMÉ DU NETTOYAGE`);
    console.log(`${'═'.repeat(80)}`);
    console.log(`Total de Univers privés traités: ${stats.total}`);
    console.log(`✅ Instances supprimées: ${stats.instancesDeleted}`);
    console.log(`✅ ActiveUnivers mis à jour: ${stats.activeUniversUpdated}`);
    console.log(`❌ Erreurs: ${stats.errors}`);
    
    if (!write) {
      console.log(`\n💡 Pour exécuter le nettoyage, relancez avec --write`);
    } else {
      console.log(`\n✅ Nettoyage terminé !`);
    }

  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error);
    process.exit(1);
  }
}

// Exécuter le nettoyage
cleanup()
  .then(() => {
    console.log('\n✅ Script terminé');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });


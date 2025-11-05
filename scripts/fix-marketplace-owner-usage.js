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
 * Check if resources exist for a Univers and owner
 */
async function checkResourcesExist(universId, ownerId, agencyId) {
  try {
    const formsSnapshot = await db.collection('forms')
      .where('universId', '==', universId)
      .where('createdBy', '==', ownerId)
      .limit(1)
      .get();
    
    return !formsSnapshot.empty;
  } catch (error) {
    console.warn(`⚠️ Erreur lors de la vérification des ressources pour Univers ${universId}:`, error.message);
    return false;
  }
}

/**
 * Check if owner has an instance for this Univers
 */
async function checkOwnerHasInstance(universId, ownerId, agencyId) {
  try {
    const instancesSnapshot = await db.collection('universInstances')
      .where('universId', '==', universId)
      .where('userId', '==', ownerId)
      .where('agencyId', '==', agencyId)
      .limit(1)
      .get();
    
    return !instancesSnapshot.empty;
  } catch (error) {
    console.warn(`⚠️ Erreur lors de la vérification de l'instance pour Univers ${universId}:`, error.message);
    return false;
  }
}

/**
 * Get agency ID for an owner
 */
async function getAgencyIdForOwner(ownerId) {
  try {
    const userDoc = await db.collection('users').doc(ownerId).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      return userData.agencyId || null;
    }
    return null;
  } catch (error) {
    console.warn(`⚠️ Erreur lors de la récupération de l'agence pour l'utilisateur ${ownerId}:`, error.message);
    return null;
  }
}

/**
 * Update usage count for a Univers
 */
async function updateUsageCount(universId, write = false) {
  try {
    const universRef = db.collection('univers').doc(universId);
    const universDoc = await universRef.get();
    
    if (!universDoc.exists) {
      return false;
    }
    
    const universData = universDoc.data();
    const currentUsage = universData.usage?.totalUsages || 0;
    const newUsage = currentUsage + 1;
    
    if (write) {
      await universRef.update({
        'usage.totalUsages': newUsage,
        'usage.lastUsedAt': admin.firestore.Timestamp.now()
      });
      console.log(`   ✅ Usage mis à jour: ${currentUsage} → ${newUsage}`);
      return true;
    } else {
      console.log(`   📊 Usage à mettre à jour: ${currentUsage} → ${newUsage}`);
      return true;
    }
  } catch (error) {
    console.error(`❌ Erreur lors de la mise à jour du usage pour Univers ${universId}:`, error);
    return false;
  }
}

/**
 * Main migration function
 */
async function main() {
  const write = process.argv.includes('--write');
  
  if (!write) {
    console.log('🔍 Mode DRY-RUN: Aucune modification ne sera effectuée');
    console.log('   Ajoutez --write pour appliquer les modifications\n');
  } else {
    console.log('⚠️  Mode WRITE: Les modifications seront appliquées à la base de données\n');
  }
  
  const stats = {
    total: 0,
    checked: 0,
    fixed: 0,
    skipped: 0,
    errors: 0
  };
  
  try {
    console.log('📦 Récupération de tous les Univers marketplace...\n');
    
    // Get all marketplace Universes
    const universSnapshot = await db.collection('univers')
      .where('ownership.isMarketplaceTemplate', '==', true)
      .get();
    
    console.log(`✅ ${universSnapshot.size} Univers(s) marketplace trouvé(s)\n`);
    console.log('═'.repeat(100));
    
    for (const universDoc of universSnapshot.docs) {
      const universId = universDoc.id;
      const universData = universDoc.data();
      const ownerId = universData.ownership?.createdBy;
      const isMarketplace = universData.ownership?.isMarketplaceTemplate === true;
      const currentUsage = universData.usage?.totalUsages || 0;
      
      stats.total++;
      
      if (!ownerId) {
        console.log(`\n⚠️  Univers ${universId} n'a pas de propriétaire`);
        stats.skipped++;
        continue;
      }
      
      if (!isMarketplace) {
        continue; // Skip non-marketplace Universes
      }
      
      console.log(`\n📋 Univers: ${universData.metadata?.name || 'Sans nom'} (${universId})`);
      console.log(`   Propriétaire: ${ownerId}`);
      console.log(`   Usage actuel: ${currentUsage}`);
      
      // Get owner's agency ID
      const agencyId = await getAgencyIdForOwner(ownerId);
      if (!agencyId) {
        console.log(`   ⚠️  Impossible de trouver l'agence du propriétaire`);
        stats.skipped++;
        continue;
      }
      
      // Check if owner has resources instantiated
      const hasResources = await checkResourcesExist(universId, ownerId, agencyId);
      if (!hasResources) {
        console.log(`   ℹ️  Aucune ressource instanciée par le propriétaire`);
        stats.skipped++;
        continue;
      }
      console.log(`   ✅ Ressources trouvées pour le propriétaire`);
      
      // Check if owner has an instance
      const hasInstance = await checkOwnerHasInstance(universId, ownerId, agencyId);
      if (hasInstance) {
        console.log(`   ℹ️  Instance trouvée - usage devrait déjà être compté`);
        stats.skipped++;
        continue;
      }
      console.log(`   ✅ Aucune instance (propriétaire utilise directement)`);
      
      // Check if usage is 0
      if (currentUsage > 0) {
        console.log(`   ℹ️  Usage déjà compté (${currentUsage})`);
        stats.skipped++;
        continue;
      }
      
      // This is the case we need to fix!
      console.log(`   🔧 Cas à corriger: Marketplace Univers du propriétaire avec ressources mais usage = 0`);
      stats.checked++;
      
      const updated = await updateUsageCount(universId, write);
      if (updated) {
        stats.fixed++;
      } else {
        stats.errors++;
      }
      
      console.log('─'.repeat(100));
    }
    
    // Summary
    console.log('\n' + '═'.repeat(100));
    console.log('📊 RÉSUMÉ DE LA MIGRATION:');
    console.log('═'.repeat(100));
    console.log(`   Total Univers marketplace: ${stats.total}`);
    console.log(`   Cas à corriger trouvés: ${stats.checked}`);
    console.log(`   - Corrigés: ${stats.fixed}`);
    console.log(`   - Ignorés: ${stats.skipped}`);
    console.log(`   - Erreurs: ${stats.errors}`);
    console.log('═'.repeat(100));
    
    if (!write) {
      console.log('\n💡 Pour appliquer les modifications, exécutez:');
      console.log('   node scripts/fix-marketplace-owner-usage.js --write\n');
    } else {
      console.log('\n✅ Migration terminée avec succès!\n');
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    process.exit(1);
  }
}

// Run migration
main().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});


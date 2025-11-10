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
 * Count instances for a marketplace Univers
 * (instances in universInstances collection)
 */
async function countMarketplaceInstances(universId) {
  try {
    const instancesSnapshot = await db.collection('universInstances')
      .where('universId', '==', universId)
      .get();
    return instancesSnapshot.size;
  } catch (error) {
    console.error(`❌ Erreur lors du comptage des instances pour Univers ${universId}:`, error);
    return 0;
  }
}

/**
 * Count unique agencies that have instantiated resources for a private Univers
 * (count distinct agencies that have forms with this universId)
 */
async function countPrivateUniversUsages(universId) {
  try {
    // Get all forms with this universId to find unique agencies
    const formsSnapshot = await db.collection('forms')
      .where('universId', '==', universId)
      .get();
    
    // Extract unique agencyIds
    const agencyIds = new Set();
    formsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.agencyId) {
        agencyIds.add(data.agencyId);
      }
    });
    
    return agencyIds.size;
  } catch (error) {
    console.error(`❌ Erreur lors du comptage des utilisations pour Univers privé ${universId}:`, error);
    return 0;
  }
}

/**
 * Get the latest usage timestamp from instances or resources
 */
async function getLatestUsageTimestamp(universId, isMarketplace) {
  try {
    if (isMarketplace) {
      // For marketplace: get latest instance creation date
      try {
        const instancesSnapshot = await db.collection('universInstances')
          .where('universId', '==', universId)
          .orderBy('createdAt', 'desc')
          .limit(1)
          .get();
        
        if (!instancesSnapshot.empty) {
          const instanceData = instancesSnapshot.docs[0].data();
          if (instanceData.createdAt) {
            return instanceData.createdAt.toDate();
          }
        }
      } catch (orderError) {
        // If orderBy fails (no index), try without ordering
        const instancesSnapshot = await db.collection('universInstances')
          .where('universId', '==', universId)
          .limit(1)
          .get();
        
        if (!instancesSnapshot.empty) {
          const instanceData = instancesSnapshot.docs[0].data();
          if (instanceData.createdAt) {
            return instanceData.createdAt.toDate();
          }
        }
      }
    } else {
      // For private: get any form creation date (without ordering to avoid index requirement)
      // We'll get the first form found, which should be close enough
      const formsSnapshot = await db.collection('forms')
        .where('universId', '==', universId)
        .limit(1)
        .get();
      
      if (!formsSnapshot.empty) {
        const formData = formsSnapshot.docs[0].data();
        if (formData.createdAt) {
          // Handle both Firestore Timestamp and Date objects
          if (formData.createdAt.toDate) {
            return formData.createdAt.toDate();
          }
          if (formData.createdAt instanceof Date) {
            return formData.createdAt;
          }
          if (formData.createdAt.seconds) {
            return new Date(formData.createdAt.seconds * 1000);
          }
        }
      }
    }
    return null;
  } catch (error) {
    // Silently fail - timestamp is optional
    return null;
  }
}

/**
 * Update usage count for a Univers
 */
async function updateUniversUsage(universId, totalUsages, lastUsedAt, write = false) {
  try {
    const universRef = db.collection('univers').doc(universId);
    const universDoc = await universRef.get();
    
    if (!universDoc.exists) {
      console.warn(`⚠️ Univers ${universId} n'existe pas`);
      return false;
    }
    
    const currentData = universDoc.data();
    const currentUsage = currentData.usage?.totalUsages || 0;
    
    if (write) {
      const updateData = {
        'usage.totalUsages': totalUsages,
      };
      
      if (lastUsedAt) {
        updateData['usage.lastUsedAt'] = admin.firestore.Timestamp.fromDate(lastUsedAt);
      }
      
      await universRef.update(updateData);
      console.log(`   ✅ Mis à jour: ${currentUsage} → ${totalUsages} utilisations`);
    } else {
      console.log(`   📊 À mettre à jour: ${currentUsage} → ${totalUsages} utilisations`);
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Erreur lors de la mise à jour du Univers ${universId}:`, error);
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
    marketplace: 0,
    private: 0,
    updated: 0,
    skipped: 0,
    errors: 0
  };
  
  try {
    console.log('📦 Récupération de tous les Univers...\n');
    const universSnapshot = await db.collection('univers').get();
    
    console.log(`✅ ${universSnapshot.size} Univers(s) trouvé(s)\n`);
    console.log('═'.repeat(100));
    
    for (const universDoc of universSnapshot.docs) {
      const universId = universDoc.id;
      const universData = universDoc.data();
      const isMarketplace = universData.ownership?.isMarketplaceTemplate === true;
      
      stats.total++;
      
      console.log(`\n📋 Univers: ${universData.metadata?.name || 'Sans nom'} (${universId})`);
      console.log(`   Type: ${isMarketplace ? 'Marketplace' : 'Privé'}`);
      
      // Count usages based on type
      let totalUsages = 0;
      
      if (isMarketplace) {
        stats.marketplace++;
        totalUsages = await countMarketplaceInstances(universId);
        console.log(`   📊 Instances trouvées: ${totalUsages}`);
      } else {
        stats.private++;
        totalUsages = await countPrivateUniversUsages(universId);
        console.log(`   📊 Agences avec ressources instanciées: ${totalUsages}`);
      }
      
      // Get latest usage timestamp
      const lastUsedAt = await getLatestUsageTimestamp(universId, isMarketplace);
      if (lastUsedAt) {
        console.log(`   📅 Dernière utilisation: ${lastUsedAt.toLocaleString('fr-FR')}`);
      }
      
      // Update usage count
      const updated = await updateUniversUsage(universId, totalUsages, lastUsedAt, write);
      
      if (updated) {
        if (totalUsages > 0) {
          stats.updated++;
        } else {
          stats.skipped++;
        }
      } else {
        stats.errors++;
      }
      
      console.log('─'.repeat(100));
    }
    
    // Summary
    console.log('\n' + '═'.repeat(100));
    console.log('📊 RÉSUMÉ DE LA MIGRATION:');
    console.log('═'.repeat(100));
    console.log(`   Total Univers: ${stats.total}`);
    console.log(`   - Marketplace: ${stats.marketplace}`);
    console.log(`   - Privé: ${stats.private}`);
    console.log(`   - Mis à jour (avec utilisations > 0): ${stats.updated}`);
    console.log(`   - Ignorés (0 utilisations): ${stats.skipped}`);
    console.log(`   - Erreurs: ${stats.errors}`);
    console.log('═'.repeat(100));
    
    if (!write) {
      console.log('\n💡 Pour appliquer les modifications, exécutez:');
      console.log('   node scripts/migrate-univers-usage-counts.js --write\n');
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


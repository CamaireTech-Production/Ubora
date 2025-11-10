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
 * Migrer les dashboards dans les définitions d'un Univers
 * Convertit 'title' → 'name' pour les dashboards
 */
async function migrateUniversDashboards(universId, universData, write) {
  const definitions = universData.definitions || {};
  const dashboards = definitions.dashboards || [];
  
  if (dashboards.length === 0) {
    return { updated: false, count: 0 };
  }

  let hasChanges = false;
  let dashboardsToFix = 0;
  
  const updatedDashboards = dashboards.map(dashboard => {
    // Compter les dashboards qui ont 'title' mais pas 'name'
    if (dashboard.title && !dashboard.name) {
      hasChanges = true;
      dashboardsToFix++;
      return {
        ...dashboard,
        name: dashboard.title,
        // Ne pas supprimer title immédiatement pour compatibilité
        // Il sera supprimé dans une migration ultérieure si nécessaire
      };
    }
    // Si le dashboard a les deux, on garde name et on supprime title
    if (dashboard.title && dashboard.name) {
      hasChanges = true;
      dashboardsToFix++;
      const { title, ...rest } = dashboard;
      return rest;
    }
    // Si le dashboard n'a que 'name', on le garde tel quel
    return dashboard;
  });

  if (hasChanges && write) {
    await db.collection('univers').doc(universId).update({
      'definitions.dashboards': updatedDashboards
    });
  }

  return {
    updated: hasChanges,
    count: dashboardsToFix
  };
}

/**
 * Script principal de migration
 */
async function migrate() {
  const write = process.argv.includes('--write');
  
  console.log('🔄 Migration des dashboards: title → name');
  console.log('='.repeat(80));
  console.log(`Mode: ${write ? 'ÉCRITURE' : 'DRY-RUN (simulation)'}`);
  console.log('');

  try {
    // 1. Récupérer tous les Univers
    console.log('📋 Étape 1: Recherche de tous les Univers...');
    const universSnapshot = await db.collection('univers').get();
    
    console.log(`   ✅ ${universSnapshot.size} Univers trouvé(s)\n`);

    const stats = {
      total: universSnapshot.size,
      processed: 0,
      updated: 0,
      dashboardsFixed: 0,
      errors: []
    };

    // 2. Pour chaque Univers, vérifier et migrer les dashboards
    for (const universDoc of universSnapshot.docs) {
      const universId = universDoc.id;
      const universData = universDoc.data();
      const universName = universData.metadata?.name || 'Sans nom';

      try {
        const result = await migrateUniversDashboards(universId, universData, write);
        
        if (result.updated) {
          stats.updated++;
          stats.dashboardsFixed += result.count;
          
          if (write) {
            console.log(`   ✅ Univers "${universName}" (${universId}): ${result.count} dashboard(s) migré(s)`);
          } else {
            console.log(`   📝 Univers "${universName}" (${universId}): ${result.count} dashboard(s) à migrer`);
          }
        }
        
        stats.processed++;
      } catch (error) {
        console.error(`   ❌ Erreur pour Univers "${universName}" (${universId}):`, error.message);
        stats.errors.push({
          universId,
          universName,
          error: error.message
        });
      }
    }

    // 3. Résumé
    console.log('\n' + '='.repeat(80));
    console.log('📊 RÉSUMÉ DE LA MIGRATION');
    console.log('='.repeat(80));
    console.log(`Mode: ${write ? 'ÉCRITURE' : 'DRY-RUN (simulation)'}`);
    console.log('');
    console.log(`Univers traités: ${stats.processed}/${stats.total}`);
    console.log(`Univers mis à jour: ${stats.updated}`);
    console.log(`Dashboards corrigés: ${stats.dashboardsFixed}`);
    console.log('');

    if (stats.errors.length > 0) {
      console.log(`⚠️  Erreurs rencontrées: ${stats.errors.length}`);
      stats.errors.forEach((err, index) => {
        console.log(`   ${index + 1}. ${err.universName} (${err.universId}): ${err.error}`);
      });
      console.log('');
    }

    if (!write) {
      console.log('💡 Pour appliquer la migration, exécutez:');
      console.log('   node scripts/migrate-dashboard-title-to-name.js --write');
      console.log('');
    } else {
      console.log('✅ Migration terminée avec succès!');
      console.log('');
      console.log('🔄 Les dashboards dans les Univers ont été migrés de "title" vers "name".');
      console.log('   Les Univers peuvent maintenant être activés sans erreur.');
      console.log('');
    }

  } catch (error) {
    console.error('❌ Erreur fatale lors de la migration:', error);
    throw error;
  }
}

// Exécuter la migration
migrate()
  .then(() => {
    console.log('✅ Script terminé');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });


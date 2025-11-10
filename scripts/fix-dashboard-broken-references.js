/**
 * Script pour corriger les références cassées dans les dashboards
 * Supprime les références aux listes qui n'existent plus
 * 
 * Usage: node scripts/fix-dashboard-broken-references.js [--write]
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

const DASHBOARDS_COLLECTION = 'dashboards';
const LISTS_COLLECTION = 'lists';

async function fixBrokenReferences(write = false) {
  console.log('🔍 Recherche des références cassées dans les dashboards...');
  console.log(`   Mode: ${write ? 'CORRECTION' : 'DRY-RUN (simulation)'}`);
  console.log('');

  try {
    // Récupérer tous les dashboards
    const dashboardsSnapshot = await db.collection(DASHBOARDS_COLLECTION).get();
    console.log(`📊 ${dashboardsSnapshot.size} dashboard(s) trouvé(s)\n`);

    let totalFixed = 0;
    let totalWouldFix = 0;

    for (const dashboardDoc of dashboardsSnapshot.docs) {
      const dashboardId = dashboardDoc.id;
      const dashboardData = dashboardDoc.data();
      const metrics = dashboardData.metrics || [];

      let hasBrokenReferences = false;
      const fixedMetrics = [];

      for (const metric of metrics) {
        let metricFixed = false;
        const fixedMetric = { ...metric };

        // Vérifier si c'est une métrique de type table avec rowSource de type list
        if (metric.metricType === 'table' && 
            metric.tableConfig && 
            metric.tableConfig.rowSource && 
            metric.tableConfig.rowSource.type === 'list') {
          
          const listId = metric.tableConfig.rowSource.listId;
          
          if (listId) {
            // Vérifier si la liste existe
            try {
              const listDoc = await db.collection(LISTS_COLLECTION).doc(listId).get();
              
              if (!listDoc.exists) {
                console.log(`   ⚠️ Dashboard ${dashboardId}, métrique ${metric.id}: Liste ${listId} n'existe plus`);
                hasBrokenReferences = true;
                
                // Supprimer la référence à la liste en changeant le type de rowSource
                // ou en supprimant la métrique
                if (write) {
                  // Option 1: Changer le type de rowSource à 'entries' si possible
                  // Option 2: Supprimer la métrique
                  // Pour l'instant, on supprime la métrique
                  console.log(`      ❌ Métrique ${metric.id} sera supprimée (liste ${listId} n'existe plus)`);
                  metricFixed = true; // Ne pas inclure cette métrique
                } else {
                  totalWouldFix++;
                }
              }
            } catch (error) {
              console.warn(`      ⚠️ Erreur lors de la vérification de la liste ${listId}:`, error.message);
            }
          }
        }

        if (!metricFixed) {
          fixedMetrics.push(fixedMetric);
        }
      }

      if (hasBrokenReferences) {
        console.log(`\n   📊 Dashboard: ${dashboardData.name || dashboardId}`);
        console.log(`      Métriques avant: ${metrics.length}, après: ${fixedMetrics.length}`);
        
        if (write) {
          // Mettre à jour le dashboard avec les métriques corrigées
          await db.collection(DASHBOARDS_COLLECTION).doc(dashboardId).update({
            metrics: fixedMetrics,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log(`      ✅ Dashboard mis à jour`);
          totalFixed += (metrics.length - fixedMetrics.length);
        } else {
          totalWouldFix += (metrics.length - fixedMetrics.length);
        }
      }
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 RÉSUMÉ`);
    console.log(`${'='.repeat(80)}`);
    
    if (write) {
      console.log(`   Références cassées corrigées: ${totalFixed}`);
    } else {
      console.log(`   Références cassées qui seraient corrigées: ${totalWouldFix}`);
      console.log(`   Exécutez avec --write pour corriger réellement`);
    }

    if (totalFixed === 0 && totalWouldFix === 0) {
      console.log(`\n✅ Aucune référence cassée trouvée !`);
    } else if (write) {
      console.log(`\n✅ ${totalFixed} référence(s) cassée(s) corrigée(s) avec succès !`);
    } else {
      console.log(`\n⚠️  ${totalWouldFix} référence(s) cassée(s) seraient corrigées en mode --write`);
    }

  } catch (error) {
    console.error('\n❌ Erreur lors de l\'exécution du script:', error);
    process.exit(1);
  }
}

const write = process.argv.includes('--write');
fixBrokenReferences(write).then(() => {
  console.log('\n✅ Script terminé');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Erreur fatale:', error);
  process.exit(1);
});


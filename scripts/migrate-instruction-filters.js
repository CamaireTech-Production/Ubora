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
 * Migrer les instructions dans les définitions d'un Univers
 * Ajoute le champ 'filters' manquant avec des valeurs par défaut
 */
async function migrateUniversInstructions(universId, universData, write) {
  const definitions = universData.definitions || {};
  const instructions = definitions.instructions || [];
  
  if (instructions.length === 0) {
    return { updated: false, count: 0 };
  }

  let hasChanges = false;
  let instructionsToFix = 0;
  
  const updatedInstructions = instructions.map(instruction => {
    let instructionUpdated = false;
    const updated = { ...instruction };
    
    // Si l'instruction n'a pas 'filters', on l'ajoute avec des valeurs par défaut
    if (!instruction.filters || instruction.filters === null || instruction.filters === undefined) {
      instructionUpdated = true;
      updated.filters = {
        period: 'all',
        formId: '',
        userId: ''
      };
    } else {
      // Si l'instruction a 'filters' mais certaines propriétés manquent, on les ajoute
      const filters = instruction.filters || {};
      const needsUpdate = 
        filters.period === undefined || 
        filters.period === null || 
        filters.formId === undefined || 
        filters.formId === null ||
        filters.userId === undefined || 
        filters.userId === null;
      
      if (needsUpdate) {
        instructionUpdated = true;
        updated.filters = {
          period: filters.period || 'all',
          formId: filters.formId || '',
          userId: filters.userId || ''
        };
      }
    }
    
    // Si l'instruction n'a pas 'frequency', on l'ajoute avec 'once' par défaut
    if (!instruction.frequency || instruction.frequency === null || instruction.frequency === undefined) {
      instructionUpdated = true;
      updated.frequency = 'once';
    }
    
    // Si l'instruction n'a pas 'selectedFormats', on l'ajoute avec un tableau vide
    if (!Array.isArray(instruction.selectedFormats)) {
      instructionUpdated = true;
      updated.selectedFormats = [];
    }
    
    // Si l'instruction n'a pas 'selectedFormIds', on l'ajoute avec un tableau vide
    if (!Array.isArray(instruction.selectedFormIds)) {
      instructionUpdated = true;
      updated.selectedFormIds = [];
    }
    
    // Si l'instruction n'a pas 'selectedFormat', on l'ajoute avec null
    if (instruction.selectedFormat === undefined) {
      instructionUpdated = true;
      updated.selectedFormat = null;
    }
    
    if (instructionUpdated) {
      hasChanges = true;
      instructionsToFix++;
      return updated;
    }
    
    // Si l'instruction a tous les champs nécessaires, on la garde tel quel
    return instruction;
  });

  if (hasChanges && write) {
    await db.collection('univers').doc(universId).update({
      'definitions.instructions': updatedInstructions
    });
  }

  return {
    updated: hasChanges,
    count: instructionsToFix
  };
}

/**
 * Script principal de migration
 */
async function migrate() {
  const write = process.argv.includes('--write');
  
  console.log('🔄 Migration des instructions: Ajout du champ filters manquant');
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
      instructionsFixed: 0,
      errors: []
    };

    // 2. Pour chaque Univers, vérifier et migrer les instructions
    for (const universDoc of universSnapshot.docs) {
      const universId = universDoc.id;
      const universData = universDoc.data();
      const universName = universData.metadata?.name || 'Sans nom';

      try {
        const result = await migrateUniversInstructions(universId, universData, write);
        
        if (result.updated) {
          stats.updated++;
          stats.instructionsFixed += result.count;
          
          if (write) {
            console.log(`   ✅ Univers "${universName}" (${universId}): ${result.count} instruction(s) migrée(s)`);
          } else {
            console.log(`   📝 Univers "${universName}" (${universId}): ${result.count} instruction(s) à migrer`);
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
    console.log(`Instructions corrigées: ${stats.instructionsFixed}`);
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
      console.log('   node scripts/migrate-instruction-filters.js --write');
      console.log('');
    } else {
      console.log('✅ Migration terminée avec succès!');
      console.log('');
      console.log('🔄 Les instructions dans les Univers ont été corrigées.');
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


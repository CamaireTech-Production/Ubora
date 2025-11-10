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
 * Créer un Univers par défaut pour un directeur
 */
async function createDefaultUnivers(directorId, agencyId, write) {
  const defaultUniversData = {
    metadata: {
      name: 'Univers par défaut',
      description: 'Univers par défaut créé automatiquement',
      isDefault: true,
      isActive: true,
      version: 1,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      tags: []
    },
    ownership: {
      createdBy: directorId,
      agencyId: null, // Privé
      isMarketplaceTemplate: false
    },
    definitions: {
      forms: [],
      dashboards: [],
      instructions: [],
      lists: [],
      reports: []
    },
    usage: {
      totalUsages: 0
    }
  };

  if (write) {
    const docRef = await db.collection('univers').add(defaultUniversData);
    return docRef.id;
  }
  
  // En mode dry-run, on retourne un ID fictif
  return `dry-run-${directorId}`;
}

/**
 * Associer une ressource au Univers par défaut
 */
async function associateResourceToUnivers(
  collectionName,
  resourceId,
  universId,
  write
) {
  const updates = {
    universId: universId,
    universInstanceId: null, // Pas d'instance pour le Univers par défaut
    fromUnivers: true
  };

  if (write) {
    const resourceRef = db.collection(collectionName).doc(resourceId);
    await resourceRef.update(updates);
  }
}

/**
 * Créer ou mettre à jour le document ActiveUnivers
 */
async function setActiveUnivers(directorId, agencyId, universId, write) {
  const activeUniversData = {
    directorId,
    agencyId,
    activeUniversId: universId,
    activeInstanceId: null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  if (write) {
    const docRef = db.collection('activeUnivers').doc(directorId);
    await docRef.set(activeUniversData, { merge: true });
  }
}

/**
 * Migration principale
 */
async function main() {
  const write = process.argv.includes('--write');
  console.log(`🔧 Migration Univers par défaut (dry-run=${!write})`);
  console.log('');

  // 1. Lister tous les directeurs
  console.log('📋 Étape 1: Recherche des directeurs...');
  const directorsSnapshot = await db.collection('users')
    .where('role', '==', 'directeur')
    .get();
  
  console.log(`   ✅ Trouvé ${directorsSnapshot.size} directeur(s)`);
  console.log('');

  const migrationStats = {
    totalDirectors: directorsSnapshot.size,
    universCreated: 0,
    universAlreadyExists: 0,
    resourcesAssociated: {
      forms: 0,
      dashboards: 0,
      lists: 0,
      reports: 0,
      instructions: 0
    },
    activeUniversCreated: 0,
    errors: []
  };

  // 2. Pour chaque directeur, créer Univers par défaut et associer ressources
  for (const directorDoc of directorsSnapshot.docs) {
    const directorId = directorDoc.id;
    const directorData = directorDoc.data();
    const agencyId = directorData.agencyId;

    console.log(`\n👤 Directeur: ${directorData.name || directorId} (${directorId})`);
    console.log(`   Agence: ${agencyId || 'N/A'}`);

    // Vérifier que le directeur a une agence
    if (!agencyId) {
      console.log(`   ⚠️  Directeur sans agence, ignoré pour la migration`);
      migrationStats.errors.push({
        directorId,
        directorName: directorData.name || directorId,
        error: 'Directeur sans agence'
      });
      continue;
    }

    try {
      // 2.1. Vérifier si un Univers par défaut existe déjà
      const existingDefaultSnapshot = await db.collection('univers')
        .where('ownership.createdBy', '==', directorId)
        .where('metadata.isDefault', '==', true)
        .limit(1)
        .get();

      let defaultUniversId;

      if (!existingDefaultSnapshot.empty) {
        // Univers par défaut existe déjà
        defaultUniversId = existingDefaultSnapshot.docs[0].id;
        migrationStats.universAlreadyExists++;
        console.log(`   ✅ Univers par défaut existe déjà: ${defaultUniversId}`);
      } else {
        // Créer le Univers par défaut
        console.log(`   🔨 Création du Univers par défaut...`);
        defaultUniversId = await createDefaultUnivers(directorId, agencyId, write);
        migrationStats.universCreated++;
        console.log(`   ✅ Univers par défaut créé: ${defaultUniversId}`);
      }

      // 2.2. Associer toutes les ressources existantes au Univers par défaut
      console.log(`   🔗 Association des ressources au Univers par défaut...`);

      // Forms - Chercher les formulaires sans universId (null ou undefined)
      // Note: On ne peut pas filtrer directement les documents sans champ, donc on récupère tous les forms de l'agence
      const allFormsSnapshot = await db.collection('forms')
        .where('agencyId', '==', agencyId)
        .get();
      
      const formsSnapshot = allFormsSnapshot.docs.filter(doc => {
        const data = doc.data();
        // Ne migrer que les ressources qui n'ont pas déjà un universId
        // (pour que la migration soit idempotente)
        return !data.universId || data.universId === null || data.universId === undefined;
      });
      
      for (const formDoc of formsSnapshot) {
        if (write) {
          await associateResourceToUnivers('forms', formDoc.id, defaultUniversId, write);
        }
        migrationStats.resourcesAssociated.forms++;
      }
      console.log(`      📝 ${formsSnapshot.length} formulaire(s) associé(s)`);

      // Dashboards
      const allDashboardsSnapshot = await db.collection('dashboards')
        .where('agencyId', '==', agencyId)
        .get();
      
      const dashboardsSnapshot = allDashboardsSnapshot.docs.filter(doc => {
        const data = doc.data();
        return !data.universId || data.universId === null || data.universId === undefined;
      });
      
      for (const dashboardDoc of dashboardsSnapshot) {
        if (write) {
          await associateResourceToUnivers('dashboards', dashboardDoc.id, defaultUniversId, write);
        }
        migrationStats.resourcesAssociated.dashboards++;
      }
      console.log(`      📊 ${dashboardsSnapshot.length} tableau(x) de bord associé(s)`);

      // Lists
      const allListsSnapshot = await db.collection('lists')
        .where('agencyId', '==', agencyId)
        .get();
      
      const listsSnapshot = allListsSnapshot.docs.filter(doc => {
        const data = doc.data();
        return !data.universId || data.universId === null || data.universId === undefined;
      });
      
      for (const listDoc of listsSnapshot) {
        if (write) {
          await associateResourceToUnivers('lists', listDoc.id, defaultUniversId, write);
        }
        migrationStats.resourcesAssociated.lists++;
      }
      console.log(`      📋 ${listsSnapshot.length} liste(s) associée(s)`);

      // Reports
      const allReportsSnapshot = await db.collection('reports')
        .where('agencyId', '==', agencyId)
        .get();
      
      const reportsSnapshot = allReportsSnapshot.docs.filter(doc => {
        const data = doc.data();
        return !data.universId || data.universId === null || data.universId === undefined;
      });
      
      for (const reportDoc of reportsSnapshot) {
        if (write) {
          await associateResourceToUnivers('reports', reportDoc.id, defaultUniversId, write);
        }
        migrationStats.resourcesAssociated.reports++;
      }
      console.log(`      📄 ${reportsSnapshot.length} rapport(s) associé(s)`);

      // Instructions (ScheduledQuestions)
      const allInstructionsSnapshot = await db.collection('scheduledQuestions')
        .where('agencyId', '==', agencyId)
        .get();
      
      const instructionsSnapshot = allInstructionsSnapshot.docs.filter(doc => {
        const data = doc.data();
        return !data.universId || data.universId === null || data.universId === undefined;
      });
      
      for (const instructionDoc of instructionsSnapshot) {
        if (write) {
          await associateResourceToUnivers('scheduledQuestions', instructionDoc.id, defaultUniversId, write);
        }
        migrationStats.resourcesAssociated.instructions++;
      }
      console.log(`      📅 ${instructionsSnapshot.length} instruction(s) associée(s)`);

      // 2.3. Créer ou mettre à jour le document ActiveUnivers
      console.log(`   ⚡ Création/mise à jour du document ActiveUnivers...`);
      if (write) {
        await setActiveUnivers(directorId, agencyId, defaultUniversId, write);
      }
      migrationStats.activeUniversCreated++;
      console.log(`   ✅ ActiveUnivers créé/mis à jour`);

    } catch (error) {
      console.error(`   ❌ Erreur lors de la migration pour le directeur ${directorId}:`, error.message);
      migrationStats.errors.push({
        directorId,
        directorName: directorData.name || directorId,
        error: error.message
      });
    }
  }

  // 3. Résumé de la migration
  console.log('\n' + '='.repeat(60));
  console.log('📊 RÉSUMÉ DE LA MIGRATION');
  console.log('='.repeat(60));
  console.log(`Mode: ${write ? 'ÉCRITURE' : 'DRY-RUN (simulation)'}`);
  console.log('');
  console.log(`Directeurs traités: ${migrationStats.totalDirectors}`);
  console.log(`  - Univers par défaut créés: ${migrationStats.universCreated}`);
  console.log(`  - Univers par défaut déjà existants: ${migrationStats.universAlreadyExists}`);
  console.log('');
  console.log('Ressources associées:');
  console.log(`  - Formulaires: ${migrationStats.resourcesAssociated.forms}`);
  console.log(`  - Tableaux de bord: ${migrationStats.resourcesAssociated.dashboards}`);
  console.log(`  - Listes: ${migrationStats.resourcesAssociated.lists}`);
  console.log(`  - Rapports: ${migrationStats.resourcesAssociated.reports}`);
  console.log(`  - Instructions: ${migrationStats.resourcesAssociated.instructions}`);
  console.log('');
  console.log(`Documents ActiveUnivers créés/mis à jour: ${migrationStats.activeUniversCreated}`);
  console.log('');

  if (migrationStats.errors.length > 0) {
    console.log(`⚠️  Erreurs rencontrées: ${migrationStats.errors.length}`);
    migrationStats.errors.forEach((err, index) => {
      console.log(`   ${index + 1}. ${err.directorName} (${err.directorId}): ${err.error}`);
    });
    console.log('');
  }

  if (!write) {
    console.log('💡 Pour appliquer la migration, exécutez:');
    console.log('   node scripts/migrate-default-univers.js --write');
    console.log('');
  } else {
    console.log('✅ Migration terminée avec succès!');
    console.log('');
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('❌ Erreur lors de la migration:', e);
    process.exit(1);
  });


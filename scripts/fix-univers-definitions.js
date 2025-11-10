/**
 * Fix script to add forms and dashboards to Univers definitions
 * 
 * Usage: node scripts/fix-univers-definitions.js [directorId] [agencyId]
 */

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

async function fixUniversDefinitions(directorId, agencyId) {
  try {
    console.log('🔧 Fixing Univers Definitions');
    console.log('==============================\n');
    console.log(`📋 Director ID: ${directorId}`);
    console.log(`📋 Agency ID: ${agencyId}\n`);

    // Get migration record
    const migrationKey = `seed-stocks-v1-${directorId}-${agencyId}`;
    const migrationDoc = await db.collection('migrations').doc(migrationKey).get();
    
    if (!migrationDoc.exists) {
      console.log('❌ No migration record found. Run seed script first.\n');
      return;
    }
    
    const migrationData = migrationDoc.data();
    const physicalStockFormId = migrationData.physicalStockFormId;
    const movementFormId = migrationData.movementFormId;
    const dashboardId = migrationData.dashboardId;
    const productsListId = migrationData.productsListId;
    
    if (!physicalStockFormId || !movementFormId || !dashboardId || !productsListId) {
      console.log('❌ Missing form/dashboard IDs in migration record.\n');
      return;
    }

    // Get forms to extract universId
    const physicalStockFormDoc = await db.collection('forms').doc(physicalStockFormId).get();
    if (!physicalStockFormDoc.exists) {
      console.log('❌ Physical Stock Form not found.\n');
      return;
    }
    
    const physicalStockFormData = physicalStockFormDoc.data();
    const universId = physicalStockFormData.universId;
    
    if (!universId) {
      console.log('❌ No universId found in forms. Forms may not be associated with a Univers.\n');
      return;
    }

    console.log(`📋 Univers ID: ${universId}\n`);

    // Get Univers document
    const universRef = db.collection('univers').doc(universId);
    const universDoc = await universRef.get();
    
    if (!universDoc.exists) {
      console.log('❌ Univers document not found.\n');
      return;
    }

    const universData = universDoc.data();
    const currentForms = universData.definitions?.forms || [];
    const currentDashboards = universData.definitions?.dashboards || [];
    const currentLists = universData.definitions?.lists || [];
    
    console.log(`📊 Current Univers definitions:`);
    console.log(`   - Forms: ${currentForms.length}`);
    console.log(`   - Dashboards: ${currentDashboards.length}`);
    console.log(`   - Lists: ${currentLists.length}\n`);
    
    // Check if forms already exist in definitions
    const formIdsInDefinitions = new Set(currentForms.map(f => f.id));
    const dashboardIdsInDefinitions = new Set(currentDashboards.map(d => d.id));
    const listIdsInDefinitions = new Set(currentLists.map(l => l.id));
    
    // Get form data
    const movementFormDoc = await db.collection('forms').doc(movementFormId).get();
    const movementFormData = movementFormDoc.exists ? movementFormDoc.data() : null;
    
    // Prepare form definitions to add
    const formsToAdd = [];
    if (!formIdsInDefinitions.has(physicalStockFormId)) {
      formsToAdd.push({
        id: physicalStockFormId,
        title: physicalStockFormData.title || '',
        description: physicalStockFormData.description || '',
        fields: physicalStockFormData.fields || []
      });
      console.log(`✅ Will add Physical Stock Form to definitions`);
    } else {
      console.log(`ℹ️  Physical Stock Form already in definitions`);
    }
    
    if (movementFormData && !formIdsInDefinitions.has(movementFormId)) {
      formsToAdd.push({
        id: movementFormId,
        title: movementFormData.title || '',
        description: movementFormData.description || '',
        fields: movementFormData.fields || []
      });
      console.log(`✅ Will add Movement Form to definitions`);
    } else if (movementFormData) {
      console.log(`ℹ️  Movement Form already in definitions`);
    }
    
    // Get dashboard data
    const dashboardDoc = await db.collection('dashboards').doc(dashboardId).get();
    const dashboardData = dashboardDoc.exists ? dashboardDoc.data() : null;
    
    const dashboardsToAdd = [];
    if (dashboardData && !dashboardIdsInDefinitions.has(dashboardId)) {
      dashboardsToAdd.push({
        id: dashboardId,
        name: dashboardData.name || '',
        description: dashboardData.description || '',
        metrics: dashboardData.metrics || []
      });
      console.log(`✅ Will add Dashboard to definitions`);
    } else if (dashboardData) {
      console.log(`ℹ️  Dashboard already in definitions`);
    }
    
    // Get list data
    const listDoc = await db.collection('lists').doc(productsListId).get();
    const listData = listDoc.exists ? listDoc.data() : null;
    
    const listsToAdd = [];
    if (listData && !listIdsInDefinitions.has(productsListId)) {
      listsToAdd.push({
        id: productsListId,
        name: listData.name || '',
        columns: listData.columns || [],
        rows: listData.rows || []
      });
      console.log(`✅ Will add Products List to definitions`);
    } else if (listData) {
      console.log(`ℹ️  Products List already in definitions`);
    }
    
    // Update Univers document if there are new items to add
    if (formsToAdd.length > 0 || dashboardsToAdd.length > 0 || listsToAdd.length > 0) {
      const updateData = {};
      if (formsToAdd.length > 0) {
        updateData['definitions.forms'] = [...currentForms, ...formsToAdd];
      }
      if (dashboardsToAdd.length > 0) {
        updateData['definitions.dashboards'] = [...currentDashboards, ...dashboardsToAdd];
      }
      if (listsToAdd.length > 0) {
        updateData['definitions.lists'] = [...currentLists, ...listsToAdd];
      }
      
      await universRef.update(updateData);
      console.log(`\n✅ Updated Univers document:`);
      console.log(`   - Added ${formsToAdd.length} forms`);
      console.log(`   - Added ${dashboardsToAdd.length} dashboards`);
      console.log(`   - Added ${listsToAdd.length} lists`);
    } else {
      console.log(`\nℹ️  All items already exist in Univers definitions`);
    }

    // Update migration record with universId
    await db.collection('migrations').doc(migrationKey).update({
      universId: universId
    });
    console.log(`\n✅ Updated migration record with universId\n`);
    
  } catch (error) {
    console.error('❌ Error during fix:', error);
    process.exit(1);
  }
}

// Main
const directorId = process.argv[2] || 'NmeqMvHwQLZvJRU4oDs5Skz0Q0Q2';
const agencyId = process.argv[3] || 'agency1';

fixUniversDefinitions(directorId, agencyId).then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});


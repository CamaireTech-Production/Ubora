/**
 * Inspection script for seeded stock management data
 * Checks the state of Products list, forms, submissions, and dashboard
 * 
 * Usage: node scripts/inspect-seeded-stocks.js [directorId] [agencyId]
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

async function inspectSeededData(directorId, agencyId) {
  try {
    console.log('🔍 Inspecting Seeded Stock Management Data');
    console.log('==========================================\n');
    console.log(`📋 Director ID: ${directorId}`);
    console.log(`📋 Agency ID: ${agencyId}\n`);

    // Check migration record
    const migrationKey = `seed-stocks-v1-${directorId}-${agencyId}`;
    const migrationRef = db.collection('migrations').doc(migrationKey);
    const migrationDoc = await migrationRef.get();
    
    if (!migrationDoc.exists) {
      console.log('❌ No migration record found. Seed script may not have run.\n');
      return;
    }
    
    const migrationData = migrationDoc.data();
    console.log('✅ Migration record found:');
    console.log(`   - Completed at: ${migrationData.completedAt?.toDate() || 'N/A'}`);
    console.log(`   - Products List ID: ${migrationData.productsListId || 'N/A'}`);
    console.log(`   - Physical Stock Form ID: ${migrationData.physicalStockFormId || 'N/A'}`);
    console.log(`   - Movement Form ID: ${migrationData.movementFormId || 'N/A'}`);
    console.log(`   - Dashboard ID: ${migrationData.dashboardId || 'N/A'}\n`);

    // Check Products list
    if (migrationData.productsListId) {
      const listDoc = await db.collection('lists').doc(migrationData.productsListId).get();
      if (listDoc.exists) {
        const listData = listDoc.data();
        console.log('✅ Products List found:');
        console.log(`   - Name: ${listData.name || 'N/A'}`);
        console.log(`   - Columns: ${listData.columns?.length || 0}`);
        console.log(`   - Rows: ${listData.rows?.length || 0}`);
        console.log(`   - assignedTo: ${listData.assignedTo ? JSON.stringify(listData.assignedTo) : 'NOT SET'}`);
        console.log(`   - Univers ID: ${listData.universId || 'N/A'}\n`);
      } else {
        console.log('❌ Products List not found\n');
      }
    }

    // Check Physical Stock form
    if (migrationData.physicalStockFormId) {
      const formDoc = await db.collection('forms').doc(migrationData.physicalStockFormId).get();
      if (formDoc.exists) {
        const formData = formDoc.data();
        console.log('✅ Physical Stock Form found:');
        console.log(`   - Title: ${formData.title || 'N/A'}`);
        console.log(`   - Fields: ${formData.fields?.length || 0}`);
        console.log(`   - assignedTo: ${formData.assignedTo ? JSON.stringify(formData.assignedTo) : 'NOT SET ❌'}`);
        console.log(`   - Univers ID: ${formData.universId || 'N/A'}\n`);
        
        if (!formData.assignedTo || !Array.isArray(formData.assignedTo) || formData.assignedTo.length === 0) {
          console.log('   ⚠️  ISSUE: Form is not assigned to any employee!\n');
        }
      } else {
        console.log('❌ Physical Stock Form not found\n');
      }
    }

    // Check Movement form
    if (migrationData.movementFormId) {
      const formDoc = await db.collection('forms').doc(migrationData.movementFormId).get();
      if (formDoc.exists) {
        const formData = formDoc.data();
        console.log('✅ Movement Form found:');
        console.log(`   - Title: ${formData.title || 'N/A'}`);
        console.log(`   - Fields: ${formData.fields?.length || 0}`);
        console.log(`   - assignedTo: ${formData.assignedTo ? JSON.stringify(formData.assignedTo) : 'NOT SET ❌'}`);
        console.log(`   - Univers ID: ${formData.universId || 'N/A'}\n`);
        
        if (!formData.assignedTo || !Array.isArray(formData.assignedTo) || formData.assignedTo.length === 0) {
          console.log('   ⚠️  ISSUE: Form is not assigned to any employee!\n');
        }
      } else {
        console.log('❌ Movement Form not found\n');
      }
    }

    // Check submissions
    const physicalStockEntries = await db.collection('formEntries')
      .where('formId', '==', migrationData.physicalStockFormId)
      .where('agencyId', '==', agencyId)
      .get();
    
    const movementEntries = await db.collection('formEntries')
      .where('formId', '==', migrationData.movementFormId)
      .where('agencyId', '==', agencyId)
      .get();
    
    console.log('✅ Submissions found:');
    console.log(`   - Physical Stock entries: ${physicalStockEntries.size}`);
    console.log(`   - Movement entries: ${movementEntries.size}`);
    console.log(`   - Total: ${physicalStockEntries.size + movementEntries.size}\n`);

    // Check dashboard
    if (migrationData.dashboardId) {
      const dashboardDoc = await db.collection('dashboards').doc(migrationData.dashboardId).get();
      if (dashboardDoc.exists) {
        const dashboardData = dashboardDoc.data();
        console.log('✅ Dashboard found:');
        console.log(`   - Name: ${dashboardData.name || 'N/A'}`);
        console.log(`   - Metrics: ${dashboardData.metrics?.length || 0}`);
        if (dashboardData.metrics && dashboardData.metrics.length > 0) {
          const tableMetric = dashboardData.metrics.find(m => m.metricType === 'table');
          if (tableMetric) {
            console.log(`   - Table metric found: ${tableMetric.name}`);
            console.log(`   - Row source type: ${tableMetric.tableConfig?.rowSource?.type || 'N/A'}`);
            console.log(`   - Columns: ${tableMetric.tableConfig?.columns?.length || 0}`);
          }
        }
        console.log(`   - Univers ID: ${dashboardData.universId || 'N/A'}\n`);
      } else {
        console.log('❌ Dashboard not found\n');
      }
    }

    // Check director user
    const directorDoc = await db.collection('users').doc(directorId).get();
    if (directorDoc.exists) {
      const directorData = directorDoc.data();
      console.log('✅ Director user found:');
      console.log(`   - Name: ${directorData.name || 'N/A'}`);
      console.log(`   - Email: ${directorData.email || 'N/A'}`);
      console.log(`   - Role: ${directorData.role || 'N/A'}`);
      console.log(`   - Agency ID: ${directorData.agencyId || 'N/A'}\n`);
    } else {
      console.log('❌ Director user not found\n');
    }

    console.log('✅ Inspection completed!\n');
    
  } catch (error) {
    console.error('❌ Error during inspection:', error);
    process.exit(1);
  }
}

// Main
const directorId = process.argv[2] || 'NmeqMvHwQLZvJRU4oDs5Skz0Q0Q2';
const agencyId = process.argv[3] || 'agency1';

inspectSeededData(directorId, agencyId).then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});


/**
 * Inspection script to check how forms and dashboards are stored in Firebase
 * and compare with what the univers detail screen expects
 * 
 * Usage: node scripts/inspect-univers-data.js [directorId] [agencyId]
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

async function inspectUniversData(directorId, agencyId) {
  try {
    console.log('🔍 Inspecting Univers Data Structure');
    console.log('====================================\n');
    console.log(`📋 Director ID: ${directorId}`);
    console.log(`📋 Agency ID: ${agencyId}\n`);

    // Get migration record to find the univers ID
    const migrationKey = `seed-stocks-v1-${directorId}-${agencyId}`;
    const migrationDoc = await db.collection('migrations').doc(migrationKey).get();
    
    if (!migrationDoc.exists) {
      console.log('❌ No migration record found.\n');
      return;
    }
    
    const migrationData = migrationDoc.data();
    const universId = migrationData.universId;
    
    if (!universId) {
      console.log('❌ No univers ID found in migration record.\n');
      return;
    }

    console.log(`📋 Univers ID from migration: ${universId}\n`);

    // Get the univers document
    const universDoc = await db.collection('univers').doc(universId).get();
    if (universDoc.exists) {
      const universData = universDoc.data();
      console.log('✅ Univers document found:');
      console.log(`   - Name: ${universData.name || 'N/A'}`);
      console.log(`   - Agency ID: ${universData.agencyId || 'N/A'}`);
      console.log(`   - Active: ${universData.active || false}`);
      console.log(`   - Created by: ${universData.createdBy || 'N/A'}\n`);
    } else {
      console.log('❌ Univers document not found\n');
    }

    // Check Physical Stock form
    if (migrationData.physicalStockFormId) {
      const formDoc = await db.collection('forms').doc(migrationData.physicalStockFormId).get();
      if (formDoc.exists) {
        const formData = formDoc.data();
        console.log('📋 Physical Stock Form - Firebase Structure:');
        console.log(`   - Form ID: ${migrationData.physicalStockFormId}`);
        console.log(`   - Title: ${formData.title || 'N/A'}`);
        console.log(`   - universId: ${formData.universId || 'NOT SET ❌'}`);
        console.log(`   - universInstanceId: ${formData.universInstanceId || 'NOT SET'}`);
        console.log(`   - fromUnivers: ${formData.fromUnivers || false}`);
        console.log(`   - agencyId: ${formData.agencyId || 'N/A'}`);
        console.log(`   - createdBy: ${formData.createdBy || 'N/A'}`);
        console.log(`   - assignedTo: ${formData.assignedTo ? JSON.stringify(formData.assignedTo) : 'NOT SET'}`);
        
        // Check if it matches expected univers
        if (formData.universId === universId) {
          console.log(`   ✅ universId matches expected univers`);
        } else {
          console.log(`   ❌ universId does NOT match expected univers`);
        }
        console.log('');
      }
    }

    // Check Movement form
    if (migrationData.movementFormId) {
      const formDoc = await db.collection('forms').doc(migrationData.movementFormId).get();
      if (formDoc.exists) {
        const formData = formDoc.data();
        console.log('📋 Movement Form - Firebase Structure:');
        console.log(`   - Form ID: ${migrationData.movementFormId}`);
        console.log(`   - Title: ${formData.title || 'N/A'}`);
        console.log(`   - universId: ${formData.universId || 'NOT SET ❌'}`);
        console.log(`   - universInstanceId: ${formData.universInstanceId || 'NOT SET'}`);
        console.log(`   - fromUnivers: ${formData.fromUnivers || false}`);
        console.log(`   - agencyId: ${formData.agencyId || 'N/A'}`);
        console.log(`   - createdBy: ${formData.createdBy || 'N/A'}`);
        console.log(`   - assignedTo: ${formData.assignedTo ? JSON.stringify(formData.assignedTo) : 'NOT SET'}`);
        
        // Check if it matches expected univers
        if (formData.universId === universId) {
          console.log(`   ✅ universId matches expected univers`);
        } else {
          console.log(`   ❌ universId does NOT match expected univers`);
        }
        console.log('');
      }
    }

    // Check Dashboard
    if (migrationData.dashboardId) {
      const dashboardDoc = await db.collection('dashboards').doc(migrationData.dashboardId).get();
      if (dashboardDoc.exists) {
        const dashboardData = dashboardDoc.data();
        console.log('📊 Dashboard - Firebase Structure:');
        console.log(`   - Dashboard ID: ${migrationData.dashboardId}`);
        console.log(`   - Name: ${dashboardData.name || 'N/A'}`);
        console.log(`   - universId: ${dashboardData.universId || 'NOT SET ❌'}`);
        console.log(`   - universInstanceId: ${dashboardData.universInstanceId || 'NOT SET'}`);
        console.log(`   - fromUnivers: ${dashboardData.fromUnivers || false}`);
        console.log(`   - agencyId: ${dashboardData.agencyId || 'N/A'}`);
        console.log(`   - createdBy: ${dashboardData.createdBy || 'N/A'}`);
        
        // Check if it matches expected univers
        if (dashboardData.universId === universId) {
          console.log(`   ✅ universId matches expected univers`);
        } else {
          console.log(`   ❌ universId does NOT match expected univers`);
        }
        console.log('');
      }
    }

    // Check Products List
    if (migrationData.productsListId) {
      const listDoc = await db.collection('lists').doc(migrationData.productsListId).get();
      if (listDoc.exists) {
        const listData = listDoc.data();
        console.log('📋 Products List - Firebase Structure:');
        console.log(`   - List ID: ${migrationData.productsListId}`);
        console.log(`   - Name: ${listData.name || 'N/A'}`);
        console.log(`   - universId: ${listData.universId || 'NOT SET ❌'}`);
        console.log(`   - agencyId: ${listData.agencyId || 'N/A'}`);
        console.log(`   - createdBy: ${listData.createdBy || 'N/A'}`);
        
        // Check if it matches expected univers
        if (listData.universId === universId) {
          console.log(`   ✅ universId matches expected univers`);
        } else {
          console.log(`   ❌ universId does NOT match expected univers`);
        }
        console.log('');
      }
    }

    // Now check how forms are queried for univers detail screen
    console.log('🔍 Checking Query Patterns:');
    console.log('===========================\n');
    
    // Query forms by universId
    const formsByUnivers = await db.collection('forms')
      .where('universId', '==', universId)
      .where('agencyId', '==', agencyId)
      .get();
    
    console.log(`📋 Forms queried by universId=${universId} AND agencyId=${agencyId}:`);
    console.log(`   - Found: ${formsByUnivers.size} forms`);
    formsByUnivers.forEach(doc => {
      console.log(`     • ${doc.data().title} (ID: ${doc.id})`);
    });
    console.log('');

    // Query dashboards by universId
    const dashboardsByUnivers = await db.collection('dashboards')
      .where('universId', '==', universId)
      .where('agencyId', '==', agencyId)
      .get();
    
    console.log(`📊 Dashboards queried by universId=${universId} AND agencyId=${agencyId}:`);
    console.log(`   - Found: ${dashboardsByUnivers.size} dashboards`);
    dashboardsByUnivers.forEach(doc => {
      console.log(`     • ${doc.data().name} (ID: ${doc.id})`);
    });
    console.log('');

    // Query lists by universId
    const listsByUnivers = await db.collection('lists')
      .where('universId', '==', universId)
      .where('agencyId', '==', agencyId)
      .get();
    
    console.log(`📋 Lists queried by universId=${universId} AND agencyId=${agencyId}:`);
    console.log(`   - Found: ${listsByUnivers.size} lists`);
    listsByUnivers.forEach(doc => {
      console.log(`     • ${doc.data().name} (ID: ${doc.id})`);
    });
    console.log('');

    console.log('✅ Inspection completed!\n');
    
  } catch (error) {
    console.error('❌ Error during inspection:', error);
    process.exit(1);
  }
}

// Main
const directorId = process.argv[2] || 'NmeqMvHwQLZvJRU4oDs5Skz0Q0Q2';
const agencyId = process.argv[3] || 'agency1';

inspectUniversData(directorId, agencyId).then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});


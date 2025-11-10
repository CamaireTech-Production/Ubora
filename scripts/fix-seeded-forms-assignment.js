/**
 * Fix script to assign seeded forms to the director
 * 
 * Usage: node scripts/fix-seeded-forms-assignment.js [directorId] [agencyId]
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

async function fixFormAssignments(directorId, agencyId) {
  try {
    console.log('🔧 Fixing Seeded Forms Assignment');
    console.log('==================================\n');
    console.log(`📋 Director ID: ${directorId}`);
    console.log(`📋 Agency ID: ${agencyId}\n`);

    // Get migration record
    const migrationKey = `seed-stocks-v1-${directorId}-${agencyId}`;
    const migrationRef = db.collection('migrations').doc(migrationKey);
    const migrationDoc = await migrationRef.get();
    
    if (!migrationDoc.exists) {
      console.log('❌ No migration record found. Run seed script first.\n');
      return;
    }
    
    const migrationData = migrationDoc.data();
    console.log('✅ Migration record found\n');

    // Fix Physical Stock form
    if (migrationData.physicalStockFormId) {
      const formRef = db.collection('forms').doc(migrationData.physicalStockFormId);
      const formDoc = await formRef.get();
      
      if (formDoc.exists) {
        const formData = formDoc.data();
        if (!formData.assignedTo || !Array.isArray(formData.assignedTo) || formData.assignedTo.length === 0) {
          await formRef.update({
            assignedTo: [directorId]
          });
          console.log(`✅ Fixed Physical Stock Form: Assigned to director ${directorId}`);
        } else {
          console.log(`ℹ️  Physical Stock Form already assigned: ${formData.assignedTo.join(', ')}`);
        }
      } else {
        console.log('❌ Physical Stock Form not found');
      }
    }

    // Fix Movement form
    if (migrationData.movementFormId) {
      const formRef = db.collection('forms').doc(migrationData.movementFormId);
      const formDoc = await formRef.get();
      
      if (formDoc.exists) {
        const formData = formDoc.data();
        if (!formData.assignedTo || !Array.isArray(formData.assignedTo) || formData.assignedTo.length === 0) {
          await formRef.update({
            assignedTo: [directorId]
          });
          console.log(`✅ Fixed Movement Form: Assigned to director ${directorId}`);
        } else {
          console.log(`ℹ️  Movement Form already assigned: ${formData.assignedTo.join(', ')}`);
        }
      } else {
        console.log('❌ Movement Form not found');
      }
    }

    console.log('\n✅ Fix completed!\n');
    
  } catch (error) {
    console.error('❌ Error during fix:', error);
    process.exit(1);
  }
}

// Main
const directorId = process.argv[2] || 'NmeqMvHwQLZvJRU4oDs5Skz0Q0Q2';
const agencyId = process.argv[3] || 'agency1';

fixFormAssignments(directorId, agencyId).then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});


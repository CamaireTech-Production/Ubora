import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, '../studio-gpnfx-firebase-adminsdk-fbsvc-49cf718bd7.json'), 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/**
 * Count all notifications before deletion
 */
async function countNotifications() {
  try {
    const notificationsSnapshot = await db.collection('notifications').get();
    return notificationsSnapshot.size;
  } catch (error) {
    console.error('❌ Error counting notifications:', error);
    return 0;
  }
}

/**
 * Delete all notifications from Firestore
 */
async function deleteAllNotifications() {
  console.log('🗑️  Starting deletion of all notifications...');
  
  try {
    // Count notifications before deletion
    const initialCount = await countNotifications();
    console.log(`📊 Found ${initialCount} notifications to delete`);
    
    if (initialCount === 0) {
      console.log('✅ No notifications to delete');
      return { deleted: 0, errors: 0 };
    }
    
    // Get all notifications in batches (Firestore has a limit)
    const batchSize = 500; // Firestore batch write limit
    let totalDeleted = 0;
    let totalErrors = 0;
    let lastDoc = null;
    
    while (true) {
      let query = db.collection('notifications').limit(batchSize);
      
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }
      
      const snapshot = await query.get();
      
      if (snapshot.empty) {
        break;
      }
      
      // Delete in batches
      const batch = db.batch();
      let batchCount = 0;
      
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
        batchCount++;
      });
      
      if (batchCount > 0) {
        try {
          await batch.commit();
          totalDeleted += batchCount;
          console.log(`  ✅ Deleted batch of ${batchCount} notifications (Total: ${totalDeleted})`);
        } catch (error) {
          console.error(`  ❌ Error deleting batch:`, error);
          totalErrors += batchCount;
        }
      }
      
      // Update lastDoc for next iteration
      lastDoc = snapshot.docs[snapshot.docs.length - 1];
      
      // If we got less than batchSize, we're done
      if (snapshot.docs.length < batchSize) {
        break;
      }
    }
    
    console.log(`\n✅ Notification deletion completed!`);
    console.log(`📊 Total deleted: ${totalDeleted}`);
    if (totalErrors > 0) {
      console.log(`⚠️  Errors: ${totalErrors}`);
    }
    
    // Verify deletion
    const remainingCount = await countNotifications();
    if (remainingCount === 0) {
      console.log(`🎉 All notifications successfully deleted!`);
    } else {
      console.log(`⚠️  ${remainingCount} notifications still remain (may need another run)`);
    }
    
    return { deleted: totalDeleted, errors: totalErrors };
    
  } catch (error) {
    console.error('❌ Error during notification deletion:', error);
    throw error;
  }
}

/**
 * Validate that all notifications are deleted
 */
async function validateDeletion() {
  console.log('\n🔍 Validating notification deletion...');
  
  try {
    const count = await countNotifications();
    
    if (count === 0) {
      console.log('✅ All notifications have been deleted successfully!');
    } else {
      console.log(`⚠️  ${count} notifications still remain in the database`);
    }
    
    return count === 0;
    
  } catch (error) {
    console.error('❌ Error during validation:', error);
    return false;
  }
}

/**
 * Create a backup of all notifications before deletion
 */
async function createBackup() {
  console.log('💾 Creating backup of all notifications...');
  
  try {
    const notificationsSnapshot = await db.collection('notifications').get();
    const backupData = [];
    
    notificationsSnapshot.docs.forEach(doc => {
      backupData.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    const backupRef = db.collection('backups').doc(`notifications-${Date.now()}`);
    await backupRef.set({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      notificationCount: notificationsSnapshot.size,
      data: backupData
    });
    
    console.log(`✅ Backup created: ${backupRef.id}`);
    console.log(`📊 Backed up ${notificationsSnapshot.size} notifications`);
    
  } catch (error) {
    console.error('❌ Error creating backup:', error);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--backup')) {
    await createBackup();
  }
  
  if (args.includes('--delete')) {
    await deleteAllNotifications();
  }
  
  if (args.includes('--validate')) {
    await validateDeletion();
  }
  
  if (args.length === 0) {
    console.log('Usage: node delete-all-notifications.js [--backup] [--delete] [--validate]');
    console.log('  --backup   Create a backup before deletion');
    console.log('  --delete   Delete all notifications');
    console.log('  --validate Validate that all notifications are deleted');
    console.log('\nExample: node delete-all-notifications.js --backup --delete --validate');
    console.log('⚠️  WARNING: This will permanently delete ALL notifications!');
  }
  
  process.exit(0);
}

main().catch(console.error);


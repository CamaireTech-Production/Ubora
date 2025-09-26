import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, '../studio-gpnfx-firebase-adminsdk-fbsvc-eed44532ba.json'), 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/**
 * List all available backups
 */
async function listBackups() {
  console.log('📋 Listing available backups...');
  
  try {
    const backupsSnapshot = await db.collection('backups').get();
    
    if (backupsSnapshot.empty) {
      console.log('❌ No backups found');
      return;
    }
    
    console.log(`📊 Found ${backupsSnapshot.size} backups:`);
    
    backupsSnapshot.docs.forEach(doc => {
      const backupData = doc.data();
      console.log(`\n📁 Backup ID: ${doc.id}`);
      console.log(`   Timestamp: ${backupData.timestamp?.toDate?.() || 'Unknown'}`);
      console.log(`   User Count: ${backupData.userCount || backupData.directorCount || 'Unknown'}`);
      console.log(`   Type: ${doc.id.includes('director') ? 'Director Sessions' : doc.id.includes('employee') ? 'Employee Sessions' : 'User Data'}`);
    });
    
  } catch (error) {
    console.error('❌ Error listing backups:', error);
  }
}

/**
 * Restore user data from backup
 */
async function restoreFromBackup(backupId) {
  console.log(`🔄 Restoring from backup: ${backupId}...`);
  
  try {
    const backupDoc = await db.collection('backups').doc(backupId).get();
    
    if (!backupDoc.exists) {
      console.log('❌ Backup not found');
      return;
    }
    
    const backupData = backupDoc.data();
    const userData = backupData.data;
    
    console.log(`📊 Found ${Object.keys(userData).length} users in backup`);
    
    let restoredCount = 0;
    let skippedCount = 0;
    
    for (const [userId, userInfo] of Object.entries(userData)) {
      console.log(`\n👤 Processing user: ${userInfo.name || userInfo.email} (${userId})`);
      
      // Only restore directors (they have the subscription data)
      if (userInfo.role === 'directeur') {
        // Restore the user with original data
        await db.collection('users').doc(userId).set({
          ...userInfo,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        console.log(`  ✅ Restored director data`);
        restoredCount++;
      } else {
        console.log(`  ⏭️  Skipping non-director`);
        skippedCount++;
      }
    }
    
    console.log(`\n✅ Restore completed!`);
    console.log(`📊 Restored: ${restoredCount} directors`);
    console.log(`⏭️  Skipped: ${skippedCount} non-directors`);
    
  } catch (error) {
    console.error('❌ Error during restore:', error);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--list')) {
    await listBackups();
  }
  
  if (args.includes('--restore') && args.length > 2) {
    const backupId = args[args.indexOf('--restore') + 1];
    await restoreFromBackup(backupId);
  }
  
  if (args.length === 0) {
    console.log('Usage: node restore-from-backup.js [--list] [--restore BACKUP_ID]');
    console.log('  --list                    List all available backups');
    console.log('  --restore BACKUP_ID       Restore from specific backup');
    console.log('\nExample: node restore-from-backup.js --list');
    console.log('Example: node restore-from-backup.js --restore user-data-1758858157685');
  }
  
  process.exit(0);
}

main().catch(console.error);

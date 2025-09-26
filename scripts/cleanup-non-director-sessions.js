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
 * Remove subscription sessions from non-director users
 */
async function cleanupNonDirectorSessions() {
  console.log('🧹 Starting cleanup of non-director sessions...');
  
  try {
    // Get all users
    const usersSnapshot = await db.collection('users').get();
    let processedCount = 0;
    let cleanedCount = 0;
    
    console.log(`📊 Found ${usersSnapshot.size} users to process`);
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      const userRole = userData.role;
      
      console.log(`\n👤 Processing user: ${userData.name || userData.email} (${userId}) - Role: ${userRole}`);
      
      // Only process non-director users
      if (userRole === 'directeur') {
        console.log(`  ✅ Director - keeping sessions`);
        continue;
      }
      
      // Check if user has sessions to remove
      const hasSessions = userData.subscriptionSessions && userData.subscriptionSessions.length > 0;
      const hasCurrentSessionId = userData.currentSessionId;
      
      if (hasSessions || hasCurrentSessionId) {
        console.log(`  🧹 Removing sessions from ${userRole}`);
        
        // Prepare update data - remove session-related fields
        const updateData = {
          subscriptionSessions: admin.firestore.FieldValue.delete(),
          currentSessionId: admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        // Update the user document
        await db.collection('users').doc(userId).update(updateData);
        
        console.log(`  ✅ Cleaned sessions for ${userRole} user ${userId}`);
        cleanedCount++;
      } else {
        console.log(`  ✅ No sessions to clean`);
      }
      
      processedCount++;
    }
    
    console.log(`\n✅ Non-director session cleanup completed!`);
    console.log(`📊 Processed: ${processedCount} users`);
    console.log(`🧹 Cleaned: ${cleanedCount} users`);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

/**
 * Validate that only directors have sessions
 */
async function validateDirectorOnlySessions() {
  console.log('\n🔍 Validating that only directors have sessions...');
  
  try {
    const usersSnapshot = await db.collection('users').get();
    
    let directorsWithSessions = 0;
    let directorsWithoutSessions = 0;
    let nonDirectorsWithSessions = 0;
    let nonDirectorsWithoutSessions = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userRole = userData.role;
      const hasSessions = userData.subscriptionSessions && userData.subscriptionSessions.length > 0;
      
      if (userRole === 'directeur') {
        if (hasSessions) {
          console.log(`  ✅ Director: ${userData.name || userData.email} - Has sessions`);
          directorsWithSessions++;
        } else {
          console.log(`  ❌ Director: ${userData.name || userData.email} - No sessions`);
          directorsWithoutSessions++;
        }
      } else {
        if (hasSessions) {
          console.log(`  ❌ ${userRole}: ${userData.name || userData.email} - Has sessions (should not)`);
          nonDirectorsWithSessions++;
        } else {
          console.log(`  ✅ ${userRole}: ${userData.name || userData.email} - No sessions (correct)`);
          nonDirectorsWithoutSessions++;
        }
      }
    }
    
    console.log(`\n📊 Validation results:`);
    console.log(`  👑 Directors with sessions: ${directorsWithSessions}`);
    console.log(`  ❌ Directors without sessions: ${directorsWithoutSessions}`);
    console.log(`  ❌ Non-directors with sessions: ${nonDirectorsWithSessions}`);
    console.log(`  ✅ Non-directors without sessions: ${nonDirectorsWithoutSessions}`);
    
    if (nonDirectorsWithSessions === 0 && directorsWithoutSessions === 0) {
      console.log(`\n🎉 Perfect! Only directors have sessions and all directors have sessions!`);
    } else if (nonDirectorsWithSessions === 0) {
      console.log(`\n✅ Good! No non-directors have sessions.`);
      if (directorsWithoutSessions > 0) {
        console.log(`⚠️  But ${directorsWithoutSessions} directors still need sessions.`);
      }
    } else {
      console.log(`\n⚠️  ${nonDirectorsWithSessions} non-directors still have sessions that need to be cleaned.`);
    }
    
  } catch (error) {
    console.error('❌ Error during validation:', error);
  }
}

/**
 * Create a backup before cleanup
 */
async function createBackup() {
  console.log('💾 Creating backup before cleanup...');
  
  try {
    const usersSnapshot = await db.collection('users').get();
    const backupData = {};
    
    usersSnapshot.docs.forEach(doc => {
      backupData[doc.id] = doc.data();
    });
    
    const backupRef = db.collection('backups').doc(`pre-cleanup-${Date.now()}`);
    await backupRef.set({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      userCount: usersSnapshot.size,
      data: backupData
    });
    
    console.log(`✅ Backup created: ${backupRef.id}`);
    
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
  
  if (args.includes('--cleanup')) {
    await cleanupNonDirectorSessions();
  }
  
  if (args.includes('--validate')) {
    await validateDirectorOnlySessions();
  }
  
  if (args.length === 0) {
    console.log('Usage: node cleanup-non-director-sessions.js [--backup] [--cleanup] [--validate]');
    console.log('  --backup   Create a backup before cleanup');
    console.log('  --cleanup  Remove sessions from non-director users');
    console.log('  --validate Validate that only directors have sessions');
    console.log('\nExample: node cleanup-non-director-sessions.js --backup --cleanup --validate');
  }
  
  process.exit(0);
}

main().catch(console.error);

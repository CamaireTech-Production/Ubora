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
 * Clean up user data by removing redundant fields and ensuring data consistency
 */
async function cleanupUserData() {
  console.log('🧹 Starting user data cleanup...');
  
  try {
    const usersSnapshot = await db.collection('users').get();
    let processedCount = 0;
    let cleanedCount = 0;
    
    console.log(`📊 Found ${usersSnapshot.size} users to process`);
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      
      console.log(`\n👤 Processing user: ${userData.name || userData.email} (${userId})`);
      
      // Check if user has redundant fields to clean
      const hasRedundantFields = userData.package || 
                                 userData.subscriptionStartDate || 
                                 userData.subscriptionEndDate || 
                                 userData.subscriptionStatus ||
                                 userData.payAsYouGoResources ||
                                 userData.payAsYouGoTokens ||
                                 userData.tokensUsedMonthly ||
                                 userData.tokensResetDate ||
                                 userData.packageFeatures;
      
      if (hasRedundantFields) {
        console.log(`  🧹 Found redundant fields to clean`);
        
        // Prepare update data - remove redundant fields
        const updateData = {
          // Remove redundant package fields
          package: admin.firestore.FieldValue.delete(),
          subscriptionStartDate: admin.firestore.FieldValue.delete(),
          subscriptionEndDate: admin.firestore.FieldValue.delete(),
          subscriptionStatus: admin.firestore.FieldValue.delete(),
          payAsYouGoResources: admin.firestore.FieldValue.delete(),
          payAsYouGoTokens: admin.firestore.FieldValue.delete(),
          tokensUsedMonthly: admin.firestore.FieldValue.delete(),
          tokensResetDate: admin.firestore.FieldValue.delete(),
          packageFeatures: admin.firestore.FieldValue.delete(),
          
          // Update timestamp
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        // Update the user document
        await db.collection('users').doc(userId).update(updateData);
        
        console.log(`  ✅ Cleaned redundant fields for user ${userId}`);
        cleanedCount++;
        
      } else {
        console.log(`  ✅ No redundant fields found for user ${userId}`);
      }
      
      // Check session status for logging
      if (userData.subscriptionSessions && userData.subscriptionSessions.length > 0) {
        const currentSession = userData.subscriptionSessions.find(
          session => session.id === userData.currentSessionId && session.isActive
        );
        
        if (currentSession) {
          console.log(`  📊 Active session: ${currentSession.packageType} (${currentSession.sessionType})`);
        } else {
          console.log(`  ⚠️  No active session found`);
        }
      } else {
        console.log(`  ⚠️  No subscription sessions found`);
      }
      
      processedCount++;
    }
    
    console.log(`\n✅ Cleanup completed!`);
    console.log(`📊 Processed: ${processedCount} users`);
    console.log(`🧹 Cleaned: ${cleanedCount} users`);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

/**
 * Validate data consistency after cleanup
 */
async function validateDataConsistency() {
  console.log('\n🔍 Validating data consistency...');
  
  try {
    const usersSnapshot = await db.collection('users').get();
    let validCount = 0;
    let invalidCount = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      
      // Check if user still has redundant fields
      const hasRedundantFields = userData.package || 
                                 userData.subscriptionStartDate || 
                                 userData.subscriptionEndDate || 
                                 userData.subscriptionStatus ||
                                 userData.payAsYouGoResources ||
                                 userData.payAsYouGoTokens ||
                                 userData.tokensUsedMonthly ||
                                 userData.tokensResetDate ||
                                 userData.packageFeatures;
      
      if (hasRedundantFields) {
        console.log(`  ❌ User ${userId} still has redundant fields`);
        invalidCount++;
      } else {
        validCount++;
      }
      
      // Check session consistency
      if (userData.subscriptionSessions && userData.currentSessionId) {
        const currentSession = userData.subscriptionSessions.find(
          session => session.id === userData.currentSessionId
        );
        
        if (!currentSession) {
          console.log(`  ❌ User ${userId} has invalid currentSessionId`);
          invalidCount++;
        } else if (!currentSession.isActive) {
          console.log(`  ❌ User ${userId} current session is not active`);
          invalidCount++;
        }
      }
    }
    
    console.log(`\n📊 Validation results:`);
    console.log(`  ✅ Valid users: ${validCount}`);
    console.log(`  ❌ Invalid users: ${invalidCount}`);
    
  } catch (error) {
    console.error('❌ Error during validation:', error);
  }
}

/**
 * Create a backup of user data before cleanup
 */
async function createBackup() {
  console.log('💾 Creating backup of user data...');
  
  try {
    const usersSnapshot = await db.collection('users').get();
    const backupData = {};
    
    usersSnapshot.docs.forEach(doc => {
      backupData[doc.id] = doc.data();
    });
    
    const backupRef = db.collection('backups').doc(`user-data-${Date.now()}`);
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
    await cleanupUserData();
  }
  
  if (args.includes('--validate')) {
    await validateDataConsistency();
  }
  
  if (args.length === 0) {
    console.log('Usage: node cleanup-user-data.js [--backup] [--cleanup] [--validate]');
    console.log('  --backup   Create a backup before cleanup');
    console.log('  --cleanup  Clean up redundant user data');
    console.log('  --validate Validate data consistency');
    console.log('\nExample: node cleanup-user-data.js --backup --cleanup --validate');
  }
  
  process.exit(0);
}

main().catch(console.error);

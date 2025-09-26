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
 * Reset session dates with proper Firestore timestamps
 */
async function resetSessionDates() {
  console.log('🔧 Starting session date reset...');
  
  try {
    const usersSnapshot = await db.collection('users').get();
    let processedCount = 0;
    let fixedCount = 0;
    
    console.log(`📊 Found ${usersSnapshot.size} users to process`);
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      
      console.log(`\n👤 Processing user: ${userData.name || userData.email} (${userId})`);
      
      const sessions = userData.subscriptionSessions || [];
      
      if (sessions.length === 0) {
        console.log(`  ⏭️  No sessions to fix`);
        continue;
      }
      
      let hasChanges = false;
      const updatedSessions = sessions.map(session => {
        // Create new proper dates
        const now = new Date();
        const endDate = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days from now
        
        console.log(`  🔧 Resetting dates for session: ${session.packageType} (${session.sessionType})`);
        hasChanges = true;
        
        return {
          ...session,
          startDate: now,
          endDate: endDate,
          createdAt: now,
          updatedAt: now
        };
      });
      
      if (hasChanges) {
        // Update the user document
        await db.collection('users').doc(userId).update({
          subscriptionSessions: updatedSessions,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`  ✅ Reset dates for user ${userId}`);
        fixedCount++;
      }
      
      processedCount++;
    }
    
    console.log(`\n✅ Session date reset completed!`);
    console.log(`📊 Processed: ${processedCount} users`);
    console.log(`🔧 Fixed: ${fixedCount} users`);
    
  } catch (error) {
    console.error('❌ Error during session date reset:', error);
  }
}

/**
 * Validate dates after reset
 */
async function validateDates() {
  console.log('\n🔍 Validating dates...');
  
  try {
    const usersSnapshot = await db.collection('users').get();
    let validCount = 0;
    let invalidCount = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      const sessions = userData.subscriptionSessions || [];
      
      let userValid = true;
      
      for (const session of sessions) {
        const startDate = new Date(session.startDate);
        const endDate = new Date(session.endDate);
        const createdAt = new Date(session.createdAt);
        const updatedAt = new Date(session.updatedAt);
        
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || 
            isNaN(createdAt.getTime()) || isNaN(updatedAt.getTime())) {
          console.log(`  ❌ ${userData.name || userData.email}: Invalid dates in session ${session.id}`);
          userValid = false;
        }
      }
      
      if (userValid && sessions.length > 0) {
        validCount++;
      } else if (sessions.length > 0) {
        invalidCount++;
      }
    }
    
    console.log(`\n📊 Validation results:`);
    console.log(`  ✅ Users with valid dates: ${validCount}`);
    console.log(`  ❌ Users with invalid dates: ${invalidCount}`);
    
    if (invalidCount === 0) {
      console.log(`\n🎉 All dates are now valid!`);
    }
    
  } catch (error) {
    console.error('❌ Error during validation:', error);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--reset')) {
    await resetSessionDates();
  }
  
  if (args.includes('--validate')) {
    await validateDates();
  }
  
  if (args.length === 0) {
    console.log('Usage: node reset-session-dates.js [--reset] [--validate]');
    console.log('  --reset    Reset session dates with proper timestamps');
    console.log('  --validate Validate dates');
    console.log('\nExample: node reset-session-dates.js --reset --validate');
  }
  
  process.exit(0);
}

main().catch(console.error);

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
 * Fix incorrect session types
 */
async function fixSessionTypes() {
  console.log('🔧 Fixing incorrect session types...');
  
  try {
    // Get all directors
    const directorsSnapshot = await db.collection('users')
      .where('role', '==', 'directeur')
      .get();
    
    let processedCount = 0;
    let fixedCount = 0;
    
    console.log(`📊 Found ${directorsSnapshot.size} directors to process`);
    
    for (const directorDoc of directorsSnapshot.docs) {
      const directorId = directorDoc.id;
      const directorData = directorDoc.data();
      
      console.log(`\n👤 Processing director: ${directorData.name || directorData.email} (${directorId})`);
      
      const sessions = directorData.subscriptionSessions || [];
      
      if (sessions.length === 0) {
        console.log(`  ⏭️  No sessions to fix`);
        continue;
      }
      
      let hasChanges = false;
      const updatedSessions = sessions.map((session, index) => {
        console.log(`  🔧 Checking session: ${session.packageType} (${session.sessionType})`);
        
        // Fix incorrect session types
        if (session.sessionType === 'pay_as_you_go') {
          console.log(`    ❌ Incorrect session type: ${session.sessionType}`);
          console.log(`    ✅ Fixing to: subscription`);
          hasChanges = true;
          
          return {
            ...session,
            sessionType: 'subscription' // All sessions should be subscription type
          };
        }
        
        return session;
      });
      
      if (hasChanges) {
        // Update the user document
        await db.collection('users').doc(directorId).update({
          subscriptionSessions: updatedSessions,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`  ✅ Fixed session types for user ${directorId}`);
        fixedCount++;
      } else {
        console.log(`  ✅ No changes needed`);
      }
      
      processedCount++;
    }
    
    console.log(`\n✅ Session type fix completed!`);
    console.log(`📊 Processed: ${processedCount} directors`);
    console.log(`🔧 Fixed: ${fixedCount} directors`);
    
  } catch (error) {
    console.error('❌ Error during session type fix:', error);
  }
}

/**
 * Validate the fix
 */
async function validateFix() {
  console.log('\n🔍 Validating the session type fix...');
  
  try {
    const directorsSnapshot = await db.collection('users')
      .where('role', '==', 'directeur')
      .get();
    
    let validCount = 0;
    let invalidCount = 0;
    
    for (const directorDoc of directorsSnapshot.docs) {
      const directorData = directorDoc.data();
      const directorId = directorDoc.id;
      const sessions = directorData.subscriptionSessions || [];
      
      let userValid = true;
      
      for (const session of sessions) {
        // Check if session type is correct
        if (session.sessionType === 'pay_as_you_go') {
          console.log(`  ❌ ${directorData.name || directorData.email}: Incorrect session type 'pay_as_you_go' in session ${session.id}`);
          userValid = false;
        } else if (session.sessionType === 'subscription') {
          console.log(`  ✅ ${directorData.name || directorData.email}: ${session.packageType} (${session.sessionType}) - Correct session type`);
        } else {
          console.log(`  ⚠️  ${directorData.name || directorData.email}: ${session.packageType} (${session.sessionType}) - Other session type`);
        }
      }
      
      if (userValid && sessions.length > 0) {
        validCount++;
      } else if (sessions.length > 0) {
        invalidCount++;
      }
    }
    
    console.log(`\n📊 Validation results:`);
    console.log(`  ✅ Directors with correct session types: ${validCount}`);
    console.log(`  ❌ Directors with incorrect session types: ${invalidCount}`);
    console.log(`  📈 Success rate: ${((validCount / directorsSnapshot.size) * 100).toFixed(1)}%`);
    
    if (invalidCount === 0) {
      console.log(`\n🎉 All session types are now correct!`);
    } else {
      console.log(`\n⚠️  ${invalidCount} directors still have incorrect session types.`);
    }
    
  } catch (error) {
    console.error('❌ Error during validation:', error);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--fix')) {
    await fixSessionTypes();
  }
  
  if (args.includes('--validate')) {
    await validateFix();
  }
  
  if (args.length === 0) {
    console.log('Usage: node fix-session-types.js [--fix] [--validate]');
    console.log('  --fix      Fix incorrect session types');
    console.log('  --validate Validate the fix');
    console.log('\nExample: node fix-session-types.js --fix --validate');
  }
  
  process.exit(0);
}

main().catch(console.error);

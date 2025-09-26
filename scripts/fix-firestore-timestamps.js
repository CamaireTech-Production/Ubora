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
 * Convert Firestore timestamp objects to proper Date objects
 */
function convertFirestoreTimestamp(timestampValue) {
  if (!timestampValue) return new Date();
  
  // If it's already a Date object
  if (timestampValue instanceof Date) {
    return timestampValue;
  }
  
  // If it's a Firestore Timestamp
  if (timestampValue && typeof timestampValue.toDate === 'function') {
    return timestampValue.toDate();
  }
  
  // If it's a Firestore timestamp object with _seconds
  if (timestampValue && typeof timestampValue === 'object' && timestampValue._seconds) {
    return new Date(timestampValue._seconds * 1000);
  }
  
  // If it's a string or number
  if (typeof timestampValue === 'string' || typeof timestampValue === 'number') {
    const date = new Date(timestampValue);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  
  // Default to current date
  return new Date();
}

/**
 * Fix Firestore timestamps in session data
 */
async function fixFirestoreTimestamps() {
  console.log('🔧 Starting Firestore timestamp fixes...');
  
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
        const originalStartDate = session.startDate;
        const originalEndDate = session.endDate;
        const originalCreatedAt = session.createdAt;
        const originalUpdatedAt = session.updatedAt;
        
        const convertedStartDate = convertFirestoreTimestamp(originalStartDate);
        const convertedEndDate = convertFirestoreTimestamp(originalEndDate);
        const convertedCreatedAt = convertFirestoreTimestamp(originalCreatedAt);
        const convertedUpdatedAt = convertFirestoreTimestamp(originalUpdatedAt);
        
        // Check if any dates need fixing
        const needsFix = 
          JSON.stringify(originalStartDate) !== JSON.stringify(convertedStartDate) ||
          JSON.stringify(originalEndDate) !== JSON.stringify(convertedEndDate) ||
          JSON.stringify(originalCreatedAt) !== JSON.stringify(convertedCreatedAt) ||
          JSON.stringify(originalUpdatedAt) !== JSON.stringify(convertedUpdatedAt);
        
        if (needsFix) {
          console.log(`  🔧 Fixing timestamps for session: ${session.packageType} (${session.sessionType})`);
          hasChanges = true;
        }
        
        return {
          ...session,
          startDate: convertedStartDate,
          endDate: convertedEndDate,
          createdAt: convertedCreatedAt,
          updatedAt: convertedUpdatedAt
        };
      });
      
      if (hasChanges) {
        // Update the user document
        await db.collection('users').doc(userId).update({
          subscriptionSessions: updatedSessions,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`  ✅ Fixed timestamps for user ${userId}`);
        fixedCount++;
      } else {
        console.log(`  ✅ No timestamp fixes needed`);
      }
      
      processedCount++;
    }
    
    console.log(`\n✅ Firestore timestamp fixes completed!`);
    console.log(`📊 Processed: ${processedCount} users`);
    console.log(`🔧 Fixed: ${fixedCount} users`);
    
  } catch (error) {
    console.error('❌ Error during Firestore timestamp fixes:', error);
  }
}

/**
 * Validate timestamps after fixing
 */
async function validateTimestamps() {
  console.log('\n🔍 Validating timestamps...');
  
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
          console.log(`  ❌ ${userData.name || userData.email}: Invalid timestamps in session ${session.id}`);
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
    console.log(`  ✅ Users with valid timestamps: ${validCount}`);
    console.log(`  ❌ Users with invalid timestamps: ${invalidCount}`);
    
    if (invalidCount === 0) {
      console.log(`\n🎉 All timestamps are now valid!`);
    }
    
  } catch (error) {
    console.error('❌ Error during validation:', error);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--fix')) {
    await fixFirestoreTimestamps();
  }
  
  if (args.includes('--validate')) {
    await validateTimestamps();
  }
  
  if (args.length === 0) {
    console.log('Usage: node fix-firestore-timestamps.js [--fix] [--validate]');
    console.log('  --fix      Fix Firestore timestamps for all users');
    console.log('  --validate Validate timestamps');
    console.log('\nExample: node fix-firestore-timestamps.js --fix --validate');
  }
  
  process.exit(0);
}

main().catch(console.error);

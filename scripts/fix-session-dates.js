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
 * Convert various date formats to proper Date objects
 */
function normalizeDate(dateValue) {
  if (!dateValue) return new Date();
  
  // If it's already a Date object
  if (dateValue instanceof Date) {
    return dateValue;
  }
  
  // If it's a Firestore Timestamp
  if (dateValue && typeof dateValue.toDate === 'function') {
    return dateValue.toDate();
  }
  
  // If it's a string or number
  if (typeof dateValue === 'string' || typeof dateValue === 'number') {
    const date = new Date(dateValue);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  
  // If it's an object with seconds (Firestore timestamp format)
  if (dateValue && typeof dateValue === 'object' && dateValue.seconds) {
    return new Date(dateValue.seconds * 1000);
  }
  
  // Default to current date
  return new Date();
}

/**
 * Fix session dates for all users
 */
async function fixSessionDates() {
  console.log('🔧 Starting session date fixes...');
  
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
        
        const normalizedStartDate = normalizeDate(originalStartDate);
        const normalizedEndDate = normalizeDate(originalEndDate);
        const normalizedCreatedAt = normalizeDate(originalCreatedAt);
        const normalizedUpdatedAt = normalizeDate(originalUpdatedAt);
        
        // Check if any dates need fixing
        const needsFix = 
          originalStartDate !== normalizedStartDate ||
          originalEndDate !== normalizedEndDate ||
          originalCreatedAt !== normalizedCreatedAt ||
          originalUpdatedAt !== normalizedUpdatedAt;
        
        if (needsFix) {
          console.log(`  🔧 Fixing dates for session: ${session.packageType} (${session.sessionType})`);
          hasChanges = true;
        }
        
        return {
          ...session,
          startDate: normalizedStartDate,
          endDate: normalizedEndDate,
          createdAt: normalizedCreatedAt,
          updatedAt: normalizedUpdatedAt
        };
      });
      
      if (hasChanges) {
        // Update the user document
        await db.collection('users').doc(userId).update({
          subscriptionSessions: updatedSessions,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`  ✅ Fixed session dates for user ${userId}`);
        fixedCount++;
      } else {
        console.log(`  ✅ No date fixes needed`);
      }
      
      processedCount++;
    }
    
    console.log(`\n✅ Session date fixes completed!`);
    console.log(`📊 Processed: ${processedCount} users`);
    console.log(`🔧 Fixed: ${fixedCount} users`);
    
  } catch (error) {
    console.error('❌ Error during session date fixes:', error);
  }
}

/**
 * Validate session dates after fixing
 */
async function validateSessionDates() {
  console.log('\n🔍 Validating session dates...');
  
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
    console.log(`  ✅ Users with valid session dates: ${validCount}`);
    console.log(`  ❌ Users with invalid session dates: ${invalidCount}`);
    
    if (invalidCount === 0) {
      console.log(`\n🎉 All session dates are now valid!`);
    }
    
  } catch (error) {
    console.error('❌ Error during validation:', error);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--fix')) {
    await fixSessionDates();
  }
  
  if (args.includes('--validate')) {
    await validateSessionDates();
  }
  
  if (args.length === 0) {
    console.log('Usage: node fix-session-dates.js [--fix] [--validate]');
    console.log('  --fix      Fix session dates for all users');
    console.log('  --validate Validate session dates');
    console.log('\nExample: node fix-session-dates.js --fix --validate');
  }
  
  process.exit(0);
}

main().catch(console.error);

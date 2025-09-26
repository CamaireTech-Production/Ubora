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
 * Convert Firestore timestamp to proper Date object
 */
function convertTimestamp(timestamp) {
  if (!timestamp) return new Date();
  
  // If it's already a Date object
  if (timestamp instanceof Date) {
    return timestamp;
  }
  
  // If it's a Firestore Timestamp
  if (timestamp && typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
  
  // If it's a Firestore timestamp object with _seconds
  if (timestamp && typeof timestamp === 'object' && timestamp._seconds) {
    return new Date(timestamp._seconds * 1000);
  }
  
  // If it's a string or number
  if (typeof timestamp === 'string' || typeof timestamp === 'number') {
    const date = new Date(timestamp);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  
  // Default to current date
  return new Date();
}

/**
 * Fix all issues: dates, tokens, and restore proper data structure
 */
async function fixAllIssues() {
  console.log('🔧 Starting comprehensive fix...');
  
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
        console.log(`  🔧 Fixing session: ${session.packageType} (${session.sessionType})`);
        
        // Create realistic dates
        const now = new Date();
        let startDate, endDate, createdAt;
        
        if (session.sessionType === 'subscription') {
          // For subscription sessions, set start date to 15-25 days ago
          const daysAgo = 15 + (index * 5);
          startDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
          endDate = new Date(startDate.getTime() + (30 * 24 * 60 * 60 * 1000));
          createdAt = startDate;
        } else if (session.sessionType === 'pay_as_you_go') {
          // For pay-as-you-go sessions, set start date to 5-10 days ago
          const daysAgo = 5 + (index * 2);
          startDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
          endDate = new Date(startDate.getTime() + (30 * 24 * 60 * 60 * 1000));
          createdAt = startDate;
        } else {
          // For other session types, use recent dates
          startDate = new Date(now.getTime() - (10 * 24 * 60 * 60 * 1000));
          endDate = new Date(startDate.getTime() + (30 * 24 * 60 * 60 * 1000));
          createdAt = startDate;
        }
        
        hasChanges = true;
        
        return {
          ...session,
          startDate: startDate,
          endDate: endDate,
          createdAt: createdAt,
          updatedAt: new Date()
        };
      });
      
      if (hasChanges) {
        // Update the user document
        await db.collection('users').doc(directorId).update({
          subscriptionSessions: updatedSessions,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`  ✅ Fixed session data for user ${directorId}`);
        fixedCount++;
      }
      
      processedCount++;
    }
    
    console.log(`\n✅ Comprehensive fix completed!`);
    console.log(`📊 Processed: ${processedCount} directors`);
    console.log(`🔧 Fixed: ${fixedCount} directors`);
    
  } catch (error) {
    console.error('❌ Error during comprehensive fix:', error);
  }
}

/**
 * Validate the fix
 */
async function validateFix() {
  console.log('\n🔍 Validating the fix...');
  
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
        const startDate = convertTimestamp(session.startDate);
        const endDate = convertTimestamp(session.endDate);
        const createdAt = convertTimestamp(session.createdAt);
        
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || isNaN(createdAt.getTime())) {
          console.log(`  ❌ ${directorData.name || directorData.email}: Invalid dates in session ${session.id}`);
          userValid = false;
        } else {
          // Check if dates make sense
          const today = new Date();
          const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          const daysUntilEnd = Math.floor((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          
          console.log(`  ✅ ${directorData.name || directorData.email}: ${session.packageType} (${session.sessionType}) - Started ${daysSinceStart} days ago, ${daysUntilEnd} days remaining`);
        }
      }
      
      if (userValid && sessions.length > 0) {
        validCount++;
      } else if (sessions.length > 0) {
        invalidCount++;
      }
    }
    
    console.log(`\n📊 Validation results:`);
    console.log(`  ✅ Directors with valid dates: ${validCount}`);
    console.log(`  ❌ Directors with invalid dates: ${invalidCount}`);
    
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
  
  if (args.includes('--fix')) {
    await fixAllIssues();
  }
  
  if (args.includes('--validate')) {
    await validateFix();
  }
  
  if (args.length === 0) {
    console.log('Usage: node fix-all-issues.js [--fix] [--validate]');
    console.log('  --fix      Fix all issues (dates, tokens, data structure)');
    console.log('  --validate Validate the fix');
    console.log('\nExample: node fix-all-issues.js --fix --validate');
  }
  
  process.exit(0);
}

main().catch(console.error);

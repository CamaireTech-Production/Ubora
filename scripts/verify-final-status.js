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
 * Verify final status of all directors
 */
async function verifyFinalStatus() {
  console.log('🔍 Verifying final status of all directors...');
  
  try {
    const directorsSnapshot = await db.collection('users')
      .where('role', '==', 'directeur')
      .get();
    
    console.log(`📊 Found ${directorsSnapshot.size} directors to verify`);
    
    let validCount = 0;
    let invalidCount = 0;
    
    for (const directorDoc of directorsSnapshot.docs) {
      const directorData = directorDoc.data();
      const directorId = directorDoc.id;
      const sessions = directorData.subscriptionSessions || [];
      
      console.log(`\n👤 Director: ${directorData.name || directorData.email} (${directorId})`);
      
      if (sessions.length === 0) {
        console.log(`  ❌ No sessions found`);
        invalidCount++;
        continue;
      }
      
      // Find active session
      const activeSession = sessions.find(s => s.isActive);
      
      if (!activeSession) {
        console.log(`  ❌ No active session found`);
        invalidCount++;
        continue;
      }
      
      console.log(`  📦 Package: ${activeSession.packageType} (${activeSession.sessionType})`);
      console.log(`  💰 Amount Paid: ${activeSession.amountPaid} FCFA`);
      console.log(`  🎯 Tokens: ${activeSession.tokensUsed}/${activeSession.tokensIncluded}`);
      
      // Check dates
      const startDate = convertTimestamp(activeSession.startDate);
      const endDate = convertTimestamp(activeSession.endDate);
      const createdAt = convertTimestamp(activeSession.createdAt);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || isNaN(createdAt.getTime())) {
        console.log(`  ❌ Invalid dates found`);
        console.log(`     Start: ${activeSession.startDate} -> ${startDate}`);
        console.log(`     End: ${activeSession.endDate} -> ${endDate}`);
        console.log(`     Created: ${activeSession.createdAt} -> ${createdAt}`);
        invalidCount++;
      } else {
        const today = new Date();
        const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const daysUntilEnd = Math.floor((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        console.log(`  ✅ Valid dates:`);
        console.log(`     Started: ${startDate.toLocaleDateString('fr-FR')} (${daysSinceStart} days ago)`);
        console.log(`     Ends: ${endDate.toLocaleDateString('fr-FR')} (${daysUntilEnd} days remaining)`);
        console.log(`     Created: ${createdAt.toLocaleDateString('fr-FR')}`);
        
        validCount++;
      }
      
      // Check consumption data
      if (activeSession.consumption) {
        console.log(`  📊 Consumption:`);
        console.log(`     Forms: ${activeSession.consumption.formsCreated || 0}`);
        console.log(`     Dashboards: ${activeSession.consumption.dashboardsCreated || 0}`);
        console.log(`     Users: ${activeSession.consumption.usersAdded || 0}`);
        console.log(`     Tokens: ${activeSession.consumption.tokensConsumed || 0}`);
      }
    }
    
    console.log(`\n📊 Final Verification Results:`);
    console.log(`  ✅ Directors with valid data: ${validCount}`);
    console.log(`  ❌ Directors with issues: ${invalidCount}`);
    console.log(`  📈 Success rate: ${((validCount / directorsSnapshot.size) * 100).toFixed(1)}%`);
    
    if (invalidCount === 0) {
      console.log(`\n🎉 All directors have valid data! The system is ready.`);
    } else {
      console.log(`\n⚠️  ${invalidCount} directors still have issues that need attention.`);
    }
    
  } catch (error) {
    console.error('❌ Error during verification:', error);
  }
}

// Main execution
async function main() {
  await verifyFinalStatus();
  process.exit(0);
}

main().catch(console.error);

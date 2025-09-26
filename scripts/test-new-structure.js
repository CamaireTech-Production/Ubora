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
 * Test the new structure
 */
async function testNewStructure() {
  console.log('🧪 Testing new session structure...');
  
  try {
    const directorsSnapshot = await db.collection('users')
      .where('role', '==', 'directeur')
      .get();
    
    console.log(`📊 Found ${directorsSnapshot.size} directors to test`);
    
    for (const directorDoc of directorsSnapshot.docs) {
      const directorData = directorDoc.data();
      const directorId = directorDoc.id;
      const sessions = directorData.subscriptionSessions || [];
      
      console.log(`\n👤 Testing director: ${directorData.name || directorData.email} (${directorId})`);
      
      if (sessions.length === 0) {
        console.log(`  ❌ No sessions found`);
        continue;
      }
      
      // Find active session
      const activeSession = sessions.find(s => s.isActive);
      
      if (!activeSession) {
        console.log(`  ❌ No active session found`);
        continue;
      }
      
      console.log(`  📦 Package: ${activeSession.packageType} (${activeSession.sessionType})`);
      
      // Test package resources
      if (activeSession.packageResources) {
        console.log(`  ✅ Package Resources:`);
        console.log(`     Tokens: ${activeSession.packageResources.tokensIncluded}`);
        console.log(`     Forms: ${activeSession.packageResources.formsIncluded}`);
        console.log(`     Dashboards: ${activeSession.packageResources.dashboardsIncluded}`);
        console.log(`     Users: ${activeSession.packageResources.usersIncluded}`);
      } else {
        console.log(`  ❌ Missing packageResources`);
      }
      
      // Test pay-as-you-go resources
      if (activeSession.payAsYouGoResources) {
        console.log(`  ✅ Pay-as-you-go Resources:`);
        console.log(`     Tokens: ${activeSession.payAsYouGoResources.tokens}`);
        console.log(`     Forms: ${activeSession.payAsYouGoResources.forms}`);
        console.log(`     Dashboards: ${activeSession.payAsYouGoResources.dashboards}`);
        console.log(`     Users: ${activeSession.payAsYouGoResources.users}`);
        console.log(`     Purchases: ${activeSession.payAsYouGoResources.purchases.length} purchases`);
      } else {
        console.log(`  ❌ Missing payAsYouGoResources`);
      }
      
      // Test usage tracking
      if (activeSession.usage) {
        console.log(`  ✅ Usage Tracking:`);
        console.log(`     Tokens Used: ${activeSession.usage.tokensUsed}`);
        console.log(`     Forms Created: ${activeSession.usage.formsCreated}`);
        console.log(`     Dashboards Created: ${activeSession.usage.dashboardsCreated}`);
        console.log(`     Users Added: ${activeSession.usage.usersAdded}`);
      } else {
        console.log(`  ❌ Missing usage tracking`);
      }
      
      // Test dates
      const startDate = convertTimestamp(activeSession.startDate);
      const endDate = convertTimestamp(activeSession.endDate);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        console.log(`  ❌ Invalid dates`);
      } else {
        const today = new Date();
        const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const daysUntilEnd = Math.floor((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        console.log(`  ✅ Valid Dates:`);
        console.log(`     Started: ${startDate.toLocaleDateString('fr-FR')} (${daysSinceStart} days ago)`);
        console.log(`     Ends: ${endDate.toLocaleDateString('fr-FR')} (${daysUntilEnd} days remaining)`);
      }
      
      // Calculate totals
      const packageTokens = activeSession.packageResources?.tokensIncluded || 0;
      const payAsYouGoTokens = activeSession.payAsYouGoResources?.tokens || 0;
      const totalTokens = packageTokens + payAsYouGoTokens;
      const tokensUsed = activeSession.usage?.tokensUsed || 0;
      const tokensRemaining = Math.max(0, totalTokens - tokensUsed);
      
      console.log(`  📊 Token Calculation:`);
      console.log(`     Package Tokens: ${packageTokens}`);
      console.log(`     Pay-as-you-go Tokens: ${payAsYouGoTokens}`);
      console.log(`     Total Available: ${totalTokens}`);
      console.log(`     Used: ${tokensUsed}`);
      console.log(`     Remaining: ${tokensRemaining}`);
    }
    
    console.log(`\n🎉 New structure test completed!`);
    
  } catch (error) {
    console.error('❌ Error during testing:', error);
  }
}

// Main execution
async function main() {
  await testNewStructure();
  process.exit(0);
}

main().catch(console.error);

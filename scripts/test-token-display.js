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
 * Test token display for subscription history
 */
async function testTokenDisplay() {
  console.log('🧪 Testing token display for subscription history...');
  
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
      
      // Test each session
      sessions.forEach((session, index) => {
        console.log(`\n  📦 Session ${index + 1}: ${session.packageType} (${session.sessionType})`);
        
        // Test package resources
        if (session.packageResources) {
          const packageTokens = session.packageResources.tokensIncluded || 0;
          console.log(`    ✅ Package Tokens: ${packageTokens.toLocaleString()}`);
        } else {
          console.log(`    ❌ Missing packageResources`);
        }
        
        // Test pay-as-you-go resources
        if (session.payAsYouGoResources) {
          const payAsYouGoTokens = session.payAsYouGoResources.tokens || 0;
          console.log(`    ✅ Pay-as-you-go Tokens: ${payAsYouGoTokens.toLocaleString()}`);
        } else {
          console.log(`    ❌ Missing payAsYouGoResources`);
        }
        
        // Test usage
        if (session.usage) {
          const tokensUsed = session.usage.tokensUsed || 0;
          console.log(`    ✅ Tokens Used: ${tokensUsed.toLocaleString()}`);
        } else {
          console.log(`    ❌ Missing usage tracking`);
        }
        
        // Calculate totals (like in the modal)
        const packageTokens = session.packageResources?.tokensIncluded || 0;
        const payAsYouGoTokens = session.payAsYouGoResources?.tokens || 0;
        const totalTokens = packageTokens + payAsYouGoTokens;
        const tokensUsed = session.usage?.tokensUsed || 0;
        const remainingTokens = Math.max(0, totalTokens - tokensUsed);
        
        console.log(`    📊 Modal Display: ${tokensUsed.toLocaleString()} / ${totalTokens.toLocaleString()} tokens`);
        if (payAsYouGoTokens > 0) {
          console.log(`    💰 Pay-as-you-go indication: (+${payAsYouGoTokens.toLocaleString()} pay-as-you-go)`);
        }
        console.log(`    🎯 Remaining: ${remainingTokens.toLocaleString()} tokens`);
      });
      
      // Test summary statistics (like in the modal)
      const totalAmountPaid = sessions.reduce((sum, session) => sum + session.amountPaid, 0);
      const totalTokensPurchased = sessions.reduce((sum, session) => {
        const packageTokens = session.packageResources?.tokensIncluded || 0;
        const payAsYouGoTokens = session.payAsYouGoResources?.tokens || 0;
        return sum + packageTokens + payAsYouGoTokens;
      }, 0);
      const totalTokensUsed = sessions.reduce((sum, session) => sum + (session.usage?.tokensUsed || 0), 0);
      
      console.log(`\n  📈 Summary Statistics:`);
      console.log(`    💰 Total Amount Paid: ${totalAmountPaid.toLocaleString()} FCFA`);
      console.log(`    🎯 Total Tokens Purchased: ${totalTokensPurchased.toLocaleString()}`);
      console.log(`    📊 Total Tokens Used: ${totalTokensUsed.toLocaleString()}`);
    }
    
    console.log(`\n🎉 Token display test completed!`);
    
  } catch (error) {
    console.error('❌ Error during testing:', error);
  }
}

// Main execution
async function main() {
  await testTokenDisplay();
  process.exit(0);
}

main().catch(console.error);


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
 * Test the new pay-as-you-go display functionality
 */
async function testPayAsYouGoDisplay() {
  console.log('🧪 Testing pay-as-you-go display functionality...');
  
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
      
      const activeSession = sessions.find(s => s.isActive);
      if (!activeSession) {
        console.log(`  ❌ No active session found`);
        continue;
      }
      
      console.log(`  📦 Active session: ${activeSession.packageType} (${activeSession.sessionType})`);
      
      // Test package resources
      const packageResources = activeSession.packageResources || {};
      const payAsYouGoResources = activeSession.payAsYouGoResources || {};
      const usage = activeSession.usage || {};
      
      console.log(`\n  📊 Package Resources:`);
      console.log(`    🎯 Tokens: ${packageResources.tokensIncluded?.toLocaleString() || 0}`);
      console.log(`    📝 Forms: ${packageResources.formsIncluded || 0}`);
      console.log(`    📊 Dashboards: ${packageResources.dashboardsIncluded || 0}`);
      console.log(`    👥 Users: ${packageResources.usersIncluded || 0}`);
      
      console.log(`\n  💰 Pay-as-you-go Resources:`);
      console.log(`    🎯 Tokens: ${payAsYouGoResources.tokens?.toLocaleString() || 0}`);
      console.log(`    📝 Forms: ${payAsYouGoResources.forms || 0}`);
      console.log(`    📊 Dashboards: ${payAsYouGoResources.dashboards || 0}`);
      console.log(`    👥 Users: ${payAsYouGoResources.users || 0}`);
      
      console.log(`\n  📈 Usage:`);
      console.log(`    🎯 Tokens Used: ${usage.tokensUsed?.toLocaleString() || 0}`);
      console.log(`    📝 Forms Created: ${usage.formsCreated || 0}`);
      console.log(`    📊 Dashboards Created: ${usage.dashboardsCreated || 0}`);
      console.log(`    👥 Users Added: ${usage.usersAdded || 0}`);
      
      // Calculate totals (like in the frontend)
      const totalTokens = (packageResources.tokensIncluded || 0) + (payAsYouGoResources.tokens || 0);
      const totalForms = (packageResources.formsIncluded || 0) + (payAsYouGoResources.forms || 0);
      const totalDashboards = (packageResources.dashboardsIncluded || 0) + (payAsYouGoResources.dashboards || 0);
      const totalUsers = (packageResources.usersIncluded || 0) + (payAsYouGoResources.users || 0);
      
      console.log(`\n  🎯 Total Available Resources:`);
      console.log(`    🎯 Total Tokens: ${totalTokens.toLocaleString()}`);
      console.log(`    📝 Total Forms: ${totalForms}`);
      console.log(`    📊 Total Dashboards: ${totalDashboards}`);
      console.log(`    👥 Total Users: ${totalUsers}`);
      
      // Calculate remaining
      const remainingTokens = Math.max(0, totalTokens - (usage.tokensUsed || 0));
      const remainingForms = Math.max(0, totalForms - (usage.formsCreated || 0));
      const remainingDashboards = Math.max(0, totalDashboards - (usage.dashboardsCreated || 0));
      const remainingUsers = Math.max(0, totalUsers - (usage.usersAdded || 0));
      
      console.log(`\n  ✅ Remaining Resources:`);
      console.log(`    🎯 Remaining Tokens: ${remainingTokens.toLocaleString()}`);
      console.log(`    📝 Remaining Forms: ${remainingForms}`);
      console.log(`    📊 Remaining Dashboards: ${remainingDashboards}`);
      console.log(`    👥 Remaining Users: ${remainingUsers}`);
      
      // Test pay-as-you-go display logic
      const hasPayAsYouGoTokens = (payAsYouGoResources.tokens || 0) > 0;
      const hasPayAsYouGoForms = (payAsYouGoResources.forms || 0) > 0;
      const hasPayAsYouGoDashboards = (payAsYouGoResources.dashboards || 0) > 0;
      const hasPayAsYouGoUsers = (payAsYouGoResources.users || 0) > 0;
      
      console.log(`\n  🎨 Pay-as-you-go Display Logic:`);
      console.log(`    💰 Should show pay-as-you-go section: ${hasPayAsYouGoTokens || hasPayAsYouGoForms || hasPayAsYouGoDashboards || hasPayAsYouGoUsers}`);
      
      if (hasPayAsYouGoTokens || hasPayAsYouGoForms || hasPayAsYouGoDashboards || hasPayAsYouGoUsers) {
        console.log(`    📋 Pay-as-you-go resources to display:`);
        if (hasPayAsYouGoTokens) {
          console.log(`      🎯 +${payAsYouGoResources.tokens.toLocaleString()} tokens`);
        }
        if (hasPayAsYouGoForms) {
          console.log(`      📝 +${payAsYouGoResources.forms} forms`);
        }
        if (hasPayAsYouGoDashboards) {
          console.log(`      📊 +${payAsYouGoResources.dashboards} dashboards`);
        }
        if (hasPayAsYouGoUsers) {
          console.log(`      👥 +${payAsYouGoResources.users} users`);
        }
      }
      
      // Test subscription history modal display
      console.log(`\n  📜 Subscription History Modal Display:`);
      const modalTokensUsed = usage.tokensUsed?.toLocaleString() || 0;
      const modalTotalTokens = totalTokens.toLocaleString();
      console.log(`    📊 Modal: "${modalTokensUsed} / ${modalTotalTokens} tokens"`);
      if (hasPayAsYouGoTokens) {
        console.log(`    💰 Pay-as-you-go indication: "(+${payAsYouGoResources.tokens.toLocaleString()} pay-as-you-go)"`);
      }
    }
    
    console.log(`\n🎉 Pay-as-you-go display test completed!`);
    
  } catch (error) {
    console.error('❌ Error during testing:', error);
  }
}

// Main execution
async function main() {
  await testPayAsYouGoDisplay();
  process.exit(0);
}

main().catch(console.error);

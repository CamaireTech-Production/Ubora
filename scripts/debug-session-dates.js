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
 * Debug session dates to understand the format
 */
async function debugSessionDates() {
  console.log('🔍 Debugging session dates...');
  
  try {
    const usersSnapshot = await db.collection('users').get();
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const sessions = userData.subscriptionSessions || [];
      
      if (sessions.length > 0) {
        console.log(`\n👤 User: ${userData.name || userData.email}`);
        
        for (const session of sessions) {
          console.log(`  📅 Session: ${session.packageType} (${session.sessionType})`);
          console.log(`    startDate: ${JSON.stringify(session.startDate)} (type: ${typeof session.startDate})`);
          console.log(`    endDate: ${JSON.stringify(session.endDate)} (type: ${typeof session.endDate})`);
          console.log(`    createdAt: ${JSON.stringify(session.createdAt)} (type: ${typeof session.createdAt})`);
          console.log(`    updatedAt: ${JSON.stringify(session.updatedAt)} (type: ${typeof session.updatedAt})`);
          
          // Try to convert to Date
          try {
            const startDate = new Date(session.startDate);
            const endDate = new Date(session.endDate);
            console.log(`    startDate as Date: ${startDate.toISOString()}`);
            console.log(`    endDate as Date: ${endDate.toISOString()}`);
          } catch (error) {
            console.log(`    Date conversion error: ${error.message}`);
          }
        }
        
        // Only show first user for debugging
        break;
      }
    }
    
  } catch (error) {
    console.error('❌ Error debugging session dates:', error);
  }
}

// Main execution
async function main() {
  await debugSessionDates();
  process.exit(0);
}

main().catch(console.error);

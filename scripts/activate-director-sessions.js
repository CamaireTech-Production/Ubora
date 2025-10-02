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
 * Generate a unique session ID
 */
function generateSessionId() {
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Create a default starter session for directors without sessions
 */
async function createDefaultStarterSession(userId, userData) {
  const sessionId = generateSessionId();
  const now = new Date();
  const endDate = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days from now
  
  const defaultSession = {
    id: sessionId,
    packageType: 'starter',
    sessionType: 'subscription',
    startDate: now,
    endDate: endDate,
    amountPaid: 0, // Free starter plan
    durationDays: 30,
    tokensIncluded: 10000, // Starter plan tokens
    tokensUsed: 0,
    isActive: true,
    paymentMethod: 'default',
    notes: 'Default starter session created automatically',
    createdAt: now,
    updatedAt: now,
    consumption: {
      formsCreated: 0,
      dashboardsCreated: 0,
      usersAdded: 0,
      tokensConsumed: 0
    }
  };
  
  return defaultSession;
}

/**
 * Activate existing inactive sessions
 */
function activateSession(session) {
  const now = new Date();
  const sessionEndDate = session.endDate instanceof Date ? session.endDate : new Date(session.endDate);
  
  // If session is expired, extend it by 30 days
  if (sessionEndDate.getTime() <= now.getTime()) {
    const newEndDate = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
    return {
      ...session,
      isActive: true,
      startDate: now,
      endDate: newEndDate,
      durationDays: 30,
      updatedAt: now
    };
  }
  
  // If session is not expired, just activate it
  return {
    ...session,
    isActive: true,
    updatedAt: now
  };
}

/**
 * Process all directors to ensure they have active sessions
 */
async function activateDirectorSessions() {
  console.log('🎯 Starting director session activation...');
  
  try {
    // Get all users with role 'directeur'
    const directorsSnapshot = await db.collection('users')
      .where('role', '==', 'directeur')
      .get();
    
    console.log(`📊 Found ${directorsSnapshot.size} directors to process`);
    
    let processedCount = 0;
    let createdSessionsCount = 0;
    let activatedSessionsCount = 0;
    let alreadyActiveCount = 0;
    
    for (const directorDoc of directorsSnapshot.docs) {
      const directorId = directorDoc.id;
      const directorData = directorDoc.data();
      
      console.log(`\n👤 Processing director: ${directorData.name || directorData.email} (${directorId})`);
      
      // Get current sessions
      const currentSessions = directorData.subscriptionSessions || [];
      
      // Check if there's an active session
      const activeSession = currentSessions.find(session => session.isActive);
      
      if (activeSession) {
        console.log(`  ✅ Already has active session: ${activeSession.packageType} (${activeSession.sessionType})`);
        alreadyActiveCount++;
      } else {
        // Check if there are any inactive sessions
        const inactiveSessions = currentSessions.filter(session => !session.isActive);
        
        if (inactiveSessions.length > 0) {
          // Activate the most recent inactive session
          const latestInactiveSession = inactiveSessions.sort((a, b) => {
            const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
            const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
            return dateB.getTime() - dateA.getTime();
          })[0];
          
          console.log(`  🔄 Activating existing session: ${latestInactiveSession.packageType} (${latestInactiveSession.sessionType})`);
          
          // Update the session to be active
          const updatedSessions = currentSessions.map(session => 
            session.id === latestInactiveSession.id ? activateSession(session) : session
          );
          
          // Update user document
          await db.collection('users').doc(directorId).update({
            subscriptionSessions: updatedSessions,
            currentSessionId: latestInactiveSession.id,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          
          activatedSessionsCount++;
          
        } else {
          // No sessions at all, create a default starter session
          console.log(`  🆕 Creating default starter session`);
          
          const defaultSession = await createDefaultStarterSession(directorId, directorData);
          const updatedSessions = [...currentSessions, defaultSession];
          
          // Update user document
          await db.collection('users').doc(directorId).update({
            subscriptionSessions: updatedSessions,
            currentSessionId: defaultSession.id,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          
          createdSessionsCount++;
        }
      }
      
      processedCount++;
    }
    
    console.log(`\n✅ Director session activation completed!`);
    console.log(`📊 Processed: ${processedCount} directors`);
    console.log(`✅ Already active: ${alreadyActiveCount} directors`);
    console.log(`🔄 Activated existing: ${activatedSessionsCount} directors`);
    console.log(`🆕 Created new starter: ${createdSessionsCount} directors`);
    
  } catch (error) {
    console.error('❌ Error during director session activation:', error);
  }
}

/**
 * Validate that all directors now have active sessions
 */
async function validateDirectorSessions() {
  console.log('\n🔍 Validating director sessions...');
  
  try {
    const directorsSnapshot = await db.collection('users')
      .where('role', '==', 'directeur')
      .get();
    
    let validCount = 0;
    let invalidCount = 0;
    
    for (const directorDoc of directorsSnapshot.docs) {
      const directorData = directorDoc.data();
      const directorId = directorDoc.id;
      
      const currentSessions = directorData.subscriptionSessions || [];
      const activeSession = currentSessions.find(session => session.isActive);
      
      if (activeSession) {
        console.log(`  ✅ ${directorData.name || directorData.email}: ${activeSession.packageType} (${activeSession.sessionType})`);
        validCount++;
      } else {
        console.log(`  ❌ ${directorData.name || directorData.email}: No active session`);
        invalidCount++;
      }
    }
    
    console.log(`\n📊 Validation results:`);
    console.log(`  ✅ Directors with active sessions: ${validCount}`);
    console.log(`  ❌ Directors without active sessions: ${invalidCount}`);
    
    if (invalidCount === 0) {
      console.log(`\n🎉 All directors now have active subscription sessions!`);
    }
    
  } catch (error) {
    console.error('❌ Error during validation:', error);
  }
}

/**
 * Create a backup of director data before activation
 */
async function createBackup() {
  console.log('💾 Creating backup of director data...');
  
  try {
    const directorsSnapshot = await db.collection('users')
      .where('role', '==', 'directeur')
      .get();
    
    const backupData = {};
    
    directorsSnapshot.docs.forEach(doc => {
      backupData[doc.id] = doc.data();
    });
    
    const backupRef = db.collection('backups').doc(`director-sessions-${Date.now()}`);
    await backupRef.set({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      directorCount: directorsSnapshot.size,
      data: backupData
    });
    
    console.log(`✅ Backup created: ${backupRef.id}`);
    
  } catch (error) {
    console.error('❌ Error creating backup:', error);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--backup')) {
    await createBackup();
  }
  
  if (args.includes('--activate')) {
    await activateDirectorSessions();
  }
  
  if (args.includes('--validate')) {
    await validateDirectorSessions();
  }
  
  if (args.length === 0) {
    console.log('Usage: node activate-director-sessions.js [--backup] [--activate] [--validate]');
    console.log('  --backup   Create a backup before activation');
    console.log('  --activate Activate sessions for all directors');
    console.log('  --validate Validate that all directors have active sessions');
    console.log('\nExample: node activate-director-sessions.js --backup --activate --validate');
  }
  
  process.exit(0);
}

main().catch(console.error);

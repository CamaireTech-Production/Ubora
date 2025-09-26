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
 * Create a default starter session for employees without sessions
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
    notes: 'Default starter session created automatically for employee',
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
 * Process all employees to ensure they have active sessions
 */
async function activateEmployeeSessions() {
  console.log('🎯 Starting employee session activation...');
  
  try {
    // Get all users with role 'employe'
    const employeesSnapshot = await db.collection('users')
      .where('role', '==', 'employe')
      .get();
    
    console.log(`📊 Found ${employeesSnapshot.size} employees to process`);
    
    let processedCount = 0;
    let createdSessionsCount = 0;
    let activatedSessionsCount = 0;
    let alreadyActiveCount = 0;
    let skippedCount = 0;
    
    for (const employeeDoc of employeesSnapshot.docs) {
      const employeeId = employeeDoc.id;
      const employeeData = employeeDoc.data();
      
      console.log(`\n👤 Processing employee: ${employeeData.name || employeeData.email} (${employeeId})`);
      
      // Check if employee is approved
      if (!employeeData.isApproved) {
        console.log(`  ⏭️  Skipping unapproved employee`);
        skippedCount++;
        continue;
      }
      
      // Get current sessions
      const currentSessions = employeeData.subscriptionSessions || [];
      
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
          await db.collection('users').doc(employeeId).update({
            subscriptionSessions: updatedSessions,
            currentSessionId: latestInactiveSession.id,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          
          activatedSessionsCount++;
          
        } else {
          // No sessions at all, create a default starter session
          console.log(`  🆕 Creating default starter session`);
          
          const defaultSession = await createDefaultStarterSession(employeeId, employeeData);
          const updatedSessions = [...currentSessions, defaultSession];
          
          // Update user document
          await db.collection('users').doc(employeeId).update({
            subscriptionSessions: updatedSessions,
            currentSessionId: defaultSession.id,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          
          createdSessionsCount++;
        }
      }
      
      processedCount++;
    }
    
    console.log(`\n✅ Employee session activation completed!`);
    console.log(`📊 Processed: ${processedCount} employees`);
    console.log(`⏭️  Skipped (unapproved): ${skippedCount} employees`);
    console.log(`✅ Already active: ${alreadyActiveCount} employees`);
    console.log(`🔄 Activated existing: ${activatedSessionsCount} employees`);
    console.log(`🆕 Created new starter: ${createdSessionsCount} employees`);
    
  } catch (error) {
    console.error('❌ Error during employee session activation:', error);
  }
}

/**
 * Validate that all approved employees now have active sessions
 */
async function validateEmployeeSessions() {
  console.log('\n🔍 Validating employee sessions...');
  
  try {
    const employeesSnapshot = await db.collection('users')
      .where('role', '==', 'employe')
      .get();
    
    let validCount = 0;
    let invalidCount = 0;
    let unapprovedCount = 0;
    
    for (const employeeDoc of employeesSnapshot.docs) {
      const employeeData = employeeDoc.data();
      const employeeId = employeeDoc.id;
      
      if (!employeeData.isApproved) {
        console.log(`  ⏭️  ${employeeData.name || employeeData.email}: Unapproved (skipped)`);
        unapprovedCount++;
        continue;
      }
      
      const currentSessions = employeeData.subscriptionSessions || [];
      const activeSession = currentSessions.find(session => session.isActive);
      
      if (activeSession) {
        console.log(`  ✅ ${employeeData.name || employeeData.email}: ${activeSession.packageType} (${activeSession.sessionType})`);
        validCount++;
      } else {
        console.log(`  ❌ ${employeeData.name || employeeData.email}: No active session`);
        invalidCount++;
      }
    }
    
    console.log(`\n📊 Validation results:`);
    console.log(`  ⏭️  Unapproved employees (skipped): ${unapprovedCount}`);
    console.log(`  ✅ Approved employees with active sessions: ${validCount}`);
    console.log(`  ❌ Approved employees without active sessions: ${invalidCount}`);
    
    if (invalidCount === 0) {
      console.log(`\n🎉 All approved employees now have active subscription sessions!`);
    }
    
  } catch (error) {
    console.error('❌ Error during validation:', error);
  }
}

/**
 * Create a backup of employee data before activation
 */
async function createBackup() {
  console.log('💾 Creating backup of employee data...');
  
  try {
    const employeesSnapshot = await db.collection('users')
      .where('role', '==', 'employe')
      .get();
    
    const backupData = {};
    
    employeesSnapshot.docs.forEach(doc => {
      backupData[doc.id] = doc.data();
    });
    
    const backupRef = db.collection('backups').doc(`employee-sessions-${Date.now()}`);
    await backupRef.set({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      employeeCount: employeesSnapshot.size,
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
    await activateEmployeeSessions();
  }
  
  if (args.includes('--validate')) {
    await validateEmployeeSessions();
  }
  
  if (args.length === 0) {
    console.log('Usage: node activate-employee-sessions.js [--backup] [--activate] [--validate]');
    console.log('  --backup   Create a backup before activation');
    console.log('  --activate Activate sessions for all approved employees');
    console.log('  --validate Validate that all approved employees have active sessions');
    console.log('\nExample: node activate-employee-sessions.js --backup --activate --validate');
  }
  
  process.exit(0);
}

main().catch(console.error);

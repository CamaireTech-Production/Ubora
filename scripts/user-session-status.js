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
 * Get session status summary
 */
function getSessionStatus(userData) {
  const sessions = userData.subscriptionSessions || [];
  
  if (sessions.length === 0) {
    return { status: 'no_sessions', activeSession: null, totalSessions: 0 };
  }
  
  const activeSession = sessions.find(session => session.isActive);
  const inactiveSessions = sessions.filter(session => !session.isActive);
  
  if (activeSession) {
    return {
      status: 'active',
      activeSession,
      totalSessions: sessions.length,
      inactiveSessions: inactiveSessions.length
    };
  } else {
    return {
      status: 'inactive',
      activeSession: null,
      totalSessions: sessions.length,
      inactiveSessions: inactiveSessions.length
    };
  }
}

/**
 * Format date for display
 */
function formatDate(date) {
  if (!date) return 'N/A';
  
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Calculate days remaining
 */
function getDaysRemaining(endDate) {
  if (!endDate) return 0;
  
  const end = endDate instanceof Date ? endDate : new Date(endDate);
  const now = new Date();
  const diffTime = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
}

/**
 * Display comprehensive user session status
 */
async function displayUserSessionStatus() {
  console.log('📊 User Session Status Report');
  console.log('=' .repeat(80));
  
  try {
    // Get all users
    const usersSnapshot = await db.collection('users').get();
    
    const usersByRole = {
      admin: [],
      directeur: [],
      employe: []
    };
    
    // Group users by role
    usersSnapshot.docs.forEach(doc => {
      const userData = doc.data();
      const role = userData.role || 'unknown';
      
      if (usersByRole[role]) {
        usersByRole[role].push({
          id: doc.id,
          ...userData
        });
      }
    });
    
    // Process each role
    for (const [role, users] of Object.entries(usersByRole)) {
      if (users.length === 0) continue;
      
      console.log(`\n👥 ${role.toUpperCase()}S (${users.length} users)`);
      console.log('-'.repeat(60));
      
      let activeCount = 0;
      let inactiveCount = 0;
      let noSessionsCount = 0;
      
      for (const user of users) {
        const sessionStatus = getSessionStatus(user);
        const name = user.name || user.email || 'Unknown';
        
        // Count by status
        if (sessionStatus.status === 'active') activeCount++;
        else if (sessionStatus.status === 'inactive') inactiveCount++;
        else noSessionsCount++;
        
        // Display user info
        let statusIcon = '❌';
        let statusText = '';
        let sessionInfo = '';
        
        if (sessionStatus.status === 'active') {
          statusIcon = '✅';
          statusText = 'ACTIVE';
          const daysRemaining = getDaysRemaining(sessionStatus.activeSession.endDate);
          sessionInfo = `${sessionStatus.activeSession.packageType} (${sessionStatus.activeSession.sessionType}) - ${daysRemaining} days left`;
        } else if (sessionStatus.status === 'inactive') {
          statusIcon = '⚠️';
          statusText = 'INACTIVE';
          sessionInfo = `${sessionStatus.totalSessions} sessions (all inactive)`;
        } else {
          statusIcon = '❌';
          statusText = 'NO SESSIONS';
          sessionInfo = 'No subscription sessions';
        }
        
        // Additional info for employees
        let additionalInfo = '';
        if (role === 'employe' && !user.isApproved) {
          additionalInfo = ' [UNAPPROVED]';
        }
        
        console.log(`  ${statusIcon} ${name}${additionalInfo}`);
        console.log(`     Status: ${statusText}`);
        console.log(`     Session: ${sessionInfo}`);
        
        if (sessionStatus.activeSession) {
          console.log(`     Tokens: ${sessionStatus.activeSession.tokensUsed}/${sessionStatus.activeSession.tokensIncluded}`);
          console.log(`     Start: ${formatDate(sessionStatus.activeSession.startDate)}`);
          console.log(`     End: ${formatDate(sessionStatus.activeSession.endDate)}`);
        }
        
        console.log('');
      }
      
      // Summary for this role
      console.log(`📈 ${role.toUpperCase()} SUMMARY:`);
      console.log(`   ✅ Active sessions: ${activeCount}`);
      console.log(`   ⚠️  Inactive sessions: ${inactiveCount}`);
      console.log(`   ❌ No sessions: ${noSessionsCount}`);
      console.log(`   📊 Total: ${users.length}`);
    }
    
    // Overall summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 OVERALL SUMMARY');
    console.log('='.repeat(80));
    
    const totalUsers = usersSnapshot.size;
    const totalActive = Object.values(usersByRole).flat().filter(user => {
      const status = getSessionStatus(user);
      return status.status === 'active';
    }).length;
    
    const totalInactive = Object.values(usersByRole).flat().filter(user => {
      const status = getSessionStatus(user);
      return status.status === 'inactive';
    }).length;
    
    const totalNoSessions = Object.values(usersByRole).flat().filter(user => {
      const status = getSessionStatus(user);
      return status.status === 'no_sessions';
    }).length;
    
    console.log(`👥 Total Users: ${totalUsers}`);
    console.log(`✅ Users with Active Sessions: ${totalActive}`);
    console.log(`⚠️  Users with Inactive Sessions: ${totalInactive}`);
    console.log(`❌ Users with No Sessions: ${totalNoSessions}`);
    
    const activePercentage = ((totalActive / totalUsers) * 100).toFixed(1);
    console.log(`📈 Active Session Rate: ${activePercentage}%`);
    
    if (totalActive === totalUsers) {
      console.log('\n🎉 All users have active subscription sessions!');
    } else {
      console.log(`\n⚠️  ${totalUsers - totalActive} users still need active sessions.`);
    }
    
  } catch (error) {
    console.error('❌ Error generating status report:', error);
  }
}

// Main execution
async function main() {
  await displayUserSessionStatus();
  process.exit(0);
}

main().catch(console.error);

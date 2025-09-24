/**
 * Fix unrealistic subscription dates and durations in Firebase
 * This script corrects subscription sessions that have unrealistic dates
 * and ensures all subscriptions follow proper monthly billing cycles
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load service account
const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, '../studio-gpnfx-firebase-adminsdk-fbsvc-eed44532ba.json'), 'utf8')
);

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Package limits for calculating tokens
const PACKAGE_LIMITS = {
  starter: { monthlyTokens: 60000 },
  standard: { monthlyTokens: 120000 },
  premium: { monthlyTokens: 300000 },
  custom: { monthlyTokens: 300000 } // Default for custom
};

// Package prices in FCFA
const PACKAGE_PRICES = {
  starter: 35000,
  standard: 85000,
  premium: 160000,
  custom: 250000
};

/**
 * Convert Firestore Timestamp to Date
 */
function convertToDate(timestamp) {
  if (timestamp instanceof Date) {
    return timestamp;
  }
  if (timestamp && typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
  if (timestamp && typeof timestamp === 'string') {
    return new Date(timestamp);
  }
  if (timestamp && typeof timestamp === 'number') {
    return new Date(timestamp);
  }
  return new Date();
}

/**
 * Check if a date is realistic (not in the future beyond reasonable limits)
 */
function isDateRealistic(date) {
  const now = new Date();
  const oneYearFromNow = new Date(now.getTime() + (365 * 24 * 60 * 60 * 1000));
  const oneYearAgo = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000));
  
  return date >= oneYearAgo && date <= oneYearFromNow;
}

/**
 * Check if duration is realistic (should be around 30 days for monthly subscriptions)
 */
function isDurationRealistic(durationDays) {
  // Allow some flexibility: 25-35 days for monthly subscriptions
  return durationDays >= 25 && durationDays <= 35;
}

/**
 * Fix a subscription session with realistic dates
 */
function fixSubscriptionSession(session, userCreatedAt) {
  const now = new Date();
  const userCreated = convertToDate(userCreatedAt);
  
  // Use the later of user creation date or session creation date as start date
  const sessionCreated = convertToDate(session.createdAt);
  const realisticStartDate = sessionCreated > userCreated ? sessionCreated : userCreated;
  
  // Ensure start date is not in the future
  const startDate = realisticStartDate > now ? now : realisticStartDate;
  
  // Set end date to exactly 30 days from start date (monthly subscription)
  const endDate = new Date(startDate.getTime() + (30 * 24 * 60 * 60 * 1000));
  
  // Calculate realistic duration (should be 30 days)
  const durationDays = 30;
  
  // Calculate realistic amount paid (full monthly price)
  const monthlyPrice = PACKAGE_PRICES[session.packageType] || PACKAGE_PRICES.starter;
  const amountPaid = monthlyPrice;
  
  // Calculate realistic tokens included (full monthly tokens)
  const monthlyTokens = PACKAGE_LIMITS[session.packageType].monthlyTokens;
  const tokensIncluded = monthlyTokens;
  
  // Keep existing tokens used, but cap it at tokens included
  const tokensUsed = Math.min(session.tokensUsed || 0, tokensIncluded);
  
  return {
    ...session,
    startDate,
    endDate,
    durationDays,
    amountPaid,
    tokensIncluded,
    tokensUsed,
    updatedAt: now,
    notes: `Corrigé automatiquement - ${session.packageType} mensuel`
  };
}

/**
 * Fix a single user's subscription sessions
 */
async function fixUserSubscriptions(userId, userData) {
  try {
    console.log(`🔧 Fixing user: ${userId}`);
    
    if (!userData.subscriptionSessions || userData.subscriptionSessions.length === 0) {
      console.log(`⏭️  User ${userId} has no subscription sessions, skipping`);
      return { success: true, message: 'No sessions to fix' };
    }
    
    let needsFix = false;
    const fixedSessions = [];
    
    // Check and fix each session
    for (const session of userData.subscriptionSessions) {
      const startDate = convertToDate(session.startDate);
      const endDate = convertToDate(session.endDate);
      const durationDays = session.durationDays || Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Check if session needs fixing
      const hasUnrealisticDates = !isDateRealistic(startDate) || !isDateRealistic(endDate);
      const hasUnrealisticDuration = !isDurationRealistic(durationDays);
      const hasUnrealisticTokens = session.tokensIncluded > (PACKAGE_LIMITS[session.packageType].monthlyTokens * 2);
      
      if (hasUnrealisticDates || hasUnrealisticDuration || hasUnrealisticTokens) {
        console.log(`  🔧 Fixing session ${session.id}:`);
        console.log(`    - Start: ${startDate.toISOString().split('T')[0]}`);
        console.log(`    - End: ${endDate.toISOString().split('T')[0]}`);
        console.log(`    - Duration: ${durationDays} days`);
        console.log(`    - Tokens: ${session.tokensIncluded}`);
        
        const fixedSession = fixSubscriptionSession(session, userData.createdAt);
        fixedSessions.push(fixedSession);
        needsFix = true;
        
        console.log(`    ✅ Fixed to:`);
        console.log(`    - Start: ${fixedSession.startDate.toISOString().split('T')[0]}`);
        console.log(`    - End: ${fixedSession.endDate.toISOString().split('T')[0]}`);
        console.log(`    - Duration: ${fixedSession.durationDays} days`);
        console.log(`    - Tokens: ${fixedSession.tokensIncluded}`);
      } else {
        fixedSessions.push(session);
      }
    }
    
    // Update user document if fixes were made
    if (needsFix) {
      const updateData = {
        subscriptionSessions: fixedSessions,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      await db.collection('users').doc(userId).update(updateData);
      console.log(`✅ Fixed user ${userId}: ${fixedSessions.length} sessions updated`);
      return { success: true, sessionsFixed: fixedSessions.length };
    } else {
      console.log(`✅ User ${userId}: No fixes needed`);
      return { success: true, sessionsFixed: 0 };
    }
    
  } catch (error) {
    console.error(`❌ Error fixing user ${userId}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Main fix function
 */
async function fixAllSubscriptionDates() {
  try {
    console.log('🚀 Starting subscription date fixes...');
    
    // Get all users with subscription sessions
    const usersSnapshot = await db.collection('users')
      .where('role', '==', 'directeur')
      .get();
    
    console.log(`📊 Found ${usersSnapshot.size} directors to check`);
    
    let successCount = 0;
    let errorCount = 0;
    let totalSessionsFixed = 0;
    const results = [];
    
    // Process each user
    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      const userId = doc.id;
      
      // Skip if no subscription sessions
      if (!userData.subscriptionSessions || userData.subscriptionSessions.length === 0) {
        console.log(`⏭️  User ${userId} has no subscription sessions, skipping`);
        continue;
      }
      
      const result = await fixUserSubscriptions(userId, userData);
      results.push({ userId, ...result });
      
      if (result.success) {
        successCount++;
        totalSessionsFixed += result.sessionsFixed || 0;
      } else {
        errorCount++;
      }
      
      // Add small delay to avoid overwhelming Firestore
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n📈 Fix Summary:');
    console.log(`✅ Successful fixes: ${successCount}`);
    console.log(`❌ Failed fixes: ${errorCount}`);
    console.log(`🔧 Total sessions fixed: ${totalSessionsFixed}`);
    console.log(`📊 Total processed: ${successCount + errorCount}`);
    
    // Log errors
    const errors = results.filter(r => !r.success);
    if (errors.length > 0) {
      console.log('\n❌ Errors:');
      errors.forEach(error => {
        console.log(`  - ${error.userId}: ${error.error}`);
      });
    }
    
    console.log('\n🎉 Date fixes completed!');
    
  } catch (error) {
    console.error('💥 Fix process failed:', error);
  }
}

/**
 * Verify fix results
 */
async function verifyFixes() {
  try {
    console.log('🔍 Verifying fix results...');
    
    const usersSnapshot = await db.collection('users')
      .where('role', '==', 'directeur')
      .get();
    
    let realisticCount = 0;
    let unrealisticCount = 0;
    const issues = [];
    
    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      
      if (userData.subscriptionSessions && userData.subscriptionSessions.length > 0) {
        for (const session of userData.subscriptionSessions) {
          const startDate = convertToDate(session.startDate);
          const endDate = convertToDate(session.endDate);
          const durationDays = session.durationDays || Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          
          const hasUnrealisticDates = !isDateRealistic(startDate) || !isDateRealistic(endDate);
          const hasUnrealisticDuration = !isDurationRealistic(durationDays);
          const hasUnrealisticTokens = session.tokensIncluded > (PACKAGE_LIMITS[session.packageType].monthlyTokens * 2);
          
          if (hasUnrealisticDates || hasUnrealisticDuration || hasUnrealisticTokens) {
            unrealisticCount++;
            issues.push({
              userId: doc.id,
              sessionId: session.id,
              startDate: startDate.toISOString().split('T')[0],
              endDate: endDate.toISOString().split('T')[0],
              durationDays,
              tokensIncluded: session.tokensIncluded
            });
          } else {
            realisticCount++;
          }
        }
      }
    }
    
    console.log(`✅ Realistic sessions: ${realisticCount}`);
    console.log(`❌ Unrealistic sessions: ${unrealisticCount}`);
    
    if (issues.length > 0) {
      console.log('\n❌ Remaining issues:');
      issues.forEach(issue => {
        console.log(`  - User ${issue.userId}, Session ${issue.sessionId}:`);
        console.log(`    Start: ${issue.startDate}, End: ${issue.endDate}, Duration: ${issue.durationDays} days, Tokens: ${issue.tokensIncluded}`);
      });
    }
    
  } catch (error) {
    console.error('Error verifying fixes:', error);
  }
}

// Run fix if this script is executed directly
const command = process.argv[2];

if (command === 'verify') {
  verifyFixes().then(() => process.exit(0));
} else {
  fixAllSubscriptionDates().then(() => process.exit(0));
}

export {
  fixAllSubscriptionDates,
  verifyFixes,
  fixUserSubscriptions
};

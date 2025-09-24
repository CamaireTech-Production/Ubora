/**
 * Migration script to convert existing subscriptions to the new session system
 * This script should be run once to migrate all existing user subscriptions
 * to the new subscription sessions format.
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
 * Generate unique session ID
 */
function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Convert existing subscription to session format
 */
function createSessionFromLegacySubscription(userData, userId) {
  const now = new Date();
  
  // Get subscription dates - ensure realistic dates
  const startDate = userData.subscriptionStartDate ? 
    userData.subscriptionStartDate.toDate() : 
    userData.createdAt ? userData.createdAt.toDate() : now;
    
  // Always set end date to exactly 30 days from start date (monthly subscription)
  const endDate = new Date(startDate.getTime() + (30 * 24 * 60 * 60 * 1000));
  
  // Calculate duration
  const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Get package type
  const packageType = userData.package || 'starter';
  
  // Calculate amount paid (full monthly price for monthly subscriptions)
  const monthlyPrice = PACKAGE_PRICES[packageType] || PACKAGE_PRICES.starter;
  const amountPaid = monthlyPrice; // Always full monthly price
  
  // Calculate tokens included (full monthly tokens for monthly subscriptions)
  const monthlyTokens = PACKAGE_LIMITS[packageType].monthlyTokens;
  const tokensIncluded = monthlyTokens; // Always full monthly tokens
  
  // Get tokens used
  const tokensUsed = userData.tokensUsedMonthly || 0;
  
  // Determine session type
  let sessionType = 'subscription';
  if (userData.payAsYouGoTokens && userData.payAsYouGoTokens > 0) {
    sessionType = 'pay_as_you_go';
  }
  
  return {
    id: generateSessionId(),
    packageType,
    sessionType,
    startDate,
    endDate,
    amountPaid,
    durationDays,
    tokensIncluded,
    tokensUsed,
    isActive: userData.subscriptionStatus === 'active',
    paymentMethod: 'migration',
    notes: `Migré depuis l'ancien système - ${packageType}`,
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Migrate a single user's subscription
 */
async function migrateUserSubscription(userId, userData) {
  try {
    console.log(`🔄 Migrating user: ${userId}`);
    
    // Create session from legacy data
    const session = createSessionFromLegacySubscription(userData, userId);
    
    // Prepare update data
    const updateData = {
      subscriptionSessions: [session],
      currentSessionId: session.id,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // Update user document
    await db.collection('users').doc(userId).update(updateData);
    
    console.log(`✅ Migrated user ${userId}: ${session.packageType} session created`);
    return { success: true, session };
    
  } catch (error) {
    console.error(`❌ Error migrating user ${userId}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Main migration function
 */
async function migrateAllSubscriptions() {
  try {
    console.log('🚀 Starting subscription migration...');
    
    // Get all users with subscriptions
    const usersSnapshot = await db.collection('users')
      .where('role', '==', 'directeur')
      .get();
    
    console.log(`📊 Found ${usersSnapshot.size} directors to migrate`);
    
    let successCount = 0;
    let errorCount = 0;
    const results = [];
    
    // Process each user
    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      const userId = doc.id;
      
      // Skip if already migrated
      if (userData.subscriptionSessions && userData.subscriptionSessions.length > 0) {
        console.log(`⏭️  User ${userId} already migrated, skipping`);
        continue;
      }
      
      // Skip if no package
      if (!userData.package) {
        console.log(`⏭️  User ${userId} has no package, skipping`);
        continue;
      }
      
      const result = await migrateUserSubscription(userId, userData);
      results.push({ userId, ...result });
      
      if (result.success) {
        successCount++;
      } else {
        errorCount++;
      }
      
      // Add small delay to avoid overwhelming Firestore
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n📈 Migration Summary:');
    console.log(`✅ Successful migrations: ${successCount}`);
    console.log(`❌ Failed migrations: ${errorCount}`);
    console.log(`📊 Total processed: ${successCount + errorCount}`);
    
    // Log errors
    const errors = results.filter(r => !r.success);
    if (errors.length > 0) {
      console.log('\n❌ Errors:');
      errors.forEach(error => {
        console.log(`  - ${error.userId}: ${error.error}`);
      });
    }
    
    console.log('\n🎉 Migration completed!');
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
  }
}

/**
 * Verify migration results
 */
async function verifyMigration() {
  try {
    console.log('🔍 Verifying migration results...');
    
    const usersSnapshot = await db.collection('users')
      .where('role', '==', 'directeur')
      .get();
    
    let migratedCount = 0;
    let notMigratedCount = 0;
    
    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      
      if (userData.subscriptionSessions && userData.subscriptionSessions.length > 0) {
        migratedCount++;
      } else if (userData.package) {
        notMigratedCount++;
      }
    }
    
    console.log(`✅ Migrated users: ${migratedCount}`);
    console.log(`❌ Not migrated users: ${notMigratedCount}`);
    
  } catch (error) {
    console.error('Error verifying migration:', error);
  }
}

// Run migration if this script is executed directly
const command = process.argv[2];

if (command === 'verify') {
  verifyMigration().then(() => process.exit(0));
} else {
  migrateAllSubscriptions().then(() => process.exit(0));
}

export {
  migrateAllSubscriptions,
  verifyMigration,
  migrateUserSubscription
};

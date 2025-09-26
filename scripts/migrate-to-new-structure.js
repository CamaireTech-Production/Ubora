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
 * Package limits mapping
 */
const PACKAGE_LIMITS = {
  starter: {
    maxTokens: 300000, // 300k tokens
    maxForms: 4,
    maxDashboards: 1,
    maxUsers: 3
  },
  standard: {
    maxTokens: 600000, // 600k tokens
    maxForms: -1, // unlimited
    maxDashboards: -1, // unlimited
    maxUsers: 7
  },
  premium: {
    maxTokens: 1500000, // 1.5M tokens
    maxForms: -1, // unlimited
    maxDashboards: -1, // unlimited
    maxUsers: 20
  },
  custom: {
    maxTokens: -1, // unlimited/negotiable
    maxForms: -1, // unlimited
    maxDashboards: -1, // unlimited
    maxUsers: -1 // unlimited
  }
};

/**
 * Migrate all directors to new session structure
 */
async function migrateToNewStructure() {
  console.log('🔄 Starting migration to new session structure...');
  
  try {
    // Get all directors
    const directorsSnapshot = await db.collection('users')
      .where('role', '==', 'directeur')
      .get();
    
    let processedCount = 0;
    let migratedCount = 0;
    
    console.log(`📊 Found ${directorsSnapshot.size} directors to migrate`);
    
    for (const directorDoc of directorsSnapshot.docs) {
      const directorId = directorDoc.id;
      const directorData = directorDoc.data();
      
      console.log(`\n👤 Processing director: ${directorData.name || directorData.email} (${directorId})`);
      
      const sessions = directorData.subscriptionSessions || [];
      
      if (sessions.length === 0) {
        console.log(`  ⏭️  No sessions to migrate`);
        continue;
      }
      
      let hasChanges = false;
      const updatedSessions = sessions.map((session, index) => {
        console.log(`  🔧 Migrating session: ${session.packageType} (${session.sessionType})`);
        
        // Get package limits
        const packageLimits = PACKAGE_LIMITS[session.packageType] || PACKAGE_LIMITS.starter;
        
        // Convert dates
        const startDate = convertTimestamp(session.startDate);
        const endDate = convertTimestamp(session.endDate);
        const createdAt = convertTimestamp(session.createdAt);
        const updatedAt = convertTimestamp(session.updatedAt);
        
        hasChanges = true;
        
        return {
          ...session,
          startDate: startDate,
          endDate: endDate,
          createdAt: createdAt,
          updatedAt: updatedAt,
          
          // Package resources from the selected package
          packageResources: {
            tokensIncluded: packageLimits.maxTokens,
            formsIncluded: packageLimits.maxForms,
            dashboardsIncluded: packageLimits.maxDashboards,
            usersIncluded: packageLimits.maxUsers
          },
          
          // Initialize pay-as-you-go resources (empty by default)
          payAsYouGoResources: {
            tokens: 0,
            forms: 0,
            dashboards: 0,
            users: 0,
            purchases: []
          },
          
          // Migrate usage from old consumption structure
          usage: {
            tokensUsed: session.tokensUsed || 0,
            formsCreated: session.consumption?.formsCreated || 0,
            dashboardsCreated: session.consumption?.dashboardsCreated || 0,
            usersAdded: session.consumption?.usersAdded || 0,
            ...(session.consumption?.lastTokenUsed && { lastTokenUsed: convertTimestamp(session.consumption.lastTokenUsed) }),
            ...(session.consumption?.lastFormCreated && { lastFormCreated: convertTimestamp(session.consumption.lastFormCreated) }),
            ...(session.consumption?.lastDashboardCreated && { lastDashboardCreated: convertTimestamp(session.consumption.lastDashboardCreated) }),
            ...(session.consumption?.lastUserAdded && { lastUserAdded: convertTimestamp(session.consumption.lastUserAdded) })
          }
        };
      });
      
      if (hasChanges) {
        // Update the user document
        await db.collection('users').doc(directorId).update({
          subscriptionSessions: updatedSessions,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`  ✅ Migrated session data for user ${directorId}`);
        migratedCount++;
      }
      
      processedCount++;
    }
    
    console.log(`\n✅ Migration completed!`);
    console.log(`📊 Processed: ${processedCount} directors`);
    console.log(`🔧 Migrated: ${migratedCount} directors`);
    
  } catch (error) {
    console.error('❌ Error during migration:', error);
  }
}

/**
 * Validate the migration
 */
async function validateMigration() {
  console.log('\n🔍 Validating the migration...');
  
  try {
    const directorsSnapshot = await db.collection('users')
      .where('role', '==', 'directeur')
      .get();
    
    let validCount = 0;
    let invalidCount = 0;
    
    for (const directorDoc of directorsSnapshot.docs) {
      const directorData = directorDoc.data();
      const directorId = directorDoc.id;
      const sessions = directorData.subscriptionSessions || [];
      
      let userValid = true;
      
      for (const session of sessions) {
        // Check if new structure exists
        if (!session.packageResources || !session.usage) {
          console.log(`  ❌ ${directorData.name || directorData.email}: Missing new structure in session ${session.id}`);
          userValid = false;
        } else {
          // Check if dates are valid
          const startDate = convertTimestamp(session.startDate);
          const endDate = convertTimestamp(session.endDate);
          
          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            console.log(`  ❌ ${directorData.name || directorData.email}: Invalid dates in session ${session.id}`);
            userValid = false;
          } else {
            const today = new Date();
            const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            const daysUntilEnd = Math.floor((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            
            console.log(`  ✅ ${directorData.name || directorData.email}: ${session.packageType} (${session.sessionType}) - Started ${daysSinceStart} days ago, ${daysUntilEnd} days remaining`);
            console.log(`     Package: ${session.packageResources.tokensIncluded} tokens, ${session.packageResources.formsIncluded} forms, ${session.packageResources.dashboardsIncluded} dashboards, ${session.packageResources.usersIncluded} users`);
            console.log(`     Usage: ${session.usage.tokensUsed} tokens used, ${session.usage.formsCreated} forms, ${session.usage.dashboardsCreated} dashboards, ${session.usage.usersAdded} users`);
            console.log(`     Pay-as-you-go: ${session.payAsYouGoResources?.tokens || 0} tokens, ${session.payAsYouGoResources?.forms || 0} forms, ${session.payAsYouGoResources?.dashboards || 0} dashboards, ${session.payAsYouGoResources?.users || 0} users`);
          }
        }
      }
      
      if (userValid && sessions.length > 0) {
        validCount++;
      } else if (sessions.length > 0) {
        invalidCount++;
      }
    }
    
    console.log(`\n📊 Migration validation results:`);
    console.log(`  ✅ Directors with valid new structure: ${validCount}`);
    console.log(`  ❌ Directors with issues: ${invalidCount}`);
    console.log(`  📈 Success rate: ${((validCount / directorsSnapshot.size) * 100).toFixed(1)}%`);
    
    if (invalidCount === 0) {
      console.log(`\n🎉 All directors have been successfully migrated to the new structure!`);
    } else {
      console.log(`\n⚠️  ${invalidCount} directors still have issues that need attention.`);
    }
    
  } catch (error) {
    console.error('❌ Error during validation:', error);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--migrate')) {
    await migrateToNewStructure();
  }
  
  if (args.includes('--validate')) {
    await validateMigration();
  }
  
  if (args.length === 0) {
    console.log('Usage: node migrate-to-new-structure.js [--migrate] [--validate]');
    console.log('  --migrate   Migrate all directors to new session structure');
    console.log('  --validate  Validate the migration');
    console.log('\nExample: node migrate-to-new-structure.js --migrate --validate');
  }
  
  process.exit(0);
}

main().catch(console.error);

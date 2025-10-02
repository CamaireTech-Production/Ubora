import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '..', 'studio-gpnfx-firebase-adminsdk-fbsvc-eed44532ba.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Valid package types from the current configuration
const VALID_PACKAGE_TYPES = ['starter', 'standard', 'premium'];

async function fixPackageIssues() {
  console.log('🔧 Starting package issue fixes...\n');

  try {
    // Load issues from the debug report
    const issuesPath = path.join(__dirname, 'package-issues-to-fix.json');
    
    if (!fs.existsSync(issuesPath)) {
      console.log('❌ No issues file found. Please run debug-package-issue.js first.');
      return;
    }

    const issues = JSON.parse(fs.readFileSync(issuesPath, 'utf8'));
    console.log(`📋 Found ${issues.length} issues to fix\n`);

    if (issues.length === 0) {
      console.log('✅ No issues to fix!');
      return;
    }

    let fixedCount = 0;
    let errorCount = 0;

    for (const issue of issues) {
      try {
        console.log(`🔧 Fixing user: ${issue.userEmail} (${issue.userId})`);
        console.log(`   Invalid package: ${issue.packageType}`);
        
        // Get the user document
        const userRef = db.collection('users').doc(issue.userId);
        const userDoc = await userRef.get();
        
        if (!userDoc.exists) {
          console.log(`   ❌ User document not found: ${issue.userId}`);
          errorCount++;
          continue;
        }

        const userData = userDoc.data();
        const sessions = userData.subscriptionSessions || [];

        // Fix the invalid package type
        if (sessions[issue.sessionIndex]) {
          const oldPackageType = sessions[issue.sessionIndex].packageType;
          
          // Map invalid package types to valid ones
          let newPackageType;
          if (oldPackageType === 'custom' || oldPackageType === 'package4') {
            newPackageType = 'premium'; // Map to premium as it's the highest tier
            console.log(`   📦 Mapping ${oldPackageType} → ${newPackageType} (highest tier)`);
          } else if (oldPackageType === 'basic') {
            newPackageType = 'starter';
            console.log(`   📦 Mapping ${oldPackageType} → ${newPackageType}`);
          } else {
            newPackageType = 'standard'; // Default fallback
            console.log(`   📦 Mapping ${oldPackageType} → ${newPackageType} (default)`);
          }

          // Update the session
          sessions[issue.sessionIndex].packageType = newPackageType;
          sessions[issue.sessionIndex].updatedAt = new Date();

          // Also update package resources if they exist
          if (sessions[issue.sessionIndex].packageResources) {
            // Update package resources based on the new package type
            const packageResources = getPackageResources(newPackageType);
            sessions[issue.sessionIndex].packageResources = packageResources;
            console.log(`   📊 Updated package resources for ${newPackageType}`);
          }

          // Update the user document
          await userRef.update({
            subscriptionSessions: sessions,
            lastUpdated: new Date()
          });

          console.log(`   ✅ Successfully fixed package type: ${oldPackageType} → ${newPackageType}`);
          fixedCount++;
        } else {
          console.log(`   ❌ Session not found at index ${issue.sessionIndex}`);
          errorCount++;
        }

      } catch (error) {
        console.error(`   ❌ Error fixing user ${issue.userEmail}:`, error.message);
        errorCount++;
      }

      console.log(''); // Empty line for readability
    }

    // Summary
    console.log('📊 FIX SUMMARY:');
    console.log(`   ✅ Successfully fixed: ${fixedCount} users`);
    console.log(`   ❌ Errors: ${errorCount} users`);
    console.log(`   📋 Total processed: ${issues.length} users`);

    if (fixedCount > 0) {
      console.log('\n🎉 Package issues have been fixed!');
      console.log('   Users should now be able to log in without errors.');
    }

    // Clean up the issues file
    if (fs.existsSync(issuesPath)) {
      fs.unlinkSync(issuesPath);
      console.log('   🗑️ Cleaned up issues file');
    }

  } catch (error) {
    console.error('❌ Error during fix process:', error);
    throw error;
  }
}

// Helper function to get package resources based on package type
function getPackageResources(packageType) {
  const packageResources = {
    starter: {
      tokensIncluded: 300000,
      formsIncluded: 4,
      dashboardsIncluded: 1,
      usersIncluded: 3
    },
    standard: {
      tokensIncluded: 600000,
      formsIncluded: -1, // unlimited
      dashboardsIncluded: -1, // unlimited
      usersIncluded: 7
    },
    premium: {
      tokensIncluded: 1500000,
      formsIncluded: -1, // unlimited
      dashboardsIncluded: -1, // unlimited
      usersIncluded: 20
    }
  };

  return packageResources[packageType] || packageResources.standard;
}

// Main execution
async function main() {
  try {
    await fixPackageIssues();
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run the script
main();

export { fixPackageIssues };

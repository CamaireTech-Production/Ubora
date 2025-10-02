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

async function debugPackageIssue() {
  console.log('🔍 Starting package issue debug...\n');
  console.log('📁 Service account path:', serviceAccountPath);
  console.log('🔧 Firebase initialized:', admin.apps.length > 0);

  try {
    // Get all users
    const usersSnapshot = await db.collection('users').get();
    console.log(`📊 Found ${usersSnapshot.size} users in the database\n`);

    const issues = [];
    const packageStats = {};

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      
      console.log(`👤 Checking user: ${userData.email || userData.name || userId}`);
      console.log(`   Role: ${userData.role}`);
      console.log(`   Agency ID: ${userData.agencyId}`);

      // Check subscription sessions
      if (userData.subscriptionSessions && userData.subscriptionSessions.length > 0) {
        console.log(`   📦 Subscription sessions: ${userData.subscriptionSessions.length}`);
        
        for (let i = 0; i < userData.subscriptionSessions.length; i++) {
          const session = userData.subscriptionSessions[i];
          console.log(`     Session ${i + 1}:`);
          console.log(`       Package Type: ${session.packageType}`);
          console.log(`       Is Active: ${session.isActive}`);
          console.log(`       Start Date: ${session.startDate}`);
          console.log(`       End Date: ${session.endDate}`);

          // Check if package type is valid
          if (!VALID_PACKAGE_TYPES.includes(session.packageType)) {
            const issue = {
              userId,
              userEmail: userData.email || userData.name || 'Unknown',
              issue: 'Invalid package type',
              packageType: session.packageType,
              sessionIndex: i,
              session: session
            };
            issues.push(issue);
            console.log(`       ❌ INVALID PACKAGE TYPE: ${session.packageType}`);
          } else {
            console.log(`       ✅ Valid package type`);
          }

          // Count package types
          if (packageStats[session.packageType]) {
            packageStats[session.packageType]++;
          } else {
            packageStats[session.packageType] = 1;
          }
        }
      } else {
        console.log(`   📦 No subscription sessions found`);
      }

      console.log(''); // Empty line for readability
    }

    // Summary
    console.log('📈 PACKAGE STATISTICS:');
    Object.entries(packageStats).forEach(([packageType, count]) => {
      const isValid = VALID_PACKAGE_TYPES.includes(packageType);
      console.log(`   ${packageType}: ${count} users ${isValid ? '✅' : '❌'}`);
    });

    console.log('\n🚨 ISSUES FOUND:');
    if (issues.length === 0) {
      console.log('   ✅ No package issues found!');
    } else {
      console.log(`   Found ${issues.length} issues:`);
      issues.forEach((issue, index) => {
        console.log(`\n   ${index + 1}. User: ${issue.userEmail} (${issue.userId})`);
        console.log(`      Issue: ${issue.issue}`);
        console.log(`      Invalid Package Type: ${issue.packageType}`);
        console.log(`      Session Index: ${issue.sessionIndex}`);
      });
    }

    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      totalUsers: usersSnapshot.size,
      packageStats,
      issues,
      validPackageTypes: VALID_PACKAGE_TYPES
    };

    const reportPath = path.join(__dirname, 'package-debug-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);

    return { issues, packageStats };

  } catch (error) {
    console.error('❌ Error during debug:', error);
    throw error;
  }
}

async function fixPackageIssues(issues) {
  if (issues.length === 0) {
    console.log('✅ No issues to fix!');
    return;
  }

  console.log(`\n🔧 Fixing ${issues.length} package issues...`);

  for (const issue of issues) {
    try {
      console.log(`\n🔧 Fixing user: ${issue.userEmail}`);
      
      // Get the user document
      const userRef = db.collection('users').doc(issue.userId);
      const userDoc = await userRef.get();
      
      if (!userDoc.exists) {
        console.log(`   ❌ User document not found: ${issue.userId}`);
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
        } else if (oldPackageType === 'basic') {
          newPackageType = 'starter';
        } else {
          newPackageType = 'standard'; // Default fallback
        }

        sessions[issue.sessionIndex].packageType = newPackageType;
        sessions[issue.sessionIndex].updatedAt = admin.firestore.FieldValue.serverTimestamp();

        // Update the user document
        await userRef.update({
          subscriptionSessions: sessions,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`   ✅ Fixed package type: ${oldPackageType} → ${newPackageType}`);
      }

    } catch (error) {
      console.error(`   ❌ Error fixing user ${issue.userEmail}:`, error);
    }
  }

  console.log('\n✅ Package fixes completed!');
}

// Main execution
async function main() {
  try {
    const { issues, packageStats } = await debugPackageIssue();
    
    if (issues.length > 0) {
      console.log('\n❓ Do you want to fix these issues? (This will update the database)');
      console.log('   Run: node scripts/fix-package-issues.js to apply fixes');
      
      // Save issues for the fix script
      const issuesPath = path.join(__dirname, 'package-issues-to-fix.json');
      fs.writeFileSync(issuesPath, JSON.stringify(issues, null, 2));
      console.log(`   Issues saved to: ${issuesPath}`);
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run the script
main();

export { debugPackageIssue, fixPackageIssues };

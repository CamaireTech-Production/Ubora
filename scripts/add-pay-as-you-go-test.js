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
 * Add pay-as-you-go resources to a director for testing
 */
async function addPayAsYouGoTest() {
  console.log('🧪 Adding pay-as-you-go resources for testing...');
  
  try {
    // Get a director to test with (let's use Meli who has a starter package)
    const directorsSnapshot = await db.collection('users')
      .where('role', '==', 'directeur')
      .where('name', '==', 'Meli')
      .get();
    
    if (directorsSnapshot.empty) {
      console.log('❌ No director found with name Meli');
      return;
    }
    
    const directorDoc = directorsSnapshot.docs[0];
    const directorId = directorDoc.id;
    const directorData = directorDoc.data();
    
    console.log(`👤 Testing with director: ${directorData.name || directorData.email} (${directorId})`);
    
    const sessions = directorData.subscriptionSessions || [];
    const activeSession = sessions.find(s => s.isActive);
    
    if (!activeSession) {
      console.log('❌ No active session found');
      return;
    }
    
    console.log(`📦 Current session: ${activeSession.packageType} (${activeSession.sessionType})`);
    
    // Add some pay-as-you-go resources
    const now = new Date();
    const purchaseId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newPurchase = {
      id: purchaseId,
      purchaseDate: now,
      itemType: 'tokens',
      quantity: 50000,
      amountPaid: 15000,
      paymentMethod: 'test',
      notes: 'Test pay-as-you-go purchase'
    };
    
    // Update the session with pay-as-you-go resources
    const updatedSessions = sessions.map(session => {
      if (session.id === activeSession.id) {
        const currentPayAsYouGo = session.payAsYouGoResources || {
          tokens: 0,
          forms: 0,
          dashboards: 0,
          users: 0,
          purchases: []
        };
        
        return {
          ...session,
          payAsYouGoResources: {
            tokens: currentPayAsYouGo.tokens + 50000,
            forms: currentPayAsYouGo.forms + 2,
            dashboards: currentPayAsYouGo.dashboards + 1,
            users: currentPayAsYouGo.users + 1,
            purchases: [...currentPayAsYouGo.purchases, newPurchase]
          },
          updatedAt: now
        };
      }
      return session;
    });
    
    // Update the user document
    await db.collection('users').doc(directorId).update({
      subscriptionSessions: updatedSessions,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Pay-as-you-go resources added successfully!');
    console.log('📊 Added:');
    console.log('  - 50,000 tokens');
    console.log('  - 2 forms');
    console.log('  - 1 dashboard');
    console.log('  - 1 user');
    
  } catch (error) {
    console.error('❌ Error adding pay-as-you-go resources:', error);
  }
}

/**
 * Remove pay-as-you-go resources (cleanup)
 */
async function removePayAsYouGoTest() {
  console.log('🧹 Removing pay-as-you-go resources (cleanup)...');
  
  try {
    // Get the director we modified
    const directorsSnapshot = await db.collection('users')
      .where('role', '==', 'directeur')
      .where('name', '==', 'Meli')
      .get();
    
    if (directorsSnapshot.empty) {
      console.log('❌ No director found with name Meli');
      return;
    }
    
    const directorDoc = directorsSnapshot.docs[0];
    const directorId = directorDoc.id;
    const directorData = directorDoc.data();
    
    const sessions = directorData.subscriptionSessions || [];
    const activeSession = sessions.find(s => s.isActive);
    
    if (!activeSession) {
      console.log('❌ No active session found');
      return;
    }
    
    // Reset pay-as-you-go resources
    const updatedSessions = sessions.map(session => {
      if (session.id === activeSession.id) {
        return {
          ...session,
          payAsYouGoResources: {
            tokens: 0,
            forms: 0,
            dashboards: 0,
            users: 0,
            purchases: []
          },
          updatedAt: new Date()
        };
      }
      return session;
    });
    
    // Update the user document
    await db.collection('users').doc(directorId).update({
      subscriptionSessions: updatedSessions,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Pay-as-you-go resources removed successfully!');
    
  } catch (error) {
    console.error('❌ Error removing pay-as-you-go resources:', error);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--add')) {
    await addPayAsYouGoTest();
  } else if (args.includes('--remove')) {
    await removePayAsYouGoTest();
  } else {
    console.log('Usage: node add-pay-as-you-go-test.js [--add] [--remove]');
    console.log('  --add     Add pay-as-you-go resources for testing');
    console.log('  --remove  Remove pay-as-you-go resources (cleanup)');
    console.log('\nExample: node add-pay-as-you-go-test.js --add');
  }
  
  process.exit(0);
}

main().catch(console.error);


import admin from 'firebase-admin';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin SDK
import { readFileSync } from 'fs';
const serviceAccount = JSON.parse(readFileSync(new URL('../studio-gpnfx-firebase-adminsdk-fbsvc-eed44532ba.json', import.meta.url), 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://studio-gpnfx-default-rtdb.firebaseio.com'
});

const db = admin.firestore();

/**
 * Script to fix duplicate messages in Firebase conversations
 * This script will:
 * 1. Find all conversations
 * 2. For each conversation, find duplicate messages
 * 3. Remove duplicate messages, keeping the first occurrence
 * 4. Update conversation metadata
 */

async function fixDuplicateMessages() {
  console.log('🔍 Starting duplicate message cleanup...');
  
  try {
    // Get all conversations
    const conversationsSnapshot = await db.collection('conversations').get();
    console.log(`📊 Found ${conversationsSnapshot.size} conversations to process`);
    
    let totalConversationsProcessed = 0;
    let totalMessagesRemoved = 0;
    
    for (const conversationDoc of conversationsSnapshot.docs) {
      const conversationId = conversationDoc.id;
      console.log(`\n🔄 Processing conversation: ${conversationId}`);
      
      try {
        // Get all messages for this conversation
        const messagesSnapshot = await db
          .collection('conversations')
          .doc(conversationId)
          .collection('messages')
          .orderBy('timestamp', 'asc')
          .get();
        
        console.log(`  📝 Found ${messagesSnapshot.size} messages`);
        
        if (messagesSnapshot.size === 0) {
          console.log(`  ⏭️  No messages to process`);
          continue;
        }
        
        // Group messages by content and type to find duplicates
        const messageGroups = new Map();
        const messagesToDelete = [];
        
        messagesSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const messageKey = `${data.type}_${data.content}_${data.timestamp?.seconds || 0}`;
          
          if (!messageGroups.has(messageKey)) {
            messageGroups.set(messageKey, []);
          }
          messageGroups.get(messageKey).push({ id: doc.id, data });
        });
        
        // Find duplicates and mark for deletion
        messageGroups.forEach((messages, key) => {
          if (messages.length > 1) {
            console.log(`  🔍 Found ${messages.length} duplicate messages for key: ${key.substring(0, 50)}...`);
            
            // Keep the first message, delete the rest
            const [keepMessage, ...duplicates] = messages;
            console.log(`    ✅ Keeping message: ${keepMessage.id}`);
            
            duplicates.forEach(duplicate => {
              console.log(`    ❌ Marking for deletion: ${duplicate.id}`);
              messagesToDelete.push(duplicate.id);
            });
          }
        });
        
        // Delete duplicate messages
        if (messagesToDelete.length > 0) {
          console.log(`  🗑️  Deleting ${messagesToDelete.length} duplicate messages...`);
          
          const batch = db.batch();
          messagesToDelete.forEach(messageId => {
            const messageRef = db
              .collection('conversations')
              .doc(conversationId)
              .collection('messages')
              .doc(messageId);
            batch.delete(messageRef);
          });
          
          await batch.commit();
          console.log(`  ✅ Successfully deleted ${messagesToDelete.length} duplicate messages`);
          
          // Update conversation metadata
          const newMessageCount = messagesSnapshot.size - messagesToDelete.length;
          await db.collection('conversations').doc(conversationId).update({
            messageCount: newMessageCount,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          
          console.log(`  📊 Updated message count to ${newMessageCount}`);
          totalMessagesRemoved += messagesToDelete.length;
        } else {
          console.log(`  ✅ No duplicates found`);
        }
        
        totalConversationsProcessed++;
        
      } catch (error) {
        console.error(`  ❌ Error processing conversation ${conversationId}:`, error);
      }
    }
    
    console.log(`\n🎉 Cleanup completed!`);
    console.log(`📊 Summary:`);
    console.log(`  - Conversations processed: ${totalConversationsProcessed}`);
    console.log(`  - Duplicate messages removed: ${totalMessagesRemoved}`);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    // Close the connection
    process.exit(0);
  }
}

/**
 * Additional function to add unique identifiers to messages that might have issues
 */
async function addUniqueIdentifiers() {
  console.log('🔧 Adding unique identifiers to messages...');
  
  try {
    const conversationsSnapshot = await db.collection('conversations').get();
    
    for (const conversationDoc of conversationsSnapshot.docs) {
      const conversationId = conversationDoc.id;
      console.log(`\n🔄 Processing conversation: ${conversationId}`);
      
      const messagesSnapshot = await db
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .get();
      
      const batch = db.batch();
      let updateCount = 0;
      
      messagesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        
        // Add a unique identifier if it doesn't exist
        if (!data.uniqueId) {
          const uniqueId = `${conversationId}_${doc.id}_${data.timestamp?.seconds || Date.now()}`;
          batch.update(doc.ref, { uniqueId });
          updateCount++;
        }
      });
      
      if (updateCount > 0) {
        await batch.commit();
        console.log(`  ✅ Added unique identifiers to ${updateCount} messages`);
      } else {
        console.log(`  ✅ All messages already have unique identifiers`);
      }
    }
    
    console.log('🎉 Unique identifier addition completed!');
    
  } catch (error) {
    console.error('❌ Error adding unique identifiers:', error);
  }
}

// Run the cleanup
// Check if this script is being run directly
const isMainModule = import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || 
                     import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`;

if (isMainModule) {
  const args = process.argv.slice(2);
  
  if (args.includes('--add-ids')) {
    addUniqueIdentifiers();
  } else {
    fixDuplicateMessages();
  }
}

export { fixDuplicateMessages, addUniqueIdentifiers };

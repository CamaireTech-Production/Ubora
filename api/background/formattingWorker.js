const { adminDb } = require('../lib/firebaseAdmin');
const admin = require('firebase-admin');
const OpenAI = require('openai');

// Configuration OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Background worker for processing formatting errors and retries
class FormattingWorker {
  constructor() {
    this.isRunning = false;
    this.retryInterval = 30000; // 30 seconds
    this.maxRetries = 3;
  }

  start() {
    if (this.isRunning) {
      console.log('⚠️ Formatting worker is already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting formatting worker...');
    
    // Process errors immediately
    this.processFormattingErrors();
    
    // Set up interval for continuous processing
    this.intervalId = setInterval(() => {
      this.processFormattingErrors();
    }, this.retryInterval);
  }

  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    console.log('🛑 Formatting worker stopped');
  }

  async processFormattingErrors() {
    try {
      console.log('🔍 Checking for formatting errors to retry...');
      
      // Get failed formatting jobs that need retry
      const errorQuery = await adminDb
        .collection('formattingErrors')
        .where('status', '==', 'failed')
        .where('attempts', '<', this.maxRetries)
        .limit(5)
        .get();

      if (errorQuery.empty) {
        console.log('✅ No formatting errors to retry');
        return;
      }

      console.log(`📋 Found ${errorQuery.size} formatting errors to retry`);

      for (const errorDoc of errorQuery.docs) {
        const errorData = errorDoc.data();
        await this.retryFormatting(errorDoc.id, errorData);
      }

    } catch (error) {
      console.error('❌ Error processing formatting errors:', error);
    }
  }

  async retryFormatting(errorId, errorData) {
    try {
      console.log(`🔄 Retrying formatting for submission: ${errorData.submissionId}`);
      
      // Get the original raw text from the submission
      const submissionDoc = await adminDb
        .collection('textProcessing')
        .doc(errorData.submissionId)
        .get();

      if (!submissionDoc.exists) {
        console.log(`⚠️ Submission ${errorData.submissionId} not found, removing error`);
        await adminDb.collection('formattingErrors').doc(errorId).delete();
        return;
      }

      const submissionData = submissionDoc.data();
      const rawText = submissionData.rawText;
      const model = submissionData.model || 'gpt-4o';

      // Increment retry count
      const newAttempts = (errorData.attempts || 0) + 1;
      
      await adminDb.collection('formattingErrors').doc(errorId).update({
        attempts: newAttempts,
        lastRetryAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Try formatting again
      const formatResponse = await openai.chat.completions.create({
        model: model,
        messages: [
          {
            role: "user",
            content: `Please format the following extracted PDF text into well-structured markdown format. Pay special attention to:

1. **Tables**: Convert any tabular data to proper markdown table format with headers and rows
2. **Lists**: Convert numbered and bulleted lists to markdown format
3. **Headers**: Identify and format section headers with appropriate markdown headers (# ## ###)
4. **Structure**: Preserve the document structure and hierarchy
5. **Complex layouts**: Handle multi-column layouts, sidebars, and complex formatting
6. **Text formatting**: Preserve bold, italic, and other text formatting as markdown

Return only the formatted text in markdown, without any additional commentary or explanations.

Extracted text:
${rawText}`
          }
        ],
        max_tokens: 6000,
        temperature: 0.1
      });

      const formattedText = formatResponse.choices[0]?.message?.content || '';
      const usage = formatResponse.usage;

      console.log(`✅ Retry successful for submission: ${errorData.submissionId}`);
      console.log('💰 OpenAI API Usage:', {
        prompt_tokens: usage?.prompt_tokens || 0,
        completion_tokens: usage?.completion_tokens || 0,
        total_tokens: usage?.total_tokens || 0,
        model: model
      });

      // Update the submission with formatted text
      await this.updateFormattedText(errorData.submissionId, formattedText);

      // Remove the error record
      await adminDb.collection('formattingErrors').doc(errorId).delete();

      // Update text processing record
      await adminDb.collection('textProcessing').doc(errorData.submissionId).update({
        status: 'formatted',
        formattedText: formattedText,
        formattedAt: admin.firestore.FieldValue.serverTimestamp(),
        attempts: newAttempts
      });

    } catch (error) {
      console.error(`❌ Retry failed for submission ${errorData.submissionId}:`, error);
      
      // Update error record
      await adminDb.collection('formattingErrors').doc(errorId).update({
        lastError: error.message,
        lastRetryAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // If max retries reached, mark as permanently failed
      const errorDoc = await adminDb.collection('formattingErrors').doc(errorId).get();
      const currentData = errorDoc.data();
      
      if (currentData.attempts >= this.maxRetries) {
        await adminDb.collection('formattingErrors').doc(errorId).update({
          status: 'permanently_failed',
          failedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        await adminDb.collection('textProcessing').doc(errorData.submissionId).update({
          status: 'permanently_failed',
          failedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }
  }

  async updateFormattedText(submissionId, formattedText) {
    try {
      // Try direct id first
      let entryRef = adminDb.collection('formEntries').doc(submissionId);
      let entryDoc = await entryRef.get();

      if (!entryDoc.exists) {
        // Fallback: locate entry by attachmentSubmissionIds
        const qSnap = await adminDb
          .collection('formEntries')
          .where('attachmentSubmissionIds', 'array-contains', submissionId)
          .limit(1)
          .get();
        if (!qSnap.empty) {
          entryRef = qSnap.docs[0].ref;
          entryDoc = qSnap.docs[0];
        }
      }

      if (entryDoc.exists) {
        console.log('📝 Updating FormEntry with formatted text for attachment:', submissionId);
        const data = entryDoc.data() || {};
        const attachments = Array.isArray(data.fileAttachments) ? data.fileAttachments : [];
        const updated = attachments.map((att) => {
          if (att && att.submissionId === submissionId) {
            return {
              ...att,
              rawExtractedText: att.rawExtractedText || att.extractedText,
              extractedText: formattedText
            };
          }
          return att;
        });
        await entryRef.update({
          fileAttachments: updated,
          formattedAt: admin.firestore.FieldValue.serverTimestamp(),
          formattingStatus: 'completed'
        });
      } else {
        console.log('📝 Saving formatted text for draft submission:', submissionId);
        await adminDb.collection('draftFormatting').doc(submissionId).set({
          submissionId,
          formattedText,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          status: 'ready'
        });
      }
    } catch (error) {
      console.error('❌ Error updating formatted text:', error);
    }
  }
}

// Create and export worker instance
const formattingWorker = new FormattingWorker();

// Start worker if this file is run directly
if (require.main === module) {
  formattingWorker.start();
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('🛑 Received SIGINT, shutting down formatting worker...');
    formattingWorker.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('🛑 Received SIGTERM, shutting down formatting worker...');
    formattingWorker.stop();
    process.exit(0);
  });
}

module.exports = formattingWorker;

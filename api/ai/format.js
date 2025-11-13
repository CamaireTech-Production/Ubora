import { adminDb, admin } from '../lib/firebaseAdmin.js';
import OpenAI from 'openai';
import { syncFormEntryToVector } from '../workers/vectorSync.js';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * POST /api/ai/format
 * Format raw PDF text using OpenAI and update FormEntry
 */
async function formatHandler(req, res) {
  try {
    // CORS headers
    const corsOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['*'];
    const origin = req.headers.origin;
    const allowedOrigin = corsOrigins.includes('*') ? '*' : 
                         (origin && corsOrigins.includes(origin)) ? origin : corsOrigins[0];
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    };

    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    // Handle OPTIONS requests
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    console.log('🔍 Format endpoint called with method:', req.method);
    console.log('🔍 Request body:', req.body);
    console.log('🔍 Request headers:', req.headers);
    console.log('🔍 Content-Type:', req.headers['content-type']);
    
    const { submissionId, formEntryId, rawText, fileName } = req.body;

    console.log('🔄 Format request received:', {
      submissionId,
      formEntryId,
      fileName,
      rawTextLength: rawText?.length || 0
    });

    // Validate required fields - accept either submissionId or formEntryId
    if ((!submissionId && !formEntryId) || !rawText) {
      console.error('❌ Missing required fields:', {
        hasSubmissionId: !!submissionId,
        hasFormEntryId: !!formEntryId,
        hasRawText: !!rawText,
        submissionId,
        formEntryId,
        rawTextLength: rawText?.length || 0,
        fullRequestBody: req.body
      });
      
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: submissionId (or formEntryId) and rawText are required',
        details: {
          hasSubmissionId: !!submissionId,
          hasFormEntryId: !!formEntryId,
          hasRawText: !!rawText,
          receivedBody: req.body
        }
      });
    }

    // Use submissionId if available, otherwise fall back to formEntryId
    const idToUse = submissionId || formEntryId;

    // Start background formatting (don't wait for it)
    formatTextInBackground(idToUse, rawText, fileName)
      .catch(error => {
        console.error('❌ Background formatting failed:', error);
      });

    // Return immediately - formatting happens in background
    res.status(200).json({
      success: true,
      message: 'Format request received, processing in background'
    });

  } catch (error) {
    console.error('❌ Error in format endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

/**
 * Format text in background and update FormEntry
 * @param {string} formEntryId - The submissionId or formEntryId
 * @param {string} rawText - The raw extracted text to format
 * @param {string} fileName - The name of the file being formatted
 */
export async function formatTextInBackground(formEntryId, rawText, fileName) {
  let actualFormEntryId = null;
  let formEntryRef = null;
  
  try {
    console.log(`🔄 Starting background formatting for ${fileName}...`);

    // Find FormEntry first to track status
    const foundEntry = await findFormEntryBySubmissionId(formEntryId);
    if (foundEntry) {
      formEntryRef = foundEntry.ref;
      actualFormEntryId = foundEntry.id;
      
      // Update status to processing
      await formEntryRef.update({
        formattingStatus: 'processing',
        formattingStartedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Format text with OpenAI
    const formattedText = await formatRawWithOpenAI(rawText);
    
    console.log(`✅ Text formatted successfully for ${fileName}`);

    // Update FormEntry with formatted text
    if (!actualFormEntryId) {
      actualFormEntryId = await updateFormEntryWithFormattedText(formEntryId, formattedText, fileName);
    } else {
      await updateFormEntryWithFormattedText(formEntryId, formattedText, fileName);
    }

    console.log(`✅ FormEntry updated with formatted text for ${fileName}`);

    // Sync to vector database after formatting (text has changed, need to update chunks)
    if (actualFormEntryId) {
      try {
        console.log(`🔄 Syncing FormEntry to vector database after formatting: ${actualFormEntryId}`);
        await syncFormEntryToVector(actualFormEntryId, 'update');
        console.log(`✅ FormEntry synced to vector database after formatting: ${actualFormEntryId}`);
      } catch (syncError) {
        console.error(`❌ Failed to sync FormEntry to vector database after formatting:`, syncError);
        // Don't throw - formatting succeeded, vector sync can be retried later
      }
    }

  } catch (error) {
    console.error(`❌ Background formatting failed for ${fileName}:`, error);
    
    // Update FormEntry with error status and check retry count
    try {
      if (!formEntryRef) {
        const foundEntry = await findFormEntryBySubmissionId(formEntryId);
        if (foundEntry) {
          formEntryRef = foundEntry.ref;
          actualFormEntryId = foundEntry.id;
        }
      }
      
      if (formEntryRef) {
        const formEntryDoc = await formEntryRef.get();
        const formEntryData = formEntryDoc.data();
        const currentRetryCount = formEntryData.formattingRetryCount || 0;
        const newRetryCount = currentRetryCount + 1;
        const maxRetries = 3;
        
        const updateData = {
          formattingStatus: 'failed',
          formattingError: error.message,
          formattingFailedAt: admin.firestore.FieldValue.serverTimestamp(),
          formattingRetryCount: newRetryCount,
        };
        
        // Update file attachment status
        const fileAttachments = Array.isArray(formEntryData.fileAttachments) ? formEntryData.fileAttachments : [];
        const updatedFileAttachments = fileAttachments.map((attachment) => {
          if (attachment.submissionId === formEntryId || attachment.fileName === fileName) {
            return {
              ...attachment,
              formattingStatus: 'failed',
              formattingError: error.message,
            };
          }
          return attachment;
        });
        updateData.fileAttachments = updatedFileAttachments;
        
        await formEntryRef.update(updateData);
        
        // If max retries reached, trigger fallback: sync with raw text
        if (newRetryCount >= maxRetries) {
          console.log(`⚠️ Max retries (${maxRetries}) reached for formatting. Triggering fallback: sync with raw text`);
          try {
            await syncFormEntryToVector(actualFormEntryId, 'update', true); // true = use raw text
            await formEntryRef.update({
              vectorSyncWithRawText: true,
              vectorSyncStatus: 'completed', // Mark as completed even with raw text
            });
            console.log(`✅ Fallback: Vector sync completed with raw text for ${actualFormEntryId}`);
          } catch (fallbackError) {
            console.error(`❌ Fallback vector sync also failed:`, fallbackError);
          }
        }
      } else {
        // Fallback: try to update by formEntryId directly
        const fallbackRef = adminDb.collection('formEntries').doc(formEntryId);
        await fallbackRef.update({
          formattingStatus: 'failed',
          formattingError: error.message,
          formattingFailedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch (updateError) {
      console.error('❌ Failed to update FormEntry with error:', updateError);
    }
  }
}

/**
 * Find FormEntry by submissionId
 */
async function findFormEntryBySubmissionId(submissionId) {
  try {
    // Try to find FormEntry by searching for the submissionId in fileAttachments
    const recentEntriesQuery = await adminDb
      .collection('formEntries')
      .orderBy('submittedAt', 'desc')
      .limit(50)
      .get();

    for (const doc of recentEntriesQuery.docs) {
      const data = doc.data();
      if (data.fileAttachments && Array.isArray(data.fileAttachments)) {
        const hasMatchingSubmissionId = data.fileAttachments.some(att => 
          att && att.submissionId === submissionId
        );
        if (hasMatchingSubmissionId) {
          return { ref: doc.ref, id: doc.id, data: doc.data() };
        }
      }
    }

    // Fallback: try using submissionId as document ID
    const fallbackRef = adminDb.collection('formEntries').doc(submissionId);
    const fallbackDoc = await fallbackRef.get();
    if (fallbackDoc.exists) {
      return { ref: fallbackRef, id: fallbackDoc.id, data: fallbackDoc.data() };
    }

    return null;
  } catch (error) {
    console.error('❌ Error finding FormEntry:', error);
    return null;
  }
}

/**
 * Format raw text with OpenAI
 */
async function formatRawWithOpenAI(rawText) {
  try {
    console.log('🔄 Formatting raw text with OpenAI...');

    const formatResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: "user",
          content: `Please format the following extracted PDF text into well-structured markdown format. This appears to be a financial/sales report, so pay special attention to:

1. **Tables**: Convert any tabular data to proper markdown table format with headers and rows
2. **Financial Data**: Ensure all monetary values, dates, and quantities are clearly formatted
3. **Lists**: Convert numbered and bulleted lists to markdown format
4. **Headers**: Identify and format section headers with appropriate markdown headers (# ## ###)
5. **Structure**: Preserve the document structure and hierarchy
6. **Data Types**: Clearly identify and format:
   - Dates (ISO format preferred)
   - Currency amounts (with FCFA notation)
   - Quantities and measurements
   - Product names and codes
7. **Complex layouts**: Handle multi-column layouts, sidebars, and complex formatting
8. **Text formatting**: Preserve bold, italic, and other text formatting as markdown

IMPORTANT: Ensure all table data is properly structured with clear column headers and that no data is lost during formatting. Pay special attention to sales tables, product lists, and financial summaries.

Return only the formatted text in markdown, without any additional commentary or explanations.

Extracted text:
${rawText}`
        }
      ],
      max_tokens: 6000,
      temperature: 0.1
    });

    const formattedText = formatResponse.choices[0]?.message?.content || '';
    console.log('✅ Raw text formatted successfully');

    return formattedText;
  } catch (error) {
    console.error('❌ Error formatting raw text with OpenAI:', error);
    throw error;
  }
}

/**
 * Update FormEntry with formatted text
 */
async function updateFormEntryWithFormattedText(submissionId, formattedText, fileName) {
  try {
    console.log('📝 Updating FormEntry with formatted text for submission:', submissionId);

    // First try to find FormEntry by submissionId in fileAttachments
    let formEntryRef = null;
    let formEntryDoc = null;

    // Try to find FormEntry by searching for the submissionId in fileAttachments
    // We need to search through all recent FormEntries since Firestore doesn't support
    // complex queries on array objects
    const recentEntriesQuery = await adminDb
      .collection('formEntries')
      .orderBy('submittedAt', 'desc')
      .limit(50) // Check last 50 entries
      .get();

    let foundEntry = null;
    for (const doc of recentEntriesQuery.docs) {
      const data = doc.data();
      if (data.fileAttachments && Array.isArray(data.fileAttachments)) {
        const hasMatchingSubmissionId = data.fileAttachments.some(att => 
          att && att.submissionId === submissionId
        );
        if (hasMatchingSubmissionId) {
          foundEntry = doc;
          break;
        }
      }
    }

    if (foundEntry) {
      formEntryRef = foundEntry.ref;
      formEntryDoc = foundEntry;
      console.log('✅ Found FormEntry by submissionId in fileAttachments');
    } else {
      // Fallback: try using submissionId as document ID (for backward compatibility)
      formEntryRef = adminDb.collection('formEntries').doc(submissionId);
      formEntryDoc = await formEntryRef.get();
      
      if (formEntryDoc.exists) {
        console.log('✅ Found FormEntry using submissionId as document ID');
      }
    }

    if (!formEntryDoc || !formEntryDoc.exists) {
      throw new Error(`FormEntry not found for submissionId: ${submissionId}`);
    }

    const formEntryData = formEntryDoc.data();
    const fileAttachments = Array.isArray(formEntryData.fileAttachments) ? formEntryData.fileAttachments : [];

    // Update the file attachment with the matching submissionId
    const updatedFileAttachments = fileAttachments.map((attachment) => {
      if (attachment.submissionId === submissionId) {
        console.log('📝 Updating attachment with formatted text:', {
          fileName: attachment.fileName,
          submissionId: attachment.submissionId
        });
        return {
          ...attachment,
          rawExtractedText: attachment.extractedText, // Keep raw text
          extractedText: formattedText, // Update with formatted text
          formattingStatus: 'completed',
          formattedAt: new Date().toISOString()
        };
      }
      return attachment;
    });

    // Check if any attachment was actually updated
    const wasUpdated = updatedFileAttachments.some((att, index) => 
      att.submissionId === submissionId && 
      att.extractedText === formattedText &&
      att.formattingStatus === 'completed'
    );

    if (!wasUpdated) {
      console.warn('⚠️ No attachment was updated - submissionId might not match any attachment');
      console.log('Available submissionIds:', fileAttachments.map(att => att.submissionId));
    }

    // Update the FormEntry document
    await formEntryRef.update({
      fileAttachments: updatedFileAttachments,
      formattingStatus: 'completed',
      formattingCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
      formattingError: admin.firestore.FieldValue.delete(), // Clear any previous errors
      formattedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('✅ FormEntry updated successfully with formatted text');

    // Return the formEntryId for vector sync
    return formEntryRef.id;
  } catch (error) {
    console.error('❌ Error updating FormEntry with formatted text:', error);
    throw error;
  }
}

export default formatHandler;

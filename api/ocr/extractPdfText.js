const OpenAI = require('openai');
const pdfParse = require('pdf-parse');
const crypto = require('crypto');
const { adminDb } = require('../lib/firebaseAdmin');
const admin = require('firebase-admin');

// Configuration OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports = async function handler(req, res) {
  try {
    // Headers CORS complets
    const corsOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['*'];
    const origin = req.headers.origin;
    const allowedOrigin = corsOrigins.includes('*') ? '*' : 
                         (origin && corsOrigins.includes(origin)) ? origin : corsOrigins[0];
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400' // 24h cache preflight
    };

    // Ajouter les headers CORS à toutes les réponses
    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    // Gérer les requêtes OPTIONS (preflight CORS)
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    // Vérifier que la méthode est POST
    if (req.method !== 'POST') {
      return res.status(405).json({ 
        error: 'Méthode non autorisée',
        code: 'METHOD_NOT_ALLOWED'
      });
    }

    // Validation du corps de la requête
    const { pdfData, model, fileName } = req.body;
    
    if (!pdfData) {
      return res.status(400).json({ 
        error: 'Données PDF manquantes',
        code: 'MISSING_PDF_DATA'
      });
    }

    console.log('🔍 Processing PDF text extraction request...');
    console.log('📄 File name:', fileName || 'Unknown');
    console.log('📊 PDF data length:', pdfData ? pdfData.length : 0);
    
    // Convert base64 PDF data to buffer
    const base64Data = pdfData.replace(/^data:application\/pdf;base64,/, '');
    const pdfBuffer = Buffer.from(base64Data, 'base64');
    
    console.log('📦 PDF buffer size:', pdfBuffer.length, 'bytes');
    
    // Check if PDF is too large and provide feedback
    const fileSizeMB = (pdfBuffer.length / (1024 * 1024)).toFixed(2);
    console.log('📏 PDF size:', fileSizeMB, 'MB');
    
    if (pdfBuffer.length > 20 * 1024 * 1024) { // 20MB limit
      throw new Error(`PDF file is too large (${fileSizeMB}MB). Maximum supported size is 20MB.`);
    }
    
    if (pdfBuffer.length > 5 * 1024 * 1024) { // 5MB warning
      console.log('⚠️ Large PDF detected - processing may take 1-2 minutes...');
    }
    
    // Extract text using pdf-parse (fast OCR only)
    console.log('📖 Extracting text using pdf-parse...');
    const processingStartTime = Date.now();
    
    const pdfData_result = await pdfParse(pdfBuffer);
    const rawText = pdfData_result.text;
    
    console.log('✅ Text extracted from PDF');
    console.log('📝 Raw text length:', rawText.length, 'characters');
    console.log('📄 Number of pages:', pdfData_result.numpages);
    
    if (!rawText || rawText.trim().length === 0) {
      throw new Error('No text could be extracted from the PDF');
    }
    
    // Generate unique submission ID and content hash
    const submissionId = `sub_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const contentHash = crypto.createHash('sha256')
      .update(pdfBuffer.toString('base64') + (model || 'gpt-4o') + 'v1')
      .digest('hex');
    
    // Save raw text to processing collection for background worker
    await saveTextProcessing(submissionId, rawText, contentHash, model || 'gpt-4o', fileName);
    
    // Start background formatting (don't wait for it)
    startBackgroundFormatting(submissionId, rawText, contentHash, model || 'gpt-4o', fileName)
      .catch(error => {
        console.error('❌ Background formatting failed:', error);
      });
    
    const processingTime = Date.now() - processingStartTime;
    console.log('⏱️ OCR processing time:', processingTime, 'ms');
    
    return res.status(200).json({
      success: true,
      text: rawText, // Return raw text immediately
      extractedText: rawText,
      submissionId: submissionId,
      status: 'processing', // Background formatting in progress
      confidence: 95, // High confidence with pdf-parse
      engine: 'pdf-parse_fast_ocr',
      model: model || 'gpt-4o',
      meta: {
        timestamp: new Date().toISOString(),
        type: 'fast_ocr_with_background_formatting',
        fileName: fileName || 'Unknown',
        fileSize: pdfBuffer.length,
        fileSizeMB: fileSizeMB,
        processingTime: processingTime,
        pages: pdfData_result.numpages,
        contentHash: contentHash
      }
    });

  } catch (error) {
    console.error('❌ PDF text extraction error:', error);
    console.error('🔍 Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    return res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'extraction de texte du PDF',
      code: 'PDF_EXTRACTION_ERROR',
      details: error.message,
      engine: 'reliable_pdf_processing'
    });
  }
};

// Background formatting function
async function startBackgroundFormatting(submissionId, rawText, contentHash, model, fileName) {
  try {
    console.log('🔄 Starting background formatting for submission:', submissionId);
    
    // Check if we already have formatted text for this content
    const existingResult = await checkFormattedTextCache(contentHash);
    if (existingResult) {
      console.log('✅ Found cached formatted text for content hash:', contentHash);
      await updateFormattedText(submissionId, existingResult.formattedText);
      return;
    }
    
    // Format with OpenAI
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
    
    console.log('✅ Background formatting completed for submission:', submissionId);
    console.log('💰 OpenAI API Usage:', {
      prompt_tokens: usage?.prompt_tokens || 0,
      completion_tokens: usage?.completion_tokens || 0,
      total_tokens: usage?.total_tokens || 0,
      model: model
    });
    
    // Save to cache
    await saveFormattedTextCache(contentHash, formattedText, model);
    
    // Update formatted text
    await updateFormattedText(submissionId, formattedText);
    
  } catch (error) {
    console.error('❌ Background formatting failed for submission:', submissionId, error);
    
    // Save error for retry
    await saveFormattingError(submissionId, error.message);
  }
}

// Check if formatted text exists in cache
async function checkFormattedTextCache(contentHash) {
  try {
    const cacheDoc = await adminDb.collection('formattedTextCache').doc(contentHash).get();
    if (cacheDoc.exists) {
      return cacheDoc.data();
    }
    return null;
  } catch (error) {
    console.error('❌ Error checking formatted text cache:', error);
    return null;
  }
}

// Save formatted text to cache
async function saveFormattedTextCache(contentHash, formattedText, model) {
  try {
    await adminDb.collection('formattedTextCache').doc(contentHash).set({
      formattedText,
      model,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      contentHash
    });
  } catch (error) {
    console.error('❌ Error saving formatted text cache:', error);
  }
}

// Update formatted text for a submission
async function updateFormattedText(submissionId, formattedText) {
  try {
    // Check if FormEntry exists in Firebase
    const entryRef = adminDb.collection('formEntries').doc(submissionId);
    const entryDoc = await entryRef.get();
    
    if (entryDoc.exists) {
      // Case 1: FormEntry already submitted → Update Firebase
      console.log('📝 Updating existing FormEntry with formatted text:', submissionId);
      await entryRef.update({
        'fileAttachments.0.extractedText': formattedText,
        formattedAt: admin.firestore.FieldValue.serverTimestamp(),
        formattingStatus: 'completed'
      });
    } else {
      // Case 2: Still in draft → Save to draft formatting collection
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

// Save text processing record
async function saveTextProcessing(submissionId, rawText, contentHash, model, fileName) {
  try {
    await adminDb.collection('textProcessing').doc(submissionId).set({
      submissionId,
      rawText,
      contentHash,
      model,
      fileName,
      status: 'processing',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      attempts: 0
    });
  } catch (error) {
    console.error('❌ Error saving text processing record:', error);
  }
}

// Save formatting error for retry
async function saveFormattingError(submissionId, errorMessage) {
  try {
    await adminDb.collection('formattingErrors').doc(submissionId).set({
      submissionId,
      error: errorMessage,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'failed',
      attempts: 1
    });
  } catch (error) {
    console.error('❌ Error saving formatting error:', error);
  }
}
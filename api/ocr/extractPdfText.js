const OpenAI = require('openai');
const pdfParse = require('pdf-parse');

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
    
    // Use reliable pdf-parse + OpenAI formatting method
    console.log('🔄 Using reliable pdf-parse + OpenAI formatting method...');
    
    const processingStartTime = Date.now();
    
    // Extract text using pdf-parse
    console.log('📖 Extracting text using pdf-parse...');
    const pdfData_result = await pdfParse(pdfBuffer);
    const rawText = pdfData_result.text;
    
    console.log('✅ Text extracted from PDF');
    console.log('📝 Raw text length:', rawText.length, 'characters');
    console.log('📄 Number of pages:', pdfData_result.numpages);
    
    if (!rawText || rawText.trim().length === 0) {
      throw new Error('No text could be extracted from the PDF');
    }
    
    // Use OpenAI to format the extracted text
    console.log('🤖 Formatting text with OpenAI...');
    const formatResponse = await openai.chat.completions.create({
      model: model || 'gpt-4o',
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
    
    const processingTime = Date.now() - processingStartTime;
    const method = 'pdf-parse_openai_formatting';
    console.log('✅ PDF processing completed');
    console.log('⏱️ Processing time:', processingTime, 'ms');
    
    const extractedText = formatResponse.choices[0]?.message?.content || '';
    
    // Log des informations de coût (pour monitoring)
    const usage = formatResponse.usage;
    console.log('💰 OpenAI API Usage:', {
      prompt_tokens: usage?.prompt_tokens || 0,
      completion_tokens: usage?.completion_tokens || 0,
      total_tokens: usage?.total_tokens || 0,
      model: model || 'gpt-4o'
    });
    
    console.log('📊 Final extracted text length:', extractedText.length, 'characters');
    
    return res.status(200).json({
      success: true,
      text: extractedText,
      extractedText: extractedText,
      confidence: 90, // High confidence with pdf-parse + OpenAI formatting
      engine: method,
      model: model || 'gpt-4o',
      usage: usage,
      meta: {
        timestamp: new Date().toISOString(),
        type: 'reliable_pdf_processing',
        fileName: fileName || 'Unknown',
        fileSize: pdfBuffer.length,
        fileSizeMB: fileSizeMB,
        uploadTime: 0,
        processingTime: processingTime,
        totalTime: processingTime,
        method: method
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
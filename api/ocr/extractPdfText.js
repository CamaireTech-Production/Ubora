import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import crypto from 'crypto';
import { logger } from '../lib/logger.js';

// Simple PDF text extraction endpoint - only extraction, no background processing

export default async function handler(req, res) {
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

    // Only allow POST requests
    if (req.method !== 'POST') {
      return res.status(405).json({ 
        error: 'Method not allowed',
        code: 'METHOD_NOT_ALLOWED'
      });
    }

    // Validate request body
    const { pdfData, fileName } = req.body;
    
    if (!pdfData) {
      return res.status(400).json({ 
        error: 'PDF data is required',
        code: 'MISSING_PDF_DATA'
      });
    }

    logger.info('Processing PDF text extraction request', { fileName: fileName || 'Unknown', dataLength: pdfData ? pdfData.length : 0 }, 'ocr/extractPdfText.js');
    
    // Convert base64 PDF data to buffer
    const base64Data = pdfData.replace(/^data:application\/pdf;base64,/, '');
    const pdfBuffer = Buffer.from(base64Data, 'base64');
    
    logger.debug('PDF buffer size', { bufferSize: pdfBuffer.length }, 'ocr/extractPdfText.js');
    
    // Check file size
    const fileSizeMB = (pdfBuffer.length / (1024 * 1024)).toFixed(2);
    logger.debug('PDF size', { fileSizeMB }, 'ocr/extractPdfText.js');
    
    if (pdfBuffer.length > 20 * 1024 * 1024) { // 20MB limit
      throw new Error(`PDF file is too large (${fileSizeMB}MB). Maximum supported size is 20MB.`);
    }
    
    if (pdfBuffer.length > 5 * 1024 * 1024) { // 5MB warning
      logger.warn('Large PDF detected - processing may take 1-2 minutes', { fileSizeMB }, 'ocr/extractPdfText.js');
    }
    
    // Extract text using pdf-parse
    logger.debug('Extracting text using pdf-parse', null, 'ocr/extractPdfText.js');
    const processingStartTime = Date.now();
    
    const pdfData_result = await pdfParse(pdfBuffer);
    const rawText = pdfData_result.text;
    
    logger.info('Text extracted from PDF', { textLength: rawText.length, numPages: pdfData_result.numpages }, 'ocr/extractPdfText.js');
    
    if (!rawText || rawText.trim().length === 0) {
      throw new Error('No text could be extracted from the PDF');
    }
    
    const processingTime = Date.now() - processingStartTime;
    logger.debug('OCR processing time', { processingTime }, 'ocr/extractPdfText.js');
    
    // Return only the extracted text - no background processing
    return res.status(200).json({
      success: true,
      text: rawText,
      extractedText: rawText,
      meta: {
        timestamp: new Date().toISOString(),
        fileName: fileName || 'Unknown',
        fileSize: pdfBuffer.length,
        fileSizeMB: fileSizeMB,
        processingTime: processingTime,
        pages: pdfData_result.numpages,
        textLength: rawText.length
      }
    });

  } catch (error) {
    logger.error('PDF text extraction error', error, 'ocr/extractPdfText.js');
    
    return res.status(500).json({
      success: false,
      error: 'Error extracting text from PDF',
      code: 'PDF_EXTRACTION_ERROR',
      details: error.message
    });
  }
};
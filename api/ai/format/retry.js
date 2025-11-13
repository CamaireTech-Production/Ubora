/**
 * POST /api/ai/format/retry
 * Retry formatting for a failed form entry or specific file
 */

import { adminDb, admin } from '../../lib/firebaseAdmin.js';
import { formatTextInBackground } from '../format.js';

// CORS headers helper
function setCorsHeaders(res, origin) {
  const corsOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['*'];
  const allowedOrigin = corsOrigins.includes('*') ? '*' : 
                       (origin && corsOrigins.includes(origin)) ? origin : corsOrigins[0];
  
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

export default async function handler(req, res) {
  setCorsHeaders(res, req.headers.origin);

  // Handle OPTIONS requests
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { formEntryId, fileName, forceRetry = false } = req.body;

    if (!formEntryId) {
      return res.status(400).json({ success: false, error: 'formEntryId is required' });
    }

    console.log('🔄 [FormatRetry] Retry request received:', { formEntryId, fileName, forceRetry });

    // Get form entry
    const formEntryDoc = await adminDb.collection('formEntries').doc(formEntryId).get();
    if (!formEntryDoc.exists) {
      return res.status(404).json({ success: false, error: 'FormEntry not found' });
    }

    const formEntry = { id: formEntryDoc.id, ...formEntryDoc.data() };
    const fileAttachments = Array.isArray(formEntry.fileAttachments) ? formEntry.fileAttachments : [];

    // If fileName specified, retry only that file
    if (fileName) {
      const attachment = fileAttachments.find(att => att.fileName === fileName);
      if (!attachment) {
        return res.status(404).json({ success: false, error: `File ${fileName} not found in FormEntry` });
      }

      if (!attachment.rawExtractedText && !attachment.extractedText) {
        return res.status(400).json({ success: false, error: 'No extracted text available for this file' });
      }

      // Check if already completed (unless forceRetry)
      if (!forceRetry && attachment.formattingStatus === 'completed') {
        return res.status(400).json({ 
          success: false, 
          error: 'Formatting already completed. Use forceRetry=true to retry anyway.' 
        });
      }

      // Use raw text if available, otherwise use extracted text
      const rawText = attachment.rawExtractedText || attachment.extractedText;
      const submissionId = attachment.submissionId || formEntryId;

      // Start formatting in background
      formatTextInBackground(submissionId, rawText, fileName)
        .catch(error => {
          console.error('❌ [FormatRetry] Background formatting failed:', error);
        });

      return res.status(200).json({
        success: true,
        message: `Formatting retry initiated for ${fileName}`,
        formEntryId,
        fileName,
      });
    }

    // Retry all files that need formatting
    const filesToRetry = fileAttachments.filter(att => {
      if (!att.rawExtractedText && !att.extractedText) return false;
      if (!forceRetry && att.formattingStatus === 'completed') return false;
      return att.formattingStatus === 'failed' || att.formattingStatus === 'pending' || forceRetry;
    });

    if (filesToRetry.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No files need formatting retry' 
      });
    }

    // Start formatting for all files in background
    const retryPromises = filesToRetry.map(attachment => {
      const rawText = attachment.rawExtractedText || attachment.extractedText;
      const submissionId = attachment.submissionId || formEntryId;
      return formatTextInBackground(submissionId, rawText, attachment.fileName)
        .catch(error => {
          console.error(`❌ [FormatRetry] Background formatting failed for ${attachment.fileName}:`, error);
        });
    });

    // Don't wait for completion - return immediately
    Promise.all(retryPromises).catch(error => {
      console.error('❌ [FormatRetry] Some formatting retries failed:', error);
    });

    return res.status(200).json({
      success: true,
      message: `Formatting retry initiated for ${filesToRetry.length} file(s)`,
      formEntryId,
      filesCount: filesToRetry.length,
      files: filesToRetry.map(att => att.fileName),
    });

  } catch (error) {
    console.error('❌ [FormatRetry] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message,
    });
  }
}


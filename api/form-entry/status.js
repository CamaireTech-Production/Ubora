/**
 * GET /api/form-entry/:formEntryId/status
 * Get status of formatting and vector sync for a form entry
 */

import { adminDb } from '../lib/firebaseAdmin.js';

// CORS headers helper
function setCorsHeaders(res, origin) {
  const corsOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['*'];
  const allowedOrigin = corsOrigins.includes('*') ? '*' : 
                       (origin && corsOrigins.includes(origin)) ? origin : corsOrigins[0];
  
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

export default async function handler(req, res) {
  setCorsHeaders(res, req.headers.origin);

  // Handle OPTIONS requests
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    // Extract formEntryId from URL path or params
    // Expected format: /api/form-entry/:formEntryId/status
    let formEntryId = req.params?.formEntryId;
    
    // Fallback: parse from URL if params not available
    if (!formEntryId) {
      const urlParts = req.url.split('/');
      const formEntryIdIndex = urlParts.indexOf('form-entry');
      formEntryId = formEntryIdIndex >= 0 && urlParts[formEntryIdIndex + 1] 
        ? urlParts[formEntryIdIndex + 1] 
        : null;
    }

    if (!formEntryId) {
      return res.status(400).json({ success: false, error: 'formEntryId is required in URL path' });
    }

    console.log('📊 [FormEntryStatus] Status request for:', formEntryId);

    // Get form entry
    const formEntryDoc = await adminDb.collection('formEntries').doc(formEntryId).get();
    if (!formEntryDoc.exists) {
      return res.status(404).json({ success: false, error: 'FormEntry not found' });
    }

    const formEntry = { id: formEntryDoc.id, ...formEntryDoc.data() };
    const fileAttachments = Array.isArray(formEntry.fileAttachments) ? formEntry.fileAttachments : [];

    // Build status response
    const files = fileAttachments.map(att => ({
      fileName: att.fileName || 'Unknown',
      fileType: att.fileType || 'unknown',
      formattingStatus: att.formattingStatus || 'pending',
      formattingError: att.formattingError || null,
      hasExtractedText: !!(att.extractedText || att.rawExtractedText),
      hasFormattedText: !!att.extractedText && att.formattingStatus === 'completed',
      hasRawText: !!att.rawExtractedText,
    }));

    const canRetry = {
      formatting: files.some(f => f.formattingStatus === 'failed' || f.formattingStatus === 'pending'),
      vectorSync: formEntry.vectorSyncStatus === 'failed' || formEntry.vectorSyncStatus === 'pending',
    };

    // Determine actual status - distinguish between null (old entries) and 'pending' (new entries)
    // For old entries without status fields, return 'not_applicable' instead of 'pending'
    const hasStatusFields = 'formattingStatus' in formEntry || 'vectorSyncStatus' in formEntry;
    const formattingStatus = formEntry.formattingStatus !== undefined 
      ? formEntry.formattingStatus 
      : (hasStatusFields ? 'not_applicable' : null);
    const vectorSyncStatus = formEntry.vectorSyncStatus !== undefined 
      ? formEntry.vectorSyncStatus 
      : (hasStatusFields ? 'not_applicable' : null);

    return res.status(200).json({
      success: true,
      formEntryId: formEntry.id,
      formattingStatus: formattingStatus,
      formattingRetryCount: formEntry.formattingRetryCount || 0,
      formattingError: formEntry.formattingError || null,
      vectorSyncStatus: vectorSyncStatus,
      vectorSyncRetryCount: formEntry.vectorSyncRetryCount || 0,
      vectorSyncError: formEntry.vectorSyncError || null,
      vectorSyncWithRawText: formEntry.vectorSyncWithRawText || false,
      files,
      canRetry,
    });

  } catch (error) {
    console.error('❌ [FormEntryStatus] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message,
    });
  }
}


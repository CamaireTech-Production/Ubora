/**
 * POST /api/vector/sync/retry
 * Retry vector synchronization for a failed form entry
 */

import { adminDb } from '../../lib/firebaseAdmin.js';
import { syncFormEntryToVector } from '../../workers/vectorSync.js';
import { initializeQdrant } from '../../lib/vectorDb.js';

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
    const { formEntryId, useRawText = false } = req.body;

    if (!formEntryId) {
      return res.status(400).json({ success: false, error: 'formEntryId is required' });
    }

    console.log('🔄 [VectorSyncRetry] Retry request received:', { formEntryId, useRawText });

    // Initialize Qdrant connection
    await initializeQdrant();

    // Get form entry to check status
    const formEntryDoc = await adminDb.collection('formEntries').doc(formEntryId).get();
    if (!formEntryDoc.exists) {
      return res.status(404).json({ success: false, error: 'FormEntry not found' });
    }

    const formEntry = formEntryDoc.data();
    
    // Determine if we should use raw text
    // Use raw text if:
    // 1. Explicitly requested (useRawText=true)
    // 2. Formatting failed and we're doing fallback
    const shouldUseRawText = useRawText || 
      (formEntry.formattingStatus === 'failed' && formEntry.formattingRetryCount >= 3);

    // Perform sync
    const result = await syncFormEntryToVector(formEntryId, 'update', shouldUseRawText);

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'Vector sync retry completed successfully',
        formEntryId,
        useRawText: shouldUseRawText,
        result,
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error || 'Vector sync retry failed',
        formEntryId,
        result,
      });
    }

  } catch (error) {
    console.error('❌ [VectorSyncRetry] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message,
    });
  }
}


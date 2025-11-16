/**
 * POST /api/vector/sync
 * Manually trigger vector synchronization for a formEntry
 */

import { syncFormEntryToVector } from '../workers/vectorSync.js';
import { initializeQdrant } from '../lib/vectorDb.js';

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
  // Set CORS headers
  const origin = req.headers.origin;
  setCorsHeaders(res, origin);

  // Handle OPTIONS requests
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { formEntryId, operation = 'create' } = req.body;

  console.log('🔄 [VectorSync API] Received sync request:', { formEntryId, operation });

  if (!formEntryId) {
    console.error('❌ [VectorSync API] Missing formEntryId in request');
    return res.status(400).json({ success: false, error: 'formEntryId is required' });
  }

  try {
    console.log('🔌 [VectorSync API] Initializing Qdrant connection...');
    await initializeQdrant(); // Ensure Qdrant is ready
    console.log('✅ [VectorSync API] Qdrant initialized, starting sync...');

    const result = await syncFormEntryToVector(formEntryId, operation);
    console.log('📊 [VectorSync API] Sync result:', result);

    if (result.success) {
      return res.status(200).json({ 
        success: true, 
        message: `FormEntry ${formEntryId} synced successfully`, 
        result 
      });
    } else {
      return res.status(500).json({ 
        success: false, 
        error: result.error || 'Vector sync failed', 
        result 
      });
    }
  } catch (error) {
    console.error('❌ Error in vector sync endpoint:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error', 
      details: error.message 
    });
  }
}


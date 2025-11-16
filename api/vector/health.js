/**
 * GET /api/vector/health
 * Health check for Qdrant vector database
 */

import { initializeQdrant, checkQdrantHealth, getCollectionInfo, COLLECTION_NAME } from '../lib/vectorDb.js';

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
  // Set CORS headers
  const origin = req.headers.origin;
  setCorsHeaders(res, origin);

  // Handle OPTIONS requests
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    await initializeQdrant(); // Ensure Qdrant is ready and collection exists

    const healthStatus = await checkQdrantHealth();
    const collectionInfo = await getCollectionInfo(COLLECTION_NAME);

    return res.status(200).json({
      success: true,
      qdrant: healthStatus,
      collection: collectionInfo,
      message: 'Qdrant vector database is healthy and collection exists.',
    });
  } catch (error) {
    console.error('❌ Error in vector health endpoint:', error);
    return res.status(500).json({
      success: false,
      error: 'Vector database health check failed',
      details: error.message,
    });
  }
}


/**
 * Qdrant Vector Database Service
 * Handles connection and basic operations with Qdrant vector database
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const loadedLocalEnv = dotenv.config({ path: path.join(process.cwd(), '.env.local') });
if (!loadedLocalEnv || !loadedLocalEnv.parsed) {
  dotenv.config({ path: path.join(process.cwd(), '.env') });
}

// Qdrant configuration
// Default URL logic:
// - If QDRANT_URL is explicitly set in env, use it
// - If running on VPS (detected by checking if we're in /var/www/ubora-backend-*), use localhost
// - Otherwise (local dev), use VPS IP since Qdrant is hosted on VPS
const isRunningOnVPS = __dirname.includes('/var/www/ubora-backend') || process.cwd().includes('/var/www/ubora-backend');
const DEFAULT_QDRANT_URL = isRunningOnVPS 
  ? 'http://localhost:6333'  // On VPS, Qdrant is local
  : 'http://72.60.94.31:6333'; // Local dev, Qdrant is on VPS

const QDRANT_URL = process.env.QDRANT_URL || DEFAULT_QDRANT_URL;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || null;
const COLLECTION_NAME = process.env.QDRANT_COLLECTION_NAME || 'ubora_vectors';

// Vector dimension for OpenAI text-embedding-3-small (1536) or text-embedding-3-large (3072)
// We'll use text-embedding-3-small by default (1536 dimensions)
const VECTOR_SIZE = 1536;

/**
 * Make HTTP request to Qdrant API
 */
async function qdrantRequest(endpoint, options = {}) {
  const url = `${QDRANT_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (QDRANT_API_KEY) {
    headers['api-key'] = QDRANT_API_KEY;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Qdrant API error (${response.status}): ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
      throw new Error(`Cannot connect to Qdrant at ${QDRANT_URL}. Is Qdrant running?`);
    }
    throw error;
  }
}

/**
 * Check if Qdrant is accessible and healthy
 */
export async function checkQdrantHealth() {
  try {
    // Try /health endpoint first
    try {
      const response = await qdrantRequest('/health');
      return {
        healthy: true,
        status: response.status || 'ok',
        version: response.version || 'unknown',
      };
    } catch (healthError) {
      // If /health doesn't exist, try /collections endpoint as fallback
      // This endpoint should always exist and work
      const collectionsResponse = await qdrantRequest('/collections');
      return {
        healthy: true,
        status: 'ok',
        version: 'unknown',
        note: 'Health check via collections endpoint',
      };
    }
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
    };
  }
}

/**
 * Check if collection exists
 */
export async function collectionExists(collectionName = COLLECTION_NAME) {
  try {
    await qdrantRequest(`/collections/${collectionName}`);
    return true;
  } catch (error) {
    if (error.message.includes('404')) {
      return false;
    }
    throw error;
  }
}

/**
 * Create collection if it doesn't exist
 */
export async function ensureCollection(collectionName = COLLECTION_NAME, vectorSize = VECTOR_SIZE) {
  try {
    const exists = await collectionExists(collectionName);
    
    if (exists) {
      logger.info('Collection already exists', { collectionName }, 'vectorDb.js');
      return { created: false, collectionName };
    }

    logger.info('Creating collection', { collectionName, vectorSize }, 'vectorDb.js');

    const payload = {
      vectors: {
        size: vectorSize,
        distance: 'Cosine', // Cosine similarity for semantic search
      },
      optimizers_config: {
        default_segment_number: 2,
      },
      replication_factor: 1,
    };

    await qdrantRequest(`/collections/${collectionName}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    logger.info('Collection created successfully', { collectionName }, 'vectorDb.js');
    return { created: true, collectionName };
  } catch (error) {
    logger.error('Failed to create collection', { collectionName, error }, 'vectorDb.js');
    throw error;
  }
}

/**
 * Get collection info
 */
export async function getCollectionInfo(collectionName = COLLECTION_NAME) {
  try {
    return await qdrantRequest(`/collections/${collectionName}`);
  } catch (error) {
    if (error.message.includes('404')) {
      throw new Error(`Collection "${collectionName}" does not exist`);
    }
    throw error;
  }
}

/**
 * Delete collection (use with caution!)
 */
export async function deleteCollection(collectionName = COLLECTION_NAME) {
  try {
    await qdrantRequest(`/collections/${collectionName}`, {
      method: 'DELETE',
    });
    logger.info('Collection deleted', { collectionName }, 'vectorDb.js');
    return true;
  } catch (error) {
    logger.error('Failed to delete collection', { collectionName, error }, 'vectorDb.js');
    throw error;
  }
}

/**
 * Initialize Qdrant connection and ensure collection exists
 */
export async function initializeQdrant(collectionName = COLLECTION_NAME, vectorSize = VECTOR_SIZE) {
  try {
    logger.info('Connecting to Qdrant', {
      url: QDRANT_URL,
      collection: collectionName,
      environment: isRunningOnVPS ? 'VPS (localhost)' : 'Local Dev (VPS IP)',
      qdrantUrlFromEnv: process.env.QDRANT_URL || 'Not set (using default)'
    }, 'vectorDb.js');

    // Check health
    const health = await checkQdrantHealth();
    if (!health.healthy) {
      throw new Error(`Qdrant is not healthy: ${health.error}`);
    }
    logger.info('Qdrant is healthy', { version: health.version }, 'vectorDb.js');

    // Ensure collection exists
    await ensureCollection(collectionName, vectorSize);

    return {
      connected: true,
      collectionName,
      vectorSize,
      qdrantUrl: QDRANT_URL,
    };
  } catch (error) {
    logger.error('Failed to initialize Qdrant', error, 'vectorDb.js');
    throw error;
  }
}

// Export Qdrant request function for use in other modules
export { qdrantRequest, QDRANT_URL, COLLECTION_NAME, VECTOR_SIZE };


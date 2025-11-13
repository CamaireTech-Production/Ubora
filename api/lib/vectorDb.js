/**
 * Qdrant Vector Database Service
 * Handles connection and basic operations with Qdrant vector database
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
const loadedLocalEnv = dotenv.config({ path: path.join(process.cwd(), '.env.local') });
if (!loadedLocalEnv || !loadedLocalEnv.parsed) {
  dotenv.config({ path: path.join(process.cwd(), '.env') });
}

// Qdrant configuration
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
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
      console.log(`✅ Collection "${collectionName}" already exists`);
      return { created: false, collectionName };
    }

    console.log(`📦 Creating collection "${collectionName}" with vector size ${vectorSize}...`);

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

    console.log(`✅ Collection "${collectionName}" created successfully`);
    return { created: true, collectionName };
  } catch (error) {
    console.error(`❌ Failed to create collection "${collectionName}":`, error);
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
    console.log(`✅ Collection "${collectionName}" deleted`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to delete collection "${collectionName}":`, error);
    throw error;
  }
}

/**
 * Initialize Qdrant connection and ensure collection exists
 */
export async function initializeQdrant(collectionName = COLLECTION_NAME, vectorSize = VECTOR_SIZE) {
  try {
    console.log('🔌 Connecting to Qdrant...');
    console.log(`   URL: ${QDRANT_URL}`);
    console.log(`   Collection: ${collectionName}`);

    // Check health
    const health = await checkQdrantHealth();
    if (!health.healthy) {
      throw new Error(`Qdrant is not healthy: ${health.error}`);
    }
    console.log(`✅ Qdrant is healthy (version: ${health.version})`);

    // Ensure collection exists
    await ensureCollection(collectionName, vectorSize);

    return {
      connected: true,
      collectionName,
      vectorSize,
      qdrantUrl: QDRANT_URL,
    };
  } catch (error) {
    console.error('❌ Failed to initialize Qdrant:', error);
    throw error;
  }
}

// Export Qdrant request function for use in other modules
export { qdrantRequest, QDRANT_URL, COLLECTION_NAME, VECTOR_SIZE };


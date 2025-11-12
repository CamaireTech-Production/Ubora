/**
 * OpenAI Embeddings Service
 * Handles text chunking and embedding generation for vector database
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
const loadedLocalEnv = dotenv.config({ path: path.join(process.cwd(), '.env.local') });
if (!loadedLocalEnv || !loadedLocalEnv.parsed) {
  dotenv.config({ path: path.join(process.cwd(), '.env') });
}

import OpenAI from 'openai';
import { TokenCounter } from './tokenCounter.js';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Embedding model configuration
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = EMBEDDING_MODEL === 'text-embedding-3-large' ? 3072 : 1536;

// Chunking configuration
const CHUNK_SIZE = 800; // Target tokens per chunk
const CHUNK_OVERLAP = 150; // Overlap tokens between chunks

/**
 * Estimate tokens in text (simplified)
 */
function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4); // ~4 chars per token
}

/**
 * Split text into chunks with overlap
 */
export function chunkText(text, chunkSize = CHUNK_SIZE, chunkOverlap = CHUNK_OVERLAP) {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const chunks = [];
  const sentences = text.split(/([.!?]\s+|\.\n|\n\n)/);
  
  let currentChunk = '';
  let currentTokens = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const sentenceTokens = estimateTokens(sentence);

    // If adding this sentence would exceed chunk size, save current chunk
    if (currentTokens + sentenceTokens > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      
      // Start new chunk with overlap (last part of previous chunk)
      const overlapText = getOverlapText(currentChunk, chunkOverlap);
      currentChunk = overlapText + sentence;
      currentTokens = estimateTokens(overlapText) + sentenceTokens;
    } else {
      currentChunk += sentence;
      currentTokens += sentenceTokens;
    }
  }

  // Add final chunk if it has content
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  // If text is shorter than chunk size, return as single chunk
  if (chunks.length === 0 && text.trim().length > 0) {
    return [text.trim()];
  }

  return chunks.filter(chunk => chunk.length > 0);
}

/**
 * Get overlap text from end of chunk
 */
function getOverlapText(text, overlapTokens) {
  const words = text.split(/\s+/);
  const targetWords = Math.ceil(overlapTokens * 1.5); // Approximate words for overlap tokens
  const overlapWords = words.slice(-targetWords);
  return overlapWords.join(' ');
}

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text) {
  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty');
  }

  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.trim(),
    });

    const embedding = response.data[0].embedding;
    
    if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(`Invalid embedding dimensions: expected ${EMBEDDING_DIMENSIONS}, got ${embedding?.length || 0}`);
    }

    return embedding;
  } catch (error) {
    console.error('❌ Failed to generate embedding:', error);
    throw new Error(`Embedding generation failed: ${error.message}`);
  }
}

/**
 * Generate embeddings for multiple texts (batch)
 */
export async function generateEmbeddings(texts) {
  if (!texts || texts.length === 0) {
    return [];
  }

  // Filter out empty texts
  const validTexts = texts.filter(text => text && text.trim().length > 0);
  
  if (validTexts.length === 0) {
    return [];
  }

  try {
    // OpenAI allows up to 2048 inputs per batch, but we'll use smaller batches for safety
    const BATCH_SIZE = 100;
    const embeddings = [];

    for (let i = 0; i < validTexts.length; i += BATCH_SIZE) {
      const batch = validTexts.slice(i, i + BATCH_SIZE);
      
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batch.map(text => text.trim()),
      });

      const batchEmbeddings = response.data.map(item => item.embedding);
      embeddings.push(...batchEmbeddings);
    }

    return embeddings;
  } catch (error) {
    console.error('❌ Failed to generate batch embeddings:', error);
    throw new Error(`Batch embedding generation failed: ${error.message}`);
  }
}

/**
 * Chunk text and generate embeddings for all chunks
 */
export async function chunkAndEmbed(text) {
  const chunks = chunkText(text);
  
  if (chunks.length === 0) {
    return [];
  }

  const embeddings = await generateEmbeddings(chunks);

  return chunks.map((chunk, index) => ({
    text: chunk,
    embedding: embeddings[index],
    chunkIndex: index,
    totalChunks: chunks.length,
  }));
}

// Export configuration
export { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS, CHUNK_SIZE, CHUNK_OVERLAP };


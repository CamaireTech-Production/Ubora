/**
 * Conversation Manager Module
 * Extracted from ask.js for better code organization
 * 
 * Functions:
 * - getConversationContext: Retrieves conversation context (summary + recent messages)
 * - generateConversationSummary: Generates conversation summary using OpenAI
 * - updateConversationContext: Updates conversation context with new data
 */

import { adminDb } from '../lib/firebaseAdmin.js';
import admin from 'firebase-admin';
import { logger } from '../lib/logger.js';
import OpenAI from 'openai';

// Configuration OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Helper function to safely convert dates
 */
const safeToDate = (dateValue) => {
  if (!dateValue) return null;
  if (dateValue instanceof Date) return dateValue;
  if (dateValue.toDate && typeof dateValue.toDate === 'function') {
    // Firestore Timestamp
    return dateValue.toDate();
  }
  if (typeof dateValue === 'string' || typeof dateValue === 'number') {
    return new Date(dateValue);
  }
  return null;
};

/**
 * Function to generate conversation summary using OpenAI
 * @param {string} conversationId - Conversation ID
 * @param {Array} messages - Array of messages to summarize
 * @returns {Promise<string>} - Generated summary content
 */
async function generateConversationSummary(conversationId, messages) {
  try {
    logger.info('Generating conversation summary', { conversationId }, 'conversationManager.js');
    
    // Get last 15-20 messages for summary generation
    const recentMessages = messages.slice(-20);
    
    const summaryPrompt = `Analyse cette conversation entre un directeur et son assistant IA pour l'analyse de données d'entreprise.

MESSAGES RÉCENTS:
${recentMessages.map(msg => `${msg.type === 'user' ? 'Directeur' : 'ARCHA'}: ${msg.content}`).join('\n')}

Génère un résumé concis qui capture:
1. Les sujets principaux discutés (analyses de données, rapports, tendances)
2. Les préférences du directeur (formats de réponse préférés, périodes d'analyse fréquentes, formulaires souvent utilisés)
3. Les analyses récurrentes demandées
4. Le contexte métier spécifique et les besoins du directeur

Format de réponse attendu:
RÉSUMÉ: [Résumé concis de 200-300 mots]
PRÉFÉRENCES: [Formats préférés, périodes fréquentes, formulaires utilisés]
SUJETS CLÉS: [Liste des sujets principaux abordés]

Résumé:`;

    const summaryResponse = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: [{ role: 'user', content: summaryPrompt }],
      max_tokens: 500,
      temperature: 0.3
    });

    const summaryContent = summaryResponse.choices[0].message.content;
    logger.info('Generated conversation summary', { preview: summaryContent.substring(0, 100) + '...' }, 'conversationManager.js');
    
    return summaryContent;
  } catch (error) {
    logger.error('Failed to generate conversation summary', error, 'conversationManager.js');
    throw error;
  }
}

/**
 * Function to retrieve conversation context (summary + recent messages)
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<Object|null>} - Conversation context or null if not found
 */
async function getConversationContext(conversationId) {
  try {
    if (!conversationId) return null;
    
    logger.debug('Retrieving conversation context', { conversationId }, 'conversationManager.js');
    
    // Get conversation document
    const conversationDoc = await adminDb.collection('conversations').doc(conversationId).get();
    if (!conversationDoc.exists) {
      logger.warn('Conversation not found', { conversationId }, 'conversationManager.js');
      return null;
    }
    
    const conversation = conversationDoc.data();
    
    // Get last 10 messages (sub-collection query, no composite index needed)
    // Optimized with limit to reduce data transfer
    const messagesSnapshot = await adminDb
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .orderBy('timestamp', 'desc')
      .limit(10) // Limit to reduce data transfer
      .get();
    
    const recentMessages = messagesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        type: data.type,
        content: data.content,
        timestamp: safeToDate(data.timestamp)
      };
    }).reverse(); // Reverse to get chronological order
    
    const context = {
      summary: conversation.summary,
      recentMessages: recentMessages,
      messageCount: conversation.messageCount || 0
    };
    
    logger.debug('Retrieved conversation context', {
      hasSummary: !!context.summary,
      recentMessagesCount: context.recentMessages.length,
      messageCount: context.messageCount
    }, 'conversationManager.js');
    
    return context;
  } catch (error) {
    logger.error('Failed to retrieve conversation context', error, 'conversationManager.js');
    return null;
  }
}

/**
 * Function to update conversation context with new data
 * @param {string} conversationId - Conversation ID
 * @param {Object} contextData - Context data to update
 * @returns {Promise<void>}
 */
async function updateConversationContext(conversationId, contextData) {
  try {
    if (!conversationId) {
      logger.warn('Cannot update conversation context: no conversationId provided', null, 'conversationManager.js');
      return;
    }

    logger.debug('Updating conversation context', { conversationId }, 'conversationManager.js');

    await adminDb.collection('conversations').doc(conversationId).update({
      ...contextData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    logger.debug('Conversation context updated successfully', { conversationId }, 'conversationManager.js');
  } catch (error) {
    logger.error('Failed to update conversation context', error, 'conversationManager.js');
    throw error;
  }
}

/**
 * Function to update conversation summary
 * @param {string} conversationId - Conversation ID
 * @param {string} summaryContent - Summary content
 * @param {number} messageCount - Message count at summary generation
 * @returns {Promise<void>}
 */
async function updateConversationSummary(conversationId, summaryContent, messageCount) {
  try {
    if (!conversationId) {
      logger.warn('Cannot update conversation summary: no conversationId provided', null, 'conversationManager.js');
      return;
    }

    logger.debug('Updating conversation summary', { conversationId, messageCount }, 'conversationManager.js');

    await adminDb.collection('conversations').doc(conversationId).update({
      'summary.content': summaryContent,
      'summary.lastUpdated': admin.firestore.FieldValue.serverTimestamp(),
      'summary.messageCountAtSummary': messageCount
    });

    logger.info('Conversation summary updated successfully', { conversationId }, 'conversationManager.js');
  } catch (error) {
    logger.error('Failed to update conversation summary', error, 'conversationManager.js');
    throw error;
  }
}

/**
 * Function to update conversation metadata (lastMessageAt, messageCount, etc.)
 * @param {string} conversationId - Conversation ID
 * @param {Object} metadata - Metadata to update
 * @returns {Promise<void>}
 */
async function updateConversationMetadata(conversationId, metadata = {}) {
  try {
    if (!conversationId) {
      logger.warn('Cannot update conversation metadata: no conversationId provided', null, 'conversationManager.js');
      return;
    }

    logger.debug('Updating conversation metadata', { conversationId }, 'conversationManager.js');

    const updateData = {
      lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      ...metadata
    };

    await adminDb.collection('conversations').doc(conversationId).update(updateData);

    logger.debug('Conversation metadata updated successfully', { conversationId }, 'conversationManager.js');
  } catch (error) {
    logger.error('Failed to update conversation metadata', error, 'conversationManager.js');
    throw error;
  }
}

export {
  getConversationContext,
  generateConversationSummary,
  updateConversationContext,
  updateConversationSummary,
  updateConversationMetadata
};

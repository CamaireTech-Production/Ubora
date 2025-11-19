/**
 * Conversation Handler
 * Handles conversation creation, updates, and summary generation
 */

import { adminDb } from '../lib/firebaseAdmin.js';
import admin from 'firebase-admin';
import { logger } from '../lib/logger.js';
import { updateConversationContext, updateConversationSummary, updateConversationMetadata, generateConversationSummary } from './conversationManager.js';
import { createConversation, saveUserMessage, saveAssistantMessage } from './messageSaver.js';

/**
 * Helper to safely convert dates
 */
function safeToDate(dateValue) {
  if (!dateValue) return null;
  if (dateValue instanceof Date) return dateValue;
  if (dateValue.toDate && typeof dateValue.toDate === 'function') {
    return dateValue.toDate();
  }
  if (typeof dateValue === 'string' || typeof dateValue === 'number') {
    return new Date(dateValue);
  }
  return null;
}

/**
 * Get or create conversation
 */
export async function getOrCreateConversation(uid, userData, question, conversationId, responseFormat, selectedResponseFormats, selectedFormIds, filters, data, hasPDFContent) {
  let existingConversationContext = null;
  
  if (!conversationId) {
    // Create new conversation
    conversationId = await createConversation(uid, userData, question, responseFormat, selectedResponseFormats, selectedFormIds, filters, data, hasPDFContent);
  } else {
    // Load existing conversation
    const conversationDoc = await adminDb.collection('conversations').doc(conversationId).get();
    if (conversationDoc.exists) {
      existingConversationContext = conversationDoc.data();
      
      // Update conversation context
      const safePreviousContext = existingConversationContext?.context ? {
        lastAnalysisType: existingConversationContext.context.lastAnalysisType || null,
        lastFormats: existingConversationContext.context.lastFormats || [],
        lastPeriod: existingConversationContext.context.lastPeriod || 'all',
        lastFormIds: existingConversationContext.context.lastFormIds || []
      } : null;

      const safeDataInsights = {
        totalEntries: data?.totals?.entries || 0,
        uniqueUsers: data?.totals?.uniqueUsers || 0,
        uniqueForms: data?.totals?.uniqueForms || 0,
        hasPDFContent: hasPDFContent || false
      };

      await updateConversationContext(conversationId, {
        lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
        messageCount: admin.firestore.FieldValue.increment(1),
        context: {
          lastAnalysisType: responseFormat || 'text',
          lastFormats: selectedResponseFormats || [],
          lastPeriod: filters?.period || 'all',
          lastFormIds: selectedFormIds || [],
          dataInsights: safeDataInsights,
          previousContext: safePreviousContext
        }
      });

      // Check if we need to generate/update summary (every 12 messages)
      const currentMessageCount = (existingConversationContext?.messageCount || 0) + 1;
      const shouldGenerateSummary = !existingConversationContext?.summary || 
        currentMessageCount % 12 === 0;

      if (shouldGenerateSummary && conversationId) {
        try {
          logger.info('Triggering summary generation for conversation', { conversationId }, '/api/ai/conversationHandler');
          
          // Get recent messages for summary
          const messagesSnapshot = await adminDb
            .collection('conversations')
            .doc(conversationId)
            .collection('messages')
            .orderBy('timestamp', 'desc')
            .limit(20)
            .get();
          
          const messages = messagesSnapshot.docs.map(doc => {
            const msgData = doc.data();
            return {
              type: msgData.type,
              content: msgData.content,
              timestamp: safeToDate(msgData.timestamp)
            };
          }).reverse();
          
          // Generate summary
          const summaryContent = await generateConversationSummary(conversationId, messages);
          
          // Update conversation with summary
          await updateConversationSummary(conversationId, summaryContent, currentMessageCount);
          
          logger.info('Generated conversation summary', { conversationId }, '/api/ai/conversationHandler');
        } catch (summaryError) {
          logger.error('Failed to generate summary', summaryError, '/api/ai/conversationHandler');
          // Don't fail the main request if summary generation fails
        }
      }
    }
  }
  
  return { conversationId, existingConversationContext };
}

/**
 * Get form titles for selected forms
 */
export function getFormTitles(selectedFormIds, data) {
  const formTitles = [];
  if (selectedFormIds && selectedFormIds.length > 0) {
    for (const formId of selectedFormIds) {
      const form = data.formsById?.get?.(formId);
      if (form && form.title) {
        formTitles.push(form.title);
      }
    }
  } else {
    if (data.formsById) {
      for (const [formId, form] of data.formsById.entries()) {
        if (form && form.title) {
          formTitles.push(form.title);
        }
      }
    }
  }
  return formTitles;
}

/**
 * Save messages to conversation
 */
export async function saveConversationMessages(
  conversationId,
  isScheduled,
  question,
  answer,
  startTime,
  responseFormat,
  selectedResponseFormats,
  selectedFormIds,
  formTitles,
  filters,
  data,
  tokensUsed,
  finalUserTokens,
  packageLimit,
  updatedPayAsYouGoTokens,
  updatedTokensUsed,
  existingConversationContext,
  referencedPDFFiles,
  referencedImageFiles
) {
  let savedUserMessage = null;
  
  if (!isScheduled) {
    // Save user message
    savedUserMessage = await saveUserMessage(
      conversationId,
      question,
      selectedResponseFormats,
      selectedFormIds,
      formTitles,
      filters
    );
    
    // Save assistant message
    await saveAssistantMessage(
      conversationId,
      answer,
      Date.now() - startTime,
      responseFormat,
      selectedResponseFormats,
      selectedFormIds,
      formTitles,
      data,
      tokensUsed,
      finalUserTokens,
      packageLimit,
      updatedPayAsYouGoTokens,
      updatedTokensUsed,
      existingConversationContext,
      referencedPDFFiles,
      referencedImageFiles
    );
    
    // Update conversation metadata
    await updateConversationMetadata(conversationId, {
      messageCount: admin.firestore.FieldValue.increment(2)
    });
  } else {
    logger.info('Skipping conversation message save - scheduled question', null, '/api/ai/conversationHandler');
  }
  
  return savedUserMessage;
}


/**
 * Message Saver
 * Handles saving user and assistant messages to Firestore
 */

import { adminDb } from '../lib/firebaseAdmin.js';
import admin from 'firebase-admin';
import { logger } from '../lib/logger.js';
import { getContentTypeForResponse } from './responseFormatter.js';
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
 * Save user message to conversation
 */
export async function saveUserMessage(conversationId, question, selectedResponseFormats, selectedFormIds, formTitles, filters) {
  if (!conversationId) {
    return null;
  }

  const userMessage = {
    type: 'user',
    content: question,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    meta: {
      ...(selectedResponseFormats && selectedResponseFormats.length > 0 ? {
        ...(selectedResponseFormats.length > 1 ? {} : { selectedFormat: selectedResponseFormats[0] }),
        selectedFormats: selectedResponseFormats
      } : {}),
      selectedFormIds: selectedFormIds || [],
      selectedFormTitles: formTitles,
      period: filters?.period || 'all',
      formId: filters?.formId || null,
      userId: filters?.userId || null
    }
  };
  
  try {
    const userMessageRef = await adminDb.collection('conversations').doc(conversationId).collection('messages').add(userMessage);
    const savedUserMessageDoc = await userMessageRef.get();
    return {
      id: savedUserMessageDoc.id,
      type: savedUserMessageDoc.data().type,
      content: savedUserMessageDoc.data().content,
      timestamp: savedUserMessageDoc.data().timestamp,
      meta: savedUserMessageDoc.data().meta
    };
  } catch (saveError) {
    logger.error('Failed to save user message', saveError, '/api/ai/messageSaver');
    return null;
  }
}

/**
 * Save assistant message to conversation
 */
export async function saveAssistantMessage(
  conversationId,
  answer,
  responseTime,
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
) {
  if (!conversationId) {
    return;
  }

  const assistantMessage = {
    type: 'assistant',
    content: answer || '',
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    responseTime,
    contentType: getContentTypeForResponse(responseFormat, selectedResponseFormats),
    meta: {
      ...(selectedResponseFormats && selectedResponseFormats.length > 0 ? {
        ...(selectedResponseFormats.length > 1 ? {} : { selectedFormat: selectedResponseFormats[0] }),
        selectedFormats: selectedResponseFormats
      } : {}),
      selectedFormIds: selectedFormIds || [],
      selectedFormTitles: formTitles,
      period: data.period?.label || 'unknown',
      usedEntries: data.totals?.entries || 0,
      breakdown: {
        users: data.totals?.uniqueUsers || 0,
        forms: data.totals?.uniqueForms || 0,
        dateRange: {
          start: data.period?.start?.toISOString() || new Date().toISOString(),
          end: data.period?.end?.toISOString() || new Date().toISOString()
        }
      },
      tokensUsed: tokensUsed || 0,
      userTokensCharged: finalUserTokens,
      remainingTokens: packageLimit === -1 ? -1 : Math.max(0, (packageLimit + updatedPayAsYouGoTokens) - updatedTokensUsed),
      model: 'gpt-4.1',
      responseFormat: responseFormat || 'text',
      conversationContext: {
        conversationId: conversationId,
        messageSequence: existingConversationContext?.messageCount || 2,
        previousAnalysis: existingConversationContext?.context?.lastAnalysisType || null,
        dataEvolution: {
          previousEntries: existingConversationContext?.context?.dataInsights?.totalEntries || 0,
          currentEntries: data.totals?.entries || 0,
          entriesChange: (data.totals?.entries || 0) - (existingConversationContext?.context?.dataInsights?.totalEntries || 0)
        }
      }
    },
    pdfFiles: referencedPDFFiles,
    imageFiles: referencedImageFiles
  };
  
  try {
    await adminDb.collection('conversations').doc(conversationId).collection('messages').add(assistantMessage);
  } catch (saveError) {
    logger.error('Failed to save assistant message', saveError, '/api/ai/messageSaver');
    // Don't throw error, just log it
  }
}

/**
 * Create new conversation
 */
export async function createConversation(uid, userData, question, responseFormat, selectedResponseFormats, selectedFormIds, filters, data, hasPDFContent) {
  const conversationData = {
    directorId: uid,
    agencyId: userData.agencyId,
    title: question.length > 50 ? question.substring(0, 50) + '...' : question,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
    messageCount: 1,
    context: {
      lastAnalysisType: responseFormat || 'text',
      lastFormats: selectedResponseFormats || [],
      lastPeriod: filters?.period || 'all',
      lastFormIds: selectedFormIds || [],
      dataInsights: {
        totalEntries: data.totals.entries,
        uniqueUsers: data.totals.uniqueUsers,
        uniqueForms: data.totals.uniqueForms,
        hasPDFContent: hasPDFContent
      }
    }
  };
  
  const conversationRef = await adminDb.collection('conversations').add(conversationData);
  return conversationRef.id;
}


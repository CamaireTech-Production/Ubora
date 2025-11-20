/**
 * AI Ask Handler - Refactored Version
 * Main handler for AI question requests
 * Uses extracted modules for better maintainability
 */

import dotenv from 'dotenv';
import path from 'path';
const loadedLocalEnv = dotenv.config({ path: path.join(process.cwd(), '.env.local') });
if (!loadedLocalEnv || !loadedLocalEnv.parsed) {
  dotenv.config({ path: path.join(process.cwd(), '.env') });
}

import { adminDb } from '../lib/firebaseAdmin.js';
import { logger } from '../lib/logger.js';
import { TokenCounter } from '../lib/tokenCounter.js';
import { searchAndFormatForAI } from '../lib/vectorSearch.js';
import { formatFieldValue } from '../lib/listValueFormatter.js';
import { getPeriodDates } from './periodDetector.js';
import { getActiveSession, updateTokenUsage, calculateUserTokens } from './tokenManager.js';
import { authenticateRequest, fetchUserProfile, getAuthErrorResponse } from './authHandler.js';
import { validateRequest, getValidationErrorResponse } from './requestValidator.js';
import { getConversationContext } from './conversationManager.js';
import { getContentTypeForResponse, generateMultiFormatFallbackResponse } from './responseFormatter.js';
import { buildSystemMessage, buildUserMessageForEstimation, buildUserMessage } from './promptBuilder.js';
import { generateAIResponse } from './openAIClient.js';
import { processFileReferences } from './fileReferenceHandler.js';
import { getOrCreateConversation, getFormTitles, saveConversationMessages } from './conversationHandler.js';

export default async function handler(req, res) {
  const startTime = Date.now();
  logger.info('Request received', { method: req.method }, '/api/ai/ask');
  
  try {
    // CORS headers
    const corsOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['*'];
    const origin = req.headers.origin;
    const allowedOrigin = corsOrigins.includes('*') ? '*' : 
                         (origin && corsOrigins.includes(origin)) ? origin : corsOrigins[0];
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    };

    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Méthode non autorisée' });
    }
    
    // 1. Authentication
    let uid;
    try {
      uid = await authenticateRequest(req);
    } catch (authError) {
      const errorResponse = getAuthErrorResponse(authError.message);
      return res.status(errorResponse.status).json(errorResponse);
    }

    // 2. Fetch user profile
    let userData;
    try {
      userData = await fetchUserProfile(uid);
    } catch (profileError) {
      const errorResponse = getAuthErrorResponse(profileError.message);
      return res.status(errorResponse.status).json(errorResponse);
    }

    // 3. Validate request
    let validatedRequest;
    try {
      validatedRequest = validateRequest(req);
    } catch (validationError) {
      const errorResponse = getValidationErrorResponse(validationError.message);
      return res.status(errorResponse.status).json(errorResponse);
    }

    const { question, filters, responseFormat, selectedResponseFormats, selectedFormIds, isScheduled, conversationId, debug } = validatedRequest;

    // 4. Get conversation context (only for regular chat)
    let conversationContext = null;
    if (!isScheduled && conversationId) {
      try {
        conversationContext = await getConversationContext(conversationId);
      } catch (contextError) {
        logger.error('Failed to retrieve conversation context', contextError, '/api/ai/ask');
        conversationContext = null;
      }
    }

    // 5. Vector search
    const { start, end, label } = getPeriodDates(filters.period);
    
    logger.debug('Searching vectors for relevant chunks', null, '/api/ai/ask');
    
    let vectorSearchResults;
    try {
      const formIdFilter = filters?.formId || (selectedFormIds?.length === 1 ? selectedFormIds[0] : null);
      
      vectorSearchResults = await searchAndFormatForAI(question, {
        agencyId: userData.agencyId,
        directorId: uid,
        formId: formIdFilter,
        userId: filters?.userId || null,
        period: { start, end },
        limit: 25,
        scoreThreshold: 0.3,
        selectedFormIds: selectedFormIds.length > 1 ? selectedFormIds : null,
        debug: debug
      });
    } catch (vectorError) {
      logger.error('Vector search failed', vectorError, '/api/ai/ask');
      return res.status(500).json({ 
        error: 'Erreur lors de la recherche vectorielle',
        code: 'VECTOR_SEARCH_ERROR',
        details: vectorError.message
      });
    }

    // 6. Build data structure from vector search results
    let data;
    if (!vectorSearchResults.hasResults) {
      data = {
        period: { start, end, label },
        totals: {
          entries: 0,
          uniqueUsers: 0,
          uniqueForms: 0,
          totalUsers: 0,
          totalForms: 0
        },
        submissions: [],
        userStats: [],
        formStats: [],
        timeline: [],
        todaySubmissions: [],
        thisWeekSubmissions: [],
        formsById: new Map(),
        usersById: new Map()
      };
    } else {
      const uniqueEntries = new Map();
      vectorSearchResults.chunks.forEach(chunk => {
        const entryId = chunk.metadata.entryId;
        if (!uniqueEntries.has(entryId)) {
          uniqueEntries.set(entryId, {
            id: entryId,
            formTitle: chunk.metadata.formTitle,
            employeeName: chunk.metadata.employeeName,
            submittedAt: chunk.metadata.submittedAt,
            formId: chunk.metadata.formId,
            userId: chunk.metadata.userId,
            answers: {},
            fileAttachments: chunk.metadata.fileName ? [{
              fileName: chunk.metadata.fileName,
              fileType: chunk.metadata.fileType,
              extractedText: chunk.text
            }] : []
          });
        }
      });

      const submissions = Array.from(uniqueEntries.values());
      const uniqueUsers = [...new Set(submissions.map(s => s.userId).filter(Boolean))];
      const uniqueForms = [...new Set(submissions.map(s => s.formId).filter(Boolean))];

      data = {
        period: { start, end, label },
        totals: {
          entries: submissions.length,
          uniqueUsers: uniqueUsers.length,
          uniqueForms: uniqueForms.length,
          totalUsers: uniqueUsers.length,
          totalForms: uniqueForms.length
        },
        submissions: submissions,
        userStats: [],
        formStats: [],
        timeline: [],
        todaySubmissions: submissions.filter(s => {
          const date = new Date(s.submittedAt);
          return date.toDateString() === new Date().toDateString();
        }),
        thisWeekSubmissions: submissions.filter(s => {
          const date = new Date(s.submittedAt);
          return date >= start && date <= end;
        }),
        formsById: new Map(),
        usersById: new Map()
      };
    }

    // 7. Check for PDF and image content
    const hasPDFContent = data.submissions.some(s => 
      s.fileAttachments && s.fileAttachments.some(att => 
        att.fileType === 'application/pdf' && att.extractedText && att.extractedText.trim().length > 0
      )
    );

    const hasImageContent = data.submissions.some(s => 
      s.fileAttachments && s.fileAttachments.some(att => 
        att.fileType && att.fileType.startsWith('image/') && att.extractedText && att.extractedText.trim().length > 0
      )
    );

    // 8. Token estimation and validation
    const basicSystemPrompt = `Tu es ARCHA, assistant IA expert en analyse de données d'entreprise.`;
    const userPromptForEstimation = buildUserMessageForEstimation(question, data);
    const estimatedTokens = TokenCounter.getTotalEstimatedTokens(basicSystemPrompt, userPromptForEstimation, 2000);
    const userTokensToCharge = TokenCounter.getUserTokensToCharge(estimatedTokens, 2.5);
    
    const currentSession = await getActiveSession(uid, userData);
    
    if (!currentSession) {
      return res.status(400).json({
        error: 'Aucune session active trouvée. Veuillez sélectionner un package.',
        code: 'NO_ACTIVE_SESSION'
      });
    }
    
    const packageLimit = currentSession.packageResources?.tokensIncluded || 0;
    let currentTokensUsed = currentSession.usage?.tokensUsed || 0;
    const payAsYouGoTokens = currentSession.payAsYouGoResources?.tokens || 0;
    const subscriptionExpired = new Date() > new Date(currentSession.endDate);
    
    if (subscriptionExpired) {
      return res.status(402).json({ 
        error: 'Abonnement expiré',
        code: 'SUBSCRIPTION_EXPIRED',
        message: 'Votre abonnement a expiré. Veuillez renouveler votre abonnement pour continuer à utiliser les services.',
        canRenew: true
      });
    }
    
    const totalAvailableTokens = packageLimit === -1 ? -1 : packageLimit + payAsYouGoTokens;
    
    if (packageLimit !== -1 && currentTokensUsed + userTokensToCharge > totalAvailableTokens) {
      return res.status(402).json({ 
        error: 'Tokens insuffisants',
        code: 'INSUFFICIENT_TOKENS',
        required: userTokensToCharge,
        available: totalAvailableTokens - currentTokensUsed,
        packageLimit,
        payAsYouGoTokens,
        canPurchaseMore: true
      });
    }

    // 9. Build prompts
    const systemPrompt = buildSystemMessage(
      conversationContext,
      userData,
      data,
      responseFormat,
      selectedResponseFormats,
      hasPDFContent,
      hasImageContent
    );
    
    const userPromptForAI = buildUserMessage(
      question,
      vectorSearchResults,
      responseFormat,
      hasPDFContent,
      hasImageContent
    );

    // 10. Generate AI response
    const aiResponse = await generateAIResponse(
      systemPrompt,
      userPromptForAI,
      responseFormat,
      selectedResponseFormats,
      data
    );

    const { answer, tokensUsed, finalUserTokens } = aiResponse;

    // 11. Process file references
    const { referencedPDFFiles, referencedImageFiles } = processFileReferences(data, answer);

    // 12. Get or create conversation and save messages
    let savedUserMessage = null;
    let finalConversationId = conversationId;
    let existingConversationContext = null;
    let updatedTokensUsed = currentTokensUsed;
    let updatedPayAsYouGoTokens = payAsYouGoTokens;

    try {
      if (!isScheduled) {
        const conversationResult = await getOrCreateConversation(
          uid,
          userData,
          question,
          conversationId,
          responseFormat,
          selectedResponseFormats,
          selectedFormIds,
          filters,
          data,
          hasPDFContent
        );
        
        finalConversationId = conversationResult.conversationId;
        existingConversationContext = conversationResult.existingConversationContext;
        
        const formTitles = getFormTitles(selectedFormIds, data);
        
        savedUserMessage = await saveConversationMessages(
          finalConversationId,
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
        );
      }
    } catch (storeError) {
      logger.error('Error storing conversation', storeError, '/api/ai/ask');
      if (!finalConversationId) {
        finalConversationId = conversationId || 'error_' + Date.now();
      }
    }

    // 13. Update token usage
    if (packageLimit !== -1 && finalUserTokens > 0) {
      try {
        const tokenUpdateResult = await updateTokenUsage(uid, finalUserTokens, currentSession);
        updatedTokensUsed = tokenUpdateResult.updatedTokensUsed;
        updatedPayAsYouGoTokens = tokenUpdateResult.updatedPayAsYouGoTokens;
      } catch (tokenError) {
        logger.error('SESSION TOKEN TRACKING ERROR', tokenError, '/api/ai/ask');
        if (tokenError.message.includes('Aucune session active')) {
          return res.status(400).json({
            error: tokenError.message,
            code: 'NO_ACTIVE_SESSION'
          });
        }
        if (tokenError.message.includes('Erreur de session')) {
          return res.status(500).json({
            error: tokenError.message,
            code: 'SESSION_ERROR'
          });
        }
      }
    }

    // 14. Build response
    const response = {
      answer,
      ...(isScheduled ? {} : { conversationId: finalConversationId }),
      userMessage: savedUserMessage,
      pdfFiles: referencedPDFFiles,
      imageFiles: referencedImageFiles,
      meta: {
        period: data.period.label,
        usedEntries: data.totals.entries,
        breakdown: {
          users: data.totals.uniqueUsers,
          forms: data.totals.uniqueForms,
          dateRange: {
            start: data.period.start.toISOString(),
            end: data.period.end.toISOString()
          }
        },
        tokensUsed,
        userTokensCharged: finalUserTokens,
        remainingTokens: packageLimit === -1 ? -1 : Math.max(0, (packageLimit + updatedPayAsYouGoTokens) - updatedTokensUsed),
        model: 'gpt-4.1',
        responseFormat: responseFormat || 'text',
        selectedFormats: selectedResponseFormats || [],
        tokenDebug: {
          systemPromptLength: systemPrompt.length,
          userPromptLength: userPromptForAI.length,
          totalPromptLength: systemPrompt.length + userPromptForAI.length,
          estimatedTokens: estimatedTokens,
          actualTokens: tokensUsed,
          responseLength: answer.length
        },
        conversationContext: {
          conversationId: finalConversationId,
          messageSequence: conversationContext?.messageCount || 2,
          previousAnalysis: conversationContext?.context?.lastAnalysisType || null
        }
      }
    };

    return res.status(200).json(response);

  } catch (err) {
    const message = err instanceof Error ? err.message : 
                   typeof err === 'string' ? err : 
                   JSON.stringify(err);
    
    logger.error('ERROR', err, '/api/ai/ask');
    logger.error('Error message', { message }, '/api/ai/ask');
    if (err instanceof Error) {
      logger.error('Error details', { stack: err.stack, name: err.name }, '/api/ai/ask');
    }
    
    if (err instanceof Error) {
      if (err.message.includes('id-token-expired')) {
        return res.status(401).json({ error: 'Token expiré, veuillez vous reconnecter' });
      }
      
      if (err.message.includes('argument-error')) {
        return res.status(401).json({ error: 'Token invalide' });
      }
    }

    return res.status(500).json({ 
      error: 'Erreur interne du serveur',
      details: process.env.NODE_ENV === 'development' ? message : undefined
    });
  }
}



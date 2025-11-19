/**
 * Request Validator for AI Requests
 * Validates request body and parameters
 */

import { logger } from '../lib/logger.js';
import { detectPeriodFromQuestion } from './periodDetector.js';

/**
 * Validate and parse request body
 */
export function validateRequest(req) {
  logger.debug('Parsing request body', null, '/api/ai/requestValidator');
  logger.debug('Request body keys', { keys: req.body ? Object.keys(req.body) : 'no body' }, '/api/ai/requestValidator');
  
  const { question, filters, selectedFormats, responseFormat, selectedResponseFormats, selectedFormIds } = req.body;
  
  logger.debug('Parsed question', { preview: question ? question.substring(0, 100) : 'missing' }, '/api/ai/requestValidator');
  
  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    logger.error('Invalid question', null, '/api/ai/requestValidator');
    throw new Error('INVALID_QUESTION');
  }

  // Detect period from question if not provided
  let finalPeriod = filters?.period || 'all';
  if (!filters?.period || filters.period === 'all') {
    const detectedPeriod = detectPeriodFromQuestion(question);
    if (detectedPeriod) {
      finalPeriod = detectedPeriod;
      logger.debug('Period detected from question', { period: detectedPeriod }, '/api/ai/requestValidator');
    }
  }

  // Separate selectedFormats (response formats) from selectedFormIds (form IDs)
  let finalSelectedFormIds = selectedFormIds || [];
  if (!selectedFormIds && selectedFormats && selectedFormats.length > 0) {
    // Check if these are form IDs (UUID format) or response formats
    const formatKeywords = ['table', 'stats', 'pdf', 'text', 'rapport'];
    const areFormIds = selectedFormats.every(id => 
      typeof id === 'string' && id.length > 10 && !formatKeywords.includes(id.toLowerCase())
    );
    if (areFormIds) {
      // These are probably form IDs
      finalSelectedFormIds = selectedFormats;
    }
  }

  return {
    question,
    filters: {
      ...filters,
      period: finalPeriod
    },
    responseFormat: responseFormat || 'text',
    selectedResponseFormats: selectedResponseFormats || [],
    selectedFormIds: finalSelectedFormIds,
    isScheduled: req.body.isScheduled === true,
    conversationId: req.body.conversationId,
    debug: req.body.debug === true || process.env.ENABLE_ARCHA_DEBUG === 'true'
  };
}

/**
 * Get error response for validation errors
 */
export function getValidationErrorResponse(error) {
  const errorMessages = {
    'INVALID_QUESTION': { status: 400, error: 'Question manquante ou invalide', code: 'INVALID_QUESTION' }
  };
  
  return errorMessages[error] || { status: 400, error: 'Erreur de validation', code: 'VALIDATION_ERROR' };
}


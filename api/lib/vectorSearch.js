/**
 * Vector Search Service
 * Handles semantic search in Qdrant vector database
 */

import { qdrantRequest, COLLECTION_NAME } from './vectorDb.js';
import { generateEmbedding } from './embeddings.js';
import { logger } from './logger.js';

// Import adminDb - used for enriching user metadata (names/emails) in search results
// If Firebase Admin fails to initialize, adminDb will be undefined and enrichment will be skipped
import { adminDb } from './firebaseAdmin.js';
import { getDirectorActiveUniversMeta } from './activeUniversHelper.js';

/**
 * Build filter for Qdrant search based on metadata
 * @param {boolean} debug - If true, logs detailed filter information
 */
function buildFilter(agencyId, activeUniversId = null, formId = null, userId = null, period = null, selectedFormIds = null, debug = false) {
  const must = [];

  // Always filter by agencyId (required for security)
  if (agencyId) {
    must.push({
      key: 'agencyId',
      match: { value: agencyId },
    });
  }

  // Filter by active Univers ID (if provided)
  if (activeUniversId) {
    must.push({
      key: 'universId',
      match: { value: activeUniversId },
    });
  }

  // Optional filters
  // If multiple form IDs provided, use 'match' with 'any' for OR logic
  if (selectedFormIds && Array.isArray(selectedFormIds) && selectedFormIds.length > 1) {
    must.push({
      key: 'formId',
      match: { any: selectedFormIds },
    });
  } else if (formId) {
    // Single form ID filter
    must.push({
      key: 'formId',
      match: { value: formId },
    });
  }

  if (userId) {
    must.push({
      key: 'userId',
      match: { value: userId },
    });
  }

  // Date range filter (if period provided)
  // RE-ENABLED: Date filter is now active after fixing date formats in Qdrant
  if (period && period.start && period.end) {
    must.push({
      key: 'submittedAt',
      range: {
        gte: period.start.toISOString(),
        lte: period.end.toISOString(),
      },
    });
  }

  // DEBUG MODE: Log filter details with full JSON
  if (debug) {
    const filterObject = must.length > 0 ? { must } : null;
    logger.debug('Qdrant Filter Built', {
      agencyId,
      activeUniversId: activeUniversId || '(not set)',
      formId: formId || '(not set)',
      selectedFormIds: selectedFormIds && selectedFormIds.length > 0 ? selectedFormIds : '(not set)',
      userId: userId || '(not set)',
      period: period ? {
        start: period.start.toISOString(),
        end: period.end.toISOString()
      } : '(not set)',
      filterObject: filterObject ? JSON.stringify(filterObject, null, 2) : null,
      filterConditions: must.map((condition, index) => ({
        index: index + 1,
        condition: JSON.stringify(condition, null, 2)
      }))
    });
  }

  return must.length > 0 ? { must } : null;
}

/**
 * Get active Univers ID for a director/agency
 */
async function getActiveUniversId(directorId, agencyId) {
  if (!directorId) {
    return null;
  }

  try {
    const activeMeta = await getDirectorActiveUniversMeta(directorId);
    if (activeMeta?.activeUniversId) {
      if (agencyId && activeMeta.agencyId && activeMeta.agencyId !== agencyId) {
        logger.warn('Active Univers agency mismatch detected', {
          directorId,
          requestedAgencyId: agencyId,
          activeAgencyId: activeMeta.agencyId
        }, 'vectorSearch.js');
      }

      logger.info('Active Univers found for director', { directorId, activeUniversId: activeMeta.activeUniversId, source: activeMeta.source }, 'vectorSearch.js');
      return activeMeta.activeUniversId;
    }

    logger.warn('No active Univers found for director', { directorId }, 'vectorSearch.js');
    return null;
  } catch (error) {
    logger.error('Error retrieving active Univers', error, 'vectorSearch.js');
    return null; // Continue without Univers filter if error
  }
}

/**
 * Search for relevant chunks using semantic search
 */
export async function searchVectors(
  queryText,
  options = {},
  collectionName = COLLECTION_NAME
) {
  const {
    agencyId,
    directorId = null, // Director ID to get active Univers
    activeUniversId = null, // Can be provided directly, or will be fetched if directorId provided
    formId = null,
    userId = null,
    period = null,
    selectedFormIds = null, // Multiple form IDs for filtering
    limit = 25, // Increased default limit
    scoreThreshold = 0.3, // Reduced default threshold
    debug = false, // DEBUG MODE: Enable detailed logging
  } = options;

  if (!queryText || queryText.trim().length === 0) {
    throw new Error('Query text cannot be empty');
  }

  if (!agencyId) {
    throw new Error('agencyId is required for search');
  }

  try {
    // Get active Univers ID if directorId provided and activeUniversId not provided
    let finalActiveUniversId = activeUniversId;
    if (directorId && !finalActiveUniversId) {
      finalActiveUniversId = await getActiveUniversId(directorId, agencyId);
      
      // DEBUG MODE: Log active Univers lookup
      if (debug) {
        logger.debug('Active Univers Lookup', {
          directorId,
          agencyId,
          found: finalActiveUniversId || '(not found)'
        });
      }
    }

    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(queryText);

    // Build filter (includes activeUniversId if available)
    const filter = buildFilter(agencyId, finalActiveUniversId, formId, userId, period, selectedFormIds, debug);

    // Build search payload
    const searchPayload = {
      vector: queryEmbedding,
      limit,
      score_threshold: scoreThreshold,
      with_payload: true,
      with_vector: false, // Don't return vectors, just metadata
    };

    if (filter) {
      searchPayload.filter = filter;
    }

    // Perform search
    const response = await qdrantRequest(
      `/collections/${collectionName}/points/search`,
      {
        method: 'POST',
        body: JSON.stringify(searchPayload),
      }
    );

    // Format results
    const results = (response.result || []).map((point, index) => ({
      id: point.id,
      score: point.score,
      text: point.payload?.text || '',
      metadata: {
        formId: point.payload?.formId,
        formTitle: point.payload?.formTitle,
        userId: point.payload?.userId,
        employeeName: point.payload?.employeeName,
        submittedAt: point.payload?.submittedAt,
        entryId: point.payload?.entryId,
        fileName: point.payload?.fileName,
        fileType: point.payload?.fileType,
        fileTypeLabel: point.payload?.fileTypeLabel,
        type: point.payload?.type || 'form_entry',
        chunkIndex: point.payload?.chunkIndex,
        totalChunks: point.payload?.totalChunks,
        universId: point.payload?.universId, // DEBUG: Include universId in metadata
      },
      rank: index + 1,
    }));

    logger.debug('Found relevant chunks', { count: results.length, queryPreview: queryText.substring(0, 50) }, 'vectorSearch.js');

    // DEBUG MODE: Log detailed results
    if (debug) {
      const uniqueFormIds = [...new Set(results.map(r => r.metadata.formId).filter(Boolean))];
      const uniqueUniversIds = [...new Set(results.map(r => r.metadata.universId).filter(Boolean))];
      const uniqueUserIds = [...new Set(results.map(r => r.metadata.userId).filter(Boolean))];
      
      logger.debug('Vector Search Results', {
        query: queryText.substring(0, 100),
        totalResults: results.length,
        searchParams: {
          limit,
          scoreThreshold,
          agencyId,
          activeUniversId: finalActiveUniversId || '(not set)',
          formId: formId || '(not set)',
          selectedFormIds: selectedFormIds && selectedFormIds.length > 0 ? selectedFormIds : '(not set)',
          userId: userId || '(not set)',
          period: period ? {
            start: period.start.toISOString(),
            end: period.end.toISOString()
          } : '(not set)'
        },
        resultsSummary: {
          uniqueFormIds: uniqueFormIds.length > 0 ? uniqueFormIds : '(none)',
          uniqueUniversIds: uniqueUniversIds.length > 0 ? uniqueUniversIds : '(none)',
          uniqueUserIds: uniqueUserIds.length > 0 ? uniqueUserIds : '(none)',
          averageScore: results.length > 0 ? (results.reduce((sum, r) => sum + r.score, 0) / results.length).toFixed(4) : 0,
          minScore: results.length > 0 ? Math.min(...results.map(r => r.score)).toFixed(4) : 0,
          maxScore: results.length > 0 ? Math.max(...results.map(r => r.score)).toFixed(4) : 0
        },
        results: results.map(r => ({
          id: r.id,
          score: r.score.toFixed(4),
          formTitle: r.metadata.formTitle,
          formId: r.metadata.formId,
          universId: r.metadata.universId || '(not set)',
          employeeName: r.metadata.employeeName,
          submittedAt: r.metadata.submittedAt,
          entryId: r.metadata.entryId,
          textPreview: r.text.substring(0, 100) + '...'
        }))
      });
    }

    return results;
  } catch (error) {
    logger.error('Vector search failed', error, 'vectorSearch.js');
    throw error;
  }
}

/**
 * Enrich metadata with user information (name, email) from Firebase
 */
async function enrichUserMetadata(results) {
  logger.debug('enrichUserMetadata: Starting enrichment', { resultsCount: results.length }, 'vectorSearch.js');
  
  // Collect unique user IDs
  const userIds = [...new Set(results.map(r => r.metadata?.userId).filter(Boolean))];
  logger.debug('enrichUserMetadata: Unique user IDs found', { count: userIds.length, userIds }, 'vectorSearch.js');
  
  if (userIds.length === 0) {
    logger.debug('enrichUserMetadata: No user IDs found, returning original results', null, 'vectorSearch.js');
    return results;
  }

  // Check adminDb availability
  if (!adminDb) {
    logger.error('enrichUserMetadata: adminDb is not available', null, 'vectorSearch.js');
    return results;
  }
  logger.debug('enrichUserMetadata: adminDb is available', null, 'vectorSearch.js');

  // Fetch user data from Firebase in batch
  const usersMap = new Map();
  try {
    logger.debug('enrichUserMetadata: Starting Firebase queries', { userCount: userIds.length }, 'vectorSearch.js');
    const userPromises = userIds.map(async (userId) => {
      try {
        logger.debug('enrichUserMetadata: Fetching user', { userId }, 'vectorSearch.js');
        const userDoc = await adminDb.collection('users').doc(userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          logger.debug('enrichUserMetadata: User found', { userId, name: userData?.name, email: userData?.email }, 'vectorSearch.js');
          return {
            userId,
            name: userData?.name || null,
            email: userData?.email || null,
          };
        }
        logger.debug('enrichUserMetadata: User not found', { userId }, 'vectorSearch.js');
        return { userId, name: null, email: null };
      } catch (error) {
        logger.error(`enrichUserMetadata: Error fetching user ${userId}`, error, 'vectorSearch.js');
        return { userId, name: null, email: null };
      }
    });

    const users = await Promise.all(userPromises);
    logger.debug('enrichUserMetadata: Firebase queries completed, processing results', null, 'vectorSearch.js');
    users.forEach(user => {
      if (user && (user.name || user.email)) {
        usersMap.set(user.userId, user);
      }
    });
    logger.debug('enrichUserMetadata: Users map size', { size: usersMap.size }, 'vectorSearch.js');
  } catch (error) {
    logger.error('enrichUserMetadata: Fatal error in enrichment process', error, 'vectorSearch.js');
    // Return original results if enrichment fails
    return results;
  }

  // Enrich results with user information
  logger.debug('enrichUserMetadata: Enriching results with user data', { resultsCount: results.length }, 'vectorSearch.js');
  try {
    const enriched = results.map((result, index) => {
      if (!result || !result.metadata) {
        logger.warn(`enrichUserMetadata: Result ${index} has no metadata`, null, 'vectorSearch.js');
        return result;
      }
      
      const userId = result.metadata.userId;
      const user = userId ? usersMap.get(userId) : null;
      const employeeName = result.metadata.employeeName;

      // If employeeName is an ID or missing, replace with name/email
      let displayName = employeeName;
      if (user) {
        if (!employeeName || employeeName.startsWith('Utilisateur ') || employeeName === userId) {
          // Use name if available, otherwise email, otherwise keep original
          displayName = user.name || user.email || employeeName;
          logger.debug('enrichUserMetadata: Replaced employeeName', { old: employeeName, new: displayName, userId }, 'vectorSearch.js');
        }
      }

      // Update metadata
      return {
        ...result,
        metadata: {
          ...result.metadata,
          employeeName: displayName,
          userEmail: user?.email || null,
          userName: user?.name || null,
        },
      };
    });
    logger.debug('enrichUserMetadata: Enrichment completed', { enrichedCount: enriched.length }, 'vectorSearch.js');
    return enriched;
  } catch (error) {
    logger.error('enrichUserMetadata: Error in map function', error, 'vectorSearch.js');
    return results;
  }
}

/**
 * Search and format results for AI prompt
 * Automatically gets active Univers if directorId is provided
 */
export async function searchAndFormatForAI(
  queryText,
  options = {},
  collectionName = COLLECTION_NAME
) {
  // Ensure directorId is passed to searchVectors for active Univers lookup
  // DEBUG MODE: Pass debug flag through
  const results = await searchVectors(queryText, options, collectionName);

  if (results.length === 0) {
    return {
      hasResults: false,
      formattedText: 'Aucune donnée pertinente trouvée pour cette question.',
      chunks: [],
      citations: [],
    };
  }

  // Enrich metadata with user information (name, email) from Firebase
  let enrichedResults = results;
  
  // Check if adminDb is available before attempting enrichment
  if (!adminDb) {
    logger.warn('searchAndFormatForAI: adminDb not available, skipping enrichment', null, 'vectorSearch.js');
    enrichedResults = results;
  } else {
    try {
      enrichedResults = await enrichUserMetadata(results);
      logger.debug('searchAndFormatForAI: Enrichment completed successfully', null, 'vectorSearch.js');
    } catch (error) {
      logger.error('searchAndFormatForAI: Error enriching user metadata, using original results', error, 'vectorSearch.js');
      // Continue with original results if enrichment fails
      enrichedResults = results;
    }
  }

  // Group by entry/document to avoid duplicates
  const uniqueEntries = new Map();
  const citations = [];

  enrichedResults.forEach((result) => {
    const entryId = result.metadata.entryId;
    const fileName = result.metadata.fileName;

    // Create citation key with enriched user info
    let citationKey = '';
    if (fileName) {
      citationKey = `${result.metadata.fileTypeLabel || 'Document'}: ${fileName}`;
      if (result.metadata.employeeName) {
        citationKey += ` (${result.metadata.employeeName})`;
      }
      if (result.metadata.submittedAt) {
        const date = new Date(result.metadata.submittedAt);
        citationKey += ` - ${date.toLocaleDateString('fr-FR')}`;
      }
    } else {
      citationKey = `Formulaire: ${result.metadata.formTitle || 'Formulaire'}`;
      if (result.metadata.employeeName) {
        citationKey += ` (${result.metadata.employeeName})`;
      }
      if (result.metadata.submittedAt) {
        const date = new Date(result.metadata.submittedAt);
        citationKey += ` - ${date.toLocaleDateString('fr-FR')}`;
      }
    }

    if (!citations.includes(citationKey)) {
      citations.push(citationKey);
    }

    // Store unique entry
    if (!uniqueEntries.has(entryId)) {
      uniqueEntries.set(entryId, {
        entryId,
        formTitle: result.metadata.formTitle,
        employeeName: result.metadata.employeeName,
        submittedAt: result.metadata.submittedAt,
        fileName: result.metadata.fileName,
        fileTypeLabel: result.metadata.fileTypeLabel,
        userId: result.metadata.userId, // Store userId for text cleaning
        chunks: [],
      });
    }

    uniqueEntries.get(entryId).chunks.push({
      text: result.text,
      score: result.score,
      chunkIndex: result.metadata.chunkIndex,
      userId: result.metadata.userId, // Store userId for text cleaning
      displayName: result.metadata.employeeName, // Store display name for text cleaning
    });
  });

  // Format text for AI prompt
  const formattedParts = [];

  uniqueEntries.forEach((entry, entryId) => {
    // Add header
    if (entry.fileName) {
      formattedParts.push(`\n📄 ${entry.fileTypeLabel || 'Document'}: ${entry.fileName}`);
    } else {
      formattedParts.push(`\n📋 Formulaire: ${entry.formTitle}`);
    }

    if (entry.employeeName) {
      formattedParts.push(`   Employé: ${entry.employeeName}`);
    }

    if (entry.submittedAt) {
      const date = new Date(entry.submittedAt);
      formattedParts.push(`   Date: ${date.toLocaleDateString('fr-FR')}`);
    }

    // Add chunks (sorted by score, highest first)
    // Clean text to replace user IDs with display names
    entry.chunks
      .sort((a, b) => b.score - a.score)
      .forEach((chunk) => {
        let cleanedText = chunk.text;
        
        // Replace "Utilisateur {userId}" patterns with display name if available
        if (chunk.userId && chunk.displayName) {
          const userId = chunk.userId;
          const displayName = chunk.displayName;
          // Replace patterns like "Utilisateur NmeqMvHwQLZvJRU4oDs5Skz0Q0Q2" with display name
          const pattern = new RegExp(`Utilisateur\\s+${userId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi');
          cleanedText = cleanedText.replace(pattern, displayName);
        }
        
        formattedParts.push(`\n   ${cleanedText}`);
      });
  });

  return {
    hasResults: true,
    formattedText: formattedParts.join('\n'),
    chunks: results,
    citations,
    uniqueEntriesCount: uniqueEntries.size,
  };
}


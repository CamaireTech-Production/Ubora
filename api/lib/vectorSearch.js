/**
 * Vector Search Service
 * Handles semantic search in Qdrant vector database
 */

import { qdrantRequest, COLLECTION_NAME } from './vectorDb.js';
import { generateEmbedding } from './embeddings.js';
import { adminDb } from './firebaseAdmin.js';

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
    console.log('🔍 [DEBUG] Qdrant Filter Built:', {
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
    const activeUniversDoc = await adminDb.collection('activeUnivers').doc(directorId).get();
    if (activeUniversDoc.exists) {
      const activeUniversData = activeUniversDoc.data();
      const activeUniversId = activeUniversData.activeUniversId;
      console.log(`✅ Active Univers found for director ${directorId}: ${activeUniversId}`);
      return activeUniversId;
    } else {
      console.log(`⚠️ No active Univers found for director: ${directorId}`);
      return null;
    }
  } catch (error) {
    console.error('❌ Error retrieving active Univers:', error);
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
        console.log('🔍 [DEBUG] Active Univers Lookup:', {
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

    console.log(`🔍 Found ${results.length} relevant chunks for query: "${queryText.substring(0, 50)}..."`);

    // DEBUG MODE: Log detailed results
    if (debug) {
      const uniqueFormIds = [...new Set(results.map(r => r.metadata.formId).filter(Boolean))];
      const uniqueUniversIds = [...new Set(results.map(r => r.metadata.universId).filter(Boolean))];
      const uniqueUserIds = [...new Set(results.map(r => r.metadata.userId).filter(Boolean))];
      
      console.log('🔍 [DEBUG] Vector Search Results:', {
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
    console.error('❌ Vector search failed:', error);
    throw error;
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

  // Group by entry/document to avoid duplicates
  const uniqueEntries = new Map();
  const citations = [];

  results.forEach((result) => {
    const entryId = result.metadata.entryId;
    const fileName = result.metadata.fileName;

    // Create citation key
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
        chunks: [],
      });
    }

    uniqueEntries.get(entryId).chunks.push({
      text: result.text,
      score: result.score,
      chunkIndex: result.metadata.chunkIndex,
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
    entry.chunks
      .sort((a, b) => b.score - a.score)
      .forEach((chunk) => {
        formattedParts.push(`\n   ${chunk.text}`);
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


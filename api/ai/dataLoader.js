/**
 * Data Loader Module
 * Extracted from ask.js for better code organization
 * 
 * Functions:
 * - loadAndAggregateData: Loads and aggregates form entries from Firestore
 * - formatRawWithOpenAI: Formats raw extracted text using OpenAI
 */

import { adminDb } from '../lib/firebaseAdmin.js';
import { logger } from '../lib/logger.js';
import OpenAI from 'openai';
import { getPeriodDates } from './periodDetector.js';

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
 * Format raw extracted text using OpenAI
 * @param {string} rawText - Raw extracted text from PDF/image
 * @returns {Promise<string>} - Formatted markdown text
 */
async function formatRawWithOpenAI(rawText) {
  try {
    logger.debug('Formatting raw text with OpenAI', null, 'dataLoader.js');
    
    const formatResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: "user",
          content: `Please format the following extracted PDF text into well-structured markdown format. Pay special attention to:

1. **Tables**: Convert any tabular data to proper markdown table format with headers and rows
2. **Lists**: Convert numbered and bulleted lists to markdown format
3. **Headers**: Identify and format section headers with appropriate markdown headers (# ## ###)
4. **Structure**: Preserve the document structure and hierarchy
5. **Complex layouts**: Handle multi-column layouts, sidebars, and complex formatting
6. **Text formatting**: Preserve bold, italic, and other text formatting as markdown

Return only the formatted text in markdown, without any additional commentary or explanations.

Extracted text:
${rawText}`
        }
      ],
      max_tokens: 6000,
      temperature: 0.1
    });
    
    const formattedText = formatResponse.choices[0]?.message?.content || '';
    logger.debug('Raw text formatted successfully', null, 'dataLoader.js');
    
    return formattedText;
  } catch (error) {
    logger.error('Error formatting raw text with OpenAI', error, 'dataLoader.js');
    throw error;
  }
}

/**
 * Load and aggregate form entries data from Firestore
 * @param {string} agencyId - Agency ID
 * @param {string} period - Period identifier
 * @param {string|null} formId - Optional form ID filter
 * @param {string|null} userId - Optional user ID filter
 * @param {string[]|null} selectedFormats - Optional selected formats
 * @param {string|null} directorId - Director ID for Univers filtering
 * @param {string|null} userRole - User role
 * @returns {Promise<Object>} - Aggregated data with entries, stats, and metadata
 */
async function loadAndAggregateData(
  agencyId,
  period,
  formId,
  userId,
  selectedFormats,
  directorId = null,
  userRole = null
) {
  const { start, end, label } = getPeriodDates(period);

  // Récupérer l'Univers actif si c'est un directeur
  let activeUniversId = null;
  if (userRole === 'directeur' && directorId) {
    try {
      const activeUniversDoc = await adminDb.collection('activeUnivers').doc(directorId).get();
      if (activeUniversDoc.exists) {
        const activeUniversData = activeUniversDoc.data();
        activeUniversId = activeUniversData.activeUniversId;
        logger.info('Univers actif trouvé pour Chat Archa', { activeUniversId }, 'dataLoader.js');
      } else {
        logger.warn('Aucun Univers actif trouvé pour le directeur', { directorId }, 'dataLoader.js');
      }
    } catch (error) {
      logger.error('Erreur lors de la récupération de l\'Univers actif', error, 'dataLoader.js');
      // Continue sans filtrage par Univers si erreur
    }
  }

  // Récupérer les Forms du Univers actif si disponible
  let activeFormIds = new Set();
  if (activeUniversId) {
    try {
      // Query optimized with existing index: agencyId + universId + createdAt DESC
      // Note: Admin SDK doesn't support select(), but we only need IDs for filtering
      const formsSnapshot = await adminDb
        .collection('forms')
        .where('agencyId', '==', agencyId)
        .where('universId', '==', activeUniversId)
        .orderBy('createdAt', 'desc') // Use existing index for better performance
        .get();
      
      formsSnapshot.docs.forEach(doc => {
        activeFormIds.add(doc.id);
      });
      
      logger.info('Forms du Univers actif trouvés pour Chat Archa', { count: activeFormIds.size }, 'dataLoader.js');
    } catch (error) {
      logger.error('Erreur lors de la récupération des Forms du Univers actif', error, 'dataLoader.js');
      // Continue sans filtrage par Univers si erreur
    }
  }

  // Requête de base pour récupérer TOUTES les données de l'agence
  // Optimized with existing index: agencyId + submittedAt DESC
  // On récupère par agence puis on filtre/tri en mémoire
  // Use pagination for large datasets to avoid memory issues
  const BATCH_SIZE = 500; // Process in batches to optimize memory usage
  let baseSnapshot = null;
  let allDocs = [];
  let lastDoc = null;
  let hasMore = true;
  
  // Fetch entries in batches using pagination
  while (hasMore && allDocs.length < 2000) {
    let query = adminDb
      .collection('formEntries')
      .where('agencyId', '==', agencyId)
      .orderBy('submittedAt', 'desc') // Use existing index for better performance
      .limit(BATCH_SIZE);
    
    // Add cursor for pagination
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    
    const batchSnapshot = await query.get();
    
    if (batchSnapshot.empty) {
      hasMore = false;
    } else {
      allDocs = allDocs.concat(batchSnapshot.docs);
      lastDoc = batchSnapshot.docs[batchSnapshot.docs.length - 1];
      hasMore = batchSnapshot.docs.length === BATCH_SIZE && allDocs.length < 2000;
      
      logger.debug('Fetched batch of formEntries', { 
        batchSize: batchSnapshot.docs.length, 
        totalFetched: allDocs.length 
      }, 'dataLoader.js');
    }
  }
  
  // Create a mock snapshot-like object for compatibility
  baseSnapshot = {
    docs: allDocs,
    empty: allDocs.length === 0,
    size: allDocs.length
  };
  
  logger.info('Total formEntries fetched with pagination', { 
    totalCount: allDocs.length 
  }, 'dataLoader.js');

  // Ensure attachments are formatted when needed (on-demand formatting)
  const ensureFormattedAttachmentsForDoc = async (doc) => {
    const data = doc.data() || {};
    const attachments = Array.isArray(data.fileAttachments) ? data.fileAttachments : [];
    if (attachments.length === 0) return data;

    const updated = [];
    let changed = false;
    for (const att of attachments) {
      if (
        att &&
        (att.fileType === 'application/pdf' || (att.fileType && att.fileType.startsWith('image/')))
      ) {
        const hasFormatted = typeof att.extractedText === 'string' && att.extractedText.trim().length > 0;
        const hasRaw = typeof att.rawExtractedText === 'string' && att.rawExtractedText.trim().length > 0;
        if (!hasFormatted && hasRaw) {
          // Format raw text synchronously before analysis
          try {
            logger.debug('Formatting raw text for AI analysis', { fileName: att.fileName }, 'dataLoader.js');
            const formattedText = await formatRawWithOpenAI(att.rawExtractedText);
            logger.debug('Successfully formatted text for AI analysis', { fileName: att.fileName }, 'dataLoader.js');
            updated.push({
              ...att,
              extractedText: formattedText,
              rawExtractedText: att.rawExtractedText,
            });
            changed = true;
          } catch (e) {
            logger.error('Failed to format raw text for AI analysis', e, 'dataLoader.js');
            // Continue with raw text - better than no text at all
            updated.push({
              ...att,
              rawExtractedText: att.rawExtractedText,
              extractedText: att.rawExtractedText // Use raw text as fallback
            });
            changed = true;
          }
          continue;
        }
      }
      updated.push(att);
    }

    if (changed) {
      try {
        await adminDb.collection('formEntries').doc(doc.id).update({ fileAttachments: updated });
        data.fileAttachments = updated;
      } catch (e) {
        // Non-blocking if update fails; continue with in-memory update
        data.fileAttachments = updated;
      }
    }

    return data;
  };

  // Transformer, filtrer par période et filtres optionnels
  let entries = await Promise.all(baseSnapshot.docs.map(async (doc) => {
    const ensured = await ensureFormattedAttachmentsForDoc(doc);
    const data = doc.data();
    const entry = {
      id: doc.id,
      formId: ensured.formId || data.formId || '',
      userId: ensured.userId || data.userId || '',
      agencyId: ensured.agencyId || data.agencyId || '',
      submittedAt: ensured.submittedAt || data.submittedAt || new Date(),
      answers: ensured.answers || data.answers || {},
      fileAttachments: ensured.fileAttachments || data.fileAttachments || [] // Include fileAttachments, ensuring formatted when possible
    };
    
    
    return entry;
  }));

  entries = entries.filter(e => {
    const submittedDate = safeToDate(e.submittedAt);
    const inDateRange = submittedDate ? submittedDate >= start && submittedDate <= end : false;
    const matchForm = !formId || e.formId === formId;
    const matchSelectedForms = !selectedFormats || selectedFormats.length === 0 || selectedFormats.includes(e.formId);
    const matchUser = !userId || e.userId === userId;
    // Filtrer par Univers actif si disponible (seulement pour directeurs)
    const matchActiveUnivers = activeUniversId === null || activeFormIds.size === 0 || activeFormIds.has(e.formId);
    return inDateRange && matchForm && matchSelectedForms && matchUser && matchActiveUnivers;
  });

  // Trier par date desc (TOUTES les données sélectionnées)
  entries.sort((a, b) => {
    const dateA = safeToDate(a.submittedAt);
    const dateB = safeToDate(b.submittedAt);
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateB.getTime() - dateA.getTime();
  });
  // No artificial limits - send ALL selected data to AI

  // Charger les métadonnées (formulaires et utilisateurs)
  // Filtrer les Forms par Univers actif si disponible
  // Use select() to only fetch required fields for better performance
  let formsQuery = adminDb.collection('forms').where('agencyId', '==', agencyId);
  if (activeUniversId) {
    formsQuery = formsQuery.where('universId', '==', activeUniversId);
  }
  
  // Optimize queries with existing indexes and orderBy
  // Forms query: uses index agencyId + universId + createdAt DESC (if universId provided)
  // Users query: uses index agencyId + role + name
  // Note: Admin SDK doesn't support select(), but we extract only needed fields in processing
  const [formsSnapshot, usersSnapshot] = await Promise.all([
    activeUniversId 
      ? formsQuery.orderBy('createdAt', 'desc').get() // Use index when universId is provided
      : formsQuery.orderBy('createdAt', 'desc').get(), // Use index agencyId + createdAt DESC
    adminDb.collection('users')
      .where('agencyId', '==', agencyId)
      .where('role', '==', 'employe')
      .orderBy('name', 'asc') // Use existing index: agencyId + role + name
      .get()
  ]);

  // Construire des maps pour les données
  // Extract only needed fields to optimize memory usage
  const formsById = new Map();
  formsSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    formsById.set(doc.id, {
      id: doc.id,
      title: data.title || '',
      description: data.description || '',
      createdBy: data.createdBy || '',
      agencyId: data.agencyId || '',
      assignedTo: data.assignedTo || [],
      fields: data.fields || [],
      createdAt: data.createdAt || null
    });
  });

  const usersById = new Map();
  usersSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    usersById.set(doc.id, {
      id: doc.id,
      name: data.name || '',
      email: data.email || '',
      role: data.role || 'employe',
      agencyId: data.agencyId || '',
      createdAt: data.createdAt || null,
      updatedAt: data.updatedAt || null
    });
  });
  
  logger.debug('Metadata loaded', {
    formsCount: formsById.size,
    usersCount: usersById.size
  }, 'dataLoader.js');

  // Agrégations avec fallbacks sûrs
  const totalEntries = entries.length;
  const uniqueUsers = [...new Set(entries.map(e => e.userId))].length;
  const uniqueForms = [...new Set(entries.map(e => e.formId))].length;

  // Répartition par employé avec fallbacks
  const userStats = {};
  entries.forEach(entry => {
    if (!userStats[entry.userId]) {
      const user = usersById.get(entry.userId);
      const displayUser = user && user.name ? user.name : `Utilisateur ${entry.userId}`;
      userStats[entry.userId] = {
        name: displayUser,
        count: 0
      };
    }
    userStats[entry.userId].count++;
  });

  // Répartition par formulaire avec fallbacks
  const formStats = {};
  entries.forEach(entry => {
    if (!formStats[entry.formId]) {
      const form = formsById.get(entry.formId);
      const displayForm = form && form.title ? form.title : `Formulaire ${entry.formId}`;
      formStats[entry.formId] = {
        title: displayForm,
        count: 0
      };
    }
    formStats[entry.formId].count++;
  });

  // Timeline par jour
  const timeline = {};
  entries.forEach(entry => {
    const submittedDate = safeToDate(entry.submittedAt);
    if (submittedDate) {
      const date = submittedDate.toISOString().split('T')[0];
    timeline[date] = (timeline[date] || 0) + 1;
    }
  });

  // Préparer les données détaillées des soumissions pour l'IA (TOUTES les données sélectionnées)
  const limitedEntries = entries; // Send ALL data - no artificial limits
  
  
  const detailedSubmissions = limitedEntries.map(entry => {
    const user = usersById.get(entry.userId);
    const form = formsById.get(entry.formId);
    
    // Créer un mapping des réponses avec les labels des champs ET garder les fieldId pour référence
    const answersWithLabels = {};
    const fieldMapping = {}; // Pour garder la correspondance fieldId -> fieldLabel
    
    if (form && form.fields) {
      Object.entries(entry.answers || {}).forEach(([fieldId, value]) => {
        const field = form.fields.find(f => f.id === fieldId);
        const fieldLabel = field ? field.label : fieldId;
        answersWithLabels[fieldLabel] = value;
        fieldMapping[fieldLabel] = fieldId; // Garder la correspondance
      });
    } else {
      // Fallback si pas de formulaire trouvé
      Object.entries(entry.answers || {}).forEach(([fieldId, value]) => {
        answersWithLabels[fieldId] = value;
        fieldMapping[fieldId] = fieldId;
      });
    }
    
    const submittedDate = safeToDate(entry.submittedAt);
    const result = {
      id: entry.id,
      formTitle: form ? form.title : `Formulaire ${entry.formId}`,
      employeeName: user ? user.name : `Utilisateur ${entry.userId}`,
      employeeEmail: user ? user.email : 'Email non disponible',
      submittedAt: submittedDate ? submittedDate.toISOString() : 'Inconnu',
      submittedDate: submittedDate ? submittedDate.toLocaleDateString('fr-FR') : 'Inconnu',
      submittedTime: submittedDate ? submittedDate.toLocaleTimeString('fr-FR') : 'Inconnu',
      answers: answersWithLabels,
      fieldMapping: fieldMapping, // Include field mapping for proper file reference
      fileAttachments: entry.fileAttachments || [], // Include file attachments
      isToday: submittedDate ? submittedDate.toDateString() === new Date().toDateString() : false,
      isThisWeek: submittedDate ? submittedDate >= start && submittedDate <= end : false
    };
    
    // Log detailed submission creation
    
    return result;
  });

  return {
    period: { start, end, label },
    totals: {
      entries: totalEntries,
      uniqueUsers,
      uniqueForms,
      totalUsers: usersById.size,
      totalForms: formsById.size
    },
    userStats: Object.entries(userStats)
      .map(([id, stats]) => ({ userId: id, ...stats }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5), // Top 5
    formStats: Object.entries(formStats)
      .map(([id, stats]) => ({ formId: id, ...stats }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5), // Top 5
    timeline: Object.entries(timeline)
      .sort()
      .map(([date, count]) => ({ date, count })),
    // Nouvelles données détaillées pour l'IA
    submissions: detailedSubmissions,
    todaySubmissions: detailedSubmissions.filter(s => s.isToday),
    thisWeekSubmissions: detailedSubmissions.filter(s => s.isThisWeek),
    // Include forms and users data for metadata
    formsById: formsById,
    usersById: usersById
  };
  
}

module.exports = {
  loadAndAggregateData,
  formatRawWithOpenAI
};


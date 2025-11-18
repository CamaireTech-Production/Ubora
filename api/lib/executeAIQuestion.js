/**
 * Shared module for executing AI questions
 * Used by both HTTP API endpoint and cron job for scheduled questions
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
const loadedLocalEnv = dotenv.config({ path: path.join(process.cwd(), '.env.local') });
if (!loadedLocalEnv || !loadedLocalEnv.parsed) {
  dotenv.config({ path: path.join(process.cwd(), '.env') });
}

import { adminDb } from '../lib/firebaseAdmin.js';
import OpenAI from 'openai';
import { searchAndFormatForAI } from '../lib/vectorSearch.js';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Re-export helper functions from ask.js (we'll import these)
// For now, we'll duplicate essential helpers to avoid circular dependencies

// Helper to safely convert dates
const safeToDate = (dateValue) => {
  if (!dateValue) return null;
  if (dateValue instanceof Date) return dateValue;
  if (dateValue.toDate && typeof dateValue.toDate === 'function') {
    return dateValue.toDate();
  }
  if (typeof dateValue === 'string' || typeof dateValue === 'number') {
    return new Date(dateValue);
  }
  return null;
};

// Get period dates
function getPeriodDates(period) {
  const now = new Date();
  let start;
  let end = now;
  let label;

  if (!period || period === 'all') {
    start = new Date(0);
    end = now;
    label = 'toutes les données';
  } else if (period === 'today') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    label = "aujourd'hui";
  } else if (period === 'yesterday') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    label = 'hier';
  } else if (period === 'this_week') {
    const dayOfWeek = now.getDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysFromMonday);
    label = 'cette semaine';
  } else if (period === 'last_week') {
    const dayOfWeek = now.getDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const lastMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysFromMonday - 7);
    const lastSunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysFromMonday - 1, 23, 59, 59);
    start = lastMonday;
    end = lastSunday;
    label = 'semaine dernière';
  } else if (period === 'this_month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    label = 'ce mois';
  } else if (period === 'last_month') {
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    start = lastMonth;
    end = lastMonthEnd;
    label = 'mois dernier';
  } else if (period === 'last_7d') {
    start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    label = 'les 7 derniers jours';
  } else if (period === 'last_30d') {
    start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    label = 'les 30 derniers jours';
  } else if (period === 'last_90d') {
    start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    label = 'les 90 derniers jours';
  } else if (period.includes(' - ')) {
    const [startStr, endStr] = period.split(' - ');
    const [startDay, startMonth, startYear] = startStr.split('/').map(Number);
    const [endDay, endMonth, endYear] = endStr.split('/').map(Number);
    start = new Date(startYear, startMonth - 1, startDay);
    end = new Date(endYear, endMonth - 1, endDay, 23, 59, 59);
    label = `du ${startStr} au ${endStr}`;
  } else {
    start = new Date(0);
    end = now;
    label = 'toutes les données';
  }

  return { start, end, label };
}

// Simplified loadAndAggregateData for scheduled questions
async function loadAndAggregateData(agencyId, period, formId, userId, selectedFormats) {
  const { start, end, label } = getPeriodDates(period);

  const baseSnapshot = await adminDb
    .collection('formEntries')
    .where('agencyId', '==', agencyId)
    .limit(2000)
    .get();

  let entries = baseSnapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      formId: data.formId || '',
      userId: data.userId || '',
      agencyId: data.agencyId || '',
      submittedAt: data.submittedAt || new Date(),
      answers: data.answers || {},
      fileAttachments: data.fileAttachments || [],
    };
  });

  entries = entries.filter(e => {
    const submittedDate = safeToDate(e.submittedAt);
    const inDateRange = submittedDate ? submittedDate >= start && submittedDate <= end : false;
    const matchForm = !formId || e.formId === formId;
    const matchSelectedForms = !selectedFormats || selectedFormats.length === 0 || selectedFormats.includes(e.formId);
    const matchUser = !userId || e.userId === userId;
    return inDateRange && matchForm && matchSelectedForms && matchUser;
  });

  entries.sort((a, b) => {
    const dateA = safeToDate(a.submittedAt);
    const dateB = safeToDate(b.submittedAt);
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateB.getTime() - dateA.getTime();
  });

  const [formsSnapshot, usersSnapshot] = await Promise.all([
    adminDb.collection('forms').where('agencyId', '==', agencyId).get(),
    adminDb.collection('users').where('agencyId', '==', agencyId).where('role', '==', 'employe').get()
  ]);

  const formsById = new Map();
  formsSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    formsById.set(doc.id, {
      id: doc.id,
      title: data.title,
      description: data.description,
      createdBy: data.createdBy,
      agencyId: data.agencyId,
      assignedTo: data.assignedTo,
      fields: data.fields,
      createdAt: data.createdAt
    });
  });

  const usersById = new Map();
  usersSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    usersById.set(doc.id, {
      id: doc.id,
      name: data.name,
      email: data.email,
      role: data.role,
      agencyId: data.agencyId,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    });
  });

  const totalEntries = entries.length;
  const uniqueUsers = [...new Set(entries.map(e => e.userId))].length;
  const uniqueForms = [...new Set(entries.map(e => e.formId))].length;

  const userStats = {};
  entries.forEach(entry => {
    if (!userStats[entry.userId]) {
      const user = usersById.get(entry.userId);
      const displayUser = user && user.name ? user.name : `Utilisateur ${entry.userId}`;
      userStats[entry.userId] = { name: displayUser, count: 0 };
    }
    userStats[entry.userId].count++;
  });

  const formStats = {};
  entries.forEach(entry => {
    if (!formStats[entry.formId]) {
      const form = formsById.get(entry.formId);
      const displayForm = form && form.title ? form.title : `Formulaire ${entry.formId}`;
      formStats[entry.formId] = { title: displayForm, count: 0 };
    }
    formStats[entry.formId].count++;
  });

  const detailedSubmissions = entries.map(entry => {
    const user = usersById.get(entry.userId);
    const form = formsById.get(entry.formId);
    
    const answersWithLabels = {};
    if (form && form.fields) {
      Object.entries(entry.answers || {}).forEach(([fieldId, value]) => {
        const field = form.fields.find(f => f.id === fieldId);
        const fieldLabel = field ? field.label : fieldId;
        answersWithLabels[fieldLabel] = value;
      });
    } else {
      Object.entries(entry.answers || {}).forEach(([fieldId, value]) => {
        answersWithLabels[fieldId] = value;
      });
    }
    
    const submittedDate = safeToDate(entry.submittedAt);
    return {
      id: entry.id,
      formTitle: form ? form.title : `Formulaire ${entry.formId}`,
      employeeName: user ? user.name : `Utilisateur ${entry.userId}`,
      submittedAt: submittedDate ? submittedDate.toISOString() : 'Inconnu',
      answers: answersWithLabels,
      fileAttachments: entry.fileAttachments || [],
      isToday: submittedDate ? submittedDate.toDateString() === new Date().toDateString() : false,
      isThisWeek: submittedDate ? submittedDate >= start && submittedDate <= end : false
    };
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
      .slice(0, 5),
    formStats: Object.entries(formStats)
      .map(([id, stats]) => ({ formId: id, ...stats }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    submissions: detailedSubmissions,
    formsById,
    usersById
  };
}

/**
 * Core function to execute an AI question
 * @param {Object} params - Execution parameters
 * @param {string} params.userId - User ID
 * @param {string} params.agencyId - Agency ID
 * @param {string} params.question - Question to ask
 * @param {Object} params.filters - Filter object (period, formId, userId)
 * @param {Array} params.selectedFormats - Selected form IDs
 * @param {string} params.responseFormat - Response format (text, table, stats, pdf)
 * @param {Array} params.selectedResponseFormats - Selected response formats
 * @returns {Promise<Object>} - { answer, tokensUsed, meta }
 */
export async function executeAIQuestion({
  userId,
  agencyId,
  question,
  filters = {},
  selectedFormats = [],
  responseFormat = 'text',
  selectedResponseFormats = [],
  directorId = null, // Director ID for active Univers filtering
  userRole = null,   // User role for context
  debug = false      // DEBUG MODE: Enable detailed logging and dry-run
}) {
  try {
    console.log('🤖 [executeAIQuestion] Starting execution:', { userId, agencyId, question: question.substring(0, 50) });

    // 1. Search for relevant data using vector search (REPLACEMENT FOR loadAndAggregateData)
    const { start, end, label } = getPeriodDates(filters?.period || 'all');

    // DEBUG MODE: Log input parameters
    if (debug) {
      console.log('🔍 [DEBUG] executeAIQuestion Input Parameters:', {
        userId,
        agencyId,
        directorId: directorId || '(not set)',
        question: question.substring(0, 200),
        filters: {
          period: filters?.period || '(not set)',
          formId: filters?.formId || '(not set)',
          userId: filters?.userId || '(not set)'
        },
        selectedFormats: selectedFormats.length > 0 ? selectedFormats : '(not set)',
        periodDates: { start: start.toISOString(), end: end.toISOString(), label }
      });
    }

    console.log('🔍 [executeAIQuestion] Searching vectors for relevant chunks...');
    
    // Handle selectedFormats as form IDs if provided
    const formIdFilter = filters?.formId || (selectedFormats?.length === 1 ? selectedFormats[0] : null);
    const multipleFormIds = selectedFormats && selectedFormats.length > 1 ? selectedFormats : null;
    
    const vectorSearchResults = await searchAndFormatForAI(question, {
      agencyId,
      directorId, // For active Univers filtering
      formId: formIdFilter,
      userId: filters?.userId || null,
      period: { start, end },
      selectedFormIds: multipleFormIds,
      limit: 25, // Increased from 15 to 25 for better results
      scoreThreshold: 0.3, // Reduced from 0.5 to 0.3 for more results
      debug, // Pass debug flag to vector search
    });

    if (!vectorSearchResults.hasResults) {
      console.log('⚠️ [executeAIQuestion] No relevant data found in vector database');
      return {
        answer: 'Désolé, je n\'ai pas trouvé de données pertinentes pour répondre à votre question. Veuillez reformuler votre question ou vérifier que les données ont été synchronisées.',
        tokensUsed: 0,
        meta: {
          period: label,
          usedEntries: 0,
          forms: 0,
          users: 0,
          model: 'gpt-4.1',
          selectedFormat: responseFormat,
          selectedFormats: selectedResponseFormats,
          selectedFormIds: selectedFormats,
          selectedFormTitles: [],
          chunksUsed: 0,
          citations: []
        }
      };
    }

    console.log(`✅ [executeAIQuestion] Found ${vectorSearchResults.chunks.length} relevant chunks`);

    // DEBUG MODE: Log detailed search results
    if (debug) {
      const uniqueFormIds = [...new Set(vectorSearchResults.chunks.map(chunk => chunk.metadata.formId).filter(Boolean))];
      const uniqueUniversIds = [...new Set(vectorSearchResults.chunks.map(chunk => chunk.metadata.universId).filter(Boolean))];
      const uniqueUserIds = [...new Set(vectorSearchResults.chunks.map(chunk => chunk.metadata.userId).filter(Boolean))];
      
      console.log('🔍 [DEBUG] Vector Search Results Summary:', {
        totalChunks: vectorSearchResults.chunks.length,
        uniqueEntries: vectorSearchResults.uniqueEntriesCount,
        uniqueFormIds: uniqueFormIds.length > 0 ? uniqueFormIds : '(none)',
        uniqueUniversIds: uniqueUniversIds.length > 0 ? uniqueUniversIds : '(none)',
        uniqueUserIds: uniqueUserIds.length > 0 ? uniqueUserIds : '(none)',
        citations: vectorSearchResults.citations.length,
        citationsList: vectorSearchResults.citations
      });
    }

    // DEBUG MODE: DRY-RUN - Return debug info without calling OpenAI
    if (debug && process.env.DEBUG_DRY_RUN === 'true') {
      console.log('🔍 [DEBUG] DRY-RUN MODE: Skipping OpenAI call');
      return {
        answer: '[DEBUG DRY-RUN] OpenAI call skipped. Check logs for filter and search results.',
        tokensUsed: 0,
        meta: {
          period: label,
          usedEntries: vectorSearchResults.chunks.length,
          forms: [...new Set(vectorSearchResults.chunks.map(chunk => chunk.metadata.formId).filter(Boolean))].length,
          users: [...new Set(vectorSearchResults.chunks.map(chunk => chunk.metadata.userId).filter(Boolean))].length,
          model: 'gpt-4.1',
          selectedFormat: responseFormat,
          selectedFormats: selectedResponseFormats,
          selectedFormIds: selectedFormats,
          selectedFormTitles: [...new Set(vectorSearchResults.chunks.map(chunk => chunk.metadata.formTitle).filter(Boolean))].slice(0, 5),
          chunksUsed: vectorSearchResults.chunks.length,
          citations: vectorSearchResults.citations,
          debug: {
            filterApplied: {
              agencyId,
              directorId: directorId || null,
              formId: filters?.formId || null,
              userId: filters?.userId || null,
              period: { start: start.toISOString(), end: end.toISOString() }
            },
            chunksFound: vectorSearchResults.chunks.map(chunk => ({
              id: chunk.id,
              score: chunk.score,
              formId: chunk.metadata.formId,
              formTitle: chunk.metadata.formTitle,
              universId: chunk.metadata.universId || null,
              entryId: chunk.metadata.entryId,
              textPreview: chunk.text.substring(0, 150)
            }))
          }
        }
      };
    }

    // Legacy data structure for compatibility (if needed)
    const data = {
      period: { start, end, label },
      totals: {
        entries: vectorSearchResults.uniqueEntriesCount || 0,
        uniqueUsers: [...new Set(vectorSearchResults.chunks.map(chunk => chunk.metadata.userId).filter(Boolean))].length,
        uniqueForms: [...new Set(vectorSearchResults.chunks.map(chunk => chunk.metadata.formId).filter(Boolean))].length,
      },
      submissions: vectorSearchResults.chunks.map(chunk => ({
        formTitle: chunk.metadata.formTitle,
        employeeName: chunk.metadata.employeeName,
        submittedAt: chunk.metadata.submittedAt,
      }))
    };

    // 2. Build prompts with vector search results (MODIFIED)
    const hasPDFContent = vectorSearchResults.chunks.some(chunk =>
      chunk.metadata.fileType === 'application/pdf'
    );
    const hasImageContent = vectorSearchResults.chunks.some(chunk =>
      chunk.metadata.fileType && chunk.metadata.fileType.startsWith('image/')
    );

    // Build system prompt (MODIFIED to be leaner and include citation rules)
    const systemPrompt = `Tu es ARCHA, assistant IA expert en analyse de données d'entreprise.

RÈGLES FONDAMENTALES :
- Réponds UNIQUEMENT en français
- Utilise UNIQUEMENT les données fournies - ne JAMAIS inventer de données
- Si données insuffisantes, dis-le clairement
- Sois clair, concis et actionnable

CONTEXTE MÉTIER :
- Agence : ${agencyId}
- Période d'analyse : ${label}
- Nombre de sources pertinentes trouvées : ${vectorSearchResults.chunks.length}

${hasPDFContent ? `
📄 ANALYSE DE DOCUMENTS PDF :
- Les données contiennent des documents PDF avec du contenu textuel extrait
- OBLIGATOIRE : Analyse le contenu de chaque document en détail
- OBLIGATOIRE : Extrais les informations pertinentes pour répondre à la question
- OBLIGATOIRE : MENTIONNE le nom du fichier quand tu fais référence à son contenu
` : ''}
${hasImageContent ? `
🖼️ ANALYSE D'IMAGES :
- Les données peuvent contenir des images avec du contenu textuel extrait par OCR
- OBLIGATOIRE : Analyse le contenu textuel de chaque image
- OBLIGATOIRE : MENTIONNE le nom du fichier image quand tu fais référence à son contenu
` : ''}

CITATIONS :
- Tu dois toujours citer tes sources par leur nom (formulaire ou fichier), pas par ID
- Exemples de citations correctes :
  * "Selon le formulaire Ventes quotidiennes par Marie..."
  * "Dans le document Rapport_Mensuel.pdf..."
  * "D'après les données du formulaire Suivi_Production par Jean..."`;

    // Build user prompt with vector search results (MODIFIED)
    const userPrompt = `QUESTION : "${question}"

DONNÉES PERTINENTES TROUVÉES (${vectorSearchResults.chunks.length} sources) :
${vectorSearchResults.formattedText}

CITATIONS DISPONIBLES :
${vectorSearchResults.citations.map((citation, index) => `[${index + 1}] ${citation}`).join('\n')}

INSTRUCTIONS :
- Réponds à la question en utilisant UNIQUEMENT les données ci-dessus
- Cite tes sources en utilisant les noms de formulaires ou fichiers (ex: "Selon le formulaire [nom] par [employé]...")
- Si les données ne suffisent pas pour répondre complètement, dis-le clairement
- Sois précis et cite les chiffres exacts trouvés dans les données`;

    // 3. Call OpenAI
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 2000,
      temperature: 0.3,
      top_p: 0.9,
      frequency_penalty: 0.1,
      presence_penalty: 0.1
    });

    const answer = completion.choices?.[0]?.message?.content || 'Désolé, je n\'ai pas pu générer une réponse.';
    const tokensUsed = completion.usage?.total_tokens || 0;

    // 4. Return result (MODIFIED to reflect vector search data)
    const uniqueFormTitles = [...new Set(vectorSearchResults.chunks.map(chunk => chunk.metadata.formTitle).filter(Boolean))];

    return {
      answer,
      tokensUsed,
      meta: {
        period: label,
        usedEntries: vectorSearchResults.chunks.length, // Number of chunks used
        forms: uniqueFormTitles.length,
        users: [...new Set(vectorSearchResults.chunks.map(chunk => chunk.metadata.userId).filter(Boolean))].length,
        model: 'gpt-4.1',
        selectedFormat: responseFormat,
        selectedFormats: selectedResponseFormats,
        selectedFormIds: selectedFormats,
        selectedFormTitles: uniqueFormTitles.slice(0, 5),
        chunksUsed: vectorSearchResults.chunks.length,
        citations: vectorSearchResults.citations
      }
    };
  } catch (error) {
    console.error('❌ [executeAIQuestion] Error:', error);
    throw error;
  }
}


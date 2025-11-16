import dotenv from 'dotenv';
import path from 'path';
const loadedLocalEnv = dotenv.config({ path: path.join(process.cwd(), '.env.local') });
if (!loadedLocalEnv || !loadedLocalEnv.parsed) {
  dotenv.config({ path: path.join(process.cwd(), '.env') });
}

import { adminAuth, adminDb } from '../lib/firebaseAdmin.js';
import admin from 'firebase-admin';
import OpenAI from 'openai';
import { TokenCounter } from '../lib/tokenCounter.js';
import { formatFieldValue } from '../lib/listValueFormatter.js';

// Configuration OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Note: Removed TypeScript types for JavaScript compatibility

// Fonction pour calculer les dates de période
function getPeriodDates(period) {
  const now = new Date();
  let start;
  let end = now;
  let label;

  if (!period || period === 'all') {
    // Par défaut : toutes les données (pas de filtre de date)
    start = new Date(0); // 1970-01-01
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
    // Cette semaine (lundi à aujourd'hui)
    const dayOfWeek = now.getDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysFromMonday);
    label = 'cette semaine';
  } else if (period === 'last_week') {
    // Semaine dernière (lundi à dimanche)
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
    // Mois dernier
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
    // Format personnalisé "dd/mm/yyyy - dd/mm/yyyy"
    const [startStr, endStr] = period.split(' - ');
    const [startDay, startMonth, startYear] = startStr.split('/').map(Number);
    const [endDay, endMonth, endYear] = endStr.split('/').map(Number);
    start = new Date(startYear, startMonth - 1, startDay);
    end = new Date(endYear, endMonth - 1, endDay, 23, 59, 59);
    label = `du ${startStr} au ${endStr}`;
  } else {
    // Par défaut : toutes les données
    start = new Date(0);
    end = now;
    label = 'toutes les données';
  }

  return { start, end, label };
}


// Helper function to safely convert dates
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

// Function to generate conversation summary using OpenAI
async function generateConversationSummary(conversationId, messages) {
  try {
    console.log('🔄 Generating conversation summary for:', conversationId);
    
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
    console.log('✅ Generated conversation summary:', summaryContent.substring(0, 100) + '...');
    
    return summaryContent;
  } catch (error) {
    console.error('❌ Failed to generate conversation summary:', error);
    throw error;
  }
}

// Function to retrieve conversation context (summary + recent messages)
async function getConversationContext(conversationId) {
  try {
    if (!conversationId) return null;
    
    console.log('📥 Retrieving conversation context for:', conversationId);
    
    // Get conversation document
    const conversationDoc = await adminDb.collection('conversations').doc(conversationId).get();
    if (!conversationDoc.exists) {
      console.log('⚠️ Conversation not found:', conversationId);
      return null;
    }
    
    const conversation = conversationDoc.data();
    
    // Get last 10 messages
    const messagesSnapshot = await adminDb
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .orderBy('timestamp', 'desc')
      .limit(10)
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
    
    console.log('✅ Retrieved conversation context:', {
      hasSummary: !!context.summary,
      recentMessagesCount: context.recentMessages.length,
      messageCount: context.messageCount
    });
    
    return context;
  } catch (error) {
    console.error('❌ Failed to retrieve conversation context:', error);
    return null;
  }
}

// Function to format raw text with OpenAI (missing implementation)
async function formatRawWithOpenAI(rawText) {
  try {
    console.log('🔄 Formatting raw text with OpenAI...');
    
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
    console.log('✅ Raw text formatted successfully');
    
    return formattedText;
  } catch (error) {
    console.error('❌ Error formatting raw text with OpenAI:', error);
    throw error;
  }
}

// Fonction pour charger et agréger les données
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
        console.log('✅ Univers actif trouvé pour Chat Archa:', activeUniversId);
      } else {
        console.log('⚠️ Aucun Univers actif trouvé pour le directeur:', directorId);
      }
    } catch (error) {
      console.error('❌ Erreur lors de la récupération de l\'Univers actif:', error);
      // Continue sans filtrage par Univers si erreur
    }
  }

  // Récupérer les Forms du Univers actif si disponible
  let activeFormIds = new Set();
  if (activeUniversId) {
    try {
      const formsSnapshot = await adminDb
        .collection('forms')
        .where('agencyId', '==', agencyId)
        .where('universId', '==', activeUniversId)
        .get();
      
      formsSnapshot.docs.forEach(doc => {
        activeFormIds.add(doc.id);
      });
      
      console.log(`✅ ${activeFormIds.size} Forms du Univers actif trouvés pour Chat Archa`);
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des Forms du Univers actif:', error);
      // Continue sans filtrage par Univers si erreur
    }
  }

  // Requête de base pour récupérer TOUTES les données de l'agence
  // On récupère par agence puis on filtre/tri en mémoire
  const baseSnapshot = await adminDb
    .collection('formEntries')
    .where('agencyId', '==', agencyId)
    .limit(2000) // Increased limit for complete analysis
    .get();

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
            console.log('🔄 Formatting raw text for AI analysis:', att.fileName);
            const formattedText = await formatRawWithOpenAI(att.rawExtractedText);
            console.log('✅ Successfully formatted text for AI analysis:', att.fileName);
            updated.push({
              ...att,
              extractedText: formattedText,
              rawExtractedText: att.rawExtractedText,
            });
            changed = true;
          } catch (e) {
            console.error('❌ Failed to format raw text for AI analysis:', att.fileName, e.message);
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
  let formsQuery = adminDb.collection('forms').where('agencyId', '==', agencyId);
  if (activeUniversId) {
    formsQuery = formsQuery.where('universId', '==', activeUniversId);
  }
  
  const [formsSnapshot, usersSnapshot] = await Promise.all([
    formsQuery.get(),
    adminDb.collection('users').where('agencyId', '==', agencyId).where('role', '==', 'employe').get()
  ]);

  // Construire des maps pour les données
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

export default async function handler(req, res) {
  
  try {
    const startTime = Date.now(); // Track response time
    
    // Headers CORS complets
    const corsOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['*'];
    const origin = req.headers.origin;
    const allowedOrigin = corsOrigins.includes('*') ? '*' : 
                         (origin && corsOrigins.includes(origin)) ? origin : corsOrigins[0];
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400' // 24h cache preflight
    };

    // Ajouter les headers CORS à toutes les réponses
    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    // Gérer les requêtes OPTIONS (preflight CORS)
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Méthode non autorisée' });
    }
    
    // 1. Authentification - support internal server-to-server and Firebase token
    let uid;
    const internalToken = req.headers['x-internal-token'];
    if (internalToken && process.env.INTERNAL_API_KEY && internalToken === process.env.INTERNAL_API_KEY) {
      // Server-to-server call: trust provided userId for execution context
      uid = req.body.userId;
      if (!uid) {
        return res.status(400).json({ error: 'userId requis pour une exécution interne', code: 'MISSING_USER_ID' });
      }
    } else {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Token d\'authentification manquant',
        code: 'MISSING_TOKEN'
      });
    }
    const idToken = authHeader.split('Bearer ')[1];
    try {
        const decodedToken = await adminAuth.verifyIdToken(idToken);
      uid = decodedToken.uid;
    } catch (authError) {
      return res.status(401).json({ 
        error: 'Token invalide ou expiré',
        code: 'INVALID_TOKEN',
        details: authError.message
      });
      }
    }

    // 2. Vérification du profil utilisateur
    let userDoc;
    let userData;
    
    try {
      userDoc = await adminDb.collection('users').doc(uid).get();
    } catch (firestoreError) {
      return res.status(500).json({ 
        error: 'Erreur de connexion à la base de données',
        code: 'FIRESTORE_ERROR',
        details: firestoreError.message
      });
    }
    
    if (!userDoc.exists) {
      return res.status(404).json({ 
        error: 'Profil utilisateur non trouvé',
        code: 'USER_NOT_FOUND'
      });
    }

    userData = userDoc.data();
    if (!userData) {
      return res.status(404).json({ 
        error: 'Données utilisateur non trouvées',
        code: 'USER_DATA_MISSING'
      });
    }
    
    // Check if this is a scheduled question execution
    const isScheduled = req.body.isScheduled === true;
    console.log('🕐 [SCHEDULED CHECK] Is scheduled question:', isScheduled);
    
    // Initialize conversationId and retrieve conversation context early
    let conversationId = req.body.conversationId;
    let conversationContext = null;
    
    // Only retrieve conversation context for regular chat, not scheduled questions
    if (!isScheduled && conversationId) {
      try {
        conversationContext = await getConversationContext(conversationId);
        console.log('📋 Conversation context retrieved:', {
          hasSummary: !!conversationContext?.summary,
          recentMessagesCount: conversationContext?.recentMessages?.length || 0,
          messageCount: conversationContext?.messageCount || 0
        });
      } catch (contextError) {
        console.error('❌ Failed to retrieve conversation context:', contextError);
        // Continue without context rather than failing the entire request
        conversationContext = null;
      }
    }
    
    // Initialize systemPrompt early to prevent ReferenceError
    let systemPrompt = '';
    
    // Initialize token tracking variables (managed in subscriptionSessions collection)
    let updatedTokensUsed = 0;
    let updatedPayAsYouGoTokens = 0;
    
    if (userData.role !== 'directeur') {
      return res.status(403).json({ 
        error: 'Accès réservé aux directeurs',
        code: 'INSUFFICIENT_ROLE'
      });
    }

    if (!userData.agencyId) {
      return res.status(403).json({ 
        error: 'Agence non définie pour cet utilisateur',
        code: 'MISSING_AGENCY'
      });
    }


    // 3. Validation du corps de la requête
    const { question, filters, selectedFormats, responseFormat, selectedResponseFormats } = req.body;
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Question manquante ou invalide',
        code: 'INVALID_QUESTION'
      });
    }

    // Initialize savedUserMessage at function scope
    let savedUserMessage = null;
    
    // Initialize existingConversationContext at function scope
    let existingConversationContext = null;

    // 4. Chargement et agrégation des données
    let data;
    try {
      data = await loadAndAggregateData(
        userData.agencyId,
        filters?.period,
        filters?.formId,
        filters?.userId,
        selectedFormats,
        uid, // directorId
        userData.role // userRole
      );
    } catch (dataError) {
      return res.status(500).json({ 
        error: 'Erreur lors du chargement des données',
        code: 'DATA_LOAD_ERROR',
        details: dataError.message
      });
    }

    // 4.5. Analyze content types present in the data (must be before buildSystemMessage)
    const hasPDFContent = data.submissions.some(s => 
      s.fileAttachments?.some(att => att.fileType === 'application/pdf' && (att.extractedText || att.rawExtractedText))
    ) || data.submissions.some(s => 
      Object.values(s.answers).some(value => 
        value && typeof value === 'object' && value.uploaded && value.fileName && (value.extractedText || value.rawExtractedText)
      )
    );

    const hasImageContent = data.submissions.some(s => 
      s.fileAttachments?.some(att => 
        att.fileType && att.fileType.startsWith('image/') && (att.extractedText || att.rawExtractedText)
      )
    ) || data.submissions.some(s => 
      Object.values(s.answers).some(value => 
        value && typeof value === 'object' && value.uploaded && value.fileName && (value.extractedText || value.rawExtractedText) && 
        value.fileType && value.fileType.startsWith('image/')
      )
    );

    // 4.6. Vérification des tokens disponibles
    
    // Build the actual system prompt first (we'll use this for both estimation and AI call)
    const buildSystemMessage = (conversationContext) => {
      const baseRole = `Tu es ARCHA, assistant IA expert en analyse de données d'entreprise.`;
      
      const coreRules = `
RÈGLES FONDAMENTALES :
- Réponds UNIQUEMENT en français
- Utilise UNIQUEMENT les données fournies - ne JAMAIS inventer de données
- Si données insuffisantes, dis-le clairement
- Sois clair, concis et actionnable
- Fournis des insights basés sur les données réelles

PRIORITÉS D'ANALYSE :
1. HAUTE PRIORITÉ : Chiffres, montants, quantités, dates, pourcentages, métriques financières
2. PRIORITÉ MOYENNE : Noms de produits, clients, employés, départements, catégories
3. PRIORITÉ FAIBLE : Descriptions générales, contexte historique, informations secondaires

TECHNIQUES D'EXTRACTION :
- Recherche par mots-clés dans les documents
- Identification des tableaux et listes de données
- Calcul de totaux, moyennes, et pourcentages
- Comparaison entre périodes ou entités
- Identification des tendances et patterns
- Analyse des corrélations et relations`;

      const formatInstructions = getFormatInstructions(responseFormat, selectedResponseFormats);
      
      // Add JSON validation instructions for any format that includes stats
      const jsonValidationInstructions = (selectedResponseFormats && selectedResponseFormats.includes('stats')) || responseFormat === 'stats' ? `

VALIDATION JSON OBLIGATOIRE :
- Vérifie que ton JSON est parfaitement formaté avant de le retourner
- Assure-toi que tous les tableaux (data, colors, insights, recommendations) sont entre crochets []
- Vérifie que toutes les chaînes de caractères sont entre guillemets doubles "
- Élimine toute virgule en fin de ligne avant les accolades fermantes }
- Teste mentalement que le JSON est parseable sans erreurs
- Si tu génères du JSON, il DOIT être valide et fonctionnel
- OBLIGATOIRE : Utilise SEULEMENT {"x": "nom", "y": nombre} pour les données - PAS de "label" ou "value"
- OBLIGATOIRE : Vérifie que chaque point de données a exactement les clés "x" et "y"` : '';

      // ADD: Conversation context section
      const conversationContextSection = conversationContext ? `
CONTEXTE DE LA CONVERSATION :
${conversationContext.summary ? `
📋 RÉSUMÉ DE LA CONVERSATION :
${conversationContext.summary.content}

Préférences du directeur identifiées :
- Formats préférés : ${conversationContext.summary.directorPreferences?.preferredFormats?.join(', ') || 'Non spécifiés'}
- Périodes fréquentes : ${conversationContext.summary.directorPreferences?.commonPeriods?.join(', ') || 'Non spécifiées'}
- Formulaires fréquents : ${conversationContext.summary.directorPreferences?.frequentForms?.join(', ') || 'Non spécifiés'}
` : ''}

📝 MESSAGES RÉCENTS (${conversationContext.recentMessages?.length || 0} derniers) :
${(conversationContext.recentMessages || []).map(msg => 
  `${msg.type === 'user' ? '👤 Directeur' : '🤖 ARCHA'}: ${(msg.content || '').substring(0, 200)}${(msg.content || '').length > 200 ? '...' : ''}`
).join('\n')}

IMPORTANT : Utilise ce contexte pour éviter de répéter les mêmes explications et pour adapter tes réponses aux préférences du directeur.` : '';
      
      const contextInfo = `
CONTEXTE MÉTIER :
- Agence : ${userData.agencyId}
- Période d'analyse : ${data.period.label}
- Nombre total de soumissions : ${data.totals.entries}
- Employés actifs : ${data.totals.uniqueUsers}/${data.totals.totalUsers}
- Formulaires utilisés : ${data.totals.uniqueForms}/${data.totals.totalForms}

OBJECTIF : Répondre clairement à la question du directeur avec des insights basés sur les données.

${hasPDFContent ? `
📄 ANALYSE DE DOCUMENTS PDF :
- Les soumissions contiennent des documents PDF avec du contenu textuel extrait et formaté
- Ces documents sont marqués par "--- Document X: [nom_fichier] ---"
- OBLIGATOIRE : Analyse le contenu de chaque document en détail, pas seulement les premières lignes
- OBLIGATOIRE : Extrais les informations pertinentes pour répondre à la question du directeur
- OBLIGATOIRE : Utilise les données des documents pour enrichir ta réponse
- OBLIGATOIRE : MENTIONNE le nom du fichier quand tu fais référence à son contenu
- OBLIGATOIRE : Donne des exemples concrets avec des chiffres précis extraits des documents
- OBLIGATOIRE : Calcule des totaux, moyennes, et pourcentages quand pertinent
- OBLIGATOIRE : Compare les données entre différents documents et périodes
- OBLIGATOIRE : Identifie les tendances et patterns dans les données
- OBLIGATOIRE : Structure ta réponse avec des insights basés sur l'analyse des documents

ANALYSE FINANCIÈRE ET COMMERCIALE :
- Si le document contient des données financières, traite-les comme des données numériques
- OBLIGATOIRE : Pour toute question sur des produits, articles, ou éléments spécifiques, recherche dans TOUT le contenu du document
- OBLIGATOIRE : Les tableaux contiennent des données détaillées - analyse-les ligne par ligne si nécessaire
- OBLIGATOIRE : Calcule automatiquement les totaux, moyennes, et pourcentages quand pertinent
- OBLIGATOIRE : Identifie les tendances et patterns dans les données temporelles
- OBLIGATOIRE : Compare les performances entre différentes périodes ou départements
- OBLIGATOIRE : Extrais les métriques clés (CA total, rentabilité, coûts, etc.)
- OBLIGATOIRE : Structure tes réponses avec des insights quantitatifs précis` : ''}

${hasImageContent ? `
🖼️ ANALYSE D'IMAGES :
- Les soumissions peuvent contenir des images avec du contenu textuel extrait par OCR
- Ces images sont marquées par "--- Document X: [nom_fichier] ---"
- OBLIGATOIRE : Analyse le contenu textuel de chaque image en détail
- OBLIGATOIRE : Extrais les informations pertinentes (tableaux, graphiques, données)
- OBLIGATOIRE : Utilise les données des images pour enrichir ta réponse
- OBLIGATOIRE : MENTIONNE le nom du fichier image quand tu fais référence à son contenu
- OBLIGATOIRE : Donne des exemples précis avec des données extraites des images` : ''}

${responseFormat === 'table' ? `
EXEMPLE DE TABLEAU CORRECT :
| Employé | Soumissions | Pourcentage |
|---------|-------------|-------------|
| Jean Dupont | 15 | 60% |
| Marie Martin | 10 | 40% |

IMPORTANT : Le tableau DOIT contenir des lignes de données réelles, pas seulement les en-têtes !` : ''}`;

      return `${baseRole}${coreRules}${formatInstructions}${jsonValidationInstructions}${conversationContextSection}${contextInfo}`;
    };

    // Format-specific instructions
    const getFormatInstructions = (responseFormat, selectedResponseFormats) => {
      // Handle multi-format combinations
      if (selectedResponseFormats && selectedResponseFormats.length > 1) {
        return getMultiFormatInstructions(selectedResponseFormats);
      }

      if (responseFormat === 'table') {
        return `

INSTRUCTIONS POUR FORMAT TABLEAU :
- Analyse la question du directeur et propose un tableau qui répond directement à sa demande
- Crée un tableau markdown structuré avec des colonnes pertinentes
- Utilise UNIQUEMENT les données fournies
- Propose le tableau le plus utile basé sur la question et les données disponibles
- Inclus une brève explication avant le tableau si nécessaire
- Format du tableau OBLIGATOIRE avec DONNÉES RÉELLES :
  | Colonne1 | Colonne2 | Colonne3 |
  |----------|----------|----------|
  | Donnée1  | Donnée2  | Donnée3  |
  | Donnée4  | Donnée5  | Donnée6  |
- OBLIGATOIRE : Inclus TOUJOURS des lignes de données réelles dans le tableau
- OBLIGATOIRE : Inclus TOUJOURS la ligne de séparation avec des tirets
- Le tableau doit contenir au minimum 2-3 lignes de données pour être utile
- Assure-toi que le tableau répond directement à la question posée avec des données concrètes`;
      }
      
      if (responseFormat === 'stats') {
        return `

INSTRUCTIONS POUR FORMAT STATISTIQUES :
- Analyse la question du directeur et propose un graphique qui répond directement à sa demande
- Crée un graphique JSON structuré avec des données pertinentes
- Utilise UNIQUEMENT les données fournies
- Choisis le type de graphique le plus approprié (line, bar, pie, area, scatter)
- Inclus une brève explication avant le graphique si nécessaire
- Format JSON OBLIGATOIRE avec DONNÉES RÉELLES :

\`\`\`json
{
  "type": "bar|line|pie|area|scatter",
  "title": "Titre descriptif du graphique",
  "subtitle": "Sous-titre optionnel",
  "data": [
    {"x": "Catégorie1", "y": 10},
    {"x": "Catégorie2", "y": 15}
  ],
  "xAxisKey": "x",
  "yAxisKey": "y",
  "dataKey": "y",
  "colors": ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"],
  "options": {
    "showLegend": true,
    "showGrid": true,
    "showTooltip": true
  },
  "insights": [
    "Insight clé basé sur les données",
    "Observation importante"
  ],
  "recommendations": [
    "Recommandation actionnable",
    "Suggestion d'amélioration"
  ]
}
\`\`\`

ATTENTION : Respecte EXACTEMENT ce format JSON. Chaque propriété doit avoir un deux-points : et les tableaux doivent être entre crochets [].

- OBLIGATOIRE : Inclus TOUJOURS des données réelles dans le tableau "data"
- OBLIGATOIRE : Le graphique doit contenir au minimum 2-3 points de données pour être utile
- OBLIGATOIRE : Utilise EXACTEMENT les clés (x, y) pour les données du graphique - PAS de "label" ou "value"
- OBLIGATOIRE : Chaque point de données doit avoir la structure {"x": "nom", "y": nombre}
- OBLIGATOIRE : INTERDIT d'utiliser "label" ou "value" dans les données - utilise SEULEMENT "x" et "y"
- OBLIGATOIRE : Inclus des insights et recommandations basés sur les données
- OBLIGATOIRE : Le JSON doit être parfaitement formaté avec des crochets [] pour tous les tableaux
- OBLIGATOIRE : Utilise des guillemets doubles " pour toutes les chaînes de caractères
- OBLIGATOIRE : Pas de virgules en fin de ligne avant les accolades fermantes
- OBLIGATOIRE : Le JSON doit être valide et parseable sans erreurs
- OBLIGATOIRE : Chaque propriété doit avoir un deux-points : après le nom
- OBLIGATOIRE : Les tableaux data, colors, insights, recommendations doivent être entre crochets []
- OBLIGATOIRE : Vérifie que chaque objet JSON est correctement fermé avec }
- Assure-toi que le graphique répond directement à la question posée avec des données concrètes
- Types de graphiques recommandés :
  * "bar" : pour comparer des catégories
  * "line" : pour montrer des tendances temporelles
  * "pie" : pour montrer des proportions
  * "area" : pour montrer des volumes cumulés
  * "scatter" : pour montrer des corrélations`;
      }
      
      if (responseFormat === 'pdf') {
        return `

INSTRUCTIONS POUR FORMAT PDF :
- Analyse la question du directeur et crée un rapport PDF structuré et professionnel
- Utilise UNIQUEMENT les données réelles fournies dans le contexte
- Structure ta réponse en sections claires avec des titres markdown (##, ###)
- Inclus une introduction, une analyse détaillée, et des conclusions
- Utilise des listes à puces et des tableaux markdown pour organiser l'information
- Inclus des métriques pertinentes, pourcentages, et insights basés sur les données
- Assure-toi que le contenu est professionnel et prêt pour génération PDF
- Le rapport doit être complet et répondre directement à la question posée
- Utilise un langage clair et structuré adapté à un document officiel
- Format recommandé :
  ## Introduction
  ## Analyse des données
  ### Métriques clés
  ### Tendances observées
  ## Conclusions et recommandations
- OBLIGATOIRE : Inclus des données concrètes et des insights actionables
- OBLIGATOIRE : Utilise des tableaux markdown pour présenter les données importantes
- OBLIGATOIRE : Structure le contenu de manière professionnelle et lisible`;
      }
      
      return `

INSTRUCTIONS POUR RÉPONSE TEXTE :
- Réponds naturellement et professionnellement à la question du directeur
- Utilise UNIQUEMENT les données fournies
- Sois clair, concis et actionnable
- Inclus des insights basés sur les données
- Propose des recommandations concrètes
- Évite les sections de raisonnement interne ou les formats structurés`;
    };

    // Multi-format instructions
    const getMultiFormatInstructions = (selectedFormats) => {
      const hasPDF = selectedFormats.includes('pdf');
      const hasStats = selectedFormats.includes('stats');
      const hasTable = selectedFormats.includes('table');

      if (hasPDF && hasStats && hasTable) {
        return `

INSTRUCTIONS POUR FORMAT PDF + STATISTIQUES + TABLEAU :
- Analyse la question du directeur et crée un rapport PDF complet avec graphique et tableau
- Utilise UNIQUEMENT les données réelles fournies dans le contexte
- Structure ta réponse en sections claires avec des titres markdown (##, ###)
- OBLIGATOIRE : Inclus UN GRAPHIQUE JSON et UN TABLEAU MARKDOWN dans le même rapport
- Format de réponse OBLIGATOIRE :

## Introduction
[Texte d'introduction basé sur la question]

## Analyse des données
[Texte d'analyse avec insights]

### Graphique statistique
[Insère ici le graphique JSON avec le format exact ci-dessous]

\`\`\`json
{
  "type": "bar|line|pie|area|scatter",
  "title": "Titre descriptif du graphique",
  "subtitle": "Sous-titre optionnel",
  "data": [
    {"x": "Catégorie1", "y": 10},
    {"x": "Catégorie2", "y": 15}
  ],
  "xAxisKey": "x",
  "yAxisKey": "y",
  "dataKey": "y",
  "colors": ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"],
  "options": {
    "showLegend": true,
    "showGrid": true,
    "showTooltip": true
  },
  "insights": [
    "Insight clé basé sur les données",
    "Observation importante"
  ],
  "recommendations": [
    "Recommandation actionnable",
    "Suggestion d'amélioration"
  ]
}
\`\`\`

### Données tabulaires
[Insère ici le tableau markdown avec le format exact ci-dessous]

| Colonne1 | Colonne2 | Colonne3 |
|----------|----------|----------|
| Donnée1  | Donnée2  | Donnée3  |
| Donnée4  | Donnée5  | Donnée6  |

## Conclusions et recommandations
[Texte de conclusion avec recommandations]

- OBLIGATOIRE : Le graphique JSON et le tableau markdown doivent être dans le même rapport
- OBLIGATOIRE : Utilise des données réelles pour le graphique et le tableau
- OBLIGATOIRE : Structure le contenu de manière professionnelle et lisible
- OBLIGATOIRE : Le rapport doit être complet et répondre directement à la question posée
- OBLIGATOIRE : Le JSON doit être parfaitement formaté avec des crochets [] pour tous les tableaux
- OBLIGATOIRE : Utilise des guillemets doubles " pour toutes les chaînes de caractères
- OBLIGATOIRE : Pas de virgules en fin de ligne avant les accolades fermantes
- OBLIGATOIRE : Le JSON doit être valide et parseable sans erreurs
- OBLIGATOIRE : Chaque propriété doit avoir un deux-points : après le nom
- OBLIGATOIRE : Les tableaux data, colors, insights, recommendations doivent être entre crochets []
- OBLIGATOIRE : Vérifie que chaque objet JSON est correctement fermé avec }`;
      }

      if (hasPDF && hasStats) {
        return `

INSTRUCTIONS POUR FORMAT PDF + STATISTIQUES :
- Analyse la question du directeur et crée un rapport PDF avec graphique statistique
- Utilise UNIQUEMENT les données réelles fournies dans le contexte
- Structure ta réponse en sections claires avec des titres markdown (##, ###)
- OBLIGATOIRE : Inclus UN GRAPHIQUE JSON dans le rapport PDF
- Format de réponse OBLIGATOIRE :

## Introduction
[Texte d'introduction basé sur la question]

## Analyse des données
[Texte d'analyse avec insights]

### Graphique statistique
[Insère ici le graphique JSON avec le format exact ci-dessous]

\`\`\`json
{
  "type": "bar|line|pie|area|scatter",
  "title": "Titre descriptif du graphique",
  "subtitle": "Sous-titre optionnel",
  "data": [
    {"x": "Catégorie1", "y": 10},
    {"x": "Catégorie2", "y": 15}
  ],
  "xAxisKey": "x",
  "yAxisKey": "y",
  "dataKey": "y",
  "colors": ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"],
  "options": {
    "showLegend": true,
    "showGrid": true,
    "showTooltip": true
  },
  "insights": [
    "Insight clé basé sur les données",
    "Observation importante"
  ],
  "recommendations": [
    "Recommandation actionnable",
    "Suggestion d'amélioration"
  ]
}
\`\`\`

## Conclusions et recommandations
[Texte de conclusion avec recommandations]

- OBLIGATOIRE : Le graphique JSON doit être dans le rapport PDF
- OBLIGATOIRE : Utilise des données réelles pour le graphique
- OBLIGATOIRE : Structure le contenu de manière professionnelle et lisible
- OBLIGATOIRE : Le rapport doit être complet et répondre directement à la question posée
- OBLIGATOIRE : Le JSON doit être parfaitement formaté avec des crochets [] pour tous les tableaux
- OBLIGATOIRE : Utilise des guillemets doubles " pour toutes les chaînes de caractères
- OBLIGATOIRE : Pas de virgules en fin de ligne avant les accolades fermantes
- OBLIGATOIRE : Le JSON doit être valide et parseable sans erreurs
- OBLIGATOIRE : Chaque propriété doit avoir un deux-points : après le nom
- OBLIGATOIRE : Les tableaux data, colors, insights, recommendations doivent être entre crochets []
- OBLIGATOIRE : Vérifie que chaque objet JSON est correctement fermé avec }`;
      }

      if (hasPDF && hasTable) {
        return `

INSTRUCTIONS POUR FORMAT PDF + TABLEAU :
- Analyse la question du directeur et crée un rapport PDF avec tableau de données
- Utilise UNIQUEMENT les données réelles fournies dans le contexte
- Structure ta réponse en sections claires avec des titres markdown (##, ###)
- OBLIGATOIRE : Inclus UN TABLEAU MARKDOWN dans le rapport PDF
- Format de réponse OBLIGATOIRE :

## Introduction
[Texte d'introduction basé sur la question]

## Analyse des données
[Texte d'analyse avec insights]

### Données tabulaires
[Insère ici le tableau markdown avec le format exact ci-dessous]

| Colonne1 | Colonne2 | Colonne3 |
|----------|----------|----------|
| Donnée1  | Donnée2  | Donnée3  |
| Donnée4  | Donnée5  | Donnée6  |

## Conclusions et recommandations
[Texte de conclusion avec recommandations]

- OBLIGATOIRE : Le tableau markdown doit être dans le rapport PDF
- OBLIGATOIRE : Utilise des données réelles pour le tableau
- OBLIGATOIRE : Structure le contenu de manière professionnelle et lisible
- OBLIGATOIRE : Le rapport doit être complet et répondre directement à la question posée`;
      }

      if (hasStats && hasTable) {
        return `

INSTRUCTIONS POUR FORMAT STATISTIQUES + TABLEAU :
- Analyse la question du directeur et fournis un graphique ET un tableau
- Utilise UNIQUEMENT les données réelles fournies dans le contexte
- OBLIGATOIRE : Inclus UN GRAPHIQUE JSON et UN TABLEAU MARKDOWN dans la même réponse
- OBLIGATOIRE : Le graphique et le tableau doivent compléter l'analyse (pas les mêmes données)
- OBLIGATOIRE : Le tableau doit avoir des en-têtes et des données réelles (pas seulement des en-têtes)
- Format de réponse OBLIGATOIRE :

[Texte d'introduction et d'analyse basé sur la question]

### Graphique statistique
[Insère ici le graphique JSON avec le format exact ci-dessous]

\`\`\`json
{
  "type": "bar|line|pie|area|scatter",
  "title": "Titre descriptif du graphique",
  "subtitle": "Sous-titre optionnel",
  "data": [
    {"x": "Catégorie1", "y": 10},
    {"x": "Catégorie2", "y": 15}
  ],
  "xAxisKey": "x",
  "yAxisKey": "y",
  "dataKey": "y",
  "colors": ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"],
  "options": {
    "showLegend": true,
    "showGrid": true,
    "showTooltip": true
  },
  "insights": [
    "Insight clé basé sur les données",
    "Observation importante"
  ],
  "recommendations": [
    "Recommandation actionnable",
    "Suggestion d'amélioration"
  ]
}
\`\`\`

### Données tabulaires
[Insère ici le tableau markdown avec le format exact ci-dessous]

| Colonne1 | Colonne2 | Colonne3 |
|----------|----------|----------|
| Donnée1  | Donnée2  | Donnée3  |
| Donnée4  | Donnée5  | Donnée6  |

[Texte de conclusion avec recommandations]

- OBLIGATOIRE : Le graphique JSON et le tableau markdown doivent être dans la même réponse
- OBLIGATOIRE : Utilise des données réelles pour le graphique et le tableau
- OBLIGATOIRE : Le contenu doit être complet et répondre directement à la question posée
- OBLIGATOIRE : Le JSON doit être parfaitement formaté avec des crochets [] pour tous les tableaux
- OBLIGATOIRE : Utilise des guillemets doubles " pour toutes les chaînes de caractères
- OBLIGATOIRE : Pas de virgules en fin de ligne avant les accolades fermantes
- OBLIGATOIRE : Le JSON doit être valide et parseable sans erreurs
- OBLIGATOIRE : Chaque propriété doit avoir un deux-points : après le nom
- OBLIGATOIRE : Les tableaux data, colors, insights, recommendations doivent être entre crochets []
- OBLIGATOIRE : Vérifie que chaque objet JSON est correctement fermé avec }
- OBLIGATOIRE : Le graphique et le tableau doivent offrir des perspectives complémentaires sur les données
- OBLIGATOIRE : Inclus des insights et recommandations basés sur l'analyse des deux formats
- OBLIGATOIRE : INTERDIT d'utiliser "label" ou "value" dans les données du graphique - utilise SEULEMENT "x" et "y"
- OBLIGATOIRE : Chaque point de données du graphique doit avoir la structure {"x": "nom", "y": nombre}`;
      }

      return `

INSTRUCTIONS POUR FORMAT MULTI-FORMAT :
- Analyse la question du directeur et fournis une réponse adaptée aux formats sélectionnés
- Utilise UNIQUEMENT les données réelles fournies dans le contexte
- Assure-toi que la réponse est complète et répond directement à la question posée
- OBLIGATOIRE : Inclus des données concrètes et des insights basés sur les données réelles`;
    };

    // Determine content type for response based on formats
    const getContentTypeForResponse = (responseFormat, selectedResponseFormats) => {
      // Handle multi-format combinations
      if (selectedResponseFormats && selectedResponseFormats.length > 1) {
        const hasPDF = selectedResponseFormats.includes('pdf');
        const hasStats = selectedResponseFormats.includes('stats');
        const hasTable = selectedResponseFormats.includes('table');

        if (hasPDF) {
          return 'text-pdf'; // PDF format with embedded content
        } else if (hasStats && hasTable) {
          return 'multi-format'; // Stats + Table combination
        } else {
          return 'multi-format'; // Other multi-format combinations
        }
      }

      // Handle single format
      if (responseFormat === 'pdf') {
        return 'text-pdf';
      } else if (responseFormat === 'stats') {
        return 'graph';
      } else if (responseFormat === 'table') {
        return 'table';
      } else {
        return 'text';
      }
    };

    // Generate fallback response for multi-format combinations
    const generateMultiFormatFallbackResponse = (selectedFormats, data) => {
      const hasPDF = selectedFormats.includes('pdf');
      const hasStats = selectedFormats.includes('stats');
      const hasTable = selectedFormats.includes('table');

      if (hasPDF && hasStats && hasTable) {
        return `# Rapport d'analyse - ${data.period.label}

## Introduction

Ce rapport présente une analyse complète des données de votre agence pour la période ${data.period.label}.

## Analyse des données

### Graphique statistique

\`\`\`json
{
  "type": "bar",
  "title": "Top 5 des employés par nombre de soumissions",
  "subtitle": "Période: ${data.period.label}",
  "data": [
    ${data.userStats.slice(0, 5).map(u => `{"x": "${u.name}", "y": ${u.count}}`).join(',\n    ')}
  ],
  "xAxisKey": "x",
  "yAxisKey": "y",
  "dataKey": "y",
  "colors": ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"],
  "options": {
    "showLegend": true,
    "showGrid": true,
    "showTooltip": true
  },
  "insights": [
    "Top employé: ${data.userStats[0]?.name || 'N/A'} avec ${data.userStats[0]?.count || 0} soumissions",
    "Total de ${data.totals.entries} soumissions analysées"
  ],
  "recommendations": [
    "Analyser les bonnes pratiques du top employé",
    "Identifier les opportunités d'amélioration"
  ]
}
\`\`\`

### Données tabulaires

| Employé | Nombre de soumissions | Pourcentage | Formulaire principal |
|---------|----------------------|-------------|---------------------|
${data.userStats.slice(0, 5).map(u => `| ${u.name} | ${u.count} | ${((u.count/data.totals.entries)*100).toFixed(1)}% | ${data.formStats[0]?.title || 'N/A'} |`).join('\n')}

## Conclusions et recommandations

- **Période analysée :** ${data.period.label}
- **Total soumissions :** ${data.totals.entries}
- **Employés actifs :** ${data.totals.uniqueUsers}/${data.totals.totalUsers}
- **Formulaires utilisés :** ${data.totals.uniqueForms}/${data.totals.totalForms}`;
      }

      if (hasPDF && hasStats) {
        return `# Rapport d'analyse - ${data.period.label}

## Introduction

Ce rapport présente une analyse des données de votre agence pour la période ${data.period.label}.

## Analyse des données

### Graphique statistique

\`\`\`json
{
  "type": "bar",
  "title": "Top 5 des employés par nombre de soumissions",
  "subtitle": "Période: ${data.period.label}",
  "data": [
    ${data.userStats.slice(0, 5).map(u => `{"x": "${u.name}", "y": ${u.count}}`).join(',\n    ')}
  ],
  "xAxisKey": "x",
  "yAxisKey": "y",
  "dataKey": "y",
  "colors": ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"],
  "options": {
    "showLegend": true,
    "showGrid": true,
    "showTooltip": true
  },
  "insights": [
    "Top employé: ${data.userStats[0]?.name || 'N/A'} avec ${data.userStats[0]?.count || 0} soumissions",
    "Total de ${data.totals.entries} soumissions analysées"
  ],
  "recommendations": [
    "Analyser les bonnes pratiques du top employé",
    "Identifier les opportunités d'amélioration"
  ]
}
\`\`\`

## Conclusions et recommandations

- **Période analysée :** ${data.period.label}
- **Total soumissions :** ${data.totals.entries}
- **Employés actifs :** ${data.totals.uniqueUsers}/${data.totals.totalUsers}`;
      }

      if (hasPDF && hasTable) {
        return `# Rapport d'analyse - ${data.period.label}

## Introduction

Ce rapport présente une analyse des données de votre agence pour la période ${data.period.label}.

## Analyse des données

### Données tabulaires

| Employé | Nombre de soumissions | Pourcentage | Formulaire principal |
|---------|----------------------|-------------|---------------------|
${data.userStats.slice(0, 5).map(u => `| ${u.name} | ${u.count} | ${((u.count/data.totals.entries)*100).toFixed(1)}% | ${data.formStats[0]?.title || 'N/A'} |`).join('\n')}

## Conclusions et recommandations

- **Période analysée :** ${data.period.label}
- **Total soumissions :** ${data.totals.entries}
- **Employés actifs :** ${data.totals.uniqueUsers}/${data.totals.totalUsers}
- **Formulaires utilisés :** ${data.totals.uniqueForms}/${data.totals.totalForms}`;
      }

      if (hasStats && hasTable) {
        return `Analyse des données pour la période ${data.period.label}

### Graphique statistique

\`\`\`json
{
  "type": "bar",
  "title": "Top 5 des employés par nombre de soumissions",
  "subtitle": "Période: ${data.period.label}",
  "data": [
    ${data.userStats.slice(0, 5).map(u => `{"x": "${u.name}", "y": ${u.count}}`).join(',\n    ')}
  ],
  "xAxisKey": "x",
  "yAxisKey": "y",
  "dataKey": "y",
  "colors": ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"],
  "options": {
    "showLegend": true,
    "showGrid": true,
    "showTooltip": true
  },
  "insights": [
    "Top employé: ${data.userStats[0]?.name || 'N/A'} avec ${data.userStats[0]?.count || 0} soumissions",
    "Total de ${data.totals.entries} soumissions analysées"
  ],
  "recommendations": [
    "Analyser les bonnes pratiques du top employé",
    "Identifier les opportunités d'amélioration"
  ]
}
\`\`\`

### Données tabulaires

| Employé | Nombre de soumissions | Pourcentage | Formulaire principal |
|---------|----------------------|-------------|---------------------|
${data.userStats.slice(0, 5).map(u => `| ${u.name} | ${u.count} | ${((u.count/data.totals.entries)*100).toFixed(1)}% | ${data.formStats[0]?.title || 'N/A'} |`).join('\n')}

**Période analysée :** ${data.period.label}  
**Total soumissions :** ${data.totals.entries}  
**Employés actifs :** ${data.totals.uniqueUsers}/${data.totals.totalUsers}`;
      }

      return `Analyse des données pour la période ${data.period.label}

**Période analysée :** ${data.period.label}  
**Total soumissions :** ${data.totals.entries}  
**Employés actifs :** ${data.totals.uniqueUsers}/${data.totals.totalUsers}`;
    };

    // Build the actual user message for estimation
    const buildUserMessageForEstimation = () => {
      const questionText = `QUESTION : "${question}"`;
      
      const dataOverview = `
DONNÉES DISPONIBLES :
- ${data.totals.entries} soumissions au total
- ${data.totals.uniqueUsers} employés actifs
- ${data.totals.uniqueForms} formulaires utilisés
- Période : ${data.period.label}

TOP EMPLOYÉS : ${data.userStats.slice(0, 3).map(u => `${u.name} (${u.count} soumissions)`).join(', ')}
TOP FORMULAIRES : ${data.formStats.slice(0, 3).map(f => `${f.title} (${f.count} soumissions)`).join(', ')}`;

      return `${questionText}\n\n${dataOverview}`;
    };

    // We'll build the system prompt after hasPDFContent is defined
    // For now, use a basic estimation
    const basicSystemPrompt = `Tu es ARCHA, assistant IA expert en analyse de données d'entreprise.`;
    const userPromptForEstimation = buildUserMessageForEstimation();
    const estimatedTokens = TokenCounter.getTotalEstimatedTokens(basicSystemPrompt, userPromptForEstimation, 2000);
    const userTokensToCharge = TokenCounter.getUserTokensToCharge(estimatedTokens, 2.5);
    
    
    // Calculate package limit based on user's package type
    const getPackageLimit = (packageType) => {
      const limits = {
        starter: 300000,    // Updated to match PACKAGES.md
        standard: 600000,   // Updated to match PACKAGES.md
        premium: 1500000    // Updated to match PACKAGES.md
      };
      return limits[packageType] || 300000;
    };

    // Check subscription status - tokens are managed in subscriptionSessions collection only
    // This function is kept for compatibility but doesn't modify user document
    const checkSubscriptionAndResetTokens = async (userData, uid) => {
      // Tokens are now managed in subscriptionSessions collection
      // This function returns default values for compatibility
      return { 
        tokensUsed: 0, 
        payAsYouGoTokens: 0, 
        subscriptionExpired: false 
      };
    };
    
    // Get session-based package limits and token usage (using new collection)
    let currentSession = null;
    
    // Try to get active session from new collection first
    if (userData.currentSubscriptionSessionId) {
      try {
        const sessionDoc = await adminDb.collection('subscriptionSessions')
          .doc(userData.currentSubscriptionSessionId)
          .get();
        
        if (sessionDoc.exists) {
          const sessionData = sessionDoc.data();
          if (sessionData.isActive) {
            currentSession = { id: sessionDoc.id, ...sessionData };
          }
        }
      } catch (error) {
        console.error('Error fetching session from collection:', error);
      }
    }
    
    // Only use subscriptionSessions collection - no fallback to legacy system
    if (!currentSession) {
      return res.status(400).json({
        error: 'Aucune session active trouvée. Veuillez sélectionner un package.',
        code: 'NO_ACTIVE_SESSION'
      });
    }
    
    // Use session-based data
    const packageLimit = currentSession.packageResources?.tokensIncluded || 0;
    let currentTokensUsed = currentSession.usage?.tokensUsed || 0;
    const payAsYouGoTokens = currentSession.payAsYouGoResources?.tokens || 0;
    const subscriptionExpired = new Date() > new Date(currentSession.endDate);
    
    console.log('📊 SESSION-BASED TOKEN CHECK:', {
      sessionId: currentSession.id,
      packageType: currentSession.packageType,
      packageLimit,
      currentTokensUsed,
      payAsYouGoTokens,
      subscriptionExpired
    });
    
    // If subscription has expired, return error
    if (subscriptionExpired) {
      return res.status(402).json({ 
        error: 'Abonnement expiré',
        code: 'SUBSCRIPTION_EXPIRED',
        message: 'Votre abonnement a expiré. Veuillez renouveler votre abonnement pour continuer à utiliser les services.',
        canRenew: true
      });
    }
    
    // Check if user has enough tokens (including pay-as-you-go tokens)
    const totalAvailableTokens = packageLimit === -1 ? -1 : packageLimit + payAsYouGoTokens;
    
    // Skip token check for unlimited packages
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


    // 5. Context-Aware System Message Construction

    // Note: hasPDFContent and hasImageContent are already defined above (section 4.5)

    const hasFileAttachments = data.submissions.some(s => 
      s.fileAttachments && s.fileAttachments.length > 0
    ) || data.submissions.some(s => 
      Object.values(s.answers).some(value => 
        value && typeof value === 'object' && value.uploaded && value.fileName
      )
    );

    const hasComplexData = data.submissions.some(s => 
      Object.values(s.answers).some(value => 
        typeof value === 'object' && value !== null
      )
    );


    


    // Build simple submissions data
    const buildSubmissionsData = (submissions) => {
      return submissions.map((s, index) => {
        // Find the form for this submission to get field definitions
        // Try to find form by matching formTitle
        let submissionForm = null;
        if (data.formsById && s.formTitle) {
          // Iterate through formsById to find matching form
          for (const [formId, form] of data.formsById.entries()) {
            if (form.title === s.formTitle) {
              submissionForm = form;
              break;
            }
          }
        }
        
        const fieldSummary = Object.entries(s.answers).map(([fieldLabel, value]) => {
          // Try to find the field definition to get displayColumnId
          let field = null;
          if (submissionForm && submissionForm.fields) {
            // Find field by label (since we're using fieldLabel here)
            field = submissionForm.fields.find(f => f.label === fieldLabel);
          }
          
          // Use formatFieldValue to handle list values and other types
          const displayValue = formatFieldValue(value, field, true); // true = forAI
          return `${fieldLabel}: ${displayValue}`;
        }).join(' | ');
        
        // Add extracted text from file attachments as part of the submission data
        let extractedTextSummary = '';
        if (s.fileAttachments && s.fileAttachments.length > 0) {
          const pdfFiles = s.fileAttachments.filter(att => 
            att.fileType === 'application/pdf' && (att.extractedText || att.rawExtractedText)
          );
          
          const imageFiles = s.fileAttachments.filter(att => 
            att.fileType && att.fileType.startsWith('image/') && (att.extractedText || att.rawExtractedText)
          );
          
          if (pdfFiles.length > 0) {
            pdfFiles.forEach((file, fileIndex) => {
              // Use formatted text if available, otherwise fall back to raw extracted text
              const textToUse = file.extractedText || file.rawExtractedText || '';
              if (textToUse) {
                // Send full content to AI - no truncation needed with increased token limits
                extractedTextSummary += ` | Document PDF: ${file.fileName} (${textToUse})`;
              }
            });
          }
          
          if (imageFiles.length > 0) {
            imageFiles.forEach((file, fileIndex) => {
              // Use formatted text if available, otherwise fall back to raw extracted text
              const textToUse = file.extractedText || file.rawExtractedText || '';
              if (textToUse) {
                // Send full content to AI - no truncation needed with increased token limits
                extractedTextSummary += ` | Image: ${file.fileName} (${textToUse})`;
              }
            });
          }
        }
        
        return `SOUMISSION ${index + 1}: ${s.employeeName} | ${s.formTitle} | ${s.submittedDate}
${fieldSummary}${extractedTextSummary}`;
      }).join('\n\n');
    };

    // Build the complete user message with detailed submissions data
    const buildUserMessage = () => {
      const questionText = `QUESTION : "${question}"`;
      
      const dataOverview = `
DONNÉES DISPONIBLES :
- ${data.totals.entries} soumissions au total
- ${data.totals.uniqueUsers} employés actifs
- ${data.totals.uniqueForms} formulaires utilisés
- Période : ${data.period.label}

TOP EMPLOYÉS : ${data.userStats.slice(0, 3).map(u => `${u.name} (${u.count} soumissions)`).join(', ')}
TOP FORMULAIRES : ${data.formStats.slice(0, 3).map(f => `${f.title} (${f.count} soumissions)`).join(', ')}`;

      const submissions = data.submissions.length > 0 ? 
        buildSubmissionsData(data.submissions) : 
        'AUCUNE SOUMISSION TROUVÉE POUR CETTE PÉRIODE';

      const tableFormatReminder = responseFormat === 'table' ? `

IMPORTANT : Tu dois répondre avec un TABLEAU MARKDOWN qui contient des DONNÉES RÉELLES.
Le tableau doit avoir cette structure :
| Colonne1 | Colonne2 | Colonne3 |
|----------|----------|----------|
| Donnée1  | Donnée2  | Donnée3  |
| Donnée4  | Donnée5  | Donnée6  |

N'inclus PAS seulement les en-têtes - tu DOIS inclure des lignes de données réelles !` : '';

      const pdfContentReminder = hasPDFContent ? `

ANALYSE DES DOCUMENTS PDF :
- Chaque soumission peut contenir des documents PDF avec du contenu textuel extrait et formaté
- Ces documents sont marqués par "--- Document X: [nom_fichier] ---"
- OBLIGATOIRE : Analyse le contenu de chaque document en détail, pas seulement les premières lignes
- OBLIGATOIRE : Extrais les informations pertinentes pour répondre à la question du directeur
- OBLIGATOIRE : Utilise les données des documents pour enrichir ta réponse avec des détails concrets
- OBLIGATOIRE : MENTIONNE le nom du fichier quand tu fais référence à son contenu
- OBLIGATOIRE : Utilise des phrases comme "Selon le document [nom_fichier]", "Dans le fichier [nom_fichier]", "D'après [nom_fichier]"
- OBLIGATOIRE : Donne des exemples précis avec des chiffres réels extraits des documents
- OBLIGATOIRE : Calcule des totaux, moyennes, et pourcentages quand pertinent
- OBLIGATOIRE : Compare les données entre différents documents et périodes
- OBLIGATOIRE : Identifie les tendances et patterns dans les données

EXEMPLE DE RÉFÉRENCE CORRECTE :
"Selon le document sales_report.pdf, le produit A a généré $50,000 de ventes..."
"D'après le fichier inventory_check.pdf, le stock du produit B est de 150 unités..."` : '';

      const imageContentReminder = hasImageContent ? `

ANALYSE DES IMAGES :
- Les soumissions peuvent contenir des images avec du contenu textuel extrait par OCR
- Ces images sont marquées par "--- Document X: [nom_fichier] ---"
- OBLIGATOIRE : Analyse le contenu textuel de chaque image en détail
- OBLIGATOIRE : Extrais les informations pertinentes (tableaux, graphiques, données)
- OBLIGATOIRE : Utilise les données des images pour enrichir ta réponse
- OBLIGATOIRE : MENTIONNE le nom du fichier image quand tu fais référence à son contenu
- OBLIGATOIRE : Utilise des phrases comme "Selon l'image [nom_fichier]", "Dans l'image [nom_fichier]", "D'après [nom_fichier]"
- OBLIGATOIRE : Donne des exemples précis avec des données extraites des images` : '';

      // Add generic process examples and chain of thought instructions
      const processInstructions = `

PROCESSUS D'ANALYSE À SUIVRE :
1. IDENTIFICATION : Identifie d'abord le type de question posée (données, tendances, comparaisons, etc.)
2. RECHERCHE : Recherche dans les documents les informations pertinentes à cette question
3. EXTRACTION : Extrais les données spécifiques (chiffres, noms, dates, métriques)
4. ANALYSE : Analyse les données pour identifier les tendances et patterns
5. SYNTHÈSE : Synthétise les informations en insights actionables
6. RÉPONSE : Structure ta réponse avec des exemples concrets et des recommandations

EXEMPLES DE MÉTHODOLOGIE D'ANALYSE :

Question: [Question sur l'analyse de données]
Processus: 1) Identifier les documents pertinents, 2) Extraire les données spécifiques, 3) Calculer les métriques, 4) Référencer les sources
Réponse: Basé sur [nom_document.pdf], [données_spécifiques] montre [analyse]. Selon [autre_fichier.pdf], [comparaison/tendance].

Question: [Question sur les performances]
Processus: 1) Localiser les métriques de performance, 2) Comparer les données, 3) Identifier les patterns, 4) Calculer les évolutions
Réponse: D'après [document_source.pdf], [métrique] s'élève à [valeur]. Comparé à [période_précédente], [évolution] de [pourcentage].

Question: [Question sur les tendances]
Processus: 1) Extraire les données temporelles, 2) Calculer les évolutions, 3) Identifier les patterns, 4) Projeter les tendances
Réponse: Selon [rapport_1.pdf] et [rapport_2.pdf], [tendance] avec [données_spécifiques]. [Insight] basé sur [analyse].

INSTRUCTIONS D'ANALYSE SPÉCIFIQUES :
- Si la question concerne des DONNÉES : recherche dans tous les documents les chiffres, montants, quantités, et métriques
- Si la question concerne des TENDANCES : compare les données entre différentes périodes et identifie les évolutions
- Si la question concerne des COMPARAISONS : analyse les différences entre entités, périodes, ou catégories
- Si la question concerne des PERFORMANCES : évalue les résultats et identifie les facteurs de succès
- OBLIGATOIRE : Utilise les données des documents pour donner des réponses précises et détaillées
- OBLIGATOIRE : Cite des exemples concrets extraits des documents
- OBLIGATOIRE : Calcule des totaux, moyennes, et pourcentages quand pertinent
- OBLIGATOIRE : Structure ta réponse de manière claire et actionnable`;

      return `${questionText}\n\n${dataOverview}\n\n${submissions}${tableFormatReminder}${pdfContentReminder}${imageContentReminder}${processInstructions}`;
    };

    // Use the complete user message for the AI call
    const userPromptForAI = buildUserMessage();
    
    


    // 6. Appel OpenAI
    let answer = '';
    let tokensUsed = 0;
    let finalUserTokens = 0;
    
    // Initialize token calculation function
    const calculateUserTokens = (actualTokens) => {
      // Formula: (actualTokens * 2.5) / 100
      return Math.ceil((actualTokens * 2.5) / 100);
    };
    
    if (!process.env.OPENAI_API_KEY) {
      // Fallback si OpenAI n'est pas configuré
      if (selectedResponseFormats && selectedResponseFormats.length > 1) {
        answer = generateMultiFormatFallbackResponse(selectedResponseFormats, data);
      } else if (responseFormat === 'table') {
        answer = `Voici un tableau basé sur vos données :

| Employé | Nombre de soumissions | Pourcentage | Formulaire principal |
|---------|----------------------|-------------|---------------------|
${data.userStats.slice(0, 5).map(u => `| ${u.name} | ${u.count} | ${((u.count/data.totals.entries)*100).toFixed(1)}% | ${data.formStats[0]?.title || 'N/A'} |`).join('\n')}

**Période analysée :** ${data.period.label}  
**Total soumissions :** ${data.totals.entries}  
**Employés actifs :** ${data.totals.uniqueUsers}/${data.totals.totalUsers}`;
      } else if (responseFormat === 'pdf') {
        answer = `# Rapport d'analyse - ${data.period.label}

## Introduction

Ce rapport présente une analyse des données de votre agence pour la période ${data.period.label}.

## Analyse des données

### Métriques clés

| Métrique | Valeur | Détail |
|----------|--------|--------|
| Total soumissions | ${data.totals.entries} | Toutes périodes confondues |
| Employés actifs | ${data.totals.uniqueUsers}/${data.totals.totalUsers} | ${((data.totals.uniqueUsers/data.totals.totalUsers)*100).toFixed(1)}% d'engagement |
| Formulaires utilisés | ${data.totals.uniqueForms}/${data.totals.totalForms} | Diversité des outils |

### Performance des employés

| Employé | Soumissions | Pourcentage | Performance |
|---------|-------------|-------------|-------------|
${data.userStats.slice(0, 5).map(u => `| ${u.name} | ${u.count} | ${((u.count/data.totals.entries)*100).toFixed(1)}% | ${u.count > data.totals.entries/data.totals.uniqueUsers ? 'Au-dessus de la moyenne' : 'En dessous de la moyenne'} |`).join('\n')}

## Conclusions et recommandations

### Points positifs
- **Engagement global :** ${((data.totals.uniqueUsers/data.totals.totalUsers)*100).toFixed(1)}% des employés sont actifs
- **Employé le plus performant :** ${data.userStats[0]?.name || 'N/A'} avec ${data.userStats[0]?.count || 0} soumissions
- **Formulaire principal :** "${data.formStats[0]?.title || 'N/A'}" avec ${data.formStats[0]?.count || 0} utilisations

### Recommandations
1. **Surveiller l'engagement :** Analyser les employés moins actifs pour identifier les obstacles
2. **Optimiser les formulaires :** Améliorer les formulaires peu utilisés
3. **Maintenir la performance :** Encourager les employés les plus productifs

*Note: Rapport généré sans IA (OpenAI non disponible)*`;
      } else {
        answer = `Basé sur l'analyse de vos données, voici les informations concernant votre question :

**Données analysées :**
${data.totals.entries} soumissions au total pour ${data.totals.uniqueUsers} employés actifs sur ${data.totals.totalUsers}, avec ${data.totals.uniqueForms} formulaires utilisés sur la période ${data.period.label}.

**Principales observations :**
L'employé le plus actif est ${data.userStats[0]?.name || 'N/A'} avec ${data.userStats[0]?.count || 0} soumissions. Le formulaire le plus utilisé est "${data.formStats[0]?.title || 'N/A'}" avec ${data.formStats[0]?.count || 0} soumissions. Le taux d'engagement est de ${((data.totals.uniqueUsers/data.totals.totalUsers)*100).toFixed(1)}% des employés.

**Recommandations :**
Il serait pertinent de surveiller l'engagement des employés moins actifs et d'analyser les formulaires peu utilisés pour identifier des opportunités d'amélioration. Maintenir la performance des employés les plus productifs est également important.`;
      
      // Build system prompt for fallback response (needed for token calculation)
      systemPrompt = buildSystemMessage(conversationContext);
      
      // Calculate estimated tokens for fallback response
      const estimatedTokens = Math.ceil((systemPrompt.length + userPromptForAI.length + answer.length) / 4);
      tokensUsed = estimatedTokens;
      finalUserTokens = calculateUserTokens(estimatedTokens);
      
      console.log('📊 FALLBACK TOKEN CALCULATION:', {
        estimatedTokens,
        finalUserTokens,
        systemPromptLength: systemPrompt.length,
        userPromptLength: userPromptForAI.length,
        answerLength: answer.length,
        calculationFormula: `(${systemPrompt.length} + ${userPromptForAI.length} + ${answer.length}) / 4 = ${estimatedTokens}`,
        userTokensFormula: `(${estimatedTokens} * 2.5) / 100 = ${finalUserTokens}`
      });
    }
    } else {
      try {
        // Build the system prompt with conversation context (now properly initialized)
        systemPrompt = buildSystemMessage(conversationContext);
        
    const completion = await openai.chat.completions.create({
          model: 'gpt-4.1', // Use the specialized GPT-4.1 model
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPromptForAI }
      ],
      max_tokens: 2000, // Increased for more detailed responses
      temperature: 0.3, // Lower temperature for more consistent, analytical responses
      top_p: 0.9,
      frequency_penalty: 0.1,
      presence_penalty: 0.1
    });
        answer = completion.choices && completion.choices[0] && completion.choices[0].message && completion.choices[0].message.content 
      ? completion.choices[0].message.content 
      : 'Désolé, je n\'ai pas pu générer une réponse.';
        tokensUsed = completion.usage && completion.usage.total_tokens ? completion.usage.total_tokens : 0;
        
        // Calculate final user tokens to charge based on actual usage
        // Formula: (actualTokens * 2.5) / 100
        finalUserTokens = Math.ceil((tokensUsed * 2.5) / 100);
        
        console.log('📊 OPENAI TOKEN CALCULATION:', {
          actualTokens: tokensUsed,
          finalUserTokens,
          systemPromptLength: systemPrompt.length,
          userPromptLength: userPromptForAI.length,
          answerLength: answer.length,
          userTokensFormula: `(${tokensUsed} * 2.5) / 100 = ${finalUserTokens}`
        });
        
      } catch (openaiError) {
        console.error('OpenAI error:', openaiError);
        // Fallback en cas d'erreur OpenAI
        if (selectedResponseFormats && selectedResponseFormats.length > 1) {
          answer = generateMultiFormatFallbackResponse(selectedResponseFormats, data);
        } else if (responseFormat === 'table') {
          answer = `Voici un tableau basé sur vos données :

| Employé | Nombre de soumissions | Pourcentage | Formulaire principal |
|---------|----------------------|-------------|---------------------|
${data.userStats.slice(0, 5).map(u => `| ${u.name} | ${u.count} | ${((u.count/data.totals.entries)*100).toFixed(1)}% | ${data.formStats[0]?.title || 'N/A'} |`).join('\n')}

**Période analysée :** ${data.period.label}  
**Total soumissions :** ${data.totals.entries}  
**Employés actifs :** ${data.totals.uniqueUsers}/${data.totals.totalUsers}`;
        } else if (responseFormat === 'pdf') {
          answer = `# Rapport d'analyse - ${data.period.label}

## Introduction

Ce rapport présente une analyse des données de votre agence pour la période ${data.period.label}.

## Analyse des données

### Métriques clés

| Métrique | Valeur | Détail |
|----------|--------|--------|
| Total soumissions | ${data.totals.entries} | Toutes périodes confondues |
| Employés actifs | ${data.totals.uniqueUsers}/${data.totals.totalUsers} | ${((data.totals.uniqueUsers/data.totals.totalUsers)*100).toFixed(1)}% d'engagement |
| Formulaires utilisés | ${data.totals.uniqueForms}/${data.totals.totalForms} | Diversité des outils |

### Performance des employés

| Employé | Soumissions | Pourcentage | Performance |
|---------|-------------|-------------|-------------|
${data.userStats.slice(0, 5).map(u => `| ${u.name} | ${u.count} | ${((u.count/data.totals.entries)*100).toFixed(1)}% | ${u.count > data.totals.entries/data.totals.uniqueUsers ? 'Au-dessus de la moyenne' : 'En dessous de la moyenne'} |`).join('\n')}

## Conclusions et recommandations

### Points positifs
- **Engagement global :** ${((data.totals.uniqueUsers/data.totals.totalUsers)*100).toFixed(1)}% des employés sont actifs
- **Employé le plus performant :** ${data.userStats[0]?.name || 'N/A'} avec ${data.userStats[0]?.count || 0} soumissions
- **Formulaire principal :** "${data.formStats[0]?.title || 'N/A'}" avec ${data.formStats[0]?.count || 0} utilisations

### Recommandations
1. **Surveiller l'engagement :** Analyser les employés moins actifs pour identifier les obstacles
2. **Optimiser les formulaires :** Améliorer les formulaires peu utilisés
3. **Maintenir la performance :** Encourager les employés les plus productifs

*Note: Rapport généré sans IA (OpenAI non disponible)*`;
        } else {
          answer = `Basé sur l'analyse de vos données, voici les informations concernant votre question :

**Données analysées :**
${data.totals.entries} soumissions au total pour ${data.totals.uniqueUsers} employés actifs sur ${data.totals.totalUsers}, avec ${data.totals.uniqueForms} formulaires utilisés sur la période ${data.period.label}.

**Principales observations :**
L'employé le plus actif est ${data.userStats[0]?.name || 'N/A'} avec ${data.userStats[0]?.count || 0} soumissions. Le formulaire le plus utilisé est "${data.formStats[0]?.title || 'N/A'}" avec ${data.formStats[0]?.count || 0} soumissions. Le taux d'engagement est de ${((data.totals.uniqueUsers/data.totals.totalUsers)*100).toFixed(1)}% des employés.

**Recommandations :**
Il serait pertinent de surveiller l'engagement des employés moins actifs et d'analyser les formulaires peu utilisés pour identifier des opportunités d'amélioration. Maintenir la performance des employés les plus productifs est également important.`;
        }
        
        // Build system prompt for error fallback response (needed for token calculation)
        systemPrompt = buildSystemMessage(conversationContext);
        
        // Calculate estimated tokens for error fallback response
        const estimatedTokens = Math.ceil((systemPrompt.length + userPromptForAI.length + answer.length) / 4);
        tokensUsed = estimatedTokens;
        finalUserTokens = calculateUserTokens(estimatedTokens);
        
        console.log('📊 ERROR FALLBACK TOKEN CALCULATION:', {
          estimatedTokens,
          finalUserTokens,
          systemPromptLength: systemPrompt.length,
          userPromptLength: userPromptForAI.length,
          answerLength: answer.length,
          calculationFormula: `(${systemPrompt.length} + ${userPromptForAI.length} + ${answer.length}) / 4 = ${estimatedTokens}`,
          userTokensFormula: `(${estimatedTokens} * 2.5) / 100 = ${finalUserTokens}`
        });
      }
    }
    
    // conversationId and conversationContext are already initialized above
    
    // Initialize file variables to prevent ReferenceError
    let referencedPDFFiles = [];
    let referencedImageFiles = [];
    // systemPrompt is already initialized above
    
    try {
      // Handle scheduled questions differently from regular conversations
      if (isScheduled) {
        console.log('🕐 [SCHEDULED] Processing scheduled question - skipping conversation creation');
        // For scheduled questions, we don't create conversations, just process and return response
        // The response will be saved to scheduledQuestionResponses by the frontend
      } else {
        // Get or create conversation with enhanced context for regular chat
        if (!conversationId) {
        // Create new conversation with enhanced metadata
        const conversationData = {
          directorId: uid,
          agencyId: userData.agencyId,
          title: question.length > 50 ? question.substring(0, 50) + '...' : question,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
          messageCount: 1, // only assistant response (user message handled by client)
          context: {
            lastAnalysisType: responseFormat || 'text',
            lastFormats: selectedResponseFormats || [],
            lastPeriod: filters?.period || 'all',
            lastFormIds: selectedFormats || [],
            dataInsights: {
              totalEntries: data.totals.entries,
              uniqueUsers: data.totals.uniqueUsers,
              uniqueForms: data.totals.uniqueForms,
              hasPDFContent: hasPDFContent
            }
          }
        };
        
        const conversationRef = await adminDb.collection('conversations').add(conversationData);
        conversationId = conversationRef.id;
      } else {
        // Load existing conversation context for continuity
        const conversationDoc = await adminDb.collection('conversations').doc(conversationId).get();
        if (conversationDoc.exists) {
          existingConversationContext = conversationDoc.data();
          
          try {
            // Safely extract previous context without circular references
            const safePreviousContext = existingConversationContext?.context ? {
              lastAnalysisType: existingConversationContext.context.lastAnalysisType || null,
              lastFormats: existingConversationContext.context.lastFormats || [],
              lastPeriod: existingConversationContext.context.lastPeriod || 'all',
              lastFormIds: existingConversationContext.context.lastFormIds || []
            } : null;

            // Ensure data.totals exists and has the expected structure
            const safeDataInsights = {
              totalEntries: data?.totals?.entries || 0,
              uniqueUsers: data?.totals?.uniqueUsers || 0,
              uniqueForms: data?.totals?.uniqueForms || 0,
              hasPDFContent: hasPDFContent || false
            };

            await adminDb.collection('conversations').doc(conversationId).update({
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
              messageCount: admin.firestore.FieldValue.increment(1),
              context: {
                lastAnalysisType: responseFormat || 'text',
                lastFormats: selectedResponseFormats || [],
                lastPeriod: filters?.period || 'all',
                lastFormIds: selectedFormats || [],
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
                console.log('🔄 Triggering summary generation for conversation:', conversationId);
                
                // Get recent messages for summary
                const messagesSnapshot = await adminDb
                  .collection('conversations')
                  .doc(conversationId)
                  .collection('messages')
                  .orderBy('timestamp', 'desc')
                  .limit(20)
                  .get();
                
                const messages = messagesSnapshot.docs.map(doc => {
                  const data = doc.data();
                  return {
                    type: data.type,
                    content: data.content,
                    timestamp: safeToDate(data.timestamp)
                  };
                }).reverse();
                
                // Generate summary
                const summaryContent = await generateConversationSummary(conversationId, messages);
                
                // Update conversation with summary
                await adminDb.collection('conversations').doc(conversationId).update({
                  'summary.content': summaryContent,
                  'summary.lastUpdated': admin.firestore.FieldValue.serverTimestamp(),
                  'summary.messageCountAtSummary': currentMessageCount
                });
                
                console.log('✅ Generated conversation summary for:', conversationId);
              } catch (summaryError) {
                console.error('❌ Failed to generate summary:', summaryError);
                // Don't fail the main request if summary generation fails
              }
            }
          } catch (updateError) {
            console.error('❌ FIREBASE SAVE ERROR - Failed to update conversation context:', updateError);
            console.error('❌ FIREBASE SAVE ERROR - Data being saved:', {
              conversationId,
              context: {
                lastAnalysisType: responseFormat || 'text',
                lastFormats: selectedResponseFormats || [],
                lastPeriod: filters?.period || 'all',
                lastFormIds: selectedFormats || [],
                dataInsights: safeDataInsights,
                previousContext: safePreviousContext
              }
            });
            throw updateError;
          }
        }
      } // End of regular conversation logic
    }

      // Get form titles for the selected forms
      const formTitles = [];
      if (selectedFormats && selectedFormats.length > 0) {
        // Get titles for selected forms
        for (const formId of selectedFormats) {
          const form = data.formsById?.get?.(formId);
          if (form && form.title) {
            formTitles.push(form.title);
          }
        }
      } else {
        // If no forms selected, get all available forms for the agency
        if (data.formsById) {
          for (const [formId, form] of data.formsById.entries()) {
            if (form && form.title) {
              formTitles.push(form.title);
            }
          }
        }
      }

      // Store user message to ensure persistence
      const userMessage = {
        type: 'user',
        content: question,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        meta: {
          // Only include format info if formats are actually selected
          ...(selectedResponseFormats && selectedResponseFormats.length > 0 ? {
            ...(selectedResponseFormats.length > 1 ? {} : { selectedFormat: selectedResponseFormats[0] }),
            selectedFormats: selectedResponseFormats
          } : {}),
          // Always include form info (will show all forms if none selected)
          selectedFormIds: selectedFormats || [],
          selectedFormTitles: formTitles,
          period: filters?.period || 'all',
          formId: filters?.formId || null,
          userId: filters?.userId || null
        }
      };
      
      // Save user message to Firebase and get the saved version (only for regular chat)
      if (!isScheduled) {
        try {
          const userMessageRef = await adminDb.collection('conversations').doc(conversationId).collection('messages').add(userMessage);
          // Get the saved message with its Firebase ID and timestamp
          const savedUserMessageDoc = await userMessageRef.get();
          savedUserMessage = {
            id: savedUserMessageDoc.id,
            type: savedUserMessageDoc.data().type,
            content: savedUserMessageDoc.data().content,
            timestamp: savedUserMessageDoc.data().timestamp,
            meta: savedUserMessageDoc.data().meta
          };
        } catch (saveError) {
          console.error('❌ FIREBASE SAVE ERROR - Failed to save user message:', saveError);
          // Don't throw error, just log it and continue without savedUserMessage
          savedUserMessage = null;
        }
      } else {
        console.log('🕐 [SCHEDULED] Skipping user message save - will be saved to scheduledQuestionResponses by frontend');
        savedUserMessage = null; // No user message for scheduled questions
      }

      // Function to detect which files (PDF and images) are actually referenced in the AI response
      const getReferencedFiles = (aiResponse, allFiles) => {
        if (!aiResponse || !allFiles || allFiles.length === 0) {
          return [];
        }
        
        const responseText = aiResponse.toLowerCase();
        const referencedFiles = [];
        
        // Check each file (PDF or image) to see if it's mentioned in the response
        allFiles.forEach(file => {
          const fileName = file.fileName.toLowerCase();
          const cleanFileName = fileName.replace(/^[0-9-]+-/, '').replace(/\.(pdf|png|jpg|jpeg|gif|bmp|webp|tiff)$/i, '');
          
          // Check various ways the file might be referenced
          const isReferenced = 
            // Direct filename match (exact or partial) - highest priority
            responseText.includes(fileName) ||
            responseText.includes(cleanFileName) ||
            // Check for explicit AI citations with file names
            responseText.includes(`selon le document ${fileName}`) ||
            responseText.includes(`selon le document ${cleanFileName}`) ||
            responseText.includes(`dans le fichier ${fileName}`) ||
            responseText.includes(`dans le fichier ${cleanFileName}`) ||
            responseText.includes(`dans l'image ${fileName}`) ||
            responseText.includes(`dans l'image ${cleanFileName}`) ||
            responseText.includes(`selon l'image ${fileName}`) ||
            responseText.includes(`selon l'image ${cleanFileName}`) ||
            responseText.includes(`d'après ${fileName}`) ||
            responseText.includes(`d'après ${cleanFileName}`) ||
            responseText.includes(`selon ${fileName}`) ||
            responseText.includes(`selon ${cleanFileName}`) ||
            // Check for variations with quotes or brackets
            responseText.includes(`"${fileName}"`) ||
            responseText.includes(`"${cleanFileName}"`) ||
            responseText.includes(`[${fileName}]`) ||
            responseText.includes(`[${cleanFileName}]`) ||
            // Check for citations with "le fichier", "le document", or "l'image"
            responseText.includes(`le fichier ${fileName}`) ||
            responseText.includes(`le fichier ${cleanFileName}`) ||
            responseText.includes(`le document ${fileName}`) ||
            responseText.includes(`le document ${cleanFileName}`) ||
            responseText.includes(`l'image ${fileName}`) ||
            responseText.includes(`l'image ${cleanFileName}`) ||
            // Check for partial matches (common words in filename)
            cleanFileName.split(/[-_\s]+/).some(word => 
              word.length > 3 && responseText.includes(word)
            ) ||
            // Check for document references that might match this file
            (responseText.includes('document') && 
             (fileName.includes('doc') || fileName.includes('rapport') || fileName.includes('rapport'))) ||
            // Check for specific content that might be from this file
            (responseText.includes('fichier') && 
             (fileName.includes('fichier') || fileName.includes('file'))) ||
            // Check for content analysis indicators
            (responseText.includes('contenu') && 
             (fileName.includes('contenu') || fileName.includes('content'))) ||
            // Check for report analysis
            (responseText.includes('rapport') && fileName.includes('rapport')) ||
            // Check for specific field references
            (responseText.includes('dans le document') || responseText.includes('dans le fichier'));
          
          if (isReferenced) {
            referencedFiles.push(file);
          }
        });
        
        // If no specific files are referenced but AI mentions file content, 
        // only include files if the response is very specific about file analysis
        if (referencedFiles.length === 0) {
          const mentionsFileContent = responseText.includes('document') || 
                                    responseText.includes('pdf') || 
                                    responseText.includes('fichier') ||
                                    responseText.includes('image') ||
                                    responseText.includes('contenu') ||
                                    responseText.includes('texte extrait') ||
                                    responseText.includes('analyse du document') ||
                                    responseText.includes('dans le document') ||
                                    responseText.includes('dans le fichier') ||
                                    responseText.includes('dans l\'image');
          
          // Only show all files if AI explicitly mentions analyzing file content
          // and the response is substantial (not just a brief mention)
          if (mentionsFileContent && (
            responseText.includes('analyse') || 
            responseText.includes('extrait') ||
            responseText.includes('contenu du document') ||
            responseText.includes('dans le fichier') ||
            responseText.includes('dans le document') ||
            responseText.includes('dans l\'image') ||
            responseText.includes('selon le document') ||
            responseText.includes('selon l\'image') ||
            responseText.includes('d\'après le fichier') ||
            responseText.includes('d\'après l\'image')
          )) {
            // Additional check: only show all files if the response is substantial
            // (more than just a brief mention of files)
            const substantialAnalysis = responseText.includes('contenu') ||
                                      responseText.includes('information') ||
                                      responseText.includes('données') ||
                                      responseText.includes('résultat') ||
                                      responseText.includes('analyse');
            
            if (substantialAnalysis) {
              return allFiles;
            }
          }
        }
        
        return referencedFiles;
      };
      
      // Get all files (PDF and images) that were analyzed
      const allAnalyzedFiles = (hasPDFContent || hasImageContent) ? data.submissions.flatMap(s => 
        (s.fileAttachments || []).filter(att => 
          (att.fileType === 'application/pdf' || (att.fileType && att.fileType.startsWith('image/'))) && att.extractedText
        ).map(att => ({
          fileName: att.fileName,
          fileType: att.fileType,
          fileSize: att.fileSize,
          downloadUrl: att.downloadUrl,
          fieldId: att.fieldId,
          confidence: att.confidence || null // Fix: ensure confidence is never undefined
        }))
      ) : [];
      
      // Get only the files that are actually referenced in the response
      const referencedFiles = getReferencedFiles(answer, allAnalyzedFiles);
      
      // If no files are explicitly referenced but we have analyzed files, include all of them
      // This ensures that all analyzed files are shown to the user
      const finalReferencedFiles = referencedFiles.length > 0 ? referencedFiles : allAnalyzedFiles;
      
      // Separate PDF and image files for display
      referencedPDFFiles = finalReferencedFiles.filter(f => f.fileType === 'application/pdf');
      referencedImageFiles = finalReferencedFiles.filter(f => f.fileType && f.fileType.startsWith('image/'));
      
      // Log file detection for debugging
      console.log(`📄 FILE DETECTION: Found ${allAnalyzedFiles.length} analyzed files (${allAnalyzedFiles.filter(f => f.fileType === 'application/pdf').length} PDFs, ${allAnalyzedFiles.filter(f => f.fileType && f.fileType.startsWith('image/')).length} images), ${referencedFiles.length} explicitly referenced, ${finalReferencedFiles.length} total displayed`);
      if (allAnalyzedFiles.length > 0) {
        console.log('📄 All analyzed files:', allAnalyzedFiles.map(f => f.fileName));
        console.log('📄 Explicitly referenced files:', referencedFiles.map(f => f.fileName));
        console.log('📄 Final displayed files:', finalReferencedFiles.map(f => f.fileName));
        if (referencedFiles.length === 0 && allAnalyzedFiles.length > 0) {
          console.log('📄 No files detected in response - checking for explicit citations...');
          const responseText = answer.toLowerCase();
          allAnalyzedFiles.forEach(file => {
            const fileName = file.fileName.toLowerCase();
            const cleanFileName = fileName.replace(/^[0-9-]+-/, '').replace(/\.(pdf|png|jpg|jpeg|gif|bmp|webp|tiff)$/i, '');
            const hasExplicitCitation = responseText.includes(`selon le document ${fileName}`) ||
                                      responseText.includes(`dans le fichier ${fileName}`) ||
                                      responseText.includes(`dans l'image ${fileName}`) ||
                                      responseText.includes(`d'après ${fileName}`);
            console.log(`📄 ${file.fileName}: explicit citation = ${hasExplicitCitation}`);
          });
        }
      }

      // Store assistant response with enhanced context and memory
      const assistantMessage = {
        type: 'assistant',
        content: answer || '',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        responseTime: Date.now() - startTime,
        contentType: getContentTypeForResponse(responseFormat, selectedResponseFormats),
        meta: {
          // Only include format info if formats are actually selected
          ...(selectedResponseFormats && selectedResponseFormats.length > 0 ? {
            ...(selectedResponseFormats.length > 1 ? {} : { selectedFormat: selectedResponseFormats[0] }),
            selectedFormats: selectedResponseFormats
          } : {}),
          // Always include form info (will show all forms if none selected)
          selectedFormIds: selectedFormats || [],
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
        // Include only files that are actually referenced in the response
        pdfFiles: referencedPDFFiles,
        imageFiles: referencedImageFiles
      };
      
      // Only save messages to conversations for regular chat, not scheduled questions
      if (!isScheduled) {
        try {
          await adminDb.collection('conversations').doc(conversationId).collection('messages').add(assistantMessage);
        } catch (saveError) {
          console.error('❌ FIREBASE SAVE ERROR - Failed to save assistant message:', saveError);
          throw saveError;
        }
      } else {
        console.log('🕐 [SCHEDULED] Skipping conversation message save - will be saved to scheduledQuestionResponses by frontend');
      }

      // Debug: Log package information
      console.log('🔍 PACKAGE DEBUG:', {
        packageLimit,
        finalUserTokens,
        uid,
        userPackageType: userData.packageType,
        isUnlimited: packageLimit === -1
      });
      
      // Track token consumption in active session (only for limited packages)
      if (packageLimit !== -1 && finalUserTokens > 0) {
        console.log('💰 SESSION TOKEN TRACKING START:', {
          packageLimit,
          finalUserTokens,
          uid
        });
        
        try {
          // Get fresh user data to ensure we have the latest session data
          const freshUserDoc = await adminDb.collection('users').doc(uid).get();
          const freshUserData = freshUserDoc.data();
          
          // Get current active session (using new collection)
          let currentSession = null;
          let sessionDocRef = null;
          
          // Try to get active session from new collection first
          if (freshUserData.currentSubscriptionSessionId) {
            try {
              sessionDocRef = adminDb.collection('subscriptionSessions')
                .doc(freshUserData.currentSubscriptionSessionId);
              const sessionDoc = await sessionDocRef.get();
              
              if (sessionDoc.exists) {
                const sessionData = sessionDoc.data();
                if (sessionData.isActive) {
                  currentSession = { id: sessionDoc.id, ...sessionData };
                }
              }
            } catch (error) {
              console.error('Error fetching session from collection:', error);
            }
          }
          
          if (!currentSession) {
            console.error('❌ No active session found for user:', uid);
            return res.status(400).json({
              error: 'Aucune session active trouvée. Veuillez sélectionner un package.',
              code: 'NO_ACTIVE_SESSION'
            });
          }
          
          console.log('💰 SESSION TOKEN TRACKING - ACTIVE SESSION FOUND:', {
            sessionId: currentSession.id,
            packageType: currentSession.packageType,
            currentTokensUsed: currentSession.usage?.tokensUsed || 0,
            isFromCollection: !!sessionDocRef
          });
          
          // Update the current session's token usage
          const currentUsage = currentSession.usage || {
            tokensUsed: 0,
            formsCreated: 0,
            dashboardsCreated: 0,
            usersAdded: 0
          };
          
          const newTokensUsed = currentUsage.tokensUsed + finalUserTokens;
          
          // Update session in collection (only subscriptionSessions collection is used)
          if (!sessionDocRef) {
            console.error('❌ Session found but no sessionDocRef - session should be in subscriptionSessions collection');
            return res.status(500).json({
              error: 'Erreur de session. Veuillez réessayer.',
              code: 'SESSION_ERROR'
            });
          }
          
          await sessionDocRef.update({
            'usage.tokensUsed': newTokensUsed,
            'usage.lastTokenUsed': admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          
          // Calculate remaining tokens for response
          const sessionPackageLimit = currentSession.packageResources?.tokensIncluded || 0;
          const sessionPayAsYouGoTokens = currentSession.payAsYouGoResources?.tokens || 0;
          
          updatedTokensUsed = newTokensUsed;
          updatedPayAsYouGoTokens = sessionPayAsYouGoTokens;
          
          console.log('✅ SESSION TOKEN TRACKING SUCCESS:', {
            finalUserTokens,
            sessionTokensUsed: newTokensUsed,
            sessionPackageLimit,
            sessionPayAsYouGoTokens,
            remainingTokens: sessionPackageLimit === -1 ? -1 : Math.max(0, (sessionPackageLimit + sessionPayAsYouGoTokens) - newTokensUsed)
          });
        } catch (tokenError) {
          console.error('❌ SESSION TOKEN TRACKING ERROR:', tokenError);
          // Don't fail the request if token tracking fails
        }
      } else {
        console.log('💰 SESSION TOKEN TRACKING SKIPPED:', {
          packageLimit,
          finalUserTokens,
          reason: packageLimit === -1 ? 'unlimited_package' : 'no_tokens_to_deduct'
        });
      }
      
      // Only update conversation metadata for regular chat, not scheduled questions
      if (!isScheduled) {
        try {
          await adminDb.collection('conversations').doc(conversationId).update({
            lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            messageCount: admin.firestore.FieldValue.increment(2)
          });
        } catch (updateError) {
          console.error('❌ FIREBASE SAVE ERROR - Failed to update conversation metadata:', updateError);
          throw updateError;
        }
      } else {
        console.log('🕐 [SCHEDULED] Skipping conversation metadata update');
      }

    } catch (storeError) {
      console.error('Error storing conversation:', storeError);
      // Don't fail the request if conversation storage fails
      // Ensure conversationId is set even if there was an error
      if (!conversationId) {
        conversationId = req.body.conversationId || 'error_' + Date.now();
      }
    }

    // 8. Enhanced response with context
    const response = {
      answer,
      // Only include conversationId for regular chat, not scheduled questions
      ...(isScheduled ? {} : { conversationId: req.body.conversationId || conversationId }),
      userMessage: savedUserMessage, // Include the saved user message (null if save failed)
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
          conversationId: conversationId,
          messageSequence: conversationContext?.messageCount || 2,
          previousAnalysis: conversationContext?.context?.lastAnalysisType || null
        }
      }
    };

    
      
    
    // Log submissions with file content specifically
    const submissionsWithFiles = data.submissions.filter(s => 
      s.fileAttachments?.some(att => 
        (att.fileType === 'application/pdf' || (att.fileType && att.fileType.startsWith('image/'))) && att.extractedText
      )
    );
    
    
    
    // Check if AI mentioned file content in response
    const mentionsFiles = answer.toLowerCase().includes('document') || 
                         answer.toLowerCase().includes('pdf') || 
                         answer.toLowerCase().includes('fichier') ||
                         answer.toLowerCase().includes('image');
    
    // Check if AI analyzed the extracted text
    const analyzesContent = answer.toLowerCase().includes('contenu') || 
                           answer.toLowerCase().includes('texte') || 
                           answer.toLowerCase().includes('information');
    
    
    return res.status(200).json(response);

  } catch (err) {
    const message = err instanceof Error ? err.message : 
                   typeof err === 'string' ? err : 
                   JSON.stringify(err);
    
    console.error('[/api/ai/ask] error:', err);
    
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
const { adminAuth, adminDb } = require('../lib/firebaseAdmin.js');
const admin = require('firebase-admin');
const OpenAI = require('openai');
const { TokenCounter } = require('../lib/tokenCounter.js');

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

// Fonction pour charger et agréger les données
async function loadAndAggregateData(
  agencyId,
  period,
  formId,
  userId,
  selectedFormats
) {
  const { start, end, label } = getPeriodDates(period);

  // Requête de base pour récupérer TOUTES les données de l'agence
  // On récupère par agence puis on filtre/tri en mémoire
  const baseSnapshot = await adminDb
    .collection('formEntries')
    .where('agencyId', '==', agencyId)
    .limit(2000) // Increased limit for complete analysis
    .get();

  // Transformer, filtrer par période et filtres optionnels
  let entries = baseSnapshot.docs.map((doc) => ({
    id: doc.id,
    formId: doc.data().formId || '',
    userId: doc.data().userId || '',
    agencyId: doc.data().agencyId || '',
    submittedAt: doc.data().submittedAt || new Date(),
    answers: doc.data().answers || {}
  }));

  entries = entries.filter(e => {
    const submittedDate = safeToDate(e.submittedAt);
    const inDateRange = submittedDate ? submittedDate >= start && submittedDate <= end : false;
    const matchForm = !formId || e.formId === formId;
    const matchSelectedForms = !selectedFormats || selectedFormats.length === 0 || selectedFormats.includes(e.formId);
    const matchUser = !userId || e.userId === userId;
    return inDateRange && matchForm && matchSelectedForms && matchUser;
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
  const [formsSnapshot, usersSnapshot] = await Promise.all([
    adminDb.collection('forms').where('agencyId', '==', agencyId).get(),
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
    thisWeekSubmissions: detailedSubmissions.filter(s => s.isThisWeek)
  };
  
}

module.exports = async function handler(req, res) {
  
  try {
    const startTime = Date.now(); // Track response time
    
    // Headers CORS complets
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
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
    
    // 1. Vérification du token Firebase
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Token d\'authentification manquant',
        code: 'MISSING_TOKEN'
      });
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    let decodedToken;
    let uid;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
      uid = decodedToken.uid;
    } catch (authError) {
      return res.status(401).json({ 
        error: 'Token invalide ou expiré',
        code: 'INVALID_TOKEN',
        details: authError.message
      });
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

    // 4. Chargement et agrégation des données
    let data;
    try {
      data = await loadAndAggregateData(
        userData.agencyId,
        filters?.period,
        filters?.formId,
        filters?.userId,
        selectedFormats
      );
    } catch (dataError) {
      return res.status(500).json({ 
        error: 'Erreur lors du chargement des données',
        code: 'DATA_LOAD_ERROR',
        details: dataError.message
      });
    }

    // 4.5. Vérification des tokens disponibles
    
    // Build the actual system prompt first (we'll use this for both estimation and AI call)
    const buildSystemMessage = () => {
      const baseRole = `Tu es ARCHA, assistant IA expert en analyse de données d'entreprise.`;
      
      const coreRules = `
RÈGLES FONDAMENTALES :
- Réponds UNIQUEMENT en français
- Utilise UNIQUEMENT les données fournies - ne JAMAIS inventer de données
- Si données insuffisantes, dis-le clairement
- Sois clair, concis et actionnable
- Fournis des insights basés sur les données réelles`;

      const formatInstructions = getFormatInstructions(responseFormat, selectedResponseFormats);
      
      const contextInfo = `
CONTEXTE MÉTIER :
- Agence : ${userData.agencyId}
- Période d'analyse : ${data.period.label}
- Nombre total de soumissions : ${data.totals.entries}
- Employés actifs : ${data.totals.uniqueUsers}/${data.totals.totalUsers}
- Formulaires utilisés : ${data.totals.uniqueForms}/${data.totals.totalForms}

OBJECTIF : Répondre clairement à la question du directeur avec des insights basés sur les données.

${responseFormat === 'table' ? `
EXEMPLE DE TABLEAU CORRECT :
| Employé | Soumissions | Pourcentage |
|---------|-------------|-------------|
| Jean Dupont | 15 | 60% |
| Marie Martin | 10 | 40% |

IMPORTANT : Le tableau DOIT contenir des lignes de données réelles, pas seulement les en-têtes !` : ''}`;

      return `${baseRole}${coreRules}${formatInstructions}${contextInfo}`;
    };

    // Format-specific instructions
    const getFormatInstructions = (responseFormat, selectedResponseFormats) => {
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
    {"label": "Catégorie1", "value": 10, "employee": "Nom Employé", "date": "2024-01-01"},
    {"label": "Catégorie2", "value": 15, "employee": "Nom Employé", "date": "2024-01-02"}
  ],
  "xAxisKey": "label",
  "yAxisKey": "value",
  "dataKey": "value",
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

- OBLIGATOIRE : Inclus TOUJOURS des données réelles dans le tableau "data"
- OBLIGATOIRE : Le graphique doit contenir au minimum 2-3 points de données pour être utile
- OBLIGATOIRE : Utilise des clés appropriées (label, value, employee, date, submissions, etc.)
- OBLIGATOIRE : Inclus des insights et recommandations basés sur les données
- Assure-toi que le graphique répond directement à la question posée avec des données concrètes
- Types de graphiques recommandés :
  * "bar" : pour comparer des catégories
  * "line" : pour montrer des tendances temporelles
  * "pie" : pour montrer des proportions
  * "area" : pour montrer des volumes cumulés
  * "scatter" : pour montrer des corrélations`;
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
    const userTokensToCharge = TokenCounter.getUserTokensToCharge(estimatedTokens, 1.5);
    
    // Calculate package limit based on user's package type
    const getPackageLimit = (packageType) => {
      const limits = {
        starter: 10000,
        standard: 30000,
        premium: 100000,
        custom: -1 // unlimited
      };
      return limits[packageType] || 0;
    };

    // Check subscription status and reset tokens if subscription has ended
    const checkSubscriptionAndResetTokens = async (userData, uid) => {
      const now = new Date();
      const subscriptionEndDate = userData.subscriptionEndDate ? userData.subscriptionEndDate.toDate() : null;
      const lastReset = userData.tokensResetDate ? userData.tokensResetDate.toDate() : null;
      
      // Check if subscription has ended
      if (subscriptionEndDate && now > subscriptionEndDate) {
        try {
          // Subscription has ended - reset all tokens
          await adminDb.collection('users').doc(uid).update({
            tokensUsedMonthly: 0,
            payAsYouGoTokens: 0, // Clear pay-as-you-go tokens when subscription ends
            subscriptionStatus: 'expired',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log(`⏰ Subscription expired for user ${uid} - all tokens cleared`);
          return { tokensUsed: 0, payAsYouGoTokens: 0, subscriptionExpired: true };
        } catch (resetError) {
          console.error('Error clearing expired subscription tokens:', resetError);
        }
      }
      
      // Check if monthly tokens need to be reset (only if subscription is active)
      if (!subscriptionEndDate || now <= subscriptionEndDate) {
        if (!lastReset || lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear()) {
          try {
            const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            await adminDb.collection('users').doc(uid).update({
              tokensUsedMonthly: 0,
              tokensResetDate: nextMonth,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`🔄 Monthly tokens reset for user ${uid}`);
            return { 
              tokensUsed: 0, 
              payAsYouGoTokens: userData.payAsYouGoTokens || 0, 
              subscriptionExpired: false 
            };
          } catch (resetError) {
            console.error('Error resetting monthly tokens:', resetError);
          }
        }
      }
      
      return { 
        tokensUsed: userData.tokensUsedMonthly || 0, 
        payAsYouGoTokens: userData.payAsYouGoTokens || 0, 
        subscriptionExpired: false 
      };
    };
    
    const packageLimit = getPackageLimit(userData.package);
    
    // Check subscription status and reset tokens if needed
    const tokenStatus = await checkSubscriptionAndResetTokens(userData, uid);
    const currentTokensUsed = tokenStatus.tokensUsed;
    const payAsYouGoTokens = tokenStatus.payAsYouGoTokens;
    const subscriptionExpired = tokenStatus.subscriptionExpired;
    
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

    // Analyze content types present in the data
    const hasPDFContent = data.submissions.some(s => 
      s.fileAttachments?.some(att => att.fileType === 'application/pdf' && att.extractedText)
    ) || data.submissions.some(s => 
      Object.values(s.answers).some(value => 
        value && typeof value === 'object' && value.uploaded && value.fileName && value.extractedText
      )
    );

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

    // Now build the actual system prompt with hasPDFContent available
    const systemPrompt = buildSystemMessage();


    // Build simple submissions data
    const buildSubmissionsData = (submissions) => {
      return submissions.map((s, index) => {
        const fieldSummary = Object.entries(s.answers).map(([fieldLabel, value]) => {
          const displayValue = value !== null && value !== undefined ? 
            (typeof value === 'boolean' ? (value ? 'Oui' : 'Non') : String(value)) : 
            'Non renseigné';
          return `${fieldLabel}: ${displayValue}`;
        }).join(' | ');
        
        return `SOUMISSION ${index + 1}: ${s.employeeName} | ${s.formTitle} | ${s.submittedDate}
${fieldSummary}`;
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

      return `${questionText}\n\n${dataOverview}\n\n${submissions}${tableFormatReminder}`;
    };

    // Use the complete user message for the AI call
    const userPromptForAI = buildUserMessage();


    // 6. Appel OpenAI
    let answer = '';
    let tokensUsed = 0;
    let finalUserTokens = 0;
    
    if (!process.env.OPENAI_API_KEY) {
      // Fallback si OpenAI n'est pas configuré
      if (responseFormat === 'table') {
        answer = `Voici un tableau basé sur vos données :

| Employé | Nombre de soumissions | Pourcentage | Formulaire principal |
|---------|----------------------|-------------|---------------------|
${data.userStats.slice(0, 5).map(u => `| ${u.name} | ${u.count} | ${((u.count/data.totals.entries)*100).toFixed(1)}% | ${data.formStats[0]?.title || 'N/A'} |`).join('\n')}

**Période analysée :** ${data.period.label}  
**Total soumissions :** ${data.totals.entries}  
**Employés actifs :** ${data.totals.uniqueUsers}/${data.totals.totalUsers}

*Note: Réponse générée sans IA (OpenAI non disponible)*`;
      } else {
        answer = `Basé sur l'analyse de vos données, voici les informations concernant votre question :

**Données analysées :**
${data.totals.entries} soumissions au total pour ${data.totals.uniqueUsers} employés actifs sur ${data.totals.totalUsers}, avec ${data.totals.uniqueForms} formulaires utilisés sur la période ${data.period.label}.

**Principales observations :**
L'employé le plus actif est ${data.userStats[0]?.name || 'N/A'} avec ${data.userStats[0]?.count || 0} soumissions. Le formulaire le plus utilisé est "${data.formStats[0]?.title || 'N/A'}" avec ${data.formStats[0]?.count || 0} soumissions. Le taux d'engagement est de ${((data.totals.uniqueUsers/data.totals.totalUsers)*100).toFixed(1)}% des employés.

**Recommandations :**
Il serait pertinent de surveiller l'engagement des employés moins actifs et d'analyser les formulaires peu utilisés pour identifier des opportunités d'amélioration. Maintenir la performance des employés les plus productifs est également important.

*Note: Réponse générée sans IA (OpenAI non disponible)*`;
      }
    } else {
      try {
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
        finalUserTokens = TokenCounter.getUserTokensToCharge(tokensUsed, 1.5);
      } catch (openaiError) {
        console.error('OpenAI error:', openaiError);
        // Fallback en cas d'erreur OpenAI
        if (responseFormat === 'table') {
          answer = `Voici un tableau basé sur vos données :

| Employé | Nombre de soumissions | Pourcentage | Formulaire principal |
|---------|----------------------|-------------|---------------------|
${data.userStats.slice(0, 5).map(u => `| ${u.name} | ${u.count} | ${((u.count/data.totals.entries)*100).toFixed(1)}% | ${data.formStats[0]?.title || 'N/A'} |`).join('\n')}

**Période analysée :** ${data.period.label}  
**Total soumissions :** ${data.totals.entries}  
**Employés actifs :** ${data.totals.uniqueUsers}/${data.totals.totalUsers}

*Note: Réponse générée sans IA (OpenAI non disponible)*`;
        } else {
          answer = `Basé sur l'analyse de vos données, voici les informations concernant votre question :

**Données analysées :**
${data.totals.entries} soumissions au total pour ${data.totals.uniqueUsers} employés actifs sur ${data.totals.totalUsers}, avec ${data.totals.uniqueForms} formulaires utilisés sur la période ${data.period.label}.

**Principales observations :**
L'employé le plus actif est ${data.userStats[0]?.name || 'N/A'} avec ${data.userStats[0]?.count || 0} soumissions. Le formulaire le plus utilisé est "${data.formStats[0]?.title || 'N/A'}" avec ${data.formStats[0]?.count || 0} soumissions. Le taux d'engagement est de ${((data.totals.uniqueUsers/data.totals.totalUsers)*100).toFixed(1)}% des employés.

**Recommandations :**
Il serait pertinent de surveiller l'engagement des employés moins actifs et d'analyser les formulaires peu utilisés pour identifier des opportunités d'amélioration. Maintenir la performance des employés les plus productifs est également important.

*Note: Réponse générée sans IA (OpenAI non disponible)*`;
        }
      }
    }

    // 7. Enhanced conversation context and memory system
    
    // Initialize conversationId to ensure it's always defined
      let conversationId = req.body.conversationId;
    let conversationContext = null;
    
    try {
      // Get or create conversation with enhanced context
      
      if (!conversationId) {
        // Create new conversation with enhanced metadata
        const conversationData = {
          directorId: uid,
          agencyId: userData.agencyId,
          title: question.length > 50 ? question.substring(0, 50) + '...' : question,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
          messageCount: 2, // user message + assistant response
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
          conversationContext = conversationDoc.data();
          
          // Update conversation with new context
          await adminDb.collection('conversations').doc(conversationId).update({
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
            messageCount: admin.firestore.FieldValue.increment(2),
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
              },
              previousContext: conversationContext?.context || null
            }
          });
        }
      }

      // Store user message with enhanced context
      const userMessage = {
        type: 'user',
        content: question || '',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        filters: req.body.filters || {},
        context: {
          selectedFormats: selectedResponseFormats || [],
          responseFormat: responseFormat || 'text',
          conversationId: conversationId,
          previousContext: conversationContext?.context || null
        }
      };

      // Store assistant response with enhanced context and memory
      const assistantMessage = {
        type: 'assistant',
        content: answer || '',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        responseTime: Date.now() - startTime,
        meta: {
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
          model: 'gpt-4.1',
          responseFormat: responseFormat || 'text',
          selectedFormats: selectedResponseFormats || [],
          conversationContext: {
            conversationId: conversationId,
            messageSequence: conversationContext?.messageCount || 2,
            previousAnalysis: conversationContext?.context?.lastAnalysisType || null,
            dataEvolution: {
              previousEntries: conversationContext?.context?.dataInsights?.totalEntries || 0,
              currentEntries: data.totals?.entries || 0,
              entriesChange: (data.totals?.entries || 0) - (conversationContext?.context?.dataInsights?.totalEntries || 0)
            }
          }
        }
      };

      // Add messages to conversation subcollection
      await adminDb.collection('conversations').doc(conversationId).collection('messages').add(userMessage);
      await adminDb.collection('conversations').doc(conversationId).collection('messages').add(assistantMessage);

      // Deduct tokens from user's account (only for limited packages)
      if (packageLimit !== -1 && finalUserTokens > 0) {
        try {
          // Get fresh user data to ensure we have the latest token counts
          const freshUserDoc = await adminDb.collection('users').doc(uid).get();
          const freshUserData = freshUserDoc.data();
          const freshTokensUsed = freshUserData.tokensUsedMonthly || 0;
          const freshPayAsYouGoTokens = freshUserData.payAsYouGoTokens || 0;
          
          let newTokensUsed = freshTokensUsed;
          let newPayAsYouGoTokens = freshPayAsYouGoTokens;
          
          // Calculate how many tokens to deduct from package vs pay-as-you-go
          const packageTokensRemaining = packageLimit - freshTokensUsed;
          
          if (finalUserTokens <= packageTokensRemaining) {
            // All tokens can be deducted from package
            newTokensUsed = freshTokensUsed + finalUserTokens;
          } else {
            // Deduct remaining package tokens first, then from pay-as-you-go
            const packageTokensToDeduct = Math.max(0, packageTokensRemaining);
            const payAsYouGoTokensToDeduct = finalUserTokens - packageTokensToDeduct;
            
            newTokensUsed = freshTokensUsed + packageTokensToDeduct;
            newPayAsYouGoTokens = Math.max(0, freshPayAsYouGoTokens - payAsYouGoTokensToDeduct);
          }
          
          await adminDb.collection('users').doc(uid).update({
            tokensUsedMonthly: newTokensUsed,
            payAsYouGoTokens: newPayAsYouGoTokens,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        } catch (tokenError) {
          console.error('❌ Error deducting tokens:', tokenError);
          // Don't fail the request if token deduction fails
        }
      }

      // Update conversation metadata
      await adminDb.collection('conversations').doc(conversationId).update({
        lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        messageCount: admin.firestore.FieldValue.increment(2)
      });

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
      conversationId: req.body.conversationId || conversationId,
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
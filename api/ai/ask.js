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

// Fonction pour charger et agréger les données
async function loadAndAggregateData(
  agencyId,
  period,
  formId,
  userId,
  selectedFormats
) {
  const { start, end, label } = getPeriodDates(period);

  // Requête de base MINIMALE pour éviter les index composites
  // On récupère par agence puis on filtre/tri en mémoire
  const baseSnapshot = await adminDb
    .collection('formEntries')
    .where('agencyId', '==', agencyId)
    .limit(500)
    .get();

  // Transformer, filtrer par période et filtres optionnels
  let entries = baseSnapshot.docs.map((doc) => ({
    id: doc.id,
    formId: doc.data().formId || '',
    userId: doc.data().userId || '',
    agencyId: doc.data().agencyId || '',
    submittedAt: doc.data().submittedAt ? doc.data().submittedAt.toDate() : new Date(),
    answers: doc.data().answers || {}
  }));

  entries = entries.filter(e => {
    const inDateRange = e.submittedAt >= start && e.submittedAt <= end;
    const matchForm = !formId || e.formId === formId;
    const matchSelectedForms = !selectedFormats || selectedFormats.length === 0 || selectedFormats.includes(e.formId);
    const matchUser = !userId || e.userId === userId;
    return inDateRange && matchForm && matchSelectedForms && matchUser;
  });

  // Trier par date desc et limiter à 100 après filtrage
  entries.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
  entries = entries.slice(0, 100);

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
    const date = entry.submittedAt.toISOString().split('T')[0];
    timeline[date] = (timeline[date] || 0) + 1;
  });

  // Préparer les données détaillées des soumissions pour l'IA (limité à 50 pour éviter les timeouts)
  const limitedEntries = entries.slice(0, 50);
  
  // Debug: Log raw Firebase entries
  console.log('\n=== FIREBASE ENTRIES DEBUG ===');
  console.log('Total entries from Firebase:', entries.length);
  console.log('Limited entries for AI:', limitedEntries.length);
  
  limitedEntries.forEach((entry, index) => {
    console.log(`\n--- FIREBASE ENTRY ${index + 1} ---`);
    console.log('Entry ID:', entry.id);
    console.log('Entry answers:', JSON.stringify(entry.answers, null, 2));
    console.log('Entry fileAttachments:', entry.fileAttachments);
    console.log('Entry submittedAt:', entry.submittedAt);
  });
  
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
    
    const result = {
      id: entry.id,
      formTitle: form ? form.title : `Formulaire ${entry.formId}`,
      employeeName: user ? user.name : `Utilisateur ${entry.userId}`,
      employeeEmail: user ? user.email : 'Email non disponible',
      submittedAt: entry.submittedAt.toISOString(),
      submittedDate: entry.submittedAt.toLocaleDateString('fr-FR'),
      submittedTime: entry.submittedAt.toLocaleTimeString('fr-FR'),
      answers: answersWithLabels,
      fieldMapping: fieldMapping, // Include field mapping for proper file reference
      fileAttachments: entry.fileAttachments || [], // Include file attachments
      isToday: entry.submittedAt.toDateString() === new Date().toDateString(),
      isThisWeek: entry.submittedAt >= start && entry.submittedAt <= end
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
  
  // Debug: Log final data structure sent to AI
  console.log('\n=== FINAL DATA STRUCTURE FOR AI ===');
  console.log('All submissions sent to AI:', JSON.stringify(detailedSubmissions, null, 2));
}

module.exports = async function handler(req, res) {
  console.log('=== AI ASK HANDLER START ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Environment check:', {
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID ? '✅ Set' : '❌ Missing',
    firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL ? '✅ Set' : '❌ Missing',
    firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY ? '✅ Set' : '❌ Missing',
    openaiKey: process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing'
  });
  
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
      console.log('Handling OPTIONS request');
      return res.status(204).end();
    }

    if (req.method !== 'POST') {
      console.log('Method not allowed:', req.method);
      return res.status(405).json({ error: 'Méthode non autorisée' });
    }

    console.log('Processing POST request...');
    
    // 1. Vérification du token Firebase
    console.log('Step 1: Checking Firebase token...');
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Missing or invalid auth header');
      return res.status(401).json({ 
        error: 'Token d\'authentification manquant',
        code: 'MISSING_TOKEN'
      });
    }

    console.log('Auth header found, verifying token...');
    const idToken = authHeader.split('Bearer ')[1];
    
    let decodedToken;
    let uid;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
      uid = decodedToken.uid;
      console.log('Token verified for user:', uid);
    } catch (authError) {
      console.error('Token verification failed:', authError);
      return res.status(401).json({ 
        error: 'Token invalide ou expiré',
        code: 'INVALID_TOKEN',
        details: authError.message
      });
    }

    // 2. Vérification du profil utilisateur
    console.log('Step 2: Checking user profile...');
    let userDoc;
    let userData;
    
    try {
      userDoc = await adminDb.collection('users').doc(uid).get();
      console.log('User document retrieved successfully');
    } catch (firestoreError) {
      console.error('Firestore error when getting user document:', firestoreError);
      return res.status(500).json({ 
        error: 'Erreur de connexion à la base de données',
        code: 'FIRESTORE_ERROR',
        details: firestoreError.message
      });
    }
    
    if (!userDoc.exists) {
      console.log('User document not found for uid:', uid);
      return res.status(404).json({ 
        error: 'Profil utilisateur non trouvé',
        code: 'USER_NOT_FOUND'
      });
    }

    userData = userDoc.data();
    if (!userData) {
      console.log('User data is null for uid:', uid);
      return res.status(404).json({ 
        error: 'Données utilisateur non trouvées',
        code: 'USER_DATA_MISSING'
      });
    }

    console.log('User data found:', { 
      role: userData.role, 
      agencyId: userData.agencyId,
      package: userData.package,
      tokensUsedMonthly: userData.tokensUsedMonthly,
      payAsYouGoTokens: userData.payAsYouGoTokens
    });
    
    if (userData.role !== 'directeur') {
      console.log('User role is not directeur:', userData.role);
      return res.status(403).json({ 
        error: 'Accès réservé aux directeurs',
        code: 'INSUFFICIENT_ROLE'
      });
    }

    if (!userData.agencyId) {
      console.log('User agencyId is missing');
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

    console.log('Request body parameters:', {
      question: question.substring(0, 100) + '...',
      filters,
      selectedFormats,
      responseFormat
    });

    // 4. Chargement et agrégation des données
    console.log('Step 4: Loading and aggregating data...');
    console.log('Filters:', { period: filters?.period, formId: filters?.formId, userId: filters?.userId });
    
    let data;
    try {
      data = await loadAndAggregateData(
        userData.agencyId,
        filters?.period,
        filters?.formId,
        filters?.userId,
        selectedFormats
      );
      console.log('Data loaded successfully:', {
        entries: data.totals.entries,
        users: data.totals.uniqueUsers,
        forms: data.totals.uniqueForms
      });
    } catch (dataError) {
      console.error('Error loading data:', dataError);
      return res.status(500).json({ 
        error: 'Erreur lors du chargement des données',
        code: 'DATA_LOAD_ERROR',
        details: dataError.message
      });
    }

    // 4.5. Vérification des tokens disponibles
    console.log('Step 4.5: Checking available tokens...');
    
    // Estimate tokens needed for this request
    // Create simplified versions of the prompts for estimation
    const estimatedSystemPrompt = `Tu es ARCHA, assistant IA spécialisé dans l'analyse de données de formulaires d'entreprise.
RÈGLES :
- Réponds UNIQUEMENT en français
- Utilise UNIQUEMENT les données fournies
- Ne JAMAIS inventer de données
- Si données insuffisantes, dis-le clairement

ANALYSE :
- Analyse les données fournies
- Identifie les tendances et patterns
- Fournis des insights actionables
- Propose des recommandations concrètes

RÉPONSE :
- Structure claire et professionnelle
- Utilise des émojis appropriés
- Inclus des métriques précises
- Référence les données sources`;

    const estimatedUserPrompt = `Question : "${question}"

RÉSUMÉ DES DONNÉES :
- Total soumissions : ${data.totals.entries}
- Employés actifs : ${data.totals.uniqueUsers}/${data.totals.totalUsers}
- Formulaires utilisés : ${data.totals.uniqueForms}/${data.totals.totalForms}
- Période : ${data.period.label}

DONNÉES DÉTAILLÉES :
${data.submissions.slice(0, 5).map(s => `- ${s.employeeName}: ${s.formTitle}`).join('\n')}`;

    const estimatedTokens = TokenCounter.getTotalEstimatedTokens(estimatedSystemPrompt, estimatedUserPrompt, 800);
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
    
    console.log('Token estimation:', {
      estimatedTokens,
      userTokensToCharge,
      currentUsage: currentTokensUsed,
      payAsYouGoTokens: payAsYouGoTokens,
      packageType: userData.package,
      packageLimit: packageLimit,
      subscriptionExpired: subscriptionExpired
    });
    
    // Check if user has enough tokens (including pay-as-you-go tokens)
    const totalAvailableTokens = packageLimit === -1 ? -1 : packageLimit + payAsYouGoTokens;
    
    // Skip token check for unlimited packages
    if (packageLimit !== -1 && currentTokensUsed + userTokensToCharge > totalAvailableTokens) {
      console.log('Insufficient tokens:', {
        currentUsage: currentTokensUsed,
        needed: userTokensToCharge,
        available: totalAvailableTokens,
        packageLimit,
        payAsYouGoTokens
      });
      
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

    // Debug: Log ALL data being sent to AI
    console.log('=== COMPLETE DATA BEING SENT TO AI ===');
    console.log('Total submissions:', data.submissions.length);
    console.log('Today submissions:', data.todaySubmissions.length);
    console.log('Period:', data.period);
    console.log('Totals:', data.totals);
    console.log('User stats:', data.userStats);
    console.log('Form stats:', data.formStats);
    console.log('Timeline:', data.timeline);
    
    console.log('\n=== ALL SUBMISSIONS DETAILS ===');
    data.submissions.forEach((submission, index) => {
      console.log(`\nSUBMISSION ${index + 1}:`);
      console.log('- ID:', submission.id);
      console.log('- Employee:', submission.employeeName, '(', submission.employeeEmail, ')');
      console.log('- Form:', submission.formTitle);
      console.log('- Date:', submission.submittedDate, 'at', submission.submittedTime);
      console.log('- Is Today:', submission.isToday);
      console.log('- Answers:', JSON.stringify(submission.answers, null, 2));
    });
    
    console.log('\n=== TODAY SUBMISSIONS DETAILS ===');
    data.todaySubmissions.forEach((submission, index) => {
      console.log(`\nTODAY SUBMISSION ${index + 1}:`);
      console.log('- ID:', submission.id);
      console.log('- Employee:', submission.employeeName, '(', submission.employeeEmail, ')');
      console.log('- Form:', submission.formTitle);
      console.log('- Time:', submission.submittedTime);
      console.log('- Answers:', JSON.stringify(submission.answers, null, 2));
    });
    
    console.log('\n=== FORMS DATA ===');
    const formsSnapshot = await adminDb.collection('forms').where('agencyId', '==', userData.agencyId).get();
    formsSnapshot.docs.forEach((doc, index) => {
      const formData = doc.data();
      console.log(`\nFORM ${index + 1}:`);
      console.log('- ID:', doc.id);
      console.log('- Title:', formData.title);
      console.log('- Fields:', JSON.stringify(formData.fields, null, 2));
      console.log('- Assigned To:', formData.assignedTo);
    });
    
    console.log('=== END DATA LOGGING ===\n');

    // 5. Context-Aware System Message Construction
    console.log('Step 5: Building context-aware system message...');

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

    // Build context-aware system message (inspired by Cursor/ChatGPT approach)
    const buildSystemMessage = () => {
      const baseRole = `Tu es ARCHA, assistant IA spécialisé dans l'analyse de données de formulaires d'entreprise.`;
      
      const coreRules = `
RÈGLES :
- Réponds UNIQUEMENT en français
- Utilise UNIQUEMENT les données fournies
- Ne JAMAIS inventer de données
- Si données insuffisantes, dis-le clairement`;

      const analysisStrategy = `
STRATÉGIE D'ANALYSE :
- Si l'utilisateur demande des statistiques spécifiques : fournis exactement ce qu'il demande
- Si l'utilisateur pose une question générale ET a sélectionné le format statistique : propose des graphiques pertinents
- Si l'utilisateur pose une question générale SANS format spécifique : réponds de manière textuelle structurée
- Analyse les champs de formulaire pour identifier les données quantifiables quand approprié
- Suggère des visualisations seulement si le format statistique est demandé

RECOMMANDATIONS DE GRAPHIQUES :
- Données temporelles (dates, mois, années) → Graphique en ligne (line)
- Comparaisons entre catégories → Graphique en barres (bar)
- Proportions/parts d'un tout → Graphique en secteurs (pie)
- Évolution continue dans le temps → Graphique en aires (area)
- Corrélations entre deux variables → Graphique de dispersion (scatter)
- Données numériques simples → Graphique en barres (bar) par défaut
- Analysez toujours le type de données pour choisir le graphique le plus approprié`;

      const fileInstructions = (hasPDFContent && (responseFormat === 'pdf' || (selectedResponseFormats && selectedResponseFormats.includes('pdf')))) ? `
FICHIERS :
- Analyse le contenu des fichiers de manière structurée
- Identifie les informations clés (dates, montants, noms, thèmes)
- Fournis un résumé clair et structuré du contenu des fichiers
- Référence les fichiers avec [FICHIER: nom_du_fichier.ext] [METADATA: {...}] pour téléchargement
- METADATA doit contenir : fileName, fileType, fileSize, downloadUrl, storagePath
- Utilise des noms de fichiers conviviaux (sans URLs techniques)
- Présente les fichiers référencés à la fin de ta réponse, pas dans le texte principal` : '';

      const formatInstructions = getFormatInstructions(responseFormat, selectedResponseFormats);
      
      const contextInfo = `
CONTEXTE : Agence ${userData.agencyId} | Période ${data.period.label} | ${new Date().toLocaleDateString('fr-FR')}`;

      return `${baseRole}${coreRules}${analysisStrategy}${fileInstructions}${formatInstructions}${contextInfo}`;
    };

    // Format-specific instructions (clean and focused)
    const getFormatInstructions = (responseFormat, selectedResponseFormats) => {
      switch (responseFormat) {
        case 'stats':
          return `
FORMAT STATISTIQUES :
Retourne un graphique JSON avec cette structure :
\`\`\`json
{
  "type": "bar|line|pie|area|scatter",
  "title": "Titre descriptif",
  "data": [...],
  "xAxisKey": "label",
  "yAxisKey": "value",
  "dataKey": "value",
  "colors": ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"],
  "options": {"showLegend": true}
}
\`\`\`
+ Explication textuelle détaillée du graphique choisi et pourquoi il est approprié pour ces données.`;

        case 'table':
          return `
FORMAT TABLEAU :
Tableau markdown structuré + explication textuelle.
Référence fichiers avec [FICHIER: nom_du_fichier.ext]`;

        case 'pdf':
          return `
FORMAT PDF :
Contenu markdown structuré avec titres (# ## ###), listes et sections.
Référence fichiers avec [FICHIER: nom_du_fichier.ext]`;

        case 'multi-format':
          return `
FORMAT MULTI-FORMAT :
Retourne une combinaison des formats sélectionnés :
${selectedResponseFormats?.includes('stats') ? '- Graphique JSON avec explication' : ''}
${selectedResponseFormats?.includes('table') ? '- Tableau markdown avec explication' : ''}
${selectedResponseFormats?.includes('pdf') ? '- Contenu PDF structuré' : ''}
Organise les formats de manière logique.`;

        default:
          return `
FORMAT TEXTE LIBRE :
Réponse structurée + graphiques statistiques automatiques si appropriés.
- Analyse les données et propose automatiquement le type de graphique le plus adapté
- Inclus une explication de pourquoi ce type de graphique est choisi
- Ne référence PAS les fichiers avec [FICHIER: ...] sauf si explicitement demandé`;
      }
    };

    const systemPrompt = buildSystemMessage();

    // Enhanced user message with structured data
    const buildUserMessage = () => {
      const questionText = `Question : "${question}"`;
      
      const summary = `
RÉSUMÉ DES DONNÉES :
- Total soumissions : ${data.totals.entries}
- Employés actifs : ${data.totals.uniqueUsers}/${data.totals.totalUsers}
- Formulaires utilisés : ${data.totals.uniqueForms}/${data.totals.totalForms}
- Période : ${data.period.label}`;

      const submissions = data.submissions.length > 0 ? 
        buildSubmissionsData(data.submissions, hasPDFContent) : 
        'AUCUNE SOUMISSION TROUVÉE';

      return `${questionText}\n\n${summary}\n\n${submissions}`;
    };

    // Build submissions data with PDF content handling
    const buildSubmissionsData = (submissions, hasPDFContent) => {
      return submissions.map((s, index) => {
        const answersText = Object.entries(s.answers).map(([fieldLabel, value]) => {
          // Handle file attachments - check for uploaded file data
          if (value && typeof value === 'object' && value.uploaded && value.fileName) {
            // Include file metadata for proper download/view functionality
            const fileMetadata = {
              fileName: value.fileName,
              fileType: value.fileType,
              fileSize: value.fileSize,
              downloadUrl: value.downloadUrl,
              storagePath: value.storagePath
            };
            const cleanFileName = value.fileName.replace(/^[0-9-]+-/, '').replace(/\.pdf$/i, '');
            return `    • ${fieldLabel}: [FICHIER: ${value.fileName}] [METADATA: ${JSON.stringify(fileMetadata)}]`;
          }
          
          // Handle other object values (like arrays, etc.) - but avoid showing [object Object]
          if (value && typeof value === 'object' && !value.uploaded) {
            // If it's an array, show it properly
            if (Array.isArray(value)) {
              return `    • ${fieldLabel}: ${value.join(', ')}`;
            }
            // If it's an object with meaningful properties, show them
            if (value && Object.keys(value).length > 0) {
              const meaningfulProps = Object.entries(value)
                .filter(([key, val]) => val !== null && val !== undefined && val !== '')
                .map(([key, val]) => `${key}: ${val}`)
                .join(', ');
              return `    • ${fieldLabel}: ${meaningfulProps || 'Données complexes'}`;
            }
            return `    • ${fieldLabel}: Données complexes`;
          }
          
          const displayValue = value !== null && value !== undefined ? 
            (typeof value === 'boolean' ? (value ? 'Oui' : 'Non') : String(value)) : 
            'Non renseigné';
          return `    • ${fieldLabel}: ${displayValue}`;
        }).join('\n');
        
        // Add file content if available (PDFs and other extractable files)
        const fileContent = hasPDFContent ? (() => {
          const fileContents = [];
          
          // Check fileAttachments array
          if (s.fileAttachments) {
            s.fileAttachments
              .filter(att => att.extractedText)
              .forEach(att => {
                const fileIcon = att.fileType === 'application/pdf' ? '📄' : '📎';
                const fileTypeLabel = att.fileType === 'application/pdf' ? 'FICHIER PDF' : 'FICHIER JOINT';
                const cleanFileName = att.fileName.replace(/^[0-9-]+-/, '').replace(/\.pdf$/i, '');
                fileContents.push(`    ${fileIcon} ${fileTypeLabel}: "${cleanFileName}" (${att.fileSize ? (att.fileSize / 1024).toFixed(1) + ' KB' : 'Taille inconnue'})\n    RÉFÉRENCE: [FICHIER: ${att.fileName}] [METADATA: ${JSON.stringify({
                  fileName: att.fileName,
                  fileType: att.fileType,
                  fileSize: att.fileSize,
                  downloadUrl: att.downloadUrl,
                  storagePath: att.storagePath
                })}]`);
              });
          }
          
          // Check answers object for file data with extracted text
          Object.entries(s.answers).forEach(([fieldLabel, value]) => {
            if (value && typeof value === 'object' && value.uploaded && value.fileName && value.extractedText) {
              const fileIcon = value.fileType === 'application/pdf' ? '📄' : '📎';
              const fileTypeLabel = value.fileType === 'application/pdf' ? 'FICHIER PDF' : 'FICHIER JOINT';
              const cleanFileName = value.fileName.replace(/^[0-9-]+-/, '').replace(/\.pdf$/i, '');
              fileContents.push(`    ${fileIcon} ${fileTypeLabel}: "${cleanFileName}" - Champ: ${fieldLabel} (${value.fileSize ? (value.fileSize / 1024).toFixed(1) + ' KB' : 'Taille inconnue'})\n    RÉFÉRENCE: [FICHIER: ${value.fileName}] [METADATA: ${JSON.stringify({
                fileName: value.fileName,
                fileType: value.fileType,
                fileSize: value.fileSize,
                downloadUrl: value.downloadUrl,
                storagePath: value.storagePath
              })}]`);
            }
          });
          
          return fileContents.join('\n\n');
        })() : '';
        
        return `SOUMISSION ${index + 1}:
- Employé: ${s.employeeName} (${s.employeeEmail})
- Formulaire: "${s.formTitle}"
- Date: ${s.submittedDate} à ${s.submittedTime}${s.isToday ? ' (AUJOURD\'HUI)' : ''}
- Réponses:
${answersText}${fileContent ? '\n\n' + fileContent : ''}`;
      }).join('\n\n');
    };

    const userPrompt = buildUserMessage();


    // 6. Appel OpenAI
    console.log('Step 6: Generating AI response...');
    let answer = '';
    let tokensUsed = 0;
    let finalUserTokens = 0;
    
    if (!process.env.OPENAI_API_KEY) {
      console.log('OpenAI not configured, using fallback response');
      // Fallback si OpenAI n'est pas configuré
      answer = `📊 Résumé ${data.period.label}

• Entrées analysées: ${data.totals.entries}
• Employés actifs: ${data.totals.uniqueUsers}/${data.totals.totalUsers}
• Formulaires utilisés: ${data.totals.uniqueForms}/${data.totals.totalForms}

Top employés:
${data.userStats.map(u => `• ${u.name}: ${u.count} réponses`).join('\n') || '• Aucun'}

Top formulaires:
${data.formStats.map(f => `• ${f.title}: ${f.count} réponses`).join('\n') || '• Aucun'}

📅 SOUMISSIONS DÉTAILLÉES D'AUJOURD'HUI (${new Date().toLocaleDateString('fr-FR')}):
${data.todaySubmissions.length > 0 ? data.todaySubmissions.map((s, index) => {
  const answersText = Object.entries(s.answers).map(([fieldLabel, value]) => {
    const displayValue = value !== null && value !== undefined ? 
      (typeof value === 'boolean' ? (value ? 'Oui' : 'Non') : String(value)) : 
      'Non renseigné';
    return `    • ${fieldLabel}: ${displayValue}`;
  }).join('\n');
  
  return `SOUMISSION ${index + 1}:
• Employé: ${s.employeeName} (${s.employeeEmail})
• Formulaire: "${s.formTitle}"
• Heure: ${s.submittedTime}
• Réponses:
${answersText}`;
}).join('\n\n') : 'AUCUNE SOUMISSION AUJOURD\'HUI'}

💡 Conseils: Affinez par employé ou formulaire pour plus de précision.`;
    } else {
      console.log('Calling OpenAI API...');
      try {
    const completion = await openai.chat.completions.create({
          model: 'gpt-4.1',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 800,
      temperature: 0.7
    });
        answer = completion.choices && completion.choices[0] && completion.choices[0].message && completion.choices[0].message.content 
      ? completion.choices[0].message.content 
      : 'Désolé, je n\'ai pas pu générer une réponse.';
        tokensUsed = completion.usage && completion.usage.total_tokens ? completion.usage.total_tokens : 0;
        
        // Calculate final user tokens to charge based on actual usage
        finalUserTokens = TokenCounter.getUserTokensToCharge(tokensUsed, 1.5);
        
        console.log('OpenAI response generated successfully');
        console.log('Token usage:', {
          actualTokens: tokensUsed,
          userTokensCharged: finalUserTokens,
          multiplier: 1.5
        });
        console.log('AI Response content:', answer.substring(0, 500) + '...');
      } catch (openaiError) {
        console.error('OpenAI error:', openaiError);
        // Fallback en cas d'erreur OpenAI
        answer = `📊 Résumé ${data.period.label} (Mode Fallback)

• Entrées analysées: ${data.totals.entries}
• Employés actifs: ${data.totals.uniqueUsers}/${data.totals.totalUsers}
• Formulaires utilisés: ${data.totals.uniqueForms}/${data.totals.totalForms}

Top employés:
${data.userStats.map(u => `• ${u.name}: ${u.count} réponses`).join('\n') || '• Aucun'}

Top formulaires:
${data.formStats.map(f => `• ${f.title}: ${f.count} réponses`).join('\n') || '• Aucun'}

📅 SOUMISSIONS DÉTAILLÉES D'AUJOURD'HUI (${new Date().toLocaleDateString('fr-FR')}):
${data.todaySubmissions.length > 0 ? data.todaySubmissions.map((s, index) => {
  const answersText = Object.entries(s.answers).map(([fieldLabel, value]) => {
    const displayValue = value !== null && value !== undefined ? 
      (typeof value === 'boolean' ? (value ? 'Oui' : 'Non') : String(value)) : 
      'Non renseigné';
    return `    • ${fieldLabel}: ${displayValue}`;
  }).join('\n');
  
  return `SOUMISSION ${index + 1}:
• Employé: ${s.employeeName} (${s.employeeEmail})
• Formulaire: "${s.formTitle}"
• Heure: ${s.submittedTime}
• Réponses:
${answersText}`;
}).join('\n\n') : 'AUCUNE SOUMISSION AUJOURD\'HUI'}

⚠️ Note: Réponse générée sans IA (OpenAI non disponible)`;
      }
    }

    // 7. Store conversation in Firestore
    console.log('Step 7: Storing conversation...');
    try {
      // Get or create conversation
      let conversationId = req.body.conversationId;
      
      if (!conversationId) {
        // Create new conversation
        const conversationData = {
          directorId: uid,
          agencyId: userData.agencyId,
          title: question.length > 50 ? question.substring(0, 50) + '...' : question,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
          messageCount: 2 // user message + assistant response
        };
        
        const conversationRef = await adminDb.collection('conversations').add(conversationData);
        conversationId = conversationRef.id;
        console.log('New conversation created:', conversationId);
      }

      // Store user message
      const userMessage = {
        type: 'user',
        content: question || '',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        filters: req.body.filters || {}
      };

      // Store assistant response
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
          userTokensCharged: finalUserTokens
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
          
          console.log(`✅ Tokens deducted: ${finalUserTokens} tokens charged to user ${uid}`);
          console.log(`📊 New token usage: ${newTokensUsed}/${packageLimit} (package) + ${newPayAsYouGoTokens} (pay-as-you-go)`);
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

      console.log('Conversation stored successfully');
    } catch (storeError) {
      console.error('Error storing conversation:', storeError);
      // Don't fail the request if conversation storage fails
    }

    // 8. Réponse
    console.log('Step 8: Sending response...');
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
        userTokensCharged: finalUserTokens
      }
    };
    
    console.log('Response sent successfully');
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
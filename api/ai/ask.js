const { adminAuth, adminDb } = require('../lib/firebaseAdmin.js');
const OpenAI = require('openai');

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

  if (!period || period === 'this_week') {
    // Cette semaine (lundi à aujourd'hui)
    const dayOfWeek = now.getDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysFromMonday);
    label = 'cette semaine';
  } else if (period === 'today') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    label = "aujourd'hui";
  } else if (period === 'yesterday') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    label = 'hier';
  } else if (period === 'this_month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    label = 'ce mois';
  } else if (period === 'last_30d') {
    start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    label = 'les 30 derniers jours';
  } else if (period.includes(' - ')) {
    // Format personnalisé "dd/mm/yyyy - dd/mm/yyyy"
    const [startStr, endStr] = period.split(' - ');
    const [startDay, startMonth, startYear] = startStr.split('/').map(Number);
    const [endDay, endMonth, endYear] = endStr.split('/').map(Number);
    start = new Date(startYear, startMonth - 1, startDay);
    end = new Date(endYear, endMonth - 1, endDay, 23, 59, 59);
    label = `du ${startStr} au ${endStr}`;
  } else {
    // Par défaut : cette semaine
    const dayOfWeek = now.getDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysFromMonday);
    label = 'cette semaine';
  }

  return { start, end, label };
}

// Fonction pour charger et agréger les données
async function loadAndAggregateData(
  agencyId,
  period,
  formId,
  userId, 
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
    const matchUser = !userId || e.userId === userId;
    return inDateRange && matchForm && matchUser;
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
      .map(([date, count]) => ({ date, count }))
  };
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

    console.log('User data found:', { role: userData.role, agencyId: userData.agencyId });
    
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
    const { question, filters } = req.body;
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Question manquante ou invalide',
        code: 'INVALID_QUESTION'
      });
    }

    // 4. Chargement et agrégation des données
    console.log('Step 4: Loading and aggregating data...');
    console.log('Filters:', { period: filters?.period, formId: filters?.formId, userId: filters?.userId });
    
    let data;
    try {
      data = await loadAndAggregateData(
        userData.agencyId,
        filters?.period,
        filters?.formId,
        filters?.userId
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

    // 5. Construction du prompt pour OpenAI
    const systemPrompt = `Tu es un assistant IA spécialisé dans l'analyse de données de formulaires d'entreprise. Tu peux répondre à différents types de questions.

RÈGLES STRICTES :
- Réponds UNIQUEMENT en français
- Ne JAMAIS inventer de chiffres ou de données
- Si tu n'as pas de données pour répondre, dis-le clairement
- Utilise un langage professionnel mais accessible
- Structure tes réponses de manière claire

TYPES DE QUESTIONS QUE TU PEUX TRAITER :
1. **Analyses de données** : Résumés, tendances, comparaisons
2. **Questions spécifiques** : Performance d'un employé, utilisation d'un formulaire
3. **Conseils** : Recommandations basées sur les données
4. **Questions générales** : Explications sur le système, fonctionnement

CONTEXTE :
- Agence : ${userData.agencyId}
- Période analysée : ${data.period.label}
- Directeur : ${userData.name || 'Directeur'}

DONNÉES DISPONIBLES :
- Total des entrées : ${data.totals.entries}
- Employés actifs : ${data.totals.uniqueUsers}/${data.totals.totalUsers}
- Formulaires utilisés : ${data.totals.uniqueForms}/${data.totals.totalForms}

TOP EMPLOYÉS :
${data.userStats.map(u => `- ${u.name} : ${u.count} réponses`).join('\n')}

TOP FORMULAIRES :
${data.formStats.map(f => `- ${f.title} : ${f.count} réponses`).join('\n')}

TIMELINE :
${data.timeline.map(t => `- ${t.date} : ${t.count} réponses`).join('\n')}`;

    const userPrompt = `Question de l'utilisateur : "${question}"

Réponds à cette question en utilisant les données disponibles. Si la question ne peut pas être répondue avec ces données, explique pourquoi et suggère des alternatives.`;

    // 6. Appel OpenAI
    console.log('Step 6: Generating AI response...');
    let answer = '';
    let tokensUsed = 0;
    
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

💡 Conseils: Affinez par employé ou formulaire pour plus de précision.`;
    } else {
      console.log('Calling OpenAI API...');
      try {
    const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
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
        console.log('OpenAI response generated successfully');
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

⚠️ Note: Réponse générée sans IA (OpenAI non disponible)`;
      }
    }

    // 7. Réponse
    console.log('Step 7: Sending response...');
    const response = {
      answer,
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
        tokensUsed
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
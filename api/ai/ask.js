const { adminAuth, adminDb } = require('../lib/firebaseAdmin.js');
const admin = require('firebase-admin');
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
  const detailedSubmissions = limitedEntries.map(entry => {
    const user = usersById.get(entry.userId);
    const form = formsById.get(entry.formId);
    
    // Créer un mapping des réponses avec les labels des champs
    const answersWithLabels = {};
    if (form && form.fields) {
      Object.entries(entry.answers || {}).forEach(([fieldId, value]) => {
        const field = form.fields.find(f => f.id === fieldId);
        const fieldLabel = field ? field.label : fieldId;
        answersWithLabels[fieldLabel] = value;
      });
    } else {
      // Fallback si pas de formulaire trouvé
      Object.entries(entry.answers || {}).forEach(([fieldId, value]) => {
        answersWithLabels[fieldId] = value;
      });
    }
    
    return {
      id: entry.id,
      formTitle: form ? form.title : `Formulaire ${entry.formId}`,
      employeeName: user ? user.name : `Utilisateur ${entry.userId}`,
      employeeEmail: user ? user.email : 'Email non disponible',
      submittedAt: entry.submittedAt.toISOString(),
      submittedDate: entry.submittedAt.toLocaleDateString('fr-FR'),
      submittedTime: entry.submittedAt.toLocaleTimeString('fr-FR'),
      answers: answersWithLabels,
      isToday: entry.submittedAt.toDateString() === new Date().toDateString(),
      isThisWeek: entry.submittedAt >= start && entry.submittedAt <= end
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
    const { question, filters, selectedFormats, responseFormat } = req.body;
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

    // 5. Construction du prompt pour OpenAI
    const systemPrompt = `Tu es un assistant IA spécialisé dans l'analyse de données de formulaires d'entreprise.

RÈGLES STRICTES :
- Réponds UNIQUEMENT en français
- Utilise les données EXACTES fournies ci-dessous
- Ne JAMAIS inventer de données
- Si tu n'as pas de données pour répondre, dis-le clairement

CONTEXTE :
- Agence : ${userData.agencyId}
- Période analysée : ${data.period.label}
- Directeur : ${userData.name || 'Directeur'}
- Date actuelle : ${new Date().toLocaleDateString('fr-FR')}
- Format de réponse demandé : ${responseFormat || 'texte libre'}
- Formulaires sélectionnés : ${selectedFormats && selectedFormats.length > 0 ? selectedFormats.join(', ') : 'tous les formulaires'}

FORMAT DE RÉPONSE :
${responseFormat === 'stats' ? `
- FORMAT STATISTIQUES : Tu dois OBLIGATOIREMENT retourner un graphique JSON avec la structure suivante :

ANALYSE DES DONNÉES ET RECOMMANDATION DE GRAPHIQUE :
1. Analyse les données fournies
2. Recommande le type de graphique le plus approprié :
   - "bar" : Pour comparer des valeurs (ex: soumissions par employé, par formulaire)
   - "pie" : Pour montrer des proportions (ex: répartition des formulaires, satisfaction)
   - "line" : Pour montrer des tendances dans le temps (ex: évolution des soumissions)
   - "area" : Pour montrer des volumes cumulés dans le temps
   - "scatter" : Pour montrer des corrélations entre deux variables

3. Génère le JSON avec cette structure EXACTE :
\`\`\`json
{
  "type": "bar|line|pie|area|scatter",
  "title": "Titre descriptif du graphique",
  "data": [
    {"label": "Nom employé", "value": 5, "employee": "Nom employé", "email": "email@example.com"},
    {"label": "Autre employé", "value": 3, "employee": "Autre employé", "email": "autre@example.com"}
  ],
  "xAxisKey": "label",
  "yAxisKey": "value", 
  "dataKey": "value",
  "colors": ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"],
  "options": {
    "showLegend": true
  }
}
\`\`\`

RÈGLES IMPORTANTES :
- Utilise les données EXACTES des soumissions fournies
- Pour les données d'employés, utilise "employee" et "email" dans chaque objet data
- Pour les données temporelles, utilise "date" comme clé
- Le titre doit être descriptif et en français
- Inclus TOUJOURS une explication textuelle après le JSON
- Si pas de données, retourne un graphique vide avec message explicatif` : ''}
${responseFormat === 'table' ? `
- FORMAT TABLEAU : Tu dois retourner un tableau markdown avec la structure suivante :
\`\`\`markdown
| Colonne 1 | Colonne 2 | Colonne 3 |
|-----------|-----------|-----------|
| Valeur 1  | Valeur 2  | Valeur 3  |
| Valeur 4  | Valeur 5  | Valeur 6  |
\`\`\`
- Inclus aussi une explication textuelle du tableau.` : ''}
${responseFormat === 'pdf' ? `
- FORMAT PDF : Tu dois retourner du contenu markdown structuré pour un rapport PDF :
- Utilise des titres (# ## ###)
- Inclus des listes à puces
- Structure le contenu en sections
- Inclus des métriques et analyses
- Le contenu sera converti en PDF automatiquement.` : ''}

STATISTIQUES :
- Total des entrées : ${data.totals.entries}
- Employés actifs : ${data.totals.uniqueUsers}/${data.totals.totalUsers}
- Formulaires utilisés : ${data.totals.uniqueForms}/${data.totals.totalForms}

ANALYSE DES DONNÉES DISPONIBLES :
- Répartition par employé : ${data.userStats.map(u => `${u.name}: ${u.count}`).join(', ') || 'Aucune donnée'}
- Répartition par formulaire : ${data.formStats.map(f => `${f.title}: ${f.count}`).join(', ') || 'Aucune donnée'}
- Timeline des soumissions : ${data.timeline.length} jours avec des données
- Période analysée : ${data.period.label}

DONNÉES DÉTAILLÉES DES SOUMISSIONS :
${data.submissions.length > 0 ? data.submissions.map((s, index) => {
  const answersText = Object.entries(s.answers).map(([fieldLabel, value]) => {
    const displayValue = value !== null && value !== undefined ? 
      (typeof value === 'boolean' ? (value ? 'Oui' : 'Non') : String(value)) : 
      'Non renseigné';
    return `    • ${fieldLabel}: ${displayValue}`;
  }).join('\n');
  
  return `SOUMISSION ${index + 1}:
- Employé: ${s.employeeName} (${s.employeeEmail})
- Formulaire: "${s.formTitle}"
- Date: ${s.submittedDate} à ${s.submittedTime}${s.isToday ? ' (AUJOURD\'HUI)' : ''}
- Réponses:
${answersText}`;
}).join('\n\n') : 'AUCUNE SOUMISSION TROUVÉE'}

SOUMISSIONS D'AUJOURD'HUI (${new Date().toLocaleDateString('fr-FR')}) :
${data.todaySubmissions.length > 0 ? data.todaySubmissions.map((s, index) => {
  const answersText = Object.entries(s.answers).map(([fieldLabel, value]) => {
    const displayValue = value !== null && value !== undefined ? 
      (typeof value === 'boolean' ? (value ? 'Oui' : 'Non') : String(value)) : 
      'Non renseigné';
    return `    • ${fieldLabel}: ${displayValue}`;
  }).join('\n');
  
  return `SOUMISSION AUJOURD'HUI ${index + 1}:
- Employé: ${s.employeeName} (${s.employeeEmail})
- Formulaire: "${s.formTitle}"
- Heure: ${s.submittedTime}
- Réponses:
${answersText}`;
}).join('\n\n') : 'AUCUNE SOUMISSION AUJOURD\'HUI'}`;

    const userPrompt = `Question de l'utilisateur : "${question}"

Réponds à cette question en utilisant les données disponibles. Si la question ne peut pas être répondue avec ces données, explique pourquoi et suggère des alternatives.`;

    // Debug: Log the complete prompt being sent to AI
    console.log('\n=== COMPLETE PROMPT BEING SENT TO AI ===');
    console.log('SYSTEM PROMPT:');
    console.log(systemPrompt);
    console.log('\nUSER PROMPT:');
    console.log(userPrompt);
    console.log('=== END PROMPT LOGGING ===\n');

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
        content: question,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        filters: req.body.filters || {}
      };

      // Store assistant response
      const assistantMessage = {
        type: 'assistant',
        content: answer,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        responseTime: Date.now() - startTime,
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

      // Add messages to conversation subcollection
      await adminDb.collection('conversations').doc(conversationId).collection('messages').add(userMessage);
      await adminDb.collection('conversations').doc(conversationId).collection('messages').add(assistantMessage);

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
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
  let entries = baseSnapshot.docs.map((doc) => {
    const data = doc.data();
    const entry = {
      id: doc.id,
      formId: data.formId || '',
      userId: data.userId || '',
      agencyId: data.agencyId || '',
      submittedAt: data.submittedAt || new Date(),
      answers: data.answers || {},
      fileAttachments: data.fileAttachments || [] // Include fileAttachments from Firestore
    };
    
    
    return entry;
  });

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
      
      const contextInfo = `
CONTEXTE MÉTIER :
- Agence : ${userData.agencyId}
- Période d'analyse : ${data.period.label}
- Nombre total de soumissions : ${data.totals.entries}
- Employés actifs : ${data.totals.uniqueUsers}/${data.totals.totalUsers}
- Formulaires utilisés : ${data.totals.uniqueForms}/${data.totals.totalForms}

OBJECTIF : Répondre clairement à la question du directeur avec des insights basés sur les données.

${hasPDFContent ? `
📄 DONNÉES SUPPLÉMENTAIRES IMPORTANTES :
- Certaines soumissions incluent des documents PDF avec leur contenu textuel extrait
- Ces documents sont marqués par "Document PDF: [nom_fichier] (contenu_extraite)"
- OBLIGATOIRE : Analyse le contenu textuel de ces documents comme partie intégrante des données de soumission
- OBLIGATOIRE : Utilise toutes les informations des documents PDF pour répondre précisément à la question
- OBLIGATOIRE : Référence le contenu des documents dans ton analyse quand c'est pertinent
- OBLIGATOIRE : MENTIONNE EXPLICITEMENT le nom des fichiers PDF que tu utilises comme référence dans ta réponse
- OBLIGATOIRE : Utilise des phrases comme "Selon le document [nom_fichier]", "Dans le fichier [nom_fichier]", "D'après [nom_fichier]"
- OBLIGATOIRE : Cite le nom exact du fichier PDF quand tu fais référence à son contenu
- Le contenu des documents PDF fait partie des données de soumission et doit être traité comme tel` : ''}

${hasImageContent ? `
🖼️ DONNÉES SUPPLÉMENTAIRES IMPORTANTES :
- Certaines soumissions incluent des images avec leur contenu textuel extrait par OCR
- Ces images sont marquées par "Image: [nom_fichier] (contenu_extraite)"
- OBLIGATOIRE : Analyse le contenu textuel de ces images comme partie intégrante des données de soumission
- OBLIGATOIRE : Utilise toutes les informations des images pour répondre précisément à la question
- OBLIGATOIRE : Référence le contenu des images dans ton analyse quand c'est pertinent
- OBLIGATOIRE : MENTIONNE EXPLICITEMENT le nom des fichiers image que tu utilises comme référence dans ta réponse
- OBLIGATOIRE : Utilise des phrases comme "Selon l'image [nom_fichier]", "Dans l'image [nom_fichier]", "D'après [nom_fichier]"
- OBLIGATOIRE : Cite le nom exact du fichier image quand tu fais référence à son contenu
- Le contenu des images fait partie des données de soumission et doit être traité comme tel` : ''}

${responseFormat === 'table' ? `
EXEMPLE DE TABLEAU CORRECT :
| Employé | Soumissions | Pourcentage |
|---------|-------------|-------------|
| Jean Dupont | 15 | 60% |
| Marie Martin | 10 | 40% |

IMPORTANT : Le tableau DOIT contenir des lignes de données réelles, pas seulement les en-têtes !` : ''}`;

      return `${baseRole}${coreRules}${formatInstructions}${jsonValidationInstructions}${contextInfo}`;
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
- **Formulaires utilisés :** ${data.totals.uniqueForms}/${data.totals.totalForms}

*Note: Réponse générée sans IA (OpenAI non disponible)*`;
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
- **Employés actifs :** ${data.totals.uniqueUsers}/${data.totals.totalUsers}

*Note: Réponse générée sans IA (OpenAI non disponible)*`;
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
- **Formulaires utilisés :** ${data.totals.uniqueForms}/${data.totals.totalForms}

*Note: Réponse générée sans IA (OpenAI non disponible)*`;
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
**Employés actifs :** ${data.totals.uniqueUsers}/${data.totals.totalUsers}

*Note: Réponse générée sans IA (OpenAI non disponible)*`;
      }

      return `Analyse des données pour la période ${data.period.label}

**Période analysée :** ${data.period.label}  
**Total soumissions :** ${data.totals.entries}  
**Employés actifs :** ${data.totals.uniqueUsers}/${data.totals.totalUsers}

*Note: Réponse générée sans IA (OpenAI non disponible)*`;
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

    const hasImageContent = data.submissions.some(s => 
      s.fileAttachments?.some(att => 
        att.fileType && att.fileType.startsWith('image/') && att.extractedText
      )
    ) || data.submissions.some(s => 
      Object.values(s.answers).some(value => 
        value && typeof value === 'object' && value.uploaded && value.fileName && value.extractedText && 
        value.fileType && value.fileType.startsWith('image/')
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
        
        // Add extracted text from file attachments as part of the submission data
        let extractedTextSummary = '';
        if (s.fileAttachments && s.fileAttachments.length > 0) {
          const pdfFiles = s.fileAttachments.filter(att => 
            att.fileType === 'application/pdf' && att.extractedText
          );
          
          const imageFiles = s.fileAttachments.filter(att => 
            att.fileType && att.fileType.startsWith('image/') && att.extractedText
          );
          
          if (pdfFiles.length > 0) {
            pdfFiles.forEach((file, fileIndex) => {
              // Include extracted text as additional field data, not as separate section
              extractedTextSummary += ` | Document PDF: ${file.fileName} (${file.extractedText.substring(0, 1500)}${file.extractedText.length > 1500 ? '...' : ''})`;
            });
          }
          
          if (imageFiles.length > 0) {
            imageFiles.forEach((file, fileIndex) => {
              // Include extracted text from images
              extractedTextSummary += ` | Image: ${file.fileName} (${file.extractedText.substring(0, 1500)}${file.extractedText.length > 1500 ? '...' : ''})`;
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

IMPORTANT : Les soumissions ci-dessous contiennent des documents PDF avec du contenu textuel extrait.
Ces documents sont marqués par "Document PDF: [nom_fichier] (contenu_extraite)".
OBLIGATOIRE : Analyse le contenu de ces documents comme partie intégrante des données de soumission.
OBLIGATOIRE : Utilise toutes les informations des documents PDF pour répondre à la question.
OBLIGATOIRE : Référence le contenu des documents dans ton analyse quand c'est pertinent.
OBLIGATOIRE : MENTIONNE EXPLICITEMENT le nom des fichiers PDF que tu utilises comme référence.
OBLIGATOIRE : Utilise des phrases comme "Selon le document [nom_fichier]", "Dans le fichier [nom_fichier]", "D'après [nom_fichier]".
OBLIGATOIRE : Cite le nom exact du fichier PDF quand tu fais référence à son contenu.` : '';

      const imageContentReminder = hasImageContent ? `

IMPORTANT : Les soumissions ci-dessous contiennent des images avec du contenu textuel extrait par OCR.
Ces images sont marquées par "Image: [nom_fichier] (contenu_extraite)".
OBLIGATOIRE : Analyse le contenu de ces images comme partie intégrante des données de soumission.
OBLIGATOIRE : Utilise toutes les informations des images pour répondre à la question.
OBLIGATOIRE : Référence le contenu des images dans ton analyse quand c'est pertinent.
OBLIGATOIRE : MENTIONNE EXPLICITEMENT le nom des fichiers image que tu utilises comme référence.
OBLIGATOIRE : Utilise des phrases comme "Selon l'image [nom_fichier]", "Dans l'image [nom_fichier]", "D'après [nom_fichier]".
OBLIGATOIRE : Cite le nom exact du fichier image quand tu fais référence à son contenu.` : '';

      return `${questionText}\n\n${dataOverview}\n\n${submissions}${tableFormatReminder}${pdfContentReminder}${imageContentReminder}`;
    };

    // Use the complete user message for the AI call
    const userPromptForAI = buildUserMessage();
    


    // 6. Appel OpenAI
    let answer = '';
    let tokensUsed = 0;
    let finalUserTokens = 0;
    
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
**Employés actifs :** ${data.totals.uniqueUsers}/${data.totals.totalUsers}

*Note: Réponse générée sans IA (OpenAI non disponible)*`;
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
        if (selectedResponseFormats && selectedResponseFormats.length > 1) {
          answer = generateMultiFormatFallbackResponse(selectedResponseFormats, data);
        } else if (responseFormat === 'table') {
          answer = `Voici un tableau basé sur vos données :

| Employé | Nombre de soumissions | Pourcentage | Formulaire principal |
|---------|----------------------|-------------|---------------------|
${data.userStats.slice(0, 5).map(u => `| ${u.name} | ${u.count} | ${((u.count/data.totals.entries)*100).toFixed(1)}% | ${data.formStats[0]?.title || 'N/A'} |`).join('\n')}

**Période analysée :** ${data.period.label}  
**Total soumissions :** ${data.totals.entries}  
**Employés actifs :** ${data.totals.uniqueUsers}/${data.totals.totalUsers}

*Note: Réponse générée sans IA (OpenAI non disponible)*`;
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
Il serait pertinent de surveiller l'engagement des employés moins actifs et d'analyser les formulaires peu utilisés pour identifier des opportunités d'amélioration. Maintenir la performance des employés les plus productifs est également important.

*Note: Réponse générée sans IA (OpenAI non disponible)*`;
        }
      }
    }
    
    // Initialize conversationId to ensure it's always defined
      let conversationId = req.body.conversationId;
    let conversationContext = null;
    
    // Initialize file variables to prevent ReferenceError
    let referencedPDFFiles = [];
    let referencedImageFiles = [];
    
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
          conversationContext = conversationDoc.data();
          
          try {
            // Safely extract previous context without circular references
            const safePreviousContext = conversationContext?.context ? {
              lastAnalysisType: conversationContext.context.lastAnalysisType || null,
              lastFormats: conversationContext.context.lastFormats || [],
              lastPeriod: conversationContext.context.lastPeriod || 'all',
              lastFormIds: conversationContext.context.lastFormIds || []
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
          for (const [formId, form] of data.formsById) {
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
      
      try {
        await adminDb.collection('conversations').doc(conversationId).collection('messages').add(userMessage);
      } catch (saveError) {
        console.error('❌ FIREBASE SAVE ERROR - Failed to save user message:', saveError);
        throw saveError;
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
      
      // Separate PDF and image files for display
      referencedPDFFiles = referencedFiles.filter(f => f.fileType === 'application/pdf');
      referencedImageFiles = referencedFiles.filter(f => f.fileType && f.fileType.startsWith('image/'));
      
      // Log file detection for debugging
      console.log(`📄 FILE DETECTION: Found ${allAnalyzedFiles.length} analyzed files (${allAnalyzedFiles.filter(f => f.fileType === 'application/pdf').length} PDFs, ${allAnalyzedFiles.filter(f => f.fileType && f.fileType.startsWith('image/')).length} images), ${referencedFiles.length} referenced in response`);
      if (allAnalyzedFiles.length > 0) {
        console.log('📄 All analyzed files:', allAnalyzedFiles.map(f => f.fileName));
        console.log('📄 Referenced files:', referencedFiles.map(f => f.fileName));
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
          model: 'gpt-4.1',
          responseFormat: responseFormat || 'text',
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
        },
        // Include only files that are actually referenced in the response
        pdfFiles: referencedPDFFiles,
        imageFiles: referencedImageFiles
      };
      
      try {
        await adminDb.collection('conversations').doc(conversationId).collection('messages').add(assistantMessage);
      } catch (saveError) {
        console.error('❌ FIREBASE SAVE ERROR - Failed to save assistant message:', saveError);
        throw saveError;
      }

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
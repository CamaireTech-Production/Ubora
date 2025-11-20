/**
 * Prompt Builder for AI Requests
 * Handles construction of system and user prompts for OpenAI
 */

import { getFormatInstructions, getMultiFormatInstructions } from './responseFormatter.js';

/**
 * Build system message with context-aware instructions
 */
export function buildSystemMessage(conversationContext, userData, data, responseFormat, selectedResponseFormats, hasPDFContent, hasImageContent) {
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

  // Conversation context section
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
}

/**
 * Build user message for estimation
 */
export function buildUserMessageForEstimation(question, data) {
  const questionText = `QUESTION : "${question}"`;
  
  const dataOverview = `
DONNÉES DISPONIBLES :
- ${data.totals.entries} soumissions au total
- ${data.totals.uniqueUsers} employés actifs
- ${data.totals.uniqueForms} formulaires utilisés
- Période : ${data.period.label}

TOP EMPLOYÉS : ${(data.userStats || []).slice(0, 3).map(u => `${u.name} (${u.count} soumissions)`).join(', ') || 'Aucun'}
TOP FORMULAIRES : ${(data.formStats || []).slice(0, 3).map(f => `${f.title} (${f.count} soumissions)`).join(', ') || 'Aucun'}`;

  return `${questionText}\n\n${dataOverview}`;
}

/**
 * Build complete user message with vector search results
 */
export function buildUserMessage(question, vectorSearchResults, responseFormat, hasPDFContent, hasImageContent) {
  const questionText = `QUESTION : "${question}"`;
  
  if (!vectorSearchResults.hasResults) {
    return `${questionText}

AUCUNE DONNÉE PERTINENTE TROUVÉE :
Je n'ai pas trouvé de données pertinentes pour répondre à votre question dans la base vectorielle. Veuillez reformuler votre question ou vérifier que les données ont été synchronisées.`;
  }
  
  const dataOverview = `
DONNÉES PERTINENTES TROUVÉES (${vectorSearchResults.chunks.length} sources) :
${vectorSearchResults.formattedText}

CITATIONS DISPONIBLES :
${vectorSearchResults.citations.map((citation, index) => `[${index + 1}] ${citation}`).join('\n')}`;

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

  return `${questionText}\n\n${dataOverview}\n\n${tableFormatReminder}${pdfContentReminder}${imageContentReminder}${processInstructions}

INSTRUCTIONS :
- Réponds à la question en utilisant UNIQUEMENT les données ci-dessus
- Cite tes sources en utilisant les noms de formulaires ou fichiers (ex: "Selon le formulaire [nom] par [employé]...")
- Si les données ne suffisent pas pour répondre complètement, dis-le clairement
- Sois précis et cite les chiffres exacts trouvés dans les données`;
}


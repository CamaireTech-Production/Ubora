/**
 * Response Formatter Module
 * Extracted from ask.js for better code organization
 * 
 * Functions:
 * - getContentTypeForResponse: Determines content type based on response format
 * - generateMultiFormatFallbackResponse: Generates fallback response for multi-format combinations
 */

import { logger } from '../lib/logger.js';

/**
 * Determine content type for response based on formats
 * @param {string} responseFormat - Primary response format
 * @param {string[]} selectedResponseFormats - Array of selected response formats
 * @returns {string} - Content type identifier
 */
export function getContentTypeForResponse(responseFormat, selectedResponseFormats) {
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
}

/**
 * Generate fallback response for multi-format combinations
 * @param {string[]} selectedFormats - Array of selected formats
 * @param {Object} data - Aggregated data object
 * @returns {string} - Formatted fallback response
 */
export function generateMultiFormatFallbackResponse(selectedFormats, data) {
  try {
    logger.debug('Generating multi-format fallback response', { selectedFormats }, 'responseFormatter.js');

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
  } catch (error) {
    logger.error('Error generating multi-format fallback response', error, 'responseFormatter.js');
    throw error;
  }
}

/**
 * Get format-specific instructions for system prompt
 */
export function getFormatInstructions(responseFormat, selectedResponseFormats) {
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
}

/**
 * Get multi-format instructions
 */
export function getMultiFormatInstructions(selectedFormats) {
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
}



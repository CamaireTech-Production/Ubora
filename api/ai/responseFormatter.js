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
function getContentTypeForResponse(responseFormat, selectedResponseFormats) {
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
function generateMultiFormatFallbackResponse(selectedFormats, data) {
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

module.exports = {
  getContentTypeForResponse,
  generateMultiFormatFallbackResponse
};


/**
 * OpenAI Client Wrapper
 * Handles OpenAI API calls with error handling and fallbacks
 */

import OpenAI from 'openai';
import { logger } from '../lib/logger.js';
import { generateMultiFormatFallbackResponse } from './responseFormatter.js';
import { calculateUserTokens } from './tokenManager.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate AI response with fallback handling
 */
export async function generateAIResponse(systemPrompt, userPrompt, responseFormat, selectedResponseFormats, data) {
  if (!process.env.OPENAI_API_KEY) {
    logger.warn('OpenAI API key not configured, using fallback response', null, '/api/ai/openAIClient');
    return generateFallbackResponse(responseFormat, selectedResponseFormats, data, systemPrompt, userPrompt);
  }

  try {
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
    const finalUserTokens = calculateUserTokens(tokensUsed);
    
    logger.debug('OPENAI TOKEN CALCULATION', {
      actualTokens: tokensUsed,
      finalUserTokens,
      systemPromptLength: systemPrompt.length,
      userPromptLength: userPrompt.length,
      answerLength: answer.length,
      userTokensFormula: `(${tokensUsed} * 2.5) / 100 = ${finalUserTokens}`
    }, '/api/ai/openAIClient');
    
    return {
      answer,
      tokensUsed,
      finalUserTokens
    };
  } catch (openaiError) {
    logger.error('OpenAI error', openaiError, '/api/ai/openAIClient');
    return generateFallbackResponse(responseFormat, selectedResponseFormats, data, systemPrompt, userPrompt);
  }
}

/**
 * Generate fallback response when OpenAI is unavailable
 */
function generateFallbackResponse(responseFormat, selectedResponseFormats, data, systemPrompt, userPrompt) {
  let answer;
  
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
  
  // Calculate estimated tokens for fallback response
  const estimatedTokens = Math.ceil((systemPrompt.length + userPrompt.length + answer.length) / 4);
  const finalUserTokens = calculateUserTokens(estimatedTokens);
  
  logger.debug('FALLBACK TOKEN CALCULATION', {
    estimatedTokens,
    finalUserTokens,
    systemPromptLength: systemPrompt.length,
    userPromptLength: userPrompt.length,
    answerLength: answer.length,
    calculationFormula: `(${systemPrompt.length} + ${userPrompt.length} + ${answer.length}) / 4 = ${estimatedTokens}`,
    userTokensFormula: `(${estimatedTokens} * 2.5) / 100 = ${finalUserTokens}`
  }, '/api/ai/openAIClient');
  
  return {
    answer,
    tokensUsed: estimatedTokens,
    finalUserTokens
  };
}


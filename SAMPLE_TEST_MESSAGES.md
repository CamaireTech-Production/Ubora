# Sample Test Messages for Chat Implementation

## Easy Test Messages

### 0. Simple Text Messages (No Format Selected)
**No Format Selected - Will return simple text**

- "Bonjour, comment ça va ?"
- "Peux-tu m'expliquer comment utiliser cette application ?"
- "Quelles sont les fonctionnalités disponibles ?"
- "Aide-moi à comprendre les données disponibles"
- "Comment puis-je analyser mes formulaires ?"

### 1. Statistics Format Tests
**Select Format: Statistiques**

- "Montre-moi les soumissions par employé"
- "Combien de formulaires ont été soumis cette semaine ?"
- "Qui a soumis le plus de formulaires ?"
- "Évolution des soumissions dans le temps"
- "Répartition des soumissions par formulaire"

### 2. Table Format Tests
**Select Format: Tableau**

- "Liste tous les employés et leurs soumissions"
- "Montre-moi un tableau des soumissions récentes"
- "Qui a soumis quoi et quand ?"
- "Tableau des employés avec leurs statistiques"
- "Résumé des soumissions par formulaire"

### 3. PDF Format Tests
**Select Format: PDF**

- "Génère un rapport complet des soumissions"
- "Crée un rapport PDF avec toutes les données"
- "Rapport de synthèse des activités"
- "Document PDF avec analyse des formulaires"
- "Rapport mensuel des soumissions"

## Challenging Test Messages

### 4. Complex Statistics with Form Filter
**Select Format: Statistiques + Select specific forms**

- "Analyse les soumissions du formulaire 'Évaluation' avec des graphiques détaillés"
- "Montre-moi l'évolution des soumissions du formulaire 'Rapport mensuel' en graphique"
- "Statistiques comparatives entre les formulaires 'A' et 'B'"
- "Graphique des performances par employé pour le formulaire 'Suivi'"

### 5. Complex Tables with Multiple Forms
**Select Format: Tableau + Select multiple forms**

- "Tableau comparatif des soumissions entre tous les formulaires sélectionnés"
- "Liste détaillée des employés avec leurs soumissions pour chaque formulaire"
- "Tableau de bord des performances par formulaire et par employé"
- "Résumé complet des données de tous les formulaires sélectionnés"

### 6. Complex PDF Reports
**Select Format: PDF + Select forms**

- "Rapport PDF complet avec analyse des formulaires sélectionnés"
- "Document PDF avec graphiques et tableaux des données"
- "Rapport de synthèse avec recommandations basées sur les formulaires"
- "PDF détaillé avec métriques et insights des soumissions"

### 7. Mixed Format Requests
**Select Format: Table + PDF (if multiple selection was allowed)**

- "Crée un tableau des soumissions et génère un PDF avec ce tableau"
- "Montre-moi les données en tableau puis crée un rapport PDF"
- "Tableau des statistiques puis rapport PDF complet"

### 8. Advanced Analytics
**Select Format: Statistiques + Select specific forms**

- "Analyse de tendances des soumissions avec graphiques temporels"
- "Corrélation entre les types de formulaires et les employés"
- "Graphiques de performance comparative par période"
- "Analyse prédictive des soumissions futures"

### 9. Specific Data Queries
**Select Format: Tableau + Select forms**

- "Quels employés n'ont pas encore soumis le formulaire 'X' ?"
- "Tableau des soumissions en retard par employé"
- "Liste des formulaires les plus/moins utilisés"
- "Détail des soumissions avec statut et dates"

### 10. Executive Summary Requests
**Select Format: PDF + Select all forms**

- "Rapport exécutif complet avec toutes les métriques importantes"
- "Synthèse PDF pour la direction avec recommandations"
- "Document de présentation avec graphiques et analyses"
- "Rapport final avec conclusions et prochaines étapes"

## Test Scenarios by Complexity

### Beginner Level (Easy)
1. Simple statistics request with no form filter
2. Basic table request with one form selected
3. Simple PDF report request

### Intermediate Level (Medium)
1. Statistics with specific form filter
2. Table with multiple forms selected
3. PDF with form-specific data
4. Complex queries with date ranges

### Advanced Level (Challenging)
1. Multi-format requests (table + PDF)
2. Advanced analytics with correlations
3. Executive summaries with recommendations
4. Predictive analysis requests
5. Complex filtering with multiple criteria

## Expected AI Response Formats

### For Statistics Format:
```json
{
  "type": "bar",
  "title": "Soumissions par employé",
  "data": [
    {"employee": "John Doe", "submissions": 5},
    {"employee": "Jane Smith", "submissions": 3}
  ],
  "xAxisKey": "employee",
  "yAxisKey": "submissions"
}
```

### For Table Format:
```markdown
| Employé | Formulaire | Date de soumission | Statut |
|---------|------------|-------------------|--------|
| John Doe | Évaluation | 2024-01-15 | Complété |
| Jane Smith | Rapport | 2024-01-14 | En attente |
```

### For PDF Format:
```markdown
# Rapport de Synthèse

## Résumé Exécutif
Ce rapport présente une analyse complète des soumissions...

## Métriques Clés
- Total des soumissions: 25
- Employés actifs: 8
- Formulaires utilisés: 3

## Recommandations
1. Améliorer le taux de soumission
2. Former les employés sur les nouveaux formulaires
```

## Testing Checklist

- [ ] Test each format individually
- [ ] Test with no form filter (all forms)
- [ ] Test with single form selected
- [ ] Test with multiple forms selected
- [ ] Test complex queries
- [ ] Test edge cases (no data, empty responses)
- [ ] Verify proper rendering of each format
- [ ] Test PDF download functionality
- [ ] Test table responsiveness
- [ ] Test graph interactivity

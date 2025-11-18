# 🔍 Debug Tools pour Archa Chat

Ce dossier contient des outils de debug pour vérifier le filtrage des soumissions dans Archa Chat.

## 📋 Contenu

- `test-archa-filters.js` - Script de test pour vérifier le filtrage
- `check-vector-sync.js` - Script de vérification de la synchronisation Firebase ↔ Qdrant

## 🚀 Utilisation

### Test des filtres

```bash
# Lister les données de test disponibles
node api/debug/test-archa-filters.js list

# Exécuter les tests
node api/debug/test-archa-filters.js
```

### Vérifier la synchronisation Vector Database

```bash
# Vérifier la synchronisation entre Firebase et Qdrant
node api/debug/check-vector-sync.js [agencyId] [directorId]

# Exemple
node api/debug/check-vector-sync.js agency1 NmeqMvHwQLZvJRU4oDs5Skz0Q0Q2
```

Ce script va :
- Comparer les soumissions Firebase avec Qdrant
- Identifier les soumissions manquantes dans Qdrant
- Vérifier les métadonnées (universId, formId, etc.)
- Afficher un rapport détaillé

### Corriger les dates dans Qdrant

```bash
# Corriger toutes les dates pour une agence
node api/debug/fix-qdrant-dates.js agency1

# Corriger toutes les dates (toutes agences)
node api/debug/fix-qdrant-dates.js
```

Ce script va :
- Parcourir tous les points dans Qdrant
- Convertir les dates `submittedAt` au format ISO string
- Corriger les dates au format objet ou invalide

### Mode Debug dans l'API

Pour activer le mode debug dans l'API HTTP, ajoutez `debug: true` dans le body de la requête :

```json
{
  "question": "Votre question",
  "filters": { "period": "this_week" },
  "debug": true
}
```

Ou définissez la variable d'environnement :
```bash
export ENABLE_ARCHA_DEBUG=true
```

### Mode Dry-Run (sans appeler OpenAI)

Pour tester uniquement les filtres et la recherche vectorielle sans appeler OpenAI :

```bash
export DEBUG_DRY_RUN=true
node api/debug/test-archa-filters.js
```

## 🔧 Ce qui a été ajouté

### Fichiers modifiés

1. **`api/lib/vectorSearch.js`**
   - Paramètre `debug` optionnel dans `searchVectors()` et `buildFilter()`
   - Logs détaillés des filtres appliqués
   - Logs des résultats de recherche vectorielle

2. **`api/lib/executeAIQuestion.js`**
   - Paramètre `debug` optionnel
   - Mode dry-run (si `DEBUG_DRY_RUN=true`)
   - Logs détaillés des paramètres d'entrée et résultats

3. **`api/ai/ask.js`**
   - Support du paramètre `debug` dans le body de la requête
   - Passage du flag debug aux fonctions de recherche

### Fichiers créés

1. **`api/debug/test-archa-filters.js`**
   - Script de test indépendant
   - Peut être supprimé sans affecter le code principal

2. **`api/debug/README.md`**
   - Cette documentation

## 🗑️ Comment retirer le mode debug

### Option 1: Retirer complètement

1. **Supprimer les fichiers de debug** :
   ```bash
   rm -rf api/debug/
   ```

2. **Retirer les paramètres debug** dans les fichiers modifiés :
   - `api/lib/vectorSearch.js` : Retirer le paramètre `debug` et tous les blocs `if (debug)`
   - `api/lib/executeAIQuestion.js` : Retirer le paramètre `debug` et tous les blocs `if (debug)`
   - `api/ai/ask.js` : Retirer la logique `enableDebug`

### Option 2: Garder mais désactiver

Les paramètres `debug` sont optionnels et par défaut à `false`. Aucune action nécessaire si vous ne les utilisez pas.

## 📊 Ce que le mode debug affiche

1. **Filtres appliqués** :
   - `agencyId`
   - `activeUniversId` (Univers actif)
   - `formId` (si spécifié)
   - `userId` (si spécifié)
   - `period` (dates de début/fin)

2. **Résultats de recherche** :
   - Nombre de chunks trouvés
   - IDs des formulaires, Univers, utilisateurs
   - Scores de pertinence
   - Aperçu du texte de chaque chunk

3. **Mode dry-run** :
   - Retourne les informations de debug sans appeler OpenAI
   - Utile pour vérifier rapidement si les filtres fonctionnent

## ⚠️ Notes

- Le mode debug n'affecte pas le comportement normal si `debug=false` (par défaut)
- Les logs de debug sont visibles dans la console serveur
- Le mode dry-run évite les coûts OpenAI lors des tests


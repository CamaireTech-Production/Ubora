# Guide de Configuration du Chunking Vite

Ce document explique le système de chunking automatique implémenté pour éviter les erreurs de dépendances React.

## Problème résolu

Lorsqu'on sépare manuellement les chunks avec Vite/Rollup, certaines bibliothèques dépendent de React et utilisent `React.forwardRef`, `React.createContext`, etc. Si React est dans un chunk séparé, ces bibliothèques ne peuvent pas accéder à React au moment où elles en ont besoin, causant des erreurs comme :

- `Cannot read properties of undefined (reading 'forwardRef')`
- `Cannot read properties of undefined (reading 'createContext')`

## Solution implémentée

Un système de détection automatique des dépendances React a été mis en place dans `apps/main/vite.config.ts`. Ce système :

1. **Détecte automatiquement** les dépendances React
2. **Les regroupe** toutes dans le chunk `vendor-react`
3. **Évite les erreurs** de résolution de dépendances

## Fonctionnement

### 1. Détection par patterns connus

Le système utilise des patterns pour détecter les dépendances React connues :

```typescript
const REACT_DEPENDENCY_PATTERNS = [
  /node_modules\/react($|\/)/,        // React core
  /node_modules\/react-dom($|\/)/,     // React DOM
  /node_modules\/react-/,              // Toutes les bibliothèques react-*
  /node_modules\/lucide-react/,         // Bibliothèques UI
  /packages\/shared\/src\/contexts/,   // Contextes React
  // ...
];
```

### 2. Détection automatique par nom de package

Pour les nouvelles bibliothèques non listées, le système utilise des heuristiques pour détecter automatiquement les dépendances React :

- Packages qui commencent par `react-` (ex: `react-router-dom`)
- Packages qui commencent par `@react-` (ex: `@react-spring`)
- Packages qui commencent par `@radix-ui/`, `@headlessui/`, etc.
- Packages qui finissent par `-react` ou contiennent `-react-`

### 3. Organisation des chunks

Les chunks sont organisés par priorité :

1. **vendor-react** : React + toutes ses dépendances (priorité la plus haute)
2. **vendor-firebase** : Firebase
3. **vendor-pdf** : Bibliothèques PDF (html2canvas, jspdf, etc.)
4. **vendor-ai** : Bibliothèques IA (OpenAI, Tesseract, etc.)
5. **pdf-utils** : Utilitaires PDF personnalisés
6. **chat-components** : Composants de chat
7. **shared** : Package shared (parties non-React seulement)

## Ajouter une nouvelle bibliothèque React

### Méthode automatique (recommandée)

Si la bibliothèque suit les conventions de nommage React :
- Commence par `react-`
- Commence par `@react-`
- Contient `-react` dans son nom
- Commence par `@radix-ui/`, `@headlessui/`, etc.

**Aucune action requise** - Elle sera automatiquement détectée et mise dans `vendor-react`.

### Méthode manuelle

Si la bibliothèque ne suit pas les conventions, ajoutez-la manuellement dans `REACT_DEPENDENCY_PATTERNS` :

```typescript
const REACT_DEPENDENCY_PATTERNS = [
  // ... patterns existants
  /node_modules\/ma-nouvelle-bibliotheque-react/,  // Ajouter ici
];
```

## Tester après un changement

1. **Build local** :
   ```bash
   cd apps/main
   npm run build
   ```

2. **Vérifier la console** :
   - Ouvrir `dist/index.html` avec `npm run preview`
   - Vérifier la console du navigateur
   - Si vous voyez des erreurs `forwardRef` ou `createContext`, une bibliothèque React n'est pas dans le bon chunk

3. **Débugger** :
   - Vérifier quel chunk contient la bibliothèque problématique dans `dist/assets/`
   - Ajouter le pattern manuellement dans `REACT_DEPENDENCY_PATTERNS`

## Règles d'or

1. **Toujours regrouper** React et ses dépendances dans le même chunk
2. **Tester localement** avant de déployer
3. **Vérifier la console** après chaque build
4. **Documenter** les dépendances React non-conventionnelles

## Exemples de bibliothèques React détectées automatiquement

✅ **Détectées automatiquement** :
- `react-router-dom` (commence par `react-`)
- `@react-spring/core` (commence par `@react-`)
- `@radix-ui/react-dialog` (commence par `@radix-ui/`)
- `my-lib-react` (contient `-react`)

❌ **Nécessitent une ajout manuel** :
- `lucide-react` (déjà ajoutée manuellement)
- `recharts` (déjà ajoutée manuellement)
- Bibliothèques avec des noms non-conventionnels

## Structure des fichiers

```
apps/main/vite.config.ts
├── REACT_DEPENDENCY_PATTERNS  # Patterns manuels
├── isReactDependency()        # Détection par patterns
├── isReactDependencyByName()  # Détection automatique
└── determineChunk()           # Fonction principale
```

## Maintenance

- **Review périodique** : Vérifier régulièrement que les nouvelles dépendances React sont bien détectées
- **Tests** : Toujours tester après l'ajout d'une nouvelle dépendance React
- **Documentation** : Mettre à jour ce guide si de nouveaux patterns sont ajoutés


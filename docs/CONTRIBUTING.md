# Guide de contribution - Ubora

## Bienvenue !

Merci de votre intérêt pour contribuer à Ubora. Ce guide vous aidera à comprendre comment contribuer efficacement.

## Structure du projet

Voir `ARCHITECTURE.md` pour une vue d'ensemble complète.

## Processus de développement

### 1. Configuration de l'environnement

```bash
# Cloner le repository
git clone <repository-url>
cd Ubora

# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos clés Firebase

# Démarrer le serveur de développement
npm run dev
```

### 2. Créer une branche

```bash
# Créer une branche pour votre fonctionnalité
git checkout -b feature/ma-fonctionnalite

# Ou pour un bugfix
git checkout -b fix/mon-bug
```

### 3. Standards de code

#### TypeScript

- Utilisez TypeScript strict
- Évitez `any` - utilisez des types précis ou `unknown` avec type guards
- Documentez les types complexes avec JSDoc

#### React

- Utilisez des composants fonctionnels avec hooks
- Mémorisez les composants de liste avec `React.memo`
- Utilisez `useCallback` et `useMemo` pour optimiser les performances
- Suivez les règles des hooks React

#### Nommage

- **Composants** : PascalCase (`MyComponent.tsx`)
- **Hooks** : camelCase avec préfixe `use` (`useMyHook.ts`)
- **Services** : camelCase (`myService.ts`)
- **Types** : PascalCase (`MyType`)
- **Constantes** : UPPER_SNAKE_CASE (`MY_CONSTANT`)

#### Formatage

Le projet utilise ESLint et Prettier. Exécutez :

```bash
npm run lint
npm run format
```

### 4. Tests

#### Écrire des tests

- Tests unitaires pour services, hooks, utils
- Tests d'intégration pour les flux complets
- Tests smoke pour les chemins critiques

#### Exécuter les tests

```bash
# Tous les tests
npm run test

# Tests en mode watch
npm run test:watch

# Couverture
npm run test:coverage
```

#### Structure des tests

```typescript
import { describe, test, expect, vi, beforeEach } from 'vitest';

describe('MyComponent', () => {
  beforeEach(() => {
    // Setup
  });

  test('should do something', () => {
    // Arrange
    // Act
    // Assert
  });
});
```

### 5. Logging

Utilisez le logger structuré au lieu de `console.log` :

```typescript
import { logger } from '@ubora/shared/utils/logger';

// Debug (seulement en dev)
logger.debug('Debug message', { data }, 'Context');

// Info
logger.info('Info message', { data }, 'Context');

// Warning
logger.warn('Warning message', { data }, 'Context');

// Error
logger.error('Error message', error, 'Context');
```

### 6. Commit

Utilisez des messages de commit clairs :

```
feat: ajouter fonctionnalité X
fix: corriger bug Y
refactor: refactoriser composant Z
perf: optimiser performance
test: ajouter tests
docs: mettre à jour documentation
```

Exemple :
```bash
git commit -m "feat: ajouter TimeRestrictionsEditor component"
```

### 7. Pull Request

Avant de créer une PR :

- [ ] Tous les tests passent
- [ ] Code linté et formaté
- [ ] Aucun `console.log` restant
- [ ] Documentation mise à jour si nécessaire
- [ ] Types TypeScript stricts (pas de `any` sauf nécessaire)

## Bonnes pratiques

### Performance

1. **Mémorisation** : Mémorisez les composants de liste
2. **Lazy loading** : Utilisez pour les routes et gros composants
3. **Code splitting** : Séparez le code par fonctionnalité
4. **Optimisation contextes** : Utilisez des contextes spécialisés

### Sécurité

1. **Validation** : Validez toutes les entrées utilisateur
2. **Sanitization** : Nettoyez les données avant affichage
3. **Autorisation** : Vérifiez les permissions avant les actions
4. **Secrets** : Ne commitez jamais de secrets

### Accessibilité

1. **Labels** : Utilisez des labels appropriés
2. **ARIA** : Ajoutez des attributs ARIA quand nécessaire
3. **Clavier** : Assurez la navigation au clavier
4. **Contraste** : Vérifiez le contraste des couleurs

## Structure des fichiers

### Composants

```
components/
  ├── forms/
  │   ├── FormBuilder.tsx
  │   ├── FormEditor.tsx
  │   └── FormFieldsManager/
  ├── chat/
  │   └── DirecteurChat.tsx
  └── ui/
      ├── Button.tsx
      └── Card.tsx
```

### Services

```
services/
  ├── core/
  │   ├── userSessionService.ts
  │   └── fileUploadService.ts
  └── notifications/
      └── unifiedNotificationService.ts
```

### Hooks

```
hooks/
  ├── packages/
  │   └── usePackageAccess.ts
  └── core/
      └── useTokenStats.ts
```

## Checklist avant commit

- [ ] Code fonctionne localement
- [ ] Tests passent
- [ ] Pas de `console.log` restants
- [ ] Types TypeScript corrects
- [ ] Code formaté et linté
- [ ] Documentation mise à jour
- [ ] Pas de secrets dans le code
- [ ] Accessibilité vérifiée

## Questions ?

Si vous avez des questions :
1. Consultez la documentation dans `docs/`
2. Regardez les exemples de code existants
3. Créez une issue pour discuter

## Merci !

Votre contribution est appréciée. Merci de prendre le temps de suivre ce guide !


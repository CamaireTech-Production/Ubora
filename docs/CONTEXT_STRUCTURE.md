# Structure des Contextes React - Ubora

## Vue d'ensemble

L'application utilise React Context API pour la gestion d'état globale. Les contextes ont été divisés pour optimiser les performances et réduire les re-renders inutiles.

## Contextes principaux

### AuthContext

**Fichier** : `packages/shared/src/contexts/AuthContext.tsx`

**Responsabilité** : Gestion de l'authentification et de l'utilisateur actuel

**État** :
- `user` : Utilisateur actuel (User | null)
- `firebaseUser` : Utilisateur Firebase Auth
- `isLoading` : État de chargement

**Méthodes** :
- `login()` : Connexion
- `logout()` : Déconnexion
- `refreshUserData()` : Rafraîchir les données utilisateur

**Utilisation** :
```typescript
import { useAuth } from '@ubora/shared/contexts/AuthContext';

const { user, isLoading, logout } = useAuth();
```

### FormsContext

**Fichier** : `packages/shared/src/contexts/FormsContext.tsx`

**Responsabilité** : Gestion des formulaires

**État** :
- `forms` : Liste des formulaires (Form[])
- `isLoading` : État de chargement

**Méthodes** :
- `createForm()` : Créer un formulaire
- `updateForm()` : Mettre à jour un formulaire
- `deleteForm()` : Supprimer un formulaire
- `getFormById()` : Obtenir un formulaire par ID

**Utilisation** :
```typescript
import { useForms } from '@ubora/shared/contexts/FormsContext';

const { forms, createForm, isLoading } = useForms();
```

### EntriesContext

**Fichier** : `packages/shared/src/contexts/EntriesContext.tsx`

**Responsabilité** : Gestion des entrées de formulaires

**État** :
- `formEntries` : Liste des entrées (FormEntry[])
- `isLoading` : État de chargement

**Méthodes** :
- `submitFormEntry()` : Soumettre une entrée
- `updateFormEntry()` : Mettre à jour une entrée
- `getEntriesForForm()` : Obtenir les entrées d'un formulaire
- `submitMultipleFormEntries()` : Soumettre plusieurs entrées

**Utilisation** :
```typescript
import { useEntries } from '@ubora/shared/contexts/EntriesContext';

const { formEntries, submitFormEntry, isLoading } = useEntries();
```

### EmployeesContext

**Fichier** : `packages/shared/src/contexts/EmployeesContext.tsx`

**Responsabilité** : Gestion des employés

**État** :
- `employees` : Liste des employés (User[])
- `isLoading` : État de chargement

**Méthodes** :
- `getPendingEmployees()` : Obtenir les employés en attente d'approbation
- `approveEmployee()` : Approuver un employé
- `rejectEmployee()` : Rejeter un employé

**Utilisation** :
```typescript
import { useEmployees } from '@ubora/shared/contexts/EmployeesContext';

const { employees, getPendingEmployees, isLoading } = useEmployees();
```

### DashboardsContext

**Fichier** : `packages/shared/src/contexts/DashboardsContext.tsx`

**Responsabilité** : Gestion des tableaux de bord

**État** :
- `dashboards` : Liste des tableaux de bord (Dashboard[])
- `isLoading` : État de chargement

**Méthodes** :
- `createDashboard()` : Créer un tableau de bord
- `updateDashboard()` : Mettre à jour un tableau de bord
- `deleteDashboard()` : Supprimer un tableau de bord

**Utilisation** :
```typescript
import { useDashboards } from '@ubora/shared/contexts/DashboardsContext';

const { dashboards, createDashboard, isLoading } = useDashboards();
```

### ConversationContext

**Fichier** : `packages/shared/src/contexts/ConversationContext.tsx`

**Responsabilité** : Gestion des conversations de chat

**État** :
- `conversations` : Liste des conversations
- `currentConversation` : Conversation actuelle
- `messages` : Messages de la conversation actuelle
- `hasMoreMessages` : Indicateur de pagination

**Méthodes** :
- `createNewConversation()` : Créer une nouvelle conversation
- `loadConversation()` : Charger une conversation
- `loadMoreMessages()` : Charger plus de messages
- `triggerAutoLoad()` : Déclencher le chargement automatique

**Utilisation** :
```typescript
import { useConversation } from '@ubora/shared/contexts/ConversationContext';

const { conversations, currentConversation, messages, createNewConversation } = useConversation();
```

### AIResponseContext

**Fichier** : `packages/shared/src/contexts/AIResponseContext.tsx`

**Responsabilité** : Gestion des réponses IA

**État** :
- `isAIResponseActive` : Indicateur de réponse IA en cours

**Méthodes** :
- `setAIResponseActive()` : Définir l'état de réponse IA

**Utilisation** :
```typescript
import { useAIResponse } from '@ubora/shared/contexts/AIResponseContext';

const { isAIResponseActive, setAIResponseActive } = useAIResponse();
```

### UniversContext

**Fichier** : `packages/shared/src/contexts/UniversContext.tsx`

**Responsabilité** : Gestion des univers et instances

**État** :
- `activeUniversId` : ID de l'univers actif
- `activeInstanceId` : ID de l'instance active
- `universes` : Liste des univers

**Méthodes** :
- `setActiveUnivers()` : Définir l'univers actif
- `setActiveInstance()` : Définir l'instance active

**Utilisation** :
```typescript
import { useUnivers } from '@ubora/shared/contexts/UniversContext';

const { activeUniversId, activeInstanceId, setActiveUnivers } = useUnivers();
```

## Architecture de division

### Avant (AppContext monolithique)

Un seul contexte géant contenait :
- Forms
- Entries
- Employees
- Dashboards
- Et autres...

**Problème** : Tout changement dans un domaine déclenchait des re-renders partout.

### Après (Contextes spécialisés)

Chaque domaine a son propre contexte :
- FormsContext → Seuls les composants utilisant les forms se re-rendent
- EmployeesContext → Seuls les composants utilisant les employees se re-rendent
- Etc.

**Avantage** : Réduction significative des re-renders inutiles.

## Patterns d'utilisation

### Utilisation simple

```typescript
import { useForms } from '@ubora/shared/contexts/FormsContext';

function MyComponent() {
  const { forms, isLoading } = useForms();
  
  if (isLoading) return <Loader />;
  
  return <div>{forms.length} formulaires</div>;
}
```

### Utilisation avec plusieurs contextes

```typescript
import { useForms } from '@ubora/shared/contexts/FormsContext';
import { useEmployees } from '@ubora/shared/contexts/EmployeesContext';

function MyComponent() {
  const { forms } = useForms();
  const { employees } = useEmployees();
  
  // Seuls les changements dans forms OU employees déclenchent un re-render
  return <div>...</div>;
}
```

### Utilisation avec hooks personnalisés

```typescript
import { usePackageAccess } from '../../hooks/packages/usePackageAccess';

function MyComponent() {
  const { canCreateForm, getLimit } = usePackageAccess();
  
  // usePackageAccess utilise AuthContext en interne
  // Mais ne déclenche pas de re-render si seulement les forms changent
}
```

## Bonnes pratiques

1. **Utiliser uniquement les contextes nécessaires** : Ne pas importer tous les contextes si vous n'en utilisez qu'un
2. **Éviter les dépendances circulaires** : Les contextes ne doivent pas dépendre les uns des autres
3. **Mémoriser les valeurs calculées** : Utiliser useMemo pour les valeurs dérivées
4. **Séparer les données et les actions** : Les contextes séparent clairement l'état et les méthodes

## Migration depuis AppContext

Si vous trouvez du code utilisant encore `useApp()`, migrez-le vers les contextes spécialisés :

```typescript
// Avant
const { forms, employees } = useApp();

// Après
const { forms } = useForms();
const { employees } = useEmployees();
```

## Performance

### Réduction des re-renders

Avant la division :
- Changement dans forms → Re-render de TOUS les composants utilisant AppContext

Après la division :
- Changement dans forms → Re-render uniquement des composants utilisant FormsContext

### Optimisations supplémentaires

- Utilisation de `useMemo` dans les contextes pour mémoriser les valeurs calculées
- Utilisation de `useCallback` pour mémoriser les fonctions
- Séparation des données de lecture et d'écriture (si nécessaire)

## Tests

Les contextes sont testés via :
- Tests d'intégration avec les composants
- Tests unitaires des hooks personnalisés qui utilisent les contextes
- Tests smoke pour les chemins critiques


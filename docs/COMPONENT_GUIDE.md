# Guide des Composants - Ubora

## Vue d'ensemble

Ce guide décrit les composants principaux de l'application, leur utilisation et les bonnes pratiques.

## Composants de formulaire

### FormBuilder

**Fichier** : `apps/main/src/components/forms/FormBuilder.tsx`

**Description** : Composant pour créer de nouveaux formulaires

**Props** :
- `onSave` : Callback appelé lors de la sauvegarde
- `onCancel` : Callback appelé lors de l'annulation
- `employees` : Liste des employés pour assignation
- `currentUser` : Utilisateur actuel
- `initialForm` : Formulaire initial (optionnel, pour édition)
- `universLists` : Listes depuis le contexte Univers (optionnel)

**Utilisation** :
```typescript
<FormBuilder
  onSave={handleSave}
  onCancel={handleCancel}
  employees={employees}
  currentUser={user}
/>
```

**Composants enfants** :
- `FormMetadataEditor` : Édition titre/description
- `FormFieldsManager` : Gestion des champs
- `FormAssignment` : Assignation aux utilisateurs
- `TimeRestrictionsEditor` : Restrictions horaires

### FormEditor

**Fichier** : `apps/main/src/components/forms/FormEditor.tsx`

**Description** : Composant pour éditer un formulaire existant

**Props** :
- `form` : Formulaire à éditer
- `onSave` : Callback de sauvegarde
- `onCancel` : Callback d'annulation
- `employees` : Liste des employés
- `currentUser` : Utilisateur actuel

**Utilisation** :
```typescript
<FormEditor
  form={selectedForm}
  onSave={handleUpdate}
  onCancel={handleCancel}
  employees={employees}
  currentUser={user}
/>
```

**Note** : Réutilise les mêmes composants que FormBuilder pour la cohérence.

### DynamicForm

**Fichier** : `apps/main/src/components/forms/DynamicForm.tsx`

**Description** : Composant pour afficher et remplir un formulaire dynamique

**Props** :
- `form` : Formulaire à afficher
- `onSubmit` : Callback lors de la soumission
- `onCancel` : Callback d'annulation
- `initialAnswers` : Réponses initiales (optionnel)

**Fonctionnalités** :
- Validation des champs
- Calculs automatiques
- Logique conditionnelle
- Upload de fichiers
- Sauvegarde de brouillon

## Composants de chat

### DirecteurChat

**Fichier** : `apps/main/src/pages/chat/DirecteurChat.tsx`

**Description** : Page principale du chat avec IA

**Fonctionnalités** :
- Conversations multiples
- Filtres de recherche
- Historique des messages
- Intégration avec ARCHA (IA)

**Composants enfants** :
- `ChatContainer` : Conteneur principal
- `ChatMessageHandler` : Gestion des messages
- `ChatFilters` : Filtres de conversation
- `FloatingSidePanel` : Panneau latéral

### ChatMessageHandler

**Fichier** : `apps/main/src/pages/chat/ChatMessageHandler/useChatMessageHandler.ts`

**Description** : Hook personnalisé pour gérer la logique des messages

**Fonctionnalités** :
- Envoi de messages
- Réception de réponses IA
- Gestion des erreurs
- Mise à jour de l'état

## Composants de dashboard

### DashboardBuilder

**Fichier** : `apps/main/src/components/dashboard/DashboardBuilder.tsx`

**Description** : Composant pour créer et éditer des tableaux de bord

**Props** :
- `dashboard` : Tableau de bord à éditer (optionnel)
- `onSave` : Callback de sauvegarde
- `onCancel` : Callback d'annulation

**Fonctionnalités** :
- Ajout de métriques
- Configuration de graphiques
- Personnalisation de l'affichage

### DashboardDisplay

**Fichier** : `apps/main/src/components/dashboard/DashboardDisplay.tsx`

**Description** : Composant pour afficher un tableau de bord

**Props** :
- `dashboard` : Tableau de bord à afficher
- `formEntries` : Entrées de formulaires pour les données

**Fonctionnalités** :
- Affichage des métriques
- Graphiques interactifs
- Export PDF/Excel

## Composants d'employés

### UsersTable

**Fichier** : `apps/main/src/components/employees/UsersTable.tsx`

**Description** : Tableau affichant la liste des utilisateurs

**Props** :
- `users` : Liste des utilisateurs
- `onApprove` : Callback d'approbation
- `onReject` : Callback de rejet
- `onEdit` : Callback d'édition

**Optimisations** :
- Mémorisé avec React.memo
- Comparaison par user.id et users.length

### PendingApprovals

**Fichier** : `apps/main/src/components/employees/PendingApprovals.tsx`

**Description** : Composant pour gérer les approbations en attente

**Props** :
- `pendingEmployees` : Liste des employés en attente
- `onApprove` : Callback d'approbation
- `onReject` : Callback de rejet

## Composants UI de base

### Button

**Fichier** : `apps/main/src/components/ui/Button.tsx`

**Description** : Bouton réutilisable avec variantes

**Props** :
- `variant` : 'primary' | 'secondary' | 'danger'
- `size` : 'sm' | 'md' | 'lg'
- `disabled` : État désactivé
- `onClick` : Handler de clic

**Utilisation** :
```typescript
<Button variant="primary" size="md" onClick={handleClick}>
  Cliquer
</Button>
```

### Card

**Fichier** : `apps/main/src/components/ui/Card.tsx`

**Description** : Conteneur de carte avec ombre et bordure

**Props** :
- `className` : Classes CSS additionnelles
- `children` : Contenu de la carte

**Utilisation** :
```typescript
<Card className="p-4">
  <h2>Titre</h2>
  <p>Contenu</p>
</Card>
```

### Input, Textarea, Select

**Fichiers** : `apps/main/src/components/ui/Input.tsx`, etc.

**Description** : Composants de formulaire stylisés

**Props standards** :
- `value` : Valeur contrôlée
- `onChange` : Handler de changement
- `placeholder` : Texte de placeholder
- `disabled` : État désactivé

## Composants de chargement

### WireframeLoader

**Fichier** : `apps/main/src/components/loading/WireframeLoader.tsx`

**Description** : Skeleton loader pour les routes lazy-loaded

**Props** :
- `type` : Type de loader ('chat' | 'dashboard' | 'form' | 'default')

**Utilisation** :
```typescript
<Suspense fallback={<WireframeLoader type="chat" />}>
  <DirecteurChat />
</Suspense>
```

### LoadingGuard

**Fichier** : `apps/main/src/components/loading/LoadingGuard.tsx`

**Description** : Garde de chargement pour protéger les routes

**Props** :
- `isLoading` : État de chargement
- `children` : Contenu à afficher une fois chargé

## Composants modaux

### LimitReachedModal

**Fichier** : `apps/main/src/components/modals/LimitReachedModal.tsx`

**Description** : Modal affichée quand une limite de package est atteinte

**Props** :
- `isOpen` : État d'ouverture
- `onClose` : Callback de fermeture
- `type` : Type de limite ('forms' | 'dashboards' | 'users' | 'tokens')
- `current` : Valeur actuelle
- `limit` : Limite maximale
- `onUpgrade` : Callback pour upgrade
- `onPayAsYouGo` : Callback pour pay-as-you-go

### ConfirmationModal

**Fichier** : `apps/main/src/components/modals/ConfirmationModal.tsx`

**Description** : Modal de confirmation générique

**Props** :
- `isOpen` : État d'ouverture
- `onClose` : Callback de fermeture
- `onConfirm` : Callback de confirmation
- `title` : Titre de la modal
- `message` : Message de confirmation
- `variant` : 'danger' | 'warning' | 'info'

## Bonnes pratiques

### Mémorisation

Utilisez `React.memo` pour les composants de liste qui re-rendent fréquemment :

```typescript
export const MyListComponent = React.memo<MyListComponentProps>(({ items }) => {
  // ...
}, (prevProps, nextProps) => {
  return prevProps.items.length === nextProps.items.length &&
         prevProps.items.every((item, i) => item.id === nextProps.items[i]?.id);
});
```

### Gestion d'état locale

Utilisez `useState` pour l'état local simple :

```typescript
const [isOpen, setIsOpen] = useState(false);
```

### Gestion d'état globale

Utilisez les contextes appropriés pour l'état global :

```typescript
const { forms, createForm } = useForms();
```

### Props

- Préférez des props explicites plutôt que de passer tout un objet
- Utilisez des types TypeScript stricts
- Documentez les props complexes avec JSDoc

### Performance

- Mémorisez les valeurs calculées avec `useMemo`
- Mémorisez les callbacks avec `useCallback`
- Évitez les re-renders inutiles avec `React.memo`

### Accessibilité

- Utilisez des labels appropriés
- Ajoutez des attributs ARIA quand nécessaire
- Assurez la navigation au clavier
- Contraste des couleurs suffisant

## Patterns courants

### Pattern Container/Presentational

Séparez la logique (Container) de la présentation (Presentational) :

```typescript
// Container (logique)
function MyComponentContainer() {
  const { data, isLoading } = useData();
  const handleAction = useCallback(() => { /* ... */ }, []);
  
  return <MyComponentView data={data} isLoading={isLoading} onAction={handleAction} />;
}

// Presentational (UI)
function MyComponentView({ data, isLoading, onAction }) {
  if (isLoading) return <Loader />;
  return <div>{/* UI */}</div>;
}
```

### Pattern Custom Hook

Extrayez la logique réutilisable dans des hooks :

```typescript
function useMyFeature() {
  const [state, setState] = useState();
  const action = useCallback(() => { /* ... */ }, []);
  return { state, action };
}
```


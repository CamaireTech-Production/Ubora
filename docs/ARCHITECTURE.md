# Architecture de l'application Ubora

## Vue d'ensemble

Ubora est une application web progressive (PWA) construite avec React, TypeScript et Firebase. L'application suit une architecture monorepo avec trois applications principales :

- **apps/main** : Application principale pour les directeurs et employés
- **apps/admin** : Interface d'administration
- **api** : Backend Node.js/Express pour les API et workers

## Structure du monorepo

```
Ubora/
├── apps/
│   ├── main/              # Application principale
│   │   ├── src/
│   │   │   ├── components/    # Composants React
│   │   │   ├── pages/         # Pages/écrans
│   │   │   ├── hooks/          # Hooks personnalisés
│   │   │   ├── services/       # Services métier
│   │   │   ├── utils/          # Utilitaires
│   │   │   └── types/          # Types TypeScript
│   │   └── dist/              # Build de production
│   └── admin/             # Application admin
├── packages/
│   └── shared/            # Code partagé
│       ├── src/
│       │   ├── contexts/      # Contextes React partagés
│       │   ├── services/      # Services partagés
│       │   ├── utils/         # Utilitaires partagés
│       │   ├── types/         # Types partagés
│       │   └── hooks/         # Hooks partagés
│       └── package.json
├── api/                   # Backend API
│   ├── ai/                # Endpoints IA
│   ├── lib/               # Bibliothèques backend
│   ├── workers/           # Workers en arrière-plan
│   └── cron/              # Tâches cron
└── docs/                  # Documentation
```

## Architecture Frontend (apps/main)

### Structure des composants

Les composants sont organisés par domaine fonctionnel :

- **components/forms/** : Composants liés aux formulaires
  - `FormBuilder.tsx` : Création de formulaires
  - `FormEditor.tsx` : Édition de formulaires
  - `DynamicForm.tsx` : Affichage et remplissage de formulaires
  - `FormFieldsManager/` : Gestion des champs de formulaire
  - `FormAssignment/` : Assignation aux utilisateurs
  - `TimeRestrictionsEditor.tsx` : Restrictions horaires

- **components/chat/** : Interface de chat avec IA
  - `DirecteurChat.tsx` : Page principale du chat
  - `ChatContainer.tsx` : Conteneur du chat
  - `ChatMessageHandler/` : Gestion des messages
  - `ChatFilters/` : Filtres de conversation

- **components/dashboard/** : Tableaux de bord
  - `DashboardBuilder.tsx` : Création de tableaux de bord
  - `DashboardDisplay.tsx` : Affichage des tableaux de bord

- **components/employees/** : Gestion des employés
  - `UsersTable.tsx` : Liste des utilisateurs
  - `PendingApprovals.tsx` : Approbations en attente

### Gestion d'état

L'application utilise React Context API pour la gestion d'état globale, avec des contextes spécialisés :

- **AuthContext** : Authentification et utilisateur actuel
- **FormsContext** : Formulaires et opérations CRUD
- **EntriesContext** : Entrées de formulaires
- **EmployeesContext** : Employés et gestion des utilisateurs
- **DashboardsContext** : Tableaux de bord
- **ConversationContext** : Conversations de chat
- **AIResponseContext** : Réponses IA
- **UniversContext** : Univers et instances

### Services

Les services encapsulent la logique métier et les interactions avec Firebase :

- **userSessionService.ts** : Gestion des sessions et packages
- **fileUploadService.ts** : Upload de fichiers
- **unifiedNotificationService.ts** : Notifications unifiées
- **scheduledQuestionExecutor.ts** : Exécution de questions programmées

### Hooks personnalisés

- **usePackageAccess** : Accès aux fonctionnalités selon le package
- **useTokenStats** : Statistiques d'utilisation des tokens
- **usePushNotifications** : Notifications push
- **useFormDraft** : Brouillons de formulaires
- **usePermissions** : Gestion des permissions

### Optimisations de performance

- **Lazy loading** : Toutes les routes sont chargées à la demande
- **Mémorisation** : Composants de liste mémorisés avec React.memo
- **Code splitting** : Séparation automatique des bundles
- **Context splitting** : Contextes divisés pour réduire les re-renders

## Architecture Backend (api)

### Endpoints principaux

- **api/ai/ask.js** : Endpoint principal pour les questions IA
- **api/ai/format.js** : Formatage de réponses
- **api/notifications/** : Gestion des notifications
- **api/vector/sync.js** : Synchronisation vectorielle

### Workers

- **workers/vectorSync.js** : Synchronisation des données vectorielles
- **api/background/formattingWorker.js** : Formatage en arrière-plan

### Services backend

- **lib/vectorDb.js** : Base de données vectorielle (Qdrant)
- **lib/embeddings.js** : Génération d'embeddings
- **lib/dataExtractor.js** : Extraction de données
- **lib/logger.js** : Système de logging structuré

## Packages partagés

Le package `@ubora/shared` contient le code réutilisable entre les applications :

- **Contextes** : Contextes React partagés
- **Services** : Services partagés (Firebase, notifications)
- **Utils** : Utilitaires (logger, dateHelpers, FormulaParser)
- **Types** : Types TypeScript partagés
- **Hooks** : Hooks React partagés

## Flux de données

### Authentification

1. Utilisateur se connecte via Firebase Auth
2. AuthContext charge les données utilisateur depuis Firestore
3. Vérification du package et des permissions
4. Redirection selon le rôle (directeur/employé)

### Création de formulaire

1. Directeur crée un formulaire via FormBuilder
2. Validation côté client
3. Sauvegarde dans Firestore via FormsContext
4. Notification aux employés assignés
5. Mise à jour des statistiques de package

### Chat avec IA

1. Utilisateur envoie une question
2. ChatMessageHandler prépare la requête
3. Appel à `/api/ai/ask`
4. Backend charge les données contextuelles
5. Génération de réponse via OpenAI
6. Formatage et affichage de la réponse
7. Sauvegarde de la conversation

## Sécurité

- **Authentification** : Firebase Authentication
- **Autorisation** : Firestore Security Rules
- **Validation** : Validation côté client et serveur
- **Sanitization** : Nettoyage des entrées utilisateur
- **CORS** : Configuration CORS pour l'API

## Performance

### Optimisations frontend

- Lazy loading des routes
- Mémorisation des composants
- Code splitting automatique
- Optimisation des contextes
- Debouncing des requêtes

### Optimisations backend

- Mise en cache des embeddings
- Pagination des requêtes Firestore
- Index Firestore optimisés
- Workers pour tâches longues

## Tests

### Structure des tests

- **__tests__/smoke/** : Tests smoke pour chemins critiques
- **services/__tests__/** : Tests unitaires des services
- **hooks/__tests__/** : Tests unitaires des hooks
- **utils/__tests__/** : Tests unitaires des utils

### Couverture cible

- Services : 80%+
- Hooks : 70%+
- Utils : 90%+
- Composants critiques : 60%+

## Déploiement

- **Frontend** : Build Vite → Firebase Hosting
- **Backend** : Node.js → VPS ou Cloud Run
- **Database** : Firestore
- **Storage** : Firebase Storage
- **Vector DB** : Qdrant

## Logging

- **Frontend** : Logger structuré avec niveaux (debug, info, warn, error)
- **Backend** : Logger Winston avec fichiers séparés
- **Production** : Format JSON pour parsing
- **Development** : Format lisible avec emojis

## Évolutions futures

- Migration vers microservices
- Ajout de cache Redis
- Optimisation des requêtes Firestore
- Amélioration de la couverture de tests
- Documentation API complète


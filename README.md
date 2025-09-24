# Application Multi-Agences

Une application de gestion multi-agences avec Firebase Auth et Firestore utilisant un système de formulaires dynamiques.

## 🚀 Fonctionnalités

- **Authentification Firebase** : Connexion par email/mot de passe et Google
- **Gestion des rôles** : Directeur et Employé avec permissions différenciées
- **Formulaires dynamiques** : Création et attribution de formulaires personnalisés
- **Soumissions multiples** : Les employés peuvent soumettre plusieurs fois le même formulaire
- **Dashboard interactif** : Statistiques en temps réel
- **Export de données** : PDF des rapports
- **Interface responsive** : Optimisée mobile-first
- **OCR avancé** : Extraction de texte d'images avec OpenAI Vision API (excellent pour le texte manuscrit et les images de faible qualité)

## 🔍 Configuration OCR (Automatique)

L'application utilise **OpenAI Vision API** pour l'extraction de texte depuis les images. Cette solution offre :

- **Précision exceptionnelle** pour le texte manuscrit
- **Support des images de faible qualité**
- **Reconnaissance multilingue** (français et anglais)
- **Utilise votre clé OpenAI existante** - aucune configuration supplémentaire
- **Fallback automatique** vers Tesseract.js si nécessaire
- **Traitement rapide** et fiable

### Fonctionnement
1. **OpenAI Vision API** : Service principal avec GPT-4o pour une précision maximale
2. **Tesseract.js** : Fallback automatique dans le navigateur
3. **Message informatif** : Si les deux méthodes échouent

Aucune configuration supplémentaire n'est nécessaire - l'OCR utilise automatiquement votre clé OpenAI lors de l'upload d'images.

## 🛠️ Configuration Firebase

### 🔑 Variables d'environnement requises

**OBLIGATOIRE** : Créez un fichier `.env.local` à la racine du projet (même niveau que `package.json`) avec vos vraies valeurs Firebase :

```bash
# .env.local (à créer à la racine)
VITE_FIREBASE_API_KEY=AIzaSyDjk-Y3jeoPy3nW_9MniNs8heBv17briMU
VITE_FIREBASE_AUTH_DOMAIN=studio-gpnfx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=studio-gpnfx
VITE_FIREBASE_STORAGE_BUCKET=studio-gpnfx.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=848246677738
VITE_FIREBASE_APP_ID=1:848246677738:web:7612dab5f030c52b227793

# Chat IA - Endpoint pour le mode RÉEL (laisser vide pour le mode MOCK)
VITE_AI_ENDPOINT=
```

⚠️ **IMPORTANT** : 
- Le fichier `.env.local` doit être à la **racine du projet** (pas dans src/)
- **Redémarrez le serveur** après création/modification : `npm run dev`
- Ne commitez **jamais** ce fichier (il est dans .gitignore)

### 🔍 Comment trouver vos clés Firebase

1. **Firebase Console** → https://console.firebase.google.com/
2. **Sélectionnez votre projet** `studio-gpnfx`
3. **⚙️ Project Settings** → **General**
4. **Section "Your apps"** → Votre app web → **Config**
5. **Copiez les valeurs** dans votre `.env.local`

**Si vous ne voyez pas d'app web** :
1. **Add app** → **Web** (icône `</>`)
2. **Nom de l'app** : "Multi-Agences Web"
3. **Ne cochez PAS** "Firebase Hosting"
4. **Register app** → Copiez la configuration

### 🚨 Dépannage Firebase

**Erreur "auth/invalid-api-key"** :
- Vérifiez que `.env.local` existe à la racine
- Vérifiez que `VITE_FIREBASE_API_KEY` est correct
- Redémarrez le serveur : `npm run dev`

**Variables manquantes** :
- Consultez la console navigateur pour voir les variables manquantes
- Vérifiez que toutes les variables commencent par `VITE_`

### 1. Variables d'environnement

**Le fichier `.env.local` est maintenant requis** avec vos vraies valeurs Firebase.

### 2. Créer un projet Firebase

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Créez un nouveau projet
3. Activez Authentication et Firestore

### 3. Configuration de l'authentification

1. Dans Authentication > Sign-in method, activez :
   - Email/Password
   - Google (optionnel)

### 4. Copier la configuration Firebase

1. Dans Project Settings > General > Your apps, cliquez sur l'icône de configuration (engrenage)
2. Copiez les valeurs de configuration Firebase
3. Collez-les dans votre fichier `.env.local` :

```bash
# .env.local
VITE_FIREBASE_API_KEY=AIzaSyD...
VITE_FIREBASE_AUTH_DOMAIN=votre-projet.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=votre-projet-id
VITE_FIREBASE_STORAGE_BUCKET=votre-projet.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

⚠️ **Important :** Ne commitez jamais le fichier `.env.local` ! Il est déjà dans `.gitignore`.

⚠️ **Redémarrage requis :** Après avoir créé ou modifié le fichier `.env.local`, redémarrez le serveur de développement (`npm run dev`).

### 5. Déployer les règles et indexes Firestore

Installez Firebase CLI :
```bash
npm install -g firebase-tools
```

Connectez-vous à Firebase :
```bash
firebase login
```

Initialisez le projet (si pas déjà fait) :
```bash
firebase init firestore
```

Déployez les règles et indexes :
```bash
firebase deploy --only firestore:rules,firestore:indexes
```

## 📊 Structure des collections Firestore

### `users`
```typescript
{
  id: string,           // UID Firebase Auth
  name: string,         // Nom complet
  email: string,        // Email
  role: 'directeur' | 'employe',
  agencyId: string,     // ID de l'agence
  createdAt: Timestamp, // Date de création
  updatedAt: Timestamp  // Date de mise à jour
}
```

### `forms`
```typescript
{
  id: string,
  title: string,
  description: string,
  fields: FormField[],
  createdBy: string,    // ID du directeur
  assignedTo: string[], // IDs des employés
  createdAt: Timestamp,
  agencyId: string
}
```

### `formEntries`
```typescript
{
  id: string,
  formId: string,       // Référence vers un formulaire
  userId: string,       // ID de l'employé (auth.uid)
  agencyId: string,     // Hérité du user
  answers: Record<string, any>, // Réponses { fieldId: valeur }
  submittedAt: Timestamp // serverTimestamp()
}
```

## 🔍 Index Firestore à créer

Les index suivants sont **OBLIGATOIRES** pour le bon fonctionnement de l'application :

### Index composites requis :

1. **Collection `users`** :
   - `agencyId` (ASC) + `role` (ASC) + `name` (ASC)
   - *Utilisé pour* : Lister les employés d'une agence triés par nom

2. **Collection `forms`** :
   - `agencyId` (ASC) + `createdAt` (ASC)
   - `agencyId` (ASC) + `createdAt` (DESC)
   - `agencyId` (ASC) + `title` (ASC)

3. **Collection `formEntries`** :
   - `agencyId` (ASC) + `submittedAt` (DESC)
   - `userId` (ASC) + `submittedAt` (DESC)
   - `formId` (ASC) + `submittedAt` (DESC)

4. **Field Override pour `assignedTo`** :
   - Collection `forms`, champ `assignedTo` : CONTAINS + COLLECTION

### Commandes pour créer les index :

```bash
# Déployer automatiquement tous les index
firebase deploy --only firestore:indexes

# Ou créer manuellement dans Firebase Console > Firestore > Index
```

## 🔒 Règles de sécurité Firestore

- **Directeurs** : Accès complet aux données de leur agence
- **Employés** : Peuvent créer des entrées de formulaires, voir les formulaires assignés
- **Isolation par agence** : Chaque agence ne voit que ses propres données
- **Authentification requise** : Aucun accès sans connexion
- **Validation des données** : Tous les champs requis sont vérifiés

## 🚀 Installation et démarrage

```bash
# Installer les dépendances
npm install

# Démarrer en développement
npm run dev

# Build pour production
npm run build
```

## 🌐 Déploiement

### Variables d'environnement pour Render

Lors du déploiement sur Render, configurez ces variables d'environnement :

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_AI_ENDPOINT` (URL de votre app Render)
- `FIREBASE_PROJECT_ID` (pour le backend)
- `FIREBASE_CLIENT_EMAIL` (pour le backend)
- `FIREBASE_PRIVATE_KEY` (pour le backend)
- `OPENAI_API_KEY` (pour l'IA)

**Render :** Dashboard > Environment Variables

## 🚀 Déploiement sur Render

### Configuration Render
- **Framework** : Node.js avec Express
- **Build Command** : `npm run render-build`
- **Start Command** : `npm start`
- **Node.js Version** : 18.x

### Structure des endpoints
- **Frontend** : `https://votre-app.onrender.com/` (SPA React)
- **API Santé** : `https://votre-app.onrender.com/api/ai/health`
- **API Chat IA** : `https://votre-app.onrender.com/api/ai/ask`

### Architecture Render
- **Frontend** : Fichiers statiques servis depuis `/dist`
- **Backend** : Serveur Express avec endpoints API
- **Base de données** : Firebase Firestore
- **IA** : Intégration OpenAI API

### Test de déploiement
```bash
# Test local du build
npm run build
npm start

# Test des endpoints en production
curl https://votre-app.onrender.com/api/ai/health
```

## 🤖 Modes du Chat IA

Le Chat IA fonctionne en deux modes distincts :

### **MODE MOCK (par défaut)**
- ✅ **Activation** : Laissez `VITE_AI_ENDPOINT` vide dans votre fichier `.env.local`
- ✅ **Fonctionnement** : Réponses simulées générées localement
- ✅ **Avantages** : Aucune dépendance externe, fonctionne hors ligne
- ✅ **Badge UI** : "MODE : MOCK" 🔧
- ✅ **Délai** : 600-900ms de simulation réaliste

### **MODE RÉEL (production)**
- ✅ **Activation** : Définissez `VITE_AI_ENDPOINT=https://votre-app.vercel.app/api/ai/ask`
- ✅ **Fonctionnement** : Appels HTTP vers votre endpoint IA
- ✅ **Avantages** : Analyses réelles basées sur vos données Firestore
- ✅ **Badge UI** : "MODE : RÉEL" 🌐
- ✅ **Sécurité** : Token Firebase automatiquement envoyé si disponible

### **Configuration pour le MODE RÉEL**

1. **Déployez l'endpoint IA** (voir section précédente)
2. **Ajoutez la variable d'environnement** :
   ```bash
   # Dans .env.local
   VITE_AI_ENDPOINT=https://votre-app.vercel.app/api/ai/ask
   ```
3. **Redémarrez le serveur** : `npm run dev`

### **Activation du mode RÉEL**

Pour utiliser l'endpoint IA réel au lieu des réponses simulées :

1. **Déployez le backend** (voir section "Backend IA")
2. **Ajoutez dans `.env.local`** :
   ```bash
   VITE_AI_ENDPOINT=https://votre-projet-vercel.vercel.app/api/ai/ask
   ```
3. **Redémarrez le serveur de développement**
4. Le badge passera automatiquement en "MODE : RÉEL" 🌐

### **Sécurité importante**

⚠️ **CRITIQUE** : L'endpoint réel doit être **sécurisé côté serveur** avec :
- **Firebase Admin SDK** pour valider les tokens
- **OPENAI_API_KEY** stockée uniquement côté serveur
- **Jamais** exposer la clé OpenAI au client

### **Interface utilisateur**

- **Badge de mode** : Affiché en haut du chat pour identifier le mode actuel
- **Temps de réponse** : Affiché sous chaque message de l'assistant
- **Gestion d'erreurs** : Messages d'erreur différenciés selon le mode
- **Bouton désactivé** : Pendant le traitement d'une requête

## 🤖 Configuration du Chat IA

Le Chat IA est intégré directement dans l'application et fonctionne avec Render.

### Variables d'environnement requises

```bash
# Firebase Admin SDK (pour le backend)
FIREBASE_PROJECT_ID=votre-projet-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@votre-projet.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nVotre clé privée\n-----END PRIVATE KEY-----\n"

# OpenAI API
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# URL de l'endpoint (côté client)
VITE_AI_ENDPOINT=https://votre-app.onrender.com/api/ai/ask
```

### Obtenir les clés Firebase Admin

1. Allez dans [Firebase Console](https://console.firebase.google.com/)
2. Project Settings > Service Accounts
3. Cliquez sur "Generate new private key"
4. Téléchargez le fichier JSON
5. Utilisez les valeurs `project_id`, `client_email`, et `private_key`

⚠️ **Important** : La `private_key` doit conserver les `\n` pour les retours à la ligne.

### Obtenir la clé OpenAI

1. Créez un compte sur [OpenAI Platform](https://platform.openai.com/)
2. Allez dans API Keys
3. Créez une nouvelle clé secrète
4. Copiez la clé `sk-...`

### Test de l'endpoint

```bash
# 1. Tester la santé du service
curl https://votre-app.onrender.com/api/ai/health
# Doit répondre: {"ok":true,"ts":1234567890,...}

# 2. Tester l'endpoint principal (nécessite un token Firebase)
curl -X POST https://votre-app.onrender.com/api/ai/ask \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_ID_TOKEN" \
  -d '{
    "question": "Résumé de cette semaine",
    "filters": { "period": "this_week" }
  }'
```

## 📱 Utilisation

### Directeur
1. Créer un compte avec le rôle "Directeur"
2. Créer des formulaires personnalisés avec différents types de champs
3. Assigner les formulaires aux employés
4. Consulter toutes les réponses soumises
5. Exporter les données en PDF

### Employé
1. Créer un compte avec le rôle "Employé"
2. Voir les formulaires assignés par le directeur
3. Remplir et soumettre les formulaires (soumissions multiples autorisées)
4. Consulter l'historique de ses propres réponses

## 🔧 Technologies utilisées

- **React 18** avec TypeScript
- **Firebase Auth** pour l'authentification
- **Firestore** pour la base de données
- **Tailwind CSS** pour le styling
- **React Router** pour la navigation
- **React-to-Print** pour l'export PDF

## 📝 Notes de développement

- L'application utilise le Context API pour la gestion d'état
- Les données sont synchronisées en temps réel avec Firestore
- Guards UI pour éviter les requêtes avec des utilisateurs non chargés
- Tous les champs requis par Firestore sont forcés lors des écritures
- Le code est structuré de manière modulaire pour faciliter la maintenance
- Gestion d'erreurs robuste avec ErrorBoundaries

## 🚨 Points critiques

1. **Document utilisateur obligatoire** : Un document `users/{uid}` doit exister pour chaque utilisateur connecté
2. **Champs forcés** : `userId = auth.uid`, `agencyId` hérité, `submittedAt = serverTimestamp()`
3. **Index requis** : Les index composites sont obligatoires pour les requêtes
4. **Guards UI** : Vérification que `auth.currentUser` et `users/{uid}` sont chargés avant les requêtes
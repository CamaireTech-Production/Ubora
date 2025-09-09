# 🛠️ Development Setup Guide

## Quick Start for AI Chat

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables
Create a `.env.local` file in the root directory with your Firebase config:

```bash
# Firebase Configuration (Frontend)
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123

# AI Chat Configuration
# Leave empty for local development (will use localhost:3000)
# Set to your deployed URL for production
VITE_AI_ENDPOINT=

# Firebase Admin SDK (Backend - for local development)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your_project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"

# OpenAI API Key (Optional - for AI responses)
OPENAI_API_KEY=sk-your_openai_api_key
```

### 3. Start Development Servers

**Option A: Start both frontend and backend together**
```bash
npm run dev:full
```

**Option B: Start separately**
```bash
# Terminal 1: Start backend server
npm run dev:server

# Terminal 2: Start frontend
npm run dev
```

### 4. Test the AI Chat

1. Open http://localhost:5173
2. Login as a director
3. Go to Chat IA
4. Ask a question like "Résumé de cette semaine"

## How It Works

- **Local Development**: Frontend automatically uses `http://localhost:3000/api/ai/ask`
- **Production**: Set `VITE_AI_ENDPOINT` to your deployed URL
- **Fallback**: If OpenAI is not configured, the chat will still work with basic data summaries

## Troubleshooting

### AI Chat Not Working?
1. Check that the backend server is running on port 3000
2. Verify Firebase Admin SDK credentials in `.env.local`
3. Check browser console for errors
4. Test the health endpoint: http://localhost:3000/api/ai/health

### Firebase Errors?
1. Ensure all Firebase config variables are set
2. Check that Firestore rules are deployed
3. Verify user has director role in Firestore

### OpenAI Not Working?
- The chat will still work without OpenAI, just with basic summaries
- Check that `OPENAI_API_KEY` is valid if you want AI responses

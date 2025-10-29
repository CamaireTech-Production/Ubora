import dotenv from 'dotenv';
import path from 'path';
const loadedLocalEnv = dotenv.config({ path: path.join(process.cwd(), '.env.local') });
if (!loadedLocalEnv || !loadedLocalEnv.parsed) {
  dotenv.config({ path: path.join(process.cwd(), '.env') });
}

import admin from 'firebase-admin';

let mockAdmin = null;

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  console.log('🔧 Initializing Firebase Admin SDK...');
  
  // Validation des variables d'environnement
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  
  console.log('Environment check:', {
    projectId: projectId ? '✅ Set' : '❌ Missing',
    clientEmail: clientEmail ? '✅ Set' : '❌ Missing',
    privateKey: privateKey ? '✅ Set' : '❌ Missing'
  });

  // For development, allow missing or invalid Firebase credentials with a warning
  if (!projectId || !clientEmail || !privateKey || privateKey.length < 100) {
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev' || !process.env.NODE_ENV) {
      console.warn('⚠️ Firebase Admin credentials missing or invalid in development mode. Using mock Firebase.');
      console.warn('⚠️ To fix: Set proper FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in your .env.local file');
      
      // Create a mock admin object for development
      mockAdmin = {
        auth: () => ({
          verifyIdToken: () => Promise.reject(new Error('Firebase not configured')),
          createCustomToken: () => Promise.reject(new Error('Firebase not configured'))
        }),
        firestore: () => ({
          collection: () => ({
            doc: () => ({
              get: () => Promise.reject(new Error('Firebase not configured')),
              set: () => Promise.reject(new Error('Firebase not configured'))
            })
          })
        })
      };
    } else {
      throw new Error('Variables d\'environnement Firebase Admin manquantes. Vérifiez FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, et FIREBASE_PRIVATE_KEY.');
    }
  } else {
    // Nettoyer et formater la clé privée
    let cleanPrivateKey = privateKey;
    if (cleanPrivateKey && !cleanPrivateKey.includes('\\n')) {
      cleanPrivateKey = cleanPrivateKey.replace(/\\n/g, '\n');
    }

    const serviceAccount = {
      type: "service_account",
      project_id: projectId,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || "49cf718bd7049b5fcc3e2e6fbc583ebcec3b373d",
      private_key: cleanPrivateKey,
      client_email: clientEmail,
      client_id: process.env.FIREBASE_CLIENT_ID || "113149690446202662127",
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(clientEmail)}`,
      universe_domain: "googleapis.com"
    };

    try {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: projectId
      });
      console.log('✅ Firebase Admin SDK initialized successfully');
    } catch (error) {
      console.error('❌ Firebase Admin SDK initialization failed:', error);
      
      // In development, provide a fallback instead of crashing
      if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev' || !process.env.NODE_ENV) {
        console.warn('⚠️ Using mock Firebase Admin in development mode due to initialization error');
        
        mockAdmin = {
          auth: () => ({
            verifyIdToken: () => Promise.reject(new Error('Firebase not configured')),
            createCustomToken: () => Promise.reject(new Error('Firebase not configured'))
          }),
          firestore: () => ({
            collection: () => ({
              doc: () => ({
                get: () => Promise.reject(new Error('Firebase not configured')),
                set: () => Promise.reject(new Error('Firebase not configured'))
              })
            })
          })
        };
      } else {
        throw error;
      }
    }
  }
}

// Export des services - use mock if available, otherwise use real admin
const adminAuth = mockAdmin ? mockAdmin.auth() : admin.auth();
const adminDb = mockAdmin ? mockAdmin.firestore() : admin.firestore();

export { adminAuth, adminDb, admin };
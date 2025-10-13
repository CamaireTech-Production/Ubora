const admin = require('firebase-admin');

// Initialisation idempotente de Firebase Admin
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
      const mockAdmin = {
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
      
      module.exports = {
        admin: mockAdmin,
        adminAuth: mockAdmin.auth(),
        adminDb: mockAdmin.firestore()
      };
      return;
    } else {
      throw new Error('Variables d\'environnement Firebase Admin manquantes. Vérifiez FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, et FIREBASE_PRIVATE_KEY.');
    }
  }

  // Nettoyer et formater la clé privée
  let cleanPrivateKey = privateKey;
  
  // Remplacer les \n par de vrais retours à la ligne
  if (cleanPrivateKey.includes('\\n')) {
    cleanPrivateKey = cleanPrivateKey.replace(/\\n/g, '\n');
  }
  
  // Nettoyer les espaces et caractères indésirables
  cleanPrivateKey = cleanPrivateKey.trim();
  
  // S'assurer que la clé commence et finit correctement
  if (!cleanPrivateKey.startsWith('-----BEGIN PRIVATE KEY-----')) {
    cleanPrivateKey = '-----BEGIN PRIVATE KEY-----\n' + cleanPrivateKey;
  }
  if (!cleanPrivateKey.endsWith('-----END PRIVATE KEY-----')) {
    cleanPrivateKey = cleanPrivateKey + '\n-----END PRIVATE KEY-----';
  }
  
  // S'assurer qu'il y a un retour à la ligne final
  if (!cleanPrivateKey.endsWith('\n')) {
    cleanPrivateKey = cleanPrivateKey + '\n';
  }
  
  console.log('🔍 Private key format check:', {
    startsWithBegin: cleanPrivateKey.startsWith('-----BEGIN PRIVATE KEY-----'),
    endsWithEnd: cleanPrivateKey.endsWith('-----END PRIVATE KEY-----\n'),
    length: cleanPrivateKey.length,
    hasNewlines: cleanPrivateKey.includes('\n')
  });

  const serviceAccount = {
    projectId: projectId,
    clientEmail: clientEmail,
    privateKey: cleanPrivateKey,
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
      
      const mockAdmin = {
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
      
      module.exports = {
        admin: mockAdmin,
        adminAuth: mockAdmin.auth(),
        adminDb: mockAdmin.firestore()
      };
      return;
    } else {
      throw error;
    }
  }
}

// Export des services
const adminAuth = admin.auth();
const adminDb = admin.firestore();

module.exports = { adminAuth, adminDb, admin };
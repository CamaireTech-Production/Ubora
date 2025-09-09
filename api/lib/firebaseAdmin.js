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

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Variables d\'environnement Firebase Admin manquantes. Vérifiez FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, et FIREBASE_PRIVATE_KEY.');
  }

  // Nettoyer et formater la clé privée
  let cleanPrivateKey = privateKey;
  
  // Remplacer les \n par de vrais retours à la ligne
  if (cleanPrivateKey.includes('\\n')) {
    cleanPrivateKey = cleanPrivateKey.replace(/\\n/g, '\n');
  }
  
  // S'assurer que la clé commence et finit correctement
  if (!cleanPrivateKey.startsWith('-----BEGIN PRIVATE KEY-----')) {
    cleanPrivateKey = '-----BEGIN PRIVATE KEY-----\n' + cleanPrivateKey;
  }
  if (!cleanPrivateKey.endsWith('-----END PRIVATE KEY-----\n')) {
    cleanPrivateKey = cleanPrivateKey + '\n-----END PRIVATE KEY-----\n';
  }

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
    throw error;
  }
}

// Export des services
const adminAuth = admin.auth();
const adminDb = admin.firestore();

module.exports = { adminAuth, adminDb };
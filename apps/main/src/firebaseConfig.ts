// src/firebaseConfig.ts
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging, isSupported } from "firebase/messaging";
import { getAnalytics, isSupported as isAnalyticsSupported } from "firebase/analytics";
import { logger } from '@ubora/shared/utils/logger';

// Configuration Firebase avec vos vraies clés
// Note: measurementId est omis pour éviter les warnings de mismatch
// Firebase Analytics récupérera automatiquement le bon measurementId depuis le serveur
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDjk-Y3jeoPy3nW_9MniNs8heBv17briMU",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "studio-gpnfx.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "studio-gpnfx",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "studio-gpnfx.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "848246677738",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:848246677738:web:7612dab5f030c52b227793",
  // measurementId removed to avoid mismatch warning - Firebase will fetch it from server
};

// Validation complète de la configuration
const requiredFields = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
const missingFields = requiredFields.filter(field => !firebaseConfig[field as keyof typeof firebaseConfig]);

if (missingFields.length > 0) {
  logger.error('Variables d\'environnement manquantes', { missingFields }, 'firebaseConfig');
  logger.error('Créez un fichier .env.local à la racine avec vos clés Firebase', null, 'firebaseConfig');
  logger.error('Redémarrez le serveur après création du fichier', null, 'firebaseConfig');
}

// Validation spécifique des formats
if (firebaseConfig.apiKey && firebaseConfig.apiKey.length < 30) {
  logger.error('VITE_FIREBASE_API_KEY semble invalide (trop courte)', null, 'firebaseConfig');
}

if (firebaseConfig.appId && !firebaseConfig.appId.includes(':web:')) {
  logger.error('VITE_FIREBASE_APP_ID format invalide (attendu: 1:xxx:web:xxx)', null, 'firebaseConfig');
}

// Initialisation de l'app Firebase (HMR-safe singleton)
const globalForFirebase = globalThis as unknown as {
  __UBORA_FIREBASE_APP__?: any;
  __UBORA_FIRESTORE__?: Firestore;
};

let app: any;
try {
  app = globalForFirebase.__UBORA_FIREBASE_APP__ || (getApps().length ? getApp() : initializeApp(firebaseConfig));
  globalForFirebase.__UBORA_FIREBASE_APP__ = app;
} catch (error) {
  logger.error('Erreur lors de l\'initialisation', error, 'firebaseConfig');
  throw new Error('Configuration Firebase invalide. Vérifiez vos clés dans .env.local');
}

// Initialisation des services
export const auth = getAuth(app);
// Firestore singleton with stable configuration
export const db = ((): Firestore => {
  if (globalForFirebase.__UBORA_FIRESTORE__) return globalForFirebase.__UBORA_FIRESTORE__ as Firestore;
  
  try {
    const instance = getFirestore(app);
    globalForFirebase.__UBORA_FIRESTORE__ = instance;
    
    // Firebase v10.13.2 has offline persistence enabled by default
    // No need to manually enable it
    logger.info('Firestore initialized successfully', null, 'firebaseConfig');
    
    return instance;
  } catch (error) {
    logger.error('Firestore initialization failed', error, 'firebaseConfig');
    throw new Error('Firestore initialization failed');
  }
})();
export const storage = getStorage(app);

// Initialisation de Firebase Messaging (seulement si supporté)
export const messaging = isSupported().then((supported) => {
  if (supported) {
    return getMessaging(app);
  } else {
    return null;
  }
});

// Initialisation de Firebase Analytics (seulement si supporté)
// Note: Le warning de mismatch du measurementId est normal et peut être ignoré.
// Firebase récupère automatiquement le bon measurementId depuis le serveur,
// mais compare avec celui qui pourrait être dans les variables d'environnement.
// Ce warning n'affecte pas le fonctionnement d'Analytics.
// Pour supprimer complètement le warning, supprimez la variable d'environnement
// VITE_FIREBASE_MEASUREMENT_ID de votre fichier .env.local
export const analytics = isAnalyticsSupported().then((supported) => {
  if (supported) {
    return getAnalytics(app);
  } else {
    return null;
  }
});

// Export de l'app pour les services
export { app };

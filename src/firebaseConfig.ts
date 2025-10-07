// src/firebaseConfig.ts
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, Firestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging, isSupported } from "firebase/messaging";
import { getAnalytics, isSupported as isAnalyticsSupported } from "firebase/analytics";

// Configuration Firebase avec vos vraies clés
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDjk-Y3jeoPy3nW_9MniNs8heBv17briMU",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "studio-gpnfx.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "studio-gpnfx",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "studio-gpnfx.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "848246677738",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:848246677738:web:7612dab5f030c52b227793",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-6TWRQHW70W",
};

// Validation complète de la configuration
const requiredFields = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
const missingFields = requiredFields.filter(field => !firebaseConfig[field as keyof typeof firebaseConfig]);

if (missingFields.length > 0) {
  console.error('🔥 [Firebase] Variables d\'environnement manquantes:', missingFields);
  console.error('🔥 [Firebase] Créez un fichier .env.local à la racine avec vos clés Firebase');
  console.error('🔥 [Firebase] Redémarrez le serveur après création du fichier');
}

// Validation spécifique des formats
if (firebaseConfig.apiKey && firebaseConfig.apiKey.length < 30) {
  console.error('🔥 [Firebase] VITE_FIREBASE_API_KEY semble invalide (trop courte)');
}

if (firebaseConfig.appId && !firebaseConfig.appId.includes(':web:')) {
  console.error('🔥 [Firebase] VITE_FIREBASE_APP_ID format invalide (attendu: 1:xxx:web:xxx)');
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
  console.error('🔥 [Firebase] Erreur lors de l\'initialisation:', error);
  throw new Error('Configuration Firebase invalide. Vérifiez vos clés dans .env.local');
}

// Initialisation des services
export const auth = getAuth(app);
// Firestore singleton with development-safe configuration
export const db = ((): Firestore => {
  if (globalForFirebase.__UBORA_FIRESTORE__) return globalForFirebase.__UBORA_FIRESTORE__ as Firestore;
  
  const isDev = typeof import.meta !== 'undefined' && !!(import.meta as any).env && (import.meta as any).env.DEV;
  
  // In development, use minimal configuration to avoid assertion errors
  const config = isDev ? {
    // No local cache in dev to completely avoid IndexedDB issues
    experimentalAutoDetectLongPolling: true,
    // Disable offline persistence completely in dev
    ignoreUndefinedProperties: true
  } : {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    }),
    experimentalAutoDetectLongPolling: true
  };
  
  try {
    const instance = initializeFirestore(app, config);
    globalForFirebase.__UBORA_FIRESTORE__ = instance;
    return instance;
  } catch (error) {
    console.error('🔥 [Firebase] Firestore initialization failed:', error);
    // Final fallback - minimal config
    try {
      const fallbackInstance = initializeFirestore(app, {
        experimentalAutoDetectLongPolling: true
      });
      globalForFirebase.__UBORA_FIRESTORE__ = fallbackInstance;
      return fallbackInstance;
    } catch (fallbackError) {
      console.error('🔥 [Firebase] Firestore fallback initialization also failed:', fallbackError);
      throw new Error('Firestore initialization failed completely');
    }
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
export const analytics = isAnalyticsSupported().then((supported) => {
  if (supported) {
    return getAnalytics(app);
  } else {
    return null;
  }
});

// Export de l'app pour les services
export { app };

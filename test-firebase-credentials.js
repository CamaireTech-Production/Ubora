import dotenv from 'dotenv';
import path from 'path';
import admin from 'firebase-admin';

// Charger .env.local
const envPath = path.join(process.cwd(), '.env.local');
const loaded = dotenv.config({ path: envPath });

if (loaded.error) {
  console.error('❌ Erreur lors du chargement de .env.local:', loaded.error.message);
  process.exit(1);
}

console.log('📁 Fichier .env.local chargé depuis:', envPath);
console.log('');

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;

console.log('🔍 Vérification des credentials...');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Project ID:', projectId ? `✅ ${projectId}` : '❌ Manquant');
console.log('Client Email:', clientEmail ? `✅ ${clientEmail}` : '❌ Manquant');
console.log('Private Key:', privateKey ? `✅ Présente (${privateKey.length} caractères)` : '❌ Manquante');
console.log('');

if (!projectId || !clientEmail || !privateKey) {
  console.error('❌ ERREUR: Un ou plusieurs credentials sont manquants!');
  console.error('   Vérifiez votre fichier .env.local');
  process.exit(1);
}

// Analyser la clé privée
console.log('🔑 Analyse de la clé privée...');
let cleanPrivateKey = privateKey.trim();
const hadQuotes = (cleanPrivateKey.startsWith('"') && cleanPrivateKey.endsWith('"')) ||
                  (cleanPrivateKey.startsWith("'") && cleanPrivateKey.endsWith("'"));
const hasEscapedNewlines = cleanPrivateKey.includes('\\n');
const hasActualNewlines = cleanPrivateKey.includes('\n') && !hasEscapedNewlines;

console.log('   - Guillemets:', hadQuotes ? 'Oui' : 'Non');
console.log('   - Newlines échappés (\\n):', hasEscapedNewlines ? 'Oui' : 'Non');
console.log('   - Newlines réels:', hasActualNewlines ? 'Oui' : 'Non');
console.log('');

// Nettoyer la clé privée
if (hadQuotes) {
  console.log('   ✂️ Suppression des guillemets...');
  cleanPrivateKey = cleanPrivateKey.slice(1, -1);
}

if (hasEscapedNewlines) {
  console.log('   🔄 Conversion des \\n en vrais retours à la ligne...');
  // Gérer tous les formats d'échappement possibles
  cleanPrivateKey = cleanPrivateKey.replace(/\\\\\\\n/g, '\n');
  cleanPrivateKey = cleanPrivateKey.replace(/\\\\\n/g, '\n');
  cleanPrivateKey = cleanPrivateKey.replace(/\\n/g, '\n');
}

// Vérifier le format de la clé
const hasBeginMarker = cleanPrivateKey.includes('-----BEGIN PRIVATE KEY-----');
const hasEndMarker = cleanPrivateKey.includes('-----END PRIVATE KEY-----');

if (!hasBeginMarker || !hasEndMarker) {
  console.error('❌ ERREUR: Format de clé privée invalide!');
  console.error('   La clé doit contenir -----BEGIN PRIVATE KEY----- et -----END PRIVATE KEY-----');
  process.exit(1);
}

console.log('   ✅ Format de clé valide');
console.log('');

// Initialiser Firebase Admin
console.log('🔧 Initialisation de Firebase Admin SDK...');
try {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey: cleanPrivateKey
    })
  });

  console.log('✅ Firebase Admin SDK initialisé avec succès!');
  console.log('');

  // Tester l'accès à Firestore
  console.log('🔍 Test d\'accès à Firestore...');
  const db = admin.firestore();
  
  // Test 1: Lire un document simple (collection users)
  console.log('   Test 1: Lecture de la collection "users"...');
  try {
    const usersQuery = db.collection('users').limit(1);
    const usersSnapshot = await usersQuery.get();
    console.log(`   ✅ Collection "users" accessible! (${usersSnapshot.size} document(s) trouvé(s))`);
  } catch (error) {
    console.error('   ❌ Erreur lors de la lecture de "users":', error.message);
    console.error('   Code:', error.code);
    throw error;
  }

  // Test 2: Vérifier l'accès à une autre collection (agencies)
  console.log('   Test 2: Lecture de la collection "agencies"...');
  try {
    const agenciesQuery = db.collection('agencies').limit(1);
    const agenciesSnapshot = await agenciesQuery.get();
    console.log(`   ✅ Collection "agencies" accessible! (${agenciesSnapshot.size} document(s) trouvé(s))`);
  } catch (error) {
    console.error('   ❌ Erreur lors de la lecture de "agencies":', error.message);
    console.error('   Code:', error.code);
    // Ne pas échouer si cette collection n'existe pas, mais loguer l'erreur
    if (error.code === 7) {
      console.log('   ⚠️  Collection "agencies" n\'existe peut-être pas (code 7 = NOT_FOUND)');
    } else {
      throw error;
    }
  }

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ TOUS LES TESTS RÉUSSIS!');
  console.log('✅ Vos credentials Firebase sont valides et fonctionnels.');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // Nettoyer
  await admin.app().delete();
  process.exit(0);

} catch (error) {
  console.error('');
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('❌ ERREUR LORS DU TEST!');
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('');
  console.error('Message:', error.message);
  console.error('Code:', error.code || 'N/A');
  
  if (error.code === 16) {
    console.error('');
    console.error('🔴 Code 16 = UNAUTHENTICATED');
    console.error('   Cela signifie que les credentials ne sont pas valides ou ont été révoqués.');
    console.error('');
    console.error('Solutions possibles:');
    console.error('   1. Vérifier que le compte de service est actif dans Google Cloud Console');
    console.error('   2. Vérifier les permissions du compte de service (Firestore User)');
    console.error('   3. Recréer les credentials dans Firebase Console');
    console.error('   4. Vérifier que le projet Firebase est toujours actif');
  } else if (error.code === 7) {
    console.error('');
    console.error('🔴 Code 7 = NOT_FOUND');
    console.error('   Le projet ou la collection n\'existe pas.');
  } else if (error.code === 3) {
    console.error('');
    console.error('🔴 Code 3 = INVALID_ARGUMENT');
    console.error('   Les credentials sont mal formatés.');
  }
  
  console.error('');
  console.error('Stack trace:');
  console.error(error.stack);
  console.error('');

  // Nettoyer si Firebase a été initialisé
  try {
    if (admin.apps.length > 0) {
      await admin.app().delete();
    }
  } catch (cleanupError) {
    // Ignorer les erreurs de nettoyage
  }

  process.exit(1);
}


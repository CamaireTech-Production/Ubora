import dotenv from 'dotenv';
import path from 'path';
const loadedLocalEnv = dotenv.config({ path: path.join(process.cwd(), '.env.local') });
if (!loadedLocalEnv || !loadedLocalEnv.parsed) {
  dotenv.config({ path: path.join(process.cwd(), '.env') });
}

import admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  console.log('🔧 Initializing Firebase Admin SDK...');
  
  // Validate environment variables - NO MOCKS, fail hard if missing
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  
  console.log('🔍 Environment check:', {
    projectId: projectId ? `✅ Set (${projectId})` : '❌ Missing',
    clientEmail: clientEmail ? `✅ Set (${clientEmail})` : '❌ Missing',
    privateKey: privateKey ? `✅ Set (${privateKey.length} chars)` : '❌ Missing'
  });

  // CRITICAL: Fail hard if credentials are missing - NO MOCKS
  if (!projectId || !clientEmail || !privateKey) {
    const missing = [];
    if (!projectId) missing.push('FIREBASE_PROJECT_ID');
    if (!clientEmail) missing.push('FIREBASE_CLIENT_EMAIL');
    if (!privateKey) missing.push('FIREBASE_PRIVATE_KEY');
    throw new Error(`❌ Firebase Admin credentials missing: ${missing.join(', ')}. Check your environment variables.`);
  }

  if (privateKey.length < 100) {
    throw new Error(`❌ FIREBASE_PRIVATE_KEY is too short (${privateKey.length} chars). Expected full PEM-formatted private key (minimum 100 characters).`);
  }

  // Process the private key with detailed logging
  console.log('🔑 Processing private key...');
  console.log('   Original key info:', {
    length: privateKey.length,
    hasQuotes: (privateKey.trim().startsWith('"') && privateKey.trim().endsWith('"')) ||
               (privateKey.trim().startsWith("'") && privateKey.trim().endsWith("'")),
    first50Chars: privateKey.substring(0, 50),
    hasActualNewlines: privateKey.includes('\n'),
    hasEscapedNewlines: privateKey.includes('\\n'),
    hasDoubleEscapedNewlines: privateKey.includes('\\\\n'),
    includesBegin: privateKey.includes('BEGIN PRIVATE KEY'),
    includesEnd: privateKey.includes('END PRIVATE KEY')
  });

  // Clean and format the private key - handle various escape formats
  let cleanPrivateKey = privateKey;
  
  // Remove surrounding quotes if present
  cleanPrivateKey = cleanPrivateKey.trim();
  const hadQuotes = (cleanPrivateKey.startsWith('"') && cleanPrivateKey.endsWith('"')) ||
                    (cleanPrivateKey.startsWith("'") && cleanPrivateKey.endsWith("'"));
  if (hadQuotes) {
    console.log('   ✂️ Removing surrounding quotes');
    cleanPrivateKey = cleanPrivateKey.slice(1, -1);
  }
  
  // Check if key already has actual newlines (properly formatted)
  const hasActualNewlines = cleanPrivateKey.includes('\n') && cleanPrivateKey.includes('BEGIN PRIVATE KEY');
  
  console.log('   After quote removal:', {
    length: cleanPrivateKey.length,
    hasActualNewlines: hasActualNewlines,
    hasEscapedNewlines: cleanPrivateKey.includes('\\n'),
    hasDoubleEscapedNewlines: cleanPrivateKey.includes('\\\\n'),
    includesBegin: cleanPrivateKey.includes('BEGIN PRIVATE KEY'),
    includesEnd: cleanPrivateKey.includes('END PRIVATE KEY')
  });
  
  if (!hasActualNewlines) {
    console.log('   🔄 Converting escaped newlines to actual newlines...');
    const beforeLength = cleanPrivateKey.length;
    
    // First: Handle double-escaped newlines (\\\\n -> \n literal -> newline)
    cleanPrivateKey = cleanPrivateKey.replace(/\\\\n/g, '\n');
    
    // Second: Handle single-escaped newlines (\n -> newline) from env files
    // This covers most common cases where dotenv keeps \n as literal characters
    cleanPrivateKey = cleanPrivateKey.replace(/\\n/g, '\n');
    
    console.log('   After conversion:', {
      lengthChanged: cleanPrivateKey.length !== beforeLength,
      newLength: cleanPrivateKey.length,
      hasActualNewlines: cleanPrivateKey.includes('\n'),
      includesBegin: cleanPrivateKey.includes('BEGIN PRIVATE KEY'),
      includesEnd: cleanPrivateKey.includes('END PRIVATE KEY'),
      first60Chars: cleanPrivateKey.substring(0, 60)
    });
  }
  
  // Final validation: Ensure key has proper PEM format
  if (!cleanPrivateKey.includes('BEGIN PRIVATE KEY') || !cleanPrivateKey.includes('END PRIVATE KEY')) {
    console.error('❌ CRITICAL: Private key format validation failed!');
    console.error('   - Expected: -----BEGIN PRIVATE KEY----- ... -----END PRIVATE KEY-----');
    console.error('   - Has BEGIN marker:', cleanPrivateKey.includes('BEGIN PRIVATE KEY'));
    console.error('   - Has END marker:', cleanPrivateKey.includes('END PRIVATE KEY'));
    console.error('   - First 100 chars:', cleanPrivateKey.substring(0, 100));
    console.error('   - Last 100 chars:', cleanPrivateKey.substring(Math.max(0, cleanPrivateKey.length - 100)));
    throw new Error('❌ Invalid private key format: Missing BEGIN PRIVATE KEY or END PRIVATE KEY markers. Check FIREBASE_PRIVATE_KEY environment variable.');
  }
  
  console.log('✅ Private key format validated successfully');

  // Build service account object
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

  console.log('🔧 Attempting Firebase Admin initialization...');
  
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: projectId
    });
    console.log('✅ Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('❌ Firebase Admin SDK initialization FAILED:', error);
    console.error('   Error code:', error.code || 'N/A');
    console.error('   Error message:', error.message || 'N/A');
    
    // Provide specific guidance for private key parsing errors
    if (error.code === 'app/invalid-credential' || 
        error.message?.includes('Invalid PEM') || 
        error.message?.includes('private key') ||
        error.message?.includes('PEM')) {
      console.error('');
      console.error('🔑 PRIVATE KEY PARSING ERROR DETECTED:');
      console.error('   The private key format appears to be invalid.');
      console.error('   Expected format: -----BEGIN PRIVATE KEY-----\\n<key data>\\n-----END PRIVATE KEY-----');
      console.error('');
      console.error('   Diagnostic info:');
      console.error('   - Cleaned key length:', cleanPrivateKey.length);
      console.error('   - Has actual newlines:', cleanPrivateKey.includes('\n'));
      console.error('   - First 100 chars:', cleanPrivateKey.substring(0, 100));
      console.error('   - Last 100 chars:', cleanPrivateKey.substring(Math.max(0, cleanPrivateKey.length - 100)));
      console.error('');
      console.error('   Troubleshooting steps:');
      console.error('   1. Verify FIREBASE_PRIVATE_KEY contains the full key from Firebase Console');
      console.error('   2. Ensure newlines are properly escaped in your .env file');
      console.error('   3. Check that the key includes BEGIN and END markers');
      console.error('   4. Try removing quotes around the key if present');
      console.error('');
    }
    
    // NO MOCKS - Fail hard and stop the process
    console.error('❌ CRITICAL: Firebase Admin initialization failed. Application cannot continue without valid Firebase credentials.');
    throw new Error(`Firebase Admin initialization failed: ${error.message}. Check logs above for details.`);
  }
}

// Export services - NO MOCKS, always use real admin
const adminAuth = admin.auth();
const adminDb = admin.firestore();

export { adminAuth, adminDb, admin };
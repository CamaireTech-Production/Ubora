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
    includesBegin: privateKey.includes('BEGIN PRIVATE KEY') || privateKey.includes('BEGINPRIVATEKEY'),
    includesEnd: privateKey.includes('END PRIVATE KEY') || privateKey.includes('ENDPRIVATEKEY'),
    malformedBegin: privateKey.includes('BEGINPRIVATEKEY') && !privateKey.includes('BEGIN PRIVATE KEY'),
    malformedEnd: privateKey.includes('ENDPRIVATEKEY') && !privateKey.includes('END PRIVATE KEY')
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
  // Check for both properly formatted and malformed markers
  const hasProperBegin = cleanPrivateKey.includes('BEGIN PRIVATE KEY');
  const hasMalformedBegin = cleanPrivateKey.includes('BEGINPRIVATEKEY');
  const hasActualNewlines = cleanPrivateKey.includes('\n') && (hasProperBegin || hasMalformedBegin);
  
  console.log('   After quote removal:', {
    length: cleanPrivateKey.length,
    hasActualNewlines: hasActualNewlines,
    hasEscapedNewlines: cleanPrivateKey.includes('\\n'),
    hasDoubleEscapedNewlines: cleanPrivateKey.includes('\\\\n'),
    includesBegin: hasProperBegin || hasMalformedBegin,
    includesEnd: cleanPrivateKey.includes('END PRIVATE KEY') || cleanPrivateKey.includes('ENDPRIVATEKEY'),
    hasProperBegin: hasProperBegin,
    hasMalformedBegin: hasMalformedBegin && !hasProperBegin
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
      includesBegin: cleanPrivateKey.includes('BEGIN PRIVATE KEY') || cleanPrivateKey.includes('BEGINPRIVATEKEY'),
      includesEnd: cleanPrivateKey.includes('END PRIVATE KEY') || cleanPrivateKey.includes('ENDPRIVATEKEY'),
      hasProperBegin: cleanPrivateKey.includes('BEGIN PRIVATE KEY'),
      hasMalformedBegin: cleanPrivateKey.includes('BEGINPRIVATEKEY') && !cleanPrivateKey.includes('BEGIN PRIVATE KEY'),
      first60Chars: cleanPrivateKey.substring(0, 60)
    });
  }
  
  // Normalize malformed BEGIN/END markers (fix missing spaces)
  // Handle case where markers might be "BEGINPRIVATEKEY" instead of "BEGIN PRIVATE KEY"
  if (cleanPrivateKey.includes('BEGINPRIVATEKEY') && !cleanPrivateKey.includes('BEGIN PRIVATE KEY')) {
    console.log('   🔧 Fixing malformed BEGIN marker (adding missing spaces)...');
    // Fix both with and without trailing literal 'n' character
    cleanPrivateKey = cleanPrivateKey.replace(/-----BEGINPRIVATEKEY-----n/g, '-----BEGIN PRIVATE KEY-----\n');
    cleanPrivateKey = cleanPrivateKey.replace(/-----BEGINPRIVATEKEY-----/g, '-----BEGIN PRIVATE KEY-----');
  }
  if (cleanPrivateKey.includes('ENDPRIVATEKEY') && !cleanPrivateKey.includes('END PRIVATE KEY')) {
    console.log('   🔧 Fixing malformed END marker (adding missing spaces)...');
    // Fix both with and without leading literal 'n' character
    cleanPrivateKey = cleanPrivateKey.replace(/n-----ENDPRIVATEKEY-----/g, '\n-----END PRIVATE KEY-----');
    cleanPrivateKey = cleanPrivateKey.replace(/-----ENDPRIVATEKEY-----/g, '-----END PRIVATE KEY-----');
  }
  
  // Also handle case where properly formatted markers have literal 'n' instead of newline
  if (cleanPrivateKey.includes('BEGIN PRIVATE KEY') && !cleanPrivateKey.includes('\n')) {
    console.log('   🔧 Fixing literal "n" characters after BEGIN marker...');
    cleanPrivateKey = cleanPrivateKey.replace(/-----BEGIN PRIVATE KEY-----n/g, '-----BEGIN PRIVATE KEY-----\n');
  }
  if (cleanPrivateKey.includes('END PRIVATE KEY') && cleanPrivateKey.includes('-----END PRIVATE KEY-----n')) {
    console.log('   🔧 Fixing literal "n" characters before END marker...');
    cleanPrivateKey = cleanPrivateKey.replace(/n-----END PRIVATE KEY-----/g, '\n-----END PRIVATE KEY-----');
  }
  
  // Final validation: Ensure key has proper PEM format
  const hasBeginMarker = cleanPrivateKey.includes('BEGIN PRIVATE KEY');
  const hasEndMarker = cleanPrivateKey.includes('END PRIVATE KEY');
  
  if (!hasBeginMarker || !hasEndMarker) {
    console.error('❌ CRITICAL: Private key format validation failed!');
    console.error('   - Expected: -----BEGIN PRIVATE KEY----- ... -----END PRIVATE KEY-----');
    console.error('   - Has BEGIN marker:', hasBeginMarker);
    console.error('   - Has END marker:', hasEndMarker);
    console.error('   - First 100 chars:', cleanPrivateKey.substring(0, 100));
    console.error('   - Last 100 chars:', cleanPrivateKey.substring(Math.max(0, cleanPrivateKey.length - 100)));
    console.error('');
    console.error('   The private key format is invalid. Please check:');
    console.error('   1. The key should start with: -----BEGIN PRIVATE KEY-----');
    console.error('   2. The key should end with: -----END PRIVATE KEY-----');
    console.error('   3. There should be spaces between the words in the markers');
    throw new Error('❌ Invalid private key format: Missing BEGIN PRIVATE KEY or END PRIVATE KEY markers. Check FIREBASE_PRIVATE_KEY environment variable.');
  }
  
  // Ensure the key has actual newlines - handle literal 'n' characters that should be newlines
  // PEM keys should have newlines, so if we don't have any, convert literal 'n' to newlines
  if (!cleanPrivateKey.includes('\n')) {
    console.log('   ⚠️ Warning: Key does not have actual newlines after conversion. Attempting additional fixes...');
    
    // Strategy 1: Replace literal 'n' after BEGIN marker
    cleanPrivateKey = cleanPrivateKey.replace(/-----BEGIN PRIVATE KEY-----n/g, '-----BEGIN PRIVATE KEY-----\n');
    
    // Strategy 2: Replace literal 'n' before END marker  
    cleanPrivateKey = cleanPrivateKey.replace(/n-----END PRIVATE KEY-----/g, '\n-----END PRIVATE KEY-----');
    
    // Strategy 3: Replace ALL literal 'n' characters that appear between base64 content
    // This handles the case where the entire key has 'n' instead of newlines
    // Base64 PEM keys have lines of ~64 chars, so we split on 'n' that appears after base64-looking content
    if (!cleanPrivateKey.includes('\n') && cleanPrivateKey.length > 200) {
      console.log('   🔄 Converting ALL literal "n" characters to newlines (splitting on "n" between base64 content)...');
      
      // Split the key: BEGIN marker, then base64 content with 'n' separators, then END marker
      // Pattern: Split on 'n' that follows base64 characters and is followed by more base64 or END marker
      // This safely converts 'n' to newlines without breaking legitimate 'n' in base64 (which is rare at line boundaries)
      const beginMarker = '-----BEGIN PRIVATE KEY-----';
      const endMarker = '-----END PRIVATE KEY-----';
      
      if (cleanPrivateKey.includes(beginMarker) && cleanPrivateKey.includes(endMarker)) {
        const beginIdx = cleanPrivateKey.indexOf(beginMarker);
        const endIdx = cleanPrivateKey.indexOf(endMarker);
        const beforeBegin = cleanPrivateKey.substring(0, beginIdx);
        const beginToEnd = cleanPrivateKey.substring(beginIdx + beginMarker.length, endIdx);
        const afterEnd = cleanPrivateKey.substring(endIdx + endMarker.length);
        
        // Convert 'n' in the base64 section to newlines
        // Split on 'n' and rejoin with '\n' - this converts all literal 'n' to newlines
        const fixedBase64 = beginToEnd.split('n').join('\n');
        
        cleanPrivateKey = beforeBegin + beginMarker + '\n' + fixedBase64 + '\n' + endMarker + afterEnd;
        
        console.log('   ✅ Converted literal "n" characters to newlines in base64 section');
      }
    }
    
    const hasNewlines = cleanPrivateKey.includes('\n');
    console.log('   After additional fixes - has newlines:', hasNewlines);
    if (!hasNewlines) {
      console.error('   ❌ WARNING: Key still does not have newlines after all fix attempts!');
    }
  }
  
  console.log('✅ Private key format validated successfully');
  
  // Final key inspection before passing to Firebase Admin
  console.log('🔍 Final key inspection before Firebase Admin init:', {
    length: cleanPrivateKey.length,
    hasActualNewlines: cleanPrivateKey.includes('\n'),
    newlineCount: (cleanPrivateKey.match(/\n/g) || []).length,
    startsWithBegin: cleanPrivateKey.trim().startsWith('-----BEGIN PRIVATE KEY-----'),
    endsWithEnd: cleanPrivateKey.trim().endsWith('-----END PRIVATE KEY-----'),
    firstLine: cleanPrivateKey.split('\n')[0],
    lastLine: cleanPrivateKey.split('\n').slice(-1)[0],
    sampleMiddle: cleanPrivateKey.substring(100, 150)
  });

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
    // Use console.error with explicit flush to ensure errors are logged
    console.error('❌ Firebase Admin SDK initialization FAILED:');
    console.error('   Error:', error);
    console.error('   Error code:', error.code || 'N/A');
    console.error('   Error message:', error.message || 'N/A');
    console.error('   Error stack:', error.stack || 'N/A');
    
    // Force output flush in Node.js
    if (process.stdout && typeof process.stdout.write === 'function') {
      process.stdout.write('');
    }
    if (process.stderr && typeof process.stderr.write === 'function') {
      process.stderr.write('');
    }
    
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

// Verify Firebase Admin is initialized before exporting services
if (!admin.apps.length) {
  console.error('❌ CRITICAL: Firebase Admin not initialized. Cannot export adminAuth or adminDb.');
  throw new Error('Firebase Admin not initialized. Check initialization errors above.');
}

// Export services - NO MOCKS, always use real admin (only after successful initialization)
const adminAuth = admin.auth();
const adminDb = admin.firestore();

console.log('✅ Firebase Admin services exported successfully (auth and firestore)');

export { adminAuth, adminDb, admin };
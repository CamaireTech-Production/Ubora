#!/usr/bin/env node

/**
 * Test script to verify Firebase Admin SDK is working correctly
 * Run this to test the fixes before deploying
 */

const { adminDb } = require('./lib/firebaseAdmin');
const admin = require('firebase-admin');

async function testFirebaseAdmin() {
  try {
    console.log('🧪 Testing Firebase Admin SDK...');
    
    // Test 1: Check if adminDb is available
    console.log('✅ adminDb available:', !!adminDb);
    
    // Test 2: Check if FieldValue is available
    console.log('✅ FieldValue available:', !!admin.firestore.FieldValue);
    console.log('✅ serverTimestamp available:', !!admin.firestore.FieldValue.serverTimestamp);
    
    // Test 3: Test a simple write operation
    const testDoc = adminDb.collection('test').doc('test-doc');
    await testDoc.set({
      test: true,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: new Date()
    });
    console.log('✅ Write operation successful');
    
    // Test 4: Test a read operation
    const doc = await testDoc.get();
    console.log('✅ Read operation successful:', doc.exists);
    
    // Test 5: Test exists property
    console.log('✅ exists property works:', doc.exists);
    
    // Clean up test document
    await testDoc.delete();
    console.log('✅ Cleanup successful');
    
    console.log('🎉 All Firebase Admin SDK tests passed!');
    
  } catch (error) {
    console.error('❌ Firebase Admin SDK test failed:', error);
    process.exit(1);
  }
}

// Run the test
testFirebaseAdmin();

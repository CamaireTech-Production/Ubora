/**
 * DEBUG SCRIPT: Test Archa Chat Filtering
 * 
 * This script helps verify that Archa chat correctly filters submissions
 * based on active Univers, form period, and metadata.
 * 
 * USAGE:
 *   node api/debug/test-archa-filters.js
 * 
 * ENVIRONMENT VARIABLES:
 *   - DEBUG_DRY_RUN=true: Skip OpenAI calls, only show filter/search results
 *   - ENABLE_ARCHA_DEBUG=true: Enable detailed logging
 * 
 * TO REMOVE:
 *   - Delete this file: api/debug/test-archa-filters.js
 *   - Remove debug parameters from: api/lib/vectorSearch.js, api/lib/executeAIQuestion.js, api/ai/ask.js
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const loadedLocalEnv = dotenv.config({ path: path.join(__dirname, '../../.env.local') });
if (!loadedLocalEnv || !loadedLocalEnv.parsed) {
  dotenv.config({ path: path.join(__dirname, '../../.env') });
}

import { adminDb } from '../lib/firebaseAdmin.js';
import { executeAIQuestion } from '../lib/executeAIQuestion.js';

/**
 * Test case configuration
 */
const TEST_CASES = [
  {
    name: 'Test 1: Question simple avec Univers actif',
    question: 'Combien de soumissions avons-nous reçues cette semaine?',
    filters: { period: 'this_week' },
    directorId: null, // SET THIS to test director filtering
    agencyId: null, // SET THIS to your test agency ID
  },
  {
    name: 'Test 2: Question avec filtre formulaire spécifique',
    question: 'Quelles sont les données du formulaire X?',
    filters: { 
      period: 'last_30d',
      formId: null // SET THIS to test form filtering
    },
    directorId: null,
    agencyId: null,
  },
  {
    name: 'Test 3: Question avec filtre utilisateur',
    question: 'Quelles sont les soumissions de cet employé?',
    filters: {
      period: 'all',
      userId: null // SET THIS to test user filtering
    },
    directorId: null,
    agencyId: null,
  }
];

/**
 * Main test function
 */
async function runTests() {
  console.log('🧪 [TEST] Starting Archa Filter Tests\n');
  console.log('⚠️  Make sure to set TEST_CASES with your actual IDs before running!\n');

  // Enable debug mode
  process.env.DEBUG_DRY_RUN = 'true';
  process.env.ENABLE_ARCHA_DEBUG = 'true';

  for (const testCase of TEST_CASES) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🧪 ${testCase.name}`);
    console.log(`${'='.repeat(80)}\n`);

    if (!testCase.agencyId) {
      console.log('⚠️  SKIPPED: agencyId not set in test case\n');
      continue;
    }

    try {
      const result = await executeAIQuestion({
        userId: testCase.directorId || 'test-user',
        agencyId: testCase.agencyId,
        question: testCase.question,
        filters: testCase.filters,
        directorId: testCase.directorId,
        debug: true, // Enable debug mode
      });

      console.log('\n📊 Test Result:');
      console.log(JSON.stringify(result, null, 2));

      // Analyze results
      if (result.meta?.debug) {
        console.log('\n🔍 Filter Analysis:');
        console.log('  Applied Filters:', result.meta.debug.filterApplied);
        console.log('  Chunks Found:', result.meta.debug.chunksFound.length);
        
        if (testCase.filters?.formId) {
          const matchingForms = result.meta.debug.chunksFound.filter(
            c => c.formId === testCase.filters.formId
          );
          console.log(`  ✓ Form filter check: ${matchingForms.length}/${result.meta.debug.chunksFound.length} chunks match formId`);
        }
        
        if (testCase.directorId) {
          const uniqueUniversIds = [...new Set(result.meta.debug.chunksFound.map(c => c.universId).filter(Boolean))];
          console.log(`  ✓ Univers filter check: ${uniqueUniversIds.length} unique Univers IDs found`);
        }
      }

    } catch (error) {
      console.error(`❌ Test failed:`, error);
    }
  }

  console.log('\n\n✅ Tests completed!');
  console.log('📝 Review the logs above to verify filtering behavior.\n');
}

/**
 * Helper: List available test data
 */
async function listTestData() {
  console.log('📋 Listing available test data...\n');

  try {
    // Get a sample agency
    const agenciesSnapshot = await adminDb.collection('users')
      .where('role', '==', 'directeur')
      .limit(1)
      .get();

    if (agenciesSnapshot.empty) {
      console.log('⚠️  No directors found in database');
      return;
    }

    const director = agenciesSnapshot.docs[0];
    const directorData = director.data();
    const agencyId = directorData.agencyId;

    console.log(`✓ Found director: ${directorData.name} (${director.id})`);
    console.log(`  Agency ID: ${agencyId}\n`);

    // Get active Univers
    const activeUniversDoc = await adminDb.collection('activeUnivers').doc(director.id).get();
    if (activeUniversDoc.exists) {
      const activeUniversId = activeUniversDoc.data().activeUniversId;
      console.log(`✓ Active Univers: ${activeUniversId}\n`);
    } else {
      console.log('⚠️  No active Univers found for this director\n');
    }

    // Get forms
    const formsSnapshot = await adminDb.collection('forms')
      .where('agencyId', '==', agencyId)
      .limit(5)
      .get();

    console.log(`✓ Forms (showing first 5):`);
    formsSnapshot.docs.forEach(doc => {
      const form = doc.data();
      console.log(`  - ${form.title} (${doc.id})`);
    });

    // Get form entries
    const entriesSnapshot = await adminDb.collection('formEntries')
      .where('agencyId', '==', agencyId)
      .limit(5)
      .get();

    console.log(`\n✓ Form Entries (showing first 5):`);
    entriesSnapshot.docs.forEach(doc => {
      const entry = doc.data();
      console.log(`  - Entry ${doc.id}: formId=${entry.formId}, userId=${entry.userId}, submittedAt=${entry.submittedAt}`);
    });

    console.log('\n💡 Use these IDs in TEST_CASES to run specific tests\n');

  } catch (error) {
    console.error('❌ Error listing test data:', error);
  }
}

// Run script
const command = process.argv[2];

if (command === 'list') {
  listTestData();
} else {
  runTests();
}


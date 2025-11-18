/**
 * DEBUG SCRIPT: Check Vector Database Sync
 * 
 * This script compares Firebase submissions with Qdrant vector database
 * to identify missing or incorrectly indexed submissions.
 * 
 * USAGE:
 *   node api/debug/check-vector-sync.js [agencyId] [directorId]
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
import { qdrantRequest, COLLECTION_NAME } from '../lib/vectorDb.js';

/**
 * Get all submissions from Firebase for an agency
 */
async function getFirebaseSubmissions(agencyId, universId = null, formIds = null, period = null) {
  try {
    console.log(`  🔍 Querying Firebase for agencyId: ${agencyId}...`);
    
    // Get all submissions for agency (without date filter to avoid index requirement)
    // We'll filter by date in memory
    let query = adminDb.collection('formEntries').where('agencyId', '==', agencyId);
    
    console.log(`  ⏳ Fetching documents (limit: 2000)...`);
    const snapshot = await query.limit(2000).get();
    console.log(`  ✅ Found ${snapshot.size} documents in Firebase`);
    
    const submissions = [];
    let processedCount = 0;
    const formCache = new Map(); // Cache form data to avoid duplicate queries
    
    console.log(`  🔄 Processing ${snapshot.size} documents...`);
    
    for (const doc of snapshot.docs) {
      processedCount++;
      if (processedCount % 50 === 0) {
        console.log(`    Processing... ${processedCount}/${snapshot.size}`);
      }
      
      const data = doc.data();
      
      // Get form data to check universId (with cache)
      let formData = null;
      if (data.formId) {
        if (formCache.has(data.formId)) {
          formData = formCache.get(data.formId);
        } else {
          try {
            const formDoc = await adminDb.collection('forms').doc(data.formId).get();
            if (formDoc.exists) {
              formData = formDoc.data();
              formCache.set(data.formId, formData);
            }
          } catch (e) {
            console.warn(`    ⚠️  Could not fetch form ${data.formId}:`, e.message);
          }
        }
      }
      
      // Filter by universId if provided
      if (universId && formData && formData.universId !== universId) {
        continue;
      }
      
      // Filter by formIds if provided
      if (formIds && formIds.length > 0 && !formIds.includes(data.formId)) {
        continue;
      }
      
      const submittedAt = data.submittedAt?.toDate ? data.submittedAt.toDate() : new Date(data.submittedAt);
      
      // Filter by period in memory (if provided)
      if (period && period.start && period.end) {
        if (submittedAt < period.start || submittedAt > period.end) {
          continue; // Skip if outside period
        }
      }
      
      submissions.push({
        entryId: doc.id,
        formId: data.formId,
        userId: data.userId,
        agencyId: data.agencyId,
        submittedAt: submittedAt,
        universId: formData?.universId || null,
        formTitle: formData?.title || 'Unknown',
        answers: data.answers || {},
        vectorSyncStatus: data.vectorSyncStatus || 'unknown',
        vectorChunksCount: data.vectorChunksCount || 0,
      });
    }
    
    console.log(`  ✅ Processed ${processedCount} documents, ${submissions.length} match filters`);
    return submissions;
  } catch (error) {
    console.error('❌ Error fetching Firebase submissions:', error);
    console.error('Error details:', error.message);
    return [];
  }
}

/**
 * Get all vectors from Qdrant for an agency
 */
async function getQdrantVectors(agencyId, universId = null, formIds = null) {
  try {
    const filter = {
      must: [
        {
          key: 'agencyId',
          match: { value: agencyId }
        }
      ]
    };
    
    if (universId) {
      filter.must.push({
        key: 'universId',
        match: { value: universId }
      });
    }
    
    if (formIds && formIds.length > 0) {
      if (formIds.length === 1) {
        filter.must.push({
          key: 'formId',
          match: { value: formIds[0] }
        });
      } else {
        filter.must.push({
          key: 'formId',
          match: { any: formIds }
        });
      }
    }
    
    // Use scroll to get all points
    const scrollResponse = await qdrantRequest(
      `/collections/${COLLECTION_NAME}/points/scroll`,
      {
        method: 'POST',
        body: JSON.stringify({
          filter,
          limit: 1000,
          with_payload: true,
          with_vector: false
        })
      }
    );
    
    const points = scrollResponse.result?.points || [];
    
    // Group by entryId
    const vectorsByEntry = new Map();
    points.forEach(point => {
      const entryId = point.payload?.entryId;
      if (entryId) {
        if (!vectorsByEntry.has(entryId)) {
          vectorsByEntry.set(entryId, {
            entryId,
            formId: point.payload?.formId,
            userId: point.payload?.userId,
            universId: point.payload?.universId || null,
            formTitle: point.payload?.formTitle,
            submittedAt: point.payload?.submittedAt,
            chunkCount: 0,
            chunks: []
          });
        }
        vectorsByEntry.get(entryId).chunkCount++;
        vectorsByEntry.get(entryId).chunks.push({
          id: point.id,
          chunkIndex: point.payload?.chunkIndex,
          textPreview: point.payload?.text?.substring(0, 100)
        });
      }
    });
    
    return Array.from(vectorsByEntry.values());
  } catch (error) {
    console.error('❌ Error fetching Qdrant vectors:', error);
    return [];
  }
}

/**
 * Compare Firebase and Qdrant data
 */
async function compareData(firebaseSubmissions, qdrantVectors) {
  const firebaseEntryIds = new Set(firebaseSubmissions.map(s => s.entryId));
  const qdrantEntryIds = new Set(qdrantVectors.map(v => v.entryId));
  
  const missingInQdrant = firebaseSubmissions.filter(s => !qdrantEntryIds.has(s.entryId));
  const extraInQdrant = qdrantVectors.filter(v => !firebaseEntryIds.has(v.entryId));
  const inBoth = firebaseSubmissions.filter(s => qdrantEntryIds.has(s.entryId));
  
  return {
    firebaseCount: firebaseSubmissions.length,
    qdrantCount: qdrantVectors.length,
    inBothCount: inBoth.length,
    missingInQdrantCount: missingInQdrant.length,
    extraInQdrantCount: extraInQdrant.length,
    missingInQdrant,
    extraInQdrant,
    inBoth,
    qdrantEntryIds // Export for use in main function
  };
}

/**
 * Main function
 */
async function main() {
  const agencyId = process.argv[2] || 'agency1';
  const directorId = process.argv[3] || null;
  
  console.log('🔍 [CHECK] Starting Vector Sync Check\n');
  console.log(`Agency ID: ${agencyId}`);
  if (directorId) {
    console.log(`Director ID: ${directorId}`);
  }
  console.log('');
  
  // Get active Univers if directorId provided
  let activeUniversId = null;
  if (directorId) {
    try {
      const activeUniversDoc = await adminDb.collection('activeUnivers').doc(directorId).get();
      if (activeUniversDoc.exists) {
        activeUniversId = activeUniversDoc.data().activeUniversId;
        console.log(`✅ Active Univers: ${activeUniversId}\n`);
      } else {
        console.log('⚠️  No active Univers found\n');
      }
    } catch (error) {
      console.error('❌ Error fetching active Univers:', error);
    }
  }
  
  // Get period for this week
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysFromMonday);
  weekStart.setHours(0, 0, 0, 0);
  
  const period = {
    start: weekStart,
    end: now
  };
  
  console.log(`📅 Period: ${period.start.toISOString()} to ${period.end.toISOString()}\n`);
  
  // Get Firebase submissions
  console.log('📥 Fetching Firebase submissions...');
  const firebaseSubmissions = await getFirebaseSubmissions(agencyId, activeUniversId, null, period);
  console.log(`✅ Found ${firebaseSubmissions.length} submissions in Firebase\n`);
  
  if (firebaseSubmissions.length > 0) {
    console.log('📋 Firebase Submissions Sample (first 5):');
    firebaseSubmissions.slice(0, 5).forEach((sub, index) => {
      console.log(`  ${index + 1}. Entry: ${sub.entryId}`);
      console.log(`     Form: ${sub.formTitle} (${sub.formId})`);
      console.log(`     User: ${sub.userId}`);
      console.log(`     Univers: ${sub.universId || '(not set)'}`);
      console.log(`     Submitted: ${sub.submittedAt.toISOString()}`);
      console.log('');
    });
  }
  
  // Get Qdrant vectors
  console.log('🔍 Fetching Qdrant vectors...');
  const qdrantVectors = await getQdrantVectors(agencyId, activeUniversId, null);
  console.log(`✅ Found ${qdrantVectors.length} entries in Qdrant\n`);
  
  if (qdrantVectors.length > 0) {
    console.log('📋 Qdrant Vectors Sample (first 5):');
    qdrantVectors.slice(0, 5).forEach((vec, index) => {
      console.log(`  ${index + 1}. Entry: ${vec.entryId}`);
      console.log(`     Form: ${vec.formTitle} (${vec.formId})`);
      console.log(`     User: ${vec.userId}`);
      console.log(`     Univers: ${vec.universId || '(not set)'}`);
      console.log(`     Chunks: ${vec.chunkCount}`);
      console.log(`     Submitted: ${vec.submittedAt || '(not set)'}`);
      console.log('');
    });
  }
  
  // Compare
  console.log('🔍 Comparing data...\n');
  const comparison = await compareData(firebaseSubmissions, qdrantVectors);
  
  console.log('📊 COMPARISON RESULTS:');
  console.log(`  Firebase submissions: ${comparison.firebaseCount}`);
  console.log(`  Qdrant entries: ${comparison.qdrantCount}`);
  console.log(`  In both: ${comparison.inBothCount}`);
  console.log(`  Missing in Qdrant: ${comparison.missingInQdrantCount}`);
  console.log(`  Extra in Qdrant: ${comparison.extraInQdrantCount}\n`);
  
  if (comparison.missingInQdrantCount > 0) {
    console.log('⚠️  MISSING IN QDRANT:');
    comparison.missingInQdrant.slice(0, 10).forEach((sub, index) => {
      console.log(`  ${index + 1}. Entry: ${sub.entryId}`);
      console.log(`     Form: ${sub.formTitle} (${sub.formId})`);
      console.log(`     Submitted: ${sub.submittedAt.toISOString()}`);
      console.log(`     Univers: ${sub.universId || '(not set)'}`);
    });
    if (comparison.missingInQdrantCount > 10) {
      console.log(`  ... and ${comparison.missingInQdrantCount - 10} more`);
    }
    console.log('');
  }
  
  if (comparison.extraInQdrantCount > 0) {
    console.log('⚠️  EXTRA IN QDRANT (not in Firebase):');
    comparison.extraInQdrant.slice(0, 10).forEach((vec, index) => {
      console.log(`  ${index + 1}. Entry: ${vec.entryId}`);
      console.log(`     Form: ${vec.formTitle} (${vec.formId})`);
    });
    if (comparison.extraInQdrantCount > 10) {
      console.log(`  ... and ${comparison.extraInQdrantCount - 10} more`);
    }
    console.log('');
  }
  
  // Check metadata issues
  console.log('🔍 Checking metadata issues...\n');
  const missingUniversId = firebaseSubmissions.filter(s => !s.universId);
  if (missingUniversId.length > 0) {
    console.log(`⚠️  ${missingUniversId.length} submissions have no universId in form data`);
  }
  
  const qdrantMissingUniversId = qdrantVectors.filter(v => !v.universId);
  if (qdrantMissingUniversId.length > 0) {
    console.log(`⚠️  ${qdrantMissingUniversId.length} Qdrant entries have no universId in metadata`);
  }
  
  // Check sync status
  console.log('\n📊 SYNC STATUS ANALYSIS:');
  const notSynced = firebaseSubmissions.filter(s => s.vectorSyncStatus !== 'completed');
  const synced = firebaseSubmissions.filter(s => s.vectorSyncStatus === 'completed');
  console.log(`  ✅ Status "completed": ${synced.length}`);
  console.log(`  ⚠️  Status autre: ${notSynced.length}`);
  
  // Vérifier si les "completed" sont vraiment dans Qdrant
  const syncedButMissing = synced.filter(s => !comparison.qdrantEntryIds.has(s.entryId));
  if (syncedButMissing.length > 0) {
    console.log(`\n  🚨 PROBLÈME: ${syncedButMissing.length} soumissions avec status "completed" mais ABSENTES de Qdrant !`);
    syncedButMissing.slice(0, 5).forEach((sub, index) => {
      console.log(`    ${index + 1}. ${sub.entryId} - Form: ${sub.formTitle}`);
    });
  }
  
  if (notSynced.length > 0) {
    console.log('\n  Not synced submissions:');
    notSynced.slice(0, 10).forEach((sub, index) => {
      console.log(`    ${index + 1}. ${sub.entryId} - Status: ${sub.vectorSyncStatus || 'unknown'}`);
    });
  }
  
  // Check period-specific results
  if (period) {
    console.log('\n📅 PERIOD ANALYSIS:');
    const inPeriodFirebase = firebaseSubmissions.filter(s => 
      s.submittedAt >= period.start && s.submittedAt <= period.end
    );
    const inPeriodQdrant = qdrantVectors.filter(v => {
      if (!v.submittedAt) return false;
      const date = new Date(v.submittedAt);
      return date >= period.start && date <= period.end;
    });
    console.log(`  Firebase submissions in period: ${inPeriodFirebase.length}`);
    console.log(`  Qdrant entries in period: ${inPeriodQdrant.length}`);
    
    // Check each Firebase submission individually
    if (inPeriodFirebase.length > 0) {
      console.log('\n  📋 DÉTAILS DES SOUMISSIONS FIREBASE DANS LA PÉRIODE:');
      inPeriodFirebase.forEach((sub, index) => {
        console.log(`\n  ${index + 1}. Entry ID: ${sub.entryId}`);
        console.log(`     Form: ${sub.formTitle} (${sub.formId})`);
        console.log(`     User: ${sub.userId}`);
        console.log(`     Submitted: ${sub.submittedAt.toISOString()}`);
        console.log(`     Univers: ${sub.universId || '(not set)'}`);
        console.log(`     Sync Status: ${sub.vectorSyncStatus || 'unknown'}`);
        console.log(`     Chunks Count: ${sub.vectorChunksCount || 0}`);
        
        // Check if this entry exists in Qdrant
        const inQdrant = qdrantVectors.find(v => v.entryId === sub.entryId);
        if (inQdrant) {
          // Format submittedAt properly
          let qdrantDateStr = '(not set)';
          if (inQdrant.submittedAt) {
            if (typeof inQdrant.submittedAt === 'string') {
              qdrantDateStr = inQdrant.submittedAt;
            } else if (inQdrant.submittedAt instanceof Date) {
              qdrantDateStr = inQdrant.submittedAt.toISOString();
            } else if (typeof inQdrant.submittedAt === 'object') {
              // Try to extract date from object
              if (inQdrant.submittedAt.toDate) {
                qdrantDateStr = inQdrant.submittedAt.toDate().toISOString();
              } else if (inQdrant.submittedAt.seconds) {
                qdrantDateStr = new Date(inQdrant.submittedAt.seconds * 1000).toISOString();
              } else {
                qdrantDateStr = '[object Object] - NEEDS FIXING';
              }
            }
          }
          
          console.log(`     ✅ TROUVÉ DANS QDRANT: ${inQdrant.chunkCount} chunks`);
          console.log(`        Qdrant Submitted: ${qdrantDateStr}`);
          console.log(`        Qdrant Univers: ${inQdrant.universId || '(not set)'}`);
          
          // Check if date format is correct
          if (qdrantDateStr.includes('[object Object]') || (!qdrantDateStr.includes('T') && qdrantDateStr !== '(not set)')) {
            console.log(`        ⚠️  DATE FORMAT INCORRECT - Run fix-qdrant-dates.js to fix`);
          }
        } else {
          console.log(`     ❌ NON TROUVÉ DANS QDRANT !`);
          if (sub.vectorSyncStatus === 'completed') {
            console.log(`     ⚠️  Statut dit "completed" mais pas dans Qdrant - possible problème de synchronisation`);
          } else {
            console.log(`     ⚠️  Statut: ${sub.vectorSyncStatus} - Pas encore synchronisé`);
          }
        }
      });
    }
    
    if (inPeriodFirebase.length > 0 && inPeriodQdrant.length === 0) {
      console.log('\n  ⚠️  PROBLEM: Soumissions Firebase dans la période mais aucune dans Qdrant !');
      console.log('  Les soumissions ne sont probablement pas synchronisées.');
    }
  }
  
  // Check specific entry if provided
  const specificEntryId = process.argv[4];
  if (specificEntryId) {
    console.log(`\n🔍 Checking specific entry: ${specificEntryId}`);
    const firebaseEntry = firebaseSubmissions.find(s => s.entryId === specificEntryId);
    const qdrantEntry = qdrantVectors.find(v => v.entryId === specificEntryId);
    
    if (firebaseEntry) {
      console.log('  ✅ Found in Firebase:');
      console.log(`     Status: ${firebaseEntry.vectorSyncStatus}`);
      console.log(`     Chunks: ${firebaseEntry.vectorChunksCount}`);
    } else {
      console.log('  ❌ Not found in Firebase');
    }
    
    if (qdrantEntry) {
      console.log('  ✅ Found in Qdrant:');
      console.log(`     Chunks: ${qdrantEntry.chunkCount}`);
    } else {
      console.log('  ❌ Not found in Qdrant');
    }
  }
  
  console.log('\n✅ Check completed!');
}

main().catch(console.error);


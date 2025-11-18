/**
 * DEBUG SCRIPT: Fix date format in Qdrant
 * 
 * This script fixes the submittedAt field in Qdrant to be ISO string format
 * instead of objects or other formats.
 * 
 * USAGE:
 *   node api/debug/fix-qdrant-dates.js [agencyId]
 */

import { qdrantRequest, COLLECTION_NAME, initializeQdrant } from '../lib/vectorDb.js';

/**
 * Convert date to ISO string format
 */
function toISOString(dateValue) {
  if (!dateValue) return null;
  
  if (typeof dateValue === 'string') {
    // Already a string, verify it's ISO
    if (dateValue.includes('T') && (dateValue.includes('Z') || dateValue.includes('+'))) {
      return dateValue;
    }
    // Try to parse and convert
    try {
      return new Date(dateValue).toISOString();
    } catch (e) {
      return null;
    }
  }
  
  if (dateValue instanceof Date) {
    return dateValue.toISOString();
  }
  
  // If it's an object (Firestore Timestamp-like), try to extract
  if (typeof dateValue === 'object') {
    if (dateValue.toDate && typeof dateValue.toDate === 'function') {
      return dateValue.toDate().toISOString();
    }
    if (dateValue.seconds) {
      // Firestore Timestamp format
      return new Date(dateValue.seconds * 1000).toISOString();
    }
    if (dateValue._seconds) {
      return new Date(dateValue._seconds * 1000).toISOString();
    }
  }
  
  // Last resort: try to convert
  try {
    return new Date(dateValue).toISOString();
  } catch (e) {
    return null;
  }
}

/**
 * Fix dates for all points in Qdrant
 */
async function fixQdrantDates(agencyId = null) {
  try {
    // Initialize Qdrant connection (same method as vector sync)
    console.log('🔌 Initializing Qdrant connection...');
    await initializeQdrant();
    console.log('✅ Qdrant initialized successfully\n');
    
    console.log('🔍 Fetching all points from Qdrant...');
    
    const filter = agencyId ? {
      must: [{
        key: 'agencyId',
        match: { value: agencyId }
      }]
    } : null;
    
    // Scroll through all points
    let allPoints = [];
    let nextPageOffset = null;
    let totalFixed = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    
    do {
      const scrollPayload = {
        limit: 100,
        with_payload: true,
        with_vector: false,
      };
      
      if (filter) {
        scrollPayload.filter = filter;
      }
      
      if (nextPageOffset) {
        scrollPayload.offset = nextPageOffset;
      }
      
      const response = await qdrantRequest(
        `/collections/${COLLECTION_NAME}/points/scroll`,
        {
          method: 'POST',
          body: JSON.stringify(scrollPayload)
        }
      );
      
      const points = response.result?.points || [];
      allPoints = allPoints.concat(points);
      nextPageOffset = response.result?.next_page_offset;
      
      console.log(`  📥 Fetched ${points.length} points (total: ${allPoints.length})...`);
      
    } while (nextPageOffset);
    
    console.log(`\n✅ Total points to check: ${allPoints.length}\n`);
    
    // Process points in batches
    const batchSize = 50;
    for (let i = 0; i < allPoints.length; i += batchSize) {
      const batch = allPoints.slice(i, i + batchSize);
      const updates = [];
      
      for (const point of batch) {
        const submittedAt = point.payload?.submittedAt;
        if (!submittedAt) {
          totalSkipped++;
          continue;
        }
        
        // Check if date needs fixing
        const isObject = typeof submittedAt === 'object' && submittedAt !== null;
        const isInvalidString = typeof submittedAt === 'string' && 
          (!submittedAt.includes('T') || (!submittedAt.includes('Z') && !submittedAt.includes('+')));
        
        if (isObject || isInvalidString) {
          const fixedDate = toISOString(submittedAt);
          if (fixedDate) {
            updates.push({
              id: point.id,
              payload: {
                submittedAt: fixedDate
              }
            });
          } else {
            console.warn(`  ⚠️  Could not fix date for point ${point.id}`);
            totalErrors++;
          }
        } else {
          totalSkipped++;
        }
      }
      
      // Update points using setPayload batch API
      if (updates.length > 0) {
        // Group updates by payload (in case different payloads need different updates)
        // For now, all updates have the same payload structure (submittedAt)
        const payloadToSet = updates[0].payload;
        const pointIds = updates.map(u => u.id);
        
        try {
          await qdrantRequest(
            `/collections/${COLLECTION_NAME}/points/payload`,
            {
              method: 'POST',
              body: JSON.stringify({
                points: pointIds,
                payload: payloadToSet
              })
            }
          );
          totalFixed += updates.length;
          console.log(`  ✅ Fixed ${updates.length} points (${totalFixed} total fixed, ${i + batch.length}/${allPoints.length} processed)`);
        } catch (error) {
          // If batch fails, try individual updates
          console.warn(`  ⚠️  Batch update failed, trying individual updates...`);
          for (const update of updates) {
            try {
              await qdrantRequest(
                `/collections/${COLLECTION_NAME}/points/payload`,
                {
                  method: 'POST',
                  body: JSON.stringify({
                    points: [update.id],
                    payload: update.payload
                  })
                }
              );
              totalFixed++;
            } catch (individualError) {
              // Some points might not exist (404) - skip them
              if (individualError.message.includes('404')) {
                console.warn(`  ⚠️  Point ${update.id} not found (may have been deleted), skipping...`);
                totalSkipped++;
              } else {
                console.error(`  ❌ Error updating point ${update.id}:`, individualError.message);
                totalErrors++;
              }
            }
          }
        }
      }
    }
    
    console.log('\n📊 SUMMARY:');
    console.log(`  ✅ Fixed: ${totalFixed}`);
    console.log(`  ⏭️  Skipped (already correct): ${totalSkipped}`);
    console.log(`  ❌ Errors: ${totalErrors}`);
    console.log(`  📦 Total processed: ${allPoints.length}`);
    
  } catch (error) {
    console.error('❌ Error fixing dates:', error);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  const agencyId = process.argv[2] || null;
  
  console.log('🔧 Fixing date formats in Qdrant...\n');
  if (agencyId) {
    console.log(`Agency ID: ${agencyId}\n`);
  } else {
    console.log('⚠️  No agency ID provided - will fix ALL entries\n');
  }
  
  await fixQdrantDates(agencyId);
  
  console.log('\n✅ Fix completed!');
}

main().catch(console.error);


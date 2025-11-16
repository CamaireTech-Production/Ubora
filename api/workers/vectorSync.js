/**
 * Vector Sync Worker
 * Synchronizes Firebase formEntries with Qdrant vector database
 * Handles CREATE, UPDATE, and DELETE operations
 */

import { adminDb, admin } from '../lib/firebaseAdmin.js';
import { extractFormEntryText } from '../lib/dataExtractor.js';
import {
  saveFormEntryToVector,
  updateFormEntryInVector,
  deleteFormEntryFromVector,
} from '../lib/vectorStorage.js';
import { initializeQdrant } from '../lib/vectorDb.js';

/**
 * Get form data by ID
 */
async function getFormById(formId) {
  try {
    const formDoc = await adminDb.collection('forms').doc(formId).get();
    if (formDoc.exists) {
      return { id: formDoc.id, ...formDoc.data() };
    }
    return null;
  } catch (error) {
    console.error(`❌ Error fetching form ${formId}:`, error);
    return null;
  }
}

/**
 * Sync a single form entry to vector database
 */
export async function syncFormEntryToVector(formEntryId, operation = 'create', useRawText = false) {
  try {
    console.log(`🔄 [VectorSync] ${operation.toUpperCase()} sync for formEntry: ${formEntryId}${useRawText ? ' (using raw text)' : ''}`);

    // Update status to processing
    await adminDb.collection('formEntries').doc(formEntryId).update({
      vectorSyncStatus: 'processing',
      vectorSyncStartedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Get form entry from Firebase
    const formEntryDoc = await adminDb.collection('formEntries').doc(formEntryId).get();

    if (!formEntryDoc.exists) {
      if (operation === 'delete') {
        // Entry was deleted, remove from vector DB
        console.log(`🗑️ [VectorSync] Entry deleted, removing from vector DB: ${formEntryId}`);
        await deleteFormEntryFromVector(formEntryId);
        return { success: true, operation: 'delete' };
      } else {
        throw new Error(`FormEntry ${formEntryId} does not exist`);
      }
    }

    const formEntry = { id: formEntryDoc.id, ...formEntryDoc.data() };

    // Get form data for metadata
    const formData = await getFormById(formEntry.formId);

    // Extract text from form entry (use raw text if requested)
    const extractedData = extractFormEntryText(formEntry, formData, useRawText);

    // Check if there's any content to index
    if (!extractedData.fullText || extractedData.fullText.trim().length === 0) {
      console.log(`⏭️ [VectorSync] No content to index for formEntry: ${formEntryId}`);
      await adminDb.collection('formEntries').doc(formEntryId).update({
        vectorSyncStatus: 'skipped',
        vectorSyncCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
        vectorChunksCount: 0,
        vectorSyncError: admin.firestore.FieldValue.delete(),
        vectorSyncFailedAt: admin.firestore.FieldValue.delete(),
        vectorSyncRetryCount: admin.firestore.FieldValue.delete(),
        vectorSyncStartedAt: admin.firestore.FieldValue.delete(),
      });
      return { success: true, operation, skipped: true };
    }

    // Sync to vector database
    let saveResult;
    if (operation === 'update') {
      // For update, delete old chunks first, then save new ones
      saveResult = await updateFormEntryInVector(extractedData);
    } else {
      saveResult = await saveFormEntryToVector(extractedData);
    }

    // Update Firebase with sync status
    await adminDb.collection('formEntries').doc(formEntryId).update({
      vectorSyncStatus: 'completed',
      vectorSyncCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
      vectorChunksCount: saveResult.chunks || 0,
      vectorSyncError: admin.firestore.FieldValue.delete(), // Clear any previous errors
      vectorSyncFailedAt: admin.firestore.FieldValue.delete(),
      vectorSyncRetryCount: admin.firestore.FieldValue.delete(), // Clear retry count on success
      vectorSyncStartedAt: admin.firestore.FieldValue.delete(), // Clear started timestamp
    });

    console.log(`✅ [VectorSync] Successfully synced formEntry: ${formEntryId}`);

    return {
      success: true,
      operation,
      formEntryId,
      chunksSaved: true,
    };
  } catch (error) {
    console.error(`❌ [VectorSync] Failed to sync formEntry ${formEntryId}:`, error);

    // Enhanced error logging
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      operation,
      formEntryId,
      timestamp: new Date().toISOString(),
    };
    console.error(`❌ [VectorSync] Error details:`, JSON.stringify(errorDetails, null, 2));

    // Update sync status with error and increment retry count
    try {
      const formEntryDoc = await adminDb.collection('formEntries').doc(formEntryId).get();
      const formEntryData = formEntryDoc.exists ? formEntryDoc.data() : {};
      const currentRetryCount = formEntryData.vectorSyncRetryCount || 0;
      
      await adminDb.collection('formEntries').doc(formEntryId).update({
        vectorSyncStatus: 'failed',
        vectorSyncError: error.message.substring(0, 500), // Limit error message length
        vectorSyncFailedAt: admin.firestore.FieldValue.serverTimestamp(),
        vectorSyncRetryCount: currentRetryCount + 1,
      });
    } catch (updateError) {
      console.error(`❌ [VectorSync] Failed to update sync status:`, updateError);
    }

    // Don't throw for non-critical errors - allow retry later
    // Only log critical errors that need immediate attention
    if (error.message.includes('Qdrant is not healthy') || 
        error.message.includes('Cannot connect to Qdrant')) {
      console.error(`🚨 [VectorSync] CRITICAL: Qdrant connection failed - vector DB may be down`);
      // Still don't throw to avoid breaking the main flow
    }

    // Return error info instead of throwing
    return { success: false, operation, error: error.message };
  }
}

/**
 * Initialize Qdrant connection (called once at startup)
 */
export async function initializeVectorSync() {
  try {
    await initializeQdrant();
    console.log('✅ Vector sync initialized');
  } catch (error) {
    console.error('❌ Failed to initialize vector sync:', error);
    throw error;
  }
}


/**
 * Vector Storage Service
 * Handles saving, updating, and deleting vectors in Qdrant
 */

import { qdrantRequest, COLLECTION_NAME } from './vectorDb.js';
import { generateEmbedding, chunkAndEmbed } from './embeddings.js';

/**
 * Generate unique point ID from form entry and chunk index
 */
function generatePointId(formEntryId, chunkIndex, fileIndex = null) {
  if (fileIndex !== null) {
    return `${formEntryId}_file_${fileIndex}_chunk_${chunkIndex}`;
  }
  return `${formEntryId}_chunk_${chunkIndex}`;
}

/**
 * Save a single chunk to vector database
 */
async function saveChunk(collectionName, pointId, text, embedding, metadata) {
  const payload = {
    points: [
      {
        id: pointId,
        vector: embedding,
        payload: {
          text,
          ...metadata,
        },
      },
    ],
  };

  await qdrantRequest(`/collections/${collectionName}/points`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

  return pointId;
}

/**
 * Save form entry to vector database
 */
export async function saveFormEntryToVector(
  formEntryTextData,
  collectionName = COLLECTION_NAME
) {
  const { fullText, metadata } = formEntryTextData;

  if (!fullText || fullText.trim().length === 0) {
    console.warn('⚠️ No text to save for form entry:', metadata.entryId);
    return { saved: false, chunks: 0 };
  }

  try {
    // Chunk and embed the text
    const chunkedData = await chunkAndEmbed(fullText);

    if (chunkedData.length === 0) {
      console.warn('⚠️ No chunks generated for form entry:', metadata.entryId);
      return { saved: false, chunks: 0 };
    }

    // Save all chunks
    const savedPointIds = [];

    for (let i = 0; i < chunkedData.length; i++) {
      const { text, embedding } = chunkedData[i];
      const pointId = generatePointId(metadata.entryId, i);

      const chunkMetadata = {
        agencyId: metadata.agencyId,
        universId: metadata.universId || null, // Univers ID for filtering
        formId: metadata.formId,
        formTitle: metadata.formTitle,
        userId: metadata.userId,
        employeeName: metadata.employeeName,
        submittedAt: metadata.submittedAt,
        entryId: metadata.entryId,
        chunkIndex: i,
        totalChunks: chunkedData.length,
        type: 'form_entry',
        indexedAt: new Date().toISOString(),
      };

      await saveChunk(collectionName, pointId, text, embedding, chunkMetadata);
      savedPointIds.push(pointId);
    }

    console.log(`✅ Saved ${savedPointIds.length} chunks for form entry: ${metadata.entryId}`);

    return {
      saved: true,
      chunks: savedPointIds.length,
      pointIds: savedPointIds,
      entryId: metadata.entryId,
    };
  } catch (error) {
    console.error(`❌ Failed to save form entry to vector DB:`, error);
    throw error;
  }
}

/**
 * Save file attachment text to vector database
 */
export async function saveFileAttachmentToVector(
  fileTextData,
  formEntryId,
  formMetadata,
  collectionName = COLLECTION_NAME
) {
  const { fileName, fileType, fileTypeLabel, text, submissionId } = fileTextData;

  if (!text || text.trim().length === 0) {
    console.warn('⚠️ No text to save for file:', fileName);
    return { saved: false, chunks: 0 };
  }

  try {
    // Chunk and embed the text
    const chunkedData = await chunkAndEmbed(text);

    if (chunkedData.length === 0) {
      console.warn('⚠️ No chunks generated for file:', fileName);
      return { saved: false, chunks: 0 };
    }

    // Find file index in attachments (for unique point IDs)
    const fileIndex = formMetadata.fileAttachments?.findIndex(
      att => att.fileName === fileName || att.submissionId === submissionId
    ) || 0;

    // Save all chunks
    const savedPointIds = [];

    for (let i = 0; i < chunkedData.length; i++) {
      const { text: chunkText, embedding } = chunkedData[i];
      const pointId = generatePointId(formEntryId, i, fileIndex);

      const chunkMetadata = {
        agencyId: formMetadata.agencyId,
        universId: formMetadata.universId || null, // Univers ID for filtering
        formId: formMetadata.formId,
        formTitle: formMetadata.formTitle,
        userId: formMetadata.userId,
        employeeName: formMetadata.employeeName,
        submittedAt: formMetadata.submittedAt,
        entryId: formEntryId,
        fileName,
        fileType,
        fileTypeLabel,
        submissionId,
        chunkIndex: i,
        totalChunks: chunkedData.length,
        type: 'file_attachment',
        indexedAt: new Date().toISOString(),
      };

      await saveChunk(collectionName, pointId, chunkText, embedding, chunkMetadata);
      savedPointIds.push(pointId);
    }

    console.log(`✅ Saved ${savedPointIds.length} chunks for file: ${fileName}`);

    return {
      saved: true,
      chunks: savedPointIds.length,
      pointIds: savedPointIds,
      fileName,
      entryId: formEntryId,
    };
  } catch (error) {
    console.error(`❌ Failed to save file attachment to vector DB:`, error);
    throw error;
  }
}

/**
 * Delete all chunks for a form entry
 */
export async function deleteFormEntryFromVector(
  formEntryId,
  collectionName = COLLECTION_NAME
) {
  try {
    // Find all points for this form entry
    // Qdrant doesn't support direct filtering by payload in delete, so we need to search first
    const searchPayload = {
      filter: {
        must: [
          {
            key: 'entryId',
            match: { value: formEntryId },
          },
        ],
      },
      limit: 10000, // Get all matching points
      with_payload: false,
      with_vector: false,
    };

    const searchResult = await qdrantRequest(
      `/collections/${collectionName}/points/scroll`,
      {
        method: 'POST',
        body: JSON.stringify(searchPayload),
      }
    );

    const pointIds = searchResult.result?.points?.map(p => p.id) || [];

    if (pointIds.length === 0) {
      console.log(`ℹ️ No chunks found to delete for form entry: ${formEntryId}`);
      return { deleted: false, chunks: 0 };
    }

    // Delete all points
    await qdrantRequest(`/collections/${collectionName}/points/delete`, {
      method: 'POST',
      body: JSON.stringify({
        points: pointIds,
      }),
    });

    console.log(`✅ Deleted ${pointIds.length} chunks for form entry: ${formEntryId}`);

    return {
      deleted: true,
      chunks: pointIds.length,
      pointIds,
    };
  } catch (error) {
    console.error(`❌ Failed to delete form entry from vector DB:`, error);
    throw error;
  }
}

/**
 * Update form entry in vector database (delete old, save new)
 */
export async function updateFormEntryInVector(
  formEntryTextData,
  collectionName = COLLECTION_NAME
) {
  const { metadata } = formEntryTextData;

  try {
    // Delete old chunks
    await deleteFormEntryFromVector(metadata.entryId, collectionName);

    // Save new chunks
    return await saveFormEntryToVector(formEntryTextData, collectionName);
  } catch (error) {
    console.error(`❌ Failed to update form entry in vector DB:`, error);
    throw error;
  }
}


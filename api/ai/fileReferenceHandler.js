/**
 * File Reference Handler
 * Handles detection and processing of file references in AI responses
 */

import { logger } from '../lib/logger.js';

/**
 * Get referenced files from response and analyzed files
 */
export function getReferencedFiles(answer, allAnalyzedFiles) {
  if (!answer || !allAnalyzedFiles || allAnalyzedFiles.length === 0) {
    return [];
  }

  const referencedFiles = [];
  const answerLower = answer.toLowerCase();

  allAnalyzedFiles.forEach(file => {
    const fileName = file.fileName.toLowerCase();
    const cleanFileName = fileName.replace(/^[0-9-]+-/, '').replace(/\.(pdf|png|jpg|jpeg|gif|bmp|webp|tiff)$/i, '');
    
    // Check for explicit citations
    const hasExplicitCitation = answerLower.includes(`selon le document ${fileName}`) ||
                                answerLower.includes(`dans le fichier ${fileName}`) ||
                                answerLower.includes(`dans l'image ${fileName}`) ||
                                answerLower.includes(`d'après ${fileName}`) ||
                                answerLower.includes(`selon ${fileName}`) ||
                                answerLower.includes(`fichier ${fileName}`) ||
                                answerLower.includes(`document ${fileName}`) ||
                                answerLower.includes(`image ${fileName}`) ||
                                answerLower.includes(cleanFileName);
    
    if (hasExplicitCitation) {
      referencedFiles.push(file);
    }
  });

  return referencedFiles;
}

/**
 * Process file references from submissions
 */
export function processFileReferences(data, answer) {
  // Get all analyzed files from submissions
  const allAnalyzedFiles = data.submissions && data.submissions.length > 0 ? data.submissions
    .flatMap(s => s.fileAttachments || [])
    .filter(att => att && att.fileName)
    .map(att => ({
      fileName: att.fileName,
      fileType: att.fileType,
      fileSize: att.fileSize,
      downloadUrl: att.downloadUrl,
      fieldId: att.fieldId,
      confidence: att.confidence || null
    })) : [];
  
  // Get only the files that are actually referenced in the response
  const referencedFiles = getReferencedFiles(answer, allAnalyzedFiles);
  
  // If no files are explicitly referenced but we have analyzed files, include all of them
  const finalReferencedFiles = referencedFiles.length > 0 ? referencedFiles : allAnalyzedFiles;
  
  // Separate PDF and image files for display
  const referencedPDFFiles = finalReferencedFiles.filter(f => f.fileType === 'application/pdf');
  const referencedImageFiles = finalReferencedFiles.filter(f => f.fileType && f.fileType.startsWith('image/'));
  
  // Log file detection for debugging
  logger.debug('FILE DETECTION', { 
    totalAnalyzed: allAnalyzedFiles.length,
    pdfs: allAnalyzedFiles.filter(f => f.fileType === 'application/pdf').length,
    images: allAnalyzedFiles.filter(f => f.fileType && f.fileType.startsWith('image/')).length,
    explicitlyReferenced: referencedFiles.length,
    totalDisplayed: finalReferencedFiles.length
  }, '/api/ai/fileReferenceHandler');
  
  if (allAnalyzedFiles.length > 0) {
    logger.debug('All analyzed files', { files: allAnalyzedFiles.map(f => f.fileName) }, '/api/ai/fileReferenceHandler');
    logger.debug('Explicitly referenced files', { files: referencedFiles.map(f => f.fileName) }, '/api/ai/fileReferenceHandler');
    logger.debug('Final displayed files', { files: finalReferencedFiles.map(f => f.fileName) }, '/api/ai/fileReferenceHandler');
  }
  
  return {
    referencedPDFFiles,
    referencedImageFiles,
    allAnalyzedFiles
  };
}


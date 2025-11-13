/**
 * Data Extraction Service
 * Extracts and formats text from form submissions and file attachments for vector storage
 */

/**
 * Extract text from form entry answers
 */
export function extractFormAnswersText(formEntry, formData = null) {
  if (!formEntry || !formEntry.answers) {
    return '';
  }

  const textParts = [];

  // If we have form data with field labels, use them
  if (formData && formData.fields) {
    Object.entries(formEntry.answers).forEach(([fieldId, value]) => {
      const field = formData.fields.find(f => f.id === fieldId);
      const fieldLabel = field ? field.label : fieldId;
      
      // Format the answer
      let answerText = '';
      if (value === null || value === undefined) {
        answerText = 'Non renseigné';
      } else if (typeof value === 'boolean') {
        answerText = value ? 'Oui' : 'Non';
      } else if (Array.isArray(value)) {
        answerText = value.join(', ');
      } else {
        answerText = String(value);
      }

      textParts.push(`${fieldLabel}: ${answerText}`);
    });
  } else {
    // Fallback: use field IDs
    Object.entries(formEntry.answers).forEach(([fieldId, value]) => {
      const answerText = value !== null && value !== undefined ? String(value) : 'Non renseigné';
      textParts.push(`${fieldId}: ${answerText}`);
    });
  }

  return textParts.join('\n');
}

/**
 * Extract text from file attachments (PDF/image OCR text)
 * @param {Array} fileAttachments - Array of file attachments
 * @param {boolean} useRawText - If true, use rawExtractedText instead of formatted extractedText
 */
export function extractFileAttachmentsText(fileAttachments = [], useRawText = false) {
  if (!fileAttachments || fileAttachments.length === 0) {
    return [];
  }

  const extractedTexts = [];

  fileAttachments.forEach((attachment, index) => {
    const fileName = attachment.fileName || `Fichier ${index + 1}`;
    const fileType = attachment.fileType || 'unknown';

    // Use raw text if requested, otherwise prefer formatted text, fallback to raw
    const text = useRawText 
      ? (attachment.rawExtractedText || attachment.extractedText || '')
      : (attachment.extractedText || attachment.rawExtractedText || '');
    
    if (text && text.trim().length > 0) {
      // Determine file type label
      let fileTypeLabel = 'Document';
      if (fileType === 'application/pdf') {
        fileTypeLabel = 'Document PDF';
      } else if (fileType.startsWith('image/')) {
        fileTypeLabel = 'Image';
      }

      extractedTexts.push({
        fileName,
        fileType,
        fileTypeLabel,
        text: text.trim(),
        submissionId: attachment.submissionId || null,
      });
    }
  });

  return extractedTexts;
}

/**
 * Combine all text from a form entry into searchable format
 * @param {Object} formEntry - The form entry document
 * @param {Object} formData - The form template data
 * @param {boolean} useRawText - If true, use rawExtractedText for file attachments instead of formatted text
 */
export function extractFormEntryText(formEntry, formData = null, useRawText = false) {
  const textParts = [];

  // Add form title if available
  if (formData && formData.title) {
    textParts.push(`Formulaire: ${formData.title}`);
  }

  // Add employee name if available (from formEntry metadata)
  if (formEntry.employeeName) {
    textParts.push(`Employé: ${formEntry.employeeName}`);
  }

  // Add submission date
  if (formEntry.submittedAt) {
    const date = new Date(formEntry.submittedAt);
    textParts.push(`Date de soumission: ${date.toLocaleDateString('fr-FR')}`);
  }

  // Extract answers text
  const answersText = extractFormAnswersText(formEntry, formData);
  if (answersText) {
    textParts.push('\nRéponses:');
    textParts.push(answersText);
  }

  // Extract file attachments text (with useRawText flag)
  const fileTexts = extractFileAttachmentsText(formEntry.fileAttachments, useRawText);
  if (fileTexts.length > 0) {
    textParts.push('\nDocuments joints:');
    fileTexts.forEach((fileText, index) => {
      textParts.push(`\n${fileText.fileTypeLabel}: ${fileText.fileName}`);
      textParts.push(fileText.text);
    });
  }

  return {
    fullText: textParts.join('\n'),
    answersText,
    fileTexts,
    metadata: {
      agencyId: formEntry.agencyId,
      universId: formData?.universId || null, // Univers ID from form
      formId: formEntry.formId,
      formTitle: formData?.title || `Formulaire ${formEntry.formId}`,
      userId: formEntry.userId,
      employeeName: formEntry.employeeName || `Utilisateur ${formEntry.userId}`,
      submittedAt: formEntry.submittedAt,
      entryId: formEntry.id,
      fileAttachments: formEntry.fileAttachments || [],
    },
  };
}

/**
 * Extract text from multiple form entries
 */
export function extractMultipleFormEntriesText(formEntries, formsById = new Map()) {
  return formEntries.map(entry => {
    const formData = formsById.get(entry.formId) || null;
    return extractFormEntryText(entry, formData);
  });
}


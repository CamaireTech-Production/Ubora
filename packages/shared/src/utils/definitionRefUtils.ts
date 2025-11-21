/**
 * Utility functions for generating and managing definition references (refs)
 * Definition refs are unique identifiers for resources in Univers definitions
 * Format: "univers-{uuid}"
 */

/**
 * Generate a unique definition reference
 * @returns A unique ref in the format "univers-{uuid}"
 */
export function generateDefinitionRef(): string {
  // Use crypto.randomUUID if available (browser/Node.js 16+)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `univers-${crypto.randomUUID()}`;
  }
  
  // Fallback for older environments
  // Generate UUID v4 manually
  return `univers-${generateUUIDv4()}`;
}

/**
 * Generate a UUID v4 manually (fallback)
 * @returns A UUID v4 string
 */
function generateUUIDv4(): string {
  // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  // where x is any hexadecimal digit and y is one of 8, 9, A, or B
  const hexDigits = '0123456789abcdef';
  let uuid = '';
  
  // Generate random hex digits
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      uuid += '-';
    } else if (i === 14) {
      uuid += '4'; // Version 4
    } else if (i === 19) {
      // Variant bits: 10xx
      uuid += hexDigits[(Math.random() * 4 | 0) + 8]; // 8, 9, a, or b
    } else {
      uuid += hexDigits[Math.random() * 16 | 0];
    }
  }
  
  return uuid;
}

/**
 * Validate that a string is a valid definition ref
 * @param ref - The ref to validate
 * @returns true if the ref is valid, false otherwise
 */
export function isValidDefinitionRef(ref: string): boolean {
  if (!ref || typeof ref !== 'string') {
    return false;
  }
  
  // Check format: "univers-{uuid}"
  const refPattern = /^univers-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return refPattern.test(ref);
}

/**
 * Extract the UUID part from a definition ref
 * @param ref - The definition ref
 * @returns The UUID part without the "univers-" prefix, or null if invalid
 */
export function extractUUIDFromRef(ref: string): string | null {
  if (!isValidDefinitionRef(ref)) {
    return null;
  }
  
  return ref.replace(/^univers-/, '');
}


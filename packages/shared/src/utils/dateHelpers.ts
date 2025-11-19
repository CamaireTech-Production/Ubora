import { Timestamp } from 'firebase/firestore';

/**
 * Convert Firestore Timestamp or Date to JavaScript Date
 * Handles null/undefined values safely
 */
export function toDate(value: Date | Timestamp | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  return null;
}

/**
 * Convert Date or Timestamp to Firestore Timestamp
 * Handles null/undefined values safely
 */
export function toTimestamp(value: Date | Timestamp | null | undefined): Timestamp | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value;
  if (value instanceof Date) return Timestamp.fromDate(value);
  return null;
}

/**
 * Check if value is a Firestore Timestamp
 */
export function isTimestamp(value: unknown): value is Timestamp {
  return value !== null && 
         typeof value === 'object' && 
         'toDate' in value && 
         typeof (value as Timestamp).toDate === 'function';
}

/**
 * Check if value is a Date or Timestamp
 */
export function isDateOrTimestamp(value: unknown): value is Date | Timestamp {
  return value instanceof Date || isTimestamp(value);
}


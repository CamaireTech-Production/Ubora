import { FirebaseError } from 'firebase/app';

/**
 * Error with optional code property
 */
export interface ErrorWithCode extends Error {
  code?: string;
}

/**
 * Union type for all possible error types
 */
export type FirebaseErrorType = Error | FirebaseError | ErrorWithCode | unknown;

/**
 * Type guard to check if error has a code property
 */
export function hasErrorCode(error: unknown): error is ErrorWithCode {
  return error !== null && 
         typeof error === 'object' && 
         'code' in error && 
         typeof (error as ErrorWithCode).code === 'string';
}

/**
 * Type guard to check if error is a FirebaseError
 */
export function isFirebaseError(error: unknown): error is FirebaseError {
  return error !== null && 
         typeof error === 'object' && 
         'code' in error && 
         typeof (error as FirebaseError).code === 'string' &&
         'message' in error;
}

/**
 * Extract error code safely
 */
export function getErrorCode(error: unknown): string | undefined {
  if (hasErrorCode(error)) return error.code;
  if (isFirebaseError(error)) return error.code;
  return undefined;
}

/**
 * Extract error message safely
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (isFirebaseError(error)) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}


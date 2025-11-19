import { describe, test, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { toDate, toTimestamp, isTimestamp, isDateOrTimestamp } from '../dateHelpers';

describe('dateHelpers', () => {
  describe('toDate', () => {
    test('should convert Date to Date', () => {
      const date = new Date('2024-01-15');
      expect(toDate(date)).toEqual(date);
    });

    test('should convert Timestamp to Date', () => {
      const date = new Date('2024-01-15');
      const timestamp = Timestamp.fromDate(date);
      const result = toDate(timestamp);
      
      expect(result).toBeInstanceOf(Date);
      expect(result?.getTime()).toBe(date.getTime());
    });

    test('should return null for null input', () => {
      expect(toDate(null)).toBeNull();
    });

    test('should return null for undefined input', () => {
      expect(toDate(undefined)).toBeNull();
    });

    test('should return null for invalid input', () => {
      expect(toDate('invalid' as any)).toBeNull();
    });
  });

  describe('toTimestamp', () => {
    test('should convert Date to Timestamp', () => {
      const date = new Date('2024-01-15');
      const result = toTimestamp(date);
      
      expect(result).toBeInstanceOf(Timestamp);
      expect(result?.toDate().getTime()).toBe(date.getTime());
    });

    test('should return Timestamp as-is', () => {
      const timestamp = Timestamp.fromDate(new Date('2024-01-15'));
      const result = toTimestamp(timestamp);
      
      expect(result).toBe(timestamp);
    });

    test('should return null for null input', () => {
      expect(toTimestamp(null)).toBeNull();
    });

    test('should return null for undefined input', () => {
      expect(toTimestamp(undefined)).toBeNull();
    });
  });

  describe('isTimestamp', () => {
    test('should return true for Timestamp', () => {
      const timestamp = Timestamp.fromDate(new Date());
      expect(isTimestamp(timestamp)).toBe(true);
    });

    test('should return false for Date', () => {
      expect(isTimestamp(new Date())).toBe(false);
    });

    test('should return false for null', () => {
      expect(isTimestamp(null)).toBe(false);
    });

    test('should return false for string', () => {
      expect(isTimestamp('2024-01-15')).toBe(false);
    });

    test('should return false for number', () => {
      expect(isTimestamp(1234567890)).toBe(false);
    });
  });

  describe('isDateOrTimestamp', () => {
    test('should return true for Date', () => {
      expect(isDateOrTimestamp(new Date())).toBe(true);
    });

    test('should return true for Timestamp', () => {
      const timestamp = Timestamp.fromDate(new Date());
      expect(isDateOrTimestamp(timestamp)).toBe(true);
    });

    test('should return false for null', () => {
      expect(isDateOrTimestamp(null)).toBe(false);
    });

    test('should return false for string', () => {
      expect(isDateOrTimestamp('2024-01-15')).toBe(false);
    });
  });
});


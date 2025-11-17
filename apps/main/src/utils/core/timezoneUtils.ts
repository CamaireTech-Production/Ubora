/**
 * Timezone utilities for Cameroon (UTC+1)
 * Cameroon does not observe daylight saving time, so it's always UTC+1
 */

export const CAMEROON_TIMEZONE = 'Africa/Douala'; // Cameroon's timezone
export const CAMEROON_UTC_OFFSET = 1; // UTC+1

/**
 * Get current time in Cameroon timezone
 */
export function getCameroonTime(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: CAMEROON_TIMEZONE }));
}

/**
 * Convert a date to Cameroon timezone
 */
export function toCameroonTime(date: Date): Date {
  // Get the timezone offset for Cameroon
  const cameroonTime = new Date(date.toLocaleString("en-US", { timeZone: CAMEROON_TIMEZONE }));
  return cameroonTime;
}

/**
 * Convert a date from Cameroon timezone to UTC
 */
export function fromCameroonTimeToUTC(date: Date): Date {
  // Create a new date with the same local time but in UTC
  const utcDate = new Date(date.getTime() - (CAMEROON_UTC_OFFSET * 60 * 60 * 1000));
  return utcDate;
}

/**
 * Convert a date from UTC to Cameroon timezone
 */
export function fromUTCToCameroonTime(date: Date): Date {
  // Create a new date with the same UTC time but in Cameroon timezone
  const cameroonDate = new Date(date.getTime() + (CAMEROON_UTC_OFFSET * 60 * 60 * 1000));
  return cameroonDate;
}

/**
 * Format a date for display in Cameroon timezone
 */
export function formatCameroonTime(date: Date, options?: Intl.DateTimeFormatOptions): string {
  return date.toLocaleString('fr-FR', {
    timeZone: CAMEROON_TIMEZONE,
    ...options
  });
}

/**
 * Get the timezone offset for Cameroon in minutes
 */
export function getCameroonTimezoneOffset(): number {
  return CAMEROON_UTC_OFFSET * 60; // 60 minutes
}

/**
 * Check if a date is in the past (considering Cameroon timezone)
 */
export function isDateInPast(date: Date): boolean {
  const now = getCameroonTime();
  return date < now;
}

/**
 * Create a date in Cameroon timezone from date and time strings
 */
export function createCameroonDateTime(dateString: string, timeString: string): Date {
  // Create date in local timezone first
  const localDate = new Date(`${dateString}T${timeString}`);
  
  // Convert to Cameroon timezone
  return toCameroonTime(localDate);
}

/**
 * Get the next execution time in Cameroon timezone
 */
export function calculateNextExecutionCameroon(
  scheduledAt: Date, 
  frequency: 'once' | 'daily' | 'weekly' | 'monthly'
): Date {
  const now = getCameroonTime();
  const base = toCameroonTime(scheduledAt);
  const hh = base.getHours();
  const mm = base.getMinutes();

  // Helper to construct a Cameroon local date at given day with same HH:mm
  const makeAt = (date: Date) => {
    const d = new Date(date);
    d.setHours(hh, mm, 0, 0);
    return d;
  };

  if (frequency === 'once') {
    return scheduledAt;
  }

  if (frequency === 'daily') {
    let candidate = makeAt(now);
    if (candidate <= now) {
      candidate.setDate(candidate.getDate() + 1);
    }
    return candidate;
  }

  if (frequency === 'weekly') {
    // Align to the same weekday as original scheduledAt
    const targetDow = base.getDay(); // 0-6
    const current = new Date(now);
    current.setHours(hh, mm, 0, 0);
    const diff = (targetDow - now.getDay() + 7) % 7;
    let candidate = new Date(current);
    candidate.setDate(now.getDate() + diff);
    if (candidate <= now) {
      candidate.setDate(candidate.getDate() + 7);
    }
    return candidate;
  }

  if (frequency === 'monthly') {
    const day = base.getDate();
    const candidate = new Date(now.getFullYear(), now.getMonth(), day, hh, mm, 0, 0);
    if (candidate <= now) {
      candidate.setMonth(candidate.getMonth() + 1);
    }
    return candidate;
  }

  return scheduledAt;
}

/**
 * Get timezone display string for Cameroon
 */
export function getCameroonTimezoneDisplay(): string {
  return 'UTC+1 (Cameroun)';
}

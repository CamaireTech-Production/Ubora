/**
 * Period Detection Module
 * Extracted from ask.js for better code organization
 * 
 * Functions:
 * - detectPeriodFromQuestion: Detects period from question text
 * - getPeriodDates: Calculates start/end dates for a given period
 */

/**
 * Detect period from question text if not provided in filters
 * @param {string} question - The question text
 * @returns {string|null} - Detected period or null
 */
function detectPeriodFromQuestion(question) {
  if (!question || typeof question !== 'string') return null;
  
  const q = question.toLowerCase();
  
  // Patterns pour détecter la période
  if (q.includes('cette semaine') || q.includes('semaine en cours')) {
    return 'this_week';
  }
  if (q.includes('semaine dernière') || q.includes('semaine passée')) {
    return 'last_week';
  }
  if (q.includes('aujourd\'hui') || q.includes('aujourd hui') || q.includes('ce jour')) {
    return 'today';
  }
  if (q.includes('hier')) {
    return 'yesterday';
  }
  if (q.includes('ce mois') || q.includes('mois en cours')) {
    return 'this_month';
  }
  if (q.includes('mois dernier') || q.includes('mois passé')) {
    return 'last_month';
  }
  if (q.includes('7 derniers jours') || q.includes('7 jours')) {
    return 'last_7d';
  }
  if (q.includes('30 derniers jours') || q.includes('30 jours')) {
    return 'last_30d';
  }
  if (q.includes('90 derniers jours') || q.includes('90 jours')) {
    return 'last_90d';
  }
  
  return null;
}

/**
 * Calculate start and end dates for a given period
 * @param {string} period - Period identifier (e.g., 'today', 'this_week', 'last_month', etc.)
 * @returns {{start: Date, end: Date, label: string}} - Period dates and label
 */
function getPeriodDates(period) {
  const now = new Date();
  let start;
  let end = now;
  let label;

  if (!period || period === 'all') {
    // Par défaut : toutes les données (pas de filtre de date)
    start = new Date(0); // 1970-01-01
    end = now;
    label = 'toutes les données';
  } else if (period === 'today') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    label = "aujourd'hui";
  } else if (period === 'yesterday') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    label = 'hier';
  } else if (period === 'this_week') {
    // Cette semaine (lundi à aujourd'hui)
    const dayOfWeek = now.getDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysFromMonday);
    label = 'cette semaine';
  } else if (period === 'last_week') {
    // Semaine dernière (lundi à dimanche)
    const dayOfWeek = now.getDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const lastMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysFromMonday - 7);
    const lastSunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysFromMonday - 1, 23, 59, 59);
    start = lastMonday;
    end = lastSunday;
    label = 'semaine dernière';
  } else if (period === 'this_month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    label = 'ce mois';
  } else if (period === 'last_month') {
    // Mois dernier
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    start = lastMonth;
    end = lastMonthEnd;
    label = 'mois dernier';
  } else if (period === 'last_7d') {
    start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    label = 'les 7 derniers jours';
  } else if (period === 'last_30d') {
    start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    label = 'les 30 derniers jours';
  } else if (period === 'last_90d') {
    start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    label = 'les 90 derniers jours';
  } else if (period.includes(' - ')) {
    // Format personnalisé "dd/mm/yyyy - dd/mm/yyyy"
    const [startStr, endStr] = period.split(' - ');
    const [startDay, startMonth, startYear] = startStr.split('/').map(Number);
    const [endDay, endMonth, endYear] = endStr.split('/').map(Number);
    start = new Date(startYear, startMonth - 1, startDay);
    end = new Date(endYear, endMonth - 1, endDay, 23, 59, 59);
    label = `du ${startStr} au ${endStr}`;
  } else {
    // Par défaut : toutes les données
    start = new Date(0);
    end = now;
    label = 'toutes les données';
  }

  return { start, end, label };
}

export {
  detectPeriodFromQuestion,
  getPeriodDates
};


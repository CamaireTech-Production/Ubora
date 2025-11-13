import dotenv from 'dotenv';
import path from 'path';
const loadedLocalEnv = dotenv.config({ path: path.join(process.cwd(), '.env.local') });
if (!loadedLocalEnv || !loadedLocalEnv.parsed) {
  dotenv.config({ path: path.join(process.cwd(), '.env') });
}

import { adminDb, admin } from '../lib/firebaseAdmin.js';
import { Timestamp } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';
import { buildAbsoluteUrl, renderEmailTemplate } from '../lib/urlEmail.js';
import { executeAIQuestion } from '../lib/executeAIQuestion.js';

// Use the shared Firebase Admin instance (loads from .env.local via firebaseAdmin.js)
// Ensure db is always a proper Firestore instance
const db = adminDb || admin.firestore();

// Lazy safety check: ensure db is properly initialized (only when cron runs, not at module load)
function ensureDbInitialized() {
  if (!db || typeof db.collectionGroup !== 'function' || typeof db.collection !== 'function') {
    const error = new Error('Firebase Admin Firestore not properly initialized. Check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables.');
    console.error('❌ [Cron] Firestore initialization check failed:', error.message);
    throw error;
  }
}

// Lightweight email sender (reuse env used elsewhere). If no creds, skip.
function makeEmailTransporter() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) return null;
  const host = process.env.EMAIL_HOST || 'smtp.titan.email';
  const port = parseInt(process.env.EMAIL_PORT || '587', 10);
  const secure = typeof process.env.EMAIL_SECURE === 'string'
    ? process.env.EMAIL_SECURE === 'true'
    : port === 465;
  return nodemailer.createTransport({ host, port, secure, auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD } });
}

async function sendReminderEmail(transporter, { to, formTitle, intervalMinutes, redirectUrl }) {
  if (!transporter || !to) return { skipped: true };
  const fromName = process.env.EMAIL_FROM_NAME || 'Ubora App';
  const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  const subject = `Rappel: ${formTitle} (${intervalMinutes} min restantes)`;
  const html = renderEmailTemplate({
    title: 'Rappel de formulaire',
    body: `N'oubliez pas de remplir le formulaire <strong>${formTitle}</strong>. Il reste ${intervalMinutes} minutes.`,
    ctaLabel: 'Ouvrir le formulaire',
    ctaHref: redirectUrl,
  });
  const info = await transporter.sendMail({ from: fromAddress ? `${fromName} <${fromAddress}>` : undefined, to, subject, html, text: html.replace(/<[^>]*>/g, '') });
  return { messageId: info.messageId };
}

// Configuration for concurrent processing
const MAX_CONCURRENT_PROCESSING = 10; // Process up to 10 notifications concurrently
const BATCH_SIZE = 5; // Process notifications in batches of 5

// Normalize roles to supported set
function normalizeRole(role) {
  if (role === 'directeur') return 'directeur';
  return 'employe';
}

// Parse date and time strings as Africa/Douala local time (UTC+1, no DST)
function parseAfricaDoualaLocalDateTime(dateStr, timeStr) {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hour, minute] = timeStr.split(':').map(Number);
    // Construct UTC by subtracting fixed offset (+1h) so that local 10:00 becomes 09:00Z
    const utcHour = (hour - 1 + 24) % 24;
    return new Date(Date.UTC(year, (month || 1) - 1, day || 1, utcHour, minute || 0, 0, 0));
  } catch (e) {
    // Fallback to native parsing
    return new Date(`${dateStr}T${timeStr}`);
  }
}

// Build today's due time (Africa/Douala) from an HH:mm string
function buildTodayDueAtAfricaDouala(endTimeStr) {
  try {
    const now = new Date();
    const [hourStr, minuteStr] = (endTimeStr || '').split(':');
    const hour = parseInt(hourStr || '0', 10);
    const minute = parseInt(minuteStr || '0', 10);
    // Convert Douala local to UTC by subtracting 1 hour
    const utcHour = (hour - 1 + 24) % 24;
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), utcHour, minute, 0, 0));
  } catch (e) {
    return null;
  }
}

// Get Africa/Douala weekday number (0=Sunday … 6=Saturday)
function getAfricaDoualaWeekdayNumber(referenceDate) {
  const base = referenceDate instanceof Date ? referenceDate : new Date();
  // Africa/Douala is UTC+1, shift by +1h from UTC and use getUTCDay for stable weekday
  const doualaShifted = new Date(base.getTime() + 60 * 60 * 1000);
  return doualaShifted.getUTCDay();
}

/**
 * Process notifications concurrently in batches
 */
async function processNotificationsConcurrently(notifications, processorFunction) {
  const results = {
    processed: 0,
    sent: 0,
    errors: 0,
    errorDetails: []
  };

  // Process notifications in batches for better concurrency
  const batches = [];
  for (let i = 0; i < notifications.length; i += BATCH_SIZE) {
    batches.push(notifications.slice(i, i + BATCH_SIZE));
  }

  // Processing notifications - detailed logs removed for verbosity
  // Only log if there are notifications to process
  if (notifications.length > 0) {
    console.log(`🔄 [Cron] Processing ${notifications.length} notifications`);
  }

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];

    const batchPromises = batch.map(async (notification, itemIndex) => {
      try {
        const result = await processorFunction(notification);
        results.processed++;
        results.sent += result.sent || 0;
        // Success log removed for verbosity
        return result;
      } catch (error) {
        results.errors++;
        results.errorDetails.push({ 
          notification: notification.id || 'unknown', 
          error: error.message,
          batch: batchIndex + 1,
          item: itemIndex + 1
        });
        console.error(`❌ [Cron] Error processing notification:`, error.message);
        return { sent: 0, error: error.message };
      }
    });

    // Wait for batch to complete before processing next batch
    await Promise.allSettled(batchPromises);
    
    // Small delay between batches to prevent overwhelming the system
    if (batchIndex < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
    }
  }

  // Only log if there were errors or notifications sent
  if (results.errors > 0 || results.sent > 0) {
    console.log(`📊 [Cron] Batch processing: ${results.processed} processed, ${results.sent} sent, ${results.errors} errors`);
  }
  return results;
}

/**
 * Unified Cron Job for All Notifications
 * 
 * This endpoint handles all scheduled notifications:
 * - form_reminder: 1h, 30min, 15min, 5min before form deadline
 * - metric_reminder: Director-programmed metric reminders
 * - programmed_instruction: When scheduled instructions are executed
 */
export default async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Reduced logging - only log if there's activity
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    const oneMinuteFromNow = new Date(now.getTime() + 60 * 1000);
    
    let processedCount = 0;
    let sentCount = 0;
    let errorCount = 0;

    // 1. Process form reminders (1h, 30min, 15min, 5min before deadline)
    const formReminders = await processFormReminders(now, oneMinuteFromNow);
    processedCount += formReminders.processed;
    sentCount += formReminders.sent;
    errorCount += formReminders.errors;

    // 2. Process metric reminders (director-programmed)
    const metricReminders = await processMetricReminders(now, oneMinuteFromNow);
    processedCount += metricReminders.processed;
    sentCount += metricReminders.sent;
    errorCount += metricReminders.errors;

    // 3. Execute due programmed instructions, then notify for ready/completed
    await executeDueProgrammedInstructions(now, oneMinuteFromNow);
    const instructionReminders = await processProgrammedInstructions(now, oneMinuteFromNow);
    processedCount += instructionReminders.processed;
    sentCount += instructionReminders.sent;
    errorCount += instructionReminders.errors;

    // 4. Process subscription renewals
    const renewalResults = await processSubscriptionRenewals(now);
    processedCount += renewalResults.processed;
    sentCount += renewalResults.renewed;
    errorCount += renewalResults.errors;

    // 5. Handle expired subscriptions
    const expirationResults = await handleExpiredSubscriptions(now);
    processedCount += expirationResults.processed;
    sentCount += expirationResults.expired;
    errorCount += expirationResults.errors;

    // Only log if there's activity or errors
    if (sentCount > 0 || errorCount > 0) {
      console.log(`✅ [Cron] Completed: ${processedCount} processed, ${sentCount} sent, ${errorCount} errors`);
    }

    return res.status(200).json({
      success: true,
      processed: processedCount,
      sent: sentCount,
      errors: errorCount,
      timestamp: now.toISOString()
    });

  } catch (error) {
    console.error('❌ [Cron] Error in unified notification cron job:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
};

/**
 * Process form reminders (1h, 30min, 15min, 5min before deadline) - CONCURRENT VERSION
 */
async function processFormReminders(now, oneMinuteFromNow) {
  ensureDbInitialized(); // Lazy check: ensure Firestore is initialized before use
  try {
    // Step 1: Collect all form reminders that need to be sent
    // Use collection group to support nested form collections
    const formsSnapshot = await db.collectionGroup('forms').get();

    const remindersToProcess = [];

    // Found forms with deadlines - log removed for verbosity
    if (formsSnapshot.docs.length > 0) {
      // Log a concise preview of raw deadline fields for first few forms
      const preview = formsSnapshot.docs.slice(0, 5).map((d) => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title || '(no title)',
          deadlineRaw: data.deadline || null,
          assignedToCount: Array.isArray(data.assignedTo) ? data.assignedTo.length : 0,
        };
      });
      // Forms deadline preview - log removed for verbosity
    }

    for (const formDoc of formsSnapshot.docs) {
      const form = { id: formDoc.id, ...formDoc.data() };
      
      const assignedTo = Array.isArray(form.assignedTo) ? form.assignedTo : [];
      const timeRestrictions = form.timeRestrictions || {};
      const allowedDays = Array.isArray(timeRestrictions.allowedDays) ? timeRestrictions.allowedDays : [];
      const endTime = timeRestrictions.endTime;

      if (assignedTo.length === 0) {
        // Skip form (no assigned users) - log removed for verbosity
        continue;
      }
      if (!endTime) {
        // Skip form (missing endTime) - log removed for verbosity
        continue;
      }

      // Check today's weekday is allowed (numeric 0–6 only). Empty means "no reminders".
      const todayNum = getAfricaDoualaWeekdayNumber(now);
      const isAllowedToday = Array.isArray(allowedDays) && allowedDays.length > 0 && allowedDays.includes(todayNum);
      if (!isAllowedToday) {
        // Skip form (today not allowed) - log removed for verbosity
        continue;
      }

      // Build today's deadline from endTime (Africa/Douala)
      const deadlineDate = buildTodayDueAtAfricaDouala(endTime);
      if (!deadlineDate) continue;
      const reminderIntervals = [60, 30, 15, 5]; // minutes before deadline

      // Processing form - detailed logs removed for verbosity

      // Use widened window for 2-min cadence
      const windowStart = new Date(now.getTime() - 60 * 1000);
      const windowEnd = new Date(oneMinuteFromNow.getTime() + 0);

      for (const userId of assignedTo) {
        for (const intervalMinutes of reminderIntervals) {
          const reminderTime = new Date(deadlineDate.getTime() - intervalMinutes * 60 * 1000);
          
          // Detailed logging for each reminder check
          const shouldSend = reminderTime >= windowStart && reminderTime <= windowEnd;
          // Also compute a tolerance window (not used for sending) to detect near-misses
          const ninetySeconds = 90 * 1000;
          const windowStartTolerance = new Date(now.getTime() - ninetySeconds);
          const windowEndTolerance = new Date(oneMinuteFromNow.getTime() + ninetySeconds);
          // Reminder check - detailed logs removed for verbosity (only log if actually sending)
          
          // Check if this reminder should be sent now
          if (shouldSend) {
            remindersToProcess.push({
              form,
              userId,
              intervalMinutes,
              reminderTime,
              reminderTimeIso: reminderTime.toISOString()
            });
          }
        }
      }
    }

    if (remindersToProcess.length === 0) {
      // No reminders due - log removed for verbosity
      return { processed: 0, sent: 0, errors: 0 };
    }

    // Only log if there are reminders to process
    if (remindersToProcess.length > 0) {
      console.log(`📅 [Cron] Processing ${remindersToProcess.length} form reminders`);
    }

    // Step 2: Process reminders concurrently
    const transporter = makeEmailTransporter();
    const processorFunction = async (reminderData) => {
      try {
        const { form, userId, intervalMinutes, reminderTime, reminderTimeIso } = reminderData;
        
        // Get user data (do not fail hard if missing)
        let userData = null;
        try {
              const userDoc = await db.collection('users').doc(userId).get();
          userData = userDoc.exists ? userDoc.data() : null;
        } catch (e) {
          console.warn(`⚠️ [Cron] Failed to fetch user ${userId}, proceeding with defaults`);
        }

        // Store notification in Firestore with idempotent key - frontend will handle browser display
        const atIso = reminderTimeIso || (reminderTime instanceof Date ? reminderTime.toISOString() : new Date().toISOString());
        const idempotencyKey = `form:${form.id}:user:${userId}:reminder:${intervalMinutes}:at:${atIso}`;
        const redirectPath = `/forms/${form.id}`;
        const notificationDoc = {
                  title: 'Rappel de formulaire',
                  body: `N'oubliez pas de remplir le formulaire "${form.title}" (${intervalMinutes}min restantes)`,
          type: 'form_reminder',
          recipientId: userId,
          recipientRole: normalizeRole(userData?.role),
          agencyId: userData?.agencyId || 'unknown',
                  data: {
                    type: 'form_reminder',
                    formId: form.id,
                    formTitle: form.title,
                    intervalMinutes: intervalMinutes.toString(),
            redirectPath,
                    timestamp: now.getTime().toString()
          },
          redirectUrl: redirectPath,
                  read: false,
                  status: 'sent',
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                  sentAt: admin.firestore.FieldValue.serverTimestamp(),
                  emailAddress: userData?.email,
                  idempotencyKey
                };

        const docId = `form_reminder:${form.id}:${userId}:${intervalMinutes}:${atIso}`;
        await db.collection('notifications').doc(docId).set(notificationDoc, { merge: true });
        // Form reminder stored - detailed log removed for verbosity
        // Attempt email delivery (non-fatal)
        try {
          if (userData?.email) {
            await sendReminderEmail(transporter, {
              to: userData.email,
              formTitle: form.title,
              intervalMinutes,
              redirectUrl: buildAbsoluteUrl(normalizeRole(userData?.role), redirectPath)
            });
            // Email sent - log removed for verbosity
              } else {
            // Skip email (no recipient) - log removed for verbosity
          }
        } catch (emailErr) {
          console.warn('📧 [Cron] Email send failed (non-fatal):', emailErr?.message || emailErr);
        }
        
        return { sent: 1 };
            } catch (error) {
        console.error(`❌ [Cron] Error processing form reminder:`, error);
        throw error;
      }
    };

    const results = await processNotificationsConcurrently(remindersToProcess, processorFunction);
    return results;

            } catch (error) {
    console.error('❌ [Cron] Error processing form reminders:', error);
    return { processed: 0, sent: 0, errors: 1 };
  }
}

// Execute scheduled questions that are due (Option A) and mark them completed/ready
async function executeDueProgrammedInstructions(now, oneMinuteFromNow) {
  ensureDbInitialized(); // Lazy check: ensure Firestore is initialized before use
  try {
    const toleranceMs = 2 * 60 * 1000; // 2 minutes tolerance
    const windowStart = new Date(now.getTime() - toleranceMs);
    const windowEnd = new Date(now.getTime() + toleranceMs);

    // Query by nextExecution (recurring)
    const nextQuerySnap = await db.collection('scheduledQuestions')
      .where('status', '==', 'pending')
      .where('nextExecution', '>=', Timestamp.fromDate(windowStart))
      .where('nextExecution', '<=', Timestamp.fromDate(windowEnd))
      .get();

    // Query first-execution where nextExecution is null, use scheduledAt
    const firstQuerySnap = await db.collection('scheduledQuestions')
      .where('status', '==', 'pending')
      .where('scheduledAt', '>=', Timestamp.fromDate(windowStart))
      .where('scheduledAt', '<=', Timestamp.fromDate(windowEnd))
      .get();

    // Execute window - log removed for verbosity

    const docsMap = new Map();
    nextQuerySnap.docs.forEach(d => docsMap.set(d.id, d));
    firstQuerySnap.docs.forEach(d => docsMap.set(d.id, d));
    const toExecute = Array.from(docsMap.values());

    if (toExecute.length === 0) {
      // No pending instructions - log removed for verbosity
      return;
    }

    // Found pending instructions - detailed log removed for verbosity
    if (toExecute.length > 0) {
      console.log(`🤖 [Cron] Executing ${toExecute.length} pending instructions`);
    }
    for (const docRef of toExecute) {
      try {
        const q = docRef.data() || {};
        
        // Get user data to get agencyId
        const userDoc = await db.collection('users').doc(q.userId).get();
        if (!userDoc.exists) {
          console.warn(`🤖 [Cron] User ${q.userId} not found, skipping instruction ${docRef.id}`);
          continue;
        }
        const userData = userDoc.data();
        if (!userData.agencyId) {
          console.warn(`🤖 [Cron] User ${q.userId} has no agencyId, skipping instruction ${docRef.id}`);
          continue;
        }

        // Executing instruction - detailed log removed for verbosity

        // Call the shared AI execution function directly
        const start = Date.now();
        const result = await executeAIQuestion({
          userId: q.userId,
          agencyId: userData.agencyId,
          question: q.question,
          filters: q.filters || {},
          selectedFormats: q.selectedFormIds || q.selectedFormats || [],
          responseFormat: q.selectedFormat || 'text',
          selectedResponseFormats: q.selectedFormats || []
        });
        const elapsed = Date.now() - start;
        const tokensUsed = result.tokensUsed || 0;

        // Persist response subdocument
        const userTokensCharged = Math.ceil((tokensUsed * 2.5) / 100);
        const responseData = {
          scheduledQuestionId: docRef.id,
          response: result.answer || 'Aucune réponse générée',
          executedAt: new Date(),
          responseTime: elapsed,
          tokensUsed: userTokensCharged, // Store user tokens charged, not raw OpenAI tokens
          status: 'success',
          meta: {
            period: q.filters?.period || result.meta?.period,
            usedEntries: result.meta?.usedEntries || 0,
            forms: result.meta?.forms || 0,
            users: result.meta?.users || 0,
            model: result.meta?.model || 'gpt-4.1',
            selectedFormat: q.selectedFormat || result.meta?.selectedFormat,
            selectedFormats: q.selectedFormats || result.meta?.selectedFormats || [],
            selectedFormIds: q.selectedFormIds || result.meta?.selectedFormIds || [],
            selectedFormTitles: result.meta?.selectedFormTitles || []
          }
        };
        const respRef = await db.collection('scheduledQuestions').doc(docRef.id).collection('responses').add(responseData);

        // Deduct tokens (convert OpenAI tokens to user tokens: (tokensUsed * 2.5) / 100)
        try {
          if (tokensUsed > 0 && q.userId) {
            const userTokensCharged = Math.ceil((tokensUsed * 2.5) / 100);
            console.log('💰 [Cron] Deducting tokens:', { 
              rawTokens: tokensUsed, 
              userTokensCharged,
              userId: q.userId 
            });
            const userRef = db.collection('users').doc(q.userId);
            await userRef.update({ 
              tokensUsedMonthly: admin.firestore.FieldValue.increment(userTokensCharged), 
              updatedAt: admin.firestore.FieldValue.serverTimestamp() 
            });
            console.log('✅ [Cron] Tokens deducted successfully');
          }
        } catch (dedErr) {
          console.warn('🤖 [Cron] Token deduction failed (non-fatal):', dedErr?.message || dedErr);
        }

        // Compute nextExecution for recurring
        let nextStatus = 'completed';
        let nextExecution = null;
        if (q.frequency && q.frequency !== 'once') {
          const next = calculateNextScheduledTime(q.frequency, q.time || (q.scheduledAt?.toDate ? q.scheduledAt.toDate().toTimeString().slice(0,5) : '09:00'), now);
          nextExecution = next;
          nextStatus = 'pending';
        }

        // Update question
        const updateData = {
          status: nextStatus,
          executionCount: (q.executionCount || 0) + 1,
          executedAt: Timestamp.fromDate(new Date()),
          lastEvaluatedAt: Timestamp.fromDate(now),
          nextExecution: nextExecution ? Timestamp.fromDate(nextExecution) : admin.firestore.FieldValue.delete()
        };
        await docRef.ref.update(updateData);
        console.log('🤖 [Cron] Executed instruction and stored response:', { id: docRef.id, responseId: respRef.id, tokensUsed });
      } catch (e) {
        console.warn('🤖 [Cron] Failed to execute instruction (will skip notify this round):', docRef.id, e?.message || e);
        console.warn('🤖 [Cron] Failed instruction context:', {
          id: docRef.id,
          userId: (docRef.data && docRef.data().userId) || '(unknown)',
          scheduledAt: (docRef.data && docRef.data().scheduledAt?.toDate && docRef.data().scheduledAt.toDate().toISOString()) || undefined,
          nextExecution: (docRef.data && docRef.data().nextExecution?.toDate && docRef.data().nextExecution.toDate().toISOString()) || undefined
        });
        try {
          await docRef.ref.update({ status: 'failed', lastEvaluatedAt: Timestamp.fromDate(now) });
          await db.collection('scheduledQuestions').doc(docRef.id).collection('responses').add({
            scheduledQuestionId: docRef.id,
            response: 'Erreur lors de l\'exécution de la question',
            executedAt: new Date(),
            responseTime: 0,
            tokensUsed: 0,
            status: 'error',
            errorMessage: e?.message || 'Erreur inconnue',
            meta: { model: 'error' }
          });
        } catch {}
      }
    }
  } catch (err) {
    console.warn('🤖 [Cron] executeDueProgrammedInstructions encountered an error (non-fatal):', err?.message || err);
  }
}

/**
 * Process metric reminders (director-programmed) - CONCURRENT VERSION
 */
async function processMetricReminders(now, oneMinuteFromNow) {
  ensureDbInitialized(); // Lazy check: ensure Firestore is initialized before use
  try {
    // Guard: auto-bump past-due pending reminders forward to the next schedule
    try {
      const overdueSnap = await db.collection('metricReminders')
        .where('status', '==', 'pending')
        .where('scheduledAt', '<', Timestamp.fromDate(now))
        .limit(100)
        .get();
      if (!overdueSnap.empty) {
        console.log(`⏱️ [Cron] Found ${overdueSnap.size} overdue metric reminders to bump forward`);
        const batch = db.batch();
        overdueSnap.docs.forEach((docRef) => {
          const r = docRef.data();
          const nextAt = calculateNextScheduledTime(r.frequency, r.time, now);
          batch.update(docRef.ref, { scheduledAt: Timestamp.fromDate(nextAt), lastEvaluatedAt: Timestamp.fromDate(now) });
        });
        await batch.commit();
        console.log('⏱️ [Cron] Overdue metric reminders bumped to next schedule');
      }
    } catch (guardErr) {
      console.warn('⏱️ [Cron] Past-due guard failed (non-fatal):', guardErr?.message || guardErr);
    }
    // Step 1: Collect all metric reminders that are due
    const remindersSnapshot = await db.collection('metricReminders')
      .where('status', '==', 'pending')
      .where('scheduledAt', '>=', Timestamp.fromDate(now))
      .where('scheduledAt', '<=', Timestamp.fromDate(oneMinuteFromNow))
      .get();

    const remindersToProcess = remindersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      scheduledAt: doc.data().scheduledAt?.toDate()
    }));

    if (remindersToProcess.length === 0) {
      return { processed: 0, sent: 0, errors: 0 };
    }

    console.log(`📊 [Cron] Found ${remindersToProcess.length} metric reminders to process`);

    // Step 2: Process reminders concurrently
    const transporter = makeEmailTransporter();
    const processorFunction = async (reminder) => {
      try {
        // Validate reminder.id exists
        if (!reminder.id || typeof reminder.id !== 'string' || reminder.id.trim() === '') {
          console.warn(`⏭️ [Cron] Skip metric reminder (invalid or missing id):`, { reminderId: reminder.id, directorId: reminder.directorId });
          return { sent: 0 };
        }

        // Validate directorId exists
        if (!reminder.directorId || typeof reminder.directorId !== 'string' || reminder.directorId.trim() === '') {
          console.warn(`⏭️ [Cron] Skip metric reminder (invalid or missing directorId):`, { reminderId: reminder.id, directorId: reminder.directorId });
          return { sent: 0 };
        }

        // Get user data
        const userDoc = await db.collection('users').doc(reminder.directorId).get();
        const userData = userDoc.data();

        if (!userData) {
          console.warn(`⏭️ [Cron] Skip metric reminder (user not found):`, { reminderId: reminder.id, directorId: reminder.directorId });
          return { sent: 0 };
        }

        // Store notification in Firestore with idempotent key
        const scheduledIso = (reminder.scheduledAt instanceof Date ? reminder.scheduledAt : (reminder.scheduledAt?.toDate ? reminder.scheduledAt.toDate() : now)).toISOString();
        const idempotencyKey = `metric:${reminder.id}:scheduled:${scheduledIso}`;
        const metricLabel = reminder.metricName || 'Métrique';
        const redirectPath = `/directeur/dashboards/${reminder.dashboardId || ''}${reminder.metricId ? `?metricId=${encodeURIComponent(reminder.metricId)}` : ''}`;
        const notificationDoc = {
          title: `Votre métrique est prête`,
          body: `Votre métrique "${metricLabel}" est prête. Cliquez pour analyser`,
          type: 'metric_reminder',
          recipientId: reminder.directorId,
          recipientRole: 'directeur',
          agencyId: userData?.agencyId || 'unknown',
          data: {
            dashboardId: reminder.dashboardId || '',
            metricId: reminder.metricId || '',
            frequency: reminder.frequency || 'daily',
            metricName: metricLabel,
            lastValue: reminder.lastValue || 'N/A',
            redirectPath,
            timestamp: now.getTime().toString()
          },
          redirectUrl: redirectPath,
          read: false,
          status: 'sent',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          emailAddress: userData?.email,
          idempotencyKey
        };

        const docId = `metric_reminder:${reminder.id}:${scheduledIso}`;
        await db.collection('notifications').doc(docId).set(notificationDoc, { merge: true });
        
        // For recurring reminders, update scheduledAt instead of marking as sent
        const nextScheduledAt = calculateNextScheduledTime(reminder.frequency, reminder.time, now);
        await db.collection('metricReminders').doc(reminder.id).update({
          scheduledAt: Timestamp.fromDate(nextScheduledAt),
          sentAt: Timestamp.fromDate(now),
          lastEvaluatedAt: Timestamp.fromDate(now)
        });
        
        console.log(`📊 [Cron] Metric reminder stored: ${metricLabel} to director ${reminder.directorId}`);

        // Attempt email delivery (non-fatal)
        try {
          if (userData?.email) {
            const subject = `Votre métrique est prête`;
            const abs = buildAbsoluteUrl('directeur', redirectPath);
            const html = renderEmailTemplate({
              title: 'Votre métrique est prête',
              body: `Votre métrique <strong>${metricLabel}</strong> est prête.`,
              ctaLabel: 'Cliquez pour analyser',
              ctaHref: abs,
            });
            await transporter?.sendMail({
              from: (process.env.EMAIL_FROM && process.env.EMAIL_FROM_NAME) ? `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>` : undefined,
              to: userData.email,
              subject,
              html,
              text: html.replace(/<[^>]*>/g, '')
            });
            console.log('📧 [Cron] Metric reminder email sent to', userData.email);
          } else {
            console.log('📧 [Cron] Skip metric email (no recipient) for user', reminder.directorId);
          }
        } catch (emailErr) {
          console.warn('📧 [Cron] Metric email send failed (non-fatal):', emailErr?.message || emailErr);
        }
        
        return { sent: 1 };
      } catch (error) {
        console.error(`❌ [Cron] Error processing metric reminder:`, error);
        throw error;
      }
    };

    const results = await processNotificationsConcurrently(remindersToProcess, processorFunction);
    return results;

  } catch (error) {
    console.error('❌ [Cron] Error processing metric reminders:', error);
    return { processed: 0, sent: 0, errors: 1 };
  }
}

/**
 * Process programmed instructions (when executed) - CONCURRENT VERSION
 */
async function processProgrammedInstructions(now, oneMinuteFromNow) {
  ensureDbInitialized(); // Lazy check: ensure Firestore is initialized before use
  try {
    // Step 1: Collect all scheduled questions that are READY to notify
    // Option B: Execution is handled elsewhere and marks status to 'ready' or 'completed'
    const questionsSnapshot = await db.collection('scheduledQuestions')
      .where('status', 'in', ['ready', 'completed'])
      .where('scheduledAt', '<=', Timestamp.fromDate(oneMinuteFromNow))
      .get();

    const questionsToProcess = questionsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      scheduledAt: doc.data().scheduledAt?.toDate()
    }));

    if (questionsToProcess.length === 0) {
      return { processed: 0, sent: 0, errors: 0 };
    }

    console.log(`🤖 [Cron] Found ${questionsToProcess.length} programmed instructions to process`);

    // Step 2: Process questions concurrently
    const processorFunction = async (question) => {
      try {
        // Get user data
        const userDoc = await db.collection('users').doc(question.userId).get();
        const userData = userDoc.data();

        if (!userData) {
          throw new Error(`User ${question.userId} not found`);
        }

        // Store notification in Firestore with idempotent key
        const baseDate = (question.scheduledAt instanceof Date ? question.scheduledAt : (question.scheduledAt?.toDate ? question.scheduledAt.toDate() : now));
        const scheduledIso = baseDate.toISOString();
        const idempotencyKey = `programmed_instruction:${question.id}:${scheduledIso}`;
        const redirectPath = `/directeur/scheduled-questions/${question.id}/chat`;
        const notificationDoc = {
          title: `Votre instruction est prête`,
          body: `La réponse pour votre instruction "${question.title || 'Instruction'}" est prête. Cliquez pour voir`,
          type: 'programmed_instruction',
          recipientId: question.userId,
          recipientRole: 'directeur',
          agencyId: userData?.agencyId || 'unknown',
          data: {
            scheduledQuestionId: question.id,
            questionTitle: question.title,
            instructionTitle: question.title,
            redirectPath,
            timestamp: now.getTime().toString()
          },
          redirectUrl: redirectPath,
          read: false,
          status: 'sent',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          emailAddress: userData?.email,
          idempotencyKey
        };

        const docId = `programmed_instruction:${question.id}:${scheduledIso}`;
        await db.collection('notifications').doc(docId).set(notificationDoc, { merge: true });
        
        console.log(`🤖 [Cron] Programmed instruction notification stored: ${question.title} to director ${question.userId}`);

        // Send email using unified template
        try {
          if (userData?.email) {
            const subject = 'Votre instruction est prête';
            const abs = buildAbsoluteUrl('directeur', redirectPath);
            const html = renderEmailTemplate({
              title: 'Votre instruction est prête',
              body: `La réponse pour votre instruction <strong>${question.title || 'Instruction'}</strong> est prête.`,
              ctaLabel: 'Voir la conversation',
              ctaHref: abs,
            });
            await makeEmailTransporter()?.sendMail({
              from: (process.env.EMAIL_FROM && process.env.EMAIL_FROM_NAME) ? `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>` : undefined,
              to: userData.email,
              subject,
              html,
              text: html.replace(/<[^>]*>/g, '')
            });
            console.log('📧 [Cron] Programmed instruction email sent to', userData.email);
          } else {
            console.log('📧 [Cron] Skip programmed instruction email (no recipient) for user', question.userId);
          }
        } catch (emailErr) {
          console.warn('📧 [Cron] Programmed instruction email failed (non-fatal):', emailErr?.message || emailErr);
        }
        
        return { sent: 1 };
      } catch (error) {
        console.error(`❌ [Cron] Error processing programmed instruction:`, error);
        throw error;
      }
    };

    const results = await processNotificationsConcurrently(questionsToProcess, processorFunction);
    return results;

  } catch (error) {
    console.error('❌ [Cron] Error processing programmed instructions:', error);
    return { processed: 0, sent: 0, errors: 1 };
  }
}

/**
 * Calculate next scheduled time for recurring metric reminders
 */
function calculateNextScheduledTime(frequency, time, fromDate) {
  const now = fromDate || new Date();
  const [hours, minutes] = time.split(':').map(Number);
  
  // Create today's scheduled time
  const nextScheduled = new Date(now);
  nextScheduled.setHours(hours, minutes, 0, 0);
  
  // If today's time has passed, schedule for next occurrence
  if (nextScheduled <= now) {
    switch (frequency) {
      case 'daily':
        nextScheduled.setDate(nextScheduled.getDate() + 1);
        break;
      case 'weekly':
        nextScheduled.setDate(nextScheduled.getDate() + 7);
        break;
      case 'monthly':
        nextScheduled.setMonth(nextScheduled.getMonth() + 1);
        break;
    }
  }
  
  return nextScheduled;
}

/**
 * Process subscription renewals
 * Checks for active sessions with nextRenewalDate <= now and renews them automatically
 */
async function processSubscriptionRenewals(now) {
  ensureDbInitialized();
  try {
    const stats = {
      processed: 0,
      renewed: 0,
      errors: 0
    };

    // Query active sessions with autoRenew enabled and nextRenewalDate <= now
    const sessionsSnapshot = await db.collection('subscriptionSessions')
      .where('isActive', '==', true)
      .where('autoRenew', '==', true)
      .get();

    stats.processed = sessionsSnapshot.size;
    // Found active sessions to check - log removed for verbosity

    for (const docSnapshot of sessionsSnapshot.docs) {
      try {
        const sessionData = docSnapshot.data();
        const sessionId = docSnapshot.id;
        const userId = sessionData.userId;

        // Convert Firestore Timestamp to Date
        const nextRenewalDate = sessionData.nextRenewalDate?.toDate ? sessionData.nextRenewalDate.toDate() : new Date(sessionData.nextRenewalDate);
        const endDate = sessionData.endDate?.toDate ? sessionData.endDate.toDate() : new Date(sessionData.endDate);
        const renewalCount = sessionData.renewalCount || 0;
        const maxRenewals = sessionData.maxRenewals || 0;

        // Check if renewal is due
        if (nextRenewalDate > now) {
          continue; // Not due yet
        }

        // Check if max renewals reached
        if (renewalCount >= maxRenewals) {
          console.log(`⏭️ [Cron] Session ${sessionId} has reached max renewals (${renewalCount}/${maxRenewals})`);
          continue;
        }

        // Check if total period has ended
        if (endDate <= now) {
          console.log(`⏭️ [Cron] Session ${sessionId} has reached end date`);
          continue;
        }

        // Perform renewal: update renewal count and next renewal date
        const newRenewalCount = renewalCount + 1;
        const nextRenewal = new Date(now);
        nextRenewal.setDate(nextRenewal.getDate() + 30); // 30 days from now

        await docSnapshot.ref.update({
          renewalCount: newRenewalCount,
          nextRenewalDate: Timestamp.fromDate(nextRenewal),
          updatedAt: Timestamp.fromDate(now)
        });

        stats.renewed++;
        console.log(`✅ [Cron] Session ${sessionId} renewed successfully (${newRenewalCount}/${maxRenewals})`);

      } catch (error) {
        stats.errors++;
        console.error(`❌ [Cron] Error processing session ${docSnapshot.id}:`, error);
      }
    }

    console.log(`✅ [Cron] Subscription renewals completed: ${stats.renewed} renewed, ${stats.errors} errors`);
    return stats;

  } catch (error) {
    console.error('❌ [Cron] Error processing subscription renewals:', error);
    return { processed: 0, renewed: 0, errors: 1 };
  }
}

/**
 * Handle expired subscriptions
 * Detects expired sessions and creates a default free session
 */
async function handleExpiredSubscriptions(now) {
  ensureDbInitialized();
  try {
    const stats = {
      processed: 0,
      expired: 0,
      errors: 0
    };

    // Query active sessions that have expired
    const sessionsSnapshot = await db.collection('subscriptionSessions')
      .where('isActive', '==', true)
      .get();

    stats.processed = sessionsSnapshot.size;
    console.log(`⏰ [Cron] Checking ${stats.processed} active sessions for expiration`);

    for (const docSnapshot of sessionsSnapshot.docs) {
      try {
        const sessionData = docSnapshot.data();
        const sessionId = docSnapshot.id;
        const userId = sessionData.userId;
        const packageType = sessionData.packageType;

        // Skip free packages
        if (packageType === 'free') {
          continue;
        }

        // Convert Firestore Timestamp to Date
        const endDate = sessionData.endDate?.toDate ? sessionData.endDate.toDate() : new Date(sessionData.endDate);
        const renewalCount = sessionData.renewalCount || 0;
        const maxRenewals = sessionData.maxRenewals || 0;

        // Check if subscription has expired
        // Expired if: endDate passed OR maxRenewals reached
        const isExpired = endDate <= now || renewalCount >= maxRenewals;

        if (!isExpired) {
          continue; // Not expired yet
        }

        // Get user data for notification
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.exists ? userDoc.data() : null;

        // Deactivate expired session
        await docSnapshot.ref.update({
          isActive: false,
          updatedAt: Timestamp.fromDate(now)
        });

        // Create free default session
        const freeSessionData = {
          userId: userId,
          packageType: 'free',
          subscriptionPeriod: '30days',
          totalPeriodDays: 30,
          renewalIntervalDays: 30,
          sessionType: 'downgrade',
          startDate: Timestamp.fromDate(now),
          endDate: Timestamp.fromDate(new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)),
          nextRenewalDate: Timestamp.fromDate(new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)),
          amountPaid: 0,
          monthlyAmount: 0,
          discountApplied: 0,
          paymentId: 'N/A_FREE',
          durationDays: 30,
          isActive: true,
          autoRenew: false,
          renewalCount: 0,
          maxRenewals: 0,
          packageResources: {
            tokensIncluded: 0,
            formsIncluded: 0,
            dashboardsIncluded: 0,
            usersIncluded: 0
          },
          payAsYouGoResources: {
            tokens: 0,
            forms: 0,
            dashboards: 0,
            users: 0,
            purchases: []
          },
          usage: {
            tokensUsed: 0,
            formsCreated: 0,
            dashboardsCreated: 0,
            usersAdded: 0
          },
          createdAt: Timestamp.fromDate(now),
          updatedAt: Timestamp.fromDate(now)
        };

        // Deactivate any existing active session for this user
        const activeSessionsQuery = await db.collection('subscriptionSessions')
          .where('userId', '==', userId)
          .where('isActive', '==', true)
          .get();
        
        const batch = db.batch();
        activeSessionsQuery.docs.forEach(doc => {
          batch.update(doc.ref, { isActive: false, updatedAt: Timestamp.fromDate(now) });
        });

        // Add the new free session
        const newSessionRef = db.collection('subscriptionSessions').doc();
        const newSessionId = newSessionRef.id;
        batch.set(newSessionRef, freeSessionData);

        // Update user document to reference the new active session
        if (userDoc.exists) {
          batch.update(userDoc.ref, {
            currentSubscriptionSessionId: newSessionId,
            needsPackageSelection: false,
            updatedAt: Timestamp.fromDate(now)
          });
        }

        await batch.commit();

        // Create expiration notification
        if (userData) {
          const notificationDoc = {
            title: 'Votre abonnement a expiré',
            body: 'Votre abonnement a expiré. Vous êtes maintenant sur le package gratuit. Vous pouvez renouveler votre abonnement à tout moment.',
            type: 'subscription_expired',
            recipientId: userId,
            recipientRole: 'directeur',
            agencyId: userData.agencyId || 'unknown',
            data: {
              action: 'upgrade_subscription',
              packageType: 'free',
              timestamp: now.getTime().toString()
            },
            redirectUrl: '/directeur/packages',
            read: false,
            status: 'sent',
            createdAt: Timestamp.fromDate(now),
            sentAt: Timestamp.fromDate(now),
            emailAddress: userData.email,
            idempotencyKey: `subscription_expired:${sessionId}:${now.toISOString()}`
          };

          const notificationId = `subscription_expired:${sessionId}:${now.toISOString()}`;
          await db.collection('notifications').doc(notificationId).set(notificationDoc, { merge: true });
          console.log(`📧 [Cron] Expiration notification created for user ${userId}`);
        }

        stats.expired++;
        console.log(`✅ [Cron] Session ${sessionId} expired, free session created: ${newSessionId}`);

      } catch (error) {
        stats.errors++;
        console.error(`❌ [Cron] Error processing session ${docSnapshot.id}:`, error);
      }
    }

    console.log(`✅ [Cron] Expired subscriptions handled: ${stats.expired} expired, ${stats.errors} errors`);
    return stats;

  } catch (error) {
    console.error('❌ [Cron] Error handling expired subscriptions:', error);
    return { processed: 0, expired: 0, errors: 1 };
  }
}

/**
 * Get all upcoming notification times for smart interval calculation
 * This queries forms, metric reminders, and scheduled questions to find the next due time
 */
export async function getNextNotificationTime() {
  try {
    const now = new Date();
    const upcomingTimes = [];

    // 1. Get upcoming form reminder times based on timeRestrictions
    const formsSnapshot = await db.collectionGroup('forms').get();

    for (const formDoc of formsSnapshot.docs) {
      const form = formDoc.data();
      const assignedTo = Array.isArray(form.assignedTo) ? form.assignedTo : [];
      const timeRestrictions = form.timeRestrictions || {};
      const allowedDays = Array.isArray(timeRestrictions.allowedDays) ? timeRestrictions.allowedDays : [];
      const endTime = timeRestrictions.endTime;
      if (assignedTo.length === 0 || !endTime) continue;

      const todayNum = getAfricaDoualaWeekdayNumber(now);
      const isAllowedToday = Array.isArray(allowedDays) && allowedDays.length > 0 && allowedDays.includes(todayNum);
      if (!isAllowedToday) continue;

      const deadlineDate = buildTodayDueAtAfricaDouala(endTime);
      if (!deadlineDate) continue;
      const reminderIntervals = [60, 30, 15, 5]; // minutes before deadline

      for (const intervalMinutes of reminderIntervals) {
        const reminderTime = new Date(deadlineDate.getTime() - intervalMinutes * 60 * 1000);
        if (reminderTime > now) {
          upcomingTimes.push(reminderTime);
        }
      }
    }

    // 2. Get upcoming metric reminder times
    const metricRemindersSnapshot = await db.collection('metricReminders')
      .where('status', '==', 'pending')
      .get();

    for (const reminderDoc of metricRemindersSnapshot.docs) {
      const reminder = reminderDoc.data();
      const scheduledAt = reminder.scheduledAt?.toDate ? reminder.scheduledAt.toDate() : reminder.scheduledAt;
      if (scheduledAt && scheduledAt > now) {
        upcomingTimes.push(scheduledAt);
      }
    }

    // 3. Get upcoming scheduled question times
    const questionsSnapshot = await db.collection('scheduledQuestions')
      .where('status', '==', 'pending')
      .get();

    for (const questionDoc of questionsSnapshot.docs) {
      const question = questionDoc.data();
      const scheduledAt = question.scheduledAt?.toDate ? question.scheduledAt.toDate() : question.scheduledAt;
      if (scheduledAt && scheduledAt > now) {
        upcomingTimes.push(scheduledAt);
      }
    }

    // Find the earliest upcoming time
    if (upcomingTimes.length === 0) {
      return null;
    }

    const nextTime = new Date(Math.min(...upcomingTimes.map(t => t.getTime())));
    return nextTime;
  } catch (error) {
    console.error('❌ [Cron] Error getting next notification time:', error);
    return null;
  }
}

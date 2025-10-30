import admin from 'firebase-admin';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';
import { buildAbsoluteUrl, renderEmailTemplate } from '../lib/urlEmail.js';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  console.log('🔧 Initializing Firebase Admin SDK...');
  
  // Use environment variables instead of hardcoded values
  const serviceAccount = {
    type: "service_account",
    project_id: process.env.FIREBASE_PROJECT_ID || "studio-gpnfx",
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || "49cf718bd7049b5fcc3e2e6fbc583ebcec3b373d",
    private_key: process.env.FIREBASE_PRIVATE_KEY || "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDNUG4k1NBeeCb8\nZ5+S5SAJujgqP85D12CkQqbeP44r9oP3ZyfVZgAuz0YFF0so//kgsn6vaJEqk+vy\nJux5Lb+0QNfsQrTMYkKbQP+pc8KX9VRTz1PUa47h5MgemSMdp/eTaqhdsO6dKbIe\n5Nu0UjlYHXBJ9uPOYzOVZ+Sv0hMuPYyucLHrTiqwG91aCGXNETWORKKwSW9Ojipghr4KKG\nqSlUIzt5d20nLPOWz7d9pNac4gLVw0VlZk02ep+xclRnkjDc+qWKbcgr90/Zx4Cx\n+aSIx6d4ClickedVBaa8cWrAUoE2IUJ/yFk0joMoxN+Iz7gzDwuKbx4eAMyR4SSIRU42J\nXW4dTMIFAgMBAAECggEAVd+FIgyM1mZkz/87ZAJHYyorIaisSf3EYw+poZ1thn/F\n9G2F4KCYBPwWqjxy6EQf3AgsKouO5AMYlaCoGYsD+o2AgkXoPu/+Mdd+104entYy\nnhdCVb9i9KJu/TVJ1baSO2tJ3l4Jf1yYLonERuh5KZyugZEs+P7O7XeV0+dsis\nlZGj5AZhEFpwOBUNU5m9SGDqliq5X1iFhoBmFZ+V6QKUHyq/gWqUDx6baBLjGUdd\nWRjJHAVzY1Xjf0jHWs8RvkzMCskolzV5K0IP79REHTDjefeN4CuURy1KcxFHl3jR\nP7OZj2fgEz0gqAAganIDFI1D6onN4IB7Bk4NtB/gJQKBgQDyC55AYsYYvM7SMc/n\nPJ28lY4Vd5NSyQLf3BgkcpBFRcl8fqEQNaP+F53qa7bLCJJTWkglpur6B2LixlfW\nCkxUIzl4gGOeUQqp3/KzKHTPAAi3t6vAxLajZlugl7uLOBjY+UWkGu/yK+ekaQM9\nCkM8hA/ME2f0dPyF2nDo/XNeiwKBgQDZJrDrnrgevQjq0c0sTGPOnAMLgAStRHvu\nqeBGwEq1MdXFYeLqPhBDHnG1pdxftPXvD1QdfEeP/V+wV3kIx+sHGJl/39Qabg38\nJJDa0EDglKnT32R7A4IM3EcbdTjLA3yVSYNvpxyVi4LC+QFfexkxre/Oe3ItMATs\nVJfjFeqDrwKBgDNiZgkzLuzngFy9OG7VvoLfmRdTmFIV3 terapia db2UA7lgcuxpSIaXcA\nfD0gFGVE0ryNqErLus9LfU corpsxLnwIMXN+IjAmfjfnwb5FZCcmJOcF6q5bSn5+HpdA\n66kKvN7991GZ6iR93tv03/1H7AhKRua5fAan3pardAFAqK9d7WR5Efn7AoGAIGUu\nRahjDWrkFqv/8Njglt8lySRrDjJGTt+W7tcnDgsGOjEVOh7SLEExdLp2uuxzOBvQ\nT6nHv0psaRFTpCS3AlMAK1yH9v1uJqyJ06r30sk64LnV8qgeUa7XCNifBWJaxqa1\n7gU/NWwfsNiXBNiHdKrfOK2f5e/g/CTOl/kgCE8CgYBo9fOsnIwlHikxgqpwq+j/\ngiFQUXcDeds6ke2FVu4Bw+jmw5WiDOYz9nUIRVfQQBYCZq/wuGg336xtvRd6bagl\nhEwBb1Bxs0PXOb9OJXfeN0t+i4QHTN+2Yt4fddvksO7kJeNbWCFmho+ebaKBsfey\nkW7wgMnKrF694aVMXaToiw==\n-----END PRIVATE KEY-----\n",
    client_email: process.env.FIREBASE_CLIENT_EMAIL || "firebase-adminsdk-fbsvc@studio-gpnfx.iam.gserviceaccount.com",
    client_id: process.env.FIREBASE_CLIENT_ID || "113149690446202662127",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40studio-gpnfx.iam.gserviceaccount.com",
    universe_domain: "googleapis.com"
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID || "studio-gpnfx"
  });
}

const db = getFirestore();
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

  console.log(`🔄 [Cron] Processing ${notifications.length} notifications in ${batches.length} batches`);

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    console.log(`📦 [Cron] Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} items)`);

    const batchPromises = batch.map(async (notification, itemIndex) => {
      try {
        const result = await processorFunction(notification);
        results.processed++;
        results.sent += result.sent || 0;
        console.log(`✅ [Cron] Batch ${batchIndex + 1}, Item ${itemIndex + 1}: Processed successfully`);
        return result;
      } catch (error) {
        results.errors++;
        results.errorDetails.push({ 
          notification: notification.id || 'unknown', 
          error: error.message,
          batch: batchIndex + 1,
          item: itemIndex + 1
        });
        console.error(`❌ [Cron] Batch ${batchIndex + 1}, Item ${itemIndex + 1}: Error -`, error.message);
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

  console.log(`📊 [Cron] Batch processing completed: ${results.processed} processed, ${results.sent} sent, ${results.errors} errors`);
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
    console.log('🔄 [Cron] Starting unified notification cron job...');
    
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    const oneMinuteFromNow = new Date(now.getTime() + 60 * 1000);
    
    // Log timezone info for debugging
    console.log('⏰ [Cron] Timezone Debug Info:', {
      serverTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      serverOffset: now.getTimezoneOffset() / -60, // Convert to hours (UTC offset)
      nowUTC: now.toISOString(),
      nowLocal: now.toString(),
      nowUTCString: now.toUTCString(),
      oneMinuteFromNowUTC: oneMinuteFromNow.toISOString(),
      oneMinuteFromNowLocal: oneMinuteFromNow.toString()
    });
    
    let processedCount = 0;
    let sentCount = 0;
    let errorCount = 0;

    // 1. Process form reminders (1h, 30min, 15min, 5min before deadline)
    console.log('📅 [Cron] Processing form reminders...');
    const formReminders = await processFormReminders(now, oneMinuteFromNow);
    processedCount += formReminders.processed;
    sentCount += formReminders.sent;
    errorCount += formReminders.errors;

    // 2. Process metric reminders (director-programmed)
    console.log('📊 [Cron] Processing metric reminders...');
    const metricReminders = await processMetricReminders(now, oneMinuteFromNow);
    processedCount += metricReminders.processed;
    sentCount += metricReminders.sent;
    errorCount += metricReminders.errors;

    // 3. Execute due programmed instructions, then notify for ready/completed
    console.log('🤖 [Cron] Executing due programmed instructions...');
    await executeDueProgrammedInstructions(now, oneMinuteFromNow);
    console.log('🤖 [Cron] Processing programmed instructions...');
    const instructionReminders = await processProgrammedInstructions(now, oneMinuteFromNow);
    processedCount += instructionReminders.processed;
    sentCount += instructionReminders.sent;
    errorCount += instructionReminders.errors;

    console.log(`✅ [Cron] Unified notification cron job completed: ${processedCount} processed, ${sentCount} sent, ${errorCount} errors`);

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
  try {
    // Step 1: Collect all form reminders that need to be sent
    // Use collection group to support nested form collections
    const formsSnapshot = await db.collectionGroup('forms').get();

    const remindersToProcess = [];

    console.log(`📅 [Cron] Found ${formsSnapshot.docs.length} forms with deadlines to check`);
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
      console.log('🧾 [Cron] Forms deadline preview (first 5):', preview);
    }

    for (const formDoc of formsSnapshot.docs) {
      const form = { id: formDoc.id, ...formDoc.data() };
      
      const assignedTo = Array.isArray(form.assignedTo) ? form.assignedTo : [];
      const timeRestrictions = form.timeRestrictions || {};
      const allowedDays = Array.isArray(timeRestrictions.allowedDays) ? timeRestrictions.allowedDays : [];
      const endTime = timeRestrictions.endTime;

      if (assignedTo.length === 0) {
        console.log('⏭️ [Cron] Skip form (no assigned users):', { formId: form.id, title: form.title, path: formDoc.ref.path });
        continue;
      }
      if (!endTime) {
        console.log('⏭️ [Cron] Skip form (missing endTime):', { formId: form.id, title: form.title, path: formDoc.ref.path });
        continue;
      }

      // Check today's weekday is allowed (numeric 0–6 only). Empty means "no reminders".
      const todayNum = getAfricaDoualaWeekdayNumber(now);
      const isAllowedToday = Array.isArray(allowedDays) && allowedDays.length > 0 && allowedDays.includes(todayNum);
      if (!isAllowedToday) {
        console.log('⏭️ [Cron] Skip form (today not allowed):', { formId: form.id, title: form.title, path: formDoc.ref.path, todayNum, allowedDays });
        continue;
      }

      // Build today's deadline from endTime (Africa/Douala)
      const deadlineDate = buildTodayDueAtAfricaDouala(endTime);
      if (!deadlineDate) continue;
      const reminderIntervals = [60, 30, 15, 5]; // minutes before deadline

      console.log(`📅 [Cron] Processing form "${form.title || '(no title)'}" (${form.id}):`, {
        mode: 'timeRestrictions',
        endTime: endTime,
        deadlineDateLocal: deadlineDate.toString(),
        deadlineDateUTC: deadlineDate.toISOString(),
        deadlineDateUTCString: deadlineDate.toUTCString(),
        allowedDays,
        assignedUsers: assignedTo.length,
        timezoneInfo: {
          parsedAs: 'Interpreted in server timezone',
          serverTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      });

      // Extra: show all expected reminder timestamps for this form
      const allExpectedReminders = reminderIntervals.map((intervalMinutes) => {
        const rt = new Date(deadlineDate.getTime() - intervalMinutes * 60 * 1000);
        return {
          interval: `${intervalMinutes}min`,
          reminderTimeUTC: rt.toISOString(),
          reminderTimeLocal: rt.toString(),
          // Membership against current strict window used by the cron
          inCurrentWindow: rt >= now && rt <= oneMinuteFromNow,
          diffFromNowMin: (rt.getTime() - now.getTime()) / (60 * 1000),
        };
      });
      console.log('🧭 [Cron] Expected reminder times for form:', {
        formId: form.id,
        title: form.title,
        reminders: allExpectedReminders,
        windowNowUTC: now.toISOString(),
        windowEndUTC: oneMinuteFromNow.toISOString(),
      });

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
          if (shouldSend || intervalMinutes === 5) { // Log 5min reminder checks even if not due
            console.log(`📅 [Cron] Reminder check for form "${form.title}":`, {
              intervalMinutes: `${intervalMinutes}min`,
              deadlineUTC: deadlineDate.toISOString(),
              reminderTimeUTC: reminderTime.toISOString(),
              reminderTimeLocal: reminderTime.toString(),
              windowStartUTC: windowStart.toISOString(),
              windowEndUTC: windowEnd.toISOString(),
              timeDiffMinutes: (reminderTime.getTime() - now.getTime()) / (60 * 1000),
              shouldSend: shouldSend,
              check: `reminderTime (${reminderTime.toISOString()}) ∈ [${windowStart.toISOString()} , ${windowEnd.toISOString()}]`,
              toleranceWindow: {
                startUTC: windowStartTolerance.toISOString(),
                endUTC: windowEndTolerance.toISOString(),
                inTolerance: reminderTime >= windowStartTolerance && reminderTime <= windowEndTolerance,
              }
            });
          }
          
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

    console.log(`📅 [Cron] Reminder collection complete. Total reminders to check: ${remindersToProcess.length}`);
    
    if (remindersToProcess.length === 0) {
      console.log('📅 [Cron] No form reminders due at this time. Window checked:', {
        nowUTC: now.toISOString(),
        nowLocal: now.toString(),
        oneMinuteFromNowUTC: oneMinuteFromNow.toISOString(),
        oneMinuteFromNowLocal: oneMinuteFromNow.toString()
      });
      console.log('🧪 [Cron] Hint: If expected reminders are just outside this window, consider widening the check to include a small past tolerance (e.g., now-1min to now+1min) when running every 2 minutes.');
      return { processed: 0, sent: 0, errors: 0 };
    }

    console.log(`📅 [Cron] Found ${remindersToProcess.length} form reminders to process`);

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
        console.log(`📅 [Cron] Form reminder stored in Firestore:`, {
          notificationId: docId,
          formTitle: form.title,
          formId: form.id,
          intervalMinutes: `${intervalMinutes}min`,
          userId: userId,
          recipientRole: normalizeRole(userData?.role),
          agencyId: userData?.agencyId || 'unknown',
          emailAddress: userData?.email || 'none',
          notificationData: notificationDoc,
          idempotencyKey
        });
        // Attempt email delivery (non-fatal)
        try {
          if (userData?.email) {
            await sendReminderEmail(transporter, {
              to: userData.email,
              formTitle: form.title,
              intervalMinutes,
              redirectUrl: buildAbsoluteUrl(normalizeRole(userData?.role), redirectPath)
            });
            console.log('📧 [Cron] Reminder email sent to', userData.email);
          } else {
            console.log('📧 [Cron] Skip email (no recipient) for user', userId);
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
  try {
    const pendingSnap = await db.collection('scheduledQuestions')
      .where('status', '==', 'pending')
      .where('scheduledAt', '>=', Timestamp.fromDate(new Date(now.getTime() - 60 * 1000)))
      .where('scheduledAt', '<=', Timestamp.fromDate(oneMinuteFromNow))
      .get();

    if (pendingSnap.empty) return;

    console.log(`🤖 [Cron] Found ${pendingSnap.size} pending instructions to execute`);
    for (const docRef of pendingSnap.docs) {
      try {
        const q = docRef.data() || {};
        const baseUrl = process.env.API_BASE_URL || process.env.INTERNAL_API_BASE || 'http://localhost:3000';
        const aiUrl = `${baseUrl}/api/ai/ask`;
        const body = {
          question: q.question,
          filters: q.filters,
          selectedFormats: q.selectedFormIds || q.selectedFormats || [],
          responseFormat: q.selectedFormat || 'text',
          selectedResponseFormats: q.selectedFormats || [],
          conversationId: null,
          userId: q.userId,
          isScheduled: true
        };
        const headers = {
          'Content-Type': 'application/json',
          'x-internal-token': process.env.INTERNAL_API_KEY || ''
        };
        const start = Date.now();
        const resp = await fetch(aiUrl, { method: 'POST', headers, body: JSON.stringify(body) });
        const elapsed = Date.now() - start;
        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`AI ask failed ${resp.status}: ${text}`);
        }
        const result = await resp.json();
        const tokensUsed = result.tokensUsed || result.meta?.tokensUsed || 0;

        // Persist response subdocument
        const responseData = {
          scheduledQuestionId: docRef.id,
          response: result.answer || 'Aucune réponse générée',
          executedAt: new Date(),
          responseTime: elapsed,
          tokensUsed: tokensUsed,
          status: 'success',
          meta: {
            period: q.filters?.period,
            usedEntries: result.meta?.usedEntries || 0,
            forms: result.meta?.forms || 0,
            users: result.meta?.users || 0,
            model: result.meta?.model || 'gpt-4.1',
            selectedFormat: q.selectedFormat,
            selectedFormats: q.selectedFormats || [],
            selectedFormIds: q.selectedFormIds || [],
            selectedFormTitles: result.meta?.selectedFormTitles || []
          }
        };
        const respRef = await db.collection('scheduledQuestions').doc(docRef.id).collection('responses').add(responseData);

        // Deduct tokens
        try {
          if (tokensUsed > 0 && q.userId) {
            const userRef = db.collection('users').doc(q.userId);
            await userRef.update({ tokensUsedMonthly: admin.firestore.FieldValue.increment(tokensUsed), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
          }
        } catch (dedErr) {
          console.warn('🤖 [Cron] Token deduction failed (non-fatal):', dedErr?.message || dedErr);
        }

        // Compute nextExecution for recurring
        let status = 'completed';
        let nextExecution = null;
        if (q.frequency && q.frequency !== 'once') {
          const next = calculateNextScheduledTime(q.frequency, q.time || (q.scheduledAt?.toDate ? q.scheduledAt.toDate().toTimeString().slice(0,5) : '09:00'), now);
          nextExecution = next;
          status = 'pending';
        }

        // Update question
        const updateData = {
          status,
          executionCount: (q.executionCount || 0) + 1,
          executedAt: Timestamp.fromDate(new Date()),
          lastEvaluatedAt: Timestamp.fromDate(now),
          nextExecution: nextExecution ? Timestamp.fromDate(nextExecution) : admin.firestore.FieldValue.delete()
        };
        await docRef.ref.update(updateData);
        console.log('🤖 [Cron] Executed instruction and stored response:', { id: docRef.id, responseId: respRef.id, tokensUsed });
      } catch (e) {
        console.warn('🤖 [Cron] Failed to execute instruction (will skip notify this round):', docRef.id, e?.message || e);
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

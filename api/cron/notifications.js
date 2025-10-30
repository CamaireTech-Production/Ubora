import admin from 'firebase-admin';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

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

    // 3. Process programmed instructions (when executed)
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
    const formsSnapshot = await db.collection('forms')
      .where('deadline', '!=', null)
      .get();

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
      
      if (!form.deadline || !form.assignedTo || form.assignedTo.length === 0) {
        continue;
      }

      // Parse deadline - this is critical for timezone understanding
      const deadlineString = `${form.deadline.date}T${form.deadline.time}`;
      const deadlineDate = parseAfricaDoualaLocalDateTime(form.deadline.date, form.deadline.time);
      const reminderIntervals = [60, 30, 15, 5]; // minutes before deadline
      
      console.log(`📅 [Cron] Processing form "${form.title}" (${form.id}):`, {
        deadlineString: deadlineString,
        deadlineDateLocal: deadlineDate.toString(),
        deadlineDateUTC: deadlineDate.toISOString(),
        deadlineDateUTCString: deadlineDate.toUTCString(),
        assignedUsers: form.assignedTo?.length || 0,
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

      for (const userId of form.assignedTo) {
        for (const intervalMinutes of reminderIntervals) {
          const reminderTime = new Date(deadlineDate.getTime() - intervalMinutes * 60 * 1000);
          
          // Detailed logging for each reminder check
          const shouldSend = reminderTime >= now && reminderTime <= oneMinuteFromNow;
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
              nowUTC: now.toISOString(),
              nowLocal: now.toString(),
              oneMinuteFromNowUTC: oneMinuteFromNow.toISOString(),
              timeDiffMinutes: (reminderTime.getTime() - now.getTime()) / (60 * 1000),
              shouldSend: shouldSend,
              check: `reminderTime (${reminderTime.toISOString()}) >= now (${now.toISOString()}) && <= oneMinuteFromNow (${oneMinuteFromNow.toISOString()})`,
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
              reminderTime
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
    const processorFunction = async (reminderData) => {
      try {
        const { form, userId, intervalMinutes } = reminderData;
        
        // Get user data (do not fail hard if missing)
        let userData = null;
        try {
              const userDoc = await db.collection('users').doc(userId).get();
          userData = userDoc.exists ? userDoc.data() : null;
        } catch (e) {
          console.warn(`⚠️ [Cron] Failed to fetch user ${userId}, proceeding with defaults`);
        }

        // Store notification in Firestore with idempotent key - frontend will handle browser display
        const deadlineIso = deadlineDate.toISOString();
        const idempotencyKey = `form:${form.id}:user:${userId}:reminder:${intervalMinutes}:deadline:${deadlineIso}`;
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
                    redirectUrl: `/forms/${form.id}`,
                    timestamp: now.getTime().toString()
          },
          redirectUrl: `/forms/${form.id}`,
                  read: false,
                  status: 'sent',
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                  sentAt: admin.firestore.FieldValue.serverTimestamp(),
                  emailAddress: userData?.email,
                  idempotencyKey
                };

        const docId = `form_reminder:${form.id}:${userId}:${intervalMinutes}:${deadlineIso}`;
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

/**
 * Process metric reminders (director-programmed) - CONCURRENT VERSION
 */
async function processMetricReminders(now, oneMinuteFromNow) {
  try {
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
    const processorFunction = async (reminder) => {
      try {
        // Get user data
        const userDoc = await db.collection('users').doc(reminder.directorId).get();
        const userData = userDoc.data();

        if (!userData) {
          throw new Error(`User ${reminder.directorId} not found`);
        }

        // Store notification in Firestore with idempotent key
        const scheduledIso = (reminder.scheduledAt instanceof Date ? reminder.scheduledAt : (reminder.scheduledAt?.toDate ? reminder.scheduledAt.toDate() : now)).toISOString();
        const idempotencyKey = `metric:${reminder.id}:scheduled:${scheduledIso}`;
        const notificationDoc = {
          title: `Rappel métrique: ${reminder.metricName || 'Métrique'}`,
          body: `Valeur ${reminder.frequency || 'daily'}: ${reminder.lastValue || 'N/A'}`,
          type: 'metric_reminder',
          recipientId: reminder.directorId,
          recipientRole: 'directeur',
          agencyId: userData?.agencyId || 'unknown',
          data: {
            dashboardId: reminder.dashboardId || '',
            metricId: reminder.metricId || '',
            frequency: reminder.frequency || 'daily',
            metricName: reminder.metricName || 'Métrique',
            lastValue: reminder.lastValue || 'N/A',
            redirectUrl: `/directeur/dashboards/${reminder.dashboardId || ''}`,
            timestamp: now.getTime().toString()
          },
          redirectUrl: `/directeur/dashboards/${reminder.dashboardId || ''}`,
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
        
        console.log(`📊 [Cron] Metric reminder stored: ${reminder.metricName || 'Métrique'} to director ${reminder.directorId}`);
        
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
    // Step 1: Collect all scheduled questions that are due for execution
    const questionsSnapshot = await db.collection('scheduledQuestions')
      .where('status', '==', 'pending')
      .where('scheduledAt', '>=', Timestamp.fromDate(now))
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
        const scheduledIso = (question.scheduledAt instanceof Date ? question.scheduledAt : (question.scheduledAt?.toDate ? question.scheduledAt.toDate() : now)).toISOString();
        const idempotencyKey = `programmed_instruction:${question.id}:${scheduledIso}`;
        const notificationDoc = {
          title: `Instruction programmée exécutée`,
          body: `Votre instruction "${question.title}" a été exécutée avec succès`,
          type: 'programmed_instruction',
          recipientId: question.userId,
          recipientRole: 'directeur',
          agencyId: userData?.agencyId || 'unknown',
          data: {
            scheduledQuestionId: question.id,
            questionTitle: question.title,
            instructionTitle: question.title,
            redirectUrl: `/directeur/scheduled-questions/${question.id}/chat`,
            timestamp: now.getTime().toString()
          },
          redirectUrl: `/directeur/scheduled-questions/${question.id}/chat`,
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

    // 1. Get upcoming form reminder times
    const formsSnapshot = await db.collection('forms')
      .where('deadline', '!=', null)
      .get();

    for (const formDoc of formsSnapshot.docs) {
      const form = formDoc.data();
      if (!form.deadline || !form.assignedTo || form.assignedTo.length === 0) {
        continue;
      }

      const deadlineDate = parseAfricaDoualaLocalDateTime(form.deadline.date, form.deadline.time);
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

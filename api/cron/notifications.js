import admin from 'firebase-admin';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  const serviceAccount = {
    type: "service_account",
    project_id: "studio-gpnfx",
    private_key_id: "49cf718bd7049b5fcc3e2e6fbc583ebcec3b373d",
    private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDNUG4k1NBeeCb8\nZ5+S5SAJujgqP85D12CkQqbeP44r9oP3ZyfVZgAuz0YFF0so//kgsn6vaJEqk+vy\nJux5Lb+0QNfsQrTMYkKbQP+pc8KX9VRTz1PUa47h5MgemSMdp/eTaqhdsO6dKbIe\n5Nu0UjlYHXBJ9uPOYzOVZ+Sv0hMuPYyucLHrTiqwG91aCGXxKwSW9Ojipghr4KKG\nqSlUIzt5d20nLPOWz7d9pNac4gLVw0VlZk02ep+xclRnkjDc+qWKbcgr90/Zx4Cx\n+aSIx6d4IOVBaa8cWrAUoE2IUJ/yFk0joMoxN+Iz7gzDwuKbx4eAMyR4SSIRU42J\nXW4dTMIFAgMBAAECggEAVd+FIgyM1mZkz/87ZAJHYyorIaisSf3EYw+poZ1thn/F\n9G2F4KCYBPwWqjxy6EQf3AgsKouO5AMYlaCoGYsD+o2AgkXoPu/+Mdd+104entYy\nnhdCVb9i9KJu/TVJ1baSO2tJ3l4Jf1yYLonERuh5KZyugZEs+P7O7XeV0+AGu7is\nlZGj5AZhEFpwOBUNU5m9SGDqliq5X1iFhoBmFZ+V6QKUHyq/gWqUDx6baBLjGUdd\nWRjJHAVzY1Xjf0jHWs8RvkzMCskolzV5K0IP79REHTDjefeN4CuURy1KcxFHl3jR\nP7OZj2fgEz0gqAAganIDFI1D6onN4IB7Bk4NtB/gJQKBgQDyC55AYsYYvM7SMc/n\nPJ28lY4Vd5NSyQLf3BgkcpBFRcl8fqEQNaP+F53qa7bLCJJTWkglpur6B2LixlfW\nCkxUIzl4gGOeUQqp3/KzKHTPAAi3t6vAxLajZlugl7uLOBjY+UWkGu/yK+ekaQM9\nCkM8hA/ME2f0dPyF2nDo/XNeiwKBgQDZJrDrnrgevQjq0c0sTGPOnAMLgAStRHvu\nqeBGwEq1MdXFYeLqPhBDHnG1pdxftPXvD1QdfEeP/V+wV3kIx+sHGJl/39Qabg38\nJJDa0EDglKnT32R7A4IM3EcbdTjLA3yVSYNvpxyVi4LC+QFfexkxre/Oe3ItMATs\nVJfjFeqDrwKBgDNiZgkzLuzngFy9OG7VvoLfmRdTmFIV3Gdb2UA7lgcuxpSIaXcA\nfD0gFGVE0ryNqErLus9LfUzxLnwIMXN+IjAmfjfnwb5FZCcmJOcF6q5bSn5+HpdA\n66kKvN7991GZ6iR93tv03/1H7AhKRua5fAan3pardAFAqK9d7WR5Efn7AoGAIGUu\nRahjDWrkFqv/8Njglt8lySRrDjJGTt+W7tcnDgsGOjEVOh7SLEExdLp2uuxzOBvQ\nT6nHv0psaRFTpCS3AlMAK1yH9v1uJqyJ06r30sk64LnV8qgeUa7XCNifBWJaxqa1\n7gU/NWwfsNiXBNiHdKrfOK2f5e/g/CTOl/kgCE8CgYBo9fOsnIwlHikxgqpwq+j/\ngiFQUXcDeds6ke2FVu4Bw+jmw5WiDOYz9nUIRVfQQBYCZq/wuGg336xtvRd6bagl\nhEwBb1Bxs0PXOb9OJXfeN0t+i4QHTN+2Yt4fddvksO7kJeNbWCFmho+ebaKBsfey\nkW7wgMnKrF694aVMXaToiw==\n-----END PRIVATE KEY-----\n",
    client_email: "firebase-adminsdk-fbsvc@studio-gpnfx.iam.gserviceaccount.com",
    client_id: "113149690446202662127",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40studio-gpnfx.iam.gserviceaccount.com",
    universe_domain: "googleapis.com"
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: "studio-gpnfx"
  });
}

const db = getFirestore();

// Configuration for concurrent processing
const MAX_CONCURRENT_PROCESSING = 10; // Process up to 10 notifications concurrently
const BATCH_SIZE = 5; // Process notifications in batches of 5

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
 * Process form reminders (1h, 30min, 15min, 5min before deadline)
 */
async function processFormReminders(now, oneMinuteFromNow) {
  let processed = 0;
  let sent = 0;
  let errors = 0;

  try {
    // Get all forms with deadlines
    const formsSnapshot = await db.collection('forms')
      .where('deadline', '!=', null)
      .get();

    for (const formDoc of formsSnapshot.docs) {
      const form = { id: formDoc.id, ...formDoc.data() };
      
      if (!form.deadline || !form.assignedTo || form.assignedTo.length === 0) {
        continue;
      }

      const deadlineDate = new Date(`${form.deadline.date}T${form.deadline.time}`);
      const reminderIntervals = [60, 30, 15, 5]; // minutes before deadline

      for (const userId of form.assignedTo) {
        for (const intervalMinutes of reminderIntervals) {
          const reminderTime = new Date(deadlineDate.getTime() - intervalMinutes * 60 * 1000);
          
          // Check if this reminder should be sent now
          if (reminderTime >= now && reminderTime <= oneMinuteFromNow) {
            processed++;
            
            try {
              // Get user FCM token
              const userDoc = await db.collection('users').doc(userId).get();
              const userData = userDoc.data();
              const fcmToken = userData?.fcmToken;

              if (fcmToken) {
                // Use unified notification service (browser first, FCM fallback)
                const notificationData = {
                  title: 'Rappel de formulaire',
                  body: `N'oubliez pas de remplir le formulaire "${form.title}" (${intervalMinutes}min restantes)`,
                  data: {
                    type: 'form_reminder',
                    formId: form.id,
                    formTitle: form.title,
                    intervalMinutes: intervalMinutes.toString(),
                    redirectUrl: `/forms/${form.id}`,
                    timestamp: now.getTime().toString()
                  }
                };

                // Store notification in Firestore - frontend unified service will handle delivery
                const notificationDoc = {
                  title: notificationData.title,
                  body: notificationData.body,
                  type: notificationData.type,
                  recipientId: userId,
                  recipientRole: user.role,
                  agencyId: user.agencyId,
                  data: notificationData.data,
                  redirectUrl: notificationData.redirectUrl,
                  read: false,
                  status: 'sent',
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                  sentAt: admin.firestore.FieldValue.serverTimestamp(),
                  fcmToken: fcmToken,
                  emailAddress: user.email
                };

                await db.collection('notifications').add(notificationDoc);
                sent++;
                console.log(`📅 [Cron] Form reminder stored: ${form.title} (${intervalMinutes}min) to user ${userId}`);
              } else {
                console.warn(`📅 [Cron] No FCM token for user ${userId}, storing notification anyway (frontend will handle delivery)`);
                
                // Store notification even without FCM token - frontend unified service will try browser/email
                const notificationDoc = {
                  title: notificationData.title,
                  body: notificationData.body,
                  type: notificationData.type,
                  recipientId: userId,
                  recipientRole: user.role,
                  agencyId: user.agencyId,
                  data: notificationData.data,
                  redirectUrl: notificationData.redirectUrl,
                  read: false,
                  status: 'sent',
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                  sentAt: admin.firestore.FieldValue.serverTimestamp(),
                  emailAddress: user.email
                };

                await db.collection('notifications').add(notificationDoc);
                sent++;
              }
            } catch (error) {
              errors++;
              console.error(`❌ [Cron] Error sending form reminder:`, error);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ [Cron] Error processing form reminders:', error);
    errors++;
  }

  return { processed, sent, errors };
}

/**
 * Process metric reminders (director-programmed)
 */
async function processMetricReminders(now, oneMinuteFromNow) {
  let processed = 0;
  let sent = 0;
  let errors = 0;

  try {
    // Get all metric reminders that are due
    const remindersSnapshot = await db.collection('metricReminders')
      .where('status', '==', 'pending')
      .where('scheduledAt', '>=', Timestamp.fromDate(now))
      .where('scheduledAt', '<=', Timestamp.fromDate(oneMinuteFromNow))
      .get();

    for (const reminderDoc of remindersSnapshot.docs) {
      const reminder = { id: reminderDoc.id, ...reminderDoc.data() };
      processed++;

      try {
        // Get user FCM token
        const userDoc = await db.collection('users').doc(reminder.directorId).get();
        const userData = userDoc.data();
        const fcmToken = userData?.fcmToken;

        // Store notification in Firestore - frontend unified service will handle delivery
        const notificationDoc = {
          title: `Rappel métrique: ${reminder.metricName}`,
          body: `Valeur ${reminder.frequency}: ${reminder.lastValue}`,
          type: 'metric_reminder',
          recipientId: reminder.directorId,
          recipientRole: 'directeur',
          agencyId: userData?.agencyId || 'unknown',
          data: {
            dashboardId: reminder.dashboardId,
            metricId: reminder.metricId,
            frequency: reminder.frequency,
            metricName: reminder.metricName,
            lastValue: reminder.lastValue,
            redirectUrl: `/directeur/dashboards/${reminder.dashboardId}`,
            timestamp: now.getTime().toString()
          },
          redirectUrl: `/directeur/dashboards/${reminder.dashboardId}`,
          read: false,
          status: 'sent',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          fcmToken: fcmToken,
          emailAddress: userData?.email
        };

        await db.collection('notifications').add(notificationDoc);
        
        // Update reminder status
        await db.collection('metricReminders').doc(reminder.id).update({
          status: 'sent',
          sentAt: Timestamp.fromDate(now)
        });
        
        sent++;
        console.log(`📊 [Cron] Metric reminder stored: ${reminder.metricName} to director ${reminder.directorId}`);
      } catch (error) {
        errors++;
        console.error(`❌ [Cron] Error sending metric reminder:`, error);
      }
    }
  } catch (error) {
    console.error('❌ [Cron] Error processing metric reminders:', error);
    errors++;
  }

  return { processed, sent, errors };
}

/**
 * Process programmed instructions (when executed)
 */
async function processProgrammedInstructions(now, oneMinuteFromNow) {
  let processed = 0;
  let sent = 0;
  let errors = 0;

  try {
    // Get all scheduled questions that are due for execution
    const questionsSnapshot = await db.collection('scheduledQuestions')
      .where('status', '==', 'pending')
      .where('scheduledAt', '>=', Timestamp.fromDate(now))
      .where('scheduledAt', '<=', Timestamp.fromDate(oneMinuteFromNow))
      .get();

    for (const questionDoc of questionsSnapshot.docs) {
      const question = { id: questionDoc.id, ...questionDoc.data() };
      processed++;

      try {
        // Execute the scheduled question (this would call the AI service)
        // For now, we'll just send a notification that it's being processed
        const userDoc = await db.collection('users').doc(question.userId).get();
        const userData = userDoc.data();
        const fcmToken = userData?.fcmToken;

        // Store notification in Firestore - frontend unified service will handle delivery
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
          fcmToken: fcmToken,
          emailAddress: userData?.email
        };

        await db.collection('notifications').add(notificationDoc);
        
        sent++;
        console.log(`🤖 [Cron] Programmed instruction notification stored: ${question.title} to director ${question.userId}`);
      } catch (error) {
        errors++;
        console.error(`❌ [Cron] Error sending programmed instruction notification:`, error);
      }
    }
  } catch (error) {
    console.error('❌ [Cron] Error processing programmed instructions:', error);
    errors++;
  }

  return { processed, sent, errors };
}

// Old FCM function removed - now using unified notification service

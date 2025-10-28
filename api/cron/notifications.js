const admin = require('firebase-admin');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

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

/**
 * Unified Cron Job for All Notifications
 * 
 * This endpoint handles all scheduled notifications:
 * - form_reminder: 1h, 30min, 15min, 5min before form deadline
 * - metric_reminder: Director-programmed metric reminders
 * - programmed_instruction: When scheduled instructions are executed
 */
module.exports = async (req, res) => {
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

                // Call unified notification service
                const response = await fetch(`${process.env.API_BASE_URL || 'http://localhost:3000'}/api/notifications/send`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    notification: notificationData,
                    fcmToken: fcmToken,
                    userId: userId,
                    method: 'auto' // Browser first, FCM fallback
                  })
                });

                if (response.ok) {
                  sent++;
                  console.log(`📅 [Cron] Form reminder sent: ${form.title} (${intervalMinutes}min) to user ${userId}`);
                } else {
                  console.error(`📅 [Cron] Failed to send form reminder to user ${userId}:`, await response.text());
                  errors++;
                }
              } else {
                console.warn(`📅 [Cron] No FCM token for user ${userId}, skipping form reminder`);
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

        if (fcmToken) {
          // Use unified notification service (browser first, FCM fallback)
          const notificationData = {
            title: `Rappel métrique: ${reminder.metricName}`,
            body: `Valeur ${reminder.frequency}: ${reminder.lastValue}`,
            data: {
              type: 'metric_reminder',
              dashboardId: reminder.dashboardId,
              metricId: reminder.metricId,
              frequency: reminder.frequency,
              redirectUrl: `/directeur/dashboards/${reminder.dashboardId}`,
              timestamp: now.getTime().toString()
            }
          };

          // Call unified notification service
          const response = await fetch(`${process.env.API_BASE_URL || 'http://localhost:3000'}/api/notifications/send`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              notification: notificationData,
              fcmToken: fcmToken,
              userId: reminder.directorId,
              method: 'auto' // Browser first, FCM fallback
            })
          });

          if (response.ok) {
            // Update reminder status
            await db.collection('metricReminders').doc(reminder.id).update({
              status: 'sent',
              sentAt: Timestamp.fromDate(now)
            });
            
            sent++;
            console.log(`📊 [Cron] Metric reminder sent: ${reminder.metricName} to director ${reminder.directorId}`);
          } else {
            console.error(`📊 [Cron] Failed to send metric reminder to director ${reminder.directorId}:`, await response.text());
            errors++;
          }
        } else {
          console.warn(`📊 [Cron] No FCM token for director ${reminder.directorId}, skipping metric reminder`);
        }
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

        if (fcmToken) {
          // Use unified notification service (browser first, FCM fallback)
          const notificationData = {
            title: `Instruction programmée exécutée`,
            body: `Votre instruction "${question.title}" a été exécutée avec succès`,
            data: {
              type: 'programmed_instruction',
              scheduledQuestionId: question.id,
              questionTitle: question.title,
              redirectUrl: `/directeur/scheduled-questions/${question.id}/chat`,
              timestamp: now.getTime().toString()
            }
          };

          // Call unified notification service
          const response = await fetch(`${process.env.API_BASE_URL || 'http://localhost:3000'}/api/notifications/send`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              notification: notificationData,
              fcmToken: fcmToken,
              userId: question.userId,
              method: 'auto' // Browser first, FCM fallback
            })
          });

          if (response.ok) {
            sent++;
            console.log(`🤖 [Cron] Programmed instruction notification sent: ${question.title} to director ${question.userId}`);
          } else {
            console.error(`🤖 [Cron] Failed to send instruction notification to director ${question.userId}:`, await response.text());
            errors++;
          }
        } else {
          console.warn(`🤖 [Cron] No FCM token for director ${question.userId}, skipping instruction notification`);
        }
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

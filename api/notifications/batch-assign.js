import admin from 'firebase-admin';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';
import { buildAbsoluteUrl, renderEmailTemplate } from '../lib/urlEmail.js';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = getFirestore();

function normalizeRole(role) {
  return role === 'directeur' ? 'directeur' : 'employe';
}

function createIdempotentDocId({ formId, userId, action, version }) {
  return `${formId}:${userId}:${action}:${version || 'v1'}`;
}

async function fetchUsersData(userIds) {
  const results = new Map();
  await Promise.all(userIds.map(async (userId) => {
    try {
      const snap = await db.collection('users').doc(userId).get();
      if (snap.exists) {
        const data = snap.data();
        results.set(userId, {
          email: data?.email,
          role: normalizeRole(data?.role),
          agencyId: data?.agencyId || '',
        });
      } else {
        results.set(userId, { email: undefined, role: 'employe', agencyId: '' });
      }
    } catch (e) {
      results.set(userId, { email: undefined, role: 'employe', agencyId: '' });
    }
  }));
  return results;
}

function buildNotificationDoc({
  userId, userData, formId, formTitle, directorName, action, redirectPath, idempotencyKey
}) {
  return {
    title: action === 'assigned' ? 'Nouveau formulaire assigné' : 'Formulaire désassigné',
    body: action === 'assigned'
      ? `${directorName} vous a assigné le formulaire "${formTitle}"`
      : `Vous n'êtes plus assigné au formulaire "${formTitle}"`,
    type: 'form_assignment',
    recipientId: userId,
    recipientRole: userData.role,
    agencyId: userData.agencyId || '',
    data: {
      formId,
      formTitle,
      assignedByName: directorName,
      action,
      highlightForm: true,
      redirectPath: redirectPath || '/forms',
    },
    redirectUrl: redirectPath || '/forms',
    read: false,
    status: 'sent',
    createdAt: Timestamp.now(),
    sentAt: Timestamp.now(),
    emailAddress: userData.email,
    idempotencyKey,
  };
}

function makeTransporter() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) return null;
  const host = process.env.EMAIL_HOST || 'smtp.titan.email';
  const port = parseInt(process.env.EMAIL_PORT || '587', 10);
  const secure = typeof process.env.EMAIL_SECURE === 'string'
    ? process.env.EMAIL_SECURE === 'true'
    : port === 465;
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
  });
}

async function sendEmail(transporter, { to, subject, html, text }) {
  if (!transporter || !to) return { success: false, skipped: true };
  const fromName = process.env.EMAIL_FROM_NAME || 'Ubora App';
  const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  const info = await transporter.sendMail({
    from: fromAddress ? `${fromName} <${fromAddress}>` : undefined,
    to, subject, html, text: text || html?.replace(/<[^>]*>/g, '')
  });
  return { success: true, messageId: info.messageId };
}

export default async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const {
      formId,
      formTitle,
      directorName,
      agencyId,
      currentAssignedUserIds = [],
      previousAssignedUserIds = [],
      version,
      redirectUrl,
    } = req.body || {};

    if (!formId || !formTitle || !Array.isArray(currentAssignedUserIds)) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Compute diffs
    const currentSet = new Set(currentAssignedUserIds);
    const previousSet = new Set(previousAssignedUserIds || []);
    const assigned = [...currentSet].filter(u => !previousSet.has(u));
    const unassigned = [...previousSet].filter(u => !currentSet.has(u));
    const impacted = Array.from(new Set([...assigned, ...unassigned]));

    // Fetch user data
    const usersData = await fetchUsersData(impacted);

    // Prepare batch writes (chunk ≤500)
    const transporter = makeTransporter();
    let written = 0;
    let emailSent = 0;
    let emailFailures = 0;

    const chunks = [];
    const payloads = [];

    const pushPayload = (userId, action) => {
      const userData = usersData.get(userId) || { role: 'employe', agencyId: '', email: undefined };
      const idempotencyKey = `${formId}:${userId}:${action}:${version || 'v1'}`;
      const docId = createIdempotentDocId({ formId, userId, action, version });
      payloads.push({ userId, action, userData, docId, idempotencyKey });
    };

    assigned.forEach(u => pushPayload(u, 'assigned'));
    unassigned.forEach(u => pushPayload(u, 'unassigned'));

    // Build chunks of up to 500
    for (let i = 0; i < payloads.length; i += 500) {
      chunks.push(payloads.slice(i, i + 500));
    }

    for (const chunk of chunks) {
      const batch = db.batch();
      for (const p of chunk) {
        const ref = db.collection('notifications').doc(p.docId);
      const redirectPath = '/forms/' + formId;
      const doc = buildNotificationDoc({
          userId: p.userId,
          userData: p.userData,
          formId,
          formTitle,
          directorName,
          action: p.action,
        redirectPath,
          idempotencyKey: p.idempotencyKey,
        });
        batch.set(ref, doc, { merge: true });
      }
      await batch.commit();
      written += chunk.length;

      // Send emails after commit
      await Promise.allSettled(chunk.map(async (p) => {
        if (!p.userData.email) return;
        try {
          const subject = docTitleForEmail(p.action, formTitle);
          const abs = buildAbsoluteUrl(p.userData.role, '/forms/' + formId);
          const bodyText = p.action === 'assigned'
            ? `${directorName} vous a assigné le formulaire "${formTitle}"`
            : `Vous n'êtes plus assigné au formulaire "${formTitle}"`;
          const html = renderEmailTemplate({
            title: subject,
            body: bodyText,
            ctaLabel: 'Ouvrir dans Ubora',
            ctaHref: abs,
          });
          const res = await sendEmail(transporter, { to: p.userData.email, subject, html });
          if (res.success) emailSent += 1; else emailFailures += 1;
        } catch (e) {
          emailFailures += 1;
        }
      }));
    }

    return res.status(200).json({
      success: true,
      formId,
      written,
      emailSent,
      emailFailures,
      assignedCount: assigned.length,
      unassignedCount: unassigned.length,
    });
  } catch (error) {
    console.error('❌ [batch-assign] Error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', details: error.message });
  }
};

function docTitleForEmail(action, formTitle) {
  return action === 'assigned' ? 'Nouveau formulaire assigné' : 'Formulaire désassigné';
}

function docBodyForEmail() { return ''; }



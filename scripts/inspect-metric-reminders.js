import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
let initialized = false;
try {
  const serviceAccountPath = join(__dirname, '../studio-gpnfx-firebase-adminsdk-fbsvc-49cf718bd7.json');
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  initialized = true;
} catch (e) {
  try {
    if (!admin.apps.length) admin.initializeApp();
    initialized = true;
  } catch (ee) {
    console.error('❌ Failed to initialize Firebase Admin SDK:', ee.message);
    process.exit(1);
  }
}

const db = admin.firestore();

function calculateNextScheduledTime(frequency, time, fromDate) {
  const now = fromDate || new Date();
  const [hours, minutes] = (time || '09:00').split(':').map(Number);
  const next = new Date(now);
  next.setHours(hours, minutes, 0, 0);
  if (next <= now) {
    if (frequency === 'daily') next.setDate(next.getDate() + 1);
    else if (frequency === 'weekly') next.setDate(next.getDate() + 7);
    else if (frequency === 'monthly') next.setMonth(next.getMonth() + 1);
  }
  return next;
}

async function main() {
  console.log('🔎 Inspecting metric reminders...');
  const now = new Date();
  const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);

  const snap = await db.collection('metricReminders').get();
  console.log(`📄 Found ${snap.size} metric reminders`);

  const rows = snap.docs.map((d) => {
    const r = d.data() || {};
    const scheduledAt = r.scheduledAt?.toDate ? r.scheduledAt.toDate() : r.scheduledAt;
    const nextAt = calculateNextScheduledTime(r.frequency, r.time, now);
    return {
      id: d.id,
      directorId: r.directorId,
      status: r.status,
      frequency: r.frequency,
      time: r.time,
      scheduledAt: scheduledAt ? scheduledAt.toISOString() : null,
      scheduledInMin: scheduledAt ? Math.round((scheduledAt - now) / 60000) : null,
      nextAt: nextAt.toISOString(),
    };
  });

  const dueSoon = rows.filter(r => r.scheduledAt && r.scheduledInMin !== null && r.scheduledInMin <= 60);
  const pending = rows.filter(r => r.status === 'pending');

  console.log('\n⏱️ Due within 60 minutes:', dueSoon.length);
  dueSoon.slice(0, 20).forEach(r => console.log(` - [${r.id}] ${r.scheduledAt} in ${r.scheduledInMin}min`));
  if (dueSoon.length > 20) console.log(`  ...and ${dueSoon.length - 20} more`);

  console.log('\n🟡 Pending total:', pending.length);
  pending.slice(0, 20).forEach(r => console.log(` - [${r.id}] freq=${r.frequency} time=${r.time} scheduledAt=${r.scheduledAt}`));

  console.log('\n📊 Summary:', { total: rows.length, pending: pending.length, dueWithin60: dueSoon.length });
}

main().then(() => process.exit(0)).catch((e) => { console.error('❌ Error:', e); process.exit(1); });



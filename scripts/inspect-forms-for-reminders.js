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

function getAfricaDoualaWeekdayNumber(referenceDate) {
  const base = referenceDate instanceof Date ? referenceDate : new Date();
  const doualaShifted = new Date(base.getTime() + 60 * 60 * 1000);
  return doualaShifted.getUTCDay();
}

function buildTodayDueAtAfricaDouala(endTimeStr) {
  if (!endTimeStr || typeof endTimeStr !== 'string') return null;
  const now = new Date();
  const [h, m] = endTimeStr.split(':');
  const hour = parseInt(h || '0', 10);
  const minute = parseInt(m || '0', 10);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  // Africa/Douala is UTC+1 (no DST). Convert local to UTC by subtracting 1 hour
  const utcHour = (hour - 1 + 24) % 24;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), utcHour, minute, 0, 0));
}

function minutesUntil(date) {
  return Math.round((date.getTime() - Date.now()) / 60000);
}

async function main() {
  console.log('🔎 Inspecting forms for reminder readiness...');
  const snapshot = await db.collectionGroup('forms').get();
  console.log(`📄 Found ${snapshot.size} forms (collection group 'forms')`);

  const todayNum = getAfricaDoualaWeekdayNumber(new Date());
  const report = [];

  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data() || {};
    const assignedTo = Array.isArray(data.assignedTo) ? data.assignedTo : [];
    const tr = data.timeRestrictions || {};
    const allowedDays = Array.isArray(tr.allowedDays) ? tr.allowedDays : [];
    const endTime = tr.endTime;

    const issues = [];
    if (assignedTo.length === 0) issues.push('no_assigned_users');
    if (!endTime) issues.push('missing_endTime');
    const allowedToday = Array.isArray(allowedDays) && allowedDays.length > 0 && allowedDays.includes(todayNum);
    if (!allowedToday) issues.push('today_not_allowed');

    const dueAt = endTime ? buildTodayDueAtAfricaDouala(endTime) : null;
    const reminderIntervals = [60, 30, 15, 5];
    let nextReminderMin = null;
    if (dueAt) {
      const upcoming = reminderIntervals
        .map((min) => new Date(dueAt.getTime() - min * 60000))
        .filter((t) => t.getTime() > Date.now())
        .sort((a, b) => a.getTime() - b.getTime());
      if (upcoming.length > 0) nextReminderMin = minutesUntil(upcoming[0]);
    }

    report.push({
      id: docSnap.id,
      title: data.title || '(no title)',
      path: docSnap.ref.path,
      assignedToCount: assignedTo.length,
      allowedDays,
      endTime: endTime || null,
      allowedToday,
      dueAtUTC: dueAt ? dueAt.toISOString() : null,
      dueAtLocal: dueAt ? dueAt.toString() : null,
      nextReminderInMin: nextReminderMin,
      ready: assignedTo.length > 0 && endTime && allowedToday,
      issues,
    });
  });

  const ready = report.filter((r) => r.ready);
  const notReady = report.filter((r) => !r.ready);

  console.log('\n✅ Likely to receive reminders today (ready):', ready.length);
  ready.slice(0, 20).forEach((r) => {
    console.log(`  - [${r.id}] ${r.title} | endTime=${r.endTime} | nextReminderIn=${r.nextReminderInMin}min | path=${r.path}`);
  });
  if (ready.length > 20) console.log(`  ...and ${ready.length - 20} more`);

  console.log('\n⚠️ Not ready (missing fields or day not allowed):', notReady.length);
  notReady.slice(0, 50).forEach((r) => {
    console.log(`  - [${r.id}] ${r.title} | issues=${r.issues.join(', ')} | allowedDays=${JSON.stringify(r.allowedDays)} | path=${r.path}`);
  });
  if (notReady.length > 50) console.log(`  ...and ${notReady.length - 50} more`);

  console.log('\n📊 Summary: ', {
    total: report.length,
    ready: ready.length,
    notReady: notReady.length,
  });
}

main().then(() => process.exit(0)).catch((e) => {
  console.error('❌ Error during inspection:', e);
  process.exit(1);
});




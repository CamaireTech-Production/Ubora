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

const DAY_NAME_TO_NUM = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6,
};

function toNumericDays(allowedDays) {
  if (!Array.isArray(allowedDays)) return { numbers: [], changed: false };
  let changed = false;
  const nums = [];
  for (const d of allowedDays) {
    if (typeof d === 'number') {
      if (d >= 0 && d <= 6) nums.push(d);
      else changed = true; // invalid number dropped
      continue;
    }
    if (typeof d === 'string') {
      const key = d.trim().toLowerCase();
      if (Object.prototype.hasOwnProperty.call(DAY_NAME_TO_NUM, key)) {
        nums.push(DAY_NAME_TO_NUM[key]);
        changed = true;
      } else if (/^\d$/.test(key)) {
        const n = parseInt(key, 10);
        if (n >= 0 && n <= 6) {
          nums.push(n);
          changed = true;
        } else {
          changed = true; // invalid string number
        }
      } else {
        changed = true; // unknown string dropped
      }
      continue;
    }
    changed = true; // unsupported type
  }
  // Deduplicate and sort
  const unique = Array.from(new Set(nums)).sort((a, b) => a - b);
  return { numbers: unique, changed };
}

function isValidHHmm(str) {
  if (typeof str !== 'string') return false;
  const m = str.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  return !!m;
}

async function main() {
  const write = process.argv.includes('--write');
  console.log(`🔧 Migrating forms allowedDays → numeric (dry-run=${!write})`);
  const snap = await db.collectionGroup('forms').get();
  console.log(`📄 Found ${snap.size} forms`);

  let toUpdate = 0;
  let updated = 0;
  const issues = [];
  const batch = db.batch();

  snap.docs.forEach((docSnap) => {
    const data = docSnap.data() || {};
    const tr = data.timeRestrictions || {};
    const { numbers, changed } = toNumericDays(tr.allowedDays);
    const endTime = tr.endTime;
    const recordIssues = [];
    if (!Array.isArray(tr.allowedDays)) {
      // missing or invalid type -> no reminders unless user sets it; don't auto-fill
    }
    if (endTime && !isValidHHmm(endTime)) {
      recordIssues.push('invalid_endTime_format');
    }
    if (!Array.isArray(data.assignedTo) || data.assignedTo.length === 0) {
      recordIssues.push('no_assigned_users');
    }

    // Legacy rule: if assignedTo not empty AND valid endTime AND allowedDays empty array => set all days [0..6]
    let legacyFillAllDays = false;
    const hasAssignees = Array.isArray(data.assignedTo) && data.assignedTo.length > 0;
    const validEndTime = !!endTime && isValidHHmm(endTime);
    const originalIsEmptyArray = Array.isArray(tr.allowedDays) && tr.allowedDays.length === 0;
    if (hasAssignees && validEndTime && originalIsEmptyArray) {
      legacyFillAllDays = true;
    }

    const finalAllowedDays = legacyFillAllDays ? [0,1,2,3,4,5,6] : numbers;
    const needsWrite = changed || legacyFillAllDays;
    if (needsWrite) {
      toUpdate += 1;
      if (write) {
        batch.update(docSnap.ref, { 'timeRestrictions.allowedDays': finalAllowedDays });
        updated += 1;
      }
    }
    if (recordIssues.length > 0) {
      issues.push({ id: docSnap.id, path: docSnap.ref.path, title: data.title || '(no title)', issues: recordIssues, allowedDaysBefore: tr.allowedDays, allowedDaysAfter: finalAllowedDays });
    }
  });

  if (write && updated > 0) {
    await batch.commit();
  }

  console.log('\n📊 Migration summary:', { total: snap.size, toUpdate, updated: write ? updated : 0, mode: write ? 'write' : 'dry-run' });
  if (issues.length > 0) {
    console.log('\n⚠️ Issues:', Math.min(issues.length, 100), 'shown (max 100)');
    issues.slice(0, 100).forEach((i) => {
      console.log(` - [${i.id}] ${i.title} | ${i.path} | issues=${i.issues.join(', ')} | before=${JSON.stringify(i.allowedDaysBefore)} after=${JSON.stringify(i.allowedDaysAfter)}`);
    });
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error('❌ Migration error:', e); process.exit(1); });



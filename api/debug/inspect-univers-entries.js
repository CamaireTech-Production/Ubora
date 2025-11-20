/**
 * DEBUG SCRIPT: Inspect Univers Forms & Entries
 *
 * For a given director/agency, this script:
 * 1. Loads the active univers + instance.
 * 2. Lists all forms tied to that univers (and agency).
 * 3. Loads all form entries per form.
 * 4. Fetches Qdrant points for the same univers.
 * 5. Reports whether each entry is linked to the univers instance
 *    and whether it exists in Qdrant.
 *
 * Usage:
 *   node api/debug/inspect-univers-entries.js <directorId> <agencyId>
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables (prefer .env.local)
const loadedLocalEnv = dotenv.config({ path: path.join(__dirname, '../../.env.local') });
if (!loadedLocalEnv || !loadedLocalEnv.parsed) {
  dotenv.config({ path: path.join(__dirname, '../../.env') });
}

import { adminDb } from '../lib/firebaseAdmin.js';
import { qdrantRequest, COLLECTION_NAME } from '../lib/vectorDb.js';

const MAX_FORM_ENTRIES = 200; // Cap per form to prevent runaway memory usage

async function getActiveUnivers(directorId) {
  const doc = await adminDb.collection('activeUnivers').doc(directorId).get();
  if (!doc.exists) {
    return null;
  }
  return doc.data();
}

async function getFormsForUnivers(universId, agencyId) {
  if (!universId) return [];
  const snapshot = await adminDb
    .collection('forms')
    .where('universId', '==', universId)
    .where('agencyId', '==', agencyId)
    .get();

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function getEntriesForForm(formId, agencyId) {
  const snapshot = await adminDb
    .collection('formEntries')
    .where('formId', '==', formId)
    .where('agencyId', '==', agencyId)
    .orderBy('submittedAt', 'desc')
    .limit(MAX_FORM_ENTRIES)
    .get();

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function getQdrantEntries(agencyId, universId) {
  const filter = {
    must: [
      { key: 'agencyId', match: { value: agencyId } },
      { key: 'universId', match: { value: universId } }
    ]
  };

  const qdrantEntries = new Map();
  let hasMore = true;
  let offset = null;

  while (hasMore) {
    const response = await qdrantRequest(
      `/collections/${COLLECTION_NAME}/points/scroll`,
      {
        method: 'POST',
        body: JSON.stringify({
          filter,
          offset,
          limit: 1000,
          with_payload: true,
          with_vector: false
        })
      }
    );

    const points = response.result?.points || [];
    points.forEach(point => {
      const entryId = point.payload?.entryId;
      if (entryId) {
        qdrantEntries.set(entryId, {
          pointId: point.id,
          formId: point.payload?.formId,
          formTitle: point.payload?.formTitle,
          universId: point.payload?.universId,
          universInstanceId: point.payload?.universInstanceId,
          submittedAt: point.payload?.submittedAt,
          chunkIndex: point.payload?.chunkIndex ?? null
        });
      }
    });

    offset = response.result?.next_page_offset || null;
    hasMore = Boolean(offset);
  }

  return qdrantEntries;
}

function formatDate(value) {
  if (!value) return 'N/A';
  if (value.toDate) {
    return value.toDate().toISOString();
  }
  return new Date(value).toISOString();
}

async function main() {
  const directorId = process.argv[2];
  const agencyId = process.argv[3];

  if (!directorId || !agencyId) {
    console.error('Usage: node api/debug/inspect-univers-entries.js <directorId> <agencyId>');
    process.exit(1);
  }

  console.log('🔍 Inspecting Univers Entries');
  console.log(`👤 Director ID: ${directorId}`);
  console.log(`🏢 Agency ID: ${agencyId}`);

  const activeUnivers = await getActiveUnivers(directorId);
  if (!activeUnivers) {
    console.error('❌ No active univers document for this director.');
    process.exit(1);
  }

  const { activeUniversId, activeInstanceId } = activeUnivers;
  console.log(`📌 Active Univers ID: ${activeUniversId || 'N/A'}`);
  console.log(`📦 Active Instance ID: ${activeInstanceId || 'N/A'}\n`);

  if (!activeUniversId) {
    console.error('❌ Director has no active univers ID set.');
    process.exit(1);
  }

  const forms = await getFormsForUnivers(activeUniversId, agencyId);
  if (forms.length === 0) {
    console.warn('⚠️ No forms found for this univers/agency.');
  } else {
    console.log(`📄 Found ${forms.length} form(s) for the active univers\n`);
  }

  const qdrantEntries = await getQdrantEntries(agencyId, activeUniversId);
  console.log(`🧠 Qdrant points loaded: ${qdrantEntries.size}\n`);

  for (const form of forms) {
    console.log('='.repeat(80));
    console.log(`📝 Form: ${form.title || 'Sans titre'} (${form.id})`);
    console.log(`   universId: ${form.universId || 'N/A'}`);
    console.log(`   universInstanceId: ${form.universInstanceId || 'N/A'}`);
    console.log(`   assignedTo: ${form.assignedTo ? JSON.stringify(form.assignedTo) : 'N/A'}`);

    const entries = await getEntriesForForm(form.id, agencyId);
    console.log(`   ➜ Entries fetched (latest ${MAX_FORM_ENTRIES} max): ${entries.length}`);

    if (entries.length === 0) {
      continue;
    }

    entries.forEach((entry, index) => {
      const qdrantHit = qdrantEntries.get(entry.id);
      const submittedAt = formatDate(entry.submittedAt);
      const vectorStatus = entry.vectorSyncStatus || 'unknown';
      console.log(`\n   #${index + 1} Entry ${entry.id}`);
      console.log(`      submittedAt: ${submittedAt}`);
      console.log(`      userId: ${entry.userId || 'N/A'}`);
      console.log(`      universInstanceId: ${entry.universInstanceId || 'N/A'}`);
      console.log(`      vectorSyncStatus: ${vectorStatus}`);
      console.log(`      vectorChunksCount: ${entry.vectorChunksCount ?? 0}`);
      if (qdrantHit) {
        console.log('      ✅ Present in Qdrant');
        console.log(`         pointId: ${qdrantHit.pointId}`);
        console.log(`         chunkIndex: ${qdrantHit.chunkIndex}`);
      } else {
        console.log('      ❌ Missing in Qdrant');
      }
    });
    console.log('');
  }

  console.log('\n✅ Inspection completed.');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Fatal error during inspection:', error);
    process.exit(1);
  });


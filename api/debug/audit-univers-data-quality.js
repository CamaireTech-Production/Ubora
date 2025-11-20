/**
 * GLOBAL DATA QUALITY AUDIT
 *
 * For every director (role=directeur):
 *  - Reads active univers + instance IDs.
 *  - Loads univers template definitions and the instance resource map.
 *  - Compares template definitions to instantiated resource IDs.
 *  - Fetches actual resources bound to the instance and detects duplicates/missing items.
 *  - Pulls recent form submissions and verifies universInstanceId and Qdrant sync.
 *
 * Usage:
 *   node api/debug/audit-univers-data-quality.js
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const loadedLocalEnv = dotenv.config({ path: path.join(__dirname, '../../.env.local') });
if (!loadedLocalEnv || !loadedLocalEnv.parsed) {
  dotenv.config({ path: path.join(__dirname, '../../.env') });
}

import { adminDb } from '../lib/firebaseAdmin.js';
import { qdrantRequest, COLLECTION_NAME } from '../lib/vectorDb.js';

const FORM_ENTRY_LIMIT = 300; // limit per form to prevent runaway reads

const RESOURCE_TYPES = [
  { key: 'forms', titleField: 'title', collection: 'forms' },
  { key: 'lists', titleField: 'name', collection: 'lists' },
  { key: 'dashboards', titleField: 'name', collection: 'dashboards' },
  { key: 'reports', titleField: 'name', collection: 'reports' },
];

function iso(value) {
  if (!value) return 'N/A';
  if (value.toDate) return value.toDate().toISOString();
  return new Date(value).toISOString();
}

async function getDirectors() {
  const snapshot = await adminDb.collection('users').where('role', '==', 'directeur').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function getActiveUniversDoc(directorId) {
  const doc = await adminDb.collection('activeUnivers').doc(directorId).get();
  return doc.exists ? doc.data() : null;
}

async function getUnivers(universId) {
  if (!universId) return null;
  const doc = await adminDb.collection('univers').doc(universId).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function getInstance(instanceId) {
  if (!instanceId) return null;
  const doc = await adminDb.collection('universInstances').doc(instanceId).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function fetchInstanceResources(instanceId, resourceType) {
  return adminDb
    .collection(resourceType.collection)
    .where('universInstanceId', '==', instanceId)
    .get()
    .then(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
}

async function fetchFormEntries(formId, agencyId) {
  const snapshot = await adminDb
    .collection('formEntries')
    .where('formId', '==', formId)
    .where('agencyId', '==', agencyId)
    .orderBy('submittedAt', 'desc')
    .limit(FORM_ENTRY_LIMIT)
    .get();

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function fetchQdrantEntryIds(agencyId, universId) {
  if (!agencyId || !universId) return new Set();

  const entryIds = new Set();
  let offset = null;
  let hasMore = true;

  while (hasMore) {
    const response = await qdrantRequest(
      `/collections/${COLLECTION_NAME}/points/scroll`,
      {
        method: 'POST',
        body: JSON.stringify({
          filter: {
            must: [
              { key: 'agencyId', match: { value: agencyId } },
              { key: 'universId', match: { value: universId } }
            ]
          },
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
      if (entryId) entryIds.add(entryId);
    });

    offset = response.result?.next_page_offset;
    hasMore = Boolean(offset);
  }

  return entryIds;
}

function analyzeResources({ templateDefs = [], instanceIds = [], actualDocs = [], titleField }) {
  const templateCount = templateDefs.length;
  const instanceCount = instanceIds.length;
  const actualCount = actualDocs.length;

  const instanceIdSet = new Set(instanceIds);
  const missingFromInstance = templateDefs
    .map(def => def.id || def.formId || def.listId || def.dashboardId || def.reportId)
    .filter(id => id && !instanceIdSet.has(id));

  const missingDocs = instanceIds.filter(id => !actualDocs.some(doc => doc.id === id));
  const extraDocs = actualDocs.filter(doc => !instanceIdSet.has(doc.id));

  const duplicateTitles = actualDocs.reduce((acc, doc) => {
    const title = doc[titleField] || 'Sans titre';
    acc.set(title, (acc.get(title) || 0) + 1);
    return acc;
  }, new Map());
  const duplicates = Array.from(duplicateTitles.entries())
    .filter(([, count]) => count > 1)
    .map(([title, count]) => ({ title, count }));

  return {
    templateCount,
    instanceCount,
    actualCount,
    missingFromInstance,
    missingDocs,
    extraDocs,
    duplicates
  };
}

async function auditDirector(director) {
  console.log('='.repeat(120));
  console.log(`Director: ${director.name || director.email || director.id} (${director.id}) - Agency ${director.agencyId || 'N/A'}`);

  const activeUnivers = await getActiveUniversDoc(director.id);
  if (!activeUnivers) {
    console.log('  ⚠️ No active univers record, skipping\n');
    return;
  }

  const univers = await getUnivers(activeUnivers.activeUniversId);
  const instance = await getInstance(activeUnivers.activeInstanceId);

  if (!univers) {
    console.log(`  ❌ univers ${activeUnivers.activeUniversId} missing`);
    return;
  }
  if (!instance) {
    console.log(`  ❌ instance ${activeUnivers.activeInstanceId} missing`);
    return;
  }

  console.log(`  Univers: ${univers.metadata?.name || univers.name || univers.id}`);
  console.log(`  Template version: ${univers.metadata?.version || univers.version || 'N/A'}`);
  console.log(`  Instance: ${instance.id}, createdAt ${iso(instance.createdAt)}, updateAvailable=${instance.updateAvailable}`);

  const qdrantEntryIds = await fetchQdrantEntryIds(director.agencyId, univers.id);
  console.log(`  Qdrant entries cached: ${qdrantEntryIds.size}`);

  for (const resource of RESOURCE_TYPES) {
    const templateDefs = univers.definitions?.[resource.key] || [];
    const instanceIds = instance.instances?.[resource.key] || [];
    const actualDocs = await fetchInstanceResources(instance.id, resource);

    const analysis = analyzeResources({
      templateDefs,
      instanceIds,
      actualDocs,
      titleField: resource.titleField
    });

    console.log(`\n  ▶ ${resource.key.toUpperCase()}`);
    console.log(`     Template=${analysis.templateCount}, InstanceIDs=${analysis.instanceCount}, ActualDocs=${analysis.actualCount}`);
    if (analysis.missingFromInstance.length > 0) {
      console.log(`     ❌ Template definitions missing in instance list: ${analysis.missingFromInstance.join(', ')}`);
    }
    if (analysis.missingDocs.length > 0) {
      console.log(`     ❌ Instance references without documents: ${analysis.missingDocs.join(', ')}`);
    }
    if (analysis.extraDocs.length > 0) {
      console.log(`     ⚠️ Extra docs not tracked by instance list: ${analysis.extraDocs.map(doc => `${doc[resource.titleField] || doc.id} (${doc.id})`).join(' | ')}`);
    }
    if (analysis.duplicates.length > 0) {
      console.log(`     ⚠️ Duplicate titles: ${analysis.duplicates.map(d => `${d.title} x${d.count}`).join(' | ')}`);
    }
  }

  // Form submissions audit
  console.log('\n  ▶ FORM ENTRIES & VECTOR SYNC');
  let totalEntries = 0;
  let missingInstanceEntries = 0;
  let qdrantMissing = 0;
  let entriesSampled = [];

  for (const formId of instance.instances?.forms || []) {
    const entries = await fetchFormEntries(formId, director.agencyId);
    totalEntries += entries.length;
    entries.forEach(entry => {
      if (!entry.universInstanceId || entry.universInstanceId !== instance.id) {
        missingInstanceEntries++;
      }
      if (!qdrantEntryIds.has(entry.id)) {
        qdrantMissing++;
      }
    });
    if (entries.length > 0) {
      entriesSampled.push({
        formId,
        count: entries.length,
        missingInstance: entries.filter(e => !e.universInstanceId || e.universInstanceId !== instance.id).length,
        missingQdrant: entries.filter(e => !qdrantEntryIds.has(e.id)).length
      });
    }
  }

  console.log(`     Entries scanned: ${totalEntries}`);
  console.log(`     Missing universInstanceId or mismatch: ${missingInstanceEntries}`);
  console.log(`     Missing in Qdrant: ${qdrantMissing}`);
  entriesSampled.slice(0, 5).forEach(sample => {
    console.log(`       • Form ${sample.formId}: entries=${sample.count}, missingInstance=${sample.missingInstance}, missingQdrant=${sample.missingQdrant}`);
  });
  if (entriesSampled.length > 5) {
    console.log('       (additional forms omitted for brevity)');
  }
}

async function main() {
  const directors = await getDirectors();
  console.log(`Total directors: ${directors.length}\n`);

  for (const director of directors) {
    try {
      await auditDirector(director);
    } catch (error) {
      console.error(`❌ Error auditing director ${director.id}:`, error);
    }
  }

  console.log('\n✅ Data quality audit finished');
}

main().catch(error => {
  console.error('❌ Fatal audit error:', error);
  process.exit(1);
});


/**
 * GLOBAL AUDIT: Directors ↔ Univers ↔ Instances ↔ Resources
 *
 * Usage:
 *   node api/debug/audit-univers-database.js
 *
 * For every director (role "directeur"):
 *   - Load their ActiveUnivers record (if any)
 *   - List all univers instances tied to the director
 *   - Count resources (forms, lists, dashboards, reports) per univers & instance
 *   - Highlight duplicates (same title/name appearing multiple times per univers)
 *   - Report submissions without universInstanceId if detected
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

const RESOURCE_COLLECTIONS = [
  { key: 'forms', label: 'Forms', titleField: 'title' },
  { key: 'lists', label: 'Lists', titleField: 'name' },
  { key: 'dashboards', label: 'Dashboards', titleField: 'name' },
  { key: 'reports', label: 'Reports', titleField: 'name' }
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

async function getUniversById(universId) {
  if (!universId) return null;
  const doc = await adminDb.collection('univers').doc(universId).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function getInstancesForDirector(directorId) {
  const snapshot = await adminDb
    .collection('universInstances')
    .where('directorId', '==', directorId)
    .get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function getResourcesForUnivers(universId, agencyId) {
  const summary = {};

  for (const resource of RESOURCE_COLLECTIONS) {
    const snapshot = await adminDb.collection(resource.key).where('universId', '==', universId).get();
    const docs = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(doc => !agencyId || doc.agencyId === agencyId);

    const perInstance = new Map();
    const duplicates = new Map();
    docs.forEach(doc => {
      const instanceKey = doc.universInstanceId || 'NO_INSTANCE';
      if (!perInstance.has(instanceKey)) {
        perInstance.set(instanceKey, []);
      }
      perInstance.get(instanceKey).push(doc);

      const title = doc[resource.titleField] || 'Sans titre';
      const key = `${title}::${resource.key}`;
      duplicates.set(key, (duplicates.get(key) || 0) + 1);
    });

    const duplicateList = Array.from(duplicates.entries())
      .filter(([, count]) => count > 1)
      .map(([dupKey, count]) => {
        const title = dupKey.split('::')[0];
        return { title, count };
      });

    summary[resource.key] = {
      total: docs.length,
      perInstance,
      duplicateList
    };
  }

  return summary;
}

async function auditDirector(director) {
  console.log('='.repeat(110));
  console.log(`👤 Director: ${director.name || director.email || director.id}`);
  console.log(`   ID: ${director.id}`);
  console.log(`   Agency: ${director.agencyId || 'N/A'}`);

  const activeUnivers = await getActiveUniversDoc(director.id);
  if (!activeUnivers) {
    console.log('   ⚠️ No activeUnivers document');
  } else {
    console.log('   Active univers record:');
    console.log(`      universId: ${activeUnivers.activeUniversId || 'N/A'}`);
    console.log(`      instanceId: ${activeUnivers.activeInstanceId || 'N/A'}`);
    console.log(`      updatedAt: ${iso(activeUnivers.updatedAt)}`);
  }

  const instances = await getInstancesForDirector(director.id);
  if (instances.length === 0) {
    console.log('   ⚠️ No univers instances for this director');
    return;
  }

  const universMap = new Map();
  instances.forEach(instance => {
    const universId = instance.universId;
    if (!universMap.has(universId)) {
      universMap.set(universId, []);
    }
    universMap.get(universId).push(instance);
  });

  for (const [universId, instanceList] of universMap.entries()) {
    const univers = await getUniversById(universId);
    console.log('\n   📦 Univers:', univers?.metadata?.name || univers?.name || universId);
    console.log(`      universId: ${universId}`);
    console.log(`      Template forms: ${univers?.definitions?.forms?.length || 0}`);
    console.log(`      Template dashboards: ${univers?.definitions?.dashboards?.length || 0}`);
    console.log(`      Template lists: ${univers?.definitions?.lists?.length || 0}`);
    console.log(`      Template reports: ${univers?.definitions?.reports?.length || 0}`);

    console.log('      Instances:');
    instanceList.forEach(instance => {
      console.log(`         - ${instance.id} (createdAt: ${iso(instance.createdAt)})`);
      console.log(`            resources metadata: ${JSON.stringify(instance.resources || instance.instances || {})}`);
    });

    const resourceSummary = await getResourcesForUnivers(universId, director.agencyId);

    for (const resource of RESOURCE_COLLECTIONS) {
      const resourceInfo = resourceSummary[resource.key];
      console.log(`      ${resource.label}: total=${resourceInfo.total}`);
      resourceInfo.perInstance.forEach((docs, instanceKey) => {
        const label = instanceKey === 'NO_INSTANCE' ? 'NO_INSTANCE' : instanceKey;
        console.log(`         • ${label}: ${docs.length}`);
      });
      if (resourceInfo.duplicateList.length > 0) {
        console.log('         ⚠️ Duplicates:');
        resourceInfo.duplicateList.forEach(dup => {
          console.log(`            - ${dup.title}: ${dup.count}`);
        });
      }
      if (!resourceInfo.perInstance.has('NO_INSTANCE')) {
        continue;
      }
      const withoutInstance = resourceInfo.perInstance.get('NO_INSTANCE');
      if (withoutInstance?.length > 0) {
        console.log(`         ❌ ${withoutInstance.length} item(s) missing universInstanceId`);
      }
    }
  }
}

async function main() {
  const directors = await getDirectors();
  console.log(`Found ${directors.length} director(s)`);
  for (const director of directors) {
    try {
      await auditDirector(director);
    } catch (error) {
      console.error(`❌ Error auditing director ${director.id}:`, error.message);
    }
  }
  console.log('\n✅ Global audit finished');
}

main().catch(error => {
  console.error('❌ Fatal error during audit:', error);
  process.exit(1);
});


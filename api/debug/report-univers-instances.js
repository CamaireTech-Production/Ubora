/**
 * UNIVERS INSTANCE REPORT
 *
 * For every director (role = 'directeur'):
 *  - List all univers instances linked to the user (via userId on instance).
 *  - For each instance, show the univers template info, resource references,
 *    and the resolved resource documents (names + IDs).
 *  - Compare template definitions with instantiated resources to highlight
 *    missing or extra items.
 *
 * Usage:
 *   node api/debug/report-univers-instances.js
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

const RESOURCE_TYPES = [
  { key: 'forms', collection: 'forms', titleField: 'title' },
  { key: 'lists', collection: 'lists', titleField: 'name' },
  { key: 'dashboards', collection: 'dashboards', titleField: 'name' },
  { key: 'reports', collection: 'reports', titleField: 'name' },
  { key: 'instructions', collection: 'scheduledQuestions', titleField: 'title' }
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

async function getInstancesByUser(userId) {
  const snapshot = await adminDb
    .collection('universInstances')
    .where('userId', '==', userId)
    .get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function getUnivers(universId) {
  if (!universId) return null;
  const doc = await adminDb.collection('univers').doc(universId).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function fetchResourceDocs(ids, collection) {
  if (!ids || ids.length === 0) return [];
  const results = [];
  for (const id of ids) {
    try {
      const doc = await adminDb.collection(collection).doc(id).get();
      if (doc.exists) {
        results.push({ id: doc.id, ...doc.data() });
      } else {
        results.push({ id, missing: true });
      }
    } catch (error) {
      results.push({ id, missing: true, error: error.message });
    }
  }
  return results;
}

function extractDefinitionInfo(univers, key, titleField) {
  const defs = univers?.definitions?.[key] || [];
  return defs.map(def => ({
    id: def.id || def.formId || def.listId || def.dashboardId || def.reportId || def.instructionId || '(unknown)',
    title: def[titleField] || def.title || def.name || '(sans titre)'
  }));
}

function formatResourceList(items, titleField) {
  return items
    .map(item => {
      if (item.missing) {
        return `${item[titleField] || '?'} (${item.id}) [MISSING]`;
      }
      return `${item[titleField] || item.title || item.name || '(sans titre)'} (${item.id})`;
    })
    .join(' | ') || '(none)';
}

async function reportInstance(director, instance) {
  const univers = await getUnivers(instance.universId);
  console.log('  ---------------------------------------------------------------------------');
  console.log(`  Instance: ${instance.id}`);
  console.log(`    Univers: ${univers?.metadata?.name || univers?.name || univers?.id || 'N/A'}`);
  console.log(`    Version: ${univers?.metadata?.version || univers?.version || 'N/A'} | Instance version: ${instance.universVersion || 'N/A'}`);
  console.log(`    CreatedAt: ${iso(instance.createdAt)} | UpdatedAt: ${iso(instance.updatedAt)} | Active: ${instance.isActive}`);
  console.log(`    Marketplace: ${instance.metadata?.isFromMarketplace ? 'yes' : 'no'} | Purchase: ${iso(instance.metadata?.purchaseDate)}`);

  for (const resource of RESOURCE_TYPES) {
    const definitionInfo = extractDefinitionInfo(univers, resource.key, resource.titleField);
    const instanceIds = instance.instances?.[resource.key] || [];
    const docs = await fetchResourceDocs(instanceIds, resource.collection);

    console.log(`    ${resource.key.toUpperCase()}:`);
    console.log(`      Template definitions (${definitionInfo.length}): ${definitionInfo.map(d => `${d.title} (${d.id})`).join(' | ') || '(none)'}`);
    console.log(`      Instance refs (${instanceIds.length}): ${instanceIds.join(', ') || '(none)'}`);
    console.log(`      Resolved docs (${docs.length}): ${formatResourceList(docs, resource.titleField)}`);

    const missingDocs = instanceIds.filter(id => !docs.some(doc => doc.id === id && !doc.missing));
    if (missingDocs.length > 0) {
      console.log(`      ⚠️ Missing documents for IDs: ${missingDocs.join(', ')}`);
    }

    const extraDocs = docs.filter(doc => !instanceIds.includes(doc.id) && !doc.missing);
    if (extraDocs.length > 0) {
      console.log(`      ⚠️ Extra docs not listed in instance: ${extraDocs.map(doc => doc.id).join(', ')}`);
    }
  }
}

async function main() {
  const directors = await getDirectors();
  console.log(`Total directors: ${directors.length}\n`);

  for (const director of directors) {
    console.log('==============================================================================');
    console.log(`Director: ${director.name || director.email || director.id}`);
    console.log(`  ID: ${director.id}`);
    console.log(`  Email: ${director.email || 'N/A'}`);
    console.log(`  Agency: ${director.agencyId || 'N/A'}`);

    const instances = await getInstancesByUser(director.id);
    if (instances.length === 0) {
      console.log('  ⚠️ No univers instances for this user');
      continue;
    }

    for (const instance of instances) {
      await reportInstance(director, instance);
    }
  }

  console.log('\n✅ Instance report completed');
}

main().catch(error => {
  console.error('❌ Failed to generate report:', error);
  process.exit(1);
});


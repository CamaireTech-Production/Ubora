/**
 * Analyze resource duplication across Univers instances.
 *
 * For each univers template:
 *   - Aggregate all resource IDs (forms/lists/dashboards/reports/instructions)
 *     across every instance.
 *   - Group by template definition title/name and count how many distinct IDs exist.
 *   - Highlight resources linked to missing instances.
 *
 * Usage:
 *   node api/debug/analyze-univers-duplicates.js
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

async function getAllUnivers() {
  const snapshot = await adminDb.collection('univers').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function getAllInstances() {
  const snapshot = await adminDb.collection('universInstances').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function fetchResourceById(collection, id) {
  const doc = await adminDb.collection(collection).doc(id).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function analyzeResourceType(univers, instances, resourceType) {
  const templateDefs = univers.definitions?.[resourceType.key] || [];
  if (templateDefs.length === 0) return null;

  const countsByTitle = new Map();
  const idsByTitle = new Map();
  const orphanResources = [];

  for (const instance of instances) {
    const ids = instance.instances?.[resourceType.key] || [];
    for (const id of ids) {
      const title = await fetchResourceTitle(resourceType, id);
      const key = title || '(sans titre)';
      countsByTitle.set(key, (countsByTitle.get(key) || 0) + 1);
      if (!idsByTitle.has(key)) idsByTitle.set(key, new Set());
      idsByTitle.get(key).add(id);
    }
  }

  const templateTitles = templateDefs.map(def => def[resourceType.titleField] || def.title || def.name || '(sans titre)');
  const report = [];

  for (const title of templateTitles) {
    const idsSet = idsByTitle.get(title) || new Set();
    if (idsSet.size > 1) {
      report.push({
        title,
        count: idsSet.size,
        ids: Array.from(idsSet)
      });
    }
  }

  // Identify resources attached to this univers but to instances from other univers (or missing)
  for (const instance of instances) {
    const ids = instance.instances?.[resourceType.key] || [];
    for (const id of ids) {
      const exists = await fetchResourceById(resourceType.collection, id);
      if (!exists) {
        orphanResources.push({ id, instanceId: instance.id });
      }
    }
  }

  if (report.length === 0 && orphanResources.length === 0) {
    return null;
  }

  return {
    templateCount: templateDefs.length,
    duplicates: report,
    orphanResources
  };
}

const resourceTitleCache = new Map();
async function fetchResourceTitle(resourceType, id) {
  const cacheKey = `${resourceType.collection}:${id}`;
  if (resourceTitleCache.has(cacheKey)) {
    return resourceTitleCache.get(cacheKey);
  }
  const doc = await fetchResourceById(resourceType.collection, id);
  const title = doc?.[resourceType.titleField] || doc?.title || doc?.name || '(sans titre)';
  resourceTitleCache.set(cacheKey, title);
  return title;
}

async function main() {
  const universList = await getAllUnivers();
  const instances = await getAllInstances();

  console.log(`Total univers: ${universList.length}`);
  console.log(`Total instances: ${instances.length}\n`);

  for (const univers of universList) {
    const relatedInstances = instances.filter(inst => inst.universId === univers.id);
    if (relatedInstances.length === 0) continue;

    console.log('='.repeat(120));
    console.log(`Univers: ${univers.metadata?.name || univers.name || univers.id} (${univers.id})`);
    console.log(`  Template version: ${univers.metadata?.version || univers.version || 'N/A'}`);
    console.log(`  Instances count: ${relatedInstances.length}`);

    for (const resourceType of RESOURCE_TYPES) {
      const analysis = await analyzeResourceType(univers, relatedInstances, resourceType);
      if (!analysis) continue;

      console.log(`  ▶ ${resourceType.key.toUpperCase()}`);
      console.log(`     Template definitions: ${analysis.templateCount}`);
      if (analysis.duplicates.length > 0) {
        console.log('     ⚠️ Duplicate titles:');
        analysis.duplicates.forEach(dup => {
          console.log(`        - ${dup.title}: ${dup.count} IDs -> ${dup.ids.join(', ')}`);
        });
      }
      if (analysis.orphanResources.length > 0) {
        console.log('     ❌ Resources referencing missing docs:');
        analysis.orphanResources.forEach(orphan => {
          console.log(`        - ${orphan.id} (instance ${orphan.instanceId})`);
        });
      }
    }
  }

  console.log('\n✅ Duplicate analysis completed');
}

main().catch(error => {
  console.error('❌ Duplicate analysis failed:', error);
  process.exit(1);
});


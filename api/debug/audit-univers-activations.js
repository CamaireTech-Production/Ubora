/**
 * AUDIT SCRIPT: Univers Activation Duplication Check
 *
 * Usage:
 *   node api/debug/audit-univers-activations.js <directorId> <agencyId>
 *
 * The script will:
 * 1. Load the director's ActiveUnivers record.
 * 2. Fetch the univers template to compare definition counts.
 * 3. List every univers instance tied to that director/univers.
 * 4. Group forms by universInstanceId (and orphan forms without instance).
 * 5. Highlight potential duplicates (same form title repeated across instances).
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

function formatDate(value) {
  if (!value) return 'N/A';
  if (value.toDate) return value.toDate().toISOString();
  return new Date(value).toISOString();
}

async function getActiveUnivers(directorId) {
  const doc = await adminDb.collection('activeUnivers').doc(directorId).get();
  return doc.exists ? doc.data() : null;
}

async function getUnivers(universId) {
  if (!universId) return null;
  const doc = await adminDb.collection('univers').doc(universId).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function getInstances(universId, directorId) {
  if (!universId) return [];
  const snapshot = await adminDb
    .collection('universInstances')
    .where('universId', '==', universId)
    .where('directorId', '==', directorId)
    .get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function getForms(universId, agencyId) {
  const snapshot = await adminDb
    .collection('forms')
    .where('universId', '==', universId)
    .where('agencyId', '==', agencyId)
    .get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

function groupFormsByInstance(forms) {
  const grouped = new Map();
  forms.forEach(form => {
    const key = form.universInstanceId || 'NO_INSTANCE';
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(form);
  });
  return grouped;
}

function analyzeDuplicates(forms) {
  const counts = new Map();
  forms.forEach(form => {
    const title = form.title || 'Sans titre';
    counts.set(title, (counts.get(title) || 0) + 1);
  });
  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([title, count]) => ({ title, count }));
}

async function main() {
  const directorId = process.argv[2];
  const agencyId = process.argv[3];

  if (!directorId || !agencyId) {
    console.error('Usage: node api/debug/audit-univers-activations.js <directorId> <agencyId>');
    process.exit(1);
  }

  console.log('🔍 Univers Activation Audit');
  console.log(`👤 Director: ${directorId}`);
  console.log(`🏢 Agency: ${agencyId}\n`);

  const activeUnivers = await getActiveUnivers(directorId);
  if (!activeUnivers) {
    console.error('❌ No active univers record for this director.');
    process.exit(1);
  }

  console.log('📌 ActiveUnivers Document:');
  console.log(`   universId: ${activeUnivers.activeUniversId || 'N/A'}`);
  console.log(`   instanceId: ${activeUnivers.activeInstanceId || 'N/A'}`);
  console.log(`   updatedAt: ${formatDate(activeUnivers.updatedAt)}\n`);

  const univers = await getUnivers(activeUnivers.activeUniversId);
  if (!univers) {
    console.error('❌ Univers document missing.');
    process.exit(1);
  }

  const templateForms = univers.definitions?.forms || [];
  console.log('🗂 Univers Template:');
  console.log(`   Name: ${univers.metadata?.name || univers.name || 'N/A'}`);
  console.log(`   Template forms defined: ${templateForms.length}`);
  console.log(`   Template dashboards: ${univers.definitions?.dashboards?.length || 0}`);
  console.log(`   Template lists: ${univers.definitions?.lists?.length || 0}\n`);

  const instances = await getInstances(univers.id, directorId);
  console.log(`📦 Univers Instances for director: ${instances.length}`);
  instances.forEach(instance => {
    console.log(`   - ${instance.id} (createdAt: ${formatDate(instance.createdAt)}) resources:`, instance.resources || instance.instances || {});
  });
  console.log('');

  const forms = await getForms(univers.id, agencyId);
  console.log(`📄 Total forms linked to univers: ${forms.length}`);

  const grouped = groupFormsByInstance(forms);
  grouped.forEach((formsList, key) => {
    const label = key === 'NO_INSTANCE' ? '❌ No universInstanceId' : key;
    console.log(`\n   ▶ Instance ${label} -> ${formsList.length} form(s)`);
    formsList.forEach(form => {
      console.log(`      - ${form.title || 'Sans titre'} (${form.id}) assignedTo=${form.assignedTo ? JSON.stringify(form.assignedTo) : '[]'}`);
    });
  });

  const duplicateTitles = analyzeDuplicates(forms);
  if (duplicateTitles.length > 0) {
    console.log('\n⚠️ Potential duplicates (same title count > 1):');
    duplicateTitles.forEach(dup => {
      console.log(`   - ${dup.title}: ${dup.count} forms`);
    });
  } else {
    console.log('\n✅ No duplicate form titles detected.');
  }

  const orphanForms = grouped.get('NO_INSTANCE') || [];
  if (orphanForms.length > 0) {
    console.log(`\n❌ Forms missing universInstanceId: ${orphanForms.length}`);
  } else {
    console.log('\n✅ All forms reference a univers instance.');
  }

  console.log('\n✅ Audit complete.');
}

main().catch(error => {
  console.error('❌ Audit failed:', error);
  process.exit(1);
});


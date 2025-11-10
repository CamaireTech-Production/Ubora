/**
 * Seed script for stock management table metric testing
 * Creates Products list, Physical Stock form, Movement form, and test data
 * 
 * Usage: node scripts/seed-stocks.js [directorId] [agencyId]
 * If no arguments provided, will prompt for them
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import readline from 'readline';

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
const Timestamp = admin.firestore.Timestamp;

// Helper to prompt for input
function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// Get active Univers for director
async function getActiveUnivers(directorId, agencyId) {
  try {
    const activeUniversSnapshot = await db.collection('activeUnivers')
      .where('directorId', '==', directorId)
      .where('agencyId', '==', agencyId)
      .limit(1)
      .get();
    
    if (activeUniversSnapshot.empty) {
      console.log('⚠️  No active Univers found. Will create resources without Univers association.');
      return null;
    }
    
    const activeUnivers = activeUniversSnapshot.docs[0].data();
    return activeUnivers.activeUniversId || null;
  } catch (error) {
    console.error('Error getting active Univers:', error);
    return null;
  }
}

// Create Products list
async function createProductsList(directorId, agencyId, universId) {
  console.log('📦 Creating Products list...');
  
  const productsList = {
    name: 'Produits',
    description: 'Liste des produits pour la gestion des stocks',
    columns: [
      { id: 'id', name: 'ID', type: 'text' },
      { id: 'name', name: 'Nom', type: 'text' },
      { id: 'sku', name: 'Référence', type: 'text' }
    ],
    rows: [
      { id: 'prod1', name: 'Produit A', sku: 'PROD-A-001' },
      { id: 'prod2', name: 'Produit B', sku: 'PROD-B-002' },
      { id: 'prod3', name: 'Produit C', sku: 'PROD-C-003' },
      { id: 'prod4', name: 'Produit D', sku: 'PROD-D-004' },
      { id: 'prod5', name: 'Produit E', sku: 'PROD-E-005' },
      { id: 'prod6', name: 'Produit F', sku: 'PROD-F-006' },
      { id: 'prod7', name: 'Produit G', sku: 'PROD-G-007' },
      { id: 'prod8', name: 'Produit H', sku: 'PROD-H-008' },
      { id: 'prod9', name: 'Produit I', sku: 'PROD-I-009' },
      { id: 'prod10', name: 'Produit J', sku: 'PROD-J-010' }
    ],
    createdBy: directorId,
    createdByRole: 'directeur',
    agencyId: agencyId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    universId: universId || null,
    universInstanceId: null,
    fromUnivers: universId ? true : false
  };
  
  const listRef = await db.collection('lists').add(productsList);
  console.log(`✅ Products list created: ${listRef.id}`);
  return listRef.id;
}

// Create Physical Stock form
async function createPhysicalStockForm(directorId, agencyId, productsListId, universId) {
  console.log('📋 Creating Physical Stock form...');
  
  const form = {
    title: 'Stock Physique',
    description: 'Formulaire pour enregistrer le stock physique observé sur site',
    fields: [
      {
        id: 'product',
        label: 'Produit',
        type: 'select',
        required: true,
        listId: productsListId,
        options: []
      },
      {
        id: 'qty',
        label: 'Quantité observée',
        type: 'number',
        required: true,
        min: 0
      },
      {
        id: 'date',
        label: 'Date d\'observation',
        type: 'date',
        required: true
      },
      {
        id: 'notes',
        label: 'Notes (optionnel)',
        type: 'textarea',
        required: false
      }
    ],
    assignedTo: [directorId], // Assign to director
    createdBy: directorId,
    createdByRole: 'directeur',
    agencyId: agencyId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    universId: universId || null,
    universInstanceId: null,
    fromUnivers: universId ? true : false
  };
  
  const formRef = await db.collection('forms').add(form);
  console.log(`✅ Physical Stock form created: ${formRef.id}`);
  return { id: formRef.id, form };
}

// Create Movement form
async function createMovementForm(directorId, agencyId, productsListId, universId) {
  console.log('📋 Creating Movement form...');
  
  const form = {
    title: 'Mouvement de Stock',
    description: 'Formulaire pour enregistrer les entrées et sorties de stock',
    fields: [
      {
        id: 'product',
        label: 'Produit',
        type: 'select',
        required: true,
        listId: productsListId,
        options: []
      },
      {
        id: 'movementType',
        label: 'Type de mouvement',
        type: 'select',
        required: true,
        options: ['in', 'out']
      },
      {
        id: 'qty',
        label: 'Quantité',
        type: 'number',
        required: true,
        min: 0
      },
      {
        id: 'date',
        label: 'Date du mouvement',
        type: 'date',
        required: true
      },
      {
        id: 'reason',
        label: 'Raison (optionnel)',
        type: 'text',
        required: false
      }
    ],
    assignedTo: [directorId], // Assign to director
    createdBy: directorId,
    createdByRole: 'directeur',
    agencyId: agencyId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    universId: universId || null,
    universInstanceId: null,
    fromUnivers: universId ? true : false
  };
  
  const formRef = await db.collection('forms').add(form);
  console.log(`✅ Movement form created: ${formRef.id}`);
  return { id: formRef.id, form };
}

// Generate test submissions for 60 days
async function generateSubmissions(
  directorId,
  agencyId,
  productsListId,
  physicalStockFormId,
  movementFormId,
  physicalStockForm,
  movementForm
) {
  console.log('📊 Generating 60 days of test submissions...');
  
  const products = ['prod1', 'prod2', 'prod3', 'prod4', 'prod5', 'prod6', 'prod7', 'prod8', 'prod9', 'prod10'];
  const now = new Date();
  const submissions = [];
  
  // Generate physical stock submissions (one per product per day)
  for (let day = 0; day < 60; day++) {
    const date = new Date(now);
    date.setDate(date.getDate() - day);
    const dateStr = date.toISOString().split('T')[0];
    
    for (const productId of products) {
      // Base quantity with some variation
      const baseQty = 50 + Math.floor(Math.random() * 100);
      const variation = Math.floor(Math.random() * 20) - 10;
      const qty = Math.max(0, baseQty + variation);
      
      const submission = {
        formId: physicalStockFormId,
        userId: directorId,
        agencyId: agencyId,
        answers: {
          [physicalStockForm.fields.find(f => f.id === 'product').id]: productId,
          [physicalStockForm.fields.find(f => f.id === 'qty').id]: qty,
          [physicalStockForm.fields.find(f => f.id === 'date').id]: dateStr
        },
        submittedAt: Timestamp.fromDate(new Date(date.getTime() + 12 * 60 * 60 * 1000)), // Noon
        fileAttachments: []
      };
      
      submissions.push(submission);
    }
  }
  
  // Generate movement submissions (2-4 per product per day)
  for (let day = 0; day < 60; day++) {
    const date = new Date(now);
    date.setDate(date.getDate() - day);
    const dateStr = date.toISOString().split('T')[0];
    
    for (const productId of products) {
      const numMovements = 2 + Math.floor(Math.random() * 3); // 2-4 movements per day
      
      for (let m = 0; m < numMovements; m++) {
        const movementType = Math.random() > 0.4 ? 'in' : 'out'; // 60% in, 40% out
        const qty = 5 + Math.floor(Math.random() * 20); // 5-25 units
        
        const submission = {
          formId: movementFormId,
          userId: directorId,
          agencyId: agencyId,
          answers: {
            [movementForm.fields.find(f => f.id === 'product').id]: productId,
            [movementForm.fields.find(f => f.id === 'movementType').id]: movementType,
            [movementForm.fields.find(f => f.id === 'qty').id]: qty,
            [movementForm.fields.find(f => f.id === 'date').id]: dateStr
          },
          submittedAt: Timestamp.fromDate(new Date(date.getTime() + (8 + m * 2) * 60 * 60 * 1000)), // Spread throughout day
          fileAttachments: []
        };
        
        submissions.push(submission);
      }
    }
  }
  
  // Batch insert submissions (Firestore limit is 500 per batch)
  const batchSize = 500;
  let inserted = 0;
  
  for (let i = 0; i < submissions.length; i += batchSize) {
    const batch = db.batch();
    const batchSubmissions = submissions.slice(i, i + batchSize);
    
    for (const submission of batchSubmissions) {
      const ref = db.collection('formEntries').doc();
      batch.set(ref, submission);
    }
    
    await batch.commit();
    inserted += batchSubmissions.length;
    console.log(`  ✅ Inserted ${inserted}/${submissions.length} submissions...`);
  }
  
  console.log(`✅ Generated ${submissions.length} submissions (${60 * products.length} physical stock + ${submissions.length - 60 * products.length} movements)`);
  return submissions.length;
}

// Create demo dashboard with stock table metric
async function createStockDashboard(
  directorId,
  agencyId,
  productsListId,
  physicalStockFormId,
  movementFormId,
  physicalStockForm,
  movementForm,
  universId
) {
  console.log('📊 Creating demo dashboard with stock table metric...');
  
  const productFieldPhysical = physicalStockForm.fields.find(f => f.id === 'product');
  const qtyFieldPhysical = physicalStockForm.fields.find(f => f.id === 'qty');
  const productFieldMovement = movementForm.fields.find(f => f.id === 'product');
  const qtyFieldMovement = movementForm.fields.find(f => f.id === 'qty');
  const movementTypeField = movementForm.fields.find(f => f.id === 'movementType');
  
  const dashboard = {
    name: 'Tableau de Bord - Gestion des Stocks',
    description: 'Dashboard de démonstration pour la gestion des stocks avec table métrique',
    metrics: [
      {
        id: `metric_${Date.now()}`,
        name: 'Gestion des stocks',
        description: 'Tableau de gestion des stocks avec calculs automatiques',
        sourceType: 'field',
        metricType: 'table',
        fieldType: 'text',
        calculationType: 'count',
        tableConfig: {
          rowSource: {
            type: 'list',
            listId: productsListId,
            keyFieldId: 'id',
            labelFieldId: 'name'
          },
          columns: [
            {
              id: 'col_name',
              type: 'label',
              name: 'Produit',
              source: 'list',
              labelFieldId: 'name'
            },
            {
              id: 'col_initial',
              type: 'aggregate',
              name: 'Stock initial',
              formId: physicalStockFormId,
              rowKeyFieldId: productFieldPhysical.id,
              valueFieldId: qtyFieldPhysical.id,
              agg: 'latest'
            },
            {
              id: 'col_in',
              type: 'aggregate',
              name: 'Entrées',
              formId: movementFormId,
              rowKeyFieldId: productFieldMovement.id,
              valueFieldId: qtyFieldMovement.id,
              agg: 'sum',
              filters: [{
                fieldId: movementTypeField.id,
                op: 'eq',
                value: 'in'
              }]
            },
            {
              id: 'col_out',
              type: 'aggregate',
              name: 'Sorties',
              formId: movementFormId,
              rowKeyFieldId: productFieldMovement.id,
              valueFieldId: qtyFieldMovement.id,
              agg: 'sum',
              filters: [{
                fieldId: movementTypeField.id,
                op: 'eq',
                value: 'out'
              }]
            },
            {
              id: 'col_end',
              type: 'derived',
              name: 'Stock théorique',
              formula: 'col_initial + col_in - col_out'
            },
            {
              id: 'col_physical',
              type: 'aggregate',
              name: 'Physique',
              formId: physicalStockFormId,
              rowKeyFieldId: productFieldPhysical.id,
              valueFieldId: qtyFieldPhysical.id,
              agg: 'latest'
            },
            {
              id: 'col_variance',
              type: 'derived',
              name: 'Écart',
              formula: 'col_physical - col_end'
            }
          ],
          emptyRows: 'show'
        },
        createdAt: Timestamp.now(),
        createdBy: directorId,
        agencyId: agencyId
      }
    ],
    createdBy: directorId,
    agencyId: agencyId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    universId: universId || null,
    universInstanceId: null,
    fromUnivers: universId ? true : false
  };
  
  const dashboardRef = await db.collection('dashboards').add(dashboard);
  console.log(`✅ Dashboard created: ${dashboardRef.id}`);
  return dashboardRef.id;
}

// Main function
async function main() {
  try {
    console.log('🌱 Stock Management Table Metric - Seed Script');
    console.log('==============================================\n');
    
    // Get director ID and agency ID
    let directorId = process.argv[2];
    let agencyId = process.argv[3];
    
    if (!directorId) {
      directorId = await prompt('Enter director ID: ');
    }
    if (!agencyId) {
      agencyId = await prompt('Enter agency ID: ');
    }
    
    if (!directorId || !agencyId) {
      console.error('❌ Director ID and Agency ID are required');
      process.exit(1);
    }
    
    console.log(`\n📋 Director ID: ${directorId}`);
    console.log(`📋 Agency ID: ${agencyId}\n`);
    
    // Get active Univers
    const universId = await getActiveUnivers(directorId, agencyId);
    if (universId) {
      console.log(`✅ Active Univers found: ${universId}\n`);
    } else {
      console.log('⚠️  No active Univers found. Resources will be created without Univers association.\n');
    }
    
    // Check if migration already ran
    const migrationKey = `seed-stocks-v1-${directorId}-${agencyId}`;
    const migrationRef = db.collection('migrations').doc(migrationKey);
    const migrationDoc = await migrationRef.get();
    
    if (migrationDoc.exists && migrationDoc.data().done) {
      console.log('⚠️  Migration already completed. Use --force to re-run.');
      const force = process.argv.includes('--force');
      if (!force) {
        console.log('   To re-run, use: node scripts/seed-stocks.js [directorId] [agencyId] --force');
        process.exit(0);
      }
      console.log('   Force flag detected, re-running migration...\n');
    }
    
    // Create Products list
    const productsListId = await createProductsList(directorId, agencyId, universId);
    
    // Create forms
    const physicalStockForm = await createPhysicalStockForm(directorId, agencyId, productsListId, universId);
    const movementForm = await createMovementForm(directorId, agencyId, productsListId, universId);
    
    // Generate submissions
    await generateSubmissions(
      directorId,
      agencyId,
      productsListId,
      physicalStockForm.id,
      movementForm.id,
      physicalStockForm.form,
      movementForm.form
    );
    
    // Create dashboard
    const dashboardId = await createStockDashboard(
      directorId,
      agencyId,
      productsListId,
      physicalStockForm.id,
      movementForm.id,
      physicalStockForm.form,
      movementForm.form,
      universId
    );
    
    // Update Univers document to include forms and dashboards in definitions
    if (universId) {
      const universRef = db.collection('univers').doc(universId);
      const universDoc = await universRef.get();
      
      if (universDoc.exists) {
        const universData = universDoc.data();
        const currentForms = universData.definitions?.forms || [];
        const currentDashboards = universData.definitions?.dashboards || [];
        const currentLists = universData.definitions?.lists || [];
        
        // Check if forms already exist in definitions
        const formIdsInDefinitions = new Set(currentForms.map(f => f.id));
        const dashboardIdsInDefinitions = new Set(currentDashboards.map(d => d.id));
        const listIdsInDefinitions = new Set(currentLists.map(l => l.id));
        
        // Prepare form definitions to add
        const formsToAdd = [];
        if (!formIdsInDefinitions.has(physicalStockForm.id)) {
          formsToAdd.push({
            id: physicalStockForm.id,
            title: physicalStockForm.form.title,
            description: physicalStockForm.form.description || '',
            fields: physicalStockForm.form.fields || []
          });
        }
        if (!formIdsInDefinitions.has(movementForm.id)) {
          formsToAdd.push({
            id: movementForm.id,
            title: movementForm.form.title,
            description: movementForm.form.description || '',
            fields: movementForm.form.fields || []
          });
        }
        
        // Get dashboard data to add to definitions
        const dashboardDoc = await db.collection('dashboards').doc(dashboardId).get();
        const dashboardData = dashboardDoc.exists ? dashboardDoc.data() : null;
        
        const dashboardsToAdd = [];
        if (dashboardData && !dashboardIdsInDefinitions.has(dashboardId)) {
          dashboardsToAdd.push({
            id: dashboardId,
            name: dashboardData.name || '',
            description: dashboardData.description || '',
            metrics: dashboardData.metrics || []
          });
        }
        
        // Get list data to add to definitions
        const listDoc = await db.collection('lists').doc(productsListId).get();
        const listData = listDoc.exists ? listDoc.data() : null;
        
        const listsToAdd = [];
        if (listData && !listIdsInDefinitions.has(productsListId)) {
          listsToAdd.push({
            id: productsListId,
            name: listData.name || '',
            columns: listData.columns || [],
            rows: listData.rows || []
          });
        }
        
        // Update Univers document if there are new items to add
        if (formsToAdd.length > 0 || dashboardsToAdd.length > 0 || listsToAdd.length > 0) {
          const updateData = {
            'definitions.forms': [...currentForms, ...formsToAdd],
            'definitions.dashboards': [...currentDashboards, ...dashboardsToAdd],
            'definitions.lists': [...currentLists, ...listsToAdd]
          };
          
          await universRef.update(updateData);
          console.log(`✅ Updated Univers document with ${formsToAdd.length} forms, ${dashboardsToAdd.length} dashboards, and ${listsToAdd.length} lists`);
        } else {
          console.log(`ℹ️  All items already exist in Univers definitions`);
        }
      } else {
        console.log(`⚠️  Univers document not found, skipping definitions update`);
      }
    }
    
    // Mark migration as done
    await migrationRef.set({
      done: true,
      completedAt: Timestamp.now(),
      directorId,
      agencyId,
      universId: universId || null,
      productsListId,
      physicalStockFormId: physicalStockForm.id,
      movementFormId: movementForm.id,
      dashboardId
    });
    
    console.log('\n✅ Seed script completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Products List ID: ${productsListId}`);
    console.log(`   - Physical Stock Form ID: ${physicalStockForm.id}`);
    console.log(`   - Movement Form ID: ${movementForm.id}`);
    console.log(`   - Dashboard ID: ${dashboardId}`);
    console.log('\n💡 Next steps:');
    console.log('   1. Go to the dashboard view in the app');
    console.log('   2. Select the "Tableau de Bord - Gestion des Stocks" dashboard');
    console.log('   3. Test the period filter (today, last 7 days, last 30 days, etc.)');
    console.log('   4. Verify that the table shows correct calculations');
    console.log('   5. Check that Initial Stock, Entries, Exits, Theoretical Stock, Physical, and Variance columns are correct');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error in seed script:', error);
    process.exit(1);
  }
}

main();


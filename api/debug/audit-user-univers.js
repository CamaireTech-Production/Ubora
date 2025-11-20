import admin from 'firebase-admin';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Script d'audit pour vérifier tous les univers et instances liés à un email utilisateur
 */

// Initialiser Firebase Admin avec le fichier JSON de service account
if (!admin.apps.length) {
  try {
    const serviceAccountPath = path.join(__dirname, '../../studio-gpnfx-firebase-adminsdk-fbsvc-1a70f129c6.json');
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });
    console.log('✅ Firebase Admin initialisé avec le fichier de service account\n');
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation de Firebase Admin:', error);
    process.exit(1);
  }
}

const adminDb = admin.firestore();
const USER_EMAIL = 'Uboraarcha@gmail.com';

async function auditUserUnivers(email) {
  console.log('\n🔍 === AUDIT DES UNIVERS ET INSTANCES ===');
  console.log(`📧 Email: ${email}\n`);

  try {
    // 1. Trouver l'utilisateur par email dans Firestore
    console.log('1️⃣ Recherche de l\'utilisateur dans Firestore...');
    const usersSnapshot = await adminDb
      .collection('users')
      .where('email', '==', email.toLowerCase().trim())
      .get();

    if (usersSnapshot.empty) {
      console.log('❌ Aucun utilisateur trouvé avec cet email dans Firestore');
      return;
    }

    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();
    const userId = userDoc.id;
    const agencyId = userData.agencyId || 'N/A';

    console.log(`✅ Utilisateur trouvé:`);
    console.log(`   - ID: ${userId}`);
    console.log(`   - Nom: ${userData.name || 'N/A'}`);
    console.log(`   - Email: ${userData.email || 'N/A'}`);
    console.log(`   - Rôle: ${userData.role || 'N/A'}`);
    console.log(`   - Agence ID: ${agencyId}\n`);

    // 2. Trouver tous les univers créés par cet utilisateur
    console.log('2️⃣ Recherche des univers créés par l\'utilisateur...');
    const universCreatedSnapshot = await adminDb
      .collection('univers')
      .where('ownership.createdBy', '==', userId)
      .get();

    const universCreated = [];
    universCreatedSnapshot.forEach(doc => {
      const data = doc.data();
      universCreated.push({
        id: doc.id,
        name: data.metadata?.name || 'Sans nom',
        version: data.metadata?.version || 1,
        isMarketplace: data.ownership?.isMarketplaceTemplate || false,
        createdAt: data.metadata?.createdAt?.toDate?.() || 'N/A',
        agencyId: data.ownership?.agencyId || 'N/A'
      });
    });

    console.log(`✅ ${universCreated.length} univers créé(s):`);
    universCreated.forEach((u, idx) => {
      console.log(`   ${idx + 1}. ${u.name} (ID: ${u.id})`);
      console.log(`      - Version: ${u.version}`);
      console.log(`      - Marketplace: ${u.isMarketplace ? 'Oui' : 'Non'}`);
      console.log(`      - Créé le: ${u.createdAt}`);
      console.log(`      - Agence: ${u.agencyId}`);
    });
    console.log('');

    // 3. Trouver toutes les instances créées par cet utilisateur
    console.log('3️⃣ Recherche des instances créées par l\'utilisateur...');
    const instancesSnapshot = await adminDb
      .collection('universInstances')
      .where('userId', '==', userId)
      .get();

    const instances = [];
    instancesSnapshot.forEach(doc => {
      const data = doc.data();
      instances.push({
        id: doc.id,
        universId: data.universId || 'N/A',
        universName: data.metadata?.universName || 'N/A',
        universVersion: data.universVersion || data.metadata?.universVersion || 'N/A',
        isActive: data.isActive || false,
        isFromMarketplace: data.metadata?.isFromMarketplace || false,
        createdAt: data.createdAt?.toDate?.() || 'N/A',
        agencyId: data.agencyId || 'N/A',
        resources: {
          forms: data.instances?.forms?.length || 0,
          dashboards: data.instances?.dashboards?.length || 0,
          instructions: data.instances?.instructions?.length || 0,
          lists: data.instances?.lists?.length || 0,
          reports: data.instances?.reports?.length || 0
        }
      });
    });

    console.log(`✅ ${instances.length} instance(s) trouvée(s):`);
    instances.forEach((inst, idx) => {
      console.log(`   ${idx + 1}. Instance ${inst.id}`);
      console.log(`      - Univers: ${inst.universName} (ID: ${inst.universId})`);
      console.log(`      - Version: ${inst.universVersion}`);
      console.log(`      - Actif: ${inst.isActive ? 'Oui' : 'Non'}`);
      console.log(`      - Marketplace: ${inst.isFromMarketplace ? 'Oui' : 'Non'}`);
      console.log(`      - Créé le: ${inst.createdAt}`);
      console.log(`      - Agence: ${inst.agencyId}`);
      console.log(`      - Ressources: ${inst.resources.forms} formulaires, ${inst.resources.dashboards} tableaux, ${inst.resources.instructions} instructions, ${inst.resources.lists} listes, ${inst.resources.reports} rapports`);
    });
    console.log('');

    // 4. Trouver les univers achetés (marketplace)
    console.log('4️⃣ Recherche des univers achetés (marketplace)...');
    const purchasesSnapshot = await adminDb
      .collection('universPurchases')
      .where('userId', '==', userId)
      .get();

    const purchases = [];
    purchasesSnapshot.forEach(doc => {
      const data = doc.data();
      purchases.push({
        id: doc.id,
        universId: data.universId || 'N/A',
        purchaseDate: data.purchaseDate?.toDate?.() || 'N/A',
        amountPaid: data.amountPaid || 0,
        currency: data.currency || 'FCFA',
        paymentId: data.paymentId || 'N/A'
      });
    });

    console.log(`✅ ${purchases.length} achat(s) trouvé(s):`);
    purchases.forEach((p, idx) => {
      console.log(`   ${idx + 1}. Univers ID: ${p.universId}`);
      console.log(`      - Acheté le: ${p.purchaseDate}`);
      console.log(`      - Montant: ${p.amountPaid} ${p.currency}`);
      console.log(`      - Payment ID: ${p.paymentId}`);
    });
    console.log('');

    // 5. Trouver les univers actifs pour cet utilisateur (si directeur)
    if (userData.role === 'directeur' || userData.role === 'admin') {
      console.log('5️⃣ Recherche des univers actifs (si directeur)...');
      const activeUniversSnapshot = await adminDb
        .collection('activeUnivers')
        .where('directorId', '==', userId)
        .get();

      const activeUnivers = [];
      activeUniversSnapshot.forEach(doc => {
        const data = doc.data();
        activeUnivers.push({
          id: doc.id,
          universId: data.universId || 'N/A',
          instanceId: data.activeInstanceId || 'N/A',
          agencyId: data.agencyId || 'N/A',
          activatedAt: data.activatedAt?.toDate?.() || 'N/A'
        });
      });

      console.log(`✅ ${activeUnivers.length} univers actif(s):`);
      activeUnivers.forEach((au, idx) => {
        console.log(`   ${idx + 1}. Univers ID: ${au.universId}`);
        console.log(`      - Instance ID: ${au.instanceId}`);
        console.log(`      - Agence: ${au.agencyId}`);
        console.log(`      - Activé le: ${au.activatedAt}`);
      });
      console.log('');
    }

    // 6. Récupérer les détails des univers référencés dans les instances
    console.log('6️⃣ Récupération des détails des univers référencés...');
    const referencedUniversIds = new Set();
    instances.forEach(inst => {
      if (inst.universId && inst.universId !== 'N/A') {
        referencedUniversIds.add(inst.universId);
      }
    });
    purchases.forEach(p => {
      if (p.universId && p.universId !== 'N/A') {
        referencedUniversIds.add(p.universId);
      }
    });

    const universDetails = [];
    for (const universId of referencedUniversIds) {
      try {
        const universDoc = await adminDb.collection('univers').doc(universId).get();
        if (universDoc.exists) {
          const data = universDoc.data();
          universDetails.push({
            id: universId,
            name: data.metadata?.name || 'Sans nom',
            version: data.metadata?.version || 1,
            createdBy: data.ownership?.createdBy || 'N/A',
            isMarketplace: data.ownership?.isMarketplaceTemplate || false
          });
        }
      } catch (error) {
        console.log(`   ⚠️ Erreur lors de la récupération de l'univers ${universId}:`, error.message);
      }
    }

    console.log(`✅ ${universDetails.length} univers référencé(s) trouvé(s):`);
    universDetails.forEach((u, idx) => {
      console.log(`   ${idx + 1}. ${u.name} (ID: ${u.id})`);
      console.log(`      - Version: ${u.version}`);
      console.log(`      - Créé par: ${u.createdBy}`);
      console.log(`      - Marketplace: ${u.isMarketplace ? 'Oui' : 'Non'}`);
    });
    console.log('');

    // Résumé final
    console.log('\n📊 === RÉSUMÉ DE L\'AUDIT ===');
    console.log(`Utilisateur: ${userData.name || email} (${email})`);
    console.log(`- Univers créés: ${universCreated.length}`);
    console.log(`- Instances créées: ${instances.length}`);
    console.log(`- Univers achetés: ${purchases.length}`);
    if (userData.role === 'directeur' || userData.role === 'admin') {
      const activeUniversSnapshot = await adminDb
        .collection('activeUnivers')
        .where('directorId', '==', userId)
        .get();
      console.log(`- Univers actifs: ${activeUniversSnapshot.size}`);
    }
    console.log(`- Univers référencés: ${universDetails.length}`);
    console.log('\n✅ Audit terminé avec succès!\n');

  } catch (error) {
    console.error('❌ Erreur lors de l\'audit:', error);
    throw error;
  }
}

// Exécuter l'audit
auditUserUnivers(USER_EMAIL)
  .then(() => {
    console.log('✅ Script terminé');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });


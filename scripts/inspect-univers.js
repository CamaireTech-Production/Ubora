/**
 * Script pour inspecter tous les Univers dans Firestore
 * Affiche les détails de chaque Univers et le créateur associé
 */

import admin from 'firebase-admin';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialiser Firebase Admin
const serviceAccountPath = path.join(__dirname, '..', 'studio-gpnfx-firebase-adminsdk-fbsvc-49cf718bd7.json');

if (!existsSync(serviceAccountPath)) {
  console.error('❌ Fichier de service account introuvable:', serviceAccountPath);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccountPath)
});

const db = admin.firestore();

async function inspectUnivers() {
  try {
    console.log('🔍 Inspection des Univers dans Firestore...\n');
    
    // Récupérer tous les Univers
    const universSnapshot = await db.collection('univers').get();
    
    if (universSnapshot.empty) {
      console.log('❌ Aucun Univers trouvé dans Firestore');
      return;
    }
    
    console.log(`✅ ${universSnapshot.size} Univers trouvé(s)\n`);
    console.log('═'.repeat(100));
    
    // Récupérer les utilisateurs pour mapper les emails
    const usersSnapshot = await db.collection('users').get();
    const usersMap = new Map();
    usersSnapshot.forEach(doc => {
      usersMap.set(doc.id, doc.data());
    });
    
    // Parcourir chaque Univers
    for (const doc of universSnapshot.docs) {
      const univers = doc.data();
      const universId = doc.id;
      
      // Récupérer l'email du créateur
      const creatorId = univers.ownership?.createdBy;
      const creator = usersMap.get(creatorId);
      const creatorEmail = creator?.email || 'N/A';
      const creatorName = creator?.name || creator?.displayName || 'N/A';
      
      // Récupérer l'agence si disponible
      const agencyId = univers.ownership?.agencyId;
      let agencyName = 'N/A';
      if (agencyId) {
        try {
          const agencyDoc = await db.collection('agencies').doc(agencyId).get();
          if (agencyDoc.exists) {
            agencyName = agencyDoc.data().name || agencyId;
          }
        } catch (err) {
          // Ignorer les erreurs d'agence
        }
      }
      
      // Afficher les détails
      console.log(`\n📦 Univers ID: ${universId}`);
      console.log(`   Nom: ${univers.metadata?.name || 'N/A'}`);
      console.log(`   Version: ${univers.metadata?.version || 1}`);
      console.log(`   Créé le: ${univers.metadata?.createdAt?.toDate?.()?.toLocaleString('fr-FR') || 'N/A'}`);
      console.log(`   ──────────────────────────────────────────────────────────────────────────────`);
      console.log(`   👤 Créateur:`);
      console.log(`      - ID: ${creatorId || 'N/A'}`);
      console.log(`      - Email: ${creatorEmail}`);
      console.log(`      - Nom: ${creatorName}`);
      console.log(`   ──────────────────────────────────────────────────────────────────────────────`);
      console.log(`   🏢 Agence:`);
      console.log(`      - ID: ${agencyId || 'N/A'}`);
      console.log(`      - Nom: ${agencyName}`);
      console.log(`   ──────────────────────────────────────────────────────────────────────────────`);
      console.log(`   🌐 Marketplace:`);
      console.log(`      - Template: ${univers.ownership?.isMarketplaceTemplate ? '✅ Oui' : '❌ Non'}`);
      console.log(`      - Statut approbation: ${univers.ownership?.approvalStatus || 'N/A'}`);
      console.log(`      - Prix: ${univers.metadata?.price !== undefined ? `${univers.metadata.price} ${univers.metadata.currency || 'XAF'}` : 'N/A'}`);
      if (univers.ownership?.approvedBy) {
        const approver = usersMap.get(univers.ownership.approvedBy);
        console.log(`      - Approuvé par: ${approver?.email || univers.ownership.approvedBy}`);
      }
      if (univers.ownership?.approvedAt) {
        console.log(`      - Date approbation: ${univers.ownership.approvedAt.toDate?.()?.toLocaleString('fr-FR') || 'N/A'}`);
      }
      if (univers.ownership?.rejectionReason) {
        console.log(`      - Raison rejet: ${univers.ownership.rejectionReason}`);
      }
      console.log(`   ──────────────────────────────────────────────────────────────────────────────`);
      console.log(`   📊 Définitions:`);
      console.log(`      - Formulaires: ${univers.definitions?.forms?.length || 0}`);
      console.log(`      - Tableaux de bord: ${univers.definitions?.dashboards?.length || 0}`);
      console.log(`      - Instructions: ${univers.definitions?.instructions?.length || 0}`);
      console.log(`      - Listes: ${univers.definitions?.lists?.length || 0}`);
      console.log(`      - Rapports: ${univers.definitions?.reports?.length || 0}`);
      console.log(`   ──────────────────────────────────────────────────────────────────────────────`);
      console.log(`   📈 Utilisation:`);
      console.log(`      - Total usages: ${univers.usage?.totalUsages || 0}`);
      console.log(`      - Dernière utilisation: ${univers.usage?.lastUsedAt?.toDate?.()?.toLocaleString('fr-FR') || 'Jamais'}`);
      console.log(`   ──────────────────────────────────────────────────────────────────────────────`);
      
      // Vérifier les instances
      const instancesSnapshot = await db.collection('universInstances')
        .where('universId', '==', universId)
        .get();
      console.log(`   🔗 Instances: ${instancesSnapshot.size} instance(s) créée(s)`);
      
      // Vérifier si c'est un Univers par défaut
      if (univers.metadata?.isDefault) {
        console.log(`   ⭐ Univers par défaut: Oui`);
      }
      
      console.log('═'.repeat(100));
    }
    
    // Résumé
    console.log('\n📊 RÉSUMÉ:');
    console.log(`   Total Univers: ${universSnapshot.size}`);
    
    const marketplaceCount = universSnapshot.docs.filter(doc => 
      doc.data().ownership?.isMarketplaceTemplate === true
    ).length;
    console.log(`   Univers Marketplace: ${marketplaceCount}`);
    
    const pendingCount = universSnapshot.docs.filter(doc => 
      doc.data().ownership?.approvalStatus === 'pending'
    ).length;
    console.log(`   En attente d'approbation: ${pendingCount}`);
    
    const approvedCount = universSnapshot.docs.filter(doc => 
      doc.data().ownership?.approvalStatus === 'approved'
    ).length;
    console.log(`   Approuvés: ${approvedCount}`);
    
    const defaultCount = universSnapshot.docs.filter(doc => 
      doc.data().metadata?.isDefault === true
    ).length;
    console.log(`   Univers par défaut: ${defaultCount}`);
    
    console.log('\n✅ Inspection terminée');
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'inspection:', error);
    process.exit(1);
  }
}

// Exécuter le script
inspectUnivers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });


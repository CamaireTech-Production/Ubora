// Script pour mettre à jour les utilisateurs existants avec le package par défaut
// Ce script doit être exécuté une seule fois pour migrer les données existantes

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serviceAccount = JSON.parse(readFileSync(join(__dirname, '../studio-gpnfx-firebase-adminsdk-fbsvc-eed44532ba.json'), 'utf8'));

// Initialiser Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function updateExistingUsers() {
  try {
    console.log('🔄 Début de la mise à jour des utilisateurs existants...');
    
    // Récupérer tous les utilisateurs
    const usersSnapshot = await db.collection('users').get();
    
    if (usersSnapshot.empty) {
      console.log('✅ Aucun utilisateur trouvé dans la base de données.');
      return;
    }
    
    console.log(`📊 ${usersSnapshot.size} utilisateur(s) trouvé(s)`);
    
    const batch = db.batch();
    let updateCount = 0;
    
    usersSnapshot.forEach((doc) => {
      const userData = doc.data();
      
      // Vérifier si l'utilisateur n'a pas déjà le champ package
      if (!userData.package) {
        console.log(`📝 Mise à jour de l'utilisateur: ${userData.name || userData.email}`);
        
        // Assigner le package par défaut selon le rôle
        let defaultPackage = 'starter';
        
        // Seuls les directeurs ont des packages
        if (userData.role === 'directeur') {
          // Vérifier s'il a déjà des formulaires/dashboards pour déterminer le package
          // Pour l'instant, on met tous les directeurs en 'standard' par défaut
          defaultPackage = 'standard';
        } else {
          // Les employés n'ont pas de package
          console.log(`✅ Employé ${userData.name || userData.email} - pas de package assigné`);
          return;
        }
        
        batch.update(doc.ref, {
          package: defaultPackage,
          tokensUsedMonthly: 0,
          tokensResetDate: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        updateCount++;
      } else {
        // Vérifier si l'utilisateur a les champs tokens
        if (userData.tokensUsedMonthly === undefined || userData.tokensResetDate === undefined) {
          console.log(`📝 Mise à jour des tokens pour: ${userData.name || userData.email}`);
          
          batch.update(doc.ref, {
            tokensUsedMonthly: 0,
            tokensResetDate: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          
          updateCount++;
        } else {
          console.log(`✅ Utilisateur ${userData.name || userData.email} a déjà un package: ${userData.package}`);
        }
      }
    });
    
    if (updateCount > 0) {
      await batch.commit();
      console.log(`✅ ${updateCount} utilisateur(s) mis à jour avec succès !`);
    } else {
      console.log('✅ Tous les utilisateurs ont déjà un package assigné.');
    }
    
    console.log('🎉 Migration terminée avec succès !');
    
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
  } finally {
    process.exit(0);
  }
}

// Exécuter le script
updateExistingUsers();

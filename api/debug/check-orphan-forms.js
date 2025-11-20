/**
 * DEBUG SCRIPT: Vérifier les formulaires orphelins
 * 
 * Ce script vérifie si des formulaires sont orphelins dans la base de données :
 * - Formulaires avec un agencyId qui n'existe pas dans les utilisateurs
 * - Formulaires avec un createdBy qui n'existe pas dans les utilisateurs
 * - Formulaires sans agencyId valide
 * 
 * Le script liste également tous les formulaires par compte (agencyId).
 * 
 * USAGE:
 *   node api/debug/check-orphan-forms.js
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const loadedLocalEnv = dotenv.config({ path: path.join(__dirname, '../../.env.local') });
if (!loadedLocalEnv || !loadedLocalEnv.parsed) {
  dotenv.config({ path: path.join(__dirname, '../../.env') });
}

/**
 * Initialize Firebase Admin - try service account file first, then env vars
 */
async function initializeFirebase() {
  // Try to use service account file first
  try {
    const serviceAccountPath = path.join(__dirname, '../../studio-gpnfx-firebase-adminsdk-fbsvc-1a70f129c6.json');
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }
    const db = admin.firestore();
    console.log('✅ Firebase Admin initialisé avec le fichier service account\n');
    return db;
  } catch (e) {
    // Fallback to environment variables
    try {
      const firebaseAdminModule = await import('../lib/firebaseAdmin.js');
      console.log('✅ Firebase Admin initialisé avec les variables d\'environnement\n');
      return firebaseAdminModule.adminDb;
    } catch (ee) {
      console.error('❌ Impossible d\'initialiser Firebase Admin:', ee.message);
      console.error('   Erreur service account:', e.message);
      throw ee;
    }
  }
}

/**
 * Récupère tous les utilisateurs et les groupe par agencyId
 */
async function getAllUsersByAgency(adminDb) {
  try {
    console.log('📥 Récupération de tous les utilisateurs...');
    const usersSnapshot = await adminDb.collection('users').get();
    
    const usersByAgency = new Map();
    const allUserIds = new Set();
    
    usersSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const userId = doc.id;
      const agencyId = data.agencyId;
      
      allUserIds.add(userId);
      
      if (agencyId) {
        if (!usersByAgency.has(agencyId)) {
          usersByAgency.set(agencyId, {
            agencyId,
            users: [],
            directorIds: new Set(),
            employeeIds: new Set()
          });
        }
        
        const agency = usersByAgency.get(agencyId);
        agency.users.push({
          id: userId,
          name: data.name || 'Sans nom',
          email: data.email || 'Sans email',
          role: data.role || 'employe'
        });
        
        if (data.role === 'directeur') {
          agency.directorIds.add(userId);
        } else if (data.role === 'employe') {
          agency.employeeIds.add(userId);
        }
      }
    });
    
    console.log(`✅ ${usersSnapshot.size} utilisateurs trouvés`);
    console.log(`✅ ${usersByAgency.size} agences distinctes trouvées\n`);
    
    return { usersByAgency, allUserIds };
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des utilisateurs:', error);
    throw error;
  }
}

/**
 * Récupère tous les formulaires
 */
async function getAllForms(adminDb) {
  try {
    console.log('📥 Récupération de tous les formulaires...');
    const formsSnapshot = await adminDb.collection('forms').get();
    
    const forms = [];
    formsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      forms.push({
        id: doc.id,
        title: data.title || 'Sans titre',
        description: data.description || '',
        agencyId: data.agencyId || null,
        createdBy: data.createdBy || null,
        createdByRole: data.createdByRole || null,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || null),
        assignedTo: data.assignedTo || [],
        universId: data.universId || null,
        universInstanceId: data.universInstanceId || null
      });
    });
    
    console.log(`✅ ${forms.length} formulaires trouvés\n`);
    return forms;
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des formulaires:', error);
    throw error;
  }
}

/**
 * Vérifie les formulaires orphelins
 */
function checkOrphanForms(forms, usersByAgency, allUserIds) {
  const orphanForms = [];
  const validAgencyIds = new Set(usersByAgency.keys());
  
  forms.forEach(form => {
    const issues = [];
    
    // Vérifier si agencyId existe
    if (!form.agencyId) {
      issues.push('agencyId manquant');
    } else if (!validAgencyIds.has(form.agencyId)) {
      issues.push(`agencyId "${form.agencyId}" n'existe pas dans les utilisateurs`);
    }
    
    // Vérifier si createdBy existe
    if (!form.createdBy) {
      issues.push('createdBy manquant');
    } else if (!allUserIds.has(form.createdBy)) {
      issues.push(`createdBy "${form.createdBy}" n'existe pas dans les utilisateurs`);
    }
    
    if (issues.length > 0) {
      orphanForms.push({
        ...form,
        issues
      });
    }
  });
  
  return orphanForms;
}

/**
 * Groupe les formulaires par compte (agencyId)
 */
function groupFormsByAgency(forms) {
  const formsByAgency = new Map();
  
  forms.forEach(form => {
    const agencyId = form.agencyId || 'SANS_AGENCY_ID';
    
    if (!formsByAgency.has(agencyId)) {
      formsByAgency.set(agencyId, {
        agencyId,
        forms: [],
        count: 0
      });
    }
    
    formsByAgency.get(agencyId).forms.push(form);
    formsByAgency.get(agencyId).count++;
  });
  
  return formsByAgency;
}

/**
 * Fonction principale
 */
async function main() {
  console.log('🔍 [CHECK] Vérification des formulaires orphelins\n');
  console.log('='.repeat(80));
  console.log('');
  
  try {
    // Initialize Firebase
    const adminDb = await initializeFirebase();
    
    // Récupérer les données
    const { usersByAgency, allUserIds } = await getAllUsersByAgency(adminDb);
    const forms = await getAllForms(adminDb);
    
    // Vérifier les formulaires orphelins
    console.log('🔍 Vérification des formulaires orphelins...\n');
    const orphanForms = checkOrphanForms(forms, usersByAgency, allUserIds);
    
    // Grouper les formulaires par agence
    const formsByAgency = groupFormsByAgency(forms);
    
    // Afficher les résultats
    console.log('='.repeat(80));
    console.log('📊 RÉSULTATS DE LA VÉRIFICATION');
    console.log('='.repeat(80));
    console.log('');
    
    // Statistiques générales
    console.log('📈 STATISTIQUES GÉNÉRALES:');
    console.log(`  Total formulaires: ${forms.length}`);
    console.log(`  Formulaires orphelins: ${orphanForms.length}`);
    console.log(`  Formulaires valides: ${forms.length - orphanForms.length}`);
    console.log(`  Nombre d'agences: ${usersByAgency.size}`);
    console.log(`  Agences avec formulaires: ${formsByAgency.size}`);
    console.log('');
    
    // Afficher les formulaires orphelins
    if (orphanForms.length > 0) {
      console.log('⚠️  FORMULAIRES ORPHELINS:');
      console.log('-'.repeat(80));
      orphanForms.forEach((form, index) => {
        console.log(`\n${index + 1}. Formulaire ID: ${form.id}`);
        console.log(`   Titre: ${form.title}`);
        console.log(`   AgencyId: ${form.agencyId || '(manquant)'}`);
        console.log(`   CreatedBy: ${form.createdBy || '(manquant)'}`);
        console.log(`   Créé le: ${form.createdAt ? form.createdAt.toISOString() : '(date inconnue)'}`);
        console.log(`   Problèmes:`);
        form.issues.forEach(issue => {
          console.log(`     - ${issue}`);
        });
      });
      console.log('');
    } else {
      console.log('✅ Aucun formulaire orphelin trouvé !');
      console.log('');
    }
    
    // Afficher les formulaires par compte
    console.log('='.repeat(80));
    console.log('📋 FORMULAIRES PAR COMPTE (AGENCY)');
    console.log('='.repeat(80));
    console.log('');
    
    // Trier les agences par nombre de formulaires (décroissant)
    const sortedAgencies = Array.from(formsByAgency.entries())
      .sort((a, b) => b[1].count - a[1].count);
    
    sortedAgencies.forEach(([agencyId, agencyData]) => {
      const agencyInfo = usersByAgency.get(agencyId);
      
      console.log(`\n🏢 AGENCE: ${agencyId}`);
      if (agencyInfo) {
        const directors = Array.from(agencyInfo.directorIds);
        const employees = Array.from(agencyInfo.employeeIds);
        console.log(`   Directeurs: ${directors.length}`);
        console.log(`   Employés: ${employees.length}`);
        console.log(`   Total utilisateurs: ${agencyInfo.users.length}`);
      } else {
        console.log(`   ⚠️  Aucun utilisateur trouvé pour cette agence`);
      }
      console.log(`   Nombre de formulaires: ${agencyData.count}`);
      console.log(`   Formulaires:`);
      
      // Trier les formulaires par date de création (plus récent en premier)
      const sortedForms = agencyData.forms.sort((a, b) => {
        const getTime = (date) => {
          if (!date) return 0;
          if (date.getTime) return date.getTime();
          if (date.toDate) return date.toDate().getTime();
          if (date.seconds) return date.seconds * 1000;
          if (typeof date === 'string') return new Date(date).getTime();
          return 0;
        };
        const dateA = getTime(a.createdAt);
        const dateB = getTime(b.createdAt);
        return dateB - dateA;
      });
      
      sortedForms.forEach((form, index) => {
        let dateStr = '(date inconnue)';
        if (form.createdAt) {
          let date;
          if (form.createdAt.toDate) {
            date = form.createdAt.toDate();
          } else if (form.createdAt.getTime) {
            date = form.createdAt;
          } else if (form.createdAt.seconds) {
            date = new Date(form.createdAt.seconds * 1000);
          } else if (typeof form.createdAt === 'string') {
            date = new Date(form.createdAt);
          } else {
            date = null;
          }
          
          if (date && date instanceof Date && !isNaN(date.getTime())) {
            dateStr = date.toLocaleDateString('fr-FR', { 
              year: 'numeric', 
              month: '2-digit', 
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            });
          }
        }
        
        console.log(`     ${index + 1}. [${form.id}] ${form.title}`);
        console.log(`        Créé le: ${dateStr}`);
        console.log(`        Créé par: ${form.createdBy || '(inconnu)'}`);
        console.log(`        Assigné à: ${form.assignedTo.length} employé(s)`);
        if (form.universId) {
          console.log(`        Univers ID: ${form.universId}`);
        }
        if (form.universInstanceId) {
          console.log(`        Instance Univers ID: ${form.universInstanceId}`);
        }
      });
      
      console.log('');
    });
    
    // Résumé par agence
    console.log('='.repeat(80));
    console.log('📊 RÉSUMÉ PAR AGENCE');
    console.log('='.repeat(80));
    console.log('');
    
    sortedAgencies.forEach(([agencyId, agencyData]) => {
      const agencyInfo = usersByAgency.get(agencyId);
      const agencyName = agencyInfo && agencyInfo.users.length > 0
        ? agencyInfo.users[0].name
        : 'Agence inconnue';
      
      console.log(`  ${agencyId}: ${agencyData.count} formulaire(s) - ${agencyName}`);
    });
    
    console.log('');
    console.log('✅ Vérification terminée !');
    
  } catch (error) {
    console.error('\n❌ Erreur lors de la vérification:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

main().catch(console.error);


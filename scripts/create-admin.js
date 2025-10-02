import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyDjk-Y3jeoPy3nW_9MniNs8heBv17briMU",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "studio-gpnfx.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "studio-gpnfx",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "studio-gpnfx.firebasestorage.app",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "848246677738",
  appId: process.env.VITE_FIREBASE_APP_ID || "1:848246677738:web:7612dab5f030c52b227793",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function createAdminUser() {
  try {
    const adminEmail = process.argv[2] || 'admin@ubora.com';
    const adminPassword = process.argv[3] || 'Admin123!';
    const adminName = process.argv[4] || 'Super Admin';

    console.log('🚀 Creating admin user...');
    console.log(`📧 Email: ${adminEmail}`);
    console.log(`👤 Name: ${adminName}`);

    // Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword);

    console.log('✅ User created in Firebase Auth:', userCredential.user.uid);

    // Create user document in Firestore
    const userData = {
      name: adminName,
      email: adminEmail,
      role: 'admin',
      agencyId: 'admin-agency',
      isSuperAdmin: true,
      adminPermissions: [
        'user_management',
        'system_monitoring',
        'analytics_access',
        'settings_management',
        'backup_restore',
        'log_access'
      ],
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(doc(db, 'users', userCredential.user.uid), userData);

    console.log('✅ User document created in Firestore');

    // Log the admin creation activity
    await addDoc(collection(db, 'activityLogs'), {
      type: 'admin_user_creation',
      userId: userCredential.user.uid,
      userEmail: adminEmail,
      userName: adminName,
      userRole: 'admin',
      description: `Initial admin user created: ${adminName} (${adminEmail})`,
      severity: 'high',
      category: 'admin',
      timestamp: serverTimestamp(),
      metadata: {
        createdBy: 'system',
        isInitialAdmin: true
      }
    });

    console.log('✅ Activity logged');

    console.log('\n🎉 Admin user created successfully!');
    console.log('📋 Login credentials:');
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    console.log('\n🔗 Access the admin panel at: /admin/login');
    console.log('⚠️  Please change the password after first login!');

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    
    if (error.code === 'auth/email-already-in-use') {
      console.log('ℹ️  Admin user already exists. Use different email or delete existing user first.');
    }
    
    process.exit(1);
  }
}

// Run the script
createAdminUser()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Bell, ShieldCheck, CheckCircle, Clock, BarChart3, MessageSquare, Zap, Smartphone, Monitor, AlertCircle, Settings } from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { unifiedNotificationService } from '../services/unifiedNotificationService';
import { useAuth } from '../contexts/AuthContext';

export const PushTestPage: React.FC = () => {
  const { 
    permission, 
    requestPermission, 
    isSupported, 
    isIOS, 
    isAndroid
  } = usePushNotifications();
  const { user } = useAuth();
  const [status, setStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // FCM Notification Test Functions
  const testFormAssignment = async () => {
    if (!user) {
      setStatus('❌ Utilisateur non connecté');
      return;
    }

    setIsLoading(true);
    setStatus('🔄 Envoi de la notification d\'assignation de formulaire...');
    
    try {
      // Get FCM token from user profile
      const { getDoc, doc } = await import('firebase/firestore');
      const { db } = await import('../firebaseConfig');
      
      const userDoc = await getDoc(doc(db, 'users', user.id));
      const userData = userDoc.data();
      const fcmToken = userData?.fcmToken;

      if (!fcmToken) {
        setStatus('❌ Aucun token FCM trouvé. Utilisez "Initialiser Token FCM" d\'abord.');
        return;
      }

      await unifiedNotificationService.createFormAssignmentNotification(
        'test-form-123',
        'Formulaire de Test FCM',
        user.id,
        (user.role === 'admin' || user.role === 'directeur') ? 'directeur' : 'employe',
        user.agencyId || '',
        'assigned',
        'Directeur Test',
        fcmToken
      );
      setStatus('✅ Notification d\'assignation FCM envoyée! Vérifiez votre appareil.');
    } catch (error) {
      console.error('Error testing form assignment:', error);
      setStatus('❌ Erreur lors de l\'envoi de la notification d\'assignation: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsLoading(false);
    }
  };

  const testFormReminder = async () => {
    if (!user) {
      setStatus('❌ Utilisateur non connecté');
      return;
    }

    setIsLoading(true);
    setStatus('🔄 Envoi de la notification de rappel de formulaire...');
    
    try {
      // Get FCM token from user profile
      const { getDoc, doc } = await import('firebase/firestore');
      const { db } = await import('../firebaseConfig');
      
      const userDoc = await getDoc(doc(db, 'users', user.id));
      const userData = userDoc.data();
      const fcmToken = userData?.fcmToken;

      if (!fcmToken) {
        setStatus('❌ Aucun token FCM trouvé. Utilisez "Initialiser Token FCM" d\'abord.');
        return;
      }

      await unifiedNotificationService.createFormReminderNotification(
        'test-form-123',
        'Formulaire de Test FCM',
        user.id,
        (user.role === 'admin' || user.role === 'directeur') ? 'directeur' : 'employe',
        user.agencyId || '',
        fcmToken
      );
      setStatus('✅ Notification de rappel FCM envoyée! Vérifiez votre appareil.');
    } catch (error) {
      console.error('Error testing form reminder:', error);
      setStatus('❌ Erreur lors de l\'envoi de la notification de rappel: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsLoading(false);
    }
  };

  const testMetricReminder = async () => {
    if (!user) {
      setStatus('❌ Utilisateur non connecté');
      return;
    }

    setIsLoading(true);
    setStatus('🔄 Envoi de la notification de rappel de métrique...');
    
    try {
      // Get FCM token from user profile
      const { getDoc, doc } = await import('firebase/firestore');
      const { db } = await import('../firebaseConfig');
      
      const userDoc = await getDoc(doc(db, 'users', user.id));
      const userData = userDoc.data();
      const fcmToken = userData?.fcmToken;

      if (!fcmToken) {
        setStatus('❌ Aucun token FCM trouvé. Utilisez "Initialiser Token FCM" d\'abord.');
        return;
      }

      await unifiedNotificationService.createMetricReminderNotification(
        'test-dashboard-123',
        'test-metric-123',
        'Métrique de Test FCM',
        85.5,
        user.id,
        user.agencyId || '',
        fcmToken
      );
      setStatus('✅ Notification de métrique FCM envoyée! Vérifiez votre appareil.');
    } catch (error) {
      console.error('Error testing metric reminder:', error);
      setStatus('❌ Erreur lors de l\'envoi de la notification de métrique: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsLoading(false);
    }
  };

  const testProgrammedInstruction = async () => {
    if (!user) {
      setStatus('❌ Utilisateur non connecté');
      return;
    }

    setIsLoading(true);
    setStatus('🔄 Envoi de la notification d\'instruction programmée...');
    
    try {
      // Get FCM token from user profile
      const { getDoc, doc } = await import('firebase/firestore');
      const { db } = await import('../firebaseConfig');
      
      const userDoc = await getDoc(doc(db, 'users', user.id));
      const userData = userDoc.data();
      const fcmToken = userData?.fcmToken;

      if (!fcmToken) {
        setStatus('❌ Aucun token FCM trouvé. Utilisez "Initialiser Token FCM" d\'abord.');
        return;
      }

      await unifiedNotificationService.createProgrammedInstructionNotification(
        'test-instruction-123',
        'Instruction de Test FCM',
        user.id,
        user.agencyId || '',
        fcmToken
      );
      setStatus('✅ Notification d\'instruction FCM envoyée! Vérifiez votre appareil.');
    } catch (error) {
      console.error('Error testing programmed instruction:', error);
      setStatus('❌ Erreur lors de l\'envoi de la notification d\'instruction: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsLoading(false);
    }
  };

  const testSimpleNotification = async () => {
    if (!user) {
      setStatus('❌ Utilisateur non connecté');
      return;
    }

    setIsLoading(true);
    setStatus('🔄 Test de notification simple...');
    
    try {
      console.log('🔔 [PushTest] ===== STARTING FCM TEST =====');
      console.log('🔔 [PushTest] User ID:', user.id);
      console.log('🔔 [PushTest] User role:', user.role);
      
      // Get FCM token from user profile
      const { getDoc, doc } = await import('firebase/firestore');
      const { db } = await import('../firebaseConfig');
      
      console.log('🔔 [PushTest] Fetching FCM token from user profile...');
      const userDoc = await getDoc(doc(db, 'users', user.id));
      const userData = userDoc.data();
      const fcmToken = userData?.fcmToken;

      console.log('🔔 [PushTest] User data retrieved:', {
        hasUserData: !!userData,
        hasFcmToken: !!fcmToken,
        tokenLength: fcmToken?.length || 0
      });

      if (!fcmToken) {
        setStatus('❌ Aucun token FCM trouvé. Utilisez "Initialiser Token FCM" d\'abord.');
        return;
      }

      console.log('🔔 [PushTest] FCM Token found:', fcmToken.substring(0, 20) + '...');
      console.log('🔔 [PushTest] Full token length:', fcmToken.length);

      // Test direct FCM call
      console.log('🔔 [PushTest] Importing FCM service...');
      const { fcmService } = await import('../services/fcmService');
      
      const testNotification = {
        id: `test_${Date.now()}`,
        title: 'Test Simple FCM',
        body: 'Ceci est un test de notification FCM simple',
        data: { 
          type: 'test',
          timestamp: Date.now().toString(),
          redirectUrl: '/'
        }
      };

      console.log('🔔 [PushTest] Test notification created:', testNotification);
      console.log('🔔 [PushTest] Calling FCM service...');
      
      const result = await fcmService.sendToToken(testNotification, fcmToken, user.id);
      
      console.log('🔔 [PushTest] FCM service result:', result);
      console.log('🔔 [PushTest] ===== FCM TEST COMPLETED =====');
      
      if (result && result.status === 'sent') {
        setStatus('✅ Notification simple FCM envoyée! Vérifiez votre appareil.');
      } else {
        setStatus(`❌ Erreur FCM: ${result?.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error testing simple notification:', error);
      setStatus('❌ Erreur lors de l\'envoi de la notification simple: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsLoading(false);
    }
  };

  const testBackendCronJob = async () => {
    setIsLoading(true);
    setStatus('🔄 Test du cron job backend...');
    
    try {
      // Use the correct API configuration
      const { getCronNotificationsEndpoint } = await import('../config/api');
      const cronJobUrl = getCronNotificationsEndpoint();
      
      console.log('🔔 [PushTest] Testing cron job at:', cronJobUrl);
      
      const response = await fetch(cronJobUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          test: true,
          timestamp: new Date().toISOString()
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        setStatus(`✅ Cron job exécuté: ${result.processed} traitées, ${result.sent} envoyées, ${result.errors} erreurs`);
      } else {
        const errorText = await response.text();
        console.error('Cron job error response:', errorText);
        setStatus(`❌ Erreur lors de l'exécution du cron job: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error testing cron job:', error);
      setStatus('❌ Erreur de connexion au cron job: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsLoading(false);
    }
  };

  const testFCMToken = async () => {
    if (!user) {
      setStatus('❌ Utilisateur non connecté');
      return;
    }

    setIsLoading(true);
    setStatus('🔄 Vérification du token FCM...');
    
    try {
      // Check if FCM token exists in localStorage
      const fcmToken = localStorage.getItem('fcm_token');
      if (fcmToken) {
        setStatus(`✅ Token FCM trouvé: ${fcmToken.substring(0, 20)}... (${fcmToken.length} caractères)`);
      } else {
        setStatus('❌ Aucun token FCM trouvé. Les notifications push ne fonctionneront pas.');
      }
    } catch (error) {
      console.error('Error checking FCM token:', error);
      setStatus('❌ Erreur lors de la vérification du token FCM');
    } finally {
      setIsLoading(false);
    }
  };

  const initializeFCMToken = async () => {
    if (!user) {
      setStatus('❌ Utilisateur non connecté');
      return;
    }

    setIsLoading(true);
    setStatus('🔄 Initialisation du token FCM...');
    
    try {
      // Import the push notification hook to get a fresh token
      const { getToken } = await import('firebase/messaging');
      const { messaging } = await import('../firebaseConfig');
      
      const messagingInstance = await messaging;
      if (!messagingInstance) {
        setStatus('❌ Messaging non disponible');
        return;
      }

      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
      if (!vapidKey || vapidKey === 'YOUR_VAPID_KEY_HERE') {
        setStatus('❌ VAPID key non configurée');
        return;
      }

      // Get fresh FCM token
      const newToken = await getToken(messagingInstance, {
        vapidKey: vapidKey,
        serviceWorkerRegistration: await navigator.serviceWorker.getRegistration('/')
      });

      if (newToken) {
        // Save token to localStorage
        localStorage.setItem('fcm_token', newToken);
        
        // Save token to user profile in Firestore
        const { updateDoc, doc } = await import('firebase/firestore');
        const { db } = await import('../firebaseConfig');
        
        await updateDoc(doc(db, 'users', user.id), {
          fcmToken: newToken,
          fcmTokenUpdatedAt: new Date().toISOString()
        });
        
        setStatus(`✅ Token FCM initialisé et sauvegardé: ${newToken.substring(0, 20)}... (${newToken.length} caractères)`);
      } else {
        setStatus('❌ Impossible de générer le token FCM');
      }
    } catch (error) {
      console.error('Error initializing FCM token:', error);
      setStatus('❌ Erreur lors de l\'initialisation du token FCM: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsLoading(false);
    }
  };

  const checkPermissionStatus = async () => {
    setIsLoading(true);
    setStatus('🔄 Vérification du statut des permissions...');
    
    try {
      const currentPermission = Notification.permission;
      const serviceWorkerStatus = 'serviceWorker' in navigator ? 'Disponible' : 'Non disponible';
      const registration = await navigator.serviceWorker.getRegistration('/');
      const swStatus = registration ? 'Enregistré' : 'Non enregistré';
      
      setStatus(`📊 Statut des permissions:
        • Permission navigateur: ${currentPermission}
        • Service Worker: ${swStatus}
        • Support notifications: ${serviceWorkerStatus}
        • État hook: ${permission.granted ? 'Accordée' : permission.denied ? 'Refusée' : 'Non demandée'}`);
        
    } catch (error) {
      console.error('Error checking permission status:', error);
      setStatus('❌ Erreur lors de la vérification: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsLoading(false);
    }
  };

  const testServiceWorker = async () => {
    setIsLoading(true);
    setStatus('🔄 Test du Service Worker...');
    
    try {
      // Check if service worker is registered
      const registration = await navigator.serviceWorker.getRegistration('/');
      if (!registration) {
        setStatus('❌ Service Worker non enregistré');
        return;
      }

      // Check if service worker is active
      if (!registration.active) {
        setStatus('❌ Service Worker non actif');
        return;
      }

      // Test service worker communication
      const messageChannel = new MessageChannel();
      const promise = new Promise<{message?: string; timestamp?: number; state?: string}>((resolve) => {
        messageChannel.port1.onmessage = (event) => {
          resolve(event.data);
        };
      });

      registration.active.postMessage({ type: 'TEST_SW' }, [messageChannel.port2]);
      const response = await promise;

      setStatus(`✅ Service Worker actif et fonctionnel
        • Enregistré: Oui
        • Actif: Oui  
        • Réponse: ${response?.message || 'Aucune réponse'}
        • État: ${registration.active.state}`);

    } catch (error) {
      console.error('Error testing service worker:', error);
      setStatus('❌ Erreur lors du test du Service Worker: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsLoading(false);
    }
  };

  const testBasicNotification = async () => {
    setIsLoading(true);
    setStatus('🔄 Test de notification basique...');
    
    try {
      if (Notification.permission !== 'granted') {
        setStatus('❌ Permission de notification non accordée');
        return;
      }

      // Create a simple test notification
      const notification = new Notification('Test Ubora', {
        body: 'Ceci est un test de notification basique',
        icon: '/fav-icons/android-icon-96x96.png',
        badge: '/fav-icons/android-icon-48x48.png',
        tag: 'test-basic-notification',
        requireInteraction: true
      });

      notification.onclick = () => {
        console.log('🔔 Basic notification clicked');
        notification.close();
      };

      setStatus('✅ Notification basique créée! Vérifiez si elle apparaît sur votre appareil.');
      
      // Auto-close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);

    } catch (error) {
      console.error('Error testing basic notification:', error);
      setStatus('❌ Erreur lors du test de notification: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsLoading(false);
    }
  };

  const resetNotificationPermissions = async () => {
    setIsLoading(true);
    setStatus('🔄 Réinitialisation des permissions...');
    
    try {
      // Clear existing permissions
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }
      
      // Clear FCM token
      localStorage.removeItem('fcm_token');
      
      // Clear user FCM token in Firestore
      if (user) {
        const { updateDoc, doc } = await import('firebase/firestore');
        const { db } = await import('../firebaseConfig');
        
        await updateDoc(doc(db, 'users', user.id), {
          fcmToken: null,
          fcmTokenClearedAt: new Date().toISOString()
        });
      }
      
      setStatus('✅ Permissions réinitialisées. Rechargez la page pour recommencer.');
      
      // Reload page after 2 seconds
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Error resetting permissions:', error);
      setStatus('❌ Erreur lors de la réinitialisation des permissions');
    } finally {
      setIsLoading(false);
    }
  };

  const getPlatformInfo = () => {
    if (isIOS) {
      return {
        icon: <Smartphone className="w-4 h-4" />,
        text: 'iOS Safari/PWA',
        note: 'Requires iOS 16.4+ and Safari or installed PWA'
      };
    } else if (isAndroid) {
      return {
        icon: <Smartphone className="w-4 h-4" />,
        text: 'Android Chrome',
        note: 'Full support in Chrome and installed PWAs'
      };
    } else {
      return {
        icon: <Monitor className="w-4 h-4" />,
        text: 'Desktop Browser',
        note: 'Limited support, test on mobile for best results'
      };
    }
  };

  const platformInfo = getPlatformInfo();

  return (
    <Layout title="Test FCM Push Notifications">
      <div className="space-y-6">
        {/* Platform Info */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
              {platformInfo.icon}
            <h3 className="text-lg font-semibold">Plateforme détectée</h3>
            </div>
          <div className="space-y-2">
            <p className="font-medium">{platformInfo.text}</p>
            <p className="text-sm text-gray-600">{platformInfo.note}</p>
            <div className="flex items-center gap-2">
              <span className="text-sm">Support des notifications:</span>
              {isSupported ? (
                <span className="text-green-600 font-medium">✅ Supporté</span>
              ) : (
                <span className="text-red-600 font-medium">❌ Non supporté</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">Permission:</span>
              {permission.granted ? (
                <span className="text-green-600 font-medium">✅ Accordée</span>
              ) : permission.denied ? (
                <span className="text-red-600 font-medium">❌ Refusée</span>
              ) : (
                <span className="text-yellow-600 font-medium">⚠️ Non demandée</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">État réel:</span>
              <span className="text-blue-600 font-medium">
                {Notification.permission === 'granted' ? '✅ Accordée' : 
                 Notification.permission === 'denied' ? '❌ Refusée' : '⚠️ Non demandée'}
              </span>
            </div>
            </div>
        </Card>

        {/* Permission Request */}
        {!permission.granted && (
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <ShieldCheck className="w-6 h-6 text-blue-600" />
              <h3 className="text-lg font-semibold">Autorisation requise</h3>
              </div>
            <p className="text-sm text-gray-600 mb-4">
              Les notifications push nécessitent votre autorisation pour fonctionner.
            </p>
            <Button
              onClick={requestPermission}
              className="flex items-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              Autoriser les notifications
            </Button>
          </Card>
        )}

        {/* FCM Notification Tests */}
        {permission.granted && (
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Bell className="w-6 h-6 text-green-600" />
              <h3 className="text-lg font-semibold">Tests FCM Push Notifications</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Testez les 4 types de notifications FCM avec des notifications réelles qui apparaîtront 
              dans le système de notifications de votre appareil (comme WhatsApp).
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <Button
                onClick={testFormAssignment}
                disabled={isLoading}
                className="flex items-center gap-2 justify-center h-auto py-3"
              >
                <CheckCircle className="w-4 h-4 text-purple-500" />
                <div className="text-left">
                  <div className="font-medium">Test Assignation</div>
                  <div className="text-xs opacity-75">form_assignment</div>
                </div>
            </Button>
              
              <Button
                onClick={testFormReminder}
                disabled={isLoading}
                variant="secondary"
                className="flex items-center gap-2 justify-center h-auto py-3"
              >
                <Clock className="w-4 h-4 text-yellow-500" />
                <div className="text-left">
                  <div className="font-medium">Test Rappel</div>
                  <div className="text-xs opacity-75">form_reminder</div>
                </div>
            </Button>
              
            <Button 
                onClick={testMetricReminder}
                disabled={isLoading}
              variant="secondary" 
                className="flex items-center gap-2 justify-center h-auto py-3"
              >
                <BarChart3 className="w-4 h-4 text-blue-500" />
                <div className="text-left">
                  <div className="font-medium">Test Métrique</div>
                  <div className="text-xs opacity-75">metric_reminder</div>
                </div>
            </Button>
              
            <Button 
                onClick={testProgrammedInstruction}
                disabled={isLoading}
                variant="secondary"
                className="flex items-center gap-2 justify-center h-auto py-3"
              >
                <MessageSquare className="w-4 h-4 text-green-500" />
                <div className="text-left">
                  <div className="font-medium">Test Instruction</div>
                  <div className="text-xs opacity-75">programmed_instruction</div>
                </div>
              </Button>
            </div>

            {/* Technical Tests */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Tests Techniques</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Button
                  onClick={testServiceWorker}
                  disabled={isLoading}
                  variant="secondary"
                  size="sm"
                  className="flex items-center gap-2 justify-center"
                >
                  <Settings className="w-4 h-4" />
                  Test Service Worker
                </Button>
                
                <Button
                  onClick={testBasicNotification}
                  disabled={isLoading}
                  variant="secondary"
                  size="sm"
                  className="flex items-center gap-2 justify-center"
                >
                  <Bell className="w-4 h-4" />
                  Test Notification Basique
                </Button>
                
                <Button
                  onClick={testSimpleNotification}
                  disabled={isLoading}
                  variant="primary"
                  size="sm"
                  className="flex items-center gap-2 justify-center"
                >
                  <Bell className="w-4 h-4" />
                  Test Simple FCM
                </Button>
                
                <Button
                  onClick={testFCMToken}
                  disabled={isLoading}
                  variant="secondary"
                  size="sm"
                  className="flex items-center gap-2 justify-center"
                >
                  <Zap className="w-4 h-4" />
                  Vérifier Token FCM
                </Button>
                
                <Button
                  onClick={initializeFCMToken}
                  disabled={isLoading}
                  variant="secondary"
                  size="sm"
                  className="flex items-center gap-2 justify-center"
                >
                  <Bell className="w-4 h-4" />
                  Initialiser Token FCM
                </Button>
                
                <Button
                  onClick={testBackendCronJob}
                  disabled={isLoading}
              variant="secondary" 
                  size="sm"
                  className="flex items-center gap-2 justify-center"
            >
              <Bell className="w-4 h-4" />
                  Test Cron Job
            </Button>
                
            <Button 
                  onClick={checkPermissionStatus}
                  disabled={isLoading}
              variant="secondary" 
                  size="sm"
                  className="flex items-center gap-2 justify-center"
            >
                  <AlertCircle className="w-4 h-4" />
                  📊 Vérifier Statut
            </Button>
            
            <Button 
                  onClick={requestPermission}
                  disabled={isLoading || permission.granted}
              variant="primary" 
                  size="sm"
                  className="flex items-center gap-2 justify-center"
            >
                  <ShieldCheck className="w-4 h-4" />
                  {permission.granted ? '✅ Permissions Activées' : '🔓 Activer Permissions'}
            </Button>
            
            <Button 
                  onClick={resetNotificationPermissions}
                  disabled={isLoading}
              variant="danger" 
                  size="sm"
                  className="flex items-center gap-2 justify-center"
            >
                  <Settings className="w-4 h-4" />
                  🔄 Réinitialiser
            </Button>
          </div>
            </div>
          </Card>
        )}

        {/* Status Display */}
          {status && (
          <Card className="p-4">
            <div className="flex items-center gap-2">
              {status.includes('✅') ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : status.includes('❌') ? (
                <AlertCircle className="w-4 h-4 text-red-500" />
              ) : (
                <Bell className="w-4 h-4 text-blue-500" />
              )}
              <span className="text-sm">{status}</span>
            </div>
        </Card>
        )}

        {/* Debugging Guide */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-6 h-6 text-blue-600" />
            <h3 className="text-lg font-semibold">Guide de Débogage FCM</h3>
          </div>
          <div className="space-y-3 text-sm text-gray-600">
            <div>
              <strong>1. Vérifiez la Console du Navigateur:</strong>
              <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                <li>Ouvrez DevTools (F12) → Console</li>
                <li>Recherchez les erreurs FCM</li>
                <li>Vérifiez les logs de service worker</li>
              </ul>
            </div>
            <div>
              <strong>2. Testez les Permissions:</strong>
              <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                <li>Exécutez: <code className="bg-gray-100 px-1 rounded">Notification.permission</code></li>
                <li>Doit retourner "granted"</li>
                <li>Testez une notification simple dans la console</li>
              </ul>
            </div>
            <div>
              <strong>3. Vérifiez le Service Worker:</strong>
              <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                <li>DevTools → Application → Service Workers</li>
                <li>Doit être "Active" et "Running"</li>
                <li>Recherchez: "FCM background message received"</li>
              </ul>
            </div>
            <div>
              <strong>4. Testez l'Endpoint Backend:</strong>
              <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                <li>Vérifiez les logs du serveur backend</li>
                <li>Recherchez: "FCM push notification sent successfully"</li>
                <li>Vérifiez l'URL: <code className="bg-gray-100 px-1 rounded">http://localhost:3000/api/fcm/send</code></li>
              </ul>
            </div>
            <div className="bg-yellow-50 p-3 rounded-lg">
              <strong>💡 Conseil:</strong> Utilisez le bouton "Test Simple FCM" ci-dessus pour tester directement l'envoi de notifications FCM sans passer par le système unifié.
            </div>
          </div>
        </Card>

      </div>
    </Layout>
  );
};

export default PushTestPage;
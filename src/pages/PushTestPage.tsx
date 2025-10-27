import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Bell, ShieldCheck, CheckCircle, Clock, BarChart3, MessageSquare, Zap, Smartphone, Monitor, AlertCircle, Settings, Shield } from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { unifiedNotificationService } from '../services/unifiedNotificationService';
import { useAuth } from '../contexts/AuthContext';
import { onMessage } from 'firebase/messaging';
import { messaging } from '../firebaseConfig';

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
  const [logs, setLogs] = useState<string[]>([]);

  // Add log function for mobile testing
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    setLogs(prev => [...prev.slice(-9), logMessage]); // Keep last 10 logs
    console.log(logMessage);
  };

  // Set up foreground message handler
  useEffect(() => {
    const setupForegroundHandler = async () => {
      try {
        const messagingInstance = await messaging;
        if (messagingInstance) {
          const unsubscribe = onMessage(messagingInstance, (payload) => {
            addLog('🔔 FCM message received in foreground');
            addLog(`📱 Title: ${payload.notification?.title || payload.data?.title || 'Ubora'}`);
            addLog(`📝 Body: ${payload.notification?.body || payload.data?.body || 'Nouvelle notification'}`);
            
            // Show notification when app is in foreground
            if (Notification.permission === 'granted') {
              const title = payload.notification?.title || payload.data?.title || 'Ubora';
              const body = payload.notification?.body || payload.data?.body || 'Nouvelle notification';
              
              try {
                const notification = new Notification(title, {
                  body: body,
                  icon: '/fav-icons/android-icon-192x192.png',
                  badge: '/fav-icons/android-icon-96x96.png',
                  data: payload.data,
                  tag: `foreground-${Date.now()}`,
                  requireInteraction: true,
                  silent: false
                });
                
                notification.onclick = () => {
                  addLog('👆 Notification clicked');
                  window.focus();
                  notification.close();
                  
                  // Navigate to specific page if URL provided
                  if (payload.data?.redirectUrl) {
                    addLog(`🔗 Navigating to: ${payload.data.redirectUrl}`);
                    window.location.href = payload.data.redirectUrl;
                  }
                };
                
                addLog('✅ Foreground notification displayed successfully');
              } catch (error) {
                addLog(`❌ Error displaying notification: ${error}`);
              }
            } else {
              addLog('❌ Notification permission not granted');
            }
          });
          
          console.log('🔔 [Foreground] Message handler registered');
          
          return () => unsubscribe();
        }
      } catch (error) {
        console.error('🔔 [Foreground] Error setting up message handler:', error);
      }
    };
    
    setupForegroundHandler();
  }, []);

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
    addLog('🚀 Starting FCM Simple Test');
    
    try {
      addLog(`👤 User ID: ${user.id}`);
      addLog(`🎭 User role: ${user.role}`);
      
      // Get FCM token from user profile
      const { getDoc, doc } = await import('firebase/firestore');
      const { db } = await import('../firebaseConfig');
      
      addLog('🔍 Fetching FCM token from user profile...');
      const userDoc = await getDoc(doc(db, 'users', user.id));
      const userData = userDoc.data();
      const fcmToken = userData?.fcmToken;

      addLog(`📊 User data: ${!!userData ? 'Found' : 'Not found'}`);
      addLog(`🔑 FCM Token: ${!!fcmToken ? 'Found' : 'Not found'}`);
      addLog(`📏 Token length: ${fcmToken?.length || 0}`);

      if (!fcmToken) {
        addLog('❌ No FCM token found - use "Initialize FCM Token" first');
        setStatus('❌ Aucun token FCM trouvé. Utilisez "Initialiser Token FCM" d\'abord.');
        return;
      }

      addLog(`🔑 FCM Token: ${fcmToken.substring(0, 20)}...`);
      addLog(`📏 Full token length: ${fcmToken.length}`);

      // Test direct FCM call
      addLog('📦 Importing FCM service...');
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

      addLog(`📝 Test notification created: ${testNotification.title}`);
      addLog(`🆔 Notification ID: ${testNotification.id}`);
      addLog('🚀 Calling FCM service...');
      
      const result = await fcmService.sendToToken(testNotification, fcmToken, user.id);
      
      addLog(`📤 FCM service result: ${result ? 'Success' : 'Failed'}`);
      addLog('🏁 FCM Test Completed');
      
      if (result && result.status === 'sent') {
        addLog('✅ Notification sent successfully!');
        setStatus('✅ Notification simple FCM envoyée! Vérifiez votre appareil.');
      } else {
        addLog(`❌ FCM Error: ${result?.error || 'Unknown error'}`);
        setStatus(`❌ Erreur FCM: ${result?.error || 'Unknown error'}`);
      }
    } catch (error) {
      addLog(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
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
        vapidKey: vapidKey
        // Removed serviceWorkerRegistration to let Firebase use firebase-messaging-sw.js automatically
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

  const testHTTPSRequirement = async () => {
    setIsLoading(true);
    setStatus('🔄 Test des exigences HTTPS pour FCM...');
    addLog('🔒 Starting HTTPS/FCM Compatibility Test');
    
    try {
      const isHTTPS = window.location.protocol === 'https:';
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const isSecureContext = window.isSecureContext;
      
      addLog(`🌐 Protocol: ${window.location.protocol}`);
      addLog(`🏠 Hostname: ${window.location.hostname}`);
      addLog(`🔒 Secure Context: ${isSecureContext ? 'Yes' : 'No'}`);
      
      let statusMessage = '';
      let isCompatible = true;
      
      if (isHTTPS) {
        addLog('✅ HTTPS: Active');
        statusMessage += '✅ HTTPS: Actif\n';
      } else if (isLocalhost) {
        addLog('⚠️ HTTP localhost: FCM may not work');
        statusMessage += '⚠️ HTTP localhost: FCM peut ne pas fonctionner\n';
        isCompatible = false;
      } else {
        addLog('❌ HTTP: FCM blocked');
        statusMessage += '❌ HTTP: FCM bloqué\n';
        isCompatible = false;
      }
      
      statusMessage += `🔒 Secure Context: ${isSecureContext ? '✅' : '❌'}\n`;
      statusMessage += `🌐 Hostname: ${window.location.hostname}\n`;
      statusMessage += `🔗 Protocol: ${window.location.protocol}\n`;
      
      // Test notification permission
      if ('Notification' in window) {
        const permission = Notification.permission;
        addLog(`🔔 Notification Permission: ${permission}`);
        statusMessage += `🔔 Notification Permission: ${permission}\n`;
        
        if (permission === 'granted') {
          // Test basic notification
          try {
            const testNotification = new Notification('Test HTTPS', {
              body: 'Ceci est un test de notification basique',
              icon: '/fav-icons/android-icon-96x96.png'
            });
            addLog('✅ Basic notification: Works');
            statusMessage += '✅ Notification basique: Fonctionne\n';
            testNotification.close();
          } catch (error) {
            addLog('❌ Basic notification: Failed');
            statusMessage += '❌ Notification basique: Échoué\n';
            isCompatible = false;
          }
        }
      } else {
        addLog('❌ Notifications: Not supported');
        statusMessage += '❌ Notifications: Non supportées\n';
        isCompatible = false;
      }
      
      // Test service worker
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration('/');
        if (registration) {
          addLog('✅ Service Worker: Registered');
          addLog(`📄 SW Script: ${registration.active?.scriptURL || 'N/A'}`);
          statusMessage += '✅ Service Worker: Enregistré\n';
          statusMessage += `📄 SW Script: ${registration.active?.scriptURL || 'N/A'}\n`;
        } else {
          addLog('❌ Service Worker: Not registered');
          statusMessage += '❌ Service Worker: Non enregistré\n';
          isCompatible = false;
        }
      } else {
        addLog('❌ Service Worker: Not supported');
        statusMessage += '❌ Service Worker: Non supporté\n';
        isCompatible = false;
      }
      
      // Final recommendation
      if (isCompatible) {
        addLog('🎉 Environment compatible with FCM!');
        statusMessage += '\n🎉 Environnement compatible avec FCM!';
      } else {
        addLog('⚠️ Environment incompatible with FCM');
        addLog('💡 Solution: Deploy to HTTPS or use ngrok');
        statusMessage += '\n⚠️ Environnement incompatible avec FCM.';
        statusMessage += '\n💡 Solution: Déployer sur HTTPS ou utiliser ngrok';
      }
      
      setStatus(statusMessage);
      
    } catch (error) {
      addLog(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      setStatus('❌ Erreur test HTTPS: ' + (error instanceof Error ? error.message : String(error)));
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
                  onClick={testHTTPSRequirement}
                  disabled={isLoading}
                  variant="secondary"
                  size="sm"
                  className="flex items-center gap-2 justify-center"
                >
                  <Shield className="w-4 h-4" />
                  Test HTTPS/FCM
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
          {/* Visible Logs for Mobile Testing */}
        {logs.length > 0 && (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-sm">📱 Mobile Test Logs</h4>
              <Button
                onClick={() => setLogs([])}
                variant="secondary"
                size="sm"
                className="text-xs"
              >
                Clear
              </Button>
            </div>
            <div className="bg-gray-900 text-green-400 p-3 rounded text-xs font-mono max-h-60 overflow-y-auto">
              {logs.map((log, index) => (
                <div key={index} className="mb-1">
                  {log}
                </div>
              ))}
            </div>
          </Card>
        )}

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

      </div>
    </Layout>
  );
};

export default PushTestPage;
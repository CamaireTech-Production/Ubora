import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Bell, ShieldCheck, CheckCircle, AlertCircle, Settings, Smartphone, Monitor, Zap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cleanFCMService } from '../services/cleanFCMService';
import { browserNotificationService } from '../services/browserNotificationService';

export const PushTestPage: React.FC = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>('default');
  const [browserSupported, setBrowserSupported] = useState(false);

  // Add log function
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    setLogs(prev => [...prev.slice(-9), logMessage]);
    console.log(logMessage);
  };

  // Initialize FCM service
  useEffect(() => {
    const initializeFCM = async () => {
      addLog('🚀 Initializing FCM service...');
      
      const initialized = await cleanFCMService.initialize();
      if (initialized) {
        setIsInitialized(true);
        addLog('✅ FCM service initialized');
        
        // Set up foreground handler
        cleanFCMService.setupForegroundHandler((payload) => {
          addLog('🔔 Foreground message received');
          addLog(`📱 Title: ${payload.notification?.title || payload.data?.title}`);
        });
        
        // Check current permission
        setPermission(Notification.permission);
        addLog(`🔔 Current permission: ${Notification.permission}`);
      } else {
        addLog('❌ FCM service initialization failed');
      }
    };

    // Initialize browser notifications
    const initializeBrowserNotifications = () => {
      addLog('🌐 Checking browser notification support...');
      
      const supported = browserNotificationService.isBrowserNotificationSupported();
      setBrowserSupported(supported);
      
      if (supported) {
        addLog('✅ Browser notifications supported');
        const permission = browserNotificationService.getPermissionStatus();
        setBrowserPermission(permission);
        addLog(`🔔 Browser permission: ${permission}`);
      } else {
        addLog('❌ Browser notifications not supported');
      }
    };

    initializeFCM();
    initializeBrowserNotifications();
  }, []);

  // Request permission
  const handleRequestPermission = async () => {
    setIsLoading(true);
    addLog('🔓 Requesting notification permission...');
    
    try {
      const newPermission = await cleanFCMService.requestPermission();
      setPermission(newPermission);
      
      if (newPermission === 'granted') {
        addLog('✅ Permission granted!');
        setStatus('✅ Permission accordée! Vous pouvez maintenant tester les notifications.');
      } else {
        addLog('❌ Permission denied');
        setStatus('❌ Permission refusée. Les notifications ne fonctionneront pas.');
      }
    } catch (error) {
      addLog(`❌ Permission error: ${error}`);
      setStatus('❌ Erreur lors de la demande de permission');
    } finally {
      setIsLoading(false);
    }
  };

  // Get FCM token
  const handleGetToken = async () => {
    setIsLoading(true);
    addLog('🔑 Getting FCM token...');
    
    try {
      const token = await cleanFCMService.getFCMToken();
      
      if (token) {
        setFcmToken(token);
        addLog('✅ FCM token obtained');
        addLog(`🔑 Token: ${token.substring(0, 20)}...`);
        
        // Save token to user profile
        if (user) {
          const { updateDoc, doc } = await import('firebase/firestore');
          const { db } = await import('../firebaseConfig');
          
          await updateDoc(doc(db, 'users', user.id), {
            fcmToken: token,
            fcmTokenUpdatedAt: new Date().toISOString()
          });
          
          addLog('💾 Token saved to user profile');
        }
        
        setStatus('✅ Token FCM obtenu et sauvegardé!');
      } else {
        addLog('❌ No FCM token available');
        setStatus('❌ Impossible d\'obtenir le token FCM');
      }
    } catch (error) {
      addLog(`❌ Token error: ${error}`);
      setStatus('❌ Erreur lors de l\'obtention du token');
    } finally {
      setIsLoading(false);
    }
  };

  // Test FCM notification
  const handleTestNotification = async () => {
    if (!user || !fcmToken) {
      setStatus('❌ Utilisateur non connecté ou token FCM manquant');
      return;
    }

    setIsLoading(true);
    addLog('🧪 Testing FCM notification...');
    
    try {
      const success = await cleanFCMService.sendTestNotification(user.id, fcmToken);
      
      if (success) {
        addLog('✅ Test notification sent successfully');
        setStatus('✅ Notification de test envoyée! Vérifiez votre appareil.');
      } else {
        addLog('❌ Test notification failed');
        setStatus('❌ Échec de l\'envoi de la notification de test');
      }
    } catch (error) {
      addLog(`❌ Test error: ${error}`);
      setStatus('❌ Erreur lors du test de notification');
    } finally {
      setIsLoading(false);
    }
  };

  // Check environment compatibility
  const handleCheckEnvironment = async () => {
    setIsLoading(true);
    addLog('🔍 Checking environment compatibility...');
    
    try {
      const compatibility = cleanFCMService.checkEnvironmentCompatibility();
      
      addLog(`🌐 Protocol: ${window.location.protocol}`);
      addLog(`🏠 Hostname: ${window.location.hostname}`);
      addLog(`🔒 Secure Context: ${window.isSecureContext ? 'Yes' : 'No'}`);
      addLog(`🔔 Notifications: ${'Notification' in window ? 'Supported' : 'Not supported'}`);
      addLog(`⚙️ Service Worker: ${'serviceWorker' in navigator ? 'Supported' : 'Not supported'}`);
      
      if (compatibility.isCompatible) {
        addLog('🎉 Environment is compatible with FCM!');
        setStatus('🎉 Environnement compatible avec FCM!');
      } else {
        addLog('⚠️ Environment has compatibility issues');
        addLog(`Issues: ${compatibility.issues.join(', ')}`);
        addLog(`Recommendations: ${compatibility.recommendations.join(', ')}`);
        setStatus('⚠️ Environnement incompatible avec FCM. Voir les logs pour plus de détails.');
      }
    } catch (error) {
      addLog(`❌ Environment check error: ${error}`);
      setStatus('❌ Erreur lors de la vérification de l\'environnement');
    } finally {
      setIsLoading(false);
    }
  };

  // Browser notification functions
  const handleRequestBrowserPermission = async () => {
    setIsLoading(true);
    addLog('🔓 Requesting browser notification permission...');
    
    try {
      const granted = await browserNotificationService.requestPermission();
      setBrowserPermission(browserNotificationService.getPermissionStatus());
      
      if (granted) {
        addLog('✅ Browser permission granted!');
        setStatus('✅ Permission navigateur accordée! Vous pouvez maintenant tester les notifications.');
      } else {
        addLog('❌ Browser permission denied');
        setStatus('❌ Permission navigateur refusée. Les notifications ne fonctionneront pas.');
      }
    } catch (error) {
      addLog(`❌ Browser permission error: ${error}`);
      setStatus('❌ Erreur lors de la demande de permission navigateur');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestBrowserNotification = async () => {
    setIsLoading(true);
    addLog('🧪 Testing browser notification...');
    
    try {
      const success = await browserNotificationService.testNotification();
      
      if (success) {
        addLog('✅ Browser notification sent successfully');
        setStatus('✅ Notification navigateur envoyée! Vérifiez votre appareil.');
      } else {
        addLog('❌ Browser notification failed');
        setStatus('❌ Échec de l\'envoi de la notification navigateur');
      }
    } catch (error) {
      addLog(`❌ Browser test error: ${error}`);
      setStatus('❌ Erreur lors du test de notification navigateur');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestFormAssignment = async () => {
    setIsLoading(true);
    addLog('📝 Testing form assignment notification...');
    
    try {
      const success = await browserNotificationService.showFormAssignmentNotification({
        formId: 'test-form-123',
        formName: 'Formulaire de Test',
        redirectUrl: '/forms'
      });
      
      if (success) {
        addLog('✅ Form assignment notification sent');
        setStatus('✅ Notification d\'assignation envoyée!');
      } else {
        addLog('❌ Form assignment notification failed');
        setStatus('❌ Échec de la notification d\'assignation');
      }
    } catch (error) {
      addLog(`❌ Form assignment error: ${error}`);
      setStatus('❌ Erreur lors de la notification d\'assignation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestBrowserNotificationBackend = async () => {
    if (!user) {
      setStatus('❌ Utilisateur non connecté');
      return;
    }

    setIsLoading(true);
    addLog('🧪 Testing browser notification via backend...');
    
    try {
      const success = await browserNotificationService.sendTestNotificationViaBackend(user.id, fcmToken || undefined);
      
      if (success) {
        addLog('✅ Browser notification sent via backend');
        setStatus('✅ Notification navigateur envoyée via backend! Vérifiez votre appareil.');
      } else {
        addLog('❌ Browser notification via backend failed');
        setStatus('❌ Échec de l\'envoi de la notification navigateur via backend');
      }
    } catch (error) {
      addLog(`❌ Browser backend test error: ${error}`);
      setStatus('❌ Erreur lors du test de notification navigateur via backend');
    } finally {
      setIsLoading(false);
    }
  };

  // Clear logs
  const clearLogs = () => {
    setLogs([]);
  };

  // Detect platform
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

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
              <span className="text-sm">FCM Service:</span>
              {isInitialized ? (
                <span className="text-green-600 font-medium">✅ Initialisé</span>
              ) : (
                <span className="text-red-600 font-medium">❌ Non initialisé</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">Permission:</span>
              {permission === 'granted' ? (
                <span className="text-green-600 font-medium">✅ Accordée</span>
              ) : permission === 'denied' ? (
                <span className="text-red-600 font-medium">❌ Refusée</span>
              ) : (
                <span className="text-yellow-600 font-medium">⚠️ Non demandée</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">Token FCM:</span>
              {fcmToken ? (
                <span className="text-green-600 font-medium">✅ Disponible</span>
              ) : (
                <span className="text-red-600 font-medium">❌ Non disponible</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">Notifications Navigateur:</span>
              {browserSupported ? (
                browserPermission === 'granted' ? (
                  <span className="text-green-600 font-medium">✅ Activées</span>
                ) : browserPermission === 'denied' ? (
                  <span className="text-red-600 font-medium">❌ Refusées</span>
                ) : (
                  <span className="text-yellow-600 font-medium">⚠️ Non demandées</span>
                )
              ) : (
                <span className="text-red-600 font-medium">❌ Non supportées</span>
              )}
            </div>
            </div>
        </Card>

        {/* Browser Notification Permission Request */}
        {browserSupported && browserPermission !== 'granted' && (
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Zap className="w-6 h-6 text-green-600" />
              <h3 className="text-lg font-semibold">Notifications Navigateur</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Les notifications navigateur fonctionnent immédiatement avec pop-up, son et système de notifications.
            </p>
            <Button
              onClick={handleRequestBrowserPermission}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <Zap className="w-4 h-4" />
              Autoriser les notifications navigateur
            </Button>
          </Card>
        )}

        {/* Browser Notification Tests */}
        {browserSupported && browserPermission === 'granted' && (
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Zap className="w-6 h-6 text-green-600" />
              <h3 className="text-lg font-semibold">Tests Notifications Navigateur</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Testez les notifications navigateur qui apparaissent immédiatement avec pop-up et son.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                onClick={handleTestBrowserNotification}
                disabled={isLoading}
                variant="primary"
                className="flex items-center gap-2 justify-center"
              >
                <Zap className="w-4 h-4" />
                Test Direct
              </Button>
              
              <Button
                onClick={handleTestBrowserNotificationBackend}
                disabled={isLoading}
                variant="secondary"
                className="flex items-center gap-2 justify-center"
              >
                <Settings className="w-4 h-4" />
                Test Backend
              </Button>
              
              <Button
                onClick={handleTestFormAssignment}
                disabled={isLoading}
                variant="secondary"
                className="flex items-center gap-2 justify-center"
              >
                <Bell className="w-4 h-4" />
                Test Assignation
              </Button>
            </div>
          </Card>
        )}

        {/* Permission Request */}
        {permission !== 'granted' && (
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <ShieldCheck className="w-6 h-6 text-blue-600" />
              <h3 className="text-lg font-semibold">Autorisation requise</h3>
              </div>
            <p className="text-sm text-gray-600 mb-4">
              Les notifications push nécessitent votre autorisation pour fonctionner.
            </p>
            <Button
              onClick={handleRequestPermission}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              Autoriser les notifications
            </Button>
          </Card>
        )}

        {/* FCM Tests */}
        {permission === 'granted' && (
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Bell className="w-6 h-6 text-green-600" />
              <h3 className="text-lg font-semibold">Tests FCM</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Testez les notifications FCM qui apparaîtront dans le système de notifications 
              de votre appareil (comme WhatsApp).
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button 
                onClick={handleGetToken}
                disabled={isLoading || !isInitialized}
              variant="secondary" 
                className="flex items-center gap-2 justify-center"
            >
                <Settings className="w-4 h-4" />
                Obtenir Token FCM
            </Button>
              
            <Button 
                onClick={handleTestNotification}
                disabled={isLoading || !fcmToken}
                variant="primary"
                className="flex items-center gap-2 justify-center"
            >
              <Bell className="w-4 h-4" />
                Test Notification FCM
            </Button>
              
            <Button 
                onClick={handleCheckEnvironment}
                disabled={isLoading}
              variant="secondary" 
                className="flex items-center gap-2 justify-center"
            >
                <AlertCircle className="w-4 h-4" />
                Vérifier Environnement
            </Button>
          </div>
          </Card>
        )}

        {/* Visible Logs */}
        {logs.length > 0 && (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-sm">📱 Logs de Test</h4>
              <Button
                onClick={clearLogs}
                variant="secondary"
                size="sm"
                className="text-xs"
              >
                Effacer
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
      </div>
    </Layout>
  );
};

export default PushTestPage;
import React, { useCallback, useState } from 'react';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Bell, Timer, ShieldCheck, Smartphone, Monitor, TestTube } from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { PushNotificationTester } from '../components/PushNotificationTester';
import { showEnhancedNotification } from '../utils/notificationOptions';

export const PushTestPage: React.FC = () => {
  const { 
    permission, 
    requestPermission, 
    isSupported, 
    isIOS, 
    isAndroid, 
    error 
  } = usePushNotifications();
  const [status, setStatus] = useState<string>('');
  const [showComprehensiveTest, setShowComprehensiveTest] = useState(false);

  const ensurePermission = useCallback(async () => {
    console.log('🔔 [PushTest] Checking permission:', permission);
    console.log('🔔 [PushTest] Current Notification.permission:', Notification.permission);
    
    // Check actual browser permission, not just the hook state
    if (Notification.permission === 'denied') {
      setStatus('Notifications refusées au niveau du navigateur');
      return false;
    }
    
    if (Notification.permission === 'default') {
      console.log('🔔 [PushTest] Requesting permission...');
      const granted = await requestPermission();
      console.log('🔔 [PushTest] Permission request result:', granted);
      if (!granted) {
        setStatus('Permission refusée');
        return false;
      }
    }
    
    // Double-check permission after request
    if (Notification.permission !== 'granted') {
      setStatus('Permission non accordée après la demande');
      return false;
    }
    
    console.log('🔔 [PushTest] Permission confirmed as granted');
    return true;
  }, [permission, requestPermission]);

  const showLocalNotification = useCallback(async (title: string, body: string) => {
    try {
      console.log('🔔 [PushTest] Attempting to show enhanced notification:', { title, body });
      
      const success = await showEnhancedNotification(title, body, {
        tag: `ubora-push-test-${Date.now()}`,
        data: { 
          url: '/dashboard',
          test: true,
          urgent: true
        }
      });
      
      if (success) {
        console.log('🔔 [PushTest] Enhanced notification sent successfully');
        return true;
      } else {
        console.log('🔔 [PushTest] Failed to send enhanced notification');
        setStatus('Erreur lors de l\'envoi de la notification');
        return false;
      }
    } catch (error) {
      console.error('🔔 [PushTest] Failed to show enhanced notification:', error);
      setStatus('Erreur: ' + error);
      return false;
    }
  }, []);

  const handleInstant = useCallback(async () => {
    setStatus('');
    const ok = await ensurePermission();
    if (!ok) return;
    await showLocalNotification('Test Notification', 'Ceci est une notification instantanée');
    setStatus('Notification instantanée envoyée');
  }, [ensurePermission, showLocalNotification]);

  const handleDelayed = useCallback(async () => {
    setStatus('');
    const ok = await ensurePermission();
    if (!ok) return;
    setStatus('Programmée dans 10s...');
    setTimeout(async () => {
      await showLocalNotification('Test Notification (10s)', 'Ceci est une notification différée');
      setStatus('Notification différée affichée');
    }, 10000);
  }, [ensurePermission, showLocalNotification]);

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
        note: 'Full support in modern browsers'
      };
    }
  };

  const platformInfo = getPlatformInfo();

  return (
    <Layout title="Test des Notifications Push">
      <div className="space-y-6">
        {/* Quick Test Section */}
        <Card className="p-6 space-y-4">
          <div className="space-y-3 text-gray-700">
            <div>
              Utilisez ces boutons pour tester l'affichage des notifications locales (foreground). 
              Pour tester les notifications d'arrière-plan, envoyez un push FCM et fermez l'onglet.
            </div>
            
            <div className="flex items-center gap-2 text-sm text-gray-600">
              {platformInfo.icon}
              <span>Plateforme: {platformInfo.text}</span>
            </div>
            
            <div className="text-sm text-gray-600">
              {platformInfo.note}
            </div>
            
            <div className="text-sm">
              État des permissions: <span className="font-medium">
                {permission.granted ? 'autorisées' : permission.denied ? 'refusées' : 'à demander'}
              </span>
            </div>
            
            {!isSupported && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                <strong>Non supporté:</strong> {error}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={async () => {
              const ok = await requestPermission();
              setStatus(ok ? 'Notifications autorisées' : 'Autorisation refusée');
            }} variant="secondary" className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              Autoriser les notifications
            </Button>
            <Button onClick={handleInstant} className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Notification instantanée
            </Button>
            <Button onClick={handleDelayed} variant="secondary" className="flex items-center gap-2">
              <Timer className="w-4 h-4" />
              Notification après 10s
            </Button>
            <Button 
              onClick={() => setShowComprehensiveTest(!showComprehensiveTest)} 
              variant="secondary" 
              className="flex items-center gap-2"
            >
              <TestTube className="w-4 h-4" />
              {showComprehensiveTest ? 'Masquer' : 'Afficher'} Test Complet
            </Button>
            <Button 
              onClick={async () => {
                console.log('🔔 [PushTest] Enhanced direct test');
                try {
                  const success = await showEnhancedNotification(
                    'Test Direct Enhanced',
                    'Test direct avec pop-up behavior et priorité maximale',
                    {
                      tag: `test-direct-${Date.now()}`,
                      data: { 
                        url: '/dashboard',
                        test: true,
                        urgent: true
                      }
                    }
                  );
                  
                  if (success) {
                    console.log('🔔 [PushTest] Enhanced direct notification sent');
                    setStatus('Test direct enhanced envoyé avec pop-up behavior');
                  } else {
                    setStatus('Échec de l\'envoi du test direct enhanced');
                  }
                } catch (error) {
                  console.error('🔔 [PushTest] Enhanced direct notification error:', error);
                  setStatus('Erreur: ' + error);
                }
              }} 
              variant="secondary" 
              className="flex items-center gap-2"
            >
              <Bell className="w-4 h-4" />
              Test Direct Enhanced
            </Button>
            <Button 
              onClick={async () => {
                try {
                  if ('serviceWorker' in navigator) {
                    const registration = await navigator.serviceWorker.getRegistration();
                    if (registration) {
                      await registration.update();
                      setStatus('Vérification de mise à jour effectuée');
                    }
                  }
                } catch (error) {
                  console.error('Error checking for updates:', error);
                  setStatus('Erreur lors de la vérification');
                }
              }} 
              variant="secondary" 
              className="flex items-center gap-2"
            >
              <Timer className="w-4 h-4" />
              Vérifier Mise à Jour
            </Button>
          </div>
          {status && (
            <div className="text-sm text-gray-600">{status}</div>
          )}
        </Card>

        {/* Comprehensive Test Section */}
        {showComprehensiveTest && (
          <div className="bg-white rounded-lg shadow-lg">
            <PushNotificationTester />
          </div>
        )}
      </div>
    </Layout>
  );
};

export default PushTestPage;



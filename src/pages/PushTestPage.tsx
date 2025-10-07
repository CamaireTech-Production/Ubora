import React, { useCallback, useState } from 'react';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Bell, Timer, ShieldCheck } from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';

export const PushTestPage: React.FC = () => {
  const { permission, requestPermission } = usePushNotifications();
  const [status, setStatus] = useState<string>('');

  const ensurePermission = useCallback(async () => {
    if (permission.default) {
      const granted = await requestPermission();
      if (!granted) {
        setStatus('Permission refusée');
        return false;
      }
    }
    if (permission.denied) {
      setStatus('Notifications refusées au niveau du navigateur');
      return false;
    }
    return true;
  }, [permission, requestPermission]);

  const showLocalNotification = useCallback(async (title: string, body: string) => {
    try {
      if (Notification.permission === 'granted') {
        // For mobile devices, use service worker to show notifications
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          // Send message to service worker to show notification
          navigator.serviceWorker.controller.postMessage({
            type: 'SHOW_NOTIFICATION',
            payload: {
              notification: {
                title,
                body
              },
              data: {
                url: '/dev/push-test',
                timestamp: Date.now()
              }
            }
          });
        } else {
          // Fallback for desktop or when service worker not available
          new Notification(title, {
            body,
            icon: '/fav-icons/android-icon-192x192.png',
            tag: `ubora-push-test-${Date.now()}`,
          });
        }
        return true;
      }
      return false;
    } catch (e) {
      setStatus('Erreur lors de l\'affichage de la notification');
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

  return (
    <Layout title="Test des Notifications Push">
      <Card className="p-6 space-y-4">
        <div className="space-y-2 text-gray-700">
          <div>
            Utilisez ces boutons pour tester l\'affichage des notifications locales (foreground). Pour tester les notifications d\'arrière-plan, envoyez un push FCM et fermez l\'onglet.
          </div>
          <div className="text-sm text-gray-600">
            Astuce: Les notifications nécessitent un contexte sécurisé (HTTPS). En local sur mobile, utilisez une URL HTTPS (ex: ngrok) pour voir l\'invite d\'autorisation.
          </div>
          <div className="text-sm">
            État des permissions: <span className="font-medium">{permission.granted ? 'autorisées' : permission.denied ? 'refusées' : 'à demander'}</span>
          </div>
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
        </div>
        {status && (
          <div className="text-sm text-gray-600">{status}</div>
        )}
      </Card>
    </Layout>
  );
};

export default PushTestPage;



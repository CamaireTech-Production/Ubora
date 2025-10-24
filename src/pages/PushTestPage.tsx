import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Bell, ShieldCheck, CheckCircle, Clock, BarChart3, MessageSquare, Zap, Smartphone, Monitor, AlertCircle } from 'lucide-react';
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
      await unifiedNotificationService.createFormAssignmentNotification(
        'test-form-123',
        'Formulaire de Test FCM',
        user.id,
        user.role || 'employe',
        user.agencyId || '',
        'assigned',
        'Directeur Test'
      );
      setStatus('✅ Notification d\'assignation FCM envoyée! Vérifiez votre appareil.');
    } catch (error) {
      console.error('Error testing form assignment:', error);
      setStatus('❌ Erreur lors de l\'envoi de la notification d\'assignation');
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
      await unifiedNotificationService.createFormReminderNotification(
        'test-form-123',
        'Formulaire de Test FCM',
        5, // 5 minutes
        user.id,
        user.role || 'employe',
        user.agencyId || ''
      );
      setStatus('✅ Notification de rappel FCM envoyée! Vérifiez votre appareil.');
    } catch (error) {
      console.error('Error testing form reminder:', error);
      setStatus('❌ Erreur lors de l\'envoi de la notification de rappel');
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
      await unifiedNotificationService.createMetricReminderNotification(
        'test-dashboard-123',
        'Métrique de Test FCM',
        85.5,
        user.id,
        user.agencyId || '',
        'daily',
        new Date(Date.now() - 24 * 60 * 60 * 1000), // yesterday
        new Date() // today
      );
      setStatus('✅ Notification de métrique FCM envoyée! Vérifiez votre appareil.');
    } catch (error) {
      console.error('Error testing metric reminder:', error);
      setStatus('❌ Erreur lors de l\'envoi de la notification de métrique');
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
      await unifiedNotificationService.createProgrammedInstructionNotification(
        'test-instruction-123',
        'Instruction de Test FCM',
        'test-response-456',
        user.id,
        user.agencyId || '',
        'success'
      );
      setStatus('✅ Notification d\'instruction FCM envoyée! Vérifiez votre appareil.');
    } catch (error) {
      console.error('Error testing programmed instruction:', error);
      setStatus('❌ Erreur lors de l\'envoi de la notification d\'instruction');
    } finally {
      setIsLoading(false);
    }
  };

  const testBackendCronJob = async () => {
    setIsLoading(true);
    setStatus('🔄 Test du cron job backend...');
    
    try {
      const response = await fetch('/api/cron/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const result = await response.json();
        setStatus(`✅ Cron job exécuté: ${result.processed} traitées, ${result.sent} envoyées, ${result.errors} erreurs`);
      } else {
        setStatus('❌ Erreur lors de l\'exécution du cron job');
      }
    } catch (error) {
      console.error('Error testing cron job:', error);
      setStatus('❌ Erreur de connexion au cron job');
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
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={testFCMToken}
                  disabled={isLoading}
                  variant="secondary"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  Vérifier Token FCM
                </Button>
                
                <Button
                  onClick={testBackendCronJob}
                  disabled={isLoading}
                  variant="secondary"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Bell className="w-4 h-4" />
                  Test Cron Job
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

        {/* Instructions */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-6 h-6 text-blue-600" />
            <h3 className="text-lg font-semibold">Instructions de Test</h3>
          </div>
          <div className="space-y-3 text-sm text-gray-600">
            <div>
              <strong>1. Test sur Mobile (Recommandé):</strong>
              <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                <li>Utilisez Chrome sur Android ou Safari sur iOS</li>
                <li>Installez l'app comme PWA (Add to Home Screen)</li>
                <li>Vérifiez que les notifications sont autorisées</li>
              </ul>
            </div>
            <div>
              <strong>2. Résultats Attendus:</strong>
              <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                <li>Notification apparaît dans le système de notifications</li>
                <li>Son de notification joué</li>
                <li>Popup comme WhatsApp</li>
                <li>Fonctionne même quand l'app est fermée</li>
              </ul>
            </div>
            <div>
              <strong>3. Dépannage:</strong>
              <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                <li>Vérifiez les paramètres de notification du navigateur</li>
                <li>Sur Android: Désactivez l'optimisation de batterie</li>
                <li>Sur iOS: Assurez-vous que l'app est installée comme PWA</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  );
};

export default PushTestPage;
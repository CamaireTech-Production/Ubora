import React, { useState, useEffect } from 'react';
import { Layout } from '../../components/layout/Layout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Bell, ShieldCheck, AlertCircle, Settings, Smartphone, Monitor, Zap, Mail } from 'lucide-react';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { unifiedNotificationService } from '@ubora/shared/services/unifiedNotificationService';
import { browserNotificationService } from '@ubora/shared/services/browserNotificationService';
import { logger } from '@ubora/shared/utils/logger';

export const PushTestPage: React.FC = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>('default');
  const [browserSupported, setBrowserSupported] = useState(false);

  // Add log function
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    setLogs(prev => [...prev.slice(-9), logMessage]);
    logger.debug(logMessage, null, 'PushTestPage');
  };

  // Initialize browser notifications
  useEffect(() => {
    const checkBrowserSupport = () => {
      const supported = browserNotificationService.isBrowserNotificationSupported();
      const permission = browserNotificationService.getPermissionStatus();
      
      setBrowserSupported(supported);
      setBrowserPermission(permission);
      
      addLog(`🔔 Browser notifications supported: ${supported ? 'Yes' : 'No'}`);
      addLog(`🔔 Browser permission: ${permission}`);
    };

    checkBrowserSupport();
  }, []);

  const handleRequestBrowserPermission = async () => {
    setIsLoading(true);
    addLog('🔔 Requesting browser notification permission...');
    
    try {
      const granted = await browserNotificationService.requestPermission();
      const newPermission = browserNotificationService.getPermissionStatus();
      setBrowserPermission(newPermission);
      
      if (granted) {
        addLog('✅ Browser notification permission granted');
      } else {
        addLog('❌ Browser notification permission denied');
      }
    } catch (error) {
      addLog(`❌ Error requesting permission: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestBrowserNotification = async () => {
    setIsLoading(true);
    addLog('🔔 Testing direct browser notification...');
    
    try {
      const success = await browserNotificationService.testNotification();
      if (success) {
        addLog('✅ Direct browser notification sent');
      } else {
        addLog('❌ Direct browser notification failed');
      }
    } catch (error) {
      addLog(`❌ Error testing browser notification: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnhancedBrowserTest = async () => {
    setIsLoading(true);
    addLog('🔔 Testing enhanced browser notification...');
    
    try {
      // Test browser environment
      addLog(`🌐 Browser: ${navigator.userAgent.split(' ')[0]}`);
      addLog(`🔒 Secure Context: ${window.isSecureContext ? 'Yes' : 'No'}`);
      addLog(`👁️ Document Visibility: ${document.visibilityState}`);
      addLog(`🎯 Window Focused: ${document.hasFocus() ? 'Yes' : 'No'}`);
      
      // Test basic notification first
      addLog('📱 Testing basic notification...');
      const basicNotification = new Notification('Basic Test', {
        body: 'This is a basic notification test',
        icon: '/fav-icons/android-icon-192x192.png',
        requireInteraction: true,
        silent: false
      });
      
      basicNotification.onclick = () => {
        addLog('✅ Basic notification clicked');
        basicNotification.close();
      };
      
      basicNotification.onshow = () => {
        addLog('✅ Basic notification is visible');
      };
      
      basicNotification.onerror = (error) => {
        addLog(`❌ Basic notification error: ${error}`);
      };
      
      addLog('✅ Basic notification created');
      
      // Wait a moment, then test with full service
      setTimeout(async () => {
        addLog('🔔 Testing full browser notification service...');
        const success = await browserNotificationService.testNotification();
        if (success) {
          addLog('✅ Full browser notification service test passed');
        } else {
          addLog('❌ Full browser notification service test failed');
        }
        setIsLoading(false);
      }, 2000);
      
    } catch (error) {
      addLog(`❌ Error in enhanced browser test: ${error}`);
      setIsLoading(false);
    }
  };

  const handleTestUnifiedNotification = async (type: 'form_assignment' | 'form_reminder' | 'metric_reminder' | 'programmed_instruction') => {
    if (!user) {
      addLog('❌ No user logged in');
      return;
    }

    setIsLoading(true);
    addLog(`🔔 Testing unified notification: ${type}...`);

    try {
      let notificationId: string;

      switch (type) {
        case 'form_assignment':
          notificationId = await unifiedNotificationService.createFormAssignmentNotification(
            'test-form-id',
            'Test Formulaire',
            user.id,
            user.role === 'admin' || user.role === 'directeur' ? 'directeur' : 'employe',
            user.agencyId || 'test-agency',
            'assigned',
            'Test User',
            user.email || undefined // emailAddress
          );
          break;

        case 'form_reminder':
          notificationId = await unifiedNotificationService.createFormReminderNotification(
            'test-form-id',
            'Test Formulaire',
            user.id,
            user.role === 'admin' || user.role === 'directeur' ? 'directeur' : 'employe',
            user.agencyId || 'test-agency',
            '5min',
            user.email || undefined // emailAddress
          );
          break;

        case 'metric_reminder':
          notificationId = await unifiedNotificationService.createMetricReminderNotification(
            'test-dashboard-id',
            'test-metric-id',
            'Test Métrique',
            100,
            user.id,
            user.agencyId || 'test-agency',
            user.email || undefined // emailAddress
          );
          break;

        case 'programmed_instruction':
          notificationId = await unifiedNotificationService.createProgrammedInstructionNotification(
            'test-instruction-id',
            'Test Instruction',
            user.id,
            user.agencyId || 'test-agency',
            user.email || undefined // emailAddress
          );
          break;
      }

      addLog(`✅ Unified notification sent: ${notificationId}`);
      addLog(`📊 Type: ${type}`);
      addLog(`👤 User: ${user.email || user.id}`);
      addLog(`🔔 Browser: ${browserPermission === 'granted' ? 'Will attempt' : 'Skipped (no permission)'}`);
      addLog(`📱 FCM: ${'Will attempt if token available'}`);
      addLog(`📧 Email: ${user.email ? `Will attempt (${user.email})` : 'Skipped (no email)'}`);

    } catch (error) {
      addLog(`❌ Error testing unified notification: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout title="Test des Notifications">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Test des Notifications Unifiées
            </h1>
            <p className="text-gray-600">
              Testez le système de notifications triple (Browser → FCM → Email)
            </p>
            </div>
            
          {/* Platform Info */}
          <Card className="p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Settings className="w-6 h-6 text-blue-600" />
              <h3 className="text-lg font-semibold">Informations Plateforme</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-gray-500" />
                <span>Navigateur: {typeof window !== 'undefined' ? 'Web' : 'Unknown'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-gray-500" />
                <span>Notifications: {browserSupported ? 'Supportées' : 'Non supportées'}</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-gray-500" />
                <span>Permission: {browserPermission}</span>
              </div>
            </div>
          </Card>

          {/* Browser Notification Permission */}
          {browserSupported && browserPermission !== 'granted' && (
            <Card className="p-6 mb-6">
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
            <Card className="p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Zap className="w-6 h-6 text-green-600" />
              <h3 className="text-lg font-semibold">Tests Notifications Navigateur</h3>
            </div>
              <p className="text-sm text-gray-600 mb-6">
                Testez les notifications navigateur qui apparaissent immédiatement avec pop-up et son.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  onClick={handleEnhancedBrowserTest}
                  disabled={isLoading}
                  variant="secondary"
                  className="flex items-center gap-2 justify-center"
                >
                  <Settings className="w-4 h-4" />
                  Test Enhanced
                </Button>
              </div>
            </Card>
          )}

          {/* Unified Notification Tests */}
          <Card className="p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Bell className="w-6 h-6 text-blue-600" />
              <h3 className="text-lg font-semibold">Tests Notifications Unifiées</h3>
          </div>
            <p className="text-sm text-gray-600 mb-6">
              Testez le système unifié qui tente Browser → FCM → Email (toutes les méthodes).
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Button
                onClick={() => handleTestUnifiedNotification('form_assignment')}
                disabled={isLoading}
                variant="secondary"
                className="flex items-center gap-2 justify-center"
              >
              <Bell className="w-4 h-4" />
                Assignation Formulaire
            </Button>

            <Button 
                onClick={() => handleTestUnifiedNotification('form_reminder')}
                disabled={isLoading}
              variant="secondary" 
                className="flex items-center gap-2 justify-center"
            >
                <Bell className="w-4 h-4" />
                Rappel Formulaire
            </Button>

            <Button 
                onClick={() => handleTestUnifiedNotification('metric_reminder')}
                disabled={isLoading}
              variant="secondary" 
                className="flex items-center gap-2 justify-center"
            >
              <Bell className="w-4 h-4" />
                Rappel Métrique
            </Button>

            <Button 
                onClick={() => handleTestUnifiedNotification('programmed_instruction')}
                disabled={isLoading}
              variant="secondary" 
                className="flex items-center gap-2 justify-center"
            >
                <Bell className="w-4 h-4" />
                Instruction Programmée
            </Button>
          </div>
          </Card>

          {/* Delivery Methods Info */}
          <Card className="p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Settings className="w-6 h-6 text-purple-600" />
              <h3 className="text-lg font-semibold">Méthodes de Livraison</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <Zap className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <h4 className="font-semibold text-green-800">1. Browser</h4>
                <p className="text-sm text-green-600">Pop-up immédiat, son, système</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <Smartphone className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <h4 className="font-semibold text-blue-800">2. FCM</h4>
                <p className="text-sm text-blue-600">Push mobile, background</p>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <Mail className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                <h4 className="font-semibold text-orange-800">3. Email</h4>
                <p className="text-sm text-orange-600">Livraison universelle</p>
              </div>
            </div>
        </Card>

          {/* Logs */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-gray-600" />
              <h3 className="text-lg font-semibold">Logs en Temps Réel</h3>
            </div>
            <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm h-64 overflow-y-auto">
              {logs.length === 0 ? (
                <div className="text-gray-500">Aucun log pour le moment...</div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="mb-1">
                    {log}
          </div>
                ))
        )}
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default PushTestPage;
import React, { useState } from 'react';
import { Button } from './Button';
import { Card } from './Card';
import { Bell, BellOff, Settings, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';

export const PushNotificationSettings: React.FC = () => {
  const {
    isSupported,
    permission,
    isSubscribed,
    error,
    subscribe,
    unsubscribe,
    requestPermission,
  } = usePushNotifications();

  const [isLoading, setIsLoading] = useState(false);

  const handleToggleNotifications = async () => {
    setIsLoading(true);
    try {
      if (isSubscribed) {
        await unsubscribe();
      } else {
        await subscribe();
      }
    } catch (error) {
      console.error('Error toggling notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestPermission = async () => {
    setIsLoading(true);
    try {
      await requestPermission();
    } catch (error) {
      console.error('Error requesting permission:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isSupported) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <BellOff className="w-6 h-6 text-gray-500" />
          <h3 className="text-lg font-semibold">Notifications Push</h3>
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <AlertCircle className="w-5 h-5" />
          <span>Les notifications push ne sont pas supportées sur ce navigateur.</span>
        </div>
      </Card>
    );
  }

  const getStatusIcon = () => {
    if (permission.denied) {
      return <XCircle className="w-5 h-5 text-red-500" />;
    }
    if (isSubscribed) {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    }
    return <AlertCircle className="w-5 h-5 text-yellow-500" />;
  };

  const getStatusText = () => {
    if (permission.denied) {
      return 'Notifications refusées';
    }
    if (isSubscribed) {
      return 'Notifications activées';
    }
    if (permission.default) {
      return 'Permissions requises';
    }
    return 'Notifications désactivées';
  };

  const getStatusColor = () => {
    if (permission.denied) {
      return 'text-red-600';
    }
    if (isSubscribed) {
      return 'text-green-600';
    }
    if (permission.default) {
      return 'text-yellow-600';
    }
    return 'text-gray-600';
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <Bell className="w-6 h-6 text-blue-600" />
        <h3 className="text-lg font-semibold">Notifications Push</h3>
      </div>

      <div className="space-y-4">
        {/* Status */}
        <div className="flex items-center gap-3">
          {getStatusIcon()}
          <span className={`font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Description */}
        <div className="text-gray-600 text-sm">
          <p>Recevez des notifications pour :</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Nouvelles soumissions de formulaires</li>
            <li>Messages du directeur</li>
            <li>Mises à jour importantes</li>
            <li>Rappels et alertes</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {permission.default && (
            <Button
              onClick={handleRequestPermission}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <Bell className="w-4 h-4" />
              Autoriser les notifications
            </Button>
          )}

          {permission.granted && (
            <Button
              onClick={handleToggleNotifications}
              disabled={isLoading}
              variant={isSubscribed ? "secondary" : "primary"}
              className="flex items-center gap-2"
            >
              {isSubscribed ? (
                <>
                  <BellOff className="w-4 h-4" />
                  Désactiver
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4" />
                  Activer
                </>
              )}
            </Button>
          )}

          {permission.denied && (
            <div className="text-sm text-gray-600">
              <p>Les notifications ont été refusées. Pour les réactiver :</p>
              <ol className="list-decimal list-inside mt-2 space-y-1">
                <li>Cliquez sur l'icône de cadenas dans la barre d'adresse</li>
                <li>Sélectionnez "Autoriser" pour les notifications</li>
                <li>Rechargez la page</li>
              </ol>
            </div>
          )}
        </div>

        {/* Platform info */}
        <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
          <p className="font-medium mb-1">Support des notifications :</p>
          <ul className="space-y-1">
            <li>✅ Android (PWA installée)</li>
            <li>✅ Desktop (Windows, Mac, Linux)</li>
            <li>⚠️ iOS (limitations Safari)</li>
          </ul>
        </div>
      </div>
    </Card>
  );
};


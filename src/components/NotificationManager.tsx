import React, { useState, useEffect } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { fcmService, FCMNotification, FCMDeliveryLog } from '../services/fcmService';
import { useAuth } from '../hooks/useAuth';
import { Bell, Send, Users, User, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

interface NotificationManagerProps {
  className?: string;
}

export const NotificationManager: React.FC<NotificationManagerProps> = ({ className }) => {
  const { user } = useAuth();
  const [notification, setNotification] = useState<FCMNotification>({
    title: '',
    body: '',
    data: {}
  });
  const [targetType, setTargetType] = useState<'user' | 'role' | 'broadcast'>('user');
  const [targetValue, setTargetValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<FCMDeliveryLog[] | null>(null);
  const [recentLogs, setRecentLogs] = useState<FCMDeliveryLog[]>([]);

  // Load recent delivery logs
  useEffect(() => {
    const loadRecentLogs = async () => {
      try {
        const logs = await fcmService.getRecentDeliveryLogs(10);
        setRecentLogs(logs);
      } catch (error) {
        console.error('Error loading recent logs:', error);
      }
    };

    loadRecentLogs();
  }, []);

  const handleSend = async () => {
    if (!notification.title || !notification.body) {
      alert('Veuillez remplir le titre et le message');
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      let deliveryLogs: FCMDeliveryLog[] = [];

      switch (targetType) {
        case 'user':
          if (!targetValue) {
            alert('Veuillez spécifier un ID utilisateur');
            return;
          }
          const userResult = await fcmService.sendToUser(notification, targetValue);
          deliveryLogs = userResult ? [userResult] : [];
          break;

        case 'role':
          if (!targetValue) {
            alert('Veuillez spécifier un rôle');
            return;
          }
          deliveryLogs = await fcmService.sendToRole(notification, targetValue);
          break;

        case 'broadcast':
          deliveryLogs = await fcmService.sendBroadcast(notification);
          break;
      }

      setResult(deliveryLogs);
      
      // Reload recent logs
      const logs = await fcmService.getRecentDeliveryLogs(10);
      setRecentLogs(logs);

    } catch (error) {
      console.error('Error sending notification:', error);
      alert('Erreur lors de l\'envoi: ' + (error instanceof Error ? error.message : 'Erreur inconnue'));
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'sent':
        return 'Envoyé';
      case 'delivered':
        return 'Livré';
      case 'failed':
        return 'Échec';
      default:
        return 'Inconnu';
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Send Notification Form */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Envoyer une notification
        </h3>

        <div className="space-y-4">
          {/* Target Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cible
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="user"
                  checked={targetType === 'user'}
                  onChange={(e) => setTargetType(e.target.value as 'user')}
                  className="text-blue-600"
                />
                <User className="w-4 h-4" />
                Utilisateur spécifique
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="role"
                  checked={targetType === 'role'}
                  onChange={(e) => setTargetType(e.target.value as 'role')}
                  className="text-blue-600"
                />
                <Users className="w-4 h-4" />
                Rôle
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="broadcast"
                  checked={targetType === 'broadcast'}
                  onChange={(e) => setTargetType(e.target.value as 'broadcast')}
                  className="text-blue-600"
                />
                <Bell className="w-4 h-4" />
                Diffusion générale
              </label>
            </div>
          </div>

          {/* Target Value Input */}
          {targetType !== 'broadcast' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {targetType === 'user' ? 'ID Utilisateur' : 'Rôle'}
              </label>
              <input
                type="text"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder={targetType === 'user' ? 'user123' : 'employee'}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Notification Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Titre
            </label>
            <input
              type="text"
              value={notification.title}
              onChange={(e) => setNotification(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Titre de la notification"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message
            </label>
            <textarea
              value={notification.body}
              onChange={(e) => setNotification(prev => ({ ...prev, body: e.target.value }))}
              placeholder="Contenu de la notification"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Données supplémentaires (JSON)
            </label>
            <textarea
              value={JSON.stringify(notification.data, null, 2)}
              onChange={(e) => {
                try {
                  const data = JSON.parse(e.target.value);
                  setNotification(prev => ({ ...prev, data }));
                } catch {
                  // Invalid JSON, keep the text for editing
                }
              }}
              placeholder='{"key": "value"}'
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
          </div>

          <Button
            onClick={handleSend}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            {isLoading ? 'Envoi en cours...' : 'Envoyer'}
          </Button>
        </div>
      </Card>

      {/* Results */}
      {result && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Résultats</h3>
          <div className="space-y-2">
            {result.map((log) => (
              <div key={log.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  {getStatusIcon(log.status)}
                  <div>
                    <div className="font-medium">{getStatusText(log.status)}</div>
                    <div className="text-sm text-gray-600">
                      {log.userId} • {log.platform}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recent Delivery Logs */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Logs récents</h3>
        <div className="space-y-2">
          {recentLogs.map((log) => (
            <div key={log.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                {getStatusIcon(log.status)}
                <div>
                  <div className="font-medium">{log.notificationId}</div>
                  <div className="text-sm text-gray-600">
                    {log.userId} • {log.platform} • {getStatusText(log.status)}
                  </div>
                  {log.error && (
                    <div className="text-sm text-red-600">{log.error}</div>
                  )}
                </div>
              </div>
              <div className="text-sm text-gray-500">
                {new Date(log.timestamp).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};



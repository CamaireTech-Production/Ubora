import React, { useState } from 'react';
import { Button } from './Button';
import { Card } from './Card';
import { Bell, Send, AlertCircle } from 'lucide-react';
import { notificationService } from '../services/notificationService';
import { useAuth } from '../contexts/AuthContext';

export const NotificationTestPanel: React.FC = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const sendTestNotification = async () => {
    if (!user || !message.trim()) return;

    setIsLoading(true);
    try {
      if (user.role === 'directeur') {
        // Send to all employees
        await notificationService.sendToRole('employe', {
          title: 'Test de notification',
          body: message,
          type: 'director_message',
          data: { test: true, from: user.name }
        });
      } else {
        // Send to all directors
        await notificationService.sendToRole('directeur', {
          title: 'Test de notification',
          body: message,
          type: 'system_alert',
          data: { test: true, from: user.name }
        });
      }
      
      setMessage('');
      alert('Notification envoyée avec succès!');
    } catch (error) {
      console.error('Error sending test notification:', error);
      alert('Erreur lors de l\'envoi de la notification');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <Bell className="w-6 h-6 text-blue-600" />
        <h3 className="text-lg font-semibold">Test des Notifications</h3>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Message de test
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tapez votre message de test ici..."
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
          />
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-600">
          <AlertCircle className="w-4 h-4" />
          <span>
            {user.role === 'directeur' 
              ? 'Ce message sera envoyé à tous les employés'
              : 'Ce message sera envoyé à tous les directeurs'
            }
          </span>
        </div>

        <Button
          onClick={sendTestNotification}
          disabled={isLoading || !message.trim()}
          className="flex items-center gap-2"
        >
          <Send className="w-4 h-4" />
          {isLoading ? 'Envoi...' : 'Envoyer le test'}
        </Button>
      </div>
    </Card>
  );
};


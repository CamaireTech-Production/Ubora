import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { PushNotificationSettings } from '../components/PushNotificationSettings';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Bell, CheckCircle, XCircle, Clock, Trash2, BarChart3, MessageSquare } from 'lucide-react';
import { WireframeLoader } from '../components/loading/WireframeLoader';
import { unifiedNotificationService, UnifiedNotification } from '../services/unifiedNotificationService';
import { useAuth } from '../contexts/AuthContext';
import { doc, collection, query, where, orderBy, limit, onSnapshot, writeBatch } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export const NotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<UnifiedNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    if (!user) return;

    setIsLoading(true);

    // Create query based on user role
    let notificationsQuery;
    if (user.role === 'directeur') {
      // For directors, get notifications for their role
      notificationsQuery = query(
        collection(db, 'notifications'),
        where('recipientRole', '==', 'directeur'),
        where('agencyId', '==', user.agencyId),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
    } else {
      // For employees, get notifications for their user ID
      notificationsQuery = query(
        collection(db, 'notifications'),
        where('recipientId', '==', user.id),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
    }

    // Set up real-time listener
    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      
      const userNotifications: UnifiedNotification[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        scheduledFor: doc.data().scheduledFor?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        sentAt: doc.data().sentAt?.toDate(),
      } as UnifiedNotification));

      setNotifications(userNotifications);
      setIsLoading(false);
    }, (error) => {
      console.error('🔔 [NotificationsPage] Error listening to notifications:', error);
      setIsLoading(false);
    });

    // Cleanup listener on unmount or user change
    return () => {
      unsubscribe();
    };
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    try {
      await unifiedNotificationService.markAsRead(notificationId);
      // Real-time listener will automatically update the UI
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(n => !n.read);
      await Promise.all(
        unreadNotifications.map(notif => 
          notif.id ? unifiedNotificationService.markAsRead(notif.id) : Promise.resolve()
        )
      );
      // Real-time listener will automatically update the UI
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const deleteAllNotifications = async () => {
    if (!user || notifications.length === 0) return;
    
    if (!confirm('Êtes-vous sûr de vouloir supprimer toutes les notifications ? Cette action est irréversible.')) {
      return;
    }

    try {
      const batch = writeBatch(db);
      
      // Delete all notifications in batches (Firestore batch limit is 500)
      const notificationsToDelete = notifications.slice(0, 500);
      
      notificationsToDelete.forEach(notification => {
        if (notification.id) {
          const notificationRef = doc(db, 'notifications', notification.id);
          batch.delete(notificationRef);
        }
      });
      
      await batch.commit();
    } catch (error) {
      console.error('Error deleting all notifications:', error);
      alert('Erreur lors de la suppression des notifications');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'form_assignment':
        return <CheckCircle className="w-5 h-5 text-purple-500" />;
      case 'form_reminder':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'metric_reminder':
        return <BarChart3 className="w-5 h-5 text-blue-500" />;
      case 'program_instruction':
        return <MessageSquare className="w-5 h-5 text-green-500" />;
      case 'form_submission':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'director_message':
        return <Bell className="w-5 h-5 text-blue-500" />;
      case 'system_alert':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Date inconnue';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Filter notifications based on selected filters
  const filteredNotifications = notifications.filter(notification => {
    const typeMatch = filterType === 'all' || notification.type === filterType;
    const statusMatch = filterStatus === 'all' || notification.status === filterStatus;
    return typeMatch && statusMatch;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Envoyée</span>;
      case 'scheduled':
        return <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">Programmée</span>;
      case 'delayed':
        return <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">Retardée</span>;
      case 'failed':
        return <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">Échouée</span>;
      default:
        return <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">Inconnue</span>;
    }
  };

  const handleNotificationClick = (notification: UnifiedNotification) => {
    // Mark as read
    if (notification.id) {
      markAsRead(notification.id);
    }

    // Navigate based on notification data
    if (notification.data?.formId) {
      if (notification.data.action === 'form_assigned' || notification.data.action === 'form_created') {
        window.location.href = '/forms';
      } else if (notification.data.action === 'form_reminder') {
        window.location.href = '/forms';
      }
    } else if (notification.data?.dashboardId) {
      window.location.href = '/directeur/dashboard';
    } else if (notification.data?.scheduledQuestionId) {
      window.location.href = '/scheduled-questions';
    }
  };

  // Test functions for each notification type
  const testFormAssignment = async () => {
    try {
      await unifiedNotificationService.sendNotification({
        title: "Nouveau formulaire assigné",
        body: "Un nouveau formulaire 'Évaluation Q1 2024' vous a été assigné. Veuillez le compléter avant le 15 mars.",
        type: 'form_assignment',
        recipientId: user?.id || '',
        recipientRole: user?.role as 'directeur' | 'employe',
        agencyId: user?.agencyId || '',
        data: {
          formId: 'test-form-123',
          action: 'form_assigned',
          formTitle: 'Évaluation Q1 2024',
          dueDate: '2024-03-15'
        }
      });
      alert('Notification de test "Assignation formulaire" envoyée !');
    } catch (error) {
      console.error('Error sending test notification:', error);
      alert('Erreur lors de l\'envoi de la notification de test');
    }
  };

  const testFormReminder = async () => {
    try {
      await unifiedNotificationService.sendNotification({
        title: "Rappel formulaire",
        body: "N'oubliez pas de compléter le formulaire 'Rapport mensuel' avant la fin de la semaine.",
        type: 'form_reminder',
        recipientId: user?.id || '',
        recipientRole: user?.role as 'directeur' | 'employe',
        agencyId: user?.agencyId || '',
        data: {
          formId: 'test-form-456',
          action: 'form_reminder',
          formTitle: 'Rapport mensuel',
          urgency: 'high'
        }
      });
      alert('Notification de test "Rappel formulaire" envoyée !');
    } catch (error) {
      console.error('Error sending test notification:', error);
      alert('Erreur lors de l\'envoi de la notification de test');
    }
  };

  const testMetricReminder = async () => {
    try {
      await unifiedNotificationService.sendNotification({
        title: "Rappel métrique",
        body: "Vos métriques de performance pour ce mois sont disponibles. Consultez votre dashboard pour plus de détails.",
        type: 'metric_reminder',
        recipientId: user?.id || '',
        recipientRole: user?.role as 'directeur' | 'employe',
        agencyId: user?.agencyId || '',
        data: {
          dashboardId: 'test-dashboard-789',
          action: 'metric_reminder',
          period: '2024-03',
          metrics: ['performance', 'productivity', 'satisfaction']
        }
      });
      alert('Notification de test "Rappel métrique" envoyée !');
    } catch (error) {
      console.error('Error sending test notification:', error);
      alert('Erreur lors de l\'envoi de la notification de test');
    }
  };

  const testProgramInstruction = async () => {
    try {
      await unifiedNotificationService.sendNotification({
        title: "Instruction programmée",
        body: "Nouvelle instruction: Veuillez mettre à jour vos informations de contact dans votre profil avant le 20 mars.",
        type: 'program_instruction',
        recipientId: user?.id || '',
        recipientRole: user?.role as 'directeur' | 'employe',
        agencyId: user?.agencyId || '',
        data: {
          scheduledQuestionId: 'test-instruction-101',
          action: 'program_instruction',
          instruction: 'Mise à jour des informations de contact',
          dueDate: '2024-03-20'
        }
      });
      alert('Notification de test "Instruction programmée" envoyée !');
    } catch (error) {
      console.error('Error sending test notification:', error);
      alert('Erreur lors de l\'envoi de la notification de test');
    }
  };

  return (
    <Layout title="Notifications">
      <div className="space-y-6">
        {/* Push Notification Settings */}
        <PushNotificationSettings />

        {/* Test Notification Buttons */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <MessageSquare className="w-6 h-6 text-green-600" />
            <h3 className="text-lg font-semibold">Tester les notifications</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Cliquez sur les boutons ci-dessous pour tester les 4 types de notifications disponibles.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <Button
              onClick={testFormAssignment}
              variant="secondary"
              size="sm"
              className="flex items-center gap-2 justify-center"
            >
              <CheckCircle className="w-4 h-4 text-purple-500" />
              Test Assignation
            </Button>
            <Button
              onClick={testFormReminder}
              variant="secondary"
              size="sm"
              className="flex items-center gap-2 justify-center"
            >
              <Clock className="w-4 h-4 text-yellow-500" />
              Test Rappel
            </Button>
            <Button
              onClick={testMetricReminder}
              variant="secondary"
              size="sm"
              className="flex items-center gap-2 justify-center"
            >
              <BarChart3 className="w-4 h-4 text-blue-500" />
              Test Métrique
            </Button>
            <Button
              onClick={testProgramInstruction}
              variant="secondary"
              size="sm"
              className="flex items-center gap-2 justify-center"
            >
              <MessageSquare className="w-4 h-4 text-green-500" />
              Test Instruction
            </Button>
          </div>
        </Card>

        {/* Notifications List */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Bell className="w-6 h-6 text-blue-600" />
              <h3 className="text-lg font-semibold">Historique des notifications</h3>
              {unreadCount > 0 && (
                <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                  {unreadCount} non lues
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {notifications.length > 0 && (
                <Button
                  onClick={deleteAllNotifications}
                  variant="danger"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Supprimer tout
                </Button>
              )}
              {unreadCount > 0 && (
                <Button
                  onClick={markAllAsRead}
                  variant="secondary"
                  size="sm"
                >
                  Tout marquer comme lu
                </Button>
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Type:</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tous</option>
                <option value="form_assignment">Assignation formulaire</option>
                <option value="form_reminder">Rappel formulaire</option>
                <option value="metric_reminder">Rappel métrique</option>
                <option value="program_instruction">Instruction programmée</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Statut:</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tous</option>
                <option value="sent">Envoyées</option>
                <option value="scheduled">Programmées</option>
                <option value="delayed">Retardées</option>
                <option value="failed">Échouées</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <WireframeLoader type="notification" count={5} />
          ) : filteredNotifications.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                {notifications.length === 0 
                  ? 'Aucune notification pour le moment' 
                  : 'Aucune notification correspondant aux filtres'
                }
              </p>
            </div>
          ) : (
            <div 
              className="max-h-96 overflow-y-auto space-y-3 pr-2"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#CBD5E0 #F7FAFC'
              }}
            >
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    notification.read 
                      ? 'bg-gray-50 border-gray-200' 
                      : 'bg-blue-50 border-blue-200'
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-3">
                    {getNotificationIcon(notification.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className={`font-medium ${
                          notification.read ? 'text-gray-700' : 'text-gray-900'
                        }`}>
                          {notification.title}
                        </h4>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(notification.status)}
                          {!notification.read && (
                            <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0"></div>
                          )}
                        </div>
                      </div>
                      <p className={`text-sm mt-1 ${
                        notification.read ? 'text-gray-500' : 'text-gray-600'
                      }`}>
                        {notification.body}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-gray-400">
                          {formatDate(notification.createdAt)}
                        </p>
                        {notification.scheduledFor && (
                          <p className="text-xs text-blue-500">
                            Programmée: {formatDate(notification.scheduledFor)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
};

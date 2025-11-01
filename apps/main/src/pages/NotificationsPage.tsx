import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { PushNotificationSettings } from '../components/PushNotificationSettings';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Bell, CheckCircle, XCircle, Clock, Trash2, BarChart3, MessageSquare, AlertCircle, Settings } from 'lucide-react';
import { WireframeLoader } from '../components/loading/WireframeLoader';
import { unifiedNotificationService, UnifiedNotification } from '../services/unifiedNotificationService';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { doc, collection, query, where, orderBy, limit, onSnapshot, writeBatch } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export const NotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const { permission, isSupported, requestPermission } = usePushNotifications();
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
      console.log('🔍 [NotificationsPage] Setting up query for directeur:', {
        role: user.role,
        userId: user.id,
        agencyId: user.agencyId
      });
      notificationsQuery = query(
        collection(db, 'notifications'),
        where('recipientRole', '==', 'directeur'),
        where('agencyId', '==', user.agencyId),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
    } else {
      // For employees, get notifications for their user ID
      console.log('🔍 [NotificationsPage] Setting up query for employe:', {
        role: user.role,
        userId: user.id,
        recipientId: user.id
      });
      notificationsQuery = query(
        collection(db, 'notifications'),
        where('recipientId', '==', user.id),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
    }

    // Set up real-time listener
    const unsubscribe = onSnapshot(notificationsQuery, async (snapshot) => {
      console.log('🔍 [NotificationsPage] Firestore snapshot received:', {
        totalDocs: snapshot.docs.length,
        userRole: user.role,
        userId: user.id,
        agencyId: user.agencyId
      });
      
      const userNotifications: UnifiedNotification[] = snapshot.docs.map(doc => {
        const data = doc.data();
        console.log('🔍 [NotificationsPage] Notification document:', {
          id: doc.id,
          recipientId: data.recipientId,
          recipientRole: data.recipientRole,
          agencyId: data.agencyId,
          type: data.type,
          title: data.title,
          status: data.status
        });
        return {
          id: doc.id,
          ...data,
          scheduledFor: data.scheduledFor?.toDate(),
          createdAt: data.createdAt?.toDate(),
          sentAt: data.sentAt?.toDate(),
        } as UnifiedNotification;
      });
      
      console.log('🔍 [NotificationsPage] Mapped notifications:', userNotifications.length, 'notifications found');

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
      case 'scheduled_instruction':
        return <MessageSquare className="w-5 h-5 text-indigo-500" />;
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

    // Preferred redirect path from notification
    const path = notification.data?.redirectPath || notification.redirectUrl || '/';
    const isAbsolute = /^https?:\/\//i.test(path);
    const target = isAbsolute ? path : `${window.location.origin}${path}`;
    window.location.assign(target);
  };


  return (
    <Layout title="Notifications">
      <div className="space-y-6">
        {/* Push Notification Settings */}
        <PushNotificationSettings />

        {/* FCM Test Page Access */}
        {/* <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <TestTube className="w-6 h-6 text-purple-600" />
            <h3 className="text-lg font-semibold">Tests FCM Push Notifications</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Testez les notifications FCM réelles sur votre appareil mobile (Android/iOS) 
            pour vérifier que les notifications apparaissent dans le système de notifications.
          </p>
          <Button
            onClick={() => window.location.href = '/dev/push-test'}
            className="flex items-center gap-2"
          >
            <TestTube className="w-4 h-4" />
            Ouvrir la page de test FCM
          </Button>
        </Card> */}

        {/* Test Notification Buttons */}
        {/* <Card className="p-6">
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
        </Card> */}

        {/* Notifications List */}
        <Card className="p-6">
          {/* Title Row */}
          <div className="flex items-center gap-3 mb-4">
            <Bell className="w-6 h-6 text-blue-600" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold">Historique des notifications</h3>
              {/* Notification permission status */}
              {!isSupported ? (
                <div className="flex items-center gap-1 mt-1">
                  <XCircle className="w-4 h-4 text-red-500" />
                  <span className="text-xs text-red-600">Notifications non supportées</span>
                </div>
              ) : permission.denied ? (
                <div className="flex items-center gap-1 mt-1">
                  <XCircle className="w-4 h-4 text-red-500" />
                  <span className="text-xs text-red-600">Notifications désactivées</span>
                </div>
              ) : permission.default ? (
                <div className="flex items-center gap-1 mt-1">
                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                  <span className="text-xs text-yellow-600">Notifications non autorisées</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 mt-1">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-xs text-green-600">Notifications activées</span>
                </div>
              )}
            </div>
            {unreadCount > 0 && (
              <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                {unreadCount} non lues
              </span>
            )}
          </div>

          {/* Action Buttons Row */}
          <div className="flex flex-wrap items-center gap-2 mb-6">
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
                className="flex items-center gap-2"
              >
                Tout marquer comme lu
              </Button>
            )}
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
                <option value="scheduled_instruction">Instruction programmée (réponse)</option>
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
              {!isSupported ? (
                // Browser doesn't support notifications
                <div className="max-w-md mx-auto">
              <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-700 mb-2">Notifications non supportées</h3>
                  <p className="text-gray-500 mb-4">
                    Votre navigateur ne supporte pas les notifications push. 
                    Veuillez utiliser un navigateur moderne comme Chrome, Firefox ou Edge.
                  </p>
                </div>
              ) : permission.denied ? (
                // Permission denied
                <div className="max-w-md mx-auto">
                  <XCircle className="w-12 h-12 text-red-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-700 mb-2">Notifications désactivées</h3>
                  <p className="text-gray-500 mb-4">
                    Les notifications ont été refusées. Pour les réactiver :
                  </p>
                  <div className="text-left bg-gray-50 p-4 rounded-lg mb-4">
                    <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
                      <li>Cliquez sur l'icône de cadenas dans la barre d'adresse</li>
                      <li>Sélectionnez "Autoriser" pour les notifications</li>
                      <li>Rechargez la page</li>
                    </ol>
                  </div>
                  <Button
                    onClick={() => window.location.reload()}
                    variant="secondary"
                    className="flex items-center gap-2 mx-auto"
                  >
                    <Settings className="w-4 h-4" />
                    Recharger la page
                  </Button>
                </div>
              ) : permission.default ? (
                // Permission not requested yet
                <div className="max-w-md mx-auto">
                  <AlertCircle className="w-12 h-12 text-yellow-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-700 mb-2">Activer les notifications</h3>
                  <p className="text-gray-500 mb-4">
                    Autorisez les notifications pour recevoir des alertes importantes 
                    sur vos formulaires, rappels et instructions.
                  </p>
                  <Button
                    onClick={requestPermission}
                    className="flex items-center gap-2 mx-auto"
                  >
                    <Bell className="w-4 h-4" />
                    Autoriser les notifications
                  </Button>
                </div>
              ) : notifications.length === 0 ? (
                // No notifications yet
                <div className="max-w-md mx-auto">
                  <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-700 mb-2">Aucune notification</h3>
                  <p className="text-gray-500 mb-4">
                    Vous n'avez pas encore reçu de notifications. 
                    Elles apparaîtront ici lorsqu'un formulaire vous sera assigné 
                    ou qu'un rappel sera programmé.
                  </p>
                  <div className="text-sm text-gray-400">
                    <p>Types de notifications que vous recevrez :</p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Assignation de formulaires</li>
                      <li>Rappels de formulaires</li>
                      <li>Rappels de métriques (directeurs)</li>
                      <li>Instructions programmées (directeurs)</li>
                    </ul>
                  </div>
                </div>
              ) : (
                // No notifications matching filters
                <div className="max-w-md mx-auto">
                  <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-700 mb-2">Aucune notification correspondant aux filtres</h3>
                  <p className="text-gray-500 mb-4">
                    Aucune notification ne correspond aux filtres sélectionnés. 
                    Essayez de modifier les critères de recherche.
                  </p>
                  <Button
                    onClick={() => {
                      setFilterType('all');
                      setFilterStatus('all');
                    }}
                    variant="secondary"
                    className="flex items-center gap-2 mx-auto"
                  >
                    Réinitialiser les filtres
                  </Button>
                </div>
              )}
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

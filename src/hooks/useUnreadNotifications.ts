import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export const useUnreadNotifications = () => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    console.log('🔔 [useUnreadNotifications] Setting up listener for user:', user.id);

    // Create query based on user role
    let notificationsQuery;
    if (user.role === 'directeur') {
      // For directors, get notifications for their role
      notificationsQuery = query(
        collection(db, 'notifications'),
        where('recipientRole', '==', 'directeur'),
        where('agencyId', '==', user.agencyId),
        where('read', '==', false)
      );
    } else {
      // For employees, get notifications for their user ID
      notificationsQuery = query(
        collection(db, 'notifications'),
        where('recipientId', '==', user.id),
        where('read', '==', false)
      );
    }

    // Set up real-time listener
    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      console.log('🔔 [useUnreadNotifications] Unread count update:', snapshot.docs.length);
      setUnreadCount(snapshot.docs.length);
    }, (error) => {
      console.error('🔔 [useUnreadNotifications] Error listening to unread notifications:', error);
      setUnreadCount(0);
    });

    // Cleanup listener on unmount or user change
    return () => {
      console.log('🔔 [useUnreadNotifications] Cleaning up unread notifications listener');
      unsubscribe();
    };
  }, [user]);

  return unreadCount;
};

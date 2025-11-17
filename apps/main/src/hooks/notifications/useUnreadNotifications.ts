import { useState, useEffect } from 'react';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@ubora/shared/firebaseConfig';

export const useUnreadNotifications = () => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }


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
      setUnreadCount(snapshot.docs.length);
    }, (error) => {
      console.error('🔔 [useUnreadNotifications] Error listening to unread notifications:', error);
      setUnreadCount(0);
    });

    // Cleanup listener on unmount or user change
    return () => {
      unsubscribe();
    };
  }, [user]);

  return unreadCount;
};

import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { SubscriptionSession, User } from '../types';
import { PACKAGE_LIMITS } from '../config/packageFeatures';

export class SubscriptionSessionCollectionService {
  private static readonly COLLECTION_NAME = 'subscriptionSessions';
  private static readonly RENEWAL_INTERVAL_DAYS = 30;

  /**
   * Create a new subscription session in the separate collection
   * @param userId - ID de l'utilisateur
   * @param sessionData - Données de la session (sans id, createdAt, updatedAt)
   * @returns Promise<string | null> - ID de la session créée ou null si erreur
   */
  static async createSession(
    userId: string,
    sessionData: Omit<SubscriptionSession, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ): Promise<string | null> {
    try {
      // Verify user exists
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        console.error('Utilisateur non trouvé:', userId);
        return null;
      }

      const now = new Date();
      
      // Get package limits for the selected package
      // Exclude 'premium' as it's not in PACKAGE_LIMITS
      const packageType = sessionData.packageType === 'premium' ? 'standard' : sessionData.packageType;
      const packageLimits = PACKAGE_LIMITS[packageType as keyof typeof PACKAGE_LIMITS];
      
      // Calculate dates
      const startDate = sessionData.startDate || now;
      const endDate = sessionData.endDate || new Date(startDate.getTime() + sessionData.totalPeriodDays * 24 * 60 * 60 * 1000);
      const nextRenewalDate = sessionData.nextRenewalDate || new Date(startDate.getTime() + this.RENEWAL_INTERVAL_DAYS * 24 * 60 * 60 * 1000);

      // Create new session document
      // Note: We use 'as any' for Firestore Timestamps and FieldValues
      // as they will be converted to Dates when reading from Firestore
      const newSessionData: any = {
        userId,
        packageType: sessionData.packageType,
        subscriptionPeriod: sessionData.subscriptionPeriod,
        totalPeriodDays: sessionData.totalPeriodDays,
        renewalIntervalDays: this.RENEWAL_INTERVAL_DAYS,
        sessionType: sessionData.sessionType,
        startDate: Timestamp.fromDate(startDate),
        endDate: Timestamp.fromDate(endDate),
        nextRenewalDate: Timestamp.fromDate(nextRenewalDate),
        amountPaid: sessionData.amountPaid || 0,
        monthlyAmount: sessionData.monthlyAmount || 0,
        discountApplied: sessionData.discountApplied || 0,
        paymentId: sessionData.paymentId || '',
        durationDays: sessionData.durationDays || sessionData.totalPeriodDays,
        isActive: sessionData.isActive ?? true,
        autoRenew: sessionData.autoRenew ?? true,
        renewalCount: sessionData.renewalCount || 0,
        maxRenewals: sessionData.maxRenewals || 0,
        ...(sessionData.paymentMethod ? { paymentMethod: sessionData.paymentMethod } : {}),
        ...(sessionData.paymentReference ? { paymentReference: sessionData.paymentReference } : {}),
        ...(sessionData.notes ? { notes: sessionData.notes } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        
        // Package resources from the selected package
        packageResources: {
          tokensIncluded: packageLimits.monthlyTokens,
          formsIncluded: packageLimits.maxForms,
          dashboardsIncluded: packageLimits.maxDashboards,
          usersIncluded: packageLimits.maxUsers
        },
        
        // Initialize pay-as-you-go resources (empty by default)
        payAsYouGoResources: sessionData.payAsYouGoResources || {
          tokens: 0,
          forms: 0,
          dashboards: 0,
          users: 0,
          purchases: []
        },
        
        // Initialize usage tracking
        usage: sessionData.usage || {
          tokensUsed: 0,
          formsCreated: 0,
          dashboardsCreated: 0,
          usersAdded: 0
        }
      };

      // Deactivate all existing active sessions for this user
      await this.deactivateAllUserSessions(userId);

      // Create new session in collection
      const sessionRef = await addDoc(collection(db, this.COLLECTION_NAME), newSessionData);
      
      // Update user document with reference to active session
      await updateDoc(userDocRef, {
        currentSubscriptionSessionId: sessionRef.id,
        updatedAt: serverTimestamp()
      });

      console.log('✅ Session créée avec succès:', sessionRef.id);
      return sessionRef.id;
      
    } catch (error) {
      console.error('Erreur lors de la création de la session:', error);
      return null;
    }
  }

  /**
   * Get active session for a user
   * @param userId - ID de l'utilisateur
   * @returns Promise<SubscriptionSession | null>
   */
  static async getActiveSession(userId: string): Promise<SubscriptionSession | null> {
    try {
      // First try to get from user's currentSubscriptionSessionId
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        return null;
      }

      const userData = userDoc.data() as User;
      const currentSessionId = userData.currentSubscriptionSessionId;

      if (!currentSessionId) {
        // Pas de currentSubscriptionSessionId, chercher une session active
        const activeSession = await this.findActiveSessionForUser(userId);
        if (activeSession) {
          // Mettre à jour currentSubscriptionSessionId dans le document utilisateur
          try {
            await updateDoc(userDocRef, {
              currentSubscriptionSessionId: activeSession.id,
              updatedAt: serverTimestamp()
            });
            console.log(`✅ currentSubscriptionSessionId mis à jour pour l'utilisateur ${userId}: null → ${activeSession.id}`);
          } catch (updateError) {
            console.error(`Erreur lors de la mise à jour de currentSubscriptionSessionId pour ${userId}:`, updateError);
          }
        }
        return activeSession;
      }

      // Get session from collection
      const sessionDocRef = doc(db, this.COLLECTION_NAME, currentSessionId);
      const sessionDoc = await getDoc(sessionDocRef);

      if (!sessionDoc.exists()) {
        return null;
      }

      const sessionData = sessionDoc.data();
      
      // Vérifier que la session appartient à l'utilisateur
      if (sessionData.userId !== userId) {
        console.warn(`Session ${currentSessionId} n'appartient pas à l'utilisateur ${userId}`);
        // Chercher une session active pour cet utilisateur
        const activeSession = await this.findActiveSessionForUser(userId);
        if (activeSession) {
          // Mettre à jour currentSubscriptionSessionId dans le document utilisateur
          try {
            await updateDoc(userDocRef, {
              currentSubscriptionSessionId: activeSession.id,
              updatedAt: serverTimestamp()
            });
            console.log(`✅ currentSubscriptionSessionId mis à jour pour l'utilisateur ${userId}: ${currentSessionId} → ${activeSession.id}`);
          } catch (updateError) {
            console.error(`Erreur lors de la mise à jour de currentSubscriptionSessionId pour ${userId}:`, updateError);
          }
        }
        return activeSession;
      }
      
      // Vérifier que la session est active
      if (!sessionData.isActive) {
        console.warn(`Session ${currentSessionId} trouvée mais inactive pour l'utilisateur ${userId}, recherche d'une session active...`);
        // Chercher une session active pour cet utilisateur
        const activeSession = await this.findActiveSessionForUser(userId);
        if (activeSession) {
          // Mettre à jour currentSubscriptionSessionId dans le document utilisateur
          try {
            await updateDoc(userDocRef, {
              currentSubscriptionSessionId: activeSession.id,
              updatedAt: serverTimestamp()
            });
            console.log(`✅ currentSubscriptionSessionId mis à jour pour l'utilisateur ${userId}: ${currentSessionId} → ${activeSession.id}`);
          } catch (updateError) {
            console.error(`Erreur lors de la mise à jour de currentSubscriptionSessionId pour ${userId}:`, updateError);
          }
        }
        return activeSession;
      }
      
      // Convert Firestore Timestamps to Dates
      return this.convertFirestoreToSubscriptionSession(sessionDoc.id, sessionData);
      
    } catch (error) {
      console.error('Erreur lors de la récupération de la session active:', error);
      return null;
    }
  }

  /**
   * Find an active session for a user (helper method)
   * @param userId - ID de l'utilisateur
   * @returns Promise<SubscriptionSession | null>
   */
  private static async findActiveSessionForUser(userId: string): Promise<SubscriptionSession | null> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('userId', '==', userId),
        where('isActive', '==', true)
      );

      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }

      // Trier par date de création (la plus récente en premier)
      const sessions = querySnapshot.docs.map(doc => ({
        id: doc.id,
        data: doc.data(),
        createdAt: doc.data().createdAt
      })).sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || a.createdAt?._seconds * 1000 || 0;
        const bTime = b.createdAt?.toMillis?.() || b.createdAt?._seconds * 1000 || 0;
        return bTime - aTime;
      });

      if (sessions.length > 0) {
        const mostRecentSession = sessions[0];
        return this.convertFirestoreToSubscriptionSession(mostRecentSession.id, mostRecentSession.data);
      }

      return null;
    } catch (error) {
      console.error('Erreur lors de la recherche d\'une session active:', error);
      return null;
    }
  }

  /**
   * Get all sessions for a user
   * @param userId - ID de l'utilisateur
   * @returns Promise<SubscriptionSession[]>
   */
  static async getUserSessions(userId: string): Promise<SubscriptionSession[]> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => 
        this.convertFirestoreToSubscriptionSession(doc.id, doc.data())
      ).filter(session => session !== null) as SubscriptionSession[];
      
    } catch (error) {
      console.error('Erreur lors de la récupération des sessions:', error);
      return [];
    }
  }

  /**
   * Update a session
   * @param sessionId - ID de la session
   * @param updates - Champs à mettre à jour
   * @returns Promise<boolean>
   */
  static async updateSession(
    sessionId: string,
    updates: Partial<Omit<SubscriptionSession, 'id' | 'userId' | 'createdAt'>>
  ): Promise<boolean> {
    try {
      const sessionDocRef = doc(db, this.COLLECTION_NAME, sessionId);
      const sessionDoc = await getDoc(sessionDocRef);
      
      if (!sessionDoc.exists()) {
        console.error('Session not found:', sessionId);
        return false;
      }

      const sessionData = sessionDoc.data();
      const userId = sessionData.userId;

      // Convert Date fields to Timestamps
      const firestoreUpdates: any = {
        ...updates,
        updatedAt: serverTimestamp()
      };

      // Convert Date fields to Timestamps
      if (updates.startDate && updates.startDate instanceof Date) {
        firestoreUpdates.startDate = Timestamp.fromDate(updates.startDate);
      }
      if (updates.endDate && updates.endDate instanceof Date) {
        firestoreUpdates.endDate = Timestamp.fromDate(updates.endDate);
      }
      if (updates.nextRenewalDate && updates.nextRenewalDate instanceof Date) {
        firestoreUpdates.nextRenewalDate = Timestamp.fromDate(updates.nextRenewalDate);
      }

      await updateDoc(sessionDocRef, firestoreUpdates);

      // If session is being activated, update user's currentSubscriptionSessionId
      if (updates.isActive === true) {
        // Deactivate all other active sessions for this user (excluding the current one)
        const activeSessionsQuery = query(
          collection(db, this.COLLECTION_NAME),
          where('userId', '==', userId),
          where('isActive', '==', true)
        );
        const activeSessionsSnapshot = await getDocs(activeSessionsQuery);
        
        const batch = writeBatch(db);
        activeSessionsSnapshot.docs.forEach(docSnapshot => {
          if (docSnapshot.id !== sessionId) {
            batch.update(docSnapshot.ref, {
              isActive: false,
              updatedAt: serverTimestamp()
            });
          }
        });
        await batch.commit();
        
        // Update user document with reference to this active session
        const userDocRef = doc(db, 'users', userId);
        await updateDoc(userDocRef, {
          currentSubscriptionSessionId: sessionId,
          updatedAt: serverTimestamp()
        });
        console.log(`✅ Updated currentSubscriptionSessionId for user ${userId} to ${sessionId}`);
      } else if (updates.isActive === false) {
        // If session is being deactivated, check if this was the current session
        const userDocRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.currentSubscriptionSessionId === sessionId) {
            // Find another active session or clear the reference
            const activeSession = await this.findActiveSessionForUser(userId);
            if (activeSession) {
              await updateDoc(userDocRef, {
                currentSubscriptionSessionId: activeSession.id,
                updatedAt: serverTimestamp()
              });
              console.log(`✅ Updated currentSubscriptionSessionId for user ${userId} to ${activeSession.id}`);
            } else {
              await updateDoc(userDocRef, {
                currentSubscriptionSessionId: null,
                updatedAt: serverTimestamp()
              });
              console.log(`✅ Cleared currentSubscriptionSessionId for user ${userId}`);
            }
          }
        }
      }

      return true;
      
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la session:', error);
      return false;
    }
  }

  /**
   * Deactivate a session
   * @param sessionId - ID de la session
   * @returns Promise<boolean>
   */
  static async deactivateSession(sessionId: string): Promise<boolean> {
    try {
      return await this.updateSession(sessionId, {
        isActive: false
      });
    } catch (error) {
      console.error('Erreur lors de la désactivation de la session:', error);
      return false;
    }
  }

  /**
   * Deactivate all active sessions for a user
   * @param userId - ID de l'utilisateur
   * @returns Promise<boolean>
   */
  static async deactivateAllUserSessions(userId: string): Promise<boolean> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('userId', '==', userId),
        where('isActive', '==', true)
      );

      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return true;
      }

      const batch = writeBatch(db);
      querySnapshot.docs.forEach(doc => {
        batch.update(doc.ref, {
          isActive: false,
          updatedAt: serverTimestamp()
        });
      });

      await batch.commit();
      return true;
      
    } catch (error) {
      console.error('Erreur lors de la désactivation des sessions:', error);
      return false;
    }
  }

  /**
   * Create a free default session for a user
   * @param userId - ID de l'utilisateur
   * @param subscriptionPeriod - Période d'abonnement sélectionnée (par défaut '30days')
   * @returns Promise<string | null> - ID de la session créée
   */
  static async createFreeDefaultSession(
    userId: string,
    subscriptionPeriod: '30days' | '6months' | '1year' = '30days'
  ): Promise<string | null> {
    try {
      const now = new Date();
      const packageLimits = PACKAGE_LIMITS.free;

      // Calculer les jours selon la période
      const periodDaysMap = {
        '30days': 30,
        '6months': 180,
        '1year': 360
      };
      const totalPeriodDays = periodDaysMap[subscriptionPeriod];

      // Calculer la date de fin basée sur la période
      const endDate = new Date(now.getTime() + totalPeriodDays * 24 * 60 * 60 * 1000);
      const nextRenewalDate = new Date(now.getTime() + totalPeriodDays * 24 * 60 * 60 * 1000);

      return await this.createSession(userId, {
        packageType: 'free',
        subscriptionPeriod: subscriptionPeriod,
        totalPeriodDays: totalPeriodDays,
        renewalIntervalDays: this.RENEWAL_INTERVAL_DAYS,
        sessionType: 'downgrade',
        startDate: now,
        endDate: endDate, // Date calculée selon la période
        nextRenewalDate: nextRenewalDate,
        amountPaid: 0,
        monthlyAmount: 0,
        discountApplied: 0,
        paymentId: '', // No payment for free
        durationDays: totalPeriodDays,
        isActive: true,
        autoRenew: false, // No auto-renew for free
        renewalCount: 0,
        maxRenewals: 0,
        packageResources: {
          tokensIncluded: packageLimits.monthlyTokens,
          formsIncluded: packageLimits.maxForms,
          dashboardsIncluded: packageLimits.maxDashboards,
          usersIncluded: packageLimits.maxUsers
        },
        payAsYouGoResources: {
          tokens: 0,
          forms: 0,
          dashboards: 0,
          users: 0,
          purchases: []
        },
        usage: {
          tokensUsed: 0,
          formsCreated: 0,
          dashboardsCreated: 0,
          usersAdded: 0
        }
      });
      
    } catch (error) {
      console.error('Erreur lors de la création de la session free:', error);
      return null;
    }
  }

  /**
   * Convert Firestore document data to SubscriptionSession
   * @param id - Document ID
   * @param data - Firestore document data
   * @returns SubscriptionSession | null
   */
  private static convertFirestoreToSubscriptionSession(
    id: string,
    data: any
  ): SubscriptionSession | null {
    try {
      return {
        id,
        userId: data.userId,
        packageType: data.packageType,
        subscriptionPeriod: data.subscriptionPeriod,
        totalPeriodDays: data.totalPeriodDays,
        renewalIntervalDays: data.renewalIntervalDays || this.RENEWAL_INTERVAL_DAYS,
        sessionType: data.sessionType,
        startDate: data.startDate?.toDate() || new Date(),
        endDate: data.endDate?.toDate() || new Date(),
        nextRenewalDate: data.nextRenewalDate?.toDate() || new Date(),
        amountPaid: data.amountPaid || 0,
        monthlyAmount: data.monthlyAmount || 0,
        discountApplied: data.discountApplied || 0,
        paymentId: data.paymentId || '',
        durationDays: data.durationDays || data.totalPeriodDays,
        isActive: data.isActive ?? true,
        autoRenew: data.autoRenew ?? true,
        renewalCount: data.renewalCount || 0,
        maxRenewals: data.maxRenewals || 0,
        paymentMethod: data.paymentMethod,
        paymentReference: data.paymentReference,
        notes: data.notes,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        packageResources: data.packageResources || {
          tokensIncluded: 0,
          formsIncluded: 0,
          dashboardsIncluded: 0,
          usersIncluded: 0
        },
        payAsYouGoResources: data.payAsYouGoResources,
        usage: data.usage,
        consumption: data.consumption
      };
    } catch (error) {
      console.error('Erreur lors de la conversion de la session:', error);
      return null;
    }
  }
}



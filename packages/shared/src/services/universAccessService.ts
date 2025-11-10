import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Univers, PackageType } from '../types';
import { SubscriptionSessionCollectionService } from './subscriptionSessionCollectionService';
import { UniversPurchaseService } from './universPurchaseService';

export class UniversAccessService {
  /**
   * Check if a user has access to a specific univers
   * @param userId - ID de l'utilisateur
   * @param universId - ID de l'univers
   * @returns Promise<boolean> - true si l'utilisateur a accès
   */
  static async checkUniversAccess(userId: string, universId: string): Promise<boolean> {
    try {
      // Get user's active subscription session
      const activeSession = await SubscriptionSessionCollectionService.getActiveSession(userId);
      
      if (!activeSession) {
        // No active session, check if univers is free
        return await this.isUniversFree(universId);
      }

      const packageType = activeSession.packageType;

      // Get univers document
      const universDocRef = doc(db, 'univers', universId);
      const universDoc = await getDoc(universDocRef);

      if (!universDoc.exists()) {
        return false;
      }

      const universData = universDoc.data() as Univers;
      const packageAccess = universData.metadata?.packageAccess;

      // If no packageAccess defined, default to false (no access)
      if (!packageAccess) {
        return false;
      }

      // Check access based on package type
      let hasPackageAccess = false;
      switch (packageType) {
        case 'free':
          hasPackageAccess = packageAccess.free === true;
          break;
        case 'starter':
          hasPackageAccess = packageAccess.starter === true;
          break;
        case 'standard':
          hasPackageAccess = packageAccess.standard === true;
          break;
        default:
          hasPackageAccess = false;
      }

      // Si l'utilisateur a accès via son package, autoriser
      if (hasPackageAccess) {
        return true;
      }

      // Si pas d'accès via package, vérifier si l'utilisateur a acheté cet univers
      const hasPurchased = await UniversPurchaseService.hasPurchasedUnivers(userId, universId);
      return hasPurchased;

    } catch (error) {
      console.error('Erreur lors de la vérification de l\'accès univers:', error);
      return false;
    }
  }

  /**
   * Check if a univers is free (accessible without subscription)
   * @param universId - ID de l'univers
   * @returns Promise<boolean>
   */
  private static async isUniversFree(universId: string): Promise<boolean> {
    try {
      const universDocRef = doc(db, 'univers', universId);
      const universDoc = await getDoc(universDocRef);

      if (!universDoc.exists()) {
        return false;
      }

      const universData = universDoc.data() as Univers;
      const packageAccess = universData.metadata?.packageAccess;

      // If packageAccess.free is true, it's accessible for free tier
      return packageAccess?.free === true;

    } catch (error) {
      console.error('Erreur lors de la vérification si univers est gratuit:', error);
      return false;
    }
  }

  /**
   * Get all accessible univers for a user
   * @param userId - ID de l'utilisateur
   * @returns Promise<Univers[]> - Liste des univers accessibles
   */
  static async getAccessibleUnivers(userId: string): Promise<Univers[]> {
    try {
      // Get user's active subscription session
      const activeSession = await SubscriptionSessionCollectionService.getActiveSession(userId);
      const packageType = activeSession?.packageType || 'free';

      // Get all univers
      const universQuery = query(collection(db, 'univers'));
      const universSnapshot = await getDocs(universQuery);

      const accessibleUnivers: Univers[] = [];

      for (const docSnapshot of universSnapshot.docs) {
        const universData = docSnapshot.data() as Univers;
        const packageAccess = universData.metadata?.packageAccess;

        // If no packageAccess defined, skip (no access by default)
        if (!packageAccess) {
          continue;
        }

        // Check access based on package type
        let hasAccess = false;
        switch (packageType) {
          case 'free':
            hasAccess = packageAccess.free === true;
            break;
          case 'starter':
            hasAccess = packageAccess.starter === true;
            break;
          case 'standard':
            hasAccess = packageAccess.standard === true;
            break;
          default:
            hasAccess = false;
        }

        if (hasAccess) {
          accessibleUnivers.push({
            id: docSnapshot.id,
            ...universData
          });
        }
      }

      return accessibleUnivers;

    } catch (error) {
      console.error('Erreur lors de la récupération des univers accessibles:', error);
      return [];
    }
  }

  /**
   * Get all univers accessible for a specific package type
   * @param packageType - Type de package
   * @returns Promise<Univers[]> - Liste des univers accessibles pour ce package
   */
  static async getUniversForPackage(packageType: PackageType): Promise<Univers[]> {
    try {
      // Get all univers
      const universQuery = query(collection(db, 'univers'));
      const universSnapshot = await getDocs(universQuery);

      const accessibleUnivers: Univers[] = [];

      for (const docSnapshot of universSnapshot.docs) {
        const universData = docSnapshot.data() as Univers;
        const packageAccess = universData.metadata?.packageAccess;

        // If no packageAccess defined, skip (no access by default)
        if (!packageAccess) {
          continue;
        }

        // Check access based on package type
        let hasAccess = false;
        switch (packageType) {
          case 'free':
            hasAccess = packageAccess.free === true;
            break;
          case 'starter':
            hasAccess = packageAccess.starter === true;
            break;
          case 'standard':
            hasAccess = packageAccess.standard === true;
            break;
          default:
            hasAccess = false;
        }

        if (hasAccess) {
          accessibleUnivers.push({
            id: docSnapshot.id,
            ...universData
          });
        }
      }

      return accessibleUnivers;

    } catch (error) {
      console.error('Erreur lors de la récupération des univers pour le package:', error);
      return [];
    }
  }
}



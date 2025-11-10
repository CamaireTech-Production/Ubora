import { 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface UniversPurchase {
  id: string;
  userId: string; // ID du directeur qui a acheté
  universId: string; // ID de l'univers acheté
  purchaseDate: Date;
  amountPaid: number; // Montant payé en FCFA
  paymentId?: string; // Référence au document de paiement dans 'payments' collection
  currency?: string; // Devise (défaut: FCFA)
  notes?: string; // Notes additionnelles
  createdAt: Date;
  updatedAt: Date;
}

export class UniversPurchaseService {
  private static readonly COLLECTION_NAME = 'universPurchases';

  /**
   * Enregistrer un achat d'univers
   * @param userId - ID du directeur
   * @param universId - ID de l'univers acheté
   * @param amountPaid - Montant payé en FCFA
   * @param paymentId - Référence au document de paiement (optionnel)
   * @param currency - Devise (défaut: FCFA)
   * @param notes - Notes additionnelles (optionnel)
   * @returns Promise<string | null> - ID de l'achat enregistré ou null si erreur
   */
  static async recordPurchase(
    userId: string,
    universId: string,
    amountPaid: number,
    paymentId?: string,
    currency: string = 'FCFA',
    notes?: string
  ): Promise<string | null> {
    try {
      const purchaseData = {
        userId,
        universId,
        amountPaid,
        paymentId: paymentId || '',
        currency,
        notes: notes || '',
        purchaseDate: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const purchaseRef = await addDoc(collection(db, this.COLLECTION_NAME), purchaseData);
      console.log('✅ Achat d\'univers enregistré:', purchaseRef.id);
      return purchaseRef.id;
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement de l\'achat d\'univers:', error);
      return null;
    }
  }

  /**
   * Vérifier si un utilisateur a acheté un univers spécifique
   * @param userId - ID du directeur
   * @param universId - ID de l'univers
   * @returns Promise<boolean> - true si l'utilisateur a acheté cet univers
   */
  static async hasPurchasedUnivers(userId: string, universId: string): Promise<boolean> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('userId', '==', userId),
        where('universId', '==', universId)
      );

      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Erreur lors de la vérification de l\'achat d\'univers:', error);
      return false;
    }
  }

  /**
   * Récupérer tous les univers achetés par un utilisateur
   * @param userId - ID du directeur
   * @returns Promise<UniversPurchase[]> - Liste des achats d'univers
   */
  static async getPurchasedUnivers(userId: string): Promise<UniversPurchase[]> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('userId', '==', userId)
      );

      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data.userId,
          universId: data.universId,
          purchaseDate: data.purchaseDate?.toDate() || new Date(),
          amountPaid: data.amountPaid || 0,
          paymentId: data.paymentId,
          currency: data.currency || 'FCFA',
          notes: data.notes,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        } as UniversPurchase;
      });
    } catch (error) {
      console.error('Erreur lors de la récupération des univers achetés:', error);
      return [];
    }
  }

  /**
   * Récupérer un achat spécifique par ID
   * @param purchaseId - ID de l'achat
   * @returns Promise<UniversPurchase | null>
   */
  static async getPurchaseById(purchaseId: string): Promise<UniversPurchase | null> {
    try {
      const purchaseDocRef = doc(db, this.COLLECTION_NAME, purchaseId);
      const purchaseDoc = await getDoc(purchaseDocRef);

      if (!purchaseDoc.exists()) {
        return null;
      }

      const data = purchaseDoc.data();
      return {
        id: purchaseDoc.id,
        userId: data.userId,
        universId: data.universId,
        purchaseDate: data.purchaseDate?.toDate() || new Date(),
        amountPaid: data.amountPaid || 0,
        paymentId: data.paymentId,
        currency: data.currency || 'FCFA',
        notes: data.notes,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      } as UniversPurchase;
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'achat:', error);
      return null;
    }
  }
}


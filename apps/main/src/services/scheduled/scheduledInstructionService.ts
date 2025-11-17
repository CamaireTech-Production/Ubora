import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { db } from '@ubora/shared/firebaseConfig';
import { ScheduledQuestion, ScheduledQuestionResponse } from '../../types';

class ScheduledQuestionService {
  private readonly collectionName = 'scheduledQuestions';
  private readonly responsesCollectionName = 'scheduledQuestionResponses';

  /**
   * Créer une nouvelle question programmée
   */
  async create(question: Omit<ScheduledQuestion, 'id' | 'createdAt' | 'executionCount'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, this.collectionName), {
        ...question,
        executionCount: 0,
        createdAt: serverTimestamp(),
        // Convertir les dates en Timestamps Firestore
        scheduledAt: Timestamp.fromDate(question.scheduledAt),
        nextExecution: question.nextExecution ? Timestamp.fromDate(question.nextExecution) : null,
        lastExecutedAt: question.lastExecutedAt ? Timestamp.fromDate(question.lastExecutedAt) : null
      });
      return docRef.id;
    } catch (error) {
      console.error('Erreur lors de la création de la question programmée:', error);
      throw error;
    }
  }

  /**
   * Mettre à jour une question programmée
   */
  async update(id: string, updates: Partial<ScheduledQuestion>): Promise<void> {
    try {
      const docRef = doc(db, this.collectionName, id);
      const updateData: any = { ...updates };
      
      // Convertir les dates en Timestamps Firestore
      if (updates.scheduledAt) {
        updateData.scheduledAt = Timestamp.fromDate(updates.scheduledAt);
      }
      if (updates.nextExecution) {
        updateData.nextExecution = Timestamp.fromDate(updates.nextExecution);
      }
      if (updates.lastExecutedAt) {
        updateData.lastExecutedAt = Timestamp.fromDate(updates.lastExecutedAt);
      }
      
      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la question programmée:', error);
      throw error;
    }
  }

  /**
   * Supprimer une question programmée
   */
  async delete(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, this.collectionName, id));
    } catch (error) {
      console.error('Erreur lors de la suppression de la question programmée:', error);
      throw error;
    }
  }

  /**
   * Récupérer une question programmée par ID
   */
  async getById(id: string): Promise<ScheduledQuestion | null> {
    try {
      const docRef = doc(db, this.collectionName, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return this.convertFirestoreToScheduledQuestion(docSnap.id, docSnap.data());
      }
      return null;
    } catch (error) {
      console.error('Erreur lors de la récupération de la question programmée:', error);
      throw error;
    }
  }

  /**
   * Récupérer toutes les questions programmées d'un utilisateur
   */
  async getByUser(userId: string, agencyId: string): Promise<ScheduledQuestion[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('userId', '==', userId),
        where('agencyId', '==', agencyId),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => 
        this.convertFirestoreToScheduledQuestion(doc.id, doc.data())
      );
    } catch (error) {
      console.error('Erreur lors de la récupération des questions programmées:', error);
      throw error;
    }
  }

  /**
   * Récupérer les questions programmées à exécuter pour un utilisateur spécifique
   */
  async getDueQuestionsForUser(userId: string, agencyId: string): Promise<ScheduledQuestion[]> {
    try {
      const now = new Date();
      const q = query(
        collection(db, this.collectionName),
        where('userId', '==', userId),
        where('agencyId', '==', agencyId),
        where('status', '==', 'pending'),
        where('nextExecution', '<=', Timestamp.fromDate(now)),
        orderBy('nextExecution', 'asc'),
        limit(50)
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => 
        this.convertFirestoreToScheduledQuestion(doc.id, doc.data())
      );
    } catch (error) {
      console.error('Erreur lors de la récupération des questions à exécuter:', error);
      throw error;
    }
  }

  /**
   * Écouter les questions programmées d'un utilisateur en temps réel
   */
  subscribeToUserQuestions(
    userId: string, 
    agencyId: string, 
    callback: (questions: ScheduledQuestion[]) => void
  ): () => void {
    const q = query(
      collection(db, this.collectionName),
      where('userId', '==', userId),
      where('agencyId', '==', agencyId),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const questions = snapshot.docs.map(doc => 
        this.convertFirestoreToScheduledQuestion(doc.id, doc.data())
      );
      callback(questions);
    }, (error) => {
      console.error('Erreur lors de l\'écoute des questions programmées:', error);
    });
  }

  /**
   * Calculer la prochaine exécution basée sur la fréquence
   */
  calculateNextExecution(scheduledAt: Date, frequency: ScheduledQuestion['frequency']): Date {
    const now = new Date();
    let nextExecution = new Date(scheduledAt);

    switch (frequency) {
      case 'once':
        return scheduledAt;
      
      case 'daily':
        // Si l'heure programmée est passée aujourd'hui, programmer pour demain
        if (nextExecution <= now) {
          nextExecution.setDate(nextExecution.getDate() + 1);
        }
        break;
      
      case 'weekly':
        // Si l'heure programmée est passée cette semaine, programmer pour la semaine prochaine
        if (nextExecution <= now) {
          nextExecution.setDate(nextExecution.getDate() + 7);
        }
        break;
      
      case 'monthly':
        // Si l'heure programmée est passée ce mois, programmer pour le mois prochain
        if (nextExecution <= now) {
          nextExecution.setMonth(nextExecution.getMonth() + 1);
        }
        break;
    }

    return nextExecution;
  }

  /**
   * Créer une réponse à une question programmée
   */
  async createResponse(response: Omit<ScheduledQuestionResponse, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, this.responsesCollectionName), {
        ...response,
        executedAt: Timestamp.fromDate(response.executedAt)
      });
      return docRef.id;
    } catch (error) {
      console.error('Erreur lors de la création de la réponse:', error);
      throw error;
    }
  }

  /**
   * Récupérer les réponses d'une question programmée
   */
  async getResponses(scheduledQuestionId: string): Promise<ScheduledQuestionResponse[]> {
    try {
      const q = query(
        collection(db, this.responsesCollectionName),
        where('scheduledQuestionId', '==', scheduledQuestionId),
        orderBy('executedAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          executedAt: data.executedAt?.toDate() || new Date()
        } as ScheduledQuestionResponse;
      });
    } catch (error) {
      console.error('Erreur lors de la récupération des réponses:', error);
      throw error;
    }
  }

  /**
   * Écouter les réponses d'une question programmée en temps réel
   */
  subscribeToResponses(
    scheduledQuestionId: string,
    callback: (responses: ScheduledQuestionResponse[]) => void
  ): () => void {
    const q = query(
      collection(db, this.responsesCollectionName),
      where('scheduledQuestionId', '==', scheduledQuestionId),
      orderBy('executedAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const responses = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          executedAt: data.executedAt?.toDate() || new Date()
        } as ScheduledQuestionResponse;
      });
      callback(responses);
    }, (error) => {
      console.error('Erreur lors de l\'écoute des réponses:', error);
    });
  }

  /**
   * Convertir les données Firestore en ScheduledQuestion
   */
  private convertFirestoreToScheduledQuestion(id: string, data: any): ScheduledQuestion {
    return {
      id,
      ...data,
      scheduledAt: data.scheduledAt?.toDate() || new Date(),
      nextExecution: data.nextExecution?.toDate() || undefined,
      lastExecutedAt: data.lastExecutedAt?.toDate() || undefined,
      createdAt: data.createdAt?.toDate() || new Date()
    } as ScheduledQuestion;
  }
}

export const scheduledQuestionService = new ScheduledQuestionService();


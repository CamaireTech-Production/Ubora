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
import { db } from '../firebaseConfig';
import { ScheduledQuestion, ScheduledQuestionResponse } from '../types';

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
      console.log('🔄 [ScheduledQuestionService] Mise à jour de la question:', id);
      console.log('📊 [ScheduledQuestionService] Données de mise à jour:', updates);
      
      const docRef = doc(db, this.collectionName, id);
      
      // Filter out undefined values to prevent Firestore errors
      const filteredUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, value]) => value !== undefined)
      );
      
      const updateData: any = { ...filteredUpdates };
      
      // Convertir les dates en Timestamps Firestore
      if (filteredUpdates.scheduledAt) {
        updateData.scheduledAt = Timestamp.fromDate(filteredUpdates.scheduledAt);
      }
      if (filteredUpdates.nextExecution) {
        updateData.nextExecution = Timestamp.fromDate(filteredUpdates.nextExecution);
      }
      if (filteredUpdates.lastExecutedAt) {
        updateData.lastExecutedAt = Timestamp.fromDate(filteredUpdates.lastExecutedAt);
      }
      
      console.log('📤 [ScheduledQuestionService] Données Firestore à envoyer:', updateData);
      
      await updateDoc(docRef, updateData);
      
      console.log('✅ [ScheduledQuestionService] Question mise à jour avec succès:', id);
    } catch (error) {
      console.error('❌ [ScheduledQuestionService] Erreur lors de la mise à jour de la question programmée:', error);
      console.error('📊 [ScheduledQuestionService] ID de la question:', id);
      console.error('📊 [ScheduledQuestionService] Données qui ont échoué:', updates);
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
      console.log('🔍 [ScheduledQuestionService] Recherche des questions à exécuter pour:', userId, 'à', now.toISOString());
      
      // Requête pour les questions avec nextExecution <= maintenant
      const q1 = query(
        collection(db, this.collectionName),
        where('userId', '==', userId),
        where('agencyId', '==', agencyId),
        where('status', '==', 'pending'),
        where('nextExecution', '<=', Timestamp.fromDate(now)),
        orderBy('nextExecution', 'asc'),
        limit(50)
      );
      
      // Requête pour les questions avec scheduledAt <= maintenant et nextExecution null (première exécution)
      const q2 = query(
        collection(db, this.collectionName),
        where('userId', '==', userId),
        where('agencyId', '==', agencyId),
        where('status', '==', 'pending'),
        where('scheduledAt', '<=', Timestamp.fromDate(now)),
        orderBy('scheduledAt', 'asc'),
        limit(50)
      );
      
      const [snapshot1, snapshot2] = await Promise.all([
        getDocs(q1),
        getDocs(q2)
      ]);
      
      // Combiner les résultats et éviter les doublons
      const allQuestions = new Map();
      
      // Ajouter les questions avec nextExecution
      snapshot1.docs.forEach(doc => {
        const question = this.convertFirestoreToScheduledQuestion(doc.id, doc.data());
        allQuestions.set(doc.id, question);
      });
      
      // Ajouter les questions avec scheduledAt (première exécution)
      snapshot2.docs.forEach(doc => {
        const question = this.convertFirestoreToScheduledQuestion(doc.id, doc.data());
        // Ne l'ajouter que si elle n'est pas déjà présente et si nextExecution est null ou dans le futur
        if (!allQuestions.has(doc.id) && (!question.nextExecution || question.nextExecution > now)) {
          allQuestions.set(doc.id, question);
        }
      });
      
      const dueQuestions = Array.from(allQuestions.values());
      console.log(`🔍 [ScheduledQuestionService] ${dueQuestions.length} question(s) trouvée(s) à exécuter`);
      
      if (dueQuestions.length > 0) {
        console.log('📋 [ScheduledQuestionService] Questions à exécuter:');
        dueQuestions.forEach(q => {
          console.log(`  - ${q.title} (scheduledAt: ${q.scheduledAt.toISOString()}, nextExecution: ${q.nextExecution?.toISOString() || 'null'})`);
        });
      }
      
      return dueQuestions;
    } catch (error) {
      console.error('❌ [ScheduledQuestionService] Erreur lors de la récupération des questions à exécuter:', error);
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
      console.log('🔄 [ScheduledQuestionService] Création de la réponse pour la question:', response.scheduledQuestionId);
      console.log('📊 [ScheduledQuestionService] Données de la réponse:', {
        scheduledQuestionId: response.scheduledQuestionId,
        status: response.status,
        responseLength: response.response?.length || 0,
        executedAt: response.executedAt.toISOString()
      });
      
      const docRef = await addDoc(collection(db, this.responsesCollectionName), {
        ...response,
        executedAt: Timestamp.fromDate(response.executedAt)
      });
      
      console.log('✅ [ScheduledQuestionService] Réponse créée avec succès, ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ [ScheduledQuestionService] Erreur lors de la création de la réponse:', error);
      console.error('📊 [ScheduledQuestionService] Données qui ont échoué:', {
        scheduledQuestionId: response.scheduledQuestionId,
        status: response.status,
        responseLength: response.response?.length || 0
      });
      throw error;
    }
  }

  /**
   * Récupérer les réponses d'une question programmée
   */
  async getResponses(scheduledQuestionId: string): Promise<ScheduledQuestionResponse[]> {
    try {
      console.log('🔍 [ScheduledQuestionService] Récupération des réponses pour la question:', scheduledQuestionId);
      
      const q = query(
        collection(db, this.responsesCollectionName),
        where('scheduledQuestionId', '==', scheduledQuestionId),
        orderBy('executedAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const responses = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          executedAt: data.executedAt?.toDate() || new Date()
        } as ScheduledQuestionResponse;
      });
      
      console.log(`🔍 [ScheduledQuestionService] ${responses.length} réponse(s) trouvée(s) pour la question ${scheduledQuestionId}`);
      return responses;
    } catch (error) {
      console.error('❌ [ScheduledQuestionService] Erreur lors de la récupération des réponses:', error);
      
      // Si c'est une erreur de permissions, retourner un tableau vide au lieu de faire échouer
      if (error instanceof Error && error.message.includes('Missing or insufficient permissions')) {
        console.warn('⚠️ [ScheduledQuestionService] Permissions insuffisantes pour lire les réponses, retour d\'un tableau vide');
        return [];
      }
      
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


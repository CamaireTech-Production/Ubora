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
import { getCameroonTime, calculateNextExecutionCameroon } from '../utils/timezoneUtils';
import { universInstanceResourceService } from './universInstanceResourceService';

class ScheduledQuestionService {
  private readonly collectionName = 'scheduledQuestions';
  private readonly responsesCollectionName = 'scheduledQuestionResponses';

  /**
   * Créer une nouvelle question programmée
   */
  async create(question: Omit<ScheduledQuestion, 'id' | 'createdAt' | 'executionCount'>): Promise<string> {
    try {
      // Récupérer l'Univers actif pour associer automatiquement si universId n'est pas fourni
      let universIdToAssociate: string | null = question.universId || null;
      if (!universIdToAssociate && question.agencyId) {
        try {
          // Trouver le directeur de l'agence
          const directorsSnapshot = await getDocs(
            query(
              collection(db, 'users'),
              where('agencyId', '==', question.agencyId),
              where('role', '==', 'directeur')
            )
          );
          if (!directorsSnapshot.empty) {
            const directorId = directorsSnapshot.docs[0].id;
            // Récupérer l'Univers actif du directeur
            const { universService } = await import('./universService');
            const activeUnivers = await universService.getActiveUnivers(directorId, question.agencyId);
            if (activeUnivers) {
              universIdToAssociate = activeUnivers.activeUniversId;
            }
          }
        } catch (error) {
          console.error('Erreur lors de la récupération de l\'Univers actif pour la ScheduledQuestion:', error);
          // Continue sans associer au Univers si erreur
        }
      }

      const docRef = await addDoc(collection(db, this.collectionName), {
        ...question,
        universId: universIdToAssociate,
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
  async getByUser(userId: string, agencyId: string, activeUniversId?: string | null, activeInstanceId?: string | null, userRole?: 'directeur' | 'employe' | 'admin'): Promise<ScheduledQuestion[]> {
    try {
      // NOUVELLE LOGIQUE : Pour les directeurs avec activeInstanceId, utiliser l'instance comme source de vérité
      if (userRole === 'directeur' && activeInstanceId) {
        const instructions = await universInstanceResourceService.getInstructionsFromInstance(activeInstanceId);
        // Trier par createdAt décroissant
        return instructions.sort((a, b) => {
          const aTime = a.createdAt?.getTime() || 0;
          const bTime = b.createdAt?.getTime() || 0;
          return bTime - aTime;
        });
      }

      // ANCIENNE LOGIQUE : Rétrocompatibilité
      let q;
      if (activeUniversId) {
        // Filtrer par Univers actif
        q = query(
          collection(db, this.collectionName),
          where('userId', '==', userId),
          where('agencyId', '==', agencyId),
          where('universId', '==', activeUniversId),
          orderBy('createdAt', 'desc')
        );
      } else {
        // Rétrocompatibilité temporaire : si pas de Univers actif, charger toutes les questions
        q = query(
          collection(db, this.collectionName),
          where('userId', '==', userId),
          where('agencyId', '==', agencyId),
          orderBy('createdAt', 'desc')
        );
      }
      
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
      const now = getCameroonTime();
      // Add 5 minutes tolerance to catch questions that should have been executed
      const toleranceMinutes = 5;
      const toleranceTime = new Date(now.getTime() + (toleranceMinutes * 60 * 1000));
      
      console.log('🔍 [ScheduledQuestionService] Recherche des questions à exécuter pour:', userId, 'à', now.toISOString(), '(Heure Cameroun)');
      console.log('⏰ [ScheduledQuestionService] Tolérance de', toleranceMinutes, 'minutes - recherche jusqu\'à:', toleranceTime.toISOString());
      
      // Requête pour les questions avec nextExecution <= maintenant + tolérance
      const q1 = query(
        collection(db, this.collectionName),
        where('userId', '==', userId),
        where('agencyId', '==', agencyId),
        where('status', '==', 'pending'),
        where('nextExecution', '<=', Timestamp.fromDate(toleranceTime)),
        orderBy('nextExecution', 'asc'),
        limit(50)
      );
      
      // Requête pour les questions avec scheduledAt <= maintenant + tolérance et nextExecution null (première exécution)
      const q2 = query(
        collection(db, this.collectionName),
        where('userId', '==', userId),
        where('agencyId', '==', agencyId),
        where('status', '==', 'pending'),
        where('scheduledAt', '<=', Timestamp.fromDate(toleranceTime)),
        orderBy('scheduledAt', 'asc'),
        limit(50)
      );
      
      const [snapshot1, snapshot2] = await Promise.all([
        getDocs(q1),
        getDocs(q2)
      ]);
      
      // Combiner les résultats et éviter les doublons
      const allQuestions = new Map();
      
      // Ajouter les questions avec nextExecution (avec vérification de tolérance)
      snapshot1.docs.forEach(doc => {
        const question = this.convertFirestoreToScheduledQuestion(doc.id, doc.data());
        // Vérifier que la question est vraiment due (dans la tolérance)
        if (this.isQuestionDue(question, now, toleranceMinutes)) {
          allQuestions.set(doc.id, question);
        }
      });
      
      // Ajouter les questions avec scheduledAt (première exécution) avec vérification de tolérance
      snapshot2.docs.forEach(doc => {
        const question = this.convertFirestoreToScheduledQuestion(doc.id, doc.data());
        // Ne l'ajouter que si elle n'est pas déjà présente et si elle est vraiment due
        if (!allQuestions.has(doc.id) && this.isQuestionDue(question, now, toleranceMinutes)) {
          allQuestions.set(doc.id, question);
        }
      });
      
      const dueQuestions = Array.from(allQuestions.values());
      console.log(`🔍 [ScheduledQuestionService] ${dueQuestions.length} question(s) trouvée(s) à exécuter`);
      
      // Vérifier et marquer les questions trop anciennes comme échouées
      await this.handleOverdueQuestions(userId, agencyId, now, toleranceMinutes);
      
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
    callback: (questions: ScheduledQuestion[]) => void,
    activeUniversId?: string | null
  ): () => void {
    let q;
    if (activeUniversId) {
      // Filtrer par Univers actif
      q = query(
        collection(db, this.collectionName),
        where('userId', '==', userId),
        where('agencyId', '==', agencyId),
        where('universId', '==', activeUniversId),
        orderBy('createdAt', 'desc')
      );
    } else {
      // Rétrocompatibilité temporaire : si pas de Univers actif, charger toutes les questions
      q = query(
        collection(db, this.collectionName),
        where('userId', '==', userId),
        where('agencyId', '==', agencyId),
        orderBy('createdAt', 'desc')
      );
    }

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
   * Calculer la prochaine exécution basée sur la fréquence (en utilisant l'heure Cameroun)
   */
  calculateNextExecution(scheduledAt: Date, frequency: ScheduledQuestion['frequency']): Date {
    return calculateNextExecutionCameroon(scheduledAt, frequency);
  }

  /**
   * Vérifier si une question est vraiment due (dans la tolérance de temps)
   */
  private isQuestionDue(question: ScheduledQuestion, now: Date, toleranceMinutes: number): boolean {
    const toleranceMs = toleranceMinutes * 60 * 1000;
    
    // Vérifier nextExecution si disponible
    if (question.nextExecution) {
      const timeDiff = now.getTime() - question.nextExecution.getTime();
      return timeDiff >= 0 && timeDiff <= toleranceMs;
    }
    
    // Vérifier scheduledAt pour la première exécution
    if (question.scheduledAt) {
      const timeDiff = now.getTime() - question.scheduledAt.getTime();
      return timeDiff >= 0 && timeDiff <= toleranceMs;
    }
    
    return false;
  }

  /**
   * Récupérer les questions bloquées (en cours d'exécution depuis trop longtemps)
   */
  async getStuckQuestions(userId: string, agencyId: string, stuckThreshold: Date): Promise<ScheduledQuestion[]> {
    try {
      console.log('🔍 [ScheduledQuestionService] Recherche des questions bloquées pour:', userId, 'avant:', stuckThreshold.toISOString());
      
      const stuckQuery = query(
        collection(db, this.collectionName),
        where('userId', '==', userId),
        where('agencyId', '==', agencyId),
        where('status', '==', 'running'),
        where('lastExecutedAt', '<=', Timestamp.fromDate(stuckThreshold)),
        limit(20)
      );
      
      const snapshot = await getDocs(stuckQuery);
      const stuckQuestions = snapshot.docs.map(doc => 
        this.convertFirestoreToScheduledQuestion(doc.id, doc.data())
      );
      
      console.log(`🔍 [ScheduledQuestionService] ${stuckQuestions.length} question(s) bloquée(s) trouvée(s)`);
      return stuckQuestions;
    } catch (error) {
      console.error('❌ [ScheduledQuestionService] Erreur lors de la récupération des questions bloquées:', error);
      return [];
    }
  }

  /**
   * Gérer les questions trop anciennes (au-delà de la tolérance)
   */
  private async handleOverdueQuestions(userId: string, agencyId: string, now: Date, toleranceMinutes: number): Promise<void> {
    try {
      const toleranceMs = toleranceMinutes * 60 * 1000;
      const overdueThreshold = new Date(now.getTime() - toleranceMs);
      
      // Rechercher les questions en attente qui sont trop anciennes
      const overdueQuery = query(
        collection(db, this.collectionName),
        where('userId', '==', userId),
        where('agencyId', '==', agencyId),
        where('status', '==', 'pending'),
        where('scheduledAt', '<=', Timestamp.fromDate(overdueThreshold)),
        limit(10)
      );
      
      const overdueSnapshot = await getDocs(overdueQuery);
      
      if (overdueSnapshot.docs.length > 0) {
        console.log(`⚠️ [ScheduledQuestionService] ${overdueSnapshot.docs.length} question(s) trop ancienne(s) détectée(s)`);
        
        // Marquer les questions trop anciennes comme échouées
        const updatePromises = overdueSnapshot.docs.map(async (doc) => {
          const question = this.convertFirestoreToScheduledQuestion(doc.id, doc.data());
          console.log(`🔄 [ScheduledQuestionService] Marquage de la question trop ancienne comme échouée: ${question.title}`);
          
          await this.update(doc.id, {
            status: 'failed',
            executionCount: question.executionCount + 1,
            lastExecutedAt: now
          });
        });
        
        await Promise.all(updatePromises);
        console.log(`✅ [ScheduledQuestionService] ${overdueSnapshot.docs.length} question(s) trop ancienne(s) marquée(s) comme échouée(s)`);
      }
    } catch (error) {
      console.error('❌ [ScheduledQuestionService] Erreur lors de la gestion des questions trop anciennes:', error);
      // Ne pas faire échouer l'exécution pour cette erreur
    }
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


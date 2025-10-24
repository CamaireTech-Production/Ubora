import { scheduledQuestionService } from './scheduledQuestionService';
import { unifiedNotificationService } from './unifiedNotificationService';
import { ScheduledQuestion, ScheduledQuestionResponse } from '../types';
import { getCameroonTime } from '../utils/timezoneUtils';
import { getAIEndpoint } from '../config/api';
import { auth } from '../firebaseConfig';
import { ScheduledQuestionTokenChecker } from './scheduledQuestionTokenChecker';

class ScheduledQuestionExecutor {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private currentUserId: string | null = null;
  private currentAgencyId: string | null = null;
  private executingQuestions = new Set<string>(); // Track currently executing questions
  private executionLock = new Map<string, Promise<void>>(); // Prevent concurrent execution of same question
  private readonly AI_ENDPOINT = getAIEndpoint();

  /**
   * Démarrer le service d'exécution automatique pour un utilisateur spécifique
   */
  start(userId: string, agencyId: string): void {
    if (this.isRunning && this.currentUserId === userId) {
      console.log('🔄 [ScheduledQuestionExecutor] Service déjà en cours d\'exécution pour cet utilisateur');
      return;
    }

    // Arrêter le service précédent si nécessaire
    if (this.isRunning) {
      this.stop();
    }

    console.log('🚀 [ScheduledQuestionExecutor] Démarrage du service d\'exécution automatique');
    this.isRunning = true;
    this.currentUserId = userId;
    this.currentAgencyId = agencyId;

    // Exécuter immédiatement
    this.executeDueQuestions();

    // Puis exécuter toutes les minutes
    this.intervalId = setInterval(() => {
      this.executeDueQuestions();
    }, 60 * 1000); // 1 minute

    // Check for stuck executions every 5 minutes
    setInterval(() => {
      this.handleStuckExecutions();
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Arrêter le service d'exécution automatique
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    this.currentUserId = null;
    this.currentAgencyId = null;
    
    // Clean up execution locks
    this.executingQuestions.clear();
    this.executionLock.clear();
    
    console.log('⏹️ [ScheduledQuestionExecutor] Service d\'exécution automatique arrêté');
  }

  /**
   * Handle stuck executions by checking for questions that have been running too long
   */
  async handleStuckExecutions(): Promise<void> {
    if (!this.currentUserId || !this.currentAgencyId) return;

    try {
      console.log('🔍 [ScheduledQuestionExecutor] Vérification des exécutions bloquées');
      
      // Get questions that have been running for more than 10 minutes
      const stuckThreshold = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
      
      const stuckQuestions = await scheduledQuestionService.getStuckQuestions(
        this.currentUserId, 
        this.currentAgencyId, 
        stuckThreshold
      );

      if (stuckQuestions.length > 0) {
        console.log(`⚠️ [ScheduledQuestionExecutor] ${stuckQuestions.length} question(s) bloquée(s) détectée(s)`);
        
        // Reset stuck questions to pending status
        const resetPromises = stuckQuestions.map(question => {
          console.log(`🔄 [ScheduledQuestionExecutor] Réinitialisation de la question bloquée: ${question.title}`);
          return scheduledQuestionService.update(question.id, {
            status: 'pending',
            lastExecutedAt: null
          });
        });
        
        await Promise.all(resetPromises);
        console.log(`✅ [ScheduledQuestionExecutor] ${stuckQuestions.length} question(s) bloquée(s) réinitialisée(s)`);
      } else {
        console.log('✅ [ScheduledQuestionExecutor] Aucune question bloquée détectée');
      }
    } catch (error) {
      console.error('❌ [ScheduledQuestionExecutor] Erreur lors de la gestion des exécutions bloquées:', error);
    }
  }

  /**
   * Exécuter les questions programmées qui sont dues
   */
  private async executeDueQuestions(): Promise<void> {
    if (!this.currentUserId || !this.currentAgencyId) {
      console.log('⚠️ [ScheduledQuestionExecutor] Aucun utilisateur connecté, arrêt de l\'exécution');
      return;
    }

    try {
      console.log(`🔍 [ScheduledQuestionExecutor] Vérification des questions à exécuter pour l'utilisateur ${this.currentUserId} à ${new Date().toISOString()}`);
      
      const dueQuestions = await scheduledQuestionService.getDueQuestionsForUser(
        this.currentUserId, 
        this.currentAgencyId
      );
      
      if (dueQuestions.length === 0) {
        console.log('✅ [ScheduledQuestionExecutor] Aucune question à exécuter pour le moment');
        return;
      }

      console.log(`🔄 [ScheduledQuestionExecutor] ${dueQuestions.length} question(s) à exécuter pour l'utilisateur ${this.currentUserId}`);

      // Pre-check tokens for all questions before execution
      console.log(`🔍 [ScheduledQuestionExecutor] Vérification des tokens pour ${dueQuestions.length} question(s)`);
      const questionsWithData = dueQuestions.map(q => ({ question: q.question, hasData: true }));
      const batchTokenCheck = await ScheduledQuestionTokenChecker.checkTokensForBatchExecution(
        this.currentUserId, 
        questionsWithData
      );

      if (!batchTokenCheck.canExecute) {
        console.log(`❌ [ScheduledQuestionExecutor] Tokens insuffisants pour l'exécution batch: ${batchTokenCheck.reason}`);
        
        // Mark all questions as failed due to insufficient tokens
        const updatePromises = dueQuestions.map(question => 
          scheduledQuestionService.update(question.id, {
            status: 'failed',
            executionCount: question.executionCount + 1,
            lastExecutedAt: new Date()
          })
        );
        
        await Promise.all(updatePromises);
        console.log(`✅ [ScheduledQuestionExecutor] ${dueQuestions.length} question(s) marquée(s) comme échouée(s) - tokens insuffisants`);
        return;
      }

      console.log(`✅ [ScheduledQuestionExecutor] Tokens suffisants pour l'exécution batch (${batchTokenCheck.totalTokens} tokens requis)`);

      for (const question of dueQuestions) {
        console.log(`🚀 [ScheduledQuestionExecutor] Début de l'exécution de: ${question.title}`);
        await this.executeQuestion(question);
        console.log(`✅ [ScheduledQuestionExecutor] Exécution terminée pour: ${question.title}`);
      }
    } catch (error) {
      console.error('❌ [ScheduledQuestionExecutor] Erreur lors de l\'exécution des questions:', error);
    }
  }

  /**
   * Exécuter une question programmée spécifique
   */
  private async executeQuestion(question: ScheduledQuestion): Promise<void> {
    const startTime = Date.now();
    
    // Check if question is already being executed
    if (this.executingQuestions.has(question.id)) {
      console.log(`⚠️ [ScheduledQuestionExecutor] Question ${question.title} est déjà en cours d'exécution, ignorée`);
      return;
    }

    // Check if there's already a lock for this question
    if (this.executionLock.has(question.id)) {
      console.log(`⚠️ [ScheduledQuestionExecutor] Question ${question.title} est verrouillée, attente de l'exécution en cours`);
      try {
        await this.executionLock.get(question.id);
        console.log(`✅ [ScheduledQuestionExecutor] Exécution précédente de ${question.title} terminée`);
        return;
      } catch (error) {
        console.log(`❌ [ScheduledQuestionExecutor] Exécution précédente de ${question.title} a échoué, nouvelle tentative`);
      }
    }

    // Create execution lock
    const executionPromise = this.executeQuestionInternal(question, startTime);
    this.executionLock.set(question.id, executionPromise);
    
    try {
      await executionPromise;
    } finally {
      // Clean up locks
      this.executingQuestions.delete(question.id);
      this.executionLock.delete(question.id);
    }
  }

  /**
   * Internal method to execute a question (with concurrency protection)
   */
  private async executeQuestionInternal(question: ScheduledQuestion, startTime: number): Promise<void> {
    try {
      // Mark question as executing
      this.executingQuestions.add(question.id);
      
      console.log(`🔄 [ScheduledQuestionExecutor] Exécution de la question: ${question.title}`);
      console.log(`📊 [ScheduledQuestionExecutor] Détails de la question:`, {
        id: question.id,
        scheduledAt: question.scheduledAt.toISOString(),
        nextExecution: question.nextExecution?.toISOString() || 'null',
        frequency: question.frequency,
        status: question.status,
        executionCount: question.executionCount
      });
      
      // Pre-check tokens before execution
      console.log(`🔍 [ScheduledQuestionExecutor] Vérification des tokens pour: ${question.title}`);
      const estimatedTokens = ScheduledQuestionTokenChecker.estimateTokensForQuestion(question.question, true);
      const tokenCheck = await ScheduledQuestionTokenChecker.checkTokensForExecution(question.userId, estimatedTokens);
      
      if (!tokenCheck.canExecute) {
        console.log(`❌ [ScheduledQuestionExecutor] Tokens insuffisants pour: ${question.title} - ${tokenCheck.reason}`);
        
        // Mark question as failed due to insufficient tokens
        await scheduledQuestionService.update(question.id, {
          status: 'failed',
          executionCount: question.executionCount + 1,
          lastExecutedAt: new Date()
        });
        
        // Create error response
        const errorResponse: Omit<ScheduledQuestionResponse, 'id'> = {
          scheduledQuestionId: question.id,
          response: `Exécution annulée: ${tokenCheck.reason}`,
          executedAt: new Date(),
          responseTime: Date.now() - startTime,
          tokensUsed: 0,
          status: 'error',
          errorMessage: tokenCheck.reason,
          meta: {
            period: question.filters.period,
            usedEntries: 0,
            forms: 0,
            users: 0,
            model: 'token_check_failed'
          }
        };
        
        await scheduledQuestionService.createResponse(errorResponse);
        console.log(`✅ [ScheduledQuestionExecutor] Réponse d'erreur créée pour: ${question.title}`);
        return;
      }
      
      console.log(`✅ [ScheduledQuestionExecutor] Tokens suffisants pour: ${question.title} (${tokenCheck.availableTokens} disponibles)`);
      
      // Marquer la question comme en cours d'exécution
      console.log(`🔄 [ScheduledQuestionExecutor] Mise à jour du statut vers 'running' pour: ${question.title}`);
      await scheduledQuestionService.update(question.id, {
        status: 'running',
        lastExecutedAt: new Date()
      });

      // Préparer les données pour l'API Archa
      const requestData = {
        question: question.question,
        filters: question.filters,
        selectedFormats: question.selectedFormIds,
        responseFormat: question.selectedFormat,
        selectedResponseFormats: question.selectedFormats,
        conversationId: null // Pas de conversation pour les questions programmées
      };

      console.log(`📤 [ScheduledQuestionExecutor] Données à envoyer à l'API:`, requestData);

      // Appeler l'API Archa
      const response = await this.callArchaAPI(requestData, question.userId);
      
      // Créer la réponse
      const responseData: Omit<ScheduledQuestionResponse, 'id'> = {
        scheduledQuestionId: question.id,
        response: response.answer || 'Aucune réponse générée',
        executedAt: new Date(),
        responseTime: Date.now() - startTime,
        tokensUsed: response.tokensUsed || 0,
        status: 'success',
        meta: {
          period: question.filters.period,
          usedEntries: response.meta?.usedEntries || 0,
          forms: response.meta?.forms || 0,
          users: response.meta?.users || 0,
          model: response.meta?.model || 'gpt-4.1',
          selectedFormat: question.selectedFormat,
          selectedFormats: question.selectedFormats,
          selectedFormIds: question.selectedFormIds,
          selectedFormTitles: response.meta?.selectedFormTitles || []
        }
      };

      // Try to create response, but don't fail if it doesn't work
      let responseCreated = false;
      let responseId: string | null = null;
      try {
        responseId = await scheduledQuestionService.createResponse(responseData);
        responseCreated = true;
        console.log(`✅ [ScheduledQuestionExecutor] Réponse créée avec succès pour: ${question.title}, ID: ${responseId}`);
      } catch (responseError) {
        console.error(`❌ [ScheduledQuestionExecutor] Erreur lors de la création de la réponse:`, responseError);
        console.log(`⚠️ [ScheduledQuestionExecutor] Continuation sans réponse pour: ${question.title}`);
      }

      // Calculate next execution
      const nextExecution = scheduledQuestionService.calculateNextExecution(
        question.scheduledAt, 
        question.frequency
      );

      // Update question status (CRITICAL - must always succeed)
      // If response creation failed, mark as failed; otherwise mark as completed/pending
      const updateData: Partial<ScheduledQuestion> = {
        status: responseCreated 
          ? (question.frequency === 'once' ? 'completed' : 'pending')
          : 'failed',
        executionCount: question.executionCount + 1,
        nextExecution: question.frequency === 'once' ? undefined : nextExecution
      };

      console.log(`🔄 [ScheduledQuestionExecutor] Mise à jour du statut vers '${updateData.status}' pour: ${question.title}`);
      console.log(`📊 [ScheduledQuestionExecutor] Execution count: ${question.executionCount} → ${updateData.executionCount}`);
      
      try {
        await scheduledQuestionService.update(question.id, updateData);
        console.log(`✅ [ScheduledQuestionExecutor] Statut mis à jour avec succès pour: ${question.title}`);
      } catch (updateError) {
        console.error(`❌ [ScheduledQuestionExecutor] ERREUR CRITIQUE - Impossible de mettre à jour le statut:`, updateError);
        throw updateError; // This is critical, we must fail if status update fails
      }

      // Send notification only if response was created successfully
      if (responseCreated && responseId) {
        try {
          // Create a response object with the actual ID for notification
          const responseWithId = {
            ...responseData,
            id: responseId
          };
          await this.sendNotification(question, responseWithId);
          console.log(`🔔 [ScheduledQuestionExecutor] Notification envoyée pour: ${question.title}`);
        } catch (notificationError) {
          console.error(`❌ [ScheduledQuestionExecutor] Erreur lors de l'envoi de la notification:`, notificationError);
          // Don't fail for notification errors
        }
      }

      console.log(`✅ [ScheduledQuestionExecutor] Question exécutée avec succès: ${question.title}`);
      
    } catch (error) {
      console.error(`❌ [ScheduledQuestionExecutor] Erreur lors de l'exécution de la question ${question.title}:`, error);
      
      // Try to create error response, but don't fail if it doesn't work
      let errorResponseCreated = false;
      try {
        const errorResponse: Omit<ScheduledQuestionResponse, 'id'> = {
          scheduledQuestionId: question.id,
          response: 'Erreur lors de l\'exécution de la question',
          executedAt: new Date(),
          responseTime: Date.now() - startTime,
          tokensUsed: 0,
          status: 'error',
          errorMessage: error instanceof Error ? error.message : 'Erreur inconnue',
          meta: {
            period: question.filters.period,
            usedEntries: 0,
            forms: 0,
            users: 0,
            model: 'error'
          }
        };

        await scheduledQuestionService.createResponse(errorResponse);
        errorResponseCreated = true;
        console.log(`✅ [ScheduledQuestionExecutor] Réponse d'erreur créée pour: ${question.title}`);
      } catch (responseError) {
        console.error(`❌ [ScheduledQuestionExecutor] Erreur lors de la création de la réponse d'erreur:`, responseError);
        console.log(`⚠️ [ScheduledQuestionExecutor] Continuation sans réponse d'erreur pour: ${question.title}`);
      }

      // CRITICAL: Always update status to failed and increment execution count
      try {
        const updateData: Partial<ScheduledQuestion> = {
          status: 'failed',
          executionCount: question.executionCount + 1,
          lastExecutedAt: new Date()
        };
        
        console.log(`🔄 [ScheduledQuestionExecutor] Mise à jour du statut vers 'failed' pour: ${question.title}`);
        console.log(`📊 [ScheduledQuestionExecutor] Execution count: ${question.executionCount} → ${updateData.executionCount}`);
        
        await scheduledQuestionService.update(question.id, updateData);
        console.log(`✅ [ScheduledQuestionExecutor] Statut mis à jour vers 'failed' pour: ${question.title}`);
      } catch (updateError) {
        console.error(`❌ [ScheduledQuestionExecutor] ERREUR CRITIQUE - Impossible de mettre à jour le statut vers 'failed':`, updateError);
        // This is critical, we must fail if status update fails
        throw updateError;
      }
    }
  }

  /**
   * Appeler l'API Archa
   */
  private async callArchaAPI(requestData: any, userId: string): Promise<any> {
    if (!this.AI_ENDPOINT) {
      console.error('❌ [ScheduledQuestionExecutor] Endpoint ARCHA non configuré');
      throw new Error('Endpoint ARCHA non configuré');
    }

    try {
      console.log('🔄 [ScheduledQuestionExecutor] Appel de l\'API ARCHA:', requestData.question);
      console.log('🌐 [ScheduledQuestionExecutor] Endpoint:', this.AI_ENDPOINT);
      
      // Obtenir le token d'authentification Firebase
      const user = auth.currentUser;
      if (!user) {
        throw new Error('Utilisateur non authentifié');
      }
      
      const token = await user.getIdToken();
      console.log('🔑 [ScheduledQuestionExecutor] Token d\'authentification obtenu');
      
      const requestBody = {
        question: requestData.question,
        filters: requestData.filters,
        selectedFormats: requestData.selectedFormats,
        responseFormat: requestData.responseFormat,
        selectedResponseFormats: requestData.selectedResponseFormats,
        conversationId: requestData.conversationId,
        userId: userId,
        isScheduled: true // Flag pour indiquer que c'est une exécution programmée
      };
      
      console.log('📤 [ScheduledQuestionExecutor] Corps de la requête:', JSON.stringify(requestBody, null, 2));
      
      const response = await fetch(this.AI_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody)
      });

      console.log('📡 [ScheduledQuestionExecutor] Statut de la réponse:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [ScheduledQuestionExecutor] Erreur API détaillée:', errorText);
        throw new Error(`Erreur API: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ [ScheduledQuestionExecutor] Réponse API reçue:', result);
      return result;
    } catch (error) {
      console.error('❌ [ScheduledQuestionExecutor] Erreur lors de l\'appel API:', error);
      throw error;
    }
  }

  /**
   * Envoyer une notification à l'utilisateur
   */
  private async sendNotification(question: ScheduledQuestion, response: ScheduledQuestionResponse): Promise<void> {
    try {
      const title = `Réponse disponible pour "${question.title}"`;
      const body = response.status === 'success' 
        ? 'ARCHA a généré une nouvelle réponse à votre instruction programmée'
        : 'Une erreur s\'est produite lors de l\'exécution de votre instruction programmée';

      // Get FCM token for the director
      const fcmToken = await this.getUserFCMToken(question.userId);

      await unifiedNotificationService.createProgrammedInstructionNotification(
        question.id,
        question.title,
        response.id,
        question.userId,
        question.agencyId,
        response.status,
        fcmToken || undefined
      );
      
      console.log('🔔 [ScheduledQuestionExecutor] Notification envoyée pour:', question.title);
    } catch (error) {
      console.error('❌ [ScheduledQuestionExecutor] Erreur lors de l\'envoi de la notification:', error);
      // Ne pas faire échouer l'exécution pour une erreur de notification
    }
  }

  /**
   * Get FCM token from user profile
   */
  private async getUserFCMToken(userId: string): Promise<string | null> {
    try {
      const { getDoc, doc } = await import('firebase/firestore');
      const { db } = await import('../firebaseConfig');
      
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return userData.fcmToken || null;
      }
      return null;
    } catch (error) {
      console.error(`🔔 [ScheduledQuestionExecutor] Error getting FCM token for ${userId}:`, error);
      return null;
    }
  }

  /**
   * Exécuter une question manuellement (pour les tests)
   */
  async executeQuestionManually(questionId: string): Promise<void> {
    console.log(`🔧 [ScheduledQuestionExecutor] Exécution manuelle demandée pour la question: ${questionId}`);
    
    const question = await scheduledQuestionService.getById(questionId);
    if (!question) {
      console.error(`❌ [ScheduledQuestionExecutor] Question programmée non trouvée: ${questionId}`);
      throw new Error('Question programmée non trouvée');
    }
    
    console.log(`🔧 [ScheduledQuestionExecutor] Question trouvée: ${question.title}`);
    console.log(`📊 [ScheduledQuestionExecutor] Statut actuel: ${question.status}`);
    
    // If the question is failed, reset it to pending before execution
    if (question.status === 'failed') {
      console.log(`🔄 [ScheduledQuestionExecutor] Réinitialisation de la question échouée vers 'pending'`);
      await scheduledQuestionService.update(questionId, {
        status: 'pending'
      });
      console.log(`✅ [ScheduledQuestionExecutor] Question réinitialisée vers 'pending'`);
    }
    
    await this.executeQuestion(question);
  }

  /**
   * Forcer l'exécution de toutes les questions en attente (pour debug)
   */
  async forceExecuteAllPending(): Promise<void> {
    if (!this.currentUserId || !this.currentAgencyId) {
      console.error('❌ [ScheduledQuestionExecutor] Aucun utilisateur connecté pour l\'exécution forcée');
      return;
    }

    console.log(`🔧 [ScheduledQuestionExecutor] Exécution forcée de toutes les questions en attente pour l'utilisateur ${this.currentUserId}`);
    
    try {
      // Récupérer toutes les questions en attente, même celles qui ne sont pas encore dues
      const allQuestions = await scheduledQuestionService.getByUser(this.currentUserId, this.currentAgencyId);
      const pendingQuestions = allQuestions.filter(q => q.status === 'pending');
      
      console.log(`🔧 [ScheduledQuestionExecutor] ${pendingQuestions.length} question(s) en attente trouvée(s)`);
      
      for (const question of pendingQuestions) {
        console.log(`🔧 [ScheduledQuestionExecutor] Exécution forcée de: ${question.title}`);
        await this.executeQuestion(question);
      }
    } catch (error) {
      console.error('❌ [ScheduledQuestionExecutor] Erreur lors de l\'exécution forcée:', error);
      throw error;
    }
  }

  /**
   * Réparer les questions bloquées en "running" (pour debug)
   */
  async fixStuckQuestions(): Promise<void> {
    if (!this.currentUserId || !this.currentAgencyId) {
      console.error('❌ [ScheduledQuestionExecutor] Aucun utilisateur connecté pour la réparation');
      return;
    }

    console.log(`🔧 [ScheduledQuestionExecutor] Réparation des questions bloquées pour l'utilisateur ${this.currentUserId}`);
    
    try {
      // Récupérer toutes les questions de l'utilisateur
      const allQuestions = await scheduledQuestionService.getByUser(this.currentUserId, this.currentAgencyId);
      const stuckQuestions = allQuestions.filter(q => q.status === 'running');
      
      console.log(`🔧 [ScheduledQuestionExecutor] ${stuckQuestions.length} question(s) bloquée(s) trouvée(s)`);
      
      for (const question of stuckQuestions) {
        console.log(`🔧 [ScheduledQuestionExecutor] Réparation de: ${question.title}`);
        
        // Remettre en "pending" pour permettre une nouvelle exécution
        await scheduledQuestionService.update(question.id, {
          status: 'pending'
        });
        
        console.log(`✅ [ScheduledQuestionExecutor] Question réparée: ${question.title}`);
      }
    } catch (error) {
      console.error('❌ [ScheduledQuestionExecutor] Erreur lors de la réparation:', error);
      throw error;
    }
  }
}

export const scheduledQuestionExecutor = new ScheduledQuestionExecutor();


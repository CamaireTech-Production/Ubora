import { logger } from '@ubora/shared/utils/logger';
import { scheduledQuestionService } from './scheduledQuestionService';
import { notificationService } from './notificationService';
import { ScheduledQuestion, ScheduledQuestionResponse } from '../../types';
import { getAIEndpoint } from '@ubora/shared/config/api';

class ScheduledQuestionExecutor {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private currentUserId: string | null = null;
  private currentAgencyId: string | null = null;
  private readonly AI_ENDPOINT = getAIEndpoint();

  /**
   * Démarrer le service d'exécution automatique pour un utilisateur spécifique
   */
  start(userId: string, agencyId: string): void {
    if (this.isRunning && this.currentUserId === userId) {
      logger.debug('Service déjà en cours d\'exécution pour cet utilisateur', { userId }, 'ScheduledInstructionExecutor');
      return;
    }

    // Arrêter le service précédent si nécessaire
    if (this.isRunning) {
      this.stop();
    }

    logger.info('Démarrage du service d\'exécution automatique', undefined, 'ScheduledInstructionExecutor');
    this.isRunning = true;
    this.currentUserId = userId;
    this.currentAgencyId = agencyId;

    // Exécuter immédiatement
    this.executeDueQuestions();

    // Puis exécuter toutes les minutes
    this.intervalId = setInterval(() => {
      this.executeDueQuestions();
    }, 60 * 1000); // 1 minute
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
    logger.info('Service d\'exécution automatique arrêté', undefined, 'ScheduledInstructionExecutor');
  }

  /**
   * Exécuter les questions programmées qui sont dues
   */
  private async executeDueQuestions(): Promise<void> {
    if (!this.currentUserId || !this.currentAgencyId) {
      logger.warn('Aucun utilisateur connecté, arrêt de l\'exécution', undefined, 'ScheduledInstructionExecutor');
      return;
    }

    try {
      const dueQuestions = await scheduledQuestionService.getDueQuestionsForUser(
        this.currentUserId, 
        this.currentAgencyId
      );
      
      if (dueQuestions.length === 0) {
        return;
      }

      logger.debug(`${dueQuestions.length} question(s) à exécuter pour l'utilisateur`, { count: dueQuestions.length, userId: this.currentUserId }, 'ScheduledInstructionExecutor');

      for (const question of dueQuestions) {
        await this.executeQuestion(question);
      }
    } catch (error) {
      logger.error('Erreur lors de l\'exécution des questions', error, 'ScheduledInstructionExecutor');
    }
  }

  /**
   * Exécuter une question programmée spécifique
   */
  private async executeQuestion(question: ScheduledQuestion): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.debug(`Exécution de la question`, { questionTitle: question.title, questionId: question.id }, 'ScheduledInstructionExecutor');
      
      // Marquer la question comme en cours d'exécution
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

      await scheduledQuestionService.createResponse(responseData);

      // Calculer la prochaine exécution
      const nextExecution = scheduledQuestionService.calculateNextExecution(
        question.scheduledAt, 
        question.frequency
      );

      // Mettre à jour la question
      const updateData: Partial<ScheduledQuestion> = {
        status: question.frequency === 'once' ? 'completed' : 'pending',
        executionCount: question.executionCount + 1,
        nextExecution: question.frequency === 'once' ? undefined : nextExecution
      };

      await scheduledQuestionService.update(question.id, updateData);

      // Envoyer une notification
      await this.sendNotification(question, responseData);

      logger.info(`Question exécutée avec succès`, { questionTitle: question.title, questionId: question.id }, 'ScheduledInstructionExecutor');
      
    } catch (error) {
      logger.error(`Erreur lors de l'exécution de la question`, error, 'ScheduledInstructionExecutor');
      
      // Créer une réponse d'erreur
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

      // Marquer la question comme échouée
      await scheduledQuestionService.update(question.id, {
        status: 'failed'
      });
    }
  }

  /**
   * Appeler l'API Archa
   */
  private async callArchaAPI(requestData: any, userId: string): Promise<any> {
    if (!this.AI_ENDPOINT) {
      throw new Error('Endpoint ARCHA non configuré');
    }

    // Pour les questions programmées, nous ne pouvons pas utiliser l'API frontend
    // car nous n'avons pas accès au token utilisateur dans ce contexte
    // Cette fonctionnalité nécessiterait un service backend dédié
    
    // Pour l'instant, nous simulons une réponse d'erreur
    throw new Error('L\'exécution automatique des questions programmées nécessite un service backend dédié. Cette fonctionnalité sera disponible dans une version future.');
  }

  /**
   * Envoyer une notification à l'utilisateur
   */
  private async sendNotification(question: ScheduledQuestion, response: ScheduledQuestionResponse): Promise<void> {
    try {
      const title = `Réponse disponible pour "${question.title}"`;
      const body = response.status === 'success' 
        ? 'Vos résultats programmés sont prêts'
        : 'Une erreur s\'est produite lors de l\'exécution de votre question programmée';

      await notificationService.sendViaUnified(question.userId, {
        title,
        body,
        type: 'program_instruction',
        data: {
          scheduledQuestionId: question.id,
          responseId: response.id,
          status: response.status,
          clickAction: '/scheduled-questions'
        }
      });
    } catch (error) {
      logger.error('Erreur lors de l\'envoi de la notification', error, 'ScheduledInstructionExecutor');
      // Ne pas faire échouer l'exécution pour une erreur de notification
    }
  }

  /**
   * Exécuter une question manuellement (pour les tests)
   */
  async executeQuestionManually(questionId: string): Promise<void> {
    const question = await scheduledQuestionService.getById(questionId);
    if (!question) {
      throw new Error('Question programmée non trouvée');
    }
    
    await this.executeQuestion(question);
  }
}

export const scheduledQuestionExecutor = new ScheduledQuestionExecutor();


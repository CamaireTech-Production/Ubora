import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, Repeat, MessageSquare, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { LoadingGuard } from '../components/LoadingGuard';
import { Button } from '../components/Button';
import MessageList from '../components/chat/MessageList';
import { MessageBubble } from '../components/chat/MessageBubble';
import { scheduledQuestionService } from '../services/scheduledQuestionService';
import { useToast } from '../hooks/useToast';
import { ScheduledQuestion, ScheduledQuestionResponse, ChatMessage } from '../types';
import { Layout } from '../components/Layout';

export const ScheduledQuestionChatPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { showError } = useToast();
  
  const [question, setQuestion] = useState<ScheduledQuestion | null>(null);
  const [responses, setResponses] = useState<ScheduledQuestionResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingResponses, setIsLoadingResponses] = useState(true);

  // Charger la question et ses réponses
  useEffect(() => {
    if (!id) {
      navigate('/directeur/scheduled-questions');
      return;
    }

    loadQuestionAndResponses(id);
  }, [id, navigate]);

  const loadQuestionAndResponses = async (questionId: string) => {
    try {
      // Charger la question
      const questionData = await scheduledQuestionService.getById(questionId);
      if (!questionData) {
        showError('Instruction programmée non trouvée');
        navigate('/directeur/scheduled-questions');
        return;
      }

      // Vérifier les permissions
      if (questionData.userId !== user?.id || questionData.agencyId !== user?.agencyId) {
        showError('Vous n\'avez pas accès à cette instruction programmée');
        navigate('/directeur/scheduled-questions');
        return;
      }

      setQuestion(questionData);
      setIsLoading(false);

      // Charger les réponses
      const responsesData = await scheduledQuestionService.getResponses(questionId);
      setResponses(responsesData);
      setIsLoadingResponses(false);
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
      showError('Erreur lors du chargement de l\'instruction programmée');
      navigate('/directeur/scheduled-questions');
    }
  };

  // Convertir les réponses en messages de chat
  const chatMessages: ChatMessage[] = responses.map((response, index) => ({
    id: response.id,
    type: 'assistant',
    content: response.response,
    timestamp: response.executedAt,
    responseTime: response.responseTime,
    contentType: response.meta.selectedFormat === 'graph' ? 'graph' : 
                 response.meta.selectedFormat === 'table' ? 'table' : 'text',
    meta: {
      period: response.meta.period,
      usedEntries: response.meta.usedEntries,
      forms: response.meta.forms,
      users: response.meta.users,
      tokensUsed: response.tokensUsed,
      model: response.meta.model,
      selectedFormat: response.meta.selectedFormat,
      selectedFormats: response.meta.selectedFormats,
      selectedFormIds: response.meta.selectedFormIds,
      selectedFormTitles: response.meta.selectedFormTitles
    }
  }));

  const getStatusIcon = () => {
    if (!question) return null;
    
    switch (question.status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'running':
        return <Clock className="h-4 w-4 text-yellow-500 animate-pulse" />;
      case 'completed':
        return <MessageSquare className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'cancelled':
        return <Clock className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusLabel = () => {
    if (!question) return '';
    
    switch (question.status) {
      case 'pending':
        return 'En attente';
      case 'running':
        return 'En cours d\'exécution';
      case 'completed':
        return 'Terminée';
      case 'failed':
        return 'Échouée';
      case 'cancelled':
        return 'Annulée';
      default:
        return 'Inconnu';
    }
  };

  const getFrequencyLabel = () => {
    if (!question) return '';
    
    switch (question.frequency) {
      case 'once':
        return 'Une seule fois';
      case 'daily':
        return 'Quotidien';
      case 'weekly':
        return 'Hebdomadaire';
      case 'monthly':
        return 'Mensuel';
      default:
        return 'Inconnu';
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return <LoadingGuard />;
  }

  if (!question) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Instruction non trouvée</h3>
          <p className="mt-1 text-sm text-gray-500">
            L'instruction programmée que vous recherchez n'existe pas.
          </p>
          <div className="mt-6">
            <Button onClick={() => navigate('/directeur/scheduled-questions')}>
              Retour aux instructions programmées
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
      {/* En-tête fixe avec la question originale */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/directeur/scheduled-questions')}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Retour</span>
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">{question.title}</h1>
                <div className="flex items-center space-x-4 mt-1">
                  <div className="flex items-center space-x-1">
                    {getStatusIcon()}
                    <span className="text-sm text-gray-600">{getStatusLabel()}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Repeat className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-600">{getFrequencyLabel()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Question originale */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm font-medium">Q</span>
              </div>
              <div className="flex-1">
                <p className="text-gray-900 font-medium">Question originale:</p>
                <p className="text-gray-700 mt-1">{question.question}</p>
                {question.description && (
                  <p className="text-gray-600 text-sm mt-2">{question.description}</p>
                )}
              </div>
            </div>
          </div>

          {/* Informations de programmation */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 text-sm">
            <div className="flex items-center space-x-2 text-gray-600">
              <Calendar className="h-4 w-4" />
              <span>Programmée: {formatDate(question.scheduledAt)}</span>
            </div>
            {question.nextExecution && (
              <div className="flex items-center space-x-2 text-gray-600">
                <Clock className="h-4 w-4" />
                <span>Prochaine: {formatDate(question.nextExecution)}</span>
              </div>
            )}
            <div className="flex items-center space-x-2 text-gray-600">
              <MessageSquare className="h-4 w-4" />
              <span>{question.executionCount} exécution(s)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Zone de chat */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {isLoadingResponses ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-600">Chargement des réponses...</p>
              </div>
            </div>
          ) : chatMessages.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Aucune réponse</h3>
              <p className="mt-1 text-sm text-gray-500">
                {question.status === 'pending' 
                  ? 'Cette question n\'a pas encore été exécutée.'
                  : question.status === 'running'
                  ? 'Cette question est en cours d\'exécution.'
                  : 'Aucune réponse n\'a été générée pour cette question.'
                }
              </p>
            </div>
          ) : (
            <MessageList
              messages={chatMessages}
              isTyping={false}
              hasMoreMessages={false}
            />
          )}
        </div>
      </div>
      </div>
    </Layout>
  );
};


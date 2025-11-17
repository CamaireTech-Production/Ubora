import React from 'react';
import { 
  Clock, 
  Calendar, 
  Repeat, 
  MessageSquare, 
  Play, 
  Pause, 
  Edit, 
  Trash2, 
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react';
import { Button } from '../ui/Button';
import { UniversBadge } from '../univers/UniversBadge';
import { ScheduledQuestion } from '../../types';

interface ScheduledQuestionCardProps {
  question: ScheduledQuestion;
  onEdit: (question: ScheduledQuestion) => void;
  onDelete: (questionId: string) => void;
  onViewResponses: (questionId: string) => void;
  onExecuteNow?: (questionId: string) => void;
  disabled?: boolean;
  isExecuting?: boolean;
  universName?: string; // Optional Univers name for badge
}

export const ScheduledQuestionCard: React.FC<ScheduledQuestionCardProps> = ({
  question,
  onEdit,
  onDelete,
  onViewResponses,
  onExecuteNow,
  disabled = false,
  isExecuting = false,
  universName
}) => {
  const getStatusIcon = () => {
    switch (question.status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'cancelled':
        return <Pause className="h-4 w-4 text-gray-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusLabel = () => {
    switch (question.status) {
      case 'pending':
        return 'En attente';
      case 'running':
        return 'En cours';
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

  const getStatusColor = () => {
    switch (question.status) {
      case 'pending':
        return 'bg-blue-100 text-blue-800';
      case 'running':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getFrequencyLabel = () => {
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

  const getNextExecutionText = () => {
    if (question.status === 'completed' && question.frequency === 'once') {
      return 'Exécution unique terminée';
    }
    
    if (question.nextExecution) {
      return `Prochaine: ${formatDate(question.nextExecution)}`;
    }
    
    return 'Pas de prochaine exécution';
  };

  const canExecuteNow = () => {
    return (question.status === 'pending' || question.status === 'failed') && onExecuteNow && !isExecuting;
  };

  const canEdit = () => {
    return question.status === 'pending' || question.status === 'failed';
  };

  const canDelete = () => {
    return question.status !== 'running';
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
      {/* En-tête avec titre et statut */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-2">
            {question.title}
          </h3>
          <p className="text-sm text-gray-600 line-clamp-2 mb-2">
            {question.question}
          </p>
          {question.fromUnivers && question.universId && (
            <div className="mt-2">
              <UniversBadge
                universId={question.universId}
                universName={universName}
                size="sm"
              />
            </div>
          )}
        </div>
        <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor()}`}>
          {getStatusIcon()}
          <span>{getStatusLabel()}</span>
        </div>
      </div>

      {/* Informations de programmation */}
      <div className="space-y-3 mb-4">
        {/* Date et heure programmées */}
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Calendar className="h-4 w-4 text-gray-400" />
          <span>Programmée: {formatDate(question.scheduledAt)}</span>
        </div>

        {/* Fréquence */}
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Repeat className="h-4 w-4 text-gray-400" />
          <span>{getFrequencyLabel()}</span>
        </div>

        {/* Prochaine exécution */}
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Clock className="h-4 w-4 text-gray-400" />
          <span>{getNextExecutionText()}</span>
        </div>

        {/* Nombre d'exécutions */}
        {question.executionCount > 0 && (
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <MessageSquare className="h-4 w-4 text-gray-400" />
            <span>{question.executionCount} exécution(s)</span>
          </div>
        )}
      </div>

      {/* Filtres appliqués */}
      {(question.filters.period !== 'all' || question.filters.formId || question.filters.userId) && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <h4 className="text-xs font-medium text-gray-700 mb-2">Filtres appliqués:</h4>
          <div className="space-y-1 text-xs text-gray-600">
            {question.filters.period !== 'all' && (
              <div>Période: {question.filters.period}</div>
            )}
            {question.filters.formId && (
              <div>Formulaire: {question.filters.formId}</div>
            )}
            {question.filters.userId && (
              <div>Utilisateur: {question.filters.userId}</div>
            )}
            {question.selectedFormat && (
              <div>Format: {question.selectedFormat}</div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {/* Voir les réponses */}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onViewResponses(question.id)}
          disabled={disabled}
          className="flex items-center space-x-1"
        >
          <MessageSquare className="h-4 w-4" />
          <span>Voir réponses</span>
        </Button>

        {/* Exécuter maintenant */}
        {canExecuteNow() && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onExecuteNow!(question.id)}
            disabled={disabled || isExecuting}
            className="flex items-center space-x-1"
          >
            {isExecuting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Exécution...</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                <span>{question.status === 'failed' ? 'Réessayer' : 'Exécuter'}</span>
              </>
            )}
          </Button>
        )}

        {/* Modifier */}
        {canEdit() && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onEdit(question)}
            disabled={disabled}
            className="flex items-center space-x-1"
          >
            <Edit className="h-4 w-4" />
            <span>Modifier</span>
          </Button>
        )}

        {/* Supprimer */}
        {canDelete() && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onDelete(question.id)}
            disabled={disabled}
            className="flex items-center space-x-1 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            <span>Supprimer</span>
          </Button>
        )}
      </div>
    </div>
  );
};



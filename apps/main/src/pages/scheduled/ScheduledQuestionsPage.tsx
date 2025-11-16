import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Calendar, Clock, MessageSquare, ArrowLeft, Wrench } from 'lucide-react';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { useApp } from '@ubora/shared/contexts/AppContext';
import { Button } from '../components/ui/Button';
import { ScheduledQuestionCard } from '../components/scheduled/ScheduledQuestionCard';
import { scheduledQuestionService } from '@ubora/shared/services/scheduledQuestionService';
import { useToast } from '@ubora/shared/hooks/useToast';
import { ScheduledQuestion } from '../types';
import { Layout } from '../components/layout/Layout';
import { WireframeLoader } from '../components/loading/WireframeLoader';
import { universService } from '@ubora/shared/services/universService';

export const ScheduledQuestionsPage: React.FC = () => {
  const { user } = useAuth();
  const { activeUniversId } = useApp();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  
  const [questions, setQuestions] = useState<ScheduledQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [frequencyFilter, setFrequencyFilter] = useState<string>('all');
  const [executingQuestions, setExecutingQuestions] = useState<Set<string>>(new Set());
  const [universMap, setUniversMap] = useState<Map<string, { name: string }>>(new Map()); // Cache Univers names

  // Charger les questions programmées et les Univers
  useEffect(() => {
    if (!user) return;

    const unsubscribe = scheduledQuestionService.subscribeToUserQuestions(
      user.id,
      user.agencyId,
      (questions) => {
        setQuestions(questions);
        setIsLoading(false);
      },
      activeUniversId || null
    );

    // Load Univers names for badges
    const loadUniversData = async () => {
      if (!user?.id || !user?.agencyId) return;
      try {
        const [myUnivers, marketplaceUnivers] = await Promise.all([
          universService.getByUser(user.id, user.agencyId),
          universService.getMarketplaceTemplates()
        ]);

        const map = new Map<string, { name: string }>();
        [...myUnivers, ...marketplaceUnivers].forEach(u => {
          map.set(u.id, { name: u.metadata.name });
        });

        setUniversMap(map);
      } catch (error) {
        console.error('Erreur lors du chargement des Univers:', error);
      }
    };

    loadUniversData();

    return unsubscribe;
  }, [user, activeUniversId]);

  // Filtrer les questions
  const filteredQuestions = questions.filter(question => {
    const matchesSearch = question.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         question.question.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || question.status === statusFilter;
    const matchesFrequency = frequencyFilter === 'all' || question.frequency === frequencyFilter;
    
    return matchesSearch && matchesStatus && matchesFrequency;
  });


  const handleCreateNew = () => {
    navigate('/directeur/scheduled-questions/new');
  };

  const handleBackToDashboard = () => {
    navigate('/directeur/dashboard');
  };

  const handleEdit = (question: ScheduledQuestion) => {
    navigate(`/directeur/scheduled-questions/${question.id}/edit`);
  };

  const handleDelete = async (questionId: string) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette question programmée ?')) {
      return;
    }

    try {
      await scheduledQuestionService.delete(questionId);
      showSuccess('Instruction programmée supprimée avec succès');
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      showError('Erreur lors de la suppression de l\'instruction programmée');
    }
  };

  const handleViewResponses = (questionId: string) => {
    navigate(`/directeur/scheduled-questions/${questionId}/chat`);
  };

  const handleExecuteNow = async (questionId: string) => {
    try {
      // Marquer comme en cours d'exécution
      setExecutingQuestions(prev => new Set(prev).add(questionId));
      showSuccess('Exécution de l\'instruction en cours...');
      
      // Importer le service d'exécution
      const { scheduledQuestionExecutor } = await import('../services/scheduledQuestionExecutor');
      
      // Exécuter l'instruction manuellement
      await scheduledQuestionExecutor.executeQuestionManually(questionId);
      
      showSuccess('Instruction exécutée avec succès ! Vous recevrez une notification avec la réponse.');
      
      // Rediriger vers la page de chat pour voir la réponse
      setTimeout(() => {
        navigate(`/directeur/scheduled-questions/${questionId}/chat`);
      }, 1500);
      
    } catch (error) {
      console.error('Erreur lors de l\'exécution:', error);
      showError('Erreur lors de l\'exécution de l\'instruction. Veuillez réessayer.');
    } finally {
      // Retirer de la liste des exécutions en cours
      setExecutingQuestions(prev => {
        const newSet = new Set(prev);
        newSet.delete(questionId);
        return newSet;
      });
    }
  };

  const handleFixStuckQuestions = async () => {
    try {
      showSuccess('Réparation des questions bloquées en cours...');
      
      // Importer le service d'exécution
      const { scheduledQuestionExecutor } = await import('../services/scheduledQuestionExecutor');
      
      // Réparer les questions bloquées
      await scheduledQuestionExecutor.fixStuckQuestions();
      
      showSuccess('Questions bloquées réparées avec succès !');
      
    } catch (error) {
      console.error('Erreur lors de la réparation:', error);
      showError('Erreur lors de la réparation des questions bloquées. Veuillez réessayer.');
    }
  };

  const getStatusCounts = () => {
    return {
      total: questions.length,
      pending: questions.filter(q => q.status === 'pending').length,
      running: questions.filter(q => q.status === 'running').length,
      completed: questions.filter(q => q.status === 'completed').length,
      failed: questions.filter(q => q.status === 'failed').length
    };
  };

  const statusCounts = getStatusCounts();

  if (isLoading) {
    return (
      <Layout title="Instructions Programmées">
        <WireframeLoader type="list" count={5} />
      </Layout>
    );
  }

  return (
    <Layout title="Instructions Programmées">
      <div className="min-h-screen bg-gray-50">
        {/* En-tête */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center space-x-4">
                <Button
                  onClick={handleBackToDashboard}
                  variant="secondary"
                  className="p-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Instructions Programmées</h1>
                  <p className="mt-1 text-sm text-gray-600">
                    Gérez vos instructions automatiques à ARCHA
                  </p>
                </div>
              </div>
              <div className="mt-4 sm:mt-0">
                <Button
                  onClick={handleCreateNew}
                  className="flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>Nouvelle Instruction</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Statistiques */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Total</p>
                <p className="text-2xl font-semibold text-gray-900">{statusCounts.total}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">En attente</p>
                <p className="text-2xl font-semibold text-blue-600">{statusCounts.pending}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-yellow-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">En cours</p>
                <p className="text-2xl font-semibold text-yellow-600">{statusCounts.running}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center">
              <MessageSquare className="h-8 w-8 text-green-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Terminées</p>
                <p className="text-2xl font-semibold text-green-600">{statusCounts.completed}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-red-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Échouées</p>
                <p className="text-2xl font-semibold text-red-600">{statusCounts.failed}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Recherche */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher une instruction..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Filtre par statut */}
            <div className="sm:w-48">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Tous les statuts</option>
                <option value="pending">En attente</option>
                <option value="running">En cours</option>
                <option value="completed">Terminées</option>
                <option value="failed">Échouées</option>
                <option value="cancelled">Annulées</option>
              </select>
            </div>

            {/* Filtre par fréquence */}
            <div className="sm:w-48">
              <select
                value={frequencyFilter}
                onChange={(e) => setFrequencyFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Toutes les fréquences</option>
                <option value="once">Une seule fois</option>
                <option value="daily">Quotidien</option>
                <option value="weekly">Hebdomadaire</option>
                <option value="monthly">Mensuel</option>
              </select>
            </div>
            
            {/* Bouton de réparation pour les questions bloquées */}
            {statusCounts.running > 0 && (
              <div className="flex items-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFixStuckQuestions}
                  className="flex items-center space-x-2 text-orange-600 border-orange-300 hover:bg-orange-50"
                >
                  <Wrench className="h-4 w-4" />
                  <span>Réparer les questions bloquées ({statusCounts.running})</span>
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Liste des questions */}
        {filteredQuestions.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Aucune instruction programmée</h3>
            <p className="mt-1 text-sm text-gray-500">
              {questions.length === 0 
                ? "Commencez par créer votre première instruction programmée."
                : "Aucune instruction ne correspond à vos filtres."
              }
            </p>
            {questions.length === 0 && (
              <div className="mt-6 flex justify-center">
                <Button onClick={handleCreateNew} className="flex items-center">
                  <Plus className="h-4 w-4 mr-2" />
                  Créer une instruction programmée
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredQuestions.map((question) => (
                <ScheduledQuestionCard
                  key={question.id}
                  question={question}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onViewResponses={handleViewResponses}
                  onExecuteNow={handleExecuteNow}
                  isExecuting={executingQuestions.has(question.id)}
                  universName={question.universId ? universMap.get(question.universId)?.name : undefined}
                />
              ))}
          </div>
        )}
        </div>
      </div>
    </Layout>
  );
};


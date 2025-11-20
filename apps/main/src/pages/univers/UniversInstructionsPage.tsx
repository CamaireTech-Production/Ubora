import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { logger } from '@ubora/shared/utils/logger';
import { useApp } from '@ubora/shared/contexts/AppContext';
import { universService } from '@ubora/shared/services/universService';
import { Univers } from '../../types';
import { 
  ArrowLeft, 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  Filter,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useToast } from '@ubora/shared/hooks/useToast';
// Formatage de date simple sans dépendance externe

export const UniversInstructionsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeUniversId } = useApp();
  const { showError } = useToast();
  const [univers, setUnivers] = useState<Univers | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedInstructionId, setExpandedInstructionId] = useState<string | null>(null);
  const [filterFrequency, setFilterFrequency] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Charger l'univers actif
  useEffect(() => {
    const loadUnivers = async () => {
      if (!user || user.role !== 'directeur' || !activeUniversId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const universData = await universService.getById(activeUniversId);
        if (universData) {
          setUnivers(universData);
        } else {
          showError('Univers actif non trouvé');
        }
      } catch (error) {
        logger.error('Erreur lors du chargement de l\'univers', error, 'UniversInstructionsPage');
        showError('Erreur lors du chargement de l\'univers');
      } finally {
        setIsLoading(false);
      }
    };

    loadUnivers();
  }, [user, activeUniversId, showError]);

  // Filtrer les instructions
  const filteredInstructions = React.useMemo(() => {
    if (!univers?.definitions?.instructions) return [];

    let filtered = [...univers.definitions.instructions];

    // Filtrer par fréquence
    if (filterFrequency !== 'all') {
      filtered = filtered.filter(inst => inst.frequency === filterFrequency);
    }

    // Filtrer par terme de recherche
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(inst => 
        inst.title?.toLowerCase().includes(term) ||
        inst.description?.toLowerCase().includes(term) ||
        inst.question?.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [univers?.definitions?.instructions, filterFrequency, searchTerm]);

  // Formater la fréquence
  const formatFrequency = (frequency: string): string => {
    const map: Record<string, string> = {
      'once': 'Une fois',
      'daily': 'Quotidienne',
      'weekly': 'Hebdomadaire',
      'monthly': 'Mensuelle'
    };
    return map[frequency] || frequency;
  };

  // Formater la date
  const formatDate = (date: Date | string | null | undefined): string => {
    if (!date) return 'Non définie';
    try {
      const dateObj = date instanceof Date ? date : new Date(date);
      return dateObj.toLocaleString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Date invalide';
    }
  };

  // Rediriger si pas directeur
  if (user?.role !== 'directeur') {
    return (
      <Layout title="Instructions Programmées">
        <div className="text-center py-12">
          <p className="text-gray-600">Accès réservé aux directeurs</p>
          <Button onClick={() => navigate('/directeur/dashboard')} className="mt-4">
            Retour au dashboard
          </Button>
        </div>
      </Layout>
    );
  }

  if (isLoading) {
    return (
      <Layout title="Instructions Programmées">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </Layout>
    );
  }

  if (!univers) {
    return (
      <Layout title="Instructions Programmées">
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">Aucun univers actif trouvé</p>
          <Button onClick={() => navigate('/directeur/dashboard')}>
            Retour au dashboard
          </Button>
        </div>
      </Layout>
    );
  }

  const instructions = univers.definitions?.instructions || [];

  return (
    <Layout title="Instructions Programmées">
      <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/directeur/dashboard')}
              className="self-start sm:self-auto"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Instructions Programmées</h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                Univers: <span className="font-medium break-words">{univers.metadata.name}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
          <Card className="p-2 sm:p-3">
            <div className="text-center">
              <p className="text-lg sm:text-xl font-bold text-gray-900">{instructions.length}</p>
              <p className="text-xs text-gray-600 mt-0.5">Total</p>
            </div>
          </Card>
          <Card className="p-2 sm:p-3">
            <div className="text-center">
              <p className="text-lg sm:text-xl font-bold text-blue-600">
                {instructions.filter(i => i.frequency === 'daily').length}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">Quotidiennes</p>
            </div>
          </Card>
          <Card className="p-2 sm:p-3">
            <div className="text-center">
              <p className="text-lg sm:text-xl font-bold text-green-600">
                {instructions.filter(i => i.frequency === 'weekly').length}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">Hebdomadaires</p>
            </div>
          </Card>
          <Card className="p-2 sm:p-3">
            <div className="text-center">
              <p className="text-lg sm:text-xl font-bold text-purple-600">
                {instructions.filter(i => i.frequency === 'monthly').length}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">Mensuelles</p>
            </div>
          </Card>
        </div>

        {/* Filtres et recherche */}
        <Card className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <input
                type="text"
                placeholder="Rechercher par titre, description ou question..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-2 sm:space-x-2">
              <Filter className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500 flex-shrink-0" />
              <select
                value={filterFrequency}
                onChange={(e) => setFilterFrequency(e.target.value)}
                className="flex-1 sm:flex-none px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Toutes les fréquences</option>
                <option value="once">Une fois</option>
                <option value="daily">Quotidienne</option>
                <option value="weekly">Hebdomadaire</option>
                <option value="monthly">Mensuelle</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Liste des instructions */}
        {filteredInstructions.length === 0 ? (
          <Card className="p-4 sm:p-6">
            <div className="text-center py-8 sm:py-12">
              <FileText className="h-10 w-10 sm:h-12 sm:w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-sm sm:text-base text-gray-600 px-4">
                {instructions.length === 0 
                  ? 'Aucune instruction programmée dans cet univers'
                  : 'Aucune instruction ne correspond aux filtres sélectionnés'
                }
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {filteredInstructions.map((instruction, index) => {
              const instructionId = instruction.id || `instruction-${index}`;
              const isExpanded = expandedInstructionId === instructionId;

              return (
                <Card key={instructionId} className="p-0 overflow-hidden">
                  <div className="bg-green-50 rounded-lg border border-green-200 overflow-hidden">
                    {/* Header */}
                    <button
                      onClick={() => {
                        setExpandedInstructionId(isExpanded ? null : instructionId);
                      }}
                      className="w-full p-3 sm:p-4 flex items-start justify-between hover:bg-green-100 transition-colors gap-2 sm:gap-4"
                    >
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                          <h4 className="text-base sm:text-lg font-semibold text-gray-900 break-words">
                            {instruction.title || `Instruction ${index + 1}`}
                          </h4>
                          {instruction.frequency && (
                            <span className="px-2 sm:px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium whitespace-nowrap self-start sm:self-auto">
                              {formatFrequency(instruction.frequency)}
                            </span>
                          )}
                        </div>
                        {instruction.description && (
                          <p className="text-xs sm:text-sm text-gray-600 mt-1 break-words">{instruction.description}</p>
                        )}
                      </div>
                      <div className="ml-2 sm:ml-4 flex-shrink-0">
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-gray-500" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-500" />
                        )}
                      </div>
                    </button>

                    {/* Détails (expandable) */}
                    {isExpanded && (
                      <div className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-3 sm:space-y-4 border-t border-green-200 pt-3 sm:pt-4">
                        {/* Question */}
                        <div>
                          <h5 className="text-xs sm:text-sm font-medium text-gray-700 mb-2 flex items-center">
                            <FileText className="h-3 w-3 sm:h-4 sm:w-4 mr-2 flex-shrink-0" />
                            Question programmée
                          </h5>
                          <div className="bg-white p-2 sm:p-3 rounded-md border border-gray-200">
                            <p className="text-xs sm:text-sm text-gray-800 break-words">{instruction.question}</p>
                          </div>
                        </div>

                        {/* Informations de programmation */}
                        <div>
                          <h5 className="text-xs sm:text-sm font-medium text-gray-700 mb-2 flex items-center">
                            <Calendar className="h-3 w-3 sm:h-4 sm:w-4 mr-2 flex-shrink-0" />
                            Informations de programmation
                          </h5>
                          <div className="bg-white p-2 sm:p-3 rounded-md border border-gray-200 space-y-2">
                            {instruction.scheduledAt && (
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0">
                                <span className="text-xs text-gray-600">Date programmée:</span>
                                <span className="text-xs font-medium text-gray-900 break-words text-right sm:text-left">
                                  {formatDate(instruction.scheduledAt)}
                                </span>
                              </div>
                            )}
                            {instruction.frequency && (
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0">
                                <span className="text-xs text-gray-600">Fréquence:</span>
                                <span className="text-xs font-medium text-gray-900">
                                  {formatFrequency(instruction.frequency)}
                                </span>
                              </div>
                            )}
                            {instruction.maxExecutions && (
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0">
                                <span className="text-xs text-gray-600">Exécutions max:</span>
                                <span className="text-xs font-medium text-gray-900">
                                  {instruction.maxExecutions}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Filtres */}
                        {instruction.filters && (
                          <div>
                            <h5 className="text-xs sm:text-sm font-medium text-gray-700 mb-2 flex items-center">
                              <Filter className="h-3 w-3 sm:h-4 sm:w-4 mr-2 flex-shrink-0" />
                              Filtres
                            </h5>
                            <div className="bg-white p-2 sm:p-3 rounded-md border border-gray-200 space-y-2">
                              {instruction.filters.period && (
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0">
                                  <span className="text-xs text-gray-600">Période:</span>
                                  <span className="text-xs font-medium text-gray-900 break-words text-right sm:text-left">
                                    {instruction.filters.period === 'all' ? 'Toutes' : instruction.filters.period}
                                  </span>
                                </div>
                              )}
                              {instruction.filters.formId && (
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0">
                                  <span className="text-xs text-gray-600">Formulaire:</span>
                                  <span className="text-xs font-medium text-gray-900 break-words text-right sm:text-left">
                                    {instruction.filters.formId || 'Tous'}
                                  </span>
                                </div>
                              )}
                              {instruction.filters.userId && (
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0">
                                  <span className="text-xs text-gray-600">Utilisateur:</span>
                                  <span className="text-xs font-medium text-gray-900 break-words text-right sm:text-left">
                                    {instruction.filters.userId || 'Tous'}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Formats */}
                        {(instruction.selectedFormat || (instruction.selectedFormats && instruction.selectedFormats.length > 0)) && (
                          <div>
                            <h5 className="text-xs sm:text-sm font-medium text-gray-700 mb-2">Format de réponse</h5>
                            <div className="bg-white p-2 sm:p-3 rounded-md border border-gray-200">
                              {instruction.selectedFormat && (
                                <p className="text-xs text-gray-900 break-words">{instruction.selectedFormat}</p>
                              )}
                              {instruction.selectedFormats && instruction.selectedFormats.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {instruction.selectedFormats.map((format, idx) => (
                                    <span
                                      key={idx}
                                      className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs"
                                    >
                                      {format}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
};


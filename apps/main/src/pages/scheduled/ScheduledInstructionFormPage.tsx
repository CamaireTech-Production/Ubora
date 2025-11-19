import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, X } from 'lucide-react';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { logger } from '@ubora/shared/utils/logger';
import { useApp } from '@ubora/shared/contexts/AppContext';
import { Button } from '../../components/ui/Button';
import { ChatComposer } from '../../components/chat/ChatComposer';
import { ScheduledDateTimePicker } from '../../components/scheduled/ScheduledDateTimePicker';
import { scheduledQuestionService } from '@ubora/shared/services/scheduledQuestionService';
import { useToast } from '@ubora/shared/hooks/useToast';
import { ScheduledQuestion } from '../../types';
import { Layout } from '../../components/layout/Layout';

interface ChatFilters {
  period: string;
  formId: string;
  userId: string;
}

export const ScheduledQuestionFormPage: React.FC = () => {
  const { user } = useAuth();
  const { forms, employees } = useApp();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { showSuccess, showError } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [question, setQuestion] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  
  // Programmation
  const [scheduledAt, setScheduledAt] = useState(new Date());
  const [frequency, setFrequency] = useState<'once' | 'daily' | 'weekly' | 'monthly'>('once');
  
  // Filtres et formats (identique au chat)
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  const [selectedFormIds, setSelectedFormIds] = useState<string[]>([]);
  const [filters, setFilters] = useState<ChatFilters>({
    period: 'all',
    formId: '',
    userId: ''
  });

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isEditMode = Boolean(id);

  // Charger la question existante en mode édition
  useEffect(() => {
    if (isEditMode && id) {
      loadQuestion(id);
    } else {
      setIsLoading(false);
    }
  }, [id, isEditMode]);

  const loadQuestion = async (questionId: string) => {
    try {
      const questionData = await scheduledQuestionService.getById(questionId);
      if (questionData) {
        setQuestion(questionData.question);
        setTitle(questionData.title);
        setDescription(questionData.description || '');
        setScheduledAt(questionData.scheduledAt);
        setFrequency(questionData.frequency);
        setSelectedFormat(questionData.selectedFormat);
        setSelectedFormats(questionData.selectedFormats);
        setSelectedFormIds(questionData.selectedFormIds);
        setFilters(questionData.filters);
      } else {
        showError('Question programmée non trouvée');
        navigate('/directeur/scheduled-questions');
      }
    } catch (error) {
      logger.error('Erreur lors du chargement de la question', error, 'ScheduledInstructionFormPage');
      showError('Erreur lors du chargement de la question');
      navigate('/directeur/scheduled-questions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    // Validation
    if (!title.trim()) {
      showError('Le titre est obligatoire');
      return;
    }

    if (!question.trim()) {
      showError('La question est obligatoire');
      return;
    }

    if (scheduledAt <= new Date() && frequency === 'once') {
      showError('La date doit être dans le futur pour une exécution unique');
      return;
    }

    setIsSaving(true);

    try {
      const questionData: Omit<ScheduledQuestion, 'id' | 'createdAt' | 'executionCount'> = {
        userId: user.id,
        agencyId: user.agencyId,
        question: question.trim(),
        title: title.trim(),
        description: description.trim() || undefined,
        scheduledAt,
        frequency,
        nextExecution: scheduledQuestionService.calculateNextExecution(scheduledAt, frequency),
        status: 'pending',
        filters,
        selectedFormat,
        selectedFormats,
        selectedFormIds
      };

      if (isEditMode && id) {
        await scheduledQuestionService.update(id, questionData);
        showSuccess('Question programmée mise à jour avec succès');
      } else {
        await scheduledQuestionService.create(questionData);
        showSuccess('Question programmée créée avec succès');
      }

      navigate('/directeur/scheduled-questions');
    } catch (error) {
      logger.error('Erreur lors de la sauvegarde', error, 'ScheduledInstructionFormPage');
      showError('Erreur lors de la sauvegarde de la question programmée');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    navigate('/directeur/scheduled-questions');
  };

  const handleQuestionChange = (value: string) => {
    setQuestion(value);
    
    // Générer un titre automatique si vide
    if (!title.trim() && value.trim()) {
      const words = value.trim().split(' ').slice(0, 6);
      setTitle(words.join(' ') + (value.trim().split(' ').length > 6 ? '...' : ''));
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ArrowLeft className="h-12 w-12 text-blue-600 animate-pulse mx-auto mb-4" />
          <p className="text-gray-600">Chargement de la question programmée...</p>
        </div>
      </div>
    );
  }

  return (
    <Layout title={isEditMode ? 'Modifier la question programmée' : 'Nouvelle question programmée'}>
      <div className="min-h-screen bg-gray-50">
      {/* En-tête */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCancel}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {isEditMode ? 'Modifier la question programmée' : 'Nouvelle question programmée'}
                </h1>
                <p className="text-sm text-gray-600">
                  Configurez votre question et sa programmation
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="secondary"
                onClick={handleCancel}
                disabled={isSaving}
                className="flex items-center space-x-2"
              >
                <X className="h-4 w-4" />
                <span>Annuler</span>
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving || !title.trim() || !question.trim()}
                className="flex items-center space-x-2"
              >
                <Save className="h-4 w-4" />
                <span>{isSaving ? 'Sauvegarde...' : 'Sauvegarder'}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Colonne principale - Interface de chat */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* En-tête du chat */}
              <div className="border-b border-gray-200 p-4">
                <h2 className="text-lg font-semibold text-gray-900">Configuration de la question</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Saisissez votre question et configurez les filtres comme dans le chat normal
                </p>
              </div>

              {/* Titre de la question */}
              <div className="p-4 border-b border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Titre de la question *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Donnez un titre à votre question programmée..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Description optionnelle */}
              <div className="p-4 border-b border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (optionnelle)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ajoutez une description pour cette question programmée..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Interface de chat */}
              <div className="p-4">
                <ChatComposer
                  value={question}
                  onChange={handleQuestionChange}
                  onSend={() => {}} // Pas d'envoi direct
                  selectedFormat={selectedFormat}
                  selectedFormats={selectedFormats}
                  onFormatChange={setSelectedFormat}
                  onFormatsChange={setSelectedFormats}
                  forms={forms}
                  employees={employees}
                  filters={filters}
                  onFiltersChange={setFilters}
                  selectedFormIds={selectedFormIds}
                  onFormSelectionChange={setSelectedFormIds}
                  disabled={false}
                  placeholder="Écrivez votre question pour ARCHA..."
                  showFormatSelector={true}
                  showComprehensiveFilter={true}
                  allowMultipleFormats={true}
                  inputRef={inputRef}
                />
              </div>
            </div>
          </div>

          {/* Colonne latérale - Programmation */}
          <div className="lg:col-span-1">
            <ScheduledDateTimePicker
              scheduledAt={scheduledAt}
              frequency={frequency}
              onDateTimeChange={setScheduledAt}
              onFrequencyChange={setFrequency}
            />

            {/* Aperçu de la configuration */}
            <div className="mt-6 bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Aperçu</h3>
              
              <div className="space-y-3 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Titre:</span>
                  <p className="text-gray-600 mt-1">{title || 'Non défini'}</p>
                </div>
                
                <div>
                  <span className="font-medium text-gray-700">Question:</span>
                  <p className="text-gray-600 mt-1 line-clamp-3">
                    {question || 'Aucune question saisie'}
                  </p>
                </div>
                
                <div>
                  <span className="font-medium text-gray-700">Filtres:</span>
                  <div className="text-gray-600 mt-1 space-y-1">
                    <div>Période: {filters.period}</div>
                    {filters.formId && <div>Formulaire: {filters.formId}</div>}
                    {filters.userId && <div>Utilisateur: {filters.userId}</div>}
                    {selectedFormat && <div>Format: {selectedFormat}</div>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </Layout>
  );
};


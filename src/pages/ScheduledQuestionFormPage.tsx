import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { WireframeLoader } from '../components/loading/WireframeLoader';
import { Button } from '../components/Button';
import { SimpleInstructionInput } from '../components/scheduled/SimpleInstructionInput';
import { SimpleFormatSelector } from '../components/scheduled/SimpleFormatSelector';
import { SimpleFilterSelector } from '../components/scheduled/SimpleFilterSelector';
import { ScheduledDateTimePicker } from '../components/scheduled/ScheduledDateTimePicker';
import { scheduledQuestionService } from '../services/scheduledQuestionService';
import { useToast } from '../hooks/useToast';
import { ScheduledQuestion } from '../types';
import { Layout } from '../components/Layout';

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
  
  // Filtres et formats (simplifiés)
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [filters, setFilters] = useState<ChatFilters>({
    period: 'all',
    formId: '',
    userId: ''
  });
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
        setFilters(questionData.filters);
      } else {
        showError('Instruction programmée non trouvée');
        navigate('/directeur/scheduled-questions');
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la question:', error);
      showError('Erreur lors du chargement de l\'instruction');
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
        description: description.trim() || null,
        scheduledAt,
        frequency,
        nextExecution: scheduledQuestionService.calculateNextExecution(scheduledAt, frequency),
        status: 'pending',
        filters,
        selectedFormat: selectedFormat || null,
        selectedFormats: [],
        selectedFormIds: []
      };

      if (isEditMode && id) {
        await scheduledQuestionService.update(id, questionData);
        showSuccess('Instruction programmée mise à jour avec succès');
      } else {
        await scheduledQuestionService.create(questionData);
        showSuccess('Instruction programmée créée avec succès');
      }

      navigate('/directeur/scheduled-questions');
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      showError('Erreur lors de la sauvegarde de l\'instruction programmée');
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

  // Validation du formulaire
  const isFormValid = title.trim() && question.trim();

  if (isLoading) {
    return (
      <Layout title="Formulaire de Question Programmée">
        <WireframeLoader type="form" />
      </Layout>
    );
  }

  return (
    <Layout title={isEditMode ? 'Modifier l\'instruction programmée' : 'Nouvelle instruction programmée'}>
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
                <span>Retour</span>
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {isEditMode ? 'Modifier l\'instruction programmée' : 'Nouvelle instruction programmée'}
                </h1>
                <p className="text-sm text-gray-600">
                  Configurez votre instruction et sa programmation
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
                disabled={isSaving || !isFormValid}
                className={`flex items-center space-x-2 ${
                  !isSaving && isFormValid 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                title={
                  !isFormValid 
                    ? `Champs manquants: ${!title.trim() ? 'Titre' : ''} ${!question.trim() ? 'Instruction' : ''}`.trim()
                    : 'Sauvegarder l\'instruction programmée'
                }
              >
                <Save className="h-4 w-4" />
                <span>
                  {isSaving ? 'Sauvegarde...' : 
                   !isFormValid ? 'Champs requis manquants' : 
                   'Sauvegarder'}
                </span>
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
                <h2 className="text-lg font-semibold text-gray-900">Configuration de l'instruction</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Saisissez votre instruction et configurez les filtres comme dans le chat normal
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
                  placeholder="Donnez un titre à votre instruction programmée..."
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
                  placeholder="Ajoutez une description pour cette instruction programmée..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Interface simplifiée */}
              <div className="p-4 space-y-6">
                {/* Instruction */}
                <SimpleInstructionInput
                  value={question}
                  onChange={handleQuestionChange}
                  placeholder="Écrivez votre instruction pour ARCHA..."
                />

                {/* Format de réponse */}
                <SimpleFormatSelector
                  selectedFormat={selectedFormat}
                  onFormatChange={setSelectedFormat}
                />

                {/* Filtres */}
                <SimpleFilterSelector
                  filters={filters}
                  onFiltersChange={setFilters}
                  forms={forms}
                  employees={employees}
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
            <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Aperçu</h3>
              
              <div className="space-y-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700 block mb-2">Titre:</span>
                  <p className="text-gray-600 bg-gray-50 p-3 rounded-lg border">
                    {title || 'Non défini'}
                  </p>
                </div>
                
                {description && (
                  <div>
                    <span className="font-medium text-gray-700 block mb-2">Description:</span>
                    <p className="text-gray-600 bg-gray-50 p-3 rounded-lg border">
                      {description}
                    </p>
                  </div>
                )}
                
                <div>
                  <span className="font-medium text-gray-700 block mb-2">Instruction:</span>
                  <p className={`p-3 rounded-lg border min-h-[60px] ${
                    question.trim() 
                      ? 'text-gray-600 bg-gray-50' 
                      : 'text-red-500 bg-red-50 border-red-200'
                  }`}>
                    {question.trim() || '⚠️ Aucune instruction saisie'}
                  </p>
                </div>
                
                <div>
                  <span className="font-medium text-gray-700 block mb-2">Configuration:</span>
                  <div className="bg-gray-50 p-3 rounded-lg border space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Période:</span>
                      <span className="text-gray-700 font-medium">{filters.period}</span>
                    </div>
                    
                    {filters.formId && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Formulaire:</span>
                        <span className="text-gray-700 font-medium">{filters.formId}</span>
                      </div>
                    )}
                    
                    {filters.userId && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Utilisateur:</span>
                        <span className="text-gray-700 font-medium">{filters.userId}</span>
                      </div>
                    )}
                    
                    {selectedFormat && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Format:</span>
                        <span className="text-gray-700 font-medium">{selectedFormat}</span>
                      </div>
                    )}
                    
                  </div>
                </div>
                
                <div>
                  <span className="font-medium text-gray-700 block mb-2">Programmation:</span>
                  <div className="bg-gray-50 p-3 rounded-lg border space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Date:</span>
                      <span className="text-gray-700 font-medium">
                        {scheduledAt.toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Heure:</span>
                      <span className="text-gray-700 font-medium">
                        {scheduledAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Fréquence:</span>
                      <span className="text-gray-700 font-medium">
                        {frequency === 'once' ? 'Une seule fois' :
                         frequency === 'daily' ? 'Quotidien' :
                         frequency === 'weekly' ? 'Hebdomadaire' :
                         frequency === 'monthly' ? 'Mensuel' : frequency}
                      </span>
                    </div>
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


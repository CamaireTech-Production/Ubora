import React, { useState, useEffect, useMemo } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { Select } from './Select';
import { UniversWizardStepProps } from './UniversWizard';
import { Form } from '../types';
import { SimpleInstructionInput } from './scheduled/SimpleInstructionInput';
import { SimpleFormatSelector } from './scheduled/SimpleFormatSelector';
import { SimpleFilterSelector } from './scheduled/SimpleFilterSelector';
import { ScheduledDateTimePicker } from './scheduled/ScheduledDateTimePicker';
import { Plus, Trash2, Edit, Calendar, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { useApp } from '@ubora/shared/contexts/AppContext';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { useToast } from '@ubora/shared/hooks/useToast';
import { scheduledQuestionService } from '@ubora/shared/services/scheduledQuestionService';
import { getCameroonTime } from '@ubora/shared/utils/timezoneUtils';
import { ConfirmationModal } from './ConfirmationModal';

// InstructionDefinition interface for Univers
interface InstructionDefinition {
  id: string;
  title: string;
  description?: string;
  question: string;
  filters: {
    period: string;
    formId: string;
    userId: string;
  };
  selectedFormat: string | null;
  selectedFormats: string[];
  selectedFormIds: string[];
  scheduledAt: Date;
  frequency: 'once' | 'daily' | 'weekly' | 'monthly';
  maxExecutions?: number;
}

interface ChatFilters {
  period: string;
  formId: string;
  userId: string;
}

export const UniversWizardStep5: React.FC<UniversWizardStepProps> = ({
  wizardData,
  updateWizardData,
  markStepCompleted,
  step,
  readOnly = false,
  templateData
}) => {
  const { employees } = useApp();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  // En mode lecture seule, utiliser les données du template
  const initialInstructions = readOnly && templateData 
    ? (templateData.definitions.instructions || [])
    : ((wizardData.definitions.instructions as InstructionDefinition[]) || []);

  const [instructions, setInstructions] = useState<InstructionDefinition[]>(initialInstructions);
  const [showInstructionBuilder, setShowInstructionBuilder] = useState(false);
  const [editingInstructionId, setEditingInstructionId] = useState<string | null>(null);

  // Form state for instruction builder
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [question, setQuestion] = useState('');
  const [scheduledAt, setScheduledAt] = useState(getCameroonTime());
  const [frequency, setFrequency] = useState<'once' | 'daily' | 'weekly' | 'monthly'>('once');
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  const [selectedFormIds, setSelectedFormIds] = useState<string[]>([]);
  const [filters, setFilters] = useState<ChatFilters>({
    period: 'all',
    formId: '',
    userId: ''
  });
  const [instructionToDelete, setInstructionToDelete] = useState<InstructionDefinition | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Helper function to normalize date from various formats
  const normalizeDate = (dateValue: any): Date => {
    if (dateValue instanceof Date) {
      return dateValue;
    }
    if (dateValue && typeof dateValue === 'object') {
      // Firestore Timestamp with toDate method
      if ('toDate' in dateValue && typeof dateValue.toDate === 'function') {
        return dateValue.toDate();
      }
      // Firestore Timestamp sérialisé (has seconds property)
      if ('seconds' in dateValue && typeof dateValue.seconds === 'number') {
        return new Date(dateValue.seconds * 1000);
      }
      // Try to convert object to date
      try {
        return new Date(dateValue);
      } catch {
        return new Date();
      }
    }
    if (typeof dateValue === 'string') {
      const parsed = new Date(dateValue);
      return isNaN(parsed.getTime()) ? new Date() : parsed;
    }
    // Fallback to current date
    return new Date();
  };

  // Sync local state with wizardData when it changes (e.g., after loading from localStorage)
  useEffect(() => {
    const savedInstructions = (wizardData.definitions.instructions as InstructionDefinition[]) || [];
    
    // Normalize dates in saved instructions
    const normalizedInstructions = savedInstructions.map(instruction => ({
      ...instruction,
      scheduledAt: normalizeDate(instruction.scheduledAt)
    }));
    
    // Only update if the saved instructions are different from current instructions
    // Check by length first, then by deep comparison if needed
    if (normalizedInstructions.length !== instructions.length) {
      setInstructions(normalizedInstructions);
    } else if (normalizedInstructions.length > 0) {
      // Deep comparison only if arrays have items (excluding dates from comparison)
      // Normalize current instructions dates before comparison
      const normalizedCurrent = instructions.map(i => ({
        ...i,
        scheduledAt: normalizeDate(i.scheduledAt)
      }));
      
      const savedStr = JSON.stringify(normalizedInstructions.map(i => ({ ...i, scheduledAt: i.scheduledAt.getTime() })));
      const currentStr = JSON.stringify(normalizedCurrent.map(i => ({ ...i, scheduledAt: i.scheduledAt.getTime() })));
      
      if (savedStr !== currentStr) {
        setInstructions(normalizedInstructions);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardData.definitions.instructions]);

  // Convert Form definitions to Form objects for filters
  const universForms = useMemo<Form[]>(() => {
    const formDefinitions = (wizardData.definitions.forms || []) as any[];
    return formDefinitions.map((formDef): Form => ({
      id: formDef.id,
      title: formDef.title,
      description: formDef.description,
      createdBy: user?.id || '',
      createdByRole: 'directeur',
      assignedTo: [],
      fields: formDef.fields || [],
      createdAt: new Date(),
      agencyId: user?.agencyId || ''
    }));
  }, [wizardData.definitions.forms, user]);

  // Check if forms exist (for filters)
  const hasForms = universForms.length > 0;

  // Update wizard data when instructions change (seulement si pas en lecture seule)
  useEffect(() => {
    if (!readOnly) {
      updateWizardData({
        definitions: {
          instructions: instructions
        }
      });

      // Mark step as completed if instructions exist
      if (instructions.length > 0) {
        markStepCompleted(6); // Instructions is now step 6
      }
    } else {
      // En mode lecture seule, marquer comme complété automatiquement
      markStepCompleted(6);
    }
  }, [instructions, updateWizardData, markStepCompleted, step, readOnly]);

  const handleAddInstruction = () => {
    resetForm();
    setShowInstructionBuilder(true);
  };

  const handleEditInstruction = (instructionId: string) => {
    const instruction = instructions.find(i => i.id === instructionId);
    if (instruction) {
      setTitle(instruction.title);
      setDescription(instruction.description || '');
      setQuestion(instruction.question);
      setScheduledAt(normalizeDate(instruction.scheduledAt));
      setFrequency(instruction.frequency);
      setSelectedFormat(instruction.selectedFormat);
      setSelectedFormats(instruction.selectedFormats);
      setSelectedFormIds(instruction.selectedFormIds);
      setFilters(instruction.filters);
      setEditingInstructionId(instructionId);
      setShowInstructionBuilder(true);
    }
  };

  const handleDeleteInstructionClick = (instruction: InstructionDefinition) => {
    setInstructionToDelete(instruction);
    setShowDeleteModal(true);
  };

  const confirmDeleteInstruction = () => {
    if (instructionToDelete) {
      setInstructions(instructions.filter(i => i.id !== instructionToDelete.id));
      showSuccess('Instruction supprimée');
      setInstructionToDelete(null);
      setShowDeleteModal(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setQuestion('');
    setScheduledAt(getCameroonTime());
    setFrequency('once');
    setSelectedFormat(null);
    setSelectedFormats([]);
    setSelectedFormIds([]);
    setFilters({
      period: 'all',
      formId: '',
      userId: ''
    });
    setEditingInstructionId(null);
  };

  const handleQuestionChange = (value: string) => {
    setQuestion(value);
    
    // Generate automatic title if empty
    if (!title.trim() && value.trim()) {
      const words = value.trim().split(' ').slice(0, 6);
      setTitle(words.join(' ') + (value.trim().split(' ').length > 6 ? '...' : ''));
    }
  };

  const handleSaveInstruction = () => {
    // Validation
    if (!title.trim()) {
      showError('Le titre est obligatoire');
      return;
    }

    if (!question.trim()) {
      showError('L\'instruction est obligatoire');
      return;
    }

    if (scheduledAt <= getCameroonTime() && frequency === 'once') {
      showError('La date doit être dans le futur pour une exécution unique (heure Cameroun)');
      return;
    }

    const instructionData: InstructionDefinition = {
      id: editingInstructionId || `instruction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: title.trim(),
      description: description.trim() || undefined,
      question: question.trim(),
      scheduledAt,
      frequency,
      filters,
      selectedFormat,
      selectedFormats,
      selectedFormIds,
      maxExecutions: frequency === 'once' ? 1 : undefined
    };

    if (editingInstructionId) {
      // Update existing instruction
      setInstructions(instructions.map(i => 
        i.id === editingInstructionId ? instructionData : i
      ));
      showSuccess('Instruction modifiée');
    } else {
      // Create new instruction
      setInstructions([...instructions, instructionData]);
      showSuccess('Instruction ajoutée');
    }

    setShowInstructionBuilder(false);
    resetForm();
  };

  const handleCancelInstructionBuilder = () => {
    setShowInstructionBuilder(false);
    resetForm();
  };

  const isFormValid = title.trim() && question.trim();

  // En mode lecture seule, afficher une vue en lecture seule
  if (readOnly) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Instructions programmées
          </h2>
          <p className="text-gray-600">
            Aperçu des instructions programmées du Univers template.
          </p>
        </div>

        {/* Instructions Display (Read-only) avec détails complets */}
        {instructions.length > 0 ? (
          <div className="space-y-4">
            {instructions.map(instruction => (
              <Card key={instruction.id} className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <Calendar className="h-5 w-5 text-green-600" />
                      <h3 className="text-lg font-semibold text-gray-900">{instruction.title}</h3>
                    </div>
                    {instruction.description && (
                      <p className="text-sm text-gray-600 mb-3">{instruction.description}</p>
                    )}
                    {instruction.frequency && (
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        {instruction.frequency === 'once' ? 'Une fois' : instruction.frequency === 'daily' ? 'Quotidienne' : instruction.frequency === 'weekly' ? 'Hebdomadaire' : 'Mensuelle'}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="mt-4 space-y-3">
                  {instruction.question && (
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-1">Question:</h5>
                      <p className="text-sm text-gray-900 bg-white p-3 rounded-md border border-green-100">{instruction.question}</p>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {instruction.filters && (
                      <div>
                        <h5 className="text-sm font-medium text-gray-700 mb-1">Filtres:</h5>
                        <div className="bg-white p-3 rounded-md border border-green-100 space-y-1">
                          {instruction.filters.period && (
                            <p className="text-xs text-gray-600">Période: {instruction.filters.period}</p>
                          )}
                          {instruction.filters.formId && (
                            <p className="text-xs text-gray-600">Formulaire ID: {instruction.filters.formId}</p>
                          )}
                          {instruction.filters.userId && (
                            <p className="text-xs text-gray-600">Utilisateur ID: {instruction.filters.userId}</p>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-1">Informations:</h5>
                      <div className="bg-white p-3 rounded-md border border-green-100 space-y-1">
                        {instruction.frequency && (
                          <p className="text-xs text-gray-600">Fréquence: {instruction.frequency === 'once' ? 'Une fois' : instruction.frequency === 'daily' ? 'Quotidienne' : instruction.frequency === 'weekly' ? 'Hebdomadaire' : 'Mensuelle'}</p>
                        )}
                        {instruction.maxExecutions && (
                          <p className="text-xs text-gray-600">Max exécutions: {instruction.maxExecutions}</p>
                        )}
                        {instruction.selectedFormat && (
                          <p className="text-xs text-gray-600">Format: {instruction.selectedFormat}</p>
                        )}
                        {instruction.selectedFormats && instruction.selectedFormats.length > 0 && (
                          <p className="text-xs text-gray-600">Formats: {instruction.selectedFormats.join(', ')}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <div className="text-center py-8">
              <p className="text-gray-500">Aucune instruction programmée dans ce Univers</p>
            </div>
          </Card>
        )}
      </div>
    );
  }

  if (showInstructionBuilder) {
    return (
      <div className="space-y-6">
        <div>
          <Button
            variant="secondary"
            onClick={handleCancelInstructionBuilder}
            className="flex items-center space-x-2 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {editingInstructionId ? 'Modifier l\'instruction' : 'Créer une instruction programmée'}
          </h2>
          <p className="text-gray-600">
            {editingInstructionId 
              ? 'Modifiez les informations de l\'instruction programmée' 
              : 'Créez une nouvelle instruction programmée pour votre Univers'}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-4">
            <Card title="Configuration de l'instruction">
              <div className="space-y-4">
                <Input
                  label="Titre de l'instruction *"
                  placeholder="Donnez un titre à votre instruction programmée..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />

                <Textarea
                  label="Description (optionnelle)"
                  placeholder="Ajoutez une description pour cette instruction programmée..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />

                <SimpleInstructionInput
                  value={question}
                  onChange={handleQuestionChange}
                  placeholder="Écrivez votre instruction pour ARCHA..."
                />

                <SimpleFormatSelector
                  selectedFormat={selectedFormat}
                  onFormatChange={setSelectedFormat}
                />

                {hasForms && (
                  <SimpleFilterSelector
                    filters={filters}
                    onFiltersChange={setFilters}
                    forms={universForms}
                    employees={employees}
                  />
                )}

                {!hasForms && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-yellow-900 mb-1">
                          Aucun formulaire disponible
                        </h3>
                        <p className="text-sm text-yellow-800">
                          Créez d'abord des formulaires pour pouvoir filtrer les données dans vos instructions.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            <Card title="Programmation">
              <ScheduledDateTimePicker
                scheduledAt={scheduledAt}
                frequency={frequency}
                onDateTimeChange={setScheduledAt}
                onFrequencyChange={setFrequency}
              />
            </Card>

            <Card title="Aperçu">
              <div className="space-y-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700 block mb-2">Titre:</span>
                  <p className="text-gray-600 bg-gray-50 p-3 rounded-lg border">
                    {title || 'Non défini'}
                  </p>
                </div>
                
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
            </Card>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex justify-end space-x-3">
          <Button variant="secondary" onClick={handleCancelInstructionBuilder}>
            Annuler
          </Button>
          <Button
            onClick={handleSaveInstruction}
            disabled={!isFormValid}
            className={isFormValid ? '' : 'opacity-50 cursor-not-allowed'}
          >
            {editingInstructionId ? 'Enregistrer les modifications' : 'Ajouter l\'instruction'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Instructions programmées
        </h2>
        <p className="text-gray-600">
          Créez et gérez les instructions programmées de votre Univers. 
          Les instructions peuvent être basées sur vos formulaires, tableaux de bord, listes et rapports.
        </p>
      </div>

      {/* Info about instructions */}
      <Card className="bg-blue-50 border-blue-200">
        <div className="flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-blue-900 mb-1">
              Instructions programmées
            </h3>
            <p className="text-sm text-blue-800">
              Les instructions programmées permettent d'automatiser des questions à archa. 
              Vous pouvez les baser sur vos formulaires (pour filtrer les données), vos tableaux de bord, listes et rapports.
            </p>
          </div>
        </div>
      </Card>

      {/* Add Instruction Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleAddInstruction}
          className="flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Ajouter une instruction programmée</span>
        </Button>
      </div>

      {/* Instructions List */}
      {instructions.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Aucune instruction programmée
            </h3>
            <p className="text-gray-600 mb-4">
              Commencez par créer votre première instruction programmée
            </p>
            <Button 
              onClick={handleAddInstruction} 
              className="flex items-center space-x-2 mx-auto"
            >
              <Plus className="h-4 w-4" />
              <span>Créer une instruction programmée</span>
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {instructions.map((instruction) => (
            <Card key={instruction.id} className="relative hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <Calendar className="h-5 w-5 text-blue-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                      {instruction.title}
                    </h3>
                    <p className="text-sm text-gray-500 truncate">
                      {instruction.frequency === 'once' ? 'Une seule fois' :
                       instruction.frequency === 'daily' ? 'Quotidien' :
                       instruction.frequency === 'weekly' ? 'Hebdomadaire' :
                       instruction.frequency === 'monthly' ? 'Mensuel' : instruction.frequency}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleEditInstruction(instruction.id)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                    title="Modifier"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteInstructionClick(instruction)}
                    className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {instruction.description && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                  {instruction.description}
                </p>
              )}

              <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                {instruction.question}
              </p>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="flex items-center space-x-2 text-xs text-gray-500">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <span>Configurée</span>
                </div>
                <div className="text-xs text-gray-500">
                  {(() => {
                    const date = normalizeDate(instruction.scheduledAt);
                    return date instanceof Date && !isNaN(date.getTime()) 
                      ? date.toLocaleDateString('fr-FR')
                      : 'Date invalide';
                  })()}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Summary */}
      {instructions.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <div className="flex items-center space-x-3">
            <CheckCircle className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm font-semibold text-blue-900">
                {instructions.length} instruction{instructions.length > 1 ? 's' : ''} programmée{instructions.length > 1 ? 's' : ''} configurée{instructions.length > 1 ? 's' : ''}
              </p>
              <p className="text-xs text-blue-700 mt-1">
                Les instructions sont prêtes à être utilisées
              </p>
            </div>
          </div>
        </Card>
      )}

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDeleteInstruction}
        title="Confirmer la suppression"
        message={`Êtes-vous sûr de vouloir supprimer l'instruction "${instructionToDelete?.title}" ? Cette action est irréversible.`}
        confirmText="Supprimer"
        cancelText="Annuler"
        variant="danger"
      />
    </div>
  );
};


import React, { useState, useEffect, useRef } from 'react';
import { FormField } from '../types';
import { Button } from './Button';
import { Card } from './Card';
import { FormulaHelpModal } from './FormulaHelpModal';
import { Calculator, Check, AlertCircle, Plus, HelpCircle } from 'lucide-react';

interface FormulaInputProps {
  value: string;
  onChange: (formula: string, fieldIds: string[]) => void;
  fields: FormField[];
  currentFieldId: string;
  className?: string;
}

interface FieldMatch {
  fieldId: string;
  fieldLabel: string;
  fieldType: string;
  isCalculable: boolean;
}

export const FormulaInput: React.FC<FormulaInputProps> = ({
  value,
  onChange,
  fields,
  currentFieldId,
  className = ''
}) => {
  const [userFormula, setUserFormula] = useState('');
  const [fieldMatches, setFieldMatches] = useState<FieldMatch[]>([]);
  const [showFieldSelector, setShowFieldSelector] = useState(false);
  // Removed unused selectedFieldId state
  // Keep for potential future caret sync, currently unused
  const [cursorPosition] = useState(0);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const [fieldOccurrences, setFieldOccurrences] = useState<Array<{ field: FormField; start: number; end: number }>>([]);
  const isEditorFocused = () => document.activeElement === editorRef.current;

  // Get available fields for calculation (exclude current field and non-calculable types)
  const availableFields = fields.filter(field => 
    field.id !== currentFieldId && 
    ['number', 'calculated'].includes(field.type)
  );

  // Parse user formula and find field matches
  useEffect(() => {
    if (!userFormula.trim()) {
      setFieldMatches([]);
      onChange('', []);
      setFieldOccurrences([]);
      return;
    }

    const matches: FieldMatch[] = [];
    const fieldIds: string[] = [];
    const occurrences: Array<{ field: FormField; start: number; end: number }> = [];

    // Find field references in the formula
    availableFields.forEach(field => {
      const fieldName = field.label.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!fieldName) return;
      const regex = new RegExp(`\\b${fieldName}\\b`, 'gi');
      let match: RegExpExecArray | null;
      let foundOnce = false;
      while ((match = regex.exec(userFormula)) !== null) {
        occurrences.push({ field, start: match.index, end: match.index + match[0].length });
        foundOnce = true;
      }
      if (foundOnce) {
        matches.push({
          fieldId: field.id,
          fieldLabel: field.label,
          fieldType: field.type,
          isCalculable: true
        });
        fieldIds.push(field.id);
      }
    });

    // Sort by appearance order
    occurrences.sort((a, b) => a.start - b.start);
    setFieldOccurrences(occurrences);

    setFieldMatches(matches);

    // Convert user formula to field IDs for storage
    let formulaWithIds = userFormula;
    matches.forEach(match => {
      const fieldName = match.fieldLabel.toLowerCase().replace(/[^a-z0-9]/g, '');
      const regex = new RegExp(`\\b${fieldName}\\b`, 'gi');
      formulaWithIds = formulaWithIds.replace(regex, match.fieldId);
    });

    onChange(formulaWithIds, fieldIds);
  }, [userFormula, availableFields, onChange, currentFieldId]);

  // Render the contenteditable from current userFormula and occurrences when not focused (initial/load)
  useEffect(() => {
    if (!editorRef.current) return;
    if (isEditorFocused()) return;
    const root = editorRef.current;
    // Rebuild DOM: text + badge spans
    root.innerHTML = '';
    let last = 0;
    fieldOccurrences.forEach((occ) => {
      if (occ.start > last) {
        root.appendChild(document.createTextNode(userFormula.slice(last, occ.start)));
      }
      const span = document.createElement('span');
      span.contentEditable = 'false';
      span.dataset.fieldId = occ.field.id;
      span.dataset.fieldLabel = occ.field.label;
      span.className = 'inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs align-middle';
      span.innerText = occ.field.label;
      root.appendChild(span);
      last = occ.end;
    });
    if (last < userFormula.length) {
      root.appendChild(document.createTextNode(userFormula.slice(last)));
    }
  }, [fieldOccurrences, userFormula]);

  // Initialize user formula from stored value
  useEffect(() => {
    if (value && !userFormula) {
      let displayFormula = value;
      
      // Convert field IDs back to field labels for display
      fields.forEach(field => {
        const fieldName = field.label.toLowerCase().replace(/[^a-z0-9]/g, '');
        const regex = new RegExp(`\\b${field.id}\\b`, 'g');
        displayFormula = displayFormula.replace(regex, fieldName);
      });
      
      setUserFormula(displayFormula);
    }
  }, [value, fields]); // Removed userFormula from dependencies to prevent infinite loop

  // Removed old input handlers (no longer used with contentEditable)

  // Build user-facing formula string from the contenteditable DOM (text + badge labels)
  const readEditorAsUserFormula = () => {
    const root = editorRef.current;
    if (!root) return '';
    const parts: string[] = [];
    root.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        parts.push((node as Text).data);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.dataset && el.dataset.fieldLabel) {
          parts.push(el.dataset.fieldLabel!.toLowerCase().replace(/[^a-z0-9]/g, ''));
        }
      }
    });
    return parts.join('');
  };

  const handleEditorInput = () => {
    const visual = readEditorAsUserFormula();
    setUserFormula(visual);
  };

  // No separate removal helper needed; handled directly in editor handlers

  // Removed old keydown handler for native input

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Backspace') return;
    const sel = window.getSelection();
    if (!sel || !editorRef.current || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!range.collapsed) return;
    const container = range.startContainer as Node;
    let node: Node | null = container;
    // Find previous sibling element from current caret position
    if (node.nodeType === Node.TEXT_NODE) {
      const textNode = node as Text;
      if (range.startOffset > 0) return; // normal backspace within text
      node = textNode.previousSibling;
    } else {
      node = (node as HTMLElement).childNodes[range.startOffset - 1] || (node as HTMLElement).previousSibling;
    }
    const prevEl = node as HTMLElement | null;
    if (prevEl && prevEl.nodeType === Node.ELEMENT_NODE && prevEl.dataset && prevEl.dataset.fieldId) {
      e.preventDefault();
      prevEl.remove();
      handleEditorInput();
    }
  };

  const insertField = (field: FormField) => {
    // Insert a non-editable badge span at caret position in contenteditable editor
    const sel = window.getSelection();
    if (!editorRef.current || !sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const badge = document.createElement('span');
    badge.contentEditable = 'false';
    badge.dataset.fieldId = field.id;
    badge.dataset.fieldLabel = field.label;
    badge.className = 'inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs align-middle';
    badge.innerText = field.label;
    range.insertNode(badge);
    range.setStartAfter(badge);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    setShowFieldSelector(false);
    handleEditorInput();
  };

  const insertOperator = (operator: string) => {
    const beforeCursor = userFormula.substring(0, cursorPosition);
    const afterCursor = userFormula.substring(cursorPosition);
    const newFormula = beforeCursor + operator + afterCursor;
    
    setUserFormula(newFormula);
    
    // Focus back to input and set cursor position
    setTimeout(() => {
      if (inputRef.current) {
        const newPosition = cursorPosition + operator.length;
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newPosition, newPosition);
      }
    }, 0);
  };

  // Removed unused insertConstant helper

  const validateFormula = (): { isValid: boolean; error?: string } => {
    if (!userFormula.trim()) {
      return { isValid: false, error: 'La formule ne peut pas être vide' };
    }

    // Check if all field references are valid (only match field names, not numbers)
    const fieldNames = availableFields.map(f => f.label.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const words = userFormula.toLowerCase().match(/\b[a-z][a-z0-9]*\b/g) || [];
    
    for (const word of words) {
      if (!fieldNames.includes(word) && !['sum', 'avg', 'max', 'min'].includes(word)) {
        return { isValid: false, error: `Champ "${word}" non trouvé` };
      }
    }

    return { isValid: true };
  };

  const validation = validateFormula();

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Formula Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Formule de calcul *
        </label>
        <div className="relative">
          <div
            ref={editorRef}
            contentEditable
            role="textbox"
            aria-label="Formule de calcul"
            onInput={handleEditorInput}
            onKeyDown={handleEditorKeyDown}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-base ${validation.isValid === false ? 'border-red-500' : ''} min-h-[40px]`}
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            <Calculator className="h-4 w-4 text-gray-400" />
          </div>
        </div>
        {/* badges moved inside input; no extra row below */}
        
        {/* Validation Message */}
        {validation.isValid === false && (
          <div className="mt-1 flex items-center text-xs text-red-600">
            <AlertCircle className="h-3 w-3 mr-1" />
            {validation.error}
          </div>
        )}
        
        {validation.isValid && userFormula && (
          <div className="mt-1 flex items-center text-xs text-green-600">
            <Check className="h-3 w-3 mr-1" />
            Formule valide
          </div>
        )}
      </div>

      {/* Field Matches */}
      {fieldMatches.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Champs détectés :</p>
          <div className="flex flex-wrap gap-2">
            {fieldMatches.map(match => (
              <div key={match.fieldId} className="flex items-center space-x-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                <span>{match.fieldLabel}</span>
                <span className="text-blue-600">({match.fieldType})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="space-y-3">
        {/* Field Selector */}
        <div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setShowFieldSelector(!showFieldSelector)}
            className="flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Ajouter un champ</span>
          </Button>
          
          {showFieldSelector && (
            <Card className="mt-2 p-3 max-h-40 overflow-y-auto">
              <div className="space-y-2">
                {availableFields.length === 0 ? (
                  <p className="text-sm text-gray-500">Aucun champ numérique disponible</p>
                ) : (
                  availableFields.map(field => (
                    <button
                      key={field.id}
                      type="button"
                      onClick={() => insertField(field)}
                      className="w-full text-left p-2 hover:bg-gray-50 rounded flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-gray-900 block truncate">{field.label}</span>
                        <span className="text-xs text-gray-500">({field.type})</span>
                      </div>
                      <span className="text-xs text-gray-400 font-mono hidden sm:block truncate">{field.id}</span>
                    </button>
                  ))
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Operator Buttons */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Opérateurs :</p>
          <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => insertOperator(' + ')}
              className="flex items-center justify-center"
            >
              <span>+</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => insertOperator(' - ')}
              className="flex items-center justify-center"
            >
              <span>-</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => insertOperator(' * ')}
              className="flex items-center justify-center"
            >
              <span>*</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => insertOperator(' / ')}
              className="flex items-center justify-center"
            >
              <span>/</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => insertOperator(' ( ')}
              className="flex items-center justify-center"
            >
              <span>(</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => insertOperator(' ) ')}
              className="flex items-center justify-center"
            >
              <span>)</span>
            </Button>
          </div>
        </div>

        {/* Function Buttons */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Fonctions mathématiques :</p>
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => insertOperator('SUM(')}
              className="flex items-center justify-center"
            >
              <span>SUM()</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => insertOperator('AVG(')}
              className="flex items-center justify-center"
            >
              <span>AVG()</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => insertOperator('MAX(')}
              className="flex items-center justify-center"
            >
              <span>MAX()</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => insertOperator('MIN(')}
              className="flex items-center justify-center"
            >
              <span>MIN()</span>
            </Button>
          </div>
        </div>


        {/* Help Text */}
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs text-yellow-800">
                <strong>💡 Conseils :</strong><br/>
                • Tapez le nom du champ (ex: "prix" pour "Prix unitaire")<br/>
                • Vous pouvez utiliser des nombres directement dans la formule (ex: prix * 1500)<br/>
                • La formule doit contenir au moins une opération (+, -, *, /)<br/>
                • <strong>Exemples :</strong> "prix * quantité", "montant + 100", "prix * 1.2"
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowHelpModal(true)}
              className="ml-3 flex items-center space-x-1"
            >
              <HelpCircle className="h-3 w-3" />
              <span className="text-xs">Aide</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Help Modal */}
      <FormulaHelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
      />
    </div>
  );
};

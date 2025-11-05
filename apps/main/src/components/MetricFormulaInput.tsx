import React, { useState, useEffect, useRef, useMemo } from 'react';
import { DashboardMetric } from '../types';
import { Button } from './Button';
import { Card } from './Card';
import { MetricFormulaParser } from '../utils/MetricFormulaParser';
import { Calculator, Check, AlertCircle, Plus, HelpCircle } from 'lucide-react';

interface MetricFormulaInputProps {
  value: string;
  onChange: (formula: string, metricIds: string[]) => void;
  metrics: DashboardMetric[];
  currentMetricId: string;
  className?: string;
}

interface MetricMatch {
  metricId: string;
  metricName: string;
  calculationType: string;
  isNumeric: boolean;
}

export const MetricFormulaInput: React.FC<MetricFormulaInputProps> = ({
  value,
  onChange,
  metrics,
  currentMetricId,
  className = ''
}) => {
  const [userFormula, setUserFormula] = useState('');
  const [metricMatches, setMetricMatches] = useState<MetricMatch[]>([]);
  const [showMetricSelector, setShowMetricSelector] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const [metricOccurrences, setMetricOccurrences] = useState<Array<{ metric: DashboardMetric; start: number; end: number }>>([]);
  const isInitialized = useRef(false);
  const onChangeRef = useRef(onChange);
  const lastProcessedFormula = useRef('');

  // Update the ref when onChange changes
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Get available numeric metrics for calculation (exclude current metric and non-numeric types)
  // Also exclude other computed metrics (they can't be used as dependencies)
  const availableMetrics = useMemo(() =>
    metrics.filter(metric =>
      metric.id !== currentMetricId &&
      MetricFormulaParser.isNumericMetric(metric) &&
      metric.sourceType !== 'computed' // Computed metrics can't depend on other computed metrics for now
    ), [metrics, currentMetricId]
  );

  // Parse user formula and find metric matches
  useEffect(() => {
    // Prevent unnecessary processing if formula hasn't changed
    if (lastProcessedFormula.current === userFormula) {
      return;
    }

    lastProcessedFormula.current = userFormula;

    if (!userFormula.trim()) {
      setMetricMatches([]);
      onChangeRef.current('', []);
      setMetricOccurrences([]);
      return;
    }

    const matches: MetricMatch[] = [];
    const metricIds: string[] = [];
    const occurrences: Array<{ metric: DashboardMetric; start: number; end: number }> = [];

    // Find metric references in the formula
    availableMetrics.forEach(metric => {
      const metricName = metric.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!metricName) return;
      const regex = new RegExp(`\\b${metricName}\\b`, 'gi');
      let match: RegExpExecArray | null;
      let foundOnce = false;
      while ((match = regex.exec(userFormula)) !== null) {
        occurrences.push({ metric, start: match.index, end: match.index + match[0].length });
        foundOnce = true;
      }
      if (foundOnce) {
        matches.push({
          metricId: metric.id,
          metricName: metric.name,
          calculationType: metric.calculationType,
          isNumeric: true
        });
        metricIds.push(metric.id);
      }
    });

    // Sort by appearance order
    occurrences.sort((a, b) => a.start - b.start);
    setMetricOccurrences(occurrences);

    setMetricMatches(matches);

    // Convert user formula to metric IDs for storage
    let formulaWithIds = userFormula;
    matches.forEach(match => {
      const metricName = match.metricName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const regex = new RegExp(`\\b${metricName}\\b`, 'gi');
      formulaWithIds = formulaWithIds.replace(regex, match.metricId);
    });

    onChangeRef.current(formulaWithIds, metricIds);
  }, [userFormula, availableMetrics]);

  // Render the contenteditable from current userFormula and occurrences when not focused (initial/load)
  useEffect(() => {
    if (!editorRef.current) return;
    if (document.activeElement === editorRef.current) return;
    const root = editorRef.current;
    // Rebuild DOM: text + badge spans
    root.innerHTML = '';
    let last = 0;
    metricOccurrences.forEach((occ) => {
      if (occ.start > last) {
        root.appendChild(document.createTextNode(userFormula.slice(last, occ.start)));
      }
      const span = document.createElement('span');
      span.contentEditable = 'false';
      span.dataset.metricId = occ.metric.id;
      span.dataset.metricName = occ.metric.name;
      span.className = 'inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs align-middle';
      span.innerText = occ.metric.name;
      root.appendChild(span);
      last = occ.end;
    });
    if (last < userFormula.length) {
      root.appendChild(document.createTextNode(userFormula.slice(last)));
    }
  }, [metricOccurrences, userFormula]);

  // Initialize user formula from stored value
  useEffect(() => {
    if (value && !isInitialized.current) {
      let displayFormula = value;

      // Check if value contains metric IDs (calculationFormula) or metric names (userFormula)
      // If it contains metric IDs, convert them to metric names
      const hasMetricIds = metrics.some(metric => {
        const regex = new RegExp(`\\b${metric.id}\\b`, 'g');
        return regex.test(value);
      });

      if (hasMetricIds) {
        // Convert metric IDs back to metric names for display
        metrics.forEach(metric => {
          const metricName = metric.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          const regex = new RegExp(`\\b${metric.id}\\b`, 'g');
          displayFormula = displayFormula.replace(regex, metricName);
        });
      }

      setUserFormula(displayFormula);
      isInitialized.current = true;
    }
  }, [value, metrics]);

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
        if (el.dataset && el.dataset.metricName) {
          parts.push(el.dataset.metricName!.toLowerCase().replace(/[^a-z0-9]/g, ''));
        }
      }
    });
    return parts.join('');
  };

  const handleEditorInput = () => {
    const visual = readEditorAsUserFormula();
    setUserFormula(visual);
  };

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
    if (prevEl && prevEl.nodeType === Node.ELEMENT_NODE && prevEl.dataset && prevEl.dataset.metricId) {
      e.preventDefault();
      prevEl.remove();
      handleEditorInput();
    }
  };

  const insertMetric = (metric: DashboardMetric) => {
    // Insert a non-editable badge span at caret position in contenteditable editor
    const sel = window.getSelection();
    if (!editorRef.current || !sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const badge = document.createElement('span');
    badge.contentEditable = 'false';
    badge.dataset.metricId = metric.id;
    badge.dataset.metricName = metric.name;
    badge.className = 'inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs align-middle';
    badge.innerText = metric.name;
    range.insertNode(badge);
    range.setStartAfter(badge);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    setShowMetricSelector(false);
    handleEditorInput();
  };

  const insertOperator = (operator: string) => {
    const sel = window.getSelection();
    if (!editorRef.current || !sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    const textNode = document.createTextNode(operator);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    // Update the formula by reading from the editor
    handleEditorInput();
  };

  const validateFormula = (): { isValid: boolean; error?: string } => {
    if (!userFormula.trim()) {
      return { isValid: false, error: 'La formule ne peut pas être vide' };
    }

    // Check if all metric references are valid (only match metric names, not numbers)
    const metricNames = availableMetrics.map(m => m.name.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const words = userFormula.toLowerCase().match(/\b[a-z][a-z0-9]*\b/g) || [];

    for (const word of words) {
      if (!metricNames.includes(word) && !['sum', 'avg', 'max', 'min'].includes(word)) {
        return { isValid: false, error: `Métrique "${word}" non trouvée` };
      }
    }

    // Validate using MetricFormulaParser
    const parseResult = MetricFormulaParser.parseUserFormula(userFormula, metrics, currentMetricId);
    if (!parseResult.isValid) {
      return { isValid: false, error: parseResult.error };
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

      {/* Metric Matches */}
      {metricMatches.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Métriques détectées :</p>
          <div className="flex flex-wrap gap-2">
            {metricMatches.map(match => (
              <div key={match.metricId} className="flex items-center space-x-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                <span>{match.metricName}</span>
                <span className="text-blue-600">({match.calculationType})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="space-y-3">
        {/* Metric Selector */}
        <div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setShowMetricSelector(!showMetricSelector)}
            className="flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Ajouter une métrique</span>
          </Button>

          {showMetricSelector && (
            <Card className="mt-2 p-3 max-h-40 overflow-y-auto">
              <div className="space-y-2">
                {availableMetrics.length === 0 ? (
                  <p className="text-sm text-gray-500">Aucune métrique numérique disponible</p>
                ) : (
                  availableMetrics.map(metric => (
                    <button
                      key={metric.id}
                      type="button"
                      onClick={() => insertMetric(metric)}
                      className="w-full text-left p-2 hover:bg-gray-50 rounded flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-gray-900 block truncate">{metric.name}</span>
                        <span className="text-xs text-gray-500">({metric.calculationType})</span>
                      </div>
                      <span className="text-xs text-gray-400 font-mono hidden sm:block truncate">{metric.id}</span>
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
                <strong>💡 Conseils :</strong><br />
                • Tapez le nom de la métrique (ex: "Ventes" pour "Nombre de ventes")<br />
                • Vous pouvez utiliser des nombres directement dans la formule (ex: Ventes * 1500)<br />
                • La formule doit contenir au moins une opération (+, -, *, /)<br />
                • <strong>Exemples :</strong> "Ventes + Frais", "Métrique A * 0.15", "Ventes / Visiteurs * 100"
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
    </div>
  );
};


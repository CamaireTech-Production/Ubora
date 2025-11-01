import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, Clock, Repeat, ChevronDown } from 'lucide-react';
import { Button } from '../Button';
import { getCameroonTime, createCameroonDateTime, formatCameroonTime, getCameroonTimezoneDisplay } from '../../utils/timezoneUtils';

interface ScheduledDateTimePickerProps {
  scheduledAt: Date;
  frequency: 'once' | 'daily' | 'weekly' | 'monthly';
  onDateTimeChange: (date: Date) => void;
  onFrequencyChange: (frequency: 'once' | 'daily' | 'weekly' | 'monthly') => void;
  disabled?: boolean;
}

export const ScheduledDateTimePicker: React.FC<ScheduledDateTimePickerProps> = ({
  scheduledAt,
  frequency,
  onDateTimeChange,
  onFrequencyChange,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localDate, setLocalDate] = useState(scheduledAt.toISOString().split('T')[0]);
  const [localTime, setLocalTime] = useState(scheduledAt.toTimeString().slice(0, 5));
  const buttonRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  // Mettre à jour les valeurs locales quand les props changent
  useEffect(() => {
    setLocalDate(scheduledAt.toISOString().split('T')[0]);
    setLocalTime(scheduledAt.toTimeString().slice(0, 5));
  }, [scheduledAt]);

  // Update dropdown position when it opens
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }

    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen && buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        // Check if click is not on dropdown items
        const target = event.target as HTMLElement;
        if (!target.closest('.frequency-dropdown-portal')) {
          setIsOpen(false);
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  const handleDateChange = (date: string) => {
    setLocalDate(date);
    const newDateTime = createCameroonDateTime(date, localTime);
    onDateTimeChange(newDateTime);
  };

  const handleTimeChange = (time: string) => {
    setLocalTime(time);
    const newDateTime = createCameroonDateTime(localDate, time);
    onDateTimeChange(newDateTime);
  };

  const getFrequencyLabel = (freq: string) => {
    switch (freq) {
      case 'once': return 'Une seule fois';
      case 'daily': return 'Quotidien';
      case 'weekly': return 'Hebdomadaire';
      case 'monthly': return 'Mensuel';
      default: return 'Une seule fois';
    }
  };

  const getNextExecutionPreview = () => {
    const now = new Date();
    const scheduled = new Date(`${localDate}T${localTime}`);
    
    if (frequency === 'once') {
      return scheduled <= now ? 'Date dans le passé' : `Exécution le ${scheduled.toLocaleDateString('fr-FR')} à ${scheduled.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    }

    // Calculer la prochaine exécution pour les récurrences
    let nextExecution = new Date(scheduled);
    
    if (nextExecution <= now) {
      switch (frequency) {
        case 'daily':
          nextExecution.setDate(nextExecution.getDate() + 1);
          break;
        case 'weekly':
          nextExecution.setDate(nextExecution.getDate() + 7);
          break;
        case 'monthly':
          nextExecution.setMonth(nextExecution.getMonth() + 1);
          break;
      }
    }

    return `Prochaine exécution: ${nextExecution.toLocaleDateString('fr-FR')} à ${nextExecution.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const isDateInPast = () => {
    const now = getCameroonTime();
    const scheduled = createCameroonDateTime(localDate, localTime);
    return scheduled <= now && frequency === 'once';
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
      {/* En-tête */}
      <div className="flex items-center justify-between text-gray-700">
        <div className="flex items-center space-x-2">
          <Calendar className="h-5 w-5 text-blue-600" />
          <span className="font-medium">Programmation de la question</span>
        </div>
        <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
          {getCameroonTimezoneDisplay()}
        </div>
      </div>

      {/* Sélection de la date et heure */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Date */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Date
          </label>
          <div className="relative">
            <input
              type="date"
              value={localDate}
              onChange={(e) => handleDateChange(e.target.value)}
              disabled={disabled}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
              } ${isDateInPast() ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
        </div>

        {/* Heure */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Heure
          </label>
          <div className="relative">
            <input
              type="time"
              value={localTime}
              onChange={(e) => handleTimeChange(e.target.value)}
              disabled={disabled}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
              } ${isDateInPast() ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
            />
          </div>
        </div>
      </div>

      {/* Sélection de la fréquence */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Fréquence
        </label>
        <div className="relative" ref={buttonRef}>
          <Button
            variant="secondary"
            onClick={() => setIsOpen(!isOpen)}
            disabled={disabled}
            className="w-full justify-between px-3 py-2 text-left"
          >
            <div className="flex items-center space-x-2">
              <Repeat className="h-4 w-4 text-gray-500" />
              <span>{getFrequencyLabel(frequency)}</span>
            </div>
            <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </Button>

          {/* Dropdown rendered via Portal to avoid overflow issues */}
          {isOpen && typeof window !== 'undefined' && createPortal(
            <>
              {/* Backdrop to close dropdown on outside click */}
              <div 
                className="fixed inset-0 z-[9998] bg-transparent"
                onClick={() => setIsOpen(false)}
              />
              <div 
                className="frequency-dropdown-portal fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-xl"
                style={{
                  top: `${dropdownPosition.top}px`,
                  left: `${dropdownPosition.left}px`,
                  width: `${dropdownPosition.width}px`,
                  maxHeight: '12rem',
                  overflowY: 'auto',
                  WebkitOverflowScrolling: 'touch'
                }}
              >
                {(['once', 'daily', 'weekly', 'monthly'] as const).map((freq) => (
                  <button
                    key={freq}
                    onClick={() => {
                      onFrequencyChange(freq);
                      setIsOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg transition-colors ${
                      frequency === freq ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                    }`}
                    disabled={disabled}
                  >
                    {getFrequencyLabel(freq)}
                  </button>
                ))}
              </div>
            </>,
            document.body
          )}
        </div>
      </div>

      {/* Aperçu de la prochaine exécution */}
      <div className="bg-gray-50 rounded-lg p-3">
        <div className="flex items-center space-x-2 text-sm">
          <Clock className="h-4 w-4 text-gray-500" />
          <span className={`${isDateInPast() ? 'text-red-600' : 'text-gray-700'}`}>
            {getNextExecutionPreview()}
          </span>
        </div>
        {isDateInPast() && (
          <p className="text-xs text-red-500 mt-1">
            ⚠️ La date sélectionnée est dans le passé. Veuillez choisir une date future.
          </p>
        )}
      </div>
    </div>
  );
};



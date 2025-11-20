import React from 'react';

export interface TimeRestrictions {
  startTime?: string;
  endTime?: string;
  allowedDays?: number[];
}

interface TimeRestrictionsEditorProps {
  timeRestrictions: TimeRestrictions;
  useTimeRange: boolean;
  onTimeRestrictionsChange: (restrictions: TimeRestrictions) => void;
  onTimeRangeToggle: (checked: boolean) => void;
}

export const TimeRestrictionsEditor: React.FC<TimeRestrictionsEditorProps> = ({
  timeRestrictions,
  useTimeRange,
  onTimeRestrictionsChange,
  onTimeRangeToggle
}) => {
  const updateTimeRestriction = (field: 'startTime' | 'endTime', value: string) => {
    onTimeRestrictionsChange({ ...timeRestrictions, [field]: value });
  };

  const toggleDaySelection = (day: number) => {
    const currentDays = timeRestrictions.allowedDays || [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day];
    onTimeRestrictionsChange({ ...timeRestrictions, allowedDays: newDays });
  };

  const handleTimeRangeToggle = (checked: boolean) => {
    onTimeRangeToggle(checked);
    // If switching to single-time mode, treat the existing single value as end time
    if (!checked) {
      const singleTime = timeRestrictions.endTime || timeRestrictions.startTime;
      onTimeRestrictionsChange({ ...timeRestrictions, startTime: undefined, endTime: singleTime });
    } else if (checked && !timeRestrictions.startTime && timeRestrictions.endTime) {
      // If switching to range mode and only an end time exists, initialize a start time
      onTimeRestrictionsChange({ ...timeRestrictions, startTime: '00:00' });
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-3">
        Restrictions horaires (optionnel)
      </label>
      <div className="space-y-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              {useTimeRange ? 'Heure de début' : 'Heure limite'}
            </label>
            <input
              type="time"
              value={useTimeRange ? (timeRestrictions.startTime || '') : (timeRestrictions.endTime || '')}
              onChange={(e) => useTimeRange
                ? updateTimeRestriction('startTime', e.target.value)
                : updateTimeRestriction('endTime', e.target.value)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {!useTimeRange && (
              <p className="text-xs text-gray-500 mt-1">
                Les employés peuvent remplir ce formulaire de 00:00 jusqu'à cette heure
              </p>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="useTimeRange"
              checked={useTimeRange}
              onChange={(e) => handleTimeRangeToggle(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="useTimeRange" className="text-sm text-gray-700">
              Définir une plage horaire
            </label>
          </div>
          
          {useTimeRange && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Heure de fin
              </label>
              <input
                type="time"
                value={timeRestrictions.endTime || ''}
                onChange={(e) => updateTimeRestriction('endTime', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Les employés peuvent remplir ce formulaire entre ces deux heures
              </p>
            </div>
          )}
        </div>
        
        {(timeRestrictions.startTime || timeRestrictions.endTime) && (
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">
              Jours autorisés
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 1, label: 'Lun' },
                { value: 2, label: 'Mar' },
                { value: 3, label: 'Mer' },
                { value: 4, label: 'Jeu' },
                { value: 5, label: 'Ven' },
                { value: 6, label: 'Sam' },
                { value: 0, label: 'Dim' }
              ].map(day => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDaySelection(day.value)}
                  className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                    timeRestrictions.allowedDays?.includes(day.value)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Laissez vide pour permettre tous les jours
            </p>
          </div>
        )}
      </div>
    </div>
  );
};



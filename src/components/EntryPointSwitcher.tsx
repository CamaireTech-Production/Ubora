import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getCurrentEntryPoint, switchEntryPoint, canSwitchEntryPoint } from '../utils/entryPointUtils';
import { Settings, Shield, User } from 'lucide-react';

/**
 * Component to switch between regular and admin entry points
 */
export const EntryPointSwitcher: React.FC = () => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const currentEntryPoint = getCurrentEntryPoint();
  const canSwitch = canSwitchEntryPoint();

  if (!canSwitch) {
    return null;
  }

  const handleSwitch = (newEntryPoint: 'regular' | 'admin') => {
    setIsOpen(false);
    switchEntryPoint(newEntryPoint);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
      >
        {currentEntryPoint === 'admin' ? (
          <>
            <Shield className="w-4 h-4 text-red-600" />
            <span className="text-red-600 font-medium">Admin</span>
          </>
        ) : (
          <>
            <User className="w-4 h-4 text-blue-600" />
            <span className="text-blue-600 font-medium">Utilisateur</span>
          </>
        )}
        <Settings className="w-3 h-3" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border z-50">
          <div className="p-2">
            <div className="text-xs text-gray-500 px-2 py-1 mb-1">Changer de mode</div>
            
            <button
              onClick={() => handleSwitch('regular')}
              className={`w-full flex items-center space-x-2 px-2 py-2 rounded text-sm transition-colors ${
                currentEntryPoint === 'regular' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Mode Utilisateur</span>
            </button>
            
            <button
              onClick={() => handleSwitch('admin')}
              className={`w-full flex items-center space-x-2 px-2 py-2 rounded text-sm transition-colors ${
                currentEntryPoint === 'admin' 
                  ? 'bg-red-100 text-red-700' 
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Mode Admin</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

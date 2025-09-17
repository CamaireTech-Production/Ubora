import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { Button } from './Button';
import { 
  User, 
  ChevronDown, 
  BarChart3, 
  Settings, 
  LogOut,
  Shield,
  Users
} from 'lucide-react';

interface ProfileDropdownProps {
  className?: string;
}

export const ProfileDropdown: React.FC<ProfileDropdownProps> = ({ className = '' }) => {
  const { user, logout } = useAuth();
  const { hasDirectorDashboardAccess, getUserAccessLevels, isDirector } = usePermissions();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fermer le dropdown quand on clique à l'extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleSwitchToDirectorDashboard = () => {
    navigate('/directeur/dashboard');
    setIsOpen(false);
  };

  const handleGoToEmployeeDashboard = () => {
    navigate('/employe/dashboard');
    setIsOpen(false);
  };

  const handleGoToPackages = () => {
    navigate('/packages');
    setIsOpen(false);
  };

  const accessLevels = getUserAccessLevels();
  const hasDirectorAccess = hasDirectorDashboardAccess();

  if (!user) return null;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Bouton de profil */}
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 text-left"
      >
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <User className="h-4 w-4 text-blue-600" />
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-sm font-medium text-gray-900 truncate max-w-[120px] lg:max-w-none">
              {user.name}
            </p>
            <p className="text-xs text-gray-500 truncate max-w-[120px] lg:max-w-none">
              {user.email}
            </p>
          </div>
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </Button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="py-2">
            {/* En-tête du profil */}
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user.name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {user.email}
                  </p>
                  <div className="flex items-center space-x-1 mt-1">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      user.role === 'directeur' 
                        ? 'bg-purple-100 text-purple-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {user.role === 'directeur' ? 'Directeur' : 'Employé'}
                    </span>
                    {hasDirectorAccess && user.role === 'employe' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        <Shield className="h-3 w-3 mr-1" />
                        Accès Directeur
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Niveaux d'accès pour les employés */}
            {user.role === 'employe' && accessLevels.length > 0 && (
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Niveaux d'accès
                </p>
                <div className="space-y-1">
                  {accessLevels.map((level) => (
                    <div key={level.id} className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="text-xs text-gray-600">{level.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions de navigation */}
            <div className="py-2">
              {/* Dashboard employé */}
              {user.role === 'employe' && (
                <button
                  onClick={handleGoToEmployeeDashboard}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                >
                  <BarChart3 className="h-4 w-4 text-gray-400" />
                  <span>Mon Dashboard</span>
                </button>
              )}

              {/* Accès au dashboard directeur */}
              {hasDirectorAccess && (
                <button
                  onClick={handleSwitchToDirectorDashboard}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                >
                  <Shield className="h-4 w-4 text-blue-500" />
                  <span>Dashboard Directeur</span>
                </button>
              )}

              {/* Dashboard directeur (pour les directeurs) */}
              {user.role === 'directeur' && (
                <button
                  onClick={handleSwitchToDirectorDashboard}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                >
                  <BarChart3 className="h-4 w-4 text-gray-400" />
                  <span>Dashboard Directeur</span>
                </button>
              )}

              {/* Gestion des employés (pour les directeurs) */}
              {user.role === 'directeur' && (
                <button
                  onClick={() => {
                    navigate('/directeur/employees');
                    setIsOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                >
                  <Users className="h-4 w-4 text-gray-400" />
                  <span>Gérer les Employés</span>
                </button>
              )}

              {/* Packages (pour les directeurs) */}
              {user.role === 'directeur' && (
                <button
                  onClick={handleGoToPackages}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                >
                  <Settings className="h-4 w-4 text-gray-400" />
                  <span>Packages</span>
                </button>
              )}
            </div>

            {/* Séparateur */}
            <div className="border-t border-gray-100"></div>

            {/* Déconnexion */}
            <div className="py-2">
              <button
                onClick={handleLogout}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
              >
                <LogOut className="h-4 w-4" />
                <span>Déconnexion</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

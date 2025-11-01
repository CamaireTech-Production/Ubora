import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { usePermissions } from '@ubora/shared/hooks/usePermissions';
import { useUnreadNotifications } from '../hooks/useUnreadNotifications';
import { Button } from './Button';
import { LogoutConfirmationModal } from './LogoutConfirmationModal';
import { 
  User, 
  ChevronDown, 
  BarChart3, 
  Settings, 
  LogOut,
  Shield,
  Users,
  MessageSquare,
  Bell,
  Package
} from 'lucide-react';

interface ProfileDropdownProps {
  className?: string;
}

export const ProfileDropdown: React.FC<ProfileDropdownProps> = ({ className = '' }) => {
  const { user, logout } = useAuth();
  const { hasDirectorDashboardAccess } = usePermissions();
  const unreadCount = useUnreadNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
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
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/login');
    } finally {
      setIsLoggingOut(false);
      setShowLogoutModal(false);
    }
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
    navigate('/packages/manage');
    setIsOpen(false);
  };

  const handleGoToNotifications = () => {
    navigate('/notifications');
    setIsOpen(false);
  };

  const handleGoToSettings = () => {
    navigate('/directeur/settings');
    setIsOpen(false);
  };

  const hasDirectorAccess = hasDirectorDashboardAccess();

  // Determine which menu item is currently active
  const isActive = (path: string) => {
    if (path === '/directeur/dashboard') {
      // Also highlight for dashboard detail pages
      return location.pathname === path || location.pathname.startsWith('/directeur/dashboards/');
    }
    if (path === '/employe/dashboard') {
      // Also highlight for response detail pages (employee functionality)
      return location.pathname === path || location.pathname.startsWith('/responses/');
    }
    return location.pathname === path;
  };
  
  // Helper function to get active styling
  const getActiveStyles = (path: string) => {
    const active = isActive(path);
    return active 
      ? "relative bg-blue-50 text-blue-700" 
      : "text-gray-700 hover:bg-gray-50";
  };

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


            {/* Actions de navigation */}
            <div className="py-2">
              {/* Dashboard employé */}
              {user.role === 'employe' && (
                <button
                  onClick={handleGoToEmployeeDashboard}
                  className={`w-full px-4 py-2 text-left text-sm flex items-center space-x-2 ${getActiveStyles('/employe/dashboard')}`}
                >
                  {isActive('/employe/dashboard') && (
                    <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-6 rounded-r-full" style={{ backgroundColor: '#2A6AEE' }}></div>
                  )}
                  <BarChart3 className="h-4 w-4 text-gray-400" />
                  <span>Mon Dashboard</span>
                </button>
              )}

              {/* Dashboard directeur (pour les directeurs et employés avec accès) */}
              {(user.role === 'directeur' || hasDirectorAccess) && (
                <button
                  onClick={handleSwitchToDirectorDashboard}
                  className={`w-full px-4 py-2 text-left text-sm flex items-center space-x-2 ${getActiveStyles('/directeur/dashboard')}`}
                >
                  {isActive('/directeur/dashboard') && (
                    <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-6 rounded-r-full" style={{ backgroundColor: '#2A6AEE' }}></div>
                  )}
                  <BarChart3 className="h-4 w-4 text-gray-400" />
                  <span>Dashboard Directeur</span>
                </button>
              )}

              {/* Chat Directeur (pour les directeurs seulement) */}
              {user.role === 'directeur' && (
                <button
                  onClick={() => {
                    navigate('/directeur/chat');
                    setIsOpen(false);
                  }}
                  className={`w-full px-4 py-2 text-left text-sm flex items-center space-x-2 ${getActiveStyles('/directeur/chat')}`}
                >
                  {isActive('/directeur/chat') && (
                    <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-6 rounded-r-full" style={{ backgroundColor: '#2A6AEE' }}></div>
                  )}
                  <MessageSquare className="h-4 w-4 text-gray-400" />
                  <span>Chat Directeur</span>
                </button>
              )}

              {/* Gestion des employés (pour les directeurs) */}
              {user.role === 'directeur' && (
                <button
                  onClick={() => {
                    navigate('/directeur/employees');
                    setIsOpen(false);
                  }}
                  className={`w-full px-4 py-2 text-left text-sm flex items-center space-x-2 ${getActiveStyles('/directeur/employees')}`}
                >
                  {isActive('/directeur/employees') && (
                    <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-6 rounded-r-full" style={{ backgroundColor: '#2A6AEE' }}></div>
                  )}
                  <Users className="h-4 w-4 text-gray-400" />
                  <span>Gérer les Employés</span>
                </button>
              )}

              {/* Packages (pour les directeurs) */}
              {user.role === 'directeur' && (
                <button
                  onClick={handleGoToPackages}
                  className={`w-full px-4 py-2 text-left text-sm flex items-center space-x-2 ${getActiveStyles('/packages/manage')}`}
                >
                  {isActive('/packages/manage') && (
                    <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-6 rounded-r-full" style={{ backgroundColor: '#2A6AEE' }}></div>
                  )}
                  <Package className="h-4 w-4 text-gray-400" />
                  <span>Packages</span>
                </button>
              )}

              {/* Settings (pour les directeurs) */}
              {user.role === 'directeur' && (
                <button
                  onClick={handleGoToSettings}
                  className={`w-full px-4 py-2 text-left text-sm flex items-center space-x-2 ${getActiveStyles('/directeur/settings')}`}
                >
                  {isActive('/directeur/settings') && (
                    <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-6 rounded-r-full" style={{ backgroundColor: '#2A6AEE' }}></div>
                  )}
                  <Settings className="h-4 w-4 text-gray-400" />
                  <span>Paramètres</span>
                </button>
              )}

              {/* Notifications Settings */}
              <button
                onClick={handleGoToNotifications}
                className={`w-full px-4 py-2 text-left text-sm flex items-center space-x-2 relative ${getActiveStyles('/notifications')}`}
              >
                {isActive('/notifications') && (
                  <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-6 rounded-r-full" style={{ backgroundColor: '#2A6AEE' }}></div>
                )}
                <Bell className="h-4 w-4 text-gray-400" />
                <span>Notifications</span>
                {unreadCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs font-medium px-2 py-0.5 rounded-full min-w-[20px] text-center">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

            </div>

            {/* Séparateur */}
            <div className="border-t border-gray-100"></div>

            {/* Déconnexion */}
            <div className="py-2">
              <button
                onClick={() => setShowLogoutModal(true)}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
              >
                <LogOut className="h-4 w-4" />
                <span>Déconnexion</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      <LogoutConfirmationModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
        isLoading={isLoggingOut}
      />
    </div>
  );
};

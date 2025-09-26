import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './Button';
import { Footer } from './Footer';
import { UserPackageInfo } from './UserPackageInfo';
import { ProfileDropdown } from './ProfileDropdown';
import { LogOut, BarChart3, MessageSquare, Menu, X } from 'lucide-react';
import { ShareCollaboratorButton } from './ShareCollaboratorButton';

interface LayoutProps {
  children: React.ReactNode;
  title: string;
}

export const Layout: React.FC<LayoutProps> = ({ children, title }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  
  const isDirecteur = user?.role === 'directeur';
  const isDashboard = location.pathname === '/directeur/dashboard';
  const isChat = location.pathname === '/directeur/chat';

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  // Close menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMobileMenuOpen]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div 
              className="relative flex items-center space-x-2 sm:space-x-3 cursor-pointer hover:opacity-80 transition-opacity group"
              onClick={() => {
                if (isDirecteur) {
                  navigate('/directeur/chat');
                }
              }}
            >
              <img src="/fav-icons/favicon-96x96.png" alt="Ubora Logo" className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate max-w-[200px] sm:max-w-none">{title}</h1>
                <p className="text-xs sm:text-sm text-gray-500 capitalize">{user?.role}</p>
              </div>
              
              {/* Tooltip pour directeurs */}
              {isDirecteur && (
                <div className="absolute -bottom-14 left-0 bg-gray-900 text-white text-xs px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                  Retour au chat Archa
                  <div className="absolute -top-1 left-6 w-2 h-2 bg-gray-900 rotate-45"></div>
                </div>
              )}
            </div>
            
            {/* Navigation desktop pour directeur */}
            {isDirecteur && (
              <div className="hidden md:flex items-center space-x-2">
                <ShareCollaboratorButton 
                  variant="secondary"
                  size="sm"
                />
                
                <Button
                  variant={isChat ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => window.location.href = '/directeur/chat'}
                  className="flex items-center space-x-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>ARCHA</span>
                </Button>
                
                <Button
                  variant={isDashboard ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => window.location.href = '/directeur/dashboard'}
                  className="flex items-center space-x-2"
                >
                  <BarChart3 className="h-4 w-4" />
                  <span>Dashboard</span>
                </Button>
              </div>
            )}
            
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Package info pour les directeurs */}
              {isDirecteur && (
                <div className="hidden md:block">
                  <UserPackageInfo showTokens={true} clickable={true} />
                </div>
              )}
              
              {/* Bouton menu mobile pour directeur */}
              {isDirecteur && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={toggleMobileMenu}
                  className="md:hidden flex items-center space-x-1"
                >
                  {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                </Button>
              )}
              
              {/* Profile Dropdown */}
              <ProfileDropdown />
            </div>
          </div>
          
          {/* Menu mobile pour directeur - Floating dropdown */}
          {isDirecteur && isMobileMenuOpen && (
            <div ref={menuRef} className="md:hidden absolute top-full right-4 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
              <div className="mx-2 mb-1">
                <ShareCollaboratorButton 
                  variant="secondary"
                  size="sm"
                  className="w-full flex items-center justify-start space-x-2"
                />
              </div>
              
              <Button
                variant={isChat ? "primary" : "secondary"}
                size="sm"
                onClick={() => {
                  window.location.href = '/directeur/chat';
                  closeMobileMenu();
                }}
                className="w-full flex items-center justify-start space-x-2 mx-2 mb-1"
              >
                <MessageSquare className="h-4 w-4" />
                <span>Chat Archa</span>
              </Button>
              
              <Button
                variant={isDashboard ? "primary" : "secondary"}
                size="sm"
                onClick={() => {
                  window.location.href = '/directeur/dashboard';
                  closeMobileMenu();
                }}
                className="w-full flex items-center justify-start space-x-2 mx-2 mb-1"
              >
                <BarChart3 className="h-4 w-4" />
                <span>Dashboard</span>
              </Button>
              
              {/* Profil utilisateur mobile */}
              <div 
                className={`sm:hidden pt-2 border-t border-gray-200 mx-2 text-center ${isDirecteur ? 'cursor-pointer hover:bg-gray-50 rounded-lg p-2 transition-colors' : ''}`}
                onClick={isDirecteur ? () => {
                  navigate('/packages');
                  closeMobileMenu();
                } : undefined}
                title={isDirecteur ? 'Cliquer pour voir les packages' : undefined}
              >
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
                
                {/* Package info dans le menu mobile */}
                {isDirecteur && (
                  <div className="mt-2 flex justify-center">
                    <UserPackageInfo showTokens={true} clickable={false} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {children}
      </main>
      
      <Footer />
    </div>
  );
};
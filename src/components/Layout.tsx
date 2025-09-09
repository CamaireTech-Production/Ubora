import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './Button';
import { LogOut, Building2, BarChart3, MessageSquare } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  title: string;
}

export const Layout: React.FC<LayoutProps> = ({ children, title }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  
  const isDirecteur = user?.role === 'directeur';
  const isDashboard = location.pathname === '/directeur/dashboard';
  const isChat = location.pathname === '/directeur/chat';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <Building2 className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">{title}</h1>
                <p className="text-sm text-gray-500 capitalize">{user?.role}</p>
              </div>
            </div>
            
            {/* Navigation pour directeur */}
            {isDirecteur && (
              <div className="flex items-center space-x-2">
                <Button
                  variant={isChat ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => window.location.href = '/directeur/chat'}
                  className="flex items-center space-x-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>Chat IA</span>
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
            
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={logout}
                className="flex items-center space-x-2"
              >
                <LogOut className="h-4 w-4" />
                <span>Déconnexion</span>
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
};
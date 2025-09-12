import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/AuthContext';
import { AppProvider } from './contexts/AppContext';
import { ConversationProvider } from './contexts/ConversationContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DirecteurDashboard } from './pages/DirecteurDashboard';
import { DirecteurChat } from './pages/DirecteurChat';
import { EmployeDashboard } from './pages/EmployeDashboard';
import { UnauthorizedPage } from './pages/UnauthorizedPage';
import { PendingApprovalPage } from './pages/PendingApprovalPage';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
// import { PWAUpdateNotification } from './components/PWAUpdateNotification';

function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <ConversationProvider>
          <Router>
          <Routes>
            {/* Page de connexion */}
            <Route path="/login" element={<LoginPage />} />
            
            {/* Page non autorisée */}
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
            
            {/* Page d'attente d'approbation */}
            <Route path="/pending-approval" element={<PendingApprovalPage />} />
            
            {/* Dashboard directeur */}
            <Route 
              path="/directeur/dashboard" 
              element={
                <ProtectedRoute allowedRoles={['directeur']}>
                  <DirecteurDashboard />
                </ProtectedRoute>
              } 
            />
            
            {/* Chat IA directeur */}
            <Route 
              path="/directeur/chat" 
              element={
                <ProtectedRoute allowedRoles={['directeur']}>
                  <DirecteurChat />
                </ProtectedRoute>
              } 
            />
            
            {/* Dashboard employé */}
            <Route 
              path="/employe/dashboard" 
              element={
                <ProtectedRoute allowedRoles={['employe']}>
                  <EmployeDashboard />
                </ProtectedRoute>
              } 
            />
            
            {/* Redirections par défaut selon le rôle */}
            <Route path="/" element={<RoleBasedRedirect />} />
            
            {/* Page 404 */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
          </Router>
          
          {/* PWA Components */}
          <PWAInstallPrompt />
          {/* <PWAUpdateNotification /> */}
        </ConversationProvider>
      </AppProvider>
    </AuthProvider>
  );
}

// Composant pour rediriger selon le rôle
const RoleBasedRedirect: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Directeur → Dashboard en priorité
  if (user.role === 'directeur') {
    return <Navigate to="/directeur/dashboard" replace />;
  }

  // Employé → Vérifier l'approbation
  if (user.role === 'employe') {
    if (user.isApproved === false) {
      return <Navigate to="/pending-approval" replace />;
    }
    return <Navigate to="/employe/dashboard" replace />;
  }

  // Fallback vers login si rôle inconnu
  return <Navigate to="/login" replace />;
};

export default App;
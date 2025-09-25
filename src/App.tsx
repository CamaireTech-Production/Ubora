import React, { useEffect } from 'react';
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
import { DashboardDetailPage } from './pages/DashboardDetailPage';
import { ResponseDetailPage } from './pages/ResponseDetailPage';
import { PackageManagementPage } from './pages/PackageManagementPage';
import { PackageSelectionPage } from './pages/PackageSelectionPage';
import { DirectorSettingsPage } from './pages/DirectorSettingsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { AdminLoginPage } from './admin/pages/AdminLoginPage';
import { AdminPage } from './admin';
import { UserDetailPage } from './admin/pages/UserDetailPage';
import { HybridPWAManager } from './components/HybridPWAManager';
import { EmployeeManagement } from './components/EmployeeManagement';
import { Layout } from './components/Layout';
import { initializePWAConfig } from './utils/pwaConfig';
// import { PWAUpdateNotification } from './components/PWAUpdateNotification';

function App() {
  // Initialize PWA configuration on app load
  useEffect(() => {
    initializePWAConfig();
  }, []);

  return (
    <AuthProvider>
      <AppProvider>
        <ConversationProvider>
          <Router>
          <Routes>
            {/* Page de connexion */}
            <Route path="/login" element={<LoginPage />} />
            
            {/* Admin Login */}
            <Route path="/admin/login" element={<AdminLoginPage />} />
            
            {/* Admin Dashboard */}
            <Route 
              path="/admin/dashboard" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminPage />
                </ProtectedRoute>
              } 
            />
            
            {/* Admin User Detail */}
            <Route 
              path="/admin/users/:userId" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <UserDetailPage />
                </ProtectedRoute>
              } 
            />
            
            {/* Page non autorisée */}
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
            
            {/* Page d'attente d'approbation */}
            <Route path="/pending-approval" element={<PendingApprovalPage />} />
            
            {/* Dashboard directeur */}
            <Route 
              path="/directeur/dashboard" 
              element={
                <ProtectedRoute 
                  allowedRoles={['directeur', 'employe']} 
                  requireDirectorDashboardAccess={true}
                >
                  <DirecteurDashboard />
                </ProtectedRoute>
              } 
            />
            
            {/* ARCHA - Chat directeur */}
            <Route 
              path="/directeur/chat" 
              element={
                <ProtectedRoute 
                  allowedRoles={['directeur', 'employe']} 
                  requireDirectorDashboardAccess={true}
                >
                  <DirecteurChat />
                </ProtectedRoute>
              } 
            />
            
            
            {/* Détail d'un tableau de bord */}
            <Route 
              path="/directeur/dashboards/:dashboardId" 
              element={
                <ProtectedRoute 
                  allowedRoles={['directeur', 'employe']} 
                  requireDirectorDashboardAccess={true}
                >
                  <DashboardDetailPage />
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
            
            {/* Page de détails des réponses */}
            <Route 
              path="/responses/:formId" 
              element={
                <ProtectedRoute allowedRoles={['employe', 'directeur']}>
                  <ResponseDetailPage />
                </ProtectedRoute>
              } 
            />
            
            {/* Page de sélection des packages pour nouveaux directeurs */}
            <Route 
              path="/packages" 
              element={
                <ProtectedRoute allowedRoles={['directeur']}>
                  <PackageSelectionPage />
                </ProtectedRoute>
              } 
            />
            
            {/* Page de gestion des packages */}
            <Route 
              path="/packages/manage" 
              element={
                <ProtectedRoute allowedRoles={['directeur']}>
                  <PackageManagementPage />
                </ProtectedRoute>
              } 
            />
            
            {/* Page des paramètres directeur */}
            <Route 
              path="/directeur/settings" 
              element={
                <ProtectedRoute allowedRoles={['directeur']}>
                  <DirectorSettingsPage />
                </ProtectedRoute>
              } 
            />
            
            {/* Notifications Settings */}
            <Route 
              path="/notifications" 
              element={
                <ProtectedRoute allowedRoles={['directeur', 'employe']}>
                  <NotificationsPage />
                </ProtectedRoute>
              } 
            />
            
            {/* Gestion des employés */}
            <Route 
              path="/directeur/employees" 
              element={
                <ProtectedRoute allowedRoles={['directeur']}>
                  <Layout title="Gestion des Employés">
                    <EmployeeManagement />
                  </Layout>
                </ProtectedRoute>
              } 
            />
            
            {/* Redirections par défaut selon le rôle */}
            <Route path="/" element={<RoleBasedRedirect />} />
            
            {/* Page 404 */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
          
          {/* PWA Components - Inside Router context */}
          <HybridPWAManager />
          {/* <PWAUpdateNotification /> */}
          </Router>
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

  // Admin → Redirect to admin dashboard
  if (user.role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  // Directeur → Vérifier si un package doit être sélectionné
  if (user.role === 'directeur') {
    if (user.needsPackageSelection) {
      return <Navigate to="/packages" replace />;
    }
    return <Navigate to="/directeur/dashboard" replace />;
  }

  // Employé → Vérifier l'approbation
  if (user.role === 'employe') {
    if (user.isApproved === false && !user.hasDirectorDashboardAccess) {
      return <Navigate to="/pending-approval" replace />;
    }
    return <Navigate to="/employe/dashboard" replace />;
  }

  // Fallback vers login si rôle inconnu
  return <Navigate to="/login" replace />;
};

export default App;
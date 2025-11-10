import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@ubora/shared/contexts/AuthContext';
import { AIResponseProvider } from '@ubora/shared/contexts/AIResponseContext';
import { AppProvider } from '@ubora/shared/contexts/AppContext';
import { ConversationProvider } from '@ubora/shared/contexts/ConversationContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginPage } from './pages/LoginPage';
import { PasswordResetPage } from './pages/PasswordResetPage';
import { ProfileCompletionPage } from './pages/ProfileCompletionPage';
import { DirecteurDashboard } from './pages/DirecteurDashboard';
import DirecteurChat from './pages/DirecteurChat';
import { EmployeDashboard } from './pages/EmployeDashboard';
import { UnauthorizedPage } from './pages/UnauthorizedPage';
import { PendingApprovalPage } from './pages/PendingApprovalPage';
import { DashboardDetailPage } from './pages/DashboardDetailPage';
import { ResponseDetailPage } from './pages/ResponseDetailPage';
import { PackageManagementPage } from './pages/PackageManagementPage';
import { PackageSelectionPage } from './pages/PackageSelectionPage';
import { DirectorSettingsPage } from './pages/DirectorSettingsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ScheduledQuestionsPage } from './pages/ScheduledQuestionsPage';
import { ScheduledQuestionFormPage } from './pages/ScheduledQuestionFormPage';
import { ScheduledQuestionChatPage } from './pages/ScheduledQuestionChatPage';
import { ProgrammedInstructionsRoute } from './components/ProgrammedInstructionsRoute';
import { UniversPage } from './pages/UniversPage';
import { UniversCreatePage } from './pages/UniversCreatePage';
import { UniversCreateFromTemplatePage } from './pages/UniversCreateFromTemplatePage';
import { UniversEditPage } from './pages/UniversEditPage';
import { UniversViewPage } from './pages/UniversViewPage';
import { UniversMarketplacePage } from './pages/UniversMarketplacePage';
import { ListsPage } from './pages/ListsPage';
import { ListEditorPage } from './pages/ListEditorPage';
import { ReportsPage } from './pages/ReportsPage';
import PushTestPage from './pages/PushTestPage';
import { HybridPWAManager } from './components/HybridPWAManager';
import { EmployeeManagement } from './components/EmployeeManagement';
import { Layout } from './components/Layout';
import { PWAUpdateNotification } from './components/PWAUpdateNotification';
import { usePageTracking } from '@ubora/shared/hooks/usePageTracking';

// Component to handle service worker messages
const ServiceWorkerMessageHandler: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'NOTIFICATION_CLICK') {
        const { url, notificationType, highlightData, data } = event.data;
        
        console.log('🔔 [App] Handling notification click:', {
          url,
          notificationType,
          highlightData,
          data
        });

        // Navigate to the specified URL
        if (url && url !== window.location.pathname) {
          navigate(url);
        }

        // Handle highlighting based on notification type
        if (highlightData) {
          handleHighlighting(notificationType, highlightData);
        }
      }
    };

    // Listen for messages from service worker
    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);

    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, [navigate]);

  return null;
};

/**
 * Handle highlighting for different notification types
 */
const handleHighlighting = (notificationType: string, highlightData: any) => {
  console.log('🔔 [App] Handling highlighting:', { notificationType, highlightData });

  switch (notificationType) {
    case 'form_assignment':
      handleFormAssignmentHighlighting(highlightData);
      break;
    case 'form_reminder':
      handleFormReminderHighlighting(highlightData);
      break;
    case 'metric_reminder':
      handleMetricReminderHighlighting(highlightData);
      break;
    case 'programmed_instruction':
      handleProgrammedInstructionHighlighting(highlightData);
      break;
    default:
      console.log('🔔 [App] Unknown notification type:', notificationType);
  }
};

const handleFormAssignmentHighlighting = (highlightData: any) => {
  // Implementation for form assignment highlighting
  console.log('🔔 [App] Form assignment highlighting:', highlightData);
};

const handleFormReminderHighlighting = (highlightData: any) => {
  // Implementation for form reminder highlighting
  console.log('🔔 [App] Form reminder highlighting:', highlightData);
};

const handleMetricReminderHighlighting = (highlightData: any) => {
  // Implementation for metric reminder highlighting
  console.log('🔔 [App] Metric reminder highlighting:', highlightData);
};

const handleProgrammedInstructionHighlighting = (highlightData: any) => {
  // Implementation for programmed instruction highlighting
  console.log('🔔 [App] Programmed instruction highlighting:', highlightData);
};

// Component for authenticated services
const AuthenticatedServices: React.FC = () => {
  usePageTracking();
  return null;
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AIResponseProvider>
          <AppProvider>
            <ConversationProvider>
              <Router>
              <ServiceWorkerMessageHandler />
              <AuthenticatedServices />
              <PWAUpdateNotification />
              <Routes>
                {/* Page de connexion */}
                <Route path="/login" element={<LoginPage />} />
                
                {/* Password Reset */}
                <Route path="/reset-password" element={<PasswordResetPage />} />
                
                {/* Profile Completion */}
                <Route path="/complete-profile" element={<ProfileCompletionPage />} />
                
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
                
                {/* Questions Programmées - Accès Directeur Uniquement */}
                <Route 
                  path="/directeur/scheduled-questions" 
                  element={
                    <ProtectedRoute 
                      allowedRoles={['directeur', 'employe']} 
                      requireDirectorDashboardAccess={true}
                    >
                      <ProgrammedInstructionsRoute>
                        <ScheduledQuestionsPage />
                      </ProgrammedInstructionsRoute>
                    </ProtectedRoute>
                  } 
                />
                
                {/* Création d'une nouvelle question programmée */}
                <Route 
                  path="/directeur/scheduled-questions/new" 
                  element={
                    <ProtectedRoute 
                      allowedRoles={['directeur', 'employe']} 
                      requireDirectorDashboardAccess={true}
                    >
                      <ProgrammedInstructionsRoute>
                        <ScheduledQuestionFormPage />
                      </ProgrammedInstructionsRoute>
                    </ProtectedRoute>
                  } 
                />
                
                {/* Édition d'une question programmée */}
                <Route 
                  path="/directeur/scheduled-questions/:id/edit" 
                  element={
                    <ProtectedRoute 
                      allowedRoles={['directeur', 'employe']} 
                      requireDirectorDashboardAccess={true}
                    >
                      <ProgrammedInstructionsRoute>
                        <ScheduledQuestionFormPage />
                      </ProgrammedInstructionsRoute>
                    </ProtectedRoute>
                  } 
                />
                
                {/* Chat des réponses d'une question programmée */}
                <Route 
                  path="/directeur/scheduled-questions/:id/chat" 
                  element={
                    <ProtectedRoute 
                      allowedRoles={['directeur', 'employe']} 
                      requireDirectorDashboardAccess={true}
                    >
                      <ProgrammedInstructionsRoute>
                        <ScheduledQuestionChatPage />
                      </ProgrammedInstructionsRoute>
                    </ProtectedRoute>
                  } 
                />
                
                {/* Univers (Univer Ubora) - Main page */}
                <Route 
                  path="/univers" 
                  element={
                    <ProtectedRoute 
                      allowedRoles={['directeur', 'employe']} 
                      requireDirectorDashboardAccess={true}
                    >
                      <UniversPage />
                    </ProtectedRoute>
                  } 
                />
                
                {/* Univers - Marketplace */}
                <Route 
                  path="/univers/marketplace" 
                  element={
                    <ProtectedRoute 
                      allowedRoles={['directeur', 'employe']} 
                      requireDirectorDashboardAccess={true}
                    >
                      <UniversMarketplacePage />
                    </ProtectedRoute>
                  } 
                />
                
                {/* Univers - Create */}
                <Route 
                  path="/univers/create" 
                  element={
                    <ProtectedRoute 
                      allowedRoles={['directeur', 'employe']} 
                      requireDirectorDashboardAccess={true}
                    >
                      <UniversCreatePage />
                    </ProtectedRoute>
                  } 
                />
                
                {/* Univers - Create from Template */}
                <Route 
                  path="/univers/create-from-template/:id" 
                  element={
                    <ProtectedRoute 
                      allowedRoles={['directeur']} 
                      requireDirectorDashboardAccess={true}
                    >
                      <UniversCreateFromTemplatePage />
                    </ProtectedRoute>
                  } 
                />
                
                {/* Univers - Edit */}
                <Route
                  path="/univers/:id/edit"
                  element={
                    <ProtectedRoute
                      allowedRoles={['directeur', 'employe']}
                      requireDirectorDashboardAccess={true}
                    >
                      <UniversEditPage />
                    </ProtectedRoute>
                  }
                />
                
                {/* Univers - Detail */}
                <Route 
                  path="/univers/:id" 
                  element={
                    <ProtectedRoute 
                      allowedRoles={['directeur', 'employe']} 
                      requireDirectorDashboardAccess={true}
                    >
                      <UniversViewPage />
                    </ProtectedRoute>
                  } 
                />
                
                {/* Lists - Main page */}
                <Route 
                  path="/lists" 
                  element={
                    <ProtectedRoute 
                      allowedRoles={['directeur', 'employe']} 
                      requireDirectorDashboardAccess={true}
                    >
                      <ListsPage />
                    </ProtectedRoute>
                  } 
                />
                
                {/* Lists - Create */}
                <Route 
                  path="/lists/create" 
                  element={
                    <ProtectedRoute 
                      allowedRoles={['directeur', 'employe']} 
                      requireDirectorDashboardAccess={true}
                    >
                      <ListEditorPage />
                    </ProtectedRoute>
                  } 
                />
                
                {/* Lists - Edit */}
                <Route
                  path="/lists/:id/edit"
                  element={
                    <ProtectedRoute
                      allowedRoles={['directeur', 'employe']}
                      requireDirectorDashboardAccess={true}
                    >
                      <ListEditorPage />
                    </ProtectedRoute>
                  }
                />
                
                {/* Reports - Main page */}
                <Route 
                  path="/reports" 
                  element={
                    <ProtectedRoute 
                      allowedRoles={['directeur', 'employe']} 
                      requireDirectorDashboardAccess={true}
                    >
                      <ReportsPage />
                    </ProtectedRoute>
                  } 
                />
                
                {/* Dev/Test: Push Notifications */}
                <Route 
                  path="/dev/push-test" 
                  element={
                    <ProtectedRoute allowedRoles={['directeur', 'employe']}>
                      <PushTestPage />
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
                <Route path="/" element={
                  <ErrorBoundary fallback={<Navigate to="/login" replace />}>
                    <RoleBasedRedirect />
                  </ErrorBoundary>
                } />
                
                {/* Page 404 */}
                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
              
              {/* PWA Components - Inside Router context */}
              <HybridPWAManager />
            </Router>
          </ConversationProvider>
        </AppProvider>
        </AIResponseProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

// Composant pour rediriger selon le rôle (NO ADMIN REDIRECT - admin app handles that)
const RoleBasedRedirect: React.FC = () => {
  try {
    const { user, isLoading } = useAuth();

    // Afficher le loader pendant le chargement
    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    // Ne pas rediriger vers login si on est en train de charger
    // Cela évite la redirection pendant l'inscription
    // Vérifier aussi si on est déjà sur la page de login pour éviter les boucles
    if (!user) {
      const currentPath = window.location.pathname;
      // Ne pas rediriger si on est déjà sur /login ou /packages
      if (currentPath !== '/login' && currentPath !== '/packages') {
        return <Navigate to="/login" replace />;
      }
      // Si on est sur /login, laisser LoginPage gérer la redirection
      return null;
    }

    // Admin users should use admin app - redirect to login (they should use admin subdomain)
    if (user.role === 'admin') {
      return <Navigate to="/login" replace />;
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
  } catch (error) {
    console.error('Error in RoleBasedRedirect:', error);
    // If useAuth fails, redirect to login
    return <Navigate to="/login" replace />;
  }
};

export default App;


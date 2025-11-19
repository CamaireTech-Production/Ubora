import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@ubora/shared/contexts/AuthContext';
import { AIResponseProvider } from '@ubora/shared/contexts/AIResponseContext';
import { AppProvider } from '@ubora/shared/contexts/AppContext';
import { ConversationProvider } from '@ubora/shared/contexts/ConversationContext';
import { UniversProvider } from '@ubora/shared/contexts/UniversContext';
import { FormsProvider } from '@ubora/shared/contexts/FormsContext';
import { EntriesProvider } from '@ubora/shared/contexts/EntriesContext';
import { EmployeesProvider } from '@ubora/shared/contexts/EmployeesContext';
import { DashboardsProvider } from '@ubora/shared/contexts/DashboardsContext';
import { ProtectedRoute } from './components/core/ProtectedRoute';
import { ErrorBoundary } from './components/core/ErrorBoundary';
import { WireframeLoader } from './components/loading/WireframeLoader';
import { LoginPage } from './pages/auth/LoginPage';
import { PasswordResetPage } from './pages/auth/PasswordResetPage';
import { ProfileCompletionPage } from './pages/auth/ProfileCompletionPage';
import { UnauthorizedPage } from './pages/shared/UnauthorizedPage';
import { PendingApprovalPage } from './pages/employees/PendingApprovalPage';
import { ProgrammedInstructionsRoute } from './components/scheduled/ProgrammedInstructionsRoute';
import { HybridPWAManager } from './components/pwa/HybridPWAManager';
import { EmployeeManagement } from './components/employees/EmployeeManagement';
import { Layout } from './components/layout/Layout';
import { PWAUpdateNotification } from './components/pwa/PWAUpdateNotification';
import { usePageTracking } from '@ubora/shared/hooks/usePageTracking';

// Lazy load all routes except auth pages
const DirecteurDashboard = lazy(() => import('./pages/dashboard/DirecteurDashboard').then(module => ({ default: module.DirecteurDashboard })));
const DirecteurChat = lazy(() => import('./pages/chat/DirecteurChat').then(module => ({ default: module.DirecteurChat })));
const EmployeDashboard = lazy(() => import('./pages/dashboard/EmployeDashboard').then(module => ({ default: module.EmployeDashboard })));
const DashboardDetailPage = lazy(() => import('./pages/dashboard/DashboardDetailPage').then(module => ({ default: module.DashboardDetailPage })));
const ResponseDetailPage = lazy(() => import('./pages/forms/ResponseDetailPage').then(module => ({ default: module.ResponseDetailPage })));
const PackageManagementPage = lazy(() => import('./pages/packages/PackageManagementPage').then(module => ({ default: module.PackageManagementPage })));
const PackageSelectionPage = lazy(() => import('./pages/packages/PackageSelectionPage').then(module => ({ default: module.PackageSelectionPage })));
const DirectorSettingsPage = lazy(() => import('./pages/settings/DirectorSettingsPage').then(module => ({ default: module.DirectorSettingsPage })));
const NotificationsPage = lazy(() => import('./pages/notifications/NotificationsPage').then(module => ({ default: module.NotificationsPage })));
const ScheduledQuestionsPage = lazy(() => import('./pages/scheduled/ScheduledQuestionsPage').then(module => ({ default: module.ScheduledQuestionsPage })));
const ScheduledQuestionFormPage = lazy(() => import('./pages/scheduled/ScheduledQuestionFormPage').then(module => ({ default: module.ScheduledQuestionFormPage })));
const ScheduledQuestionChatPage = lazy(() => import('./pages/chat/ScheduledQuestionChatPage').then(module => ({ default: module.ScheduledQuestionChatPage })));
const UniversPage = lazy(() => import('./pages/univers/UniversPage').then(module => ({ default: module.UniversPage })));
const UniversCreatePage = lazy(() => import('./pages/univers/UniversCreatePage').then(module => ({ default: module.UniversCreatePage })));
const UniversCreateFromTemplatePage = lazy(() => import('./pages/univers/UniversCreateFromTemplatePage').then(module => ({ default: module.UniversCreateFromTemplatePage })));
const UniversEditPage = lazy(() => import('./pages/univers/UniversEditPage').then(module => ({ default: module.UniversEditPage })));
const UniversViewPage = lazy(() => import('./pages/univers/UniversViewPage').then(module => ({ default: module.UniversViewPage })));
const UniversMarketplacePage = lazy(() => import('./pages/univers/UniversMarketplacePage').then(module => ({ default: module.UniversMarketplacePage })));
const UniversInstructionsPage = lazy(() => import('./pages/univers/UniversInstructionsPage').then(module => ({ default: module.UniversInstructionsPage })));
const ListsPage = lazy(() => import('./pages/lists/ListsPage').then(module => ({ default: module.ListsPage })));
const ListEditorPage = lazy(() => import('./pages/lists/ListEditorPage').then(module => ({ default: module.ListEditorPage })));
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage').then(module => ({ default: module.ReportsPage })));
const PushTestPage = lazy(() => import('./pages/shared/PushTestPage').then(module => ({ default: module.default })));
const CampayTestPage = lazy(() => import('./pages/shared/CampayTestPage').then(module => ({ default: module.CampayTestPage })));

// Helper component to wrap lazy loaded routes with Suspense
const LazyRoute: React.FC<{ children: React.ReactNode; loaderType: 'dashboard' | 'chat' | 'form' | 'list' | 'card' | 'chart' | 'metric' | 'notification' | 'univers' | 'univers-card' | 'univers-detail' }> = ({ 
  children, 
  loaderType 
}) => (
  <Suspense fallback={<WireframeLoader type={loaderType} />}>
    {children}
  </Suspense>
);

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
  logger.debug('Handling highlighting', { notificationType, highlightData }, 'App');

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
      logger.warn('Unknown notification type', { notificationType }, 'App');
  }
};

const handleFormAssignmentHighlighting = (highlightData: any) => {
  // Implementation for form assignment highlighting
  logger.debug('Form assignment highlighting', { highlightData }, 'App');
};

const handleFormReminderHighlighting = (highlightData: any) => {
  // Implementation for form reminder highlighting
  logger.debug('Form reminder highlighting', { highlightData }, 'App');
};

const handleMetricReminderHighlighting = (highlightData: any) => {
  // Implementation for metric reminder highlighting
  logger.debug('Metric reminder highlighting', { highlightData }, 'App');
};

const handleProgrammedInstructionHighlighting = (highlightData: any) => {
  // Implementation for programmed instruction highlighting
  logger.debug('Programmed instruction highlighting', { highlightData }, 'App');
};

// Component for authenticated services
const AuthenticatedServices: React.FC = () => {
  try {
    usePageTracking();
  } catch (error) {
    // Ignorer silencieusement les erreurs de tracking
  }
  return null;
};

// Wrapper de protection pour chaque contexte
const SafeAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }: { children: React.ReactNode }) => {
  try {
    return <AuthProvider>{children}</AuthProvider>;
  } catch (error) {
    // Si AuthProvider échoue, afficher une version simplifiée
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Erreur d'initialisation</h1>
        <p>L'application n'a pas pu démarrer. Veuillez recharger.</p>
        <button onClick={() => window.location.reload()}>Recharger</button>
      </div>
    );
  }
};

const SafeAIResponseProvider: React.FC<{ children: React.ReactNode }> = ({ children }: { children: React.ReactNode }) => {
  try {
    return <AIResponseProvider>{children}</AIResponseProvider>;
  } catch (error) {
    // Si AIResponseProvider échoue, continuer sans
    return <>{children}</>;
  }
};

const SafeAppProvider: React.FC<{ children: React.ReactNode }> = ({ children }: { children: React.ReactNode }) => {
  try {
    return <AppProvider>{children}</AppProvider>;
  } catch (error) {
    // Si AppProvider échoue, continuer sans
    return <>{children}</>;
  }
};

const SafeConversationProvider: React.FC<{ children: React.ReactNode }> = ({ children }: { children: React.ReactNode }) => {
  try {
    return <ConversationProvider>{children}</ConversationProvider>;
  } catch (error) {
    // Si ConversationProvider échoue, continuer sans
    return <>{children}</>;
  }
};

const SafeUniversProvider: React.FC<{ children: React.ReactNode }> = ({ children }: { children: React.ReactNode }) => {
  try {
    return <UniversProvider>{children}</UniversProvider>;
  } catch (error) {
    return <>{children}</>;
  }
};

const SafeFormsProvider: React.FC<{ children: React.ReactNode }> = ({ children }: { children: React.ReactNode }) => {
  try {
    return <FormsProvider>{children}</FormsProvider>;
  } catch (error) {
    return <>{children}</>;
  }
};

const SafeEntriesProvider: React.FC<{ children: React.ReactNode }> = ({ children }: { children: React.ReactNode }) => {
  try {
    return <EntriesProvider>{children}</EntriesProvider>;
  } catch (error) {
    return <>{children}</>;
  }
};

const SafeEmployeesProvider: React.FC<{ children: React.ReactNode }> = ({ children }: { children: React.ReactNode }) => {
  try {
    return <EmployeesProvider>{children}</EmployeesProvider>;
  } catch (error) {
    return <>{children}</>;
  }
};

const SafeDashboardsProvider: React.FC<{ children: React.ReactNode }> = ({ children }: { children: React.ReactNode }) => {
  try {
    return <DashboardsProvider>{children}</DashboardsProvider>;
  } catch (error) {
    return <>{children}</>;
  }
};

function App() {
  return (
    <ErrorBoundary>
      <SafeAuthProvider>
        <SafeAIResponseProvider>
          <SafeUniversProvider>
            <SafeFormsProvider>
              <SafeEntriesProvider>
                <SafeEmployeesProvider>
                  <SafeDashboardsProvider>
                    <SafeAppProvider>
                      <SafeConversationProvider>
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
                      <LazyRoute loaderType="dashboard">
                        <DirecteurDashboard />
                      </LazyRoute>
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
                      <LazyRoute loaderType="chat">
                        <DirecteurChat />
                      </LazyRoute>
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
                      <LazyRoute loaderType="dashboard">
                        <DashboardDetailPage />
                      </LazyRoute>
                    </ProtectedRoute>
                  } 
                />
                
                {/* Dashboard employé */}
                <Route 
                  path="/employe/dashboard" 
                  element={
                    <ProtectedRoute allowedRoles={['employe']}>
                      <LazyRoute loaderType="dashboard">
                        <EmployeDashboard />
                      </LazyRoute>
                    </ProtectedRoute>
                  } 
                />
                
                {/* Page de détails des réponses */}
                <Route 
                  path="/responses/:formId" 
                  element={
                    <ProtectedRoute allowedRoles={['employe', 'directeur']}>
                      <LazyRoute loaderType="form">
                        <ResponseDetailPage />
                      </LazyRoute>
                    </ProtectedRoute>
                  } 
                />
                
                {/* Page de sélection des packages pour nouveaux directeurs */}
                <Route 
                  path="/packages" 
                  element={
                    <ProtectedRoute allowedRoles={['directeur']}>
                      <LazyRoute loaderType="card">
                        <PackageSelectionPage />
                      </LazyRoute>
                    </ProtectedRoute>
                  } 
                />
                
                {/* Page de gestion des packages */}
                <Route 
                  path="/packages/manage" 
                  element={
                    <ProtectedRoute allowedRoles={['directeur']}>
                      <LazyRoute loaderType="card">
                        <PackageManagementPage />
                      </LazyRoute>
                    </ProtectedRoute>
                  } 
                />
                
                {/* Page des paramètres directeur */}
                <Route 
                  path="/directeur/settings" 
                  element={
                    <ProtectedRoute allowedRoles={['directeur']}>
                      <LazyRoute loaderType="card">
                        <DirectorSettingsPage />
                      </LazyRoute>
                    </ProtectedRoute>
                  } 
                />
                
                {/* Notifications Settings */}
                <Route 
                  path="/notifications" 
                  element={
                    <ProtectedRoute allowedRoles={['directeur', 'employe']}>
                      <LazyRoute loaderType="notification">
                        <NotificationsPage />
                      </LazyRoute>
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
                        <LazyRoute loaderType="list">
                          <ScheduledQuestionsPage />
                        </LazyRoute>
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
                        <LazyRoute loaderType="form">
                          <ScheduledQuestionFormPage />
                        </LazyRoute>
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
                        <LazyRoute loaderType="form">
                          <ScheduledQuestionFormPage />
                        </LazyRoute>
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
                        <LazyRoute loaderType="chat">
                          <ScheduledQuestionChatPage />
                        </LazyRoute>
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
                      <LazyRoute loaderType="univers">
                        <UniversPage />
                      </LazyRoute>
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
                      <LazyRoute loaderType="univers">
                        <UniversMarketplacePage />
                      </LazyRoute>
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
                      <LazyRoute loaderType="univers">
                        <UniversCreatePage />
                      </LazyRoute>
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
                      <LazyRoute loaderType="univers">
                        <UniversCreateFromTemplatePage />
                      </LazyRoute>
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
                      <LazyRoute loaderType="univers">
                        <UniversEditPage />
                      </LazyRoute>
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
                      <LazyRoute loaderType="univers-detail">
                        <UniversViewPage />
                      </LazyRoute>
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
                      <LazyRoute loaderType="list">
                        <ListsPage />
                      </LazyRoute>
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
                      <LazyRoute loaderType="form">
                        <ListEditorPage />
                      </LazyRoute>
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
                      <LazyRoute loaderType="form">
                        <ListEditorPage />
                      </LazyRoute>
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
                      <LazyRoute loaderType="chart">
                        <ReportsPage />
                      </LazyRoute>
                    </ProtectedRoute>
                  } 
                />
                
                {/* Instructions Programmées - Main page */}
                <Route 
                  path="/directeur/univers/instructions" 
                  element={
                    <ProtectedRoute 
                      allowedRoles={['directeur']}
                    >
                      <LazyRoute loaderType="list">
                        <UniversInstructionsPage />
                      </LazyRoute>
                    </ProtectedRoute>
                  } 
                />
                
                {/* Dev/Test: Push Notifications */}
                <Route 
                  path="/dev/push-test" 
                  element={
                    <ProtectedRoute allowedRoles={['directeur', 'employe']}>
                      <LazyRoute loaderType="card">
                        <PushTestPage />
                      </LazyRoute>
                    </ProtectedRoute>
                  } 
                />
                
                {/* Dev/Test: Campay Service */}
                <Route 
                  path="/dev/campay-test" 
                  element={
                    <ProtectedRoute allowedRoles={['directeur', 'employe']}>
                      <LazyRoute loaderType="card">
                        <CampayTestPage />
                      </LazyRoute>
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
                      </SafeConversationProvider>
                    </SafeAppProvider>
                  </SafeDashboardsProvider>
                </SafeEmployeesProvider>
              </SafeEntriesProvider>
            </SafeFormsProvider>
          </SafeUniversProvider>
        </SafeAIResponseProvider>
      </SafeAuthProvider>
    </ErrorBoundary>
  );
}

// Composant pour rediriger selon le rôle (NO ADMIN REDIRECT - admin app handles that)
const RoleBasedRedirect: React.FC = () => {
  try {
    let user, isLoading;
    try {
      const auth = useAuth();
      user = auth.user;
      isLoading = auth.isLoading;
    } catch (authError) {
      // Si useAuth échoue, rediriger vers login
      return <Navigate to="/login" replace />;
    }

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
      // Rediriger vers pending-approval si isApproved est false ou undefined
      if (user.isApproved === false || user.isApproved === undefined) {
        const currentPath = window.location.pathname;
        // Ne pas rediriger si on est déjà sur /pending-approval
        if (currentPath !== '/pending-approval') {
          return <Navigate to="/pending-approval" replace />;
        }
        return null;
      }
      // Si approuvé, rediriger vers le dashboard
      const currentPath = window.location.pathname;
      if (currentPath !== '/employe/dashboard' && currentPath !== '/pending-approval') {
        return <Navigate to="/employe/dashboard" replace />;
      }
      return null;
    }

    // Fallback vers login si rôle inconnu
    return <Navigate to="/login" replace />;
  } catch (error) {
    logger.error('Error in RoleBasedRedirect', error, 'App');
    // If useAuth fails, redirect to login
    return <Navigate to="/login" replace />;
  }
};

export default App;


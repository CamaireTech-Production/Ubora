import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppProvider } from './contexts/AppContext';
import { ConversationProvider } from './contexts/ConversationContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginPage } from './pages/LoginPage';
import { PasswordResetPage } from './pages/PasswordResetPage';
import { ProfileCompletionPage } from './pages/ProfileCompletionPage';
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
import { ScheduledQuestionsPage } from './pages/ScheduledQuestionsPage';
import { ScheduledQuestionFormPage } from './pages/ScheduledQuestionFormPage';
import { ScheduledQuestionChatPage } from './pages/ScheduledQuestionChatPage';
import { ProgrammedInstructionsRoute } from './components/ProgrammedInstructionsRoute';
import { UniversPage } from './pages/UniversPage';
import { UniversCreatePage } from './pages/UniversCreatePage';
import { UniversEditPage } from './pages/UniversEditPage';
import { ReportsPage } from './pages/ReportsPage';
import { ReportsCreatePage } from './pages/ReportsCreatePage';
import { ReportsEditPage } from './pages/ReportsEditPage';
import { AdminLoginPage } from './admin/pages/AdminLoginPage';
import { AdminPage } from './admin';
import { UserDetailPage } from './admin/pages/UserDetailPage';
import PushTestPage from './pages/PushTestPage';
import { HybridPWAManager } from './components/HybridPWAManager';
import { EmployeeManagement } from './components/EmployeeManagement';
import { Layout } from './components/Layout';
import { initializePWAConfig } from './utils/pwaConfig';
import { PWAUpdateNotification } from './components/PWAUpdateNotification';
import { usePageTracking } from './hooks/usePageTracking';

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

/**
 * Handle form assignment highlighting
 */
const handleFormAssignmentHighlighting = (highlightData: any) => {
  if (highlightData.formId && highlightData.scrollToForm) {
    setTimeout(() => {
      const formElement = document.querySelector(`[data-form-id="${highlightData.formId}"]`);
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        formElement.classList.add('notification-highlight');
        setTimeout(() => {
          formElement.classList.remove('notification-highlight');
        }, 3000);
      }
    }, 500);
  }
};

/**
 * Handle form reminder highlighting
 */
const handleFormReminderHighlighting = (highlightData: any) => {
  if (highlightData.formId && highlightData.autoFill) {
    setTimeout(() => {
      const firstInput = document.querySelector('form input, form textarea, form select');
      if (firstInput) {
        (firstInput as HTMLElement).focus();
        const formElement = firstInput.closest('form');
        if (formElement) {
          formElement.classList.add('notification-highlight');
          setTimeout(() => {
            formElement.classList.remove('notification-highlight');
          }, 3000);
        }
      }
    }, 500);
  }
};

/**
 * Handle metric reminder highlighting
 */
const handleMetricReminderHighlighting = (highlightData: any) => {
  if (highlightData.metricId && highlightData.scrollToMetric) {
    setTimeout(() => {
      const metricElement = document.querySelector(`[data-metric-id="${highlightData.metricId}"]`);
      if (metricElement) {
        metricElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        metricElement.classList.add('notification-highlight');
        setTimeout(() => {
          metricElement.classList.remove('notification-highlight');
        }, 3000);
      }
    }, 500);
  }
};

/**
 * Handle programmed instruction highlighting
 */
const handleProgrammedInstructionHighlighting = (highlightData: any) => {
  if (highlightData.instructionId && highlightData.autoOpen) {
    setTimeout(() => {
      const responseElement = document.querySelector(`[data-instruction-id="${highlightData.instructionId}"]`);
      if (responseElement) {
        const responseButton = responseElement.querySelector('[data-action="show-response"]');
        if (responseButton) {
          (responseButton as HTMLElement).click();
        }
        responseElement.classList.add('notification-highlight');
        setTimeout(() => {
          responseElement.classList.remove('notification-highlight');
        }, 3000);
      }
    }, 500);
  }
};

// Component that only renders notification services for authenticated users
const AuthenticatedServices: React.FC = () => {
  const { user } = useAuth();

  // Initialize page tracking for authenticated users
  usePageTracking();

  // Only render these services if user is authenticated
  if (!user) {
    return null;
  }

  return null;
};

function App() {
  // Initialize PWA configuration on app load
  useEffect(() => {
    initializePWAConfig();
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
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
            
            {/* Univers - Detail (will be added later) */}
            <Route 
              path="/univers/:id" 
              element={
                <ProtectedRoute 
                  allowedRoles={['directeur', 'employe']} 
                  requireDirectorDashboardAccess={true}
                >
                  <UniversPage />
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
            
            {/* Reports - Create */}
            <Route 
              path="/reports/create" 
              element={
                <ProtectedRoute 
                  allowedRoles={['directeur', 'employe']} 
                  requireDirectorDashboardAccess={true}
                >
                  <ReportsCreatePage />
                </ProtectedRoute>
              } 
            />
            
            {/* Reports - Edit */}
            <Route 
              path="/reports/:id/edit" 
              element={
                <ProtectedRoute 
                  allowedRoles={['directeur', 'employe']} 
                  requireDirectorDashboardAccess={true}
                >
                  <ReportsEditPage />
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
          {/* <PWAUpdateNotification /> */}
            </Router>
          </ConversationProvider>
        </AppProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

// Composant pour rediriger selon le rôle
const RoleBasedRedirect: React.FC = () => {
  try {
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
  } catch (error) {
    console.error('Error in RoleBasedRedirect:', error);
    // If useAuth fails, redirect to login
    return <Navigate to="/login" replace />;
  }
};

export default App;
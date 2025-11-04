import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@ubora/shared/contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { AdminPage } from './pages/AdminPage';
import { UserDetailPage } from './pages/UserDetailPage';
import { UniversApprovalsPage } from './pages/UniversApprovalsPage';
import { UniversApprovalDetailPage } from './pages/UniversApprovalDetailPage';
import { AdminPWAInstallPrompt } from './components/AdminPWAInstallPrompt';
import { PWAUpdateNotification } from './components/PWAUpdateNotification';

// Component to handle service worker messages
const ServiceWorkerMessageHandler: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'NOTIFICATION_CLICK') {
        const { url } = event.data;
        
        console.log('🔔 [Admin App] Handling notification click:', { url });

        // Navigate to the specified URL
        if (url && url !== window.location.pathname) {
          navigate(url);
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

// Component for authenticated services
const AuthenticatedServices: React.FC = () => {
  return null;
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <ServiceWorkerMessageHandler />
          <AuthenticatedServices />
          <PWAUpdateNotification />
          <Routes>
            {/* Admin Login - root route */}
            <Route path="/login" element={<AdminLoginPage />} />
            
            {/* Admin Dashboard - root route */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminPage />
                </ProtectedRoute>
              } 
            />
            
            {/* Admin User Detail - root route */}
            <Route 
              path="/users/:userId" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <UserDetailPage />
                </ProtectedRoute>
              } 
            />
            
            {/* Admin Univers Approval Detail - must come before list route */}
            <Route 
              path="/univers-approvals/:universId" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <UniversApprovalDetailPage />
                </ProtectedRoute>
              } 
            />
            
            {/* Admin Univers Approvals - root route */}
            <Route 
              path="/univers-approvals" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <UniversApprovalsPage />
                </ProtectedRoute>
              } 
            />
            
            {/* Default redirect - go to login */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            
            {/* Catch all - redirect to login */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
          <AdminPWAInstallPrompt />
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;


import React from 'react';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { UserSessionService } from '@ubora/shared/services/userSessionService';
import { AccessDeniedModal } from './AccessDeniedModal';
import { useNavigate } from 'react-router-dom';

interface ProgrammedInstructionsRouteProps {
  children: React.ReactNode;
}

export const ProgrammedInstructionsRoute: React.FC<ProgrammedInstructionsRouteProps> = ({ children }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showAccessDeniedModal, setShowAccessDeniedModal] = React.useState(false);

  React.useEffect(() => {
    if (user && !UserSessionService.hasProgrammedInstructionsAccess(user)) {
      setShowAccessDeniedModal(true);
    }
  }, [user]);

  const handleCloseModal = () => {
    setShowAccessDeniedModal(false);
    navigate('/packages');
  };

  if (!user) {
    return null; // Let ProtectedRoute handle authentication
  }

  if (!UserSessionService.hasProgrammedInstructionsAccess(user)) {
    return (
      <AccessDeniedModal
        isOpen={showAccessDeniedModal}
        onClose={handleCloseModal}
        feature="programmed-instructions"
      />
    );
  }

  return <>{children}</>;
};

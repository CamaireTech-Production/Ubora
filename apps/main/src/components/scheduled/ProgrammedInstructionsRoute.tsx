import React from 'react';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { usePackageAccess } from '@ubora/shared/hooks/usePackageAccess';
import { AccessDeniedModal } from '../modals/AccessDeniedModal';
import { useNavigate } from 'react-router-dom';

interface ProgrammedInstructionsRouteProps {
  children: React.ReactNode;
}

export const ProgrammedInstructionsRoute: React.FC<ProgrammedInstructionsRouteProps> = ({ children }) => {
  const { user } = useAuth();
  const { packageInfo } = usePackageAccess();
  const navigate = useNavigate();
  const [showAccessDeniedModal, setShowAccessDeniedModal] = React.useState(false);

  // Check if package has programmed instructions feature
  const hasAccess = packageInfo?.packageType && 
    (packageInfo.packageType === 'starter' || packageInfo.packageType === 'standard');

  React.useEffect(() => {
    if (user && !hasAccess) {
      setShowAccessDeniedModal(true);
    }
  }, [user, hasAccess]);

  const handleCloseModal = () => {
    setShowAccessDeniedModal(false);
    navigate('/packages');
  };

  if (!user) {
    return null; // Let ProtectedRoute handle authentication
  }

  if (!hasAccess) {
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

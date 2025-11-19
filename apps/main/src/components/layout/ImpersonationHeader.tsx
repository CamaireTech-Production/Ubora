import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { usePermissions } from '@ubora/shared/hooks/usePermissions';
import { Info, X } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@ubora/shared/firebaseConfig';
import { User } from '../../types';
import { logger } from '@ubora/shared/utils/logger';

interface ImpersonationHeaderProps {
  onExit?: () => void;
}

export const ImpersonationHeader: React.FC<ImpersonationHeaderProps> = ({ onExit }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasDirectorDashboardAccess } = usePermissions();
  const [directorEmail, setDirectorEmail] = useState<string>('');
  const [isLoadingDirector, setIsLoadingDirector] = useState(false);

  // Only show this header if the user is an employee with director dashboard access
  if (!user || user.role !== 'employe' || !hasDirectorDashboardAccess()) {
    return null;
  }

  // Fetch director's email
  useEffect(() => {
    const fetchDirectorEmail = async () => {
      if (!user?.agencyId) return;
      
      setIsLoadingDirector(true);
      try {
        const directorsQuery = query(
          collection(db, 'users'),
          where('agencyId', '==', user.agencyId),
          where('role', '==', 'directeur')
        );
        
        const directorsSnapshot = await getDocs(directorsQuery);
        
        if (!directorsSnapshot.empty) {
          const directorData = directorsSnapshot.docs[0].data() as User;
          setDirectorEmail(directorData.email);
        }
      } catch (error) {
        logger.error('Error fetching director email', error, 'ImpersonationHeader');
      } finally {
        setIsLoadingDirector(false);
      }
    };

    fetchDirectorEmail();
  }, [user?.agencyId]);

  const handleExit = () => {
    if (onExit) {
      onExit();
    } else {
      // Default behavior: redirect to employee dashboard
      navigate('/employe/dashboard');
    }
  };

  return (
    <div className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
        <div className="flex items-center justify-between py-2 sm:py-3">
          {/* Left side - Impersonate mode button */}
          <div className="flex items-center space-x-1 sm:space-x-3">
            <div className="flex items-center space-x-1 sm:space-x-2 bg-orange-500 hover:bg-orange-600 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg transition-colors duration-200 cursor-pointer">
              <span className="text-xs sm:text-sm font-medium text-white whitespace-nowrap">
                <span className="hidden xs:inline">Mode délégué</span>
                <span className="xs:hidden">Délégué</span>
              </span>
              <div className="w-3 h-3 sm:w-4 sm:h-4 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                <Info className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-white" />
              </div>
            </div>
          </div>

          {/* Center - Account management message */}
          <div className="flex-1 flex justify-center px-2">
            <div className="text-center min-w-0">
              <p className="text-xs sm:text-sm lg:text-base font-semibold text-white truncate">
                <span className="hidden sm:inline">Vous gérez le compte </span>
                <span className="sm:hidden">Compte: </span>
                <span className="font-mono text-xs sm:text-sm">
                  {isLoadingDirector ? 'Chargement...' : directorEmail || 'Directeur non trouvé'}
                </span>
              </p>
            </div>
          </div>

          {/* Right side - Exit button */}
          <div className="flex items-center">
            <button
              onClick={handleExit}
              className="flex items-center space-x-1 sm:space-x-2 bg-purple-500 hover:bg-purple-600 px-2 sm:px-4 py-1 sm:py-1.5 rounded-lg transition-colors duration-200 text-white text-xs sm:text-sm font-medium"
            >
              <X className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
              <span className="hidden sm:inline">Sortir</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

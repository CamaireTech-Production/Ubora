import React from 'react';
import { useApp } from '@ubora/shared/contexts/AppContext';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { universService } from '@ubora/shared/services/universService';
import { Univers } from '../../types';
import { Globe } from 'lucide-react';
import { ActiveUniversSkeleton } from '../skeletons/ActiveUniversSkeleton';

interface ActiveUniversDisplayProps {
  className?: string;
}

export const ActiveUniversDisplay: React.FC<ActiveUniversDisplayProps> = ({ className = '' }) => {
  const { user } = useAuth();
  const { activeUniversId } = useApp();
  const [activeUnivers, setActiveUnivers] = React.useState<Univers | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (!activeUniversId || user?.role !== 'directeur') {
      setActiveUnivers(null);
      return;
    }

    const loadActiveUnivers = async () => {
      setIsLoading(true);
      try {
        const univers = await universService.getById(activeUniversId);
        setActiveUnivers(univers);
      } catch (error) {
        console.error('Erreur lors du chargement du Univers actif:', error);
        setActiveUnivers(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadActiveUnivers();
  }, [activeUniversId, user?.role]);

  if (!user || user.role !== 'directeur' || !activeUniversId) {
    return null;
  }

  if (isLoading) {
    return <ActiveUniversSkeleton className={className} />;
  }

  if (!activeUnivers) {
    return (
      <div className={`flex items-center space-x-2 px-2 py-1 rounded-md border text-xs font-medium text-gray-600 bg-gray-50 border-gray-200 ${className}`}>
        <Globe className="h-4 w-4 text-gray-400" />
        <span>Aucun Univers</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center space-x-2 px-2 py-1 rounded-md border text-xs font-medium text-blue-600 bg-blue-50 border-blue-200 ${className}`}>
      <Globe className="h-4 w-4 text-blue-600" />
      <span className="truncate max-w-[120px]">{activeUnivers.metadata.name}</span>
    </div>
  );
};


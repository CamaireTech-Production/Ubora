import React, { useState, useRef } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { User as UserIcon, CheckCircle, XCircle, Clock, Mail, Building2 } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@ubora/shared/firebaseConfig';
import { useToast } from '@ubora/shared/hooks/useToast';
import { User } from '../../types';
import { logger } from '@ubora/shared/utils/logger';

interface PendingApprovalsProps {
  pendingEmployees: User[];
  currentDirectorId: string;
  onApprovalChange: () => void;
}

export const PendingApprovals: React.FC<PendingApprovalsProps> = ({
  pendingEmployees,
  currentDirectorId,
  onApprovalChange
}) => {
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const { showSuccess, showError } = useToast();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleApproval = async (employeeId: string, approved: boolean) => {
    try {
      setProcessingIds(prev => new Set(prev).add(employeeId));
      
      const employeeRef = doc(db, 'users', employeeId);
      await updateDoc(employeeRef, {
        isApproved: approved,
        approvedBy: approved ? currentDirectorId : null,
        approvedAt: approved ? serverTimestamp() : null,
        updatedAt: serverTimestamp()
      });
      
      onApprovalChange();
      showSuccess(approved ? 'Employé approuvé avec succès !' : 'Employé rejeté avec succès !');
    } catch (error) {
      logger.error('Erreur lors de l\'approbation', error, 'PendingApprovals');
      showError('Erreur lors de l\'approbation. Veuillez réessayer.');
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(employeeId);
        return newSet;
      });
    }
  };

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -320, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 320, behavior: 'smooth' });
    }
  };

  if (pendingEmployees.length === 0) {
    return (
      <Card title="Demandes d'approbation">
        <div className="text-center py-6">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <p className="text-gray-500">Aucune demande d'approbation en attente</p>
        </div>
      </Card>
    );
  }

  return (
    <Card title={`Demandes d'approbation (${pendingEmployees.length})`}>
      <div className="relative">
        <div 
          ref={scrollContainerRef} 
          className="flex gap-4 sm:gap-6 overflow-x-auto pb-4 scrollbar-hide horizontal-scroll-approvals"
        >
          {pendingEmployees.map(employee => {
            const isProcessing = processingIds.has(employee.id);
            
            return (
              <div
                key={employee.id}
                className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 hover:shadow-xl transition-all duration-300 hover:border-blue-300 hover:-translate-y-1 mobile-approval-card flex-shrink-0 w-80 sm:w-96 h-auto relative group flex flex-col"
              >
                {/* Header with user info and status */}
                <div className="mb-4 flex-shrink-0">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <UserIcon className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-base sm:text-lg leading-tight truncate">
                        {employee.name}
                      </h3>
                    </div>
                  </div>
                  
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 w-fit">
                    <Clock className="h-3 w-3 mr-1" />
                    En attente
                  </span>
                </div>

                {/* Employee details */}
                <div className="space-y-2 text-sm text-gray-600 mb-4 flex-1">
                  <div className="flex items-center space-x-2">
                    <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <span className="break-all text-xs sm:text-sm">{employee.email}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Building2 className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <span className="text-xs sm:text-sm">Agence: {employee.agencyId || 'Non spécifiée'}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Inscrit le {employee.createdAt ? new Date(employee.createdAt.seconds * 1000).toLocaleDateString() : 'Date inconnue'}
                  </div>
                </div>

                {/* Action buttons - improved mobile layout */}
                <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => handleApproval(employee.id, true)}
                    disabled={isProcessing}
                    className="flex-1 flex items-center justify-center space-x-1 text-xs sm:text-sm bg-green-600 hover:bg-green-700 text-white border-0 rounded-lg font-medium py-2"
                  >
                    <CheckCircle className="h-4 w-4" />
                    <span>Approuver</span>
                  </Button>
                  
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleApproval(employee.id, false)}
                    disabled={isProcessing}
                    className="flex-1 flex items-center justify-center space-x-1 text-xs sm:text-sm bg-red-600 hover:bg-red-700 text-white border-0 rounded-lg font-medium py-2"
                  >
                    <XCircle className="h-4 w-4" />
                    <span>Rejeter</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Scroll indicators */}
        {pendingEmployees.length > 1 && (
          <>
            <div className="scroll-indicator scroll-indicator-left hidden md:flex" onClick={scrollLeft}>
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </div>
            <div className="scroll-indicator scroll-indicator-right hidden md:flex" onClick={scrollRight}>
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </>
        )}
      </div>
    </Card>
  );
};

import React, { useState } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { User, CheckCircle, XCircle, Clock, Mail, Building2 } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';

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
    } catch (error) {
      console.error('Erreur lors de l\'approbation:', error);
      alert('Erreur lors de l\'approbation. Veuillez réessayer.');
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(employeeId);
        return newSet;
      });
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
      <div className="space-y-4">
        {pendingEmployees.map(employee => {
          const isProcessing = processingIds.has(employee.id);
          
          return (
            <div
              key={employee.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <User className="h-5 w-5 text-gray-400" />
                    <h3 className="font-semibold text-gray-900">{employee.name}</h3>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      <Clock className="h-3 w-3 mr-1" />
                      En attente
                    </span>
                  </div>
                  
                  <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4" />
                      <span className="break-all">{employee.email}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Building2 className="h-4 w-4" />
                      <span>Agence: {employee.agencyId || 'Non spécifiée'}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Inscrit le {employee.createdAt ? new Date(employee.createdAt.seconds * 1000).toLocaleDateString() : 'Date inconnue'}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 ml-4">
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => handleApproval(employee.id, true)}
                    disabled={isProcessing}
                    className="flex items-center space-x-1"
                  >
                    <CheckCircle className="h-4 w-4" />
                    <span>Approuver</span>
                  </Button>
                  
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleApproval(employee.id, false)}
                    disabled={isProcessing}
                    className="flex items-center space-x-1"
                  >
                    <XCircle className="h-4 w-4" />
                    <span>Rejeter</span>
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { Button } from './Button';
import { Card } from './Card';
import { useToast } from '../hooks/useToast';
import { Toast } from './Toast';
import { 
  Users, 
  Shield
} from 'lucide-react';
import { User } from '../types';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';

interface EmployeeManagementProps {
  className?: string;
}

export const EmployeeManagement: React.FC<EmployeeManagementProps> = ({ className = '' }) => {
  const { user: currentUser } = useAuth();
  const { employees, isLoading } = useApp();
  const { showSuccess, showError } = useToast();
  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [isUpdatingAccess, setIsUpdatingAccess] = useState(false);

  // Filtrer les employés de l'agence du directeur
  const agencyEmployees = employees.filter(emp => 
    emp.role === 'employe' && emp.agencyId === currentUser?.agencyId
  );

  const handleGrantDirectorAccess = async (employee: User) => {
    if (!currentUser) return;

    setIsUpdatingAccess(true);
    try {
      const employeeRef = doc(db, 'users', employee.id);
      const updateData = {
        hasDirectorDashboardAccess: true,
        directorDashboardAccessGrantedBy: currentUser.id,
        directorDashboardAccessGrantedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      
      await updateDoc(employeeRef, updateData);

      setShowAccessModal(false);
      setSelectedEmployee(null);
      showSuccess(`Accès directeur accordé à ${employee.name} avec succès !`);
    } catch (error) {
      console.error('Erreur lors de l\'octroi d\'accès:', error);
      showError('Erreur lors de l\'octroi de l\'accès directeur. Veuillez réessayer.');
    } finally {
      setIsUpdatingAccess(false);
    }
  };

  const handleRevokeDirectorAccess = async (employee: User) => {
    if (!currentUser) return;

    setIsUpdatingAccess(true);
    try {
      const employeeRef = doc(db, 'users', employee.id);
      await updateDoc(employeeRef, {
        hasDirectorDashboardAccess: false,
        directorDashboardAccessGrantedBy: null,
        directorDashboardAccessGrantedAt: null,
        updatedAt: serverTimestamp()
      });

      setShowAccessModal(false);
      setSelectedEmployee(null);
      showSuccess(`Accès directeur révoqué pour ${employee.name} avec succès !`);
    } catch (error) {
      console.error('Erreur lors de la révocation d\'accès:', error);
      showError('Erreur lors de la révocation de l\'accès directeur. Veuillez réessayer.');
    } finally {
      setIsUpdatingAccess(false);
    }
  };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <Toast />
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des Employés</h1>
          <p className="text-gray-600 mt-1">
            Gérez les accès et permissions de vos employés
          </p>
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <Users className="h-4 w-4" />
          <span>{agencyEmployees.length} employé(s)</span>
        </div>
      </div>

      {/* Liste des employés */}
      <div className="grid gap-4">
        {agencyEmployees.map((employee) => (
          <Card key={employee.id} className="p-4 sm:p-6">
            <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">{employee.name}</h3>
                  <p className="text-sm text-gray-500">{employee.email}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      employee.isApproved !== false 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {employee.isApproved !== false ? 'Approuvé' : 'En attente'}
                    </span>
                    {employee.hasDirectorDashboardAccess && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        <Shield className="h-3 w-3 mr-1" />
                        Accès Directeur
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-2">
                {/* Actions */}
                <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
                  <Button
                    variant={employee.hasDirectorDashboardAccess ? "destructive" : "primary"}
                    size="sm"
                    onClick={() => {
                      setSelectedEmployee(employee);
                      setShowAccessModal(true);
                    }}
                    className="w-full sm:w-auto text-center"
                    disabled={isUpdatingAccess}
                  >
                    {employee.hasDirectorDashboardAccess ? (
                      "Révoquer l'accès"
                    ) : (
                      "Accès Directeur"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Modal d'octroi/révocation d'accès directeur */}
      {showAccessModal && selectedEmployee && createPortal(
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]" 
          style={{ top: 0, left: 0, right: 0, bottom: 0 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAccessModal(false);
              setSelectedEmployee(null);
            }
          }}
        >
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {selectedEmployee.hasDirectorDashboardAccess 
                ? 'Révoquer l\'accès directeur' 
                : 'Accorder l\'accès directeur'
              }
            </h3>
            <div className="text-gray-600 mb-6">
              {selectedEmployee.hasDirectorDashboardAccess ? (
                <p>Êtes-vous sûr de vouloir révoquer l'accès directeur pour <strong>{selectedEmployee.name}</strong> ?</p>
              ) : (
                <div>
                  <p className="mb-3">
                    Accorder l'accès directeur à <strong>{selectedEmployee.name}</strong> lui permettra de :
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Créer des formulaires et tableaux de bord</li>
                    <li>Accéder au dashboard directeur</li>
                    <li>Voir toutes les données de l'agence</li>
                  </ul>
                  <p className="mt-3 text-sm">
                    <strong>Note :</strong> Il n'aura pas accès au chat ARCHA
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end space-x-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowAccessModal(false);
                  setSelectedEmployee(null);
                }}
                disabled={isUpdatingAccess}
              >
                Annuler
              </Button>
              <Button
                variant={selectedEmployee.hasDirectorDashboardAccess ? "destructive" : "primary"}
                onClick={() => {
                  if (selectedEmployee.hasDirectorDashboardAccess) {
                    handleRevokeDirectorAccess(selectedEmployee);
                  } else {
                    handleGrantDirectorAccess(selectedEmployee);
                  }
                }}
                disabled={isUpdatingAccess}
              >
                {isUpdatingAccess ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Traitement...</span>
                  </div>
                ) : (
                  selectedEmployee.hasDirectorDashboardAccess ? 'Révoquer' : 'Accorder'
                )}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { usePermissions } from '../hooks/usePermissions';
import { PermissionManager } from '../utils/PermissionManager';
import { Button } from './Button';
import { Card } from './Card';
import { 
  Users, 
  Shield, 
  UserPlus, 
  Settings, 
  Check, 
  X, 
  Eye,
  EyeOff,
  Crown,
  Star
} from 'lucide-react';
import { User, AccessLevel } from '../types';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';

interface EmployeeManagementProps {
  className?: string;
}

export const EmployeeManagement: React.FC<EmployeeManagementProps> = ({ className = '' }) => {
  const { user: currentUser } = useAuth();
  const { employees, isLoading } = useApp();
  const { getPredefinedAccessLevels } = usePermissions();
  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [selectedAccessLevel, setSelectedAccessLevel] = useState<string>('');

  const predefinedLevels = getPredefinedAccessLevels();

  // Filtrer les employés de l'agence du directeur
  const agencyEmployees = employees.filter(emp => 
    emp.role === 'employe' && emp.agencyId === currentUser?.agencyId
  );

  const handleGrantDirectorAccess = async (employee: User) => {
    if (!currentUser) return;

    try {
      const employeeRef = doc(db, 'users', employee.id);
      await updateDoc(employeeRef, {
        hasDirectorDashboardAccess: true,
        directorDashboardAccessGrantedBy: currentUser.id,
        directorDashboardAccessGrantedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setShowAccessModal(false);
      setSelectedEmployee(null);
    } catch (error) {
      console.error('Erreur lors de l\'octroi d\'accès:', error);
    }
  };

  const handleRevokeDirectorAccess = async (employee: User) => {
    if (!currentUser) return;

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
    } catch (error) {
      console.error('Erreur lors de la révocation d\'accès:', error);
    }
  };

  const handleGrantAccessLevel = async (employee: User, levelId: string) => {
    if (!currentUser) return;

    try {
      const predefinedLevel = predefinedLevels[levelId];
      if (!predefinedLevel) return;

      const newAccessLevel: AccessLevel = {
        ...predefinedLevel,
        grantedBy: currentUser.id,
        grantedAt: serverTimestamp()
      };

      const currentAccessLevels = employee.accessLevels || [];
      const updatedAccessLevels = [...currentAccessLevels, newAccessLevel];

      const employeeRef = doc(db, 'users', employee.id);
      await updateDoc(employeeRef, {
        accessLevels: updatedAccessLevels,
        updatedAt: serverTimestamp()
      });

      setShowGrantModal(false);
      setSelectedEmployee(null);
      setSelectedAccessLevel('');
    } catch (error) {
      console.error('Erreur lors de l\'octroi du niveau d\'accès:', error);
    }
  };

  const handleRevokeAccessLevel = async (employee: User, levelId: string) => {
    if (!currentUser) return;

    try {
      const currentAccessLevels = employee.accessLevels || [];
      const updatedAccessLevels = currentAccessLevels.filter(level => level.id !== levelId);

      const employeeRef = doc(db, 'users', employee.id);
      await updateDoc(employeeRef, {
        accessLevels: updatedAccessLevels,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Erreur lors de la révocation du niveau d\'accès:', error);
    }
  };

  const getAccessLevelIcon = (level: number) => {
    switch (level) {
      case 1: return <Star className="h-4 w-4 text-blue-500" />;
      case 2: return <Shield className="h-4 w-4 text-green-500" />;
      case 3: return <Crown className="h-4 w-4 text-purple-500" />;
      default: return <Star className="h-4 w-4 text-gray-500" />;
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
          <Card key={employee.id} className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">{employee.name}</h3>
                  <p className="text-sm text-gray-500">{employee.email}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      employee.isApproved 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {employee.isApproved ? 'Approuvé' : 'En attente'}
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

              <div className="flex items-center space-x-2">
                {/* Niveaux d'accès */}
                <div className="flex items-center space-x-1">
                  {employee.accessLevels?.map((level) => (
                    <div
                      key={level.id}
                      className="flex items-center space-x-1 bg-gray-100 rounded-full px-2 py-1"
                    >
                      {getAccessLevelIcon(level.level)}
                      <span className="text-xs text-gray-600">{level.name}</span>
                      <button
                        onClick={() => handleRevokeAccessLevel(employee, level.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSelectedEmployee(employee);
                      setShowGrantModal(true);
                    }}
                  >
                    <UserPlus className="h-4 w-4 mr-1" />
                    Niveau
                  </Button>
                  
                  <Button
                    variant={employee.hasDirectorDashboardAccess ? "destructive" : "primary"}
                    size="sm"
                    onClick={() => {
                      setSelectedEmployee(employee);
                      setShowAccessModal(true);
                    }}
                  >
                    {employee.hasDirectorDashboardAccess ? (
                      <>
                        <EyeOff className="h-4 w-4 mr-1" />
                        Révoquer
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4 mr-1" />
                        Accès Directeur
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Modal d'octroi/révocation d'accès directeur */}
      {showAccessModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {selectedEmployee.hasDirectorDashboardAccess 
                ? 'Révoquer l\'accès au dashboard directeur' 
                : 'Accorder l\'accès au dashboard directeur'
              }
            </h3>
            <p className="text-gray-600 mb-6">
              {selectedEmployee.hasDirectorDashboardAccess 
                ? `Êtes-vous sûr de vouloir révoquer l'accès au dashboard directeur pour ${selectedEmployee.name} ?`
                : `Accorder l'accès au dashboard directeur à ${selectedEmployee.name} lui permettra de voir toutes les données de l'agence.`
              }
            </p>
            <div className="flex justify-end space-x-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowAccessModal(false);
                  setSelectedEmployee(null);
                }}
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
              >
                {selectedEmployee.hasDirectorDashboardAccess ? 'Révoquer' : 'Accorder'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal d'octroi de niveau d'accès */}
      {showGrantModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Accorder un niveau d'accès
            </h3>
            <p className="text-gray-600 mb-4">
              Sélectionnez un niveau d'accès pour {selectedEmployee.name} :
            </p>
            
            <div className="space-y-3 mb-6">
              {Object.values(predefinedLevels).map((level) => (
                <div
                  key={level.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedAccessLevel === level.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedAccessLevel(level.id)}
                >
                  <div className="flex items-center space-x-3">
                    {getAccessLevelIcon(level.level)}
                    <div>
                      <h4 className="font-medium text-gray-900">{level.name}</h4>
                      <p className="text-sm text-gray-600">{level.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end space-x-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowGrantModal(false);
                  setSelectedEmployee(null);
                  setSelectedAccessLevel('');
                }}
              >
                Annuler
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  if (selectedAccessLevel) {
                    handleGrantAccessLevel(selectedEmployee, selectedAccessLevel);
                  }
                }}
                disabled={!selectedAccessLevel}
              >
                Accorder
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

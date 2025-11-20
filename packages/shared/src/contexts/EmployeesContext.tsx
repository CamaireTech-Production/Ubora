import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { User } from '../types';
import { useAuth } from './AuthContext';

interface EmployeesContextType {
  employees: User[];
  getEmployeesForAgency: (agencyId: string) => User[];
  getPendingEmployees: () => User[];
  isLoading: boolean;
  error: string | null;
}

const EmployeesContext = createContext<EmployeesContextType | undefined>(undefined);

export const EmployeesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, firebaseUser } = useAuth();
  
  const [employees, setEmployees] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charger les employés depuis Firestore
  useEffect(() => {
    // Guard: Vérifier que l'utilisateur Firebase et le profil utilisateur sont chargés
    if (!firebaseUser || !user || !user.agencyId) {
      setEmployees([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Écouter les employés de l'agence (sans orderBy pour éviter les problèmes d'index)
    const employeesQuery = query(
      collection(db, 'users'),
      where('agencyId', '==', user.agencyId),
      where('role', '==', 'employe')
    );

    const unsubscribeEmployees = onSnapshot(employeesQuery, (snapshot) => {
      const employeesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as User[];
      
      // Sort employees by name in JavaScript
      employeesData.sort((a, b) => a.name.localeCompare(b.name));
      
      setEmployees(employeesData);
      setIsLoading(false);
    }, (err) => {
      console.error('Erreur lors du chargement des employés:', err);
      setError('Erreur lors du chargement des employés');
      setIsLoading(false);
    });

    return () => {
      unsubscribeEmployees();
    };
  }, [user, firebaseUser]);

  const getEmployeesForAgency = (agencyId: string): User[] => {
    return employees.filter(emp => emp.agencyId === agencyId);
  };

  const getPendingEmployees = (): User[] => {
    return employees.filter(emp => 
      emp.role === 'employe' && 
      emp.isApproved === false && 
      !emp.hasDirectorDashboardAccess
    );
  };

  return (
    <EmployeesContext.Provider value={{
      employees,
      getEmployeesForAgency,
      getPendingEmployees,
      isLoading,
      error
    }}>
      {children}
    </EmployeesContext.Provider>
  );
};

export const useEmployees = () => {
  const context = useContext(EmployeesContext);
  if (context === undefined) {
    // During initialization, return default values instead of throwing
    return {
      employees: [],
      getEmployeesForAgency: () => [],
      getPendingEmployees: () => [],
      isLoading: true,
      error: null
    };
  }
  return context;
};


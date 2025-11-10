import { useAuth } from '../contexts/AuthContext';
import { PermissionManager } from '../utils/PermissionManager';

/**
 * Hook pour gérer les permissions et niveaux d'accès
 */
export const usePermissions = () => {
  const { user } = useAuth();

  // Vérifier si l'utilisateur a une permission spécifique
  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    return PermissionManager.hasPermission(user, permission);
  };

  // Vérifier si l'utilisateur a accès au dashboard directeur
  const hasDirectorDashboardAccess = (): boolean => {
    if (!user) return false;
    return PermissionManager.hasDirectorDashboardAccess(user);
  };

  // Vérifier si l'utilisateur peut créer des formulaires
  const canCreateForms = (): boolean => {
    if (!user) return false;
    return PermissionManager.canCreateForms(user);
  };

  // Vérifier si l'utilisateur peut créer des tableaux de bord
  const canCreateDashboards = (): boolean => {
    if (!user) return false;
    return PermissionManager.canCreateDashboards(user);
  };

  // Vérifier si l'utilisateur peut gérer les formulaires d'autres employés
  const canManageEmployeeForms = (): boolean => {
    if (!user) return false;
    return PermissionManager.canManageEmployeeForms(user);
  };

  // Vérifier si l'utilisateur peut valider des formulaires
  const canValidateForms = (): boolean => {
    if (!user) return false;
    return PermissionManager.canValidateForms(user);
  };

  // Obtenir tous les niveaux d'accès de l'utilisateur
  const getUserAccessLevels = () => {
    if (!user) return [];
    return PermissionManager.getUserAccessLevels(user);
  };

  // Obtenir le niveau d'accès le plus élevé de l'utilisateur
  const getHighestAccessLevel = () => {
    if (!user) return null;
    return PermissionManager.getHighestAccessLevel(user);
  };

  // Vérifier si l'utilisateur peut accorder des niveaux d'accès
  const canGrantAccessLevels = (): boolean => {
    if (!user) return false;
    return user.role === 'directeur';
  };

  // Obtenir les permissions disponibles
  const getAvailablePermissions = () => {
    return PermissionManager.PERMISSIONS;
  };

  // Obtenir les niveaux d'accès prédéfinis
  const getPredefinedAccessLevels = () => {
    return PermissionManager.ACCESS_LEVELS;
  };

  return {
    // Fonctions de vérification de permissions
    hasPermission,
    hasDirectorDashboardAccess,
    canCreateForms,
    canCreateDashboards,
    canManageEmployeeForms,
    canValidateForms,
    canGrantAccessLevels,
    
    // Fonctions d'information
    getUserAccessLevels,
    getHighestAccessLevel,
    getAvailablePermissions,
    getPredefinedAccessLevels,
    
    // Informations sur l'utilisateur
    user,
    isDirector: user?.role === 'directeur',
    isEmployee: user?.role === 'employe'
  };
};

/**
 * Hook simplifié pour vérifier une permission spécifique
 */
export const usePermission = (permission: string) => {
  const { hasPermission } = usePermissions();
  return hasPermission(permission);
};

/**
 * Hook pour vérifier l'accès au dashboard directeur
 */
export const useDirectorDashboardAccess = () => {
  const { hasDirectorDashboardAccess } = usePermissions();
  return hasDirectorDashboardAccess();
};

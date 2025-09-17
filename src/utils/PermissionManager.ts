import { User, AccessLevel } from '../types';

export class PermissionManager {
  // Permissions disponibles dans le système
  static readonly PERMISSIONS = {
    // Permissions de base pour les employés
    CREATE_FORMS: 'create_forms',
    CREATE_DASHBOARDS: 'create_dashboards',
    VIEW_DIRECTOR_DASHBOARD: 'view_director_dashboard',
    MANAGE_OWN_FORMS: 'manage_own_forms',
    MANAGE_OWN_DASHBOARDS: 'manage_own_dashboards',
    
    // Permissions avancées (pour les niveaux supérieurs)
    VALIDATE_FORMS: 'validate_forms',
    MANAGE_EMPLOYEE_FORMS: 'manage_employee_forms',
    VIEW_ALL_ENTRIES: 'view_all_entries',
    EXPORT_DATA: 'export_data',
    
    // Permissions de direction (réservées aux directeurs)
    MANAGE_EMPLOYEES: 'manage_employees',
    MANAGE_ACCESS_LEVELS: 'manage_access_levels',
    VIEW_ANALYTICS: 'view_analytics',
    MANAGE_AGENCY: 'manage_agency'
  } as const;

  // Niveaux d'accès prédéfinis
  static readonly ACCESS_LEVELS: Record<string, AccessLevel> = {
    L1_BASIC: {
      id: 'l1_basic',
      name: 'Accès de base',
      level: 1,
      permissions: [
        PermissionManager.PERMISSIONS.CREATE_FORMS,
        PermissionManager.PERMISSIONS.CREATE_DASHBOARDS,
        PermissionManager.PERMISSIONS.MANAGE_OWN_FORMS,
        PermissionManager.PERMISSIONS.MANAGE_OWN_DASHBOARDS
      ],
      grantedBy: '',
      grantedAt: new Date(),
      description: 'Peut créer et gérer ses propres formulaires et tableaux de bord'
    },
    L2_DIRECTOR_ACCESS: {
      id: 'l2_director_access',
      name: 'Accès au dashboard directeur',
      level: 2,
      permissions: [
        PermissionManager.PERMISSIONS.CREATE_FORMS,
        PermissionManager.PERMISSIONS.CREATE_DASHBOARDS,
        PermissionManager.PERMISSIONS.MANAGE_OWN_FORMS,
        PermissionManager.PERMISSIONS.MANAGE_OWN_DASHBOARDS,
        PermissionManager.PERMISSIONS.VIEW_DIRECTOR_DASHBOARD
      ],
      grantedBy: '',
      grantedAt: new Date(),
      description: 'Peut accéder au dashboard directeur et voir toutes les données de l\'agence'
    },
    L3_VALIDATOR: {
      id: 'l3_validator',
      name: 'Validateur',
      level: 3,
      permissions: [
        PermissionManager.PERMISSIONS.CREATE_FORMS,
        PermissionManager.PERMISSIONS.CREATE_DASHBOARDS,
        PermissionManager.PERMISSIONS.MANAGE_OWN_FORMS,
        PermissionManager.PERMISSIONS.MANAGE_OWN_DASHBOARDS,
        PermissionManager.PERMISSIONS.VIEW_DIRECTOR_DASHBOARD,
        PermissionManager.PERMISSIONS.VALIDATE_FORMS,
        PermissionManager.PERMISSIONS.MANAGE_EMPLOYEE_FORMS,
        PermissionManager.PERMISSIONS.VIEW_ALL_ENTRIES
      ],
      grantedBy: '',
      grantedAt: new Date(),
      description: 'Peut valider et gérer les formulaires des autres employés'
    }
  };

  /**
   * Vérifie si un utilisateur a une permission spécifique
   */
  static hasPermission(user: User, permission: string): boolean {
    // Les directeurs ont toutes les permissions
    if (user.role === 'directeur') {
      return true;
    }

    // Vérifier les permissions des employés
    if (user.role === 'employe') {
      // Vérifier les niveaux d'accès
      if (user.accessLevels) {
        for (const accessLevel of user.accessLevels) {
          if (accessLevel.permissions.includes(permission)) {
            return true;
          }
        }
      }

      // Vérifier l'accès au dashboard directeur
      if (permission === PermissionManager.PERMISSIONS.VIEW_DIRECTOR_DASHBOARD) {
        return user.hasDirectorDashboardAccess === true;
      }
    }

    return false;
  }

  /**
   * Vérifie si un employé a accès au dashboard directeur
   */
  static hasDirectorDashboardAccess(user: User): boolean {
    if (user.role === 'directeur') {
      return true;
    }

    if (user.role === 'employe') {
      return user.hasDirectorDashboardAccess === true;
    }

    return false;
  }

  /**
   * Obtient tous les niveaux d'accès d'un utilisateur
   */
  static getUserAccessLevels(user: User): AccessLevel[] {
    if (user.role === 'directeur') {
      // Les directeurs ont tous les niveaux
      return Object.values(PermissionManager.ACCESS_LEVELS);
    }

    return user.accessLevels || [];
  }

  /**
   * Obtient le niveau d'accès le plus élevé d'un utilisateur
   */
  static getHighestAccessLevel(user: User): AccessLevel | null {
    const accessLevels = PermissionManager.getUserAccessLevels(user);
    
    if (accessLevels.length === 0) {
      return null;
    }

    return accessLevels.reduce((highest, current) => 
      current.level > highest.level ? current : highest
    );
  }

  /**
   * Vérifie si un utilisateur peut créer des formulaires
   */
  static canCreateForms(user: User): boolean {
    return PermissionManager.hasPermission(user, PermissionManager.PERMISSIONS.CREATE_FORMS);
  }

  /**
   * Vérifie si un utilisateur peut créer des tableaux de bord
   */
  static canCreateDashboards(user: User): boolean {
    return PermissionManager.hasPermission(user, PermissionManager.PERMISSIONS.CREATE_DASHBOARDS);
  }

  /**
   * Vérifie si un utilisateur peut gérer les formulaires d'autres employés
   */
  static canManageEmployeeForms(user: User): boolean {
    return PermissionManager.hasPermission(user, PermissionManager.PERMISSIONS.MANAGE_EMPLOYEE_FORMS);
  }

  /**
   * Vérifie si un utilisateur peut valider des formulaires
   */
  static canValidateForms(user: User): boolean {
    return PermissionManager.hasPermission(user, PermissionManager.PERMISSIONS.VALIDATE_FORMS);
  }

  /**
   * Obtient les permissions d'un niveau d'accès
   */
  static getAccessLevelPermissions(levelId: string): string[] {
    const accessLevel = PermissionManager.ACCESS_LEVELS[levelId];
    return accessLevel ? accessLevel.permissions : [];
  }

  /**
   * Crée un niveau d'accès personnalisé
   */
  static createCustomAccessLevel(
    name: string,
    level: number,
    permissions: string[],
    grantedBy: string,
    description?: string
  ): AccessLevel {
    return {
      id: `custom_${Date.now()}`,
      name,
      level,
      permissions,
      grantedBy,
      grantedAt: new Date(),
      description
    };
  }

  /**
   * Vérifie si un utilisateur peut accorder un niveau d'accès à un autre utilisateur
   */
  static canGrantAccessLevel(granter: User, targetUser: User): boolean {
    // Seuls les directeurs peuvent accorder des niveaux d'accès
    if (granter.role !== 'directeur') {
      return false;
    }

    // Un directeur ne peut accorder des niveaux qu'aux employés de son agence
    if (targetUser.agencyId !== granter.agencyId) {
      return false;
    }

    // Un directeur ne peut pas accorder des niveaux à un autre directeur
    if (targetUser.role === 'directeur') {
      return false;
    }

    return true;
  }
}

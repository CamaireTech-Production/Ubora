import { useAuth } from '../contexts/AuthContext';
import { UserSessionService } from '../services/userSessionService';
import { 
  PackageType, 
  PackageFeatures, 
  PackageLimits,
  PACKAGE_LIMITS
} from '../config/packageFeatures';
import { useState, useEffect, useMemo } from 'react';
import { db } from '../firebaseConfig';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useTokenStats } from './useTokenStats';
import { UniversResourceService } from '../services/universResourceService';
import { universService } from '../services/universService';

// Hook principal pour vérifier l'accès aux fonctionnalités
export const usePackageAccess = () => {
  const { user } = useAuth();
  const tokenStats = useTokenStats(user?.id);
  const [directorPackageInfo, setDirectorPackageInfo] = useState<any>(null);
  const [isLoadingDirectorInfo, setIsLoadingDirectorInfo] = useState(false);

  const [userPackageInfo, setUserPackageInfo] = useState<any>(null);
  const [isLoadingUserPackageInfo, setIsLoadingUserPackageInfo] = useState(false);
  const [hasActiveUnivers, setHasActiveUnivers] = useState<boolean>(false);

  // Check if user has an active univers
  useEffect(() => {
    const checkActiveUnivers = async () => {
      if (!user || user.role !== 'directeur' || !user.agencyId) {
        setHasActiveUnivers(false);
        return;
      }

      try {
        const activeUnivers = await universService.getActiveUnivers(user.id, user.agencyId);
        setHasActiveUnivers(activeUnivers !== null);
      } catch (error) {
        console.error('Error checking active univers:', error);
        setHasActiveUnivers(false);
      }
    };

    checkActiveUnivers();
  }, [user]);

  // Get current package info from active session (async)
  useEffect(() => {
    const fetchUserPackageInfo = async () => {
      if (!user) {
        setUserPackageInfo(null);
        return;
      }

      // For employees with director access, use the director's package info if available
      if (user.role === 'employe' && user.hasDirectorDashboardAccess && directorPackageInfo) {
        setUserPackageInfo(directorPackageInfo);
        return;
      }

      setIsLoadingUserPackageInfo(true);
      try {
        const info = await UserSessionService.getUserPackageInfo(user);
        setUserPackageInfo(info);
      } catch (error) {
        console.error('Error fetching user package info:', error);
        setUserPackageInfo(null);
      } finally {
        setIsLoadingUserPackageInfo(false);
      }
    };

    fetchUserPackageInfo();
  }, [user, directorPackageInfo]);

  // Fetch director's package info for employees with director access
  useEffect(() => {
    
    const fetchDirectorPackageInfo = async () => {
      if (!user || user.role !== 'employe' || !user.hasDirectorDashboardAccess) {
        return;
      }

      setIsLoadingDirectorInfo(true);
      try {
        // Find the director of the employee's agency
        const directorsQuery = query(
          collection(db, 'users'),
          where('agencyId', '==', user.agencyId),
          where('role', '==', 'directeur')
        );
        
        const directorsSnapshot = await getDocs(directorsQuery);
        
        if (!directorsSnapshot.empty) {
          const directorData = directorsSnapshot.docs[0].data() as any;
          const directorInfo = await UserSessionService.getUserPackageInfo(directorData);
          setDirectorPackageInfo(directorInfo);
        }
      } catch (error) {
        console.error('Error fetching director package info:', error);
      } finally {
        setIsLoadingDirectorInfo(false);
        console.log('📦 [DEBUG] Director package info fetch completed');
      }
    };

    fetchDirectorPackageInfo();
  }, [user]);

  // Merge token stats override into package info so UI reflects live usage without mutating user doc
  const packageInfo = useMemo(() => {
    const base = userPackageInfo;
    if (!base) return null;
    if (tokenStats && typeof tokenStats.tokensUsedMonthly === 'number' && base.totalTokens > 0) {
      // Combine chat usage from active session (base.tokensUsed)
      // with extraction usage from stats/current (tokenStats.tokensUsedMonthly)
      const combinedUsed = (base.tokensUsed || 0) + (tokenStats.tokensUsedMonthly || 0);
      const tokensUsed = Math.max(0, Math.min(base.totalTokens, combinedUsed));
      return {
        ...base,
        tokensUsed,
        tokensRemaining: Math.max(0, base.totalTokens - tokensUsed)
      };
    }
    return base;
  }, [userPackageInfo, tokenStats]);
  const currentPackageType = packageInfo?.packageType || null;

  // Vérifier si l'utilisateur a accès à une fonctionnalité spécifique
  const hasFeature = (feature: keyof PackageFeatures): boolean => {
    if (!user) return false;
    return UserSessionService.hasFeature(user, feature);
  };

  // Vérifier si l'utilisateur respecte une limite spécifique (incluant pay-as-you-go)
  const checkLimit = (limit: keyof PackageLimits, currentValue: number): boolean => {
    if (!user) return false;
    
    let limitValue: number;
    
    // For employees with director access, use director's package limits if available
    if (user.role === 'employe' && user.hasDirectorDashboardAccess && directorPackageInfo) {
      const packageLimits = directorPackageInfo.packageLimits || {};
      // Handle the mismatch between maxTokens and monthlyTokens
      if (limit === 'monthlyTokens') {
        limitValue = packageLimits.maxTokens || 0;
      } else if (limit === 'additionalUserCost') {
        // additionalUserCost is not returned by getPackageLimits, get it from package config
        const packageType = directorPackageInfo.packageType as PackageType;
        if (packageType && packageType in PACKAGE_LIMITS) {
          const packageConfig = PACKAGE_LIMITS[packageType];
          limitValue = packageConfig?.additionalUserCost || 0;
        } else {
          limitValue = 0;
        }
      } else {
        limitValue = packageLimits[limit] || 0;
      }
    } else {
      const limits = UserSessionService.getPackageLimits(user);
      // Handle the mismatch between maxTokens and monthlyTokens
      if (limit === 'monthlyTokens') {
        limitValue = limits.maxTokens || 0;
      } else if (limit === 'additionalUserCost') {
        // additionalUserCost is not returned by getPackageLimits, get it from package config
        const packageInfo = UserSessionService.getUserPackageInfo(user);
        const packageType = packageInfo?.packageType as PackageType;
        if (packageType && packageType in PACKAGE_LIMITS) {
          const packageConfig = PACKAGE_LIMITS[packageType];
          limitValue = packageConfig?.additionalUserCost || 0;
        } else {
          limitValue = 0;
        }
      } else {
        limitValue = limits[limit] || 0;
      }
    }
    
    // Si la limite est illimitée (-1), toujours autoriser
    if (limitValue === -1) {
      return true;
    }
    
    return currentValue < limitValue;
  };

  // Obtenir la valeur d'une limite
  const getLimit = (limit: keyof PackageLimits): number => {
    if (!user) return 0;
    
    // Get package type from userPackageInfo or directorPackageInfo
    let packageType: PackageType | null = null;
    
    // For employees with director access, use director's package type
    if (user.role === 'employe' && user.hasDirectorDashboardAccess) {
      packageType = directorPackageInfo?.packageType as PackageType || null;
    } else if (user.role === 'directeur') {
      // For directors, use their own package type
      packageType = (userPackageInfo?.packageType || packageInfo?.packageType) as PackageType || null;
    }
    
    // If we have a package type, get limits directly from PACKAGE_LIMITS
    if (packageType && packageType in PACKAGE_LIMITS) {
      const packageConfig = PACKAGE_LIMITS[packageType];
      // Handle the mismatch between maxTokens and monthlyTokens
      if (limit === 'monthlyTokens') {
        return packageConfig.monthlyTokens === -1 ? -1 : packageConfig.monthlyTokens;
      } else if (limit === 'additionalUserCost') {
        return packageConfig.additionalUserCost || 0;
      } else {
        // Return the limit value, preserving -1 for unlimited
        const limitValue = packageConfig[limit];
        return limitValue === -1 ? -1 : (limitValue || 0);
      }
    }
    
    // Fallback: use getPackageLimits (may use old system, but preserves -1)
    const limits = UserSessionService.getPackageLimits(user);
    // Handle the mismatch between maxTokens and monthlyTokens
    if (limit === 'monthlyTokens') {
      return limits.maxTokens || 0;
    } else if (limit === 'additionalUserCost') {
      // additionalUserCost is not returned by getPackageLimits, get it from package config
      // Try to get package type from userPackageInfo or from session
      const fallbackPackageType = (userPackageInfo?.packageType || packageInfo?.packageType) as PackageType;
      if (fallbackPackageType && fallbackPackageType in PACKAGE_LIMITS) {
        const packageConfig = PACKAGE_LIMITS[fallbackPackageType];
        return packageConfig?.additionalUserCost || 0;
      } else {
        return 0;
      }
    } else {
      // Return the limit value, preserving -1 for unlimited
      const limitValue = limits[limit];
      return limitValue === -1 ? -1 : (limitValue || 0);
    }
  };

  // Vérifier si une limite est illimitée
  const isLimitUnlimited = (limit: keyof PackageLimits): boolean => {
    if (!user) return false;
    
    // For employees with director access, use director's package limits if available
    if (user.role === 'employe' && user.hasDirectorDashboardAccess && directorPackageInfo) {
      const packageLimits = directorPackageInfo.packageLimits || {};
      // Handle the mismatch between maxTokens and monthlyTokens
      if (limit === 'monthlyTokens') {
        return packageLimits.maxTokens === -1;
      } else if (limit === 'additionalUserCost') {
        // additionalUserCost is never unlimited
        return false;
      } else {
        return packageLimits[limit] === -1;
      }
    }
    
    const limits = UserSessionService.getPackageLimits(user);
    // Handle the mismatch between maxTokens and monthlyTokens
    if (limit === 'monthlyTokens') {
      return limits.maxTokens === -1;
    } else if (limit === 'additionalUserCost') {
      // additionalUserCost is never unlimited
      return false;
    } else {
      return limits[limit] === -1;
    }
  };

  // Obtenir le type de package de l'utilisateur
  const getPackageType = (): PackageType | null => {
    return currentPackageType;
  };

  // Vérifier si l'utilisateur peut créer un nouveau formulaire
  const canCreateForm = (currentFormCount: number): boolean => {
    if (!user) return false;
    
    // Si un univers actif existe, autoriser la création (la ressource sera créée dans l'univers actif)
    // Les ressources dans un univers actif peuvent dépasser les limites du package
    if (user.role === 'directeur' && user.agencyId && hasActiveUnivers) {
      return true;
    }
    
    // For employees with director access, use director's package limits if available
    if (user.role === 'employe' && user.hasDirectorDashboardAccess) {
      // If still loading director info, allow creation (will be validated later)
      if (isLoadingDirectorInfo) {
        return true;
      }
      
      if (directorPackageInfo) {
        const packageLimits = directorPackageInfo.packageLimits || {};
        const maxForms = packageLimits.maxForms || 0;
        return maxForms === -1 || currentFormCount < maxForms;
      }
      
      // If we have director access but no package info yet, allow creation
      // This prevents the modal from showing while the director's info is being fetched
      return true;
    }
    
    return UserSessionService.canPerformAction(user, 'createForm', currentFormCount);
  };

  // Vérifier si l'utilisateur peut créer un nouveau tableau de bord
  const canCreateDashboard = (currentDashboardCount: number): boolean => {
    if (!user) return false;
    
    // Si un univers actif existe, autoriser la création (la ressource sera créée dans l'univers actif)
    // Les ressources dans un univers actif peuvent dépasser les limites du package
    if (user.role === 'directeur' && user.agencyId && hasActiveUnivers) {
      return true;
    }
    
    // For employees with director access, use director's package limits if available
    if (user.role === 'employe' && user.hasDirectorDashboardAccess) {
      // If still loading director info, allow creation (will be validated later)
      if (isLoadingDirectorInfo) {
        return true;
      }
      
      if (directorPackageInfo) {
        const packageLimits = directorPackageInfo.packageLimits || {};
        const maxDashboards = packageLimits.maxDashboards || 0;
        return maxDashboards === -1 || currentDashboardCount < maxDashboards;
      }
      
      // If we have director access but no package info yet, allow creation
      // This prevents the modal from showing while the director's info is being fetched
      return true;
    }
    
    return UserSessionService.canPerformAction(user, 'createDashboard', currentDashboardCount);
  };

  // Vérifier si l'utilisateur peut ajouter un nouvel utilisateur
  const canAddUser = (currentUserCount: number): boolean => {
    if (!user) return false;
    
    // Use getLimit which correctly handles unlimited (-1) case
    const maxUsers = getLimit('maxUsers');
    
    // Handle unlimited case (-1) - always allow if unlimited
    if (maxUsers === -1) {
      return true;
    }
    
    // Check if current count is below limit
    return currentUserCount < maxUsers;
  };

  // Obtenir le nombre de tokens mensuels disponibles
  const getMonthlyTokens = (): number => {
    if (!user) return 0;
    const limits = UserSessionService.getPackageLimits(user);
    return limits.maxTokens;
  };

  // Vérifier si l'utilisateur a des tokens illimités
  const hasUnlimitedTokens = (): boolean => {
    if (!user) return false;
    const limits = UserSessionService.getPackageLimits(user);
    return limits.maxTokens === -1;
  };

  // Vérifier si l'utilisateur peut utiliser une fonctionnalité IA avancée
  const canUseAdvancedAI = (): boolean => {
    return hasFeature('advancedAI') || hasFeature('predictiveAI');
  };

  // Vérifier si l'utilisateur peut utiliser le branding personnalisé
  const canUseCustomBranding = (): boolean => {
    return hasFeature('customBranding');
  };

  // Vérifier si l'utilisateur peut utiliser les intégrations personnalisées
  const canUseCustomIntegrations = (): boolean => {
    return hasFeature('customIntegrations');
  };

  // Obtenir le coût d'un utilisateur supplémentaire
  const getAdditionalUserCost = (): number => {
    return getLimit('additionalUserCost');
  };

  // Obtenir la capacité pay-as-you-go pour un type de limite
  const getPayAsYouGoCapacity = (limit: keyof PackageLimits): number => {
    if (!user) return 0;
    
    // For tokens, get from pay-as-you-go sessions
    if (limit === 'monthlyTokens') {
      return UserSessionService.getTotalPayAsYouGoTokens(user);
    }
    
    // For other limits, we don't have pay-as-you-go capacity in the new system
    return 0;
  };

  // Obtenir la limite totale (package + pay-as-you-go)
  const getTotalLimit = (limit: keyof PackageLimits): number => {
    const packageLimit = getLimit(limit);
    if (packageLimit === -1) return -1; // Unlimited
    
    const payAsYouGoCapacity = getPayAsYouGoCapacity(limit);
    return packageLimit + payAsYouGoCapacity;
  };

  return {
    // Fonctions de base
    hasFeature,
    checkLimit,
    getLimit,
    isLimitUnlimited,
    getPackageType,
    
    // Loading state for director info
    isLoadingDirectorInfo,
    
    // Fonctions spécifiques aux formulaires
    canCreateForm,
    canCreateDashboard,
    canAddUser,
    
    // Fonctions spécifiques aux tokens
    getMonthlyTokens,
    hasUnlimitedTokens,
    
    // Fonctions spécifiques aux fonctionnalités
    canUseAdvancedAI,
    canUseCustomBranding,
    canUseCustomIntegrations,
    
    // Fonctions de coût
    getAdditionalUserCost,
    
    // Fonctions pay-as-you-go
    getPayAsYouGoCapacity,
    getTotalLimit,
    
    // Informations sur l'utilisateur
    user,
    packageType: currentPackageType,
    packageInfo: packageInfo
  };
};

// Hook simplifié pour vérifier une fonctionnalité spécifique
export const useFeatureAccess = (feature: keyof PackageFeatures) => {
  const { hasFeature } = usePackageAccess();
  return hasFeature(feature);
};

// Hook pour vérifier les limites
export const usePackageLimits = () => {
  const { checkLimit, getLimit, isLimitUnlimited } = usePackageAccess();
  
  return {
    checkLimit,
    getLimit,
    isLimitUnlimited
  };
};

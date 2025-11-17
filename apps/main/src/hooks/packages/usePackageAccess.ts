import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { UserSessionService, type UserPackageInfo } from '@ubora/shared/services/userSessionService';
import {
  PackageType,
  PackageFeatures,
  PackageLimits,
  PACKAGE_LIMITS
} from '@ubora/shared/config/packageFeatures';
import { useState, useEffect, useMemo } from 'react';
import { db } from '@ubora/shared/firebaseConfig';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useTokenStats } from '../../hooks/core/useTokenStats';

type NumericPackageLimit = 'maxForms' | 'maxDashboards' | 'maxUsers' | 'monthlyTokens' | 'additionalUserCost';

type PackageLimitData = {
  maxForms?: number;
  maxDashboards?: number;
  maxUsers?: number;
  maxTokens?: number;
};

const SUPPORTED_PACKAGE_TYPES: PackageType[] = ['free', 'starter', 'standard'];

const normalizePackageType = (value?: string | null): PackageType | null => {
  if (!value) return null;
  return SUPPORTED_PACKAGE_TYPES.includes(value as PackageType) ? (value as PackageType) : null;
};

const getPackageLimitsData = (info: UserPackageInfo | null): PackageLimitData =>
  ((info as any)?.packageLimits || {}) as PackageLimitData;

const getAdditionalUserCostFromInfo = (info: UserPackageInfo | null): number => {
  const normalizedType = normalizePackageType(info?.packageType ?? null);
  if (normalizedType && PACKAGE_LIMITS[normalizedType]) {
    return PACKAGE_LIMITS[normalizedType].additionalUserCost || 0;
  }
  return 0;
};

const resolveLimitValue = (info: UserPackageInfo | null, limit: NumericPackageLimit): number => {
  const limits = getPackageLimitsData(info);
  switch (limit) {
    case 'monthlyTokens':
      return limits.maxTokens ?? 0;
    case 'additionalUserCost':
      return getAdditionalUserCostFromInfo(info);
    case 'maxForms':
      return limits.maxForms ?? 0;
    case 'maxDashboards':
      return limits.maxDashboards ?? 0;
    case 'maxUsers':
      return limits.maxUsers ?? 0;
    default:
      return 0;
  }
};

// Hook principal pour vérifier l'accès aux fonctionnalités
export const usePackageAccess = () => {
  const { user } = useAuth();
  const tokenStats = useTokenStats(user?.id);
  const [directorPackageInfo, setDirectorPackageInfo] = useState<UserPackageInfo | null>(null);
  const [isLoadingDirectorInfo, setIsLoadingDirectorInfo] = useState(false);
  const [packageInfo, setPackageInfo] = useState<UserPackageInfo | null>(null);
  const [isLoadingPackageInfo, setIsLoadingPackageInfo] = useState(false);
  const NUMERIC_LIMIT_KEYS: NumericPackageLimit[] = ['maxForms', 'maxDashboards', 'maxUsers', 'monthlyTokens', 'additionalUserCost'];
  const isNumericLimit = (limit: keyof PackageLimits): limit is NumericPackageLimit =>
    NUMERIC_LIMIT_KEYS.includes(limit as NumericPackageLimit);

  // Fetch director's package info for employees with director access
  useEffect(() => {
    let isMounted = true;
    const fetchDirectorPackageInfo = async () => {
      if (!user || user.role !== 'employe' || !user.hasDirectorDashboardAccess) {
        if (isMounted) {
          setDirectorPackageInfo(null);
        }
        return;
      }

      setIsLoadingDirectorInfo(true);
      try {
        const directorsQuery = query(
          collection(db, 'users'),
          where('agencyId', '==', user.agencyId),
          where('role', '==', 'directeur')
        );

        const directorsSnapshot = await getDocs(directorsQuery);

        if (!directorsSnapshot.empty) {
          const directorDoc = directorsSnapshot.docs[0];
          const directorData = { id: directorDoc.id, ...(directorDoc.data() as any) };
          const directorInfo = await UserSessionService.getUserPackageInfo(directorData as any);
          if (isMounted) {
            setDirectorPackageInfo(directorInfo);
          }
        }
      } catch (error) {
        console.error('Error fetching director package info:', error);
      } finally {
        if (isMounted) {
          setIsLoadingDirectorInfo(false);
        }
      }
    };

    fetchDirectorPackageInfo();

    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    let isMounted = true;

    const loadPackageInfo = async () => {
      if (!user) {
        if (isMounted) {
          setPackageInfo(null);
        }
        return;
      }

      setIsLoadingPackageInfo(true);
      try {
        if (user.role === 'employe' && user.hasDirectorDashboardAccess && directorPackageInfo) {
          if (isMounted) {
            setPackageInfo(directorPackageInfo);
          }
          return;
        }

        const info = await UserSessionService.getUserPackageInfo(user);
        if (isMounted) {
          setPackageInfo(info);
        }
      } catch (error) {
        console.error('Error loading package info:', error);
        if (isMounted) {
          setPackageInfo(null);
        }
      } finally {
        if (isMounted) {
          setIsLoadingPackageInfo(false);
        }
      }
    };

    loadPackageInfo();

    return () => {
      isMounted = false;
    };
  }, [user, directorPackageInfo]);

  // Merge token stats override into package info so UI reflects live usage without mutating user doc
  const enhancedPackageInfo = useMemo(() => {
    if (!packageInfo) return null;
    if (tokenStats && typeof tokenStats.tokensUsedMonthly === 'number' && packageInfo.totalTokens > 0) {
      const combinedUsed = (packageInfo.tokensUsed || 0) + (tokenStats.tokensUsedMonthly || 0);
      const tokensUsed = Math.max(0, Math.min(packageInfo.totalTokens, combinedUsed));
      return {
        ...packageInfo,
        tokensUsed,
        tokensRemaining: Math.max(0, packageInfo.totalTokens - tokensUsed)
      };
    }
    return packageInfo;
  }, [packageInfo, tokenStats]);
  const currentPackageType = enhancedPackageInfo?.packageType || null;

  const getActivePackageInfo = (): UserPackageInfo | null => {
    if (!user) return null;
    if (user.role === 'employe' && user.hasDirectorDashboardAccess) {
      return directorPackageInfo || enhancedPackageInfo;
    }
    return enhancedPackageInfo;
  };

  const resolveLimitValueWithFallback = (limit: NumericPackageLimit): number => {
    const activeInfo = getActivePackageInfo();
    if (activeInfo) {
      return resolveLimitValue(activeInfo, limit);
    }
    if (!user) return 0;
    const fallback = UserSessionService.getPackageLimits(user) as Record<string, number | undefined>;
    if (limit === 'monthlyTokens') {
      return fallback.maxTokens || 0;
    }
    if (limit === 'additionalUserCost') {
      const normalized = normalizePackageType((user as any)?.package ?? null);
      if (normalized && PACKAGE_LIMITS[normalized]) {
        return PACKAGE_LIMITS[normalized].additionalUserCost || 0;
      }
      return 0;
    }
    return fallback[limit] || 0;
  };

  // Vérifier si l'utilisateur a accès à une fonctionnalité spécifique
  const hasFeature = (feature: keyof PackageFeatures): boolean => {
    if (!user) return false;
    return UserSessionService.hasFeature(user, feature);
  };

  // Vérifier si l'utilisateur respecte une limite spécifique (incluant pay-as-you-go)
  const checkLimit = (limit: keyof PackageLimits, currentValue: number): boolean => {
    if (!user) return false;
    if (!isNumericLimit(limit)) return true;
    const limitValue = resolveLimitValueWithFallback(limit);
    if (limitValue === -1) {
      return true;
    }
    if (limit === 'additionalUserCost') {
      return limitValue > 0;
    }
    return currentValue < limitValue;
  };

  // Obtenir la valeur d'une limite
  const getLimit = (limit: keyof PackageLimits): number => {
    if (!isNumericLimit(limit)) return 0;
    return resolveLimitValueWithFallback(limit);
  };

  // Vérifier si une limite est illimitée
  const isLimitUnlimited = (limit: keyof PackageLimits): boolean => {
    if (!isNumericLimit(limit) || limit === 'additionalUserCost') return false;
    const limitValue = resolveLimitValueWithFallback(limit);
    return limitValue === -1;
  };

  // Obtenir le type de package de l'utilisateur
  const getPackageType = (): PackageType | null => {
    return currentPackageType;
  };

  // Vérifier si l'utilisateur peut créer un nouveau formulaire
  const canCreateForm = (currentFormCount: number): boolean => {
    if (!user) return false;
    
    // For employees with director access, use director's package limits if available
    if (user.role === 'employe' && user.hasDirectorDashboardAccess) {
      // If still loading director info, allow creation (will be validated later)
      if (isLoadingDirectorInfo) {
        return true;
      }
      
      if (directorPackageInfo) {
        const packageLimits = getPackageLimitsData(directorPackageInfo);
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
    
    // For employees with director access, use director's package limits if available
    if (user.role === 'employe' && user.hasDirectorDashboardAccess) {
      // If still loading director info, allow creation (will be validated later)
      if (isLoadingDirectorInfo) {
        return true;
      }
      
      if (directorPackageInfo) {
        const packageLimits = getPackageLimitsData(directorPackageInfo);
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
    
    // For employees with director access, use director's package limits if available
    if (user.role === 'employe' && user.hasDirectorDashboardAccess) {
      // If still loading director info, allow creation (will be validated later)
      if (isLoadingDirectorInfo) {
        return true;
      }
      
      if (directorPackageInfo) {
        const packageLimits = getPackageLimitsData(directorPackageInfo);
        const maxUsers = packageLimits.maxUsers || 0;
        return maxUsers === -1 || currentUserCount < maxUsers;
      }
      
      // If we have director access but no package info yet, allow creation
      // This prevents the modal from showing while the director's info is being fetched
      return true;
    }
    
    return UserSessionService.canPerformAction(user, 'addUser', currentUserCount);
  };

  // Obtenir le nombre de tokens mensuels disponibles
  const getMonthlyTokens = (): number => resolveLimitValueWithFallback('monthlyTokens');

  // Vérifier si l'utilisateur a des tokens illimités
  const hasUnlimitedTokens = (): boolean => resolveLimitValueWithFallback('monthlyTokens') === -1;

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
  const getAdditionalUserCost = (): number => resolveLimitValueWithFallback('additionalUserCost');

  // Obtenir la capacité pay-as-you-go pour un type de limite
  const getPayAsYouGoCapacity = (limit: keyof PackageLimits): number => {
    if (!user) return 0;
    if (limit !== 'monthlyTokens') {
      return 0;
    }
    return UserSessionService.getTotalPayAsYouGoTokens(user);
  };

  // Obtenir la limite totale (package + pay-as-you-go)
  const getTotalLimit = (limit: keyof PackageLimits): number => {
    if (!isNumericLimit(limit)) return 0;
    const packageLimit = getLimit(limit);
    if (packageLimit === -1) return -1;
    const payg = limit === 'monthlyTokens' ? getPayAsYouGoCapacity(limit) : 0;
    return packageLimit + payg;
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
    packageInfo: enhancedPackageInfo,
    isLoadingPackageInfo: isLoadingPackageInfo || (user?.role === 'employe' && user.hasDirectorDashboardAccess ? isLoadingDirectorInfo : false)
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

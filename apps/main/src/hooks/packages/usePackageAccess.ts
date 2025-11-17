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
  if (!info) return 0;
  
  switch (limit) {
    case 'monthlyTokens':
      return info.totalTokens ?? 0;
    case 'additionalUserCost':
      return getAdditionalUserCostFromInfo(info);
    case 'maxForms':
      return info.totalForms ?? 0;
    case 'maxDashboards':
      return info.totalDashboards ?? 0;
    case 'maxUsers':
      return info.totalUsers ?? 0;
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
    return 0;
  };

  // Vérifier si l'utilisateur a accès à une fonctionnalité spécifique
  const hasFeature = (feature: keyof PackageFeatures): boolean => {
    if (!user) return false;
    
    // Use package info from hook instead of calling service
    const activeInfo = getActivePackageInfo();
    if (activeInfo && activeInfo.packageFeatures) {
      return activeInfo.packageFeatures.includes(feature as string);
    }
    
    return false;
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
    console.log('🟡 [CAN CREATE FORM] ========================================');
    console.log('🟡 [CAN CREATE FORM] Checking quota for form creation');
    console.log('🟡 [CAN CREATE FORM] Current form count:', currentFormCount);
    
    if (!user) {
      console.log('🟡 [CAN CREATE FORM] ❌ No user found - returning false');
      return false;
    }
    
    console.log('🟡 [CAN CREATE FORM] User details:', {
      id: user.id,
      role: user.role,
      agencyId: user.agencyId,
      hasDirectorDashboardAccess: user.hasDirectorDashboardAccess
    });
    
    // For employees with director access, use director's package limits if available
    if (user.role === 'employe' && user.hasDirectorDashboardAccess) {
      console.log('🟡 [CAN CREATE FORM] Employee with director access detected');
      console.log('🟡 [CAN CREATE FORM] Loading director info:', isLoadingDirectorInfo);
      
      // If still loading director info, allow creation (will be validated later)
      if (isLoadingDirectorInfo) {
        console.log('🟡 [CAN CREATE FORM] ⏳ Director info still loading - allowing (will validate later)');
        return true;
      }
      
      if (directorPackageInfo) {
        console.log('🟡 [CAN CREATE FORM] Director package info found:', {
          packageType: directorPackageInfo.packageType,
          totalForms: directorPackageInfo.totalForms
        });
        const maxForms = directorPackageInfo.totalForms || 0;
        const canCreate = maxForms === -1 || currentFormCount < maxForms;
        console.log('🟡 [CAN CREATE FORM] Director limits check:', {
          maxForms,
          currentFormCount,
          isUnlimited: maxForms === -1,
          canCreate
        });
        return canCreate;
      }
      
      // If we have director access but no package info yet, allow creation
      // This prevents the modal from showing while the director's info is being fetched
      console.log('🟡 [CAN CREATE FORM] ⚠️ Director access but no package info yet - allowing (will validate later)');
      return true;
    }
    
    const maxForms = getLimit('maxForms');
    const canCreate = maxForms === -1 || currentFormCount < maxForms;
    console.log('🟡 [CAN CREATE FORM] Package limit check:', {
      maxForms,
      currentFormCount,
      canCreate,
      isLoadingPackageInfo
    });
    console.log('🟡 [CAN CREATE FORM] ========================================');
    if (maxForms === 0 && isLoadingPackageInfo) {
      return true;
    }
    return canCreate;
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
        const maxDashboards = directorPackageInfo.totalDashboards || 0;
        return maxDashboards === -1 || currentDashboardCount < maxDashboards;
      }
      
      // If we have director access but no package info yet, allow creation
      // This prevents the modal from showing while the director's info is being fetched
      return true;
    }
    
    const maxDashboards = getLimit('maxDashboards');
    if (maxDashboards === 0 && isLoadingPackageInfo) {
      return true;
    }
    return maxDashboards === -1 || currentDashboardCount < maxDashboards;
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
        const maxUsers = directorPackageInfo.totalUsers || 0;
        return maxUsers === -1 || currentUserCount < maxUsers;
      }
      
      // If we have director access but no package info yet, allow creation
      // This prevents the modal from showing while the director's info is being fetched
      return true;
    }
    
    const maxUsers = getLimit('maxUsers');
    if (maxUsers === 0 && isLoadingPackageInfo) {
      return true;
    }
    return maxUsers === -1 || currentUserCount < maxUsers;
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
    if (limit !== 'monthlyTokens') {
      return 0;
    }
    const activeInfo = getActivePackageInfo();
    return activeInfo?.payAsYouGoTokens || 0;
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

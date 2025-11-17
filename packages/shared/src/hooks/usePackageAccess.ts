import { useAuth } from '../contexts/AuthContext';
import { UserSessionService, type UserPackageInfo } from '../services/userSessionService';
import { 
  PackageType, 
  PackageFeatures, 
  PackageLimits,
  PACKAGE_LIMITS
} from '../config/packageFeatures';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { db } from '../firebaseConfig';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useTokenStats } from './useTokenStats';
import { UniversResourceService } from '../services/universResourceService';
import { universService } from '../services/universService';

type NumericPackageLimit = 'maxForms' | 'maxDashboards' | 'maxUsers' | 'monthlyTokens' | 'additionalUserCost';

type PackageLimitData = {
  maxForms?: number;
  maxDashboards?: number;
  maxUsers?: number;
  maxTokens?: number;
};

const NUMERIC_LIMIT_KEYS: NumericPackageLimit[] = ['maxForms', 'maxDashboards', 'maxUsers', 'monthlyTokens', 'additionalUserCost'];

const normalizePackageType = (value?: string | null): PackageType | null => {
  if (!value) return null;
  return ['free', 'starter', 'standard'].includes(value) ? (value as PackageType) : null;
};

const getPackageLimitsData = (info: UserPackageInfo | null): PackageLimitData =>
  ((info as any)?.packageLimits || (info as any)) as PackageLimitData;

const resolveLimitValue = (info: UserPackageInfo | null, limit: NumericPackageLimit): number => {
  if (!info) return 0;
  const limits = getPackageLimitsData(info);
  switch (limit) {
    case 'monthlyTokens':
      return limits.maxTokens ?? 0;
    case 'additionalUserCost': {
      const normalizedType = normalizePackageType(info?.packageType ?? null);
      if (normalizedType && PACKAGE_LIMITS[normalizedType]) {
        return PACKAGE_LIMITS[normalizedType].additionalUserCost || 0;
      }
      return 0;
    }
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
  const [directorPackageInfo, setDirectorPackageInfo] = useState<any>(null);
  const [isLoadingDirectorInfo, setIsLoadingDirectorInfo] = useState(false);

  const [userPackageInfo, setUserPackageInfo] = useState<any>(null);
  const [isLoadingUserPackageInfo, setIsLoadingUserPackageInfo] = useState(false);
  const [hasActiveUnivers, setHasActiveUnivers] = useState<boolean>(false);
  const isNumericLimit = (limit: keyof PackageLimits): limit is NumericPackageLimit =>
    NUMERIC_LIMIT_KEYS.includes(limit as NumericPackageLimit);

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
  // Only depend on user.id, role, and agencyId - NOT tokensUsedMonthly which changes frequently
  // This prevents unnecessary recalculations when tokens are updated locally
  const isFetchingRef = useRef(false);
  const lastFetchedUserIdRef = useRef<string | null>(null);
  const directorPackageInfoRef = useRef<any>(null);
  
  // Update ref when directorPackageInfo changes
  useEffect(() => {
    directorPackageInfoRef.current = directorPackageInfo;
  }, [directorPackageInfo]);
  
  useEffect(() => {
    // Skip if already fetching or if user hasn't changed
    if (isFetchingRef.current) {
      return;
    }
    
    // Skip if we already have package info for this user
    if (user?.id === lastFetchedUserIdRef.current && userPackageInfo !== null) {
      return;
    }
    
    const fetchUserPackageInfo = async () => {
      if (!user) {
        setUserPackageInfo(null);
        lastFetchedUserIdRef.current = null;
        return;
      }

      // Skip if already fetched for this user
      if (user.id === lastFetchedUserIdRef.current && userPackageInfo !== null) {
        return;
      }
      
      // Mark as fetching immediately to prevent concurrent calls
      isFetchingRef.current = true;
      lastFetchedUserIdRef.current = user.id;

      // For employees with director access, use the director's package info if available
      // Use ref to get the latest value without causing re-renders
      const currentDirectorPackageInfo = directorPackageInfoRef.current;
      if (user.role === 'employe' && user.hasDirectorDashboardAccess && currentDirectorPackageInfo) {
        setUserPackageInfo(currentDirectorPackageInfo);
        lastFetchedUserIdRef.current = user.id;
        return;
      }

      setIsLoadingUserPackageInfo(true);
      try {
        const info = await UserSessionService.getUserPackageInfo(user);
        setUserPackageInfo(info);
        lastFetchedUserIdRef.current = user.id;
      } catch (error) {
        console.error('Error fetching user package info:', error);
        setUserPackageInfo(null);
        lastFetchedUserIdRef.current = null;
      } finally {
        setIsLoadingUserPackageInfo(false);
        isFetchingRef.current = false;
      }
    };

    fetchUserPackageInfo();
  }, [user?.id, user?.role, user?.agencyId, user?.hasDirectorDashboardAccess]);

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
  // Use ref to track previous values and avoid unnecessary recalculations
  const prevPackageInfoRef = useRef<any>(null);
  const prevTokenStatsRef = useRef<any>(null);
  
  const packageInfo = useMemo(() => {
    const base = userPackageInfo;
    if (!base) {
      if (prevPackageInfoRef.current !== null) {
        prevPackageInfoRef.current = null;
      }
      return null;
    }
    
    // Check if values actually changed
    const baseChanged = prevPackageInfoRef.current?.tokensUsed !== base.tokensUsed || 
                        prevPackageInfoRef.current?.totalTokens !== base.totalTokens;
    const tokenStatsChanged = prevTokenStatsRef.current?.tokensUsedMonthly !== tokenStats?.tokensUsedMonthly;
    
    if (!baseChanged && !tokenStatsChanged && prevPackageInfoRef.current !== null) {
      // Values haven't changed, return previous result
      return prevPackageInfoRef.current;
    }
    
    if (tokenStats && typeof tokenStats.tokensUsedMonthly === 'number' && base.totalTokens > 0) {
      // Combine chat usage from active session (base.tokensUsed)
      // with extraction usage from stats/current (tokenStats.tokensUsedMonthly)
      const combinedUsed = (base.tokensUsed || 0) + (tokenStats.tokensUsedMonthly || 0);
      const tokensUsed = Math.max(0, Math.min(base.totalTokens, combinedUsed));
      const result = {
        ...base,
        tokensUsed,
        tokensRemaining: Math.max(0, base.totalTokens - tokensUsed)
      };
      prevPackageInfoRef.current = result;
      prevTokenStatsRef.current = tokenStats;
      return result;
    }
    prevPackageInfoRef.current = base;
    prevTokenStatsRef.current = tokenStats;
    return base;
  }, [userPackageInfo, tokenStats]);
  const currentPackageType = packageInfo?.packageType || null;

  const getActivePackageInfo = (): UserPackageInfo | null => {
    if (!user) return null;
    if (user.role === 'employe' && user.hasDirectorDashboardAccess) {
      return directorPackageInfo || packageInfo;
    }
    return packageInfo;
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
    const value = resolveLimitValueWithFallback(limit);
    return value === -1;
  };

  // Obtenir le type de package de l'utilisateur
  const getPackageType = (): PackageType | null => {
    return currentPackageType;
  };

  // Vérifier si l'utilisateur peut créer un nouveau formulaire
  const canCreateForm = (currentFormCount: number): boolean => {
    console.log('🟡 [CAN CREATE FORM - SHARED] ========================================');
    console.log('🟡 [CAN CREATE FORM - SHARED] Checking quota for form creation');
    console.log('🟡 [CAN CREATE FORM - SHARED] Current form count:', currentFormCount);
    
    if (!user) {
      console.log('🟡 [CAN CREATE FORM - SHARED] ❌ No user found - returning false');
      return false;
    }
    
    console.log('🟡 [CAN CREATE FORM - SHARED] User details:', {
      id: user.id,
      role: user.role,
      agencyId: user.agencyId,
      hasDirectorDashboardAccess: user.hasDirectorDashboardAccess
    });
    console.log('🟡 [CAN CREATE FORM - SHARED] Has active univers:', hasActiveUnivers);
    
    // Si un univers actif existe, autoriser la création (la ressource sera créée dans l'univers actif)
    // Les ressources dans un univers actif peuvent dépasser les limites du package
    if (user.role === 'directeur' && user.agencyId && hasActiveUnivers) {
      console.log('🟡 [CAN CREATE FORM - SHARED] ✅ Director has active univers - bypassing quota check');
      return true;
    }
    
    // For employees with director access, use director's package limits if available
    if (user.role === 'employe' && user.hasDirectorDashboardAccess) {
      console.log('🟡 [CAN CREATE FORM - SHARED] Employee with director access detected');
      console.log('🟡 [CAN CREATE FORM - SHARED] Loading director info:', isLoadingDirectorInfo);
      
      // If still loading director info, allow creation (will be validated later)
      if (isLoadingDirectorInfo) {
        console.log('🟡 [CAN CREATE FORM - SHARED] ⏳ Director info still loading - allowing (will validate later)');
        return true;
      }
      
      if (directorPackageInfo) {
        console.log('🟡 [CAN CREATE FORM - SHARED] Director package info found:', {
          packageType: directorPackageInfo.packageType,
          packageLimits: directorPackageInfo.packageLimits
        });
        const packageLimits = directorPackageInfo.packageLimits || {};
        const maxForms = packageLimits.maxForms || 0;
        const canCreate = maxForms === -1 || currentFormCount < maxForms;
        console.log('🟡 [CAN CREATE FORM - SHARED] Director limits check:', {
          maxForms,
          currentFormCount,
          isUnlimited: maxForms === -1,
          canCreate
        });
        return canCreate;
      }
      
      // If we have director access but no package info yet, allow creation
      // This prevents the modal from showing while the director's info is being fetched
      console.log('🟡 [CAN CREATE FORM - SHARED] ⚠️ Director access but no package info yet - allowing (will validate later)');
      return true;
    }
    
    const maxForms = getLimit('maxForms');
    const canCreate = maxForms === -1 || currentFormCount < maxForms;
    console.log('🟡 [CAN CREATE FORM - SHARED] Package limit check:', {
      maxForms,
      currentFormCount,
      canCreate,
      isLoadingUserPackageInfo
    });
    console.log('🟡 [CAN CREATE FORM - SHARED] ========================================');
    if (maxForms === 0 && isLoadingUserPackageInfo) {
      return true;
    }
    return canCreate;
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
    
    const maxDashboards = getLimit('maxDashboards');
    if (maxDashboards === 0 && isLoadingUserPackageInfo) {
      return true;
    }
    return maxDashboards === -1 || currentDashboardCount < maxDashboards;
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
  // Memoize to prevent unnecessary recalculations
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
  const getAdditionalUserCost = (): number => {
    return getLimit('additionalUserCost');
  };

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
    
    // Loading states
    isLoadingDirectorInfo,
    isLoadingUserPackageInfo,
    
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

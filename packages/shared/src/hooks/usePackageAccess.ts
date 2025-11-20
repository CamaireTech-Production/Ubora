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
import { SubscriptionSessionCollectionService } from '../services/subscriptionSessionCollectionService';
import { 
  calculateTotalLimit, 
  getInstantiatedUniversResourcesCount,
  countActualNonUniversResources,
  syncUsageToActualCount
} from '../utils/resourceQuotaUtils';
import { logger } from '../utils/logger';

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
  
  // Cache for session usage and instantiated resources for quota checks
  const [sessionUsage, setSessionUsage] = useState<{
    formsCreated: number;
    dashboardsCreated: number;
    usersAdded: number;
  } | null>(null);
  const [instantiatedResources, setInstantiatedResources] = useState<{
    forms: number;
    dashboards: number;
  } | null>(null);
  const [sessionLimits, setSessionLimits] = useState<{
    maxForms: number;
    maxDashboards: number;
    maxUsers: number;
  } | null>(null);
  
  // Cache for validation results (actual counts from Firebase)
  const [validatedCounts, setValidatedCounts] = useState<{
    forms: number | null;
    dashboards: number | null;
    lastValidated: Date | null;
  } | null>(null);
  
  const isNumericLimit = (limit: keyof PackageLimits): limit is NumericPackageLimit =>
    NUMERIC_LIMIT_KEYS.includes(limit as NumericPackageLimit);

  // Check if user has an active univers and cache session/quota data
  useEffect(() => {
    const loadQuotaData = async () => {
      if (!user || (user.role !== 'directeur' && !(user.role === 'employe' && user.hasDirectorDashboardAccess)) || !user.agencyId) {
        setHasActiveUnivers(false);
        setSessionUsage(null);
        setInstantiatedResources(null);
        setSessionLimits(null);
        return;
      }

      try {
        // Check active Univers
        const activeUnivers = await universService.getActiveUnivers(user.id, user.agencyId);
        setHasActiveUnivers(activeUnivers !== null);

        // Get active session for usage and limits
        const currentSession = await SubscriptionSessionCollectionService.getActiveSession(user.id);
        
        if (currentSession) {
          // Cache session usage
          setSessionUsage({
            formsCreated: currentSession.usage?.formsCreated || 0,
            dashboardsCreated: currentSession.usage?.dashboardsCreated || 0,
            usersAdded: currentSession.usage?.usersAdded || 0
          });

          // Calculate and cache limits (packageResources + payAsYouGoResources)
          const packageForms = currentSession.packageResources?.formsIncluded || 0;
          const packageDashboards = currentSession.packageResources?.dashboardsIncluded || 0;
          const packageUsers = currentSession.packageResources?.usersIncluded || 0;
          
          const payAsYouGoForms = currentSession.payAsYouGoResources?.forms || 0;
          const payAsYouGoDashboards = currentSession.payAsYouGoResources?.dashboards || 0;
          const payAsYouGoUsers = currentSession.payAsYouGoResources?.users || 0;

          setSessionLimits({
            maxForms: calculateTotalLimit(packageForms, payAsYouGoForms),
            maxDashboards: calculateTotalLimit(packageDashboards, payAsYouGoDashboards),
            maxUsers: calculateTotalLimit(packageUsers, payAsYouGoUsers)
          });

          // Get instantiated Univers resources count (only for directors)
          if (user.role === 'directeur') {
            const instantiated = await getInstantiatedUniversResourcesCount(user.id, user.agencyId);
            setInstantiatedResources({
              forms: instantiated.instantiatedForms,
              dashboards: instantiated.instantiatedDashboards
            });
          } else {
            setInstantiatedResources({ forms: 0, dashboards: 0 });
          }
        } else {
          setSessionUsage(null);
          setInstantiatedResources(null);
          setSessionLimits(null);
        }
      } catch (error) {
        logger.error('Error loading quota data', error, 'usePackageAccess');
        setHasActiveUnivers(false);
        setSessionUsage(null);
        setInstantiatedResources(null);
        setSessionLimits(null);
      }
    };

    loadQuotaData();
  }, [user?.id, user?.role, user?.agencyId, user?.hasDirectorDashboardAccess]);

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

  // Validation helper: Validate and sync form count when primary check fails
  const validateAndSyncFormCount = useCallback(async (
    userId: string,
    agencyId: string,
    totalFormsFromUsage: number,
    maxForms: number
  ) => {
    try {
      logger.debug('🔍 [VALIDATION] Starting form count validation', {
        userId,
        agencyId,
        totalFormsFromUsage,
        maxForms
      }, 'usePackageAccess');

      // Count actual non-Univers forms from Firebase
      const actualNonUniversForms = await countActualNonUniversResources(userId, agencyId, 'forms');
      
      // Get instantiated Univers forms count
      const instantiated = await getInstantiatedUniversResourcesCount(userId, agencyId);
      const instantiatedForms = instantiated.instantiatedForms;
      
      // Calculate total actual forms (instantiated + non-Univers)
      const totalActualForms = instantiatedForms + actualNonUniversForms;
      
      logger.debug('🔍 [VALIDATION] Form count validation results', {
        userId,
        instantiatedForms,
        actualNonUniversForms,
        totalActualForms,
        totalFormsFromUsage,
        maxForms,
        usageDiscrepancy: totalFormsFromUsage !== totalActualForms
      }, 'usePackageAccess');

      // If actual count is less than limit, sync usage
      if (totalActualForms < maxForms) {
        logger.info('🔍 [VALIDATION] Actual count below limit - syncing usage', {
          userId,
          actualNonUniversForms,
          currentUsage: totalFormsFromUsage - instantiatedForms,
          newUsage: actualNonUniversForms
        }, 'usePackageAccess');
        
        // Sync usage to match actual non-Univers count
        await syncUsageToActualCount(userId, 'forms', actualNonUniversForms);
        
        // Refresh cached session data
        const currentSession = await SubscriptionSessionCollectionService.getActiveSession(userId);
        if (currentSession) {
          setSessionUsage({
            formsCreated: currentSession.usage?.formsCreated || 0,
            dashboardsCreated: currentSession.usage?.dashboardsCreated || 0,
            usersAdded: currentSession.usage?.usersAdded || 0
          });
        }
      } else {
        logger.debug('🔍 [VALIDATION] Actual count confirms limit reached', {
          userId,
          totalActualForms,
          maxForms
        }, 'usePackageAccess');
      }
    } catch (error) {
      logger.error('Error during form count validation', error, 'usePackageAccess');
    }
  }, []);

  // Validation helper: Validate and sync dashboard count when primary check fails
  const validateAndSyncDashboardCount = useCallback(async (
    userId: string,
    agencyId: string,
    totalDashboardsFromUsage: number,
    maxDashboards: number
  ) => {
    try {
      logger.debug('🔍 [VALIDATION] Starting dashboard count validation', {
        userId,
        agencyId,
        totalDashboardsFromUsage,
        maxDashboards
      }, 'usePackageAccess');

      // Count actual non-Univers dashboards from Firebase
      const actualNonUniversDashboards = await countActualNonUniversResources(userId, agencyId, 'dashboards');
      
      // Get instantiated Univers dashboards count
      const instantiated = await getInstantiatedUniversResourcesCount(userId, agencyId);
      const instantiatedDashboards = instantiated.instantiatedDashboards;
      
      // Calculate total actual dashboards (instantiated + non-Univers)
      const totalActualDashboards = instantiatedDashboards + actualNonUniversDashboards;
      
      logger.debug('🔍 [VALIDATION] Dashboard count validation results', {
        userId,
        instantiatedDashboards,
        actualNonUniversDashboards,
        totalActualDashboards,
        totalDashboardsFromUsage,
        maxDashboards,
        usageDiscrepancy: totalDashboardsFromUsage !== totalActualDashboards
      }, 'usePackageAccess');

      // If actual count is less than limit, sync usage
      if (totalActualDashboards < maxDashboards) {
        logger.info('🔍 [VALIDATION] Actual count below limit - syncing usage', {
          userId,
          actualNonUniversDashboards,
          currentUsage: totalDashboardsFromUsage - instantiatedDashboards,
          newUsage: actualNonUniversDashboards
        }, 'usePackageAccess');
        
        // Sync usage to match actual non-Univers count
        await syncUsageToActualCount(userId, 'dashboards', actualNonUniversDashboards);
        
        // Refresh cached session data
        const currentSession = await SubscriptionSessionCollectionService.getActiveSession(userId);
        if (currentSession) {
          setSessionUsage({
            formsCreated: currentSession.usage?.formsCreated || 0,
            dashboardsCreated: currentSession.usage?.dashboardsCreated || 0,
            usersAdded: currentSession.usage?.usersAdded || 0
          });
        }
      } else {
        logger.debug('🔍 [VALIDATION] Actual count confirms limit reached', {
          userId,
          totalActualDashboards,
          maxDashboards
        }, 'usePackageAccess');
      }
    } catch (error) {
      logger.error('Error during dashboard count validation', error, 'usePackageAccess');
    }
  }, []);

  // Vérifier si l'utilisateur peut créer un nouveau formulaire
  const canCreateForm = (currentFormCount: number): boolean => {
    logger.debug('🟡 [CAN CREATE FORM] ========================================', undefined, 'usePackageAccess');
    logger.debug('🟡 [CAN CREATE FORM] Checking quota for form creation', { currentFormCount }, 'usePackageAccess');
    
    if (!user) {
      logger.debug('🟡 [CAN CREATE FORM] ❌ No user found - returning false', undefined, 'usePackageAccess');
      return false;
    }
    
    // For employees with director access, use director's package limits if available
    if (user.role === 'employe' && user.hasDirectorDashboardAccess) {
      // If still loading director info, allow creation (will be validated later)
      if (isLoadingDirectorInfo) {
        logger.debug('🟡 [CAN CREATE FORM] ⏳ Director info still loading - allowing (will validate later)', undefined, 'usePackageAccess');
        return true;
      }
      
      if (directorPackageInfo) {
        const packageLimits = directorPackageInfo.packageLimits || {};
        const maxForms = packageLimits.maxForms || 0;
        const canCreate = maxForms === -1 || currentFormCount < maxForms;
        logger.debug('🟡 [CAN CREATE FORM] Director limits check', {
          maxForms,
          currentFormCount,
          isUnlimited: maxForms === -1,
          canCreate
        }, 'usePackageAccess');
        return canCreate;
      }
      
      // If we have director access but no package info yet, allow creation
      logger.debug('🟡 [CAN CREATE FORM] ⚠️ Director access but no package info yet - allowing (will validate later)', undefined, 'usePackageAccess');
      return true;
    }
    
    // For directors: use session data with Univers instantiated resources
    if (!sessionUsage || !sessionLimits || !instantiatedResources) {
      // Data still loading, allow for now (will be validated later)
      if (isLoadingUserPackageInfo) {
        logger.debug('🟡 [CAN CREATE FORM] ⏳ Session data still loading - allowing (will validate later)', undefined, 'usePackageAccess');
        return true;
      }
      logger.debug('🟡 [CAN CREATE FORM] ❌ No session data available - returning false', undefined, 'usePackageAccess');
      return false;
    }
    
    // Calculate total forms: instantiated Univers forms + usage (new forms created)
    const instantiatedForms = instantiatedResources.forms;
    const usageForms = sessionUsage.formsCreated;
    const totalForms = instantiatedForms + usageForms;
    
    // Get limit with unlimited handling
    const maxForms = sessionLimits.maxForms;
    
    // Check if unlimited
    if (maxForms === -1) {
      logger.debug('🟡 [CAN CREATE FORM] ✅ Unlimited forms - allowing', {
        instantiatedForms,
        usageForms,
        totalForms,
        maxForms
      }, 'usePackageAccess');
      return true;
    }
    
    // Primary check: Compare total against limit
    const canCreatePrimary = totalForms < maxForms;
    
    // If primary check passes, allow creation
    if (canCreatePrimary) {
      logger.debug('🟡 [CAN CREATE FORM] ✅ Quota check passed - allowing', {
        instantiatedForms,
        usageForms,
        totalForms,
        maxForms,
        canCreate: true
      }, 'usePackageAccess');
      logger.debug('🟡 [CAN CREATE FORM] ========================================', undefined, 'usePackageAccess');
      return true;
    }
    
    // Primary check failed - trigger validation (async, non-blocking)
    // Validation will run in background and sync usage if discrepancy found
    if (user.role === 'directeur' && user.agencyId) {
      validateAndSyncFormCount(user.id, user.agencyId, totalForms, maxForms).catch(error => {
        logger.error('Error during form count validation', error, 'usePackageAccess');
      });
    }
    
    logger.debug('🟡 [CAN CREATE FORM] ❌ Quota check failed - blocking', {
      instantiatedForms,
      usageForms,
      totalForms,
      maxForms,
      canCreate: false,
      note: 'Validation triggered in background'
    }, 'usePackageAccess');
    logger.debug('🟡 [CAN CREATE FORM] ========================================', undefined, 'usePackageAccess');
    
    return false;
  };

  // Vérifier si l'utilisateur peut créer un nouveau tableau de bord
  const canCreateDashboard = (currentDashboardCount: number): boolean => {
    logger.debug('🟡 [CAN CREATE DASHBOARD] ========================================', undefined, 'usePackageAccess');
    logger.debug('🟡 [CAN CREATE DASHBOARD] Checking quota for dashboard creation', { currentDashboardCount }, 'usePackageAccess');
    
    if (!user) {
      logger.debug('🟡 [CAN CREATE DASHBOARD] ❌ No user found - returning false', undefined, 'usePackageAccess');
      return false;
    }
    
    // For employees with director access, use director's package limits if available
    if (user.role === 'employe' && user.hasDirectorDashboardAccess) {
      // If still loading director info, allow creation (will be validated later)
      if (isLoadingDirectorInfo) {
        logger.debug('🟡 [CAN CREATE DASHBOARD] ⏳ Director info still loading - allowing (will validate later)', undefined, 'usePackageAccess');
        return true;
      }
      
      if (directorPackageInfo) {
        const packageLimits = directorPackageInfo.packageLimits || {};
        const maxDashboards = packageLimits.maxDashboards || 0;
        const canCreate = maxDashboards === -1 || currentDashboardCount < maxDashboards;
        logger.debug('🟡 [CAN CREATE DASHBOARD] Director limits check', {
          maxDashboards,
          currentDashboardCount,
          isUnlimited: maxDashboards === -1,
          canCreate
        }, 'usePackageAccess');
        return canCreate;
      }
      
      // If we have director access but no package info yet, allow creation
      logger.debug('🟡 [CAN CREATE DASHBOARD] ⚠️ Director access but no package info yet - allowing (will validate later)', undefined, 'usePackageAccess');
      return true;
    }
    
    // For directors: use session data with Univers instantiated resources
    if (!sessionUsage || !sessionLimits || !instantiatedResources) {
      // Data still loading, allow for now (will be validated later)
      if (isLoadingUserPackageInfo) {
        logger.debug('🟡 [CAN CREATE DASHBOARD] ⏳ Session data still loading - allowing (will validate later)', undefined, 'usePackageAccess');
        return true;
      }
      logger.debug('🟡 [CAN CREATE DASHBOARD] ❌ No session data available - returning false', undefined, 'usePackageAccess');
      return false;
    }
    
    // Calculate total dashboards: instantiated Univers dashboards + usage (new dashboards created)
    const instantiatedDashboards = instantiatedResources.dashboards;
    const usageDashboards = sessionUsage.dashboardsCreated;
    const totalDashboards = instantiatedDashboards + usageDashboards;
    
    // Get limit with unlimited handling
    const maxDashboards = sessionLimits.maxDashboards;
    
    // Check if unlimited
    if (maxDashboards === -1) {
      logger.debug('🟡 [CAN CREATE DASHBOARD] ✅ Unlimited dashboards - allowing', {
        instantiatedDashboards,
        usageDashboards,
        totalDashboards,
        maxDashboards
      }, 'usePackageAccess');
      return true;
    }
    
    // Primary check: Compare total against limit
    const canCreatePrimary = totalDashboards < maxDashboards;
    
    // If primary check passes, allow creation
    if (canCreatePrimary) {
      logger.debug('🟡 [CAN CREATE DASHBOARD] ✅ Quota check passed - allowing', {
        instantiatedDashboards,
        usageDashboards,
        totalDashboards,
        maxDashboards,
        canCreate: true
      }, 'usePackageAccess');
      logger.debug('🟡 [CAN CREATE DASHBOARD] ========================================', undefined, 'usePackageAccess');
      return true;
    }
    
    // Primary check failed - trigger validation (async, non-blocking)
    // Validation will run in background and sync usage if discrepancy found
    if (user.role === 'directeur' && user.agencyId) {
      validateAndSyncDashboardCount(user.id, user.agencyId, totalDashboards, maxDashboards).catch(error => {
        logger.error('Error during dashboard count validation', error, 'usePackageAccess');
      });
    }
    
    logger.debug('🟡 [CAN CREATE DASHBOARD] ❌ Quota check failed - blocking', {
      instantiatedDashboards,
      usageDashboards,
      totalDashboards,
      maxDashboards,
      canCreate: false,
      note: 'Validation triggered in background'
    }, 'usePackageAccess');
    logger.debug('🟡 [CAN CREATE DASHBOARD] ========================================', undefined, 'usePackageAccess');
    
    return false;
  };

  // Vérifier si l'utilisateur peut ajouter un nouvel utilisateur
  const canAddUser = (currentUserCount: number): boolean => {
    logger.debug('🟡 [CAN ADD USER] ========================================', undefined, 'usePackageAccess');
    logger.debug('🟡 [CAN ADD USER] Checking quota for user addition', { currentUserCount }, 'usePackageAccess');
    
    if (!user) {
      logger.debug('🟡 [CAN ADD USER] ❌ No user found - returning false', undefined, 'usePackageAccess');
      return false;
    }
    
    // For employees with director access, use director's package limits if available
    if (user.role === 'employe' && user.hasDirectorDashboardAccess) {
      // If still loading director info, allow creation (will be validated later)
      if (isLoadingDirectorInfo) {
        logger.debug('🟡 [CAN ADD USER] ⏳ Director info still loading - allowing (will validate later)', undefined, 'usePackageAccess');
        return true;
      }
      
      if (directorPackageInfo) {
        const packageLimits = directorPackageInfo.packageLimits || {};
        const maxUsers = packageLimits.maxUsers || 0;
        const canAdd = maxUsers === -1 || currentUserCount < maxUsers;
        logger.debug('🟡 [CAN ADD USER] Director limits check', {
          maxUsers,
          currentUserCount,
          isUnlimited: maxUsers === -1,
          canAdd
        }, 'usePackageAccess');
        return canAdd;
      }
      
      // If we have director access but no package info yet, allow creation
      logger.debug('🟡 [CAN ADD USER] ⚠️ Director access but no package info yet - allowing (will validate later)', undefined, 'usePackageAccess');
      return true;
    }
    
    // For directors: use session usage directly (users are not Univers-related)
    if (!sessionUsage || !sessionLimits) {
      // Data still loading, allow for now (will be validated later)
      if (isLoadingUserPackageInfo) {
        logger.debug('🟡 [CAN ADD USER] ⏳ Session data still loading - allowing (will validate later)', undefined, 'usePackageAccess');
        return true;
      }
      logger.debug('🟡 [CAN ADD USER] ❌ No session data available - returning false', undefined, 'usePackageAccess');
      return false;
    }
    
    // Use usage.usersAdded from session (no Univers instantiated users)
    const usageUsers = sessionUsage.usersAdded;
    
    // Get limit with unlimited handling
    const maxUsers = sessionLimits.maxUsers;
    
    // Check if unlimited
    if (maxUsers === -1) {
      logger.debug('🟡 [CAN ADD USER] ✅ Unlimited users - allowing', {
        usageUsers,
        maxUsers
      }, 'usePackageAccess');
      return true;
    }
    
    // Compare usage against limit
    const canAdd = usageUsers < maxUsers;
    
    logger.debug('🟡 [CAN ADD USER] Quota check result', {
      usageUsers,
      maxUsers,
      canAdd
    }, 'usePackageAccess');
    logger.debug('🟡 [CAN ADD USER] ========================================', undefined, 'usePackageAccess');
    
    return canAdd;
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

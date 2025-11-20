import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { User, UniversInstance, ActiveUnivers } from '../types';
import { universService } from '../services/universService';
import { logger } from './logger';

/**
 * Calculate total limit handling unlimited (-1) + pay-as-you-go
 * If packageLimit is -1 (unlimited), return -1
 * Otherwise, add packageLimit + payAsYouGoLimit
 * 
 * @param packageLimit - Limit from package (can be -1 for unlimited)
 * @param payAsYouGoLimit - Additional limit from pay-as-you-go purchases
 * @returns Total limit (-1 for unlimited, or sum of both limits)
 */
export function calculateTotalLimit(
  packageLimit: number,
  payAsYouGoLimit: number
): number {
  // If package limit is unlimited, total is unlimited
  if (packageLimit === -1) {
    return -1;
  }
  
  // If pay-as-you-go is unlimited, total is unlimited
  if (payAsYouGoLimit === -1) {
    return -1;
  }
  
  // Both are finite, add them
  return packageLimit + payAsYouGoLimit;
}

/**
 * Get instantiated Univers resources count for a director
 * Gets the active Univers instance and counts resources in instances.forms[] and instances.dashboards[]
 * 
 * @param userId - Director user ID
 * @param agencyId - Agency ID
 * @returns Object with instantiated forms and dashboards counts
 */
export async function getInstantiatedUniversResourcesCount(
  userId: string,
  agencyId: string
): Promise<{
  instantiatedForms: number;
  instantiatedDashboards: number;
}> {
  try {
    // Get active Univers for the director
    const activeUnivers = await universService.getActiveUnivers(userId, agencyId);
    
    if (!activeUnivers || !activeUnivers.activeInstanceId) {
      // No active Univers or no instance
      return {
        instantiatedForms: 0,
        instantiatedDashboards: 0
      };
    }
    
    // Get the Univers instance document
    const instanceDocRef = doc(db, 'universInstances', activeUnivers.activeInstanceId);
    const instanceDoc = await getDoc(instanceDocRef);
    
    if (!instanceDoc.exists()) {
      logger.warn('Univers instance not found', { instanceId: activeUnivers.activeInstanceId }, 'resourceQuotaUtils');
      return {
        instantiatedForms: 0,
        instantiatedDashboards: 0
      };
    }
    
    const instanceData = instanceDoc.data() as UniversInstance;
    const instances = instanceData.instances || {};
    
    // Count resources in the instance arrays
    const instantiatedForms = (instances.forms || []).length;
    const instantiatedDashboards = (instances.dashboards || []).length;
    
    logger.debug('Instantiated Univers resources count', {
      userId,
      agencyId,
      instanceId: activeUnivers.activeInstanceId,
      instantiatedForms,
      instantiatedDashboards
    }, 'resourceQuotaUtils');
    
    return {
      instantiatedForms,
      instantiatedDashboards
    };
    
  } catch (error) {
    logger.error('Error getting instantiated Univers resources count', error, 'resourceQuotaUtils');
    // Return 0 on error to avoid blocking resource creation
    return {
      instantiatedForms: 0,
      instantiatedDashboards: 0
    };
  }
}

/**
 * Get instantiated Univers resources count for a specific resource type
 * Helper function for future extensibility (reports, lists, instructions)
 * 
 * @param userId - Director user ID
 * @param agencyId - Agency ID
 * @param resourceType - Type of resource ('forms' | 'dashboards' | 'lists' | 'reports' | 'instructions')
 * @returns Count of instantiated resources of the specified type
 */
export async function getInstantiatedUniversResourceCount(
  userId: string,
  agencyId: string,
  resourceType: 'forms' | 'dashboards' | 'lists' | 'reports' | 'instructions'
): Promise<number> {
  try {
    const activeUnivers = await universService.getActiveUnivers(userId, agencyId);
    
    if (!activeUnivers || !activeUnivers.activeInstanceId) {
      return 0;
    }
    
    const instanceDocRef = doc(db, 'universInstances', activeUnivers.activeInstanceId);
    const instanceDoc = await getDoc(instanceDocRef);
    
    if (!instanceDoc.exists()) {
      return 0;
    }
    
    const instanceData = instanceDoc.data() as UniversInstance;
    const instances = instanceData.instances || {};
    
    // Map resource type to instance array
    const resourceMap: Record<typeof resourceType, keyof typeof instances> = {
      forms: 'forms',
      dashboards: 'dashboards',
      lists: 'lists',
      reports: 'reports',
      instructions: 'instructions'
    };
    
    const resourceArray = instances[resourceMap[resourceType]] || [];
    return Array.isArray(resourceArray) ? resourceArray.length : 0;
    
  } catch (error) {
    logger.error(`Error getting instantiated ${resourceType} count`, error, 'resourceQuotaUtils');
    return 0;
  }
}

/**
 * Count actual non-Univers resources from Firebase collections
 * This counts resources that do NOT have universId set (or have universId but are not in active instance)
 * Used for validation when usage indicates limit reached
 * 
 * @param userId - Director user ID
 * @param agencyId - Agency ID
 * @param resourceType - Type of resource ('forms' | 'dashboards')
 * @returns Count of actual non-Univers resources
 */
export async function countActualNonUniversResources(
  userId: string,
  agencyId: string,
  resourceType: 'forms' | 'dashboards'
): Promise<number> {
  try {
    const collectionName = resourceType === 'forms' ? 'forms' : 'dashboards';
    
    // Get active Univers to check which resources are Univers-related
    const activeUnivers = await universService.getActiveUnivers(userId, agencyId);
    const activeInstanceId = activeUnivers?.activeInstanceId;
    
    if (activeInstanceId) {
      // Get Univers instance to know which resources are instantiated
      const instanceDocRef = doc(db, 'universInstances', activeInstanceId);
      const instanceDoc = await getDoc(instanceDocRef);
      
      if (instanceDoc.exists()) {
        const instanceData = instanceDoc.data() as UniversInstance;
        const universResourceIds = new Set(
          resourceType === 'forms' 
            ? (instanceData.instances?.forms || [])
            : (instanceData.instances?.dashboards || [])
        );
        
        // Count all resources for the agency
        const allResourcesQuery = query(
          collection(db, collectionName),
          where('agencyId', '==', agencyId)
        );
        const allResourcesSnapshot = await getDocs(allResourcesQuery);
        
        // Count only resources that are NOT in the Univers instance
        let nonUniversCount = 0;
        allResourcesSnapshot.forEach((doc) => {
          const resourceId = doc.id;
          if (!universResourceIds.has(resourceId)) {
            nonUniversCount++;
          }
        });
        
        logger.debug(`Counted actual non-Univers ${resourceType}`, {
          userId,
          agencyId,
          totalResources: allResourcesSnapshot.size,
          universResources: universResourceIds.size,
          nonUniversResources: nonUniversCount
        }, 'resourceQuotaUtils');
        
        return nonUniversCount;
      }
    }
    
    // No active Univers or instance - count all resources (they're all non-Univers)
    const allResourcesQuery = query(
      collection(db, collectionName),
      where('agencyId', '==', agencyId)
    );
    const allResourcesSnapshot = await getDocs(allResourcesQuery);
    
    logger.debug(`Counted actual ${resourceType} (no Univers)`, {
      userId,
      agencyId,
      totalResources: allResourcesSnapshot.size
    }, 'resourceQuotaUtils');
    
    return allResourcesSnapshot.size;
    
  } catch (error) {
    logger.error(`Error counting actual non-Univers ${resourceType}`, error, 'resourceQuotaUtils');
    // Return 0 on error to avoid blocking - validation will fail gracefully
    return 0;
  }
}

/**
 * Sync usage in subscription session to match actual non-Univers resource count
 * Used when validation finds a discrepancy between usage and actual count
 * 
 * @param userId - Director user ID
 * @param resourceType - Type of resource ('forms' | 'dashboards')
 * @param actualCount - Actual count of non-Univers resources from Firebase
 * @returns Promise<boolean> - true if sync was successful
 */
export async function syncUsageToActualCount(
  userId: string,
  resourceType: 'forms' | 'dashboards',
  actualCount: number
): Promise<boolean> {
  try {
    const { SubscriptionSessionCollectionService } = await import('../services/subscriptionSessionCollectionService');
    const { SubscriptionSessionService } = await import('../services/subscriptionSessionService');
    
    // Get active session
    const currentSession = await SubscriptionSessionCollectionService.getActiveSession(userId);
    
    if (!currentSession) {
      logger.warn('Cannot sync usage - no active session found', { userId, resourceType }, 'resourceQuotaUtils');
      return false;
    }
    
    // Get current usage
    const currentUsage = currentSession.usage || {
      tokensUsed: 0,
      formsCreated: 0,
      dashboardsCreated: 0,
      usersAdded: 0
    };
    
    // Calculate the difference
    const currentUsageValue = resourceType === 'forms' 
      ? currentUsage.formsCreated 
      : currentUsage.dashboardsCreated;
    
    const difference = actualCount - currentUsageValue;
    
    if (difference === 0) {
      // Already in sync, no update needed
      logger.debug('Usage already in sync with actual count', {
        userId,
        resourceType,
        actualCount,
        usageValue: currentUsageValue
      }, 'resourceQuotaUtils');
      return true;
    }
    
    // Update usage to match actual count
    // If difference is positive, we need to add; if negative, we need to subtract
    // But updateUsage only adds, so we need to handle this differently
    // Actually, we should update the session directly with the correct value
    
    const updatedUsage = {
      ...currentUsage,
      [resourceType === 'forms' ? 'formsCreated' : 'dashboardsCreated']: actualCount
    };
    
    const success = await SubscriptionSessionCollectionService.updateSession(currentSession.id, {
      usage: updatedUsage
    });
    
    if (success) {
      logger.info('Usage synced to actual count', {
        userId,
        resourceType,
        oldUsage: currentUsageValue,
        newUsage: actualCount,
        difference
      }, 'resourceQuotaUtils');
    } else {
      logger.error('Failed to sync usage to actual count', {
        userId,
        resourceType,
        actualCount
      }, 'resourceQuotaUtils');
    }
    
    return success;
    
  } catch (error) {
    logger.error('Error syncing usage to actual count', error, 'resourceQuotaUtils');
    return false;
  }
}


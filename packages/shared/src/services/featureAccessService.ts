import { User } from '../types';
import { universService } from './universService';
import { UniversPurchaseService } from './universPurchaseService';
import { SubscriptionSessionService } from './subscriptionSessionService';
import { SubscriptionSessionCollectionService } from './subscriptionSessionCollectionService';
import { PACKAGE_FEATURES, PackageType } from '../config/packageFeatures';
import { Univers } from '../types';

/**
 * Source de la permission
 */
export type FeatureAccessSource = 'package' | 'univers' | 'purchase' | 'none';

/**
 * Niveau d'accès à une fonctionnalité
 */
export interface FeatureAccess {
  canRead: boolean; // Peut consulter/utiliser la fonctionnalité
  canWrite: boolean; // Peut créer/modifier la fonctionnalité
  source: FeatureAccessSource; // Source de la permission
  reason?: string; // Raison de l'accès (pour debug/info)
}

/**
 * Service pour gérer l'accès aux fonctionnalités avec logique de priorité
 * Priorité: Package > Univers activé > Achat marketplace
 */
export class FeatureAccessService {
  /**
   * Vérifier l'accès à une fonctionnalité spécifique
   * @param user - Utilisateur
   * @param feature - Nom de la fonctionnalité (ex: 'allowFileUploads')
   * @param activeUniversId - ID de l'univers actif (optionnel, sera récupéré si non fourni)
   * @returns Promise<FeatureAccess> - Niveau d'accès à la fonctionnalité
   */
  static async checkFeatureAccess(
    user: User,
    feature: string,
    activeUniversId?: string | null
  ): Promise<FeatureAccess> {
    // Vérifier que l'utilisateur a le bon rôle
    if (user.role !== 'directeur' && !(user.role === 'employe' && user.hasDirectorDashboardAccess)) {
      return {
        canRead: false,
        canWrite: false,
        source: 'none',
        reason: 'Rôle insuffisant'
      };
    }

    // 1. PRIORITÉ 1: Vérifier l'accès via le package
    const packageAccess = await this.checkPackageAccess(user, feature);
    if (packageAccess.canWrite) {
      return {
        ...packageAccess,
        source: 'package',
        reason: `Accès complet via package ${packageAccess.reason}`
      };
    }

    // 2. PRIORITÉ 2: Vérifier l'accès via l'univers activé (read-only)
    if (!activeUniversId && user.role === 'directeur' && user.agencyId) {
      try {
        const activeUnivers = await universService.getActiveUnivers(user.id, user.agencyId);
        activeUniversId = activeUnivers?.activeUniversId || null;
      } catch (error) {
        console.error('Erreur lors de la récupération de l\'univers actif:', error);
      }
    }

    if (activeUniversId) {
      const universAccess = await this.checkUniversAccess(user, feature, activeUniversId);
      if (universAccess.canRead) {
        return {
          canRead: true,
          canWrite: false, // Univers activé = read-only
          source: 'univers',
          reason: `Accès lecture seule via univers activé: ${universAccess.reason}`
        };
      }
    }

    // 3. PRIORITÉ 3: Vérifier l'accès via achat marketplace (read-only ou complet selon métadonnées)
    const purchaseAccess = await this.checkPurchaseAccess(user, feature, activeUniversId);
    if (purchaseAccess.canRead) {
      return {
        canRead: purchaseAccess.canRead,
        canWrite: purchaseAccess.canWrite,
        source: 'purchase',
        reason: `Accès via achat marketplace: ${purchaseAccess.reason}`
      };
    }

    // Aucun accès trouvé
    return {
      canRead: false,
      canWrite: false,
      source: 'none',
      reason: 'Aucun accès trouvé'
    };
  }

  /**
   * Vérifier l'accès via le package de l'utilisateur
   */
  private static async checkPackageAccess(user: User, feature: string): Promise<FeatureAccess> {
    try {
      // PRIORITÉ 1: Vérifier directement user.package (le plus fiable et rapide)
      if (user.package && ['starter', 'standard', 'premium'].includes(user.package)) {
        const packageType = user.package === 'premium' ? 'standard' : user.package as PackageType;
        const features = PACKAGE_FEATURES[packageType];
        const hasFeature = !!features && (features as any)[feature] === true;
        
        if (hasFeature) {
          return {
            canRead: true,
            canWrite: true,
            source: 'package',
            reason: `Package ${packageType} (depuis user.package)`
          };
        }
        
        return {
          canRead: false,
          canWrite: false,
          source: 'none',
          reason: `Package ${packageType} ne supporte pas ${feature}`
        };
      }
      
      // PRIORITÉ 2: Essayer la nouvelle collection
      let currentSession = await SubscriptionSessionCollectionService.getActiveSession(user.id);
      
      // PRIORITÉ 3: Si pas de session dans la nouvelle collection, essayer le système legacy
      if (!currentSession) {
        currentSession = await SubscriptionSessionService.getCurrentSession(user);
      }
      
      // Vérifier la session trouvée
      if (currentSession) {
        const packageType = currentSession.packageType as PackageType;
        const features = PACKAGE_FEATURES[packageType];
        const hasFeature = !!features && (features as any)[feature] === true;
        
        if (hasFeature) {
          return {
            canRead: true,
            canWrite: true,
            source: 'package',
            reason: `Package ${packageType} (depuis session)`
          };
        }
        
        return {
          canRead: false,
          canWrite: false,
          source: 'none',
          reason: `Package ${packageType} ne supporte pas ${feature}`
        };
      }
      
      // Aucun package trouvé
      return {
        canRead: false,
        canWrite: false,
        source: 'none',
        reason: 'Aucune session active et aucun package trouvé'
      };
    } catch (error) {
      console.error('Erreur lors de la vérification de l\'accès package:', error);
      return {
        canRead: false,
        canWrite: false,
        source: 'none',
        reason: 'Erreur lors de la vérification'
      };
    }
  }

  /**
   * Vérifier si l'univers activé contient la fonctionnalité
   */
  private static async checkUniversAccess(
    user: User,
    feature: string,
    universId: string
  ): Promise<FeatureAccess> {
    try {
      const univers = await universService.getById(universId);
      
      if (!univers) {
        return {
          canRead: false,
          canWrite: false,
          source: 'none',
          reason: 'Univers non trouvé'
        };
      }

      // Vérifier si l'univers contient des formulaires avec des champs de type file
      if (feature === 'allowFileUploads') {
        const hasFileFields = this.universHasFileUploadFields(univers);
        if (hasFileFields) {
          return {
            canRead: true,
            canWrite: false,
            source: 'univers',
            reason: `Univers "${univers.metadata.name}" contient des champs de fichiers`
          };
        }
      }

      // Vérifier les métadonnées de l'univers pour les fonctionnalités incluses
      const featuresIncluded = univers.metadata?.featuresIncluded || [];
      if (featuresIncluded.includes(feature)) {
        return {
          canRead: true,
          canWrite: false,
          source: 'univers',
          reason: `Univers "${univers.metadata.name}" inclut la fonctionnalité ${feature}`
        };
      }

      return {
        canRead: false,
        canWrite: false,
        source: 'none',
        reason: `Univers ne contient pas ${feature}`
      };
    } catch (error) {
      console.error('Erreur lors de la vérification de l\'accès univers:', error);
      return {
        canRead: false,
        canWrite: false,
        source: 'none',
        reason: 'Erreur lors de la vérification'
      };
    }
  }

  /**
   * Vérifier si l'univers contient des champs de type file
   */
  private static universHasFileUploadFields(univers: Univers): boolean {
    if (!univers.definitions?.forms) {
      return false;
    }

    // Parcourir tous les formulaires de l'univers
    for (const form of univers.definitions.forms) {
      if (form.fields && Array.isArray(form.fields)) {
        // Vérifier si un champ est de type 'file'
        const hasFileField = form.fields.some((field: any) => field.type === 'file');
        if (hasFileField) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Vérifier l'accès via achat marketplace
   */
  private static async checkPurchaseAccess(
    user: User,
    feature: string,
    universId?: string | null
  ): Promise<FeatureAccess> {
    // Si un universId est fourni, vérifier si l'utilisateur a acheté cet univers
    if (universId) {
      try {
        const hasPurchased = await UniversPurchaseService.hasPurchasedUnivers(user.id, universId);
        if (hasPurchased) {
          // Pour les achats, on peut donner un accès read-only ou complet selon les métadonnées
          // Pour l'instant, on donne read-only par défaut
          return {
            canRead: true,
            canWrite: false, // Par défaut read-only pour les achats
            source: 'purchase',
            reason: `Univers acheté sur marketplace`
          };
        }
      } catch (error) {
        console.error('Erreur lors de la vérification de l\'achat:', error);
      }
    }

    return {
      canRead: false,
      canWrite: false,
      source: 'none',
      reason: 'Aucun achat trouvé'
    };
  }

  /**
   * Vérifier l'accès aux uploads de fichiers (méthode synchrone pour compatibilité)
   * Utilise la version asynchrone en interne
   */
  static canUseFileUploads(user: User, activeUniversId?: string | null): boolean {
    // Pour la compatibilité, on retourne canRead (peut voir mais pas modifier)
    // L'appelant devra utiliser la version async pour avoir canRead/canWrite séparés
    if (user.role !== 'directeur' && !(user.role === 'employe' && user.hasDirectorDashboardAccess)) {
      return false;
    }

    // Vérification rapide du package (synchrone)
    const currentSession = SubscriptionSessionService.getCurrentSessionSync(user);
    if (currentSession) {
      const features = PACKAGE_FEATURES[currentSession.packageType];
      if (features && (features as any).allowFileUploads === true) {
        return true; // Accès complet via package
      }
    }

    // Fallback: vérifier le champ legacy user.package si la session n'est pas trouvée
    if (user.package && ['starter', 'standard', 'premium'].includes(user.package)) {
      const packageType = user.package === 'premium' ? 'standard' : user.package; // premium maps to standard
      const features = PACKAGE_FEATURES[packageType as PackageType];
      if (features && (features as any).allowFileUploads === true) {
        return true; // Accès complet via package legacy
      }
    }

    // Si pas d'accès via package, on retourne false pour la version synchrone
    // La version async pourra vérifier l'univers activé
    return false;
  }

  /**
   * Vérifier l'accès aux uploads de fichiers (version asynchrone complète)
   */
  static async canUseFileUploadsAsync(
    user: User,
    activeUniversId?: string | null
  ): Promise<FeatureAccess> {
    return this.checkFeatureAccess(user, 'allowFileUploads', activeUniversId);
  }
}


import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc,
  setDoc,
  deleteDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  onSnapshot,
  Timestamp,
  writeBatch,
  deleteField
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Univers, UniversInstance, UniversDefinitions, UniversMetadata, UniversOwnership, UniversUsage, ActiveUnivers, UniversVersion, UniversDraftData } from '../types';
import { universInstantiationService, InstantiationResult } from './universInstantiationService';
import { unifiedNotificationService } from './unifiedNotificationService';

/**
 * Interface pour le résultat de la vérification des ressources
 */
interface ResourcesCheckResult {
  exists: boolean;
  isConsistent: boolean;
  actualCounts: {
    forms: number;
    dashboards: number;
    instructions: number;
    lists: number;
    reports: number;
  };
  expectedCounts: {
    forms: number;
    dashboards: number;
    instructions: number;
    lists: number;
    reports: number;
  };
  inconsistencies: string[];
}

class UniversService {
  private readonly collectionName = 'univers';
  private readonly instancesCollectionName = 'universInstances';
  private readonly versionsCollectionName = 'universVersions';

  /**
   * Normaliser une ListDefinition pour s'assurer que les rows sont bien présentes
   */
  private normalizeListDefinition(listDef: any): any {
    if (!listDef) return listDef;
    
    return {
      id: listDef.id || '',
      name: listDef.name || '',
      description: listDef.description || undefined,
      columns: Array.isArray(listDef.columns) ? listDef.columns : [],
      // CRITIQUE: S'assurer que rows est toujours un tableau, même si vide
      rows: Array.isArray(listDef.rows) ? listDef.rows : []
    };
  }

  /**
   * Convertir les données Firestore en Univers
   */
  private convertFirestoreToUnivers(id: string, data: any): Univers {
    // Convertir draftData si présent
    let draftData = undefined;
    if (data.draftData) {
      // Normaliser les ListDefinition dans le draftData si présent
      let normalizedDraftDefinitions = data.draftData.definitions;
      if (data.draftData.definitions?.lists) {
        const normalizedDraftLists = data.draftData.definitions.lists.map((listDef: any) => 
          this.normalizeListDefinition(listDef)
        );
        normalizedDraftDefinitions = {
          ...data.draftData.definitions,
          lists: normalizedDraftLists
        };
      }
      
      draftData = {
        metadata: data.draftData.metadata ? {
          ...data.draftData.metadata,
          createdAt: data.draftData.metadata.createdAt?.toDate() || undefined
        } : undefined,
        definitions: normalizedDraftDefinitions || undefined,
        draftVersion: data.draftData.draftVersion || undefined,
        updatedAt: data.draftData.updatedAt?.toDate() || undefined
      };
    }

    // Normaliser les definitions, en particulier les ListDefinition avec leurs rows
    const rawDefinitions = data.definitions || {
      forms: [],
      dashboards: [],
      instructions: [],
      lists: [],
      reports: []
    };

    // Normaliser explicitement les ListDefinition pour préserver les rows
    const normalizedLists = Array.isArray(rawDefinitions.lists) 
      ? rawDefinitions.lists.map((listDef: any) => this.normalizeListDefinition(listDef))
      : [];

    const definitions = {
      forms: rawDefinitions.forms || [],
      dashboards: rawDefinitions.dashboards || [],
      instructions: rawDefinitions.instructions || [],
      lists: normalizedLists,
      reports: rawDefinitions.reports || []
    };

    return {
      id,
      metadata: {
        ...data.metadata,
        isDefault: data.metadata?.isDefault === true, // S'assurer que isDefault est bien préservé
        createdAt: data.metadata?.createdAt?.toDate() || new Date(),
        publishedVersion: data.metadata?.publishedVersion || undefined
      },
      ownership: {
        ...data.ownership,
        approvedAt: data.ownership?.approvedAt?.toDate() || undefined
      },
      definitions: definitions,
      usage: {
        ...data.usage,
        lastUsedAt: data.usage?.lastUsedAt?.toDate() || undefined
      },
      draftData: draftData,
      hasUnpublishedChanges: data.hasUnpublishedChanges ?? false
    } as Univers;
  }

  /**
   * Convertir les données Firestore en UniversInstance
   */
  private convertFirestoreToUniversInstance(id: string, data: any): UniversInstance {
    return {
      id,
      universId: data.universId,
      universVersion: data.universVersion || data.metadata?.universVersion || 1,
      userId: data.userId,
      agencyId: data.agencyId,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || undefined,
      isActive: data.isActive ?? false, // Default to false if not set
      instances: data.instances || {
        forms: [],
        dashboards: [],
        instructions: [],
        lists: [],
        reports: []
      },
      metadata: {
        universName: data.metadata?.universName || '',
        universVersion: data.metadata?.universVersion || data.universVersion || 1,
        isFromMarketplace: data.metadata?.isFromMarketplace ?? false,
        paymentId: data.metadata?.paymentId,
        purchaseDate: data.metadata?.purchaseDate?.toDate() || undefined
      },
      versionHistory: data.versionHistory?.map((vh: any) => ({
        previousVersion: vh.previousVersion,
        upgradedAt: vh.upgradedAt?.toDate() || new Date(),
        upgradedFromInstanceId: vh.upgradedFromInstanceId,
        dataMigrated: vh.dataMigrated ?? false
      })) || undefined,
      latestAvailableVersion: data.latestAvailableVersion || undefined,
      updateAvailable: data.updateAvailable ?? false
    } as UniversInstance;
  }

  /**
   * Créer un nouveau Univers
   * 
   * @param univers - Les données du Univers à créer (sans l'ID qui sera généré)
   * @returns L'ID du Univers créé
   * @throws Error si la validation échoue ou si la création échoue
   */
  async create(univers: Omit<Univers, 'id'>): Promise<string> {
    try {
      // Validation des prérequis
      if (!univers.metadata?.name || !univers.metadata.name.trim()) {
        throw new Error('Le nom du Univers est requis');
      }

      if (!univers.ownership?.createdBy) {
        throw new Error('Le créateur du Univers est requis');
      }

      // Validation: au moins un formulaire est requis (sauf pour l'univers par défaut)
      const forms = univers.definitions?.forms || [];
      const isDefault = univers.metadata?.isDefault === true;
      if (forms.length === 0 && !isDefault) {
        throw new Error('Au moins un formulaire est requis pour créer un Univers');
      }

      // Préparer les définitions avec des tableaux vides pour Lists/Reports si non fournis
      // Normaliser les ListDefinition pour s'assurer que les rows sont bien présentes
      const rawLists = univers.definitions?.lists || [];
      const normalizedLists = rawLists.map((listDef: any) => {
        const normalized = {
          id: listDef.id || '',
          name: listDef.name || '',
          description: listDef.description || undefined,
          columns: Array.isArray(listDef.columns) ? listDef.columns : [],
          // CRITIQUE: S'assurer que rows est toujours un tableau
          rows: Array.isArray(listDef.rows) ? listDef.rows : []
        };
        
        return normalized;
      });

      const definitions: UniversDefinitions = {
        forms: forms,
        dashboards: univers.definitions?.dashboards || [],
        instructions: univers.definitions?.instructions || [],
        lists: normalizedLists,
        reports: univers.definitions?.reports || [] // Peut être vide (Coming Soon)
      };

      // Préparer les métadonnées avec valeurs par défaut
      const isMarketplace = univers.ownership.isMarketplaceTemplate || false;
      const metadata: UniversMetadata = {
        name: univers.metadata.name.trim(),
        description: univers.metadata.description?.trim() || '',
        iconUrl: univers.metadata.iconUrl || undefined,
        category: univers.metadata.category || undefined,
        tags: univers.metadata.tags || [],
        version: univers.metadata.version || 1,
        createdAt: univers.metadata.createdAt || new Date(),
        // INCLURE TOUS LES CHAMPS IMPORTANTS DE univers.metadata
        isDefault: univers.metadata.isDefault === true,
        isActive: univers.metadata.isActive === true,
        packageAccess: univers.metadata.packageAccess || undefined,
        // Pour les univers marketplace : publishedVersion sera défini après approbation
        // Pour les univers privés : publishedVersion n'est pas nécessaire
        publishedVersion: isMarketplace ? undefined : undefined
      };

      // Préparer l'ownership avec valeurs par défaut
      const ownership: UniversOwnership = {
        createdBy: univers.ownership.createdBy,
        agencyId: univers.ownership.agencyId || undefined,
        isMarketplaceTemplate: univers.ownership.isMarketplaceTemplate || false,
        approvalStatus: univers.ownership.approvalStatus || 
          (univers.ownership.isMarketplaceTemplate ? 'pending' : 'approved'),
        approvedBy: univers.ownership.approvedBy || undefined,
        approvedAt: univers.ownership.approvedAt || undefined,
        rejectionReason: univers.ownership.rejectionReason || undefined,
        allowedDirectorIds: univers.ownership.allowedDirectorIds || [],
        allowedAgencyIds: univers.ownership.allowedAgencyIds || []
      };

      // Préparer l'usage avec valeurs par défaut
      const usage: UniversUsage = {
        totalUsages: univers.usage?.totalUsages || 0,
        lastUsedAt: univers.usage?.lastUsedAt || undefined
      };

      // Helper function to remove undefined values
      // IMPORTANT: Preserve empty arrays (especially for list rows) and null values
      const removeUndefined = (obj: any): any => {
        if (obj === null) return null; // Preserve null
        if (obj === undefined) return undefined; // Will be filtered out
        if (Array.isArray(obj)) {
          // Always preserve arrays, even if empty (important for rows: [])
          return obj.map(removeUndefined);
        }
        if (typeof obj === 'object' && obj.constructor === Object) {
          return Object.keys(obj).reduce((acc, key) => {
            const value = obj[key];
            if (value !== undefined) {
              acc[key] = removeUndefined(value);
            }
            return acc;
          }, {} as any);
        }
        return obj;
      };

      // Créer le document dans Firestore (en omettant les valeurs undefined)
      const docRef = await addDoc(collection(db, this.collectionName), removeUndefined({
        metadata: {
          ...metadata,
          createdAt: Timestamp.fromDate(metadata.createdAt)
        },
        ownership: {
          ...ownership,
          approvedAt: ownership.approvedAt ? Timestamp.fromDate(ownership.approvedAt) : null
        },
        definitions: definitions,
        usage: {
          totalUsages: usage.totalUsages,
          lastUsedAt: usage.lastUsedAt ? Timestamp.fromDate(usage.lastUsedAt) : null
        }
      }));

      console.log(`Univers créé avec succès: ${docRef.id}`);
      return docRef.id;
    } catch (error) {
      console.error('Erreur lors de la création du Univers:', error);
      
      // Re-throw avec un message plus explicite si c'est notre erreur
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Erreur lors de la création du Univers. Veuillez réessayer.');
    }
  }

  /**
   * Mettre à jour un Univers
   */
  /**
   * Recursively remove undefined values from an object to prevent Firestore errors
   * Preserves Firestore FieldValue objects like deleteField() and serverTimestamp()
   */
  private removeUndefinedValues(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }
    
    // Preserve Firestore FieldValue objects (deleteField, serverTimestamp, etc.)
    // These objects have special internal properties that we should not modify
    if (typeof obj === 'object' && obj.constructor === Object) {
      // Check if this is a Firestore FieldValue by checking for internal methods
      // FieldValue objects typically have _methodName or _delegate properties
      if (obj._methodName || obj._delegate || typeof obj._toFieldTransform === 'function') {
        return obj; // Preserve FieldValue objects as-is
      }
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.removeUndefinedValues(item));
    }
    
    if (typeof obj === 'object' && obj.constructor === Object) {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          cleaned[key] = this.removeUndefinedValues(value);
        }
      }
      return cleaned;
    }
    
    return obj;
  }

  /**
   * Convertir les données Firestore en UniversVersion
   */
  private convertFirestoreToUniversVersion(id: string, data: any): UniversVersion {
    return {
      id,
      universId: data.universId,
      version: data.version,
      previousVersion: data.previousVersion,
      createdBy: data.createdBy,
      createdAt: data.createdAt?.toDate() || new Date(),
      approvedBy: data.approvedBy,
      approvedAt: data.approvedAt?.toDate() || undefined,
      approvalStatus: data.approvalStatus || 'pending',
      rejectionReason: data.rejectionReason,
      changes: data.changes
    } as UniversVersion;
  }

  async update(id: string, updates: Partial<Univers>, updatedBy?: string): Promise<void> {
    // Déclarer les variables en dehors du try pour qu'elles soient accessibles dans le catch
    let currentUnivers: Univers | null = null;
    let finalUpdateData: any = null;
    
    try {
      console.log('🔍 universService.update - START', {
        universId: id,
        updatedBy,
        hasUpdates: !!updates,
        updateKeys: updates ? Object.keys(updates) : []
      });

      // 1. Récupérer le Univers actuel pour obtenir la version actuelle
      console.log('🔍 universService.update - Fetching current Univers...');
      currentUnivers = await this.getById(id);
      if (!currentUnivers) {
        throw new Error(`Univers not found: ${id}`);
      }

      console.log('🔍 universService.update - Current Univers data:', {
        id: currentUnivers.id,
        version: currentUnivers.metadata.version,
        isMarketplace: currentUnivers.ownership.isMarketplaceTemplate,
        approvalStatus: currentUnivers.ownership.approvalStatus,
        createdBy: currentUnivers.ownership.createdBy,
        updatedBy: updatedBy
      });

      const wasMarketplace = currentUnivers.ownership.isMarketplaceTemplate;
      
      // NOUVEAU: Pour les univers marketplace existants, utiliser saveDraft() au lieu de modifier directement
      if (wasMarketplace && updatedBy && currentUnivers.ownership.createdBy === updatedBy) {
        console.log('🔍 universService.update - Marketplace universe detected, using saveDraft() instead');
        await this.saveDraft(id, updates, updatedBy);
        return; // Sortir ici, saveDraft() a géré la sauvegarde
      }

      const docRef = doc(db, this.collectionName, id);
      const currentVersion = currentUnivers.metadata.version || 1;

      // 2. Initialiser updateData avec les updates (sans nettoyer undefined maintenant)
      // On nettoiera undefined après avoir défini les valeurs ownership
      const updateData: any = { ...updates };
      
      // Normaliser les ListDefinition dans updateData.definitions si présentes
      if (updateData.definitions?.lists) {
        const normalizedLists = updateData.definitions.lists.map((listDef: any) => {
          return {
            id: listDef.id || '',
            name: listDef.name || '',
            description: listDef.description || undefined,
            columns: Array.isArray(listDef.columns) ? listDef.columns : [],
            rows: Array.isArray(listDef.rows) ? listDef.rows : []
          };
        });
        updateData.definitions = {
          ...updateData.definitions,
          lists: normalizedLists
        };
      }
      
      // 3. Gérer isMarketplaceTemplate et approvalStatus
      // Détecter si on passe en marketplace (via ownership.isMarketplaceTemplate)
      const isNowMarketplace = updateData.ownership?.isMarketplaceTemplate ?? wasMarketplace;

      // 4. Calculer la nouvelle version en fonction du type d'univers et des versions approuvées
      let newVersion: number;
      
      if (isNowMarketplace) {
        // Pour marketplace, déterminer la version basée sur les versions approuvées
        const versions = await this.getVersionsByUnivers(id);
        const approvedVersions = versions.filter(v => v.approvalStatus === 'approved');
        
        if (approvedVersions.length === 0) {
          // Aucune version approuvée : utiliser v1 (première soumission ou resoumission après rejet)
          newVersion = 1;
          console.log(`📌 Univers marketplace: aucune version approuvée, nouvelle version = v1`);
        } else {
          // Au moins une version approuvée : incrémenter à partir de la dernière version approuvée
          const lastApprovedVersion = approvedVersions[0]; // Déjà trié par version desc
          newVersion = lastApprovedVersion.version + 1;
          console.log(`📌 Univers marketplace: dernière version approuvée = v${lastApprovedVersion.version}, nouvelle version = v${newVersion}`);
        }
      } else {
        // Pour les univers privés, incrémenter normalement
        newVersion = currentVersion + 1;
        console.log(`📌 Univers privé: version actuelle = v${currentVersion}, nouvelle version = v${newVersion}`);
      }

      // 5. Incrémenter automatiquement metadata.version
      if (!updateData.metadata) {
        updateData.metadata = {};
      }
      updateData.metadata.version = newVersion;
      const isStayingMarketplace = wasMarketplace && isNowMarketplace;
      
      console.log('🔍 universService.update - Marketplace detection:', {
        wasMarketplace,
        isNowMarketplace,
        isBecomingMarketplace: !wasMarketplace && isNowMarketplace,
        isStayingMarketplace,
        updateDataOwnership: updateData.ownership
      });

      // Initialiser ownership si nécessaire
      if (!updateData.ownership) {
        updateData.ownership = {};
      }
      
      // CRITIQUE: Préserver createdBy si non fourni dans les updates
      // createdBy ne doit JAMAIS être modifié lors d'une mise à jour
      if (!updateData.ownership.createdBy) {
        updateData.ownership.createdBy = currentUnivers.ownership.createdBy;
      } else {
        // Même si createdBy est fourni, vérifier qu'il correspond (sécurité)
        // On ne permet JAMAIS de changer le créateur d'un Univers
        if (updateData.ownership.createdBy !== currentUnivers.ownership.createdBy) {
          console.warn('⚠️ Attempted to change createdBy, preserving original');
          updateData.ownership.createdBy = currentUnivers.ownership.createdBy;
        }
      }

      // IMPORTANT: deleteField() doit être utilisé au niveau supérieur avec notation pointée
      // On va construire un objet séparé pour les champs à supprimer
      const fieldsToDelete: Record<string, any> = {};

      // Si on passe en marketplace pour la première fois
      if (!wasMarketplace && isNowMarketplace) {
        console.log('🔍 universService.update - Becoming marketplace for first time');
        updateData.ownership.isMarketplaceTemplate = true;
        updateData.ownership.approvalStatus = 'pending';
        // Utiliser la notation pointée pour deleteField()
        fieldsToDelete['ownership.approvedBy'] = deleteField();
        fieldsToDelete['ownership.approvedAt'] = deleteField();
        fieldsToDelete['ownership.rejectionReason'] = deleteField();
      }
      // Si c'était déjà marketplace et qu'on modifie
      else if (isStayingMarketplace) {
        console.log('🔍 universService.update - Staying marketplace, current approvalStatus:', currentUnivers.ownership.approvalStatus);
        // Mettre approvalStatus = pending si c'était approved (modification nécessite réapprobation)
        // OU si c'était rejected (resoumission après rejet)
        if (currentUnivers.ownership.approvalStatus === 'approved' || currentUnivers.ownership.approvalStatus === 'rejected') {
          console.log(`🔍 universService.update - Marketplace template (${currentUnivers.ownership.approvalStatus}) modified, setting to pending`);
          updateData.ownership.approvalStatus = 'pending';
          // Réinitialiser les champs d'approbation et de rejet avec notation pointée
          fieldsToDelete['ownership.approvedBy'] = deleteField();
          fieldsToDelete['ownership.approvedAt'] = deleteField();
          fieldsToDelete['ownership.rejectionReason'] = deleteField();
        }
        // S'assurer que isMarketplaceTemplate reste true
        updateData.ownership.isMarketplaceTemplate = true;
      }
      // Si on passe de marketplace à privé
      else if (wasMarketplace && !isNowMarketplace) {
        console.log('🔍 universService.update - Switching from marketplace to private');
        updateData.ownership.isMarketplaceTemplate = false;
        updateData.ownership.approvalStatus = 'approved';
        // Utiliser la notation pointée pour deleteField()
        fieldsToDelete['ownership.approvedBy'] = deleteField();
        fieldsToDelete['ownership.approvedAt'] = deleteField();
        fieldsToDelete['ownership.rejectionReason'] = deleteField();
        // Si agencyId existe et qu'on passe en privé, on peut le supprimer
        // Mais seulement si il n'est pas explicitement fourni dans les updates
        if (currentUnivers.ownership.agencyId && !updates.ownership?.hasOwnProperty('agencyId')) {
          fieldsToDelete['ownership.agencyId'] = deleteField();
        }
      }
      
      // Si on passe en privé (pas de marketplace avant), supprimer agencyId si présent
      if (!isNowMarketplace && !wasMarketplace && currentUnivers.ownership.agencyId) {
        // Si agencyId n'est pas fourni dans les updates, on veut le supprimer
        if (!updates.ownership?.hasOwnProperty('agencyId')) {
          fieldsToDelete['ownership.agencyId'] = deleteField();
        }
      }
      
      // Convertir les dates en Timestamps Firestore
      // Vérifier que ce sont bien des objets Date avant de convertir
      // Ne pas convertir les FieldValue comme deleteField() ou serverTimestamp()
      const isFieldValue = (value: any): boolean => {
        // Vérifier si c'est un FieldValue Firestore (deleteField, serverTimestamp, etc.)
        return value && typeof value === 'object' && (
          value._methodName !== undefined ||
          value._delegate !== undefined ||
          typeof value._toFieldTransform === 'function'
        );
      };

      if (updateData.metadata?.createdAt) {
        if (isFieldValue(updateData.metadata.createdAt)) {
          // C'est un FieldValue (deleteField, serverTimestamp, etc.), ne pas convertir
          // Ne rien faire
        } else if (updateData.metadata.createdAt instanceof Date) {
          updateData.metadata.createdAt = Timestamp.fromDate(updateData.metadata.createdAt);
        } else if (updateData.metadata.createdAt?.toDate) {
          // Déjà un Timestamp Firestore, le garder tel quel
          // Ne rien faire
        } else {
          console.warn('⚠️ metadata.createdAt is not a Date or Timestamp, skipping conversion');
        }
      }
      if (updateData.ownership?.approvedAt) {
        if (isFieldValue(updateData.ownership.approvedAt)) {
          // C'est un FieldValue (deleteField, serverTimestamp, etc.), ne pas convertir
          // Ne rien faire
        } else if (updateData.ownership.approvedAt instanceof Date) {
          updateData.ownership.approvedAt = Timestamp.fromDate(updateData.ownership.approvedAt);
        } else if (updateData.ownership.approvedAt?.toDate) {
          // Déjà un Timestamp Firestore, le garder tel quel
          // Ne rien faire
        } else {
          console.warn('⚠️ ownership.approvedAt is not a Date or Timestamp, skipping conversion');
        }
      }
      if (updateData.usage?.lastUsedAt) {
        if (isFieldValue(updateData.usage.lastUsedAt)) {
          // C'est un FieldValue (deleteField, serverTimestamp, etc.), ne pas convertir
          // Ne rien faire
        } else if (updateData.usage.lastUsedAt instanceof Date) {
          updateData.usage.lastUsedAt = Timestamp.fromDate(updateData.usage.lastUsedAt);
        } else if (updateData.usage.lastUsedAt?.toDate) {
          // Déjà un Timestamp Firestore, le garder tel quel
          // Ne rien faire
        } else {
          console.warn('⚠️ usage.lastUsedAt is not a Date or Timestamp, skipping conversion');
        }
      }
      
      // Ensure arrays are never undefined (use empty array instead)
      // This must be done after removeUndefinedValues to avoid removing the field entirely
      if (updateData.metadata) {
        if (updateData.metadata.tags === undefined) {
          // If tags is explicitly set to undefined, don't include it in the update
          // Otherwise ensure it's an array
          if ('tags' in updateData.metadata) {
            updateData.metadata.tags = [];
          }
        } else if (updateData.metadata.tags === null) {
          updateData.metadata.tags = [];
        }
      }
      
      // 5. Supprimer les champs undefined après avoir défini toutes les valeurs
      // Cela supprimera approvedBy, approvedAt, rejectionReason si on passe en marketplace
      finalUpdateData = this.removeUndefinedValues(updateData);
      
      // 5b. Ajouter les champs à supprimer avec notation pointée (deleteField doit être au niveau supérieur)
      if (Object.keys(fieldsToDelete).length > 0) {
        Object.assign(finalUpdateData, fieldsToDelete);
      }
      
      // CRITIQUE: S'assurer que ownership contient toujours createdBy après nettoyage
      // IMPORTANT: Ne pas inclure deleteField() dans l'objet ownership imbriqué
      // Les deleteField() sont déjà dans fieldsToDelete avec notation pointée
      if (finalUpdateData.ownership) {
        // Supprimer tout deleteField() qui pourrait être dans ownership (ne devrait pas arriver)
        const ownershipKeys = Object.keys(finalUpdateData.ownership);
        for (const key of ownershipKeys) {
          if (isFieldValue(finalUpdateData.ownership[key])) {
            console.warn(`⚠️ Found FieldValue in ownership.${key}, removing it (should use notation pointée)`);
            delete finalUpdateData.ownership[key];
          }
        }
        
        // Si createdBy manque après nettoyage, le récupérer du Univers actuel
        if (!finalUpdateData.ownership.createdBy) {
          console.warn('⚠️ createdBy missing after cleanup, restoring from current Univers');
          finalUpdateData.ownership.createdBy = currentUnivers.ownership.createdBy;
        }
        
        // S'assurer que ownership contient au moins createdBy, isMarketplaceTemplate, et approvalStatus
        // Si ownership est vide ou presque vide, c'est un problème
        const ownershipKeysAfterCleanup = Object.keys(finalUpdateData.ownership);
        const requiredKeys = ['createdBy', 'isMarketplaceTemplate', 'approvalStatus'];
        const hasRequiredKeys = requiredKeys.every(key => ownershipKeysAfterCleanup.includes(key));
        
        if (!hasRequiredKeys) {
          console.warn('⚠️ Ownership missing required fields after cleanup, restoring:', {
            current: ownershipKeysAfterCleanup,
            missing: requiredKeys.filter(k => !ownershipKeysAfterCleanup.includes(k))
          });
          
          // Restaurer les champs critiques depuis le Univers actuel
          finalUpdateData.ownership = {
            ...finalUpdateData.ownership,
            createdBy: currentUnivers.ownership.createdBy,
            isMarketplaceTemplate: finalUpdateData.ownership.isMarketplaceTemplate ?? currentUnivers.ownership.isMarketplaceTemplate ?? false,
            approvalStatus: finalUpdateData.ownership.approvalStatus ?? currentUnivers.ownership.approvalStatus ?? 'approved'
          };
          
          // Préserver agencyId s'il existe dans les updates ou dans le Univers actuel
          // Mais seulement si on ne veut pas le supprimer (pas dans fieldsToDelete)
          if (finalUpdateData.ownership.agencyId === undefined && 
              currentUnivers.ownership.agencyId && 
              !fieldsToDelete['ownership.agencyId']) {
            // Ne pas restaurer agencyId si on veut le supprimer (sera undefined dans les updates)
            // Mais si agencyId n'était pas dans les updates, on peut le préserver
            if (!updates.ownership?.hasOwnProperty('agencyId')) {
              finalUpdateData.ownership.agencyId = currentUnivers.ownership.agencyId;
            }
          }
        }
      } else {
        // Si ownership est complètement absent après nettoyage, c'est une erreur critique
        console.error('❌ Ownership completely missing after cleanup, restoring from current Univers');
        finalUpdateData.ownership = {
          createdBy: currentUnivers.ownership.createdBy,
          isMarketplaceTemplate: currentUnivers.ownership.isMarketplaceTemplate || false,
          approvalStatus: currentUnivers.ownership.approvalStatus || 'approved',
          agencyId: currentUnivers.ownership.agencyId
        };
      }
      
      // 6. Créer ou mettre à jour un document UniversVersion pour tracking
      // Calculer previousVersion : si nouvelle version est v1, alors previousVersion = 0
      // Sinon, previousVersion = nouvelle version - 1 (car basée sur la dernière approuvée)
      const previousVersion = newVersion === 1 ? 0 : newVersion - 1;
      
      // CRITIQUE: createdBy doit correspondre à l'utilisateur authentifié pour que les règles Firestore passent
      // Si updatedBy n'est pas fourni, utiliser le créateur de l'univers (qui devrait être l'utilisateur actuel)
      const versionCreatedBy = updatedBy || currentUnivers.ownership.createdBy;
      
      // Vérifier s'il existe déjà un document UniversVersion avec cette version
      // (peut arriver si une version a été rejetée et qu'on resoumet)
      console.log('🔍 universService.update - Checking for existing UniversVersion...', {
        universId: id,
        newVersion,
        versionCreatedBy
      });

      const existingVersionsQuery = query(
        collection(db, this.versionsCollectionName),
        where('universId', '==', id),
        where('version', '==', newVersion)
      );
      
      let existingVersionsSnapshot;
      try {
        existingVersionsSnapshot = await getDocs(existingVersionsQuery);
        console.log('🔍 universService.update - Existing versions query result:', {
          found: !existingVersionsSnapshot.empty,
          count: existingVersionsSnapshot.size
        });
      } catch (error: any) {
        console.error('❌ universService.update - Error querying existing versions:', {
          error: error.message,
          code: error.code,
          stack: error.stack
        });
        throw error;
      }
      
      const versionData: Partial<UniversVersion> = {
        universId: id,
        version: newVersion,
        previousVersion: previousVersion,
        createdBy: versionCreatedBy,
        approvalStatus: isNowMarketplace ? 'pending' : 'approved', // Marketplace requires approval
        changes: {
          metadata: !!updates.metadata,
          definitions: {
            forms: !!updates.definitions?.forms,
            dashboards: !!updates.definitions?.dashboards,
            instructions: !!updates.definitions?.instructions,
            lists: !!updates.definitions?.lists,
            reports: !!updates.definitions?.reports
          }
        }
      };

      // Si un document existe déjà avec cette version, le mettre à jour
      // Sinon, créer un nouveau document
      let versionDocPromise: Promise<void>;
      
      if (!existingVersionsSnapshot.empty) {
        // Mettre à jour le document existant (par exemple, une version rejetée qui est resoumise)
        const existingVersionDoc = existingVersionsSnapshot.docs[0];
        const existingVersionData = existingVersionDoc.data();
        const existingVersionRef = doc(db, this.versionsCollectionName, existingVersionDoc.id);
        
        console.log('🔍 universService.update - Updating existing UniversVersion:', {
          versionId: existingVersionDoc.id,
          existingCreatedBy: existingVersionData.createdBy,
          versionCreatedBy,
          currentUserId: updatedBy || currentUnivers.ownership.createdBy
        });
        
        // IMPORTANT: Ne pas modifier createdBy lors de la mise à jour (doit rester celui du créateur original)
        // Les règles Firestore vérifient que resource.data.createdBy == request.auth.uid
        // On ne peut mettre à jour que si le createdBy correspond à l'utilisateur actuel
        
        // Mettre à jour le document existant avec les nouvelles données (sans modifier createdBy)
        const updateVersionData: any = {
          universId: versionData.universId,
          version: versionData.version,
          previousVersion: versionData.previousVersion,
          // Ne pas inclure createdBy - il reste celui du document existant
          approvalStatus: versionData.approvalStatus,
          changes: versionData.changes,
          rejectionReason: deleteField() // Supprimer le rejectionReason si présent
        };
        
        console.log('🔍 universService.update - UniversVersion update data:', {
          updateVersionData,
          existingCreatedBy: existingVersionData.createdBy
        });
        
        try {
          versionDocPromise = updateDoc(existingVersionRef, updateVersionData);
          console.log(`📝 Mise à jour du document UniversVersion existant (v${newVersion})`);
        } catch (error: any) {
          console.error('❌ universService.update - Error updating UniversVersion:', {
            error: error.message,
            code: error.code,
            versionId: existingVersionDoc.id,
            existingCreatedBy: existingVersionData.createdBy,
            currentUserId: updatedBy || currentUnivers.ownership.createdBy
          });
          throw error;
        }
      } else {
        // Créer un nouveau document UniversVersion
        console.log('🔍 universService.update - Creating new UniversVersion:', {
          versionData,
          versionCreatedBy
        });
        
        const versionDocRef = doc(collection(db, this.versionsCollectionName));
        
        const newVersionDocData = {
          ...versionData,
          createdAt: serverTimestamp()
        };
        
        console.log('🔍 universService.update - New UniversVersion data:', newVersionDocData);
        
        try {
          versionDocPromise = setDoc(versionDocRef, newVersionDocData);
          console.log(`📝 Création d'un nouveau document UniversVersion (v${newVersion})`);
        } catch (error: any) {
          console.error('❌ universService.update - Error creating UniversVersion:', {
            error: error.message,
            code: error.code,
            versionData,
            versionCreatedBy
          });
          throw error;
        }
      }

      // Exécuter la mise à jour du Univers et la création/mise à jour du UniversVersion en parallèle
      console.log('🔍 universService.update - Final update data for Univers:', {
        finalUpdateData,
        ownership: finalUpdateData.ownership,
        metadata: finalUpdateData.metadata ? { version: finalUpdateData.metadata.version } : null
      });
      
      try {
        console.log('🔍 universService.update - Attempting to update Univers document...');
        await updateDoc(docRef, finalUpdateData);
        console.log('✅ universService.update - Univers document updated successfully');
      } catch (error: any) {
        console.error('❌ universService.update - Error updating Univers document:', {
          error: error.message,
          code: error.code,
          universId: id,
          currentCreatedBy: currentUnivers.ownership.createdBy,
          finalUpdateDataOwnership: finalUpdateData.ownership,
          stack: error.stack
        });
        throw error;
      }
      
      try {
        console.log('🔍 universService.update - Attempting to create/update UniversVersion...');
        await versionDocPromise;
        console.log('✅ universService.update - UniversVersion created/updated successfully');
      } catch (error: any) {
        console.error('❌ universService.update - Error with UniversVersion:', {
          error: error.message,
          code: error.code,
          versionCreatedBy,
          stack: error.stack
        });
        throw error;
      }

      console.log(`✅ Univers updated: ${id} (v${currentVersion} → v${newVersion})`);
      if (isNowMarketplace) {
        console.log(`   Approval status set to: pending (requires admin approval)`);
      } else {
        // Pour les Univers privés, appliquer automatiquement la mise à jour aux instances actives
        // Pas de validation requise, la mise à jour est immédiate
        console.log(`   Univers privé: application automatique de la mise à jour...`);
        try {
          // Trouver toutes les instances actives de ce Univers
          const instances = await this.getInstancesByUnivers(id);
          const activeInstances = instances.filter(inst => inst.isActive);
          
          if (activeInstances.length > 0) {
            console.log(`   ${activeInstances.length} instance(s) active(s) trouvée(s), mise à jour automatique...`);
            
            // Pour chaque instance active, mettre à jour automatiquement vers la nouvelle version
            for (const instance of activeInstances) {
              try {
                // Vérifier si l'instance est à une version antérieure
                const instanceVersion = instance.universVersion || instance.metadata?.universVersion || 1;
                if (instanceVersion < newVersion) {
                  console.log(`   Mise à jour automatique de l'instance ${instance.id} (v${instanceVersion} → v${newVersion})...`);
                  
                  // Mettre à jour l'instance vers la nouvelle version
                  // On utilise upgradeInstance pour gérer la migration des données
                  // Récupérer le rôle de l'utilisateur depuis la base de données
                  let userRole: 'directeur' | 'employe' | 'admin' = 'directeur';
                  try {
                    const userDoc = await getDoc(doc(db, 'users', instance.userId));
                    if (userDoc.exists()) {
                      const userData = userDoc.data();
                      userRole = (userData.role || 'directeur') as 'directeur' | 'employe' | 'admin';
                    }
                  } catch (roleError) {
                    console.warn(`⚠️ Impossible de récupérer le rôle de l'utilisateur ${instance.userId}, utilisation de 'directeur' par défaut`);
                  }
                  
                  await this.upgradeInstance(
                    instance.id,
                    instance.userId,
                    userRole,
                    instance.agencyId
                  );
                  
                  console.log(`   ✅ Instance ${instance.id} mise à jour automatiquement vers v${newVersion}`);
                } else {
                  console.log(`   Instance ${instance.id} déjà à la version ${instanceVersion}, pas de mise à jour nécessaire`);
                }
              } catch (upgradeError) {
                console.error(`   ⚠️ Erreur lors de la mise à jour automatique de l'instance ${instance.id}:`, upgradeError);
                // Ne pas faire échouer la mise à jour du Univers si une instance échoue
                // L'utilisateur pourra mettre à jour manuellement via le bouton
              }
            }
          } else {
            console.log(`   Aucune instance active trouvée, pas de mise à jour automatique nécessaire`);
          }
        } catch (autoUpdateError) {
          console.error(`   ⚠️ Erreur lors de l'application automatique de la mise à jour (non-blocking):`, autoUpdateError);
          // Ne pas faire échouer la mise à jour du Univers si l'application automatique échoue
        }
      }
    } catch (error: any) {
      console.error('❌ universService.update - ERROR DETAILS:', {
        error: error.message,
        code: error.code,
        stack: error.stack,
        universId: id,
        updatedBy,
        errorName: error.name
      });
      
      // Log supplémentaire pour les erreurs de permissions
      if (error.code === 'permission-denied' || error.message?.toLowerCase().includes('permission')) {
        console.error('🔒 PERMISSION DENIED - Details:', {
          universId: id,
          updatedBy,
          errorCode: error.code,
          errorMessage: error.message,
          // Ces variables peuvent ne pas être définies si l'erreur se produit tôt
          hasCurrentUnivers: currentUnivers !== null,
          currentUnivers: currentUnivers ? {
            createdBy: currentUnivers.ownership?.createdBy,
            isMarketplace: currentUnivers.ownership?.isMarketplaceTemplate,
            approvalStatus: currentUnivers.ownership?.approvalStatus
          } : null,
          hasFinalUpdateData: finalUpdateData !== null,
          finalUpdateDataOwnership: finalUpdateData?.ownership || null
        });
      }
      
      throw error;
    }
  }

  /**
   * Supprimer un Univers
   */
  async delete(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, this.collectionName, id));
    } catch (error) {
      console.error('Erreur lors de la suppression du Univers:', error);
      throw error;
    }
  }

  /**
   * Récupérer un Univers par ID
   */
  async getById(id: string, userId?: string): Promise<Univers | null> {
    try {
      const docRef = doc(db, this.collectionName, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const univers = this.convertFirestoreToUnivers(docSnap.id, docSnap.data());
        
        // Si userId est fourni et que c'est le créateur, fusionner le draft avec les données principales
        if (userId && univers.ownership.createdBy === userId && univers.draftData) {
          // Fusionner draftData avec les données principales pour le créateur
          return this.mergeDraftWithPublished(univers);
        }
        
        return univers;
      }
      return null;
    } catch (error) {
      console.error('Erreur lors de la récupération du Univers:', error);
      throw error;
    }
  }

  /**
   * Fusionner les données draft avec les données publiées pour le créateur
   * Retourne un Univers avec les données draft appliquées
   */
  private mergeDraftWithPublished(univers: Univers): Univers {
    if (!univers.draftData) {
      return univers;
    }

    const draft = univers.draftData;
    
    // Fusionner les métadonnées
    const mergedMetadata: UniversMetadata = {
      ...univers.metadata,
      ...(draft.metadata || {}),
      // Préserver publishedVersion et version
      publishedVersion: univers.metadata.publishedVersion || univers.metadata.version,
      version: draft.metadata?.version || univers.metadata.version
    };

    // Fusionner les définitions
    // Normaliser les ListDefinition pour s'assurer que les rows sont préservées
    const draftLists = draft.definitions?.lists || [];
    const publishedLists = univers.definitions.lists || [];
    const mergedLists = draftLists.length > 0 ? draftLists : publishedLists;
    
    // Normaliser les ListDefinition fusionnées
    const normalizedMergedLists = mergedLists.map((listDef: any) => this.normalizeListDefinition(listDef));
    
    const mergedDefinitions: UniversDefinitions = {
      forms: draft.definitions?.forms || univers.definitions.forms,
      dashboards: draft.definitions?.dashboards || univers.definitions.dashboards,
      instructions: draft.definitions?.instructions || univers.definitions.instructions,
      lists: normalizedMergedLists,
      reports: draft.definitions?.reports || univers.definitions.reports
    };
    
    return {
      ...univers,
      metadata: mergedMetadata,
      definitions: mergedDefinitions
    };
  }

  /**
   * Récupérer la version draft d'un Univers (pour le créateur uniquement)
   */
  async getDraftVersion(id: string, userId: string): Promise<Univers | null> {
    try {
      const univers = await this.getById(id, userId);
      if (!univers) {
        return null;
      }

      // Vérifier que c'est le créateur
      if (univers.ownership.createdBy !== userId) {
        throw new Error('Seul le créateur peut accéder à la version draft');
      }

      // Si pas de draft, retourner null
      if (!univers.draftData || !univers.hasUnpublishedChanges) {
        return null;
      }

      // Retourner la version fusionnée (draft + published)
      return this.mergeDraftWithPublished(univers);
    } catch (error) {
      console.error('Erreur lors de la récupération de la version draft:', error);
      throw error;
    }
  }

  /**
   * Sauvegarder les modifications dans le draft (pour les univers marketplace uniquement)
   * Ne modifie pas la version publiée
   */
  async saveDraft(id: string, updates: Partial<Univers>, updatedBy: string): Promise<void> {
    try {
      console.log('🔍 universService.saveDraft - START', {
        universId: id,
        updatedBy,
        hasUpdates: !!updates
      });

      // Récupérer le Univers actuel
      const currentUnivers = await this.getById(id);
      if (!currentUnivers) {
        throw new Error(`Univers not found: ${id}`);
      }

      // Vérifier que c'est le créateur
      if (currentUnivers.ownership.createdBy !== updatedBy) {
        throw new Error('Seul le créateur peut sauvegarder un draft');
      }

      // Vérifier que c'est un univers marketplace
      if (!currentUnivers.ownership.isMarketplaceTemplate) {
        throw new Error('saveDraft() ne peut être utilisé que pour les univers marketplace. Utilisez update() pour les univers privés.');
      }

      const docRef = doc(db, this.collectionName, id);
      
      // Calculer la nouvelle version draft
      const currentDraftVersion = currentUnivers.draftData?.draftVersion || 0;
      const newDraftVersion = currentDraftVersion + 1;

      // Normaliser les ListDefinition dans les updates si présents
      let normalizedDefinitions = updates.definitions;
      if (updates.definitions?.lists) {
        const normalizedLists = updates.definitions.lists.map((listDef: any) => {
          return {
            id: listDef.id || '',
            name: listDef.name || '',
            description: listDef.description || undefined,
            columns: Array.isArray(listDef.columns) ? listDef.columns : [],
            rows: Array.isArray(listDef.rows) ? listDef.rows : []
          };
        });
        normalizedDefinitions = {
          ...updates.definitions,
          lists: normalizedLists
        };
      }

      // Préparer les données du draft
      const draftData: UniversDraftData = {
        metadata: updates.metadata ? {
          ...updates.metadata,
          // Ne pas inclure publishedVersion dans le draft
          publishedVersion: undefined
        } : currentUnivers.draftData?.metadata,
        definitions: normalizedDefinitions || currentUnivers.draftData?.definitions,
        draftVersion: newDraftVersion,
        updatedAt: new Date()
      };

      // Convertir les dates en Timestamps Firestore
      const draftDataForFirestore: any = {
        ...draftData,
        updatedAt: Timestamp.fromDate(draftData.updatedAt!)
      };

      if (draftDataForFirestore.metadata?.createdAt) {
        draftDataForFirestore.metadata.createdAt = Timestamp.fromDate(draftDataForFirestore.metadata.createdAt);
      }

      // Nettoyer les valeurs undefined
      const cleanDraftData = this.removeUndefinedValues(draftDataForFirestore);

      // Mettre à jour le document avec le draft
      await updateDoc(docRef, {
        draftData: cleanDraftData,
        hasUnpublishedChanges: true
      });

      console.log(`✅ Draft saved: ${id} (draft v${newDraftVersion})`);
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde du draft:', error);
      throw error;
    }
  }

  /**
   * Publier le draft au marketplace (créer une UniversVersion avec pending)
   * La version publiée actuelle reste disponible dans le marketplace
   */
  async publishDraft(id: string, updatedBy: string): Promise<void> {
    try {
      console.log('🔍 universService.publishDraft - START', {
        universId: id,
        updatedBy
      });

      // Récupérer le Univers actuel
      const currentUnivers = await this.getById(id, updatedBy);
      if (!currentUnivers) {
        throw new Error(`Univers not found: ${id}`);
      }

      // Vérifier que c'est le créateur
      if (currentUnivers.ownership.createdBy !== updatedBy) {
        throw new Error('Seul le créateur peut publier un draft');
      }

      // Vérifier qu'il y a un draft
      if (!currentUnivers.draftData || !currentUnivers.hasUnpublishedChanges) {
        throw new Error('Aucun draft à publier');
      }

      // Validation : vérifier que le draft contient des données valides
      const draft = currentUnivers.draftData;
      if (!draft.metadata && !draft.definitions) {
        throw new Error('Le draft est vide. Veuillez ajouter des modifications avant de publier.');
      }

      // Validation : vérifier qu'au moins un formulaire est présent (si definitions est modifié)
      if (draft.definitions) {
        const forms = draft.definitions.forms || currentUnivers.definitions.forms || [];
        if (forms.length === 0 && !currentUnivers.metadata.isDefault) {
          throw new Error('Au moins un formulaire est requis pour publier un Univers');
        }
      }

      // Vérifier que c'est un univers marketplace
      if (!currentUnivers.ownership.isMarketplaceTemplate) {
        throw new Error('publishDraft() ne peut être utilisé que pour les univers marketplace');
      }
      
      // Calculer la nouvelle version basée sur les versions approuvées
      const versions = await this.getVersionsByUnivers(id);
      const approvedVersions = versions.filter(v => v.approvalStatus === 'approved');
      
      let newVersion: number;
      if (approvedVersions.length === 0) {
        newVersion = 1;
      } else {
        const lastApprovedVersion = approvedVersions[0];
        newVersion = lastApprovedVersion.version + 1;
      }

      // Créer un document UniversVersion avec approvalStatus: 'pending'
      // Utiliser draft qui a été déclaré plus haut
      const versionData: Partial<UniversVersion> = {
        universId: id,
        version: newVersion,
        previousVersion: currentUnivers.metadata.publishedVersion || (newVersion - 1),
        createdBy: updatedBy,
        approvalStatus: 'pending',
        changes: {
          metadata: !!draft.metadata,
          definitions: {
            forms: !!draft.definitions?.forms,
            dashboards: !!draft.definitions?.dashboards,
            instructions: !!draft.definitions?.instructions,
            lists: !!draft.definitions?.lists,
            reports: !!draft.definitions?.reports
          }
        }
      };

      const versionDocRef = doc(collection(db, this.versionsCollectionName));
      await setDoc(versionDocRef, {
        ...versionData,
        createdAt: serverTimestamp()
      });

      // Mettre à jour le statut d'approbation du Univers (mais garder la version publiée)
      const docRef = doc(db, this.collectionName, id);
      await updateDoc(docRef, {
        'ownership.approvalStatus': 'pending',
        'ownership.approvedBy': deleteField(),
        'ownership.approvedAt': deleteField(),
        'ownership.rejectionReason': deleteField()
      });

      console.log(`✅ Draft published to marketplace: ${id} (v${newVersion} pending approval)`);
      console.log(`   Published version ${currentUnivers.metadata.publishedVersion || currentUnivers.metadata.version} remains available`);
    } catch (error) {
      console.error('❌ Erreur lors de la publication du draft:', error);
      throw error;
    }
  }

  /**
   * Annuler le draft (supprimer le draft et revenir à la version publiée)
   * Permet au créateur de supprimer le draft et revenir à la version publiée
   */
  async cancelDraft(id: string, userId: string): Promise<void> {
    try {
      console.log('🔍 universService.cancelDraft - START', {
        universId: id,
        userId
      });

      // Récupérer le Univers actuel
      const currentUnivers = await this.getById(id, userId);
      if (!currentUnivers) {
        throw new Error(`Univers not found: ${id}`);
      }

      // Vérifier que c'est le créateur
      if (currentUnivers.ownership.createdBy !== userId) {
        throw new Error('Seul le créateur peut annuler un draft');
      }

      // Vérifier qu'il y a un draft
      if (!currentUnivers.draftData || !currentUnivers.hasUnpublishedChanges) {
        throw new Error('Aucun draft à annuler');
      }

      // Vérifier que c'est un univers marketplace
      if (!currentUnivers.ownership.isMarketplaceTemplate) {
        throw new Error('cancelDraft() ne peut être utilisé que pour les univers marketplace');
      }

      const docRef = doc(db, this.collectionName, id);
      
      // Supprimer le draftData et hasUnpublishedChanges
      await updateDoc(docRef, {
        draftData: deleteField(),
        hasUnpublishedChanges: false
      });

      console.log(`✅ Draft cancelled: ${id}`);
    } catch (error) {
      console.error('❌ Erreur lors de l\'annulation du draft:', error);
      throw error;
    }
  }

  /**
   * Récupérer tous les Univers d'un utilisateur
   * Inclut les Univers privés (sans agencyId) et les Univers partagés avec l'agence
   */
  async getByUser(userId: string, agencyId?: string): Promise<Univers[]> {
    try {
      const allUnivers: Univers[] = [];
      
      // Requête 1: Récupérer tous les Univers créés par l'utilisateur
      // (on ne peut pas faire where sur un champ qui n'existe pas dans Firestore)
      const allQuery = query(
        collection(db, this.collectionName),
        where('ownership.createdBy', '==', userId),
        orderBy('metadata.createdAt', 'desc')
      );
      
      const allSnapshot = await getDocs(allQuery);
      
      // Filtrer côté client:
      // - Univers privés : ownership.agencyId est undefined, null, ou n'existe pas
      // - Univers partagés avec l'agence : ownership.agencyId === agencyId
      // - Univers marketplace créés par l'utilisateur : toujours affichés (même sans agencyId)
      allSnapshot.docs.forEach(doc => {
        const universData = doc.data();
        const universAgencyId = universData.ownership?.agencyId;
        
        // Univers privé (agencyId n'existe pas, est null, ou undefined)
        const isPrivate = !universAgencyId || universAgencyId === null;
        
        // Univers partagé avec l'agence
        const isAgencyShared = agencyId && universAgencyId === agencyId;
        
        // Univers marketplace créé par l'utilisateur : toujours visible pour le créateur
        const isMarketplaceCreatedByUser = universData.ownership?.isMarketplaceTemplate === true;
        
        // Afficher si: privé, partagé avec l'agence, ou marketplace créé par l'utilisateur
        if (isPrivate || isAgencyShared || isMarketplaceCreatedByUser) {
          allUnivers.push(this.convertFirestoreToUnivers(doc.id, universData));
        }
      });
      
      // Trier par date de création (décroissant)
      return allUnivers.sort((a, b) => 
        b.metadata.createdAt.getTime() - a.metadata.createdAt.getTime()
      );
    } catch (error) {
      console.error('Erreur lors de la récupération des Univers:', error);
      throw error;
    }
  }

  /**
   * Récupérer les Univers d'une agence (agence-scoped)
   */
  async getByAgency(agencyId: string): Promise<Univers[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('ownership.agencyId', '==', agencyId),
        where('ownership.isMarketplaceTemplate', '==', false),
        orderBy('metadata.createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => 
        this.convertFirestoreToUnivers(doc.id, doc.data())
      );
    } catch (error) {
      console.error('Erreur lors de la récupération des Univers de l\'agence:', error);
      throw error;
    }
  }

  /**
   * Récupérer les Univers du marketplace (approved templates)
   * Retourne uniquement la version publiée (publishedVersion), pas le draft
   */
  async getMarketplaceTemplates(): Promise<Univers[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('ownership.isMarketplaceTemplate', '==', true),
        where('ownership.approvalStatus', '==', 'approved'),
        orderBy('usage.totalUsages', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const universes = querySnapshot.docs.map(doc => {
        const univers = this.convertFirestoreToUnivers(doc.id, doc.data());
        
        // Pour le marketplace : utiliser uniquement la version publiée
        // Si publishedVersion existe, l'utiliser pour metadata.version
        if (univers.metadata.publishedVersion && univers.metadata.publishedVersion > 0) {
          // Créer une copie avec la version publiée
          return {
            ...univers,
            metadata: {
              ...univers.metadata,
              version: univers.metadata.publishedVersion // Utiliser publishedVersion au lieu de la version draft
            },
            // Ne pas inclure draftData dans le marketplace
            draftData: undefined,
            hasUnpublishedChanges: false
          };
        }
        
        return univers;
      });
      
      // Filtrer pour ne garder que ceux qui ont une publishedVersion (version approuvée disponible)
      // Les univers avec seulement un draft ne doivent pas apparaître dans le marketplace
      return universes.filter(univers => {
        const publishedVersion = univers.metadata.publishedVersion || univers.metadata.version;
        // S'assurer qu'il y a une version publiée valide
        return publishedVersion > 0;
      });
    } catch (error) {
      console.error('Erreur lors de la récupération des Univers du marketplace:', error);
      throw error;
    }
  }

  /**
   * Récupérer tous les Univers d'un directeur (créés + achetés depuis marketplace)
   * Cette méthode combine getByUser() et les instances achetées
   */
  async getUserUnivers(userId: string, agencyId: string): Promise<Univers[]> {
    try {
      const allUnivers: Univers[] = [];
      const universMap = new Map<string, Univers>();

      // 1. Récupérer les Univers créés par l'utilisateur
      const createdUnivers = await this.getByUser(userId, agencyId);
      createdUnivers.forEach(u => {
        universMap.set(u.id, u);
        allUnivers.push(u);
      });

      // 2. Récupérer les instances achetées (marketplace)
      const instances = await this.getInstancesByUser(userId, agencyId);
      
      // 3. Pour chaque instance, récupérer le Univers template correspondant
      const purchasedUniversIds = new Set<string>();
      instances.forEach(instance => {
        if (instance.universId && !universMap.has(instance.universId)) {
          purchasedUniversIds.add(instance.universId);
        }
      });

      // 4. Récupérer les Univers templates pour les instances
      // Pour les univers achetés, utiliser uniquement la version publiée (pas le draft)
      if (purchasedUniversIds.size > 0) {
        const purchasedUniversPromises = Array.from(purchasedUniversIds).map(async (universId) => {
          try {
            // Ne pas passer userId pour éviter de récupérer le draft
            const univers = await this.getById(universId);
            if (univers) {
              // Pour les univers achetés : utiliser uniquement la version publiée
              if (univers.metadata.publishedVersion && univers.metadata.publishedVersion > 0) {
                return {
                  ...univers,
                  metadata: {
                    ...univers.metadata,
                    version: univers.metadata.publishedVersion // Utiliser publishedVersion
                  },
                  // Ne pas inclure draftData pour les univers achetés
                  draftData: undefined,
                  hasUnpublishedChanges: false
                };
              }
              return univers;
            }
            return null;
          } catch (error) {
            console.error(`Erreur lors de la récupération du Univers ${universId}:`, error);
            return null;
          }
        });

        const purchasedUnivers = await Promise.all(purchasedUniversPromises);
        purchasedUnivers.forEach(u => {
          if (u && !universMap.has(u.id)) {
            universMap.set(u.id, u);
            allUnivers.push(u);
          }
        });
      }

      // 5. Trier par date de création (décroissant)
      return allUnivers.sort((a, b) => 
        b.metadata.createdAt.getTime() - a.metadata.createdAt.getTime()
      );
    } catch (error) {
      console.error('Erreur lors de la récupération des Univers de l\'utilisateur:', error);
      throw error;
    }
  }

  /**
   * Créer une instance Univers (quand un utilisateur utilise un template)
   */
  async createInstance(instance: Omit<UniversInstance, 'id'>): Promise<string> {
    try {
      // Remove undefined values before saving to Firestore
      const cleanInstance = this.removeUndefinedValues(instance);
      const docRef = await addDoc(collection(db, this.instancesCollectionName), {
        ...cleanInstance,
        createdAt: serverTimestamp()
      });
      
      // Mettre à jour le compteur d'utilisation du Univers
      await this.incrementUsage(instance.universId);
      // S'assurer que le directeur a un accès explicite au template marketplace
      await this.ensureUniversAccessBridge(instance.universId, instance.userId, instance.agencyId);
      
      return docRef.id;
    } catch (error) {
      console.error('Erreur lors de la création de l\'instance Univers:', error);
      throw error;
    }
  }

  /**
   * Incrémenter le compteur d'utilisation d'un Univers
   * Cette fonction ignore silencieusement les erreurs de permissions Firestore
   * car l'incrémentation du compteur n'est pas critique pour le fonctionnement
   */
  async incrementUsage(universId: string): Promise<void> {
    try {
      const universRef = doc(db, this.collectionName, universId);
      const universSnap = await getDoc(universRef);
      
      if (universSnap.exists()) {
        const data = universSnap.data();
        const currentUsage = data.usage?.totalUsages || 0;
        
        await updateDoc(universRef, {
          'usage.totalUsages': currentUsage + 1,
          'usage.lastUsedAt': serverTimestamp()
        });
      }
    } catch (error: any) {
      // Ignorer silencieusement les erreurs de permissions Firestore
      // L'incrémentation du compteur d'utilisation n'est pas critique
      // et ne doit pas empêcher le fonctionnement normal de l'application
      if (error?.code === 'permission-denied' || 
          error?.code === 'missing-or-insufficient-permissions' ||
          (error?.message && error.message.includes('permission'))) {
        // Erreur de permissions : ignorer silencieusement
        return;
      }
      // Pour les autres erreurs, logger en mode debug seulement
      // Ne pas utiliser console.error pour éviter de polluer les logs
    }
  }

  /**
   * Garantir qu'un directeur dispose d'une entrée "universAccess" pour un template acheté.
   * Cette entrée est utilisée par les règles Firestore pour autoriser la lecture du template marketplace.
   */
  private async ensureUniversAccessBridge(universId: string, directorId: string, agencyId?: string): Promise<void> {
    if (!universId || !directorId) {
      return;
    }

    try {
      const accessRef = doc(db, 'universAccess', universId, 'directors', directorId);
      await setDoc(accessRef, {
        directorId,
        agencyId: agencyId || null,
        grantedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.warn('⚠️ Impossible de créer la passerelle universAccess:', {
        universId,
        directorId,
        agencyId,
        error
      });
      // Ne pas throw : l'instanciation doit continuer, mais l'accès pourra être régénéré via un script d'audit.
    }
  }

  /**
   * Récupérer les instances Univers d'un utilisateur
   */
  async getInstancesByUser(userId: string, agencyId: string): Promise<UniversInstance[]> {
    try {
      const q = query(
        collection(db, this.instancesCollectionName),
        where('userId', '==', userId),
        where('agencyId', '==', agencyId),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => 
        this.convertFirestoreToUniversInstance(doc.id, doc.data())
      );
    } catch (error) {
      console.error('Erreur lors de la récupération des instances Univers:', error);
      throw error;
    }
  }

  /**
   * Récupérer une instance Univers par ID
   */
  async getInstanceById(id: string): Promise<UniversInstance | null> {
    try {
      const docRef = doc(db, this.instancesCollectionName, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return this.convertFirestoreToUniversInstance(docSnap.id, docSnap.data());
      }
      return null;
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'instance Univers:', error);
      throw error;
    }
  }

  /**
   * Supprimer une instance Univers
   */
  async deleteInstance(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, this.instancesCollectionName, id));
    } catch (error) {
      console.error('Erreur lors de la suppression de l\'instance Univers:', error);
      throw error;
    }
  }

  /**
   * Écouter les Univers d'un utilisateur en temps réel
   */
  subscribeToUserUnivers(
    userId: string,
    agencyId: string,
    callback: (univers: Univers[]) => void
  ): () => void {
    const q = query(
      collection(db, this.collectionName),
      where('ownership.createdBy', '==', userId),
      where('ownership.agencyId', '==', agencyId),
      orderBy('metadata.createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const univers = snapshot.docs.map(doc => 
        this.convertFirestoreToUnivers(doc.id, doc.data())
      );
      callback(univers);
    }, (error) => {
      console.error('Erreur lors de l\'écoute des Univers:', error);
    });
  }

  /**
   * Instantiate a Univers template: create concrete resources from definitions
   * 
   * @param universId - ID of the Univers template to instantiate
   * @param userId - ID of the user instantiating the template
   * @param userRole - Role of the user ('directeur' | 'employe' | 'admin')
   * @param agencyId - ID of the agency where resources will be created
   * @returns The created UniversInstance ID and the instantiation result
   * @throws Error if Univers not found, instantiation fails, or instance creation fails
   */
  async instantiate(
    universId: string,
    userId: string,
    userRole: 'directeur' | 'employe' | 'admin',
    agencyId: string,
    useDraft: boolean = false
  ): Promise<{ instanceId: string; result: InstantiationResult }> {
    try {
      // 1. Fetch the Univers template
      // Si useDraft est true et que c'est le créateur, récupérer avec userId pour avoir le draft
      const univers = useDraft 
        ? await this.getById(universId, userId)
        : await this.getById(universId);
      
      if (!univers) {
        throw new Error(`Univers template not found: ${universId}`);
      }

      // Validate that the Univers has definitions
      if (!univers.definitions) {
        throw new Error('Univers template has no definitions');
      }

      // Déterminer la version à utiliser pour l'instance
      const isOwner = univers.ownership.createdBy === userId;
      const isMarketplace = univers.ownership.isMarketplaceTemplate || false;
      
      // Pour les non-propriétaires : utiliser uniquement publishedVersion
      // Pour le propriétaire : utiliser la version draft si useDraft=true, sinon publishedVersion
      let instanceVersion: number;
      if (isOwner && isMarketplace && useDraft) {
        // Propriétaire utilisant le draft
        instanceVersion = univers.metadata.version || 1;
      } else if (isMarketplace && univers.metadata.publishedVersion) {
        // Non-propriétaire ou propriétaire sans draft : utiliser publishedVersion
        instanceVersion = univers.metadata.publishedVersion;
      } else {
        // Univers privé ou pas de publishedVersion : utiliser metadata.version
        instanceVersion = univers.metadata.version || 1;
      }

      // 2. Generate a unique instance ID (ce sera l'ID de l'instance Firestore)
      const instanceId = `instance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // 3. Call the instantiation service to create concrete resources
      // On utilise le même instanceId pour les ressources et l'instance Firestore
      const instantiationResult = await universInstantiationService.instantiate({
        definitions: univers.definitions,
        userId,
        userRole,
        agencyId,
        universId,
        universInstanceId: instanceId // Utiliser le même ID que l'instance Firestore
      });

      // 4. Create the UniversInstance document with all instantiated resource IDs
      // Note: Firestore doesn't accept undefined values, so we omit optional fields
      const instanceData: any = {
        universId,
        universVersion: instanceVersion, // Utiliser la version déterminée ci-dessus
        userId,
        agencyId,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: false, // Not active by default, must be activated explicitly
        instances: {
          forms: instantiationResult.forms,
          dashboards: instantiationResult.dashboards,
          instructions: instantiationResult.instructions,
          lists: instantiationResult.lists,
          reports: instantiationResult.reports
        },
        metadata: {
          universName: univers.metadata.name,
          universVersion: instanceVersion, // Utiliser la version déterminée ci-dessus
          isFromMarketplace: univers.ownership.isMarketplaceTemplate || false
          // paymentId and purchaseDate will be added later if purchased
        },
        updateAvailable: false
        // versionHistory and latestAvailableVersion will be added later if needed
      };

      // Remove undefined values before saving to Firestore
      const cleanInstanceData = this.removeUndefinedValues(instanceData);
      
      // Créer l'instance avec setDoc en utilisant l'instanceId généré
      const instanceRef = doc(db, this.instancesCollectionName, instanceId);
      await setDoc(instanceRef, {
        ...cleanInstanceData,
        createdAt: serverTimestamp()
      });
      
      // Mettre à jour le compteur d'utilisation du Univers
      await this.incrementUsage(universId);

      console.log(`✅ Univers instantiated successfully: ${universId} → Instance ${instanceId}`);
      console.log(`   Created: ${instantiationResult.forms.length} forms, ${instantiationResult.dashboards.length} dashboards, ${instantiationResult.instructions.length} instructions, ${instantiationResult.lists.length} lists, ${instantiationResult.reports.length} reports`);

      return {
        instanceId,
        result: instantiationResult
      };
    } catch (error) {
      console.error(`❌ Error instantiating Univers ${universId}:`, error);
      
      // Re-throw with a more descriptive message
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error(`Failed to instantiate Univers: ${error}`);
    }
  }

  /**
   * Acheter un Univers depuis le marketplace et créer une instance
   * 
   * @param universId - ID du Univers template à acheter
   * @param directorId - ID du directeur qui achète
   * @param agencyId - ID de l'agence
   * @param paymentId - ID du paiement (optionnel pour Univers gratuit)
   * @returns L'ID de l'instance créée
   * @throws Error si le Univers n'est pas trouvé, n'est pas dans le marketplace, ou si le paiement est requis mais non fourni
   */
  async purchaseUnivers(
    universId: string,
    directorId: string,
    agencyId: string,
    paymentId?: string
  ): Promise<string> {
    try {
      // 1. Récupérer le Univers template
      const univers = await this.getById(universId);
      if (!univers) {
        throw new Error(`Univers template not found: ${universId}`);
      }

      // 2. Vérifier que c'est un Univers marketplace
      if (!univers.ownership.isMarketplaceTemplate) {
        throw new Error('Ce Univers n\'est pas disponible dans le marketplace');
      }

      // 3. Vérifier que le Univers est approuvé
      if (univers.ownership.approvalStatus !== 'approved') {
        throw new Error('Ce Univers n\'est pas encore approuvé pour le marketplace');
      }

      // 4. Validation: prix valide si marketplace
      const price = univers.metadata.price ?? 0;
      if (price < 0) {
        throw new Error('Le prix du Univers doit être supérieur ou égal à 0');
      }
      if (univers.metadata.currency && !['XAF', 'EUR', 'USD'].includes(univers.metadata.currency)) {
        throw new Error('La devise doit être XAF, EUR ou USD');
      }

      // 5. Vérifier le paiement si nécessaire
      const isFree = price === 0 || price === null || price === undefined;
      if (!isFree && !paymentId) {
        throw new Error('Un paiement est requis pour ce Univers. Veuillez fournir un paymentId.');
      }

      // 6. Créer l'instance via instantiate()
      // Pour les achats : toujours utiliser la version publiée (pas le draft)
      const { instanceId } = await this.instantiate(
        universId,
        directorId,
        'directeur',
        agencyId,
        false // useDraft = false pour les achats
      );

      // 7. Mettre à jour l'instance pour ajouter les métadonnées d'achat
      const instanceRef = doc(db, this.instancesCollectionName, instanceId);
      const updateData: any = {
        'metadata.isFromMarketplace': true,
        'metadata.purchaseDate': serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Ajouter paymentId si fourni
      if (paymentId) {
        updateData['metadata.paymentId'] = paymentId;
      }

      await updateDoc(instanceRef, updateData);

      console.log(`✅ Univers purchased successfully: ${universId} → Instance ${instanceId}`);
      if (paymentId) {
        console.log(`   Payment ID: ${paymentId}`);
      }

      return instanceId;
    } catch (error) {
      console.error(`❌ Error purchasing Univers ${universId}:`, error);
      
      // Re-throw with a more descriptive message
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error(`Failed to purchase Univers: ${error}`);
    }
  }

  /**
   * Récupérer toutes les versions d'un Univers
   * 
   * @param universId - ID du Univers template
   * @returns Liste des versions triées par version (décroissant)
   */
  async getVersionsByUnivers(universId: string): Promise<UniversVersion[]> {
    try {
      const q = query(
        collection(db, this.versionsCollectionName),
        where('universId', '==', universId),
        orderBy('version', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => 
        this.convertFirestoreToUniversVersion(doc.id, doc.data())
      );
    } catch (error) {
      console.error('Erreur lors de la récupération des versions du Univers:', error);
      throw error;
    }
  }

  /**
   * Récupérer tous les Univers avec des versions en attente d'approbation
   * 
   * @returns Liste des Univers avec des versions pending
   */
  async getPendingApprovalUnivers(): Promise<{ univers: Univers; pendingVersion: UniversVersion }[]> {
    try {
      // 1. Récupérer tous les Univers marketplace (peu importe leur approvalStatus)
      // Car un Univers déjà approuvé peut avoir une nouvelle version en attente
      const q = query(
        collection(db, this.collectionName),
        where('ownership.isMarketplaceTemplate', '==', true)
      );
      
      const universSnapshot = await getDocs(q);
      const results: { univers: Univers; pendingVersion: UniversVersion }[] = [];

      // 2. Pour chaque Univers marketplace, vérifier s'il a des versions en attente
      for (const universDoc of universSnapshot.docs) {
        const rawData = universDoc.data();
        const univers = this.convertFirestoreToUnivers(universDoc.id, rawData);
        
        // Exclure immédiatement les univers qui ont déjà été approuvés (approvedAt existe)
        // et qui ont un statut approuvé
        if (univers.ownership.approvalStatus === 'approved' && univers.ownership.approvedAt) {
          // Vérifier s'il y a une nouvelle version en attente (supérieure à la version actuelle)
          const versions = await this.getVersionsByUnivers(univers.id);
          const pendingVersion = versions.find(v => 
            v.approvalStatus === 'pending' && 
            !v.approvedAt &&
            v.version > (univers.metadata.version || 1)
          );
          
          // Seulement inclure si une nouvelle version est vraiment en attente
          if (pendingVersion) {
            results.push({ univers, pendingVersion });
          }
          continue;
        }
        
        // Récupérer toutes les versions pour ce Univers une seule fois
        const versions = await this.getVersionsByUnivers(univers.id);
        
        // Si le Univers lui-même est en attente (première création)
        if (univers.ownership.approvalStatus === 'pending') {
          // Vérifier si le Univers a été approuvé récemment en vérifiant approvedAt
          // Si approvedAt existe dans ownership, le Univers est approuvé même si approvalStatus est pending
          if (rawData.ownership?.approvedAt) {
            // Le Univers a été approuvé, ne pas l'inclure
            continue;
          }
          
          // Vérifier s'il existe une version approuvée pour la version actuelle du Univers
          // Cela peut arriver si le Univers a été approuvé mais le snapshot n'est pas encore à jour
          const approvedVersion = versions.find(v => 
            v.version === (univers.metadata.version || 1) && 
            v.approvalStatus === 'approved'
          );
          
          // Si une version approuvée existe pour cette version, le Univers a été approuvé
          // Ne pas l'inclure dans les résultats
          if (!approvedVersion) {
            
            // Créer une version virtuelle pour le Univers initial en attente
            const pendingVersion: UniversVersion = {
              id: `univers-${univers.id}`,
              universId: univers.id,
              version: univers.metadata.version || 1,
              previousVersion: 0,
              createdBy: univers.ownership.createdBy,
              createdAt: univers.metadata.createdAt || new Date(),
              approvalStatus: 'pending',
              changes: {
                metadata: true,
                definitions: {
                  forms: (univers.definitions.forms?.length || 0) > 0,
                  dashboards: (univers.definitions.dashboards?.length || 0) > 0,
                  instructions: (univers.definitions.instructions?.length || 0) > 0,
                  lists: (univers.definitions.lists?.length || 0) > 0,
                  reports: (univers.definitions.reports?.length || 0) > 0
                }
              }
            };
            results.push({ univers, pendingVersion });
          }
        }
        // Si le Univers n'est pas approuvé et n'est pas en attente (rejected, etc.), ne pas l'inclure
      }

      return results;
    } catch (error) {
      console.error('Erreur lors de la récupération des Univers en attente:', error);
      throw error;
    }
  }

  /**
   * Approuver une nouvelle version d'un Univers
   * 
   * @param universId - ID du Univers template
   * @param version - Numéro de version à approuver
   * @param adminId - ID de l'admin qui approuve
   * @returns void
   */
  async approveNewVersion(
    universId: string,
    version: number,
    adminId: string
  ): Promise<void> {
    try {
      // Récupérer le Univers pour vérifier son statut
      const univers = await this.getById(universId);
      if (!univers) {
        throw new Error(`Univers ${universId} not found`);
      }

      // Si c'est la première version (le Univers lui-même est en attente)
      // Pour la première version, on utilise la version actuelle du Univers
      const currentUniversVersion = univers.metadata.version || 1;
      const isFirstVersion = univers.ownership.approvalStatus === 'pending' && version === currentUniversVersion;
      
      if (isFirstVersion) {
        // Pour la première version, créer un document UniversVersion pour l'historique
        const versionData = {
          universId: universId,
          version: version,
          previousVersion: 0,
          createdBy: univers.ownership.createdBy,
          createdAt: serverTimestamp(),
          approvalStatus: 'approved',
          approvedBy: adminId,
          approvedAt: serverTimestamp(),
          changes: {
            metadata: true,
            definitions: {
              forms: (univers.definitions.forms?.length || 0) > 0,
              dashboards: (univers.definitions.dashboards?.length || 0) > 0,
              instructions: (univers.definitions.instructions?.length || 0) > 0,
              lists: (univers.definitions.lists?.length || 0) > 0,
              reports: (univers.definitions.reports?.length || 0) > 0
            }
          }
        };
        
        await addDoc(collection(db, this.versionsCollectionName), versionData);
      } else {
        // Pour les versions suivantes, mettre à jour le document UniversVersion existant
        const versionsQuery = query(
          collection(db, this.versionsCollectionName),
          where('universId', '==', universId),
          where('version', '==', version)
        );
        const versionsSnapshot = await getDocs(versionsQuery);
        
        if (versionsSnapshot.empty) {
          throw new Error(`Version document not found for Univers ${universId} version ${version}`);
        }

        const versionDocRef = doc(db, this.versionsCollectionName, versionsSnapshot.docs[0].id);
        
        await updateDoc(versionDocRef, {
          approvalStatus: 'approved',
          approvedBy: adminId,
          approvedAt: serverTimestamp()
        });
      }

      // Récupérer le Univers pour obtenir le draftData si présent
      const universBeforeApproval = await this.getById(universId);
      
      // Mettre à jour le document Univers
      const universRef = doc(db, this.collectionName, universId);
      
      // Préparer les données de mise à jour
      const updateData: any = {
        'ownership.approvalStatus': 'approved',
        'ownership.approvedBy': adminId,
        'ownership.approvedAt': serverTimestamp(),
        'ownership.rejectionReason': deleteField()
      };

      // Mettre à jour publishedVersion avec la version approuvée
      // Si c'est la première version, utiliser la version actuelle du Univers
      // Sinon, utiliser la version approuvée
      const publishedVersionToSet = isFirstVersion ? currentUniversVersion : version;
      updateData['metadata.publishedVersion'] = publishedVersionToSet;

      // Si le draftData existe, appliquer les modifications du draft au document principal
      // et nettoyer le draftData
      if (universBeforeApproval?.draftData && universBeforeApproval.hasUnpublishedChanges) {
        console.log('🔍 approveNewVersion - Applying draft changes to published version');
        
        const draft = universBeforeApproval.draftData;
        
        // Appliquer les métadonnées du draft (sans publishedVersion)
        if (draft.metadata) {
          Object.keys(draft.metadata).forEach(key => {
            if (key !== 'publishedVersion') {
              updateData[`metadata.${key}`] = draft.metadata![key as keyof UniversMetadata];
            }
          });
        }
        
        // Appliquer les définitions du draft
        if (draft.definitions) {
          updateData['definitions'] = draft.definitions;
        }
        
        // Nettoyer le draftData après application
        updateData['draftData'] = deleteField();
        updateData['hasUnpublishedChanges'] = false;
      }

      await updateDoc(universRef, updateData);

      // Vérifier que la mise à jour a bien été appliquée
      const updatedUnivers = await this.getById(universId);
      if (updatedUnivers && updatedUnivers.ownership.approvalStatus !== 'approved') {
        console.warn(`⚠️ Univers ${universId} approvalStatus not updated correctly, retrying...`);
        // Retry une fois
        await updateDoc(universRef, {
          'ownership.approvalStatus': 'approved',
          'ownership.approvedBy': adminId,
          'ownership.approvedAt': serverTimestamp(),
          'metadata.publishedVersion': version
        });
      }

      // Notifier toutes les instances qu'une nouvelle version est disponible
      try {
        await this.notifyNewVersionAvailable(universId, version);
      } catch (notifyError) {
        console.error(`⚠️ Error notifying instances about new version (non-blocking):`, notifyError);
        // Ne pas faire échouer l'approbation si les notifications échouent
      }

      console.log(`✅ Univers version approved: ${universId} v${version} by admin ${adminId}`);
      console.log(`   Univers approvalStatus: ${updatedUnivers?.ownership.approvalStatus || 'N/A'}`);
    } catch (error) {
      console.error(`❌ Error approving Univers version:`, error);
      throw error;
    }
  }

  /**
   * Rejeter une nouvelle version d'un Univers
   * 
   * @param universId - ID du Univers template
   * @param version - Numéro de version à rejeter
   * @param adminId - ID de l'admin qui rejette
   * @param rejectionReason - Raison du rejet
   * @returns void
   */
  async rejectNewVersion(
    universId: string,
    version: number,
    adminId: string,
    rejectionReason: string
  ): Promise<void> {
    try {
      // Récupérer le Univers pour vérifier son statut
      const univers = await this.getById(universId);
      if (!univers) {
        throw new Error(`Univers ${universId} not found`);
      }

      // Si c'est la première version (le Univers lui-même est en attente)
      const isFirstVersion = univers.ownership.approvalStatus === 'pending' && version === (univers.metadata.version || 1);
      
      if (isFirstVersion) {
        // Pour la première version, créer un document UniversVersion pour l'historique
        const versionData = {
          universId: universId,
          version: version,
          previousVersion: 0,
          createdBy: univers.ownership.createdBy,
          createdAt: serverTimestamp(),
          approvalStatus: 'rejected',
          rejectionReason: rejectionReason,
          changes: {
            metadata: true,
            definitions: {
              forms: (univers.definitions.forms?.length || 0) > 0,
              dashboards: (univers.definitions.dashboards?.length || 0) > 0,
              instructions: (univers.definitions.instructions?.length || 0) > 0,
              lists: (univers.definitions.lists?.length || 0) > 0,
              reports: (univers.definitions.reports?.length || 0) > 0
            }
          }
        };
        
        await addDoc(collection(db, this.versionsCollectionName), versionData);
      } else {
        // Pour les versions suivantes, mettre à jour le document UniversVersion existant
        const versionsQuery = query(
          collection(db, this.versionsCollectionName),
          where('universId', '==', universId),
          where('version', '==', version)
        );
        const versionsSnapshot = await getDocs(versionsQuery);
        
        if (versionsSnapshot.empty) {
          throw new Error(`Version document not found for Univers ${universId} version ${version}`);
        }

        const versionDocRef = doc(db, this.versionsCollectionName, versionsSnapshot.docs[0].id);
        
        await updateDoc(versionDocRef, {
          approvalStatus: 'rejected',
          rejectionReason: rejectionReason
        });
      }

      // 2. Mettre à jour le document Univers - revenir à la version précédente approuvée
      // Si c'est la première version, on la rejette simplement
      if (!isFirstVersion) {
        // Trouver la dernière version approuvée
        const versions = await this.getVersionsByUnivers(universId);
        const approvedVersions = versions.filter(v => v.approvalStatus === 'approved');
        const lastApprovedVersion = approvedVersions[0]; // Déjà trié par version desc

        const universRef = doc(db, this.collectionName, universId);
        const updateData: any = {
          'ownership.approvalStatus': 'rejected',
          'ownership.rejectionReason': rejectionReason
        };

        // Si une version précédente était approuvée, restaurer cette version
        if (lastApprovedVersion) {
          updateData['metadata.version'] = lastApprovedVersion.version;
        }

        await updateDoc(universRef, updateData);
      } else {
        // Pour la première version rejetée, mettre à jour le Univers
        const universRef = doc(db, this.collectionName, universId);
        await updateDoc(universRef, {
          'ownership.approvalStatus': 'rejected',
          'ownership.rejectionReason': rejectionReason
        });
      }

      console.log(`✅ Univers version rejected: ${universId} v${version} by admin ${adminId}`);
    } catch (error) {
      console.error(`❌ Error rejecting Univers version:`, error);
      throw error;
    }
  }

  /**
   * Récupérer toutes les instances d'un Univers
   * 
   * @param universId - ID du Univers template
   * @returns Liste des instances triées par date de création (décroissant)
   */
  async getInstancesByUnivers(universId: string): Promise<UniversInstance[]> {
    try {
      const q = query(
        collection(db, this.instancesCollectionName),
        where('universId', '==', universId),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => 
        this.convertFirestoreToUniversInstance(doc.id, doc.data())
      );
    } catch (error) {
      console.error('Erreur lors de la récupération des instances du Univers:', error);
      throw error;
    }
  }

  /**
   * Notifier toutes les instances d'un Univers qu'une nouvelle version est disponible
   * 
   * @param universId - ID du Univers template
   * @param newVersion - Numéro de la nouvelle version
   * @returns void
   */
  async notifyNewVersionAvailable(universId: string, newVersion: number): Promise<void> {
    try {
      // 1. Récupérer le Univers pour obtenir le nom
      const univers = await this.getById(universId);
      if (!univers) {
        throw new Error(`Univers not found: ${universId}`);
      }

      // 2. Trouver toutes les instances de ce Univers
      const instances = await this.getInstancesByUnivers(universId);
      
      if (instances.length === 0) {
        console.log(`ℹ️ No instances found for Univers ${universId}, skipping notifications`);
        return;
      }

      // 3. Mettre à jour toutes les instances avec latestAvailableVersion et updateAvailable
      const batch = instances.map(async (instance) => {
        const instanceRef = doc(db, this.instancesCollectionName, instance.id);
        await updateDoc(instanceRef, {
          latestAvailableVersion: newVersion,
          updateAvailable: true,
          updatedAt: serverTimestamp()
        });
      });

      await Promise.all(batch);

      // 4. Récupérer les informations utilisateur pour chaque instance unique
      const uniqueUserIds = [...new Set(instances.map(inst => inst.userId))];
      const usersCollection = collection(db, 'users');
      
      // 5. Envoyer des notifications à chaque propriétaire d'instance
      const notificationPromises = uniqueUserIds.map(async (userId) => {
        try {
          // Récupérer les informations utilisateur
          const userDoc = await getDoc(doc(usersCollection, userId));
          if (!userDoc.exists()) {
            console.warn(`User ${userId} not found, skipping notification`);
            return;
          }

          const userData = userDoc.data();
          const userEmail = userData.email;
          const userRole = userData.role || 'directeur';
          const agencyId = userData.agencyId;

          if (!agencyId) {
            console.warn(`User ${userId} has no agencyId, skipping notification`);
            return;
          }

          // Trouver les instances de cet utilisateur pour ce Univers
          const userInstances = instances.filter(inst => inst.userId === userId);
          const currentVersion = userInstances[0]?.metadata.universVersion || userInstances[0]?.universVersion || 1;

          // Envoyer la notification unifiée
          await unifiedNotificationService.sendNotification({
            title: `Nouvelle version disponible : ${univers.metadata.name}`,
            body: `Une nouvelle version (v${newVersion}) du Univers "${univers.metadata.name}" est maintenant disponible. Votre version actuelle est v${currentVersion}.`,
            type: 'univers_version_available',
            recipientId: userId,
            recipientRole: userRole as 'directeur' | 'employe',
            agencyId: agencyId,
            emailAddress: userEmail,
            redirectUrl: `/univers/${universId}`,
            data: {
              universId: universId,
              universName: univers.metadata.name,
              currentVersion: currentVersion,
              newVersion: newVersion,
              instanceIds: userInstances.map(inst => inst.id)
            }
          });

          console.log(`✅ Notification sent to user ${userId} for Univers ${universId} v${newVersion}`);
        } catch (error) {
          console.error(`❌ Error sending notification to user ${userId}:`, error);
          // Ne pas faire échouer toute l'opération si une notification échoue
        }
      });

      await Promise.all(notificationPromises);

      console.log(`✅ Notified ${uniqueUserIds.length} users about new version ${newVersion} of Univers ${universId}`);
    } catch (error) {
      console.error(`❌ Error notifying about new version:`, error);
      throw error;
    }
  }

  /**
   * Migrer les données d'une ancienne instance vers une nouvelle instance
   * 
   * @param oldInstance - L'ancienne instance
   * @param newInstance - La nouvelle instance
   * @param idMapping - Mapping des anciens IDs vers les nouveaux IDs
   * @returns void
   */
  async migrateInstanceData(
    oldInstance: UniversInstance,
    newInstance: UniversInstance,
    idMapping: {
      forms: Map<string, string>; // Map<oldFormId, newFormId>
      dashboards: Map<string, string>; // Map<oldDashboardId, newDashboardId>
      lists: Map<string, string>; // Map<oldListId, newListId>
      reports: Map<string, string>; // Map<oldReportId, newReportId>
    }
  ): Promise<void> {
    try {
      console.log(`🔄 Starting data migration from instance ${oldInstance.id} to ${newInstance.id}`);
      
      let batch = writeBatch(db);
      let batchCount = 0;
      const MAX_BATCH_SIZE = 500; // Firestore limit

      const commitBatch = async () => {
        if (batchCount > 0) {
          await batch.commit();
          console.log(`✅ Committed batch of ${batchCount} updates`);
          batchCount = 0;
          batch = writeBatch(db); // Créer un nouveau batch
        }
      };

      // 1. Migrer Form Entries: mettre à jour formId vers les nouveaux forms
      if (idMapping.forms.size > 0) {
        const formEntriesQuery = query(
          collection(db, 'formEntries'),
          where('agencyId', '==', oldInstance.agencyId),
          where('universInstanceId', '==', oldInstance.id)
        );
        const formEntriesSnapshot = await getDocs(formEntriesQuery);
        
        console.log(`📝 Found ${formEntriesSnapshot.size} form entries to migrate`);

        for (const entryDoc of formEntriesSnapshot.docs) {
          const entryData = entryDoc.data();
          const oldFormId = entryData.formId;
          const newFormId = idMapping.forms.get(oldFormId);

          if (newFormId) {
            const entryRef = doc(db, 'formEntries', entryDoc.id);
            batch.update(entryRef, {
              formId: newFormId,
              universInstanceId: newInstance.id,
              updatedAt: serverTimestamp()
            });
            batchCount++;

            // Commit batch if approaching limit
            if (batchCount >= MAX_BATCH_SIZE) {
              await commitBatch();
            }
          }
        }
      }

      // 2. Migrer Dashboard metrics: mettre à jour les références de forms
      if (idMapping.dashboards.size > 0 && idMapping.forms.size > 0) {
        const dashboardsQuery = query(
          collection(db, 'dashboards'),
          where('agencyId', '==', oldInstance.agencyId),
          where('universInstanceId', '==', oldInstance.id)
        );
        const dashboardsSnapshot = await getDocs(dashboardsQuery);

        for (const dashboardDoc of dashboardsSnapshot.docs) {
          const dashboardData = dashboardDoc.data();
          const oldDashboardId = dashboardDoc.id;
          const newDashboardId = idMapping.dashboards.get(oldDashboardId);

          if (newDashboardId && dashboardData.metrics) {
            const metrics = Array.isArray(dashboardData.metrics) ? dashboardData.metrics : [];
            const updatedMetrics = metrics.map((metric: any) => {
              if (metric.formId && idMapping.forms.has(metric.formId)) {
                return {
                  ...metric,
                  formId: idMapping.forms.get(metric.formId)
                };
              }
              return metric;
            });

            if (updatedMetrics.some((m: any, i: number) => m.formId !== metrics[i]?.formId)) {
              const dashboardRef = doc(db, 'dashboards', newDashboardId);
              batch.update(dashboardRef, {
                metrics: updatedMetrics,
                updatedAt: serverTimestamp()
              });
              batchCount++;

              if (batchCount >= MAX_BATCH_SIZE) {
                await commitBatch();
              }
            }
          }
        }
      }

      // 3. Migrer Reports: mettre à jour les mappings
      if (idMapping.reports.size > 0) {
        const reportsQuery = query(
          collection(db, 'reports'),
          where('agencyId', '==', oldInstance.agencyId),
          where('universInstanceId', '==', oldInstance.id)
        );
        const reportsSnapshot = await getDocs(reportsQuery);

        for (const reportDoc of reportsSnapshot.docs) {
          const reportData = reportDoc.data();
          const oldReportId = reportDoc.id;
          const newReportId = idMapping.reports.get(oldReportId);

          if (newReportId && reportData.mappings) {
            const mappings = Array.isArray(reportData.mappings) ? reportData.mappings : [];
            const updatedMappings = mappings.map((mapping: any) => {
              const updatedMapping = { ...mapping };
              
              // Mettre à jour les références de forms
              if (mapping.formId && idMapping.forms.has(mapping.formId)) {
                updatedMapping.formId = idMapping.forms.get(mapping.formId);
              }
              
              // Mettre à jour les références de dashboards
              if (mapping.dashboardId && idMapping.dashboards.has(mapping.dashboardId)) {
                updatedMapping.dashboardId = idMapping.dashboards.get(mapping.dashboardId);
              }

              return updatedMapping;
            });

            if (updatedMappings.some((m: any, i: number) => JSON.stringify(m) !== JSON.stringify(mappings[i]))) {
              const reportRef = doc(db, 'reports', newReportId);
              batch.update(reportRef, {
                mappings: updatedMappings,
                updatedAt: serverTimestamp()
              });
              batchCount++;

              if (batchCount >= MAX_BATCH_SIZE) {
                await commitBatch();
              }
            }
          }
        }
      }

      // 4. Migrer Lists: mettre à jour les références dans les forms (si listId est utilisé)
      if (idMapping.lists.size > 0) {
        const formsQuery = query(
          collection(db, 'forms'),
          where('agencyId', '==', oldInstance.agencyId),
          where('universInstanceId', '==', newInstance.id)
        );
        const formsSnapshot = await getDocs(formsQuery);

        for (const formDoc of formsSnapshot.docs) {
          const formData = formDoc.data();
          if (formData.fields && Array.isArray(formData.fields)) {
            const updatedFields = formData.fields.map((field: any) => {
              if (field.listId && idMapping.lists.has(field.listId)) {
                return {
                  ...field,
                  listId: idMapping.lists.get(field.listId)
                };
              }
              return field;
            });

            if (updatedFields.some((f: any, i: number) => f.listId !== formData.fields[i]?.listId)) {
              const formRef = doc(db, 'forms', formDoc.id);
              batch.update(formRef, {
                fields: updatedFields,
                updatedAt: serverTimestamp()
              });
              batchCount++;

              if (batchCount >= MAX_BATCH_SIZE) {
                await commitBatch();
              }
            }
          }
        }
      }

      // Commit remaining updates
      await commitBatch();

      console.log(`✅ Data migration completed successfully from instance ${oldInstance.id} to ${newInstance.id}`);
    } catch (error) {
      console.error(`❌ Error migrating instance data:`, error);
      throw error;
    }
  }

  /**
   * Mettre à jour une instance Univers vers une nouvelle version
   * 
   * @param oldInstanceId - ID de l'ancienne instance
   * @param userId - ID de l'utilisateur qui met à jour
   * @param userRole - Rôle de l'utilisateur
   * @param agencyId - ID de l'agence
   * @returns ID de la nouvelle instance
   * @throws Error si l'instance n'est pas trouvée, si aucune mise à jour n'est disponible, ou si la migration échoue
   */
  async upgradeInstance(
    oldInstanceId: string,
    userId: string,
    userRole: 'directeur' | 'employe' | 'admin',
    agencyId: string
  ): Promise<string> {
    try {
      console.log(`🔄 Starting upgrade for instance ${oldInstanceId}`);

      // 1. Récupérer l'ancienne instance
      const oldInstance = await this.getInstanceById(oldInstanceId);
      if (!oldInstance) {
        throw new Error(`Instance not found: ${oldInstanceId}`);
      }

      // 2. Récupérer le template Univers et vérifier qu'une mise à jour est disponible
      // Ne pas passer userId pour éviter de récupérer le draft pour les non-propriétaires
      const univers = await this.getById(oldInstance.universId);
      if (!univers) {
        throw new Error(`Univers template not found: ${oldInstance.universId}`);
      }

      const currentVersion = oldInstance.universVersion || oldInstance.metadata?.universVersion || 1;
      
      // Vérifier si l'utilisateur est le propriétaire du template
      const isOwner = univers.ownership.createdBy === userId;
      const isMarketplace = univers.ownership.isMarketplaceTemplate || false;
      
      // Déterminer la version à utiliser pour la mise à jour
      // Pour les non-propriétaires : utiliser uniquement publishedVersion (version approuvée)
      // Pour le propriétaire : utiliser la version draft si disponible
      let latestVersion: number;
      if (isOwner && isMarketplace) {
        // Propriétaire : peut utiliser la version draft
        latestVersion = univers.metadata.version || 1;
      } else {
        // Non-propriétaire : utiliser uniquement la version publiée
        latestVersion = univers.metadata.publishedVersion || univers.metadata.version || 1;
      }
      
      console.log(`🔍 Upgrade check:`, {
        instanceId: oldInstanceId,
        universId: oldInstance.universId,
        currentVersion,
        latestVersion,
        isOwner,
        isMarketplace,
        publishedVersion: univers.metadata.publishedVersion,
        draftVersion: univers.metadata.version,
        updateAvailable: oldInstance.updateAvailable,
        latestAvailableVersion: oldInstance.latestAvailableVersion,
        userId
      });
      
      // Déterminer la nouvelle version à utiliser
      let newVersion: number;
      
      // Pour le propriétaire : toujours utiliser la version du template (ignore latestAvailableVersion)
      if (isOwner && isMarketplace && latestVersion > currentVersion) {
        // Propriétaire : toujours utiliser la dernière version du template (draft si disponible)
        newVersion = latestVersion;
        console.log(`📌 Owner: using latest template version: v${newVersion}`);
      } else if (oldInstance.updateAvailable && oldInstance.latestAvailableVersion) {
        // Non-propriétaire : utiliser la version marquée comme disponible dans l'instance
        newVersion = oldInstance.latestAvailableVersion;
        console.log(`📌 Using marked available version: v${newVersion}`);
      } else if (latestVersion > currentVersion) {
        // Si pas de marqueur mais que le Univers template a une version plus récente
        // Pour les non-propriétaires, vérifier que la version est approuvée
        if (univers.ownership.approvalStatus === 'approved') {
          newVersion = latestVersion;
          console.log(`📌 Non-owner: using approved template version: v${newVersion}`);
        } else {
          throw new Error(`No approved update available. Template version ${latestVersion} is ${univers.ownership.approvalStatus}`);
        }
      } else {
        throw new Error(`No update available. Current version: v${currentVersion}, Latest version: v${latestVersion}`);
      }

      if (newVersion <= currentVersion) {
        throw new Error(`New version ${newVersion} is not greater than current version ${currentVersion}`);
      }

      // 3. Vérifier que le Univers template a la bonne version
      // Pour les non-propriétaires : vérifier publishedVersion
      // Pour le propriétaire : vérifier metadata.version (peut être draft)
      const expectedTemplateVersion = (isOwner && isMarketplace) 
        ? univers.metadata.version 
        : (univers.metadata.publishedVersion || univers.metadata.version);
      
      if (expectedTemplateVersion !== newVersion) {
        throw new Error(`Univers template version ${expectedTemplateVersion} does not match expected version ${newVersion}. Owner: ${isOwner}, Marketplace: ${isMarketplace}`);
      }

      // 4. Créer une nouvelle instance avec la nouvelle version
      // Pour le propriétaire : utiliser useDraft=true si la nouvelle version est un draft
      // Pour les non-propriétaires : toujours utiliser la version publiée (useDraft=false)
      const useDraft = isOwner && isMarketplace && newVersion === univers.metadata.version && univers.hasUnpublishedChanges;
      const { instanceId: newInstanceId, result: instantiationResult } = await this.instantiate(
        oldInstance.universId,
        userId,
        userRole,
        agencyId,
        useDraft
      );

      const newInstance = await this.getInstanceById(newInstanceId);
      if (!newInstance) {
        throw new Error(`Failed to retrieve new instance: ${newInstanceId}`);
      }

      // 5. Construire le mapping des anciens IDs vers les nouveaux IDs
      // Note: Le mapping doit être basé sur les titres/noms des définitions, car les IDs de définition changent
      // Pour l'instant, on utilise l'ordre des arrays comme mapping (première forme ancienne → première forme nouvelle)
      const idMapping = {
        forms: new Map<string, string>(),
        dashboards: new Map<string, string>(),
        lists: new Map<string, string>(),
        reports: new Map<string, string>()
      };

      // Mapping basé sur l'ordre (assumant que l'ordre est préservé lors de l'instanciation)
      // TODO: Améliorer ce mapping avec une correspondance plus intelligente (par titre/nom)
      oldInstance.instances.forms.forEach((oldFormId, index) => {
        if (instantiationResult.forms[index]) {
          idMapping.forms.set(oldFormId, instantiationResult.forms[index]);
        }
      });

      oldInstance.instances.dashboards.forEach((oldDashboardId, index) => {
        if (instantiationResult.dashboards[index]) {
          idMapping.dashboards.set(oldDashboardId, instantiationResult.dashboards[index]);
        }
      });

      oldInstance.instances.lists.forEach((oldListId, index) => {
        if (instantiationResult.lists[index]) {
          idMapping.lists.set(oldListId, instantiationResult.lists[index]);
        }
      });

      oldInstance.instances.reports.forEach((oldReportId, index) => {
        if (instantiationResult.reports[index]) {
          idMapping.reports.set(oldReportId, instantiationResult.reports[index]);
        }
      });

      // 6. Migrer les données de l'ancienne instance vers la nouvelle
      await this.migrateInstanceData(oldInstance, newInstance, idMapping);

      // 7. Désactiver l'ancienne instance et activer la nouvelle
      const wasActive = oldInstance.isActive;
      
      const batch = writeBatch(db);
      
      // Désactiver l'ancienne instance
      const oldInstanceRef = doc(db, this.instancesCollectionName, oldInstanceId);
      batch.update(oldInstanceRef, {
        isActive: false,
        updateAvailable: false,
        updatedAt: serverTimestamp()
      });

      // Ajouter l'historique de version à l'ancienne instance
      const versionHistoryEntry: any = {
        previousVersion: currentVersion,
        upgradedAt: new Date(),
        dataMigrated: true
      };
      // Ne pas inclure upgradedFromInstanceId si undefined (Firestore ne permet pas undefined)
      // upgradedFromInstanceId n'est défini que pour la nouvelle instance, pas pour l'ancienne

      const oldVersionHistory = oldInstance.versionHistory || [];
      const updatedVersionHistory = [...oldVersionHistory, versionHistoryEntry];
      batch.update(oldInstanceRef, {
        versionHistory: updatedVersionHistory
      });

      // Activer la nouvelle instance si l'ancienne était active
      const newInstanceRef = doc(db, this.instancesCollectionName, newInstanceId);
      const newInstanceUpdate: any = {
        isActive: wasActive,
        updateAvailable: false,
        updatedAt: serverTimestamp()
      };
      // Ne pas inclure latestAvailableVersion si undefined (Firestore ne permet pas undefined)
      // On utilise deleteField() pour supprimer le champ s'il existe
      if (oldInstance.latestAvailableVersion !== undefined) {
        newInstanceUpdate.latestAvailableVersion = deleteField();
      }
      batch.update(newInstanceRef, newInstanceUpdate);

      // Ajouter l'historique de version à la nouvelle instance
      batch.update(newInstanceRef, {
        versionHistory: [{
          previousVersion: currentVersion,
          upgradedAt: new Date(),
          upgradedFromInstanceId: oldInstanceId,
          dataMigrated: true
        }]
      });

      await batch.commit();

      // 8. Si l'ancienne instance était active, mettre à jour ActiveUnivers
      if (wasActive) {
        await this.setActiveUnivers(userId, agencyId, oldInstance.universId, newInstanceId);
        
        // Vérifier que les nouvelles ressources créées sont complètes et cohérentes
        // Note: instantiate() crée déjà toutes les ressources nécessaires pour la nouvelle instance
        // On ne doit PAS mettre à jour les ressources de l'ancienne instance pour éviter les doublons
        console.log(`🔍 Vérification de la cohérence des ressources pour la nouvelle instance ${newInstanceId}...`);
        const resourcesCheck = await this.checkIfResourcesExistForInstance(newInstanceId, oldInstance.universId, agencyId, univers);
        
        if (!resourcesCheck.exists) {
          // Les ressources n'existent pas : cela ne devrait pas arriver car instantiate() les crée
          console.warn(`⚠️ Aucune ressource trouvée pour la nouvelle instance ${newInstanceId}. Recréation des ressources...`);
          await this.instantiateResourcesOnly(univers, userId, agencyId, newInstanceId);
          console.log(`✅ Ressources recréées avec succès pour la nouvelle instance`);
        } else if (!resourcesCheck.isConsistent) {
          // Les ressources existent mais sont incohérentes : les recréer
          console.warn(`⚠️ Ressources incohérentes détectées pour la nouvelle instance:`, resourcesCheck.inconsistencies);
          console.log(`🔄 Recréation des ressources pour corriger les incohérences...`);
          await this.instantiateResourcesOnly(univers, userId, agencyId, newInstanceId);
          console.log(`✅ Ressources recréées avec succès pour la nouvelle instance`);
        } else {
          console.log(`✅ Ressources complètes et cohérentes pour la nouvelle instance ${newInstanceId}`);
        }
      }

      console.log(`✅ Instance upgraded successfully: ${oldInstanceId} → ${newInstanceId} (v${currentVersion} → v${newVersion})`);
      
      return newInstanceId;
    } catch (error) {
      console.error(`❌ Error upgrading instance ${oldInstanceId}:`, error);
      throw error;
    }
  }

  /**
   * Collection name for ActiveUnivers documents
   */
  private readonly activeUniversCollectionName = 'activeUnivers';

  /**
   * Récupérer le Univers par défaut d'un directeur
   */
  async getDefaultUnivers(directorId: string): Promise<Univers | null> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('ownership.createdBy', '==', directorId),
        where('metadata.isDefault', '==', true)
      );
      
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        return this.convertFirestoreToUnivers(doc.id, doc.data());
      }
      return null;
    } catch (error) {
      console.error('Erreur lors de la récupération du Univers par défaut:', error);
      throw error;
    }
  }

  /**
   * Créer ou activer le Univers par défaut pour un directeur
   * S'assure désormais qu'une instance est immédiatement disponible
   * pour éviter les écarts entre univers et ressources
   */
  async ensureDefaultUnivers(directorId: string, agencyId: string): Promise<string> {
    try {
      // 1. Vérifier si un Univers par défaut existe déjà
      let defaultUnivers = await this.getDefaultUnivers(directorId);

      if (!defaultUnivers) {
        // 2. Créer le Univers par défaut (sans instance)
        const defaultId = await this.create({
          metadata: {
            name: 'Univers par défaut', // Nom fixe, non modifiable
            description: 'Univers par défaut créé automatiquement',
            isDefault: true,
            isActive: true, // Actif par défaut
            version: 1,
            createdAt: new Date(),
            packageAccess: {
              free: true, // Accessible pour tous les packages (gratuit)
              starter: true,
              standard: true
            }
          },
          ownership: {
            createdBy: directorId,
            agencyId: undefined, // Privé
            isMarketplaceTemplate: false
          },
          definitions: {
            forms: [],
            dashboards: [],
            instructions: [],
            lists: [],
            reports: []
          },
          usage: {
            totalUsages: 0
          }
        });

        defaultUnivers = await this.getById(defaultId);
        if (!defaultUnivers) {
          throw new Error('Erreur lors de la création du Univers par défaut');
        }
      }

      // 3. Vérifier si un Univers actif existe déjà
      const activeUnivers = await this.getActiveUnivers(directorId, agencyId);
      let shouldEnsureInstance = false;
      
      if (!activeUnivers) {
        // 4. Activer directement (sans instance pour l'instant)
        await this.setActiveUnivers(directorId, agencyId, defaultUnivers.id);
        console.log(`✅ Univers par défaut activé pour directeur ${directorId}`);
        shouldEnsureInstance = true;
      } else if (!activeUnivers.activeInstanceId && activeUnivers.activeUniversId === defaultUnivers.id) {
        // Univers actif déjà défini mais sans instance : il faut la créer
        shouldEnsureInstance = true;
      }

      // 5. Créer ou réutiliser une instance immédiatement si nécessaire
      if (shouldEnsureInstance) {
        const instanceId = await this.ensureInstanceForActiveUnivers(directorId, agencyId);
        if (instanceId) {
          console.log(`✅ Instance pour univers par défaut prête: ${instanceId}`);
        } else {
          console.warn('⚠️ Impossible de créer immédiatement une instance pour l’univers par défaut');
        }
      }

      return defaultUnivers.id;
    } catch (error) {
      console.error('Erreur lors de la création/activation du Univers par défaut:', error);
      throw error;
    }
  }

  /**
   * Récupérer l'Univers actif pour un directeur
   */
  async getActiveUnivers(directorId: string, agencyId: string): Promise<ActiveUnivers | null> {
    try {
      const docRef = doc(db, this.activeUniversCollectionName, directorId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          directorId: data.directorId || directorId,
          agencyId: data.agencyId || agencyId,
          activeUniversId: data.activeUniversId,
          activeInstanceId: data.activeInstanceId,
          updatedAt: data.updatedAt?.toDate() || new Date()
        };
      }
      return null;
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'Univers actif:', error);
      throw error;
    }
  }

  /**
   * Mettre à jour ou créer le document ActiveUnivers
   */
  private async setActiveUnivers(
    directorId: string,
    agencyId: string,
    universId: string,
    instanceId?: string
  ): Promise<void> {
    try {
      const docRef = doc(db, this.activeUniversCollectionName, directorId);
      
      // Construire l'objet de mise à jour
      const updateData: any = {
        agencyId,
        activeUniversId: universId,
        updatedAt: serverTimestamp()
      };

      // Gérer activeInstanceId : toujours utiliser null si undefined pour éviter les erreurs Firestore
      // Si undefined, mettre null pour supprimer la valeur existante (si elle existe)
      // Si défini, utiliser la valeur fournie
      updateData.activeInstanceId = instanceId !== undefined ? instanceId : null;

      await updateDoc(docRef, updateData);
    } catch (error: any) {
      // Si le document n'existe pas, le créer avec setDoc et merge: true
      if (error.code === 'not-found' || error.code === 'permission-denied' || error.code === 'failed-precondition') {
        const docRef = doc(db, this.activeUniversCollectionName, directorId);
        
        // Construire l'objet de données pour création
        const docData: any = {
          directorId,
          agencyId,
          activeUniversId: universId,
          updatedAt: serverTimestamp()
        };

        // Gérer activeInstanceId : toujours utiliser null si undefined pour éviter les erreurs Firestore
        // Si undefined, mettre null pour indiquer qu'il n'y a pas d'instance
        // Si défini, utiliser la valeur fournie
        docData.activeInstanceId = instanceId !== undefined ? instanceId : null;

        await setDoc(docRef, docData, { merge: true });
      } else {
        console.error('Erreur lors de la mise à jour de l\'Univers actif:', error);
        throw error;
      }
    }
  }

  /**
   * Vérifier si des ressources réelles existent pour un Univers
   * (pour déterminer si une instanciation est nécessaire)
   */
  private async checkIfResourcesExist(universId: string, agencyId: string): Promise<boolean> {
    try {
      // Vérifier si au moins un formulaire existe avec ce universId
      // On utilise limit(1) pour optimiser la requête (on a juste besoin de savoir s'il en existe au moins un)
      const formsQuery = query(
        collection(db, 'forms'),
        where('agencyId', '==', agencyId),
        where('universId', '==', universId)
      );
      const formsSnapshot = await getDocs(formsQuery);
      
      // Si au moins un formulaire existe, les ressources sont déjà instanciées
      return !formsSnapshot.empty;
    } catch (error) {
      // Si l'index n'existe pas ou erreur, considérer qu'aucune ressource n'existe
      // (dans ce cas, on instanciera les ressources)
      console.warn('⚠️ Erreur lors de la vérification des ressources existantes:', error);
      return false;
    }
  }

  /**
   * Vérifier la cohérence des ressources existantes avec les définitions du Univers
   */
  private async checkResourcesConsistency(
    instanceId: string,
    universId: string,
    agencyId: string,
    univers: Univers
  ): Promise<ResourcesCheckResult> {
    const result: ResourcesCheckResult = {
      exists: false,
      isConsistent: false,
      actualCounts: {
        forms: 0,
        dashboards: 0,
        instructions: 0,
        lists: 0,
        reports: 0
      },
      expectedCounts: {
        forms: univers.definitions?.forms?.length || 0,
        dashboards: univers.definitions?.dashboards?.length || 0,
        instructions: univers.definitions?.instructions?.length || 0,
        lists: univers.definitions?.lists?.length || 0,
        reports: univers.definitions?.reports?.length || 0
      },
      inconsistencies: []
    };

    try {
      // 1. Compter les formulaires
      try {
        const formsQuery = query(
          collection(db, 'forms'),
          where('agencyId', '==', agencyId),
          where('universId', '==', universId),
          where('universInstanceId', '==', instanceId)
        );
        const formsSnapshot = await getDocs(formsQuery);
        result.actualCounts.forms = formsSnapshot.size;
      } catch (error) {
        console.warn('⚠️ Erreur lors du comptage des formulaires:', error);
      }

      // 2. Compter les dashboards
      try {
        const dashboardsQuery = query(
          collection(db, 'dashboards'),
          where('agencyId', '==', agencyId),
          where('universId', '==', universId),
          where('universInstanceId', '==', instanceId)
        );
        const dashboardsSnapshot = await getDocs(dashboardsQuery);
        result.actualCounts.dashboards = dashboardsSnapshot.size;
      } catch (error) {
        console.warn('⚠️ Erreur lors du comptage des dashboards:', error);
      }

      // 3. Compter les instructions
      try {
        const instructionsQuery = query(
          collection(db, 'scheduledQuestions'),
          where('agencyId', '==', agencyId),
          where('universId', '==', universId),
          where('universInstanceId', '==', instanceId)
        );
        const instructionsSnapshot = await getDocs(instructionsQuery);
        result.actualCounts.instructions = instructionsSnapshot.size;
      } catch (error: any) {
        // Si erreur de permissions, ne pas considérer cela comme une incohérence critique
        // L'utilisateur peut ne pas avoir les permissions pour lire les instructions
        if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
          console.warn('⚠️ Permissions insuffisantes pour compter les instructions. Considérant 0 instruction.');
          result.actualCounts.instructions = 0;
          // Ne pas ajouter d'incohérence si c'est juste un problème de permissions
          // On considère que les instructions peuvent exister mais ne sont pas accessibles
        } else {
          console.warn('⚠️ Erreur lors du comptage des instructions:', error);
        }
      }

      // 4. Compter les listes
      try {
        const listsQuery = query(
          collection(db, 'lists'),
          where('agencyId', '==', agencyId),
          where('universId', '==', universId),
          where('universInstanceId', '==', instanceId)
        );
        const listsSnapshot = await getDocs(listsQuery);
        result.actualCounts.lists = listsSnapshot.size;
      } catch (error) {
        console.warn('⚠️ Erreur lors du comptage des listes:', error);
      }

      // 5. Compter les rapports
      try {
        const reportsQuery = query(
          collection(db, 'reports'),
          where('agencyId', '==', agencyId),
          where('universId', '==', universId),
          where('universInstanceId', '==', instanceId)
        );
        const reportsSnapshot = await getDocs(reportsQuery);
        result.actualCounts.reports = reportsSnapshot.size;
      } catch (error) {
        console.warn('⚠️ Erreur lors du comptage des rapports:', error);
      }

      // Vérifier l'existence (au moins une ressource existe)
      result.exists = result.actualCounts.forms > 0 || 
                     result.actualCounts.dashboards > 0 || 
                     result.actualCounts.instructions > 0 || 
                     result.actualCounts.lists > 0 || 
                     result.actualCounts.reports > 0;

      // Vérifier la cohérence
      // Tolérer des différences : considérer cohérent si on a au moins les ressources attendues
      // (les ressources supplémentaires peuvent être des ajouts utilisateur)
      if (result.actualCounts.forms < result.expectedCounts.forms) {
        result.inconsistencies.push(
          `Formulaires: ${result.actualCounts.forms} trouvé(s) au lieu de ${result.expectedCounts.forms} (manquant)`
        );
      } else if (result.actualCounts.forms > result.expectedCounts.forms) {
        // Plus de formulaires que prévu : peut être normal (ajouts utilisateur)
        console.log(`ℹ️ Plus de formulaires que prévu (${result.actualCounts.forms} au lieu de ${result.expectedCounts.forms}), probablement des ajouts utilisateur`);
      }
      
      if (result.actualCounts.dashboards < result.expectedCounts.dashboards) {
        result.inconsistencies.push(
          `Dashboards: ${result.actualCounts.dashboards} trouvé(s) au lieu de ${result.expectedCounts.dashboards} (manquant)`
        );
      } else if (result.actualCounts.dashboards > result.expectedCounts.dashboards) {
        console.log(`ℹ️ Plus de dashboards que prévu (${result.actualCounts.dashboards} au lieu de ${result.expectedCounts.dashboards}), probablement des ajouts utilisateur`);
      }
      
      if (result.actualCounts.instructions < result.expectedCounts.instructions) {
        result.inconsistencies.push(
          `Instructions: ${result.actualCounts.instructions} trouvée(s) au lieu de ${result.expectedCounts.instructions} (manquant)`
        );
      } else if (result.actualCounts.instructions > result.expectedCounts.instructions) {
        console.log(`ℹ️ Plus d'instructions que prévu (${result.actualCounts.instructions} au lieu de ${result.expectedCounts.instructions}), probablement des ajouts utilisateur`);
      }
      
      if (result.actualCounts.lists < result.expectedCounts.lists) {
        result.inconsistencies.push(
          `Listes: ${result.actualCounts.lists} trouvée(s) au lieu de ${result.expectedCounts.lists} (manquant)`
        );
      } else if (result.actualCounts.lists > result.expectedCounts.lists) {
        console.log(`ℹ️ Plus de listes que prévu (${result.actualCounts.lists} au lieu de ${result.expectedCounts.lists}), probablement des ajouts utilisateur`);
      }
      
      if (result.actualCounts.reports < result.expectedCounts.reports) {
        result.inconsistencies.push(
          `Rapports: ${result.actualCounts.reports} trouvé(s) au lieu de ${result.expectedCounts.reports} (manquant)`
        );
      } else if (result.actualCounts.reports > result.expectedCounts.reports) {
        console.log(`ℹ️ Plus de rapports que prévu (${result.actualCounts.reports} au lieu de ${result.expectedCounts.reports}), probablement des ajouts utilisateur`);
      }

      // Considérer cohérent si on a au moins toutes les ressources attendues
      // (les ressources supplémentaires ne sont pas considérées comme incohérentes)
      result.isConsistent = result.inconsistencies.length === 0;

      return result;
    } catch (error) {
      console.warn('⚠️ Erreur lors de la vérification de cohérence des ressources:', error);
      return result;
    }
  }

  /**
   * Vérifier si les ressources existent pour une instance et si elles sont cohérentes
   */
  private async checkIfResourcesExistForInstance(
    instanceId: string,
    universId: string,
    agencyId: string,
    univers?: Univers
  ): Promise<ResourcesCheckResult> {
    try {
      // Si le Univers n'est pas fourni, le récupérer
      let currentUnivers: Univers | undefined = univers;
      if (!currentUnivers) {
        const fetchedUnivers = await this.getById(universId);
        if (!fetchedUnivers) {
          return {
            exists: false,
            isConsistent: false,
            actualCounts: { forms: 0, dashboards: 0, instructions: 0, lists: 0, reports: 0 },
            expectedCounts: { forms: 0, dashboards: 0, instructions: 0, lists: 0, reports: 0 },
            inconsistencies: ['Univers non trouvé']
          };
        }
        currentUnivers = fetchedUnivers;
      }

      // Utiliser la fonction de vérification de cohérence
      return await this.checkResourcesConsistency(instanceId, universId, agencyId, currentUnivers);
    } catch (error) {
      // Si l'index n'existe pas ou erreur, considérer qu'aucune ressource n'existe pour cette instance
      console.warn('⚠️ Erreur lors de la vérification des ressources pour l\'instance:', error);
      return {
        exists: false,
        isConsistent: false,
        actualCounts: { forms: 0, dashboards: 0, instructions: 0, lists: 0, reports: 0 },
        expectedCounts: { forms: 0, dashboards: 0, instructions: 0, lists: 0, reports: 0 },
        inconsistencies: ['Erreur lors de la vérification']
      };
    }
  }

  /**
   * Mettre à jour toutes les ressources existantes avec le bon universInstanceId
   * Cette fonction est appelée lors de l'activation pour synchroniser les ressources avec l'instance active
   */
  private async updateExistingResourcesWithInstanceId(
    universId: string,
    instanceId: string,
    agencyId: string
  ): Promise<void> {
    try {
      console.log(`🔄 Mise à jour des ressources existantes avec universInstanceId=${instanceId}...`);
      
      const MAX_BATCH_SIZE = 500; // Limite Firestore
      let batch = writeBatch(db);
      let batchCount = 0;
      let totalUpdated = 0;

      const commitBatch = async () => {
        if (batchCount > 0) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
        }
      };

      // 1. Mettre à jour les formulaires
      try {
        const formsQuery = query(
          collection(db, 'forms'),
          where('agencyId', '==', agencyId),
          where('universId', '==', universId)
        );
        const formsSnapshot = await getDocs(formsQuery);
        
        for (const formDoc of formsSnapshot.docs) {
          const formData = formDoc.data();
          // Mettre à jour seulement si universInstanceId est différent ou manquant
          if (formData.universInstanceId !== instanceId) {
            const formRef = doc(db, 'forms', formDoc.id);
            batch.update(formRef, {
              universInstanceId: instanceId,
              updatedAt: serverTimestamp()
            });
            batchCount++;
            totalUpdated++;

            if (batchCount >= MAX_BATCH_SIZE) {
              await commitBatch();
            }
          }
        }
      } catch (error) {
        console.warn('⚠️ Erreur lors de la mise à jour des formulaires:', error);
      }

      // 2. Mettre à jour les dashboards
      try {
        const dashboardsQuery = query(
          collection(db, 'dashboards'),
          where('agencyId', '==', agencyId),
          where('universId', '==', universId)
        );
        const dashboardsSnapshot = await getDocs(dashboardsQuery);
        
        for (const dashboardDoc of dashboardsSnapshot.docs) {
          const dashboardData = dashboardDoc.data();
          if (dashboardData.universInstanceId !== instanceId) {
            const dashboardRef = doc(db, 'dashboards', dashboardDoc.id);
            batch.update(dashboardRef, {
              universInstanceId: instanceId,
              updatedAt: serverTimestamp()
            });
            batchCount++;
            totalUpdated++;

            if (batchCount >= MAX_BATCH_SIZE) {
              await commitBatch();
            }
          }
        }
      } catch (error) {
        console.warn('⚠️ Erreur lors de la mise à jour des dashboards:', error);
      }

      // 3. Mettre à jour les listes
      try {
        const listsQuery = query(
          collection(db, 'lists'),
          where('agencyId', '==', agencyId),
          where('universId', '==', universId)
        );
        const listsSnapshot = await getDocs(listsQuery);
        
        for (const listDoc of listsSnapshot.docs) {
          const listData = listDoc.data();
          if (listData.universInstanceId !== instanceId) {
            const listRef = doc(db, 'lists', listDoc.id);
            batch.update(listRef, {
              universInstanceId: instanceId,
              updatedAt: serverTimestamp()
            });
            batchCount++;
            totalUpdated++;

            if (batchCount >= MAX_BATCH_SIZE) {
              await commitBatch();
            }
          }
        }
      } catch (error) {
        console.warn('⚠️ Erreur lors de la mise à jour des listes:', error);
      }

      // 4. Mettre à jour les instructions (scheduledQuestions)
      try {
        const instructionsQuery = query(
          collection(db, 'scheduledQuestions'),
          where('agencyId', '==', agencyId),
          where('universId', '==', universId)
        );
        const instructionsSnapshot = await getDocs(instructionsQuery);
        
        for (const instructionDoc of instructionsSnapshot.docs) {
          const instructionData = instructionDoc.data();
          if (instructionData.universInstanceId !== instanceId) {
            const instructionRef = doc(db, 'scheduledQuestions', instructionDoc.id);
            batch.update(instructionRef, {
              universInstanceId: instanceId,
              updatedAt: serverTimestamp()
            });
            batchCount++;
            totalUpdated++;

            if (batchCount >= MAX_BATCH_SIZE) {
              await commitBatch();
            }
          }
        }
      } catch (error) {
        console.warn('⚠️ Erreur lors de la mise à jour des instructions:', error);
      }

      // 5. Mettre à jour les rapports
      try {
        const reportsQuery = query(
          collection(db, 'reports'),
          where('agencyId', '==', agencyId),
          where('universId', '==', universId)
        );
        const reportsSnapshot = await getDocs(reportsQuery);
        
        for (const reportDoc of reportsSnapshot.docs) {
          const reportData = reportDoc.data();
          if (reportData.universInstanceId !== instanceId) {
            const reportRef = doc(db, 'reports', reportDoc.id);
            batch.update(reportRef, {
              universInstanceId: instanceId,
              updatedAt: serverTimestamp()
            });
            batchCount++;
            totalUpdated++;

            if (batchCount >= MAX_BATCH_SIZE) {
              await commitBatch();
            }
          }
        }
      } catch (error) {
        console.warn('⚠️ Erreur lors de la mise à jour des rapports:', error);
      }

      // Commit les dernières mises à jour
      await commitBatch();

      console.log(`✅ ${totalUpdated} ressource(s) mise(s) à jour avec universInstanceId=${instanceId}`);
    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour des ressources existantes:', error);
      throw error;
    }
  }

  /**
   * Vérifier si une ressource a été modifiée par l'utilisateur (indique des données utilisateur)
   * Une ressource a des données utilisateur si elle a été modifiée après sa création
   * avec un délai minimum pour éviter les faux positifs (création immédiate)
   */
  private hasBeenModifiedByUser(resource: any): boolean {
    if (!resource) {
      return false;
    }

    try {
      const createdAt = resource.createdAt?.toDate ? resource.createdAt.toDate() : new Date(resource.createdAt);
      const updatedAt = resource.updatedAt?.toDate ? resource.updatedAt.toDate() : new Date(resource.updatedAt);
      
      // Si pas de dates, considérer qu'il n'y a pas de données utilisateur
      if (!createdAt || !updatedAt || isNaN(createdAt.getTime()) || isNaN(updatedAt.getTime())) {
        return false;
      }

      // Délai minimum de 5 secondes pour considérer qu'une modification est intentionnelle
      // (évite les faux positifs lors de la création immédiate)
      const MIN_MODIFICATION_DELAY_MS = 5000;
      const timeDiff = updatedAt.getTime() - createdAt.getTime();
      
      return timeDiff > MIN_MODIFICATION_DELAY_MS;
    } catch (error) {
      console.warn('⚠️ Erreur lors de la vérification de modification:', error);
      return false;
    }
  }

  /**
   * Vérifier si une liste a des données utilisateur (rows ajoutés après l'instanciation)
   * Une liste a des données utilisateur si elle a plus de rows que la définition correspondante
   * OU si elle a été modifiée par l'utilisateur
   */
  private hasUserAddedData(list: any, listDefinition?: any): boolean {
    if (!list) {
      return false;
    }

    // Vérifier d'abord si la liste a été modifiée par l'utilisateur
    if (this.hasBeenModifiedByUser(list)) {
      return true;
    }

    // Vérifier si la liste a des rows
    if (!Array.isArray(list.rows)) {
      return false;
    }

    const listRowsCount = list.rows.length;

    // Si pas de définition fournie, considérer qu'il y a des données si la liste a des rows
    if (!listDefinition) {
      return listRowsCount > 0;
    }

    // Comparer avec la définition
    const definitionRowsCount = Array.isArray(listDefinition.rows) ? listDefinition.rows.length : 0;
    
    // Si la liste a plus de rows que la définition, elle a des données utilisateur
    return listRowsCount > definitionRowsCount;
  }

  /**
   * Vérifier si un formulaire a des données utilisateur
   * Un formulaire a des données utilisateur s'il a été modifié par l'utilisateur
   * (champs ajoutés, structure modifiée, etc.)
   */
  private hasFormUserData(form: any): boolean {
    return this.hasBeenModifiedByUser(form);
  }

  /**
   * Vérifier si un dashboard a des données utilisateur
   * Un dashboard a des données utilisateur s'il a été modifié par l'utilisateur
   * (métriques ajoutées, configuration modifiée, etc.)
   */
  private hasDashboardUserData(dashboard: any): boolean {
    return this.hasBeenModifiedByUser(dashboard);
  }

  /**
   * Vérifier si une instruction a des données utilisateur
   * Une instruction a des données utilisateur si elle a été modifiée par l'utilisateur
   */
  private hasInstructionUserData(instruction: any): boolean {
    return this.hasBeenModifiedByUser(instruction);
  }

  /**
   * Vérifier si un rapport a des données utilisateur
   * Un rapport a des données utilisateur s'il a été modifié par l'utilisateur
   */
  private hasReportUserData(report: any): boolean {
    return this.hasBeenModifiedByUser(report);
  }

  /**
   * Supprimer les ressources existantes pour une instance (pour éviter les doublons lors de la recréation)
   * NE SUPPRIME PAS les ressources qui ont des données utilisateur (modifiées par l'utilisateur)
   */
  private async deleteResourcesForInstance(
    instanceId: string,
    universId: string,
    agencyId: string,
    univers?: Univers
  ): Promise<void> {
    try {
      const MAX_BATCH_SIZE = 500;
      let batch = writeBatch(db);
      let batchCount = 0;
      let totalDeleted = 0;
      const preservedResources = {
        forms: 0,
        dashboards: 0,
        instructions: 0,
        lists: 0,
        reports: 0
      };

      const commitBatch = async () => {
        if (batchCount > 0) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
        }
      };

      // Récupérer les définitions de listes si le Univers est fourni
      const listDefinitionsMap = new Map<string, any>();
      if (univers?.definitions?.lists) {
        for (const listDef of univers.definitions.lists) {
          listDefinitionsMap.set(listDef.name, listDef);
        }
      }

      // 1. Supprimer les formulaires (SAUF ceux qui ont des données utilisateur)
      try {
        const formsQuery = query(
          collection(db, 'forms'),
          where('agencyId', '==', agencyId),
          where('universId', '==', universId),
          where('universInstanceId', '==', instanceId)
        );
        const formsSnapshot = await getDocs(formsQuery);
        for (const formDoc of formsSnapshot.docs) {
          const formData = formDoc.data();
          
          // Vérifier si le formulaire a des données utilisateur
          if (this.hasFormUserData(formData)) {
            console.log(`🔒 Préservation du formulaire "${formData.name || formDoc.id}" (ID: ${formDoc.id}) car il contient des données utilisateur`);
            preservedResources.forms++;
            continue; // Ne pas supprimer ce formulaire
          }
          
          // Supprimer seulement les formulaires sans données utilisateur
          batch.delete(doc(db, 'forms', formDoc.id));
          batchCount++;
          totalDeleted++;
          if (batchCount >= MAX_BATCH_SIZE) {
            await commitBatch();
          }
        }
      } catch (error) {
        console.warn('⚠️ Erreur lors de la suppression des formulaires:', error);
      }

      // 2. Supprimer les dashboards (SAUF ceux qui ont des données utilisateur)
      try {
        const dashboardsQuery = query(
          collection(db, 'dashboards'),
          where('agencyId', '==', agencyId),
          where('universId', '==', universId),
          where('universInstanceId', '==', instanceId)
        );
        const dashboardsSnapshot = await getDocs(dashboardsQuery);
        for (const dashboardDoc of dashboardsSnapshot.docs) {
          const dashboardData = dashboardDoc.data();
          
          // Vérifier si le dashboard a des données utilisateur
          if (this.hasDashboardUserData(dashboardData)) {
            console.log(`🔒 Préservation du dashboard "${dashboardData.name || dashboardDoc.id}" (ID: ${dashboardDoc.id}) car il contient des données utilisateur`);
            preservedResources.dashboards++;
            continue; // Ne pas supprimer ce dashboard
          }
          
          // Supprimer seulement les dashboards sans données utilisateur
          batch.delete(doc(db, 'dashboards', dashboardDoc.id));
          batchCount++;
          totalDeleted++;
          if (batchCount >= MAX_BATCH_SIZE) {
            await commitBatch();
          }
        }
      } catch (error) {
        console.warn('⚠️ Erreur lors de la suppression des dashboards:', error);
      }

      // 3. Supprimer les instructions (SAUF celles qui ont des données utilisateur)
      try {
        const instructionsQuery = query(
          collection(db, 'scheduledQuestions'),
          where('agencyId', '==', agencyId),
          where('universId', '==', universId),
          where('universInstanceId', '==', instanceId)
        );
        const instructionsSnapshot = await getDocs(instructionsQuery);
        for (const instructionDoc of instructionsSnapshot.docs) {
          const instructionData = instructionDoc.data();
          
          // Vérifier si l'instruction a des données utilisateur
          if (this.hasInstructionUserData(instructionData)) {
            console.log(`🔒 Préservation de l'instruction "${instructionData.title || instructionDoc.id}" (ID: ${instructionDoc.id}) car elle contient des données utilisateur`);
            preservedResources.instructions++;
            continue; // Ne pas supprimer cette instruction
          }
          
          // Supprimer seulement les instructions sans données utilisateur
          batch.delete(doc(db, 'scheduledQuestions', instructionDoc.id));
          batchCount++;
          totalDeleted++;
          if (batchCount >= MAX_BATCH_SIZE) {
            await commitBatch();
          }
        }
      } catch (error) {
        console.warn('⚠️ Erreur lors de la suppression des instructions:', error);
      }

      // 4. Supprimer les listes (SAUF celles qui ont des données utilisateur)
      try {
        const listsQuery = query(
          collection(db, 'lists'),
          where('agencyId', '==', agencyId),
          where('universId', '==', universId),
          where('universInstanceId', '==', instanceId)
        );
        const listsSnapshot = await getDocs(listsQuery);
        for (const listDoc of listsSnapshot.docs) {
          const listData = listDoc.data();
          const listDefinition = listDefinitionsMap.get(listData.name);
          
          // Vérifier si la liste a des données utilisateur
          if (this.hasUserAddedData(listData, listDefinition)) {
            console.log(`🔒 Préservation de la liste "${listData.name}" (ID: ${listDoc.id}) car elle contient des données utilisateur`);
            preservedResources.lists++;
            continue; // Ne pas supprimer cette liste
          }
          
          // Supprimer seulement les listes sans données utilisateur
          batch.delete(doc(db, 'lists', listDoc.id));
          batchCount++;
          totalDeleted++;
          if (batchCount >= MAX_BATCH_SIZE) {
            await commitBatch();
          }
        }
      } catch (error) {
        console.warn('⚠️ Erreur lors de la suppression des listes:', error);
      }

      // 5. Supprimer les rapports (SAUF ceux qui ont des données utilisateur)
      try {
        const reportsQuery = query(
          collection(db, 'reports'),
          where('agencyId', '==', agencyId),
          where('universId', '==', universId),
          where('universInstanceId', '==', instanceId)
        );
        const reportsSnapshot = await getDocs(reportsQuery);
        for (const reportDoc of reportsSnapshot.docs) {
          const reportData = reportDoc.data();
          
          // Vérifier si le rapport a des données utilisateur
          if (this.hasReportUserData(reportData)) {
            console.log(`🔒 Préservation du rapport "${reportData.name || reportDoc.id}" (ID: ${reportDoc.id}) car il contient des données utilisateur`);
            preservedResources.reports++;
            continue; // Ne pas supprimer ce rapport
          }
          
          // Supprimer seulement les rapports sans données utilisateur
          batch.delete(doc(db, 'reports', reportDoc.id));
          batchCount++;
          totalDeleted++;
          if (batchCount >= MAX_BATCH_SIZE) {
            await commitBatch();
          }
        }
      } catch (error) {
        console.warn('⚠️ Erreur lors de la suppression des rapports:', error);
      }

      await commitBatch();
      if (totalDeleted > 0) {
        console.log(`🗑️ ${totalDeleted} ressource(s) supprimée(s) pour l'instance ${instanceId}`);
      }
      
      const totalPreserved = preservedResources.forms + preservedResources.dashboards + 
                           preservedResources.instructions + preservedResources.lists + 
                           preservedResources.reports;
      if (totalPreserved > 0) {
        console.log(`🔒 ${totalPreserved} ressource(s) préservée(s) car elles contiennent des données utilisateur:`);
        if (preservedResources.forms > 0) console.log(`   - ${preservedResources.forms} formulaire(s)`);
        if (preservedResources.dashboards > 0) console.log(`   - ${preservedResources.dashboards} dashboard(s)`);
        if (preservedResources.instructions > 0) console.log(`   - ${preservedResources.instructions} instruction(s)`);
        if (preservedResources.lists > 0) console.log(`   - ${preservedResources.lists} liste(s)`);
        if (preservedResources.reports > 0) console.log(`   - ${preservedResources.reports} rapport(s)`);
      }
    } catch (error) {
      console.error('❌ Erreur lors de la suppression des ressources:', error);
      throw error;
    }
  }

  /**
   * Instancier les ressources d'un Univers pour une instance existante
   * (pour les Univers créés directement, pas achetés)
   * Supprime les anciennes ressources incohérentes avant de créer les nouvelles pour éviter les doublons
   * PRÉSERVE toutes les ressources qui ont des données utilisateur
   */
  private async instantiateResourcesOnly(
    univers: Univers,
    directorId: string,
    agencyId: string,
    instanceId: string
  ): Promise<void> {
    try {
      if (!univers.definitions) {
        throw new Error('Univers sans définitions');
      }

      // Récupérer toutes les ressources existantes pour vérifier lesquelles ont des données utilisateur
      // Gérer les erreurs de permissions individuellement pour ne pas bloquer tout le processus
      const fetchResource = async (collectionName: string, errorMessage: string) => {
        try {
          return await getDocs(query(
            collection(db, collectionName),
            where('agencyId', '==', agencyId),
            where('universId', '==', univers.id),
            where('universInstanceId', '==', instanceId)
          ));
        } catch (error: any) {
          // Si erreur de permissions, logger un avertissement et retourner un snapshot vide
          if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
            console.warn(`⚠️ Permissions insuffisantes pour lire ${collectionName}. Continuation sans ces ressources.`);
            return { docs: [], empty: true, size: 0 } as any;
          }
          // Pour les autres erreurs, logger et continuer
          console.warn(`⚠️ ${errorMessage}:`, error);
          return { docs: [], empty: true, size: 0 } as any;
        }
      };

      const [existingForms, existingDashboards, existingInstructions, existingLists, existingReports] = await Promise.all([
        fetchResource('forms', 'Erreur lors de la récupération des formulaires'),
        fetchResource('dashboards', 'Erreur lors de la récupération des dashboards'),
        fetchResource('scheduledQuestions', 'Erreur lors de la récupération des instructions'),
        fetchResource('lists', 'Erreur lors de la récupération des listes'),
        fetchResource('reports', 'Erreur lors de la récupération des rapports')
      ]);

      // Créer des maps des ressources existantes par nom/ID
      const existingFormsMap = new Map<string, { id: string; data: any }>();
      const existingDashboardsMap = new Map<string, { id: string; data: any }>();
      const existingInstructionsMap = new Map<string, { id: string; data: any }>();
      const existingListsMap = new Map<string, { id: string; data: any }>();
      const existingReportsMap = new Map<string, { id: string; data: any }>();

      existingForms.docs.forEach((doc: any) => {
        const data = doc.data();
        existingFormsMap.set(data.name || data.title || doc.id, { id: doc.id, data });
      });
      existingDashboards.docs.forEach((doc: any) => {
        const data = doc.data();
        existingDashboardsMap.set(data.name || doc.id, { id: doc.id, data });
      });
      existingInstructions.docs.forEach((doc: any) => {
        const data = doc.data();
        existingInstructionsMap.set(data.title || doc.id, { id: doc.id, data });
      });
      existingLists.docs.forEach((doc: any) => {
        const data = doc.data();
        existingListsMap.set(data.name || doc.id, { id: doc.id, data });
      });
      existingReports.docs.forEach((doc: any) => {
        const data = doc.data();
        existingReportsMap.set(data.name || doc.id, { id: doc.id, data });
      });

      // Créer des maps des définitions par nom/ID
      const listDefinitionsMap = new Map<string, any>();
      if (univers.definitions.lists) {
        for (const listDef of univers.definitions.lists) {
          listDefinitionsMap.set(listDef.name, listDef);
        }
      }

      // Identifier les ressources à préserver et celles à créer
      const preservedResourceIds = {
        forms: [] as string[],
        dashboards: [] as string[],
        instructions: [] as string[],
        lists: [] as string[],
        reports: [] as string[]
      };

      const resourcesToCreate = {
        forms: [] as any[],
        dashboards: [] as any[],
        instructions: [] as any[],
        lists: [] as any[],
        reports: [] as any[]
      };

      // Filtrer les formulaires
      if (univers.definitions.forms) {
        for (const formDef of univers.definitions.forms) {
          const existing = existingFormsMap.get(formDef.title || formDef.id);
          if (existing && this.hasFormUserData(existing.data)) {
            console.log(`🔒 Préservation du formulaire "${formDef.title || formDef.id}" (ID: ${existing.id}) car il contient des données utilisateur`);
            preservedResourceIds.forms.push(existing.id);
          } else {
            resourcesToCreate.forms.push(formDef);
          }
        }
      }

      // Filtrer les dashboards
      if (univers.definitions.dashboards) {
        for (const dashboardDef of univers.definitions.dashboards) {
          const existing = existingDashboardsMap.get(dashboardDef.name || dashboardDef.id);
          if (existing && this.hasDashboardUserData(existing.data)) {
            console.log(`🔒 Préservation du dashboard "${dashboardDef.name}" (ID: ${existing.id}) car il contient des données utilisateur`);
            preservedResourceIds.dashboards.push(existing.id);
          } else {
            resourcesToCreate.dashboards.push(dashboardDef);
          }
        }
      }

      // Filtrer les instructions
      if (univers.definitions.instructions) {
        for (const instructionDef of univers.definitions.instructions) {
          const existing = existingInstructionsMap.get(instructionDef.title || instructionDef.id);
          if (existing && this.hasInstructionUserData(existing.data)) {
            console.log(`🔒 Préservation de l'instruction "${instructionDef.title}" (ID: ${existing.id}) car elle contient des données utilisateur`);
            preservedResourceIds.instructions.push(existing.id);
          } else {
            resourcesToCreate.instructions.push(instructionDef);
          }
        }
      }

      // Filtrer les listes
      if (univers.definitions.lists) {
        for (const listDef of univers.definitions.lists) {
          const existing = existingListsMap.get(listDef.name);
          if (existing) {
            const listDefinition = listDefinitionsMap.get(listDef.name);
            if (this.hasUserAddedData(existing.data, listDefinition)) {
              console.log(`🔒 Préservation de la liste "${listDef.name}" (ID: ${existing.id}) car elle contient des données utilisateur`);
              preservedResourceIds.lists.push(existing.id);
              continue;
            }
          }
          resourcesToCreate.lists.push(listDef);
        }
      }

      // Filtrer les rapports
      if (univers.definitions.reports) {
        for (const reportDef of univers.definitions.reports) {
          const existing = existingReportsMap.get(reportDef.name || reportDef.id);
          if (existing && this.hasReportUserData(existing.data)) {
            console.log(`🔒 Préservation du rapport "${reportDef.name}" (ID: ${existing.id}) car il contient des données utilisateur`);
            preservedResourceIds.reports.push(existing.id);
          } else {
            resourcesToCreate.reports.push(reportDef);
          }
        }
      }

      // Supprimer les anciennes ressources incohérentes pour cette instance avant de créer les nouvelles
      // Cela évite les doublons lors de la recréation (les ressources avec données utilisateur seront préservées)
      console.log(`🗑️ Suppression des anciennes ressources incohérentes pour l'instance ${instanceId}...`);
      await this.deleteResourcesForInstance(instanceId, univers.id, agencyId, univers);

      // Créer les ressources avec seulement celles qui doivent être créées
      const definitionsToInstantiate = {
        ...univers.definitions,
        forms: resourcesToCreate.forms,
        dashboards: resourcesToCreate.dashboards,
        instructions: resourcesToCreate.instructions,
        lists: resourcesToCreate.lists,
        reports: resourcesToCreate.reports
      };

      // Utiliser l'instanceId fourni pour créer les ressources
      // Appeler le service d'instanciation pour créer les ressources réelles
      const instantiationResult = await universInstantiationService.instantiate({
        definitions: definitionsToInstantiate,
        userId: directorId,
        userRole: 'directeur',
        agencyId,
        universId: univers.id,
        universInstanceId: instanceId
      });

      // Combiner les IDs des ressources créées avec ceux des ressources préservées
      const allResourceIds = {
        forms: [...preservedResourceIds.forms, ...instantiationResult.forms],
        dashboards: [...preservedResourceIds.dashboards, ...instantiationResult.dashboards],
        instructions: [...preservedResourceIds.instructions, ...instantiationResult.instructions],
        lists: [...preservedResourceIds.lists, ...instantiationResult.lists],
        reports: [...preservedResourceIds.reports, ...instantiationResult.reports]
      };

      // Mettre à jour l'instance avec les IDs des ressources créées et préservées
      const instanceRef = doc(db, this.instancesCollectionName, instanceId);
      await updateDoc(instanceRef, {
        instances: {
          forms: allResourceIds.forms,
          dashboards: allResourceIds.dashboards,
          instructions: allResourceIds.instructions,
          lists: allResourceIds.lists,
          reports: allResourceIds.reports
        },
        updatedAt: serverTimestamp()
      });

      // Incrémenter le compteur d'utilisation (première instanciation des ressources)
      await this.incrementUsage(univers.id);

      const totalPreserved = preservedResourceIds.forms.length + preservedResourceIds.dashboards.length +
                           preservedResourceIds.instructions.length + preservedResourceIds.lists.length +
                           preservedResourceIds.reports.length;
      if (totalPreserved > 0) {
        console.log(`✅ Ressources instanciées pour Univers ${univers.id} avec instanceId=${instanceId}. ${totalPreserved} ressource(s) préservée(s) avec données utilisateur.`);
      } else {
        console.log(`✅ Ressources instanciées pour Univers ${univers.id} avec instanceId=${instanceId}`);
      }
    } catch (error) {
      console.error('❌ Erreur lors de l\'instanciation des ressources:', error);
      throw new Error(`Échec de l'instanciation des ressources: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  }

  /**
   * Activer un Univers (désactive automatiquement l'ancien si nécessaire)
   * Instancie automatiquement les ressources si elles n'existent pas encore
   */
  async activateUnivers(
    universId: string,
    directorId: string,
    agencyId: string,
    useDraft: boolean = false
  ): Promise<void> {
    try {
      // 1. Vérifier que le Univers appartient au directeur ou est acheté
      // Si useDraft est true, récupérer avec userId pour avoir accès au draft
      const univers = useDraft 
        ? await this.getById(universId, directorId)
        : await this.getById(universId);
      if (!univers) {
        throw new Error('Univers non trouvé');
      }

      // Vérifier que si useDraft est true, c'est bien le créateur et qu'il y a un draft
      if (useDraft) {
        const isOwner = univers.ownership.createdBy === directorId;
        if (!isOwner) {
          throw new Error('Seul le créateur peut activer la version draft');
        }
        if (!univers.draftData || !univers.hasUnpublishedChanges) {
          throw new Error('Aucun draft disponible pour activation');
        }
        console.log('🔍 activateUnivers - Using draft version for testing');
      }

      // 2. Validation: au moins un formulaire est requis pour activation (sauf pour les univers par défaut)
      const forms = univers.definitions?.forms || [];
      const isDefault = univers.metadata?.isDefault === true;
      
      // Debug: vérifier les valeurs
      console.log('🔍 [activateUnivers] Vérification:', {
        universId,
        formsCount: forms.length,
        isDefault,
        metadata: univers.metadata
      });
      
      if (forms.length === 0 && !isDefault) {
        throw new Error('Au moins un formulaire est requis pour activer un Univers. Veuillez ajouter au moins un formulaire avant d\'activer.');
      }

      const isOwner = univers.ownership.createdBy === directorId;

      // CAS SIMPLIFIÉ : Univers par défaut vide - activation directe sans instance
      if (isDefault && forms.length === 0 && isOwner) {
        // Désactiver l'ancien Univers actif
        const currentActive = await this.getActiveUnivers(directorId, agencyId);
        if (currentActive && currentActive.activeInstanceId) {
          // Désactiver l'instance existante si elle existe
          const instanceRef = doc(db, this.instancesCollectionName, currentActive.activeInstanceId);
          await updateDoc(instanceRef, { isActive: false });
        }
        
        // Activer directement sans instance
        await this.setActiveUnivers(directorId, agencyId, universId);
        console.log(`✅ Univers par défaut activé directement (sans instance) pour directeur ${directorId}`);
        return; // Fin - pas besoin d'instance ni de vérifications
      }
      
      // 3. Vérifier si c'est une instance achetée ou créer/trouver une instance pour le propriétaire
      // Déterminer si on doit utiliser le draft pour l'instanciation
      const shouldUseDraft = useDraft && isOwner && univers.ownership.isMarketplaceTemplate && univers.hasUnpublishedChanges;
      
      let instanceId: string | undefined;
      if (univers.ownership.isMarketplaceTemplate && !isOwner) {
        // Chercher une instance de ce Univers pour ce directeur (non-propriétaire)
        const instances = await this.getInstancesByUser(directorId, agencyId);
        const instance = instances.find(inst => inst.universId === universId);
        if (instance) {
          instanceId = instance.id;
          console.log(`✅ Instance trouvée pour Univers acheté: ${instanceId}`);
          
          // Vérifier si les ressources existent déjà pour cette instance et si elles sont cohérentes
          const resourcesCheck = await this.checkIfResourcesExistForInstance(instanceId, universId, agencyId, univers);
          
          if (!resourcesCheck.exists) {
            // Vérifier si des ressources existent avec un autre universInstanceId
            const resourcesExist = await this.checkIfResourcesExist(universId, agencyId);
            if (resourcesExist) {
              console.log(`🔄 Ressources existantes trouvées, mise à jour avec universInstanceId=${instanceId}...`);
              await this.updateExistingResourcesWithInstanceId(universId, instanceId, agencyId);
              
              // Après la mise à jour, vérifier à nouveau si les ressources existent et sont cohérentes
              const afterUpdateCheck = await this.checkIfResourcesExistForInstance(instanceId, universId, agencyId, univers);
              if (!afterUpdateCheck.exists) {
                console.log(`⚠️ Après mise à jour, aucune ressource trouvée pour cette instance, création des ressources...`);
                // Pour les Univers achetés, on ne peut pas créer de nouvelles ressources
                // car on n'a pas accès aux définitions du Univers (seul le propriétaire peut)
                console.warn(`⚠️ Impossible de créer des ressources pour un Univers acheté. Veuillez contacter le propriétaire.`);
              } else if (!afterUpdateCheck.isConsistent) {
                console.warn(`⚠️ Ressources incohérentes après mise à jour:`, afterUpdateCheck.inconsistencies);
                console.warn(`⚠️ Impossible de corriger les ressources pour un Univers acheté. Veuillez contacter le propriétaire.`);
              } else {
                console.log(`✅ Ressources mises à jour avec succès pour cette instance`);
              }
            }
          } else if (!resourcesCheck.isConsistent) {
            // Les ressources existent mais sont incohérentes
            console.warn(`⚠️ Ressources incohérentes détectées:`, resourcesCheck.inconsistencies);
            console.warn(`⚠️ Impossible de corriger les ressources pour un Univers acheté. Veuillez contacter le propriétaire.`);
          } else {
            // Les ressources existent et sont cohérentes : ne rien faire
            console.log(`✅ Ressources déjà existantes et cohérentes pour cette instance, pas de mise à jour nécessaire`);
          }
        } else {
          throw new Error('Vous devez d\'abord acheter ce Univers depuis le marketplace');
        }
      } else if (!isOwner) {
        throw new Error('Vous ne pouvez pas activer ce Univers');
      } else {
        // 4. Pour le propriétaire, créer ou trouver une instance pour tracker la version
            const instances = await this.getInstancesByUser(directorId, agencyId);
        let instance = instances.find(inst => inst.universId === universId);
        
        if (!instance) {
          // Aucune instance existante : créer une instance complète pour tracker la version
          console.log(`📦 Création d'une instance pour le propriétaire du Univers ${universId}...`);
          const { instanceId: newInstanceId } = await this.instantiate(
            universId,
            directorId,
            'directeur',
            agencyId,
            shouldUseDraft // Utiliser le draft si demandé
          );
          instanceId = newInstanceId;
          
          // Incrémenter l'usage pour les Univers marketplace
          if (univers.ownership.isMarketplaceTemplate) {
              await this.incrementUsage(universId);
            }
          
          console.log(`✅ Instance créée pour le propriétaire: ${instanceId}`);
        } else {
          // Instance existante : l'utiliser
          instanceId = instance.id;
          console.log(`✅ Instance existante trouvée pour le propriétaire: ${instanceId}`);
          
          // Vérifier si les ressources existent déjà pour cette instance et si elles sont cohérentes
          const resourcesCheck = await this.checkIfResourcesExistForInstance(instanceId, universId, agencyId, univers);
          
          if (!resourcesCheck.exists) {
            // Vérifier si des ressources existent avec un autre universInstanceId
            const resourcesExist = await this.checkIfResourcesExist(universId, agencyId);
            if (!resourcesExist) {
              // Aucune ressource n'existe : créer les ressources avec l'instanceId correct
              console.log(`📦 Ressources non trouvées, instanciation automatique...`);
              await this.instantiateResourcesOnly(univers, directorId, agencyId, instanceId);
              console.log(`✅ Ressources instanciées avec succès`);
            } else {
              // Des ressources existent mais pas pour cette instance : mettre à jour leur universInstanceId
              console.log(`🔄 Ressources existantes trouvées, mise à jour avec universInstanceId=${instanceId}...`);
              await this.updateExistingResourcesWithInstanceId(universId, instanceId, agencyId);
              
              // Après la mise à jour, vérifier à nouveau si les ressources existent et sont cohérentes
              const afterUpdateCheck = await this.checkIfResourcesExistForInstance(instanceId, universId, agencyId, univers);
              if (!afterUpdateCheck.exists) {
                console.log(`⚠️ Après mise à jour, aucune ressource trouvée pour cette instance, création des ressources...`);
                await this.instantiateResourcesOnly(univers, directorId, agencyId, instanceId);
                console.log(`✅ Ressources créées après mise à jour`);
              } else if (!afterUpdateCheck.isConsistent) {
                // Les ressources existent mais sont incohérentes : les recréer
                console.warn(`⚠️ Ressources incohérentes après mise à jour:`, afterUpdateCheck.inconsistencies);
                console.log(`🔄 Recréation des ressources pour corriger les incohérences...`);
                await this.instantiateResourcesOnly(univers, directorId, agencyId, instanceId);
                console.log(`✅ Ressources recréées avec succès`);
              } else {
                console.log(`✅ Ressources mises à jour avec succès pour cette instance`);
              }
            }
          } else if (!resourcesCheck.isConsistent) {
            // Les ressources existent mais sont incohérentes
            // Vérifier si les incohérences sont uniquement dues à des problèmes de permissions
            const hasOnlyPermissionIssues = resourcesCheck.inconsistencies.every(inc => 
              inc.includes('Instructions') && resourcesCheck.actualCounts.instructions === 0
            );
            
            if (hasOnlyPermissionIssues) {
              // Si c'est juste un problème de permissions pour les instructions, ne pas recréer
              // Les instructions peuvent exister mais ne pas être accessibles
              console.warn(`⚠️ Incohérences détectées mais probablement dues à des permissions:`, resourcesCheck.inconsistencies);
              console.log(`ℹ️ Les ressources existent. Les instructions peuvent ne pas être accessibles à cause des permissions.`);
              console.log(`✅ Pas de recréation nécessaire - les ressources sont probablement correctes.`);
            } else {
              // Vraies incohérences : recréer les ressources manquantes
              console.warn(`⚠️ Ressources incohérentes détectées:`, resourcesCheck.inconsistencies);
              console.log(`🔄 Recréation des ressources pour corriger les incohérences...`);
              await this.instantiateResourcesOnly(univers, directorId, agencyId, instanceId);
              console.log(`✅ Ressources recréées avec succès`);
            }
          } else {
            // Les ressources existent et sont cohérentes : ne rien faire
            console.log(`✅ Ressources déjà existantes et cohérentes pour cette instance, pas de création nécessaire`);
          }
        }
      }

      // 5. Désactiver l'ancien Univers actif
      const currentActive = await this.getActiveUnivers(directorId, agencyId);
      if (currentActive) {
        if (currentActive.activeInstanceId) {
          // Désactiver l'instance
          const instanceRef = doc(db, this.instancesCollectionName, currentActive.activeInstanceId);
          await updateDoc(instanceRef, { isActive: false });
        } else {
          // Désactiver le template Univers
          const universRef = doc(db, this.collectionName, currentActive.activeUniversId);
          await updateDoc(universRef, { 'metadata.isActive': false });
        }
      }

      // 6. Activer le nouveau Univers (toujours via instance maintenant)
      if (instanceId) {
        // Activer l'instance (tous les cas : acheté ou propriétaire)
        const instanceRef = doc(db, this.instancesCollectionName, instanceId);
        await updateDoc(instanceRef, { isActive: true });
        await this.setActiveUnivers(directorId, agencyId, universId, instanceId);
      } else {
        // Fallback : si aucune instance n'a été créée (ne devrait pas arriver)
        console.warn(`⚠️ Aucune instance trouvée pour Univers ${universId}, activation du template directement`);
        const universRef = doc(db, this.collectionName, universId);
        await updateDoc(universRef, { 'metadata.isActive': true });
        await this.setActiveUnivers(directorId, agencyId, universId);
      }

      console.log(`✅ Univers activé: ${universId} pour directeur ${directorId}`);
    } catch (error) {
      console.error('Erreur lors de l\'activation du Univers:', error);
      throw error;
    }
  }

  /**
   * Créer une instance pour l'univers actif si elle n'existe pas encore
   * Cette méthode est appelée à la demande lors de la première création de ressource
   * pour un univers par défaut qui a été activé sans instance
   */
  async ensureInstanceForActiveUnivers(
    directorId: string,
    agencyId: string
  ): Promise<string | null> {
    try {
      // 1. Récupérer l'univers actif
      const activeUnivers = await this.getActiveUnivers(directorId, agencyId);
      if (!activeUnivers) {
        console.warn('⚠️ Aucun univers actif trouvé pour créer une instance');
        return null;
      }

      // 2. Si une instance existe déjà, la retourner
      if (activeUnivers.activeInstanceId) {
        return activeUnivers.activeInstanceId;
      }

      // 3. Récupérer l'univers
      const univers = await this.getById(activeUnivers.activeUniversId);
      if (!univers) {
        console.warn('⚠️ Univers non trouvé pour créer une instance');
        return null;
      }

      // 4. Vérifier si une instance existe déjà pour cet univers
      const instances = await this.getInstancesByUser(directorId, agencyId);
      const existingInstance = instances.find(inst => inst.universId === univers.id);
      
      if (existingInstance) {
        // Utiliser l'instance existante et la mettre à jour dans activeUnivers
        await this.setActiveUnivers(directorId, agencyId, univers.id, existingInstance.id);
        await updateDoc(doc(db, this.instancesCollectionName, existingInstance.id), { 
          isActive: true 
        });
        console.log(`✅ Instance existante réutilisée: ${existingInstance.id}`);
        return existingInstance.id;
      }

      // 5. Créer une nouvelle instance vide (sans ressources pour l'instant)
      // Les ressources seront ajoutées progressivement lors de leur création
      const instanceId = `instance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const instanceData: any = {
        universId: univers.id,
        universVersion: univers.metadata.version || 1,
        userId: directorId,
        agencyId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isActive: true,
        instances: {
          forms: [],
          dashboards: [],
          instructions: [],
          lists: [],
          reports: []
        },
        metadata: {
          universName: univers.metadata.name,
          universVersion: univers.metadata.version || 1,
          isFromMarketplace: univers.ownership.isMarketplaceTemplate || false
        },
        updateAvailable: false
      };

      const instanceRef = doc(db, this.instancesCollectionName, instanceId);
      await setDoc(instanceRef, instanceData);

      // 6. Mettre à jour activeUnivers avec la nouvelle instance
      await this.setActiveUnivers(directorId, agencyId, univers.id, instanceId);

      console.log(`✅ Instance créée à la demande pour univers ${univers.id}: ${instanceId}`);
      return instanceId;
    } catch (error) {
      console.error('❌ Erreur lors de la création de l\'instance à la demande:', error);
      // Ne pas bloquer si l'instance ne peut pas être créée
      return null;
    }
  }

  /**
   * Ajouter une ressource à l'instance de l'univers actif
   * Cette méthode est appelée après la création d'une ressource (form, dashboard, etc.)
   */
  async addResourceToInstance(
    directorId: string,
    agencyId: string,
    resourceId: string,
    resourceType: 'form' | 'dashboard' | 'instruction' | 'list' | 'report'
  ): Promise<void> {
    try {
      // 1. Récupérer l'univers actif
      const activeUnivers = await this.getActiveUnivers(directorId, agencyId);
      if (!activeUnivers || !activeUnivers.activeInstanceId) {
        // Pas d'instance active, ne rien faire (ressource créée sans instance)
        return;
      }

      // 2. Mettre à jour l'instance avec la nouvelle ressource
      const instanceRef = doc(db, this.instancesCollectionName, activeUnivers.activeInstanceId);
      const instanceDoc = await getDoc(instanceRef);
      
      if (!instanceDoc.exists()) {
        console.warn(`⚠️ Instance ${activeUnivers.activeInstanceId} non trouvée pour ajouter la ressource`);
        return;
      }

      const instanceData = instanceDoc.data() as UniversInstance;
      const currentInstances = instanceData.instances || {
        forms: [],
        dashboards: [],
        instructions: [],
        lists: [],
        reports: []
      };

      // Ajouter la ressource au tableau approprié si elle n'existe pas déjà
      // Mapping des types de ressources vers les noms de propriétés dans l'instance
      const resourceTypeMap: Record<typeof resourceType, keyof typeof currentInstances> = {
        form: 'forms',
        dashboard: 'dashboards',
        instruction: 'instructions',
        list: 'lists',
        report: 'reports'
      };
      
      const resourceArrayKey = resourceTypeMap[resourceType];
      const resourceArray = currentInstances[resourceArrayKey] as string[];
      
      if (!resourceArray.includes(resourceId)) {
        resourceArray.push(resourceId);
        
        await updateDoc(instanceRef, {
          instances: {
            ...currentInstances,
            [resourceArrayKey]: resourceArray
          },
          updatedAt: serverTimestamp()
        });
        
        console.log(`✅ Ressource ${resourceType} ${resourceId} ajoutée à l'instance ${activeUnivers.activeInstanceId}`);
      }
    } catch (error) {
      console.warn(`⚠️ Erreur lors de l'ajout de la ressource à l'instance (non bloquant):`, error);
      // Ne pas bloquer si l'instance ne peut pas être mise à jour
    }
  }

  /**
   * Désactiver l'Univers actif d'un directeur
   */
  async deactivateUnivers(directorId: string, agencyId: string): Promise<void> {
    try {
      const activeUnivers = await this.getActiveUnivers(directorId, agencyId);
      if (!activeUnivers) {
        return; // Aucun Univers actif à désactiver
      }

      if (activeUnivers.activeInstanceId) {
        // Désactiver l'instance
        const instanceRef = doc(db, this.instancesCollectionName, activeUnivers.activeInstanceId);
        await updateDoc(instanceRef, { isActive: false });
      } else {
        // Désactiver le template Univers
        const universRef = doc(db, this.collectionName, activeUnivers.activeUniversId);
        await updateDoc(universRef, { 'metadata.isActive': false });
      }

      // Supprimer le document ActiveUnivers
      const docRef = doc(db, this.activeUniversCollectionName, directorId);
      await deleteDoc(docRef);

      console.log(`✅ Univers désactivé pour directeur ${directorId}`);
    } catch (error) {
      console.error('Erreur lors de la désactivation du Univers:', error);
      throw error;
    }
  }
}

export const universService = new UniversService();


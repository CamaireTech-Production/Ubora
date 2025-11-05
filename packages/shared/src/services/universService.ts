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
import { Univers, UniversInstance, UniversDefinitions, UniversMetadata, UniversOwnership, UniversUsage, ActiveUnivers, UniversVersion } from '../types';
import { universInstantiationService, InstantiationResult } from './universInstantiationService';
import { unifiedNotificationService } from './unifiedNotificationService';

class UniversService {
  private readonly collectionName = 'univers';
  private readonly instancesCollectionName = 'universInstances';
  private readonly versionsCollectionName = 'universVersions';

  /**
   * Convertir les données Firestore en Univers
   */
  private convertFirestoreToUnivers(id: string, data: any): Univers {
    return {
      id,
      metadata: {
        ...data.metadata,
        createdAt: data.metadata?.createdAt?.toDate() || new Date()
      },
      ownership: {
        ...data.ownership,
        approvedAt: data.ownership?.approvedAt?.toDate() || undefined
      },
      definitions: data.definitions || {
        forms: [],
        dashboards: [],
        instructions: [],
        lists: [],
        reports: []
      },
      usage: {
        ...data.usage,
        lastUsedAt: data.usage?.lastUsedAt?.toDate() || undefined
      }
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

      // Validation: au moins un formulaire est requis
      const forms = univers.definitions?.forms || [];
      if (forms.length === 0) {
        throw new Error('Au moins un formulaire est requis pour créer un Univers');
      }

      // Préparer les définitions avec des tableaux vides pour Lists/Reports si non fournis
      const definitions: UniversDefinitions = {
        forms: forms,
        dashboards: univers.definitions?.dashboards || [],
        instructions: univers.definitions?.instructions || [],
        lists: univers.definitions?.lists || [], // Peut être vide (Coming Soon)
        reports: univers.definitions?.reports || [] // Peut être vide (Coming Soon)
      };

      // Préparer les métadonnées avec valeurs par défaut
      const metadata: UniversMetadata = {
        name: univers.metadata.name.trim(),
        description: univers.metadata.description?.trim() || '',
        iconUrl: univers.metadata.iconUrl || undefined,
        category: univers.metadata.category || undefined,
        tags: univers.metadata.tags || [],
        version: univers.metadata.version || 1,
        createdAt: univers.metadata.createdAt || new Date()
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
        rejectionReason: univers.ownership.rejectionReason || undefined
      };

      // Préparer l'usage avec valeurs par défaut
      const usage: UniversUsage = {
        totalUsages: univers.usage?.totalUsages || 0,
        lastUsedAt: univers.usage?.lastUsedAt || undefined
      };

      // Helper function to remove undefined values
      const removeUndefined = (obj: any): any => {
        if (obj === null || obj === undefined) return null;
        if (Array.isArray(obj)) return obj.map(removeUndefined);
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

      const docRef = doc(db, this.collectionName, id);
      
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

      const currentVersion = currentUnivers.metadata.version || 1;
      const wasMarketplace = currentUnivers.ownership.isMarketplaceTemplate;

      // 2. Initialiser updateData avec les updates (sans nettoyer undefined maintenant)
      // On nettoiera undefined après avoir défini les valeurs ownership
      const updateData: any = { ...updates };
      
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
      const isBecomingMarketplace = !wasMarketplace && isNowMarketplace;
      const isStayingMarketplace = wasMarketplace && isNowMarketplace;
      
      console.log('🔍 universService.update - Marketplace detection:', {
        wasMarketplace,
        isNowMarketplace,
        isBecomingMarketplace,
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
      if (isBecomingMarketplace) {
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
  async getById(id: string): Promise<Univers | null> {
    try {
      const docRef = doc(db, this.collectionName, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return this.convertFirestoreToUnivers(docSnap.id, docSnap.data());
      }
      return null;
    } catch (error) {
      console.error('Erreur lors de la récupération du Univers:', error);
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
      return querySnapshot.docs.map(doc => 
        this.convertFirestoreToUnivers(doc.id, doc.data())
      );
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
      if (purchasedUniversIds.size > 0) {
        const purchasedUniversPromises = Array.from(purchasedUniversIds).map(async (universId) => {
          try {
            const univers = await this.getById(universId);
            if (univers) {
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
      const docRef = await addDoc(collection(db, this.instancesCollectionName), {
        ...instance,
        createdAt: serverTimestamp()
      });
      
      // Mettre à jour le compteur d'utilisation du Univers
      await this.incrementUsage(instance.universId);
      
      return docRef.id;
    } catch (error) {
      console.error('Erreur lors de la création de l\'instance Univers:', error);
      throw error;
    }
  }

  /**
   * Incrémenter le compteur d'utilisation d'un Univers
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
    } catch (error) {
      console.error('Erreur lors de l\'incrémentation de l\'utilisation:', error);
      // Ne pas faire échouer l'opération si cette mise à jour échoue
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
    agencyId: string
  ): Promise<{ instanceId: string; result: InstantiationResult }> {
    try {
      // 1. Fetch the Univers template
      const univers = await this.getById(universId);
      if (!univers) {
        throw new Error(`Univers template not found: ${universId}`);
      }

      // Validate that the Univers has definitions
      if (!univers.definitions) {
        throw new Error('Univers template has no definitions');
      }

      // 2. Generate a unique instance ID
      const universInstanceId = `instance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // 3. Call the instantiation service to create concrete resources
      const instantiationResult = await universInstantiationService.instantiate({
        definitions: univers.definitions,
        userId,
        userRole,
        agencyId,
        universId,
        universInstanceId
      });

      // 4. Create the UniversInstance document with all instantiated resource IDs
      const instanceData: Omit<UniversInstance, 'id'> = {
        universId,
        universVersion: univers.metadata.version || 1,
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
          universVersion: univers.metadata.version || 1,
          isFromMarketplace: univers.ownership.isMarketplaceTemplate || false,
          paymentId: undefined, // Will be set if purchased
          purchaseDate: undefined // Will be set if purchased
        },
        versionHistory: undefined,
        latestAvailableVersion: undefined,
        updateAvailable: false
      };

      const instanceId = await this.createInstance(instanceData);
      // Note: createInstance already increments usage counter via incrementUsage()

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
      const { instanceId } = await this.instantiate(
        universId,
        directorId,
        'directeur',
        agencyId
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
      const isFirstVersion = univers.ownership.approvalStatus === 'pending' && version === (univers.metadata.version || 1);
      
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

      // Mettre à jour le document Univers
      const universRef = doc(db, this.collectionName, universId);
      await updateDoc(universRef, {
        'ownership.approvalStatus': 'approved',
        'ownership.approvedBy': adminId,
        'ownership.approvedAt': serverTimestamp(),
        'ownership.rejectionReason': deleteField()
      });

      // Vérifier que la mise à jour a bien été appliquée
      const updatedUnivers = await this.getById(universId);
      if (updatedUnivers && updatedUnivers.ownership.approvalStatus !== 'approved') {
        console.warn(`⚠️ Univers ${universId} approvalStatus not updated correctly, retrying...`);
        // Retry une fois
        await updateDoc(universRef, {
          'ownership.approvalStatus': 'approved',
          'ownership.approvedBy': adminId,
          'ownership.approvedAt': serverTimestamp()
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

      // 2. Vérifier qu'une mise à jour est disponible
      if (!oldInstance.updateAvailable || !oldInstance.latestAvailableVersion) {
        throw new Error('No update available for this instance');
      }

      const newVersion = oldInstance.latestAvailableVersion;
      const currentVersion = oldInstance.universVersion || oldInstance.metadata?.universVersion || 1;

      if (newVersion <= currentVersion) {
        throw new Error(`New version ${newVersion} is not greater than current version ${currentVersion}`);
      }

      // 3. Récupérer le template Univers avec la nouvelle version
      const univers = await this.getById(oldInstance.universId);
      if (!univers) {
        throw new Error(`Univers template not found: ${oldInstance.universId}`);
      }

      // Vérifier que le Univers a la bonne version
      if (univers.metadata.version !== newVersion) {
        throw new Error(`Univers template version ${univers.metadata.version} does not match expected version ${newVersion}`);
      }

      // 4. Créer une nouvelle instance avec la nouvelle version
      const { instanceId: newInstanceId, result: instantiationResult } = await this.instantiate(
        oldInstance.universId,
        userId,
        userRole,
        agencyId
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
      const versionHistoryEntry = {
        previousVersion: currentVersion,
        upgradedAt: new Date(),
        upgradedFromInstanceId: undefined as string | undefined,
        dataMigrated: true
      };

      const oldVersionHistory = oldInstance.versionHistory || [];
      batch.update(oldInstanceRef, {
        versionHistory: [...oldVersionHistory, versionHistoryEntry]
      });

      // Activer la nouvelle instance si l'ancienne était active
      const newInstanceRef = doc(db, this.instancesCollectionName, newInstanceId);
      batch.update(newInstanceRef, {
        isActive: wasActive,
        updateAvailable: false,
        latestAvailableVersion: undefined,
        updatedAt: serverTimestamp()
      });

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
   * Si aucun Univers actif n'existe, active le Univers par défaut
   */
  async ensureDefaultUnivers(directorId: string, agencyId: string): Promise<string> {
    try {
      // 1. Vérifier si un Univers par défaut existe déjà
      let defaultUnivers = await this.getDefaultUnivers(directorId);

      if (!defaultUnivers) {
        // 2. Créer le Univers par défaut
        const defaultId = await this.create({
          metadata: {
            name: 'Univers par défaut', // Nom fixe, non modifiable
            description: 'Univers par défaut créé automatiquement',
            isDefault: true,
            isActive: true, // Actif par défaut
            version: 1,
            createdAt: new Date()
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
      
      if (!activeUnivers) {
        // 4. Activer le Univers par défaut si aucun n'est actif
        await this.activateUnivers(defaultUnivers.id, directorId, agencyId);
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
   * Instancier les ressources d'un Univers sans créer d'instance UniversInstance
   * (pour les Univers créés directement, pas achetés)
   */
  private async instantiateResourcesOnly(
    univers: Univers,
    directorId: string,
    agencyId: string
  ): Promise<void> {
    try {
      if (!univers.definitions) {
        throw new Error('Univers sans définitions');
      }

      // Générer un ID d'instance temporaire pour l'instanciation
      const tempInstanceId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Appeler le service d'instanciation pour créer les ressources réelles
      await universInstantiationService.instantiate({
        definitions: univers.definitions,
        userId: directorId,
        userRole: 'directeur',
        agencyId,
        universId: univers.id,
        universInstanceId: tempInstanceId
      });

      console.log(`✅ Ressources instanciées pour Univers ${univers.id} (sans créer d'instance)`);
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
    agencyId: string
  ): Promise<void> {
    try {
      // 1. Vérifier que le Univers appartient au directeur ou est acheté
      const univers = await this.getById(universId);
      if (!univers) {
        throw new Error('Univers non trouvé');
      }

      // 2. Validation: au moins un formulaire est requis pour activation
      const forms = univers.definitions?.forms || [];
      if (forms.length === 0) {
        throw new Error('Au moins un formulaire est requis pour activer un Univers. Veuillez ajouter au moins un formulaire avant d\'activer.');
      }

      const isOwner = univers.ownership.createdBy === directorId;
      
      // 3. Vérifier si c'est une instance achetée
      let instanceId: string | undefined;
      if (univers.ownership.isMarketplaceTemplate && !isOwner) {
        // Chercher une instance de ce Univers pour ce directeur
        const instances = await this.getInstancesByUser(directorId, agencyId);
        const instance = instances.find(inst => inst.universId === universId);
        if (instance) {
          instanceId = instance.id;
          // Pour les Univers achetés, les ressources sont déjà instanciées lors de l'achat
          console.log(`✅ Instance trouvée pour Univers acheté: ${instanceId}`);
        } else {
          throw new Error('Vous devez d\'abord acheter ce Univers depuis le marketplace');
        }
      } else if (!isOwner) {
        throw new Error('Vous ne pouvez pas activer ce Univers');
      } else {
        // 4. Pour les Univers créés directement (propriétaire), vérifier si les ressources existent
        // Si non, les instancier automatiquement
        const resourcesExist = await this.checkIfResourcesExist(universId, agencyId);
        if (!resourcesExist) {
          console.log(`📦 Ressources non trouvées pour Univers ${universId}, instanciation automatique...`);
          await this.instantiateResourcesOnly(univers, directorId, agencyId);
          console.log(`✅ Ressources instanciées avec succès pour Univers ${universId}`);
        } else {
          console.log(`✅ Ressources déjà existantes pour Univers ${universId}`);
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

      // 6. Activer le nouveau Univers
      if (instanceId) {
        // Activer l'instance (Univers acheté)
        const instanceRef = doc(db, this.instancesCollectionName, instanceId);
        await updateDoc(instanceRef, { isActive: true });
        await this.setActiveUnivers(directorId, agencyId, universId, instanceId);
      } else {
        // Activer le template Univers (Univers créé directement)
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


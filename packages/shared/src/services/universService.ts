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
  writeBatch
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
   */
  private removeUndefinedValues(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
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
    try {
      const docRef = doc(db, this.collectionName, id);
      
      // 1. Récupérer le Univers actuel pour obtenir la version actuelle
      const currentUnivers = await this.getById(id);
      if (!currentUnivers) {
        throw new Error(`Univers not found: ${id}`);
      }

      const currentVersion = currentUnivers.metadata.version || 1;
      const newVersion = currentVersion + 1;
      const isMarketplace = currentUnivers.ownership.isMarketplaceTemplate;

      // 2. Recursively remove undefined values to prevent Firestore errors
      const cleanedUpdates = this.removeUndefinedValues(updates);
      
      const updateData: any = { ...cleanedUpdates };
      
      // 3. Incrémenter automatiquement metadata.version
      if (!updateData.metadata) {
        updateData.metadata = {};
      }
      updateData.metadata.version = newVersion;

      // 4. Si Univers marketplace : mettre approvalStatus = pending
      if (isMarketplace && !updateData.ownership) {
        updateData.ownership = {};
      }
      if (isMarketplace && updateData.ownership) {
        // Ne pas écraser l'approvalStatus si c'est déjà 'approved' et qu'on ne modifie pas explicitement
        // Mais si on modifie le Univers, on doit mettre à 'pending' pour réapprobation
        if (currentUnivers.ownership.approvalStatus === 'approved') {
          updateData.ownership.approvalStatus = 'pending';
          // Réinitialiser les champs d'approbation
          updateData.ownership.approvedBy = undefined;
          updateData.ownership.approvedAt = undefined;
          updateData.ownership.rejectionReason = undefined;
        }
      }
      
      // Convertir les dates en Timestamps Firestore
      if (updateData.metadata?.createdAt) {
        updateData.metadata.createdAt = Timestamp.fromDate(updateData.metadata.createdAt);
      }
      if (updateData.ownership?.approvedAt) {
        updateData.ownership.approvedAt = Timestamp.fromDate(updateData.ownership.approvedAt);
      }
      if (updateData.usage?.lastUsedAt) {
        updateData.usage.lastUsedAt = Timestamp.fromDate(updateData.usage.lastUsedAt);
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
      
      // 5. Créer un document UniversVersion pour tracking
      const versionData: Omit<UniversVersion, 'id'> = {
        universId: id,
        version: newVersion,
        previousVersion: currentVersion,
        createdBy: updatedBy || currentUnivers.ownership.createdBy,
        createdAt: new Date(),
        approvalStatus: isMarketplace ? 'pending' : 'approved', // Marketplace requires approval
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

      // Créer le document UniversVersion en parallèle avec la mise à jour
      const versionDocRef = doc(collection(db, this.versionsCollectionName));
      await Promise.all([
        updateDoc(docRef, updateData),
        setDoc(versionDocRef, {
          ...versionData,
          createdAt: serverTimestamp()
        })
      ]);

      console.log(`✅ Univers updated: ${id} (v${currentVersion} → v${newVersion})`);
      if (isMarketplace) {
        console.log(`   Approval status set to: pending (requires admin approval)`);
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour du Univers:', error);
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
      allSnapshot.docs.forEach(doc => {
        const universData = doc.data();
        const universAgencyId = universData.ownership?.agencyId;
        
        // Univers privé (agencyId n'existe pas, est null, ou undefined)
        const isPrivate = !universAgencyId || universAgencyId === null;
        
        // Univers partagé avec l'agence
        const isAgencyShared = agencyId && universAgencyId === agencyId;
        
        if (isPrivate || isAgencyShared) {
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
      // 1. Récupérer tous les Univers marketplace avec approvalStatus = pending
      const q = query(
        collection(db, this.collectionName),
        where('ownership.isMarketplaceTemplate', '==', true),
        where('ownership.approvalStatus', '==', 'pending')
      );
      
      const universSnapshot = await getDocs(q);
      const results: { univers: Univers; pendingVersion: UniversVersion }[] = [];

      // 2. Pour chaque Univers, récupérer la version en attente
      for (const universDoc of universSnapshot.docs) {
        const univers = this.convertFirestoreToUnivers(universDoc.id, universDoc.data());
        
        // Récupérer la dernière version en attente
        const versions = await this.getVersionsByUnivers(univers.id);
        const pendingVersion = versions.find(v => v.approvalStatus === 'pending');
        
        if (pendingVersion) {
          results.push({ univers, pendingVersion });
        }
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
      // 1. Mettre à jour le document UniversVersion
      const versions = await this.getVersionsByUnivers(universId);
      const versionDoc = versions.find(v => v.version === version);
      
      if (!versionDoc) {
        throw new Error(`Version ${version} not found for Univers ${universId}`);
      }

      // Trouver le document UniversVersion dans Firestore
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

      // 2. Mettre à jour le document Univers
      const universRef = doc(db, this.collectionName, universId);
      await updateDoc(universRef, {
        'ownership.approvalStatus': 'approved',
        'ownership.approvedBy': adminId,
        'ownership.approvedAt': serverTimestamp(),
        'ownership.rejectionReason': undefined
      });

      // 3. Notifier toutes les instances qu'une nouvelle version est disponible
      try {
        await this.notifyNewVersionAvailable(universId, version);
      } catch (notifyError) {
        console.error(`⚠️ Error notifying instances about new version (non-blocking):`, notifyError);
        // Ne pas faire échouer l'approbation si les notifications échouent
      }

      console.log(`✅ Univers version approved: ${universId} v${version} by admin ${adminId}`);
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
      // 1. Mettre à jour le document UniversVersion
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

      // 2. Mettre à jour le document Univers - revenir à la version précédente approuvée
      const univers = await this.getById(universId);
      if (!univers) {
        throw new Error(`Univers not found: ${universId}`);
      }

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
          const userName = userData.name || 'Utilisateur';
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
      const activeUniversData: Omit<ActiveUnivers, 'directorId'> = {
        agencyId,
        activeUniversId: universId,
        activeInstanceId: instanceId,
        updatedAt: new Date()
      };

      await updateDoc(docRef, {
        ...activeUniversData,
        updatedAt: serverTimestamp()
      });
    } catch (error: any) {
      // Si le document n'existe pas, le créer avec setDoc et merge: true
      if (error.code === 'not-found' || error.code === 'permission-denied' || error.code === 'failed-precondition') {
        const docRef = doc(db, this.activeUniversCollectionName, directorId);
        await setDoc(docRef, {
          directorId,
          agencyId,
          activeUniversId: universId,
          activeInstanceId: instanceId || null,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } else {
        console.error('Erreur lors de la mise à jour de l\'Univers actif:', error);
        throw error;
      }
    }
  }

  /**
   * Activer un Univers (désactive automatiquement l'ancien si nécessaire)
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
      
      // 2. Vérifier si c'est une instance achetée
      let instanceId: string | undefined;
      if (univers.ownership.isMarketplaceTemplate && !isOwner) {
        // Chercher une instance de ce Univers pour ce directeur
        const instances = await this.getInstancesByUser(directorId, agencyId);
        const instance = instances.find(inst => inst.universId === universId && inst.isActive);
        if (instance) {
          instanceId = instance.id;
        } else {
          throw new Error('Vous devez d\'abord acheter ce Univers depuis le marketplace');
        }
      } else if (!isOwner) {
        throw new Error('Vous ne pouvez pas activer ce Univers');
      }

      // 3. Désactiver l'ancien Univers actif
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

      // 4. Activer le nouveau Univers
      if (instanceId) {
        // Activer l'instance
        const instanceRef = doc(db, this.instancesCollectionName, instanceId);
        await updateDoc(instanceRef, { isActive: true });
        await this.setActiveUnivers(directorId, agencyId, universId, instanceId);
      } else {
        // Activer le template Univers
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


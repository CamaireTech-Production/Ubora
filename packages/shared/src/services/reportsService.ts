import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Report, ReportPlaceholder, ReportMapping } from '../types';

class ReportsService {
  private readonly collectionName = 'reports';

  /**
   * Convertir les données Firestore en Report
   */
  private convertFirestoreToReport(id: string, data: any): Report {
    return {
      id,
      name: data.name,
      description: data.description || undefined,
      templateType: data.templateType,
      templateContent: data.templateContent || undefined,
      templateFileUrl: data.templateFileUrl || undefined,
      templateFileStoragePath: data.templateFileStoragePath || undefined,
      templateFileName: data.templateFileName || undefined,
      placeholders: data.placeholders || [],
      mappings: data.mappings || [],
      createdBy: data.createdBy,
      createdByRole: data.createdByRole || 'directeur',
      createdByEmployeeId: data.createdByEmployeeId || undefined,
      agencyId: data.agencyId,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      universId: data.universId || undefined,
      universInstanceId: data.universInstanceId || undefined,
      fromUnivers: data.fromUnivers || false
    } as Report;
  }

  /**
   * Créer un nouveau Report
   * 
   * @param report - Les données du Report à créer (sans l'ID qui sera généré)
   * @returns L'ID du Report créé
   * @throws Error si la validation échoue ou si la création échoue
   */
  async create(report: Omit<Report, 'id'>): Promise<string> {
    try {
      // Validation des prérequis
      if (!report.name || !report.name.trim()) {
        throw new Error('Le nom du rapport est requis');
      }

      if (!report.createdBy) {
        throw new Error('Le créateur du rapport est requis');
      }

      if (!report.agencyId) {
        throw new Error('L\'agence du rapport est requise');
      }

      if (!report.templateType) {
        throw new Error('Le type de template est requis');
      }

      // Validation: au moins un placeholder est généralement attendu (mais optionnel)
      if (report.placeholders && report.placeholders.length > 0) {
        // Vérifier que chaque placeholder a un id
        for (const placeholder of report.placeholders) {
          if (!placeholder.id) {
            throw new Error('Chaque placeholder doit avoir un ID');
          }
        }
      }

      // Validation: si des mappings existent, ils doivent correspondre aux placeholders
      if (report.mappings && report.mappings.length > 0) {
        const placeholderIds = new Set(report.placeholders?.map(p => p.id) || []);
        for (const mapping of report.mappings) {
          if (!placeholderIds.has(mapping.placeholderId)) {
            throw new Error(`Le mapping référence un placeholder inexistant: ${mapping.placeholderId}`);
          }
          if (!mapping.sourceId) {
            throw new Error('Le mapping doit avoir un sourceId');
          }
        }
      }

      // Récupérer l'Univers actif pour associer automatiquement si universId n'est pas fourni
      let universIdToAssociate: string | null = report.universId || null;
      if (!universIdToAssociate && report.agencyId) {
        try {
          // Trouver le directeur de l'agence
          const directorsSnapshot = await getDocs(
            query(
              collection(db, 'users'),
              where('agencyId', '==', report.agencyId),
              where('role', '==', 'directeur')
            )
          );
          if (!directorsSnapshot.empty) {
            const directorId = directorsSnapshot.docs[0].id;
            // Récupérer l'Univers actif du directeur
            const { universService } = await import('./universService');
            const activeUnivers = await universService.getActiveUnivers(directorId, report.agencyId);
            if (activeUnivers) {
              universIdToAssociate = activeUnivers.activeUniversId;
            }
          }
        } catch (error) {
          console.error('Erreur lors de la récupération de l\'Univers actif pour le Report:', error);
          // Continue sans associer au Univers si erreur
        }
      }

      // Préparer les données avec valeurs par défaut
      const now = new Date();
      const reportData = {
        name: report.name.trim(),
        description: report.description?.trim() || undefined,
        templateType: report.templateType,
        templateContent: report.templateContent || undefined,
        templateFileUrl: report.templateFileUrl || undefined,
        templateFileStoragePath: report.templateFileStoragePath || undefined,
        templateFileName: report.templateFileName || undefined,
        placeholders: report.placeholders || [],
        mappings: report.mappings || [],
        createdBy: report.createdBy,
        createdByRole: report.createdByRole || 'directeur',
        createdByEmployeeId: report.createdByEmployeeId || undefined,
        agencyId: report.agencyId,
        createdAt: Timestamp.fromDate(report.createdAt || now),
        updatedAt: Timestamp.fromDate(report.updatedAt || now),
        universId: universIdToAssociate,
        universInstanceId: report.universInstanceId || null,
        fromUnivers: report.fromUnivers || false
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

      // Créer le document dans Firestore
      const docRef = await addDoc(collection(db, this.collectionName), removeUndefined(reportData));

      console.log(`Report créé avec succès: ${docRef.id}`);
      return docRef.id;
    } catch (error) {
      console.error('Erreur lors de la création du Report:', error);
      
      // Re-throw avec un message plus explicite si c'est notre erreur
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Erreur lors de la création du Report. Veuillez réessayer.');
    }
  }

  /**
   * Mettre à jour un Report
   */
  async update(id: string, updates: Partial<Report>): Promise<void> {
    try {
      const docRef = doc(db, this.collectionName, id);
      
      // Filter out undefined values to prevent Firestore errors
      const filteredUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, value]) => value !== undefined)
      );
      
      const updateData: any = { ...filteredUpdates };
      
      // Toujours mettre à jour updatedAt
      updateData.updatedAt = Timestamp.fromDate(new Date());
      
      // Convertir les dates en Timestamps Firestore
      if (updateData.createdAt) {
        updateData.createdAt = Timestamp.fromDate(updateData.createdAt);
      }
      if (updateData.updatedAt && !(updateData.updatedAt instanceof Timestamp)) {
        updateData.updatedAt = Timestamp.fromDate(updateData.updatedAt);
      }
      
      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Erreur lors de la mise à jour du Report:', error);
      throw error;
    }
  }

  /**
   * Supprimer un Report
   */
  async delete(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, this.collectionName, id));
      console.log(`Report supprimé avec succès: ${id}`);
    } catch (error) {
      console.error('Erreur lors de la suppression du Report:', error);
      throw error;
    }
  }

  /**
   * Récupérer un Report par ID
   */
  async getById(id: string): Promise<Report | null> {
    try {
      const docRef = doc(db, this.collectionName, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return this.convertFirestoreToReport(docSnap.id, docSnap.data());
      }
      return null;
    } catch (error) {
      console.error('Erreur lors de la récupération du Report:', error);
      throw error;
    }
  }

  /**
   * Récupérer tous les Reports d'une agence
   * Filtrer par Univers actif si activeUniversId est fourni
   */
  async getByAgency(agencyId: string, activeUniversId?: string | null): Promise<Report[]> {
    try {
      let q;
      if (activeUniversId) {
        // Filtrer par Univers actif
        q = query(
          collection(db, this.collectionName),
          where('agencyId', '==', agencyId),
          where('universId', '==', activeUniversId),
          orderBy('updatedAt', 'desc')
        );
      } else {
        // Rétrocompatibilité temporaire : si pas de Univers actif, charger tous les Reports
        q = query(
          collection(db, this.collectionName),
          where('agencyId', '==', agencyId),
          orderBy('updatedAt', 'desc')
        );
      }
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => 
        this.convertFirestoreToReport(doc.id, doc.data())
      );
    } catch (error) {
      console.error('Erreur lors de la récupération des Reports de l\'agence:', error);
      throw error;
    }
  }

  /**
   * Récupérer tous les Reports créés par un utilisateur
   * Inclut tous les Reports de l'agence si l'utilisateur est directeur
   * Filtrer par Univers actif si activeUniversId est fourni
   */
  async getByUser(userId: string, agencyId: string, userRole?: 'directeur' | 'employe' | 'admin', activeUniversId?: string | null): Promise<Report[]> {
    try {
      // Si c'est un directeur, retourner tous les Reports de l'agence (filtrés par Univers actif)
      if (userRole === 'directeur' || userRole === 'admin') {
        return await this.getByAgency(agencyId, activeUniversId);
      }

      // Sinon, retourner seulement les Reports créés par l'utilisateur (filtrés par Univers actif)
      let q;
      if (activeUniversId) {
        q = query(
          collection(db, this.collectionName),
          where('createdBy', '==', userId),
          where('agencyId', '==', agencyId),
          where('universId', '==', activeUniversId),
          orderBy('updatedAt', 'desc')
        );
      } else {
        q = query(
          collection(db, this.collectionName),
          where('createdBy', '==', userId),
          where('agencyId', '==', agencyId),
          orderBy('updatedAt', 'desc')
        );
      }
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => 
        this.convertFirestoreToReport(doc.id, doc.data())
      );
    } catch (error) {
      console.error('Erreur lors de la récupération des Reports de l\'utilisateur:', error);
      throw error;
    }
  }
}

export const reportsService = new ReportsService();


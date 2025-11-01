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

class ReportService {
  private readonly collectionName = 'reports';

  /**
   * Convertir les données Firestore en Report
   */
  private convertFirestoreToReport(id: string, data: any): Report {
    return {
      id,
      name: data.name,
      description: data.description || '',
      templateType: data.templateType,
      templateContent: data.templateContent || undefined,
      templateFileUrl: data.templateFileUrl || undefined,
      templateFileStoragePath: data.templateFileStoragePath || undefined,
      templateFileName: data.templateFileName || undefined,
      placeholders: data.placeholders || [],
      mappings: data.mappings || [],
      createdAt: data.createdAt?.toDate() || new Date(),
      createdBy: data.createdBy,
      createdByRole: data.createdByRole || 'directeur',
      createdByEmployeeId: data.createdByEmployeeId || undefined,
      agencyId: data.agencyId,
      universId: data.universId || null,
      universInstanceId: data.universInstanceId || null,
      fromUnivers: data.fromUnivers || false,
      updatedAt: data.updatedAt?.toDate() || undefined
    } as Report;
  }

  /**
   * Extraire les placeholders d'un texte (format {{placeholder}})
   * @param text - Le texte à analyser
   * @returns Tableau de placeholders uniques trouvés
   */
  extractPlaceholders(text: string): string[] {
    if (!text || typeof text !== 'string') {
      return [];
    }

    // Pattern pour détecter {{placeholder}}
    const placeholderPattern = /\{\{([^}]+)\}\}/g;
    const placeholders = new Set<string>();
    let match;

    while ((match = placeholderPattern.exec(text)) !== null) {
      const placeholder = match[1].trim();
      if (placeholder) {
        placeholders.add(placeholder);
      }
    }

    return Array.from(placeholders);
  }

  /**
   * Créer des objets ReportPlaceholder à partir d'une liste de placeholder strings
   * @param placeholderStrings - Liste de strings de placeholders
   * @returns Tableau de ReportPlaceholder
   */
  createPlaceholderObjects(placeholderStrings: string[]): ReportPlaceholder[] {
    return placeholderStrings.map((placeholder, index) => ({
      id: `placeholder_${Date.now()}_${index}`,
      placeholder: `{{${placeholder}}}`,
      position: index,
      type: 'form_field' as const, // Default, will be updated during mapping
      description: `Placeholder: ${placeholder}`
    }));
  }

  /**
   * Extraire les placeholders et créer les objets ReportPlaceholder
   * @param templateContent - Le contenu du template (texte)
   * @returns Tableau de ReportPlaceholder
   */
  extractPlaceholdersFromTemplate(templateContent: string): ReportPlaceholder[] {
    const placeholderStrings = this.extractPlaceholders(templateContent);
    return this.createPlaceholderObjects(placeholderStrings);
  }

  /**
   * Mapper un placeholder à une source de données
   * @param placeholderId - ID du placeholder
   * @param sourceType - Type de source ('form' ou 'dashboard')
   * @param sourceId - ID du formulaire ou dashboard
   * @param fieldId - ID du champ ou métrique (optionnel)
   * @param calculationType - Type de calcul pour les champs numériques (optionnel)
   * @param defaultValue - Valeur par défaut (optionnel)
   * @returns ReportMapping
   */
  createMapping(
    placeholderId: string,
    sourceType: 'form' | 'dashboard',
    sourceId: string,
    fieldId?: string,
    calculationType?: 'sum' | 'average' | 'count' | 'min' | 'max' | 'custom',
    defaultValue?: string
  ): ReportMapping {
    return {
      placeholderId,
      sourceType,
      sourceId,
      fieldId,
      calculationType,
      defaultValue
    };
  }

  /**
   * Créer un nouveau rapport
   * @param report - Les données du rapport à créer (sans l'ID qui sera généré)
   * @returns L'ID du rapport créé
   * @throws Error si la validation échoue ou si la création échoue
   */
  async create(report: Omit<Report, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
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

      // Si templateType est 'text', templateContent est requis
      if (report.templateType === 'text' && !report.templateContent) {
        throw new Error('Le contenu du template est requis pour les templates texte');
      }

      // Si templateType est 'pdf' ou 'word', templateFileUrl est requis
      if ((report.templateType === 'pdf' || report.templateType === 'word') && !report.templateFileUrl) {
        throw new Error('Le fichier template est requis pour les templates PDF/Word');
      }

      // Si templateContent existe mais placeholders n'existent pas, les extraire automatiquement
      let placeholders = report.placeholders || [];
      if (report.templateContent && placeholders.length === 0) {
        placeholders = this.extractPlaceholdersFromTemplate(report.templateContent);
      }

      // Préparer les données du rapport
      const reportData = {
        name: report.name.trim(),
        description: report.description?.trim() || '',
        templateType: report.templateType,
        templateContent: report.templateContent || null,
        templateFileUrl: report.templateFileUrl || null,
        templateFileStoragePath: report.templateFileStoragePath || null,
        templateFileName: report.templateFileName || null,
        placeholders: placeholders,
        mappings: report.mappings || [],
        createdBy: report.createdBy,
        createdByRole: report.createdByRole || 'directeur',
        createdByEmployeeId: report.createdByEmployeeId || null,
        agencyId: report.agencyId,
        universId: report.universId || null,
        universInstanceId: report.universInstanceId || null,
        fromUnivers: report.fromUnivers || false,
        createdAt: Timestamp.now(),
        updatedAt: null
      };

      // Créer le document dans Firestore
      const docRef = await addDoc(collection(db, this.collectionName), reportData);

      console.log(`Rapport créé avec succès: ${docRef.id}`);
      return docRef.id;
    } catch (error) {
      console.error('Erreur lors de la création du rapport:', error);
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Erreur lors de la création du rapport. Veuillez réessayer.');
    }
  }

  /**
   * Récupérer un rapport par son ID
   * @param id - ID du rapport
   * @returns Le rapport ou null si non trouvé
   */
  async getById(id: string): Promise<Report | null> {
    try {
      const docRef = doc(db, this.collectionName, id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      return this.convertFirestoreToReport(docSnap.id, docSnap.data());
    } catch (error) {
      console.error('Erreur lors de la récupération du rapport:', error);
      throw error;
    }
  }

  /**
   * Récupérer tous les rapports d'une agence
   * @param agencyId - ID de l'agence
   * @returns Liste des rapports
   */
  async getByAgency(agencyId: string): Promise<Report[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('agencyId', '==', agencyId),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => 
        this.convertFirestoreToReport(doc.id, doc.data())
      );
    } catch (error) {
      console.error('Erreur lors de la récupération des rapports de l\'agence:', error);
      throw error;
    }
  }

  /**
   * Récupérer tous les rapports créés par un utilisateur
   * @param userId - ID de l'utilisateur
   * @param agencyId - ID de l'agence (optionnel, pour filtrer par agence)
   * @returns Liste des rapports
   */
  async getByUser(userId: string, agencyId?: string): Promise<Report[]> {
    try {
      let q;
      
      if (agencyId) {
        q = query(
          collection(db, this.collectionName),
          where('createdBy', '==', userId),
          where('agencyId', '==', agencyId),
          orderBy('createdAt', 'desc')
        );
      } else {
        q = query(
          collection(db, this.collectionName),
          where('createdBy', '==', userId),
          orderBy('createdAt', 'desc')
        );
      }
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => 
        this.convertFirestoreToReport(doc.id, doc.data())
      );
    } catch (error) {
      console.error('Erreur lors de la récupération des rapports de l\'utilisateur:', error);
      throw error;
    }
  }

  /**
   * Récupérer tous les rapports d'un Univers template
   * @param universId - ID du Univers template
   * @returns Liste des rapports
   */
  async getByUnivers(universId: string): Promise<Report[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('universId', '==', universId),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => 
        this.convertFirestoreToReport(doc.id, doc.data())
      );
    } catch (error) {
      console.error('Erreur lors de la récupération des rapports du Univers:', error);
      throw error;
    }
  }

  /**
   * Récupérer tous les rapports d'une instance Univers
   * @param universInstanceId - ID de l'instance Univers
   * @returns Liste des rapports
   */
  async getByUniversInstance(universInstanceId: string): Promise<Report[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('universInstanceId', '==', universInstanceId),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => 
        this.convertFirestoreToReport(doc.id, doc.data())
      );
    } catch (error) {
      console.error('Erreur lors de la récupération des rapports de l\'instance Univers:', error);
      throw error;
    }
  }

  /**
   * Mettre à jour un rapport
   * @param id - ID du rapport
   * @param updates - Les mises à jour à appliquer
   */
  async update(id: string, updates: Partial<Omit<Report, 'id' | 'createdAt' | 'createdBy' | 'agencyId'>>): Promise<void> {
    try {
      const docRef = doc(db, this.collectionName, id);
      
      // Extraire automatiquement les placeholders si templateContent est mis à jour
      let placeholders = updates.placeholders;
      if (updates.templateContent && (!placeholders || placeholders.length === 0)) {
        placeholders = this.extractPlaceholdersFromTemplate(updates.templateContent);
      }

      const updateData: any = {
        ...updates,
        updatedAt: Timestamp.now()
      };

      // Ajouter les placeholders extraits si nécessaire
      if (placeholders) {
        updateData.placeholders = placeholders;
      }

      // Supprimer les valeurs null/undefined pour éviter les erreurs Firestore
      const cleanUpdateData = Object.fromEntries(
        Object.entries(updateData).filter(([_, value]) => value !== undefined && value !== null)
      );

      await updateDoc(docRef, cleanUpdateData);
      console.log(`Rapport mis à jour avec succès: ${id}`);
    } catch (error) {
      console.error('Erreur lors de la mise à jour du rapport:', error);
      throw error;
    }
  }

  /**
   * Supprimer un rapport
   * @param id - ID du rapport
   */
  async delete(id: string): Promise<void> {
    try {
      const docRef = doc(db, this.collectionName, id);
      await deleteDoc(docRef);
      console.log(`Rapport supprimé avec succès: ${id}`);
    } catch (error) {
      console.error('Erreur lors de la suppression du rapport:', error);
      throw error;
    }
  }

  /**
   * Mettre à jour les placeholders d'un rapport en analysant le template
   * Utile après modification du template content
   * @param id - ID du rapport
   * @param templateContent - Le nouveau contenu du template (optionnel, utilise celui du rapport si non fourni)
   */
  async refreshPlaceholders(id: string, templateContent?: string): Promise<ReportPlaceholder[]> {
    try {
      let content = templateContent;
      
      // Si templateContent n'est pas fourni, le récupérer du rapport
      if (!content) {
        const report = await this.getById(id);
        if (!report) {
          throw new Error('Rapport non trouvé');
        }
        
        if (report.templateType === 'text') {
          content = report.templateContent || '';
        } else {
          throw new Error('Le refresh des placeholders nécessite le contenu texte du template');
        }
      }

      // Extraire les nouveaux placeholders
      const placeholders = this.extractPlaceholdersFromTemplate(content);

      // Mettre à jour le rapport avec les nouveaux placeholders
      await this.update(id, { placeholders });

      return placeholders;
    } catch (error) {
      console.error('Erreur lors du refresh des placeholders:', error);
      throw error;
    }
  }

  /**
   * Ajouter ou mettre à jour un mapping pour un placeholder
   * @param id - ID du rapport
   * @param mapping - Le mapping à ajouter ou mettre à jour
   */
  async addOrUpdateMapping(id: string, mapping: ReportMapping): Promise<void> {
    try {
      const report = await this.getById(id);
      if (!report) {
        throw new Error('Rapport non trouvé');
      }

      // Trouver si le mapping existe déjà
      const existingMappingIndex = report.mappings.findIndex(
        m => m.placeholderId === mapping.placeholderId
      );

      let newMappings: ReportMapping[];
      
      if (existingMappingIndex >= 0) {
        // Mettre à jour le mapping existant
        newMappings = [...report.mappings];
        newMappings[existingMappingIndex] = mapping;
      } else {
        // Ajouter le nouveau mapping
        newMappings = [...report.mappings, mapping];
      }

      await this.update(id, { mappings: newMappings });
    } catch (error) {
      console.error('Erreur lors de l\'ajout/mise à jour du mapping:', error);
      throw error;
    }
  }

  /**
   * Supprimer un mapping
   * @param id - ID du rapport
   * @param placeholderId - ID du placeholder dont le mapping doit être supprimé
   */
  async removeMapping(id: string, placeholderId: string): Promise<void> {
    try {
      const report = await this.getById(id);
      if (!report) {
        throw new Error('Rapport non trouvé');
      }

      const newMappings = report.mappings.filter(
        m => m.placeholderId !== placeholderId
      );

      await this.update(id, { mappings: newMappings });
    } catch (error) {
      console.error('Erreur lors de la suppression du mapping:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const reportService = new ReportService();

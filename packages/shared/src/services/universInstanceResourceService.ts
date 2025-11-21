import { 
  doc, 
  getDoc, 
  onSnapshot,
  DocumentSnapshot
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Form, Dashboard, List, Report, ScheduledQuestion } from '../types';
import { logger } from '../utils/logger';

/**
 * Service pour récupérer les ressources depuis un document universInstances
 * Utilise les arrays dans instances.forms[], instances.dashboards[], etc. comme source de vérité
 */
class UniversInstanceResourceService {
  private readonly instancesCollectionName = 'universInstances';

  /**
   * Récupérer toutes les ressources d'une instance
   */
  async getResourcesFromInstance(instanceId: string): Promise<{
    forms: Form[];
    dashboards: Dashboard[];
    lists: List[];
    reports: Report[];
    instructions: ScheduledQuestion[];
  }> {
    try {
      // Récupérer le document instance
      const instanceDoc = await getDoc(doc(db, this.instancesCollectionName, instanceId));
      
      if (!instanceDoc.exists()) {
        logger.warn(`Instance ${instanceId} n'existe pas`, undefined, 'UniversInstanceResourceService');
        return {
          forms: [],
          dashboards: [],
          lists: [],
          reports: [],
          instructions: []
        };
      }

      const instanceData = instanceDoc.data();
      const instances = instanceData.instances || {
        forms: [],
        dashboards: [],
        instructions: [],
        lists: [],
        reports: []
      };

      // Récupérer toutes les ressources en parallèle
      const [forms, dashboards, lists, reports, instructions] = await Promise.all([
        this.getFormsFromInstance(instanceId),
        this.getDashboardsFromInstance(instanceId),
        this.getListsFromInstance(instanceId),
        this.getReportsFromInstance(instanceId),
        this.getInstructionsFromInstance(instanceId)
      ]);

      return {
        forms,
        dashboards,
        lists,
        reports,
        instructions
      };
    } catch (error) {
      logger.error('Erreur lors de la récupération des ressources depuis l\'instance', error, 'UniversInstanceResourceService');
      return {
        forms: [],
        dashboards: [],
        lists: [],
        reports: [],
        instructions: []
      };
    }
  }

  /**
   * Récupérer les formulaires depuis une instance
   */
  async getFormsFromInstance(instanceId: string): Promise<Form[]> {
    try {
      const instanceDoc = await getDoc(doc(db, this.instancesCollectionName, instanceId));
      
      if (!instanceDoc.exists()) {
        return [];
      }

      const instanceData = instanceDoc.data();
      const formIds = instanceData.instances?.forms || [];

      if (formIds.length === 0) {
        return [];
      }

      // Récupérer les formulaires en parallèle avec getDoc
      const formPromises = formIds.map(formId => 
        getDoc(doc(db, 'forms', formId)).catch(error => {
          // Si erreur de permissions ou document supprimé, logger et retourner null
          if (error?.code === 'permission-denied' || error?.code === 'not-found') {
            logger.warn(`Formulaire ${formId} non accessible ou supprimé`, undefined, 'UniversInstanceResourceService');
            return null;
          }
          logger.warn(`Erreur lors de la récupération du formulaire ${formId}: ${error.message}`, undefined, 'UniversInstanceResourceService');
          return null;
        })
      );

      const formDocs = await Promise.all(formPromises);
      const forms: Form[] = [];

      formDocs.forEach((formDoc, index) => {
        if (!formDoc || !formDoc.exists()) {
          return;
        }

        const data = formDoc.data();
        // Gérer createdAt
        let createdAt: Date;
        if (data.createdAt) {
          if (data.createdAt.toDate && typeof data.createdAt.toDate === 'function') {
            createdAt = data.createdAt.toDate();
          } else if (data.createdAt instanceof Date) {
            createdAt = data.createdAt;
          } else {
            createdAt = new Date(data.createdAt);
          }
        } else {
          createdAt = new Date();
        }

        forms.push({
          id: formDoc.id,
          ...data,
          createdAt
        } as Form);
      });

      return forms;
    } catch (error) {
      logger.error('Erreur lors de la récupération des formulaires depuis l\'instance', error, 'UniversInstanceResourceService');
      return [];
    }
  }

  /**
   * Récupérer les dashboards depuis une instance
   */
  async getDashboardsFromInstance(instanceId: string): Promise<Dashboard[]> {
    try {
      const instanceDoc = await getDoc(doc(db, this.instancesCollectionName, instanceId));
      
      if (!instanceDoc.exists()) {
        return [];
      }

      const instanceData = instanceDoc.data();
      const dashboardIds = instanceData.instances?.dashboards || [];

      if (dashboardIds.length === 0) {
        return [];
      }

      // Récupérer les dashboards en parallèle avec getDoc
      const dashboardPromises = dashboardIds.map(dashboardId => 
        getDoc(doc(db, 'dashboards', dashboardId)).catch(error => {
          if (error?.code === 'permission-denied' || error?.code === 'not-found') {
            logger.warn(`Dashboard ${dashboardId} non accessible ou supprimé`, undefined, 'UniversInstanceResourceService');
            return null;
          }
          logger.warn(`Erreur lors de la récupération du dashboard ${dashboardId}: ${error.message}`, undefined, 'UniversInstanceResourceService');
          return null;
        })
      );

      const dashboardDocs = await Promise.all(dashboardPromises);
      const dashboards: Dashboard[] = [];

      dashboardDocs.forEach((dashboardDoc) => {
        if (!dashboardDoc || !dashboardDoc.exists()) {
          return;
        }

        const data = dashboardDoc.data();
        dashboards.push({
          id: dashboardDoc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date()
        } as Dashboard);
      });

      return dashboards;
    } catch (error) {
      logger.error('Erreur lors de la récupération des dashboards depuis l\'instance', error, 'UniversInstanceResourceService');
      return [];
    }
  }

  /**
   * Récupérer les listes depuis une instance
   */
  async getListsFromInstance(instanceId: string): Promise<List[]> {
    try {
      const instanceDoc = await getDoc(doc(db, this.instancesCollectionName, instanceId));
      
      if (!instanceDoc.exists()) {
        return [];
      }

      const instanceData = instanceDoc.data();
      const listIds = instanceData.instances?.lists || [];

      if (listIds.length === 0) {
        return [];
      }

      // Récupérer les listes en parallèle avec getDoc
      const listPromises = listIds.map(listId => 
        getDoc(doc(db, 'lists', listId)).catch(error => {
          if (error?.code === 'permission-denied' || error?.code === 'not-found') {
            logger.warn(`Liste ${listId} non accessible ou supprimée`, undefined, 'UniversInstanceResourceService');
            return null;
          }
          logger.warn(`Erreur lors de la récupération de la liste ${listId}: ${error.message}`, undefined, 'UniversInstanceResourceService');
          return null;
        })
      );

      const listDocs = await Promise.all(listPromises);
      const lists: List[] = [];

      listDocs.forEach((listDoc) => {
        if (!listDoc || !listDoc.exists()) {
          return;
        }

        const data = listDoc.data();
        lists.push({
          id: listDoc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        } as List);
      });

      return lists;
    } catch (error) {
      logger.error('Erreur lors de la récupération des listes depuis l\'instance', error, 'UniversInstanceResourceService');
      return [];
    }
  }

  /**
   * Récupérer les rapports depuis une instance
   */
  async getReportsFromInstance(instanceId: string): Promise<Report[]> {
    try {
      const instanceDoc = await getDoc(doc(db, this.instancesCollectionName, instanceId));
      
      if (!instanceDoc.exists()) {
        return [];
      }

      const instanceData = instanceDoc.data();
      const reportIds = instanceData.instances?.reports || [];

      if (reportIds.length === 0) {
        return [];
      }

      // Récupérer les rapports en parallèle avec getDoc
      const reportPromises = reportIds.map(reportId => 
        getDoc(doc(db, 'reports', reportId)).catch(error => {
          if (error?.code === 'permission-denied' || error?.code === 'not-found') {
            logger.warn(`Rapport ${reportId} non accessible ou supprimé`, undefined, 'UniversInstanceResourceService');
            return null;
          }
          logger.warn(`Erreur lors de la récupération du rapport ${reportId}: ${error.message}`, undefined, 'UniversInstanceResourceService');
          return null;
        })
      );

      const reportDocs = await Promise.all(reportPromises);
      const reports: Report[] = [];

      reportDocs.forEach((reportDoc) => {
        if (!reportDoc || !reportDoc.exists()) {
          return;
        }

        const data = reportDoc.data();
        reports.push({
          id: reportDoc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date()
        } as Report);
      });

      return reports;
    } catch (error) {
      logger.error('Erreur lors de la récupération des rapports depuis l\'instance', error, 'UniversInstanceResourceService');
      return [];
    }
  }

  /**
   * Récupérer les instructions (scheduledQuestions) depuis une instance
   */
  async getInstructionsFromInstance(instanceId: string): Promise<ScheduledQuestion[]> {
    try {
      const instanceDoc = await getDoc(doc(db, this.instancesCollectionName, instanceId));
      
      if (!instanceDoc.exists()) {
        return [];
      }

      const instanceData = instanceDoc.data();
      const instructionIds = instanceData.instances?.instructions || [];

      if (instructionIds.length === 0) {
        return [];
      }

      // Récupérer les instructions en parallèle avec getDoc
      const instructionPromises = instructionIds.map(instructionId => 
        getDoc(doc(db, 'scheduledQuestions', instructionId)).catch(error => {
          if (error?.code === 'permission-denied' || error?.code === 'not-found') {
            logger.warn(`Instruction ${instructionId} non accessible ou supprimée`, undefined, 'UniversInstanceResourceService');
            return null;
          }
          logger.warn(`Erreur lors de la récupération de l'instruction ${instructionId}: ${error.message}`, undefined, 'UniversInstanceResourceService');
          return null;
        })
      );

      const instructionDocs = await Promise.all(instructionPromises);
      const instructions: ScheduledQuestion[] = [];

      instructionDocs.forEach((instructionDoc) => {
        if (!instructionDoc || !instructionDoc.exists()) {
          return;
        }

        const data = instructionDoc.data();
        instructions.push({
          id: instructionDoc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          nextExecution: data.nextExecution?.toDate() || undefined,
          lastExecution: data.lastExecution?.toDate() || undefined
        } as ScheduledQuestion);
      });

      return instructions;
    } catch (error) {
      logger.error('Erreur lors de la récupération des instructions depuis l\'instance', error, 'UniversInstanceResourceService');
      return [];
    }
  }

  /**
   * S'abonner aux changements d'une instance et récupérer les ressources en temps réel
   */
  subscribeToInstanceResources(
    instanceId: string,
    callback: (resources: {
      forms: Form[];
      dashboards: Dashboard[];
      lists: List[];
      reports: Report[];
      instructions: ScheduledQuestion[];
    }) => void
  ): () => void {
    let isActive = true;
    let currentResources: {
      forms: Form[];
      dashboards: Dashboard[];
      lists: List[];
      reports: Report[];
      instructions: ScheduledQuestion[];
    } = {
      forms: [],
      dashboards: [],
      lists: [],
      reports: [],
      instructions: []
    };

    // Écouter les changements du document instance
    const unsubscribeInstance = onSnapshot(
      doc(db, this.instancesCollectionName, instanceId),
      async (instanceSnapshot: DocumentSnapshot) => {
        if (!isActive) return;

        if (!instanceSnapshot.exists()) {
          callback({
            forms: [],
            dashboards: [],
            lists: [],
            reports: [],
            instructions: []
          });
          return;
        }

        const instanceData = instanceSnapshot.data();
        const instances = instanceData?.instances || {
          forms: [],
          dashboards: [],
          instructions: [],
          lists: [],
          reports: []
        };

        // Récupérer les nouvelles ressources
        try {
          const [forms, dashboards, lists, reports, instructions] = await Promise.all([
            this.getFormsFromInstance(instanceId),
            this.getDashboardsFromInstance(instanceId),
            this.getListsFromInstance(instanceId),
            this.getReportsFromInstance(instanceId),
            this.getInstructionsFromInstance(instanceId)
          ]);

          if (isActive) {
            currentResources = { forms, dashboards, lists, reports, instructions };
            callback(currentResources);
          }
        } catch (error) {
          logger.error('Erreur lors de la récupération des ressources en temps réel', error, 'UniversInstanceResourceService');
          if (isActive) {
            callback(currentResources); // Retourner les ressources précédentes en cas d'erreur
          }
        }
      },
      (error) => {
        logger.error('Erreur lors de l\'écoute de l\'instance', error, 'UniversInstanceResourceService');
        if (isActive) {
          callback(currentResources); // Retourner les ressources précédentes en cas d'erreur
        }
      }
    );

    // Retourner la fonction de désabonnement
    return () => {
      isActive = false;
      unsubscribeInstance();
    };
  }
}

export const universInstanceResourceService = new UniversInstanceResourceService();


import { 
  UniversDefinitions, 
  ListDefinition, 
  FormDefinition, 
  DashboardDefinition, 
  InstructionDefinition, 
  ReportDefinition, 
  Report, 
  ReportMapping,
  ScheduledQuestion,
  List
} from '../types';
import { listsService } from './listsService';
import { reportsService } from './reportsService';
import { scheduledQuestionService } from './scheduledQuestionService';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface InstantiationResult {
  forms: string[]; // Array of created form IDs
  dashboards: string[]; // Array of created dashboard IDs
  instructions: string[]; // Array of created instruction IDs
  lists: string[]; // Array of created list IDs
  reports: string[]; // Array of created report IDs
}

export interface InstantiationParams {
  definitions: UniversDefinitions;
  userId: string;
  userRole: 'directeur' | 'employe' | 'admin';
  agencyId: string;
  universId: string;
  universInstanceId: string;
}

/**
 * Service to instantiate UniversDefinitions into concrete resources
 * This service creates actual Forms, Dashboards, Instructions, Lists, and Reports from template definitions
 */
class UniversInstantiationService {
  /**
   * Helper function to normalize date from various formats into a valid Date object
   */
  private normalizeDate(dateValue: any): Date {
    if (dateValue instanceof Date) {
      // Vérifier que la date est valide
      if (isNaN(dateValue.getTime())) {
        console.warn('⚠️ Invalid Date object, using current date');
        return new Date();
      }
      return dateValue;
    }
    if (dateValue && typeof dateValue === 'object') {
      // Firestore Timestamp with toDate method
      if ('toDate' in dateValue && typeof dateValue.toDate === 'function') {
        const date = dateValue.toDate();
        if (isNaN(date.getTime())) {
          console.warn('⚠️ Invalid Firestore Timestamp, using current date');
          return new Date();
        }
        return date;
      }
      // Firestore Timestamp sérialisé (has seconds property)
      if ('seconds' in dateValue && typeof dateValue.seconds === 'number') {
        const date = new Date(dateValue.seconds * 1000);
        if (isNaN(date.getTime())) {
          console.warn('⚠️ Invalid Firestore Timestamp (seconds), using current date');
          return new Date();
        }
        return date;
      }
      // Try to convert object to date
      try {
        const date = new Date(dateValue);
        if (isNaN(date.getTime())) {
          console.warn('⚠️ Invalid date from object, using current date');
          return new Date();
        }
        return date;
      } catch (e) {
        console.warn('⚠️ Error converting object to date, using current date');
        return new Date();
      }
    }
    if (typeof dateValue === 'string' || typeof dateValue === 'number') {
      try {
        const date = new Date(dateValue);
        if (isNaN(date.getTime())) {
          console.warn('⚠️ Invalid date from string/number, using current date');
          return new Date();
        }
        return date;
      } catch (e) {
        console.warn('⚠️ Error converting string/number to date, using current date');
        return new Date();
      }
    }
    // Fallback to current date
    console.warn('⚠️ Unknown date format, using current date');
    return new Date();
  }
  /**
   * Instantiate Forms from FormDefinitions
   */
  async instantiateForms(
    formDefinitions: FormDefinition[],
    params: InstantiationParams
  ): Promise<string[]> {
    const createdFormIds: string[] = [];

    for (const formDef of formDefinitions) {
      try {
        // Create a Form from FormDefinition
        const formData: any = {
          title: formDef.title,
          description: formDef.description || '',
          fields: formDef.fields || [],
          createdBy: params.userId,
          createdByRole: params.userRole === 'admin' ? 'directeur' : params.userRole as 'directeur' | 'employe',
          assignedTo: [], // Empty by default - user will assign later
          agencyId: params.agencyId,
          universId: params.universId,
          universInstanceId: params.universInstanceId,
          fromUnivers: true,
          createdAt: serverTimestamp()
        };

        // Ne pas inclure createdByEmployeeId si undefined (Firestore ne permet pas undefined)
        if (params.userRole === 'employe') {
          formData.createdByEmployeeId = params.userId;
        }

        const formRef = await addDoc(collection(db, 'forms'), formData);
        createdFormIds.push(formRef.id);
        
        console.log(`✅ Form instantiated: ${formDef.title} (ID: ${formRef.id})`);
      } catch (error) {
        console.error(`❌ Error instantiating form ${formDef.title}:`, error);
        throw new Error(`Failed to instantiate form "${formDef.title}": ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return createdFormIds;
  }

  /**
   * Instantiate Dashboards from DashboardDefinitions
   */
  async instantiateDashboards(
    dashboardDefinitions: DashboardDefinition[],
    params: InstantiationParams
  ): Promise<string[]> {
    const createdDashboardIds: string[] = [];

    for (const dashboardDef of dashboardDefinitions) {
      try {
        // Create a Dashboard from DashboardDefinition
        const dashboardData: any = {
          name: dashboardDef.name,
          description: dashboardDef.description || '',
          metrics: dashboardDef.metrics.map(metric => ({
            ...metric,
            createdAt: new Date()
          })),
          createdBy: params.userId,
          createdByRole: params.userRole === 'admin' ? 'directeur' : params.userRole as 'directeur' | 'employe',
          agencyId: params.agencyId,
          isDefault: false,
          universId: params.universId,
          universInstanceId: params.universInstanceId,
          fromUnivers: true,
          createdAt: serverTimestamp()
        };

        // Ne pas inclure createdByEmployeeId si undefined (Firestore ne permet pas undefined)
        if (params.userRole === 'employe') {
          dashboardData.createdByEmployeeId = params.userId;
        }

        const dashboardRef = await addDoc(collection(db, 'dashboards'), dashboardData);
        createdDashboardIds.push(dashboardRef.id);
        
        console.log(`✅ Dashboard instantiated: ${dashboardDef.name} (ID: ${dashboardRef.id})`);
      } catch (error) {
        console.error(`❌ Error instantiating dashboard ${dashboardDef.name}:`, error);
        throw new Error(`Failed to instantiate dashboard "${dashboardDef.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return createdDashboardIds;
  }

  /**
   * Instantiate Instructions from InstructionDefinitions
   * Instructions are converted to ScheduledQuestions
   */
  async instantiateInstructions(
    instructionDefinitions: InstructionDefinition[],
    params: InstantiationParams,
    idMappings: {
      forms: Map<string, string>; // Map<definitionId, instanceId>
      dashboards: Map<string, string>; // Map<definitionId, instanceId>
      lists: Map<string, string>; // Map<definitionId, instanceId> (for future use)
    }
  ): Promise<string[]> {
    const createdInstructionIds: string[] = [];

    for (const instructionDef of instructionDefinitions) {
      try {
        // Normaliser scheduledAt pour garantir une Date valide
        const rawScheduledAt = (instructionDef as any).scheduledAt;
        let scheduledAt = rawScheduledAt ? this.normalizeDate(rawScheduledAt) : new Date();
        
        // Vérifier que scheduledAt est une Date valide
        if (isNaN(scheduledAt.getTime())) {
          console.warn(`⚠️ Invalid scheduledAt for instruction "${instructionDef.title}", using current date`);
          scheduledAt = new Date();
        }
        
        // Calculate nextExecution based on frequency
        let nextExecution = scheduledQuestionService.calculateNextExecution(
          scheduledAt,
          instructionDef.frequency
        );

        // Vérifier que nextExecution est une Date valide
        if (!nextExecution || isNaN(nextExecution.getTime())) {
          console.warn(`⚠️ Invalid nextExecution for instruction "${instructionDef.title}", calculating from current date`);
          nextExecution = scheduledQuestionService.calculateNextExecution(new Date(), instructionDef.frequency);
        }

        // Create a ScheduledQuestion from InstructionDefinition
        const scheduledQuestionData: any = {
          userId: params.userId,
          agencyId: params.agencyId,
          question: instructionDef.question,
          title: instructionDef.title,
          filters: {
            period: instructionDef.filters.period,
            formId: idMappings.forms.get(instructionDef.filters.formId) || instructionDef.filters.formId, // Map definition ID to instance ID if available
            userId: instructionDef.filters.userId
          },
          selectedFormat: instructionDef.selectedFormat,
          selectedFormats: instructionDef.selectedFormats || [],
          selectedFormIds: instructionDef.selectedFormIds.map(formDefId => idMappings.forms.get(formDefId) || formDefId), // Map definition IDs to instance IDs
          scheduledAt: scheduledAt,
          frequency: instructionDef.frequency,
          nextExecution: nextExecution,
          status: 'pending',
          universId: params.universId,
          universInstanceId: params.universInstanceId,
          fromUnivers: true
        };

        // Ne pas inclure les champs undefined (Firestore ne permet pas undefined)
        if (instructionDef.description) {
          scheduledQuestionData.description = instructionDef.description;
        }
        if (instructionDef.maxExecutions) {
          scheduledQuestionData.maxExecutions = instructionDef.maxExecutions;
        }

        const scheduledQuestionId = await scheduledQuestionService.create(scheduledQuestionData);
        createdInstructionIds.push(scheduledQuestionId);
        
        console.log(`✅ Instruction instantiated: ${instructionDef.title} (ID: ${scheduledQuestionId})`);
      } catch (error) {
        console.error(`❌ Error instantiating instruction ${instructionDef.title}:`, error);
        throw new Error(`Failed to instantiate instruction "${instructionDef.title}": ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return createdInstructionIds;
  }

  /**
   * Instantiate Lists from ListDefinitions
   */
  async instantiateLists(
    listDefinitions: ListDefinition[],
    params: InstantiationParams
  ): Promise<string[]> {
    const createdListIds: string[] = [];

    for (const listDef of listDefinitions) {
      try {
        // Create a List from ListDefinition
        const listData: any = {
          name: listDef.name,
          columns: listDef.columns,
          rows: listDef.rows,
          createdBy: params.userId,
          createdByRole: params.userRole === 'admin' ? 'directeur' : params.userRole as 'directeur' | 'employe',
          agencyId: params.agencyId,
          createdAt: new Date(),
          updatedAt: new Date(),
          universId: params.universId,
          universInstanceId: params.universInstanceId,
          fromUnivers: true
        };

        // Ne pas inclure les champs undefined (Firestore ne permet pas undefined)
        if (listDef.description) {
          listData.description = listDef.description;
        }
        if (params.userRole === 'employe') {
          listData.createdByEmployeeId = params.userId;
        }

        const listId = await listsService.create(listData);
        createdListIds.push(listId);
        
        console.log(`✅ List instantiated: ${listDef.name} (ID: ${listId})`);
      } catch (error) {
        console.error(`❌ Error instantiating list ${listDef.name}:`, error);
        throw new Error(`Failed to instantiate list "${listDef.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return createdListIds;
  }

  /**
   * Instantiate Reports from ReportDefinitions
   * Maps definition IDs to instance IDs for forms and dashboards in report mappings
   */
  async instantiateReports(
    reportDefinitions: ReportDefinition[],
    params: InstantiationParams,
    idMappings: {
      forms: Map<string, string>; // Map<definitionId, instanceId>
      dashboards: Map<string, string>; // Map<definitionId, instanceId>
      lists: Map<string, string>; // Map<definitionId, instanceId> (for future use)
    }
  ): Promise<string[]> {
    const createdReportIds: string[] = [];

    for (const reportDef of reportDefinitions) {
      try {
        // Update mappings to reference created instance IDs instead of definition IDs
        const updatedMappings: ReportMapping[] = reportDef.mappings.map(mapping => {
          // Create a copy of the mapping
          const updatedMapping: ReportMapping = { ...mapping };

          // If mapping references a form, map definition ID to instance ID
          if (mapping.sourceType === 'form') {
            const instanceId = idMappings.forms.get(mapping.sourceId);
            if (instanceId) {
              updatedMapping.sourceId = instanceId;
              console.log(`✅ Mapped form definition ${mapping.sourceId} → instance ${instanceId}`);
            } else {
              console.warn(`⚠️ Warning: Form definition ID ${mapping.sourceId} not found in instantiated forms. Mapping may be broken.`);
            }
          }
          // If mapping references a dashboard, map definition ID to instance ID
          else if (mapping.sourceType === 'dashboard') {
            const instanceId = idMappings.dashboards.get(mapping.sourceId);
            if (instanceId) {
              updatedMapping.sourceId = instanceId;
              console.log(`✅ Mapped dashboard definition ${mapping.sourceId} → instance ${instanceId}`);
            } else {
              console.warn(`⚠️ Warning: Dashboard definition ID ${mapping.sourceId} not found in instantiated dashboards. Mapping may be broken.`);
            }
          }

          return updatedMapping;
        });

        // Create a Report from ReportDefinition
        const reportData: any = {
          name: reportDef.name,
          templateType: reportDef.templateType,
          placeholders: reportDef.placeholders,
          mappings: updatedMappings,
          createdBy: params.userId,
          createdByRole: params.userRole === 'admin' ? 'directeur' : params.userRole as 'directeur' | 'employe',
          agencyId: params.agencyId,
          createdAt: new Date(),
          updatedAt: new Date(),
          universId: params.universId,
          universInstanceId: params.universInstanceId,
          fromUnivers: true
        };

        // Ne pas inclure les champs undefined (Firestore ne permet pas undefined)
        if (reportDef.description) {
          reportData.description = reportDef.description;
        }
        if (reportDef.templateContent) {
          reportData.templateContent = reportDef.templateContent;
        }
        if (reportDef.templateFileUrl) {
          reportData.templateFileUrl = reportDef.templateFileUrl;
        }
        if (reportDef.templateFileStoragePath) {
          reportData.templateFileStoragePath = reportDef.templateFileStoragePath;
        }
        if (reportDef.templateFileName) {
          reportData.templateFileName = reportDef.templateFileName;
        }
        if (params.userRole === 'employe') {
          reportData.createdByEmployeeId = params.userId;
        }

        const reportId = await reportsService.create(reportData);
        createdReportIds.push(reportId);
        
        console.log(`✅ Report instantiated: ${reportDef.name} (ID: ${reportId})`);
      } catch (error) {
        console.error(`❌ Error instantiating report ${reportDef.name}:`, error);
        throw new Error(`Failed to instantiate report "${reportDef.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return createdReportIds;
  }

  /**
   * Instantiate all resources from UniversDefinitions
   * This is the main method to call for full instantiation
   * 
   * Order of instantiation is important:
   * 1. Forms (if implemented)
   * 2. Dashboards (if implemented, depends on forms)
   * 3. Lists
   * 4. Instructions (if implemented)
   * 5. Reports (depends on forms and dashboards for mappings)
   */
  async instantiate(params: InstantiationParams): Promise<InstantiationResult> {
    const result: InstantiationResult = {
      forms: [],
      dashboards: [],
      instructions: [],
      lists: [],
      reports: []
    };

    const { definitions } = params;

    // Build ID mappings from definition IDs to instance IDs
    // This will be populated as resources are instantiated
    const idMappings = {
      forms: new Map<string, string>(),
      dashboards: new Map<string, string>(),
      lists: new Map<string, string>()
    };

    // Instantiate Forms (must be first)
    if (definitions.forms && definitions.forms.length > 0) {
      try {
        result.forms = await this.instantiateForms(definitions.forms, params);
        // Populate form ID mappings
        definitions.forms.forEach((formDef, index) => {
          idMappings.forms.set(formDef.id, result.forms[index]);
        });
        console.log(`✅ Instantiated ${result.forms.length} forms`);
      } catch (error) {
        console.error('❌ Error instantiating forms:', error);
        throw error;
      }
    }

    // Instantiate Dashboards (depends on forms)
    if (definitions.dashboards && definitions.dashboards.length > 0) {
      try {
        result.dashboards = await this.instantiateDashboards(definitions.dashboards, params);
        // Populate dashboard ID mappings
        definitions.dashboards.forEach((dashboardDef, index) => {
          idMappings.dashboards.set(dashboardDef.id, result.dashboards[index]);
        });
        console.log(`✅ Instantiated ${result.dashboards.length} dashboards`);
      } catch (error) {
        console.error('❌ Error instantiating dashboards:', error);
        throw error;
      }
    }

    // Instantiate Lists
    if (definitions.lists && definitions.lists.length > 0) {
      try {
        result.lists = await this.instantiateLists(definitions.lists, params);
        // Populate list ID mappings
        definitions.lists.forEach((listDef, index) => {
          idMappings.lists.set(listDef.id, result.lists[index]);
        });
        console.log(`✅ Instantiated ${result.lists.length} lists`);
      } catch (error) {
        console.error('❌ Error instantiating lists:', error);
        throw error;
      }
    }

    // Instantiate Instructions (depends on forms for filter formId mapping)
    if (definitions.instructions && definitions.instructions.length > 0) {
      try {
        result.instructions = await this.instantiateInstructions(definitions.instructions, params, idMappings);
        console.log(`✅ Instantiated ${result.instructions.length} instructions`);
      } catch (error) {
        console.error('❌ Error instantiating instructions:', error);
        throw error;
      }
    }

    // Instantiate Reports (depends on forms and dashboards for mappings)
    if (definitions.reports && definitions.reports.length > 0) {
      try {
        result.reports = await this.instantiateReports(definitions.reports, params, idMappings);
        console.log(`✅ Instantiated ${result.reports.length} reports`);
      } catch (error) {
        console.error('❌ Error instantiating reports:', error);
        throw error;
      }
    }

    return result;
  }
}

export const universInstantiationService = new UniversInstantiationService();


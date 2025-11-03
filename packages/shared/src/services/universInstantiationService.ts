import { UniversDefinitions, ListDefinition, FormDefinition, DashboardDefinition, InstructionDefinition, ReportDefinition, Report, ReportMapping } from '../types';
import { listsService } from './listsService';
import { reportsService } from './reportsService';
import { List } from '../types';

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
        const listData: Omit<List, 'id'> = {
          name: listDef.name,
          description: listDef.description,
          columns: listDef.columns,
          rows: listDef.rows,
          createdBy: params.userId,
          createdByRole: params.userRole,
          createdByEmployeeId: params.userRole === 'employe' ? params.userId : undefined,
          agencyId: params.agencyId,
          createdAt: new Date(),
          updatedAt: new Date(),
          universId: params.universId,
          universInstanceId: params.universInstanceId,
          fromUnivers: true
        };

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
        const reportData: Omit<Report, 'id'> = {
          name: reportDef.name,
          description: reportDef.description,
          templateType: reportDef.templateType,
          templateContent: reportDef.templateContent,
          templateFileUrl: reportDef.templateFileUrl,
          templateFileStoragePath: reportDef.templateFileStoragePath,
          templateFileName: reportDef.templateFileName,
          placeholders: reportDef.placeholders,
          mappings: updatedMappings,
          createdBy: params.userId,
          createdByRole: params.userRole,
          createdByEmployeeId: params.userRole === 'employe' ? params.userId : undefined,
          agencyId: params.agencyId,
          createdAt: new Date(),
          updatedAt: new Date(),
          universId: params.universId,
          universInstanceId: params.universInstanceId,
          fromUnivers: true
        };

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

    // TODO: Instantiate Forms (when implemented)
    // if (definitions.forms && definitions.forms.length > 0) {
    //   result.forms = await this.instantiateForms(definitions.forms, params);
    //   // Populate form ID mappings
    //   definitions.forms.forEach((formDef, index) => {
    //     idMappings.forms.set(formDef.id, result.forms[index]);
    //   });
    // }

    // TODO: Instantiate Dashboards (when implemented, depends on forms)
    // if (definitions.dashboards && definitions.dashboards.length > 0) {
    //   result.dashboards = await this.instantiateDashboards(definitions.dashboards, params);
    //   // Populate dashboard ID mappings
    //   definitions.dashboards.forEach((dashboardDef, index) => {
    //     idMappings.dashboards.set(dashboardDef.id, result.dashboards[index]);
    //   });
    // }

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

    // TODO: Instantiate Instructions (when implemented)
    // if (definitions.instructions && definitions.instructions.length > 0) {
    //   result.instructions = await this.instantiateInstructions(definitions.instructions, params);
    // }

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


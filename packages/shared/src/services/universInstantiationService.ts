import { UniversDefinitions, ListDefinition, FormDefinition, DashboardDefinition, InstructionDefinition, ReportDefinition } from '../types';
import { listsService } from './listsService';
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
   * Instantiate all resources from UniversDefinitions
   * This is the main method to call for full instantiation
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

    // Instantiate Lists
    if (definitions.lists && definitions.lists.length > 0) {
      try {
        result.lists = await this.instantiateLists(definitions.lists, params);
        console.log(`✅ Instantiated ${result.lists.length} lists`);
      } catch (error) {
        console.error('❌ Error instantiating lists:', error);
        throw error;
      }
    }

    // TODO: Add instantiation for other resource types (forms, dashboards, instructions, reports)
    // These will be implemented in future phases

    return result;
  }
}

export const universInstantiationService = new UniversInstantiationService();


import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { FormField } from '../types';

/**
 * Check if a list is used in any forms within an agency
 * @param listId The ID of the list to check
 * @param agencyId The agency ID to search within
 * @returns Array of form IDs that use this list, empty array if not used
 */
export async function checkListUsageInForms(
  listId: string,
  agencyId: string
): Promise<{ formId: string; formTitle: string; fieldLabel: string }[]> {
  try {
    // Query all forms in the agency
    const formsQuery = query(
      collection(db, 'forms'),
      where('agencyId', '==', agencyId)
    );
    
    const formsSnapshot = await getDocs(formsQuery);
    const usages: { formId: string; formTitle: string; fieldLabel: string }[] = [];
    
    formsSnapshot.docs.forEach(doc => {
      const formData = doc.data();
      const fields: FormField[] = formData.fields || [];
      
      // Check each field for list usage
      fields.forEach(field => {
        if (field.type === 'select' && field.listId === listId) {
          usages.push({
            formId: doc.id,
            formTitle: formData.title || 'Formulaire sans titre',
            fieldLabel: field.label || 'Champ sans libellé'
          });
        }
      });
    });
    
    return usages;
  } catch (error) {
    console.error('Error checking list usage in forms:', error);
    throw error;
  }
}

/**
 * Check if a list can be safely deleted (not used in any forms)
 * @param listId The ID of the list to check
 * @param agencyId The agency ID to search within
 * @returns Object with canDelete flag and usage details
 */
export async function canDeleteList(
  listId: string,
  agencyId: string
): Promise<{
  canDelete: boolean;
  usages: { formId: string; formTitle: string; fieldLabel: string }[];
}> {
  const usages = await checkListUsageInForms(listId, agencyId);
  
  return {
    canDelete: usages.length === 0,
    usages
  };
}


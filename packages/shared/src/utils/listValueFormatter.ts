import { FormField } from '../types';

/**
 * Interface pour les valeurs de dropdown basées sur des listes
 */
export interface ListRowValue {
  _listRow: true;
  listId: string;
  rowData: Record<string, any>;
  _selectValue?: string;
}

/**
 * Vérifie si une valeur est un objet de liste (dropdown basé sur une liste)
 */
export function isListRowValue(value: any): value is ListRowValue {
  return (
    value !== null &&
    typeof value === 'object' &&
    '_listRow' in value &&
    value._listRow === true &&
    'listId' in value &&
    'rowData' in value &&
    typeof value.rowData === 'object'
  );
}

/**
 * Formate une valeur de dropdown basée sur une liste pour l'affichage
 * @param value - La valeur à formater (peut être un objet ListRowValue ou autre)
 * @param field - Le champ du formulaire (optionnel, pour obtenir displayColumnId)
 * @returns La valeur formatée pour l'affichage
 */
export function formatListValue(
  value: any,
  field?: FormField
): string {
  // Si ce n'est pas une valeur de liste, retourner la valeur telle quelle
  if (!isListRowValue(value)) {
    return value !== null && value !== undefined ? String(value) : '';
  }

  const rowData = value.rowData;
  if (!rowData || typeof rowData !== 'object') {
    return '[Liste: données invalides]';
  }

  // Si on a le champ avec displayColumnId, utiliser cette colonne
  if (field?.displayColumnId && rowData[field.displayColumnId] !== undefined) {
    return String(rowData[field.displayColumnId]);
  }

  // Sinon, essayer de trouver une colonne d'affichage par défaut
  // Priorité : chercher des colonnes communes comme "name", "label", "title", "nom", "libellé"
  const commonDisplayColumns = ['name', 'label', 'title', 'nom', 'libellé', 'libelle', 'value', 'valeur'];
  for (const colName of commonDisplayColumns) {
    if (rowData[colName] !== undefined && rowData[colName] !== null && rowData[colName] !== '') {
      return String(rowData[colName]);
    }
  }

  // Si aucune colonne d'affichage trouvée, formater toutes les colonnes
  const entries = Object.entries(rowData)
    .filter(([_, val]) => val !== null && val !== undefined && val !== '')
    .map(([key, val]) => `${key}: ${String(val)}`);

  if (entries.length > 0) {
    // Si une seule colonne, retourner juste sa valeur
    if (entries.length === 1) {
      return entries[0].split(': ')[1];
    }
    // Sinon, retourner toutes les colonnes formatées
    return `{${entries.join(', ')}}`;
  }

  return '[Liste: aucune donnée]';
}

/**
 * Formate une valeur pour l'IA (analyse)
 * Retourne une représentation textuelle complète de la valeur de liste
 * @param value - La valeur à formater
 * @param field - Le champ du formulaire (optionnel)
 * @returns La valeur formatée pour l'IA
 */
export function formatListValueForAI(
  value: any,
  field?: FormField
): string {
  // Si ce n'est pas une valeur de liste, retourner la valeur telle quelle
  if (!isListRowValue(value)) {
    if (value === null || value === undefined) {
      return 'Non renseigné';
    }
    if (typeof value === 'boolean') {
      return value ? 'Oui' : 'Non';
    }
    return String(value);
  }

  const rowData = value.rowData;
  if (!rowData || typeof rowData !== 'object') {
    return '[Liste: données invalides]';
  }

  // Pour l'IA, on veut toutes les données de la ligne formatées de manière lisible
  const entries = Object.entries(rowData)
    .filter(([_, val]) => val !== null && val !== undefined && val !== '')
    .map(([key, val]) => {
      const formattedVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
      return `${key}: ${formattedVal}`;
    });

  if (entries.length > 0) {
    // Si on a une colonne d'affichage, la mettre en premier
    if (field?.displayColumnId && rowData[field.displayColumnId] !== undefined) {
      const displayValue = String(rowData[field.displayColumnId]);
      const otherEntries = entries.filter(
        ([key]) => key !== field.displayColumnId
      );
      if (otherEntries.length > 0) {
        return `${displayValue} (${otherEntries.map(([k, v]) => `${k}=${v}`).join(', ')})`;
      }
      return displayValue;
    }

    // Sinon, retourner toutes les colonnes formatées
    return entries.map(([k, v]) => `${k}=${v}`).join(', ');
  }

  return '[Liste: aucune donnée]';
}

/**
 * Formate une valeur générique (gère les listes et autres types)
 * @param value - La valeur à formater
 * @param field - Le champ du formulaire (optionnel)
 * @param forAI - Si true, utilise formatListValueForAI, sinon formatListValue
 * @returns La valeur formatée
 */
export function formatFieldValue(
  value: any,
  field?: FormField,
  forAI: boolean = false
): string {
  if (isListRowValue(value)) {
    return forAI ? formatListValueForAI(value, field) : formatListValue(value, field);
  }

  if (value === null || value === undefined) {
    return forAI ? 'Non renseigné' : '-';
  }

  if (typeof value === 'boolean') {
    return value ? 'Oui' : 'Non';
  }

  if (typeof value === 'object') {
    // Pour les autres objets (fichiers, etc.), retourner une représentation
    if ('uploaded' in value && value.uploaded) {
      return value.fileName || '[Fichier]';
    }
    // Pour les objets génériques, essayer de les formater
    try {
      return JSON.stringify(value);
    } catch {
      return '[Objet]';
    }
  }

  return String(value);
}


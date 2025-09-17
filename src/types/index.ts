// Types pour l'application multi-agences avec formulaires dynamiques
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'directeur' | 'employe';
  agencyId: string;
  package: 'starter' | 'standard' | 'premium' | 'custom';
  packageFeatures?: string[]; // Fonctionnalités activées pour les packages custom
  isApproved?: boolean; // Status d'approbation pour les employés
  approvedBy?: string; // ID du directeur qui a approuvé
  approvedAt?: any; // Timestamp d'approbation
  // Access levels for employees
  accessLevels?: AccessLevel[]; // Niveaux d'accès accordés par le directeur
  hasDirectorDashboardAccess?: boolean; // Accès au dashboard directeur
  directorDashboardAccessGrantedBy?: string; // ID du directeur qui a accordé l'accès
  directorDashboardAccessGrantedAt?: any; // Timestamp d'octroi d'accès
  createdAt?: any; // Timestamp Firestore
  updatedAt?: any; // Timestamp Firestore
}

export interface AccessLevel {
  id: string;
  name: string;
  level: number; // L1, L2, L3, etc.
  permissions: string[]; // Permissions accordées
  grantedBy: string; // ID du directeur qui a accordé le niveau
  grantedAt: any; // Timestamp d'octroi
  description?: string; // Description du niveau d'accès
}

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'email' | 'textarea' | 'select' | 'checkbox' | 'date' | 'file' | 'calculated';
  required: boolean;
  placeholder?: string;
  options?: string[]; // Pour les champs select
  acceptedTypes?: string[]; // Pour les champs file (ex: [".pdf", ".doc", ".docx"])
  // Calculated field properties
  calculationFormula?: string; // Ex: "field1 + field2 * 0.2" or "SUM(field1, field2) * 0.1"
  dependsOn?: string[]; // IDs of fields this field depends on
  calculationType?: 'simple' | 'percentage' | 'average' | 'sum' | 'multiply' | 'custom';
  constantValue?: number; // For percentage calculations or custom constants
}

export interface Form {
  id: string;
  title: string;
  description: string;
  createdBy: string; // directeur ID
  createdByRole: 'directeur' | 'employe'; // Rôle du créateur
  createdByEmployeeId?: string; // ID de l'employé si créé par un employé
  assignedTo: string[]; // array d'IDs des employés
  fields: FormField[];
  createdAt: Date;
  agencyId: string;
  timeRestrictions?: {
    startTime?: string; // Format: "HH:MM" (24h format)
    endTime?: string; // Format: "HH:MM" (24h format)
    allowedDays?: number[]; // Array of day numbers (0=Sunday, 1=Monday, etc.)
  };
}

export interface FileAttachment {
  fieldId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  downloadUrl: string;
  storagePath: string;
  uploadedAt: Date;
  extractedText?: string; // Add extracted text for PDFs
  textExtractionStatus?: 'pending' | 'completed' | 'failed'; // Track extraction status
}

export interface FormEntry {
  id: string;
  formId: string; // référence vers un formulaire
  userId: string; // employé qui a soumis (auth.uid)
  agencyId: string; // hérité du user
  answers: Record<string, any>; // map { fieldId: valeur }
  fileAttachments?: FileAttachment[]; // fichiers uploadés
  submittedAt: Date; // serverTimestamp
}

export interface DraftResponse {
  id: string;
  formId: string;
  userId: string;
  agencyId: string;
  answers: Record<string, any>;
  fileAttachments?: FileAttachment[];
  createdAt: Date;
  updatedAt: Date;
  isDraft: true;
}

// Types pour les conversations IA
export interface PDFFileReference {
  fileName: string;
  fileSize?: number;
  fileType: string;
  downloadUrl?: string;
  storagePath?: string;
  extractedText?: string;
  submissionId?: string;
  fieldId?: string;
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  responseTime?: number;
  contentType?: 'text' | 'graph' | 'pdf' | 'text-pdf' | 'table' | 'mixed' | 'multi-format';
  graphData?: GraphData;
  pdfData?: PDFData;
  tableData?: string; // Markdown table content
  pdfFiles?: PDFFileReference[]; // PDF files referenced in the response
  meta?: {
    period?: string;
    usedEntries?: number;
    forms?: number;
    users?: number;
    tokensUsed?: number;
    model?: string;
    selectedFormat?: string | null;
    selectedFormats?: string[]; // For multi-format selection
    selectedFormIds?: string[];
    selectedFormTitles?: string[];
  };
}

// Types pour les graphiques
export interface GraphData {
  type: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
  title: string;
  data: any[];
  xAxisKey?: string;
  yAxisKey?: string;
  dataKey?: string;
  colors?: string[];
  width?: number;
  height?: number;
  options?: {
    showLegend?: boolean;
    showGrid?: boolean;
    showTooltip?: boolean;
    responsive?: boolean;
  };
}

// Types pour les rapports PDF
export interface PDFData {
  title: string;
  subtitle?: string;
  sections: PDFSection[];
  charts?: GraphData[];
  generatedAt: Date;
  metadata?: {
    period?: string;
    totalEntries?: number;
    totalUsers?: number;
    totalForms?: number;
  };
}

export interface PDFSection {
  title: string;
  content: string;
  type: 'text' | 'list' | 'table';
  data?: any[];
}

export interface Conversation {
  id: string;
  directorId: string;
  agencyId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date;
  messageCount: number;
}

// Types pour les tableaux de bord et métriques
export interface DashboardMetric {
  id: string;
  name: string;
  description?: string;
  formId: string;
  fieldId: string;
  fieldType: 'text' | 'number' | 'email' | 'textarea' | 'select' | 'checkbox' | 'date' | 'file' | 'calculated';
  calculationType: 'count' | 'sum' | 'average' | 'min' | 'max' | 'unique';
  metricType: 'value' | 'graph'; // New: type of metric display
  // Graph configuration (only used when metricType is 'graph')
  graphConfig?: {
    xAxisFieldId?: string; // Field for X axis
    yAxisFieldId?: string; // Field for Y axis
    xAxisType?: 'field' | 'time' | 'date'; // Type of X axis
    yAxisType?: 'field' | 'count' | 'sum' | 'average'; // Type of Y axis
    chartType?: 'line' | 'bar' | 'area'; // Chart type
  };
  createdAt: Date;
  createdBy: string; // directeur ID
  agencyId: string;
}

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  metrics: DashboardMetric[];
  createdAt: Date;
  createdBy: string; // directeur ID
  createdByRole: 'directeur' | 'employe'; // Rôle du créateur
  createdByEmployeeId?: string; // ID de l'employé si créé par un employé
  agencyId: string;
  isDefault?: boolean; // Pour le dashboard par défaut
}

// Types pour l'état de l'application
export interface AppState {
  users: User[];
  forms: Form[];
  formEntries: FormEntry[];
  dashboards: Dashboard[];
}


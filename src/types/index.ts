// Types pour l'application multi-agences avec formulaires dynamiques
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'directeur' | 'employe';
  agencyId: string;
  isApproved?: boolean; // Status d'approbation pour les employés
  approvedBy?: string; // ID du directeur qui a approuvé
  approvedAt?: any; // Timestamp d'approbation
  createdAt?: any; // Timestamp Firestore
  updatedAt?: any; // Timestamp Firestore
}

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'email' | 'textarea' | 'select' | 'checkbox' | 'date' | 'file';
  required: boolean;
  placeholder?: string;
  options?: string[]; // Pour les champs select
  acceptedTypes?: string[]; // Pour les champs file (ex: [".pdf", ".doc", ".docx"])
}

export interface Form {
  id: string;
  title: string;
  description: string;
  createdBy: string; // directeur ID
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

// Types pour l'état de l'application
export interface AppState {
  users: User[];
  forms: Form[];
  formEntries: FormEntry[];
}
// Types pour l'application multi-agences avec formulaires dynamiques
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'directeur' | 'employe';
  agencyId: string;
  createdAt?: any; // Timestamp Firestore
  updatedAt?: any; // Timestamp Firestore
}

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'email' | 'textarea' | 'select' | 'checkbox' | 'date';
  required: boolean;
  placeholder?: string;
  options?: string[]; // Pour les champs select
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
}

export interface FormEntry {
  id: string;
  formId: string; // référence vers un formulaire
  userId: string; // employé qui a soumis (auth.uid)
  agencyId: string; // hérité du user
  answers: Record<string, any>; // map { fieldId: valeur }
  submittedAt: Date; // serverTimestamp
}

// Types pour les conversations IA
export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  responseTime?: number;
  meta?: {
    period?: string;
    usedEntries?: number;
    forms?: number;
    users?: number;
    tokensUsed?: number;
    model?: string;
  };
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
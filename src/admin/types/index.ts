// Re-export all admin-related types from the main types file
export type {
  AdminDashboardStats,
  AdminUser,
  AdminActivitySummary,
  UserDetail,
  PushNotificationLog,
  AppUsageSession,
  SubscriptionSession,
  PurchaseHistory,
  ActivityLog,
  ActivityType
} from '../../types';

// Additional admin-specific types
export interface AdminForm {
  id: string;
  title: string;
  description?: string;
  agencyId: string;
  agencyName?: string;
  createdBy: string;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  submissionsCount: number;
  lastSubmissionDate?: Date;
  fields: AdminFormField[];
  settings: {
    allowMultipleSubmissions: boolean;
    requireAuthentication: boolean;
    isPublic: boolean;
    expirationDate?: Date;
  };
}

export interface AdminFormField {
  id: string;
  type: 'text' | 'email' | 'number' | 'select' | 'multiselect' | 'textarea' | 'date' | 'checkbox' | 'radio';
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    customMessage?: string;
  };
  order: number;
}

export interface AdminFormSubmission {
  id: string;
  formId: string;
  formTitle: string;
  userId: string;
  userName: string;
  userEmail: string;
  agencyId: string;
  submittedAt: Date;
  data: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected' | 'draft';
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
}

export interface AdminDashboard {
  id: string;
  title: string;
  description?: string;
  agencyId: string;
  agencyName?: string;
  createdBy: string;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  isPublic: boolean;
  widgets: AdminDashboardWidget[];
  settings: {
    layout: 'grid' | 'list';
    refreshInterval?: number;
    allowExport: boolean;
  };
}

export interface AdminDashboardWidget {
  id: string;
  type: 'chart' | 'table' | 'metric' | 'text' | 'image';
  title: string;
  position: { x: number; y: number; w: number; h: number };
  config: Record<string, any>;
  dataSource?: {
    type: 'form' | 'user' | 'activity' | 'custom';
    sourceId: string;
    filters?: Record<string, any>;
  };
}

export interface AdminFormActivity {
  id: string;
  formId: string;
  formTitle: string;
  userId: string;
  userName: string;
  userEmail: string;
  agencyId: string;
  type: 'form_created' | 'form_updated' | 'form_deleted' | 'form_submitted' | 'form_approved' | 'form_rejected' | 'form_viewed';
  description: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface AdminDashboardActivity {
  id: string;
  dashboardId: string;
  dashboardTitle: string;
  userId: string;
  userName: string;
  userEmail: string;
  agencyId: string;
  type: 'dashboard_created' | 'dashboard_updated' | 'dashboard_deleted' | 'dashboard_viewed' | 'widget_added' | 'widget_updated' | 'widget_removed';
  description: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface AdminStats {
  totalUsers: number;
  totalForms: number;
  totalSubmissions: number;
  totalDashboards: number;
  activeUsers: number;
  activeForms: number;
  pendingSubmissions: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
  lastUpdated: Date;
}

export interface AdminFilter {
  type: 'date' | 'user' | 'agency' | 'status' | 'role';
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan' | 'between';
  value: any;
  label: string;
}

export interface AdminSort {
  field: string;
  direction: 'asc' | 'desc';
}

export interface AdminPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminTableColumn {
  key: string;
  label: string;
  sortable: boolean;
  filterable: boolean;
  type: 'text' | 'number' | 'date' | 'boolean' | 'status' | 'action';
  width?: string;
  align?: 'left' | 'center' | 'right';
}

// Types pour l'application multi-agences avec formulaires dynamiques
// Subscription Session Types
export interface SubscriptionSession {
  id: string; // Unique session ID
  packageType: 'starter' | 'standard' | 'premium' | 'custom';
  sessionType: 'subscription' | 'pay_as_you_go' | 'upgrade' | 'downgrade' | 'renewal';
  startDate: Date;
  endDate: Date;
  amountPaid: number; // Amount paid in FCFA
  durationDays: number; // Duration in days
  tokensIncluded: number; // Tokens included in this session
  tokensUsed: number; // Tokens used during this session
  isActive: boolean; // Whether this session is currently active
  paymentMethod?: string; // Payment method used
  notes?: string; // Additional notes
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'directeur' | 'employe';
  agencyId: string;
  package?: 'starter' | 'standard' | 'premium' | 'custom'; // Current active package
  needsPackageSelection?: boolean; // Flag to indicate if director needs to select a package
  packageFeatures?: string[]; // Fonctionnalités activées pour les packages custom
  
  // New subscription sessions system
  subscriptionSessions?: SubscriptionSession[]; // Array of all subscription sessions
  currentSessionId?: string; // ID of the currently active session
  
  // Legacy fields (kept for backward compatibility during migration)
  subscriptionStartDate?: Date; // Date de début d'abonnement pour le calcul des cycles mensuels
  subscriptionEndDate?: Date; // Date de fin d'abonnement
  subscriptionStatus?: 'active' | 'expired' | 'cancelled'; // Statut de l'abonnement
  payAsYouGoResources?: any; // Ressources pay-as-you-go achetées
  payAsYouGoTokens?: number; // Tokens pay-as-you-go achetés
  tokensUsedMonthly?: number; // Tokens utilisés ce mois
  tokensResetDate?: Date; // Date du dernier reset des tokens mensuels
  
  isApproved?: boolean; // Status d'approbation pour les employés
  approvedBy?: string; // ID du directeur qui a approuvé
  approvedAt?: any; // Timestamp d'approbation
  // Access levels for employees
  accessLevels?: AccessLevel[]; // Niveaux d'accès accordés par le directeur
  hasDirectorDashboardAccess?: boolean; // Accès au dashboard directeur
  directorDashboardAccessGrantedBy?: string; // ID du directeur qui a accordé l'accès
  directorDashboardAccessGrantedAt?: any; // Timestamp d'octroi d'accès
  // Admin specific fields
  isSuperAdmin?: boolean; // Super admin flag
  adminPermissions?: string[]; // Specific admin permissions
  createdByAdmin?: string; // ID of admin who created this user
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

export interface ImageFileReference {
  fileName: string;
  fileSize?: number;
  fileType: string;
  downloadUrl?: string;
  storagePath?: string;
  extractedText?: string;
  confidence?: number;
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
  imageFiles?: ImageFileReference[]; // Image files referenced in the response
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
  subtitle?: string;
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
    animation?: boolean;
    stacked?: boolean;
    horizontal?: boolean;
    fillOpacity?: number;
    strokeWidth?: number;
    radius?: number;
    innerRadius?: number;
    outerRadius?: number;
  };
  // Extended properties for insights and recommendations
  insights?: string[];
  recommendations?: string[];
  // Metadata for better chart rendering
  metadata?: {
    totalEntries?: number;
    chartType?: string;
    dataSource?: string;
    generatedAt?: Date;
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
  type?: 'text' | 'list' | 'table';
  data?: any[];
  isMarkdownTable?: boolean;
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

// Admin dashboard types
export interface AdminDashboardStats {
  totalUsers: number;
  totalAgencies: number;
  totalForms: number;
  totalSubmissions: number;
  totalTokensUsed: number;
  totalRevenue: number;
  activeUsers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
  lastBackup: Date;
  uptime: number;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'directeur' | 'employe';
  agencyId?: string;
  agencyName?: string;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  package?: string;
  subscriptionStatus?: string;
  tokensUsed?: number;
  totalSubmissions?: number;
  // Enhanced subscription info
  subscriptionStartDate?: Date;
  subscriptionEndDate?: Date;
  nextPaymentDate?: Date;
  packageFeatures?: string[];
  // Activity tracking
  totalLoginCount?: number;
  lastActivityDate?: Date;
  // App usage
  totalAppUsageTime?: number; // in minutes
  averageSessionDuration?: number; // in minutes
  // Push notifications
  pushNotificationsSent?: number;
  pushNotificationsClicked?: number;
}

export interface UserDetail {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'directeur' | 'employe';
  agencyId?: string;
  agencyName?: string;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  // Subscription details
  package?: 'starter' | 'standard' | 'premium' | 'custom';
  subscriptionStatus?: 'active' | 'expired' | 'cancelled';
  subscriptionStartDate?: Date;
  subscriptionEndDate?: Date;
  nextPaymentDate?: Date;
  packageFeatures?: string[];
  tokensUsedMonthly?: number;
  tokensResetDate?: Date;
  // Activity summary
  totalLoginCount: number;
  lastActivityDate?: Date;
  totalFormSubmissions: number;
  totalChatInteractions: number;
  // App usage
  totalAppUsageTime: number; // in minutes
  averageSessionDuration: number; // in minutes
  longestSession: number; // in minutes
  // Push notifications
  pushNotificationsSent: number;
  pushNotificationsClicked: number;
  pushNotificationClickRate: number; // percentage
  // Recent activities
  recentActivities: ActivityLog[];
  // Subscription sessions
  subscriptionSessions: SubscriptionSession[];
  // Purchase history
  purchaseHistory: PurchaseHistory[];
  // App usage sessions
  appUsageSessions: AppUsageSession[];
  // Push notifications
  pushNotifications: PushNotificationLog[];
}

export interface PushNotificationLog {
  id?: string;
  userId: string;
  userEmail: string;
  userName: string;
  title: string;
  body: string;
  type: 'form_reminder' | 'package_expiry' | 'system_announcement' | 'chat_notification' | 'general';
  sentAt: Date;
  clickedAt?: Date;
  isClicked: boolean;
  clickRate?: number;
  metadata?: {
    formId?: string;
    packageType?: string;
    agencyId?: string;
    [key: string]: any;
  };
}

export interface AppUsageSession {
  id?: string;
  userId: string;
  userEmail: string;
  userName: string;
  sessionStart: Date;
  sessionEnd?: Date;
  duration?: number; // in minutes
  isActive: boolean;
  pagesVisited: string[];
  actionsPerformed: number;
  metadata?: {
    userAgent?: string;
    ipAddress?: string;
    deviceType?: string;
    [key: string]: any;
  };
}

export interface SubscriptionSession {
  id?: string;
  userId: string;
  userEmail: string;
  userName: string;
  packageType: 'starter' | 'standard' | 'premium' | 'custom';
  startDate: Date;
  endDate: Date;
  status: 'active' | 'expired' | 'cancelled' | 'suspended';
  amount: number;
  currency: string;
  paymentMethod: string;
  autoRenew: boolean;
  features: string[];
  tokensIncluded: number;
  tokensUsed: number;
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    paymentId?: string;
    invoiceNumber?: string;
    notes?: string;
    [key: string]: any;
  };
}

export interface PurchaseHistory {
  id?: string;
  userId: string;
  userEmail: string;
  userName: string;
  type: 'subscription' | 'tokens' | 'feature' | 'upgrade';
  itemName: string;
  description: string;
  amount: number;
  currency: string;
  quantity?: number;
  paymentMethod: string;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  transactionId: string;
  purchaseDate: Date;
  metadata?: {
    packageType?: string;
    tokenAmount?: number;
    featureName?: string;
    [key: string]: any;
  };
}

export interface AdminActivitySummary {
  type: string;
  count: number;
  lastActivity: Date;
  trend: 'up' | 'down' | 'stable';
  percentage: number;
}

// Activity logging types
export type ActivityType = 
  | 'user_registration'
  | 'user_login'
  | 'user_logout'
  | 'user_approval'
  | 'user_rejection'
  | 'form_creation'
  | 'form_update'
  | 'form_deletion'
  | 'form_submission'
  | 'dashboard_creation'
  | 'dashboard_update'
  | 'dashboard_deletion'
  | 'dashboard_crud'
  | 'package_selection'
  | 'package_change'
  | 'package_renewal'
  | 'token_purchase'
  | 'token_usage'
  | 'chat_activity'
  | 'notification_sent'
  | 'notification_read'
  | 'file_upload'
  | 'file_download'
  | 'admin_login'
  | 'admin_user_creation'
  | 'admin_user_update'
  | 'admin_user_deletion'
  | 'admin_settings_change'
  | 'link_sharing'
  | 'access_granted'
  | 'access_revoked'
  | 'system_error'
  | 'api_call'
  | 'data_export'
  | 'data_import';

export interface ActivityLog {
  id?: string;
  type: ActivityType;
  userId: string;
  userEmail: string;
  userName: string;
  userRole: 'admin' | 'directeur' | 'employe';
  agencyId?: string;
  agencyName?: string;
  description: string;
  metadata?: {
    formId?: string;
    formTitle?: string;
    dashboardId?: string;
    dashboardName?: string;
    packageType?: string;
    tokensUsed?: number;
    tokensPurchased?: number;
    fileSize?: number;
    fileName?: string;
    errorMessage?: string;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
    duration?: number;
    [key: string]: any;
  };
  timestamp: any; // Firestore timestamp
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'authentication' | 'user_management' | 'form_management' | 'dashboard' | 'package' | 'chat' | 'file' | 'notification' | 'system' | 'admin';
}


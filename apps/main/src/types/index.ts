// Types pour l'application multi-agences avec formulaires dynamiques
// Pay-as-you-go purchase tracking
export interface PayAsYouGoPurchase {
  id: string; // Unique purchase ID
  purchaseDate: Date;
  itemType: 'tokens' | 'forms' | 'dashboards' | 'users';
  quantity: number; // Number of items purchased
  amountPaid: number; // Amount paid in FCFA
  paymentMethod?: string;
  notes?: string;
}

// Pay-as-you-go resources available in session
export interface PayAsYouGoResources {
  tokens: number; // Additional tokens purchased
  forms: number; // Additional forms purchased
  dashboards: number; // Additional dashboards purchased
  users: number; // Additional users purchased
  purchases: PayAsYouGoPurchase[]; // Historical purchases
}

// Subscription Session Types
export interface SubscriptionSession {
  id: string; // Unique session ID
  packageType: 'starter' | 'standard' | 'premium' /* | 'custom' */;
  sessionType: 'subscription' | 'upgrade' | 'downgrade' | 'renewal';
  startDate: Date;
  endDate: Date;
  amountPaid: number; // Amount paid for the package in FCFA
  durationDays: number; // Duration in days
  isActive: boolean; // Whether this session is currently active
  paymentMethod?: string; // Payment method used
  paymentReference?: string; // Reference to payment record
  notes?: string; // Additional notes
  createdAt: Date;
  updatedAt: Date;
  
  // Package resources (from the selected package)
  packageResources: {
    tokensIncluded: number; // Tokens included in the package
    formsIncluded: number; // Forms included in the package
    dashboardsIncluded: number; // Dashboards included in the package
    usersIncluded: number; // Users included in the package
  };
  
  // Pay-as-you-go resources (additional purchases)
  payAsYouGoResources?: PayAsYouGoResources;
  
  // Usage tracking per session
  usage?: {
    tokensUsed: number; // Total tokens used in this session
    formsCreated: number; // Total forms created in this session
    dashboardsCreated: number; // Total dashboards created in this session
    usersAdded: number; // Total users added in this session
    lastFormCreated?: Date;
    lastDashboardCreated?: Date;
    lastUserAdded?: Date;
    lastTokenUsed?: Date;
  };
  
  // Alternative consumption tracking (for backward compatibility)
  consumption?: {
    tokensConsumed: number; // Total tokens consumed in this session
    formsCreated: number; // Total forms created in this session
    dashboardsCreated: number; // Total dashboards created in this session
    usersAdded: number; // Total users added in this session
    lastFormCreated?: Date;
    lastDashboardCreated?: Date;
    lastUserAdded?: Date;
    lastTokenUsed?: Date;
  };
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'directeur' | 'employe';
  agencyId: string;
  needsPackageSelection?: boolean; // Flag to indicate if director needs to select a package
  
  // Subscription sessions system - Single source of truth
  subscriptionSessions?: SubscriptionSession[]; // Array of all subscription sessions
  currentSessionId?: string; // ID of the currently active session
  
  // Employee specific fields
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
  
  // Legacy package properties (for backward compatibility)
  package?: 'starter' | 'standard' | 'premium' /* | 'custom' */;
  tokensUsedMonthly?: number;
  tokensResetDate?: Date;
  payAsYouGoTokens?: number;
  payAsYouGoForms?: number;
  payAsYouGoDashboards?: number;
  payAsYouGoUsers?: number;
  payAsYouGoResources?: {
    tokens: number;
    forms: number;
    dashboards: number;
    users: number;
  };
  
  // Timestamps
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
  calculationFormula?: string; // Ex: "field1 + field2 * 0.2" or "SUM(field1, field2) * 0.1" (stored with field IDs)
  userFormula?: string; // User-friendly formula with field names (ex: "prix * quantité + frais")
  dependsOn?: string[]; // IDs of fields this field depends on
  calculationType?: 'simple' | 'percentage' | 'average' | 'sum' | 'multiply' | 'custom';
  constantValue?: number; // For percentage calculations or custom constants
  // Conditional logic properties
  conditionalLogic?: {
    isEnabled: boolean;
    action: 'show' | 'hide'; // Action to take when conditions are met
    operator: 'and' | 'or'; // How to combine multiple conditions
    conditions: ConditionalRule[];
  };
}

export interface ConditionalRule {
  id: string;
  fieldId: string; // ID of the field to check
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'greater_equal' | 'less_equal' | 'is_empty' | 'is_not_empty';
  value?: string | number | boolean; // Value to compare against (not needed for is_empty/is_not_empty)
  fieldType?: 'text' | 'number' | 'email' | 'textarea' | 'select' | 'checkbox' | 'date'; // Type of the field being checked
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
  deadline?: {
    date: string; // ISO date string
    time: string; // HH:MM format
    timezone?: string; // Default to user timezone
  };
  notificationSettings?: {
    reminderIntervals: number[]; // [60, 30, 15] minutes before deadline
    enabled: boolean;
  };
  // Univers fields (optional - for Univers template system)
  universId?: string | null; // Reference to Univers template if created from template
  universInstanceId?: string | null; // Reference to Univers instance group
  fromUnivers?: boolean; // Flag to identify Univers-originated items
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
  submissionId?: string; // Store submission ID for background formatting
  base64Data?: string; // Store file as base64 for draft storage
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

export interface ScheduledNotification {
  id: string;
  type: 'form_reminder' | 'form_assignment' | 'daily_report';
  userId: string;
  formId?: string;
  scheduledFor: Date;
  title: string;
  body: string;
  data?: Record<string, any>;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  attempts: number;
  createdAt: Date;
  sentAt?: Date;
}

// One-off metric reminder for director dashboards
export interface MetricReminder {
  id: string;
  agencyId: string;
  directorId: string; // creator/recipient
  dashboardId: string;
  metricId: string; // references DashboardMetric.id
  // Scheduling
  scheduledAt: Date; // next occurrence for the reminder
  frequency: 'daily' | 'weekly' | 'monthly'; // how often to send the reminder
  time: string; // HH:MM format - when to send the reminder
  timezone?: string; // IANA timezone
  note?: string;
  // Status & bookkeeping
  status: 'pending' | 'sent' | 'cancelled' | 'failed';
  lastEvaluatedAt?: Date;
  sentAt?: Date;
  // Dedup key for safety (metricId + scheduledAt UTC minutes)
  dedupKey?: string;
  createdAt: Date;
  createdBy: string; // directorId
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
  isLoading?: boolean;
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
  summary?: {
    content: string;           // Generated summary text
    lastUpdated: Date;         // When summary was last generated
    messageCountAtSummary: number; // Message count when summary was created
    keyTopics: string[];       // Extracted key topics
    directorPreferences: {     // Learned preferences
      preferredFormats: string[];
      commonPeriods: string[];
      frequentForms: string[];
    };
  };
}

// Types pour les questions programmées
export interface ScheduledQuestion {
  id: string;
  userId: string;
  agencyId: string;
  
  // Question et configuration
  question: string;
  title: string;
  description?: string;
  filters: {
    period: string;
    formId: string;
    userId: string;
  };
  selectedFormat: string | null;
  selectedFormats: string[];
  selectedFormIds: string[];
  
  // Programmation
  scheduledAt: Date;
  frequency: 'once' | 'daily' | 'weekly' | 'monthly';
  nextExecution?: Date;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  
  // Métadonnées
  createdAt: Date;
  lastExecutedAt?: Date;
  executionCount: number;
  maxExecutions?: number;
  // Univers fields (optional - for Univers template system)
  universId?: string | null; // Reference to Univers template if created from template
  universInstanceId?: string | null; // Reference to Univers instance group
  fromUnivers?: boolean; // Flag to identify Univers-originated items
}

export interface ScheduledQuestionResponse {
  id: string;
  scheduledQuestionId: string;
  response: string;
  executedAt: Date;
  responseTime: number;
  tokensUsed: number;
  status: 'success' | 'error';
  errorMessage?: string;
  meta: {
    period?: string;
    usedEntries?: number;
    forms?: number;
    users?: number;
    model?: string;
    selectedFormat?: string;
    selectedFormats?: string[];
    selectedFormIds?: string[];
    selectedFormTitles?: string[];
  };
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
  // Univers fields (optional - for Univers template system)
  universId?: string | null; // Reference to Univers template if created from template
  universInstanceId?: string | null; // Reference to Univers instance group
  fromUnivers?: boolean; // Flag to identify Univers-originated items
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
  // Subscription sessions for package determination
  subscriptionSessions?: SubscriptionSession[];
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
  package?: 'starter' | 'standard' | 'premium' /* | 'custom' */;
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
  totalFormCount: number;
  totalTokenUsage: number;
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

export interface FormSubmissionRecord {
  id: string;
  userId: string;
  formId: string;
  formName: string;
  submittedAt: Date;
  status: 'completed' | 'pending' | 'rejected';
  data: Record<string, any>;
  isActive: boolean;
  duration: number; // in seconds
  pagesVisited: number;
  actionsPerformed: number;
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

// Report Types for Univers system
export interface ReportPlaceholder {
  id: string;
  placeholder: string; // Ex: "{{formName}}", "{{totalRevenue}}"
  position: number; // Position dans le document (pour référence)
  type: 'form_field' | 'dashboard_metric' | 'calculated' | 'static';
  description?: string; // Description de ce que représente le placeholder
}

export type StaticValueType = 
  | 'agency_name'
  | 'agency_id'
  | 'user_email'
  | 'user_name'
  | 'user_id'
  | 'current_date'
  | 'current_time'
  | 'current_datetime'
  | 'report_generation_date'
  | 'report_generation_time';

export interface ReportMapping {
  placeholderId: string; // ID du placeholder
  sourceType: 'dashboard' | 'static'; // Dashboard metrics or static system values
  sourceId?: string; // ID du dashboard (only if sourceType is 'dashboard')
  metricId?: string; // ID de la métrique (only if sourceType is 'dashboard')
  metricType?: 'value' | 'graph' | 'table'; // Type de métrique pour le rendu (only if sourceType is 'dashboard')
  staticValueType?: StaticValueType; // Type de valeur statique (only if sourceType is 'static')
  defaultValue?: string; // Valeur par défaut si pas de données
}

export interface Report {
  id: string;
  name: string;
  description?: string;
  templateType: 'pdf' | 'word' | 'text';
  templateContent?: string; // Contenu texte du template (pour text type)
  templateFileUrl?: string; // URL du fichier template (pour PDF/Word)
  templateFileStoragePath?: string; // Chemin de stockage du fichier
  templateFileName?: string; // Nom du fichier template
  placeholders: ReportPlaceholder[]; // Liste des placeholders détectés
  mappings: ReportMapping[]; // Mappings des placeholders vers les sources de données
  createdAt: Date;
  createdBy: string; // directeur ID
  createdByRole: 'directeur' | 'employe';
  createdByEmployeeId?: string;
  agencyId: string;
  // Univers fields (optional - for Univers template system)
  universId?: string | null;
  universInstanceId?: string | null;
  fromUnivers?: boolean;
  updatedAt?: Date;
}

export interface ReportDefinition {
  id: string;
  name: string;
  description?: string;
  templateType: 'pdf' | 'word' | 'text';
  templateContent?: string;
  templateFileUrl?: string;
  templateFileStoragePath?: string;
  templateFileName?: string;
  placeholders: ReportPlaceholder[];
  mappings: ReportMapping[];
}

// Types pour le système Univers (Univer Ubora)
export interface UniversMetadata {
  name: string;
  description?: string;
  iconUrl?: string;
  category?: string;
  tags?: string[];
  version: number;
  createdAt: Date;
  publishOption?: 'private' | 'agency' | 'marketplace'; // Temporary field for wizard
}

export interface UniversOwnership {
  createdBy: string; // userId du directeur
  agencyId?: string; // undefined/null pour privé, agencyId pour partagé avec agence
  isMarketplaceTemplate: boolean; // true si publié sur marketplace
  approvalStatus?: 'pending' | 'approved' | 'rejected'; // Pour marketplace templates
  approvedBy?: string; // Admin ID qui a approuvé
  approvedAt?: Date; // Date d'approbation
  rejectionReason?: string; // Raison du rejet si rejected
}

export interface UniversUsage {
  totalUsages: number; // Nombre de fois que le template a été utilisé
  lastUsedAt?: Date; // Dernière utilisation
}

// Types pour les définitions Univers (templates)
export interface FormDefinition {
  id: string;
  title: string;
  description: string;
  fields: FormField[];
}

export interface DashboardDefinition {
  id: string;
  name: string;
  description?: string;
  metrics: DashboardMetric[];
}

export interface InstructionDefinition {
  id: string;
  title: string;
  description?: string;
  question: string;
  filters: {
    period: string;
    formId: string;
    userId: string;
  };
  selectedFormat: string | null;
  selectedFormats: string[];
  selectedFormIds: string[];
  scheduledAt: Date;
  frequency: 'once' | 'daily' | 'weekly' | 'monthly';
  maxExecutions?: number;
}

export interface UniversDefinitions {
  forms: FormDefinition[];
  dashboards: DashboardDefinition[];
  instructions: InstructionDefinition[];
  lists: any[]; // Will be defined in Phase 2
  reports: ReportDefinition[]; // Reports definitions
}

export interface Univers {
  id: string;
  metadata: UniversMetadata;
  ownership: UniversOwnership;
  definitions: UniversDefinitions;
  usage: UniversUsage;
}


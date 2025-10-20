// Configuration des fonctionnalités par package UBORA
// Basé sur les spécifications du fichier PACKAGES.md

export type PackageType = 'free' | 'starter' | 'standard';

export interface PackageLimits {
  maxForms: number;
  maxDashboards: number;
  maxUsers: number;
  monthlyTokens: number;
  additionalUserCost: number; // en FCFA
  programmedInstructions: number; // Number of programmed instructions
  automatedPushIndicators: number; // Number of automated push indicators (-1 for unlimited)
}

export interface PackageFeatures {
  // Fonctionnalités de base
  basicForms: boolean;
  unlimitedForms: boolean;
  basicDashboard: boolean;
  unlimitedDashboards: boolean;
  basicMetrics: boolean;
  advancedMetrics: boolean;
  
  // Fonctionnalités IA
  basicAI: boolean;
  advancedAI: boolean;
  predictiveAI: boolean;
  customIntegrations: boolean;
  
  // Fonctionnalités d'export
  pdfExport: boolean;
  excelExport: boolean;
  
  // Fonctionnalités de communication
  pushNotifications: boolean;
  whatsappSupport: boolean;
  onSiteSupport: boolean;
  
  // Fonctionnalités avancées de communication
  pushIndicators: boolean;
  formFillNotifications: boolean;
  
  // Fonctionnalités d'import
  fileImport: boolean;
  
  // Fonctionnalités de branding
  customBranding: boolean;
  
  // Fonctionnalités d'hébergement
  sharedHosting: boolean;
  dedicatedHosting: boolean;
  
  // Fonctionnalités avancées
  customWorkflows: boolean;
  externalConnectors: boolean;
  teamTraining: boolean;
}

export const PACKAGE_LIMITS: Record<PackageType, PackageLimits> = {
  free: {
    maxForms: 2, // 2 forms in free package
    maxDashboards: 1, // 1 reduced dashboard
    maxUsers: -1, // Unlimited users
    monthlyTokens: 25000, // 25k tokens
    additionalUserCost: 0,
    programmedInstructions: 0, // No programmed instructions
    automatedPushIndicators: 0 // No automated push indicators
  },
  starter: {
    maxForms: 4, // 4 forms
    maxDashboards: 2, // 2 dynamic dashboards
    maxUsers: -1, // Unlimited users
    monthlyTokens: 100000, // 100k tokens
    additionalUserCost: 0, // No additional user cost mentioned
    programmedInstructions: 1, // 1 programmed instruction
    automatedPushIndicators: 1 // 1 automated push indicator
  },
  standard: {
    maxForms: -1, // Unlimited forms
    maxDashboards: -1, // Unlimited dashboards
    maxUsers: -1, // Unlimited users
    monthlyTokens: 300000, // 300k tokens
    additionalUserCost: 0, // No additional user cost mentioned
    programmedInstructions: 4, // 4 programmed instructions
    automatedPushIndicators: -1 // Unlimited automated push indicators
  }
};

export const PACKAGE_FEATURES: Record<PackageType, PackageFeatures> = {
  free: {
    // Fonctionnalités de base
    basicForms: true, // 2 forms in free package
    unlimitedForms: false,
    basicDashboard: true, // 1 reduced dashboard
    unlimitedDashboards: false,
    basicMetrics: true,
    advancedMetrics: false,
    
    // Fonctionnalités IA
    basicAI: true, // Basic AI with limited tokens
    advancedAI: false,
    predictiveAI: false,
    customIntegrations: false,
    
    // Fonctionnalités d'export
    pdfExport: true, // PDF export available
    excelExport: false, // No Excel export in free
    
    // Fonctionnalités de communication
    pushNotifications: true, // Automatic reminder notifications
    whatsappSupport: false,
    onSiteSupport: false,
    
    // Fonctionnalités avancées de communication
    pushIndicators: false,
    formFillNotifications: true, // Available to all packages
    
    // Fonctionnalités d'import
    fileImport: false,
    
    // Fonctionnalités de branding
    customBranding: false,
    
    // Fonctionnalités d'hébergement
    sharedHosting: true,
    dedicatedHosting: false,
    
    // Fonctionnalités avancées
    customWorkflows: false,
    externalConnectors: false,
    teamTraining: false
  },
  starter: {
    // Fonctionnalités de base
    basicForms: true,
    unlimitedForms: false, // Limited to 4 forms
    basicDashboard: true,
    unlimitedDashboards: false, // Limited to 2 dashboards
    basicMetrics: true,
    advancedMetrics: true, // Dynamic dashboards
    
    // Fonctionnalités IA
    basicAI: true,
    advancedAI: true, // More tokens and features
    predictiveAI: false,
    customIntegrations: false,
    
    // Fonctionnalités d'export
    pdfExport: true,
    excelExport: true,
    
    // Fonctionnalités de communication
    pushNotifications: true, // Automatic reminder notifications
    whatsappSupport: false,
    onSiteSupport: false,
    
    // Fonctionnalités avancées de communication
    pushIndicators: true, // Available to Starter and Standard
    formFillNotifications: true, // Available to all packages
    
    // Fonctionnalités d'import
    fileImport: true, // Available to Starter and Standard
    
    // Fonctionnalités de branding
    customBranding: false,
    
    // Fonctionnalités d'hébergement
    sharedHosting: true,
    dedicatedHosting: false,
    
    // Fonctionnalités avancées
    customWorkflows: false,
    externalConnectors: false,
    teamTraining: false
  },
  standard: {
    // Fonctionnalités de base
    basicForms: true,
    unlimitedForms: true,
    basicDashboard: true,
    unlimitedDashboards: true, // Unlimited dashboards
    basicMetrics: true,
    advancedMetrics: true,
    
    // Fonctionnalités IA
    basicAI: true,
    advancedAI: true,
    predictiveAI: false,
    customIntegrations: true,
    
    // Fonctionnalités d'export
    pdfExport: true,
    excelExport: true, // PDF and Excel reports
    
    // Fonctionnalités de communication
    pushNotifications: true, // Automatic reminder notifications
    whatsappSupport: true,
    onSiteSupport: false,
    
    // Fonctionnalités avancées de communication
    pushIndicators: true, // Available to Starter and Standard
    formFillNotifications: true, // Available to all packages
    
    // Fonctionnalités d'import
    fileImport: true, // Available to Starter and Standard
    
    // Fonctionnalités de branding
    customBranding: false,
    
    // Fonctionnalités d'hébergement
    sharedHosting: true,
    dedicatedHosting: false,
    
    // Fonctionnalités avancées
    customWorkflows: false,
    externalConnectors: false,
    teamTraining: false
  }
};

// Fonction utilitaire pour vérifier si un package a accès à une fonctionnalité
export const hasPackageFeature = (packageType: PackageType, feature: keyof PackageFeatures): boolean => {
  return PACKAGE_FEATURES[packageType][feature];
};

// Fonction utilitaire pour vérifier les limites d'un package
export const getPackageLimit = (packageType: PackageType, limit: keyof PackageLimits): number => {
  return PACKAGE_LIMITS[packageType][limit];
};

// Fonction utilitaire pour vérifier si un package a une limite illimitée
export const isUnlimited = (packageType: PackageType, limit: keyof PackageLimits): boolean => {
  return getPackageLimit(packageType, limit) === -1;
};

// Fonction utilitaire pour obtenir le nom d'affichage d'un package
export const getPackageDisplayName = (packageType: PackageType): string => {
  const names: Record<PackageType, string> = {
    free: 'UBORA Gratuit',
    starter: 'UBORA Starter',
    standard: 'UBORA Standard'
  };
  return names[packageType];
};

// Fonction utilitaire pour obtenir le prix d'un package
export const getPackagePrice = (packageType: PackageType): string => {
  const prices: Record<PackageType, string> = {
    free: '0 FCFA/mois',
    starter: '12 900 FCFA/mois',
    standard: '35 000 FCFA/mois'
  };
  return prices[packageType];
};

// Fonction utilitaire pour obtenir le prix numérique d'un package
export const getPackagePriceNumeric = (packageType: PackageType): number => {
  const prices: Record<PackageType, number> = {
    free: 0,
    starter: 12900,
    standard: 35000
  };
  return prices[packageType];
};
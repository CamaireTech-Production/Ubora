// Configuration des fonctionnalités par package UBORA
// Basé sur les spécifications du fichier PACKAGES.md

export type PackageType = 'starter' | 'standard' | 'premium' | 'custom';

export interface PackageLimits {
  maxForms: number;
  maxDashboards: number;
  maxUsers: number;
  monthlyTokens: number;
  additionalUserCost: number; // en FCFA
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
  starter: {
    maxForms: 4,
    maxDashboards: 1,
    maxUsers: 3,
    monthlyTokens: 300000, // 300k tokens (300 actual OpenAI tokens = ~10 requests/day)
    additionalUserCost: 10000
  },
  standard: {
    maxForms: -1, // illimité
    maxDashboards: -1, // illimité
    maxUsers: 7,
    monthlyTokens: 600000, // 600k tokens (600 actual OpenAI tokens = ~20 requests/day)
    additionalUserCost: 7000
  },
  premium: {
    maxForms: -1, // illimité
    maxDashboards: -1, // illimité
    maxUsers: 20,
    monthlyTokens: 1500000, // 1.5M tokens (1,500 actual OpenAI tokens = ~50 requests/day)
    additionalUserCost: 7000
  },
  custom: {
    maxForms: -1, // illimité
    maxDashboards: -1, // illimité
    maxUsers: -1, // illimité
    monthlyTokens: -1, // négociable
    additionalUserCost: 0 // négociable
  }
};

export const PACKAGE_FEATURES: Record<PackageType, PackageFeatures> = {
  starter: {
    // Fonctionnalités de base
    basicForms: true,
    unlimitedForms: false,
    basicDashboard: true,
    unlimitedDashboards: false,
    basicMetrics: true,
    advancedMetrics: false,
    
    // Fonctionnalités IA
    basicAI: true,
    advancedAI: false,
    predictiveAI: false,
    customIntegrations: false,
    
    // Fonctionnalités d'export
    pdfExport: true,
    excelExport: true,
    
    // Fonctionnalités de communication
    pushNotifications: false,
    whatsappSupport: false,
    onSiteSupport: false,
    
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
    unlimitedDashboards: true,
    basicMetrics: true,
    advancedMetrics: true,
    
    // Fonctionnalités IA
    basicAI: true,
    advancedAI: true,
    predictiveAI: false,
    customIntegrations: false,
    
    // Fonctionnalités d'export
    pdfExport: true,
    excelExport: true,
    
    // Fonctionnalités de communication
    pushNotifications: true,
    whatsappSupport: false,
    onSiteSupport: false,
    
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
  premium: {
    // Fonctionnalités de base
    basicForms: true,
    unlimitedForms: true,
    basicDashboard: true,
    unlimitedDashboards: true,
    basicMetrics: true,
    advancedMetrics: true,
    
    // Fonctionnalités IA
    basicAI: true,
    advancedAI: true,
    predictiveAI: true,
    customIntegrations: false,
    
    // Fonctionnalités d'export
    pdfExport: true,
    excelExport: true,
    
    // Fonctionnalités de communication
    pushNotifications: true,
    whatsappSupport: true,
    onSiteSupport: false,
    
    // Fonctionnalités de branding
    customBranding: true,
    
    // Fonctionnalités d'hébergement
    sharedHosting: true,
    dedicatedHosting: false,
    
    // Fonctionnalités avancées
    customWorkflows: false,
    externalConnectors: false,
    teamTraining: false
  },
  custom: {
    // Fonctionnalités de base
    basicForms: true,
    unlimitedForms: true,
    basicDashboard: true,
    unlimitedDashboards: true,
    basicMetrics: true,
    advancedMetrics: true,
    
    // Fonctionnalités IA
    basicAI: true,
    advancedAI: true,
    predictiveAI: true,
    customIntegrations: true,
    
    // Fonctionnalités d'export
    pdfExport: true,
    excelExport: true,
    
    // Fonctionnalités de communication
    pushNotifications: true,
    whatsappSupport: true,
    onSiteSupport: true,
    
    // Fonctionnalités de branding
    customBranding: true,
    
    // Fonctionnalités d'hébergement
    sharedHosting: false,
    dedicatedHosting: true,
    
    // Fonctionnalités avancées
    customWorkflows: true,
    externalConnectors: true,
    teamTraining: true
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
    starter: 'Starter',
    standard: 'Standard',
    premium: 'Premium',
    custom: 'Sur mesure'
  };
  return names[packageType];
};

// Fonction utilitaire pour obtenir le prix d'un package
export const getPackagePrice = (packageType: PackageType): string => {
  const prices: Record<PackageType, string> = {
    starter: '35 000 FCFA/mois',
    standard: '85 000 FCFA/mois',
    premium: '160 000 FCFA/mois',
    custom: 'À partir de 250 000 FCFA/mois'
  };
  return prices[packageType];
};

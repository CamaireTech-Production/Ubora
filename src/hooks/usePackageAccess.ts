import { useAuth } from '../contexts/AuthContext';
import { UserSessionService } from '../services/userSessionService';
import { 
  hasPackageFeature, 
  getPackageLimit, 
  isUnlimited, 
  PackageType, 
  PackageFeatures, 
  PackageLimits 
} from '../config/packageFeatures';

// Hook principal pour vérifier l'accès aux fonctionnalités
export const usePackageAccess = () => {
  const { user } = useAuth();

  // Get current package info from active session
  const getCurrentPackageInfo = () => {
    if (!user) return null;
    return UserSessionService.getUserPackageInfo(user);
  };

  const packageInfo = getCurrentPackageInfo();
  const currentPackageType = packageInfo?.packageType || null;

  // Vérifier si l'utilisateur a accès à une fonctionnalité spécifique
  const hasFeature = (feature: keyof PackageFeatures): boolean => {
    if (!user) return false;
    return UserSessionService.hasFeature(user, feature);
  };

  // Vérifier si l'utilisateur respecte une limite spécifique (incluant pay-as-you-go)
  const checkLimit = (limit: keyof PackageLimits, currentValue: number): boolean => {
    if (!user) return false;
    
    const limits = UserSessionService.getPackageLimits(user);
    const limitValue = limits[limit];
    
    // Si la limite est illimitée (-1), toujours autoriser
    if (limitValue === -1) {
      return true;
    }
    
    return currentValue < limitValue;
  };

  // Obtenir la valeur d'une limite
  const getLimit = (limit: keyof PackageLimits): number => {
    if (!user) return 0;
    const limits = UserSessionService.getPackageLimits(user);
    return limits[limit];
  };

  // Vérifier si une limite est illimitée
  const isLimitUnlimited = (limit: keyof PackageLimits): boolean => {
    if (!user) return false;
    const limits = UserSessionService.getPackageLimits(user);
    return limits[limit] === -1;
  };

  // Obtenir le type de package de l'utilisateur
  const getPackageType = (): PackageType | null => {
    return currentPackageType;
  };

  // Vérifier si l'utilisateur peut créer un nouveau formulaire
  const canCreateForm = (currentFormCount: number): boolean => {
    if (!user) return false;
    return UserSessionService.canPerformAction(user, 'createForm', currentFormCount);
  };

  // Vérifier si l'utilisateur peut créer un nouveau tableau de bord
  const canCreateDashboard = (currentDashboardCount: number): boolean => {
    if (!user) return false;
    return UserSessionService.canPerformAction(user, 'createDashboard', currentDashboardCount);
  };

  // Vérifier si l'utilisateur peut ajouter un nouvel utilisateur
  const canAddUser = (currentUserCount: number): boolean => {
    if (!user) return false;
    return UserSessionService.canPerformAction(user, 'addUser', currentUserCount);
  };

  // Obtenir le nombre de tokens mensuels disponibles
  const getMonthlyTokens = (): number => {
    if (!user) return 0;
    const limits = UserSessionService.getPackageLimits(user);
    return limits.monthlyTokens;
  };

  // Vérifier si l'utilisateur a des tokens illimités
  const hasUnlimitedTokens = (): boolean => {
    if (!user) return false;
    const limits = UserSessionService.getPackageLimits(user);
    return limits.monthlyTokens === -1;
  };

  // Vérifier si l'utilisateur peut utiliser une fonctionnalité IA avancée
  const canUseAdvancedAI = (): boolean => {
    return hasFeature('advancedAI') || hasFeature('predictiveAI');
  };

  // Vérifier si l'utilisateur peut utiliser le branding personnalisé
  const canUseCustomBranding = (): boolean => {
    return hasFeature('customBranding');
  };

  // Vérifier si l'utilisateur peut utiliser les intégrations personnalisées
  const canUseCustomIntegrations = (): boolean => {
    return hasFeature('customIntegrations');
  };

  // Obtenir le coût d'un utilisateur supplémentaire
  const getAdditionalUserCost = (): number => {
    return getLimit('additionalUserCost');
  };

  // Obtenir la capacité pay-as-you-go pour un type de limite
  const getPayAsYouGoCapacity = (limit: keyof PackageLimits): number => {
    if (!user) return 0;
    
    // For tokens, get from pay-as-you-go sessions
    if (limit === 'monthlyTokens') {
      return UserSessionService.getTotalPayAsYouGoTokens(user);
    }
    
    // For other limits, we don't have pay-as-you-go capacity in the new system
    return 0;
  };

  // Obtenir la limite totale (package + pay-as-you-go)
  const getTotalLimit = (limit: keyof PackageLimits): number => {
    const packageLimit = getLimit(limit);
    if (packageLimit === -1) return -1; // Unlimited
    
    const payAsYouGoCapacity = getPayAsYouGoCapacity(limit);
    return packageLimit + payAsYouGoCapacity;
  };

  return {
    // Fonctions de base
    hasFeature,
    checkLimit,
    getLimit,
    isLimitUnlimited,
    getPackageType,
    
    // Fonctions spécifiques aux formulaires
    canCreateForm,
    canCreateDashboard,
    canAddUser,
    
    // Fonctions spécifiques aux tokens
    getMonthlyTokens,
    hasUnlimitedTokens,
    
    // Fonctions spécifiques aux fonctionnalités
    canUseAdvancedAI,
    canUseCustomBranding,
    canUseCustomIntegrations,
    
    // Fonctions de coût
    getAdditionalUserCost,
    
    // Fonctions pay-as-you-go
    getPayAsYouGoCapacity,
    getTotalLimit,
    
    // Informations sur l'utilisateur
    user,
    packageType: currentPackageType,
    packageInfo: packageInfo
  };
};

// Hook simplifié pour vérifier une fonctionnalité spécifique
export const useFeatureAccess = (feature: keyof PackageFeatures) => {
  const { hasFeature } = usePackageAccess();
  return hasFeature(feature);
};

// Hook pour vérifier les limites
export const usePackageLimits = () => {
  const { checkLimit, getLimit, isLimitUnlimited } = usePackageAccess();
  
  return {
    checkLimit,
    getLimit,
    isLimitUnlimited
  };
};

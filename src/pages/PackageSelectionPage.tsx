import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { 
  getPackageDisplayName, 
  getPackagePrice, 
  PACKAGE_LIMITS, 
  PACKAGE_FEATURES,
  PackageType 
} from '../config/packageFeatures';
import { 
  Check, 
  X, 
  Star, 
  Crown, 
  Zap, 
  Shield,
  Users,
  BarChart3,
  Brain,
  ArrowRight,
  CheckCircle
} from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { Toast } from '../components/Toast';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { AnalyticsService } from '../services/analyticsService';

export const PackageSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast, showSuccess, showError } = useToast();
  const [selectedPackage, setSelectedPackage] = useState<PackageType | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const packages: PackageType[] = ['starter', 'standard', 'premium', 'custom'];

  const getPackageIcon = (pkg: PackageType) => {
    switch (pkg) {
      case 'starter': return <Zap className="h-6 w-6" />;
      case 'standard': return <Star className="h-6 w-6" />;
      case 'premium': return <Crown className="h-6 w-6" />;
      case 'custom': return <Shield className="h-6 w-6" />;
    }
  };

  const getPackageColor = (pkg: PackageType) => {
    switch (pkg) {
      case 'starter': return 'text-blue-600 bg-blue-100';
      case 'standard': return 'text-green-600 bg-green-100';
      case 'premium': return 'text-purple-600 bg-purple-100';
      case 'custom': return 'text-orange-600 bg-orange-100';
    }
  };

  const getFeatureIcon = (feature: boolean) => {
    return feature ? (
      <Check className="h-4 w-4 text-green-500" />
    ) : (
      <X className="h-4 w-4 text-gray-300" />
    );
  };

  const handlePackageSelection = async (pkg: PackageType) => {
    if (!user) {
      showError('Utilisateur non connecté');
      return;
    }

    setSelectedPackage(pkg);
    setIsProcessing(true);

    try {
      // Mettre à jour le package de l'utilisateur dans Firestore
      const userDocRef = doc(db, 'users', user.id);
      await updateDoc(userDocRef, {
        package: pkg,
        needsPackageSelection: false, // Clear the flag
        tokensUsedMonthly: 0,
        tokensResetDate: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Track package selection analytics
      try {
        await AnalyticsService.logPackageSelection(user.id, pkg, user.agencyId);
      } catch (analyticsError) {
        console.warn('Failed to track package selection analytics:', analyticsError);
      }

      showSuccess(`Package ${getPackageDisplayName(pkg)} sélectionné avec succès !`);
      
      // Rediriger vers le dashboard après un court délai
      setTimeout(() => {
        navigate('/directeur/dashboard');
      }, 1500);

    } catch (error) {
      console.error('Erreur lors de la sélection du package:', error);
      showError('Erreur lors de la sélection du package. Veuillez réessayer.');
    } finally {
      setIsProcessing(false);
    }
  };

  const getFeatureList = (pkg: PackageType) => {
    const features = PACKAGE_FEATURES[pkg];
    const limits = PACKAGE_LIMITS[pkg];
    
    return [
      {
        name: 'Formulaires',
        value: limits.maxForms === -1 ? 'Illimités' : `${limits.maxForms} formulaires`,
        icon: <BarChart3 className="h-4 w-4" />
      },
      {
        name: 'Tableaux de bord',
        value: limits.maxDashboards === -1 ? 'Illimités' : `${limits.maxDashboards} tableaux`,
        icon: <BarChart3 className="h-4 w-4" />
      },
      {
        name: 'Utilisateurs',
        value: limits.maxUsers === -1 ? 'Illimités' : `${limits.maxUsers} utilisateurs`,
        icon: <Users className="h-4 w-4" />
      },
      {
        name: 'Tokens ARCHA mensuels',
        value: limits.monthlyTokens === -1 ? 'Illimités' : `${limits.monthlyTokens.toLocaleString()} tokens`,
        icon: <Brain className="h-4 w-4" />
      },
      {
        name: 'IA Avancée',
        value: features.advancedAI ? 'Incluse' : 'Non incluse',
        icon: getFeatureIcon(features.advancedAI)
      },
      {
        name: 'IA Prédictive',
        value: features.predictiveAI ? 'Incluse' : 'Non incluse',
        icon: getFeatureIcon(features.predictiveAI)
      },
      {
        name: 'Notifications Push',
        value: features.pushNotifications ? 'Incluse' : 'Non incluse',
        icon: getFeatureIcon(features.pushNotifications)
      },
      {
        name: 'Support WhatsApp',
        value: features.whatsappSupport ? 'Incluse' : 'Non incluse',
        icon: getFeatureIcon(features.whatsappSupport)
      },
      {
        name: 'Branding personnalisé',
        value: features.customBranding ? 'Incluse' : 'Non incluse',
        icon: getFeatureIcon(features.customBranding)
      }
    ];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-4">
        {/* En-tête */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Bienvenue sur Ubora !
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Choisissez le package qui correspond le mieux à vos besoins pour commencer à analyser vos données avec ARCHA.
          </p>
        </div>

        {/* Grille des packages */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {packages.map((pkg) => (
            <Card 
              key={pkg} 
              className={`relative transition-all duration-300 hover:shadow-xl transform hover:-translate-y-1 ${
                selectedPackage === pkg 
                  ? 'ring-2 ring-blue-500 shadow-xl scale-105' 
                  : 'hover:shadow-lg'
              }`}
            >
              {/* Badge populaire pour Standard */}
              {pkg === 'standard' && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                  <span className="bg-green-500 text-white text-sm px-4 py-2 rounded-full font-semibold shadow-lg">
                    Populaire
                  </span>
                </div>
              )}

              {/* En-tête du package */}
              <div className="text-center mb-6 pt-2">
                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${getPackageColor(pkg)}`}>
                  {getPackageIcon(pkg)}
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {getPackageDisplayName(pkg)}
                </h3>
                <p className="text-3xl font-bold text-blue-600 mb-2">
                  {getPackagePrice(pkg)}
                </p>
                {pkg === 'custom' && (
                  <p className="text-base text-gray-500">
                    Prix négociable selon vos besoins
                  </p>
                )}
              </div>

              {/* Liste des fonctionnalités */}
              <div className="space-y-3 mb-6">
                {getFeatureList(pkg).map((feature, index) => (
                  <div key={index} className="flex items-center justify-between py-2">
                    <div className="flex items-center space-x-3">
                      {feature.icon}
                      <span className="text-base text-gray-700 font-medium">{feature.name}</span>
                    </div>
                    <span className="text-base font-semibold text-gray-900">
                      {feature.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Bouton de sélection */}
              <Button
                onClick={() => handlePackageSelection(pkg)}
                disabled={isProcessing}
                className={`w-full py-3 text-base font-semibold ${
                  pkg === 'standard' 
                    ? 'bg-green-600 hover:bg-green-700 text-white' 
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {isProcessing && selectedPackage === pkg ? (
                  <div className="flex items-center justify-center space-x-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Sélection en cours...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-3">
                    <span>Choisir ce package</span>
                    <ArrowRight className="h-5 w-5" />
                  </div>
                )}
              </Button>
            </Card>
          ))}
        </div>

        {/* Informations supplémentaires */}
        <Card className="bg-blue-50 border-blue-200">
          <div className="flex items-start space-x-4 p-4">
            <CheckCircle className="h-6 w-6 text-blue-600 mt-1 flex-shrink-0" />
            <div>
              <h3 className="text-lg font-semibold text-blue-900 mb-2">
                Vous pouvez changer de package à tout moment
              </h3>
              <p className="text-base text-blue-800">
                Votre sélection n'est pas définitive. Vous pourrez modifier votre package depuis votre tableau de bord 
                selon l'évolution de vos besoins.
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Toast pour les notifications */}
      <Toast />
    </div>
  );
};

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePackageAccess } from '../hooks/usePackageAccess';
import { TokenService } from '../services/tokenService';
import { Layout } from '../components/Layout';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
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
  ArrowLeft,
  CreditCard,
  Shield,
  Users,
  BarChart3,
  Brain,
  Palette
} from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { Toast } from '../components/Toast';

export const PackagesPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { packageType, getMonthlyTokens, hasUnlimitedTokens } = usePackageAccess();
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

  const handleUpgrade = async (pkg: PackageType) => {
    if (pkg === packageType) {
      showError('Vous avez déjà ce package !');
      return;
    }

    if (!user) {
      showError('Utilisateur non connecté');
      return;
    }

    setSelectedPackage(pkg);
    setIsProcessing(true);

    try {
      // Simulation de paiement
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mettre à jour le package dans Firestore
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, {
        package: pkg,
        updatedAt: new Date()
      });
      
      showSuccess(`Package ${getPackageDisplayName(pkg)} activé avec succès !`);
      
      // Recharger la page pour refléter les changements
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      
    } catch (error) {
      console.error('Erreur lors du changement de package:', error);
      showError('Erreur lors du changement de package. Veuillez réessayer.');
    } finally {
      setIsProcessing(false);
      setSelectedPackage(null);
    }
  };

  const formatLimit = (limit: number) => {
    return limit === -1 ? 'Illimité' : limit.toString();
  };

  return (
    <Layout title="Packages UBORA">
      <div className="max-w-6xl mx-auto space-y-8 px-4">
        {/* En-tête avec infos utilisateur */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Choisissez votre package UBORA
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-6">
            Sélectionnez le package qui correspond le mieux à vos besoins. 
            Vous pouvez changer de package à tout moment.
          </p>
          
          {/* Informations utilisateur */}
          {user && (
            <Card className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 max-w-lg mx-auto">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Votre compte</h3>
                
                <div className="space-y-3 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Nom:</span>
                    <span className="text-sm font-semibold text-gray-900">{user.name}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Email:</span>
                    <span className="text-sm text-gray-700">{user.email}</span>
                  </div>
                  
                  {user.package && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-600">Package actuel:</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          packageType === 'starter' 
                            ? 'bg-blue-100 text-blue-800'
                            : packageType === 'standard'
                            ? 'bg-green-100 text-green-800'
                            : packageType === 'premium'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-orange-100 text-orange-800'
                        }`}>
                          {getPackageDisplayName(packageType || 'starter')}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-600">Tokens restants:</span>
                        <span className="text-sm font-semibold text-green-600">
                          {(() => {
                            const monthlyLimit = getMonthlyTokens();
                            const isUnlimited = hasUnlimitedTokens();
                            const remainingTokens = TokenService.getRemainingTokens(user, monthlyLimit);
                            return isUnlimited ? 'Illimités' : remainingTokens.toLocaleString();
                          })()}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Grille des packages - 1 sur mobile, 2 sur tablette, 3 sur web */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 max-w-6xl mx-auto">
          {packages.map((pkg) => {
            const isCurrentPackage = pkg === packageType;
            const isSelected = selectedPackage === pkg;
            const limits = PACKAGE_LIMITS[pkg];
            const features = PACKAGE_FEATURES[pkg];

            return (
              <Card 
                key={pkg} 
                className={`relative p-6 transition-all duration-200 ${
                  isCurrentPackage 
                    ? 'ring-2 ring-blue-500 bg-blue-50' 
                    : isSelected 
                    ? 'ring-2 ring-green-500 bg-green-50' 
                    : 'hover:shadow-lg'
                }`}
              >
                {/* Badge package actuel */}
                {isCurrentPackage && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                      Actuel
                    </span>
                  </div>
                )}

                {/* En-tête du package */}
                <div className="text-center mb-6">
                  <div className={`inline-flex p-3 rounded-full ${getPackageColor(pkg)} mb-4`}>
                    {getPackageIcon(pkg)}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {getPackageDisplayName(pkg)}
                  </h3>
                  <div className="text-2xl font-bold text-gray-900 mb-1">
                    {getPackagePrice(pkg)}
                  </div>
                  <p className="text-sm text-gray-500">par mois</p>
                </div>

                {/* Limites principales */}
                <div className="space-y-3 mb-6">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 flex items-center">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Formulaires
                    </span>
                    <span className="font-medium">{formatLimit(limits.maxForms)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 flex items-center">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Tableaux de bord
                    </span>
                    <span className="font-medium">{formatLimit(limits.maxDashboards)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 flex items-center">
                      <Users className="h-4 w-4 mr-2" />
                      Utilisateurs
                    </span>
                    <span className="font-medium">{formatLimit(limits.maxUsers)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 flex items-center">
                      <Brain className="h-4 w-4 mr-2" />
                      Tokens IA
                    </span>
                    <span className="font-medium">{formatLimit(limits.monthlyTokens)}</span>
                  </div>
                </div>

                {/* Fonctionnalités principales */}
                <div className="space-y-2 mb-6">
                  <div className="flex items-center space-x-2 text-sm">
                    {getFeatureIcon(features.advancedAI)}
                    <span>IA Avancée</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                    {getFeatureIcon(features.customBranding)}
                    <span>Branding personnalisé</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                    {getFeatureIcon(features.whatsappSupport)}
                    <span>Support WhatsApp</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                    {getFeatureIcon(features.customIntegrations)}
                    <span>Intégrations personnalisées</span>
                  </div>
                </div>

                {/* Bouton d'action */}
                <Button
                  onClick={() => handleUpgrade(pkg)}
                  disabled={isCurrentPackage || isProcessing}
                  className={`w-full ${
                    isCurrentPackage 
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {isProcessing && isSelected ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Traitement...</span>
                    </div>
                  ) : isCurrentPackage ? (
                    'Package actuel'
                  ) : (
                    <div className="flex items-center space-x-2">
                      <CreditCard className="h-4 w-4" />
                      <span>Choisir ce package</span>
                    </div>
                  )}
                </Button>
              </Card>
            );
          })}
        </div>

      </div>

      <Toast {...toast} />
    </Layout>
  );
};

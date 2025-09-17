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
  Palette,
  Plus
} from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { Toast } from '../components/Toast';
import { PaymentModal } from '../components/PaymentModal';

export const PackagesPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { packageType, getMonthlyTokens, hasUnlimitedTokens } = usePackageAccess();
  const { toast, showSuccess, showError } = useToast();
  const [selectedPackage, setSelectedPackage] = useState<PackageType | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentModal, setPaymentModal] = useState<{
    isOpen: boolean;
    type: 'tokens' | 'forms' | 'dashboards' | 'users';
    currentLimit: number;
  }>({
    isOpen: false,
    type: 'tokens',
    currentLimit: 0
  });

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

  const handlePurchaseResource = (option: any) => {
    // Simulation d'achat de ressource
    showSuccess(`${option.name} acheté avec succès !`);
    setPaymentModal({ isOpen: false, type: 'tokens', currentLimit: 0 });
  };

  const openPaymentModal = (type: 'tokens' | 'forms' | 'dashboards' | 'users', currentLimit: number) => {
    setPaymentModal({ isOpen: true, type, currentLimit });
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
                        <span className="text-sm font-medium text-gray-600">Tokens Archa restants:</span>
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
                      Tokens Archa
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

        {/* Section Ressources Supplémentaires */}
        <div className="max-w-4xl mx-auto">
          <Card className="p-6 bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Ressources Supplémentaires
              </h2>
              <p className="text-gray-600">
                Vous avez atteint une limite ? Achetez des ressources supplémentaires pour continuer à utiliser UBORA sans interruption.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Tokens Archa */}
              <div className="bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow">
                <div className="text-center">
                  <div className="inline-flex p-3 rounded-full bg-blue-100 text-blue-600 mb-3">
                    <Brain className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Tokens Archa</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Achetez des tokens supplémentaires pour continuer à utiliser l'IA
                  </p>
                  <Button
                    onClick={() => openPaymentModal('tokens', 0)}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Acheter des tokens
                  </Button>
                </div>
              </div>

              {/* Formulaires */}
              <div className="bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow">
                <div className="text-center">
                  <div className="inline-flex p-3 rounded-full bg-green-100 text-green-600 mb-3">
                    <BarChart3 className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Formulaires</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Ajoutez des formulaires supplémentaires à votre package
                  </p>
                  <Button
                    onClick={() => openPaymentModal('forms', 4)}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Acheter des formulaires
                  </Button>
                </div>
              </div>

              {/* Tableaux de bord */}
              <div className="bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow">
                <div className="text-center">
                  <div className="inline-flex p-3 rounded-full bg-purple-100 text-purple-600 mb-3">
                    <BarChart3 className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Tableaux de bord</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Créez plus de tableaux de bord pour vos analyses
                  </p>
                  <Button
                    onClick={() => openPaymentModal('dashboards', 1)}
                    className="w-full bg-purple-600 hover:bg-purple-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Acheter des tableaux
                  </Button>
                </div>
              </div>

              {/* Utilisateurs */}
              <div className="bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow">
                <div className="text-center">
                  <div className="inline-flex p-3 rounded-full bg-orange-100 text-orange-600 mb-3">
                    <Users className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Utilisateurs</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Ajoutez des utilisateurs à votre équipe
                  </p>
                  <Button
                    onClick={() => openPaymentModal('users', 3)}
                    className="w-full bg-orange-600 hover:bg-orange-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Acheter des utilisateurs
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                💳 Paiement sécurisé • 🔄 Ressources ajoutées immédiatement • 📞 Support 24/7
              </p>
            </div>
          </Card>
        </div>

      </div>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={paymentModal.isOpen}
        onClose={() => setPaymentModal({ isOpen: false, type: 'tokens', currentLimit: 0 })}
        type={paymentModal.type}
        currentLimit={paymentModal.currentLimit}
        onPurchase={handlePurchaseResource}
      />

      <Toast {...toast} />
    </Layout>
  );
};

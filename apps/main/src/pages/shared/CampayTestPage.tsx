import React, { useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { CampayService } from '../services/campayService';
import { PaymentRequest, CampayPaymentData } from '../types/payment';
import { 
  CreditCard, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Loader2,
  Play,
  Settings,
  Info
} from 'lucide-react';

interface TestResult {
  type: 'success' | 'error' | 'info' | 'close';
  message: string;
  data?: CampayPaymentData;
  timestamp: Date;
}

export const CampayTestPage: React.FC = () => {
  const [amount, setAmount] = useState<string>('10000');
  const [description, setDescription] = useState<string>('TAKWID GROUP (USSD) — Test Payment');
  const [externalReference, setExternalReference] = useState<string>(`TEST_${Date.now()}`);
  const [isLoading, setIsLoading] = useState(false);
  const [isServiceReady, setIsServiceReady] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [envInfo, setEnvInfo] = useState<{
    appId: string;
    environment: string;
    demoAmount: string;
    redirectUrl: string;
  } | null>(null);

  // Vérifier l'état du service et les variables d'environnement (une seule fois au chargement)
  React.useEffect(() => {
    // Récupérer l'App ID depuis les variables d'environnement
    // Vite expose les variables via import.meta.env
    const appId = import.meta.env.VITE_CAMPAY_APP_ID;
    
    // Variables d'environnement chargées (sans log)
    
    // Afficher les informations d'environnement (masquer l'App ID pour la sécurité)
    let maskedAppId = 'NON DÉFINI';
    if (appId && appId.trim() !== '') {
      if (appId.length > 15) {
        maskedAppId = `${appId.substring(0, 10)}...${appId.substring(appId.length - 5)}`;
      } else {
        maskedAppId = '***' + appId.substring(appId.length - 3);
      }
    }
    
    setEnvInfo({
      appId: maskedAppId,
      environment: import.meta.env.VITE_CAMPAY_ENVIRONMENT || 'demo',
      demoAmount: import.meta.env.VITE_CAMPAY_DEMO_AMOUNT || '10',
      redirectUrl: import.meta.env.VITE_CAMPAY_REDIRECT_URL || '(vide)'
    });

    // Vérifier si le service est prêt (une seule fois)
    setIsServiceReady(CampayService.isReady());
  }, []); // Exécuté une seule fois au montage du composant

  const addTestResult = (type: TestResult['type'], message: string, data?: CampayPaymentData) => {
    setTestResults(prev => [
      {
        type,
        message,
        data,
        timestamp: new Date()
      },
      ...prev
    ]);
  };

  const handleTestPayment = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      addTestResult('error', 'Veuillez entrer un montant valide');
      return;
    }

    setIsLoading(true);
    addTestResult('info', 'Initialisation du paiement...');

    // Timeout de sécurité : si le modal ne s'ouvre pas après 5 secondes, réinitialiser l'état
    let loadingTimeout: NodeJS.Timeout | null = null;

    try {
      const paymentRequest: PaymentRequest = {
        amount: parseFloat(amount),
        currency: 'XAF',
        description: description || 'Test Payment',
        externalReference: externalReference || `TEST_${Date.now()}`,
        metadata: {
          test: true,
          testPage: true
        }
      };

      // Calculer le montant qui sera réellement chargé
      const environment = import.meta.env.VITE_CAMPAY_ENVIRONMENT || 'demo';
      const demoAmount = parseInt(import.meta.env.VITE_CAMPAY_DEMO_AMOUNT || '10', 10);
      const chargeAmount = environment === 'demo' || environment === 'dev' ? demoAmount : parseFloat(amount);

      addTestResult('info', `Montant réel: ${parseFloat(amount).toLocaleString()} FCFA | Montant chargé: ${chargeAmount.toLocaleString()} FCFA`);
      
      loadingTimeout = setTimeout(() => {
        setIsLoading(prev => {
          if (prev) {
            // Vérifier si le modal est réellement ouvert avant d'afficher l'erreur
            const hasModal = document.querySelector('iframe[src*="campay.net"]') ||
                            document.querySelector('[class*="campay"]') ||
                            document.querySelector('[id*="campay"]');
            
            if (!hasModal) {
              addTestResult('error', 'Le modal Campay ne s\'est pas ouvert après 10 secondes. Vérifiez la console pour plus de détails.');
              return false;
            }
            return prev;
          }
          return prev;
        });
      }, 10000); // Augmenté à 10 secondes car le modal peut prendre du temps à s'ouvrir (iframe asynchrone)

      await CampayService.openPaymentModalFromRequest(paymentRequest, {
        onSuccess: (data: CampayPaymentData) => {
          if (loadingTimeout) clearTimeout(loadingTimeout);
          addTestResult('success', '✅ Paiement réussi !', data);
          setIsLoading(false);
        },
        onFail: (data: CampayPaymentData) => {
          if (loadingTimeout) clearTimeout(loadingTimeout);
          addTestResult('error', '❌ Paiement échoué', data);
          setIsLoading(false);
        },
        onModalClose: (data: CampayPaymentData) => {
          if (loadingTimeout) clearTimeout(loadingTimeout);
          addTestResult('close', 'Modal fermé', data);
          setIsLoading(false);
        }
      });

      addTestResult('info', 'Modal Campay ouvert. En attente de la réponse...');

      // Détecter l'ouverture du modal et annuler le timeout si détecté
      const checkModalInterval = setInterval(() => {
        const hasModal = document.querySelector('iframe[src*="campay.net"]') ||
                        document.querySelector('[class*="campay"]') ||
                        document.querySelector('[id*="campay"]');
        
        if (hasModal && loadingTimeout) {
          clearTimeout(loadingTimeout);
          loadingTimeout = null;
          clearInterval(checkModalInterval);
        }
      }, 500); // Vérifier toutes les 500ms

      // Nettoyer l'interval après 10 secondes
      setTimeout(() => {
        clearInterval(checkModalInterval);
      }, 10000);

    } catch (error) {
      if (loadingTimeout) clearTimeout(loadingTimeout);
      addTestResult('error', `Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
      setIsLoading(false);
    }
  };

  const handleTestDirectService = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      addTestResult('error', 'Veuillez entrer un montant valide');
      return;
    }

    setIsLoading(true);
    addTestResult('info', 'Test direct du service (sans PaymentRequest)...');

    // Timeout de sécurité : si le modal ne s'ouvre pas après 5 secondes, réinitialiser l'état
    let loadingTimeout: NodeJS.Timeout | null = null;

    try {
      
      loadingTimeout = setTimeout(() => {
        setIsLoading(prev => {
          if (prev) {
            // Vérifier si le modal est réellement ouvert avant d'afficher l'erreur
            const hasModal = document.querySelector('iframe[src*="campay.net"]') ||
                            document.querySelector('[class*="campay"]') ||
                            document.querySelector('[id*="campay"]');
            
            if (!hasModal) {
              addTestResult('error', 'Le modal Campay ne s\'est pas ouvert après 10 secondes. Vérifiez la console pour plus de détails.');
              return false;
            }
            return prev;
          }
          return prev;
        });
      }, 10000); // Augmenté à 10 secondes car le modal peut prendre du temps à s'ouvrir (iframe asynchrone)

      await CampayService.openPaymentModal({
        amount: parseFloat(amount),
        description: description || 'Test Payment Direct',
        externalReference: externalReference || `TEST_DIRECT_${Date.now()}`,
        currency: 'XAF',
        onSuccess: (data: CampayPaymentData) => {
          if (loadingTimeout) clearTimeout(loadingTimeout);
          addTestResult('success', '✅ Paiement réussi (test direct) !', data);
          setIsLoading(false);
        },
        onFail: (data: CampayPaymentData) => {
          if (loadingTimeout) clearTimeout(loadingTimeout);
          addTestResult('error', '❌ Paiement échoué (test direct)', data);
          setIsLoading(false);
        },
        onModalClose: (data: CampayPaymentData) => {
          if (loadingTimeout) clearTimeout(loadingTimeout);
          addTestResult('close', 'Modal fermé (test direct)', data);
          setIsLoading(false);
        }
      });

      addTestResult('info', 'Modal Campay ouvert (test direct). En attente de la réponse...');

      // Détecter l'ouverture du modal et annuler le timeout si détecté
      const checkModalInterval = setInterval(() => {
        const hasModal = document.querySelector('iframe[src*="campay.net"]') ||
                        document.querySelector('[class*="campay"]') ||
                        document.querySelector('[id*="campay"]');
        
        if (hasModal && loadingTimeout) {
          clearTimeout(loadingTimeout);
          loadingTimeout = null;
          clearInterval(checkModalInterval);
        }
      }, 500); // Vérifier toutes les 500ms

      // Nettoyer l'interval après 10 secondes
      setTimeout(() => {
        clearInterval(checkModalInterval);
      }, 10000);

    } catch (error) {
      if (loadingTimeout) clearTimeout(loadingTimeout);
      addTestResult('error', `Erreur (test direct): ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
      setIsLoading(false);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const getResultIcon = (type: TestResult['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'close':
        return <AlertCircle className="h-5 w-5 text-orange-500" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getResultColor = (type: TestResult['type']) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'close':
        return 'bg-orange-50 border-orange-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <Layout title="Test Campay Service">
      <div className="max-w-6xl mx-auto space-y-6 p-4 sm:p-6">
        {/* En-tête avec statut */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              Test du Service Campay Unifié
            </h1>
            <p className="text-gray-600">
              Page de test pour valider le fonctionnement du service CampayService
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              envInfo && envInfo.appId !== 'NON DÉFINI'
                ? 'bg-green-100 text-green-700' 
                : 'bg-yellow-100 text-yellow-700'
            }`}>
              {envInfo && envInfo.appId !== 'NON DÉFINI' ? '✓ Configuration prête' : '⏳ Configuration...'}
            </div>
          </div>
        </div>

        {/* Informations d'environnement */}
        {envInfo && (
          <Card className="p-4 sm:p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Settings className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Configuration</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-600">App ID</label>
                <p className={`text-sm font-mono ${
                  envInfo.appId === 'NON DÉFINI' ? 'text-red-600 font-bold' : 'text-gray-900'
                }`}>
                  {envInfo.appId}
                </p>
                {envInfo.appId === 'NON DÉFINI' && (
                  <p className="text-xs text-red-600 mt-1">
                    ⚠️ Variable non trouvée dans import.meta.env
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Environnement</label>
                <p className="text-sm text-gray-900 font-semibold capitalize">{envInfo.environment}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Montant Demo</label>
                <p className="text-sm text-gray-900">{envInfo.demoAmount} FCFA</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Redirect URL</label>
                <p className="text-sm text-gray-900">{envInfo.redirectUrl}</p>
              </div>
            </div>
            {envInfo.environment === 'demo' && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Mode Demo:</strong> Le modal affichera le montant réel mais ne chargera que {envInfo.demoAmount} FCFA.
                </p>
              </div>
            )}
            {/* Section de debug - afficher toutes les variables disponibles */}
            <details className="mt-4">
              <summary className="text-sm font-medium text-gray-700 cursor-pointer hover:text-gray-900">
                🔍 Debug: Variables d'environnement disponibles
              </summary>
              <div className="mt-2 p-3 bg-gray-50 rounded border border-gray-200">
                <p className="text-xs font-mono text-gray-700 mb-2">
                  Toutes les variables VITE_CAMPAY_* :
                </p>
                <pre className="text-xs bg-white p-2 rounded border overflow-auto max-h-40">
                  {JSON.stringify(
                    Object.keys(import.meta.env)
                      .filter(key => key.startsWith('VITE_CAMPAY_'))
                      .reduce((acc, key) => {
                        const value = import.meta.env[key];
                        // Masquer l'App ID complet pour la sécurité
                        if (key === 'VITE_CAMPAY_APP_ID' && value) {
                          acc[key] = value.length > 15 
                            ? `${value.substring(0, 10)}...${value.substring(value.length - 5)}`
                            : '***' + value.substring(value.length - 3);
                        } else {
                          acc[key] = value || '(vide)';
                        }
                        return acc;
                      }, {} as Record<string, string>),
                    null,
                    2
                  )}
                </pre>
                <p className="text-xs text-gray-600 mt-2">
                  💡 Vérifiez la console du navigateur pour plus de détails<br/>
                  📁 Le fichier <code className="bg-gray-200 px-1 rounded">.env.local</code> doit être à la <strong>racine du projet</strong> (partagé entre main et admin)
                </p>
              </div>
            </details>
          </Card>
        )}

        {/* Formulaire de test */}
        <Card className="p-4 sm:p-6">
          <div className="flex items-center space-x-2 mb-6">
            <CreditCard className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Paramètres du Test</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
                Montant (FCFA)
              </label>
              <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="10000"
                min="1"
                disabled={isLoading}
              />
              <p className="mt-1 text-xs text-gray-500">
                Montant réel à afficher dans le modal
              </p>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <Input
                id="description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description du paiement"
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="externalReference" className="block text-sm font-medium text-gray-700 mb-2">
                Référence Externe
              </label>
              <Input
                id="externalReference"
                type="text"
                value={externalReference}
                onChange={(e) => setExternalReference(e.target.value)}
                placeholder="REF_123"
                disabled={isLoading}
              />
              <button
                onClick={() => setExternalReference(`TEST_${Date.now()}`)}
                className="mt-1 text-xs text-blue-600 hover:text-blue-800"
                disabled={isLoading}
              >
                Générer une nouvelle référence
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                onClick={handleTestPayment}
                disabled={isLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {isLoading ? (
                  <span className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Ouverture du modal...</span>
                  </span>
                ) : (
                  <span className="flex items-center space-x-2">
                    <Play className="h-4 w-4" />
                    <span>Test avec PaymentRequest</span>
                  </span>
                )}
              </Button>

              <Button
                onClick={handleTestDirectService}
                disabled={isLoading}
                variant="secondary"
                className="flex-1"
              >
                {isLoading ? (
                  <span className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Ouverture...</span>
                  </span>
                ) : (
                  <span className="flex items-center space-x-2">
                    <Play className="h-4 w-4" />
                    <span>Test Direct (Service)</span>
                  </span>
                )}
              </Button>
            </div>
            
            {(!envInfo || envInfo.appId === 'NON DÉFINI') && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">
                  <strong>⚠️ Attention:</strong> VITE_CAMPAY_APP_ID n'est pas défini. 
                </p>
                <p className="text-xs text-red-700 mt-2">
                  📁 Vérifiez que le fichier <code className="bg-red-100 px-1 rounded">.env.local</code> est à la <strong>racine du projet</strong> (même niveau que <code className="bg-red-100 px-1 rounded">package.json</code>)<br/>
                  🔄 <strong>Redémarrez le serveur de développement</strong> après avoir créé/modifié le fichier<br/>
                  ⚠️ Les boutons fonctionneront mais le service ne pourra pas charger le script Campay sans l'App ID.
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Résultats des tests */}
        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Info className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Résultats des Tests</h2>
            </div>
            {testResults.length > 0 && (
              <Button
                onClick={clearResults}
                variant="secondary"
                size="sm"
              >
                Effacer
              </Button>
            )}
          </div>

          {testResults.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>Aucun test effectué pour le moment.</p>
              <p className="text-sm mt-2">Utilisez les boutons ci-dessus pour tester le service.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {testResults.map((result, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${getResultColor(result.type)}`}
                >
                  <div className="flex items-start space-x-3">
                    {getResultIcon(result.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{result.message}</p>
                      {result.data && (
                        <div className="mt-2 p-2 bg-white rounded border border-gray-200">
                          <p className="text-xs font-mono text-gray-700">
                            <strong>Status:</strong> {result.data.status}
                          </p>
                          <p className="text-xs font-mono text-gray-700">
                            <strong>Reference:</strong> {result.data.reference}
                          </p>
                          {result.data.amount && (
                            <p className="text-xs font-mono text-gray-700">
                              <strong>Amount:</strong> {result.data.amount} {result.data.currency || 'XAF'}
                            </p>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        {result.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Instructions */}
        <Card className="p-4 sm:p-6 bg-yellow-50 border-yellow-200">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-900 mb-2">Instructions</h3>
              <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                <li>Assurez-vous que <code className="bg-yellow-100 px-1 rounded">VITE_CAMPAY_APP_ID</code> est défini dans votre <code className="bg-yellow-100 px-1 rounded">.env.local</code></li>
                <li>Le fichier <code className="bg-yellow-100 px-1 rounded">.env.local</code> doit être à la <strong>racine du projet</strong> (même niveau que <code className="bg-yellow-100 px-1 rounded">package.json</code> à la racine)</li>
                <li>Ce fichier est partagé entre l'application <code className="bg-yellow-100 px-1 rounded">main</code> et <code className="bg-yellow-100 px-1 rounded">admin</code></li>
                <li><strong>Important:</strong> Redémarrez le serveur de développement après avoir modifié <code className="bg-yellow-100 px-1 rounded">.env.local</code></li>
                <li>Le service chargera automatiquement le script Campay au premier test</li>
                <li>En mode demo, le modal affichera le montant réel mais ne chargera que le montant demo (10 FCFA par défaut)</li>
                <li>Sur l'écran USSD, vous devez voir le nom du marchand "TAKWID GROUP"</li>
                <li>Si un autre nom apparaît, annulez la transaction</li>
              </ul>
              
              <div className="mt-4 p-3 bg-yellow-100 rounded border border-yellow-300">
                <h4 className="font-semibold text-yellow-900 mb-2">Format du fichier .env.local (à la racine du projet) :</h4>
                <pre className="text-xs bg-white p-2 rounded border overflow-x-auto">
{`# Fichier: .env.local (à la racine, même niveau que package.json)
# Ce fichier est partagé entre apps/main et apps/admin

VITE_CAMPAY_APP_ID=votre_app_id_ici
VITE_CAMPAY_ENVIRONMENT=demo
VITE_CAMPAY_DEMO_AMOUNT=10
VITE_CAMPAY_REDIRECT_URL=`}
                </pre>
                <p className="text-xs text-yellow-800 mt-2">
                  ⚠️ Pas d'espaces autour du signe = et pas de guillemets autour des valeurs<br/>
                  📁 Emplacement: <code className="bg-yellow-200 px-1 rounded">.env.local</code> à la racine du projet
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  );
};


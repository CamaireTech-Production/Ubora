import React, { useState, useEffect } from 'react';
import { Navigate, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { Footer } from '../../components/layout/Footer';
import { Lock, Mail, AlertCircle, Loader2 } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { user, login, loginWithGoogle, register, resetPassword, isLoading, error } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'directeur' | 'employe'>('directeur');
  const [agencyId, setAgencyId] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [localError, setLocalError] = useState('');
  const [isInviteLink, setIsInviteLink] = useState(false);
  const [showAccountExistsModal, setShowAccountExistsModal] = useState(false);
  const [modalCountdown, setModalCountdown] = useState(5);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showQuotaExceededModal, setShowQuotaExceededModal] = useState(false);
  const [quotaExceededDirectorInfo, setQuotaExceededDirectorInfo] = useState<{ id: string; name: string; email: string } | null>(null);

  // Gérer les paramètres d'invitation depuis l'URL
  useEffect(() => {
    const invite = searchParams.get('invite');
    const inviteAgencyId = searchParams.get('agencyId');
    
    if (invite === 'true') {
      setIsInviteLink(true);
      setIsRegisterMode(true);
      
      // For invite links, always set role to employee and make it non-changeable
      setRole('employe');
      
      if (inviteAgencyId) {
        setAgencyId(inviteAgencyId);
      }
    }
  }, [searchParams]);

  // Gérer l'erreur de compte existant
  useEffect(() => {
    if (error === 'ACCOUNT_EXISTS') {
      setShowAccountExistsModal(true);
      setModalCountdown(5);
      
      // Countdown timer
      const countdownInterval = setInterval(() => {
        setModalCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            setShowAccountExistsModal(false);
            setIsRegisterMode(false);
            setLocalError('');
            return 5;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(countdownInterval);
    }
  }, [error]);

  // Rediriger automatiquement après l'inscription quand l'utilisateur est chargé
  // On attend que isLoading soit false pour s'assurer que l'utilisateur est complètement chargé
  useEffect(() => {
    if (!isLoading && user && isProcessing) {
      if (user.role === 'directeur' && user.needsPackageSelection) {
        // Directeur: rediriger vers la sélection de package
        setIsProcessing(false);
        setIsRegisterMode(false);
        setEmail('');
        setPassword('');
        setName('');
        navigate('/packages', { replace: true });
      } else if (user.role === 'employe') {
        // Employé: rediriger vers la page d'attente d'approbation
        setIsProcessing(false);
        setIsRegisterMode(false);
        setEmail('');
        setPassword('');
        setName('');
        navigate('/pending-approval', { replace: true });
      }
    }
  }, [user, isLoading, navigate, isProcessing]);

  // Afficher un loader pendant le chargement initial (pas pendant l'inscription)
  if (isLoading && !isProcessing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Rediriger si déjà connecté
  if (user) {
    if (user.role === 'directeur') {
      if (user.needsPackageSelection) {
        return <Navigate to="/packages" replace />;
      }
      return <Navigate to="/directeur/dashboard" replace />;
    } else if (user.role === 'employe') {
      return <Navigate to="/employe/dashboard" replace />;
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Consolider les erreurs : effacer toutes les erreurs précédentes
    setLocalError('');
    
    try {
      if (isRegisterMode) {
        // Validation: Only directors can sign up directly (not through invite links)
        if (!isInviteLink && role !== 'directeur') {
          setLocalError('Seuls les directeurs peuvent créer des comptes directement. Les employés doivent utiliser un lien d\'invitation.');
          return;
        }
        
        // Validation: Agency ID is required for directors
        if (role === 'directeur' && !agencyId.trim()) {
          setLocalError('L\'ID d\'agence est obligatoire pour les directeurs.');
          return;
        }
        
        // Activer l'état de traitement unifié
        setIsProcessing(true);
        
        // L'inscription fait maintenant toutes les vérifications et la création de manière synchrone
        const result = await register(email, password, name, role, agencyId);
        
        if (result.success) {
          // Pour les directeurs et employés, la redirection se fera automatiquement via useEffect quand user sera chargé
          // On garde isProcessing à true pour maintenir le loading jusqu'à la redirection
        } else {
          // En cas d'erreur, réinitialiser l'état de traitement
          setIsProcessing(false);
          
          // Gérer les différents types d'erreurs
          if (result.action === 'login') {
            // Compte existe, proposer de se connecter
            setLocalError(result.error || 'Un compte existe déjà avec cet email.');
            setShowAccountExistsModal(true);
          } else if (result.error && result.error.includes('Quota atteint')) {
            // Quota atteint - afficher le modal avec les infos du directeur
            setQuotaExceededDirectorInfo(result.directorInfo || null);
            setShowQuotaExceededModal(true);
            setLocalError(''); // Ne pas afficher l'erreur deux fois
          } else if (result.error) {
            setLocalError(result.error);
          } else if (error) {
            setLocalError(error);
          }
        }
      } else {
        await login(email, password);
      }
    } catch (err) {
      setLocalError('Une erreur est survenue');
      setIsProcessing(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLocalError('');
    
    // Check if this is an invitation context
    const urlParams = new URLSearchParams(window.location.search);
    const isInvite = urlParams.get('invite') === 'true';
    
    if (isInvite) {
      // For invitations, Google Auth is allowed
      try {
        const success = await loginWithGoogle();
        if (!success) {
          // Gérer les erreurs spécifiques
          if (error === 'POPUP_BLOCKED_PWA') {
            setLocalError('La popup a été bloquée. En mode PWA, veuillez utiliser la connexion par email/mot de passe.');
          } else if (error) {
            setLocalError(error);
          } else {
            setLocalError('Erreur lors de la connexion Google');
          }
        }
      } catch (err) {
        setLocalError('Erreur lors de la connexion Google');
      }
    } else {
      // For non-invitation contexts (directors), Google Auth is allowed
      try {
        const success = await loginWithGoogle();
        if (!success) {
          // Gérer les erreurs spécifiques
          if (error === 'POPUP_BLOCKED_PWA') {
            setLocalError('La popup a été bloquée. En mode PWA, veuillez utiliser la connexion par email/mot de passe.');
          } else if (error) {
            setLocalError(error);
          } else {
            setLocalError('Erreur lors de la connexion Google');
          }
        }
      } catch (err) {
        setLocalError('Erreur lors de la connexion Google');
      }
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotPasswordEmail.trim()) {
      setLocalError('Veuillez entrer votre adresse email');
      return;
    }
    
    setLocalError('');
    const success = await resetPassword(forgotPasswordEmail);
    
    if (success) {
      setForgotPasswordSuccess(true);
      setForgotPasswordEmail('');
    }
  };

  // Filter out ACCOUNT_EXISTS error from display since it's handled by modal
  const displayError = (error && error !== 'ACCOUNT_EXISTS') ? error : localError;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-sm sm:max-w-md">
        <div className="text-center mb-8">
          <div className="flex flex-col items-center mb-4">
            <img 
              src="/favicon-base.jpg" 
              alt="Ubora Logo" 
              className="w-12 h-12 rounded-full shadow-lg mb-3 object-cover"
            />
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Ubora</h1>
          </div>
          <p className="text-sm sm:text-base text-gray-600">
            {isInviteLink 
              ? 'Vous avez été invité à rejoindre l\'équipe' 
              : isRegisterMode 
                ? 'Créer un compte directeur Ubora' 
                : 'Connectez-vous à votre espace Ubora'
            }
          </p>
          {isInviteLink ? (
            <p className="text-xs text-green-600 mt-2 font-medium">
              Rôle employé pré-sélectionné
            </p>
          ) : isRegisterMode && (
            <p className="text-xs text-blue-600 mt-2 font-medium">
              Création de compte directeur uniquement
            </p>
          )}
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            {isRegisterMode && (
              <>
                <Input
                  label="Nom complet *"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Votre nom complet"
                  required
                />
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rôle
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'directeur' | 'employe')}
                    disabled={true}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base ${
                      isInviteLink 
                        ? 'border-green-300 bg-green-50 text-green-700 cursor-not-allowed' 
                        : 'border-blue-300 bg-blue-50 text-blue-700 cursor-not-allowed'
                    }`}
                  >
                    <option value="directeur">Directeur</option>
                    <option value="employe">Employé</option>
                  </select>
                  {isInviteLink ? (
                    <p className="text-xs text-green-600 mt-1">
                      Rôle défini par l'invitation
                    </p>
                  ) : (
                    <p className="text-xs text-blue-600 mt-1">
                      Rôle directeur verrouillé pour la création directe
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ID Agence {role === 'directeur' && !isInviteLink && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="text"
                    value={agencyId}
                    onChange={(e) => setAgencyId(e.target.value)}
                    placeholder={isInviteLink ? "ID d'agence fourni par l'invitation" : "Entrez votre ID d'agence"}
                    disabled={isInviteLink}
                    required={role === 'directeur' && !isInviteLink}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base ${
                      isInviteLink 
                        ? 'border-green-300 bg-green-50 text-green-700 cursor-not-allowed' 
                        : 'border-gray-300'
                    }`}
                  />
                  {isInviteLink ? (
                    <p className="text-xs text-green-600 mt-1">
                      Agence définie par l'invitation
                    </p>
                  ) : role === 'directeur' ? (
                    <p className="text-xs text-blue-600 mt-1">
                      Obligatoire pour créer un compte directeur
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500 mt-1">
                      L'ID d'agence sera fourni par votre directeur
                    </p>
                  )}
                </div>
              </>
            )}

            <div className="relative">
              <Mail className="absolute left-3 top-9 h-5 w-5 text-gray-400" />
              <Input
                label="Email *"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com"
                className="pl-10"
                required
              />
            </div>
            
            <div className="relative">
              <Lock className="absolute left-3 top-9 h-5 w-5 text-gray-400" />
              <Input
                label="Mot de passe *"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-10"
                required
              />
            </div>

            {!isRegisterMode && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setShowForgotPasswordModal(true)}
                  className="text-sm text-blue-600 hover:text-blue-500 transition-colors"
                >
                  Mot de passe oublié ?
                </button>
              </div>
            )}

            {displayError && (
              <div className="flex items-start space-x-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span className="break-words">{displayError}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading || isProcessing}
              className="w-full relative"
            >
              {isProcessing && isRegisterMode ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Création en cours...</span>
                </div>
              ) : (isLoading || isProcessing) ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Chargement...</span>
                </div>
              ) : isRegisterMode ? (
                'Créer le compte'
              ) : (
                'Se connecter'
              )}
            </Button>
          </form>

          {!isRegisterMode && (
            <div className="mt-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">ou</span>
                </div>
              </div>

              {/* Only show Google button for invitations or directors */}
              {(isInviteLink || (!isInviteLink && role === 'directeur')) && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  className="w-full mt-4"
                >
                  Continuer avec Google
                </Button>
              )}
              
              {/* Show message for employees without invitation */}
              {!isInviteLink && role === 'employe' && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800 text-center">
                    Les employés doivent utiliser un lien d'invitation pour se connecter avec Google.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 sm:mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegisterMode(!isRegisterMode);
                setLocalError('');
                setIsProcessing(false);
              }}
              className="text-blue-600 hover:text-blue-500 text-sm break-words"
            >
              {isRegisterMode 
                ? 'Déjà un compte ? Se connecter' 
                : 'Pas de compte ? S\'inscrire'
              }
            </button>
          </div>
        </Card>
        </div>
      </div>
      
      {/* Modal pour compte existant */}
      {showAccountExistsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-4">
                <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Compte déjà existant
              </h3>
              
              <p className="text-gray-600 mb-4">
                Un compte avec l'adresse email <strong>{email}</strong> existe déjà. 
                Veuillez vous connecter avec vos identifiants existants.
              </p>
              
              <p className="text-sm text-gray-500 mb-6">
                Redirection automatique vers la connexion dans <span className="font-semibold text-blue-600">{modalCountdown}</span> seconde{modalCountdown > 1 ? 's' : ''}...
              </p>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowAccountExistsModal(false);
                    setIsRegisterMode(false);
                    setLocalError('');
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  Se connecter maintenant
                </button>
                <button
                  onClick={() => setShowAccountExistsModal(false)}
                  className="flex-1 border border-gray-300 hover:border-gray-400 text-gray-700 hover:text-gray-900 font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal pour quota atteint */}
      {showQuotaExceededModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
              
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Quota atteint
              </h3>
              
              <p className="text-gray-600 mb-4">
                Le nombre maximum d'utilisateurs autorisés pour cette agence a été atteint. 
                Contactez votre directeur pour mettre à niveau le package ou acheter des utilisateurs supplémentaires.
              </p>
              
              {quotaExceededDirectorInfo && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-left">
                  <h4 className="font-semibold text-blue-900 mb-2">Informations du directeur</h4>
                  <div className="space-y-1 text-sm">
                    <div>
                      <span className="text-blue-800 font-medium">Nom: </span>
                      <span className="text-blue-700">{quotaExceededDirectorInfo.name}</span>
                    </div>
                    {quotaExceededDirectorInfo.email && (
                      <div>
                        <span className="text-blue-800 font-medium">Email: </span>
                        <a 
                          href={`mailto:${quotaExceededDirectorInfo.email}`}
                          className="text-blue-600 hover:text-blue-800 underline"
                        >
                          {quotaExceededDirectorInfo.email}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              <Button
                onClick={() => {
                  setShowQuotaExceededModal(false);
                  setQuotaExceededDirectorInfo(null);
                }}
                className="w-full"
              >
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal pour mot de passe oublié */}
      {showForgotPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
                <Lock className="h-6 w-6 text-blue-600" />
              </div>
              
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Mot de passe oublié
              </h3>
              
              {!forgotPasswordSuccess ? (
                <>
                  <p className="text-gray-600 mb-6">
                    Entrez votre adresse email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
                  </p>
                  
                  <div className="space-y-4">
                    <Input
                      label="Email"
                      type="email"
                      value={forgotPasswordEmail}
                      onChange={(e) => setForgotPasswordEmail(e.target.value)}
                      placeholder="votre@email.com"
                      required
                    />
                    
                    <div className="flex space-x-3">
                      <Button
                        onClick={handleForgotPassword}
                        disabled={isLoading || !forgotPasswordEmail.trim()}
                        className="flex-1"
                      >
                        {isLoading ? 'Envoi...' : 'Envoyer le lien'}
                      </Button>
                      <button
                        onClick={() => {
                          setShowForgotPasswordModal(false);
                          setForgotPasswordEmail('');
                          setLocalError('');
                        }}
                        className="flex-1 border border-gray-300 hover:border-gray-400 text-gray-700 hover:text-gray-900 font-medium py-3 px-4 rounded-lg transition-colors"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                    <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    Email envoyé !
                  </h3>
                  
                  <p className="text-gray-600 mb-6">
                    Nous avons envoyé un lien de réinitialisation à votre adresse email. 
                    Vérifiez votre boîte de réception et suivez les instructions.
                  </p>
                  
                  <Button
                    onClick={() => {
                      setShowForgotPasswordModal(false);
                      setForgotPasswordSuccess(false);
                      setForgotPasswordEmail('');
                    }}
                    className="w-full"
                  >
                    Fermer
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      
      <Footer />
    </div>
  );
};
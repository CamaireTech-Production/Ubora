import React, { useEffect, useState } from 'react';
import { ArrowRight, UserPlus, Copy, Check } from 'lucide-react';
import { Button } from './Button';
import { useAuth } from '../contexts/AuthContext';

interface WelcomeScreenProps {
  userName?: string;
  onContinue: () => void;
  rememberKey?: string;
  show?: boolean;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  userName = 'Directeur',
  onContinue,
  rememberKey = 'directeur_chat_welcome',
  show = false
}) => {
  const { user } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Déterminer le message selon l'heure
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon après-midi';
    return 'Bonsoir';
  };

  // Vérifier si on doit afficher l'écran de bienvenue
  useEffect(() => {
    if (show) {
      setShouldShow(true);
      setIsVisible(true);
      return;
    }

    const hasSeenWelcome = sessionStorage.getItem(rememberKey);
    if (!hasSeenWelcome) {
      setShouldShow(true);
      setTimeout(() => setIsVisible(true), 100);
    }
  }, [show, rememberKey]);

  const handleContinue = () => {
    setIsVisible(false);
    setTimeout(() => {
      if (!show) {
        sessionStorage.setItem(rememberKey, 'true');
      }
      setShouldShow(false);
      onContinue();
    }, 300);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleContinue();
    }
  };

  const generateInviteLink = () => {
    if (!user?.agencyId) return '';
    const baseUrl = window.location.origin;
    return `${baseUrl}/login?invite=true&agencyId=${user.agencyId}&role=employe`;
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(generateInviteLink());
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error('Erreur lors de la copie:', err);
    }
  };

  const handleShareLink = async () => {
    const link = generateInviteLink();
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Invitation à rejoindre Multi-Agences',
          text: 'Rejoignez notre équipe sur la plateforme Multi-Agences',
          url: link
        });
      } catch (err) {
        console.error('Erreur lors du partage:', err);
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  if (!shouldShow) return null;

  return (
    <div 
      className={`fixed inset-0 z-50 bg-white flex items-center justify-center transition-all duration-300 ${
        isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
      aria-describedby="welcome-description"
    >
      <div className="text-center px-6 py-8 max-w-md w-full">
        
        {/* Animation circulaire centrale */}
        <div className="relative mb-8 flex items-center justify-center">
          <div className="relative w-48 h-48 sm:w-64 sm:h-64">
            
            {/* Anneau extérieur - rotation lente */}
            <div className="absolute inset-0 animate-spin-slow">
              <svg className="w-full h-full" viewBox="0 0 200 200">
                <defs>
                  <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.8" />
                    <stop offset="50%" stopColor="#8B5CF6" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.4" />
                  </linearGradient>
                </defs>
                <circle
                  cx="100"
                  cy="100"
                  r="90"
                  fill="none"
                  stroke="url(#gradient1)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray="20 10"
                />
              </svg>
            </div>

            {/* Anneau moyen - rotation inverse */}
            <div className="absolute inset-4 animate-spin-reverse">
              <svg className="w-full h-full" viewBox="0 0 200 200">
                <defs>
                  <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.7" />
                    <stop offset="50%" stopColor="#3B82F6" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.3" />
                  </linearGradient>
                </defs>
                <circle
                  cx="100"
                  cy="100"
                  r="75"
                  fill="none"
                  stroke="url(#gradient2)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeDasharray="15 8"
                />
              </svg>
            </div>

            {/* Anneau intérieur - pulsation */}
            <div className="absolute inset-8 animate-pulse">
              <svg className="w-full h-full" viewBox="0 0 200 200">
                <defs>
                  <radialGradient id="gradient3" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
                    <stop offset="70%" stopColor="#DBEAFE" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.2" />
                  </radialGradient>
                </defs>
                <circle
                  cx="100"
                  cy="100"
                  r="60"
                  fill="url(#gradient3)"
                  stroke="#3B82F6"
                  strokeWidth="1"
                  strokeOpacity="0.3"
                />
              </svg>
            </div>

            {/* Centre avec icône */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-white rounded-full p-4 shadow-lg animate-bounce-subtle">
                <img 
                  src="/favicon-base.jpg" 
                  alt="Ubora Logo" 
                  className="w-12 h-12 rounded-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Logo et nom de l'app */}
        <div className="flex flex-col items-center mb-6">
          {/* <img 
            src="/logo-base.jpg" 
            alt="Ubora Logo" 
            className="w-20 h-20 rounded-full shadow-lg mb-4 object-cover"
          /> */}
          <h1 className="text-6xl sm:text-5xl font-bold text-gray-900 mb-2">
            Ubora
          </h1>
        </div>

        {/* Contenu textuel */}
        <div className="space-y-4 mb-8">
          <h2 
            id="welcome-title"
            className="text-2xl sm:text-4xl font-bold text-gray-900"
          >
            {getGreeting()}, {userName} !
          </h2>
          
          <p 
            id="welcome-description"
            className="text-base sm:text-lg text-gray-600 leading-relaxed"
          >
            Prêt à analyser vos données et optimiser vos performances avec ARCHA ?
          </p>
        </div>

        {/* Bouton principal */}
        <div className="space-y-4">
          <Button
            onClick={handleContinue}
            onKeyDown={handleKeyPress}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-2 px-6 rounded-xl shadow-md hover:shadow-lg transform hover:scale-102 transition-all duration-200 flex items-center justify-center space-x-2"
            aria-label="Continuer vers l'interface d'analyse"
          >
            <span className="text-base">Continuer les analyses</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
          
          {/* Bouton d'invitation discret */}
          <div className="text-center">
            <button
              onClick={() => setShowInviteModal(true)}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors duration-200 flex items-center justify-center space-x-1 mx-auto"
              aria-label="Inviter des collaborateurs"
            >
              <UserPlus className="h-3 w-3" />
              <span>Inviter des collaborateurs</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal d'invitation */}
      {showInviteModal && (
        <div className="fixed inset-0 z-60 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
                <UserPlus className="h-6 w-6 text-blue-600" />
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Inviter des collaborateurs
              </h3>
              
              <p className="text-sm text-gray-600 mb-6">
                Partagez ce lien pour permettre à vos collaborateurs de créer un compte employé dans votre agence.
              </p>
              
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <p className="text-xs text-gray-500 text-left mb-2">Lien d'invitation :</p>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={generateInviteLink()}
                    readOnly
                    className="flex-1 text-xs bg-white border border-gray-200 rounded px-2 py-1 text-gray-700"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
                    title="Copier le lien"
                  >
                    {linkCopied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              
              <div className="flex space-x-3">
                <Button
                  onClick={handleShareLink}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Partager
                </Button>
                <Button
                  onClick={() => setShowInviteModal(false)}
                  variant="secondary"
                  className="flex-1 border border-gray-300 hover:border-gray-400 text-gray-700 hover:text-gray-900 font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Fermer
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
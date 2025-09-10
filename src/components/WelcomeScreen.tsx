import React, { useEffect, useState } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { Button } from './Button';

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
  const [isVisible, setIsVisible] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);

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
                <Sparkles className="h-8 w-8 text-blue-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Contenu textuel */}
        <div className="space-y-4 mb-8">
          <h1 
            id="welcome-title"
            className="text-2xl sm:text-4xl font-bold text-gray-900"
          >
            {getGreeting()}, {userName} !
          </h1>
          
          <p 
            id="welcome-description"
            className="text-base sm:text-lg text-gray-600 leading-relaxed"
          >
            Prêt à analyser vos données et optimiser vos performances ?
          </p>
          
          <p className="text-sm text-gray-500">
            Votre assistant IA vous attend pour des insights personnalisés
          </p>
        </div>

        {/* Bouton principal */}
        <div className="space-y-3">
          <Button
            onClick={handleContinue}
            onKeyDown={handleKeyPress}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-4 px-8 rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center justify-center space-x-3"
            aria-label="Continuer vers l'interface d'analyse"
          >
            <span className="text-lg">Continuer les analyses</span>
            <ArrowRight className="h-5 w-5" />
          </Button>
          
          {/* Indication clavier */}
          <p className="text-xs text-gray-400 flex items-center justify-center space-x-2">
            <span>Appuyez sur</span>
            <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono">
              Entrée
            </kbd>
            <span>pour continuer</span>
          </p>
        </div>
      </div>
    </div>
  );
};
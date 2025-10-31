import React, { useState, useEffect } from 'react';
import { Sparkles, CheckCircle } from 'lucide-react';

interface UniversCreationLoadingProps {
  onComplete: () => void;
  isVisible: boolean;
}

interface LoadingMessage {
  text: string;
  icon?: React.ReactNode;
}

const LOADING_MESSAGES: LoadingMessage[] = [
  {
    text: "✨ Bienvenue dans Ubora - Votre assistant intelligent pour la gestion de données",
    icon: <Sparkles className="h-5 w-5" />
  },
  {
    text: "🧠 Archa analyse vos besoins et crée votre Univers personnalisé...",
    icon: <Sparkles className="h-5 w-5" />
  },
  {
    text: "📋 Créez des formulaires, tableaux de bord et rapports en quelques clics",
    icon: <Sparkles className="h-5 w-5" />
  },
  {
    text: "🚀 Partagez vos Univers avec votre équipe ou publiez-les sur le marketplace",
    icon: <Sparkles className="h-5 w-5" />
  },
  {
    text: "💡 Astuce : Utilisez les templates du marketplace pour démarrer rapidement",
    icon: <Sparkles className="h-5 w-5" />
  },
  {
    text: "🎯 Organisez vos données avec des listes personnalisables et des filtres intelligents",
    icon: <Sparkles className="h-5 w-5" />
  },
  {
    text: "📊 Visualisez vos métriques avec des tableaux de bord interactifs et dynamiques",
    icon: <Sparkles className="h-5 w-5" />
  },
  {
    text: "🤖 Automatisez vos tâches avec archa grâce aux instructions programmées",
    icon: <Sparkles className="h-5 w-5" />
  }
];

export const UniversCreationLoading: React.FC<UniversCreationLoadingProps> = ({
  onComplete,
  isVisible
}) => {
  const [progress, setProgress] = useState(0);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!isVisible) {
      setProgress(0);
      setCurrentMessageIndex(0);
      setShowConfetti(false);
      setIsComplete(false);
      return;
    }

    let progressInterval: NodeJS.Timeout;
    let messageInterval: NodeJS.Timeout;

    // Simulate progress with realistic timing (slower and smoother)
    progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          setShowConfetti(true);
          setIsComplete(true);
          
          // Call onComplete after confetti animation (longer delay for better UX)
          setTimeout(() => {
            onComplete();
          }, 2500);
          
          return 100;
        }
        
        // Slower, smoother progression: start slow, accelerate in middle, slow at end
        const increment = prev < 20 ? 0.8 : prev < 40 ? 1.2 : prev < 60 ? 1.5 : prev < 80 ? 1.2 : prev < 95 ? 0.6 : 0.3;
        return Math.min(prev + increment, 100);
      });
    }, 120); // Slower interval (was 80ms, now 120ms)

    // Rotate messages every 3 seconds (slower rotation)
    messageInterval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 3000);

    return () => {
      if (progressInterval) clearInterval(progressInterval);
      if (messageInterval) clearInterval(messageInterval);
    };
  }, [isVisible, onComplete]);

  if (!isVisible) return null;

  const currentMessage = LOADING_MESSAGES[currentMessageIndex];

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
      {/* Confetti Effect */}
      {showConfetti && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute confetti-piece"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                backgroundColor: ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b'][
                  Math.floor(Math.random() * 5)
                ],
                width: `${Math.random() * 10 + 5}px`,
                height: `${Math.random() * 10 + 5}px`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${Math.random() * 2 + 2}s`
              }}
            />
          ))}
        </div>
      )}

      <div className="relative z-10 max-w-2xl w-full px-6">
        {/* Logo/Brand Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl mb-4 shadow-lg animate-pulse">
            <Sparkles className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
            Création de votre Univers
          </h1>
          <p className="text-gray-600">
            Nous préparons tout pour vous...
          </p>
        </div>

        {/* Loading Animation - Rotating Squares */}
        <div className="flex justify-center mb-8">
          <div className="relative w-24 h-24">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="absolute w-full h-full rounded-lg loading-square"
                style={{
                  backgroundColor: `rgba(59, 130, 246, ${0.3 + i * 0.2})`,
                  transform: `rotate(${i * 90}deg)`,
                  animationDelay: `${i * 0.1}s`
                }}
              />
            ))}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">
              Progression
            </span>
            <span className="text-sm font-bold text-blue-600">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full transition-all duration-300 ease-out relative overflow-hidden"
              style={{ width: `${progress}%` }}
            >
              {/* Shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
            </div>
          </div>
        </div>

        {/* Message Display with Slide Animation */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-gray-200 min-h-[120px] flex items-center justify-center">
          <div key={currentMessageIndex} className="text-center animate-slide-in">
            <div className="flex items-center justify-center space-x-3 mb-3">
              {currentMessage.icon && (
                <span className="text-blue-600 animate-bounce">
                  {currentMessage.icon}
                </span>
              )}
            </div>
            <p className="text-gray-700 text-lg font-medium leading-relaxed">
              {currentMessage.text}
            </p>
          </div>
        </div>

        {/* Success Message */}
        {isComplete && (
          <div className="mt-6 text-center animate-fade-in">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500 rounded-full mb-4 animate-scale-in">
              <CheckCircle className="h-8 w-8 text-white" />
            </div>
            <p className="text-xl font-semibold text-green-600 mb-2">
              Votre Univers a été créé avec succès ! 🎉
            </p>
            <p className="text-gray-600">
              Redirection en cours...
            </p>
          </div>
        )}

        {/* Tips Section */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center space-x-2 text-xs text-gray-500">
            <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse" />
            <span>Votre Univers sera disponible dans quelques instants</span>
            <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse" />
          </div>
        </div>
      </div>

    </div>
  );
};


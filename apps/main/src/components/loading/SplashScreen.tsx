import React from 'react';

interface SplashScreenProps {
  message?: string;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ 
  message = "Chargement d'Ubora..." 
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-white flex items-center justify-center">
      <div className="text-center animate-soft-fade-in">
        {/* Logo Container with Animation */}
        <div className="mb-8 flex justify-center">
          <div className="relative">
            {/* Outer ring animation */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 opacity-20 animate-pulse-slow"></div>
            
            {/* Logo circle with gradient */}
            <div className="relative w-24 h-24 sm:w-32 sm:h-32 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 rounded-full flex items-center justify-center shadow-2xl shadow-blue-500/30 animate-scale-in">
              {/* Inner logo text/icon */}
              <div className="text-white text-3xl sm:text-4xl font-bold">U</div>
              
              {/* Shimmer effect */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer-slow"></div>
            </div>
          </div>
        </div>

        {/* Loading Text */}
        <div className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 animate-fade-in-delay">
            {message}
          </h2>
          
          {/* Loading dots */}
          <div className="flex justify-center space-x-2 mt-4">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
};


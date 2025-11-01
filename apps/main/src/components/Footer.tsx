import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-50 border-t border-gray-200 py-3">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between text-sm text-gray-500">
          <div className="flex items-center space-x-2 mb-2 sm:mb-0">
            <img 
              src="/favicon-base.jpg" 
              alt="Ubora" 
              className="w-4 h-4 rounded-full object-cover"
            />
            <span className="font-medium text-gray-700">Ubora</span>
            <span>•</span>
            <span>Powered by ARCHA</span>
          </div>
          <div className="text-xs text-gray-400">
            © 2024 Ubora. Tous droits réservés.
          </div>
        </div>
      </div>
    </footer>
  );
};

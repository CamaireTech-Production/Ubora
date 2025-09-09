import React from 'react';
import { ArrowLeft, Wifi, WifiOff, Loader2 } from 'lucide-react';
import { Button } from '../Button';

interface ChatTopBarProps {
  title?: string;
  isConnected?: boolean;
  isLoading?: boolean;
  onBack?: () => void;
}

export const ChatTopBar: React.FC<ChatTopBarProps> = ({
  title = "Assistant IA",
  isConnected = true,
  isLoading = false,
  onBack
}) => {
  return (
    <div className="bg-white/95 backdrop-blur-sm sticky top-0 z-20 border-b border-gray-100">
      <div className="max-w-screen-md mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left: Back button */}
          <div className="flex items-center">
            {onBack && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onBack}
                className="mr-3 p-2 rounded-full bg-gray-100 hover:bg-gray-200 border-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
          </div>

          {/* Center: Title */}
          <div className="flex-1 text-center">
            <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
            <div className="flex items-center justify-center space-x-1 mt-0.5">
              {isLoading ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                  <span className="text-xs text-blue-600">Analyse en cours...</span>
                </>
              ) : (
                <>
                  {isConnected ? (
                    <Wifi className="h-3 w-3 text-green-600" />
                  ) : (
                    <WifiOff className="h-3 w-3 text-red-500" />
                  )}
                  <span className="text-xs text-gray-500">
                    {isConnected ? 'Connecté' : 'Hors ligne'}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Right: Status indicators */}
          <div className="w-12"></div>
        </div>
      </div>
    </div>
  );
};
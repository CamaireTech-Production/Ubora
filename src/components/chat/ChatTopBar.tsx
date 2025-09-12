import React from 'react';
import { SlidersHorizontal, Wifi, WifiOff, Loader2, LogOut } from 'lucide-react';
import { Button } from '../Button';

interface ChatTopBarProps {
  title?: string;
  isConnected?: boolean;
  isLoading?: boolean;
  onOpenPanel?: () => void;
  onLogout?: () => void;
}

export const ChatTopBar: React.FC<ChatTopBarProps> = ({
  title = "Assistant IA",
  isConnected = true,
  isLoading = false,
  onOpenPanel,
  onLogout
}) => {
  return (
    <div className="sticky top-0 z-30 bg-white/90 backdrop-blur shadow-sm px-3 py-2">
      <div className="max-w-screen-md mx-auto">
        <div className="flex items-center justify-between">
          {/* Left: Panel button */}
          <div className="flex items-center">
            {onOpenPanel && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onOpenPanel}
                className="p-2 rounded-xl border bg-white hover:bg-gray-50 focus:ring-2 focus:ring-blue-300"
                aria-label="Ouvrir le panneau d'actions"
              >
                <SlidersHorizontal className="h-5 w-5 text-gray-700" />
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

          {/* Right: Logout button */}
          <div className="flex items-center">
            {onLogout && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onLogout}
                className="p-2 rounded-xl border bg-white hover:bg-gray-50 focus:ring-2 focus:ring-red-300"
                aria-label="Se déconnecter"
              >
                <LogOut className="h-5 w-5 text-gray-700" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
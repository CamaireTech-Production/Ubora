import React, { useState } from 'react';
import { UserPlus, Copy, Check } from 'lucide-react';
import { Button } from './Button';
import { useAuth } from '../contexts/AuthContext';

interface ShareCollaboratorButtonProps {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ShareCollaboratorButton: React.FC<ShareCollaboratorButtonProps> = ({
  variant = 'secondary',
  size = 'sm',
  className = ''
}) => {
  const { user } = useAuth();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

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

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setShowInviteModal(true)}
        className={`flex items-center space-x-2 ${className}`}
      >
        <UserPlus className="h-4 w-4" />
        <span>Inviter</span>
      </Button>

      {/* Modal d'invitation */}
      {showInviteModal && (
        <div 
          className="fixed top-0 left-0 right-0 bottom-0 z-[100] bg-black bg-opacity-50 flex items-center justify-center" 
          style={{ 
            margin: 0, 
            padding: 0, 
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh'
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 mx-4">
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
    </>
  );
};

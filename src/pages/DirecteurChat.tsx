import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { useConversation } from '../contexts/ConversationContext';
import { LoadingGuard } from '../components/LoadingGuard';
import { WelcomeScreen } from '../components/WelcomeScreen';
import { ChatTopBar } from '../components/chat/ChatTopBar';
import { MessageList } from '../components/chat/MessageList';
import { ChatComposer } from '../components/chat/ChatComposer';
import { FloatingSidePanel } from '../components/chat/FloatingSidePanel';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  responseTime?: number;
  meta?: {
    period?: string;
    usedEntries?: number;
    forms?: number;
    users?: number;
    tokensUsed?: number;
    model?: string;
  };
}

interface ChatFilters {
  period: string;
  formId: string;
  userId: string;
}

// Configuration de l'endpoint IA
const getAIEndpoint = () => {
  if (import.meta.env.VITE_AI_ENDPOINT) {
    return import.meta.env.VITE_AI_ENDPOINT;
  }
  
  if (import.meta.env.DEV) {
    return 'http://localhost:3000/api/ai/ask';
  }
  
  return null;
};

const AI_ENDPOINT = getAIEndpoint();

if (!AI_ENDPOINT) {
  console.error("❌ Aucun endpoint IA configuré. Le Chat IA ne fonctionnera pas.");
} else {
  console.log("✅ AI_ENDPOINT configuré:", AI_ENDPOINT);
}

export const DirecteurChat: React.FC = () => {
  const { user, firebaseUser, isLoading } = useAuth();
  const { forms, formEntries, employees, isLoading: appLoading } = useApp();
  const { 
    currentConversation, 
    conversations, 
    messages, 
    isLoading: conversationLoading,
    hasMoreMessages,
    createNewConversation,
    loadConversation,
    loadMoreMessages,
    addMessage
  } = useConversation();
  
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [filters, setFilters] = useState<ChatFilters>({
    period: 'today',
    formId: '',
    userId: ''
  });
  
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // États pour le panneau latéral
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'history' | 'filters' | 'forms' | 'employees' | 'entries' | null>(null);

  // État pour l'écran de bienvenue
  const [showWelcome, setShowWelcome] = useState(true);
  const handleSendMessage = async (message?: string) => {
    const messageToSend = message || inputMessage.trim();
    if (!messageToSend || isTyping) return;

    const startTime = Date.now();

    // Create conversation if none exists
    let conversationId = currentConversation?.id;
    if (!conversationId) {
      try {
        conversationId = await createNewConversation();
      } catch (error) {
        console.error('Error creating conversation:', error);
        alert('Erreur lors de la création de la conversation');
        return;
      }
    }

    // Ajouter le message utilisateur
    const userMessage: Message = {
      id: `user_${Date.now()}`,
      type: 'user',
      content: messageToSend,
      timestamp: new Date()
    };

    // Add message to conversation (only if we have a conversation)
    if (currentConversation) {
      try {
        await addMessage(userMessage);
      } catch (error) {
        console.error('Error adding user message:', error);
      }
    }

    setInputMessage('');
    setIsTyping(true);

    try {
      // Vérifier que l'endpoint est configuré
      if (!AI_ENDPOINT) {
        throw new Error('Le Chat IA n\'est pas configuré. Veuillez définir VITE_AI_ENDPOINT dans votre fichier .env.local et redémarrer le serveur.');
      }

      // Récupérer le token Firebase
      const token = await firebaseUser?.getIdToken();
      if (!token) {
        throw new Error('Impossible de récupérer le token d\'authentification. Veuillez vous reconnecter.');
      }
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      const requestData = {
        question: messageToSend,
        filters: {
          period: filters.period,
          formId: filters.formId || undefined,
          userId: filters.userId || undefined
        },
        conversationId: conversationId
      };

      // Timeout de 60 secondes pour laisser plus de temps au traitement IA
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('Request timeout after 60 seconds');
        controller.abort();
      }, 60000);

      console.log('Calling AI endpoint:', AI_ENDPOINT);
      console.log('Request data:', requestData);
      
      const response = await fetch(AI_ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestData),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Essayer de récupérer le message d'erreur du serveur
        let errorMessage = `Erreur serveur IA (HTTP ${response.status})`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // Garder le message par défaut si pas de JSON
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      const responseTime = Date.now() - startTime;

      // Ajouter la réponse de l'assistant
      const assistantMessage: Message = {
        id: `assistant_${Date.now()}`,
        type: 'assistant',
        content: data.answer,
        timestamp: new Date(),
        responseTime,
        meta: data.meta
      };

      // Add assistant message to conversation (only if we have a conversation)
      if (currentConversation) {
        try {
          await addMessage(assistantMessage);
        } catch (error) {
          console.error('Error adding assistant message:', error);
        }
      }

    } catch (error) {
      console.error('Erreur lors de l\'envoi du message:', error);
      
      const responseTime = Date.now() - startTime;
      
      let errorContent = '';
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorContent = `⏱️ **Timeout**\n\nLe serveur IA met trop de temps à répondre (>60s). Cela peut être dû à:\n• Un grand volume de données à analyser\n• Une charge élevée du serveur\n• Un problème de connexion\n\nVeuillez réessayer ou contactez l'administrateur.`;
        } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          errorContent = `🌐 **Erreur de connexion**\n\nImpossible de joindre le serveur IA. Vérifiez:\n• Votre connexion internet\n• La configuration de l'endpoint IA\n• Que le serveur est en ligne\n\nEndpoint configuré: ${AI_ENDPOINT}`;
        } else if (error.message.includes('Chat IA n\'est pas configuré')) {
          errorContent = `⚙️ **Configuration manquante**\n\n${error.message}`;
        } else {
          errorContent = `❌ **Erreur API**\n\n${error.message}\n\nEndpoint: ${AI_ENDPOINT}`;
        }
      } else {
        errorContent = `❌ **Erreur inconnue**\n\nUne erreur inattendue s'est produite. Veuillez réessayer.\n\nEndpoint: ${AI_ENDPOINT}`;
      }
      
      const errorMessage: Message = {
        id: `error_${Date.now()}`,
        type: 'assistant',
        content: errorContent,
        timestamp: new Date(),
        responseTime
      };

      // Try to persist the error message if a conversation exists
      if (currentConversation) {
        try {
          await addMessage(errorMessage);
        } catch (persistError) {
          console.error('Error persisting error message:', persistError);
        }
      }
    } finally {
      setIsTyping(false);
    }
  };

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMoreMessages) return;
    
    setIsLoadingMore(true);
    try {
      await loadMoreMessages();
    } catch (error) {
      console.error('Error loading more messages:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Gérer la fermeture de l'écran de bienvenue
  const handleWelcomeContinue = () => {
    setShowWelcome(false);
  };

  return (
    <LoadingGuard 
      isLoading={isLoading || appLoading} 
      user={user} 
      firebaseUser={firebaseUser}
      message="Chargement du Chat IA..."
    >
      <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-white">
        {/* Container centré pour toute l'interface */}
        <div className="max-w-screen-md mx-auto flex flex-col h-screen">
          
          {/* Top bar */}
          <ChatTopBar
            title="Assistant IA"
            isConnected={!!AI_ENDPOINT}
            isLoading={isTyping}
            onOpenPanel={() => setPanelOpen(true)}
          />

          {/* Messages list */}
          <MessageList
            messages={messages}
            isTyping={isTyping}
            hasMoreMessages={hasMoreMessages}
            isLoadingMore={isLoadingMore}
            onLoadMore={handleLoadMore}
          />

          {/* Composer */}
          <ChatComposer
            value={inputMessage}
            onChange={setInputMessage}
            onSend={() => handleSendMessage()}
            disabled={isTyping}
            placeholder="Posez une question sur vos données..."
          />

          {/* Floating side panel */}
          <FloatingSidePanel
            open={panelOpen}
            onOpenChange={setPanelOpen}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            filters={filters}
            onFiltersChange={setFilters}
            conversations={conversations}
            forms={forms}
            employees={employees}
            formEntries={formEntries}
            onLoadConversation={loadConversation}
            onCreateConversation={createNewConversation}
            onGoDashboard={() => (window.location.href = '/directeur/dashboard')}
          />
          {/* Welcome overlay */}
          {showWelcome && (
            <WelcomeScreen
              userName={user?.name}
              onContinue={handleWelcomeContinue}
              rememberKey="directeur_chat_welcome"
              show
            />
          )}
        </div>
      </div>
    </LoadingGuard>
  );
};
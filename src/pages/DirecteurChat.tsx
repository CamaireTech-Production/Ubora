import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { useConversation } from '../contexts/ConversationContext';
import { LoadingGuard } from '../components/LoadingGuard';
import { WelcomeScreen } from '../components/WelcomeScreen';
import { ChatTopBar } from '../components/chat/ChatTopBar';
import { MessageList } from '../components/chat/MessageList';
import { ChatComposer } from '../components/chat/ChatComposer';
import { FloatingSidePanel } from '../components/chat/FloatingSidePanel';
import { Footer } from '../components/Footer';
import { ResponseParser } from '../utils/ResponseParser';
import { ChatMessage } from '../types';

// Remove the old Message interface since we're using ChatMessage from types

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
  console.error("❌ Aucun endpoint IA configuré. ARCHA ne fonctionnera pas.");
} else {
  console.log("✅ AI_ENDPOINT configuré:", AI_ENDPOINT);
}

export const DirecteurChat: React.FC = () => {
  const { user, firebaseUser, isLoading, logout } = useAuth();
  const { forms, formEntries, employees, isLoading: appLoading } = useApp();
  const { 
    currentConversation, 
    conversations, 
    messages, 
    hasMoreMessages,
    createNewConversation,
    loadConversation,
    loadMoreMessages,
    addMessage
  } = useConversation();
  
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  const [selectedFormIds, setSelectedFormIds] = useState<string[]>([]);
  const [filters, setFilters] = useState<ChatFilters>({
    period: 'all',
    formId: '',
    userId: ''
  });
  
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // États pour le panneau latéral
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'history' | 'forms' | 'employees' | 'entries' | null>(null);

  // État pour l'écran de bienvenue (uniquement juste après login)
  const [showWelcome, setShowWelcome] = useState(() => {
    try {
      const shouldShow = sessionStorage.getItem('show_welcome_after_login') === 'true';
      return shouldShow;
    } catch {
      return false;
    }
  });
  const handleSendMessage = async (message?: string) => {
    const messageToSend = message || inputMessage.trim();
    if (!messageToSend || isTyping) return;

    const startTime = Date.now();

    // Use all forms if none are selected
    const formsToAnalyze = selectedFormIds.length > 0 ? selectedFormIds : forms.map(form => form.id);

    // Determine the actual format(s) to use
    const actualFormats = selectedFormats.length > 0 ? selectedFormats : (selectedFormat ? [selectedFormat] : []);
    const isMultiFormat = actualFormats.length > 1;

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
    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      type: 'user',
      content: messageToSend,
      timestamp: new Date(),
        meta: {
          selectedFormat: isMultiFormat ? null : actualFormats[0],
          selectedFormats: actualFormats,
          selectedFormIds: formsToAnalyze,
          selectedFormTitles: forms.filter(form => formsToAnalyze.includes(form.id)).map(form => form.title)
        }
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
        throw new Error('ARCHA n\'est pas configuré. Veuillez définir VITE_AI_ENDPOINT dans votre fichier .env.local et redémarrer le serveur.');
      }

      // Récupérer le token Firebase
      const token = await firebaseUser?.getIdToken();
      if (!token) {
        throw new Error('Impossible de récupérer le token d\'authentification. Veuillez vous reconnecter.');
      }
      
      const makeHeaders = (t: string): Record<string, string> => ({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${t}`
      });

      // Get form submissions for debugging
      const relevantSubmissions = formEntries.filter(entry => 
        formsToAnalyze.includes(entry.formId)
      );
      
      console.log('🔍 DEBUG - Form Analysis Data:');
      console.log('📋 Total forms available:', forms.length);
      console.log('📋 Forms to analyze:', formsToAnalyze);
      console.log('📋 Selected form IDs:', selectedFormIds);
      console.log('📋 All form IDs:', forms.map(f => f.id));
      console.log('📊 Total form entries:', formEntries.length);
      console.log('📊 Relevant submissions:', relevantSubmissions.length);
      console.log('📊 Submissions by form:', formsToAnalyze.map(formId => {
        const formSubmissions = formEntries.filter(entry => entry.formId === formId);
        const formTitle = forms.find(f => f.id === formId)?.title || 'Unknown';
        return { formId, formTitle, count: formSubmissions.length };
      }));
      console.log('📊 Sample submissions:', relevantSubmissions.slice(0, 3));

      console.log('🔍 DEBUG - Format Selection:');
      console.log('📋 selectedFormat:', selectedFormat);
      console.log('📋 selectedFormats:', selectedFormats);
      console.log('📋 actualFormats:', actualFormats);
      console.log('📋 isMultiFormat:', isMultiFormat);
      
      const requestData = {
        question: messageToSend,
        filters: {
          period: filters.period,
          formId: filters.formId || undefined,
          userId: filters.userId || undefined
        },
        selectedFormats: formsToAnalyze,
        responseFormat: isMultiFormat ? 'multi-format' : (actualFormats[0] || null),
        selectedResponseFormats: actualFormats,
        conversationId: conversationId
      };

      // Timeout de 60 secondes pour laisser plus de temps au traitement IA
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('Request timeout after 60 seconds');
        controller.abort();
      }, 60000);

      console.log('🤖 AI Request Details:');
      console.log('🔗 Endpoint:', AI_ENDPOINT);
      console.log('📤 Request data:', JSON.stringify(requestData, null, 2));
      console.log('👤 User:', user?.name, user?.email);
      console.log('🏢 Agency ID:', user?.agencyId);
      
      let response = await fetch(AI_ENDPOINT, {
        method: 'POST',
        headers: makeHeaders(token),
        body: JSON.stringify(requestData),
        signal: controller.signal
      });

      // If token has expired or is invalid, refresh once and retry
      if (response.status === 401) {
        try {
          const freshToken = await firebaseUser?.getIdToken(true);
          if (freshToken) {
            response = await fetch(AI_ENDPOINT, {
              method: 'POST',
              headers: makeHeaders(freshToken),
              body: JSON.stringify(requestData),
              signal: controller.signal
            });
          }
        } catch (refreshErr) {
          console.error('Failed to refresh token:', refreshErr);
        }
      }

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

      console.log('🤖 AI Response Details:');
      console.log('📥 Response status:', response.status);
      console.log('📥 Response data:', JSON.stringify(data, null, 2));
      console.log('⏱️ Response time:', Date.now() - startTime, 'ms');

      const responseTime = Date.now() - startTime;

      // Parse the AI response to detect graph/PDF data
      const parsedResponse = ResponseParser.parseAIResponse(data.answer, messageToSend, isMultiFormat ? null : actualFormats[0], actualFormats);

      // Create assistant message with parsed content
      const assistantMessage = ResponseParser.createMessageFromParsedResponse(
        parsedResponse,
        `assistant_${Date.now()}`,
        responseTime,
        {
          ...data.meta,
          selectedFormat: isMultiFormat ? null : actualFormats[0],
          selectedFormats: actualFormats,
          selectedFormIds: formsToAnalyze,
          selectedFormTitles: forms.filter(form => formsToAnalyze.includes(form.id)).map(form => form.title)
        }
      );

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
        } else if (error.message.includes('ARCHA n\'est pas configuré')) {
          errorContent = `⚙️ **Configuration manquante**\n\n${error.message}`;
        } else {
          errorContent = `❌ **Erreur API**\n\n${error.message}\n\nEndpoint: ${AI_ENDPOINT}`;
        }
      } else {
        errorContent = `❌ **Erreur inconnue**\n\nUne erreur inattendue s'est produite. Veuillez réessayer.\n\nEndpoint: ${AI_ENDPOINT}`;
      }
      
      const errorMessage: ChatMessage = {
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

  const handleFormatChange = (format: string | null) => {
    console.log('🔄 Single format changed:', format);
    setSelectedFormat(format);
    // Clear multi-format when using single format
    if (format) {
      setSelectedFormats([]);
    }
  };

  const handleFormatsChange = (formats: string[]) => {
    console.log('🔄 Multi-format changed:', formats);
    setSelectedFormats(formats);
    // Clear single format when using multi-format
    if (formats.length > 0) {
      setSelectedFormat(null);
    }
  };

  const handleFormSelectionChange = (formIds: string[]) => {
    setSelectedFormIds(formIds);
  };



  // Gérer la fermeture de l'écran de bienvenue
  const handleWelcomeContinue = () => {
    setShowWelcome(false);
    try { sessionStorage.removeItem('show_welcome_after_login'); } catch {}
  };

  // Afficher uniquement l'écran de bienvenue sans afficher le chat en arrière-plan
  if (showWelcome) {
    return (
      <LoadingGuard 
        isLoading={isLoading || appLoading} 
        user={user} 
        firebaseUser={firebaseUser}
        message="Chargement d'Ubora..."
      >
        <WelcomeScreen
          userName={user?.name}
          onContinue={handleWelcomeContinue}
          rememberKey="directeur_chat_welcome"
          show
        />
      </LoadingGuard>
    );
  }

  return (
    <LoadingGuard 
      isLoading={isLoading || appLoading} 
      user={user} 
      firebaseUser={firebaseUser}
      message="ARCHA loading..."
    >
      <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-white">
        {/* Container centré pour toute l'interface */}
        <div className="max-w-screen-md mx-auto flex flex-col h-screen">
          
          {/* Top bar */}
          <ChatTopBar
            title="ARCHA"
            isConnected={!!AI_ENDPOINT}
            isLoading={isTyping}
            onOpenPanel={() => setPanelOpen(true)}
            onLogout={logout}
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
            selectedFormat={selectedFormat}
            selectedFormats={selectedFormats}
            onFormatChange={handleFormatChange}
            onFormatsChange={handleFormatsChange}
            forms={forms}
            employees={employees}
            filters={filters}
            onFiltersChange={setFilters}
            selectedFormIds={selectedFormIds}
            onFormSelectionChange={handleFormSelectionChange}
            disabled={isTyping}
            placeholder="Posez une question sur vos données..."
            showFormatSelector={true}
            showComprehensiveFilter={true}
            allowMultipleFormats={true}
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
        </div>
      </div>
      
      <Footer />
    </LoadingGuard>
  );
};
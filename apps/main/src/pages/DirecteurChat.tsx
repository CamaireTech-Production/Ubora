import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { useApp } from '@ubora/shared/contexts/AppContext';
import { useConversation } from '@ubora/shared/contexts/ConversationContext';
import { useAIResponse } from '@ubora/shared/contexts/AIResponseContext';
import { LoadingGuard } from '../components/LoadingGuard';
import { WelcomeScreen } from '../components/WelcomeScreen';
import { ChatTopBar } from '../components/chat/ChatTopBar';
import MessageList from '../components/chat/MessageList';
import { ChatComposer } from '../components/chat/ChatComposer';
import { FloatingSidePanel } from '../components/chat/FloatingSidePanel';
import { Footer } from '../components/Footer';
import { ChatMessage } from '../types';
import { useToast } from '@ubora/shared/hooks/useToast';
import { usePackageAccess } from '@ubora/shared/hooks/usePackageAccess';
import { TokenCounter } from '@ubora/shared/services/tokenCounter';
import { PayAsYouGoModal } from '../components/PayAsYouGoModal';
import { LimitReachedModal } from '../components/LimitReachedModal';
import { AnalyticsService } from '@ubora/shared/services/analyticsService';
import { LogoutConfirmationModal } from '../components/LogoutConfirmationModal';
import { ImpersonationHeader } from '../components/ImpersonationHeader';
// import { MemoizedConnectionQualityIndicator, useConnectionQuality } from '../components/ConnectionQualityIndicator';
import { enhancedFetch } from '@ubora/shared/utils/errorHandling'; // Enhanced error handling with retry logic

// Remove the old Message interface since we're using ChatMessage from types

interface ChatFilters {
  period: string;
  formId: string;
  userId: string;
}

// Import centralized API configuration
import { getAIEndpoint } from '@ubora/shared/config/api';

// Get AI endpoint from centralized configuration
const AI_ENDPOINT = getAIEndpoint();
console.log('🎯 Final AI_ENDPOINT:', AI_ENDPOINT);

if (!AI_ENDPOINT) {
  console.error("❌ Aucun endpoint ARCHA configuré. ARCHA ne fonctionnera pas.");
}

export const DirecteurChat: React.FC = () => {
  const navigate = useNavigate();
  const { user, firebaseUser, isLoading, logout, refreshUserData, updateTokensLocally } = useAuth();
  const { forms, formEntries, employees, isLoading: appLoading } = useApp();
  const { setAIResponseActive } = useAIResponse();
  
  
  // Use ref to track AI state without causing rerenders
  const isAIActiveRef = useRef(false);
  
  // Global flag to prevent AppContext updates during AI responses
  const aiResponseActiveRef = useRef(false);
  const { getMonthlyTokens, hasUnlimitedTokens, packageInfo } = usePackageAccess();
  
  // Debug logs to track rerenders
  const { 
    currentConversation, 
    conversations, 
    messages, 
    hasMoreMessages,
    createNewConversation,
    loadConversation,
    loadMoreMessages,
    addMessageToLocalState,
    replaceOptimisticMessage,
    triggerAutoLoad
  } = useConversation();
  
  
  
  // Conversation state debug removed to prevent rerenders
  
  const { showError } = useToast();
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingMessage, setTypingMessage] = useState<string | undefined>(undefined);
  const typingSoftTimerRef = useRef<number | null>(null);
  const typingHardTimerRef = useRef<number | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);
  
  // Ref for direct input access without re-renders
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Ref to track last processed message to avoid unnecessary updates
  const lastProcessedMessageIdRef = useRef<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  const [selectedFormIds, setSelectedFormIds] = useState<string[]>([]);
  const [filters, setFilters] = useState<ChatFilters>({
    period: 'all',
    formId: '',
    userId: ''
  });
  
  // Track keyboard height for proper layout adjustment
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  
  
  // Keyboard detection for proper layout adjustment
  useEffect(() => {
    const handleViewportChange = () => {
      if (!window.visualViewport) return;
      
      const initialHeight = window.innerHeight;
      const currentHeight = window.visualViewport.height;
      const heightDifference = initialHeight - currentHeight;
      
      setKeyboardHeight(heightDifference > 30 ? heightDifference : 0);
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
    } else {
      window.addEventListener('resize', handleViewportChange);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
      } else {
        window.removeEventListener('resize', handleViewportChange);
      }
    };
  }, []);
  
  // Auto-scroll when keyboard opens to keep input visible - immediate
  useEffect(() => {
    if (keyboardHeight > 0) {
      // Immediate scroll when keyboard opens - no delay
      const messageList = document.querySelector('.flex-1.overflow-y-auto');
      if (messageList) {
        messageList.scrollTo({
          top: messageList.scrollHeight,
          behavior: 'auto' // Instant scroll, no animation
        });
      }
    }
  }, [keyboardHeight]);
  
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // États pour le panneau latéral
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'history' | 'forms' | 'employees' | 'entries' | null>(null);
  
  // Connection quality tracking - Disabled to prevent reloads
  // const { quality, updateQuality } = useConnectionQuality();
  
  // Track the last message count to detect new messages
  const [lastMessageCount, setLastMessageCount] = useState(0);
  
  // État pour le modal pay-as-you-go
  const [showPayAsYouGoModal, setShowPayAsYouGoModal] = useState(false);
  
  // État pour le modal de limite de tokens
  const [showTokenLimitModal, setShowTokenLimitModal] = useState(false);

  // État pour le modal de confirmation de déconnexion
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // État pour l'écran de bienvenue (uniquement juste après login)
  const [showWelcome, setShowWelcome] = useState(() => {
    try {
      const shouldShow = sessionStorage.getItem('show_welcome_after_login') === 'true';
      return shouldShow;
    } catch {
      return false;
    }
  });


  // Memoize package calculations for performance - only recalculate when user.id changes
  // Don't depend on tokensUsedMonthly as tokens are managed in subscriptionSessions
  // getMonthlyTokens and hasUnlimitedTokens are now memoized with useCallback
  const packageCalculations = useMemo(() => {
    const monthlyLimit = getMonthlyTokens();
    const isUnlimited = hasUnlimitedTokens();
    return { monthlyLimit, isUnlimited };
  }, [user?.id, user?.tokensUsedMonthly]);
  const handlePurchaseTokens = async (tokens: number) => {
    // This function is now handled by the PayAsYouGoModal with Campay integration
    // The modal will create the payment and handle the success/failure
    // This callback is kept for backward compatibility but won't be used
    // since the PayAsYouGoModal now handles the payment flow directly
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
      setShowLogoutModal(false);
    }
  };

  // Watch for new assistant messages to hide loading indicator
  useEffect(() => {
    if (isTyping && messages.length > 0) {
      // Check if the last message is from assistant and is new
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.type === 'assistant' && lastMessage.id !== lastProcessedMessageIdRef.current) {
        // New assistant message appeared, hide loading indicator
        setIsTyping(false);
        lastProcessedMessageIdRef.current = lastMessage.id;
      }
    }
    // Only update lastMessageCount if it actually changed
    if (messages.length !== lastMessageCount) {
      setLastMessageCount(messages.length);
    }
  }, [messages, isTyping, lastMessageCount]);

  // Fallback: Auto-load conversations when component mounts and conversations are available
  // This ensures chats load even if welcome screen logic fails
  useEffect(() => {
    const shouldAutoLoad = !showWelcome && conversations.length > 0 && !currentConversation && !isLoading;
    if (shouldAutoLoad) {
      const timeoutId = setTimeout(async () => {
        try {
          await triggerAutoLoad();
        } catch (error) {
          console.error('Error in fallback auto-load:', error);
        }
      }, 500); // Delay to ensure all contexts are properly initialized
      
      return () => clearTimeout(timeoutId);
    }
  }, [showWelcome, conversations.length, currentConversation, isLoading, triggerAutoLoad]);

  const handleSendMessage = async (message?: string) => {
    
    // Get message from parameter, state, or direct input access
    let messageToSend = message;
    if (!messageToSend) {
      // Try to get from ChatComposer's local state via ref
      if (inputRef.current) {
        messageToSend = inputRef.current.value.trim();
      } else {
        messageToSend = inputMessage.trim();
      }
    }
    
    if (!messageToSend || isTyping) {
      return;
    }

    // Vérifier les tokens avant d'envoyer
    if (user) {
      const { isUnlimited } = packageCalculations;
      
      if (!isUnlimited) {
        // Estimate tokens needed for this request
        // Use the full system prompt for accurate estimation
        const estimatedSystemPrompt = `Tu es ARCHA, assistant spécialisé dans l'analyse de données de formulaires d'entreprise.
RÈGLES :
- Réponds UNIQUEMENT en français
- Utilise UNIQUEMENT les données fournies
- Ne JAMAIS inventer de données
- Si données insuffisantes, dis-le clairement

ANALYSE :
- Analyse les données fournies
- Identifie les tendances et patterns
- Fournis des insights actionables
- Propose des recommandations concrètes

RÉPONSE :
- Structure claire et professionnelle
- Utilise des émojis appropriés
- Inclus des métriques précises
- Référence les données sources`;

        const estimatedTokens = TokenCounter.getTotalEstimatedTokens(estimatedSystemPrompt, messageToSend, 800);
        // Use same formula as backend: (estimatedTokens * 2.5) / 100
        const userTokensToCharge = Math.min(Math.ceil((estimatedTokens * 2.5) / 100), 3000); // Cap at 3000 tokens
        
        // Use session-based token checking (same as backend)
        const currentTokensUsed = packageInfo?.tokensUsed || 0;
        const totalAvailableTokens = packageInfo?.totalTokens || 0;
        
        // Token check completed
        
        if (currentTokensUsed + userTokensToCharge > totalAvailableTokens) {
          // Show limit reached modal instead of pay-as-you-go modal
          setShowTokenLimitModal(true);
          return;
        }
      }
    }

    const startTime = Date.now();

    // Use all forms if none are selected
    const formsToAnalyze = selectedFormIds.length > 0 ? selectedFormIds : forms.map(form => form.id);

    // Determine the actual format(s) to use
    const actualFormats = selectedFormats.length > 0 ? selectedFormats : (selectedFormat ? [selectedFormat] : []);
    const isMultiFormat = actualFormats.length > 1;
    
    // Get form titles for display
    const formTitles = forms.filter(form => formsToAnalyze.includes(form.id)).map(form => form.title);

    // Create conversation if none exists
    let conversationId = currentConversation?.id;
    if (!conversationId) {
      try {
        conversationId = await createNewConversation();
      } catch (error) {
        console.error('Error creating conversation:', error);
        showError('Erreur lors de la création de la conversation');
        return;
      }
    }

    // Create user message for immediate display
    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      type: 'user',
      content: messageToSend,
      timestamp: new Date(),
      meta: {
        // Only include format info if formats are actually selected
        ...(actualFormats.length > 0 ? {
          ...(isMultiFormat ? {} : { selectedFormat: actualFormats[0] }),
          selectedFormats: actualFormats
        } : {}),
        // Always include form info (will show all forms if none selected)
        selectedFormIds: formsToAnalyze,
        selectedFormTitles: formTitles
      }
    };

    // Add user message to local state for immediate display (optimistic update)
    if (currentConversation) {
      try {
        // Add to local state for immediate display
        // The backend will return the real message to replace this one
        addMessageToLocalState(userMessage);
      } catch (error) {
        console.error('Error adding user message to local state:', error);
      }
    }

    // Clear input after sending
        // Set AI active to prevent appLoading rerenders
        isAIActiveRef.current = true;
        
        // Mark AI response as active to prevent context updates
        aiResponseActiveRef.current = true;
        setAIResponseActive(true);
    
    setInputMessage('');
    setIsTyping(true);
    setTypingMessage('ARCHA analyse vos données...');
    const reqId = `req_${Date.now()}`;
    activeRequestIdRef.current = reqId;
    
    // Request initialized
    if (typingSoftTimerRef.current) { window.clearTimeout(typingSoftTimerRef.current); typingSoftTimerRef.current = null; }
    if (typingHardTimerRef.current) { window.clearTimeout(typingHardTimerRef.current); typingHardTimerRef.current = null; }
    typingSoftTimerRef.current = window.setTimeout(() => {
      if (activeRequestIdRef.current === reqId) {
        setTypingMessage('⏳ Toujours en cours... ARCHA traite votre demande.');
      }
    }, 30000);
    typingHardTimerRef.current = window.setTimeout(() => {
      if (activeRequestIdRef.current === reqId) {
        setTypingMessage('⏱️ ARCHA prend plus de temps que prévu à traiter votre demande...');
      }
    }, 60000);

    // Loading indicator will be shown by MessageList component via isTyping prop

    try {
      // Get AI endpoint dynamically from centralized configuration
      // This ensures the URL is always up-to-date based on the current environment
      const aiEndpoint = getAIEndpoint();
      
      if (!aiEndpoint) {
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
      

      // Use enhanced fetch with retry logic and better error handling
      let response = await enhancedFetch.aiRequest(aiEndpoint, {
        method: 'POST',
        headers: makeHeaders(token),
        body: JSON.stringify(requestData),
        timeout: 60000
      });
      

      // If token has expired or is invalid, refresh once and retry
      if (response.status === 401) {
        try {
          const freshToken = await firebaseUser?.getIdToken(true);
          if (freshToken) {
            response = await enhancedFetch.aiRequest(aiEndpoint, {
              method: 'POST',
              headers: makeHeaders(freshToken),
              body: JSON.stringify(requestData),
              timeout: 60000
            });
          }
        } catch (refreshErr) {
          console.error('Failed to refresh token:', refreshErr);
        }
      }

      if (!response.ok) {
        // Essayer de récupérer le message d'erreur du serveur
        let errorMessage = `Erreur serveur ARCHA (HTTP ${response.status})`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
          
          // Handle insufficient tokens (402)
          if (response.status === 402 && errorData.code === 'INSUFFICIENT_TOKENS') {
            setShowPayAsYouGoModal(true);
            return;
          }
          
          // Handle subscription expired (402)
          if (response.status === 402 && errorData.code === 'SUBSCRIPTION_EXPIRED') {
            showError('Votre abonnement a expiré. Veuillez renouveler votre abonnement pour continuer.');
            return;
          }
        } catch {
          // Garder le message par défaut si pas de JSON
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      // Clear loading state immediately when response is received
      setIsTyping(false);
      setTypingMessage(undefined);
      if (typingSoftTimerRef.current) { window.clearTimeout(typingSoftTimerRef.current); typingSoftTimerRef.current = null; }
      if (typingHardTimerRef.current) { window.clearTimeout(typingHardTimerRef.current); typingHardTimerRef.current = null; }
      activeRequestIdRef.current = null;

      // Replace optimistic user message with the real one from backend (if available)
      if (data.userMessage && currentConversation) {
        try {
          // Convert the backend message to frontend format
          const realUserMessage: ChatMessage = {
            id: data.userMessage.id,
            type: data.userMessage.type,
            content: data.userMessage.content,
            timestamp: data.userMessage.timestamp?.toDate ? data.userMessage.timestamp.toDate() : new Date(data.userMessage.timestamp),
            meta: data.userMessage.meta
          };
          
          // Replace the optimistic message with the real one
          replaceOptimisticMessage(userMessage.id, realUserMessage);
        } catch (error) {
          console.error('Error replacing optimistic user message:', error);
        }
      }

      // Tokens are now deducted on the server side in subscriptionSessions collection
      // No need to update user.tokensUsedMonthly as tokens are managed in sessions
      if (user && data.meta?.userTokensCharged) {
        // Update user data locally to reflect new token counts
        // Use a timeout to debounce the refresh and prevent immediate re-renders
        try {
          setTimeout(async () => {
            try {
              await refreshUserData();
            } catch (refreshError) {
              console.error('❌ FRONTEND: Failed to refresh user data after token deduction:', refreshError);
            }
          }, 1000); // 1 second delay to allow UI to settle
        } catch (refreshError) {
          console.error('❌ FRONTEND: Failed to schedule user data refresh:', refreshError);
        }
        
        // Track chat activity analytics
        try {
          await AnalyticsService.logChatActivity(
            user.id, 
            data.meta.userTokensCharged, 
            user.agencyId
          );
        } catch (analyticsError) {
          console.error('❌ FRONTEND: Failed to log chat activity:', analyticsError);
        }
      }

      // Server handles message persistence in Firebase
      // The real-time listener will pick up the message from Firebase
      // No need to add to local state as the listener will handle it
      
      // Successfully received response, stop loading
      setIsTyping(false);
      setTypingMessage(undefined);
      if (typingSoftTimerRef.current) { window.clearTimeout(typingSoftTimerRef.current); typingSoftTimerRef.current = null; }
      if (typingHardTimerRef.current) { window.clearTimeout(typingHardTimerRef.current); typingHardTimerRef.current = null; }
      activeRequestIdRef.current = null;
      
      // Update connection quality based on response time
      const responseTime = Date.now() - startTime;
      updateQuality(responseTime);
      
      // Remove loading message from local state
      if (currentConversation) {
        try {
          // The loading message will be replaced by the actual response from the backend
          // The real-time listener will handle the replacement automatically
        } catch (error) {
          console.error('Error removing loading message:', error);
        }
      }

    } catch (error) {
      console.error('Erreur lors de l\'envoi du message:', error);
      
      const responseTime = Date.now() - startTime;
      
      let errorContent = '';
      
      if (error instanceof Error) {
        // Use the enhanced error message from our error handler
        errorContent = error.message;
        
        // Add additional context for specific error types
        if (error.message.includes('Connexion lente détectée')) {
          errorContent += `\n\n💡 **Conseils:**\n• Vérifiez votre connexion internet\n• Réessayez dans quelques instants\n• Contactez le support si le problème persiste`;
        } else if (error.message.includes('Problème de connexion réseau')) {
          errorContent += `\n\n💡 **Solutions:**\n• Vérifiez votre connexion WiFi/4G\n• Redémarrez votre routeur si nécessaire\n• Réessayez dans quelques minutes`;
        } else if (error.message.includes('Impossible de joindre')) {
          errorContent += `\n\n💡 **Actions:**\n• ARCHA est temporairement indisponible\n• Réessayez dans 5-10 minutes\n• Contactez l'administrateur si le problème persiste`;
        } else if (error.message.includes('Configuration manquante')) {
          errorContent += `\n\n💡 **Solution:**\n• Contactez l'administrateur système\n• Vérifiez la configuration du serveur`;
        }
      } else {
        const aiEndpoint = getAIEndpoint();
        errorContent = `❌ **Erreur inattendue**\n\nUne erreur inattendue s'est produite. Veuillez réessayer.\n\nEndpoint: ${aiEndpoint || 'Non configuré'}`;
      }
      
      const errorMessage: ChatMessage = {
        id: `error_${Date.now()}`,
        type: 'assistant',
        content: errorContent,
        timestamp: new Date(),
        responseTime
      };

      // Add error message to local state (errors are not persisted by server)
      if (currentConversation) {
        try {
          addMessageToLocalState(errorMessage);
        } catch (error) {
          console.error('Error adding error message to local state:', error);
        }
      }
      
          // Clear AI active state on error
          isAIActiveRef.current = false;
          
          // Clear AI response flag on error
          aiResponseActiveRef.current = false;
          setAIResponseActive(false);
    } finally {
      // Keep typing bubble until success or explicit error handling
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

  const handleFormatChange = useCallback((format: string | null) => {
    setSelectedFormat(format);
    // Clear multi-format when using single format
    if (format) {
      setSelectedFormats([]);
    }
  }, []);

  const handleFormatsChange = useCallback((formats: string[]) => {
    setSelectedFormats(formats);
    // Clear single format when using multi-format
    if (formats.length > 0) {
      setSelectedFormat(null);
    }
  }, []);

  const handleFormSelectionChange = useCallback((formIds: string[]) => {
    setSelectedFormIds(formIds);
  }, []);



  // Gérer la fermeture de l'écran de bienvenue
  const handleWelcomeContinue = async () => {
    setShowWelcome(false);
    try { sessionStorage.removeItem('show_welcome_after_login'); } catch {}
    
    // Trigger auto-load of conversations after welcome screen is dismissed
    // This ensures chats are loaded when the user actually sees the chat interface
    setTimeout(async () => {
      try {
        await triggerAutoLoad();
      } catch (error) {
        console.error('Error triggering auto-load after welcome screen:', error);
      }
    }, 100); // Small delay to ensure state updates are complete
  };

  // Afficher uniquement l'écran de bienvenue sans afficher le chat en arrière-plan
  if (showWelcome) {
    return (
      <LoadingGuard 
        isLoading={isLoading || (appLoading && !isAIActiveRef.current && !isTyping)} 
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
        isLoading={isLoading || (appLoading && !isAIActiveRef.current && !isTyping)} 
        user={user} 
        firebaseUser={firebaseUser}
        message="ARCHA loading..."
      >
      {/* Connection Quality Indicator - Removed to prevent reloads */}
      {/* <MemoizedConnectionQualityIndicator quality={quality} /> */}
      
      <ImpersonationHeader />
      <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-white">
        {/* Container centré pour toute l'interface */}
        <div 
          className="max-w-7xl mx-auto flex flex-col px-0 sm:px-6 lg:px-8" 
          style={{ 
            height: keyboardHeight > 0 ? `calc(100dvh - ${keyboardHeight}px)` : '100dvh',
            minHeight: keyboardHeight > 0 ? `calc(100dvh - ${keyboardHeight}px)` : '100dvh'
          }}
        >
          
          {/* Top bar */}
          <ChatTopBar
            title="ARCHA"
            isLoading={isTyping}
            onOpenPanel={() => setPanelOpen(true)}
            onLogout={() => setShowLogoutModal(true)}
          />

          {/* Messages list */}
      <MessageList
            messages={messages}
        isTyping={isTyping}
        typingMessage={typingMessage}
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
            inputRef={inputRef}
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
            onGoDashboard={() => navigate('/directeur/dashboard')}
            onGoScheduledQuestions={() => navigate('/directeur/scheduled-questions')}
          />

          {/* Token Limit Modal */}
          <LimitReachedModal
            isOpen={showTokenLimitModal}
            onClose={() => setShowTokenLimitModal(false)}
            type="tokens"
            current={packageInfo?.tokensUsed || 0}
            limit={packageInfo?.totalTokens || 0}
            onUpgrade={() => setShowTokenLimitModal(false)}
            onPayAsYouGo={() => setShowTokenLimitModal(false)}
          />

          {/* Pay-as-you-go Modal */}
          <PayAsYouGoModal
            isOpen={showPayAsYouGoModal}
            onClose={() => setShowPayAsYouGoModal(false)}
            onPurchase={handlePurchaseTokens}
            currentTokens={user?.tokensUsedMonthly || 0}
            packageLimit={getMonthlyTokens()}
            payAsYouGoTokens={user?.payAsYouGoTokens || 0}
            requiredTokens={0}
          />

          {/* Logout Confirmation Modal */}
          <LogoutConfirmationModal
            isOpen={showLogoutModal}
            onClose={() => setShowLogoutModal(false)}
            onConfirm={handleLogout}
            isLoading={isLoggingOut}
          />
        </div>
      </div>
      
      <Footer />
    </LoadingGuard>
  );
};
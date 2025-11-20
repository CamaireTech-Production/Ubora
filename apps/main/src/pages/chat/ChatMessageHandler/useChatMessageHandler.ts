import { useState, useRef, useCallback, useEffect } from 'react';
import { ChatMessage } from '../../../types';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { useConversation } from '@ubora/shared/contexts/ConversationContext';
import { useAIResponse } from '@ubora/shared/contexts/AIResponseContext';
import { useToast } from '@ubora/shared/hooks/useToast';
import { usePackageAccess } from '../../../hooks/packages/usePackageAccess';
import { TokenCounter } from '../../../services/core/tokenCounter';
import { AnalyticsService } from '@ubora/shared/services/analyticsService';
import { enhancedFetch } from '@ubora/shared/utils/errorHandling';
import { getAIEndpoint } from '@ubora/shared/config/api';
import { logger } from '@ubora/shared/utils/logger';

interface ChatFilters {
  period: string;
  formId: string;
  userId: string;
}

interface UseChatMessageHandlerProps {
  forms: Array<{ id: string; title: string }>;
  filters: ChatFilters;
  selectedFormIds: string[];
  selectedFormat: string | null;
  selectedFormats: string[];
  inputRef: React.RefObject<HTMLTextAreaElement>;
  inputMessage: string;
  setInputMessage: (value: string) => void;
  onTokenLimitReached: () => void;
  onPayAsYouGo: () => void;
  refreshUserData: () => Promise<void>;
}

export const useChatMessageHandler = ({
  forms,
  filters,
  selectedFormIds,
  selectedFormat,
  selectedFormats,
  inputRef,
  inputMessage,
  setInputMessage,
  onTokenLimitReached,
  onPayAsYouGo,
  refreshUserData
}: UseChatMessageHandlerProps) => {
  const { user, firebaseUser } = useAuth();
  const { 
    currentConversation,
    messages,
    createNewConversation,
    addMessageToLocalState,
    replaceOptimisticMessage
  } = useConversation();
  const { setAIResponseActive } = useAIResponse();
  const { showError } = useToast();
  const { packageInfo, hasUnlimitedTokens } = usePackageAccess();
  
  const [isTyping, setIsTyping] = useState(false);
  const [typingMessage, setTypingMessage] = useState<string | undefined>(undefined);
  const typingSoftTimerRef = useRef<number | null>(null);
  const typingHardTimerRef = useRef<number | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);
  const isAIActiveRef = useRef(false);
  const aiResponseActiveRef = useRef(false);
  
  // Watch for new assistant messages to hide loading indicator
  const lastProcessedMessageIdRef = useRef<string | null>(null);

  // Watch for new assistant messages to hide loading indicator
  useEffect(() => {
    if (isTyping && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.type === 'assistant' && lastMessage.id !== lastProcessedMessageIdRef.current) {
        setIsTyping(false);
        setTypingMessage(undefined);
        lastProcessedMessageIdRef.current = lastMessage.id;
      }
    }
  }, [messages, isTyping]);

  const clearTypingState = useCallback(() => {
    setIsTyping(false);
    setTypingMessage(undefined);
    if (typingSoftTimerRef.current) {
      window.clearTimeout(typingSoftTimerRef.current);
      typingSoftTimerRef.current = null;
    }
    if (typingHardTimerRef.current) {
      window.clearTimeout(typingHardTimerRef.current);
      typingHardTimerRef.current = null;
    }
    activeRequestIdRef.current = null;
  }, []);

  const sendMessage = useCallback(async (message?: string) => {
    // Get message from parameter, state, or direct input access
    let messageToSend = message;
    if (!messageToSend) {
      if (inputRef.current) {
        messageToSend = inputRef.current.value.trim();
      } else {
        messageToSend = inputMessage.trim();
      }
    }
    
    if (!messageToSend || isTyping) {
      return;
    }

    // Check tokens before sending
    if (user) {
      const isUnlimited = hasUnlimitedTokens();
      
      if (!isUnlimited) {
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
        const userTokensToCharge = Math.min(Math.ceil((estimatedTokens * 2.5) / 100), 3000);
        
        const currentTokensUsed = packageInfo?.tokensUsed || 0;
        const totalAvailableTokens = packageInfo?.totalTokens || 0;
        
        if (currentTokensUsed + userTokensToCharge > totalAvailableTokens) {
          onTokenLimitReached();
          return;
        }
      }
    }

    const startTime = Date.now();

    // Use all forms if none are selected
    const formsToAnalyze = selectedFormIds.length > 0 ? selectedFormIds : forms.map((form: { id: string }) => form.id);

    // Determine the actual format(s) to use
    const actualFormats = selectedFormats.length > 0 ? selectedFormats : (selectedFormat ? [selectedFormat] : []);
    const isMultiFormat = actualFormats.length > 1;
    
    // Get form titles for display
    const formTitles = forms.filter((form: { id: string }) => formsToAnalyze.includes(form.id)).map((form: { title: string }) => form.title);

    // Create conversation if none exists
    let conversationId = currentConversation?.id;
    if (!conversationId) {
      try {
        conversationId = await createNewConversation();
      } catch (error) {
        logger.error('Error creating conversation', error, 'useChatMessageHandler');
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
        ...(actualFormats.length > 0 ? {
          ...(isMultiFormat ? {} : { selectedFormat: actualFormats[0] }),
          selectedFormats: actualFormats
        } : {}),
        selectedFormIds: formsToAnalyze,
        selectedFormTitles: formTitles
      }
    };

    // Add user message to local state for immediate display
    if (currentConversation) {
      try {
        addMessageToLocalState(userMessage);
      } catch (error) {
        logger.error('Error adding user message to local state', error, 'useChatMessageHandler');
      }
    }

    // Set AI active to prevent appLoading rerenders
    isAIActiveRef.current = true;
    aiResponseActiveRef.current = true;
    setAIResponseActive(true);
    
    setInputMessage('');
    setIsTyping(true);
    setTypingMessage('ARCHA analyse vos données...');
    const reqId = `req_${Date.now()}`;
    activeRequestIdRef.current = reqId;
    
    // Set up typing timers
    if (typingSoftTimerRef.current) {
      window.clearTimeout(typingSoftTimerRef.current);
      typingSoftTimerRef.current = null;
    }
    if (typingHardTimerRef.current) {
      window.clearTimeout(typingHardTimerRef.current);
      typingHardTimerRef.current = null;
    }
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

    try {
      const aiEndpoint = getAIEndpoint();
      
      if (!aiEndpoint) {
        throw new Error('ARCHA n\'est pas configuré. Veuillez définir VITE_AI_ENDPOINT dans votre fichier .env.local et redémarrer le serveur.');
      }

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

      // Use enhanced fetch with retry logic
      let response = await enhancedFetch.aiRequest(aiEndpoint, {
        method: 'POST',
        headers: makeHeaders(token),
        body: JSON.stringify(requestData),
        timeout: 60000
      });

      // If token expired, refresh and retry
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
          logger.error('Failed to refresh token', refreshErr, 'useChatMessageHandler');
        }
      }

      if (!response.ok) {
        let errorMessage = `Erreur serveur ARCHA (HTTP ${response.status})`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
          
          if (response.status === 402 && errorData.code === 'INSUFFICIENT_TOKENS') {
            onPayAsYouGo();
            return;
          }
          
          if (response.status === 402 && errorData.code === 'SUBSCRIPTION_EXPIRED') {
            showError('Votre abonnement a expiré. Veuillez renouveler votre abonnement pour continuer.');
            return;
          }
        } catch {
          // Keep default message if no JSON
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      // Clear loading state
      clearTypingState();

      // Replace optimistic user message with real one from backend
      if (data.userMessage && currentConversation) {
        try {
          const realUserMessage: ChatMessage = {
            id: data.userMessage.id,
            type: data.userMessage.type,
            content: data.userMessage.content,
            timestamp: data.userMessage.timestamp?.toDate ? data.userMessage.timestamp.toDate() : new Date(data.userMessage.timestamp),
            meta: data.userMessage.meta
          };
          
          replaceOptimisticMessage(userMessage.id, realUserMessage);
        } catch (error) {
          logger.error('Error replacing optimistic user message', error, 'useChatMessageHandler');
        }
      }

      // Update user data if tokens were charged
      if (user && data.meta?.userTokensCharged) {
        try {
          setTimeout(async () => {
            try {
              await refreshUserData();
            } catch (refreshError) {
              logger.error('Failed to refresh user data after token deduction', refreshError, 'useChatMessageHandler');
            }
          }, 1000);
        } catch (refreshError) {
          logger.error('Failed to schedule user data refresh', refreshError, 'useChatMessageHandler');
        }
        
        // Track analytics
        try {
          await AnalyticsService.logChatActivity(
            user.id, 
            data.meta.userTokensCharged, 
            user.agencyId
          );
        } catch (analyticsError) {
          logger.error('Failed to log chat activity', analyticsError, 'useChatMessageHandler');
        }
      }

    } catch (error) {
      logger.error('Erreur lors de l\'envoi du message', error, 'useChatMessageHandler');
      
      const responseTime = Date.now() - startTime;
      
      let errorContent = '';
      
      if (error instanceof Error) {
        errorContent = error.message;
        
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

      // Add error message to local state
      if (currentConversation) {
        try {
          addMessageToLocalState(errorMessage);
        } catch (error) {
          logger.error('Error adding error message to local state', error, 'useChatMessageHandler');
        }
      }
      
      // Clear AI active state on error
      isAIActiveRef.current = false;
      aiResponseActiveRef.current = false;
      setAIResponseActive(false);
      
      clearTypingState();
    }
  }, [
    forms,
    filters,
    selectedFormIds,
    selectedFormat,
    selectedFormats,
    inputRef,
    inputMessage,
    setInputMessage,
    isTyping,
    user,
    packageInfo,
    onTokenLimitReached,
    onPayAsYouGo,
    currentConversation,
    createNewConversation,
    addMessageToLocalState,
    replaceOptimisticMessage,
    firebaseUser,
    refreshUserData,
    showError,
    setAIResponseActive,
    clearTypingState,
    messages
  ]);

  return {
    sendMessage,
    isTyping,
    typingMessage
  };
};


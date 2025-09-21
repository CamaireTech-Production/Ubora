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
import { useToast } from '../hooks/useToast';
import { usePackageAccess } from '../hooks/usePackageAccess';
import { TokenCounter } from '../services/tokenCounter';
import { PayAsYouGoModal } from '../components/PayAsYouGoModal';
import { PayAsYouGoService } from '../services/payAsYouGoService';

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
  const { getMonthlyTokens, hasUnlimitedTokens } = usePackageAccess();
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
  
  const { showError } = useToast();
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
  
  // État pour le modal pay-as-you-go
  const [showPayAsYouGoModal, setShowPayAsYouGoModal] = useState(false);
  const [requiredTokens, setRequiredTokens] = useState(0);

  // État pour l'écran de bienvenue (uniquement juste après login)
  const [showWelcome, setShowWelcome] = useState(() => {
    try {
      const shouldShow = sessionStorage.getItem('show_welcome_after_login') === 'true';
      return shouldShow;
    } catch {
      return false;
    }
  });
  const handlePurchaseTokens = async (tokens: number) => {
    if (!user) return;
    
    try {
      const tokenPackage = PayAsYouGoService.getTokenPackages().find(pkg => pkg.tokens === tokens);
      if (!tokenPackage) {
        showError('Package de tokens non trouvé');
        return;
      }
      
      const success = await PayAsYouGoService.purchaseTokens(user.id, tokenPackage);
      if (success) {
        console.log(`✅ ${tokens} tokens achetés avec succès`);
        
        // Update user data locally without page reload
        if (user) {
          const updatedUserData = {
            ...user,
            payAsYouGoTokens: (user.payAsYouGoTokens || 0) + tokens,
            subscriptionEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            subscriptionStatus: 'active'
          };
          
          // Update the user context (you'll need to implement this in your auth context)
          // For now, we'll trigger a user refresh
          console.log('🔄 User data updated locally');
        }
      } else {
        showError('Erreur lors de l\'achat des tokens');
      }
    } catch (error) {
      console.error('Error purchasing tokens:', error);
      showError('Erreur lors de l\'achat des tokens');
    }
  };

  const handleSendMessage = async (message?: string) => {
    const messageToSend = message || inputMessage.trim();
    if (!messageToSend || isTyping) return;

    // Vérifier les tokens avant d'envoyer
    if (user) {
      const monthlyLimit = getMonthlyTokens();
      const isUnlimited = hasUnlimitedTokens();
      
      console.log('🔍 User data debug:', {
        userId: user.id,
        package: user.package,
        tokensUsedMonthly: user.tokensUsedMonthly,
        payAsYouGoTokens: user.payAsYouGoTokens,
        monthlyLimit,
        isUnlimited
      });
      
      if (!isUnlimited) {
        // Estimate tokens needed for this request
        // Use the full system prompt for accurate estimation
        const estimatedSystemPrompt = `Tu es ARCHA, assistant IA spécialisé dans l'analyse de données de formulaires d'entreprise.
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
        const userTokensToCharge = Math.min(TokenCounter.getUserTokensToCharge(estimatedTokens, 1.5), 3000); // Cap at 3000 tokens
        
        // Check if user has enough tokens (including pay-as-you-go tokens)
        const currentTokensUsed = user.tokensUsedMonthly || 0;
        const payAsYouGoTokens = user.payAsYouGoTokens || 0;
        const totalAvailableTokens = monthlyLimit + payAsYouGoTokens;
        
        console.log('🔍 Token validation debug:', {
          messageToSend: messageToSend.substring(0, 50) + '...',
          estimatedTokens,
          userTokensToCharge,
          currentTokensUsed,
          payAsYouGoTokens,
          monthlyLimit,
          totalAvailableTokens,
          remainingTokens: totalAvailableTokens - currentTokensUsed,
          willShowModal: currentTokensUsed + userTokensToCharge > totalAvailableTokens,
          systemPromptLength: estimatedSystemPrompt.length,
          userPromptLength: messageToSend.length,
          // Test with a simple message
          simpleTest: TokenCounter.getTotalEstimatedTokens('Hello', 'Hi', 100)
        });
        
        if (currentTokensUsed + userTokensToCharge > totalAvailableTokens) {
          // Show pay-as-you-go modal instead of error
          setRequiredTokens(userTokensToCharge);
          setShowPayAsYouGoModal(true);
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

    // Ajouter le message utilisateur
    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      type: 'user',
      content: messageToSend,
      timestamp: new Date(),
        meta: {
          ...(isMultiFormat || actualFormats.length === 0 ? {} : { selectedFormat: actualFormats[0] }),
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

      // Timeout de 90 secondes pour laisser plus de temps au traitement IA
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('Request timeout after 90 seconds');
        controller.abort();
      }, 90000);

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

      console.log('🤖 AI Response Details:');
      console.log('📥 Response status:', response.status);
      console.log('📥 Response data:', JSON.stringify(data, null, 2));
      console.log('⏱️ Response time:', Date.now() - startTime, 'ms');

      // Tokens are now deducted on the server side
      if (user && data.meta?.userTokensCharged) {
        const userTokensCharged = data.meta.userTokensCharged;
        console.log(`✅ ${userTokensCharged} tokens facturés (déduits côté serveur)`);
        console.log(`📊 Détail: ${data.meta.tokensUsed} tokens OpenAI × 1.5 = ${userTokensCharged} tokens utilisateur`);
        
        // Update user data locally (you'll need to implement proper user context update)
        console.log('🔄 User token usage updated');
      }

      const responseTime = Date.now() - startTime;

      // Parse the AI response to detect graph/PDF data
      const parsedResponse = ResponseParser.parseAIResponse(data.answer, messageToSend, isMultiFormat || actualFormats.length === 0 ? undefined : actualFormats[0], actualFormats);

      // Create assistant message with parsed content
      const assistantMessage = ResponseParser.createMessageFromParsedResponse(
        parsedResponse,
        `assistant_${Date.now()}`,
        responseTime,
        {
          ...data.meta,
          ...(isMultiFormat || actualFormats.length === 0 ? {} : { selectedFormat: actualFormats[0] }),
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
        <div className="max-w-7xl mx-auto flex flex-col h-screen px-4 sm:px-6 lg:px-8">
          
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

          {/* Pay-as-you-go Modal */}
          <PayAsYouGoModal
            isOpen={showPayAsYouGoModal}
            onClose={() => setShowPayAsYouGoModal(false)}
            onPurchase={handlePurchaseTokens}
            currentTokens={user?.tokensUsedMonthly || 0}
            packageLimit={getMonthlyTokens()}
            payAsYouGoTokens={user?.payAsYouGoTokens || 0}
            requiredTokens={requiredTokens}
          />
        </div>
      </div>
      
      <Footer />
    </LoadingGuard>
  );
};
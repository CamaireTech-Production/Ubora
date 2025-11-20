import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { useForms } from '@ubora/shared/contexts/FormsContext';
import { useEntries } from '@ubora/shared/contexts/EntriesContext';
import { useEmployees } from '@ubora/shared/contexts/EmployeesContext';
import { useConversation } from '@ubora/shared/contexts/ConversationContext';
import { useAIResponse } from '@ubora/shared/contexts/AIResponseContext';
import { LoadingGuard } from '../../components/loading/LoadingGuard';
import { WelcomeScreen } from '../../components/core/WelcomeScreen';
import { FloatingSidePanel } from '../../components/chat/FloatingSidePanel';
import { Footer } from '../../components/layout/Footer';
import { useToast } from '@ubora/shared/hooks/useToast';
import { usePackageAccess } from '../../hooks/packages/usePackageAccess';
import { PayAsYouGoModal } from '../../components/payments/PayAsYouGoModal';
import { LimitReachedModal } from '../../components/modals/LimitReachedModal';
import { LogoutConfirmationModal } from '../../components/modals/LogoutConfirmationModal';
import { ImpersonationHeader } from '../../components/layout/ImpersonationHeader';
import { logger } from '@ubora/shared/utils/logger';
import { ChatContainer } from './ChatContainer';
import { useChatMessageHandler } from './ChatMessageHandler/useChatMessageHandler';
import { useChatFilters } from './ChatFilters/useChatFilters';
import { useChatState } from './ChatState/useChatState';

export const DirecteurChat: React.FC = () => {
  const navigate = useNavigate();
  const { user, firebaseUser, isLoading, logout, refreshUserData } = useAuth();
  const { forms, isLoading: formsLoading } = useForms();
  const { formEntries, isLoading: entriesLoading } = useEntries();
  const { employees, isLoading: employeesLoading } = useEmployees();
  const appLoading = formsLoading || entriesLoading || employeesLoading;
  const { setAIResponseActive } = useAIResponse();
  
  // Use ref to track AI state without causing rerenders
  const isAIActiveRef = useRef(false);
  
  // Global flag to prevent AppContext updates during AI responses
  const aiResponseActiveRef = useRef(false);
  const { getMonthlyTokens, hasUnlimitedTokens, packageInfo } = usePackageAccess();
  
  const { 
    currentConversation, 
    conversations, 
    messages, 
    hasMoreMessages,
    createNewConversation,
    loadConversation,
    loadMoreMessages,
    triggerAutoLoad
  } = useConversation();
  
  const { showError } = useToast();
  
  // Use extracted hooks
  const chatState = useChatState();
  const chatFilters = useChatFilters();
  
  // Watch for new assistant messages to hide loading indicator
  const [lastMessageCount, setLastMessageCount] = useState(0);
  
  // État pour l'écran de bienvenue
  const [showWelcome, setShowWelcome] = useState(() => {
    try {
      const shouldShowAfterLogin = sessionStorage.getItem('show_welcome_after_login') === 'true';
      const shouldShowAfterPackage = sessionStorage.getItem('show_welcome_after_package_selection') === 'true';
      return shouldShowAfterLogin || shouldShowAfterPackage;
    } catch {
      return false;
    }
  });

  // Memoize package calculations
  const packageCalculations = useMemo(() => {
    const monthlyLimit = getMonthlyTokens();
    const isUnlimited = hasUnlimitedTokens();
    return { monthlyLimit, isUnlimited };
  }, [user?.id, packageInfo?.tokensUsed]);

  // Use chat message handler
  const { sendMessage, isTyping, typingMessage } = useChatMessageHandler({
    forms,
    filters: chatFilters.filters,
    selectedFormIds: chatFilters.selectedFormIds,
    selectedFormat: chatFilters.selectedFormat,
    selectedFormats: chatFilters.selectedFormats,
    inputRef: chatState.inputRef,
    inputMessage: chatState.inputMessage,
    setInputMessage: chatState.setInputMessage,
    onTokenLimitReached: () => chatState.setShowTokenLimitModal(true),
    onPayAsYouGo: () => chatState.setShowPayAsYouGoModal(true),
    refreshUserData
  });

  const handlePurchaseTokens = async (_tokens: number) => {
    // Handled by PayAsYouGoModal
  };

  const handleLogout = async () => {
    chatState.setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      chatState.setIsLoggingOut(false);
      chatState.setShowLogoutModal(false);
    }
  };

  // Watch for new assistant messages to hide loading indicator
  useEffect(() => {
    if (isTyping && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.type === 'assistant' && lastMessage.id !== chatState.lastProcessedMessageIdRef.current) {
        // This will be handled by the message handler
        chatState.lastProcessedMessageIdRef.current = lastMessage.id;
      }
    }
    if (messages.length !== lastMessageCount) {
      setLastMessageCount(messages.length);
    }
  }, [messages, isTyping, lastMessageCount, chatState.lastProcessedMessageIdRef]);

  // Fallback: Auto-load conversations
  useEffect(() => {
    const shouldAutoLoad = !showWelcome && conversations.length > 0 && !currentConversation && !isLoading;
    if (shouldAutoLoad) {
      const timeoutId = setTimeout(async () => {
        try {
          await triggerAutoLoad();
        } catch (error) {
          logger.error('Error in fallback auto-load', error, 'DirecteurChat');
        }
      }, 500);
      
      return () => clearTimeout(timeoutId);
    }
  }, [showWelcome, conversations.length, currentConversation, isLoading, triggerAutoLoad]);

  const handleLoadMore = async () => {
    if (chatState.isLoadingMore || !hasMoreMessages) return;
    
    chatState.setIsLoadingMore(true);
    try {
      await loadMoreMessages();
    } catch (error) {
      logger.error('Error loading more messages', error, 'DirecteurChat');
    } finally {
      chatState.setIsLoadingMore(false);
    }
  };

  const handleWelcomeContinue = async () => {
    setShowWelcome(false);
    try { 
      sessionStorage.removeItem('show_welcome_after_login');
      sessionStorage.removeItem('show_welcome_after_package_selection');
    } catch {}
    
    setTimeout(async () => {
      try {
        await triggerAutoLoad();
      } catch (error) {
        logger.error('Error triggering auto-load after welcome screen', error, 'DirecteurChat');
      }
    }, 100);
  };

  // Auto-scroll when keyboard opens
  useEffect(() => {
    if (chatState.keyboardHeight > 0) {
      const messageList = document.querySelector('.flex-1.overflow-y-auto');
      if (messageList) {
        messageList.scrollTo({
          top: messageList.scrollHeight,
          behavior: 'auto'
        });
      }
    }
  }, [chatState.keyboardHeight]);

  // Show welcome screen
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
      <ImpersonationHeader />
      
      <ChatContainer
        messages={messages}
        inputMessage={chatState.inputMessage}
        isTyping={isTyping}
        typingMessage={typingMessage}
        hasMoreMessages={hasMoreMessages}
        isLoadingMore={chatState.isLoadingMore}
        onInputChange={chatState.setInputMessage}
        onSendMessage={() => sendMessage()}
        onLoadMore={handleLoadMore}
        onOpenPanel={() => chatState.setPanelOpen(true)}
        onLogout={() => chatState.setShowLogoutModal(true)}
        keyboardHeight={chatState.keyboardHeight}
        selectedFormat={chatFilters.selectedFormat}
        selectedFormats={chatFilters.selectedFormats}
        selectedFormIds={chatFilters.selectedFormIds}
        onFormatChange={chatFilters.handleFormatChange}
        onFormatsChange={chatFilters.handleFormatsChange}
        forms={forms}
        employees={employees}
        filters={chatFilters.filters}
        onFiltersChange={chatFilters.setFilters}
        onFormSelectionChange={chatFilters.handleFormSelectionChange}
        inputRef={chatState.inputRef}
      />

      {/* Floating side panel */}
      <FloatingSidePanel
        open={chatState.panelOpen}
        onOpenChange={chatState.setPanelOpen}
        activeTab={chatState.activeTab}
        onTabChange={chatState.setActiveTab}
        filters={chatFilters.filters}
        onFiltersChange={chatFilters.setFilters}
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
        isOpen={chatState.showTokenLimitModal}
        onClose={() => chatState.setShowTokenLimitModal(false)}
        type="tokens"
        current={packageInfo?.tokensUsed || 0}
        limit={packageInfo?.totalTokens || 0}
        onUpgrade={() => chatState.setShowTokenLimitModal(false)}
        onPayAsYouGo={() => chatState.setShowTokenLimitModal(false)}
      />

      {/* Pay-as-you-go Modal */}
      <PayAsYouGoModal
        isOpen={chatState.showPayAsYouGoModal}
        onClose={() => chatState.setShowPayAsYouGoModal(false)}
        onPurchase={handlePurchaseTokens}
        currentTokens={packageInfo?.tokensUsed || 0}
        packageLimit={getMonthlyTokens()}
        payAsYouGoTokens={packageInfo?.payAsYouGoTokens || 0}
        requiredTokens={0}
      />

      {/* Logout Confirmation Modal */}
      <LogoutConfirmationModal
        isOpen={chatState.showLogoutModal}
        onClose={() => chatState.setShowLogoutModal(false)}
        onConfirm={handleLogout}
        isLoading={chatState.isLoggingOut}
      />
      
      <Footer />
    </LoadingGuard>
  );
};


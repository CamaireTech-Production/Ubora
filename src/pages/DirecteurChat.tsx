import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { useConversation } from '../contexts/ConversationContext';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { LoadingGuard } from '../components/LoadingGuard';
import { 
  Send, 
  Bot, 
  User, 
  Calendar, 
  Filter, 
  Clock,
  FileText,
  Users,
  Loader2,
  Wifi,
  MessageSquare,
  Plus,
  History,
  ChevronUp
} from 'lucide-react';

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
// En développement local, utilise l'endpoint local
// En production, utilise VITE_AI_ENDPOINT ou l'URL de déploiement
const getAIEndpoint = () => {
  // Si VITE_AI_ENDPOINT est défini, l'utiliser (production)
  if (import.meta.env.VITE_AI_ENDPOINT) {
    return import.meta.env.VITE_AI_ENDPOINT;
  }
  
  // En développement local, utiliser l'endpoint local
  if (import.meta.env.DEV) {
    return 'http://localhost:3000/api/ai/ask';
  }
  
  // Fallback pour production sans VITE_AI_ENDPOINT
  return null;
};

const AI_ENDPOINT = getAIEndpoint();

// Validation que l'endpoint est configuré
if (!AI_ENDPOINT) {
  console.error("❌ Aucun endpoint IA configuré. Le Chat IA ne fonctionnera pas.");
} else {
  console.log("✅ AI_ENDPOINT configuré:", AI_ENDPOINT);
}

// Function to format AI message content (remove markdown and clean up)
const formatMessageContent = (content: string): React.ReactNode => {
  // Split content into lines and process each line
  const lines = content.split('\n');
  
  return lines.map((line, index) => {
    // Skip empty lines
    if (line.trim() === '') {
      return <br key={index} />;
    }
    
    // Handle headers (lines starting with #)
    if (line.startsWith('#')) {
      const level = line.match(/^#+/)?.[0].length || 1;
      const text = line.replace(/^#+\s*/, '');
      const className = level === 1 ? 'text-lg font-bold mb-2' : 
                      level === 2 ? 'text-base font-semibold mb-1' : 
                      'text-sm font-medium mb-1';
      return <div key={index} className={className}>{text}</div>;
    }
    
    // Handle bold text (**text**)
    if (line.includes('**')) {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <div key={index} className="mb-1">
          {parts.map((part, partIndex) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              const boldText = part.slice(2, -2);
              return <strong key={partIndex} className="font-semibold">{boldText}</strong>;
            }
            return part;
          })}
        </div>
      );
    }
    
    // Handle bullet points (• or -)
    if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
      const text = line.trim().substring(1).trim();
      return (
        <div key={index} className="ml-4 mb-1 flex items-start">
          <span className="text-blue-600 mr-2">•</span>
          <span>{text}</span>
        </div>
      );
    }
    
    // Handle emoji lines (lines starting with emoji)
    if (/^[\u{1F600}-\u{1F64F}]|^[\u{1F300}-\u{1F5FF}]|^[\u{1F680}-\u{1F6FF}]|^[\u{1F1E0}-\u{1F1FF}]|^[\u{2600}-\u{26FF}]|^[\u{2700}-\u{27BF}]/u.test(line.trim())) {
      return <div key={index} className="mb-2 font-medium">{line}</div>;
    }
    
    // Regular text
    return <div key={index} className="mb-1">{line}</div>;
  });
};

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
  const [showFilters, setShowFilters] = useState(false);
  const [showConversationHistory, setShowConversationHistory] = useState(false);
  const [filters, setFilters] = useState<ChatFilters>({
    period: 'week',
    formId: '',
    userId: ''
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Auto-scroll vers le bas
  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle scroll to load more messages
  const handleScroll = async () => {
    if (!chatContainerRef.current || isLoadingMore || !hasMoreMessages) return;

    const { scrollTop } = chatContainerRef.current;
    if (scrollTop < 100) { // Near top
      setIsLoadingMore(true);
      try {
        await loadMoreMessages();
      } catch (error) {
        console.error('Error loading more messages:', error);
      } finally {
        setIsLoadingMore(false);
      }
    }
  };

  // Exemples de questions
  const exampleQuestions = [
    "Résumé de cette semaine par employé",
    "Quel employé a le plus de réponses ?",
    "Comment fonctionne ce système ?",
    "Quels formulaires sont les plus utilisés ?",
    "Donne-moi des conseils pour améliorer les performances",
    "Analyse des soumissions d'aujourd'hui"
  ];

  // Boutons de période rapide
  const quickPeriods = [
    { value: 'today', label: 'Aujourd\'hui' },
    { value: 'yesterday', label: 'Hier' },
    { value: 'week', label: 'Cette semaine' },
    { value: 'month', label: 'Ce mois' },
    { value: '30days', label: '30 derniers jours' }
  ];

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

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };


  return (
    <LoadingGuard 
      isLoading={isLoading || appLoading} 
      user={user} 
      firebaseUser={firebaseUser}
      message="Chargement du Chat IA..."
    >
      <Layout title="Chat IA - Analyse des données">
        <div className="max-w-6xl mx-auto space-y-6">
          
          {/* Filtres et contrôles */}
          <Card>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <h3 className="text-lg font-semibold text-gray-900">Paramètres d'analyse</h3>
                  {/* Badge de mode - toujours RÉEL */}
                  <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <Wifi className="h-3 w-3 mr-1" />
                    <span>MODE : RÉEL</span>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center space-x-2"
                >
                  <Filter className="h-4 w-4" />
                  <span>{showFilters ? 'Masquer' : 'Filtres avancés'}</span>
                </Button>
              </div>

              {/* Boutons de période rapide */}
              <div className="flex flex-wrap gap-2">
                {quickPeriods.map(period => (
                  <Button
                    key={period.value}
                    variant={filters.period === period.value ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setFilters(prev => ({ ...prev, period: period.value }))}
                  >
                    {period.label}
                  </Button>
                ))}
              </div>

              {/* Filtres avancés */}
              {showFilters && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                  <Select
                    label="Formulaire spécifique"
                    value={filters.formId}
                    onChange={(e) => setFilters(prev => ({ ...prev, formId: e.target.value }))}
                    options={[
                      { value: '', label: 'Tous les formulaires' },
                      ...forms.map(form => ({ value: form.id, label: form.title }))
                    ]}
                  />
                  
                  <Select
                    label="Employé spécifique"
                    value={filters.userId}
                    onChange={(e) => setFilters(prev => ({ ...prev, userId: e.target.value }))}
                    options={[
                      { value: '', label: 'Tous les employés' },
                      ...employees.map(emp => ({ value: emp.id, label: emp.name }))
                    ]}
                  />
                </div>
              )}
            </div>
          </Card>

          {/* Zone de chat */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* Conversation History Sidebar */}
            <div className="lg:col-span-1">
              <Card className="h-[600px] flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                  <div className="flex items-center space-x-2">
                    <History className="h-5 w-5 text-gray-600" />
                    <h3 className="font-semibold text-gray-900">Conversations</h3>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={createNewConversation}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-2">
                  {conversations.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Aucune conversation</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {conversations.map(conversation => (
                        <div
                          key={conversation.id}
                          className={`p-3 rounded-lg cursor-pointer transition-colors ${
                            currentConversation?.id === conversation.id
                              ? 'bg-blue-100 border border-blue-300'
                              : 'hover:bg-gray-100 border border-transparent'
                          }`}
                          onClick={() => loadConversation(conversation.id)}
                        >
                          <div className="font-medium text-sm text-gray-900 truncate">
                            {conversation.title}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {conversation.lastMessageAt.toLocaleDateString('fr-FR')}
                          </div>
                          <div className="text-xs text-gray-400">
                            {conversation.messageCount} messages
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            </div>
            
            {/* Chat principal */}
            <div className="xl:col-span-3 order-2 xl:order-1">
              <Card className="h-[500px] sm:h-[600px] flex flex-col">
                
                {/* Header du chat */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                  <div className="flex items-center space-x-3">
                    <Bot className="h-6 w-6 text-blue-600" />
                    <div>
                      <h3 className="font-semibold text-gray-900">Assistant IA</h3>
                      {currentConversation && (
                        <p className="text-sm text-gray-500 truncate max-w-xs">
                          {currentConversation.title}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {hasMoreMessages && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={loadMoreMessages}
                        disabled={isLoadingMore}
                      >
                        <ChevronUp className="h-4 w-4" />
                        {isLoadingMore ? 'Chargement...' : 'Plus ancien'}
                      </Button>
                    )}
                    {messages.length > 0 && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={createNewConversation}
                      >
                        Nouvelle conversation
                      </Button>
                    )}
                  </div>
                </div>

                {/* Messages */}
                <div 
                  ref={chatContainerRef}
                  className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0"
                  style={{ maxHeight: 'calc(600px - 140px)' }}
                  onScroll={handleScroll}
                >
                  {messages.length === 0 ? (
                    <div className="text-center py-8 sm:py-12">
                      <Bot className="h-12 w-12 sm:h-16 sm:w-16 text-gray-300 mx-auto mb-4" />
                      <h4 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
                        Bienvenue dans le Chat IA
                      </h4>
                      <p className="text-sm sm:text-base text-gray-500 mb-4 sm:mb-6 px-4">
                        Posez des questions sur vos données de formulaires pour obtenir des analyses détaillées.
                      </p>
                      <div className="text-xs sm:text-sm text-gray-400 px-4">
                        {AI_ENDPOINT ? (
                          <p>🌐 Mode RÉEL activé : {AI_ENDPOINT}</p>
                        ) : (
                          <p>⚙️ Configuration requise : Veuillez définir VITE_AI_ENDPOINT dans votre fichier .env.local</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    messages.map(message => (
                      <div
                        key={message.id}
                        className={`flex items-start space-x-3 ${
                          message.type === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {message.type === 'assistant' && (
                          <div className="flex-shrink-0">
                            <Bot className="h-8 w-8 text-blue-600 bg-blue-100 rounded-full p-1.5" />
                          </div>
                        )}
                        
                        <div className={`max-w-[85%] sm:max-w-3xl ${
                          message.type === 'user' 
                            ? 'bg-blue-600 text-white rounded-l-lg rounded-tr-lg' 
                            : 'bg-gray-100 text-gray-900 rounded-r-lg rounded-tl-lg'
                        } px-3 sm:px-4 py-2 sm:py-3`}>
                          <div className="whitespace-pre-wrap">
                            {message.type === 'assistant' ? (
                              <div className="prose prose-xs sm:prose-sm max-w-none">
                                {formatMessageContent(message.content)}
                              </div>
                            ) : (
                              <div className="text-sm sm:text-base break-words">{message.content}</div>
                            )}
                          </div>
                          
                          
                          {/* Meta informations */}
                          {message.meta && (
                            <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-gray-200 text-xs">
                              <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-gray-600">
                                {message.meta.period && (
                                  <span className="flex items-center space-x-1">
                                    <Calendar className="h-3 w-3" />
                                    <span>{message.meta.period}</span>
                                  </span>
                                )}
                                {message.meta.usedEntries && (
                                  <span className="flex items-center space-x-1">
                                    <FileText className="h-3 w-3" />
                                    <span>{message.meta.usedEntries} entrées</span>
                                  </span>
                                )}
                                {message.meta.users && (
                                  <span className="flex items-center space-x-1">
                                    <Users className="h-3 w-3" />
                                    <span>{message.meta.users} employés</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                          
                          <div className="text-xs opacity-70 mt-1 sm:mt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <span>{message.timestamp.toLocaleTimeString()}</span>
                            {message.responseTime && (
                              <span className="flex items-center space-x-1">
                                <Clock className="h-3 w-3" />
                                <span>{message.responseTime}ms</span>
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {message.type === 'user' && (
                          <div className="flex-shrink-0">
                            <User className="h-8 w-8 text-blue-600 bg-blue-100 rounded-full p-1.5" />
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  
                  {/* Indicateur de frappe */}
                  {isTyping && (
                    <div className="flex items-start space-x-3">
                      <Bot className="h-8 w-8 text-blue-600 bg-blue-100 rounded-full p-1.5" />
                      <div className="bg-gray-100 rounded-r-lg rounded-tl-lg px-3 sm:px-4 py-2 sm:py-3">
                        <div className="flex items-center space-x-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-gray-600 text-sm sm:text-base">
L'IA analyse vos données...
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                  
                  {/* Scroll to bottom button */}
                  {messages.length > 3 && (
                    <div className="sticky bottom-0 flex justify-center">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={scrollToBottom}
                        className="opacity-80 hover:opacity-100 transition-opacity"
                      >
                        ↓ Voir les nouveaux messages
                      </Button>
                    </div>
                  )}
                </div>

                {/* Zone de saisie */}
                <div className="border-t border-gray-200 p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <div className="flex-1">
                      <Input
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Posez une question sur vos données..."
                        disabled={isTyping}
                      />
                    </div>
                    <Button
                      onClick={() => handleSendMessage()}
                      disabled={!inputMessage.trim() || isTyping}
                      className="flex items-center justify-center space-x-2 w-full sm:w-auto"
                    >
                      <Send className="h-4 w-4" />
                      <span>Envoyer</span>
                    </Button>
                  </div>
                </div>
              </Card>
            </div>

            {/* Panneau latéral */}
            <div className="space-y-4 lg:space-y-6 order-1 xl:order-2">
              
              {/* Exemples de questions */}
              <Card title="Exemples de questions">
                <div className="space-y-2 max-h-60 xl:max-h-none overflow-y-auto xl:overflow-visible">
                  {exampleQuestions.map((question, index) => (
                    <button
                      key={index}
                      onClick={() => handleSendMessage(question)}
                      disabled={isTyping}
                      className="w-full text-left p-2 sm:p-3 text-xs sm:text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 break-words"
                    >
                      "{question}"
                    </button>
                  ))}
                </div>
              </Card>

              {/* Statistiques rapides */}
              <Card title="Aperçu des données">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Formulaires</span>
                    <span className="font-semibold">{forms.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Employés</span>
                    <span className="font-semibold">{employees.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Réponses</span>
                    <span className="font-semibold">{formEntries.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Agence</span>
                    <span className="font-semibold text-blue-600 break-all">{user?.agencyId}</span>
                  </div>
                  <div className="pt-2 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Mode IA</span>
                      <span className="text-xs font-medium text-green-600">
                        RÉEL
                      </span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Conseils d'utilisation */}
              <Card title="💡 Conseils">
                <div className="text-xs sm:text-sm text-gray-600 space-y-2">
                  <p>• Posez des questions spécifiques : "Quel employé...?"</p>
                  <p>• Demandez des analyses : "Résumé de cette semaine"</p>
                  <p>• Sollicitez des conseils : "Comment améliorer...?"</p>
                  <p>• Filtrez par employé ou formulaire avec les filtres</p>
                  <p>• Utilisez les questions d'exemple pour commencer</p>
                  {!AI_ENDPOINT && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs text-red-600">
                        ⚙️ Configuration requise : Définissez VITE_AI_ENDPOINT pour utiliser l'IA.
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </Layout>
    </LoadingGuard>
  );
};
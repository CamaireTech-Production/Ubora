import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  limit,
  startAfter,
  getDocs,
  increment
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Conversation, ChatMessage } from '../types';
import { useAuth } from './AuthContext';
import { PermissionManager } from '../utils/PermissionManager';

interface ConversationContextType {
  currentConversation: Conversation | null;
  conversations: Conversation[];
  messages: ChatMessage[];
  isLoading: boolean;
  hasMoreMessages: boolean;
  createConversation: (title: string) => Promise<string>;
  addMessage: (message: ChatMessage) => Promise<void>;
  addMessageToLocalState: (message: ChatMessage) => void;
  replaceOptimisticMessage: (optimisticId: string, realMessage: ChatMessage) => void;
  loadMoreMessages: () => Promise<void>;
  loadConversation: (conversationId: string) => Promise<void>;
  createNewConversation: () => Promise<string>;
  updateConversationTitle: (conversationId: string, title: string) => Promise<void>;
  triggerAutoLoad: () => Promise<void>;
  error: string | null;
}

const ConversationContext = createContext<ConversationContextType | undefined>(undefined);

export const ConversationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [lastMessageDoc, setLastMessageDoc] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAddingMessage, setIsAddingMessage] = useState(false);
  const [messagesListener, setMessagesListener] = useState<any>(null);

  // Load conversations list for the director
  useEffect(() => {
    if (!user || user.role !== 'directeur' || !user.agencyId) {
      setConversations([]);
      setCurrentConversation(null);
      setMessages([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    const conversationsQuery = query(
      collection(db, 'conversations'),
      where('directorId', '==', user.id),
      where('agencyId', '==', user.agencyId),
      orderBy('lastMessageAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(conversationsQuery, (snapshot) => {
      const conversationsData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          directorId: data.directorId,
          agencyId: data.agencyId,
          title: data.title,
          messageCount: data.messageCount || 0,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          lastMessageAt: data.lastMessageAt?.toDate() || new Date(),
          messages: [] // Messages will be loaded separately
        } as Conversation;
      });
      
      setConversations(conversationsData);
      setIsLoading(false);
    }, (err) => {
      console.error('Erreur lors du chargement des conversations:', err);
      setError('Erreur lors du chargement des conversations');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Auto-load the most recent conversation when conversations are loaded
  useEffect(() => {
    const autoLoadRecent = async () => {
      // Only auto-load if we have conversations, no current conversation, not loading, and not adding a message
      if (conversations.length > 0 && !currentConversation && !isLoading && !isAddingMessage) {
        try {
          await loadConversation(conversations[0].id);
        } catch (error) {
          console.error('Error auto-loading recent conversation:', error);
        }
      }
    };
    
    autoLoadRecent();
  }, [conversations.length, currentConversation?.id, isLoading, isAddingMessage]);

  // Cleanup listener on unmount
  useEffect(() => {
    return () => {
      if (messagesListener) {
        messagesListener();
      }
    };
  }, [messagesListener]);

  const createConversation = async (title: string): Promise<string> => {
    if (!user || !user.agencyId || !PermissionManager.canCreateConversations(user)) {
      throw new Error('Seuls les directeurs peuvent créer des conversations');
    }

    try {
      setError(null);
      
      const conversationData = {
        directorId: user.id,
        agencyId: user.agencyId,
        title: title.trim(),
        messages: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessageAt: serverTimestamp(),
        messageCount: 0
      };
      
      const docRef = await addDoc(collection(db, 'conversations'), conversationData);
      
      // Create the conversation object
      const newConversation: Conversation = {
        id: docRef.id,
        directorId: user.id,
        agencyId: user.agencyId,
        title: title.trim(),
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        lastMessageAt: new Date(),
        messageCount: 0
      };

      // Set the conversation immediately
      setCurrentConversation(newConversation);
      setMessages([]);
      setHasMoreMessages(true);
      setLastMessageDoc(null);

      return docRef.id;
    } catch (err) {
      console.error('Erreur lors de la création de la conversation:', err);
      setError('Erreur lors de la création de la conversation');
      throw err;
    }
  };

  const addMessage = async (message: ChatMessage): Promise<void> => {
    if (!currentConversation) {
      throw new Error('Aucune conversation active');
    }

    try {
      setError(null);
      setIsAddingMessage(true);
      
      // Clean the message data to remove null and undefined values that Firebase doesn't accept
      const cleanMessage = {
        ...message,
        meta: message.meta ? Object.fromEntries(
          Object.entries(message.meta).filter(([_, value]) => value !== null && value !== undefined)
        ) : undefined,
        timestamp: serverTimestamp()
      };
      
      // Store message in Firestore subcollection
      
      try {
        await addDoc(collection(db, 'conversations', currentConversation.id, 'messages'), cleanMessage);
      } catch (error) {
        console.error('❌ FIREBASE SAVE ERROR - Failed to save message:', error);
        throw error;
      }

      // Update conversation metadata in Firestore (but don't trigger conversations list reload)
      
      try {
        const conversationRef = doc(db, 'conversations', currentConversation.id);
        await updateDoc(conversationRef, {
          updatedAt: serverTimestamp(),
          lastMessageAt: serverTimestamp(),
          messageCount: increment(1)
        });
      } catch (error) {
        console.error('❌ FIREBASE SAVE ERROR - Failed to update conversation metadata:', error);
        throw error;
      }

      // Do not optimistically append to local list; the realtime listener will update the UI
      
      // Update local conversation state
      setCurrentConversation(prev => prev ? {
        ...prev,
        messages: [...prev.messages, message],
        updatedAt: new Date(),
        lastMessageAt: new Date(),
        messageCount: prev.messageCount + 1
      } : null);

    } catch (err) {
      console.error('Erreur lors de l\'ajout du message:', err);
      setError('Erreur lors de l\'ajout du message');
      throw err;
    } finally {
      setIsAddingMessage(false);
    }
  };

  const addMessageToLocalState = (message: ChatMessage): void => {
    setMessages(prev => {
      // Check if message already exists to prevent duplicates (more aggressive for user messages)
      const exists = prev.some(m => {
        if (m.type === 'user' && message.type === 'user') {
          // For user messages, be more aggressive - check content and time
          return m.content === message.content && 
                 Math.abs(m.timestamp.getTime() - message.timestamp.getTime()) < 5000; // Within 5 seconds
        }
        // For other message types, check by ID
        return m.id === message.id;
      });
      
      if (exists) {
        return prev;
      }
      
      // Add message and sort by timestamp to maintain order
      const newMessages = [...prev, message];
      const sortedMessages = newMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      return sortedMessages;
    });
  };

  const replaceOptimisticMessage = (optimisticId: string, realMessage: ChatMessage): void => {
    setMessages(prev => {
      const updatedMessages = prev.map(msg => {
        // Replace the optimistic message with the real one
        if (msg.id === optimisticId && msg.type === 'user') {
          return realMessage;
        }
        return msg;
      });
      
      return updatedMessages;
    });
  };

  const loadConversation = async (conversationId: string): Promise<void> => {
    if (!user || !PermissionManager.canLoadConversations(user)) {
      throw new Error('Seuls les directeurs peuvent charger des conversations');
    }

    try {
      setIsLoading(true);
      setError(null);

      const conversation = conversations.find(c => c.id === conversationId);
      if (!conversation) {
        throw new Error('Conversation non trouvée');
      }      
      setCurrentConversation(conversation);
      
      
      // Clean up existing listener
      if (messagesListener) {
        messagesListener();
        setMessagesListener(null);
      }
      // Clean up and reset state before attaching listener
      setMessages([]);
      setHasMoreMessages(true);
      setLastMessageDoc(null);

      // Single real-time listener (authoritative): initial + updates
      const messagesListenerQuery = query(
        collection(db, 'conversations', conversationId, 'messages'),
        orderBy('timestamp', 'asc')
      );

      const unsubscribe = onSnapshot(messagesListenerQuery, (snapshot) => {
        const allMessages = snapshot.docs.map(doc => {
          const data = doc.data();
          const message: ChatMessage = {
            id: doc.id,
            type: data.type,
            content: data.content,
            timestamp: data.timestamp?.toDate() || new Date(data.timestamp?.seconds * 1000) || new Date(),
            responseTime: data.responseTime,
            contentType: data.contentType,
            meta: data.meta,
            tableData: data.tableData,
            pdfData: data.pdfData,
            pdfFiles: data.pdfFiles
          };

          // Validate and clean graph data if present
          if (data.graphData) {
            if (data.graphData.data && Array.isArray(data.graphData.data) && data.graphData.data.length > 0) {
              message.graphData = data.graphData;
            } else {
              message.contentType = message.contentType === 'graph' ? 'text' : message.contentType;
            }
          }

          return message;
        });

        // Remove duplicates based on ID first, then content and timestamp
        const uniqueMessages = allMessages.filter((message, index, array) => {
          const idDuplicate = array.findIndex(m => m.id === message.id);
          if (idDuplicate !== index) return false;

          const contentDuplicate = array.findIndex(m => 
            m.id !== message.id &&
            m.content === message.content && 
            m.type === message.type && 
            Math.abs(m.timestamp.getTime() - message.timestamp.getTime()) < 5000
          );

        	return contentDuplicate === -1;
        });

        // Update messages from Firebase
        setMessages(uniqueMessages);
        
        setHasMoreMessages(false);
        setLastMessageDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      }, (err) => {
        console.error('Error in real-time messages listener:', err);
      });

      setMessagesListener(() => unsubscribe);
      setIsLoading(false);
    } catch (err) {
      console.error('Erreur lors du chargement de la conversation:', err);
      setError('Erreur lors du chargement de la conversation');
      setIsLoading(false);
      throw err;
    }
  };

  const loadMoreMessages = async (): Promise<void> => {
    if (!currentConversation || !hasMoreMessages || isLoading) {
      return;
    }

    try {
      setIsLoading(true);
      
      const messagesQuery = query(
        collection(db, 'conversations', currentConversation.id, 'messages'),
        orderBy('timestamp', 'desc'),
        startAfter(lastMessageDoc),
        limit(20)
      );

      const messagesSnapshot = await getDocs(messagesQuery);
      const newMessages = messagesSnapshot.docs.map(doc => {
        const data = doc.data();
        const message: ChatMessage = {
          id: doc.id,
          type: data.type,
          content: data.content,
          timestamp: data.timestamp?.toDate() || new Date(),
          responseTime: data.responseTime,
          contentType: data.contentType,
          meta: data.meta,
          tableData: data.tableData,
          pdfData: data.pdfData,
          pdfFiles: data.pdfFiles
        };

        // Validate and clean graph data if present
        if (data.graphData) {
          if (data.graphData.data && Array.isArray(data.graphData.data) && data.graphData.data.length > 0) {
            message.graphData = data.graphData;
          } else {
            // Remove invalid graph data
            message.contentType = message.contentType === 'graph' ? 'text' : message.contentType;
          }
        }

        return message;
      });

      if (newMessages.length > 0) {
        setMessages(prev => [...newMessages.reverse(), ...prev]);
        setLastMessageDoc(messagesSnapshot.docs[messagesSnapshot.docs.length - 1]);
        setHasMoreMessages(messagesSnapshot.docs.length === 20);
      } else {
        setHasMoreMessages(false);
      }

      setIsLoading(false);
    } catch (err) {
      console.error('Erreur lors du chargement des messages supplémentaires:', err);
      setError('Erreur lors du chargement des messages supplémentaires');
      setIsLoading(false);
    }
  };

  const createNewConversation = async (): Promise<string> => {
    const title = `Conversation ${new Date().toLocaleDateString('fr-FR')}`;
    return await createConversation(title);
  };

  const updateConversationTitle = async (conversationId: string, title: string): Promise<void> => {
    try {
      setError(null);
      
      
      try {
        const conversationRef = doc(db, 'conversations', conversationId);
        await updateDoc(conversationRef, {
          title: title.trim(),
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        console.error('❌ FIREBASE SAVE ERROR - Failed to update conversation title:', error);
        throw error;
      }

      // Update local state
      setConversations(prev => prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, title: title.trim(), updatedAt: new Date() }
          : conv
      ));

      if (currentConversation?.id === conversationId) {
        setCurrentConversation(prev => prev ? { ...prev, title: title.trim(), updatedAt: new Date() } : null);
      }

    } catch (err) {
      console.error('Erreur lors de la mise à jour du titre:', err);
      setError('Erreur lors de la mise à jour du titre');
      throw err;
    }
  };

  const triggerAutoLoad = async (): Promise<void> => {
    // Only auto-load if we have conversations, no current conversation, not loading, and not adding a message
    if (conversations.length > 0 && !currentConversation && !isLoading && !isAddingMessage) {
      try {
        console.groupCollapsed('[Chat] Manual trigger auto-load most recent conversation');
        console.debug('Conversations ordered by lastMessageAt desc:', conversations.map(c => ({ id: c.id, title: c.title, lastMessageAt: c.lastMessageAt })));
        console.debug('Selecting conversation:', { id: conversations[0].id, title: conversations[0].title });
        await loadConversation(conversations[0].id);
        console.groupEnd();
      } catch (error) {
        console.error('Error auto-loading recent conversation:', error);
      }
    }
  };

  return (
    <ConversationContext.Provider value={{
      currentConversation,
      conversations,
      messages,
      isLoading,
      hasMoreMessages,
      createConversation,
      addMessage,
      addMessageToLocalState,
      replaceOptimisticMessage,
      loadMoreMessages,
      loadConversation,
      createNewConversation,
      updateConversationTitle,
      triggerAutoLoad,
      error
    }}>
      {children}
    </ConversationContext.Provider>
  );
};

export const useConversation = () => {
  const context = useContext(ConversationContext);
  if (context === undefined) {
    throw new Error('useConversation must be used within a ConversationProvider');
  }
  return context;
};

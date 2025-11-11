import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
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

// Shallow comparison utilities to prevent unnecessary state updates
function sameIds(a: {id: string}[], b: {id: string}[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id) return false;
  }
  return true;
}

function sameMessages(a: ChatMessage[], b: ChatMessage[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id) return false;
  }
  return true;
}

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

  // Refs to track previous state and prevent unnecessary updates
  const lastConversationsRef = useRef<Conversation[]>([]);
  const lastMessagesRef = useRef<ChatMessage[]>([]);
  const debounceTimer = useRef<number | null>(null);

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
      
      // Only update if conversations actually changed
      if (!sameIds(conversationsData, lastConversationsRef.current)) {
        lastConversationsRef.current = conversationsData;
        setConversations(conversationsData);
      }
      setIsLoading(false);
    }, (err) => {
      console.error('Erreur lors du chargement des conversations:', err);
      setError('Erreur lors du chargement des conversations');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Auto-load the most recent conversation when conversations are loaded
  // Note: loadConversation is defined later, so we use conversations directly
  useEffect(() => {
    const autoLoadRecent = async () => {
      // Only auto-load if we have conversations, no current conversation, not loading, and not adding a message
      if (conversations.length > 0 && !currentConversation && !isLoading && !isAddingMessage) {
        try {
          // loadConversation will be available via closure when this effect runs
          const conversationId = conversations[0].id;
          if (user && PermissionManager.canLoadConversations(user)) {
            const conversation = conversations.find(c => c.id === conversationId);
            if (conversation) {
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
                  
                  // Validate and parse timestamp safely
                  let timestamp: Date;
                  try {
                    if (data.timestamp?.toDate) {
                      timestamp = data.timestamp.toDate();
                    } else if (data.timestamp?.seconds) {
                      timestamp = new Date(data.timestamp.seconds * 1000);
                    } else if (data.timestamp) {
                      timestamp = new Date(data.timestamp);
                    } else {
                      timestamp = new Date();
                    }
                    
                    // Validate timestamp is valid
                    if (isNaN(timestamp.getTime())) {
                      console.warn('Invalid timestamp for message:', doc.id, data.timestamp);
                      timestamp = new Date();
                    }
                  } catch (error) {
                    console.warn('Error parsing timestamp for message:', doc.id, error);
                    timestamp = new Date();
                  }
                  
                  const message: ChatMessage = {
                    id: doc.id,
                    type: data.type,
                    content: data.content,
                    timestamp: timestamp,
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

                // Simple approach: replace the entire messages array with the unique messages from Firebase
                // This ensures we always have the authoritative state from Firebase
                // Update messages from Firebase with debouncing to prevent rapid updates
                if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
                debounceTimer.current = window.setTimeout(() => {
                  // Only update if messages actually changed (check IDs and length)
                  const messagesChanged = !sameMessages(uniqueMessages, lastMessagesRef.current);
                  if (messagesChanged) {
                    lastMessagesRef.current = uniqueMessages;
                    setMessages(uniqueMessages);
                  }
                  setHasMoreMessages(false);
                  setLastMessageDoc(snapshot.docs[snapshot.docs.length - 1] || null);
                }, 100); // Increased debounce to 100ms to reduce rapid updates
              }, (err) => {
                console.error('Error in real-time messages listener:', err);
              });

              setMessagesListener(() => unsubscribe);
            }
          }
        } catch (error) {
          console.error('Error auto-loading recent conversation:', error);
        }
      }
    };
    
    autoLoadRecent();
  }, [conversations.length, currentConversation?.id, isLoading, isAddingMessage, user, conversations, messagesListener]);

  // Cleanup listener on unmount
  useEffect(() => {
    return () => {
      if (messagesListener) {
        messagesListener();
      }
    };
  }, [messagesListener]);

  const createConversation = useCallback(async (title: string): Promise<string> => {
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
  }, [user]);

  const addMessage = useCallback(async (message: ChatMessage): Promise<void> => {
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
  }, [currentConversation]);

  const addMessageToLocalState = useCallback((message: ChatMessage): void => {
    setMessages(prev => {
      // Check if message already exists to prevent duplicates
      // Check by ID first (most reliable)
      const existsById = prev.some(m => m.id === message.id);
      if (existsById) {
        return prev;
      }
      
      // For user messages, also check content and time to catch optimistic updates
      if (message.type === 'user') {
        const existsByContent = prev.some(m => {
          if (m.type === 'user') {
            // Check if content matches and timestamp is very close (within 5 seconds)
            const timeDiff = Math.abs(m.timestamp.getTime() - message.timestamp.getTime());
            return m.content === message.content && timeDiff < 5000;
          }
          return false;
        });
        if (existsByContent) {
          return prev;
        }
      }
      
      // Add message and sort by timestamp to maintain order
      const newMessages = [...prev, message];
      const sortedMessages = newMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      return sortedMessages;
    });
  }, []);

  const replaceOptimisticMessage = useCallback((optimisticId: string, realMessage: ChatMessage): void => {
    setMessages(prev => {
      return prev.map(msg => {
        // Replace the optimistic message with the real one
        if (msg.id === optimisticId && msg.type === 'user') {
          return realMessage;
        }
        return msg;
      });
    });
  }, []);

  const loadConversation = useCallback(async (conversationId: string): Promise<void> => {
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
          
          // Validate and parse timestamp safely
          let timestamp: Date;
          try {
            if (data.timestamp?.toDate) {
              timestamp = data.timestamp.toDate();
            } else if (data.timestamp?.seconds) {
              timestamp = new Date(data.timestamp.seconds * 1000);
            } else if (data.timestamp) {
              timestamp = new Date(data.timestamp);
            } else {
              timestamp = new Date();
            }
            
            // Validate timestamp is valid
            if (isNaN(timestamp.getTime())) {
              console.warn('Invalid timestamp for message:', doc.id, data.timestamp);
              timestamp = new Date();
            }
          } catch (error) {
            console.warn('Error parsing timestamp for message:', doc.id, error);
            timestamp = new Date();
          }
          
          const message: ChatMessage = {
            id: doc.id,
            type: data.type,
            content: data.content,
            timestamp: timestamp,
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

        // Simple approach: replace the entire messages array with the unique messages from Firebase
        // This ensures we always have the authoritative state from Firebase
        // Update messages from Firebase with debouncing to prevent rapid updates
        if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
        debounceTimer.current = window.setTimeout(() => {
          // Only update if messages actually changed (check IDs and length)
          const messagesChanged = !sameMessages(uniqueMessages, lastMessagesRef.current);
          if (messagesChanged) {
            lastMessagesRef.current = uniqueMessages;
            setMessages(uniqueMessages);
          }
          setHasMoreMessages(false);
          setLastMessageDoc(snapshot.docs[snapshot.docs.length - 1] || null);
        }, 100); // Increased debounce to 100ms to reduce rapid updates
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
  }, [user, conversations]);

  const loadMoreMessages = useCallback(async (): Promise<void> => {
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
  }, [currentConversation, hasMoreMessages, isLoading, lastMessageDoc]);

  const createNewConversation = useCallback(async (): Promise<string> => {
    const title = `Conversation ${new Date().toLocaleDateString('fr-FR')}`;
    return await createConversation(title);
  }, [createConversation]);

  const updateConversationTitle = useCallback(async (conversationId: string, title: string): Promise<void> => {
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
  }, [currentConversation]);

  const triggerAutoLoad = useCallback(async (): Promise<void> => {
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
  }, [conversations, currentConversation, isLoading, isAddingMessage, loadConversation]);

  // Memoize provider value to prevent unnecessary re-renders
  const value = useMemo(() => ({
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
  }), [
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
  ]);

  return (
    <ConversationContext.Provider value={value}>
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

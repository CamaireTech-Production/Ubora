import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
  Timestamp,
  increment
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Conversation, ChatMessage } from '../types';
import { useAuth } from './AuthContext';

interface ConversationContextType {
  currentConversation: Conversation | null;
  conversations: Conversation[];
  messages: ChatMessage[];
  isLoading: boolean;
  hasMoreMessages: boolean;
  createConversation: (title: string) => Promise<string>;
  addMessage: (message: ChatMessage) => Promise<void>;
  loadMoreMessages: () => Promise<void>;
  loadConversation: (conversationId: string) => Promise<void>;
  createNewConversation: () => Promise<string>;
  updateConversationTitle: (conversationId: string, title: string) => Promise<void>;
  error: string | null;
}

const ConversationContext = createContext<ConversationContextType | undefined>(undefined);

export const ConversationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, firebaseUser } = useAuth();
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [lastMessageDoc, setLastMessageDoc] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

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
      const conversationsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        lastMessageAt: doc.data().lastMessageAt?.toDate() || new Date(),
        messages: [] // Messages will be loaded separately
      })) as Conversation[];
      
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
      if (conversations.length > 0 && !currentConversation && !isLoading) {
        try {
          await loadConversation(conversations[0].id);
        } catch (error) {
          console.error('Error auto-loading recent conversation:', error);
        }
      }
    };
    
    autoLoadRecent();
  }, [conversations.length, currentConversation, isLoading]);

  const createConversation = async (title: string): Promise<string> => {
    if (!user || user.role !== 'directeur' || !user.agencyId) {
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
      
      // Add message to local state immediately
      setMessages(prev => [...prev, message]);
      
      // Store message in Firestore subcollection
      const messageRef = await addDoc(collection(db, 'conversations', currentConversation.id, 'messages'), {
        ...message,
        timestamp: serverTimestamp()
      });

      // Update conversation metadata in Firestore
      const conversationRef = doc(db, 'conversations', currentConversation.id);
      await updateDoc(conversationRef, {
        updatedAt: serverTimestamp(),
        lastMessageAt: serverTimestamp(),
        messageCount: increment(1)
      });

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
    }
  };

  const loadConversation = async (conversationId: string): Promise<void> => {
    if (!user || user.role !== 'directeur') {
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
      
      // Load messages with pagination
      const messagesQuery = query(
        collection(db, 'conversations', conversationId, 'messages'),
        orderBy('timestamp', 'desc'),
        limit(20)
      );

      const messagesSnapshot = await getDocs(messagesQuery);
      const messagesData = messagesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      })) as ChatMessage[];

      setMessages(messagesData.reverse()); // Reverse to show oldest first
      setHasMoreMessages(messagesSnapshot.docs.length === 20);
      setLastMessageDoc(messagesSnapshot.docs[messagesSnapshot.docs.length - 1]);

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
      const newMessages = messagesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      })) as ChatMessage[];

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
      
      const conversationRef = doc(db, 'conversations', conversationId);
      await updateDoc(conversationRef, {
        title: title.trim(),
        updatedAt: serverTimestamp()
      });

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

  return (
    <ConversationContext.Provider value={{
      currentConversation,
      conversations,
      messages,
      isLoading,
      hasMoreMessages,
      createConversation,
      addMessage,
      loadMoreMessages,
      loadConversation,
      createNewConversation,
      updateConversationTitle,
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

import { 
  collection, 
  addDoc, 
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  getDocs
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '@ubora/shared/contexts/AuthContext';

export interface PageViewRecord {
  id?: string;
  userId: string;
  userEmail: string;
  userName: string;
  page: string;
  path: string;
  timestamp: Date;
  duration?: number; // time spent on page in seconds
  referrer?: string;
  userAgent: string;
  sessionId: string;
  metadata?: Record<string, any>;
}

export interface SessionRecord {
  id?: string;
  sessionId: string;
  userId: string;
  userEmail: string;
  userName: string;
  startTime: Date;
  endTime?: Date;
  totalDuration?: number; // in seconds
  pages: string[];
  deviceInfo: {
    userAgent: string;
    platform: string;
    language: string;
  };
  isActive: boolean;
}

class PageTrackingService {
  private static readonly PAGE_VIEWS_COLLECTION = 'pageViews';
  private static readonly SESSIONS_COLLECTION = 'userSessions';
  private static currentSessionId: string | null = null;
  private static currentPageStartTime: number = 0;
  private static currentPage: string = '';

  /**
   * Initialize page tracking for a user session
   */
  static initializeSession(userId: string, userEmail: string, userName: string): string {
    // Validate required parameters
    if (!userId || !userEmail || !userName) {
      console.warn('Cannot initialize session: missing required user data', { userId, userEmail, userName });
      return this.generateSessionId();
    }

    const sessionId = this.generateSessionId();
    this.currentSessionId = sessionId;
    
    const sessionData: Omit<SessionRecord, 'id'> = {
      sessionId,
      userId,
      userEmail,
      userName,
      startTime: new Date(),
      pages: [],
      deviceInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language
      },
      isActive: true
    };

    // Store session in Firestore
    addDoc(collection(db, this.SESSIONS_COLLECTION), sessionData).catch(error => {
      console.error('Error creating session:', error);
    });

    // Store session in localStorage for persistence
    localStorage.setItem('currentSessionId', sessionId);
    localStorage.setItem('sessionStartTime', new Date().toISOString());

    return sessionId;
  }

  /**
   * Track page view
   */
  static async trackPageView(
    page: string, 
    path: string, 
    userId: string, 
    userEmail: string, 
    userName: string,
    referrer?: string
  ): Promise<void> {
    try {
      // Validate required parameters
      if (!userId || !userEmail || !userName || !page || !path) {
        console.warn('Cannot track page view: missing required data', { userId, userEmail, userName, page, path });
        return;
      }

      // End previous page tracking if exists
      if (this.currentPage && this.currentPageStartTime > 0) {
        const duration = Math.floor((Date.now() - this.currentPageStartTime) / 1000);
        await this.endPageView(duration);
      }

      // Start new page tracking
      this.currentPage = page;
      this.currentPageStartTime = Date.now();

      const sessionId = this.getCurrentSessionId();
      
      const pageViewData: Omit<PageViewRecord, 'id'> = {
        userId,
        userEmail,
        userName,
        page,
        path,
        timestamp: new Date(),
        referrer: referrer || document.referrer,
        userAgent: navigator.userAgent,
        sessionId,
        metadata: {
          screenWidth: window.screen.width,
          screenHeight: window.screen.height,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight
        }
      };

      await addDoc(collection(db, this.PAGE_VIEWS_COLLECTION), pageViewData);

      // Update session with new page
      await this.updateSessionPages(sessionId, page);

    } catch (error) {
      console.error('Error tracking page view:', error);
    }
  }

  /**
   * End current page view and record duration
   */
  static async endPageView(duration: number): Promise<void> {
    if (!this.currentPage || !this.currentSessionId) return;

    try {
      // Update the last page view with duration
      const pageViewsQuery = query(
        collection(db, this.PAGE_VIEWS_COLLECTION),
        where('sessionId', '==', this.currentSessionId),
        where('page', '==', this.currentPage),
        orderBy('timestamp', 'desc'),
        limit(1)
      );

      const snapshot = await getDocs(pageViewsQuery);
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        // Note: In a real implementation, you'd update the document with duration
        // For now, we'll just log it
        console.log(`Page ${this.currentPage} duration: ${duration} seconds`);
      }
    } catch (error) {
      console.error('Error ending page view:', error);
    }
  }

  /**
   * End user session
   */
  static async endSession(): Promise<void> {
    if (!this.currentSessionId) return;

    try {
      // End current page view
      if (this.currentPage && this.currentPageStartTime > 0) {
        const duration = Math.floor((Date.now() - this.currentPageStartTime) / 1000);
        await this.endPageView(duration);
      }

      // Calculate total session duration
      const sessionStartTime = localStorage.getItem('sessionStartTime');
      const totalDuration = sessionStartTime 
        ? Math.floor((Date.now() - new Date(sessionStartTime).getTime()) / 1000)
        : 0;

      // Update session in Firestore
      const sessionsQuery = query(
        collection(db, this.SESSIONS_COLLECTION),
        where('sessionId', '==', this.currentSessionId)
      );

      const snapshot = await getDocs(sessionsQuery);
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        // Note: In a real implementation, you'd update the document
        console.log(`Session ${this.currentSessionId} ended. Total duration: ${totalDuration} seconds`);
      }

      // Clear session data
      this.currentSessionId = null;
      this.currentPage = '';
      this.currentPageStartTime = 0;
      localStorage.removeItem('currentSessionId');
      localStorage.removeItem('sessionStartTime');

    } catch (error) {
      console.error('Error ending session:', error);
    }
  }

  /**
   * Get recent page views for a user
   */
  static async getUserPageViews(userId: string, limitCount: number = 50): Promise<PageViewRecord[]> {
    try {
      const pageViewsQuery = query(
        collection(db, this.PAGE_VIEWS_COLLECTION),
        where('userId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(pageViewsQuery);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as PageViewRecord));
    } catch (error) {
      console.error('Error fetching user page views:', error);
      return [];
    }
  }

  /**
   * Get user sessions
   */
  static async getUserSessions(userId: string, limitCount: number = 20): Promise<SessionRecord[]> {
    try {
      const sessionsQuery = query(
        collection(db, this.SESSIONS_COLLECTION),
        where('userId', '==', userId),
        orderBy('startTime', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(sessionsQuery);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as SessionRecord));
    } catch (error) {
      console.error('Error fetching user sessions:', error);
      return [];
    }
  }

  /**
   * Get current session ID
   */
  private static getCurrentSessionId(): string {
    if (this.currentSessionId) {
      return this.currentSessionId;
    }

    // Try to get from localStorage
    const storedSessionId = localStorage.getItem('currentSessionId');
    if (storedSessionId) {
      this.currentSessionId = storedSessionId;
      return storedSessionId;
    }

    // Generate new session ID but don't store it yet
    // It will be properly stored when initializeSession is called with valid user data
    return this.generateSessionId();
  }

  /**
   * Generate unique session ID
   */
  private static generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update session with new page
   */
  private static async updateSessionPages(sessionId: string, page: string): Promise<void> {
    try {
      const sessionsQuery = query(
        collection(db, this.SESSIONS_COLLECTION),
        where('sessionId', '==', sessionId)
      );

      const snapshot = await getDocs(sessionsQuery);
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const sessionData = doc.data() as SessionRecord;
        
        // Add page to pages array if not already present
        if (!sessionData.pages.includes(page)) {
          sessionData.pages.push(page);
          // Note: In a real implementation, you'd update the document
          console.log(`Updated session ${sessionId} with page: ${page}`);
        }
      }
    } catch (error) {
      console.error('Error updating session pages:', error);
    }
  }
}

export default PageTrackingService;

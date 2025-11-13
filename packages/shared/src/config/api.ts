/**
 * Centralized API Configuration
 * Single source of truth for all API endpoints and base URLs
 */

export const API_CONFIG = {
  // Development Environment
  DEV: {
    BASE_URL: 'https://apidev.ubora-app.com'
  },
  
  // Production Environment
  PROD: {
    BASE_URL: 'https://api.ubora-app.com'
  },
  
  // Local Development
  LOCAL: {
    BASE_URL: 'http://localhost:3000'
  }
};

// API Endpoints (relative paths)
export const API_ENDPOINTS = {
  AI_ASK: '/api/ai/ask',
  AI_FORMAT: '/api/ai/format',
  OCR_EXTRACT: '/api/ocr/extract',
  OCR_PDF: '/api/ocr/extractPdfText',
  FILES_DOWNLOAD: '/api/files/download',
  FCM_SEND: '/api/fcm/send',
  CRON_NOTIFICATIONS: '/api/cron/notifications',
  VECTOR_SYNC: '/api/vector/sync',
  VECTOR_HEALTH: '/api/vector/health',
  HEALTH: '/health',
  TEST: '/test'
};

/**
 * Get the appropriate API configuration based on environment
 */
export const getAPIConfig = () => {
  // Check for environment variable override
  if (import.meta.env.VITE_AI_ENDPOINT) {
    return {
      BASE_URL: import.meta.env.VITE_AI_ENDPOINT.replace('/api/ai/ask', '')
    };
  }
  
  // Local development
  if (import.meta.env.DEV) {
    return API_CONFIG.LOCAL;
  }
  
  // Check hostname for environment detection
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    if (hostname === 'dev.ubora-app.com') {
      return API_CONFIG.DEV;
    }
    
    if (hostname === 'my.ubora-app.com' || hostname === 'ubora-app.com') {
      return API_CONFIG.PROD;
    }
  }
  
  // Default fallback
  return API_CONFIG.DEV;
};

/**
 * Test API connectivity and fallback to HTTP if HTTPS fails
 */
export const testApiConnectivity = async (baseUrl: string): Promise<string> => {
  try {
    // Test HTTPS first
    const response = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache'
    });
    
    if (response.ok) {
      return baseUrl; // HTTPS works
    }
  } catch (error) {
    console.warn(`HTTPS connection failed for ${baseUrl}:`, error);
  }
  
  // Fallback to HTTP
  const httpUrl = baseUrl.replace('https://', 'http://');
  try {
    const response = await fetch(`${httpUrl}/health`, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache'
    });
    
    if (response.ok) {
      console.warn(`Using HTTP fallback for ${httpUrl}`);
      return httpUrl; // HTTP works
    }
  } catch (error) {
    console.error(`Both HTTPS and HTTP failed for ${baseUrl}:`, error);
  }
  
  return baseUrl; // Return original URL as fallback
};

// Export the current configuration
export const API = getAPIConfig();

// Helper function to build full URLs
export const buildApiUrl = (endpoint: string): string => {
  return `${API.BASE_URL}${endpoint}`;
};

// Convenience functions for common endpoints
export const getAIEndpoint = (): string => buildApiUrl(API_ENDPOINTS.AI_ASK);
export const getAIFormatEndpoint = (): string => buildApiUrl(API_ENDPOINTS.AI_FORMAT);
export const getOCRExtractEndpoint = (): string => buildApiUrl(API_ENDPOINTS.OCR_EXTRACT);
export const getOCRPDFEndpoint = (): string => buildApiUrl(API_ENDPOINTS.OCR_PDF);
export const getFilesDownloadEndpoint = (): string => buildApiUrl(API_ENDPOINTS.FILES_DOWNLOAD);
export const getFCMSendEndpoint = (): string => buildApiUrl(API_ENDPOINTS.FCM_SEND);
export const getCronNotificationsEndpoint = (): string => buildApiUrl(API_ENDPOINTS.CRON_NOTIFICATIONS);
export const getVectorSyncEndpoint = (): string => buildApiUrl(API_ENDPOINTS.VECTOR_SYNC);
export const getVectorHealthEndpoint = (): string => buildApiUrl(API_ENDPOINTS.VECTOR_HEALTH);
export const getHealthEndpoint = (): string => buildApiUrl(API_ENDPOINTS.HEALTH);
export const getTestEndpoint = (): string => buildApiUrl(API_ENDPOINTS.TEST);

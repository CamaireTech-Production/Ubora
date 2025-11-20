import { logger } from '@ubora/shared/utils/logger';

type EmailPayload = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
};

class EmailNotificationService {
  private apiBase: string;

  constructor() {
    // Default to local backend if env not set
    // Vite env var used on frontend
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this.apiBase = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || 'http://localhost:3000';
  }

  async sendEmail(payload: EmailPayload): Promise<boolean> {
    try {
      const res = await fetch(`${this.apiBase}/api/email/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text();
        logger.error('Email backend error', { response: txt }, 'EmailNotificationService');
        return false;
      }
      const data = await res.json();
      logger.debug('Email backend response', { data }, 'EmailNotificationService');
      return !!data.success;
    } catch (e) {
      logger.error('Email request failed', e, 'EmailNotificationService');
      return false;
    }
  }
}

export const emailNotificationService = new EmailNotificationService();



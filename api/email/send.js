import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { logger } from '../lib/logger.js';

// Ensure environment variables are loaded (prefer project root .env.local)
const loadedLocalEnv = dotenv.config({ path: path.join(process.cwd(), '.env.local') });
if (!loadedLocalEnv || !loadedLocalEnv.parsed) {
  dotenv.config({ path: path.join(process.cwd(), '.env') });
}

// Create reusable transporter object (Titan by default; Gmail supported via env)
const createTransporter = () => {
  const host = process.env.EMAIL_HOST || 'smtp.titan.email';
  const port = parseInt(process.env.EMAIL_PORT, 10) || 587;
  // If EMAIL_SECURE explicitly set use it, else infer from port 465
  const secure = typeof process.env.EMAIL_SECURE === 'string'
    ? process.env.EMAIL_SECURE === 'true'
    : port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: process.env.EMAIL_USER || 'your-email@yourdomain.com',
      pass: process.env.EMAIL_PASSWORD || 'your-email-password'
    }
  });
};

export default async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { to, subject, html, text } = req.body || {};
    if (!to || !subject || (!html && !text)) {
      return res.status(400).json({ success: false, error: 'Missing required fields: to, subject, html/text' });
    }

    logger.info('Sending email', { to, subject }, 'email/send.js');

    // Check if email configuration is available
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      logger.warn('Email configuration not set, logging email content', { to, subject, content: html || text }, 'email/send.js');
      
      return res.status(200).json({ 
        success: true, 
        message: 'Email logged (configuration not set)',
        note: 'Set EMAIL_USER and EMAIL_PASSWORD environment variables to enable real email sending'
      });
    }

    // Create transporter
    const transporter = createTransporter();

    // Verify connection configuration
    try {
      await transporter.verify();
      logger.info('SMTP connection verified', null, 'email/send.js');
    } catch (verifyErr) {
      // Provide better error messages for verification failures
      if (verifyErr.message.includes('Invalid login') || verifyErr.message.includes('BadCredentials')) {
        if (process.env.EMAIL_HOST === 'smtp.gmail.com' || process.env.EMAIL_USER?.endsWith('@gmail.com')) {
          throw new Error('Gmail authentication failed: You must use a Gmail App Password, not your regular password. Enable 2FA in Google Account settings, then generate an App Password.');
        } else {
          throw new Error('SMTP authentication failed: Check your EMAIL_USER and EMAIL_PASSWORD in .env.local');
        }
      }
      throw verifyErr;
    }

    // Email options
    const fromName = process.env.EMAIL_FROM_NAME || 'Ubora App';
    // Allow separate from address; fallback to auth user
    const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER;
    const mailOptions = {
      from: fromAddress ? `${fromName} <${fromAddress}>` : undefined,
      to: to,
      subject: subject,
      html: html,
      text: text || html?.replace(/<[^>]*>/g, '') // Strip HTML tags for text version
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);
    logger.info('Email sent successfully', { messageId: info.messageId, response: info.response }, 'email/send.js');

    return res.status(200).json({ 
      success: true, 
      message: 'Email sent successfully',
      messageId: info.messageId
    });

  } catch (err) {
    logger.error('Error sending email', err, 'email/send.js');
    
    // Provide helpful error messages for common issues
    let errorMessage = 'Email send failed';
    let helpfulTip = '';
    
    if (err.message.includes('Invalid login') || err.message.includes('BadCredentials')) {
      if (process.env.EMAIL_HOST === 'smtp.gmail.com' || process.env.EMAIL_USER?.endsWith('@gmail.com')) {
        errorMessage = 'Gmail authentication failed';
        helpfulTip = 'Gmail requires an App Password, not your regular password. See EMAIL_SETUP_GUIDE.md for instructions.';
      } else {
        errorMessage = 'SMTP authentication failed';
        helpfulTip = 'Check your EMAIL_USER and EMAIL_PASSWORD in .env.local';
      }
    } else if (err.message.includes('ECONNREFUSED') || err.message.includes('ETIMEDOUT')) {
      errorMessage = 'SMTP connection failed';
      helpfulTip = `Check EMAIL_HOST (${process.env.EMAIL_HOST || 'not set'}) and EMAIL_PORT (${process.env.EMAIL_PORT || 'not set'}) settings`;
    }
    
    return res.status(500).json({ 
      success: false, 
      error: errorMessage,
      details: err.message,
      tip: helpfulTip
    });
  }
};



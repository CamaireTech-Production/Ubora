import nodemailer from 'nodemailer';

// Create reusable transporter object using Hostinger Power Titan (Titan Email) SMTP
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.titan.email',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true' || false, // true for 465, false for other ports
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

    console.log('📧 [Email] Sending email to:', to);
    console.log('📧 [Email] Subject:', subject);

    // Check if email configuration is available
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.log('📧 [Email] Email configuration not set, logging email content:');
      console.log('📧 [Email] To:', to);
      console.log('📧 [Email] Subject:', subject);
      console.log('📧 [Email] Content:', html || text);
      
      return res.status(200).json({ 
        success: true, 
        message: 'Email logged (configuration not set)',
        note: 'Set EMAIL_USER and EMAIL_PASSWORD environment variables to enable real email sending'
      });
    }

    // Create transporter
    const transporter = createTransporter();

    // Verify connection configuration
    await transporter.verify();
    console.log('📧 [Email] SMTP connection verified');

    // Email options
    const mailOptions = {
      from: `"Ubora App" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: subject,
      html: html,
      text: text || html?.replace(/<[^>]*>/g, '') // Strip HTML tags for text version
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log('📧 [Email] ✅ Email sent successfully:', info.messageId);
    console.log('📧 [Email] Response:', info.response);

    return res.status(200).json({ 
      success: true, 
      message: 'Email sent successfully',
      messageId: info.messageId
    });

  } catch (err) {
    console.error('📧 [Email] ❌ Error sending email:', err);
    return res.status(500).json({ 
      success: false, 
      error: 'Email send failed', 
      details: err.message 
    });
  }
};



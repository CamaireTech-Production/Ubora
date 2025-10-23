import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables from .env.local (if it exists)
try {
  dotenv.config({ path: '.env.local' });
  console.log('✅ Loaded .env.local file');
} catch (error) {
  console.log('ℹ️  No .env.local file found, using system environment variables');
}

// Debug: Show which environment variables are loaded
console.log('🔧 Environment variables:');
console.log(`   CORS_ORIGIN: ${process.env.CORS_ORIGIN || 'Not set'}`);
console.log(`   FIREBASE_PROJECT_ID: ${process.env.FIREBASE_PROJECT_ID ? 'Set' : 'Not set'}`);
console.log(`   OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'Set' : 'Not set'}`);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Middleware - CORS configuration for development
const corsOrigins = [
  // Main domains
  'https://dev.ubora-app.com',     // Development frontend
  'https://ubora-app.com',         // Production frontend
  'https://my.ubora.com',          // Alternative production domain
  'https://dev.ubora.com',         // Alternative dev domain
  
  // API subdomains
  'https://apidev.ubora-app.com',  // API development subdomain
  'https://api.ubora-app.com',     // API production subdomain
  'https://apidev.ubora.com',      // Alternative API dev subdomain
  'https://api.ubora.com',         // Alternative API prod subdomain
  
  // Admin subdomains
  'https://admin.ubora-app.com',   // Admin development
  'https://admin.ubora.com',       // Admin production
  
  // Firebase hosting domains
  'https://studio-gpnfx.firebaseapp.com',  // Firebase auth domain
  'https://studio-gpnfx.web.app',          // Firebase hosting domain
  
  // Local development
  'http://localhost:5173',         // Vite dev server
  'http://localhost:3000',         // Local API server
  'http://localhost:4173',         // Vite preview
  'https://localhost:5173',        // HTTPS localhost
  'https://localhost:3000',        // HTTPS localhost API
  
  // HTTP versions (for development)
  'http://dev.ubora.com',          // HTTP version of dev domain
  'http://my.ubora.com',           // HTTP version of prod domain
  'http://dev.ubora-app.com',      // HTTP version of dev app domain
  'http://ubora-app.com',          // HTTP version of prod app domain
  
  // Environment variable overrides
  ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : [])
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if origin is in our allowed list
    if (corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // For development, be more permissive with localhost variations
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    
    // Log blocked origins for debugging
    console.log(`🚫 CORS blocked origin: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Handle preflight requests
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

app.use(express.json({ limit: '50mb' })); // Increase payload limit for large images
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Import the AI handlers (CommonJS modules)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const askHandler = require('../api/ai/ask.js');
const healthHandler = require('../api/ai/health.js');

console.log('🔄 Loading format handler...');
let formatHandler;
try {
  formatHandler = require('../api/ai/format.js');
  console.log('✅ Format handler loaded successfully:', typeof formatHandler);
} catch (error) {
  console.error('❌ Failed to load format handler:', error);
  process.exit(1);
}

// OCR handlers
const ocrExtractHandler = require('../api/ocr/extractText.js');
const ocrPdfExtractHandler = require('../api/ocr/extractPdfText.js');
const ocrHealthHandler = require('../api/ocr/health.js');

// File download handler
const { downloadHandler } = require('../api/files/download.js');

// FCM handler
const fcmSendHandler = require('../api/fcm/send.js');

// Routes
app.post('/api/ai/ask', askHandler);
app.get('/api/ai/health', healthHandler);
app.post('/api/ai/format', formatHandler);
app.get('/api/files/download', downloadHandler);
app.post('/api/fcm/send', fcmSendHandler);

// Test endpoint to verify server is running
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is running!', timestamp: new Date().toISOString() });
});

// Test endpoint for format handler
app.get('/api/ai/format', (req, res) => {
  res.json({ 
    message: 'Format endpoint is working!', 
    timestamp: new Date().toISOString(),
    method: 'GET'
  });
});

console.log('✅ Format route registered: POST /api/ai/format');
console.log('✅ Download route registered: GET /api/files/download');
console.log('✅ FCM route registered: POST /api/fcm/send');
console.log('✅ Test route registered: GET /api/test');

// OCR routes
app.post('/api/ocr/extract', ocrExtractHandler);
app.post('/api/ocr/extractPdfText', ocrPdfExtractHandler);
app.get('/api/ocr/health', ocrHealthHandler);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    ok: true, 
    message: 'Development server running',
    timestamp: new Date().toISOString()
  });
});

// Test endpoint for debugging
app.get('/test', (req, res) => {
  res.json({ 
    message: 'Backend is working!',
    env: {
      firebaseProjectId: process.env.FIREBASE_PROJECT_ID ? 'Set' : 'Missing',
      openaiKey: process.env.OPENAI_API_KEY ? 'Set' : 'Missing'
    },
    cors: {
      origin: req.headers.origin || 'No origin header',
      allowedOrigins: corsOrigins
    }
  });
});

// CORS debugging endpoint
app.get('/cors-debug', (req, res) => {
  res.json({
    message: 'CORS Debug Info',
    request: {
      origin: req.headers.origin || 'No origin header',
      host: req.headers.host,
      userAgent: req.headers['user-agent'],
      referer: req.headers.referer || 'No referer'
    },
    cors: {
      allowedOrigins: corsOrigins,
      isOriginAllowed: corsOrigins.includes(req.headers.origin) || 
                      (req.headers.origin && (req.headers.origin.includes('localhost') || req.headers.origin.includes('127.0.0.1')))
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Development server running on http://localhost:${PORT}`);
  console.log(`📡 AI endpoints available at:`);
  console.log(`   - POST http://localhost:${PORT}/api/ai/ask`);
  console.log(`   - GET  http://localhost:${PORT}/api/ai/health`);
  console.log(`📡 FCM endpoints available at:`);
  console.log(`   - POST http://localhost:${PORT}/api/fcm/send`);
  console.log(`📡 OCR endpoints available at:`);
  console.log(`   - POST http://localhost:${PORT}/api/ocr/extract`);
  console.log(`   - POST http://localhost:${PORT}/api/ocr/extractPdfText`);
  console.log(`   - GET  http://localhost:${PORT}/api/ocr/health`);
  console.log(`\n🌐 CORS Configuration:`);
  console.log(`   Allowed origins: ${corsOrigins.join(', ')}`);
  console.log(`   Plus any localhost/127.0.0.1 variations`);
  console.log(`\n💡 To start both frontend and backend:`);
  console.log(`   npm run dev:full`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down development server...');
  process.exit(0);
});

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware - CORS configuration for production
const corsOrigins = [
  // Main domains
  'https://dev.ubora-app.com',     // Development frontend
  'https://ubora-app.com',         // Production frontend
  'https://my.ubora.com',          // Alternative production domain
  'https://dev.ubora.com',         // Alternative dev domain
  'https://pre.ubora-app.com',     // Pre-release frontend
  
  // API subdomains (in case frontend calls API from different subdomain)
  'https://apidev.ubora-app.com',  // API development subdomain
  'https://api.ubora-app.com',     // API production subdomain
  'https://apirelease.ubora-app.com', // API pre-release subdomain
  'https://apidev.ubora.com',      // Alternative API dev subdomain
  'https://api.ubora.com',         // Alternative API prod subdomain
  
  // Admin subdomains
  'https://admindev.ubora-app.com', // Admin development
  'https://admin.ubora-app.com',   // Admin production
  'https://adminpre.ubora-app.com', // Admin pre-release
  'https://admin.ubora.com',       // Admin production
  
  // Firebase hosting domains (from firebaseConfig.ts)
  'https://studio-gpnfx.firebaseapp.com',  // Firebase auth domain
  'https://studio-gpnfx.web.app',          // Firebase hosting domain
  
  // Local development
  'http://localhost:5173',         // Vite dev server
  'http://localhost:3000',         // Local API server
  'http://localhost:4173',         // Vite preview
  'https://localhost:5173',        // HTTPS localhost
  'https://localhost:3000',        // HTTPS localhost API
  
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
    
    // For production, be more restrictive but allow known domains
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

// Vector database handlers (dynamic import with error handling)
let vectorSyncHandler;
let vectorHealthHandler;
let vectorSyncRetryHandler;
try {
  vectorSyncHandler = require('../api/vector/sync.js');
  vectorHealthHandler = require('../api/vector/health.js');
  vectorSyncRetryHandler = require('../api/vector/sync/retry.js');
  console.log('✅ Vector handlers loaded successfully');
} catch (error) {
  console.error('❌ Failed to load vector handlers:', error);
  // Don't exit - vector DB is optional for backward compatibility
}

// Format retry handler
let formatRetryHandler;
try {
  formatRetryHandler = require('../api/ai/format/retry.js');
  console.log('✅ Format retry handler loaded successfully');
} catch (error) {
  console.error('❌ Failed to load format retry handler:', error);
}

// Form entry status handler
let formEntryStatusHandler;
try {
  formEntryStatusHandler = require('../api/form-entry/status.js');
  console.log('✅ Form entry status handler loaded successfully');
} catch (error) {
  console.error('❌ Failed to load form entry status handler:', error);
}

// OCR handlers
const ocrExtractHandler = require('../api/ocr/extractText.js');
const ocrPdfExtractHandler = require('../api/ocr/extractPdfText.js');
const ocrHealthHandler = require('../api/ocr/health.js');

// API Routes
app.post('/api/ai/ask', askHandler);
app.get('/api/ai/health', healthHandler);
app.post('/api/ai/format', formatHandler);

// Vector database routes (only if handlers loaded)
if (vectorSyncHandler && vectorHealthHandler) {
  app.post('/api/vector/sync', vectorSyncHandler);
  app.get('/api/vector/health', vectorHealthHandler);
  if (vectorSyncRetryHandler) {
    app.post('/api/vector/sync/retry', vectorSyncRetryHandler);
    console.log('✅ Vector sync retry route registered: POST /api/vector/sync/retry');
  }
  console.log('✅ Vector routes registered');
} else {
  console.warn('⚠️ Vector routes not registered (handlers not loaded)');
}

// Format retry route
if (formatRetryHandler) {
  app.post('/api/ai/format/retry', formatRetryHandler);
  console.log('✅ Format retry route registered: POST /api/ai/format/retry');
}

// Form entry status route
if (formEntryStatusHandler) {
  app.get('/api/form-entry/:formEntryId/status', formEntryStatusHandler);
  console.log('✅ Form entry status route registered: GET /api/form-entry/:formEntryId/status');
}

console.log('✅ Format route registered: POST /api/ai/format');

// OCR routes
app.post('/api/ocr/extract', ocrExtractHandler);
app.post('/api/ocr/extractPdfText', ocrPdfExtractHandler);
app.get('/api/ocr/health', ocrHealthHandler);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    ok: true, 
    message: 'Production server running on VPS',
    timestamp: new Date().toISOString(),
    port: PORT,
    cors: {
      allowedOrigins: corsOrigins,
      requestOrigin: req.headers.origin || 'No origin header'
    }
  });
});

// Detailed health check for debugging
app.get('/health/detailed', (req, res) => {
  res.json({
    ok: true,
    server: 'Production API Server',
    timestamp: new Date().toISOString(),
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    cors: {
      allowedOrigins: corsOrigins,
      requestOrigin: req.headers.origin || 'No origin header',
      isOriginAllowed: corsOrigins.includes(req.headers.origin) || !req.headers.origin
    },
    endpoints: {
      ai: ['/api/ai/ask', '/api/ai/format', '/api/ai/health'],
      ocr: ['/api/ocr/extract', '/api/ocr/extractPdfText', '/api/ocr/health'],
      files: ['/api/files/download'],
      health: ['/health', '/health/detailed', '/test']
    },
    environment_variables: {
      corsOrigin: process.env.CORS_ORIGIN || 'Not set',
      firebaseProjectId: process.env.FIREBASE_PROJECT_ID ? 'Set' : 'Missing',
      openaiKey: process.env.OPENAI_API_KEY ? 'Set' : 'Missing',
      nodeEnv: process.env.NODE_ENV || 'Not set'
    }
  });
});

// Test endpoint for debugging
app.get('/test', (req, res) => {
  res.json({ 
    message: 'Backend is working!',
    env: {
      firebaseProjectId: process.env.FIREBASE_PROJECT_ID ? 'Set' : 'Missing',
      openaiKey: process.env.OPENAI_API_KEY ? 'Set' : 'Missing',
      corsOrigin: process.env.CORS_ORIGIN || 'Not set'
    }
  });
});

// API-only server - no static file serving
app.get('*', (req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: 'This is an API-only server. Frontend is served separately.',
    availableEndpoints: [
      'POST /api/ai/ask',
      'GET /api/ai/health',
      'POST /api/ai/format',
      'POST /api/vector/sync',
      'GET /api/vector/health',
      'POST /api/ocr/extract',
      'POST /api/ocr/extractPdfText',
      'GET /api/ocr/health',
      'GET /health'
    ]
  });
});

// Start server - bind to all interfaces
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Production server running on port ${PORT}`);
  console.log(`📡 AI endpoints available at:`);
  console.log(`   - POST /api/ai/ask`);
  console.log(`   - GET  /api/ai/health`);
  console.log(`   - POST /api/ai/format`);
  console.log(`📡 Vector Database endpoints available at:`);
  console.log(`   - POST /api/vector/sync`);
  console.log(`   - GET  /api/vector/health`);
  console.log(`📡 OCR endpoints available at:`);
  console.log(`   - POST /api/ocr/extract`);
  console.log(`   - POST /api/ocr/extractPdfText`);
  console.log(`   - GET  /api/ocr/health`);
  console.log(`📡 File endpoints available at:`);
  console.log(`   - GET  /api/files/download`);
  console.log(`📡 Health check endpoints:`);
  console.log(`   - GET  /health`);
  console.log(`   - GET  /health/detailed`);
  console.log(`   - GET  /test`);
  console.log(`🌐 CORS Origins: ${corsOrigins.join(', ')}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Firebase Project: ${process.env.FIREBASE_PROJECT_ID || 'Not configured'}`);
  console.log(`🤖 OpenAI: ${process.env.OPENAI_API_KEY ? 'Configured' : 'Not configured'}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down production server...');
  process.exit(0);
});

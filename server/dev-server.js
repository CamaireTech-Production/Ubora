import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Prefer .env.local at project root; fallback to .env
// Also try loading from the same directory as the script
const scriptDir = path.dirname(__dirname);
const envPaths = [
  path.join(process.cwd(), '.env.local'),
  path.join(process.cwd(), '.env'),
  path.join(scriptDir, '..', '.env.local'),
  path.join(scriptDir, '..', '.env'),
];

let envLoaded = false;
for (const envPath of envPaths) {
  const loaded = dotenv.config({ path: envPath });
  if (loaded && !loaded.error) {
    console.log(`✅ Loaded environment from: ${envPath}`);
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  console.log('ℹ️  No .env(.local) found, using system environment variables');
  console.log(`📁 Current working directory: ${process.cwd()}`);
  console.log(`📁 Script directory: ${scriptDir}`);
  console.log(`📁 Attempted paths: ${envPaths.join(', ')}`);
}

// Debug: Show which environment variables are loaded
console.log('🔧 Environment variables:');
console.log(`   CORS_ORIGIN: ${process.env.CORS_ORIGIN || 'Not set'}`);
console.log(`   FIREBASE_PROJECT_ID: ${process.env.FIREBASE_PROJECT_ID ? 'Set' : 'Not set'}`);
console.log(`   OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'Set' : 'Not set'}`);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Middleware - CORS configuration for development
const corsOrigins = [
  // Main domains
  'https://dev.ubora-app.com',     // Development frontend
  'https://ubora-app.com',         // Production frontend
  'https://my.ubora.com',          // Alternative production domain
  'https://dev.ubora.com',         // Alternative dev domain
  'https://pre.ubora-app.com',     // Pre-release frontend
  
  // API subdomains
  'https://apidev.ubora-app.com',  // API development subdomain
  'https://api.ubora-app.com',     // API production subdomain
  'https://apirelease.ubora-app.com', // API pre-release subdomain
  'https://apidev.ubora.com',      // Alternative API dev subdomain
  'https://api.ubora.com',         // Alternative API prod subdomain
  
  // Admin subdomains
  'https://admindev.ubora-app.com', // Admin development
  'https://admin.ubora-app.com',    // Admin production
  'https://adminpre.ubora-app.com', // Admin pre-release
  'https://admin.ubora.com',         // Admin production (alternative)
  
  // Firebase hosting domains
  'https://studio-gpnfx.firebaseapp.com',  // Firebase auth domain
  'https://studio-gpnfx.web.app',          // Firebase hosting domain
  
  // Local development
  'http://localhost:5173',         // Main app dev server
  'http://localhost:5172',         // Admin app dev server
  'http://localhost:3000',         // Local API server
  'http://localhost:4173',         // Main app preview
  'http://localhost:4172',         // Admin app preview
  'https://localhost:5173',        // HTTPS localhost main app
  'https://localhost:5172',        // HTTPS localhost admin app
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

// Import the AI handlers (ES modules)
import askHandler from '../api/ai/ask.js';
import healthHandler from '../api/ai/health.js';

// Verify handler is loaded
console.log('✅ askHandler loaded:', typeof askHandler);
if (typeof askHandler !== 'function') {
  console.error('❌ CRITICAL: askHandler is not a function!', typeof askHandler);
}

// Vector database handlers
import vectorSyncHandler from '../api/vector/sync.js';
import vectorHealthHandler from '../api/vector/health.js';
import vectorSyncRetryHandler from '../api/vector/sync/retry.js';

// Format retry handler
let formatRetryHandler;
try {
  formatRetryHandler = await import('../api/ai/format/retry.js');
  formatRetryHandler = formatRetryHandler.default;
  console.log('✅ Format retry handler loaded successfully');
} catch (error) {
  console.error('❌ Failed to load format retry handler:', error);
}

// Form entry status handler
let formEntryStatusHandler;
try {
  formEntryStatusHandler = await import('../api/form-entry/status.js');
  formEntryStatusHandler = formEntryStatusHandler.default;
  console.log('✅ Form entry status handler loaded successfully');
} catch (error) {
  console.error('❌ Failed to load form entry status handler:', error);
}

console.log('🔄 Loading format handler...');
let formatHandler;
try {
  formatHandler = await import('../api/ai/format.js');
  formatHandler = formatHandler.default;
  console.log('✅ Format handler loaded successfully:', typeof formatHandler);
} catch (error) {
  console.error('❌ Failed to load format handler:', error);
  process.exit(1);
}

// OCR handlers
import ocrExtractHandler from '../api/ocr/extractText.js';
import ocrPdfExtractHandler from '../api/ocr/extractPdfText.js';
import ocrHealthHandler from '../api/ocr/health.js';

// File download handler
import { downloadHandler } from '../api/files/download.js';

// FCM handler
import fcmSendHandler from '../api/fcm/send.js';
// Cron job handler
import cronNotificationsHandler from '../api/cron/notifications.js';
import emailSendHandler from '../api/email/send.js';

// Routes
// Wrap askHandler with error handling to catch any startup errors
app.post('/api/ai/ask', async (req, res) => {
  console.log('🔵 [SERVER] Route /api/ai/ask called');
  console.log('🔵 [SERVER] Request method:', req.method);
  console.log('🔵 [SERVER] Request headers:', {
    'content-type': req.headers['content-type'],
    'authorization': req.headers.authorization ? 'Bearer ***' : 'missing'
  });
  try {
    console.log('🔵 [SERVER] Calling askHandler...');
    await askHandler(req, res);
    console.log('🔵 [SERVER] askHandler completed');
  } catch (error) {
    console.error('❌ [SERVER] Error in askHandler wrapper:', error);
    console.error('❌ [SERVER] Error message:', error.message);
    console.error('❌ [SERVER] Error stack:', error.stack);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Erreur interne du serveur',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
});
app.get('/api/ai/health', healthHandler);
app.post('/api/ai/format', formatHandler);
if (formatRetryHandler) {
  app.post('/api/ai/format/retry', formatRetryHandler);
  console.log('✅ Format retry route registered: POST /api/ai/format/retry');
}
app.get('/api/files/download', downloadHandler);
app.post('/api/fcm/send', fcmSendHandler);
app.post('/api/cron/notifications', cronNotificationsHandler);
app.post('/api/email/send', emailSendHandler);

// Vector database routes
app.post('/api/vector/sync', vectorSyncHandler);
app.get('/api/vector/health', vectorHealthHandler);
if (vectorSyncRetryHandler) {
  app.post('/api/vector/sync/retry', vectorSyncRetryHandler);
  console.log('✅ Vector sync retry route registered: POST /api/vector/sync/retry');
}

// Form entry status route
if (formEntryStatusHandler) {
  app.get('/api/form-entry/:formEntryId/status', formEntryStatusHandler);
  console.log('✅ Form entry status route registered: GET /api/form-entry/:formEntryId/status');
}

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
console.log('✅ Vector sync route registered: POST /api/vector/sync');
console.log('✅ Vector health route registered: GET /api/vector/health');

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

// Start server with port fallback
function startServer(port = PORT, maxAttempts = 10) {
  const server = app.listen(port, () => {
    console.log(`🚀 Development server running on http://localhost:${port}`);
    if (port !== PORT) {
      console.log(`⚠️  Port ${PORT} was in use, using port ${port} instead`);
    }
    console.log(`📡 AI endpoints available at:`);
    console.log(`   - POST http://localhost:${port}/api/ai/ask`);
    console.log(`   - GET  http://localhost:${port}/api/ai/health`);
    console.log(`📡 Vector Database endpoints available at:`);
    console.log(`   - POST http://localhost:${port}/api/vector/sync`);
    console.log(`   - GET  http://localhost:${port}/api/vector/health`);
    console.log(`📡 FCM endpoints available at:`);
    console.log(`   - POST http://localhost:${port}/api/fcm/send`);
    console.log(`📡 OCR endpoints available at:`);
    console.log(`   - POST http://localhost:${port}/api/ocr/extract`);
    console.log(`   - POST http://localhost:${port}/api/ocr/extractPdfText`);
    console.log(`   - GET  http://localhost:${port}/api/ocr/health`);
    console.log(`📡 Cron endpoints available at:`);
    console.log(`   - POST http://localhost:${port}/api/cron/notifications`);
    console.log(`\n🌐 CORS Configuration:`);
    console.log(`   Allowed origins: ${corsOrigins.join(', ')}`);
    console.log(`   Plus any localhost/127.0.0.1 variations`);
    console.log(`\n💡 To start backend, main app, and admin app:`);
    console.log(`   npm run dev:full`);
    console.log(`\n📱 App URLs:`);
    console.log(`   Main App:  http://localhost:5173`);
    console.log(`   Admin App: http://localhost:5172`);
    
    // Start cron scheduler after server is ready
    startCronScheduler();
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      const attempts = port - PORT + 1;
      if (attempts >= maxAttempts) {
        console.error(`❌ Could not find available port after ${maxAttempts} attempts`);
        process.exit(1);
      } else {
        console.log(`Port ${port} is in use, trying port ${port + 1}...`);
        startServer(port + 1, maxAttempts);
      }
    } else {
      console.error('❌ Server error:', err);
      process.exit(1);
    }
  });
}

// Start the server
startServer();

// ========================================
// AUTOMATIC CRON JOB SCHEDULER
// ========================================

let cronIntervalId = null;

// Start automatic cron job scheduler
function startCronScheduler() {
  // DEBUG: Cron logs disabled - uncomment to enable
  // console.log('🔄 [CronScheduler] Starting automatic cron job scheduler...');
  
  // Run immediately on startup (with a small delay to ensure server is ready)
  setTimeout(() => {
    runCronJob();
  }, 5000); // Wait 5 seconds after server startup
  
  // Then run every 2 minutes
  cronIntervalId = setInterval(() => {
    runCronJob();
  }, 2 * 60 * 1000); // 2 minutes
  
  // DEBUG: Cron logs disabled - uncomment to enable
  // console.log('✅ [CronScheduler] Automatic cron job scheduler started (every 2 minutes)');
}

// Stop automatic cron job scheduler
function stopCronScheduler() {
  if (cronIntervalId) {
    clearInterval(cronIntervalId);
    cronIntervalId = null;
    console.log('🛑 [CronScheduler] Automatic cron job scheduler stopped');
  }
}

// Run the cron job
async function runCronJob() {
  try {
    // DEBUG: Cron logs disabled - uncomment to enable
    // console.log('🔄 [CronScheduler] Running cron job...');
    
    // Create a mock request/response for the cron handler
    const mockReq = {
      method: 'POST',
      body: {},
      headers: {}
    };
    
    const mockRes = {
      status: (code) => ({
        json: (data) => {
          // DEBUG: Cron logs disabled - uncomment to enable
          // console.log(`📊 [CronScheduler] Cron job result:`, data);
          return mockRes;
        }
      }),
      setHeader: () => mockRes,
      end: () => mockRes
    };
    
    // Call the cron handler
    await cronNotificationsHandler(mockReq, mockRes);
    
  } catch (error) {
    // Keep error logs for debugging
    console.error('❌ [CronScheduler] Error running cron job:', error);
  }
}

// Start the scheduler
startCronScheduler();

// Graceful shutdown - stop scheduler
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down development server...');
  stopCronScheduler();
  process.exit(0);
});

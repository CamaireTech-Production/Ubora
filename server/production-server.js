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

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json());

// Import the AI handlers (CommonJS modules)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const askHandler = require('../api/ai/ask.js');
const healthHandler = require('../api/ai/health.js');

// API Routes
app.post('/api/ai/ask', askHandler);
app.get('/api/ai/health', healthHandler);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    ok: true, 
    message: 'Production server running on VPS',
    timestamp: new Date().toISOString(),
    port: PORT
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
      'GET /health'
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Production server running on port ${PORT}`);
  console.log(`📡 AI endpoints available at:`);
  console.log(`   - POST /api/ai/ask`);
  console.log(`   - GET  /api/ai/health`);
  console.log(`   - GET  /health`);
  console.log(`   - GET  /test`);
  console.log(`🌐 CORS Origin: ${process.env.CORS_ORIGIN || 'All origins allowed'}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Firebase Project: ${process.env.FIREBASE_PROJECT_ID || 'Not configured'}`);
  console.log(`🤖 OpenAI: ${process.env.OPENAI_API_KEY ? 'Configured' : 'Not configured'}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down production server...');
  process.exit(0);
});

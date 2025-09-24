import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Debug: Show which environment variables are loaded
console.log('🔧 Environment variables loaded:');
console.log('FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID ? '✅ Set' : '❌ Missing');
console.log('FIREBASE_CLIENT_EMAIL:', process.env.FIREBASE_CLIENT_EMAIL ? '✅ Set' : '❌ Missing');
console.log('FIREBASE_PRIVATE_KEY:', process.env.FIREBASE_PRIVATE_KEY ? '✅ Set' : '❌ Missing');
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase payload limit for large images
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Import the AI handlers (CommonJS modules)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const askHandler = require('../api/ai/ask.js');
const healthHandler = require('../api/ai/health.js');

// OCR handlers
const ocrExtractHandler = require('../api/ocr/extractText.js');
const ocrHealthHandler = require('../api/ocr/health.js');

// Routes
app.post('/api/ai/ask', askHandler);
app.get('/api/ai/health', healthHandler);

// OCR routes
app.post('/api/ocr/extract', ocrExtractHandler);
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
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Development server running on http://localhost:${PORT}`);
  console.log(`📡 AI endpoints available at:`);
  console.log(`   - POST http://localhost:${PORT}/api/ai/ask`);
  console.log(`   - GET  http://localhost:${PORT}/api/ai/health`);
  console.log(`📡 OCR endpoints available at:`);
  console.log(`   - POST http://localhost:${PORT}/api/ocr/extract`);
  console.log(`   - GET  http://localhost:${PORT}/api/ocr/health`);
  console.log(`\n💡 To start both frontend and backend:`);
  console.log(`   npm run dev:full`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down development server...');
  process.exit(0);
});

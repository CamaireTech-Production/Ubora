#!/usr/bin/env node

/**
 * Background Worker Starter Script
 * 
 * This script starts the formatting worker that processes PDF text formatting
 * in the background. It should be run as a separate process on your server.
 * 
 * Usage:
 *   node start-worker.js
 * 
 * Or with PM2:
 *   pm2 start start-worker.js --name "formatting-worker"
 */

// Load environment variables from the root directory
const path = require('path');
const dotenv = require('dotenv');

// Load .env.local from the root directory (parent of api directory)
const envPath = path.join(__dirname, '..', '.env.local');
// Note: Using console.log here as this is a startup script before logger is initialized
console.log('📁 Loading environment variables from:', envPath);

try {
  const result = dotenv.config({ path: envPath });
  if (result.error) {
    // Note: Using console.log here as this is a startup script
    console.log('⚠️  .env.local not found, trying .env...');
    // Fallback to .env if .env.local doesn't exist
    dotenv.config({ path: path.join(__dirname, '..', '.env') });
  } else {
    // Note: Using console.log here as this is a startup script
    console.log('✅ Loaded .env.local file');
  }
} catch (error) {
  // Note: Using console.error here as this is a startup script
  console.error('❌ Error loading environment variables:', error.message);
}

const formattingWorker = require('./background/formattingWorker');

// Note: Using console.log here as this is a startup script before logger is initialized
console.log('🚀 Starting PDF Text Formatting Worker...');
console.log('📋 Worker will process formatting errors and retries every 30 seconds');
console.log('🔧 Environment:', process.env.NODE_ENV || 'development');
console.log('🛑 Press Ctrl+C to stop the worker');

// Start the worker
formattingWorker.start();

// Handle graceful shutdown
process.on('SIGINT', () => {
  // Note: Using console.log here as this is a shutdown script
  console.log('\n🛑 Received SIGINT, shutting down worker...');
  formattingWorker.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  // Note: Using console.log here as this is a shutdown script
  console.log('\n🛑 Received SIGTERM, shutting down worker...');
  formattingWorker.stop();
  process.exit(0);
});

// Keep the process alive
process.on('uncaughtException', (error) => {
  // Note: Using console.error here as this is an error handler before logger
  console.error('❌ Uncaught Exception:', error);
  formattingWorker.stop();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  // Note: Using console.error here as this is an error handler before logger
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  formattingWorker.stop();
  process.exit(1);
});

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

const formattingWorker = require('./background/formattingWorker');

console.log('🚀 Starting PDF Text Formatting Worker...');
console.log('📋 Worker will process formatting errors and retries every 30 seconds');
console.log('🛑 Press Ctrl+C to stop the worker');

// Start the worker
formattingWorker.start();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down worker...');
  formattingWorker.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down worker...');
  formattingWorker.stop();
  process.exit(0);
});

// Keep the process alive
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  formattingWorker.stop();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  formattingWorker.stop();
  process.exit(1);
});

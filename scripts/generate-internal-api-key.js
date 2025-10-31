#!/usr/bin/env node

/**
 * Generate a secure random INTERNAL_API_KEY for server-to-server authentication
 * This key is used by the cron job to authenticate with the /api/ai/ask endpoint
 */

import crypto from 'crypto';

// Generate a secure random key (32 bytes = 256 bits, base64 encoded)
const generateSecureKey = () => {
  return crypto.randomBytes(32).toString('base64');
};

const key = generateSecureKey();

console.log('🔑 Generated INTERNAL_API_KEY:');
console.log('');
console.log(key);
console.log('');
console.log('📝 Add this to your .env.local or .env file:');
console.log(`INTERNAL_API_KEY=${key}`);
console.log('');
console.log('✅ After adding it, restart your server and cron worker.');
console.log('');
console.log('⚠️  Keep this key secret! It allows server-to-server authentication.');
console.log('   Make sure both your API server and cron worker use the same key.');


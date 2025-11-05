// Validate email configuration from .env.local
// Run with: node scripts/validate-email-config.js

import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local from project root
const envPath = path.join(__dirname, '..', '.env.local');
console.log('📁 Checking .env.local at:', envPath);

const result = config({ path: envPath });

if (result.error) {
  console.error('❌ Error loading .env.local:', result.error.message);
  console.log('\n💡 Make sure .env.local exists in the project root directory');
  process.exit(1);
}

if (!result.parsed) {
  console.error('❌ .env.local file is empty or could not be parsed');
  process.exit(1);
}

console.log('✅ .env.local file loaded successfully\n');

// Validate required variables
const requiredVars = {
  EMAIL_USER: 'Your Gmail address (e.g., uboraarcha@gmail.com)',
  EMAIL_PASSWORD: 'Gmail App Password (16 characters)',
  EMAIL_HOST: 'SMTP host (should be smtp.gmail.com for Gmail)',
  EMAIL_PORT: 'SMTP port (587 for TLS, 465 for SSL)',
};

const optionalVars = {
  EMAIL_SECURE: 'Set to "true" only if using port 465',
  EMAIL_FROM: 'From address (defaults to EMAIL_USER)',
  EMAIL_FROM_NAME: 'Display name (defaults to "Ubora App")',
};

console.log('🔍 Validating Configuration:\n');

let hasErrors = false;
let hasWarnings = false;

// Check required variables
for (const [varName, description] of Object.entries(requiredVars)) {
  const value = process.env[varName];
  
  if (!value) {
    console.log(`❌ ${varName}: MISSING - ${description}`);
    hasErrors = true;
  } else {
    // Validate specific values
    if (varName === 'EMAIL_USER') {
      if (!value.includes('@')) {
        console.log(`⚠️  ${varName}: Invalid format - should be an email address`);
        hasWarnings = true;
      } else if (!value.includes('@gmail.com') && !value.includes('@googlemail.com')) {
        console.log(`⚠️  ${varName}: Not a Gmail address - make sure you're using Gmail`);
        hasWarnings = true;
      } else {
        console.log(`✅ ${varName}: ${value}`);
      }
    } else if (varName === 'EMAIL_PASSWORD') {
      // App passwords are typically 16 characters (with or without spaces)
      const cleanPassword = value.replace(/\s/g, '');
      if (cleanPassword.length < 10) {
        console.log(`⚠️  ${varName}: Too short - App Password should be 16 characters`);
        hasWarnings = true;
      } else if (cleanPassword.length !== 16) {
        console.log(`⚠️  ${varName}: Length is ${cleanPassword.length} characters (expected 16)`);
        hasWarnings = true;
      } else {
        console.log(`✅ ${varName}: Set (${cleanPassword.length} characters) - ${cleanPassword.substring(0, 4)}****`);
      }
    } else if (varName === 'EMAIL_HOST') {
      if (value !== 'smtp.gmail.com') {
        console.log(`⚠️  ${varName}: ${value} - Expected "smtp.gmail.com" for Gmail`);
        hasWarnings = true;
      } else {
        console.log(`✅ ${varName}: ${value}`);
      }
    } else if (varName === 'EMAIL_PORT') {
      const port = parseInt(value, 10);
      if (isNaN(port) || (port !== 587 && port !== 465)) {
        console.log(`⚠️  ${varName}: ${value} - Should be 587 (TLS) or 465 (SSL)`);
        hasWarnings = true;
      } else {
        console.log(`✅ ${varName}: ${value} (${port === 587 ? 'TLS' : 'SSL'})`);
      }
    } else {
      console.log(`✅ ${varName}: ${value}`);
    }
  }
}

// Check optional variables
console.log('\n📋 Optional Configuration:');
for (const [varName, description] of Object.entries(optionalVars)) {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: ${value}`);
  } else {
    console.log(`ℹ️  ${varName}: Not set (${description})`);
  }
}

// Check for common mistakes
console.log('\n🔍 Checking for Common Issues:\n');

const emailPassword = process.env.EMAIL_PASSWORD || '';

// Check for quotes (should not have quotes)
if (emailPassword.startsWith('"') || emailPassword.startsWith("'")) {
  console.log('❌ ERROR: EMAIL_PASSWORD has quotes - Remove quotes from your password!');
  console.log('   Wrong: EMAIL_PASSWORD="abcd efgh ijkl mnop"');
  console.log('   Right: EMAIL_PASSWORD=abcd efgh ijkl mnop');
  hasErrors = true;
}

// Check EMAIL_SECURE matches port
const emailPort = parseInt(process.env.EMAIL_PORT, 10);
const emailSecure = process.env.EMAIL_SECURE === 'true';
if (emailPort === 465 && !emailSecure) {
  console.log('⚠️  WARNING: Using port 465 but EMAIL_SECURE is not "true"');
  console.log('   Should be: EMAIL_SECURE=true');
  hasWarnings = true;
}
if (emailPort === 587 && emailSecure) {
  console.log('⚠️  WARNING: Using port 587 but EMAIL_SECURE is "true"');
  console.log('   Should be: EMAIL_SECURE=false');
  hasWarnings = true;
}

// Summary
console.log('\n' + '='.repeat(60));
if (hasErrors) {
  console.log('❌ CONFIGURATION HAS ERRORS - Fix the issues above');
  console.log('\n💡 Common fixes:');
  console.log('   - Make sure all required variables are set');
  console.log('   - Remove quotes from EMAIL_PASSWORD');
  console.log('   - Use the 16-character App Password from Google');
  process.exit(1);
} else if (hasWarnings) {
  console.log('⚠️  CONFIGURATION HAS WARNINGS - Review the warnings above');
  console.log('\n✅ Configuration should work, but consider fixing warnings');
  process.exit(0);
} else {
  console.log('✅ CONFIGURATION LOOKS GOOD!');
  console.log('\n🚀 Next step: Test the configuration with:');
  console.log('   node scripts/test-email.js');
  process.exit(0);
}


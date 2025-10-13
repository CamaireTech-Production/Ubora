#!/usr/bin/env node

/**
 * Simple backend test script
 * This will help us verify if the backend is working
 */

import https from 'https';
import http from 'http';

console.log('🔍 Testing backend endpoints...\n');

// Test HTTP endpoint
console.log('1. Testing HTTP endpoint: http://apidev.ubora-app.com/health');
const httpReq = http.request({
  hostname: 'apidev.ubora-app.com',
  port: 80,
  path: '/health',
  method: 'GET',
  timeout: 10000
}, (res) => {
  console.log(`✅ HTTP Status: ${res.statusCode}`);
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('✅ HTTP Response:', data);
  });
});

httpReq.on('error', (err) => {
  console.log('❌ HTTP Error:', err.message);
});

httpReq.on('timeout', () => {
  console.log('❌ HTTP Timeout');
  httpReq.destroy();
});

httpReq.end();

// Test HTTPS endpoint
console.log('\n2. Testing HTTPS endpoint: https://apidev.ubora-app.com/health');
const httpsReq = https.request({
  hostname: 'apidev.ubora-app.com',
  port: 443,
  path: '/health',
  method: 'GET',
  timeout: 10000
}, (res) => {
  console.log(`✅ HTTPS Status: ${res.statusCode}`);
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('✅ HTTPS Response:', data);
  });
});

httpsReq.on('error', (err) => {
  console.log('❌ HTTPS Error:', err.message);
});

httpsReq.on('timeout', () => {
  console.log('❌ HTTPS Timeout');
  httpsReq.destroy();
});

httpsReq.end();

// Test AI endpoint
setTimeout(() => {
  console.log('\n3. Testing AI endpoint: http://apidev.ubora-app.com/api/ai/health');
  const aiReq = http.request({
    hostname: 'apidev.ubora-app.com',
    port: 80,
    path: '/api/ai/health',
    method: 'GET',
    timeout: 10000
  }, (res) => {
    console.log(`✅ AI Health Status: ${res.statusCode}`);
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      console.log('✅ AI Health Response:', data);
    });
  });

  aiReq.on('error', (err) => {
    console.log('❌ AI Health Error:', err.message);
  });

  aiReq.on('timeout', () => {
    console.log('❌ AI Health Timeout');
    aiReq.destroy();
  });

  aiReq.end();
}, 2000);

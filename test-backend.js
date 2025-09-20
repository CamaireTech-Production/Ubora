// Simple test script to verify backend is working
const http = require('http');

const options = {
  hostname: 'api.ubora-app.com',
  port: 443,
  path: '/health',
  method: 'GET',
  headers: {
    'User-Agent': 'Backend-Test'
  }
};

console.log('Testing backend connection...');

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', data);
    if (res.statusCode === 200) {
      console.log('✅ Backend is working!');
    } else {
      console.log('❌ Backend returned error');
    }
  });
});

req.on('error', (error) => {
  console.log('❌ Connection failed:', error.message);
});

req.setTimeout(10000, () => {
  console.log('❌ Request timeout');
  req.destroy();
});

req.end();

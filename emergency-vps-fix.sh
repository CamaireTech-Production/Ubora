#!/bin/bash
# emergency-vps-fix.sh - Quick fix for broken Nginx SSL configurations
# Run this immediately on your VPS to fix the current deployment issue

echo "🚨 Emergency VPS SSL Fix - Starting..."
echo "====================================="

# Stop Nginx to prevent further errors
echo "🛑 Stopping Nginx..."
systemctl stop nginx

# Remove all broken SSL-enabled sites
echo "🧹 Removing broken SSL configurations..."
rm -f /etc/nginx/sites-enabled/*

# Create clean HTTP-only configurations
echo "🔧 Creating clean HTTP-only configurations..."

# Development API
cat > /etc/nginx/sites-available/apidev.ubora-app.com << 'EOF'
server {
    listen 80;
    server_name apidev.ubora-app.com;
    
    client_max_body_size 100M;
    proxy_connect_timeout 300s;
    proxy_send_timeout 300s;
    proxy_read_timeout 300s;
    send_timeout 300s;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
}
EOF

# Production API
cat > /etc/nginx/sites-available/api.ubora-app.com << 'EOF'
server {
    listen 80;
    server_name api.ubora-app.com;
    
    client_max_body_size 100M;
    proxy_connect_timeout 300s;
    proxy_send_timeout 300s;
    proxy_read_timeout 300s;
    send_timeout 300s;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
}
EOF

# Enable both sites
echo "🔗 Enabling sites..."
ln -sf /etc/nginx/sites-available/apidev.ubora-app.com /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/api.ubora-app.com /etc/nginx/sites-enabled/

# Test configuration
echo "🧪 Testing Nginx configuration..."
nginx -t || {
    echo "❌ Nginx test failed"
    exit 1
}

# Start Nginx
echo "🚀 Starting Nginx..."
systemctl start nginx

# Check backend services
echo "🔍 Checking backend services..."
pm2 list

# Test endpoints
echo "🧪 Testing endpoints..."
echo "Testing apidev.ubora-app.com..."
curl -I http://apidev.ubora-app.com/health || echo "❌ apidev.ubora-app.com failed"

echo "Testing api.ubora-app.com..."
curl -I http://api.ubora-app.com/health || echo "❌ api.ubora-app.com failed"

echo ""
echo "✅ Emergency fix completed!"
echo "====================================="
echo "📋 Next steps:"
echo "1. Push the updated deployment script to dev branch"
echo "2. The deployment should now work without SSL errors"
echo "3. SSL can be added later once HTTP is working"
echo ""
echo "🔗 Test URLs:"
echo "   http://apidev.ubora-app.com/health"
echo "   http://api.ubora-app.com/health"

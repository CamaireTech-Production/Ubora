#!/bin/bash
# fix-vps-ssl.sh - Comprehensive VPS SSL and CORS fix script
# Run this on your VPS to fix all SSL and deployment issues

echo "🔧 Starting comprehensive VPS SSL and CORS fix..."
echo "=================================================="

# Stop all services
echo "🛑 Stopping all services..."
pm2 stop ubora-backend-dev ubora-backend-prod || true
systemctl stop nginx || true

# Clean up corrupted SSL certificates
echo "🧹 Cleaning up corrupted SSL certificates..."
rm -rf /etc/letsencrypt/live/apidev.ubora-app.com
rm -rf /etc/letsencrypt/live/api.ubora-app.com

# Remove all existing Nginx configurations
echo "🧹 Cleaning up existing Nginx configurations..."
rm -f /etc/nginx/sites-enabled/*
rm -f /etc/nginx/sites-available/api*.ubora-app.com

# Create clean HTTP-only configurations
echo "🔧 Creating clean HTTP-only Nginx configurations..."

# Development API configuration
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

# Production API configuration
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

# Enable the sites
echo "🔗 Enabling Nginx sites..."
ln -sf /etc/nginx/sites-available/apidev.ubora-app.com /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/api.ubora-app.com /etc/nginx/sites-enabled/

# Test and start Nginx
echo "🧪 Testing Nginx configuration..."
nginx -t || {
    echo "❌ Nginx configuration test failed"
    exit 1
}

echo "🚀 Starting Nginx..."
systemctl start nginx
systemctl enable nginx

# Check if backend services exist and start them
echo "🔍 Checking backend services..."

# Check development backend
if [ -d "/var/www/ubora-backend-dev/current" ]; then
    echo "✅ Development backend found, starting..."
    cd /var/www/ubora-backend-dev/current
    pm2 start server/production-server.js --name ubora-backend-dev --update-env || true
else
    echo "⚠️ Development backend not found at /var/www/ubora-backend-dev/current"
fi

# Check production backend
if [ -d "/var/www/ubora-backend-prod/current" ]; then
    echo "✅ Production backend found, starting..."
    cd /var/www/ubora-backend-prod/current
    pm2 start server/production-server.js --name ubora-backend-prod --update-env || true
else
    echo "⚠️ Production backend not found at /var/www/ubora-backend-prod/current"
fi

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 5

# Test HTTP endpoints
echo "🧪 Testing HTTP endpoints..."
echo "Testing apidev.ubora-app.com..."
curl -I http://apidev.ubora-app.com/health || echo "❌ apidev.ubora-app.com failed"

echo "Testing api.ubora-app.com..."
curl -I http://api.ubora-app.com/health || echo "❌ api.ubora-app.com failed"

# Show PM2 status
echo "📊 PM2 Status:"
pm2 list

# Show Nginx status
echo "📊 Nginx Status:"
systemctl status nginx --no-pager -l

echo ""
echo "✅ VPS fix completed!"
echo "=================================================="
echo "📋 Next steps:"
echo "1. Test your frontend applications"
echo "2. If HTTP works, run SSL setup:"
echo "   certbot --nginx -d apidev.ubora-app.com"
echo "   certbot --nginx -d api.ubora-app.com"
echo "3. Deploy with the updated GitHub Actions scripts"
echo ""
echo "🔗 Test URLs:"
echo "   http://apidev.ubora-app.com/health"
echo "   http://api.ubora-app.com/health"

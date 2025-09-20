#!/bin/bash

echo "🔧 Fixing VPS Backend Configuration..."

# Update system
apt update

# Install Node.js 20 (newer version)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install PM2 globally
npm install -g pm2

# Install Nginx
apt install -y nginx

# Install UFW firewall
apt install -y ufw

# Configure firewall
ufw enable
ufw allow ssh
ufw allow 80
ufw allow 443
ufw allow 3000

# Create project directories
mkdir -p /var/www/ubora-backend-prod
mkdir -p /var/www/ubora-backend-dev

# Configure Nginx for HTTP (we'll add SSL later)
cat > /etc/nginx/sites-available/api.ubora-app.com << 'EOF'
server {
    listen 80;
    server_name api.ubora-app.com;
    
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
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
EOF

# Enable Nginx site
ln -sf /etc/nginx/sites-available/api.ubora-app.com /etc/nginx/sites-enabled/

# Remove default site
rm -f /etc/nginx/sites-enabled/default

# Test and restart Nginx
nginx -t
systemctl restart nginx
systemctl enable nginx

# Install Certbot for SSL
apt install -y certbot python3-certbot-nginx

echo "✅ VPS configuration completed!"
echo "📋 Next steps:"
echo "1. Run: certbot --nginx -d api.ubora-app.com"
echo "2. Deploy your backend code"
echo "3. Test the endpoints"

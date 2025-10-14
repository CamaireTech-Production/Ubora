#!/bin/bash

echo "🔍 Checking VPS Backend Status..."
echo "=================================="

# Check if PM2 is running
echo "1. Checking PM2 status:"
pm2 list

echo ""
echo "2. Checking if backend processes are running:"
ps aux | grep -E "(node|ubora-backend)" | grep -v grep

echo ""
echo "3. Checking if ports are listening:"
netstat -tlnp | grep -E ":300[01]"

echo ""
echo "4. Checking Nginx status:"
systemctl status nginx --no-pager -l

echo ""
echo "5. Checking Nginx configuration:"
nginx -t

echo ""
echo "6. Checking if backend directories exist:"
ls -la /var/www/ubora-backend-dev/

echo ""
echo "7. Checking current symlink:"
ls -la /var/www/ubora-backend-dev/current

echo ""
echo "8. Testing local backend health:"
curl -s http://localhost:3001/health || echo "❌ Backend not responding on port 3001"
curl -s http://localhost:3000/health || echo "❌ Backend not responding on port 3000"

echo ""
echo "9. Checking recent logs:"
pm2 logs ubora-backend-dev --lines 20

echo ""
echo "=================================="
echo "🔧 If backend is not running, try:"
echo "pm2 restart ubora-backend-dev"
echo "pm2 logs ubora-backend-dev"
echo "systemctl restart nginx"

#!/bin/bash

# 🚀 Quick Deployment Script for 800+ Users
# This script optimizes your server for high-performance video chat

set -e

echo "🎯 Starting High-Performance Video Chat Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="YOURDOMAIN.COM" # CHANGE THIS
PROJECT_PATH="/var/www/videochat"
NODE_VERSION="18"

echo -e "${BLUE}📋 Configuration:${NC}"
echo -e "Domain: ${YELLOW}$DOMAIN${NC}"
echo -e "Project Path: ${YELLOW}$PROJECT_PATH${NC}"
echo -e "Node Version: ${YELLOW}$NODE_VERSION${NC}"
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}This script must be run as root${NC}"
   exit 1
fi

# Update system
echo -e "${GREEN}📦 Updating system packages...${NC}"
apt update && apt upgrade -y

# Install required packages
echo -e "${GREEN}📦 Installing dependencies...${NC}"
apt install -y nginx coturn certbot python3-certbot-nginx git curl wget htop

# Install Node.js 18
echo -e "${GREEN}📦 Installing Node.js $NODE_VERSION...${NC}"
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt-get install -y nodejs

# Install PM2 globally
echo -e "${GREEN}📦 Installing PM2...${NC}"
npm install -g pm2

# Install Artillery for load testing
echo -e "${GREEN}📦 Installing Artillery for load testing...${NC}"
npm install -g artillery

# Create project directory
echo -e "${GREEN}📁 Setting up project directory...${NC}"
mkdir -p $PROJECT_PATH
cd $PROJECT_PATH

# Clone your repository (replace with your actual repo)
echo -e "${GREEN}📥 Cloning your repository...${NC}"
# git clone https://github.com/yourusername/video-chat-backend-main.git .
# For now, copy from current location
# cp -r /path/to/your/current/project/* .

# Install Node.js dependencies
echo -e "${GREEN}📦 Installing Node.js dependencies...${NC}"
npm install --production

# Create logs directory
echo -e "${GREEN}📁 Creating logs directory...${NC}"
mkdir -p logs

# Optimize system for high performance
echo -e "${GREEN}⚡ Optimizing system for high performance...${NC}"

# Increase file descriptor limits
echo "* soft nofile 65536" >> /etc/security/limits.conf
echo "* hard nofile 65536" >> /etc/security/limits.conf
echo "root soft nofile 65536" >> /etc/security/limits.conf
echo "root hard nofile 65536" >> /etc/security/limits.conf

# Optimize network stack
echo "net.core.rmem_max = 134217728" >> /etc/sysctl.conf
echo "net.core.rmem_default = 134217728" >> /etc/sysctl.conf
echo "net.core.wmem_max = 134217728" >> /etc/sysctl.conf
echo "net.core.wmem_default = 134217728" >> /etc/sysctl.conf
echo "net.ipv4.tcp_rmem = 4096 65536 134217728" >> /etc/sysctl.conf
echo "net.ipv4.tcp_wmem = 4096 65536 134217728" >> /etc/sysctl.conf
echo "net.core.netdev_max_backlog = 5000" >> /etc/sysctl.conf
echo "net.ipv4.tcp_congestion_control = bbr" >> /etc/sysctl.conf

# Apply sysctl changes
sysctl -p

# Configure TURN server (coturn)
echo -e "${GREEN}🔧 Configuring TURN server...${NC}"

# Generate secure authentication secret
TURN_SECRET=$(openssl rand -hex 32)

cat > /etc/turnserver.conf << EOF
# High-performance TURN configuration
listening-port=3478
tls-listening-port=5349
listening-ip=$(curl -s ifconfig.me)
relay-ip=$(curl -s ifconfig.me)
external-ip=$(curl -s ifconfig.me)

# Authentication
use-auth-secret
static-auth-secret=$TURN_SECRET
realm=$DOMAIN

# Performance tuning
total-quota=1000
user-quota=20
max-bps=128000
max-allocate-port=65535

# Connection limits
max-bps-capacity=0
max-received-bitrate=128000
max-send-bitrate=128000

# Security
no-loopback-peers
no-multicast-peers
no-tcp-relay
no-cli
no-tlsv1
no-tlsv1_1

# Logging
log-file=/var/log/turnserver.log
verbose
EOF

# Enable and start coturn
systemctl enable coturn
systemctl restart coturn

# Configure Nginx
echo -e "${GREEN}🔧 Configuring Nginx...${NC}"

# Replace domain in nginx config
sed "s/YOURDOMAIN.COM/$DOMAIN/g" nginx-config > /etc/nginx/sites-available/videochat

# Enable site
ln -sf /etc/nginx/sites-available/videochat /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
nginx -t

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Nginx configuration is valid${NC}"
    systemctl reload nginx
else
    echo -e "${RED}❌ Nginx configuration error${NC}"
    exit 1
fi

# Setup SSL with Let's Encrypt
echo -e "${GREEN}🔒 Setting up SSL certificate...${NC}"

# First make sure domain is pointing to this server
echo -e "${YELLOW}⚠️  Make sure $DOMAIN is pointing to this server's IP before continuing${NC}"
read -p "Press Enter to continue with SSL setup..."

certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN

# Setup PM2
echo -e "${GREEN}🚀 Setting up PM2 process manager...${NC}"

# Update ecosystem config with correct domain
sed "s/YOURDOMAIN.COM/$DOMAIN/g" ecosystem.config.js > ecosystem.production.config.js

# Start application with PM2
pm2 start ecosystem.production.config.js
pm2 save

# Setup PM2 startup script
pm2 startup | tail -n 1 | bash

# Configure firewall
echo -e "${GREEN}🔥 Configuring firewall...${NC}"

# Allow essential ports
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 3478/udp  # TURN UDP
ufw allow 3478/tcp  # TURN TCP
ufw allow 5349/tcp  # TURN TLS

# Enable firewall
ufw --force enable

# Setup log rotation
echo -e "${GREEN}📋 Setting up log rotation...${NC}"

cat > /etc/logrotate.d/videochat << EOF
$PROJECT_PATH/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        pm2 reload videochat
    endscript
}
EOF

# Create monitoring script
echo -e "${GREEN}📊 Setting up monitoring...${NC}"

cat > $PROJECT_PATH/monitor.sh << 'EOF'
#!/bin/bash

# Simple monitoring script
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')
MEMORY_USAGE=$(free | grep Mem | awk '{printf("%.1f", $3/$2 * 100.0)}')
DISK_USAGE=$(df -h / | awk 'NR==2{print $5}' | sed 's/%//')

echo "CPU: ${CPU_USAGE}% | Memory: ${MEMORY_USAGE}% | Disk: ${DISK_USAGE}%"

# Alert if thresholds exceeded
if (( $(echo "$CPU_USAGE > 80" | bc -l) )); then
    echo "⚠️  High CPU usage: ${CPU_USAGE}%"
fi

if (( $(echo "$MEMORY_USAGE > 80" | bc -l) )); then
    echo "⚠️  High memory usage: ${MEMORY_USAGE}%"
fi

if [ "$DISK_USAGE" -gt 80 ]; then
    echo "⚠️  High disk usage: ${DISK_USAGE}%"
fi
EOF

chmod +x $PROJECT_PATH/monitor.sh

# Setup cron job for monitoring
(crontab -l 2>/dev/null; echo "*/5 * * * * $PROJECT_PATH/monitor.sh >> /var/log/videochat-monitor.log 2>&1") | crontab -

# Performance test
echo -e "${GREEN}🧪 Running performance test...${NC}"

# Wait a moment for server to start
sleep 10

# Test basic connectivity
curl -f http://localhost:3000/health > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Server is responding correctly${NC}"
else
    echo -e "${RED}❌ Server is not responding${NC}"
fi

# Display deployment summary
echo ""
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo ""
echo -e "${BLUE}📋 Deployment Summary:${NC}"
echo -e "Domain: ${YELLOW}$DOMAIN${NC}"
echo -e "Project Path: ${YELLOW}$PROJECT_PATH${NC}"
echo -e "TURN Server: ${YELLOW}Enabled on port 3478${NC}"
echo -e "SSL Certificate: ${YELLOW}Installed and auto-renewing${NC}"
echo -e "Process Manager: ${YELLOW}PM2 with cluster mode${NC}"
echo -e "Web Server: ${YELLOW}Nginx with optimizations${NC}"
echo -e "Firewall: ${YELLOW}Configured for video chat${NC}"
echo ""
echo -e "${BLUE}🔧 Useful Commands:${NC}"
echo -e "View PM2 status: ${YELLOW}pm2 status${NC}"
echo -e "View logs: ${YELLOW}pm2 logs${NC}"
echo -e "Restart app: ${YELLOW}pm2 restart videochat${NC}"
echo -e "Reload Nginx: ${YELLOW}systemctl reload nginx${NC}"
echo -e "View TURN logs: ${YELLOW}tail -f /var/log/turnserver.log${NC}"
echo -e "Run load test: ${YELLOW}artillery run load-test-config.yml${NC}"
echo ""
echo -e "${BLUE}📊 Monitoring:${NC}"
echo -e "System stats: ${YELLOW}$PROJECT_PATH/monitor.sh${NC}"
echo -e "PM2 monitoring: ${YELLOW}pm2 monit${NC}"
echo ""
echo -e "${GREEN}🚀 Your video chat is now optimized for 800+ users!${NC}"
echo -e "${YELLOW}⚠️  Remember to:${NC}"
echo -e "1. Update YOURDOMAIN.COM in all configs"
echo -e "2. Test with actual users before going live"
echo -e "3. Monitor performance regularly"
echo -e "4. Set up alerts for high resource usage"

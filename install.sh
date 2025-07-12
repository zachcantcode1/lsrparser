#!/bin/bash

# LSR Parser - Linux Installation Script
# This script automates the installation process on Linux

set -e

echo "🚀 LSR Parser Linux Installation Script"
echo "======================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Installing Node.js..."
    
    # Detect OS
    if [ -f /etc/debian_version ]; then
        # Ubuntu/Debian
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    elif [ -f /etc/redhat-release ]; then
        # CentOS/RHEL/Fedora
        curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
        sudo dnf install -y nodejs npm
    else
        echo "❌ Unsupported OS. Please install Node.js manually."
        exit 1
    fi
else
    echo "✅ Node.js found: $(node --version)"
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install npm."
    exit 1
else
    echo "✅ npm found: $(npm --version)"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Install PM2 globally if not present
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2 process manager..."
    sudo npm install -g pm2
else
    echo "✅ PM2 found: $(pm2 --version)"
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "⚙️ Creating environment configuration..."
    cp .env.example .env
    echo "✅ Created .env file. You can modify it if needed."
fi

# Test the application
echo "🧪 Testing the application..."
timeout 10s npm start &
APP_PID=$!
sleep 5

if curl -s http://localhost:3000/health > /dev/null; then
    echo "✅ Application test successful!"
    kill $APP_PID 2>/dev/null || true
else
    echo "❌ Application test failed!"
    kill $APP_PID 2>/dev/null || true
    exit 1
fi

# Setup firewall (optional)
read -p "🔥 Do you want to open port 3000 in the firewall? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if command -v ufw &> /dev/null; then
        sudo ufw allow 3000
        echo "✅ Port 3000 opened in UFW firewall"
    elif command -v firewall-cmd &> /dev/null; then
        sudo firewall-cmd --permanent --add-port=3000/tcp
        sudo firewall-cmd --reload
        echo "✅ Port 3000 opened in firewalld"
    else
        echo "⚠️ No firewall manager detected. You may need to open port 3000 manually."
    fi
fi

echo ""
echo "🎉 Installation completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Start the application:"
echo "   npm run pm2                    # Start with PM2 (recommended)"
echo "   # OR"
echo "   npm start                      # Direct start"
echo ""
echo "2. Setup auto-start (optional):"
echo "   pm2 save"
echo "   pm2 startup"
echo ""
echo "3. OBS Studio URLs:"
echo "   http://$(hostname -I | awk '{print $1}'):3000/ticker    # News ticker"
echo "   http://$(hostname -I | awk '{print $1}'):3000/compact   # Compact view"
echo "   http://$(hostname -I | awk '{print $1}'):3000           # Full view"
echo ""
echo "4. Check status:"
echo "   pm2 status"
echo "   pm2 logs lsrparser"
echo ""
echo "📖 For more details, see DEPLOYMENT.md"

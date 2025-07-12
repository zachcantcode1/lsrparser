# Linux Server Deployment Guide

## Prerequisites

### 1. Install Node.js on Linux
```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS/RHEL/Fedora
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo dnf install -y nodejs npm
```

### 2. Install PM2 (Process Manager)
```bash
sudo npm install -g pm2
```

## Deployment Steps

### 1. Clone and Setup
```bash
# Clone your repository
git clone https://github.com/yourusername/lsrparser.git
cd lsrparser

# Install dependencies
npm install
```

### 2. Environment Configuration
```bash
# Create production environment file
cp .env.example .env

# Edit configuration (optional)
nano .env
```

### 3. Start the Application

#### Option A: Direct Start (for testing)
```bash
npm start
```

#### Option B: PM2 (recommended for production)
```bash
# Start with PM2
npm run pm2

# Check status
pm2 status

# View logs
pm2 logs lsrparser

# Stop the application
npm run pm2:stop

# Restart the application
npm run pm2:restart
```

### 4. Configure Firewall
```bash
# Ubuntu/Debian (ufw)
sudo ufw allow 3000

# CentOS/RHEL (firewalld)
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

### 5. Setup Auto-Start (PM2)
```bash
# Save PM2 configuration
pm2 save

# Generate startup script
pm2 startup

# Follow the instructions provided by PM2
```

### 6. Reverse Proxy (Optional - Nginx)
```bash
# Install Nginx
sudo apt-get install nginx  # Ubuntu/Debian
sudo dnf install nginx      # CentOS/RHEL/Fedora

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/lsrparser
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;  # Replace with your domain

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
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/lsrparser /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## OBS Studio URLs

Once deployed, use these URLs in OBS Studio:

- **News Ticker**: `http://your-server-ip:3000/ticker`
- **Compact View**: `http://your-server-ip:3000/compact`
- **Full View**: `http://your-server-ip:3000`

If using Nginx reverse proxy:
- **News Ticker**: `http://your-domain.com/ticker`
- **Compact View**: `http://your-domain.com/compact`
- **Full View**: `http://your-domain.com`

## Troubleshooting

### Check if service is running
```bash
pm2 status
# or
sudo netstat -tlnp | grep :3000
```

### Check logs
```bash
pm2 logs lsrparser
# or if running directly
tail -f /var/log/lsrparser.log
```

### Test the API
```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/data
```

### Common Issues

1. **Port already in use**: Change the PORT in .env file
2. **Permission denied**: Run with sudo or change to port > 1024
3. **Cannot connect**: Check firewall settings
4. **Module not found**: Run `npm install` again

## Environment Variables

Create a `.env` file with:
```bash
PORT=3000
API_URL=https://mesonet.agron.iastate.edu/geojson/lsr.geojson?hours=1
REFRESH_INTERVAL=60
```

## Security Considerations

1. **Firewall**: Only open necessary ports
2. **Updates**: Keep Node.js and dependencies updated
3. **SSL**: Use HTTPS in production with Let's Encrypt
4. **User**: Run the application as a non-root user

## Maintenance

### Update the application
```bash
git pull origin main
npm install
npm run pm2:restart
```

### Monitor performance
```bash
pm2 monit
```

### Backup configuration
```bash
cp .env .env.backup
pm2 save
```

# JSON Parser for OBS Studio

A Node.js application that fetches JSON data from HTTP endpoints, parses specific information, and serves it as formatted HTML text for OBS Studio browser sources. Specifically designed for Local Storm Reports (LSR) data from Iowa State Mesonet.

## 🚀 Quick Start

### Windows (Development)
```bash
npm install
npm start
```

### Linux (Production Server)
```bash
chmod +x install.sh
./install.sh
```

## 📺 OBS Studio Integration

Add these URLs as Browser Sources in OBS Studio:

| View Type | URL | Recommended Size | Use Case |
|-----------|-----|------------------|----------|
| **News Ticker** | `http://localhost:3000/ticker` | 1920x60 | Bottom-of-screen scrolling ticker |
| **Compact View** | `http://localhost:3000/compact` | 600x400 | Corner widget/overlay |
| **Full Detail** | `http://localhost:3000` | 1920x1080 | Main content area |

## ✨ Features

- 🔄 **Auto-refresh**: Updates every 60 seconds
- 🎨 **OBS-ready**: Transparent backgrounds, optimized styling
- ⚙️ **Configurable**: Easy URL and parsing customization
- 🌐 **REST API**: JSON endpoints for data access
- 🔍 **Error handling**: Graceful error messages
- 📱 **Responsive**: Multiple display formats
- 🌪️ **Weather-focused**: Optimized for storm report data

## 🌦️ Current Data Source

**Iowa State Mesonet Local Storm Reports (LSR)**
- URL: `https://mesonet.agron.iastate.edu/geojson/lsr.geojson?hours=1`
- Updates: Real-time storm reports from the last hour
- Data types: Rain, snow, hail, wind, tornadoes, etc.
- Coverage: United States

## 🛠️ Configuration

### Change Data Source
```bash
curl "http://localhost:3000/config?url=YOUR_JSON_URL"
```

### Environment Variables
Create a `.env` file:
```env
PORT=3000
API_URL=https://mesonet.agron.iastate.edu/geojson/lsr.geojson?hours=1
REFRESH_INTERVAL=60
```

### Custom Data Parsing
Edit the `parseData` function in `config.js` to handle your JSON structure.

## 📊 API Endpoints

- `GET /` - Main HTML display for OBS Studio
- `GET /ticker` - Scrolling news ticker format
- `GET /compact` - Compact widget format
- `GET /api/data` - JSON API endpoint
- `GET /config` - View/update configuration
- `GET /health` - Health check

## 🔧 Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev  # Uses nodemon for auto-restart

# Start production server
npm start
```

## 🐧 Linux Production Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed Linux server setup instructions.

### Quick Linux Install
```bash
git clone https://github.com/yourusername/lsrparser.git
cd lsrparser
chmod +x install.sh
./install.sh
```

### Production Management (PM2)
```bash
npm run pm2          # Start with PM2
pm2 status           # Check status
pm2 logs lsrparser   # View logs
npm run pm2:restart  # Restart
npm run pm2:stop     # Stop
```

## 🎯 Example Use Cases

1. **Weather Streaming**: Live storm reports during weather events
2. **News Broadcasting**: Breaking weather alerts ticker
3. **Emergency Management**: Real-time hazard monitoring
4. **Storm Chasing**: Live report feeds during chase streams
5. **Local Weather**: Regional weather monitoring overlay

## 🔧 Customization

### Different Weather APIs
- **OpenWeatherMap**: Current conditions, forecasts
- **NWS API**: National Weather Service data
- **WeatherAPI**: Commercial weather data
- **NOAA**: Government weather services

### Other Data Sources
- **Social Media**: Twitter/X feeds, Reddit posts
- **Gaming**: Twitch stats, Steam data
- **Crypto**: Price feeds, market data
- **Sports**: Live scores, statistics
- **News**: RSS feeds, breaking news

## 📋 Requirements

- **Node.js**: 14.0.0 or higher
- **npm**: 6.0.0 or higher
- **Network**: Internet connection for data fetching

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

ISC License - See LICENSE file for details

## 🆘 Support

- Check [DEPLOYMENT.md](DEPLOYMENT.md) for Linux setup
- Review the troubleshooting section
- Open an issue for bugs or feature requests

---

**Made for streamers, by streamers** 🎮📺

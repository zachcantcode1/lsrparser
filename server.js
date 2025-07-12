const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const config = require('./config');

const app = express();
const PORT = config.port;

// Enable CORS for all routes
app.use(cors());

// Serve static files
app.use(express.static('public'));

// Configuration - now loaded from config.js
const serverConfig = {
    // Default URL to fetch JSON from
    apiUrl: config.apiUrl,
    
    // Refresh interval in seconds
    refreshInterval: config.refreshInterval,
    
    // Function to parse JSON and extract the data you want
    parseData: config.parseData
};

// Helper function to generate ticker content
function generateTickerContent(data) {
    if (data.startsWith('Error:')) {
        return `<div class="ticker-item"><span class="ticker-label">⚠️ ERROR</span>${data}</div>`;
    }
    
    if (data.includes('No recent storm reports')) {
        return `<div class="ticker-item"><span class="ticker-label">🌤️ WEATHER</span>No storm reports in the last 2 hours - All quiet!</div>`;
    }
    
    const lines = data.split('\n');
    let tickerItems = [];
    
    // Extract actual report lines (those with measurements and locations)
    const reportLines = lines.filter(line => {
        const trimmed = line.trim();
        return trimmed.length > 0 && 
               (trimmed.includes('inch') || trimmed.includes('Inch') || 
                trimmed.includes('mph') || trimmed.includes('MPH') ||
                trimmed.includes('°F') || trimmed.includes('degrees') ||
                trimmed.includes('tornado') || trimmed.includes('TORNADO') ||
                trimmed.includes('hail') || trimmed.includes('HAIL')) &&
               trimmed.includes(' - ') && // Must have location separator
               !trimmed.includes('REPORTS BY STATE') &&
               !trimmed.includes('Total Reports');
    });
    
    // Process each report line to create ticker items
    reportLines.forEach(line => {
        const cleanLine = line.trim().replace(/^\s+/, '');
        if (cleanLine.length > 10) {
            // Parse the report to extract components
            const parts = cleanLine.split(' - ');
            if (parts.length >= 2) {
                const measurement = parts[0]; // e.g., "1.6Inch"
                const locationAndTime = parts[1]; // e.g., "5 NW Industry, IL (09:29 AM)"
                
                // Extract location (everything before the parentheses)
                const locationMatch = locationAndTime.match(/^(.+?)\s*\(/);
                const location = locationMatch ? locationMatch[1] : locationAndTime;
                
                // Extract time
                const timeMatch = locationAndTime.match(/\(([^)]+)\)/);
                const time = timeMatch ? timeMatch[1] : '';
                
                // Determine weather type and severity
                let weatherType = '🌧️';
                let severity = '';
                let isSignificant = false;
                
                if (measurement.toLowerCase().includes('tornado')) {
                    weatherType = '🌪️';
                    severity = 'TORNADO';
                    isSignificant = true;
                } else if (measurement.toLowerCase().includes('hail')) {
                    weatherType = '🧊';
                    severity = 'HAIL';
                    const size = parseFloat(measurement);
                    isSignificant = size >= 1.0;
                } else if (measurement.toLowerCase().includes('mph')) {
                    weatherType = '💨';
                    severity = 'WIND';
                    const speed = parseFloat(measurement);
                    isSignificant = speed >= 60;
                } else if (measurement.toLowerCase().includes('inch')) {
                    weatherType = '🌧️';
                    severity = 'RAIN';
                    const amount = parseFloat(measurement);
                    isSignificant = amount >= 1.0;
                }
                
                // Format the ticker item
                const className = isSignificant ? 'ticker-item breaking' : 'ticker-item';
                const label = `${weatherType} ${severity}`;
                const timeStr = time ? ` at ${time}` : '';
                
                tickerItems.push(`<div class="${className}"><span class="ticker-label">${label}</span>${measurement} reported in ${location}${timeStr}</div>`);
            }
        }
    });
    
    // If no reports found, show a summary message
    if (tickerItems.length === 0) {
        const totalLine = lines.find(line => line.includes('Total Reports:'));
        if (totalLine) {
            const total = totalLine.match(/\d+/)?.[0] || '0';
            tickerItems.push(`<div class="ticker-item"><span class="ticker-label">🌪️ WEATHER</span>${total} storm reports in the last 2 hours</div>`);
        }
    }
    
    return tickerItems.join('');
}

// Helper function to generate compact content
function generateCompactContent(data) {
    if (data.startsWith('Error:')) {
        return `<div class="header">⚠️ Weather Data Error</div><div class="summary">${data}</div>`;
    }
    
    if (data.includes('No recent storm reports')) {
        return `<div class="header">🌤️ Weather Status</div><div class="summary">All Quiet - No Storm Reports</div>`;
    }
    
    const lines = data.split('\n');
    let content = '';
    
    // Header
    content += '<div class="header">🌪️ Storm Reports</div>';
    
    // Summary
    const totalLine = lines.find(line => line.includes('Total Reports:'));
    if (totalLine) {
        const total = totalLine.match(/\d+/)[0];
        content += `<div class="summary">${total} reports in the last 2 hours</div>`;
    }
    
    // State breakdown
    const stateStart = lines.findIndex(line => line.includes('REPORTS BY STATE:'));
    if (stateStart > -1) {
        content += '<div class="reports">';
        for (let i = stateStart + 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line === '' || line.includes('🌧️') || line.includes('❄️') || line.includes('🌪️')) break;
            if (line.includes(':')) {
                content += `<div class="report-line">📍 ${line.replace(/^\s+/, '')}</div>`;
            }
        }
        
        // Top reports
        const reportLines = lines.filter(line => 
            line.includes('inch') || line.includes('Inch') && line.trim().length > 10
        );
        
        reportLines.slice(0, 3).forEach(line => {
            const cleanLine = line.trim().replace(/^\s+/, '');
            if (cleanLine.length > 10) {
                content += `<div class="report-line">🌧️ ${cleanLine}</div>`;
            }
        });
        
        content += '</div>';
    }
    
    return content;
}

// Store the latest parsed data
let latestData = 'Loading...';
let lastUpdated = new Date();

// Function to fetch and parse data
async function fetchAndParseData() {
    try {
        console.log(`Fetching data from: ${serverConfig.apiUrl}`);
        const response = await axios.get(serverConfig.apiUrl, {
            timeout: 10000, // 10 second timeout
            headers: {
                'User-Agent': 'OBS-JSON-Parser/1.0'
            }
        });
        
        const parsedData = serverConfig.parseData(response.data);
        latestData = parsedData;
        lastUpdated = new Date();
        
        console.log('Data updated successfully');
        console.log('Parsed data preview:', parsedData.substring(0, 200) + '...');
        
    } catch (error) {
        console.error('Error fetching data:', error.message);
        latestData = `Error: ${error.message}`;
        lastUpdated = new Date();
    }
}

// API endpoint to get the latest data as JSON
app.get('/api/data', (req, res) => {
    res.json({
        data: latestData,
        lastUpdated: lastUpdated.toISOString(),
        status: 'ok'
    });
});

// Main endpoint for OBS Studio browser source
app.get('/', (req, res) => {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>JSON Data Display</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            background: transparent;
            color: #ffffff;
            margin: 0;
            padding: 20px;
            font-size: 24px;
            line-height: 1.6;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .data-content {
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .last-updated {
            font-size: 16px;
            color: #cccccc;
            margin-top: 20px;
            font-style: italic;
        }
        .error {
            color: #ff6b6b;
        }
    </style>
    <script>
        // Auto-refresh every 30 seconds
        setInterval(() => {
            location.reload();
        }, 30000);
    </script>
</head>
<body>
    <div class="container">
        <div class="data-content ${latestData.startsWith('Error:') ? 'error' : ''}">${latestData.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        <div class="last-updated">Last updated: ${lastUpdated.toLocaleString('en-US', { 
            timeZone: 'America/Chicago',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        })}</div>
    </div>
</body>
</html>`;
    
    res.send(html);
});

// Ticker endpoint for scrolling news ticker
app.get('/ticker', (req, res) => {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Weather Ticker</title>
    <style>
        body {
            font-family: 'Arial Black', Arial, sans-serif;
            background: transparent;
            color: #ffffff;
            margin: 0;
            padding: 0;
            overflow: hidden;
            font-size: 28px;
            font-weight: bold;
            text-shadow: 3px 3px 6px rgba(0,0,0,0.9);
            transform: translateZ(0);
            backface-visibility: hidden;
            perspective: 1000px;
        }
        .ticker-container {
            width: 100%;
            height: 60px;
            background: transparent;
            border-top: 3px solid rgba(255,255,255,0.8);
            border-bottom: 3px solid rgba(255,255,255,0.8);
            display: flex;
            align-items: center;
            position: relative;
            overflow: hidden;
            transform: translateZ(0);
            will-change: contents;
        }
        .ticker-static-label {
            background: rgba(220,20,60,0.9);
            color: #ffffff;
            padding: 0 20px;
            height: 100%;
            display: flex;
            align-items: center;
            font-size: 24px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
            border-right: 3px solid rgba(255,255,255,0.8);
            flex-shrink: 0;
            z-index: 10;
        }
        .ticker-scroll-area {
            flex: 1;
            overflow: hidden;
            position: relative;
        }
        .ticker-content {
            white-space: nowrap;
            animation: scroll 90s linear infinite;
            padding-left: 100%;
            display: flex;
            align-items: center;
            will-change: transform;
            transform: translateZ(0);
        }
        .ticker-item {
            margin-right: 80px;
            display: inline-flex;
            align-items: center;
            backface-visibility: hidden;
            transform: translateZ(0);
        }
        .ticker-label {
            background: rgba(30,144,255,0.8);
            padding: 4px 12px;
            border-radius: 20px;
            margin-right: 15px;
            font-size: 24px;
            font-weight: bold;
            border: 1px solid rgba(255,255,255,0.5);
            transform: translateZ(0);
        }
        @keyframes scroll {
            0% { transform: translate3d(0, 0, 0); }
            100% { transform: translate3d(-100%, 0, 0); }
        }
        .breaking {
            color: #ffffff;
        }
    </style>
    <script>
        // Auto-refresh every 60 seconds
        setInterval(() => {
            location.reload();
        }, 60000);
    </script>
</head>
<body>
    <div class="ticker-container">
        <div class="ticker-content">
            ${generateTickerContent(latestData)}
        </div>
    </div>
</body>
</html>`;
    
    res.send(html);
});

// Compact endpoint for smaller display
app.get('/compact', (req, res) => {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Weather Compact</title>
    <style>
        html {
            background: transparent !important;
        }
        body {
            font-family: 'Arial', sans-serif;
            background: transparent !important;
            color: #ffffff;
            margin: 0;
            padding: 20px;
            font-size: 20px;
            line-height: 1.4;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
            border-radius: 10px;
            /* OBS text clarity optimizations */
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: optimizeLegibility;
            font-smooth: always;
            -webkit-transform: translateZ(0);
            transform: translateZ(0);
            will-change: transform;
        }
        .compact-container {
            max-width: 600px;
            background: transparent !important;
            border: 2px solid rgba(30,144,255,0.6);
            border-radius: 10px;
            padding: 15px;
            /* Removed backdrop-filter for OBS compatibility */
            /* Additional text clarity for container */
            -webkit-transform: translateZ(0);
            transform: translateZ(0);
        }
        .header {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
            text-align: center;
            color: #87CEEB;
            /* Enhanced text clarity for headers */
            -webkit-font-smoothing: antialiased;
            text-rendering: optimizeLegibility;
        }
        .summary {
            font-size: 18px;
            margin-bottom: 15px;
            text-align: center;
        }
        .reports {
            font-size: 16px;
        }
        .report-line {
            margin: 8px 0;
            padding: 5px 0;
            border-bottom: 1px solid rgba(255,255,255,0.2);
        }
        .last-updated {
            font-size: 14px;
            color: #cccccc;
            text-align: center;
            margin-top: 15px;
            font-style: italic;
        }
    </style>
    <script>
        // Auto-refresh every 60 seconds
        setInterval(() => {
            location.reload();
        }, 60000);
    </script>
</head>
<body>
    <div class="compact-container">
        ${generateCompactContent(latestData)}
        <div class="last-updated">Updated: ${lastUpdated.toLocaleTimeString('en-US', { 
            timeZone: 'America/Chicago',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        })}</div>
    </div>
</body>
</html>`;
    
    res.send(html);
});

// Endpoint to update configuration
app.get('/config', (req, res) => {
    const { url } = req.query;
    
    if (url) {
        serverConfig.apiUrl = url;
        console.log(`Updated API URL to: ${url}`);
        fetchAndParseData(); // Fetch immediately with new URL
        res.json({ message: 'URL updated successfully', newUrl: url });
    } else {
        res.json({ 
            message: 'Current configuration',
            apiUrl: serverConfig.apiUrl,
            refreshInterval: serverConfig.refreshInterval
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        uptime: process.uptime(),
        lastUpdated: lastUpdated.toISOString()
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`🚀 JSON Parser server running on http://localhost:${PORT}`);
    console.log(`📺 Use this URL in OBS Studio: http://localhost:${PORT}`);
    console.log(`⚙️  Change API URL: http://localhost:${PORT}/config?url=YOUR_JSON_URL`);
    console.log(`📊 API endpoint: http://localhost:${PORT}/api/data`);
    
    // Fetch initial data
    fetchAndParseData();
    
    // Set up periodic data fetching
    setInterval(fetchAndParseData, serverConfig.refreshInterval * 1000);
});

module.exports = app;

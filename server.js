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
    
    // Process the data to extract weather type and individual reports
    let currentWeatherType = '';
    let currentEmoji = '🌧️';
    
    lines.forEach((line, index) => {
        const trimmed = line.trim();
        
        // Check if this is a weather type header (like "🌩️ FLASH FLOOD (2):")
        if (trimmed.includes('FLASH FLOOD') || trimmed.includes('RAIN') || trimmed.includes('SNOW') || 
            trimmed.includes('HAIL') || trimmed.includes('TORNADO') || trimmed.includes('WIND')) {
            
            if (trimmed.includes('FLASH FLOOD')) {
                currentEmoji = '🌩️';
                currentWeatherType = 'FLASH FLOOD';
            } else if (trimmed.includes('TORNADO')) {
                currentEmoji = '🌪️';
                currentWeatherType = 'TORNADO';
            } else if (trimmed.includes('HAIL')) {
                currentEmoji = '🧊';
                currentWeatherType = 'HAIL';
            } else if (trimmed.includes('RAIN')) {
                currentEmoji = '🌧️';
                currentWeatherType = 'RAIN';
            } else if (trimmed.includes('WIND')) {
                currentEmoji = '💨';
                currentWeatherType = 'WIND';
            } else if (trimmed.includes('SNOW')) {
                currentEmoji = '❄️';
                currentWeatherType = 'SNOW';
            }
            
            return;
        }
        
        // Check if this is an individual report line (starts with spaces and has location + time)
        if (trimmed.length > 0 && 
            trimmed.includes(', ') && 
            trimmed.includes('(') && 
            trimmed.includes(':') &&
            !trimmed.includes('REPORTS BY STATE') &&
            !trimmed.includes('Total Reports') &&
            !trimmed.includes('🌪️ STORM REPORTS') &&
            !trimmed.startsWith('📍')) {
            
            // For Flash Flood reports, look for the remark text after " - "
            let location = '';
            let time = '';
            let remarkText = '';
            let source = '';
            
            if (currentWeatherType === 'FLASH FLOOD' && trimmed.includes(' - ')) {
                // Parse Flash Flood format: "City, County, State (time) - remark [source]"
                const dashIndex = trimmed.indexOf(' - ');
                const locationAndTime = trimmed.substring(0, dashIndex);
                remarkText = trimmed.substring(dashIndex + 3); // Skip " - "
                
                // Extract time from locationAndTime
                const timeMatch = locationAndTime.match(/\(([^)]+)\)/);
                time = timeMatch ? timeMatch[1] : '';
                
                // Extract location (everything before the time parentheses)
                location = locationAndTime.replace(/\s*\([^)]+\)/, '').trim();
                
                // Extract source from remark if available
                const sourceMatch = remarkText.match(/\[([^\]]+)\]$/);
                if (sourceMatch) {
                    source = sourceMatch[1];
                    remarkText = remarkText.replace(/\s*\[([^\]]+)\]$/, ''); // Remove source from remark
                }
            } else {
                // Parse regular format: "measurement - location (time) [source]"
                const locationMatch = trimmed.match(/^(.+?)\s*\(/);
                location = locationMatch ? locationMatch[1] : trimmed;
                
                const timeMatch = trimmed.match(/\(([^)]+)\)/);
                time = timeMatch ? timeMatch[1] : '';
                
                const sourceMatch = trimmed.match(/\[([^\]]+)\]/);
                source = sourceMatch ? sourceMatch[1] : '';
            }
            
            // Determine if this is significant
            let isSignificant = false;
            if (currentWeatherType.includes('TORNADO') || 
                currentWeatherType.includes('FLASH FLOOD') ||
                currentWeatherType.includes('FLOOD')) {
                isSignificant = true;
            }
            
            // Format the ticker item
            const className = isSignificant ? 'ticker-item breaking' : 'ticker-item';
            const label = `${currentEmoji} ${currentWeatherType}`;
            const timeStr = time ? ` at ${time.replace(' AM', 'AM').replace(' PM', 'PM')}` : '';
            const sourceStr = source ? ` [${source}]` : '';
            
            let tickerItem = '';
            if (currentWeatherType === 'FLASH FLOOD') {
                if (remarkText) {
                    // For Flash Floods with remarks, show location, then remark with time and source
                    tickerItem = `<div class="${className}"><span class="ticker-label">${label}</span>${location}: ${remarkText}${timeStr}${sourceStr}</div>`;
                } else {
                    // For Flash Floods without remarks, show standard format
                    tickerItem = `<div class="${className}"><span class="ticker-label">${label}</span>Reported in ${location}${timeStr}${sourceStr}</div>`;
                }
            } else {
                // For other weather types, use standard format
                tickerItem = `<div class="${className}"><span class="ticker-label">${label}</span>Reported in ${location}${timeStr}${sourceStr}</div>`;
            }
            
            tickerItems.push(tickerItem);
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
        
        // First, collect state information
        const states = [];
        for (let i = stateStart + 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line === '' || line.includes('🌧️') || line.includes('❄️') || line.includes('🌪️') || line.includes('🌩️')) {
                break;
            }
            if (line.includes(':')) {
                const stateName = line.split(':')[0].trim();
                states.push(stateName);
                content += `<div class="report-line">📍 ${line.replace(/^\s+/, '')}</div>`;
            }
        }
        
        // Then, collect and display weather types for each state
        const weatherTypes = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            // Look for weather type headers like "🌩️ FLASH FLOOD (5):"
            if ((line.includes('🌩️') || line.includes('🌧️') || line.includes('❄️') || line.includes('🌪️') || line.includes('💨') || line.includes('🧊')) && line.includes('(') && line.includes('):')) {
                weatherTypes.push(line.replace(':', ''));
            }
        }
        
        // Display weather types indented under states (assuming single state for now)
        weatherTypes.forEach(weatherType => {
            content += `<div class="report-line weather-type">    ${weatherType}</div>`;
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

// Raw API data endpoint for debugging
app.get('/api/raw', async (req, res) => {
    try {
        const response = await axios.get(serverConfig.apiUrl, serverConfig.requestOptions);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
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
            animation: scroll 60s linear infinite;
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
        .weather-type {
            font-size: 14px;
            margin-left: 20px;
            color: #cccccc;
            border-bottom: 1px solid rgba(255,255,255,0.1);
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

// Helper function to generate dashboard content
function generateDashboardContent(data) {
    if (data.startsWith('Error:')) {
        return `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number">⚠️</div>
                    <div class="stat-label">Error Loading Data</div>
                </div>
            </div>
            <div class="reports-section">
                <div class="section-title">Error Details</div>
                <div class="no-reports">${data}</div>
            </div>
        `;
    }
    
    if (data.includes('No recent storm reports')) {
        return `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number">0</div>
                    <div class="stat-label">Total Reports</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">🌤️</div>
                    <div class="stat-label">All Quiet</div>
                </div>
            </div>
            <div class="reports-section">
                <div class="section-title">Storm Reports</div>
                <div class="no-reports">No storm reports in the last 2 hours. Weather conditions are calm.</div>
            </div>
        `;
    }
    
    const lines = data.split('\n');
    let content = '';
    
    // Extract statistics
    const totalReportsLine = lines.find(line => line.includes('Total Reports:'));
    const totalReports = totalReportsLine ? totalReportsLine.match(/\d+/)?.[0] || '0' : '0';
    
    // Extract state information
    const stateStart = lines.findIndex(line => line.includes('REPORTS BY STATE:'));
    const states = [];
    if (stateStart > -1) {
        for (let i = stateStart + 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line === '' || line.includes('🌧️') || line.includes('❄️') || line.includes('🌪️') || line.includes('🌩️')) break;
            if (line.includes(':')) {
                const parts = line.split(':');
                const state = parts[0].trim();
                const count = parts[1].trim().replace(' reports', '').replace(' report', '');
                states.push({ state, count });
            }
        }
    }
    
    // Extract weather types and their reports
    const weatherSections = [];
    let currentSection = null;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Check for weather type headers
        if ((line.includes('🌩️') || line.includes('🌧️') || line.includes('❄️') || line.includes('🌪️') || line.includes('💨') || line.includes('🧊')) && line.includes('(') && line.includes('):')) {
            if (currentSection) {
                weatherSections.push(currentSection);
            }
            currentSection = {
                type: line.replace(':', ''),
                reports: []
            };
        } else if (currentSection && line.length > 0 && 
                   !line.includes('REPORTS BY STATE') && 
                   !line.includes('Total Reports') && 
                   !line.includes('🌪️ STORM REPORTS') &&
                   !line.startsWith('📍') &&
                   line.includes(',') && line.includes('(')) {
            // This is a report line
            currentSection.reports.push(line);
        }
    }
    
    if (currentSection) {
        weatherSections.push(currentSection);
    }
    
    // Generate stats grid
    content += `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number">${totalReports}</div>
                <div class="stat-label">Total Reports</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${states.length}</div>
                <div class="stat-label">States Affected</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${weatherSections.length}</div>
                <div class="stat-label">Weather Types</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">2h</div>
                <div class="stat-label">Time Window</div>
            </div>
        </div>
    `;
    
    // Generate detailed reports section
    content += '<div class="reports-section">';
    content += '<div class="section-title">Detailed Storm Reports</div>';
    
    if (weatherSections.length === 0) {
        content += '<div class="no-reports">No detailed reports available.</div>';
    } else {
        weatherSections.forEach(section => {
            content += `<div class="weather-type-section">`;
            content += `<div class="weather-type-header">${section.type}</div>`;
            
            if (section.reports.length === 0) {
                content += '<div class="no-reports">No detailed reports for this type.</div>';
            } else {
                section.reports.forEach(report => {
                    content += formatReportForDashboard(report);
                });
            }
            
            content += '</div>';
        });
    }
    
    content += '</div>';
    
    return content;
}

// Helper function to format individual reports for dashboard
function formatReportForDashboard(report) {
    // Parse the report line
    let location = '';
    let time = '';
    let details = '';
    let source = '';
    
    // Extract source if available
    const sourceMatch = report.match(/\[([^\]]+)\]$/);
    if (sourceMatch) {
        source = sourceMatch[1];
        report = report.replace(/\s*\[([^\]]+)\]$/, '');
    }
    
    // Extract time
    const timeMatch = report.match(/\(([^)]+)\)/);
    if (timeMatch) {
        time = timeMatch[1];
        report = report.replace(/\s*\([^)]+\)/, '');
    }
    
    // Check for remark format (location - details)
    if (report.includes(' - ')) {
        const dashIndex = report.indexOf(' - ');
        location = report.substring(0, dashIndex).trim();
        details = report.substring(dashIndex + 3).trim();
    } else {
        // Try to split on the first location-like pattern
        const parts = report.split(',');
        if (parts.length >= 3) {
            location = parts.slice(0, 3).join(',').trim();
            details = parts.slice(3).join(',').trim();
        } else {
            location = report.trim();
            details = '';
        }
    }
    
    return `
        <div class="report-item">
            <div class="report-location">${location}</div>
            <div class="report-time">📅 ${time}</div>
            ${details ? `<div class="report-details">${details}</div>` : ''}
            ${source ? `<div class="report-source">Source: ${source}</div>` : ''}
        </div>
    `;
}

// Dashboard endpoint for comprehensive storm reports view
app.get('/dashboard', (req, res) => {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Storm Reports Dashboard</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            color: #ffffff;
            margin: 0;
            padding: 20px;
            min-height: 100vh;
            line-height: 1.6;
        }
        .dashboard-container {
            max-width: 1400px;
            margin: 0 auto;
        }
        .dashboard-header {
            text-align: center;
            margin-bottom: 30px;
            padding: 20px;
            background: rgba(255,255,255,0.1);
            border-radius: 15px;
            backdrop-filter: blur(10px);
        }
        .dashboard-title {
            font-size: 48px;
            font-weight: bold;
            margin: 0;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
        }
        .dashboard-subtitle {
            font-size: 20px;
            margin: 10px 0 0 0;
            color: #b8d4f0;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: rgba(255,255,255,0.15);
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
        }
        .stat-number {
            font-size: 36px;
            font-weight: bold;
            color: #87CEEB;
        }
        .stat-label {
            font-size: 16px;
            color: #b8d4f0;
            margin-top: 5px;
        }
        .reports-section {
            background: rgba(255,255,255,0.1);
            border-radius: 15px;
            padding: 25px;
            backdrop-filter: blur(10px);
        }
        .section-title {
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 20px;
            color: #87CEEB;
            border-bottom: 2px solid rgba(135,206,235,0.3);
            padding-bottom: 10px;
        }
        .weather-type-section {
            margin-bottom: 30px;
        }
        .weather-type-header {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 15px;
            padding: 10px 15px;
            background: rgba(30,144,255,0.2);
            border-radius: 8px;
            border-left: 4px solid #1E90FF;
        }
        .report-item {
            background: rgba(255,255,255,0.05);
            margin: 10px 0;
            padding: 15px;
            border-radius: 8px;
            border-left: 3px solid #87CEEB;
            transition: background 0.3s ease;
        }
        .report-item:hover {
            background: rgba(255,255,255,0.1);
        }
        .report-location {
            font-size: 18px;
            font-weight: bold;
            color: #87CEEB;
            margin-bottom: 5px;
        }
        .report-time {
            font-size: 14px;
            color: #b8d4f0;
            margin-bottom: 8px;
        }
        .report-details {
            font-size: 16px;
            margin-bottom: 8px;
        }
        .report-source {
            font-size: 14px;
            color: #cccccc;
            font-style: italic;
        }
        .no-reports {
            text-align: center;
            font-size: 18px;
            color: #b8d4f0;
            padding: 40px;
        }
        .last-updated {
            text-align: center;
            margin-top: 20px;
            font-size: 14px;
            color: #b8d4f0;
            font-style: italic;
        }
        .refresh-btn {
            background: #1E90FF;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            margin: 10px;
        }
        .refresh-btn:hover {
            background: #0066cc;
        }
    </style>
    <script>
        // Auto-refresh every 60 seconds
        setInterval(() => {
            location.reload();
        }, 60000);
        
        function refreshNow() {
            location.reload();
        }
    </script>
</head>
<body>
    <div class="dashboard-container">
        <div class="dashboard-header">
            <div class="dashboard-title">🌪️ Storm Reports Dashboard</div>
            <div class="dashboard-subtitle">Local Storm Reports - Last 2 Hours</div>
            <button class="refresh-btn" onclick="refreshNow()">🔄 Refresh Now</button>
        </div>
        
        ${generateDashboardContent(latestData)}
        
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
    console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
    
    // Fetch initial data
    fetchAndParseData();
    
    // Set up periodic data fetching
    setInterval(fetchAndParseData, serverConfig.refreshInterval * 1000);
});

module.exports = app;

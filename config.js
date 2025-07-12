// Helper function to get weather emojis
function getWeatherEmoji(type) {
    const emojiMap = {
        'RAIN': '🌧️',
        'SNOW': '❄️',
        'HAIL': '🧊',
        'TORNADO': '🌪️',
        'WIND': '💨',
        'LIGHTNING': '⚡',
        'FLOOD': '🌊',
        'THUNDERSTORM': '⛈️',
        'FUNNEL': '🌪️',
        'FREEZING RAIN': '🧊',
        'SLEET': '🌨️',
        'BLIZZARD': '❄️',
        'DUST': '🌪️',
        'FOG': '🌫️'
    };
    
    return emojiMap[type.toUpperCase()] || '🌩️';
}

const config = {
    // The URL to fetch JSON data from - Iowa State Mesonet Local Storm Reports
    apiUrl: process.env.API_URL || 'https://mesonet.agron.iastate.edu/geojson/lsr.geojson?hours=2',
    
    // How often to refresh the data (in seconds)
    refreshInterval: parseInt(process.env.REFRESH_INTERVAL) || 60, // Increased to 60 seconds for weather data
    
    // Server port
    port: parseInt(process.env.PORT) || 3000,
    
    // Custom parsing function for Local Storm Reports (LSR) data
    parseData: (jsonData) => {
        // Check if this is LSR GeoJSON data
        if (jsonData.type === 'FeatureCollection' && jsonData.features) {
            const features = jsonData.features;
            
            if (features.length === 0) {
                return 'No recent storm reports in the past 2 hours.';
            }
            
            // Group reports by type
            const reportsByType = {};
            const reportsByState = {};
            let totalReports = features.length;
            
            features.forEach(feature => {
                const props = feature.properties;
                const type = props.typetext || props.type || 'UNKNOWN';
                const state = props.state || props.st || 'Unknown';
                
                if (!reportsByType[type]) reportsByType[type] = [];
                if (!reportsByState[state]) reportsByState[state] = 0;
                
                reportsByType[type].push({
                    city: props.city,
                    magnitude: props.magnitude,
                    unit: props.unit,
                    time: props.valid,
                    state: state,
                    remark: props.remark,
                    source: props.source,
                    county: props.county
                });
                
                reportsByState[state]++;
            });
            
            // Build the display text
            let displayText = `🌪️ STORM REPORTS - Last 2 Hours\n`;
            displayText += `Total Reports: ${totalReports}\n\n`;
            
            // Show reports by state
            displayText += `📍 REPORTS BY STATE:\n`;
            Object.entries(reportsByState)
                .sort(([,a], [,b]) => b - a)
                .forEach(([state, count]) => {
                    displayText += `   ${state}: ${count} report${count > 1 ? 's' : ''}\n`;
                });
            displayText += '\n';
            
            // Show detailed reports by type
            Object.entries(reportsByType)
                .sort(([,a], [,b]) => b.length - a.length)
                .forEach(([type, reports]) => {
                    displayText += `${getWeatherEmoji(type)} ${type} (${reports.length}):\n`;
                    
                    // Show all reports of this type, sorted by magnitude
                    reports
                        .sort((a, b) => parseFloat(b.magnitude) - parseFloat(a.magnitude))
                        .forEach(report => {
                            const time = new Date(report.time).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                                timeZone: 'America/Chicago'
                            });
                            
                            // Format location info
                            let location = report.city;
                            if (report.county && !report.city.includes(report.county)) {
                                location += `, ${report.county} County`;
                            }
                            location += `, ${report.state}`;
                            
                            displayText += `   ${report.magnitude}${report.unit} - ${location} (${time})`;
                            
                            // Add source if notable
                            if (report.source && report.source !== 'Mesonet' && report.source !== 'ASOS') {
                                displayText += ` [${report.source}]`;
                            }
                            
                            displayText += '\n';
                            
                            // Add remark if available and meaningful
                            if (report.remark && 
                                report.remark.length < 80 && 
                                !report.remark.includes('24-hour') &&
                                report.remark.toLowerCase() !== 'null') {
                                displayText += `     ${report.remark}\n`;
                            }
                        });
                    displayText += '\n';
                });
            
            return displayText.trim();
        }
        
        // Fallback for other JSON formats
        return JSON.stringify(jsonData, null, 2);
    },
    
    // HTTP request options
    requestOptions: {
        timeout: 10000, // 10 seconds
        headers: {
            'User-Agent': 'OBS-JSON-Parser/1.0',
            'Accept': 'application/json'
        }
    }
};

module.exports = config;
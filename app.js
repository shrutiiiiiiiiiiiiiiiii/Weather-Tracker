/**
 * Aether V2 - Atmospheric Weather Intelligence (Multi-Location)
 */

const elements = {
    cityInput: document.getElementById('city-input'),
    searchBtn: document.getElementById('search-btn'),
    locateBtn: document.getElementById('locate-btn'),
    unitC: document.getElementById('unit-c'),
    unitF: document.getElementById('unit-f'),
    refreshBtn: document.getElementById('refresh-btn'),
    weatherDashboard: document.getElementById('weather-dashboard'),
    detailedView: document.getElementById('detailed-view'),
    closeDetail: document.getElementById('close-detail'),
    weatherSection: document.getElementById('weather-section'),
    cityName: document.getElementById('city-name'),
    currentTemp: document.getElementById('current-temp'),
    weatherDesc: document.getElementById('weather-desc'),
    humidity: document.getElementById('humidity'),
    windSpeed: document.getElementById('wind-speed'),
    feelsLike: document.getElementById('feels-like'),
    visibility: document.getElementById('visibility'),
    forecastGrid: document.getElementById('forecast-grid'),
    aqiCard: document.getElementById('aqi-card'),
    aqiValue: document.getElementById('aqi-value'),
    aqiStatus: document.getElementById('aqi-status'),
    hourlyChart: document.getElementById('hourly-chart'),
    canvas: document.getElementById('atmospheric-fx')
};

let currentUnit = 'celsius';
let savedLocations = [];
let syncVersion = 0; // Prevent race conditions in async rendering

// V2 Theme System
const themes = {
    clear: { base: '#005bea', colors: ['#00c6fb', '#005bea', '#89f7fe'], fx: 'stars' },
    cloudy: { base: '#2c3e50', colors: ['#30e8bf', '#ff8235', '#2c3e50'], fx: 'none' },
    rainy: { base: '#1e3c72', colors: ['#4facfe', '#00f2fe', '#005bea'], fx: 'rain' },
    snowy: { base: '#374151', colors: ['#e6e9f0', '#eef1f5', '#89f7fe'], fx: 'snow' },
    night: { base: '#020617', colors: ['#0f172a', '#1e3c72', '#2a5298'], fx: 'stars' }
};

const weatherCodeMap = {
    0: { desc: 'Serene Clear Sky', icon: 'sun', theme: 'clear' },
    1: { desc: 'Mainly Clear', icon: 'cloud-sun', theme: 'clear' },
    2: { desc: 'Partly Cloudy', icon: 'cloud-sun', theme: 'cloudy' },
    3: { desc: 'Overcast Skies', icon: 'cloud', theme: 'cloudy' },
    45: { desc: 'Deep Fog', icon: 'cloud-fog', theme: 'cloudy' },
    51: { desc: 'Gentle Drizzle', icon: 'cloud-drizzle', theme: 'rainy' },
    61: { desc: 'Rain showers', icon: 'cloud-rain', theme: 'rainy' },
    63: { desc: 'Steady Rainfall', icon: 'cloud-rain', theme: 'rainy' },
    65: { desc: 'Heavy Downpour', icon: 'cloud-rain', theme: 'rainy' },
    71: { desc: 'Light Snowfall', icon: 'cloud-snow', theme: 'snowy' },
    73: { desc: 'Moderate Snow', icon: 'cloud-snow', theme: 'snowy' },
    80: { desc: 'Passing Showers', icon: 'cloud-rain', theme: 'rainy' },
    95: { desc: 'Thunderstorm', icon: 'cloud-lightning', theme: 'rainy' }
};

/**
 * Atmospheric VFX Canvas Class
 */
class AtmosphericFX {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.type = 'none';
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.animate();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    setType(type) {
        if (this.type === type) return;
        this.type = type;
        this.particles = [];
        const count = type === 'rain' ? 100 : type === 'snow' ? 150 : type === 'stars' ? 200 : 0;
        
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                speed: Math.random() * 5 + 2,
                size: Math.random() * 2 + 1,
                opacity: Math.random()
            });
        }
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (this.type === 'rain') {
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            this.ctx.lineWidth = 1;
            this.particles.forEach(p => {
                this.ctx.beginPath();
                this.ctx.moveTo(p.x, p.y);
                this.ctx.lineTo(p.x, p.y + 10);
                this.ctx.stroke();
                p.y += p.speed;
                if (p.y > this.canvas.height) p.y = -10;
            });
        } else if (this.type === 'snow') {
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            this.particles.forEach(p => {
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                this.ctx.fill();
                p.y += p.speed * 0.3;
                p.x += Math.sin(p.y / 30) * 0.5;
                if (p.y > this.canvas.height) p.y = -10;
            });
        } else if (this.type === 'stars') {
            this.particles.forEach(p => {
                const opacity = (Math.sin(Date.now() / 1000 + p.x) + 1) / 2;
                this.ctx.fillStyle = `rgba(255, 255, 255, ${opacity * p.opacity})`;
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
                this.ctx.fill();
            });
        }
        
        requestAnimationFrame(() => this.animate());
    }
}

const vfx = new AtmosphericFX(elements.canvas);

/**
 * Fetch Data Logic
 */
async function getCoordinates(city) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}&limit=1`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.length > 0) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), name: data[0].display_name.split(',')[0] };
    throw new Error('Atmospheric coordinates not found');
}

async function getWeatherData(lat, lon) {
    const unit = currentUnit === 'fahrenheit' ? '&temperature_unit=fahrenheit' : '';
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,visibility&daily=weather_code,temperature_2m_max,temperature_2m_min&hourly=temperature_2m&timezone=auto${unit}`;
    const response = await fetch(url);
    return await response.json();
}

async function getAQIData(lat, lon) {
    try {
        const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_epa_index`;
        const resp = await fetch(url);
        return await resp.json();
    } catch (e) { return null; }
}

function updateAQIUI(aqi) {
    if (aqi === null) {
        elements.aqiStatus.textContent = 'Unavailable';
        return;
    }
    
    elements.aqiValue.textContent = aqi;
    let status = "Good";
    let className = "aqi-good";
    if (aqi > 50) { status = "Moderate"; className = "aqi-fair"; }
    if (aqi > 100) { status = "Unhealthy (SG)"; className = "aqi-moderate"; }
    if (aqi > 150) { status = "Unhealthy"; className = "aqi-poor"; }
    if (aqi > 200) { status = "Very Unhealthy"; className = "aqi-very-poor"; }
    
    elements.aqiCard.className = `detail-item glass aq-monitor ${className}`;
    elements.aqiStatus.textContent = status;
}

function drawTrendChart(hourlyData) {
    const temps = hourlyData.temperature_2m.slice(0, 24);
    const times = hourlyData.time.slice(0, 24);
    
    const minTemp = Math.min(...temps);
    const maxTemp = Math.max(...temps);
    const range = maxTemp - minTemp || 1;
    
    const width = 800;
    const height = 150;
    const padding = 40;
    
    let points = "";
    let labelsHtml = "";
    
    temps.forEach((temp, i) => {
        const x = (i / 23) * (width - 2 * padding) + padding;
        const y = height - (((temp - minTemp) / range) * (height - 2 * padding) + padding);
        points += (i === 0 ? "" : "L ") + `${x},${y} `;
        
        if (i % 6 === 0) {
            const timeLabel = new Date(times[i]).getHours() + ":00";
            labelsHtml += `<text x="${x}" y="${height - 5}" class="chart-label-text" text-anchor="middle">${timeLabel}</text>`;
            labelsHtml += `<text x="${x}" y="${y - 12}" class="chart-temp-text" text-anchor="middle">${Math.round(temp)}°</text>`;
        }
    });

    const pathLine = elements.hourlyChart.querySelector('.chart-line');
    const pathArea = elements.hourlyChart.querySelector('.chart-area');
    
    pathLine.setAttribute('d', `M ${points}`);
    const areaD = `M ${padding},${height} L ${points} L ${width - padding},${height} Z`;
    pathArea.setAttribute('d', areaD);
    
    elements.hourlyChart.querySelector('.chart-labels').innerHTML = labelsHtml;
}



function updateGlobalTheme(weather, themeKey) {
    const info = weatherCodeMap[weather.current.weather_code] || { theme: 'clear' };
    let key = themeKey || info.theme;
    if (weather.current.is_day === 0 && key === 'clear') key = 'night';
    const theme = themes[key];
    
    document.documentElement.style.setProperty('--bg-base', theme.base);
    document.documentElement.style.setProperty('--gradient-1', theme.colors[0]);
    document.documentElement.style.setProperty('--gradient-2', theme.colors[1]);
    document.documentElement.style.setProperty('--gradient-3', theme.colors[2]);
    
    vfx.setType(theme.fx);
}

function showDetailedView(data, aqiData, name) {
    const current = data.current;
    const info = weatherCodeMap[current.weather_code] || { desc: 'Unknown', theme: 'clear' };
    
    elements.cityName.textContent = name;
    elements.currentTemp.textContent = Math.round(current.temperature_2m);
    elements.weatherDesc.textContent = info.desc;
    elements.humidity.textContent = `${current.relative_humidity_2m}%`;
    elements.windSpeed.textContent = `${current.wind_speed_10m} km/h`;
    elements.feelsLike.textContent = `${Math.round(current.apparent_temperature)}°`;
    elements.visibility.textContent = `${(current.visibility / 1000).toFixed(1)} km`;

    updateGlobalTheme(data);

    // Update Forecast
    elements.forecastGrid.innerHTML = '';
    data.daily.time.forEach((t, i) => {
        if (i === 0) return;
        const day = new Date(t).toLocaleDateString('en-US', { weekday: 'short' });
        const fcCode = data.daily.weather_code[i];
        const fcIcon = (weatherCodeMap[fcCode] || { icon: 'cloud' }).icon;
        
        elements.forecastGrid.innerHTML += `
            <div class="forecast-item glass">
                <span class="forecast-day">${day}</span>
                <i data-lucide="${fcIcon}"></i>
                <span class="forecast-temp">${Math.round(data.daily.temperature_2m_max[i])}°</span>
            </div>
        `;
    });

    if (aqiData) updateAQIUI(aqiData.current.us_epa_index);
    if (data.hourly) drawTrendChart(data.hourly);

    lucide.createIcons();
    elements.detailedView.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

async function renderDashboard() {
    const version = ++syncVersion; // Capture current version
    elements.weatherDashboard.innerHTML = '';
    
    if (savedLocations.length === 0) {
        if (version !== syncVersion) return;
        elements.weatherDashboard.innerHTML = `
            <div class="loading-state glass">
                <p>No locations saved. Search a city to get started!</p>
            </div>
        `;
        return;
    }

    const fetches = savedLocations.map(loc => 
        Promise.all([getWeatherData(loc.lat, loc.lon), getAQIData(loc.lat, loc.lon)])
    );

    try {
        const results = await Promise.all(fetches);
        if (version !== syncVersion) return; // Discard if a newer search started
        
        elements.weatherDashboard.innerHTML = ''; // Final clear before render
        
        results.forEach(([weather, aqi], index) => {
            const loc = savedLocations[index];
            const info = weatherCodeMap[weather.current.weather_code] || { desc: 'Unknown', icon: 'cloud' };
            const card = document.createElement('div');
            card.className = 'weather-card-mini glass';
            card.innerHTML = `
                <button class="card-remove-btn" data-index="${index}" title="Remove Location">
                    <i data-lucide="trash-2"></i>
                </button>
                <div class="mini-location">${loc.name}</div>
                <div class="mini-temp-box">
                    <span class="mini-temp">${Math.round(weather.current.temperature_2m)}</span>
                    <span class="mini-unit">°${currentUnit === 'celsius' ? 'C' : 'F'}</span>
                </div>
                <div class="mini-desc">${info.desc}</div>
                <i data-lucide="${info.icon}"></i>
            `;
            
            card.addEventListener('click', (e) => {
                if (e.target.closest('.card-remove-btn')) return;
                showDetailedView(weather, aqi, loc.name);
            });

            card.addEventListener('mouseenter', () => {
                updateGlobalTheme(weather);
            });
            
            elements.weatherDashboard.appendChild(card);
        });

        if (results.length > 0) {
            updateGlobalTheme(results[0][0]);
        } else {
            // Default theme for empty state (night/clear)
            document.documentElement.style.setProperty('--bg-base', themes.night.base);
            document.documentElement.style.setProperty('--gradient-1', themes.night.colors[0]);
            document.documentElement.style.setProperty('--gradient-2', themes.night.colors[1]);
            document.documentElement.style.setProperty('--gradient-3', themes.night.colors[2]);
            vfx.setType(themes.night.fx);
        }
        
        lucide.createIcons();
        updateLastUpdated();
    } catch (e) {
        if (version !== syncVersion) return;
        console.error(e);
        elements.weatherDashboard.innerHTML = `<div class="loading-state glass"><p>Error fetching atmosphere data.</p></div>`;
    }
}

async function setLocations(query) {
    elements.weatherDashboard.innerHTML = `<div class="loading-state glass"><p>Syncing atmospheres...</p></div>`;
    elements.cityInput.value = ''; // Clear input immediately for better UX
    
    // Split by commas and clean up
    const cities = query.split(',').map(c => c.trim()).filter(c => c !== "");
    
    try {
        const newLocations = [];
        for (const city of cities) {
            try {
                const coords = await getCoordinates(city);
                newLocations.push(coords);
            } catch (err) {
                console.warn(`Could not find coordinates for: ${city}`);
            }
        }
        
        if (newLocations.length === 0) {
            throw new Error('No valid atmospheric coordinates found');
        }
        
        savedLocations = newLocations;
        await renderDashboard();
    } catch (e) { 
        alert(e.message);
        renderDashboard(); // Restore previous or empty state
    }
}

function removeLocation(index) {
    savedLocations.splice(index, 1);
    renderDashboard();
}

function updateLastUpdated() {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const statusEl = document.getElementById('update-status');
    if (statusEl) {
        statusEl.textContent = `Atmosphere synced at ${timeString}`;
    }
}

// Event Listeners
elements.refreshBtn.addEventListener('click', async () => {
    elements.refreshBtn.classList.add('refreshing');
    await renderDashboard();
    setTimeout(() => {
        elements.refreshBtn.classList.remove('refreshing');
    }, 1000);
});

elements.searchBtn.addEventListener('click', async () => {
    const query = elements.cityInput.value.trim();
    if (query) setLocations(query);
});

elements.cityInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const query = elements.cityInput.value.trim();
        if (query) setLocations(query);
    }
});

elements.closeDetail.addEventListener('click', () => {
    elements.detailedView.classList.add('hidden');
    document.body.style.overflow = 'auto';
});

elements.weatherDashboard.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('.card-remove-btn');
    if (removeBtn) {
        removeLocation(parseInt(removeBtn.dataset.index));
    }
});

elements.unitC.addEventListener('click', () => {
    if (currentUnit === 'fahrenheit') {
        currentUnit = 'celsius';
        elements.unitC.classList.add('active');
        elements.unitF.classList.remove('active');
        renderDashboard();
    }
});

elements.unitF.addEventListener('click', () => {
    if (currentUnit === 'celsius') {
        currentUnit = 'fahrenheit';
        elements.unitF.classList.add('active');
        elements.unitC.classList.remove('active');
        renderDashboard();
    }
});

elements.locateBtn.addEventListener('click', () => {
    navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
        const data = await resp.json();
        const name = data.address.city || data.address.town || data.address.village || 'Current Location';
        await setLocations(name);
    });
});

document.querySelectorAll('.city-pill').forEach(pill => {
    pill.addEventListener('click', () => {
        const city = pill.dataset.city;
        if (city) setLocations(city);
    });
});

// Parallax
document.addEventListener('mousemove', (e) => {
    const x = (e.clientX - window.innerWidth / 2) / 60;
    const y = (e.clientY - window.innerHeight / 2) / 60;
    const layer = document.getElementById('mesh-layer');
    if (layer) layer.style.transform = `translate(${x}px, ${y}px)`;
});

// Init
renderDashboard();

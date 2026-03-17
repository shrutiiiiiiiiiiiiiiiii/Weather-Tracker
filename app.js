/**
 * Aether V2 - Atmospheric Weather Intelligence
 */

const elements = {
    cityInput: document.getElementById('city-input'),
    searchBtn: document.getElementById('search-btn'),
    locateBtn: document.getElementById('locate-btn'),
    unitC: document.getElementById('unit-c'),
    unitF: document.getElementById('unit-f'),
    weatherSection: document.getElementById('weather-section'),
    locationName: document.getElementById('location-name'),
    temp: document.getElementById('temp'),
    weatherDesc: document.getElementById('weather-desc'),
    humidity: document.getElementById('humidity'),
    wind: document.getElementById('wind'),
    visibility: document.getElementById('visibility'),
    forecastGrid: document.getElementById('forecast-grid'),
    soundToggle: document.getElementById('sound-toggle'),
    aqiCard: document.getElementById('aqi-card'),
    aqiValue: document.getElementById('aqi-value'),
    aqiStatus: document.getElementById('aqi-status'),
    hourlyChart: document.getElementById('hourly-chart'),
    canvas: document.getElementById('atmospheric-fx')
};

let currentUnit = 'celsius';
let lastCoords = { lat: 40.7128, lon: -74.0060, name: 'New York' };

// V2 Theme System
const themes = {
    clear: { colors: ['#00c6fb', '#005bea', '#89f7fe'], fx: 'stars' },
    cloudy: { colors: ['#30e8bf', '#ff8235', '#2c3e50'], fx: 'none' },
    rainy: { colors: ['#4facfe', '#00f2fe', '#005bea'], fx: 'rain' },
    snowy: { colors: ['#e6e9f0', '#eef1f5', '#89f7fe'], fx: 'snow' },
    night: { colors: ['#0f172a', '#1e3c72', '#2a5298'], fx: 'stars' }
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
    if (data.length > 0) return { lat: data[0].lat, lon: data[0].lon, name: data[0].display_name.split(',')[0] };
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

function updateUI(data, name) {
    const current = data.current;
    const info = weatherCodeMap[current.weather_code] || { desc: 'Unknown', theme: 'clear' };
    
    // Smooth Transition Out
    elements.weatherSection.style.opacity = '0';
    elements.weatherSection.style.transform = 'translateY(10px)';

    setTimeout(() => {
        elements.cityName.textContent = name;
        elements.currentTemp.textContent = Math.round(current.temperature_2m);
        elements.weatherDesc.textContent = info.desc;
        elements.humidity.textContent = `${current.relative_humidity_2m}%`;
        elements.windSpeed.textContent = `${current.wind_speed_10m} km/h`;
        elements.feelsLike.textContent = `${Math.round(current.apparent_temperature)}°`;
        elements.visibility.textContent = `${(current.visibility / 1000).toFixed(1)} km`;

        // Update Theme
        let themeKey = info.theme;
        if (current.is_day === 0 && themeKey === 'clear') themeKey = 'night';
        const theme = themes[themeKey];
        
        document.documentElement.style.setProperty('--gradient-1', theme.colors[0]);
        document.documentElement.style.setProperty('--gradient-2', theme.colors[1]);
        document.documentElement.style.setProperty('--gradient-3', theme.colors[2]);
        
        vfx.setType(theme.fx);

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

        lucide.createIcons();
        elements.weatherSection.style.opacity = '1';
        elements.weatherSection.style.transform = 'translateY(0)';
    }, 400);
}

async function performUpdate(lat, lon, name) {
    elements.searchBtn.disabled = true;
    try {
        const [weatherData, aqiData] = await Promise.all([
            getWeatherData(lat, lon),
            getAQIData(lat, lon)
        ]);
        
        lastCoords = { lat, lon, name };
        updateUI(weatherData, name);
        
        if (aqiData) updateAQIUI(aqiData.current.us_epa_index);
        if (weatherData.hourly) drawTrendChart(weatherData.hourly);
        
    } catch (e) { alert(e.message); }
    finally { elements.searchBtn.disabled = false; }
}

// Event Listeners
elements.searchBtn.addEventListener('click', async () => {
    const city = elements.cityInput.value.trim();
    if (!city) return;
    try {
        const coords = await getCoordinates(city);
        await performUpdate(coords.lat, coords.lon, coords.name);
    } catch (e) { alert(e.message); }
});

// Sound Toggle Logic
let soundActive = false;
elements.soundToggle.addEventListener('click', () => {
    soundActive = !soundActive;
    elements.soundToggle.classList.toggle('active', soundActive);
    const icon = elements.soundToggle.querySelector('i');
    icon.setAttribute('data-lucide', soundActive ? 'volume-2' : 'volume-x');
    elements.soundToggle.title = soundActive ? 'Atmospheric Audio (On)' : 'Atmospheric Audio (Off)';
    lucide.createIcons();
});

// City Pill Listeners
document.querySelectorAll('.city-pill').forEach(pill => {
    pill.addEventListener('click', async () => {
        const city = pill.getAttribute('data-city');
        try {
            const coords = await getCoordinates(city);
            await performUpdate(coords.lat, coords.lon, coords.name);
        } catch (e) { alert(e.message); }
    });
});

elements.locateBtn.addEventListener('click', () => {
    navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
        const data = await resp.json();
        const name = data.address.city || data.address.town || data.address.village || 'Current Location';
        await performUpdate(latitude, longitude, name);
    });
});

const toggleUnit = (unit) => {
    if (currentUnit === unit) return;
    currentUnit = unit;
    elements.unitC.classList.toggle('active', unit === 'celsius');
    elements.unitF.classList.toggle('active', unit === 'fahrenheit');
    document.querySelector('.unit').textContent = unit === 'celsius' ? '°C' : '°F';
    performUpdate(lastCoords.lat, lastCoords.lon, lastCoords.name);
};

elements.unitC.addEventListener('click', () => toggleUnit('celsius'));
elements.unitF.addEventListener('click', () => toggleUnit('fahrenheit'));

// Mouse Parallax Interaction
document.addEventListener('mousemove', (e) => {
    const x = (e.clientX - window.innerWidth / 2) / 60;
    const y = (e.clientY - window.innerHeight / 2) / 60;
    if(document.getElementById('mesh-layer')) {
        document.getElementById('mesh-layer').style.transform = `translate(${x}px, ${y}px)`;
    }
});

// Initial (Prioritize Geolocation, otherwise New Delhi)
const initApp = () => {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude, longitude } = pos.coords;
                try {
                    const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                    const data = await resp.json();
                    const name = data.address.city || data.address.state || 'Current Location';
                    await performUpdate(latitude, longitude, name);
                } catch (e) {
                    performUpdate(28.6139, 77.2090, 'New Delhi');
                }
            },
            () => performUpdate(28.6139, 77.2090, 'New Delhi')
        );
    } else {
        performUpdate(28.6139, 77.2090, 'New Delhi');
    }
};

initApp();

(() => {
  'use strict';
  const { $ } = window.HomeInsights;
  const codeInfo = (code, isDay = true) => {
    if ([0,1].includes(code)) return [isDay ? '☀' : '☾','Clear']; if (code === 2) return [isDay ? '🌤' : '☾☁','Partly cloudy'];
    if (code === 3) return ['☁','Cloudy']; if ([45,48].includes(code)) return ['≋','Fog'];
    if (code >= 51 && code <= 67) return ['🌧','Rain']; if (code >= 71 && code <= 77) return ['❄','Snow'];
    if (code >= 80 && code <= 82) return ['🌦','Showers']; if (code >= 95) return ['⛈','Thunderstorm']; return ['☁','Cloudy'];
  };
  async function load() {
    try {
      const url = 'https://api.open-meteo.com/v1/forecast?latitude=-37.7667&longitude=144.9610&timezone=Australia%2FMelbourne&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day&hourly=temperature_2m,precipitation_probability,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset';
      const response = await fetch(url, { cache: 'no-store' }); if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json(), current = data.current, [icon,text] = codeInfo(current.weather_code, Boolean(current.is_day));
      $('weatherIcon').textContent = icon; $('outsideTemp').textContent = `Outside ${Math.round(current.temperature_2m)}°`; $('weatherSummary').textContent = text;
      $('weatherHeroIcon').textContent = icon; $('weatherHeroTemp').textContent = `${Math.round(current.temperature_2m)}°`; $('weatherHeroText').textContent = text;
      $('feelsLike').textContent = `${Math.round(current.apparent_temperature)}°`; $('windSpeed').textContent = `${Math.round(current.wind_speed_10m)} km/h`; $('humidity').textContent = `${current.relative_humidity_2m}%`;
      const now = Date.now(); let start = data.hourly.time.findIndex(time => new Date(time).getTime() >= now); if (start < 0) start = 0;
      $('rainChance').textContent = `${data.hourly.precipitation_probability[start] ?? 0}%`;
      $('weatherUpdated').textContent = `Updated ${new Date().toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit'})} · Brunswick`;
      $('hourlyStrip').innerHTML = '';
      for (let i = start; i < Math.min(start + 8, data.hourly.time.length); i++) {
        const date = new Date(data.hourly.time[i]), [hourIcon] = codeInfo(data.hourly.weather_code[i], Boolean(data.hourly.is_day?.[i]));
        $('hourlyStrip').insertAdjacentHTML('beforeend', `<div class="weather-hour"><b>${i===start?'Now':date.toLocaleTimeString('en-AU',{hour:'numeric'})}</b><span>${hourIcon}</span><strong>${Math.round(data.hourly.temperature_2m[i])}°</strong><small>${data.hourly.precipitation_probability[i]??0}% rain</small></div>`);
      }
      $('forecastList').innerHTML = '';
      data.daily.time.slice(0,7).forEach((time,index) => { const date = new Date(time+'T12:00:00'), [dayIcon] = codeInfo(data.daily.weather_code[index]);
        $('forecastList').insertAdjacentHTML('beforeend', `<div class="forecast-row"><b>${index===0?'Today':date.toLocaleDateString('en-AU',{weekday:'long'})}</b><span>${dayIcon}</span><small>${data.daily.precipitation_probability_max[index]??0}% rain</small><strong>${Math.round(data.daily.temperature_2m_min[index])}°–${Math.round(data.daily.temperature_2m_max[index])}°</strong></div>`); });
    } catch (error) { console.warn('Weather:', error); if ($('weatherUpdated')) $('weatherUpdated').textContent = 'Weather unavailable'; if ($('weatherSummary')) $('weatherSummary').textContent = 'Unavailable'; }
  }
  window.HomeInsightsWeather = { load, start() { load(); window.setInterval(load, 30 * 60 * 1000); } };
})();

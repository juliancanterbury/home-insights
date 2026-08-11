(() => {
  'use strict';
  const run = (name, fn) => { try { fn?.(); } catch (error) { console.error(`${name} startup:`, error); } };
  const greeting = document.getElementById('greeting'); if (greeting) { const hour = new Date().getHours(); greeting.textContent = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'; }
  run('Router', () => window.HomeInsightsRouter.start());
  run('Theme', () => window.HomeInsightsTheme.start());
  run('Costs', () => window.HomeInsightsCosts.start());
  run('Gas V2', () => window.HomeInsightsGasV2.start());
  run('Water', () => window.HomeInsightsWaterV2.start());
  run('Live energy', () => window.HomeInsightsLive.start());
  run('Electricity date', () => window.HomeInsightsElectricityDate.start());
  run('Weather', () => window.HomeInsightsWeather.start());
  run('Meters and data', () => window.HomeInsightsLocalData.start());
  run('Shared meter records', () => window.HomeInsightsCloudMeters.start());
})();

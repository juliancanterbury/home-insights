(() => {
  'use strict';
  const cfg = window.HOME_INSIGHTS_CONFIG;
  const daily = window.HOME_INSIGHTS_DAILY || [];
  const $ = id => document.getElementById(id);
  const money = value => Number.isFinite(+value) ? new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(+value) : '—';
  const number = item => item && item.available && Number.isFinite(Number(item.value)) ? Number(item.value) : null;
  const kw = value => value === null ? '-- kW' : `${Math.abs(value).toFixed(Math.abs(value) >= 10 ? 1 : 2)} kW`;
  let lastLive = null;

  function setGreeting(){
    const h = new Date().getHours();
    $('greeting').textContent = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  }

  function showPage(id){
    document.querySelectorAll('.page').forEach(page => page.classList.toggle('active', page.id === id));
    document.querySelectorAll('.bottom-nav [data-page-link]').forEach(btn => btn.classList.toggle('active', btn.dataset.pageLink === id));
    window.scrollTo({top:0,behavior:'smooth'});
  }

  document.querySelectorAll('[data-page-link]').forEach(el => el.addEventListener('click', () => showPage(el.dataset.pageLink)));
  document.querySelectorAll('[data-expand]').forEach(el => el.addEventListener('click', () => {
    const panel = $(el.dataset.expand);
    if (!panel) return;
    const open = panel.classList.toggle('open');
    if (el.classList.contains('expand-card')) el.classList.toggle('open', open);
    document.querySelectorAll('.service-detail').forEach(other => { if (other !== panel) other.classList.remove('open'); });
  }));

  function setFlow(selector, active){ document.querySelector(selector)?.classList.toggle('paused', !active); }

  function renderLive(payload, serverTime){
    const solar = number(payload.solar);
    const house = number(payload.house);
    const batteryPower = number(payload.batteryPower);
    const soc = number(payload.batterySoc);
    const gridImport = number(payload.gridImport);
    const gridExport = number(payload.gridExport);
    const importing = (gridImport || 0) > .02;
    const exporting = (gridExport || 0) > .02;
    const charging = (batteryPower || 0) > .02;
    const discharging = (batteryPower || 0) < -.02;

    $('solarNow').textContent = kw(solar);
    $('solarHeroNow').textContent = kw(solar);
    $('solarState').textContent = (solar || 0) > .02 ? 'Generating' : 'Idle';
    $('houseNow').textContent = kw(house);
    $('gridNow').textContent = kw(importing ? gridImport : exporting ? gridExport : 0);
    $('gridState').textContent = importing ? 'Importing' : exporting ? 'Exporting' : 'Idle';
    $('batterySoc').textContent = soc === null ? '--%' : `${soc.toFixed(0)}%`;
    $('batteryHeroSoc').textContent = soc === null ? '--%' : `${soc.toFixed(0)}%`;
    const batteryStatus = charging ? `Charging ${kw(batteryPower)}` : discharging ? `Discharging ${kw(batteryPower)}` : 'Idle';
    $('batteryState').textContent = batteryStatus;
    $('batteryHeroState').textContent = batteryStatus;
    const fill = soc === null ? 0 : Math.max(0,Math.min(100,soc));
    $('batteryFill').style.width = `${fill}%`;
    $('batteryHeroFill').style.width = `${fill}%`;
    $('batteryHeroKwh').textContent = soc === null ? '— kWh usable' : `${(cfg.batteryCapacityKwh * soc / 100).toFixed(1)} kWh stored`;

    setFlow('.path-solar',(solar || 0) > .02);
    setFlow('.path-grid',importing || exporting);
    setFlow('.path-battery',charging || discharging);

    const stamp = new Date(serverTime || Date.now());
    $('updatedAt').textContent = `Updated ${stamp.toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`;
    $('liveText').textContent = 'Live';
    $('livePill').className = 'live-pill live';
    lastLive = payload;
    window.HomeInsightsCharts?.addLiveSample({solar:solar||0,house:house||0,grid:importing?(gridImport||0):exporting?-(gridExport||0):0,battery:batteryPower||0,soc:soc});
  }

  function liveError(message){
    $('liveText').textContent = lastLive ? 'Last values' : 'Unavailable';
    $('livePill').className = 'live-pill error';
    $('updatedAt').textContent = lastLive ? `Live update interrupted · ${message}` : `Live connection unavailable · ${message}`;
  }

  async function poll(){
    try{
      const response = await fetch(cfg.liveApi,{cache:'no-store'});
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      if(!json.ok) throw new Error(json.error || 'Backend error');
      renderLive(json.data || {},json.serverTime);
    }catch(error){
      console.warn('Home Insights live energy:',error);
      liveError(error.message || 'Connection failed');
    }
  }

  function recordFor(date){ return daily.find(r => r.date === date); }
  function renderCosts(date){
    const r = recordFor(date);
    const electric = r?.electricityTotal;
    const gas = r?.gasTotal;
    const water = r?.waterTotal;
    const total = [electric,gas,water].every(v => Number.isFinite(+v)) ? +electric + +gas + +water : null;
    $('costElectricity').textContent = money(electric);
    $('costGas').textContent = money(gas);
    $('costWater').textContent = money(water);
    $('costTotal').textContent = money(total);
    $('homeTotalCost').textContent = money(total);
    $('electricityTotal').textContent = money(electric);
    $('electricityDetailTotal').textContent = money(electric);
    $('supplyCost').textContent = money(r?.electricitySupply);
    $('paidEnergyCost').textContent = money(r?.paidEnergyCost);
    $('freeEnergyUsed').textContent = Number.isFinite(+r?.freeImportKwh) ? `${(+r.freeImportKwh).toFixed(2)} kWh` : '— kWh';
    $('exportCredit').textContent = Number.isFinite(+r?.exportCredit) ? `−${money(Math.abs(+r.exportCredit))}` : '—';
    $('solarToday').textContent = Number.isFinite(+r?.solarKwh) ? `${(+r.solarKwh).toFixed(2)} kWh` : '—';
    $('loadToday').textContent = Number.isFinite(+r?.loadKwh) ? `${(+r.loadKwh).toFixed(2)} kWh` : '—';
    $('importToday').textContent = Number.isFinite(+r?.importKwh) ? `${(+r.importKwh).toFixed(2)} kWh` : '—';
    $('exportToday').textContent = Number.isFinite(+r?.exportKwh) ? `${(+r.exportKwh).toFixed(2)} kWh` : '—';
    $('solarHeroToday').textContent = Number.isFinite(+r?.solarKwh) ? `Today ${(+r.solarKwh).toFixed(2)} kWh` : 'Today — kWh';
  }

  function parseQuestion(question){
    const q = question.toLowerCase();
    const dateMatch = question.match(/(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/i);
    if(!dateMatch) return {error:'Please include a date, for example “7 April 2026”.'};
    const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
    const date = `${dateMatch[3]}-${String(months.indexOf(dateMatch[2].toLowerCase())+1).padStart(2,'0')}-${String(dateMatch[1]).padStart(2,'0')}`;
    const services = ['electricity','gas','water'].filter(s => q.includes(s));
    return {date,services:services.length ? services : ['electricity','gas','water']};
  }

  $('askForm').addEventListener('submit', event => {
    event.preventDefault();
    const parsed = parseQuestion($('askInput').value.trim());
    $('askAnswer').hidden = false;
    if(parsed.error){ $('askAnswer').textContent = parsed.error; return; }
    const r = recordFor(parsed.date);
    if(!r){ $('askAnswer').innerHTML = `<strong>No daily ledger yet</strong><br>The live dashboard is working, but historical electricity, gas and water costs have not yet been loaded for ${new Date(parsed.date+'T12:00:00').toLocaleDateString('en-AU',{day:'numeric',month:'long',year:'numeric'})}.`; return; }
    const labels = {electricity:'Electricity',gas:'Gas',water:'Water'};
    const values = parsed.services.map(s => ({name:labels[s],value:r[`${s}Total`]}));
    const combined = values.reduce((sum,x) => sum + (+x.value || 0),0);
    $('askAnswer').innerHTML = values.map(x => `<div><b>${x.name}</b> ${money(x.value)}</div>`).join('') + `<br><strong>Combined ${money(combined)}</strong><br><small>Gas and water are daily estimates allocated from their meter or billing intervals.</small>`;
  });

  function setTheme(theme){
    document.body.className = theme === 'minimal' ? '' : `theme-${theme}`;
    localStorage.setItem('hi-theme',theme);
    document.querySelectorAll('[data-theme]').forEach(b=>b.classList.toggle('active',b.dataset.theme===theme));
    window.HomeInsightsCharts?.renderAll();
  }
  const themeButton=$('themeButton'),themeMenu=$('themeMenu');
  themeButton?.addEventListener('click',()=>{const open=themeMenu.hidden;themeMenu.hidden=!open;themeButton.setAttribute('aria-expanded',String(open));});
  document.querySelectorAll('[data-theme]').forEach(btn=>btn.addEventListener('click',()=>{setTheme(btn.dataset.theme);themeMenu.hidden=true;themeButton.setAttribute('aria-expanded','false');}));
  document.addEventListener('click',e=>{if(!e.target.closest('.theme-picker')&&themeMenu)themeMenu.hidden=true;});
  setTheme(localStorage.getItem('hi-theme')||'minimal');

  const today = new Date().toISOString().slice(0,10);
  $('costDate').value = today;
  $('costDate').addEventListener('change',e => renderCosts(e.target.value));
  renderCosts(today);
  setGreeting();
  window.HomeInsightsCharts?.init();
  poll();
  setInterval(poll,cfg.pollMs);
})();

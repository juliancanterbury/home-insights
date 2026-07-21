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
    $('gridFlow')?.classList.toggle('reverse', exporting);
    $('batteryFlow')?.classList.toggle('reverse', charging);
    const hour = new Date().getHours();
    const freeNow = hour >= cfg.freeWindow.start && hour < cfg.freeWindow.end;
    if ($('freeBadge')) $('freeBadge').hidden = !freeNow;
    $('tariffStatus').textContent = freeNow ? 'Free electricity period active until 14:00' : 'OVO free period 11:00–14:00';

    const stamp = new Date(serverTime || Date.now());
    $('updatedAt').textContent = `Updated ${stamp.toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`;
    $('liveText').textContent = 'Live';
    $('livePill').className = 'live-pill live';
    lastLive = payload;
    const sample={time:stamp.toISOString(),solar:solar||0,house:house||0,grid:importing?(gridImport||0):exporting?-(gridExport||0):0,battery:batteryPower||0,soc:soc};
    window.HomeInsightsCharts?.addLiveSample(sample);
    window.dispatchEvent(new CustomEvent('homeinsights:live',{detail:sample}));
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

(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const weatherCode = code => {
    if ([0,1].includes(code)) return ['☀','Clear'];
    if (code === 2) return ['🌤','Partly cloudy'];
    if (code === 3) return ['☁','Cloudy'];
    if ([45,48].includes(code)) return ['≋','Fog'];
    if (code >= 51 && code <= 67) return ['🌧','Rain'];
    if (code >= 71 && code <= 77) return ['❄','Snow'];
    if (code >= 80 && code <= 82) return ['🌦','Showers'];
    if (code >= 95) return ['⛈','Thunderstorm'];
    return ['☁','Cloudy'];
  };

  async function loadWeather(){
    try{
      const url='https://api.open-meteo.com/v1/forecast?latitude=-37.7667&longitude=144.9610&timezone=Australia%2FSydney&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&hourly=temperature_2m,precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max';
      const response=await fetch(url,{cache:'no-store'});
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      const j=await response.json(), c=j.current, [icon,text]=weatherCode(c.weather_code);
      $('weatherIcon').textContent=icon; $('outsideTemp').textContent=`Outside ${Math.round(c.temperature_2m)}°`;
      $('weatherSummary').textContent=text; $('weatherHeroIcon').textContent=icon; $('weatherHeroTemp').textContent=`${Math.round(c.temperature_2m)}°`;
      $('weatherHeroText').textContent=text; $('feelsLike').textContent=`${Math.round(c.apparent_temperature)}°`;
      $('windSpeed').textContent=`${Math.round(c.wind_speed_10m)} km/h`; $('humidity').textContent=`${c.relative_humidity_2m}%`;
      const now=Date.now(); let start=j.hourly.time.findIndex(t=>new Date(t).getTime()>=now); if(start<0) start=0;
      $('rainChance').textContent=`${j.hourly.precipitation_probability[start]??0}%`;
      $('weatherUpdated').textContent=`Updated ${new Date().toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit'})} · Brunswick`;
      $('hourlyStrip').innerHTML='';
      for(let i=start;i<Math.min(start+8,j.hourly.time.length);i++){
        const d=new Date(j.hourly.time[i]), [ic]=weatherCode(j.hourly.weather_code[i]);
        $('hourlyStrip').insertAdjacentHTML('beforeend',`<div class="weather-hour"><b>${i===start?'Now':d.toLocaleTimeString('en-AU',{hour:'numeric'})}</b><span>${ic}</span><strong>${Math.round(j.hourly.temperature_2m[i])}°</strong><small>${j.hourly.precipitation_probability[i]??0}% rain</small></div>`);
      }
      $('forecastList').innerHTML='';
      j.daily.time.slice(0,7).forEach((t,i)=>{
        const d=new Date(t+'T12:00:00'), [ic]=weatherCode(j.daily.weather_code[i]);
        $('forecastList').insertAdjacentHTML('beforeend',`<div class="forecast-row"><b>${i===0?'Today':d.toLocaleDateString('en-AU',{weekday:'long'})}</b><span>${ic}</span><small>${j.daily.precipitation_probability_max[i]??0}% rain</small><strong>${Math.round(j.daily.temperature_2m_min[i])}°–${Math.round(j.daily.temperature_2m_max[i])}°</strong></div>`);
      });
    }catch(error){
      console.warn('Weather:',error); $('weatherUpdated').textContent='Weather unavailable'; $('weatherSummary').textContent='Unavailable';
    }
  }

  const meterKey='home-insights-meter-readings';
  let meterKind='gas';
  const readMeters=()=>{try{return JSON.parse(localStorage.getItem(meterKey)||'[]')}catch{return[]}};
  const writeMeters=rows=>localStorage.setItem(meterKey,JSON.stringify(rows));
  function renderMeters(){
    const rows=readMeters().sort((a,b)=>b.date.localeCompare(a.date));
    ['gas','water'].forEach(kind=>{
      const row=rows.find(r=>r.kind===kind);
      $(`${kind}LastReading`).textContent=row?row.value:'—';
      $(`${kind}LastDate`).textContent=row?new Date(row.date).toLocaleString('en-AU',{day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit'}):'No reading saved';
    });
    $('meterRecords').innerHTML=rows.length?rows.map((r,i)=>`<div class="record-row"><b>${r.kind==='gas'?'Gas':'Water'}</b><strong>${r.value}</strong><small>${new Date(r.date).toLocaleString('en-AU')}</small><button data-delete-meter="${r.id}" aria-label="Delete reading">Delete</button></div>`).join(''):'<div class="chart-empty"><div><strong>No readings yet</strong>Add a manual reading or meter photo above.</div></div>';
    document.querySelectorAll('[data-delete-meter]').forEach(btn=>btn.addEventListener('click',()=>{writeMeters(readMeters().filter(r=>r.id!==btn.dataset.deleteMeter));renderMeters();renderData();}));
  }
  document.querySelectorAll('[data-open-meter]').forEach(btn=>btn.addEventListener('click',()=>{
    meterKind=btn.dataset.openMeter; $('meterKindLabel').textContent=meterKind==='gas'?'Gas meter':'Water meter'; $('meterEntry').hidden=false;
    const now=new Date(), local=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,16); $('meterDate').value=local; $('meterValue').value=''; $('meterPreview').hidden=true; $('meterEntry').scrollIntoView({behavior:'smooth'});
  }));
  $('closeMeterEntry')?.addEventListener('click',()=>{$('meterEntry').hidden=true});
  $('meterPhoto')?.addEventListener('change',e=>{const file=e.target.files?.[0];if(!file)return;$('meterPreview').src=URL.createObjectURL(file);$('meterPreview').hidden=false;});
  $('saveMeterReading')?.addEventListener('click',()=>{
    const value=$('meterValue').value.trim(), date=$('meterDate').value;
    if(!value||!date){alert('Enter the meter reading and date.');return;}
    const rows=readMeters();rows.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),kind:meterKind,value,date:new Date(date).toISOString(),source:$('meterPhoto').files?.[0]?'photo-confirmed':'manual'});writeMeters(rows);$('meterEntry').hidden=true;renderMeters();renderData();
  });

  const liveRows=[];
  window.addEventListener('homeinsights:live',e=>{liveRows.push(e.detail);if(liveRows.length>500)liveRows.shift();if($('dataSource')?.value==='live')renderData();});
  function sourceRows(){
    const source=$('dataSource')?.value||'daily';
    if(source==='meters')return readMeters().map(r=>({date:r.date,service:r.kind,reading:r.value,source:r.source}));
    if(source==='live')return liveRows.slice().reverse();
    return (window.HOME_INSIGHTS_DAILY||[]).slice().reverse();
  }
  function renderData(){
    const q=($('dataSearch')?.value||'').toLowerCase();let rows=sourceRows();if(q)rows=rows.filter(r=>JSON.stringify(r).toLowerCase().includes(q));
    const keys=rows.length?Array.from(new Set(rows.flatMap(r=>Object.keys(r)))):[];
    $('dataHead').innerHTML=keys.length?`<tr>${keys.map(k=>`<th>${k.replaceAll('_',' ')}</th>`).join('')}</tr>`:'';
    $('dataBody').innerHTML=rows.map(r=>`<tr>${keys.map(k=>`<td>${r[k]??''}</td>`).join('')}</tr>`).join('');
    $('dataEmpty').hidden=rows.length>0;$('data-table-wrap')?.toggleAttribute('hidden',rows.length===0);
  }
  $('dataSource')?.addEventListener('change',renderData);$('dataSearch')?.addEventListener('input',renderData);
  $('downloadCsv')?.addEventListener('click',()=>{
    const rows=sourceRows();if(!rows.length){alert('There are no records to export yet.');return;}const keys=Array.from(new Set(rows.flatMap(r=>Object.keys(r))));
    const esc=v=>`"${String(v??'').replaceAll('"','""')}"`;const csv=[keys.map(esc).join(','),...rows.map(r=>keys.map(k=>esc(r[k])).join(','))].join('\n');
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=`home-insights-${$('dataSource').value}.csv`;a.click();URL.revokeObjectURL(a.href);
  });

  loadWeather();setInterval(loadWeather,30*60*1000);renderMeters();renderData();
})();

(() => {
  'use strict';
  const { $, money } = window.HomeInsights;
  const meterKey = 'home-insights-meter-readings';
  const settingsKey = 'home-insights-gas-v2-settings';
  const defaults = { mjPerUnit: 38.61, rateCents: 3.20, supplyDaily: 0.90, range: '90' };
  let settings = loadSettings();

  function loadSettings() {
    try { return { ...defaults, ...JSON.parse(localStorage.getItem(settingsKey) || '{}') }; }
    catch { return { ...defaults }; }
  }
  function saveSettings() { localStorage.setItem(settingsKey, JSON.stringify(settings)); }
  function readAll() {
    try { return JSON.parse(localStorage.getItem(meterKey) || '[]'); }
    catch { return []; }
  }
  function gasReadings() {
    return readAll().filter(row => row.kind === 'gas' && Number.isFinite(Number(row.value)) && !Number.isNaN(new Date(row.date).getTime()))
      .map(row => ({ ...row, value: Number(row.value), time: new Date(row.date) }))
      .sort((a,b) => a.time - b.time);
  }
  function intervals() {
    const rows = gasReadings(), result = [];
    for (let i = 1; i < rows.length; i++) {
      const start = rows[i-1], end = rows[i], units = end.value - start.value;
      const days = (end.time - start.time) / 86400000;
      if (!(days > 0) || units < 0) continue;
      const mj = units * settings.mjPerUnit, dailyMj = mj / days;
      result.push({ start, end, units, days, mj, dailyMj, usageCost: mj * settings.rateCents / 100, supplyCost: days * settings.supplyDaily });
    }
    return result;
  }
  const fmtDate = date => date.toLocaleDateString('en-AU', { day:'numeric', month:'short', year:'numeric' });
  const fmtShort = date => date.toLocaleDateString('en-AU', { day:'numeric', month:'short' });
  const pctText = value => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(0)}%`;

  function dailyRows() {
    const out = [], readings=gasReadings(), firstManual=readings[0]?.time;
    (window.HOME_INSIGHTS_DAILY||[]).filter(row=>Number.isFinite(Number(row.gasMJ))&&Number(row.gasMJ)>=0&&(!firstManual||new Date(row.date+'T12:00:00')<firstManual)).forEach(row=>out.push({date:new Date(row.date+'T12:00:00'),mj:Number(row.gasMJ),cost:Number(row.gasMJ)*settings.rateCents/100+settings.supplyDaily,source:'archive'}));
    intervals().forEach(interval => {
      const cursor = new Date(interval.start.time); cursor.setHours(12,0,0,0);
      const endDay = new Date(interval.end.time); endDay.setHours(12,0,0,0);
      while (cursor < endDay) {
        out.push({ date:new Date(cursor), mj:interval.dailyMj, cost:interval.dailyMj * settings.rateCents / 100 + settings.supplyDaily });
        cursor.setDate(cursor.getDate()+1);
      }
    });
    return out;
  }

  function renderSummary() {
    const rows = gasReadings(), spans = intervals(), latest = spans.at(-1), previous = spans.at(-2);
    $('gasCoverage').textContent = rows.length ? `${rows.length} manual reading${rows.length===1?'':'s'} · ${fmtDate(rows[0].time)} to ${fmtDate(rows.at(-1).time)}` : 'Add two cumulative meter readings to calculate actual usage between them.';
    if (!latest) {
      ['gasLatestDaily','gasLatestMj','gasLatestCost','gasLatestChange'].forEach(id => $(id).textContent = '—');
      $('gasLatestPeriod').textContent = rows.length === 1 ? 'Add one more reading to calculate usage' : 'Waiting for two readings';
      $('gasLatestUnits').textContent = 'between readings'; $('gasGoalPercent').textContent = '—'; $('gasGoalFill').style.width = '0%';
      $('gasGoalText').textContent = 'Your first two readings establish the baseline.';
      $('costGasCaption').textContent = rows.length ? 'One more reading needed' : 'Add a meter reading';
      return;
    }
    const totalCost = latest.usageCost + latest.supplyCost;
    $('gasLatestDaily').textContent = `${latest.dailyMj.toFixed(1)} MJ/day`;
    $('gasLatestPeriod').textContent = `${fmtDate(latest.start.time)} – ${fmtDate(latest.end.time)} · ${latest.days.toFixed(latest.days < 10 ? 1 : 0)} days`;
    $('gasLatestMj').textContent = `${latest.mj.toFixed(1)} MJ`;
    $('gasLatestUnits').textContent = `${latest.units.toFixed(3)} meter units`;
    $('gasLatestCost').textContent = money(totalCost);
    if (previous && previous.dailyMj > 0) {
      const change = (latest.dailyMj / previous.dailyMj - 1) * 100;
      $('gasLatestChange').textContent = pctText(change);
      $('gasLatestChange').className = change <= 0 ? 'gas-good' : 'gas-bad';
      $('gasChangeCaption').textContent = 'daily use vs previous period';
    } else { $('gasLatestChange').textContent = 'Baseline'; $('gasLatestChange').className = ''; }
    const baseline = spans[0].dailyMj, reduction = baseline > 0 ? (1 - latest.dailyMj / baseline) * 100 : 0;
    $('gasGoalPercent').textContent = reduction > 0 ? `${Math.min(reduction,100).toFixed(0)}%` : '0%';
    $('gasGoalFill').style.width = `${Math.max(0,Math.min(reduction,100))}%`;
    $('gasGoalText').textContent = reduction > 0 ? `Daily gas use is ${reduction.toFixed(0)}% below your first measured interval.` : reduction < 0 ? `Daily gas use is ${Math.abs(reduction).toFixed(0)}% above your first measured interval.` : 'This measured interval is your current baseline.';
    renderServiceCostForDate($('costDate')?.value);
  }

  function intervalAt(dateString) {
    if (!dateString) return intervals().at(-1);
    const time = new Date(`${dateString}T12:00:00`).getTime();
    const spans=intervals();
    return spans.find(row => time >= row.start.time.getTime() && time <= row.end.time.getTime()) || (spans.length && time>spans.at(-1).end.time.getTime()?spans.at(-1):null);
  }
  function renderServiceCostForDate(dateString) {
    const span = intervalAt(dateString); if (!span) return;
    const daily = span.dailyMj * settings.rateCents / 100 + settings.supplyDaily;
    $('costGas').textContent = money(daily); $('homeGasCost').textContent = money(daily); $('costGasCaption').textContent = `${span.dailyMj.toFixed(1)} MJ/day measured`;
    const parse=id=>Number(String($(id)?.textContent||'').replace(/[^0-9.-]/g,''));
    const electric=parse('costElectricity'),water=parse('costWater'),total=[electric,daily,water].filter(Number.isFinite).reduce((a,b)=>a+b,0);
    $('costTotal').textContent=money(total);$('homeTotalCost').textContent=money(total);
  }

  function renderReadings() {
    const rows = gasReadings().slice().reverse();
    $('gasReadingList').innerHTML = rows.length ? rows.map((row, index) => `<div class="gas-reading-row"><div><strong>${row.value.toLocaleString('en-AU',{maximumFractionDigits:4})}</strong><small>${fmtDate(row.time)} · manual${row.source==='manual-with-photo'?' + photo':''}</small></div><div><button data-gas-edit="${row.id}">Edit</button><button data-gas-delete="${row.id}">Delete</button></div></div>`).join('') : '<div class="gas-empty"><strong>No gas readings yet</strong><span>Use “Add meter reading” to type the cumulative number shown on the meter.</span></div>';
    document.querySelectorAll('[data-gas-delete]').forEach(button => button.addEventListener('click', () => {
      if (!confirm('Delete this gas meter reading?')) return;
      localStorage.setItem(meterKey, JSON.stringify(readAll().filter(row => row.id !== button.dataset.gasDelete)));
      window.HomeInsightsLocalData?.renderMeters(); window.dispatchEvent(new CustomEvent('homeinsights:meters-changed'));
    }));
    document.querySelectorAll('[data-gas-edit]').forEach(button => button.addEventListener('click', () => {
      const all = readAll(), row = all.find(item => item.id === button.dataset.gasEdit); if (!row) return;
      const next = prompt('Correct the cumulative meter reading:', row.value); if (next === null) return;
      const value = Number(next.trim().replace(',','.')); if (!Number.isFinite(value) || value < 0) { alert('Enter a valid meter reading.'); return; }
      row.value = value; row.source = row.source === 'manual-with-photo' ? row.source : 'manual';
      localStorage.setItem(meterKey, JSON.stringify(all)); window.HomeInsightsLocalData?.renderMeters(); window.dispatchEvent(new CustomEvent('homeinsights:meters-changed'));
    }));
  }

  function renderChart() {
    let rows = dailyRows();
    if (settings.range !== 'all') rows = rows.slice(-Number(settings.range));
    if (!rows.length) { $('gasChart').innerHTML = '<div class="gas-empty"><strong>Two readings make the first interval</strong><span>Daily use will appear here after the next manual reading.</span></div>'; return; }
    const width = Math.max(760, rows.length * 12), height = 270, left = 48, right = 18, top = 18, bottom = 42;
    const max = Math.max(...rows.map(row => row.mj), 1), plotH = height-top-bottom, plotW = width-left-right;
    const points = rows.map((row,i) => `${left + (i/(Math.max(rows.length-1,1)))*plotW},${top + plotH - row.mj/max*plotH}`).join(' ');
    const area = `${left},${top+plotH} ${points} ${left+plotW},${top+plotH}`;
    const ticks = [0,.25,.5,.75,1].map(n => { const y=top+plotH-n*plotH; return `<line x1="${left}" y1="${y}" x2="${width-right}" y2="${y}"/><text x="${left-9}" y="${y+4}">${(max*n).toFixed(0)}</text>`; }).join('');
    const labelEvery = Math.max(1,Math.ceil(rows.length/8));
    const labels = rows.map((row,i) => i%labelEvery===0 || i===rows.length-1 ? `<text class="gas-x-label" x="${left+(i/Math.max(rows.length-1,1))*plotW}" y="${height-13}">${fmtShort(row.date)}</text>` : '').join('');
    $('gasChart').innerHTML = `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img"><g class="gas-grid">${ticks}</g><polygon class="gas-area" points="${area}"/><polyline class="gas-line" points="${points}"/>${labels}</svg>`;
    $('gasChart').scrollLeft = $('gasChart').scrollWidth;
  }

  function render() { renderSummary(); renderReadings(); renderChart(); }
  function start() {
    $('gasMjPerUnit').value = settings.mjPerUnit; $('gasRate').value = settings.rateCents; $('gasSupply').value = settings.supplyDaily;
    [['gasMjPerUnit','mjPerUnit'],['gasRate','rateCents'],['gasSupply','supplyDaily']].forEach(([id,key]) => $(id).addEventListener('change', event => { const value=Number(event.target.value); if(!Number.isFinite(value)||value<0)return; settings[key]=value; saveSettings(); render(); }));
    document.querySelectorAll('[data-gas-range]').forEach(button => button.addEventListener('click', () => { settings.range=button.dataset.gasRange; saveSettings(); document.querySelectorAll('[data-gas-range]').forEach(item=>item.classList.toggle('active',item===button)); renderChart(); }));
    document.querySelectorAll('[data-gas-range]').forEach(button => button.classList.toggle('active',button.dataset.gasRange===settings.range));
    $('costDate')?.addEventListener('change', event => setTimeout(()=>renderServiceCostForDate(event.target.value),0));
    window.addEventListener('homeinsights:meters-changed', render);
    window.addEventListener('homeinsights:data-ready', render);
    window.addEventListener('storage', event => { if(event.key===meterKey||event.key===settingsKey) render(); });
    render();
  }
  window.HomeInsightsGasV2 = { start, render, intervals };
})();

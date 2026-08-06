(() => {
  'use strict';
  const { $, money } = window.HomeInsights;
  const meterKey = 'home-insights-meter-readings';
  const settingsKey = 'home-insights-gas-v2-settings';
  const billRevision = '2026-07-27';
  const defaults = { mjPerUnit: 38.61638, rateCents: 3.64, supplyDaily: 0.9778, range: '90', billRevision };
  const officialReadings = [
    { id:'gas-bill-2026-05-28', kind:'gas', value:4453, date:'2026-05-28T12:00:00+10:00', source:'bill-actual', verified:true },
    { id:'gas-bill-2026-07-27', kind:'gas', value:4830, date:'2026-07-27T12:00:00+10:00', source:'bill-actual', verified:true }
  ];
  const officialBillInterval = { startId:'gas-bill-2026-05-28', endId:'gas-bill-2026-07-27', days:61, units:377, mj:14558.37526, usageCost:529.91, supplyCost:59.65 };
  let settings = loadSettings();
  let historical = [];
  let historyState = 'loading';

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(settingsKey) || '{}');
      if (saved.billRevision !== billRevision) {
        if (saved.mjPerUnit === undefined || Number(saved.mjPerUnit) === 38.61) saved.mjPerUnit = defaults.mjPerUnit;
        if (saved.rateCents === undefined || Number(saved.rateCents) === 3.20) saved.rateCents = defaults.rateCents;
        if (saved.supplyDaily === undefined || Number(saved.supplyDaily) === 0.90) saved.supplyDaily = defaults.supplyDaily;
        saved.billRevision = billRevision;
      }
      return { ...defaults, ...saved };
    }
    catch { return { ...defaults }; }
  }
  function saveSettings() { localStorage.setItem(settingsKey, JSON.stringify(settings)); }
  function readAll() {
    try { return JSON.parse(localStorage.getItem(meterKey) || '[]'); }
    catch { return []; }
  }
  function ensureOfficialReadings() {
    const rows = readAll(); let changed = false;
    officialReadings.forEach(official => {
      const existing = rows.find(row => row.id === official.id);
      if (existing) { Object.assign(existing, official); changed = true; }
      else { rows.push({ ...official }); changed = true; }
    });
    if (changed) localStorage.setItem(meterKey, JSON.stringify(rows));
  }
  function gasReadings() {
    return readAll().filter(row => row.kind === 'gas' && Number.isFinite(Number(row.value)) && !Number.isNaN(new Date(row.date).getTime()))
      .map(row => ({ ...row, value: Number(row.value), time: new Date(row.date) }))
      .sort((a,b) => a.time - b.time);
  }
  function meterIntervals() {
    const rows = gasReadings(), result = [];
    for (let i = 1; i < rows.length; i++) {
      const start = rows[i-1], end = rows[i], units = end.value - start.value;
      const days = (end.time - start.time) / 86400000;
      if (!(days > 0) || units < 0) continue;
      const isOfficialBill = start.id === officialBillInterval.startId && end.id === officialBillInterval.endId;
      const billed = isOfficialBill ? officialBillInterval : null;
      const endInclusive = end.id === officialBillInterval.endId;
      const intervalDays = billed?.days || (days + (endInclusive ? 1 : 0)), intervalUnits = billed?.units ?? units;
      const mj = billed?.mj ?? (units * settings.mjPerUnit), dailyMj = mj / intervalDays;
      result.push({ type:isOfficialBill?'bill':'manual', start, end, units:intervalUnits, days:intervalDays, endInclusive, mj, dailyMj, usageCost:billed?.usageCost ?? (mj * settings.rateCents / 100), supplyCost:billed?.supplyCost ?? (intervalDays * settings.supplyDaily) });
    }
    return result;
  }
  const dateAtNoon = value => new Date(`${String(value).slice(0,10)}T12:00:00`);
  const dateKey = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const nextDay = date => { const copy = new Date(date); copy.setDate(copy.getDate()+1); return copy; };
  const fmtDate = date => date.toLocaleDateString('en-AU', { day:'numeric', month:'short', year:'numeric' });
  const fmtShort = date => date.toLocaleDateString('en-AU', { day:'numeric', month:'short' });
  const pctText = value => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(0)}%`;

  function historicalSpans() {
    const spans = [];
    historical.forEach(row => {
      const previous = spans.at(-1);
      const contiguous = previous && dateKey(nextDay(previous.endDay)) === row.date;
      if (previous && contiguous && previous.dailyMj === row.mj) {
        previous.endDay = row.time;
        previous.end = nextDay(row.time);
        previous.days += 1;
        previous.mj += row.mj;
        previous.usageCost = previous.mj * settings.rateCents / 100;
        previous.supplyCost = previous.days * settings.supplyDaily;
      } else {
        spans.push({ type:'historical', start:{time:row.time}, end:nextDay(row.time), endDay:row.time, days:1, dailyMj:row.mj, mj:row.mj, usageCost:row.mj * settings.rateCents / 100, supplyCost:settings.supplyDaily });
      }
    });
    return spans;
  }

  function spanEndTime(span) { return span.type === 'manual' || span.type === 'bill' ? span.end.time : span.end; }
  function sortedSpans() { return [...historicalSpans(), ...meterIntervals()].sort((a,b) => spanEndTime(a) - spanEndTime(b)); }

  function dailyRows() {
    const byDate = new Map(historical.map(row => [row.date, { date:row.time, mj:row.mj, source:'historical' }]));
    meterIntervals().forEach(interval => {
      const cursor = new Date(interval.start.time); cursor.setHours(12,0,0,0);
      const endDay = new Date(interval.end.time); endDay.setHours(12,0,0,0);
      while (interval.endInclusive ? cursor <= endDay : cursor < endDay) {
        byDate.set(dateKey(cursor), { date:new Date(cursor), mj:interval.dailyMj, source:'manual' });
        cursor.setDate(cursor.getDate()+1);
      }
    });
    return [...byDate.values()].sort((a,b) => a.date - b.date).map(row => ({ ...row, cost:row.mj * settings.rateCents / 100 + settings.supplyDaily }));
  }

  function gasEstimateForDate(dateString, useLatest = true) {
    const rows = dailyRows();
    if (!rows.length) return null;
    const exact = dateString ? rows.find(row => dateKey(row.date) === dateString) : null;
    const row = exact || (useLatest ? rows.at(-1) : null);
    return row ? { ...row, cost:row.cost, requestedDate:dateString, isLatestEstimate:!exact } : null;
  }

  function renderSummary() {
    const readings = gasReadings(), manualCount = readings.filter(row => row.source !== 'bill-actual').length, spans = sortedSpans(), latest = spans.at(-1), previous = spans.at(-2);
    if (historyState === 'loading') {
      $('gasCoverage').textContent = 'Loading your historical gas record…';
    } else if (historical.length) {
      const manualText = manualCount ? ` · ${manualCount} manual reading${manualCount===1?'':'s'}` : ' · 2 verified bill readings';
      $('gasCoverage').textContent = `${historical.length.toLocaleString('en-AU')} historical days · ${fmtDate(historical[0].time)} to ${fmtDate(historical.at(-1).time)}${manualText}`;
    } else {
      $('gasCoverage').textContent = readings.length ? `${readings.length} meter reading${readings.length===1?'':'s'}` : 'Historical gas data could not be loaded. You can still add manual readings.';
    }
    if (!latest) {
      ['gasLatestDaily','gasLatestMj','gasLatestCost','gasLatestChange'].forEach(id => $(id).textContent = '—');
      $('gasLatestPeriod').textContent = readings.length === 1 ? 'Add one more reading to calculate usage' : 'Waiting for gas data';
      $('gasLatestUnits').textContent = 'between readings'; $('gasGoalPercent').textContent = '—'; $('gasGoalFill').style.width = '0%';
      $('gasGoalText').textContent = 'Your first two readings establish the baseline.';
      $('costGasCaption').textContent = readings.length ? 'One more reading needed' : 'No gas estimate available';
      return;
    }
    const totalCost = latest.usageCost + latest.supplyCost;
    $('gasLatestDaily').textContent = `${latest.dailyMj.toFixed(1)} MJ/day`;
    if (latest.type === 'manual' || latest.type === 'bill') {
      $('gasLatestPeriod').textContent = `${fmtDate(latest.start.time)} – ${fmtDate(latest.end.time)} · ${latest.days.toFixed(latest.days < 10 ? 1 : 0)} days · ${latest.type === 'bill' ? 'actual bill' : 'manual'}`;
      $('gasLatestUnits').textContent = `${latest.units.toFixed(3)} meter units`;
    } else {
      $('gasLatestPeriod').textContent = `${fmtDate(latest.start.time)} – ${fmtDate(latest.endDay)} · ${latest.days} days · historical bill estimate`;
      $('gasLatestUnits').textContent = `${latest.days} historical days`;
    }
    $('gasLatestMj').textContent = `${latest.mj.toFixed(1)} MJ`;
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
    $('gasGoalText').textContent = reduction > 0 ? `Daily gas use is ${reduction.toFixed(0)}% below the first historical period.` : reduction < 0 ? `Daily gas use is ${Math.abs(reduction).toFixed(0)}% above the first historical period.` : 'This period matches the historical baseline.';
    renderServiceCostForDate($('costDate')?.value);
  }

  function renderServiceCostForDate(dateString) {
    const estimate = gasEstimateForDate(dateString, true); if (!estimate) return;
    $('costGas').textContent = money(estimate.cost);
    $('costGasCaption').textContent = estimate.isLatestEstimate ? `${estimate.mj.toFixed(1)} MJ/day latest estimate` : `${estimate.mj.toFixed(1)} MJ/day ${estimate.source === 'manual' ? 'measured' : 'historical'}`;
  }

  function renderReadings() {
    const rows = gasReadings().slice().reverse();
    $('gasReadingList').innerHTML = rows.length ? rows.map(row => { const bill=row.source==='bill-actual'; return `<div class="gas-reading-row"><div><strong>${row.value.toLocaleString('en-AU',{maximumFractionDigits:4})}</strong><small>${fmtDate(row.time)} · ${bill?'actual bill':`manual${row.source==='manual-with-photo'?' + photo':''}`}</small></div><div>${bill?'<span class="gas-verified">Verified</span>':`<button data-gas-edit="${row.id}">Edit</button><button data-gas-delete="${row.id}">Delete</button>`}</div></div>`; }).join('') : `<div class="gas-empty"><strong>No manual readings yet</strong><span>${historical.length ? `The chart already includes ${historical.length.toLocaleString('en-AU')} days from your bills. ` : ''}Add a reading to extend the record from the meter.</span></div>`;
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
    if (!rows.length) { $('gasChart').innerHTML = `<div class="gas-empty"><strong>${historyState === 'loading' ? 'Loading gas history…' : 'Two readings make the first interval'}</strong><span>${historyState === 'loading' ? 'Your bill history will appear here shortly.' : 'Daily use will appear here after the next manual reading.'}</span></div>`; return; }
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
  async function loadHistorical() {
    try {
      const response = await fetch('data/home_insights.json', { cache:'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      historical = (json.energyDaily || []).filter(row => row.date && row.gasMJ !== null && row.gasMJ !== '' && Number.isFinite(Number(row.gasMJ))).map(row => ({ date:String(row.date), time:dateAtNoon(row.date), mj:Number(row.gasMJ) })).sort((a,b) => a.time-b.time);
      historyState = 'ready';
    } catch (error) {
      console.error('Gas history:', error); historyState = 'error'; historical = [];
    }
    render();
    window.dispatchEvent(new CustomEvent('homeinsights:gas-data-ready'));
  }
  function start() {
    ensureOfficialReadings(); saveSettings();
    $('gasMjPerUnit').value = settings.mjPerUnit; $('gasRate').value = settings.rateCents; $('gasSupply').value = settings.supplyDaily;
    [['gasMjPerUnit','mjPerUnit'],['gasRate','rateCents'],['gasSupply','supplyDaily']].forEach(([id,key]) => $(id).addEventListener('change', event => { const value=Number(event.target.value); if(!Number.isFinite(value)||value<0)return; settings[key]=value; saveSettings(); render(); window.dispatchEvent(new CustomEvent('homeinsights:gas-data-ready')); }));
    document.querySelectorAll('[data-gas-range]').forEach(button => button.addEventListener('click', () => { settings.range=button.dataset.gasRange; saveSettings(); document.querySelectorAll('[data-gas-range]').forEach(item=>item.classList.toggle('active',item===button)); renderChart(); }));
    document.querySelectorAll('[data-gas-range]').forEach(button => button.classList.toggle('active',button.dataset.gasRange===settings.range));
    $('costDate')?.addEventListener('change', event => setTimeout(()=>renderServiceCostForDate(event.target.value),0));
    window.addEventListener('homeinsights:meters-changed', () => { render(); window.dispatchEvent(new CustomEvent('homeinsights:gas-data-ready')); });
    window.addEventListener('storage', event => { if(event.key===meterKey||event.key===settingsKey) render(); });
    render(); loadHistorical();
  }
  window.HomeInsightsGasV2 = { start, render, intervals:meterIntervals, dailyRows, gasEstimateForDate };
})();

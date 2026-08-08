(() => {
  'use strict';
  const { cfg, $, money, dayKey, recordFor, upsertDaily } = window.HomeInsights;
  const setText = (id, value) => { const node = $(id); if (node) node.textContent = value; };

  function renderElectricity(date) {
    const row = recordFor(date);
    setText('electricityTotal', money(row?.electricityTotal));
    setText('electricityDetailTotal', money(row?.electricityTotal));
    setText('supplyCost', money(row?.electricitySupply));
    setText('paidEnergyCost', money(row?.paidEnergyCost));
    setText('freeEnergyUsed', Number.isFinite(+row?.freeImportKwh) ? `${(+row.freeImportKwh).toFixed(2)} kWh` : '— kWh');
    setText('exportCredit', Number.isFinite(+row?.exportCredit) ? `−${money(Math.abs(+row.exportCredit))}` : '—');
    setText('solarToday', Number.isFinite(+row?.solarKwh) ? `${(+row.solarKwh).toFixed(2)} kWh` : '—');
    setText('loadToday', Number.isFinite(+row?.loadKwh) ? `${(+row.loadKwh).toFixed(2)} kWh` : '—');
    setText('importToday', Number.isFinite(+row?.importKwh) ? `${(+row.importKwh).toFixed(2)} kWh` : '—');
    setText('exportToday', Number.isFinite(+row?.exportKwh) ? `${(+row.exportKwh).toFixed(2)} kWh` : '—');
    setText('solarHeroToday', Number.isFinite(+row?.solarKwh) ? `Today ${(+row.solarKwh).toFixed(2)} kWh` : 'Today — kWh');
  }

  function renderServices(date, includeHome = false) {
    const row = recordFor(date), electric = row?.electricityTotal, gas = row?.gasTotal, water = row?.waterTotal;
    const known = [electric, gas, water].filter(value => Number.isFinite(+value));
    const total = known.length ? known.reduce((sum, value) => sum + +value, 0) : null;
    setText('costElectricity', money(electric)); setText('costGas', money(gas)); setText('costWater', money(water));
    setText('costTotal', money(total));
    if (includeHome) setText('homeTotalCost', money(total));
  }

  async function fetchDay(date) {
    if (!cfg.sharedApi) return recordFor(date);
    const json = await window.HomeInsightsApi.request(cfg.sharedApi, { action: 'day', date });
    if (!json.ok) throw new Error(json.error || 'Backend error');
    const row = json.day || json.today; if (row) upsertDaily(row);
    return row;
  }

  async function loadElectricity(date) {
    try { await fetchDay(date); } catch (error) { console.warn('Shared electricity day:', error); }
    renderElectricity(date);
  }

  async function loadServices(date, includeHome = false) {
    try { await fetchDay(date); } catch (error) { console.warn('Shared services day:', error); }
    renderServices(date, includeHome);
  }

  function parseQuestion(question) {
    const q=question.toLowerCase(), services=['electricity','gas','water'].filter(service=>q.includes(service));
    const monthMatch=q.match(/(?:for|in|during)?\s*(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/i);
    if(monthMatch){const months=['january','february','march','april','may','june','july','august','september','october','november','december'],month=months.indexOf(monthMatch[1].toLowerCase())+1;return{start:`${monthMatch[2]}-${String(month).padStart(2,'0')}-01`,end:`${monthMatch[2]}-${String(month).padStart(2,'0')}-${new Date(+monthMatch[2],month,0).getDate()}`,services:services.length?services:['electricity','gas','water'],label:`${monthMatch[1]} ${monthMatch[2]}`}}
    if(q.includes('this time last year')){const d=new Date();d.setFullYear(d.getFullYear()-1);const date=d.toISOString().slice(0,10);return{date,services:services.length?services:['electricity','gas','water']}}
    const match = question.match(/(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/i);
    if (!match) return { error: 'Please include a date, for example “7 April 2026”.' };
    const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
    const date = `${match[3]}-${String(months.indexOf(match[2].toLowerCase()) + 1).padStart(2,'0')}-${String(match[1]).padStart(2,'0')}`;
    return { date, services: services.length ? services : ['electricity','gas','water'] };
  }

  async function answerQuestion(question){
    const parsed=parseQuestion(question), answer=$('askAnswer'); answer.hidden=false;
    if(parsed.error){answer.textContent=parsed.error;return}
    if(parsed.start){
      try{const json=await window.HomeInsightsApi.request(cfg.sharedApi,{action:'range',start:parsed.start,end:parsed.end});if(json?.ok)(json.days||json.rows||[]).forEach(upsertDaily)}catch(error){console.warn('Ask range:',error)}
      const rows=(window.HOME_INSIGHTS_DAILY||[]).filter(r=>r.date>=parsed.start&&r.date<=parsed.end),labels={electricity:'Electricity',gas:'Gas',water:'Water'};
      if(!rows.length){answer.innerHTML=`<strong>No history available</strong><br>There are no shared records for ${parsed.label}.`;return}
      const totals=parsed.services.map(service=>({name:labels[service],value:rows.reduce((sum,row)=>sum+(Number(row[`${service}Total`])||Number(service==='gas'?row.gasCost:service==='water'?row.waterCost:null)||0),0)}));
      answer.innerHTML=`<strong>${parsed.label}</strong>`+totals.map(x=>`<div><b>${x.name}</b> ${money(x.value)}</div>`).join('')+`<br><strong>Total ${money(totals.reduce((s,x)=>s+x.value,0))}</strong>`;return
    }
    try{await fetchDay(parsed.date)}catch(error){console.warn('Ask day:',error)}
    const row=recordFor(parsed.date);if(!row){answer.innerHTML='<strong>No history available for that date.</strong>';return}
    const labels={electricity:'Electricity',gas:'Gas',water:'Water'},values=parsed.services.map(service=>({name:labels[service],value:row[`${service}Total`]??(service==='gas'?row.gasCost:service==='water'?row.waterCost:null)}));
    answer.innerHTML=values.map(item=>`<div><b>${item.name}</b> ${money(item.value)}</div>`).join('')+`<br><strong>Combined ${money(values.reduce((s,x)=>s+(+x.value||0),0))}</strong>`;
  }

  function start() {
    const today = dayKey();
    if ($('costDate')) $('costDate').value = today;
    $('costDate')?.addEventListener('change', event => loadServices(event.target.value, event.target.value === today));
    loadServices(today, true);
    $('askForm')?.addEventListener('submit', event => { event.preventDefault(); answerQuestion($('askInput').value.trim()); });
    window.addEventListener('homeinsights:shared-day', event => {
      upsertDaily(event.detail);
      if (event.detail.date === today) {
        renderServices(today, true);
        if ((window.HomeInsightsElectricityDate?.selectedDate || today) === today) renderElectricity(today);
      }
    });
  }
  window.HomeInsightsCosts = { start, loadElectricity, loadServices, renderElectricity, renderServices };
})();

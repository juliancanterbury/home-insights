(() => {
  'use strict';
  const { cfg, $, money, dayKey, recordFor, upsertDaily } = window.HomeInsights;
  const setText = (id, value) => { const node = $(id); if (node) node.textContent = value; };
  const hasCost = value => value !== null && value !== '' && Number.isFinite(+value);
  const costText = value => hasCost(value) ? money(value) : '—';

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
    const row = recordFor(date), electric = row?.electricityTotal;
    const gasEstimate = window.HomeInsightsGasV2?.gasEstimateForDate(date, true);
    const waterEstimate = window.HomeInsightsWaterV2?.estimateForDate(date, true);
    const gas = gasEstimate?.cost ?? row?.gasTotal, water = waterEstimate?.cost ?? row?.waterTotal;
    const known = [electric, gas, water].filter(hasCost);
    const total = known.length ? known.reduce((sum, value) => sum + +value, 0) : null;
    setText('costElectricity', costText(electric)); setText('costGas', costText(gas)); setText('costWater', costText(water));
    if (gasEstimate) setText('costGasCaption', gasEstimate.isLatestEstimate ? `${gasEstimate.mj.toFixed(1)} MJ/day latest estimate` : `${gasEstimate.mj.toFixed(1)} MJ/day ${gasEstimate.source === 'manual' ? 'measured' : 'historical'}`);
    if (waterEstimate) setText('costWaterCaption', `${waterEstimate.litres.toFixed(0)} L/day averaged`);
    setText('costTotal', money(total));
    if (includeHome) {
      setText('homeElectricityCost', costText(electric));
      setText('homeGasCost', costText(gas));
      setText('homeWaterCost', costText(water));
      setText('homeTotalCost', costText(total));
      const missing = [
        ['electricity', electric],
        ['gas', gas],
        ['water', water]
      ].filter(([, value]) => !hasCost(value)).map(([label]) => label);
      setText('homeCostStatus', missing.length ? `${missing.join(' + ')} pending` : 'combined daily cost');
    }
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

  function localKey(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
  function parseQuestion(question) {
    const text=question.toLowerCase().trim(), now=new Date(); let date;
    if (/this day (?:one |1 )?year ago|same day last year|a year ago|one year ago/.test(text)) { date=new Date(now); date.setFullYear(date.getFullYear()-1); }
    else if (/\byesterday\b/.test(text)) { date=new Date(now); date.setDate(date.getDate()-1); }
    else if (/\btoday\b|\bthis day\b/.test(text)) date=now;
    const numeric=text.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})\b/);
    if(numeric) date=new Date(+numeric[3],+numeric[2]-1,+numeric[1]);
    const match = text.match(/(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/i);
    if (!date && !match) return { error: 'Try “How much did today cost?”, “this day one year ago”, or “7 April 2026”.' };
    const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
    const dateString = date ? localKey(date) : `${match[3]}-${String(months.indexOf(match[2].toLowerCase()) + 1).padStart(2,'0')}-${String(match[1]).padStart(2,'0')}`;
    const services = ['electricity','gas','water'].filter(service => question.toLowerCase().includes(service));
    return { date:dateString, services: services.length ? services : ['electricity','gas','water'] };
  }

  function answerFor(date,services){const row=recordFor(date),historicalElectricity=(window.HOME_INSIGHTS_ELECTRICITY_HISTORY?.daily||[]).find(item=>item.date===date),electricityEstimate=!hasCost(row?.electricityTotal)&&historicalElectricity?Number(cfg.dailySupplyCharge||0)+Number(historicalElectricity.importKwh||0)*Number(cfg.importRate||0)-Number(historicalElectricity.exportKwh||0)*Number(cfg.feedInRate||0):null,gas=window.HomeInsightsGasV2?.gasEstimateForDate(date,false),water=window.HomeInsightsWaterV2?.estimateForDate(date,false),values={electricity:hasCost(row?.electricityTotal)?row.electricityTotal:electricityEstimate,gas:gas?.cost??row?.gasTotal,water:water?.cost??row?.waterTotal},labels={electricity:'Electricity',gas:'Gas',water:'Water'},available=services.filter(service=>hasCost(values[service])),missing=services.filter(service=>!hasCost(values[service])),total=available.reduce((sum,service)=>sum+Number(values[service]),0),heading=new Date(date+'T12:00:00').toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long',year:'numeric'}),estimatedElectricity=services.includes('electricity')&&electricityEstimate!==null;return `<div class="ask-date">${heading}</div>${available.map(service=>`<div class="ask-cost-row ${service}"><span>${labels[service]}${service==='electricity'&&estimatedElectricity?' <em>estimated</em>':''}</span><strong>${money(values[service])}</strong></div>`).join('')}<div class="ask-cost-total"><span>${missing.length?'Known total':'Combined total'}</span><strong>${available.length?money(total):'—'}</strong></div>${estimatedElectricity?'<p class="ask-note">Historical electricity is estimated from that day’s meter totals using the currently configured import, export and supply rates.</p>':''}${missing.length?`<p class="ask-note">No ${missing.map(item=>labels[item].toLowerCase()).join(' or ')} record is available for that date, so it is not included.</p>`:''}`;}

  function start() {
    const today = dayKey();
    if ($('costDate')) $('costDate').value = today;
    $('costDate')?.addEventListener('change', event => loadServices(event.target.value, event.target.value === today));
    loadServices(today, true);
    $('askForm')?.addEventListener('submit', event => {
      event.preventDefault(); const parsed = parseQuestion($('askInput').value.trim()); $('askAnswer').hidden = false;
      if (parsed.error) return void ($('askAnswer').textContent = parsed.error);
      $('askAnswer').innerHTML = answerFor(parsed.date,parsed.services);
    });
    document.querySelectorAll('.ask-suggestions button').forEach(button=>button.addEventListener('click',()=>{$('askInput').value=button.textContent;$('askForm').requestSubmit();}));
    window.addEventListener('homeinsights:shared-day', event => {
      upsertDaily(event.detail);
      if (event.detail.date === today) {
        renderServices(today, true);
        if ((window.HomeInsightsElectricityDate?.selectedDate || today) === today) renderElectricity(today);
      }
    });
    window.addEventListener('homeinsights:gas-data-ready', () => renderServices($('costDate')?.value || today, ($('costDate')?.value || today) === today));
    window.addEventListener('homeinsights:water-data-ready', () => renderServices($('costDate')?.value || today, ($('costDate')?.value || today) === today));
  }
  window.HomeInsightsCosts = { start, loadElectricity, loadServices, renderElectricity, renderServices };
})();

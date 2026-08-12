(() => {
  'use strict';
  const { cfg, $, money, dayKey, recordFor, upsertDaily } = window.HomeInsights;
  const setText = (id, value) => { const node = $(id); if (node) node.textContent = value; };
  const hasCost = value => value !== null && value !== '' && Number.isFinite(+value);
  const costText = value => hasCost(value) ? money(value) : '—';
  const roundedMoneyValue = value => Math.round(Number(value)*100)/100;
  const intervalText = estimate => {
    const days=Number(estimate?.averagingDays);
    if(!Number.isFinite(days)||days<=0)return 'latest available daily estimate';
    const shown=days<10?days.toFixed(1):days.toFixed(0);
    return `average over ${shown} ${Math.abs(days-1)<0.05?'day':'days'}`;
  };

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
    const total = known.length ? known.reduce((sum, value) => sum + roundedMoneyValue(value), 0) : null;
    setText('costElectricity', costText(electric)); setText('costGas', costText(gas)); setText('costWater', costText(water));
    if (gasEstimate) setText('costGasCaption', gasEstimate.isLatestEstimate ? `${gasEstimate.mj.toFixed(1)} MJ/day latest estimate` : `${gasEstimate.mj.toFixed(1)} MJ/day ${gasEstimate.source === 'manual' ? 'measured' : 'historical'}`);
    if (waterEstimate) setText('costWaterCaption', `${waterEstimate.litres.toFixed(0)} L/day averaged`);
    setText('costTotal', money(total));
    if (includeHome) {
      setText('homeElectricityCost', costText(electric));
      setText('homeGasCost', costText(gas));
      setText('homeWaterCost', costText(water));
      setText('homeGasPeriod', intervalText(gasEstimate));
      setText('homeWaterPeriod', intervalText(waterEstimate));
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

  function answerFor(date,services){
    const row=recordFor(date);
    const legacyEnergy=(window.HOME_INSIGHTS_ENERGY_DAILY||[]).find(item=>item.date===date);
    const historicalElectricity=(window.HOME_INSIGHTS_ELECTRICITY_HISTORY?.daily||[]).find(item=>item.date===date)
      ||(legacyEnergy&&Number.isFinite(Number(legacyEnergy.gridImport))&&Number.isFinite(Number(legacyEnergy.gridExport))?{date,importKwh:Number(legacyEnergy.gridImport),exportKwh:Number(legacyEnergy.gridExport),source:'Home Insights historical energy data'}:null);
    const recordedElectricity=hasCost(row?.electricityTotal)?Number(row.electricityTotal):null;
    const reconstructedElectricity=recordedElectricity===null&&historicalElectricity
      ?Number(cfg.dailySupplyCharge||0)+Number(historicalElectricity.importKwh||0)*Number(cfg.importRate||0)-Number(historicalElectricity.exportKwh||0)*Number(cfg.feedInRate||0)
      :null;
    const isToday=date===dayKey();
    const gas=window.HomeInsightsGasV2?.gasEstimateForDate(date,isToday);
    const water=window.HomeInsightsWaterV2?.estimateForDate(date,isToday);
    const waterValue=water?.cost??row?.waterTotal;
    const values={electricity:recordedElectricity??reconstructedElectricity,gas:gas?.cost??row?.gasTotal,water:waterValue};
    const labels={electricity:'Electricity',gas:'Gas',water:'Water'};
    const provenance={
      electricity:recordedElectricity!==null?'recorded daily cost':reconstructedElectricity!==null?'metered usage · current tariff reconstruction':'',
      gas:gas?`${gas.source==='historical'?'bill-derived':'meter interval'} daily average`:hasCost(row?.gasTotal)?'recorded cost':'',
      water:water?'meter interval daily average':hasCost(row?.waterTotal)?'actual bill-period daily average':''
    };
    const available=services.filter(service=>hasCost(values[service])),missing=services.filter(service=>!hasCost(values[service]));
    const total=available.reduce((sum,service)=>sum+roundedMoneyValue(values[service]),0);
    const heading=new Date(date+'T12:00:00').toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
    const rows=available.map(service=>`<div class="ask-cost-row ${service}"><span>${labels[service]}${provenance[service]?` <em>${provenance[service]}</em>`:''}</span><strong>${money(values[service])}</strong></div>`).join('');
    const electricityNote=reconstructedElectricity!==null&&services.includes('electricity')?`<p class="ask-note">Electricity uses the exact meter totals for this date (${Number(historicalElectricity.importKwh).toFixed(3)} kWh imported, ${Number(historicalElectricity.exportKwh).toFixed(3)} kWh exported). The dollar amount uses the currently configured tariff because an electricity-only historical tariff is not attached to this record.</p>`:'';
    const waterNote=hasCost(row?.waterTotal)&&!water&&services.includes('water')?`<p class="ask-note">Water is the exact Yarra Valley Water bill total averaged across its ${row.waterBillingStart} to ${row.waterBillingEnd} billing period; it is not claimed as individually metered usage for this day.</p>`:'';
    const missingNote=missing.length?`<p class="ask-note">No ${missing.map(item=>labels[item].toLowerCase()).join(' or ')} record is available for that date, so it is not included.</p>`:'';
    return `<div class="ask-date">${heading}</div>${rows}<div class="ask-cost-total"><span>${missing.length?'Known total':'Combined total'}</span><strong>${available.length?money(total):'—'}</strong></div>${electricityNote}${waterNote}${missingNote}`;
  }

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

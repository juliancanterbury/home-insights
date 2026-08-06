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
    const gas = gasEstimate?.cost ?? row?.gasTotal, water = row?.waterTotal;
    const known = [electric, gas, water].filter(hasCost);
    const total = known.length ? known.reduce((sum, value) => sum + +value, 0) : null;
    setText('costElectricity', costText(electric)); setText('costGas', costText(gas)); setText('costWater', costText(water));
    if (gasEstimate) setText('costGasCaption', gasEstimate.isLatestEstimate ? `${gasEstimate.mj.toFixed(1)} MJ/day latest estimate` : `${gasEstimate.mj.toFixed(1)} MJ/day ${gasEstimate.source === 'manual' ? 'measured' : 'historical'}`);
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

  function parseQuestion(question) {
    const match = question.match(/(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/i);
    if (!match) return { error: 'Please include a date, for example “7 April 2026”.' };
    const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
    const date = `${match[3]}-${String(months.indexOf(match[2].toLowerCase()) + 1).padStart(2,'0')}-${String(match[1]).padStart(2,'0')}`;
    const services = ['electricity','gas','water'].filter(service => question.toLowerCase().includes(service));
    return { date, services: services.length ? services : ['electricity','gas','water'] };
  }

  function start() {
    const today = dayKey();
    if ($('costDate')) $('costDate').value = today;
    $('costDate')?.addEventListener('change', event => loadServices(event.target.value, event.target.value === today));
    loadServices(today, true);
    $('askForm')?.addEventListener('submit', event => {
      event.preventDefault(); const parsed = parseQuestion($('askInput').value.trim()); $('askAnswer').hidden = false;
      if (parsed.error) return void ($('askAnswer').textContent = parsed.error);
      const row = recordFor(parsed.date);
      if (!row) return void ($('askAnswer').innerHTML = `<strong>No daily ledger yet</strong><br>No shared record is available for ${new Date(parsed.date+'T12:00:00').toLocaleDateString('en-AU',{day:'numeric',month:'long',year:'numeric'})}.`);
      const labels = { electricity:'Electricity', gas:'Gas', water:'Water' };
      const values = parsed.services.map(service => ({ name: labels[service], value: row[`${service}Total`] }));
      const combined = values.reduce((sum, item) => sum + (+item.value || 0), 0);
      $('askAnswer').innerHTML = values.map(item => `<div><b>${item.name}</b> ${money(item.value)}</div>`).join('') + `<br><strong>Combined ${money(combined)}</strong>`;
    });
    window.addEventListener('homeinsights:shared-day', event => {
      upsertDaily(event.detail);
      if (event.detail.date === today) {
        renderServices(today, true);
        if ((window.HomeInsightsElectricityDate?.selectedDate || today) === today) renderElectricity(today);
      }
    });
    window.addEventListener('homeinsights:gas-data-ready', () => renderServices($('costDate')?.value || today, ($('costDate')?.value || today) === today));
  }
  window.HomeInsightsCosts = { start, loadElectricity, loadServices, renderElectricity, renderServices };
})();

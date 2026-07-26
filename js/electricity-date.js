(() => {
  'use strict';
  const { $, dayKey } = window.HomeInsights;
  let selectedDate = dayKey();
  let changeToken = 0;
  const longDate = date => new Date(`${date}T12:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  const setText = (id, text) => { const node = $(id); if (node) node.textContent = text; };

  function updateCopy(date) {
    const today = dayKey(), isToday = date === today;
    setText('electricitySelectedDate', isToday ? 'Today so far' : longDate(date));
    setText('electricityCostKicker', isToday ? 'Today’s electricity' : 'Electricity');
    setText('solarPeriodLabel', isToday ? 'generated today' : 'generated');
    setText('loadPeriodLabel', isToday ? 'used today' : 'used');
    setText('supplyLabel', isToday ? 'Supply charge accrued' : 'Supply charge');
    setText('netCostLabel', isToday ? 'Net cost today' : 'Net electricity cost');
    setText('energyFlowEyebrow', isToday ? 'Today · energy flow' : `${longDate(date)} · energy flow`);
    setText('powerChartEyebrow', isToday ? 'Today · live' : `${longDate(date)} · power`);
    setText('powerChartTitle', isToday ? 'Power flows through the day' : 'Power flows on this day');
    setText('powerChartNote', isToday
      ? 'Sigenergy-style live power: solar and grid import above zero; battery charging, grid export and other outward flows below zero.'
      : 'Stored Sigenergy power samples for the selected day.');
    setText('electricityLiveStatus', isToday ? 'Shared backend connected' : 'Historical day');
  }

  async function select(date, { updateUrl = true } = {}) {
    if (!date) return;
    const token = ++changeToken;
    selectedDate = date;
    const picker = $('sankeyDate'); if (picker && picker.value !== date) picker.value = date;
    updateCopy(date);
    if (updateUrl) {
      const url = new URL(location.href); url.searchParams.set('date', date); history.replaceState(null, '', url);
    }
    await Promise.allSettled([
      window.HomeInsightsCosts?.loadElectricity(date),
      window.HomeInsightsSankey?.loadDate(date),
      window.HomeInsightsLive?.loadSamples(date)
    ]);
    if (token !== changeToken) return;
  }

  function start() {
    const today = dayKey(), picker = $('sankeyDate');
    const requested = new URL(location.href).searchParams.get('date');
    const initial = /^\d{4}-\d{2}-\d{2}$/.test(requested || '') ? requested : today;
    if (picker) {
      picker.max = today;
      picker.value = initial;
      picker.addEventListener('change', () => select(picker.value));
    }
    select(initial, { updateUrl: Boolean(requested) });
  }

  window.HomeInsightsElectricityDate = { start, select, get selectedDate() { return selectedDate; } };
})();

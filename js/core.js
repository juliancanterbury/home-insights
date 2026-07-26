(() => {
  'use strict';
  const cfg = window.HOME_INSIGHTS_CONFIG || {};
  const daily = window.HOME_INSIGHTS_DAILY || [];
  const $ = id => document.getElementById(id);
  const money = value => Number.isFinite(+value)
    ? new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(+value)
    : '—';
  const number = item => item && item.available && Number.isFinite(Number(item.value)) ? Number(item.value) : null;
  const kw = value => value === null ? '-- kW' : `${Math.abs(value).toFixed(Math.abs(value) >= 10 ? 1 : 2)} kW`;
  const dayKey = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
    timeZone: cfg.timezone || 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
  const upsertDaily = row => {
    if (!row || !row.date) return;
    const index = daily.findIndex(item => String(item.date) === String(row.date));
    if (index >= 0) daily[index] = row; else daily.push(row);
  };
  const recordFor = date => daily.find(row => String(row.date) === String(date));
  window.HomeInsights = { cfg, daily, $, money, number, kw, dayKey, upsertDaily, recordFor };
})();

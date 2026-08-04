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
  const LIVE_FLOW_TOLERANCE_KW = 0.30;
  const LIVE_FLOW_WARNING_KW = 0.50;
  const calculateLiveFlowBalance = ({
    solar = 0,
    house = 0,
    batteryPower = 0,
    gridImport = 0,
    gridExport = 0
  } = {}) => {
    const safe = value => Number.isFinite(Number(value)) ? Number(value) : 0;
    const hasCompleteData = [solar, house, batteryPower, gridImport, gridExport]
      .every(value => value !== null && value !== undefined && Number.isFinite(Number(value)));
    const battery = safe(batteryPower);
    const totalInputs =
      Math.max(0, safe(solar)) +
      Math.max(0, safe(gridImport)) +
      Math.max(0, -battery);
    const totalOutputs =
      Math.max(0, safe(house)) +
      Math.max(0, safe(gridExport)) +
      Math.max(0, battery);
    const mismatch = Math.abs(totalInputs - totalOutputs);

    return {
      totalInputs,
      totalOutputs,
      mismatch,
      hasCompleteData,
      withinTolerance: hasCompleteData && mismatch <= LIVE_FLOW_TOLERANCE_KW,
      sensorsUpdating: hasCompleteData && mismatch > LIVE_FLOW_WARNING_KW
    };
  };
  const dayKey = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
    timeZone: cfg.timezone || 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
  const upsertDaily = row => {
    if (!row || !row.date) return;
    const index = daily.findIndex(item => String(item.date) === String(row.date));
    if (index >= 0) daily[index] = row; else daily.push(row);
  };
  const recordFor = date => daily.find(row => String(row.date) === String(date));
  window.HomeInsights = {
    cfg,
    daily,
    $,
    money,
    number,
    kw,
    dayKey,
    upsertDaily,
    recordFor,
    calculateLiveFlowBalance,
    LIVE_FLOW_TOLERANCE_KW,
    LIVE_FLOW_WARNING_KW
  };
})();

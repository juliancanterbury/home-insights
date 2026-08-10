(() => {
  'use strict';

  const { cfg, $, number, kw, dayKey, upsertDaily } = window.HomeInsights;

  let lastLive = null;
  let pollInFlight = false;

  const setText = (id, value) => {
    const node = $(id);
    if (node) node.textContent = value;
  };

  const setFlow = (selector, active) => {
    
    document.querySelector(selector)?.classList.toggle('paused', !active);
  };

  function balancedHouseValue(solar, rawHouse, batteryPower, gridImport, gridExport) {
    const flowValues = [solar, batteryPower, gridImport, gridExport];
    const complete = flowValues.every(value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)));
    if (!complete) return rawHouse;
    const solarKw = Number(solar), batteryKw = Number(batteryPower), importKw = Number(gridImport), exportKw = Number(gridExport);
    return Math.max(0, solarKw + importKw + Math.max(0, -batteryKw) - exportKw - Math.max(0, batteryKw));
  }

 

  function renderSharedDay(row) {
    if (!row) return;

    upsertDaily(row);

    window.dispatchEvent(
      new CustomEvent('homeinsights:shared-day', {
        detail: row
      })
    );
  }

  function renderLive(payload, serverTime) {
    
    const solar = number(payload.solar);
    const house = number(payload.house);
    const batteryPower = number(payload.batteryPower);
    const soc = number(payload.batterySoc);
    const gridImport = number(payload.gridImport);
    const gridExport = number(payload.gridExport);

    const importing = (gridImport || 0) > 0.02;
    const exporting = (gridExport || 0) > 0.02;
    const charging = (batteryPower || 0) > 0.02;
    const discharging = (batteryPower || 0) < -0.02;

    /*
     * Sigenergy presents house load as the balanced remainder of the visible
     * flows. Home Assistant's separate house sensor can arrive a few seconds
     * before or after the other entities, which makes the screen appear not to
     * add up. Keep that raw value in each sample for diagnostics, but use the
     * same balanced presentation as the Sigenergy app.
     */
    const balancedHouse = balancedHouseValue(solar, house, batteryPower, gridImport, gridExport);

    /*
     * Sigenergy may report 100% while the battery is still completing
     * its final charging or balancing stage. Show 99.9% until charging
     * has stopped, then allow 100.0%.
     */
    const displaySoc =
      soc === null
        ? null
        : charging && soc >= 99.9
          ? 99.9
          : Math.max(0, Math.min(100, soc));

    setText('solarNow', kw(solar));
    setText('solarHeroNow', kw(solar));
    setText(
      'solarState',
      (solar || 0) > 0.02 ? 'Generating' : 'Idle'
    );

    setText('houseNow', kw(balancedHouse));
    setText(
      'gridNow',
      kw(importing ? gridImport : exporting ? gridExport : 0)
    );
    setText(
      'gridState',
      importing ? 'Importing' : exporting ? 'Exporting' : 'Idle'
    );

    const socText =
      displaySoc === null
        ? '--%'
        : `${displaySoc.toFixed(1)}%`;

    setText('batterySoc', socText);
    setText('batteryHeroSoc', socText);

    const status = charging
      ? `Charging ${kw(batteryPower)}`
      : discharging
        ? `Discharging ${kw(batteryPower)}`
        : 'Idle';

    setText('batteryState', status);
    setText('batteryHeroState', status);
    setText('batteryPowerNow', kw(Math.abs(batteryPower)));

    const fill = displaySoc === null ? 0 : displaySoc;

    if ($('batteryFill')) {
      $('batteryFill').style.width = `${fill}%`;
    }

    if ($('batteryHeroFill')) {
      $('batteryHeroFill').style.width = `${fill}%`;
    }

    const storedKwh =
      displaySoc === null
        ? '-- kWh'
        : `${(
            cfg.batteryCapacityKwh *
            displaySoc /
            100
          ).toFixed(1)} kWh stored`;

    setText('batteryHeroKwh', storedKwh);

    setFlow('.path-solar', (solar || 0) > 0.02);
    setFlow('.path-grid', importing || exporting);
    setFlow('.path-battery', charging || discharging);

    $('gridFlow')?.classList.toggle('reverse', exporting);
    $('batteryFlow')?.classList.toggle('reverse', charging);

    const currentTime = new Date(serverTime || Date.now());
    const hour = currentTime.getHours();
    const freeNow =
      hour >= cfg.freeWindow.start &&
      hour < cfg.freeWindow.end;

    if ($('freeBadge')) {
      $('freeBadge').hidden = !freeNow;
    }

    setText(
      'tariffStatus',
      freeNow
        ? 'Free electricity period active until 14:00'
        : 'Standard electricity rate · 11:00–14:00 window'
    );

    const stamp = currentTime;

    setText(
      'updatedAt',
      `Updated ${stamp.toLocaleTimeString('en-AU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })}`
    );

    setText('liveText', 'Live');

    if ($('livePill')) {
      $('livePill').className = 'live-pill live';
    }

    lastLive = payload;

    const sample = {
      time: stamp.toISOString(),
      solar: solar || 0,
      house: balancedHouse || 0,
      houseRaw: house,
      grid: importing
        ? gridImport || 0
        : exporting
          ? -(gridExport || 0)
          : 0,
      battery: batteryPower || 0,
      soc
    };

    window.HomeInsightsCharts?.addLiveSample(sample);

    window.dispatchEvent(
      new CustomEvent('homeinsights:live', {
        detail: sample
      })
    );
  }

  function liveError(message) {
    setText(
      'liveText',
      lastLive ? 'Last values' : 'Unavailable'
    );

    if ($('livePill')) {
      $('livePill').className = 'live-pill error';
    }

    setText(
      'updatedAt',
      lastLive
        ? `Live update interrupted · ${message}`
        : `Live connection unavailable · ${message}`
    );
  }

  async function poll() {
    if (pollInFlight) return;

    pollInFlight = true;

    try {
      const endpoint = cfg.sharedApi || cfg.liveApi;

      const json = cfg.sharedApi
        ? await window.HomeInsightsApi.request(endpoint)
        : await fetch(endpoint, {
            cache: 'no-store'
          }).then(response => {
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }

            return response.json();
          });

      if (!json.ok) {
        throw new Error(json.error || 'Backend error');
      }

      renderLive(json.data || {}, json.serverTime);

      if (json.today) {
        renderSharedDay(json.today);
      }

      setText(
        'electricityLiveStatus',
        json.shared
          ? 'Shared backend connected'
          : 'Live source connected'
      );
    } catch (error) {
      console.warn('Home Insights shared energy:', error);
      liveError(error.message || 'Connection failed');
    } finally {
      pollInFlight = false;
    }
  }

  async function loadSamples(date = dayKey()) {
    if (
      !cfg.sharedApi ||
      !window.HomeInsightsCharts?.setLiveSamples
    ) {
      return;
    }

    try {
      const json = await window.HomeInsightsApi.request(
        cfg.sharedApi,
        {
          action: 'samples',
          date
        }
      );

      if (!json.ok) {
        throw new Error(json.error || 'Backend error');
      }

      const samples = (json.samples || []).map(sample => ({
        time: sample.timestamp,
        solar: sample.solar,
        house: balancedHouseValue(sample.solar, sample.house, sample.batteryPower, sample.gridImport, sample.gridExport),
        houseRaw: sample.house,
        battery: sample.batteryPower,
        soc: sample.batterySoc,
        grid:
          (sample.gridImport || 0) > 0
            ? sample.gridImport
            : -Math.abs(sample.gridExport || 0)
      }));

      window.HomeInsightsCharts.setLiveSamples(samples);
    } catch (error) {
      console.warn('Shared live samples:', error);
    }
  }

  window.HomeInsightsLive = {
    poll,
    loadSamples,
    renderSharedDay,

    start() {
      window.HomeInsightsCharts?.init();
      poll();
      window.setInterval(poll, cfg.pollMs || 5000);
    }
  };
})();

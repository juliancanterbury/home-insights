(() => {
  'use strict';
  let sequence = 0;

  function request(baseUrl, params = {}, timeoutMs = 90000) {
    return new Promise((resolve, reject) => {
      if (!baseUrl) return reject(new Error('Shared backend URL is missing'));

      const callback = `__homeInsightsJsonp${Date.now()}_${sequence++}`;
      const script = document.createElement('script');
      let settled = false;

      function removeScript() {
        try { script.remove(); } catch (_) {}
      }

      function retireCallbackLater() {
        // Apps Script can return after a cold-start delay. Keep a harmless callback
        // temporarily so a late JSONP response does not throw a global ReferenceError.
        window[callback] = () => {};
        window.setTimeout(() => {
          try { delete window[callback]; } catch (_) { window[callback] = undefined; }
        }, 120000);
      }

      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        removeScript();
        retireCallbackLater();
        reject(new Error('Shared backend timed out'));
      }, timeoutMs);

      window[callback] = value => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        removeScript();
        try { delete window[callback]; } catch (_) { window[callback] = undefined; }
        resolve(value);
      };

      script.onerror = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        removeScript();
        retireCallbackLater();
        reject(new Error('Shared backend could not be reached'));
      };

      const url = new URL(baseUrl);
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
      });
      url.searchParams.set('callback', callback);
      url.searchParams.set('_', String(Date.now()));
      script.src = url.toString();
      script.async = true;
      document.head.appendChild(script);
    });
  }

  const meterRequest = (action, payload = {}) => request(window.HOME_INSIGHTS_CONFIG?.sharedApi, { action, payload: JSON.stringify(payload) });
  window.HomeInsightsApi = { request, meterRequest };
})();

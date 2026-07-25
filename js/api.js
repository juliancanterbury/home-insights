(() => {
  'use strict';
  let sequence = 0;

  function request(baseUrl, params = {}, timeoutMs = 20000) {
    return new Promise((resolve, reject) => {
      if (!baseUrl) {
        reject(new Error('Shared backend URL is missing'));
        return;
      }

      const callback = `__homeInsightsJsonp${Date.now()}_${sequence++}`;
      const script = document.createElement('script');
      const timer = window.setTimeout(() => finish(new Error('Shared backend timed out')), timeoutMs);

      function cleanup() {
        window.clearTimeout(timer);
        script.remove();
        try { delete window[callback]; } catch (_) { window[callback] = undefined; }
      }

      function finish(error, value) {
        cleanup();
        if (error) reject(error); else resolve(value);
      }

      window[callback] = value => finish(null, value);
      script.onerror = () => finish(new Error('Shared backend could not be reached'));

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

  window.HomeInsightsApi = { request };
})();

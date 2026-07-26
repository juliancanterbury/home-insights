(() => {
  'use strict';
  const { $ } = window.HomeInsights;
  function setTheme(theme) { document.body.className = theme === 'minimal' ? '' : `theme-${theme}`; localStorage.setItem('hi-theme', theme); document.querySelectorAll('[data-theme]').forEach(button => button.classList.toggle('active', button.dataset.theme === theme)); window.HomeInsightsCharts?.renderAll(); }
  function start() { const button=$('themeButton'), menu=$('themeMenu'); button?.addEventListener('click',()=>{const open=menu.hidden;menu.hidden=!open;button.setAttribute('aria-expanded',String(open));}); document.querySelectorAll('[data-theme]').forEach(item=>item.addEventListener('click',()=>{setTheme(item.dataset.theme);menu.hidden=true;button.setAttribute('aria-expanded','false');})); document.addEventListener('click',event=>{if(!event.target.closest('.theme-picker')&&menu)menu.hidden=true;}); setTheme(localStorage.getItem('hi-theme')||'minimal'); }
  window.HomeInsightsTheme = { start, setTheme };
})();

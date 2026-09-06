(() => {
  'use strict';
  const pages = new Set(Array.from(document.querySelectorAll('.page')).map(page => page.id));
  const routeFor = id => `#/${pages.has(id) ? id : 'home'}`;
  const pageFromLocation = () => {
    const id = (location.hash || '#/home').replace(/^#\/?/, '').split(/[?&]/)[0];
    return pages.has(id) ? id : 'home';
  };
  const showPage = (id, { updateUrl = true, smooth = true } = {}) => {
    if (!pages.has(id)) id = 'home';
    document.querySelectorAll('.page').forEach(page => page.classList.toggle('active', page.id === id));
    document.querySelectorAll('.bottom-nav [data-page-link]').forEach(button => button.classList.toggle('active', button.dataset.pageLink === id));
    document.body.classList.toggle('cockpit-active', id === 'cockpit');
    document.title = id === 'home' ? 'Home Insights' : `${id.charAt(0).toUpperCase() + id.slice(1)} · Home Insights`;
    if (updateUrl && location.hash !== routeFor(id)) history.pushState(null, '', routeFor(id));
    window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
  };
  document.querySelectorAll('[data-page-link]').forEach(element => element.addEventListener('click', event => {
    event.preventDefault(); showPage(element.dataset.pageLink);
  }));
  window.addEventListener('hashchange', () => showPage(pageFromLocation(), { updateUrl: false, smooth: false }));
  document.querySelectorAll('[data-expand]').forEach(element => element.addEventListener('click', () => {
    const panel = document.getElementById(element.dataset.expand); if (!panel) return;
    const open = panel.classList.toggle('open');
    if (element.classList.contains('expand-card')) element.classList.toggle('open', open);
    document.querySelectorAll('.service-detail').forEach(other => { if (other !== panel) other.classList.remove('open'); });
  }));
  window.HomeInsightsRouter = { showPage, pageFromLocation, routeFor, start: () => showPage(pageFromLocation(), { updateUrl: false, smooth: false }) };
})();

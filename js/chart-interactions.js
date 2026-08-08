(() => {
  'use strict';
  function wire(el){
    if(el.dataset.powershopWired)return;el.dataset.powershopWired='true';
    if(getComputedStyle(el).position==='static')el.style.position='relative';
    const cursor=document.createElement('i');cursor.className='powershop-cursor';cursor.hidden=true;el.appendChild(cursor);
    el.addEventListener('pointermove',e=>{const r=el.getBoundingClientRect();cursor.style.left=`${Math.max(0,Math.min(r.width,e.clientX-r.left))}px`;cursor.hidden=false});
    el.addEventListener('pointerleave',()=>cursor.hidden=true);
    el.addEventListener('wheel',e=>{if(el.scrollWidth>el.clientWidth){e.preventDefault();el.scrollLeft+=e.deltaY||e.deltaX}},{passive:false});
  }
  const wireAll=()=>document.querySelectorAll('.interactive-chart,.gas-chart-shell,.history-scroll-shell').forEach(wire);
  addEventListener('DOMContentLoaded',wireAll);addEventListener('homeinsights:meters-changed',wireAll);window.HomeInsightsChartInteractions={wireAll};
})();

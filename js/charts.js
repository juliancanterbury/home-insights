(() => {
  'use strict';
  const liveSamples = [];
  const charts = new Map();
  const enabledSeries={electricity:new Set(['house','solar','grid','battery'])};
  const css = name => getComputedStyle(document.body).getPropertyValue(name).trim();
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function addLiveSample(sample){
    liveSamples.push({...sample,time:new Date()});
    while(liveSamples.length > 360) liveSamples.shift();
    render('electricity'); render('battery'); render('solar');
  }

  function dailyRows(days){
    const rows = window.HOME_INSIGHTS_DAILY || [];
    return rows.slice(-days);
  }

  function dataFor(type, range){
    if(range === 'live'){
      if(type === 'electricity') return {rows:liveSamples.map(x=>({label:x.time.toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit'}),house:x.house,solar:x.solar,grid:x.grid,battery:x.battery})), series:[['house','House','--text'],['solar','Solar','--solar'],['grid','Grid','--grid'],['battery','Battery','--battery']], unit:'kW'};
      if(type === 'battery') return {rows:liveSamples.map(x=>({label:x.time.toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit'}),soc:x.soc})),series:[['soc','Battery','--battery']],unit:'%'};
      return {rows:liveSamples.map(x=>({label:x.time.toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit'}),solar:x.solar})),series:[['solar','Solar','--solar']],unit:'kW'};
    }
    const days = Number(range) || 30, rows = dailyRows(days);
    if(type === 'electricity') return {rows:rows.map(r=>({label:formatDate(r.date,days),house:+r.loadKwh,solar:+r.solarKwh,grid:+r.importKwh,battery:+r.batteryDischargeKwh})),series:[['house','House','--text'],['solar','Solar','--solar'],['grid','Grid import','--grid'],['battery','Battery','--battery']],unit:'kWh'};
    if(type === 'battery') return {rows:rows.map(r=>({label:formatDate(r.date,days),soc:+r.batterySocEnd})),series:[['soc','Battery','--battery']],unit:'%'};
    if(type === 'solar') return {rows:rows.map(r=>({label:formatDate(r.date,days),solar:+r.solarKwh})),series:[['solar','Solar','--solar']],unit:'kWh'};
    return {rows:rows.map(r=>({label:formatDate(r.date,days),electricity:+r.electricityTotal,gas:+r.gasTotal,water:+r.waterTotal})),series:[['electricity','Electricity','--grid'],['gas','Gas','--gas'],['water','Water','--water']],unit:'$'};
  }
  function formatDate(value,days){const d=new Date(value+'T12:00:00');return days>90?d.toLocaleDateString('en-AU',{month:'short',year:'2-digit'}):d.toLocaleDateString('en-AU',{day:'numeric',month:'short'});}

  function render(type){
    const state=charts.get(type); if(!state) return;
    const el=document.getElementById(type+'Chart'); if(!el) return;
    const d=dataFor(type,state.range); if(enabledSeries[type]) d.series=d.series.filter(([k])=>enabledSeries[type].has(k)); const rows=d.rows.filter(r=>d.series.some(([k])=>Number.isFinite(r[k])));
    if(rows.length<2){el.innerHTML=`<div class="chart-empty"><div><strong>${state.range==='live'?'Collecting live readings':'No historical data yet'}</strong><span>${state.range==='live'?'The graph will build while this page is open.':'The graph will appear when the daily ledger is connected.'}</span></div></div>`;return;}
    const W=1000,H=300,p={l:48,r:18,t:18,b:36};
    const values=[]; rows.forEach(r=>d.series.forEach(([k])=>{if(Number.isFinite(r[k])) values.push(r[k])}));
    let min=Math.min(...values),max=Math.max(...values); if(type!=='electricity'||state.range!=='live') min=Math.min(0,min); if(max===min) max=min+1;
    const x=i=>p.l+(i/(rows.length-1))*(W-p.l-p.r), y=v=>p.t+(max-v)/(max-min)*(H-p.t-p.b);
    let svg=`<svg viewBox="0 0 ${W} ${H}" role="img">`;
    for(let i=0;i<5;i++){const yy=p.t+i*(H-p.t-p.b)/4,val=max-i*(max-min)/4;svg+=`<line class="chart-grid" x1="${p.l}" x2="${W-p.r}" y1="${yy}" y2="${yy}"/><text class="chart-axis-text" x="${p.l-8}" y="${yy+4}" text-anchor="end">${formatVal(val,d.unit)}</text>`;}
    const step=Math.max(1,Math.ceil(rows.length/6)); rows.forEach((r,i)=>{if(i%step===0||i===rows.length-1)svg+=`<text class="chart-axis-text" x="${x(i)}" y="${H-10}" text-anchor="middle">${esc(r.label)}</text>`});
    d.series.forEach(([key,label,varName])=>{const pts=rows.map((r,i)=>Number.isFinite(r[key])?`${x(i)},${y(r[key])}`:null).filter(Boolean);if(!pts.length)return;const color=css(varName);svg+=`<polyline class="chart-line" style="stroke:${color}" points="${pts.join(' ')}"/>`;});
    rows.forEach((r,i)=>svg+=`<rect class="chart-hit" data-i="${i}" x="${Math.max(p.l,x(i)-(W-p.l-p.r)/rows.length/2)}" y="${p.t}" width="${Math.max(8,(W-p.l-p.r)/rows.length)}" height="${H-p.t-p.b}" fill="transparent"/>`);
    svg+=`</svg><div class="chart-tooltip" hidden></div>`;el.innerHTML=svg;
    const tip=el.querySelector('.chart-tooltip'); el.querySelectorAll('.chart-hit').forEach(hit=>{const show=e=>{const i=+hit.dataset.i,r=rows[i];tip.innerHTML=`<b>${esc(r.label)}</b>`+d.series.filter(([k])=>Number.isFinite(r[k])).map(([k,l])=>`<div><span>${l}</span><strong>${formatVal(r[k],d.unit)}</strong></div>`).join('');tip.hidden=false;tip.style.left=`${x(i)/W*100}%`;tip.style.top=`${y(Math.max(...d.series.map(([k])=>Number.isFinite(r[k])?r[k]:min)))/H*100}%`;};hit.addEventListener('pointerenter',show);hit.addEventListener('pointermove',show);hit.addEventListener('pointerleave',()=>tip.hidden=true);hit.addEventListener('click',show);});
  }
  function formatVal(v,unit){if(unit==='$')return new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:2}).format(v);return `${Math.abs(v)>=10?v.toFixed(1):v.toFixed(2)} ${unit}`;}
  function init(){document.querySelectorAll('[data-series-toggle]').forEach(group=>group.querySelectorAll('button[data-series]').forEach(btn=>btn.addEventListener('click',()=>{const type=group.dataset.seriesToggle,key=btn.dataset.series,set=enabledSeries[type];if(set.has(key)&&set.size>1){set.delete(key);btn.classList.remove('active')}else{set.add(key);btn.classList.add('active')}render(type)})));document.querySelectorAll('[data-chart-range]').forEach(group=>{const type=group.dataset.chartRange;charts.set(type,{range:group.querySelector('.active')?.dataset.range||'30'});group.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>{group.querySelectorAll('button').forEach(b=>b.classList.remove('active'));btn.classList.add('active');charts.get(type).range=btn.dataset.range;render(type);}));render(type);});}
  window.HomeInsightsCharts={init,renderAll:()=>charts.forEach((_,k)=>render(k)),addLiveSample};
})();

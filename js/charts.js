(() => {
'use strict';
const liveSamples=[]; const charts=new Map();
const enabledSeries={electricity:new Set(['import','export'])};
const history=()=>window.HOME_INSIGHTS_ELECTRICITY_HISTORY||{daily:[],monthly:[],yearly:[]};
const css=n=>getComputedStyle(document.body).getPropertyValue(n).trim();
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function addLiveSample(sample){liveSamples.push({...sample,time:new Date(sample.time||Date.now())});while(liveSamples.length>1440)liveSamples.shift();renderLive();render('battery');render('solar');}
function fmtDate(v,kind){const d=new Date(v+(v.length===7?'-01':'T12:00:00'));return kind==='month'?d.toLocaleDateString('en-AU',{month:'short',year:'2-digit'}):d.toLocaleDateString('en-AU',{day:'numeric',month:'short'});}
function electricityData(range){const h=history();let source,kind;if(range==='7'){source=h.daily.slice(-7);kind='day'}else if(range==='30'){source=h.daily.slice(-30);kind='day'}else if(range==='365'){source=h.daily.slice(-365);kind='day'}else if(range.startsWith('year:')){const yr=range.split(':')[1];source=h.daily.filter(r=>String(r.date).startsWith(yr));kind='day'}else{source=h.monthly;kind='month'}const coverage=range==='all'?'Jan 2019 – Sep 2025':range==='365'?'Latest 365 recorded days':range.startsWith('year:')?range.split(':')[1]:range==='7'?'Latest 7 recorded days':'Latest 30 recorded days';return{rows:source.map(r=>({label:kind==='month'?fmtDate(r.month,'month'):fmtDate(r.date,'day'),import:+r.importKwh,export:+r.exportKwh,net:+r.importKwh-(+r.exportKwh)})),unit:'kWh',coverage};}
function genericData(type,range){const rows=(window.HOME_INSIGHTS_DAILY||[]).slice(-(Number(range)||30));if(type==='battery')return{rows:range==='live'?liveSamples.map(x=>({label:x.time.toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit'}),soc:x.soc})):rows.map(r=>({label:fmtDate(r.date,'day'),soc:+r.batterySocEnd})),series:[['soc','Battery','--battery']],unit:'%'};if(type==='solar')return{rows:range==='live'?liveSamples.map(x=>({label:x.time.toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit'}),solar:x.solar})):rows.map(r=>({label:fmtDate(r.date,'day'),solar:+r.solarKwh})),series:[['solar','Solar','--solar']],unit:range==='live'?'kW':'kWh'};return{rows:rows.map(r=>({label:fmtDate(r.date,'day'),electricity:+r.electricityTotal,gas:+r.gasTotal,water:+r.waterTotal})),series:[['electricity','Electricity','--grid'],['gas','Gas','--gas'],['water','Water','--water']],unit:'$'};}
function smoothPath(points){if(points.length<2)return'';let d=`M ${points[0][0]} ${points[0][1]}`;for(let i=1;i<points.length;i++){const [x0,y0]=points[i-1],[x1,y1]=points[i],mx=(x0+x1)/2;d+=` C ${mx} ${y0}, ${mx} ${y1}, ${x1} ${y1}`;}return d;}
function renderLive(){const el=document.getElementById('electricityLiveChart');if(!el)return;const rows=liveSamples.map(x=>({label:x.time.toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit'}),solar:Math.max(0,x.solar||0),battery:-(x.battery||0),grid:x.grid||0,load:-(x.house||0)}));if(rows.length<2){el.innerHTML='<div class="chart-empty"><div><strong>Collecting today’s live readings</strong><span>The Sigenergy-style chart will draw as Home Assistant samples arrive.</span></div></div>';return;}const series=[['solar','Solar','--solar'],['battery','Battery','--battery'],['grid','Grid','--grid'],['load','Load','--load']];const W=1100,H=430,p={l:62,r:24,t:30,b:48};const vals=[];rows.forEach(r=>series.forEach(([k])=>vals.push(r[k])));let abs=Math.max(1,...vals.map(Math.abs));abs=Math.ceil(abs);const min=-abs,max=abs,x=i=>p.l+(i/(rows.length-1))*(W-p.l-p.r),y=v=>p.t+(max-v)/(max-min)*(H-p.t-p.b),base=y(0);let svg=`<svg viewBox="0 0 ${W} ${H}" role="img"><defs>`;series.forEach(([k,l,v])=>{const c=css(v);svg+=`<linearGradient id="live-${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity=".30"/><stop offset=".5" stop-color="${c}" stop-opacity=".08"/><stop offset="1" stop-color="${c}" stop-opacity=".24"/></linearGradient>`});svg+='</defs>';for(let i=0;i<7;i++){const yy=p.t+i*(H-p.t-p.b)/6,val=max-i*(max-min)/6;svg+=`<line class="chart-grid" x1="${p.l}" x2="${W-p.r}" y1="${yy}" y2="${yy}"/><text class="chart-axis-text" x="${p.l-10}" y="${yy+4}" text-anchor="end">${val.toFixed(0)}</text>`}svg+=`<line class="zero-line" x1="${p.l}" x2="${W-p.r}" y1="${base}" y2="${base}"/>`;const tick=Math.max(1,Math.ceil(rows.length/7));rows.forEach((r,i)=>{if(i%tick===0||i===rows.length-1)svg+=`<text class="chart-axis-text" x="${x(i)}" y="${H-14}" text-anchor="middle">${esc(r.label)}</text>`});series.forEach(([k,l,v])=>{const pts=rows.map((r,i)=>[x(i),y(r[k])]);const path=smoothPath(pts),color=css(v);svg+=`<path class="chart-area" d="${path} L ${pts.at(-1)[0]} ${base} L ${pts[0][0]} ${base} Z" fill="url(#live-${k})"/><path class="chart-smooth-line" style="stroke:${color}" d="${path}"/>`;});rows.forEach((r,i)=>svg+=`<rect class="chart-hit" data-i="${i}" x="${Math.max(p.l,x(i)-(W-p.l-p.r)/rows.length/2)}" y="${p.t}" width="${Math.max(8,(W-p.l-p.r)/rows.length)}" height="${H-p.t-p.b}" fill="transparent"/>`);svg+='</svg><div class="chart-crosshair" hidden></div><div class="chart-tooltip" hidden></div>';el.innerHTML=svg;wireTooltip(el,rows,series,'kW',x,W);}

function wireMomentumScroll(shell){
  if(!shell || shell.dataset.momentumReady==='1') return;
  shell.dataset.momentumReady='1';
  let dragging=false, moved=false, startX=0, lastX=0, lastT=0, velocity=0, frame=0;
  const stop=()=>{ if(frame) cancelAnimationFrame(frame); frame=0; };
  const coast=()=>{
    stop();
    const step=()=>{
      velocity*=0.94;
      if(Math.abs(velocity)<0.08){ frame=0; return; }
      shell.scrollLeft-=velocity*16;
      frame=requestAnimationFrame(step);
    };
    frame=requestAnimationFrame(step);
  };
  shell.addEventListener('pointerdown',e=>{
    if(e.button!==0) return;
    stop(); dragging=true; moved=false; velocity=0;
    startX=lastX=e.clientX; lastT=performance.now();
    shell.classList.add('is-dragging');
    shell.setPointerCapture?.(e.pointerId);
  });
  shell.addEventListener('pointermove',e=>{
    if(!dragging) return;
    const now=performance.now(), dx=e.clientX-lastX, dt=Math.max(8,now-lastT);
    if(Math.abs(e.clientX-startX)>4) moved=true;
    shell.scrollLeft-=dx;
    velocity=dx/dt;
    lastX=e.clientX; lastT=now;
    e.preventDefault();
  },{passive:false});
  const end=e=>{
    if(!dragging) return;
    dragging=false; shell.classList.remove('is-dragging');
    try{ shell.releasePointerCapture?.(e.pointerId); }catch(_){ }
    velocity*=18;
    coast();
  };
  shell.addEventListener('pointerup',end);
  shell.addEventListener('pointercancel',end);
  shell.addEventListener('mouseleave',e=>{ if(dragging) end(e); });
  shell.addEventListener('click',e=>{ if(moved){ e.preventDefault(); e.stopPropagation(); moved=false; } },true);
  shell.addEventListener('wheel',e=>{
    if(Math.abs(e.deltaY)>Math.abs(e.deltaX)){
      shell.scrollLeft+=e.deltaY;
      e.preventDefault();
    }
  },{passive:false});
}

function renderHistory(el,d,series){const rows=d.rows.filter(r=>series.some(([k])=>Number.isFinite(r[k])));if(!rows.length){el.innerHTML='<div class="chart-empty"><div><strong>No historical data</strong></div></div>';return;}const barW=rows.length>400?10:rows.length>120?14:rows.length>45?22:32,gap=4,W=Math.max(1050,80+rows.length*(barW+gap)),H=390,p={l:62,r:20,t:26,b:52};let max=Math.max(1,...rows.flatMap(r=>series.map(([k])=>Math.max(0,r[k]||0))));const y=v=>p.t+(max-v)/max*(H-p.t-p.b),base=H-p.b;let svg=`<svg viewBox="0 0 ${W} ${H}" style="width:${W}px" role="img">`;for(let i=0;i<5;i++){const yy=p.t+i*(H-p.t-p.b)/4,val=max-i*max/4;svg+=`<line class="chart-grid" x1="${p.l}" x2="${W-p.r}" y1="${yy}" y2="${yy}"/><text class="chart-axis-text" x="${p.l-10}" y="${yy+4}" text-anchor="end">${formatVal(val,d.unit)}</text>`}rows.forEach((r,i)=>{const gx=p.l+i*(barW+gap);let slot=barW/series.length;series.forEach(([k,l,v],si)=>{const val=Math.max(0,r[k]||0),h=Math.max(1,base-y(val));svg+=`<rect class="history-bar" data-i="${i}" x="${gx+si*slot}" y="${base-h}" width="${Math.max(3,slot-2)}" height="${h}" rx="3" style="fill:${css(v)}"/>`});const labelEvery=Math.max(1,Math.ceil(rows.length/24));if(i%labelEvery===0||i===rows.length-1)svg+=`<text class="chart-axis-text" x="${gx+barW/2}" y="${H-17}" text-anchor="middle">${esc(r.label)}</text>`});svg+='</svg><div class="chart-tooltip" hidden></div>';el.innerHTML=svg;const tip=el.querySelector('.chart-tooltip');el.querySelectorAll('.history-bar').forEach(hit=>{const show=()=>{const r=rows[+hit.dataset.i];tip.innerHTML=`<b>${esc(r.label)}</b>`+series.map(([k,l])=>`<div><span>${l}</span><strong>${formatVal(r[k],d.unit)}</strong></div>`).join('');tip.hidden=false;tip.style.left=Math.min(85,((+hit.getAttribute('x'))/W)*100)+'%';tip.style.top='12%'};hit.addEventListener('pointerenter',show);hit.addEventListener('pointerleave',()=>tip.hidden=true);hit.addEventListener('click',show)});requestAnimationFrame(()=>{const shell=el.closest('.history-scroll-shell');if(shell){wireMomentumScroll(shell);shell.scrollLeft=shell.scrollWidth;}}); }
function wireTooltip(el,rows,series,unit,x,W){const tip=el.querySelector('.chart-tooltip'),cross=el.querySelector('.chart-crosshair');el.querySelectorAll('.chart-hit').forEach(hit=>{const show=()=>{const i=+hit.dataset.i,r=rows[i];tip.innerHTML=`<b>${esc(r.label)}</b>`+series.map(([k,l])=>`<div><span>${l}</span><strong>${formatVal(r[k],unit)}</strong></div>`).join('');tip.hidden=false;cross.hidden=false;const pct=x(i)/W*100;tip.style.left=`${pct}%`;tip.style.top='12%';cross.style.left=`${pct}%`};hit.addEventListener('pointerenter',show);hit.addEventListener('pointermove',show);hit.addEventListener('pointerleave',()=>{tip.hidden=true;cross.hidden=true});hit.addEventListener('click',show)});}
function render(type){const state=charts.get(type);if(!state)return;const el=document.getElementById(type+'Chart');if(!el)return;let d,series;if(type==='electricity'){d=electricityData(state.range);const all=[['import','Import','--grid'],['export','Export','--solar'],['net','Net grid','--battery']];series=all.filter(([k])=>enabledSeries.electricity.has(k));updateKpis(d.rows,d.coverage,d.unit);renderHistory(el,d,series);return;}d=genericData(type,state.range);series=d.series;const rows=d.rows.filter(r=>series.some(([k])=>Number.isFinite(r[k])));if(rows.length<2){el.innerHTML='<div class="chart-empty"><div><strong>Collecting readings</strong></div></div>';return;}const W=1100,H=360,p={l:60,r:24,t:28,b:46};const vals=[];rows.forEach(r=>series.forEach(([k])=>vals.push(r[k])));let min=Math.min(0,...vals),max=Math.max(0,...vals);if(max===min)max=min+1;const x=i=>p.l+(i/(rows.length-1))*(W-p.l-p.r),y=v=>p.t+(max-v)/(max-min)*(H-p.t-p.b);let svg=`<svg viewBox="0 0 ${W} ${H}">`;for(let i=0;i<5;i++){const yy=p.t+i*(H-p.t-p.b)/4;svg+=`<line class="chart-grid" x1="${p.l}" x2="${W-p.r}" y1="${yy}" y2="${yy}"/>`}series.forEach(([k,l,v])=>{const pts=rows.map((r,i)=>[x(i),y(r[k])]);svg+=`<path class="chart-smooth-line" style="stroke:${css(v)}" d="${smoothPath(pts)}"/>`});svg+='</svg>';el.innerHTML=svg;}
function updateKpis(rows,coverage,unit){if(!document.getElementById('historyImport'))return;const imp=rows.reduce((s,r)=>s+(Number.isFinite(r.import)?r.import:0),0),exp=rows.reduce((s,r)=>s+(Number.isFinite(r.export)?r.export:0),0);document.getElementById('historyImport').textContent=`${imp.toLocaleString('en-AU',{maximumFractionDigits:1})} ${unit}`;document.getElementById('historyExport').textContent=`${exp.toLocaleString('en-AU',{maximumFractionDigits:1})} ${unit}`;document.getElementById('historyNet').textContent=`${(imp-exp).toLocaleString('en-AU',{maximumFractionDigits:1})} ${unit}`;document.getElementById('historyCoverage').textContent=coverage;}
function formatVal(v,u){if(u==='$')return new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:2}).format(v);return`${Math.abs(v)>=100?Math.round(v).toLocaleString('en-AU'):Math.abs(v)>=10?v.toFixed(1):v.toFixed(2)} ${u}`;}
function init(){renderLive();document.querySelectorAll('[data-series-toggle]').forEach(g=>g.querySelectorAll('button[data-series]').forEach(btn=>btn.addEventListener('click',()=>{const set=enabledSeries[g.dataset.seriesToggle],k=btn.dataset.series;if(set.has(k)){if(set.size>1){set.delete(k);btn.classList.remove('active')}}else{set.add(k);btn.classList.add('active')}render(g.dataset.seriesToggle)})));document.querySelectorAll('[data-chart-range]').forEach(g=>{const type=g.dataset.chartRange;charts.set(type,{range:g.querySelector('.active')?.dataset.range||'30'});g.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll(`[data-chart-range="${type}"] button,[data-chart-range-secondary="${type}"] button`).forEach(b=>b.classList.remove('active'));btn.classList.add('active');charts.get(type).range=btn.dataset.range;render(type)}));render(type)});document.querySelectorAll('[data-chart-range-secondary]').forEach(g=>{const type=g.dataset.chartRangeSecondary;g.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll(`[data-chart-range="${type}"] button,[data-chart-range-secondary="${type}"] button`).forEach(b=>b.classList.remove('active'));btn.classList.add('active');charts.get(type).range=btn.dataset.range;render(type)}))});}
window.HomeInsightsCharts={init,renderAll:()=>{renderLive();charts.forEach((_,k)=>render(k))},addLiveSample};
})();

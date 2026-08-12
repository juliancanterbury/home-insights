(() => {
  'use strict';
  const { $, money } = window.HomeInsights;
  const meterKey = 'home-insights-meter-readings';
  const settingsKey = 'home-insights-water-v2-settings';
  const tariffRevision = 'yvw-2026-06-22';
  const defaults = { range:'90', usageRate:3.5724, serviceDaily:142.30/91, tariffRevision };
  const officialReadings = [
    {id:'water-bill-2026-03-23',kind:'water',value:1947,date:'2026-03-23T12:00:00+11:00',source:'bill-actual',verified:true},
    {id:'water-bill-2026-06-19',kind:'water',value:1976,date:'2026-06-19T12:00:00+10:00',source:'bill-actual',verified:true}
  ];
  const officialBill = {startId:'water-bill-2026-03-23',endId:'water-bill-2026-06-19',days:88,litres:29000,usageCost:103.60,serviceDays:91,serviceCost:142.30};
  const settings = (() => { try { const saved=JSON.parse(localStorage.getItem(settingsKey)||'{}'); if(saved.tariffRevision!==tariffRevision){if(saved.usageRate===null||saved.usageRate===undefined)saved.usageRate=defaults.usageRate;if(saved.serviceDaily===null||saved.serviceDaily===undefined)saved.serviceDaily=defaults.serviceDaily;saved.tariffRevision=tariffRevision;}return {...defaults,...saved}; } catch { return {...defaults}; } })();
  const saveSettings = () => localStorage.setItem(settingsKey, JSON.stringify(settings));
  const readAll = () => { try { return JSON.parse(localStorage.getItem(meterKey) || '[]'); } catch { return []; } };
  function ensureOfficialReadings(){const rows=readAll();officialReadings.forEach(official=>{const existing=rows.find(row=>row.id===official.id);if(existing)Object.assign(existing,official);else rows.push({...official});});localStorage.setItem(meterKey,JSON.stringify(rows));}
  const readings = () => readAll().filter(row => row.kind === 'water' && Number.isFinite(Number(row.value)) && !Number.isNaN(new Date(row.date).getTime())).map(row => ({...row,value:Number(row.value),time:new Date(row.date)})).sort((a,b)=>a.time-b.time);
  const configured = () => Number.isFinite(Number(settings.usageRate)) && Number.isFinite(Number(settings.serviceDaily));
  const fmtDate = date => date.toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'});
  const dateKey = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;

  function intervals() {
    const rows=readings(), result=[];
    for(let i=1;i<rows.length;i++){
      const start=rows[i-1],end=rows[i],days=(end.time-start.time)/86400000,units=end.value-start.value;
      if(!(days>0)||units<0)continue;
      const isOfficial=start.id===officialBill.startId&&end.id===officialBill.endId;
      const litres=isOfficial?officialBill.litres:units*1000,dailyLitres=litres/(isOfficial?officialBill.days:days);
      const dailyCost=isOfficial?(officialBill.usageCost+officialBill.serviceCost)/officialBill.serviceDays:(configured()?dailyLitres/1000*Number(settings.usageRate)+Number(settings.serviceDaily):null);
      result.push({start,end,days:isOfficial?officialBill.days:days,units:isOfficial?officialBill.litres/1000:units,litres,dailyLitres,dailyCost,type:isOfficial?'bill':'manual'});
    }
    return result;
  }
  function dailyRows(){
    const rows=[];
    intervals().forEach(interval=>{const cursor=new Date(interval.start.time);cursor.setHours(12,0,0,0);const end=new Date(interval.end.time);end.setHours(12,0,0,0);while(cursor<end){rows.push({date:new Date(cursor),litres:interval.dailyLitres,cost:interval.dailyCost,source:'manual',averagingDays:interval.days});cursor.setDate(cursor.getDate()+1);}});
    return rows;
  }
  function estimateForDate(value,useLatest=true){const rows=dailyRows();if(!rows.length||!configured())return null;const exact=rows.find(row=>dateKey(row.date)===String(value||'').slice(0,10));const row=exact||(useLatest?rows.at(-1):null);return row?{...row,isLatestEstimate:!exact}:null;}
  function renderSummary(){
    const spans=intervals(),latest=spans.at(-1),previous=spans.at(-2),rows=readings();
    $('waterCoverage').textContent=rows.length<2?`${rows.length} reading saved · one more creates the first interval`:`${rows.length} readings · ${fmtDate(rows[0].time)} – ${fmtDate(rows.at(-1).time)}`;
    if(!latest){$('waterLatestDaily').textContent='—';$('waterLatestPeriod').textContent='Waiting for two readings';$('waterLatestUsed').textContent='—';$('waterLatestCost').textContent='—';$('waterLatestChange').textContent='—';return;}
    $('waterLatestDaily').textContent=`${latest.dailyLitres.toFixed(0)} L/day`;
    $('waterLatestPeriod').textContent=`${fmtDate(latest.start.time)} – ${fmtDate(latest.end.time)} · ${latest.days.toFixed(latest.days<10?1:0)} days`;
    $('waterLatestUsed').textContent=latest.litres>=1000?`${latest.units.toFixed(3)} kL`:`${latest.litres.toFixed(0)} L`;
    $('waterLatestCost').textContent=latest.dailyCost===null?'—':money(latest.dailyCost);
    $('waterCostNote').textContent=latest.dailyCost===null?'Set tariff to calculate':'usage + daily service';
    $('waterLatestChange').textContent=previous&&previous.dailyLitres>0?`${latest.dailyLitres>=previous.dailyLitres?'+':''}${((latest.dailyLitres/previous.dailyLitres-1)*100).toFixed(0)}%`:'Baseline';
  }
  function renderReadings(){
    const rows=readings().slice().reverse();
    $('waterReadingList').innerHTML=rows.length?rows.map(row=>{const photo=row.hasPhoto||row.source==='manual-with-photo',bill=row.source==='bill-actual';const audit=row.ocrOriginal?` · OCR: ${row.ocrOriginal}`:row.ocrAttempted?' · OCR: no result':'';return `<div class="gas-reading-row${photo?' has-photo':''}"><div>${photo?`<button type="button" class="meter-photo-thumb is-loading" data-meter-photo="${row.id}" aria-label="Open saved meter photo"></button>`:''}<strong>${row.value.toLocaleString('en-AU',{maximumFractionDigits:4})} kL</strong><small>${fmtDate(row.time)} · ${bill?'actual bill':`corrected/manual${audit}`}</small></div><div>${bill?'<span class="gas-verified">Verified</span>':`<button data-water-edit="${row.id}">Edit</button><button data-water-delete="${row.id}">Delete</button>`}</div></div>`}).join(''):'<div class="gas-empty"><strong>No water readings yet</strong><span>Drop a water meter photo or add a reading manually.</span></div>';
    window.HomeInsightsLocalData?.hydratePhotoThumbnails($('waterReadingList'));
    document.querySelectorAll('[data-water-delete]').forEach(button=>button.addEventListener('click',async()=>{if(!confirm('Delete this water meter reading?'))return;const deletedId=button.dataset.waterDelete;await window.HomeInsightsLocalData?.deleteReadingPhoto(deletedId);localStorage.setItem(meterKey,JSON.stringify(readAll().filter(row=>row.id!==deletedId)));window.HomeInsightsLocalData?.renderMeters();window.dispatchEvent(new CustomEvent('homeinsights:meters-changed',{detail:{deletedId}}));}));
    document.querySelectorAll('[data-water-edit]').forEach(button=>button.addEventListener('click',()=>{const all=readAll(),row=all.find(item=>item.id===button.dataset.waterEdit),next=prompt('Correct the cumulative water meter reading (kL):',row?.value);if(next===null||!row)return;const value=Number(next.trim().replace(',','.'));if(!Number.isFinite(value)||value<0)return alert('Enter a valid meter reading.');row.value=value;row.correctedReading=value;row.updatedAt=new Date().toISOString();localStorage.setItem(meterKey,JSON.stringify(all));window.HomeInsightsLocalData?.renderMeters();window.dispatchEvent(new CustomEvent('homeinsights:meters-changed'));}));
  }
  function renderChart(){let rows=dailyRows();if(settings.range!=='all')rows=rows.slice(-Number(settings.range));if(!rows.length){$('waterChart').innerHTML='<div class="gas-empty"><strong>Two readings make the first interval</strong><span>Daily litres will appear here after the next reading.</span></div>';return;}const ppd=settings.range==='all'?.65:settings.range==='365'?3.2:settings.range==='90'?8:22,width=Math.max(760,Math.round(rows.length*ppd)),height=292,left=48,right=24,top=18,bottom=57,max=Math.max(...rows.map(r=>r.litres),1),plotH=height-top-bottom,plotW=width-left-right,points=rows.map((r,i)=>`${left+i/Math.max(rows.length-1,1)*plotW},${top+plotH-r.litres/max*plotH}`).join(' '),ticks=[0,.25,.5,.75,1].map(n=>{const y=top+plotH-n*plotH;return `<line x1="${left}" y1="${y}" x2="${width-right}" y2="${y}"/><text x="${left-9}" y="${y+4}">${(max*n).toFixed(0)}</text>`}).join(''),labels=rows.map((r,i)=>({r,i})).filter(({r,i})=>i===0||i===rows.length-1||(settings.range==='all'?r.date.getMonth()===0&&r.date.getDate()===1:i%(settings.range==='365'?30:settings.range==='90'?14:7)===0)).map(({r,i})=>{const x=left+i/Math.max(rows.length-1,1)*plotW;return `<g class="gas-date-tick"><line x1="${x}" y1="${top+plotH}" x2="${x}" y2="${top+plotH+6}"/><text class="gas-x-label" x="${x}" y="${height-28}">${settings.range==='all'?r.date.getFullYear():r.date.toLocaleDateString('en-AU',{day:'numeric',month:'short'})}</text></g>`}).join('');$('waterChart').innerHTML=`<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><g class="gas-grid">${ticks}</g><polygon class="gas-area" points="${left},${top+plotH} ${points} ${left+plotW},${top+plotH}"/><polyline class="gas-line" points="${points}"/>${labels}</svg>`;$('waterChart').scrollLeft=$('waterChart').scrollWidth;}
  function render(){renderSummary();renderReadings();renderChart();}
  function start(){
    ensureOfficialReadings();saveSettings();
    $('waterUsageRate').value=settings.usageRate??'';$('waterServiceDaily').value=settings.serviceDaily??'';
    [['waterUsageRate','usageRate'],['waterServiceDaily','serviceDaily']].forEach(([id,key])=>$(id).addEventListener('change',event=>{settings[key]=event.target.value===''?null:Number(event.target.value);saveSettings();render();window.dispatchEvent(new CustomEvent('homeinsights:water-data-ready'));}));
    document.querySelectorAll('[data-water-range]').forEach(button=>{button.classList.toggle('active',button.dataset.waterRange===settings.range);button.addEventListener('click',()=>{settings.range=button.dataset.waterRange;saveSettings();document.querySelectorAll('[data-water-range]').forEach(item=>item.classList.toggle('active',item===button));renderChart();});});
    $('waterTariffStatus').textContent='Verified from Yarra Valley Water bill issued 22 Jun 2026. Usage $3.5724/kL; fixed water and sewer services averaged at $1.5637/day. Authority charges excluded.';
    window.addEventListener('homeinsights:meters-changed',()=>{render();window.dispatchEvent(new CustomEvent('homeinsights:water-data-ready'));});window.addEventListener('storage',event=>{if(event.key===meterKey||event.key===settingsKey)render();});render();window.dispatchEvent(new CustomEvent('homeinsights:water-data-ready'));
  }
  window.HomeInsightsWaterV2={start,render,intervals,dailyRows,estimateForDate};
})();

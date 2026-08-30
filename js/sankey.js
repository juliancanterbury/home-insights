(() => {
  'use strict';
  const cfg=window.HOME_INSIGHTS_CONFIG||{};
  let flow=null;
  const fmt=v=>`${Number(v||0).toFixed(Number(v||0)>=10?1:2)} kWh`;
  function dayKey(d=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:cfg.timezone||'Australia/Melbourne',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)}
  function band(x1,y1,x2,y2,w,color){const c=(x2-x1)*.48;return `<path class="sankey-band" d="M ${x1} ${y1} C ${x1+c} ${y1}, ${x2-c} ${y2}, ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="${Math.max(2,w)}" stroke-linecap="butt"/>`}
  
  function node(x,y,w,h,label,value,fill){return `<g><rect class="sankey-node" x="${x}" y="${y}" width="${w}" height="${h}" rx="13" fill="${fill}"/><text class="sankey-node-label" x="${x+14}" y="${y+25}">${label}</text><text class="sankey-node-value" x="${x+14}" y="${y+52}">${value.toFixed(value>=10?1:2)}</text><text class="sankey-node-unit" x="${x+14}" y="${y+70}">kWh</text></g>`}
  function normalise(row){
    if(!row)return null;
    return {date:String(row.date||''),solarHouse:+row.solarHouse||0,solarBattery:+row.solarBattery||0,solarGrid:+row.solarGrid||0,gridHouse:+row.gridHouse||0,gridBattery:+row.gridBattery||0,batteryHouse:+row.batteryHouse||0,dataQuality:row.dataQuality||'',source:row.source||''};
  }
  function setFlow(row){flow=normalise(row);render();}
  function render(){
    const el=document.getElementById('energySankey'); if(!el)return;
    const f=flow||normalise({date:dayKey()});
    const ids={flowSolarHouse:'solarHouse',flowSolarBattery:'solarBattery',flowSolarGrid:'solarGrid',flowGridHouse:'gridHouse',flowGridBattery:'gridBattery',flowBatteryHouse:'batteryHouse'};
    Object.entries(ids).forEach(([id,k])=>{const n=document.getElementById(id);if(n)n.textContent=fmt(f[k])});
    const status=document.getElementById('sankeyStatus');
    if(status){const label=f.date?new Date(f.date+'T12:00:00').toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'}):'Selected day';status.textContent=`${label}${f.dataQuality?' · '+f.dataQuality:''}${f.source?' · '+f.source:''}`;}
    const total=f.solarHouse+f.solarBattery+f.solarGrid+f.gridHouse+f.gridBattery+f.batteryHouse;
    if(total<.002){el.innerHTML='<div class="sankey-empty"><div><strong>No flow record for this day</strong>Choose another date, or finish the Sigenergy history import in the shared backend.</div></div>';return}
    const W=920,H=390,nodeW=130,lx=34,rx=W-nodeW-34;
    const sourceTotals={solar:f.solarHouse+f.solarBattery+f.solarGrid,grid:f.gridHouse+f.gridBattery,battery:f.batteryHouse};
    const destTotals={house:f.solarHouse+f.gridHouse+f.batteryHouse,battery:f.solarBattery+f.gridBattery,grid:f.solarGrid};
    const maxTotal=Math.max(...Object.values(sourceTotals),...Object.values(destTotals),1),scale=150/maxTotal;
    const sources={solar:{y:35,h:Math.max(72,sourceTotals.solar*scale)},grid:{y:155,h:Math.max(72,sourceTotals.grid*scale)},battery:{y:275,h:Math.max(72,sourceTotals.battery*scale)}};
    const dests={house:{y:35,h:Math.max(72,destTotals.house*scale)},battery:{y:155,h:Math.max(72,destTotals.battery*scale)},grid:{y:275,h:Math.max(72,destTotals.grid*scale)}};
    const srcOff={solar:0,grid:0,battery:0},dstOff={house:0,battery:0,grid:0};
    const styles=getComputedStyle(document.documentElement),colors={solar:styles.getPropertyValue('--solar').trim(),grid:styles.getPropertyValue('--grid').trim(),battery:styles.getPropertyValue('--battery').trim()};
    const links=[['solar','house',f.solarHouse,colors.solar],['solar','battery',f.solarBattery,'#73d9a5'],['solar','grid',f.solarGrid,'#b6d95e'],['grid','house',f.gridHouse,colors.grid],['grid','battery',f.gridBattery,'#718ee9'],['battery','house',f.batteryHouse,colors.battery]];
    let paths='';
    links.forEach(([a,b,v,c])=>{if(v<=.0001)return;const sw=Math.max(3,v*scale),sy=sources[a].y+13+srcOff[a]+sw/2,dy=dests[b].y+13+dstOff[b]+sw/2;srcOff[a]+=sw+2;dstOff[b]+=sw+2;paths+=band(lx+nodeW,sy,rx,dy,sw,c)});
    el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Energy flows in kilowatt-hours">${paths}${node(lx,sources.solar.y,nodeW,sources.solar.h,'Solar',sourceTotals.solar,'#25462e')}${node(lx,sources.grid.y,nodeW,sources.grid.h,'Grid in',sourceTotals.grid,'#26305b')}${node(lx,sources.battery.y,nodeW,sources.battery.h,'Battery out',sourceTotals.battery,'#174b4c')}${node(rx,dests.house.y,nodeW,dests.house.h,'House',destTotals.house,'#4d285f')}${node(rx,dests.battery.y,nodeW,dests.battery.h,'Battery in',destTotals.battery,'#16494a')}${node(rx,dests.grid.y,nodeW,dests.grid.h,'Grid out',destTotals.grid,'#3b3158')}</svg>`;
  }
  async function loadDate(date){
    const status=document.getElementById('sankeyStatus');if(status)status.textContent='Loading shared history…';
    try{const j=await window.HomeInsightsApi.request(cfg.sharedApi,{action:'day',date});if(!j.ok)throw new Error(j.error||'Backend error');setFlow(j.day||j.today);}
    catch(err){if(status)status.textContent=`History unavailable · ${err.message}`;setFlow({date});}
  }
  window.addEventListener('homeinsights:shared-day',e=>{const picker=document.getElementById('sankeyDate');if(!picker||picker.value===dayKey())setFlow(e.detail)});
  document.addEventListener('DOMContentLoaded',()=>{render();});
  window.HomeInsightsSankey={render,loadDate,setFlow};
})();

(() => {
  'use strict';
  const cfg=window.HOME_INSIGHTS_CONFIG||{};
  let flow=null;
  const fmt=v=>`${Number(v||0).toFixed(Number(v||0)>=10?1:2)} kWh`;
  function dayKey(d=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:cfg.timezone||'Australia/Melbourne',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)}
  function band(x1,y1,x2,y2,w,id){const c=(x2-x1)*.46;return `<path class="sankey-band" d="M ${x1} ${y1} C ${x1+c} ${y1}, ${x2-c} ${y2}, ${x2} ${y2}" fill="none" stroke="url(#${id})" stroke-width="${Math.max(2,w)}" stroke-linecap="round" opacity=".68"/>`}
  
  function node(x,y,w,label,value,color,icon){return `<g class="sankey-glass-node"><rect class="sankey-node" x="${x}" y="${y}" width="${w}" height="94" rx="15" fill="${color}" fill-opacity=".15" stroke="${color}" stroke-opacity=".62"/><circle cx="${x+28}" cy="${y+30}" r="17" fill="${color}" fill-opacity=".16" stroke="${color}" stroke-opacity=".5"/><text x="${x+28}" y="${y+36}" text-anchor="middle" font-size="18" fill="${color}">${icon}</text><text class="sankey-node-label" x="${x+54}" y="${y+27}">${label}</text><text class="sankey-node-value" x="${x+54}" y="${y+56}">${value.toFixed(value>=10?1:2)}</text><text class="sankey-node-unit" x="${x+54}" y="${y+75}">kWh</text></g>`}
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
    const W=980,H=390,nodeW=154,lx=28,rx=W-nodeW-28;
    const sourceTotals={solar:f.solarHouse+f.solarBattery+f.solarGrid,grid:f.gridHouse+f.gridBattery,battery:f.batteryHouse};
    const destTotals={house:f.solarHouse+f.gridHouse+f.batteryHouse,battery:f.solarBattery+f.gridBattery,grid:f.solarGrid};
    const maxTotal=Math.max(...Object.values(sourceTotals),...Object.values(destTotals),1),scale=66/maxTotal;
    const sources={solar:{y:24},grid:{y:148},battery:{y:272}};
    const dests={house:{y:24},battery:{y:148},grid:{y:272}};
    const srcOff={solar:0,grid:0,battery:0},dstOff={house:0,battery:0,grid:0};
    const styles=getComputedStyle(document.documentElement),colors={solar:styles.getPropertyValue('--solar').trim(),grid:styles.getPropertyValue('--grid').trim(),battery:styles.getPropertyValue('--battery').trim()};
    const links=[['solar','house',f.solarHouse,colors.solar,'#c5efff'],['solar','battery',f.solarBattery,colors.solar,colors.battery],['solar','grid',f.solarGrid,colors.solar,colors.grid],['grid','house',f.gridHouse,colors.grid,'#c5efff'],['grid','battery',f.gridBattery,colors.grid,colors.battery],['battery','house',f.batteryHouse,colors.battery,'#c5efff']];
    let paths='',defs='';
    links.forEach(([a,b,v,c1,c2],i)=>{if(v<=.0001)return;const sw=Math.max(3,v*scale),sy=sources[a].y+14+srcOff[a]+sw/2,dy=dests[b].y+14+dstOff[b]+sw/2,id=`sankey-flow-${i}`;srcOff[a]+=sw+2;dstOff[b]+=sw+2;defs+=`<linearGradient id="${id}" x1="0" x2="1"><stop offset="0" stop-color="${c1}" stop-opacity=".82"/><stop offset=".52" stop-color="${c1}" stop-opacity=".35"/><stop offset="1" stop-color="${c2}" stop-opacity=".82"/></linearGradient>`;paths+=band(lx+nodeW,sy,rx,dy,sw,id)});
    el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Energy flows in kilowatt-hours"><defs>${defs}<filter id="sankeyGlow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g filter="url(#sankeyGlow)">${paths}</g>${node(lx,sources.solar.y,nodeW,'Solar',sourceTotals.solar,colors.solar,'☀')}${node(lx,sources.grid.y,nodeW,'Grid in',sourceTotals.grid,colors.grid,'⇄')}${node(lx,sources.battery.y,nodeW,'Battery out',sourceTotals.battery,colors.battery,'▣')}${node(rx,dests.house.y,nodeW,'House',destTotals.house,'#c5efff','⌂')}${node(rx,dests.battery.y,nodeW,'Battery in',destTotals.battery,colors.battery,'▣')}${node(rx,dests.grid.y,nodeW,'Grid out',destTotals.grid,colors.grid,'⇄')}</svg>`;
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

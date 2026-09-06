(() => {
  'use strict';
  const cfg=window.HOME_INSIGHTS_CONFIG||{};
  let flow=null;
  const fmt=v=>`${Number(v||0).toFixed(Number(v||0)>=10?1:2)} kWh`;
  function dayKey(d=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:cfg.timezone||'Australia/Melbourne',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)}
  function ribbon(x1,sy,x2,dy,h,id){const c=(x2-x1)*.43,top=`M ${x1} ${sy} C ${x1+c} ${sy}, ${x2-c} ${dy}, ${x2} ${dy}`,bottom=`L ${x2} ${dy+h} C ${x2-c} ${dy+h}, ${x1+c} ${sy+h}, ${x1} ${sy+h} Z`;return `<g><path class="sankey-band" d="${top} ${bottom}" fill="url(#${id})"/><path class="sankey-band-sheen" d="${top}"/></g>`}
  
  function node(x,y,w,h,label,value,pct,color,gradient){const capW=label==='Battery'?94:label==='Solar'?74:label==='Load'?70:62;return `<g class="sankey-glass-node"><rect class="sankey-node" x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="url(#${gradient})"/><rect class="sankey-node-cap" x="${x+10}" y="${y+10}" width="${capW}" height="25" rx="5" fill="${color}"/><text class="sankey-node-label" x="${x+20}" y="${y+27}">${label.toUpperCase()}</text><text class="sankey-node-value" x="${x+14}" y="${y+67}">${value.toFixed(value>=10?1:2)}</text><text class="sankey-node-unit" x="${x+14}" y="${y+84}">kWh</text><text class="sankey-node-percent" x="${x+14}" y="${y+h-13}">${pct.toFixed(1)}%</text></g>`}
  function stack(values){const keys=Object.keys(values),sum=Math.max(.001,keys.reduce((s,k)=>s+values[k],0)),available=362,gap=7,min=108,variable=available-gap*(keys.length-1)-min*keys.length;let y=24,out={};keys.forEach(k=>{const h=min+variable*(values[k]/sum);out[k]={y,h,pct:values[k]/sum*100};y+=h+gap});return out;}
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
    const W=980,H=410,nodeW=164,lx=26,rx=W-nodeW-26;
    const sourceTotals={solar:f.solarHouse+f.solarBattery+f.solarGrid,grid:f.gridHouse+f.gridBattery,battery:f.batteryHouse};
    const destTotals={battery:f.solarBattery+f.gridBattery,house:f.solarHouse+f.gridHouse+f.batteryHouse,grid:f.solarGrid};
    const sources=stack(sourceTotals),dests=stack(destTotals);
    const scales=[...Object.keys(sourceTotals).filter(k=>sourceTotals[k]>0).map(k=>(sources[k].h-16)/sourceTotals[k]),...Object.keys(destTotals).filter(k=>destTotals[k]>0).map(k=>(dests[k].h-16)/destTotals[k])],scale=Math.max(.18,Math.min(...scales));
    const srcOff={solar:0,grid:0,battery:0},dstOff={house:0,battery:0,grid:0};
    const styles=getComputedStyle(document.documentElement),colors={solar:styles.getPropertyValue('--solar').trim(),grid:styles.getPropertyValue('--grid').trim(),battery:styles.getPropertyValue('--battery').trim()};
    const load='#a86dff',links=[['solar','house',f.solarHouse,colors.solar,load],['solar','battery',f.solarBattery,colors.solar,colors.battery],['solar','grid',f.solarGrid,colors.solar,colors.grid],['grid','house',f.gridHouse,colors.grid,load],['grid','battery',f.gridBattery,colors.grid,colors.battery],['battery','house',f.batteryHouse,colors.battery,load]];
    let paths='',defs='';
    links.forEach(([a,b,v,c1,c2],i)=>{if(v<=.0001)return;const h=Math.max(2,v*scale),sy=sources[a].y+8+srcOff[a],dy=dests[b].y+8+dstOff[b],id=`sankey-flow-${i}`;srcOff[a]+=h;dstOff[b]+=h;defs+=`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${lx+nodeW}" x2="${rx}"><stop offset="0" stop-color="${c1}" stop-opacity=".78"/><stop offset=".48" stop-color="${c1}" stop-opacity=".42"/><stop offset="1" stop-color="${c2}" stop-opacity=".7"/></linearGradient>`;paths+=ribbon(lx+nodeW,sy,rx,dy,h,id)});
    const nodeDefs=[["solarNode",colors.solar],["gridNode",colors.grid],["batteryNode",colors.battery],["loadNode",load]].map(([id,c])=>`<linearGradient id="${id}" x1="0" x2="1"><stop stop-color="${c}" stop-opacity=".46"/><stop offset="1" stop-color="${c}" stop-opacity=".2"/></linearGradient>`).join('');
    el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Energy flows in kilowatt-hours"><defs>${defs}${nodeDefs}<filter id="sankeySoftGlow"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g filter="url(#sankeySoftGlow)">${paths}</g>${node(lx,sources.solar.y,nodeW,sources.solar.h,'Solar',sourceTotals.solar,sources.solar.pct,colors.solar,'solarNode')}${node(lx,sources.grid.y,nodeW,sources.grid.h,'Grid',sourceTotals.grid,sources.grid.pct,colors.grid,'gridNode')}${node(lx,sources.battery.y,nodeW,sources.battery.h,'Battery',sourceTotals.battery,sources.battery.pct,colors.battery,'batteryNode')}${node(rx,dests.battery.y,nodeW,dests.battery.h,'Battery',destTotals.battery,dests.battery.pct,colors.battery,'batteryNode')}${node(rx,dests.house.y,nodeW,dests.house.h,'Load',destTotals.house,dests.house.pct,load,'loadNode')}${node(rx,dests.grid.y,nodeW,dests.grid.h,'Grid',destTotals.grid,dests.grid.pct,colors.grid,'gridNode')}</svg>`;
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

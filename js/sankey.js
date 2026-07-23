(() => {
  'use strict';
  const cfg=window.HOME_INSIGHTS_CONFIG||{};
  const key='home-insights-sankey-v1';
  const blank=()=>({date:dayKey(),lastTime:null,solarHouse:0,solarBattery:0,solarGrid:0,gridHouse:0,gridBattery:0,batteryHouse:0});
  function dayKey(d=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:cfg.timezone||'Australia/Melbourne',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)}
  function load(){try{const v=JSON.parse(localStorage.getItem(key)||'null');return v&&v.date===dayKey()?v:blank()}catch{return blank()}}
  let flow=load();
  const save=()=>localStorage.setItem(key,JSON.stringify(flow));
  const fmt=v=>`${v.toFixed(v>=10?1:2)} kWh`;
  function addSample(s){
    const t=new Date(s.time||Date.now()),ms=t.getTime();
    if(flow.date!==dayKey(t)) flow=blank();
    if(flow.lastTime){
      const h=Math.max(0,Math.min((ms-flow.lastTime)/3600000,0.06));
      const solar=Math.max(0,+s.solar||0), house=Math.max(0,+s.house||0), grid=+s.grid||0, battery=+s.battery||0;
      const charge=Math.max(0,battery), discharge=Math.max(0,-battery), gridImport=Math.max(0,grid), gridExport=Math.max(0,-grid);
      const solarToHouse=Math.min(solar,house);
      const remainingHouse=Math.max(0,house-solarToHouse);
      const batteryToHouse=Math.min(discharge,remainingHouse);
      const gridToHouse=Math.min(gridImport,Math.max(0,remainingHouse-batteryToHouse));
      const solarSurplus=Math.max(0,solar-solarToHouse);
      const solarToBattery=Math.min(charge,solarSurplus);
      const gridToBattery=Math.max(0,charge-solarToBattery);
      const solarToGrid=Math.min(gridExport,Math.max(0,solarSurplus-solarToBattery));
      flow.solarHouse+=solarToHouse*h; flow.solarBattery+=solarToBattery*h; flow.solarGrid+=solarToGrid*h;
      flow.gridHouse+=gridToHouse*h; flow.gridBattery+=gridToBattery*h; flow.batteryHouse+=batteryToHouse*h;
    }
    flow.lastTime=ms; save(); render();
  }
  function band(x1,y1,x2,y2,w,color){const c=(x2-x1)*.48;return `<path class="sankey-band" d="M ${x1} ${y1} C ${x1+c} ${y1}, ${x2-c} ${y2}, ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="${Math.max(2,w)}" stroke-linecap="butt"/>`}
  function node(x,y,w,h,label,value,fill){return `<g><rect class="sankey-node" x="${x}" y="${y}" width="${w}" height="${h}" rx="13" fill="${fill}"/><text class="sankey-node-label" x="${x+14}" y="${y+25}">${label}</text><text class="sankey-node-value" x="${x+14}" y="${y+52}">${value.toFixed(value>=10?1:2)}</text><text class="sankey-node-unit" x="${x+14}" y="${y+70}">kWh</text></g>`}
  function render(){
    const el=document.getElementById('energySankey'); if(!el)return;
    const ids={flowSolarHouse:'solarHouse',flowSolarBattery:'solarBattery',flowSolarGrid:'solarGrid',flowGridHouse:'gridHouse',flowGridBattery:'gridBattery',flowBatteryHouse:'batteryHouse'};
    Object.entries(ids).forEach(([id,k])=>{const n=document.getElementById(id);if(n)n.textContent=fmt(flow[k])});
    const total=flow.solarHouse+flow.solarBattery+flow.solarGrid+flow.gridHouse+flow.gridBattery+flow.batteryHouse;
    if(total<.002){el.innerHTML='<div class="sankey-empty"><div><strong>Building today’s flow</strong>The diagram will appear after live readings have accumulated.</div></div>';return}
    const W=920,H=390,nodeW=130; const lx=34,rx=W-nodeW-34;
    const sourceTotals={solar:flow.solarHouse+flow.solarBattery+flow.solarGrid,grid:flow.gridHouse+flow.gridBattery,battery:flow.batteryHouse};
    const destTotals={house:flow.solarHouse+flow.gridHouse+flow.batteryHouse,battery:flow.solarBattery+flow.gridBattery,grid:flow.solarGrid};
    const maxTotal=Math.max(...Object.values(sourceTotals),...Object.values(destTotals),1);
    const scale=150/maxTotal;
    const sources={solar:{y:35,h:Math.max(72,sourceTotals.solar*scale)},grid:{y:155,h:Math.max(72,sourceTotals.grid*scale)},battery:{y:275,h:Math.max(72,sourceTotals.battery*scale)}};
    const dests={house:{y:35,h:Math.max(72,destTotals.house*scale)},battery:{y:155,h:Math.max(72,destTotals.battery*scale)},grid:{y:275,h:Math.max(72,destTotals.grid*scale)}};
    const srcOff={solar:0,grid:0,battery:0},dstOff={house:0,battery:0,grid:0};
    const colors={solar:'#9bdd57',grid:'#778cff',battery:'#4fe0df'};
    const links=[['solar','house',flow.solarHouse,colors.solar],['solar','battery',flow.solarBattery,'#73d9a5'],['solar','grid',flow.solarGrid,'#b6d95e'],['grid','house',flow.gridHouse,colors.grid],['grid','battery',flow.gridBattery,'#718ee9'],['battery','house',flow.batteryHouse,colors.battery]];
    let paths='';
    links.forEach(([a,b,v,c])=>{if(v<=.0001)return;const sw=Math.max(3,v*scale),sy=sources[a].y+13+srcOff[a]+sw/2,dy=dests[b].y+13+dstOff[b]+sw/2;srcOff[a]+=sw+2;dstOff[b]+=sw+2;paths+=band(lx+nodeW,sy,rx,dy,sw,c)});
    const svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Today’s energy flows in kilowatt-hours"><defs><filter id="sglow"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>${paths}${node(lx,sources.solar.y,nodeW,sources.solar.h,'Solar',sourceTotals.solar,'#25462e')}${node(lx,sources.grid.y,nodeW,sources.grid.h,'Grid in',sourceTotals.grid,'#26305b')}${node(lx,sources.battery.y,nodeW,sources.battery.h,'Battery out',sourceTotals.battery,'#174b4c')}${node(rx,dests.house.y,nodeW,dests.house.h,'House',destTotals.house,'#4d285f')}${node(rx,dests.battery.y,nodeW,dests.battery.h,'Battery in',destTotals.battery,'#16494a')}${node(rx,dests.grid.y,nodeW,dests.grid.h,'Grid out',destTotals.grid,'#3b3158')}</svg>`;
    el.innerHTML=svg;
  }
  window.addEventListener('homeinsights:live',e=>addSample(e.detail));
  document.addEventListener('DOMContentLoaded',render);
  window.HomeInsightsSankey={render,reset:()=>{flow=blank();save();render()}};
})();

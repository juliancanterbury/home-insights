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

  function ribbon(x1,y1a,y1b,x2,y2a,y2b,gradientId){
    const c=(x2-x1)*.47;
    return `<path class="sankey-ribbon" d="M ${x1} ${y1a} C ${x1+c} ${y1a}, ${x2-c} ${y2a}, ${x2} ${y2a} L ${x2} ${y2b} C ${x2-c} ${y2b}, ${x1+c} ${y1b}, ${x1} ${y1b} Z" fill="url(#${gradientId})"/>`;
  }

  function node(x,y,w,h,label,value,fill){
    const valueY=y+h-25, unitY=y+h-11;
    return `<g class="sankey-node-group"><rect class="sankey-node" x="${x}" y="${y}" width="${w}" height="${h}" rx="9" fill="${fill}"/><text class="sankey-node-label" x="${x+12}" y="${y+22}">${label}</text><text class="sankey-node-value" x="${x+12}" y="${valueY}">${value.toFixed(value>=10?1:2)}</text><text class="sankey-node-unit" x="${x+12}" y="${unitY}">kWh</text></g>`;
  }

  function makeLayout(totals, top, bottom, gap, minH){
    const names=Object.keys(totals), usable=bottom-top-gap*(names.length-1);
    const sum=names.reduce((a,n)=>a+totals[n],0) || 1;
    const raw=names.map(n=>Math.max(minH,usable*totals[n]/sum));
    const rawSum=raw.reduce((a,b)=>a+b,0);
    const factor=rawSum>usable?usable/rawSum:1;
    let y=top;
    return Object.fromEntries(names.map((n,i)=>{const h=raw[i]*factor;const out=[n,{y,h}];y+=h+gap;return out}));
  }

  function render(){
    const el=document.getElementById('energySankey'); if(!el)return;
    const ids={flowSolarHouse:'solarHouse',flowSolarBattery:'solarBattery',flowSolarGrid:'solarGrid',flowGridHouse:'gridHouse',flowGridBattery:'gridBattery',flowBatteryHouse:'batteryHouse'};
    Object.entries(ids).forEach(([id,k])=>{const n=document.getElementById(id);if(n)n.textContent=fmt(flow[k])});
    const total=flow.solarHouse+flow.solarBattery+flow.solarGrid+flow.gridHouse+flow.gridBattery+flow.batteryHouse;
    if(total<.002){el.innerHTML='<div class="sankey-empty"><div><strong>Building today’s flow</strong>The diagram will appear after live readings have accumulated.</div></div>';return}

    const W=920,H=420,nodeW=128,lx=34,rx=W-nodeW-34,top=48,bottom=392,gap=20;
    const sourceTotals={solar:flow.solarHouse+flow.solarBattery+flow.solarGrid,grid:flow.gridHouse+flow.gridBattery,battery:flow.batteryHouse};
    const destTotals={house:flow.solarHouse+flow.gridHouse+flow.batteryHouse,battery:flow.solarBattery+flow.gridBattery,grid:flow.solarGrid};
    const sources=makeLayout(sourceTotals,top,bottom,gap,60);
    const dests=makeLayout(destTotals,top,bottom,gap,60);
    const sourceColors={solar:'#83b44f',grid:'#5269b7',battery:'#55b9c4'};
    const destColors={house:'#6b3f7d',battery:'#287a78',grid:'#57506f'};
    const links=[
      ['solar','house',flow.solarHouse],['solar','battery',flow.solarBattery],['solar','grid',flow.solarGrid],
      ['grid','house',flow.gridHouse],['grid','battery',flow.gridBattery],['battery','house',flow.batteryHouse]
    ];
    const srcOff={solar:0,grid:0,battery:0},dstOff={house:0,battery:0,grid:0};
    let defs='',paths='';
    links.forEach(([a,b,v],i)=>{
      if(v<=.0001)return;
      const sw=Math.max(2.5,(v/sourceTotals[a])*Math.max(2,sources[a].h-4));
      const dw=Math.max(2.5,(v/destTotals[b])*Math.max(2,dests[b].h-4));
      const sy1=sources[a].y+2+srcOff[a], sy2=sy1+sw;
      const dy1=dests[b].y+2+dstOff[b], dy2=dy1+dw;
      srcOff[a]+=sw; dstOff[b]+=dw;
      const gid=`sankey-g-${i}`;
      defs+=`<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${lx+nodeW}" y1="0" x2="${rx}" y2="0"><stop offset="0" stop-color="${sourceColors[a]}" stop-opacity=".92"/><stop offset=".52" stop-color="${sourceColors[a]}" stop-opacity=".74"/><stop offset="1" stop-color="${destColors[b]}" stop-opacity=".90"/></linearGradient>`;
      paths+=ribbon(lx+nodeW,sy1,sy2,rx,dy1,dy2,gid);
    });

    const svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Today’s energy flows in kilowatt-hours"><defs>${defs}</defs><text class="sankey-column-heading" x="${lx}" y="24">ENERGY SOURCE</text><text class="sankey-column-heading" x="${rx+nodeW}" y="24" text-anchor="end">ENERGY DESTINATION</text><g class="sankey-links">${paths}</g>${node(lx,sources.solar.y,nodeW,sources.solar.h,'Solar',sourceTotals.solar,sourceColors.solar)}${node(lx,sources.grid.y,nodeW,sources.grid.h,'Grid in',sourceTotals.grid,sourceColors.grid)}${node(lx,sources.battery.y,nodeW,sources.battery.h,'Battery out',sourceTotals.battery,sourceColors.battery)}${node(rx,dests.house.y,nodeW,dests.house.h,'House',destTotals.house,destColors.house)}${node(rx,dests.battery.y,nodeW,dests.battery.h,'Battery in',destTotals.battery,destColors.battery)}${node(rx,dests.grid.y,nodeW,dests.grid.h,'Grid out',destTotals.grid,destColors.grid)}</svg>`;
    el.innerHTML=svg;
  }

  window.addEventListener('homeinsights:live',e=>addSample(e.detail));
  document.addEventListener('DOMContentLoaded',render);
  window.HomeInsightsSankey={render,reset:()=>{flow=blank();save();render()}};
})();

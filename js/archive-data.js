(() => {
  'use strict';
  fetch('data/home_insights.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json()}).then(data=>{
    const num=value=>value===null||value===undefined||value===''||!Number.isFinite(Number(value))?null:Number(value);
    (data.energyDaily||[]).forEach(row=>{const gas=num(row.gasMJ),imp=num(row.gridImport),exp=num(row.gridExport);window.HomeInsights.upsertDaily({date:row.date,gasMJ:gas,gasTotal:gas===null?null:gas*.0364+.90,solarKwh:num(row.solar),loadKwh:num(row.load),importKwh:imp,exportKwh:exp,electricityTotal:imp===null&&exp===null?null:1.09725+(imp||0)*.24821-(exp||0)*.01});});
    dispatchEvent(new CustomEvent('homeinsights:data-ready'));
  }).catch(error=>console.warn('Archived Home Insights data:',error));
})();

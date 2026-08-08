(() => {
  'use strict';
  const key='home-insights-meter-readings';
  let loading=false, ready=false, remote=[];
  const local=()=>{try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return[]}};
  const identity=r=>r.id||`${r.kind}:${r.date}:${r.value}`;
  const merge=(...sets)=>Array.from(new Map(sets.flat().filter(Boolean).map(r=>[identity(r),r])).values());
  const store=rows=>localStorage.setItem(key,JSON.stringify(rows));
  async function load(){
    if(loading)return; loading=true;
    try{
      const json=await HomeInsightsApi.meterRequest('meterReadings');
      if(!json?.ok)throw new Error(json?.error||'Cloud meter service unavailable');
      remote=json.readings||json.meterReadings||json.rows||[];
      store(merge(remote,local())); ready=true; document.body.dataset.meterSync='cloud';
      HomeInsightsLocalData?.renderMeters(); dispatchEvent(new CustomEvent('homeinsights:meters-changed',{detail:{fromCloud:true}}));
    }catch(error){console.warn('Meter readings: offline cache active',error);document.body.dataset.meterSync='offline'}finally{loading=false}
  }
  async function sync(){
    if(!ready)return;
    const rows=local(), remoteIds=new Set(remote.map(identity));
    const pending=rows.filter(r=>!remoteIds.has(identity(r)));
    for(const row of pending){try{const json=await HomeInsightsApi.meterRequest('saveMeterReading',row);if(!json?.ok)throw new Error(json?.error||'Save failed');remote=merge(remote,[json.reading||row])}catch(error){console.warn('Meter reading remains cached:',error);document.body.dataset.meterSync='offline';return}}
    document.body.dataset.meterSync='cloud';
  }
  addEventListener('homeinsights:meters-changed',e=>{if(!e.detail?.fromCloud)sync()});
  addEventListener('DOMContentLoaded',load);
  window.HomeInsightsCloudMeters={load,sync};
})();

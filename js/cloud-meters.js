(() => {
  'use strict';
  const key='home-insights-meter-readings';
  let loading=false,ready=false,remote=[];
  const local=()=>{try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return[]}};
  const store=rows=>localStorage.setItem(key,JSON.stringify(rows));
  const identity=row=>String(row.id||`${row.kind}:${row.date}:${row.value}`);
  const publicRow=row=>{const copy={...row};delete copy.photoDataUrl;delete copy.photoFileId;return copy};
  const fingerprint=row=>JSON.stringify(publicRow(row),Object.keys(publicRow(row)).sort());
  const status=text=>{document.body.dataset.meterSync=ready?'cloud':'offline';const node=document.getElementById('meterSyncStatus');if(node)node.textContent=text;};
  const mergeRemote=(localRows,remoteRows)=>{const map=new Map(localRows.map(row=>[identity(row),row]));remoteRows.forEach(row=>map.set(identity(row),row));return [...map.values()];};
  const blobDataUrl=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob)});

  async function getPhotoBlob(id){
    const json=await HomeInsightsApi.meterRequest('meterPhoto',{id});
    if(!json?.ok||!json.dataUrl)return null;
    return fetch(json.dataUrl).then(response=>response.blob());
  }

  async function uploadPhoto(row){
    if(!row.hasPhoto)return;
    const blob=await HomeInsightsLocalData?.getReadingPhoto(row.id);
    if(!blob)return;
    await HomeInsightsApi.meterPost('uploadMeterPhoto',{id:row.id,dataUrl:await blobDataUrl(blob)});
  }

  async function sync(){
    if(!ready)return;
    const rows=local(),localMap=new Map(rows.map(row=>[identity(row),row])),remoteMap=new Map(remote.map(row=>[identity(row),row]));
    for(const row of rows){
      const old=remoteMap.get(identity(row));
      if(!old||fingerprint(old)!==fingerprint(row)){
        const json=await HomeInsightsApi.meterRequest('saveMeterReading',publicRow(row));
        if(!json?.ok)throw new Error(json?.error||'Meter save failed');
        const saved=json.reading||row;remoteMap.set(identity(row),saved);
        if(row.hasPhoto&&(!old?.hasPhoto||old.updatedAt!==row.updatedAt))await uploadPhoto(row);
      }
    }
    for(const row of remote){
      if(!localMap.has(identity(row))&&row.source!=='bill-actual'){
        const json=await HomeInsightsApi.meterRequest('deleteMeterReading',{id:identity(row)});
        if(!json?.ok)throw new Error(json?.error||'Meter delete failed');
        remoteMap.delete(identity(row));
      }
    }
    remote=[...remoteMap.values()];ready=true;status('Gas and water readings are synced across devices · photos stored in Drive.');
  }

  async function load(){
    if(loading)return;loading=true;
    try{
      const json=await HomeInsightsApi.meterRequest('meterReadings');
      if(!json?.ok||!Array.isArray(json.readings))throw new Error('The Meter Store backend has not been deployed');
      remote=json.readings;store(mergeRemote(local(),remote));ready=true;status('Gas and water readings are synced across devices · offline cache enabled.');
      await sync();HomeInsightsLocalData?.renderMeters();dispatchEvent(new CustomEvent('homeinsights:meters-changed',{detail:{fromCloud:true}}));
    }catch(error){ready=false;console.warn('Meter sync:',error);status('This device is using its offline meter cache · deploy MeterStore.gs to enable cross-device sync.');}
    finally{loading=false}
  }

  addEventListener('homeinsights:meters-changed',event=>{if(event.detail?.fromCloud)return;sync().catch(error=>{ready=false;console.warn('Meter sync:',error);status('Meter change saved on this device · cloud sync will retry automatically.');});});
  window.HomeInsightsCloudMeters={start(){load();setInterval(load,60000)},load,sync,getPhotoBlob};
})();

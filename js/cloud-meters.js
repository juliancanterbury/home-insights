(() => {
  'use strict';
  const key='home-insights-meter-readings';
  let loading=false,ready=false,remote=[];
  const local=()=>{try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return[]}};
  const store=rows=>localStorage.setItem(key,JSON.stringify(rows));
  const identity=row=>String(row.id||`${row.kind}:${row.date}:${row.value}`);
  const publicRow=row=>{const copy={...row};delete copy.photoDataUrl;delete copy.photoFileId;return copy};
  const fingerprint=row=>JSON.stringify(publicRow(row),Object.keys(publicRow(row)).sort());
  const changedAfter=(left,right)=>String(left?.updatedAt||'')>String(right?.updatedAt||'');
  const status=text=>{document.body.dataset.meterSync=ready?'cloud':'offline';const node=document.getElementById('meterSyncStatus');if(node)node.textContent=text;};
  const mergeRemote=(localRows,remoteRows)=>{const map=new Map(localRows.map(row=>[identity(row),row]));remoteRows.forEach(row=>{const old=map.get(identity(row));if(!old||!changedAfter(old,row))map.set(identity(row),row)});return [...map.values()]};
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
    if(!ready)return false;
    const rows=local(),remoteMap=new Map(remote.map(row=>[identity(row),row]));
    for(const row of rows){
      const old=remoteMap.get(identity(row));
      if(!old||(changedAfter(row,old)&&fingerprint(old)!==fingerprint(row))){
        const json=await HomeInsightsApi.meterRequest('saveMeterReading',publicRow(row));
        if(!json?.ok)throw new Error(json?.error||'Meter save failed');
        const saved=json.reading||row;
        remoteMap.set(identity(row),saved);
        if(row.hasPhoto&&(!old?.hasPhoto||old.updatedAt!==row.updatedAt))await uploadPhoto(row);
      }
    }
    remote=[...remoteMap.values()];
    status('Gas and water readings are synced across devices · photos stored in Drive.');
    return true;
  }

  async function load(){
    if(loading)return;loading=true;
    try{
      const json=await HomeInsightsApi.meterRequest('meterReadings');
      if(!json?.ok||!Array.isArray(json.readings))throw new Error('The shared meter backend has not been deployed');
      remote=json.readings;ready=true;
      // First upload records already held by this browser. This migrates data
      // created by the previous device-only version before any remote merge.
      await sync();
      const refreshed=await HomeInsightsApi.meterRequest('meterReadings');
      if(refreshed?.ok&&Array.isArray(refreshed.readings))remote=refreshed.readings;
      store(mergeRemote(local(),remote));
      status('Gas and water readings are synced across devices · offline cache enabled.');
      HomeInsightsLocalData?.renderMeters();
      dispatchEvent(new CustomEvent('homeinsights:meters-changed',{detail:{fromCloud:true}}));
    }catch(error){
      ready=false;console.warn('Meter sync:',error);
      status('Meter change is saved on this device · cloud sync will retry automatically.');
    }finally{loading=false}
  }

  addEventListener('homeinsights:meters-changed',event=>{
    if(event.detail?.fromCloud)return;
    const deletedId=event.detail?.deletedId;
    const work=deletedId&&ready
      ?HomeInsightsApi.meterRequest('deleteMeterReading',{id:deletedId}).then(json=>{if(!json?.ok)throw new Error(json?.error||'Meter delete failed');remote=remote.filter(row=>identity(row)!==deletedId)})
      :sync();
    Promise.resolve(work).catch(error=>{console.warn('Meter sync:',error);status('Meter change is saved on this device · cloud sync will retry automatically.');});
  });

  window.HomeInsightsCloudMeters={start(){load();setInterval(load,30000)},load,sync,getPhotoBlob};
})();

/**
 * Home Insights shared Gas/Water meter store.
 *
 * Stores reading metadata in the bound spreadsheet and photographs in a
 * private Google Drive folder. Call meterHandleGet_(e) from the existing
 * doGet(e), and meterHandlePost_(e) from doPost(e), before other routes.
 */

const METER_SHEET_NAME = 'Meter Readings';
const METER_FOLDER_PROPERTY = 'HOME_INSIGHTS_METER_PHOTO_FOLDER_ID';

function meterHandleGet_(e) {
  const action = String((e && e.parameter && e.parameter.action) || '');
  if (['meterReadings','saveMeterReading','deleteMeterReading','meterPhoto'].indexOf(action) < 0) return null;
  try {
    const payload = meterPayload_(e);
    if (action === 'meterReadings') return meterOutput_({ok:true,readings:meterReadings_()}, e);
    if (action === 'saveMeterReading') return meterOutput_({ok:true,reading:meterSaveReading_(payload)}, e);
    if (action === 'deleteMeterReading') return meterOutput_({ok:true,deleted:meterDeleteReading_(payload.id)}, e);
    if (action === 'meterPhoto') return meterOutput_(meterPhotoResponse_(payload.id), e);
  } catch (error) {
    return meterOutput_({ok:false,error:String(error && error.message || error)}, e);
  }
}

function meterHandlePost_(e) {
  const action = String((e && e.parameter && e.parameter.action) || '');
  if (action !== 'uploadMeterPhoto') return null;
  try {
    const payload = meterPayload_(e);
    return meterOutput_({ok:true,reading:meterSavePhoto_(payload)}, e);
  } catch (error) {
    return meterOutput_({ok:false,error:String(error && error.message || error)}, e);
  }
}

function meterPayload_(e) {
  const text = e && e.parameter && e.parameter.payload;
  if (!text) return {};
  const payload = JSON.parse(text);
  if (!payload || typeof payload !== 'object') throw new Error('Invalid meter payload');
  return payload;
}

function meterOutput_(value, e) {
  const callback = String((e && e.parameter && e.parameter.callback) || '');
  const json = JSON.stringify(value);
  if (callback && /^[A-Za-z_$][\w$]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + json + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function meterSheet_() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  if (!book) throw new Error('MeterStore.gs must run in the Home Insights spreadsheet-bound project');
  let sheet = book.getSheetByName(METER_SHEET_NAME);
  if (!sheet) sheet = book.insertSheet(METER_SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(['ID','Reading JSON','Photo file ID','Updated at']);
  return sheet;
}

function meterRows_() {
  const sheet = meterSheet_(), last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2,1,last-1,4).getValues().map(function(values,index) {
    let reading;
    try { reading = JSON.parse(values[1] || '{}'); } catch (_) { reading = {}; }
    reading.id = String(values[0] || reading.id || '');
    reading.hasPhoto = Boolean(values[2]) || Boolean(reading.hasPhoto);
    reading.updatedAt = String(values[3] || reading.updatedAt || '');
    return {row:index+2,reading:reading,photoFileId:String(values[2] || '')};
  }).filter(function(item){ return item.reading.id; });
}

function meterReadings_() {
  return meterRows_().map(function(item) {
    const reading = JSON.parse(JSON.stringify(item.reading));
    delete reading.photoDataUrl;
    delete reading.photoFileId;
    return reading;
  });
}

function meterValidateReading_(reading) {
  if (!reading.id) throw new Error('Reading ID is required');
  if (reading.kind !== 'gas' && reading.kind !== 'water') throw new Error('Reading kind must be gas or water');
  if (!reading.date || isNaN(new Date(reading.date).getTime())) throw new Error('A valid reading date is required');
  if (!isFinite(Number(reading.value)) || Number(reading.value) < 0) throw new Error('A valid cumulative reading is required');
}

function meterSaveReading_(input) {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const reading = JSON.parse(JSON.stringify(input || {}));
    meterValidateReading_(reading);
    reading.value = Number(reading.value);
    reading.correctedReading = reading.correctedReading === undefined ? reading.value : Number(reading.correctedReading);
    reading.updatedAt = reading.updatedAt || new Date().toISOString();
    delete reading.photoDataUrl; delete reading.photoFileId;
    const sheet = meterSheet_(), existing = meterRows_().filter(function(item){return item.reading.id === reading.id;})[0];
    const photoFileId = existing ? existing.photoFileId : '';
    reading.hasPhoto = Boolean(photoFileId) || Boolean(reading.hasPhoto);
    const values = [reading.id,JSON.stringify(reading),photoFileId,reading.updatedAt];
    if (existing) sheet.getRange(existing.row,1,1,4).setValues([values]); else sheet.appendRow(values);
    return reading;
  } finally { lock.releaseLock(); }
}

function meterDeleteReading_(id) {
  id = String(id || '');
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const item = meterRows_().filter(function(row){return row.reading.id === id;})[0];
    if (!item) return false;
    if (item.reading.source === 'bill-actual') throw new Error('Verified bill readings cannot be deleted');
    if (item.photoFileId) { try { DriveApp.getFileById(item.photoFileId).setTrashed(true); } catch (_) {} }
    meterSheet_().deleteRow(item.row);
    return true;
  } finally { lock.releaseLock(); }
}

function meterPhotoFolder_() {
  const props = PropertiesService.getScriptProperties();
  const existing = props.getProperty(METER_FOLDER_PROPERTY);
  if (existing) { try { return DriveApp.getFolderById(existing); } catch (_) {} }
  const folder = DriveApp.createFolder('Home Insights Meter Photos');
  props.setProperty(METER_FOLDER_PROPERTY, folder.getId());
  return folder;
}

function meterSavePhoto_(payload) {
  const id = String(payload.id || ''), match = String(payload.dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!id || !match) throw new Error('Reading ID and a base64 photograph are required');
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const item = meterRows_().filter(function(row){return row.reading.id === id;})[0];
    if (!item) throw new Error('Reading not found');
    if (item.photoFileId) { try { DriveApp.getFileById(item.photoFileId).setTrashed(true); } catch (_) {} }
    const extension = match[1].indexOf('png') >= 0 ? '.png' : '.jpg';
    const blob = Utilities.newBlob(Utilities.base64Decode(match[2]), match[1], id + extension);
    const file = meterPhotoFolder_().createFile(blob), reading=item.reading;
    reading.hasPhoto=true;reading.source=reading.source === 'bill-actual' ? reading.source : 'manual-with-photo';reading.updatedAt=new Date().toISOString();
    meterSheet_().getRange(item.row,1,1,4).setValues([[id,JSON.stringify(reading),file.getId(),reading.updatedAt]]);
    return reading;
  } finally { lock.releaseLock(); }
}

function meterPhotoResponse_(id) {
  const item = meterRows_().filter(function(row){return row.reading.id === String(id || '');})[0];
  if (!item || !item.photoFileId) return {ok:true,dataUrl:null};
  const blob = DriveApp.getFileById(item.photoFileId).getBlob();
  return {ok:true,dataUrl:'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes())};
}


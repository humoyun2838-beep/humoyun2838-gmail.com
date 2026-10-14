// Legacy signed Sheets receiver. The live two-bot runtime is hosted_bot.gs.
const BOOK_ID = '1uThzdMAiaunkZBqqClpZdmVWvX7ad2L7Q3WbXw2JmX8';
const DEPARTMENTS = ["Sklad", "Qabul bo‘limi", "Transfuziologiya", "Oper blok", "OSS", "1-xirurgiya", "Neyronkologiya", "Poliklinika", "1-gematologiya", "Reanimatsiya", "2-gematologiya", "2-xirurgiya", "3-gematologiya", "Kunduzgi shifoxona", "Ximiya terapiya (4-gematologiya)"];
const REPORT_HEADERS = ['FISH','Yuboruvchi','Bo‘lim','Umumiy xabar','Sana (Toshkent)'];
const DEPARTMENT_TITLES = {'Neyronkologiya':'Neyroonkologiya','Ximiya terapiya (4-gematologiya)':'Kimyoterapiya (4-gematologiya)','Oper blok':'Operatsiya bloki'};
function departmentTitle(n){return DEPARTMENT_TITLES[n]||n;}
function roster(){return Object.fromEntries(DEPARTMENTS.map(n=>[n,[]]));}
function config(){return PropertiesService.getScriptProperties();}
function book(){return SpreadsheetApp.openById(BOOK_ID);}
function safeCellText(value){const text=String(value);return /^[=+\-@']/.test(text)?"'"+text:text;}
function ensureRows(sheet,row){const max=sheet.getMaxRows();if(row>max)sheet.insertRowsAfter(max,Math.max(100,row-max));}
// Only these five fields are report cells. Retry hashes use compact metadata buckets.
function reportKey(batchId) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(batchId),Utilities.Charset.UTF_8)
    .map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('').slice(0,32);
}
function reportDate(value) {
  const input=String(value);
  const date=new Date(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(input)?input.replace(' ','T')+'+05:00':input);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid report date');
  return date;
}
function reportMarkers(sheet,key) {
  return sheet.createDeveloperMetadataFinder().withKey('onko_reports:'+key.slice(0,2)).find();
}
function markReport(sheet,row,key) {
  const markers=reportMarkers(sheet,key);
  if(markers.some(m=>JSON.parse(m.getValue()).includes(key)))return;
  const writable=markers.find(m=>JSON.parse(m.getValue()).length<24);
  if(writable){const values=JSON.parse(writable.getValue());values.push(key);writable.setValue(JSON.stringify(values));}
  else sheet.addDeveloperMetadata('onko_reports:'+key.slice(0,2),JSON.stringify([key]));
}
function reportMarked(sheet,key) {
  return reportMarkers(sheet,key).some(m=>JSON.parse(m.getValue()).includes(key));
}
function normalizeReportValue(value) {
  return value instanceof Date ? Utilities.formatDate(value,'Asia/Tashkent','yyyy-MM-dd HH:mm:ss') : String(value);
}
function migrateReportSheet(sheet) {
  if(!sheet.getLastRow()){
    sheet.appendRow(REPORT_HEADERS);sheet.setFrozenRows(1);
    sheet.getRange(1,1,1,5).setFontWeight('bold').setBackground('#d9ead3');
    [380,180,220,600,170].forEach((w,i)=>sheet.setColumnWidth(i+1,w));return;
  }
  let headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
  if(JSON.stringify(headers)===JSON.stringify(REPORT_HEADERS))return;
  if(headers.some(h=>!REPORT_HEADERS.includes(h)&&!['Xabar ID','Telegram ID'].includes(h)))throw new Error('Unexpected report column');
  const idColumn=headers.indexOf('Xabar ID')+1;
  if(idColumn&&sheet.getLastRow()>1)sheet.getRange(2,idColumn,sheet.getLastRow()-1,1).getValues().forEach((v,i)=>{if(v[0]){const key=reportKey(v[0]);if(!reportMarked(sheet,key))markReport(sheet,i+2,key);}});
  headers.map((h,i)=>({h:h,c:i+1})).filter(v=>['Xabar ID','Telegram ID'].includes(v.h)).reverse().forEach(v=>sheet.deleteColumn(v.c));
  headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
  const old=['Sana (Toshkent)','Yuboruvchi','Bo‘lim','Umumiy xabar'];
  if(JSON.stringify(headers)===JSON.stringify(old)){sheet.getRange(1,5).setValue('FISH');headers.push('FISH');}
  if(headers.length!==5||new Set(headers).size!==5||REPORT_HEADERS.some(h=>!headers.includes(h)))throw new Error('Report column order mismatch');
  // Move entire columns, preserving cell values, dates, formatting and attached references.
  REPORT_HEADERS.forEach((h,i)=>{const source=headers.indexOf(h);if(source!==i){sheet.moveColumns(sheet.getRange(1,source+1),i+1);headers.splice(source,1);headers.splice(i,0,h);}});
  sheet.getRange(1,1,1,5).setFontWeight('bold').setBackground('#d9ead3');
  [380,180,220,600,170].forEach((w,i)=>sheet.setColumnWidth(i+1,w));
}
function writeReport(p) {
  if(!Object.prototype.hasOwnProperty.call(roster(),p.department)||typeof p.batch_id!=='string'||!p.batch_id||typeof p.message!=='string'||!p.message||p.message.length>45000)throw new Error('Invalid report');
  const b=book(), sheet=b.getSheetByName(p.department)||b.insertSheet(p.department);
  migrateReportSheet(sheet);
  const key=reportKey(p.batch_id), pendingKey='REPORT_PENDING:'+key;
  if(reportMarked(sheet,key)){config().deleteProperty(pendingKey);return;}
  const values=[String(p.fish||''),String(p.sender||''),departmentTitle(p.department),p.message,reportDate(p.date)];
  const pending=config().getProperty(pendingKey);
  let row=sheet.getLastRow()+1, alreadyWritten=false;
  if(pending){
    const saved=JSON.parse(pending);
    if(saved.department===p.department&&saved.row>=2&&saved.row<=sheet.getMaxRows()){
      const actual=sheet.getRange(saved.row,1,1,5).getValues()[0];
      const expected=values.map(normalizeReportValue);
      alreadyWritten=actual.every((v,i)=>normalizeReportValue(v)===expected[i]);
      const empty=actual.every(v=>v==='');
      const partial=normalizeReportValue(actual[4])===expected[4]&&actual.slice(0,4).every(v=>v==='');
      if(alreadyWritten||empty||partial)row=saved.row;
    }
  }
  config().setProperty(pendingKey,JSON.stringify({department:p.department,row:row}));
  ensureRows(sheet,row);
  if(!alreadyWritten){
    sheet.getRange(row,1,1,5).setValues([['','','','',values[4]]]);
    sheet.getRange(row,1,1,4).setNumberFormat('@').setValues([values.slice(0,4).map(safeCellText)]);
    sheet.getRange(row,5).setNumberFormat('dd.MM.yyyy HH:mm:ss');
    sheet.getRange(row,4).setWrap(true);
    SpreadsheetApp.flush();
  }
  markReport(sheet,row,key);
  config().deleteProperty(pendingKey);
}
function auditReports() {
  return Object.keys(roster()).map(name=>{
    const sheet=book().getSheetByName(name);
    return {department:name,sheet_id:sheet?sheet.getSheetId():null,rows:sheet?Math.max(0,sheet.getLastRow()-1):0,
      headers:sheet?sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0]:[],
      formula_cells:sheet&&sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,5).getFormulas().flat().filter(Boolean).length:0};
  });
}
function maintainReports() {
  book().setSpreadsheetTimeZone('Asia/Tashkent');
  const before=Object.keys(roster()).map(name=>{
    const sheet=book().getSheetByName(name);
    if(!sheet)return {name:name,rows:0,hash:reportKey('[]')};
    if(!sheet.getLastRow())return {name:name,rows:0,hash:reportKey('[]')};
    const width=sheet.getLastColumn(),headers=sheet.getRange(1,1,1,width).getValues()[0];
    const columns=REPORT_HEADERS.map(h=>headers.indexOf(h));
    if(columns.some((c,i)=>c<0&&REPORT_HEADERS[i]!=='FISH'))throw new Error('Missing report headers');
    const rows=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,width).getValues():[];
    return {name:name,rows:rows.length,hash:reportKey(JSON.stringify(rows.map(r=>columns.map(c=>normalizeReportValue(c<0?'':r[c])))))};
  });
  Object.keys(roster()).forEach(name=>migrateReportSheet(book().getSheetByName(name)||book().insertSheet(name)));
  const audit=auditReports();
  before.forEach(expected=>{
    const sheet=book().getSheetByName(expected.name),rows=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,5).getValues():[];
    const hash=reportKey(JSON.stringify(rows.map(r=>r.map(normalizeReportValue))));
    if(rows.length!==expected.rows||hash!==expected.hash)throw new Error('Report preservation check failed');
  });
  return {ok:true,preserved:true,departments:audit};
}
function doPost(e){
  const reply=value=>ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
  const lock=LockService.getScriptLock();
  try{
    const data=JSON.parse(e.postData.contents),secret=config().getProperty('SHEETS_SECRET');
    if(!secret||!data||data.secret!==secret)return reply({ok:false});
    lock.waitLock(25000);writeReport(data);return reply({ok:true,batch_id:data.batch_id});
  }catch(error){return reply({ok:false});}
  finally{if(lock.hasLock())lock.releaseLock();}
}

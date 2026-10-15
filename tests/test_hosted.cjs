const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const sheets = new Map();
class Sheet {
  constructor(){this.rows=[];this.metadata=[];this.maxRows=1000;this.maxColumns=26;}
  getName(){return [...sheets.entries()].find(([,v])=>v===this)?.[0]||'test';}
  getMaxRows(){return this.maxRows;}
  getMaxColumns(){return this.maxColumns;}
  insertRowsAfter(_,n){this.maxRows+=n;}
  getSheetId(){return Array.from(sheets.values()).indexOf(this);}
  getLastColumn(){return Math.max(0,...this.rows.map(v=>v.length));}
  deleteColumn(c){this.rows.forEach(v=>v.splice(c-1,1));this.maxColumns--;}
  moveColumns(range,dest){const source=range.column-1;this.rows=this.rows.map(row=>{const values=Array.from({length:Math.max(5,row.length)},(_,i)=>row[i]??'');const [value]=values.splice(source,1);values.splice(dest-1-(source<dest-1?1:0),0,value);return values;});}
  setColumnWidth(){return this;}
  addDeveloperMetadata(key,value){this.metadata.push({key,value,getValue(){return this.value;},setValue(v){this.value=v;return this;}});return this;}
  createDeveloperMetadataFinder(){const self=this;let key,value;return {withKey(k){key=k;return this;},withValue(v){value=v;return this;},find(){return self.metadata.filter(m=>m.key===key&&(value===undefined||m.value===value));}};}
  getLastRow(){return this.rows.length;}
  appendRow(v){this.rows.push(v.slice());return this;}
  setFrozenRows(){return this;}
  hideSheet(){return this;}
  deleteRow(r){this.rows.splice(r-1,1);}
  getRange(r,c,n=1,w=1){const s=this;return {column:c,
    getValues:()=>Array.from({length:n},(_,i)=>Array.from({length:w},(_,j)=>s.rows[r+i-1]?.[c+j-1]??'')),
    setNumberFormat(){return this;},setFontSize(){return this;},setWrap(){return this;},setFontWeight(){return this;},setBackground(){return this;},
    clearContent(){for(let i=0;i<n;i++)for(let j=0;j<w;j++)if(s.rows[r+i-1])s.rows[r+i-1][c+j-1]='';return this;},
    getFormulas:()=>Array.from({length:n},()=>Array(w).fill('')),
    setValues(v){if(s.failRich&&(c===2||w===6||(c===1&&(w===5||w===4))))throw new Error('Sheet write unavailable');v=v.map(row=>row.map(x=>typeof x==='string'&&x.startsWith("'")?x.slice(1):x));v.forEach((row,i)=>{s.rows[r+i-1]??=[];row.forEach((x,j)=>s.rows[r+i-1][c+j-1]=x);});return this;},
    setRichTextValues(v){if(s.failRich)throw new Error('Sheet write unavailable');return this.setValues(v.map(row=>row.map(x=>x.text)));},
    setValue(v){return this.setValues([[v]]);},
    createTextFinder(key){return {matchEntireCell(){return this;},findNext(){const i=s.rows.findIndex((v,i)=>i>=r-1&&i<r-1+n&&String(v[c-1])===key);return i<0?null:{getRow:()=>i+1};}};}
  };}
}
const cache=new Map(), delivered=[];
function fetchSuccess(url,options){delivered.push({route:url.includes('/botmain/')?'main':'admin',method:url.split('/').at(-1),payload:JSON.parse(options.payload)});return {getContentText:()=>'{"ok":true}',getResponseCode:()=>200};}
const props={ADMIN_IDS:'1',SHEETS_SECRET:'s',WEBHOOK_KEY:'w',BOT_TOKEN:'main',ADMIN_BOT_TOKEN:'admin'};
const context={
  console,
  CacheService:{getScriptCache:()=>({get:k=>cache.get(k)||null,put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)})},
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]??null,setProperty:(k,v)=>props[k]=v,getProperties:()=>({...props}),deleteProperty:k=>delete props[k]})},
  SpreadsheetApp:{openById:()=>({getSheets:()=>[...sheets.values()],deleteSheet:s=>sheets.delete(s.getName()),setSpreadsheetTimeZone(){},getSheetByName:n=>sheets.get(n),insertSheet:n=>{const s=new Sheet();sheets.set(n,s);return s;}}),flush(){},newRichTextValue:()=>({setText(text){this.text=text;return this;},build(){return {text:this.text};}})},
  Utilities:{getUuid:()=>require('node:crypto').randomUUID(),formatDate:(date,zone,pattern)=>new Date(date.getTime()+5*3600000).toISOString().slice(0,pattern==='yyyy-MM-dd'?10:19).replace('T',' '),DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,value)=>[...require('node:crypto').createHash('sha256').update(String(value)).digest()],Charset:{UTF_8:'utf8'},base64EncodeWebSafe:v=>Buffer.from(v).toString('base64url'),base64DecodeWebSafe:v=>Buffer.from(v,'base64url'),newBlob:v=>({getDataAsString:()=>v.toString(),getBytes:()=>Buffer.from(v)})},
  LockService:{getScriptLock:()=>({waitLock(){},tryLock:()=>true,releaseLock(){}})},
  ContentService:{createTextOutput:text=>({text,setMimeType(){return this;}}),MimeType:{JSON:'json'}},HtmlService:{createHtmlOutput:text=>({text})},
  UrlFetchApp:{fetch:fetchSuccess}
};
vm.createContext(context);vm.runInContext(fs.readFileSync('hosted_bot.gs','utf8'),context);
const C=context;const dailyWriter=C.writeReport,dailyMaintainer=C.maintainReports;C.writeReport=C.writeDepartmentReport;C.maintainReports=C.maintainDepartmentReports;
function event(route,id,uid,text){return C.doPost({parameter:{route,key:'w'},postData:{contents:JSON.stringify({update_id:id,message:{from:{id:uid,first_name:'Test'},chat:{type:'private'},text}})}});}
function callback(id,actor,data){if(/^(approve|reject|restore|revoke|revokeask):\d+$/.test(data)){const uid=Number(data.split(':')[1]);data+=':'+(C.user(uid)?.revision||0);}C.adminUpdate({callback_query:{id:String(id),from:{id:actor},message:{chat:{type:'private'}},data}});}
C.doPost({parameter:{},postData:{contents:JSON.stringify({secret:'s',action:'import',roster:{Sklad:['Employee','Boshqa'],OSS:['Employee','Boshqa']},users:[{id:1,name:'Admin',status:'approved'}]})}});
event('main',1,2,'/start');assert.equal(C.user(2).status,'pending');assert.equal(C.user(2).notified,undefined);
event('main',100000000001,2,'Karimov Ali Anvar o‘g‘li');assert.equal(C.user(2).fish,'Karimov Ali Anvar o‘g‘li');assert.equal(C.user(2).notified,true);
callback(1,2,'approve:2');assert.equal(C.user(2).status,'pending');
callback(2,1,'approve:2');assert.equal(C.user(2).status,'approved');
event('main',2,2,'📦 Sklad');event('main',3,2,'Employee');event('main',4,2,'Report');
event('main',4,2,'Report');assert.equal(C.draft(2,'Sklad').entries.length,1);
event('main',5,2,'⬅️ Bo‘limlar');assert.equal(C.user(2).active,'');assert.equal(C.draft(2,'Sklad').entries[0].text,'Report');
event('main',6,2,'OSS');assert.equal(C.draft(2,'OSS').entries.length,0);
event('main',7,2,'⬅️ Bo‘limlar');event('main',8,2,'Sklad');event('main',9,2,'✅ Xabarni tasdiqlash');event('main',9,2,'✅ Xabarni tasdiqlash');
assert.equal(sheets.get('Sklad').getLastRow(),2);assert.equal(sheets.get('Sklad').rows[1].length,6);assert.ok(Number.isFinite(sheets.get('Sklad').rows[1][5].getTime()));assert.equal(C.draft(2,'Sklad'),null);
callback(3,1,'revoke:2');assert.equal(C.user(2).status,'revoked');event('main',10,2,'Sklad');assert.equal(C.user(2).active,'');
callback(4,1,'approve:2');assert.equal(C.user(2).status,'revoked');callback(5,1,'restore:2');assert.equal(C.user(2).status,'approved');
callback(6,1,'revoke:1');assert.equal(C.user(1).status,'approved');
C.saveDraft(2,{department:'Sklad',entries:[{employee:'Employee',text:'😀'.repeat(10000)+'=not-a-formula'}],stage:'staff'});
assert.equal(C.draft(2,'Sklad').entries[0].text,'😀'.repeat(10000)+'=not-a-formula');
const count=sheets.get('_BotUpdates').getLastRow();C.doPost({parameter:{route:'main',key:'bad'},postData:{contents:JSON.stringify({update_id:11})}});assert.equal(sheets.get('_BotUpdates').getLastRow(),count);
console.log('Hosted flow: approvals, revocation, draft preservation, duplicate updates, Unicode storage, report dates, webhook authentication passed.');

assert.equal(C.departmentName('📦 Sklad'),'Sklad');
assert.equal(C.departmentName('🛡️ OSS'),'OSS');
C.flushOutbox();
const pending=()=>Object.keys(props).filter(k=>k.startsWith('OUTBOX:'));
assert.equal(pending().length,0);
context.UrlFetchApp.fetch=()=>{throw new Error('temporary');};
event('admin',99,1,'/users');assert.equal(pending().length,1);
context.UrlFetchApp.fetch=fetchSuccess;
for(const k of pending()){const j=JSON.parse(props[k]);j.nextAttemptAt=0;props[k]=JSON.stringify(j);}
C.flushOutbox({triggerUid:'scheduled'});assert.equal(pending().length,0);
const before=delivered.length;event('admin',99,1,'/users');assert.equal(delivered.length,before);
console.log('Property outbox: durable network retry, scheduled lock and duplicate updates passed.');
const legacy=sheets.get('_BotOutbox');
for(let i=0;i<350;i++)legacy.appendRow(['old'+i,'main','sendMessage','{}','sent']);
C.queue('main','sendMessage',{chat_id:1,text:'Current'});C.flushOutbox(true);
assert.equal(delivered.at(-1).payload.text,'Current');
C.flushOutbox();assert.equal(Number(props.OUTBOX_CURSOR),legacy.getLastRow()+1);
console.log('Historical outbox backlog does not delay current replies.');
const fullRoster={};let current;
for(const line of fs.readFileSync('departments.txt','utf8').split('\n').map(x=>x.trim())){
 if(line.startsWith('[')){current=line.slice(1,-1);fullRoster[current]=[];}else if(line)fullRoster[current].push(line);
}
C.doPost({parameter:{},postData:{contents:JSON.stringify({secret:'s',action:'import',roster:fullRoster})}});
let update=1000;
for(const [department,staff] of Object.entries(fullRoster)){
 C.removeDraft(2,department);event('main',update++,2,'⬅️ Bo‘limlar');
 event('main',update++,2,C.departmentLabel(department));
 assert.equal(C.user(2).active,department);
 const welcome=delivered.at(-1),payload=welcome.payload;
 assert.equal(welcome.method,'sendPhoto');assert.ok(payload.photo);assert.ok(payload.caption.includes(C.departmentTitle(department)));
 assert.ok(payload.reply_markup.keyboard.some(r=>r.some(b=>b.text==='✅ Xabarni tasdiqlash'&&b.style==='success')));
 assert.ok(payload.reply_markup.keyboard.some(r=>r.some(b=>b.text==='Boshqa')));
 event('main',update++,2,staff[0]);event('main',update++,2,'First staff report');
 event('main',update++,2,'Boshqa');event('main',update++,2,'Other employee');event('main',update++,2,'Second report');
 const original=C.writeReport;C.writeReport=()=>{throw new Error('Sheet unavailable');};
 event('main',update++,2,'✅ Xabarni tasdiqlash');assert.equal(C.draft(2,department).entries.length,2);
 C.writeReport=original;const rowCount=sheets.get(department)?.getLastRow()||1;
 event('main',update++,2,'✅ Xabarni tasdiqlash');assert.equal(sheets.get(department).getLastRow(),rowCount+2);
 const rows=sheets.get(department).rows.slice(-2);assert.equal(rows[0][0],C.departmentTitle(department));assert.equal(rows[0][1],staff[0]);assert.equal(rows[0][2],'First staff report');assert.equal(rows[1][1],'Other employee');assert.equal(rows[1][2],'Second report');assert.equal(C.draft(2,department),null);
}
assert.equal(Object.keys(fullRoster).length,15);
console.log('All 15 departments: decorated navigation, staff, Other, failed save retry and separate employee sheet rows passed.');

const queuedBefore=legacy.getLastRow();C.queue('main','sendMessage',{chat_id:1,text:'x'.repeat(9000)});assert.equal(legacy.getLastRow(),queuedBefore+1);assert.equal(legacy.rows.at(-1)[4],'sent');
console.log('Large payload fallback delivery passed.');

// Old duplicate IDs remain blocked after the durable recent window is archived.
const priorDeliveries=delivered.length;for(let i=0;i<280;i++)event('admin',10000+i,1,'/start');
assert.equal(delivered.length,priorDeliveries+280);const archivedDeliveries=delivered.length;event('admin',10000,1,'/start');assert.equal(delivered.length,archivedDeliveries);
// Diagnostic IDs do not force normal Telegram IDs into the slow archive lookup.
event('admin',1800000000000,1,'/start');assert.equal(C.seenUpdate('admin',10000),true);
assert.equal(C.seenUpdate('admin',10279),true);
console.log('Durable recent IDs, archive rollover and diagnostic partition passed.');

// A first /id must not suppress the next real access request.
event('main',20001,31,'/id');assert.equal(C.user(31).notified,undefined);
event('main',20002,31,'/start');assert.equal(C.user(31).notified,undefined);
const requestBefore=delivered.length;event('main',100000000002,31,'Nazarov Test Anvarovich');
assert.equal(C.user(31).notified,true);assert.ok(delivered.slice(requestBefore).some(v=>v.route==='admin'&&v.payload.text.includes('31')));
const repeatBefore=delivered.length;event('main',20003,31,'/start');assert.equal(delivered.slice(repeatBefore).filter(v=>v.route==='admin').length,0);
// A stale revoke button cannot act on a later restoration, even with approved status.
callback(20004,1,'approve:31');const oldRevision=C.user(31).revision;
callback(20005,1,'revoke:31');callback(20006,1,'restore:31');
C.adminUpdate({callback_query:{id:'stale',from:{id:1},message:{chat:{type:'private'}},data:'revoke:31:'+oldRevision}});
assert.equal(C.user(31).status,'approved');
// A mirror failure must not commit a permission change and hide the retry.
const u=C.user(31),previousStatus=u.status;u.status='revoked';sheets.get('_BotUsers').failRich=true;
assert.throws(()=>C.saveUser(u));assert.equal(C.user(31).status,previousStatus);
sheets.get('_BotUsers').failRich=false;C.saveUser(u);assert.equal(C.user(31).status,'revoked');callback(20007,1,'restore:31');
console.log('Request notification, stale admin decision and failed status commit regressions passed.');

// Review/undo is local to the active draft. Old controls never become report text.
event('main',20100,31,'Sklad');const employee=fullRoster.Sklad[0];
event('main',20101,31,employee);event('main',20102,31,'First');
event('main',20103,31,employee);event('main',20104,31,'Second');
event('main',20105,31,'👁️ Xabarni ko‘rish');const latest31=delivered.filter(x=>x.payload.chat_id===31).at(-1);assert.ok(latest31.payload.text.includes('First')&&latest31.payload.text.includes('Second'));
event('main',20106,31,'↩️ Oxirgi yozuvni bekor qilish');assert.equal(C.draft(31,'Sklad').entries.length,1);
event('main',20107,31,employee);event('main',20108,31,'👁️ Xabarni ko‘rish');event('main',20109,31,'↩️ Oxirgi yozuvni bekor qilish');
assert.equal(C.draft(31,'Sklad').entries.length,1);assert.equal(C.draft(31,'Sklad').stage,'text');
event('main',20110,31,'❌ Kiritishni bekor qilish');event('main',20111,31,'/help');assert.equal(C.draft(31,'Sklad').entries.length,1);
C.saveDraft(31,{department:'Sklad',entries:[{employee,text:'😀'.repeat(22000)}],stage:'staff'});
event('main',20112,31,'👁️ Xabarni ko‘rish');assert.ok(delivered.at(-1).payload.text.length<=4096);assert.ok(!/[\uD800-\uDBFF]$/.test(delivered.at(-1).payload.text));
console.log('Preview, undo, help, unfinished input and Unicode length regressions passed.');

// Identifier removal preserves every other value and retry identity.
const migrationSheet=new Sheet();migrationSheet.appendRow(['Xabar ID','Sana (Toshkent)','Telegram ID','Yuboruvchi','Bo‘lim','Umumiy xabar']);
migrationSheet.appendRow(['old-batch','2026-10-07 23:59:59','123','Old name','Sklad','Original\nmessage']);
C.migrateReportSheet(migrationSheet);
assert.deepEqual(migrationSheet.rows,[['Bo‘lim','Xodim FISH','Xabar','Yuboruvchi FISH','Yuboruvchi','Sana (Toshkent)'],['Sklad','','Original\nmessage','','Old name','2026-10-07 23:59:59']]);
assert.equal(C.reportMarked(migrationSheet,C.reportKey('old-batch')),true);C.migrateReportSheet(migrationSheet);
const preservation=C.maintainReports();assert.equal(preservation.preserved,true);assert.equal(preservation.departments.length,15);
assert.ok(preservation.departments.every(d=>d.headers.length===6&&!d.headers.includes('Telegram ID')&&!d.headers.includes('Xabar ID')));
// A failure after the cells are written must recover that same row.
const failurePayload={batch_id:'failure-after-write',date:'2026-10-08 22:05:01',sender:'=literal sender',department:'Sklad',message:'=literal text'};
const beforeRows=sheets.get('Sklad').getLastRow(),markOriginal=C.markReport;
C.markReport=()=>{throw new Error('Metadata unavailable');};assert.throws(()=>C.writeReport(failurePayload));
assert.equal(sheets.get('Sklad').getLastRow(),beforeRows+1);C.markReport=markOriginal;C.writeReport(failurePayload);C.writeReport(failurePayload);
assert.equal(sheets.get('Sklad').getLastRow(),beforeRows+1);assert.equal(sheets.get('Sklad').rows.at(-1)[4],'=literal sender');assert.equal(sheets.get('Sklad').rows.at(-1)[2],'=literal text');
assert.equal(Object.keys(props).filter(k=>k.startsWith('REPORT_PENDING:')).length,0);
assert.throws(()=>C.writeReport({...failurePayload,batch_id:'bad-date',date:'invalid'}));
assert.throws(()=>C.writeReport({...failurePayload,batch_id:'bad-department',department:'constructor'}));
for(let i=0;i<60;i++)C.markReport(migrationSheet,2,'aa'+i.toString(16).padStart(30,'0'));
assert.ok(migrationSheet.metadata.every(m=>m.value.length<=1024));assert.equal(migrationSheet.metadata.filter(m=>m.key==='onko_reports:aa').length,3);
console.log('Six-column migration, value preservation, crash retry, literal text, dates and compact metadata passed.');

// Bad requests must be rejected before obtaining a lock or touching sheets.
const originalLock=context.LockService.getScriptLock;let lockCalls=0;
context.LockService.getScriptLock=()=>{lockCalls++;return originalLock();};
C.doPost({parameter:{},postData:{contents:'invalid JSON'}});C.doPost({parameter:{},postData:{contents:'null'}});
C.doPost({parameter:{route:'main',key:'wrong'},postData:{contents:JSON.stringify({update_id:20500})}});assert.equal(lockCalls,0);
context.LockService.getScriptLock=originalLock;
console.log('Malformed JSON, null body and unauthenticated lock avoidance passed.');

// Retry-after must be respected without holding up another user's reply.
C.flushOutbox();context.UrlFetchApp.fetch=()=>({getContentText:()=>'{"ok":false,"parameters":{"retry_after":30}}',getResponseCode:()=>429});
C.queue('main','sendMessage',{chat_id:32,text:'Limited'});C.flushOutbox(true);
const limited=pending().find(k=>JSON.parse(props[k]).payload.chat_id===32);assert.ok(JSON.parse(props[limited]).nextAttemptAt>Date.now()+29000);
context.UrlFetchApp.fetch=fetchSuccess;C.queue('main','sendMessage',{chat_id:32,text:'Wait behind earlier reply'});C.queue('main','sendMessage',{chat_id:33,text:'Other chat'});
const limitBefore=delivered.length;C.flushOutbox(true);assert.equal(delivered.length,limitBefore+1);assert.equal(delivered.at(-1).payload.chat_id,33);
for(const k of pending()){const j=JSON.parse(props[k]);j.nextAttemptAt=0;props[k]=JSON.stringify(j);}C.flushOutbox(true);assert.equal(pending().length,0);
// Decorative photo failure falls back to the text and staff keyboard.
context.UrlFetchApp.fetch=(url,options)=>url.endsWith('/sendPhoto')?{getContentText:()=>'{"ok":false}',getResponseCode:()=>400}:fetchSuccess(url,options);
C.send('main',1,'Staff available',[['Employee']],undefined,'invalid-photo');C.flushOutbox(true);
assert.equal(delivered.at(-1).method,'sendMessage');assert.equal(delivered.at(-1).payload.text,'Staff available');assert.equal(delivered.at(-1).payload.reply_markup.keyboard[0][0].text,'Employee');
context.UrlFetchApp.fetch=fetchSuccess;
console.log('Rate-limit delay, per-chat ordering, independent chat delivery and photo fallback passed.');

// A partially written row is repaired rather than appended again.
const partial={...failurePayload,batch_id:'partial-rich-write',message:'Complete retry'};
const sheet=sheets.get('Sklad'),partialRows=sheet.getLastRow();sheet.failRich=true;
assert.throws(()=>C.writeReport(partial));sheet.failRich=false;C.writeReport(partial);
assert.equal(sheet.getLastRow(),partialRows+1);assert.equal(sheet.rows.at(-1)[2],'Complete retry');
sheet.maxRows=sheet.getLastRow();C.writeReport({...partial,batch_id:'expanded-row',message:'Expanded capacity'});assert.ok(sheet.getMaxRows()>sheet.getLastRow());
console.log('Partial row recovery and sheet capacity extension passed.');

// Registration must happen before notifying the owner or granting access.
const registrationStart=delivered.length;event('main',30000,55,'/start');
assert.equal(C.user(55).fish,undefined);assert.equal(C.user(55).notified,undefined);
assert.equal(delivered.slice(registrationStart).filter(v=>v.route==='admin').length,0);
assert.ok(delivered.at(-1).payload.text.includes('F.I.Sh.'));
callback(30001,1,'approve:55');assert.equal(C.user(55).status,'pending');
let regId=30100;for(const invalid of ['Ali','12345','/start','📦 Sklad','=SUM(1,2)','A'.repeat(151),'👤 Unknown']){
 event('main',regId++,55,invalid);assert.equal(C.user(55).fish,undefined);assert.equal(C.user(55).notified,undefined);
}
const notifyStart=delivered.length;
event('main',regId++,55,'  To‘xtayeva   Umida Alisher qizi  ');
assert.equal(C.user(55).fish,'To‘xtayeva Umida Alisher qizi');assert.equal(C.user(55).status,'pending');
assert.equal(delivered.slice(notifyStart).filter(v=>v.route==='admin').length,1);
assert.ok(delivered.slice(notifyStart).some(v=>v.route==='admin'&&v.payload.text.includes('To‘xtayeva Umida Alisher qizi')));
assert.ok(delivered.filter(v=>v.route==='main'&&v.payload.chat_id===55).at(-1).payload.text.includes('administrator javobini kuting'));
const repeatNotices=delivered.length;
event('main',regId++,55,'/start');event('main',regId++,55,'Another Person Full Name');
assert.equal(sheets.has('Foydalanuvchilar'),false);assert.equal(delivered.slice(repeatNotices).filter(v=>v.route==='admin').length,0);
callback(regId++,1,'approve:55');assert.equal(C.user(55).status,'approved');
event('main',regId++,55,'Sklad');event('main',regId++,55,fullRoster.Sklad[0]);event('main',regId++,55,'FISH report');event('main',regId++,55,'✅ Xabarni tasdiqlash');
assert.equal(sheets.get('Sklad').rows.at(-1)[3],'To‘xtayeva Umida Alisher qizi');
callback(regId++,1,'revoke:55');assert.equal(C.user(55).status,'revoked');
event('main',regId++,55,'Someone Else Full Name');assert.equal(C.user(55).status,'revoked');assert.equal(C.user(55).fish,'To‘xtayeva Umida Alisher qizi');
C.saveUser({id:56,name:'Existing',status:'approved',active:'Sklad'});
event('main',regId++,56,'/start');assert.equal(C.user(56).status,'approved');
const existingBefore=delivered.length;event('main',regId++,56,'Karimov Ali Anvar o‘g‘li');
assert.equal(C.user(56).status,'approved');assert.equal(delivered.slice(existingBefore).filter(v=>v.route==='admin').length,0);
assert.ok(delivered.at(-1).payload.text.includes('Bo‘limni tanlang'));
// A registration storage failure cannot commit FISH or send an approval request.
event('main',regId++,57,'/start');sheets.get('_BotUsers').failRich=true;
assert.throws(()=>event('main',regId++,57,'Karimova Laylo Anvar qizi'));assert.equal(C.user(57).fish,undefined);
sheets.get('_BotUsers').failRich=false;event('main',regId++,57,'Karimova Laylo Anvar qizi');assert.equal(C.user(57).fish,'Karimova Laylo Anvar qizi');
// Small drafts survive cache loss and process restart without creating a sheet row.
const draftRowsBefore=sheets.get('_BotDrafts').getLastRow();
C.saveDraft(56,{department:'Sklad',stage:'staff',entries:[{employee:'Test',text:'Persistent small draft'}]});cache.clear();
assert.equal(C.draft(56,'Sklad').entries[0].text,'Persistent small draft');assert.equal(sheets.get('_BotDrafts').getLastRow(),draftRowsBefore);
C.saveDraft(56,{department:'Sklad',stage:'staff',entries:[{employee:'Test',text:'😀'.repeat(10000)}]});cache.clear();
assert.equal(C.draft(56,'Sklad').entries[0].text,'😀'.repeat(10000));assert.equal(props['DRAFT:56:Sklad'],undefined);
C.saveDraft(56,{department:'Sklad',stage:'staff',entries:[{employee:'Test',text:'Small again'}]});cache.clear();assert.equal(C.draft(56,'Sklad').entries[0].text,'Small again');
C.removeDraft(56,'Sklad');assert.equal(C.draft(56,'Sklad'),null);
console.log('FISH onboarding, validation, one approval request, admin-only users/status, report sender, existing permissions, storage retries and fast durable drafts passed.');

const propertyFactory=context.PropertiesService.getScriptProperties;
context.PropertiesService.getScriptProperties=()=>{const original=propertyFactory();return {...original,setProperty(k,v){if(k.startsWith('DRAFT:'))throw new Error('Property quota');return original.setProperty(k,v);}}};
vm.runInContext('PROPS_CACHE=null',context);C.saveDraft(56,{department:'Sklad',stage:'staff',entries:[{employee:'Test',text:'Quota fallback'}]});cache.clear();
assert.equal(C.draft(56,'Sklad').entries[0].text,'Quota fallback');
context.PropertiesService.getScriptProperties=propertyFactory;vm.runInContext('PROPS_CACHE=null',context);C.removeDraft(56,'Sklad');
assert.equal(C.validFish('Иванов Иван Иванович'),true);assert.equal(C.validFish('Oʻrinova Ma’suda Ali qizi'),true);
assert.equal(C.validFish('Test\n\nName Full'.replace(/\s+/g,' ')),true);assert.equal(C.validFish('123 Test Name'),false);
console.log('Script Properties quota fallback and multilingual full names passed.');

const reordered=new Sheet();reordered.appendRow(['Sana (Toshkent)','Yuboruvchi','Bo‘lim','Umumiy xabar','FISH']);
const originalDate=new Date('2026-10-09T01:15:30+05:00');reordered.appendRow([originalDate,'Telegram name','Sklad','Preserved report','Full Name Patronymic']);
C.migrateReportSheet(reordered);assert.equal(reordered.rows[1][3],'Full Name Patronymic');assert.equal(reordered.rows[1][5],originalDate);assert.equal(reordered.rows[1][2],'Preserved report');
C.migrateReportSheet(reordered);assert.equal(reordered.rows[1][3],'Full Name Patronymic');
assert.equal(sheets.has('Foydalanuvchilar'),false);console.log('Employee layout preserves sender names, original Date objects and existing messages; directory is never recreated.');

const split=new Sheet();split.appendRow(['FISH','Yuboruvchi','Bo‘lim','Umumiy xabar','Sana (Toshkent)']);
split.appendRow(['Sender Full Name','Account','Sklad','1. First Employee\nFirst message\nwith lines\n\n2. Second Employee\n=SUM(1,2)',originalDate]);
C.migrateReportSheet(split);assert.equal(split.rows.length,3);assert.deepEqual(split.rows[1],['Sklad','First Employee','First message\nwith lines','Sender Full Name','Account',originalDate]);assert.equal(split.rows[2][1],'Second Employee');assert.equal(split.rows[2][2],'=SUM(1,2)');C.migrateReportSheet(split);assert.equal(split.rows.length,3);
const multi={...failurePayload,batch_id:'multi-crash',entries:[{employee:'One Employee',text:'Message one'},{employee:'Two Employee',text:'Message two'}]};
const multiBefore=sheet.getLastRow();let employeeMarkCount=0;C.markReport=(...args)=>{if(++employeeMarkCount===2)throw new Error('second employee storage failure');return markOriginal(...args);};
assert.throws(()=>C.writeReport(multi));C.markReport=markOriginal;C.writeReport(multi);C.writeReport(multi);assert.equal(sheet.getLastRow(),multiBefore+2);assert.deepEqual(sheet.rows.slice(-2).map(r=>r.slice(1,3)),[['One Employee','Message one'],['Two Employee','Message two']]);
console.log('Employee rows, legacy report splitting, multiline text preservation and partial batch retry passed.');

C.writeReport=dailyWriter;C.maintainReports=dailyMaintainer;
const dailyPayload={batch_id:'daily-two-staff',date:'2026-10-09 00:00:01',sender:'Must not be stored',fish:'Foydalanuvchi Full Name',department:'Sklad',entries:[{employee:'First Employee',text:'First message'},{employee:'Second Employee',text:'Second message'}]};
C.writeReport(dailyPayload);C.writeReport(dailyPayload);const daily=sheets.get('2026-10-09');assert.equal(daily.getLastRow(),3);assert.deepEqual(Array.from(daily.rows[0]),['Bo‘lim','Xodim FISH','Xabar','Foydalanuvchi FISH','Sana (Toshkent)']);assert.equal(daily.rows[1][3],dailyPayload.fish);assert.equal(daily.rows.flat().includes(dailyPayload.sender),false);
C.writeReport({...dailyPayload,department:'OSS',batch_id:'same-day-another-dept',entries:[{employee:'OSS Employee',text:'OSS report'}]});assert.equal(daily.rows.at(-1)[0],'OSS');
C.writeReport({...dailyPayload,batch_id:'previous-day',date:'2026-10-08 23:59:59'});assert.equal(sheets.get('2026-10-08').getLastRow(),3);
const dayBefore=daily.getLastRow();let dailyMarks=0;C.markReport=(...args)=>{if(++dailyMarks===2)throw new Error('mid-batch');return markOriginal(...args);};assert.throws(()=>C.writeReport({...dailyPayload,batch_id:'daily-retry'}));C.markReport=markOriginal;C.writeReport({...dailyPayload,batch_id:'daily-retry'});assert.equal(daily.getLastRow(),dayBefore+2);
assert.equal(Object.keys(props).filter(k=>k.startsWith('DAILY_PENDING:')).length,0);
const migrationDaily=C.maintainReports();assert.equal(migrationDaily.preserved,true);const countDaily= [...sheets.values()].reduce((n,s)=>n+s.getLastRow(),0);C.maintainReports();assert.equal([...sheets.values()].reduce((n,s)=>n+s.getLastRow(),0),countDaily);
console.log('Daily grouping, entered user FISH, no Telegram nickname, midnight boundary, partial retries and idempotent migration passed.');

let dailyUpdate=40000;for(const [dept,employees] of Object.entries(fullRoster)){
 event('main',dailyUpdate++,2,'⬅️ Bo‘limlar');event('main',dailyUpdate++,2,dept);event('main',dailyUpdate++,2,employees[0]);event('main',dailyUpdate++,2,'Daily integration report');event('main',dailyUpdate++,2,'✅ Xabarni tasdiqlash');
 const today=sheets.get(C.dailyName(new Date())),row=today.rows.at(-1);assert.equal(row[0],C.departmentTitle(dept));assert.equal(row[1],employees[0]);assert.equal(row[2],'Daily integration report');assert.equal(row[3],C.user(2).fish);
}
console.log('All 15 real bot department flows now write employee and entered user FISH into the same daily worksheet.');

const dashboardRecords=[['Sklad','Ali Employee','First meaningful report','Full User Name','2026-10-09 00:00:01'],['OSS','Second Employee','Short','Full User Name','2026-10-08 23:59:59'],['Sklad','Ali Employee','More detailed report','Other User Name','2026-10-09 08:00:00']];
const snapshot=C.dashboardSnapshot(dashboardRecords,['Sklad','OSS','Reanimatsiya'],'2026-10-09');
assert.equal(snapshot.total,3);assert.equal(snapshot.today,2);assert.equal(snapshot.users,2);assert.equal(snapshot.activeDepartments,2);assert.equal(snapshot.employees,2);assert.equal(snapshot.shortText,1);assert.equal(snapshot.missingFish,0);assert.equal(snapshot.departments.reduce((n,r)=>n+r[1],0),3);assert.equal(snapshot.days.reduce((n,r)=>n+r[1],0),3);
const privateInput=C.dashboardAIInput([['Sklad','Ali Employee','Ali Employee wrote about Full User Name','Full User Name','2026-10-09 00:00:01']],snapshot);assert.equal(JSON.stringify(privateInput).includes('Ali Employee'),false);assert.equal(JSON.stringify(privateInput).includes('Full User Name'),false);
assert.equal(C.requestDashboardAI(privateInput),null);assert.throws(()=>C.dashboardAIResponse('{"summary":12,"issues":[],"actions":[]}'));
const parsedAI=C.dashboardAIResponse('{"summary":"Insufficient evidence","issues":[],"actions":["Ask for clarification"]}');assert.equal(parsedAI.actions[0],'Ask for clarification');
assert.equal(C.dashboardSnapshot([],['Sklad'],'2026-10-09').total,0);
const overLimit=C.dashboardAIInput(Array.from({length:210},(_,i)=>['Sklad','Employee','x'.repeat(2000),'User Name','2026-10-09 00:00:01']),snapshot);assert.equal(overLimit.reports.length,200);assert.equal(overLimit.reports[0].text.length,1500);
console.log('Dashboard totals reconcile; dates, distinct names, short-text counts, privacy filtering, AI limits, consent/key gating and response validation passed.');

const dmedFixture={departments:['Sklad','OSS'],reports:[{department:'Sklad',date:'2026-10-09',ref:'2026-10-09!C2',text:'DMED’da qabul kiritiladi, davolash kursi ishlatilmaydi.'},{department:'OSS',date:'2026-10-09',ref:'2026-10-09!C3',text:'Тест: DMED ishlamayapti.'}]};
const dm={summary:'One limited observation.',departments:[{department:'Sklad',status:'Qisman foydalanilmoqda',finding:'Only the described processes are assessed.',action:'Check module training.',evidence:[{ref:'2026-10-09!C2',quote:'davolash kursi ishlatilmaydi'}]},{department:'OSS',status:'Dalil yetarli emas',finding:'Only test data.',action:'Ask for a real report.',evidence:[]}]};
assert.equal(C.dmedAIResponse(JSON.stringify(dm),dmedFixture).departments[0].status,'Qisman foydalanilmoqda');
for(const mutate of [d=>d.departments[0].evidence[0].quote='Invented evidence',d=>d.departments[0].evidence[0].ref='2026-10-09!C3',d=>d.departments[0].evidence=[],d=>d.departments.pop(),d=>d.departments[1]={...d.departments[0]},d=>d.departments[1].evidence=[{ref:'2026-10-09!C3',quote:'DMED ishlamayapti'}],d=>d.departments[0].status='Ziddiyatli dalillar']){const v=JSON.parse(JSON.stringify(dm));mutate(v);assert.throws(()=>C.dmedAIResponse(JSON.stringify(v),dmedFixture));}
const emptyDmed=C.dmedEmpty(dmedFixture);assert.ok(emptyDmed.departments.every(d=>d.status==='Dalil yetarli emas'));
const dmedPeriod=C.dmedInput([['Sklad','Staff','old record','User','2020-01-01 00:00:00','2020-01-01!C2'],['Sklad','Staff','new record','User',new Date(),'today!C2']]);assert.equal(dmedPeriod.reports.length,1);assert.equal(dmedPeriod.reports[0].ref,'today!C2');assert.equal(dmedPeriod.focus,'DMED tizimidan amalda foydalanish');
console.log('DMED content assessment: exact evidence, same-department sources, test exclusion, missing/duplicate departments, conflict support, unknown states and 30-day window passed.');

const staffRows=[['Sklad','Ali Employee','DMED’da qabul to‘liq kiritilgan.','Sender Full Name','2026-10-09 10:00:00','2026-10-09!C2'],['OSS','Other Employee','DMED modulini o‘rganish uchun yordam kerak.','Another Sender','2026-10-09 10:01:00','2026-10-09!C3']];
const staffInput={period:{from:'2026-10-09',to:'2026-10-09'},reports:staffRows.map(r=>({department:r[0],text:r[2],date:'2026-10-09',ref:r[5],employee_code:C.staffCode(r[1])}))};
const staffResult={positive:[{employee_code:C.staffCode('Ali Employee'),reason:'Qabul kiritilgan.',evidence:[{ref:'2026-10-09!C2',quote:'qabul to‘liq kiritilgan'}]}],support:[{employee_code:C.staffCode('Other Employee'),reason:'Modul bo‘yicha o‘qitish.',evidence:[{ref:'2026-10-09!C3',quote:'o‘rganish uchun yordam kerak'}]}]};
const staffValidated=C.staffAIResponse(staffResult,staffInput);assert.equal(C.staffDisplay(staffValidated.positive[0],staffRows).fish,'Ali Employee');assert.equal(C.staffCode(' Ali  Employee '),C.staffCode('ali employee'));assert.equal(C.staffCode('Boshqa'),'');
assert.equal(C.staffDisplay(staffValidated.positive[0],[]),null);
for(const mutate of [v=>v.positive[0].employee_code='Unknown',v=>v.positive[0].evidence[0].ref='2026-10-09!C3',v=>v.positive[0].evidence[0].quote='Invented quote',v=>v.positive[0].evidence=[],v=>v.support.push(v.positive[0]),v=>v.positive=Array(6).fill(v.positive[0])]){const v=JSON.parse(JSON.stringify(staffResult));mutate(v);assert.throws(()=>C.staffAIResponse(v,staffInput));}
assert.throws(()=>C.staffAIResponse(staffResult,{...staffInput,period:{from:'2026-10-10',to:'2026-10-10'}}));
assert.deepEqual(JSON.parse(JSON.stringify(C.staffAIResponse({positive:[],support:[]},staffInput))),{positive:[],support:[]});
const privacyStaff=C.dmedInput(staffRows.map(r=>[r[0],r[1],r[1]+' reports about '+r[3],r[3],new Date(),r[5]]));assert.ok(privacyStaff.reports.every(r=>r.employee_code.startsWith('E_')));assert.equal(JSON.stringify(privacyStaff).includes('Ali Employee'),false);assert.equal(JSON.stringify(privacyStaff).includes('Sender Full Name'),false);
C.saveStaff('positive',staffValidated.positive);assert.equal(C.loadStaff('positive')[0].employee_code,staffResult.positive[0].employee_code);C.saveStaff('positive',[]);assert.equal(C.loadStaff('positive').length,0);
const staffView=new Map(),heights=new Map();const viewSheet={setRowHeights(r,n,h){for(let i=0;i<n;i++)heights.set(r+i,h);},getRowHeight:r=>heights.get(r),setRowHeight:(r,h)=>heights.set(r,h),getRange:(r,c)=>({setValue:v=>staffView.set(r+':'+c,v)})};
C.renderStaff(viewSheet,staffValidated,staffRows,true,'2026-10-09');assert.ok(staffView.get('18:1').includes('Ali Employee'));assert.ok(staffView.get('18:8').includes('Other Employee'));assert.ok(staffView.get('18:4').includes('2026-10-09!C2'));
C.renderStaff(viewSheet,{positive:[],support:[]},staffRows,false,'2026-10-10');assert.equal(staffView.get('19:1'),'');assert.ok(staffView.get('18:1').includes('kutilmoqda'));assert.equal([...staffView.values()].some(v=>String(v).includes('Ali Employee')),false);
console.log('Daily staff lists: private codes, local FISH mapping, five-item limit, exact employee/date evidence, no duplicates, empty data, persistence and next-day stale-name clearing passed.');
const geminiOld=context.UrlFetchApp.fetch;let geminiPayload;
props.GEMINI_API_KEY='test-only-key';props.DASHBOARD_AI_ALLOWED='yes';
const mockResponse={report_assessments:staffInput.reports.map(r=>({ref:r.ref,state:'unknown'})),summary:'Daily content observations.',departments:['Sklad','OSS'].map(department=>({department,status:'Dalil yetarli emas',finding:'Insufficient department-wide evidence.',action:'Verify reports.',evidence:[]})),...staffResult};
context.UrlFetchApp.fetch=(url,options)=>{geminiPayload=JSON.parse(options.payload);assert.ok(url.endsWith(':generateContent'));return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(mockResponse)}]}}]})};};
const apiResult=C.requestDashboardAI({...staffInput,departments:['Sklad','OSS']});assert.equal(apiResult.positive.length,1);assert.ok(geminiPayload.generationConfig.responseSchema.required.includes('positive'));assert.equal(JSON.stringify(geminiPayload).includes('Ali Employee'),false);assert.equal(JSON.stringify(geminiPayload).includes('test-only-key'),false);
const invalidMixed=JSON.parse(JSON.stringify(mockResponse));invalidMixed.departments[0].evidence=[{ref:'missing',quote:'unsupported quote'}];const verified=C.verifiedDashboardAI(invalidMixed,{...staffInput,departments:['Sklad','OSS']});assert.equal(verified.departments[0].status,'Dalil yetarli emas');assert.equal(verified.departments[0].evidence.length,0);assert.equal(verified.departments[1].status,mockResponse.departments[1].status);
const retrySuccess=context.UrlFetchApp.fetch;let transientCalls=0,sleeps=[];context.Utilities.sleep=n=>sleeps.push(n);
context.UrlFetchApp.fetch=(...args)=>++transientCalls<3?{getResponseCode:()=>503}:retrySuccess(...args);
assert.equal(C.requestDashboardAI({...staffInput,departments:['Sklad','OSS']}).positive.length,1);assert.equal(transientCalls,3);assert.deepEqual(sleeps,[1000,2000]);
transientCalls=0;context.UrlFetchApp.fetch=()=>{transientCalls++;return {getResponseCode:()=>503};};assert.throws(()=>C.requestDashboardAI(staffInput),/HTTP 503/);assert.equal(transientCalls,3);
transientCalls=0;context.UrlFetchApp.fetch=()=>{transientCalls++;return {getResponseCode:()=>401};};assert.throws(()=>C.requestDashboardAI(staffInput),/HTTP 401/);assert.equal(transientCalls,1);
context.UrlFetchApp.fetch=geminiOld;delete props.GEMINI_API_KEY;
console.log('Gemini request/response contract with private staff codes and structured daily lists passed using a mock service; live Gemini still requires a user key.');

assert.equal(C.dashboardPeriod(['2026-10-08','2026-10-09']).from,'2026-10-08');
for(const dates of [['2026-10-10','2026-10-09'],['bad','2026-10-09'],['2026-02-30','2026-03-02'],['','2026-10-09']])assert.throws(()=>C.dashboardPeriod(dates));
const boundaryRows=[['Sklad','A','start','U','2026-10-08 00:00:00','a'],['OSS','B','end','U','2026-10-09 23:59:59','b'],['OSS','C','outside','U','2026-10-10 00:00:00','c']];
const dateFiltered=C.dmedInput(boundaryRows,{from:'2026-10-08',to:'2026-10-09'});assert.equal(dateFiltered.reports.length,2);assert.equal(dateFiltered.coverage.total,2);assert.equal(dateFiltered.reports[1].ref,'b');
assert.equal(C.staffAIResponse(staffResult,{...staffInput,period:{from:'2026-10-08',to:'2026-10-10'}}).positive.length,1);
assert.deepEqual(['Foydalanilmoqda','Qisman foydalanilmoqda','Foydalanilmayapti','Texnik to‘siq','Ziddiyatli dalillar','Dalil yetarli emas'].map(C.dashboardCategory),[0,1,2,2,3,3]);
console.log('Date filters: inclusive Tashkent boundaries, invalid/reversed dates, period-wide employee evidence and percentage category mapping passed.');

const reportingSummary=C.reportingDepartments(boundaryRows,{from:'2026-10-08',to:'2026-10-09'});assert.equal(reportingSummary.length,2);assert.equal(reportingSummary.reduce((n,r)=>n+r.reports,0),2);assert.equal(C.reportingDepartments(boundaryRows,{from:'2026-10-11',to:'2026-10-12'}).length,0);
const duplicateStaff=C.reportingDepartments([boundaryRows[0],boundaryRows[0]],{from:'2026-10-08',to:'2026-10-09'});assert.equal(duplicateStaff[0].reports,2);assert.equal(duplicateStaff[0].employees,1);
console.log('Reporting departments: selected-period inclusion, empty periods, message totals and unique employee counts passed.');
const linkDay='2026-10-09';if(!sheets.has(linkDay))sheets.set(linkDay,new Sheet());
const direct=C.dashboardDailyTarget(staffRows,{from:'2026-10-09',to:'2026-10-09'},['Sklad']);assert.equal(direct.range,'A2:E2');assert.equal(direct.id,sheets.get(linkDay).getSheetId());
const absent=C.dashboardDailyTarget(staffRows,{from:'2026-10-09',to:'2026-10-09'},['Reanimatsiya']);assert.equal(absent.range,'A1:E1');
let linkFormula='';C.dashboardLinkedValue({setFormula:v=>linkFormula=v},direct,'33%');assert.ok(linkFormula.includes('&range=A2:E2'));assert.ok(!linkFormula.includes('Davr hisobotlari'));
const overviewCells=new Map(),overviewSheet={getRange:(r,c)=>({setValue(v){overviewCells.set(r+':'+c,v);return this;},setFormula(v){overviewCells.set(r+':'+c,v);return this;},setNote(){return this;},setBackground(){return this;},setFontWeight(){return this;},setNumberFormat(){return this;},setFontSize(){return this;}}),...viewSheet};overviewSheet.getRange=(r,c)=>({clearContent(){return this;},setValue(v){overviewCells.set(r+':'+c,v);return this;},setFormula(v){overviewCells.set(r+':'+c,v);return this;},setNote(){return this;},setBackground(){return this;},setFontWeight(){return this;},setNumberFormat(){return this;},setFontSize(){return this;}});
const overviewInput={departments:Object.keys(C.roster()).map(C.departmentTitle),reports:[],period:{from:'2026-10-09',to:'2026-10-09'}};C.renderDashboard(overviewSheet,overviewInput,C.dmedEmpty(overviewInput),'No AI',false,staffRows);assert.equal(Array.from({length:15},(_,i)=>overviewCells.get((29+i)+':1')).filter(Boolean).length,15);assert.equal(Array.from({length:15},(_,i)=>overviewCells.get((29+i)+':7')).filter(v=>v==='Ma’lumot kelgan').length,2);assert.equal(Array.from({length:15},(_,i)=>overviewCells.get((29+i)+':7')).filter(v=>v==='Ma’lumot kelmagan').length,13);
console.log('All 15 departments, received/missing states and direct daily-row links passed.');
const rated=C.dmedEmpty(overviewInput);rated.departments[0].status='Foydalanilmoqda';rated.departments[1].status='Qisman foydalanilmoqda';rated.departments[2].status='Foydalanilmayapti';rated.departments[3].status='Texnik to‘siq';C.renderDashboard(overviewSheet,overviewInput,rated,'Mock AI',true,staffRows);assert.equal(overviewCells.has('A6:undefined'),false);console.log('Three DMED categories use 15 departments; technical obstacles remain unclassified, not poor usage.');

// Review all 100 entries, edit by number, preserve cancellation and prevent entry 101.
C.saveUser({id:909,status:'approved',fish:'Test User Full Name',active:'Sklad'});
const reviewDraft={department:'Sklad',stage:'staff',entries:Array.from({length:100},(_,i)=>({employee:'Employee '+i,text:'Original message '+i}))};C.saveDraft(909,reviewDraft);
let reviewId=80000;event('main',reviewId++,909,'👁️ Xabarni ko‘rish');assert.ok(delivered.at(-1).payload.text.includes('10. Employee 9'));assert.ok(!delivered.at(-1).payload.text.includes('11. Employee 10'));
for(let i=0;i<9;i++)event('main',reviewId++,909,'Keyingi 10 ta ▶️');assert.ok(delivered.at(-1).payload.text.includes('100. Employee 99'));assert.equal(C.draft(909,'Sklad').reviewPage,9);
event('main',reviewId++,909,'✏️ Xabarni tahrirlash');event('main',reviewId++,909,'✏️ 100. Employee 99');assert.equal(C.draft(909,'Sklad').stage,'edittext');
event('main',reviewId++,909,'Corrected final message');assert.equal(C.draft(909,'Sklad').entries[99].text,'Corrected final message');assert.equal(C.draft(909,'Sklad').entries.length,100);
event('main',reviewId++,909,'✏️ Xabarni tahrirlash');event('main',reviewId++,909,'✏️ 1. Employee 0');assert.equal(C.draft(909,'Sklad').stage,'editpick');
event('main',reviewId++,909,'✏️ 100. Employee 99');event('main',reviewId++,909,'❌ Kiritishni bekor qilish');assert.equal(C.draft(909,'Sklad').entries[99].text,'Corrected final message');
event('main',reviewId++,909,fullRoster.Sklad[0]);assert.equal(C.draft(909,'Sklad').stage,'staff');assert.equal(C.draft(909,'Sklad').entries.length,100);
while(pending().length)C.flushOutbox();
const chunksStart=delivered.length;C.sendReviewText(909,'A'.repeat(3499)+'😀'+'B'.repeat(8000),[['Back']]);C.flushOutbox();const chunks=delivered.slice(chunksStart).map(v=>v.payload.text).filter(Boolean);assert.equal(chunks.join(''),'A'.repeat(3499)+'😀'+'B'.repeat(8000));assert.ok(chunks.every(t=>t.length<=3500&&!/[\uD800-\uDBFF]$/.test(t)));
console.log('100-entry paginated review, exact-entry editing, cancellation, stale selection rejection, entry limit and complete Unicode previews passed.');
const insightRecords=[['Sklad','Ali','Message','Sender',new Date('2026-10-08T19:00:00Z'),'2026-10-09!C2'],['Sklad','Ali','Message 2','Sender',new Date('2026-10-09T15:00:00Z'),'2026-10-09!C3'],['OSS','Vali','Message 3','Sender',new Date('2026-10-11T01:00:00Z'),'2026-10-11!C2']];
const insightsInput={...overviewInput,period:{from:'2026-10-09',to:'2026-10-11'}},insightData=C.dashboardInsightsData(insightRecords,insightsInput,rated,true);
assert.equal(insightData.total,3);assert.equal(insightData.employees,2);assert.equal(insightData.received,2);assert.equal(insightData.technical,1);assert.equal(insightData.classified,3);assert.equal(insightData.states.reduce((n,v)=>n+v.count,0),15);assert.equal(insightData.departments.length,15);assert.deepEqual(Array.from(insightData.days,r=>Array.from(r)),[['2026-10-09',2,1],['2026-10-10',0,0],['2026-10-11',1,1]]);
const noInsights=C.dashboardInsightsData([],insightsInput,rated,false);assert.equal(noInsights.total,0);assert.equal(noInsights.classified,0);assert.equal(noInsights.states[5].count,15);assert.ok(noInsights.departments.every(d=>d.status==='Dalil yetarli emas'));
console.log('Dashboard insights reconcile 15 categories, unique employees, selected dates, zero-report days, technical obstacles and missing AI.');

const hydrated={departments:[{department:'Sklad',evidence:[{ref:'r1',quote:'model paraphrase'}]}],positive:[],support:[]};C.hydrateAIEvidence(hydrated,{reports:[{department:'Sklad',ref:'r1',text:'Bemor harakatida ishlayapti, davolash kursida ishlamayapti'}]});assert.equal(hydrated.departments[0].evidence[0].quote,'Bemor harakatida ishlayapti, davolash kursida ishlamayapti');const foreign={departments:[{department:'Sklad',evidence:[{ref:'r2'}]}]};C.hydrateAIEvidence(foreign,{reports:[{department:'OSS',ref:'r2',text:'Server xatosi'}]});assert.equal(foreign.departments[0].evidence[0].quote,undefined);console.log('AI evidence hydration preserves exact source and rejects cross-department references.');

const ossRule={departments:[{department:'OSS',status:'Texnik to‘siq'}]};C.applyDepartmentRules(ossRule,{reports:[{department:'OSS',ref:'oss1',date:'2026-10-09',text:"Bo‘limdan DMED orqali biks tushmaydi, tizim ishlamayapti."}]});assert.equal(ossRule.departments[0].status,'Foydalanilmayapti');assert.equal(ossRule.departments[0].evidence[0].ref,'oss1');console.log('OSS dependency classification preserves source and maps unavailable biks flow to non-use.');

const extraStats=C.additionalDashboardStats([['Sklad','X','Davolash kursida ishlamayapti, bemor harakatida ishlaydi','Ali Vali','2026-10-09 12:00:00']],{from:'2026-10-09',to:'2026-10-10'});assert.equal(extraStats.people,1);assert.equal(extraStats.emptyDays,1);assert.equal(extraStats.average,.5);assert.equal(extraStats.course,1);assert.equal(extraStats.movement,1);assert.equal(C.dashboardPublicText('AI tahlili va AI XULOSASI').includes('AI'),false);console.log('Six extra statistics reconcile selected dates and remove AI labels.');
const legendSummary=C.dashboardStatusGroups(insightData);assert.equal(legendSummary.total,15);assert.equal(legendSummary.counts.reduce((n,x)=>n+x,0),15);assert.deepEqual(Array.from(legendSummary.counts.slice(0,4)),[1,1,1,1]);
const legendCells=new Map(),legendSheet={getSheetId:()=>1282358378,setRowHeight(){},setRowHeights(){},getRange(a){const r={breakApart(){return this;},clear(){return this;},merge(){return this;},setValue(v){legendCells.set(a,v);return this;},setFormula(v){legendCells.set(a,v);return this;},setNote(){return this;}};for(const k of ['setFontFamily','setFontSize','setWrap','setVerticalAlignment','setBackground','setFontColor','setFontWeight','setHorizontalAlignment'])r[k]=()=>r;return r;}};
C.renderDashboardLegend(legendSheet,insightData,true,insightRecords,insightsInput);for(const [cell,target] of [['A7:D8','A10:D12'],['E7:I8','E10:I12'],['J7:N8','J10:N12']]){assert.ok(legendCells.get(cell).includes('#gid=1282358378&range='+target));assert.ok(legendCells.get(cell).includes('6.7%'));}assert.ok(legendCells.get('A13:N13').includes('12 / 15'));console.log('Top-card percentages reconcile all 15 departments, preserve unclassified remainder and link only to category department lists.');
props.DASHBOARD_RUNNING_AT=String(Date.now());delete props.DASHBOARD_REFRESH_PENDING;C.refreshDashboard(true);assert.equal(props.DASHBOARD_REFRESH_PENDING,'yes');delete props.DASHBOARD_RUNNING_AT;delete props.DASHBOARD_REFRESH_PENDING;console.log('Date refresh requested during an active run is queued instead of discarded.');
// Role boundaries must hold even for forged callbacks and direct handler calls.
props.REGULAR_ADMIN_IDS='2';
const roleTarget={id:880,status:'pending',fish:'Test User',revision:0};C.saveUser(roleTarget);
C.decide(2,880,'approve',0);assert.equal(C.user(880).status,'pending');
C.decide(1,880,'approve',0);assert.equal(C.user(880).status,'approved');
C.manageAdmin(2,880,false);assert.equal(C.regularAdmins().includes(880),false);
C.manageAdmin(1,880,false);assert.equal(C.regularAdmins().includes(880),true);
C.decide(2,880,'revoke',1);assert.equal(C.user(880).status,'approved');
C.manageAdmin(2,880,true);assert.equal(C.regularAdmins().includes(880),true);
C.manageAdmin(1,1,true);assert.equal(C.superAdmin(),1);
C.manageAdmin(1,880,true);assert.equal(C.regularAdmins().includes(880),false);
C.decide(2,880,'revoke',1);assert.equal(C.user(880).status,'revoked');
C.decide(2,880,'restore',2);assert.equal(C.user(880).status,'revoked');
delete props.REGULAR_ADMIN_IDS;
console.log('Two admin roles: owner-only promotion/demotion, protected admins, ordinary-client revocation only, forged actions rejected.');
function requestMessage(id,text){C.adminUpdate({message:{from:{id,first_name:'Applicant'},chat:{type:'private'},text}});}
requestMessage(991,'/start');assert.equal(C.adminRequest(991).status,'awaiting_fish');
requestMessage(991,'123');assert.equal(C.adminRequest(991).status,'awaiting_fish');
requestMessage(991,'Karimov Ali Anvar o‘g‘li');assert.equal(C.adminRequest(991).status,'pending');
const requestRev=C.adminRequest(991).revision;
requestMessage(991,'/start');assert.equal(C.adminRequest(991).revision,requestRev);
C.decideAdminRequest(992,991,'reqapprove',requestRev);assert.equal(C.admins().includes(991),false);
C.decideAdminRequest(1,991,'reqapprove',requestRev);assert.equal(C.admins().includes(991),true);
C.decideAdminRequest(1,991,'reqreject',requestRev);assert.equal(C.adminRequest(991).status,'approved');
requestMessage(993,'/start');requestMessage(993,'Test Other Applicant');
C.decideAdminRequest(991,993,'reqapprove',C.adminRequest(993).revision);assert.equal(C.admins().includes(993),false);
C.decideAdminRequest(1,993,'reqreject',C.adminRequest(993).revision);assert.equal(C.admins().includes(993),false);assert.equal(C.adminRequest(993).status,'rejected');
console.log('Admin onboarding: FISH validation, waiting, duplicate start, owner-only decision, stale decision and rejected access passed.');
const fourteenInput={...insightsInput,departments:insightsInput.departments.slice(0,14)};
const fourteen=C.dashboardInsightsData([],fourteenInput,C.dmedEmpty(fourteenInput),false);
assert.equal(fourteen.states[5].count,14);assert.equal(C.dashboardDepartmentMatrix(fourteen).length,15);
assert.ok(C.dashboardDepartmentMatrix(fourteen).every(r=>r.length===7));
assert.equal(C.dashboardDepartmentMatrix(insightData).length,16);
console.log('Dashboard roster shrink: 14 departments produce exactly 15 matrix rows, seven columns and 14 unclassified states.');
const ossCyrillic={departments:[{department:'OSS',status:'Texnik to‘siq',evidence:[]}]};
C.applyDepartmentRules(ossCyrillic,{reports:[{department:'OSS',text:'Бўлимлар DMED орқали бикс юбормайди.',ref:'2026-10-12!C8',date:'2026-10-12'}]});assert.equal(ossCyrillic.departments[0].status,'Foydalanilmayapti');
const refreshBefore=C.refreshDashboard;let forced=false;C.refreshDashboard=v=>forced=v;props.DMED_AI_HASH='cached';props.DMED_AI_ATTEMPT='123';C.reanalyzeDashboard();assert.equal(props.DMED_AI_HASH,undefined);assert.equal(props.DMED_AI_ATTEMPT,undefined);assert.equal(forced,true);C.refreshDashboard=refreshBefore;
console.log('Cyrillic OSS dependency and explicit reanalysis cache invalidation passed.');
const regressionInput={departments:['Kunduzgi shifoxona','Operatsiya bloki','Qabul bo‘limi'],period:{from:'2026-10-12',to:'2026-10-12'},reports:[{department:'Kunduzgi shifoxona',ref:'2026-10-12!C69',text:'дори расход кмидила умуман',date:'2026-10-12'},{department:'Kunduzgi shifoxona',ref:'2026-10-12!C72',text:'дори расход клишади анализла блан ишлашади',date:'2026-10-12'},{department:'Operatsiya bloki',ref:'2026-10-12!C91',text:'Dmedda ishlashni qisman biladi. Talabnoma yozmagan, hamshiralar ishlamagan.',date:'2026-10-12'}]};
const regressionValue={departments:regressionInput.departments.map(department=>({department,status:'Foydalanilmayapti',finding:'Old finding',action:'Tekshiring',evidence:[]})),report_assessments:[{ref:'2026-10-12!C69',state:'unused'},{ref:'2026-10-12!C72',state:'used'},{ref:'2026-10-12!C91',state:'partial'}]};
const combined=C.aggregateReportAssessments(regressionValue,regressionInput);assert.equal(combined.departments[0].status,'Qisman foydalanilmoqda');assert.equal(combined.departments[0].evidence.length,2);assert.equal(combined.departments[1].status,'Foydalanilmayapti');assert.match(combined.departments[2].finding,/hisobot kelmagan/);
assert.throws(()=>C.aggregateReportAssessments({departments:[],report_assessments:[]},regressionInput),/Har bir xabar/);
const duplicateAssessments={departments:[],report_assessments:[{ref:'2026-10-12!C69',state:'used'},{ref:'2026-10-12!C69',state:'unused'},{ref:'2026-10-12!C91',state:'unused'}]};assert.throws(()=>C.aggregateReportAssessments(duplicateAssessments,regressionInput),/manbaga mos emas/);
console.log('Real-message regressions: minority positive evidence survives, ability alone is not use, no report is distinct, omitted/duplicate assessments rejected.');
const queuedJobs=[];C.ScriptApp={newTrigger(name){return {timeBased(){return this;},after(ms){this.ms=ms;return this;},create(){queuedJobs.push({name,ms:this.ms});}};},getProjectTriggers(){return [];}};
C.config().deleteProperty('DASHBOARD_JOB_AT');C.queueDashboardAnalysis();C.queueDashboardAnalysis();assert.equal(queuedJobs.length,1);assert.equal(queuedJobs[0].ms,1000);assert.equal(C.config().getProperty('DASHBOARD_REFRESH_PENDING'),'yes');C.config().deleteProperty('DASHBOARD_JOB_AT');C.queueDashboardAnalysis(60000);assert.equal(queuedJobs[1].ms,60000);console.log('Event-driven analysis: messages coalesce into one background job; busy retries wait one minute.');

const mixedWritten={departments:["Kimyoterapiya (4-gematologiya)"],period:{from:"2026-10-12",to:"2026-10-12"},reports:[{department:"Kimyoterapiya (4-gematologiya)",ref:"2026-10-12!C20",text:"Odmotirla yozilgan kundalik yozilmagan kurs leceniya yozilmagan",date:"2026-10-12"}]};
assert.equal(C.aggregateReportAssessments({departments:[],report_assessments:[{ref:"2026-10-12!C20",state:"unused"}]},mixedWritten).departments[0].status,"Qisman foydalanilmoqda");
const onlyMissing=JSON.parse(JSON.stringify(mixedWritten));onlyMissing.reports[0].text="Osmotr yozilmagan kundalik yozilmagan";assert.equal(C.aggregateReportAssessments({departments:[],report_assessments:[{ref:"2026-10-12!C20",state:"unused"}]},onlyMissing).departments[0].status,"Foydalanilmayapti");
const reviewedInput={departments:['Poliklinika'],reports:[{department:'Poliklinika',ref:'2026-10-12!C57',text:'Ko‘riklar to‘liq, internet sekin',date:'2026-10-12'}]};
props.DMED_DEPARTMENT_REVIEW=JSON.stringify({department:'Poliklinika',source_hash:C.reportKey(JSON.stringify(reviewedInput.reports.map(r=>({ref:r.ref,text:r.text})))),status:'Foydalanilmoqda',finding:'Ko‘riklar to‘liq',action:'Internetni tuzatish',refs:['2026-10-12!C57']});
const reviewedAI={departments:[{department:'Poliklinika',status:'Qisman foydalanilmoqda'}]};C.applyDepartmentRules(reviewedAI,reviewedInput);assert.equal(reviewedAI.departments[0].status,'Foydalanilmoqda');
reviewedInput.reports.push({department:'Poliklinika',ref:'2026-10-13!C2',text:'Ko‘rik yozilmagan'});reviewedAI.departments[0].status='Qisman foydalanilmoqda';C.applyDepartmentRules(reviewedAI,reviewedInput);assert.equal(reviewedAI.departments[0].status,'Qisman foydalanilmoqda');delete props.DMED_DEPARTMENT_REVIEW;
const fullPeriodRows=Array.from({length:210},(_,i)=>['Poliklinika','Employee','Ko‘rik yozilgan','Sender','2026-10-12 09:00:00','2026-10-12!C'+(i+2)]);
const fullPeriod=C.dmedInput(fullPeriodRows,{from:'2026-10-12',to:'2026-10-12'});assert.equal(fullPeriod.reports.length,210);assert.equal(fullPeriod.reports[0].ref,'2026-10-12!C2');assert.equal(fullPeriod.coverage.analysed,210);
props.DASHBOARD_AI_ALLOWED='yes';props.GEMINI_API_KEY='test-only-key';let batchCalls=0,analysedRefs=[];
context.UrlFetchApp.fetch=(url,options)=>{const part=JSON.parse(JSON.parse(options.payload).contents[0].parts[0].text);batchCalls++;analysedRefs.push(...part.reports.map(r=>r.ref));const reply={summary:'',positive:[],support:[],departments:part.departments.map(department=>({department,status:'Foydalanilmoqda',finding:'Ko‘rik yozilgan',action:'Davom eting',evidence:part.reports.filter(r=>r.department===department).slice(0,1).map(r=>({ref:r.ref}))})),report_assessments:part.reports.map(r=>({ref:r.ref,state:'used'}))};return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(reply)}]}}]})};};
const allBatchResult=C.requestDashboardAI(fullPeriod);assert.equal(batchCalls,2);assert.equal(new Set(analysedRefs).size,210);assert.equal(allBatchResult.departments.find(d=>d.department==='Poliklinika').status,'Foydalanilmoqda');
console.log('Date-range analysis covers all 210 reports across two batches without omission.');
let resumed=null;const resumeStart=batchCalls;for(let attempt=0;attempt<9;attempt++){const beforeCalls=batchCalls;resumed=C.requestDashboardAI(fullPeriod,true);assert.equal(batchCalls-beforeCalls,1);if(attempt<8)assert.equal(resumed,null);}assert.ok(resumed);assert.equal(batchCalls-resumeStart,9);const cachedCalls=batchCalls;assert.ok(C.requestDashboardAI(fullPeriod,true));assert.equal(batchCalls,cachedCalls);
console.log('Resumable analysis: 210 reports, 25 per execution, exactly one API batch per run, cached parts reused and complete result returned.');
const appendedPeriod=JSON.parse(JSON.stringify(fullPeriod));appendedPeriod.reports.push({...appendedPeriod.reports[0],ref:'2026-10-12!C999'});const appendCalls=batchCalls;assert.ok(C.requestDashboardAI(appendedPeriod,true));assert.equal(batchCalls-appendCalls,1);
console.log('New report arrives: completed earlier batches reused; only changed final batch reanalysed.');


const savedClient={book:C.book,period:C.dashboardSelectedPeriod,edit:C.dashboardDateEdited,flush:context.SpreadsheetApp.flush};
let clientPeriod={from:'2026-10-12',to:'2026-10-12'},clientWrites=[],clientEdits=0;
C.dashboardSelectedPeriod=()=>clientPeriod;C.dashboardDateEdited=()=>clientEdits++;
C.book=()=>({getSheetByName:()=>({getRange:cell=>({setValue(v){clientWrites.push(cell);return this;},setNumberFormat(){return this;}})})});context.SpreadsheetApp.flush=()=>{};
assert.throws(()=>C.setClientDashboardPeriod('','2026-10-12'),/Ikkala/);
assert.throws(()=>C.setClientDashboardPeriod('2026-10-13','2026-10-12'),/Boshlanish/);
assert.throws(()=>C.setClientDashboardPeriod('2025-01-01','2026-10-12'),/366/);
assert.equal(C.setClientDashboardPeriod('2026-10-12','2026-10-12').changed,false);assert.equal(clientWrites.length,0);
assert.equal(C.setClientDashboardPeriod('2026-10-09','2026-10-12').changed,true);assert.deepEqual(clientWrites,['C4','G4']);assert.equal(clientEdits,1);
C.book=savedClient.book;C.dashboardSelectedPeriod=savedClient.period;C.dashboardDateEdited=savedClient.edit;context.SpreadsheetApp.flush=savedClient.flush;
console.log('Client shared date filter: missing/reversed/oversized periods rejected; only C4/G4 written; unchanged period skips analysis.');

props.STRUCTURED_REPORTS_ENABLED='yes';
const checklistDepartment=Object.keys(C.roster())[0],checklistEmployee=C.roster()[checklistDepartment][0],checkUser=98989;
C.saveUser({id:checkUser,name:'Test',fish:'Karimov Ali Anvar o‘g‘li',status:'approved',active:checklistDepartment});
C.saveDraft(checkUser,{department:checklistDepartment,entries:[],stage:'staff'});
let checklistEvent=991000;const checkSend=text=>event('main',checklistEvent++,checkUser,text);
checkSend(checklistEmployee);assert.equal(C.draft(checkUser,checklistDepartment).stage,'checklist');
checkSend('noto‘g‘ri');assert.equal(C.draft(checkUser,checklistDepartment).checkStep,0);
checkSend('To‘liq ishlayapti');checkSend('Qisman ishlayapti');checkSend('Umuman ishlamayapti');checkSend('To‘liq ishlayapti');
assert.equal(C.draft(checkUser,checklistDepartment).stage,'checkcomment');
checkSend('Internet sekin');let checkDraft=C.draft(checkUser,checklistDepartment);assert.equal(checkDraft.entries.length,1);
const parsedCheck=C.parseChecklist(checkDraft.entries[0].text);assert.deepEqual(Array.from(parsedCheck.answers),['To‘liq ishlayapti','Qisman ishlayapti','Umuman ishlamayapti','To‘liq ishlayapti']);assert.equal(parsedCheck.comment,'Internet sekin');assert.equal(C.parseChecklist('Oldingi erkin xabar'),null);
checkSend('✏️ Xabarni tahrirlash');checkSend('✏️ 1. '+checklistEmployee);assert.equal(C.draft(checkUser,checklistDepartment).stage,'checklist');
['To‘liq ishlayapti','To‘liq ishlayapti','To‘liq ishlayapti','To‘liq ishlayapti','⏭️ Izohsiz davom etish'].forEach(checkSend);checkDraft=C.draft(checkUser,checklistDepartment);assert.equal(checkDraft.entries.length,1);assert.ok(C.parseChecklist(checkDraft.entries[0].text).answers.every(v=>v==='To‘liq ishlayapti'));
checkSend(checklistEmployee);checkSend('Qisman ishlayapti');checkSend('❌ Kiritishni bekor qilish');assert.equal(C.draft(checkUser,checklistDepartment).entries.length,1);
const checkStats=C.checklistStatistics([[checklistDepartment,checklistEmployee,checkDraft.entries[0].text,'Sender','2026-10-13 10:00:00'],[checklistDepartment,'Other','legacy text','Sender','2026-10-13 10:00:00']],{from:'2026-10-13',to:'2026-10-13'});assert.equal(checkStats.total,1);assert.ok(checkStats.modules.every(m=>m.counts[0]===1&&m.counts[1]===0&&m.counts[2]===0));
delete props.STRUCTURED_REPORTS_ENABLED;
console.log('Four-question reporting: strict choices, incomplete confirmation blocked, optional comment, editing replaces one entry, cancellation preserves entries, legacy text excluded from structured percentages.');

props.STRUCTURED_REPORTS_ENABLED='yes';const checklistCells=new Map();let checklistHidden=null;
const checklistSheet={getName:()=>'_mock_checklist',setColumnWidth(){},hideColumns:(c,n)=>checklistHidden=[c,n],setRowHeight(){},getRange:(r,c,n=1,w=1)=>({getValues:()=>[Array(w).fill('')],setValues(v){checklistCells.set(r+':'+c,v);return this;},setValue(v){checklistCells.set(r+':'+c,v);return this;},setFontWeight(){return this;},setBackground(){return this;},setBackgrounds(v){checklistCells.set('colors',v);return this;},setWrap(){return this;},setNumberFormat(){return this;}})};
const checklistDate=new Date('2026-10-13T05:00:00Z');C.writeChecklistCells(checklistSheet,2,['OSS','Employee',C.checklistText(['To‘liq ishlayapti','Qisman ishlayapti','Umuman ishlamayapti','To‘liq ishlayapti'],'=1+1'),'Sender',checklistDate]);
assert.deepEqual(checklistHidden,[3,3]);assert.equal(checklistCells.get('2:6')[0][4],"'=1+1");assert.equal(checklistCells.get('2:6')[0][5],'Sender');assert.equal(checklistCells.get('2:12'),checklistDate);assert.equal(checklistCells.get('colors')[0][2],'#f9e0dd');assert.equal(checklistCells.get('1:6')[0][4],'Kommentariya');delete props.STRUCTURED_REPORTS_ENABLED;
console.log('Structured sheet mapping: four choices, safe comment, sender and date occupy exact columns; original source columns preserved.');

props.STRUCTURED_REPORTS_ENABLED='yes';C.saveDraft(checkUser,{department:checklistDepartment,entries:[],stage:'staff'});
checkSend(checklistEmployee);checkSend('Kommentariya');assert.equal(C.draft(checkUser,checklistDepartment).stage,'checknote');checkSend('Ko‘rik uchun qo‘shimcha izoh');const noteDraft=C.draft(checkUser,checklistDepartment);assert.equal(noteDraft.stage,'staff');assert.equal(noteDraft.entries.length,1);assert.equal(C.parseChecklist(noteDraft.entries[0].text).comment,'Ko‘rik uchun qo‘shimcha izoh');assert.ok(C.parseChecklist(noteDraft.entries[0].text).answers.every(a=>a==='—'));delete props.STRUCTURED_REPORTS_ENABLED;
console.log('Comments immediately save employee report and offer another employee; remaining questions optional.');

props.STRUCTURED_REPORTS_ENABLED='yes';
const statusReports=[{department:'A',employee_code:'E_1',date:'2026-10-13',ref:'2026-10-13!C2',text:C.checklistText(Array(4).fill('To‘liq ishlayapti'),'Hammasi ishlamayapti degan izoh bahoga ta’sir qilmasin')},{department:'B',employee_code:'E_2',date:'2026-10-13',ref:'2026-10-13!C3',text:C.checklistText(['To‘liq ishlayapti','Qisman ishlayapti','Umuman ishlamayapti','To‘liq ishlayapti'],'Hammasi yaxshi')},{department:'C',employee_code:'E_3',date:'2026-10-13',ref:'2026-10-13!C4',text:C.checklistText(Array(4).fill('Umuman ishlamayapti'),'Hammasi ishlayapti')}];
const statusInput={departments:['A','B','C','D'],period:{from:'2026-10-13',to:'2026-10-13'},reports:statusReports};
const statusResult=C.checklistAssessment(statusInput);assert.deepEqual(Array.from(statusResult.departments,d=>d.status),['Foydalanilmoqda','Qisman foydalanilmoqda','Foydalanilmayapti','Dalil yetarli emas']);assert.equal(statusResult.positive[0].employee_code,'E_1');assert.equal(statusResult.support[0].employee_code,'E_3');
const sourceOriginal=C.dashboardSource;C.dashboardSource=()=>[['A','A',statusReports[0].text,'Sender','2026-10-13 10:00:00'],['A','A','Erkin matn yaxshi','Sender','2026-10-13 10:00:00']];assert.equal(C.dashboardAnalysisSource().length,2);C.dashboardSource=sourceOriginal;
const refreshOriginal={source:C.dashboardSource,period:C.dashboardSelectedPeriod,book:C.book,prepare:C.prepareDashboard,render:C.renderDashboard,insights:C.renderDashboardInsights,request:C.requestDashboardAI,rules:C.applyDepartmentRules};let statusRendered=null;
C.dashboardSource=()=>[[checklistDepartment,checklistEmployee,statusReports[0].text,'Sender','2026-10-13 10:00:00','2026-10-13!C2']];C.dashboardSelectedPeriod=()=>statusInput.period;C.book=()=>({getSheetByName:()=>({})});C.prepareDashboard=()=>({});C.renderDashboard=(sheet,input,ai,status,fresh)=>statusRendered={ai,status,fresh};C.renderDashboardInsights=()=>{};let hybridCalled=false;C.requestDashboardAI=()=>{hybridCalled=true;return C.checklistAssessment(statusInput);};C.applyDepartmentRules=()=>{throw new Error('Manual text rules must not override statuses');};delete props.DASHBOARD_RUNNING_AT;props.DASHBOARD_AI_ALLOWED='yes';props.GEMINI_API_KEY='mock';C.refreshDashboard(true);assert.ok(statusRendered.fresh);assert.ok(hybridCalled);
C.dashboardSource=refreshOriginal.source;C.dashboardSelectedPeriod=refreshOriginal.period;C.book=refreshOriginal.book;C.prepareDashboard=refreshOriginal.prepare;C.renderDashboard=refreshOriginal.render;C.renderDashboardInsights=refreshOriginal.insights;C.requestDashboardAI=refreshOriginal.request;C.applyDepartmentRules=refreshOriginal.rules;delete props.STRUCTURED_REPORTS_ENABLED;
console.log('Hybrid Dashboard: Gemini called for structured reports; historical manual overrides disabled.');

for(const department of ['Poliklinika','Qabul bo‘limi']){const d={department,entries:[]};C.beginChecklist(d);assert.equal(d.stage,'checkcomment');assert.equal(C.parseChecklist(C.checklistText([], 'Tizimda ko‘riklar to‘liq kiritiladi')).answers[0],'—');}
console.log('Comment-only departments and skipped statuses validated.');
props.STRUCTURED_REPORTS_ENABLED='yes';
for(const department of ['Poliklinika','Qabul bo‘limi']){const d={department,employee:'Sinov xodimi',entries:[]};C.beginChecklist(d);C.handleChecklist({id:checkUser},d,'Ko‘riklar tizimda to‘liq kiritiladi.');assert.equal(d.stage,'staff');assert.equal(d.entries.length,1);assert.equal(C.parseChecklist(d.entries[0].text).comment,'Ko‘riklar tizimda to‘liq kiritiladi.');}
const optionalDraft={department:checklistDepartment,employee:checklistEmployee,entries:[]};C.beginChecklist(optionalDraft);C.handleChecklist({id:checkUser},optionalDraft,'⏭️ Izohsiz davom etish');assert.equal(optionalDraft.checkStep,1);assert.equal(optionalDraft.checkAnswers[0],'—');
const optionalStat=C.checklistStatistics([['OSS','E',C.checklistText(['To‘liq ishlayapti'],'Izoh'),'S','2026-10-13 10:00:00']],{from:'2026-10-13',to:'2026-10-13'});assert.equal(optionalStat.modules[0].total,1);assert.equal(optionalStat.modules[1].total,0);delete props.STRUCTURED_REPORTS_ENABLED;
console.log('Full comment-only save flow and optional per-module denominator passed.');
const bcOriginal={send:C.send,recipients:C.broadcastRecipients,format:C.Utilities.formatDate};const bcMessages=[];C.send=(...args)=>bcMessages.push(args);C.broadcastRecipients=()=>[11,12];
C.Utilities.formatDate=(date,zone,pattern)=>{const d=new Date(date.getTime()+5*3600000).toISOString();return pattern==='dd.MM.yyyy HH:mm'?d.slice(8,10)+'.'+d.slice(5,7)+'.'+d.slice(0,4)+' '+d.slice(11,16):bcOriginal.format(date,zone,pattern);};
assert.equal(C.handleBroadcast(2,'📣 Xabar yuborish'),false);assert.equal(C.handleBroadcast(1,'📣 Xabar yuborish'),true);C.handleBroadcast(1,'Ertaga yig‘ilish bo‘ladi.');assert.equal(Object.keys(props).filter(k=>k.startsWith('BROADCAST_JOB:')).length,0);C.handleBroadcast(1,'🚀 Hozir yuborish');assert.ok(bcMessages.at(-1)[2].includes('Yuborishni tasdiqlaysizmi'));C.handleBroadcast(1,'❌ Xabarni bekor qilish');assert.equal(Object.keys(props).filter(k=>k.startsWith('BROADCAST_JOB:')).length,0);
C.handleBroadcast(1,'📣 Xabar yuborish');C.handleBroadcast(1,'Tasdiqlangan e’lon');C.handleBroadcast(1,'🕒 Vaqt belgilash');C.handleBroadcast(1,'31.02.2030 09:00');assert.equal(JSON.parse(props['BROADCAST_DRAFT:1']).stage,'date');C.handleBroadcast(1,'14.10.2030 09:00');assert.equal(JSON.parse(props['BROADCAST_DRAFT:1']).stage,'confirm');C.handleBroadcast(1,'✅ Barchaga yuborishni tasdiqlash');const bcKeys=Object.keys(props).filter(k=>k.startsWith('BROADCAST_JOB:'));assert.equal(bcKeys.length,1);const bcJob=JSON.parse(props[bcKeys[0]]);assert.equal(bcJob.total,2);assert.equal(new Date(bcJob.at).toISOString(),'2030-10-14T04:00:00.000Z');assert.equal(C.broadcastDate('13.10.2020 09:00'),null);assert.equal(C.broadcastDate('14.10.2030 24:00'),null);for(const k of Object.keys(props))if(k.startsWith('BROADCAST_'))delete props[k];C.send=bcOriginal.send;C.broadcastRecipients=bcOriginal.recipients;C.Utilities.formatDate=bcOriginal.format;
console.log('Broadcast: owner-only, preview before confirmation, cancellation, strict future Tashkent date and durable scheduled job passed.');
const workerOriginal={user:C.user,flush:C.flushOutbox,send:C.send};let broadcastFlushes=0;C.user=id=>({id,status:id===19?'revoked':'approved'});C.flushOutbox=()=>broadcastFlushes++;C.send=()=>{};
props['BROADCAST_JOB:worker']=JSON.stringify({id:'worker',owner:1,text:'Sinov e’lon',at:Date.now()-1,cursor:0,total:26,queued:0,skipped:0});props['BROADCAST_IDS:worker:0']=JSON.stringify(Array.from({length:26},(_,i)=>i+10));
C.processBroadcasts();assert.equal(JSON.parse(props['BROADCAST_JOB:worker']).cursor,13);assert.equal(JSON.parse(props['BROADCAST_JOB:worker']).skipped,1);assert.equal(Object.keys(props).filter(k=>k.startsWith('OUTBOX:broadcast:worker:')).length,12);assert.equal(props['OUTBOX:broadcast:worker:19'],undefined);C.processBroadcasts();C.processBroadcasts();assert.equal(props['BROADCAST_JOB:worker'],undefined);assert.equal(props['BROADCAST_IDS:worker:0'],undefined);assert.equal(Object.keys(props).filter(k=>k.startsWith('OUTBOX:broadcast:worker:')).length,25);assert.equal(broadcastFlushes,3);
for(const k of Object.keys(props))if(k.startsWith('OUTBOX:broadcast:'))delete props[k];C.user=workerOriginal.user;C.flushOutbox=workerOriginal.flush;C.send=workerOriginal.send;console.log('Broadcast worker: batches resume, revoked users skipped, 25 unique recipients queued and job cleaned up. No live messages sent.');
const pickerOriginal={send:C.send,recipients:C.broadcastRecipients};C.send=()=>{};C.broadcastRecipients=()=>[11];C.handleBroadcast(1,'📣 Xabar yuborish');C.handleBroadcast(1,'Vaqt tanlash sinovi');C.handleBroadcast(1,'🕒 Vaqt belgilash');const initialPicker=JSON.parse(props['BROADCAST_DRAFT:1']);assert.equal(initialPicker.stage,'date');assert.ok(initialPicker.at>Date.now());C.handleBroadcast(1,'📅 +1 kun');assert.equal(JSON.parse(props['BROADCAST_DRAFT:1']).at,initialPicker.at+86400000);C.handleBroadcast(1,'🕒 +1 soat');C.handleBroadcast(1,'⏱ −5 daqiqa');assert.equal(JSON.parse(props['BROADCAST_DRAFT:1']).at,initialPicker.at+86400000+3600000-300000);C.handleBroadcast(1,'✅ Shu vaqtni tanlash');assert.equal(JSON.parse(props['BROADCAST_DRAFT:1']).stage,'confirm');assert.equal(Object.keys(props).filter(k=>k.startsWith('BROADCAST_JOB:')).length,0);C.handleBroadcast(1,'❌ Xabarni bekor qilish');C.send=pickerOriginal.send;C.broadcastRecipients=pickerOriginal.recipients;console.log('Automatic date/time picker: day/hour/minute buttons, confirmation and no premature send passed.');
context.UrlFetchApp.fetch=fetchSuccess;const navDepartment='Poliklinika',navDraft={department:navDepartment,entries:[],stage:'staff'},navStaff=fullRoster[navDepartment],covered=new Set();for(let page=0;page<Math.ceil(navStaff.length/12);page++){navDraft.staffPage=page;const rows=C.draftRows(navDraft);rows.flat().filter(x=>navStaff.includes(x)).forEach(x=>covered.add(x));assert.ok(rows.length<=19);assert.ok(rows.some(r=>r.includes('Boshqa')));}assert.equal(covered.size,navStaff.length);
const navUser=99777;C.saveUser({id:navUser,name:'Navigation Tester',username:'',fish:'Navigation Tester Fullname',status:'approved',active:'OSS'});C.saveDraft(navUser,{department:'OSS',entries:[{employee:'Existing',text:'Kept'}],stage:'checknote',employee:'Existing',checkStep:1,checkAnswers:['To‘liq ishlayapti']});event('main',997770,navUser,'Poliklinika');assert.equal(C.user(navUser).active,'Poliklinika');assert.equal(C.draft(navUser,'OSS').entries[0].text,'Kept');event('main',997771,navUser,'Keyingi xodimlar ➡️');assert.equal(C.draft(navUser,'Poliklinika').staffPage,1);event('main',997772,navUser,'⬅️ Oldingi xodimlar');assert.equal(C.draft(navUser,'Poliklinika').staffPage,0);
for(const k of Object.keys(props))if(k.startsWith('OUTBOX:'))delete props[k];for(let i=0;i<20;i++)C.queue('main','sendMessage',{chat_id:8000+i,text:'Background '+i});C.queue('main','sendMessage',{chat_id:navUser,text:'Current reply'});const priorityStart=delivered.length;C.flushOutbox(true,'main:'+navUser);const prioritySent=delivered.slice(priorityStart);assert.equal(prioritySent[0].payload.chat_id,navUser);assert.equal(prioritySent.length,3);assert.equal(Object.keys(props).filter(k=>k.startsWith('OUTBOX:')).length,18);while(Object.keys(props).some(k=>k.startsWith('OUTBOX:')))C.flushOutbox();console.log('Navigation: all employees accessible in bounded pages; direct department switch preserves drafts; current reply sent before 20 queued notices with only 3 API calls.');
props.STRUCTURED_REPORTS_ENABLED='yes';props.ROLE_REPORTS_ENABLED='yes';const roleUser=99888;C.saveUser({id:roleUser,name:'Role Tester',username:'',fish:'Role Tester Fullname',status:'approved',active:''});let roleEvent=998880;const roleSend=t=>event('main',roleEvent++,roleUser,t);
roleSend('Poliklinika');assert.equal(C.draft(roleUser,'Poliklinika').stage,'roles');roleSend('👨‍⚕️ Shifokorlar');let roleDraft=C.draft(roleUser,'Poliklinika');assert.equal(roleDraft.role,'doctor');assert.equal(C.staffNames(roleDraft).length,19);assert.equal(C.staffNames(roleDraft)[18],'Shukurova E’zoza Bahodir qizi');roleSend(C.staffNames(roleDraft)[0]);assert.equal(C.draft(roleUser,'Poliklinika').stage,'checklist');assert.equal(C.roleFields(C.draft(roleUser,'Poliklinika')).length,1);roleSend('To‘liq ishlayapti');assert.equal(C.draft(roleUser,'Poliklinika').stage,'checkcomment');roleSend('Ko‘riklar to‘liq kiritilgan.');assert.equal(C.draft(roleUser,'Poliklinika').entries.length,1);
roleSend('↩️ Shifokorlar / Hamshiralar');roleSend('👩‍⚕️ Hamshiralar');roleDraft=C.draft(roleUser,'Poliklinika');assert.equal(roleDraft.stage,'checklist');assert.equal(roleDraft.employee,'Hamshiralar (bo‘lim hisoboti)');roleSend('To‘liq ishlayapti');roleSend('Qisman ishlayapti');assert.equal(C.draft(roleUser,'Poliklinika').stage,'checkcomment');roleSend('Barkod chiqarishda ayrim kechikishlar bor.');roleDraft=C.draft(roleUser,'Poliklinika');assert.equal(roleDraft.stage,'roles');const nurseRecord=roleDraft.entries.at(-1),parsedNurse=C.parseChecklist(nurseRecord.text);assert.equal(parsedNurse.kind,'nurse');assert.equal(parsedNurse.answers.length,2);assert.equal(parsedNurse.answers[1],'Qisman ishlayapti');assert.equal(C.staffCode(nurseRecord.employee),'');
roleSend('OSS');assert.equal(C.staffNames({department:'OSS',role:'doctor'}).length,0);roleSend('👨‍⚕️ Shifokorlar');assert.equal(C.draft(roleUser,'OSS').stage,'roles');roleSend('👩‍⚕️ Hamshiralar');roleSend('Kommentariya');roleSend('Tizimdan foydalanilmayapti.');assert.equal(C.draft(roleUser,'OSS').entries.length,1);assert.ok(C.parseChecklist(C.draft(roleUser,'OSS').entries[0].text).answers.every(x=>x==='—'));
const roleStats=C.checklistStatistics([['Poliklinika',nurseRecord.employee,nurseRecord.text,'Sender','2026-10-14 10:00:00'],['Poliklinika','Doctor',C.checklistText(Array(4).fill('To‘liq ishlayapti'),'Done'),'Sender','2026-10-14 10:00:00']],{from:'2026-10-14',to:'2026-10-14'});assert.equal(roleStats.total,1);assert.equal(roleStats.nurses,1);assert.equal(roleStats.modules[1].counts[0],1);assert.equal(roleStats.nurseModules[1].counts[1],1);
const historical='Осмотры: Проводит\nКурс лечения: Частично проводит\nДневник осмотров: Не работает в системе\nПлан обследования (анализы и узкие специалисты): Проводит\nКомментарии: Old';assert.equal(C.parseChecklist(historical).answers[0],'To‘liq ishlayapti');assert.equal(C.parseChecklist(historical).comment,'Old');
checklistCells.clear();C.writeChecklistCells(checklistSheet,3,['Poliklinika',nurseRecord.employee,nurseRecord.text,'Sender',checklistDate]);assert.deepEqual(Array.from(checklistCells.get('3:6')[0].slice(0,4)),['','','','']);assert.deepEqual(Array.from(checklistCells.get('3:13')[0]),['To‘liq ishlayapti','Qisman ishlayapti']);assert.ok(checklistCells.get('3:6')[0][4].includes('Barkod'));delete props.ROLE_REPORTS_ENABLED;delete props.STRUCTURED_REPORTS_ENABLED;
console.log('Roles: exact doctor list, nurse two-question flow without FISH, comment shortcut, no doctors in OSS, separate module counts/sheet columns and historical Russian status compatibility passed.');
props.ROLE_REPORTS_ENABLED='yes';props.STRUCTURED_REPORTS_ENABLED='yes';roleSend('Reanimatsiya');assert.equal(C.draft(roleUser,'Reanimatsiya').stage,'roles');roleSend('👨‍⚕️ Shifokorlar');let icuDraft=C.draft(roleUser,'Reanimatsiya');assert.equal(icuDraft.stage,'checklist');assert.equal(C.roleFields(icuDraft).length,1);assert.equal(C.roleFields(icuDraft)[0],'Дневник осмотров');roleSend('To‘liq ishlayapti');assert.equal(C.draft(roleUser,'Reanimatsiya').stage,'checkcomment');roleSend('⏭️ Izohsiz davom etish');icuDraft=C.draft(roleUser,'Reanimatsiya');assert.equal(icuDraft.stage,'roles');assert.deepEqual(Array.from(C.parseChecklist(icuDraft.entries[0].text).answers),['—','—','To‘liq ishlayapti','—']);assert.equal(C.staffCode(icuDraft.entries[0].employee),'');const icuStats=C.checklistStatistics([['Reanimatsiya',icuDraft.entries[0].employee,icuDraft.entries[0].text,'Sender','2026-10-14 10:00:00']],{from:'2026-10-14',to:'2026-10-14'});assert.equal(icuStats.modules[0].total,0);assert.equal(icuStats.modules[2].counts[0],1);
roleSend('Neyronkologiya');roleSend('👨‍⚕️ Shifokorlar');assert.deepEqual(Array.from(C.staffNames(C.draft(roleUser,'Neyronkologiya'))).slice(0,3),['Xayitova Anora Tojimurodovna','Usmonov Rustam Xojiakbarovich','Saloxiddinov Habibulloh Athamjanovich']);assert.equal(C.staffNames(C.draft(roleUser,'Neyronkologiya')).length,5);delete props.ROLE_REPORTS_ENABLED;delete props.STRUCTURED_REPORTS_ENABLED;console.log('Reanimatsiya doctors: one diary question without FISH; answer mapped only to diary module. Three Neurooncology doctors added above existing two.');
const rolePeriod={from:'2026-10-14',to:'2026-10-14'},roleMatrixRecords=[['Poliklinika','D',C.checklistText(['To‘liq ishlayapti'],'Done'),'S','2026-10-14 10:00:00'],['Poliklinika','D2',C.checklistText(['To‘liq ishlayapti','Umuman ishlamayapti'],'Mixed'),'S','2026-10-14 10:00:00'],['Poliklinika','D3',C.checklistText([],'Only comment'),'S','2026-10-14 10:00:00'],['Poliklinika','N',C.checklistText(['Umuman ishlamayapti','Umuman ishlamayapti'],'No','', 'nurse'),'S','2026-10-14 10:00:00'],['Poliklinika','N2',C.checklistText(['Qisman ishlayapti','To‘liq ishlayapti'],'Partial',[], 'nurse'),'S','2026-10-14 10:00:00'],['Poliklinika','Old',C.checklistText(['To‘liq ishlayapti'],'Old'),'S','2026-10-13 10:00:00']];const roleMatrix=C.roleDepartmentStatistics(roleMatrixRecords,rolePeriod),polMatrix=roleMatrix.find(x=>x.key==='Poliklinika');assert.equal(roleMatrix.length,Object.keys(C.roster()).length);assert.deepEqual(Array.from(polMatrix.doctor.counts),[1,1,0]);assert.equal(polMatrix.doctor.total,2);assert.equal(polMatrix.doctor.comments,1);assert.deepEqual(Array.from(polMatrix.nurse.counts),[0,1,1]);assert.equal(polMatrix.nurse.total,2);assert.equal(roleMatrix.find(x=>x.key==='OSS').doctor.total,0);assert.equal(roleMatrix[0].key,Object.keys(C.roster())[0]);console.log('Department role matrix: roster order, separate doctor/nurse counts, date filter, comment-only exclusion, skipped answers and empty departments passed.');

const polDoctor={department:'Poliklinika',role:'doctor',employee:'Aripova Dinara Ravshanovna',entries:[]};C.beginChecklist(polDoctor);assert.equal(polDoctor.stage,'checklist');assert.equal(C.roleFields(polDoctor)[0],'DMED tizimida bemorlarning ko‘riklarini yopish jarayonidagi ishlashi');C.handleChecklist({id:roleUser},polDoctor,'Qisman ishlayapti');assert.equal(polDoctor.stage,'checkcomment');C.handleChecklist({id:roleUser},polDoctor,'⏭️ Izohsiz davom etish');assert.deepEqual(Array.from(C.parseChecklist(polDoctor.entries[0].text).answers),['Qisman ishlayapti','—','—','—']);assert.ok(C.parseChecklist(polDoctor.entries[0].text).comment.includes('ko‘riklarini yopish'));console.log('Poliklinika doctors: one closure question, three statuses, correct examination mapping and question retained in report passed.');

props.ROLE_REPORTS_ENABLED='yes';const hema3=C.staffNames({department:'3-gematologiya',role:'doctor'});assert.equal(hema3.length,7);assert.deepEqual(Array.from(hema3.slice(-2)),['XADIYEV RAXMATULLA KARAMATULLAYEVICH','MAMATKULOVA DILRUX FAYZULLAEVNA']);delete props.ROLE_REPORTS_ENABLED;console.log('3-gematologiya: two requested doctors added, existing five preserved.');
props.ROLE_REPORTS_ENABLED='yes';const raOriginal={send:C.send};const raSent=[];C.send=(...a)=>raSent.push(a);assert.equal(C.handleRosterAdmin(2,'🏥 Bo‘lim va xodimlar'),false);C.handleRosterAdmin(1,'🏥 Bo‘lim va xodimlar');assert.ok(raSent.at(-1)[3].flat().includes('➕ Bo‘lim qo‘shish'));
const raChange=(action,department,employee,value)=>C.applyRosterAdminChange(1,{action,department,employee,value});const raBefore=C.doctorNames('3-gematologiya').slice();assert.throws(()=>C.applyRosterAdminChange(2,{action:'➕ Shifokor F.I.Sh. qo‘shish',department:'3-gematologiya',value:'Test Ali Valiyevich'}));raChange('➕ Shifokor F.I.Sh. qo‘shish','3-gematologiya',null,'Test Ali Valiyevich');assert.equal(C.doctorNames('3-gematologiya').length,raBefore.length+1);assert.throws(()=>raChange('➕ Shifokor F.I.Sh. qo‘shish','3-gematologiya',null,'test ali valiyevich'));raChange('✏️ Shifokor F.I.Sh.ini tahrirlash','3-gematologiya','Test Ali Valiyevich','Test Vali Aliyevich');assert.ok(C.doctorNames('3-gematologiya').includes('Test Vali Aliyevich'));raChange('➖ Shifokor F.I.Sh.ini olib tashlash','3-gematologiya','Test Vali Aliyevich');assert.deepEqual(Array.from(C.doctorNames('3-gematologiya')),Array.from(raBefore));assert.throws(()=>raChange('➖ Shifokor F.I.Sh.ini olib tashlash','3-gematologiya','Test Vali Aliyevich'));
const raRows=sheets.get('_BotRoster').getLastRow();raChange('➕ Bo‘lim qo‘shish',null,null,'Yangi tibbiy bo‘lim');assert.equal(sheets.get('_BotRoster').getLastRow(),raRows+1);assert.ok(Object.prototype.hasOwnProperty.call(C.roster(),'Yangi tibbiy bo‘lim'));assert.equal(C.dashboardExportLastRow(),Object.keys(C.roster()).length+247);assert.throws(()=>raChange('➕ Bo‘lim qo‘shish',null,null,'Yangi tibbiy bo‘lim'));raChange('✏️ Bo‘lim nomini tahrirlash','Yangi tibbiy bo‘lim',null,'Yangilangan tibbiy bo‘lim');assert.equal(C.departmentTitle('Yangi tibbiy bo‘lim'),'Yangilangan tibbiy bo‘lim');assert.ok(Object.prototype.hasOwnProperty.call(C.roster(),'Yangi tibbiy bo‘lim'));assert.equal(C.departmentName('Yangilangan tibbiy bo‘lim'),'Yangi tibbiy bo‘lim');assert.throws(()=>raChange('✏️ Bo‘lim nomini tahrirlash','Yangi tibbiy bo‘lim',null,'Poliklinika'));raChange('✏️ Bo‘lim nomini tahrirlash','Yangi tibbiy bo‘lim',null,'Yakuniy bo‘lim');assert.equal(C.departmentTitle('Yangilangan tibbiy bo‘lim'),'Yakuniy bo‘lim');assert.equal(C.dashboardAIInput([['Yangilangan tibbiy bo‘lim','Person','text','Sender','2026-10-14 10:00:00']],{total:1,activeDepartments:1,days:[]},true).reports[0].department,'Yakuniy bo‘lim');
// Exercise the complete admin conversation, including confirmation before adding.
C.handleRosterAdmin(1,'➕ Shifokor F.I.Sh. qo‘shish');let raDraft=JSON.parse(props['ROSTER_ADMIN_DRAFT:1']);const raPick=raDraft.options.find(x=>x.key==='OSS');assert.ok(raPick);C.handleRosterAdmin(1,raPick.label);C.handleRosterAdmin(1,'Yangi Shifokor Valiyevich');assert.equal(C.doctorNames('OSS').length,0);C.handleRosterAdmin(1,'✅ O‘zgarishni tasdiqlash');assert.deepEqual(Array.from(C.doctorNames('OSS')),['Yangi Shifokor Valiyevich']);C.handleRosterAdmin(1,'➖ Shifokor F.I.Sh.ini olib tashlash');raDraft=JSON.parse(props['ROSTER_ADMIN_DRAFT:1']);C.handleRosterAdmin(1,raDraft.options.find(x=>x.key==='OSS').label);raDraft=JSON.parse(props['ROSTER_ADMIN_DRAFT:1']);C.handleRosterAdmin(1,raDraft.options[0].label);assert.equal(C.doctorNames('OSS').length,1);C.handleRosterAdmin(1,'↩️ Admin menyu');assert.equal(C.doctorNames('OSS').length,1);C.send=raOriginal.send;delete props.ROLE_REPORTS_ENABLED;console.log('Admin roster: owner-only, confirmation/cancel, doctor add/edit/remove, duplicates rejected, department add/rename aliases, persistent overrides and expanding PDF range passed.');
const scoreGroup=(key,dc,nc)=>({key,doctor:{counts:dc,total:dc.reduce((a,b)=>a+b,0)},nurse:{counts:nc,total:nc.reduce((a,b)=>a+b,0)}});let score=C.departmentOverallScore(scoreGroup('Poliklinika',[1,0,0],[0,1,0]));assert.equal(score.percent,75);assert.equal(score.complete,true);score=C.departmentOverallScore(scoreGroup('Poliklinika',[100,0,0],[0,0,1]));assert.equal(score.percent,50);score=C.departmentOverallScore(scoreGroup('Poliklinika',[0,1,0],[0,0,0]));assert.equal(score.percent,50);assert.equal(score.complete,false);assert.equal(score.covered,1);assert.equal(score.expected,2);assert.equal(C.departmentOverallScore(scoreGroup('Poliklinika',[0,0,0],[0,0,0])).percent,null);assert.equal(C.departmentOverallScore(scoreGroup('Poliklinika',[0,0,1],[0,0,1])).percent,0);console.log('Overall department score: 100/50/0 weights, equal role weights despite unequal counts, missing coverage labelled, empty not zero and real zero passed.');
const layoutEnd=C.dashboardExportLastRow(),layoutCount=layoutEnd-236,layoutRows=Array.from({length:400},(_,i)=>({value:'row '+(i+1),hidden:false}));layoutRows[15].value='OLD TOP FIVE';layoutRows[139].value='HISOBOT PULSI • TANLANGAN DAVR';layoutRows[169].value='DMED • AMALIY CHORALAR XARITASI';layoutRows[236].value='BO‘LIMLAR KESIMIDA • SHIFOKORLAR VA HAMSHIRALAR';layoutRows[layoutEnd-1].value='Yangi tasdiqlangan hisobotlar va sana filtri o‘zgarganda jadval avtomatik yangilanadi.';
const layoutSheet={setRowHeight(){},getCharts:()=>[],getMaxColumns:()=>26,getLastRow:()=>layoutRows.length,hideRows:(r,n)=>layoutRows.slice(r-1,r-1+n).forEach(x=>x.hidden=true),getRange(r,c,n){if(typeof r==='string'){const m=/^[A-Z]+(\d+)(?::[A-Z]+(\d+))?$/.exec(r);r=Number(m[1]);n=m[2]?Number(m[2])-r+1:1;}n=n||1;return {setBackground(){return this;},row:r,count:n,getValue:()=>layoutRows[r-1].value,getValues:()=>layoutRows.slice(r-1,r-1+n).map(x=>[x.value]),breakApart(){return this;},clear(){layoutRows.slice(r-1,r-1+n).forEach(x=>x.value='');return this;}};},moveRows(range,dest){const moved=layoutRows.splice(range.row-1,range.count);if(dest>range.row)dest-=range.count;layoutRows.splice(dest-1,0,...moved);}};
C.applyDashboardPresentation(layoutSheet);assert.equal(layoutRows[15].value,'BO‘LIMLAR KESIMIDA • SHIFOKORLAR VA HAMSHIRALAR');assert.equal(layoutRows[15+layoutCount].value,'OLD TOP FIVE');assert.equal(layoutRows[139+layoutCount].value,'');assert.equal(layoutRows[139+layoutCount].hidden,true);assert.equal(layoutRows[169+layoutCount].value,'');assert.equal(layoutRows[169+layoutCount].hidden,true);C.applyDashboardPresentation(layoutSheet);assert.equal(layoutRows[15+layoutCount].value,'OLD TOP FIVE');delete props.ROLE_MATRIX_MOVED_ROWS;C.restoreDashboardRowOrder(layoutSheet);assert.equal(layoutRows[15].value,'OLD TOP FIVE');assert.equal(layoutRows[236].value,'BO‘LIMLAR KESIMIDA • SHIFOKORLAR VA HAMSHIRALAR');assert.equal(props.ROLE_MATRIX_MOVED_ROWS,undefined);console.log('Dashboard ordering: matrix second, old sections cleared/hidden, remaining content preserved, repeated refresh idempotent and missing marker recovered.');

{const originalWrite=C.writeReport,originalMenu=C.menu,originalRemove=C.removeDraft,originalQueue=C.queueDashboardAnalysis;let saved=null,thanked=false;C.writeReport=p=>{saved=p;};C.menu=()=>{thanked=true;};C.removeDraft=()=>{};C.queueDashboardAnalysis=()=>{};
const d={department:checklistDepartment,role:'doctor',employee:checklistEmployee,entries:[],stage:'checklist',checkStep:1,checkAnswers:['To‘liq ishlayapti'],checkNotes:[]};C.submit({id:checkUser,name:'Test',fish:'Test User'},d);assert.equal(saved.entries.length,1);assert.equal(C.parseChecklist(saved.entries[0].text).answers[0],'To‘liq ishlayapti');assert.equal(C.parseChecklist(saved.entries[0].text).answers[1],'—');assert.ok(thanked);
C.writeReport=originalWrite;C.menu=originalMenu;C.removeDraft=originalRemove;C.queueDashboardAnalysis=originalQueue;console.log('Confirmation: partial checklist saved with missing answers unset and receipt returned.');}
// Navigation must resolve all labels from one property snapshot, not remote reads per department.
const originalProperties=context.PropertiesService.getScriptProperties;let propertyReads=0,snapshotReads=0;
context.PropertiesService.getScriptProperties=()=>{const p=originalProperties();return {...p,getProperty(k){propertyReads++;return p.getProperty(k);},getProperties(){snapshotReads++;return p.getProperties();}};};
vm.runInContext('PROPS_CACHE=null',context);const firstDepartment=Object.keys(C.roster())[0],label=C.departmentLabel(firstDepartment);propertyReads=0;snapshotReads=0;assert.equal(C.departmentName(label),firstDepartment);assert.equal(propertyReads,0);assert.equal(snapshotReads,1);
context.PropertiesService.getScriptProperties=originalProperties;vm.runInContext('PROPS_CACHE=null',context);
while(pending().length)C.flushOutbox();C.queue('main','sendMessage',{chat_id:99001,text:'Deferred background notice'});const speedStart=delivered.length;event('main',19999999001,909,'/start');assert.ok(delivered.slice(speedStart).some(v=>v.payload.chat_id===909));assert.ok(!delivered.slice(speedStart).some(v=>v.payload.chat_id===99001));assert.equal(pending().length,1);C.flushOutbox();assert.equal(pending().length,0);
console.log('Navigation speed: one configuration snapshot for all labels; unrelated old notices deferred, scheduled delivery preserved.');
// One locked request snapshot; repeated writes are skipped, failed writes remain retryable.
const probeStore={values:{a:'1'},reads:0,writes:0,getProperties(){this.reads++;return {...this.values};},setProperty(k,v){if(this.fail)throw Error('write failed');this.writes++;this.values[k]=v;},deleteProperty(k){delete this.values[k];}};
const scoped=C.requestConfig(probeStore);assert.equal(scoped.getProperty('a'),'1');assert.equal(scoped.getProperty('missing'),null);scoped.setProperty('a','1');assert.equal(probeStore.writes,0);scoped.setProperty('a','2');assert.equal(scoped.getProperty('a'),'2');assert.equal(probeStore.writes,1);probeStore.fail=true;assert.throws(()=>scoped.setProperty('a','3'));assert.equal(scoped.getProperty('a'),'2');assert.equal(probeStore.reads,1);scoped.deleteProperty('a');assert.equal(scoped.getProperty('a'),null);
assert.equal(vm.runInContext('REQUEST_CONFIG',context),null);
console.log('Request configuration: one durable snapshot, duplicate writes skipped, failed writes do not commit cached state, cache discarded after update.');

// Entering a department always opens role selection, even with an unfinished nurse form.
props.ROLE_REPORTS_ENABLED='yes';const reentryId=19999999111;C.saveUser({id:99111,name:'Reentry Test',fish:'Reentry Test User',status:'approved',active:'1-xirurgiya'});C.saveDraft(99111,{department:'1-xirurgiya',role:'nurse',stage:'checklist',checkStep:1,checkAnswers:['To‘liq ishlayapti'],entries:[{employee:'Saved employee',text:'Saved report'}]});event('main',reentryId,99111,C.departmentLabel('1-xirurgiya'));const reentry=C.draft(99111,'1-xirurgiya');assert.equal(reentry.stage,'roles');assert.equal(reentry.entries.length,1);const roleReply=delivered.at(-1).payload;assert.ok(roleReply.reply_markup.keyboard.some(row=>row.some(b=>b.text===vm.runInContext("DOCTORS",context))));assert.ok(roleReply.reply_markup.keyboard.some(row=>row.some(b=>b.text===vm.runInContext("NURSES",context))));
console.log('Department reentry: unfinished nurse questionnaire opens doctor/nurse selection, saved entries retained.');
const progressInput=JSON.parse(JSON.stringify(fullPeriod));progressInput.reports[0].ref='uncached-date!C2';const progress=C.dashboardAnalysisProgress(progressInput);assert.equal(progress.completed,185);assert.equal(progress.total,210);const progressWrites=[];C.renderAnalysisProgress({getRange:cell=>({setValue:value=>progressWrites.push({cell,value})})},progressInput);assert.equal(progressWrites.length,4);assert.ok(progressWrites.slice(0,3).every(v=>v.value==='Tahlil: 185 / 210'));assert.ok(progressWrites[3].value.includes('2026-10-12 — 2026-10-12'));
console.log('Pending analysis: exact cached progress is displayed in four cells without rebuilding the whole Dashboard.');

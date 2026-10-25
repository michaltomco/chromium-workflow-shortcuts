const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
(async()=>{
  let request,listener,updates=[],activeId=1;
  const source={id:1,windowId:4,active:true,splitViewId:-1};
  const pane={id:2,openerTabId:1,windowId:4,active:true,splitViewId:8};
  const chrome={storage:{session:{set:async v=>request=v.splitSearchRequest,get:async()=>({splitSearchRequest:request}),remove:async()=>{request=null}}},
    tabs:{onCreated:{addListener:fn=>listener=fn},get:async id=>id===1?source:pane,query:async()=>[{id:activeId}],update:async(id,change)=>updates.push({id,change})},
    windows:{getLastFocused:async()=>({id:4})},runtime:{getURL:p=>'chrome-extension://test/'+p}};
  const c=vm.createContext({chrome,console,Date,setTimeout});vm.runInContext(fs.readFileSync('split-search.js','utf8'),c);
  await c.prepareSplitSearch(source);assert.equal(request.sourceId,1);
  await listener({...pane,openerTabId:99});assert.equal(updates.length,0);
  source.splitViewId=8;await listener(pane);assert.equal(updates.length,1);assert.equal(updates[0].id,2);assert(updates[0].change.url.endsWith('split-picker.html'));assert.equal(updates[0].change.active,true);assert.equal(request,null);
  source.splitViewId=-1;await c.prepareSplitSearch(source);source.splitViewId=8;pane.active=false;
  await listener(pane);assert.equal(updates.length,2,'Focus the new pane even when Chromium leaves the source selected');
  source.splitViewId=-1;await c.prepareSplitSearch(source);source.splitViewId=8;activeId=99;
  await listener(pane);assert.equal(updates.length,2,'Do not steal focus from an unrelated tab');
  request=null;activeId=1;
  await c.prepareSplitSearch(source);assert.equal(request,null,'Already-split tabs must not be armed');
  source.splitViewId=-1;await c.prepareSplitSearch(source);request.expires=Date.now()-1;await listener(pane);assert.equal(updates.length,2);
  console.log('PASS: explicit split request, matching source/pane, unrelated-tab rejection, expiry and already-split no-op');
})().catch(e=>{console.error(e);process.exitCode=1});

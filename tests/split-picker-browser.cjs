// Run against disposable Chromium/Xvfb, never the real desktop.
const assert=require('node:assert/strict'),http=require('node:http'),{execFileSync}=require('node:child_process');
const {connect,waitFor}=require('./browser-client.cjs');
const base=process.env.CHROMIUM_DEBUG_URL||'http://127.0.0.1:18765';
assert(process.env.SPLIT_TEST_DISPLAY && process.env.SPLIT_TEST_KEY_HELPER,'Use only an isolated display');
const key=(...keys)=>execFileSync(process.env.SPLIT_TEST_KEY_HELPER,keys);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const focusBin=fs.mkdtempSync(path.join(os.tmpdir(),'workflow-focus-test-'));
fs.symlinkSync(path.resolve('tests/hyprctl-xvfb.cjs'),path.join(focusBin,'hyprctl'));
(async()=>{
 const server=http.createServer((q,r)=>{r.setHeader('Content-Type','text/html');r.end('<title>'+ (q.url==='/existing'?'Design notes':'Source page')+'</title><body>'+q.url+'<script>window.lastKey=null;addEventListener("keydown",e=>window.lastKey=e.key)</script></body>')});
 await new Promise(r=>server.listen(18766,'127.0.0.1',r));const origin='http://127.0.0.1:18766';
 const targets=await(await fetch(base+'/json/list')).json();
 const options=await connect(targets.find(t=>t.url.includes('/options.html'))),setup=await connect(targets.find(t=>t.url==='chrome://extensions/'));
 let picker,windowId;
 const inspect=s=>picker.evaluate(s,{userGesture:false});
 try {
  await options.evaluate(`chrome.permissions.remove({permissions:['tabs']})`);
  await options.evaluate(`chrome.storage.local.set({groupPresets:[{id:'research',slot:1,name:'Saved research',color:'green',urls:['${origin}/preset']}]})`);
  await setup.evaluate(`chrome.developerPrivate.updateExtensionCommand({extensionId:'ejkfmjmeohnjjcljkfojojhkfaehaanf',commandName:'prepare-split-search',keybinding:'Alt+O'})`);
  const w=await options.evaluate(`chrome.windows.create({url:'${origin}/left',focused:true})`);windowId=w.id;const source=w.tabs[0].id;
  const existing=await options.evaluate(`chrome.tabs.create({windowId:${w.id},url:'${origin}/existing',active:false})`);
  const group=await options.evaluate(`chrome.tabs.group({tabIds:${existing.id},createProperties:{windowId:${w.id}}})`);
  await options.evaluate(`chrome.tabGroups.update(${group},{title:'Research',color:'green',collapsed:true})`);
  const tabs=()=>options.evaluate(`chrome.tabs.query({windowId:${w.id}})`);
  async function launch(){
   await options.evaluate(`chrome.tabs.update(${source},{active:true});chrome.windows.update(${w.id},{focused:true})`);
   key('Alt_L','o');await sleep(120);key('Alt_L','Shift_L','n');
   await waitFor(async()=> (await(await fetch(base+'/json/list')).json()).some(t=>t.url.endsWith('/split-picker.html')));
   picker=await connect((await(await fetch(base+'/json/list')).json()).find(t=>t.url.endsWith('/split-picker.html')));
   await waitFor(()=>inspect('document.querySelectorAll(".result").length>0'));
   // Run the actual desktop helper against real native Chromium window titles.
   execFileSync('bash',['focus-newtab.sh','test-browser','--split','Source page - Chromium'],
    {env:{...process.env,PATH:focusBin+path.delimiter+process.env.PATH}});
   await waitFor(()=>inspect('document.hasFocus() && document.activeElement.id==="query" && document.title==="Split picker"'));
   key('r');await waitFor(()=>inspect('document.querySelector("#query").value==="r"'));
   key('BackSpace');assert.equal(await inspect('document.querySelector("#query").value'),'');
   return (await tabs()).find(t=>t.active);
  }
  async function checkPageFocus(pane){
   await waitFor(()=>inspect('document.readyState==="complete" && document.hasFocus()'));
   assert.equal((await tabs()).find(t=>t.id===pane.id).active,true,'The chosen second pane must be active');
   key('z');await waitFor(()=>inspect('window.lastKey==="z"'));
  }
  let pane=await launch();
  assert.equal(await inspect('document.querySelector("#permission").hidden'),false);
  assert.equal(await inspect('document.querySelectorAll(".result").length'),1);
  assert.equal(await inspect('document.querySelector(".section").textContent'),'Preset · Saved research');
  // Declining the optional grant does not block presets or navigation.
  await inspect('chrome.permissions.request=async()=>false;document.querySelector("#allow-tabs").click()');
  await waitFor(()=>inspect('document.querySelector("#status").textContent.includes("declined")'));
  key('Return');await waitFor(()=>inspect('location.href') .then(url=>url===origin+'/preset'));
  await checkPageFocus(pane);
  assert.equal((await tabs()).find(t=>t.id===pane.id).splitViewId,(await tabs()).find(t=>t.id===source).splitViewId);
  picker.ws.close();picker=null;await options.evaluate(`chrome.tabs.remove(${pane.id})`);
  // Grant open-tab access through Chromium's real optional-permission prompt.
  await options.send('Page.bringToFront');
  await options.evaluate('globalThis.permissionResult=null;void chrome.permissions.request({permissions:["tabs"]}).then(v=>globalThis.permissionResult=v)');
  await sleep(1000);key('Tab');key('Return');
  await waitFor(()=>options.evaluate('chrome.permissions.contains({permissions:["tabs"]})'));
  pane=await launch();
  for(const ch of 'research design')key(ch===' '?'space':ch);
  assert.equal(await inspect('document.querySelector("#query").value'),'research design');
  assert.equal(await inspect('document.querySelector(".result .name").textContent'),'Design notes');
  assert.equal(await inspect('document.querySelector(".section").textContent'),'This window · Research');
  if(process.env.SPLIT_PICKER_SCREENSHOT){const shot=await picker.send('Page.captureScreenshot');require('node:fs').writeFileSync(process.env.SPLIT_PICKER_SCREENSHOT,Buffer.from(shot.data,'base64'));}
  key('Escape');assert.equal(await inspect('document.activeElement.id'),'results');
  key('j');assert.equal(await inspect('document.querySelector("#results").getAttribute("aria-activedescendant")'),'result-1');
  key('k');assert.equal(await inspect('document.querySelector("#results").getAttribute("aria-activedescendant")'),'result-0');
  key('h');assert.equal(await inspect('document.querySelector("[data-filter=presets]").getAttribute("aria-pressed")'),'true');
  key('l');assert.equal(await inspect('document.querySelector("[data-filter=all]").getAttribute("aria-pressed")'),'true');
  key('l');assert.equal(await inspect('document.querySelector("[data-filter=tabs]").getAttribute("aria-pressed")'),'true');
  key('h');key('slash');assert.equal(await inspect('document.activeElement.id'),'query');
  assert.equal(await inspect('document.querySelector("#query").value'),'research design','Browsing must preserve search text');
  key('Control_L','j');assert.equal(await inspect('document.querySelector("#query").getAttribute("aria-activedescendant")'),'result-1');
  key('Control_L','k');assert.equal(await inspect('document.querySelector("#query").getAttribute("aria-activedescendant")'),'result-0');key('Return');
  await waitFor(async()=> (await tabs()).find(t=>t.id===pane.id)?.url===origin+'/existing');
  await checkPageFocus(pane);
  assert.equal((await tabs()).find(t=>t.id===existing.id).groupId,group);
  assert.equal((await tabs()).find(t=>t.id===pane.id).splitViewId,(await tabs()).find(t=>t.id===source).splitViewId);
  picker.ws.close();picker=null;await options.evaluate(`chrome.tabs.remove(${pane.id})`);
  pane=await launch();
  await inspect(`document.querySelector('#query').value='${origin}/direct';document.querySelector('#query').dispatchEvent(new Event('input'))`);
  key('Shift_L','Return');await waitFor(async()=> (await tabs()).find(t=>t.id===pane.id)?.url===origin+'/direct');
  await checkPageFocus(pane);
  picker.ws.close();picker=null;await options.evaluate(`chrome.tabs.remove(${pane.id})`);
  pane=await launch();
  await inspect(`document.querySelector('#query').value='workflow picker search';document.querySelector('#query').dispatchEvent(new Event('input'))`);
  key('Shift_L','Return');await waitFor(async()=> /[?&]q=workflow(?:\+|%20)picker(?:\+|%20)search/.test((await tabs()).find(t=>t.id===pane.id)?.url||''));
  assert.equal((await tabs()).find(t=>t.id===pane.id).splitViewId,(await tabs()).find(t=>t.id===source).splitViewId);
  picker.ws.close();picker=null;await options.evaluate(`chrome.tabs.remove(${pane.id})`);
  pane=await launch();
  await options.evaluate('chrome.permissions.remove({permissions:["tabs"]})');
  await waitFor(()=>inspect('!document.querySelector("#permission").hidden'));
  assert.equal(await inspect('document.querySelectorAll(".result").length'),1);
  key('Escape');assert.equal(await inspect('document.activeElement.id'),'results');key('Escape');await waitFor(async()=> !(await tabs()).some(t=>t.id===pane.id));
  assert.equal((await tabs()).find(t=>t.id===source).active,true);
  assert.equal((await tabs()).find(t=>t.id===source).splitViewId,-1);
  console.log('PASS: native split handoff/focus, permission denial/grant/revocation, grouped collapsed tabs, presets, URL/search, source preservation and Escape cancellation');
 }finally{picker?.ws.close();if(windowId)await options.evaluate(`chrome.windows.remove(${windowId})`).catch(()=>{});options.ws.close();setup.ws.close();server.close();fs.rmSync(focusBin,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});

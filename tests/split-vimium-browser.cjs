const assert=require('node:assert/strict'),http=require('node:http'),{execFileSync}=require('node:child_process');
const {connect,waitFor}=require('./browser-client.cjs');
const base=process.env.CHROMIUM_DEBUG_URL||'http://127.0.0.1:18765';
const key=(...keys)=>execFileSync(process.env.SPLIT_TEST_KEY_HELPER,keys);
const text=value=>{for(const ch of value)key(ch===' '?'space':ch)};
(async()=>{
  assert(process.env.SPLIT_TEST_KEY_HELPER,'Use only an isolated virtual display');
  const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<title>'+(req.url==='/existing'?'workflowexisting':'workflowsplit')+'</title><body>'+req.url+'</body>')});
  await new Promise(r=>server.listen(18766,'127.0.0.1',r));const origin='http://127.0.0.1:18766';
  const targets=await(await fetch(base+'/json/list')).json();
  const options=await connect(targets.find(t=>t.url.includes('/options.html')));
  const setup=await connect(targets.find(t=>t.url==='chrome://extensions/'));
  const vimium=await connect(targets.find(t=>t.type==='service_worker'&&t.url.includes('hfjbmag')));
  const windows=[];let right;
  try{
    await vimium.evaluate("__moduleMap.settings.ho('extAllowList','ejkfmjmeohnjjcljkfojojhkfaehaanf')");
    await setup.evaluate("chrome.developerPrivate.updateExtensionCommand({extensionId:'ejkfmjmeohnjjcljkfojojhkfaehaanf',commandName:'prepare-split-search',keybinding:'Alt+O'})");
    for(const scenario of ['existing','url','search']){
      const w=await options.evaluate(`chrome.windows.create({url:${JSON.stringify(origin+'/left')},focused:true})`);windows.push(w.id);
      const existing=await options.evaluate(`chrome.tabs.create({windowId:${w.id},url:${JSON.stringify(origin+'/existing')},active:false})`);
      key('Alt_L','o');await new Promise(r=>setTimeout(r,100));key('Alt_L','Shift_L','n');
      const tabs=()=>options.evaluate(`chrome.tabs.query({windowId:${w.id}})`);
      await waitFor(async()=> (await tabs()).filter(t=>t.splitViewId>=0).length===2);
      const pane=(await tabs()).find(t=>t.active);
      await waitFor(async()=> (await(await fetch(base+'/json/list')).json()).some(t=>t.url.includes('/newtab.html?focus')));
      const target=(await(await fetch(base+'/json/list')).json()).find(t=>t.url.includes('/newtab.html?focus'));
      right=await connect(target);
      const inspect=expression=>right.evaluate(expression,{userGesture:false});
      await waitFor(()=>inspect('document.title==="Vimium Split New Tab"'));
      key('F6');key('F6');key('F6');
      await waitFor(()=>inspect('location.href.includes("/pages/blank.html") && document.hasFocus()'));
      await new Promise(r=>setTimeout(r,700));
      // These real keypresses must go into Vimium, not the native address bar.
      if(scenario==='existing')text('workflowexisting');
      else if(scenario==='url'){
        // Native typing tests focus; CDP inserts remaining punctuation into the
        // already-focused Vimium input without fabricating page focus.
        text('http');await right.send('Input.insertText',{text:origin.slice(4)+'/new'});
      }else text('workflowsearch');
      await new Promise(r=>setTimeout(r,500));
      if(scenario==='existing')key('Down');
      key('Return');
      const expected=scenario==='existing'?origin+'/existing':scenario==='url'?origin+'/new':null;
      await waitFor(async()=>{
        const current=(await tabs()).find(t=>t.id===pane.id);
        if(expected)return current?.status==='complete' && await inspect('location.href')===expected;
        return (await inspect('location.href')).includes('q=workflowsearch');
      });
      assert.equal((await tabs()).find(t=>t.id===pane.id).splitViewId,pane.splitViewId);
      assert.equal((await tabs()).find(t=>t.id===w.tabs[0].id).splitViewId,pane.splitViewId);
      assert.equal((await tabs()).find(t=>t.id===existing.id).groupId,-1);
      console.log('PASS: '+scenario+' selection stays in second split pane; original tabs retained');
      right.ws.close();right=null;await options.evaluate(`chrome.windows.remove(${w.id})`);windows.pop();
    }
  }finally{for(const id of (process.env.KEEP_SPLIT_TEST?[]:windows))await options.evaluate(`chrome.windows.remove(${id})`).catch(()=>{});right?.ws.close();options.ws.close();vimium.ws.close();setup.ws.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

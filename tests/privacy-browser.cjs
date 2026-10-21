const assert = require('node:assert/strict');
const http = require('node:http');
const {execFileSync} = require('node:child_process');
const {connect,waitFor} = require('./browser-client.cjs');
const base=process.env.CHROMIUM_DEBUG_URL || 'http://127.0.0.1:18765';
assert(process.env.SPLIT_TEST_KEY_HELPER, 'Use only with a disposable Xvfb display');
const key=(...keys)=>execFileSync(process.env.SPLIT_TEST_KEY_HELPER,keys);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(`<!doctype html><title>Video privacy test</title><video muted autoplay style="width:500px;object-fit:cover"></video><canvas width="640" height="360"></canvas><script>const c=document.querySelector('canvas'),ctx=c.getContext('2d');setInterval(()=>{ctx.fillStyle='blue';ctx.fillRect(0,0,640,360)},50);const v=document.querySelector('video');v.srcObject=c.captureStream(20);v.play();</script>`)});
  await new Promise(r=>server.listen(18766,'127.0.0.1',r));
  const targets=await(await fetch(base+'/json/list')).json();
  const options=await connect(targets.find(t=>t.url.includes('/options.html')));
  const setup=await connect(targets.find(t=>t.url==='chrome://extensions/'));
  let video,windowId;
  try {
    const perms=await options.evaluate('chrome.permissions.getAll()');
    assert(!perms.permissions.includes('tabs'));assert.deepEqual(perms.origins||[],[]);
    const manifest=await options.evaluate('chrome.runtime.getManifest()');
    assert(!manifest.content_scripts && !manifest.host_permissions && !manifest.optional_host_permissions);
    // One unrelated matching tab must stay untouched in default mode.
    const w=await options.evaluate('chrome.windows.create({url:"https://www.messenger.com/",focused:true})');windowId=w.id;
    await options.evaluate('chrome.storage.local.remove(["managedTabGroups","chatTabGroup"])');
    key('Alt_L','m');await waitFor(()=>options.evaluate('(async()=>!!(await chrome.storage.local.get("managedTabGroups")).managedTabGroups?.chat)()'));
    assert.equal(await options.evaluate(`(async()=> (await chrome.tabs.get(${w.tabs[0].id})).groupId)()`),-1);
    const tabs=await options.evaluate(`chrome.tabs.query({windowId:${w.id}})`);
    assert(!tabs.find(t=>t.id!==w.tabs[0].id && t.url?.startsWith('https://')), 'Other sites remain unreadable before invocation');
    key('Alt_L','m');await waitFor(()=>options.evaluate('(async()=>{const {chatTabGroup}=await chrome.storage.local.get("chatTabGroup");return (await chrome.tabGroups.get(chatTabGroup.id)).collapsed})()'));
    key('Alt_L','m');await waitFor(()=>options.evaluate('(async()=>{const {chatTabGroup}=await chrome.storage.local.get("chatTabGroup");return !(await chrome.tabGroups.get(chatTabGroup.id)).collapsed})()'));
    assert.equal((await options.evaluate(`chrome.tabs.query({windowId:${w.id}})`)).length,4); // unrelated + 3 preset tabs
    const ref=await options.evaluate('(async()=> (await chrome.storage.local.get("managedTabGroups")).managedTabGroups.chat)()');
    await options.evaluate('chrome.tabs.remove('+ref.tabs[1].id+')');
    key('Alt_L','m');await waitFor(()=>options.evaluate('(async()=> (await chrome.tabGroups.get('+ref.id+')).collapsed)()'));
    key('Alt_L','m');await waitFor(()=>options.evaluate('(async()=> (await chrome.tabs.query({groupId:'+ref.id+'})).length===3)()'));
    console.log('PASS: no default host/tab-reading access; presets ignore unrelated matching tabs and reopen without duplicates');
    await options.evaluate(`chrome.tabs.update(${w.tabs[0].id},{url:'http://127.0.0.1:18766/',active:true})`);
    await waitFor(async()=> (await(await fetch(base+'/json/list')).json()).some(t=>t.url==='http://127.0.0.1:18766/'));
    video=await connect((await(await fetch(base+'/json/list')).json()).find(t=>t.url==='http://127.0.0.1:18766/'));
    await waitFor(()=>video.evaluate('document.querySelector("video")?.readyState>=2'));
    for(const [commandName,keybinding] of [['video-fullscreen','Alt+P'],['video-pip','Alt+Shift+P']])await setup.evaluate(`chrome.developerPrivate.updateExtensionCommand(${JSON.stringify({extensionId:'ejkfmjmeohnjjcljkfojojhkfaehaanf',commandName,keybinding})})`);
    key('Alt_L','p');await waitFor(()=>video.evaluate('!!document.fullscreenElement'));
    assert.equal(await video.evaluate('getComputedStyle(document.querySelector("video")).objectFit'),'contain');
    key('Alt_L','p');await waitFor(()=>video.evaluate('!document.fullscreenElement'));
    key('Alt_L','Shift_L','p');await waitFor(()=>video.evaluate('!!document.pictureInPictureElement'));
    await options.evaluate(`chrome.windows.update(${w.id},{focused:true});chrome.tabs.update(${w.tabs[0].id},{active:true})`);
    key('Alt_L','Shift_L','p');await waitFor(()=>video.evaluate('!document.pictureInPictureElement'));
    // Native remapping applies immediately without installing a page listener.
    await setup.evaluate(`chrome.developerPrivate.updateExtensionCommand({extensionId:'ejkfmjmeohnjjcljkfojojhkfaehaanf',commandName:'video-fullscreen',keybinding:'Alt+F'})`);
    key('Alt_L','p');await sleep(150);assert.equal(await video.evaluate('!!document.fullscreenElement'),false);
    key('Alt_L','f');await waitFor(()=>video.evaluate('!!document.fullscreenElement'));key('Alt_L','f');await waitFor(()=>video.evaluate('!document.fullscreenElement'));
    await video.send('Page.navigate',{url:'http://localhost:18766/'});await waitFor(()=>video.evaluate('document.querySelector("video")?.readyState>=2'));
    const injected=await options.evaluate(`chrome.scripting.executeScript({target:{tabId:${w.tabs[0].id}},func:()=>true}).then(()=>true,()=>false)`);
    assert.equal(injected,false,'Navigation to another origin revokes activeTab access');
    assert.deepEqual((await options.evaluate('chrome.permissions.getAll()')).origins||[],[]);
    console.log('PASS: native fullscreen/PiP with temporary access, contain sizing, live remapping and access revoked on navigation');
  } finally {
    if(windowId)await options.evaluate(`chrome.windows.remove(${windowId})`).catch(()=>{});
    video?.ws.close();options.ws.close();setup.ws.close();server.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1});

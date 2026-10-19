const fs = require('node:fs');
const assert = require('node:assert/strict');
// Use only with a disposable profile started with remote debugging and this extension loaded.
const base = process.env.CHROMIUM_DEBUG_URL || 'http://127.0.0.1:18764';
async function connect(target) {
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, {once:true}); ws.addEventListener('error', reject, {once:true}); });
  let id = 0; const pending = new Map();
  ws.addEventListener('message', event => { const message = JSON.parse(event.data); if (message.id) { const request = pending.get(message.id); pending.delete(message.id); if(message.error) request.reject(Error(message.error.message)); else request.resolve(message.result); } });
  const send = (method, params = {}) => new Promise((resolve,reject) => { const request = ++id; pending.set(request,{resolve,reject}); ws.send(JSON.stringify({id:request,method,params})); });
  const evaluate = async expression => { const result = await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true}); if(result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails)); return result.result.value; };
  return {send,evaluate,ws};
}
async function waitFor(test) { for(let i=0;i<80;i++){try {if(await test())return;}catch{} await new Promise(resolve=>setTimeout(resolve,75));}throw Error('Timed out waiting for page'); }
(async()=>{
  let targets = await (await fetch(base+'/json/list')).json();
  const setup = await connect(targets.find(t=>t.type==='page'));
  await setup.send('Page.navigate',{url:'chrome://extensions/'});
  await waitFor(()=>setup.evaluate('typeof chrome.developerPrivate !== "undefined"'));
  await setup.evaluate('chrome.developerPrivate.updateProfileConfiguration({inDeveloperMode:true})');
  const extensions = await setup.evaluate('chrome.developerPrivate.getExtensionsInfo({includeDisabled:true,includeTerminated:true})');
  const extension = extensions.find(item => item.name === 'Chromium Workflow Shortcuts');
  assert(extension, 'Load the extension in the disposable profile before testing');
  await setup.evaluate('chrome.management.setEnabled('+JSON.stringify(extension.id)+',true)');
  await setup.evaluate('chrome.developerPrivate.reload('+JSON.stringify(extension.id)+')');
  const target = await (await fetch(base+'/json/new?'+encodeURIComponent('chrome-extension://'+extension.id+'/options.html'),{method:'PUT'})).json();
  const page = await connect(target);
  await waitFor(async () => {
    if (await page.evaluate('typeof chrome.storage !== "undefined"')) return true;
    if (await page.evaluate('document.body?.innerText.includes("ERR_BLOCKED_BY_CLIENT")')) await page.send("Page.reload");
    return false;
  });
  await page.evaluate('chrome.storage.local.remove("shortcutSettings")');
  await page.send("Page.reload");
  const errors=[];page.ws.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.text)});
  await page.send('Runtime.enable');
  await page.send('Emulation.setDeviceMetricsOverride',{width:1100,height:1100,deviceScaleFactor:1,mobile:false});
  await page.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'dark'}]});
  await waitFor(()=>page.evaluate('document.querySelectorAll("#browser-actions .action").length === 19'));
  assert.equal(await page.evaluate('document.querySelectorAll("#page-actions .action").length'),3);
  assert.equal(await page.evaluate('document.querySelectorAll("#desktop-actions .action").length'),5);
  assert.equal(await page.evaluate('document.querySelector("#save").disabled'),true);
  await page.evaluate('document.querySelector("#page-actions .shortcut").click()');
  await waitFor(()=>page.evaluate('document.querySelectorAll(".recording").length===1'));
  // A registered command must report a conflict, rather than act on the tab.
  await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'j',code:'KeyJ',windowsVirtualKeyCode:74,modifiers:1});
  await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'j',code:'KeyJ',windowsVirtualKeyCode:74,modifiers:0});
  await waitFor(()=>page.evaluate('document.querySelector("#status").textContent.includes("Chromium")'));
  assert(await page.evaluate('document.querySelector("#status").textContent.includes("Next tab")'));
  // Record an available key, save it, and verify storage plus reload persistence.
  await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'f',code:'KeyF',windowsVirtualKeyCode:70,modifiers:1});
  await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'f',code:'KeyF',windowsVirtualKeyCode:70,modifiers:0});
  await waitFor(()=>page.evaluate('document.querySelectorAll(".recording").length===0'));
  assert.equal(await page.evaluate('document.querySelector("#save").disabled'),false);
  await page.evaluate('document.querySelector("#save").click()');
  await waitFor(()=>page.evaluate('document.querySelector("#save").disabled'));
  assert.equal(await page.evaluate('(async()=> (await chrome.storage.local.get("shortcutSettings")).shortcutSettings.page.videoFullscreen)()'),'Alt+F');
  await page.send('Page.reload');
  await waitFor(()=>page.evaluate('document.querySelector("#page-actions .shortcut")?.textContent === "Alt+F"'));
  // Filtering should work for commands as well as editable rows.
  await page.evaluate('const search=document.querySelector("#search");search.value="download";search.dispatchEvent(new Event("input"))');
  assert.equal(await page.evaluate('[...document.querySelectorAll("#browser-actions .action")].filter(row=>!row.hidden).length'),1);
  await page.evaluate('document.querySelector("#search").value="";document.querySelector("#search").dispatchEvent(new Event("input"))');
  // Clear a shortcut and restore defaults without changing Chromium assignments.
  await page.evaluate('document.querySelector("#page-actions .clear").click();document.querySelector("#save").click()');
  await waitFor(()=>page.evaluate('document.querySelector("#save").disabled'));
  assert.equal(await page.evaluate('(async()=> (await chrome.storage.local.get("shortcutSettings")).shortcutSettings.page.videoFullscreen)()'),'');
  await page.evaluate('document.querySelector("#reset").click();document.querySelector("#save").click()');
  await waitFor(()=>page.evaluate('document.querySelector("#save").disabled'));
  assert.equal(await page.evaluate('(async()=> (await chrome.storage.local.get("shortcutSettings")).shortcutSettings.page.videoFullscreen)()'),'Alt+K');
  // Export content is valid Lua and uses the saved video/PiP keys.
  fs.writeFileSync('/tmp/workflow-exported-shortcuts.lua',await page.evaluate('WorkflowShortcuts.toHyprland(draft)'));
  await page.evaluate('document.querySelector("#desktop-section").open=false');
  const screenshot=await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
  fs.writeFileSync('/tmp/workflow-options-page.png',Buffer.from(screenshot.data,'base64'));
  await page.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert.equal(await page.evaluate('document.documentElement.scrollWidth <= innerWidth'),true);
  const mobile=await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
  fs.writeFileSync('/tmp/workflow-options-mobile.png',Buffer.from(mobile.data,'base64'));
  assert.deepEqual(errors,[]);
  console.log('PASS: real Chromium options page, native conflict capture, recording, save/reload, clear/reset, search, export, mobile layout, no JS errors');
  page.ws.close();setup.ws.close();
})().catch(error=>{console.error(error);process.exit(1)});

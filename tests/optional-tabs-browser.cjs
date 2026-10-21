const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {connect,waitFor}=require('./browser-client.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const key=(...keys)=>execFileSync(process.env.SPLIT_TEST_KEY_HELPER,keys);
(async()=>{
  assert(process.env.SPLIT_TEST_KEY_HELPER,'Use only with a disposable virtual display');
  const targets=await(await fetch((process.env.CHROMIUM_DEBUG_URL||'http://127.0.0.1:18765')+'/json/list')).json();
  const c=await connect(targets.find(t=>t.url.includes('/options.html')));
  try {
    await c.evaluate('chrome.storage.local.set({reuseExistingTabs:false})');await c.evaluate('chrome.permissions.remove({permissions:["tabs"]})');
    await c.send('Page.reload');await waitFor(()=>c.evaluate('document.querySelector("#reuse-tabs") && !document.querySelector("#reuse-tabs").checked'));
    const show=()=>c.evaluate('(async()=>{const t=await chrome.tabs.getCurrent();await chrome.windows.update(t.windowId,{focused:true});await chrome.tabs.update(t.id,{active:true});document.querySelector("#reuse-tabs").click()})()');
    // Chrome may remember consent in a reused profile; exercise denial deterministically.
    await c.evaluate('globalThis.requestPermission=chrome.permissions.request;chrome.permissions.request=async()=>false');
    await show();
    await c.evaluate('chrome.permissions.request=globalThis.requestPermission');
    await waitFor(()=>c.evaluate('!document.querySelector("#reuse-tabs").disabled && !document.querySelector("#reuse-tabs").checked'));
    assert.equal(await c.evaluate('chrome.permissions.contains({permissions:["tabs"]})'),false);
    await show();await sleep(700);
    if(!await c.evaluate('chrome.permissions.contains({permissions:["tabs"]})'))key('Tab','Return');
    await waitFor(()=>c.evaluate('(async()=> (await chrome.storage.local.get("reuseExistingTabs")).reuseExistingTabs===true)()'));
    assert.equal(await c.evaluate('chrome.permissions.contains({permissions:["tabs"]})'),true);
    await c.evaluate('document.querySelector("#reuse-tabs").click()');
    await waitFor(()=>c.evaluate('(async()=> !(await chrome.permissions.contains({permissions:["tabs"]})))()'));
    assert.equal(await c.evaluate('(async()=> (await chrome.storage.local.get("reuseExistingTabs")).reuseExistingTabs)()'),false);
    await show();await sleep(700);
    if(!await c.evaluate('chrome.permissions.contains({permissions:["tabs"]})'))key('Tab','Return');
    await waitFor(()=>c.evaluate('(async()=> (await chrome.storage.local.get("reuseExistingTabs")).reuseExistingTabs===true)()'));
    console.log('PASS: optional permission denial path, native opt-in grant, and revocation; enabled for reuse regressions');
  }finally{c.ws.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

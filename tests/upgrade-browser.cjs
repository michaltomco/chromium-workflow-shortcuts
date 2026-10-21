// Prepare a disposable old-version copy and Chromium profile before running.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {connect,waitFor}=require('./browser-client.cjs');
(async()=>{
  const base=process.env.UPGRADE_DEBUG_URL||'http://127.0.0.1:18767';
  const root=process.env.UPGRADE_EXTENSION_PATH;
  assert(root?.startsWith('/tmp/'), 'Only upgrade a disposable /tmp extension copy');
  const targets=await(await fetch(base+'/json/list')).json(),setup=await connect(targets.find(t=>t.type==='page'));
  let page;
  try {
    await setup.send('Page.navigate',{url:'chrome://extensions/'});await waitFor(()=>setup.evaluate('!!chrome.developerPrivate'));
    await setup.evaluate('chrome.developerPrivate.updateProfileConfiguration({inDeveloperMode:true})');
    const extension=(await setup.evaluate('chrome.developerPrivate.getExtensionsInfo({})')).find(e=>e.name==='Chromium Workflow Shortcuts');
    assert.equal(extension.version,'1.29.0');
    const target=await(await fetch(base+'/json/new?'+encodeURIComponent('chrome-extension://'+extension.id+'/options.html'),{method:'PUT'})).json();page=await connect(target);
    await waitFor(()=>page.evaluate('!!chrome.storage'));
    assert.equal(await page.evaluate('chrome.permissions.contains({permissions:["tabs"]})'),true);
    await page.evaluate('chrome.storage.local.set({groupPresets:[{id:"chat",slot:1,name:"Messages",color:"purple",urls:["https://discord.com/"]}]})');
    fs.cpSync(process.cwd(),root,{recursive:true,filter:source=>path.basename(source)!=='.git'});
    await setup.evaluate('chrome.developerPrivate.reload('+JSON.stringify(extension.id)+')');
    page.ws.close();
    const upgradedTarget=await(await fetch(base+'/json/new?'+encodeURIComponent('chrome-extension://'+extension.id+'/options.html'),{method:'PUT'})).json();page=await connect(upgradedTarget);
    await waitFor(async()=>{
      if(await page.evaluate('document.querySelector("#reuse-tabs") && !document.querySelector("#reuse-tabs").checked'))return true;
      if(await page.evaluate('document.body?.innerText.includes("ERR_BLOCKED_BY_CLIENT")'))await page.send('Page.reload');
      return false;
    });
    await waitFor(()=>page.evaluate('(async()=>!(await chrome.permissions.contains({permissions:["tabs"]})))()'));
    const permissions=await page.evaluate('chrome.permissions.getAll()');assert.deepEqual(permissions.origins||[],[]);
    assert.equal(await page.evaluate('document.querySelector(".preset-name").value'),'Messages');
    const commands=await page.evaluate('chrome.commands.getAll()');assert.equal(commands.find(c=>c.name==='cycle-group-previous').shortcut,'Alt+K');assert.equal(commands.find(c=>c.name==='separate-split-view').shortcut,'Alt+Shift+O');
    console.log('PASS: upgrade preserves presets and tab/split keys, removes permanent website grants and revokes old required tabs access');
  }finally{page?.ws.close();setup.ws.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

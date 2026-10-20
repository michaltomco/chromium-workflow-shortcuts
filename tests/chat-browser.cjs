const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
// Use only with disposable Chromium and the Xvfb helper from tests/x11-keys.c.
const base = process.env.CHROMIUM_DEBUG_URL || 'http://127.0.0.1:18765';
assert(process.env.SPLIT_TEST_KEY_HELPER, 'Set SPLIT_TEST_KEY_HELPER to an isolated-display sender');
async function connect(target) {
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  let id = 0; const pending = new Map();
  ws.addEventListener('message', event => { const m = JSON.parse(event.data); if (m.id) {
    const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(Error(m.error.message)) : p.resolve(m.result);
  } });
  const evaluate = expression => new Promise((resolve, reject) => {
    const n = ++id; pending.set(n, { resolve: r => {
      if (r.exceptionDetails) reject(Error(JSON.stringify(r.exceptionDetails))); else resolve(r.result.value);
    }, reject });
    ws.send(JSON.stringify({ id: n, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true, userGesture: true } }));
  });
  return { evaluate, ws };
}
async function waitFor(test) {
  for (let i = 0; i < 120; i++) { if (await test()) return; await new Promise(r => setTimeout(r, 50)); }
  throw Error('Timed out waiting for chat state');
}
const key = mute => execFileSync(process.env.SPLIT_TEST_KEY_HELPER, mute ? ['Alt_L', 'Shift_L', 'm'] : ['Alt_L', 'm']);
(async () => {
  const targets = await (await fetch(base + '/json/list')).json();
  const settings = await connect(targets.find(t => t.url.includes('/options.html')));
  const windows = [];
  const evaluate = settings.evaluate;
  const state = () => evaluate(`(async()=>{
    const saved = (await chrome.storage.local.get('chatTabGroup')).chatTabGroup;
    const group = saved ? await chrome.tabGroups.get(saved.id).catch(()=>null) : null;
    const tabs = group ? await chrome.tabs.query({windowId:group.windowId,groupId:group.id}) : [];
    return {group,tabs,all:await chrome.tabs.query({}),window:await chrome.windows.getLastFocused()};
  })()`);
  try {
    const commands = await evaluate('chrome.commands.getAll()');
    assert.equal(commands.find(c => c.name === 'toggle-group-mute').shortcut, 'Alt+M');
    assert.equal(commands.find(c => c.name === 'mute-collapse-next-group').shortcut, 'Alt+Shift+M');
    const w = await evaluate('chrome.windows.create({url:"about:blank",focused:true})'); windows.push(w.id);
    const outside = w.tabs[0].id;
    const work = await evaluate(`chrome.tabs.group({tabIds:${outside},createProperties:{windowId:${w.id}}})`);
    await evaluate(`chrome.tabGroups.update(${work},{title:'Work',color:'red'})`);
    key(true);
    await new Promise(resolve => setTimeout(resolve, 150));
    assert.equal((await evaluate(`chrome.tabs.query({windowId:${w.id}})`)).length, 1, 'Muting an absent group must not create it');
    key(false);
    await waitFor(async () => { const s = await state(); return s.tabs.length === 3 && s.tabs[0].active; });
    let s = await state(); const groupId = s.group.id;
    assert.deepEqual(s.tabs.map(t => new URL(t.url).hostname), ['www.messenger.com', 'web.whatsapp.com', 'discord.com']);
    assert(s.tabs.every(t => !t.mutedInfo.muted)); assert.equal(s.group.collapsed, false);
    const ids = s.tabs.map(t => t.id);
    console.log('PASS: native Alt+M creates the three chat services in order');
    key(true);
    await waitFor(async () => { const s = await state(); return s.group.collapsed && s.tabs.every(t => t.mutedInfo.muted); });
    s = await state(); assert(s.all.find(t => t.id === outside).active); assert.equal(s.group.color, 'grey');
    assert.equal(s.all.find(t => t.id === outside).mutedInfo.muted, false);
    assert.equal((await evaluate(`chrome.tabGroups.get(${work})`)).collapsed, false);
    console.log('PASS: mute/collapse chat, move out, leave Work unmuted and expanded');
    key(false);
    await waitFor(async () => { const s = await state(); return !s.group.collapsed && s.tabs.every(t => !t.mutedInfo.muted); });
    s = await state(); assert.deepEqual(s.tabs.map(t => t.id), ids); assert(s.tabs[0].active); assert.equal(s.group.color, 'blue');
    await evaluate(`chrome.tabs.update(${outside},{active:true})`);
    key(true);
    await waitFor(async () => (await state()).group.collapsed);
    assert((await state()).all.find(t => t.id === outside).active, 'Muting remotely preserves current tab');
    console.log('PASS: reopen without duplicates; muting from another group preserves focus');
    const other = await evaluate('chrome.windows.create({url:"about:blank",focused:true})'); windows.push(other.id);
    key(false);
    await waitFor(async () => { const s = await state(); return !s.group.collapsed && s.window.id === w.id; });
    s = await state(); assert.equal(s.group.id, groupId); assert.deepEqual(s.tabs.map(t => t.id), ids);
    // Focus a different window before invoking the browser-wide command.
    await evaluate(`chrome.windows.update(${other.id},{focused:true})`);
    await waitFor(async () => (await state()).window.id === other.id);
    key(true);
    await waitFor(async () => (await state()).group.collapsed);
    s = await state(); assert.equal(s.window.id, other.id); assert(s.all.find(t => t.id === other.tabs[0].id).active);
    console.log('PASS: reuse across windows and mute without stealing another window focus');
    await evaluate(`chrome.tabs.remove(${ids[1]})`);
    key(false);
    await waitFor(async () => { const s = await state(); return s.tabs.length === 3 && !s.group.collapsed; });
    s = await state(); assert(s.tabs.some(t => t.id === ids[0])); assert(s.tabs.some(t => t.id === ids[2]));
    const repairedIds = s.tabs.map(t => t.id);
    assert(!repairedIds.includes(ids[1]));
    await evaluate('chrome.storage.local.remove("chatTabGroup")');
    key(false);
    await waitFor(async () => (await state()).tabs.length === 3);
    assert.deepEqual((await state()).tabs.map(t => t.id), repairedIds);
    console.log('PASS: repair missing service and rediscover group after stored ID is lost');
    await evaluate(`chrome.tabGroups.update(${groupId},{title:'Conversations'})`);
    await evaluate('chrome.storage.local.remove("chatTabGroup")');
    key(false);
    await waitFor(async () => (await state()).tabs.length === 3);
    assert.equal((await state()).group.id, groupId);
    assert.deepEqual((await state()).tabs.map(t => t.id), repairedIds);
    console.log('PASS: recover a renamed chat group from its service tabs');
    await evaluate(`chrome.tabs.remove(${JSON.stringify(repairedIds)})`);
    // Reuse ungrouped and already grouped service tabs without navigating them.
    const existing = await evaluate(`(async()=>{const a=await chrome.tabs.create({windowId:${w.id},url:'https://www.messenger.com/t/reuse',active:false});
      const b=await chrome.tabs.create({windowId:${other.id},url:'https://web.whatsapp.com/',active:false});
      await chrome.tabs.group({tabIds:a.id,groupId:${work}});return [a.id,b.id]})()`);
    await evaluate(`chrome.windows.update(${other.id},{focused:true})`);
    key(false);
    await waitFor(async () => (await state()).tabs.length === 3);
    s = await state(); assert(s.tabs.some(t => t.id === existing[0])); assert(s.tabs.some(t => t.id === existing[1]));
    assert(s.tabs.find(t => t.id === existing[0]).url.endsWith('/t/reuse'));
    assert.equal(s.group.windowId, other.id);
    assert.equal(s.all.find(t => t.id === outside).groupId, work);
    console.log('PASS: adopt existing service tabs across windows, keep their URLs and unrelated group');
    await evaluate(`chrome.tabs.remove(${other.tabs[0].id})`);
    key(true);
    await waitFor(async () => (await state()).group.collapsed);
    s = await state();
    const outsideChat = s.all.filter(t => t.windowId === other.id && t.groupId !== s.group.id);
    assert.equal(outsideChat.length, 1);
    assert(outsideChat[0].active);
    assert(s.tabs.every(t => t.mutedInfo.muted));
    console.log('PASS: a chat-only window gets an outside tab so Chat can collapse');
    // Configure a new website through the actual settings UI. Accept a site
    // permission prompt only in this disposable profile/virtual display.
    await evaluate(`chrome.tabGroups.update(${s.group.id},{title:'Conversations'})`);
    const existingChatId = s.group.id;
    const settingsWindow = await evaluate('chrome.windows.getCurrent()');
    await evaluate(`chrome.windows.update(${settingsWindow.id},{focused:true})`);
    await evaluate('document.querySelector("#chat-urls").value="https://example.org/messages";document.querySelector("#chat-urls").dispatchEvent(new Event("input"));document.querySelector("#save").click()');
    await new Promise(resolve => setTimeout(resolve, 300));
    if (!await evaluate('chrome.permissions.contains({origins:["https://*.example.org/*"]})')) {
      execFileSync(process.env.SPLIT_TEST_KEY_HELPER, ['Tab']);
      execFileSync(process.env.SPLIT_TEST_KEY_HELPER, ['Return']);
    }
    await waitFor(()=>evaluate('document.querySelector("#save").disabled && document.querySelector("#status").textContent.startsWith("Saved.")'));
    assert.deepEqual(await evaluate('(async()=> (await chrome.storage.local.get("chatGroupUrls")).chatGroupUrls)()'), ['https://example.org/messages']);
    await evaluate(`chrome.windows.update(${other.id},{focused:true})`);
    key(false);
    await waitFor(async()=> (await state()).tabs.some(t=>t.url==='https://example.org/messages'));
    s = await state();
    assert.equal(s.group.id, existingChatId, 'Changing all configured sites must retain a renamed managed group');
    assert.equal(s.tabs.length, 4, 'Keep the original tabs when editing URLs');
    key(true);
    await waitFor(async()=> { const s=await state(); return s.group.collapsed && s.tabs.every(t=>t.mutedInfo.muted); });
    await evaluate('document.querySelector("#reset-chat").click();document.querySelector("#save").click()');
    await waitFor(()=>evaluate('document.querySelector("#save").disabled && document.querySelector("#status").textContent.startsWith("Saved.")'));
    console.log('PASS: custom URL saved with site access, used by native Alt+M, muted by Alt+Shift+M, original tabs preserved');
  } finally {
    for (const id of windows) await evaluate(`chrome.windows.remove(${id})`).catch(() => {});
    settings.ws.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

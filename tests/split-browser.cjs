const assert = require('node:assert/strict');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
// Run only against disposable Chromium on a virtual display. The helper must
// send keys exclusively to that display, never the user's desktop.
const base = process.env.CHROMIUM_DEBUG_URL || 'http://127.0.0.1:18765';
const keyHelper = process.env.SPLIT_TEST_KEY_HELPER;
assert(keyHelper, 'Set SPLIT_TEST_KEY_HELPER to an isolated-display key sender');
async function connect(target) {
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  let id = 0; const pending = new Map();
  ws.addEventListener('message', event => { const m = JSON.parse(event.data); if (m.id) {
    const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(Error(m.error.message)) : p.resolve(m.result);
  } });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const n = ++id; pending.set(n, { resolve, reject }); ws.send(JSON.stringify({ id: n, method, params }));
  });
  const evaluate = async expression => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value;
  };
  return { evaluate, ws };
}
async function waitFor(test) {
  for (let i = 0; i < 100; i++) { if (await test()) return; await new Promise(r => setTimeout(r, 50)); }
  throw Error('Timed out waiting for split state');
}
const keys = (...names) => execFileSync(keyHelper, names);
const shape = tabs => tabs.map(({ id, index, groupId, pinned, active, discarded }) => ({ id, index, groupId, pinned, active, discarded }));
(async () => {
  const server = http.createServer((req, res) => { res.setHeader('content-type', 'text/html');
    res.end('<title>Workflow split test</title><body>Split test<script>window.loadToken=crypto.randomUUID()</script>'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  let settings;
  try {
    const targets = await (await fetch(base + '/json/list')).json();
    settings = await connect(targets.find(t => t.url.includes('/options.html')));
    const command = await settings.evaluate('chrome.commands.getAll().then(cs=>cs.find(c=>c.name==="separate-split-view"))');
    assert.equal(command.shortcut, 'Alt+Shift+O', 'Browser-wide key must be registered');
    for (const scenario of [
      { name: 'internal split picker' },
      { name: 'left pane', web: true, left: true },
      { name: 'right pane', web: true },
      { name: 'grouped left pane', group: true, web: true, left: true },
      { name: 'grouped right pane', group: true, web: true },
      { name: 'pinned split', pinned: true, web: true },
      { name: 'address bar', web: true, omnibox: true },
    ].filter(s => !process.env.SPLIT_TEST_SCENARIO || s.name.includes(process.env.SPLIT_TEST_SCENARIO))) {
      const window = await settings.evaluate(`chrome.windows.create({url:${JSON.stringify(url)},focused:true})`);
      const windowId = window.id, originalId = window.tabs[0].id;
      const query = () => settings.evaluate(`chrome.tabs.query({windowId:${windowId}})`);
      const pages = [];
      try {
        if (scenario.group) await settings.evaluate(`chrome.tabs.group({tabIds:${originalId},createProperties:{windowId:${windowId}}})`);
        if (scenario.pinned) await settings.evaluate(`chrome.tabs.update(${originalId},{pinned:true})`);
        keys('Alt_L', 'Shift_L', 'n');
        await waitFor(async () => (await query()).filter(t => t.splitViewId >= 0).length === 2).catch(async error => { console.error('Split creation state:', await settings.evaluate('chrome.tabs.query({})')); throw error; });
        if (scenario.web) {
          const right = (await query()).find(t => t.active);
          await settings.evaluate(`chrome.tabs.update(${right.id},{url:${JSON.stringify(url + 'right')}})`);
          await waitFor(async () => (await query()).every(t => t.status === 'complete'));
          const targets = await (await fetch(base + '/json/list')).json();
          for (const target of targets.filter(t => t.url.startsWith(url))) {
            const page = await connect(target); pages.push({ page, token: await page.evaluate('window.loadToken') });
          }
        }
        if (scenario.left) await settings.evaluate(`chrome.tabs.update(${originalId},{active:true})`);
        const before = await query();
        if (scenario.omnibox) keys('Control_L', 'l');
        keys('Alt_L', 'Shift_L', 'o');
        await waitFor(async () => { const tabs = await query(); return tabs.length === before.length && tabs.every(t => t.splitViewId === -1); });
        assert.deepEqual(shape(await query()), shape(before), scenario.name + ': preserve tabs, order, group, pin and active pane');
        for (const { page, token } of pages) assert.equal(await page.evaluate('window.loadToken'), token, 'Do not reload real pages');
        keys('Alt_L', 'Shift_L', 'o');
        await new Promise(resolve => setTimeout(resolve, 150));
        assert.deepEqual(shape(await query()), shape(before), 'Repeated separation is a no-op');
        console.log('PASS: native Alt+Shift+O from ' + scenario.name);
      } finally {
        for (const { page } of pages) page.ws.close();
        await settings.evaluate(`chrome.windows.remove(${windowId})`).catch(() => {});
      }
    }
  } finally { settings?.ws.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

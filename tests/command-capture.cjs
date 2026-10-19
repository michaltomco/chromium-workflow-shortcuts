const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('background.js', 'utf8');
const code = source.slice(source.indexOf('async function captureRegisteredShortcut'), source.indexOf('let commandCaptureQueue'));
(async () => {
  let capture = { tabId: 4 }, activeId = 4, liveContext = true, messages = [], cleared = false;
  const chrome = {
    storage: { session: { get: async () => ({ shortcutCapture: capture }), remove: async () => { cleared = true; } } },
    tabs: { query: async () => [{ id: activeId }] },
    commands: { getAll: async () => [{ name: 'close-current-tab', shortcut: 'Alt+W', description: 'Close tab' }] },
    runtime: { getURL: path => `chrome-extension://test/${path}`, getContexts: async () => liveContext ? [{ tabId: 4 }] : [],
      sendMessage: async message => { messages.push(message); } },
  };
  const context = vm.createContext({ chrome }); vm.runInContext(code, context);
  assert.equal(await context.captureRegisteredShortcut('close-current-tab'), true);
  assert.equal(messages[0].shortcut, 'Alt+W');
  activeId = 8; messages = [];
  assert.equal(await context.captureRegisteredShortcut('close-current-tab'), false);
  assert.equal(messages.length, 0);
  activeId = 4; liveContext = false;
  assert.equal(await context.captureRegisteredShortcut('close-current-tab'), false);
  assert(cleared, 'Navigating away from the recorder must release native shortcuts');
  capture = undefined;
  assert.equal(await context.captureRegisteredShortcut('close-current-tab'), false);
  console.log('PASS: native shortcut capture, other-tab isolation, stale-context cleanup');
})().catch(error => { console.error(error); process.exitCode = 1; });

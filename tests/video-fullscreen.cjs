const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const listeners = {};
let requested = null, exits = 0;
function video(name, paused, width) {
  return { name, paused, readyState: 4, videoWidth: 1920, clientWidth: width, clientHeight: width / 2,
    requestFullscreen() { requested = name; return Promise.resolve(); } };
}
const document = { fullscreenElement: null, fullscreenEnabled: true,
  querySelectorAll: () => [video('paused', true, 1000), video('playing', false, 500)],
  exitFullscreen() { exits++; return Promise.resolve(); } };
vm.runInNewContext(fs.readFileSync('keyboard.js', 'utf8'), {
  document, window: { addEventListener(type, callback) { listeners[type] = callback; } }, console,
});
function key(type, overrides = {}) {
  const event = { key: 'f', code: 'KeyF', altKey: true, ctrlKey: false, shiftKey: false,
    metaKey: false, isComposing: false, repeat: false,
    preventDefault() {}, stopImmediatePropagation() {}, ...overrides };
  listeners[type](event);
}
key('keydown');
assert.equal(requested, 'playing');
requested = null;
key('keyup'); key('keypress'); key('keydown', { repeat: true });
assert.equal(requested, null);
document.fullscreenElement = {};
key('keydown'); assert.equal(exits, 1);
document.fullscreenElement = null;
key('keydown');
assert.equal(requested, 'playing');
requested = null;
document.querySelectorAll = () => [];
key('keydown'); assert.equal(requested, null);
console.log('PASS: playing-video selection, fullscreen exit, repeat suppression, no-video page');

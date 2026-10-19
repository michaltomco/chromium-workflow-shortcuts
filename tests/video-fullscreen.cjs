const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const listeners = {};
let requested = null, exits = 0, pipRequests = 0, pipExits = 0;
function video(name, paused, width) {
  return { name, paused, readyState: 4, videoWidth: 1920, clientWidth: width, clientHeight: width / 2,
    requestFullscreen() { requested = name; return Promise.resolve(); },
    requestPictureInPicture() { pipRequests++; return Promise.resolve(); } };
}
const document = { fullscreenElement: null, fullscreenEnabled: true,
  pictureInPictureElement: null, pictureInPictureEnabled: true,
  exitPictureInPicture() { pipExits++; return Promise.resolve(); },
  querySelectorAll: () => [video('paused', true, 1000), video('playing', false, 500)],
  exitFullscreen() { exits++; return Promise.resolve(); } };
vm.runInNewContext(fs.readFileSync('keyboard.js', 'utf8'), {
  document, window: { addEventListener(type, callback) { listeners[type] = callback; } }, console,
});
function key(type, overrides = {}) {
  const event = { key: 'k', code: 'KeyK', altKey: true, ctrlKey: false, shiftKey: false,
    metaKey: false, isComposing: false, repeat: false,
    preventDefault() {}, stopImmediatePropagation() {}, ...overrides };
  listeners[type](event);
}
key('keydown', { key: 'F', code: 'KeyF', shiftKey: true });
assert.equal(requested, null, 'Alt+Shift+F is no longer intercepted');
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
key('keydown', { key: 'K', shiftKey: true });
assert.equal(pipRequests, 1);
assert.equal(requested, null, 'PiP shortcut must not trigger fullscreen');
document.pictureInPictureElement = {};
key('keydown', { key: 'K', shiftKey: true });
assert.equal(pipExits, 1);
document.pictureInPictureElement = null;
key('keydown', { key: 'p', code: 'KeyP' });
assert.equal(pipRequests, 1, 'Alt+P is no longer intercepted');
document.querySelectorAll = () => [];
key('keydown'); assert.equal(requested, null);
console.log('PASS: Alt+K fullscreen, Alt+Shift+K PiP, old shortcuts ignored, repeat suppression, no-video page');

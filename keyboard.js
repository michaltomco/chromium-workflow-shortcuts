// Run directly from key events to retain the gesture needed by video APIs.
function toggleVideoFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(console.error);
    return;
  }
  const video = [...document.querySelectorAll("video")]
    .filter(video => video.readyState >= 2 && video.videoWidth > 0)
    .sort((a, b) => Number(a.paused) - Number(b.paused)
      || b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0];
  if (video && document.fullscreenEnabled) video.requestFullscreen().catch(console.error);
}

function togglePictureInPicture() {
  if (document.pictureInPictureElement) {
    document.exitPictureInPicture().catch(console.error);
    return;
  }
  const videos = [...document.querySelectorAll("video")]
    .filter(video => video.readyState >= 2 && video.videoWidth > 0)
    .sort((a, b) => Number(a.paused) - Number(b.paused)
      || b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight);
  const video = videos[0];
  if (!video || !document.pictureInPictureEnabled) return;
  video.disablePictureInPicture = false;
  video.requestPictureInPicture().catch(console.error);
}

// Keep page bindings in sync without reloading open tabs after a settings edit.
let shortcutSettings = WorkflowShortcuts.defaults();
chrome.storage.local.get('shortcutSettings').then(data => {
  shortcutSettings = WorkflowShortcuts.resolve(data.shortcutSettings);
}).catch(() => {});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.shortcutSettings) {
    shortcutSettings = WorkflowShortcuts.resolve(changes.shortcutSettings.newValue);
  }
});
function isEditing(event) {
  return [document.activeElement, ...event.composedPath()].some(node =>
    node instanceof Element && (node.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName)
      || node.getAttribute('role') === 'textbox'));
}
for (const type of ['keydown', 'keypress', 'keyup']) {
  window.addEventListener(type, event => {
    let shortcut;
    try { shortcut = WorkflowShortcuts.fromEvent(event); } catch { return; }
    if (!shortcut) return;
    const action = WorkflowShortcuts.pageActions.find(a => shortcutSettings.page[a.id] === shortcut);
    if (!action || (action.id === 'vimiumSearch' && isEditing(event))) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (type !== 'keydown' || event.repeat) return;
    if (action.id === 'videoFullscreen') toggleVideoFullscreen();
    else if (action.id === 'pictureInPicture') togglePictureInPicture();
    else if (action.id === 'separateSplitView') chrome.runtime.sendMessage({ type: 'separate-split-view' }).catch(console.error);
    else chrome.runtime.sendMessage('hfjbmagddngcpeloejdejnfgbamkjaeg', {
      handler: 'command', command: 'Vomnibar.activateInNewTab'
    }).catch(() => {});
  }, { capture: true });
}

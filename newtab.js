// Leave Chromium's special New Tab URL before handing off to Vimium C.
(async () => {
  const tab = await chrome.tabs.getCurrent();
  if (location.search !== '?focus') {
    await chrome.tabs.update(tab.id, { url: chrome.runtime.getURL('newtab.html?focus') });
    return;
  }
  const split = tab.splitViewId >= 0;
  document.title = split ? 'Vimium Split New Tab' : 'Vimium New Tab';
  if (split) {
    // A split has an extra focus stop for the original pane. Navigate only
    // after this pane receives focus, so Vimium's input inherits it.
    await new Promise(resolve => {
      const timer = setInterval(() => { if (document.hasFocus()) { clearInterval(timer); resolve(); } }, 50);
    });
  } else {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  // A nonempty, whitespace-only substitution-key list requests URL navigation
  // for tab suggestions without applying substitution rules. Otherwise Vimium
  // switches to the existing tab and leaves the split pane behind.
  const command = split ? 'Vomnibar.activate#itemSedKeys=%20' : 'Vomnibar.activate';
  const result = await chrome.runtime.sendMessage('hfjbmagddngcpeloejdejnfgbamkjaeg', {
    handler: 'command', command: 'openUrl',
    options: { url: 'vimium://blank', reuse: 'current', $then: command }
  });
  if (result === false) throw Error('Allow this extension in Vimium C’s external-command allowlist.');
})().catch(error => {
  const message = document.createElement('p'); message.textContent = error.message;
  document.body.append(message);
});

// Leave Chromium's special New Tab URL before handing off to Vimium C.
(async () => {
  const tab = await chrome.tabs.getCurrent();
  if (location.search !== '?focus') {
    await chrome.tabs.update(tab.id, { url: chrome.runtime.getURL('newtab.html?focus') });
    return;
  }
  const split = tab.splitViewId >= 0;
  if (split) {
    location.replace(chrome.runtime.getURL('split-picker.html'));
    return;
  }
  document.title = 'Vimium New Tab';
  await new Promise(resolve => setTimeout(resolve, 100));
  const result = await chrome.runtime.sendMessage('hfjbmagddngcpeloejdejnfgbamkjaeg', {
    handler: 'command', command: 'openUrl',
    options: { url: 'vimium://blank', reuse: 'current', $then: 'Vomnibar.activate' }
  });
  if (result === false) throw Error('Allow this extension in Vimium C’s external-command allowlist.');
})().catch(error => {
  const message = document.createElement('p'); message.textContent = error.message;
  document.body.append(message);
});

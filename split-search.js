// Hyprland forwards this command immediately before Chromium's native split key.
// Only redirect the new pane created by that explicit request, never other tabs.
function prepareSplitSearch(tab) {
  if (!tab?.active || tab.splitViewId >= 0) return;
  return chrome.storage.session.set({ splitSearchRequest: {
    sourceId: tab.id, windowId: tab.windowId, expires: Date.now() + 2000
  } });
}
chrome.tabs.onCreated.addListener(created => {
  return (async () => {
    const { splitSearchRequest: request } = await chrome.storage.session.get('splitSearchRequest');
    if (!request || request.expires < Date.now() || created.openerTabId !== request.sourceId
        || created.windowId !== request.windowId) return;
    for (let attempt = 0; attempt < 20 && Date.now() < request.expires; attempt++) {
      const [source, pane, window, active] = await Promise.all([
        chrome.tabs.get(request.sourceId).catch(()=>null), chrome.tabs.get(created.id).catch(()=>null),
        chrome.windows.getLastFocused({windowTypes:['normal']}),
        chrome.tabs.query({windowId:request.windowId,active:true})
      ]);
      if (!source || !pane || window.id !== request.windowId
          || !active.some(tab=>tab.id===source.id || tab.id===pane.id)) return;
      if (pane.splitViewId >= 0 && pane.splitViewId === source.splitViewId) {
        await chrome.storage.session.remove('splitSearchRequest');
        // Chromium may leave the original pane selected. Activate the new pane
        // as part of opening its picker, rather than requiring it to be active.
        await chrome.tabs.update(pane.id, {url:chrome.runtime.getURL('split-picker.html'),active:true});
        return;
      }
      await new Promise(resolve=>setTimeout(resolve,50));
    }
  })().catch(console.error);
});

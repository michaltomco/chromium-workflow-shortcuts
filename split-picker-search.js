// Delegate alias expansion to Vimium C itself, keeping its current settings.
const WorkflowSplitSearch = {
  async search(text, tabId) {
    await chrome.tabs.update(tabId, {active:true});
    try {
      const accepted = await chrome.runtime.sendMessage('hfjbmagddngcpeloejdejnfgbamkjaeg', {
        handler:'command', command:'openUrl',
        options:{url:'vimium://search '+text, reuse:'current'}
      });
      if (accepted !== false) return;
    } catch {}
    // The picker also works when Vimium C is absent or has not allowed it.
    await chrome.search.query({text,tabId});
  }
};

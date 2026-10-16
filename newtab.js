// Leave Chromium's special New Tab URL so the compositor sees our title marker.
if (location.search !== "?focus") {
  chrome.tabs.getCurrent().then(tab => chrome.tabs.update(tab.id, {
    url: chrome.runtime.getURL("newtab.html?focus")
  })).catch(console.error);
} else {
  document.title = "Vimium New Tab";
  setTimeout(() => {
    // Vimium must navigate to its own page: cross-extension navigation is blocked.
    chrome.runtime.sendMessage("hfjbmagddngcpeloejdejnfgbamkjaeg", {
      handler: "command", command: "openUrl",
      options: { url: "vimium://blank", reuse: "current", $then: "Vomnibar.activate" }
    }).catch(console.error);
  }, 100);
}

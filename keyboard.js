// Register before page scripts so websites cannot reserve Alt+J/K first.
function groupDirection(event) {
  if (event.metaKey || event.isComposing) return 0;
  if (event.ctrlKey && event.shiftKey && !event.altKey) {
    if (event.code === "Digit9") return 1;
    if (event.code === "Digit8") return -1;
  }
  if (!event.altKey || event.ctrlKey || event.shiftKey) return 0;
  const key = event.key.toLowerCase();
  return key === "j" ? 1 : key === "k" ? -1 : 0;
}

for (const type of ["keydown", "keypress", "keyup"]) {
  window.addEventListener(type, event => {
    if (event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey && !event.isComposing
        && (event.code === "Digit4" || event.code === "Digit5")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (type === "keydown") {
        chrome.runtime.sendMessage({ type: "cycle-tab-section", direction: event.code === "Digit5" ? 1 : -1 }).catch(() => {});
      }
      return;
    }
    // Forward the configured plain-t search before website handlers can claim it.
    // Do this only outside editors;
    // Vimium C explicitly allowlists this extension as an external-command source.
    if (!event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey
        && !event.isComposing && event.key === "t") {
      const editing = [document.activeElement, ...event.composedPath()].some(node =>
        node instanceof Element && (node.isContentEditable
          || /^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName)
          || node.getAttribute("role") === "textbox"));
      if (!editing) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (type === "keydown") {
          chrome.runtime.sendMessage("hfjbmagddngcpeloejdejnfgbamkjaeg", {
            handler: "command", command: "Vomnibar.activateInNewTab"
          }).catch(() => {});
        }
        return;
      }
    }
    if (event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey && !event.isComposing
        && (event.code === "Digit7" || event.code === "Digit6")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (type === "keydown") {
        chrome.runtime.sendMessage({ type: "create-group-tab", inCurrentGroup: event.code === "Digit7" }).catch(() => {});
      }
      return;
    }
    const direction = groupDirection(event);
    if (!direction) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (type === "keydown") {
      chrome.runtime.sendMessage({ type: "cycle-tab-in-group", direction })
        .catch(() => {}); // An old page may outlive an extension reload.
    }
  }, { capture: true });
}

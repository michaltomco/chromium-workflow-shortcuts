// Invoked only by a user-triggered Chrome command, under temporary activeTab access.
async function videoAction(action, css) {
  const documents = [];
  function visit(doc) {
    documents.push(doc);
    for (const frame of doc.querySelectorAll('iframe,frame')) {
      try { if (frame.contentDocument) visit(frame.contentDocument); } catch {}
    }
  }
  visit(document);
  for (const doc of documents) {
    if (action === 'fullscreen' && doc.fullscreenElement) { await doc.exitFullscreen(); return 'closed'; }
    if (action === 'pip' && doc.pictureInPictureElement) { await doc.exitPictureInPicture(); return 'closed'; }
  }
  const video = documents.flatMap(doc => [...doc.querySelectorAll('video')])
    .filter(video => video.readyState >= 2 && video.videoWidth > 0)
    .sort((a,b) => Number(a.paused)-Number(b.paused) || b.clientWidth*b.clientHeight-a.clientWidth*a.clientHeight)[0];
  if (!video) return 'no-video';
  if (action === 'fullscreen') {
    const doc = video.ownerDocument;
    if (!doc.getElementById('workflow-fullscreen-style')) {
      const style = doc.createElement('style'); style.id = 'workflow-fullscreen-style'; style.textContent = css;
      (doc.head || doc.documentElement).append(style);
    }
    await video.requestFullscreen();
  } else {
    video.disablePictureInPicture = false;
    await video.requestPictureInPicture();
  }
  return 'opened';
}
async function runVideoAction(action) {
  const [tab] = await chrome.tabs.query({active:true,lastFocusedWindow:true});
  if (!tab) return;
  try {
    const css = await (await fetch(chrome.runtime.getURL('video-fullscreen.css'))).text();
    const results = await chrome.scripting.executeScript({target:{tabId:tab.id},func:videoAction,args:[action,css]});
    if (results[0]?.result === 'no-video') console.info('No playable video in this page or its same-origin frames.');
  } catch (error) { console.warn('Video action unavailable on this page:', error.message); }
}

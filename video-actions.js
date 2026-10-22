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
    // Include the site's controls in the fullscreen subtree. Plain videos get
    // native controls for the duration of fullscreen instead.
    const player = video.closest('#movie_player, .html5-video-player, .video-js, .plyr, .jwplayer, .shaka-video-container, media-controller');
    const target = player || video;
    const hadControls = video.controls;
    target.classList.add('workflow-video-fullscreen');
    if (!player) video.controls = true;
    function cleanup() {
      target.classList.remove('workflow-video-fullscreen');
      if (!player) video.controls = hadControls;
      doc.removeEventListener('fullscreenchange', changed);
    }
    function changed() { if (doc.fullscreenElement !== target) cleanup(); }
    doc.addEventListener('fullscreenchange', changed);
    try { await target.requestFullscreen(); } catch (error) { cleanup(); throw error; }
  } else {
    video.disablePictureInPicture = false;
    await video.requestPictureInPicture();
  }
  return 'opened';
}
function runVideoAction(action, tab) {
  if (!tab?.id) return;
  chrome.scripting.executeScript({target:{tabId:tab.id},func:videoAction,args:[action,workflowFullscreenStyle]})
    .then(results => {
      if (results[0]?.result === 'no-video') console.info('No playable video in this page or its same-origin frames.');
    }).catch(error => console.warn('Video action unavailable on this page:', error.message));
}

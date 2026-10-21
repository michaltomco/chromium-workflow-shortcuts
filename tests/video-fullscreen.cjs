const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
  let chosen,exits=0,pip=0,styles=0;
  const doc={querySelectorAll:type=>type==='video'?videos:[],fullscreenElement:null,pictureInPictureElement:null,
    exitFullscreen:async()=>{exits++},exitPictureInPicture:async()=>{exits++},
    getElementById:()=>styles>0,createElement:()=>({}),head:{append:()=>{styles++}}};
  const make=(name,paused,width)=>({paused,clientWidth:width,clientHeight:width/2,readyState:4,videoWidth:640,ownerDocument:doc,
    requestFullscreen:async()=>{chosen=name},requestPictureInPicture:async()=>{pip++}});
  let videos=[make('paused',true,1000),make('playing',false,500)];
  const injections=[];
  const c=vm.createContext({document:doc,console,chrome:{scripting:{executeScript:options=>{injections.push(options);return Promise.resolve([{result:'opened'}]);}}}});
  vm.runInContext(fs.readFileSync('fullscreen-style.js','utf8'),c);
  vm.runInContext(fs.readFileSync('video-actions.js','utf8'),c);
  c.runVideoAction('fullscreen',{id:7});
  assert.equal(injections.length,1,'Injection must start synchronously in the command callback');
  assert.equal(injections[0].target.tabId,7);assert(injections[0].args[1].includes('object-fit: contain'));
  assert.equal(await c.videoAction('fullscreen','test-css'),'opened');assert.equal(chosen,'playing');assert.equal(styles,1);
  await c.videoAction('fullscreen','test-css');assert.equal(styles,1);
  doc.fullscreenElement={};assert.equal(await c.videoAction('fullscreen',''),'closed');assert.equal(exits,1);doc.fullscreenElement=null;
  await c.videoAction('pip','');assert.equal(pip,1);doc.pictureInPictureElement={};await c.videoAction('pip','');assert.equal(exits,2);doc.pictureInPictureElement=null;
  videos=[];assert.equal(await c.videoAction('fullscreen',''),'no-video');
  console.log('PASS: video ranking, fullscreen/PiP toggles, contain-style reuse and no-video handling');
})().catch(e=>{console.error(e);process.exitCode=1});

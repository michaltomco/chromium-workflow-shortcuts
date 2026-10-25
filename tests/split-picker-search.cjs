const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
(async()=>{
 const calls=[];let result,fail=false;
 const chrome={tabs:{update:async(...args)=>calls.push(['activate',...args])},runtime:{sendMessage:async(...args)=>{calls.push(['vimium',...args]);if(fail)throw Error('not installed');return result}},search:{query:async options=>calls.push(['browser',options])}};
 const c=vm.createContext({chrome});vm.runInContext(fs.readFileSync('split-picker-search.js','utf8'),c);
 const run=(text,id)=>vm.runInContext(`WorkflowSplitSearch.search(${JSON.stringify(text)},${id})`,c);
 await run('y Grubby',8);
 assert.equal(calls[0][0],'activate');assert.equal(calls[0][1],8);
 assert.equal(calls[1][2].options.url,'vimium://search y Grubby');assert.equal(calls[1][2].options.reuse,'current');assert.equal(calls.length,2);
 calls.length=0;result=false;await run('query',9);assert.equal(calls[2][0],'browser');assert.equal(calls[2][1].tabId,9);
 calls.length=0;fail=true;await run('query',10);assert.equal(calls[2][0],'browser');assert.equal(calls[2][1].text,'query');
 console.log('PASS: Vimium alias delegation in current pane and browser-search fallback when denied or unavailable');
})().catch(e=>{console.error(e);process.exitCode=1});

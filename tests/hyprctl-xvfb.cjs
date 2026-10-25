#!/usr/bin/env node
// Adapter for focus-newtab.sh: read real Xvfb titles and send keys only there.
const {execFileSync}=require('node:child_process');
if(!process.env.SPLIT_TEST_DISPLAY||!process.env.SPLIT_TEST_KEY_HELPER)throw Error('Isolated display required');
const helper=process.env.SPLIT_TEST_KEY_HELPER;
if(process.argv[2]==='activewindow'){
 const title=execFileSync(helper,['--title'],{encoding:'utf8'}).trim();
 console.log(JSON.stringify({address:'test-browser',class:'chromium',title}));
}else if(process.argv[2]==='dispatch'){
 const action=process.argv[3];
 if(!action.includes('key="code:72"'))throw Error('Unexpected test key');
 if(action.includes('state="down"'))execFileSync(helper,['F6']);
}else throw Error('Unexpected test command');

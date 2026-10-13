import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {readFile} from 'node:fs/promises';
const load=async path=>import(`data:text/javascript;base64,${Buffer.from(await readFile(new URL(path,import.meta.url),'utf8')).toString('base64')}`);
const {switchChannel,youtubeAccountClick,clickYoutubeAccount}=await load('../background/youtube.js');
const {validateProfiles}=await load('../validation.js');
const ids=['UC'+'a'.repeat(22),'UC'+'b'.repeat(22)];
test('Studio observed DOM selects unique handles and cleans up on rejection',async()=>{
 let clicks=0,removed=0;
 const row=(handle,selected=false,disabled=false)=>({getClientRects:()=>[{}],click:()=>clicks++,querySelector:selector=>{
  if(selector==='yt-formatted-string[secondary][respect-lang-dir]') return {textContent:handle};
  if(selector==='#selected:not([hidden])') return selected?{}:null;
  if(selector==='[aria-disabled="true"]') return disabled?{}:null;
 }});
 const rows=[row('@current',true),row('@target')];
 const context={location:{hostname:'studio.youtube.com'},setTimeout,clearTimeout,document:{
  createElement:()=>({remove:()=>removed++}),documentElement:{append(){}},
  querySelector:selector=>selector.includes('#avatar-btn')?{}:null,
  querySelectorAll:selector=>selector==='ytd-account-item-renderer'?rows:[]
 }};
 const run=handle=>runInNewContext(`(${youtubeAccountClick.toString()})(${JSON.stringify(handle)},true)`,context);
 assert.equal((await run(null)).handle,'@current');
 assert.equal((await run('@current')).alreadySelected,true);
 assert.equal((await run('@target')).clicked,true);
 rows.push(row('@target'));
 await assert.rejects(run('@target'),/khớp duy nhất/);
 rows.pop();rows[1]=row('@target',false,true);
 await assert.rejects(run('@target'),/khớp duy nhất/);
 assert.equal(clicks,1);assert.equal(removed,5);
 context.location.hostname='www.youtube.com';
 await assert.rejects(run('@target'),/Chỉ tự động/);
});
test('Studio hides menus outside YouTube popup container and closes before removing CSS',async()=>{
 for(const closeThrows of [false,true]) {
  const events=[];
  const style={textContent:'',remove:()=>events.push('remove')};
  const row={getClientRects:()=>[{}],querySelector:selector=>selector==='#selected:not([hidden])'?{}:{textContent:'@current'}};
  const context={location:{hostname:'studio.youtube.com'},setTimeout,clearTimeout,document:{
   createElement:()=>style,documentElement:{append:()=>{
    assert.match(style.textContent,/^tp-yt-iron-dropdown:has\(ytd-multi-page-menu-renderer\), ytd-multi-page-menu-renderer/);
    assert.match(style.textContent,/opacity:0!important/);
    assert.doesNotMatch(style.textContent,/display\s*:/);
    events.push('hide');
   }},
   querySelector:selector=>selector.includes('#avatar-btn')?{}:selector==='tp-yt-iron-dropdown:has(ytd-multi-page-menu-renderer)'?{opened:true,close:()=>{events.push('close');if(closeThrows) throw Error('close failed');}}:null,
   querySelectorAll:selector=>selector==='ytd-account-item-renderer'?[row]:[]
  }};
  const run=()=>runInNewContext(`(${youtubeAccountClick.toString()})(null,true)`,context);
  if(closeThrows) await assert.rejects(run(),/close failed/);
  else assert.equal((await run()).handle,'@current');
  assert.deepEqual(events,['hide','close','remove']);
 }
});
test('Studio channel ID survives profile validation; legacy cookie profiles remain readable',()=>{
 const domain='studio.youtube.com';
 const profile={name:'personal',domain,cookies:[],youtubeChannel:{channelId:ids[0]}};
 const clean=validateProfiles({[domain]:{personal:profile,legacy:{name:'legacy',domain,cookies:[]}}});
 assert.equal(clean[domain].personal.youtubeChannel.channelId,ids[0]);
 assert.equal(clean[domain].legacy.youtubeChannel,undefined);
 assert.throws(()=>validateProfiles({[domain]:{personal:{...profile,youtubeChannel:{channelId:'invalid'}}}}),/channelId/);
});
test('switchChannel navigates current tab to Studio and invokes handle automation',async()=>{
 const calls=[];
 globalThis.chrome={
  tabs:{query:async()=>[{id:4,incognito:false,url:'https://www.youtube.com/'}],update:async(...args)=>{calls.push(['update',...args]);return {id:4};},get:async()=>({id:4,url:'https://studio.youtube.com/',status:'complete'})},
  scripting:{executeScript:async options=>{assert.deepEqual(options.args,['@saved',true]);return [{result:{alreadySelected:true}}];}}
 };
 const result=await switchChannel({domain:'studio.youtube.com',youtubeChannel:{channelId:ids[0],handle:'@saved'}});
 assert.equal(result.success,true);
 assert.deepEqual(calls,[['update',4,{url:'https://studio.youtube.com/'}]]);
});
test('verification waits through loading and transient injection failures before confirming handle',async()=>{
 let reads=0,injections=0;
 globalThis.chrome={tabs:{get:async()=>({url:'https://studio.youtube.com/',status:++reads===2?'loading':'complete'})},
  scripting:{executeScript:async options=>{
   injections++;
   if(injections===1) return [{result:{clicked:true}}];
   assert.deepEqual(options.args,[null,true]);
   if(injections===2) throw Error('Execution context destroyed');
   return [{result:{handle:'@saved'}}];
  }}
 };
 assert.equal((await clickYoutubeAccount(4,'@saved',true)).success,true);
 assert.equal(injections,3);
});
test('verification timeout reports mismatch rather than success',async()=>{
 let now=0,injections=0;
 const verify=runInNewContext(`(${clickYoutubeAccount.toString()})`,{
  Date:{now:()=>now},setTimeout:callback=>{now+=10000;callback();},
  isYoutubeTab:()=>true,youtubeAccountClick,
  readChannelInTab:async()=>({handle:'@other'}),
  chrome:{tabs:{get:async()=>({status:'complete'})},scripting:{executeScript:async()=>{injections++;return [{result:{clicked:true}}];}}}
 });
 await assert.rejects(verify(4,'@saved',true),/Studio.*@other/);
 assert.equal(injections,1);
});
test('YouTube verification waits for loading and pending navigation and retries stale handles',async()=>{
 let now=0,reads=0,injections=0,checks=0;
 const verify=runInNewContext(`(${clickYoutubeAccount.toString()})`,{
  Date:{now:()=>now},setTimeout:callback=>{now+=500;callback();},
  isYoutubeTab:(tab,studio)=>!studio && tab.url==='https://www.youtube.com/',youtubeAccountClick,
  readChannelInTab:async(id,studio)=>{
   assert.equal(id,4);assert.equal(studio,false);
   checks++;
   if(checks===1) throw Error('Execution context destroyed');
   return {handle:checks===2?'@old':'@saved'};
  },
  chrome:{tabs:{get:async()=>{
   reads++;
   return {url:'https://www.youtube.com/',status:reads===2?'loading':'complete',pendingUrl:reads===3?'https://www.youtube.com/':undefined};
  }},scripting:{executeScript:async options=>{
   injections++;assert.deepEqual(Array.from(options.args),['@saved',false]);
   return [{result:{clicked:true}}];
  }}}
 });
 assert.equal((await verify(4,'@saved')).success,true);
 assert.equal(injections,1);assert.equal(checks,3);assert.equal(reads,6);
});
test('YouTube verification reports persistent mismatch and stops when tab closes',async()=>{
 for(const closed of [false,true]) {
  let now=0,reads=0;
  const verify=runInNewContext(`(${clickYoutubeAccount.toString()})`,{
   Date:{now:()=>now},setTimeout:callback=>{now+=10000;callback();},
   isYoutubeTab:()=>true,youtubeAccountClick,
   readChannelInTab:async()=>({handle:'@other'}),
   chrome:{tabs:{get:async()=>{if(++reads>1 && closed) throw Error('closed');return {status:'complete'};}},
    scripting:{executeScript:async()=>[{result:{clicked:true}}]}}
  });
  await assert.rejects(verify(4,'@saved'),closed?/Tab đã bị đóng/:/YouTube.*@other/);
 }
});
test('legacy Studio profile requires handle before navigation',async()=>{
 globalThis.chrome={};
 await assert.rejects(switchChannel({domain:'studio.youtube.com',youtubeChannel:{channelId:ids[0]}}),/thiếu handle/);
});
test('switchChannel refuses non-Studio profiles rather than opening the wrong account',async()=>{
 const calls=[];
 globalThis.chrome={tabs:{query:async()=>[{id:6,incognito:false,url:'https://www.youtube.com/'}],update:async(...args)=>calls.push(args)}};
  await assert.rejects(switchChannel({domain:'youtube.com',youtubeChannel:{channelId:ids[1]}}),/không hợp lệ/);
 assert.deepEqual(calls,[]);
});
test('switchChannel refuses handle-only profiles',async()=>{
 const calls=[];
 globalThis.chrome={tabs:{query:async()=>[{id:6,incognito:false}],update:async(...args)=>calls.push(args)}};
  await assert.rejects(switchChannel({domain:'youtube.com',youtubeChannel:{handle:'@saved'}}),/không hợp lệ/);
 assert.deepEqual(calls,[]);
});

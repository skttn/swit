import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const source=await readFile(new URL('../background/youtube.js',import.meta.url),'utf8');
const {readCurrentChannel}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const ownId='UC'+'a'.repeat(22), otherId='UC'+'b'.repeat(22);
const {prepareYoutubeTab}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
test('tab preparation uses the active YouTube tab without navigation',async()=>{
 const youtube={id:2,url:'https://www.youtube.com/',status:'complete',active:true};
 globalThis.chrome={tabs:{query:async options=>{assert.deepEqual(options,{active:true,currentWindow:true});return [youtube];},get:async id=>({...youtube,id})}};
 assert.equal((await prepareYoutubeTab()).id,2);
});
test('tab preparation navigates the current tab instead of finding or creating another tab',async()=>{
 const loaded={id:3,url:'https://www.youtube.com/',status:'complete'};
 const calls=[];
 for(const url of ['https://studio.youtube.com/','https://youtube.com.example.org/','chrome://newtab/']) {
  let reads=0;
  globalThis.chrome={tabs:{query:async options=>{assert.deepEqual(options,{active:true,currentWindow:true});return [{id:3,url,active:true}];},
   update:async(id,options)=>{calls.push([id,options]);return {...loaded,url};},
   get:async()=>++reads===1?{...loaded,url,pendingUrl:'https://www.youtube.com/'}:loaded}};
  assert.equal((await prepareYoutubeTab()).id,3);
  assert.equal(reads,2);
 }
 assert.deepEqual(calls,Array.from({length:3},()=>[3,{url:'https://www.youtube.com/'}]));
});
test('tab preparation waits for load, supports incognito and rejects closed or redirected tabs',async()=>{
 const tab={id:2,url:'https://www.youtube.com/',status:'complete',active:true};
 let reads=0;
 globalThis.chrome={tabs:{query:async()=>[tab],get:async()=>({...tab,status:++reads===1?'loading':'complete'})}};
 await prepareYoutubeTab();
 assert.equal(reads,2);
 globalThis.chrome.tabs.get=async()=>({...tab,url:'https://accounts.google.com/'});
 await assert.rejects(prepareYoutubeTab(),/rời YouTube/);
 globalThis.chrome.tabs.get=async()=>{throw Error('closed');};
 await assert.rejects(prepareYoutubeTab(),/bị đóng/);
 tab.incognito=true;
 globalThis.chrome.tabs.get=async()=>({...tab});
 assert.equal((await prepareYoutubeTab()).incognito,true);
 globalThis.chrome.tabs.query=async()=>[];
 await assert.rejects(prepareYoutubeTab(),/tab phù hợp/);
});
function readChannel(config,pathname='/',hostname='www.youtube.com') {
 return runInNewContext(`(${readCurrentChannel.toString()})()`,{
  ytcfg:config,
  location:{hostname,pathname,href:`https://${hostname}${pathname}`},
  document:{documentElement:{innerHTML:`"channelId":"${otherId}"`},querySelectorAll:()=>[{href:'https://www.youtube.com/@other'}]}
 });
}
test('homepage saves only the current account channel ID from live configuration',()=>{
 const result=readChannel({get:key=>({CHANNEL_ID:ownId,LOGGED_IN:true})[key]});
 assert.equal(result.channelId,ownId);
 assert.deepEqual(Object.keys(result),['channelId']);
});
test('viewed channel and video metadata never override account identity',()=>{
 for(const path of [`/channel/${otherId}`,'/@other','/watch?v=example']) {
  assert.equal(readChannel({data_:{CHANNEL_ID:ownId}},path).channelId,ownId);
  assert.equal(readChannel(undefined,path).channelId,null);
 }
});
test('missing, invalid, signed-out and inaccessible configuration fail safely',()=>{
 for(const config of [undefined,{}, {data_:{CHANNEL_ID:'invalid'}}, {data_:{CHANNEL_ID:123}}, {data_:{CHANNEL_ID:ownId,LOGGED_IN:false}}, {get(){throw Error('unavailable');}}]) {
  assert.equal(readChannel(config).channelId,null);
 }
 assert.equal(readChannel({data_:{CHANNEL_ID:ownId}},'/','example.com').channelId,null);
 assert.equal(readChannel({data_:{CHANNEL_ID:ownId}},'/','youtube.com').channelId,ownId);
});
test('YouTube saves account identity and routes switching to YouTube automation',async()=>{
 const background=await readFile(new URL('../background/background.js',import.meta.url),'utf8');
 const popup=await readFile(new URL('../popup/local.js',import.meta.url),'utf8');
 assert.match(popup,/\['studio.youtube.com','youtube.com','www.youtube.com'\].includes\(domain\)\?'saveYoutubeChannel':'saveProfile'/);
 assert.doesNotMatch(background,/func:readCurrentChannel/);
  assert.match(background,/clickYoutubeAccount/);
  assert.match(background,/readChannelInTab/);
 assert.match(background,/cookies:current/);
});
test('automation rejects Studio and unrelated hosts before touching the DOM',async()=>{
 const {youtubeAccountClick}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
 for(const hostname of ['studio.youtube.com','example.com','youtube.com.example.com']) {
  await assert.rejects(runInNewContext(`(${youtubeAccountClick.toString()})('${ownId}')`,{location:{hostname}}),/Chỉ tự động/);
 }
});
test('automation never selects public channel links and always removes its hiding style',()=>{
 assert.doesNotMatch(source,/href\?\.includes/);
 assert.match(source,/ytd-account-item-renderer/);
 assert.match(source,/finally/);
 assert.match(source,/clearTimeout\(cleanup\); style.remove\(\)/);
});
test('ready account menu has no fixed delay and slow menu uses bounded backoff',async()=>{
 const {youtubeAccountClick}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
 for(const slow of [false,true]) {
  let opened=false,elapsed=0,removed=0;
  const delays=[];
  const row={data:{channelHandle:{simpleText:'@current'},isSelected:true},getClientRects:()=>[{}]};
  const link={innerText:'Switch account',getClientRects:()=>[{}],click:()=>{opened=true;}};
  const result=await runInNewContext(`(${youtubeAccountClick.toString()})()`,{
   location:{hostname:'www.youtube.com'},
   setTimeout:(callback,ms)=>{if(ms!==12000) {delays.push(ms);elapsed+=ms;callback();}return 1;},clearTimeout(){},
   document:{createElement:()=>({remove:()=>removed++}),documentElement:{append(){}},
    querySelector:selector=>selector==='#avatar-btn'?{}:null,
    querySelectorAll:selector=>selector==='ytd-account-item-renderer'?(opened && (!slow || elapsed>=750)?[row]:[]):[link]}
  });
  assert.equal(result.handle,'@current');
  assert.deepEqual(delays,slow?[50,100,200,400]:[]);
  assert.equal(removed,1);
 }
});
test('observed menu data saves selected handle and clicks only a unique matching account',async()=>{
 const {youtubeAccountClick}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
 let clicks=0,removed=0,closed=0;
 const item=(handle,isSelected=false)=>({data:{channelHandle:{simpleText:handle},isSelected},getClientRects:()=>[{}],click:()=>clicks++});
 const items=[item('@current',true),item('@target')];
 const context={location:{hostname:'www.youtube.com'},setTimeout,clearTimeout,document:{
  createElement:()=>({remove:()=>removed++}),documentElement:{append(){}},
  querySelector:selector=>selector==='#avatar-btn'?{}:{opened:true,close:()=>closed++},
  querySelectorAll:selector=>selector==='ytd-account-item-renderer'?items:[]
 }};
 const run=handle=>runInNewContext(`(${youtubeAccountClick.toString()})(${JSON.stringify(handle)})`,context);
 assert.equal((await run(null)).handle,'@current');
 assert.equal(clicks,0);
 assert.equal((await run('@current')).alreadySelected,true);
 assert.equal((await run('@target')).clicked,true);
 assert.equal(clicks,1);
 items.push(item('@target'));
 await assert.rejects(run('@target'),/khớp duy nhất/);
 assert.equal(clicks,1);
 items[0].data.isSelected=false;
 await assert.rejects(run(null),/handle duy nhất/);
 assert.equal(removed,5);
 assert.equal(closed,5);
});

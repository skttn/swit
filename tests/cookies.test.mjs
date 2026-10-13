import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../background/cookies.js',import.meta.url),'utf8');
const {checkTarget,clear,restore}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const cookie={name:'SID',value:'test-secret',domain:'.google.com',path:'/',secure:true,httpOnly:true,hostOnly:false,sameSite:'no_restriction'};
function mock() {
 const state={jar:[],calls:[]};
 globalThis.chrome={cookies:{
  async set(item) {
   state.calls.push(item);
   const result={...item,domain:item.domain||new URL(item.url).hostname,hostOnly:!item.domain,sameSite:item.sameSite||'unspecified'};
   state.jar.push(result); return result;
  },
  async getAll() {return state.jar;},
  async remove() {state.jar=[]; return {};}
 }};
 return state;
}
test('Google and Facebook domain cookies preserve scope and SameSite',async()=>{
 const state=mock();
 const facebook={...cookie,name:'xs',domain:'.facebook.com',secure:false,sameSite:'lax'};
 assert.equal(await restore([cookie,facebook],'0'),2);
 assert.equal(state.calls[0].domain,'.google.com');
 assert.equal(state.calls[1].domain,'.facebook.com');
 assert.equal(state.calls[1].secure,false);
 assert.equal(state.calls[1].url,'https://facebook.com/');
});
test('host-only cookie omits domain and retains path',async()=>{
 const state=mock();
 await restore([{...cookie,name:'__Host-GAPS',domain:'accounts.google.com',hostOnly:true,sameSite:'unspecified'}],'0');
 assert.equal(Object.hasOwn(state.calls[0],'domain'),false);
 assert.equal(Object.hasOwn(state.calls[0],'sameSite'),false);
 assert.equal(state.calls[0].url,'https://accounts.google.com/');
});
test('rejections and null writes fail without unsafe retries or leaking values',async()=>{
 for(const mode of ['reject','null']) {
  mock(); let calls=0;
  chrome.cookies.set=async()=>{calls++; if(mode==='reject') throw Error(cookie.value); return null;};
  await assert.rejects(restore([cookie],'0'),error=>error.message.includes('SID') && !error.message.includes(cookie.value));
  assert.equal(calls,1);
 }
});
test('readback detects missing cookies and altered scope',async()=>{
 for(const jar of [[],[{...cookie,hostOnly:true}]]) {
  mock(); chrome.cookies.set=async()=>cookie; chrome.cookies.getAll=async()=>jar;
  await assert.rejects(restore([cookie],'0'),/Kiểm tra/);
 }
});
test('readback retries transient cookie propagation before failing',async()=>{
 const state=mock(); let reads=0;
 chrome.cookies.set=async item=>item;
 chrome.cookies.getAll=async()=>++reads<3?[]:[cookie];
 assert.equal(await restore([cookie],'0'),1);
 assert.equal(reads,3);
});
test('readback identifies mismatched attributes without exposing values',async()=>{
 mock(); chrome.cookies.set=async item=>item;
 chrome.cookies.getAll=async()=>[{...cookie,sameSite:'lax'}];
 await assert.rejects(restore([cookie],'0'),error=>error.message.includes('lệch sameSite')&&!error.message.includes(cookie.value));
});
test('readback distinguishes host-only and domain cookies with the same key',async()=>{
 mock(); let writes=0;
 const hostOnly={...cookie,domain:'vnedu.vn',hostOnly:true};
 chrome.cookies.set=async item=>{writes++;return item;};
 chrome.cookies.getAll=async()=>[{...cookie,hostOnly:false},{...hostOnly}];
 assert.equal(await restore([hostOnly],'0'),1);
 assert.equal(writes,1);
});
test('clear detects removal rejection and cookies left behind',async()=>{
 const state=mock(); state.jar=[cookie];
 chrome.cookies.remove=async()=>null;
 await assert.rejects(clear([cookie],'0'),/vẫn còn/);
 chrome.cookies.remove=async()=>{throw Error(cookie.value);};
 await assert.rejects(clear([cookie],'0'),error=>!error.message.includes(cookie.value));
});
test('empty and expired targets are rejected before mutation',()=>{
 mock();
 assert.throws(()=>checkTarget([]),/không có cookie/);
 assert.throws(()=>checkTarget([{...cookie,expirationDate:1}]),/hết hạn/);
 assert.doesNotThrow(()=>checkTarget([cookie]));
});
test('a failed restore permits clearing partial writes and restoring previous cookies',async()=>{
 const state=mock();
 const previous={...cookie,name:'previous'};
 state.jar=[previous];
 await clear([previous],'0');
 const set=chrome.cookies.set;
 chrome.cookies.set=async item=>item.name==='fail'?null:set(item);
 await assert.rejects(restore([cookie,{...cookie,name:'fail'}],'0'));
 await clear(state.jar,'0');
 await restore([previous],'0');
 assert.deepEqual(state.jar.map(c=>c.name),['previous']);
});
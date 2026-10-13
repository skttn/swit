import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../background/background.js',import.meta.url),'utf8');
const load=async path=>import(`data:text/javascript;base64,${Buffer.from(await readFile(new URL(path,import.meta.url),'utf8')).toString('base64')}`);
const validation=await load('../validation.js');
const cookieModule=await load('../background/cookies.js');
const host='school.vnedu.vn';
const cookie={name:'session',value:'saved',domain:host,path:'/',secure:true,httpOnly:true,hostOnly:true,sameSite:'lax'};
function setup(incognito,same=false) {
 const tab={id:incognito?20:10,incognito,url:`https://${host}/v5/`};
 const storeId=incognito?'private-store':'regular-store';
 const other=incognito?'regular-store':'private-store';
 const jars={ [storeId]:[{...cookie,value:same?'saved':'current'}], [other]:[{...cookie,value:'untouched'}] };
 const calls=[];
 let queries=0;
 const chrome={
  storage:{local:{setAccessLevel:async()=>{}}},
  commands:{onCommand:{addListener(){}}},
  runtime:{onMessage:{addListener(){}}},
  permissions:{contains:async()=>true},
  tabs:{query:async()=>{queries++;return queries===1?[tab]:[{id:999,url:'https://example.org/'}];},reload:async id=>calls.push(['reload',id]),update:async(id,options)=>calls.push(['update',id,options])},
  cookies:{
   getAllCookieStores:async()=>[{id:'regular-store',tabIds:[10]},{id:'private-store',tabIds:[20]}],
   getAll:async({storeId})=>{calls.push(['get',storeId]);return jars[storeId];},
   remove:async({storeId})=>{calls.push(['remove',storeId]);jars[storeId]=[];},
   set:async item=>{calls.push(['set',item.storeId]);const restored={...cookie,value:item.value};jars[item.storeId].push(restored);return restored;}
  }
 };
 globalThis.chrome=chrome;
 const context=vm.createContext({chrome,URL,...validation,...cookieModule});
 vm.runInContext(source.replace(/^import .*;\r?\n/gm,''),context);
 return {context,chrome,jars,storeId,other,tab,calls};
}
test('manifest permits user opt-in to InPrivate with a shared background queue',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../manifest.json',import.meta.url),'utf8'));
 assert.equal(manifest.incognito,'spanning');
});
for(const incognito of [false,true]) {
 test(`switch uses only the ${incognito?'private':'regular'} cookie store and original tab`,async()=>{
  const state=setup(incognito);
  const result=await state.context.doSwitch(host,'A',{[host]:{A:{cookies:[cookie]}}});
  assert.equal(result.success,true);
  assert.equal(state.jars[state.storeId][0].value,'saved');
  assert.equal(state.jars[state.other][0].value,'untouched');
  assert.ok(state.calls.filter(([kind])=>kind!=='reload').every(([,id])=>id===state.storeId));
  assert.deepEqual(state.calls.at(-1),['reload',state.tab.id]);
 });
}
test('matching InPrivate cookies reload the private tab without writes',async()=>{
 const state=setup(true,true);
 await state.context.doSwitch(host,'A',{[host]:{A:{cookies:[cookie]}}});
 assert.deepEqual(state.calls,[['get',state.storeId],['reload',state.tab.id]]);
});
test('private save reads private cookies and unknown cookie store fails closed',async()=>{
 const state=setup(true);
 const site=await state.context.activeSite(host);
 assert.equal(site.storeId,state.storeId);
 const cookies=await state.context.currentCookies(host,site.storeId);
 assert.equal(cookies[0].value,'current');
 state.chrome.tabs.query=async()=>[state.tab];
 state.chrome.cookies.getAllCookieStores=async()=>[{id:state.other,tabIds:[10]}];
 await assert.rejects(state.context.activeSite(host),/cookie store/);
 assert.ok(!state.calls.some(([kind])=>['set','remove'].includes(kind)));
});
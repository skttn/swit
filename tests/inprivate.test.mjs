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
  const tab={id:incognito?20:10,windowId:7,incognito,url:`https://${host}/v5/`};
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
   tabs:{query:async()=>{queries++;return queries===1?[tab]:[{id:999,url:'https://example.org/'}];},reload:async id=>calls.push(['reload',id]),update:async(id,options)=>calls.push(['update',id,options]),create:async options=>{calls.push(['create',options]);return {id:30,...options};},remove:async id=>calls.push(['removeTab',id])},
  cookies:{
   getAllCookieStores:async()=>[{id:'regular-store',tabIds:[10]},{id:'private-store',tabIds:[20]}],
   getAll:async({storeId})=>{calls.push(['get',storeId]);return jars[storeId];},
   remove:async({storeId})=>{calls.push(['remove',storeId]);jars[storeId]=[];},
   set:async item=>{calls.push(['set',item.storeId]);const restored={...cookie,value:item.value};jars[item.storeId].push(restored);return restored;}
  }
 };
 globalThis.chrome=chrome;
 chrome.tabs.get=async id=>({id,url:'about:blank',status:'complete'});
 const context=vm.createContext({chrome,URL,setTimeout,...validation,...cookieModule});
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
  assert.ok(state.calls.filter(([kind])=>['get','set','remove'].includes(kind)).every(([,id])=>id===state.storeId));
  assert.equal(state.calls.at(-1)[0],'update');
  assert.equal(state.calls.at(-1)[1],state.tab.id);
  assert.equal(state.calls.at(-1)[2].url,`https://${host}/`);
 });
}
test('matching InPrivate cookies reload the private tab without writes',async()=>{
 const state=setup(true,true);
 state.tab.url=`https://${host}/`;
 await state.context.doSwitch(host,'A',{[host]:{A:{cookies:[cookie]}}});
 assert.deepEqual(state.calls,[['get',state.storeId],['reload',state.tab.id]]);
});
test('login path navigates to the saved domain root after switching',async()=>{
  const state=setup(false);
  state.tab.url=`https://${host}/Login.aspx?dv=C3`;
  await state.context.doSwitch(host,'A',{[host]:{A:{cookies:[cookie]}}});
  const navigation=state.calls.at(-1);
  assert.equal(navigation[0],'update');
  assert.equal(navigation[1],state.tab.id);
  assert.equal(navigation[2].url,`https://${host}/`);
  assert.equal(state.jars[state.storeId][0].value,'saved');
  assert.ok(!state.calls.some(([kind])=>kind==='create'));
});
test('non-web active tab reuses an existing website tab without creating a tab',async()=>{
  const state=setup(false);
  state.tab.url='chrome://newtab/';
  const result=await state.context.doSwitch(host,'A',{[host]:{A:{cookies:[cookie]}}});
  assert.equal(result.success,true);
  const navigation=state.calls.at(-1);
  assert.equal(navigation[0],'update');
  assert.equal(navigation[1],state.tab.id);
  assert.equal(navigation[2].url,`https://${host}/`);
  assert.ok(!state.calls.some(([kind])=>kind==='create'));
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
for(const incognito of [false,true]) {
 test(`mixed-expiry switch skips expired cookies in ${incognito?'private':'regular'} store`,async()=>{
  const state=setup(incognito);
  const cookies=[cookie,{...cookie,name:'expired',expirationDate:1}];
  const result=await state.context.doSwitch(host,'A',{[host]:{A:{cookies}}});
  assert.equal(result.success,true);
  assert.match(result.message,/1\/2 cookie hết hạn/);
  assert.equal(state.calls.filter(([kind])=>kind==='set').length,1);
  assert.equal(state.jars[state.other][0].value,'untouched');
  assert.equal(cookies.length,2);
 });
}
test('all-expired switch leaves the current session and tab untouched',async()=>{
 const state=setup(false);
 await assert.rejects(state.context.doSwitch(host,'A',{[host]:{A:{cookies:[{...cookie,expirationDate:1}]}}}),/Tất cả cookie/);
 assert.deepEqual(state.calls,[]);
 assert.equal(state.jars[state.storeId][0].value,'current');
});
test('matching session still reports skipped expired cookies without writes',async()=>{
 const state=setup(true,true);
 state.tab.url=`https://${host}/`;
 const result=await state.context.doSwitch(host,'A',{[host]:{A:{cookies:[cookie,{...cookie,name:'expired',expirationDate:1}]}}});
 assert.match(result.message,/1\/2 cookie hết hạn/);
 assert.deepEqual(state.calls,[['get',state.storeId],['reload',state.tab.id]]);
});
for(const incognito of [false,true]) {
 test(`SSO switches the original tab through blank to saved URL (private=${incognito})`,async()=>{
  const state=setup(incognito);
  state.tab.url='https://user.vnedu.vn/sso/?app_id=3&continue=http%3A%2F%2Fother.vnedu.vn';
  const targetUrl=`https://${host}/v5/`;
  await state.context.doSwitch(host,'A',{[host]:{A:{cookies:[cookie],targetUrl}}});
  const navigation=state.calls.filter(([kind])=>kind==='update');
  assert.equal(navigation.length,2);
  assert.equal(navigation[0][2].url,'about:blank');
  assert.equal(navigation[1][2].url,targetUrl);
  assert.ok(navigation.every(([,id])=>id===state.tab.id));
  assert.ok(state.calls.findIndex(([kind])=>kind==='remove')>state.calls.findIndex(([kind])=>kind==='update'));
  assert.ok(!state.calls.some(([kind])=>kind==='create'));
 });
}
test('failed intermediate navigation leaves cookies unchanged',async()=>{
 const state=setup(false);
 state.chrome.tabs.update=async()=>{throw Error('blocked');};
 await assert.rejects(state.context.doSwitch(host,'A',{[host]:{A:{cookies:[cookie]}}}),/blocked/);
 assert.equal(state.jars[state.storeId][0].value,'current');
 assert.ok(!state.calls.some(([kind])=>['remove','set'].includes(kind)));
});
test('failed restore rolls back cookies and returns to previous website',async()=>{
 const state=setup(false);
 const set=state.chrome.cookies.set;
 state.chrome.cookies.set=async item=>item.value==='saved'?null:set(item);
 await assert.rejects(state.context.doSwitch(host,'A',{[host]:{A:{cookies:[cookie]}}}),/Đã ghi lại/);
 assert.equal(state.jars[state.storeId][0].value,'current');
 assert.equal(state.calls.at(-1)[2].url,state.tab.url);
});
test('save retains the current URL and validation preserves it across storage',async()=>{
 const state=setup(false);
 let saved;
 state.context.loadProfiles=async()=>({});
 state.context.saveProfiles=async profiles=>{saved=validation.validateProfiles(profiles);};
 await state.context.handle({action:'saveProfile',domain:host,name:'A'});
 assert.equal(saved[host].A.targetUrl,`https://${host}/v5/`);
});
test('destination validation rejects foreign hosts, credentials and non-web schemes',()=>{
 for(const targetUrl of ['https://other.vnedu.vn/','javascript:alert(1)',`https://user:pass@${host}/`]) {
  assert.throws(()=>validation.validTargetUrl(targetUrl,host));
 }
 assert.equal(validation.validTargetUrl(`https://${host}/v5/`,host),`https://${host}/v5/`);
});
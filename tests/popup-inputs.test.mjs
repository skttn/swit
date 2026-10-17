import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const source=await readFile(new URL('../popup/local.js',import.meta.url),'utf8');
const html=await readFile(new URL('../popup/local.html',import.meta.url),'utf8');
test('popup forms and editable fields disable browser autocomplete',()=>{
 const forms=html.match(/<form\b[^>]*>/g)||[];
 const inputs=(html.match(/<input\b[^>]*>/g)||[]).filter(tag=>!tag.includes('type="file"'));
 assert.equal(forms.length,3);
 assert.equal(inputs.length,6);
 for(const tag of [...forms,...inputs]) assert.match(tag,/\bautocomplete="off"/);
});
test('backup password fields remain masked',()=>{
 for(const id of ['password','passwordConfirm','import-password']) {
  const tag=(html.match(/<input\b[^>]*>/g)||[]).find(tag=>tag.includes(`id="${id}"`));
  assert.match(tag,/\btype="password"/);
 }
});
test('rename saves directly without an extra confirmation and ignores cancelled or unchanged names',async()=>{
 const body=source.match(/const rename=button\('',async\(\)=>\{([\s\S]*?)\n\s*\}\);/)[1];
 for(const next of ['New name',null,'','Old name']) {
  const calls=[];
  const profileOrder={accounts:{}};
  await runInNewContext(`(async()=>{${body}})()`,{
   name:'Old name',host:'example.org',items:{},profileOrder,
   renameAction:async()=>next,
   confirmAction:()=>{throw Error('Rename must not ask for extra confirmation');},
   send:async(action,data)=>calls.push([action,data.newName]),
   orderedNames:()=>['Old name'],
   refresh:async()=>calls.push(['refresh']),
   saveProfileOrder:async()=>calls.push(['order'])
  });
  assert.deepEqual(calls,next==='New name'?[['renameProfile','New name'],['refresh'],['order']]:[]);
  if(next==='New name') assert.deepEqual(profileOrder.accounts['example.org'],['New name']);
 }
});
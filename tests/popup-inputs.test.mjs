import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
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
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const moduleURL=source=>`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const validation=moduleURL(await readFile(new URL('../validation.js',import.meta.url),'utf8'));
const storage=moduleURL((await readFile(new URL('../local-storage.js',import.meta.url),'utf8')).replace('./validation.js',validation));
const source=(await readFile(new URL('../backup.js',import.meta.url),'utf8')).replace('./local-storage.js',storage).replace('./validation.js',validation);
const {encryptBackup,decryptBackup}=await import(moduleURL(source));
const password='switcher-test-password';
const profiles={'example.com':{Demo:{name:'Demo',domain:'example.com',cookies:[],isFavorite:false,timestamp:1}}};
test('Switcher backup exports the new format and restores profiles',async()=>{
 const envelope=await encryptBackup(profiles,password);
 assert.equal(envelope.format,'Switcher-encrypted');
 assert.deepEqual(await decryptBackup(envelope,password),profiles);
 await assert.rejects(decryptBackup(envelope,'incorrect-password'),/Mật khẩu sai/);
});
test('backup rejects other format names before decryption',async()=>{
  for(const format of ['Other-encrypted','Legacy-encrypted','legacy-encrypted','',undefined]) {
   await assert.rejects(decryptBackup({format,version:1,iterations:600000},password),/Chỉ nhận sao lưu Switcher/);
 }
});
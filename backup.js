import {encode,decode} from './local-storage.js';
import {MAX_BYTES,validateProfiles} from './validation.js';
const iterations=600000;
async function derive(password,salt) {
  if(typeof password!=='string' || password.length<8 || password.length>256) throw Error('Mật khẩu sao lưu phải dài 8–256 ký tự.');
 const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function encryptBackup(profiles,password) {
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
 const plain=new TextEncoder().encode(JSON.stringify(validateProfiles(profiles)));
 if(plain.length>MAX_BYTES) throw Error('Sao lưu quá 5 MB.');
 const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},await derive(password,salt),plain);
  return {format:'Switcher-encrypted',version:1,iterations,salt:encode(salt),iv:encode(iv),data:encode(new Uint8Array(encrypted))};
}
export async function decryptBackup(envelope,password) {
  if(!envelope || JSON.stringify(envelope).length>8*1024*1024 || envelope.format!=='Switcher-encrypted' || envelope.version!==1 || envelope.iterations!==iterations) throw Error('Chỉ nhận sao lưu Switcher mã hóa phiên bản 1, tối đa 8 MB.');
 const salt=decode(envelope.salt),iv=decode(envelope.iv),data=decode(envelope.data);
 if(salt.length!==16 || iv.length!==12 || data.length>MAX_BYTES+16 || data.length<16) throw Error('Sao lưu không hợp lệ.');
 const derived=await derive(password,salt);
 try {return validateProfiles(JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv},derived,data))));}
 catch {throw Error('Mật khẩu sai hoặc sao lưu bị hỏng/không hợp lệ.');}
}
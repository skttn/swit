import {validateProfiles} from './validation.js';
export function encode(bytes) {
 let text=''; for(const byte of bytes) text+=String.fromCharCode(byte); return btoa(text);
}
export function decode(text) {
 if(typeof text!=='string' || text.length>12000000) throw Error('Dữ liệu mã hóa không hợp lệ.');
 return Uint8Array.from(atob(text),c=>c.charCodeAt(0));
}
async function key(raw) {
 return crypto.subtle.importKey('raw',decode(raw),{name:'AES-GCM'},false,['encrypt','decrypt']);
}
export async function loadProfiles() {
 const stored=await chrome.storage.local.get(['profiles','securityKey']);
 if(stored.profiles===undefined) return {};
 try {
  if(!stored.securityKey || typeof stored.profiles!=='string') throw Error();
  const bytes=decode(stored.profiles);
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(0,12)},await key(stored.securityKey),bytes.slice(12));
  return validateProfiles(JSON.parse(new TextDecoder().decode(plain)));
 } catch { throw Error('Profile bị lỗi, không tương thích hoặc thiếu khóa. Không ghi đè dữ liệu; hãy giữ bản sao hồ sơ Edge để khôi phục.'); }
}
export async function saveProfiles(profiles) {
 const clean=validateProfiles(profiles);
 await loadProfiles();
 const stored=await chrome.storage.local.get('securityKey');
 const securityKey=stored.securityKey || encode(crypto.getRandomValues(new Uint8Array(32)));
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(securityKey),new TextEncoder().encode(JSON.stringify(clean))));
 const bytes=new Uint8Array(12+encrypted.length); bytes.set(iv); bytes.set(encrypted,12);
 await chrome.storage.local.set({profiles:encode(bytes),securityKey});
}
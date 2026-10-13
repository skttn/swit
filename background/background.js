import {loadProfiles,saveProfiles} from '../local-storage.js';
import {validateProfiles,validateCookies,validHost,validName} from '../validation.js';
import {encryptBackup,decryptBackup} from '../backup.js';
import {checkTarget,clear,restore} from './cookies.js';
import {switchChannel,readChannelInTab,clickYoutubeAccount,prepareYoutubeTab} from './youtube.js';
const ready=chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
let queue=Promise.resolve();
chrome.commands.onCommand.addListener(command=>{
  if(command!=='open_switcher_popup' || typeof chrome.action?.openPopup!=='function') return;
 chrome.action.openPopup().catch(()=>{});
});
async function activeSite(host,requireMatchingSite=true) {
 validHost(host);
 const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
 if(!tab || tab.incognito) throw Error('Không có tab thường phù hợp.');
 const url=tab.url?new URL(tab.url):null;
 const matches=!!url && ['http:','https:'].includes(url.protocol) && url.hostname===host;
 if(requireMatchingSite && !matches) throw Error('Hãy mở đúng website trước khi thao tác.');
 if(!await chrome.permissions.contains({origins:[`http://${host}/*`,`https://${host}/*`]})) throw Error('Cần cấp quyền truy cập website trước khi thao tác.');
 const stores=await chrome.cookies.getAllCookieStores();
 const store=stores.find(s=>s.tabIds.includes(tab.id));
 if(!store) throw Error('Không xác định được cookie store.');
 return {tab:url && ['http:','https:'].includes(url.protocol)?tab:null,storeId:store.id};
}
async function currentCookies(host,storeId) {
  const parts=host.split('.');
  const scope=parts.length>=2?parts.slice(-2).join('.'):host;
 const all=await chrome.cookies.getAll({storeId});
 const scoped=all.filter(c=>{
  if(c.partitionKey) return false;
  const domain=c.domain?.replace(/^\./,'');
   return typeof domain==='string' && (domain===scope || domain.endsWith('.'+scope));
 });
  return validateCookies(scoped.filter(c=>!c.partitionKey),host);
}
function summary(profiles) {
 const result={};
 for(const [host,items] of Object.entries(profiles)) {
  result[host]={}; for(const [name,p] of Object.entries(items)) result[host][name]={name,isFavorite:p.isFavorite,timestamp:p.timestamp,youtubeChannel:p.youtubeChannel||null};
 }
 return result;
}
async function doSwitch(domain,name,profiles) {
 if(['youtube.com','www.youtube.com'].includes(domain) && !profiles[domain][name].youtubeChannel?.handle) throw Error('Profile YouTube thiếu handle. Hãy lưu lại đúng tài khoản và xác nhận ghi đè.');
  if(profiles[domain][name].youtubeChannel) {
    if(domain==='studio.youtube.com') return switchChannel(profiles[domain][name]);
   if(!['youtube.com','www.youtube.com'].includes(domain)) throw Error('Profile YouTube không hợp lệ.');
   const handle=profiles[domain][name].youtubeChannel.handle;
   const tab=await prepareYoutubeTab();
   return clickYoutubeAccount(tab.id,handle);
  }
  const target=validateCookies(profiles[domain][name].cookies,domain);
 checkTarget(target);
 const {storeId}=await activeSite(domain,false);
 const current=await currentCookies(domain,storeId);
 const norm = d => d.replace(/^\./,'');
 const same=current.length===target.length && target.every(t=>current.some(c=>c.name===t.name && c.value===t.value && norm(c.domain)===norm(t.domain) && c.path===t.path));
 if(same){
  const [active]=await chrome.tabs.query({active:true,currentWindow:true});
  if(active && !active.incognito){
   let h=''; try{ if(active.url) h=new URL(active.url).hostname; }catch{}
   if(h===domain) await chrome.tabs.reload(active.id);
   else await chrome.tabs.update(active.id,{url:`https://${domain}/`});
  }
  return {success:true,message:'Phiên hiện tại đã khớp, đã mở '+domain+'.'};
 }
 try {await clear(current,storeId); await restore(target,storeId);}
 catch(error) {
  try {await clear(await currentCookies(domain,storeId),storeId); await restore(current,storeId);}
  catch {throw Error(`${error.message} Khôi phục phiên trước cũng thất bại. Có thể cần đăng nhập lại.`);}
  throw Error(`${error.message} Đã ghi lại và kiểm tra cookie của phiên trước.`);
 }
 const [active]=await chrome.tabs.query({active:true,currentWindow:true});
 if(active && !active.incognito) {
  let host='';
  try { if(active.url) host=new URL(active.url).hostname; } catch {}
  if(host===domain) await chrome.tabs.reload(active.id);
  else await chrome.tabs.update(active.id,{url:`https://${domain}/`});
 }
 return {success:true,message:`Đã khôi phục ${target.length} cookie. Website vẫn quyết định phiên còn hiệu lực hay không.`};
}
async function handle(message) {
 await ready;
 const {action,domain,name}=message;
 const profiles=await loadProfiles();
 if(action==='getProfiles') return summary(profiles);
 if(action==='exportBackup') return encryptBackup(profiles,message.password);
 if(action==='importBackup') {
  const imported=validateProfiles(await decryptBackup(message.data,message.password));
  for(const [host,items] of Object.entries(imported)) profiles[host]={...profiles[host],...items};
  await saveProfiles(profiles); return {success:true};
 }
 if(!['saveProfile','saveYoutubeChannel','switchProfile','clearCookies','deleteProfile','toggleFavorite','renameProfile'].includes(action)) throw Error('Thao tác không được hỗ trợ.');
 validHost(domain);
 if(action!=='clearCookies') validName(name);
 if(['deleteProfile','toggleFavorite','switchProfile','renameProfile'].includes(action) && !profiles[domain]?.[name]) throw Error('Không tìm thấy profile.');
 if(action==='saveYoutubeChannel') {
   if(!['studio.youtube.com','youtube.com','www.youtube.com'].includes(domain)) throw Error('Chỉ hỗ trợ lưu kênh YouTube/Studio.');
  const {tab}=await activeSite(domain);
  if(profiles[domain]?.[name] && message.overwrite!==true) throw Error('Cần xác nhận ghi đè.');
  if(domain==='studio.youtube.com') {
   const channelId=new URL(tab.url).pathname.match(/^\/channel\/(UC[A-Za-z0-9_-]{22})(?:\/|$)/)?.[1];
   if(!channelId) throw Error('Studio chưa hiển thị mã kênh trong /channel/UC… . Hãy mở bảng điều khiển kênh rồi lưu lại.');
    const channel=await readChannelInTab(tab.id,true);
    if(!channel.handle) throw Error('Không đọc được handle kênh Studio hiện tại.');
    profiles[domain]??={};
     profiles[domain][name]={name,domain,cookies:[],youtubeChannel:{channelId,handle:channel.handle},timestamp:Date.now(),isFavorite:profiles[domain][name]?.isFavorite||false};
   await saveProfiles(profiles);
    return {success:true,message:'Đã lưu kênh Studio '+channelId+'. Không thay đổi cookie.'};
  } else {
    const current=await currentCookies(domain,(await activeSite(domain)).storeId);
    checkTarget(current);
   profiles[domain]??={};
    const channel=await readChannelInTab(tab.id);
     if(!channel.handle) throw Error('Không đọc được handle tài khoản hiện tại từ menu YouTube.');
    profiles[domain][name]={name,domain,cookies:current,youtubeChannel:channel,timestamp:Date.now(),isFavorite:profiles[domain][name]?.isFavorite||false};
   await saveProfiles(profiles);
      return {success:true,message:'Đã lưu tài khoản YouTube '+channel.handle+'.'};
  }
 }
 if(action==='deleteProfile') {delete profiles[domain][name]; if(!Object.keys(profiles[domain]).length) delete profiles[domain];}
 else if(action==='toggleFavorite') profiles[domain][name].isFavorite=!profiles[domain][name].isFavorite;
 else if(action==='renameProfile') {
  validName(message.newName);
  if(profiles[domain][message.newName]) throw Error('Tên tài khoản đã tồn tại trên website này.');
  const profile=profiles[domain][name]; profile.name=message.newName; profiles[domain][message.newName]=profile; delete profiles[domain][name];
 }
 else {
   if(action==='switchProfile') return doSwitch(domain,name,profiles);
   const {storeId}=await activeSite(domain,action!=='switchProfile');
  const current=await currentCookies(domain,storeId);
  if(action==='saveProfile') {
   checkTarget(current);
   if(profiles[domain]?.[name] && message.overwrite!==true) throw Error('Cần xác nhận ghi đè.');
   const prev=profiles[domain]?.[name];
   profiles[domain]??={}; profiles[domain][name]={name,domain,cookies:current,timestamp:Date.now(),isFavorite:prev?.isFavorite||false};
  } else if(action==='switchProfile') {
   return doSwitch(domain,name,profiles);
  } else {
   // clearCookies
   try {await clear(current,storeId); }
   catch(error) { throw Error(error.message); }
   // after manual clear, if domain has autoLogin profile, user likely wants to stay logged out -> do not auto restore here
   return {success:true,message:'Đã xóa cookie.'};
  }
 }
 await saveProfiles(profiles); return {success:true};
}

chrome.runtime.onMessage.addListener((message,sender,respond)=>{
 if(sender.id!==chrome.runtime.id || sender.tab || sender.url!==chrome.runtime.getURL('popup/local.html')) return false;
 const task=queue.then(()=>handle(message)); queue=task.catch(()=>{});
 task.then(respond,error=>respond({error:error.message})); return true;
});
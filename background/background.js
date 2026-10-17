import {loadProfiles,saveProfiles} from '../local-storage.js';
import {validateProfiles,validateCookies,validHost,validName,validTargetUrl} from '../validation.js';
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
  if(!tab) throw Error('Không có tab phù hợp.');
  const url=tab.url?new URL(tab.url):null;
 const matches=!!url && ['http:','https:'].includes(url.protocol) && url.hostname===host;
 if(requireMatchingSite && !matches) throw Error('Hãy mở đúng website trước khi thao tác.');
 if(!await chrome.permissions.contains({origins:[`http://${host}/*`,`https://${host}/*`]})) throw Error('Cần cấp quyền truy cập website trước khi thao tác.');
 const stores=await chrome.cookies.getAllCookieStores();
  const store=stores.find(s=>s.tabIds.includes(tab.id));
 if(!store) throw Error('Không xác định được cookie store.');
  return {tab,windowId:tab.windowId,storeId:store.id};
}
async function openTargetTab(active,domain,targetUrl) {
  let url=null; try { if(active?.url) url=new URL(active.url); } catch {}
  const target=targetUrl || `https://${domain}/`;
  if(url?.href===target) {
   await chrome.tabs.reload(active.id);
  } else {
   await chrome.tabs.update(active.id,{url:target});
  }
  return active;
}
async function pauseTab(tab) {
 // about:blank also works in InPrivate with a spanning extension background.
 await chrome.tabs.update(tab.id,{url:'about:blank'});
 for(let attempt=0;attempt<100;attempt++) {
  const current=await chrome.tabs.get(tab.id);
  if(current.url==='about:blank' && !current.pendingUrl && current.status==='complete') return;
  if(current.url!=='about:blank' && current.pendingUrl!=='about:blank') throw Error('Tab đã chuyển trang. Đã dừng chuyển phiên.');
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 throw Error('Không thể tạm dừng trang hiện tại. Chưa thay đổi cookie.');
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
  return validateCookies(scoped,host);
}
function summary(profiles) {
 const result={};
 const now=Date.now()/1000;
 for(const [host,items] of Object.entries(profiles)) {
  result[host]={}; for(const [name,p] of Object.entries(items)) {
   const cookies=Array.isArray(p.cookies)?p.cookies:[];
   result[host][name]={name,isFavorite:p.isFavorite,timestamp:p.timestamp,youtubeChannel:p.youtubeChannel||null,cookieCount:cookies.length,expiredCookieCount:cookies.filter(c=>c.expirationDate!==undefined && c.expirationDate<=now).length};
  }
 }
 return result;
}
async function refreshProfile(domain,name,profile) {
 const {tab,storeId}=await activeSite(domain);
 const current=await currentCookies(domain,storeId);
 checkTarget(current);
 if(profile.youtubeChannel && ['youtube.com','www.youtube.com'].includes(domain)) {
  const channel=await readChannelInTab(tab.id);
  if(!channel.handle || channel.handle!==profile.youtubeChannel.handle) throw Error('Tài khoản hiện tại không trùng profile YouTube cần cập nhật.');
 }
 profile.cookies=current;
 profile.timestamp=Date.now();
 return {success:true,message:`Đã cập nhật ${current.length} cookie cho profile “${name}”. Không kéo dài hạn cookie.`};
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
 const saved=validateCookies(profiles[domain][name].cookies,domain);
  const targetUrl=validTargetUrl(profiles[domain][name].targetUrl || `https://${domain}/`,domain);
 const target=checkTarget(saved);
 const skipped=saved.length-target.length;
 const warning=skipped?` Đã bỏ qua ${skipped}/${saved.length} cookie hết hạn. Nếu website yêu cầu đăng nhập, hãy đăng nhập và lưu lại đúng tài khoản.`:'';
  const {tab:active,windowId,storeId}=await activeSite(domain,false);
 const current=await currentCookies(domain,storeId);
 const norm = d => d.replace(/^\./,'');
 const same=current.length===target.length && target.every(t=>current.some(c=>c.name===t.name && c.value===t.value && norm(c.domain)===norm(t.domain) && c.path===t.path));
 if(same){
   await openTargetTab(active,domain,targetUrl);
   return {success:true,message:'Phiên hiện tại đã khớp, đã mở '+domain+'.'+warning};
 }
  await pauseTab(active);
  try {await clear(await currentCookies(domain,storeId),storeId); await restore(target,storeId);}
 catch(error) {
  try {await clear(await currentCookies(domain,storeId),storeId); await restore(current,storeId);}
  catch {throw Error(`${error.message} Khôi phục phiên trước cũng thất bại. Có thể cần đăng nhập lại.`);}
   if(active.url && /^https?:/.test(active.url)) {
    try {await chrome.tabs.update(active.id,{url:active.url});} catch {}
   }
   throw Error(`${error.message} Đã ghi lại và kiểm tra cookie của phiên trước.`);
 }
  await chrome.tabs.update(active.id,{url:targetUrl});
  return {success:true,message:`Đã khôi phục ${target.length} cookie. Website vẫn quyết định phiên còn hiệu lực hay không.`+warning};
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
  if(!['saveProfile','saveYoutubeChannel','refreshProfile','switchProfile','clearCookies','deleteProfile','toggleFavorite','renameProfile'].includes(action)) throw Error('Thao tác không được hỗ trợ.');
 validHost(domain);
 if(action!=='clearCookies') validName(name);
  if(['deleteProfile','toggleFavorite','switchProfile','refreshProfile','renameProfile'].includes(action) && !profiles[domain]?.[name]) throw Error('Không tìm thấy profile.');
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
  if(action==='refreshProfile') {
   await refreshProfile(domain,name,profiles[domain][name]);
   await saveProfiles(profiles);
   return {success:true,message:`Đã cập nhật cookie cho profile “${name}”. Không kéo dài hạn cookie.`};
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
    const {tab,storeId}=await activeSite(domain);
  const current=await currentCookies(domain,storeId);
  if(action==='saveProfile') {
   checkTarget(current);
   if(profiles[domain]?.[name] && message.overwrite!==true) throw Error('Cần xác nhận ghi đè.');
   const prev=profiles[domain]?.[name];
   profiles[domain]??={}; profiles[domain][name]={name,domain,targetUrl:validTargetUrl(tab.url,domain),cookies:current,timestamp:Date.now(),isFavorite:prev?.isFavorite||false};
  } else {
   // clearCookies
    await clear(current,storeId);
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
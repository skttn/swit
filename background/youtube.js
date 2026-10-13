export function readCurrentChannel() {
 // Must run in MAIN: the isolated extension world cannot see ytcfg.
 // Page URLs and video metadata identify viewed channels, not the account.
 if(!['www.youtube.com','youtube.com'].includes(location.hostname)) return {channelId:null};
 try {
  const config=globalThis.ytcfg;
  const channelId=typeof config?.get==='function'?config.get('CHANNEL_ID'):config?.data_?.CHANNEL_ID;
  const loggedIn=typeof config?.get==='function'?config.get('LOGGED_IN'):config?.data_?.LOGGED_IN;
  if(loggedIn===false) return {channelId:null};
  return {channelId:typeof channelId==='string' && /^UC[A-Za-z0-9_-]{22}$/.test(channelId)?channelId:null};
 } catch {return {channelId:null};}
}

export function youtubeAccountClick(handle=null,studio=false) {
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const until=async(read,timeout)=>{
  let elapsed=0,delay=50;
  while(true) {
   const value=read();
   if(value) return value;
   if(elapsed>=timeout) return null;
   const duration=Math.min(delay,timeout-elapsed);
   await wait(duration);
   elapsed+=duration;
   delay=Math.min(delay*2,400);
  }
 };
 const text=el=>(el?.innerText||el?.getAttribute?.('aria-label')||'').trim().toLocaleLowerCase();
 const click=el=>{el?.scrollIntoView?.({block:'center'}); el?.click();};
 const find=predicate=>[...document.querySelectorAll('ytd-multi-page-menu-renderer ytd-compact-link-renderer')].find(predicate);
 const account=()=>[...document.querySelectorAll('ytd-account-item-renderer')].filter(el=>el.getClientRects().length);
 const identity=el=>{
  const value=studio?el.querySelector('yt-formatted-string[secondary][respect-lang-dir]')?.textContent:el.data?.channelHandle?.simpleText;
  return typeof value==='string' && /^@[\p{L}\p{N}_.-]{3,30}$/u.test(value.trim())?value.trim().toLocaleLowerCase():null;
 };
 const isSelected=el=>studio?!!el.querySelector('#selected:not([hidden])'):el.data?.isSelected===true;
 const isSwitchLabel=value=>/switch account|chuyển đổi tài khoản|cambiar de cuenta|wechseln|changer de compte/i.test(value);
 return (async()=>{
  if(!(studio?location.hostname==='studio.youtube.com':['www.youtube.com','youtube.com'].includes(location.hostname))) throw Error('Chỉ tự động chuyển tài khoản trên YouTube/Studio đúng chế độ.');
   if(handle!==null && (typeof handle!=='string' || !/^@[\p{L}\p{N}_.-]{3,30}$/u.test(handle))) throw Error('Handle không hợp lệ.');
   if(handle!==null) handle=handle.toLocaleLowerCase();
  const style=document.createElement('style');
  const menuSelector=studio?'tp-yt-iron-dropdown:has(ytd-multi-page-menu-renderer)':'ytd-popup-container tp-yt-iron-dropdown:has(ytd-multi-page-menu-renderer)';
  style.textContent=(studio?menuSelector+', ytd-multi-page-menu-renderer':menuSelector)+' { opacity:0!important; pointer-events:none!important; transition:none!important; animation:none!important; }';
  document.documentElement.append(style);
  const cleanup=setTimeout(()=>style.remove(),12000);
  let avatar;
  try {
   avatar=await until(()=>document.querySelector(studio?'ytd-topbar-menu-button-renderer.ytcpAppHeaderAvatar #avatar-btn':'#avatar-btn'),5000);
  if(!avatar) throw Error('Không tìm thấy nút tài khoản YouTube. Hãy tải lại trang rồi thử lại.');
   const menuState=()=>{
    const items=account();
    if(items.length) return {items};
    const switchItem=find(el=>el.getClientRects().length && isSwitchLabel(text(el)));
    return switchItem?{switchItem}:null;
   };
   let state=menuState();
   if(!state) {
    click(avatar);
    state=await until(menuState,6000);
   }
   if(!state) throw Error('Không tìm thấy mục “Switch account” trong menu YouTube.');
   let items=state.items;
   if(!items) {
    click(state.switchItem);
    items=await until(()=>{
     const rows=account();
     return rows.length && rows.some(el=>isSelected(el) && identity(el))?rows:null;
    },6900);
   }
   if(!items) throw Error('Không đọc được handle duy nhất của tài khoản hiện tại.');
   const selected=items.filter(isSelected);
   if(selected.length!==1 || !identity(selected[0])) throw Error('Không đọc được handle duy nhất của tài khoản hiện tại.');
   const current=identity(selected[0]);
   if(handle===null) return {handle:current};
   const targets=items.filter(el=>identity(el)===handle);
   if(targets.length!==1 || targets[0].data?.isDisabled===true || (studio && targets[0].querySelector('[aria-disabled="true"]'))) throw Error('Không tìm thấy tài khoản khả dụng khớp duy nhất với handle đã lưu.');
   if(current===handle) return {handle:current,alreadySelected:true};
   click(studio?(targets[0].querySelector('tp-yt-paper-icon-item[role="option"]')||targets[0]):targets[0]);
   return {clicked:true};
  } finally {
   try {
    const menu=document.querySelector(studio?menuSelector:'ytd-popup-container tp-yt-iron-dropdown');
    if(menu?.opened && typeof menu.close==='function') menu.close();
    else if(studio && document.querySelector('ytd-multi-page-menu-renderer')?.getClientRects().length) avatar?.click();
   } finally {
    clearTimeout(cleanup); style.remove();
   }
  }
 })();
}

export async function readChannelInTab(tabId,studio=false) {
 const tab=await chrome.tabs.get(tabId);
 if(!isYoutubeTab(tab,studio)) throw Error('Tab không đúng website hoặc là tab ẩn danh.');
 const [result]=await chrome.scripting.executeScript({target:{tabId},world:'MAIN',func:youtubeAccountClick,args:[null,studio]});
 return result?.result||{handle:null};
}

function isYoutubeTab(tab,studio=false) {
 try {
  const url=new URL(tab.url);
  return !tab.incognito && url.protocol==='https:' && (studio?url.hostname==='studio.youtube.com':['youtube.com','www.youtube.com'].includes(url.hostname));
 } catch {return false;}
}

export async function prepareYoutubeTab(studio=false) {
 let [tab]=await chrome.tabs.query({active:true,currentWindow:true});
 if(!tab || tab.incognito) throw Error('Không có tab thường phù hợp để chuyển tài khoản.');
 if(!isYoutubeTab(tab,studio)) tab=await chrome.tabs.update(tab.id,{url:studio?'https://studio.youtube.com/':'https://www.youtube.com/'});
 const deadline=Date.now()+20000;
 while(Date.now()<deadline) {
  try {tab=await chrome.tabs.get(tab.id);} catch {throw Error('Tab YouTube đã bị đóng. Hãy thử lại.');}
  if(tab.pendingUrl) {
   if(!isYoutubeTab({...tab,url:tab.pendingUrl},studio)) throw Error('Tab đã rời YouTube. Đã dừng chuyển tài khoản để bảo đảm an toàn.');
   await new Promise(resolve=>setTimeout(resolve,200));
   continue;
  }
  if(!isYoutubeTab(tab,studio)) throw Error('Tab đã rời YouTube. Đã dừng chuyển tài khoản để bảo đảm an toàn.');
  if(tab.discarded) {await chrome.tabs.reload(tab.id);}
  else if(tab.status==='complete' && !tab.pendingUrl) return tab;
  await new Promise(resolve=>setTimeout(resolve,200));
 }
 throw Error('YouTube tải quá lâu. Hãy kiểm tra kết nối rồi thử lại.');
}

export async function clickYoutubeAccount(tabId,handle,studio=false) {
 const tab=await chrome.tabs.get(tabId);
 if(!isYoutubeTab(tab,studio)) throw Error('Tab đã rời YouTube hoặc không phải tab thường. Đã dừng thao tác.');
 const [result]=await chrome.scripting.executeScript({target:{tabId},world:'MAIN',func:youtubeAccountClick,args:[handle,studio]});
 if(result?.result?.alreadySelected) return {success:true,message:'Đang dùng đúng kênh '+(studio?'Studio.':'YouTube.')};
 if(!result?.result?.clicked) throw Error('Không xác nhận được việc chọn tài khoản YouTube.');
 const deadline=Date.now()+7000;
 let detail='Trang chưa tải xong.';
 while(Date.now()<deadline) {
  await new Promise(resolve=>setTimeout(resolve,500));
  let current;
  try {current=await chrome.tabs.get(tabId);} catch {throw Error('Tab đã bị đóng trong lúc xác minh tài khoản.');}
  if(current.incognito) throw Error('Không xác minh tài khoản trong tab ẩn danh.');
  if(current.status!=='complete' || current.pendingUrl) continue;
  if(!isYoutubeTab(current,studio)) {
   detail='Tab chưa trở về '+(studio?'Studio.':'YouTube.');
   continue;
  }
  try {
   const channel=await readChannelInTab(tabId,studio);
   if(channel.handle===handle.toLocaleLowerCase()) return {success:true,message:'Đã chuyển sang kênh '+(studio?'Studio ':'YouTube ')+handle+'.'};
   detail=channel.handle?'Menu vẫn đang chọn '+channel.handle+'.':'Menu chưa hiển thị handle đang chọn.';
  } catch(error) {detail=error.message;}
 }
 throw Error('Chưa xác minh được kênh sau khi chuyển trên '+(studio?'Studio':'YouTube')+'. '+detail);
}

export async function switchChannel(profile) {
 if(profile.domain!=='studio.youtube.com') throw Error('Profile YouTube không hợp lệ cho Studio.');
 const handle=profile.youtubeChannel?.handle;
 if(!handle) throw Error('Profile Studio thiếu handle. Hãy lưu lại đúng kênh và xác nhận ghi đè.');
 const tab=await prepareYoutubeTab(true);
 return clickYoutubeAccount(tab.id,handle,true);
}

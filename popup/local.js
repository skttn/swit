const $=id=>document.getElementById(id);
let domain='', profiles={}, busy=false, permitted=false, siteIcons={}, language='vi';
const translations={
  vi:{app:'Chuyển đổi',search:'Tìm kiếm',saved:'Tài khoản đã lưu',name:'Tên tài khoản cho trang đang mở',save:'Lưu phiên',backup:'Xuất và nhập',backupNote:'Mật khẩu riêng (8–256 ký tự) không được lưu; quên mật khẩu sẽ không khôi phục được.',password:'Mật khẩu sao lưu',passwordConfirm:'Xác nhận mật khẩu khi xuất',passwordPlaceholder:'Ít nhất 8 ký tự',passwordConfirmPlaceholder:'Nhập lại mật khẩu',export:'Xuất',import:'Nhập',cancel:'Hủy',confirm:'Xác nhận',rename:'Đổi tên tài khoản',newName:'Tên tài khoản mới',renameButton:'Đổi tên',language:'English',settings:'Cài đặt cho',edit:'Sửa',remove:'Xóa',notFound:'Không tìm thấy.',empty:'Chưa có tài khoản. Mở website rồi bấm Lưu phiên.',working:'Đang xử lý…',cancelled:'Đã hủy.',done:'Hoàn tất.',invalidSite:'Hãy mở một website HTTP/HTTPS.',invalidName:'Tên không hợp lệ.',noPermission:'Extension chưa có quyền truy cập website này. Hãy cài lại hoặc tải lại extension để cấp quyền.',overwrite:'Ghi đè phiên đã lưu?',overwriteMessage:'Thay phiên của “{name}” trên {host} bằng phiên hiện tại. Phiên đã lưu trước đó sẽ bị thay thế.',importTitle:'Nhập dữ liệu đã mã hóa?',importMessage:'Chỉ tiếp tục nếu bạn tin cậy nguồn dữ liệu. Các phiên trùng website và tên sẽ bị ghi đè.',confirmPassword:'Mật khẩu xác nhận không khớp.',fileTooLarge:'File quá 8 MB.',deleteTitle:'Xóa tài khoản đã lưu?',deleteMessage:'“{name}” trên {host}\nChỉ xóa phiên đã lưu trong Switcher, không xóa tài khoản trên website.',deleteAction:'Xóa phiên',changeMessage:'Đổi “{name}” thành “{next}” trên {host}.'},
  en:{app:'Switcher',search:'Search',saved:'Saved accounts',name:'Account name for the open page',save:'Save session',backup:'Export and import',backupNote:'The private password (8–256 characters) is not saved; if forgotten, the backup cannot be restored.',password:'Backup password',passwordConfirm:'Confirm password for export',passwordPlaceholder:'At least 8 characters',passwordConfirmPlaceholder:'Re-enter password',export:'Export',import:'Import',cancel:'Cancel',confirm:'Confirm',rename:'Rename account',newName:'New name',renameButton:'Rename',language:'Tiếng Việt',settings:'Settings for',edit:'Edit',remove:'Delete',notFound:'Nothing found.',empty:'No accounts yet. Open a website and click Save session.',working:'Processing…',cancelled:'Cancelled.',done:'Done.',invalidSite:'Open an HTTP/HTTPS website first.',invalidName:'Invalid name.',noPermission:'The extension does not have access to this website. Reinstall or reload the extension to grant access.',overwrite:'Overwrite saved session?',overwriteMessage:'Replace “{name}” on {host} with the current session. The previous saved session will be replaced.',importTitle:'Import encrypted data?',importMessage:'Continue only if you trust the data source. Sessions with the same website and name will be overwritten.',confirmPassword:'The confirmation password does not match.',fileTooLarge:'File is larger than 8 MB.',deleteTitle:'Delete saved account?',deleteMessage:'“{name}” on {host}\nOnly the saved session in Switcher will be deleted, not the website account.',deleteAction:'Delete session',changeMessage:'Change “{name}” to “{next}” on {host}.'}
};
const t=key=>translations[language][key];
const format=(key,values)=>Object.entries(values).reduce((text,[name,value])=>text.replaceAll(`{${name}}`,value),t(key));
function localizeMessage(message) {
 const known={
  'Mật khẩu sai':'Incorrect password.', 'File backup không hợp lệ.':'Invalid backup file.',
  'Hãy mở đúng website trước khi thao tác.':'Open the correct website before performing this action.',
  'Cần cấp quyền truy cập website trước khi thao tác.':'Website access permission is required before performing this action.',
  'Đã xóa cookie.':'Cookies deleted.', 'Thao tác không được hỗ trợ.':'Unsupported action.',
  'Không tìm thấy profile.':'Profile not found.', 'Tên tài khoản đã tồn tại trên website này.':'An account with this name already exists on this website.',
  'Cần xác nhận ghi đè.':'Overwrite confirmation is required.'
 };
 if(language!=='en') return message;
 if(known[message]) return known[message];
 return message
   .replace('Tất cả cookie đã hết hạn. Chưa thay đổi phiên hiện tại; cần đăng nhập và lưu lại.', 'All cookies have expired. The current session is unchanged; sign in and save again.')
   .replace(/Đã bỏ qua (\d+)\/(\d+) cookie hết hạn\./, 'Skipped $1/$2 expired cookies.')
   .replace('Nếu website yêu cầu đăng nhập, hãy đăng nhập và lưu lại đúng tài khoản.', 'If the website asks you to sign in, sign in and save the correct account again.')
  .replace('Đã khôi phục ', 'Restored ')
  .replace(' cookie. Website vẫn quyết định phiên còn hiệu lực hay không.', ' cookies. The website still determines whether the session is valid.')
  .replace('Phiên hiện tại đã khớp, đã mở ', 'The current session already matches; opened ')
  .replace('Đã lưu tài khoản YouTube ', 'Saved YouTube account ')
  .replace('Đã lưu kênh Studio ', 'Saved Studio channel ')
  .replace('Profile YouTube thiếu handle. Hãy lưu lại đúng tài khoản và xác nhận ghi đè.', 'The YouTube profile is missing a handle. Save the correct account again and confirm overwrite.');
}
function applyLanguage(){
 const en=language==='en'; document.documentElement.lang=language; document.title=t('app');
 $('app-name').textContent=t('app'); $('app-name').previousElementSibling.alt=t('app'); $('language').title=t('language'); $('language').ariaLabel=t('language');
 $('backup-toggle').title=t('backup'); $('backup-toggle').ariaLabel=t('backup');
 $('backup-close').textContent=t('cancel');
 $('search').ariaLabel=t('search'); $('saved-title').textContent=t('saved'); $('name').placeholder=t('name'); $('save-button').textContent=t('save');
 $('backup-title').textContent=t('backup'); $('backup-note').textContent=t('backupNote'); $('password-label').textContent=t('password'); $('password-confirm-label').textContent=t('passwordConfirm'); $('password').placeholder=t('passwordPlaceholder'); $('passwordConfirm').placeholder=t('passwordConfirmPlaceholder'); $('export').textContent=t('export'); $('import').textContent=t('import');
 $('confirm-cancel').textContent=t('cancel'); $('confirm-accept').textContent=t('confirm'); $('rename-title').textContent=t('rename'); $('rename-label').textContent=t('newName'); $('rename-cancel').textContent=t('cancel'); $('rename-accept').textContent=t('renameButton');
 render();
}
async function loadLanguage(){try{const stored=await chrome.storage.local.get('language'); if(stored.language==='en'||stored.language==='vi') language=stored.language;}catch{} applyLanguage();}
const groupSettings={};
const orderStorageKey='profileOrder';
let profileOrder={sites:[],accounts:{}};
let dragState=null;
const iconCacheKey='siteIcons';
function validIcon(url) {
 try {
  const parsed=new URL(url);
  return ['http:','https:','data:'].includes(parsed.protocol) && !url.startsWith('chrome');
 } catch {return false;}
}
async function loadIconCache() {
 try {
  const stored=await chrome.storage.local.get(iconCacheKey);
  if(stored[iconCacheKey] && typeof stored[iconCacheKey]==='object') {
   for(const [host,url] of Object.entries(stored[iconCacheKey])) if(validIcon(url)) siteIcons[host]=url;
  }
 } catch {}
}
async function loadProfileOrder() {
 try {
  const stored=await chrome.storage.local.get(orderStorageKey);
  const order=stored[orderStorageKey];
  if(order && Array.isArray(order.sites) && order.accounts && typeof order.accounts==='object') {
   profileOrder={sites:[...new Set(order.sites.filter(value=>typeof value==='string'))],accounts:Object.fromEntries(Object.entries(order.accounts).filter(([,names])=>Array.isArray(names)).map(([host,names])=>[host,[...new Set(names.filter(value=>typeof value==='string'))]]))};
  }
 } catch {}
}
async function saveProfileOrder() {
 await chrome.storage.local.set({[orderStorageKey]:profileOrder});
}
function persistOrder() {
 return run(async()=>{await saveProfileOrder();});
}
function orderedHosts() {
 const hosts=Object.keys(profiles);
 return [...profileOrder.sites.filter(host=>hosts.includes(host)),...hosts.filter(host=>!profileOrder.sites.includes(host)).sort((a,b)=>a.localeCompare(b))];
}
function orderedNames(host,items) {
 const names=Object.keys(items);
 const saved=Object.hasOwn(profileOrder.accounts,host)?profileOrder.accounts[host]:[];
 return [...saved.filter(name=>names.includes(name)),...names.filter(name=>!saved.includes(name)).sort((a,b)=>(items[b].timestamp||0)-(items[a].timestamp||0))];
}
function setDropEffect(event) {
 event.dataTransfer.dropEffect='move';
 event.preventDefault();
}
function clearDragStyles() {
 document.querySelectorAll('.drag-over,.dragging').forEach(element=>element.classList.remove('drag-over','dragging'));
}
function markDropTarget(target) {
 document.querySelectorAll('.drag-over').forEach(element=>element.classList.remove('drag-over'));
 if(target) target.classList.add('drag-over');
}
function moveItem(list,item,target,after=false) {
 const next=list.filter(value=>value!==item);
 let index=next.indexOf(target);
 if(index<0) index=next.length;
 if(after) index++;
 next.splice(Math.min(index,next.length),0,item);
 return next;
}
function bindSiteDrag(row,host) {
 row.draggable=true;
 let blankStart=false;
 row.addEventListener('pointerdown',event=>{
  blankStart=!event.target.closest('button,img,.account');
 });
 row.addEventListener('dragstart',event=>{
  if(busy || event.target!==row || !blankStart) {event.preventDefault(); return;}
  dragState={type:'site',host}; row.classList.add('dragging');
  event.dataTransfer.effectAllowed='move'; event.dataTransfer.setData('text/profile-site',host);
 });
 row.addEventListener('dragover',event=>{
  if(dragState?.type!=='site') return;
  setDropEffect(event); markDropTarget(dragState.host===host?null:row);
 });
 row.addEventListener('dragleave',event=>{if(!row.contains(event.relatedTarget)) row.classList.remove('drag-over');});
 row.addEventListener('drop',event=>{
  if(dragState?.type!=='site') return;
  event.preventDefault();
  const targetHost=host, sourceHost=dragState.host;
  if(sourceHost!==targetHost) {
   profileOrder.sites=moveItem(orderedHosts(),sourceHost,targetHost,false);
   render(); persistOrder();
  }
  clearDragStyles(); dragState=null;
 });
 row.addEventListener('dragend',()=>{clearDragStyles(); dragState=null;});
}
function bindAccountDrag(account,chip,host,name) {
 chip.draggable=true;
 chip.addEventListener('dragstart',event=>{
  if(busy) {event.preventDefault(); event.stopPropagation(); return;}
  event.stopPropagation(); dragState={type:'account',host,name}; account.classList.add('dragging');
  event.dataTransfer.effectAllowed='move'; event.dataTransfer.setData('text/profile-account',name);
 });
 account.addEventListener('dragover',event=>{
  if(dragState?.type!=='account' || dragState.host!==host) return;
  event.stopPropagation(); setDropEffect(event); markDropTarget(dragState.name===name?null:account);
 });
 account.addEventListener('dragleave',event=>{if(!account.contains(event.relatedTarget)) account.classList.remove('drag-over');});
 account.addEventListener('drop',event=>{
  if(dragState?.type!=='account' || dragState.host!==host || dragState.name===name) return;
  event.preventDefault(); event.stopPropagation();
   profileOrder.accounts[host]=moveItem(orderedNames(host,profiles[host]),dragState.name,name,false);
  clearDragStyles(); dragState=null; render(); persistOrder();
 });
 chip.addEventListener('dragend',()=>{clearDragStyles(); dragState=null;});
}
async function saveIconCache() {
 try {await chrome.storage.local.set({[iconCacheKey]:siteIcons});} catch {}
}
function updateControls() {
  document.querySelectorAll('button').forEach(b=>b.disabled=((!b.closest('dialog') || b.closest('#backup-panel')) && busy) || b.dataset.unavailable==='true');
 $('save').querySelector('button').disabled=busy || !domain;
}
async function refreshPermission() {
 permitted=!!domain && await chrome.permissions.contains({origins:[`http://${domain}/*`,`https://${domain}/*`]});
 updateControls();
}
async function send(action,values={}) {
 const result=await chrome.runtime.sendMessage({action,...values});
 if(result?.error) throw Error(result.error);
 return result;
}
async function run(job) {
 if(busy) return;
 const status=$('backup-panel').open?$('backup-status'):$('status');
  busy=true; updateControls(); status.dataset.state='busy'; status.textContent=t('working');
   try { const result=await job(); status.dataset.state=result===false?'idle':'success'; status.textContent=result===false?t('cancelled'):localizeMessage(result?.message)||t('done'); }
  catch(error) { status.dataset.state='error'; status.textContent=localizeMessage(error.message); }
 finally { busy=false; updateControls(); }
}
function confirmAction(title,message,acceptLabel,danger=false,requestPassword=false) {
 const dialog=$('confirm-dialog');
 const input=$('import-password');
 $('import-password-field').hidden=!requestPassword;
 $('import-password-label').textContent=t('password');
 input.placeholder=t('passwordPlaceholder'); input.value=''; input.disabled=!requestPassword;
 $('confirm-title').textContent=title;
 $('confirm-message').textContent=message;
 $('confirm-accept').textContent=acceptLabel;
 $('confirm-accept').className=danger?'danger':'primary';
 $('confirm-note').hidden=true; $('confirm-note').textContent='';
 dialog.returnValue='cancel';
 return new Promise(resolve=>{
  dialog.onclose=()=>{
   dialog.onclose=null;
   const accepted=dialog.returnValue==='accept';
   const result=requestPassword?(accepted?input.value:null):accepted;
   input.value=''; input.disabled=true; $('import-password-field').hidden=true;
   resolve(result);
  };
  dialog.showModal();
  (requestPassword?input:$('confirm-cancel')).focus();
 });
}
function renameAction(name) {
 const dialog=$('rename-dialog'), input=$('rename-input');
 input.value=name; dialog.returnValue='cancel';
 return new Promise(resolve=>{
  dialog.onclose=()=>{dialog.onclose=null; resolve(dialog.returnValue==='accept'?input.value.trim():null);};
  dialog.showModal(); input.focus(); input.select();
 });
}
async function refresh() { profiles=await send('getProfiles'); render(); }
function button(text,job) {
 const b=document.createElement('button'); b.textContent=text; b.onclick=()=>run(job); return b;
}
function render() {
 $('profiles').replaceChildren();
 const query=$('search').value.toLocaleLowerCase();
  for(const host of orderedHosts()) {
   const items=profiles[host];
  const settings=groupSettings[host]??={open:false};
   const names=orderedNames(host,items).filter(name=>`${host} ${name}`.toLocaleLowerCase().includes(query));
  if(!names.length) continue;
   const row=document.createElement('div'); row.className='ext-row'+(settings.open?' open':''); row.dataset.host=host;
  const icon=document.createElement('img'); icon.className='favicon'; icon.alt='';
  const known=(host==='youtube.com' || host.endsWith('.youtube.com'))?'youtube.svg':siteIcons[host];
  if(known) icon.src=known; else icon.classList.add('fallback');
  icon.onerror=()=>{icon.classList.add('fallback'); icon.removeAttribute('src');};
  const hostLink=document.createElement('button'); hostLink.className='host'; hostLink.textContent=host; hostLink.title=host;
  hostLink.onclick=()=>chrome.tabs.create({url:`https://${host}/`});
  const accounts=document.createElement('div'); accounts.className='accounts';
  for(const name of names) {
    const account=document.createElement('div'); account.className='account';
    const chip=document.createElement('button'); chip.className='chip'; chip.textContent=name; chip.title='Chuyển sang '+name;
   chip.onclick=()=>run(()=>send('switchProfile',{domain:host,name}));
    bindAccountDrag(account,chip,host,name);
    const rename=button('',async()=>{
     const next=await renameAction(name);
     if(!next || next===name) return false;
     if(!await confirmAction(t('rename')+'?',format('changeMessage',{name,next,host}),t('renameButton'))) return false;
      await send('renameProfile',{domain:host,name,newName:next});
      profileOrder.accounts[host]=orderedNames(host,items).map(value=>value===name?next:value);
      await refresh(); await saveProfileOrder();
    });
    rename.className='edit'; rename.title=t('edit'); rename.setAttribute('aria-label',t('edit')); rename.innerHTML='<i class="fa fa-pencil" aria-hidden="true"></i>';
    const remove=button('×',async()=>{
     if(!await confirmAction(t('deleteTitle'),format('deleteMessage',{name,host}),t('deleteAction'),true)) return false;
     await send('deleteProfile',{domain:host,name}); await refresh();
    });
    remove.className='delete'; remove.title=t('remove'); remove.setAttribute('aria-label',t('remove')+' '+name);
    account.append(chip,rename,remove); accounts.append(account);
  }
   const gear=document.createElement('button'); gear.className='gear'; gear.title=t('settings'); gear.setAttribute('aria-label',t('settings')+' '+host); gear.innerHTML='<i class="fa fa-gear" aria-hidden="true"></i>';
   gear.onclick=()=>{settings.open=!settings.open; render();};
  row.append(icon,hostLink,accounts,gear); $('profiles').append(row);
   bindSiteDrag(row,host);
 }
 if(!$('profiles').children.length) {
  const empty=document.createElement('div'); empty.className='empty';
   empty.textContent=query?t('notFound'):t('empty');
  $('profiles').append(empty);
 }
 updateControls();
}

document.addEventListener('click',event=>{
 const clickedRow=event.target.closest?.('.ext-row');
 let changed=false;
 for(const [host,settings] of Object.entries(groupSettings)) {
  if(settings.open && (!clickedRow || clickedRow.dataset.host!==host)) {
   settings.open=false; changed=true;
  }
 }
 if(changed) render();
});

function download(data,name) {
 const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
 const a=document.createElement('a'); a.href=url; a.download=name; a.click();
 setTimeout(()=>URL.revokeObjectURL(url),10000);
}
$('save').onsubmit=event=>{event.preventDefault(); run(async()=>{
  if(!domain) throw Error(t('invalidSite'));
 const name=$('name').value.trim();
  if(!name || ['__proto__','constructor','prototype'].includes(name)) throw Error(t('invalidName'));
 const overwrite=!!profiles[domain]?.[name];
  if(!permitted) throw Error(t('noPermission'));
  if(overwrite && !await confirmAction(t('overwrite'),format('overwriteMessage',{name,host:domain}),t('confirm'),true)) return false;
 await refreshPermission(); render();
  await send(['studio.youtube.com','youtube.com','www.youtube.com'].includes(domain)?'saveYoutubeChannel':'saveProfile',{domain,name,overwrite}); await refresh();
});};
$('search').oninput=render;
$('backup-toggle').onclick=()=>{
 const panel=$('backup-panel');
 $('backup-status').textContent='';
 panel.showModal();
 $('backup-toggle').setAttribute('aria-expanded','true');
 $('password').focus();
};
$('backup-close').onclick=()=>$('backup-panel').close();
$('backup-panel').oncancel=event=>{if(busy) event.preventDefault();};
$('backup-panel').onclose=()=>{
 $('password').value=''; $('passwordConfirm').value=''; $('file').value='';
 $('backup-toggle').setAttribute('aria-expanded','false');
 $('backup-toggle').focus();
};
$('language').onclick=async()=>{
 language=language==='vi'?'en':'vi';
 applyLanguage();
 try {await chrome.storage.local.set({language});} catch {}
};
$('export').onclick=()=>run(async()=>{
 try {
   if($('password').value!==$('passwordConfirm').value) throw Error(t('confirmPassword'));
    download(await send('exportBackup',{password:$('password').value}),'switcher-encrypted.json');
 } finally { $('password').value=''; $('passwordConfirm').value=''; }
});
$('import').onclick=()=>$('file').click();
$('file').onchange=()=>run(async()=>{
 const file=$('file').files[0]; if(!file) return;
 try {
   if(file.size>8*1024*1024) throw Error(t('fileTooLarge'));
  const data=JSON.parse(await file.text());
   const password=await confirmAction(t('importTitle'),t('importMessage'),t('import'),false,true);
   if(password===null) return false;
  await send('importBackup',{data,password}); await refresh();
  $('backup-panel').close();
 } finally { $('file').value=''; $('password').value=''; $('passwordConfirm').value=''; }
});
$('search').focus();
await loadLanguage();
 await run(async()=>{
  await loadIconCache();
  await loadProfileOrder();
 const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
 if(tab?.url) { const url=new URL(tab.url); if(['https:','http:'].includes(url.protocol)) domain=url.hostname; }
 for(const open of await chrome.tabs.query({})) {
  try {
   const host=new URL(open.url).hostname;
    if(open.favIconUrl && validIcon(open.favIconUrl)) siteIcons[host]=open.favIconUrl;
  } catch {}
 }
  await saveIconCache();
 await refreshPermission();
 await refresh();
});


function cookieUrl(c) {
 return `https://${c.domain.replace(/^\./,'')}${c.path}`;
}
function sameCookie(a,b) {
 return a.name===b.name && a.domain.replace(/^\./,'')===b.domain.replace(/^\./,'') && a.path===b.path && a.hostOnly===b.hostOnly;
}
function cookieError(stage,c) {
 // Never include cookie values or raw API errors in diagnostics.
 return Error(`${stage}: cookie ${c.name} (${c.domain}); không thay đổi domain/path/SameSite để thử lại.`);
}
function cookieMismatch(c,actual) {
 if(!actual) return 'không tìm thấy sau khi ghi';
 const fields=['value','hostOnly','secure','httpOnly','sameSite'];
 const different=fields.filter(key=>actual[key]!==c[key]);
 if(c.expirationDate===undefined ? actual.expirationDate!==undefined : actual.expirationDate===undefined || Math.abs(actual.expirationDate-c.expirationDate)>5) different.push('expirationDate');
 return different.length?`lệch ${different.join(', ')}`:null;
}
export function checkTarget(cookies) {
 if(!cookies.length) throw Error('Phiên đã lưu không có cookie. Chưa thay đổi phiên hiện tại.');
 const now=Date.now()/1000;
 const usable=cookies.filter(c=>c.expirationDate===undefined || c.expirationDate>now);
 if(!usable.length) throw Error('Tất cả cookie đã hết hạn. Chưa thay đổi phiên hiện tại; cần đăng nhập và lưu lại.');
 return usable;
}
export async function clear(cookies,storeId) {
 for(const c of cookies) {
  try { await chrome.cookies.remove({url:cookieUrl(c),name:c.name,storeId}); }
  catch { throw cookieError('Không xóa được',c); }
 }
 const remaining=await chrome.cookies.getAll({storeId});
 const failed=cookies.find(c=>remaining.some(actual=>!actual.partitionKey && sameCookie(c,actual)));
 if(failed) throw cookieError('Cookie vẫn còn sau khi xóa',failed);
}
export async function restore(cookies,storeId) {
 for(const c of cookies) {
  const item={url:cookieUrl(c),name:c.name,value:c.value,path:c.path,secure:c.secure,httpOnly:c.httpOnly,storeId};
  if(!c.hostOnly) item.domain=c.domain;
  if(c.sameSite!=='unspecified') item.sameSite=c.sameSite;
  if(c.expirationDate!==undefined) item.expirationDate=c.expirationDate;
  try {
   if(!await chrome.cookies.set(item)) throw Error();
  } catch { throw cookieError('Không ghi được',c); }
 }
 let actual=[];
 for(let attempt=0;attempt<3;attempt++) {
  actual=await chrome.cookies.getAll({storeId});
  const failed=cookies.find(c=>{
   const found=actual.find(a=>!a.partitionKey && sameCookie(c,a));
   return !found || cookieMismatch(c,found)!==null;
  });
  if(!failed) return cookies.length;
  if(attempt<2) await new Promise(resolve=>setTimeout(resolve,100));
  else throw Error(`Kiểm tra sau khi ghi thất bại: cookie ${failed.name} (${failed.domain}); ${cookieMismatch(failed,actual.find(a=>!a.partitionKey && sameCookie(failed,a)))}. Không thay đổi domain/path/SameSite để thử lại.`);
 }
 return cookies.length;
}
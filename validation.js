export const MAX_BYTES=5*1024*1024;
export function validName(name) {
 if(typeof name!=='string' || !name.trim() || name.length>100 || ['__proto__','constructor','prototype'].includes(name) || /[\x00-\x1f]/.test(name)) throw Error('Tên profile không hợp lệ.');
 return name;
}
export function validHost(host) {
 if(typeof host!=='string' || host.length>253 || !/^[a-z0-9]+(?:[a-z0-9.-]*[a-z0-9])?$/.test(host) || host.split('.').some(p=>!p || p.length>63 || p.startsWith('-') || p.endsWith('-')) || ['constructor','prototype','__proto__'].includes(host)) throw Error('Website không hợp lệ.');
 return host;
}
function cookieScope(host) {
 const parts=host.split('.');
 return parts.length>=2?parts.slice(-2).join('.'):host;
}
function cookieMatchesScope(cookieDomain,host) {
 const domain=cookieDomain?.replace(/^\./,'');
 const scope=cookieScope(host);
 return typeof domain==='string' && (domain===scope || domain.endsWith('.'+scope));
}
export function validateCookies(cookies,host) {
 validHost(host);
 if(!Array.isArray(cookies) || cookies.length>1000) throw Error('Danh sách cookie không hợp lệ.');
 return cookies.map(c=>{
   if(!c || typeof c!=='object' || c.partitionKey || !cookieMatchesScope(c.domain,host)) throw Error('Chỉ hỗ trợ cookie trong cùng website, không hỗ trợ cookie partitioned.');
  if(typeof c.name!=='string' || typeof c.value!=='string' || c.name.length+c.value.length>16384 || /[\x00-\x20;=]/.test(c.name) || /[\x00-\x1f\x7f]/.test(c.value)) throw Error('Cookie không hợp lệ.');
  if(typeof c.path!=='string' || !c.path.startsWith('/') || c.path.length>2048 || /[\x00-\x1f?#]/.test(c.path)) throw Error('Đường dẫn cookie không hợp lệ.');
  for(const f of ['secure','httpOnly','hostOnly']) if(typeof c[f]!=='boolean') throw Error('Thuộc tính cookie không hợp lệ.');
  if(!['unspecified','no_restriction','lax','strict'].includes(c.sameSite)) throw Error('SameSite không hợp lệ.');
  if(c.expirationDate!==undefined && (!Number.isFinite(c.expirationDate) || c.expirationDate<=0)) throw Error('Hạn cookie không hợp lệ.');
  const result={domain:c.domain,name:c.name,value:c.value,path:c.path,secure:c.secure,httpOnly:c.httpOnly,hostOnly:c.hostOnly,sameSite:c.sameSite};
  if(c.expirationDate!==undefined) result.expirationDate=c.expirationDate;
  return result;
 });
}
export function validateProfiles(data) {
 if(!data || typeof data!=='object' || Array.isArray(data) || JSON.stringify(data).length>MAX_BYTES) throw Error('Dữ liệu profile không hợp lệ hoặc quá 5 MB.');
 const clean={}; let count=0;
 for(const [host,items] of Object.entries(data)) {
  validHost(host);
  if(!items || typeof items!=='object' || Array.isArray(items)) throw Error('Dữ liệu profile không hợp lệ.');
  clean[host]={};
  for(const [name,p] of Object.entries(items)) {
   validName(name);
   if(++count>500 || !p || p.domain!==host || p.name!==name) throw Error('Profile không hợp lệ hoặc quá 500 profile.');
   let youtubeChannel;
   if(p.youtubeChannel!==undefined) {
    if(typeof p.youtubeChannel!=='object' || !p.youtubeChannel || Array.isArray(p.youtubeChannel)) throw Error('youtubeChannel không hợp lệ.');
    const handle=p.youtubeChannel.handle, channelId=p.youtubeChannel.channelId;
    const hasHandle=typeof handle==='string', hasId=typeof channelId==='string';
    if(!hasHandle && !hasId) throw Error('youtubeChannel thiếu handle/channelId.');
    if(hasHandle && !/^@[\p{L}\p{N}_.-]{3,30}$/u.test(handle)) throw Error('@handle YouTube không hợp lệ.');
    if(hasId && !/^UC[A-Za-z0-9_-]{22}$/.test(channelId)) throw Error('channelId YouTube không hợp lệ.');
    youtubeChannel={};
    if(hasHandle) youtubeChannel.handle=handle.toLocaleLowerCase();
    if(hasId) youtubeChannel.channelId=channelId;
   }
    const profile={name,domain:host,cookies:validateCookies(p.cookies,host),isFavorite:p.isFavorite===true,timestamp:Number.isFinite(p.timestamp)?p.timestamp:null};
   if(youtubeChannel) {
    const cookieDomain=cookieScope(host);
    if(cookieDomain==='google.com' || host==='youtube.com' || host.endsWith('.youtube.com') || host.endsWith('.google.com'))
     profile.youtubeChannel=youtubeChannel;
    else throw Error('youtubeChannel chỉ chấp nhận trên youtube.com hoặc google.com.');
   }
   clean[host][name]=profile;
  }
 }
 return clean;
}
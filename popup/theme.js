const picker=document.createElement('button');
picker.id='theme';
picker.type='button';
const icon=document.createElement('i');
icon.setAttribute('aria-hidden','true');
picker.append(icon);
document.getElementById('language').before(picker);
const stylesheet=document.getElementById('light-theme');
const systemTheme=matchMedia('(prefers-color-scheme: light)');
let preference='system';
const isLight=()=>preference==='light' || (preference==='system' && systemTheme.matches);
const normalize=value=>['system','light','dark'].includes(value)?value:'system';
function applyTheme(value) {
 const theme=normalize(value);
 preference=theme;
 stylesheet.media=theme==='system'?'(prefers-color-scheme: light)':theme==='light'?'all':'not all';
 translateTheme();
}
function translateTheme() {
 const english=document.documentElement.lang==='en';
 const light=isLight();
 const label=english?(light?'Switch to dark theme':'Switch to light theme'):(light?'Chuyển sang giao diện tối':'Chuyển sang giao diện sáng');
 picker.title=label;
 picker.setAttribute('aria-label',label);
 icon.className=light?'fa fa-moon-o':'fa fa-sun-o';
}
systemTheme.addEventListener('change',translateTheme);
translateTheme();
new MutationObserver(translateTheme).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
picker.disabled=true;
try {
 const {theme}=await chrome.storage.local.get('theme');
 applyTheme(theme);
} catch { applyTheme('system'); }
picker.disabled=false;
picker.addEventListener('click',async()=>{
 const theme=isLight()?'dark':'light';
 picker.disabled=true;
 applyTheme(theme);
 try { await chrome.storage.local.set({theme}); }
 catch(error) { console.error('Unable to save theme preference.',error); }
 finally { picker.disabled=false; }
});
chrome.storage.onChanged.addListener((changes,area)=>{
 if(area==='local' && changes.theme) applyTheme(changes.theme.newValue);
});
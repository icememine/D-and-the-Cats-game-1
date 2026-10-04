// Save games, kept in the player's own browser. There is no server: saves live in localStorage,
// and two small cookies remember this device's random ID and the last player who played on it.
// Storage and cookies are passed in, so the rules can be tested headless and a cloud backend can
// replace them later without touching the game.

export const SAVE_VERSION=1;
const SAVE_KEY='anhtrang.save.v1';
export const COOKIE_DEVICE='anhtrang_device';
export const COOKIE_PLAYER='anhtrang_player';

// Names: 1-20 visible characters, Vietnamese letters welcome, no markup.
export function cleanName(raw){return String(raw??'').replace(/[<>"'`\\]/g,'').replace(/\s+/g,' ').trim().slice(0,20);}
export const nameKey=name=>cleanName(name).toLocaleLowerCase('vi');

// Coarse device class for the save record. Not used for identification.
export function deviceType({ua='',coarse=false,width=1024}={}){
 if(/iPad|Tablet|Nexus (7|9|10)/i.test(ua)||(/Android/i.test(ua)&&!/Mobile/i.test(ua))||(/Macintosh/i.test(ua)&&coarse))return'tablet';
 if(/Mobi|iPhone|iPod|Android/i.test(ua)||(coarse&&width<700))return'phone';
 return'desktop';
}

export class SaveStore{
 // storage: {getItem,setItem,removeItem}; cookies: {get(name),set(name,value)}; both may be missing or throw.
 constructor({storage=null,cookies=null,now=()=>Date.now(),randomId=defaultId,device='desktop'}={}){
  this.storage=storage;this.cookies=cookies;this.now=now;this.randomId=randomId;this.device=device;
  this.data=this.read();
  // The device ID is kept in both places so clearing one does not lose it.
  const fromCookie=safe(()=>this.cookies?.get(COOKIE_DEVICE));
  this.data.deviceId=this.data.deviceId||fromCookie||this.randomId();
  this.data.deviceType=device;
  safe(()=>this.cookies?.set(COOKIE_DEVICE,this.data.deviceId));
  const last=safe(()=>this.cookies?.get(COOKIE_PLAYER));
  if(!this.data.current&&last&&this.data.profiles[nameKey(last)])this.data.current=nameKey(last);
  this.write();
 }
 read(){
  const fresh={version:SAVE_VERSION,deviceId:null,deviceType:null,current:null,profiles:{}};
  const raw=safe(()=>this.storage?.getItem(SAVE_KEY));if(!raw)return fresh;
  try{const d=JSON.parse(raw);if(!d||d.version!==SAVE_VERSION||typeof d.profiles!=='object')return{...fresh,deviceId:d?.deviceId||null};return{...fresh,...d};}catch{return fresh;}
 }
 // False when nothing could be stored (no storage, private window, quota), so the UI can say so.
 write(){if(!this.storage)return false;return!!safe(()=>{this.storage.setItem(SAVE_KEY,JSON.stringify(this.data));return true;});}
 get persistent(){return!!this.storage;}
 get deviceId(){return this.data.deviceId;}
 profiles(){return Object.values(this.data.profiles).sort((a,b)=>b.updated-a.updated);}
 current(){return this.data.current?this.data.profiles[this.data.current]||null:null;}
 // Picks an existing player by name, or creates one. Returns the profile, or null for an empty name.
 select(raw){
  const name=cleanName(raw),key=nameKey(name);if(!name)return null;
  const t=this.now();let p=this.data.profiles[key];
  if(!p)p=this.data.profiles[key]={name,created:t,updated:t,deviceType:this.device,dungeon:null,character:null,endings:[],best:{depth:0,score:0}};
  p.updated=t;p.deviceType=this.device;this.data.current=key;
  safe(()=>this.cookies?.set(COOKIE_PLAYER,name));this.write();return p;
 }
 signOut(){this.data.current=null;safe(()=>this.cookies?.set(COOKIE_PLAYER,''));this.write();}
 remove(raw){const key=nameKey(raw);delete this.data.profiles[key];if(this.data.current===key)this.signOut();else this.write();}
 update(fn){const p=this.current();if(!p)return false;fn(p);p.updated=this.now();p.deviceType=this.device;return this.write();}
 // Hầm Ma: the character always persists; `dungeon` is set only while a descent is unfinished.
 saveDungeon(snapshot,{finished=false}={}){return this.update(p=>{p.character=snapshot.character;p.dungeon=finished?null:snapshot;p.best.depth=Math.max(p.best.depth||0,snapshot.stats?.deepest||0);});}
 resetCharacter(){return this.update(p=>{p.character=null;p.dungeon=null;});}
 recordEnding(key){return this.update(p=>{if(!p.endings.includes(key))p.endings.push(key);});}
 recordScore(score){return this.update(p=>{p.best.score=Math.max(p.best.score||0,score);});}
}

// ---- Hầm Ma snapshots: plain JSON, nothing that depends on the current floor's layout.
export function snapshotDungeon(dg){
 return{
  seed:dg.seed,depth:dg.depth,stats:{...dg.stats},
  character:{level:dg.p.level,xp:dg.p.xp,gold:dg.p.gold,potions:{...dg.potions},keys:dg.keys,inventory:dg.inventory.map(clone),equipped:Object.fromEntries(Object.entries(dg.equipped).map(([k,v])=>[k,v?clone(v):null])),trust:Object.fromEntries(dg.companions.map(c=>[c.id,Math.round(c.trust)])),tree:{...dg.tree},town:clone(dg.town),fragments:[...dg.fragments],zinState:dg.zinState,zinFloorDone:dg.zinFloorDone},
 };
}
// Applies a saved character (and, for an unfinished descent, the floor) to a fresh Dungeon.
export function restoreDungeon(dg,{character,depth=1,stats=null}){
 if(character){
  Object.assign(dg.p,{level:character.level||1,xp:character.xp||0,gold:character.gold||0});
  dg.potions={bread:0,battery:0,...character.potions};dg.keys=character.keys||0;
  dg.inventory=(character.inventory||[]).map(clone);
  for(const k of Object.keys(dg.equipped))if(character.equipped&&k in character.equipped)dg.equipped[k]=character.equipped[k]?clone(character.equipped[k]):null;
  for(const c of dg.companions)if(character.trust?.[c.id]!=null)c.trust=character.trust[c.id];
  if(character.tree)dg.tree={...character.tree};if(character.town)dg.town={...dg.town,...clone(character.town)};
  dg.fragments=[...(character.fragments||[])];dg.zinState=character.zinState||null;dg.zinFloorDone=!!character.zinFloorDone;
 }
 if(stats)dg.stats={...dg.stats,...stats};
 const d=dg.derived;dg.p.courage=d.maxCourage;dg.p.battery=d.maxBattery;
 dg.enterFloor(depth);
 return dg;
}

const clone=o=>JSON.parse(JSON.stringify(o));
function safe(fn){try{return fn();}catch{return null;}}
function defaultId(){try{if(globalThis.crypto?.randomUUID)return crypto.randomUUID();}catch{}return'd-'+Math.random().toString(36).slice(2)+Date.now().toString(36);}

// Browser adapters. Each call is guarded: private windows and sandboxed frames can refuse storage.
export function browserStorage(){try{const s=globalThis.localStorage;const k='__anhtrang_probe';s.setItem(k,'1');s.removeItem(k);return s;}catch{return null;}}
export const browserCookies={
 get(name){const m=document.cookie.match(new RegExp('(?:^|; )'+name+'=([^;]*)'));return m?decodeURIComponent(m[1]):null;},
 set(name,value){document.cookie=`${name}=${encodeURIComponent(value)}; max-age=${value?31536000:0}; path=/; SameSite=Lax`;},
};

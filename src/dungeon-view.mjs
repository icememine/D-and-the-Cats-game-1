// Hầm Ma renderer and pointer input. Draws the dungeon simulation; never changes rules itself.
import {TILE, MAP_W, MAP_H, ENEMIES, SLOTS, describeBase} from './dungeon.mjs';
import {SKILL_TREE, BRANCHES, rank, skillPoints, canLearn, RESPEC_COST, TOWN, townPrice, SETS, GEMS, socketsFor, plusBase, upgradeCost, upgradeChance, identifyCost, MAX_PLUS, SUPPLIES, isRestStop} from './progression.mjs';
import {paintDungeonFloor, paintSheetGhost, paintSkeleton, paintLanternGhost, paintMrD, paintCat, paintIcon, ICON_NAMES, paintHero, paintGem, GEAR_TINT} from './art.mjs';
import {xpForLevel} from './dungeon.mjs';

export const RARITY_COLOR={common:'#e6e9e4',magic:'#7fb6ff',rare:'#ffd36b',legendary:'#ff9d4d',set:'#7ee08a'};
const QUEST={stamp:{color:'#f3889c',label:d=>`Con dấu tầng ${d}`},key:{color:'#ffd36b',label:()=>'Chìa khóa đồng'},fragment:{color:'#cfe8ff',label:()=>'Mảnh vé 000'}};
const CANDY=['#f3889c','#a0ead4','#ffd36b','#c3a7ed'];
const SUPPLY_ICON={bread:'bread',battery:'battery',ticket:'home',lens:'lens'};

// What D looks like with this gear on: each worn item's style and rarity colours.
const styleOf=it=>it.style??Math.max(0,SLOTS[it.slot].bases.findIndex(b=>it.name.startsWith(b)));
const tintOf=it=>GEAR_TINT[it.rarity]||GEAR_TINT.common;
export function heroLook(equipped,town){
 const part=slot=>{const it=equipped[slot];return it?{style:styleOf(it),tint:tintOf(it)}:null;};
 const look={hat:part('hat'),coat:part('coat'),torch:part('torch'),bag:part('bag'),shoes:equipped.shoes?tintOf(equipped.shoes)[0]:null,charm:equipped.charm?tintOf(equipped.charm)[0]:null,badge:equipped.badge?tintOf(equipped.badge)[0]:null,cape:town?.costume==='cape'};
 // Mr. D's town costumes show when no coat is worn: the raincoat, or D's own yellow hoodie.
 if(!look.coat&&town?.costume==='raincoat')look.coat={style:1,tint:['#efd43a','#c3a822']};
 if(!look.coat&&town?.costume==='hoodie')look.coat={style:2,tint:['#efc23a','#c39a22']};
 return look;
}
const heroCache=new Map();
export function heroSprite(look,frame=0){const key=JSON.stringify(look)+frame;let c=heroCache.get(key);if(!c){c=paintHero(look,frame);heroCache.set(key,c);if(heroCache.size>80)heroCache.delete(heroCache.keys().next().value);}return c;}

// `custom` maps sprite names to finished artist images; anything missing falls back to the painted placeholder.
export function createDungeonView(canvas,ctx,{atlas,crops,zombie,neck,custom={}}){
 const art={sheet:paintSheetGhost(),skeleton:paintSkeleton(),lantern:paintLanternGhost(),mrd:paintMrD(),...custom};
 if(custom.zombie)zombie=custom.zombie;if(custom.neck)neck=custom.neck;
 const cats=Object.fromEntries(['na','bo','zin'].map(k=>[k,[0,1,2,3,4].map(f=>paintCat(k,f))])),icons=Object.fromEntries(ICON_NAMES.map(n=>[n,paintIcon(n)])),gems=Object.fromEntries(Object.entries(GEMS).map(([k,g])=>[k,paintGem(g.color)]));
 const zcrop=()=>custom.zombie?full(zombie):[0,0,42,82],ncrop=()=>custom.neck?full(neck):[0,0,44,114];
 const fog=document.createElement('canvas');fog.width=MAP_W;fog.height=MAP_H;const fg=fog.getContext('2d');
 const shade=document.createElement('canvas'),sg=shade.getContext('2d');
 let dg=null,floorArt=null,floorSeed=null,camera={scale:1,x:0,y:0},mouse=null,hold=false,holdTimer=0,elapsed=0,box={width:1,height:1},mobile=false;

 const toWorld=e=>{const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)/camera.scale+camera.x,y:(e.clientY-r.top)/camera.scale+camera.y};};
 const enemyAt=pt=>dg.live().filter(e=>Math.hypot(e.x-pt.x,e.y-20-pt.y)<e.r+18).sort((a,b)=>Math.hypot(a.x-pt.x,a.y-pt.y)-Math.hypot(b.x-pt.x,b.y-pt.y))[0];
 const dropAt=pt=>dg.drops.filter(d=>(d.kind==='item'||d.kind==='quest')&&(Math.hypot(d.x-pt.x,d.y-pt.y)<22||(d.labelBox&&pt.x>d.labelBox.x&&pt.x<d.labelBox.x+d.labelBox.w&&pt.y>d.labelBox.y&&pt.y<d.labelBox.y+d.labelBox.h))).sort((a,b)=>Math.hypot(a.x-pt.x,a.y-pt.y)-Math.hypot(b.x-pt.x,b.y-pt.y))[0];

 // Closest visible performer within range, for touch auto-aim.
 function autoAim(range){if(!dg)return null;const p=dg.p;let best=null;for(const e of dg.live()){const d=Math.hypot(e.x-p.x,e.y-p.y);if(d<range&&(!best||d<best.d))best={d,e};}return best?{x:best.e.x,y:best.e.y-10}:null;}

 function sprite(img,crop,x,y,height,face,alpha=1,squash=1){
  const width=crop[2]/crop[3]*height;ctx.save();ctx.globalAlpha*=alpha;ctx.fillStyle='#0006';ctx.beginPath();ctx.ellipse(x,y,width*.35,4,0,0,Math.PI*2);ctx.fill();ctx.translate(x,y);if(Math.cos(face)<-.15)ctx.scale(-1,1);ctx.scale(1,squash);ctx.drawImage(img,...crop,-width/2,-height,width,height);ctx.restore();
 }
 const full=c=>[0,0,c.width,c.height];
 function drawEnemy(e){
  const bob=Math.sin(elapsed*6+e.id)*2,a=e.state==='defeated'?Math.max(0,e.t/.8):1,lift=e.state==='defeated'?(1-a)*20:0;
  const squash=e.state==='windup'?1-Math.min(.12,(e.windupBase-e.t)*.2):1;
  if(e.type==='sheet')sprite(art.sheet,full(art.sheet),e.x,e.y-lift,46,e.face,a,squash);
  else if(e.type==='skeleton')sprite(art.skeleton,full(art.skeleton),e.x,e.y-lift,62,e.face,a,squash);
  else if(e.type==='lantern')sprite(art.lantern,full(art.lantern),e.x,e.y-14+bob-lift,42,e.face,a);
  else if(e.type==='zombie')sprite(zombie,zcrop(),e.x,e.y-lift,96,e.face,a,squash);
  else if(e.type==='vampire')sprite(atlas,crops[3],e.x,e.y-lift,100,e.face,a,squash);
  else if(e.type==='neck')sprite(neck,ncrop(),e.x,e.y-10+bob-lift,118,e.face,a);
  if(e.flash>0){ctx.save();ctx.globalAlpha=.5;ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(e.x,e.y-e.r*2,e.r*1.2,e.r*2,0,0,Math.PI*2);ctx.fill();ctx.restore();}
  if(e.stun>0&&e.state!=='defeated'){ctx.fillStyle='#ffe5ad';for(let i=0;i<3;i++){const t=elapsed*4+i*2.1;ctx.fillRect(e.x+Math.cos(t)*12-1.5,e.y-60+Math.sin(t)*4,3,3);}}
 }
 function telegraphs(){
  for(const e of dg.live()){
   if(e.type==='zombie'&&e.state==='windup'){const k=1-e.t/e.windupBase;ring(e.x,e.y,e.range,'#f3889c',2);ctx.fillStyle=`rgba(243,136,156,${.12+.2*k})`;ctx.beginPath();ctx.arc(e.x,e.y,e.range*k,0,Math.PI*2);ctx.fill();}
   else if(e.type==='vampire'&&e.state==='aim'){ctx.save();ctx.strokeStyle='#f3889cb0';ctx.lineWidth=e.r*2;ctx.globalAlpha=.35;ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.x+Math.cos(e.dashA)*280,e.y+Math.sin(e.dashA)*280);ctx.stroke();ctx.restore();}
   else if(e.state==='windup'&&!ENEMIES[e.type].ranged){ctx.save();ctx.fillStyle='#f3889c55';ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.arc(e.x,e.y,e.range+14,e.face-.7,e.face+.7);ctx.closePath();ctx.fill();ctx.restore();}
   else if(e.state==='windup'){ring(e.x,e.y-34,10+(e.windupBase-e.t)*20,'#a0ead4',2);}
  }
  for(const m of dg.marks){const k=Math.max(0,m.t);ctx.fillStyle=`rgba(0,0,0,${.5-.3*Math.min(1,k)})`;ctx.beginPath();ctx.ellipse(m.x,m.y,40,13,0,0,Math.PI*2);ctx.fill();ring(m.x,m.y,46,'#f3889c',2);ring(m.x,m.y,46*Math.min(1,k),'#f3889c80',1);}
 }
 function glow(x,y,r,color,a){ctx.save();const g=ctx.createRadialGradient(x,y,1,x,y,r);g.addColorStop(0,color);g.addColorStop(1,color+'00');ctx.globalAlpha=a;ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.restore();}
 function ring(x,y,r,color,w=1.5){ctx.beginPath();ctx.arc(x,y,Math.max(0,r),0,Math.PI*2);ctx.strokeStyle=color;ctx.lineWidth=w;ctx.stroke();}
 function label(x,y,text,color,bg='#07131de6'){ctx.font='11px system-ui';ctx.textAlign='center';const w=ctx.measureText(text).width+12;ctx.fillStyle=bg;ctx.fillRect(x-w/2,y-13,w,17);ctx.fillStyle=color;ctx.fillText(text,x,y);return{x:x-w/2,y:y-13,w,h:17};}
 function drops(){
  for(const d of dg.drops){
   const bob=Math.sin(elapsed*3+d.id)*2;
   if(d.kind==='gold'){glow(d.x,d.y-8,18,'#e7c083',.35);ctx.drawImage(icons.coin,d.x-14,d.y-22+bob,20,20);ctx.drawImage(icons.coin,d.x-2,d.y-17+bob,18,18);}
   else if(d.kind==='potion'){glow(d.x,d.y-8,14,{bread:'#f3889c',battery:'#5e95e8',ticket:'#a0ead4',lens:'#cfe8ff'}[d.potion],.3);ctx.drawImage(icons[SUPPLY_ICON[d.potion]],d.x-14,d.y-28+bob,28,28);}
   else if(d.kind==='gem'){const col=GEMS[d.gem].color;glow(d.x,d.y-12,22,col,.5);ctx.drawImage(gems[d.gem],d.x-13,d.y-28+bob,26,26);}
   else if(d.kind==='quest'){const col=QUEST[d.quest].color,bob=Math.sin(elapsed*3)*2;ctx.save();ctx.globalAlpha=.3+.15*Math.sin(elapsed*3);ctx.fillStyle=col;ctx.fillRect(d.x-3,d.y-90,6,90);ctx.restore();
    if(d.quest==='stamp'){ctx.fillStyle='#5b3a26';ctx.fillRect(d.x-3,d.y-22+bob,6,10);ctx.fillStyle='#7c5435';ctx.beginPath();ctx.arc(d.x,d.y-24+bob,5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#c23b3b';ctx.fillRect(d.x-8,d.y-12+bob,16,7);ctx.fillStyle='#f3889c';ctx.fillRect(d.x-8,d.y-12+bob,16,2);}
    else if(d.quest==='fragment'){ctx.fillStyle='#e9e4d6';ctx.fillRect(d.x-9,d.y-20+bob,18,11);ctx.fillStyle='#c23b3b';ctx.fillRect(d.x-7,d.y-18+bob,5,3);ctx.fillStyle='#5b3a26';ctx.fillRect(d.x+1,d.y-17+bob,6,1);ctx.fillRect(d.x+1,d.y-14+bob,6,1);ctx.strokeStyle='#cfe8ff';ctx.lineWidth=1;ctx.strokeRect(d.x-9,d.y-20+bob,18,11);}
    else{ctx.strokeStyle=col;ctx.lineWidth=3;ctx.beginPath();ctx.arc(d.x-6,d.y-14+bob,5,0,Math.PI*2);ctx.stroke();ctx.fillStyle=col;ctx.fillRect(d.x-1,d.y-15+bob,13,3);ctx.fillRect(d.x+8,d.y-13+bob,2,5);ctx.fillRect(d.x+4,d.y-13+bob,2,4);}}
   else{const col=RARITY_COLOR[d.item.rarity],strong=d.item.rarity!=='common';ctx.save();ctx.globalAlpha=(strong?.3:.18)+.1*Math.sin(elapsed*3);ctx.fillStyle=col;ctx.fillRect(d.x-2,d.y-(strong?80:50),4,strong?80:50);ctx.restore();glow(d.x,d.y-16,strong?30:22,col,strong?.5:.35);ring(d.x,d.y-16,19+3*Math.sin(elapsed*4),col+'aa',2);ctx.drawImage(icons[d.item.slot]||icons.charm,d.x-20,d.y-38+bob,40,40);}
  }
 }
 function fixtures(){
  const f=dg.floor,s=f.stairs,u=f.exitUp;
  if(f.special==='zin'){const t=f.table,r=f.roster;ctx.fillStyle='#5b3a26';ctx.fillRect(t.x-34,t.y-16,68,26);ctx.fillStyle='#7c5435';ctx.fillRect(t.x-34,t.y-18,68,5);ctx.fillStyle='#2b2f3a';ctx.fillRect(t.x-8,t.y-34,16,18);ctx.fillStyle='#c23b3b';ctx.fillRect(t.x-10,t.y-18,20,4);ctx.fillStyle='#e9e4d6';ctx.fillRect(t.x+14,t.y-14,14,9);
   ctx.fillStyle='#3a2418';ctx.fillRect(r.x-30,r.y-60,60,46);ctx.fillStyle='#e9e4d6';ctx.fillRect(r.x-26,r.y-56,52,38);ctx.fillStyle='#5b3a26';for(let i=0;i<5;i++)ctx.fillRect(r.x-22,r.y-50+i*7,i===4?14:40,2);ctx.fillRect(r.x-2,r.y-14,4,14);}
  ctx.fillStyle='#05090f';ctx.fillRect(s.x-22,s.y-18,44,36);for(let i=0;i<4;i++){ctx.fillStyle=i%2?'#1b2733':'#24323f';ctx.fillRect(s.x-20+i*3,s.y-16+i*8,40-i*6,6);}
  ctx.strokeStyle=dg.stairsLocked?'#f3889c':'#a0ead4';ctx.lineWidth=2;ctx.strokeRect(s.x-22,s.y-18,44,36);
  if(dg.stairsLocked){ctx.fillStyle='#f3889c';ctx.fillRect(s.x-5,s.y-4,10,8);ctx.strokeStyle='#f3889c';ctx.beginPath();ctx.arc(s.x,s.y-5,4,Math.PI,0);ctx.stroke();}
  if(isRestStop(dg.depth)||f.special){ctx.fillStyle='#5b3a26';for(let i=0;i<5;i++)ctx.fillRect(u.x-10,u.y-34+i*8,20,2);ctx.fillRect(u.x-12,u.y-36,3,40);ctx.fillRect(u.x+9,u.y-36,3,40);}
  else{ctx.fillStyle='#3a2418';ctx.fillRect(u.x-12,u.y-6,24,6);ctx.fillRect(u.x-8,u.y-14,4,8);ctx.fillRect(u.x+3,u.y-10,6,4);}
  if(f.door&&!f.doorOpen){for(const i of f.door.tiles){const x=(i%MAP_W)*TILE,y=Math.floor(i/MAP_W)*TILE;ctx.fillStyle='#3a2418';ctx.fillRect(x,y,TILE,TILE);ctx.fillStyle='#7c5435';ctx.fillRect(x+3,y+3,TILE-6,TILE-6);ctx.fillStyle='#5b3a26';ctx.fillRect(x+TILE/2-1,y+3,2,TILE-6);ctx.fillStyle='#b08a4a';ctx.fillRect(x+3,y+8,TILE-6,3);ctx.fillRect(x+3,y+TILE-11,TILE-6,3);}
   const k=f.door;ctx.fillStyle='#ffd36b';ctx.fillRect(k.x-6,k.y-4,12,10);ctx.strokeStyle='#ffd36b';ctx.lineWidth=2;ctx.beginPath();ctx.arc(k.x,k.y-5,4,Math.PI,0);ctx.stroke();ctx.fillStyle='#3a2418';ctx.fillRect(k.x-1,k.y-1,2,4);}
  if(dg.vendor){const v=dg.vendor;ctx.fillStyle='#3a2418';ctx.fillRect(v.x-30,v.y-92,3,86);ctx.fillRect(v.x+27,v.y-92,3,86);ctx.fillStyle='#c23b3b';ctx.fillRect(v.x-34,v.y-98,68,10);ctx.fillStyle='#f4f1e6';for(let i=0;i<8;i+=2)ctx.fillRect(v.x-34+i*8.5,v.y-98,8.5,10);}
 }
 function projectiles(){for(const q of dg.projectiles){if(q.kind==='candy'){ctx.fillStyle=CANDY[q.hue];ctx.beginPath();ctx.arc(q.x,q.y,5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.fillRect(q.x-1,q.y-3,2,2);}else if(q.kind==='orb'){ctx.save();ctx.globalAlpha=.35;ctx.fillStyle='#a0ead4';ctx.beginPath();ctx.arc(q.x,q.y,11,0,Math.PI*2);ctx.fill();ctx.restore();ctx.fillStyle='#e9fff6';ctx.beginPath();ctx.arc(q.x,q.y,5,0,Math.PI*2);ctx.fill();}else{const a=Math.atan2(q.vy,q.vx),w=Math.sin(elapsed*20)*4;ctx.save();ctx.translate(q.x,q.y);ctx.rotate(a);ctx.fillStyle='#2a1f33';ctx.beginPath();ctx.moveTo(6,0);ctx.lineTo(-4,-6-w);ctx.lineTo(-2,0);ctx.lineTo(-4,6+w);ctx.closePath();ctx.fill();ctx.restore();}}}
 function effects(){for(const fx of dg.effects){const k=(fx.until-dg.time)/(fx.strong?.5:.3);if(fx.kind==='cone'){ctx.save();ctx.globalCompositeOperation='screen';const g=ctx.createRadialGradient(fx.x,fx.y-20,4,fx.x,fx.y-20,fx.range);g.addColorStop(0,`rgba(235,255,225,${(fx.strong?.7:.5)*Math.min(1,k)})`);g.addColorStop(1,'rgba(200,255,225,0)');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(fx.x,fx.y-20);ctx.arc(fx.x,fx.y-20,fx.range,fx.face-fx.spread,fx.face+fx.spread);ctx.closePath();ctx.fill();ctx.restore();}else{ctx.save();ctx.globalAlpha=Math.min(1,k);ring(fx.x,fx.y,fx.r*(1.1-k*.1),fx.color,3);ctx.restore();}}}
 function lighting(){
  // Unexplored tiles are black; explored ones stay dimly visible; the player's light reveals the rest.
  const img=fg.createImageData(MAP_W,MAP_H);for(let i=0;i<MAP_W*MAP_H;i++){img.data[i*4+3]=dg.explored[i]?0:255;}fg.putImageData(img,0,0);
  ctx.save();ctx.imageSmoothingEnabled=true;ctx.drawImage(fog,0,0,MAP_W*TILE,MAP_H*TILE);ctx.restore();
  const dpr=Math.min(window.devicePixelRatio||1,2);if(shade.width!==canvas.width||shade.height!==canvas.height){shade.width=canvas.width;shade.height=canvas.height;}
  sg.setTransform(1,0,0,1,0,0);sg.globalCompositeOperation='source-over';sg.clearRect(0,0,shade.width,shade.height);sg.fillStyle={hell:'rgba(30,6,2,.66)',catacomb:'rgba(12,8,3,.74)'}[dg.floor.theme.id]||'rgba(3,8,16,.78)';sg.fillRect(0,0,shade.width,shade.height);
  sg.globalCompositeOperation='destination-out';const p=dg.p,s=camera.scale*dpr,px=(p.x-camera.x)*s,py=(p.y-20-camera.y)*s,radius=250*s;
  const g=sg.createRadialGradient(px,py,radius*.35,px,py,radius);g.addColorStop(0,'rgba(0,0,0,1)');g.addColorStop(1,'rgba(0,0,0,0)');sg.fillStyle=g;sg.fillRect(0,0,shade.width,shade.height);
  for(const fx of dg.effects)if(fx.kind==='cone'){const fx0=(fx.x-camera.x)*s,fy0=(fx.y-20-camera.y)*s;sg.fillStyle='rgba(0,0,0,.8)';sg.beginPath();sg.moveTo(fx0,fy0);sg.arc(fx0,fy0,fx.range*s,fx.face-fx.spread,fx.face+fx.spread);sg.closePath();sg.fill();}
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(shade,0,0);ctx.restore();
 }
 function overlays(){
  for(const e of dg.live()){if(!e.aggro&&!e.elite&&!e.boss)continue;const w=e.boss?0:30,y=e.y-(e.type==='sheet'?54:e.type==='lantern'?66:e.type==='skeleton'?70:0);if(!e.boss){ctx.fillStyle='#0a1520';ctx.fillRect(e.x-w/2,y,w,4);ctx.fillStyle=e.elite?'#7fb6ff':'#a0ead4';ctx.fillRect(e.x-w/2,y,w*e.hp/e.maxHp,4);}if(e.elite)label(e.x,y-6,e.name,'#7fb6ff');}
  for(const c of dg.companions){if(c.state==='away')continue;const max=dg.companionMax(),y=c.y-50;label(c.x,y-6,c.name,'#cfe8ff','#07131db0');if(c.courage<max){ctx.fillStyle='#0a1520';ctx.fillRect(c.x-14,y,28,3);ctx.fillStyle='#f3889c';ctx.fillRect(c.x-14,y,28*Math.max(0,c.courage)/max,3);}}
  for(const d of dg.drops)if(d.kind==='item'){d.labelBox=label(d.x,d.y-44,itemName(d.item),RARITY_COLOR[d.item.rarity]);}else if(d.kind==='gem')label(d.x,d.y-34,GEMS[d.gem].name,GEMS[d.gem].color);else if(d.kind==='quest')label(d.x,d.y-34,QUEST[d.quest].label(dg.depth),QUEST[d.quest].color);
  if(dg.zin)label(dg.zin.x,dg.zin.y-58,`Zin · ${Math.ceil(dg.zin.t)}s`,'#cfe8ff');if(dg.floor.special==='zin')label(dg.floor.zinSpot.x,dg.floor.zinSpot.y-58,'Zin · Khách Số 0','#ffd9a8');
  for(const f of dg.floaters){const k=1-(f.until-dg.time)/(f.life||1.1);ctx.font=`bold ${f.size}px system-ui`;ctx.textAlign='center';ctx.fillStyle='#061421';const rise=f.life>2?8:24;ctx.fillText(f.text,f.x+1,f.y-k*rise+1);ctx.fillStyle=f.color;ctx.fillText(f.text,f.x,f.y-k*rise);}
  const n=dg.nearby();if(n)label(dg.p.x,dg.p.y-86,(mobile?'':'E · ')+n.label,'#ffe5ad');
 }
 // HUD in the Greedy Cave layout: portrait + bars + status icons top left, quest under it,
 // minimap top right, boss bar under the top row. Buttons are DOM icons laid over the canvas (app.js).
 function hud(){
  const dpr=Math.min(window.devicePixelRatio||1,2),W=box.width,small=W<520;ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.imageSmoothingEnabled=false;
  const p=dg.p,d=dg.derived,ps=small?46:56,x0=10,y0=10;
  // Portrait: the hero's head in a gold frame, level badge on its corner.
  ctx.fillStyle='#07131de6';ctx.fillRect(x0,y0,ps,ps);const hc=crops[0];ctx.drawImage(atlas,hc[0]+20,hc[1]+10,hc[2]-40,(hc[2]-40),x0+3,y0+3,ps-6,ps-6);
  ctx.strokeStyle='#b08a4a';ctx.lineWidth=2;ctx.strokeRect(x0,y0,ps,ps);
  ctx.fillStyle='#07131d';ctx.beginPath();ctx.arc(x0+ps-4,y0+ps-4,11,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#e7c083';ctx.lineWidth=1.5;ctx.stroke();
  ctx.font='bold 11px system-ui';ctx.textAlign='center';ctx.fillStyle='#ffe5ad';ctx.fillText(p.level,x0+ps-4,y0+ps);
  // Courage (red) and battery (blue) bars with numbers, XP hairline under them.
  const bx=x0+ps+8,bw=small?Math.min(150,W-bx-130):180,bh=small?13:15;
  const bar=(y,v,max,fill,back)=>{ctx.fillStyle='#07131de6';ctx.fillRect(bx-1,y-1,bw+2,bh+2);ctx.fillStyle=back;ctx.fillRect(bx,y,bw,bh);ctx.fillStyle=fill;ctx.fillRect(bx,y,bw*Math.max(0,Math.min(1,v/max)),bh);ctx.font=`bold ${small?10:11}px system-ui`;ctx.textAlign='center';ctx.fillStyle='#fff';ctx.fillText(`${Math.max(0,Math.round(v))}/${Math.round(max)}`,bx+bw/2,y+bh-3);};
  bar(y0+2,p.courage,d.maxCourage,'#d2384e','#3a1820');bar(y0+bh+6,p.battery,d.maxBattery,'#3a8fd8','#12243a');
  ctx.fillStyle='#0a1520';ctx.fillRect(bx,y0+2*bh+10,bw,3);ctx.fillStyle='#e7c083';ctx.fillRect(bx,y0+2*bh+10,bw*p.xp/xpForLevel(p.level),3);
  // Status row: keys, stamp, ticket fragments, coins, unspent skill points: icons with numbers.
  let sx=bx,sy=y0+2*bh+18;const chip=(icon,text,dim)=>{ctx.globalAlpha=dim?.35:1;ctx.drawImage(icons[icon],sx,sy,16,16);ctx.globalAlpha=1;if(text!==''){ctx.font='bold 11px system-ui';ctx.textAlign='left';ctx.fillStyle='#061421';ctx.fillText(text,sx+18,sy+13);ctx.fillStyle='#ffe5ad';ctx.fillText(text,sx+17,sy+12);sx+=20+ctx.measureText(text).width+8;}else sx+=22;};
  chip('key',String(dg.keys),!dg.keys);if(!dg.floor.door&&!dg.floor.special)chip('stamp','',!dg.stampFound);if(dg.fragments.length)chip('ticket',`${dg.fragments.length}/3`);chip('coin',String(p.gold));if(dg.skillPoints)chip('tree',`+${dg.skillPoints}`);
  // Quest panel.
  const qy=y0+ps+(small?22:16),qw=small?Math.min(190,W*.5):230;ctx.font=`${small?10.5:11.5}px system-ui`;const words=dg.objective().split(' '),lines=[];let line='';for(const w of words){const t=line?line+' '+w:w;if(ctx.measureText(t).width>qw-16&&line){lines.push(line);line=w;}else line=t;}if(line)lines.push(line);const shown=lines.slice(0,small?3:4);
  const qBottom=qy+20+shown.length*14;ctx.fillStyle='#07131db8';ctx.fillRect(x0,qy,qw,20+shown.length*14);ctx.drawImage(icons.stamp,x0+6,qy+4,12,12);ctx.font=`bold ${small?10.5:11.5}px system-ui`;ctx.textAlign='left';ctx.fillStyle='#e7c083';ctx.fillText('Nhiệm vụ',x0+22,qy+14);ctx.font=`${small?10.5:11.5}px system-ui`;ctx.fillStyle='#d9e7e6';shown.forEach((l,i)=>ctx.fillText(l,x0+8,qy+30+i*14));
  // Minimap of explored tiles, top right.
  const s=small?1.6:2.4,mw=MAP_W*s,mh=MAP_H*s,mx=W-mw-10,my=10;
  ctx.fillStyle='#03070dcc';ctx.fillRect(mx-3,my-3,mw+6,mh+6);ctx.strokeStyle='#b08a4a';ctx.lineWidth=1.5;ctx.strokeRect(mx-3,my-3,mw+6,mh+6);
  for(let y=0;y<MAP_H;y++)for(let x=0;x<MAP_W;x++){const i=y*MAP_W+x;if(dg.explored[i]&&dg.floor.tiles[i]){ctx.fillStyle='#4a5e66';ctx.fillRect(mx+x*s,my+y*s,s,s);}}
  const st=dg.floor.stairs,sxx=Math.floor(st.x/TILE),syy=Math.floor(st.y/TILE);if(dg.explored[syy*MAP_W+sxx]){ctx.fillStyle=dg.stairsLocked?'#f3889c':'#a0ead4';ctx.fillRect(mx+sxx*s-2,my+syy*s-2,s+4,s+4);}
  const seen=pt=>dg.explored[Math.floor(pt.y/TILE)*MAP_W+Math.floor(pt.x/TILE)];
  for(const q of dg.drops)if(q.kind==='quest'&&seen(q)){ctx.fillStyle=QUEST[q.quest].color;ctx.fillRect(mx+q.x/TILE*s-2,my+q.y/TILE*s-2,4,4);}
  const door=dg.floor.door;if(door&&!dg.floor.doorOpen&&seen(door)){ctx.strokeStyle='#ffd36b';ctx.lineWidth=1;ctx.strokeRect(mx+door.x/TILE*s-3,my+door.y/TILE*s-3,6,6);}
  for(const e of dg.live())if(e.aggro){ctx.fillStyle='#f3889c';ctx.fillRect(mx+e.x/TILE*s-1,my+e.y/TILE*s-1,2,2);}
  ctx.fillStyle='#ffe5ad';ctx.fillRect(mx+p.x/TILE*s-2,my+p.y/TILE*s-2,4,4);
  ctx.font='bold 11px system-ui';ctx.textAlign='center';ctx.fillStyle='#e7c083';ctx.fillText(`Tầng ${dg.depth} · ${dg.floor.theme.name}`,mx+mw/2,my+mh+16);
  // Boss bar, centred under the top row.
  const boss=dg.live().find(e=>e.boss&&e.aggro);
  if(boss){const w=Math.min(320,W-40),x=(W-w)/2,y=small?Math.max(my+mh+28,qBottom+22):18;ctx.font='bold 14px system-ui';ctx.textAlign='center';ctx.fillStyle='#061421';ctx.fillText(boss.name,W/2+1,y+1);ctx.fillStyle='#fff';ctx.fillText(boss.name,W/2,y);ctx.fillStyle='#07131de6';ctx.fillRect(x-2,y+5,w+4,20);ctx.fillStyle='#3a1820';ctx.fillRect(x,y+7,w,16);ctx.fillStyle='#c23b5a';ctx.fillRect(x,y+7,w*boss.hp/boss.maxHp,16);ctx.font='bold 11px system-ui';ctx.fillStyle='#fff';ctx.fillText(`${Math.ceil(boss.hp)}/${boss.maxHp}`,W/2,y+19);}
  if(p.hurt>0){const g=ctx.createRadialGradient(W/2,box.height/2,box.height*.3,W/2,box.height/2,W*.7);g.addColorStop(0,'rgba(243,136,156,0)');g.addColorStop(1,`rgba(243,136,156,${p.hurt*1.4})`);ctx.fillStyle=g;ctx.fillRect(0,0,W,box.height);}
  ctx.restore();
 }

 return{
  attach(d){dg=d;floorSeed=null;hold=false;},
  detach(){dg=null;hold=false;},
  autoAim,
  icons,
  gems,
  get mouse(){return mouse;},
  step(dt){elapsed+=dt;if(hold&&mouse&&dg){holdTimer-=dt;if(holdTimer<=0){holdTimer=.18;if(!dg.p.target&&!dg.p.pickTarget)dg.moveTo(mouse.x,mouse.y);}}},
  pointerDown(e){
   if(!dg)return;mouse=toWorld(e);
   if(e.button===2){dg.cast('candy',mouse);return;}
   const enemy=enemyAt(mouse);if(enemy){dg.attackTarget(enemy.id);return;}
   const drop=dropAt(mouse);if(drop){dg.pickUp(drop.id);return;}
   dg.moveTo(mouse.x,mouse.y);if(e.pointerType==='mouse'){hold=true;holdTimer=.18;}
  },
  pointerMove(e){if(dg)mouse=toWorld(e);},
  pointerUp(){hold=false;},
  draw(dt){
   box=canvas.getBoundingClientRect();const dpr=Math.min(window.devicePixelRatio||1,2),cw=Math.round(box.width*dpr),ch=Math.round(box.height*dpr);
   if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;}
   mobile=matchMedia('(pointer:coarse), (max-width:900px)').matches;
   if(!dg)return;
   const artKey=dg.floor.seed+':'+dg.floor.doorOpen;if(floorSeed!==artKey){floorArt=paintDungeonFloor(dg.floor,MAP_W,MAP_H,TILE);floorSeed=artKey;}
   // About 26 tiles across on desktop, 15 on a phone in portrait.
   const target=mobile&&box.width<box.height*1.3?480:Math.min(840,Math.max(560,box.width*.75)),scale=box.width/target;
   const vw=box.width/scale,vh=box.height/scale;camera={scale,x:dg.p.x-vw/2,y:dg.p.y-20-vh/2};
   ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#03070d';ctx.fillRect(0,0,canvas.width,canvas.height);
   ctx.setTransform(scale*dpr,0,0,scale*dpr,-camera.x*scale*dpr,-camera.y*scale*dpr);ctx.imageSmoothingEnabled=false;
   ctx.drawImage(floorArt,0,0,MAP_W*TILE,MAP_H*TILE);
   fixtures();drops();telegraphs();effects();
   const p=dg.p,actors=[...dg.enemies.map(e=>({y:e.y,e})),...dg.companions.filter(c=>c.state!=='away').map(c=>({y:c.y,c})),{y:p.y,p:true}];if(dg.vendor)actors.push({y:dg.vendor.y,v:true});if(dg.zin)actors.push({y:dg.zin.y,z:dg.zin});if(dg.floor.special==='zin')actors.push({y:dg.floor.zinSpot.y,z:{...dg.floor.zinSpot,face:Math.PI,still:true}});actors.sort((a,b)=>a.y-b.y);
   for(const a of actors){if(a.z){const z=a.z;const zi=art.zin||cats.zin[z.still?0:1+Math.floor(elapsed*9)%4],hop=z.still?0:Math.abs(Math.sin(elapsed*5))*-4;ctx.save();ctx.globalAlpha=.4+.15*Math.sin(elapsed*3);ctx.fillStyle='#ffd9a8';ctx.beginPath();ctx.ellipse(z.x,z.y-20,26,30,0,0,Math.PI*2);ctx.fill();ctx.restore();sprite(zi,full(zi),z.x,z.y+hop,art.zin?68:44,z.face||0,.92);continue;}if(a.c){const c=a.c,bob=c.moving?Math.abs(Math.sin(elapsed*12+c.sprite))*-2.4:0,cat=cats[c.id][c.moving?1+Math.floor(elapsed*9+c.sprite)%4:0];sprite(cat,full(cat),c.x,c.y+bob*.5,40,c.face,c.hurt>0?.6:1);continue;}if(a.e)drawEnemy(a.e);else if(a.v){const v=dg.vendor;sprite(art.mrd,full(art.mrd),v.x,v.y-10,70,Math.PI);ctx.fillStyle='#5b3a26';ctx.fillRect(v.x-30,v.y-30,60,30);ctx.fillStyle='#7c5435';ctx.fillRect(v.x-30,v.y-32,60,5);ctx.fillStyle='#e7c083';ctx.font='9px system-ui';ctx.textAlign='center';ctx.fillText('BÁNH BAO · PIN',v.x,v.y-12);}else{const h=heroSprite(heroLook(dg.equipped,dg.town),p.moving?1+Math.floor(elapsed*9)%4:0);sprite(h,full(h),p.x,p.y,70,p.face,p.dash>0?.55:1);}}
   projectiles();lighting();overlays();hud();
  },
 };
}

// HTML for the bag, shop and forge dialogs. The app wires the buttons by their data attributes.
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const urls={};
const iconUrl=name=>urls[name]||(urls[name]=paintIcon(name).toDataURL());
const gemUrl=gem=>urls['gem:'+gem]||(urls['gem:'+gem]=paintGem(GEMS[gem].color).toDataURL());
export const itemName=it=>(it.unid?`??? ${SLOTS[it.slot].bases[styleOf(it)]||SLOTS[it.slot].label}`:it.name)+(it.plus?` +${it.plus}`:'');
// A rough worth, to mark bag items that beat what is worn in the same slot.
const WEIGHT={dmg:3,dmgPct:1.5,crit:2,courage:.5,armor:.8,battery:.4,regen:4,speed:2,gold:.3,onBreak:2,lastStand:.4,firstHit:.3,lowCrit:20,leech:3,dashCd:5};
const worth=it=>Object.entries(it.stats).reduce((t,[k,v])=>t+(WEIGHT[k]||0)*v,0);
function compare(it,worn){if(it.unid)return'<em class="cmp">?</em>';if(!worn)return'<em class="cmp up">▲ ô trống</em>';const d=worth(it)-worth(worn);return d>.5?'<em class="cmp up">▲ tốt hơn</em>':d<-.5?'<em class="cmp down">▼ kém hơn</em>':'<em class="cmp">= ngang</em>';}
export function itemCard(item,actions='',worn){
 if(!item)return'<div class="item empty">Trống</div>';
 const slot=SLOTS[item.slot],base=describeBase({...item,base:plusBase(item)}),holes=socketsFor(item),gems=item.gems||[];
 const lines=item.unid?`<span class="hidden-affix">${item.affixes.length} thuộc tính ẩn · cần giám định</span>`:item.affixes.map(a=>`<span>${esc(a)}</span>`).join('');
 const sockets=holes?`<span class="sockets">${gems.map(g=>`<img src="${gemUrl(g)}" alt="">${esc(GEMS[g].text)}`).join(' ')}${'<i class="hole"></i>'.repeat(Math.max(0,holes-gems.length))}</span>`:'';
 return`<div class="item" style="--rarity:${RARITY_COLOR[item.rarity]}"><div class="item-head"><img src="${iconUrl(item.slot)}" alt=""><b>${esc(itemName(item))}</b>${worn!==undefined?compare(item,worn):''}</div><small><span class="body-tag">${esc(slot.body)}</span> ${esc(slot.label)} · ${esc(item.rarityName)} · cấp ${item.ilvl}</small><span>${esc(base)}</span>${lines}${sockets}${item.set&&!item.unid?`<span class="set-line">${esc(item.setName)}: ${esc(item.setText)}</span>`:''}${actions}</div>`;
}
const gemButtons=(it,pouch,attr,key)=>it.unid||(it.gems||[]).length>=socketsFor(it)?'':Object.keys(GEMS).filter(g=>pouch[g]>0).map(g=>`<button data-${attr}="${key}:${g}"><img class="btn-icon" src="${gemUrl(g)}" alt="">Gắn ${esc(GEMS[g].name)}</button>`).join('');
// The gear screen: D in the middle wearing what is equipped, body slots around him.
export function bagHtml(dg,{sel=null}={}){
 const d=dg.derived,hero=heroSprite(heroLook(dg.equipped,dg.town),0).toDataURL();
 const tile=k=>{const it=dg.equipped[k],s=SLOTS[k];return`<button class="slot${sel===k?' sel':''}" data-slot="${k}" style="--rarity:${it?RARITY_COLOR[it.rarity]:'#3a4a55'}"><img src="${iconUrl(k)}" alt=""><span><small>${s.body} · ${s.label}</small><b>${it?esc(itemName(it)):'Trống'}</b></span></button>`;};
 const supplies=['bread','battery','ticket','lens'].map(k=>`<span class="supply"><img src="${iconUrl(SUPPLY_ICON[k])}" alt="">${SUPPLIES[k].name} ×${dg.potions[k]||0}</span>`).join('');
 const gemRow=Object.entries(GEMS).map(([k,g])=>`<span class="supply"><img src="${gemUrl(k)}" alt="">${g.name} ×${dg.gems[k]||0}</span>`).join('');
 const list=dg.inventory.map((it,i)=>({it,i})).filter(({it})=>!sel||it.slot===sel);
 const worn=sel&&dg.equipped[sel];
 return`<span class="eyebrow">ĐỒ NGHỀ · CẤP ${dg.p.level}</span><h2>Mặc gì đi hầm?</h2>
 <div class="doll"><div class="doll-col">${['hat','charm','badge','torch'].map(tile).join('')}</div>
 <div class="doll-mid"><img class="doll-hero" src="${hero}" alt="D với đồ đang mặc"><p class="stats-line">Sát thương ${Math.round(d.damage)} · Chí mạng ${Math.round(d.crit*100)}%<br>Giáp ${d.armor} · Can đảm ${d.maxCourage}<br>Pin ${d.maxBattery} · Tốc ${Math.round(d.speed)}</p></div>
 <div class="doll-col">${['coat','bag','shoes'].map(tile).join('')}</div></div>
 ${worn?`<h3>Đang mặc ở ${SLOTS[sel].body.toLowerCase()}</h3><div class="items">${itemCard(worn,`<div class="item-actions">${gemButtons(worn,dg.gems,'gemeq',sel)}</div>`)}</div>`:''}
 <h3>${sel?`Trong túi, mặc được ở ${SLOTS[sel].body.toLowerCase()} · <button class="link" data-slot="">xem hết</button>`:'Trong túi'} (${dg.inventory.length}/16)</h3>
 <p class="hint">Đồ nhặt trong chuyến này mà chưa mặc sẽ mất nếu bạn ngất. Mặc vào, hoặc về bằng Vé về / thang ở trạm nghỉ.</p>
 <div class="items">${list.map(({it,i})=>itemCard(it,`<div class="item-actions">${it.unid?`<button disabled>Chưa giám định</button>${dg.potions.lens?`<button data-lens="${i}">Dùng Kính lúp</button>`:''}`:`<button data-equip="${i}">Mặc vào ${SLOTS[it.slot].body.toLowerCase()}</button>`}${gemButtons(it,dg.gems,'gem',i)}<button data-drop="${i}">Vứt</button></div>${it.found?'<small class="found">Nhặt trong chuyến này</small>':''}`,dg.equipped[it.slot])).join('')||`<p>${sel?'Không có món nào cho chỗ này.':'Túi trống. Hạ màn diễn viên để nhặt đồ.'}</p>`}</div>
 <h3>Đồ dùng</h3><div class="supplies">${supplies}</div><div class="supplies">${gemRow}</div>
 <h3>Bạn đồng hành</h3><div class="items">${dg.companions.map(c=>`<div class="item" style="--rarity:#cfe8ff"><b>${c.name}</b><small>${c.id==='na'?'Ném kẹo · cổ vũ khi bạn sợ':'Rọi điện thoại · đánh hơi con dấu, chìa khóa'}</small><span>Tin tưởng ${Math.round(c.trust)}/100</span><span>${c.state==='away'?`Đang nghỉ ngoài cửa (${Math.ceil(c.awayT)} giây)`:`Can đảm ${Math.max(0,Math.round(c.courage))}/${dg.companionMax()}`}</span></div>`).join('')}</div>
 <p class="stats-line">Mảnh vé 000: ${dg.fragments.length}/3${dg.zinState==='staff'?' · Zin là nhân viên, gọi được mỗi tầng':dg.zinState==='gone'?' · Zin đã được đóng mộc vé':dg.fragments.length?' · gọi Zin một lần mỗi tầng (Z)':''}</p>
 <div class="dialog-actions"><button data-open="tree">Cây kỹ năng${dg.skillPoints?` · ${dg.skillPoints} điểm chưa dùng`:''}</button><button id="resume">Quay lại hầm</button></div>`;
}
// Forge rows for a list of [key, item, where]: upgrade and identify buttons. Used in the dungeon shop and in town.
function forgeHtml(rows,gold,upAttr,idAttr,flash){
 return rows.map(([key,it,where])=>{const plus=it.plus||0,cost=upgradeCost(it),chance=Math.round(upgradeChance(plus)*100);
  const up=it.unid?'':plus>=MAX_PLUS?'<button disabled>Tối đa +10</button>':`<button data-${upAttr}="${key}" ${gold<cost?'disabled':''}>Nâng lên +${plus+1} · ${cost} xu · ${chance}%${plus>=5?' · hỏng thì tụt 1':''}</button>`;
  const id=it.unid?`<button data-${idAttr}="${key}" ${gold<identifyCost(it)?'disabled':''}>Giám định · ${identifyCost(it)} xu</button>`:'';
  return itemCard(it,`${flash?.key===key?`<p class="forge-msg">${esc(flash.text)}</p>`:''}<div class="item-actions">${up}${id}</div><small class="where">${where}</small>`);}).join('');
}
const forgeRows=(equipped,inventory)=>[...Object.entries(equipped).filter(([,it])=>it).map(([k,it])=>['e:'+k,it,'Đang mặc']),...inventory.map((it,i)=>['i:'+i,it,'Trong túi'])];
export function shopHtml(dg,{msg=''}={}){
 const g=dg.p.gold;
 return`<span class="eyebrow">QUẦY MR. D · TRẠM NGHỈ TẦNG ${dg.depth}</span><h2>Bạn có ${g} xu</h2>${typeof msg==='string'&&msg?`<p class="forge-msg">${esc(msg)}</p>`:''}
 <h3>Đồ dùng</h3><div class="dialog-actions">${Object.entries(SUPPLIES).map(([k,s])=>`<button data-buy="${k}" ${g<s.price?'disabled':''}><img class="btn-icon" src="${iconUrl(SUPPLY_ICON[k])}" alt="">${s.name} · ${s.price} xu · có ${dg.potions[k]||0}<small>${esc(s.text)}</small></button>`).join('')}</div>
 <h3>Lò rèn: nâng cấp và giám định</h3><div class="items">${forgeHtml(forgeRows(dg.equipped,dg.inventory),g,'up','ident',msg)}</div>
 <h3>Bán đồ trong túi</h3><div class="dialog-actions"><button data-junk="1" ${dg.inventory.some(i=>i.rarity==='common')?'':'disabled'}>Bán hết đồ Thường</button><button data-respec="1" ${g<RESPEC_COST||!Object.keys(dg.tree).length?'disabled':''}>Tẩy điểm kỹ năng · ${RESPEC_COST} xu</button></div>
 <div class="items">${dg.inventory.map((it,i)=>itemCard(it,`<div class="item-actions"><button data-sell="${i}">Bán · ${dg.sellValue(it)} xu</button></div>`)).join('')||'<p>Không có gì để bán.</p>'}</div>
 <div class="dialog-actions"><button id="resume">Quay lại hầm</button></div>`;
}

// Skill tree dialog: two columns, top to bottom. `level` and `tree` come from the running dungeon.
export function treeHtml({level,tree}){
 const pts=skillPoints(level,tree);
 const col=b=>SKILL_TREE.filter(n=>n.branch===b).map(n=>{const r=rank(tree,n.id),why=canLearn(level,tree,n.id);return`<div class="node${r?' learned':''}${why==='locked'?' locked':''}"><b>${esc(n.name)} <small>${r}/${n.max}</small></b><span>${esc(n.text(Math.max(1,r)))}</span>${why===null?`<button data-learn="${n.id}">Học (+1)</button>`:why==='locked'?'<small>Cần học ô phía trên trước</small>':''}</div>`;}).join('');
 return`<span class="eyebrow">CÂY KỸ NĂNG · CẤP ${level}</span><h2>${pts} điểm chưa dùng</h2><p>Mỗi cấp được 1 điểm. Tẩy điểm ở quầy Mr. D (${RESPEC_COST} xu).</p><div class="tree">${Object.entries(BRANCHES).map(([b,name])=>`<div class="branch"><h3>${name}</h3>${col(b)}</div>`).join('')}</div><div class="dialog-actions"><button id="resume">Quay lại hầm</button></div>`;
}
// Town hub between descents, working on the saved character.
export function townHtml(character,name,{msg=''}={}){
 const town=character.town,kinds={stand:'Nâng cấp quầy',costume:'Trang phục',gadget:'Đồ chơi của Bơ'};
 const card=t=>{const price=townPrice(town,t.id),lvl=town.stand[t.id]||0,owned=t.kind==='costume'?town.costumes.includes(t.id):t.kind==='gadget'&&town.gadgets.includes(t.id);
  const status=t.kind==='stand'?`Cấp ${lvl}/${t.levels.length}`:owned?(town.costume===t.id?'Đang mặc':'Đã có'):'';
  const btn=t.kind==='costume'&&owned?`<button data-town="${t.id}">${town.costume===t.id?'Cởi ra':'Mặc'}</button>`:price==null?'':`<button data-town="${t.id}" ${character.gold<price?'disabled':''}>Mua · ${price} xu</button>`;
  return`<div class="item" style="--rarity:#e7c083"><b>${esc(t.name)}</b><small>${status}</small><span>${esc(t.text(Math.max(1,lvl+(t.kind==='stand'&&price!=null?1:0))))}</span><div class="item-actions">${btn}</div></div>`;};
 return`<span class="eyebrow">QUẦY MR. D · GIỮA HAI CHUYẾN</span><h2>${esc(name)} có ${character.gold||0} xu</h2>${typeof msg==='string'&&msg?`<p class="forge-msg">${esc(msg)}</p>`:''}<p>Mua sắm ở đây được giữ cho mọi chuyến xuống hầm sau.${character.checkpoint>1?` Chuyến sau xuất phát từ trạm nghỉ tầng ${character.checkpoint}.`:''}</p><h3>Đồ dùng mang theo</h3><div class="dialog-actions">${Object.entries(SUPPLIES).map(([k,s])=>`<button data-tbuy="${k}" ${(character.gold||0)<s.price?'disabled':''}><img class="btn-icon" src="${iconUrl(SUPPLY_ICON[k])}" alt="">${s.name} · ${s.price} xu · có ${character.potions?.[k]||0}</button>`).join('')}</div><h3>Lò rèn</h3><div class="items">${forgeHtml(forgeRows(character.equipped||{},character.inventory||[]),character.gold||0,'tup','tident',msg)||'<p>Chưa có đồ.</p>'}</div>${Object.entries(kinds).map(([k,label])=>`<h3>${label}</h3><div class="items">${TOWN.filter(t=>t.kind===k).map(card).join('')}</div>`).join('')}<div class="dialog-actions"><button data-respec="town" ${(character.gold||0)<RESPEC_COST||!Object.keys(character.tree||{}).length?'disabled':''}>Tẩy điểm kỹ năng · ${RESPEC_COST} xu</button><button id="resume">Xong</button></div>`;
}

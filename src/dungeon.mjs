// Hầm Ma: the action-RPG visitor mode. Procedural floors, packs of ghost performers, loot, levels.
// "Fighting" means breaking a performer's act: knock their Composure to 0 and they crack up laughing,
// drop what they carry and leave. Running out of Courage never kills you, but Mr. D carries you out and
// everything you found on this descent and didn't put on stays behind: go deeper, or go home with a
// Vé về. No browser dependencies, so the rules can be tested headless.

import {rank,skillPoints,learn,RESPEC_COST,SETS,setBonuses,costumeStat,hasGadget,emptyTown,FRAGMENT_CHANCE,ZIN_DURATION,GEMS,emptyGems,socketsFor,SUPPLIES,isRestStop,identifyItem} from './progression.mjs';

export const TILE=32;
export const MAP_W=64;
export const MAP_H=44;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
export function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

// Each floor rolls its look at random; boss floors are always hell. The boss rotates by act of three floors.
export const THEMES=[
 {id:'catacomb',name:'Hầm Mộ'},
 {id:'cemetery',name:'Nghĩa Địa'},
 {id:'dining',name:'Phòng Ăn'},
 {id:'corridor',name:'Hành Lang'},
];
export const HELL={id:'hell',name:'Địa Ngục'};
export const ACT_BOSSES=['zombie','vampire','neck'];
export const bossFor=depth=>ACT_BOSSES[Math.floor((depth-1)/3)%ACT_BOSSES.length];
export const themeFor=(depth,seed)=>isBossFloor(depth)?HELL:THEMES[Math.floor(rng(seed^0x5bd1e995)()*THEMES.length)];
export const isBossFloor=depth=>depth%3===0;

// ---- Floor generation: rooms on a tile grid joined by two-tile-wide corridors.
// Tile values: 0 wall, 1 floor, 2 closed door (blocks walking and sight until opened).
export const DOOR=2;
// Every floor has a stamp (con dấu) that unseals the stairs and an optional bronze key. On boss
// floors the boss room is a dead end behind one locked door that only a key opens.
export function generateFloor(depth,seed){
 for(let attempt=0;attempt<60;attempt++){const f=buildFloor(depth,seed+attempt*7919);if(f)return f;}
 throw Error(`could not generate floor ${depth}`);
}
function buildFloor(depth,seed){
 const rand=rng(seed),tiles=new Uint8Array(MAP_W*MAP_H),rooms=[],boss=isBossFloor(depth);
 const ri=(a,b)=>a+Math.floor(rand()*(b-a+1));
 for(let tries=0;tries<300&&rooms.length<13;tries++){
  const w=ri(7,13),h=ri(6,10),x=ri(2,MAP_W-w-3),y=ri(2,MAP_H-h-3);
  if(rooms.some(r=>x<r.x+r.w+3&&x+w+3>r.x&&y<r.y+r.h+3&&y+h+3>r.y))continue;
  rooms.push({x,y,w,h,cx:x+Math.floor(w/2),cy:y+Math.floor(h/2)});
 }
 if(rooms.length<6)return null;
 const carve=(x,y)=>{if(x>0&&y>0&&x<MAP_W-1&&y<MAP_H-1)tiles[y*MAP_W+x]=1;};
 for(const r of rooms)for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++)carve(x,y);
 const corridor=(a,b)=>{
  const horizontalFirst=rand()<.5;let x=a.cx,y=a.cy;
  const stepX=()=>{while(x!==b.cx){carve(x,y);carve(x,y+1);x+=Math.sign(b.cx-x);}};
  const stepY=()=>{while(y!==b.cy){carve(x,y);carve(x+1,y);y+=Math.sign(b.cy-y);}};
  if(horizontalFirst){stepX();stepY();}else{stepY();stepX();}carve(x,y);carve(x+1,y+1);
 };
 const gap=(i,j)=>Math.hypot(rooms[i].cx-rooms[j].cx,rooms[i].cy-rooms[j].cy);
 // On boss floors the room furthest from the start is kept out of the tree and joined by one corridor.
 let bossRoom=-1;if(boss){bossRoom=1;for(let i=2;i<rooms.length;i++)if(gap(0,i)>gap(0,bossRoom))bossRoom=i;}
 const others=rooms.map((_,i)=>i).filter(i=>i!==bossRoom),linked=[0],edges=[];
 // Minimum spanning tree over room centres, plus a couple of loops so floors are not pure trees.
 while(linked.length<others.length){let best=null;for(const i of linked)for(const j of others){if(linked.includes(j))continue;const d=gap(i,j);if(!best||d<best.d)best={i,j,d};}linked.push(best.j);edges.push([best.i,best.j]);}
 for(let k=0;k<2;k++){const i=others[ri(0,others.length-1)],j=others[ri(0,others.length-1)];if(i!==j)edges.push([i,j]);}
 if(boss){let near=others[0];for(const j of others)if(gap(bossRoom,j)<gap(bossRoom,near))near=j;edges.push([near,bossRoom]);}
 for(const [i,j] of edges)corridor(rooms[i],rooms[j]);
 const floor={depth,seed,tiles,rooms,theme:themeFor(depth,seed),boss:bossFor(depth),bossRoom,doorOpen:!boss};
 const tileOf=r=>r.cy*MAP_W+r.cx,center=r=>({x:(r.cx+.5)*TILE,y:(r.cy+.5)*TILE});
 if(boss){
  // The door is every edge tile of the boss room that opens onto floor outside it.
  const r=rooms[bossRoom],inside=(x,y)=>x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h,door=[];
  for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++){if(x!==r.x&&x!==r.x+r.w-1&&y!==r.y&&y!==r.y+r.h-1)continue;if([[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>!inside(x+dx,y+dy)&&tiles[(y+dy)*MAP_W+x+dx]===1))door.push(y*MAP_W+x);}
  if(door.length<1||door.length>4)return null;
  for(const i of door)tiles[i]=DOOR;
  const field=flowField(floor,rooms[0].cx,rooms[0].cy);
  if(others.some(i=>field[tileOf(rooms[i])]<0)||field[tileOf(r)]>=0)return null;
  floor.door={tiles:door,x:door.reduce((s,i)=>s+(i%MAP_W+.5)*TILE,0)/door.length,y:door.reduce((s,i)=>s+(Math.floor(i/MAP_W)+.5)*TILE,0)/door.length};
  floor.stairsRoom=bossRoom;
 }else{
  // The stairs go in the room furthest (by walking distance) from the start room.
  const field=flowField(floor,rooms[0].cx,rooms[0].cy);
  if(rooms.some(r=>field[tileOf(r)]<0))return null;
  let far=1;for(let i=1;i<rooms.length;i++)if(field[tileOf(rooms[i])]>field[tileOf(rooms[far])])far=i;
  floor.stairsRoom=far;
 }
 // Stamp in a room about halfway out; key in the furthest room left over (on boss floors: the fallback key).
 const field=flowField(floor,rooms[0].cx,rooms[0].cy),spare=others.filter(i=>i!==0&&i!==floor.stairsRoom).sort((a,b)=>field[tileOf(rooms[a])]-field[tileOf(rooms[b])]);
 if(spare.length<2)return null;
 const spot=i=>{const r=rooms[i];return{x:(r.x+1.5+rand()*(r.w-3))*TILE,y:(r.y+1.5+rand()*(r.h-3))*TILE};};
 floor.keyRoom=spare[spare.length-1];floor.key=spot(floor.keyRoom);
 if(!boss){floor.stampRoom=spare[Math.floor((spare.length-1)/2)];floor.stamp=spot(floor.stampRoom);}
 floor.start=center(rooms[0]);floor.exitUp={x:floor.start.x-48,y:floor.start.y-40};
 const sr=rooms[floor.stairsRoom];floor.stairs=boss?{x:(sr.x+sr.w-1.5)*TILE,y:(sr.y+1.5)*TILE}:center(sr);
 return floor;
}

export const isFloor=(f,tx,ty)=>tx>=0&&ty>=0&&tx<MAP_W&&ty<MAP_H&&f.tiles[ty*MAP_W+tx]===1;
export function floorPassable(f,x,y,r=11){for(let ty=Math.floor((y-r)/TILE);ty<=Math.floor((y+r)/TILE);ty++)for(let tx=Math.floor((x-r)/TILE);tx<=Math.floor((x+r)/TILE);tx++)if(!isFloor(f,tx,ty))return false;return true;}
export function lineOfSight(f,a,b){const n=Math.ceil(dist(a,b)/10);for(let i=1;i<n;i++){const x=a.x+(b.x-a.x)*i/n,y=a.y+(b.y-a.y)*i/n;if(!isFloor(f,Math.floor(x/TILE),Math.floor(y/TILE)))return false;}return true;}
// Breadth-first walking distance (in tiles) from one tile to every floor tile; -1 where unreachable.
export function flowField(f,sx,sy){
 const d=new Int16Array(MAP_W*MAP_H).fill(-1),q=[sy*MAP_W+sx];d[q[0]]=0;
 for(let i=0;i<q.length;i++){const c=q[i],x=c%MAP_W,y=(c-x)/MAP_W;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,n=ny*MAP_W+nx;if(isFloor(f,nx,ny)&&d[n]<0){d[n]=d[c]+1;q.push(n);}}}
 return d;
}
function moveCircle(f,a,dx,dy){let moved=false;if(dx&&floorPassable(f,a.x+dx,a.y,a.r)){a.x+=dx;moved=true;}if(dy&&floorPassable(f,a.x,a.y+dy,a.r)){a.y+=dy;moved=true;}return moved;}

// ---- Performers
export const ENEMIES={
 sheet:{name:'Ma Vải',hp:30,dmg:6,speed:72,range:34,cd:1.3,windup:.45,xp:8,r:12,from:1},
 skeleton:{name:'Bộ Xương',hp:18,dmg:5,speed:118,range:30,cd:.9,windup:.3,xp:7,r:11,from:2},
 lantern:{name:'Ma Đèn Lồng',hp:22,dmg:7,speed:62,range:200,cd:2.2,windup:.6,xp:10,r:12,from:2,ranged:true},
 zombie:{name:'Xác Sống',hp:340,dmg:14,speed:55,range:85,cd:2.4,windup:.9,xp:120,r:16,boss:true},
 vampire:{name:'Ma Cà Rồng',hp:380,dmg:12,speed:88,range:40,cd:1.4,windup:.45,xp:140,r:15,boss:true},
 neck:{name:'Ma Cổ Dài',hp:340,dmg:10,speed:70,range:0,cd:2.6,windup:1,xp:150,r:15,boss:true},
};
const scaleFor=depth=>1+(depth-1)*.22;

// ---- Loot
export const RARITY=[
 {id:'common',name:'Thường',affixes:0,weight:60},
 {id:'magic',name:'Xịn',affixes:2,weight:28},
 {id:'rare',name:'Hiếm',affixes:3,weight:10},
 {id:'legendary',name:'Huyền thoại',affixes:4,weight:2},
];
export const SLOTS={
 // `body` is where it is worn, shown on the gear screen so players know what goes where.
 hat:{label:'Mũ',body:'Đầu',bases:['Mũ lưỡi trai','Mũ len','Nón lá']},
 charm:{label:'Dây chuyền',body:'Cổ',bases:['Bùa hộ mệnh','Dây chuyền','Mặt dây ngọc']},
 badge:{label:'Huy hiệu',body:'Ngực',bases:['Huy hiệu','Ghim cài','Thẻ nhân viên']},
 torch:{label:'Đèn',body:'Tay',bases:['Đèn pin','Đèn đội đầu','Đèn bão']},
 coat:{label:'Áo',body:'Thân',bases:['Áo khoác','Áo mưa','Áo hoodie']},
 bag:{label:'Túi',body:'Lưng',bases:['Ba lô','Túi đeo chéo','Túi vải']},
 shoes:{label:'Giày',body:'Chân',bases:['Giày bata','Dép tổ ong','Giày thể thao']},
};
const AFFIXES={
 dmgPct:{label:v=>`+${v}% sát thương`,roll:(r,l)=>Math.round(5+r()*8+l),word:'Chói Lóa'},
 crit:{label:v=>`+${v}% chí mạng`,roll:(r)=>Math.round(2+r()*5),word:'Sắc Lẹm'},
 courage:{label:v=>`+${v} can đảm tối đa`,roll:(r,l)=>Math.round(8+r()*12+l*2),word:'Gan Dạ'},
 armor:{label:v=>`+${v} giáp`,roll:(r,l)=>Math.round(4+r()*8+l*1.5),word:'Dày Cộm'},
 battery:{label:v=>`+${v} pin tối đa`,roll:(r,l)=>Math.round(8+r()*12+l),word:'Bền Bỉ'},
 regen:{label:v=>`+${v} pin/giây`,roll:(r)=>Math.round(1+r()*2),word:'Sạc Nhanh'},
 speed:{label:v=>`+${v}% tốc chạy`,roll:(r)=>Math.round(3+r()*5),word:'Nhanh Nhẹn'},
 gold:{label:v=>`+${v}% xu nhặt được`,roll:(r)=>Math.round(10+r()*20),word:'Hên Xui'},
 onBreak:{label:v=>`+${v} can đảm mỗi lần hạ màn`,roll:(r)=>Math.round(2+r()*3),word:'Lạc Quan'},
 // Conditional affixes, Greedy Cave style: only on Hiếm and Huyền thoại items, at most one each.
 lastStand:{label:v=>`+${v}% sát thương khi can đảm dưới 30%`,roll:(r)=>Math.round(20+r()*20),word:'Liều Mạng',cond:true},
 firstHit:{label:v=>`+${v}% sát thương lên diễn viên còn nguyên bình tĩnh`,roll:(r)=>Math.round(30+r()*30),word:'Mở Màn',cond:true},
 lowCrit:{label:()=>'Chí mạng 100% khi can đảm dưới 20%',roll:()=>1,word:'Phán Xét',cond:true,legendary:true},
};
const LEGENDARY_NAMES={torch:'Đèn pin của Mr. D',coat:'Áo mưa Bơ để quên',charm:'Kẹp tóc của Na',shoes:'Dép tổ ong thần tốc',hat:'Mũ bảo hiểm của Mr. D',bag:'Ba lô không đáy',badge:'Thẻ nhân viên số 1'};
const BASE_STAT={torch:l=>({dmg:4+Math.round(l*1.6)}),coat:l=>({armor:5+l*3}),charm:l=>({battery:10+l*2}),shoes:l=>({speed:4+Math.min(10,Math.floor(l/2))}),hat:l=>({courage:10+l*3}),bag:l=>({gold:10+l*2}),badge:l=>({crit:2+Math.floor(l/3)})};

export function makeItem(rand,ilvl,bias=0,slot=null){
 const slots=Object.keys(SLOTS);slot=slot||slots[Math.floor(rand()*slots.length)];
 let rarity=RARITY[0];
 // Weighted pick, shifted toward better rarities by `bias` (elites and bosses).
 const weights=RARITY.map((r,i)=>r.weight*(i?1+bias*i:Math.max(.2,1-bias)));let pick=rand()*weights.reduce((a,b)=>a+b,0);
 for(let i=0;i<RARITY.length;i++){pick-=weights[i];if(pick<=0){rarity=RARITY[i];break;}}
 const base=BASE_STAT[slot](ilvl),stats={...base},pool=Object.keys(AFFIXES).filter(k=>!AFFIXES[k].cond),affixes=[];
 const conds=Object.keys(AFFIXES).filter(k=>AFFIXES[k].cond&&(!AFFIXES[k].legendary||rarity.id==='legendary'));
 for(let i=0;i<rarity.affixes;i++){const cond=i===rarity.affixes-1&&(rarity.id==='legendary'||rarity.id==='rare'&&rand()<.5);const from=cond?conds:pool;const k=from.splice(Math.floor(rand()*from.length),1)[0];const v=AFFIXES[k].roll(rand,ilvl);stats[k]=(stats[k]||0)+v;affixes.push([k,v]);}
 const style=Math.floor(rand()*SLOTS[slot].bases.length),baseName=SLOTS[slot].bases[style];
 const name=rarity.id==='legendary'?LEGENDARY_NAMES[slot]:affixes.length?`${baseName} ${AFFIXES[affixes[0][0]].word}`:baseName;
 const value=Math.round((6+ilvl*3)*(1+RARITY.indexOf(rarity)*1.5));
 return{slot,style,rarity:rarity.id,rarityName:rarity.name,name,ilvl,stats,base,affixes:affixes.map(([k,v])=>AFFIXES[k].label(v)),value};
}
// A boss set piece: its theme's named item for a slot, with two affixes.
export function makeSetItem(rand,ilvl,setId,slot=null){
 const set=SETS[setId],slots=Object.keys(set.pieces);slot=slot||slots[Math.floor(rand()*slots.length)];
 const base=BASE_STAT[slot](ilvl),stats={...base},pool=Object.keys(AFFIXES).filter(k=>!AFFIXES[k].cond),affixes=[];
 for(let i=0;i<2;i++){const k=pool.splice(Math.floor(rand()*pool.length),1)[0];const v=AFFIXES[k].roll(rand,ilvl);stats[k]=(stats[k]||0)+v;affixes.push(AFFIXES[k].label(v));}
 return{slot,rarity:'set',rarityName:'Bộ',name:set.pieces[slot],set:setId,setName:set.name,setText:set.text,ilvl,stats,base,affixes,value:Math.round((6+ilvl*3)*5)};
}
export const describeBase=item=>({torch:b=>`${b.dmg} sát thương`,coat:b=>`${b.armor} giáp`,charm:b=>`+${b.battery} pin tối đa`,shoes:b=>`+${b.speed}% tốc chạy`,hat:b=>`+${b.courage} can đảm tối đa`,bag:b=>`+${b.gold}% xu nhặt được`,badge:b=>`+${b.crit}% chí mạng`})[item.slot](item.base);

// ---- Skills
export const SKILLS={
 flash:{name:'Rọi đèn',cost:0,cd:.5,level:1},
 candy:{name:'Ném kẹo',cost:8,cd:.35,level:1},
 bell:{name:'Chuông đồng',cost:22,cd:6,level:3},
 spotlight:{name:'Đèn sân khấu',cost:40,cd:12,level:5},
 dash:{name:'Lướt',cost:0,cd:3.5,level:1},
};
function makeCompanion(id){return id==='na'?{id,name:'Na',sprite:1,x:0,y:0,r:11,face:0,moving:false,courage:60,state:'follow',awayT:0,cd:1,cd2:0,trust:50,farT:0,calledOut:false,hurt:0,offset:{x:-34,y:20}}:{id,name:'Bơ',sprite:2,x:0,y:0,r:11,face:0,moving:false,courage:60,state:'follow',awayT:0,cd:2,cd2:8,trust:50,farT:0,calledOut:false,hurt:0,offset:{x:34,y:20}};}
// Screen-up is north. Used for Bơ's hints.
const compass=(a,b)=>{const ang=Math.atan2(b.y-a.y,b.x-a.x),dirs=['phía đông','phía đông nam','phía nam','phía tây nam','phía tây','phía tây bắc','phía bắc','phía đông bắc'];return dirs[(Math.round(ang/(Math.PI/4))+8)%8];};
export const xpForLevel=l=>Math.round(40*Math.pow(l,1.6));

export class Dungeon{
 constructor(seed=Date.now()%100000){
  this.seed=seed;this.rand=rng(seed*7+3);this.time=0;this.ending=null;this.bubble=null;this.floaters=[];this.effects=[];
  this.p={x:0,y:0,r:11,face:0,moving:false,level:1,xp:0,gold:0,courage:100,battery:100,dash:0,dashDir:0,hurt:0,path:[],target:null,pickTarget:null};
  this.potions={bread:2,battery:1,ticket:1,lens:0};this.keys=0;this.gems=emptyGems();this.runGold=0;this.lost=null;this.checkpoint=1;
  this.companions=[makeCompanion('na'),makeCompanion('bo')];this.inventory=[];this.equipped={torch:null,coat:null,charm:null,shoes:null,hat:null,bag:null,badge:null};
  this.tree={};this.town=emptyTown();this.fragments=[];this.zinState=null;this.zinFloorDone=false;this.zin=null;this.zinUsed=false;this.autoAttack=false;
  this.cooldowns={flash:0,candy:0,bell:0,spotlight:0,dash:0,potion:0};
  this.stats={defeated:0,deepest:1,knockouts:0,bosses:0};
  this.equipped.torch={slot:'torch',rarity:'common',rarityName:'Thường',name:'Đèn pin cũ',ilvl:1,stats:{dmg:4},base:{dmg:4},affixes:[],value:3};
  this.enterFloor(1);
  this.notice('Mr. D: Mỗi tầng có một con dấu, tìm được thì cầu thang mới mở. Thấy chìa khóa đồng thì giữ lấy: phòng trùm chỉ mở bằng nó.');
 }
 notice(text){this.bubble={text,until:this.time+4.5};}
 float(x,y,text,color='#ffe5ad',size=13,life=1.1){this.floaters.push({x,y,text,color,size,life,until:this.time+life});}
 say(c,text){this.float(c.x,c.y-100,`${c.name}: ${text}`,'#cfe8ff',11,2.6);}
 // ---- Derived stats from level and equipment.
 get derived(){
  const s={dmg:0,dmgPct:0,crit:5,courage:0,armor:0,battery:0,regen:0,speed:0,gold:0,onBreak:0,lastStand:0,firstHit:0,lowCrit:0,leech:0,dashCd:0};
  for(const it of Object.values(this.equipped))if(it)for(const [k,v] of Object.entries(it.stats))s[k]=(s[k]||0)+v;
  for(const [k,v] of Object.entries(setBonuses(this.equipped).bonus))s[k]+=v;
  for(const [k,v] of Object.entries(costumeStat(this.town)))s[k]+=v;
  const t=this.tree;s.dmgPct+=8*rank(t,'beam');s.battery+=15*rank(t,'cells');s.regen+=rank(t,'cells');s.armor+=8*rank(t,'together');
  const l=this.p.level;
  return{
   damage:(6+s.dmg)*(1+s.dmgPct/100)*(1+0.05*(l-1)),crit:s.crit/100,
   maxCourage:100+10*(l-1)+s.courage,armor:s.armor,maxBattery:100+s.battery,regen:5+s.regen,
   speed:150*(1+s.speed/100),goldPct:s.gold/100,onBreak:s.onBreak,
   lastStand:s.lastStand,firstHit:s.firstHit,lowCrit:s.lowCrit>0,leech:s.leech,dashCd:s.dashCd,
  };
 }
 get skillPoints(){return skillPoints(this.p.level,this.tree);}
 learnSkill(id){const why=learn(this.p.level,this.tree,id);if(!why){const d=this.derived;this.p.battery=Math.min(this.p.battery,d.maxBattery);}return why;}
 respec(){if(!this.vendor||dist(this.vendor,this.p)>80)return'vendor';if(this.p.gold<RESPEC_COST)return'gold';this.p.gold-=RESPEC_COST;this.tree={};const d=this.derived;this.p.battery=Math.min(this.p.battery,d.maxBattery);return null;}
 // Called when a new descent starts (not when continuing one): Mr. D's stand packs snacks.
 startDescent(){this.potions.bread+=this.town.stand.bread||0;this.potions.battery+=this.town.stand.battery||0;}
 enterFloor(depth){
  this.depth=depth;this.stats.deepest=Math.max(this.stats.deepest,depth);
  this.floor=generateFloor(depth,this.seed*31+depth);
  const f=this.floor,st=f.start;Object.assign(this.p,{x:st.x,y:st.y,path:[],target:null,pickTarget:null});
  this.explored=new Uint8Array(MAP_W*MAP_H);this.reveal();
  for(const c of this.companions)this.regroup(c,true);
  this.enemies=[];this.projectiles=[];this.drops=[];this.marks=[];this.effects=[];this.floaters=[];this.field=null;this.fieldAt=-1;this.nextId=1;
  this.stampFound=false;this.bossBroken=false;this.zin=null;this.zinUsed=false;
  this.vendor=isRestStop(depth)?{x:st.x+70,y:st.y-30}:null;if(isRestStop(depth))this.checkpoint=Math.max(this.checkpoint,depth);
  const scale=scaleFor(depth),theme=f.theme,boss=isBossFloor(depth);
  // The key only appears on a boss floor if you arrive without one, so you can never be stuck.
  const keyHere=!boss||this.keys===0;
  f.rooms.forEach((room,i)=>{
   if(i===0)return;
   if(i===f.bossRoom){this.spawn(f.boss,(room.cx-1.5)*TILE,(room.cy+.5)*TILE,scale);return;}
   // The rooms holding the stamp and the key are guarded harder.
   const guarded=i===f.stampRoom||i===f.keyRoom&&keyHere,keyRoom=i===f.keyRoom&&keyHere;
   const pack=2+Math.floor(this.rand()*3)+Math.min(3,Math.floor(depth/3))+(keyRoom?2:0);
   const kinds=Object.entries(ENEMIES).filter(([,e])=>!e.boss&&e.from<=depth).map(([k])=>k);
   const elite=guarded||this.rand()<.12+depth*.01;
   for(let n=0;n<pack;n++){
    const x=(room.x+1+this.rand()*(room.w-2))*TILE,y=(room.y+1+this.rand()*(room.h-2))*TILE;
    if(floorPassable(f,x,y,12))this.spawn(kinds[Math.floor(this.rand()*kinds.length)],x,y,scale,elite&&(n===0||keyRoom&&n===1));
   }
  });
  if(f.stamp){this.drops.push({id:this.nextId++,kind:'quest',quest:'stamp',x:f.stamp.x,y:f.stamp.y});if(this.town.stand.map)this.revealAround(f.stamp,1);}
  if(keyHere)this.drops.push({id:this.nextId++,kind:'quest',quest:'key',x:f.key.x,y:f.key.y});
  this.float(st.x,st.y-60,`TẦNG ${depth} · ${theme.name.toUpperCase()}`,'#a0ead4',16);
  if(!boss)this.notice(`Tầng ${depth}: cầu thang bị niêm phong. Tìm con dấu tầng để mở. Chìa khóa đồng thì tùy, nhưng phòng trùm chỉ mở bằng nó.`);
  else if(this.keys>0)this.notice(`Tầng ${depth}: ${ENEMIES[f.boss].name} ở sau cánh cửa khóa. Bạn có ${this.keys} chìa khóa đồng.`);
  else this.notice(`Tầng ${depth}: phòng trùm khóa mà bạn chưa có chìa. Mr. D: “Hình như có đứa đánh rơi một chiếc ở tầng này… chỗ đó đông diễn viên lắm.”`);
 }
 // Stairs open with the floor stamp, or on a boss floor once the boss is broken.
 get stairsLocked(){return isBossFloor(this.depth)?!this.bossBroken:!this.stampFound;}
 openDoor(){const f=this.floor;for(const i of f.door.tiles)f.tiles[i]=1;f.doorOpen=true;this.fieldAt=-1;this.effects.push({kind:'ring',x:f.door.x,y:f.door.y,r:60,color:'#ffd36b',until:this.time+.5});}
 spawn(type,x,y,scale,elite=false){
  const e=ENEMIES[type],hp=Math.round(e.hp*scale*(elite?2.5:1));
  const m={id:this.nextId++,type,name:elite?`${e.name} Ngôi Sao`:e.name,x,y,r:e.r,hp,maxHp:hp,dmg:e.dmg*scale*(elite?1.4:1),speed:e.speed*(elite?1.1:1),range:e.range,cdBase:e.cd,windupBase:e.windup,xp:Math.round(e.xp*scale*(elite?3:1)),elite,boss:!!e.boss,state:'idle',t:0,cd:1+this.rand(),face:0,stun:0,aggro:false,special:4,special2:7,home:{x,y}};
  this.enemies.push(m);return m;
 }
 revealAround(pt,r){const tx=Math.floor(pt.x/TILE),ty=Math.floor(pt.y/TILE);for(let y=ty-r;y<=ty+r;y++)for(let x=tx-r;x<=tx+r;x++)if(x>=0&&y>=0&&x<MAP_W&&y<MAP_H)this.explored[y*MAP_W+x]=1;}
 reveal(){const tx=Math.floor(this.p.x/TILE),ty=Math.floor(this.p.y/TILE);for(let y=ty-7;y<=ty+7;y++)for(let x=tx-8;x<=tx+8;x++)if(x>=0&&y>=0&&x<MAP_W&&y<MAP_H&&Math.hypot(x-tx,y-ty)<=7.5)this.explored[y*MAP_W+x]=1;}
 // ---- Player commands
 moveTo(x,y){if(this.ending)return;const f=this.floor,tx=Math.floor(x/TILE),ty=Math.floor(y/TILE);if(!isFloor(f,tx,ty))return;const field=flowField(f,tx,ty),path=[];let cx=Math.floor(this.p.x/TILE),cy=Math.floor(this.p.y/TILE);if(field[cy*MAP_W+cx]<0)return;
  for(let guard=0;guard<400&&field[cy*MAP_W+cx]>0;guard++){let best=null;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const v=field[(cy+dy)*MAP_W+cx+dx];if(v>=0&&(!best||v<best.v))best={x:cx+dx,y:cy+dy,v};}if(!best)break;cx=best.x;cy=best.y;path.push({x:(cx+.5)*TILE,y:(cy+.5)*TILE});}
  if(path.length)path[path.length-1]={x,y};this.p.path=path;this.p.target=null;this.p.pickTarget=null;}
 attackTarget(id){const e=this.enemies.find(e=>e.id===id&&e.state!=='defeated');if(e){this.p.target=e.id;this.p.path=[];this.p.pickTarget=null;}}
 pickUp(id){const d=this.drops.find(d=>d.id===id);if(!d)return;if(dist(d,this.p)<44)this.collect(d);else{this.moveTo(d.x,d.y);this.p.pickTarget=id;}}
 aimAt(point){if(point)this.p.face=Math.atan2(point.y-this.p.y,point.x-this.p.x);}
 skillReady(k){return this.p.level>=SKILLS[k].level&&this.cooldowns[k]<=0&&this.p.battery>=SKILLS[k].cost;}
 cast(k,point=null){
  if(this.ending)return false;const s=SKILLS[k],p=this.p;
  if(p.level<s.level){this.notice(`${s.name} mở ở cấp ${s.level}.`);return false;}
  if(this.cooldowns[k]>0)return false;
  if(p.battery<s.cost){this.notice('Hết pin. Uống pin AA (phím 2) hoặc đợi pin hồi.');return false;}
  this.aimAt(point);p.battery-=s.cost;const d=this.derived,t=this.tree;
  this.cooldowns[k]=s.cd-(k==='bell'?1.5*rank(t,'bigbell'):k==='spotlight'?3*rank(t,'stage'):k==='dash'?d.dashCd:0);
  if(k==='flash'){this.effects.push({kind:'cone',x:p.x,y:p.y,face:p.face,spread:.55,range:135,until:this.time+.18});this.hitCone(p.face,.55,135,d.damage,{knock:14,dazzle:.15*rank(t,'dazzle')});}
  else if(k==='candy'){this.projectiles.push({x:p.x,y:p.y-14,vx:Math.cos(p.face)*420,vy:Math.sin(p.face)*420,r:6,dmg:d.damage*1.6,owner:'player',life:.85,kind:'candy',pop:rank(t,'popcandy')>0,hue:Math.floor(this.rand()*4)});}
  else if(k==='bell'){const r=120*(1+.3*rank(t,'bigbell'));this.effects.push({kind:'ring',x:p.x,y:p.y,r,color:'#e9c577',until:this.time+.45});for(const e of this.live())if(dist(e,p)<r+e.r)this.damage(e,d.damage*1.2,{stun:1.5});}
  else if(k==='spotlight'){this.effects.push({kind:'cone',x:p.x,y:p.y,face:p.face,spread:.9,range:240,until:this.time+.5,strong:true});this.hitCone(p.face,.9,240,d.damage*3*(rank(t,'stage')?1.5:1),{stun:2,knock:30});}
  else if(k==='dash'){p.dash=.18;p.dashDir=p.face;p.path=[];p.target=null;}
  return true;
 }
 usePotion(kind){
  if(this.ending||this.cooldowns.potion>0)return false;
  if(!this.potions[kind]){this.notice({bread:'Hết bánh bao. Mua thêm ở quầy Mr. D.',battery:'Hết pin AA.',ticket:'Hết Vé về. Mr. D bán ở trạm nghỉ (60 xu).',lens:'Hết Kính lúp.'}[kind]);return false;}
  if(kind==='lens'){const it=this.inventory.find(i=>i.unid);if(!it){this.notice('Không có món nào cần giám định.');return false;}this.potions.lens--;identifyItem(null,it,{free:true});this.notice(`Kính lúp: đó là ${it.name} (${it.rarityName})!`);return true;}
  if(kind==='ticket'){this.potions.ticket--;this.finish('Vé về: Mr. D kéo bạn lên an toàn. Mọi thứ nhặt được đều giữ lại.');return true;}
  const d=this.derived;this.potions[kind]--;this.cooldowns.potion=1;
  if(kind==='bread'){this.p.courage=Math.min(d.maxCourage,this.p.courage+d.maxCourage*.45);this.float(this.p.x,this.p.y-70,'+can đảm','#f3889c');}
  else{this.p.battery=Math.min(d.maxBattery,this.p.battery+60);this.float(this.p.x,this.p.y-70,'+pin','#e7c083');}
  return true;
 }
 interact(){
  if(this.ending)return false;const p=this.p,f=this.floor;
  if(f.special==='zin'){
   if(dist(f.table,p)<56){this.finishZin('ticket');return true;}
   if(dist(f.roster,p)<56){this.finishZin('new');return true;}
   if(dist(f.exitUp,p)<46){this.finish();return true;}
   this.notice('Zin: “Còn một phòng nữa mà…” Đóng mộc vé ở bàn bên trái, hoặc ghi tên tui ở bảng phân ca bên phải.');return true;
  }
  const drop=this.drops.filter(d=>d.kind==='item').sort((a,b)=>dist(a,p)-dist(b,p))[0];
  if(drop&&dist(drop,p)<44){this.collect(drop);return true;}
  if(f.door&&!f.doorOpen&&dist(f.door,p)<72){
   if(!this.keys){this.notice('Cửa phòng trùm khóa chặt. Cần một chiếc chìa khóa đồng.');return true;}
   this.keys--;this.openDoor();this.notice(`Cạch! Chìa khóa đồng mở cửa phòng trùm.${this.keys?` Còn ${this.keys} chìa.`:''}`);return true;
  }
  if(dist(f.stairs,p)<46){
   if(this.stairsLocked){this.notice(isBossFloor(this.depth)?`Cầu thang khóa. Hạ màn ${ENEMIES[f.boss].name} trước.`:`Cầu thang bị niêm phong. Tìm con dấu tầng ${this.depth}.`);return true;}
   if(this.fragments.length>=3&&!this.zinFloorDone&&!this.zinState)this.enterZinFloor();else this.enterFloor(this.depth+1);return true;
  }
  if(dist(f.exitUp,p)<46){if(isRestStop(this.depth)){this.finish();return true;}this.notice('Thang lên bị sập ở tầng này. Dùng Vé về, hoặc tới trạm nghỉ của Mr. D (tầng 4, 7, 10…).');return true;}
  if(this.vendor&&dist(this.vendor,p)<56)return'shop';
  this.notice('Không có gì để dùng ở đây.');return false;
 }
 // Leaving safely banks everything found on this descent.
 bank(){for(const it of [...this.inventory,...Object.values(this.equipped)])if(it)delete it.found;this.runGold=0;}
 finish(text='Bạn leo lên khỏi hầm.'){this.bank();this.ending='dungeon';this.notice(text);}
 // ---- Zin (Khách Số 0)
 get canCallZin(){return this.fragments.length>0&&this.zinState!=='gone'&&!this.zinUsed&&!this.zin&&!this.ending&&this.floor.special!=='zin';}
 // Once per floor Zin steps in: full courage, a stun wave, then 12 s of help as strong as you, Na and Bơ together.
 callZin(){
  if(!this.canCallZin){if(this.zinUsed)this.notice('Zin đã giúp ở tầng này rồi.');else if(!this.fragments.length)this.notice('Cần ít nhất một mảnh vé 000 để gọi Zin.');return false;}
  const p=this.p,d=this.derived;this.zinUsed=true;this.zin={x:p.x+30,y:p.y-24,t:ZIN_DURATION,tick:0,face:0};
  p.courage=d.maxCourage;for(const c of this.companions)if(c.state!=='away')c.courage=this.companionMax();
  for(const e of this.live())if(dist(e,p)<220)e.stun=Math.max(e.stun,e.boss?.6:1.5);
  this.effects.push({kind:'ring',x:p.x,y:p.y,r:220,color:'#cfe8ff',until:this.time+.6});this.notice('Zin: “Có tui đây! Chơi tiếp đi!”');return true;
 }
 stepZin(dt){
  const z=this.zin;if(!z)return;z.t-=dt;z.tick-=dt;const p=this.p,f=this.floor;
  const tx=p.x+30,ty=p.y-24,gap=Math.hypot(tx-z.x,ty-z.y);if(gap>8){const a=Math.atan2(ty-z.y,tx-z.x),s=Math.min(gap,260*dt);z.x+=Math.cos(a)*s;z.y+=Math.sin(a)*s;z.face=a;}
  if(z.tick<=0){z.tick=.5;const d=this.derived,[na,bo]=this.companions,hit=d.damage*(1+.14*this.trustFactor(na)+.04*this.trustFactor(bo));
   for(const e of this.live())if(dist(e,z)<200&&lineOfSight(f,z,e)){this.damage(e,hit);this.effects.push({kind:'cone',x:z.x,y:z.y,face:Math.atan2(e.y-z.y,e.x-z.x),spread:.25,range:Math.min(200,dist(e,z)+20),until:this.time+.15});}}
  if(z.t<=0){this.zin=null;this.notice('Zin vẫy tay rồi tan vào bóng tối.');}
 }
 // A small hand-made floor: Zin at the stamping table, the staff roster on the other side.
 enterZinFloor(){
  const tiles=new Uint8Array(MAP_W*MAP_H),room={x:20,y:14,w:22,h:12,cx:31,cy:20};
  for(let y=room.y;y<room.y+room.h;y++)for(let x=room.x;x<room.x+room.w;x++)tiles[y*MAP_W+x]=1;
  const at=(tx,ty)=>({x:(tx+.5)*TILE,y:(ty+.5)*TILE});
  this.floor={depth:this.depth,seed:this.seed*31+999,tiles,rooms:[room],theme:{id:'dining',name:'Tầng 000'},special:'zin',bossRoom:-1,doorOpen:true,start:at(22,20),exitUp:at(21,16),stairs:{x:-9999,y:-9999},table:at(26,17),roster:at(37,17),zinSpot:at(31,21)};
  const f=this.floor;Object.assign(this.p,{x:f.start.x,y:f.start.y,path:[],target:null,pickTarget:null});
  this.explored=new Uint8Array(MAP_W*MAP_H).fill(1);for(const c of this.companions)this.regroup(c,true);
  this.enemies=[];this.projectiles=[];this.drops=[];this.marks=[];this.effects=[];this.floaters=[];this.fieldAt=-1;this.vendor=null;this.zin=null;
  this.float(f.start.x,f.start.y-60,'TẦNG 000','#cfe8ff',16);this.notice('Zin: “Còn một phòng nữa mà…” Vé 000 thiếu một dấu mộc cuối cùng.');
 }
 finishZin(choice){
  this.zinFloorDone=true;this.zinState=choice==='ticket'?'gone':'staff';this.bank();this.ending=choice;
  this.notice(choice==='ticket'?'Zin: “Lâu quá…” Dấu mộc cuối cùng. Zin mỉm cười rồi tan đi.':'Mr. D ghi vào bảng phân ca: “Đứa này khỏi cần phát đồng phục.”');
 }
 // ---- Inventory
 equip(item,silent=false){if(item.unid){if(!silent)this.notice('Món này chưa giám định. Dùng Kính lúp hoặc nhờ Mr. D.');return'unid';}delete item.found;const old=this.equipped[item.slot];this.equipped[item.slot]=item;const i=this.inventory.indexOf(item);if(i>=0)this.inventory.splice(i,1);if(old)this.inventory.push(old);const d=this.derived;this.p.courage=Math.min(this.p.courage,d.maxCourage);this.p.battery=Math.min(this.p.battery,d.maxBattery);if(!silent)this.notice(`Đã trang bị ${item.name}.`);}
 dropItem(item){const i=this.inventory.indexOf(item);if(i<0)return;this.inventory.splice(i,1);this.drops.push({id:this.nextId++,kind:'item',item,x:this.p.x+10,y:this.p.y+14});}
 sellValue(item){return item.unid?Math.round(item.value/2):item.value;}
 sell(item){const i=this.inventory.indexOf(item);if(i<0||!this.vendor||dist(this.vendor,this.p)>80)return false;this.inventory.splice(i,1);this.p.gold+=this.sellValue(item);return true;}
 sellJunk(){if(!this.vendor||dist(this.vendor,this.p)>80)return 0;const junk=this.inventory.filter(it=>it.rarity==='common');for(const it of junk)this.sell(it);return junk.length;}
 buy(kind){const price=SUPPLIES[kind]?.price;if(!price||!this.vendor||dist(this.vendor,this.p)>80||this.p.gold<price)return false;this.p.gold-=price;this.potions[kind]=(this.potions[kind]||0)+1;return true;}
 collect(d){
  const i=this.drops.indexOf(d);if(i<0)return;
  if(d.kind==='item'){if(this.inventory.length>=16){this.notice('Túi đầy. Mở túi (I) để vứt hoặc bán bớt.');return;}d.item.found=true;this.inventory.push(d.item);this.notice(d.item.unid?`Nhặt được món ${d.item.rarityName} chưa giám định!`:`Nhặt được ${d.item.name} (${d.item.rarityName}).`);}
  else if(d.kind==='quest'&&d.quest==='fragment'){this.fragments.push(d.theme);const n=this.fragments.length;this.float(d.x,d.y-24,`+ mảnh vé 000 (${n}/3)`,'#cfe8ff',13);
   this.notice(n===3?'Đủ ba mảnh vé 000! Cầu thang kế tiếp sẽ dẫn tới tầng của Khách Số 0.':n===1?'Mảnh vé 000 (1/3). Zin: “Cậu giữ vé của tui à? Khi nào cần, cứ gọi tui (phím Z).”':`Mảnh vé 000 (${n}/3). Zin đang đợi ở đâu đó dưới hầm.`);}
  else if(d.kind==='quest'){if(d.quest==='stamp'){this.stampFound=true;this.notice(`Có con dấu tầng ${this.depth}! Cầu thang xuống đã mở.`);}else{this.keys++;this.notice(`Nhặt được chìa khóa đồng (đang có ${this.keys}). Giữ lại để mở phòng trùm.`);}this.float(d.x,d.y-24,d.quest==='stamp'?'+ con dấu':'+ chìa khóa','#ffd36b',13);}
  else if(d.kind==='gem'){this.gems[d.gem]++;this.float(d.x,d.y-20,`+1 ${GEMS[d.gem].name}`,GEMS[d.gem].color,12);}
  else if(d.kind==='gold'){this.p.gold+=d.amount;this.runGold+=d.amount;this.float(d.x,d.y-20,`+${d.amount} xu`,'#e7c083',11);}
  else{this.potions[d.potion]=(this.potions[d.potion]||0)+1;this.float(d.x,d.y-20,`+1 ${SUPPLIES[d.potion].name.toLowerCase()}`,'#a0ead4',11);}
  this.drops.splice(i,1);
 }
 // ---- Combat
 live(){return this.enemies.filter(e=>e.state!=='defeated');}
 hitCone(face,spread,range,dmg,opts){for(const e of this.live()){const d=dist(e,this.p);if(d>range+e.r)continue;if(Math.abs(angleDiff(Math.atan2(e.y-this.p.y,e.x-this.p.x),face))>spread&&d>e.r+14)continue;if(!lineOfSight(this.floor,this.p,e))continue;this.damage(e,dmg,opts);}}
 damage(e,amount,{stun=0,knock=0,dazzle=0}={}){
  if(e.state==='defeated')return;
  const d=this.derived,c=this.p.courage/d.maxCourage;let mult=1;
  if(d.lastStand&&c<.3)mult*=1+d.lastStand/100;if(d.firstHit&&e.hp>=e.maxHp)mult*=1+d.firstHit/100;
  const crit=this.rand()<(d.lowCrit&&c<.2?1:d.crit),value=Math.round(amount*mult*(crit?1.8:1)*(.9+this.rand()*.2));
  if(dazzle&&this.rand()<dazzle)stun=Math.max(stun,1);
  if(d.leech)this.p.courage=Math.min(d.maxCourage,this.p.courage+value*d.leech/100);
  e.hp-=value;e.aggro=true;e.flash=.12;
  if(stun&&!e.boss){e.stun=Math.max(e.stun,stun);if(e.state==='windup'){e.state='chase';e.cd=e.cdBase;}}
  else if(stun&&e.boss)e.stun=Math.max(e.stun,stun*.3);
  if(knock&&!e.boss){const a=Math.atan2(e.y-this.p.y,e.x-this.p.x);moveCircle(this.floor,e,Math.cos(a)*knock,Math.sin(a)*knock);}
  this.float(e.x+(this.rand()-.5)*14,e.y-50,crit?`${value}!`:String(value),crit?'#ffd36b':'#ffffff',crit?15:12);
  if(e.hp<=0)this.defeat(e);
 }
 defeat(e){
  e.hp=0;e.state='defeated';e.t=.8;this.stats.defeated++;
  const lines=e.boss?['Thôi được rồi… diễn không nổi nữa!','Hahaha! Cậu thắng!','Nghỉ diễn, nghỉ diễn!']:['Hahaha!','Thua rồi, thua rồi!','Phì cười mất!','Thôi, hết diễn!'];
  this.float(e.x,e.y-80,lines[Math.floor(this.rand()*lines.length)],'#a0ead4',e.boss?15:12);
  const d=this.derived;if(d.onBreak)this.p.courage=Math.min(d.maxCourage,this.p.courage+d.onBreak);
  this.gainXp(e.xp);
  // Loot: coins often, potions sometimes, gear rarely; elites and bosses drop more and better.
  const drop=(kind,extra)=>this.drops.push({id:this.nextId++,kind,x:e.x+(this.rand()-.5)*40,y:e.y+(this.rand()-.5)*30,...extra});
  if(this.rand()<.65||e.elite||e.boss)drop('gold',{amount:Math.round((3+this.rand()*6)*this.depth*(1+d.goldPct)*(e.boss?6:e.elite?3:1))});
  if(this.rand()<.12||e.boss){const r=this.rand();drop('potion',{potion:r<.5?'bread':r<.8?'battery':r<.93?'lens':'ticket'});}
  if(this.rand()<(e.boss?1:e.elite?.2:.04)){const kinds=Object.keys(GEMS);drop('gem',{gem:kinds[Math.floor(this.rand()*kinds.length)]});}
  const items=e.boss?3:e.elite?(this.rand()<.7?1:0)+1:this.rand()<.13?1:0;
  for(let i=0;i<items;i++){const item=e.boss&&i===0&&SETS[e.type]?makeSetItem(this.rand,this.depth,e.type):makeItem(this.rand,this.depth,e.boss?1.2:e.elite?.6:0);
   // The good stuff arrives unidentified: name and affixes hidden until a Kính lúp or Mr. D looks at it.
   if(['rare','legendary','set'].includes(item.rarity))item.unid=true;drop('item',{item});}
  // Zin's ticket: one "Vé 000" fragment per theme, rarely carried by elites and bosses.
  // Fragments belong to an act (its boss), so each act holds exactly one.
  const theme=this.floor.boss;
  if(theme&&!this.fragments.includes(theme)&&!this.drops.some(x=>x.quest==='fragment')&&(e.boss||e.elite)&&this.rand()<(e.boss?FRAGMENT_CHANCE.boss:FRAGMENT_CHANCE.elite))drop('quest',{quest:'fragment',theme});
  if(e.boss){this.bossBroken=true;this.stats.bosses++;this.notice(`${e.name} cười bò ra sàn rồi mở khóa cầu thang. Lối xuống đã mở!`);}
 }
 gainXp(n){const p=this.p;p.xp+=n;while(p.xp>=xpForLevel(p.level)){p.xp-=xpForLevel(p.level);p.level++;const d=this.derived;p.courage=d.maxCourage;p.battery=d.maxBattery;this.float(p.x,p.y-90,`LÊN CẤP ${p.level}!`,'#ffd36b',16);const unlock=Object.values(SKILLS).find(s=>s.level===p.level);this.notice(unlock?`Lên cấp ${p.level}! Mở kỹ năng mới: ${unlock.name}.`:`Lên cấp ${p.level}! Can đảm và sát thương tăng.`);}}
 hurt(amount,source){
  const p=this.p;if(p.dash>0||this.ending)return false;
  const d=this.derived,value=Math.max(1,Math.round(amount*100/(100+d.armor)));
  p.courage-=value;p.hurt=.25;this.float(p.x,p.y-60,`-${value}`,'#f3889c',13);
  if(p.courage<=0)this.knockout();return true;
 }
 // Out of courage: Mr. D carries you out. Equipped gear, levels and coins you came down with are kept;
 // bag items and coins found on this descent stay in the dungeon.
 knockout(){
  const lostItems=this.inventory.filter(it=>it.found),lostGold=Math.min(this.p.gold,this.runGold);
  this.inventory=this.inventory.filter(it=>!it.found);this.p.gold-=lostGold;this.runGold=0;this.stats.knockouts++;
  this.p.courage=0;this.p.path=[];this.p.target=null;this.lost={items:lostItems.map(it=>it.unid?`??? (${it.rarityName})`:it.name),gold:lostGold};
  this.ending='faint';this.notice('Sợ quá! Mr. D cõng bạn lên khỏi hầm.');
 }
 // ---- Simulation step
 step(dt,input={}){
  if(this.ending)return;dt=Math.min(.06,Math.max(0,dt));this.time+=dt;const p=this.p,f=this.floor,d=this.derived;
  for(const k in this.cooldowns)this.cooldowns[k]=Math.max(0,this.cooldowns[k]-dt);
  p.hurt=Math.max(0,p.hurt-dt);p.battery=Math.min(d.maxBattery,p.battery+d.regen*dt);
  this.floaters=this.floaters.filter(x=>x.until>this.time);this.effects=this.effects.filter(x=>x.until>this.time);
  // Movement: dash, keyboard/joystick, click-to-move path, or walking to an attack target.
  const dx=input.dx||0,dy=input.dy||0;p.moving=false;
  if(p.dash>0){p.dash-=dt;moveCircle(f,p,Math.cos(p.dashDir)*650*dt,Math.sin(p.dashDir)*650*dt);p.moving=true;}
  else if(dx||dy){const len=Math.hypot(dx,dy);p.path=[];p.target=null;p.pickTarget=null;p.face=Math.atan2(dy,dx);p.moving=moveCircle(f,p,dx/len*d.speed*dt,dy/len*d.speed*dt);}
  else if(p.target){const e=this.enemies.find(e=>e.id===p.target&&e.state!=='defeated');if(!e)p.target=null;else{const gap=dist(e,p);p.face=Math.atan2(e.y-p.y,e.x-p.x);if(gap>120||!lineOfSight(f,p,e)){moveCircle(f,p,Math.cos(p.face)*d.speed*dt,Math.sin(p.face)*d.speed*dt);p.moving=true;}else this.cast('flash');}}
  else if(p.path.length){const t=p.path[0],gap=dist(p,t);if(gap<5)p.path.shift();else{p.face=Math.atan2(t.y-p.y,t.x-p.x);const s=Math.min(gap,d.speed*dt);p.moving=moveCircle(f,p,Math.cos(p.face)*s,Math.sin(p.face)*s);if(!p.moving)p.path.shift();}}
  if(p.pickTarget){const it=this.drops.find(x=>x.id===p.pickTarget);if(!it)p.pickTarget=null;else if(dist(it,p)<44){this.collect(it);p.pickTarget=null;p.path=[];}}
  // Auto-fight: the flashlight fires by itself at the closest performer in reach.
  if(this.autoAttack&&p.dash<=0&&this.cooldowns.flash<=0){const e=this.live().filter(e=>dist(e,p)<140&&lineOfSight(f,p,e)).sort((a,b)=>dist(a,p)-dist(b,p))[0];if(e)this.cast('flash',{x:e.x,y:e.y-10});}
  this.reveal();
  // Coins and potions are picked up just by walking over them.
  for(const it of [...this.drops])if(it.kind!=='item'&&dist(it,p)<30)this.collect(it);
  // Flow field toward the player, recomputed when the player changes tile.
  const pt=Math.floor(p.y/TILE)*MAP_W+Math.floor(p.x/TILE);if(pt!==this.fieldAt){this.field=flowField(f,pt%MAP_W,Math.floor(pt/MAP_W));this.fieldAt=pt;}
  for(const e of this.enemies)this.stepEnemy(e,dt);
  this.enemies=this.enemies.filter(e=>e.state!=='defeated'||e.t>0);
  // Keep performers from stacking on one spot.
  const live=this.live();for(let i=0;i<live.length;i++)for(let j=i+1;j<live.length;j++){const a=live[i],b=live[j],gap=dist(a,b),min=a.r+b.r;if(gap>0&&gap<min){const push=(min-gap)/2,ux=(a.x-b.x)/gap,uy=(a.y-b.y)/gap;moveCircle(f,a,ux*push,uy*push);moveCircle(f,b,-ux*push,-uy*push);}}
  this.stepCompanions(dt);this.stepZin(dt);this.stepProjectiles(dt);this.stepMarks(dt);
 }
 stepEnemy(e,dt){
  if(e.state==='defeated'){e.t-=dt;return;}
  const p=this.p,f=this.floor,gap=dist(e,p);e.flash=Math.max(0,(e.flash||0)-dt);
  if(!e.aggro&&gap<(e.boss?300:250)&&lineOfSight(f,e,p)){e.aggro=true;if(e.boss)this.notice(e.type==='zombie'?'Xác Sống: Đứa nào nẫng bộ răng của tui?!':e.type==='vampire'?'Ma Cà Rồng: Nhà có khách. Mời… ở lại luôn.':'Ma Cổ Dài: Cúi xuống mà đi nhé…');}
  if(!e.aggro)return;
  if(e.stun>0){e.stun-=dt;return;}
  e.cd-=dt;e.face=Math.atan2(p.y-e.y,p.x-e.x);
  if(e.boss&&this.stepBoss(e,dt,gap))return;
  // Ordinary performers go for whoever is closest: you, Na or Bơ.
  const tgt=e.boss?p:this.targetFor(e),tg=dist(e,tgt);e.face=Math.atan2(tgt.y-e.y,tgt.x-e.x);
  if(e.state==='windup'){e.t-=dt;if(e.t<=0){e.state='chase';e.cd=e.cdBase;const victim=e.tgt&&(e.tgt===p||e.tgt.state!=='away')?e.tgt:tgt;e.face=Math.atan2(victim.y-e.y,victim.x-e.x);if(ENEMIES[e.type].ranged)this.projectiles.push({x:e.x,y:e.y-20,vx:Math.cos(e.face)*230,vy:Math.sin(e.face)*230,r:7,dmg:e.dmg,owner:'enemy',life:1.6,kind:'orb'});else if(dist(e,victim)<e.range+16)this.hit(victim,e.dmg,e);}return;}
  const ranged=ENEMIES[e.type].ranged,see=lineOfSight(f,e,tgt);
  if(e.cd<=0&&see&&tg<e.range+(ranged?0:4)){e.state='windup';e.t=e.windupBase;e.tgt=tgt;return;}
  // Ranged performers keep their distance; everyone else closes in.
  if(ranged&&see&&tg<150){this.stepAway(e,dt,tgt);return;}
  if(ranged&&see&&tg<e.range)return;
  if(tgt!==p&&see){if(tg>e.r+tgt.r+4){const a=Math.atan2(tgt.y-e.y,tgt.x-e.x);moveCircle(f,e,Math.cos(a)*e.speed*dt,Math.sin(a)*e.speed*dt);}return;}
  this.chase(e,dt,gap,lineOfSight(f,e,p));
 }
 targetFor(e){let best=this.p,bd=dist(e,this.p);for(const c of this.companions){if(c.state==='away')continue;const d=dist(e,c);if(d<160&&d<bd){best=c;bd=d;}}return best;}
 hit(target,amount,src){return target===this.p?this.hurt(amount,src):this.hurtCompanion(target,amount);}
 chase(e,dt,gap,see){
  const p=this.p,f=this.floor;if(gap<e.r+p.r+4)return;
  let tx=p.x,ty=p.y;
  if(!see||gap>140){const cx=Math.floor(e.x/TILE),cy=Math.floor(e.y/TILE);let best=null;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const v=this.field[(cy+dy)*MAP_W+cx+dx];if(v<0)continue;if(dx&&dy&&(!isFloor(f,cx+dx,cy)||!isFloor(f,cx,cy+dy)))continue;if(!best||v<best.v)best={v,x:(cx+dx+.5)*TILE,y:(cy+dy+.5)*TILE};}if(best){tx=best.x;ty=best.y;}}
  const a=Math.atan2(ty-e.y,tx-e.x);moveCircle(f,e,Math.cos(a)*e.speed*dt,Math.sin(a)*e.speed*dt);
 }
 stepAway(e,dt,from=this.p){const a=Math.atan2(e.y-from.y,e.x-from.x);moveCircle(this.floor,e,Math.cos(a)*e.speed*.8*dt,Math.sin(a)*e.speed*.8*dt);}
 // Boss patterns. Every big attack is telegraphed with a ring or line before it lands.
 stepBoss(e,dt,gap){
  const p=this.p,f=this.floor,enraged=e.hp<e.maxHp/2;e.special-=dt;e.special2-=dt;
  if(e.type==='zombie'){
   if(e.special2<=0){e.special2=9;const minions=this.live().filter(m=>m.minion).length;if(minions<6)for(let i=0;i<2;i++){const a=this.rand()*Math.PI*2,x=e.x+Math.cos(a)*60,y=e.y+Math.sin(a)*60;if(floorPassable(f,x,y,12)){const m=this.spawn('sheet',x,y,scaleFor(this.depth));m.minion=true;m.aggro=true;}}this.float(e.x,e.y-90,'GÀOOO!','#f3889c',14);}
   if(e.state==='windup'){e.t-=dt;if(e.t<=0){e.state='chase';e.cd=e.cdBase*(enraged?.7:1);this.effects.push({kind:'ring',x:e.x,y:e.y,r:e.range,color:'#f3889c',until:this.time+.3});if(gap<e.range)this.hurt(e.dmg,e);for(const c of this.companions)if(c.state!=='away'&&dist(e,c)<e.range)this.hurtCompanion(c,e.dmg);}return true;}
   if(e.cd<=0&&gap<e.range-10){e.state='windup';e.t=e.windupBase;e.slam={x:e.x,y:e.y};return true;}
   return false;
  }
  if(e.type==='vampire'){
   if(e.state==='dashing'){e.t-=dt;const s=600*dt;moveCircle(f,e,Math.cos(e.dashA)*s,Math.sin(e.dashA)*s);if(!e.dashHit&&dist(e,p)<e.r+p.r+6){e.dashHit=true;this.hurt(e.dmg*1.4,e);}if(e.t<=0)e.state='chase';return true;}
   if(e.state==='aim'){e.t-=dt;if(e.t<=0){e.state='dashing';e.t=.45;e.dashHit=false;}return true;}
   if(e.special<=0&&gap<320){e.special=enraged?4:6;e.state='aim';e.t=.7;e.dashA=Math.atan2(p.y-e.y,p.x-e.x);return true;}
   if(e.special2<=0){e.special2=enraged?6:9;const n=enraged?12:8;for(let i=0;i<n;i++){const a=i/n*Math.PI*2;this.projectiles.push({x:e.x,y:e.y-30,vx:Math.cos(a)*190,vy:Math.sin(a)*190,r:7,dmg:e.dmg*.6,owner:'enemy',life:2,kind:'bat'});}this.float(e.x,e.y-90,'Đàn dơi!','#c3a7ed',14);}
   return false;
  }
  if(e.type==='neck'){
   // She never touches you; she floats at a distance and drops her head where you stand.
   if(e.special<=0){e.special=enraged?2:2.6;const n=enraged?5:3;this.marks.push({x:p.x,y:p.y,t:1,dmg:e.dmg*2});for(let i=1;i<n;i++){const a=this.rand()*Math.PI*2,r=40+this.rand()*70,x=p.x+Math.cos(a)*r,y=p.y+Math.sin(a)*r;if(floorPassable(f,x,y,4))this.marks.push({x,y,t:1+i*.12,dmg:e.dmg*2});}}
   if(gap<150)this.stepAway(e,dt);else if(gap>220)this.chase(e,dt,gap,lineOfSight(f,e,p));
   return true;
  }
  return false;
 }
 stepMarks(dt){for(const m of this.marks){m.t-=dt;if(m.t<=0){this.effects.push({kind:'ring',x:m.x,y:m.y,r:46,color:'#f3889c',until:this.time+.25});if(dist(m,this.p)<46)this.hurt(m.dmg);for(const c of this.companions)if(c.state!=='away'&&dist(m,c)<46)this.hurtCompanion(c,m.dmg);}}this.marks=this.marks.filter(m=>m.t>0);}
 stepProjectiles(dt){
  const f=this.floor,p=this.p;
  for(const q of this.projectiles){q.life-=dt;q.x+=q.vx*dt;q.y+=q.vy*dt;if(!isFloor(f,Math.floor(q.x/TILE),Math.floor((q.y+14)/TILE)))q.life=0;
   if(q.life<=0)continue;
   if(q.owner==='player'){const e=this.live().find(e=>Math.hypot(e.x-q.x,e.y-20-q.y)<e.r+q.r+8);if(e){this.damage(e,q.dmg);q.life=0;if(q.pop){this.effects.push({kind:'ring',x:e.x,y:e.y,r:50,color:'#f3889c',until:this.time+.25});for(const o of this.live())if(o!==e&&dist(o,e)<50)this.damage(o,q.dmg*.5);}}}
   else if(Math.hypot(p.x-q.x,p.y-20-q.y)<p.r+q.r+4){if(this.hurt(q.dmg))q.life=0;}
   else{const c=this.companions.find(c=>c.state!=='away'&&Math.hypot(c.x-q.x,c.y-20-q.y)<c.r+q.r+4);if(c){this.hurtCompanion(c,q.dmg);q.life=0;}}}
  this.projectiles=this.projectiles.filter(q=>q.life>0);
 }
 // ---- Na and Bơ. They follow you, help in fights, and remember whether you stuck with them.
 companionMax(){return 60+5*(this.p.level-1);}
 trustFactor(c){return .6+c.trust/125;}
 regroup(c,refill=false){const p=this.p,spots=[[c.offset.x,c.offset.y],[0,30],[-30,0],[30,0],[0,-30],[0,0]];for(const [dx,dy] of spots)if(floorPassable(this.floor,p.x+dx,p.y+dy,c.r)){c.x=p.x+dx;c.y=p.y+dy;break;}if(refill){c.state='follow';c.courage=this.companionMax()*(rank(this.tree,'friendship')?1.2:1);c.awayT=0;}c.farT=0;}
 hurtCompanion(c,amount){
  if(c.state==='away'||this.ending)return false;const value=Math.max(1,Math.round(amount));
  c.courage-=value;c.hurt=.25;this.float(c.x,c.y-56,`-${value}`,'#f3889c',11);
  if(c.courage<=0){c.state='away';c.awayT=rank(this.tree,'breather')?10:20;c.trust=Math.max(0,c.trust-(dist(c,this.p)>300?8:2));this.say(c,c.id==='na'?'Tui ra ngoài thở cái đã!':'Bơ đi tìm Mr. D xíu nha…');}
  return true;
 }
 stepCompanions(dt){
  const p=this.p,f=this.floor,d=this.derived,combat=this.live().some(e=>e.aggro&&dist(e,p)<320);
  for(const c of this.companions){
   c.hurt=Math.max(0,c.hurt-dt);c.cd-=dt;c.cd2-=dt;c.moving=false;
   if(c.state==='away'){c.awayT-=dt;if(c.awayT<=0){this.regroup(c,true);this.say(c,'Tui quay lại rồi đây!');}continue;}
   const gap=dist(c,p);
   if(gap>700){this.regroup(c);continue;}
   // Follow a spot beside you; take the corridors when there is no straight line.
   let tx=p.x+c.offset.x,ty=p.y+c.offset.y;if(!floorPassable(f,tx,ty,c.r)){tx=p.x;ty=p.y;}
   const to=Math.hypot(tx-c.x,ty-c.y);
   if(to>26){
    if(!lineOfSight(f,c,{x:tx,y:ty})){const cx=Math.floor(c.x/TILE),cy=Math.floor(c.y/TILE);let best=null;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const v=this.field?.[(cy+dy)*MAP_W+cx+dx];if(v==null||v<0)continue;if(!best||v<best.v)best={v,x:(cx+dx+.5)*TILE,y:(cy+dy+.5)*TILE};}if(best){tx=best.x;ty=best.y;}}
    const a=Math.atan2(ty-c.y,tx-c.x),speed=d.speed*(gap>260?1.3:1);c.face=a;c.moving=moveCircle(f,c,Math.cos(a)*speed*dt,Math.sin(a)*speed*dt);
   }
   // Trust: staying together through fights builds it; leaving them behind wears it down.
   if(gap>380){c.farT+=dt;if(c.farT>3){c.trust=Math.max(0,c.trust-dt*1.5);if(!c.calledOut){c.calledOut=true;this.say(c,c.id==='na'?'Đợi tui với!':'Ủa, mọi người đâu rồi?');}}}
   else{c.farT=0;c.calledOut=false;if(combat)c.trust=Math.min(100,c.trust+dt*.4*(rank(this.tree,'friendship')?2:1));}
   if(!combat&&c.courage<this.companionMax())c.courage=Math.min(this.companionMax(),c.courage+dt*4);
   const tf=this.trustFactor(c),foes=this.live().filter(e=>e.aggro&&lineOfSight(f,c,e)).sort((a,b)=>dist(a,c)-dist(b,c));
   if(c.id==='na'){
    // Na throws candy, and cheers you up when your courage runs low.
    const e=foes.find(e=>dist(e,c)<260);
    if(e&&c.cd<=0){c.cd=1.6;const a=Math.atan2(e.y-c.y,e.x-c.x);c.face=a;this.projectiles.push({x:c.x,y:c.y-14,vx:Math.cos(a)*380,vy:Math.sin(a)*380,r:5,dmg:d.damage*.45*tf*(1+.25*rank(this.tree,'nacandy')),owner:'player',life:.9,kind:'candy',hue:Math.floor(this.rand()*4)});}
    if(c.cd2<=0&&p.courage<d.maxCourage*.35&&gap<240){const ch=rank(this.tree,'cheer');c.cd2=30-10*c.trust/100-5*ch;p.courage=Math.min(d.maxCourage,p.courage+d.maxCourage*(.25+.1*ch)*tf);this.float(p.x,p.y-74,'+can đảm','#f3889c');this.say(c,'Bình tĩnh, có tui đây!');}
   }else{
    // Bơ flashes his phone at anyone too close, and sometimes spots the stamp or key.
    const e=foes.find(e=>dist(e,c)<140);
    if(e&&c.cd<=0){c.cd=4;const a=Math.atan2(e.y-c.y,e.x-c.x);c.face=a;this.effects.push({kind:'cone',x:c.x,y:c.y,face:a,spread:.4,range:140,until:this.time+.18});this.damage(e,d.damage*.3*tf*(hasGadget(this.town,'camera')?1.5:1),{stun:hasGadget(this.town,'spareLight')?1.5:1});}
    if(c.cd2<=0){c.cd2=Math.max(6,(rank(this.tree,'boeyes')?8:14)-(hasGadget(this.town,'walkie')?4:0));const q=this.drops.filter(x=>x.kind==='quest'&&!this.explored[Math.floor(x.y/TILE)*MAP_W+Math.floor(x.x/TILE)]&&dist(x,p)<700).sort((a,b)=>dist(a,p)-dist(b,p))[0];
     if(q){if(rank(this.tree,'boeyes')>=2||this.rand()<.75){const tx=Math.floor(q.x/TILE),ty=Math.floor(q.y/TILE);for(let y=ty-1;y<=ty+1;y++)for(let x=tx-1;x<=tx+1;x++)if(x>=0&&y>=0&&x<MAP_W&&y<MAP_H)this.explored[y*MAP_W+x]=1;this.say(c,`Ê, hình như có ${q.quest==='stamp'?'con dấu':'chìa khóa'} ở ${compass(p,q)}!`);}else this.say(c,'Chắc chắn bên này nè… à không, nhầm rồi.');}}
   }
  }
 }
 nearby(){
  const p=this.p,f=this.floor,item=this.drops.filter(d=>d.kind==='item').sort((a,b)=>dist(a,p)-dist(b,p))[0];
  if(f.special==='zin'){if(dist(f.table,p)<56)return{verb:'Đóng mộc',label:'Bàn đóng mộc · đóng dấu cuối cho vé 000'};if(dist(f.roster,p)<56)return{verb:'Ghi tên',label:'Bảng phân ca · mời Zin làm nhân viên'};if(dist(f.exitUp,p)<46)return{verb:'Rời hầm',label:'Thang lên · kết thúc chuyến'};return null;}
  if(item&&dist(item,p)<44)return{verb:'Nhặt',label:item.item.name};
  if(f.door&&!f.doorOpen&&dist(f.door,p)<72)return{verb:this.keys?'Mở cửa':'Khóa',label:this.keys?`Mở cửa phòng trùm (còn ${this.keys} chìa)`:'Cửa phòng trùm · cần chìa khóa đồng'};
  if(dist(f.stairs,p)<46)return{verb:this.stairsLocked?'Khóa':'Xuống',label:this.stairsLocked?(isBossFloor(this.depth)?'Cầu thang (hạ màn trùm trước)':'Cầu thang niêm phong · cần con dấu'):`Cầu thang xuống tầng ${this.depth+1}`};
  if(dist(f.exitUp,p)<46)return isRestStop(this.depth)?{verb:'Rời hầm',label:'Thang lên · về an toàn, giữ hết đồ'}:{verb:'Sập',label:'Thang lên bị sập · dùng Vé về'};
  if(this.vendor&&dist(this.vendor,p)<56)return{verb:'Mua bán',label:'Quầy Mr. D'};
  return null;
 }
 objective(){
  const f=this.floor,keys=this.keys?` · ${this.keys} chìa khóa`:'';
  if(f.special==='zin')return'Tầng 000: đóng mộc vé cho Zin, hoặc mời Zin vào bảng phân ca';
  if(isBossFloor(this.depth)){
   if(!f.doorOpen)return this.keys?`Tầng ${this.depth}: mở cửa phòng trùm bằng chìa khóa đồng${keys}`:`Tầng ${this.depth}: tìm chìa khóa đồng để mở phòng trùm`;
   const boss=this.live().find(e=>e.boss);return boss?`Tầng ${this.depth}: hạ màn ${boss.name}`:`Tầng ${this.depth}: cầu thang xuống đã mở${keys}`;
  }
  const key=this.drops.some(d=>d.quest==='key')?' · chìa khóa đồng (tùy chọn) ở đâu đó':'';
  return this.stampFound?`Tầng ${this.depth}: đã có con dấu, tới cầu thang xuống${key}${keys}`:`Tầng ${this.depth}: tìm con dấu tầng để mở cầu thang${key}${keys}`;
 }
}

// Authoritative run state, navigation, interactions and NPC AI. No browser dependencies.
import {ROOMS, ROOM_ORDER} from './rooms.mjs';

export const W=1000;
export const H=562;
export const EVIDENCE={ticket:'Vé 000',name:'Tên: Zin',tape:'Băng ghi âm'};
export const FOUND={clip:'Kẹp tóc của Na',mirror:'Gương: vẫn còn một cái cổ khác'};
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const inside=(r,x,y)=>x>r.x&&x<r.x+r.w&&y>r.y&&y<r.y+r.h;

export function passable(room,x,y,r=11){const b=room.bounds;return x>=b.x0+r&&x<=b.x1-r&&y>=b.y0+r&&y<=b.y1-r&&!room.blocks.some(k=>x+r>k.x&&x-r<k.x+k.w&&y+r>k.y&&y-r<k.y+k.h);}
export function visible(room,a,b){const n=Math.ceil(distance(a,b)/12);for(let i=1;i<n;i++){const x=a.x+(b.x-a.x)*i/n,y=a.y+(b.y-a.y)*i/n;if(room.blocks.some(c=>inside(c,x,y)))return false;}return true;}

// Rooms are static: build each room's 20-unit walk grid once instead of on every path request.
const nodeKey=p=>p.x+','+p.y,grids=new Map();
function grid(room){
 if(!grids.has(room.id)){const b=room.bounds,nodes=[];for(let y=b.y0+10;y<=b.y1-11;y+=20)for(let x=b.x0+16;x<=b.x1-19;x+=20)if(passable(room,x,y))nodes.push({x,y});grids.set(room.id,{nodes,lookup:new Map(nodes.map(n=>[nodeKey(n),n]))});}
 return grids.get(room.id);
}
export function findPath(room,a,b){const {nodes,lookup}=grid(room);const closest=p=>nodes.reduce((best,n)=>distance(n,p)<distance(best,p)?n:best,nodes[0]);const start=closest(a),end=closest(b),key=nodeKey,queue=[start],prev=new Map([[key(start),null]]);for(let q=0;q<queue.length;q++){const p=queue[q];if(key(p)===key(end))break;for(const [dx,dy]of[[20,0],[-20,0],[0,20],[0,-20]]){const k=(p.x+dx)+','+(p.y+dy);if(lookup.has(k)&&!prev.has(k)){prev.set(k,key(p));queue.push(lookup.get(k));}}}if(!prev.has(key(end)))return[];let result=[],k=key(end);while(k!==null){result.push(lookup.get(k));k=prev.get(k);}result.reverse();if(result.length&&distance(result[0],a)<10)result.shift();return result;}
function moveActor(room,a,dx,dy){let moved=false;if(passable(room,a.x+dx,a.y)){a.x+=dx;moved=moved||dx!==0;}if(passable(room,a.x,a.y+dy)){a.y+=dy;moved=moved||dy!==0;}if(dx||dy)a.face=Math.atan2(dy,dx);a.moving=moved;return moved;}
function follow(room,a,dt,speed){if(!a.path?.length){a.moving=false;return;}const t=a.path[0],d=distance(a,t);if(d<3){a.path.shift();return;}const k=Math.min(speed*dt,d)/d;moveActor(room,a,(t.x-a.x)*k,(t.y-a.y)*k);}

// Authored effects of using a fixture. `state` is what it does to the room's ghost.
const EFFECTS={
 bell:{state:'investigate',duration:7,cooldown:11,color:'#e9c577',label:'Bị tiếng chuông thu hút'},
 tape:{state:'charmed',duration:5,cooldown:14,color:'#a6e9f0',label:'Đứng nghe băng'},
 portrait:{state:'confused',duration:5,cooldown:12,color:'#c3a7ed',label:'Hoảng hốt vì bóng trong tranh'},
 wardrobe:{state:'investigate',duration:6,cooldown:10,color:'#edb080',label:'Quay về tiếng cửa tủ'},
 curtain:{state:'search',duration:4,cooldown:6,color:'#8edacc',label:'Mất dấu · đang tìm'},
 coat:{state:'search',duration:4,cooldown:6,color:'#8edacc',label:'Mất dấu · đang tìm'},
 bench:{state:'repelled',duration:4,cooldown:8,color:'#d3e8aa',label:'Lùi khỏi vùng an toàn'},
 coffin:{state:'investigate',duration:6,cooldown:10,color:'#edb080',label:'Lần theo tiếng gõ quan tài'},
 alcove:{state:'search',duration:4,cooldown:6,color:'#8edacc',label:'Mất dấu · đang tìm'},
 pulley:{state:'retract',duration:6,cooldown:12,color:'#e9c577',label:'Bị kéo lên trần'},
};
const EFFECT_HINT={bell:'Tranh thủ đi vòng qua ma!',tape:'Bạn có thời gian tìm vé.',coffin:'Đi vòng sang phía bên kia!',pulley:'Đi nhanh qua đoạn này!'};

export class Simulation{
 constructor(role,roomId=ROOM_ORDER[0]){
  if(!['visitor','employee'].includes(role))throw Error('Invalid role');
  if(!ROOMS[roomId])throw Error('Invalid room');
  this.role=role;this.time=0;this.fear=20;this.stamina=100;this.battery=100;this.torch=false;this.cooldown=0;this.propCooldown=0;
  this.clues=[];this.found=[];this.journal=[];this.events=[];this.floaters=[];this.score=0;this.wave=0;this.served=0;this.scared=0;this.distracted=0;this.avoided=0;
  this.ending=null;this.mystery=false;this.invited=false;this.completed=false;this.combo=0;this.lastEffect=null;this.bubble=null;this.visited=[];
  this.p={x:0,y:0,face:-Math.PI/2,sprite:0,path:[],moving:false};
  this.companions=[{x:0,y:0,sprite:1,face:0,path:[],moving:false},{x:0,y:0,sprite:2,face:0,path:[],moving:false}];
  this.enterRoom(roomId,true);
 }
 // Place the run in a room. Fear, stamina, battery, clues and score carry over between rooms.
 enterRoom(id,fresh=false){
  const room=ROOMS[id];this.room=room;this.roomId=id;this.visited.push(id);
  Object.assign(this.p,{x:room.start.x,y:room.start.y,face:-Math.PI/2,path:[],moving:false});
  if(this.role==='employee')this.p.sprite=room.employeeSprite;
  this.companions.forEach((c,i)=>Object.assign(c,{x:room.start.x+room.companionOffsets[i].x,y:room.start.y+room.companionOffsets[i].y,path:[],moving:false,face:0}));
  const g=room.ghost;this.monster={x:g.spawn.x,y:g.spawn.y,face:2.5,sprite:g.sprite,path:[],state:'patrol',t:0,index:0,dir:1,jamReady:0};
  this.decoy=g.kind==='neck'?{x:g.rail[0]+g.rail[1]-g.spawn.x,y:g.swing.y}:null;this.crouch=false;this.puppet=false;this.backstage=null;this.relief=0;this.headDrop=0;this.litWarned=false;
  this.phase=this.role==='employee'?'prep':'explore';this.target=null;this.pending=null;this.hidden=false;this.hideSpot=null;this.resting=false;
  this.objectCooldowns={};this.effectUses={};this.worldEffects=[];this.props=[];this.npcs=[];this.lastEffect=null;this.combo=0;
  this.coin=room.coin?{...room.coin}:null;this.coinHeld=false;this.coinFlight=null;this.noiseTimer=0;this.revealTimer=0;
  this.notice(fresh?room.intro[this.role]:room.arrive||room.intro[this.role]);
 }
 notice(text){this.bubble={text,until:this.time+4.8};this.events.push(text);if(this.events.length>6)this.events.shift();}
 log(text){this.journal.push(text);this.notice(text);}
 // Fixed spots plus things that come and go: the coin on the floor, a lost item not yet found.
 spots(){const s=this.room.spots.filter(s=>(!s.role||s.role===this.role)&&(!['lost','mirror'].includes(s.kind)||!this.found.includes(s.id)));if(this.coin&&!this.coinHeld)s.push({id:'coin',kind:'coin',x:this.coin.x,y:this.coin.y,label:'Đồng xu'});return s;}
 navigate(x,y,spot=null){if(this.ending)return;this.resting=false;if(this.hidden){this.hidden=false;this.notice('Bạn bước ra khỏi chỗ nấp.');}this.p.path=findPath(this.room,this.p,{x,y});this.target={x,y};this.pending=spot;}
 nearest(){const s=this.spots();return s.reduce((best,x)=>distance(x,this.p)<distance(best,this.p)?x:best,s[0]);}
 effect(id,spot){
  if(this.mystery||this.ending)return false;
  if((this.objectCooldowns[id]||0)>0){this.notice(`Đạo cụ đang hồi: ${Math.ceil(this.objectCooldowns[id])} giây.`);return false;}
  const data=EFFECTS[id];
  if(!data)return false;
  this.objectCooldowns[id]=data.cooldown;this.effectUses[id]=(this.effectUses[id]||0)+1;
  const duration=Math.max(2,data.duration-(this.effectUses[id]-1)*.65);
  this.worldEffects.push({x:spot.x,y:spot.y,id,until:this.time+2.4,color:data.color});
  if(this.role==='employee'){
   let hits=0;for(const n of this.npcs){if(n.gone||n.leaving||distance(n,spot)>360)continue;n.path=findPath(this.room,n,spot);n.distract=duration;n.interest=20;n.caution=.05;hits++;}
   this.distracted+=hits;this.notice(hits?`${hits} khách bị đạo cụ thu hút. Vòng ra sau rồi tung chiêu!`:'Đạo cụ đã hoạt động. Chờ khách tới gần để dàn cảnh.');return true;
  }
  const m=this.monster,g=this.room.ghost;m.state=data.state;m.t=duration;m.effectLabel=data.label;m.effectDuration=duration;
  m.path=['confused','repelled'].includes(data.state)?findPath(this.room,m,g.retreat):data.state==='charmed'?[]:findPath(this.room,m,spot);
  if(this.lastEffect&&this.lastEffect!==id){this.combo++;this.floaters.push({x:m.x,y:m.y-95,text:'PHỐI HỢP ×'+(this.combo+1),until:this.time+2});}else this.combo=0;
  this.lastEffect=id;this.notice(data.label+' · '+duration.toFixed(1)+' giây. '+(EFFECT_HINT[id]||'Di chuyển để tận dụng khoảng trống.'));return true;
 }
 interact(id){
  if(this.ending)return false;
  const spot=this.spots().find(s=>s.id===id)||this.nearest();
  if(distance(this.p,spot)>64){this.notice('Lại gần hơn để tương tác.');return false;}
  this.pending=null;this.p.path=[];this.target=null;
  const employee=this.role==='employee';
  switch(spot.kind){
   case 'effect':this.effect(spot.id,spot);return true;
   case 'hide':{
    this.hidden=!this.hidden;this.resting=false;this.crouch=false;this.hideSpot=this.hidden?spot:null;
    if(!spot.torchReveals)this.torch=false;
    if(!this.hidden){this.notice('Bạn bước ra khỏi chỗ nấp.');return true;}
    this.effect(spot.id,spot);
    if(this.torch)this.notice('Đèn vẫn bật… vệt sáng sẽ lộ chỗ nấp. Tắt đèn đi!');
    return true;
   }
   case 'rest':this.resting=!this.resting;this.torch=false;if(this.resting)this.effect(spot.id,spot);this.notice(this.resting?'Vùng đèn an toàn đẩy ma lùi. Đang hồi sức và pin.':'Bạn đứng dậy.');return true;
   case 'exit':case 'entrance':{
    if(employee){if(this.room.admitSpot===spot.id)this.admit();else this.notice('Lối sang phòng kế tiếp. Khách sẽ ra ở đây.');return true;}
    if(spot.kind==='entrance'){this.finish('leave');return true;}
    if(this.room.next){this.enterRoom(this.room.next);return true;}
    this.completed=this.time>=20||this.clues.length>0;this.finish(this.completed?'tricks':'leave');return true;
   }
   case 'wardrobe':if(this.mystery){this.finish('new');}else if(employee){this.stamina=Math.min(100,this.stamina+10);this.notice('Chỉnh lại áo choàng. +10 thể lực. Bảng phân ca còn một chỗ trống.');}else this.effect('wardrobe',spot);return true;
   case 'coffin':
    if(employee){this.hidden=!this.hidden;this.hideSpot=this.hidden?spot:null;this.resting=false;this.notice(this.hidden?'Chui vào quan tài. Đợi khách tới gần rồi bung nắp (Hù).':'Bạn bước ra khỏi quan tài.');}
    else this.effect('coffin',spot);
    return true;
   case 'coin':this.coinHeld=true;this.notice('Nhặt được đồng xu. Nhấn Q để ném về hướng đang nhìn; tiếng xu rơi sẽ kéo Xác Sống đi.');return true;
   case 'lost':this.found.push(spot.id);this.journal.push(FOUND[spot.id]);this.notice('Na: Ơ, kẹp tóc của tui! Tưởng mất luôn rồi. Cảm ơn nha.');return true;
   case 'pulley':
    if(employee){this.puppet=!this.puppet;this.hidden=this.puppet;this.hideSpot=null;this.notice(this.puppet?'Cầm dây kéo. Cần điều khiển giờ di chuyển bóng cổ dài; Hù để thả đầu xuống. E để buông.':'Bạn buông dây kéo.');}
    else this.effect('pulley',spot);
    return true;
   case 'backdoor':
    if(employee){this.notice('Cửa hậu dành cho nhân viên đi tắt. Khách không đi lối này.');return true;}
    this.backstage={t:4,to:spot.to};this.hidden=true;this.crouch=false;this.torch=false;this.notice('Bạn lách vào cửa hậu. Tối om, chỉ nghe tiếng dây cáp kêu trên đầu…');return true;
   case 'radio':
    if(this.relief>0){this.notice(`Đồng nghiệp vừa đỡ ca. Gọi lại sau ${Math.ceil(this.relief)} giây.`);return true;}
    this.relief=45;this.stamina=Math.min(100,this.stamina+35);this.notice('Ma Cổ Dài (bộ đàm): Để tui kéo đỡ một lúc. +35 thể lực.');return true;
   case 'mirror':this.found.push('mirror');this.journal.push(FOUND.mirror);this.notice('Ma Cổ Dài tháo mặt nạ, nhìn vào gương: “Cái đó… đâu phải của tui.”');return true;
   case 'ticket':if(this.mystery){this.finish('ticket');return true;}// otherwise it is a clue
   case 'clue':{
    const clue=spot.clue;
    if(!this.clues.includes(clue)){this.clues.push(clue);this.journal.push(EVIDENCE[clue]);this.notice({name:'Dưới lớp bụi có một cái tên: ZIN.',ticket:'Vé 000: bốn dấu mộc, một ô cuối để trống.',tape:'Băng cũ: “Chào mừng Zin đến với Nhà Ma.”'}[clue]);}else this.notice('Manh mối này đã ở trong nhật ký.');
    if(spot.kind==='clue')this.effect(spot.id,spot);this.tryMystery();return true;
   }
  }
  return true;
 }
 admit(){
  if(this.npcs.some(n=>!n.gone)){this.notice('Khách vẫn đang trong phòng. Chăm sóc nhóm này trước nhé.');return;}
  const r=this.room;this.wave++;this.phase='live';
  this.npcs=[0,1].map(v=>{const s=r.guestSpawn[v];return{x:s.x,y:s.y,sprite:v+1,face:Math.PI,path:findPath(r,s,r.routes[v][0]),route:r.routes[v],index:0,wait:0,time:0,interest:20,fear:0,caution:.1,hits:0,usedProps:[],distract:0,flee:0,gone:false,moving:false};});
  this.notice(`Nhóm ${this.wave} bước vào. Hãy di chuyển, đánh lạc hướng rồi dọa!`);
 }
 action(){
  if(this.ending)return;
  if(this.role==='visitor'){
   if(this.hidden&&!this.hideSpot?.torchReveals){this.notice('Bước ra khỏi rèm trước khi bật đèn.');return;}
   if(this.battery<2&&!this.torch){this.notice('Hết pin. Tới ghế nghỉ để sạc lại.');return;}
   this.torch=!this.torch;this.notice(this.torch?(this.hidden?'Đèn bật trong chỗ nấp… vệt sáng lộ vị trí!':'Đèn bật. Quay về phía ma để giữ khoảng cách.'):'Bạn tắt đèn để tiết kiệm pin.');return;
  }
  if(this.puppet)return this.dropHead();
  if(this.cooldown>0){this.notice('Chiêu đang hồi. Đổi vị trí trong lúc chờ.');return;}
  if(this.stamina<22){this.notice('Chưa đủ thể lực. Tới ghế nghỉ hoặc đi chậm để hồi.');return;}
  // Bursting out of a coffin reaches a little further and always catches guests off guard.
  const ambush=this.hidden&&this.hideSpot?.kind==='coffin',range=ambush?180:145;
  this.stamina-=22;this.cooldown=3;this.hidden=false;this.hideSpot=null;this.resting=false;this.events.push('scare');let hits=0;
  for(const n of this.npcs){if(n.gone||distance(n,this.p)>range||!visible(this.room,this.p,n)||n.flee>0)continue;const dx=this.p.x-n.x,dy=this.p.y-n.y;const facing=Math.cos(Math.atan2(dy,dx)-n.face)>.5;const surprise=ambush||n.distract>0||!facing||n.caution<.4;const points=n.hits>=2?3:surprise?25:10;n.hits++;n.fear+=points;n.interest=20;n.caution=1;n.flee=1.5;n.distract=0;this.score+=points;this.scared++;hits++;this.floaters.push({x:n.x,y:n.y-70,text:surprise?'Á! +'+points:'Thấy rồi! +'+points,until:this.time+1.8});}
  this.notice(hits?(ambush?`Bung nắp quan tài! Hù trúng ${hits} khách.`:`Hù trúng ${hits} khách. Đổi vị trí để tránh bị bắt bài.`):ambush?'Bung nắp quá sớm. Khách còn ở xa.':'Không có khách trong tầm. Lại gần và đợi họ quay đi.');
 }
 place(){if(this.role!=='employee'||this.ending)return;if(this.puppet){this.notice('Buông dây kéo (E) rồi mới đặt loa.');return;}if(this.props.length>=3){this.notice('Đã đặt đủ 3 loa. Nhấn Q để kích hoạt loa gần nhất.');return;}if(this.stamina<5){this.notice('Cần 5 thể lực để đặt đạo cụ.');return;}if(this.props.some(p=>distance(p,this.p)<60)){this.notice('Đặt loa cách nhau một chút.');return;}this.props.push({x:this.p.x,y:this.p.y,id:this.props.length,pulse:0});this.stamina-=5;this.notice('Đã đặt loa. Di chuyển sang bên khác rồi nhấn Q.');}
 secondary(){
  if(this.ending)return;
  if(this.role==='visitor'){
   const hide=this.room.spots.find(s=>s.kind==='hide');
   if(hide&&distance(this.p,hide)<70)this.interact(hide.id);
   else if(this.coinHeld)this.throwCoin();
   else if(this.room.ghost.kind==='neck'){this.crouch=!this.crouch;this.resting=false;this.notice(this.crouch?'Bạn cúi thấp. Đi chậm, nhưng cổ dài không với tới.':'Bạn đứng thẳng dậy.');}
   else{this.torch=false;this.resting=false;this.notice('Đi chậm giúp giữ sức. Muốn nấp, tới '+(hide?.hint||'chỗ tối')+'.');}
   return;
  }
  if(!this.props.length){this.notice('Nhấn P để đặt loa trước.');return;}if(this.propCooldown>0){this.notice('Loa đang hồi.');return;}const prop=this.props.reduce((a,b)=>distance(a,this.p)<distance(b,this.p)?a:b);prop.pulse=2.5;this.propCooldown=5;let count=0;for(const n of this.npcs){if(n.gone||distance(n,prop)>300||n.usedProps.includes(prop.id))continue;n.usedProps.push(prop.id);n.path=findPath(this.room,n,prop);n.distract=5;n.interest=20;n.caution=.1;count++;}this.distracted+=count;this.notice(count?`${count} khách quay về phía loa. Vòng sang phía khác để hù!`:'Tiếng loa vang lên. Khách ở quá xa hoặc đã quen tiếng này.');
 }
 // Throw the held coin up to 170 units the way the player faces; it lands on the floor and can be picked up again.
 throwCoin(){
  if(!this.coinHeld||this.ending)return false;
  const p=this.p;let x=p.x,y=p.y;
  for(let d=170;d>20;d-=10){const tx=p.x+Math.cos(p.face)*d,ty=p.y+Math.sin(p.face)*d;if(passable(this.room,tx,ty,6)){x=tx;y=ty;break;}}
  this.coinHeld=false;this.coin={x,y};this.coinFlight={from:{x:p.x,y:p.y-34},to:{x,y},start:this.time,until:this.time+.45};
  const heard=this.noise(x,y,320,'Keng!');this.notice(heard?'Keng! Xác Sống quay đầu về phía tiếng xu.':'Keng! Đồng xu lăn trên nền đá.');return true;
 }
 // A sound at (x,y). The cemetery zombie hunts by ear: it walks to any sound within `radius`.
 noise(x,y,radius,text){
  this.worldEffects.push({x,y,id:'noise',until:this.time+1.6,color:'#f0d79a',radius});
  if(text)this.floaters.push({x,y:y-26,text,until:this.time+1.2});
  const m=this.monster;
  if(this.role!=='visitor'||this.room.ghost.kind!=='zombie'||this.mystery)return false;
  if(!['patrol','investigate','search'].includes(m.state)||distance(m,{x,y})>radius)return false;
  m.state='investigate';m.t=5;m.effectDuration=5;m.effectLabel='Nghe tiếng động';m.path=findPath(this.room,m,{x,y});return true;
 }
 finish(key){this.ending=key;this.torch=false;this.p.path=[];this.notice('Ca đêm kết thúc.');}
 tryMystery(){if(this.room.story&&this.clues.length===3&&!this.mystery&&(this.role==='visitor'?this.time>=20:this.completed)){this.mystery=true;this.monster.state='rest';this.monster.t=999;this.log('Khách Số 0: Còn một phòng nữa mà… Mang vé tới bàn đóng mộc, hoặc ghi tên Zin ở tủ phân ca.');}}
 step(dt,input={}){
  if(this.ending)return;dt=Math.min(.06,Math.max(0,dt));this.time+=dt;this.cooldown=Math.max(0,this.cooldown-dt);this.propCooldown=Math.max(0,this.propCooldown-dt);for(const k in this.objectCooldowns)this.objectCooldowns[k]=Math.max(0,this.objectCooldowns[k]-dt);this.worldEffects=this.worldEffects.filter(e=>e.until>this.time);this.floaters=this.floaters.filter(f=>f.until>this.time);this.props.forEach(p=>p.pulse=Math.max(0,p.pulse-dt));if(this.coinFlight&&this.coinFlight.until<=this.time)this.coinFlight=null;
  this.relief=Math.max(0,this.relief-dt);this.headDrop=Math.max(0,this.headDrop-dt);
  // Back door: the visitor is out of sight for a few seconds, then comes out near the far end.
  if(this.backstage){
   this.backstage.t-=dt;this.p.moving=false;
   if(this.backstage.t<=0){const to=this.backstage.to;this.backstage=null;this.hidden=false;Object.assign(this.p,{x:to.x,y:to.y,path:[]});this.companions.forEach((c,i)=>Object.assign(c,{x:to.x-40-i*40,y:to.y-30,path:[]}));this.fear=Math.min(100,this.fear+6);this.notice('Bạn ra ở cuối hành lang. Na: Lần sau đi đường tắt nhớ rủ tui!');}
   this.stepVisitor(dt);return;
  }
  const dx=input.dx||0,dy=input.dy||0;const steer=this.puppet&&!!(dx||dy),moving=!this.puppet&&!!(dx||dy);const running=moving&&input.run&&this.stamina>2&&!this.crouch;
  // Holding the rope: movement input steers the head's shadow instead of the performer.
  if(steer){const m=this.monster,b=this.room.bounds,len=Math.hypot(dx,dy);m.x=Math.min(b.x1-20,Math.max(b.x0+20,m.x+dx/len*150*dt));m.y=Math.min(b.y1-10,Math.max(b.y0+10,m.y+dy/len*150*dt));this.stamina=Math.max(0,this.stamina-dt*2);}
  if(moving){this.hidden=false;this.hideSpot=null;this.resting=false;this.pending=null;this.target=null;this.p.path=[];const len=Math.hypot(dx,dy),speed=this.crouch?52:running?172:104;moveActor(this.room,this.p,dx/len*speed*dt,dy/len*speed*dt);if(running)this.stamina=Math.max(0,this.stamina-dt*14);}else if(!this.hidden&&!this.resting){follow(this.room,this.p,dt,this.crouch?52:104);if(this.pending){const spot=this.spots().find(s=>s.id===this.pending);if(spot&&distance(this.p,spot)<48)this.interact(spot.id);}if(!this.p.path.length)this.target=null;}else this.p.moving=false;
  this.stamina=Math.min(100,this.stamina+dt*(this.resting?22:input.run&&moving||steer?0:3));if(this.resting){this.fear=Math.max(0,this.fear-dt*16);this.battery=Math.min(100,this.battery+dt*24);}if(this.torch){this.battery=Math.max(0,this.battery-dt*6);if(this.battery===0){this.torch=false;this.notice('Le lói… đèn hết pin.');}}
  // Footsteps: loose boards always creak; running is loud anywhere in a room whose ghost listens.
  if(this.role==='visitor'&&this.p.moving&&!this.ending){this.noiseTimer-=dt;const boards=this.room.creaky.some(r=>inside(r,this.p.x,this.p.y));if((boards||running&&this.room.ghost.kind==='zombie')&&this.noiseTimer<=0){this.noiseTimer=.45;this.noise(this.p.x,this.p.y,boards?(running?300:230):170,boards?'cót két':null);}}
  if(this.ending)return;
  if(this.role==='visitor')this.stepVisitor(dt);else this.stepGuests(dt);this.tryMystery();
 }
 stepVisitor(dt){
  for(let i=0;i<this.companions.length;i++){const c=this.companions[i],target={x:this.p.x+(i?58:-58),y:this.p.y+15};if(distance(c,target)>75&&!c.path.length)c.path=findPath(this.room,c,target);follow(this.room,c,dt,83);}
  if(this.mystery){this.monster.moving=false;return;}
  const kind=this.room.ghost.kind;if(kind==='zombie')this.stepZombie(dt);else if(kind==='neck')this.stepNeck(dt);else this.stepVampire(dt);
  if(this.fear>=100){const r=this.room.restPoint,m=this.monster;this.fear=40;this.p.x=r.x;this.p.y=r.y;this.p.path=[];this.pending=null;this.resting=true;this.hidden=false;this.crouch=false;this.torch=false;m.state='rest';m.t=8;m.effectLabel=null;this.notice('Mr. D đưa bạn ra ghế nghỉ. Không mất đồ; khi sẵn sàng, cứ đi tiếp.');}
 }
 // Ma Cà Rồng hunts by sight: pursues within 240 with line of sight; light makes it retreat.
 stepVampire(dt){
  const m=this.monster,g=this.room.ghost,room=this.room;
  const d=distance(m,this.p),angle=Math.atan2(m.y-this.p.y,m.x-this.p.x),lit=this.torch&&d<245&&Math.cos(angle-this.p.face)>.58&&visible(room,this.p,m);if(lit&&!['stunned','charmed','confused','repelled'].includes(m.state)){m.state='stunned';m.t=3.5;m.path=findPath(room,m,g.stunRetreat||g.retreat);m.effectLabel='Chói mắt · lùi lại';m.effectDuration=3.5;this.avoided++;this.floaters.push({x:m.x,y:m.y-70,text:'Chói quá!',until:this.time+2});}
  if(['investigate','charmed','confused','search','repelled'].includes(m.state)){m.t-=dt;follow(room,m,dt,m.state==='repelled'?110:72);if(m.t<=0){m.state='patrol';m.path=[];m.effectLabel=null;}return;}
  if(m.state==='stunned'||m.state==='rest'){m.t-=dt;follow(room,m,dt,95);if(m.t<=0){m.state='patrol';m.path=[];}return;}
  if(this.hidden||this.resting){if(m.state==='windup')this.avoided++;if(m.state!=='patrol')m.path=[];m.state='patrol';}
  if(m.state==='windup'){m.t-=dt;m.face=Math.atan2(this.p.y-m.y,this.p.x-m.x);if(m.t<=0){if(d<135&&!this.hidden&&!this.resting&&visible(room,m,this.p)){this.scareHit();}else{this.avoided++;this.notice('Bạn tránh được màn hù.');}m.state='rest';m.t=3;}return;}
  if(d<115&&!this.hidden&&!this.resting&&visible(room,m,this.p)){m.state='windup';m.t=1.25;m.path=[];this.notice('Ma đang lấy đà… Lùi lại, nấp hoặc rọi đèn!');return;}
  if(d<240&&!this.hidden&&!this.resting&&visible(room,m,this.p)){m.repath=(m.repath||0)-dt;if(m.repath<=0){m.path=findPath(room,m,this.p);m.repath=.7;}}else if(!m.path.length){m.index=(m.index+1)%g.patrol.length;m.path=findPath(room,m,g.patrol[m.index]);}follow(room,m,dt,58);
  if(d<160&&!this.hidden&&!this.resting&&!lit)this.fear=Math.min(100,this.fear+dt*1.5);
 }
 // Xác Sống hunts by ear: it barely sees, walks to sounds, and smells you only up close.
 // Light makes it flinch briefly, then it shuffles toward where the light came from.
 stepZombie(dt){
  const m=this.monster,g=this.room.ghost,room=this.room,p=this.p,d=distance(m,p);
  const revealed=this.hidden&&this.torch&&this.hideSpot?.torchReveals;
  const exposed=!this.resting&&(!this.hidden||revealed);
  if(revealed){this.revealTimer-=dt;if(this.revealTimer<=0){this.revealTimer=1;this.noise(p.x,p.y,260,'vệt sáng');}}
  const lit=this.torch&&!this.hidden&&d<200&&Math.cos(Math.atan2(m.y-p.y,m.x-p.x)-p.face)>.58&&visible(room,p,m);
  if(lit&&['patrol','investigate','search','windup'].includes(m.state)){m.state='stunned';m.t=2;m.path=findPath(room,m,g.retreat);m.effectLabel='Lóa mắt · khựng lại';m.effectDuration=2;m.followLight=true;this.avoided++;this.floaters.push({x:m.x,y:m.y-70,text:'Lóa!',until:this.time+1.6});}
  if(['investigate','charmed','confused','search','repelled'].includes(m.state)){
   m.t-=dt;follow(room,m,dt,m.state==='repelled'?100:70);
   if(m.state==='investigate'&&exposed&&d<85&&visible(room,m,p)){this.zombieWindup();return;}
   if(m.t<=0){m.state='patrol';m.path=[];m.effectLabel=null;}return;
  }
  if(m.state==='stunned'||m.state==='rest'){
   m.t-=dt;follow(room,m,dt,60);
   if(m.t<=0){if(m.state==='stunned'&&m.followLight){m.followLight=false;m.state='investigate';m.t=4;m.effectDuration=4;m.effectLabel='Lần theo ánh đèn';m.path=findPath(room,m,p);}else{m.state='patrol';m.path=[];m.effectLabel=null;}}
   return;
  }
  if(m.state==='windup'&&!exposed){this.avoided++;m.state='patrol';m.path=[];}
  if(m.state==='windup'){m.t-=dt;m.face=Math.atan2(p.y-m.y,p.x-m.x);if(m.t<=0){if(d<120&&exposed&&visible(room,m,p))this.scareHit();else{this.avoided++;this.notice('Bạn lách khỏi tầm với của Xác Sống.');}m.state='rest';m.t=3;}return;}
  if(exposed&&d<75&&visible(room,m,p)){this.zombieWindup();return;}
  if(!m.path.length){m.index=(m.index+1)%g.patrol.length;m.path=findPath(room,m,g.patrol[m.index]);}follow(room,m,dt,40);
  if(exposed&&d<120)this.fear=Math.min(100,this.fear+dt*1.5);
 }
 // Ma Cổ Dài rides a ceiling rail: her head sways across the hall and drops onto whoever stands
 // under its shadow. Crouching keeps you below her reach; light on her face only shows her where
 // you are; light on the pulley jams the rail for a while; yanking the rope pulls her up.
 stepNeck(dt){
  const m=this.monster,g=this.room.ghost,p=this.p,room=this.room;
  const exposed=!this.resting&&!this.hidden;const reachable=exposed&&!this.crouch;
  m.jamReady=Math.max(0,m.jamReady-dt);
  const aim=t=>this.torch&&!this.hidden&&Math.cos(Math.atan2(t.y-p.y,t.x-p.x)-p.face);
  const active=['patrol','track','windup'].includes(m.state);
  if(active&&m.jamReady<=0&&distance(p,g.mechanism)<260&&aim(g.mechanism)>.8){m.state='jammed';m.t=5;m.effectDuration=5;m.effectLabel='Kẹt ròng rọc';m.jamReady=11;this.avoided++;this.floaters.push({x:g.mechanism.x,y:g.mechanism.y+40,text:'Kẹt dây!',until:this.time+1.6});this.notice('Ánh đèn làm ròng rọc kẹt lại. Đi nhanh!');return;}
  else if(active&&distance(p,m)<230&&aim(m)>.58&&!this.litWarned){this.litWarned=true;this.notice('Rọi vào mặt chỉ làm cô ấy thấy bạn rõ hơn. Thử rọi lên ròng rọc.');}
  const sway=Math.sin(this.time*1.4)*g.swing.amp;
  if(this.decoy&&!['jammed','retract'].includes(m.state)){this.decoy.x=g.rail[0]+g.rail[1]-m.x;this.decoy.y=g.swing.y-sway*.8;}
  if(!active){m.t-=dt;if(m.t<=0){m.state='patrol';m.effectLabel=null;}return;}
  const d=distance(m,p);
  if(m.state==='windup'){m.t-=dt;if(m.t<=0){if(distance(m,p)<48&&reachable)this.scareHit();else{this.avoided++;this.notice(this.crouch?'Cái đầu lướt sát tóc bạn rồi rút lên.':'Bạn né khỏi bóng cổ dài.');}m.state='rest';m.t=3;}return;}
  if(reachable&&d<38){m.state='windup';m.t=.9;this.notice('Cổ đang thả xuống… Cúi người hoặc bước khỏi bóng!');return;}
  // Track the player along the rail when close or lit; otherwise patrol end to end.
  const lit=aim(m)>.58&&d<230;
  const tracking=exposed&&(Math.abs(p.x-m.x)<220||lit);m.state=tracking?'track':'patrol';
  let tx;if(tracking)tx=p.x;else{if(m.x<=g.rail[0]+2)m.dir=1;else if(m.x>=g.rail[1]-2)m.dir=-1;tx=m.dir>0?g.rail[1]:g.rail[0];}
  const speed=tracking?(lit?120:92):60,step=Math.max(-speed*dt,Math.min(speed*dt,tx-m.x));m.x=Math.min(g.rail[1],Math.max(g.rail[0],m.x+step));m.moving=Math.abs(step)>.01;
  const ty=tracking?g.swing.y+sway*.4+(p.y-g.swing.y)*.6:g.swing.y+sway;m.y+=(ty-m.y)*Math.min(1,dt*3);
  if(reachable&&d<80)this.fear=Math.min(100,this.fear+dt*2);
 }
 dropHead(){
  if(this.cooldown>0){this.notice('Dây còn đang rút. Chờ một chút.');return;}
  if(this.stamina<18){this.notice('Mỏi tay rồi. Gọi đồng nghiệp qua bộ đàm hoặc nghỉ một lát.');return;}
  const m=this.monster;this.stamina-=18;this.cooldown=3;this.headDrop=.7;this.events.push('scare');let hits=0;
  for(const n of this.npcs){if(n.gone||n.flee>0||distance(n,m)>70)continue;const surprise=n.distract>0||n.caution<.4;const points=n.hits>=2?3:surprise?25:10;n.hits++;n.fear+=points;n.interest=20;n.caution=1;n.flee=1.5;n.distract=0;this.score+=points;this.scared++;hits++;this.floaters.push({x:n.x,y:n.y-70,text:surprise?'Á! +'+points:'Thấy rồi! +'+points,until:this.time+1.8});}
  this.notice(hits?`Thả đầu trúng ${hits} khách!`:'Thả đầu vào chỗ trống. Không ai ở dưới bóng.');
 }
 zombieWindup(){const m=this.monster;m.state='windup';m.t=1.4;m.path=[];m.effectLabel=null;this.notice('Xác Sống đánh hơi thấy bạn… Lùi lại, rọi đèn hoặc nấp!');}
 scareHit(){this.fear=Math.min(100,this.fear+24);this.events.push('hit');this.floaters.push({x:this.p.x,y:this.p.y-70,text:'+24 sợ hãi',until:this.time+2});this.notice('Na: Tui đang khởi động gân cốt thôi!');}
 stepGuests(dt){
  const exit=this.room.guestExit;let live=false;
  for(const n of this.npcs){if(n.gone)continue;live=true;n.time+=dt;n.interest-=dt;n.distract=Math.max(0,n.distract-dt);n.flee=Math.max(0,n.flee-dt);const d=distance(n,this.p),seen=this.puppet?distance(n,this.monster)<140:d<200&&!this.hidden&&visible(this.room,n,this.p);if(seen&&n.distract===0)n.caution=Math.min(1,n.caution+dt*.17);else n.caution=Math.max(.1,n.caution-dt*.08);
   if(n.interest<=0||n.fear>=80||n.time>=75){if(!n.leaving){n.leaving=true;n.path=findPath(this.room,n,exit);this.notice(n.fear>=80?'Khách cần nghỉ. Hãy để họ ra ngoài.':'Khách đã xem xong và đi sang phòng tiếp theo.');}}
   if(n.leaving&&distance(n,exit)<35){n.gone=true;this.served++;continue;}
   if(n.flee>0){n.moving=false;continue;}
   if(!n.path.length){if(n.distract>0){n.moving=false;continue;}n.wait+=dt;if(n.wait>2.4){n.wait=0;n.index++;if(n.index>=n.route.length){n.leaving=true;n.path=findPath(this.room,n,exit);}else n.path=findPath(this.room,n,n.route[n.index]);}}
   follow(this.room,n,dt,n.distract>0?76:44);}
  if(live&&this.npcs.every(n=>n.gone)){this.phase='between';this.completed=true;this.notice(this.room.story?'Nhóm đã ra hết. Tới cửa đón nhóm mới, hoặc tìm hiểu vé 000.':'Nhóm đã ra hết. Tới cửa vào đón nhóm mới, hoặc chấm công.');}
 }
 objective(){
  if(this.ending)return'Ca đêm đã kết thúc';if(this.mystery)return'Tới bàn đóng mộc hoặc tủ phân ca để giúp Zin';
  const cemetery=this.roomId==='cemetery';
  if(this.roomId==='corridor'){
   if(this.role==='visitor')return'Canh bóng cổ dài: cúi (Q), giật dây kéo, rọi ròng rọc hoặc đi cửa hậu · tới cửa cuối hành lang';
   if(this.phase==='prep')return'Đặt loa, đón khách ở cửa trái, rồi về cầm dây kéo';
   if(this.phase==='between')return'Đón nhóm mới ở cửa trái, hoặc chấm công';
   return this.puppet?'Giữ bóng xa khách, đợi họ phân tâm rồi thả đầu (Hù)':'Về dây kéo để điều khiển Ma Cổ Dài';
  }
  if(this.role==='visitor')return cemetery?'Lắng nghe Xác Sống, tránh ván cót két, tìm lối sang Bàn Tiệc'+(this.coinHeld?' · Đang cầm xu (Q để ném)':''):'Tự khám phá, tránh ma và tìm đường ra · Manh mối '+this.clues.length+'/3';
  if(this.phase==='prep')return cemetery?'Đặt loa, chọn chỗ chui ra (quan tài), rồi tới cửa vào đón khách':'Đặt loa, rồi tới cửa đón khách';
  if(this.phase==='between')return cemetery?'Đón nhóm mới ở cửa vào, hoặc chấm công':'Đón nhóm mới hoặc điều tra vé 000 · '+this.clues.length+'/3 manh mối';
  return cemetery?'Kích loa, chui vào quan tài, đợi khách tới gần rồi bung nắp':'Kích đạo cụ, vòng ra sau khách rồi tung chiêu';
 }
}

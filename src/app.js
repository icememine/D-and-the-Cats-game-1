import {W,H,EVIDENCE,distance,Simulation} from './sim.mjs';
import {ROOMS} from './rooms.mjs';
import {paintRoom,paintZombie,paintLongNeck,paintCat} from './art.mjs';
import {Dungeon,xpForLevel,SKILLS} from './dungeon.mjs';
import {createDungeonView,bagHtml,shopHtml,treeHtml,townHtml} from './dungeon-view.mjs';
import {buyTown,RESPEC_COST,emptyTown} from './progression.mjs';
import {SaveStore,snapshotDungeon,restoreDungeon,deviceType,browserStorage,browserCookies} from './save.mjs';

const $=id=>document.getElementById(id),canvas=$('world'),ctx=canvas.getContext('2d'),modal=$('modal');
const room=new Image(),atlas=new Image();room.src='../assets/world.png';atlas.src='../assets/actors.png';
// Keep in sync with assets/actors.atlas.json.
const crops=[[192,80,291,639],[639,115,339,606],[1122,115,239,606],[1477,36,499,685]];
let joy={x:0,y:0,id:null},touchRunning=false,camera={scale:1,x:0,y:0},mobile=false;
// Rooms without a PNG backdrop are painted at load time by art.mjs.
const painted={};let zombieSprite=null,neckSprite=null,startRoom='cemetery';
// Hầm Ma (action-RPG visitor mode) runs instead of `sim` when `dg` is set.
let dg=null,dview=null,lastPointer='mouse';
let sim=null,paused=false,keys=new Set(),running=false,last=0,uiClock=0,assetsReady=false,hover=null,lastSpeech='',endShown=false,elapsed=0;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Finished artist sprites dropped into assets/art/ replace the painted placeholders (see README).
const ART_KEYS=['sheet','skeleton','lantern','mrd','zombie','neck','zin'],ART_URLS=/*ART*/{}/*ART*/;
const loadArt=k=>new Promise(res=>{const img=new Image();img.onload=()=>res([k,img]);img.onerror=()=>res(null);img.src=ART_URLS[k]||`../assets/art/${k}.png`;});
Promise.all([room.decode(),atlas.decode(),Promise.all(ART_KEYS.map(loadArt))]).then(([,,found])=>{const custom=Object.fromEntries(found.filter(Boolean));for(const r of Object.values(ROOMS))if(r.art!=='world')painted[r.art]=paintRoom(r);zombieSprite=paintZombie();neckSprite=paintLongNeck();dview=createDungeonView(canvas,ctx,{atlas,crops,zombie:zombieSprite,neck:neckSprite,custom});assetsReady=true;$('loading').hidden=true;$('start').hidden=false;draw();}).catch(()=>{$('loading').textContent='Chưa tải được hình. Hãy tải lại trang để thử lại.';});
function launch(role,roomId=startRoom){resetStick();leaveDungeon();sim=new Simulation(role,roomId);paused=false;endShown=false;running=false;keys.clear();$('start').hidden=true;$('end').hidden=true;$('place').hidden=role!=='employee';$('stop').hidden=role!=='employee';$('touchPlace').hidden=role!=='employee';$('touchSecondaryLabel').textContent=role==='visitor'?'Nấp':'Kích loa';$('touchPrimaryIcon').textContent=role==='visitor'?'☀':'✦';$('primaryLabel').textContent=role==='visitor'?'Bật / tắt đèn':'Tung chiêu';$('secondaryLabel').textContent=role==='visitor'?'Nấp ở rèm':'Kích loa';$('mode').textContent=role==='visitor'?'KHÁCH THAM QUAN':'CA NHÂN VIÊN';canvas.focus();updateUI();}
// Na, Bơ and Zin are cats; the unnamed guests in employee mode stay kids.
let catArt=null;const catFor=a=>a.cat||(sim?.role==='visitor'&&sim.companions.includes(a)?(a.sprite===1?'na':'bo'):null);
function sprite(a,label){if(a===sim?.p&&sim.backstage)return;const cat=catFor(a);if(cat){catArt=catArt||{na:paintCat('na'),bo:paintCat('bo'),zin:paintCat('zin')};const img=catArt[cat],h=40,w=img.width/img.height*h,hop=a.moving?Math.abs(Math.sin(elapsed*12+a.sprite))*-2.4:0;ctx.save();ctx.fillStyle='#0005';ctx.beginPath();ctx.ellipse(a.x,a.y,12,4,0,0,Math.PI*2);ctx.fill();ctx.translate(a.x,a.y+hop);if(Math.cos(a.face)<-.15)ctx.scale(-1,1);ctx.drawImage(img,-w/2,-h,w,h);ctx.restore();if(label){ctx.font='11px system-ui';ctx.textAlign='center';ctx.fillStyle='#08121ed9';const lw=ctx.measureText(label).width+12;ctx.fillRect(a.x-lw/2,a.y-h-20,lw,17);ctx.fillStyle='#d9e7e6';ctx.fillText(label,a.x,a.y-h-8);}return;}const zombie=a.sprite===4,neck=a.sprite===5,img=zombie?zombieSprite:neck?neckSprite:atlas,c=zombie?[0,0,42,82]:neck?[0,0,44,114]:crops[a.sprite],height=a.sprite===3?79:zombie?74:neck?92:68,width=c[2]/c[3]*height,bob=a.moving?Math.sin(elapsed*13)*1.8:0;ctx.save();ctx.fillStyle='#0005';ctx.beginPath();ctx.ellipse(a.x,a.y,17,5,0,0,Math.PI*2);ctx.fill();ctx.translate(a.x,a.y+bob);if(Math.cos(a.face)<-.15)ctx.scale(-1,1);if(a===sim?.p&&sim.crouch)ctx.scale(1,.74);ctx.globalAlpha*=a===sim?.p&&sim.hidden ? .55 : 1;ctx.drawImage(img,...c,-width/2,-height,width,height);ctx.restore();if(label){ctx.font='11px system-ui';ctx.textAlign='center';ctx.fillStyle='#08121ed9';const w=ctx.measureText(label).width+12;ctx.fillRect(a.x-w/2,a.y-height-20,w,17);ctx.fillStyle=a===sim?.p?'#b7ffe4':'#d9e7e6';ctx.fillText(label,a.x,a.y-height-8);}}
function drawCoin(){if(!sim.coin||sim.coinHeld)return;let x=sim.coin.x,y=sim.coin.y;const f=sim.coinFlight;if(f){const k=Math.min(1,1-(f.until-sim.time)/(f.until-f.start));x=f.from.x+(f.to.x-f.from.x)*k;y=f.from.y+(f.to.y-f.from.y)*k-Math.sin(k*Math.PI)*40;}ctx.fillStyle='#0006';ctx.beginPath();ctx.ellipse(sim.coin.x,sim.coin.y+2,6,2,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#e7c083';ctx.beginPath();ctx.arc(x,y-3,5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff2c2';ctx.fillRect(x-2,y-6,2,2);if(!f&&Math.sin(elapsed*4)>.6)sparkle(x,y-6);}
// Ma Cổ Dài hangs from the ceiling rail: shadow on the floor, neck from above, head at ceiling height.
// The decoy is a wig on a second rope that casts the same kind of shadow.
function drawNeck(){
 if(sim.room.ghost.kind!=='neck')return;const m=sim.monster,d=sim.decoy;
 let lift=['retract','rest','search','repelled'].includes(m.state)?190:m.state==='jammed'?150:120;
 if(m.state==='windup'&&sim.role==='visitor')lift=120-(1-m.t/.9)*85;
 if(sim.headDrop>0)lift=120-Math.sin(sim.headDrop/.7*Math.PI)*90;
 m.lift=m.lift==null?lift:m.lift+(lift-m.lift)*.25;
 if(d){ctx.fillStyle='#0006';ctx.beginPath();ctx.ellipse(d.x,d.y,26,8,0,0,Math.PI*2);ctx.fill();const dy=d.y-125;ctx.fillStyle='#c8b48a';ctx.fillRect(d.x-1,-60,2,dy+50);ctx.fillStyle='#16121a';ctx.beginPath();ctx.ellipse(d.x,dy,13,11,0,0,Math.PI*2);ctx.fill();ctx.fillRect(d.x-12,dy,24,26);}
 const k=Math.max(0,Math.min(1,(190-m.lift)/160));ctx.fillStyle=`rgba(0,0,0,${.2+.45*k})`;ctx.beginPath();ctx.ellipse(m.x,m.y,30,10,0,0,Math.PI*2);ctx.fill();
 if(m.state==='windup'&&sim.role==='visitor'){ring(m.x,m.y,46,'#e98091d0');}
 const hx=m.x+Math.sin(elapsed*2)*3,hy=m.y-m.lift;
 ctx.fillStyle='#d9cfc4';ctx.fillRect(hx-3,-60,6,hy+44);ctx.fillStyle='#b9ada2';for(let y=hy-24;y>-60;y-=14)ctx.fillRect(hx-3,y,6,1);
 ctx.drawImage(neckSprite,0,0,44,32,hx-28,hy-40,56,41);
 if(sim.role==='visitor'){if(m.state==='windup')tag(hx,hy-48,'Sắp thả xuống!','#ffa3af');else if(m.effectLabel&&m.t>0)tag(hx,hy-48,m.effectLabel+' · '+Math.ceil(m.t)+'s');}
 if(sim.puppet)ring(m.x,m.y,70,'#a9ffe7a0');
}
function sparkle(x,y){const t=elapsed*3+x;ctx.fillStyle='#fff3c8';const s=1.5+Math.abs(Math.sin(t))*2;ctx.fillRect(x-s,y-.5,s*2,1);ctx.fillRect(x-.5,y-s,1,s*2);}
function ring(x,y,r,color){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.stroke();}
function tag(x,y,t,color='#a5edda'){ctx.font='11px system-ui';ctx.textAlign='center';const width=ctx.measureText(t).width+14;ctx.fillStyle='#07131de6';ctx.fillRect(x-width/2,y-16,width,22);ctx.strokeStyle='#456575';ctx.strokeRect(x-width/2,y-16,width,22);ctx.fillStyle=color;ctx.fillText(t,x,y);}
function draw(){
 const box=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2),cw=Math.round(box.width*dpr),ch=Math.round(box.height*dpr);
 if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;}
 mobile=matchMedia('(pointer:coarse), (max-width:900px)').matches;
 const zoom=mobile&&box.width<box.height*1.65?1.3:1,scale=Math.max(box.width/W,box.height/H)*zoom;
 const vw=box.width/scale,vh=box.height/scale,focus=sim?.p||{x:500,y:345};
 camera={scale,x:Math.max(0,Math.min(W-vw,focus.x-vw/2)),y:Math.max(0,Math.min(H-vh,focus.y-vh/2))};
 ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.setTransform(scale*dpr,0,0,scale*dpr,-camera.x*scale*dpr,-camera.y*scale*dpr);ctx.imageSmoothingEnabled=false;if(!assetsReady)return;ctx.drawImage(sim&&painted[sim.room.art]?painted[sim.room.art].background:room,0,0,W,H);if(!sim)return;
 for(const eff of sim.worldEffects){if(eff.id==='noise'){const k=1-(eff.until-sim.time)/1.6;ctx.save();ctx.globalAlpha=.5*(1-k);ring(eff.x,eff.y,8+k*(eff.radius-8),eff.color);ctx.restore();continue;}const age=2.4-(eff.until-sim.time);ctx.save();ctx.globalAlpha=Math.max(0,1-age/2.4);ring(eff.x,eff.y,18+age*60,eff.color);ring(eff.x,eff.y,8+age*37,eff.color);ctx.restore();}
 const p=sim.p;
 if(sim.torch){ctx.save();ctx.globalCompositeOperation='screen';const start=p.face-.48,end=p.face+.48,g=ctx.createRadialGradient(p.x,p.y-30,3,p.x,p.y-30,240);g.addColorStop(0,'#e5fad050');g.addColorStop(1,'#bdffe000');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(p.x,p.y-30);ctx.arc(p.x,p.y-30,240,start,end);ctx.closePath();ctx.fill();ctx.restore();}
 if(sim.target&&!sim.pending){ring(sim.target.x,sim.target.y,8,'#9fe4d080');ctx.fillStyle='#9fe4d0';ctx.fillRect(sim.target.x-2,sim.target.y-2,4,4);}
 drawCoin();for(const prop of sim.props){ctx.fillStyle='#0a1c2be8';ctx.fillRect(prop.x-16,prop.y-23,32,25);ctx.strokeStyle='#9dddc9';ctx.strokeRect(prop.x-16,prop.y-23,32,25);ctx.fillStyle='#a3e5d2';ctx.font='10px monospace';ctx.textAlign='center';ctx.fillText('LOA',prop.x,prop.y-7);if(prop.pulse>0)ring(prop.x,prop.y,20+(2.5-prop.pulse)*45,'#a0e7cbb0');}
 const neckRoom=sim.room.ghost.kind==='neck',objects=sim.role==='visitor'?[...sim.companions,...(neckRoom?[]:[sim.monster]),p]:[...sim.npcs.filter(n=>!n.gone),p];const layers=[...objects.map(a=>({y:a.y,a})),...(painted[sim.room.art]?.props||[]).map(q=>({y:q.sortY,q}))].sort((a,b)=>a.y-b.y);const playerLabel=sim.puppet?'Cầm dây kéo':sim.crouch?'Đang cúi':sim.hidden?(sim.hideSpot?.kind==='coffin'?'Trong quan tài':'Đang nấp'):sim.resting?'Đang nghỉ':'Bạn';for(const {a,q} of layers){if(q){ctx.drawImage(q.canvas,q.x,q.y,q.w,q.h);continue;}if(a!==p&&sim.role==='employee'){if(a.distract>0)tag(a.x,a.y-88,'Nghe tiếng loa');else if(a.leaving)tag(a.x,a.y-88,'Đi tiếp');else if(a.caution>.6)tag(a.x,a.y-88,'Đề phòng','#efca93');}sprite(a,a===p?playerLabel:a===sim.monster?sim.room.ghost.name:a.sprite===1?'Na':'Bơ');}
 drawNeck();if(!neckRoom&&sim.role==='visitor'&&sim.monster.state==='windup'){const m=sim.monster;ring(m.x,m.y,130,'#e98091a0');tag(m.x,m.y-103,'Sắp hù!','#ffa3af');}if(!neckRoom&&sim.role==='visitor'&&sim.monster.effectLabel&&['stunned','charmed','investigate','confused','search','repelled'].includes(sim.monster.state)){
 const m=sim.monster;tag(m.x,m.y-100,m.effectLabel+' · '+Math.ceil(m.t)+'s');
 ctx.fillStyle='#152d3a';ctx.fillRect(m.x-30,m.y-91,60,3);ctx.fillStyle='#a1ebd3';ctx.fillRect(m.x-30,m.y-91,60*Math.min(1,m.t/(m.effectDuration||7)),3);
 if(m.state==='confused'){ctx.save();ctx.translate(m.x,m.y-82);ctx.rotate(elapsed*2);ctx.fillStyle='#d6b9f2';ctx.fillRect(-18,-2,5,5);ctx.fillRect(15,-2,5,5);ctx.restore();}
 }
 if(sim.role==='employee'&&!sim.puppet&&sim.cooldown>2.45)ring(p.x,p.y,145,'#a9ffe7a0');
 for(const spot of sim.spots()){const near=distance(p,spot)<64;if(spot.kind==='lost'&&distance(p,spot)>110)continue;if(spot.kind==='lost'&&!near){sparkle(spot.x,spot.y);continue;}const clue={portrait:'name',tape:'tape',ticket:'ticket'}[spot.id];if(clue&&sim.clues.includes(clue)&&!sim.mystery&&!near)continue;ctx.globalAlpha=near?1:.55;ring(spot.x,spot.y,near?12:7,near?'#eacf98':'#9bd7d0');ctx.font=near?'12px monospace':'10px monospace';ctx.textAlign='center';ctx.fillStyle=near?'#fff0c5':'#b0e9d9';ctx.fillText(near?'E':'+',spot.x,spot.y+4);ctx.globalAlpha=1;if((sim.objectCooldowns[spot.id]||0)>0)tag(spot.x,spot.y-16,Math.ceil(sim.objectCooldowns[spot.id])+'s','#a9bac5');else if(hover===spot.id)tag(spot.x,spot.y-20,spot.label);}
 if(sim.mystery){const ghost={x:680,y:450,face:0,sprite:0,moving:false,cat:'zin'};ctx.save();ctx.globalAlpha=.55+.1*Math.sin(elapsed*2);sprite(ghost,'Zin · vé 000');ctx.restore();ring(ghost.x,ghost.y,24,'#c7ffdf60');}
 for(const f of sim.floaters){ctx.textAlign='center';ctx.font='bold 13px system-ui';ctx.fillStyle='#061421';const fy=f.y-(2-(f.until-sim.time))*9;ctx.fillText(f.text,f.x+1,fy+1);ctx.fillStyle='#ffe5ad';ctx.fillText(f.text,f.x,fy);}
}
function updateUI(){if(dg)return updateDungeonUI();if(!sim){$('resources').innerHTML='';return;}const resource=(label,value,cls)=>`<div class="res ${cls}">${label}<strong>${Math.round(value)}</strong><div class="bar"><i style="width:${value}%"></i></div></div>`;$('resources').innerHTML=sim.role==='visitor'?resource('Sợ hãi',sim.fear,'fear')+resource('Thể lực',sim.stamina,'')+resource('Pin',sim.battery,'battery'):resource('Thể lực',sim.stamina,'')+`<div class="res">Điểm diễn<strong>${sim.score}</strong><div style="color:var(--mint);font-size:10px">${sim.served} khách đã ra</div></div>`;
 $('objective').textContent=sim.objective();const near=sim.nearest();
 const nearby=distance(sim.p,near)<64;
 const verbs={bell:'Rung chuông',tape:'Bật băng',portrait:'Xoay tranh',ticket:sim.mystery?'Đóng mộc':'Xem vé',curtain:sim.hidden?'Bước ra':'Nấp',bench:sim.resting?'Đứng dậy':'Nghỉ',wardrobe:sim.mystery?'Mời Zin':sim.role==='visitor'?'Đập cửa tủ':'Chỉnh áo',door:sim.role==='visitor'?(sim.room.next?'Sang phòng':'Ra ngoài'):sim.room.admitSpot==='door'?'Đón khách':'Lối ra',coat:sim.hidden?'Bước ra':'Nấp',coffin:sim.role==='visitor'?'Gõ quan tài':sim.hidden?'Bước ra':'Chui vào',coin:'Nhặt xu',clip:'Nhặt lên',pulley:sim.role==='visitor'?'Giật dây':sim.puppet?'Buông dây':'Cầm dây',backdoor:'Vào cửa hậu',radio:'Gọi bộ đàm',mirror:'Soi gương',alcove:sim.hidden?'Bước ra':'Nấp',entrance:sim.role==='visitor'?'Ra ngoài':'Đón khách'};
 const hideSpot=sim.room.spots.find(s=>s.kind==='hide'),nearHide=hideSpot&&distance(sim.p,hideSpot)<70,throwing=sim.role==='visitor'&&sim.coinHeld&&!nearHide,ducking=sim.role==='visitor'&&!nearHide&&!sim.coinHeld&&sim.room.ghost.kind==='neck',secondaryText=throwing?'Ném xu':ducking?(sim.crouch?'Đứng dậy':'Cúi'):'Nấp';
 $('touchInteractLabel').textContent=nearby?verbs[near.id]:'Lại gần';$('touchInteract').disabled=!nearby||!!sim.ending;
 $('touchPrimaryLabel').textContent=sim.role==='visitor'?(sim.torch?'Tắt đèn':'Đèn pin'):sim.cooldown>0?Math.ceil(sim.cooldown)+'s':sim.puppet?'Thả đầu':'Hù!';
 $('touchPrimary').classList.toggle('active',sim.torch);$('touchPrimary').style.setProperty('--cooldown',sim.role==='employee'?sim.cooldown/3*360+'deg':'0deg');
 $('touchSecondaryLabel').textContent=sim.role==='visitor'?secondaryText:'Kích loa';$('secondaryLabel').textContent=sim.role==='visitor'?secondaryText:'Kích loa';
 $('roomName').textContent=sim.room.name;
 $('touchSecondary').disabled=sim.role==='visitor'?!nearHide&&!sim.hidden&&!sim.coinHeld&&!ducking:sim.props.length===0||sim.propCooldown>0;
 $('nearby').textContent=distance(sim.p,near)<64&&!sim.ending?(mobile?'Chạm Sử dụng · ':'E · ')+near.label:'';const speech=sim.bubble&&sim.bubble.until>sim.time?sim.bubble.text:'';if(speech!==lastSpeech){$('speech').textContent=speech;$('speech').classList.toggle('show',!!speech);lastSpeech=speech;}$('primary').classList.toggle('active',sim.torch);$('run').classList.toggle('active',running);$('primaryLabel').textContent=sim.role==='visitor'?(sim.torch?'Tắt đèn':'Bật đèn'):sim.cooldown>0?`Hồi ${sim.cooldown.toFixed(1)}s`:'Tung chiêu';$('status').textContent=sim.role==='visitor'?`Tránh ${sim.avoided} màn hù · ${sim.clues.length}/3 manh mối · ${sim.room.next?'Đi tiếp sang '+ROOMS[sim.room.next].title:'Ra cửa cuối để kết thúc chuyến chơi'}`:`${sim.props.length}/3 loa · ${sim.scared} lần hù trúng · ${sim.distracted} lần phân tâm · ${sim.clues.length}/3 manh mối`;
 if(sim.ending&&!endShown)showEnding();}
function frame(now){const dt=last?Math.min((now-last)/1000,.06):0;last=now;elapsed+=dt;if(dg){if(!paused&&!dg.ending){dg.step(dt,moveInput());dview.step(dt);}dview.draw(dt);uiClock+=dt;if(uiClock>.08){uiClock=0;updateDungeonUI();}requestAnimationFrame(frame);return;}if(sim&&!paused&&!sim.ending){sim.step(dt,{dx:joy.x+(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),dy:joy.y+(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0),run:keys.has('shift')||running||touchRunning});}draw();uiClock+=dt;if(uiClock>.08){uiClock=0;updateUI();}requestAnimationFrame(frame);}
requestAnimationFrame(frame);
function point(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)/camera.scale+camera.x,y:(e.clientY-r.top)/camera.scale+camera.y};}
canvas.addEventListener('pointerdown',e=>{lastPointer=e.pointerType;if(dg){if(!paused&&!dg.ending){e.preventDefault();canvas.focus();dview.pointerDown(e);}return;}if(!sim||paused||sim.ending)return;e.preventDefault();canvas.focus();const p=point(e),spot=(sim?.spots()||[]).find(s=>distance(s,p)<30);if(spot){if(distance(sim.p,spot)<64)sim.interact(spot.id);else sim.navigate(spot.x,spot.y,spot.id);}else sim.navigate(p.x,p.y);updateUI();});canvas.addEventListener('pointermove',e=>{if(dg){dview.pointerMove(e);return;}const p=point(e);hover=(sim?.spots()||[]).find(s=>distance(s,p)<28)?.id||null;});canvas.addEventListener('pointerleave',()=>hover=null);
function invoke(action){if(!sim||paused||sim.ending)return;action();updateUI();canvas.focus();}
$('interact').onclick=()=>invoke(()=>sim.interact());$('primary').onclick=()=>invoke(()=>sim.action());$('secondary').onclick=()=>invoke(()=>sim.secondary());$('place').onclick=()=>invoke(()=>sim.place());$('run').onclick=()=>{running=!running;updateUI();};
function dialog(html){paused=true;keys.clear();resetStick();$('modalContent').innerHTML=html;if(!modal.open)modal.showModal();}
function close(){modal.close();paused=false;last=0;canvas.focus();}
$('closeModal').onclick=close;modal.addEventListener('cancel',e=>{e.preventDefault();close();});
function help(){if(dg)return dungeonHelp();dialog(`<h2>Điều khiển & phối hợp đạo cụ</h2><p><b>Trên điện thoại:</b> kéo cần trái để đi; tay phải chạm Đèn pin / Hù và nút sử dụng. Giữ Chạy để tăng tốc. Có thể vừa di chuyển vừa dùng kỹ năng.</p><p><b>Đạo cụ tác động lên ma:</b> chuông kéo ma tới nguồn âm; băng cát sét giữ ma đứng nghe; tranh khiến ma hoảng lùi; rèm làm ma mất dấu; ghế nghỉ tạo vùng an toàn. Mỗi món có thời gian hồi và dùng lặp sẽ kém hiệu quả.</p><p><b>Phòng Nghĩa Địa:</b> Xác Sống gần như không nhìn thấy nhưng nghe rất thính. Ván gỗ cót két và tiếng chạy sẽ kéo hắn tới. Nhặt đồng xu rồi nhấn Q để ném đánh lạc hướng. Đèn pin chỉ làm hắn khựng lại rồi lần theo ánh sáng; đừng bật đèn khi nấp sau áo khoác. Nhân viên có thể chui vào quan tài đứng rồi bung nắp để hù.</p><p><b>Hành lang Ma Cổ Dài:</b> cái đầu trượt trên trần và thả xuống ai đứng dưới bóng của nó. Nhấn Q để cúi người, giật dây kéo, hoặc rọi đèn lên ròng rọc để làm kẹt. Rọi vào mặt chỉ làm cô ấy thấy bạn. Cửa hậu là đường tắt tối om. Nhân viên cầm dây kéo để điều khiển cái đầu; gọi bộ đàm khi mỏi tay.</p><p>Nhân vật đi trong phòng thật. Đến gần đồ vật để sử dụng; NPC vẫn di chuyển khi bạn đứng yên.</p><div class="help-grid"><b>WASD / ↑↓←→</b><span>Di chuyển. Hoặc chạm một điểm trên sàn để tự tìm đường.</span><b>E</b><span>Tương tác với vật gần nhất. Chạm điểm sáng cũng tự đi tới vật đó.</span><b>Space</b><span>Khách: bật / tắt đèn pin. Nhân viên: tung chiêu trong tầm gần.</span><b>Q</b><span>Khách: nấp khi ở cạnh rèm. Nhân viên: kích hoạt loa gần nhất.</span><b>P</b><span>Nhân viên đặt loa tại chỗ đang đứng, tối đa 3 loa.</span><b>Shift</b><span>Chạy nhanh, tốn thể lực.</span><b>Ghế nghỉ</b><span>Tới ghế ở góc trái để hồi sức, pin và giảm sợ hãi.</span><b>J / Esc</b><span>Nhật ký / tạm dừng.</span></div><p>${sim?.role==='employee'?'Gợi ý: đặt loa, mở cửa đón khách, kích loa rồi vòng sang hướng khác để hù. Khách quen chiêu sẽ khó bị dọa hơn.':'Gợi ý: khi ma lấy đà, quay mặt rọi đèn, lùi lại hoặc nấp. Bàn chặn cả đường đi lẫn một phần tầm nhìn.'}</p><div class="dialog-actions"><button id="resume">Vào chơi</button></div>`);$('resume').onclick=close;}
function journal(){if(dg)return bag();dialog(`<span class="eyebrow">NHẬT KÝ CA ĐÊM</span><h2>Những điều đã thấy</h2><div class="clues">${Object.entries(EVIDENCE).map(([k,v])=>`<div class="clue ${sim?.clues.includes(k)?'':'locked'}">${sim?.clues.includes(k)?'✓ '+v:'? Chưa tìm thấy'}</div>`).join('')}</div><p>${sim?.mystery?'Để giúp Zin chơi xong: tới bàn đóng mộc. Để mời Zin làm nhân viên: tới tủ phân ca.':'Tìm các dấu vết trong phòng: bảng tên dưới tranh, vé trên bàn và máy cát sét.'}</p><ul>${(sim?.journal||[]).map(t=>`<li>${esc(t)}</li>`).join('')}</ul><div class="dialog-actions"><button id="resume">Quay lại phòng</button></div>`);$('resume').onclick=close;}
function pause(){dialog(`<h2>Tạm nghỉ</h2><p>Khách, ma và đồng hồ đều dừng lại khi bảng này mở.</p><div class="dialog-actions"><button id="resume">Chơi tiếp</button><button id="guide">Xem cách chơi</button>${dg?`<button id="controls">Điều khiển: ${thumbMode()?'Một tay (chạm để đi, tự đánh)':'Cần điều khiển'} · đổi</button>`:''}<button id="restart">Đổi vai / bắt đầu lại</button></div>`);$('resume').onclick=close;$('guide').onclick=help;if($('controls'))$('controls').onclick=()=>{setThumb(!thumbMode());pause();};$('restart').onclick=()=>{dialog('<h2>Bắt đầu lại?</h2><p>Ca hiện tại sẽ được đặt lại.</p><div class="dialog-actions"><button id="yes">Về chọn vai</button><button id="no">Chơi tiếp ca này</button></div>');$('yes').onclick=()=>{close();home();};$('no').onclick=close;};}
function home(){resetStick();sim=null;leaveDungeon();renderProfile();endShown=false;keys.clear();$('end').hidden=true;$('start').hidden=false;$('speech').classList.remove('show');$('nearby').textContent='';$('objective').textContent='Chọn vai để bắt đầu.';$('mode').textContent='RPG / MÔ PHỎNG';$('roomName').textContent='CÔNG VIÊN ÁNH TRĂNG';$('stop').hidden=true;updateUI();}
const endings={leave:['Mai chơi tiếp','Na đặt một lon nước cạnh bạn. “Lần sau chơi tiếp, nhưng cậu phải đi trước.” Không cần gồng. Tấm vé vẫn còn.'],tricks:['Rành quá rồi','Bạn đã đi qua phòng. Bơ cười: “Toàn máy móc gài bẫy thôi.” Cái loa rút điện ở góc phòng khẽ đáp: “Ừ.”'],ticket:['Xé vé','Băng cũ vang lên: “Chào mừng Zin đến với Nhà Ma.” Bạn đóng mộc cuối. Zin nói “Lâu quá…” rồi biến mất. Tấm vé đã khô.'],new:['Ma mới','Bạn ghi tên Zin vào bảng phân ca. Mr. D nhìn một lúc rồi viết: “Đứa này khỏi cần phát đồng phục.” Chiếc ghế tự kéo ra đón khách.'],together:['Không bỏ ai lại','Đèn sáng. Bạn dẫn mọi người ra khỏi nhà ma. Sau cánh cửa vừa khóa, ai đó nói rất khẽ: “Cảm ơn.”'],shift:['Hết ca','Khách đã về. Bạn treo áo choàng và trả bộ đàm. Ngày mai, căn phòng sẽ lại cần một người đứng sau tiếng hét.']};
function showEnding(){endShown=true;saves.recordEnding(sim.ending);if(sim.role==='employee')saves.recordScore(sim.score);const [title,text]=endings[sim.ending]||endings.shift;$('end').innerHTML=`<div class="endcard"><span class="eyebrow">CÔNG VIÊN ÁNH TRĂNG · KẾT CA</span><h2>${title}</h2><p>${text}</p><div class="endstats"><span>${sim.role==='employee'?sim.score+' điểm diễn':sim.avoided+' lần tránh ma'}</span><span>${sim.clues.length}/3 manh mối</span><span>${Math.floor(sim.time/60)}:${String(Math.floor(sim.time%60)).padStart(2,'0')}</span></div><div class="endactions"><button id="again">Chơi lại vai này</button><button id="other">Đổi vai</button></div><p><small>${esc(saves.current()?.name||'Bạn')} đã mở ${saves.current()?.endings.filter(k=>k in endings).length||1}/${Object.keys(endings).length} kết cục.</small></p></div>`;$('end').hidden=false;$('again').onclick=()=>launch(sim.role,sim.visited[0]);$('other').onclick=()=>launch(sim.role==='visitor'?'employee':'visitor',sim.visited[0]);}
$('stop').onclick=()=>{if(!sim)return;dialog('<h2>Kết thúc ca?</h2><p>Bật đèn đưa khách ra, hoặc chấm công khi nhóm đã ra hết. Phần thưởng đã kiếm được vẫn được giữ.</p><div class="dialog-actions"><button id="safe">Dừng show, đưa khách ra</button><button id="shiftEnd">Chấm công hết ca</button><button id="resume">Tiếp tục ca</button></div>');$('safe').onclick=()=>{close();sim.finish('together');updateUI();};$('shiftEnd').disabled=sim.npcs.some(n=>!n.gone);$('shiftEnd').onclick=()=>{close();sim.finish('shift');updateUI();};$('resume').onclick=close;};
$('help').onclick=help;$('journal').onclick=journal;$('pause').onclick=pause;document.querySelectorAll('[data-role]').forEach(b=>b.onclick=()=>b.dataset.role==='dungeon'?launchDungeon():launch(b.dataset.role));
document.querySelectorAll('[data-room]').forEach(b=>b.onclick=()=>{startRoom=b.dataset.room;document.querySelectorAll('[data-room]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',x===b);});});
const joystick=$('joystick'),stick=$('stick');
function resetStick(){joy={x:0,y:0,id:null};touchRunning=false;if(stick)stick.style.transform='translate(0px,0px)';if($('touchRun'))$('touchRun').classList.remove('active');}
function dragStick(e){if(e.pointerId!==joy.id)return;const b=joystick.getBoundingClientRect(),radius=b.width*.32,dx=e.clientX-b.left-b.width/2,dy=e.clientY-b.top-b.height/2,length=Math.hypot(dx,dy),factor=length>radius?radius/length:1;joy.x=length<radius*.15?0:dx/Math.max(radius,length);joy.y=length<radius*.15?0:dy/Math.max(radius,length);stick.style.transform=`translate(${dx*factor}px,${dy*factor}px)`;}
joystick.addEventListener('pointerdown',e=>{const run=dg||sim;if(!run||paused||run.ending||joy.id!==null)return;e.preventDefault();joy.id=e.pointerId;joystick.setPointerCapture(e.pointerId);dragStick(e);});
joystick.addEventListener('pointermove',dragStick);
for(const type of ['pointerup','pointercancel','lostpointercapture'])joystick.addEventListener(type,e=>{if(joy.id===e.pointerId){joy={x:0,y:0,id:null};stick.style.transform='translate(0px,0px)';}});
$('touchPrimary').onclick=()=>invoke(()=>{if(sim.role==='visitor'&&!sim.torch){const m=sim.room.ghost.mechanism||sim.monster;if(distance(sim.p,m)<300)sim.p.face=Math.atan2(m.y-sim.p.y,m.x-sim.p.x);}sim.action();});
$('touchInteract').onclick=()=>invoke(()=>sim.interact());$('touchSecondary').onclick=()=>invoke(()=>sim.secondary());$('touchPlace').onclick=()=>invoke(()=>sim.place());
$('touchRun').addEventListener('pointerdown',e=>{if(!sim||paused)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);touchRunning=true;e.currentTarget.classList.add('active');});
for(const type of ['pointerup','pointercancel','lostpointercapture'])$('touchRun').addEventListener(type,()=>{touchRunning=false;$('touchRun').classList.remove('active');});
window.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey)return;const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' ','w','a','s','d','e','q','p','j','escape','shift','r','f','i','1','2','k','z'].includes(k))e.preventDefault();if(k==='escape'){if(e.repeat)return;modal.open?close():pause();return;}if(k==='j'){if(e.repeat)return;modal.open?close():journal();return;}if(dg){if(paused||dg.ending)return;keys.add(k);if(!e.repeat)dungeonKey(k);return;}if(paused||!sim||sim.ending)return;keys.add(k);if(e.repeat)return;if(k==='e')invoke(()=>sim.interact());if(k===' ')invoke(()=>sim.action());if(k==='q')invoke(()=>sim.secondary());if(k==='p')invoke(()=>sim.place());});window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{keys.clear();resetStick();if((sim&&!sim.ending||dg&&!dg.ending)&&!modal.open)pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();resetStick();if((sim&&!sim.ending||dg&&!dg.ending)&&!modal.open)pause();}});
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'read_simulation',description:'Read the visible RPG simulation: role, position, resources, clues, and nearby interaction.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>sim?{role:sim.role,room:sim.roomId,position:{x:sim.p.x,y:sim.p.y},fear:sim.fear,stamina:sim.stamina,clues:sim.clues,phase:sim.phase,objective:sim.objective(),nearby:distance(sim.p,sim.nearest())<64?sim.nearest().id:null}: {screen:'role-selection'}})).catch(()=>{});Promise.resolve(document.modelContext.registerTool({name:'start_simulation',description:'Start a new run in a selected role from the role-selection screen.',inputSchema:{type:'object',properties:{role:{type:'string',enum:['visitor','employee']},room:{type:'string',enum:Object.keys(ROOMS)}},required:['role'],additionalProperties:false},execute:({role,room})=>{if(sim)throw Error('A run is active');if(!assetsReady||!['visitor','employee'].includes(role)||room&&!ROOMS[room])throw Error('Cannot start');launch(role,room||startRoom);return{role:sim.role,room:sim.roomId,phase:sim.phase};}})).catch(()=>{});}catch{}}

// ---- Hầm Ma wiring ------------------------------------------------------------
const DUNGEON_ONLY=['ult','bread','batt','zin','touchUlt','touchBread','touchBattery','touchZin'];
const DUNGEON_HTML={interact:'<kbd>E</kbd><span>Nhặt / dùng</span>',place:'<kbd>R</kbd><span id="placeLabel">Chuông đồng</span>',run:'<kbd>Shift</kbd><span>Lướt</span>',touchPlace:'◎<small id="touchPlaceLabel">Chuông</small>',touchRun:'»<small id="touchRunLabel">Lướt</small>'};
const CLASSIC_HTML=Object.fromEntries(Object.keys(DUNGEON_HTML).map(id=>[id,$(id).innerHTML]));
function moveInput(){return{dx:joy.x+(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),dy:joy.y+(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0)};}
// Mouse players aim at the cursor; touch players aim at the closest performer in range.
const aim=range=>lastPointer==='mouse'&&dview.mouse?dview.mouse:dview.autoAim(range);
function launchDungeon(){
 resetStick();sim=null;showDungeonHud(true);
 // Continue an unfinished descent, or start at floor 1 with the saved character, or start fresh.
 const p=saves.current();
 if(p?.dungeon)dg=restoreDungeon(new Dungeon(p.dungeon.seed),p.dungeon);
 else{dg=new Dungeon(Math.floor(Math.random()*1e5));if(p?.character)restoreDungeon(dg,{character:p.character,depth:1});dg.startDescent();}
 savedDepth=dg.depth;savedAt=dg.time;dview.attach(dg);paused=false;endShown=false;keys.clear();
 document.body.classList.add('dungeon');$('start').hidden=true;$('end').hidden=true;$('stop').hidden=true;$('place').hidden=false;$('touchPlace').hidden=false;
 for(const [id,html] of Object.entries(DUNGEON_HTML))$(id).innerHTML=html;for(const id of DUNGEON_ONLY)$(id).hidden=false;
 $('primaryLabel').textContent='Rọi đèn';$('touchPrimaryIcon').textContent='☀';$('mode').textContent='HẦM MA';
 applyControls();canvas.focus();updateDungeonUI();
}
function leaveDungeon(){
 if(!dg&&!document.body.classList.contains('dungeon'))return;
 if(dg&&!dg.ending)saves.saveDungeon(snapshotDungeon(dg));
 dg=null;dview?.detach();showDungeonHud(false);document.body.classList.remove('dungeon','thumb');$('thumbHint').hidden=true;$('touchRadial').hidden=true;$('radial').hidden=true;
 for(const [id,html] of Object.entries(CLASSIC_HTML))$(id).innerHTML=html;for(const id of DUNGEON_ONLY)$(id).hidden=true;
}
function dungeonAct(action){if(!dg||paused||dg.ending)return;action();updateDungeonUI();canvas.focus();}
function useStuff(){dungeonAct(()=>{if(dg.interact()==='shop')shop();});}
const DUNGEON_KEYS={' ':()=>dg.cast('flash',aim(160)),q:()=>dg.cast('candy',aim(380)),r:()=>dg.cast('bell'),f:()=>dg.cast('spotlight',aim(260)),shift:()=>dg.cast('dash',dview.mouse&&lastPointer==='mouse'?dview.mouse:null),'1':()=>dg.usePotion('bread'),'2':()=>dg.usePotion('battery'),i:()=>bag(),k:()=>tree(),z:()=>dg.callZin()};
function dungeonKey(k){if(k==='e')return useStuff();const f=DUNGEON_KEYS[k];if(f)dungeonAct(f);}
const DUNGEON_BUTTONS={zin:()=>dungeonAct(DUNGEON_KEYS.z),touchZin:()=>dungeonAct(DUNGEON_KEYS.z),interact:useStuff,touchInteract:useStuff,primary:()=>dungeonAct(DUNGEON_KEYS[' ']),touchPrimary:()=>dungeonAct(DUNGEON_KEYS[' ']),secondary:()=>dungeonAct(DUNGEON_KEYS.q),touchSecondary:()=>dungeonAct(DUNGEON_KEYS.q),place:()=>dungeonAct(DUNGEON_KEYS.r),touchPlace:()=>dungeonAct(DUNGEON_KEYS.r),run:()=>dungeonAct(DUNGEON_KEYS.shift),ult:()=>dungeonAct(DUNGEON_KEYS.f),touchUlt:()=>dungeonAct(DUNGEON_KEYS.f),bread:()=>dungeonAct(DUNGEON_KEYS['1']),touchBread:()=>dungeonAct(DUNGEON_KEYS['1']),batt:()=>dungeonAct(DUNGEON_KEYS['2']),touchBattery:()=>dungeonAct(DUNGEON_KEYS['2'])};
for(const [id,fn] of Object.entries(DUNGEON_BUTTONS)){const classic=$(id).onclick;$(id).onclick=e=>dg?fn():classic?.(e);}
$('touchRun').addEventListener('pointerdown',()=>{if(dg)dungeonAct(DUNGEON_KEYS.shift);});
canvas.addEventListener('pointerup',()=>dview?.pointerUp());canvas.addEventListener('pointercancel',()=>dview?.pointerUp());
canvas.addEventListener('contextmenu',e=>{if(dg)e.preventDefault();});
function skillButton(id,labelId,key,name){const s=dg.cooldowns[key],locked=dg.p.level<({bell:3,spotlight:5}[key]||1);const el=$(id),lab=labelId&&$(labelId);if(lab)lab.textContent=locked?`Cấp ${key==='bell'?3:5}`:s>0?`${Math.ceil(s)}s`:name;if(el)el.disabled=locked;}
function updateDungeonUI(){
 if(!dg)return;const p=dg.p,d=dg.derived;
 const bar=(label,shown,pct,cls)=>`<div class="res ${cls}">${label}<strong>${shown}</strong><div class="bar"><i style="width:${Math.max(0,Math.min(100,pct))}%"></i></div></div>`;
 $('resources').innerHTML=bar('Can đảm',Math.max(0,Math.round(p.courage)),p.courage/d.maxCourage*100,'fear')+bar('Pin',Math.round(p.battery),p.battery/d.maxBattery*100,'battery')+bar('Cấp '+p.level+(dg.skillPoints?` · +${dg.skillPoints} điểm`:''),Math.floor(p.xp/xpForLevel(p.level)*100)+'%',p.xp/xpForLevel(p.level)*100,'')+`<div class="res">Xu<strong>${p.gold}</strong><div style="color:var(--mint);font-size:10px">${dg.potions.bread} bánh · ${dg.potions.battery} pin</div></div><div class="res">Chìa<strong>${dg.keys}</strong><div style="color:${dg.stampFound||dg.floor.door?'var(--mint)':'var(--red)'};font-size:10px">${dg.floor.door?(dg.floor.doorOpen?'cửa đã mở':'cửa trùm'):dg.stampFound?'có con dấu':'chưa có dấu'}</div></div>`;
 $('objective').textContent=dg.objective();$('roomName').textContent=`HẦM MA · TẦNG ${dg.depth}`;
 const speech=dg.bubble&&dg.bubble.until>dg.time?dg.bubble.text:'';if(speech!==lastSpeech){$('speech').textContent=speech;$('speech').classList.toggle('show',!!speech);lastSpeech=speech;}
 const n=dg.nearby();$('nearby').textContent='';$('touchInteractLabel').textContent=n?n.verb:'Lại gần';$('touchInteract').disabled=!n||!!dg.ending;
 $('touchPrimaryLabel').textContent=dg.cooldowns.flash>0?'…':'Rọi đèn';$('touchPrimary').style.setProperty('--cooldown',dg.cooldowns.flash/.5*360+'deg');
 $('touchSecondaryLabel').textContent='Ném kẹo';$('secondaryLabel').textContent='Ném kẹo';$('touchSecondary').disabled=p.battery<8;
 skillButton('touchPlace','touchPlaceLabel','bell','Chuông');skillButton('place','placeLabel','bell','Chuông đồng');skillButton('touchUlt','touchUltLabel','spotlight','Sân khấu');skillButton('ult','ultLabel','spotlight','Đèn sân khấu');
 const zinOk=dg.canCallZin,hasZin=dg.fragments.length>0&&dg.zinState!=='gone';for(const id of ['zin','touchZin'])$(id).hidden=!hasZin;$('zin').disabled=$('touchZin').disabled=!zinOk;$('touchZinLabel').textContent=dg.zin?Math.ceil(dg.zin.t)+'s':dg.zinUsed?'Đã gọi':'Zin';
 for(const b of $('radial').querySelectorAll('[data-radial]')){const k=b.dataset.radial;b.disabled=k==='zin'?!zinOk:k==='bread'?!dg.potions.bread:k==='battery'?!dg.potions.battery:k in dg.cooldowns?!dg.skillReady(k):false;}
 const dash=dg.cooldowns.dash;if($('touchRunLabel'))$('touchRunLabel').textContent=dash>0?Math.ceil(dash)+'s':'Lướt';
 $('touchBreadLabel').textContent=`Bánh ×${dg.potions.bread}`;$('touchBatteryLabel').textContent=`Pin ×${dg.potions.battery}`;$('breadLabel').textContent=`Bánh bao ×${dg.potions.bread}`;$('battLabel').textContent=`Pin AA ×${dg.potions.battery}`;
 $('status').textContent=`Đã hạ màn ${dg.stats.defeated} · ${dg.stats.bosses} trùm · sâu nhất tầng ${dg.stats.deepest} · `+(lastPointer==='mouse'?'Chuột trái: đi / đánh · chuột phải: ném kẹo · I: túi đồ · K: kỹ năng · Z: gọi Zin':'Nút Rọi đèn tự nhắm diễn viên gần nhất · Nhật ký: túi đồ');
 if(!dg.ending&&(dg.depth!==savedDepth||dg.time-savedAt>5)){saves.saveDungeon(snapshotDungeon(dg));savedDepth=dg.depth;savedAt=dg.time;}
 updateHudButtons();
 if(dg.ending&&!endShown)showDungeonEnding();
}
function wire(map){for(const [attr,fn] of Object.entries(map))$('modalContent').querySelectorAll(`[data-${attr}]`).forEach(b=>b.onclick=()=>fn(b.dataset[attr]));const r=$('resume');if(r)r.onclick=close;}
function bag(){if(!dg)return;dialog(bagHtml(dg));wire({equip:i=>{dg.equip(dg.inventory[+i]);bag();},drop:i=>{dg.dropItem(dg.inventory[+i]);bag();},open:()=>tree()});}
function tree(){if(!dg)return;dialog(treeHtml({level:dg.p.level,tree:dg.tree}));wire({learn:id=>{dg.learnSkill(id);tree();}});}
function shop(){if(!dg)return;dialog(shopHtml(dg));wire({buy:k=>{dg.buy(k);shop();},sell:i=>{dg.sell(dg.inventory[+i]);shop();},respec:()=>{dg.respec();shop();}});}
function dungeonHelp(){dialog(`<h2>Hầm Ma: cách chơi</h2><p>Diễn viên trong hầm sẽ hù bạn. Hạ màn họ bằng cách làm họ mất bình tĩnh: khi thanh bình tĩnh về 0, họ phì cười, rơi đồ rồi rời sân khấu. Hết can đảm thì Mr. D dắt bạn về đầu tầng; đồ vẫn còn, chỉ rơi ít xu.</p><div class="help-grid"><b>Chuột trái</b><span>Đi tới chỗ bấm; giữ để đi liên tục. Bấm diễn viên để tự đánh; bấm tên món đồ để nhặt.</span><b>Chuột phải / Q</b><span>Ném kẹo về phía con trỏ (8 pin).</span><b>Space</b><span>Rọi đèn: đánh hình nón phía trước, không tốn pin.</span><b>R</b><span>Chuông đồng (cấp 3): làm choáng xung quanh.</span><b>F</b><span>Đèn sân khấu (cấp 5): chùm sáng lớn.</span><b>Shift</b><span>Lướt né: không bị hù trong lúc lướt.</span><b>E</b><span>Nhặt đồ, xuống cầu thang, mua bán ở quầy Mr. D.</span><b>1 / 2</b><span>Bánh bao (hồi can đảm) / pin AA (hồi pin).</span><b>I</b><span>Túi đồ: trang bị đèn, áo, bùa, giày.</span></div><p><b>Con dấu và chìa khóa:</b> cầu thang mỗi tầng bị niêm phong cho tới khi bạn nhặt con dấu tầng (cột sáng hồng). Chìa khóa đồng (cột sáng vàng) thì tùy chọn, nhưng mỗi tầng thứ ba phòng trùm bị khóa và chỉ chìa khóa đồng mở được. Tới tầng trùm mà chưa có chìa thì phải giành chiếc chìa dự phòng ở phòng đông diễn viên nhất.</p><p><b>Cây kỹ năng (K):</b> mỗi cấp được 1 điểm, chia vào nhánh Đèn hoặc Bạn bè. <b>Zin (Z):</b> nhặt mảnh vé 000 đầu tiên là gọi được Zin một lần mỗi tầng; đủ ba mảnh thì cầu thang dẫn tới tầng của Khách Số 0. <b>Quầy Mr. D</b> giữa hai chuyến bán nâng cấp, trang phục và đồ chơi cho Bơ. Trên điện thoại, chế độ một tay (đổi trong Tạm nghỉ): chạm sàn để đi, đèn tự rọi, nút ✦ mở các kỹ năng.</p><p><b>Na và Bơ</b> đi cùng bạn. Na ném kẹo và cổ vũ khi bạn sợ; Bơ rọi điện thoại làm diễn viên khựng lại và đôi khi đánh hơi ra con dấu hay chìa khóa. Đi cùng họ qua các trận thì họ tin bạn hơn và giúp mạnh hơn; bỏ họ lại phía sau thì ngược lại. Hết can đảm, họ ra ngoài nghỉ một lúc rồi quay lại.</p><p>Vòng đỏ là đòn sắp tới: bước ra khỏi vòng hoặc lướt. Mỗi tầng thứ ba có trùm giữ cầu thang. Trên điện thoại, nút đánh tự nhắm vào diễn viên gần nhất.</p><div class="dialog-actions"><button id="resume">Vào hầm</button></div>`);$('resume').onclick=close;}
function showDungeonEnding(){
 endShown=true;saves.saveDungeon(snapshotDungeon(dg),{finished:true});if(dg.ending==='ticket'||dg.ending==='new')saves.recordEnding(dg.ending);const best=Math.max(dg.stats.deepest,saves.current()?.best.depth||0);
 const s=dg.stats,trust=Math.min(...dg.companions.map(c=>c.trust)),friends=trust>=70?' Na và Bơ đòi xuống hầm cùng bạn lần nữa.':trust<30?' Na khoanh tay: “Lần sau đừng bỏ tụi tui lại nữa.”':'',text=(s.bosses?`Mr. D đếm số trùm bạn làm phì cười: ${s.bosses}. “Mai có ca mới, nhớ ghé.”`:'Na đợi sẵn ở cửa hầm với lon nước. “Lần sau xuống sâu hơn nha.”')+friends;
 const zinEnd={ticket:['Xé vé','Zin nhìn dấu mộc cuối cùng rất lâu. “Lâu quá…” Rồi cậu ấy mỉm cười và tan vào ánh đèn. Hôm sau, góc vé 000 có thêm hình chiếc ô.'],new:['Ma mới','Mr. D ghi tên Zin vào bảng phân ca: “Đứa này khỏi cần phát đồng phục.” Từ giờ, cứ gọi là Zin tới.']}[dg.ending];
 $('end').innerHTML=`<div class="endcard"><span class="eyebrow">HẦM MA · KẾT CHUYẾN</span><h2>${zinEnd?zinEnd[0]:'Lên khỏi hầm'}</h2><p>${zinEnd?zinEnd[1]:text}</p><div class="endstats"><span>Sâu nhất tầng ${s.deepest}</span><span>Cấp ${dg.p.level}</span><span>${s.defeated} lần hạ màn</span><span>${dg.p.gold} xu</span></div><p><small>Kỷ lục của ${esc(saves.current()?.name||'bạn')}: tầng ${best} · nhân vật cấp ${dg.p.level} được lưu lại cho lần sau</small></p><div class="endactions"><button id="again">Xuống hầm lần nữa</button><button id="townEnd">Ghé quầy Mr. D</button><button id="other">Về màn hình chính</button></div></div>`;
 $('end').hidden=false;$('again').onclick=()=>launchDungeon();$('other').onclick=()=>home();$('townEnd').onclick=()=>town();
}
window.addEventListener('pointerdown',e=>{lastPointer=e.pointerType;},true);
// ---- Players and saves ---------------------------------------------------------
const saves=new SaveStore({storage:browserStorage(),cookies:browserCookies,device:deviceType({ua:navigator.userAgent,coarse:matchMedia('(pointer:coarse)').matches,width:innerWidth})});
let savedDepth=0,savedAt=0;
const DEVICE_NAME={phone:'điện thoại',tablet:'máy tính bảng',desktop:'máy tính'};
function renderProfile(){
 const p=saves.current();$('start').classList.toggle('no-profile',!p);$('profileForm').hidden=!!p;$('profileCard').hidden=!p;
 if(!p){$('knownPlayers').innerHTML=saves.profiles().slice(0,6).map(x=>`<button type="button" data-player="${esc(x.name)}">${esc(x.name)}</button>`).join('');$('knownPlayers').querySelectorAll('[data-player]').forEach(b=>b.onclick=()=>{saves.select(b.dataset.player);renderProfile();});$('dungeonSub').textContent='“Để xem có gì mà sợ.”';return;}
 const ch=p.character,run=p.dungeon;
 $('playerLabel').textContent=p.name;
 $('saveInfo').textContent=[`Lưu trên ${DEVICE_NAME[saves.device]||'thiết bị này'}`,ch?`Hầm Ma: cấp ${ch.level}, kỷ lục tầng ${p.best.depth||1}`:'Hầm Ma: chưa có nhân vật',`${p.endings.length} kết cục đã mở`].join(' · ')+(saves.persistent?'':' · Trình duyệt này không cho lưu (chế độ ẩn danh?), tiến trình sẽ mất khi đóng trang.');
 $('dungeonSub').textContent=run?`Chơi tiếp: tầng ${run.depth} · cấp ${run.character.level}`:ch?`Cấp ${ch.level} · xuống lại từ tầng 1`:'“Để xem có gì mà sợ.”';
 $('newCharacter').hidden=!ch;$('townBtn').hidden=!ch||!!run;
}
$('profileForm').addEventListener('submit',e=>{e.preventDefault();if(saves.select($('playerName').value)){$('playerName').value='';renderProfile();}});
$('switchPlayer').onclick=()=>{saves.signOut();renderProfile();$('playerName').focus();};
$('newCharacter').onclick=()=>{dialog(`<h2>Tạo nhân vật mới?</h2><p>Nhân vật Hầm Ma của ${esc(saves.current().name)} (cấp ${saves.current().character.level}, đồ nghề và xu) sẽ bị xóa. Kết cục đã mở vẫn giữ.</p><div class="dialog-actions"><button id="yes">Xóa và bắt đầu lại</button><button id="no">Giữ nhân vật</button></div>`);$('yes').onclick=()=>{saves.resetCharacter();close();renderProfile();};$('no').onclick=close;};
// Save when the page is hidden or closed, since phones may never come back to it.
for(const type of ['visibilitychange','pagehide'])addEventListener(type,()=>{if(dg&&!dg.ending)saves.saveDungeon(snapshotDungeon(dg));});
renderProfile();
// ---- Hầm Ma HUD buttons (icons over the canvas) ------------------------------------
let hudIconsSet=false;
function showDungeonHud(on){
 $('dhud').hidden=!on;const joy=$('joystick');
 if(on){$('dStick').appendChild(joy);if(!hudIconsSet&&dview){hudIconsSet=true;const url=n=>`url(${dview.icons[n].toDataURL()})`;
  for(const b of $('dhud').querySelectorAll('[data-skill]'))b.style.backgroundImage=url(b.dataset.skill);
  for(const b of $('dhud').querySelectorAll('[data-act]'))b.style.backgroundImage=url(b.dataset.act);$('dPause').style.backgroundImage=url('pause');}}
 else document.querySelector('.joystick-area').prepend(joy);
}
const HUD_SKILL_KEY={flash:' ',candy:'q',bell:'r',spotlight:'f',dash:'shift'},HUD_ACT_KEY={bread:'1',battery:'2',zin:'z',tree:'k',bag:'i'};
for(const b of $('dhud').querySelectorAll('[data-skill]'))b.onclick=()=>dungeonAct(DUNGEON_KEYS[HUD_SKILL_KEY[b.dataset.skill]]);
for(const b of $('dhud').querySelectorAll('[data-act]'))b.onclick=()=>dungeonAct(DUNGEON_KEYS[HUD_ACT_KEY[b.dataset.act]]);
$('dUse').onclick=()=>useStuff();$('dPause').onclick=()=>pause();
function updateHudButtons(){
 for(const b of $('dhud').querySelectorAll('[data-skill]')){const k=b.dataset.skill,s=SKILLS[k],locked=dg.p.level<s.level;b.disabled=locked||dg.p.battery<s.cost;b.querySelector('i').style.setProperty('--cd',(dg.cooldowns[k]/Math.max(.01,s.cd))*360+'deg');const tag=b.querySelector('b');if(tag)tag.textContent=locked?`C${s.level}`:'';}
 $('dBread').textContent=dg.potions.bread;$('dBattery').textContent=dg.potions.battery;$('dPoints').textContent=dg.skillPoints?`+${dg.skillPoints}`:'';
 const zb=$('dhud').querySelector('[data-act=zin]');zb.hidden=!(dg.fragments.length&&dg.zinState!=='gone');zb.disabled=!dg.canCallZin;
 const n=dg.nearby();$('dUse').hidden=!n||!!dg.ending;if(n)$('dUse').textContent=n.label;
}
// ---- One-thumb controls (Hầm Ma on phones) -----------------------------------------
const CONTROLS_KEY='anhtrang.controls';
function thumbMode(){let v=null;try{v=localStorage.getItem(CONTROLS_KEY);}catch{}return v?v==='thumb':matchMedia('(pointer:coarse)').matches;}
function setThumb(on){try{localStorage.setItem(CONTROLS_KEY,on?'thumb':'stick');}catch{}applyControls();}
function applyControls(){const on=!!dg&&thumbMode();document.body.classList.toggle('thumb',on);if(dg)dg.autoAttack=on;$('thumbHint').hidden=!on;$('touchRadial').hidden=!on;if(!on)$('radial').hidden=true;resetStick();}
const RADIAL={candy:DUNGEON_KEYS.q,bell:DUNGEON_KEYS.r,spotlight:DUNGEON_KEYS.f,dash:DUNGEON_KEYS.shift,bread:DUNGEON_KEYS['1'],battery:DUNGEON_KEYS['2'],zin:DUNGEON_KEYS.z};
$('touchRadial').onclick=()=>{const open=$('radial').hidden;$('radial').hidden=!open;$('touchRadial').setAttribute('aria-expanded',open);};
$('radial').querySelectorAll('[data-radial]').forEach(b=>b.onclick=()=>{const k=b.dataset.radial;if(k!=='close')dungeonAct(RADIAL[k]);$('radial').hidden=true;$('touchRadial').setAttribute('aria-expanded','false');});
// ---- Mr. D's town hub, between descents -------------------------------------------
function town(){
 const p=saves.current();if(!p?.character){dialog('<h2>Quầy Mr. D</h2><p>Xuống hầm một chuyến để có nhân vật và xu trước đã.</p><div class="dialog-actions"><button id="resume">Đóng</button></div>');$('resume').onclick=close;return;}
 if(p.dungeon){dialog(`<h2>Quầy Mr. D</h2><p>${esc(p.name)} còn một chuyến dở ở tầng ${p.dungeon.depth}. Rời hầm bằng thang lên rồi hãy ghé quầy.</p><div class="dialog-actions"><button id="resume">Đóng</button></div>`);$('resume').onclick=close;return;}
 const ch=p.character;ch.town=ch.town||emptyTown();
 dialog(townHtml(ch,p.name));
 wire({town:id=>{buyTown(ch,id);saves.update(()=>{});town();},respec:()=>{if((ch.gold||0)>=RESPEC_COST&&Object.keys(ch.tree||{}).length){ch.gold-=RESPEC_COST;ch.tree={};saves.update(()=>{});}town();}});
 const r=$('resume');if(r)r.onclick=()=>{close();renderProfile();};
}
$('townBtn').onclick=()=>town();
// Local testing aid: open with ?debug to inspect the running game from the console or a test driver.
if(new URLSearchParams(location.search).has('debug'))window.anhTrangDebug={get dg(){return dg;},get sim(){return sim;},saves};

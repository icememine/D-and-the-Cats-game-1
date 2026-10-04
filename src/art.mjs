// Procedural pixel art for rooms without hand-made assets yet (placeholder until art production).
// Everything is painted once into offscreen canvases from the same room data the simulation
// collides against, so what you see always matches where you can walk.
// Pixels are 2 world units: a 1000 × 562 room is a 500 × 281 canvas drawn with smoothing off.

const C={
 night:'#0a1424',sky0:'#0f2036',sky1:'#15304a',sky2:'#1b3c55',hill:'#0d2230',star:'#cfe8e0',moon:'#e6f0d6',moonShade:'#c4d6bd',
 wall:'#1c3836',wallDark:'#132827',stone:'#56697a',stoneLight:'#7b90a0',stoneDark:'#34424f',stoneEdge:'#26313b',
 grass:'#1d3933',grassLight:'#28493f',grassDark:'#152b28',dirt:'#232f37',dirtDark:'#1a242b',flag:'#3c4c58',flagLight:'#4a5c69',
 wood:'#5b3a26',woodLight:'#7c5435',woodDark:'#3a2418',woodGap:'#1f140e',red:'#8e2b33',redDark:'#62202a',
 mint:'#a0ead4',mintSoft:'#5fb39f',bone:'#d8d6c4',iron:'#0e1a22',coat:'#3a3340',coatDark:'#28232e',
};

// Small deterministic RNG so the painted room is identical on every load.
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.imageSmoothingEnabled=false;return[c,g];}
// Pen in world units on a 2-unit pixel grid, offset by (ox,oy) world units.
function pen(g,ox=0,oy=0){
 const P=v=>Math.round(v/2);
 const rect=(x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(P(x-ox),P(y-oy),Math.max(1,P(w)),Math.max(1,P(h)));};
 const disc=(cx,cy,r,c)=>{for(let y=-r;y<=r;y+=2){const half=Math.sqrt(Math.max(0,r*r-y*y));rect(cx-half,cy+y,half*2,2,c);}};
 return{rect,disc};
}

function paintSky(g,rand){
 const {rect,disc}=pen(g);
 const bands=[C.sky0,C.sky1,C.sky2];
 for(let y=30;y<200;y+=2)for(let x=54;x<946;x+=2){const band=(y-30)/170*2.4+rand()*.5;rect(x,y,2,2,bands[Math.min(2,Math.floor(band))]);}
 for(let i=0;i<70;i++){const x=60+rand()*880,y=34+rand()*120;rect(x,y,2,2,rand()<.2?C.mint:C.star);}
 disc(300,96,40,'#16344a');disc(300,96,34,C.moon);disc(312,88,8,C.moonShade);disc(290,108,6,C.moonShade);disc(318,110,4,C.moonShade);
 // Far hills and two dead trees painted on the backdrop.
 for(let x=54;x<946;x+=2){const h=172+Math.sin(x/70)*10+Math.sin(x/23)*4;rect(x,h,2,206-h,C.hill);}
 const tree=(tx,base,scale)=>{rect(tx-4,base-70*scale,8,70*scale,C.iron);const branch=(x,y,dx,dy,n)=>{for(let i=0;i<n;i++)rect(x+dx*i,y+dy*i,4,4,C.iron);};branch(tx,base-60*scale,6,-4,6*scale);branch(tx,base-50*scale,-6,-4,5*scale);branch(tx+20*scale,base-80*scale,4,-6,3*scale);branch(tx-20*scale,base-68*scale,-4,-6,3*scale);};
 tree(150,205,1);tree(640,205,1.2);tree(530,205,.7);
}

function paintWall(g,rand){
 const {rect}=pen(g);
 // Iron fence in front of the mural, then a low stone wall.
 for(let x=60;x<940;x+=18){rect(x,172,4,40,C.iron);rect(x-2,168,8,4,C.iron);rect(x,164,4,4,C.iron);}
 rect(54,180,892,4,C.iron);rect(54,200,892,4,C.iron);
 for(let y=208,row=0;y<240;y+=10,row++)for(let x=54+(row%2)*14;x<946;x+=28){rect(x,y,26,8,rand()<.5?C.stone:C.stoneDark);rect(x,y,26,2,C.stoneLight);}
 paintFrame(g);
}

// Room frame: top border and side walls, like the dining room.
function paintFrame(g){
 const {rect}=pen(g);
 rect(0,0,1000,30,C.night);for(let x=10;x<990;x+=30){rect(x,12,26,14,C.stoneDark);rect(x,12,26,4,C.stone);}
 for(const sx of [0,946]){rect(sx,0,54,562,C.wallDark);for(let y=30;y<540;y+=28){rect(sx+14,y,26,24,C.stoneDark);rect(sx+14,y,26,4,C.stone);}}
}

function paintArch(g){
 const {rect,disc}=pen(g);
 rect(856,150,92,92,C.stoneDark);disc(902,160,46,C.stoneDark);
 rect(866,166,72,76,'#05090f');disc(902,170,36,'#05090f');
 for(let i=0;i<5;i++){rect(870,200+i*8,64,6,i%2?C.redDark:C.red);}
 for(let a=0;a<12;a++){const t=Math.PI*(a/11),x=902-Math.cos(t)*42,y=164-Math.sin(t)*42;rect(x-5,y-5,10,10,a%2?C.stone:C.stoneLight);}
 rect(856,170,10,72,C.stone);rect(938,170,10,72,C.stone);
}

function paintLantern(g,x,y){
 const {rect,disc}=pen(g);
 for(let r=60;r>8;r-=10){g.globalAlpha=.05;disc(x,y+6,r,C.mint);}g.globalAlpha=1;
 rect(x-8,y-14,16,4,C.woodDark);rect(x-6,y-10,12,22,C.woodDark);rect(x-4,y-8,8,18,C.mint);rect(x-2,y-6,4,8,'#e9fff6');rect(x-8,y+12,16,4,C.woodDark);
}

function paintCoat(g,x){
 const {rect}=pen(g);
 rect(x-14,176,28,4,C.woodDark);rect(x-2,172,4,8,C.woodDark);
 rect(x-14,182,28,60,C.coat);rect(x-18,186,8,46,C.coat);rect(x+10,186,8,46,C.coat);
 rect(x-8,182,16,10,C.coatDark);rect(x-2,192,4,46,C.coatDark);rect(x-12,238,24,6,C.coatDark);
 rect(x-14,214,6,4,C.wood);rect(x+8,214,6,4,C.wood);
}

function paintFloor(g,rand,room){
 const {rect}=pen(g);
 for(let y=240;y<522;y+=2)for(let x=54;x<946;x+=2){const r=rand();rect(x,y,2,2,r<.55?C.grass:r<.75?C.dirt:r<.92?C.grassDark:C.grassLight);}
 // Back edge of the floor reads as a shadow under the wall.
 for(let x=54;x<946;x+=2)rect(x,240,2,6,C.dirtDark);
 // Flagstone path from the entrance to the arch.
 const path=[[90,495],[200,385],[330,335],[450,312],[620,330],[660,350],[760,330],[850,292],[902,262]];
 for(let i=0;i<path.length-1;i++){const [ax,ay]=path[i],[bx,by]=path[i+1],n=Math.ceil(Math.hypot(bx-ax,by-ay)/26);for(let k=0;k<n;k++){const x=ax+(bx-ax)*k/n+rand()*6-3,y=ay+(by-ay)*k/n+rand()*6-3;rect(x-10,y-6,20,12,C.flag);rect(x-10,y-6,20,2,C.flagLight);rect(x+8,y-4,2,10,C.stoneEdge);}}
 // Grass tufts, bones and leaves.
 for(let i=0;i<90;i++){const x=60+rand()*880,y=250+rand()*265;rect(x,y,2,4,C.grassLight);rect(x+2,y-2,2,6,C.grassLight);}
 for(let i=0;i<10;i++){const x=80+rand()*840,y=270+rand()*240;rect(x,y,8,2,C.bone);rect(x-2,y-2,2,6,C.bone);rect(x+8,y-2,2,6,C.bone);}
 // Loose boards: alternating planks with dark gaps and nail heads.
 for(const b of room.creaky){for(let y=b.y,i=0;y<b.y+b.h;y+=12,i++){const shift=(i%3)*6;rect(b.x+shift,y,b.w-12,10,i%2?C.wood:C.woodLight);rect(b.x+shift,y+10,b.w-12,2,C.woodGap);for(let x=b.x+shift+12;x<b.x+shift+b.w-12;x+=48){rect(x,y+4,2,2,C.bone);}rect(b.x+shift+b.w*.4,y+2,16,2,C.woodDark);}}
 // Bottom wall with the entrance gap on the left.
 rect(54,522,892,40,C.night);for(let x=140;x<946;x+=30){rect(x,524,26,16,C.stoneDark);rect(x,524,26,4,C.stone);}
 rect(54,522,86,40,'#05090f');rect(64,520,66,10,C.red);rect(64,528,66,4,C.redDark);
}

function paintCrypt(g,b){
 const {rect}=pen(g,b.x-10,b.y-50);
 rect(b.x,b.y-12,b.w,44,C.stoneLight);rect(b.x,b.y-12,b.w,4,'#9db0bd');rect(b.x,b.y+30,b.w,b.h-28,C.stone);rect(b.x,b.y+b.h,b.w,4,C.stoneEdge);
 rect(b.x+b.w-8,b.y-8,8,b.h+8,C.stoneDark);
 rect(b.x+b.w/2-3,b.y-6,6,30,C.stoneDark);rect(b.x+b.w/2-14,b.y+2,28,6,C.stoneDark);
 // Glowing crack where the lid has slipped.
 const cx=b.x+30;for(let i=0;i<8;i++)rect(cx+i*6,b.y+30+(i%2)*2,6,2,C.mint);for(let r=0;r<3;r++){g.globalAlpha=.15;rect(cx-6,b.y+26-r*2,60,6+r*4,C.mint);}g.globalAlpha=1;
 for(const [x,y] of [[b.x-6,b.y+b.h-10],[b.x+b.w+2,b.y+b.h-14]]){rect(x,y,6,12,C.bone);rect(x+2,y-6,2,4,C.mint);}
}

function paintGrave(g,b,rand){
 const {rect,disc}=pen(g,b.x-10,b.y-50);
 const left=b.x+4,w=b.w-8,top=b.y-38;
 rect(b.x-2,b.y+6,b.w+4,b.h-4,C.dirtDark);rect(b.x,b.y+4,b.w,4,C.grassDark);
 rect(left,top+12,w,b.h+14,C.stone);disc(left+w/2,top+12,w/2,C.stone);
 rect(left,top+12,4,b.h+14,C.stoneLight);rect(left+w-4,top+12,4,b.h+14,C.stoneDark);
 rect(left+w/2-2,top+8,4,20,C.stoneEdge);rect(left+w/2-8,top+14,16,4,C.stoneEdge);
 rect(left+6,top+34,w-12,2,C.stoneEdge);
 if(rand()<.6)rect(left+w-10,top+4,6,8,C.grassLight);
}

function paintBench(g,b){
 const {rect,disc}=pen(g,b.x-10,b.y-50);
 for(let r=70;r>10;r-=10){g.globalAlpha=.06;disc(b.x+b.w/2,b.y+b.h,r,C.mint);}g.globalAlpha=1;
 rect(b.x,b.y-20,b.w,8,C.woodLight);rect(b.x,b.y-12,b.w,4,C.woodDark);
 rect(b.x,b.y-6,b.w,16,C.red);rect(b.x,b.y-6,b.w,4,'#b03a44');rect(b.x,b.y+10,b.w,6,C.woodDark);
 for(const x of [b.x+4,b.x+b.w-10])rect(x,b.y+14,6,b.h-14,C.woodDark);
 // Lamp post that makes this the safe, lit corner.
 rect(b.x+b.w-4,b.y-46,4,40,C.stoneDark);rect(b.x+b.w-10,b.y-52,16,8,C.stoneDark);rect(b.x+b.w-8,b.y-50,12,4,C.mint);
}

function paintCoffin(g,b){
 const {rect}=pen(g,b.x-10,b.y-50);
 const top=b.y-34,h=b.h+34;
 for(let y=0;y<h;y+=2){const t=y/h,inset=t<.25?(.25-t)*40:(t-.25)*14;rect(b.x+inset,top+y,b.w-inset*2,2,y%8<2?C.woodDark:C.wood);}
 rect(b.x+b.w/2-2,top+20,4,28,C.woodLight);rect(b.x+b.w/2-10,top+28,20,4,C.woodLight);
 rect(b.x+b.w-12,top+10,2,h-16,C.mintSoft);
 rect(b.x+4,b.y+b.h-2,b.w-8,4,C.woodGap);
}

// ---- Hành lang Ma Cổ Dài
const K={paper:'#173533',paperDark:'#122a29',paperLight:'#21463f',brass:'#b08a4a',brassLight:'#d8b26a',plank:'#26303c',plankLight:'#2d3a48',plankGap:'#161c24',carpet:'#7a2630',carpetDark:'#5a1c25',glass:'#24435a',glassLight:'#3b6580',neck:'#d9cfc4'};

function paintCorridorBackdrop(g,rand,room){
 const {rect,disc}=pen(g);
 // Damask wallpaper above a wooden wainscot.
 rect(54,30,892,210,K.paper);
 for(let y=46,row=0;y<236;y+=28,row++)for(let x=60+(row%2)*12;x<946;x+=24){rect(x,y,4,4,K.paperLight);rect(x-4,y+4,12,2,K.paperLight);rect(x,y+6,4,4,K.paperLight);rect(x+2,y+14,2,2,K.paperDark);}
 for(let x=54;x<946;x+=48)rect(x,30,2,206,K.paperDark);
 rect(54,30,892,12,C.woodDark);rect(54,40,892,2,C.woodLight);
 // Ceiling rail the head rides on, with pulley wheels.
 rect(54,50,892,6,C.iron);rect(54,50,892,2,C.stoneDark);
 for(let x=120;x<940;x+=140){disc(x,53,7,C.stone);disc(x,53,3,C.iron);}
 rect(54,236,892,64,C.wood);rect(54,236,892,6,C.woodLight);
 for(let x=64;x<940;x+=70){rect(x,250,58,40,C.woodDark);rect(x+2,252,54,36,C.wood);}
 // Portraits; the middle one is missing its head.
 const frame=(x,y,w,h)=>{rect(x-4,y-4,w+8,h+8,K.brass);rect(x-4,y-4,w+8,2,K.brassLight);rect(x,y,w,h,'#22202c');};
 frame(130,98,60,78);rect(146,140,28,36,'#3a4a5a');disc(160,128,10,'#c9b9a6');rect(150,118,20,6,'#1b1720');
 frame(330,94,60,82);rect(346,140,28,36,'#4a3a4e');rect(357,94,6,48,K.neck);
 frame(690,98,60,78);rect(706,140,28,36,'#2f4a44');disc(720,128,10,'#c9b9a6');rect(712,124,4,2,'#1b1720');rect(724,124,4,2,'#1b1720');
 paintLantern(g,250,150);paintLantern(g,420,150);
 // Alcove (hiding spot).
 rect(612,200,56,100,C.stoneDark);disc(640,204,28,C.stoneDark);rect(618,206,44,94,'#060b12');disc(640,208,22,'#060b12');rect(636,282,8,10,C.bone);rect(638,276,4,4,C.mint);
 // Mirror at the end: the reflection still has a long neck in it.
 rect(826,144,68,154,C.stoneLight);rect(830,148,60,146,K.glass);
 for(let i=0;i<10;i++)rect(836+i*4,284-i*12,6,6,K.glassLight);
 rect(858,148,5,70,'#3a5a70');disc(860,226,9,'#3a5a70');rect(852,236,16,40,'#2e4a5e');
 // Pulley box with two ropes running up to the rail.
 rect(492,56,3,172,'#c8b48a');rect(507,56,3,172,'#c8b48a');
 rect(468,226,64,66,C.woodDark);rect(472,230,56,58,C.wood);disc(500,256,16,C.stone);disc(500,256,6,C.iron);rect(522,262,14,4,C.iron);rect(534,252,4,14,C.red);
 // Floorboards, then a carpet runner along the lower lane.
 for(let y=300,i=0;y<480;y+=12,i++){rect(54,y,892,10,i%2?K.plank:K.plankLight);rect(54,y+10,892,2,K.plankGap);for(let x=54+((i*37)%120);x<946;x+=120+((i*13)%60))rect(x,y,2,10,K.plankGap);}
 for(let x=54;x<946;x+=2)rect(x,300,2,6,K.plankGap);
 rect(54,410,892,56,K.carpet);rect(54,410,892,4,K.brass);rect(54,462,892,4,K.brass);
 for(let x=80;x<940;x+=40){rect(x,434,8,8,K.carpetDark);rect(x+2,436,4,4,K.brass);}
 // Bottom wall: staff doors (cửa hậu), the radio on its ledge.
 rect(54,480,892,82,C.night);rect(54,480,892,16,C.woodDark);rect(54,480,892,4,C.woodLight);
 for(const dx of [205,765]){rect(dx,480,50,24,'#05090f');rect(dx+12,484,26,8,C.brass);rect(dx+16,486,18,4,C.woodDark);}
 rect(410,470,20,12,C.stoneDark);rect(412,472,10,6,C.mint);rect(426,458,2,14,C.iron);
 // Left emergency exit and the lit door at the far right.
 rect(0,404,54,72,'#05090f');rect(10,392,34,10,'#2f7a5c');rect(16,394,22,6,C.mint);
 rect(946,356,54,88,'#3b2c1c');rect(950,360,46,80,'#e7c083');for(let r=90;r>10;r-=16){g.globalAlpha=.05;disc(946,400,r,'#e7c083');}g.globalAlpha=1;
}

function paintRail(g,b){
 const {rect}=pen(g,b.x-10,b.y-50);
 rect(b.x,b.y+6,b.w,6,'#0008');
 for(let x=b.x;x<=b.x+b.w-4;x+=30)rect(x,b.y-24,4,32,K.brass);
 rect(b.x-2,b.y-28,b.w+4,6,K.brass);rect(b.x-2,b.y-28,b.w+4,2,K.brassLight);
}

// Ma Cổ Dài: white áo dài, long hair, a neck far too long. 42 × 112 art pixels plus outline.
export function paintLongNeck(){
 const [c,g]=canvas(44,114);
 const r=(x,y,w,h,col)=>{g.fillStyle=col;g.fillRect(x+1,y+1,w,h);};
 const hair='#16121a',skin='#e3d6c8',skinShade='#c3b3a3',dress='#e8ecef',dressShade='#c3cbd3',pants='#1e2430';
 r(8,10,5,44,hair);r(29,10,5,44,hair);
 r(11,2,20,6,hair);r(9,5,24,10,hair);
 r(13,9,16,18,skin);r(12,12,18,12,skin);r(26,12,3,12,skinShade);
 r(12,8,18,4,hair);r(13,12,2,5,hair);r(27,12,2,7,hair);r(20,11,2,3,hair);
 r(15,16,4,2,'#1a1418');r(23,16,4,2,'#1a1418');r(16,16,1,1,'#ffffff');r(24,16,1,1,'#ffffff');r(15,19,4,1,skinShade);r(23,19,4,1,skinShade);
 r(19,22,4,2,'#b0303c');
 r(18,27,6,30,skin);r(22,27,2,30,skinShade);for(const y of [34,41,48])r(18,y,6,1,skinShade);
 r(16,56,10,3,dress);
 r(11,58,20,22,dress);r(27,59,4,20,dressShade);r(7,59,5,20,dress);r(30,59,5,20,dressShade);r(7,79,5,4,skin);r(30,79,5,4,skinShade);
 r(22,60,1,1,'#9aa6b0');r(24,62,1,1,'#9aa6b0');r(26,64,1,1,'#9aa6b0');
 r(12,80,8,26,pants);r(22,80,8,26,pants);r(15,80,12,22,'#eef1f3');r(25,80,2,22,dressShade);
 r(12,105,8,3,C.wood);r(22,105,8,3,C.wood);
 const img=g.getImageData(0,0,44,114),d=img.data,solid=i=>d[i*4+3]>0,out=[];
 for(let y=0;y<114;y++)for(let x=0;x<44;x++){const i=y*44+x;if(solid(i))continue;if((x>0&&solid(i-1))||(x<43&&solid(i+1))||(y>0&&solid(i-44))||(y<113&&solid(i+44)))out.push(i);}
 for(const i of out){d[i*4]=18;d[i*4+1]=13;d[i*4+2]=20;d[i*4+3]=255;}
 g.putImageData(img,0,0);
 return c;
}

const PROPS={crypt:paintCrypt,grave:paintGrave,bench:paintBench,coffin:paintCoffin,rail:paintRail};

// Returns the backdrop plus one depth-sorted prop per collider block.
export function paintRoom(room){
 const rand=rng(20011031);
 const [bg,g]=canvas(500,281);
 g.fillStyle=C.night;g.fillRect(0,0,500,281);
 if(room.art==='corridor'){paintFrame(g);paintCorridorBackdrop(g,rand,room);}
 else{paintSky(g,rand);paintWall(g,rand);paintArch(g);paintFloor(g,rand,room);paintLantern(g,120,150);paintLantern(g,760,150);const coat=room.spots.find(s=>s.kind==='hide');if(coat)paintCoat(g,coat.x);}
 // Soft vignette toward the corners.
 const v=g.createRadialGradient(250,150,80,250,150,320);v.addColorStop(0,'#0000');v.addColorStop(1,'#020812a0');g.fillStyle=v;g.fillRect(0,0,500,281);
 const props=room.blocks.filter(b=>PROPS[b.art]).map(b=>{const w=b.w+20,h=b.h+56,[c,pg]=canvas(Math.ceil(w/2),Math.ceil(h/2));PROPS[b.art](pg,b,rand);return{canvas:c,x:b.x-10,y:b.y-50,w,h,sortY:b.y+b.h-6};});
 return{background:bg,props};
}

// Xác Sống, front-facing, 40 × 80 art pixels, with a dark outline pass.
export function paintZombie(){
 const [c,g]=canvas(42,82);
 const r=(x,y,w,h,col)=>{g.fillStyle=col;g.fillRect(x+1,y+1,w,h);};
 const skin='#8fb39a',skinShade='#6e927e',hair='#2b2f3a',hairLight='#434a5c',shirt='#d9dccf',shirtShade='#a9ad9f',tie='#8e2b33',pants='#2e3f63',pantsShade='#22304d',shoe='#3b2a22';
 r(9,3,22,8,hair);r(8,6,2,7,hair);r(30,6,2,7,hair);r(12,1,4,3,hair);r(20,0,5,3,hair);r(26,2,3,2,hair);r(14,4,6,1,hairLight);
 r(10,9,20,21,skin);r(9,11,22,16,skin);r(27,11,3,16,skinShade);r(7,16,2,5,skinShade);r(31,16,2,5,skinShade);
 r(9,9,22,3,hair);r(11,12,3,2,hair);r(17,12,2,3,hair);r(24,12,3,2,hair);
 r(13,17,5,4,'#f4f1d0');r(15,18,2,2,'#c23b3b');r(22,17,5,4,'#f4f1d0');r(23,18,2,2,'#c23b3b');r(13,21,5,1,skinShade);r(22,21,5,1,skinShade);
 r(23,24,6,1,'#3a2a30');r(24,23,1,3,'#3a2a30');r(26,23,1,3,'#3a2a30');r(28,23,1,3,'#3a2a30');
 r(16,26,8,2,'#3a1e22');r(17,26,1,1,'#f4f1d0');r(21,26,1,1,'#f4f1d0');
 r(17,30,6,3,skinShade);
 r(10,32,20,17,shirt);r(14,32,4,3,shirtShade);r(22,32,4,3,shirtShade);r(19,33,2,9,tie);r(26,33,4,16,shirtShade);r(12,40,3,3,'#7d8a6a');
 for(let x=10;x<30;x+=3)r(x,48,2,1,shirtShade);
 r(6,33,5,9,shirt);r(29,33,5,9,shirtShade);r(5,42,5,8,skin);r(30,42,5,8,skinShade);r(30,44,5,2,'#e8e2c8');
 r(4,49,6,4,skin);r(30,49,6,4,skinShade);r(4,53,1,2,skin);r(6,53,1,2,skin);r(8,53,1,2,skin);r(31,53,1,2,skinShade);r(33,53,1,2,skinShade);r(35,53,1,2,skinShade);
 r(10,49,20,2,shoe);
 r(11,51,8,20,pants);r(21,51,8,20,pants);r(17,51,2,20,pantsShade);r(27,51,2,20,pantsShade);r(13,60,4,3,skin);r(23,66,3,2,skinShade);
 r(11,70,3,1,pantsShade);r(16,70,3,1,pantsShade);r(22,70,4,1,pantsShade);
 r(13,71,4,2,skinShade);r(23,71,4,2,skinShade);
 r(10,73,9,5,shoe);r(21,73,9,5,shoe);r(11,76,2,2,skin);r(10,73,9,1,'#5a4033');r(21,73,9,1,'#5a4033');
 // Outline: darken transparent pixels that touch the figure.
 const img=g.getImageData(0,0,42,82),d=img.data,solid=i=>d[i*4+3]>0,out=[];
 for(let y=0;y<82;y++)for(let x=0;x<42;x++){const i=y*42+x;if(solid(i))continue;if((x>0&&solid(i-1))||(x<41&&solid(i+1))||(y>0&&solid(i-42))||(y<81&&solid(i+42)))out.push(i);}
 for(const i of out){d[i*4]=18;d[i*4+1]=13;d[i*4+2]=20;d[i*4+3]=255;}
 g.putImageData(img,0,0);
 return c;
}

// ---- Hầm Ma: minor performers, Mr. D, and dungeon tiles.

// Shared outline pass for hand-placed pixel sprites.
function outline(g,w,h){
 const img=g.getImageData(0,0,w,h),d=img.data,solid=i=>d[i*4+3]>0,out=[];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(solid(i))continue;if((x>0&&solid(i-1))||(x<w-1&&solid(i+1))||(y>0&&solid(i-w))||(y<h-1&&solid(i+w)))out.push(i);}
 for(const i of out){d[i*4]=18;d[i*4+1]=13;d[i*4+2]=20;d[i*4+3]=255;}
 g.putImageData(img,0,0);
}
function sprite(w,h,draw){const [c,g]=canvas(w+2,h+2);const r=(x,y,ww,hh,col)=>{g.fillStyle=col;g.fillRect(x+1,y+1,ww,hh);};draw(r);outline(g,w+2,h+2);return c;}

// A kid in a bedsheet: eye holes, sneakers showing underneath.
export const paintSheetGhost=()=>sprite(34,46,r=>{
 const sheet='#e9eef0',shade='#c4ccd4',dark='#9aa6b0';
 r(9,2,16,4,sheet);r(6,5,22,8,sheet);r(4,12,26,26,sheet);r(2,30,30,8,sheet);
 r(24,8,4,30,shade);r(28,30,4,8,shade);for(let x=2;x<32;x+=6){r(x,38,4,2,sheet);r(x+3,38,3,1,dark);}
 r(11,14,4,5,'#1a1418');r(19,14,4,5,'#1a1418');r(14,23,6,3,'#1a1418');
 r(6,20,2,10,shade);r(26,22,2,8,dark);
 r(9,40,7,4,'#c23b3b');r(18,40,7,4,'#c23b3b');r(9,43,7,2,'#f4f1e6');r(18,43,7,2,'#f4f1e6');
});
// A skeleton onesie with a skull mask.
export const paintSkeleton=()=>sprite(30,64,r=>{
 const suit='#1c1a24',bone='#e6e2d2',boneShade='#bdb7a4';
 r(8,1,14,14,bone);r(7,4,16,9,bone);r(19,4,3,10,boneShade);r(10,7,4,4,'#1a1418');r(17,7,4,4,'#1a1418');r(14,11,2,2,'#1a1418');r(10,14,10,2,boneShade);for(let x=11;x<20;x+=2)r(x,14,1,2,'#1a1418');
 r(13,16,4,3,suit);r(7,19,16,20,suit);r(3,20,5,18,suit);r(22,20,5,18,suit);r(9,39,5,20,suit);r(16,39,5,20,suit);
 r(14,19,2,18,bone);for(let y=21;y<36;y+=4){r(9,y,12,2,bone);}r(10,37,10,3,boneShade);
 r(4,22,3,6,bone);r(23,22,3,6,bone);r(4,30,3,7,bone);r(23,30,3,7,bone);r(3,38,5,4,bone);r(22,38,5,4,bone);
 r(10,41,3,8,bone);r(17,41,3,8,bone);r(10,51,3,7,bone);r(17,51,3,7,bone);
 r(8,59,7,4,'#2b2f3a');r(15,59,7,4,'#2b2f3a');
});
// A floating paper lantern (đèn lồng) with a face and a ragged tail.
export const paintLanternGhost=()=>sprite(30,44,r=>{
 const red='#c23b3b',redDark='#8e2b33',gold='#e7c083',glow='#ffe9a8';
 r(11,0,8,3,gold);r(14,3,2,2,gold);r(7,5,16,3,gold);
 r(4,8,22,22,red);r(2,12,26,14,red);r(4,8,22,2,redDark);r(4,28,22,2,redDark);for(const x of [9,15,21])r(x,9,1,20,redDark);
 r(9,15,4,4,glow);r(17,15,4,4,glow);r(10,16,2,2,'#1a1418');r(18,16,2,2,'#1a1418');r(12,22,6,3,glow);r(13,22,4,1,'#1a1418');
 r(7,30,16,3,gold);for(let i=0;i<5;i++)r(9+i*3,33,2,4+((i*7)%5)*2,i%2?gold:redDark);
});
// Mr. D at his snack stand: cap, glasses, staff vest.
export const paintMrD=()=>sprite(34,70,r=>{
 const skin='#e0b48f',skinShade='#c0916d',vest='#2f6b5a',shirt='#e9e4d6',cap='#2e3f63';
 r(8,2,18,6,cap);r(6,7,24,3,cap);r(9,9,16,15,skin);r(23,10,2,13,skinShade);r(10,13,6,3,'#1a1418');r(18,13,6,3,'#1a1418');r(16,14,2,1,'#1a1418');r(11,14,4,1,'#9fd4e6');r(19,14,4,1,'#9fd4e6');r(12,19,10,2,'#3a2a22');
 r(14,24,6,3,skinShade);r(7,27,20,22,shirt);r(9,27,6,22,vest);r(19,27,6,22,vest);r(16,31,2,2,'#e7c083');r(3,28,5,17,shirt);r(26,28,5,17,shirt);r(3,45,5,4,skin);r(26,45,5,4,skinShade);
 r(9,49,7,15,'#2b2f3a');r(18,49,7,15,'#2b2f3a');r(8,64,8,4,'#3b2a22');r(18,64,8,4,'#3b2a22');
});

const TILE_THEMES={
 cemetery:{floor:[C.grass,C.dirt,C.grassDark,C.grassLight],wall:C.stoneDark,face:C.stone,faceLight:C.stoneLight,cap:'#0d1a22'},
 dining:{floor:['#22384c','#1d3144','#284159','#1a2c3d'],wall:'#142a2c',face:'#1f3d3a',faceLight:'#2a4f49',cap:'#0b1620'},
 corridor:{floor:[K.plank,K.plankLight,K.plank,'#232b36'],wall:C.woodDark,face:K.paper,faceLight:K.paperLight,cap:'#120e0c'},
 catacomb:{floor:['#5a4a36','#4d3f2e','#64533c','#3f3426'],wall:'#3a2e22',face:'#8a7558',faceLight:'#a48c69',cap:'#1a140e'},
 hell:{floor:['#3c1a14','#47201a','#32140f','#55261a'],wall:'#3a0e08',face:'#5a1e14',faceLight:'#8a2e1a',cap:'#120606'},
};
// Paints a whole dungeon floor (tiles of 32 world units = 16 px) once per floor.
export function paintDungeonFloor(floor,mapW,mapH,tile){
 const theme=TILE_THEMES[floor.theme.id],rand=rng(floor.seed),px=tile/2;
 const [c,g]=canvas(mapW*px,mapH*px);g.fillStyle='#03070d';g.fillRect(0,0,c.width,c.height);
 const at=(x,y)=>x>=0&&y>=0&&x<mapW&&y<mapH&&floor.tiles[y*mapW+x]===1;
 for(let y=0;y<mapH;y++)for(let x=0;x<mapW;x++){
  const ox=x*px,oy=y*px;
  if(at(x,y)){
   for(let yy=0;yy<px;yy+=2)for(let xx=0;xx<px;xx+=2){const r=rand();g.fillStyle=theme.floor[r<.55?0:r<.75?1:r<.92?2:3];g.fillRect(ox+xx,oy+yy,2,2);}
   if(floor.theme.id==='dining'){g.fillStyle='#14243380';g.fillRect(ox,oy,px,1);g.fillRect(ox,oy,1,px);}
   if(floor.theme.id==='corridor'){g.fillStyle=K.plankGap;g.fillRect(ox,oy+px-1,px,1);if((x+y)%3===0)g.fillRect(ox+((x*5)%px),oy,1,px);}
   if(floor.theme.id==='catacomb'){g.fillStyle='#2e251a';if(x%2===0)g.fillRect(ox,oy,1,px);if(y%2===0)g.fillRect(ox,oy,px,1);}
   if(floor.theme.id==='hell'&&rand()<.16){g.fillStyle='#ff7a2e';const len=4+Math.floor(rand()*8);for(let i=0;i<len;i++)g.fillRect(ox+((i*3+x)%px),oy+((i*2+y*3)%px),2,1);}
   if(!at(x,y-1)){g.fillStyle='#0008';g.fillRect(ox,oy,px,3);}
   continue;
  }
  const near=[[0,1],[0,-1],[1,0],[-1,0],[1,1],[-1,1],[1,-1],[-1,-1]].some(([dx,dy])=>at(x+dx,y+dy));
  if(!near)continue;
  if(at(x,y+1)){
   // Wall face seen from above: a short front face with texture, a cap on top.
   g.fillStyle=theme.cap;g.fillRect(ox,oy,px,5);g.fillStyle=theme.face;g.fillRect(ox,oy+5,px,px-5);
   g.fillStyle=theme.faceLight;
   if(floor.theme.id==='cemetery'){g.fillRect(ox+((x%2)*8),oy+6,7,4);g.fillRect(ox+(((x+1)%2)*8),oy+11,7,4);}
   else if(floor.theme.id==='dining'){g.fillRect(ox+3,oy+7,2,2);g.fillRect(ox+10,oy+9,2,2);g.fillStyle=C.wood;g.fillRect(ox,oy+12,px,4);}
   else if(floor.theme.id==='catacomb'){g.fillRect(ox+((x%2)*8),oy+6,7,3);g.fillRect(ox+(((x+1)%2)*8),oy+10,7,3);if(x%5===0){g.fillStyle='#1a140e';g.fillRect(ox+4,oy+7,8,6);g.fillStyle=C.bone;g.fillRect(ox+6,oy+8,4,3);g.fillStyle='#1a140e';g.fillRect(ox+6,oy+9,1,1);g.fillRect(ox+9,oy+9,1,1);}}
   else if(floor.theme.id==='hell'){g.fillRect(ox+((x%2)*8),oy+7,6,3);g.fillStyle='#ff7a2e';if(x%3===0)g.fillRect(ox+7,oy+5,1,px-5);g.fillStyle='#ffb347';if(x%7===0)g.fillRect(ox+3,oy+12,2,2);}
   else{g.fillRect(ox+6,oy+7,3,3);g.fillStyle=C.wood;g.fillRect(ox,oy+11,px,5);}
  }else{g.fillStyle=theme.cap;g.fillRect(ox,oy,px,px);g.fillStyle=theme.wall;if(at(x-1,y))g.fillRect(ox,oy,2,px);if(at(x+1,y))g.fillRect(ox+px-2,oy,2,px);if(at(x,y-1))g.fillRect(ox,oy,px,2);}
 }
 // Decorations that do not block movement.
 const {rect,disc}=pen(g);
 for(let y=1;y<mapH-1;y++)for(let x=1;x<mapW-1;x++){
  if(!at(x,y)||!at(x,y-1)||rand()>.035)continue;const wx=x*tile+8,wy=y*tile+10;
  if(floor.theme.id==='cemetery'){if(rand()<.5){rect(wx,wy-10,14,18,C.stoneDark);rect(wx+2,wy-8,10,14,C.stone);rect(wx+6,wy-6,2,8,C.stoneEdge);}else{rect(wx,wy,10,2,C.bone);rect(wx-2,wy-2,2,6,C.bone);}}
  else if(floor.theme.id==='dining'){rect(wx,wy,6,10,'#e9e4d6');rect(wx+2,wy-4,2,4,C.mint);for(let r=16;r>4;r-=6){g.globalAlpha=.06;disc(wx+3,wy,r,C.mint);}g.globalAlpha=1;}
  else if(floor.theme.id==='catacomb'){const k=rand();if(k<.4){rect(wx,wy-6,10,8,C.bone);rect(wx+2,wy-4,2,2,'#1a140e');rect(wx+6,wy-4,2,2,'#1a140e');rect(wx+2,wy+2,6,2,C.bone);}else if(k<.7){rect(wx-4,wy,16,3,C.bone);rect(wx,wy-3,3,9,C.bone);}else{rect(wx,wy-12,4,14,'#3a2a1c');rect(wx-2,wy-16,8,4,'#5b3a26');for(let r=14;r>4;r-=5){g.globalAlpha=.08;disc(wx+2,wy-18,r,'#ffb347');}g.globalAlpha=1;rect(wx,wy-22,4,6,'#ffb347');}}
  else if(floor.theme.id==='hell'){if(rand()<.55){for(let r=18;r>6;r-=6){g.globalAlpha=.12;disc(wx+4,wy,r,'#ff5a1e');}g.globalAlpha=1;rect(wx-6,wy-3,20,7,'#ff7a2e');rect(wx-2,wy-1,12,3,'#ffd36b');}else{rect(wx,wy-4,10,8,C.bone);rect(wx+2,wy-2,2,2,'#120606');rect(wx+6,wy-2,2,2,'#120606');}}
  else{rect(wx-6,wy,20,8,K.carpet);rect(wx-6,wy,20,2,K.brass);}
 }
 return c;
}

// ---- Cats: Zin (orange), Bơ (tam thể, with his blue cap and glasses), Na (mướp, with a pink bow).
const CAT={
 zin:{base:'#e8873a',shade:'#c86a24',stripe:'#b85a1a',belly:'#f6c48e'},
 bo:{base:'#f2eee6',shade:'#d8d2c6',stripe:null,belly:'#ffffff',patches:[['#e8873a',[[5,3,6,6],[16,17,6,5],[21,20,4,4]]],['#2b2626',[[16,3,7,5],[7,19,5,5],[23,23,3,3]]]]},
 na:{base:'#8d8270',shade:'#6d6354',stripe:'#4a4237',belly:'#c9bfae'},
};
export function paintCat(kind,frame=0){
 const c=CAT[kind],k=frame?(frame-1)%4:-1,liftA=k===0?2:0,liftB=k===2?2:0;return sprite(28,31,r=>{
  r(22,16,4,3,c.shade);r(24,13,3,4,c.shade);r(21,19,3,8,c.base);
  r(6,15,16,13,c.base);r(9,18,10,9,c.belly);r(19,16,3,11,c.shade);
  r(8,27,5,3-liftA,c.belly);r(15,27,5,3-liftB,c.belly);r(4,27,4,3-liftB,c.base);r(19,27,4,3-liftA,c.shade);
  r(4,4,20,12,c.base);r(5,3,18,2,c.base);r(4,0,4,5,c.base);r(20,0,4,5,c.base);r(5,1,2,3,'#f3a3b5');r(21,1,2,3,'#f3a3b5');r(21,4,3,11,c.shade);
  if(c.stripe){r(10,4,2,3,c.stripe);r(13,4,2,4,c.stripe);r(16,4,2,3,c.stripe);r(6,17,3,2,c.stripe);r(19,19,3,2,c.stripe);r(6,22,3,2,c.stripe);r(23,13,2,2,c.stripe);}
  for(const [col,boxes] of c.patches||[])for(const b of boxes)r(...b,col);
  r(8,8,3,3,'#1a1418');r(17,8,3,3,'#1a1418');r(9,8,1,1,'#ffffff');r(18,8,1,1,'#ffffff');
  r(13,11,2,1,'#e46a86');r(12,12,1,1,'#3a2a2a');r(15,12,1,1,'#3a2a2a');
  r(2,10,3,1,'#f2eee6');r(23,10,3,1,'#f2eee6');
  if(kind==='bo'){r(4,0,20,3,'#2e5fa8');r(3,3,22,2,'#2e5fa8');r(22,4,4,1,'#2e5fa8');r(7,7,5,5,'#1a1418');r(16,7,5,5,'#1a1418');r(8,8,3,3,'#cfe3ff');r(17,8,3,3,'#cfe3ff');r(12,9,4,1,'#1a1418');r(9,9,1,1,'#1a1418');r(18,9,1,1,'#1a1418');}
  if(kind==='na'){r(19,1,3,3,'#f07aa0');r(23,1,3,3,'#f07aa0');r(22,2,1,1,'#c94a76');}
 });
}

// ---- D, the hero of Hầm Ma, built from layers so worn gear shows on him.
// look: {hat,coat,torch,bag:{style,tint:[main,shade]}, shoes,charm,badge:colour, cape:bool}; any part may be missing.
// frame 0 is standing; 1-4 are the walk cycle (legs step, arms swing, body bobs).
export const GEAR_TINT={common:['#9a9488','#77716a'],magic:['#4a86d8','#2f62a8'],rare:['#efc23a','#c39a22'],legendary:['#f0843a','#c2601f'],set:['#56b866','#3a8a48']};
const HERO={skin:'#f2c9a0',skinShade:'#d9a77c',hair:'#1c1a2e',hairHi:'#3d3868',streak:'#d9862e',eye:'#2a1a14',tee:'#2a2c55',teeShade:'#1d1e3d',pants:'#25253d',pantsShade:'#1a1a2c',sole:'#f4f1e6'};
export function paintHero(look={},frame=0){
 const k=frame?(frame-1)%4:-1,liftL=k===0?3:k===1||k===3?1:0,liftR=k===2?3:k===1||k===3?1:0,bob=k===0||k===2?-1:0,swing=k===0?1:k===2?-1:0,H=HERO;
 return sprite(32,58,r=>{
  const R=(x,y,w,h,c)=>r(x,y+bob+1,w,h,c);
  const {hat,coat,torch,bag,cape}=look,cm=coat?.tint[0],cs=coat?.tint[1];
  if(cape){R(7,20,18,25,'#a8323e');R(7,43,18,2,'#7a2430');}
  if(bag&&bag.style===0){R(5,21,22,14,bag.tint[1]);R(5,21,22,2,bag.tint[0]);}
  if(coat&&coat.style===1)R(8,9,16,11,cs);
  if(coat&&coat.style===2)R(9,14,14,6,cs);
  // Legs and shoes: the lifted leg is shorter, so the feet step.
  const shoe=look.shoes||'#c23b3b';
  for(const [x0,lift] of [[10,liftL],[17,liftR]]){const x=x0+(lift===3?(x0<16?-1:1):0);r(x,36,6,15-lift,H.pants);r(x+4,36,2,15-lift,H.pantsShade);r(x-1,51-lift,7,3,shoe);r(x-1,54-lift,7,1,H.sole);r(x,51-lift,2,1,H.sole);}
  R(9,20,14,15,H.tee);R(19,20,4,15,H.teeShade);
  if(coat){const long=coat.style===1;R(8,20,16,long?19:16,cm);R(20,20,4,long?19:16,cs);
   if(coat.style===0){R(14,21,4,14,H.tee);R(10,19,12,2,cs);R(8,34,16,2,cs);}
   else if(coat.style===1){R(15,21,1,17,cs);R(8,37,16,2,cs);}
   else{R(11,29,10,4,cs);R(13,21,1,4,H.sole);R(18,21,1,4,H.sole);R(8,34,16,2,cs);}}
  // Arms swing opposite to each other.
  for(const [x,dy,shade] of [[5,swing,false],[24,-swing,true]]){
   if(coat){R(x,20+dy,3,12,shade?cs:cm);}else{R(x,20+dy,3,5,shade?H.teeShade:H.tee);R(x,25+dy,3,7,shade?H.skinShade:H.skin);}
   R(x,32+dy,3,3,shade?H.skinShade:H.skin);}
  if(torch&&torch.style===0){R(26,31-swing,5,3,torch.tint[1]);R(26,31-swing,5,1,torch.tint[0]);R(30,30-swing,2,5,'#fff3c4');}
  if(torch&&torch.style===2){R(26,35-swing,1,2,'#b08a4a');R(24,37-swing,5,6,torch.tint[0]);R(25,38-swing,3,4,'#fff3c4');}
  if(bag&&bag.style===0){R(10,20,2,13,bag.tint[1]);R(20,20,2,13,bag.tint[1]);}
  if(bag&&bag.style===1){for(let i=0;i<12;i++)R(9+i,20+i,2,1,bag.tint[1]);R(19,30,6,5,bag.tint[0]);R(19,30,6,1,bag.tint[1]);}
  if(bag&&bag.style===2){R(23,21,1,9,bag.tint[1]);R(22,29,6,7,bag.tint[0]);R(22,29,6,1,bag.tint[1]);}
  R(14,18,4,2,H.skinShade);
  if(look.charm){R(12,20,8,1,'#b08a4a');R(15,21,2,2,look.charm);}
  if(look.badge){R(18,24,3,3,look.badge);R(19,25,1,1,'#fff');}
  R(9,5,14,13,H.skin);R(20,6,3,11,H.skinShade);R(8,10,1,3,H.skin);R(23,10,1,3,H.skinShade);
  R(12,11,2,3,H.eye);R(18,11,2,3,H.eye);R(12,11,1,1,'#fff');R(18,11,1,1,'#fff');R(15,15,2,1,'#b5655a');R(10,14,2,1,'#f3a3a0');R(20,14,2,1,'#f3a3a0');
  R(8,2,16,6,H.hair);R(7,4,2,8,H.hair);R(23,4,2,8,H.hair);R(10,0,3,3,H.hair);R(15,0,3,2,H.hair);R(20,1,3,3,H.hair);R(11,7,3,2,H.hair);R(17,7,4,2,H.hair);R(12,2,4,1,H.hairHi);R(19,2,3,1,H.streak);
  if(torch&&torch.style===1){R(8,8,16,1,'#3a4a5a');R(14,6,4,3,torch.tint[0]);R(15,7,2,1,'#fff3c4');}
  if(hat){const [m,sd]=hat.tint;
   if(hat.style===0){R(8,1,16,6,m);R(8,6,16,1,sd);R(21,6,7,2,sd);R(15,0,2,1,sd);}
   else if(hat.style===1){R(8,0,16,7,m);R(8,6,16,2,sd);for(let x=9;x<23;x+=3)R(x,1,1,5,sd);R(14,-1,4,2,H.sole);}
   else{for(let i=0;i<7;i++)R(14-i*2,-1+i,4+i*4,1,i%2?sd:m);R(2,6,28,1,sd);}}
 });
}

// ---- HUD and item icons, 16 × 16 art pixels each.
const ICONS={
 flash:r=>{r(2,6,8,5,'#3a4a5a');r(2,6,8,1,'#6d8295');r(10,5,3,7,'#9fb3c2');r(13,4,2,9,'#fff3c4');r(15,6,1,5,'#ffe08a');},
 candy:r=>{r(5,5,6,6,'#f3889c');r(6,6,2,2,'#ffd1dc');r(2,6,3,4,'#ffd36b');r(11,6,3,4,'#ffd36b');r(1,7,1,2,'#ffd36b');r(14,7,1,2,'#ffd36b');},
 bell:r=>{r(7,1,2,2,'#b08a4a');r(5,3,6,2,'#e7c083');r(4,5,8,6,'#e7c083');r(3,11,10,2,'#d4a85e');r(5,5,1,5,'#fff0c2');r(7,13,2,2,'#8a6a3a');},
 spotlight:r=>{r(2,9,5,5,'#3a4a5a');r(3,10,3,3,'#fff3c4');r(7,4,3,6,'#fff3c450');r(9,2,4,5,'#fff3c440');r(4,13,1,2,'#6d8295');},
 dash:r=>{r(6,4,6,8,'#a0ead4');r(8,3,4,2,'#a0ead4');r(1,5,4,1,'#cfe8ff');r(0,8,5,1,'#cfe8ff');r(2,11,4,1,'#cfe8ff');r(9,12,5,2,'#5fb39f');},
 bread:r=>{r(3,6,10,7,'#f4ead2');r(4,5,8,1,'#f4ead2');r(4,13,8,1,'#d8c39a');r(6,4,4,2,'#fffaf0');r(7,6,2,1,'#d8c39a');},
 battery:r=>{r(4,3,8,11,'#2e5fa8');r(6,1,4,2,'#9fb3c2');r(4,3,8,3,'#5e95e8');r(7,7,2,5,'#ffd36b');r(6,9,4,1,'#ffd36b');},
 zin:r=>{r(3,4,10,8,'#e8873a');r(3,2,2,3,'#e8873a');r(11,2,2,3,'#e8873a');r(5,7,2,2,'#1a1418');r(9,7,2,2,'#1a1418');r(7,10,2,1,'#e46a86');r(5,11,6,2,'#f6c48e');r(6,4,1,2,'#b85a1a');r(9,4,1,2,'#b85a1a');},
 bag:r=>{r(3,5,10,9,'#8a5a32');r(5,3,6,3,'#6a4022');r(3,5,10,2,'#a8743e');r(6,9,4,3,'#c99a5a');r(7,10,2,1,'#6a4022');},
 tree:r=>{r(7,1,2,14,'#e7c083');r(3,4,4,2,'#a0ead4');r(9,7,4,2,'#a0ead4');r(3,10,4,2,'#a0ead4');r(2,3,2,4,'#5fb39f');r(12,6,2,4,'#5fb39f');r(2,9,2,4,'#5fb39f');},
 key:r=>{r(2,5,5,5,'#ffd36b');r(3,6,3,3,'#3a2a1c');r(7,7,7,2,'#ffd36b');r(11,9,2,3,'#ffd36b');r(13,9,1,2,'#ffd36b');},
 stamp:r=>{r(6,1,4,5,'#7c5435');r(5,1,6,2,'#9a6a44');r(7,6,2,3,'#5b3a26');r(3,9,10,4,'#c23b3b');r(3,9,10,1,'#f3889c');r(2,13,12,1,'#8e2b33');},
 ticket:r=>{r(1,4,14,8,'#e9e4d6');r(1,4,14,1,'#ffffff');r(3,6,4,3,'#c23b3b');r(9,6,4,1,'#5b3a26');r(9,8,3,1,'#5b3a26');r(11,4,1,8,'#c9bfae');},
 coin:r=>{r(4,3,8,10,'#e7c083');r(3,5,10,6,'#e7c083');r(5,4,2,2,'#fff0c2');r(7,6,2,4,'#b08a4a');},
 use:r=>{r(5,2,2,7,'#f2d2b0');r(7,1,2,8,'#f2d2b0');r(9,2,2,7,'#f2d2b0');r(11,4,2,6,'#f2d2b0');r(4,8,9,6,'#f2d2b0');r(3,7,2,3,'#f2d2b0');r(4,13,8,1,'#c99a7a');},
 pause:r=>{r(4,3,3,10,'#e6e9e4');r(9,3,3,10,'#e6e9e4');},
 torch:r=>{r(2,6,8,5,'#3a4a5a');r(2,6,8,1,'#6d8295');r(10,5,3,7,'#9fb3c2');r(13,4,2,9,'#fff3c4');},
 coat:r=>{r(3,3,10,11,'#4a6a8a');r(1,4,3,8,'#4a6a8a');r(12,4,3,8,'#4a6a8a');r(6,3,4,3,'#2e4a66');r(7,6,2,8,'#2e4a66');r(4,10,2,2,'#e7c083');},
 charm:r=>{r(7,1,2,3,'#b08a4a');r(4,4,8,8,'#a0ead4');r(5,5,3,3,'#e9fff6');r(6,12,4,2,'#5fb39f');},
 shoes:r=>{r(1,8,7,5,'#c23b3b');r(1,12,8,2,'#f4f1e6');r(8,7,7,6,'#c23b3b');r(8,12,8,2,'#f4f1e6');r(3,9,2,1,'#f4f1e6');r(10,8,2,1,'#f4f1e6');},
 hat:r=>{r(3,4,10,6,'#2e5fa8');r(2,9,13,2,'#2e5fa8');r(12,10,4,2,'#244c88');r(6,5,3,2,'#5e95e8');},
 home:r=>{r(1,4,14,8,'#a0ead4');r(1,4,14,1,'#e9fff6');r(11,4,1,8,'#5fb39f');r(4,6,1,4,'#1d4a3e');r(3,7,3,1,'#1d4a3e');r(4,6,4,1,'#1d4a3e');r(7,6,1,3,'#1d4a3e');},
 lens:r=>{r(3,2,7,7,'#cfe8ff');r(4,3,5,5,'#e9f6ff');r(2,3,1,5,'#9fb3c2');r(10,3,1,5,'#9fb3c2');r(3,1,7,1,'#9fb3c2');r(3,9,7,1,'#9fb3c2');r(9,9,2,2,'#8a5a32');r(11,11,2,2,'#8a5a32');r(12,12,3,3,'#6a4022');r(5,4,2,1,'#ffffff');},
 hammer:r=>{r(2,2,9,5,'#9fb3c2');r(2,2,9,1,'#e6e9e4');r(10,3,3,3,'#6d8295');r(5,7,3,8,'#8a5a32');r(5,7,1,8,'#a8743e');},
 gem:r=>{r(5,2,6,2,'#ffffff');r(3,4,10,3,'#e6e9e4');r(4,7,8,3,'#c4ccd4');r(6,10,4,3,'#9aa6b0');r(7,13,2,1,'#9aa6b0');r(5,4,2,2,'#ffffff');},
 badge:r=>{r(4,2,8,8,'#e7c083');r(3,4,10,4,'#e7c083');r(6,4,4,4,'#c23b3b');r(5,10,2,5,'#2e5fa8');r(9,10,2,5,'#2e5fa8');},
};
export function paintIcon(name){return sprite(16,16,r=>ICONS[name](r));}
// A gem icon in a given colour: the white gem tinted by multiply.
export function paintGem(color){const c=paintIcon('gem'),g=c.getContext('2d');g.globalCompositeOperation='multiply';g.fillStyle=color;g.fillRect(0,0,c.width,c.height);g.globalCompositeOperation='destination-in';g.drawImage(paintIcon('gem'),0,0);return c;}
export const ICON_NAMES=Object.keys(ICONS);

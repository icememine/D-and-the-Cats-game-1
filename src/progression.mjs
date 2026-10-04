// Long-term progression for Hầm Ma: the skill tree, boss gear sets, Mr. D's town hub and Zin's
// ticket fragments. Pure data and functions; no browser code.

// ---- Skill tree: two branches of six nodes. One point per level after the first.
// A node opens once the node above it in the same branch has at least one rank.
export const SKILL_TREE=[
 {id:'beam',branch:'den',tier:0,name:'Tia sáng mạnh',max:3,text:r=>`+${8*r}% sát thương`},
 {id:'cells',branch:'den',tier:1,name:'Pin bền',max:3,text:r=>`+${15*r} pin tối đa, +${r} pin/giây`},
 {id:'dazzle',branch:'den',tier:2,name:'Chói mắt',max:2,text:r=>`Rọi đèn có ${15*r}% làm diễn viên khựng 1 giây`},
 {id:'popcandy',branch:'den',tier:3,name:'Kẹo nổ',max:1,text:()=>'Kẹo nổ tung, trúng cả diễn viên quanh đó (50% sát thương)'},
 {id:'bigbell',branch:'den',tier:4,name:'Chuông vang',max:2,text:r=>`Chuông rộng hơn ${30*r}%, hồi nhanh hơn ${1.5*r} giây`},
 {id:'stage',branch:'den',tier:5,name:'Sân khấu lớn',max:1,text:()=>'Đèn sân khấu mạnh hơn 50%, hồi nhanh hơn 3 giây'},
 {id:'nacandy',branch:'ban',tier:0,name:'Kẹo của Na',max:3,text:r=>`Kẹo của Na mạnh hơn ${25*r}%`},
 {id:'boeyes',branch:'ban',tier:1,name:'Bơ tinh mắt',max:2,text:r=>r>=2?'Bơ đánh hơi mỗi 8 giây và không bao giờ đoán sai':'Bơ đánh hơi mỗi 8 giây'},
 {id:'together',branch:'ban',tier:2,name:'Đứng chung',max:3,text:r=>`+${8*r} giáp`},
 {id:'cheer',branch:'ban',tier:3,name:'Cổ vũ',max:2,text:r=>`Na cổ vũ hồi thêm ${10*r}%, sớm hơn ${5*r} giây`},
 {id:'breather',branch:'ban',tier:4,name:'Nghỉ nhanh',max:1,text:()=>'Bạn bè nghỉ 10 giây thay vì 20'},
 {id:'friendship',branch:'ban',tier:5,name:'Tình bạn',max:1,text:()=>'Tin tưởng tăng gấp đôi; bạn bè vào tầng mới với thêm 20% can đảm'},
];
export const BRANCHES={den:'Đèn',ban:'Bạn bè'};
export const RESPEC_COST=50;
export const rank=(tree,id)=>tree?.[id]||0;
export const spentPoints=tree=>Object.values(tree||{}).reduce((a,b)=>a+b,0);
export const skillPoints=(level,tree)=>Math.max(0,level-1-spentPoints(tree));
export function canLearn(level,tree,id){
 const node=SKILL_TREE.find(n=>n.id===id);if(!node)return'unknown';
 if(rank(tree,id)>=node.max)return'max';
 if(skillPoints(level,tree)<1)return'points';
 const above=SKILL_TREE.find(n=>n.branch===node.branch&&n.tier===node.tier-1);
 if(above&&rank(tree,above.id)<1)return'locked';
 return null;
}
export function learn(level,tree,id){const why=canLearn(level,tree,id);if(why)return why;tree[id]=rank(tree,id)+1;return null;}

// ---- Boss sets: two pieces each, dropped by that theme's boss.
export const SETS={
 zombie:{name:'Bộ Xác Sống',pieces:{shoes:'Giày há mõm',bag:'Túi vải rách'},bonus:{armor:20,onBreak:3},text:'Đủ 2 món: +20 giáp, +3 can đảm mỗi lần hạ màn'},
 vampire:{name:'Bộ Ma Cà Rồng',pieces:{coat:'Áo choàng đỏ',badge:'Ghim dơi'},bonus:{leech:10},text:'Đủ 2 món: 10% sát thương gây ra hồi thành can đảm'},
 neck:{name:'Bộ Ma Cổ Dài',pieces:{hat:'Nón lá dài',charm:'Lược ngà'},bonus:{crit:12,dashCd:1},text:'Đủ 2 món: +12% chí mạng, lướt hồi nhanh hơn 1 giây'},
};
export function setBonuses(equipped){
 const out={},active=[];
 for(const [id,set] of Object.entries(SETS)){const have=Object.values(equipped).filter(it=>it?.set===id).length;if(have>=2){active.push(id);for(const [k,v] of Object.entries(set.bonus))out[k]=(out[k]||0)+v;}}
 return{bonus:out,active};
}

// ---- Mr. D's town hub, between descents. Bought with coins; kept with the character.
export const TOWN=[
 {id:'bread',kind:'stand',name:'Quầy bánh bao',levels:[60,120,200],text:l=>`Mỗi chuyến xuống hầm mang thêm ${l} bánh bao`},
 {id:'battery',kind:'stand',name:'Tủ pin',levels:[60,120,200],text:l=>`Mỗi chuyến xuống hầm mang thêm ${l} pin AA`},
 {id:'map',kind:'stand',name:'Bản đồ của Mr. D',levels:[250],text:()=>'Con dấu mỗi tầng hiện sẵn trên bản đồ nhỏ'},
 {id:'raincoat',kind:'costume',name:'Áo mưa vàng',price:120,stat:{armor:10},text:()=>'Trang phục: +10 giáp'},
 {id:'cape',kind:'costume',name:'Áo choàng sân khấu',price:120,stat:{crit:5},text:()=>'Trang phục: +5% chí mạng'},
 {id:'hoodie',kind:'costume',name:'Hoodie Ánh Trăng',price:120,stat:{speed:5},text:()=>'Trang phục: +5% tốc chạy'},
 {id:'spareLight',kind:'gadget',name:'Đèn pin phụ cho Bơ',price:150,text:()=>'Bơ làm diễn viên khựng lâu hơn 0,5 giây'},
 {id:'walkie',kind:'gadget',name:'Bộ đàm cho Bơ',price:150,text:()=>'Bơ đánh hơi con dấu, chìa khóa thường hơn'},
 {id:'camera',kind:'gadget',name:'Máy ảnh có đèn flash',price:150,text:()=>'Đèn flash của Bơ mạnh hơn 50%'},
];
export const emptyTown=()=>({stand:{},costumes:[],costume:null,gadgets:[]});
export function townPrice(town,id){
 const item=TOWN.find(t=>t.id===id);if(!item)return null;
 if(item.kind==='stand'){const lvl=town.stand[id]||0;return lvl<item.levels.length?item.levels[lvl]:null;}
 if(item.kind==='costume')return town.costumes.includes(id)?null:item.price;
 return town.gadgets.includes(id)?null:item.price;
}
// Buys or (for an owned costume) wears an item. Mutates the character. Returns null or a reason.
export function buyTown(character,id){
 character.town=character.town||emptyTown();const town=character.town,item=TOWN.find(t=>t.id===id);if(!item)return'unknown';
 if(item.kind==='costume'&&town.costumes.includes(id)){town.costume=town.costume===id?null:id;return null;}
 const price=townPrice(town,id);if(price==null)return'owned';
 if((character.gold||0)<price)return'gold';
 character.gold-=price;
 if(item.kind==='stand')town.stand[id]=(town.stand[id]||0)+1;
 else if(item.kind==='costume'){town.costumes.push(id);town.costume=id;}
 else town.gadgets.push(id);
 return null;
}
export const costumeStat=town=>TOWN.find(t=>t.id===town?.costume)?.stat||{};
export const hasGadget=(town,id)=>!!town?.gadgets?.includes(id);

// ---- Zin (Khách Số 0): one "Vé 000" fragment per theme. Three open Zin's floor.
export const FRAGMENT_CHANCE={boss:.5,elite:.1};
export const ZIN_DURATION=12;

// ---- Mr. D's forge: +1 … +10 upgrades. Each + raises the item's base stat by 12%.
// +1 to +3 always work; after that the odds fall, and a failure from +5 up drops a level.
export const MAX_PLUS=10;
export const upgradeChance=plus=>plus<3?1:[.9,.8,.7,.6,.5,.4,.3][plus-3]??0;
export const upgradeCost=item=>Math.round((15+item.ilvl*6)*(1+(item.plus||0)*.6));
export const plusBase=item=>Object.fromEntries(Object.entries(item.base).map(([k,v])=>[k,Math.round(v*(1+.12*(item.plus||0)))]));
function rebase(item,before){const after=plusBase(item);for(const k of Object.keys(after))item.stats[k]=(item.stats[k]||0)-before[k]+after[k];}
// `purse` holds the coins ({gold}); `roll` is a number in [0,1). Returns 'up', 'fail', 'down' or a reason.
export function upgradeItem(purse,item,roll){
 const plus=item.plus||0;if(plus>=MAX_PLUS)return'max';if(item.unid)return'unid';
 const cost=upgradeCost(item);if((purse.gold||0)<cost)return'gold';purse.gold-=cost;
 const before=plusBase(item);
 if(roll<upgradeChance(plus)){item.plus=plus+1;rebase(item,before);return'up';}
 if(plus>=5){item.plus=plus-1;rebase(item,before);return'down';}
 return'fail';
}

// ---- Gems: dropped by performers, set into Hiếm (1 socket), Huyền thoại and Bộ items (2). Permanent.
export const GEMS={
 ruby:{name:'Hồng ngọc',stat:'dmgPct',value:6,text:'+6% sát thương',color:'#e0445a'},
 sapphire:{name:'Lam ngọc',stat:'battery',value:15,text:'+15 pin tối đa',color:'#4a86e8'},
 emerald:{name:'Lục bảo',stat:'armor',value:8,text:'+8 giáp',color:'#3fbf6a'},
 topaz:{name:'Hoàng ngọc',stat:'crit',value:3,text:'+3% chí mạng',color:'#f2c230'},
};
export const emptyGems=()=>Object.fromEntries(Object.keys(GEMS).map(k=>[k,0]));
export const socketsFor=item=>({rare:1,legendary:2,set:2}[item.rarity]||0);
// `pouch` holds the gems ({gems:{ruby:n,…}}). Returns null or a reason.
export function socketGem(pouch,item,gem){
 if(!GEMS[gem])return'unknown';if(item.unid)return'unid';
 item.gems=item.gems||[];if(item.gems.length>=socketsFor(item))return'full';
 if(!pouch.gems?.[gem])return'none';pouch.gems[gem]--;item.gems.push(gem);
 const g=GEMS[gem];item.stats[g.stat]=(item.stats[g.stat]||0)+g.value;return null;
}

// ---- Unidentified items: Hiếm, Huyền thoại and Bộ drops hide their name and affixes until
// identified, by Mr. D (coins) or with a Kính lúp. They can't be worn before that.
export const identifyCost=item=>10+item.ilvl*4;
export function identifyItem(purse,item,{free=false}={}){
 if(!item.unid)return'known';
 if(!free){const cost=identifyCost(item);if((purse.gold||0)<cost)return'gold';purse.gold-=cost;}
 item.unid=false;return null;
}

// ---- Consumables Mr. D sells, in the dungeon and in town.
export const SUPPLIES={bread:{name:'Bánh bao',price:20,text:'+45% can đảm'},battery:{name:'Pin AA',price:20,text:'+60 pin'},ticket:{name:'Vé về',price:60,text:'Về quầy Mr. D an toàn, giữ hết đồ'},lens:{name:'Kính lúp',price:25,text:'Giám định một món đồ'}};
// Rest stops: Mr. D's floors (1, 4, 7, …). The ladder up only works there, and a new descent can start
// from the deepest one reached.
export const isRestStop=depth=>depth%3===1;

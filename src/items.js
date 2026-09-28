import * as THREE from 'three';
import {ITEMS,addItem,cannotAdd,consume,invHas,invUses,slotsOf,usedSlots,fishingMods,depthAt,schoolsAt,USE_SOUND,USABLE} from './store.js';
import {CATCHES,catchValue,money} from './catalog.js';
import {CONFIG,clamp,lerp,smooth,waveGLSL,WAVES,DROWN_TIME,insideBoat,deckHalfWidth} from './core.js';
import {ISLAND,SHOP,BERTH} from './terrain.js';
import {U} from './shaders.js';

// Efeitos dos 50 itens da Loja do Pescador. O anfitrião decide (inventário, dinheiro, barco, Nessie);
// cada cliente desenha o que vê (luzes, boias, armadilhas, algas, brilhos) e o HUD dos instrumentos.
// world.eq (snapshot): equipamento do barco e sistemas do mar. Jogador: inv, sel, bait, breath (mergulho), fed, prov, torch.
// Sem vida, frio, casco ou alagamento: o único perigo é ficar à deriva no mar.
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const angDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
export const NEW_EQ=()=>({gear:{},fuel:0,energy:100,anchor:0,anchorAt:null,anchorT:0,drogue:0,lamp:1,marks:[],beacons:[],traps:[],chum:[],rattle:0,flare:null,decoy:null,tether:0,gullsOff:0,treasure:{},photos:{},fightId:0});
export const PLAYER_STATUS=['inv','bait','breath','fed','prov','torch','hold','cartH','ride','fly'];
export const newStatus=()=>({inv:[],sel:-1,bait:null,breath:1,fed:0,prov:0,torch:0,hold:null,cartH:-1,ride:-1});
// lugares do equipamento instalado no convés (coordenadas do barco) e o tamanho do modelo
const MOUNTS={motor:[.42,.62,-3.62,.95,Math.PI],propeller:[.42,.08,-4.05,.34,0],rudder:[-.42,.3,-3.72,.75,Math.PI],anchor:[.34,.1,3.78,.62,Math.PI/2],winch:[-.32,.1,3.7,.46,0],sonar:[-.42,.83,-2.84,.36,Math.PI],radio:[.44,.83,-2.84,.32,Math.PI],barometer:[.62,.9,-2.2,.3,-Math.PI/2],battery:[.55,-.07,-2.1,.34,-Math.PI/2],lantern:[-.5,.83,2.28,.34,0],drogue:[-.55,-.07,-3.2,.42,0]};
const BOAT_TARGET={anchor:40,drogue:41,lantern:42};
const SPECIES_WATER=['fish','junk','treasure','special'];
export class Gear {
  constructor(ctx){this.c=ctx;this.zoom=0;this.pending=null;this.trail=[];this.trailT=0;this.radioMsg='';this.radioT=0;this.hydro=null;this.photoQ=null;this.mounts={};this.flags={};
    this.built=false;}
  get eq(){return this.c.world.eq;}
  // ================= inventário =================
  addItem(p,id){const why=cannotAdd(p,id,this.eq.gear);if(why)return why;addItem(p,id,this.eq.gear);return null;}
  // pode comprar? (o que já está no leitor conta)
  cannotOwn(p,id,pending=[]){const it=ITEMS[id];if(it.kind==='boat'&&this.eq.gear[id])return 'Já está instalado no barco.';
    if((it.kind==='passive'||it.kind==='tool'||it.kind==='place'||it.kind==='boat')&&(invHas(p,id)||pending.includes(id)))return 'Você já tem esse.';
    const extra=pending.filter(q=>!(ITEMS[q].kind==='bait'&&invHas(p,'tackle'))&&!invHas(p,q)).length;
    if(!invHas(p,id)&&!(it.kind==='bait'&&invHas(p,'tackle'))&&usedSlots(p)+extra>=slotsOf(p)+(pending.includes('pack')||id==='pack'?4:0))return 'Mochila cheia.';return null;}
  // melhoria do barco: sai da mochila e é instalada (uma por vez, segurando E olhando o barco)
  boatItem(p,sel){const inv=p.inv||[],e=inv[sel];if(e&&ITEMS[e[0]]?.kind==='boat'&&!this.eq.gear[e[0]])return e[0];return inv.find(q=>ITEMS[q[0]]?.kind==='boat'&&!this.eq.gear[q[0]])?.[0]||null;}
  nearBoat(p){if(!p.land)return true;const l=this.c.boat.worldToLocal(this.c.worldOf(p,.5));return Math.abs(l.z)<5.8&&Math.abs(l.x)<3;}
  installFromInv(p,sel){const id=this.boatItem(p,sel);if(!id||!this.nearBoat(p)||p.mode==='ragdoll')return;const e=p.inv.find(q=>q[0]===id);p.inv.splice(p.inv.indexOf(e),1);if(p.bait===id)p.bait=null;this.install(id);this.c.stateEvent('gear',{k:'installed',id:p.id,item:id});}
  install(id){const g=this.eq.gear;if(g[id])return 'Já estava instalado.';g[id]=1;if(id==='motor')this.eq.fuel=100;if(id==='battery'||id==='sonar'||id==='radio')this.eq.energy=100;return null;}
  // ================= pesca =================
  castMods(p,cx,cz,world=true){const C=this.c,eq=this.eq,t=C.elapsed,w=world?V(cx,0,cz):C.boat.localToWorld(V(cx,0,cz));
    const inv=new Set((p.inv||[]).map(e=>e[0]));const depth=depthAt(w.x,w.z,(x,z)=>C.island.exploded?-99:C.island.ground(x,z),ISLAND);
    const school=[...schoolsAt(t),...eq.chum.filter(c=>c.until>t)].some(s=>Math.hypot(s.x-w.x,s.z-w.z)<(s.r||10));
    const m=fishingMods({inv,bait:p.bait,gear:eq.gear,depth,weeds:this.inWeeds(w.x,w.z),school,storm:C.storm(),lantern:eq.lamp,onBoat:!p.land,anchored:eq.anchor===1,rattle:eq.rattle>t,fed:p.fed>0});
    return m;}
  onCast(p,f){// isca: um uso por lançamento; winch deixa os pesados subirem mais rápido a bordo
    f.baitUsed=p.bait||null;if(p.bait){consume(p,p.bait);if(!invHas(p,f.baitUsed))this.c.toastFor(p.id,`Acabou a isca (${ITEMS[f.baitUsed].name}).`);}
    const sp=CATCHES[f.species];f.assistK=this.eq.gear.winch&&!p.land&&(f.weight>=8||sp?.shape==='chest')?1.5:1;}
  onEscaped(p,f,hooked){if(hooked&&f.baitUsed&&invHas(p,'pliers')){const e=(p.inv||[]).find(q=>q[0]===f.baitUsed);if(e)e[1]++;else addItem(p,f.baitUsed,this.eq.gear);this.c.toastFor(p.id,'O alicate salvou a isca.');}}
  catchBonus(p,species){return CATCHES[species]?.kind==='junk'&&invHas(p,'pliers')?3:0;}
  castDist(p){return invHas(p,'rod')?11:7;}
  shallowOk(p){return p.bait==='shrimp';}
  // ================= barco =================
  boatLimits(){const eq=this.eq,g=eq.gear,L={top:5,accel:1,turn:g.rudder?1.35:1,drift:1,drag:0,stable:1};
    if(g.motor&&eq.fuel>0){L.top=8.5;L.accel=1.6;}if(g.propeller)L.top*=1.08;
    if(eq.anchor===1){L.top=Math.min(L.top,.3);L.drift=0;L.stable=.45;}if(eq.drogue){L.top=Math.min(L.top,2);L.drift*=.2;L.stable*=.5;}
    const b=this.c.boatState;if(!g.propeller&&this.inWeeds(b.x,b.z))L.drag=1.6;return L;}
  burn(dt,speed){const eq=this.eq;if(eq.gear.motor&&eq.fuel>0&&speed>.5){eq.fuel=Math.max(0,eq.fuel-dt*(.12+.5*speed/8.5));if(eq.fuel<=0)this.c.stateEvent('gear',{k:'nofuel'});}}
  inWeeds(x,z){return (this.weeds||[]).some(w=>Math.hypot(w.x-x,w.z-z)<w.r);}
  stability(){const eq=this.eq;return (eq.anchor===1?.45:1)*(eq.drogue?.5:1);}
  // ================= água: nadar, mergulhar, tesouros =================
  drownTime(p){return invHas(p,'vest')?45:DROWN_TIME;}
  swim(p,i,dt){const C=this.c,rg=C.ragdolls.active.get(p.id);if(!rg||!p.water)return;const T=rg.bodies.torso.position,eq=this.eq;
    if(i.yaw!==undefined)p.yaw=i.yaw;const pulled=C.world.rope.pid===p.id&&C.world.rope.s==='pull';const wy=C.worldYaw(p),fx=Math.sin(wy),fz=Math.cos(wy);
    const mx=fx*(i.z||0)-Math.cos(wy)*(i.x||0),mz=fz*(i.z||0)+Math.sin(wy)*(i.x||0),len=Math.hypot(mx,mz);
    const fins=invHas(p,'fins'),speed=1.15*(fins?2.6:1)*(invHas(p,'vest')?1.15:1)*(p.breath<=0?.5:1),maxDepth=fins?5:2.8;
    const surf=C.waterAt(T.x,T.z),under=T.y<surf-.55,dive=!!i.dive&&p.breath>0;
    if(!pulled){if(len>.1||dive)C.ragdolls.pull.set(p.id,{x:T.x+(len>.1?mx/len*3:0),z:T.z+(len>.1?mz/len*3:0),speed:len>.1?speed:0,depth:dive?maxDepth:0,float:invHas(p,'vest')?.12:0});else C.ragdolls.pull.delete(p.id);}
    const maxB=invHas(p,'oxygen')?75:12;if(under)p.breath=Math.max(0,p.breath-dt/maxB);else p.breath=Math.min(1,p.breath+dt/3);
    // tesouro no fundo: mergulhe perto do brilho
    if(under)this.treasures.forEach((s,k)=>{if(eq.treasure[k]>C.elapsed)return;if(Math.hypot(s.x-T.x,s.z-T.z)<2.6){eq.treasure[k]=C.elapsed+240;const r=Math.random(),sp=r<.05?24:r<.2?22:r<.4?21:r<.7?20:23;const kg=CATCHES[sp].kg[0];C.world.bucket.push([sp,kg,0]);C.stateEvent('gear',{k:'treasure',id:p.id,sp,at:[s.x,surf,s.z]});}});
    // subir: ESPAÇO perto do casco ou de chão firme
    if(i.climb){const l=C.boat.worldToLocal(V(T.x,T.y,T.z));if(Math.abs(l.z)<3.9&&Math.abs(l.x)<deckHalfWidth(clamp(l.z,-3.5,3.5))+.95)C.climbOut(p,'boat');
      else{for(const [ox,oz]of [[0,0],[1.2,0],[-1.2,0],[0,1.2],[0,-1.2],[.85,.85],[-.85,.85],[.85,-.85],[-.85,-.85]]){const g=C.ground(T.x+ox,T.z+oz);if(g>-.4&&g<T.y+1.4){C.climbOut(p,'land',[T.x+ox,T.z+oz]);return;}}C.toastFor(p.id,'Nada perto para subir. Nade até o barco, o cais ou a praia.');}}}
  // ================= anfitrião: tique =================
  hostTick(dt){const C=this.c,eq=this.eq,t=C.elapsed,g=eq.gear,storm=C.storm(),b=C.boatState;
    const driving=C.players.some(p=>p.mode==='drive'),elec=(g.sonar?.35:0)+(g.radio?.12:0);
    eq.energy=clamp(eq.energy-elec*(g.battery?1/3:1)*dt+(driving&&Math.abs(b.speed)>.8?1.5:0)*dt+(C.docked()?3:0)*dt,0,100);
    if(eq.anchor===2&&t>eq.anchorT){eq.anchor=0;eq.anchorAt=null;C.stateEvent('gear',{k:'anchor',on:0});}
    if(eq.anchor===1&&eq.anchorAt){const dx=b.x-eq.anchorAt[0],dz=b.z-eq.anchorAt[1],d=Math.hypot(dx,dz);if(d>3){b.x-=dx/d*(d-3);b.z-=dz/d*(d-3);b.speed*=.5;}}
    if(eq.drogue&&!driving){const want=Math.atan2(WAVES[0][0],WAVES[0][1]);b.heading+=angDiff(want,b.heading)*dt*.25;}
    eq.chum=eq.chum.filter(c=>c.until>t);if(eq.decoy&&eq.decoy.until<t)eq.decoy=null;if(eq.flare&&t-eq.flare.at>60)eq.flare=null;
    for(const p of C.players){if(p.mode==='gone')continue;
      p.fed=Math.max(0,(p.fed||0)-dt);p.prov=Math.max(0,(p.prov||0)-dt);if(!p.water)p.breath=Math.min(1,(p.breath??1)+dt/3);}
  }
  // velocidade de quem anda (frio, ferido, refeição, descanso, provisão)
  speedMul(p){let k=1;if(p.fed>0)k*=1.15;if(p.prov>0)k*=1.12;return k;}
  canRun(){return true;}
  // ================= anfitrião: usar item =================
  hostInput(p,i){const C=this.c;if(i.sel!==undefined&&i.sel>=-1)p.sel=i.sel;if(!i.use)return;const e=(p.inv||[])[p.sel];if(!e)return;const id=e[0],it=ITEMS[id];if(!USABLE.has(id))return;
    p.cool2=p.cool2||{};if((p.cool2[id]||0)>C.elapsed)return;p.cool2[id]=C.elapsed+(it.cool||.4);this.use(p,id,i);}
  use(p,id,i){const C=this.c,eq=this.eq,t=C.elapsed,pw=C.worldOf(p,1.2),f=C.fishing[p.id],aim=i.aimPt?V(...i.aimPt):null,dist=aim?aim.distanceTo(pw):1e9;
    const say=s=>C.toastFor(p.id,s),ev=(k,x={})=>C.stateEvent('gear',{k,id:p.id,item:id,...x}),aimWater=aim&&C.ground(aim.x,aim.z)<-.35;
    const fishOn=f&&f.phase==='reeling',kg=f?.weight||0,sp=CATCHES[f?.species];
    switch(id){
      case 'lure':case 'frog':case 'shrimp':case 'spinner':case 'cut':p.bait=p.bait===id?null:id;ev('bait',{on:p.bait?1:0});return;
      case 'harpoon':{const fight=C.fight;if(fight?.alive&&i.boss>=0&&Array.isArray(i.bossPt)&&V(...i.bossPt).distanceTo(pw)<70){eq.tether=t+8;consume(p,id);ev('tether',{at:i.bossPt});return;}
        if(fishOn&&kg>=8){f.assist(.4);f.tension=Math.max(0,f.tension-.4);consume(p,id);ev('harpoonFish');return;}say(fight?.alive?'Mire na Nessie (até 70 m) e clique para arpoar.':'O arpão serve para a Nessie ou para peixes de 8 kg ou mais na linha.');return;}
      case 'net':if(fishOn&&kg<=3&&sp?.kind==='fish'){f.assist(2);ev('net');return;}say(fishOn?'Grande demais para o passaguá (até 3 kg).':'Use o passaguá com um peixe pequeno na linha.');return;
      case 'gaff':if(fishOn&&kg>=3&&f.progress>=.55){f.assist(2);ev('gaff');return;}say(fishOn?(kg<3?'Peixe pequeno: use o passaguá.':'Traga mais perto do casco (55% da briga).'):'Use o bicheiro com um peixe pesado na linha.');return;
      case 'knife':{const k=C.world.bucket.map((q,j)=>[q,j]).reverse().find(([q])=>CATCHES[q[0]]?.kind==='fish');if(!k){say('Nada para filetar no balde.');return;}C.world.bucket.splice(k[1],1);addItem(p,'cut',eq.gear);p.prov=60;ev('knife',{sp:k[0][0]});return;}
      case 'sextant':if(!aim||dist>600){say('Mire no mar ou na terra (até 600 m).');return;}eq.marks.push([+aim.x.toFixed(1),+aim.z.toFixed(1),p.id]);if(eq.marks.length>3)eq.marks.shift();ev('mark',{at:aim.toArray()});return;
      case 'scope':return;
      case 'beacon':if(!aimWater||dist>25){say('Mire na água, até 25 m.');return;}eq.beacons.push([+aim.x.toFixed(1),+aim.z.toFixed(1)]);if(eq.beacons.length>6)eq.beacons.shift();consume(p,id);ev('beacon',{at:aim.toArray()});return;
      case 'camera':{const code=i.photo||0;let reward=0,what='';const fight=C.fight,key=p.id+':';
        if(code===1&&fight?.alive&&Math.hypot(fight.S.x-pw.x,fight.S.z-pw.z)<280){if(!eq.photos[key+'n'+eq.fightId]){eq.photos[key+'n'+eq.fightId]=1;reward=350;}what='a Nessie';}
        else if(code===2){const q=C.players.find(q=>{const g=C.fishing[q.id];return g?.phase==='reeling'&&['epico','lendario'].includes(CATCHES[g.species]?.tier);});if(q){const g=C.fishing[q.id],k2=key+'f'+q.id+':'+g.caught;if(!eq.photos[k2]){eq.photos[k2]=1;reward=60;}what=CATCHES[g.species].name;}}
        else if(code===3&&C.world.trig&&C.story>=CONFIG.asteroidAt&&C.story<CONFIG.impactAt){if(!eq.photos[key+'m']){eq.photos[key+'m']=1;reward=500;}what='o meteoro';}
        if(reward){C.world.money=Math.round((C.world.money+reward)*100)/100;}ev('photo',{reward,what,money:C.world.money});return;}
      case 'fuel':if(!eq.gear.motor){say('Instale o Motor Rabeta-40 primeiro.');return;}if(p.land){say('Abasteça a bordo.');return;}if(eq.fuel>=100){say('Tanque cheio.');return;}eq.fuel=Math.min(100,eq.fuel+50);consume(p,id);ev('fuel');return;
      case 'torch':p.torch=p.torch?0:1;ev('torch',{on:p.torch});return;
      case 'stove':{const k=C.world.bucket.map((q,j)=>[q,j]).reverse().find(([q])=>CATCHES[q[0]]?.kind==='fish'||CATCHES[q[0]]?.kind==='crustacean');if(!k){say('Pesque algo para cozinhar.');return;}C.world.bucket.splice(k[1],1);const v=catchValue(k[0][0],k[0][1]),dur=Math.round(Math.min(300,60+v*4));
        let n=0;for(const q of C.players){if(q.mode==='gone')continue;if(C.worldOf(q).distanceTo(pw)<8){q.fed=Math.max(q.fed||0,dur);n++;}}ev('cook',{sp:k[0][0],dur,n,at:pw.toArray()});return;}
      case 'chum':if(!aimWater||dist>20){say('Jogue a ceva na água, até 20 m.');return;}eq.chum.push({x:aim.x,z:aim.z,r:10,until:t+120});consume(p,id);ev('chum',{at:aim.toArray()});return;
      case 'rattle':{if(C.world.nessie&&!C.fight?.alive){const d=Math.hypot(C.boatState.x-ISLAND.x,C.boatState.z-ISLAND.z);if(d<60){say('Perto demais de Laguna: afaste o barco a 60 m da ilha.');return;}consume(p,id);ev('rattle',{nessie:1});C.summonNessie();return;}
        eq.rattle=t+90;consume(p,id);ev('rattle',{nessie:0});return;}
      case 'decoy':if(!aimWater||dist>25){say('Jogue o chamariz na água, até 25 m.');return;}eq.decoy={x:aim.x,z:aim.z,until:t+12};eq.gullsOff=t+40;consume(p,id);ev('decoy',{at:aim.toArray()});return;
      case 'flare':eq.flare={at:t,x:pw.x,y:pw.y+2,z:pw.z};consume(p,id);ev('flare',{at:pw.toArray()});return;
      case 'trap':{if(!aimWater||dist>12){say('Mire na água, até 12 m.');return;}const d=depthAt(aim.x,aim.z,(x,z)=>C.ground(x,z),ISLAND);if(d<2){say('Raso demais: a armadilha precisa de 2 m de fundo.');return;}eq.traps.push({x:+aim.x.toFixed(2),z:+aim.z.toFixed(2),o:p.id,t});consume(p,id);ev('trap',{at:aim.toArray()});return;}
    }}
  // ================= alvos no mundo (E) =================
  targets(){const out=[];for(const [id,code]of Object.entries(BOAT_TARGET)){const m=this.mounts[id];if(m&&m.visible)out.push([code,m.userData.hit]);}
    (this.trapObjs||[]).forEach((o,i)=>{if(o.visible)out.push([50+i,o.userData.hit]);});return out;}
  pos(code){if(code>=40&&code<=42){const id=Object.keys(BOAT_TARGET).find(k=>BOAT_TARGET[k]===code);return this.mounts[id]?.getWorldPosition(V());}
    if(code>=50&&code<60){const tr=this.eq.traps[code-50];return tr?V(tr.x,this.c.waterAt(tr.x,tr.z),tr.z):null;}
    return null;}
  label(code,p){const eq=this.eq,t=this.c.elapsed;
    if(code===40)return eq.anchor===1?[eq.gear.winch?'Recolher a âncora (guincho)':'Recolher a âncora (3,5 s)',1]:eq.anchor===2?['Recolhendo…',0]:['Lançar a âncora',1];
    if(code===41)return [eq.drogue?'Recolher a âncora de deriva':'Lançar a âncora de deriva',1];
    if(code===42)return [eq.lamp?'Apagar o lampião':'Acender o lampião',1];
    if(code>=50&&code<60){const tr=eq.traps[code-50];if(!tr)return null;const n=Math.min(4,Math.floor((t-tr.t)/45));return n>0?[`Puxar a armadilha (${n} ${n===1?'crustáceo':'crustáceos'})`,1]:[`Armadilha vazia · próxima em ${Math.ceil(45-(t-tr.t)%45)} s · E recolhe`,1];}
    return null;}
  interact(p,code){const C=this.c,eq=this.eq,t=C.elapsed;if(!(code>=30&&code<60))return false;const at=this.pos(code);if(!at||at.distanceTo(C.worldOf(p,1.2))>4)return true;
    if(code===40){if(eq.anchor===0){eq.anchor=1;eq.anchorAt=[C.boatState.x,C.boatState.z];C.boatState.speed*=.2;C.stateEvent('gear',{k:'anchor',on:1,id:p.id});}else if(eq.anchor===1){if(eq.gear.winch){eq.anchor=0;eq.anchorAt=null;C.stateEvent('gear',{k:'anchor',on:0,id:p.id});}else{eq.anchor=2;eq.anchorT=t+3.5;C.stateEvent('gear',{k:'anchor',on:2,id:p.id});}}return true;}
    if(code===41){eq.drogue=eq.drogue?0:1;C.stateEvent('gear',{k:'drogue',on:eq.drogue,id:p.id});return true;}
    if(code===42){eq.lamp=eq.lamp?0:1;C.stateEvent('gear',{k:'lamp',on:eq.lamp,id:p.id});return true;}
    if(code>=50&&code<60){const i=code-50,tr=eq.traps[i];if(!tr)return true;let n=Math.min(4,Math.floor((t-tr.t)/45));
      if(n<=0){if(cannotAdd(p,'trap',eq.gear)){C.toastFor(p.id,'Mochila cheia para recolher a armadilha.');return true;}eq.traps.splice(i,1);addItem(p,'trap',eq.gear);C.stateEvent('gear',{k:'trapBack',id:p.id});return true;}
      if(eq.gear.winch&&!p.land)n++;const got=[];for(let k=0;k<n;k++){const sp=CATCHES.findIndex(c=>c.name===(Math.random()<.4?'Lagosta':'Caranguejo-azul')),c=CATCHES[sp],kg=Math.round((c.kg[0]+Math.random()*(c.kg[1]-c.kg[0]))*100)/100;C.world.bucket.push([sp,kg,0]);got.push(sp);}tr.t=t;C.stateEvent('gear',{k:'haul',id:p.id,got,at:[tr.x,0,tr.z]});return true;}
    return true;}
  // ================= cliente: controles =================
  localControls(controls,dt,input){const C=this.c,p=C.me();if(!p)return;const inv=p.inv||[];
    if(controls.slot>=0){const s=controls.slot;this.sel=this.sel===s?-1:s;if(this.sel>=inv.length)this.sel=-1;this.onSel();}
    if(controls.wheel&&inv.length&&!this.zoom&&!p.fly&&(p.rifle??-1)<0){this.sel=((this.sel??-1)+controls.wheel+inv.length+1)%(inv.length+1);if(this.sel===inv.length)this.sel=-1;this.onSel();}
    if((this.sel??-1)>=inv.length)this.sel=-1;controls.sel=this.sel??-1;const id=inv[this.sel]?.[0];
    if(this.zoom&&id!=='scope')this.zoom=0;
    const free=(p.rifle??-1)<0&&!(C.world.rope.h===C.localId&&C.world.rope.s!=='tied')&&p.mode!=='guitar'&&!p.hold&&(p.cartH??-1)<0;
    if(controls.fire&&id&&USABLE.has(id)&&free&&p.mode!=='ragdoll'&&p.mode!=='drive'){controls.fire=false;controls.use=true;
      const hit=this.aimPoint(id==='sextant'?600:40);if(hit)controls.aimPt=hit.toArray().map(v=>+v.toFixed(2));
      if(id==='scope'){this.zoom=this.zoom?0:1;C.sound.effect('click');}
      if(id==='harpoon'&&C.fight?.alive){const ray=new THREE.Ray(C.camera.position.clone(),C.camera.getWorldDirection(V()));const bh=C.fight.raycast(ray,70);if(bh){controls.boss=0;controls.bossPt=bh.point.toArray().map(v=>+v.toFixed(2));}}
      if(id==='camera'){controls.photo=this.photoSubject();this.photoQ=true;}}
    // na água: mergulhar (SHIFT) e subir (ESPAÇO)
    if(p.mode==='ragdoll'&&p.water){controls.dive=!!controls.run;controls.climb=!!controls.jump;}
    // segurar E olhando o barco com uma melhoria na mochila: instala (1,2 s)
    const hv=C.hover;if(hv?.code===13&&hv.ok&&input.keys.has('KeyE')){this.installT=(this.installT||0)+dt;if(this.installT>=1.2){controls.install=true;this.installT=-.4;}}else this.installT=Math.min(0,(this.installT||0)+dt);}
  get installing(){return Math.max(0,this.installT||0)/1.2;}
  onSel(){const C=this.c,p=C.me(),e=(p?.inv||[])[this.sel];C.sound.effect('tick');if(e){const it=ITEMS[e[0]];this.tipT=4;}}
  photoSubject(){const C=this.c,cam=C.camera;cam.updateMatrixWorld();const fr=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse));
    const f=C.fight;if(f?.alive){const h=f.headWorld();if(fr.containsPoint(h)&&h.distanceTo(cam.position)<280)return 1;}
    for(const q of C.players){const g=C.fishing[q.id];if(g?.phase==='reeling'&&['epico','lendario'].includes(CATCHES[g.species]?.tier)){const s=C.fx.state[q.id];if(s?.fishPos&&fr.containsPoint(s.fishPos))return 2;}}
    if(C.world.trig&&C.story>=CONFIG.asteroidAt&&C.story<CONFIG.impactAt)return 3;return 0;}
  // raio da câmera até a água ou o chão
  aimPoint(max=40){const C=this.c,o=C.camera.position,d=C.camera.getWorldDirection(V());let prev=0;for(let t=.3;t<=max;t+=t<25?.25:2){const x=o.x+d.x*t,y=o.y+d.y*t,z=o.z+d.z*t,g=C.ground(x,z),s=g>-.35?g:C.waterAt(x,z);if(y<=s){return V(x,s,z);}prev=t;}return null;}
  fovMul(){return this.zoom?.2:1;}
  // ================= cliente: eventos =================
  event(e){const C=this.c,pl=C.players[e.id],pos=pl?C.worldOf(pl,1):null,mine=e.id===C.localId,name=ITEMS[e.item]?.name||'',at=e.at?V(...e.at):pos;
    const snd=USE_SOUND[e.item];if(snd&&!['camera','flare','trap','beacon','chum','decoy'].includes(e.item))C.sound.effect(snd,{pos});
    switch(e.k){
      case 'bait':if(mine)C.toast(e.on?`Isca no anzol: ${name}. Cada lançamento gasta um uso.`:'Isca tirada do anzol.');C.sound.effect('pick',{pos});break;
      case 'tether':C.sound.effect('harpoon',{pos});this.tetherFrom=e.id;if(mine)C.toast('ARPOADA! A Nessie está presa ao barco por 8 s: ela fica lenta e leva +50% de dano.');C.bossBanner?.('ARPOADA','8 SEGUNDOS PRESA AO BARCO');break;
      case 'harpoonFish':C.sound.effect('harpoon',{pos});if(mine)C.toast('Arpoado! A briga adiantou 40%.');break;
      case 'net':if(mine)C.toast('Passaguá! Direto para o barco.');C.sound.effect('splash',{pos:C.fx.state[e.id]?.fishPos});break;
      case 'gaff':if(mine)C.toast('Bicheiro no peixe! Embarcado.');break;
      case 'knife':if(mine)C.toast(`${CATCHES[e.sp]?.name||'Peixe'} filetado: +3 iscas de corte e uma provisão (+12% velocidade por 60 s).`);break;
      case 'mark':C.sound.effect('click',{pos});if(mine)C.toast('Ponto marcado no sextante. Aparece na bússola e na carta para todos.');break;
      case 'beacon':C.sound.effect('plop',{pos:at});if(mine)C.toast('Boia sinalizadora na água: ela pisca e aparece para toda a tripulação.');break;
      case 'photo':C.sound.effect('shutter',{pos});if(mine){this.flashT=.35;if(e.reward){C.world.money=e.money;C.moneyPop('+'+money(e.reward));C.toast(`Foto de ${e.what}! A revista Mistérios do Lago pagou ${money(e.reward)}.`);}else C.toast(e.what?`Foto de ${e.what} (já vendida para a revista).`:'Belo retrato. Ninguém paga por isso.');}break;
      case 'fuel':if(mine)C.toast('Tanque abastecido: +50%.');break;
      case 'torch':C.sound.effect('click',{pos});if(mine)C.toast(e.on?'Lanterna acesa: aponte para a água para ver tesouros, cardumes e silhuetas.':'Lanterna apagada.');break;
      case 'cook':{C.sound.effect('sizzle',{pos:at});for(let k=0;k<30;k++)C.fx.spray.emit(C.elapsed,at.x+(Math.random()-.5)*.3,at.y-.2,at.z+(Math.random()-.5)*.3,(Math.random()-.5)*.3,.6+Math.random()*.6,(Math.random()-.5)*.3,1.6,1.2,-.05,.08,.3,1);
        C.toast(`${CATCHES[e.sp]?.name||'Peixe'} na brasa! Refeição para ${e.n} ${e.n===1?'pescador':'pescadores'}: ${Math.round(e.dur/60*10)/10} min de +15% velocidade e pesca.`);break;}
      case 'chum':C.sound.effect('plop',{pos:at});if(mine)C.toast('Ceva na água: um cardume fica por aqui 2 minutos.');this.splashAt(at,20);break;
      case 'rattle':C.sound.effect('rattle',{pos});C.toast(e.nessie?'O chocalho ecoa no abismo… ALGO RESPONDEU.':'Vibrações no fundo: lendários ×4 e épicos ×2 por 90 s.');break;
      case 'decoy':C.sound.effect('plop',{pos:at});this.splashAt(at,16);C.toast('Chamariz na água! A Nessie vai atrás dele e as gaivotas somem.');break;
      case 'flare':C.sound.effect('flare',{pos});C.toast(mine?'Sinalizador disparado: ameaças marcadas e a posição do barco no HUD de todos.':`Pescador ${(pl?.net??0)+1} disparou um sinalizador!`);break;
      case 'trap':C.sound.effect('plop',{pos:at});this.splashAt(at,14);if(mine)C.toast('Armadilha no fundo. A cada 45 s pega um crustáceo (até 4). E na boia puxa.');break;
      case 'trapBack':if(mine)C.toast('Armadilha recolhida para a mochila.');C.sound.effect('pick',{pos});break;
      case 'haul':{C.sound.effect('splash',{pos:at});this.splashAt(at,24);if(mine){const names=e.got.map(s=>CATCHES[s].name);C.toast(`Armadilha: ${names.join(', ')} para o balde!`);C.showCard?.(e.got[0],CATCHES[e.got[0]].kg[1]);}break;}
      case 'treasure':{C.sound.effect('reveal',{tier:3,pos:at});this.splashAt(at,20);if(mine){C.showCard?.(e.sp,CATCHES[e.sp].kg[0]);C.toast(`Tesouro submerso! ${CATCHES[e.sp].name} foi para o balde.`);}break;}
      case 'anchor':C.sound.effect(e.on===2?'winch':'anchor',{pos:this.mounts.anchor?.getWorldPosition(V())});C.toast(e.on===1?'Âncora no fundo: o barco não deriva e balança menos.':e.on===2?'Recolhendo a âncora…':'Âncora recolhida.');break;
      case 'drogue':C.sound.effect('splash',{pos:this.mounts.drogue?.getWorldPosition(V())});C.toast(e.on?'Âncora de deriva na água: o barco segura a proa nas ondas.':'Âncora de deriva recolhida.');break;
      case 'lamp':C.sound.effect('click');break;
      case 'installed':{const m=this.mounts[e.item],at=m?m.getWorldPosition(V()):C.boat.position.clone();C.sound.effect('wrench',{pos:at});for(let k=0;k<40;k++){const a=Math.random()*6.28,s=.6+Math.random()*1.4;C.fx.spray.emit(C.elapsed,at.x,at.y+.3,at.z,Math.cos(a)*s,1+Math.random()*2,Math.sin(a)*s,.9,1.4,.5,.05,.12,0);}this.popT=1;this.popId=e.item;break;}
      case 'nofuel':C.toast('O Motor Rabeta-40 ficou sem combustível. Voltando ao motor antigo.');break;
    }}
  splashAt(at,n){if(at)this.c.fx.splash(at,n,.8);}
  // ================= cliente: visual =================
  build(){const C=this.c,scene=C.scene;this.built=true;
    // luzes fixas (a contagem de luzes nunca muda: nada recompila no meio do jogo)
    this.flareLight=new THREE.PointLight(0xff3a2a,0,160,1.4);scene.add(this.flareLight);
    this.torch=new THREE.SpotLight(0xfff2d8,0,40,.32,.5,1.2);scene.add(this.torch,this.torch.target);
    // algas: manchas perto da ilha (a Rã é boa aqui; sem a hélice antialgas o barco engasga)
    this.weeds=[];this.treasures=[];const G=(x,z)=>C.ground(x,z);
    for(let k=0;k<20&&this.weeds.length<5;k++){const a=k*2.399+.7,dirToBerth=Math.atan2(BERTH.u,BERTH.v);if(Math.abs(angDiff(a,dirToBerth))<.5)continue;for(let r=60;r<160;r+=2){const x=ISLAND.x+Math.sin(a)*r,z=ISLAND.z+Math.cos(a)*r,g=G(x,z);if(g<-1.6){this.weeds.push({x:x+Math.sin(a)*8,z:z+Math.cos(a)*8,r:9+(k%3)*2.5});break;}}}
    for(let k=0;k<30&&this.treasures.length<8;k++){const a=k*2.1+.3;for(let r=50;r<170;r+=2){const x=ISLAND.x+Math.sin(a)*r,z=ISLAND.z+Math.cos(a)*r,g=G(x,z);if(g<-3.2){if(g>-7.5&&!this.treasures.some(s=>Math.hypot(s.x-x,s.z-z)<25))this.treasures.push({x,z,y:g});break;}}}
    const blade=new THREE.PlaneGeometry(.22,1.6,1,4).rotateX(-Math.PI/2);const wm=new THREE.MeshStandardMaterial({color:0x4a6a2a,roughness:.8,side:THREE.DoubleSide});
    wm.onBeforeCompile=s=>{s.uniforms.uTime=U.uTime;s.uniforms.uStorm=U.uStorm;s.vertexShader='uniform float uTime,uStorm;\n'+waveGLSL+'\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvec4 wq=modelMatrix*instanceMatrix*vec4(transformed,1.);transformed.y+=seaHeight(wq.xz,uTime,uStorm)+.03+sin(uTime*1.7+wq.x*1.3+wq.z)*.03;');};wm.customProgramCacheKey=()=>'weeds';
    const count=this.weeds.length*140,im=new THREE.InstancedMesh(blade,wm,count),m4=new THREE.Matrix4(),q=new THREE.Quaternion(),col=new THREE.Color();let n=0;
    for(const wd of this.weeds)for(let i=0;i<140;i++){const a=Math.random()*6.283,r=Math.sqrt(Math.random())*wd.r;q.setFromAxisAngle(V(0,1,0),Math.random()*6.283);m4.compose(V(wd.x+Math.cos(a)*r,0,wd.z+Math.sin(a)*r),q,V(1,1,.6+Math.random()*.9));im.setMatrixAt(n,m4);im.setColorAt(n,col.setHSL(.2+Math.random()*.07,.45,.18+Math.random()*.1));n++;}
    im.count=n;im.frustumCulled=false;scene.add(im);this.weedMesh=im;
    // brilho dos tesouros (na superfície, fraco; a lanterna mostra de longe)
    const glint=new THREE.SpriteMaterial({map:C.flareTex(),color:0xfff0a0,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
    this.glints=this.treasures.map(s=>{const o=new THREE.Sprite(glint.clone());o.position.set(s.x,0,s.z);scene.add(o);return o;});
    this.beaconObjs=[];this.trapObjs=[];this.tentObjs=[];this.markObjs=[];
    this.tetherLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({length:24},()=>V())),new THREE.LineBasicMaterial({color:0x3a2a1a}));this.tetherLine.frustumCulled=false;this.tetherLine.visible=false;scene.add(this.tetherLine);
    this.decoyObj=null;this.flareObj=new THREE.Sprite(new THREE.SpriteMaterial({map:C.flareTex(),color:new THREE.Color(4,1,.6),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));this.flareObj.scale.setScalar(4);this.flareObj.visible=false;scene.add(this.flareObj);
    this.buildHud();}
  mini(id,size){return this.c.market.mini(id,size);}
  beaconModel(){const g=new THREE.Group(),m=this.mini('beacon',.9);g.add(m);const s=new THREE.Sprite(new THREE.SpriteMaterial({map:this.c.flareTex(),color:new THREE.Color(3,1.6,.3),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));s.position.y=.85;s.scale.setScalar(1.6);g.add(s);g.userData.blink=s;return g;}
  render(t,dt){const C=this.c,eq=this.eq;if(!eq)return;if(!this.built)this.build();const scene=C.scene,cam=C.camera.position;
    // equipamento instalado no convés
    for(const [id,[x,y,z,size,ry]]of Object.entries(MOUNTS)){if(!eq.gear[id]){if(this.mounts[id])this.mounts[id].visible=false;continue;}
      if(!this.mounts[id]){const g=this.mini(id,size);g.position.set(x,y,z);g.rotation.y=ry;const hit=new THREE.Mesh(new THREE.BoxGeometry(size*1.2,size*1.2,size*1.2),new THREE.MeshBasicMaterial({visible:false}));hit.position.y=size*.5;g.add(hit);g.userData.hit=hit;C.boat.add(g);this.mounts[id]=g;}this.mounts[id].visible=true;const pop=this.popId===id?Math.max(0,this.popT||0):0;this.mounts[id].scale.setScalar(1+pop*.5*Math.abs(Math.sin(pop*10)));}
    this.popT=Math.max(0,(this.popT||0)-dt*1.4);
    if(this.mounts.anchor)this.mounts.anchor.position.y=eq.anchor===1?-1.4:eq.anchor===2?lerp(-1.4,.1,1-clamp((eq.anchorT-t)/3.5)):.1;
    if(this.mounts.drogue)this.mounts.drogue.visible=!!eq.gear.drogue&&!eq.drogue;
    // água no porão
    // boias sinalizadoras
    while(this.beaconObjs.length<eq.beacons.length){const o=this.beaconModel();scene.add(o);this.beaconObjs.push(o);}
    this.beaconObjs.forEach((o,i)=>{const b=eq.beacons[i];o.visible=!!b;if(!b)return;o.position.set(b[0],C.waterAt(b[0],b[1])-.25,b[1]);o.rotation.z=Math.sin(t*1.3+i)*.1;o.userData.blink.material.opacity=Math.sin(t*5+i)>.2?1:.05;});
    // armadilhas: boia laranja com a corda
    while(this.trapObjs.length<eq.traps.length){const g=new THREE.Group(),buoy=new THREE.Mesh(new THREE.SphereGeometry(.2,16,12),new THREE.MeshStandardMaterial({color:0xff6a1a,roughness:.4}));g.add(buoy);const flag=new THREE.Mesh(new THREE.BoxGeometry(.02,.5,.02),new THREE.MeshStandardMaterial({color:0x222222}));flag.position.y=.35;g.add(flag);const hit=new THREE.Mesh(new THREE.SphereGeometry(.6,8,6),new THREE.MeshBasicMaterial({visible:false}));g.add(hit);g.userData.hit=hit;scene.add(g);this.trapObjs.push(g);}
    this.trapObjs.forEach((o,i)=>{const tr=eq.traps[i];o.visible=!!tr;if(tr)o.position.set(tr.x,C.waterAt(tr.x,tr.z)+.05,tr.z);});
    // chamariz, sinalizador, corda do arpão
    if(eq.decoy&&!this.decoyObj){this.decoyObj=this.mini('decoy',.9);scene.add(this.decoyObj);}if(this.decoyObj){this.decoyObj.visible=!!eq.decoy;if(eq.decoy){this.decoyObj.position.set(eq.decoy.x,C.waterAt(eq.decoy.x,eq.decoy.z)-.1,eq.decoy.z);this.decoyObj.rotation.y+=dt*1.5;}}
    const fl=eq.flare,fk=fl?t-fl.at:99;this.flareObj.visible=fk<15;this.flareLight.intensity=fk<15?(1-fk/15)*900*(.8+Math.random()*.3):0;if(fk<15){const y=fl.y+Math.min(fk,1.2)*38-Math.max(0,fk-1.2)*1.6;this.flareObj.position.set(fl.x,y,fl.z);this.flareLight.position.copy(this.flareObj.position);if(Math.random()<.5)C.fx.spray.emit(t,fl.x,y,fl.z,(Math.random()-.5)*.4,-.5,(Math.random()-.5)*.4,1.5,1,-.02,.3,1.2,1);}
    const teth=C.fight?.alive&&eq.tether>t;this.tetherLine.visible=teth;if(teth){const a=C.boat.localToWorld(V(0,.9,4.4)),b=C.fight.toWorld(V(0,6,-1)),pts=[];for(let k=0;k<24;k++){const s=k/23,p=a.clone().lerp(b,s);p.y-=Math.sin(s*Math.PI)*3*(1+Math.sin(t*6)*.1);pts.push(p);}this.tetherLine.geometry.setFromPoints(pts);}
    // lanternas de mão
    // lanterna de mão: só a do próprio jogador vira luz de verdade (cada luz a mais pesa em todo o jogo)
    {const me=C.me(),s=this.torch,on=me&&me.torch&&me.mode!=='gone'&&me.mode!=='ragdoll'&&!window.__peixesThirdPerson;s.intensity=on?60:0;if(on){s.position.copy(C.camera.position).add(V(0,-.2,0));s.target.position.copy(C.camera.position).add(C.camera.getWorldDirection(V()).multiplyScalar(10));s.target.updateMatrixWorld();}}
    // brilho dos tesouros: fraco perto; forte no facho da lanterna
    const me=C.me(),torch=me?.torch,dir=C.camera.getWorldDirection(V());
    this.glints.forEach((o,k)=>{const s=this.treasures[k],gone=eq.treasure[k]>t,d=Math.hypot(s.x-cam.x,s.z-cam.z);const lit=torch&&d<60&&V(s.x-cam.x,-cam.y,s.z-cam.z).normalize().dot(dir)>.9;const a=gone?0:lit?1:d<14?.35:0;
      o.material.opacity=a*(.6+.4*Math.sin(t*7+k*3));o.visible=a>0;o.position.set(s.x,C.waterAt(s.x,s.z)+.05,s.z);o.scale.setScalar(lit?2.2:1);});
    // cardumes: a água ferve de peixinho perto de quem está olhando
    this.boilT=(this.boilT||0)-dt;if(this.boilT<=0){this.boilT=.25;for(const s of [...schoolsAt(t),...eq.chum]){if(Math.hypot(s.x-cam.x,s.z-cam.z)>90)continue;const a=Math.random()*6.283,r=Math.random()*(s.r||10),x=s.x+Math.cos(a)*r,z=s.z+Math.sin(a)*r,y=C.waterAt(x,z);for(let k=0;k<4;k++)C.fx.spray.emit(t,x,y,z,(Math.random()-.5)*.8,.8+Math.random()*1.2,(Math.random()-.5)*.8,.7,1,.6,.04,.1,0);}}
    // rastro da rota (carta náutica)
    this.trailT-=dt;if(this.trailT<=0&&me){this.trailT=1;const w=C.worldOf(me);const l=this.trail.at(-1);if(!l||Math.hypot(l[0]-w.x,l[1]-w.z)>6){this.trail.push([w.x,w.z]);if(this.trail.length>600)this.trail.shift();}}
    this.hud(t,dt);}
  afterRender(){if(!this.photoQ)return;this.photoQ=false;try{const src=this.c.renderer.domElement,c=this.photoEl.querySelector('canvas'),x=c.getContext('2d');x.drawImage(src,0,0,c.width,c.height);this.photoEl.classList.remove('show');void this.photoEl.offsetWidth;this.photoEl.classList.add('show');clearTimeout(this.photoTimer);this.photoTimer=setTimeout(()=>this.photoEl.classList.remove('show'),3800);}catch{}}
  // ================= HUD =================
  buildHud(){const hud=document.getElementById('hud'),mk=(tag,cls,html='')=>{const e=document.createElement(tag);e.className=cls;e.innerHTML=html;hud.appendChild(e);return e;};
    this.bar=mk('div','hotbar');this.tip=mk('div','item-tip');this.status=mk('div','status-box');this.boatBox=mk('div','boat-box');this.instr=mk('div','instruments');
    this.sonar=document.createElement('canvas');this.sonar.width=this.sonar.height=180;this.sonar.className='sonar';this.instr.appendChild(this.sonar);
    this.chart=document.createElement('canvas');this.chart.width=this.chart.height=180;this.chart.className='chart';this.instr.appendChild(this.chart);
    this.compass=mk('div','compass','<div class="tape"></div><b class="needle"></b>');this.radio=mk('div','radio');this.baro=mk('div','baro');this.hydroEl=mk('div','hydro');this.depthEl=mk('div','depth-read');
    this.photoEl=mk('div','polaroid','<canvas width="320" height="180"></canvas><span>Câmera de pesquisa</span>');this.flashEl=mk('div','photo-flash');this.viewfinder=mk('div','viewfinder','<i></i><i></i><i></i><i></i><b>●REC</b>');
    this.cartBox=mk('div','cart-box');this.scanRing=mk('div','scan-ring','<svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="24"/></svg>');this.chartBase=null;}
  icon(id){return this.c.icons[id]||'';}
  hud(t,dt){const C=this.c,p=C.me(),eq=this.eq;if(!p||!this.bar)return;const inv=p.inv||[],sel=this.sel??-1,T=C.elapsed;
    // barra de itens
    const relic=C.world.temple?.relic===p.id;const key=inv.map(e=>e.join(':')).join('|')+'/'+sel+'/'+p.bait+'/'+slotsOf(p)+'/'+relic;if(key!==this.barKey){this.barKey=key;const n=Math.max(slotsOf(p),inv.length);let h=relic?`<div class="slot relic" title="Coração do Vulcão"><img src="${this.icon('relic')}" alt=""></div>`:'';
      for(let i=0;i<n;i++){const e=inv[i],it=e&&ITEMS[e[0]];h+=`<div class="slot${i===sel?' sel':''}${e&&p.bait===e[0]?' bait':''}${it&&!USABLE.has(e[0])?' passive':''}">${i<10?`<small>${(i+1)%10}</small>`:''}${it?`<img src="${this.icon(e[0])}" alt="">${it.uses?`<em>${e[1]}</em>`:''}`:''}</div>`;}this.bar.innerHTML=h;}
    this.bar.hidden=!inv.length&&!C.inStore()&&!relic;
    const e=inv[sel],it=e&&ITEMS[e[0]];this.tipT=Math.max(0,(this.tipT||0)-dt);
    const shelf=C.hover&&C.hover.code>=100?ITEMS[C.showroom?.slots[C.hover.code-100]?.id]:null,held=p.hold?ITEMS[p.hold.id]:null,show=shelf||held||(it&&(this.tipT>0||USABLE.has(e[0])));
    const ti=shelf||held||it;const tk=ti?ti.id+(shelf?'s':held?'h':'i')+(held?p.hold.s:''):'';if(tk!==this.tipKey){this.tipKey=tk;if(ti)this.tip.innerHTML=`<img src="${this.icon(ti.id)}"><div><b>${ti.name}</b><i>${ti.category}${ti.price?' · '+money(ti.price):''}${held?(p.hold.s===2?' · PAGO':p.hold.s===1?' · no leitor':' · NÃO PAGO'):''}</i><p>${ti.description}</p><p class="rule">${ti.rule}</p>${!shelf&&!held&&USABLE.has(ti.id)?'<small>BOTÃO ESQUERDO usa · 1–0 ou rodinha troca</small>':''}</div>`;}
    this.tip.classList.toggle('show',!!show);
    // status do pescador: só fôlego (mergulho), isca e bônus
    const buffs=[];if(p.fed>0)buffs.push(['🍲',p.fed]);if(p.prov>0)buffs.push(['🥩',p.prov]);if(eq.rattle>T)buffs.push(['📳',eq.rattle-T]);const air=p.breath??1;
    const sk=[Math.round(air*20),p.water?1:0,p.bait,invUses(p,p.bait),buffs.map(b=>b[0]+Math.ceil(b[1])).join()].join('/');if(sk!==this.statusKey){this.statusKey=sk;
      this.status.innerHTML=`${p.water||air<1?`<div class="st air"><i style="width:${air*100}%"></i><span>FÔLEGO</span></div>`:''}${p.bait?`<div class="chip">🪝 ${ITEMS[p.bait]?.name} · ${invUses(p,p.bait)}</div>`:''}${buffs.map(([i,s])=>`<div class="chip">${i} ${Math.ceil(s)} s</div>`).join('')}`;}
    this.status.hidden=!p.water&&!p.bait&&!buffs.length&&air>=1;
    // painel do barco: combustível, energia, âncora e deriva
    const onBoat=!p.land||p.mode==='drive',g=eq.gear,bk=[Math.round(eq.fuel),Math.round(eq.energy),eq.anchor,eq.drogue,g.motor,g.sonar||g.radio].join();
    if(bk!==this.boatKey){this.boatKey=bk;const bar=(l,v,c,warn)=>`<div class="bb${warn?' warn':''}"><span>${l}</span><i><em style="width:${v}%;background:${c}"></em></i><b>${Math.round(v)}%</b></div>`;
      this.boatBox.innerHTML=(g.motor?bar('COMBUSTÍVEL',eq.fuel,'#ffb627',eq.fuel<15):'')+(g.sonar||g.radio?bar('ENERGIA',eq.energy,'#b98cff',eq.energy<15):'')+`<div class="flags">${eq.anchor===1?'⚓ ancorado':eq.anchor===2?'⚓ recolhendo…':''}${eq.drogue?' · 🪂 deriva':''}</div>`;}
    this.boatBox.hidden=!(onBoat&&(g.motor||g.sonar||g.radio||eq.anchor||eq.drogue));
    // instrumentos
    const hasSonar=g.sonar&&eq.energy>0,hasChart=invHas(p,'chart');this.sonar.hidden=!hasSonar;this.chart.hidden=!hasChart;if(hasSonar&&C.frame%3===0)this.drawSonar(t);if(hasChart&&C.frame%6===0)this.drawChart();
    this.compass.hidden=!invHas(p,'compass');if(!this.compass.hidden&&C.frame%6===0)this.drawCompass();
    this.baro.hidden=!g.barometer;if(!this.baro.hidden&&C.frame%10===0)this.drawBaro();
    this.radio.hidden=!(g.radio&&eq.energy>0);if(!this.radio.hidden&&C.frame%15===0)this.drawRadio();
    this.hydroEl.hidden=!(invHas(p,'hydrophone')&&(C.fight?.alive||C.world.nessie));if(!this.hydroEl.hidden&&C.frame%6===0)this.drawHydro(t);
    const dp=invHas(p,'depth')&&p.mode!=='ragdoll';this.depthEl.hidden=!dp;if(dp&&C.frame%8===0){const a=this.aimPoint(40);const d=a?depthAt(a.x,a.z,(x,z)=>C.ground(x,z),ISLAND):null;this.depthEl.textContent=a&&C.ground(a.x,a.z)<-.35?`PROFUNDIDADE ${d.toFixed(1)} m${d>=20?' · FUNDO (espécies de fundo ×2)':d<6?' · RASO':''}`:'SONDA · mire na água';}
    // câmera: visor e flash
    const camSel=it?.id==='camera';this.viewfinder.hidden=!camSel;this.flashT=Math.max(0,(this.flashT||0)-dt);this.flashEl.style.opacity=String(this.flashT*2.8);
    document.body.classList.toggle('spyglass',!!this.zoom);
    // carrinho / item na mão dentro do mercado
    const cart=p.cartH>=0?C.world.mk?.carts[p.cartH]:null;const list=[...(p.hold?[p.hold]:[]),...(cart?.it||[])];const ck=list.map(q=>q.id+q.s).join()+C.world.money;
    if(ck!==this.cartKey){this.cartKey=ck;const tot=list.filter(q=>q.s<2).reduce((s,q)=>s+ITEMS[q.id].price,0);this.cartBox.innerHTML=list.length?`<b>${cart?'🛒 CARRINHO':'✋ NA MÃO'} · ${list.length} ${list.length===1?'item':'itens'}</b>${list.map(q=>`<div class="ci ${q.s===2?'paid':q.s===1?'scanned':''}"><img src="${this.icon(q.id)}"><span>${ITEMS[q.id].name}</span><em>${q.s===2?'PAGO':money(ITEMS[q.id].price)}</em></div>`).join('')}<div class="tot">A pagar <b>${money(tot)}</b> · saldo ${money(C.world.money)}</div>`:'';}
    this.cartBox.hidden=!list.length;
    const sc=Math.max(C.market.scanning,this.installing);this.scanRing.hidden=!(sc>0);if(sc>0)this.scanRing.querySelector('circle').style.strokeDashoffset=String(151*(1-sc));}
  drawSonar(t){const C=this.c,c=this.sonar.getContext('2d'),W=180,R=86,b=C.boatState,range=120,T=C.elapsed;c.clearRect(0,0,W,W);c.save();c.translate(W/2,W/2);
    c.fillStyle='rgba(4,24,20,.88)';c.beginPath();c.arc(0,0,R,0,6.283);c.fill();c.strokeStyle='rgba(80,255,170,.35)';c.lineWidth=1;for(const r of [R/3,R*2/3,R]){c.beginPath();c.arc(0,0,r,0,6.283);c.stroke();}
    const sw=(t*1.4)%6.283;const g=c.createConicGradient?c.createConicGradient(sw-1,0,0):null;if(g){g.addColorStop(0,'rgba(80,255,170,0)');g.addColorStop(.16,'rgba(80,255,170,.35)');g.addColorStop(.161,'rgba(80,255,170,0)');c.fillStyle=g;c.beginPath();c.arc(0,0,R,0,6.283);c.fill();}
    const toS=(x,z)=>{const dx=x-b.x,dz=z-b.z,h=b.heading,lx=dx*Math.cos(h)-dz*Math.sin(h),lz=dx*Math.sin(h)+dz*Math.cos(h);return [lx/range*R,-lz/range*R,Math.hypot(dx,dz)];};
    for(const s of [...schoolsAt(T),...this.eq.chum]){const [x,y,d]=toS(s.x,s.z);if(d>range)continue;c.fillStyle='rgba(120,255,190,.8)';for(let k=0;k<9;k++){c.beginPath();c.arc(x+Math.sin(k*2.1+T)*5,y+Math.cos(k*1.7+T*1.3)*4,1.6,0,6.283);c.fill();}}
    const f=C.fight;if(f?.alive){const [x,y,d]=toS(f.S.x,f.S.z);if(d<range*1.6){const k=Math.min(1,range/d);c.save();c.translate(x*k,y*k);c.rotate(f.S.heading-b.heading);c.fillStyle='rgba(255,70,50,.85)';c.beginPath();c.ellipse(0,0,6,18,0,0,6.283);c.fill();c.restore();}}
    c.fillStyle='#bfffe0';c.beginPath();c.moveTo(0,-7);c.lineTo(4,5);c.lineTo(-4,5);c.fill();c.restore();c.fillStyle='rgba(191,255,224,.8)';c.font='bold 10px Arial';c.fillText('SONAR · 120 m',10,172);c.fillText(Math.round(this.eq.energy)+'%',150,14);}
  drawChart(){const C=this.c,c=this.chart.getContext('2d'),W=180,S=1250/W,cx=ISLAND.x,cz=(ISLAND.z+(-760))/2;
    if(!this.chartBase){const b=document.createElement('canvas');b.width=b.height=W;const x=b.getContext('2d'),img=x.createImageData(W,W);for(let j=0;j<W;j++)for(let i=0;i<W;i++){const wx=cx+(i-W/2)*S,wz=cz+(j-W/2)*S,g=C.island.exploded?-99:C.island.ground(wx,wz),o=(j*W+i)*4;const land=g>-.35;const d=land?0:Math.min(1,-g/8);img.data[o]=land?214:lerp(120,28,d);img.data[o+1]=land?196:lerp(180,70,d);img.data[o+2]=land?150:lerp(200,120,d);img.data[o+3]=255;}x.putImageData(img,0,0);this.chartBase=b;}
    const P=(x,z)=>[(x-cx)/S+W/2,(z-cz)/S+W/2];c.drawImage(this.chartBase,0,0);c.fillStyle='rgba(250,240,210,.12)';c.fillRect(0,0,W,W);
    c.strokeStyle='rgba(90,40,20,.8)';c.setLineDash([3,3]);c.lineWidth=1.3;c.beginPath();this.trail.forEach(([x,z],i)=>{const [a,b]=P(x,z);i?c.lineTo(a,b):c.moveTo(a,b);});c.stroke();c.setLineDash([]);
    c.fillStyle='rgba(60,110,40,.7)';for(const w of this.weeds){const [a,b]=P(w.x,w.z);c.beginPath();c.arc(a,b,w.r/S,0,6.283);c.fill();}
    const eq=this.eq;c.fillStyle='#ff5a2a';for(const [x,z]of eq.beacons){const [a,b]=P(x,z);c.fillRect(a-2,b-2,4,4);}c.fillStyle='#ff9a1a';for(const tr of eq.traps){const [a,b]=P(tr.x,tr.z);c.beginPath();c.arc(a,b,2.5,0,6.283);c.fill();}
    c.strokeStyle='#c01818';c.lineWidth=2;for(const [x,z]of eq.marks){const [a,b]=P(x,z);c.beginPath();c.moveTo(a-4,b-4);c.lineTo(a+4,b+4);c.moveTo(a+4,b-4);c.lineTo(a-4,b+4);c.stroke();}
    const bs=C.boatState,[bx,by]=P(bs.x,bs.z);c.save();c.translate(bx,by);c.rotate(-bs.heading+Math.PI);c.fillStyle='#6a3a1a';c.beginPath();c.moveTo(0,-6);c.lineTo(3.5,5);c.lineTo(-3.5,5);c.fill();c.restore();
    const me=C.me();if(me){const w=C.worldOf(me),[a,b]=P(w.x,w.z);c.fillStyle='#2c6db8';c.beginPath();c.arc(a,b,3,0,6.283);c.fill();c.strokeStyle='#fff';c.lineWidth=1;c.stroke();}
    c.strokeStyle='#5a3a1a';c.lineWidth=4;c.strokeRect(2,2,W-4,W-4);c.fillStyle='#3a2410';c.font='bold italic 11px Georgia';c.fillText('Carta de Laguna',8,16);}
  drawCompass(){const C=this.c,dir=C.camera.getWorldDirection(V()),head=Math.atan2(dir.x,dir.z),tape=this.compass.querySelector('.tape'),me=C.me(),w=me?C.worldOf(me):C.camera.position;
    const marks=[['N',Math.PI],['L',Math.PI/2],['S',0],['O',-Math.PI/2],['NE',Math.PI*.75],['SE',Math.PI*.25],['SO',-Math.PI*.25],['NO',-Math.PI*.75]].map(([l,a])=>({l,a,c:'dir'}));
    marks.push({l:'LAGUNA',a:Math.atan2(ISLAND.x-w.x,ISLAND.z-w.z),c:'home'});for(const [x,z]of this.eq.marks)marks.push({l:'✕ '+Math.round(Math.hypot(x-w.x,z-w.z))+' m',a:Math.atan2(x-w.x,z-w.z),c:'mark'});
    for(const [x,z]of this.eq.beacons)marks.push({l:'◆ '+Math.round(Math.hypot(x-w.x,z-w.z))+' m',a:Math.atan2(x-w.x,z-w.z),c:'beacon'});if(me?.land)marks.push({l:'⛵ BARCO',a:Math.atan2(C.boatState.x-w.x,C.boatState.z-w.z),c:'home'});
    const k=marks.map(m=>{const d=angDiff(m.a,head);return Math.abs(d)<1.2?`<span class="${m.c}" style="left:${50-d/1.2*50}%">${m.l}</span>`:'';}).join('');if(k!==this.cpk){this.cpk=k;tape.innerHTML=k;}}
  drawBaro(){const C=this.c,T=C.elapsed,st=C.world.storm,s=C.storm(),hpa=Math.round(1016-s*34);let tr='estável',eta='';if(st){const k=T-st.at,d=st.dur??150;if(k<20){tr='caindo rápido';eta=`tempestade em ${Math.ceil(20-k)} s`;}else if(k<d-20){tr='muito baixa';eta=d>900?'tempestade sem fim à vista':`passa em ${Math.ceil(d-20-k)} s`;}else if(k<d){tr='subindo';eta='acalmando';}}
    this.baro.innerHTML=`<b>${hpa}</b><small>hPa</small><span>${tr}${eta?' · '+eta:''}</span><i style="transform:rotate(${(hpa-1000)*6}deg)"></i>`;}
  drawRadio(){const C=this.c,T=C.elapsed,w=C.world,b=C.boatState;let m='📻 ··· estática ··· Rádio Laguna FM: mar calmo, bons ventos.';
    if(w.storm){const k=T-w.storm.at;if(k<20)m=`📻 DEFESA CIVIL: frente fria chegando em ${Math.ceil(20-k)} s. Amarrem o barco!`;else if(k<(w.storm.dur??150))m='📻 Alerta: tempestade forte na costa de Laguna. Ventos de 60 nós.';}
    if(w.nessie&&!C.fight?.alive){const d=Math.hypot(b.x-ISLAND.x,b.z-ISLAND.z);m=`📻 Pescador da Barra: "Tem ALGO enorme lá fora, depois dos 150 m…" (vocês estão a ${Math.round(d)} m da ilha)`;}
    if(C.fight?.alive)m=`📻 GUARDA COSTEIRA: criatura de ${Math.round(C.fight.hp/30)}% de vitalidade atacando embarcação!`;if(w.trig)m='📻 URGENTE: objeto em queda sobre a ilha. EVACUEM PARA O MAR ABERTO.';
    if(this.eq.rattle>T)m='📻 Sismógrafo registra vibrações no fundo do lago…';if(m!==this.radioMsg){this.radioMsg=m;this.radio.textContent=m;C.sound.effect('static');}}
  drawHydro(t){const C=this.c,f=C.fight,me=C.me();if(!me)return;const w=C.worldOf(me),dir=C.camera.getWorldDirection(V()),head=Math.atan2(dir.x,dir.z);
    if(!f?.alive){const d=Math.hypot(C.boatState.x-ISLAND.x,C.boatState.z-ISLAND.z);this.hydroEl.innerHTML=`<b>🎧 HIDROFONE</b><span>Nenhum rugido ainda · ${d<150?`afaste o barco: ${Math.round(150-d)} m para o mar aberto`:'ela está ouvindo vocês…'}</span>`;return;}
    const a=Math.atan2(f.S.x-w.x,f.S.z-w.z),d=Math.round(Math.hypot(f.S.x-w.x,f.S.z-w.z)),rel=angDiff(a,head);const nm=this.hydro&&C.elapsed-this.hydro.t<2.5?this.hydro.name:'';
    this.hydroEl.innerHTML=`<b>🎧 HIDROFONE</b><div class="arrow" style="transform:rotate(${-rel}rad)">▲</div><span>${d} m · ${f.S.y>-3?'na superfície':'submersa'}${nm?` · <em>${nm}!</em>`:''}</span>`;}
  onBossAttack(name){const N={ram:'INVESTIDA',tripleRam:'INVESTIDAS',tail:'CAUDA',emerge:'EMERGINDO',rage:'FÚRIA',cannon:'JATO',whirlpool:'REDEMOINHO',bite:'MORDIDA POR BAIXO',wall:'PAREDE D’ÁGUA',volley:'ESPINHOS'};if(N[name])this.hydro={name:N[name],t:this.c.elapsed};}
}

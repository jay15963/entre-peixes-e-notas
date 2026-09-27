import './style.css';
import * as THREE from 'three';
import {CONFIG,SPAWNS,Lobby,Fishing,newPlayer,weatherAt,waveHeight,tsunamiHeight,insideBoat,smooth,clamp,lerp,inputPacket,storyTime} from './core.js';
import {loadAssets,setFirstPerson} from './models.js';
import {makeCharacter,addBakerOutfit,LOOKS} from './characters.js';
import {makeBoat,addHelm,addLantern,addMotor} from './boat.js';
import {CATCHES,TIERS,BALY,MESSAGES,catchValue,money} from './catalog.js';
import {Animator,Spring,lookAngles} from './animation.js';
import {FishingFX} from './fishingfx.js';
import {GullFlock} from './gulls.js';
import {makeRifle,addRack,RACK,Viewmodel,ShotFX,rigState,CYCLE,RELOAD} from './weapons.js';
import {Island} from './island.js';
import {ISLAND,BERTH,SHOP} from './terrain.js';
import {Environment} from './environment.js';
import {Cataclysm} from './cataclysm.js';
import {FluidSim} from './fluid.js';
import {Post} from './post.js';
import {U} from './shaders.js';
import {Input} from './input.js';
import {Ragdolls} from './physics.js';
import {Transport,roomCode} from './network.js';
import {Sound} from './audio.js';

const $=id=>document.getElementById(id),show=(id,value=true)=>$(id).hidden=!value;
const Y=new THREE.Vector3(0,1,0),V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
let renderer,scene,camera,environment,cataclysm,fluid,post,assets,boat,helm,lantern,motor,fx,ragdolls,gulls,rackRifles=[],viewmodel,shotFX,menuCharacters=[],island,story=45;
let running=false,solo=false,host=true,localId=0,selected=0,elapsed=0,menuTime=0,paused=false,cinematic=false,ended=false,blackout=false,titleShown=false,engineDead=false;
let players=[],models=[],fishing=[],remoteInputs={},netTick=0,lastPhase='sunset',world={impact:null,bucket:[],rifles:[-1,-1],money:0,trig:null,stolen:{}},pred=null,boatTarget=null,myNet=0,hitMarkT=0;
let lobby=new Lobby(),codeAction='',expectUnlock=false;
const BERTH_STATE=()=>({x:ISLAND.x+BERTH.u,z:ISLAND.z+BERTH.v,heading:BERTH.heading,speed:0});
let boatState=BERTH_STATE(),toastTimer=0,frameTimes=[],displayTick=0,cardTimer=0,best={};
let stepDist=0,bobPhase=0,shockAt=Infinity,reelTick=0,hold=null,warned=false,tabArm=0,stepLag=0,lastFeetW=null,seen=new Set(),balyWas=0,moneyShown=0,shotLight=null;
// Padeiro da padaria do mercado (NPC): trabalha no balcão, voa com o tapa e volta andando
const baker={mode:'work',x:0,y:0,z:0,yaw:Math.PI,t:0,path:[],model:null};
// Juice: hit-stop, câmera lenta e molas de câmera (tranco, aterrissagem, soco de FOV)
let breath=1,hitStop=0,slowMo=0,aberrPulse=0,runFov=0,strafeRoll=0,prevGrounded=true,prevSlap=0,prevHeading=0,steerVis=0,lastVy=0,lastControls={};
const kick={x:new Spring(260,17),y:new Spring(260,17),z:new Spring(220,13),fov:new Spring(200,14),dip:new Spring(170,12)};
// O rifle fica preso ao tronco, com a coronha no ombro; as mãos chegam nele por IK (animation.js)
function spawn(character){const m=makeCharacter(assets,character);m.userData.anim=new Animator(m);const gun=makeRifle();gun.visible=false;m.userData.joints.torso.add(gun);m.userData.gun=gun;boat.add(m);return m;}
function jolt(x=0,y=0,z=0,fov=0){kick.x.kick(x);kick.y.kick(y);kick.z.kick(z);kick.fov.kick(fov);}
const sound=new Sound(),input=new Input($('world')),clock=new THREE.Clock(),net=new Transport(receive,onNetStatus);
const quality=localStorage.getItem('peixes-quality')||'high';$('quality').value=quality;$('sensitivity').value=input.sensitivity;

function toast(text){if(!text)return;$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3500);}
function status(text){$('net-status').textContent=text;}
function fail(error){console.error(error);show('loading',false);show('fatal');$('fatal-message').textContent=error instanceof Error?error.message:String(error);}
const me=()=>pred||players[localId];
// Cada jogador está no barco (coordenadas do barco) ou em terra (coordenadas do mundo, p.land=1)
function worldOf(p,y=0){return p.land?V(p.x,(p.height||0)+y,p.z):boat.localToWorld(V(p.x,CONFIG.deckY+(p.height||0)+y,p.z));}
const deckPos=p=>worldOf(p,1.2);
const worldYaw=p=>p.yaw+(p.land?0:boatState.heading);
const docked=()=>Math.hypot(boatState.x-(ISLAND.x+BERTH.u),boatState.z-(ISLAND.z+BERTH.v))<30;
function stateEvent(name,payload={}){event(name,payload);if(!solo&&host)net.send({type:'event',name,payload});}
function toastFor(id,text){if(id===localId)toast(text);else if(host&&!solo)net.send({type:'event',name:'toast',payload:{id,text}});}

// ---------- Eventos (anfitrião aplica e retransmite; convidado apenas aplica) ----------
function event(name,p){
  const pl=players[p.id],pos=pl?deckPos(pl):null;
  if(name==='toast'&&p.id===localId)toast(p.text);
  if(name==='slap'){sound.effect(p.hit?'slap':'whoosh',{pos});if(pl)pl.slap=1;if(p.hit&&p.id===localId){hitStop=.09;jolt(-.6,0,2.2,-9);aberrPulse=.6;}else if(p.id!==localId&&!p.hit)models[localId]?.userData.anim?.flinch.kick(-4);}
  if(name==='ragdoll'){const m=models[p.id];if(m){ragdolls.launch(p.id,m,p.velocity);sound.effect('launch',{pos});if(p.id===localId){aberrPulse=1.2;jolt(3,4,-6,14);}if(p.id===localId)toast(p.reason==='water'?'Você esqueceu que não é um peixe.':p.reason==='boom'?'A ilha explodiu. Você foi junto.':'A amizade veio com força.');}}
  if(name==='splash'){const at=V(...p.position);environment.burst(at);sound.effect('splash',{pos:at});if(p.id===localId)toast('A água rejeitou sua presença.');}
  if(name==='respawn'){ragdolls.remove(p.id);if(p.id===localId){toast(p.water?'De volta ao barco. A dignidade fica no mar.':'Você se levantou. Doeu mais no orgulho.');input.pitch=-.1;}}
  if(name==='cast')sound.effect('cast',{pos});
  if(name==='bite'){fx.event('bite',p.id);sound.effect('bite',{pos:fx.state[p.id]?.bobber.position});if(p.id===localId){pop('bite-pop');jolt(-1.5,0,.8,-3);}}
  if(name==='nibble'){fx.event('nibble',p.id);sound.effect('plop',{pos:fx.state[p.id]?.bobber.position});if(p.id===localId)jolt(-.4);}
  if(name==='jump'){fx.event('jump',p.id);sound.effect('splash',{pos:fx.state[p.id]?.fishPos});if(p.id===localId)jolt(1.2,0,1.5,-2);}
  if(name==='run'){fx.event('run',p.id);sound.effect('run',{pos:fx.state[p.id]?.fishPos});if(p.id===localId){jolt(2.4,(Math.random()-.5)*3,2,-4);aberrPulse=.35;}}
  if(name==='caught'){fx.event('caught',p.id,p);sound.effect('splash',{pos:fx.state[p.id]?.fishPos});if(p.id===localId){slowMo=.45;jolt(3,0,-2,-8);$('toast').classList.remove('show');}else sound.effect('fish',{pos});}
  if(name==='escaped'){const hooked=!!fx.state[p.id]?.fish;fx.event('escaped',p.id);sound.effect(hooked?'snap':'escaped',{pos});if(p.id===localId){toast(hooked?'A linha arrebentou. Ele vai contar essa história.':'O peixe tinha outros planos.');jolt(-2.5,0,-1.5,6);models[localId]?.userData.anim?.tug.kick(8);}}
  if(name==='drive'){sound.effect('helm',{pos});if(p.id===localId){if(p.on){input.yaw=0;input.pitch=-.12;toast('Leme assumido · W/S acelera · A/D vira · E solta');}else toast('Você largou o leme.');}}
  if(name==='engine')toast('O motor apagou. Não há para onde fugir.');
  if(name==='rifle'){world.rifles[p.slot]=p.on?p.id:-1;sound.effect('rack',{pos});if(p.id===localId)toast(p.on?'Rifle na mão · botão direito mira · botão esquerdo atira · E devolve':'Rifle de volta ao suporte.');}
  if(name==='shot'){const m=models[p.id];m?.userData.anim?.fire();const local=p.id===localId&&viewmodel.gun.visible;const muzzle=m?.userData.gun?.userData.muzzle;const from=local?camera.localToWorld(V(.12,-.1,-.9)):muzzle?muzzle.getWorldPosition(V()):pos;const to=V(...p.to);shotFX.tracer(from,to);
    sound.effect('gunshot',{pos:local?null:from,far:!local});muzzleSmoke(from,to);shotLight.position.copy(from);shotLight.intensity=30;
    if(local){viewmodel.fire();jolt(5,(Math.random()-.5)*1.8,1.4,-6);aberrPulse=.4;}else{setTimeout(()=>sound.effect('boltBack',{pos:from}),420);setTimeout(()=>sound.effect('boltFwd',{pos:from}),560);}}
  if(name==='gullHit'){const at=boat.localToWorld(V(...p.pos));fx.splash(at,26,.9,1.4);feathers(at);sound.effect('feathers',{pos:at});if(p.id===localId){hitMarkT=.45;sound.effect('hitmark');hitStop=.05;toast(p.hadFish?(p.overBoat?'Na mosca! O peixe caiu de volta no barco.':'Acertou! Mas o peixe caiu no mar.'):'Gaivota abatida!');}}
  if(name==='stolen'){fx.steal(boat);const g=gulls.gulls[p.gull];sound.effect('gull',{pos:g?boat.localToWorld(g.pos.clone()):null});toast('A gaivota pegou um peixe! Ela está pesada e lenta: ATIRE!');}
  if(name==='dive'){const g=gulls.gulls[p.gull];sound.effect('dive',{pos:g?boat.localToWorld(g.pos.clone()):null});toast('⚠ Gaivota ladra mergulhando no balde!');}
  if(name==='lost')toast('A gaivota fugiu com o peixe.');
  if(name==='gullSplash'){const at=boat.localToWorld(V(...p.pos));fx.splash(at,18,.8);sound.effect('plop',{pos:at});}
  if(name==='reload'){if(p.id===localId)viewmodel.reload();else{sound.effect('magOut',{pos});setTimeout(()=>sound.effect('magIn',{pos}),1500);}}
  if(name==='sold'){world.money=p.money;const v=p.total;sound.effect('cash');moneyPop('+'+money(v));confetti('#ffd23c',40+Math.min(80,p.count*6));if(p.id===localId)toast(`Vendido! ${p.count} ${p.count===1?'item':'itens'} por ${money(v)}.`+(p.best?` O destaque: ${CATCHES[p.best[0]].name}.`:''));else toast(`Pescador ${players[p.id]?.net+1||''} vendeu o balde por ${money(v)}.`);}
  if(name==='baly'){sound.effect('baly');if(p.id===localId){toast('BALY! 30 segundos de energia em TUDO!');aberrPulse=1.5;jolt(-3,0,4,18);}}
  if(name==='trigger'){sound.effect('alarm');toast('O METEORO VAI CAIR NA ILHA! Todo mundo para o barco e fujam para o mar aberto!');}
  if(name==='thud'){sound.effect('thud',{pos:boat.position});if(me()&&!me().land)jolt(3,0,2,-4);}
  if(name==='bakerSlap'){if(baker.model){ragdolls.launch('baker',baker.model,p.velocity);sound.effect('launch',{pos:baker.model.position});}if(p.boom)return;const b=['Ô, loco! O pão tá no forno!','O padeiro foi assar do outro lado da loja.','Pão francês voando: saiu quentinho.'];toast(b[Math.floor(Math.random()*b.length)]);}
  if(name==='bakerUp')ragdolls.remove('baker');
  if(name==='explode'&&!island.exploded){island.explode();ragdolls.removeIsland();}
}

// ---------- Lobby e rede ----------
function updateLobby(){const list=lobby.snapshot(),connected=net.connected||solo;
  for(let i=0;i<CONFIG.characters;i++){const p=list.find(q=>q.character===i);$('char'+i).classList.toggle('selected',(p&&p.id===myNet)||(!net.connected&&selected===i));$('char'+i).classList.toggle('taken',!!p&&p.id!==myNet);
    $('ready'+i).textContent=p?(p.id===myNet?'VOCÊ':'PESCADOR '+(p.id+1))+(p.ready?' · PRONTO ✓':' · AGUARDANDO'):'LUGAR DISPONÍVEL';}
  const mine=list.find(p=>p.id===myNet);$('ready').disabled=!net.connected;$('ready').firstChild.textContent=mine?.ready?'CANCELAR PRONTO ':'ESTOU PRONTO ';
  $('ready-hint').textContent=!net.connected?'Aguardando outros pescadores (2 a 4).':list.length<2?'Precisa de pelo menos 2 pescadores.':`${list.length} a bordo · começa quando todos estiverem prontos.`;
  if(host&&net.host&&lobby.canStart&&!running){const roster=lobby.snapshot();net.send({type:'start',players:roster});start(false,roster);}}
function broadcastLobby(){net.send({type:'lobby',players:lobby.snapshot()});updateLobby();}
function onNetStatus(s,id){
  if(s==='peer-join'&&net.host){host=true;myNet=0;if(!lobby.players.has(0)){lobby=new Lobby();lobby.join(0,selected);}const c=lobby.freeCharacter();if(c>=0)lobby.join(id,c);status(`${lobby.players.size} pescadores na sala. Todos marcam “Estou pronto” para zarpar.`);broadcastLobby();$('ready').disabled=false;show('connection',false);}
  else if(s==='peer-leave'&&net.host){lobby.leave(id);broadcastLobby();const idx=players.findIndex(p=>p.net===id);if(running&&idx>=0){players[idx].mode='gone';players[idx].x=99;if(models[idx])models[idx].visible=false;ragdolls.remove(idx);world.rifles=world.rifles.map(r=>r===idx?-1:r);toast(`Pescador ${id+1} saiu do barco.`);}else status(net.connected?`${lobby.players.size} pescadores na sala.`:'Aguardando outros pescadores.');}
  else if(s==='connected'&&!net.host){host=false;status('Conectado! Escolha seu personagem e marque “Estou pronto”.');net.send({type:'hello',character:selected});$('ready').disabled=false;show('connection',false);}
  else if(s==='full')status('Esse barco já está cheio (4 pescadores).');
  else if(s==='disconnected'){status('A conexão caiu. Entre em uma nova sala para jogar de novo.');$('ready').disabled=true;if(running&&!ended){paused=true;input.enabled=false;expectUnlock=true;input.unlock();show('lobby');toast('O anfitrião desconectou. A partida foi pausada.');}}
  else if(s==='error')status('A conexão não abriu. Tente de novo ou use a conexão manual.');
}
function receive(p,from){
  if(net.host){
    // o convidado chega com um personagem preferido: se estiver livre, é dele (mesmo que já tenha recebido outro ao entrar)
    if(p.type==='hello'){const pref=Number.isInteger(p.character)?p.character:0,cur=lobby.players.get(from);if(!cur){const c=lobby.freeCharacter(pref);if(c>=0)lobby.join(from,c);}else if(cur.character!==pref&&lobby.freeCharacter(pref)===pref){try{lobby.join(from,pref);}catch{}}broadcastLobby();}
    if(p.type==='pick'&&!running){try{lobby.join(from,p.character);}catch{}broadcastLobby();}
    if(p.type==='ready'){lobby.ready(from,p.ready);broadcastLobby();}
    if(p.type==='input'){const i=inputPacket(p),prev=remoteInputs[from]||{};remoteInputs[from]={...i,interact:i.interact||prev.interact,cast:i.cast||prev.cast,slap:i.slap||prev.slap,jump:i.jump||prev.jump,fall:i.fall||prev.fall,fire:i.fire||prev.fire,gull:i.fire?i.gull:prev.fire?prev.gull:-1,ray:i.fire?i.ray:prev.ray};}
    if(p.type==='bye')net.dropPeer(from);
    return;
  }
  if(p.type==='welcome'){myNet=p.id;updateLobby();}
  if(p.type==='lobby'){lobby=new Lobby();for(const item of p.players){lobby.join(item.id,item.character);lobby.ready(item.id,item.ready);}const mine=lobby.players.get(myNet);if(mine)selected=mine.character;updateLobby();menuCharacters.forEach((m,k)=>m.visible=true);}
  if(p.type==='start')start(false,p.players);
  if(p.type==='snapshot'&&running)applySnapshot(p);
  if(p.type==='event'&&running)event(p.name,p.payload);
  if(p.type==='bye'){net.close();onNetStatus('disconnected');}
}
function applySnapshot(p){
  const drift=p.time-elapsed;if(Math.abs(drift)>.6)elapsed=p.time;else elapsed+=drift*.15;
  boatTarget=p.boat;boatState.heading=p.boat.heading;boatState.speed=p.boat.speed;if(p.bucket)world.bucket=p.bucket;if(p.rifles)world.rifles=p.rifles;world.money=p.money??world.money;world.trig=p.trig||null;if(p.baker)Object.assign(baker,{mode:p.baker[0],x:p.baker[1],y:p.baker[2],z:p.baker[3],yaw:p.baker[4]});
  if(p.impact){if(!world.impact||world.impact.d!==p.impact.d){world.impact={...p.impact};cataclysm.setImpact(world.impact);}}
  for(const sp of p.players){const q=players[sp.id];if(!q)continue;
    if(sp.id===localId){const {x,z,height,yaw,pitch,speed,...rest}=sp;Object.assign(q,rest,{x,z,height});pred.mode=sp.mode;pred.fish=sp.fish;pred.slap=sp.slap;pred.rifle=sp.rifle;pred.ammo=sp.ammo;pred.reload=sp.reload;pred.baly=sp.baly;if(sp.mode!=='walk'||sp.tp!==pred.tp){if(pred.land!==sp.land)input.yaw+=(sp.land?1:-1)*boatState.heading;pred.x=x;pred.z=z;pred.height=height;pred.land=sp.land;pred.vy=0;pred.tp=sp.tp;}}
    else Object.assign(q,sp);
    if(sp.mode==='gone'&&models[sp.id])models[sp.id].visible=false;}
  for(let i=0;i<p.fishing.length;i++)if(fishing[i])Object.assign(fishing[i],p.fishing[i]);
  if(p.ragdolls)ragdolls.sync(p.ragdolls,id=>id==='baker'?baker.model:models[id]);
  gulls.apply(p.gulls);
}
function snapshot(){return {type:'snapshot',time:elapsed,boat:boatState,impact:world.impact,bucket:world.bucket,money:world.money,trig:world.trig,baker:[baker.mode,+baker.x.toFixed(2),+baker.y.toFixed(2),+baker.z.toFixed(2),+baker.yaw.toFixed(2)],rifles:world.rifles,gulls:gulls.snapshot(),players,ragdolls:ragdolls.active.size?ragdolls.snapshot():null,fishing:fishing.map(f=>({phase:f.phase,progress:f.progress,tension:f.tension,target:f.target,needle:f.needle,vel:f.vel,run:f.run,species:f.species,caught:f.caught,combo:f.combo}))};}
function changeCharacter(i){selected=i;if(net.connected){if(net.host){try{lobby.join(0,i);}catch{toast('Esse personagem já foi escolhido.');}broadcastLobby();}else net.send({type:'pick',character:i});return;}lobby=new Lobby();lobby.join(0,i);updateLobby();}

// ---------- Partida ----------
function start(isSolo,roster){
  if(running)return;solo=isSolo;host=isSolo||net.host;const ros=[...roster].sort((a,b)=>a.id-b.id);localId=isSolo?0:Math.max(0,ros.findIndex(r=>r.id===(host?0:myNet)));roster=ros;running=true;paused=false;elapsed=0;ended=false;cinematic=false;boatState=BERTH_STATE();
  players=roster.map((p,i)=>({...newPlayer(i,p.character),net:p.id}));world={impact:null,bucket:[],rifles:[-1,-1],money:0,trig:null,stolen:{}};fishing=players.map(()=>new Fishing());models=players.map(p=>spawn(p.character));menuCharacters.forEach(m=>m.visible=false);
  pred=host?null:{...players[localId]};setFirstPerson(models[localId],true);viewmodel.setLook(LOOKS[players[localId].character]);
  input.enabled=true;input.yaw=Math.PI;input.pitch=-.06;input.lock();show('lock-hint',!input.locked);sound.start();show('home',false);show('lobby',false);show('settings',false);show('hud');show('test-tools',isSolo);document.body.classList.add('playing');
  toast(isSolo?'Teste solo · atracados no cais da vila · F pesca · E leme/rifle · TAB chama o meteoro':`${players.length} a bordo, atracados no cais da vila. Pesquem, vendam no mercado e cuidado com as gaivotas!`);
}
function dropRifle(p){if(p.rifle<0)return;const slot=p.rifle;p.rifle=-1;world.rifles[slot]=-1;stateEvent('rifle',{id:p.id,slot,on:false});}
function rag(id,reason,velocity){const p=players[id];if(p.mode==='ragdoll'||p.mode==='gone')return;dropRifle(p);p.mode='ragdoll';p.ragTime=0;fishing[id].reset();stateEvent('ragdoll',{id,reason,velocity:velocity||[(Math.random()-.5)*3,-1,(Math.random()-.5)*3]});}
// Fim do ragdoll: quem caiu na água volta para o barco; quem caiu no convés, no cais ou na ilha levanta ali mesmo
function standUp(p){const r=ragdolls.active.get(p.id),local=p.id===localId,was=p.land;let spot=null;
  if(r&&!r.launched){const T=r.bodies.torso.position,l=boat.worldToLocal(V(T.x,T.y,T.z));
    if(insideBoat(l.x,l.z))spot={land:0,x:l.x,z:l.z,h:floorAt(l.x,l.z)};
    else if(!island.exploded){const [x,z]=island.collide(T.x,T.z,.3),g=island.ground(x,z);if(g>-.35){if(T.y>g+2&&p.ragTime<CONFIG.respawnAfter+4)return;spot={land:1,x,z,h:g};}}}
  const water=!spot;if(water){const sp=SPAWNS[p.id%SPAWNS.length];spot={land:0,x:sp[0],z:sp[1],h:0};}
  if(was!==spot.land){p.yaw+=(spot.land?1:-1)*boatState.heading;if(local)input.yaw+=(spot.land?1:-1)*boatState.heading;}
  p.mode='walk';p.land=spot.land;p.x=spot.x;p.z=spot.z;p.height=spot.h;p.vy=0;p.tp++;stateEvent('respawn',{id:p.id,water});}
function floorAt(x,z){const benches=[[-2.84,1.29],[-.258,1.48],[2.279,1.225]];for(const [bz,w]of benches)if(Math.abs(z-bz)<.32&&Math.abs(x)<w)return .79;return 0;}
// Movimento com autoridade local (anfitrião para si; convidado com predição e envio da posição).
function moveLocal(p,i,dt,t){
  p.yaw=i.yaw??p.yaw;p.pitch=i.pitch??p.pitch;if(p.mode!=='walk'){p.speed=0;return;}
  const boost=p.baly>0?1.7:1,fx=Math.sin(p.yaw),fz=Math.cos(p.yaw),rx=-Math.cos(p.yaw),rz=Math.sin(p.yaw);let mx=fx*(i.z||0)+rx*(i.x||0),mz=fz*(i.z||0)+rz*(i.x||0);const len=Math.hypot(mx,mz);
  const floorHere=()=>p.land?island.ground(p.x,p.z):floorAt(p.x,p.z);
  const grounded=p.height<=floorHere()+.02;if(i.jump&&grounded){p.vy=4.6*(p.baly>0?1.2:1);}
  p.speed=0;
  if(len){mx/=len;mz/=len;const speed=(i.run?CONFIG.runSpeed:CONFIG.walkSpeed)*boost,dx=mx*speed*dt,dz=mz*speed*dt;
    const moved=p.land?(landMove(p,dx,dz)||landMove(p,dx,0)||landMove(p,0,dz)):boatMove(p,dx,dz);
    if(moved)p.speed=speed;else if(!p.land&&displayTick%90===0&&floorAt(p.x+mx*.5,p.z+mz*.5)>.1)toast('ESPAÇO para pular o banco.');}
  p.vy-=10*dt;p.height+=p.vy*dt;const floor=floorHere();if(p.height<floor){if(p.vy<-3.2)sound.effect('land');p.height=floor;p.vy=0;}
  const w=weatherAt(story);if(!p.land&&w.storm>.25){const ox=p.x,oz=p.z;p.x+=Math.sin(t*2.1)*w.storm*.17*dt;p.z+=Math.cos(t*1.7)*w.storm*.13*dt;if(!insideBoat(p.x,p.z)){p.x=ox;p.z=oz;}}
  if(p.speed&&grounded){stepDist+=p.speed*dt;if(stepDist>(i.run?1.15:.78)){stepDist=0;sound.effect('step');}}
}
// No barco: a borda é parede (ninguém cai por andar). Só passa se do outro lado houver chão firme na altura de um passo (cais, praia).
function boatMove(p,dx,dz){
  const tryMove=(nx,nz)=>{
    if(insideBoat(nx,nz)){const floor=floorAt(nx,nz);if(p.height>=floor-.15){p.x=nx;p.z=nz;return true;}return false;}
    // passa por cima da amurada: procura chão firme até ~60 cm adiante (o casco é mais largo que o convés)
    const dl=Math.hypot(nx-p.x,nz-p.z)||1,ux=(nx-p.x)/dl,uz=(nz-p.z)/dl;
    for(const k of [0,.25,.5,.75,1]){const w=boat.localToWorld(V(nx+ux*k,CONFIG.deckY+p.height,nz+uz*k)),g=island.ground(w.x,w.z);
      if(g>-.35&&g-w.y<.95&&g-w.y>-1.8){const wy=worldYaw(p);p.land=1;p.x=w.x;p.z=w.z;p.height=Math.max(g,w.y);p.vy=0;p.yaw=wy;if(p===me())input.yaw+=boatState.heading;return true;}}
    return false;};
  return tryMove(p.x+dx,p.z+dz)||tryMove(p.x+dx,p.z)||tryMove(p.x,p.z+dz);
}
// Em terra: colide com paredes, balcões, casas e árvores; não entra no mar; volta ao barco pisando no convés
function landMove(p,dx,dz){
  const [nx,nz]=island.collide(p.x+dx,p.z+dz,.3);
  // do cais para o barco: o convés pode estar a ~60 cm (vão entre a borda do cais e a borda caminhável)
  const dl=Math.hypot(dx,dz)||1;let l=null;for(const k of [0,.25,.5,.75,1]){const c=boat.worldToLocal(V(nx+dx/dl*k,p.height,nz+dz/dl*k));if(insideBoat(c.x,c.z)){l=c;break;}}
  if(l){const f=floorAt(l.x,l.z),deck=boat.localToWorld(V(l.x,CONFIG.deckY+f,l.z)).y;if(p.height-deck<1.4&&p.height-deck>-.6){const wy=p.yaw;p.land=0;p.x=l.x;p.z=l.z;p.height=Math.max(f,p.height-deck+f);p.vy=Math.min(p.vy,0);p.yaw=wy-boatState.heading;if(p===me())input.yaw-=boatState.heading;return true;}}
  const g=island.ground(nx,nz);if(g<-.35||g>p.height+.55)return false;
  p.x=nx;p.z=nz;return true;
}
function doSlap(p){p.slap=1;const wy=worldYaw(p),fx=Math.sin(wy),fz=Math.cos(wy),pw=worldOf(p);let hit=false;
  const facing=(w,range)=>{const dx=w.x-pw.x,dz=w.z-pw.z,d=Math.hypot(dx,dz);return d<range&&Math.abs(w.y-pw.y)<1.3&&(dx*fx+dz*fz)/(d||1)>.3?[dx/(d||1),dz/(d||1)]:null;};
  for(const q of players){if(q.id===p.id||q.mode==='ragdoll'||q.mode==='gone')continue;const dir=facing(worldOf(q),CONFIG.slapRange);if(dir){rag(q.id,'slap',[dir[0]*7.5,3.4,dir[1]*7.5]);hit=true;}}
  if(baker.mode!=='ragdoll'){const dir=facing(V(baker.x,baker.y,baker.z),CONFIG.slapRange+.55);if(dir){bakerRag([dir[0]*7,4,dir[1]*7]);hit=true;}}
  stateEvent('slap',{id:p.id,hit});}
// ---------- Padeiro ----------
function bakerHome(){const b=island.shop.points.baker;return V(ISLAND.x+b.u,SHOP.floor,ISLAND.z+b.v);}
function bakerRag(vel){if(baker.mode==='ragdoll'||island.exploded)return;baker.mode='ragdoll';baker.t=0;stateEvent('bakerSlap',{velocity:vel});}
function bakerPath(){const L=(u,v)=>V(ISLAND.x+u,0,ISLAND.z+v),u=baker.x-ISLAND.x,v=baker.z-ISLAND.z,h=island.shop.points.baker;
  if(v>23.2&&u>3.9&&u<15.8)return [L(h.u,h.v)];
  const pts=[];if(u<SHOP.u0||u>SHOP.u1||v<SHOP.v0||v>SHOP.v1)pts.push(L(0,1.5),L(0,6),L(0,21.3));else if(v<21)pts.push(L(Math.max(-2.5,Math.min(2.5,u)),v),L(Math.max(-2.5,Math.min(2.5,u)),21.3));
  pts.push(L(15,21.3),L(15,23.7),L(h.u,h.v));return pts;}
function bakerTick(dt){
  if(island.exploded)return;
  if(baker.mode==='ragdoll'){baker.t+=dt;if(baker.t>CONFIG.respawnAfter){const r=ragdolls.active.get('baker'),tp=r?r.bodies.torso.position:baker;[baker.x,baker.z]=island.collide(tp.x,tp.z,.3);baker.y=island.ground(baker.x,baker.z);baker.mode='walk';baker.path=bakerPath();stateEvent('bakerUp',{});}}
  else if(baker.mode==='walk'){const goal=baker.path[0];if(!goal){baker.mode='work';baker.yaw=Math.PI;const h=bakerHome();baker.x=h.x;baker.z=h.z;baker.y=h.y;return;}
    const dx=goal.x-baker.x,dz=goal.z-baker.z,d=Math.hypot(dx,dz);if(d<.12){baker.path.shift();return;}const sp=Math.min(d,1.25*dt);baker.x+=dx/d*sp;baker.z+=dz/d*sp;baker.yaw=Math.atan2(dx,dz);baker.y=island.ground(baker.x,baker.z);}
}
function renderBaker(t,dt){const m=baker.model;if(!m)return;if(island.exploded){m.visible=false;return;}if(baker.mode==='ragdoll'){if(!ragdolls.active.has('baker')&&!host)ragdolls.launch('baker',m,[0,3,0]);return;}if(ragdolls.active.has('baker'))ragdolls.remove('baker');
  if(baker.mode==='work'){const h=bakerHome();baker.x=h.x;baker.y=h.y;baker.z=h.z;}
  const d=m.userData.disp||(m.userData.disp={x:baker.x,z:baker.z,y:baker.y,yaw:baker.yaw}),k=Math.min(1,dt*10),px=d.x,pz=d.z;d.x+=(baker.x-d.x)*k;d.z+=(baker.z-d.z)*k;d.y+=(baker.y-d.y)*k;let dy=baker.yaw-d.yaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));d.yaw+=dy*Math.min(1,dt*8);
  m.visible=true;m.position.set(d.x,d.y,d.z);m.rotation.set(0,d.yaw,0);const sp=Math.hypot(d.x-px,d.z-pz)/Math.max(dt,1e-4);
  // olha para quem chega no balcão
  let look=null,bd=6;for(const p of players){if(p.mode==='gone')continue;const w=worldOf(p===players[localId]?me():p,1.6);const dd=Math.hypot(w.x-d.x,w.z-d.z);if(dd<bd){const l=lookAngles(V(d.x,d.y+1.6,d.z),d.yaw,w);if(l){bd=dd;look=l;}}}
  m.userData.anim.update(dt,{time:t,speed:baker.mode==='walk'?Math.min(sp,1.6):0,yaw:d.yaw,grounded:true,look});}
function interact(p){
  // Rifle: devolve de qualquer lugar; pega perto do suporte (antes do leme, que fica ao lado)
  if(p.rifle>=0){dropRifle(p);return;}
  if(p.land){
    const sell=island.shop.points.sell;if(Math.hypot(p.x-(ISLAND.x+sell.u),p.z-(ISLAND.z+sell.v))<2.4){sellBucket(p);return;}
    if(island.shop.points.lanes.some(l=>Math.hypot(p.x-(ISLAND.x+l.u),p.z-(ISLAND.z+l.v))<1.9)){toastFor(p.id,'Caixa de autoatendimento: logo mais é aqui que você passa as suas compras.');return;}
    return;}
  if(p.mode==='walk'&&Math.hypot(p.x-RACK.x,p.z-RACK.z)<1.15){const slot=world.rifles.findIndex(r=>r<0);if(slot<0){toastFor(p.id,'Os dois rifles já estão em uso.');return;}fishing[p.id].reset();p.rifle=slot;world.rifles[slot]=p.id;stateEvent('rifle',{id:p.id,slot,on:true});return;}
  if(p.mode==='drive'){p.mode='walk';p.x=0;p.z=-2.65;p.tp++;stateEvent('drive',{id:p.id,on:false});return;}
  if(Math.hypot(p.x,p.z+2.8)>1.8){toastFor(p.id,'Chegue perto do leme, na popa do barco.');return;}
  if(engineDead){toastFor(p.id,'O motor morreu. Não há para onde fugir.');return;}
  if(players.some(q=>q.mode==='drive')){toastFor(p.id,'Outro pescador já está no leme.');return;}
  fishing[p.id].reset();p.mode='drive';p.x=0;p.z=-3.3;p.height=0;p.vy=0;p.tp++;stateEvent('drive',{id:p.id,on:true});
}
// Peixaria do mercado: vende o balde inteiro (o balde fica no barco, então o barco precisa estar atracado)
function sellBucket(p){
  if(!world.bucket.length){toastFor(p.id,'O balde está vazio. Vá pescar primeiro!');return;}
  if(!docked()){toastFor(p.id,'O balde ficou no barco: atraque no cais da vila para vender o pescado.');return;}
  let total=0,top=null;for(const [sp,kg]of world.bucket){const v=catchValue(sp,kg);total+=v;if(!top||v>top[2])top=[sp,kg,v];}
  total=Math.round(total*100)/100;world.money=Math.round((world.money+total)*100)/100;const count=world.bucket.length;world.bucket=[];
  stateEvent('sold',{id:p.id,total,count,best:top,money:world.money});}
function castLine(p,f){const fx=Math.sin(p.yaw),fz=Math.cos(p.yaw),cx=p.x+fx*7,cz=p.z+fz*7;
  if(!p.land&&insideBoat(cx,cz)){toastFor(p.id,'Mire para fora do barco para lançar a linha.');return;}
  const w=p.land?V(cx,0,cz):boat.localToWorld(V(cx,0,cz));if(!island.exploded&&island.ground(w.x,w.z)>-.8){toastFor(p.id,'Aí é raso demais. Mire para a água funda.');return;}
  f.cast();p.mode='fish';p.cx=cx;p.cz=cz;stateEvent('cast',{id:p.id});}
function tickPlayer(p,i,dt,t,isLocal){
  const f=fishing[p.id];p.slap=Math.max(0,p.slap-dt*2.2);
  if(p.mode==='gone')return;
  p.reload=Math.max(0,(p.reload||0)-dt);p.cool=Math.max(0,(p.cool||0)-dt);p.baly=Math.max(0,(p.baly||0)-dt);if(p.reload===0&&p.ammo<=0)p.ammo=5;
  if(p.mode==='ragdoll'){p.ragTime+=dt;if(p.ragTime>CONFIG.respawnAfter)standUp(p);return;}
  if(i.yaw!==undefined){p.yaw=i.yaw;p.pitch=i.pitch;}
  if(p.rifle>=0){
    // Tiro: o atirador informa o raio e a gaivota que viu na mira; o anfitrião confirma se ela ainda está viva
    if(i.fire&&p.cool<=0&&p.reload<=0&&p.ammo>0){p.ammo--;p.cool=p.baly>0?.62:.85;const ray=i.ray||[0,0,0,0,0,1];const to=[ray[0]+ray[3]*120,ray[1]+ray[4]*120,ray[2]+ray[5]*120];let hitPos=null;
      if(i.gull>=0){const r=gulls.kill(i.gull);if(r){hitPos=r.pos;if(r.hadFish&&r.overBoat)world.bucket.push(world.stolen[i.gull]||[0,.12]);delete world.stolen[i.gull];stateEvent('gullHit',{id:p.id,gull:i.gull,pos:r.pos,hadFish:r.hadFish,overBoat:r.overBoat});}}
      if(hitPos){const w=boat.localToWorld(V(...hitPos));to[0]=w.x;to[1]=w.y;to[2]=w.z;}stateEvent('shot',{id:p.id,to});if(p.ammo<=0){p.reload=RELOAD;stateEvent('reload',{id:p.id});}}
  }else if(i.slap&&p.slap===0)doSlap(p);
  if(i.interact)interact(p);
  if(p.mode==='drive'){p.speed=0;return;}
  if(i.cast&&p.rifle>=0)toastFor(p.id,'Devolva o rifle (E) para pescar.');else if(i.cast){if(f.phase==='idle')castLine(p,f);else if(f.phase==='bite')f.reel();else if(f.phase==='waiting'){f.reset();p.mode='walk';}}
  const result=f.step(dt,!!i.reel,t,p.baly>0);if(result){if(result==='caught')world.bucket.push([f.lastSpecies,f.lastWeight]);stateEvent(result,{id:p.id,fish:f.caught,species:f.lastSpecies,weight:f.lastWeight});if(result==='caught'&&f.lastSpecies===BALY){p.baly=CONFIG.balyTime;stateEvent('baly',{id:p.id});}if(result==='caught'||result==='escaped'){p.mode='walk';p.fish=f.caught;}}
  if(p.mode==='fish'&&(i.x||i.z)){f.reset();p.mode='walk';}
  if(p.mode==='walk'){if(isLocal)moveLocal(p,i,dt,t);else if(i.px!==undefined&&i.tp===p.tp){p.x=i.px;p.z=i.pz;p.height=i.ph;p.speed=i.speed;p.land=i.land?1:0;}}else p.speed=0;
}
const HULL_PTS=[[0,4.5],[0,-3.9],[1.55,0],[-1.55,0],[1.25,2.6],[-1.25,2.6],[1.25,-2.6],[-1.25,-2.6]];
function boatHits(){if(island.exploded)return false;const h=boatState.heading,c=Math.cos(h),s=Math.sin(h);for(const [lx,lz]of HULL_PTS){if(island.ground(boatState.x+lx*c+lz*s,boatState.z-lx*s+lz*c)>-.85)return true;}return false;}
function hostTick(dt,local){
  elapsed+=dt;const t=elapsed;story=storyTime(t,world.trig);const inputs=players.map(p=>p.id===localId?local:remoteInputs[p.net]||{});
  for(const p of players)tickPlayer(p,inputs[p.id]||{},dt,t,p.id===localId);
  for(const k of Object.keys(remoteInputs))remoteInputs[k]={...remoteInputs[k],slap:false,interact:false,cast:false,jump:false,fall:false,fire:false,gull:-1};
  // Gaivotas ladras: só atacam com peixe no balde, mar calmo (na tempestade elas somem) e antes do meteoro
  const w=weatherAt(story),n0=world.bucket.length,n1=gulls.simulate(dt,{active:story<CONFIG.asteroidAt-4&&!cinematic&&w.storm<.35,bucketCount:n0,time:t,water:()=>-.2});
  for(const e of gulls.events.splice(0)){if(e.name==='stolen'){const item=world.bucket.pop();if(item)world.stolen[e.gull]=item;}stateEvent(e.name,e);}
  // Barco (com colisão contra a ilha e o cais)
  const driver=players.find(p=>p.mode==='drive');
  if(story>=CONFIG.impactAt&&!engineDead){engineDead=true;if(driver){driver.mode='walk';driver.z=-2.65;driver.tp++;}stateEvent('engine');}
  const prev={x:boatState.x,z:boatState.z,h:boatState.heading};
  if(driver&&!engineDead){const i=inputs[driver.id]||{};boatState.speed=clamp(boatState.speed+((i.z||0)*2.2-boatState.speed*.24)*dt,-1.4,5);boatState.heading-=(i.x||0)*dt*(.25+Math.abs(boatState.speed)*.16);}
  else boatState.speed*=Math.exp(-dt*(engineDead?2.5:.3));
  boatState.x+=Math.sin(boatState.heading)*boatState.speed*dt;boatState.z+=Math.cos(boatState.heading)*boatState.speed*dt;
  if(boatHits()){boatState.x=prev.x;boatState.z=prev.z;boatState.heading=prev.h;if(Math.abs(boatState.speed)>.7)stateEvent('thud',{});boatState.speed*=-.25;}
  // O meteoro cai no meio da ilha e vem por cima do barco
  if(story>=CONFIG.asteroidAt&&!world.impact){const dx=boatState.x-ISLAND.x,dz=boatState.z-ISLAND.z,l=Math.hypot(dx,dz)||1;world.impact={x:ISLAND.x,z:ISLAND.z,d:0,dir:[dx/l*.75,dz/l*.75]};cataclysm.setImpact(world.impact);}
  if(story>=CONFIG.impactAt&&world.impact&&!world.impact.d){world.impact.d=Math.max(35,Math.hypot(world.impact.x-boatState.x,world.impact.z-boatState.z));
    // quem estava em terra vai junto com a ilha
    for(const p of players)if(p.land&&p.mode!=='gone'){const a=Math.random()*6.28;rag(p.id,'boom',[Math.cos(a)*18,26+Math.random()*14,Math.sin(a)*18]);}
    if(baker.mode!=='ragdoll'){baker.mode='ragdoll';baker.t=-99;stateEvent('bakerSlap',{velocity:[8,34,-6],boom:true});}
    stateEvent('explode',{});}
  bakerTick(dt);
  netTick+=dt;if(!solo&&netTick>.05){netTick=0;net.send(snapshot());}
}
function guestTick(dt,local){
  elapsed+=dt;story=storyTime(elapsed,world.trig);if(pred){moveLocal(pred,local,dt,elapsed);}
  net.send(inputPacket({...local,px:pred.x,pz:pred.z,ph:pred.height,speed:pred.speed,tp:pred.tp,land:pred.land}));if(local.fire)local.fire=false;pred.fall=false;
  boatState.x+=Math.sin(boatState.heading)*boatState.speed*dt;boatState.z+=Math.cos(boatState.heading)*boatState.speed*dt;
  if(boatTarget){const k=Math.min(1,dt*5);boatState.x+=(boatTarget.x-boatState.x)*k;boatState.z+=(boatTarget.z-boatState.z)*k;}
}
function phaseEffects(t){const w=weatherAt(t);if(w.phase!==lastPhase){const was=lastPhase;lastPhase=w.phase;if(w.phase==='storm'&&!world.trig)toast('O vento mudou. As gaivotas foram se esconder.');if(w.phase==='sunset'&&was==='storm')toast('A tempestade passou. O mar acalmou.');if(w.phase==='asteroid')toast('Que luz é essa atrás da gente? Está indo para a ILHA!');if(w.phase==='wave')toast('');}
  if(t>=126&&!warned){warned=true;toast('OLHE PARA CIMA!');}
  if(t>=CONFIG.embraceAt&&!cinematic)startCinematic();
  if(t>=CONFIG.hitAt&&!blackout){blackout=true;$('blackout').style.opacity='1';$('subtitle').textContent='';sound.effect('hit');}
  if(t>=CONFIG.titleAt&&!titleShown){titleShown=true;ended=true;show('ending');requestAnimationFrame(()=>$('ending').style.opacity='1');sound.finalChord();if(host&&!solo)net.send(snapshot());}
}
function startCinematic(){
  cinematic=true;input.enabled=false;input.clear();expectUnlock=true;input.unlock();show('lock-hint',false);show('scope',false);document.body.classList.add('cinematic');ragdolls.clear();fishing.forEach(f=>f.reset());players.forEach(p=>{if(p.mode!=='gone')p.mode='walk';p.land=0;});models.forEach(m=>{if(m.parent!==boat)boat.add(m);m.userData.disp=null;});
  for(const c of [0,1])if(!players.some(p=>p.character===c&&p.mode!=='gone')){const m=spawn(c);m.userData.npc=true;models.push(m);}
  models.forEach((m,i)=>{m.visible=!(players[i]&&players[i].mode==='gone');setFirstPerson(m,false);if(m.userData.gun)m.userData.gun.visible=false;});viewmodel.gun.visible=false;
  // O barco vira a proa para a onda: é para lá que os dois olham
  if(world.impact)boatState.heading=Math.atan2(world.impact.x-boatState.x,world.impact.z-boatState.z);boatState.speed=0;
}
const SHOTS=[
  {until:150,from:[2.9,2.9,-5.2],to:[2.4,2.7,-4.6],look:[0,2.3,2],fov:45},
  {until:156.5,from:[0,2.45,-2.3],to:[0,2.42,-1.75],look:[0,2.33,-.24],fov:34},
  {until:160.5,from:[-5.6,1.25,-.8],to:[-5.2,1.15,.2],look:[0,3.4,4],fov:52},
  {until:999,from:[1.6,1.6,-7.8],to:[.9,1.9,-6.2],look:[0,2.8,6],lookTo:[0,5.2,12],fov:66},
];
function cinematicUpdate(t,dt){
  const hug=smooth(148.5,151.5,t),kiss=smooth(152.5,155.5,t);
  let watcher=0;models.forEach((m,i)=>{const c=m.userData.index;if(!m.visible)return;
    if(c===0||c===1){const side=c===0?-1:1;m.position.set(side*lerp(.6,.155,hug),.72,-.24);m.rotation.set(0,side===-1?Math.PI/2:-Math.PI/2,0);m.userData.anim.update(dt,{time:t,embrace:hug,kiss,grounded:true,yaw:m.rotation.y,look:{yaw:0,pitch:.05*(1-hug)}});}
    else{// os outros assistem da proa, olhando a onda
      const side=watcher++?1:-1;m.position.set(side*.7,CONFIG.deckY,1.6);m.rotation.set(0,side*-.25,0);m.userData.anim.update(dt,{time:t+i,grounded:true,yaw:m.rotation.y,pitch:-.35,look:{yaw:side*.25,pitch:-.35}});}});
  let start=CONFIG.embraceAt,shot=SHOTS[0];for(const s of SHOTS){shot=s;if(t<s.until)break;start=s.until;}
  const k=smooth(0,1,clamp((t-start)/(Math.min(shot.until,CONFIG.hitAt)-start)));
  const pos=V(...shot.from).lerp(V(...shot.to),k),look=V(...shot.look);if(shot.lookTo)look.lerp(V(...shot.lookTo),k);
  camera.position.copy(boat.localToWorld(pos));camera.up.set(0,1,0).applyQuaternion(boat.quaternion);camera.lookAt(boat.localToWorld(look));camera.up.set(0,1,0);camera.fov=shot.fov;
  $('subtitle').textContent=t<149?'“Você também está vendo isso?”':t<153?'“Pelo menos… a gente veio junto.”':'';
}
// ---------- Câmera em primeira pessoa ----------
function fpCamera(t,dt){
  const p=me();if(!p)return;
  if(p.mode==='ragdoll'&&ragdolls.active.has(localId)){const torso=ragdolls.active.get(localId).bodies.torso.position,target=V(torso.x,torso.y,torso.z);const back=V(Math.sin(input.yaw+boatState.heading),0,Math.cos(input.yaw+boatState.heading)).multiplyScalar(-4.5).add(V(0,2.2,0));camera.position.lerp(target.clone().add(back),1-Math.exp(-dt*4));camera.lookAt(target);camera.fov=lerp(camera.fov,70,.1);return;}
  const floorP=p.land?island.ground(p.x,p.z):floorAt(p.x,p.z),grounded=p.height<=floorP+.05,moving=p.speed>0&&grounded;
  // aterrissagem: mergulho da câmera proporcional à queda; pulo: leve subida
  if(!grounded)lastVy=Math.min(lastVy,p.vy||0);
  if(grounded&&!prevGrounded){kick.dip.kick(-(1.2+Math.min(4,-lastVy)*.7));kick.x.kick(-1.4);lastVy=0;}else if(!grounded&&prevGrounded&&(p.vy||0)>0){kick.x.kick(1);kick.dip.kick(.8);}
  prevGrounded=grounded;
  // tapa local: tranco horizontal no instante do golpe
  if(prevSlap>.66&&p.slap<=.66)jolt(-.4,3.4,2,-5);prevSlap=p.slap;
  bobPhase+=dt*(moving?p.speed*4.2:0);const amp=moving?(p.speed>3?1.35:1):0;
  const bob=Math.abs(Math.sin(bobPhase))*.045*amp,sway=Math.sin(bobPhase)*.018*amp;
  const yaw=p.mode==='drive'||p.mode==='walk'||p.mode==='fish'?input.yaw:p.yaw;
  for(const k of Object.values(kick))k.update(0,dt);
  // degraus (meio-fio, cais, embarque) sobem a câmera suavemente em vez de dar um tranco
  const feetW=worldOf(p).y;if(lastFeetW!==null&&grounded&&Math.abs(feetW-lastFeetW)>.04&&Math.abs(feetW-lastFeetW)<1.6)stepLag+=lastFeetW-feetW;lastFeetW=feetW;stepLag*=Math.exp(-dt*11);
  const eye=V(p.x+Math.sin(p.yaw)*.14,(p.land?0:CONFIG.deckY)+p.height+CONFIG.eyeHeight+bob+kick.dip.x*.05,p.z+Math.cos(p.yaw)*.14);
  camera.position.copy(p.land?eye:boat.localToWorld(eye));camera.position.y+=stepLag;
  runFov=lerp(runFov,p.speed>3?1:0,1-Math.exp(-dt*5));strafeRoll=lerp(strafeRoll,-(lastControls.x||0)*.03*(p.mode==='walk'?1:0),1-Math.exp(-dt*6));
  camera.quaternion.copy(p.land?new THREE.Quaternion():boat.quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(input.pitch+kick.x.x*.02,yaw+Math.PI+kick.y.x*.02,sway+strafeRoll+kick.z.x*.02,'YXZ')));
  // tensão da linha treme as mãos (e a câmera)
  const f=fishing[localId];if(f?.phase==='reeling'){const s=f.tension*.004+(f.run>0?.004:0);camera.rotateX(Math.sin(t*43)*s);camera.rotateY(Math.sin(t*37+1)*s);}
  // Rifle: quadril → mira → luneta (acima de ~90% da mira a lente ocupa a tela, zoom 5x e sensibilidade reduzida)
  const holding=(p.rifle??-1)>=0&&p.mode==='walk',vm=viewmodel;camera.updateMatrixWorld();
  vm.hemi.color.copy(environment.ambient.color);vm.hemi.groundColor.copy(environment.ambient.groundColor);vm.hemi.intensity=environment.ambient.intensity;vm.sun.color.copy(environment.sun.color);vm.sun.intensity=environment.sun.intensity*.8;vm.sun.position.copy(U.uSunDir.value).multiplyScalar(5);vm.scene.environment=scene.environment;
  const scopeK=smooth(.62,.95,vm.aim);vm.update(dt,{visible:holding&&!window.__peixesThirdPerson&&!cinematic,hide:scopeK>=.98,aiming:holding&&!!lastControls.aim,yaw:input.yaw,pitch:input.pitch,bob:bobPhase,moving:moving?1:0});
  const baly=p.baly>0?Math.min(1,p.baly/2):0;
  camera.fov=lerp(lerp(60+runFov*7,34,vm.aim),11.5,scopeK)+kick.fov.x+baly*(8+Math.sin(t*16.3)*3)*(1-scopeK);
  if(window.__peixesFov)camera.fov=window.__peixesFov;// diagnóstico: aproxima para inspecionar a arma
  input.aimScale=lerp(1,.2,scopeK);document.body.classList.toggle("scoped",scopeK>.5);$("scope").style.opacity=scopeK;show('scope',scopeK>.02);
  if(scopeK>0){const steady=!!lastControls.run;breath=lerp(breath,steady?.18:1,1-Math.exp(-dt*3));camera.rotateX((Math.sin(t*1.3)*.0035+Math.sin(t*2.9)*.0012)*breath*scopeK);camera.rotateY((Math.sin(t*.9+1)*.004+Math.sin(t*2.3)*.0015)*breath*scopeK);}
  // diagnóstico: câmera orbital de terceira pessoa para inspecionar as animações do próprio personagem
  const tp=window.__peixesThirdPerson;setFirstPerson(models[localId],!tp,holding);if(tp){const a=tp.yaw??(yaw+2.4),d=tp.dist||2.6,W=v=>p.land?v:boat.localToWorld(v);const focus=V(p.x,(p.land?0:CONFIG.deckY)+p.height+1.1,p.z);camera.position.copy(W(focus.clone().add(V(Math.sin(a)*d,tp.h??.5,Math.cos(a)*d))));camera.lookAt(W(focus));camera.fov=tp.fov||50;}
}
// Assistência de olhar, zoom e tremores do impacto
function cameraDrama(t,dt){
  const w=weatherAt(t),I=U.uImpact.value;let shake=w.storm*.0025;
  if(world.impact&&t>=CONFIG.asteroidAt&&t<CONFIG.embraceAt){
    const a=clamp((t-CONFIG.asteroidAt)/(CONFIG.impactAt-CONFIG.asteroidAt));shake+=Math.pow(a,3)*.012;
    // câmera livre: nada puxa o olhar do jogador para o meteoro
    const age=t-CONFIG.impactAt;const zoom=smooth(136.1,136.9,t)*(1-smooth(137.3,138.8,t));camera.fov=lerp(camera.fov,26,zoom);
    if(age>=0)shake+=.02*Math.exp(-age*4);
  }
  if(t>=shockAt){const s=t-shockAt;shake+=.075*Math.exp(-s*1.1);camera.fov+=16*Math.exp(-s*3.5);}
  if(t>=CONFIG.embraceAt)shake+=Math.pow(smooth(151,164,t),2)*.03+(t>161?.02:0);
  if(shake>0){const s=shake;camera.rotateX(s*(Math.sin(t*37.1)+Math.sin(t*23.3)*.6));camera.rotateY(s*(Math.sin(t*31.7+1)+Math.sin(t*19.1)*.6));camera.rotateZ(s*.6*Math.sin(t*27.9+2));camera.position.add(V(Math.sin(t*41),Math.sin(t*33+1),Math.sin(t*29+2)).multiplyScalar(s*1.5));}
  camera.updateProjectionMatrix();
}
function updatePost(t,dt){
  const u=post.u,w=weatherAt(t),age=t-CONFIG.impactAt,sa=t-shockAt;
  u.uFlash.value=age>=0?Math.min(1,Math.exp(-age*3.4)*1.15):0;
  const meteor=t>=CONFIG.asteroidAt&&age<0?Math.pow(clamp((t-CONFIG.asteroidAt)/17),2):0;
  aberrPulse=Math.max(0,aberrPulse-dt*2.2);u.uAberration.value=.0012+aberrPulse*.012+meteor*.002+(sa>=0?Math.exp(-sa*1.4)*.014:0)+smooth(156,164,t)*.004+(age>=0?Math.exp(-age*3)*.01:0);
  u.uRadial.value=(sa>=0?Math.exp(-sa*1.8)*.09:0)+(age>=0&&age<1.5?.05*Math.exp(-age*3):0);
  if(world.impact){const s=U.uImpact.value.clone().add(V(0,40,0)).project(camera);u.uCenter.value.set(s.x*.5+.5,s.y*.5+.5);}
  u.uSaturation.value=lerp(1.12,.82,w.storm)+w.red*.25;u.uContrast.value=1.06+w.red*.06+w.storm*.04;u.uVignette.value=cinematic?1.15:.85;u.uGrain.value=.03+w.storm*.03+(cinematic?.02:0);
  post.bloom.strength=.36+w.red*.15+meteor*.22+(age>=0?Math.exp(-age*.4)*.5:0);
  // Baly: matiz girando, pulso na batida (150 bpm), cores estouradas
  const bl=Math.min(1,(me()?.baly||0)/1.5),beat=Math.pow(.5+.5*Math.sin(elapsed*Math.PI*5),6);u.uBaly.value=bl;u.uHue.value+=dt*2.4*bl;u.uPulse.value=beat;if(bl>0){u.uAberration.value+=beat*.006*bl;u.uSaturation.value+=.35*bl;post.bloom.strength+=beat*.25*bl;}
}

// ---------- Mundo ----------
function tsuAt(x,z,t){return world.impact&&world.impact.d?tsunamiHeight(x,z,story,world.impact):0;}
function updateBoat(t,dt){
  const w=weatherAt(story),h=boatState.heading,fx=Math.sin(h),fz=Math.cos(h),rx=Math.cos(h),rz=-Math.sin(h),x=boatState.x,z=boatState.z;
  const hw=(px,pz)=>waveHeight(px,pz,t,w.storm)+clamp(tsuAt(px,pz,t),-6,4.5);
  const hb=hw(x+fx*3.4,z+fz*3.4),hs=hw(x-fx*3.4,z-fz*3.4),hr=hw(x+rx*1.3,z+rz*1.3),hl=hw(x-rx*1.3,z-rz*1.3),hc=hw(x,z);
  const ud=boat.userData;ud.pitch=lerp(ud.pitch||0,clamp(-Math.atan2(hb-hs,6.8)*.85,-.32,.32),Math.min(1,dt*3));ud.roll=lerp(ud.roll||0,clamp(Math.atan2(hr-hl,2.6)*.8,-.35,.35),Math.min(1,dt*2.5));
  const y=(hb+hs+hr+hl+hc*2)/6*.85;ud.y=lerp(ud.y??y,y,Math.min(1,dt*4));
  boat.rotation.order='YXZ';boat.position.set(x,ud.y+Math.sin(t*1.9)*.02,z);boat.rotation.set(ud.pitch+Math.sin(t*.9)*.008-boatState.speed*.012,h,ud.roll+Math.sin(t*1.3)*(.01+w.storm*.02));
  ud.speed=boatState.speed;ud.heave=hc;let dh=h-prevHeading;dh=Math.atan2(Math.sin(dh),Math.cos(dh));prevHeading=h;steerVis=lerp(steerVis,clamp(-dh/Math.max(dt,1e-3)*2.5,-1,1),1-Math.exp(-dt*6));helm.rotation.z=steerVis*2.2;motor.prop.rotation.z+=dt*(boatState.speed*30+(players.some(p=>p.mode==='drive')&&!engineDead?10:0));motor.group.rotation.y=steerVis*-.35;boat.updateMatrixWorld(true);
  // Lanterna: balança e tremula
  const lu=lantern.userData;lu.hang.rotation.z=-ud.roll*1.6+Math.sin(t*2.1)*.05*(1+w.storm*3);lu.hang.rotation.x=-ud.pitch*1.6;lu.light.intensity=(1.4+w.storm*2.6+w.red*1.2)*(0.92+Math.sin(t*23)*.04+Math.sin(t*37)*.04);
}
function renderPlayers(t,dt){
  for(const p of players){const model=models[p.id];if(!model)continue;
    if(p.mode==='gone'){model.visible=false;continue;}
    if(p.mode==='ragdoll'){if(!ragdolls.active.has(p.id)&&!host)ragdolls.launch(p.id,model,[0,4,0]);continue;}if(ragdolls.active.has(p.id))ragdolls.remove(p.id);
    const src=p.id===localId?me():p,frame=src.land?scene:boat;if(model.parent!==frame){frame.add(model);model.userData.disp=null;}
    const d=model.userData.disp||(model.userData.disp={x:src.x,z:src.z,h:src.height,yaw:src.yaw});const k=p.id===localId?1:Math.min(1,dt*14);
    const px=d.x,pz=d.z;d.x+=(src.x-d.x)*k;d.z+=(src.z-d.z)*k;d.h+=(src.height-d.h)*k;let dy=src.yaw-d.yaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));d.yaw+=dy*k;
    const vx=(d.x-px)/Math.max(dt,1e-4),vz=(d.z-pz)/Math.max(dt,1e-4),sp=Math.hypot(vx,vz);
    model.visible=true;model.position.set(d.x,(src.land?0:CONFIG.deckY)+d.h,d.z);const bodyYaw=p.mode==='drive'?0:p.mode==='fish'?Math.atan2(p.cx-p.x,p.cz-p.z):d.yaw;model.rotation.set(0,bodyYaw,0);
    const f=fishing[p.id],anim=model.userData.anim,phase=p.mode==='fish'?f.phase:'idle';
    if(anim.lastFish!==phase){if(phase==='waiting')anim.castNow();if(phase==='reeling')anim.hookNow();anim.lastFish=phase;}
    // cabeças se olham (só entre quem está no mesmo lugar: barco com barco, terra com terra)
    let look=null,bestD=1e9;for(const q of players){if(q.id===p.id||q.mode==='ragdoll'||q.mode==='gone')continue;const qs=q.id===localId?me():q;if(!!qs.land!==!!src.land)continue;const od=models[q.id]?.userData.disp;if(!od)continue;const l=lookAngles(V(d.x,d.h+1.6,d.z),bodyYaw,V(od.x,od.h+1.6,od.z));const dd=Math.hypot(od.x-d.x,od.z-d.z);if(l&&dd<bestD){bestD=dd;look=l;}}
    // pose do rifle (ciclo do ferrolho depois do tiro, recarga)
    const hasRifle=(p.id===localId?me().rifle:p.rifle)>=0,since=(p.baly>0?.62:.85)-(p.cool||0)-.14;
    const rig=!hasRifle?null:p.reload>0?rigState('reload',RELOAD-p.reload):since>0&&since<CYCLE&&(p.cool||0)>0?rigState('cycle',since):rigState('idle',0);
    const floorH=src.land?island.ground(src.x,src.z):floorAt(src.x,src.z),boost=src.baly>0?1.6:1;
    anim.update(dt*boost,{time:t+p.id*1.3,speed:p.id===localId?src.speed||0:Math.min(sp,5),strafe:sp>.1?(vx*Math.cos(bodyYaw)-vz*Math.sin(bodyYaw))/sp:0,yaw:bodyYaw,grounded:src.height<=floorH+.04,
      fishing:phase,tension:f?.tension||0,reelHeld:p.id===localId?!!lastControls.reel:(f?.vel||0)>0,slap:p.slap,drive:p.mode==='drive',steer:steerVis,pitch:p.id===localId?input.pitch:p.pitch,look,roll:src.land?0:boat.userData.roll||0,rifle:hasRifle,aim:p.id===localId?!!lastControls.aim:false,rig,hideGun:p.id===localId&&!window.__peixesThirdPerson});}
}
const RANK={lixo:0,comum:0,incomum:1,raro:2,epico:3,lendario:4,especial:3};
function showCard(species,weight){const sp=CATCHES[species]||CATCHES[0],tier=TIERS[sp.tier],value=catchValue(species,weight),record=sp.kind==='fish'&&(!best[species]||weight>best[species]);if(record)best[species]=weight;const first=!seen.has(species);seen.add(species);
  const card=$('catch-card');card.style.setProperty('--tier',tier.color);card.style.setProperty('--glow',tier.glow);card.dataset.tier=sp.tier;
  $('catch-tier').textContent=tier.label;$('catch-name').textContent=sp.name;$('catch-weight').textContent=sp.kind==='fish'?weight.toLocaleString('pt-BR',{minimumFractionDigits:2})+' kg':'';
  $('catch-value').textContent=value>0?'≈ '+money(value):'VALE NADA';$('catch-record').textContent=record?'NOVO RECORDE!':first?'NOVO NO ÁLBUM!':'';
  $('catch-note').textContent=sp.note==='message'?MESSAGES[Math.floor(Math.random()*MESSAGES.length)]:sp.note||'';
  card.classList.remove('show');void card.offsetWidth;card.classList.add('show');clearTimeout(cardTimer);cardTimer=setTimeout(()=>card.classList.remove('show'),3800);
  const rank=RANK[sp.tier];sound.effect(sp.tier==='lixo'?'junk':'reveal',{tier:rank});if(sp.tier!=='lixo'){confetti(tier.color,14+rank*24);if(rank>=2)flashScreen(tier.glow,rank);}else confetti('#8a7050',10,true);}
// ---------- dopamina: confete, moedas, clarões, pop-ups ----------
function pop(id){const el=$(id);el.classList.remove('show');void el.offsetWidth;el.classList.add('show');}
function confetti(color,n,dull=false){const box=$('confetti'),colors=dull?['#8a7050','#6a5a3a','#a08a60']:[color,'#ffd23c','#ff5a8a','#4fd1ff','#7dff6a','#ffffff'];for(let i=0;i<n;i++){const c=document.createElement('i');c.style.left=(20+Math.random()*60)+'%';c.style.background=colors[i%colors.length];c.style.setProperty('--dx',((Math.random()-.5)*60)+'vw');c.style.setProperty('--r',(Math.random()*1080-540)+'deg');c.style.animationDelay=(Math.random()*.25)+'s';c.style.width=c.style.height=(6+Math.random()*9)+'px';if(Math.random()<.4)c.style.borderRadius='50%';box.appendChild(c);setTimeout(()=>c.remove(),2600);}}
function moneyPop(text){const el=document.createElement('b');el.className='money-pop';el.textContent=text;$('confetti').appendChild(el);setTimeout(()=>el.remove(),2200);for(let i=0;i<14;i++){const c=document.createElement('i');c.className='coin';c.style.left=(46+Math.random()*8)+'%';c.style.setProperty('--dx',((Math.random()-.5)*40)+'vw');c.style.animationDelay=(Math.random()*.3)+'s';$('confetti').appendChild(c);setTimeout(()=>c.remove(),2000);}setTimeout(()=>sound.effect('coin',{big:true}),250);}
function flashScreen(color,rank){const el=$('flash');el.style.background=`radial-gradient(circle at 50% 55%, ${color}cc 0%, ${color}55 35%, transparent 70%)`;el.classList.remove('go');void el.offsetWidth;el.classList.add('go');if(rank>=4){hitStop=.12;aberrPulse=1.4;jolt(-4,0,3,-10);}}
function feathers(at){for(let i=0;i<30;i++){const a=Math.random()*6.28,s=1+Math.random()*3;fx.spray.emit(elapsed,at.x,at.y,at.z,Math.cos(a)*s,Math.random()*3,Math.sin(a)*s,1.2+Math.random(),1.5,.15,.05,.09,1);}}
function muzzleSmoke(from,to){const d=to.clone().sub(from).normalize();for(let i=0;i<10;i++)fx.spray.emit(elapsed,from.x+d.x*.1,from.y+d.y*.1,from.z+d.z*.1,d.x*(1+Math.random()*2)+(Math.random()-.5)*.6,d.y*1.5+Math.random()*.5,d.z*(1+Math.random()*2)+(Math.random()-.5)*.6,.7+Math.random()*.6,2.5,-.05,.08,.35,1);}
function updateHUD(t){const p=me(),f=fishing[localId];if(!p||!f)return;
  // dinheiro da tripulação (contador rolando) e balde
  moneyShown+=(world.money-moneyShown)*.25;if(Math.abs(world.money-moneyShown)<.01)moneyShown=world.money;$('money').textContent=money(moneyShown);$('money').classList.toggle('rolling',Math.abs(world.money-moneyShown)>.01);
  $('fish-count').textContent=world.bucket.length;const holding=(p.rifle??-1)>=0;show('ammo',holding);if(holding)$('ammo').textContent=p.reload>0?'RECARREGANDO…':'●'.repeat(p.ammo||0)+'○'.repeat(5-(p.ammo||0));$('crosshair').classList.toggle('rifle',holding);$('hitmark').classList.toggle('show',hitMarkT>0);
  const names={sunset:'MAR CALMO',storm:'TEMPESTADE',asteroid:'UM METEORO NO CÉU',wave:'NÃO DÁ MAIS PARA VOLTAR',farewell:'ATÉ O ÚLTIMO ACORDE',blackout:'',title:''};$('phase-label').textContent=names[weatherAt(story).phase];
  const wy=worldYaw(p),fx=Math.sin(wy),fz=Math.cos(wy),pw=worldOf(p),near=(w,r)=>{const dx=w.x-pw.x,dz=w.z-pw.z,d=Math.hypot(dx,dz);return d<r&&Math.abs(w.y-pw.y)<1.3&&(dx*fx+dz*fz)/(d||1)>.3;};
  const target=players.some(q=>q.id!==localId&&q.mode!=='ragdoll'&&q.mode!=='gone'&&near(worldOf(q),CONFIG.slapRange)),bakerNear=baker.mode!=='ragdoll'&&!island.exploded&&near(V(baker.x,baker.y,baker.z),CONFIG.slapRange+.55);$('crosshair').classList.toggle('target',target||bakerNear);
  const lfx=Math.sin(p.yaw),lfz=Math.cos(p.yaw),nearHelm=!p.land&&Math.hypot(p.x,p.z+2.8)<1.8,nearRack=!p.land&&Math.hypot(p.x-RACK.x,p.z-RACK.z)<1.15;
  const castW=p.land?V(p.x+lfx*7,0,p.z+lfz*7):boat.localToWorld(V(p.x+lfx*7,0,p.z+lfz*7)),outward=(p.land||!insideBoat(p.x+lfx*7,p.z+lfz*7))&&(island.exploded||island.ground(castW.x,castW.z)<-.8);
  const sell=island.shop.points.sell,nearSell=p.land&&Math.hypot(p.x-(ISLAND.x+sell.u),p.z-(ISLAND.z+sell.v))<2.4,nearLane=p.land&&island.shop.points.lanes.some(l=>Math.hypot(p.x-(ISLAND.x+l.u),p.z-(ISLAND.z+l.v))<1.9);
  const bucketValue=world.bucket.reduce((s,[sp,kg])=>s+catchValue(sp,kg),0);
  $('context').textContent=holding?'RIFLE · botão direito mira (luneta) · botão esquerdo atira · SHIFT segura a respiração · E devolve':p.mode==='drive'?`NO LEME · W/S acelerar · A/D virar · E soltar · ${Math.abs(boatState.speed*1.94).toFixed(1)} nós`:p.mode==='ragdoll'?'RETORNO AÉREO EM ANDAMENTO…':p.mode==='fish'?'F pescar · WASD cancelar':
    target?'BOTÃO DIREITO · dar um tapa':bakerNear?'BOTÃO DIREITO · dar um tapa no padeiro (por quê?)':nearSell?(world.bucket.length?`E · vender o balde na peixaria (≈ ${money(bucketValue)})`:'PEIXARIA · traga o balde cheio para vender'):nearLane?'CAIXA DE AUTOATENDIMENTO · em breve':
    nearRack&&world.rifles.some(r=>r<0)?'E · pegar um rifle (as gaivotas estão de olho no balde)':nearHelm&&!engineDead?'E · assumir o leme':outward?'F · lançar a linha na direção da mira':p.land?'Rua do Porto · o mercado Althoff fica no fim da rua':'Olhe para o mar para lançar · ESPAÇO pula bancos';
  $('tab-hint').hidden=!(host&&!world.trig&&!ended);
  show('fishing',f.phase!=='idle');const fz2=$('fishing');
  if(f.phase!=='idle'){const sp=CATCHES[f.species],z=f.zone??.18,reeling=f.phase==='reeling',tier=sp?TIERS[sp.tier]:TIERS.comum,rank=sp?RANK[sp.tier]:0,combo=f.combo||0;
    fz2.style.setProperty('--tier',tier.color);fz2.style.setProperty('--glow',tier.glow);
    $('fishing-title').textContent=f.phase==='waiting'?'Esperando a boia afundar…':f.phase==='bite'?'MORDEU!! APERTA F!':f.tension>.78?'VAI ARREBENTAR!':f.run>0?'ELE ESTÁ FUGINDO!':combo>2.5?'PERFEITO!!':combo>1?'ISSO, SEGURA!':rank>=4?'ALGO LENDÁRIO NA LINHA!':rank>=3?'É ÉPICO! NÃO SOLTA!':rank>=2?'Coisa rara puxando…':'Recolhendo…';
    $('fishing-tier').textContent=reeling?tier.label:'';$('fishing-percent').textContent=reeling?Math.round(f.progress*100)+'%':'';$('fz-ring').style.strokeDashoffset=String(289*(1-(reeling?f.progress:0)));
    $('fish-zone').style.left=(f.target-z)*100+'%';$('fish-zone').style.width=z*200+'%';$('fish-needle').style.left=f.needle*100+'%';$('fish-tension').style.width=f.tension*100+'%';
    const mult=1+Math.min(combo/2.5,1)*.6;$('fz-combo').textContent=combo>.4?'COMBO x'+mult.toFixed(1):'';const lvl=Math.floor(combo/1.2);if(lvl>(updateHUD.lvl||0)&&reeling)sound.effect('combo',{level:lvl});updateHUD.lvl=lvl;
    fz2.classList.toggle('danger',reeling&&f.tension>.7);fz2.classList.toggle('inzone',reeling&&Math.abs(f.needle-f.target)<z);fz2.classList.toggle('run',reeling&&f.run>0);fz2.classList.toggle('bite',f.phase==='bite');fz2.classList.toggle('hot',combo>2.5);
    $('fishing-help').textContent=f.phase==='waiting'?'Observe a boia. F cancela o lançamento.':f.phase==='bite'?'Rápido! Fisgar logo dá vantagem.':'Segure F para subir a marca; solte para descer. Fique na faixa: o combo acelera!';}
  // Baly
  const bl=p.baly||0;show('baly-hud',bl>0);if(bl>0)$('baly-bar').style.width=(bl/CONFIG.balyTime*100)+'%';document.body.classList.toggle('baly',bl>0);
  $('ping').textContent=!solo&&net.ping?`${Math.round(net.ping)} ms`:'';
}
// marcadores das gaivotas ladras (com seta na borda da tela quando estão fora de vista)
const markerEls=[];function updateMarkers(){const box=$('markers');const list=running&&!cinematic?gulls.thieves(v=>boat.localToWorld(v)):[];
  while(markerEls.length<list.length){const m=document.createElement('div');m.className='marker';m.innerHTML='<b>!</b><span></span>';box.appendChild(m);markerEls.push(m);}
  markerEls.forEach((m,i)=>{const g=list[i];m.hidden=!g;if(!g)return;const v=g.pos.clone().project(camera),behind=v.z>1;let x=v.x,y=v.y;if(behind){x=-x;y=-y;}const off=behind||Math.abs(x)>.92||Math.abs(y)>.88;if(off){const k=1/Math.max(Math.abs(x)/.9,Math.abs(y)/.85,1e-3);x*=k;y*=k;}
    const sx=(x*.5+.5)*innerWidth,sy=(-y*.5+.5)*innerHeight;m.style.transform=`translate(${sx}px,${sy}px)`;m.classList.toggle('edge',off);m.classList.toggle('near',!off&&Math.hypot(sx-innerWidth/2,sy-innerHeight/2)<Math.min(140,innerHeight*.14));m.classList.toggle('fish',g.fish);m.querySelector('span').textContent=g.fish?'LADRA COM PEIXE':'LADRA';m.style.setProperty('--a',Math.atan2(-y,x)+'rad');});}
function animate(){
  requestAnimationFrame(animate);const rdt=Math.min(clock.getDelta(),.05);hitStop=Math.max(0,hitStop-rdt);slowMo=Math.max(0,slowMo-rdt);const dt=rdt,vdt=rdt*(hitStop>0?.05:slowMo>0?.3:1);menuTime+=dt;displayTick++;
  const controls=input.enabled&&input.locked?input.read():input.enabled?{...input.read(),x:0,z:0,slap:false,cast:false,interact:false,jump:false,reel:false,fire:false,aim:false}:{};lastControls=controls;
  hitMarkT=Math.max(0,hitMarkT-rdt);
  // mira local: raio da câmera (com dispersão se não estiver mirando) e a gaivota na linha de tiro
  if(controls.fire&&running&&(me()?.rifle??-1)>=0){const spread=(1-viewmodel.aim)*.018+.002,dir=camera.getWorldDirection(V()).add(V((Math.random()-.5)*spread,(Math.random()-.5)*spread,(Math.random()-.5)*spread)).normalize();const ray=new THREE.Ray(camera.position.clone(),dir);controls.ray=[...ray.origin.toArray(),...dir.toArray()];controls.gull=gulls.pick(ray,v=>boat.localToWorld(v));}
  const live=running&&!paused&&!ended;
  if(live&&!cinematic){if(host)hostTick(dt,controls);else guestTick(dt,controls);}
  else if(live&&cinematic){elapsed+=dt;story=storyTime(elapsed,world.trig);if(host&&!solo){netTick+=dt;if(netTick>.1){netTick=0;net.send(snapshot());}}}
  if(hold!==null&&solo)elapsed=hold;
  if(!running)story=45;else if(ended)story=storyTime(elapsed,world.trig);
  const t=running?elapsed:menuTime*.5;
  updateBoat(t,dt);
  if(!running){menuCharacters.forEach((m,i)=>{const sp=SPAWNS[i];m.position.set(sp[0]*1.4,CONFIG.deckY,sp[1]);m.rotation.y=i<2?.55:2.6;const o=menuCharacters[i^1].position;m.userData.anim.update(dt,{time:menuTime+i*2,fishing:'waiting',grounded:true,yaw:.55,look:lookAngles(m.position.clone().setY(1.6),.55,o.clone().setY(1.6))});});const yaw=Math.PI+.62+Math.sin(menuTime*.045)*.05;camera.position.set(Math.sin(yaw)*13.8+boat.position.x,3.6,Math.cos(yaw)*13.8+boat.position.z);camera.lookAt(boat.position.x-3.2,2.1,boat.position.z+1);camera.fov=48;camera.updateProjectionMatrix();}
  else{
    phaseEffects(story);if(story>=CONFIG.impactAt+.6&&!island.exploded){island.explode();ragdolls.removeIsland();}
    if(cinematic)cinematicUpdate(story,vdt);else{renderPlayers(t,vdt);fpCamera(t,vdt);}
    renderBaker(t,vdt);cameraDrama(story,dt);
    ragdolls.moveDeck(boat);if(!paused)ragdolls.update(dt,(x,z)=>{const l=boat.worldToLocal(V(x,0,z));if(insideBoat(l.x,l.z))return -100;if(!island.exploded&&island.ground(x,z)>-.3)return -100;return waveHeight(x,z,t,weatherAt(story).storm)+tsuAt(x,z,t);},(id,pos,velocity)=>{if(host)stateEvent('splash',{id,position:pos.toArray(),velocity});});
    if(displayTick%4===0)updateHUD(t);fx.update(t,vdt,{players:players.map(p=>p.id===localId?{...p,land:me().land,x:me().x,z:me().z}:p),fishing,models,boat,camera,localId,cinematic,story});fx.syncBucket(world.bucket,boat);
    world.rifles.forEach((h,i)=>{if(rackRifles[i])rackRifles[i].visible=h<0;});
    // tique do molinete enquanto recolhe
    const f=fishing[localId];if(f?.phase==='reeling'&&controls.reel){reelTick+=dt;if(reelTick>.07){reelTick=0;sound.effect('tick');}}
  }
  if(running)gulls.render(vdt,t,host);shotFX.update(vdt);updateMarkers();shotLight.intensity*=Math.exp(-dt*30);
  island.update(t,dt,camera,running?players.filter(p=>p.mode!=='gone').map(p=>worldOf(p.id===localId?me():p)):[]);
  const w=environment.update(t,paused?0:dt,boat,camera,{paused,story,focus:running&&!cinematic?camera.position:boat.position});
  if(!paused)fluid.update(dt);cataclysm.update(story,paused?0:dt,boat,camera,t);
  const age=story-CONFIG.impactAt;
  sound.listener(camera);sound.update(story,dt,{running,phase:running?w.phase:'sunset',storm:w.storm,heave:boat.userData.heave,speed:boatState.speed,driving:running&&players.some(p=>p.mode==='drive'),meteor:running&&story>=CONFIG.asteroidAt&&age<0?clamp((story-CONFIG.asteroidAt)/17):0,tsu:running&&age>0?smooth(139,164,story):0});
  sound.balyBeat(running&&!ended&&(me()?.baly||0)>0);
  if(running)updatePost(story,dt);
  if(!blackout||!running)post.render(dt);
  frameTimes.push(dt);if(frameTimes.length>120)frameTimes.shift();
}
function resize(){if(!renderer)return;renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();post?.setSize(innerWidth,innerHeight);}
async function init(){
  renderer=new THREE.WebGLRenderer({canvas:$('world'),antialias:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,quality==='low'?1:1.5));renderer.setSize(innerWidth,innerHeight,false);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.debug.onShaderError=(gl,program,vs,fs)=>fail(new Error('Erro WebGL: '+gl.getProgramInfoLog(program)+' '+gl.getShaderInfoLog(fs)+' '+gl.getShaderInfoLog(vs)));
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.06,2600);assets=await loadAssets();
  fluid=new FluidSim(renderer,{resolution:quality==='low'?192:256,size:620});environment=new Environment(scene,renderer,fluid,quality);cataclysm=new Cataclysm(scene,fluid,quality);
  cataclysm.onShock=()=>{shockAt=elapsed;sound.effect('shock');};cataclysm.onDebrisSplash=p=>sound.effect('debris',{pos:p});environment.onThunder=d=>sound.effect('thunder',{distance:d});
  boat=new THREE.Group();const hull=makeBoat();boat.add(hull);boat.userData.bucketLocal=hull.userData.bucket.clone();helm=addHelm(boat);lantern=addLantern(boat);motor=addMotor(boat);scene.add(boat);ragdolls=new Ragdolls(scene);menuCharacters=[0,1,2,3].map(spawn);rackRifles=addRack(boat);gulls=new GullFlock(boat,boat.userData.bucketLocal,4);viewmodel=new Viewmodel(camera);viewmodel.onSound=n=>sound.effect(n);shotFX=new ShotFX(scene);if(!camera.parent)scene.add(camera);
  shotLight=new THREE.PointLight(0xffb060,0,25,2);scene.add(shotLight);
  // Ilha central com a vila, o cais e o mercado; o fundo dela entra no shader do mar (água rasa e arrebentação)
  $('loading-text').textContent='Construindo a vila…';island=new Island(scene,quality);U.uIslandMap.value=island.heightTex;U.uIsland.value.set(ISLAND.x,ISLAND.z,ISLAND.size);
  island.onSplash=(p,size)=>{fx.splash(p,20+size*6,2.5+size*.4,4+size);if(size>2)fluid.drop(p.x,p.z,3+size,3+size,1);sound.effect('debris',{pos:p});};
  ragdolls.addIsland((x,z)=>island.ground(x,z),{x0:ISLAND.x-ISLAND.size/2,z0:ISLAND.z-ISLAND.size/2,size:ISLAND.size,n:115},island.colliders.filter(c=>!c.dock));
  baker.model=addBakerOutfit(spawn(0));scene.add(baker.model);{const h=bakerHome();baker.x=h.x;baker.y=h.y;baker.z=h.z;}
  fx=new FishingFX(scene);fx.onCard=showCard;fx.onBucket=pos=>sound.effect('bucket',{pos});
  post=new Post(renderer,scene,camera,quality);post.setOverlay(viewmodel.scene);post.setSize(innerWidth,innerHeight);
  lobby.join(0,selected);updateLobby();setupUI();
  // Compila também o que só aparece no final (meteoro, impacto, tsunami) para não travar no clímax
  $('loading-text').textContent='Afinando as ondas e o céu…';const hidden=[];scene.traverse(o=>{if(!o.visible){hidden.push(o);o.visible=true;}});U.uImpactAge.value=0;
  updateBoat(0,0);environment.update(0,0,boat,camera);await renderer.compileAsync(scene,camera);post.render(0);hidden.forEach(o=>o.visible=false);U.uImpactAge.value=-1;
  environment.updateEnvMap();show('loading',false);animate();
  // Diagnóstico somente leitura; o salto de tempo funciona apenas no teste solo.
  window.__peixes={get state(){return {running,solo,host,localId,time:elapsed,phase:weatherAt(elapsed).phase,players:structuredClone(players),fishing:fishing.map(f=>({phase:f.phase,caught:f.caught,progress:f.progress})),lobby:lobby.snapshot(),impact:world.impact,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,meanFps:1/(frameTimes.reduce((a,b)=>a+b,0)/(frameTimes.length||1))}},get renderer(){return renderer;},get scene(){return scene;},get post(){return post;},get input(){return input;},get camera(){return camera;},get environment(){return environment;},get cataclysm(){return cataclysm;},get sound(){return sound;},get fx(){return fx;},get models(){return models;},get fishing(){return fishing;},get gulls(){return gulls;},get world(){return world;},get players(){return players;},get boat(){return boat;},get island(){return island;},get boatState(){return boatState;},get baker(){return baker;},get viewmodel(){return viewmodel;},get story(){return story;},testRag(v){if(solo)rag(0,"slap",v||[1,2,0]);},setStory(v){if(solo)world.trig={at:elapsed-(v-CONFIG.asteroidAt+CONFIG.rampTime),from:CONFIG.asteroidAt};},me,jump(t){if(solo){elapsed=t;hold=null;}},hold(t){if(solo){hold=t;elapsed=t;}},look(yaw,pitch){input.yaw=yaw;input.pitch=pitch;}};
}
function triggerMeteor(){if(world.trig||!running)return;world.trig={at:elapsed,from:story};stateEvent('trigger',{});}
function setupUI(){
  $('open-lobby').onclick=()=>{show('lobby');sound.start()};$('lobby-close').onclick=()=>{show('lobby',false);if(!running)menuCharacters.forEach(m=>m.visible=true);};for(let i=0;i<CONFIG.characters;i++)$('char'+i).onclick=()=>changeCharacter(i);
  $('solo').onclick=()=>{net.close();start(true,[{id:0,character:selected}]);};
  $('room-host').onclick=async()=>{try{const code=roomCode();status('Abrindo a sala…');await net.room(code,true);host=true;localId=0;myNet=0;lobby=new Lobby();lobby.join(0,selected);updateLobby();$('room-value').textContent=code;show('room-display');status('Sala aberta. Passe o código ao outro pescador e aguarde.');}catch(e){status(e.message);}};
  $('room-join').onclick=async()=>{const code=$('room-code').value.trim().toUpperCase();if(code.length<5){status('Digite o código de 5 letras.');return;}try{status('Procurando a sala '+code+'…');await net.room(code,false);}catch(e){status(e.message);}};
  $('room-code').addEventListener('keydown',e=>{if(e.key==='Enter')$('room-join').click();});
  $('room-copy').onclick=async()=>{try{await navigator.clipboard.writeText($('room-value').textContent);status('Código copiado.');}catch{status('Copie o código: '+$('room-value').textContent);}};
  $('host').onclick=async()=>{try{status('Preparando o convite…');const code=await net.offer();host=true;localId=0;myNet=0;lobby=new Lobby();lobby.join(0,selected);$('net-code').value=code;$('code-label').textContent='1. Envie este convite ao outro pescador';$('net-help').textContent='Depois que ele responder, substitua o convite pela resposta e clique em Conectar.';$('use-code').textContent='Conectar resposta';codeAction='accept';show('connection');status('Convite pronto. Aguardando a resposta do convidado.');}catch(e){status(e.message)}};
  $('join').onclick=()=>{show('connection');$('net-code').value='';$('code-label').textContent='1. Cole o convite recebido';$('net-help').textContent='Você vai gerar uma resposta para devolver ao anfitrião.';$('use-code').textContent='Gerar resposta';codeAction='answer';};
  $('use-code').onclick=async()=>{try{if(codeAction==='answer'){const code=await net.answer($('net-code').value);host=false;localId=1;$('net-code').value=code;$('code-label').textContent='2. Envie esta resposta ao anfitrião';$('net-help').textContent='Aguarde ele colar esta resposta e conectar.';$('use-code').textContent='Aguardando conexão';$('use-code').disabled=true;status('Resposta pronta. Devolva o código ao anfitrião.');}else if(codeAction==='accept'){await net.accept($('net-code').value);status('Tentando conectar os dois pescadores…');}}catch(e){status('Não foi possível conectar: '+e.message);}};
  $('copy-code').onclick=async()=>{try{await navigator.clipboard.writeText($('net-code').value);status('Código copiado.')}catch{$('net-code').select();status('Selecione e copie o código com Ctrl+C.')}};
  $('ready').onclick=()=>{sound.start();const ready=!lobby.players.get(myNet)?.ready;if(net.host){lobby.ready(0,ready);broadcastLobby();}else{lobby.ready(myNet,ready);net.send({type:'ready',ready});updateLobby();}};
  $('tab-host').onclick=()=>{host=true;localId=0;myNet=0;lobby=new Lobby();lobby.join(0,selected);net.tabs($('tab-room').value.trim()||'pescaria',true);status('Sala de teste aberta. Entre na outra aba.');};$('tab-join').onclick=()=>{host=false;localId=1;net.tabs($('tab-room').value.trim()||'pescaria',false);status('Procurando a outra aba…');};
  $('sound').onclick=()=>{sound.start();$('sound').textContent=sound.toggle()?'SOM OFF':'SOM ON';};
  function settings(open){show('settings',open);if(running&&!cinematic&&!ended){if(solo){paused=open;document.body.classList.toggle('paused',open);}input.enabled=!open;input.clear();if(open){if(input.locked){expectUnlock=true;input.unlock();}show('lock-hint',false);}else input.lock();}}
  input.onLockChange=locked=>{const wasExpected=expectUnlock;expectUnlock=false;if(!running||cinematic||ended)return;if(locked){show('lock-hint',false);return;}if(!wasExpected&&$('settings').hidden)settings(true);else show('lock-hint',$('settings').hidden);};
  $('world').addEventListener('click',()=>{if(running&&!cinematic&&!ended&&!input.locked&&$('settings').hidden&&!paused)input.lock();});
  $('settings-open').onclick=()=>settings(true);$('settings-close').onclick=()=>settings(false);$('resume').onclick=()=>settings(false);
  $('quality').onchange=e=>{localStorage.setItem('peixes-quality',e.target.value);toast('Qualidade aplicada ao recarregar a página.');};$('sensitivity').oninput=e=>{input.sensitivity=Number(e.target.value);localStorage.setItem('peixes-sens',e.target.value);};
  window.addEventListener('keydown',e=>{if(e.code==='Escape'&&running&&!cinematic&&!ended&&!input.locked)settings($('settings').hidden);});
  $('skip-storm').onclick=()=>{if(!solo)return;elapsed=212;toast('Teste: tempestade chegando.');settings(false);};
  $('skip-ending').onclick=()=>{if(!solo)return;settings(false);triggerMeteor();};
  $('skip-impact').onclick=()=>{if(!solo)return;world.trig={at:elapsed-(132-CONFIG.asteroidAt+CONFIG.rampTime),from:CONFIG.asteroidAt};toast('Teste: impacto.');settings(false);};
  // TAB: só o anfitrião chama o meteoro (duas vezes seguidas, para não acontecer sem querer)
  window.addEventListener('keydown',e=>{if(e.code!=='Tab'||!running)return;e.preventDefault();if(ended||cinematic||world.trig)return;if(!host){toast('Só o anfitrião pode chamar o meteoro.');return;}
    const now=performance.now();if(now-tabArm<3000){tabArm=0;triggerMeteor();}else{tabArm=now;toast('Aperte TAB de novo para chamar o meteoro. É o fim da partida para todos!');}});
  $('fall-test').onclick=()=>{if(!solo)return;settings(false);players[0].x=2;models[0].position.x=2;models[0].updateMatrixWorld(true);rag(0,'water',[3,1,0]);};
  $('restart').onclick=()=>location.reload();window.addEventListener('resize',resize);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&!window.__peixesNoPause){input.clear();if(running&&solo&&!cinematic&&!ended)settings(true);}});window.addEventListener('beforeunload',()=>net.send({type:'bye'}));
}
init().catch(fail);

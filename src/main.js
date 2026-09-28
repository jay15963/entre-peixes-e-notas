import './style.css';
import './items.css';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {CONFIG,SPAWNS,Lobby,Fishing,newPlayer,weatherAt,waveHeight,tsunamiHeight,insideBoat,smooth,clamp,lerp,inputPacket,storyTime,STORM_TIME,ROPE,ropeWindow,ropeAngle,ropeHit,driftAt,Shoo,DROWN_TIME,STORM_DUR,nextStormAt} from './core.js';
import {loadAssets,setFirstPerson} from './models.js';
import {makeCharacter,addBakerOutfit,LOOKS} from './characters.js';
import {makeBoat,addHelm,addLantern,addMotor,makeBucket,makeGuitar} from './boat.js';
import {Rope,makeCoil} from './rope.js';
import {GuitarHero,LANE_KEYS} from './guitar.js';
import {CATCHES,TIERS,BALY,MESSAGES,catchValue,money} from './catalog.js';
import {Animator,Spring,lookAngles} from './animation.js';
import {FishingFX} from './fishingfx.js';
import {GullFlock} from './gulls.js';
import {makeRifle,addRack,RACK,Viewmodel,ShotFX,rigState,CYCLE,RELOAD} from './weapons.js';
import {Island} from './island.js';
import {Villagers} from './npcs.js';
import {NessieFight,BattleMusic,MAX_HP as BOSS_HP,ZONES,ZONE_LIST,ATTACK_NAMES} from './nessie-fight.js';
import {ISLAND,BERTH,SHOP,DOCK,BOLLARDS} from './terrain.js';
import {Environment} from './environment.js';
import {Cataclysm} from './cataclysm.js';
import {FluidSim} from './fluid.js';
import {Post} from './post.js';
import {U} from './shaders.js';
import {Input} from './input.js';
import {Ragdolls} from './physics.js';
import {Transport,roomCode} from './network.js';
import {Sound} from './audio.js';
import {ITEMS,ITEM_IDS} from './store.js';
import {Showroom,renderIcons,cutIcon} from './storefront.js';
import {makeStoreItem} from './store-models.js';
import {Market,NEW_MARKET} from './market.js';
import {Gear,NEW_EQ,newStatus,PLAYER_STATUS} from './items.js';
import {VolcanoIsland,VOLCANO,TEMPLE,LEVELS,WF,LEDGE} from './volcano.js';
import {Temple,NEW_TEMPLE,isTempleCode,relicIcon} from './temple.js';
import {Eclipse,ECLIPSE} from './eclipse.js';

const $=id=>document.getElementById(id),show=(id,value=true)=>$(id).hidden=!value;
const Y=new THREE.Vector3(0,1,0),V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
let renderer,scene,camera,environment,cataclysm,fluid,post,assets,boat,helm,lantern,motor,fx,ragdolls,gulls,rackRifles=[],viewmodel,shotFX,menuCharacters=[],island,story=45;
let running=false,solo=false,host=true,localId=0,selected=0,elapsed=0,menuTime=0,paused=false,cinematic=false,ended=false,blackout=false,titleShown=false,engineDead=false;
const NEW_WORLD=()=>({storm:null,nessie:0,impact:null,bucket:[],rifles:[-1,-1],money:0,trig:null,stolen:{},bucketAt:-1,bucketPos:null,rope:{s:'tied',h:-1,tgt:1,pid:-1,t:0,ok:true,from:null,to:null},guitar:-1,shoo:null,talk:null,eq:NEW_EQ(),mk:NEW_MARKET(),nextStorm:nextStormAt(0),stormCount:0,temple:NEW_TEMPLE(),eclipse:null});
// Balde: -1 no barco, -2 no chão (bucketPos), ou o id de quem carrega. Corda: 'boat' (rolo no convés), 'held', 'fly', 'tied' (no cabeço), 'pull' (resgate)
let players=[],models=[],fishing=[],remoteInputs={},netTick=0,lastPhase='sunset',world=NEW_WORLD(),pred=null,boatTarget=null,myNet=0,hitMarkT=0;
let lobby=new Lobby(),codeAction='',expectUnlock=false;
const BERTH_STATE=()=>({x:ISLAND.x+BERTH.u,z:ISLAND.z+BERTH.v,heading:BERTH.heading,speed:0});
let diagnostics=null;
let boatState=BERTH_STATE(),toastTimer=0,frameTimes=[],displayTick=0,cardTimer=0,best={};
let stepDist=0,bobPhase=0,shockAt=Infinity,reelTick=0,hold=null,warned=false,tabArm=0,stepLag=0,lastFeetW=null,seen=new Set(),balyWas=0,moneyShown=0,shotLight=null;
// Padeiro da padaria do mercado (NPC): trabalha no balcão, voa com o tapa e volta andando
const baker={mode:'work',x:0,y:0,z:0,yaw:Math.PI,t:0,path:[],model:null};
// Itens do barco: balde, corda (física de Verlet), violão; minigames locais (laço, espantar gaivota, violão)
let fpsAcc=0,fpsN=0,volcano=null,temple=null,eclipse=null,eclPrev=-1,cloudClear=0,shopProxy=null,partCull=[],shopDetail=[],lightPins=[],showroom=null,market=null,gear=null,icons={},vmItem='',fight=null,battle=null,bossHud=null,bossMarkers=[],fluidOff=0,villagers=null,hull=null,bucketObj=null,rope=null,guitarStand=null,ropeGame=null,shooGame=new Shoo(),gh=new GuitarHero(),ghCanvas=null,driftT=0,talkShown=null;
const GUITAR_SPOT={x:-.62,z:-.26},ROPE_HOME={x:-.45,z:2.9},BOW_CLEAT={x:0,y:.9,z:4.55};
// Juice: hit-stop, câmera lenta e molas de câmera (tranco, aterrissagem, soco de FOV)
let breath=1,hitStop=0,slowMo=0,aberrPulse=0,runFov=0,strafeRoll=0,prevGrounded=true,prevSlap=0,prevHeading=0,steerVis=0,lastVy=0,lastControls={};
const kick={x:new Spring(260,17),y:new Spring(260,17),z:new Spring(220,13),fov:new Spring(200,14),dip:new Spring(170,12)};
// O rifle fica preso ao tronco, com a coronha no ombro; as mãos chegam nele por IK (animation.js)
function spawn(character){const m=makeCharacter(assets,character);m.userData.anim=new Animator(m);const gun=makeRifle();gun.visible=false;m.userData.joints.torso.add(gun);m.userData.gun=gun;boat.add(m);return m;}
function jolt(x=0,y=0,z=0,fov=0){kick.x.kick(x);kick.y.kick(y);kick.z.kick(z);kick.fov.kick(fov);}
const sound=new Sound(),input=new Input($('world')),clock=new THREE.Clock(),net=new Transport(receive,onNetStatus);
const quality=localStorage.getItem('peixes-quality')||'high';$('quality').value=quality;$('sensitivity').value=input.sensitivity;

// avisos no meio da tela foram removidos de vez: o jogo mostra as coisas no mundo e no "E" em cima dos objetos
function toast(){}
function status(text){$('net-status').textContent=text;}
function fail(error){console.error(error);show('loading',false);show('fatal');$('fatal-message').textContent=error instanceof Error?error.message:String(error);}
const me=()=>pred||players[localId];
const entryValue=e=>catchValue(e[0],e[1])+(e[2]||0);
// Cada jogador está no barco (coordenadas do barco) ou em terra (coordenadas do mundo, p.land=1)
function worldOf(p,y=0){return p.land?V(p.x,(p.height||0)+y,p.z):boat.localToWorld(V(p.x,CONFIG.deckY+(p.height||0)+y,p.z));}
const deckPos=p=>worldOf(p,1.2);
const worldYaw=p=>p.yaw+(p.land?0:boatState.heading);
const docked=()=>Math.hypot(boatState.x-(ISLAND.x+BERTH.u),boatState.z-(ISLAND.z+BERTH.v))<30;
function stateEvent(name,payload={}){event(name,payload);if(!solo&&host)net.send({type:'event',name,payload});}
function toastFor(){}

// ---------- Eventos (anfitrião aplica e retransmite; convidado apenas aplica) ----------
function event(name,p){
  const pl=players[p.id],pos=pl?deckPos(pl):null;
  if(name==='toast'&&p.id===localId)toast(p.text);
  if(name==='slap'){sound.effect(p.hit?'slap':'whoosh',{pos});if(pl)pl.slap=1;if(p.hit&&p.id===localId){hitStop=.09;jolt(-.6,0,2.2,-9);aberrPulse=.6;}else if(p.id!==localId&&!p.hit)models[localId]?.userData.anim?.flinch.kick(-4);}
  if(name==='ragdoll'){const m=models[p.id];if(m){ragdolls.launch(p.id,m,p.velocity);sound.effect('launch',{pos});if(p.id===localId){aberrPulse=.25;jolt(3,4,-6,14);}if(p.id===localId)toast(p.reason==='water'?'Você esqueceu que não é um peixe.':p.reason==='boom'?'A ilha explodiu. Você foi junto.':'A amizade veio com força.');}}
  if(name==='splash'){const at=V(...p.position);environment.burst(at);sound.effect('splash',{pos:at});if(p.id===localId)toast('Você caiu no mar! Boiando… alguém precisa te laçar com a corda do barco.');else if(typeof p.id==='number'&&p.id!==localId)toast(`Pescador ${(players[p.id]?.net??0)+1} caiu no mar! Peguem a corda (proa) e lacem!`);}
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
  if(name==='shot'){const m=models[p.id];m?.userData.anim?.fire();const local=p.id===localId&&viewmodel.active;const muzzle=m?.userData.gun?.userData.muzzle;const from=local?camera.localToWorld(V(.12,-.1,-.9)):muzzle?muzzle.getWorldPosition(V()):pos;const to=V(...p.to);shotFX.tracer(from,to);
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
  if(name==='explode'&&!island.exploded){island.shop.group.visible=true;island.explode();ragdolls.removeIsland();if(shopProxy)shopProxy.visible=false;environment.rain.material.uniforms.uRoofY.value=-1e5;}
  // ----- balde, corda, violão, resgate, gaivota no cabo de guerra, padeiro -----
  if(name==='bucket'){sound.effect('bucket',{pos});if(p.id===localId)toast(p.on?'Balde na mão · leve até a peixaria do mercado (E vende) · E larga':p.home?'Balde de volta ao barco.':'Balde no chão. E pega de novo.');}
  if(name==='rope'){sound.effect('rack',{pos});if(p.id===localId)toast(p.on?'Corda na mão · mire num cabeço do cais ou num pescador na água e clique · E devolve':'Corda de volta ao rolo.');}
  if(name==='untie'){sound.effect('ropeTie',{pos});if(p.id===localId)toast('Corda solta: o barco vai à deriva com o mar! Laço: clique mirando o cabeço.');}
  if(name==='ropeThrow'){sound.effect('ropeThrow',{pos});rope&&(rope.ready=false);}
  if(name==='ropeTied'){sound.effect('ropeTie',{pos:V(...p.at)});toast(p.id===localId?'AMARRADO! O barco não sai mais daqui.':`Pescador ${(players[p.id]?.net??0)+1} amarrou o barco no cais.`);confetti('#e5c08c',24);}
  if(name==='ropeMiss'){sound.effect('ropeMiss',{pos:p.at?V(...p.at):pos});if(p.id===localId)toast('Errou o laço! Recolhendo a corda…');}
  if(name==='ropeCatch'){sound.effect('ropeTie',{pos:p.at?V(...p.at):pos});if(p.target===localId)toast('Te laçaram! Segura firme, estão te puxando.');else if(p.id===localId)toast('Laçou! Puxando o pescador para o barco…');}
  if(name==='rescued'){sound.effect('rescue');if(p.id===localId)toast('Resgatado! Nunca mais duvide da corda.');else toast(`Pescador ${(players[p.id]?.net??0)+1} foi resgatado!`);confetti('#7dff6a',50);}
  if(name==='drowned'){if(p.id===localId)toast('Ninguém te puxou a tempo. Você acordou no cais de Laguna.');}
  if(name==='guitar'){sound.effect('rack',{pos});if(p.id===localId){if(p.on){gh.start();toast('Você é a banda! W/S escolhe a música · ENTER toca · D F J K no tempo da nota');}else{gh.stop();toast('Violão de volta ao banco.');}}}
  if(name==='strum'&&p.id!==localId){const m=models[p.id];const at=m?m.getWorldPosition(V()).add(V(0,1.1,0)):pos;sound.guitar(p.notes,at);const a=m?.userData.anim;if(a)a.strumT=0;}
  if(name==='song'&&p.id!==localId&&pl&&worldOf(pl).distanceTo(camera.position)<30)toast(`Pescador ${(pl.net??0)+1} tocou “${p.name}” (${Math.round(p.acc*100)}%)`);
  if(name==='shoo'){const g=gulls.gulls[p.gull];sound.effect('gull',{pos:g?boat.localToWorld(g.pos.clone()):null});if(p.id===localId){shooGame.start();toast('A GAIVOTA AGARROU O BALDE! Segure F para puxar e fique na faixa!');}else toast('Uma gaivota está brigando pelo balde! Atirem nela!');}
  if(name==='scared'){const g=gulls.gulls[p.gull];sound.effect('shoo',{pos:g?boat.localToWorld(g.pos.clone()):null});if(p.id===localId){toast('Espantou a gaivota! Ela foi embora sem nada.');confetti('#ffffff',30);}shooGame.reset();}
  if(name==='npcSlap'){const n=villagers?.list[p.i];if(n){n.rag=elapsed;ragdolls.launch('npc'+p.i,n.model,p.velocity);sound.effect('launch',{pos:n.model.position});const lines=['Ei! Eu só estava passando!','Na minha terra isso dá processo.','Vou contar pro padeiro!','Ai! Que povo do barco estressado.'];if(pl&&p.i%2===0&&worldOf(pl).distanceTo(camera.position)<20)toast(lines[p.i%lines.length]);}}
  if(name==='storm'){toast(p.on?'EVENTO: uma tempestade está chegando!':'EVENTO: a tempestade vai passar.');sound.effect('alarm');}
  if(name==='nessieArmed'){toast('EVENTO NESSIE: algo enorme está esperando em águas profundas. Leve o barco para longe da ilha…');sound.effect('growlFar');}
  if(name==='boss'){ensureFight();fight.fxEvent(p);bossUI(p);}
  if(name==='bossStart'){ensureFight();if(!fight.alive)startFightLocal(p.x,p.z);}
  if(name==='bossEnd'){endFightLocal(p.win);if(p.win){world.money=p.money??world.money;moneyPop('+'+money(p.reward||0));confetti('#ffd23c',120);}}
  if(name==='bossHit'){if(fight){fight.hp=p.hp;const Z=ZONES[p.zone];bossMarker(`${Z.label} ×${String(Z.mult).replace('.',',')}`,Z.color,V(...p.pos),p.zone==='eye');if(p.zone==='eye')fight.sfx('eyeHit',V(...p.pos));if(p.id===localId){hitMarkT=.35;sound.effect('hitmark');}}}
  if(name==='bossBoat'){const k=p.power;boat.userData.kickRoll=(boat.userData.kickRoll||0)+(Math.random()<.5?-1:1)*.35*k;boat.userData.kickPitch=(boat.userData.kickPitch||0)-.2*k;if(!me()?.land)jolt(6*k,(Math.random()-.5)*6,4*k,-10);aberrPulse=Math.max(aberrPulse,.5*k);sound.effect('thud',{pos:boat.position});}
  if(name==='bakerTalk'){world.talk={at:elapsed,id:p.id};}
  if(name==='bakerVanish'){const at=V(...p.at);sound.effect('leave',{pos:at});sound.effect('puff',{pos:at});for(let i=0;i<60;i++){const a=Math.random()*6.28,r=Math.random()*.6,h=Math.random()*1.8;fx.spray.emit(elapsed,at.x+Math.cos(a)*r*.4,at.y+h,at.z+Math.sin(a)*r*.4,Math.cos(a)*r*1.4,.3+Math.random()*.8,Math.sin(a)*r*1.4,1.4+Math.random()*1.2,1.2,-.02,.22,.55,1);}}
  if(name==='boatHome'){if(!host){boatState=p.x!=null?{x:p.x,z:p.z,heading:p.h,speed:0}:BERTH_STATE();boatTarget=null;}sound.effect('ropeTie',{pos:boat.position});}
  if(name==='temple')temple?.event(p);
  if(name==='eclipse'){world.eclipse={at:p.at,meteor:p.meteor};sound.effect('eclipse');eclPrev=-1;}
  if(name==='mk')market.event(p);if(name==='gear')gear.event(p);
  if(name==='bakerBack'){sound.effect('join',{pos:V(baker.x,baker.y+1,baker.z)});sound.effect('door',{pos:V(baker.x,baker.y+1,baker.z)});}
}

// ---------- Lobby e rede ----------
function updateLobby(){const list=lobby.snapshot(),connected=net.connected||solo;
  for(let i=0;i<CONFIG.characters;i++){const p=list.find(q=>q.character===i);$('char'+i).classList.toggle('selected',(p&&p.id===myNet)||(!net.connected&&selected===i));$('char'+i).classList.toggle('taken',!!p&&p.id!==myNet);
    $('ready'+i).textContent=p?(p.id===myNet?'VOCÊ':'PESCADOR '+(p.id+1))+(p.ready?' · PRONTO ✓':' · AGUARDANDO'):'LUGAR DISPONÍVEL';}
  const mine=list.find(p=>p.id===myNet);$('ready').disabled=!net.connected;$('ready').firstChild.textContent=mine?.ready?'CANCELAR PRONTO ':'ESTOU PRONTO ';
  $('ready-hint').textContent=!net.connected?'Aguardando outros pescadores (2 a 5).':list.length<2?'Precisa de pelo menos 2 pescadores.':`${list.length} a bordo · começa quando todos estiverem prontos.`;
  if(host&&net.host&&lobby.canStart&&!running){const roster=lobby.snapshot();net.send({type:'start',players:roster});start(false,roster);}}
function broadcastLobby(){net.send({type:'lobby',players:lobby.snapshot()});updateLobby();}
function onNetStatus(s,id){
  if(s==='peer-join'&&net.host){host=true;myNet=0;if(!lobby.players.has(0)){lobby=new Lobby();lobby.join(0,selected);}const c=lobby.freeCharacter();if(c>=0)lobby.join(id,c);status(`${lobby.players.size} pescadores na sala. Todos marcam “Estou pronto” para zarpar.`);broadcastLobby();$('ready').disabled=false;show('connection',false);}
  else if(s==='peer-leave'&&net.host){lobby.leave(id);broadcastLobby();const idx=players.findIndex(p=>p.net===id);if(running&&idx>=0){players[idx].mode='gone';players[idx].x=99;if(models[idx])models[idx].visible=false;ragdolls.remove(idx);world.rifles=world.rifles.map(r=>r===idx?-1:r);toast(`Pescador ${id+1} saiu do barco.`);}else status(net.connected?`${lobby.players.size} pescadores na sala.`:'Aguardando outros pescadores.');}
  else if(s==='trying'&&id==='ponte')status('A conexão direta com o anfitrião não abriu. Tentando entrar pela ponte de outro pescador da sala…');
  else if(s==='connected'&&!net.host){host=false;status((net.via==='ponte'?'Conectado pela ponte de outro pescador (sua rede não alcança o anfitrião direto). Escolha seu personagem e marque “Estou pronto”.':'Conectado! Escolha seu personagem e marque “Estou pronto”.')+(net.diag?' · Sua rede: '+net.diag:''));net.send({type:'hello',character:selected});$('ready').disabled=false;show('connection',false);}
  else if(s==='full')status('Esse barco já está cheio (5 pescadores).');
  else if(s==='diag'&&id)$('net-status').title='Sua rede: '+id;
  else if(s==='disconnected'){status('A conexão caiu. Entre em uma nova sala para jogar de novo.');$('ready').disabled=true;if(running&&!ended){paused=true;input.enabled=false;expectUnlock=true;input.unlock();show('lobby');toast('O anfitrião desconectou. A partida foi pausada.');}}
  else if(s==='error')status('A conexão não abriu. Tente de novo ou use a conexão manual.');
}
function receive(p,from){
  if(net.host){
    // o convidado chega com um personagem preferido: se estiver livre, é dele (mesmo que já tenha recebido outro ao entrar)
    if(p.type==='hello'){const pref=Number.isInteger(p.character)?p.character:0,cur=lobby.players.get(from);if(!cur){const c=lobby.freeCharacter(pref);if(c>=0)lobby.join(from,c);}else if(cur.character!==pref&&lobby.freeCharacter(pref)===pref){try{lobby.join(from,pref);}catch{}}broadcastLobby();}
    if(p.type==='pick'&&!running){try{lobby.join(from,p.character);}catch{}broadcastLobby();}
    if(p.type==='ready'){lobby.ready(from,p.ready);broadcastLobby();}
    if(p.type==='input'){const i=inputPacket(p),prev=remoteInputs[from]||{};remoteInputs[from]={...i,interact:i.interact||prev.interact,target:i.interact?i.target:prev.interact?prev.target:-1,cast:i.cast||prev.cast,slap:i.slap||prev.slap,jump:i.jump||prev.jump,fall:i.fall||prev.fall,fire:i.fire||prev.fire,use:i.use||prev.use,scan:i.scan||prev.scan,install:i.install||prev.install,climb:i.climb||prev.climb,aimPt:i.use?i.aimPt:prev.use?prev.aimPt:null,photo:i.use?i.photo:prev.use?prev.photo:0,boss:(i.fire||i.use)?i.boss:(prev.fire||prev.use)?prev.boss:-1,bossPt:(i.fire||i.use)?i.bossPt:prev.bossPt,gull:i.fire?i.gull:prev.fire?prev.gull:-1,ray:i.fire?i.ray:prev.ray,throwAt:i.throwAt>=0?i.throwAt:prev.throwAt??-1,throwOk:i.throwAt>=0?i.throwOk:prev.throwOk,shoo:i.shoo||prev.shoo||0,strum:i.strum?[...(prev.strum||[]),...i.strum].slice(-12):prev.strum||null};}
    if(p.type==='song'){const idx=players.findIndex(q=>q.net===from);if(idx>=0&&typeof p.name==='string'&&players[idx].mode==='guitar')stateEvent('song',{id:idx,name:p.name.slice(0,60),acc:clamp(Number(p.acc)||0)});}
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
  boatTarget=p.boat;boatState.heading=p.boat.heading;boatState.speed=p.boat.speed;if(p.bucket)world.bucket=p.bucket;if(p.rifles)world.rifles=p.rifles;world.bucketAt=p.bucketAt??-1;world.bucketPos=p.bucketPos||null;if(p.rope)world.rope=p.rope;if(p.eq)world.eq=p.eq;if(p.temple)world.temple=p.temple;if('eclipse' in p)world.eclipse=p.eclipse;if(p.mk)world.mk=p.mk;world.guitar=p.guitar??-1;world.shoo=p.shoo||null;world.talk=p.talk||null;world.money=p.money??world.money;world.trig=p.trig||null;world.storm=p.storm||null;world.nessie=p.nessie||0;if(p.boss){ensureFight();if(!fight.alive)startFightLocal(p.boss.s[0],p.boss.s[1]);fight.applySnapshot(p.boss);}else if(fight?.alive&&!p.boss)endFightLocal();if(p.baker)Object.assign(baker,{mode:p.baker[0],x:p.baker[1],y:p.baker[2],z:p.baker[3],yaw:p.baker[4]});
  if(p.impact){if(!world.impact||world.impact.d!==p.impact.d){world.impact={...p.impact};cataclysm.setImpact(world.impact);}}
  for(const sp of p.players){const q=players[sp.id];if(!q)continue;
    if(sp.id===localId){const {x,z,height,yaw,pitch,speed,...rest}=sp;Object.assign(q,rest,{x,z,height});pred.mode=sp.mode;pred.fish=sp.fish;pred.slap=sp.slap;pred.rifle=sp.rifle;pred.ammo=sp.ammo;pred.reload=sp.reload;pred.baly=sp.baly;pred.water=sp.water;pred.drown=sp.drown;for(const k of PLAYER_STATUS)pred[k]=sp[k];if(sp.mode!=='walk'||sp.tp!==pred.tp){if(pred.land!==sp.land)input.yaw+=(sp.land?1:-1)*boatState.heading;pred.x=x;pred.z=z;pred.height=height;pred.land=sp.land;pred.vy=0;pred.tp=sp.tp;}}
    else Object.assign(q,sp);
    if(sp.mode==='gone'&&models[sp.id])models[sp.id].visible=false;}
  for(let i=0;i<p.fishing.length;i++)if(fishing[i])Object.assign(fishing[i],p.fishing[i]);
  if(p.ragdolls)ragdolls.sync(p.ragdolls,id=>id==='baker'?baker.model:String(id).startsWith('npc')?villagers?.list[+String(id).slice(3)]?.model:models[id]);
  gulls.apply(p.gulls);
}
function snapshot(){return {type:'snapshot',time:elapsed,temple:world.temple,eclipse:world.eclipse,eq:world.eq,mk:world.mk,storm:world.storm,nessie:world.nessie,boss:fight?.alive?fight.snapshot():null,boat:boatState,impact:world.impact,bucket:world.bucket,money:world.money,trig:world.trig,bucketAt:world.bucketAt,bucketPos:world.bucketPos,rope:world.rope,guitar:world.guitar,shoo:world.shoo,talk:world.talk,baker:[baker.mode,+baker.x.toFixed(2),+baker.y.toFixed(2),+baker.z.toFixed(2),+baker.yaw.toFixed(2)],rifles:world.rifles,gulls:gulls.snapshot(),players,ragdolls:ragdolls.active.size?ragdolls.snapshot():null,fishing:fishing.map(f=>({phase:f.phase,progress:f.progress,tension:f.tension,target:f.target,needle:f.needle,vel:f.vel,run:f.run,species:f.species,caught:f.caught,combo:f.combo,weight:f.weight}))};}
function changeCharacter(i){selected=i;if(net.connected){if(net.host){try{lobby.join(0,i);}catch{toast('Esse personagem já foi escolhido.');}broadcastLobby();}else net.send({type:'pick',character:i});return;}lobby=new Lobby();lobby.join(0,i);updateLobby();}

// ---------- Nessie na partida ----------
function ensureFight(){if(fight)return fight;fight=new NessieFight(scene,{fluid,sound,waves:(x,z,t)=>waveHeight(x,z,t,weatherAt(story).storm)});return fight;}
function startFightLocal(x,z){ensureFight();if(!fluid.active||!world.impact){fluid.start(new THREE.Vector2(boatState.x,boatState.z),9);}fluidOff=0;fight.begin(x,z);show('boss-hud');if(sound.ctx&&!battle)battle=new BattleMusic(sound);if(battle)battle.playing=true;}
function endFightLocal(win=false){if(!fight)return;fight.end();show('boss-hud',false);if(battle)battle.playing=false;fluidOff=8;if(win)bossBanner('A MATRIARCA CAIU','A tripulação sobreviveu. A Nessie afundou no abismo.');}
// o anfitrião começa a luta quando o barco chega em mar aberto (longe da ilha)
// tempestades chegam sozinhas; na segunda (quarta, sexta…) a Nessie espera o barco em mar aberto durante a tempestade.
// Na luta a tempestade dura enquanto ela estiver viva; o meteoro continua sendo só do anfitrião (TAB).
function stormTick(){if(world.trig||fight?.alive||island.exploded||eclipseK()>=0)return;const st=world.storm;if(st&&elapsed<st.at+(st.dur??STORM_TIME))return;
  if(world.nessie&&st){world.nessie=0;}
  if(elapsed>=world.nextStorm){world.stormCount=(world.stormCount||0)+1;world.storm={at:elapsed,dur:STORM_DUR};const boss=world.stormCount%2===0;if(boss)world.nessie=1;world.nextStorm=elapsed+STORM_DUR+(nextStormAt(0));stateEvent('storm',{on:true,n:world.stormCount,boss});if(boss)stateEvent('nessieArmed',{});}}
function summonNessie(){nessieCheck(true);}
function nessieCheck(force=false){if(!world.nessie||fight?.alive||world.trig||island.exploded||eclipseK()>=0)return;const d=Math.hypot(boatState.x-ISLAND.x,boatState.z-ISLAND.z);if(d<(force?60:150))return;if(Math.hypot(boatState.x-VOLCANO.x,boatState.z-VOLCANO.z)<VOLCANO.size*.62)return;world.eq.fightId++;
  world.nessie=0;const a=boatState.heading+Math.PI*.6;const x=boatState.x+Math.sin(a)*45,z=boatState.z+Math.cos(a)*45;world.storm={at:elapsed-20,dur:9999};startFightLocal(x,z);stateEvent('bossStart',{x,z});}
function bossBroadcast(e){if(!solo&&host&&['splash','ring','beam','wall','spine','sfx','surge','attack','stage','dying'].includes(e.k))net.send({type:'event',name:'boss',payload:e,v:CONFIG.protocol});if(['attack','stage','dying'].includes(e.k))bossUI(e);}
function hostBoss(dt){if(!fight?.alive)return;const vx=Math.sin(boatState.heading)*boatState.speed,vz=Math.cos(boatState.heading)*boatState.speed;
  // chamariz: ela persegue a isca mecânica; arpão: presa ao barco, tudo nela fica lento
  const eq=world.eq,dec=eq.decoy&&eq.decoy.until>elapsed?eq.decoy:null,tgt=dec?{x:dec.x,z:dec.z,vx:0,vz:0,heading:0}:{x:boatState.x,z:boatState.z,vx,vz,heading:boatState.heading},slow=eq.tether>elapsed?.4:1;
  if(slow<1){const S=fight.S,dx=S.x-boatState.x,dz=S.z-boatState.z,d=Math.hypot(dx,dz);if(d>30){S.x-=dx/d*(d-30)*Math.min(1,dt*2);S.z-=dz/d*(d-30)*Math.min(1,dt*2);}}
  for(const e of fight.simulate(dt*slow,tgt)){if(dec&&(e.k==='boatHit'||e.k==='boatRide')&&Math.hypot(e.x-boatState.x,e.z-boatState.z)>14)continue;bossBroadcast(e);
    if(e.k==='boatHit'&&elapsed<(world.eq.bossHitUntil||0))continue;
    if(e.k==='boatHit')world.eq.bossHitUntil=elapsed+1.8;
    if(e.k==='boatHit'||e.k==='boatRide'){const hitK=e.k==='boatHit'?e.power:.5,dx=boatState.x-e.x,dz=boatState.z-e.z,l=Math.hypot(dx,dz)||1;boatState.x+=dx/l*1.2*hitK;boatState.z+=dz/l*1.2*hitK;boatState.speed*=e.k==='boatRide'?.95:.65;boatState.heading+=(Math.random()-.5)*.2*hitK;if(e.k==='boatHit')gear.damageBoat(6*hitK);stateEvent('bossBoat',{power:hitK});
      // quem está no barco voa: o golpe da Nessie joga a tripulação no mar
      // todo golpe no barco derruba gente, mas nunca a tripulação inteira: 1 pescador (golpe forte: até metade); a onda que só passa derruba às vezes
      {const aboard=players.filter(q=>!q.land&&q.mode!=='ragdoll'&&q.mode!=='gone'&&q.mode!=='drive'),n=aboard.length;let k=e.k==='boatHit'?(hitK>=1.5?Math.max(1,Math.floor(n/2)):1):(Math.random()<.4?1:0);if(n>1)k=Math.min(k,n-1);
        for(const q of aboard.sort(()=>Math.random()-.5).slice(0,k)){const a=Math.random()*6.28;rag(q.id,'boss',[dx/l*6*hitK+Math.cos(a)*3,6+hitK*4,dz/l*6*hitK+Math.sin(a)*3]);}}}
    if(e.k==='finished'){const reward=1000;world.money=Math.round((world.money+reward)*100)/100;world.storm={at:elapsed-(STORM_TIME-20),dur:STORM_TIME};world.nextStorm=elapsed+20+nextStormAt(0);endFightLocal(true);stateEvent('bossEnd',{win:true,reward,money:world.money});}}
  if(fight.pull){const dx=fight.pull.x-boatState.x,dz=fight.pull.z-boatState.z,l=Math.hypot(dx,dz)||1;boatState.x+=dx/l*fight.pull.s*dt;boatState.z+=dz/l*fight.pull.s*dt;}}
function bossUI(e){if(e.k==='attack'){gear?.onBossAttack(e.name);/* sem o nome do ataque no meio da tela: o golpe se lê pela animação e pelo som */if(battle&&['ram','tripleRam','tail','cannon','bite','wall','volley','rage'].includes(e.name))battle.riser();if(e.name==='rage'&&e.stage===1)bossBanner('NESSIE','A MATRIARCA DO ABISMO DESPERTOU');}
  if(e.k==='stage'){bossBanner(`ESTÁGIO ${e.n}`,['','A ESPREITA','A FÚRIA','A MATRIARCA FERIDA'][e.n]);battle?.hit();}if(e.k==='splash'&&e.col>15){battle?.hit();const d=Math.hypot(e.x-camera.position.x,e.z-camera.position.z);if(d<60)jolt(4*(1-d/60),(Math.random()-.5)*4,3*(1-d/60),-6);}}
function bossBanner(t,sub){const el=$('boss-banner');el.innerHTML=`<b>${t}</b><small>${sub}</small>`;el.classList.remove('show');void el.offsetWidth;el.classList.add('show');}
function bossMarker(text,color,at,big){const el=document.createElement('div');el.className='boss-hit'+(big?' big':'');el.textContent=text;el.style.color=color;$('boss-hits').appendChild(el);bossMarkers.push({el,at:at.clone(),t:0});}
function bossHudTick(dt){if(!fight?.alive){return;}const hp=fight.hp/BOSS_HP;$('boss-fill').style.width=hp*100+'%';bossHud=(bossHud??hp);bossHud+=(hp-bossHud)*Math.min(1,dt*3);$('boss-trail').style.width=bossHud*100+'%';$('boss-stage').textContent=`ESTÁGIO ${fight.stage} · ${fight.stageName}`;$('boss-hud').classList.toggle('red',fight.stage>2);
  for(const m of [...bossMarkers]){m.t+=dt;m.at.y+=dt*1.2;const v=m.at.clone().project(camera);m.el.style.transform=`translate(${(v.x*.5+.5)*innerWidth}px,${(-v.y*.5+.5)*innerHeight}px) translate(-50%,-50%) scale(${1+Math.max(0,.3-m.t)})`;m.el.style.opacity=String(clamp(1.4-m.t*1.2));if(m.t>1.2||v.z>1){m.el.remove();bossMarkers.splice(bossMarkers.indexOf(m),1);}}}
// ---------- Tela de eventos (anfitrião segura TAB) ----------
function runEvent(kind){if(!host||!running||ended||cinematic)return;
  if(kind==='storm'){const on=!(world.storm&&storyTime(elapsed,null,world.storm)>60);world.storm=on?{at:elapsed,dur:STORM_TIME}:{at:elapsed-(STORM_TIME-20),dur:STORM_TIME};stateEvent('storm',{on});}
  if(kind==='nessie'){if(world.trig){toast('O meteoro já está vindo.');return;}if(fight?.alive){toast('A Nessie já está aqui!');return;}world.nessie=1;world.storm={at:elapsed,dur:9999};stateEvent('nessieArmed',{});}
  if(kind==='meteor'){if(fight?.alive){endFightLocal();stateEvent('bossEnd',{win:false});}triggerMeteor();}}
let eventsOpen=false;function openEvents(on){if(on===eventsOpen)return;eventsOpen=on;show('events',on);if(on){expectUnlock=true;input.unlock();$('ev-storm')?.classList.toggle('on',!!(world.storm&&storyTime(elapsed,null,world.storm)>60));$('ev-nessie')?.classList.toggle('on',!!(world.nessie||fight?.alive));$('ev-meteor').disabled=!!world.trig;}else if(running&&!ended&&!cinematic)input.lock();}
// ---------- Partida ----------
function start(isSolo,roster){
  if(running)return;solo=isSolo;host=isSolo||net.host;const ros=[...roster].sort((a,b)=>a.id-b.id);localId=isSolo?0:Math.max(0,ros.findIndex(r=>r.id===(host?0:myNet)));roster=ros;running=true;paused=false;elapsed=0;ended=false;cinematic=false;boatState=BERTH_STATE();
  players=roster.map((p,i)=>({...newPlayer(i,p.character),...newStatus(),net:p.id}));world=NEW_WORLD();gh.stop();ropeGame=null;fishing=players.map(()=>new Fishing());models=players.map(p=>spawn(p.character));menuCharacters.forEach(m=>m.visible=false);
  pred=host?null:{...players[localId]};setFirstPerson(models[localId],true);viewmodel.setLook(LOOKS[players[localId].character]);
  input.enabled=true;input.yaw=Math.PI;input.pitch=-.06;input.lock();show('lock-hint',!input.locked);sound.start();show('home',false);show('lobby',false);show('settings',false);show('hud');show('test-tools',isSolo);document.body.classList.add('playing');
  toast(isSolo?'Teste solo · atracados no cais de Laguna · F pesca · E pega itens · TAB chama o meteoro':`${players.length} a bordo, amarrados no cais de Laguna. Pesquem, levem o balde ao mercado e cuidado com as gaivotas!`);
}
function dropRifle(p){if(p.rifle<0)return;const slot=p.rifle;p.rifle=-1;world.rifles[slot]=-1;stateEvent('rifle',{id:p.id,slot,on:false});}
function rag(id,reason,velocity){const p=players[id];if(p.mode==='ragdoll'||p.mode==='gone')return;dropRifle(p);dropAll(p);p.mode='ragdoll';p.ragTime=0;fishing[id].reset();stateEvent('ragdoll',{id,reason,velocity:velocity||[(Math.random()-.5)*3,-1,(Math.random()-.5)*3]});}
// Larga balde, corda e violão (tapa, queda, meteoro)
function dropAll(p){
  if(world.bucketAt===p.id){const w=worldOf(p),g=island.ground(w.x,w.z);if(!p.land){world.bucketAt=-1;}else if(g>-.3){world.bucketAt=-2;world.bucketPos=[+w.x.toFixed(2),g,+w.z.toFixed(2)];}else world.bucketAt=-1;stateEvent('bucket',{id:p.id,on:false,home:world.bucketAt===-1});}
  if(world.rope.h===p.id&&(world.rope.s==='held'||world.rope.s==='pull')){if(world.rope.s==='pull')ragdolls.pull.delete(world.rope.pid);world.rope={s:'boat',h:-1,tgt:-1,pid:-1,t:0};stateEvent('rope',{id:p.id,on:false});}
  if(world.guitar===p.id){world.guitar=-1;if(p.mode==='guitar')p.mode='walk';stateEvent('guitar',{id:p.id,on:false});}
  if(world.shoo&&world.shoo.pid===p.id)resolveShoo(true);
  market.dropAll(p);
}
function bucketWorld(){if(world.bucketAt===-2&&world.bucketPos)return V(...world.bucketPos);if(world.bucketAt>=0&&players[world.bucketAt]){const q=players[world.bucketAt];return worldOf(q.id===localId?me():q,.35);}return boat.localToWorld(boat.userData.bucketLocal.clone());}
const handsFree=p=>p.rifle<0&&world.bucketAt!==p.id&&!(world.rope.h===p.id&&world.rope.s!=='tied')&&world.guitar!==p.id&&!p.hold&&(p.cartH??-1)<0&&(p.ride??-1)<0;
// Posição de cada cabeço (mundo) e da corda nas mãos
const bollardPos=i=>{const b=BOLLARDS[i];return V(ISLAND.x+b.u,b.y,ISLAND.z+b.v);};
function handPos(id){const m=models[id];if(id===localId&&!window.__peixesThirdPerson&&!cinematic)return camera.localToWorld(V(.22,-.28,-.5));return m?m.userData.joints.foreL.localToWorld(V(-.08,-.3,.05)):V();}
// Fim do ragdoll: quem caiu na água volta para o barco; quem caiu no convés, no cais ou na ilha levanta ali mesmo
function standUp(p){const r=ragdolls.active.get(p.id),local=p.id===localId,was=p.land;let spot=null;
  if(p.backTo){spot=p.backTo;p.backTo=null;}
  else if(r&&!r.launched){const T=r.bodies.torso.position,l=boat.worldToLocal(V(T.x,T.y,T.z));
    if(insideBoat(l.x,l.z))spot={land:0,x:l.x,z:l.z,h:floorAt(l.x,l.z)};
    else if(!island.exploded){const [x,z]=island.collide(T.x,T.z,.3,T.y-.9),g=island.ground(x,z,T.y);if(g>-.35){if(T.y>g+2&&p.ragTime<CONFIG.respawnAfter+4)return;spot={land:1,x,z,h:g};}}}
  const water=!spot;if(water){if(p.water&&!p.rescued)return;const sp=SPAWNS[p.id%SPAWNS.length];spot={land:0,x:sp[0],z:sp[1],h:0};}
  if(was!==spot.land){p.yaw+=(spot.land?1:-1)*boatState.heading;if(local)input.yaw+=(spot.land?1:-1)*boatState.heading;}
  p.mode='walk';p.land=spot.land;p.x=spot.x;p.z=spot.z;p.height=spot.h;p.vy=0;p.tp++;p.water=0;p.drown=0;p.rescued=0;stateEvent('respawn',{id:p.id,water});}
// Na água: 20 s boiando para alguém laçar. Resgatado = levanta no barco (ou no cais, ao lado de quem puxou); senão acorda no cais.
function rescueTo(p,holder){const r=world.rope;ragdolls.pull.delete(p.id);world.rope={s:'held',h:holder.id,tgt:-1,pid:-1,t:0};
  const hp=worldOf(holder),was=p.land;ragdolls.remove(p.id);p.mode='walk';p.water=0;p.drown=0;p.rescued=0;p.vy=0;p.tp++;
  if(holder.land){const [x,z]=island.collide(hp.x+.8,hp.z,.3,hp.y);p.land=1;p.x=x;p.z=z;p.height=island.ground(x,z,hp.y);}else{const l=boat.worldToLocal(hp.clone());let x=clamp(l.x+(l.x>0?-.7:.7),-.55,.55),z=clamp(l.z,-3,3);if(!insideBoat(x,z))x=0;p.land=0;p.x=x;p.z=z;p.height=floorAt(x,z);}
  if(was!==p.land){p.yaw+=(p.land?1:-1)*boatState.heading;if(p.id===localId)input.yaw+=(p.land?1:-1)*boatState.heading;}
  stateEvent('rescued',{id:p.id});stateEvent('respawn',{id:p.id,water:false});}
function drownRespawn(p){ragdolls.pull.delete(p.id);if(world.rope.pid===p.id)world.rope={s:'held',h:world.rope.h,tgt:-1,pid:-1,t:0};ragdolls.remove(p.id);
  if(p.land===0){p.yaw+=boatState.heading;if(p.id===localId)input.yaw+=boatState.heading;}
  p.mode='walk';p.land=1;p.x=ISLAND.x+(p.id%3-1)*.7;p.z=ISLAND.z+DOCK.v0+10+(p.id%2)*.8;p.height=island.exploded?0:island.ground(p.x,p.z);p.vy=0;p.tp++;p.water=0;p.drown=0;
  if(island.exploded){p.land=0;const sp=SPAWNS[p.id%SPAWNS.length];p.x=sp[0];p.z=sp[1];p.height=0;}
  stateEvent('drowned',{id:p.id});stateEvent('respawn',{id:p.id,water:true});}
// sair da água sozinho (nadando até o casco, o cais ou a praia)
function climbOut(p,kind,at){const rg=ragdolls.active.get(p.id);const T=rg?rg.bodies.torso.position:{x:boatState.x,y:0,z:boatState.z};const tx=T.x,ty=T.y,tz=T.z;ragdolls.pull.delete(p.id);ragdolls.remove(p.id);const was=p.land;p.mode='walk';p.water=0;p.drown=0;p.rescued=0;p.vy=0;p.tp++;
  if(kind==='boat'){const l=boat.worldToLocal(V(tx,ty,tz));let x=clamp(l.x,-.55,.55),z=clamp(l.z,-3,3);if(!insideBoat(x,z))x=0;p.land=0;p.x=x;p.z=z;p.height=floorAt(x,z);}
  else{const [x,z]=island.collide(at[0],at[1],.3);p.land=1;p.x=x;p.z=z;p.height=island.ground(x,z);}
  if(was!==p.land){p.yaw+=(p.land?1:-1)*boatState.heading;if(p.id===localId)input.yaw+=(p.land?1:-1)*boatState.heading;}stateEvent('respawn',{id:p.id,water:false});}
function floorAt(x,z){const benches=[[-2.84,1.29],[-.258,1.48],[2.279,1.225]];for(const [bz,w]of benches)if(Math.abs(z-bz)<.32&&Math.abs(x)<w)return .79;return 0;}
// Movimento com autoridade local (anfitrião para si; convidado com predição e envio da posição).
function moveLocal(p,i,dt,t){
  p.yaw=i.yaw??p.yaw;p.pitch=i.pitch??p.pitch;if(p.mode!=='walk'){p.speed=0;return;}
  // modo voar (comando de teste): anda para onde olha, ESPAÇO sobe, C desce, SHIFT turbo, sem gravidade nem colisão
  if(p.fly){const sp=flySpeed*(i.run?2.5:1),cp=Math.cos(p.pitch||0),fx=Math.sin(p.yaw)*cp,fz=Math.cos(p.yaw)*cp,fy=Math.sin(p.pitch||0),rx=-Math.cos(p.yaw),rz=Math.sin(p.yaw);
    p.x+=(fx*(i.z||0)+rx*(i.x||0))*sp*dt;p.z+=(fz*(i.z||0)+rz*(i.x||0))*sp*dt;p.height=clamp(p.height+(fy*(i.z||0)+(i.upHeld?1:0)-(i.downHeld?1:0))*sp*dt,-30,590);p.vy=0;p.speed=0;p.fall=false;return;}
  const boost=(p.baly>0?1.7:1)*gear.speedMul(p)*((p.cartH??-1)>=0?.9:1),fx=Math.sin(p.yaw),fz=Math.cos(p.yaw),rx=-Math.cos(p.yaw),rz=Math.sin(p.yaw);let mx=fx*(i.z||0)+rx*(i.x||0),mz=fz*(i.z||0)+rz*(i.x||0);const len=Math.hypot(mx,mz);
  const floorHere=()=>p.land?island.ground(p.x,p.z,p.height):floorAt(p.x,p.z);
  const grounded=p.height<=floorHere()+.02;if(i.jump&&grounded){p.vy=4.6*(p.baly>0?1.2:1);}
  p.speed=0;
  if(len){mx/=len;mz/=len;const speed=(i.run&&gear.canRun(p)?CONFIG.runSpeed:CONFIG.walkSpeed)*boost,dx=mx*speed*dt,dz=mz*speed*dt;
    const air=!grounded,moved=p.land?(landMove(p,dx,dz,air)||landMove(p,dx,0,air)||landMove(p,0,dz,air)):boatMove(p,dx,dz,air);
    if(moved)p.speed=speed;else if(!p.land&&displayTick%90===0&&floorAt(p.x+mx*.5,p.z+mz*.5)>.1)toast('ESPAÇO para pular o banco.');}
  p.vy-=10*dt;p.height+=p.vy*dt;const floor=floorHere();if(p.height<floor){if(p.vy<-3.2)sound.effect('land');p.height=floor;p.vy=0;}
  // pulou para fora do cais ou do barco e caiu no mar: vira ragdoll na água (o anfitrião confirma)
  if(p.land&&floor<-.35&&island.ground(p.x,p.z)<-.35&&!p.fall&&p.height<waveHeight(p.x,p.z,t,weatherAt(story).storm)-.25){p.fall=true;p.vy=0;}
  const w=weatherAt(story);if(!p.land&&w.storm>.25){const ox=p.x,oz=p.z;p.x+=Math.sin(t*2.1)*w.storm*.17*dt;p.z+=Math.cos(t*1.7)*w.storm*.13*dt;if(!insideBoat(p.x,p.z)){p.x=ox;p.z=oz;}}
  if(p.speed&&grounded){stepDist+=p.speed*dt;if(stepDist>(i.run?1.55:.8)){stepDist=0;sound.effect('step');}}
}
// No barco: a borda é parede (ninguém cai por andar). Só passa se do outro lado houver chão firme na altura de um passo (cais, praia).
function boatMove(p,dx,dz,air=false){
  const tryMove=(nx,nz)=>{
    if(insideBoat(nx,nz)){const floor=floorAt(nx,nz);if(p.height>=floor-.15){p.x=nx;p.z=nz;return true;}return false;}
    // passa por cima da amurada: procura chão firme até ~60 cm adiante (o casco é mais largo que o convés)
    const dl=Math.hypot(nx-p.x,nz-p.z)||1,ux=(nx-p.x)/dl,uz=(nz-p.z)/dl;
    for(const k of [0,.25,.5,.75,1]){const w=boat.localToWorld(V(nx+ux*k,CONFIG.deckY+p.height,nz+uz*k)),g=island.ground(w.x,w.z);
      // chão firme DE VERDADE (cais, areia seca): antes aceitava areia submersa e a proa jogava o pescador no mar
      if(g>Math.max(.05,waveHeight(w.x,w.z,elapsed,weatherAt(story).storm)+.1)&&g-w.y<.95&&g-w.y>-1.8){const wy=worldYaw(p);p.land=1;p.x=w.x;p.z=w.z;p.height=Math.max(g,w.y);p.vy=0;p.yaw=wy;if(p===me())input.yaw+=boatState.heading;return true;}}
    // no ar (pulo) a borda não segura: sai do barco para o mundo, por cima da água
    if(air&&p.vy>.5&&p.height>floorAt(p.x,p.z)+.2){const w=boat.localToWorld(V(nx,CONFIG.deckY+p.height,nz)),wy=worldYaw(p);p.land=1;p.x=w.x;p.z=w.z;p.height=w.y;p.yaw=wy;if(p===me())input.yaw+=boatState.heading;return true;}
    return false;};
  return tryMove(p.x+dx,p.z+dz)||tryMove(p.x+dx,p.z)||tryMove(p.x,p.z+dz);
}
// Em terra: colide com paredes, balcões, casas e árvores; não entra no mar; volta ao barco pisando no convés
function landMove(p,dx,dz,air=false){
  let [nx,nz]=island.collide(p.x+dx,p.z+dz,.3,p.height);if(villagers&&!island.exploded)[nx,nz]=villagers.push(nx,nz);
  // carrinho e item sem pagar: a porta do mercado segura
  if(!market.canMove(p,nx,nz))return false;
  // do cais para o barco: o convés pode estar a ~60 cm (vão entre a borda do cais e a borda caminhável)
  const dl=Math.hypot(dx,dz)||1;let l=null;for(const k of [0,.25,.5,.75,1]){const c=boat.worldToLocal(V(nx+dx/dl*k,p.height,nz+dz/dl*k));if(insideBoat(c.x,c.z)){l=c;break;}}
  if(l){const f=floorAt(l.x,l.z),deck=boat.localToWorld(V(l.x,CONFIG.deckY+f,l.z)).y;if(p.height-deck<1.4&&p.height-deck>-.6){const wy=p.yaw;p.land=0;p.x=l.x;p.z=l.z;p.height=Math.max(f,p.height-deck+f);p.vy=Math.min(p.vy,0);p.yaw=wy-boatState.heading;if(p===me())input.yaw-=boatState.heading;return true;}}
  // na praia a água continua bloqueada; do cais (ou já sobre a água) dá para pular no mar
  const g=island.ground(nx,nz,p.height),u=p.x-ISLAND.x,v=p.z-ISLAND.z,onDock=u>=DOCK.u0-.1&&u<=DOCK.u1+.1&&v>=DOCK.v0-.1&&v<=DOCK.rampFrom,overSea=island.ground(p.x,p.z,p.height)<-.35;
  if(g<-.35&&!(air&&(onDock||overSea))||g>p.height+.55)return false;
  p.x=nx;p.z=nz;return true;
}
function doSlap(p){p.slap=1;const wy=worldYaw(p),fx=Math.sin(wy),fz=Math.cos(wy),pw=worldOf(p);let hit=false;
  const facing=(w,range)=>{const dx=w.x-pw.x,dz=w.z-pw.z,d=Math.hypot(dx,dz);return d<range&&Math.abs(w.y-pw.y)<1.3&&(dx*fx+dz*fz)/(d||1)>.3?[dx/(d||1),dz/(d||1)]:null;};
  for(const q of players){if(q.id===p.id||q.mode==='ragdoll'||q.mode==='gone')continue;const dir=facing(worldOf(q),CONFIG.slapRange);if(dir){rag(q.id,'slap',[dir[0]*7.5,3.4,dir[1]*7.5]);hit=true;}}
  if(baker.mode==='work'||baker.mode==='walk'){const dir=facing(V(baker.x,baker.y,baker.z),CONFIG.slapRange+.55);if(dir){bakerRag([dir[0]*7,4,dir[1]*7]);hit=true;}}
  if(villagers&&!island.exploded)villagers.list.forEach((n,k)=>{if(n.rag!=null||!n.near)return;const dir=facing(V(n.x,groundY(n.x,n.z),n.z),CONFIG.slapRange+.3);if(dir){hit=true;stateEvent('npcSlap',{i:k,velocity:[dir[0]*7,3.8,dir[1]*7]});}});
  stateEvent('slap',{id:p.id,hit});}
const groundY=(x,z)=>island.exploded?0:island.ground(x,z);
// ---------- Padeiro ----------
function bakerHome(){const b=island.shop.points.baker;return V(ISLAND.x+b.u,SHOP.floor,ISLAND.z+b.v);}
function bakerRag(vel){if(baker.mode==='ragdoll'||baker.mode==='gone'||baker.mode==='talk'||island.exploded)return;baker.mode='ragdoll';baker.t=0;stateEvent('bakerSlap',{velocity:vel});}
function bakerPath(){const L=(u,v)=>V(ISLAND.x+u,0,ISLAND.z+v),u=baker.x-ISLAND.x,v=baker.z-ISLAND.z,h=island.shop.points.baker;
  if(v>23.2&&u>3.9&&u<15.8)return [L(h.u,h.v)];
  const pts=[];if(u<SHOP.u0||u>SHOP.u1||v<SHOP.v0||v>SHOP.v1)pts.push(L(0,1.5),L(0,6),L(0,21.3));else if(v<21)pts.push(L(Math.max(-2.5,Math.min(2.5,u)),v),L(Math.max(-2.5,Math.min(2.5,u)),21.3));
  pts.push(L(15,21.3),L(15,23.7),L(h.u,h.v));return pts;}
// "É... Tenho que sair aqui": digitando, pausa dramática, 1 s de silêncio e o padeiro some (volta 10 s depois pela porta)
const TALK={first:'É...',rest:' Tenho que sair aqui',dots:.54,pause:2.05,char:.055,hold:1};TALK.end=TALK.pause+TALK.rest.length*TALK.char+TALK.hold;
function talkText(k){if(k<0)return '';if(k<TALK.pause)return TALK.first.slice(0,Math.min(TALK.first.length,1+Math.floor(k/(TALK.dots/3))));return TALK.first+TALK.rest.slice(0,Math.floor((k-TALK.pause)/TALK.char));}
function bakerStartTalk(p){baker.mode='talk';baker.t=0;baker.talkTo=p.id;world.talk={at:elapsed,id:p.id};stateEvent('bakerTalk',{id:p.id});}
function bakerTick(dt){
  if(island.exploded)return;
  if(baker.mode==='talk'){baker.t+=dt;if(baker.t>=TALK.end){baker.mode='gone';baker.t=0;world.talk=null;stateEvent('bakerVanish',{at:[baker.x,baker.y,baker.z]});}return;}
  if(baker.mode==='gone'){baker.t+=dt;if(baker.t>=10){baker.x=ISLAND.x;baker.z=ISLAND.z+SHOP.v0-3;baker.y=island.ground(baker.x,baker.z);baker.yaw=0;baker.mode='walk';baker.path=bakerPath();stateEvent('bakerBack',{});}return;}
  if(baker.mode==='ragdoll'){baker.t+=dt;if(baker.water&&baker.t>12){baker.water=0;ragdolls.remove('baker');baker.mode='gone';baker.t=5;stateEvent('bakerUp',{});return;}if(!baker.water&&baker.t>CONFIG.respawnAfter){const r=ragdolls.active.get('baker'),tp=r?r.bodies.torso.position:baker;[baker.x,baker.z]=island.collide(tp.x,tp.z,.3);baker.y=island.ground(baker.x,baker.z);baker.mode='walk';baker.path=bakerPath();stateEvent('bakerUp',{});}}
  else if(baker.mode==='walk'){const goal=baker.path[0];if(!goal){baker.mode='work';baker.yaw=Math.PI;const h=bakerHome();baker.x=h.x;baker.z=h.z;baker.y=h.y;return;}
    const dx=goal.x-baker.x,dz=goal.z-baker.z,d=Math.hypot(dx,dz);if(d<.12){baker.path.shift();return;}const sp=Math.min(d,1.25*dt);baker.x+=dx/d*sp;baker.z+=dz/d*sp;baker.yaw=Math.atan2(dx,dz);baker.y=island.ground(baker.x,baker.z);}
}
function renderBaker(t,dt){const m=baker.model;if(!m)return;if(island.exploded||baker.mode==='gone'){m.visible=false;if(ragdolls.active.has('baker')&&baker.mode==='gone')ragdolls.remove('baker');return;}if(baker.mode==='ragdoll'){if(!ragdolls.active.has('baker')&&!host)ragdolls.launch('baker',m,[0,3,0]);return;}if(ragdolls.active.has('baker'))ragdolls.remove('baker');
  if(baker.mode==='work'||baker.mode==='talk'){const h=bakerHome();baker.x=h.x;baker.y=h.y;baker.z=h.z;}
  const d=m.userData.disp||(m.userData.disp={x:baker.x,z:baker.z,y:baker.y,yaw:baker.yaw}),k=Math.min(1,dt*10),px=d.x,pz=d.z;d.x+=(baker.x-d.x)*k;d.z+=(baker.z-d.z)*k;d.y+=(baker.y-d.y)*k;let dy=baker.yaw-d.yaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));d.yaw+=dy*Math.min(1,dt*8);
  m.visible=true;m.position.set(d.x,d.y,d.z);m.rotation.set(0,d.yaw,0);const sp=Math.hypot(d.x-px,d.z-pz)/Math.max(dt,1e-4);
  // olha para quem chega no balcão
  let look=null,bd=6;for(const p of players){if(p.mode==='gone')continue;const w=worldOf(p===players[localId]?me():p,1.6);const dd=Math.hypot(w.x-d.x,w.z-d.z);if(dd<bd){const l=lookAngles(V(d.x,d.y+1.6,d.z),d.yaw,w);if(l){bd=dd;look=l;}}}
  m.userData.anim.update(dt,{time:t,speed:baker.mode==='walk'?Math.min(sp,1.6):0,yaw:d.yaw,grounded:true,look});}
// ---------- Alvos de interação: só vale olhar para a malha do objeto (raio do centro da tela, até 3 m) ----------
const T={HELM:1,RIFLE0:2,RIFLE1:3,BUCKET:4,COIL:5,GUITAR:6,ROPE:7,SELL:8,BAKER:9,LANE:10,SCAN:11,PAY:12,HULL:13};
let sellProxy=null,laneProxies=[],tieProxies=[],hover=null;const _ray=new THREE.Raycaster();
function targetObjects(){const l=[[T.HELM,helm],[T.RIFLE0,rackRifles[0]],[T.RIFLE1,rackRifles[1]],[T.BUCKET,bucketObj],[T.COIL,hull.userData.coil],[T.GUITAR,guitarStand],[T.ROPE,rope.mesh],[T.ROPE,rope.loop],[T.ROPE,tieProxies[0]],[T.ROPE,tieProxies[1]],[T.SELL,sellProxy],[T.BAKER,baker.model],[T.HULL,hull]];return l.concat(market.targets(),gear.targets(),temple?temple.targets():[]);}
const shown=o=>{for(let q=o;q;q=q.parent){if(!q.visible)return false;if(q===scene)return true;}return false;};
function targetPos(code,p){const w=worldOf(p,1.2);if(isTempleCode(code))return temple?.pos(code)||null;if(code===T.HULL)return boat.position.clone();if(code>=11&&code<=12||code>=60)return market.pos(code,p);if(code>=30&&code<60)return gear.pos(code);switch(code){
  case T.HELM:return helm.getWorldPosition(V());case T.RIFLE0:case T.RIFLE1:return rackRifles[code-T.RIFLE0].getWorldPosition(V());case T.BUCKET:return bucketWorld();
  case T.COIL:return hull.userData.coil.getWorldPosition(V());case T.GUITAR:return guitarStand.getWorldPosition(V());case T.SELL:return sellProxy.getWorldPosition(V());case T.BAKER:return V(baker.x,baker.y+1,baker.z);
  case T.ROPE:{if(world.rope.s!=='tied')return null;const a=boat.localToWorld(V(BOW_CLEAT.x,BOW_CLEAT.y,BOW_CLEAT.z)),b=bollardPos(world.rope.tgt);return a.distanceTo(w)<b.distanceTo(w)?a:b;}
  case T.LANE:{let best=null;for(const o of laneProxies){const q=o.getWorldPosition(V());if(!best||q.distanceTo(w)<best.distanceTo(w))best=q;}return best;}}return null;}
// texto do aviso (e se dá para usar agora) para quem está olhando
function targetLabel(code,p){const free=handsFree(p);if(isTempleCode(code))return temple?.label(code,p)||null;if(code===T.HULL){const id=gear.boatItem(p,gear.sel??-1);return id&&gear.nearBoat(p)?[`Segure E · instalar ${ITEMS[id].name} no barco`,1]:null;}if(code>=11&&code<=12||code>=60)return market.label(code,p);if(code>=30&&code<60)return gear.label(code,p);switch(code){
  case T.HELM:return engineDead?['Motor morto',0]:players.some(q=>q.mode==='drive')?['Leme ocupado',0]:!free?['Mãos ocupadas',0]:['Assumir o leme',1];
  case T.RIFLE0:case T.RIFLE1:return free?['Pegar o rifle',1]:['Mãos ocupadas',0];
  case T.BUCKET:return world.bucketAt<0?(free?[`Pegar o balde (${world.bucket.length} ${world.bucket.length===1?'item':'itens'})`,1]:['Mãos ocupadas',0]):null;
  case T.COIL:return world.rope.s!=='boat'?null:free?['Pegar a corda',1]:['Mãos ocupadas',0];
  case T.GUITAR:return world.guitar>=0?null:free?['Tocar o violão',1]:['Mãos ocupadas',0];
  case T.ROPE:return world.rope.s!=='tied'?null:free?['Soltar a corda (o barco fica à deriva)',1]:['Mãos ocupadas',0];
  case T.SELL:{const v=world.bucket.reduce((q,e)=>q+entryValue(e),0);return world.bucketAt===p.id?(world.bucket.length?[`Vender o balde (≈ ${money(v)})`,1]:['O balde está vazio',0]):['Peixaria · traga o balde até aqui',0];}
  case T.BAKER:return baker.mode==='work'&&!world.talk?['Falar com o padeiro',1]:null;
  case T.LANE:return ['Caixa de autoatendimento · em breve',1];}return null;}
function pickTarget(){hover=null;
  // corda amarrada: área de clique em volta do cabeço e do cunho da proa (mirar só na corda fina era difícil)
  const tied=world.rope.s==='tied';tieProxies.forEach(o=>o.visible=tied);if(tied){tieProxies[1].position.copy(bollardPos(world.rope.tgt)).add(V(0,-.05,0));tieProxies[1].updateMatrixWorld();}const p=me();if(!p||p.mode==='ragdoll'||cinematic||window.__peixesThirdPerson)return;_ray.setFromCamera({x:0,y:0},camera);_ray.far=3.2;let best=null;
  for(const [code,obj]of targetObjects()){if(!obj||!shown(obj))continue;const h=_ray.intersectObject(obj,true)[0];if(h&&(!best||h.distance<best.distance))best={code,point:h.point,distance:h.distance};}
  if(best){const lab=targetLabel(best.code,p);if(lab)hover={...best,label:lab[0],ok:lab[1]};}}
function interact(p,target=-1){
  const w=worldOf(p);
  // o que está na mão sai primeiro (ou o leme)
  if(p.mode==='guitar'){world.guitar=-1;p.mode='walk';stateEvent('guitar',{id:p.id,on:false});return;}
  if(p.mode==='drive'){p.mode='walk';p.x=0;p.z=-2.65;p.tp++;stateEvent('drive',{id:p.id,on:false});return;}
  if(p.rifle>=0){dropRifle(p);return;}
  if(world.bucketAt===p.id){if(target===T.SELL){sellBucket(p);return;}
    if(!p.land){world.bucketAt=-1;}else{const g=island.ground(w.x+Math.sin(p.yaw)*.6,w.z+Math.cos(p.yaw)*.6);world.bucketAt=-2;world.bucketPos=[+(w.x+Math.sin(p.yaw)*.6).toFixed(2),g,+(w.z+Math.cos(p.yaw)*.6).toFixed(2)];}
    stateEvent('bucket',{id:p.id,on:false,home:world.bucketAt===-1});return;}
  if(world.rope.h===p.id&&world.rope.s==='held'){world.rope={s:'boat',h:-1,tgt:-1,pid:-1,t:0};stateEvent('rope',{id:p.id,on:false});return;}
  if(temple?.interact(p,target))return;if(market.interact(p,target))return;if(gear.interact(p,target))return;
  // alvo olhado: o anfitrião confere se ele existe e está ao alcance
  const at=target>0?targetPos(target,p):null;if(!at||at.distanceTo(worldOf(p,1.2))>3.8)return;const lab=targetLabel(target,p);if(!lab)return;if(!lab[1]){toastFor(p.id,lab[0]+'.');return;}
  switch(target){
    case T.HELM:fishing[p.id].reset();if(p.land){p.yaw+=-boatState.heading;if(p.id===localId)input.yaw-=boatState.heading;}p.land=0;p.mode='drive';p.x=0;p.z=-3.3;p.height=0;p.vy=0;p.tp++;stateEvent('drive',{id:p.id,on:true});return;
    case T.RIFLE0:case T.RIFLE1:{const slot=target-T.RIFLE0;if(world.rifles[slot]>=0){toastFor(p.id,'Esse rifle já está com alguém.');return;}fishing[p.id].reset();if(p.mode==='fish')p.mode='walk';p.rifle=slot;world.rifles[slot]=p.id;stateEvent('rifle',{id:p.id,slot,on:true});return;}
    case T.BUCKET:fishing[p.id].reset();if(p.mode==='fish')p.mode='walk';world.bucketAt=p.id;world.bucketPos=null;stateEvent('bucket',{id:p.id,on:true});return;
    case T.COIL:world.rope={s:'held',h:p.id,tgt:-1,pid:-1,t:0};stateEvent('rope',{id:p.id,on:true});return;
    case T.GUITAR:if(p.land)return;fishing[p.id].reset();world.guitar=p.id;p.mode='guitar';p.speed=0;stateEvent('guitar',{id:p.id,on:true});return;
    case T.ROPE:world.rope={s:'held',h:p.id,tgt:-1,pid:-1,t:0};stateEvent('untie',{id:p.id});return;
    case T.SELL:sellBucket(p);return;
    case T.BAKER:bakerStartTalk(p);return;
    case T.LANE:toastFor(p.id,'Caixa de autoatendimento: logo mais é aqui que você passa as suas compras.');return;}
}
// Peixaria do mercado: vende o balde inteiro (o balde fica no barco, então o barco precisa estar atracado)
function sellBucket(p){
  if(!world.bucket.length){toastFor(p.id,'O balde está vazio. Vá pescar primeiro!');return;}
  const sell=island.shop.points.sell,sx=ISLAND.x+sell.u,sz=ISLAND.z+sell.v,here=world.bucketAt>=0?(()=>{const q=players[world.bucketAt];const w=worldOf(q.id===localId?me():q);return q.land&&Math.hypot(w.x-sx,w.z-sz)<3;})():world.bucketAt===-2&&world.bucketPos&&Math.hypot(world.bucketPos[0]-sx,world.bucketPos[2]-sz)<3;
  if(!here){toastFor(p.id,'Traga o balde até aqui! Pegue o balde no barco (E) e carregue até a peixaria.');return;}
  let total=0,top=null;for(const e of world.bucket){const [sp,kg]=e,v=entryValue(e);total+=v;if(!top||v>top[2])top=[sp,kg,v];}
  total=Math.round(total*100)/100;world.money=Math.round((world.money+total)*100)/100;const count=world.bucket.length;world.bucket=[];
  stateEvent('sold',{id:p.id,total,count,best:top,money:world.money});}
function castLine(p,f){const fx=Math.sin(p.yaw),fz=Math.cos(p.yaw),cd=gear.castDist(p),cx=p.x+fx*cd,cz=p.z+fz*cd;
  if(!p.land&&insideBoat(cx,cz)){toastFor(p.id,'Mire para fora do barco para lançar a linha.');return;}
  const w=p.land?V(cx,0,cz):boat.localToWorld(V(cx,0,cz));if(!island.exploded&&island.ground(w.x,w.z)>(gear.shallowOk(p)?-.3:-.8)){toastFor(p.id,gear.shallowOk(p)?'Nem o camarão pega aí: é areia seca.':'Aí é raso demais. Mire para a água funda (ou use a isca de camarão).');return;}
  f.cast(gear.castMods(p,cx,cz,!!p.land));gear.onCast(p,f);p.mode='fish';p.cx=cx;p.cz=cz;stateEvent('cast',{id:p.id});}
function tickPlayer(p,i,dt,t,isLocal){
  const f=fishing[p.id];p.slap=Math.max(0,p.slap-dt*2.2);
  if(p.mode==='gone')return;
  p.reload=Math.max(0,(p.reload||0)-dt);p.cool=Math.max(0,(p.cool||0)-dt);p.baly=Math.max(0,(p.baly||0)-dt);if(p.reload===0&&p.ammo<=0)p.ammo=5;
  if(p.mode==='ragdoll'){p.ragTime+=dt;if(p.water){gear.swim(p,i,dt);p.drown=Math.max(0,(p.drown??DROWN_TIME)-dt);if(p.drown<=0&&world.rope.pid!==p.id)drownRespawn(p);return;}if(p.ragTime>CONFIG.respawnAfter)standUp(p);return;}
  if(i.strum&&p.mode==='guitar')stateEvent('strum',{id:p.id,notes:i.strum.slice(0,8)});
  if(i.song&&p.mode==='guitar')stateEvent('song',{id:p.id,...i.song});
  if(i.throwAt>=0)throwRope(p,i.throwAt,!!i.throwOk);
  if(i.shoo&&world.shoo&&world.shoo.pid===p.id)resolveShoo(i.shoo===2);
  if(i.scan)market.scan(p);if(i.install)gear.installFromInv(p,i.sel??-1);gear.hostInput(p,i);
  p.swing=!!i.swing;
  if(i.yaw!==undefined){p.yaw=i.yaw;p.pitch=i.pitch;}
  if(p.rifle>=0){
    // Tiro: o atirador informa o raio e a gaivota que viu na mira; o anfitrião confirma se ela ainda está viva
    if(i.fire&&p.cool<=0&&p.reload<=0&&p.ammo>0){p.ammo--;p.cool=p.baly>0?.62:.85;const ray=i.ray||[0,0,0,0,0,1];const to=[ray[0]+ray[3]*120,ray[1]+ray[4]*120,ray[2]+ray[5]*120];let hitPos=null;
      if(i.gull>=0){const r=gulls.kill(i.gull);if(r){hitPos=r.pos;if(r.hadFish&&r.overBoat)world.bucket.push(world.stolen[i.gull]||[0,.12]);delete world.stolen[i.gull];stateEvent('gullHit',{id:p.id,gull:i.gull,pos:r.pos,hadFish:r.hadFish,overBoat:r.overBoat});}}
      if(hitPos){const w=boat.localToWorld(V(...hitPos));to[0]=w.x;to[1]=w.y;to[2]=w.z;}
      // Nessie: o atirador diz a parte que viu na mira; o anfitrião aplica o dano (olhos ×5, garganta ×3, guelras ×2...)
      if(i.boss>=0&&fight?.alive&&!fight.dead&&Array.isArray(i.bossPt)){const zone=ZONE_LIST[i.boss];if(zone){to[0]=i.bossPt[0];to[1]=i.bossPt[1];to[2]=i.bossPt[2];const evs=fight.damage(zone,world.eq.tether>elapsed?1.5:1)||[];stateEvent('bossHit',{id:p.id,zone,pos:i.bossPt,hp:fight.hp});for(const e of evs)bossBroadcast(e);}}
      stateEvent('shot',{id:p.id,to});if(p.ammo<=0){p.reload=RELOAD;stateEvent('reload',{id:p.id});}}
  }else if(i.slap&&p.slap===0)doSlap(p);
  if(p.mode==='ride'&&i.jump)market.unride(p);else if(i.interact)interact(p,i.target??-1);
  if(p.mode==='drive'||p.mode==='guitar'||p.mode==='ride'){p.speed=0;return;}
  if(i.cast&&p.rifle>=0)toastFor(p.id,'Devolva o rifle (E) para pescar.');else if(i.cast&&!handsFree(p)&&p.mode!=='guitar')toastFor(p.id,'Mãos ocupadas: largue o que está segurando (E) para pescar.');else if(i.cast&&p.mode!=='guitar'){if(f.phase==='idle')castLine(p,f);else if(f.phase==='bite')f.reel();else if(f.phase==='waiting'){f.reset();p.mode='walk';}}
  const wasReeling=f.phase==='reeling',result=f.step(dt,!!i.reel,t,p.baly>0);if(result){if(result==='caught')world.bucket.push([f.lastSpecies,f.lastWeight,gear.catchBonus(p,f.lastSpecies)]);if(result==='escaped')gear.onEscaped(p,f,wasReeling);stateEvent(result,{id:p.id,fish:f.caught,species:f.lastSpecies,weight:f.lastWeight});if(result==='caught'&&f.lastSpecies===BALY){p.baly=CONFIG.balyTime;stateEvent('baly',{id:p.id});}if(result==='caught'||result==='escaped'){p.mode='walk';p.fish=f.caught;}}
  if(p.mode==='fish'&&(i.x||i.z)){f.reset();p.mode='walk';}
  if(p.mode==='walk'){if(isLocal)moveLocal(p,i,dt,t);else if(i.px!==undefined&&i.tp===p.tp){p.x=i.px;p.z=i.pz;p.height=i.ph;p.speed=i.speed;p.land=i.land?1:0;}
    // caiu no mar depois de um pulo (o próprio jogador detecta; o anfitrião transforma em ragdoll)
    if(isLocal?p.fall:i.fall&&i.tp===p.tp){p.fall=false;rag(p.id,'water',[Math.sin(worldYaw(p))*1.5,-2,Math.cos(worldYaw(p))*1.5]);}}else p.speed=0;
}
// Corda: o cliente de quem arremessa resolve o minigame e manda o alvo e se acertou; o anfitrião valida a distância
function throwRope(p,code,ok){const r=world.rope;if(r.h!==p.id||r.s!=='held')return;const from=handPos(p.id);let to=null,target=null;
  if(code<100&&BOLLARDS[code]){to=bollardPos(code);target={kind:'b',i:code};}
  else{const q=players[code-100];const rg=q&&ragdolls.active.get(q.id);if(q&&q.water&&rg){const t=rg.bodies.torso.position;to=V(t.x,t.y,t.z);target={kind:'p',id:q.id};}}
  if(!to||from.distanceTo(to)>ROPE.max+2)return;
  world.rope={s:'fly',h:p.id,tgt:target.kind==='b'?target.i:-1,pid:target.kind==='p'?target.id:-1,t:elapsed,ok,from:from.toArray().map(v=>+v.toFixed(2)),to:to.toArray().map(v=>+v.toFixed(2))};stateEvent('ropeThrow',{id:p.id});}
function ropeTick(dt){const r=world.rope;
  if(r.s==='fly'&&elapsed-r.t>=ROPE.flight){const h=players[r.h];
    if(!r.ok||!h||h.mode==='ragdoll'){world.rope={s:'held',h:r.h,tgt:-1,pid:-1,t:0};stateEvent('ropeMiss',{id:r.h,at:r.to});return;}
    if(r.tgt>=0){world.rope={s:'tied',h:-1,tgt:r.tgt,pid:-1,t:elapsed};boatState.speed*=.3;stateEvent('ropeTied',{id:r.h,at:r.to});}
    else{const q=players[r.pid];if(!q||!q.water){world.rope={s:'held',h:r.h,tgt:-1,pid:-1,t:0};return;}world.rope={s:'pull',h:r.h,tgt:-1,pid:r.pid,t:elapsed};q.rescued=1;stateEvent('ropeCatch',{id:r.h,target:r.pid,at:r.to});}}
  if(r.s==='pull'){const h=players[r.h],q=players[r.pid],rg=q&&ragdolls.active.get(q.id);if(!h||!q||!rg||q.mode!=='ragdoll'){if(q)ragdolls.pull.delete(q.id);world.rope={s:'held',h:r.h,tgt:-1,pid:-1,t:0};return;}
    const hp=worldOf(h),t=rg.bodies.torso.position,d=Math.hypot(hp.x-t.x,hp.z-t.z);ragdolls.pull.set(q.id,{x:hp.x,z:hp.z,speed:3.4});if(d<2.3||elapsed-r.t>14)rescueTo(q,h);}
}
// Espantar a gaivota: o anfitrião dá 8 s; o cliente de quem segura o balde joga e manda o resultado
function resolveShoo(stole){const sh=world.shoo;if(!sh)return;world.shoo=null;const took=stole&&world.bucket.length>0;if(took){const item=world.bucket.pop();world.stolen[sh.gull]=item;}gulls.resolve(sh.gull,took);}
const HULL_PTS=[[0,4.5],[0,-3.9],[1.55,0],[-1.55,0],[1.25,2.6],[-1.25,2.6],[1.25,-2.6],[-1.25,-2.6]];
function boatHits(){const h=boatState.heading,c=Math.cos(h),s=Math.sin(h);for(const [lx,lz]of HULL_PTS){if(island.ground(boatState.x+lx*c+lz*s,boatState.z-lx*s+lz*c,-1)>-.85)return true;}return false;}
let emptyBoatT=0;
function boatHome(){if(fight?.alive){endFightLocal();stateEvent('bossEnd',{win:false});world.storm=null;}boatState=BERTH_STATE();world.rope={s:'tied',h:-1,tgt:1,pid:-1,t:elapsed,ok:true,from:null,to:null};world.eq.anchor=0;world.eq.anchorAt=null;world.eq.drogue=0;world.eq.gear={};world.eq.fuel=0;world.eq.energy=100;stateEvent('boatHome',{});}
function hostTick(dt,local){
  elapsed+=dt;const t=elapsed;story=storyTime(t,world.trig,world.storm);const inputs=players.map(p=>p.id===localId?local:remoteInputs[p.net]||{});
  for(const p of players)tickPlayer(p,inputs[p.id]||{},dt,t,p.id===localId);
  for(const k of Object.keys(remoteInputs))remoteInputs[k]={...remoteInputs[k],slap:false,interact:false,cast:false,jump:false,fall:false,fire:false,use:false,scan:false,install:false,climb:false,gull:-1,throwAt:-1,shoo:0,strum:null};
  // Gaivotas ladras: só atacam com peixe no balde, mar calmo (na tempestade elas somem) e antes do meteoro
  const w=weatherAt(story),n0=world.bucket.length,held=world.bucketAt>=0&&players[world.bucketAt]?.mode!=='ragdoll';
  gulls.simulate(dt,{active:story<CONFIG.asteroidAt-4&&!cinematic&&w.storm<.35&&!(world.eq.gullsOff>t),bucketCount:n0,time:t,water:()=>-.2,bucket:boat.worldToLocal(bucketWorld().setY(bucketWorld().y)),held});
  for(const e of gulls.events.splice(0)){if(e.name==='stolen'){const item=world.bucket.pop();if(item)world.stolen[e.gull]=item;}if(e.name==='shoo'){if(!held||world.shoo){gulls.resolve(e.gull,true);continue;}world.shoo={gull:e.gull,pid:world.bucketAt,until:elapsed+9};stateEvent('shoo',{gull:e.gull,id:world.bucketAt});continue;}stateEvent(e.name,e);}
  if(world.shoo&&elapsed>world.shoo.until)resolveShoo(true);
  ropeTick(dt);market.hostTick(dt);gear.hostTick(dt);
  // Barco (com colisão contra a ilha e o cais)
  const driver=players.find(p=>p.mode==='drive');
  if(story>=CONFIG.impactAt&&!engineDead){engineDead=true;if(driver){driver.mode='walk';driver.z=-2.65;driver.tp++;}stateEvent('engine');}
  const prev={x:boatState.x,z:boatState.z,h:boatState.heading};
  const L=gear.boatLimits();
  if(driver&&!engineDead&&L.top>0){const i=inputs[driver.id]||{};boatState.speed=clamp(boatState.speed+((i.z||0)*2.2*L.accel-boatState.speed*.24)*dt,-1.4,L.top);boatState.heading-=(i.x||0)*dt*(.25+Math.abs(boatState.speed)*.16)*L.turn;gear.burn(dt,Math.abs(boatState.speed));}
  else boatState.speed*=Math.exp(-dt*(engineDead?2.5:.3));
  if(L.drag){boatState.speed*=Math.exp(-dt*L.drag);if(driver&&Math.abs(boatState.speed)>1&&displayTick%240===0)toastFor(driver.id,'Algas enroscando na hélice! A Hélice antialgas resolve.');}
  boatState.x+=Math.sin(boatState.heading)*boatState.speed*dt;boatState.z+=Math.cos(boatState.heading)*boatState.speed*dt;
  // solto, o barco anda com o mar (na tempestade vai longe); amarrado, a corda segura a proa perto do cabeço
  if(!driver&&world.rope.s!=='tied'&&!cinematic){const dr=driftAt(t,w.storm);boatState.x+=dr.x*dt*L.drift;boatState.z+=dr.z*dt*L.drift;boatState.heading+=dr.yaw*dt*L.drift;}
  if(world.rope.s==='tied'){const h=boatState.heading,c=Math.cos(h),sn=Math.sin(h),cx=boatState.x+BOW_CLEAT.z*sn,cz=boatState.z+BOW_CLEAT.z*c,bp=bollardPos(world.rope.tgt),dx=cx-bp.x,dz=cz-bp.z,d=Math.hypot(dx,dz);
    if(d>ROPE.length){const k=(d-ROPE.length)/d;boatState.x-=dx*k;boatState.z-=dz*k;if(driver&&Math.abs(boatState.speed)>1.2&&d>ROPE.length+.6)stateEvent('thud',{});boatState.speed*=.6;}
    const dr=driftAt(t,w.storm);if(!driver){boatState.x+=dr.x*dt*.4;boatState.z+=dr.z*dt*.4;}}
  if(boatHits()){boatState.x=prev.x;boatState.z=prev.z;boatState.heading=prev.h;if(Math.abs(boatState.speed)>.7)stateEvent('thud',{});boatState.speed*=-.25;}
  // O meteoro cai no meio da ilha e vem por cima do barco
  if(story>=CONFIG.asteroidAt&&!world.impact){const dx=boatState.x-ISLAND.x,dz=boatState.z-ISLAND.z,l=Math.hypot(dx,dz)||1;world.impact={x:ISLAND.x,z:ISLAND.z,d:0,dir:[dx/l*.75,dz/l*.75]};cataclysm.setImpact(world.impact);}
  if(story>=CONFIG.impactAt&&world.impact&&!world.impact.d){world.impact.d=Math.max(35,Math.hypot(world.impact.x-boatState.x,world.impact.z-boatState.z));
    // quem estava em terra vai junto com a ilha
    for(const p of players)if(p.land&&p.mode!=='gone'&&Math.hypot(worldOf(p).x-ISLAND.x,worldOf(p).z-ISLAND.z)<ISLAND.size*1.1){const a=Math.random()*6.28;rag(p.id,'boom',[Math.cos(a)*18,26+Math.random()*14,Math.sin(a)*18]);}
    if(baker.mode!=='ragdoll'&&baker.mode!=='gone'){baker.mode='ragdoll';baker.t=-99;stateEvent('bakerSlap',{velocity:[8,34,-6],boom:true});}
    stateEvent('explode',{});}
  // barco abandonado (ninguém a bordo) longe do cais: em 10 s ele reaparece amarrado no cais de Laguna
  if(!island.exploded&&!world.trig&&!players.some(q=>!q.land&&q.mode!=='ragdoll'&&q.mode!=='gone')&&!docked()){emptyBoatT+=dt;if(emptyBoatT>10){emptyBoatT=0;boatHome();}}else emptyBoatT=0;
  stormTick();nessieCheck();hostBoss(dt);temple?.hostTick();
  // o meteoro nasce do fim do eclipse do sacrifício (o eclipse de teste não chama o meteoro)
  if(world.eclipse?.meteor&&!world.trig&&elapsed-world.eclipse.at>=ECLIPSE.meteorAt)triggerMeteor();
  bakerTick(dt);
  netTick+=dt;if(!solo&&netTick>.05){netTick=0;net.send(snapshot());}
}
function guestTick(dt,local){
  elapsed+=dt;story=storyTime(elapsed,world.trig,world.storm);if(pred){moveLocal(pred,local,dt,elapsed);}
  net.send(inputPacket({...local,px:pred.x,pz:pred.z,ph:pred.height,speed:pred.speed,tp:pred.tp,land:pred.land,fall:pred.fall}));if(local.song)net.send({type:'song',v:CONFIG.protocol,...local.song});if(local.fire)local.fire=false;pred.fall=false;
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
  const floorP=p.land?island.ground(p.x,p.z,p.height):floorAt(p.x,p.z),grounded=p.height<=floorP+.05,moving=p.speed>0&&grounded;
  // aterrissagem: mergulho da câmera proporcional à queda; pulo: leve subida
  if(!grounded)lastVy=Math.min(lastVy,p.vy||0);
  if(grounded&&!prevGrounded){kick.dip.kick(-(1.2+Math.min(4,-lastVy)*.7));kick.x.kick(-1.4);lastVy=0;}else if(!grounded&&prevGrounded&&(p.vy||0)>0){kick.x.kick(1);kick.dip.kick(.8);}
  prevGrounded=grounded;
  // tapa local: tranco horizontal no instante do golpe
  if(prevSlap>.66&&p.slap<=.66)jolt(-.4,3.4,2,-5);prevSlap=p.slap;
  bobPhase+=dt*(moving?p.speed*(p.speed>3?3.1:4.2):0);const amp=moving?(p.speed>3?1.35:1):0;
  const bob=Math.abs(Math.sin(bobPhase))*.045*amp,sway=Math.sin(bobPhase)*.018*amp;
  const yaw=p.mode==='drive'||p.mode==='walk'||p.mode==='fish'||p.mode==='ride'?input.yaw:p.yaw;
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
  vm.hemi.color.copy(environment.ambient.color);vm.hemi.groundColor.copy(environment.ambient.groundColor);vm.hemi.intensity=environment.ambient.intensity*.72;vm.sun.color.copy(environment.sun.color);vm.sun.intensity=environment.sun.intensity*.7;vm.sun.position.copy(U.uSunDir.value).multiplyScalar(5);vm.scene.environment=scene.environment;
  const scopeK=smooth(.62,.95,vm.aim);vm.update(dt,{visible:holding&&!window.__peixesThirdPerson&&!cinematic,hide:scopeK>=.98,aiming:holding&&!!lastControls.aim,yaw:input.yaw,pitch:input.pitch,bob:bobPhase,moving:moving?1:0});
  const baly=p.baly>0?Math.min(1,p.baly/2):0;
  camera.fov=lerp(lerp(60+runFov*7,34,vm.aim),11.5,scopeK)+kick.fov.x+baly*(8+Math.sin(t*16.3)*3)*(1-scopeK);
  camera.fov*=gear.fovMul();
  if(window.__peixesFov)camera.fov=window.__peixesFov;// diagnóstico: aproxima para inspecionar a arma
  input.aimScale=gear.zoom?.25:lerp(1,.2,scopeK);document.body.classList.toggle("scoped",scopeK>.5);$("scope").style.opacity=scopeK;show('scope',scopeK>.02);
  if(scopeK>0){const steady=!!lastControls.run;breath=lerp(breath,steady?.18:1,1-Math.exp(-dt*3));camera.rotateX((Math.sin(t*1.3)*.0035+Math.sin(t*2.9)*.0012)*breath*scopeK);camera.rotateY((Math.sin(t*.9+1)*.004+Math.sin(t*2.3)*.0015)*breath*scopeK);}
  // diagnóstico: câmera orbital de terceira pessoa para inspecionar as animações do próprio personagem
  const tp=window.__peixesThirdPerson,busy=holding||world.bucketAt===localId||(world.rope.h===localId&&world.rope.s!=='tied')||p.mode==='guitar';setFirstPerson(models[localId],!tp,busy);if(tp){const a=tp.yaw??(yaw+2.4),d=tp.dist||2.6,W=v=>p.land?v:boat.localToWorld(v);const focus=V(p.x,(p.land?0:CONFIG.deckY)+p.height+1.1,p.z);camera.position.copy(W(focus.clone().add(V(Math.sin(a)*d,tp.h??.5,Math.cos(a)*d))));camera.lookAt(W(focus));camera.fov=tp.fov||50;}
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
  const hw=(px,pz)=>waveHeight(px,pz,t,w.storm)+clamp(tsuAt(px,pz,t),-6,4.5)+(fight?.alive||fight?.rings.length?fight.extraH(px,pz):0);
  const hb=hw(x+fx*3.4,z+fz*3.4),hs=hw(x-fx*3.4,z-fz*3.4),hr=hw(x+rx*1.3,z+rz*1.3),hl=hw(x-rx*1.3,z-rz*1.3),hc=hw(x,z);
  const ud=boat.userData;const stab=gear?gear.stability():1;ud.pitch=lerp(ud.pitch||0,clamp(-Math.atan2(hb-hs,6.8)*.85,-.32,.32)*stab,Math.min(1,dt*3));ud.roll=lerp(ud.roll||0,clamp(Math.atan2(hr-hl,2.6)*.8,-.35,.35)*stab,Math.min(1,dt*2.5));
  const y=(hb+hs+hr+hl+hc*2)/6*.85;ud.y=lerp(ud.y??y,y,Math.min(1,dt*4));
  ud.kickRoll=(ud.kickRoll||0)*Math.exp(-dt*1.6);ud.kickPitch=(ud.kickPitch||0)*Math.exp(-dt*1.6);ud.roll+=ud.kickRoll*Math.sin(t*9)*dt*6;ud.pitch+=ud.kickPitch*dt*3;
  boat.rotation.order='YXZ';boat.position.set(x,ud.y+Math.sin(t*1.9)*.02,z);boat.rotation.set(ud.pitch+Math.sin(t*.9)*.008-boatState.speed*.012,h,ud.roll+Math.sin(t*1.3)*(.01+w.storm*.02));
  ud.speed=boatState.speed;ud.heave=hc;let dh=h-prevHeading;dh=Math.atan2(Math.sin(dh),Math.cos(dh));prevHeading=h;steerVis=lerp(steerVis,clamp(-dh/Math.max(dt,1e-3)*2.5,-1,1),1-Math.exp(-dt*6));helm.rotation.z=steerVis*2.2;motor.prop.rotation.z+=dt*(boatState.speed*30+(players.some(p=>p.mode==='drive')&&!engineDead?10:0));motor.group.rotation.y=steerVis*-.35;boat.updateMatrixWorld(true);
  // Lanterna: balança e tremula
  const lu=lantern.userData;lu.hang.rotation.z=-ud.roll*1.6+Math.sin(t*2.1)*.05*(1+w.storm*3);lu.hang.rotation.x=-ud.pitch*1.6;lu.light.intensity=(1.4+w.storm*2.6+w.red*1.2)*(0.92+Math.sin(t*23)*.04+Math.sin(t*37)*.04);const lamp=world.eq?.gear?.lantern&&world.eq.lamp;if(lamp)lu.light.intensity*=3.2;lu.light.distance=lamp?24:11;
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
    const floorH=src.land?island.ground(src.x,src.z,src.height):floorAt(src.x,src.z),boost=src.baly>0?1.6:1;
    anim.update(dt*boost,{time:t+p.id*1.3,speed:p.id===localId?src.speed||0:Math.min(sp,8),strafe:sp>.1?(vx*Math.cos(bodyYaw)-vz*Math.sin(bodyYaw))/sp:0,yaw:bodyYaw,grounded:src.height<=floorH+.04,
      fishing:phase,tension:f?.tension||0,reelHeld:p.id===localId?!!lastControls.reel:(f?.vel||0)>0,slap:p.slap,drive:p.mode==='drive',steer:steerVis,pitch:p.id===localId?input.pitch:p.pitch,look,roll:src.land?0:boat.userData.roll||0,rifle:hasRifle,aim:p.id===localId?!!lastControls.aim:false,rig,hideGun:p.id===localId&&!window.__peixesThirdPerson,carry:world.bucketAt===p.id||!!src.hold||(src.cartH??-1)>=0,rope:world.rope.h===p.id&&world.rope.s!=='tied'?((p.id===localId?!!ropeGame:p.swing)?'swing':'hold'):null,guitar:p.mode==='guitar'?(model.userData.guitarProp||null):null,strum:p.id===localId?strumT:(anim.strumT=(anim.strumT??9)+dt)});}
}
const RANK={lixo:0,comum:0,incomum:1,raro:2,epico:3,lendario:4,especial:3};
function showCard(species,weight){const sp=CATCHES[species]||CATCHES[0],tier=TIERS[sp.tier],value=catchValue(species,weight),record=sp.kind==='fish'&&(!best[species]||weight>best[species]);if(record)best[species]=weight;const first=!seen.has(species);seen.add(species);
  const card=$('catch-card');card.style.setProperty('--tier',tier.color);card.style.setProperty('--glow',tier.glow);card.dataset.tier=sp.tier;
  $('catch-tier').textContent=tier.label;$('catch-name').textContent=sp.name;$('catch-weight').textContent=sp.kind==='fish'||sp.kind==='crustacean'?weight.toLocaleString('pt-BR',{minimumFractionDigits:2})+' kg':'';
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
  const target=players.some(q=>q.id!==localId&&q.mode!=='ragdoll'&&q.mode!=='gone'&&near(worldOf(q),CONFIG.slapRange))||!!villagers?.list.some(n=>n.rag==null&&n.near&&near(V(n.x,groundY(n.x,n.z),n.z),CONFIG.slapRange+.3)),bakerNear=baker.mode!=='ragdoll'&&!island.exploded&&near(V(baker.x,baker.y,baker.z),CONFIG.slapRange+.55);$('crosshair').classList.toggle('target',target||bakerNear);
  const lfx=Math.sin(p.yaw),lfz=Math.cos(p.yaw),nearHelm=!p.land&&Math.hypot(p.x,p.z+2.8)<1.8,nearRack=!p.land&&Math.hypot(p.x-RACK.x,p.z-RACK.z)<1.15;
  const castW=p.land?V(p.x+lfx*7,0,p.z+lfz*7):boat.localToWorld(V(p.x+lfx*7,0,p.z+lfz*7)),outward=(p.land||!insideBoat(p.x+lfx*7,p.z+lfz*7))&&(island.exploded||island.ground(castW.x,castW.z)<-.8);
  const sell=island.shop.points.sell,nearSell=p.land&&Math.hypot(p.x-(ISLAND.x+sell.u),p.z-(ISLAND.z+sell.v))<2.4,nearLane=p.land&&island.shop.points.lanes.some(l=>Math.hypot(p.x-(ISLAND.x+l.u),p.z-(ISLAND.z+l.v))<1.9);
  const bucketValue=world.bucket.reduce((s,e)=>s+entryValue(e),0),pw2=worldOf(p),bw=bucketWorld(),free=handsFree(p);
  const nearBucket=free&&world.bucketAt<0&&Math.hypot(pw2.x-bw.x,pw2.z-bw.z)<1.3&&Math.abs(pw2.y-bw.y)<1.4,nearCoil=!p.land&&free&&world.rope.s==='boat'&&Math.hypot(p.x-ROPE_HOME.x,p.z-ROPE_HOME.z)<1.2,nearGuitar=!p.land&&free&&world.guitar<0&&Math.hypot(p.x-GUITAR_SPOT.x,p.z-GUITAR_SPOT.z)<1.2;
  const cleatW=boat.localToWorld(V(BOW_CLEAT.x,BOW_CLEAT.y,BOW_CLEAT.z)),nearTie=free&&world.rope.s==='tied'&&(Math.hypot(pw2.x-cleatW.x,pw2.z-cleatW.z)<1.5||Math.hypot(pw2.x-bollardPos(world.rope.tgt).x,pw2.z-bollardPos(world.rope.tgt).z)<1.5);
  const nearBaker=p.land&&baker.mode==='work'&&!world.talk&&Math.hypot(pw2.x-baker.x,pw2.z-baker.z)<2.6,holdBucket=world.bucketAt===localId,holdRope=world.rope.h===localId&&world.rope.s==='held';
  $('context').textContent=p.fly?`VOANDO · ${flySpeed.toFixed(0)} m/s · rodinha muda a velocidade · ESPAÇO sobe · C desce · SHIFT turbo`:p.mode==='ride'?'DE CARONA NO CARRINHO · ESPAÇO desce':(p.cartH??-1)>=0?'CARRINHO · ande para empurrar · E nas prateleiras joga o item dentro · no caixa segure E no leitor · E solta':p.hold?`${ITEMS[p.hold.id].name.toUpperCase()} NA MÃO · ${p.hold.s===2?'PAGO':'NÃO PAGO: a porta não deixa sair'} · E num carrinho guarda · no caixa segure E no leitor`:p.mode==='guitar'?(gh.state==='play'?'VIOLÃO · D F J K no tempo das notas · Q volta à lista · E larga':'VIOLÃO · W/S escolhe a música · ENTER toca · E larga'):holdBucket?'BALDE NA MÃO · olhe para a peixaria do mercado e aperte E · E larga':holdRope?'CORDA · mire num cabeço do cais ou num pescador na água e clique · E devolve':holding?'RIFLE · botão direito mira (luneta) · botão esquerdo atira · SHIFT segura a respiração · E devolve':p.mode==='drive'?`NO LEME · W/S acelerar · A/D virar · E soltar · ${Math.abs(boatState.speed*1.94).toFixed(1)} nós`:p.mode==='ragdoll'?'RETORNO AÉREO EM ANDAMENTO…':p.mode==='fish'?'F pescar · WASD cancelar':
    target?'BOTÃO DIREITO · dar um tapa':world.temple?.relic===localId?'CORAÇÃO DO VULCÃO · leve até o Beiral no topo do vulcão e pule na lava (ou peça um tapa)':volcano?.contains(pw.x,pw.z)&&p.land?templeHint(pw):bakerNear?'BOTÃO DIREITO · dar um tapa no padeiro (por quê?)':outward?'F · lançar a linha na direção da mira':p.land?'Laguna · o mercado Althoff fica no fim da rua':'Olhe para o mar para lançar · ESPAÇO pula bancos';
  $('tab-hint').hidden=!(host&&!ended);
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
// ---------- itens: minigames locais (laço, violão, gaivota no balde) e o visual de balde, corda e violão ----------
let ropeWas='',coilHand=null,swingSound=0,strumT=9;
function ropeTargets(){const out=[];if(!island.exploded)BOLLARDS.forEach((b,i)=>out.push({code:i,pos:bollardPos(i).add(V(0,.1,0)),kind:'b'}));
  for(const q of players){if(q.id===localId||!q.water||q.mode!=='ragdoll')continue;const rg=ragdolls.active.get(q.id);if(!rg)continue;const t=rg.bodies.torso.position;out.push({code:100+q.id,pos:V(t.x,t.y,t.z),kind:'p',id:q.id});}return out;}
function pickRopeTarget(){const dir=camera.getWorldDirection(V()),o=camera.position;let best=null,bs=-1;for(const t of ropeTargets()){const d=t.pos.clone().sub(o),dist=d.length();if(dist>ROPE.max)continue;const c=d.normalize().dot(dir);if(c>.94&&c>bs){bs=c;best={...t};}}return best;}
function localItems(controls,dt){const p=me();if(!p||!running||cinematic)return;
  const holding=world.rope.h===localId&&world.rope.s==='held'&&p.mode==='walk';if(!holding)ropeGame=null;
  if(holding&&controls.fire){if(!ropeGame){const t=pickRopeTarget();if(t){ropeGame={...t,t0:elapsed};sound.effect('swing');}else toast('Mire num cabeço do cais ou num pescador na água (até '+ROPE.max+' m).');}
    else{const k=elapsed-ropeGame.t0,dist=ropeGame.pos.distanceTo(camera.position);controls.throwAt=ropeGame.code;controls.throwOk=ropeHit(k,dist);ropeGame=null;}controls.fire=false;}
  if(ropeGame){const t=ropeTargets().find(q=>q.code===ropeGame.code);if(!t||t.pos.distanceTo(camera.position)>ROPE.max+1){ropeGame=null;toast('O alvo saiu do alcance da corda.');}else ropeGame.pos=t.pos;if(controls.interact||controls.aim){ropeGame=null;controls.interact=false;}}
  controls.swing=!!ropeGame;
  if(p.mode==='guitar'&&gh.active){const out=gh.update(dt,controls.lanes||[],controls.nav||{}),at=worldOf(p,1.1);if(out.click)sound.effect('tick');if(out.milestone)sound.effect('combo',{level:Math.min(6,Math.round(out.milestone/10))});if(out.play.length){sound.guitar(out.play,at);controls.strum=out.play;strumT=0;}if(out.ghost||out.miss)sound.deadNote(at);
    if(out.finished){controls.song={name:out.finished.name,acc:out.finished.acc};sound.effect('song');toast(`“${out.finished.name}” · ${Math.round(out.finished.acc*100)}% de acerto · maior combo ${out.finished.best}`);confetti('#ffd23c',30+Math.round(out.finished.acc*50));}
    controls.cast=false;}
  if(world.shoo&&world.shoo.pid===localId){controls.cast=false;if(!shooGame.active&&!shooGame.sent)shooGame.start();const r=shooGame.step(dt,!!controls.reel);if(r){controls.shoo=r==='win'?1:2;shooGame.sent=true;}}else{shooGame.sent=false;if(shooGame.active)shooGame.reset();}
}
function ropeFloor(x,z){const l=boat.worldToLocal(V(x,0,z));if(insideBoat(l.x,l.z))return boat.localToWorld(V(l.x,CONFIG.deckY+floorAt(l.x,l.z),l.z)).y+.02;const g=island.exploded?-99:island.ground(x,z);if(g>-.3)return g+.02;return waveHeight(x,z,elapsed,weatherAt(story).storm)-.05;}
function renderItems(t,dt){
  const fp=!window.__peixesThirdPerson&&!cinematic,mine=me();
  // balde: no convés, no chão, na mão (primeira pessoa: vai para a cena do viewmodel com os peixes dentro)
  const b=world.bucketAt;let prop=null;
  if(b===-1){if(bucketObj.parent!==boat)boat.add(bucketObj);bucketObj.position.copy(boat.userData.bucketLocal);bucketObj.rotation.set(0,0,0);}
  else if(b===-2&&world.bucketPos){if(bucketObj.parent!==scene)scene.add(bucketObj);bucketObj.position.set(...world.bucketPos);bucketObj.rotation.set(0,0,0);}
  else if(b>=0){const m=models[b];if(b===localId&&fp&&mine?.mode!=='ragdoll'){if(bucketObj.parent!==viewmodel.propRoot)viewmodel.propRoot.add(bucketObj);prop='bucket';}
    else if(m){if(bucketObj.parent!==scene)scene.add(bucketObj);const hand=m.userData.joints.foreL.localToWorld(V(-.08,-.31,.04));bucketObj.position.copy(hand).add(V(0,-.4,0));bucketObj.rotation.set(Math.sin(t*3.1)*.06,m.rotation.y+(m.parent===boat?boatState.heading:0),Math.sin(t*2.3)*.05);}}
  bucketObj.visible=true;bucketObj.userData.handle.rotation.x=b>=0?0:-1.2;
  // violão no banco da proa (ou nas mãos de quem toca)
  guitarStand.visible=world.guitar<0;
  models.forEach((m,i)=>{const on=world.guitar===i&&players[i]?.mode==='guitar';if(on&&!m.userData.guitarProp){const g=makeGuitar();g.position.set(-.02,.2,.19);g.rotation.set(-.12,.1,-Math.PI/2+.42);m.userData.joints.torso.add(g);m.userData.guitarProp=g;}if(m.userData.guitarProp)m.userData.guitarProp.visible=on&&!(i===localId&&fp);});
  if(mine?.mode==='guitar'&&fp)prop='guitar';
  // corda
  const r=world.rope;hull.userData.coil.visible=r.s==='boat';if(r.s!==ropeWas){rope.ready=false;ropeWas=r.s;}
  const holdCoil=r.h>=0&&(r.s==='held'||r.s==='pull'||r.s==='fly');if(holdCoil&&r.h===localId&&fp&&mine?.mode==='walk')prop=prop||'coil';
  coilHand.visible=holdCoil&&!(r.h===localId&&fp)&&!!models[r.h];if(coilHand.visible){coilHand.position.copy(models[r.h].userData.joints.foreL.localToWorld(V(-.06,-.3,.12)));coilHand.rotation.set(1.2,0,.3);}
  const hand=r.h>=0?handPos(r.h):null;
  if(r.s==='tied'){const a=boat.localToWorld(V(BOW_CLEAT.x,BOW_CLEAT.y,BOW_CLEAT.z)),e=bollardPos(r.tgt).add(V(0,.12,0)),d=a.distanceTo(e);rope.visible=true;rope.step(dt,a,e,Math.max(d*1.04,Math.min(ROPE.length,d+2.2)),ropeFloor,{loopDir:V(0,1,0),loopR:.15});}
  else if(r.s==='fly'&&r.from){const k=clamp((elapsed-r.t)/ROPE.flight),from=V(...r.from),to=V(...r.to),end=from.clone().lerp(to,k);end.y+=Math.sin(k*Math.PI)*(1.8+from.distanceTo(to)*.13);rope.visible=true;rope.step(dt,hand||from,end,from.distanceTo(to)*1.1+.6,ropeFloor,{loopR:.36});}
  else if(r.s==='pull'&&hand){const q=players[r.pid],rg=q&&ragdolls.active.get(q.id);if(rg){const tp=rg.bodies.torso.position,e=V(tp.x,tp.y+.1,tp.z);rope.visible=true;rope.step(dt,hand,e,hand.distanceTo(e)*1.03,ropeFloor,{loopR:.3});}else rope.visible=false;}
  else if(r.s==='held'&&hand&&(r.h===localId?!!ropeGame:!!players[r.h]?.swing)){const m=models[r.h],yaw=r.h===localId?worldYaw(me())+(me().land?0:0):m?m.getWorldQuaternion(new THREE.Quaternion()):0;
    const fwd=r.h===localId?camera.getWorldDirection(V()).setY(0).normalize():V(0,0,1).applyQuaternion(yaw),right=V().crossVectors(fwd,V(0,1,0)).normalize(),th=r.h===localId?ropeAngle(elapsed-ropeGame.t0):elapsed*ROPE.omega;
    const center=hand.clone().add(V(0,.7,0)).addScaledVector(fwd,.15),end=center.clone().addScaledVector(fwd,Math.cos(th)*.85).addScaledVector(right,Math.sin(th)*.85);rope.visible=true;rope.step(dt,hand,end,1.35,ropeFloor,{loopR:.42,loopDir:V(0,1,0)});
    swingSound-=dt;if(swingSound<=0){swingSound=Math.PI*2/ROPE.omega;sound.effect('swing',{pos:hand,k:r.h===localId?1:0});}}
  else rope.visible=false;
  // loja: carrinho (duas mãos no puxador), item na mão ou ferramenta selecionada na barra
  const pm=me(),selId=pm?.inv?.[gear.sel??-1]?.[0];let showId='';if(!prop&&pm&&pm.mode!=='ragdoll'&&pm.mode!=='drive'){if((pm.cartH??-1)>=0)prop='push';else if(pm.hold){prop='item';showId=pm.hold.id;}else if(selId&&(pm.rifle??-1)<0&&world.bucketAt!==localId){prop='item';showId=selId;}}
  if(showId!==vmItem){vmItem=showId;const holder=viewmodel.props.item;holder.clear();if(showId)holder.add(market.mini(showId,ITEMS[showId].kind==='boat'?.42:.3));}
  models.forEach((m,i)=>{const q=players[i];const id=q?.hold?.id||'';if(m.userData.heldKey!==id){m.userData.heldKey=id;if(m.userData.heldProp){m.userData.heldProp.removeFromParent();m.userData.heldProp=null;}if(id){const g=market.mini(id,.32);g.position.set(-.08,-.38,.12);m.userData.joints.foreL.add(g);m.userData.heldProp=g;}}if(m.userData.heldProp)m.userData.heldProp.visible=!(i===localId&&fp);});
  strumT+=dt;const cur=gh.active?gh.notes?.find(n=>!n.hit&&!n.missed):null;
  viewmodel.updateProp(dt,prop,{swipe:market.scanning,strum:Math.exp(-strumT*12)*(Math.floor(strumT*0)+1)*(strumT<.25?Math.sin(strumT*25):0),chord:cur?cur.lane/3:0,bob:bobPhase,swing:ropeGame?Math.sin((elapsed-ropeGame.t0)*ROPE.omega):0});
}
// HUD quadro a quadro: laço, gaivota no balde, contagem à deriva, violão e o diálogo do padeiro
let lastTyped=0;
function hudItems(){const p=me();if(!p||!running)return;
  show('rope-ui',!!ropeGame);if(ropeGame){const c=$('rope-dial').getContext('2d'),W=200,k=elapsed-ropeGame.t0,dist=ropeGame.pos.distanceTo(camera.position),win=ropeWindow(dist),a=ropeAngle(k),hit=Math.abs(a)<win/2;
    c.clearRect(0,0,W,W);c.lineWidth=14;c.strokeStyle='#ffffff22';c.beginPath();c.arc(W/2,W/2,72,0,Math.PI*2);c.stroke();
    c.strokeStyle='#7dff6a';c.shadowColor='#7dff6a';c.shadowBlur=14;c.beginPath();c.arc(W/2,W/2,72,-Math.PI/2-win/2,-Math.PI/2+win/2);c.stroke();c.shadowBlur=0;
    const x=W/2+Math.sin(a)*72,y=W/2-Math.cos(a)*72;c.fillStyle=hit?'#7dff6a':'#fff';c.beginPath();c.arc(x,y,11,0,Math.PI*2);c.fill();c.strokeStyle='#1b2b30';c.lineWidth=3;c.stroke();
    c.fillStyle='#f6ead6';c.font='700 26px Georgia';c.textAlign='center';c.textBaseline='middle';c.fillText(ropeGame.kind==='p'?'🛟':'⚓',W/2,W/2);
    $('rope-label').textContent=hit?'AGORA!':'CLIQUE COM O LAÇO NA FRENTE';$('rope-dist').textContent=`${dist.toFixed(1)} m · ${dist>16?'DIFÍCIL':dist>9?'MÉDIO':'FÁCIL'} · E cancela`;}
  const shooing=!!(world.shoo&&world.shoo.pid===localId&&shooGame.active);show('shoo-ui',shooing);if(shooing){const z=shooGame.zone;$('shoo-zone').style.left=(shooGame.target-z)*100+'%';$('shoo-zone').style.width=z*200+'%';$('shoo-needle').style.left=shooGame.needle*100+'%';$('shoo-prog').style.width=shooGame.progress*100+'%';$('shoo-grip').style.width=shooGame.grip*100+'%';}
  const drowning=p.mode==='ragdoll'&&p.water&&!(world.rope.s==='pull'&&world.rope.pid===localId);show('drown-ui',drowning);if(drowning){const D=gear.drownTime(p),d=p.drown??D;$('drown-bar').style.width=(d/D*100)+'%';$('drown-text').textContent=Math.ceil(d)+' s · WASD nada · SHIFT mergulha · ESPAÇO sobe no barco ou no cais';}
  const playing=p.mode==='guitar'&&gh.active;show('gh',playing);if(playing)gh.draw(ghCanvas,560,420);
  // diálogo: só para quem está perto do padeiro
  const tk=world.talk,near=tk&&worldOf(p).distanceTo(V(baker.x,baker.y,baker.z))<14;show('talk',!!near);
  if(near){const txt=talkText(elapsed-tk.at);if(txt.length!==lastTyped){if(txt.length>lastTyped)sound.effect('blip');lastTyped=txt.length;}$('talk-text').textContent=txt;}else lastTyped=0;}
function updateTag(){const el=$('itag');if(!running||!hover||cinematic){el.hidden=true;return;}const v=hover.point.clone().add(V(0,.25,0)).project(camera);if(v.z>1){el.hidden=true;return;}el.hidden=false;
  el.style.transform=`translate(${(v.x*.5+.5)*innerWidth}px,${(-v.y*.5+.5)*innerHeight}px)`;el.classList.toggle('off',!hover.ok);el.querySelector('span').textContent=hover.label;}
// marcadores das gaivotas ladras (com seta na borda da tela quando estão fora de vista)
const markerEls=[];function updateMarkers(){const box=$('markers');const list=running&&!cinematic?gulls.thieves(v=>boat.localToWorld(v)):[];if(running&&!cinematic&&world.bucketAt===-2&&world.bucketPos)list.push({bucket:true,pos:bucketWorld().add(V(0,.7,0))});
  while(markerEls.length<list.length){const m=document.createElement('div');m.className='marker';m.innerHTML='<b>!</b><span></span>';box.appendChild(m);markerEls.push(m);}
  markerEls.forEach((m,i)=>{const g=list[i];m.hidden=!g;if(!g)return;const v=g.pos.clone().project(camera),behind=v.z>1;let x=v.x,y=v.y;if(behind){x=-x;y=-y;}const off=behind||Math.abs(x)>.92||Math.abs(y)>.88;if(off){const k=1/Math.max(Math.abs(x)/.9,Math.abs(y)/.85,1e-3);x*=k;y*=k;}
    const sx=(x*.5+.5)*innerWidth,sy=(-y*.5+.5)*innerHeight;m.style.transform=`translate(${sx}px,${sy}px)`;m.classList.toggle('edge',off);m.classList.toggle('near',!off&&Math.hypot(sx-innerWidth/2,sy-innerHeight/2)<Math.min(140,innerHeight*.14));m.classList.toggle('fish',!!g.fish);m.classList.toggle('bucket',!!g.bucket);m.querySelector('b').textContent=g.bucket?'◆':'!';m.querySelector('span').textContent=g.bucket?`BALDE LARGADO · ${Math.round(g.pos.distanceTo(camera.position))} m`:g.fish?'LADRA COM PEIXE':'LADRA';if(g.bucket&&!off)m.classList.remove('near');m.style.setProperty('--a',Math.atan2(-y,x)+'rad');});}
function animate(){
  requestAnimationFrame(animate);const rawDt=clock.getDelta();diagnostics?.frame(rawDt);const rdt=Math.min(rawDt,.05);hitStop=Math.max(0,hitStop-rdt);slowMo=Math.max(0,slowMo-rdt);const dt=rdt,vdt=rdt*(hitStop>0?.05:slowMo>0?.3:1);menuTime+=dt;displayTick++;
  const controls=input.enabled&&input.locked?input.read():input.enabled?{...input.read(),x:0,z:0,slap:false,cast:false,interact:false,jump:false,reel:false,fire:false,aim:false}:{};lastControls=controls;
  hitMarkT=Math.max(0,hitMarkT-rdt);
  // mira local: raio da câmera (com dispersão se não estiver mirando) e a gaivota na linha de tiro
  if(controls.fire&&running&&(me()?.rifle??-1)>=0){const spread=(1-viewmodel.aim)*.018+.002,dir=camera.getWorldDirection(V()).add(V((Math.random()-.5)*spread,(Math.random()-.5)*spread,(Math.random()-.5)*spread)).normalize();const ray=new THREE.Ray(camera.position.clone(),dir);controls.ray=[...ray.origin.toArray(),...dir.toArray()];controls.gull=gulls.pick(ray,v=>boat.localToWorld(v));controls.boss=-1;if(fight?.alive){const bh=fight.raycast(ray);if(bh){controls.boss=ZONE_LIST.indexOf(bh.zone);controls.bossPt=bh.point.toArray().map(v=>+v.toFixed(2));controls.gull=-1;}}}
  const live=running&&!paused&&!ended;
  if(live&&!cinematic&&me()?.fly&&controls.wheel){flySpeed=clamp(flySpeed*(controls.wheel<0?1.25:.8),2,250);controls.wheel=0;}
  if(live&&!cinematic){market.localControls(controls,dt,hover,input.keys);gear.localControls(controls,dt,input);localItems(controls,dt);if(controls.interact)controls.target=hover?hover.code:-1;}
  if(live&&!cinematic){if(host)hostTick(dt,controls);else guestTick(dt,controls);}
  else if(live&&cinematic){elapsed+=dt;story=storyTime(elapsed,world.trig,world.storm);if(host&&!solo){netTick+=dt;if(netTick>.1){netTick=0;net.send(snapshot());}}}
  if(hold!==null&&solo)elapsed=hold;
  if(!running)story=45;else if(ended)story=storyTime(elapsed,world.trig,world.storm);
  const t=running?elapsed:menuTime*.5;
  updateBoat(t,dt);
  if(!running){menuCharacters.forEach((m,i)=>{const sp=SPAWNS[i];m.position.set(sp[0]*1.4,CONFIG.deckY,sp[1]);m.rotation.y=i<2?.55:2.6;const o=(menuCharacters[i^1]||menuCharacters[0]).position;m.userData.anim.update(dt,{time:menuTime+i*2,fishing:'waiting',grounded:true,yaw:.55,look:lookAngles(m.position.clone().setY(1.6),.55,o.clone().setY(1.6))});});const yaw=Math.PI+.62+Math.sin(menuTime*.045)*.05;camera.position.set(Math.sin(yaw)*13.8+boat.position.x,3.6,Math.cos(yaw)*13.8+boat.position.z);camera.lookAt(boat.position.x-3.2,2.1,boat.position.z+1);camera.fov=48;camera.updateProjectionMatrix();}
  else{
    phaseEffects(story);if(story>=CONFIG.impactAt+.6&&!island.exploded){island.shop.group.visible=true;island.explode();ragdolls.removeIsland();if(shopProxy)shopProxy.visible=false;environment.rain.material.uniforms.uRoofY.value=-1e5;}
    if(cinematic)cinematicUpdate(story,vdt);else{renderPlayers(t,vdt);fpCamera(t,vdt);renderItems(t,vdt);market.render(t,vdt);gear.render(t,vdt);}
    if(showroom){const cd=camera.position.distanceTo(V(ISLAND.x,SHOP.floor,ISLAND.z+16));showroom.group.visible=cd<55&&!island.exploded;for(const o of shopDetail)o.visible=cd<55;if(showroom.group.visible)showroom.update(t,dt,{hoverSlot:hover&&hover.code>=100?hover.code-100:-1});}
    renderBaker(t,vdt);cameraDrama(story,dt);
    ragdolls.moveDeck(boat);if(!paused)ragdolls.update(dt,(x,z)=>{const l=boat.worldToLocal(V(x,0,z));if(insideBoat(l.x,l.z))return -100;if(!island.exploded&&island.ground(x,z)>-.3)return -100;return waveHeight(x,z,t,weatherAt(story).storm)+tsuAt(x,z,t);},(id,pos,velocity)=>{if(!host)return;if(typeof id==='number'&&players[id]){const q=players[id];q.water=1;q.drown=gear.drownTime(q);q.breath=1;if(!(q.inv||[]).some(e=>e[0]==='pack'))for(const e of [...(q.inv||[])])if(ITEMS[e[0]]?.kind==='bait'){e[1]--;if(e[1]<=0){q.inv.splice(q.inv.indexOf(e),1);if(q.bait===e[0])q.bait=null;}}}if(id==='baker')baker.water=1;stateEvent('splash',{id,position:pos.toArray(),velocity});});
    if(displayTick%4===0)updateHUD(t);fx.update(t,vdt,{players:players.map(p=>p.id===localId?{...p,land:me().land,x:me().x,z:me().z}:p),fishing,models,boat,camera,localId,cinematic,story});fx.syncBucket(world.bucket,bucketObj);
    world.rifles.forEach((h,i)=>{if(rackRifles[i])rackRifles[i].visible=h<0;});
    // tique do molinete enquanto recolhe
    const f=fishing[localId];if(f?.phase==='reeling'&&controls.reel){reelTick+=dt;if(reelTick>.07){reelTick=0;sound.effect('tick');}}
  }
  if(running&&!cinematic&&!paused)pickTarget();else hover=null;updateTag();
  if(running)gulls.render(vdt,t,host);shotFX.update(vdt);updateMarkers();if(running&&!cinematic)hudItems();shotLight.intensity*=Math.exp(-dt*30);
  // morador derrubado levanta depois de uns segundos e volta ao caminho dele
  villagers.list.forEach((n,k)=>{if(n.rag!=null&&(elapsed-n.rag>4.5||!running)){n.rag=null;ragdolls.remove('npc'+k);}});
  villagers.update(running?elapsed:menuTime,dt,camera,island.exploded,displayTick);
  // moradores longe não projetam sombra (o passe de sombra desenhava todos, sempre)
  if(displayTick%30===0)for(const n of villagers.list){const far=n.model.getWorldPosition(V()).distanceTo(camera.position)>35;if(n.model.userData.farSh!==far){n.model.userData.farSh=far;n.model.traverse(o=>{if(o.isMesh)o.castShadow=!far;});}}
  if(volcano){volcano.gateOpen=world.temple?.gates||volcano.gateOpen;volcano.puzzle=world.temple;volcano.update(t,dt,camera);if(running&&temple)temple.render(t,dt);environment.ocean.visible=!volcano.inside(camera.position);}
  // não desenhar o que está longe: Laguna fica visível até da Ilha do Vulcão (a névoa suaviza), mas as peças pequenas somem antes das grandes e os moradores só existem de perto
  if(displayTick%10===0&&!island.exploded){const cp=camera.position,dI=Math.hypot(cp.x-ISLAND.x,cp.z-ISLAND.z),far=dI>1900;island.group.visible=!far;villagers.group&&(villagers.group.visible=dI<420);
    if(!partCull.length)for(const part of island.parts){if(part===island.shop.group)continue;const b=new THREE.Box3().setFromObject(part);if(b.isEmpty())continue;const sp=b.getBoundingSphere(new THREE.Sphere());partCull.push({o:part,c:sp.center,r:sp.radius});}
    if(!far)for(const q of partCull){const d=cp.distanceTo(q.c)-q.r;q.o.visible=d<Math.max(90,q.r*40);}
    // mercado (interior, prateleiras e produtos: ~580 chamadas de desenho) e grama: de longe viram uma caixa simples / somem.
    // Antes eles eram desenhados até do topo do vulcão e derrubavam o jogo para ~20 FPS.
    {const sg=island.shop.group;if(!shopProxy){const b=new THREE.Box3().setFromObject(sg),sz=b.getSize(V()),c=b.getCenter(V());shopProxy=new THREE.Group();
      const body=new THREE.Mesh(new THREE.BoxGeometry(sz.x*.94,sz.y*.8,sz.z*.94),new THREE.MeshStandardMaterial({color:0xe6dfd0,roughness:.9}));body.position.set(c.x,b.min.y+sz.y*.4,c.z);
      const top=new THREE.Mesh(new THREE.BoxGeometry(sz.x*.96,sz.y*.08,sz.z*.96),new THREE.MeshStandardMaterial({color:0x2c5c96,roughness:.8}));top.position.set(c.x,b.min.y+sz.y*.82,c.z);shopProxy.add(body,top);scene.add(shopProxy);}
      const ds=Math.hypot(cp.x-(ISLAND.x+(SHOP.u0+SHOP.u1)/2),cp.z-(ISLAND.z+(SHOP.v0+SHOP.v1)/2)),farShop=ds>380;sg.visible=!farShop;shopProxy.visible=farShop&&!far;if(island.grass)island.grass.visible=dI<300;}}
  island.update(t,dt,camera,running?players.filter(p=>p.mode!=='gone').map(p=>worldOf(p.id===localId?me():p)).concat(baker.mode==='walk'?[V(baker.x,baker.y,baker.z)]:[]):[]);
  for(const p of lightPins){p.a.getWorldPosition(p.l.position);let vis=!island.exploded,q=p.a;for(;q&&q!==scene;q=q.parent)if(!q.visible){vis=false;break;}if(q!==scene)vis=false;if(!vis){if(p.saved==null)p.saved=p.l.intensity;p.l.intensity=0;}else if(p.saved!=null){p.l.intensity=p.saved;p.saved=null;}}
  if(fight){fight.render(paused?0:dt,{camera,remote:!host});if(host&&!fight.alive&&fight.rings.length)fight.time+=dt;}bossHudTick(dt);if(fluidOff>0){fluidOff-=dt;if(fluidOff<=0&&!world.impact)fluid.stop();}
  if(battle){battle.stage=fight?.stage||1;battle.tick();}
  const eK=running?eclipseK():-1;const w=environment.update(t,paused?0:dt,boat,camera,{ecl:Eclipse.timeline(eK),paused,story,focus:running&&!cinematic?camera.position:boat.position,red:fight?.alive?fight.redK:undefined,storm:fight?.alive?1:undefined,clearTo:ISLAND,clearK:cloudClear=lerp(cloudClear,running&&(world.temple?.relic>=0||world.temple?.relic===-2||world.trig)?1:0,Math.min(1,dt*.8))});
  eclipse?.update(eK,dt,camera);if(eK>=0&&!cinematic){const hit=(a)=>eclPrev<a&&eK>=a;if(hit(ECLIPSE.second-.1)||hit(ECLIPSE.third)){jolt(2,0,1.5,6);aberrPulse=Math.max(aberrPulse,.8);}if(hit(ECLIPSE.lock)){jolt(3.5,0,2.5,10);aberrPulse=Math.max(aberrPulse,1.4);}}eclPrev=eK;
  if(!paused)fluid.update(dt);cataclysm.update(story,paused?0:dt,boat,camera,t);
  const age=story-CONFIG.impactAt;
  sound.listener(camera);sound.update(story,dt,{running,phase:running?w.phase:'sunset',storm:w.storm,heave:boat.userData.heave,speed:boatState.speed,driving:running&&players.some(p=>p.mode==='drive'),meteor:running&&story>=CONFIG.asteroidAt&&age<0?clamp((story-CONFIG.asteroidAt)/17):0,tsu:running&&age>0?smooth(139,164,story):0});
  sound.balyBeat(running&&!ended&&(me()?.baly||0)>0);
  if(running)updatePost(story,dt);
  if(!blackout||!running){post.render(dt);gear?.afterRender();}
  frameTimes.push(dt);if(frameTimes.length>120)frameTimes.shift();
  // contador de FPS discreto (canto superior direito)
  fpsAcc+=rdt;fpsN++;if(fpsAcc>=.5){const el=$('fps');if(el)el.textContent=Math.round(fpsN/fpsAcc)+' FPS';fpsAcc=0;fpsN=0;}
}
function resize(){if(!renderer)return;renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();post?.setSize(innerWidth,innerHeight);}
async function init(){
  renderer=new THREE.WebGLRenderer({canvas:$('world'),antialias:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,quality==='low'?1:1.5));renderer.setSize(innerWidth,innerHeight,false);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.debug.onShaderError=(gl,program,vs,fs)=>fail(new Error('Erro WebGL: '+gl.getProgramInfoLog(program)+' '+gl.getShaderInfoLog(fs)+' '+gl.getShaderInfoLog(vs)));
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.06,2600);assets=await loadAssets();
  fluid=new FluidSim(renderer,{resolution:quality==='low'?192:256,size:620});environment=new Environment(scene,renderer,fluid,quality);cataclysm=new Cataclysm(scene,fluid,quality);
  cataclysm.onShock=()=>{shockAt=elapsed;sound.effect('shock');};cataclysm.onDebrisSplash=p=>sound.effect('debris',{pos:p});environment.onThunder=d=>sound.effect('thunder',{distance:d});
  boat=new THREE.Group();hull=makeBoat();boat.add(hull);boat.userData.bucketLocal=hull.userData.bucket.clone();helm=addHelm(boat);lantern=addLantern(boat);motor=addMotor(boat);scene.add(boat);ragdolls=new Ragdolls(scene);menuCharacters=[0,1,2,3,4].map(spawn);rackRifles=addRack(boat);gulls=new GullFlock(boat,boat.userData.bucketLocal,4);viewmodel=new Viewmodel(camera);viewmodel.onSound=n=>sound.effect(n);shotFX=new ShotFX(scene);if(!camera.parent)scene.add(camera);
  shotLight=new THREE.PointLight(0xffb060,0,25,2);scene.add(shotLight);
  // Ilha central com a vila, o cais e o mercado; o fundo dela entra no shader do mar (água rasa e arrebentação)
  $('loading-text').textContent='Construindo a vila…';island=new Island(scene,quality);U.uIslandMap.value=island.heightTex;U.uIsland.value.set(ISLAND.x,ISLAND.z,ISLAND.size);
  island.onSplash=(p,size)=>{fx.splash(p,20+size*6,2.5+size*.4,4+size);if(size>2)fluid.drop(p.x,p.z,3+size,3+size,1);sound.effect('debris',{pos:p});};
  ragdolls.addIsland((x,z)=>island.ground(x,z),{x0:ISLAND.x-ISLAND.size/2,z0:ISLAND.z-ISLAND.size/2,size:ISLAND.size,n:115},island.colliders.filter(c=>!c.dock));
  // Ilha do Vulcão: longe, na direção para onde a doca aponta
  $('loading-text').textContent='Erguendo a Ilha do Vulcão…';await new Promise(r=>setTimeout(r,0));volcano=new VolcanoIsland(scene,quality);island.volcano=volcano;U.uIslandMap2.value=volcano.heightTex;U.uIsland2.value.set(VOLCANO.x,VOLCANO.z,VOLCANO.size);
  ragdolls.addExtra((x,z)=>volcano.physicsGround(x,z),volcano.physicsRect,volcano.colliders.filter(c=>(!c.r||c.r>=.3)&&c.gate==null).map(c=>({...(c.r?{...c,x:c.x+VOLCANO.x,z:c.z+VOLCANO.z}:{...c,x0:c.x0+VOLCANO.x,x1:c.x1+VOLCANO.x,z0:c.z0+VOLCANO.z,z1:c.z1+VOLCANO.z}),pg:volcano.deepCollider(c)?2:1})));
  ragdolls.addDungeon((x,z)=>volcano.dungeonFloor(x,z),volcano.dungeonRect);ragdolls.deep=(x,y,z)=>volcano.underground(x,y,z);ragdolls.deepValid=(x,y,z)=>volcano.deepValid(x,y,z);
  {const u=environment.rain.material.uniforms,tx=VOLCANO.x+TEMPLE.u,tz=VOLCANO.z+TEMPLE.v;u.uRoof2.value.set(tx-13,tz-101,tx+49,tz+9);u.uRoofY2.value=TEMPLE.y0+.3;u.uRoof3.value.set(tx-5.5,tz-5.5,tx+5.5,tz+5.5);u.uRoofY3.value=TEMPLE.y0+20.4;}
  $('loading-text').textContent='Chamando os moradores de Laguna…';villagers=new Villagers(scene,assets,{quality});
  baker.model=addBakerOutfit(spawn(0));scene.add(baker.model);{const h=bakerHome();baker.x=h.x;baker.y=h.y;baker.z=h.z;}
  {const hid=new THREE.MeshBasicMaterial({visible:false}),sp=island.shop.points.sell;/* leme: disco invisível no aro (o raio passaria entre os raios da roda) */const hp=new THREE.Mesh(new THREE.CylinderGeometry(.36,.36,.08,16).rotateX(Math.PI/2),hid);helm.add(hp);
    tieProxies=[new THREE.Mesh(new THREE.BoxGeometry(.7,.6,.7),hid),new THREE.Mesh(new THREE.CylinderGeometry(.45,.45,.9,12),hid)];tieProxies[0].position.set(BOW_CLEAT.x,BOW_CLEAT.y,BOW_CLEAT.z);boat.add(tieProxies[0]);scene.add(tieProxies[1]);sellProxy=new THREE.Mesh(new THREE.BoxGeometry(1.5,1.4,3),hid);sellProxy.position.set(ISLAND.x+sp.u-1.25,SHOP.floor+.7,ISLAND.z+sp.v);scene.add(sellProxy);
    // caixas de autoatendimento: área do leitor (segurar E) e da maquininha (E paga)
    laneProxies=island.shop.points.lanes.map(l=>{const a=new THREE.Mesh(new THREE.BoxGeometry(.9,.7,.8),hid),b=new THREE.Mesh(new THREE.BoxGeometry(.4,.4,.4),hid);a.position.set(ISLAND.x+l.scan[0],l.scan[1]+.05,ISLAND.z+l.scan[2]);b.position.set(ISLAND.x+l.pay[0],l.pay[1],ISLAND.z+l.pay[2]);scene.add(a,b);return {scan:a,pay:b};});}
  // Desempenho: junta as malhas estáticas de cada parte da ilha por material (centenas de chamadas de desenho a menos).
  // Cada parte continua separada (a explosão joga uma por uma); farol, mercado e lago da praça ficam como estão (são animados).
  {const keep=new Set([island.shop.group]);for(const o of [island.rotor,island.water,island.flare])for(let q=o;q&&q.parent;q=q.parent)if(q.parent===island.group)keep.add(q);
    for(const part of island.parts){if(keep.has(part))continue;let bad=false;part.traverse(o=>{if(o.isLight||o.isSprite||o.isPoints||o.isLine||o.isInstancedMesh||o.isSkinnedMesh)bad=true;});if(bad)continue;
      part.updateMatrixWorld(true);const inv=part.matrixWorld.clone().invert(),groups=new Map();
      part.traverse(o=>{if(!o.isMesh||Array.isArray(o.material)||!o.visible)return;const g=o.geometry,key=o.material.uuid+'|'+Object.keys(g.attributes).sort().join()+'|'+(g.index?1:0)+'|'+o.castShadow+o.receiveShadow;(groups.get(key)||groups.set(key,[]).get(key)).push(o);});
      for(const list of groups.values()){if(list.length<2)continue;const geos=list.map(o=>o.geometry.clone().applyMatrix4(inv.clone().multiply(o.matrixWorld)));const merged=mergeGeometries(geos,false);if(!merged)continue;
        const m=new THREE.Mesh(merged,list[0].material);m.castShadow=list[0].castShadow;m.receiveShadow=list[0].receiveShadow;for(const o of list)o.removeFromParent();part.add(m);}}}
  // interior do mercado (etiquetas, telas, vitrine): só é desenhado com a câmera por perto
    island.group.updateMatrixWorld(true);shopDetail=island.shop.group.children.filter(o=>{const b=new THREE.Box3().setFromObject(o);if(b.isEmpty())return false;const c=b.getCenter(V()),u=c.x-ISLAND.x,v=c.z-ISLAND.z,sz=b.getSize(V());return u>SHOP.u0+.3&&u<SHOP.u1-.3&&v>SHOP.v0+.3&&v<SHOP.v1&&Math.max(sz.x,sz.z)<SHOP.u1-SHOP.u0-2;});
  // Luzes da ilha (mercado, farol) moram direto na cena e seguem uma âncora: se ficassem dentro de um grupo que some
  // (farol no céu vermelho, ilha explodindo), a contagem de luzes mudaria e o three.js recompilaria TODOS os materiais
  island.group.traverse(o=>{if(o.isLight)lightPins.push({l:o});});for(const p of lightPins){const l=p.l,a=new THREE.Object3D();a.position.copy(l.position);a.quaternion.copy(l.quaternion);l.parent.add(a);l.parent.remove(l);scene.add(l);p.a=a;}
  // Loja do Pescador: os 50 itens nas prateleiras (uma vez só, sem sombra) e os ícones do HUD
  $('loading-text').textContent='Abastecendo a Loja do Pescador…';await new Promise(r=>setTimeout(r,0));
  showroom=new Showroom(island.shop.group,island.shop.points.slots,makeStoreItem);showroom.buildAll();
  icons=renderIcons(ITEM_IDS,id=>showroom.models[id].clone());icons.cut=cutIcon();icons.relic=relicIcon();
  // chuva: nada de gota dentro do mercado
  {const u=environment.rain.material.uniforms;u.uRoof.value.set(ISLAND.x+SHOP.u0,ISLAND.z+SHOP.v0,ISLAND.x+SHOP.u1,ISLAND.z+SHOP.v1);u.uRoofY.value=SHOP.floor+6.4;}
  const ctx={get world(){return world;},get players(){return players;},me,get localId(){return localId;},get host(){return host;},get elapsed(){return elapsed;},get story(){return story;},get fight(){return fight;},get fishing(){return fishing;},get boat(){return boat;},get boatState(){return boatState;},get island(){return island;},get camera(){return camera;},get scene(){return scene;},get renderer(){return renderer;},get fx(){return fx;},get ragdolls(){return ragdolls;},get showroom(){return showroom;},get market(){return market;},get gear(){return gear;},get icons(){return icons;},get hover(){return hover;},get frame(){return displayTick;},get shopLanes(){return island.shop.points.lanes;},get shopLaneObjs(){return island.shop.lanes;},get laneProxies(){return laneProxies;},sound,
    ground:(x,z)=>island.exploded?-99:island.ground(x,z),waterAt:(x,z)=>waveHeight(x,z,elapsed,weatherAt(story).storm),storm:()=>weatherAt(story).storm,docked,worldOf,worldYaw,stateEvent,toastFor,toast,handsFree:p=>handsFree(p),climbOut,summonNessie,moneyPop,confetti,showCard,bossBanner,
    fade:()=>flashScreen('#000000',0),inStore:()=>{const q=me();if(!q?.land)return false;const u=q.x-ISLAND.x,v=q.z-ISLAND.z;return u>SHOP.u0&&u<SHOP.u1&&v>SHOP.v0-3&&v<SHOP.v1;},flareTex:()=>flareTexture(),itemModel:id=>showroom.models[id]||makeStoreItem(id)};
  market=new Market(ctx);gear=new Gear(ctx);gear.build();market.render(0,0);eclipse=new Eclipse(scene,volcano);
  temple=new Temple({get world(){return world;},get players(){return players;},get host(){return host;},get elapsed(){return elapsed;},get localId(){return localId;},get models(){return models;},get ragdolls(){return ragdolls;},get cinematic(){return cinematic;},get thirdPerson(){return !!window.__peixesThirdPerson;},
    me,worldOf,camera,scene,sound,stateEvent,jolt,rag:(id,reason,v)=>rag(id,reason,v),respawnHome:p=>drownRespawn(p),sacrifice:p=>sacrifice(p),name:q=>q?`PESCADOR ${(q.net??q.id)+1}`:'ALGUÉM'},volcano);
  fx=new FishingFX(scene);fx.onCard=showCard;fx.onBucket=pos=>sound.effect('bucket',{pos});
  // itens do barco: balde solto, corda (Verlet) com rolo na mão, violão no banco da proa
  bucketObj=makeBucket();bucketObj.position.copy(boat.userData.bucketLocal);boat.add(bucketObj);fx.bucketRoot=bucketObj;
  rope=new Rope(scene);coilHand=makeCoil();coilHand.scale.setScalar(.8);coilHand.visible=false;scene.add(coilHand);
  guitarStand=makeGuitar();guitarStand.position.set(GUITAR_SPOT.x,.83,GUITAR_SPOT.z);guitarStand.rotation.set(-Math.PI/2,0,Math.PI/2+.25);boat.add(guitarStand);
  viewmodel.setProps({guitar:makeGuitar(),coil:makeCoil(),bucket:bucketObj,item:new THREE.Group(),push:new THREE.Group()});boat.add(bucketObj);ghCanvas=$('gh').getContext('2d');
  post=new Post(renderer,scene,camera,quality);post.setOverlay(viewmodel.scene);post.setSize(innerWidth,innerHeight);
  lobby.join(0,selected);updateLobby();setupUI();
  // Compila também o que só aparece no final (meteoro, impacto, tsunami) para não travar no clímax
  environment.update(0,0,boat,camera);environment.updateEnvMap();
  // pré-aquecimento da Nessie e do fluido: sem isto a primeira aparição travava ~0,8 s compilando shaders
  {const bx=boatState.x,bz=boatState.z;ensureFight();fight.begin(bx+30,bz+20);fight.S.y=-2;fight.S.x=bx;fight.S.z=bz+3;for(const ev of [{k:'splash',x:bx+20,z:bz,n:60,col:12,ring:2},{k:'beam',from:[bx+20,6,bz],to:[bx+32,0,bz]},{k:'wall',x:bx+20,z:bz,dx:1,dz:0,A:3},{k:'spine',from:[bx+20,6,bz],to:[bx+26,0,bz],dur:1}])fight.fxEvent(ev);fight.render(1/60,{camera,remote:false});fluid.start(new THREE.Vector2(bx,bz),9);fluid.drop(bx+20,bz,6,.5,.3,1);fluid.update(1/60);camera.position.set(bx-25,12,bz-25);camera.lookAt(bx+20,0,bz);}
  $('loading-text').textContent='Afinando as ondas e o céu…';const hidden=[];scene.traverse(o=>{if(!o.visible){hidden.push(o);o.visible=true;}});U.uImpactAge.value=0;
  updateBoat(0,0);environment.update(0,0,boat,camera);await renderer.compileAsync(scene,camera);post.render(0);post.render(1/60);hidden.forEach(o=>o.visible=false);U.uImpactAge.value=-1;fight.end();fluid.stop();fluid.clear?.();
  environment.updateEnvMap();show('loading',false);animate();
  // ?teste: entra direto no teste solo (diagnóstico no painel do navegador, sem pausar ao perder o foco)
  if(new URLSearchParams(location.search).has('teste')){window.__peixesNoPause=true;start(true,[{id:0,character:Number(new URLSearchParams(location.search).get('teste'))||0}]);input.locked=true;show('lock-hint',false);}
  if(import.meta.env.DEV&&solo&&new URLSearchParams(location.search).has('diagnostico')){
    const pose=(x,z,yaw=0,land=1)=>{const p=players[0];market.dropAll(p);dropRifle(p);p.land=land;p.mode='walk';p.x=x;p.z=z;p.height=land?island.ground(x,z):0;p.vy=0;p.tp++;p.yaw=yaw;input.yaw=yaw;input.pitch=-.15;input.locked=true;};
    const marketView=()=>{if(fight?.alive)endFightLocal();pose(ISLAND.x-3.1,ISLAND.z+12.1,-Math.PI/2);};
    diagnostics=(await import('../tests/game-diagnostics.js')).diagnostics({renderer,actions:{
      'Mercado':marketView,
      'Carrinhos':()=>{pose(ISLAND.x+11.5,ISLAND.z+SHOP.v0-4,0);},
      'Carrinho com itens':()=>{marketView();const p=players[0],c=world.mk.carts[0];Object.assign(c,{h:0,x:p.x-1,z:p.z,yaw:-Math.PI/2,it:['rod','reel','motor'].map(id=>({u:world.mk.uid++,id,s:0}))});p.cartH=0;world.money=1500;},
      'Caixa':()=>{const l=island.shop.points.lanes[0];pose(ISLAND.x+l.u-1.4,ISLAND.z+l.v,Math.PI/2);const p=players[0],c=world.mk.carts[0];Object.assign(c,{h:-1,x:p.x,z:p.z+1.4,yaw:0,it:['rod','reel'].map(id=>({u:world.mk.uid++,id,s:0}))});world.money=1500;input.pitch=-.55;},
      'Ler item':()=>market.scan(players[0]),'Pagar compra':()=>market.pay(players[0]),
      'Chuva':()=>{world.storm={at:elapsed-25,dur:9999};},
      'Nessie':()=>{if(fight?.alive)endFightLocal();world.rope.s='loose';world.rope.b=-1;boatState.x=0;boatState.z=-120;boatState.heading=0;boatState.speed=0;pose(0,-2.6,0,0);startFightLocal(20,-95);fight.boat={x:0,z:-120,vx:0,vz:0,heading:0};fight.startAttack('emerge');},
      'Mordida':()=>{if(fight?.alive){fight.stage=3;fight.startAttack('bite');bossUI({k:'attack',name:'bite',stage:3});}},
      'Jato':()=>{if(fight?.alive){fight.stage=3;fight.startAttack('cannon');bossUI({k:'attack',name:'cannon',stage:3});}}
    }});
  }
  // Diagnóstico somente leitura; o salto de tempo funciona apenas no teste solo.
  window.__peixes={get temple(){return temple;},get eclipse(){return eclipse;},get volcano(){return volcano;},interactAs:(code,id=localId)=>interact(players[id],code),get state(){return {running,solo,host,localId,time:elapsed,phase:weatherAt(elapsed).phase,players:structuredClone(players),fishing:fishing.map(f=>({phase:f.phase,caught:f.caught,progress:f.progress})),lobby:lobby.snapshot(),impact:world.impact,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,meanFps:1/(frameTimes.reduce((a,b)=>a+b,0)/(frameTimes.length||1))}},get renderer(){return renderer;},get scene(){return scene;},get post(){return post;},get input(){return input;},get camera(){return camera;},get environment(){return environment;},get cataclysm(){return cataclysm;},get sound(){return sound;},get fx(){return fx;},get models(){return models;},get fishing(){return fishing;},get gulls(){return gulls;},get world(){return world;},get players(){return players;},get boat(){return boat;},get island(){return island;},get boatState(){return boatState;},get baker(){return baker;},get ragdolls(){return ragdolls;},get villagers(){return villagers;},get fight(){return fight;},get market(){return market;},get gear(){return gear;},get showroom(){return showroom;},give(id){if(solo){const w=gear.addItem(players[0],id);return w||'ok';}},cash(v){if(solo)world.money+=v;},get items(){return {bucketObj,rope,gh,ropeGame,shooGame,guitarStand,coilHand,hull};},get viewmodel(){return viewmodel;},get story(){return story;},testRag(v){if(solo)rag(0,"slap",v||[1,2,0]);},testDummy(){if(!solo||players.length>1)return;const q={...newPlayer(1,1),...newStatus(),net:1};players.push(q);fishing.push(new Fishing());models.push(spawn(1));return q;},testRagOf(id,v){if(solo)rag(id,'slap',v);},setStory(v){if(solo)world.trig={at:elapsed-(v-CONFIG.asteroidAt+CONFIG.rampTime),from:CONFIG.asteroidAt};},me,jump(t){if(solo){elapsed=t;hold=null;}},hold(t){if(solo){hold=t;elapsed=t;}},look(yaw,pitch){input.yaw=yaw;input.pitch=pitch;}};
}
let flareTex=null;function flareTexture(){if(flareTex)return flareTex;const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.25,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64);flareTex=new THREE.CanvasTexture(c);return flareTex;}
// ---------- comandos de teste do anfitrião (tela do TAB) ----------
// Valem para todos os pescadores, a não ser que "Afetar apenas o anfitrião" esteja marcado. Barco, dinheiro e clima são da tripulação.
let flySpeed=12;
const cheatTargets=()=>players.filter(p=>p.mode!=='gone'&&(!$('cheat-host').checked||p.id===localId));
function cheatPlace(p,x,z,{y=null,yaw=Math.PI,k=0}={}){dropAll(p);fishing[p.id].reset();if(p.mode==='ragdoll'){ragdolls.pull.delete(p.id);ragdolls.remove(p.id);}
  const ox=(k%3-1)*1.3,oz=Math.floor(k/3)*1.3,[cx,cz]=island.collide(x+ox,z+oz,.3,y??undefined);p.mode='walk';p.land=1;p.x=cx;p.z=cz;p.height=y??island.ground(cx,cz);p.vy=0;p.water=0;p.drown=0;p.rescued=0;p.ride=-1;p.yaw=yaw;p.tp++;
  if(p.id===localId){input.yaw=yaw;input.pitch=-.05;}stateEvent('respawn',{id:p.id,water:false});}
function cheatWarpBoat(x,z,h,tied){boatState.x=x;boatState.z=z;boatState.heading=h;boatState.speed=0;world.rope=tied?{s:'tied',h:-1,tgt:1,pid:-1,t:elapsed,ok:true,from:null,to:null}:{s:'boat',h:-1,tgt:-1,pid:-1,t:0};stateEvent('boatHome',{x,z,h});}
function startNessieNow(){if(fight?.alive||island.exploded)return;world.nessie=0;world.eq.fightId++;const a=boatState.heading+Math.PI*.6,x=boatState.x+Math.sin(a)*45,z=boatState.z+Math.cos(a)*45;world.storm={at:elapsed-20,dur:9999};startFightLocal(x,z);stateEvent('bossStart',{x,z});}
function runCheat(kind){if(!host||!running||ended||cinematic)return;const T=cheatTargets(),V2=VOLCANO;
  const tp=(x,z,o)=>T.forEach((p,k)=>cheatPlace(p,x,z,{...o,k}));
  if(kind==='tpDock')tp(ISLAND.x,ISLAND.z+DOCK.v0+10,{yaw:0});
  if(kind==='tpVolcano')tp(V2.x-34,V2.z+166,{yaw:Math.PI});
  if(kind==='tpTemple')tp(V2.x+TEMPLE.u,V2.z+TEMPLE.v+34,{yaw:Math.PI});
  const lv=[[0,-19.8],[0,-49.5],[0,-98.2],[17,-128.5]];lv.forEach(([x,z],i)=>{if(kind==='tpL'+(i+1))tp(V2.x+TEMPLE.u+x,V2.z+TEMPLE.v+z,{y:LEVELS[i],yaw:Math.PI});});
  if(kind==='tpRim')tp(V2.x+LEDGE.u,V2.z+LEDGE.v0-3,{yaw:Math.PI});
  if(kind==='tpFall')tp(V2.x+WF.u-2,V2.z+WF.v+41,{yaw:Math.PI});
  if(kind==='gates'){const open=!world.temple.gates.every(Boolean);world.temple.gates=[open?1:0,open?1:0,open?1:0];sound.effect('anchor');}
  if(/^gate[0-2]$/.test(kind)){const i=+kind[4];world.temple.gates[i]=world.temple.gates[i]?0:1;if(world.temple.gates[i])stateEvent('temple',{k:'gate',i,id:localId});else sound.effect('anchor');}
  if(kind==='eclipse'){world.eclipse={at:elapsed,meteor:0};stateEvent('eclipse',{at:elapsed,meteor:0});}
  if(kind==='relic'){const p=T[0];if(p&&world.temple.relic!==-2){world.temple.gates=[1,1,1];world.temple.relic=p.id;stateEvent('temple',{k:'relic',id:p.id});}}
  if(kind==='templeReset'){if(world.temple.relic===-2)return;world.temple=NEW_TEMPLE();sound.effect('anchor');}
  if(kind==='tpBoat')T.forEach((p,k)=>{dropAll(p);fishing[p.id].reset();if(p.mode==='ragdoll')ragdolls.remove(p.id);const sp=SPAWNS[k%SPAWNS.length];if(p.land&&p.id===localId)input.yaw-=boatState.heading;if(p.land)p.yaw-=boatState.heading;p.mode='walk';p.land=0;p.x=sp[0];p.z=sp[1];p.height=0;p.vy=0;p.water=0;p.drown=0;p.fly=0;p.tp++;stateEvent('respawn',{id:p.id,water:false});});
  if(kind==='fly'){const on=!T.some(p=>p.fly);for(const p of T){if(on&&!p.land){const w=worldOf(p);p.yaw+=boatState.heading;if(p.id===localId)input.yaw+=boatState.heading;p.land=1;p.x=w.x;p.z=w.z;p.height=w.y+.5;}if(p.mode==='ragdoll'){ragdolls.remove(p.id);p.mode='walk';}if(on)dropAll(p);p.fly=on?1:0;p.vy=0;p.tp++;}$('cheat-fly').classList.toggle('on',on);}
  if(kind==='boatDock')cheatWarpBoat(ISLAND.x+BERTH.u,ISLAND.z+BERTH.v,BERTH.heading,true);
  if(kind==='boatVolcano')cheatWarpBoat(V2.x-3,V2.z+196,Math.PI,false);
  if(kind==='upgrades'){for(const id of Object.keys(ITEMS))if(ITEMS[id].kind==='boat')gear.install(id);sound.effect('wrench');}
  if(kind==='money'){world.money=Math.round((world.money+5000)*100)/100;stateEvent('sold',{id:localId,total:5000,count:0,best:null,money:world.money});}
  if(kind==='kit')for(const p of T)for(const id of ['pack','rod','reel','line','scale','compass','chart','depth','camera','harpoon','lure','shrimp','flare','hydrophone','torch'])gear.addItem(p,id);
  if(kind==='storm'){world.storm={at:elapsed,dur:STORM_DUR};stateEvent('storm',{on:true});}
  if(kind==='calm'){if(world.storm)world.storm={at:elapsed-(STORM_DUR-20),dur:STORM_DUR};world.nessie=0;stateEvent('storm',{on:false});}
  if(kind==='nessie')startNessieNow();
  if(kind==='killNessie'&&fight?.alive&&!fight.dead){fight.stage=3;fight.stageDone.add(1);fight.stageDone.add(2);fight.hp=1;const evs=fight.damage('eye',99)||[];stateEvent('bossHit',{id:localId,zone:'eye',pos:fight.headWorld().toArray(),hp:fight.hp});for(const e of evs)bossBroadcast(e);}}
function triggerMeteor(){if(world.trig||!running)return;world.trig={at:elapsed,from:story};stateEvent('trigger',{});}
// Sacrifício: o Coração caiu na lava. O meteoro vem para Laguna e o barco espera na praia norte da Ilha do Vulcão,
// virado para a ilha principal (é de lá que a tripulação assiste ao fim). Quem se sacrificou acorda no cais de Laguna.
function sacrifice(p){if(fight?.alive){endFightLocal();stateEvent('bossEnd',{win:false});}world.nessie=0;world.storm=null;world.eclipse={at:elapsed,meteor:1};stateEvent('eclipse',{at:elapsed,meteor:1});
  const x=VOLCANO.x-3,z=VOLCANO.z+196;if(Math.hypot(boatState.x-VOLCANO.x,boatState.z-VOLCANO.z)>VOLCANO.size*.7)cheatWarpBoat(x,z,Math.atan2(ISLAND.x-x,ISLAND.z-z),false);
}
// segundos desde o começo do eclipse (-1 = nenhum)
function eclipseK(){const e=world.eclipse;if(!e)return -1;const k=elapsed-e.at;return k>=0&&k<=ECLIPSE.dur?k:-1;}
// dica do rodapé dentro do templo: o nome da sala e o que fazer
function templeHint(pw){const tx=pw.x-VOLCANO.x-TEMPLE.u,tz=pw.z-VOLCANO.z-TEMPLE.v,h=me().height??0,W=world.temple||{gates:[0,0,0]};if(h>LEVELS[0]+2||Math.abs(tx)>40||tz>4)return 'Ilha do Vulcão · siga as trilhas no mato até o templo';
  if(Math.abs(h-LEVELS[0])<1.5)return W.gates[0]?'Nível 1 · Salão dos Dardos · o portão está aberto: desça':'Nível 1 · Salão dos Dardos · leia o mural e pise só nos glifos certos até a placa do portão';
  if(Math.abs(h-LEVELS[1])<3.2)return W.gates[1]?'Nível 2 · o portão está aberto: desça':'Nível 2 · Fosso e Galeria das Lâminas · os botões no fim da galeria guardam a ordem das lâminas';
  if(Math.abs(h-LEVELS[2])<1.5)return W.gates[2]?'Nível 3 · o portão está aberto: desça':'Nível 3 · Sala dos Espelhos · E gira um espelho · leve a luz do poço até o disco solar';
  return W.relic===-1?'Nível 4 · Câmara do Coração · suba o estrado e pegue o Coração do Vulcão (E)':'Nível 4 · Câmara do Coração';}
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
  $('quality').onchange=e=>{localStorage.setItem('peixes-quality',e.target.value);toast('Qualidade aplicada ao recarregar a página.');};const sensLabel=()=>$('sensitivity-value').textContent=input.sensitivity.toFixed(2).replace('.',',')+'×',volLabel=()=>{$('volume-value').textContent=Math.round(sound.volume*100)+'%';$('music-value').textContent=Math.round(sound.musicLevel*100)+'%';};
  $('volume').value=sound.volume;$('music-volume').value=sound.musicLevel;sensLabel();volLabel();
  $('sensitivity').oninput=e=>{input.sensitivity=Number(e.target.value);localStorage.setItem('peixes-sens',e.target.value);sensLabel();};$('volume').oninput=e=>{sound.setVolume(Number(e.target.value));volLabel();};$('music-volume').oninput=e=>{sound.setMusic(Number(e.target.value));volLabel();};
  window.addEventListener('keydown',e=>{if(e.code==='Escape'&&running&&!cinematic&&!ended&&!input.locked)settings($('settings').hidden);});
  $('skip-storm').onclick=()=>{if(!solo)return;elapsed=212;toast('Teste: tempestade chegando.');settings(false);};
  $('skip-ending').onclick=()=>{if(!solo)return;settings(false);triggerMeteor();};
  $('skip-impact').onclick=()=>{if(!solo)return;world.trig={at:elapsed-(132-CONFIG.asteroidAt+CONFIG.rampTime),from:CONFIG.asteroidAt};toast('Teste: impacto.');settings(false);};
  // TAB (segurar): tela de eventos do anfitrião — tempestade, Nessie e meteoro não acontecem mais sozinhos
  window.addEventListener('keydown',e=>{if(e.code!=='Tab'||!running)return;e.preventDefault();if(e.repeat||ended||cinematic)return;if(!host){toast('Só o anfitrião abre a tela de eventos.');return;}openEvents(true);});
  window.addEventListener('keyup',e=>{if(e.code==='Tab'&&eventsOpen){e.preventDefault();openEvents(false);}});
  for(const [id,kind]of [['ev-meteor','meteor']])$(id).onclick=()=>{runEvent(kind);openEvents(false);};
  for(const b of document.querySelectorAll('[data-cheat]'))b.onclick=()=>runCheat(b.dataset.cheat);
  $('fall-test').onclick=()=>{if(!solo)return;settings(false);players[0].x=2;models[0].position.x=2;models[0].updateMatrixWorld(true);rag(0,'water',[3,1,0]);};
  $('restart').onclick=()=>location.reload();window.addEventListener('resize',resize);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&!window.__peixesNoPause){input.clear();if(running&&solo&&!cinematic&&!ended)settings(true);}});window.addEventListener('beforeunload',()=>net.send({type:'bye'}));
}
init().catch(fail);

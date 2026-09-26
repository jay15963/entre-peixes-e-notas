import './style.css';
import * as THREE from 'three';
import {CONFIG,Lobby,Fishing,newPlayer,weatherAt,waveHeight,tsunamiHeight,insideBoat,smooth,clamp,lerp,inputPacket} from './core.js';
import {loadAssets,setFirstPerson} from './models.js';
import {makeCharacter} from './characters.js';
import {makeBoat,addHelm,addLantern,addMotor} from './boat.js';
import {SPECIES} from './fish.js';
import {Animator,Spring,lookAngles} from './animation.js';
import {FishingFX} from './fishingfx.js';
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
let renderer,scene,camera,environment,cataclysm,fluid,post,assets,boat,helm,lantern,motor,fx,ragdolls,menuCharacters=[];
let running=false,solo=false,host=true,localId=0,selected=0,elapsed=0,menuTime=0,paused=false,cinematic=false,ended=false,blackout=false,titleShown=false,engineDead=false;
let players=[],models=[],fishing=[],remoteInput={},netTick=0,lastPhase='sunset',world={impact:null},pred=null,boatTarget=null;
let lobby=new Lobby(),codeAction='',expectUnlock=false;
let boatState={x:0,z:0,heading:0,speed:0},toastTimer=0,frameTimes=[],displayTick=0,cardTimer=0,best={};
let stepDist=0,bobPhase=0,shockAt=Infinity,reelTick=0,hold=null,warned=false;
// Juice: hit-stop, câmera lenta e molas de câmera (tranco, aterrissagem, soco de FOV)
let hitStop=0,slowMo=0,aberrPulse=0,runFov=0,strafeRoll=0,prevGrounded=true,prevSlap=0,prevHeading=0,steerVis=0,lastVy=0,lastControls={};
const kick={x:new Spring(260,17),y:new Spring(260,17),z:new Spring(220,13),fov:new Spring(200,14),dip:new Spring(170,12)};
function spawn(character){const m=makeCharacter(assets,character);m.userData.anim=new Animator(m);boat.add(m);return m;}
function jolt(x=0,y=0,z=0,fov=0){kick.x.kick(x);kick.y.kick(y);kick.z.kick(z);kick.fov.kick(fov);}
const sound=new Sound(),input=new Input($('world')),clock=new THREE.Clock(),net=new Transport(receive,onNetStatus);
const quality=localStorage.getItem('peixes-quality')||'high';$('quality').value=quality;$('sensitivity').value=input.sensitivity;

function toast(text){if(!text)return;$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3500);}
function status(text){$('net-status').textContent=text;}
function fail(error){console.error(error);show('loading',false);show('fatal');$('fatal-message').textContent=error instanceof Error?error.message:String(error);}
const me=()=>pred||players[localId];
const deckPos=p=>boat.localToWorld(V(p.x,1.2+(p.height||0),p.z));
function stateEvent(name,payload={}){event(name,payload);if(!solo&&host)net.send({type:'event',name,payload});}
function toastFor(id,text){if(id===localId)toast(text);else if(host&&!solo)net.send({type:'event',name:'toast',payload:{id,text}});}

// ---------- Eventos (anfitrião aplica e retransmite; convidado apenas aplica) ----------
function event(name,p){
  const pl=players[p.id],pos=pl?deckPos(pl):null;
  if(name==='toast'&&p.id===localId)toast(p.text);
  if(name==='slap'){sound.effect(p.hit?'slap':'whoosh',{pos});if(pl)pl.slap=1;if(p.hit&&p.id===localId){hitStop=.09;jolt(-.6,0,2.2,-9);aberrPulse=.6;}else if(p.id!==localId&&!p.hit)models[localId]?.userData.anim?.flinch.kick(-4);}
  if(name==='ragdoll'){const m=models[p.id];if(m){ragdolls.launch(p.id,m,p.velocity);sound.effect('launch',{pos});if(p.id===localId){aberrPulse=1.2;jolt(3,4,-6,14);}if(p.id===localId)toast(p.reason==='water'?'Você esqueceu que não é um peixe.':'A amizade veio com força.');}}
  if(name==='splash'){const at=V(...p.position);environment.burst(at);sound.effect('splash',{pos:at});if(p.id===localId)toast('A água rejeitou sua presença.');}
  if(name==='respawn'){ragdolls.remove(p.id);if(p.id===localId){toast('De volta ao barco. A dignidade fica no mar.');input.pitch=-.1;}}
  if(name==='cast')sound.effect('cast',{pos});
  if(name==='bite'){fx.event('bite',p.id);sound.effect('bite',{pos:fx.state[p.id]?.bobber.position});if(p.id===localId){toast('MORDEU! Aperte F para fisgar.');jolt(-1.5,0,.8,-3);}}
  if(name==='nibble'){fx.event('nibble',p.id);sound.effect('plop',{pos:fx.state[p.id]?.bobber.position});if(p.id===localId)jolt(-.4);}
  if(name==='jump'){fx.event('jump',p.id);sound.effect('splash',{pos:fx.state[p.id]?.fishPos});if(p.id===localId)jolt(1.2,0,1.5,-2);}
  if(name==='run'){fx.event('run',p.id);sound.effect('run',{pos:fx.state[p.id]?.fishPos});if(p.id===localId){jolt(2.4,(Math.random()-.5)*3,2,-4);aberrPulse=.35;}}
  if(name==='caught'){fx.event('caught',p.id,p);sound.effect('fish',{pos});sound.effect('splash',{pos:fx.state[p.id]?.fishPos});if(p.id===localId){slowMo=.45;jolt(3,0,-2,-8);$('toast').classList.remove('show');}}
  if(name==='escaped'){const hooked=!!fx.state[p.id]?.fish;fx.event('escaped',p.id);sound.effect(hooked?'snap':'escaped',{pos});if(p.id===localId){toast(hooked?'A linha arrebentou. Ele vai contar essa história.':'O peixe tinha outros planos.');jolt(-2.5,0,-1.5,6);models[localId]?.userData.anim?.tug.kick(8);}}
  if(name==='drive'){sound.effect('helm',{pos});if(p.id===localId){if(p.on){input.yaw=0;input.pitch=-.12;toast('Leme assumido · W/S acelera · A/D vira · E solta');}else toast('Você largou o leme.');}}
  if(name==='engine')toast('O motor apagou. Não há para onde fugir.');
}

// ---------- Lobby e rede ----------
function updateLobby(){const list=lobby.snapshot();for(let i=0;i<2;i++){const p=list.find(p=>p.character===i);$('char'+i).classList.toggle('selected',selected===i);$('ready'+i).textContent=p?(p.id===localId?'VOCÊ':'CONECTADO')+(p.ready?' · PRONTO ✓':' · AGUARDANDO'):'LUGAR DISPONÍVEL';}
  const mine=list.find(p=>p.id===localId);$('ready').disabled=!net.connected;$('ready').firstChild.textContent=mine?.ready?'CANCELAR PRONTO ':'ESTOU PRONTO ';$('ready-hint').textContent=net.connected?'A partida começa quando os dois estiverem prontos.':'Aguardando o segundo jogador.';
  if(host&&lobby.canStart&&!running){const roster=lobby.snapshot().sort((a,b)=>a.id-b.id);net.send({type:'start',players:roster});start(false,roster);}}
function broadcastLobby(){net.send({type:'lobby',players:lobby.snapshot()});updateLobby();}
function onNetStatus(s){
  if(s==='connected'){status('Conectados! Os dois marcam “Estou pronto” para zarpar.');host=net.host;localId=host?0:1;if(host){lobby=new Lobby();lobby.join(0,selected);lobby.join(1,1-selected);broadcastLobby();}else net.send({type:'hello'});$('ready').disabled=false;show('connection',false);}
  else if(s==='disconnected'){status('A conexão caiu. Crie uma nova sala para jogar de novo.');$('ready').disabled=true;if(running&&!ended){paused=true;input.enabled=false;expectUnlock=true;input.unlock();show('lobby');toast('O outro pescador desconectou. A partida foi pausada.');}if(host){lobby.leave(1);updateLobby();}}
  else if(s==='error')status('A conexão não abriu. Tente de novo ou use a conexão manual.');
}
function receive(p){
  if(p.type==='hello'&&net.host&&lobby.players.size===2)broadcastLobby();
  if(p.type==='lobby'&&!net.host){lobby=new Lobby();for(const item of p.players){lobby.join(item.id,item.character);lobby.ready(item.id,item.ready);}selected=lobby.players.get(1)?.character??1;localId=1;updateLobby();}
  if(p.type==='ready'&&net.host){lobby.ready(1,p.ready);broadcastLobby();}
  if(p.type==='start'&&!net.host)start(false,p.players);
  if(p.type==='input'&&net.host){const i=inputPacket(p);remoteInput={...i,interact:i.interact||remoteInput.interact,cast:i.cast||remoteInput.cast,slap:i.slap||remoteInput.slap,jump:i.jump||remoteInput.jump,fall:i.fall||remoteInput.fall};}
  if(p.type==='snapshot'&&!net.host&&running)applySnapshot(p);
  if(p.type==='event'&&!net.host&&running)event(p.name,p.payload);
  if(p.type==='bye'){net.close();onNetStatus('disconnected');}
}
function applySnapshot(p){
  const drift=p.time-elapsed;if(Math.abs(drift)>.6)elapsed=p.time;else elapsed+=drift*.15;
  boatTarget=p.boat;boatState.heading=p.boat.heading;boatState.speed=p.boat.speed;
  if(p.impact){if(!world.impact||world.impact.d!==p.impact.d){world.impact={...p.impact};cataclysm.setImpact(world.impact);}}
  for(const sp of p.players){const q=players[sp.id];if(!q)continue;
    if(sp.id===localId){const {x,z,height,yaw,pitch,speed,...rest}=sp;Object.assign(q,rest,{x,z,height});pred.mode=sp.mode;pred.fish=sp.fish;pred.slap=sp.slap;if(sp.mode!=='walk'||sp.tp!==pred.tp){pred.x=x;pred.z=z;pred.height=height;pred.vy=0;pred.tp=sp.tp;}}
    else Object.assign(q,sp);}
  for(let i=0;i<p.fishing.length;i++)if(fishing[i])Object.assign(fishing[i],p.fishing[i]);
  if(p.ragdolls)ragdolls.sync(p.ragdolls,models);
}
function snapshot(){return {type:'snapshot',time:elapsed,boat:boatState,impact:world.impact,players,ragdolls:ragdolls.active.size?ragdolls.snapshot():null,fishing:fishing.map(f=>({phase:f.phase,progress:f.progress,tension:f.tension,target:f.target,needle:f.needle,vel:f.vel,run:f.run,species:f.species,caught:f.caught}))};}
function changeCharacter(i){if(net.connected)return;selected=i;lobby=new Lobby();lobby.join(0,i);updateLobby();menuCharacters.forEach((m,k)=>{m.visible=k===i;});}

// ---------- Partida ----------
function start(isSolo,roster){
  if(running)return;solo=isSolo;host=isSolo||net.host;localId=isSolo?0:(host?0:1);running=true;paused=false;elapsed=0;ended=false;cinematic=false;boatState={x:0,z:0,heading:0,speed:0};
  players=roster.map((p,i)=>newPlayer(i,p.character));fishing=players.map(()=>new Fishing());models=players.map(p=>spawn(p.character));menuCharacters.forEach(m=>m.visible=false);
  pred=host?null:{...players[localId]};setFirstPerson(models[localId],true);
  input.enabled=true;input.yaw=Math.PI;input.pitch=-.06;input.lock();show('lock-hint',!input.locked);sound.start();show('home',false);show('lobby',false);show('settings',false);show('hud');show('test-tools',isSolo);document.body.classList.add('playing');
  toast(isSolo?'Teste solo · F pesca · E leme · botão direito tapa':'Os dois a bordo. Boa pescaria!');
}
function rag(id,reason,velocity){const p=players[id];if(p.mode==='ragdoll')return;p.mode='ragdoll';p.ragTime=0;fishing[id].reset();stateEvent('ragdoll',{id,reason,velocity:velocity||[(Math.random()-.5)*3,-1,(Math.random()-.5)*3]});}
function floorAt(x,z){const benches=[[-2.84,1.29],[-.258,1.48],[2.279,1.225]];for(const [bz,w]of benches)if(Math.abs(z-bz)<.32&&Math.abs(x)<w)return .79;return 0;}
// Movimento com autoridade local (anfitrião para si; convidado com predição e envio da posição).
function moveLocal(p,i,dt,t){
  p.yaw=i.yaw??p.yaw;p.pitch=i.pitch??p.pitch;if(p.mode!=='walk'){p.speed=0;return;}
  const fx=Math.sin(p.yaw),fz=Math.cos(p.yaw),rx=-Math.cos(p.yaw),rz=Math.sin(p.yaw);let mx=fx*(i.z||0)+rx*(i.x||0),mz=fz*(i.z||0)+rz*(i.x||0);const len=Math.hypot(mx,mz);
  const grounded=p.height<=floorAt(p.x,p.z)+.02;if(i.jump&&grounded){p.vy=4.6;}
  p.speed=0;
  if(len){mx/=len;mz/=len;const speed=i.run?CONFIG.runSpeed:CONFIG.walkSpeed;const tryMove=(nx,nz)=>{const floor=floorAt(nx,nz);if(p.height>=floor-.15){p.x=nx;p.z=nz;return true;}return false;};
    if(tryMove(p.x+mx*speed*dt,p.z+mz*speed*dt)||tryMove(p.x+mx*speed*dt,p.z)||tryMove(p.x,p.z+mz*speed*dt))p.speed=speed;else if(displayTick%90===0)toast('ESPAÇO para pular o banco.');}
  p.vy-=10*dt;p.height+=p.vy*dt;const floor=floorAt(p.x,p.z);if(p.height<floor){if(p.vy<-3.2)sound.effect('land');p.height=floor;p.vy=0;}
  const w=weatherAt(t);if(w.storm>.25){p.x+=Math.sin(t*2.1)*w.storm*.17*dt;p.z+=Math.cos(t*1.7)*w.storm*.13*dt;}
  if(p.speed&&grounded){stepDist+=p.speed*dt;if(stepDist>(i.run?.8:.62)){stepDist=0;sound.effect('step');}}
  if(!insideBoat(p.x,p.z))p.fall=true;
}
function doSlap(p){p.slap=1;const fx=Math.sin(p.yaw),fz=Math.cos(p.yaw);let hit=false;
  for(const q of players){if(q.id===p.id||q.mode==='ragdoll')continue;const dx=q.x-p.x,dz=q.z-p.z,d=Math.hypot(dx,dz);if(d<CONFIG.slapRange&&(dx*fx+dz*fz)/(d||1)>.3){const v=V(dx/(d||1)*7.5,3.4,dz/(d||1)*7.5).applyAxisAngle(Y,boatState.heading);rag(q.id,'slap',v.toArray());hit=true;}}
  stateEvent('slap',{id:p.id,hit});}
function interact(p){
  if(p.mode==='drive'){p.mode='walk';p.x=0;p.z=-2.65;p.tp++;stateEvent('drive',{id:p.id,on:false});return;}
  if(Math.hypot(p.x,p.z+2.8)>1.8){toastFor(p.id,'Chegue perto do leme, na popa do barco.');return;}
  if(engineDead){toastFor(p.id,'O motor morreu. Não há para onde fugir.');return;}
  if(players.some(q=>q.mode==='drive')){toastFor(p.id,'O outro pescador já está no leme.');return;}
  fishing[p.id].reset();p.mode='drive';p.x=0;p.z=-3.3;p.height=0;p.vy=0;p.tp++;stateEvent('drive',{id:p.id,on:true});
}
function castLine(p,f){const fx=Math.sin(p.yaw),fz=Math.cos(p.yaw),cx=p.x+fx*7,cz=p.z+fz*7;if(insideBoat(cx,cz)){toastFor(p.id,'Mire para fora do barco para lançar a linha.');return;}f.cast();p.mode='fish';p.cx=cx;p.cz=cz;stateEvent('cast',{id:p.id});}
function tickPlayer(p,i,dt,t,isLocal){
  const f=fishing[p.id];p.slap=Math.max(0,p.slap-dt*2.2);
  if(p.mode==='ragdoll'){p.ragTime+=dt;if(p.ragTime>CONFIG.respawnAfter){p.mode='walk';p.x=p.id===0?-.45:.45;p.z=-1.1;p.height=0;p.vy=0;p.tp++;stateEvent('respawn',{id:p.id});}return;}
  if(i.yaw!==undefined){p.yaw=i.yaw;p.pitch=i.pitch;}
  if(i.slap&&p.slap===0)doSlap(p);
  if(i.interact)interact(p);
  if(p.mode==='drive'){p.speed=0;return;}
  if(i.cast){if(f.phase==='idle')castLine(p,f);else if(f.phase==='bite')f.reel();else if(f.phase==='waiting'){f.reset();p.mode='walk';}}
  const result=f.step(dt,!!i.reel,t);if(result){stateEvent(result,{id:p.id,fish:f.caught,species:f.lastSpecies,weight:f.lastWeight});if(result==='caught'||result==='escaped'){p.mode='walk';p.fish=f.caught;}}
  if(p.mode==='fish'&&(i.x||i.z)){f.reset();p.mode='walk';}
  if(p.mode==='walk'){if(isLocal)moveLocal(p,i,dt,t);else if(i.px!==undefined&&i.tp===p.tp){p.x=i.px;p.z=i.pz;p.height=i.ph;p.speed=i.speed;}
    if(p.fall||i.fall){p.fall=false;rag(p.id,'water');}}else p.speed=0;
}
function hostTick(dt,local){
  elapsed+=dt;const t=elapsed,inputs=[];inputs[localId]=local;if(!solo)inputs[1]=remoteInput;
  for(const p of players)tickPlayer(p,inputs[p.id]||{},dt,t,p.id===localId);
  remoteInput={...remoteInput,slap:false,interact:false,cast:false,jump:false,fall:false};
  // Barco
  const driver=players.find(p=>p.mode==='drive');
  if(t>=CONFIG.impactAt&&!engineDead){engineDead=true;if(driver){driver.mode='walk';driver.z=-2.65;driver.tp++;}stateEvent('engine');}
  if(driver&&!engineDead){const i=inputs[driver.id]||{};boatState.speed=clamp(boatState.speed+((i.z||0)*2.2-boatState.speed*.24)*dt,-1.4,5);boatState.heading-=(i.x||0)*dt*(.25+Math.abs(boatState.speed)*.16);}
  else boatState.speed*=Math.exp(-dt*(engineDead?2.5:.3));
  boatState.x+=Math.sin(boatState.heading)*boatState.speed*dt;boatState.z+=Math.cos(boatState.heading)*boatState.speed*dt;
  // O meteoro cai sempre à frente do pôr do sol, a partir de onde o barco estiver
  if(t>=CONFIG.asteroidAt&&!world.impact){world.impact={x:boatState.x+20,z:boatState.z-CONFIG.impactDistance,d:0};cataclysm.setImpact(world.impact);}
  if(t>=CONFIG.impactAt&&world.impact&&!world.impact.d)world.impact.d=Math.hypot(world.impact.x-boatState.x,world.impact.z-boatState.z);
  netTick+=dt;if(!solo&&netTick>.05){netTick=0;net.send(snapshot());}
}
function guestTick(dt,local){
  elapsed+=dt;if(pred){moveLocal(pred,local,dt,elapsed);}
  net.send(inputPacket({...local,px:pred.x,pz:pred.z,ph:pred.height,speed:pred.speed,tp:pred.tp,fall:pred.fall}));pred.fall=false;
  boatState.x+=Math.sin(boatState.heading)*boatState.speed*dt;boatState.z+=Math.cos(boatState.heading)*boatState.speed*dt;
  if(boatTarget){const k=Math.min(1,dt*5);boatState.x+=(boatTarget.x-boatState.x)*k;boatState.z+=(boatTarget.z-boatState.z)*k;}
}
function phaseEffects(t){const w=weatherAt(t);if(w.phase!==lastPhase){lastPhase=w.phase;if(w.phase==='storm')toast('O vento mudou. Talvez fosse hora de voltar.');if(w.phase==='asteroid')toast('Que luz é essa atrás da gente?');if(w.phase==='wave')toast('');}
  if(t>=126&&!warned){warned=true;toast('OLHE PARA CIMA!');}
  if(t>=CONFIG.embraceAt&&!cinematic)startCinematic();
  if(t>=CONFIG.hitAt&&!blackout){blackout=true;$('blackout').style.opacity='1';$('subtitle').textContent='';sound.effect('hit');}
  if(t>=CONFIG.titleAt&&!titleShown){titleShown=true;ended=true;show('ending');requestAnimationFrame(()=>$('ending').style.opacity='1');sound.finalChord();if(host&&!solo)net.send(snapshot());}
}
function startCinematic(){
  cinematic=true;input.enabled=false;input.clear();expectUnlock=true;input.unlock();show('lock-hint',false);document.body.classList.add('cinematic');ragdolls.clear();fishing.forEach(f=>f.reset());players.forEach(p=>{if(p.mode!=='ragdoll')p.mode='walk';});
  if(solo)models.push(spawn(1-players[0].character));
  models.forEach(m=>{m.visible=true;setFirstPerson(m,false);});
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
  models.forEach((m,i)=>{const side=i===0?-1:1;m.position.set(side*lerp(.6,.155,hug),.72,-.24);m.rotation.set(0,side===-1?Math.PI/2:-Math.PI/2,0);m.userData.anim.update(dt,{time:t,embrace:hug,kiss,grounded:true,yaw:m.rotation.y,look:{yaw:0,pitch:.05*(1-hug)}});});
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
  const grounded=p.height<=floorAt(p.x,p.z)+.05,moving=p.speed>0&&grounded;
  // aterrissagem: mergulho da câmera proporcional à queda; pulo: leve subida
  if(!grounded)lastVy=Math.min(lastVy,p.vy||0);
  if(grounded&&!prevGrounded){kick.dip.kick(-(1.2+Math.min(4,-lastVy)*.7));kick.x.kick(-1.4);lastVy=0;}else if(!grounded&&prevGrounded&&(p.vy||0)>0){kick.x.kick(1);kick.dip.kick(.8);}
  prevGrounded=grounded;
  // tapa local: tranco horizontal no instante do golpe
  if(prevSlap>.66&&p.slap<=.66)jolt(-.4,3.4,2,-5);prevSlap=p.slap;
  bobPhase+=dt*(moving?p.speed*4.2:0);const amp=moving?(p.speed>2?1.35:1):0;
  const bob=Math.abs(Math.sin(bobPhase))*.045*amp,sway=Math.sin(bobPhase)*.018*amp;
  const yaw=p.mode==='drive'||p.mode==='walk'||p.mode==='fish'?input.yaw:p.yaw;
  for(const k of Object.values(kick))k.update(0,dt);
  const eye=V(p.x+Math.sin(p.yaw)*.14,CONFIG.deckY+p.height+CONFIG.eyeHeight+bob+kick.dip.x*.05,p.z+Math.cos(p.yaw)*.14);
  camera.position.copy(boat.localToWorld(eye));
  runFov=lerp(runFov,p.speed>2?1:0,1-Math.exp(-dt*5));strafeRoll=lerp(strafeRoll,-(lastControls.x||0)*.03*(p.mode==='walk'?1:0),1-Math.exp(-dt*6));
  camera.quaternion.copy(boat.quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(input.pitch+kick.x.x*.02,yaw+Math.PI+kick.y.x*.02,sway+strafeRoll+kick.z.x*.02,'YXZ')));
  // tensão da linha treme as mãos (e a câmera)
  const f=fishing[localId];if(f?.phase==='reeling'){const s=f.tension*.004+(f.run>0?.004:0);camera.rotateX(Math.sin(t*43)*s);camera.rotateY(Math.sin(t*37+1)*s);}
  camera.fov=60+runFov*7+kick.fov.x;
  // diagnóstico: câmera orbital de terceira pessoa para inspecionar as animações do próprio personagem
  const tp=window.__peixesThirdPerson;setFirstPerson(models[localId],!tp);if(tp){const a=tp.yaw??(yaw+2.4),d=tp.dist||2.6;const focus=V(p.x,CONFIG.deckY+p.height+1.1,p.z);camera.position.copy(boat.localToWorld(focus.clone().add(V(Math.sin(a)*d,tp.h??.5,Math.cos(a)*d))));camera.lookAt(boat.localToWorld(focus));camera.fov=50;}
}
// Assistência de olhar, zoom e tremores do impacto
function cameraDrama(t,dt){
  const w=weatherAt(t),I=U.uImpact.value;let shake=w.storm*.0025;
  if(world.impact&&t>=CONFIG.asteroidAt&&t<CONFIG.embraceAt){
    const a=clamp((t-CONFIG.asteroidAt)/(CONFIG.impactAt-CONFIG.asteroidAt));shake+=Math.pow(a,3)*.012;
    const assist=smooth(130.5,132,t)*(1-smooth(139.5,141.5,t))*.85;
    if(assist>0&&me()?.mode!=='ragdoll'){const target=t<CONFIG.impactAt?U.uMeteorPos.value.clone():I.clone().add(V(0,55,0));const dir=target.sub(camera.position).normalize().applyQuaternion(boat.quaternion.clone().invert());
      const dy=Math.atan2(dir.x,dir.z);let diff=dy-input.yaw;diff=Math.atan2(Math.sin(diff),Math.cos(diff));input.yaw+=diff*Math.min(1,dt*5*assist);input.pitch+=(Math.asin(clamp(dir.y,-1,1))-input.pitch)*Math.min(1,dt*5*assist);}
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
}

// ---------- Mundo ----------
function tsuAt(x,z,t){return world.impact&&world.impact.d?tsunamiHeight(x,z,t,world.impact):0;}
function updateBoat(t,dt){
  const w=weatherAt(t),h=boatState.heading,fx=Math.sin(h),fz=Math.cos(h),rx=Math.cos(h),rz=-Math.sin(h),x=boatState.x,z=boatState.z;
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
    if(p.mode==='ragdoll'){if(!ragdolls.active.has(p.id)&&!host)ragdolls.launch(p.id,model,[0,4,0]);continue;}if(ragdolls.active.has(p.id))ragdolls.remove(p.id);
    const src=p.id===localId?me():p,d=model.userData.disp||(model.userData.disp={x:src.x,z:src.z,h:src.height,yaw:src.yaw});const k=p.id===localId?1:Math.min(1,dt*14);
    const px=d.x,pz=d.z;d.x+=(src.x-d.x)*k;d.z+=(src.z-d.z)*k;d.h+=(src.height-d.h)*k;let dy=src.yaw-d.yaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));d.yaw+=dy*k;
    const vx=(d.x-px)/Math.max(dt,1e-4),vz=(d.z-pz)/Math.max(dt,1e-4),sp=Math.hypot(vx,vz);
    model.visible=true;model.position.set(d.x,CONFIG.deckY+d.h,d.z);const bodyYaw=p.mode==='drive'?0:p.mode==='fish'?Math.atan2(p.cx-p.x,p.cz-p.z):d.yaw;model.rotation.set(0,bodyYaw,0);
    const f=fishing[p.id],anim=model.userData.anim,phase=p.mode==='fish'?f.phase:'idle';
    if(anim.lastFish!==phase){if(phase==='waiting')anim.castNow();if(phase==='reeling')anim.hookNow();anim.lastFish=phase;}
    const other=players.find(q=>q.id!==p.id&&q.mode!=='ragdoll'),od=other&&models[other.id]?.userData.disp;
    const look=od?lookAngles(V(d.x,d.h+1.6,d.z),bodyYaw,V(od.x,od.h+1.6,od.z)):null;
    anim.update(dt,{time:t+p.id*1.3,speed:p.id===localId?src.speed||0:Math.min(sp,3),strafe:sp>.1?(vx*Math.cos(bodyYaw)-vz*Math.sin(bodyYaw))/sp:0,yaw:bodyYaw,grounded:src.height<=floorAt(src.x,src.z)+.04,
      fishing:phase,tension:f?.tension||0,reelHeld:p.id===localId?!!lastControls.reel:(f?.vel||0)>0,slap:p.slap,drive:p.mode==='drive',steer:steerVis,pitch:p.id===localId?input.pitch:p.pitch,look,roll:boat.userData.roll||0});}
}
function showCard(species,weight){const sp=SPECIES[species]||SPECIES[0],record=!best[species]||weight>best[species];if(record)best[species]=weight;
  $('catch-name').textContent=sp.name;$('catch-weight').textContent=sp.boot?'Tamanho 42. Sem o par.':weight.toLocaleString('pt-BR',{minimumFractionDigits:2})+' kg';$('catch-record').textContent=sp.boot?'LIXO DO MAR':record?'NOVO RECORDE':'';
  const card=$('catch-card');card.classList.remove('show');void card.offsetWidth;card.classList.add('show');clearTimeout(cardTimer);cardTimer=setTimeout(()=>card.classList.remove('show'),3000);}
function updateHUD(t){const p=me(),f=fishing[localId];if(!p||!f)return;
  $('clock').textContent=`${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;$('fish-count').textContent=players.reduce((sum,q)=>sum+q.fish,0);
  const names={sunset:'O ÚLTIMO PÔR DO SOL',storm:'SEGURE FIRME',asteroid:'UM PRESSÁGIO NO HORIZONTE',wave:'NÃO DÁ MAIS PARA VOLTAR',farewell:'ATÉ O ÚLTIMO ACORDE',blackout:'',title:''};$('phase-label').textContent=names[weatherAt(t).phase];
  const fx=Math.sin(input.yaw),fz=Math.cos(input.yaw),target=players.some(q=>q.id!==localId&&q.mode!=='ragdoll'&&Math.hypot(q.x-p.x,q.z-p.z)<CONFIG.slapRange&&((q.x-p.x)*fx+(q.z-p.z)*fz)/(Math.hypot(q.x-p.x,q.z-p.z)||1)>.3);$('crosshair').classList.toggle('target',target);
  const nearHelm=Math.hypot(p.x,p.z+2.8)<1.8,outward=!insideBoat(p.x+fx*7,p.z+fz*7);
  $('context').textContent=p.mode==='drive'?`NO LEME · W/S acelerar · A/D virar · E soltar · ${Math.abs(boatState.speed*1.94).toFixed(1)} nós`:p.mode==='ragdoll'?'RETORNO AÉREO EM ANDAMENTO…':p.mode==='fish'?'F pescar · WASD cancelar':target?'BOTÃO DIREITO · dar um tapa':nearHelm&&!engineDead?'E · assumir o leme':outward?'F · lançar a linha na direção da mira':'Olhe para o mar para lançar · ESPAÇO pula bancos';
  show('fishing',f.phase!=='idle');if(f.phase!=='idle'){const sp=SPECIES[f.species],z=f.zone??.18,reeling=f.phase==='reeling';
    $('fishing-title').textContent=f.phase==='waiting'?'Esperando uma boa história…':f.phase==='bite'?'MORDEU! APERTE F!':f.run>0?'ELE ESTÁ CORRENDO!':sp&&sp.diff>.6?'Algo enorme está puxando…':sp&&sp.diff>.35?'Esse tem força.':'Recolhendo…';
    $('fishing-percent').textContent=reeling?Math.round(f.progress*100)+'%':'';$('fish-zone').style.left=(f.target-z)*100+'%';$('fish-zone').style.width=z*200+'%';$('fish-needle').style.left=f.needle*100+'%';$('fish-tension').style.width=f.tension*100+'%';
    $('fishing').classList.toggle('danger',reeling&&f.tension>.7);$('fishing').classList.toggle('inzone',reeling&&Math.abs(f.needle-f.target)<z);$('fishing').classList.toggle('run',reeling&&f.run>0);
    $('fishing-help').textContent=f.phase==='waiting'?'Observe a boia. F cancela o lançamento.':f.phase==='bite'?'Rápido! Fisgar logo dá vantagem.':'Segure F para subir a marca; solte para descer. Fique na faixa verde.';}
  $('ping').textContent=!solo&&net.ping?`${Math.round(net.ping)} ms`:'';
}
function animate(){
  requestAnimationFrame(animate);const rdt=Math.min(clock.getDelta(),.05);hitStop=Math.max(0,hitStop-rdt);slowMo=Math.max(0,slowMo-rdt);const dt=rdt,vdt=rdt*(hitStop>0?.05:slowMo>0?.3:1);menuTime+=dt;displayTick++;
  const controls=input.enabled&&input.locked?input.read():input.enabled?{...input.read(),x:0,z:0,slap:false,cast:false,interact:false,jump:false,reel:false}:{};lastControls=controls;
  const live=running&&!paused&&!ended;
  if(live&&!cinematic){if(host)hostTick(dt,controls);else guestTick(dt,controls);}
  else if(live&&cinematic){elapsed+=dt;if(host&&!solo){netTick+=dt;if(netTick>.1){netTick=0;net.send(snapshot());}}}
  if(hold!==null&&solo)elapsed=hold;
  const t=running?elapsed:menuTime*.5;
  updateBoat(t,dt);
  if(!running){menuCharacters.forEach((m,i)=>{m.position.set(i===0?-.65:.65,CONFIG.deckY,-1.1);m.rotation.y=.55;const o=menuCharacters[1-i].position;m.userData.anim.update(dt,{time:menuTime+i*2,fishing:'waiting',grounded:true,yaw:.55,look:lookAngles(m.position.clone().setY(1.6),.55,o.clone().setY(1.6))});});const yaw=.45+Math.sin(menuTime*.045)*.05;camera.position.set(Math.sin(yaw)*13.8+boat.position.x,3.8,Math.cos(yaw)*13.8+boat.position.z);camera.lookAt(boat.position.x-2.7,1.6,boat.position.z);camera.fov=48;camera.updateProjectionMatrix();}
  else{
    phaseEffects(t);
    if(cinematic)cinematicUpdate(t,vdt);else{renderPlayers(t,vdt);fpCamera(t,vdt);}
    cameraDrama(t,dt);
    ragdolls.moveDeck(boat);if(!paused)ragdolls.update(dt,(x,z)=>{const l=boat.worldToLocal(V(x,0,z));return insideBoat(l.x,l.z)?-100:waveHeight(x,z,t,weatherAt(t).storm)+tsuAt(x,z,t);},(id,pos,velocity)=>{if(host)stateEvent('splash',{id,position:pos.toArray(),velocity});});
    if(displayTick%6===0)updateHUD(t);fx.update(t,vdt,{players,fishing,models,boat,camera,localId,cinematic});
    // tique do molinete enquanto recolhe
    const f=fishing[localId];if(f?.phase==='reeling'&&controls.reel){reelTick+=dt;if(reelTick>.07){reelTick=0;sound.effect('tick');}}
  }
  const w=environment.update(t,paused?0:dt,boat,camera,{paused});
  if(!paused)fluid.update(dt);cataclysm.update(t,paused?0:dt,boat,camera);
  const age=t-CONFIG.impactAt;
  sound.listener(camera);sound.update(t,dt,{running,phase:running?w.phase:'sunset',storm:w.storm,heave:boat.userData.heave,speed:boatState.speed,driving:running&&players.some(p=>p.mode==='drive'),meteor:running&&t>=CONFIG.asteroidAt&&age<0?clamp((t-CONFIG.asteroidAt)/17):0,tsu:running&&age>0?smooth(139,164,t):0});
  if(running)updatePost(t,dt);
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
  boat=new THREE.Group();const hull=makeBoat();boat.add(hull);boat.userData.bucketLocal=hull.userData.bucket.clone();helm=addHelm(boat);lantern=addLantern(boat);motor=addMotor(boat);scene.add(boat);ragdolls=new Ragdolls(scene);menuCharacters=[spawn(0),spawn(1)];
  fx=new FishingFX(scene);fx.onCard=showCard;fx.onBucket=pos=>sound.effect('bucket',{pos});
  post=new Post(renderer,scene,camera,quality);post.setSize(innerWidth,innerHeight);
  lobby.join(0,selected);updateLobby();setupUI();
  // Compila também o que só aparece no final (meteoro, impacto, tsunami) para não travar no clímax
  $('loading-text').textContent='Afinando as ondas e o céu…';const hidden=[];scene.traverse(o=>{if(!o.visible){hidden.push(o);o.visible=true;}});U.uImpactAge.value=0;
  updateBoat(0,0);environment.update(0,0,boat,camera);await renderer.compileAsync(scene,camera);post.render(0);hidden.forEach(o=>o.visible=false);U.uImpactAge.value=-1;
  environment.updateEnvMap();show('loading',false);animate();
  // Diagnóstico somente leitura; o salto de tempo funciona apenas no teste solo.
  window.__peixes={get state(){return {running,solo,host,localId,time:elapsed,phase:weatherAt(elapsed).phase,players:structuredClone(players),fishing:fishing.map(f=>({phase:f.phase,caught:f.caught,progress:f.progress})),lobby:lobby.snapshot(),impact:world.impact,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,meanFps:1/(frameTimes.reduce((a,b)=>a+b,0)/(frameTimes.length||1))}},get renderer(){return renderer;},get scene(){return scene;},get post(){return post;},get input(){return input;},get camera(){return camera;},get environment(){return environment;},get cataclysm(){return cataclysm;},get sound(){return sound;},get fx(){return fx;},get models(){return models;},get fishing(){return fishing;},get boat(){return boat;},jump(t){if(solo){elapsed=t;hold=null;}},hold(t){if(solo){hold=t;elapsed=t;}},look(yaw,pitch){input.yaw=yaw;input.pitch=pitch;}};
}
function setupUI(){
  $('open-lobby').onclick=()=>{show('lobby');sound.start()};$('lobby-close').onclick=()=>{show('lobby',false);if(!running)menuCharacters.forEach(m=>m.visible=true);};$('char0').onclick=()=>changeCharacter(0);$('char1').onclick=()=>changeCharacter(1);
  $('solo').onclick=()=>{net.close();start(true,[{id:0,character:selected}]);};
  $('room-host').onclick=async()=>{try{const code=roomCode();status('Abrindo a sala…');await net.room(code,true);host=true;localId=0;$('room-value').textContent=code;show('room-display');status('Sala aberta. Passe o código ao outro pescador e aguarde.');}catch(e){status(e.message);}};
  $('room-join').onclick=async()=>{const code=$('room-code').value.trim().toUpperCase();if(code.length<5){status('Digite o código de 5 letras.');return;}try{status('Procurando a sala '+code+'…');await net.room(code,false);}catch(e){status(e.message);}};
  $('room-code').addEventListener('keydown',e=>{if(e.key==='Enter')$('room-join').click();});
  $('room-copy').onclick=async()=>{try{await navigator.clipboard.writeText($('room-value').textContent);status('Código copiado.');}catch{status('Copie o código: '+$('room-value').textContent);}};
  $('host').onclick=async()=>{try{status('Preparando o convite…');const code=await net.offer();host=true;localId=0;$('net-code').value=code;$('code-label').textContent='1. Envie este convite ao outro pescador';$('net-help').textContent='Depois que ele responder, substitua o convite pela resposta e clique em Conectar.';$('use-code').textContent='Conectar resposta';codeAction='accept';show('connection');status('Convite pronto. Aguardando a resposta do convidado.');}catch(e){status(e.message)}};
  $('join').onclick=()=>{show('connection');$('net-code').value='';$('code-label').textContent='1. Cole o convite recebido';$('net-help').textContent='Você vai gerar uma resposta para devolver ao anfitrião.';$('use-code').textContent='Gerar resposta';codeAction='answer';};
  $('use-code').onclick=async()=>{try{if(codeAction==='answer'){const code=await net.answer($('net-code').value);host=false;localId=1;$('net-code').value=code;$('code-label').textContent='2. Envie esta resposta ao anfitrião';$('net-help').textContent='Aguarde ele colar esta resposta e conectar.';$('use-code').textContent='Aguardando conexão';$('use-code').disabled=true;status('Resposta pronta. Devolva o código ao anfitrião.');}else if(codeAction==='accept'){await net.accept($('net-code').value);status('Tentando conectar os dois pescadores…');}}catch(e){status('Não foi possível conectar: '+e.message);}};
  $('copy-code').onclick=async()=>{try{await navigator.clipboard.writeText($('net-code').value);status('Código copiado.')}catch{$('net-code').select();status('Selecione e copie o código com Ctrl+C.')}};
  $('ready').onclick=()=>{sound.start();const ready=!lobby.players.get(localId)?.ready;if(host){lobby.ready(0,ready);broadcastLobby();}else{lobby.ready(1,ready);net.send({type:'ready',ready});updateLobby();}};
  $('tab-host').onclick=()=>{host=true;localId=0;net.tabs($('tab-room').value.trim()||'pescaria',true);status('Sala de teste aberta. Entre na outra aba.');};$('tab-join').onclick=()=>{host=false;localId=1;net.tabs($('tab-room').value.trim()||'pescaria',false);status('Procurando a outra aba…');};
  $('sound').onclick=()=>{sound.start();$('sound').textContent=sound.toggle()?'SOM OFF':'SOM ON';};
  function settings(open){show('settings',open);if(running&&!cinematic&&!ended){if(solo){paused=open;document.body.classList.toggle('paused',open);}input.enabled=!open;input.clear();if(open){if(input.locked){expectUnlock=true;input.unlock();}show('lock-hint',false);}else input.lock();}}
  input.onLockChange=locked=>{const wasExpected=expectUnlock;expectUnlock=false;if(!running||cinematic||ended)return;if(locked){show('lock-hint',false);return;}if(!wasExpected&&$('settings').hidden)settings(true);else show('lock-hint',$('settings').hidden);};
  $('world').addEventListener('click',()=>{if(running&&!cinematic&&!ended&&!input.locked&&$('settings').hidden&&!paused)input.lock();});
  $('settings-open').onclick=()=>settings(true);$('settings-close').onclick=()=>settings(false);$('resume').onclick=()=>settings(false);
  $('quality').onchange=e=>{localStorage.setItem('peixes-quality',e.target.value);toast('Qualidade aplicada ao recarregar a página.');};$('sensitivity').oninput=e=>{input.sensitivity=Number(e.target.value);localStorage.setItem('peixes-sens',e.target.value);};
  window.addEventListener('keydown',e=>{if(e.code==='Escape'&&running&&!cinematic&&!ended&&!input.locked)settings($('settings').hidden);});
  const jumpTo=(t,msg)=>{if(!solo)return;elapsed=t;toast(msg);settings(false);};
  $('skip-storm').onclick=()=>jumpTo(58,'Teste: início da tempestade.');$('skip-ending').onclick=()=>jumpTo(118,'Teste: chegada do meteoro.');$('skip-impact').onclick=()=>jumpTo(132,'Teste: impacto.');
  $('fall-test').onclick=()=>{if(!solo)return;settings(false);players[0].x=2;models[0].position.x=2;models[0].updateMatrixWorld(true);rag(0,'water',[3,1,0]);};
  $('restart').onclick=()=>location.reload();window.addEventListener('resize',resize);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&!window.__peixesNoPause){input.clear();if(running&&solo&&!cinematic&&!ended)settings(true);}});window.addEventListener('beforeunload',()=>net.send({type:'bye'}));
}
init().catch(fail);

import * as THREE from 'three';
import {VOLCANO,TEMPLE,LEVELS,LEDGE,CONE,GLYPHS,L1T,l1Glyph,l1Cell,BLADES,bladeAngle,BUTTONS,BUTTON_ORDER,MIRRORS,MIRROR_START,beamPath,HEART} from './volcano.js';

// ======================================================================================================
// Templo do Coração do Vulcão: os puzzles, as armadilhas, o artefato e o sacrifício.
// O anfitrião decide tudo (world.temple vai no snapshot); cada cliente desenha o que vê.
//   Nível 1 · Salão dos Dardos: só os ladrilhos da lua (☽) são seguros; pisar em outro glifo dispara os dardos.
//            Quem chega na placa diante do portão ergue a pedra.
//   Nível 2 · Fosso das Lanças e Galeria das Lâminas: cair no fosso ou levar uma lâmina derruba; os quatro botões
//            do fim da galeria abrem o portão se forem apertados na ordem dos glifos das lâminas (da entrada para o fundo).
//   Nível 3 · Sala dos Espelhos: E gira um espelho 45°; a luz do poço tem que chegar ao disco solar da parede leste.
//   Nível 4 · Câmara do Coração: E pega o artefato. Quem está com ele tem que cair na lava do vulcão (pular do Beiral
//            ou levar um tapa): o sacrifício chama o meteoro sobre Laguna e o jogo caminha para o fim.
// world.temple = {gates:[0,0,0], seq:[botões certos], mir:[giro de cada espelho 0..7], relic:-1 no altar | id de quem carrega | -2 sacrificado}
// ======================================================================================================
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const [L1,L2]=LEVELS;
export const NEW_TEMPLE=()=>({gates:[0,0,0],seq:[],mir:[...MIRROR_START],relic:-1});
export const TCODE={BTN:200,MIR:210,HEART:220};
export const isTempleCode=c=>c>=200&&c<230;
const toLocal=(x,z)=>[x-VOLCANO.x-TEMPLE.u,z-VOLCANO.z-TEMPLE.v];
const toWorld=(tx,y,tz)=>V(VOLCANO.x+TEMPLE.u+tx,y,VOLCANO.z+TEMPLE.v+tz);
// início de cada nível: quem cai numa armadilha levanta aqui (e não em Laguna)
const LEVEL_START=[[0,-19.9,L1],[0,-49.6,L2]];
const backTo=(p,lv)=>{const [x,z,h]=LEVEL_START[lv],w=toWorld(x+((p.id%3)-1)*.8,h,z);p.backTo={land:1,x:w.x,z:w.z,h};};
let _glow=null;function glowTex(){if(_glow)return _glow;const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.3,'rgba(255,255,255,.6)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64);_glow=new THREE.CanvasTexture(c);return _glow;}
// ícone do artefato para a barra de itens (desenhado, sem arquivo)
export function relicIcon(){if(typeof document==='undefined')return '';const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');
  const g=x.createRadialGradient(64,64,4,64,64,60);g.addColorStop(0,'rgba(255,190,90,.95)');g.addColorStop(.45,'rgba(255,80,20,.45)');g.addColorStop(1,'rgba(255,60,10,0)');x.fillStyle=g;x.fillRect(0,0,128,128);
  x.fillStyle='#2a0a06';x.strokeStyle='#ffd27a';x.lineWidth=3;x.beginPath();x.moveTo(64,18);x.lineTo(96,64);x.lineTo(64,110);x.lineTo(32,64);x.closePath();x.fill();x.stroke();
  const h=x.createLinearGradient(40,30,90,100);h.addColorStop(0,'#ffcf6a');h.addColorStop(.5,'#ff4a12');h.addColorStop(1,'#7a1004');x.fillStyle=h;x.beginPath();x.moveTo(64,30);x.lineTo(86,64);x.lineTo(64,98);x.lineTo(42,64);x.closePath();x.fill();
  x.strokeStyle='rgba(255,230,160,.9)';x.lineWidth=2;x.beginPath();x.moveTo(64,30);x.lineTo(64,98);x.moveTo(42,64);x.lineTo(86,64);x.stroke();return c.toDataURL();}
function miniHeart(){const g=new THREE.Group();const core=new THREE.Mesh(new THREE.OctahedronGeometry(.11,0),new THREE.MeshStandardMaterial({color:0x14080a,emissive:0xff3a10,emissiveIntensity:2.6,flatShading:true}));core.scale.set(1,1.35,1);g.add(core);
  g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(.15,0),new THREE.MeshStandardMaterial({color:0xffc86a,metalness:1,roughness:.25,wireframe:true})));
  const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex(),color:new THREE.Color(3,.8,.2),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));halo.scale.setScalar(.7);g.add(halo);return g;}

export class Temple {
  // ctx: world, players, host, elapsed, localId, me(), worldOf(p,y), ragdolls, models, camera, scene, sound,
  //      stateEvent(name,payload), rag(id,reason,velocity), jolt(x,y,z,fov), respawnHome(p), sacrifice(p), name(p)
  constructor(ctx,volcano){this.c=ctx;this.v=volcano;this.cool={};this.fx=[];this.buildFx();this.buildHud();}
  get w(){const W=this.c.world;if(!W.temple)W.temple=NEW_TEMPLE();const T=W.temple;T.gates??=[0,0,0];T.seq??=[];T.mir??=[...MIRROR_START];T.relic??=-1;return T;}
  ledgeTip(){return V(VOLCANO.x+LEDGE.u,(this.v.ledgeY??80)+1.4,VOLCANO.z+LEDGE.v1+1.2);}
  // ================= anfitrião =================
  bodyPos(p){const C=this.c;if(p.mode==='ragdoll'){const r=C.ragdolls.active.get(p.id);if(!r)return null;const T=r.bodies.torso.position;return V(T.x,T.y,T.z);}return p.land&&!p.fly?C.worldOf(p):null;}
  inLava(at){const u=at.x-VOLCANO.x,v=at.z-VOLCANO.z,L=this.v.lavaY??0;/* a cratera fica bem acima das salas do templo: só vale perto da superfície da lava */return Math.hypot(u-CONE.u,v-CONE.v)<CONE.cr*.7&&at.y<L+.6&&at.y>L-12;}
  hostTick(){const C=this.c,W=this.w,T=C.elapsed;
    for(const p of C.players){
      if(p.mode==='gone'){if(W.relic===p.id){W.relic=-1;C.stateEvent('temple',{k:'relicBack'});}continue;}
      // lava: quem cai no vulcão morre e acorda no cais de Laguna; se estava com o Coração, é o sacrifício
      const at=this.bodyPos(p);if(at&&this.inLava(at)){const carrier=W.relic===p.id;C.stateEvent('temple',{k:carrier?'sacrifice':'burn',id:p.id,at:[+at.x.toFixed(2),this.v.lavaY,+at.z.toFixed(2)]});if(carrier){W.relic=-2;C.sacrifice(p);}C.respawnHome(p);continue;}
      if(p.mode!=='walk'&&p.mode!=='fish'||!p.land||p.fly||(this.cool[p.id]||0)>T)continue;
      const [tx,tz]=toLocal(p.x,p.z),h=p.height??0;if(Math.abs(tx)>40||tz>6||tz<-160)continue;
      // Nível 1: glifo errado = dardos das duas paredes (até o portão abrir; aí o mecanismo trava)
      if(!W.gates[0]&&Math.abs(h-L1)<.3&&Math.abs(tx)<6){
        if(tz<-20.45&&tz>-34.1){const cell=l1Cell(tx,tz);if(cell&&l1Glyph(cell[0],cell[1])!==L1T.safe){this.cool[p.id]=T+4;const side=tx>0?-1:1;backTo(p,0);C.rag(p.id,'darts',[side*4.5,3.5,3]);C.stateEvent('temple',{k:'darts',z:+(L1T.z0+cell[0]*L1T.dz).toFixed(2),id:p.id});continue;}}
        if(tz<-34.3&&tz>-36.1&&Math.abs(tx)<1.3){W.gates[0]=1;C.stateEvent('temple',{k:'gate',i:0,id:p.id});}}
      // Nível 2: fosso das lanças (menos na rampa de pedra) → derruba e devolve para a borda de entrada
      if(tz<-51&&tz>-65&&Math.abs(tx)<6&&h<L2-1.9&&!(tx<-4.5&&tz>-58)){this.cool[p.id]=T+4;backTo(p,1);C.rag(p.id,'spikes',[0,3,1]);C.stateEvent('temple',{k:'spikes',id:p.id,at:[p.x,h,p.z]});continue;}
      // lâminas: acertam quem está no caminho enquanto passam embaixo (cerca de ±40° do centro)
      if(tz<-69.5&&tz>-82.7&&Math.abs(h-L2)<.8)for(let i=0;i<BLADES.length;i++){const a=bladeAngle(T,i);if(Math.abs(a)>.68||Math.abs(tz-BLADES[i])>.55)continue;if(Math.abs(tx-5.4*Math.sin(a))>1.25)continue;
        const dir=Math.sign(Math.cos(T*1.1+i*1.3))||1;this.cool[p.id]=T+4;backTo(p,1);C.rag(p.id,'blade',[dir*5,3.5,2]);C.stateEvent('temple',{k:'blade',i,id:p.id});break;}}}
  // E nos botões, espelhos e no Coração (o anfitrião confere alcance e estado)
  interact(p,code){if(!isTempleCode(code))return false;const C=this.c,W=this.w,at=this.pos(code);if(!at||at.distanceTo(C.worldOf(p,1.2))>4.2)return true;
    if(code>=TCODE.BTN&&code<TCODE.BTN+4){if(W.gates[1])return true;const i=code-TCODE.BTN;
      if(BUTTON_ORDER[W.seq.length]===i){W.seq.push(i);C.stateEvent('temple',{k:'press',i,n:W.seq.length,id:p.id});if(W.seq.length===4){W.gates[1]=1;C.stateEvent('temple',{k:'gate',i:1,id:p.id});}}
      else{W.seq=[];C.stateEvent('temple',{k:'wrong',i,id:p.id});}return true;}
    if(code>=TCODE.MIR&&code<TCODE.MIR+MIRRORS.length){if(W.gates[2])return true;const i=code-TCODE.MIR;W.mir[i]=(W.mir[i]+1)%8;C.stateEvent('temple',{k:'mirror',i,s:W.mir[i],id:p.id});
      if(beamPath(W.mir).hit){W.gates[2]=1;C.stateEvent('temple',{k:'gate',i:2,id:p.id});}return true;}
    if(code===TCODE.HEART){if(W.relic!==-1)return true;W.relic=p.id;C.stateEvent('temple',{k:'relic',id:p.id});return true;}
    return true;}
  // ================= alvos (mira + E) =================
  targets(){const v=this.v;if(!v.interior?.visible)return [];const out=[];(v.buttons||[]).forEach((g,i)=>out.push([TCODE.BTN+i,g]));(v.mirrors||[]).forEach((g,i)=>out.push([TCODE.MIR+i,g]));if(v.heart)out.push([TCODE.HEART,v.heart]);return out;}
  pos(code){const v=this.v;if(code>=TCODE.BTN&&code<TCODE.BTN+4){const b=BUTTONS[code-TCODE.BTN];return toWorld(b.x,L2+1.5,b.z);}
    if(code>=TCODE.MIR&&code<TCODE.MIR+MIRRORS.length){const [x,z]=MIRRORS[code-TCODE.MIR];return toWorld(x,LEVELS[2]+1.5,z);}
    if(code===TCODE.HEART)return toWorld(HEART.x,HEART.y,HEART.z);return null;}
  label(code,p){const W=this.w;
    if(code>=TCODE.BTN&&code<TCODE.BTN+4)return W.gates[1]?['O mecanismo já destravou o portão',0]:[`Apertar o glifo ${GLYPHS[BUTTONS[code-TCODE.BTN].g]}`,1];
    if(code>=TCODE.MIR&&code<TCODE.MIR+MIRRORS.length)return W.gates[2]?['A luz já chegou ao sol',0]:['Girar o espelho (45°)',1];
    if(code===TCODE.HEART)return W.relic===-1?['Pegar o Coração do Vulcão',1]:null;return null;}
  // ================= efeitos (todos os clientes) =================
  buildFx(){const C=this.c;
    // dardos: bastões finos que atravessam a sala
    const dartMat=new THREE.MeshStandardMaterial({color:0x3a2a1a,roughness:.7});this.darts=Array.from({length:18},()=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.55,5).rotateZ(Math.PI/2),dartMat);m.visible=false;m.frustumCulled=false;C.scene.add(m);return {m,t:9};});
    // erupção do sacrifício e respingos de lava: sprites aditivos com gravidade
    this.sparks=Array.from({length:90},()=>{const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex(),color:new THREE.Color(3,1.1,.25),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));s.visible=false;s.frustumCulled=false;C.scene.add(s);return {s,v:V(),life:0,age:9,size:1};});
    this.flash=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex(),color:new THREE.Color(4,1.6,.4),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:0}));this.flash.visible=false;this.flash.frustumCulled=false;C.scene.add(this.flash);this.flashT=9;
    // coração na mão de quem carrega (um para o corpo visto pelos outros, outro na frente da câmera em primeira pessoa)
    this.handHeart=miniHeart();this.handHeart.visible=false;C.scene.add(this.handHeart);this.fpHeart=miniHeart();this.fpHeart.visible=false;this.fpHeart.scale.setScalar(.2);this.fpHeart.children[2].material.opacity=.45;this.fpHeart.position.set(.2,-.17,-.5);C.camera.add(this.fpHeart);}
  burst(at,n,speed,life,size){let k=0;for(const q of this.sparks){if(q.age<q.life)continue;const a=Math.random()*6.283,up=speed*(.6+Math.random()*.8),out=speed*.35*Math.random();q.s.position.copy(at);q.v.set(Math.cos(a)*out,up,Math.sin(a)*out);q.life=life*(.6+Math.random()*.6);q.age=0;q.size=size*(.5+Math.random());q.s.visible=true;if(++k>=n)break;}}
  event(e){const C=this.c,W=this.w,me=C.me(),near=at=>me&&at.distanceTo(C.worldOf(me))<30;
    if(e.k==='darts'){const z=e.z;this.darts.forEach((d,i)=>{const side=i%2?1:-1,y=L1+.5+(i%6)*.32;d.from=toWorld(side*5.9,y,z+(Math.random()-.5)*1.6);d.to=toWorld(-side*5.9,y+(Math.random()-.5)*.3,z+(Math.random()-.5)*1.6);d.t=-(i%6)*.035;d.m.visible=true;d.m.position.copy(d.from);d.m.lookAt(d.to);d.m.rotateY(Math.PI/2);});C.sound.effect('darts',{pos:toWorld(0,L1+1,z)});}
    if(e.k==='spikes'){const at=V(...e.at);C.sound.effect('spikes',{pos:at});}
    if(e.k==='blade')C.sound.effect('clang',{pos:toWorld(0,L2+1.5,BLADES[e.i])});
    if(e.k==='gate'){W.gates[e.i]=1;const g=[[0,L1+1.6,-36.3],[0,L2+1.6,-85.3],[16.3,LEVELS[2]+1.6,-114.3]][e.i],at=toWorld(...g);C.sound.effect('stone',{pos:at,big:1});if(near(at))C.jolt(1.5,0,1.2,-3);}
    if(e.k==='press'){if(!W.seq.includes(e.i))W.seq.push(e.i);C.sound.effect('chime',{n:e.n,pos:this.pos(TCODE.BTN+e.i)});}
    if(e.k==='wrong'){W.seq=[];this.v.btnFlash=C.elapsed+.8;C.sound.effect('wrong',{pos:this.pos(TCODE.BTN+e.i)});}
    if(e.k==='mirror'){W.mir[e.i]=e.s;C.sound.effect('stone',{pos:this.pos(TCODE.MIR+e.i)});}
    if(e.k==='relic'){W.relic=e.id;const at=toWorld(HEART.x,HEART.y,HEART.z);C.sound.effect('relic',{pos:at});if(near(at)){C.jolt(4,2,3,8);}this.burst(at,30,4,1.2,.5);this.rumbleT=C.elapsed+4;}
    if(e.k==='relicBack')W.relic=-1;
    if(e.k==='burn'||e.k==='sacrifice'){const at=V(...e.at),big=e.k==='sacrifice';if(big)W.relic=-2;this.burst(at,big?90:24,big?26:9,big?3.2:1.6,big?5:1.6);this.flash.position.copy(at).add(V(0,big?8:2,0));this.flashBig=big;this.flashT=0;this.flash.visible=true;
      C.sound.effect(big?'sacrifice':'lava',{pos:at});if(me&&at.distanceTo(C.worldOf(me))<160)C.jolt(big?6:2,0,big?5:1,big?14:4);}}
  // ================= desenho por quadro =================
  render(t,dt){const C=this.c,W=this.w;
    for(const d of this.darts){if(!d.m.visible)continue;d.t+=dt;const k=Math.max(0,d.t/.32);if(k>=1){d.m.visible=false;continue;}d.m.position.lerpVectors(d.from,d.to,k);}
    for(const q of this.sparks){if(q.age>=q.life){if(q.s.visible)q.s.visible=false;continue;}q.age+=dt;q.v.y-=9*dt;q.s.position.addScaledVector(q.v,dt);const a=1-q.age/q.life;q.s.material.opacity=a;q.s.scale.setScalar(q.size*(.6+a*.6));}
    if(this.flash.visible){this.flashT+=dt;const k=this.flashT/(this.flashBig?2.4:.9);this.flash.material.opacity=Math.max(0,1-k);this.flash.scale.setScalar((this.flashBig?40:10)*(.5+k));if(k>=1)this.flash.visible=false;}
    // tremor enquanto o templo "acorda" depois que o Coração sai do altar
    if(this.rumbleT>t&&Math.random()<dt*6){const me=C.me();if(me&&this.v.interior?.visible)C.jolt((Math.random()-.5)*1.2,(Math.random()-.5)*1.2,0,0);}
    // o Coração vai na mão de quem carrega
    const holder=W.relic>=0?C.players[W.relic]:null,local=holder&&holder.id===C.localId,fp=local&&!C.thirdPerson&&holder.mode!=='ragdoll';
    this.fpHeart.visible=!!fp;if(fp){this.fpHeart.rotation.y+=dt*1.4;this.fpHeart.position.y=-.17+Math.sin(t*2)*.004;}
    const m=holder&&C.models[holder.id],hand=m?.userData.joints?.foreL;this.handHeart.visible=!!(hand&&!fp&&m.visible!==false);if(this.handHeart.visible){hand.localToWorld(this.handHeart.position.set(-.08,-.34,.08));this.handHeart.rotation.y+=dt*1.4;}
    this.hud(t);}
  // ================= HUD: marcador do Beiral e objetivo =================
  buildHud(){if(typeof document==='undefined')return;const hud=document.getElementById('hud');this.mark=document.createElement('div');this.mark.className='relic-mark';this.mark.innerHTML='<i class="arrow">▲</i><b class="gem">◆</b><span class="name">BEIRAL DO SACRIFÍCIO</span><small class="dist"></small>';hud?.appendChild(this.mark);
    this.goal=document.createElement('div');this.goal.className='relic-goal';hud?.appendChild(this.goal);this.goalKey='';}
  hud(t){if(!this.mark)return;const C=this.c,W=this.w,cam=C.camera,active=W.relic>=0&&!C.cinematic;this.mark.hidden=!active;this.goal.hidden=!active;if(!active)return;
    const tip=this.ledgeTip(),me=C.me(),from=me?C.worldOf(me):cam.position,d=Math.round(Math.hypot(tip.x-from.x,tip.z-from.z)),q=tip.clone().project(cam),behind=q.z>1;
    let x=q.x,y=q.y;const inside=!behind&&Math.abs(x)<.92&&Math.abs(y)<.86;
    if(!inside){if(behind){x=-x;y=-y;}const k=Math.max(Math.abs(x)/.9,Math.abs(y)/.82,1e-3);x/=k;y/=k;if(behind&&Math.abs(y)<.82&&Math.abs(x)<.9){y=-.82;}}
    this.mark.style.transform=`translate(${(x*.5+.5)*innerWidth}px,${(-y*.5+.5)*innerHeight}px)`;this.mark.classList.toggle('edge',!inside);
    if(!inside)this.mark.querySelector('.arrow').style.transform=`rotate(${Math.atan2(x,y)}rad)`;
    this.mark.querySelector('.dist').textContent=d+' m';
    const holder=C.players[W.relic],mine=holder?.id===C.localId,k=`${W.relic}/${mine}`;if(k!==this.goalKey){this.goalKey=k;
      this.goal.innerHTML=mine?'<b>◆ O CORAÇÃO DO VULCÃO ESTÁ COM VOCÊ</b><span>Suba até o Beiral do Sacrifício e pule na lava (ou peça um tapa)</span>':`<b>◆ O CORAÇÃO DO VULCÃO ESTÁ COM ${C.name(holder)}</b><span>Levem-no ao Beiral do Sacrifício e joguem-no na lava</span>`;}}
}

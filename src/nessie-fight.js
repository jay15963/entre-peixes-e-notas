import * as THREE from 'three';
import {Particles} from './cataclysm.js';
import {U} from './shaders.js';
import {makeNessie} from './nessie.js';
import {cranialSurface} from './nessie-head.js';

// =====================================================================================================
// Nessie, a Matriarca do Abismo: o boss inteiro (corpo animado na GPU, comportamento, ataques, dano,
// água reagindo o tempo todo, sons). Usado pela vitrine do ateliê e pela partida (anfitrião simula,
// convidados recebem o estado e os eventos e desenham igual).
// =====================================================================================================
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),lerp=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const damp=(a,b,k,dt)=>a+(b-a)*(1-Math.exp(-k*dt));
const angDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const rnd=(a=0,b=1)=>a+Math.random()*(b-a);
export const MAX_HP=800,STAGE_AT=[1,.80,.50],BASE_DMG=10;
export const ZONES={eye:{mult:5,label:'OLHO',color:'#ffd23c'},mouth:{mult:3,label:'GARGANTA',color:'#ff8a3c'},gill:{mult:2,label:'GUELRA',color:'#ff5ad0'},body:{mult:1,label:'CORPO',color:'#ffffff'},spine:{mult:.25,label:'ESPINHOS',color:'#8fa9a3'}};
export const ZONE_LIST=['eye','mouth','gill','body','spine'];
export const ATTACK_NAMES={ram:'INVESTIDA SUBMERSA',tripleRam:'INVESTIDA EM SÉRIE',tail:'GOLPE DE CAUDA',emerge:'O RUGIDO',rage:'FÚRIA DA MATRIARCA',cannon:'JATO D\'ÁGUA',whirlpool:'REDEMOINHO',bite:'MORDIDA DO ABISMO',wall:'MURALHA D\'ÁGUA',volley:'CHUVA DE ESPINHOS',death:'',cruise:''};
// mesma coluna e seções do modelo (nessie.js): pontos para esteira, dano e água
const SPINE=[[-.8,2,-17],[-1.3,2.2,-14],[-.65,2.6,-11],[0,3,-8],[0,3.3,-5],[0,3.6,-2],[0,4.8,.3],[0,6.8,1.6],[0,9,2.1],[0,10.2,3.3],[0,10.25,4.7]];
const RADII=[.03,.3,.7,1.5,2.1,2,1.2,.82,.7,.78,.8];
// ------------------------------------------------------------------ deformação: onda do corpo em 2 eixos, pescoço em S (2 segmentos), cauda
const PIV_A=V(0,3.4,-1.5),PIV_B=V(0,7.2,1.9),PIV_T=V(0,2.8,-6);
const BEND_GLSL=`uniform mat4 uChild,uChildInv;uniform vec4 uNeck,uTail,uSwim;
mat3 bRX(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0.,0.,c,s,0.,-s,c);}
mat3 bRY(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s,0.,1.,0.,s,0.,c);}
vec3 bossBend(vec3 p,inout mat3 R){float z0=p.z;
  float env=1.-smoothstep(-17.,1.,z0),ph=z0*uSwim.z+uSwim.y;p.x+=uSwim.x*env*env*sin(ph);p.y+=uSwim.w*env*sin(ph+1.4);R=bRY(atan(uSwim.x*env*env*uSwim.z*cos(ph)))*R;
  vec3 A=vec3(0.,3.4,-1.5);float s1=smoothstep(-1.5,2.2,z0);mat3 N1=bRY(uNeck.y*s1)*bRX(uNeck.x*s1);p=A+N1*(p-A);R=N1*R;
  mat3 NF=bRY(uNeck.y)*bRX(uNeck.x);vec3 B=A+NF*(vec3(0.,7.2,1.9)-A);float s2=smoothstep(1.9,4.4,z0);mat3 N2=bRY(uNeck.w*s2)*bRX(uNeck.z*s2);p=B+N2*(p-B);R=N2*R;
  vec3 T=vec3(0.,2.8,-6.);float q=1.-smoothstep(-17.,-6.,z0);mat3 M=bRY(uTail.x*q)*bRX(uTail.y*q);p=T+M*(p-T);R=M*R;return p;}`;
const eul=(p,y)=>new THREE.Euler(p,y,0,'YXZ');
export function bendCPU(p,P){const z0=p.z,q=p.clone(),env=1-smooth(-17,1,z0),ph=z0*P.k+P.phase;q.x+=P.lat*env*env*Math.sin(ph);q.y+=P.vert*env*Math.sin(ph+1.4);
  const s1=smooth(-1.5,2.2,z0);q.sub(PIV_A).applyEuler(eul(P.neckA*s1,P.yawA*s1)).add(PIV_A);
  const B=PIV_B.clone().sub(PIV_A).applyEuler(eul(P.neckA,P.yawA)).add(PIV_A),s2=smooth(1.9,4.4,z0);q.sub(B).applyEuler(eul(P.neckB*s2,P.yawB*s2)).add(B);
  const t=1-smooth(-17,-6,z0);q.sub(PIV_T).applyEuler(eul(P.tailPitch*t,P.tailYaw*t)).add(PIV_T);return q;}
function rig(nessie){
  const shared={uNeck:{value:new THREE.Vector4()},uTail:{value:new THREE.Vector4()},uSwim:{value:new THREE.Vector4(0,0,.35,0)}};
  const head=nessie.getObjectByName('Crânio esculpido · Nessie'),bent=[],flippers=[];const inHead=o=>{for(let q=o;q;q=q.parent)if(q===head)return true;return false;};
  nessie.traverse(o=>{if(o.name==='Nadadeira peitoral'||o.name==='Nadadeira pélvica')flippers.push({f:o,s:Math.sign(o.position.x),rear:o.name==='Nadadeira pélvica',base:o.rotation.clone()});
    if(!o.isMesh||inHead(o))return;const u={uChild:{value:new THREE.Matrix4()},uChildInv:{value:new THREE.Matrix4()},...shared};
    const mat=o.material.clone();mat.onBeforeCompile=sh=>{Object.assign(sh.uniforms,u);sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\n'+BEND_GLSL)
      .replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nmat3 bR=mat3(1.);vec3 bP=bossBend((uChild*vec4(position,1.)).xyz,bR);objectNormal=mat3(uChildInv)*(bR*(mat3(uChild)*objectNormal));')
      .replace('#include <begin_vertex>','vec3 transformed=(uChildInv*vec4(bP,1.)).xyz;');};mat.customProgramCacheKey=()=>'boss-bend-2';o.material=mat;
    const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});depth.onBeforeCompile=sh=>{Object.assign(sh.uniforms,u);sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\n'+BEND_GLSL).replace('#include <begin_vertex>','mat3 bR=mat3(1.);vec3 transformed=(uChildInv*vec4(bossBend((uChild*vec4(position,1.)).xyz,bR),1.)).xyz;');};depth.customProgramCacheKey=()=>'boss-bend-depth-2';
    o.customDepthMaterial=depth;o.frustumCulled=false;bent.push({mesh:o,u});});
  head.traverse(o=>{if(o.isMesh)o.frustumCulled=false;});
  const head0=head.position.clone(),q0=head.quaternion.clone(),inv=new THREE.Matrix4();
  const eyes=[1,-1].map(s=>{const a=s===1?.63:Math.PI-.63,c=cranialSurface(1.08,a,.027),n=V(s*.94,.16,.3).normalize(),u=V(-s*.3,0,.94).normalize();return c.addScaledVector(n,.13).addScaledVector(u,.035);});
  return {head,eyes,bent,flippers,apply(P,time,swimK){const S=shared;S.uNeck.value.set(P.neckA,P.yawA,P.neckB,P.yawB);S.uTail.value.set(P.tailYaw,P.tailPitch,0,0);S.uSwim.value.set(P.lat,P.phase,P.k,P.vert);
      const p=head0.clone().sub(PIV_A).applyEuler(eul(P.neckA,P.yawA)).add(PIV_A),B=PIV_B.clone().sub(PIV_A).applyEuler(eul(P.neckA,P.yawA)).add(PIV_A);p.sub(B).applyEuler(eul(P.neckB,P.yawB)).add(B);head.position.copy(p);
      head.quaternion.setFromEuler(eul(P.neckB,P.yawB)).multiply(new THREE.Quaternion().setFromEuler(eul(P.neckA,P.yawA))).multiply(q0).multiply(new THREE.Quaternion().setFromEuler(eul(P.headPitch,P.headYaw)));head.setGape(P.gape);
      // nadadeiras remando: batida para baixo e para trás, recuperação dobrando; as de trás defasadas
      for(const fl of flippers){const ph=time*(1.6+swimK*2.2)+(fl.rear?1.5:0)+(fl.s>0?0:.25),st=Math.sin(ph),amp=.35+swimK*.65;fl.f.rotation.set(fl.base.x+Math.cos(ph)*.25*amp,fl.base.y+fl.s*Math.cos(ph)*.45*amp,fl.base.z+fl.s*(st*.55*amp-.1));}
      nessie.updateMatrixWorld(true);inv.copy(nessie.matrixWorld).invert();for(const b of bent){b.u.uChild.value.copy(inv).multiply(b.mesh.matrixWorld);b.u.uChildInv.value.copy(b.u.uChild.value).invert();}}};
}
// ------------------------------------------------------------------ efeitos de água: coluna, jato, muralha
const COL_VS=`uniform float uT,uH,uR,uAge;varying vec2 vUv;varying float vY;void main(){vUv=uv;vec3 p=position;float y=uv.y;float n=sin(uv.x*37.+uT*9.)*.5+sin(uv.x*83.-uT*13.+y*9.)*.3;float bulge=1.+.8*y*y+n*.16*y;p.xz*=uR*bulge*(1.+uAge*1.2);p.y=y*uH;vY=y;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`;
const COL_FS=`uniform float uT,uAge,uFade;varying vec2 vUv;varying float vY;void main(){float streak=.55+.45*sin(vUv.x*71.+vY*14.-uT*18.)*sin(vUv.x*29.+uT*5.);float a=(1.-smoothstep(.5,1.,vY))*streak*uFade;vec3 c=mix(vec3(.5,.66,.72),vec3(1.),vY*.8+streak*.2);gl_FragColor=vec4(c*1.2,a*.85);}`;
const BEAM_VS=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const BEAM_FS=`uniform float uT,uFade;varying vec2 vUv;void main(){float core=1.-abs(vUv.x-.5)*2.;float n=.55+.45*sin(vUv.y*60.-uT*70.+vUv.x*20.);gl_FragColor=vec4(vec3(.8,.95,1.)*2.4*n*core*uFade,core*uFade*.9);}`;
const WALL_VS=`uniform float uH;varying vec2 vUv;varying float vH;void main(){vUv=uv;vec3 p=position;float prof=exp(-pow((uv.y-.5)*3.2,2.))*(1.-pow(abs(uv.x-.5)*2.,6.));float lip=exp(-pow((uv.y-.62)*9.,2.));p.y+=uH*prof;p.z+=lip*uH*.35;vH=prof;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`;
const WALL_FS=`uniform float uT,uFade;varying vec2 vUv;varying float vH;void main(){float crest=smoothstep(.72,1.,vH);float foam=crest*(.6+.4*sin(vUv.x*180.+uT*6.));vec3 water=mix(vec3(.02,.09,.11),vec3(.08,.22,.24),vH);gl_FragColor=vec4(mix(water,vec3(.95,.97,1.),foam),smoothstep(.02,.15,vH)*uFade);}`;
function flare(){if(typeof document==='undefined')return null;const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d'),g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.12,'rgba(255,200,160,.9)');g.addColorStop(.4,'rgba(255,80,30,.35)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,128,128);
  x.globalCompositeOperation='lighter';x.strokeStyle='rgba(255,160,120,.6)';x.lineWidth=2;x.beginPath();x.moveTo(0,64);x.lineTo(128,64);x.stroke();const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
// =====================================================================================================
export class NessieFight {
  // fluid: FluidSim (ondas reais na superfície); sound: Sound (efeitos posicionais); waves(x,z,t): altura do mar base
  constructor(scene,{fluid,sound=null,waves=()=>0}){
    this.scene=scene;this.fluid=fluid;this.sound=sound;this.waves=waves;this.time=0;this.alive=false;
    this.nessie=makeNessie();this.root=new THREE.Group();this.root.add(this.nessie);this.root.visible=false;scene.add(this.root);this.rig=rig(this.nessie);
    this.nessie.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
    this.spray=new Particles(scene,14000,{kind:2,dark:[.3,.38,.42],light:[.95,.97,.98],opacity:.6,glowColor:[1.6,.3,.15],glowRadius:40,wind:[3,0,1],near:[.4,4]});
    this.mist=new Particles(scene,5000,{kind:0,dark:[.34,.38,.41],light:[.84,.88,.9],opacity:.2,wind:[4,0,1.5],near:[1,8]});
    this.foam=new Particles(scene,5000,{kind:2,dark:[.7,.74,.76],light:[.98,.99,1],opacity:.7,wind:[1,0,.5],near:[.4,4]});
    this.embers=new Particles(scene,2000,{kind:1,additive:true,opacity:1});
    const tex=flare();this.eyeFX=this.rig.eyes.map(p=>{const g=new THREE.Group();g.position.copy(p);
      const core=new THREE.Mesh(new THREE.SphereGeometry(.13,16,12),new THREE.MeshBasicMaterial({color:new THREE.Color(8,4,.6),toneMapped:false}));const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,color:new THREE.Color(1,.5,.1),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));halo.scale.setScalar(1.4);
      const light=new THREE.PointLight(0xff4020,0,30,1.6);g.add(core,halo,light);this.rig.head.add(g);return {g,core,halo,light};});
    this.throat=new THREE.PointLight(0xff8a30,0,20,1.8);this.throat.position.set(0,-.2,2.2);this.rig.head.add(this.throat);
    // as luzes ficam SEMPRE na cena (apagadas fora da luta): se aparecessem junto com o modelo, a contagem de luzes mudaria e o three.js recompilaria todos os materiais do jogo
    const fake=l=>{l.parent.remove(l);return {color:new THREE.Color(),intensity:0,position:V()};};for(const e of this.eyeFX.slice(1))e.light=fake(e.light);this.throat=fake(this.throat);
    this.lightPairs=[this.eyeFX[0].light].map(l=>{const a=new THREE.Object3D();a.position.copy(l.position);l.parent.add(a);l.parent.remove(l);this.scene.add(l);return [l,a];});
    this.throatGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,color:new THREE.Color(3,1.2,.3),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:0}));this.throatGlow.position.set(0,-.25,2.4);this.throatGlow.scale.setScalar(3.5);this.rig.head.add(this.throatGlow);
    this.effectPool={column:[],beam:[],wall:[]};this.fx=[];this.rings=[];this.walls=[];this.projectiles=[];this.prevPts=null;this.dropCursor=0;
    this.spineGeo=new THREE.ConeGeometry(.3,2.4,6).rotateX(Math.PI/2);this.spineMat=new THREE.MeshStandardMaterial({color:0x3a5c51,roughness:.5,metalness:.1,emissive:0x330000});
    this.warningGeo=new THREE.RingGeometry(.88,1,64).rotateX(-Math.PI/2);
    this.warningMarkers=Array.from({length:8},()=>{const m=new THREE.Mesh(this.warningGeo,new THREE.MeshBasicMaterial({color:0xffc777,transparent:true,opacity:.6,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));m.visible=false;m.frustumCulled=false;scene.add(m);return m;});
    this.reset(0,0);
  }
  // ---------------------------------------------------------------- estado
  reset(x,z){this.prevPts=null;this.prevY=null;this.curtain=0;this.lastName=null;this.hp=MAX_HP;this.stage=1;this.stageDone=new Set();this.dead=false;this.redK=0;this.cursor=0;this.forceNext=null;this.exposed={spine:true};this.pull=null;
    this.S={x:x-45,z:z-20,y:-9,heading:0,roll:0,pitch:0,speed:0,turn:0};this.P={lat:.5,vert:.15,phase:0,k:.38,neckA:1,yawA:0,neckB:.45,yawB:0,tailYaw:0,tailPitch:0,gape:.12,headPitch:0,headYaw:0};
    this.neckSpring={v:0,x:0};this.attack=null;}
  begin(x,z){this.reset(x,z);this.alive=true;this.root.visible=true;this.events=[];this.boat={x,z,vx:0,vz:0,heading:0};this.startAttack('rage');}
  end(){for(const [l] of this.lightPairs||[])l.intensity=0;this.alive=false;this.root.visible=false;U.uBoss.value.w=0;U.uBossFoam.value=0;for(const f of this.fx)this.clearEffect(f.obj);this.fx=[];for(const w of this.walls)this.clearEffect(w.mesh);this.walls=[];for(const p of this.projectiles)this.scene.remove(p.mesh);this.projectiles=[];this.rings=[];this.stopDrone();for(const m of this.warningMarkers)m.visible=false;}
  // sem marcas na água: o jogador lê o golpe pela animação, pelo som e pela esteira
  warningData(){return [];}
  telegraphData(){const A=this.attack;if(!A||this.dead)return [];const t=A.t;
    if((A.name==='tail'||A.name==='bite')&&t<A.warn)return [[A.at.x,A.at.z,A.name==='tail'?4.8:3.8,t/A.warn]];
    if(A.name==='cannon'&&t<A.charge)return [[A.aim.x,A.aim.z,4.5,t/A.charge]];
    if((A.name==='ram'||A.name==='tripleRam')&&A.phase===0){return [0,1,2,3].map(i=>[A.start.x+Math.sin(A.heading)*(10+i*10),A.start.z+Math.cos(A.heading)*(10+i*10),3.7,A.pt/A.warn]);}
    if(A.name==='whirlpool')return [[A.c.x,A.c.z,11,.3]];
    if(A.name==='volley')return (A.spikes||[]).filter(p=>!p.done).slice(-8).map(p=>[p.at.x,p.at.z,1.6,1-(p.t-this.time)/1.8]);
    return [];}
  clearEffect(obj){this.scene.remove(obj);const pool=this.effectPool[obj.userData.effectKind];if(pool&&!pool.includes(obj))pool.push(obj);}
  get stageName(){return ['','A ESPREITA','A FÚRIA','A MATRIARCA FERIDA'][this.stage];}
  plan(){return this.stage===1?['cruise','ram','tail','cruise','emerge','ram','bite']:this.stage===2?['tripleRam','cannon','whirlpool','tail','emerge','bite','cannon']:['wall','volley','tripleRam','cannon','bite','emerge','tail','whirlpool'];}
  nextAttack(){if(this.dead)return 'death';if(this.forceNext){const n=this.forceNext;this.forceNext=null;this.lastName=n;return n;}if(this.lastName&&this.lastName!=='cruise'){this.lastName='cruise';return 'cruise';}const p=this.plan(),n=p[this.cursor%p.length];this.cursor++;this.lastName=n;if(this.cursor>=p.length)this.stageDone.add(this.stage);return n;}
  // velocidade de nado e investidas (fica mais rápida a cada estágio)…
  speedK(){return this.stage===1?1.05:this.stage===2?1.2:(this.hp/MAX_HP<.12?1.5:1.35);}
  // …e o tempo de preparo dos golpes de área (dá para reagir com ~1 s)
  warnK(){return this.stage===1?.85:this.stage===2?.95:1.05;}
  emit(ev){this.events.push(ev);this.fxEvent(ev);}
  snapshot(){const S=this.S,P=this.P,A=this.attack||{};return {s:[S.x,S.z,S.y,S.heading,S.roll,S.pitch,S.speed].map(v=>+v.toFixed(2)),p:[P.lat,P.vert,P.neckA,P.yawA,P.neckB,P.yawB,P.tailYaw,P.tailPitch,P.gape,P.headPitch,P.headYaw].map(v=>+v.toFixed(3)),a:A.name,t:+(A.t||0).toFixed(2),v:this.warningData(),hp:Math.round(this.hp),st:this.stage,d:this.dead?1:0,e:Object.keys(this.exposed).filter(k=>this.exposed[k]).join(','),w:A.name==='whirlpool'&&A.c?[+A.c.x.toFixed(1),+A.c.z.toFixed(1)]:null};}
  applySnapshot(n){if(!n)return;this.target=n;if(!this.alive){this.alive=true;this.root.visible=true;}const S=this.S;if(!this.attack||this.attack.name!==n.a)this.attack={name:n.a,t:n.t,k:this.speedK()};this.attack.t=n.t;
    this.hp=n.hp;this.stage=n.st;this.dead=!!n.d;this.exposed={};for(const k of (n.e||'').split(','))if(k)this.exposed[k]=true;if(Math.hypot(n.s[0]-S.x,n.s[1]-S.z)>30){[S.x,S.z,S.y]=n.s;}this.wpool=n.w;}
  // ---------------------------------------------------------------- água analítica (move o barco) e eventos visuais
  extraH(x,z){let h=0;for(const r of this.rings){const age=this.time-r.t0;if(age<0)continue;const d=Math.hypot(x-r.x,z-r.z),front=r.c*age;h+=r.A*Math.exp(-Math.pow((d-front)/r.w,2))*Math.exp(-age*.3)*Math.min(1,front/(d+1));}
    for(const w of this.walls){const s=(x-w.x)*w.dx+(z-w.z)*w.dz,lat=Math.abs(-(x-w.x)*w.dz+(z-w.z)*w.dx),front=w.c*(this.time-w.t0);h+=w.A*Math.exp(-Math.pow((s-front)/7,2))*(1-smooth(55,70,lat))*w.fade;}return h;}
  waterH(x,z){return this.waves(x,z,this.time)+this.extraH(x,z);}
  headWorld(){return this.rig.head.getWorldPosition(V());}
  toWorld(p){return this.nessie.localToWorld(bendCPU(p,this.P));}
  // evento de efeito (anfitrião cria e manda; todos desenham)
  fxEvent(ev){const k=ev.k;
    if(k==='splash'){const p=V(ev.x,ev.y??this.waterH(ev.x,ev.z),ev.z);this.burst(p,ev.n||400,ev.p||1);if(ev.col)this.column(p,ev.col,ev.p||1);if(ev.ring)this.ring(ev.x,ev.z,ev.ring,ev.c||10,ev.rw||4);if(ev.s)this.sfx(ev.s,p);}
    if(k==='ring')this.ring(ev.x,ev.z,ev.A,ev.c||10,ev.w||4);
    if(k==='beam'){this.beam(V(...ev.from),V(...ev.to));}
    if(k==='wall')this.addWall(ev.x,ev.z,ev.dx,ev.dz,ev.A);
    if(k==='spine')this.launchSpine(V(...ev.from),V(...ev.to),ev.dur);
    if(k==='sfx')this.sfx(ev.n,V(ev.x,ev.y,ev.z));
    if(k==='surge')this.surge(ev.power||1);}
  // perturbação na simulação de fluido na escala da grade (raio mínimo de ~1,5 célula; força limitada para não virar espinho)
  drop(x,z,r,depth,rim=0,foam=1){const f=this.fluid;if(!f)return;const cell=f.size/f.resolution;f.drop(x,z,Math.max(r,cell*1.6),clamp(depth,-1.2,1.2),clamp(rim,0,.9),foam);}
  ring(x,z,A,c=10,w=4){this.rings.push({x,z,A,c,w,t0:this.time});if(this.rings.length>16)this.rings.shift();this.drop(x,z,Math.max(3,A*1.8),A*.45,A*.3,.8);}
  burst(p,n=400,power=1){n=Math.min(n,1200);const t=U.uTime.value;for(let i=0;i<n;i++){const a=Math.random()*6.283,r=Math.random()*1.8*power,up=rnd(4,16)*power;this.spray.emit(t,p.x+Math.cos(a)*r,p.y,p.z+Math.sin(a)*r,Math.cos(a)*rnd(1,7)*power,up,Math.sin(a)*rnd(1,7)*power,rnd(1.4,3),.55,1,rnd(.2,.5)*power,rnd(.5,1.2)*power,1);}
    for(let i=0;i<n/9;i++){const a=Math.random()*6.283;this.mist.emit(t,p.x+Math.cos(a)*2.5*power,p.y+rnd(0,4)*power,p.z+Math.sin(a)*2.5*power,Math.cos(a)*rnd(1,5),rnd(1,5)*power,Math.sin(a)*rnd(1,5),rnd(2.5,5),1.1,.04,rnd(1.5,3.5)*power,rnd(5,10)*power,1);}
    for(let i=0;i<n/4;i++){const a=Math.random()*6.283,r=rnd(1,5)*power;this.foam.emit(t,p.x+Math.cos(a)*r,p.y+.1,p.z+Math.sin(a)*r,Math.cos(a)*rnd(1,3),0,Math.sin(a)*rnd(1,3),rnd(3,6),1.5,0,rnd(.6,1.2),rnd(2,3.5),.4);}}
  column(p,h,power=1){const m=this.effectPool.column.pop()||new THREE.Mesh(new THREE.CylinderGeometry(1,1,1,32,12,true),new THREE.ShaderMaterial({uniforms:{uT:{value:0},uH:{value:.1},uR:{value:1.6*power},uAge:{value:0},uFade:{value:1}},vertexShader:COL_VS,fragmentShader:COL_FS,transparent:true,depthWrite:false,side:THREE.DoubleSide}));
    m.userData.effectKind='column';m.material.uniforms.uR.value=1.6*power;m.position.set(p.x,this.waterH(p.x,p.z)-.5,p.z);m.frustumCulled=false;this.scene.add(m);this.fx.push({obj:m,t0:this.time,kind:'column',h,life:3,p:p.clone(),power});}
  beam(from,to){const len=to.distanceTo(from),m=this.effectPool.beam.pop()||new THREE.Mesh(new THREE.CylinderGeometry(1,.6,1,18,1,true).translate(0,.5,0).rotateX(Math.PI/2),new THREE.ShaderMaterial({uniforms:{uT:{value:0},uFade:{value:1}},vertexShader:BEAM_VS,fragmentShader:BEAM_FS,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));
    m.userData.effectKind='beam';m.material.uniforms.uFade.value=1;m.position.copy(from);m.lookAt(to);m.scale.set(1,1,len);this.scene.add(m);this.fx.push({obj:m,t0:this.time,kind:'beam',life:.6});const t=U.uTime.value;for(let i=0;i<260;i++){const p=from.clone().lerp(to,Math.random());this.spray.emit(t,p.x,p.y,p.z,rnd(-3,3),rnd(-1,4),rnd(-3,3),1.2,.5,1,.3,1.2,1);if(i%3===0)this.mist.emit(t,p.x,p.y,p.z,rnd(-1,1),rnd(0,1),rnd(-1,1),2.5,1,0,1,4,1);}}
  addWall(x,z,dx,dz,A){const m=this.effectPool.wall.pop()||new THREE.Mesh(new THREE.PlaneGeometry(140,44,72,40).rotateX(-Math.PI/2),new THREE.ShaderMaterial({uniforms:{uT:{value:0},uH:{value:0},uFade:{value:1}},vertexShader:WALL_VS,fragmentShader:WALL_FS,transparent:true,side:THREE.DoubleSide}));
    m.userData.effectKind='wall';m.material.uniforms.uH.value=0;m.material.uniforms.uFade.value=1;m.rotation.y=Math.atan2(dx,dz);m.frustumCulled=false;this.scene.add(m);this.walls.push({mesh:m,x,z,dx,dz,c:16,A:A||5.6,t0:this.time+1.4,fade:1,hit:false});}
  launchSpine(from,to,dur){const m=new THREE.Mesh(this.spineGeo,this.spineMat);m.castShadow=true;this.scene.add(m);this.projectiles.push({mesh:m,from,to,t0:this.time,dur});}
  // o boss saiu ou entrou na água: onda, lençol d'água e borrifo ao longo de todo o corpo
  surge(power){for(let i=0;i<14;i++){const p=this.toWorld(V(rnd(-2,2),rnd(3,6),rnd(-16,3)));this.drop(p.x,p.z,3,-.45*power,.35*power,.4);this.burst(V(p.x,this.waterH(p.x,p.z),p.z),36,.8*power);}this.ring(this.S.x,this.S.z,2.2*power,9,7);this.curtain=2.6*power;this.sfx('surge',V(this.S.x,0,this.S.z));}
  // ---------------------------------------------------------------- simulação (anfitrião)
  startAttack(name){const k=this.warnK(),S=this.S,b=this.boat;this.attack={name,t:0,k:this.speedK()};const A=this.attack;const toBoat=Math.atan2(b.x-S.x,b.z-S.z),around=(d)=>{const a=Math.random()*6.283;return V(b.x+Math.cos(a)*d,0,b.z+Math.sin(a)*d);};
    if(name==='cruise'){A.dur=rnd(2.8,3.8)/A.k;A.ang=Math.atan2(S.z-b.z,S.x-b.x);A.dir=Math.random()<.5?1:-1;}
    if(name==='ram'||name==='tripleRam'){A.count=name==='tripleRam'?(this.stage>2?4:3):1;A.i=0;this.setupRam(A);}
    if(name==='tail'){A.warn=3.6/k;A.dur=A.warn+1.5;A.heading=toBoat+Math.PI;const tip=V(-.8,2,-17);A.at=V(b.x+b.vx*.35,0,b.z+b.vz*.35);const off=V(tip.x,0,tip.z).applyAxisAngle(V(0,1,0),A.heading);A.pos=A.at.clone().sub(off);this.emit({k:'sfx',n:'growl',x:A.pos.x,y:0,z:A.pos.z});}
    if(name==='emerge'||name==='rage'){A.dur=name==='rage'?4.8:4.6/Math.min(k,1.5);A.pos=around(20);A.heading=Math.atan2(b.x-A.pos.x,b.z-A.pos.z);}
    if(name==='cannon'){A.charge=4/k;A.dur=A.charge+2.2;A.pos=around(24);A.aim=V(b.x,0,b.z);}
    if(name==='whirlpool'){A.dur=6/Math.min(k,1.4);A.c=V(b.x+rnd(-4,4),0,b.z+rnd(-4,4));A.ang=0;}
    if(name==='bite'){A.warn=3.4/k;A.dur=A.warn+2.2;A.at=V(b.x+b.vx*.35,0,b.z+b.vz*.35);A.heading=Math.random()*6.283;}
    if(name==='wall'){A.dur=8.5;const a=Math.random()*6.283;A.dir=V(-Math.cos(a),0,-Math.sin(a));const o=V(b.x,0,b.z).addScaledVector(A.dir,-70);this.emit({k:'wall',x:o.x,z:o.z,dx:A.dir.x,dz:A.dir.z,A:this.stage>2?6.2:5});A.wall=this.walls[this.walls.length-1];}
    if(name==='volley'){A.dur=7;A.pos=around(22);A.heading=Math.atan2(b.x-A.pos.x,b.z-A.pos.z);A.fired=0;}
    if(name==='death'){A.dur=12;}
    this.events.push({k:'attack',name,stage:this.stage});}
  setupRam(A){const b=this.boat,a=Math.random()*6.283,d=this.stage>1?32:38,start=V(b.x+Math.cos(a)*d,0,b.z+Math.sin(a)*d);A.start=start;const lead=V(b.x+b.vx*1.2,0,b.z+b.vz*1.2);A.heading=Math.atan2(lead.x-start.x,lead.z-start.z);A.warn=(A.count>1?3.4:4)/(A.k||1);A.phase=0;A.pt=0;A.len=d*2.2;A.hit=false;}
  // boat: {x,z,vx,vz,heading}. Devolve a lista de eventos para mandar aos outros jogadores.
  simulate(dt,boat){this.events=[];if(!this.alive)return this.events;this.boat=boat;this.time+=dt;if(!this.attack)this.startAttack('cruise');
    const A=this.attack,S=this.S,P=this.P,b=V(boat.x,0,boat.z),k=A.k;A.t+=dt;const t=A.t;let T={y:-4.6,neckA:1,neckB:.5,yawA:0,yawB:0,tailPitch:0,tailYaw:0,lat:.55,vert:.18,gape:.12,headPitch:0,headYaw:0};const E={spine:true};
    const swimTo=(x,z,speed,turn=1.8)=>{const want=Math.atan2(x-S.x,z-S.z),d=clamp(angDiff(want,S.heading),-turn*dt,turn*dt);S.heading+=d;S.turn=damp(S.turn,d/Math.max(dt,1e-3),4,dt);S.speed=damp(S.speed,speed,2,dt);S.x+=Math.sin(S.heading)*S.speed*dt;S.z+=Math.cos(S.heading)*S.speed*dt;};
    const settle=(pos,heading,rate=2)=>{const px=S.x,pz=S.z;S.x=damp(S.x,pos.x,rate,dt);S.z=damp(S.z,pos.z,rate,dt);const d=angDiff(heading,S.heading)*(1-Math.exp(-rate*dt));S.heading+=d;S.turn=damp(S.turn,d/Math.max(dt,1e-3),4,dt);S.speed=Math.hypot(S.x-px,S.z-pz)/Math.max(dt,1e-3);};
    const hitIfNear=(p,r,power)=>{if(Math.hypot(b.x-p.x,b.z-p.z)<r)this.events.push({k:'boatHit',power,x:p.x,z:p.z});};
    switch(A.name){
      case 'cruise':{A.ang+=A.dir*dt*.34*k;const r=22+Math.sin(this.time*.6)*6,goal=V(b.x+Math.cos(A.ang)*r,0,b.z+Math.sin(A.ang)*r);swimTo(goal.x+Math.sin(this.time*1.3)*4,goal.z+Math.cos(this.time*1.1)*4,9*k);T.y=-4.4+Math.sin(this.time*.8)*.5;T.lat=.85;T.vert=.25;T.yawA=clamp(angDiff(Math.atan2(b.x-S.x,b.z-S.z),S.heading)*.5,-.4,.4);break;}
      case 'ram':case 'tripleRam':{if(A.phase===0){settle(A.start,A.heading,1.8);A.pt+=dt;T.y=-6.5;T.lat=.9;
          if(A.pt>=A.warn){A.phase=1;A.pt=0;S.heading=A.heading;this.emit({k:'sfx',n:'roarShort',x:S.x,y:0,z:S.z});}}
        else{A.pt+=dt;S.speed=damp(S.speed,12*k,3,dt);S.x+=Math.sin(S.heading)*S.speed*dt;S.z+=Math.cos(S.heading)*S.speed*dt;T.y=-3.6;T.neckA=.8;T.neckB=.3;T.lat=1.1;T.vert=.35;
          const head=this.headWorld();if(!A.hit&&Math.hypot(head.x-b.x,head.z-b.z)<4.3){A.hit=true;this.events.push({k:'boatHit',power:1.6,x:S.x,z:S.z});this.emit({k:'splash',x:b.x,z:b.z,n:700,p:1.5,col:11,ring:2.2,s:'slam'});}
          if(A.pt*S.speed>A.len){A.i++;if(A.i<A.count)this.setupRam(A);else A.done=true;}}
        E.body=A.phase===1;break;}
      case 'tail':{settle(A.pos,A.heading,2.8);T.y=-3.9;T.neckA=1.1;T.neckB=.6;const up=smooth(0,A.warn,t),slam=smooth(A.warn,A.warn+.18,t),rec=smooth(A.warn+.6,A.dur,t);T.tailPitch=up*1.35*(1-slam)-.2*slam*(1-rec);T.tailYaw=Math.sin(t*6)*.15*(1-slam);T.lat=.3;
        if(t>=A.warn+.18&&!A.boom){A.boom=true;this.emit({k:'splash',x:A.at.x,z:A.at.z,n:1100,p:2,col:22,ring:3.4,c:11,rw:5,s:'slam'});hitIfNear(A.at,4.8,1.35);}
        E.body=true;break;}
      case 'emerge':case 'rage':{const rise=smooth(0,1.1,t),dive=smooth(A.dur-1.1,A.dur,t);settle(A.pos,A.heading,2.4);T.y=lerp(-9,-2.2,rise)*(1-dive)-11*dive;T.neckA=lerp(1.2,-.3,rise)*(1-dive)+1.2*dive;T.neckB=lerp(.6,.45,rise);T.lat=.2;T.vert=.08;
        const roar=t>1.2&&t<A.dur-1.1;T.gape=roar?.7+.08*Math.sin(t*11):.15;T.headPitch=roar?-.35+Math.sin(t*3)*.1:0;T.yawA=roar?Math.sin(t*1.7)*.28:0;T.headYaw=roar?Math.sin(t*2.3)*.2:0;
        if(t>1&&!A.rose){A.rose=true;this.emit({k:'surge',power:1.4});}if(t>1.25&&!A.roared){A.roared=true;this.emit({k:'sfx',n:A.name==='rage'?'roarBig':'roar',x:S.x,y:8,z:S.z});if(A.name==='rage')this.emit({k:'ring',x:S.x,z:S.z,A:3,c:13,w:7});}
        if(t>A.dur-1&&!A.dove){A.dove=true;this.emit({k:'splash',x:S.x,z:S.z,n:900,p:1.8,col:14,ring:2.6,s:'splashBig'});}
        E.eye=roar&&rise>.9;E.mouth=roar;E.gill=roar&&this.stage>1;E.body=rise>.5&&dive<.5;break;}
      case 'cannon':{const rise=smooth(0,.8,t),dive=smooth(A.dur-.8,A.dur,t);settle(A.pos,Math.atan2(b.x-A.pos.x,b.z-A.pos.z),2.2);T.y=lerp(-9,-2.4,rise)*(1-dive)-11*dive;T.neckA=lerp(1.2,-.1,rise)*(1-dive)+1.2*dive;T.neckB=.35;
        const head=this.headWorld();T.yawA=clamp(angDiff(Math.atan2(b.x-head.x,b.z-head.z),S.heading)*.8,-.7,.7);const ch=clamp(t/A.charge);T.gape=.25+ch*.6;T.headPitch=.2*ch;if(t<A.charge-2.2){A.aim.set(b.x+boat.vx*.3,0,b.z+boat.vz*.3);}
        if(t===dt||!A.charging){A.charging=true;this.emit({k:'sfx',n:'charge',x:S.x,y:6,z:S.z});}
        if(t>A.charge&&!A.fired){A.fired=true;const from=this.rig.head.localToWorld(V(0,-.2,3.4));this.emit({k:'beam',from:from.toArray().map(v=>+v.toFixed(2)),to:[+A.aim.x.toFixed(2),0,+A.aim.z.toFixed(2)]});this.emit({k:'splash',x:A.aim.x,z:A.aim.z,n:1100,p:2,col:26,ring:3,c:12,s:'cannon'});hitIfNear(A.aim,4.5,1.5);}
        E.eye=rise>.9&&dive<.2;E.mouth=t<A.charge+.2&&rise>.8;E.gill=E.eye;E.body=rise>.6&&dive<.5;break;}
      case 'whirlpool':{A.ang+=dt*2.6;const r=11,goal=V(A.c.x+Math.cos(A.ang)*r,0,A.c.z+Math.sin(A.ang)*r);swimTo(goal.x,goal.z,20,4);T.y=-5;T.lat=1.1;T.vert=.3;const kk=smooth(0,1.2,t)*(1-smooth(A.dur-.4,A.dur,t));this.pull={x:A.c.x,z:A.c.z,s:(this.stage>2?1.3:1)*kk};
        if(t>A.dur-.05&&!A.chain){A.chain=true;this.pull=null;this.forceNext='cruise';}break;}
      case 'bite':{const burst=A.warn,up=smooth(burst,burst+.3,t),back=smooth(burst+1.1,A.dur,t);T.neckA=lerp(-.7,.9,back);T.neckB=lerp(.1,.5,back);T.gape=up>0?lerp(.95,.2,back):.1;T.headPitch=-.3*(1-back);T.y=t<burst?-18:lerp(-18,-4,up)*(1-back)-13*back;T.lat=.1;
        const hl=bendCPU(V(0,10,4.3),{...P,neckA:T.neckA,neckB:T.neckB}),off=V(hl.x,0,hl.z).applyAxisAngle(V(0,1,0),A.heading);S.x=A.at.x-off.x;S.z=A.at.z-off.z;S.heading=A.heading;S.speed=0;
        if(t>=burst&&!A.boom){A.boom=true;this.emit({k:'splash',x:A.at.x,z:A.at.z,n:1200,p:2.1,col:24,ring:3.2,c:12,s:'bite'});hitIfNear(A.at,3.8,1.5);}
        E.eye=up>.8&&back<.5;E.mouth=up>.5&&back<.4;E.gill=E.eye;E.body=E.eye;break;}
      case 'wall':{const w=A.wall;T.y=t<1.6?-4.5:-11;if(w&&t<1.6)swimTo(w.x,w.z,14);if(w){const age=this.time-w.t0,s=(b.x-w.x)*w.dx+(b.z-w.z)*w.dz,front=w.c*age;if(age>=0&&!w.hit&&Math.abs(s-front)<3&&Math.abs(-(b.x-w.x)*w.dz+(b.z-w.z)*w.dx)<65){w.hit=true;const face=Math.abs(angDiff(boat.heading,Math.atan2(-w.dx,-w.dz)));this.events.push({k:face>.95?'boatHit':'boatRide',power:2,x:b.x-w.dx*5,z:b.z-w.dz*5});}}break;}
      case 'volley':{settle(A.pos,A.heading,2);const rise=smooth(0,1,t),dive=smooth(A.dur-1,A.dur,t);T.y=lerp(-8,-3,rise)*(1-dive)-11*dive;T.neckA=lerp(1.1,.25,rise)*(1-dive)+1.1*dive;T.neckB=.6;T.lat=.25;T.tailPitch=.45*rise*(1-dive);T.vert=.4*rise*Math.sin(t*8);
        const wave=Math.floor((t-2)/1.6);if(t>2&&wave<3&&wave>=A.fired){A.fired++;this.emit({k:'sfx',n:'volley',x:S.x,y:5,z:S.z});for(let i=0;i<6;i++){const at=V(b.x+rnd(-6,6),0,b.z+rnd(-6,6));if(i<1)at.set(b.x+boat.vx*.6+rnd(-2,2),0,b.z+boat.vz*.6+rnd(-2,2));const from=this.toWorld(V(0,5.6,-3-i*1.6));this.emit({k:'spine',from:from.toArray().map(v=>+v.toFixed(2)),to:[+at.x.toFixed(2),0,+at.z.toFixed(2)],dur:1.8});A.spikes=(A.spikes||[]).concat([{at,t:this.time+1.8}]);}}
        for(const sp of A.spikes||[])if(!sp.done&&this.time>=sp.t){sp.done=true;hitIfNear(sp.at,1.6,.7);}
        E.body=rise>.5&&dive<.5;E.eye=rise>.9&&dive<.2;E.gill=E.eye;break;}
      case 'death':{const sink=smooth(1.2,11,t);T.y=lerp(-2.4,-18,sink);T.neckA=lerp(-.2,1.4,smooth(0,4,t));T.gape=.55*(1-sink);S.roll=damp(S.roll,1.45,.6,dt);S.speed=0;T.lat=.15*(1-sink);
        if(!A.boom&&t>1.4){A.boom=true;this.emit({k:'splash',x:S.x,z:S.z,n:1500,p:2.4,col:18,ring:3.6,c:10,rw:8,s:'splashBig'});}if(t>A.dur){A.done=true;this.events.push({k:'finished'});}break;}
    }
    // pose suavizada; pescoço com mola (atrasa nas curvas e passa do ponto)
    const r=A.name==='bite'?16:3.4;S.y=damp(S.y,T.y,r,dt);for(const key of Object.keys(T))if(key!=='y'&&key in P)P[key]=damp(P[key],T[key],key==='tailPitch'&&A.name==='tail'?10:key==='gape'?7:key==='neckA'&&A.name==='bite'?14:3.2,dt);
    this.exposed=E;this.redK=damp(this.redK,this.stage>2&&A.name!=='death'?1:0,.5,dt);
    if(A.done||(A.dur&&t>=A.dur&&A.name!=='death')){this.pull=null;if(A.name==='death'){this.alive=false;return this.events;}this.startAttack(this.nextAttack());}
    return this.events;}
  // ---------------------------------------------------------------- dano (anfitrião)
  damage(zone,k=1){if(!this.alive||this.dead)return null;const Z=ZONES[zone];if(!Z)return null;this.hp=Math.max(0,this.hp-BASE_DMG*Z.mult*k);const ev=[];
    if(this.stage<3&&this.hp/MAX_HP<=STAGE_AT[this.stage]){this.stage++;this.cursor=0;this.forceNext='rage';ev.push({k:'stage',n:this.stage});}
    if(this.hp<=0&&!this.dead){this.dead=true;this.forceNext='death';this.attack.done=true;ev.push({k:'dying'});}return ev;}
  // raio de tiro (mundo): devolve a parte atingida acima da água
  raycast(ray,far=220){if(!this.alive||this.dead)return null;let best=null;const test=(c,r,zone)=>{/* acertável também debaixo d'água */const oc=c.clone().sub(ray.origin),tc=oc.dot(ray.direction);if(tc<0||tc>far)return;const d2=oc.lengthSq()-tc*tc;if(d2>r*r)return;const t=tc-Math.sqrt(r*r-d2);if(!best||t<best.t)best={t,zone,point:ray.origin.clone().addScaledVector(ray.direction,t)};};
    const E=this.exposed;const head=this.rig.head;for(const e of this.rig.eyes)test(head.localToWorld(e.clone()),.55,'eye');if(this.P.gape>.35)test(head.localToWorld(V(0,-.3,2.4)),.9,'mouth');test(head.localToWorld(V(0,.2,1.6)),1.2,'body');
    for(const s of [-1,1])test(this.toWorld(V(s*1.05,5.3,.6)),.95,'gill');for(let i=2;i<SPINE.length-1;i++){const p=V(...SPINE[i]);test(this.toWorld(p),RADII[i]*1.05,'body');if(i<7)test(this.toWorld(p.clone().add(V(0,RADII[i]+.5,0))),.9,'spine');}
    if(best&&best.zone==='gill'&&!E.gill)best.zone='body';return best;}
  // ---------------------------------------------------------------- desenho e água contínua (todos)
  render(dt,{camera=null,remote=false}={}){if(this.alive)for(const [l,a] of this.lightPairs)a.getWorldPosition(l.position);if(!this.alive&&!this.fx.length&&!this.projectiles.length&&!this.walls.length){U.uBoss.value.w=damp(U.uBoss.value.w,0,3,dt);U.uBossFoam.value=damp(U.uBossFoam.value,0,3,dt);return;}
    if(remote){this.time+=dt;const n=this.target;if(n){const S=this.S,[x,z,y,h,roll,pitch,sp]=n.s;S.x=damp(S.x,x,8,dt);S.z=damp(S.z,z,8,dt);S.y=damp(S.y,y,8,dt);S.heading+=angDiff(h,S.heading)*(1-Math.exp(-8*dt));S.roll=damp(S.roll,roll,4,dt);S.speed=sp;
        const keys=['lat','vert','neckA','yawA','neckB','yawB','tailYaw','tailPitch','gape','headPitch','headYaw'];keys.forEach((k,i)=>this.P[k]=damp(this.P[k],n.p[i],10,dt));this.redK=damp(this.redK,n.st>2&&n.a!=='death'?1:0,.5,dt);}}
    const warning=remote?(this.target?.v||[]):this.warningData();
    this.warningMarkers.forEach((m,i)=>{const w=warning[i];m.visible=this.alive&&!!w;if(!m.visible)return;m.position.set(w[0],this.waterH(w[0],w[1])+.18,w[1]);m.scale.set(w[2],1,w[2]);m.material.opacity=.35+.35*clamp(w[3]);m.material.color.setHex(w[3]>.7?0xff7755:0xffd18a);});
    const S=this.S,P=this.P,t=this.time;
    if(this.alive){P.phase-=dt*(2.2+S.speed*.32);P.k=.38;
      // corpo inclina nas curvas e ao subir/descer
      S.pitch=damp(S.pitch,clamp((S.y-(this.prevY??S.y))/Math.max(dt,1e-3)*-.05,-.35,.35),3,dt);this.prevY=S.y;
      this.root.position.set(S.x,S.y+this.waves(S.x,S.z,t)*.5,S.z);this.root.rotation.set(S.pitch,S.heading,S.roll-clamp(S.turn*.35,-.4,.4),'YXZ');this.root.updateMatrixWorld(true);
      this.rig.apply(P,t,clamp(S.speed/18,0,1.3));}
    // olhos: âmbar → laranja → vermelho EXTREMAMENTE brilhante no estágio 3
    const st=this.stage,dying=this.attack?.name==='death'?clamp(1-this.attack.t/6):1,pulse=.85+.15*Math.sin(t*(st>2?11:5)),col=st===1?[9,4.5,.8]:st===2?[18,5,1]:[60,3.4,1.8],size=st===1?1.3:st===2?1.9:2.8;
    for(const e of this.eyeFX){e.core.material.color.setRGB(col[0]*pulse*dying,col[1]*pulse*dying,col[2]*pulse*dying);e.halo.material.color.setRGB(col[0]*.1*dying,col[1]*.1*dying,col[2]*.1*dying);e.halo.scale.setScalar(size*(1+(st>2?.25*Math.sin(t*23):0)));e.light.color.setRGB(1,st>2?.1:.35,.05);e.light.intensity=(st===1?5:st===2?12:36)*pulse*dying;}
    const charging=this.attack?.name==='cannon'&&this.attack.t<(this.attack.charge||1.5);const ch=charging?clamp(this.attack.t/(this.attack.charge||1.5)):0;this.throat.intensity=damp(this.throat.intensity,ch*45,8,dt);this.throatGlow.material.opacity=damp(this.throatGlow.material.opacity,ch,8,dt);
    const now=U.uTime.value;
    if(this.alive)this.water(dt,now);
    if(st>2&&this.alive&&this.headWorld().y>0&&Math.random()<dt*30)for(const e of this.eyeFX){const p=e.g.getWorldPosition(V());this.embers.emit(now,p.x,p.y,p.z,rnd(-.4,.4),rnd(.2,1.2),rnd(-.4,.4),.7,1.5,-.2,.22,.02,0);}
    if(charging&&Math.random()<dt*60){const m=this.rig.head.localToWorld(V(0,-.3,2.6));this.embers.emit(now,m.x+rnd(-1,1),m.y+rnd(-1,1),m.z+rnd(-1,1),rnd(-1,1),rnd(0,1),rnd(-1,1),.6,1,-.1,.35,.05,0);this.mist.emit(now,m.x,m.y,m.z,rnd(-2,2),rnd(-1,1),rnd(-2,2),.8,2,0,.5,1.5,0);}
    // colunas, jato, espinhos, muralhas
    for(const f of [...this.fx]){const age=this.time-f.t0,k=age/f.life,u=f.obj.material.uniforms;u.uT.value=this.time;if(f.kind==='column'){u.uH.value=f.h*smooth(0,.28,age)*(1-smooth(1,2.6,age)*.75);u.uAge.value=smooth(.6,2.8,age);u.uFade.value=1-smooth(1.6,f.life,age);
        if(age>.35&&age<2.2)for(let i=0;i<14;i++){const a=Math.random()*6.283,r=1.8*f.power;this.spray.emit(now,f.p.x+Math.cos(a)*r,f.h*rnd(.45,1)*(1-smooth(1,2.6,age)*.6),f.p.z+Math.sin(a)*r,Math.cos(a)*rnd(1,5),rnd(-2,1),Math.sin(a)*rnd(1,5),1.8,.4,1,.35,1.1,1);}}
      else u.uFade.value=1-k;if(k>=1){this.clearEffect(f.obj);this.fx.splice(this.fx.indexOf(f),1);}}
    for(const p of [...this.projectiles]){const k=(this.time-p.t0)/p.dur;if(k<1){const pos=p.from.clone().lerp(p.to,k);pos.y+=Math.sin(k*Math.PI)*15;const k2=Math.min(1,k+.02),nx=p.from.clone().lerp(p.to,k2);nx.y+=Math.sin(k2*Math.PI)*15;p.mesh.position.copy(pos);p.mesh.lookAt(nx);if(Math.random()<.5)this.mist.emit(now,pos.x,pos.y,pos.z,0,0,0,.8,2,0,.3,1.2,1);}
      else{this.scene.remove(p.mesh);this.projectiles.splice(this.projectiles.indexOf(p),1);const h=this.waterH(p.to.x,p.to.z);this.burst(V(p.to.x,h,p.to.z),160,.8);this.drop(p.to.x,p.to.z,1.6,.35,.2,.6);this.sfx('spineHit',p.to);}}
    for(const w of [...this.walls]){const age=this.time-w.t0,front=w.c*Math.max(0,age);w.mesh.position.set(w.x+w.dx*front,-.6,w.z+w.dz*front);w.mesh.material.uniforms.uH.value=w.A*smooth(-1.4,0,age)*w.fade;w.mesh.material.uniforms.uT.value=this.time;
      if(age>0){for(let i=0;i<22;i++){const lat=rnd(-62,62),x=w.x+w.dx*front-w.dz*lat,z=w.z+w.dz*front+w.dx*lat;this.spray.emit(now,x,this.waves(x,z,t)+w.A*.8*w.fade,z,w.dx*w.c*.9,rnd(1,5),w.dz*w.c*.9,1.4,.5,1,.5,1.6,1);if(i%11===0)this.mist.emit(now,x,w.A*w.fade,z,w.dx*w.c*.6,rnd(1,3),w.dz*w.c*.6,3,1,.02,2,8,1);}if(Math.random()<.6)this.drop(w.x+w.dx*front+rnd(-45,45)*-w.dz,w.z+w.dz*front+rnd(-45,45)*w.dx,5,-.5,.7,.4);}
      if(age>8){w.fade=damp(w.fade,0,2,dt);if(w.fade<.02){this.clearEffect(w.mesh);this.walls.splice(this.walls.indexOf(w),1);}}}
    this.rings=this.rings.filter(r=>this.time-r.t0<14);
    // sombra gigante sob a água e espuma presa à silhueta
    U.uBoss.value.set(S.x,S.z,S.heading,this.alive?clamp((-S.y-1)/6,0,1)*.9+.25:damp(U.uBoss.value.w,0,2,dt));U.uBossFoam.value=this.alive?clamp(1-Math.abs(S.y+4)/4,0,1)*clamp(.3+S.speed/14,0,1.2):0;
    this.spray.flush();this.mist.flush();this.foam.flush();this.embers.flush();this.updateDrone(dt,camera);}
  // a água reage ao corpo o tempo todo: onde a pele cruza a superfície há esteira, borrifo, espuma e ondas na simulação
  water(dt,now){const S=this.S,pts=[];for(let i=0;i<SPINE.length;i++){const p=this.toWorld(V(...SPINE[i]));pts.push(p);}
    if(this.prevPts){for(let i=0;i<pts.length;i++){const p=pts[i],q=this.prevPts[i],vx=(p.x-q.x)/Math.max(dt,1e-3),vy=(p.y-q.y)/Math.max(dt,1e-3),vz=(p.z-q.z)/Math.max(dt,1e-3),sp=Math.hypot(vx,vz),r=RADII[i],h=this.waterH(p.x,p.z),d=p.y-h,top=d+r,bot=d-r;
      // corpo cortando a superfície: quanto mais rápido, mais água sobe
      if(top>-.4&&bot<.4){const e=clamp(sp/10,0,2.5)+clamp(Math.abs(vy)/4,0,2);const n=Math.round(e*r*dt*90);for(let j=0;j<n;j++){const a=Math.atan2(vx,vz)+rnd(-1.6,1.6),side=r*rnd(.8,1.3);this.spray.emit(now,p.x+Math.sin(a)*side,h,p.z+Math.cos(a)*side,Math.sin(a)*rnd(1,4)*e+vx*.3,rnd(1.5,5)*(.6+e*.6),Math.cos(a)*rnd(1,4)*e+vz*.3,rnd(.9,1.8),.7,1,rnd(.2,.5),rnd(.6,1.4),1);}
        if(Math.random()<dt*20*e)this.foam.emit(now,p.x+rnd(-r,r),h+.05,p.z+rnd(-r,r),vx*.1,0,vz*.1,rnd(2.5,4.5),1.2,0,rnd(.8,1.4),rnd(2.5,4),.3);
        if(e>1.2&&Math.random()<dt*4)this.mist.emit(now,p.x,h+1,p.z,vx*.2,rnd(1,2),vz*.2,rnd(2,3.5),1,.02,1.5,6,1);}
      // atravessando a superfície com força (subindo ou mergulhando): estouro
      const pd=q.y-this.waterH(q.x,q.z);if(Math.sign(pd)!==Math.sign(d)&&Math.abs(vy)>3.5&&r>.5){this.burst(V(p.x,h,p.z),Math.round(30+Math.abs(vy)*12),clamp(Math.abs(vy)/8,.5,1.8));}
      // pele escorrendo quando está acima da água
      if(bot>.6&&Math.random()<dt*(this.curtain>0?60:6)*r)this.spray.emit(now,p.x+rnd(-r,r)*.8,p.y-r*.6,p.z+rnd(-r,r)*.8,rnd(-.5,.5),rnd(-1,0),rnd(-.5,.5),1.4,.25,1,.18,.45,0);}
      // ondas na simulação: alguns pontos por quadro, fortes quando rápido ou atravessando
      for(let c=0;c<4;c++){const i=this.dropCursor++%pts.length,p=pts[i],q=this.prevPts[i],r=RADII[i],h=this.waterH(p.x,p.z),d=p.y-h;if(d+r<-1.2||d-r>1.2||r<.4)continue;const sp=Math.hypot(p.x-q.x,p.z-q.z)/Math.max(dt,1e-3),vy=(p.y-q.y)/Math.max(dt,1e-3);this.drop(p.x,p.z,r*1.6,.04+sp*.012+Math.abs(vy)*.03,.02+sp*.008,clamp(sp/45,.04,.3));}
      // onda de proa: a água que o corpo empurra chega no barco (ondas analíticas a cada ~0,35 s quando rápido)
      if(S.speed>9&&S.y>-6){this.bowT=(this.bowT||0)-dt;if(this.bowT<=0){this.bowT=.35;const hp=pts[6];this.rings.push({x:hp.x,z:hp.z,A:clamp(S.speed/16,.3,1.6),c:9,w:3.5,t0:this.time});if(this.rings.length>16)this.rings.shift();}}}
    this.prevPts=pts;this.curtain=Math.max(0,(this.curtain||0)-dt);}
  // ---------------------------------------------------------------- sons do boss
  sfx(name,pos){const s=this.sound;if(!s?.ctx)return;const c=s.ctx,t=c.currentTime;
    const layer=(type,f0,f1,dur,g,{formants=null,am=0,lp=[300,1600,200],dist=3,attack=.12}={})=>{const o=c.createOscillator(),o2=c.createOscillator(),ws=c.createWaveShaper(),a=c.createGain(),f=c.createBiquadFilter(),out=s.out(pos,.65);const curve=new Float32Array(512);for(let i=0;i<512;i++){const x=i/256-1;curve[i]=Math.tanh(x*dist);}ws.curve=curve;
      o.type=type;o2.type='sawtooth';o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(f1,t+dur);o2.frequency.setValueAtTime(f0*1.013,t);o2.frequency.exponentialRampToValueAtTime(f1*.987,t+dur);
      if(am){const l=c.createOscillator(),lg=c.createGain();l.frequency.value=am;lg.gain.value=f0*.3;l.connect(lg).connect(o.frequency);l.start(t);l.stop(t+dur+.1);}
      o.connect(ws);o2.connect(ws);let node=ws;if(formants){const sum=c.createGain();for(const [ff,q,gg]of formants){const bp=c.createBiquadFilter(),bg=c.createGain();bp.type='bandpass';bp.frequency.value=ff;bp.Q.value=q;bg.gain.value=gg;ws.connect(bp).connect(bg).connect(sum);}node=sum;}
      f.type='lowpass';f.frequency.setValueAtTime(lp[0],t);f.frequency.linearRampToValueAtTime(lp[1],t+dur*.25);f.frequency.exponentialRampToValueAtTime(lp[2],t+dur);f.Q.value=2;node.connect(f).connect(a).connect(out);
      a.gain.setValueAtTime(.0001,t);a.gain.exponentialRampToValueAtTime(g,t+attack);a.gain.setValueAtTime(g,t+dur*.55);a.gain.exponentialRampToValueAtTime(.0001,t+dur);o.start(t);o2.start(t);o.stop(t+dur+.1);o2.stop(t+dur+.1);};
    const roar=(scale,len)=>{layer('sawtooth',78*scale,36*scale,len,.55,{am:27,lp:[250,1100,150],dist:4});layer('sawtooth',165*scale,92*scale,len*.92,.35,{formants:[[680,5,1],[1150,6,.7],[2600,8,.35]],am:9,lp:[900,3400,400],attack:.2});
      layer('square',330*scale,210*scale,len*.7,.12,{formants:[[2400,4,1],[3600,5,.6]],am:41,lp:[2000,5000,1200],attack:.3});s.tone(34*scale,{type:'sine',dur:len,gain:.9,to:22,pos,attack:.2});
      s.burst(s.pink,{type:'bandpass',freq:500,to:1400,q:.9,dur:len,attack:.25,gain:.9,pos,reverb:.8});s.burst(s.brown,{type:'lowpass',freq:260,dur:len*1.1,attack:.3,gain:1.1,pos,reverb:.6});
      for(let i=0;i<12;i++)s.burst(s.white,{type:'bandpass',freq:rnd(1500,3500),q:3,dur:.08,gain:.12,pos,when:rnd(.2,len*.8),reverb:.4});};
    if(name==='roar')roar(1,3.4);if(name==='roarBig'){roar(.85,4.6);roar(1.3,3.8);}if(name==='roarShort')roar(1.1,1.5);if(name==='growl')layer('sawtooth',62,44,1.8,.4,{am:18,lp:[180,500,120],dist:5});
    if(name==='wail'){roar(.9,6);layer('sawtooth',220,55,6,.3,{formants:[[700,6,1],[1100,7,.6]],lp:[1400,2600,300]});}
    if(name==='eyeHit'){layer('square',520,260,.9,.25,{formants:[[2200,5,1],[3400,6,.5]],am:33,lp:[3000,6000,1500],attack:.02});s.tone(2400,{type:'square',dur:.06,gain:.08,reverb:0});}
    if(name==='slam'||name==='splashBig'||name==='bite'||name==='cannon'){s.burst(s.brown,{type:'lowpass',freq:1400,to:50,dur:3,attack:.003,gain:1.6,pos,reverb:.8});s.burst(s.white,{type:'bandpass',freq:2000,to:280,q:.5,dur:2.2,attack:.01,gain:1.1,pos,reverb:.7});s.tone(48,{type:'sine',dur:1.6,gain:1,to:22,pos});s.tone(95,{type:'triangle',dur:.4,gain:.5,to:40,pos});
      for(let i=0;i<24;i++)s.tone(rnd(700,2600),{type:'sine',dur:.05,gain:.05,to:300,pos,when:rnd(.3,2.2)});for(let i=0;i<10;i++)s.burst(s.pink,{type:'bandpass',freq:rnd(600,1400),q:2,dur:.3,gain:.18,pos,when:rnd(.4,2.5),reverb:.5});
      if(name==='bite'){roar(1.2,1.4);s.burst(s.white,{type:'highpass',freq:3000,dur:.06,attack:.001,gain:.8,pos});}if(name==='cannon')s.burst(s.pink,{type:'bandpass',freq:300,to:3500,q:1,dur:.6,attack:.01,gain:1,pos});}
    if(name==='charge'){s.burst(s.pink,{type:'bandpass',freq:180,to:2800,q:3,dur:1.6,attack:1.4,gain:.5,pos,reverb:.5});s.tone(70,{type:'sawtooth',dur:1.6,gain:.14,to:380,attack:1.3,pos});layer('sawtooth',90,180,1.6,.2,{am:14,lp:[200,900,700],attack:1});}
    if(name==='surge'){s.burst(s.brown,{type:'lowpass',freq:700,to:100,dur:3,attack:.35,gain:1.4,pos,reverb:.7});s.burst(s.white,{type:'lowpass',freq:3500,to:500,dur:2.8,attack:.2,gain:.7,pos,reverb:.6});for(let i=0;i<30;i++)s.tone(rnd(500,2200),{type:'sine',dur:.05,gain:.04,to:250,pos,when:rnd(.5,3)});}
    if(name==='volley')for(let i=0;i<6;i++)s.burst(s.pink,{type:'bandpass',freq:500,to:2600,q:2,dur:.4,attack:.02,gain:.4,pos,when:i*.06});
    if(name==='spineHit'){s.burst(s.white,{type:'bandpass',freq:1600,to:400,q:.8,dur:.6,gain:.5,pos,reverb:.4});s.burst(s.brown,{type:'lowpass',freq:400,dur:.3,gain:.5,pos});}}
  // ronco grave constante e água correndo, mais alto quanto mais perto e mais rápido
  updateDrone(dt,camera){const s=this.sound;if(!s?.ctx||!camera)return;const c=s.ctx;if(!this.drone&&this.alive){const p=c.createPanner();p.panningModel='HRTF';p.distanceModel='inverse';p.refDistance=10;p.rolloffFactor=1;p.connect(s.bus);
      const rum=c.createBufferSource(),rf=c.createBiquadFilter(),rg=c.createGain();rum.buffer=s.brown;rum.loop=true;rf.type='lowpass';rf.frequency.value=140;rg.gain.value=0;rum.connect(rf).connect(rg).connect(p);rum.start();
      const rush=c.createBufferSource(),wf=c.createBiquadFilter(),wg=c.createGain();rush.buffer=s.pink;rush.loop=true;wf.type='bandpass';wf.frequency.value=900;wf.Q.value=.6;wg.gain.value=0;rush.connect(wf).connect(wg).connect(p);rush.start();
      const sub=c.createOscillator(),sg=c.createGain();sub.frequency.value=31;sg.gain.value=0;sub.connect(sg).connect(p);sub.start();this.drone={p,rg,wg,sg,nodes:[rum,rush,sub]};}
    if(!this.drone)return;const d=this.drone,S=this.S,T=c.currentTime,near=this.alive?1:0;d.p.positionX.setTargetAtTime(S.x,T,.1);d.p.positionY.setTargetAtTime(0,T,.1);d.p.positionZ.setTargetAtTime(S.z,T,.1);
    d.rg.gain.setTargetAtTime(near*(.5+S.speed*.04),T,.3);d.wg.gain.setTargetAtTime(near*clamp(S.speed/20,0,1.3)*(S.y>-7?1:.3),T,.2);d.sg.gain.setTargetAtTime(near*.35,T,.4);if(!this.alive)this.stopDrone();for(const m of this.warningMarkers)m.visible=false;}
  stopDrone(){if(!this.drone)return;for(const n of this.drone.nodes)try{n.stop();}catch{}this.drone=null;}
}
// ------------------------------------------------------------------ trilha de batalha: taikos, cordas, metais, coro e trompas
const NOTE=m=>440*Math.pow(2,(m-69)/12);
export class BattleMusic {
  constructor(sound){const ctx=this.ctx=sound.ctx;this.out=ctx.createGain();this.out.gain.value=0;const comp=ctx.createDynamicsCompressor();comp.threshold.value=-18;comp.ratio.value=4;this.out.connect(comp).connect(sound.bus);const rv=ctx.createGain();rv.gain.value=.55;this.out.connect(rv).connect(sound.revSend);
    const len=ctx.sampleRate*1.5,b=ctx.createBuffer(1,len,ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;this.noise=b;this.step=0;this.next=ctx.currentTime+.15;this.stage=1;this.on=false;}
  set playing(v){this.on=v;this.out.gain.setTargetAtTime(v?.62:0,this.ctx.currentTime,v?.4:1.2);if(v)this.next=Math.max(this.next,this.ctx.currentTime+.05);}
  env(g,t,a,p,dec){g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(p,t+a);g.gain.exponentialRampToValueAtTime(.0001,t+a+dec);}
  osc(type,f,t,dur,peak,{to=null,filter=null,q=1,attack=.005,detune=0}={}){const c=this.ctx,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(f,t);o.detune.value=detune;if(to)o.frequency.exponentialRampToValueAtTime(to,t+dur*.6);let n=o;if(filter){const fl=c.createBiquadFilter();fl.type='lowpass';fl.Q.value=q;fl.frequency.setValueAtTime(filter[0],t);fl.frequency.exponentialRampToValueAtTime(filter[1],t+dur);n.connect(fl);n=fl;}n.connect(g).connect(this.out);this.env(g,t,attack,peak,dur);o.start(t);o.stop(t+attack+dur+.05);}
  hiss(t,dur,peak,type,freq,q=1,attack=.002){const c=this.ctx,s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=this.noise;f.type=type;f.frequency.value=freq;f.Q.value=q;s.connect(f).connect(g).connect(this.out);this.env(g,t,attack,peak,dur);s.start(t,Math.random());s.stop(t+attack+dur+.05);}
  taiko(t,f,g){this.osc('sine',f,t,.5,g,{to:f*.42});this.osc('triangle',f*1.5,t,.12,g*.3,{to:f*.6});this.hiss(t,.18,g*.35,'lowpass',320);}
  hit(){if(!this.on)return;const t=this.ctx.currentTime+.01;this.hiss(t,2.4,.45,'highpass',4200);this.taiko(t,70,1.1);this.osc('sawtooth',NOTE(38),t,1.6,.2,{filter:[1600,200]});this.osc('sawtooth',NOTE(45),t,1.6,.16,{filter:[1600,200]});}
  riser(){if(!this.on)return;const t=this.ctx.currentTime+.01;this.hiss(t,1.6,.3,'bandpass',600,2,1.4);for(let i=0;i<8;i++)this.taiko(t+i*.14,110+i*8,.25+i*.06);}
  tick(){if(!this.on)return;const c=this.ctx,S=this.stage,bpm=[0,138,150,166][S],st=60/bpm/4;
    const prog=S<3?[[38,[62,65,69]],[34,[58,62,65]],[36,[60,64,67]],[33,[57,61,64]]]:[[38,[62,65,69]],[34,[58,62,65]],[31,[55,58,62]],[33,[57,61,64]]];
    const theme=[74,-1,72,74,77,-1,76,74,72,-1,69,70,69,-1,-1,-1,74,-1,72,74,79,-1,77,76,74,-1,76,77,73,-1,-1,-1];
    while(this.next<c.currentTime+.2){const t=this.next,s=this.step++,b=s%16,bar=Math.floor(s/16),[root,ch]=prog[bar%4];this.next+=st;
      // conjunto de taikos: grave, médio e agudo em padrões cruzados
      if([1,0,0,1,0,0,1,0,1,0,0,1,0,1,1,0][b])this.taiko(t,S>2?94:84,.95);
      if(S>1&&[0,0,1,0,0,1,0,0,0,0,1,0,1,0,0,1][b])this.taiko(t,150,.5);
      if(S>2&&b%2===1)this.taiko(t,210,.22);
      if(b===4||b===12){this.hiss(t,.22,.45,'bandpass',1800,.7);this.osc('triangle',220,t,.1,.22,{to:150});}
      this.hiss(t,.04,b%4===2?.1:.05,'highpass',8000);
      if(bar%4===3&&b>=8)this.taiko(t,[180,160,150,140,130,120,110,100][b-8],.5);
      // baixo em colcheias e cordas em semicolcheias (duas vozes desafinadas)
      if(b%2===0){const n=[root,root,root+12,root,root+3,root,root+7,root+5][(b/2)|0];this.osc('sawtooth',NOTE(n),t,st*1.9,.22,{filter:[1000,160],q:5});this.osc('square',NOTE(n-12),t,st*1.9,.08,{filter:[400,90]});}
      const arp=ch[[0,1,2,1,0,2,1,2][b%8]]+(b>=8?12:0);this.osc('sawtooth',NOTE(arp),t,st*.9,.07,{filter:[3000,900],q:2,detune:-7});this.osc('sawtooth',NOTE(arp),t,st*.9,.055,{filter:[3000,900],q:2,detune:8});
      // metais em acordes no tempo 1 e na síncope; coro sustentado; trompas com o tema
      if(b===0||b===10||(S>2&&b===6)){for(const n of [root+12,root+19,root+24])this.osc('sawtooth',NOTE(n),t,b===0?1:.4,S>1?.1:.06,{filter:[450,2800],attack:.06});}
      if(b===0)for(const n of ch)for(const [f,g]of [[640,1],[1100,.7],[2500,.25]]){const o=c.createOscillator(),bp=c.createBiquadFilter(),gg=c.createGain(),v=c.createOscillator(),vg=c.createGain();o.type='sawtooth';o.frequency.value=NOTE(n-12);v.frequency.value=5;vg.gain.value=3;v.connect(vg).connect(o.detune);bp.type='bandpass';bp.frequency.value=f;bp.Q.value=7;o.connect(bp).connect(gg).connect(this.out);const peak=(S>2?.07:S>1?.05:.03)*g;gg.gain.setValueAtTime(.0001,t);gg.gain.exponentialRampToValueAtTime(peak,t+.9);gg.gain.exponentialRampToValueAtTime(.0001,t+st*16);o.start(t);v.start(t);o.stop(t+st*16+.1);v.stop(t+st*16+.1);}
      if(S>1&&b%2===0){const m=theme[((s/2)|0)%32];if(m>0){this.osc('sawtooth',NOTE(m-12),t,st*2.2,.1,{filter:[2400,900],attack:.03});this.osc('triangle',NOTE(m-24),t,st*2.2,.1);}}
      if(S>2&&b%1===0)this.osc('sawtooth',NOTE(ch[2]+24),t,st*.5,.025,{filter:[5000,3000]});
      if(bar%8===7&&b===15)this.hiss(t,1.2,.25,'highpass',5000,1,.8);}}
}

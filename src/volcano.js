import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {Kit,limb,ellipsoid,box,sculpt,paint,loft,reseed,rand,V,hollow} from './geometry.js';
import {sway,palm,broadTree,bush,rock} from './island.js';
import {U} from './shaders.js';

// ======================================================================================================
// Ilha do Vulcão: sem civilização. Praias de areia preta, selva fechada, um rio navegável que leva à lagoa,
// trilhas no mato, a cratera acesa e o Templo do Coração do Vulcão (armadilhas e puzzles lá embaixo).
// Fica longe, na direção em que a doca de Laguna aponta (-z). Coordenadas locais: u = x-VOLCANO.x, v = z-VOLCANO.z.
// O chão tem vários níveis (terreno, pirâmide, ponte, salas subterrâneas): ground(x,z,y) devolve o piso mais alto
// que está até 0,6 m acima dos pés. Sem y, devolve a superfície de cima.
// ======================================================================================================
export const VOLCANO={x:0,z:-760,size:460};
export const TEMPLE={u:-22,v:30,y0:12};
const TIER=[20,15,10],TOP=TEMPLE.y0+15;
// quatro níveis subterrâneos, 6 m um abaixo do outro; cada nível é um puzzle e um portão de pedra libera a escada do próximo
const L1=TEMPLE.y0-5,L2=L1-6,L3=L2-6,L4=L3-6;export const LEVELS=[L1,L2,L3,L4];
export const CONE={u:8,v:-80,R:138,H:108,cr:22,cd:28};
const RIVER=[[-4,222],[-2,172],[10,142],[6,116],[20,94],[36,77],[50,62]],LAGOON={u:54,v:55,r:17},RIVER_W=6.5;
// cachoeira: paredão ao sul da lagoa (a água cai para o norte, dentro da lagoa) e o riacho que a alimenta
export const WF={u:58,v:36.2,top:12.5,w:6};const STREAM=[[WF.u,WF.v+.4],[WF.u+3,WF.v-8],[WF.u-2,WF.v-18],[WF.u+4,WF.v-30]];
export const RIM={u:8,v:-57};
const TRAILS=[
  [[-34,170],[-40,142],[-32,114],[-26,92],[-22,78]],                                                  // praia norte → calçada do templo
  [[42,68],[26,66],[8,64],[-8,66],[-16,74]],                                                          // píer da lagoa → templo
  [[12,28],[44,14],[0,2],[46,-10],[2,-22],[40,-32],[6,-42],[28,-49],[RIM.u,RIM.v]],                 // serpentina suave até a borda da cratera
  [[-32,114],[-14,112],[-1,112]],[[18,112],[34,116],[54,124],[72,132]],                              // travessia da ponte de cordas
  [[44,40],[50,30],[WF.u-3,WF.v-6]],                                                                  // mirante no alto da cachoeira
];
const VOLC_TRAIL=2;
const BRIDGE={u0:-1,u1:18,v:112,w:1.3};
// Beiral do Sacrifício: plataforma de pedra que avança sobre a cratera (é dali que o artefato vai ser jogado)
export const LEDGE={u:RIM.u,v0:RIM.v+1.5,v1:RIM.v-10,w:1.7};
const hash=(x,y)=>{const s=Math.sin(x*127.1+y*311.7)*43758.5453;return s-Math.floor(s);};
function vnoise(x,y){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf),a=hash(xi,yi),b=hash(xi+1,yi),c=hash(xi,yi+1),d=hash(xi+1,yi+1);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;}
const fbm=(x,y)=>{let s=0,a=.5,f=1;for(let i=0;i<4;i++){s+=a*vnoise(x*f,y*f);f*=2.03;a*=.5;}return s/.9375;};
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const lerp=(a,b,t)=>a+(b-a)*t;
function polyDist(u,v,poly){let best=1e9;for(let i=0;i<poly.length-1;i++){const [ax,az]=poly[i],[bx,bz]=poly[i+1],dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((u-ax)*dx+(v-az)*dz)/(dx*dx+dz*dz)));best=Math.min(best,Math.hypot(u-ax-dx*t,v-az-dz*t));}return best;}
const trailDist=(u,v)=>Math.min(...TRAILS.map(t=>polyDist(u,v,t)));
function coastR(a){return 172+16*Math.sin(3*a+1.3)+9*Math.sin(5*a-.4)+5*Math.sin(11*a+2);}
// ---------- salas do templo (coordenadas do templo: x leste, z norte; piso por retângulo, o último que casar vale) ----------
const ramp=(za,ya,zb,yb)=>z=>lerp(ya,yb,Math.max(0,Math.min(1,(z-za)/(zb-za))));
export const ROOMS=[
  {x:[-1.5,1.5],z:[-19,3],f:ramp(-19,L1,3,TOP),c:3.4,name:'Escadaria do Santuário',stairs:true},
  // Nível 1
  {x:[-6,6],z:[-35,-19],f:L1,c:4.4,name:'Nível 1 · Salão dos Dardos',level:1},
  {x:[-1.5,1.5],z:[-48,-35],f:ramp(-48,L2,-38,L1),c:3.4,stairs:true},
  // Nível 2
  {x:[-6,6],z:[-68,-48],f:L2,c:5,name:'Nível 2 · Fosso das Lanças',level:2},
  {x:[-6,6],z:[-65,-51],f:L2-2.6,c:7.6,pit:true},
  {x:[-6,-4.6],z:[-58,-51],f:ramp(-58,L2-2.6,-51,L2),c:7.6},
  {x:[-.55,.55],z:[-65,-51],f:L2,c:5,bridge:true},
  {x:[-2.5,2.5],z:[-84,-68],f:L2,c:6.6,name:'Galeria das Lâminas'},
  {x:[-1.5,1.5],z:[-97,-84],f:ramp(-97,L3,-87,L2),c:3.4,stairs:true},
  // Nível 3
  {x:[-9,9],z:[-113,-97],f:L3,c:5.6,name:'Nível 3 · Câmara dos Pilares',level:3},
  {x:[9,10],z:[-107,-103],f:L3,c:3.4},
  {x:[10,25],z:[-113,-97],f:L3,c:6.2,name:'Sala dos Espelhos'},
  {x:[15,17.5],z:[-126,-113],f:ramp(-126,L4,-116,L3),c:3.4,stairs:true},
  // Nível 4
  {x:[3,31],z:[-154,-126],f:L4,c:10,name:'Nível 4 · Câmara do Coração',level:4},
  {x:[12.5,21.5],z:[-144,-136],f:L4+.5,c:9.5,dais:1},{x:[13.7,20.3],z:[-143,-137],f:L4+1,c:9,dais:1},{x:[14.9,19.1],z:[-142,-138],f:L4+1.5,c:8.5,dais:1},
];
// portões de pedra no topo de cada escada (fechados até o puzzle do nível ser resolvido)
export const GATES=[{x:[-1.5,1.5],z:-36.3,y:L1},{x:[-1.5,1.5],z:-85.3,y:L2},{x:[15,17.5],z:-114.3,y:L3}];
const DUNGEON={x0:-12,x1:34,z0:-157,z1:8};
// ---------- puzzles (coordenadas do templo) ----------
export const GLYPHS=['☉','☽','✶','◈','♆','⚶','♁','⟁','⌬','☿'];
// Nível 1: ladrilhos com glifos; só os da lua (☽) são seguros. O caminho da lua é contínuo (sem diagonais).
export const L1T={x0:-4.4,dx:2.2,z0:-21.5,dz:-2.3,cols:5,rows:6,safe:1,path:[[0,1],[1,1],[1,2],[2,2],[2,3],[3,3],[4,3],[4,2],[4,1],[5,1]]};
export const l1Glyph=(r,c)=>L1T.path.some(([a,b])=>a===r&&b===c)?L1T.safe:[0,2,3,4,5,6,7,8][(r*5+c*3+r*c)%8];
export function l1Cell(tx,tz){const c=Math.round((tx-L1T.x0)/L1T.dx),r=Math.round((tz-L1T.z0)/L1T.dz);return c<0||r<0||c>=L1T.cols||r>=L1T.rows?null:[r,c];}
// Nível 2: quatro lâminas com um glifo cada; a ordem delas (da entrada para o fundo) é o segredo dos quatro botões
export const BLADES=[-71,-74.4,-77.8,-81.2],BLADE_G=[4,0,7,2];
export const bladeAngle=(t,i)=>Math.sin(t*1.1+i*1.3)*.9;
export const BUTTONS=[{x:-2.47,z:-82.6,f:1,g:2},{x:-2.47,z:-83.5,f:1,g:0},{x:2.47,z:-82.6,f:-1,g:7},{x:2.47,z:-83.5,f:-1,g:4}];
export const BUTTON_ORDER=BLADE_G.map(g=>BUTTONS.findIndex(b=>b.g===g));
// Nível 3: a luz do poço desce no canto noroeste e segue para o sul; espelhos giram de 45 em 45 graus até ela chegar ao disco solar
export const MIRRORS=[[12,-104],[12,-110],[21,-110],[21,-104]],MIRROR_START=[0,2,2,1],MROOM={x0:10,x1:25,z0:-113,z1:-97},SUN={x:25,z:-104},SRC={x:12,z:-98.5};
export function beamPath(mir){const pts=[[SRC.x,SRC.z]];let x=SRC.x,z=SRC.z,dx=0,dz=-1,skip=-1,hit=false;
  for(let n=0;n<8;n++){let best=null;
    MIRRORS.forEach(([mx,mz],i)=>{if(i===skip)return;const t=(mx-x)*dx+(mz-z)*dz;if(t<.3)return;const off=Math.abs((mx-x)*dz-(mz-z)*dx);if(off<.3&&(!best||t<best.t))best={t,i};});
    const tw=Math.min(dx>0?(MROOM.x1-x)/dx:dx<0?(MROOM.x0-x)/dx:1e9,dz>0?(MROOM.z1-z)/dz:dz<0?(MROOM.z0-z)/dz:1e9);
    if(best&&best.t<tw){x+=dx*best.t;z+=dz*best.t;pts.push([x,z]);const a=(mir[best.i]||0)*Math.PI/4,lx=Math.cos(a),lz=-Math.sin(a),dl=dx*lx+dz*lz;
      if(Math.abs(dl)>.9){skip=best.i;continue;}          // de lado: o feixe passa rente ao disco
      if(Math.abs(dl)<.1)break;                              // de frente: a luz bate e volta, morre ali
      const rx=2*dl*lx-dx,rz=2*dl*lz-dz,l=Math.hypot(rx,rz);dx=Math.round(rx/l);dz=Math.round(rz/l);skip=best.i;continue;}
    x+=dx*tw;z+=dz*tw;pts.push([x,z]);hit=dx>0&&Math.abs(z-SUN.z)<1.1;break;}
  return {pts,hit};}
// Nível 4: o Coração do Vulcão sobre o altar, no alto do estrado
export const HEART={x:17,z:-140,y:L4+3.4};
function interiorFloor(tx,tz){let f=null;for(const r of ROOMS)if(tx>=r.x[0]&&tx<=r.x[1]&&tz>=r.z[0]&&tz<=r.z[1])f=typeof r.f==='function'?r.f(tz):r.f;return f;}
function roomAt(tx,tz){let f=null;for(const r of ROOMS)if(tx>=r.x[0]&&tx<=r.x[1]&&tz>=r.z[0]&&tz<=r.z[1])f=r;return f;}
// pirâmide de três degraus, escadaria norte e o poço aberto dentro do santuário
function pyramidTop(tx,tz){const ax=Math.abs(tx),az=Math.abs(tz);let h=null;
  for(let i=0;i<3;i++)if(ax<TIER[i]&&az<TIER[i])h=TEMPLE.y0+5*(i+1);
  if(ax<3.2&&tz>=10&&tz<=30.5){const hs=TEMPLE.y0+15*Math.min(1,(30.5-tz)/20.5);h=Math.max(h??-99,hs);}
  if(ax<1.5&&tz<3&&tz>-3)h=ROOMS[0].f(tz);
  return h;}
function bridgeAt(u,v,deck){if(u<BRIDGE.u0||u>BRIDGE.u1||Math.abs(v-BRIDGE.v)>BRIDGE.w)return null;return deck?deck((u-BRIDGE.u0)/(BRIDGE.u1-BRIDGE.u0)):null;}
function ledgeAt(u,v,y){if(y==null||Math.abs(u-LEDGE.u)>LEDGE.w||v>LEDGE.v0||v<LEDGE.v1)return null;return y;}
// ---------- terreno ----------
function terrainBase(u,v){
  const r=Math.hypot(u,v),a=Math.atan2(v,u),shore=coastR(a)-r,n=fbm(u*.018+3,v*.018-7);
  let h=shore<0?.5-12*smooth(0,55,-shore)+(fbm(u*.05,v*.05)-.5)*1.2*smooth(0,20,-shore):.5+1.4*smooth(0,16,shore)+10*smooth(12,85,shore)*(.5+.9*n)+(fbm(u*.09,v*.09)-.5)*1.6*smooth(8,30,shore);
  // vulcão: cone com costelas de lava antiga e a cratera
  const dc=Math.hypot(u-CONE.u,v-CONE.v),ang=Math.atan2(v-CONE.v,u-CONE.u);let cone=CONE.H*Math.pow(Math.max(0,1-dc/CONE.R),1.3);
  const ribs=Math.pow(Math.abs(Math.sin(ang*9+fbm(dc*.03,ang)*3)),3);cone*=1+.06*ribs*smooth(25,110,dc);cone+=(fbm(u*.06+9,v*.06)-.5)*6*smooth(15,40,dc)*(1-smooth(90,138,dc));
  if(dc<CONE.cr+6)cone-=CONE.cd*Math.pow(Math.max(0,1-dc/CONE.cr),.8)-3*smooth(CONE.cr-3,CONE.cr+6,dc)*0;
  h+=cone;
  // rio e lagoa (canal fundo o bastante para o barco)
  const cut=Math.min(polyDist(u,v,RIVER)-RIVER_W,Math.hypot(u-LAGOON.u,v-LAGOON.v)-LAGOON.r);
  if(cut<10)h=Math.min(h,lerp(-3.4,h,smooth(-1.5,10,cut)));
  // platô do templo e a colina por cima das salas
  const dp=Math.hypot(u-TEMPLE.u,v-TEMPLE.v);h=lerp(h,TEMPLE.y0,1-smooth(34,52,dp));
  const tx=u-TEMPLE.u,tz=v-TEMPLE.v,ox=Math.max(DUNGEON.x0-tx,0,tx-DUNGEON.x1),oz=Math.max(DUNGEON.z0-tz,0,tz-DUNGEON.z1),od=Math.hypot(ox,oz);
  if(od<14)h=Math.max(h,lerp(TEMPLE.y0+1,h,smooth(0,14,od)));
  // calçada do templo: chão nivelado até a estela (antes a escadaria e as lajes flutuavam sobre o barranco)
  {const cw=Math.max(Math.abs(tx)-9,0,tz<18?18-tz:tz>82?tz-82:0);if(cw<9)h=lerp(h,TEMPLE.y0,1-smooth(0,9,cw));}
  // paredão da cachoeira: platô ao sul da lagoa, face quase vertical; e o leito do riacho no alto
  {const side=1-smooth(10,19,Math.abs(u-WF.u));if(side>0&&v<WF.v+1.8&&v>WF.v-34){const face=1-smooth(WF.v,WF.v+1.8,v),top=WF.top-(fbm(u*.2,v*.2)-.5)*1.4-Math.max(0,WF.v-12-v)*.04;h=Math.max(h,lerp(h,top,side*face));}
    const ds=polyDist(u,v,STREAM);if(ds<2.6&&v<WF.v+.6&&v>WF.v-32)h=Math.min(h,lerp(WF.top-1.1,h,smooth(.7,2.6,ds)));}
  return h;}
// trilhas niveladas: a altura segue o traçado (a serpentina do vulcão sobe com ~25% de inclinação, bem mais suave)
let TRAIL_H=null;
function trailHeights(){if(TRAIL_H)return TRAIL_H;TRAIL_H=TRAILS.map((t,i)=>{if(i!==VOLC_TRAIL)return t.map(([u,v])=>terrainBase(u,v));
    const lens=[0];for(let k=1;k<t.length;k++)lens.push(lens[k-1]+Math.hypot(t[k][0]-t[k-1][0],t[k][1]-t[k-1][1]));const h0=terrainBase(...t[0]),h1=terrainBase(RIM.u,RIM.v)+.4;return lens.map(l=>lerp(h0,h1,l/lens.at(-1)));});return TRAIL_H;}
function terrainRaw(u,v){let h=terrainBase(u,v);const TH=trailHeights();
  {const tx=u-TEMPLE.u,tz=v-TEMPLE.v;/* só onde o morro (y0+1) cruza o túnel, bem dentro da base da pirâmide */if(Math.abs(tx)<3&&tz>-17.5&&tz<-10.5)h=Math.min(h,ROOMS[0].f(tz)-2.5);}
  for(let i=0;i<TRAILS.length;i++){const t=TRAILS[i],R=i===VOLC_TRAIL?6:4.6;let best=1e9,bh=0;
    for(let k=0;k<t.length-1;k++){const [ax,az]=t[k],[bx,bz]=t[k+1],dx=bx-ax,dz=bz-az,q=Math.max(0,Math.min(1,((u-ax)*dx+(v-az)*dz)/(dx*dx+dz*dz))),d=Math.hypot(u-ax-dx*q,v-az-dz*q);if(d<best){best=d;bh=lerp(TH[i][k],TH[i][k+1],q);}}
    if(best<R)h=lerp(h,bh-.08,1-smooth(2.2,R,best));}
  return h;}
// ---------- material de pedra (blocos, rejunte, musgo) com luz de tocha "falsa" (não é luz: não muda a contagem) ----------
const TORCH_MAX=32;
function stoneMaterial(torches,{dim=1,moss=1,color=0xffffff,rough=.9}={}){
  const m=new THREE.MeshStandardMaterial({vertexColors:true,roughness:rough,color});
  m.onBeforeCompile=s=>{Object.assign(s.uniforms,{uTorch:{value:torches},uTime:U.uTime,uDim:{value:dim},uMoss:{value:moss}});
    s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;varying vec3 vWN;').replace('#include <project_vertex>','#include <project_vertex>\nvWP=(modelMatrix*vec4(transformed,1.)).xyz;vWN=normalize(mat3(modelMatrix)*objectNormal);');
    s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>
varying vec3 vWP;varying vec3 vWN;uniform vec4 uTorch[${TORCH_MAX}];uniform float uTime,uDim,uMoss;
float sh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float sn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(sh(i),sh(i+vec2(1,0)),f.x),mix(sh(i+vec2(0,1)),sh(i+vec2(1,1)),f.x),f.y);}`)
      .replace('#include <color_fragment>',`#include <color_fragment>
{vec3 n=normalize(vWN);vec2 q=abs(n.y)>.6?vWP.xz*vec2(.9,.9):(abs(n.x)>abs(n.z)?vWP.zy:vWP.xy);float row=floor(q.y/.55),off=mod(row,2.)*.5;float col=floor(q.x/1.1+off);
 vec2 f=vec2(fract(q.x/1.1+off),fract(q.y/.55));float mort=smoothstep(0.,.035,f.x)*smoothstep(1.,.965,f.x)*smoothstep(0.,.06,f.y)*smoothstep(1.,.94,f.y);
 float h=sh(vec2(col,row));diffuseColor.rgb*=(.74+.34*h)*mix(.42,1.,mort)*(.92+.16*sn(vWP.xz*2.1+vWP.y));
 float moss=clamp(smoothstep(.35,.9,n.y)*.8+(1.-mort)*.35,0.,1.)*smoothstep(.45,.75,sn(vWP.xz*.35+vWP.y*.2))*uMoss;diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.16,.27,.1)*(.8+.4*h),moss*.85);}`)
      .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
{vec3 acc=vec3(0.);for(int i=0;i<${TORCH_MAX};i++){vec4 t=uTorch[i];if(t.w<=0.)continue;vec3 d=t.xyz-vWP;float dd=dot(d,d);float face=clamp(dot(normalize(d),normalize(vWN))*.6+.4,0.,1.);acc+=t.w*face/(1.+dd*.22);}acc=min(acc,vec3(1.1));
 float fl=.86+.08*sin(uTime*11.)+.06*sin(uTime*17.3+vWP.x);totalEmissiveRadiance+=diffuseColor.rgb*acc*vec3(1.,.52,.2)*fl;}`)
      .replace('#include <lights_fragment_end>','#include <lights_fragment_end>\nreflectedLight.directDiffuse*=uDim;reflectedLight.indirectDiffuse*=uDim;reflectedLight.directSpecular*=uDim;reflectedLight.indirectSpecular*=uDim;');};
  m.customProgramCacheKey=()=>'volcano-stone';return m;}
// vegetação instanciada balança ao vento (a fase depende da posição de cada instância)
function jungleMaterial(opts={}){const m=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.85,side:THREE.DoubleSide,...opts});
  m.onBeforeCompile=s=>{s.uniforms.uTime=U.uTime;s.uniforms.uStorm=U.uStorm;
    s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute float aSway;uniform float uTime,uStorm;').replace('#include <begin_vertex>',`#include <begin_vertex>
      vec4 swp=modelMatrix*vec4(transformed,1.);
      #ifdef USE_INSTANCING
      swp=modelMatrix*instanceMatrix*vec4(transformed,1.);
      #endif
      float ph=dot(swp.xz,vec2(.13,.09));float str=.09+uStorm*.5;float g=sin(uTime*1.3+ph)*.6+sin(uTime*2.7+ph*1.7)*.3;
      transformed.x+=(g+.35*uStorm)*aSway*str;transformed.z+=sin(uTime*1.07+ph*1.3)*.45*aSway*str;`);};
  m.customProgramCacheKey=()=>'jungle';return m;}
// geometria única de um modelo feito com Kit (um material)
function kitGeometry(fn){const k=new Kit(),mat=new THREE.MeshBasicMaterial();fn(k,mat);const g=k.build().children.map(o=>o.geometry);const merged=g.length>1?mergeGeometries(g):g[0];if(!merged.attributes.aSway)merged.setAttribute('aSway',new THREE.BufferAttribute(new Float32Array(merged.attributes.position.count),1));merged.computeBoundingSphere();return merged;}
// ---------- espalhador com LOD: perto = modelo completo; longe = versão simples; mais longe = nada ----------
class Scatter {
  constructor(parent,near,far,mat,{nearD=150,farD=320,shadow=true,cap=4000}={}){this.items=[];this.nearD=nearD;this.farD=farD;
    this.near=new THREE.InstancedMesh(near,mat,cap);this.near.castShadow=shadow;this.near.receiveShadow=true;this.near.count=0;this.near.frustumCulled=false;parent.add(this.near);
    if(far){this.far=new THREE.InstancedMesh(far,mat,cap);this.far.receiveShadow=true;this.far.count=0;this.far.frustumCulled=false;parent.add(this.far);}}
  add(x,y,z,s=1,yaw=0,color=null){const m=new THREE.Matrix4().compose(V(x,y,z),new THREE.Quaternion().setFromAxisAngle(V(0,1,0),yaw),V(s,s,s));this.items.push({m,p:V(x,y,z),c:color?new THREE.Color(color):null});}
  // escolhe quem aparece: só o que está perto, e só o que está na frente da câmera (com folga)
  update(cam,dir){let n=0,f=0;const nd2=this.nearD*this.nearD,fd2=this.farD*this.farD;
    for(const it of this.items){const dx=it.p.x-cam.x,dz=it.p.z-cam.z,d2=dx*dx+dz*dz;if(d2>fd2)continue;if(d2>400){const d=Math.sqrt(d2);if((dx*dir.x+dz*dir.z)/d<-.35)continue;}
      if(d2<nd2){this.near.setMatrixAt(n,it.m);if(it.c)this.near.setColorAt(n,it.c);n++;}else if(this.far){this.far.setMatrixAt(f,it.m);if(it.c)this.far.setColorAt(f,it.c);f++;}}
    this.near.count=n;this.near.instanceMatrix.needsUpdate=true;if(this.near.instanceColor)this.near.instanceColor.needsUpdate=true;
    if(this.far){this.far.count=f;this.far.instanceMatrix.needsUpdate=true;if(this.far.instanceColor)this.far.instanceColor.needsUpdate=true;}}
}
// ---------- colisões por grade (árvores, colunas, estátuas, paredes do santuário) com faixa de altura ----------
class Grid {
  constructor(cell=8){this.cell=cell;this.map=new Map();}
  key(i,j){return i*73856093^j*19349663;}
  add(c){const x0=c.r?c.x-c.r:c.x0,x1=c.r?c.x+c.r:c.x1,z0=c.r?c.z-c.r:c.z0,z1=c.r?c.z+c.r:c.z1;for(let i=Math.floor(x0/this.cell);i<=Math.floor(x1/this.cell);i++)for(let j=Math.floor(z0/this.cell);j<=Math.floor(z1/this.cell);j++){const k=this.key(i,j);(this.map.get(k)||this.map.set(k,[]).get(k)).push(c);}}
  near(x,z){const i=Math.floor(x/this.cell),j=Math.floor(z/this.cell),out=new Set();for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(const c of this.map.get(this.key(i+a,j+b))||[])out.add(c);return out;}
}
// ======================================================================================================
export class VolcanoIsland {
  constructor(scene,quality='high'){
    this.scene=scene;this.hi=quality!=='low';this.group=new THREE.Group();this.group.position.set(VOLCANO.x,0,VOLCANO.z);this.group.name='Ilha do Vulcão';scene.add(this.group);
    this.nearG=new THREE.Group();this.farG=new THREE.Group();this.group.add(this.nearG,this.farG);
    this.torches=Array.from({length:TORCH_MAX},()=>new THREE.Vector4(0,-999,0,0));this.torchCount=0;this.flames=[];this.grid=new Grid();this.colliders=[];this.scatters=[];this.anim=[];
    reseed(4242);this.bakeHeights();
    this.deck=t=>lerp(this.hAt(BRIDGE.u0,BRIDGE.v)+.2,this.hAt(BRIDGE.u1,BRIDGE.v)+.2,t)-1.1*Math.sin(t*Math.PI);
    this.gateOpen=[0,0,0];this.gateY=[0,0,0];
    this.stone=stoneMaterial(this.torches,{moss:.7});this.stoneIn=stoneMaterial(this.torches,{dim:.2,moss:.35});this.dark=stoneMaterial(this.torches,{dim:.2,moss:0,color:0x9a9a9a});
    this.metal=new THREE.MeshStandardMaterial({vertexColors:true,metalness:.8,roughness:.35});this.gold=new THREE.MeshStandardMaterial({vertexColors:true,metalness:1,roughness:.22,color:0xffd27a});
    this.buildTerrain();this.buildWater();this.buildVegetation();this.buildRiverside();this.buildVolcanoTop();
    this.buildTemple();this.buildInterior();this.buildRuins();
    this.torchesU=this.torches;this.heightTex=this.makeHeightTex();
  }
  // ---------- alturas pré-calculadas (0,75 m) ----------
  bakeHeights(){const S=VOLCANO.size,N=Math.round(S/.75);this.hN=N;this.hStep=S/N;this.H=new Float32Array((N+1)*(N+1));for(let j=0;j<=N;j++)for(let i=0;i<=N;i++)this.H[j*(N+1)+i]=terrainRaw(-S/2+i*this.hStep,-S/2+j*this.hStep);}
  hAt(u,v){const S=VOLCANO.size,N=this.hN,fx=(u+S/2)/this.hStep,fz=(v+S/2)/this.hStep;if(fx<0||fz<0||fx>=N||fz>=N)return -12;const i=Math.floor(fx),j=Math.floor(fz),a=fx-i,b=fz-j,W=N+1,H=this.H;
    return lerp(lerp(H[j*W+i],H[j*W+i+1],a),lerp(H[(j+1)*W+i],H[(j+1)*W+i+1],a),b);}
  contains(x,z){return Math.abs(x-VOLCANO.x)<VOLCANO.size/2&&Math.abs(z-VOLCANO.z)<VOLCANO.size/2;}
  // chão com vários níveis (veja o topo do arquivo)
  ground(x,z,y){const u=x-VOLCANO.x,v=z-VOLCANO.z,tx=u-TEMPLE.u,tz=v-TEMPLE.v,pyr=pyramidTop(tx,tz),base=pyr!=null?pyr:this.hAt(u,v);
    const fl=Math.abs(tx)<60&&Math.abs(tz)<170?interiorFloor(tx,tz):null,br=bridgeAt(u,v,this.deck),le=ledgeAt(u,v,this.ledgeY);
    if(y===undefined)return Math.max(base,br??-99,le??-99);
    let best=-Infinity;for(const h of [base,fl,br,le])if(h!=null&&h<=y+.6&&h>best)best=h;
    return best>-Infinity?best:Math.max(base,fl??-99,br??-99,le??-99);}
  // câmera dentro das salas subterrâneas: o mar (plano em y≈0) não pode aparecer lá dentro
  inside(p){const tx=p.x-VOLCANO.x-TEMPLE.u,tz=p.z-VOLCANO.z-TEMPLE.v;return p.y<TEMPLE.y0-.5&&tx>DUNGEON.x0-1&&tx<DUNGEON.x1+1&&tz>DUNGEON.z0-1&&tz<DUNGEON.z1+1&&interiorFloor(tx,tz)!=null;}
  // empurra para fora de troncos, colunas e paredes que estão na altura dos pés (y) do jogador
  collide(x,z,r=.3,y){const u=x-VOLCANO.x,v=z-VOLCANO.z;let px=u,pz=v;
    for(const c of this.grid.near(u,v)){if(y!==undefined&&(y>c.y1||y+1.7<c.y0))continue;if(c.gate!=null&&this.gateOpen[c.gate]>.5)continue;
      if(c.r){const dx=px-c.x,dz=pz-c.z,d=Math.hypot(dx,dz),m=c.r+r;if(d<m&&d>1e-5){px=c.x+dx/d*m;pz=c.z+dz/d*m;}}
      else if(px>c.x0-r&&px<c.x1+r&&pz>c.z0-r&&pz<c.z1+r){const ax=Math.min(px-(c.x0-r),(c.x1+r)-px),az=Math.min(pz-(c.z0-r),(c.z1+r)-pz);if(ax<az)px=px-(c.x0-r)<(c.x1+r)-px?c.x0-r:c.x1+r;else pz=pz-(c.z0-r)<(c.z1+r)-pz?c.z0-r:c.z1+r;}}
    return [px+VOLCANO.x,pz+VOLCANO.z];}
  solid(c){c.y0??=-50;c.y1??=500;this.grid.add(c);this.colliders.push(c);}
  // chão para a física dos corpos (ragdoll): superfície, mas com as salas "escavadas"
  physicsGround(x,z){return this.ground(x,z);}
  // piso das salas para o heightfield fino do templo (null = rocha)
  dungeonFloor(x,z){return interiorFloor(x-VOLCANO.x-TEMPLE.u,z-VOLCANO.z-TEMPLE.v);}
  deepValid(x,y,z){const f=this.dungeonFloor(x,z);return f!=null&&y>f-.6;}
  get dungeonRect(){return {x0:VOLCANO.x+TEMPLE.u+DUNGEON.x0,z0:VOLCANO.z+TEMPLE.v+DUNGEON.z0,w:DUNGEON.x1-DUNGEON.x0,d:DUNGEON.z1-DUNGEON.z0};}
  // ponto abaixo da superfície, dentro de uma sala (corpo que cai lá dentro usa o chão fino)
  underground(x,y,z){const u=x-VOLCANO.x,v=z-VOLCANO.z,tx=u-TEMPLE.u,tz=v-TEMPLE.v;if(tx<DUNGEON.x0||tx>DUNGEON.x1||tz<DUNGEON.z0||tz>DUNGEON.z1)return false;const f=interiorFloor(tx,tz);if(f==null)return false;const top=pyramidTop(tx,tz)??this.hAt(u,v);return y<top-1.2;}
  // colisor que fica dentro das salas (vai para o grupo de física do templo)
  deepCollider(c){const tx=(c.r?c.x:(c.x0+c.x1)/2)-TEMPLE.u,tz=(c.r?c.z:(c.z0+c.z1)/2)-TEMPLE.v;return c.y1!=null&&c.y1<TEMPLE.y0+1.5&&tx>DUNGEON.x0&&tx<DUNGEON.x1&&tz>DUNGEON.z0&&tz<DUNGEON.z1;}
  get physicsRect(){return {x0:VOLCANO.x-VOLCANO.size/2,z0:VOLCANO.z-VOLCANO.size/2,size:VOLCANO.size,n:180};}
  makeHeightTex(){const N=256,S=VOLCANO.size,data=new Uint8Array(N*N);for(let j=0;j<N;j++)for(let i=0;i<N;i++){const h=this.hAt(-S/2+(i+.5)/N*S,-S/2+(j+.5)/N*S);data[j*N+i]=Math.max(0,Math.min(255,Math.round((h+12)/24*255)));}
    const t=new THREE.DataTexture(data,N,N,THREE.RedFormat,THREE.UnsignedByteType);t.magFilter=t.minFilter=THREE.LinearFilter;t.needsUpdate=true;return t;}
  addTorch(x,y,z,power=1.4,parent=this.group,scale=.9){const i=this.torchCount++;if(i<TORCH_MAX)this.torches[i].set(x+VOLCANO.x,y,z+VOLCANO.z,power);
    const s=new THREE.Sprite(new THREE.SpriteMaterial({map:flameTex(),color:new THREE.Color(3,1.5,.5),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));s.position.set(x,y,z);s.scale.set(.5*scale,.8*scale,1);parent.add(s);this.flames.push(s);return s;}
  // ======================= terreno =======================
  terrainGeometry(N,lowDetail){const S=VOLCANO.size,step=S/N,pos=[],col=[],c=new THREE.Color();
    const C={sand:new THREE.Color(0x2e2b2a),wet:new THREE.Color(0x1f1d1d),jungleA:new THREE.Color(0x2f5a24),jungleB:new THREE.Color(0x1f4419),jungleC:new THREE.Color(0x4f7a2a),moss:new THREE.Color(0x3d5a26),
      rock:new THREE.Color(0x3b3533),ash:new THREE.Color(0x5b5552),scoria:new THREE.Color(0x5a2c1e),dirt:new THREE.Color(0x6b4a2f),bed:new THREE.Color(0x3a3024),hot:new THREE.Color(0x8a2e16)};
    const hv=(i,j)=>this.hAt(-S/2+i*step,-S/2+j*step);
    for(let j=0;j<N;j++)for(let i=0;i<N;i++){const q=[[i,j],[i+1,j],[i+1,j+1],[i,j+1]].map(([a,b])=>V(-S/2+a*step,hv(a,b),-S/2+b*step));
      for(const tri of [[0,2,1],[0,3,2]]){const [A,B,Cc]=tri.map(k=>q[k]);if(A.y<-6&&B.y<-6&&Cc.y<-6)continue;
        const cu=(A.x+B.x+Cc.x)/3,cv=(A.z+B.z+Cc.z)/3,ch=(A.y+B.y+Cc.y)/3,n=B.clone().sub(A).cross(Cc.clone().sub(A)).normalize(),slope=1-Math.abs(n.y),sp=hash(cu*3.1,cv*2.7);
        const dc=Math.hypot(cu-CONE.u,cv-CONE.v),shore=coastR(Math.atan2(cv,cu))-Math.hypot(cu,cv);
        if(ch<.25)c.copy(ch<-1.5?C.bed:C.wet).multiplyScalar(.9+sp*.15);
        else if(shore<14&&ch<3)c.copy(C.sand).lerp(C.jungleB,smooth(8,14,shore)*.6).multiplyScalar(.85+sp*.25);
        else{c.copy(C.jungleA).lerp(C.jungleB,fbm(cu*.07,cv*.07)).lerp(C.jungleC,Math.max(0,sp-.7)*1.4);if(fbm(cu*.3,cv*.3)>.62)c.lerp(C.moss,.4);}
        const volc=smooth(55,20,dc>0?dc:0)+smooth(95,60,dc)*.8;if(volc>0)c.lerp(dc<38?C.ash:C.rock,Math.min(1,volc)).multiplyScalar(.9+sp*.15);
        if(dc<CONE.cr+10)c.lerp(C.scoria,smooth(CONE.cr+10,CONE.cr,dc)).lerp(C.hot,smooth(CONE.cr*.7,CONE.cr*.2,dc));
        if(slope>.45&&ch>1)c.lerp(C.rock,Math.min(1,(slope-.45)*2.5)).multiplyScalar(.95);
        const td=trailDist(cu,cv);if(td<2.6&&ch>.8)c.lerp(C.dirt,(1-smooth(1,2.6,td))*.85);
        const dp=Math.hypot(cu-TEMPLE.u,cv-TEMPLE.v);if(dp<36)c.lerp(C.dirt,.25).lerp(C.moss,.2);
        pos.push(A.x,A.y,A.z,B.x,B.y,B.z,Cc.x,Cc.y,Cc.z);for(let k=0;k<3;k++)col.push(c.r,c.g,c.b);}}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.computeVertexNormals();return g;}
  buildTerrain(){const mat=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.95});
    const near=new THREE.Mesh(this.terrainGeometry(this.hi?230:160),mat);near.receiveShadow=true;near.castShadow=true;near.name='terreno vulcânico';this.nearG.add(near);
    const far=new THREE.Mesh(this.terrainGeometry(64,true),mat);far.receiveShadow=true;this.farG.add(far);}
  // lagoa e rio têm água do próprio mar; aqui só a espuma nas pedras e a cachoeira que desce na lagoa
  buildWater(){const k=new Kit(),m=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.55,metalness:.1}),W=WF,moss=jungleMaterial();
    // pedras molhadas no pé do paredão e em volta do poço (escuras e brilhantes de água)
    for(let i=0;i<18;i++){const a=i/17*Math.PI,r=W.w*.75+rand()*3.5,u=W.u+Math.cos(a)*r,v=W.v+1.6+Math.sin(a)*(1.2+rand()*2.6),y=this.hAt(u,v),s=.5+rand()*1.4;
      k.add(m,sculpt(new THREE.DodecahedronGeometry(s,1),q=>{q.multiplyScalar(1+(hash(q.x*3,q.z*3)-.5)*.25);q.y*=.62;}).translate(u,Math.max(y,-.6)+s*.15,v),i%3?0x1c1a19:0x2a2724,.1);}
    // borda do paredão: lábio de rocha por onde a água transborda
    for(let i=0;i<9;i++){const u=W.u-4.4+i*1.1,y=W.top-.5;k.add(m,sculpt(new THREE.DodecahedronGeometry(.7,0),q=>{q.y*=.5;}).translate(u,y,W.v+.2),0x2a2622,.1);}
    // musgo, samambaias e cipós pendurados na face
    for(let i=0;i<44;i++){const u=W.u+(rand()-.5)*26;if(Math.abs(u-W.u)<W.w*.62)continue;const y0=W.top-.2-rand()*2,len=1.5+rand()*(W.top-2);k.add(moss,sway(limb(V(u,y0,W.v+1.85),V(u+(rand()-.5)*.6,Math.max(.4,y0-len),W.v+1.95),.05,.02,3),q=>(y0-q.y)*.1),rand()<.5?0x2e5a24:0x3f6a2a,.12);
      if(rand()<.5)k.add(moss,sway(new THREE.IcosahedronGeometry(.35+rand()*.3,0).translate(u,y0-rand()*3,W.v+2),()=>.2),0x2f6a28,.12);}
    this.nearG.add(k.build());
    // lâminas de água: curva que sai do lábio e cai dentro do poço (duas camadas, velocidades diferentes)
    const fallMat=seed=>new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{uTime:U.uTime,uSeed:{value:seed},uSpeed:{value:2.4+seed*.2}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`uniform float uTime,uSeed,uSpeed;varying vec2 vUv;float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
        void main(){float x=vUv.x,y=vUv.y;vec2 q=vec2(x*18.+uSeed*5.,y*6.-uTime*uSpeed);float a=n(q)*.55+n(q*vec2(2.1,1.6)+vec2(3.,-uTime*1.2))*.3+n(q*vec2(5.,.8))*.15;
          float streak=smoothstep(.34,.8,a);float sides=smoothstep(0.,.09,x)*smoothstep(1.,.91,x);float lip=smoothstep(.12,0.,y);float foot=smoothstep(.8,1.,y);
          float alpha=(.32+.62*streak)*sides*(1.-foot*.35)+lip*.3*sides;vec3 col=mix(vec3(.36,.52,.6),vec3(.96,.99,1.),clamp(streak*.85+lip*.6+foot*.5,0.,1.));
          gl_FragColor=vec4(col,clamp(alpha,0.,.95));}`});
    const sheet=(offset,width,seed)=>{const g=new THREE.PlaneGeometry(1,1,10,28),pp=g.attributes.position,uv=g.attributes.uv;for(let i=0;i<pp.count;i++){const x=pp.getX(i),t=.5-pp.getY(i);// t: 0 no lábio, 1 no poço
        const wx=W.u+x*width*(1+t*.18),wy=lerp(W.top-.35,-.15,t)+Math.sin(x*9+t*5)*.05,wz=W.v+.55+offset+2.1*Math.pow(t,.55)-.4*t*t;pp.setXYZ(i,wx,wy,wz);uv.setXY(i,x+.5,t);}g.computeVertexNormals();const mesh=new THREE.Mesh(g,fallMat(seed));mesh.renderOrder=4;this.nearG.add(mesh);return mesh;};
    sheet(0,W.w,0);sheet(-.3,W.w*.86,3.7);sheet(.18,W.w*.62,7.1);
    // riacho no alto que alimenta a queda
    const rib=[];const sp=STREAM.map(([u,v])=>V(u,WF.top-.62,v));const curve=new THREE.CatmullRomCurve3(sp);for(let i=0;i<=40;i++){const t=i/40,p0=curve.getPointAt(t),tan=curve.getTangentAt(t),n=V(-tan.z,0,tan.x).normalize();rib.push([p0.clone().addScaledVector(n,-1.5),p0.clone().addScaledVector(n,1.5),t]);}
    const rg=new THREE.BufferGeometry(),rp=[],ru=[],ri=[];rib.forEach(([a,b,t],i)=>{rp.push(a.x,a.y,a.z,b.x,b.y,b.z);ru.push(0,1-t,1,1-t);if(i){const q=i*2;ri.push(q-2,q-1,q,q-1,q+1,q);}});rg.setAttribute('position',new THREE.Float32BufferAttribute(rp,3));rg.setAttribute('uv',new THREE.Float32BufferAttribute(ru,2));rg.setIndex(ri);
    const stream=new THREE.Mesh(rg,fallMat(11));stream.material.uniforms.uSpeed.value=1.4;this.nearG.add(stream);
    // poço: espuma em anéis que se abrem
    const pool=new THREE.Mesh(new THREE.CircleGeometry(W.w*1.05,40).rotateX(-Math.PI/2),new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uTime:U.uTime},
      vertexShader:'varying vec2 vP;void main(){vP=position.xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`uniform float uTime;varying vec2 vP;float h(vec2 p){return fract(sin(dot(p,vec2(12.9,78.2)))*43758.5);}float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
        void main(){float r=length(vP)/${(W.w*1.05).toFixed(2)};float ring=sin(r*26.-uTime*5.)*.5+.5;float foam=n(vP*2.2+vec2(uTime*.6,-uTime*.4))*.6+ring*.4;foam=smoothstep(.45,.8,foam);float a=foam*(1.-smoothstep(.25,1.,r))*.85+(1.-smoothstep(0.,.35,r))*.45;gl_FragColor=vec4(vec3(.93,.97,1.),a);}`}));
    pool.position.set(W.u,.08,W.v+2.5);pool.renderOrder=5;this.nearG.add(pool);
    // gotas que espirram do impacto (partículas na GPU)
    const N=320,pos=new Float32Array(N*3),seed=new Float32Array(N*3);for(let i=0;i<N;i++){seed[i*3]=rand();seed[i*3+1]=rand();seed[i*3+2]=rand();}
    const dg=new THREE.BufferGeometry();dg.setAttribute('position',new THREE.BufferAttribute(pos,3));dg.setAttribute('aSeed',new THREE.BufferAttribute(seed,3));
    const drops=new THREE.Points(dg,new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uTime:U.uTime,uO:{value:new THREE.Vector3(W.u,0,W.v+2.4)}},
      vertexShader:`uniform float uTime;uniform vec3 uO;attribute vec3 aSeed;varying float vA;void main(){float life=fract(uTime*(.5+aSeed.z*.4)+aSeed.x);float ang=aSeed.x*6.283,sp=1.5+aSeed.y*3.;
        vec3 p=uO+vec3(cos(ang)*sp*life*1.2+(aSeed.y-.5)*${W.w.toFixed(1)},(3.+aSeed.z*4.)*life-4.9*life*life*1.6,sin(ang)*sp*life*.9);vA=(1.-life)*step(0.,p.y+.3);
        vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=(3.+aSeed.z*5.)*(60./-mv.z);gl_Position=projectionMatrix*mv;}`,
      fragmentShader:'varying float vA;void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(.92,.97,1.,vA*smoothstep(.5,.1,d)*.8);}'}));drops.frustumCulled=false;this.nearG.add(drops);
    // névoa do poço e um arco-íris fraco dentro dela
    this.mist=[];for(let i=0;i<18;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:flameTex(),color:0xf2f7ff,transparent:true,opacity:.2,depthWrite:false}));s.userData={k:i/18,x:(rand()-.5)*W.w*1.4};this.nearG.add(s);this.mist.push(s);}
    const bow=new THREE.Mesh(new THREE.RingGeometry(4.6,5.6,64,1,0,Math.PI),new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,uniforms:{uA:{value:.14}},
      vertexShader:'varying float vR;void main(){vR=length(position.xy);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'uniform float uA;varying float vR;void main(){float t=clamp((vR-4.6),0.,1.);vec3 c=clamp(abs(fract(t*.9+vec3(0.,.33,.67))*6.-3.)-1.,0.,1.);gl_FragColor=vec4(c,uA*sin(t*3.1416));}'}));
    bow.position.set(W.u,.6,W.v+4.2);this.nearG.add(bow);this.rainbow=bow;}
  // ======================= vegetação (instanciada, com LOD) =======================
  buildVegetation(){const mat=jungleMaterial(),g=this.nearG;
    const palmG=kitGeometry((k,m)=>palm(k,m,0,0,0,6,.8,0,11)),palmF=coneTree(0x4f8a32,5.5);
    const treeG=kitGeometry((k,m)=>broadTree(k,m,0,0,0,7,[0x1f5a24,0x2a6a2a,0x184a1c],31)),treeF=coneTree(0x225a24,7);
    const giantG=kitGeometry((k,m)=>{broadTree(k,m,0,0,0,15,[0x1a4a1c,0x2c6230,0x234f22],77);for(let r=0;r<6;r++){const a=r*1.05;k.add(m,limb(V(Math.cos(a)*1.4,0,Math.sin(a)*1.4),V(Math.cos(a)*.3,2.2,Math.sin(a)*.3),.25,.08,5),0x4a3a2c,.06);}for(let v=0;v<5;v++)k.add(m,sway(limb(V(1.5*Math.cos(v),9,1.5*Math.sin(v)),V(2.2*Math.cos(v),1,2.2*Math.sin(v)),.03,.02,4),()=>.4),0x3f5a2a,.1);}),giantF=coneTree(0x1d4d20,15);
    const fernG=kitGeometry((k,m)=>fernTree(k,m)),fernF=coneTree(0x2e6a2a,4);
    const bushG=kitGeometry((k,m)=>bush(k,m,0,0,0,1.1,0x2a5a22,null,7));
    const leafG=kitGeometry((k,m)=>monstera(k,m));
    const shrubG=kitGeometry((k,m)=>fernPlant(k,m));
    const deadG=kitGeometry((k,m)=>{k.add(m,limb(V(0,-.3,0),V(.3,5,.2),.3,.12,6),0x2e2825,.08);for(let b=0;b<4;b++){const a=b*1.6;k.add(m,limb(V(.2,3+b*.5,.1),V(.2+Math.cos(a)*1.8,4.4+b*.5,.1+Math.sin(a)*1.8),.09,.03,4),0x2e2825,.08);}});
    const rockG=kitGeometry((k,m)=>rock(k,m,0,0,0,1,5,0x2f2a28));
    const add=(near,far,o)=>{const s=new Scatter(g,near,far,mat,o);this.scatters.push(s);return s;};
    // distâncias do modelo completo curtas; além delas, copa simples (sem sombra) até sumir na névoa
    const S={palm:add(palmG,palmF,{nearD:95,farD:300}),tree:add(treeG,treeF,{nearD:80,farD:320}),giant:add(giantG,giantF,{nearD:120,farD:400}),fern:add(fernG,fernF,{nearD:55,farD:200}),
      bush:add(bushG,null,{nearD:45,shadow:false}),leaf:add(leafG,null,{nearD:38,shadow:false}),shrub:add(shrubG,null,{nearD:32,shadow:false}),dead:add(deadG,null,{nearD:120}),rock:add(rockG,null,{nearD:75})};
    const Sz=VOLCANO.size/2;let placed=0;
    for(let n=0;n<26000&&placed<9000;n++){const u=(rand()*2-1)*Sz,v=(rand()*2-1)*Sz,h=this.hAt(u,v);if(h<1.2)continue;
      const shore=coastR(Math.atan2(v,u))-Math.hypot(u,v),dc=Math.hypot(u-CONE.u,v-CONE.v),td=trailDist(u,v),dp=Math.hypot(u-TEMPLE.u,v-TEMPLE.v),dr=Math.min(polyDist(u,v,RIVER)-RIVER_W,Math.hypot(u-LAGOON.u,v-LAGOON.v)-LAGOON.r);
      const ctx_=u-TEMPLE.u,ctz=v-TEMPLE.v;if(td<2.4||dp<44||dr<1.5||(Math.abs(ctx_)<9&&ctz>15&&ctz<84)||(Math.abs(u-WF.u)<11&&v>WF.v-4&&v<WF.v+3))continue;const r=rand(),yaw=rand()*6.28,x=u,z=v;
      if(dc<CONE.cr+4)continue;
      if(dc<70){if(r<.05){S.dead.add(x,h,z,.8+rand()*.5,yaw);this.solid({x,z,r:.35});placed++;}else if(r<.2){S.rock.add(x,h,z,.6+rand()*2.2,yaw);placed++;}continue;}
      if(shore<22){if(r<.3){S.palm.add(x,h,z,.8+rand()*.45,yaw);this.solid({x,z,r:.3});placed++;}else if(r<.4){S.rock.add(x,h,z,.5+rand()*1.5,yaw);placed++;}else if(r<.55){S.bush.add(x,h,z,.7+rand()*.6,yaw);placed++;}continue;}
      const dense=dr<14?1.25:1;
      if(r<.2*dense){S.tree.add(x,h,z,.8+rand()*.6,yaw,new THREE.Color().setHSL(.28+rand()*.06,.45,.42+rand()*.2));this.solid({x,z,r:.35});placed++;}
      else if(r<.24){S.giant.add(x,h,z,.85+rand()*.4,yaw);this.solid({x,z,r:1.1});placed++;}
      else if(r<.34){S.fern.add(x,h,z,.8+rand()*.5,yaw);this.solid({x,z,r:.25});placed++;}
      else if(r<.52){S.bush.add(x,h,z,.6+rand()*.9,yaw);placed++;}
      else if(r<.66){S.leaf.add(x,h,z,.7+rand()*.7,yaw);placed++;}
      else if(r<.82){S.shrub.add(x,h,z,.7+rand()*.8,yaw);placed++;}
      else if(r<.86){S.rock.add(x,h,z,.4+rand()*1.4,yaw);placed++;}}
    // margens do rio: juncos e pedras
    const reedG=kitGeometry((k,m)=>{for(let i=0;i<9;i++){const a=i*.7,r=.2+rand()*.3;k.add(m,sway(limb(V(Math.cos(a)*r,0,Math.sin(a)*r),V(Math.cos(a)*r*1.6,1.6+rand(),Math.sin(a)*r*1.6),.03,.01,3),v=>v.y/2),0x6a7a3a,.12);}});
    const reeds=add(reedG,null,{nearD:40,shadow:false});
    for(let n=0;n<3000;n++){const i=Math.floor(rand()*(RIVER.length-1)),t=rand(),[ax,az]=RIVER[i],[bx,bz]=RIVER[i+1],side=rand()<.5?-1:1,len=Math.hypot(bx-ax,bz-az),nx=-(bz-az)/len,nz=(bx-ax)/len,off=RIVER_W+.5+rand()*3;
      const x=ax+(bx-ax)*t+nx*off*side,z=az+(bz-az)*t+nz*off*side,h=this.hAt(x,z);if(h<-.2||h>2.5||Math.abs(x-BRIDGE.u0)<3&&Math.abs(z-BRIDGE.v)<3)continue;if(rand()<.7)reeds.add(x,h,z,.7+rand()*.5,rand()*6);else S.rock.add(x,h,z,.4+rand()*.8,rand()*6);}}
  // ======================= rio: ponte de cordas, píer de pedra, tronco caído =======================
  buildRiverside(){const k=new Kit(),wood=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.9}),rope=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1});
    // ponte de cordas: pranchas, cordas de mão com caimento e postes nas margens
    const n=34;for(let i=0;i<n;i++){const t=(i+.5)/n,u=lerp(BRIDGE.u0,BRIDGE.u1,t),y=this.deck(t);k.add(wood,box([u,y-.06,BRIDGE.v],[(BRIDGE.u1-BRIDGE.u0)/n*.8,.07,2.2],[0,0,(rand()-.5)*.08]),i%4?0x6a4a2e:0x5a3e26,.1);}
    for(const s of [-1,1]){const pts=[];for(let i=0;i<=20;i++){const t=i/20;pts.push(V(lerp(BRIDGE.u0,BRIDGE.u1,t),this.deck(t)+1-.25*Math.sin(t*Math.PI),BRIDGE.v+s*1.15));}
      for(let i=0;i<20;i++)k.add(rope,limb(pts[i],pts[i+1],.035,.035,4),0x8a7050,.05);for(let i=1;i<20;i+=2){const t=i/20;k.add(rope,limb(V(pts[i].x,this.deck(t),BRIDGE.v+s*1.1),pts[i],.02,.02,3),0x8a7050,.05);}
      for(const u of [BRIDGE.u0-.4,BRIDGE.u1+.4]){const y=this.hAt(u,BRIDGE.v+s*1.2);k.add(wood,limb(V(u,y-.5,BRIDGE.v+s*1.2),V(u,y+1.9,BRIDGE.v+s*1.2),.14,.12,6),0x4a3420,.08);this.solid({x:u,z:BRIDGE.v+s*1.2,r:.2});}}
    // píer de pedra na lagoa (onde o barco encosta) com amarras
    const pu=LAGOON.u-12,pv=LAGOON.v+10;for(let i=0;i<6;i++)k.add(wood,box([pu+i*1.6,.55,pv],[1.5,.4,2.4]),0x3b3634,.06);for(const i of [0,5])k.add(wood,limb(V(pu+i*1.6,.2,pv+1),V(pu+i*1.6,1.3,pv+1),.12,.1,6),0x4a3420,.08);
    this.solid({x0:pu-.8,x1:pu+8.8,z0:pv-1.2,z1:pv+1.2,y0:-5,y1:.4});
    // tronco caído atravessando um igarapé e raízes expostas
    k.add(wood,limb(V(-44,this.hAt(-44,96)+.3,96),V(-34,this.hAt(-34,101)+.5,101),.55,.45,8),0x4a3a2c,.08);
    const mesh=k.build();this.nearG.add(mesh);
    this.bridgeProxy=null;}
  // ======================= cratera acesa e fumaça =======================
  buildVolcanoTop(){const C=CONE,lavaY=this.hAt(C.u,C.v)+1.5,rimY=this.hAt(RIM.u,RIM.v);this.lavaY=lavaY;this.ledgeY=rimY+.35;
    // lago de lava: correnteza com crosta que racha, veios brilhantes e pulso de calor
    this.lavaMat=new THREE.ShaderMaterial({uniforms:{uTime:U.uTime,uBoost:{value:0}},vertexShader:'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
      fragmentShader:`uniform float uTime,uBoost;varying vec3 vW;float h(vec2 p){return fract(sin(dot(p,vec2(12.9,78.2)))*43758.5);}float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
      float fb(vec2 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*n(p);p*=2.1;a*=.5;}return s;}
      void main(){vec2 p=vW.xz*.16;vec2 w=vec2(fb(p+uTime*.05),fb(p.yx-uTime*.04));float a=fb(p+w*1.6+vec2(uTime*.03,0.));float crust=smoothstep(.48,.6,a);float vein=1.-smoothstep(0.,.045,abs(a-.52));
        float pulse=.85+.15*sin(uTime*1.7+fb(p*3.)*6.);vec3 hot=mix(vec3(2.2,.55,.07),vec3(3.2,1.45,.35),fb(p*4.+uTime*.3))*pulse;vec3 c=mix(hot,vec3(.06,.03,.02)+vec3(1.4,.3,.05)*vein,crust*.92);c*=1.+uBoost*(1.+.5*sin(uTime*5.+fb(p*2.)*6.));gl_FragColor=vec4(c,1.);}`});
    const lava=new THREE.Mesh(new THREE.CircleGeometry(C.cr*.76,64).rotateX(-Math.PI/2),this.lavaMat);lava.position.set(C.u,lavaY,C.v);this.group.add(lava);
    // paredes da cratera acesas por baixo (casca aditiva que some para cima)
    const shell=new THREE.Mesh(new THREE.CylinderGeometry(C.cr*1.02,C.cr*.74,rimY-lavaY+1,56,1,true),new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,uniforms:{uTime:U.uTime},
      vertexShader:'varying float vY;varying float vA;void main(){vY=uv.y;vA=atan(position.z,position.x);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'uniform float uTime;varying float vY;varying float vA;void main(){float f=pow(1.-vY,2.2)*(.8+.2*sin(uTime*2.+vA*7.));gl_FragColor=vec4(vec3(1.,.36,.06)*f*1.4,f*.75);}'}));
    shell.position.set(C.u,(rimY+lavaY)/2-.5,C.v);this.group.add(shell);
    // rio de lava antigo descendo pela encosta sul (brilha fraco)
    const flow=new THREE.Mesh(new THREE.PlaneGeometry(4,1,1,40),this.lavaMat);const pts=[];for(let i=0;i<=40;i++){const t=i/40,u=C.u+Math.sin(t*3)*6,v=C.v-C.cr-t*90;pts.push([u,this.hAt(u,v)+.15,v]);}
    const fp=flow.geometry.attributes.position;for(let i=0;i<fp.count;i++){const row=Math.round((fp.getY(i)+.5)*40),[u,y,v]=pts[Math.max(0,Math.min(40,row))];fp.setXYZ(i,u+fp.getX(i),y,v);}fp.needsUpdate=true;flow.geometry.computeVertexNormals();this.nearG.add(flow);
    // brasas subindo e jatos de lava (partículas na GPU, nada de CPU por quadro)
    const gpu=(N,vs,fs)=>{const g=new THREE.BufferGeometry(),s=new Float32Array(N*3);for(let i=0;i<N*3;i++)s[i]=rand();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(N*3),3));g.setAttribute('aSeed',new THREE.BufferAttribute(s,3));
      const m=new THREE.Points(g,new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{uTime:U.uTime,uC:{value:new THREE.Vector3(C.u,lavaY,C.v)},uR:{value:C.cr*.7}},vertexShader:vs,fragmentShader:fs}));m.frustumCulled=false;this.group.add(m);return m;};
    gpu(520,`uniform float uTime,uR;uniform vec3 uC;attribute vec3 aSeed;varying float vA;void main(){float life=fract(uTime*(.05+aSeed.z*.05)+aSeed.x);float a=aSeed.y*6.283+life*2.;float r=sqrt(aSeed.z)*uR;
        vec3 p=uC+vec3(cos(a)*r+life*life*18.,life*70.+sin(uTime*2.+aSeed.x*9.)*1.5,sin(a)*r+life*6.);vA=(1.-life)*(.6+.4*sin(uTime*20.+aSeed.x*50.));vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=(1.+aSeed.y*1.6)*(38./-mv.z);gl_Position=projectionMatrix*mv;}`,
      'varying float vA;void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(vec3(1.,.55,.15)*2.2,vA*smoothstep(.5,0.,d));}');
    gpu(180,`uniform float uTime,uR;uniform vec3 uC;attribute vec3 aSeed;varying float vA;void main(){float k=floor(aSeed.x*7.);float per=3.1+k*.37;float tt=fract(uTime/per+k*.29)*per;
        vec2 o=vec2(cos(k*2.4),sin(k*2.4))*uR*(.2+.6*fract(k*.618));float ang=aSeed.y*6.283;float up=9.+aSeed.z*9.;vec3 vel=vec3(cos(ang)*(1.+aSeed.z*3.),up,sin(ang)*(1.+aSeed.z*3.));
        vec3 p=uC+vec3(o.x,0.,o.y)+vel*tt+vec3(0.,-4.9*tt*tt,0.);vA=step(0.,p.y-uC.y+.2)*step(tt,2.4);vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=(3.+aSeed.z*5.)*(42./-mv.z);gl_Position=projectionMatrix*mv;}`,
      'varying float vA;void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(vec3(1.,.5,.1)*3.,vA*smoothstep(.5,.15,d));}');
    // pináculos de basalto na borda, pontas avermelhadas; fumarolas amarelas de enxofre na encosta
    const k=new Kit(),rockM=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.8});
    for(let i=0;i<70;i++){const a=i/70*6.283+rand()*.05,r=C.cr+1+rand()*7,u=C.u+Math.cos(a)*r,v=C.v+Math.sin(a)*r;if(Math.abs(u-LEDGE.u)<5&&v>C.v)continue;const y=this.hAt(u,v),h=1.5+rand()*5,w=.6+rand()*1.2;
      k.add(rockM,paint(sculpt(new THREE.ConeGeometry(w,h,5,3).translate(0,h/2,0),q=>{q.x+=(hash(q.y,i)-.5)*.3;}).rotateZ((rand()-.5)*.4).translate(u,y-.4,v),(q,c)=>new THREE.Color(0x201c1b).lerp(new THREE.Color(0x7a2a12),Math.max(0,(c.y-y)/h-.55)*1.6)));}
    this.steam=[];for(let i=0;i<6;i++){const a=.8+i*.9,r=C.cr+14+rand()*18,u=C.u+Math.cos(a)*r,v=C.v+Math.sin(a)*r,y=this.hAt(u,v);
      for(let j=0;j<5;j++)k.add(rockM,sculpt(new THREE.CircleGeometry(1.2+rand(),7).rotateX(-Math.PI/2),q=>{q.y+=(hash(q.x,q.z)-.5)*.08;}).translate(u+(rand()-.5)*2,y+.06,v+(rand()-.5)*2),j%2?0xd8c23a:0xb8a02a,.1);
      for(let j=0;j<4;j++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:flameTex(),color:0xf4f2ea,transparent:true,opacity:.25,depthWrite:false}));s.userData={u,v,y,k:j/4};this.group.add(s);this.steam.push(s);}}
    // ===== Beiral do Sacrifício: arco na borda, plataforma sobre a lava, parapeitos, braseiros e o altar na ponta =====
    const st=this.stone,y=this.ledgeY,L=LEDGE,len=L.v0-L.v1,mid=(L.v0+L.v1)/2;
    k.add(st,box([L.u,y-.45,mid],[L.w*2,.9,len]),0x6f685f,.03);for(let i=0;i<4;i++){const v=L.v0-2-i*2.4;k.add(st,limb(V(L.u,y-.9,v),V(L.u,y-7-i*2,v+2.5),.35,.5,6),0x4a443f,.05);}
    for(const s of [-1,1]){k.add(st,box([L.u+s*(L.w-.15),y+.35,mid],[.3,.7,len]),0x7a7268,.03);this.solid({x0:L.u+s*(L.w-.15)-.15,x1:L.u+s*(L.w-.15)+.15,z0:L.v1,z1:L.v0,y0:y-1,y1:y+1});
      for(let i=0;i<5;i++)k.add(st,box([L.u+s*(L.w-.15),y+.82,L.v0-1-i*2.2],[.4,.25,.4]),0x6a635a,.03);}
    k.add(st,box([L.u,y+.3,L.v1+.6],[L.w*2,.6,.5]),0x6f685f,.03);this.solid({x0:L.u-L.w,x1:L.u+L.w,z0:L.v1,z1:L.v1+.9,y0:y-1,y1:y+1});
    // altar da ponta: bacia de pedra com glifos, onde o Coração será oferecido
    k.add(st,box([L.u,y+.55,L.v1+1.9],[1.6,1.1,1.1]),0x857d72,.03).add(st,hollow(loft([{y:y+1.1,rx:.7,rz:.5},{y:y+1.35,rx:.8,rz:.6}],{n:12,capStart:true,capEnd:false}),.86,.03).translate(L.u,0,L.v1+1.9),0x6a635a,.03);this.solid({x0:L.u-.8,x1:L.u+.8,z0:L.v1+1.35,z1:L.v1+2.45,y0:y-1,y1:y+1.4});
    // arco de entrada com lintel de glifos
    for(const s of [-1,1]){k.add(st,box([L.u+s*2.1,y+2,L.v0+.4],[.8,4,.8]),0x7e766c,.03);this.solid({x0:L.u+s*2.1-.4,x1:L.u+s*2.1+.4,z0:L.v0,z1:L.v0+.8,y0:y-1,y1:y+4});brazier(k,this.dark,[L.u+s*1.2,y,L.v0-1.2]);this.addTorch(L.u+s*1.2,y+1.35,L.v0-1.2,.7,this.group,1.2);}
    k.add(st,box([L.u,y+4.3,L.v0+.4],[5.2,.7,1]),0x6f685f,.03);const lintel=new THREE.Mesh(new THREE.PlaneGeometry(4.6,.55),friezeMat(2));lintel.position.set(L.u,y+4.3,L.v0+.91);this.group.add(lintel);
    this.group.add(k.build());
    // coluna de fumaça (escura em cima, laranja embaixo, acesa pela lava) e o brilho visto de longe
    this.smoke=[];for(let i=0;i<26;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:flameTex(),color:0x3a3533,transparent:true,opacity:.5,depthWrite:false}));s.userData.k=i/26;this.group.add(s);this.smoke.push(s);}
    const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:flameTex(),color:new THREE.Color(2.5,.7,.2),transparent:true,opacity:.7,depthWrite:false,blending:THREE.AdditiveBlending}));glow.position.set(C.u,lavaY+6,C.v);glow.scale.setScalar(55);this.group.add(glow);this.glow=glow;}
  // ======================= templo por fora =======================
  buildTemple(){const T=TEMPLE,k=new Kit(),kd=new Kit(),st=this.stone,dark=this.dark,gold=this.gold,y0=T.y0,W=(x,z)=>[T.u+x,T.v+z];
    const P=(x,y,z)=>[T.u+x,y,T.v+z];
    // degraus da pirâmide (o degrau de cima tem o vão da escada interna)
    // o túnel da escada (|x|<2 com as paredes, do vão do santuário até o Nível 1) é escavado em cada degrau
    const tf=ROOMS[0].f,tcl=ROOMS[0].c,HW=2;
    for(let i=0;i<3;i++){const s=TIER[i],yb=y0+5*i,yt=y0+5*(i+1),col=i===2?0x958c80:i?0x8a8278:0x7e766c;
      k.add(st,box(P((-s-HW)/2,(yb+yt)/2,0),[s-HW,5,s*2]),col,.03).add(st,box(P((s+HW)/2,(yb+yt)/2,0),[s-HW,5,s*2]),col,.03);
      let run=null;const flush=()=>{if(!run)return;for(const [a,b]of run.parts)k.add(st,box(P(0,(a+b)/2,(run.z0+run.z1)/2),[HW*2,b-a,run.z1-run.z0]),col,.03);run=null;};
      for(let z=-s;z<s-1e-6;z+=.5){const za=z,zb=Math.min(s,z+.5);let parts;
        if(i===2&&za>=-3-1e-6&&zb<=3+1e-6)parts=[];
        else if(zb<=-19||za>=3)parts=[[yb,yt]];
        else{const up=tf(zb)+tcl+.05,lo=tf(za)-1.85;parts=[];if(lo>yb)parts.push([yb,Math.min(yt,lo)]);if(up<yt)parts.push([Math.max(yb,up),yt]);}
        const key=parts.map(q=>q.map(v=>v.toFixed(2)).join('/')).join('|');if(run&&run.key===key)run.z1=zb;else{flush();run={key,parts,z0:za,z1:zb};}}flush();
      // cornija (moldura, não laje: a laje inteira tampava o vão da escada) e friso de glifos em volta de cada degrau
      for(const [x,z,w,d]of [[0,s-.2,s*2+.8,1.2],[0,-s+.2,s*2+.8,1.2],[s-.2,0,1.2,s*2-1.6],[-s+.2,0,1.2,s*2-1.6]])k.add(st,box(P(x,yt-.15,z),[w,.35,d]),0x6f685f,.03);
      for(const [x,z,ry,len]of [[0,s+.02,0,s*2],[0,-s-.02,Math.PI,s*2],[s+.02,0,Math.PI/2,s*2],[-s-.02,0,-Math.PI/2,s*2]]){const f=new THREE.Mesh(new THREE.PlaneGeometry(len-.4,1.1),friezeMat(i));f.position.set(...P(x,yt-1.1,z));f.rotation.y=ry;kd.addMesh=kd.addMesh||[];kd.addMesh.push(f);}
      // máscaras de pedra nos cantos (nariz curvo, olhos fundos, dentes)
      for(const [sx,sz]of [[1,1],[-1,1],[1,-1],[-1,-1]])mask(kd,st,P(sx*(s-.2),yb+2.4,sz*(s-.2)),Math.atan2(sx,sz));}
    // escadaria norte: 42 degraus de verdade, balaustradas com cabeças de serpente embaixo
    for(let i=0;i<41;i++){const z0=30.5-i*.5,y=y0+i*15/41;k.add(st,box(P(0,y+.18,z0-.25),[6.2,.36+.02,.5]),i%2?0x8f877c:0x857d72,.02);k.add(st,box(P(0,y-.9,z0-.25),[6.2,2.2,.5]),0x6f685f,.02);}
    for(const sx of [-1,1]){const pts=[];for(let i=0;i<=10;i++){const t=i/10;pts.push(V(T.u+sx*3.45,y0+15*t+.7,T.v+30.5-20.5*t));}for(let i=0;i<10;i++)k.add(st,limb(pts[i],pts[i+1],.42,.42,6),0x7a7268,.03);
      serpent(kd,st,V(T.u+sx*3.45,y0+.2,T.v+31.3),sx);this.solid({x0:T.u+sx*3.45-.45,x1:T.u+sx*3.45+.45,z0:T.v+10,z1:T.v+31.5,y0:y0-1,y1:y0+17});}
    // santuário no topo: paredes com porta norte, quatro colunas, teto com crista e o vão escuro da escada
    const ty=TOP,wall=(x0,x1,z0,z1)=>{k.add(st,box(P((x0+x1)/2,ty+2.5,(z0+z1)/2),[x1-x0,5,z1-z0]),0x9a9084,.03);this.solid({x0:T.u+x0,x1:T.u+x1,z0:T.v+z0,z1:T.v+z1,y0:ty-.3,y1:ty+5});};
    wall(-5.5,5.5,-5.5,-4.7);wall(-5.5,-4.7,-5.5,5.5);wall(4.7,5.5,-5.5,5.5);wall(-5.5,-1.8,4.7,5.5);wall(1.8,5.5,4.7,5.5);
    k.add(st,box(P(0,ty+5.3,0),[12,.6,12]),0x7a7268,.03).add(st,box(P(0,ty+6.4,0),[9,1.6,9]),0x857d72,.03);for(let i=-3;i<=3;i++)k.add(st,box(P(i*1.2,ty+8,0),[.5,1.6,.9]),0x8a8278,.04);
    k.add(st,box(P(0,ty+4.3,5.1),[3.8,.6,.9]),0x6a635a,.02);
    for(const x of [-3.4,3.4])for(const z of [6.6,8.6]){column(k,st,P(x,ty,z),4.9);this.solid({x:T.u+x,z:T.v+z,r:.45,y0:ty-.5,y1:ty+5});}
    k.add(st,box(P(0,ty+5.1,7.6),[8.6,.4,3.2]),0x7a7268,.03);
    // estátuas guardiãs na porta e na calçada, braseiros acesos
    for(const sx of [-1,1]){guardian(kd,st,P(sx*2.6,ty,6.2),Math.PI,1);this.solid({x:T.u+sx*2.6,z:T.v+6.2,r:.6,y0:ty-.5,y1:ty+3});}
    for(let i=0;i<3;i++)for(const sx of [-1,1]){const z=36+i*7;guardian(kd,st,P(sx*5,y0,z),sx>0?-Math.PI/2:Math.PI/2,1.5);this.solid({x:T.u+sx*5,z:T.v+z,r:.9,y0:y0-1,y1:y0+5});}
    for(let i=0;i<12;i++)k.add(st,box(P(0,y0+.06,31+i*1.6),[4,.12,1.5]),i%2?0x7a7268:0x6f685f,.05);
    for(const [x,z,y]of [[-4.5,31.5,y0],[4.5,31.5,y0],[-2.2,9.2,ty],[2.2,9.2,ty]]){brazier(kd,dark,P(x,y,z));this.addTorch(T.u+x,y+1.35,T.v+z,.9,this.group,1.3);this.solid({x:T.u+x,z:T.v+z,r:.45,y0:y-.5,y1:y+1.4});}
    // estela com glifos no começo da calçada
    k.add(st,box(P(0,y0+1.4,56),[1.6,2.8,.5]),0x857d72,.03);const stela=new THREE.Mesh(new THREE.PlaneGeometry(1.4,2.5),glyphMat('stela'));stela.position.set(...P(0,y0+1.45,56.27));(kd.addMesh=kd.addMesh||[]).push(stela);this.solid({x0:T.u-.8,x1:T.u+.8,z0:T.v+55.7,z1:T.v+56.3,y0:y0-1,y1:y0+3});
    // cipós pendurados nas beiradas e musgo escorrendo
    for(let i=0;i<40;i++){const side=i%4,s=TIER[i%3],t=rand()*2-1,x=side<2?t*s:(side===2?s:-s),z=side<2?(side?s:-s):t*s,y=y0+5*((i%3)+1);const len=1+rand()*3;kd.add(this.vineMat||(this.vineMat=jungleMaterial()),sway(limb(V(T.u+x*1.01,y,T.v+z*1.01),V(T.u+x*1.03,y-len,T.v+z*1.03),.03,.02,3),()=>.3),0x2f5a24,.12);}
    // dentro do santuário: parapeito em volta do vão da escada, serpentes de pedra na boca, altar de oferendas e murais
    for(const sx of [-1,1]){k.add(st,box(P(sx*1.75,ty+.35,0),[.4,.7,6.2]),0x7a7268,.03);this.solid({x0:T.u+sx*1.75-.2,x1:T.u+sx*1.75+.2,z0:T.v-3.1,z1:T.v+3.1,y0:ty-.5,y1:ty+1});serpent(kd,st,V(T.u+sx*1.75,ty+.4,T.v+3.4),sx);}
    k.add(st,box(P(0,ty+.35,-3.3),[3.9,.7,.4]),0x7a7268,.03);this.solid({x0:T.u-1.95,x1:T.u+1.95,z0:T.v-3.5,z1:T.v-3.1,y0:ty-.5,y1:ty+1});
    k.add(st,box(P(0,ty+.5,-4.15),[3.2,1,.9]),0x857d72,.03);for(const x of [-1,0,1]){kd.add(this.metal,hollow(loft([{y:ty+1,rx:.2,rz:.2},{y:ty+1.06,rx:.27,rz:.27},{y:ty+1.2,rx:.3,rz:.3}],{n:14,capStart:true,capEnd:false}),.86,.03).translate(T.u+x,0,T.v-4.15),0x6a4a2a,.05);kd.add(this.embers||(this.embers=new THREE.MeshStandardMaterial({vertexColors:true,emissive:0xff5a18,emissiveIntensity:1.6,roughness:.9})),ellipsoid([T.u+x,ty+1.1,T.v-4.15],[.22,.05,.22],10,4),0x3a1408,.2);}
    for(const [x,ry]of [[-4.68,Math.PI/2],[4.68,-Math.PI/2]]){const m=new THREE.Mesh(new THREE.PlaneGeometry(4,2.6),glyphMat(x<0?'lv1':'lv4'));m.position.set(...P(x,ty+2.4,0));m.rotation.y=ry;(kd.addMesh=kd.addMesh||[]).push(m);}
    for(const sx of [-1,1]){kd.add(this.metal,limb(V(...P(sx*4.6,ty+1.8,-3)),V(...P(sx*4.25,ty+2.3,-3)),.04,.05,5),0x3a2a1e,.05);this.addTorch(T.u+sx*4.2,ty+2.6,T.v-3,1.6,this.group,.75);}
    const base=k.build();this.templeBase=base;this.nearG.add(base);const det=kd.build();for(const m of kd.addMesh||[])det.add(m);this.templeDetail=det;this.nearG.add(det);
    // versão de longe: só os três blocos
    const kf=new Kit();for(let i=0;i<3;i++)kf.add(st,box(P(0,y0+5*i+2.5,0),[TIER[i]*2,5,TIER[i]*2]),0x857d72,.03);kf.add(st,box(P(0,TOP+3,0),[11,6,11]),0x8a8278,.03);this.farG.add(kf.build());}
  // ======================= templo por dentro: salas, armadilhas, puzzles e o Coração =======================
  buildInterior(){const T=TEMPLE,k=new Kit(),kd=new Kit(),si=this.stoneIn,dark=this.dark,metal=this.metal,gold=this.gold,P=(x,y,z)=>[T.u+x,y,T.v+z];this.interior=new THREE.Group();
    // grade de 0,5 m: piso de cada célula; paredes onde uma célula de sala encosta em rocha
    const cs=.5,nx=Math.round((DUNGEON.x1-DUNGEON.x0)/cs),nz=Math.round((DUNGEON.z1-DUNGEON.z0)/cs),F=new Float32Array(nx*nz).fill(NaN),C=new Float32Array(nx*nz),DS=new Uint8Array(nx*nz);
    for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const x=DUNGEON.x0+(i+.5)*cs,z=DUNGEON.z0+(j+.5)*cs,r=roomAt(x,z);if(r){F[j*nx+i]=interiorFloor(x,z);C[j*nx+i]=r.c;DS[j*nx+i]=r.dais?1:r.stairs?2:0;}}
    const at=(i,j)=>i<0||j<0||i>=nx||j>=nz?NaN:F[j*nx+i];
    for(let j=0;j<nz;j++){let run=null;const flush=()=>{if(!run)return;const x0=DUNGEON.x0+run.i0*cs,x1=DUNGEON.x0+(run.i1+1)*cs,z=DUNGEON.z0+(j+.5)*cs;k.add(si,box(P((x0+x1)/2,(run.b+run.t)/2,z),[x1-x0,run.t-run.b,cs]),0x6a625a,.03);run=null;};
      for(let i=0;i<nx;i++){if(!isNaN(at(i,j))){flush();continue;}const nb=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,1],[-1,1],[1,-1]].filter(([di,dj])=>!isNaN(at(i+di,j+dj)));
        if(!nb.length){flush();continue;}let b=1e9,t=-1e9;for(const [di,dj]of nb){const f=at(i+di,j+dj),c=C[(j+dj)*nx+(i+di)];b=Math.min(b,f-.3);t=Math.max(t,f+c+.3);}
        {const wx=DUNGEON.x0+(i+.5)*cs,wz=DUNGEON.z0+(j+.5)*cs,top=pyramidTop(wx,wz)??this.hAt(T.u+wx,T.v+wz);t=Math.min(t,top-.02);}b=Math.round(b*4)/4;t=Math.round(t*4)/4;if(t<=b+.05){flush();continue;}
        if(run&&Math.abs(run.b-b)<.01&&Math.abs(run.t-t)<.01&&run.i1===i-1)run.i1=i;else{flush();run={i0:i,i1:i,b,t};}}flush();}
    // degraus entre pisos diferentes (borda do fosso) e vergas onde o teto muda de altura
    for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const f=at(i,j);if(isNaN(f))continue;for(const [di,dj]of [[1,0],[0,1]]){const g=at(i+di,j+dj);if(isNaN(g))continue;{const a=DS[j*nx+i],b=DS[(j+dj)*nx+i+di];if(a===1||b===1||(a===2&&b===2))continue;}const x=DUNGEON.x0+(i+.5+di*.5)*cs,z=DUNGEON.z0+(j+.5+dj*.5)*cs;
      if(Math.abs(g-f)>=.4){const lo=Math.min(f,g),hi=Math.max(f,g);k.add(si,box(P(x,(lo+hi)/2,z),[dj?cs:.12,hi-lo,di?cs:.12]),0x5f574f,.03);}
      const ca=f+C[j*nx+i],cb=g+C[(j+dj)*nx+i+di];if(Math.abs(ca-cb)>=.3){const lo=Math.min(ca,cb),hi=Math.max(ca,cb);k.add(si,box(P(x,(lo+hi)/2,z),[dj?cs:.3,hi-lo,di?cs:.3]),0x5f574f,.03);}}}
    // pisos e tetos (as escadas têm degraus maciços, sem vão por baixo)
    for(const r of ROOMS){if(r.dais)continue;const [x0,x1]=r.x,[z0,z1]=r.z,fz=typeof r.f==='function'?r.f:()=>r.f,w=x1-x0;
      if(r.stairs){const n=Math.ceil((z1-z0)/.42);for(let q=0;q<n;q++){const za=z0+q*(z1-z0)/n,zb=za+(z1-z0)/n,y=fz((za+zb)/2);k.add(si,box(P((x0+x1)/2,y-.9,(za+zb)/2),[w,1.8,zb-za+.02]),q%2?0x6a625a:0x625a52,.03);}}
      else{k.add(si,quad(P(x0,fz(z1),z1),P(x1,fz(z1),z1),P(x1,fz(z0),z0),P(x0,fz(z0),z0)),r.pit?0x3a3430:0x77706a,.05);}
      const ze=r===ROOMS[0]?-3:z1;k.add(dark,quad(P(x0,fz(z0)+r.c,z0),P(x1,fz(z0)+r.c,z0),P(x1,fz(ze)+r.c,ze),P(x0,fz(ze)+r.c,ze)),0x3f3934,.04);}
    // tochas nas paredes (luz "falsa" do material, sem luz de verdade)
    const torch=(x,y,z,face)=>{kd.add(metal,limb(V(...P(x,y-.5,z)),V(...P(x+face[0]*.35,y,z+face[1]*.35)),.04,.05,5),0x3a2a1e,.05);kd.add(metal,new THREE.CylinderGeometry(.12,.07,.22,8).translate(...P(x+face[0]*.4,y+.05,z+face[1]*.4)),0x2a2420,.05);this.addTorch(T.u+x+face[0]*.4,y+.3,T.v+z+face[1]*.4,1.7,this.interior,.75);};
    torch(-1.45,L1+13,-8,[1,0]);torch(1.45,L1+6,-15,[-1,0]);
    // mural de cada nível: o número em glifos e a "regra" do puzzle desenhada na pedra
    const mural=(x,y,z,ry,key)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(2.6,1.9),glyphMat(key));m.position.set(...P(x,y,z));m.rotation.y=ry;this.interior.add(m);kd.add(si,box(P(x-Math.sin(ry)*.06,y,z-Math.cos(ry)*.06),[Math.abs(Math.cos(ry))*2.9+.12,2.2,Math.abs(Math.sin(ry))*2.9+.12]),0x5a524a,.03);};
    // ======== NÍVEL 1 · Salão dos Dardos: placas de pressão, paredes furadas, esqueleto ========
    for(const z of [-22,-32])for(const sx of [-1,1])torch(sx*5.95,L1+2.3,z,[-sx,0]);
    mural(-3.5,L1+2.2,-19.1,Math.PI,'lv1');
    {const byG={};for(let rr=0;rr<L1T.rows;rr++)for(let c=0;c<L1T.cols;c++){const x=L1T.x0+c*L1T.dx,z=L1T.z0+rr*L1T.dz,g=l1Glyph(rr,c);kd.add(si,box(P(x,L1+.04,z),[1.7,.08,1.8]),0x6d655d,.05);
        (byG[g]||(byG[g]=[])).push(new THREE.PlaneGeometry(1.25,1.25).rotateX(-Math.PI/2).translate(...P(x,L1+.085,z)));}
      for(const g in byG){const m=new THREE.Mesh(mergeGeometries(byG[g]),glyphMat('G'+g));m.receiveShadow=true;this.interior.add(m);}
      // placa de pressão diante do portão: quem chega nela (pelo caminho certo) ergue a pedra
      kd.add(si,new THREE.CylinderGeometry(1.1,1.2,.1,20).translate(...P(0,L1+.05,-35.2)),0x5a524a,.03);this.l1Plate=new THREE.Mesh(new THREE.CylinderGeometry(.85,.85,.08,20),new THREE.MeshStandardMaterial({color:0x9a7a4a,metalness:.5,roughness:.5,emissive:0x3a2008,emissiveIntensity:.4}));this.l1Plate.position.set(...P(0,L1+.1,-35.2));this.interior.add(this.l1Plate);}
    for(const sx of [-1,1])for(let r=0;r<4;r++)for(let c=0;c<14;c++)kd.add(dark,new THREE.CylinderGeometry(.045,.045,.1,6).rotateZ(Math.PI/2).translate(...P(sx*5.97,L1+.6+r*.55,-20.5-c*1.05)),0x0b0908,.02);
    for(let i=0;i<9;i++){const z=-21-rand()*13,x=(rand()-.5)*10;kd.add(metal,limb(V(...P(x,L1+.03,z)),V(...P(x+(rand()-.5)*.4,L1+.05,z+.35)),.012,.004,4),0x5a4a38,.05);}
    skeleton(kd,si,P(-2.5,L1,-31),.6);
    // ======== NÍVEL 2 · Fosso das Lanças e Galeria das Lâminas ========
    torch(-5.95,L2+2.4,-50,[1,0]);torch(5.95,L2+2.4,-66,[-1,0]);torch(-2.45,L2+2.8,-72,[1,0]);torch(2.45,L2+2.8,-80,[-1,0]);
    mural(0,L2+2.4,-48.1,Math.PI,'lv2');
    const spikes=[];for(let x=-5.7;x<=5.7;x+=.55)for(let z=-64.6;z<=-51.4;z+=.55){if(Math.abs(x)<.7||(x<-4.5&&z<-58))continue;spikes.push(new THREE.ConeGeometry(.07,.8+rand()*.4,5).translate(...P(x+(rand()-.5)*.15,L2-2.6+.45,z+(rand()-.5)*.15)));}
    kd.add(metal,mergeGeometries(spikes),0x6a5a4a,.08);kd.add(si,box(P(0,L2-.3,-58),[1.1,.6,14]),0x77706a,.03);for(let i=0;i<4;i++)kd.add(si,box(P(0,L2-1.5,-53-i*3.2),[.5,2.4,.5]),0x5a524a,.03);
    for(let i=0;i<6;i++)kd.add(dark,box(P(1.6+rand()*3.4,L2-2.55,-52-rand()*12),[.3,.08,1.2],[0,rand()*3,0]),0x4a3a2a,.1);skeleton(kd,si,P(3.2,L2-2.6,-56),.5);
    this.blades=[];for(let i=0;i<4;i++){const z=BLADES[i],g=new THREE.Group(),bk=new Kit();bk.add(metal,limb(V(0,0,0),V(0,-5,0),.06,.06,6),0x3a3430,.05);
      const sh=new THREE.Shape();sh.moveTo(-1.4,0);sh.quadraticCurveTo(0,-1.4,1.4,0);sh.lineTo(1.1,.2);sh.quadraticCurveTo(0,-.7,-1.1,.2);sh.closePath();
      bk.add(metal,new THREE.ExtrudeGeometry(sh,{depth:.05,bevelEnabled:true,bevelSize:.03,bevelThickness:.02,bevelSegments:1}).translate(0,-5.2,-.025),0x8a8a88,.04);bk.add(metal,box([0,-4.95,0],[.35,.35,.18]),0x3a3430,.05);bk.add(gold,new THREE.CylinderGeometry(.42,.42,.06,20).rotateX(Math.PI/2).translate(0,-4.5,0),0xc8983a,.04);
      g.add(bk.build());for(const sd of [-1,1]){const gl=new THREE.Mesh(new THREE.CircleGeometry(.36,24),glyphMat('G'+BLADE_G[i]));gl.position.set(0,-4.5,sd*.035);if(sd<0)gl.rotation.y=Math.PI;g.add(gl);}g.position.set(...P(0,L2+6.5,z));g.rotation.z=(i%2?1:-1)*.9;this.interior.add(g);this.blades.push(g);kd.add(dark,box(P(0,L2+6.55,z),[5,.1,.25]),0x0a0908,.02);}
    // bola de pedra no nicho do fim da galeria (a armadilha que desce a escada)
    const boulder=sculpt(new THREE.IcosahedronGeometry(1.15,3),v=>{v.multiplyScalar(1+(fbm(v.x*2.3,v.z*2.3+v.y)-.5)*.12);});boulder.translate(...P(3.6,L2-2.6+1.1,-62.5));kd.add(si,boulder,0x6a625a,.04);
    // quatro botões de glifo no fim da galeria (dois em cada parede)
    this.buttons=BUTTONS.map((b,i)=>{kd.add(si,box(P(b.x-b.f*.02,L2+1.5,b.z),[.12,.8,.8]),0x5a524a,.03);const g=new THREE.Group(),bk=new Kit();bk.add(si,box([0,0,0],[.6,.6,.14]),0x857d72,.03);g.add(bk.build());
      const face=new THREE.Mesh(new THREE.PlaneGeometry(.5,.5),glyphMat('G'+b.g));face.position.z=.075;g.add(face);const glow=new THREE.Mesh(new THREE.PlaneGeometry(.62,.62),new THREE.MeshBasicMaterial({color:0xffb040,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));glow.position.z=.08;g.add(glow);g.userData.glow=glow;
      g.position.set(...P(b.x+b.f*.05,L2+1.5,b.z));g.rotation.y=b.f*Math.PI/2;this.interior.add(g);return g;});
    // ======== NÍVEL 3 · Câmara dos Pilares e Sala dos Espelhos ========
    torch(-8.95,L3+2.6,-101,[1,0]);torch(-8.95,L3+2.6,-109,[1,0]);torch(24.95,L3+2.6,-100,[-1,0]);torch(24.95,L3+2.6,-110,[-1,0]);
    mural(0,L3+2.8,-97.1,Math.PI,'lv3');
    this.pillars=[];for(const [x,z]of [[-5,-101],[5,-101],[-5,-109],[5,-109]]){const g=new THREE.Group(),pk=new Kit();pk.add(si,box([0,1.6,0],[1.2,3.2,1.2]),0x8a8278,.03);pk.add(si,box([0,3.35,0],[1.5,.3,1.5]),0x6f685f,.03);
      g.add(pk.build());for(let f=0;f<4;f++){const pl=new THREE.Mesh(new THREE.PlaneGeometry(.9,.9),glyphMat('g'+f));pl.position.set(Math.sin(f*Math.PI/2)*.61,1.8,Math.cos(f*Math.PI/2)*.61);pl.rotation.y=f*Math.PI/2;g.add(pl);}
      kd.add(si,new THREE.CylinderGeometry(1,1,.12,20).translate(...P(x,L3+.06,z)),0x5a524a,.03);g.position.set(...P(x,L3+.12,z));g.rotation.y=((x+z)%4)*Math.PI/2;this.interior.add(g);this.pillars.push(g);this.solid({x:T.u+x,z:T.v+z,r:.9,y0:L3-1,y1:L3+4});}
    for(let a=0;a<3;a++)for(let b=0;b<3;b++){const tile=new THREE.Mesh(new THREE.PlaneGeometry(1.6,1.6).rotateX(-Math.PI/2),glyphMat('t'+((a*3+b*5)%8)));tile.position.set(...P(-1.8+a*1.8,L3+.03,-103.2-b*1.8));this.interior.add(tile);}
    this.mirrors=[];for(const [x,z]of MIRRORS){const g=new THREE.Group(),mk=new Kit();mk.add(si,new THREE.CylinderGeometry(.5,.6,.9,10).translate(0,.45,0),0x77706a,.04);mk.add(metal,limb(V(-.55,.9,0),V(-.55,1.9,0),.05,.05,5),0x8a6a3a,.05).add(metal,limb(V(.55,.9,0),V(.55,1.9,0),.05,.05,5),0x8a6a3a,.05);
      mk.add(gold,new THREE.CylinderGeometry(.5,.5,.05,24).rotateX(Math.PI/2).translate(0,1.55,0),0xd8a84a,.02);g.add(mk.build());g.position.set(...P(x,L3,z));g.rotation.y=MIRROR_START[this.mirrors.length]*Math.PI/4;this.interior.add(g);this.mirrors.push(g);this.solid({x:T.u+x,z:T.v+z,r:.6,y0:L3-1,y1:L3+3});}
    const sun=new THREE.Mesh(new THREE.CircleGeometry(1.3,32),new THREE.MeshStandardMaterial({color:0xd8a84a,metalness:1,roughness:.3,emissive:0x5a3a10,emissiveIntensity:.6}));sun.position.set(...P(24.93,L3+1.55,SUN.z));sun.rotation.y=-Math.PI/2;this.interior.add(sun);this.sun=sun;
    for(let i=0;i<16;i++){const a=i/16*6.28;kd.add(gold,box(P(24.9,L3+1.55+Math.sin(a)*1.75,SUN.z+Math.cos(a)*1.75),[.05,.45,.16],[a,0,0]),0xc8983a,.04);}
    this.beams=[];const beam=new THREE.Mesh(new THREE.CylinderGeometry(.35,.55,4.65,16,1,true),beamMat());beam.position.set(...P(SRC.x,L3+3.87,SRC.z));this.interior.add(beam);this.beams.push(beam);
    // prisma fixo sob o poço: vira a luz para o sul; e o feixe horizontal (segmentos reaproveitados)
    kd.add(si,new THREE.CylinderGeometry(.45,.55,1.1,10).translate(...P(SRC.x,L3+.55,SRC.z)),0x77706a,.04);kd.add(gold,box(P(SRC.x,L3+1.5,SRC.z),[.7,.7,.06],[-Math.PI/4,0,0]),0xd8a84a,.03);this.solid({x:T.u+SRC.x,z:T.v+SRC.z,r:.55,y0:L3-1,y1:L3+2});
    this.beamSegs=Array.from({length:8},()=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,1,8,1,true).rotateX(Math.PI/2),new THREE.MeshBasicMaterial({color:0xffd890,transparent:true,opacity:.55,depthWrite:false,blending:THREE.AdditiveBlending}));m.visible=false;this.interior.add(m);return m;});
    this.beamKey='';
    const boulder2=sculpt(new THREE.IcosahedronGeometry(1.6,2),v=>{v.multiplyScalar(1+(fbm(v.x*1.9,v.z*1.9+v.y)-.5)*.14);});boulder2.translate(...P(23.2,L3+1.4,-111.2));kd.add(si,boulder2,0x5f574f,.05);this.solid({x:T.u+23.2,z:T.v-111.2,r:1.5,y0:L3-1,y1:L3+3});
    // ======== NÍVEL 4 · Câmara do Coração: colunas, fissuras de lava, anel de ladrilhos, ídolo, altar e o artefato ========
    const cy=L4;for(const [x,z]of [[4,-128],[30,-128],[4,-152],[30,-152]])torch(x+(x<17?-.9:.9),cy+3.2,z,[x<17?1:-1,0]);
    mural(17,cy+3,-126.1,Math.PI,'lv4');
    for(let i=0;i<6;i++)for(const x of [7,27]){const z=-131-i*4;column(k,si,P(x,cy,z),9.6);this.solid({x:T.u+x,z:T.v+z,r:.5,y0:cy-1,y1:cy+10});}
    for(let i=0;i<7;i++){const f=new THREE.Mesh(new THREE.PlaneGeometry(.35+rand()*.4,3+rand()*5).rotateX(-Math.PI/2).rotateY(rand()*3),this.lavaMat);f.position.set(...P(9+rand()*16,cy+.02,-131-rand()*18));this.interior.add(f);}
    for(let a=0;a<16;a++){const ang=a/16*6.283,tile=new THREE.Mesh(new THREE.PlaneGeometry(1.4,1.4).rotateX(-Math.PI/2),glyphMat('t'+(a%8)));tile.position.set(...P(17+Math.cos(ang)*6.5,cy+.03,-140+Math.sin(ang)*6.5));tile.rotation.y=-ang;this.interior.add(tile);}
    for(let q=0;q<3;q++)k.add(si,box(P(17,cy+.25+q*.5,-140),[9-q*2.4,.5,8-q*2]),0x7a7268,.03);this.solid({x0:T.u+16.1,x1:T.u+17.9,z0:T.v-140.6,z1:T.v-139.4,y0:cy-1,y1:cy+2.7});
    k.add(si,box(P(17,cy+2.1,-140),[1.8,1.2,1.2]),0x857d72,.03);
    idol(kd,si,gold,P(17,cy,-151.5));this.solid({x0:T.u+13.5,x1:T.u+20.5,z0:T.v-153.5,z1:T.v-148.5,y0:cy-1,y1:cy+9});
    this.heart=heartModel();this.heart.position.set(...P(17,cy+3.4,-140));this.interior.add(this.heart);
    const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.9,1.6,9.6,20,1,true),beamMat(0xffc27a));shaft.position.set(...P(17,cy+5,-140));this.interior.add(shaft);this.beams.push(shaft);
    this.heartTorch=this.torchCount;this.addTorch(T.u+17,cy+3.4,T.v-140,3.2,this.interior,.01);
    for(const [x,y,z]of [[17,cy+9.98,-140],[SRC.x,L3+6.18,SRC.z]]){const o=new THREE.Mesh(new THREE.CircleGeometry(1,24).rotateX(Math.PI/2),new THREE.MeshBasicMaterial({color:0xfff0c8}));o.position.set(...P(x,y,z));this.interior.add(o);}
    // ======== portões de pedra no topo de cada escada (sobem quando o puzzle do nível for resolvido) ========
    this.gateMeshes=GATES.map((g,i)=>{const [x0,x1]=g.x,w=x1-x0,cx=(x0+x1)/2;for(const s of [x0-.25,x1+.25])kd.add(si,box(P(s,g.y+1.75,g.z),[.5,3.5,.7]),0x6f685f,.03);kd.add(si,box(P(cx,g.y+3.65,g.z),[w+1,.5,.8]),0x5f574f,.03);
      const door=new THREE.Group(),dk=new Kit();dk.add(si,box([0,0,0],[w,3.3,.35]),0x7a7268,.03);for(const s of [-1,1])dk.add(metal,box([0,s*1.2,.19],[w*.9,.12,.04]),0x3a3028,.05);door.add(dk.build());
      const face=new THREE.Mesh(new THREE.PlaneGeometry(w*.8,2),glyphMat('gate'+i));face.position.z=.19;door.add(face);door.position.set(...P(cx,g.y+1.65,g.z));this.interior.add(door);
      this.solid({x0:T.u+x0,x1:T.u+x1,z0:T.v+g.z-.3,z1:T.v+g.z+.3,y0:g.y-1,y1:g.y+3.3,gate:i});return door;});
    this.interior.add(k.build(),kd.build());this.group.add(this.interior);}
  // ======================= ruínas espalhadas nas trilhas =======================
  buildRuins(){const k=new Kit(),st=this.stone;const spots=[[-38,138],[-28,100],[30,64],[20,10],[33,-24],[-8,160],[48,120]];
    spots.forEach(([u,v],i)=>{const h=this.hAt(u,v);reseed(900+i);
      if(i%3===0){for(let c=0;c<3;c++){const x=u+c*2.2,y=this.hAt(x,v);column(k,st,[x,y,v],1.5+rand()*2.5);this.solid({x,z:v,r:.45,y0:y-1,y1:y+4});}k.add(st,limb(V(u-2,h+.4,v+2),V(u+3,h+.4,v+2.5),.42,.42,8),0x7a7268,.04);}
      else if(i%3===1){for(let b=0;b<7;b++){const x=u+b*1.1,y=this.hAt(x,v);k.add(st,box([x,y+.35*(1+(b%3)),v],[1,.7*(1+(b%3)),.8]),0x7e766c,.05);}this.solid({x0:u-.5,x1:u+7.2,z0:v-.4,z1:v+.4,y0:h-1,y1:h+2.5});}
      else{guardian(k,st,[u,h,v],rand()*6,1.2);this.solid({x:u,z:v,r:.8,y0:h-1,y1:h+4});}});
    this.nearG.add(k.build());}
  // ======================= por quadro: LOD, fumaça, chamas, lâminas balançando de leve =======================
  update(t,dt,camera){const cam=camera.position,lu=cam.x-VOLCANO.x,lv=cam.z-VOLCANO.z,d=Math.hypot(lu,lv);
    // longe demais (a névoa já cobre): nada é desenhado
    this.group.visible=d<1900;if(!this.group.visible)return;
    const near=d<340;this.nearG.visible=near;this.farG.visible=!near;
    const dt2=Math.hypot(lu-TEMPLE.u,lv-TEMPLE.v);if(this.templeDetail)this.templeDetail.visible=near&&dt2<200;{const tx=lu-TEMPLE.u,tz=lv-TEMPLE.v;this.interior.visible=tx>DUNGEON.x0-40&&tx<DUNGEON.x1+40&&tz>DUNGEON.z0-40&&tz<DUNGEON.z1+60;}
    this.frame=(this.frame||0)+1;if(near&&this.frame%10===0){const dir=camera.getWorldDirection(V());const c=V(lu,0,lv);for(const s of this.scatters)s.update(c,dir);}
    for(const f of this.flames){f.material.opacity=.75+Math.sin(t*14+f.position.x)*.15;f.scale.y=(f.userData.h??=f.scale.y)*(.9+Math.sin(t*9+f.position.z)*.12);}
    for(const s of this.smoke){const k=(s.userData.k+t*.018)%1;s.position.set(CONE.u+Math.sin(k*5+t*.1)*k*18,this.lavaY+4+k*130,CONE.v+Math.cos(k*4)*k*12);const sc=6+k*k*70;s.scale.setScalar(sc);/* some quando a câmera entra na fumaça (antes a tela ficava preta na borda) */const dc=s.getWorldPosition(this._v||(this._v=V())).distanceTo(cam);s.material.opacity=.55*(1-k)*Math.min(1,k*8)*smooth(sc*.25,sc*.75,dc);s.material.color.setRGB(lerp(.9,.23,Math.min(1,k*3)),lerp(.35,.21,Math.min(1,k*3)),lerp(.12,.2,Math.min(1,k*3)));}
    if(this.interior.visible){(this.blades||[]).forEach((b,i)=>{b.rotation.z=Math.sin(t*1.1+i*1.3)*.9;});if(this.heart){this.heart.rotation.y+=dt*.6;this.heart.position.y+=Math.sin(t*1.7)*.002;}for(const b of this.beams||[])b.material.opacity=.16+Math.sin(t*.7)*.03;}
    // o brilho grande da cratera é para quem vê de longe: de perto some (estourava a imagem no Beiral)
    if(this.glow)this.glow.material.opacity=.7*smooth(45,110,this.glow.getWorldPosition(this._v2||(this._v2=V())).distanceTo(cam));
    for(const f of this.anim)f(dt);
    // névoa da cachoeira subindo e se abrindo; o arco-íris respira
    for(const m of this.mist||[]){const k=(m.userData.k+t*.12)%1;m.position.set(WF.u+m.userData.x*(1+k*.6),.3+k*4.5,WF.v+2.6+k*2.2);m.scale.setScalar(2.5+k*6);m.material.opacity=.32*(1-k)*Math.min(1,k*6);}
    if(this.rainbow)this.rainbow.material.uniforms.uA.value=.1+Math.sin(t*.4)*.05;
    for(const s of this.steam||[]){const k=(s.userData.k+t*.09)%1;s.position.set(s.userData.u+k*3,s.userData.y+.5+k*9,s.userData.v);s.scale.setScalar(1.5+k*6);s.material.opacity=.3*(1-k)*Math.min(1,k*5);}
    // portões: sobem devagar quando abertos (e descem quando fechados)
    (this.gateMeshes||[]).forEach((g,i)=>{this.gateY[i]+=((this.gateOpen[i]?3.2:0)-this.gateY[i])*Math.min(1,dt*1.2);g.position.y=GATES[i].y+1.65+this.gateY[i];});
    if(this.interior.visible)this.puzzleFx(t,dt);}
  // estado dos puzzles (world.temple) desenhado: espelhos girando, feixe de luz, botões acesos, placa, coração no altar
  puzzleFx(t,dt){const pz=this.puzzle||{gates:[0,0,0]},k=Math.min(1,dt*8);
    const mir=pz.mir||MIRROR_START;this.mirrors.forEach((g,i)=>{const s=mir[i]||0,u=g.userData;if(u.s===undefined){u.s=MIRROR_START[i];u.target=u.s*Math.PI/4;g.rotation.y=u.target;}if(s!==u.s){u.target+=((s-u.s+8)%8)*Math.PI/4;u.s=s;}g.rotation.y+=(u.target-g.rotation.y)*k;});
    const key=mir.join();if(key!==this.beamKey){this.beamKey=key;const {pts,hit}=beamPath(mir);this.beamHit=hit;
      this.beamSegs.forEach((m,i)=>{const a=pts[i],b=pts[i+1];m.visible=!!b;if(!b)return;const ax=TEMPLE.u+a[0],az=TEMPLE.v+a[1],bx=TEMPLE.u+b[0],bz=TEMPLE.v+b[1];m.position.set((ax+bx)/2,L3+1.55,(az+bz)/2);m.scale.set(1,1,Math.max(.01,Math.hypot(bx-ax,bz-az)));m.rotation.set(0,Math.atan2(bx-ax,bz-az),0);});}
    for(const m of this.beamSegs)m.material.opacity=.42+Math.sin(t*9)*.06+(this.beamHit?.2:0);
    if(this.sun){const want=this.beamHit?2.6:.5;this.sun.material.emissiveIntensity+=(want-this.sun.material.emissiveIntensity)*Math.min(1,dt*2);}
    const flash=Math.max(0,(this.btnFlash||0)-t);this.buttons.forEach((g,i)=>{const on=pz.gates[1]||(pz.seq||[]).includes(i),m=g.userData.glow.material;m.color.set(flash>0?0xff3020:0xffb040);const want=flash>0?.9*(Math.sin(t*30)>0?1:.3):on?.85:0;m.opacity+=(want-m.opacity)*Math.min(1,dt*10);});
    if(this.heart){const here=pz.relic===-1||pz.relic===undefined;this.heart.visible=here;if(this.heartTorch<TORCH_MAX)this.torches[this.heartTorch].w=here?3.2:0;}
    if(this.l1Plate){const down=pz.gates[0]?1:0;this.l1Plate.position.y+=((L1+.1-down*.06)-this.l1Plate.position.y)*k;this.l1Plate.material.emissiveIntensity=down?1.4+Math.sin(t*3)*.3:.4;}}
}
// ======================= peças reutilizáveis =======================
function quad(a,b,c,d){const g=new THREE.BufferGeometry().setFromPoints([V(...a),V(...b),V(...c),V(...a),V(...c),V(...d)]);g.computeVertexNormals();return g;}
function column(k,m,[x,y,z],h){k.add(m,box([x,y+.2,z],[1.1,.4,1.1]),0x6f685f,.03);k.add(m,sculpt(new THREE.CylinderGeometry(.42,.48,h-.8,12,4),v=>{v.x*=1+Math.sin(Math.atan2(v.z,v.x)*12)*.03;}).translate(x,y+.4+(h-.8)/2,z),0x8a8278,.04);k.add(m,box([x,y+h-.2,z],[1.2,.4,1.2]),0x6f685f,.03);}
function mask(k,m,[x,y,z],ry){const g=[];const add=(geo,c)=>{geo.rotateY(ry);geo.translate(x,y,z);k.add(m,geo,c,.04);};
  add(box([0,0,0],[2.2,2.4,.4]),0x7a7268);add(box([0,.9,.3],[2.4,.35,.3]),0x6a635a);for(const s of [-1,1]){add(box([s*.55,.35,.26],[.5,.3,.2]),0x2a2622);add(box([s*1.15,0,.2],[.25,1.2,.3]),0x6a635a);}
  add(sculpt(new THREE.CylinderGeometry(.18,.28,1.2,8),v=>{v.z+=Math.max(0,v.y)*.5;}).rotateX(-.4).translate(0,-.1,.5),0x857d72);for(let i=0;i<5;i++)add(box([-.5+i*.25,-.75,.28],[.14,.25,.14]),0xb8b0a0);}
function serpent(k,m,p,sx){const g=loft([{z:0,cy:0,rx:.45,rz:.4},{z:.5,cy:.05,rx:.55,rz:.5},{z:1.1,cy:0,rx:.5,rz:.35},{z:1.4,cy:-.05,rx:.3,rz:.2}],{axis:'z',n:10});g.translate(p.x,p.y+.5,p.z-.6);k.add(m,g,0x7a7268,.04);
  for(const s of [-1,1])k.add(m,ellipsoid([p.x+s*.28,p.y+.75,p.z+.1],[.1,.08,.1],6,4),0x1a1614,.02);for(let i=0;i<4;i++)k.add(m,new THREE.ConeGeometry(.05,.22,4).rotateX(Math.PI).translate(p.x-.18+i*.12,p.y+.3,p.z+.62),0xd0c8b8,.02);k.add(m,box([p.x,p.y+.15,p.z+.4],[.9,.1,.7]),0x5a524a,.03);}
function guardian(k,m,[x,y,z],ry,s){const add=(geo,c)=>{geo.scale(s,s,s);geo.rotateY(ry);geo.translate(x,y,z);k.add(m,geo,c,.05);};
  add(box([0,.5,0],[1.3,1,1.1]),0x6f685f);add(sculpt(new THREE.CylinderGeometry(.5,.6,1.6,8,3),v=>{v.x*=1.15;}).translate(0,1.8,0),0x7e766c);
  add(box([0,3,0],[1.1,1.3,1]),0x857d72);add(box([0,3.75,0],[1.5,.35,1.2]),0x6a635a);for(let i=0;i<5;i++)add(box([-.6+i*.3,4.1,-.1],[.2,.5+(i%2)*.25,.15]),0x7a7268);
  for(const sx of [-1,1]){add(box([sx*.26,3.15,.5],[.3,.16,.1]),0x1a1614);add(box([sx*.75,3,0],[.25,.8,.4]),0x6a635a);}add(box([0,2.7,.52],[.55,.14,.1]),0x2a2622);add(box([0,2.95,.55],[.18,.35,.12]),0x7e766c);}
function brazier(k,m,[x,y,z]){k.add(m,new THREE.CylinderGeometry(.2,.3,.9,10).translate(x,y+.45,z),0x3a3430,.05).add(m,new THREE.CylinderGeometry(.55,.3,.35,12).translate(x,y+1.05,z),0x2a2420,.05);for(let i=0;i<6;i++)k.add(m,box([x+Math.cos(i)*.3,y+1.2,z+Math.sin(i)*.3],[.25,.12,.12],[0,i,0]),0x1a1210,.1);}
function skeleton(k,m,[x,y,z],s){const c=0xd8d0bc;k.add(m,ellipsoid([x,y+.12,z],[.11*s*2,.13*s*2,.13*s*2],7,5),c,.05);for(let i=0;i<6;i++)k.add(m,new THREE.TorusGeometry(.16*s*2,.015,4,10,Math.PI).rotateX(Math.PI/2).translate(x+.1,y+.08,z+.25+i*.07),c,.05);
  k.add(m,limb(V(x,y+.05,z+.2),V(x+.1,y+.05,z+.75),.025,.025,4),c,.05);for(const s2 of [-1,1]){k.add(m,limb(V(x+.1+s2*.15,y+.04,z+.75),V(x+.1+s2*.3,y+.04,z+1.3),.03,.025,4),c,.05);k.add(m,limb(V(x+.1+s2*.2,y+.05,z+.25),V(x+s2*.5,y+.05,z+.5),.025,.02,4),c,.05);}}
function idol(k,m,gold,[x,y,z]){k.add(m,box([x,y+1,z],[7,2,4]),0x6f685f,.03);k.add(m,box([x,y+3.4,z-.3],[4,2.8,2.6]),0x7e766c,.04);k.add(m,box([x,y+5.6,z-.3],[2.6,2.2,2]),0x857d72,.04);
  for(const s of [-1,1]){k.add(m,box([x+s*2.4,y+2.6,z+.4],[1,1.4,2.2]),0x7a7268,.04);k.add(m,box([x+s*1.2,y+2.3,z+1.4],[1.1,.5,1.8]),0x7a7268,.04);k.add(m,box([x+s*.55,y+6,z+.72],[.5,.25,.12]),0x1a1614,.02);}
  k.add(m,box([x,y+7,z-.3],[3.8,.5,2.4]),0x6a635a,.03);for(let i=0;i<7;i++)k.add(gold,box([x-1.5+i*.5,y+7.6+(i%2)*.3,z-.3],[.3,.9+(i%2)*.4,.3]),0xc8983a,.04);k.add(m,box([x,y+5.1,z+.72],[1,.2,.1]),0x2a2622,.02);}
function heartModel(){const g=new THREE.Group();const core=new THREE.Mesh(new THREE.OctahedronGeometry(.45,0),new THREE.MeshStandardMaterial({color:0x14080a,emissive:0xff3a10,emissiveIntensity:2.4,metalness:.3,roughness:.2,flatShading:true}));core.scale.set(1,1.35,1);g.add(core);
  const cage=new THREE.Mesh(new THREE.IcosahedronGeometry(.62,0),new THREE.MeshStandardMaterial({color:0xffc86a,metalness:1,roughness:.25,wireframe:true}));g.add(cage);
  const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:flameTex(),color:new THREE.Color(3,.8,.2),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));halo.scale.setScalar(2.6);g.add(halo);g.name='Coração do Vulcão';return g;}
function coneTree(color,h){const g=new THREE.IcosahedronGeometry(h*.3,0).scale(1,.8,1).translate(0,h*.7,0);const t=new THREE.CylinderGeometry(h*.03,h*.04,h*.3,5).translate(0,h*.15,0);const m=mergeGeometries([g.toNonIndexed(),t.toNonIndexed()]);
  const c=new THREE.Color(color),arr=new Float32Array(m.attributes.position.count*3);for(let i=0;i<arr.length;i+=3){arr[i]=c.r;arr[i+1]=c.g;arr[i+2]=c.b;}m.setAttribute('color',new THREE.BufferAttribute(arr,3));m.deleteAttribute('uv');m.setAttribute('aSway',new THREE.BufferAttribute(new Float32Array(m.attributes.position.count),1));m.computeVertexNormals();return m;}
function fernTree(k,m){k.add(m,sway(limb(V(0,0,0),V(.2,3.2,.1),.16,.12,6),v=>v.y/6),0x4a3a2a,.08);for(let f=0;f<9;f++){const a=f/9*6.28,pts=[];for(let s=0;s<=6;s++){const t=s/6;pts.push(V(.2+Math.cos(a)*2.2*t,3.2+.6*t-1.6*t*t,.1+Math.sin(a)*2.2*t));}
  const pos=[];const side=V(-Math.sin(a),0,Math.cos(a));for(let s=0;s<6;s++){const w=.35*Math.sin((s+.5)/6*Math.PI);for(const sd of [-1,1])pos.push(pts[s],pts[s+1],pts[s].clone().lerp(pts[s+1],.5).addScaledVector(side,sd*w));}
  const g=new THREE.BufferGeometry().setFromPoints(pos);g.computeVertexNormals();k.add(m,sway(g,v=>.5+v.distanceTo(V(0,3.2,0))*.25),0x2f6a2a,.12);}}
function fernPlant(k,m){for(let f=0;f<7;f++){const a=f/7*6.28+rand()*.3,len=.9+rand()*.5,pts=[];for(let s=0;s<=5;s++){const t=s/5;pts.push(V(Math.cos(a)*len*t,.7*t-.35*t*t+.05,Math.sin(a)*len*t));}
  const pos=[],side=V(-Math.sin(a),0,Math.cos(a));for(let s=0;s<5;s++){const w=.14*Math.sin((s+.5)/5*Math.PI);for(const sd of [-1,1])pos.push(pts[s],pts[s+1],pts[s].clone().lerp(pts[s+1],.5).addScaledVector(side,sd*w));}
  const g=new THREE.BufferGeometry().setFromPoints(pos);g.computeVertexNormals();k.add(m,sway(g,v=>v.length()*.6),0x3a7a2a,.14);}}
function monstera(k,m){for(let f=0;f<5;f++){const a=f/5*6.28,stemTop=V(Math.cos(a)*.6,.9+rand()*.4,Math.sin(a)*.6);k.add(m,sway(limb(V(0,0,0),stemTop,.03,.025,4),v=>v.y*.3),0x3a6a2a,.06);
  const c=stemTop.clone().add(V(Math.cos(a)*.45,-.05,Math.sin(a)*.45)),side=V(-Math.sin(a),0,Math.cos(a)),fw=V(Math.cos(a),-.25,Math.sin(a)).normalize(),pos=[];
  for(let s=0;s<6;s++){const t0=s/6,t1=(s+1)/6,w0=.45*Math.sin(t0*Math.PI)+.02,w1=.45*Math.sin(t1*Math.PI)+.02,p0=stemTop.clone().addScaledVector(fw,t0*1),p1=stemTop.clone().addScaledVector(fw,t1*1);
    for(const sd of [-1,1]){if(s===3&&sd<0)continue;pos.push(p0,p1,p1.clone().addScaledVector(side,sd*w1),p0,p1.clone().addScaledVector(side,sd*w1),p0.clone().addScaledVector(side,sd*w0));}}
  const g=new THREE.BufferGeometry().setFromPoints(pos);g.computeVertexNormals();k.add(m,sway(g,v=>.3+v.y*.2),rand()<.3?0x2a6a2a:0x1f5a22,.1);}}
// ======================= texturas desenhadas =======================
let _flame=null;function flameTex(){if(_flame)return _flame;const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(32,36,0,32,32,32);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.35,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64);_flame=new THREE.CanvasTexture(c);return _flame;}
function stripeTex(){const c=document.createElement('canvas');c.width=64;c.height=256;const x=c.getContext('2d');for(let i=0;i<64;i+=2){x.fillStyle=`rgba(255,255,255,${.3+Math.random()*.7})`;x.fillRect(i,0,2,256);}for(let i=0;i<60;i++){x.fillStyle='rgba(255,255,255,.9)';x.fillRect(Math.random()*64,Math.random()*256,1+Math.random()*3,10+Math.random()*30);}return new THREE.CanvasTexture(c);}
const _glyph={};function glyphMat(key){if(_glyph[key])return _glyph[key];const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');
  // pedra entalhada: fundo de pedra, sulcos escuros com borda clara (relevo), um pouco de musgo
  x.fillStyle='#6f675e';x.fillRect(0,0,256,256);for(let i=0;i<500;i++){x.fillStyle=`rgba(${Math.random()<.5?30:200},${Math.random()<.5?30:190},${Math.random()<.5?25:170},.06)`;x.fillRect(Math.random()*256,Math.random()*256,3+Math.random()*9,3+Math.random()*9);}
  const carve=(draw)=>{x.save();x.translate(2,2);x.strokeStyle='rgba(255,240,210,.35)';x.fillStyle='rgba(255,240,210,.35)';draw();x.restore();x.strokeStyle='#2a241e';x.fillStyle='#2a241e';draw();};
  x.lineWidth=9;x.lineCap='round';
  if(key.startsWith('gate')){carve(()=>{x.strokeRect(20,20,216,216);x.beginPath();x.arc(128,128,70,0,6.3);x.stroke();x.font='bold 64px serif';x.textAlign='center';x.textBaseline='middle';x.fillText(['☉','☽','✶'][+key.slice(4)]||'◈',128,132);for(let i=0;i<8;i++){const a=i/8*6.28;x.beginPath();x.moveTo(128+Math.cos(a)*78,128+Math.sin(a)*78);x.lineTo(128+Math.cos(a)*100,128+Math.sin(a)*100);x.stroke();}});}
  else if(key.startsWith('lv')){const n=parseInt(key.slice(2)),C=x;carve(()=>{C.strokeRect(14,14,228,228);C.font='bold 26px serif';C.textAlign='center';C.textBaseline='middle';C.fillText(['','I','II','III','IV'][n]||'',128,36);
      if(n===1){// pegadas só sobre a lua; flechas cruzando os outros glifos
        C.font='bold 40px serif';[['☉',60,90],['☽',128,90],['✶',196,90],['◈',60,150],['☽',128,150],['♆',196,150]].forEach(([g,a,b])=>C.fillText(g,a,b));for(const [a,b]of [[128,120],[128,182]]){C.beginPath();C.ellipse(a-8,b+30,5,9,0,0,6.3);C.fill();C.beginPath();C.ellipse(a+8,b+22,5,9,0,0,6.3);C.fill();}
        C.lineWidth=5;for(const b of [90,150]){C.beginPath();C.moveTo(20,b-22);C.lineTo(92,b-22);C.moveTo(164,b-22);C.lineTo(236,b-22);C.stroke();}C.font='bold 18px serif';C.fillText('SIGA A LUA',128,222);}
      else if(n===2){// o pêndulo e a contagem: a ordem das lâminas abre a porta
        C.lineWidth=6;for(let i=0;i<4;i++){const a=58+i*47;C.beginPath();C.moveTo(a,60);C.lineTo(a+(i%2?-14:14),150);C.stroke();C.beginPath();C.arc(a+(i%2?-14:14),160,13,0,6.3);C.stroke();C.font='bold 20px serif';C.fillText(String(i+1),a+(i%2?-14:14),192);}C.font='bold 18px serif';C.fillText('A ORDEM DAS LÂMINAS',128,224);}
      else if(n===3){// o sol no alto, espelhos em diagonal e o disco na parede
        C.beginPath();C.arc(52,58,18,0,6.3);C.stroke();C.lineWidth=4;C.beginPath();C.moveTo(52,80);C.lineTo(52,172);C.lineTo(196,172);C.lineTo(196,118);C.lineTo(222,118);C.stroke();C.lineWidth=7;for(const [a,b,s]of [[52,172,1],[196,172,-1],[196,118,1]]){C.beginPath();C.moveTo(a-13,b-13*s);C.lineTo(a+13,b+13*s);C.stroke();}C.beginPath();C.arc(226,118,11,0,6.3);C.fill();C.font='bold 18px serif';C.fillText('LEVE A LUZ AO SOL',128,222);}
      else{// o coração cai na boca do vulcão
        C.lineWidth=6;C.beginPath();C.moveTo(30,200);C.lineTo(100,90);C.lineTo(156,90);C.lineTo(226,200);C.stroke();C.beginPath();C.moveTo(112,90);C.quadraticCurveTo(128,112,144,90);C.stroke();C.font='bold 34px serif';C.fillText('◈',128,56);C.lineWidth=4;C.beginPath();C.moveTo(128,72);C.lineTo(128,98);C.stroke();C.font='bold 18px serif';C.fillText('DEVOLVA À LAVA',128,224);}});}
  else if(key==='door'){carve(()=>{x.strokeRect(24,24,208,208);x.beginPath();x.arc(128,110,58,0,6.3);x.stroke();for(let i=0;i<12;i++){const a=i/12*6.28;x.beginPath();x.moveTo(128+Math.cos(a)*66,110+Math.sin(a)*66);x.lineTo(128+Math.cos(a)*86,110+Math.sin(a)*86);x.stroke();}x.font='bold 40px serif';x.textAlign='center';x.fillText('☉ ☽ ✶ ◈',128,215);});}
  else if(key==='stela'){carve(()=>{x.font='bold 36px serif';x.textAlign='center';for(let r=0;r<5;r++)x.fillText(GLYPHS.slice(r,r+3).join(' '),128,50+r*44);});}
  else{const g=key[0]==='G'?GLYPHS[+key.slice(1)]:GLYPHS[(key.charCodeAt(1)||0)%GLYPHS.length];carve(()=>{x.strokeRect(20,20,216,216);x.font='bold 150px serif';x.textAlign='center';x.textBaseline='middle';x.fillText(g,128,138);});}
  x.fillStyle='rgba(50,80,30,.35)';for(let i=0;i<30;i++){x.beginPath();x.arc(Math.random()*256,Math.random()<.5?Math.random()*40:256-Math.random()*40,4+Math.random()*12,0,6.3);x.fill();}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return _glyph[key]=new THREE.MeshStandardMaterial({map:t,roughness:.9});}
const _frieze={};function friezeMat(i){if(_frieze[i])return _frieze[i];const c=document.createElement('canvas');c.width=1024;c.height=64;const x=c.getContext('2d');x.fillStyle='#716960';x.fillRect(0,0,1024,64);
  x.font='bold 44px serif';x.textBaseline='middle';for(let k=0;k<22;k++){const gx=20+k*46;x.fillStyle='rgba(255,240,210,.3)';x.fillText(GLYPHS[(k+i*3)%GLYPHS.length],gx+2,34);x.fillStyle='#2a241e';x.fillText(GLYPHS[(k+i*3)%GLYPHS.length],gx,32);}
  x.strokeStyle='#2a241e';x.lineWidth=4;x.strokeRect(2,2,1020,60);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=THREE.RepeatWrapping;t.repeat.x=1.5;return _frieze[i]=new THREE.MeshStandardMaterial({map:t,roughness:.9});}
function beamMat(color=0xfff0c8){return new THREE.MeshBasicMaterial({color,transparent:true,opacity:.17,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});}

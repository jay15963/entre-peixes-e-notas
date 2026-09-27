import * as THREE from 'three';
import {Kit,loft,ellipsoid,limb,box,sculpt,sweep,paint,reseed,V} from './geometry.js';
import {CATCHES,BALY} from './catalog.js';

// Modelos de tudo o que vem na linha: peixes que se debatem (dobra em C no shader) e objetos rígidos.
export const SPECIES=CATCHES;
export function pickSpecies(r){const total=CATCHES.reduce((s,f)=>s+f.rarity,0);let x=r*total;for(let i=0;i<CATCHES.length;i++){x-=CATCHES[i].rarity;if(x<0)return i;}return 0;}
function flopMaterial(opts){
  const m=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,side:THREE.DoubleSide,...opts});
  m.userData.uniforms={uFlop:{value:0},uPhase:{value:0},uLen:{value:.3}};
  m.onBeforeCompile=s=>{Object.assign(s.uniforms,m.userData.uniforms);
    s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nuniform float uFlop,uPhase,uLen;').replace('#include <begin_vertex>',`#include <begin_vertex>
      float along=clamp((uLen*.45-transformed.z)/uLen,0.,1.2);
      // curva em C que alterna de lado + ondulação da cauda
      transformed.x+=uFlop*(sin(uPhase)*along*along*uLen*.9+sin(uPhase*1.7-along*5.)*along*uLen*.18);`);};
  m.customProgramCacheKey=()=>'flop';return m;
}
function fishBody(kit,mat,sp){
  const L=sp.len,shape=sp.shape,deep=shape==='deep'?1.35:shape==='blunt'?1.2:shape==='tuna'?1.3:shape==='puffer'?2.2:shape==='ribbon'?.55:1;
  const wide=shape==='puffer'?2.1:shape==='tuna'?1.35:shape==='ribbon'?.45:1;
  let rings=[[-.5,.018,.04],[-.42,.03,.07],[-.25,.07,.16],[-.02,.1,.22],[.2,.095,.2],[.36,.07,.15],[.46,.035,.08],[.5,.01,.02]];
  if(shape==='puffer')rings=[[-.5,.02,.03],[-.36,.05,.06],[-.18,.14,.16],[.05,.19,.2],[.25,.16,.17],[.4,.09,.1],[.5,.02,.03]];
  if(shape==='ribbon')rings=[[-.5,.004,.01],[-.3,.02,.06],[0,.03,.1],[.3,.03,.1],[.44,.02,.07],[.5,.005,.02]];
  const body=loft(rings.map(([z,w,h])=>({z:z*L,cy:0,rx:w*L*wide,rz:h*L*deep*(shape==='blunt'&&z>.25?1.25:1),pow:2.1})),{axis:'z',n:14});
  const top=new THREE.Color(sp.top),side=new THREE.Color(sp.side),belly=new THREE.Color(sp.belly);
  kit.add(mat,paint(body,(v,c)=>{const h=c.y/(L*.2*deep);let col=h>.25?top.clone().lerp(side,THREE.MathUtils.clamp(1-(h-.25)*2,0,1)):h>-.3?side.clone():side.clone().lerp(belly,THREE.MathUtils.clamp(-(h+.3)*2.5,0,1));
    if(sp.line&&Math.abs(h-.05)<.08)col=new THREE.Color(0x1c2224);if(sp.stripes&&h>0&&Math.sin(c.z*90/L*.3)>.55)col.multiplyScalar(.7);if(sp.spots&&Math.sin(c.z*90)*Math.sin(c.y*110)>.55)col=sp.name==='Dourado'?new THREE.Color(0x2c6aa8):col.clone().multiplyScalar(.55);return col;},.05));
  const fin=(pts,color)=>{const g=new THREE.BufferGeometry().setFromPoints(pts.map(p=>V(p[0]*L*wide,p[1]*L*deep,p[2]*L)));g.computeVertexNormals();kit.add(mat,g,color,.05);};
  const finCol=new THREE.Color(sp.top).lerp(new THREE.Color(sp.side),.4).getHex();
  if(shape==='tuna'||shape==='bill')fin([[0,0,-.47],[0,.34,-.7],[0,.05,-.55], [0,0,-.47],[0,-.05,-.55],[0,-.34,-.7]],finCol);// cauda em meia-lua
  else if(shape!=='ribbon')fin([[0,0,-.47],[0,.19,-.66],[0,.03,-.56], [0,0,-.47],[0,.03,-.56],[0,-.19,-.66]],finCol);
  if(shape==='bill'){fin([[0,.2,.3],[0,.62,.1],[0,.2,-.3], [0,.2,.3],[0,.2,-.3],[0,.5,-.05]],0x284c8a);kit.add(mat,limb(V(0,.02*L,.48*L),V(0,.03*L,.92*L),.012*L,.002,6),sp.top);}
  else if(shape==='ribbon')fin([[0,.09,.35],[0,.14,.1],[0,.1,-.45], [0,.09,.35],[0,.1,-.45],[0,.06,-.5]],0xdfe6ea);
  else fin([[0,.2,.12],[0,.33,-.02],[0,.19,-.25], [0,.2,.12],[0,.19,-.25],[0,.21,.02]],finCol);
  if(sp.finlets)for(let i=0;i<5;i++)fin([[0,.13-i*.02,-.25-i*.04],[0,.17-i*.02,-.27-i*.04],[0,.12-i*.02,-.29-i*.04]],0xf2c230);
  fin([[0,-.19,-.1],[0,-.28,-.2],[0,-.16,-.3]],finCol);
  for(const s of [-1,1]){fin([[s*.09,-.05,.22],[s*.2,-.12,.08],[s*.1,-.09,.12]],finCol);
    const ex=(shape==='puffer'?.16:.075)*L;kit.add(mat,ellipsoid([s*ex,.055*L*deep,.36*L],[.028*L,.03*L,.028*L],8,6),0xf2efe4,.02);kit.add(mat,ellipsoid([s*(ex+.013*L),.057*L*deep,.37*L],[.016*L,.018*L,.016*L],6,4),0x0c0d0e,.02);}
  if(shape==='puffer')for(let i=0;i<46;i++){const a=i*2.4,b=Math.acos(1-2*((i+.5)/46));const n=V(Math.sin(b)*Math.cos(a),Math.cos(b),Math.sin(b)*Math.sin(a));if(Math.abs(n.z)>.85)continue;const base=V(n.x*.18*L,n.y*.19*L*1.1,n.z*.17*L);kit.add(mat,limb(base,base.clone().addScaledVector(n,.05*L),.006,.001,3),0xe8e0c0,.05);}
  kit.add(mat,ellipsoid([0,-.035*L,.49*L],[.03*L,.012*L,.02*L],6,4),0x2a1a18,.02);
}
// Linguado e arraia: corpo achatado (os dois olhos no mesmo lado no linguado; arraia com asas e cauda chicote)
function flatBody(kit,mat,sp){const L=sp.len,top=new THREE.Color(sp.top),belly=new THREE.Color(sp.belly);
  if(sp.shape==='ray'){const g=sculpt(new THREE.SphereGeometry(1,20,10),v=>{const w=Math.abs(v.x);v.y*=.1*(1-w*.6);v.z*=.62-w*.3;v.z+=w*w*-.25;});g.scale(L*.55,L,L*.6);kit.add(mat,paint(g,(v,c)=>c.y>0?(Math.sin(c.x*40)*Math.sin(c.z*40)>.6?top.clone().multiplyScalar(.6):top):belly,.05));
    kit.add(mat,limb(V(0,0,-.2*L),V(0,.02,-1.1*L),.02*L,.002,5),sp.top);for(const s of [-1,1])kit.add(mat,ellipsoid([s*.06*L,.05*L,.3*L],[.02*L,.02*L,.02*L],6,4),0x111111);return;}
  const g=sculpt(new THREE.SphereGeometry(1,18,10),v=>{v.y*=.14;});g.scale(L*.26,L,L*.5);g.rotateZ(Math.PI/2);g.rotateZ(-Math.PI/2);kit.add(mat,paint(g,(v,c)=>c.y>0?(Math.sin(c.x*80)*Math.sin(c.z*70)>.55?top.clone().multiplyScalar(.6):top):belly,.05));
  const fin=(pts)=>{const q=new THREE.BufferGeometry().setFromPoints(pts.map(p=>V(p[0]*L,p[1]*L,p[2]*L)));q.computeVertexNormals();kit.add(mat,q,sp.side,.05);};
  fin([[0,0,-.48],[.18,0,-.68],[-.18,0,-.68]]);for(const s of [-1,1])fin([[s*.24,0,.3],[s*.3,0,-.1],[s*.25,0,-.4]]);
  for(const x of [-.05,.05])kit.add(mat,ellipsoid([x*L,.06*L,.3*L],[.025*L,.03*L,.025*L],6,4),0xf2efe4,.02).add(mat,ellipsoid([x*L,.08*L,.31*L],[.013*L,.015*L,.013*L],6,4),0x0c0d0e,.02);
}
function canvasTex(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;}
// Rótulo da lata de Baly Tradicional: lata preta fosca, "BALY" amarelo na vertical, TRADICIONAL e ENERGY DRINK
let balyLabel=null;
export function balyTexture(){if(balyLabel)return balyLabel;if(typeof document==='undefined')return null;balyLabel=canvasTex(1024,512,(c,w,h)=>{
  const g=c.createLinearGradient(0,0,w,0);g.addColorStop(0,'#0b0b0c');g.addColorStop(.5,'#1a1a1c');g.addColorStop(1,'#0b0b0c');c.fillStyle=g;c.fillRect(0,0,w,h);
  for(let i=0;i<260;i++){c.fillStyle=`rgba(255,255,255,${.04+Math.random()*.08})`;c.beginPath();c.arc(Math.random()*w,Math.random()*h,1+Math.random()*2.2,0,6.3);c.fill();}// gotinhas de condensação
  for(const cx of [w*.25,w*.75]){c.save();c.fillStyle='#ffc81e';c.textAlign='center';c.font='bold 26px Arial';c.fillText('TRADICIONAL',cx,70);c.font='16px Arial';c.fillText('TAURINA + INOSITOL',cx,36);
    c.translate(cx+10,h*.58);c.rotate(-Math.PI/2);c.font='bold 150px Georgia, serif';c.fillText('BALY',0,0);c.font='bold 22px Arial';c.fillText('BRASIL',100,40);c.restore();
    c.fillStyle='#ffc81e';c.textAlign='center';c.font='bold 30px Arial';c.fillText('ENERGY',cx,h-72);c.fillText('DRINK',cx,h-36);}});return balyLabel;}
export function makeBaly(scale=1){const g=new THREE.Group(),L=.16*scale,R=.034*scale;
  const body=new THREE.Mesh(new THREE.CylinderGeometry(R,R,L,24,1,true),new THREE.MeshStandardMaterial({map:balyTexture(),metalness:.35,roughness:.42}));g.add(body);
  const alu=new THREE.MeshStandardMaterial({color:0xc9cdd2,metalness:.95,roughness:.25,flatShading:true});
  const top=new THREE.Mesh(new THREE.CylinderGeometry(R*.82,R,L*.08,24),alu);top.position.y=L*.54;g.add(top);const lid=new THREE.Mesh(new THREE.CylinderGeometry(R*.8,R*.8,.002,24),alu);lid.position.y=L*.585;g.add(lid);
  const bot=new THREE.Mesh(new THREE.CylinderGeometry(R,R*.84,L*.06,24),alu);bot.position.y=-L*.53;g.add(bot);
  const tab=new THREE.Mesh(new THREE.BoxGeometry(R*.5,.003,R*.28),alu);tab.position.set(0,L*.59,R*.2);g.add(tab);
  g.rotation.x=Math.PI/2;const root=new THREE.Group();root.add(g);return root;}
function itemModel(kit,mat,sp){
  const s=sp.shape;
  if(s==='boot'){kit.add(mat,loft([{z:-.1,cy:.12,rx:.055,rz:.07},{z:-.02,cy:.11,rx:.06,rz:.075},{z:.08,cy:.04,rx:.055,rz:.05},{z:.16,cy:.03,rx:.04,rz:.035}],{axis:'z',n:10}),0x4a3322,.12);
    kit.add(mat,loft([{y:.1,cx:0,cz:-.07,rx:.05,rz:.05},{y:.26,cx:0,cz:-.08,rx:.055,rz:.05}],{n:10}),0x4a3322,.12);kit.add(mat,loft([{z:-.11,cy:-.005,rx:.058,rz:.012},{z:.17,cy:-.005,rx:.042,rz:.012}],{axis:'z',n:8}),0x1f1a15,.1);
    kit.add(mat,sweep([V(-.03,.22,-.03),V(.02,.28,.02),V(.05,.2,.08)],.012,.004),0x2f5a2a,.1);return .3;}
  if(s==='tire'){const t=new THREE.TorusGeometry(.2,.09,8,20);kit.add(mat,paint(t,(v,c)=>Math.sin(Math.atan2(c.y,c.x)*30)>.3&&Math.hypot(c.x,c.y)>.25?0x2a2b2d:0x171819,.08));kit.add(mat,new THREE.TorusGeometry(.2,.03,5,20).translate(0,0,.07),0x3f5a3a,.2);return .55;}
  if(s==='crushed'){kit.add(mat,sculpt(new THREE.CylinderGeometry(.033,.033,.12,10,4),v=>{v.x*=1+Math.sin(v.y*40)*.25;v.z*=.5+Math.cos(v.y*30)*.2;v.y*=.7;}),0xc0342a,.2);return .14;}
  if(s==='bag'){kit.add(mat,sculpt(new THREE.SphereGeometry(.14,10,8),v=>{v.x*=1+Math.sin(v.y*30)*.25;v.y*=1.3;v.z*=.35+Math.cos(v.x*40)*.15;}),0xe9ecef,.1);kit.add(mat,new THREE.TorusGeometry(.04,.01,4,10).translate(-.05,.2,0),0xe9ecef).add(mat,new THREE.TorusGeometry(.04,.01,4,10).translate(.05,.2,0),0xe9ecef);return .35;}
  if(s==='weed'){for(let i=0;i<7;i++){const a=i*.9;const path=[];for(let k=0;k<6;k++)path.push(V(Math.sin(a+k*.7)*.04+(i-3)*.02,-k*.07,Math.cos(a+k)*.04));kit.add(mat,sweep(path,.05-i*.003,.006),[0x3f6a2a,0x5a7a2a,0x2f5a3a][i%3],.1);}return .45;}
  if(s==='trunks'){kit.add(mat,loft([{y:0,rx:.16,rz:.05},{y:.1,rx:.17,rz:.055},{y:.13,rx:.16,rz:.05}],{n:12}),0xd62028,.08);for(const x of [-1,1])kit.add(mat,loft([{y:-.1,cx:x*.08,rx:.07,rz:.05},{y:0,cx:x*.08,rx:.08,rz:.052}],{n:10}),0xd62028,.08);kit.add(mat,box([0,.115,.052],[.3,.02,.01]),0xffffff);return .35;}
  if(s==='remote'){kit.add(mat,box([0,0,0],[.05,.02,.2]),0x1d1e20,.05);for(let i=0;i<12;i++)kit.add(mat,box([-.012+(i%3)*.012,.012,-.06+Math.floor(i/3)*.03],[.008,.005,.01]),i===0?0xd62028:0x8a8e94);return .22;}
  if(s==='coin'){kit.add(mat,new THREE.CylinderGeometry(.035,.035,.006,20).rotateX(Math.PI/2),0xe0b43a,.04);kit.add(mat,new THREE.TorusGeometry(.032,.003,4,20),0xc9982a);kit.add(mat,ellipsoid([0,0,.004],[.015,.018,.002],8,4),0xc9982a);return .1;}
  if(s==='watch'){kit.add(mat,new THREE.CylinderGeometry(.025,.025,.01,18).rotateX(Math.PI/2),0xe0b43a,.03);kit.add(mat,new THREE.CylinderGeometry(.021,.021,.002,18).rotateX(Math.PI/2).translate(0,0,.005),0xf6f1e2);kit.add(mat,box([0,.006,.007],[.002,.014,.002]),0x111111).add(mat,box([.005,0,.007],[.01,.002,.002]),0x111111);
    for(const d of [-1,1])for(let k=0;k<4;k++)kit.add(mat,box([0,d*(.03+k*.012),-.004],[.024,.011,.004]),0xd4a832,.03);return .12;}
  if(s==='ring'){kit.add(mat,new THREE.TorusGeometry(.012,.0025,6,16),0xf0c850,.03);kit.add(mat,new THREE.OctahedronGeometry(.006,0).translate(0,.016,0),0xdff6ff,.02);return .06;}
  if(s==='bottle'){kit.add(mat,loft([{y:-.12,rx:.04,rz:.04},{y:.06,rx:.042,rz:.042},{y:.1,rx:.018,rz:.018},{y:.16,rx:.015,rz:.015}],{n:10}),0x3f8a5a,.05);kit.add(mat,loft([{y:.16,rx:.017,rz:.017},{y:.19,rx:.017,rz:.017}],{n:8}),0x8a6a45);kit.add(mat,sculpt(new THREE.CylinderGeometry(.018,.018,.12,8).translate(0,-.03,0),()=>{}),0xefe2b8);return .3;}
  if(s==='chest'){kit.add(mat,box([0,0,0],[.5,.3,.34]),0x6a4428,.08);kit.add(mat,sculpt(new THREE.CylinderGeometry(.17,.17,.5,10,1,false,0,Math.PI).rotateZ(Math.PI/2),()=>{}).translate(0,.15,0),0x7a5030,.08);
    for(const x of [-.2,0,.2])kit.add(mat,box([x,.05,0],[.04,.42,.36]),0xd4a832,.03);kit.add(mat,box([0,.1,.18],[.08,.1,.02]),0xd4a832,.03);for(let i=0;i<8;i++)kit.add(mat,new THREE.CylinderGeometry(.03,.03,.006,10).rotateX(1).translate(-.15+i*.045,.33+(i%3)*.01,(i%2)*.04),0xf0c850,.05);return .55;}
  if(s==='lobster'){const red=0xa8321f,dark=0x6e1f14;for(let j=0;j<7;j++){const z=-.04-j*.05,r=.05-j*.004;kit.add(mat,ellipsoid([0,.01,z],[r,r*.72,.032],10,6),j%2?red:dark,.06);}
    kit.add(mat,loft([{z:0,cy:.015,rx:.05,rz:.042},{z:.08,cy:.02,rx:.056,rz:.048},{z:.16,cy:.012,rx:.04,rz:.035},{z:.2,cy:.01,rx:.012,rz:.012}],{axis:'z',n:12}),red,.06);
    for(let i=0;i<5;i++)kit.add(mat,sculpt(new THREE.ConeGeometry(.03,.08,5).rotateX(Math.PI/2),v=>{v.x*=1+Math.abs(v.z)*6;}).translate(0,.005,-.38-i*.005).rotateY((i-2)*.28),dark,.05);
    for(const d of [-1,1]){kit.add(mat,limb(V(d*.045,.01,.15),V(d*.13,.02,.25),.014,.018,6),red,.06);kit.add(mat,sculpt(ellipsoid([d*.17,.02,.33],[.045,.025,.09],8,6),v=>{v.x+=Math.sign(v.x-d*.17)*0;}),dark,.06);kit.add(mat,ellipsoid([d*.2,.02,.4],[.018,.012,.05],6,4),red,.06);
      kit.add(mat,sweep([V(d*.02,.03,.19),V(d*.12,.05,.32),V(d*.2,.02,.5),V(d*.26,-.01,.62)],.004,.004),0x8a2a1a,.05);
      for(let k=0;k<4;k++)kit.add(mat,sweep([V(d*.04,0,.1-k*.04),V(d*.1,-.03,.11-k*.04),V(d*.13,-.07,.1-k*.045)],.006,.006),dark,.05);
      kit.add(mat,ellipsoid([d*.022,.05,.17],[.008,.008,.008],6,4),0x111111,.02);}
    return .5;}
  if(s==='crab'){const blue=0x2f5c8a,shell=0x3f6f9a;kit.add(mat,sculpt(ellipsoid([0,0,0],[.12,.045,.085],16,8),v=>{v.x*=1+Math.max(0,-Math.abs(v.z)+.02)*2;if(Math.abs(v.x)>.1)v.y*=.7;}),shell,.08);
    for(const d of [-1,1]){kit.add(mat,sculpt(new THREE.ConeGeometry(.012,.06,5).rotateZ(-d*Math.PI/2).translate(d*.14,.005,0),()=>{}),blue,.05);
      for(let k=0;k<4;k++){const z=-.05+k*.03;kit.add(mat,sweep([V(d*.09,0,z),V(d*.16,.03,z*1.3),V(d*.2,-.03,z*1.5)],.008,.008),blue,.05);}
      kit.add(mat,limb(V(d*.07,.005,.07),V(d*.11,.015,.13),.012,.015,6),blue,.05);kit.add(mat,ellipsoid([d*.12,.02,.17],[.03,.022,.045],8,5),0xd9e2ea,.05);kit.add(mat,ellipsoid([d*.14,.02,.2],[.01,.01,.03],6,4),0xc84a2a,.05);
      kit.add(mat,limb(V(d*.025,.03,.075),V(d*.03,.055,.085),.004,.004,4),0x1a2a3a).add(mat,ellipsoid([d*.03,.058,.085],[.008,.008,.008],6,4),0x111111,.02);}
    return .32;}
  return .3;
}
// Peixe ou objeto pronto para a cena. userData.rigid = objeto (gira em vez de se debater).
export function makeCatch(index=0){
  const sp=CATCHES[index]||CATCHES[0],kit=new Kit();reseed(index+7);
  if(index===BALY){const root=makeBaly(1.6);root.userData={species:index,rigid:true,len:.26,flop:0,phase:Math.random()*6,mat:null};return root;}
  const mat=flopMaterial({roughness:sp.kind==='fish'?.3:sp.shape==='coin'||sp.shape==='ring'||sp.shape==='watch'?.25:.8,metalness:sp.kind==='fish'?.45:sp.kind==='treasure'?.85:0,side:THREE.DoubleSide});
  let L=sp.len||.3;
  if(sp.kind==='fish'){if(sp.shape==='flat'||sp.shape==='ray')flatBody(kit,mat,sp);else fishBody(kit,mat,sp);}else L=itemModel(kit,mat,sp);
  const g=kit.build();g.name=sp.name;const root=new THREE.Group();root.add(g);
  // peixes grandes aparecem menores na mão (não tapam a tela), mas mantêm a proporção no mar
  root.userData={species:index,mat,len:L,flop:0,phase:Math.random()*6,rigid:sp.kind!=='fish'||sp.shape==='ray'};
  return root;
}
export const makeFish=makeCatch;
// Debater: fase avança rápido com a intensidade; objetos só giram.
export function flop(fish,dt,intensity){const u=fish.userData;u.phase+=dt*(6+intensity*16);if(u.rigid||!u.mat){fish.children[0].rotation.y+=dt*intensity*2;return u.phase;}const m=u.mat.userData.uniforms;m.uPhase.value=u.phase;m.uFlop.value=intensity;m.uLen.value=u.len;return u.phase;}

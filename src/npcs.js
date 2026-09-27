import * as THREE from 'three';
import {makeCharacter} from './characters.js';
import {Animator} from './animation.js';
import {ISLAND,groundLocal} from './terrain.js';
// Moradores de Laguna: 20 pessoas com roupas, chapéus e acessórios variados andando pelas ruas.
// O caminho de cada um é uma função do relógio da partida (sem rede): todos os jogadores veem as mesmas pessoas no mesmo lugar.
// Os rostos são retratos pintados em canvas (sem fotos de terceiros), projetados na cabeça como as fotos dos pescadores.
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
function rng(seed){let s=seed>>>0||1;return ()=>{s=Math.imul(s^s>>>15,2246822507);s=Math.imul(s^s>>>13,3266489909);s^=s>>>16;return (s>>>0)/4294967296;};}
const SKINS=[0xf1c9a8,0xe3b08c,0xd09a78,0xb97d5a,0x9a6446,0x7a4a32,0x5e3a28,0xecc0a0];
const HAIRS=[0x1b1411,0x2c1d15,0x4a3222,0x6b4a2f,0x8a6a45,0xb89060,0xd8d0c4,0x9a9690,0x3a2a24];
const SHIRTS=[0xe8364f,0x2f7fae,0xf2c037,0x3a8a5a,0xf4f1e8,0x7a3b8a,0xe86a24,0x1d2b44,0x9dd3b4,0xf3b0c3,0x6f4a2e,0x2f6d8c,0xc9e3a4,0x444a55];
const PANTS=[0x2b2d31,0x3a4a6a,0x7a6c52,0x5a5a5e,0xd8cfb8,0x25324a,0x6a3b2a];
// Retrato: pele com sombreamento, olhos com íris, sobrancelhas, nariz, boca, e às vezes barba, sardas, rugas e batom
export const NPC_FIT={u:.5,v:.47,su:1.92,sv:2.3,eyeY:1.638,mask:[.118,.155,1.6],tilt:0};
function faceCanvas(o,r){
  const W=256,H=320,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
  const skin=new THREE.Color(o.skin),css=k=>`#${k.getHexString()}`,dark=skin.clone().multiplyScalar(.78),darker=skin.clone().multiplyScalar(.6),light=skin.clone().lerp(new THREE.Color(0xffffff),.12);
  x.fillStyle=css(skin);x.fillRect(0,0,W,H);
  // volume: testa clara, laterais e queixo mais escuros
  let g=x.createRadialGradient(128,140,20,128,160,170);g.addColorStop(0,css(light));g.addColorStop(.6,css(skin));g.addColorStop(1,css(dark));x.fillStyle=g;x.fillRect(0,0,W,H);
  const eyeY=150,ex=30,iris=['#4a2e1c','#2e1c12','#5a7a3a','#3a6a9a','#6b4a2a','#2a2a2a'][o.eye];
  // olheiras e órbitas
  for(const s of [-1,1]){g=x.createRadialGradient(128+s*ex,eyeY+4,2,128+s*ex,eyeY+4,26);g.addColorStop(0,'rgba(0,0,0,.14)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,100,W,100);}
  // sobrancelhas
  x.strokeStyle=o.brow;x.lineCap='round';for(const s of [-1,1]){x.lineWidth=o.browW;x.beginPath();x.moveTo(128+s*12,eyeY-17+o.browTilt*s);x.quadraticCurveTo(128+s*30,eyeY-26-o.browArch,128+s*46,eyeY-16);x.stroke();}
  // olhos: esclera amendoada, íris, pupila, brilho, pálpebra e cílios
  for(const s of [-1,1]){const cx=128+s*ex;x.save();x.beginPath();x.moveTo(cx-15,eyeY);x.quadraticCurveTo(cx,eyeY-10*o.eyeOpen,cx+15,eyeY);x.quadraticCurveTo(cx,eyeY+8*o.eyeOpen,cx-15,eyeY);x.closePath();x.fillStyle='#f3efe8';x.fill();x.clip();
    x.fillStyle=iris;x.beginPath();x.arc(cx+o.look,eyeY,7.5,0,Math.PI*2);x.fill();x.fillStyle='#0b0908';x.beginPath();x.arc(cx+o.look,eyeY,3.4,0,Math.PI*2);x.fill();x.fillStyle='rgba(255,255,255,.85)';x.beginPath();x.arc(cx+o.look+2.5,eyeY-2.5,1.8,0,Math.PI*2);x.fill();x.restore();
    x.strokeStyle='rgba(30,18,12,.85)';x.lineWidth=o.lash?3:2;x.beginPath();x.moveTo(cx-16,eyeY+1);x.quadraticCurveTo(cx,eyeY-11*o.eyeOpen,cx+16,eyeY+1);x.stroke();
    x.strokeStyle='rgba(0,0,0,.18)';x.lineWidth=1.5;x.beginPath();x.moveTo(cx-13,eyeY-12*o.eyeOpen);x.quadraticCurveTo(cx,eyeY-17*o.eyeOpen,cx+13,eyeY-11*o.eyeOpen);x.stroke();}
  // nariz: ponte com luz, sombra lateral, asas e narinas
  x.strokeStyle=css(darker);x.globalAlpha=.55;x.lineWidth=2.2;x.beginPath();x.moveTo(121,eyeY+8);x.quadraticCurveTo(116,eyeY+34,117,eyeY+44);x.stroke();x.globalAlpha=1;
  g=x.createRadialGradient(128,eyeY+44,2,128,eyeY+44,18);g.addColorStop(0,css(light));g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(100,eyeY+25,56,40);
  x.fillStyle=css(darker);for(const s of [-1,1]){x.beginPath();x.ellipse(128+s*7,eyeY+50,4*o.nose,2.4,s*.3,0,Math.PI*2);x.fill();}
  x.strokeStyle=css(darker);x.lineWidth=2;for(const s of [-1,1]){x.beginPath();x.arc(128+s*10*o.nose,eyeY+45,6,s>0?-1.2:Math.PI*.3,s>0?.9:Math.PI+1.2);x.stroke();}
  // bochechas coradas e sardas
  for(const s of [-1,1]){g=x.createRadialGradient(128+s*44,eyeY+40,2,128+s*44,eyeY+40,26);g.addColorStop(0,`rgba(200,80,70,${o.blush})`);g.addColorStop(1,'rgba(200,80,70,0)');x.fillStyle=g;x.fillRect(60,eyeY+10,140,60);}
  if(o.freckles)for(let i=0;i<40;i++){x.fillStyle='rgba(120,60,30,.35)';x.beginPath();x.arc(128+(r()-.5)*110,eyeY+22+(r()-.5)*30,1.2+r(),0,Math.PI*2);x.fill();}
  // boca: lábio superior em arco, inferior cheio, sorriso ou sério
  const my=eyeY+82,mw=18+o.mouthW*8,sm=o.smile;x.fillStyle=o.lips;x.beginPath();x.moveTo(128-mw,my);x.quadraticCurveTo(128-mw*.4,my-7-sm,128,my-4);x.quadraticCurveTo(128+mw*.4,my-7-sm,128+mw,my);x.quadraticCurveTo(128,my+11+sm*.3,128-mw,my);x.fill();
  x.strokeStyle='rgba(60,20,20,.7)';x.lineWidth=2;x.beginPath();x.moveTo(128-mw,my);x.quadraticCurveTo(128,my+2+sm,128+mw,my);x.stroke();
  // rugas (idade)
  if(o.age>.5){x.strokeStyle='rgba(60,30,20,.25)';x.lineWidth=1.4;for(let k=0;k<3;k++){x.beginPath();x.moveTo(92,eyeY-40-k*8);x.quadraticCurveTo(128,eyeY-45-k*8,164,eyeY-40-k*8);x.stroke();}for(const s of [-1,1]){x.beginPath();x.moveTo(128+s*20,eyeY+58);x.quadraticCurveTo(128+s*34,eyeY+74,128+s*30,eyeY+92);x.stroke();}}
  // barba e bigode (pontilhado de pelos) ou barba por fazer
  if(o.beard){x.fillStyle=o.beardColor;const dens=o.beard===2?1:.45;for(let i=0;i<2600*dens;i++){const a=r()*Math.PI,rad=62+r()*40,px=128+Math.cos(a)*rad*.95,py=eyeY+40+Math.sin(a)*rad*.95;if(py<eyeY+62&&Math.abs(px-128)<40)continue;if(Math.abs(px-128)<mw&&Math.abs(py-my)<8)continue;x.globalAlpha=.35+r()*.4;x.fillRect(px,py,1.6,2.6);}
    for(let i=0;i<500*dens;i++){const px=128+(r()-.5)*mw*2.4,py=my-10+r()*6;x.globalAlpha=.4+r()*.5;x.fillRect(px,py,1.5,2.5);}x.globalAlpha=1;}
  if(o.mole){x.fillStyle='rgba(70,40,30,.8)';x.beginPath();x.arc(128+o.mole*38,eyeY+60,2.4,0,Math.PI*2);x.fill();}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}
// Rotas (coordenadas locais da ilha): calçadas da rua, calçadão, travessa da esquerda, praça, frente do mercado, igreja e cais
const ROUTES=[
  {pts:[[4.05,-44],[4.05,-13],[10,-7.5],[19,-3.5]],pp:true},
  {pts:[[-4.05,-44],[-4.05,-13],[-10,-8.5],[-12.6,-3]],pp:true},
  {pts:[[-30,-47],[30,-47]],pp:true},
  {pts:[[31,-3],[31,31]],pp:true},
  {pts:Array.from({length:10},(_,i)=>{const a=i/10*Math.PI*2;return [-17+Math.cos(a)*4.3,-4.5+Math.sin(a)*4.3];}),pp:false},
  {pts:[[-12,1.6],[12,1.6]],pp:true},
  {pts:[[-21.5,-10],[-21.5,3]],pp:true},
  {pts:[[.2,-50],[.2,-78]],pp:true,slow:true},
  {pts:[[-20,-54.3],[-8,-54.6]],pp:true,slow:true},
];
// Onde fica cada morador: rota, deslocamento no tempo, velocidade (ou parado conversando)
const PLAN=[[0,0],[0,.45],[1,.2],[1,.7],[2,0],[2,.33],[2,.66],[3,.1],[3,.6],[4,0],[4,.5],[5,.25],[5,.75],[6,.4],[7,.3],[8,.5],
  ['idle',[6.2,-7.4,.69]],['idle',[7.1,-6.3,-2.46]],['idle',[-27,-45.8,.9]],['idle',[-26,-45,-2.25]]];
function timeline(route,speed,seed){const r=rng(seed),pts=route.pts.map(([u,v])=>V(u,0,v)),seq=route.pp?[...pts,...pts.slice(1,-1).reverse()]:pts,segs=[];let T=0;
  for(let i=0;i<seq.length;i++){const a=seq[i],b=seq[(i+1)%seq.length];if(!route.pp&&false)continue;const pause=(route.pp&&(i===0||i===pts.length-1))?2+r()*4:r()<.25?1.5+r()*2:0;if(pause){segs.push({t0:T,t1:T+pause,a,b:a});T+=pause;}const d=a.distanceTo(b)/speed;segs.push({t0:T,t1:T+d,a,b});T+=d;}
  return {segs,T};}
export class Villagers {
  constructor(scene,assets,{count=20,quality='high'}={}){
    this.list=[];this.group=new THREE.Group();scene.add(this.group);const r=rng(777);
    for(let i=0;i<Math.min(count,PLAN.length);i++){
      const pick=a=>a[Math.floor(r()*a.length)],fem=r()<.5,age=r(),skin=pick(SKINS),hairC=age>.8?pick([0xd8d0c4,0x9a9690]):pick(HAIRS);
      const long=r()<.4,shorts=!long&&r()<.6,skirt=fem&&r()<.45?pick([0xe8364f,0x2f6d8c,0xf2c037,0x7a3b8a,0xf4f1e8,0x3a8a5a]):0;
      const hats=['straw','bucket','beanie','panama','cap',null,null,null,null],hat=pick(hats);
      const shirt=pick(SHIRTS);
      const look={name:'Morador '+(i+1),skin,hair:hairC,shirt,shirtDark:new THREE.Color(shirt).multiplyScalar(.75).getHex(),trim:0xf4f1e8,pants:skirt?skin:pick(PANTS),sock:0xefede6,shoe:pick([0x1d1f22,0x6b4a2f,0xf2f0ea,0x2f6d8c]),sole:0xf2f0ea,
        top:skirt?(r()<.5?'tank':'tee'):pick(['tee','tee','tank','jacket','denim']),long:!skirt&&long,longPants:!skirt&&!shorts,skirt,
        hairStyle:fem?pick(['long','long','bun','curly','short']):age>.75?pick(['bald','short']):pick(['short','short','curly']),
        hat:hat==='cap'?null:hat,hatColor:pick([0x5f7a4a,0x2f4f7a,0xb3261e,0x3a3a3a,0xd9c27a]),cap:hat==='cap'?{color:pick([0x15171b,0xb3261e,0x2f6d8c,0xf1efe9]),back:r()<.3}:null,
        glasses:r()<.15,sunglasses:r()<.15,necklace:r()<.25?pick([0xd9a441,0xe8e8e8,0x8a4a2a]):0,bag:r()<.2?pick([0x6b4a2f,0x2f6d8c,0xe8364f]):0};
      if(look.top==='jacket'||look.top==='denim')look.long=true;
      const face={eye:Math.floor(r()*6),eyeOpen:.85+r()*.3,look:(r()-.5)*3,brow:'#'+new THREE.Color(hairC).multiplyScalar(.8).getHexString(),browW:fem?3:4.5+r()*2,browArch:fem?5+r()*3:2+r()*3,browTilt:(r()-.5)*4,nose:.8+r()*.5,
        blush:fem?.18+r()*.1:.06+r()*.08,freckles:r()<.2,mouthW:r(),smile:(r()-.3)*6,lips:fem&&r()<.5?pick(['#b3263e','#c24a5a','#9a3a4a']):'#'+new THREE.Color(skin).multiplyScalar(.72).lerp(new THREE.Color(0xb05050),.3).getHexString(),lash:fem,
        age,beard:!fem&&r()<.45?(r()<.5?2:1):0,beardColor:'#'+new THREE.Color(hairC).multiplyScalar(.85).getHexString(),mole:r()<.2?(r()<.5?-1:1):0,skin};
      const map=typeof document==='undefined'?null:faceCanvas(face,r),avg=new THREE.Color(skin);
      const model=makeCharacter(assets,100+i,{look,face:{map,fit:NPC_FIT,avg:V(avg.r,avg.g,avg.b)}});
      model.traverse(o=>{if(o.isMesh){o.castShadow=true;}});model.userData.anim=new Animator(model);this.group.add(model);
      const plan=PLAN[i];let path=null,idle=null;
      if(plan[0]==='idle')idle=plan[1];else{const route=ROUTES[plan[0]],speed=(route.slow?.7:1.05)+r()*.4;path=timeline(route,speed,i*31+7);path.offset=plan[1]*path.T;path.speed=speed;}
      this.list.push({model,path,idle,look,x:0,z:0,yaw:0,speed:0,near:false,frame:i%3});
    }
  }
  // posição no instante t (relógio sincronizado da partida)
  place(n,t){if(n.idle){const [u,v,yaw]=n.idle;return {u,v,yaw,speed:0};}const P=n.path;let k=(t+P.offset)%P.T;if(k<0)k+=P.T;let s=P.segs[0];for(const q of P.segs){if(k>=q.t0&&k<q.t1){s=q;break;}}
    const f=(k-s.t0)/Math.max(1e-6,s.t1-s.t0),u=s.a.x+(s.b.x-s.a.x)*f,v=s.a.z+(s.b.z-s.a.z)*f,moving=s.a!==s.b;return {u,v,yaw:moving?Math.atan2(s.b.x-s.a.x,s.b.z-s.a.z):null,speed:moving?P.speed:0};}
  // colisão simples com os jogadores (empurra quem anda por dentro)
  push(x,z,r=.3){for(const n of this.list){if(!n.near)continue;const dx=x-n.x,dz=z-n.z,d=Math.hypot(dx,dz),m=r+.28;if(d<m&&d>1e-4){x=n.x+dx/d*m;z=n.z+dz/d*m;}}return [x,z];}
  update(t,dt,camera,exploded,frame){
    this.group.visible=!exploded;if(exploded)return;
    for(const n of this.list){if(n.rag!=null){n.near=false;continue;}const p=this.place(n,t),x=ISLAND.x+p.u,z=ISLAND.z+p.v,y=groundLocal(p.u,p.v);n.x=x;n.z=z;
      if(p.yaw!==null){let d=p.yaw-n.yaw;d=Math.atan2(Math.sin(d),Math.cos(d));n.yaw+=d*Math.min(1,dt*6);}else if(n.idle)n.yaw=p.yaw;
      const dist=camera.position.distanceTo(V(x,y,z));n.near=dist<60;n.model.visible=n.near;if(!n.near)continue;
      n.model.position.set(x,y,z);n.model.rotation.set(0,n.yaw,0);
      // longe: anima em quadros alternados (três grupos) para poupar CPU
      if(dist<25||(frame+n.frame)%3===0)n.model.userData.anim.update(dist<25?dt:dt*3,{time:t+n.frame*2.1,speed:p.speed,yaw:n.yaw,grounded:true,look:null});}
  }
}

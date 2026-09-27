import * as THREE from 'three';
import {Kit,loft,limb,ellipsoid,box,sculpt,paint,reseed,rand,V} from './geometry.js';
import {SHOP,ISLAND} from './terrain.js';
import {makeCatch} from './fish.js';

// Supermercado inspirado nas lojas Althoff do sul de SC: paredes amarelo-limão, faixa superior em
// telha metálica ondulada azul, oval amarelo com o logo azul e a folhinha verde, marquise branca,
// totem branco, e por dentro: gôndolas cheias, hortifrúti, geladeiras, peixaria (onde se vende o
// pescado), padaria com o padeiro e caixas de autoatendimento (sem operador: o cliente passa tudo).
const F=SHOP.floor,Hh=6.4,{u0,u1,v0,v1}=SHOP;
const YELLOW=0xd8d52c,BLUE=0x2f6cc4,BLUE_DARK=0x1f4f98,WHITE=0xf4f4f0,GREEN=0x6fb83a;
function canvasTex(w,h,draw,srgb=true){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;}
// Logo: "Althoff" em azul, itálico, com a folha verde sobre o "o" e "supermercados" cursivo embaixo
export function drawLogo(c,x,y,size,{sub=true,color='#2c6db8'}={}){
  c.save();c.translate(x,y);c.fillStyle=color;c.textAlign='center';c.textBaseline='alphabetic';
  c.font=`italic bold ${size}px Georgia, 'Times New Roman', serif`;c.fillText('Althoff',0,0);
  const w=c.measureText('Althoff').width;
  // folha (sobre o segundo "o" da palavra, puxada para a direita)
  c.save();c.translate(w*.14,-size*.86);c.rotate(-.5);c.fillStyle='#74bf3c';c.beginPath();c.moveTo(-size*.02,0);c.quadraticCurveTo(size*.14,-size*.2,size*.3,-size*.02);c.quadraticCurveTo(size*.14,size*.12,-size*.02,0);c.fill();
  c.strokeStyle='#4f9a2a';c.lineWidth=size*.018;c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(size*.14,-size*.06,size*.27,-size*.02);c.stroke();c.restore();
  if(sub){c.font=`italic ${size*.36}px 'Segoe Script','Brush Script MT','Comic Sans MS',cursive`;c.fillText('supermercados',-w*.05,size*.36);}
  c.restore();}
const logoTexture=()=>canvasTex(1024,380,(c,w,h)=>{c.fillStyle='#f3d73a';c.beginPath();c.ellipse(w/2,h/2,w/2-8,h/2-8,0,0,6.3);c.fill();c.lineWidth=14;c.strokeStyle='#2c6db8';c.stroke();drawLogo(c,w/2+10,h*.6,190);});
function signTexture(text,{bg='#2c6db8',fg='#f3d73a',w=768,h=160,sub=''}={}){return canvasTex(w,h,(c)=>{c.fillStyle=bg;c.fillRect(0,0,w,h);c.fillStyle=fg;c.fillRect(0,h-16,w,16);c.fillStyle=fg;c.textAlign='center';c.textBaseline='middle';c.font=`bold ${sub?70:86}px Arial, Helvetica, sans-serif`;c.fillText(text,w/2,sub?h*.4:h/2-6);if(sub){c.font='bold 34px Arial';c.fillStyle='#ffffff';c.fillText(sub,w/2,h*.76);}});}
function posterTexture(title,lines,accent){return canvasTex(512,720,(c,w,h)=>{c.fillStyle='#fffdf2';c.fillRect(0,0,w,h);c.fillStyle=accent;c.fillRect(0,0,w,150);c.fillStyle='#fff';c.font='bold 64px Arial';c.textAlign='center';c.fillText(title,w/2,98);c.fillStyle='#c8202a';lines.forEach(([name,price],i)=>{const y=230+i*150;c.fillStyle='#222';c.font='bold 40px Arial';c.fillText(name,w/2,y);c.fillStyle='#d62028';c.font='bold 86px Arial';c.fillText(price,w/2,y+86);});drawLogo(c,w/2,h-28,52,{sub:false});});}
// Material do interior: luz fluorescente "embutida" (preenchimento suave sem precisar de dezenas de luzes)
function interior(opts={}){const m=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.7,...opts});m.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=diffuseColor.rgb*.07;');};m.customProgramCacheKey=()=>'interior';return m;}
// Chapa ondulada (trapezoidal) da faixa azul: nervuras verticais de verdade
function corrugated(width,height,ribs){const pos=[];const step=width/ribs;const prof=[[0,0],[.18,0],[.3,.07],[.7,.07],[.82,0],[1,0]];
  for(let r=0;r<ribs;r++)for(let k=0;k<prof.length-1;k++){const xa=-width/2+(r+prof[k][0])*step,xb=-width/2+(r+prof[k+1][0])*step,za=prof[k][1],zb=prof[k+1][1];pos.push(V(xa,0,za),V(xb,0,zb),V(xb,height,zb),V(xa,0,za),V(xb,height,zb),V(xa,height,za));}
  const g=new THREE.BufferGeometry().setFromPoints(pos);g.computeVertexNormals();return g;}
function product(k,mat,x,y,z,facing,kind,color){
  if(kind===0){const w=.16+rand()*.1,h=.2+rand()*.14;k.add(mat,box([x,y+h/2,z],[facing?.1:w,h,facing?w:.1]),color,.06);k.add(mat,box([x+(facing?(facing>0?.056:-.056):0),y+h*.62,z+(facing?0:0)],[facing?.004:w*.7,h*.28,facing?w*.7:.004]),0xffffff,.1);}
  else if(kind===1){const h=.28+rand()*.08;k.add(mat,loft([{y:y,rx:.04,rz:.04},{y:y+h*.62,rx:.042,rz:.042},{y:y+h*.8,rx:.02,rz:.02},{y:y+h,rx:.016,rz:.016}],{n:6}).translate(x,0,z),color,.05);k.add(mat,loft([{y:y+h*.25,rx:.043,rz:.043},{y:y+h*.45,rx:.043,rz:.043}],{n:6,capStart:false,capEnd:false}).translate(x,0,z),0xf2f2ea,.05);}
  else if(kind===2){k.add(mat,loft([{y:y,rx:.035,rz:.035},{y:y+.12,rx:.035,rz:.035}],{n:7}).translate(x,0,z),color,.05);}
  else{k.add(mat,sculpt(ellipsoid([x,y+.07,z],[.12,.08,.1],6,4),v=>{v.y=Math.max(v.y,y+.005);}),color,.08);}
}
export function buildShop(mats){
  const group=new THREE.Group(),colliders=[],ext=new Kit(),inn=new Kit(),wall=mats.wall,metal=mats.metal,im=interior(),imMetal=interior({roughness:.35,metalness:.55});reseed(777);
  const addBox=(u,v,du,dv)=>colliders.push({x0:u-du/2,x1:u+du/2,z0:v-dv/2,z1:v+dv/2});
  const cu=(u0+u1)/2,cv=(v0+v1)/2,W=u1-u0,D=v1-v0;
  // ----- piso de porcelanato com rejunte e calçada da entrada -----
  const tiles=canvasTex(512,512,(c,w,h)=>{for(let i=0;i<4;i++)for(let j=0;j<4;j++){const k=235+Math.floor(rand()*12);c.fillStyle=`rgb(${k},${k-3},${k-8})`;c.fillRect(i*128,j*128,128,128);}c.strokeStyle='#b9b4aa';c.lineWidth=3;for(let i=0;i<=4;i++){c.beginPath();c.moveTo(i*128,0);c.lineTo(i*128,h);c.stroke();c.beginPath();c.moveTo(0,i*128);c.lineTo(w,i*128);c.stroke();}});
  tiles.wrapS=tiles.wrapT=THREE.RepeatWrapping;tiles.repeat.set(W/2.4,D/2.4);
  const floor=new THREE.Mesh(new THREE.BoxGeometry(W,.5,D),new THREE.MeshStandardMaterial({map:tiles,roughness:.28,metalness:0}));floor.position.set(cu,F-.25,cv);floor.receiveShadow=true;group.add(floor);
  ext.add(wall,box([cu,F-.2,v0-1.6],[W+1,.4,3.2]),0xcfc9bc,.02);
  // ----- paredes externas: amarelo-limão embaixo, faixa branca, chapa azul ondulada em cima -----
  const low=3.5,band=.28,up=Hh-low-band;
  const wallSeg=(a,b,v,axis)=>{// axis 'u' = parede ao longo de u na coordenada v; 'v' = ao longo de v na coordenada u
    const len=Math.abs(b-a),mid=(a+b)/2,th=.3;const sz=axis==='u'?[len,0,th]:[th,0,len],pos=axis==='u'?[mid,0,v]:[v,0,mid];
    ext.add(wall,box([pos[0],F+low/2,pos[2]],[sz[0]||th,low,sz[2]||th]),YELLOW,.02);
    ext.add(wall,box([pos[0],F+low+band/2,pos[2]],[(sz[0]||th)+.08,band,(sz[2]||th)+.08]),WHITE,.01);
    ext.add(wall,box([pos[0],F+low+band+up/2,pos[2]],[sz[0]||th,up,sz[2]||th]),BLUE_DARK,.02);
    if(axis==='u')colliders.push({x0:Math.min(a,b),x1:Math.max(a,b),z0:v-.2,z1:v+.2});else colliders.push({x0:v-.2,x1:v+.2,z0:Math.min(a,b),z1:Math.max(a,b)});};
  wallSeg(u0,-9,v0,'u');wallSeg(9,u1,v0,'u');wallSeg(u0,u1,v1,'u');wallSeg(v0,v1,u0,'v');wallSeg(v0,v1,u1,'v');
  colliders.push({x0:-9,x1:-1.7,z0:v0-.2,z1:v0+.2},{x0:1.7,x1:9,z0:v0-.2,z1:v0+.2});
  // chapas onduladas por fora (fachada, laterais e fundos), afastadas 4 cm da parede
  const addSheet=(len,cx,cz,rotY)=>{const g=corrugated(len,up,Math.round(len/.32));g.rotateY(rotY);g.translate(cx,F+low+band,cz);ext.add(wall,g,BLUE,.03);};
  addSheet(W+.3,cu,v0-.19,Math.PI);addSheet(W+.3,cu,v1+.19,0);addSheet(D+.3,u0-.19,cv,-Math.PI/2);addSheet(D+.3,u1+.19,cv,Math.PI/2);
  ext.add(wall,box([cu,F+Hh+.12,cv],[W+.9,.24,D+.9]),WHITE,.01);// platibanda
  ext.add(wall,box([cu,F+Hh-.05,cv],[W-.2,.2,D-.2]),0x5d6e86,.03);// laje/telhado
  for(const [u,v]of [[-8,18],[6,12],[10,22]]){ext.add(metal,box([u,F+Hh+.55,v],[1.4,1,1]),0xc8ccd0,.03);ext.add(metal,new THREE.CylinderGeometry(.38,.38,.06,12).rotateX(Math.PI/2).translate(u,F+Hh+.55,v+.52),0x2b2e33,.02);}
  // vitrine de vidro com montantes de alumínio e portas automáticas
  const glass=new THREE.MeshStandardMaterial({color:0x9ec3d6,metalness:.2,roughness:.05,transparent:true,opacity:.28,depthWrite:false,envMapIntensity:1.6});
  for(const [a,b]of [[-9,-1.7],[1.7,9]]){const pane=new THREE.Mesh(new THREE.PlaneGeometry(b-a,low-.25),glass);pane.position.set((a+b)/2,F+(low-.25)/2+.05,v0);pane.renderOrder=5;group.add(pane);
    for(let u=a;u<=b+.01;u+=(b-a)/4)ext.add(metal,box([u,F+low/2,v0],[.08,low,.14]),0xc9ced3,.02);ext.add(metal,box([(a+b)/2,F+.06,v0],[b-a,.12,.16]),0xc9ced3,.02);ext.add(metal,box([(a+b)/2,F+low-.12,v0],[b-a,.14,.16]),0xc9ced3,.02);}
  ext.add(metal,box([0,F+low-.35,v0-.05],[3.6,.5,.3]),0xc9ced3,.02);
  const sensor=new THREE.Mesh(new THREE.BoxGeometry(.3,.08,.1),new THREE.MeshStandardMaterial({color:0x111,emissive:0xff2222,emissiveIntensity:1.5}));sensor.position.set(0,F+low-.6,v0-.22);group.add(sensor);
  const doors=[-1,1].map(s=>{const d=new THREE.Group();const p=new THREE.Mesh(new THREE.PlaneGeometry(1.62,low-.7),glass);p.renderOrder=5;d.add(p);const fr=new Kit();fr.add(metal,box([0,-(low-.7)/2,0],[1.66,.08,.06]),0xc9ced3).add(metal,box([0,(low-.7)/2,0],[1.66,.06,.06]),0xc9ced3).add(metal,box([s*-.8,0,0],[.06,low-.7,.06]),0xc9ced3).add(metal,box([s*.8,0,0],[.06,low-.7,.06]),0xc9ced3).add(metal,box([s*-.7,0,.05],[.03,.5,.03]),0x888888);d.add(fr.build());d.position.set(s*.82,F+(low-.7)/2+.06,v0-.02);group.add(d);return {g:d,s};});
  // marquise branca sobre a entrada com colunas redondas e luzes embutidas
  ext.add(wall,box([0,F+3.75,v0-1.9],[20,.36,3.8]),WHITE,.01);ext.add(wall,box([0,F+3.95,v0-3.75],[20.2,.18,.12]),YELLOW,.01);
  for(const u of [-9.2,-3,3,9.2]){ext.add(wall,limb(V(u,F,v0-3.5),V(u,F+3.6,v0-3.5),.16,.16,12),WHITE,.01);colliders.push({x:u,z:v0-3.5,r:.2});}
  const downlights=new THREE.Group();for(const u of [-7,-3.5,0,3.5,7])for(const v of [v0-1.2,v0-2.8]){const l=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,.03,10),new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xfff2d8,emissiveIntensity:3}));l.position.set(u,F+3.555,v);downlights.add(l);}group.add(downlights);
  // oval amarelo com o logo na faixa azul, e o mesmo logo menor nas laterais
  const logoMat=new THREE.MeshStandardMaterial({map:logoTexture(),roughness:.45,emissive:0xffffff,emissiveIntensity:.08,emissiveMap:null});
  const oval=new THREE.Mesh(new THREE.CircleGeometry(1,64),logoMat);oval.scale.set(4.7,1.75,1);oval.position.set(0,F+low+band+up/2,v0-.34);oval.rotation.y=Math.PI;group.add(oval);
  ext.add(wall,sculpt(new THREE.CylinderGeometry(1,1,.12,64),()=>{}).rotateX(Math.PI/2).scale(4.82,1.84,1).translate(0,F+low+band+up/2,v0-.25),0x2c6db8,.01);
  for(const s of [-1,1]){const o=oval.clone();o.scale.set(3,1.1,1);o.position.set(s*(u1+.34),F+low+band+up/2,cv);o.rotation.y=s*Math.PI/2;group.add(o);ext.add(wall,new THREE.CylinderGeometry(1,1,.12,48).rotateX(Math.PI/2).rotateY(s*Math.PI/2).scale(1,1.18,3.1).translate(s*(u1+.25),F+low+band+up/2,cv),0x2c6db8,.01);}
  // cartazes de oferta na parede amarela da fachada
  const offers=[['OFERTAS',[['Pão francês kg','R$ 12,90'],['Baly 473 ml','R$ 7,99'],['Tainha kg','R$ 19,90']],'#d62028'],['ÇA SEMANA',[['Banana kg','R$ 4,99'],['Café 500 g','R$ 18,90'],['Isca viva','R$ 9,90']],'#2c6db8']];
  offers[1][0]='DA SEMANA';offers.forEach(([title,lines,accent],i)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(1.5,2.1),new THREE.MeshStandardMaterial({map:posterTexture(title,lines,accent),roughness:.6}));m.position.set(i?12.5:-12.5,F+1.7,v0-.185);m.rotation.y=Math.PI;group.add(m);ext.add(wall,box([i?12.5:-12.5,F+1.7,v0-.16],[1.62,2.22,.02]),0xffffff,.01);});
  // totem de estrada branco com o logo na vertical e a base verde e azul
  const tu=-13,tv=-9.8;ext.add(wall,box([tu,ISLAND.plateau+4.4,tv],[1.3,8.8,.7]),WHITE,.01);ext.add(wall,box([tu,ISLAND.plateau+.7,tv],[1.42,1.4,.8]),GREEN,.02);ext.add(wall,box([tu,ISLAND.plateau+1.6,tv],[1.42,.4,.8]),BLUE,.02);
  const vt=canvasTex(256,1024,(c,w,h)=>{c.fillStyle='#fff';c.fillRect(0,0,w,h);c.translate(w/2+40,h*.55);c.rotate(-Math.PI/2);drawLogo(c,0,0,150,{sub:true});});
  for(const s of [-1,1]){const p=new THREE.Mesh(new THREE.PlaneGeometry(1.2,6.2),new THREE.MeshStandardMaterial({map:vt,roughness:.5,emissive:0xffffff,emissiveIntensity:.05}));p.position.set(tu,ISLAND.plateau+5.1,tv+s*.36);p.rotation.y=s<0?Math.PI:0;group.add(p);}
  colliders.push({x0:tu-.7,x1:tu+.7,z0:tv-.4,z1:tv+.4});
  // carrinhos no abrigo da entrada
  const cartKit=new Kit();const cart=(k,x,z,rot)=>{const g=new Kit();g.add(metal,box([0,.72,0],[.56,.46,.85]),0xc9ced3,.02);for(let i=0;i<6;i++)g.add(metal,box([-.29,.72,-.36+i*.14],[.02,.44,.02]),0x9aa0a6);g.add(metal,box([0,.52,0],[.5,.03,.8]),0x9aa0a6).add(metal,box([0,1,-.46],[.56,.05,.05]),0x2c6db8);
    for(const sx of [-1,1])for(const sz of [-1,1]){g.add(metal,limb(V(sx*.24,.12,sz*.34),V(sx*.25,.5,sz*.38),.015,.015,4),0x9aa0a6);g.add(metal,new THREE.CylinderGeometry(.06,.06,.04,8).rotateZ(Math.PI/2).translate(sx*.24,.07,sz*.34),0x222222);}
    const b=g.build();b.position.set(x,F,z);b.rotation.y=rot;k.push(b);};
  const carts=[];for(let i=0;i<5;i++)cart(carts,11.8+i*.0,v0-1.2-i*.22,0);carts.forEach(c=>group.add(c));colliders.push({x0:11.4,x1:12.2,z0:v0-2.4,z1:v0-.7});
  // ================= INTERIOR =================
  // paredes internas brancas com faixa amarela e azul, teto com luminárias
  inn.add(im,box([cu,F+Hh-.3,cv],[W-.62,.1,D-.62]),0xeceae4,.01);
  for(const [a,b,c,axis]of [[u0+.16,u1-.16,v1-.16,'u'],[v0+.16,v1-.16,u0+.16,'v'],[v0+.16,v1-.16,u1-.16,'v']]){const len=b-a,mid=(a+b)/2;const s=axis==='u'?[len,.02]:[.02,len];const p=axis==='u'?[mid,c]:[c,mid];const off=axis==='u'?[0,-.012]:[c<0?.012:-.012,0];
    inn.add(im,box([p[0]+off[0],F+2.6,p[1]+off[1]],[s[0],.3,s[1]]),YELLOW,.01).add(im,box([p[0]+off[0],F+2.95,p[1]+off[1]],[s[0],.12,s[1]]),BLUE,.01);}
  const lightPanels=new THREE.Group(),panelMat=new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xf4f8ff,emissiveIntensity:1.5});
  for(let u=-12;u<=12;u+=4)for(let v=v0+3;v<v1-1;v+=4){const l=new THREE.Mesh(new THREE.BoxGeometry(.4,.05,1.6),panelMat);l.position.set(u,F+Hh-.37,v);lightPanels.add(l);}group.add(lightPanels);
  const lights=[];for(const [u,v]of [[-7,11],[7,11],[-7,21],[7,21]]){const l=new THREE.PointLight(0xfff4e2,13,24,1.7);l.position.set(u,F+Hh-1,v);group.add(l);lights.push(l);}
  // placas de setor penduradas
  const hang=(text,u,v,rot,opts={})=>{const t=signTexture(text,opts),m=new THREE.MeshStandardMaterial({map:t,roughness:.6,emissive:0xffffff,emissiveIntensity:.12,emissiveMap:t});
    inn.add(imMetal,box([u,F+4.1,v],[3.3,.72,.04]),0x2c6db8,.01);for(const s of [-1,1])inn.add(imMetal,limb(V(u+s*1.4,F+4.45,v),V(u+s*1.4,F+Hh-.35,v),.008,.008,4),0x888888);
    for(const s of [-1,1]){const p=new THREE.Mesh(new THREE.PlaneGeometry(3.2,.66),m);p.position.set(u,F+4.1,v+s*.03);p.rotation.y=s<0?Math.PI:0;group.add(p);}};
  hang('MERCEARIA',-7.2,12,0);hang('BEBIDAS',7.2,12,0);hang('PADARIA',9,21.2,0,{bg:'#f3d73a',fg:'#2c6db8'});hang('PEIXARIA',-13.2,10.4,0,{bg:'#1f4f98',fg:'#f3d73a',sub:'COMPRAMOS SEU PESCADO'});hang('FRIOS & LATICÍNIOS',-8,25.5,0);hang('HORTIFRÚTI',13,8.4,0,{bg:'#6fb83a',fg:'#ffffff'});
  // ----- gôndolas com produtos (dois lados, cinco prateleiras, faixa de preço amarela) -----
  const palette=[0xd62028,0x2c6db8,0xf3d73a,0x3a9a4a,0xf07a22,0x7b3fa0,0xffffff,0x1d1d1f,0xe85a8a,0x8a5a2a,0x2ab0c8];
  const gondola=(u,va,vb)=>{const len=vb-va,mid=(va+vb)/2;inn.add(imMetal,box([u,F+.08,mid],[1.1,.16,len]),0x3a3c40,.02).add(imMetal,box([u,F+1.05,mid],[.06,1.9,len]),0xd8dadd,.02);
    for(const s of [-1,1]){for(let sh=0;sh<5;sh++){const y=F+.2+sh*.38;inn.add(imMetal,box([u+s*.3,y,mid],[.5,.03,len]),0xd8dadd,.02).add(im,box([u+s*.56,y-.02,mid],[.02,.07,len]),0xf3d73a,.02);
        let v=va+.1;while(v<vb-.12){const kind=[0,0,1,2,0,3][Math.floor(rand()*6)],color=palette[Math.floor(rand()*palette.length)],n=1+Math.floor(rand()*3);for(let d=0;d<n;d++)product(inn,im,u+s*(.16+d*.13),y+.015,v,s,kind,color);v+=kind===0?.2+rand()*.05:.11;}}}
    inn.add(im,box([u,F+2.05,mid],[1.1,.18,len]),0x2c6db8,.02);colliders.push({x0:u-.6,x1:u+.6,z0:va,z1:vb});};
  for(const u of [-9,-5.5,5.5,9])gondola(u,11,20.5);
  // ilha de promoção no corredor central: pirâmide de latas de Baly (preto e amarelo) e melancias
  const balyTex=canvasTex(256,128,(c,w,h)=>{c.fillStyle='#111';c.fillRect(0,0,w,h);c.fillStyle='#ffc81e';c.font='bold 56px Georgia';c.textAlign='center';c.fillText('BALY',w/2,80);c.font='bold 16px Arial';c.fillText('ENERGY DRINK',w/2,108);});
  const can=new THREE.CylinderGeometry(.034,.034,.16,14);const canMesh=new THREE.InstancedMesh(can,new THREE.MeshStandardMaterial({map:balyTex,metalness:.5,roughness:.35}),120);let ci=0;const mm=new THREE.Matrix4();
  inn.add(im,box([0,F+.25,15],[1.6,.5,1.6]),0x8a6a45,.05);colliders.push({x0:-.85,x1:.85,z0:14.15,z1:15.85});
  for(let layer=0;layer<5;layer++){const n=8-layer;for(let i=0;i<n;i++)for(let j=0;j<n;j++){if(ci>=120)break;mm.makeRotationY(rand()*6);mm.setPosition(-.07*(n-1)+i*.14,F+.58+layer*.165,15-.07*(n-1)+j*.14);canMesh.setMatrixAt(ci++,mm);}}canMesh.count=ci;canMesh.castShadow=true;group.add(canMesh);
  const balySign=new THREE.Mesh(new THREE.PlaneGeometry(1.4,.7),new THREE.MeshStandardMaterial({map:canvasTex(512,256,(c,w,h)=>{c.fillStyle='#111';c.fillRect(0,0,w,h);c.fillStyle='#ffc81e';c.font='bold 96px Georgia';c.textAlign='center';c.fillText('BALY',w/2,120);c.font='bold 36px Arial';c.fillText('LEVE 3 PAGUE 2',w/2,190);}),emissive:0xffffff,emissiveIntensity:.55,roughness:.9}));balySign.material.emissiveMap=balySign.material.map;
  balySign.position.set(0,F+1.95,14.18);balySign.rotation.y=Math.PI;group.add(balySign);inn.add(imMetal,limb(V(0,F+.5,14.3),V(0,F+1.6,14.3),.02,.02,5),0x333333);
  for(let i=0;i<6;i++)inn.add(im,ellipsoid([-.4+(i%3)*.4,F+.62+Math.floor(i/3)*.1,17.6+(i%2)*.2],[.22,.18,.16],8,6),0x2f7a2a,.12);inn.add(im,box([0,F+.25,17.7],[1.6,.5,1.2]),0x8a6a45,.05);colliders.push({x0:-.85,x1:.85,z0:17.05,z1:18.35});
  // ----- hortifrúti na parede leste: caixotes inclinados com frutas -----
  const fruits=[[0xf07a22,.07],[0xd62028,.065],[0xf3d73a,.08],[0x6fb83a,.07],[0x7b3fa0,.05],[0xff9a3a,.075]];
  for(let i=0;i<6;i++){const v=9.5+i*1.5,f=fruits[i];inn.add(im,box([u1-.9,F+.45,v],[1.2,.9,1.3]),0x8a6a45,.06).add(im,box([u1-.95,F+.95,v],[1.1,.12,1.25],[0,0,.25]),0x7a5a3a,.06);
    for(let a=0;a<18;a++)inn.add(im,ellipsoid([u1-1.35+(a%5)*.19+rand()*.04,F+1.02+Math.floor(a/5)*.05+(a%5)*.045,v-.45+Math.floor(a/5)*.3],[f[1],f[1]*.95,f[1]],6,4),f[0],.1);}
  colliders.push({x0:u1-1.6,x1:u1,z0:8.7,z1:18.4});
  // ----- geladeiras de porta de vidro no fundo (frios e laticínios) -----
  const fridgeGlow=new THREE.MeshStandardMaterial({color:0xeef6ff,emissive:0xdff0ff,emissiveIntensity:.9,roughness:.3});
  for(let i=0;i<6;i++){const u=-14+i*2.1;inn.add(imMetal,box([u,F+2.15,v1-.75],[2,.1,1.1]),0xe8eaec,.02).add(imMetal,box([u,F+.15,v1-.75],[2,.3,1.1]),0xe8eaec,.02);for(const s of [-1,1])inn.add(imMetal,box([u+s*.97,F+1.15,v1-.75],[.06,2.1,1.1]),0xe8eaec,.02);const back=new THREE.Mesh(new THREE.PlaneGeometry(1.88,1.85),fridgeGlow);back.position.set(u,F+1.2,v1-.27);back.rotation.y=Math.PI;group.add(back);
    for(let sh=0;sh<4;sh++){inn.add(imMetal,box([u,F+.4+sh*.45,v1-.7],[1.8,.03,.8]),0xb9c0c6,.02);for(let b=0;b<9;b++)product(inn,im,u-.8+b*.2,F+.42+sh*.45,v1-.55,0,sh===0?1:sh===3?3:2,palette[(i*3+b+sh)%palette.length]);}
    const door=new THREE.Mesh(new THREE.PlaneGeometry(1.9,2),glass);door.position.set(u,F+1.15,v1-1.31);door.rotation.y=Math.PI;door.renderOrder=5;group.add(door);inn.add(imMetal,box([u,F+1.15,v1-1.3],[.06,2.05,.05]),0x9aa0a6);}
  colliders.push({x0:-15.2,x1:-1.8,z0:v1-1.4,z1:v1});
  // ----- PEIXARIA na parede oeste: balcão refrigerado com gelo e peixes, balança; aqui se vende o balde -----
  inn.add(imMetal,box([u0+1.3,F+.5,15.5],[1.1,1,7]),0xe8eaec,.02).add(im,box([u0+1.25,F+1.02,15.5],[.95,.06,6.8]),0xf4fbff,.06);
  for(let i=0;i<40;i++)inn.add(im,sculpt(new THREE.IcosahedronGeometry(.035,0).translate(u0+.9+rand()*.7,F+1.06,12.3+rand()*6.4),()=>{}),0xe6f4ff,.08);
  const fishColors=[[0x4f5b62,0xe9ecea],[0xb8433f,0xf5d6cf],[0x3d4a45,0xf1f1ec],[0x2b4f73,0xf2f4f5]];
  [1,2,3,5,0,8,4,10,1].forEach((sp,i)=>{const f=makeCatch(sp);const L=f.userData.len||.4,k=Math.min(.8,.4/L);f.scale.setScalar(k);f.rotation.set(0,0,Math.PI/2);f.rotateY(.15*(i%2?1:-1));f.position.set(u0+1.25,F+1.1,12.6+i*.72);f.traverse(o=>{if(o.isMesh)o.castShadow=false;});group.add(f);});
  const glassFront=new THREE.Mesh(new THREE.PlaneGeometry(6.9,.45),glass);glassFront.position.set(u0+1.87,F+1.25,15.5);glassFront.rotation.y=Math.PI/2;glassFront.renderOrder=5;group.add(glassFront);
  inn.add(imMetal,box([u0+1.4,F+1.25,11.7],[.3,.25,.3]),0xdddddd,.02);const scaleScreen=new THREE.Mesh(new THREE.PlaneGeometry(.2,.08),new THREE.MeshStandardMaterial({color:0x103010,emissive:0x40ff60,emissiveIntensity:1.2}));scaleScreen.position.set(u0+1.56,F+1.3,11.7);scaleScreen.rotation.y=Math.PI/2;group.add(scaleScreen);
  inn.add(im,box([u0+.35,F+2,15.5],[.1,1.2,7]),0xf4f4f0,.01);for(let i=0;i<60;i++)inn.add(im,box([u0+.41,F+1.52+Math.floor(i/15)*.28,12.2+(i%15)*.44+(Math.floor(i/15)%2)*.0],[.02,.25,.41]),(i+Math.floor(i/15))%2?0xdff0fa:0x9fd0ea,.03);
  colliders.push({x0:u0,x1:u0+1.9,z0:11.9,z1:19.1});
  // ----- PADARIA no canto nordeste: vitrine curva, pães franceses, bolos, forno e prateleiras de pão -----
  const bread=0xd9a25a,crust=0xb57a38;
  inn.add(im,box([9,F+.5,22.6],[10,1,1]),0xf1ede4,.02).add(im,box([9,F+1.03,22.6],[10.1,.06,1.1]),0x8a6a45,.04).add(im,box([9,F+.5,22.08],[10,.9,.04]),0xf3d73a,.02);
  const vit=new THREE.Mesh(new THREE.CylinderGeometry(.55,.55,9.6,16,1,true,0,Math.PI),glass);vit.rotation.z=Math.PI/2;vit.rotation.y=0;vit.position.set(9,F+1.06,22.6);vit.renderOrder=5;group.add(vit);
  for(let i=0;i<60;i++){const x=4.6+(i%20)*.44,z=22.35+Math.floor(i/20)*.22;const k=i%3;if(k===0)inn.add(im,sculpt(ellipsoid([x,F+1.12,z],[.11,.06,.065],8,5),v=>{v.y+=Math.abs(v.x-x)<.02?-.012:0;}),bread,.08);else if(k===1)inn.add(im,ellipsoid([x,F+1.11,z],[.08,.055,.08],8,5),0xe2b060,.08);else inn.add(im,ellipsoid([x,F+1.1,z],[.075,.05,.075],8,5),0xf4ecdc,.05);}
  for(const [x,c]of [[5.4,0xf2c6d8],[7.4,0x6a3c24],[10.6,0xf6f0e0],[12.8,0xf3d73a]]){inn.add(im,loft([{y:F+1.07,rx:.26,rz:.26},{y:F+1.33,rx:.26,rz:.26}],{n:14}).translate(x,0,22.9),c,.04).add(im,loft([{y:F+1.33,rx:.27,rz:.27},{y:F+1.38,rx:.22,rz:.22}],{n:14}).translate(x,0,22.9),0xffffff,.03);}
  inn.add(im,box([9,F+1.06,22.62],[10,.02,.8]),0xf5f5f5,.01);
  // prateleiras de pão na parede do fundo com cestos de vime cheios de pão francês
  for(let r=0;r<3;r++){inn.add(im,box([9,F+.9+r*.55,v1-.45],[10,.05,.6]),0x8a6a45,.04);for(let b=0;b<6;b++){const x=4.8+b*1.7;inn.add(im,loft([{y:F+.93+r*.55,rx:.32,rz:.2},{y:F+1.07+r*.55,rx:.36,rz:.24}],{n:10,capStart:true,capEnd:false}).translate(x,0,v1-.45),0xb88a4a,.1);for(let p=0;p<7;p++)inn.add(im,ellipsoid([x-.24+p*.08,F+1.1+r*.55,v1-.45+(p%2)*.06-.03],[.07,.045,.045],6,4),p%2?bread:crust,.08);}}
  inn.add(im,box([9,F+2.5,v1-.45],[10,.05,.6]),0x8a6a45,.04);
  inn.add(imMetal,box([14.5,F+1,v1-1.6],[1.6,2,1.3]),0xb9c0c6,.02);const ovenWin=new THREE.Mesh(new THREE.PlaneGeometry(1,.5),new THREE.MeshStandardMaterial({color:0x331100,emissive:0xff7a20,emissiveIntensity:1.8}));ovenWin.position.set(14.5,F+1.3,v1-2.27);ovenWin.rotation.y=Math.PI;group.add(ovenWin);
  const chalk=new THREE.Mesh(new THREE.PlaneGeometry(1.4,1),new THREE.MeshStandardMaterial({map:canvasTex(420,300,(c,w,h)=>{c.fillStyle='#2b3a2e';c.fillRect(0,0,w,h);c.strokeStyle='#8a6a45';c.lineWidth=18;c.strokeRect(0,0,w,h);c.fillStyle='#f4f1e8';c.textAlign='center';c.font='bold 40px "Comic Sans MS", cursive';c.fillText('Pão francês',w/2,90);c.fillText('quentinho!',w/2,140);c.font='30px "Comic Sans MS", cursive';c.fillStyle='#f3d73a';c.fillText('saiu agora 🥖',w/2,200);c.fillStyle='#fff';c.fillText('R$ 12,90 o kg',w/2,250);}),roughness:.9}));
  chalk.position.set(3.35,F+1.9,v1-.2);chalk.rotation.y=Math.PI;group.add(chalk);
  colliders.push({x0:3.9,x1:14.1,z0:22,z1:23.2},{x0:3.9,x1:14.1,z0:v1-.8,z1:v1},{x0:13.6,x1:15.9,z0:v1-2.3,z1:v1});
  // ----- caixas de autoatendimento: esteira, leitor, tela, maquininha, área de ensacar, poste com número -----
  const belt=canvasTex(64,256,(c,w,h)=>{c.fillStyle='#161718';c.fillRect(0,0,w,h);c.fillStyle='#2a2b2d';for(let y=0;y<h;y+=16)c.fillRect(0,y,w,5);});belt.wrapS=belt.wrapT=THREE.RepeatWrapping;belt.repeat.set(1,3);
  const beltMat=new THREE.MeshStandardMaterial({map:belt,roughness:.7});
  const screenTex=canvasTex(320,240,(c,w,h)=>{c.fillStyle='#f4f6f8';c.fillRect(0,0,w,h);c.fillStyle='#2c6db8';c.fillRect(0,0,w,54);drawLogo(c,w/2,44,40,{sub:false,color:'#f3d73a'});c.fillStyle='#1f2a36';c.textAlign='center';c.font='bold 22px Arial';c.fillText('AUTOATENDIMENTO',w/2,96);c.font='18px Arial';c.fillText('Passe seus produtos',w/2,132);c.fillText('no leitor',w/2,156);c.fillStyle='#6fb83a';c.fillRect(70,184,180,38);c.fillStyle='#fff';c.font='bold 18px Arial';c.fillText('INICIAR',w/2,210);});
  const scanGlow=new THREE.MeshStandardMaterial({color:0x220000,emissive:0xff2020,emissiveIntensity:1.6,roughness:.1});
  for(const [i,u]of [[1,-11],[2,-7.2],[3,7.2],[4,11]].map(([n,u])=>[n,u])){const v=7.2;
    inn.add(imMetal,box([u,F+.45,v],[.8,.9,2.8]),0xe9eaec,.02).add(im,box([u,F+.45,v-1.41],[.82,.86,.04]),0x2c6db8,.02);
    const bm=new THREE.Mesh(new THREE.BoxGeometry(.6,.02,1.5),beltMat);bm.position.set(u,F+.915,v+.55);group.add(bm);
    inn.add(imMetal,box([u,F+.93,v-.35],[.62,.03,.5]),0x2b2e33,.02);const sg=new THREE.Mesh(new THREE.PlaneGeometry(.4,.3),scanGlow);sg.rotation.x=-Math.PI/2;sg.position.set(u,F+.95,v-.35);group.add(sg);
    inn.add(imMetal,limb(V(u+.3,F+.9,v-.3),V(u+.3,F+1.55,v-.3),.025,.025,6),0x2b2e33).add(imMetal,box([u+.3,F+1.6,v-.3],[.06,.36,.5],[0,0,-.3]),0x1d1f22,.02);
    const scr=new THREE.Mesh(new THREE.PlaneGeometry(.44,.33),new THREE.MeshStandardMaterial({map:screenTex,emissive:0xffffff,emissiveMap:screenTex,emissiveIntensity:.9}));scr.position.set(u+.26,F+1.6,v-.3);scr.rotation.set(0,-Math.PI/2,-.3);scr.rotation.order='YXZ';scr.rotation.set(-0,-Math.PI/2,0);scr.rotateX(-.3);group.add(scr);
    inn.add(imMetal,box([u-.22,F+1,v-.75],[.1,.16,.2],[-.4,0,0]),0x1d1f22,.02);
    inn.add(imMetal,box([u,F+.78,v-1.9],[.8,.05,1],[0,0,0]),0xc9ced3,.02).add(imMetal,limb(V(u-.3,F+.8,v-1.5),V(u-.3,F+1.3,v-1.5),.012,.012,4),0x9aa0a6).add(imMetal,limb(V(u+.3,F+.8,v-1.5),V(u+.3,F+1.3,v-1.5),.012,.012,4),0x9aa0a6).add(im,box([u,F+1.02,v-1.9],[.5,.44,.02]),0xf4f4f0,.05);
    inn.add(imMetal,limb(V(u-.35,F+.9,v+1.3),V(u-.35,F+2.4,v+1.3),.03,.03,6),0x2b2e33);
    const num=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,.12,16).rotateX(Math.PI/2).rotateY(Math.PI/2),new THREE.MeshStandardMaterial({map:canvasTex(128,128,(c)=>{c.fillStyle='#1a8a3a';c.fillRect(0,0,128,128);c.fillStyle='#fff';c.font='bold 90px Arial';c.textAlign='center';c.textBaseline='middle';c.fillText(String(i),64,70);}),emissive:0x40ff70,emissiveIntensity:.8}));num.position.set(u-.35,F+2.55,v+1.3);group.add(num);
    colliders.push({x0:u-.45,x1:u+.45,z0:v-2.45,z1:v+1.45});}
  // cestinhas empilhadas e carrinhos na entrada, por dentro
  for(let i=0;i<5;i++)inn.add(im,loft([{y:F+i*.12,rx:.22,rz:.16},{y:F+.24+i*.12,rx:.26,rz:.19}],{n:8,capStart:true,capEnd:false}).translate(-3.2,0,5.4),0xd62028,.05);colliders.push({x:-3.2,z:5.4,r:.3});
  const bakerSpot={u:9,v:23.45,yaw:Math.PI};
  const e=ext.build(),n=inn.build();e.traverse(o=>{if(o.isMesh)o.castShadow=true;});n.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=true;}});group.add(e,n);
  const points={baker:bakerSpot,sell:{u:u0+2.6,v:15.5},door:{u:0,v:v0},lanes:[-11,-7.2,7.2,11].map(u=>({u,v:7.2}))};
  let doorOpen=0;
  return {group,colliders,points,lights,
    update(t,dt,camera,people=[]){belt.offset.y=(belt.offset.y-dt*.4)%1;
      const near=people.some(p=>Math.abs(p.x-ISLAND.x)<2.6&&Math.abs(p.z-(ISLAND.z+v0))<3.6);doorOpen+=((near?1:0)-doorOpen)*(1-Math.exp(-dt*5));doors.forEach(d=>{d.g.position.x=d.s*(.82+doorOpen*1.55);});
      scanGlow.emissiveIntensity=1.3+Math.sin(t*9)*.3;return doorOpen;},
    doorOpen:()=>doorOpen>.6};
}

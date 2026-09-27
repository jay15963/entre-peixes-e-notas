import * as THREE from 'three';
import {Kit,loft,limb,ellipsoid,box,sculpt,sweep,paint,tint,reseed,rand,V} from './geometry.js';
import {ISLAND,DOCK,BERTH,SHOP,HOUSES,CHURCH,LIGHTHOUSE,terrainLocal,groundLocal,flatMask,pathMask,fbm2,shoreRadius,footprint,LANE,BOLLARDS} from './terrain.js';
import {U} from './shaders.js';
import {buildShop} from './shop.js';

// Ilha central: vila de pescadores no estilo açoriano do litoral catarinense, com praia, cais,
// calçadão de pedra portuguesa, rua de paralelepípedo levando ao supermercado e o farol no morro.
// Tudo em coordenadas locais (u = x, v = z) do grupo da ilha. Nada coplanar: cada acabamento fica
// alguns centímetros à frente da superfície que decora (sem "briga" de profundidade).
const P=ISLAND.plateau;
// ---------- Materiais ----------
export function swayMaterial(opts={},strength=1){
  const m=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.85,...opts});
  m.onBeforeCompile=s=>{s.uniforms.uTime=U.uTime;s.uniforms.uStorm=U.uStorm;
    s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute float aSway;uniform float uTime,uStorm;').replace('#include <begin_vertex>',`#include <begin_vertex>
      vec4 swp=modelMatrix*vec4(transformed,1.);float ph=dot(swp.xz,vec2(.13,.09));float str=(.09+uStorm*.5)*${strength.toFixed(2)};
      float g=sin(uTime*1.3+ph)*.6+sin(uTime*2.7+ph*1.7)*.3+sin(uTime*6.1+ph*3.1+swp.y)*.12*aSway;
      transformed.x+=(g+.35*uStorm)*aSway*str;transformed.z+=sin(uTime*1.07+ph*1.3)*.45*aSway*str;transformed.y-=abs(g)*aSway*aSway*str*.2;`);};
  m.customProgramCacheKey=()=>'sway'+strength;return m;
}
function sway(geo,fn){const g=geo.index?geo.toNonIndexed():geo,p=g.attributes.position,a=new Float32Array(p.count),v=V();for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);a[i]=fn(v);}g.setAttribute('aSway',new THREE.BufferAttribute(a,1));return g;}
function canvasTex(w,h,draw,repeat=[1,1],srgb=true){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');draw(x,w,h);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(...repeat);t.anisotropy=8;if(srgb)t.colorSpace=THREE.SRGBColorSpace;return t;}
const R=(a,b)=>a+(b-a)*rand();
// Paralelepípedo: pedras irregulares em fiadas desencontradas; o mapa de relevo arredonda cada pedra
function cobbleTextures(){const stones=[];for(let r=0;r<16;r++){let x=(r%2)*16;while(x<512){const w=26+rand()*18;stones.push([x,r*32,w,30]);x+=w+3;}}
  const col=canvasTex(512,512,(c,w,h)=>{c.fillStyle='#3d3a35';c.fillRect(0,0,w,h);for(const [x,y,sw,sh]of stones){const k=R(.75,1.1),tone=R(0,1);const base=tone<.5?[134,128,118]:[118,110,99];c.fillStyle=`rgb(${base[0]*k|0},${base[1]*k|0},${base[2]*k|0})`;c.beginPath();c.roundRect(x+1,y+1,sw-2,sh-3,7);c.fill();c.fillStyle='rgba(255,255,255,.06)';c.beginPath();c.roundRect(x+4,y+3,sw*.6,sh*.35,5);c.fill();}},[1,1]);
  const bump=canvasTex(512,512,(c,w,h)=>{c.fillStyle='#000';c.fillRect(0,0,w,h);for(const [x,y,sw,sh]of stones){const g=c.createRadialGradient(x+sw/2,y+sh/2,2,x+sw/2,y+sh/2,sw*.6);g.addColorStop(0,'#fff');g.addColorStop(1,'#333');c.fillStyle=g;c.beginPath();c.roundRect(x+1,y+1,sw-2,sh-3,7);c.fill();}},[1,1],false);
  return {col,bump};}
// Calçadão de pedra portuguesa: ondas pretas e brancas em mosaico miúdo (como em Copacabana e nas praias de SC)
function mosaicTextures(){const S=512,cells=[];for(let y=0;y<S;y+=8)for(let x=(y/8%2)*4;x<S;x+=8)cells.push([x+R(-1,1),y+R(-1,1)]);
  const wave=(x,y)=>Math.sin(y/S*Math.PI*2*2+Math.sin(x/S*Math.PI*2)*1.6)>.15;
  const col=canvasTex(S,S,(c)=>{c.fillStyle='#57544f';c.fillRect(0,0,S,S);for(const [x,y]of cells){const dark=wave(x,y);const k=R(.85,1.08);c.fillStyle=dark?`rgb(${58*k|0},${56*k|0},${54*k|0})`:`rgb(${236*k|0},${230*k|0},${216*k|0})`;c.fillRect(x+.8,y+.8,6.4+R(-.6,.6),6.4+R(-.6,.6));}},[1,1]);
  const bump=canvasTex(S,S,(c)=>{c.fillStyle='#000';c.fillRect(0,0,S,S);for(const [x,y]of cells){c.fillStyle='#ddd';c.fillRect(x+1.2,y+1.2,5.6,5.6);}},[1,1],false);
  return {col,bump};}
function concreteTextures(){const col=canvasTex(256,256,(c,w,h)=>{c.fillStyle='#c9c3b6';c.fillRect(0,0,w,h);for(let i=0;i<2500;i++){c.fillStyle=`rgba(${rand()<.5?0:255},${rand()<.5?0:255},${rand()<.5?0:255},.03)`;c.fillRect(rand()*w,rand()*h,2,2);}c.strokeStyle='#8f897d';c.lineWidth=3;for(let i=0;i<=2;i++){c.beginPath();c.moveTo(0,i*128);c.lineTo(w,i*128);c.stroke();c.beginPath();c.moveTo(i*128,0);c.lineTo(i*128,h);c.stroke();}});
  const bump=canvasTex(256,256,(c,w,h)=>{c.fillStyle='#fff';c.fillRect(0,0,w,h);c.strokeStyle='#000';c.lineWidth=4;for(let i=0;i<=2;i++){c.beginPath();c.moveTo(0,i*128);c.lineTo(w,i*128);c.stroke();c.beginPath();c.moveTo(i*128,0);c.lineTo(i*128,h);c.stroke();}},[1,1],false);return {col,bump};}
// Asfalto do estacionamento com as vagas pintadas (a textura cobre a praça inteira)
function asphaltTexture(w,h){return canvasTex(1024,Math.round(1024*h/w),(c,W,H)=>{c.fillStyle='#5f6064';c.fillRect(0,0,W,H);for(let i=0;i<9000;i++){const g=78+rand()*40;c.fillStyle=`rgba(${g},${g},${g+4},.5)`;c.fillRect(rand()*W,rand()*H,2,2);}
  const px=W/w;c.strokeStyle='#e9e4d6';c.lineWidth=.12*px;for(const side of [-1,1])for(let k=0;k<5;k++){const x=W/2+side*(8+k*2.7)*px;c.beginPath();c.moveTo(x,H*.08);c.lineTo(x,H*.08+5*px);c.stroke();}
  c.fillStyle='#e0c43a';for(let x=W*.3;x<W*.7;x+=1.4*px)c.fillRect(x,H-3.2*px,.7*px,1.6*px);// faixa de pedestre amarela diante da entrada
  c.fillStyle='rgba(20,20,22,.35)';for(let i=0;i<14;i++){c.beginPath();c.ellipse(rand()*W,rand()*H,20+rand()*60,8+rand()*20,rand()*3,0,6.3);c.fill();}},[1,1]);}
function tileRoofTextures(){const col=canvasTex(256,256,(c,w,h)=>{for(let r=0;r<8;r++)for(let k=0;k<8;k++){const x=k*32+(r%2)*16,y=r*32;const base=[176,86,52].map(v=>v*R(.82,1.12));const g=c.createLinearGradient(x,0,x+32,0);g.addColorStop(0,`rgb(${base.map(v=>v*.6|0)})`);g.addColorStop(.5,`rgb(${base.map(v=>Math.min(255,v*1.15)|0)})`);g.addColorStop(1,`rgb(${base.map(v=>v*.55|0)})`);c.fillStyle=g;c.fillRect(x,y,32,32);c.fillRect(x-256,y,32,32);c.fillStyle='rgba(0,0,0,.35)';c.fillRect(x,y+28,32,4);c.fillRect(x-256,y+28,32,4);}},[1,1]);
  const bump=canvasTex(256,256,(c,w,h)=>{for(let r=0;r<8;r++)for(let k=0;k<9;k++){const x=k*32+(r%2)*16-16,y=r*32;const g=c.createLinearGradient(x,0,x+32,0);g.addColorStop(0,'#111');g.addColorStop(.5,'#fff');g.addColorStop(1,'#111');c.fillStyle=g;c.fillRect(x,y,32,30);}},[1,1],false);return {col,bump};}
function texturedBox(mat,size,pos,repeatScale=1,rot=[0,0,0]){const g=new THREE.BoxGeometry(...size);const uv=g.attributes.uv,p=g.attributes.position,n=g.attributes.normal;for(let i=0;i<uv.count;i++){const ax=Math.abs(n.getX(i)),ay=Math.abs(n.getY(i));const a=ay>.5?[p.getX(i),p.getZ(i)]:ax>.5?[p.getZ(i),p.getY(i)]:[p.getX(i),p.getY(i)];uv.setXY(i,a[0]/repeatScale,a[1]/repeatScale);}const m=new THREE.Mesh(g,mat);m.position.set(...pos);m.rotation.set(...rot);m.castShadow=false;m.receiveShadow=true;return m;}

// ---------- Terreno ----------
function terrainMesh(){
  const N=170,S=ISLAND.size,step=S/N,pos=[],col=[],c=new THREE.Color(),H=[];
  for(let j=0;j<=N;j++){H.push([]);for(let i=0;i<=N;i++){const u=-S/2+i*step,v=-S/2+j*step;H[j].push(terrainLocal(u,v));}}
  const sand=new THREE.Color(0xe6d3a1),wet=new THREE.Color(0xb99f70),grassA=new THREE.Color(0x6b9a3c),grassB=new THREE.Color(0x4f7f2e),grassC=new THREE.Color(0x8aa94a),dirt=new THREE.Color(0x9b7a4f),rock=new THREE.Color(0x8b857b),seabed=new THREE.Color(0xc9b98f),paved=new THREE.Color(0x6d6a63);
  const paved2=(u,v)=>(Math.abs(u)<5.6&&v>-46&&v<4)||(u>-33&&u<33&&v>-51.5&&v<-45.5)||(u>-24&&u<24&&v>-11&&v<4)||(u>SHOP.u0-3&&u<SHOP.u1+3&&v>SHOP.v0-1&&v<SHOP.v1+3)||(u>LANE.u0&&u<LANE.u1&&v>LANE.v0&&v<LANE.v1);
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){
    const quad=[[i,j],[i+1,j],[i+1,j+1],[i,j+1]].map(([a,b])=>V(-S/2+a*step,H[b][a],-S/2+b*step));
    for(const tri of [[0,2,1],[0,3,2]]){const [A,B,C]=tri.map(k=>quad[k]);if(A.y<-2.2&&B.y<-2.2&&C.y<-2.2)continue;
      const cu=(A.x+B.x+C.x)/3,cv=(A.z+B.z+C.z)/3,ch=(A.y+B.y+C.y)/3;if(paved2(cu,cv))continue;
      const n=B.clone().sub(A).cross(C.clone().sub(A)).normalize(),slope=1-Math.abs(n.y),r=Math.hypot(cu,cv)/shoreRadius(Math.atan2(cv,cu));
      const noise=fbm2(cu*.11,cv*.11),speck=rand();
      if(ch<-.05)c.copy(seabed).lerp(wet,.5).multiplyScalar(.9+speck*.1);
      else if(r>.8||ch<.9){c.copy(ch<.3?wet:sand).lerp(sand,ch<.3?Math.min(1,ch/.3)*.6:0).multiplyScalar(.93+speck*.09);if(r<.84&&r>.8)c.lerp(grassC,(.84-r)/.04*.6);}
      else{c.copy(grassA).lerp(grassB,noise).lerp(grassC,Math.max(0,speck-.6)*1.2);if(fbm2(cu*.5,cv*.5)>.7)c.lerp(new THREE.Color(0x9fae52),.35);}
      if(slope>.42&&ch>.4)c.lerp(rock,Math.min(1,(slope-.42)*3)).multiplyScalar(.9+speck*.12);
      const path=pathMask(cu,cv);if(path>.2)c.lerp(dirt,path);
      if(flatMask(cu,cv)>.5&&ch>1.2&&!paved2(cu,cv))c.lerp(grassB,.2);
      pos.push(A.x,A.y,A.z,B.x,B.y,B.z,C.x,C.y,C.z);for(let k=0;k<3;k++)col.push(c.r,c.g,c.b);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.computeVertexNormals();
  const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.95}));m.receiveShadow=true;m.castShadow=true;m.name='terreno';return m;
}
// Altura da ilha numa textura (mar raso turquesa e ondas quebrando na praia, no shader do oceano)
export function heightTexture(){const N=256,S=ISLAND.size,data=new Uint8Array(N*N);for(let j=0;j<N;j++)for(let i=0;i<N;i++){const h=terrainLocal(-S/2+(i+.5)/N*S,-S/2+(j+.5)/N*S);data[j*N+i]=Math.max(0,Math.min(255,Math.round((h+12)/24*255)));}
  const t=new THREE.DataTexture(data,N,N,THREE.RedFormat,THREE.UnsignedByteType);t.magFilter=t.minFilter=THREE.LinearFilter;t.needsUpdate=true;return t;}

// ---------- Vegetação ----------
function palm(kit,mat,x,z,y,h,lean,dir,seed){reseed(seed);
  const base=V(x,y-.2,z),top=V(x+Math.cos(dir)*lean,y+h,z+Math.sin(dir)*lean),ctrl=V(x,y+h*.55,z);
  const pts=[];for(let i=0;i<=9;i++){const t=i/9;pts.push(V().addScaledVector(base,(1-t)*(1-t)).addScaledVector(ctrl,2*t*(1-t)).addScaledVector(top,t*t));}
  for(let i=0;i<9;i++){const r0=.2-i*.011,r1=.2-(i+1)*.011;kit.add(mat,sway(limb(pts[i],pts[i+1],r0*1.08,r1,7),v=>Math.pow(Math.max(0,v.y-y)/h,1.6)*.8),i%2?0x8a6c4c:0x7a5d40,.05);
    kit.add(mat,sway(limb(pts[i+1].clone().lerp(pts[i],.12),pts[i+1],r1*1.15,r1*1.12,7),v=>Math.pow(Math.max(0,v.y-y)/h,1.6)*.8),0x5f4830,.04);}
  for(let k=0;k<5;k++){const a=k*1.3;kit.add(mat,sway(ellipsoid([top.x+Math.cos(a)*.16,top.y-.28,top.z+Math.sin(a)*.16],[.11,.12,.11],6,5),()=>.8),0x6b4f22,.1);}
  const fronds=11;for(let f=0;f<fronds;f++){const a=f/fronds*Math.PI*2+rand()*.4,up=f%3===0?.35:-.05-rand()*.3,len=2.6+rand()*1.2;const pos=[];
    const spine=[];for(let s=0;s<=8;s++){const t=s/8;spine.push(top.clone().add(V(Math.cos(a)*len*t,up*len*t-1.6*t*t*(1-up),Math.sin(a)*len*t)));}
    const side=V(-Math.sin(a),0,Math.cos(a));
    for(let s=0;s<8;s++){const p0=spine[s],p1=spine[s+1],w=.55*Math.sin((s+.5)/8*Math.PI)+.05;for(const sd of [-1,1]){const tip=p0.clone().lerp(p1,.5).addScaledVector(side,sd*w).add(V(0,-.25*w,0));pos.push(p0,p1,tip);}}
    const g=new THREE.BufferGeometry().setFromPoints(pos);g.computeVertexNormals();
    kit.add(mat,sway(g,v=>.85+Math.min(.9,top.distanceTo(v)*.25)),rand()<.25?0x7f9a3a:0x4f8a32,.12);
    kit.add(mat,sway(sweep(spine,.03,.02),v=>.85+Math.min(.9,top.distanceTo(v)*.25)),0x6f7f36,.05);}
}
function broadTree(kit,mat,x,z,y,h,colors,seed,flowers=false){reseed(seed);
  const trunk=[V(x,y-.2,z),V(x+R(-.3,.3),y+h*.45,z+R(-.3,.3)),V(x+R(-.4,.4),y+h*.7,z+R(-.4,.4))];
  kit.add(mat,sway(limb(trunk[0],trunk[1],.24,.17,7),v=>Math.max(0,v.y-y)/h*.2),0x5a4432,.08).add(mat,sway(limb(trunk[1],trunk[2],.17,.1,6),v=>Math.max(0,v.y-y)/h*.3),0x5a4432,.08);
  for(let b=0;b<4;b++){const a=b*1.7+rand(),end=trunk[1].clone().add(V(Math.cos(a)*h*.28,h*.25,Math.sin(a)*h*.28));kit.add(mat,sway(limb(trunk[1],end,.1,.05,5),v=>Math.max(0,v.y-y)/h*.35),0x5a4432,.08);}
  const n=5+Math.floor(rand()*3);for(let c=0;c<n;c++){const a=rand()*6.28,r=rand()*h*.3,cy=y+h*(.62+rand()*.3),s=h*(.2+rand()*.13);
    const g=sculpt(new THREE.IcosahedronGeometry(1,1),v=>{v.multiplyScalar(1+(rand()-.5)*.28);});g.scale(s*1.15,s*.85,s*1.15);g.translate(x+Math.cos(a)*r,cy,z+Math.sin(a)*r);
    kit.add(mat,sway(g,v=>.35+Math.max(0,v.y-y-h*.5)/h),colors[c%colors.length],.1);}
  if(flowers)for(let k=0;k<26;k++){const a=rand()*6.28,r=rand()*h*.45;const g=ellipsoid([x+Math.cos(a)*r,y+h*(.55+rand()*.4),z+Math.sin(a)*r],[.18,.12,.18],5,3);kit.add(mat,sway(g,()=>.8),0xf6d04a,.1);}
}
function araucaria(kit,mat,x,z,y,h,seed){reseed(seed);
  kit.add(mat,sway(limb(V(x,y-.3,z),V(x,y+h,z),.32,.12,7),v=>Math.max(0,v.y-y)/h*.25),0x6a5344,.06);
  for(let t=0;t<3;t++){const ty=y+h*(.78+t*.08),rr=h*(.32-t*.07);for(let b=0;b<7;b++){const a=b/7*6.28+t*.4,mid=V(x+Math.cos(a)*rr*.6,ty+rr*.12,z+Math.sin(a)*rr*.6),end=V(x+Math.cos(a)*rr,ty+rr*.42,z+Math.sin(a)*rr);
    kit.add(mat,sway(limb(V(x,ty-.2,z),mid,.07,.05,5),()=>.3),0x5d4838,.06);kit.add(mat,sway(sculpt(ellipsoid([end.x,end.y,end.z],[rr*.34,rr*.2,rr*.34],7,4),v=>{v.y+=(rand()-.5)*.08;}),()=>.5),t===2?0x2f5a2a:0x284f26,.1);}}
}
function bush(kit,mat,x,z,y,s,color,flower,seed){reseed(seed);for(let k=0;k<4;k++){const g=new THREE.IcosahedronGeometry(s*R(.45,.7),0);g.translate(x+R(-s,s)*.5,y+s*R(.25,.55),z+R(-s,s)*.5);kit.add(mat,sway(g,()=>.25),color,.12);}
  if(flower)for(let k=0;k<9;k++)kit.add(mat,sway(ellipsoid([x+R(-s,s)*.6,y+s*R(.5,.95),z+R(-s,s)*.6],[.07,.05,.07],5,3),()=>.3),flower,.08);}
function rock(kit,mat,x,z,y,s,seed,color=0x8c867c){reseed(seed);const g=sculpt(new THREE.DodecahedronGeometry(1,1),v=>{const n=fbm2(v.x*1.3+seed,v.z*1.3+v.y)-.5;v.multiplyScalar(1+n*.5);v.y*=.62;});g.scale(s,s,s);g.rotateY(rand()*6);g.translate(x,y+s*.15,z);
  kit.add(mat,paint(g,(v,c)=>new THREE.Color(color).lerp(new THREE.Color(0x3f5a3a),c.y>y+s*.45?.3:0).multiplyScalar(c.y<.25?.55:1),.08));}
function grassField(count){
  // Tufo com 3 lâminas: raiz escura, ponta clara; o vento curva mais a ponta
  const blade=new THREE.BufferGeometry(),pos=[],col=[],base=new THREE.Color(0x2f5a1f),tip=new THREE.Color(0x9cc05a);
  for(let b=0;b<3;b++){const a=b/3*Math.PI*2+.3,h=.3+b*.07,w=.05,ox=Math.cos(a)*.05,oz=Math.sin(a)*.05,lx=Math.cos(a+1.57)*w,lz=Math.sin(a+1.57)*w;
    pos.push(ox-lx,0,oz-lz, ox+lx,0,oz+lz, ox*2.6,h,oz*2.6);col.push(base.r,base.g,base.b,base.r,base.g,base.b,tip.r,tip.g,tip.b);}
  blade.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));blade.setAttribute('color',new THREE.Float32BufferAttribute(col,3));blade.computeVertexNormals();
  const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.9,side:THREE.DoubleSide});
  mat.onBeforeCompile=s=>{s.uniforms.uTime=U.uTime;s.uniforms.uStorm=U.uStorm;s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nuniform float uTime,uStorm;').replace('#include <begin_vertex>',`#include <begin_vertex>
    vec4 gw=modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.);float bend=position.y*position.y*6.;float ph=dot(gw.xz,vec2(.21,.17));
    transformed.x+=(sin(uTime*1.9+ph)*.5+sin(uTime*4.3+ph*2.1)*.2+uStorm*.6)*bend*(.35+uStorm*.8);transformed.z+=sin(uTime*1.5+ph*1.4)*bend*.2;`);
    // normal para cima: grama iluminada como o chão (sem faces escuras de costas para o sol)
    s.vertexShader=s.vertexShader.replace('#include <beginnormal_vertex>','vec3 objectNormal=vec3(0.,1.,0.);');};
  const mesh=new THREE.InstancedMesh(blade,mat,count),m=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler(),s=V(),p=V(),color=new THREE.Color();let n=0,tries=0;
  while(n<count&&tries<count*8){tries++;const a=rand()*6.283,r=Math.sqrt(rand())*62,u=Math.cos(a)*r,v=Math.sin(a)*r,h=terrainLocal(u,v);
    if(h<1.05||flatMask(u,v)>.2||pathMask(u,v)>.3)continue;if(Math.hypot(u,v)/shoreRadius(Math.atan2(v,u))>.8)continue;
    p.set(u,h-.02,v);e.set((rand()-.5)*.3,rand()*6.28,(rand()-.5)*.3);q.setFromEuler(e);const k=.7+rand()*.8;s.set(k,k*(.8+rand()*.6),k);m.compose(p,q,s);mesh.setMatrixAt(n,m);color.setHSL(.24+rand()*.06,.45+rand()*.2,.75+rand()*.3);mesh.setColorAt(n,color);n++;}
  mesh.count=n;mesh.receiveShadow=true;mesh.castShadow=false;mesh.frustumCulled=false;mesh.name='grama';return mesh;
}

// ---------- Construções ----------
const glassMat=()=>new THREE.MeshStandardMaterial({color:0x1d2c36,metalness:.9,roughness:.08,envMapIntensity:1.4});
const litMat=()=>new THREE.MeshStandardMaterial({color:0xffe2ad,emissive:0xffb766,emissiveIntensity:1.6,roughness:.5});
const doorOffset=h=>h.w>7.2?0:-h.w*.18;
function house(h,mats){
  const kit=new Kit(),{wall,glass,lit,metal}=mats,d=h.d,w=h.w,H=h.floors===2?5.6:3.2,y0=0,g=new THREE.Group();reseed(Math.abs(h.u*7+h.v));
  const front=d/2;// fachada em +x (o grupo é girado para a rua)
  kit.add(wall,box([0,.2,0],[d+.16,.4,w+.16]),0x9c9486,.04);// embasamento de pedra
  kit.add(wall,box([0,.4+H/2,0],[d,H,w]),h.color,.025);
  for(const sx of [-1,1])for(const sz of [-1,1])kit.add(wall,box([sx*(d/2-.08),.4+H/2,sz*(w/2-.08)],[.26,H+.02,.26]),h.trim,.02);// cunhais
  kit.add(wall,box([0,.4+H+.1,0],[d+.3,.2,w+.3]),h.trim,.02);kit.add(wall,box([0,.4+H+.24,0],[d+.42,.08,w+.42]),h.trim,.02);// cimalha
  if(h.floors===2)kit.add(wall,box([0,.4+2.8,0],[d+.08,.14,w+.08]),h.trim,.02);
  // janelas com moldura, peitoril, vidro e venezianas abertas
  const win=(x,y,z,rotY,lit_)=>{const G=new THREE.Group();const k2=new Kit();k2.add(wall,box([0,0,0],[.1,1.3,1.02]),h.trim,.02).add(wall,box([.06,-.72,0],[.2,.1,1.2]),h.trim,.02);
    k2.add(wall,box([.06,0,0],[.04,1.14,.06]),h.trim,.02).add(wall,box([.06,.18,0],[.04,.05,.9]),h.trim,.02);
    for(const s of [-1,1]){k2.add(wall,box([.09,0,s*.82],[.05,1.24,.52],[0,s*-.35,0]),h.door,.05);for(let l=0;l<8;l++)k2.add(wall,box([.125,-.5+l*.14,s*.82],[.02,.035,.46],[0,s*-.35,0]),new THREE.Color(h.door).multiplyScalar(.75),.03);}
    // flores na janela de baixo
    if(y<2&&rand()<.7){k2.add(wall,box([.22,-.66,0],[.22,.16,.9]),0x9a5236,.05);for(let f=0;f<7;f++)k2.add(wall,ellipsoid([.24,-.52,-.38+f*.13],[.08,.07,.08],5,3),[0xe0405a,0xf2a0c0,0xffffff,0xf0c030][f%4],.1);}
    const kb=k2.build();G.add(kb);const pane=new THREE.Mesh(new THREE.PlaneGeometry(.9,1.12),lit_?lit:glass);pane.rotation.y=Math.PI/2;pane.position.x=.058;G.add(pane);G.position.set(x,y,z);G.rotation.y=rotY;g.add(G);};
  const levels=h.floors===2?[1.75,4.3]:[1.9];
  for(const y of levels){const n=w>7.2?3:2;for(let i=0;i<n;i++){const z=(i-(n-1)/2)*(w/n)*1.05;if(y<2.5&&Math.abs(z)<.9&&n===3)continue;win(front+.02,y,z,0,rand()<.35);}
    for(const s of [-1,1])win(0,y,s*(w/2+.02),s*-Math.PI/2,rand()<.2);}
  // porta de madeira almofadada com bandeira, degraus e arandela
  const dz=doorOffset(h);kit.add(wall,box([front+.06,.4+1.18,dz],[.12,2.46,1.3]),h.trim,.02).add(wall,box([front+.1,.4+1.1,dz],[.06,2.2,1.06]),h.door,.04);
  for(const s of [-1,1])for(const yy of [.75,1.55])kit.add(wall,box([front+.14,.4+yy,dz+s*.26],[.03,.58,.36]),new THREE.Color(h.door).multiplyScalar(.82),.03);
  kit.add(metal,ellipsoid([front+.16,.4+1.1,dz+.4],[.03,.03,.03],6,4),0xd9b45a,.02);
  kit.add(wall,box([front+.45,.3,dz],[.6,.2,1.6]),0xa39b8c,.03).add(wall,box([front+.8,.12,dz],[.5,.24,1.7]),0xa39b8c,.03);
  kit.add(metal,box([front+.12,.4+2.35,dz+.95],[.12,.12,.12]),0x1d1f22,.02);const lamp=new THREE.Mesh(new THREE.BoxGeometry(.13,.2,.13),lit);lamp.position.set(front+.2,.4+2.15,dz+.95);g.add(lamp);
  // telhado de duas águas com telhas coloniais, beiral, testeira e cumeeira
  const over=.45,ph=h.floors===2?1.7:1.5,halfSpan=d/2+over,slope=Math.atan2(ph,d/2),len=Math.hypot(halfSpan,ph*halfSpan/(d/2));
  for(const s of [-1,1]){const roof=texturedBox(mats.roof,[len,.1,w+2*over],[s*halfSpan/2,.4+H+.3+ph/2-(over*ph/(d/2))/2,0],1.1,[0,0,s*-slope]);roof.castShadow=true;g.add(roof);
    kit.add(wall,box([s*(halfSpan-.02),.4+H+.3-over*ph/(d/2)+.02,0],[.06,.22,w+2*over+.02],[0,0,s*-slope]),h.trim,.02);}
  // empenas triangulares nas laterais (as duas faces, para não sumir de nenhum ângulo)
  for(const s of [-1,1])for(const flip of [0,1]){const a=V(-d/2,0,0),b=V(d/2,0,0),c=V(0,ph,0);const tri=new THREE.BufferGeometry().setFromPoints(flip?[a,c,b]:[a,b,c]);tri.translate(0,.4+H+.28,s*(w/2-.01));tri.computeVertexNormals();kit.add(wall,tri,h.color,.02);}
  kit.add(wall,limb(V(0,.4+H+.3+ph+.02,-w/2-over),V(0,.4+H+.3+ph+.02,w/2+over),.1,.1,6).rotateZ(0),0x9a4a2a,.05);
  if(rand()<.6){const cx=-d*.2,cz=w*.28;kit.add(wall,box([cx,.4+H+ph*.9,cz],[.6,1.6,.6]),h.color,.03).add(wall,box([cx,.4+H+ph*.9+.85,cz],[.75,.12,.75]),h.trim,.02);}
  // quintal: cerca de madeira branca, portão, vasos de barro e caixa de correio
  const fk=new Kit();for(const s of [-1,1]){for(let i=0;i<9;i++){const z=s*(w/2-i*.42);if(Math.abs(z-dz)<.9)continue;fk.add(wall,box([front+1.55,.45,z],[.06,.9,.1]),0xf4f1e8,.03).add(wall,sculpt(new THREE.ConeGeometry(.06,.14,4).translate(0,.97,0),()=>{}).translate(front+1.55,0,z),0xf4f1e8,.03);}}
  fk.add(wall,box([front+1.55,.28,0],[.04,.07,w+.1]),0xf4f1e8,.03).add(wall,box([front+1.55,.7,0],[.04,.07,w+.1]),0xf4f1e8,.03);
  for(const s of [-1,1]){fk.add(wall,loft([{y:0,rx:.2,rz:.2},{y:.35,rx:.26,rz:.26},{y:.4,rx:.28,rz:.28}],{n:8}).translate(front+1.1,0,dz+s*1.2),0xa9583a,.05);bush(fk,wall,front+1.1,dz+s*1.2,.35,.42,0x3f7a34,s>0?0xe23a5a:0xf3e25a,Math.abs(h.u+s));}
  fk.add(metal,box([front+1.6,1.05,dz+1.05],[.3,.22,.2]),0xc23a2a,.03).add(metal,limb(V(front+1.6,0,dz+1.05),V(front+1.6,.95,dz+1.05),.025,.025,5),0x2a2a2a);
  g.add(kit.build(),fk.build());
  // buganvília: cachos rosa subindo pela quina e caindo do beiral
  if(h.bougainvillea){const bk=new Kit();for(let i=0;i<40;i++){const y=.6+rand()*(H+.6),z=w/2-.2-rand()*1.6*(y/(H+.6));bk.add(wall,sway(new THREE.IcosahedronGeometry(.16+rand()*.14,0).translate(front+.12+rand()*.15,.4+y,z),()=>.3),[0xe0307a,0xf04a9a,0xc8206a][i%3],.1);}
    for(let i=0;i<14;i++)bk.add(wall,sway(new THREE.IcosahedronGeometry(.14,0).translate(front+.2,.4+H-rand()*.5,w/2-.3-i*.3),()=>.4),0x3f7a2e,.1);g.add(bk.build());}
  g.position.set(h.u,P,h.v);g.rotation.y=h.rot??(h.face>0?0:Math.PI);
  return g;
}
// Igrejinha açoriana: fachada branca com cunhais e frontão, porta em arco, torre sineira com cruz
function church(mats){const k=new Kit(),m=mats.wall,{d,w}=CHURCH,H=6.2,T=0xf7f5ee,B=0x2f6fa8,Y=0xe8c34a,g=new THREE.Group();
  k.add(m,box([0,.25,0],[d+.2,.5,w+.2]),0xa39b8c,.03).add(m,box([0,.5+H/2,0],[d,H,w]),T,.02);
  for(const sx of [-1,1])for(const sz of [-1,1])k.add(m,box([sx*(d/2-.12),.5+H/2,sz*(w/2-.12)],[.3,H+.04,.3]),Y,.02);
  k.add(m,box([0,.5+H+.12,0],[d+.3,.24,w+.3]),Y,.02);
  for(const flip of [0,1]){const a=V(d/2+.02,.5+H+.24,-w/2-.15),b=V(d/2+.02,.5+H+.24,w/2+.15),c=V(d/2+.02,.5+H+2.6,0);const t=new THREE.BufferGeometry().setFromPoints(flip?[a,b,c]:[a,c,b]);t.computeVertexNormals();k.add(m,t,T,.02);}
  k.add(m,box([d/2+.05,.5+H+2.62,0],[.2,.25,.25]),Y);k.add(m,box([d/2+.08,.5+H+3.1,0],[.08,.8,.08]),0x2a2a2a).add(m,box([d/2+.08,.5+H+3.2,0],[.08,.08,.5]),0x2a2a2a);
  const circle=new THREE.Mesh(new THREE.CircleGeometry(.55,20),mats.lit);circle.position.set(d/2+.035,.5+H+1.2,0);circle.rotation.y=Math.PI/2;g.add(circle);k.add(m,new THREE.TorusGeometry(.6,.08,5,20).rotateY(Math.PI/2).translate(d/2+.04,.5+H+1.2,0),Y,.02);
  k.add(m,box([d/2+.05,.5+1.5,0],[.1,3,1.9]),B,.02).add(m,box([d/2+.09,.5+1.4,0],[.06,2.8,1.5]),0x6a3a22,.05);k.add(m,sculpt(new THREE.CylinderGeometry(.95,.95,.1,16,1,false,0,Math.PI).rotateZ(Math.PI/2).rotateX(Math.PI/2),()=>{}).translate(d/2+.05,.5+3,0),B,.02);
  for(const z of [-2.6,2.6]){k.add(m,box([d/2+.05,.5+3.6,z],[.1,1.6,1]),B,.02);const gl=new THREE.Mesh(new THREE.PlaneGeometry(.8,1.4),mats.lit);gl.position.set(d/2+.105,.5+3.6,z);gl.rotation.y=Math.PI/2;g.add(gl);}
  for(const s of [-1,1])for(const x of [-4,0,4]){k.add(m,box([x,.5+3.2,s*(w/2+.05)],[1,2,.1]),B,.02);const gl=new THREE.Mesh(new THREE.PlaneGeometry(.8,1.8),mats.glass);gl.position.set(x,.5+3.2,s*(w/2+.105));gl.rotation.y=s>0?0:Math.PI;g.add(gl);}
  const over=.4,ph=2.3,halfSpan=w/2+over,slope=Math.atan2(ph,w/2),len=Math.hypot(halfSpan,ph*halfSpan/(w/2));
  for(const s of [-1,1]){const roof=texturedBox(mats.roof,[d+.6,.1,len],[-.1,.5+H+.3+ph/2-(over*ph/(w/2))/2,s*halfSpan/2],1.1,[s*slope,0,0]);roof.castShadow=true;g.add(roof);}
  for(const flip of [0,1]){const a=V(-d/2-.01,.5+H+.25,-w/2),b=V(-d/2-.01,.5+H+.25,w/2),c=V(-d/2-.01,.5+H+.25+ph,0);const t=new THREE.BufferGeometry().setFromPoints(flip?[a,b,c]:[a,c,b]);t.computeVertexNormals();k.add(m,t,T,.02);}
  const tz=w/2+1.4;k.add(m,box([d/2-1.4,5.5,tz],[2.6,11,2.6]),T,.02);for(const sx of [-1,1])for(const sz of [-1,1])k.add(m,box([d/2-1.4+sx*1.2,5.5,tz+sz*1.2],[.3,11.02,.3]),Y,.02);
  k.add(m,box([d/2-1.4,8.9,tz],[2.8,.2,2.8]),Y,.02).add(m,box([d/2-1.4,11.05,tz],[2.9,.2,2.9]),Y,.02);
  for(const [dx,dz,ry]of [[1.31,0,0],[-1.31,0,0],[0,1.31,1],[0,-1.31,1]]){k.add(m,box([d/2-1.4+dx,10,tz+dz],ry?[.9,1.6,.08]:[.08,1.6,.9]),0x1d2a36,.02);}
  k.add(m,loft([{y:9.3,rx:.28,rz:.28},{y:9.8,rx:.2,rz:.2},{y:9.95,rx:.08,rz:.08}],{n:10}).translate(d/2-1.4,0,tz),0xc9982a,.05);
  k.add(m,sculpt(new THREE.ConeGeometry(1.9,2.2,4).rotateY(Math.PI/4),()=>{}).translate(d/2-1.4,12.25,tz),0xb4552f,.05);k.add(m,box([d/2-1.4,13.8,tz],[.1,1.1,.1]),0x2a2a2a).add(m,box([d/2-1.4,14,tz],[.1,.1,.6]),0x2a2a2a);
  for(let i=0;i<3;i++)k.add(m,box([d/2+.5+i*.4,.45-i*.15,0],[.5,.3,4-i*.2]),0xd9d0bc,.03);
  g.add(k.build());g.position.set(CHURCH.u,P,CHURCH.v);return g;}
// Rancho de pesca: galpão de madeira aberto com telhado de telha, rede pendurada, remos e canoa
function rancho(mats,x,z,rot){const k=new Kit(),m=mats.wall,g=new THREE.Group(),y=terrainLocal(x,z);
  for(const sx of [-1,1])for(const sz of [-1,1])k.add(m,limb(V(sx*2.2,-.4,sz*1.8),V(sx*2.2,2.6,sz*1.8),.1,.09,6),0x6b5038,.05);
  k.add(m,box([0,2.6,0],[4.8,.14,.16]),0x6b5038).add(m,box([0,3.4,0],[.12,.12,4.4]),0x6b5038);
  for(const s of [-1,1]){const r=texturedBox(mats.roof,[5.2,.08,2.6],[0,3.05,s*1.1],1.1,[s*.55,0,0]);r.castShadow=true;g.add(r);}
  for(let i=0;i<6;i++)k.add(m,box([-2.25,1.2,-1.5+i*.6],[.05,2.4,.5]),[0x8d6b47,0x7a5a3a][i%2],.08);
  k.add(m,sculpt(new THREE.PlaneGeometry(2.4,1.6,8,6).rotateY(Math.PI/2),v=>{v.x+=Math.sin(v.y*3+v.z*2)*.08;}).translate(-2.1,1.4,0),0x3e6a73,.2);
  for(const s of [-1,1])k.add(m,limb(V(1.8,.1,s*.6),V(2.1,2.1,s*.8),.03,.03,5),0x9a7650).add(m,box([2.1,2.1,s*.8],[.05,.4,.15],[0,0,.2]),0x9a7650);
  const canoe=loft([{z:-2,cy:.28,rx:.04,rz:.04},{z:-1.4,cy:.16,rx:.38,rz:.18},{z:0,cy:.12,rx:.5,rz:.22},{z:1.4,cy:.16,rx:.38,rz:.18},{z:2,cy:.28,rx:.04,rz:.04}],{axis:'z',n:10,capStart:false,capEnd:false});const cp=canoe.attributes.position;for(let i=0;i<cp.count;i++)if(cp.getY(i)>.2)cp.setY(i,.32);canoe.computeVertexNormals();
  k.add(new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.8,side:THREE.DoubleSide}),paint(canoe.rotateY(Math.PI/2).translate(0,.05,0),v=>v.y>.28?0xf2efe6:0xd62028,.05));
  g.add(k.build());g.position.set(x,y,z);g.rotation.y=rot;return g;}
function kiosk(mats,u,v){const k=new Kit(),m=mats.wall,g=new THREE.Group();k.add(m,box([0,.55,0],[2.2,1.1,1.4]),0x2f7fae,.03).add(m,box([0,1.12,0],[2.4,.08,1.6]),0xf4f1e8,.02);
  for(const sx of [-1,1])for(const sz of [-1,1])k.add(m,limb(V(sx*1.05,1.1,sz*.65),V(sx*1.05,2.5,sz*.65),.04,.04,5),0xf4f1e8);
  k.add(m,sculpt(new THREE.ConeGeometry(2,.8,8),()=>{}).translate(0,2.85,0),0xf2c12e,.05);
  for(let i=0;i<5;i++)k.add(m,ellipsoid([-.8+i*.4,1.26,-.3],[.14,.16,.14],7,5),0x5a8a2a,.1);k.add(m,box([.7,1.4,.3],[.4,.5,.04]),0xffffff);
  for(let i=0;i<3;i++){k.add(m,loft([{y:0,rx:.2,rz:.2},{y:.02,rx:.2,rz:.2}],{n:10}).translate(-2+i*.9,.72,1.8),0xf4f1e8);k.add(m,limb(V(-2+i*.9,0,1.8),V(-2+i*.9,.72,1.8),.03,.03,5),0xf4f1e8);}
  g.add(k.build());g.position.set(u,P,v);return g;}
// Orelhão: a concha laranja de telefone público
function orelhao(mats,u,v){const k=new Kit(),m=mats.wall,g=new THREE.Group();k.add(m,limb(V(0,0,0),V(0,1.6,0),.05,.05,6),0x3a3c40);
  const shell=new THREE.SphereGeometry(.55,14,10,0,Math.PI*2,0,Math.PI*.62);shell.scale(1,1.15,1);shell.translate(0,1.55,0);k.add(new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.5,side:THREE.DoubleSide}),shell,0xf07a22,.04);
  k.add(m,box([0,1.45,-.3],[.25,.4,.12]),0xc0c4c8,.03).add(m,box([0,1.62,-.22],[.08,.2,.06]),0x222222);g.add(k.build());g.position.set(u,P+.12,v);g.rotation.y=Math.PI/2;return g;}
function lampPost(kit,lit,x,z,y,group){kit.add(lit.post,limb(V(x,y,z),V(x,y+3.4,z),.07,.05,8),0x1b1c1f,.02).add(lit.post,loft([{y:y,rx:.16,rz:.16},{y:y+.35,rx:.11,rz:.11},{y:y+.5,rx:.08,rz:.08}],{n:8}).translate(x,0,z),0x1b1c1f,.02);
  kit.add(lit.post,box([x,y+3.45,z],[.34,.06,.34]),0x1b1c1f).add(lit.post,sculpt(new THREE.ConeGeometry(.3,.28,4).rotateY(Math.PI/4).translate(0,y+3.98,0),()=>{}).translate(x,0,z),0x1b1c1f);
  const glass=new THREE.Mesh(new THREE.CylinderGeometry(.13,.1,.4,4,1).rotateY(Math.PI/4),lit.glow);glass.position.set(x,y+3.66,z);group.add(glass);}
function bench(kit,mat,x,z,y,rot){const g=new Kit();g.add(mat,box([0,.45,0],[1.6,.06,.45]),0x8a5a34,.05).add(mat,box([0,.8,-.2],[1.6,.3,.05],[.15,0,0]),0x8a5a34,.05);for(const s of [-1,1])g.add(mat,box([s*.7,.3,0],[.08,.6,.45]),0x2a2b2e,.02);const b=g.build();b.position.set(x,y,z);b.rotation.y=rot;return b;}

export class Island {
  constructor(scene,quality='high'){
    this.group=new THREE.Group();this.group.position.set(ISLAND.x,0,ISLAND.z);scene.add(this.group);this.scene=scene;this.colliders=[];this.parts=[];this.solids=[];
    const hi=quality!=='low',add=(o,flyable=true)=>{this.group.add(o);if(flyable)this.parts.push(o);return o;};
    this.terrain=add(terrainMesh(),false);this.heightTex=heightTexture();
    const mats={wall:new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.88}),glass:glassMat(),lit:litMat(),metal:new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.4,metalness:.7})};
    const roofT=tileRoofTextures();mats.roof=new THREE.MeshStandardMaterial({map:roofT.col,bumpMap:roofT.bump,bumpScale:2.5,roughness:.8});
    this.mats=mats;
    // ----- pisos: rua, calçadas com meio-fio, calçadão da orla e estacionamento -----
    const cob=cobbleTextures(),cobMat=new THREE.MeshStandardMaterial({map:cob.col,bumpMap:cob.bump,bumpScale:3,roughness:.85});cob.col.repeat.set(1/3.2,1/3.2);cob.bump.repeat.copy(cob.col.repeat);
    add(texturedBox(cobMat,[7.1,.5,34.4],[0,P-.25+.02,-28.2],1),false);
    add(texturedBox(cobMat,[LANE.u1-LANE.u0,.5,LANE.v1-LANE.v0],[LANE.u,P-.25+.015,(LANE.v0+LANE.v1)/2],1),false);
    const mos=mosaicTextures(),mosMat=new THREE.MeshStandardMaterial({map:mos.col,bumpMap:mos.bump,bumpScale:1.2,roughness:.7});mos.col.repeat.set(1/2.6,1/2.6);mos.bump.repeat.copy(mos.col.repeat);
    add(texturedBox(mosMat,[66,.6,6.2],[0,P-.3+.03,-48.5],1),false);
    const con=concreteTextures(),conMat=new THREE.MeshStandardMaterial({map:con.col,bumpMap:con.bump,bumpScale:1.5,roughness:.9});con.col.repeat.set(1/2,1/2);con.bump.repeat.copy(con.col.repeat);
    for(const s of [-1,1]){add(texturedBox(conMat,[2,.6,34.6],[s*4.5,P+.12-.3,-28.2],1),false);add(texturedBox(conMat,[.16,.62,34.6],[s*3.55,P+.13-.3,-28.2],1),false);}
    const asphalt=new THREE.MeshStandardMaterial({map:asphaltTexture(48,15),roughness:.95});const plaza=new THREE.Mesh(new THREE.BoxGeometry(48,.5,15),asphalt);plaza.position.set(0,P-.25+.025,-3.5);plaza.receiveShadow=true;
    // UV da face de cima cobrindo a praça inteira uma vez
    {const uv=plaza.geometry.attributes.uv,p=plaza.geometry.attributes.position,n=plaza.geometry.attributes.normal;for(let i=0;i<uv.count;i++)uv.setXY(i,p.getX(i)/48+.5,n.getY(i)>.5?.5-p.getZ(i)/15:0);}add(plaza,false);
    // pad do mercado e muro de arrimo do calçadão com escadas para a areia
    const k=new Kit(),stone=mats.wall;
    k.add(stone,box([0,P-.9,-51.7],[66,1.9,.5]),0xb8ad96,.04);for(const x of [-20,20]){for(let i=0;i<6;i++)k.add(stone,box([x,P-.12-i*.27,-52.2-i*.32],[3,.27,.34]),0xc7bca5,.03);}
    k.add(stone,box([0,P+.28,-51.55],[66,.16,.2]),0xe8e1d0,.02);
    for(let x=-32;x<=32;x+=2.2)if(Math.abs(x)>2.4&&Math.abs(Math.abs(x)-20)>2)k.add(stone,box([x,P+.5,-51.55],[.1,.5,.1]),0xece6d8,.02);
    k.add(stone,box([0,P+.75,-51.55],[66,.06,.08]),0xece6d8,.02);
    add(k.build());
    // ----- cais -----
    this.buildDock(mats,add);
    // ----- casas -----
    this.houses=HOUSES.map(h=>{const o=add(house(h,mats)),[a,b]=footprint(h);this.colliders.push({x0:ISLAND.x+h.u-a-.15,x1:ISLAND.x+h.u+a+.15,z0:ISLAND.z+h.v-b-.15,z1:ISLAND.z+h.v+b+.15});
      // cerca da frente com o vão do portão (a fachada olha para f; o portão fica no deslocamento da porta)
      const r=h.rot??(h.face>0?0:Math.PI),f=[Math.cos(r),-Math.sin(r)],side=[Math.sin(r),Math.cos(r)],dz=doorOffset(h),line=h.d/2+1.55,cx=h.u+f[0]*line,cz=h.v+f[1]*line,gx=cx+side[0]*dz,gz=cz+side[1]*dz;
      if(Math.abs(f[0])>.5){this.colliders.push({x0:ISLAND.x+cx-.08,x1:ISLAND.x+cx+.08,z0:ISLAND.z+h.v-h.w/2,z1:ISLAND.z+gz-.9},{x0:ISLAND.x+cx-.08,x1:ISLAND.x+cx+.08,z0:ISLAND.z+gz+.9,z1:ISLAND.z+h.v+h.w/2});}
      else{this.colliders.push({x0:ISLAND.x+h.u-h.w/2,x1:ISLAND.x+gx-.9,z0:ISLAND.z+cz-.08,z1:ISLAND.z+cz+.08},{x0:ISLAND.x+gx+.9,x1:ISLAND.x+h.u+h.w/2,z0:ISLAND.z+cz-.08,z1:ISLAND.z+cz+.08});}
      return o;});
    this.church=add(church(mats));this.houses.push(this.church);this.colliders.push({x0:ISLAND.x+CHURCH.u-CHURCH.d/2,x1:ISLAND.x+CHURCH.u+CHURCH.d/2+.2,z0:ISLAND.z+CHURCH.v-CHURCH.w/2,z1:ISLAND.z+CHURCH.v+CHURCH.w/2},{x0:ISLAND.x+CHURCH.u+CHURCH.d/2-2.8,x1:ISLAND.x+CHURCH.u+CHURCH.d/2,z0:ISLAND.z+CHURCH.v+CHURCH.w/2,z1:ISLAND.z+CHURCH.v+CHURCH.w/2+2.8});
    for(const [x,z,r]of [[-46,-30,.6],[48,-24,-.8]]){const o=add(rancho(mats,x,z,r));this.houses.push(o);this.colliders.push({x:ISLAND.x+x,z:ISLAND.z+z,r:2.4});}
    this.houses.push(add(kiosk(mats,22,-48.5)));this.colliders.push({x0:ISLAND.x+20.8,x1:ISLAND.x+23.2,z0:ISLAND.z-49.3,z1:ISLAND.z-47.7});
    this.houses.push(add(orelhao(mats,-4.6,-30)));this.colliders.push({x:ISLAND.x-4.6,z:ISLAND.z-30,r:.35});
    // ----- postes, bancos, praça -----
    const lk=new Kit(),lampParts={post:mats.metal,glow:new THREE.MeshStandardMaterial({color:0xfff0c8,emissive:0xffc070,emissiveIntensity:2.2})},lampGroup=new THREE.Group();
    const lamps=[[-4.6,-44],[4.6,-44],[-4.6,-33],[4.6,-33],[-4.6,-22],[4.6,-22],[-4.6,-12],[4.6,-12],[-14,-49.5],[14,-49.5],[-28,-49.5],[28,-49.5],[-20,-9],[20,-9],[-20,2],[20,2]];
    for(const [u,v]of lamps){lampPost(lk,lampParts,u,v,groundLocal(u,v),lampGroup);this.colliders.push({x:ISLAND.x+u,z:ISLAND.z+v,r:.2});}
    add(lk.build());add(lampGroup);this.lampGroup=lampGroup;
    for(const [u,v,r]of [[-24,-48.3,0],[-9,-48.3,0],[9,-48.3,0],[24,-48.3,0],[-12,-6,Math.PI/2],[12,-6,-Math.PI/2]])add(bench(k,mats.wall,u,v,groundLocal(u,v),r));
    this.buildPlaza(mats,add);
    // ----- vegetação -----
    this.buildVegetation(hi,add);
    // ----- farol -----
    this.buildLighthouse(add);
    // ----- mercado -----
    this.shop=buildShop(mats);this.shop.group.position.set(0,0,0);add(this.shop.group);
    for(const c of this.shop.colliders)this.colliders.push(c.r?{x:c.x+ISLAND.x,z:c.z+ISLAND.z,r:c.r}:{x0:c.x0+ISLAND.x,x1:c.x1+ISLAND.x,z0:c.z0+ISLAND.z,z1:c.z1+ISLAND.z});
    this.group.traverse(o=>{if(o.isMesh&&o.castShadow===undefined)o.castShadow=true;});
    this.exploded=false;this.debris=[];
  }
  buildDock(mats,add){
    const k=new Kit(),wood=mats.wall,{u0,u1,v0,y}=DOCK,len=DOCK.rampTo-v0;
    // tábuas atravessadas com frestas, vigas, estacas com cracas e defensas de pneu
    for(let v=v0+.15;v<DOCK.rampTo;v+=.27){reseed(v*13);k.add(wood,box([R(-.02,.02),y-.04,v],[u1-u0+R(-.05,.08),.07,.23],[0,R(-.01,.01),R(-.006,.006)]),[0x9a7650,0x8d6b47,0xa68258,0x7f6040][Math.floor(rand()*4)],.07);}
    for(const s of [-1,1])k.add(wood,box([s*1.35,y-.2,v0+len/2+.2],[.14,.22,len+.4]),0x5e4631,.05);
    // rampa até o calçadão
    const rl=Math.hypot(DOCK.rampFrom-DOCK.rampTo,P-y),ra=Math.atan2(P-y,DOCK.rampFrom-DOCK.rampTo);
    for(let i=0;i<Math.floor(rl/.27);i++){const t=(i+.5)*.27,v=DOCK.rampTo+Math.cos(ra)*t,yy=y+Math.sin(ra)*t;k.add(wood,box([0,yy-.04,v],[u1-u0,.07,.23],[ra,0,0]),[0x9a7650,0x8d6b47,0xa68258][i%3],.07);}
    for(let v=v0+.3;v<DOCK.rampTo+1;v+=2.4)for(const s of [-1,1]){const base=-3.2;k.add(wood,limb(V(s*1.45,base,v),V(s*1.45,y+.55,v),.13,.12,8),0x6b5038,.06);k.add(wood,limb(V(s*1.45,-.35,v),V(s*1.45,.15,v),.141,.141,8),0x2f3a33,.1);
      k.add(wood,ellipsoid([s*1.45,y+.56,v],[.13,.04,.13],8,4),0x5a432e,.04);this.colliders.push({x:ISLAND.x+s*1.45,z:ISLAND.z+v,r:.16,dock:true});}
    // cabeços de amarração, corrimão da ponta, boia salva-vidas, caixotes, rede e lampiões
    for(const {v} of BOLLARDS)k.add(mats.metal,loft([{y:y,rx:.12,rz:.12},{y:y+.2,rx:.08,rz:.08},{y:y+.26,rx:.13,rz:.13},{y:y+.3,rx:.12,rz:.12}],{n:8}).translate(1.25,0,v),0x2b2d30,.03);
    for(const s of [-1,1])k.add(wood,box([s*1.5,y+.55,v0+.1],[.1,1.1,.1]),0x6b5038,.04);k.add(wood,box([0,y+1.05,v0+.1],[3.2,.1,.1]),0x7a5c40,.04);
    k.add(wood,box([-1.5,y+.7,-64],[.12,1.4,.12]),0x6b5038,.04);k.add(wood,new THREE.TorusGeometry(.32,.08,6,14).rotateY(Math.PI/2).translate(-1.44,y+1.1,-64),0xf06a23,.05);
    for(let i=0;i<4;i++)k.add(wood,new THREE.TorusGeometry(.32,.083,6,3,Math.PI/4).rotateY(Math.PI/2).rotateX(i*Math.PI/2+.4).translate(-1.43,y+1.1,-64),0xf6f3ea,.02);
    for(const [u,v,s,c]of [[-.9,-58.4,.55,0x8e6a44],[-.95,-57.7,.45,0x7a5a3a],[-.85,-58.3,.4,0x9a7650]])k.add(wood,box([u,y+s/2,v],[s,s,s],[0,s*3,0]),c,.1);
    k.add(wood,sculpt(ellipsoid([.8,y+.12,-75],[.45,.12,.38],10,5),v=>{v.y+=Math.sin(v.x*20)*.02;}),0x3e6a73,.2);
    for(let i=0;i<9;i++)k.add(wood,new THREE.TorusGeometry(.2-i*.004,.022,4,12).rotateX(Math.PI/2).translate(1.05,y+.02+i*.03,-62.2),0xd7c79a,.05);
    this.dockLamps=new THREE.Group();const lp={post:mats.metal,glow:new THREE.MeshStandardMaterial({color:0xfff0c8,emissive:0xffb060,emissiveIntensity:2.4})};
    for(const v of [-80.5,-69,-58])lampPost(k,lp,-1.3,v,y,this.dockLamps);
    // pórtico de entrada do cais
    for(const s of [-1,1])k.add(wood,box([s*1.75,P+1.5,-46.2],[.24,3,.24]),0x5a432e,.04);k.add(wood,box([0,P+3.05,-46.2],[4.2,.2,.3]),0x5a432e,.04);
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(3.2,.62),new THREE.MeshStandardMaterial({map:canvasTex(512,100,(c,w,h)=>{c.fillStyle='#2d5d7c';c.fillRect(0,0,w,h);c.strokeStyle='#f3e8cf';c.lineWidth=6;c.strokeRect(6,6,w-12,h-12);c.fillStyle='#f3e8cf';c.font='bold 46px Georgia';c.textAlign='center';c.textBaseline='middle';c.fillText('LAGUNA',w/2,h/2+2);}),roughness:.6}));
    sign.position.set(0,P+2.62,-46.33);sign.rotation.y=Math.PI;k.add(wood,box([0,P+2.62,-46.2],[3.4,.78,.2]),0x5a432e,.04);
    const g=k.build();g.add(this.dockLamps,sign);add(g);
    for(const s of [-1,1])this.colliders.push({x:ISLAND.x+s*1.75,z:ISLAND.z-46.2,r:.2});
    this.colliders.push({x0:ISLAND.x-1.7,x1:ISLAND.x+1.7,z0:ISLAND.z+v0-.2,z1:ISLAND.z+v0+.2});
  }
  buildPlaza(mats,add){
    const k=new Kit(),m=mats.wall;
    // chafariz de pedra com água animada
    const fu=-17,fv=-4.5;k.add(m,loft([{y:0,rx:2.4,rz:2.4},{y:.55,rx:2.4,rz:2.4},{y:.62,rx:2.6,rz:2.6},{y:.68,rx:2.45,rz:2.45}],{n:20}).translate(fu,P,fv),0xd9d0bc,.03);
    k.add(m,loft([{y:.5,rx:.35,rz:.35},{y:1.5,rx:.25,rz:.25},{y:1.6,rx:.9,rz:.9},{y:1.75,rx:.95,rz:.95},{y:1.8,rx:.3,rz:.3},{y:2.4,rx:.15,rz:.15},{y:2.55,rx:.25,rz:.25}],{n:14}).translate(fu,P,fv),0xd9d0bc,.03);
    this.colliders.push({x:ISLAND.x+fu,z:ISLAND.z+fv,r:2.6});
    this.water=new THREE.Mesh(new THREE.CircleGeometry(2.3,28).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({color:0x3f8a9a,metalness:.4,roughness:.08,transparent:true,opacity:.85}));this.water.position.set(fu,P+.5,fv);
    // canteiros com ipês e flores
    for(const [u,v]of [[17,-7]]){k.add(m,box([u,P+.2,v],[4.2,.4,2.2]),0xd8cfb8,.03);k.add(m,box([u,P+.42,v],[3.9,.06,1.9]),0x4a3222,.05);this.colliders.push({x0:ISLAND.x+u-2.1,x1:ISLAND.x+u+2.1,z0:ISLAND.z+v-1.1,z1:ISLAND.z+v+1.1});
      for(let i=0;i<9;i++)bush(k,m,u-1.6+i*.4,v+Math.sin(i)*.5,P+.4,.35,0x3d7a34,[0xe8364f,0xf2c037,0xffffff][i%3],i+u);}
    add(k.build());add(this.water);
  }
  buildVegetation(hi,add){
    const palmsK=new Kit(),treeK=new Kit(),mat=swayMaterial({roughness:.8,side:THREE.DoubleSide}),rockK=new Kit(),rockMat=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.95});
    reseed(42);
    // coqueiros ao longo da praia, inclinados para o mar
    const palms=[[-30,-52],[-25,-54],[-16,-53.5],[-11,-52.5],[10,-53],[15,-52],[24,-54],[31,-52.5],[-38,-49],[37,-49],[-45,-43],[44,-44],[-51,-35],[50,-36],[6,-51.5],[-6,-52.8],[46,-20],[-47,-24],[27,-10],[-28,-12]];
    palms.forEach(([u,v],i)=>{const y=terrainLocal(u,v);palm(palmsK,mat,u,v,y,5.5+(i*37%10)/5,.8+(i%4)*.35,-Math.PI/2+((i*53)%10-5)*.12,i+1);this.colliders.push({x:ISLAND.x+u,z:ISLAND.z+v,r:.25});});
    // ipês-amarelos na praça, árvores frondosas pela vila, araucárias no morro do farol
    [[-21,1],[20,-1],[-22,11],[19.5,34],[-18,32]].forEach(([u,v],i)=>{broadTree(treeK,mat,u,v,groundLocal(u,v),6.5,[0xf2c12e,0xe9b224,0xf6d04a],i+20,true);this.colliders.push({x:ISLAND.x+u,z:ISLAND.z+v,r:.3});});
    [[-25,-27],[25,-29],[-24,-19],[27,-19],[36,-8],[-37,9],[45,24],[-36,-14],[45,1],[-44,4],[28,36],[-2,36],[14,40],[-38,30],[36,-12],[-12,33]].forEach(([u,v],i)=>{broadTree(treeK,mat,u,v,terrainLocal(u,v),5+(i%3),[0x3f7a2e,0x4d8a34,0x5c9a3a,0x356b28],i+40);this.colliders.push({x:ISLAND.x+u,z:ISLAND.z+v,r:.3});});
    [[-26,44],[-2,50],[6,44],[-18,54],[-30,36],[4,56],[-14,62]].forEach(([u,v],i)=>{araucaria(treeK,mat,u,v,terrainLocal(u,v),11+(i%3)*1.5,i+70);this.colliders.push({x:ISLAND.x+u,z:ISLAND.z+v,r:.35});});
    for(let i=0;i<70;i++){const a=rand()*6.28,r=Math.sqrt(rand())*56,u=Math.cos(a)*r,v=Math.sin(a)*r,h=terrainLocal(u,v);if(h<1.2||flatMask(u,v)>.1||pathMask(u,v)>.2)continue;bush(treeK,mat,u,v,h,.5+rand()*.6,[0x3b7030,0x4c8237,0x2f6128][i%3],rand()<.35?[0xe8364f,0xf5a3c7,0xffffff,0xf2c037][i%4]:0,i+100);}
    // pedras na orla e no promontório
    const clear=(u,v,d)=>palms.every(([pu,pv])=>Math.hypot(pu-u,pv-v)>d);
    for(let i=0;i<90;i++){const a=rand()*6.28,R0=shoreRadius(a),r=R0*(.93+rand()*.14),u=Math.cos(a)*r,v=Math.sin(a)*r;if(v<-40&&Math.abs(u)<36||!clear(u,v,3.2))continue;rock(rockK,rockMat,u,v,terrainLocal(u,v),.5+rand()*1.6,i);}
    for(let i=0;i<24;i++){const u=-62+rand()*16,v=-18+rand()*26;rock(rockK,rockMat,u,v,terrainLocal(u,v)-.3,1.2+rand()*2.2,i+200,0x7b766e);}
    const palmsMesh=palmsK.build(),trees=treeK.build();add(palmsMesh);add(trees);add(rockK.build());
    this.grass=add(grassField(hi?26000:9000),false);
    // canoa na areia, guarda-sóis e cadeiras de praia
    const bk=new Kit(),bm=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.8,side:THREE.DoubleSide});
    const canoe=loft([{z:-2.2,cy:.3,rx:.05,rz:.05},{z:-1.6,cy:.18,rx:.42,rz:.2},{z:0,cy:.14,rx:.55,rz:.25},{z:1.6,cy:.18,rx:.42,rz:.2},{z:2.2,cy:.3,rx:.05,rz:.05}],{axis:'z',n:12,capStart:false,capEnd:false});
    const cp=canoe.attributes.position;for(let i=0;i<cp.count;i++)if(cp.getY(i)>.2)cp.setY(i,.36);canoe.computeVertexNormals();
    bk.add(bm,paint(canoe.rotateY(.5).translate(-14,terrainLocal(-14,-55.6)+.12,-55.6),(v)=>v.y>terrainLocal(-14,-55.6)+.42?0xf2efe6:0x2f7fae,.05));
    for(const [u,v,c]of [[12,-55,0xe8364f],[18,-54.8,0xf2c037],[26,-55.5,0x2f7fae]]){const y=terrainLocal(u,v);bk.add(bm,limb(V(u,y-.2,v),V(u+.2,y+2.3,v),.03,.03,5),0xf4f1e8);
      const cone=new THREE.ConeGeometry(1.4,.55,8,1,true).toNonIndexed();bk.add(bm,paint(cone.rotateZ(-.08).translate(u+.2,y+2.3,v),(p,ce)=>Math.floor((Math.atan2(ce.z-v,ce.x-u-.2)+Math.PI)/(Math.PI/4))%2?c:0xffffff,.03));
      bk.add(bm,box([u-.6,y+.25,v+.9],[.6,.06,1.5],[.25,0,0]),0x2f7fae,.04);}
    add(bk.build());
  }
  buildLighthouse(add){
    const lh=new THREE.Group(),white=new THREE.MeshStandardMaterial({color:0xe9e3d8,flatShading:true,roughness:.7}),red=new THREE.MeshStandardMaterial({color:0xb22a20,flatShading:true,roughness:.7}),dark=new THREE.MeshStandardMaterial({color:0x222428,roughness:.4,metalness:.6});
    for(let i=0;i<5;i++){const s=new THREE.Mesh(new THREE.CylinderGeometry(1.5-i*.16,1.62-i*.16,3,12),i%2?red:white);s.position.y=1.5+i*3;s.castShadow=true;lh.add(s);}
    const gal=new THREE.Mesh(new THREE.CylinderGeometry(1.35,1.35,.2,14),dark);gal.position.y=15.1;lh.add(gal);
    for(let i=0;i<14;i++){const p=new THREE.Mesh(new THREE.BoxGeometry(.05,.7,.05),dark);const a=i/14*6.283;p.position.set(Math.cos(a)*1.3,15.5,Math.sin(a)*1.3);lh.add(p);}
    const roof=new THREE.Mesh(new THREE.ConeGeometry(1.1,1.3,10),red);roof.position.y=17.35;lh.add(roof);
    // ----- lanterna do farol: vidraças com montantes, lente de Fresnel girando, dois fachos volumétricos,
    // clarão que acende quando o facho passa por quem olha e um holofote que varre o mar e a vila -----
    const room=new THREE.Group();room.position.y=16;lh.add(room);
    room.add(new THREE.Mesh(new THREE.CylinderGeometry(.86,.86,1.5,12,1,true),new THREE.MeshStandardMaterial({color:0xd8ecff,transparent:true,opacity:.16,roughness:.04,metalness:.2,depthWrite:false,side:THREE.DoubleSide})));
    for(let i=0;i<12;i++){const m=new THREE.Mesh(new THREE.BoxGeometry(.05,1.5,.05),dark);const a=i/12*6.283;m.position.set(Math.cos(a)*.86,0,Math.sin(a)*.86);room.add(m);}
    for(const y of [-.75,.75]){const r=new THREE.Mesh(new THREE.TorusGeometry(.86,.04,4,24).rotateX(Math.PI/2),dark);r.position.y=y;room.add(r);}
    const rotor=new THREE.Group();room.add(rotor);this.rotor=rotor;
    rotor.add(new THREE.Mesh(new THREE.CylinderGeometry(.1,.14,.5,8),dark));
    rotor.add(new THREE.Mesh(new THREE.SphereGeometry(.2,14,10),new THREE.MeshBasicMaterial({color:new THREE.Color(9,7.5,4.6)})));
    const ringM=new THREE.MeshBasicMaterial({color:new THREE.Color(3.2,2.6,1.6),transparent:true,opacity:.85,blending:THREE.AdditiveBlending,depthWrite:false});
    const glassM=new THREE.MeshBasicMaterial({color:new THREE.Color(1.6,1.3,.8),transparent:true,opacity:.35,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
    for(const s of [-1,1]){const lens=new THREE.Group();lens.position.x=s*.42;lens.rotation.y=Math.PI/2;rotor.add(lens);lens.add(new THREE.Mesh(new THREE.CircleGeometry(.5,24),glassM));
      for(let k=1;k<=5;k++)lens.add(new THREE.Mesh(new THREE.TorusGeometry(k*.095,.012,4,28),ringM));
      for(let k=0;k<3;k++){const prism=new THREE.Mesh(new THREE.TorusGeometry(.56-k*.035,.018,4,28,Math.PI*.8),ringM);prism.rotation.z=Math.PI*.1;prism.position.z=(k-1)*.03;lens.add(prism);}}
    // fachos: cone aberto com borda suave (fresnel da vista), poeira no ar e queda com a distância
    const beamMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,uniforms:{uStorm:U.uStorm,uTime:U.uTime,uDim:{value:1}},
      vertexShader:`varying float vT;varying vec3 vN,vV,vW;void main(){vT=abs(position.x)/95.;vec4 w=modelViewMatrix*vec4(position,1.);vW=(modelMatrix*vec4(position,1.)).xyz;vV=normalize(-w.xyz);vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*w;}`,
      fragmentShader:`uniform float uStorm,uTime,uDim;varying float vT;varying vec3 vN,vV,vW;
        void main(){float edge=pow(abs(dot(normalize(vN),normalize(vV))),2.2);float fall=pow(clamp(1.-vT,0.,1.),2.4)*smoothstep(0.,.04,vT);
          float dust=.75+.25*sin(vW.x*.35+uTime*.6)*sin(vW.z*.31-uTime*.4)*sin(vW.y*.5+uTime*.3);
          float k=edge*fall*dust*(.05+uStorm*.2)*uDim;gl_FragColor=vec4(vec3(1.,.87,.62)*k,1.);}`});
    this.beamMat=beamMat;
    for(const s of [-1,1]){const g=new THREE.ConeGeometry(7.5,95,32,1,true);g.translate(0,-47.5,0);g.rotateZ(Math.PI/2);if(s<0)g.rotateY(Math.PI);const m=new THREE.Mesh(g,beamMat);m.frustumCulled=false;rotor.add(m);}
    // clarão (sprite) e holofote que ilumina o que o facho toca
    const gc=document.createElement('canvas');gc.width=gc.height=128;const gx=gc.getContext('2d'),gr=gx.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'rgba(255,245,215,1)');gr.addColorStop(.18,'rgba(255,220,150,.7)');gr.addColorStop(.5,'rgba(255,170,80,.15)');gr.addColorStop(1,'rgba(0,0,0,0)');gx.fillStyle=gr;gx.fillRect(0,0,128,128);
    gx.globalCompositeOperation='lighter';gx.strokeStyle='rgba(255,230,170,.5)';gx.lineWidth=2;for(const a of [0,Math.PI/2]){gx.beginPath();gx.moveTo(64+Math.cos(a)*64,64+Math.sin(a)*64);gx.lineTo(64-Math.cos(a)*64,64-Math.sin(a)*64);gx.stroke();}
    const gt=new THREE.CanvasTexture(gc);gt.colorSpace=THREE.SRGBColorSpace;
    this.flare=new THREE.Sprite(new THREE.SpriteMaterial({map:gt,color:new THREE.Color(2.2,1.9,1.4),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));this.flare.scale.setScalar(4);room.add(this.flare);
    this.sweep=new THREE.SpotLight(0xffdca8,0,170,.075,.55,0);rotor.add(this.sweep);const tgt=new THREE.Object3D();tgt.position.set(60,-14,0);rotor.add(tgt);this.sweep.target=tgt;
    const door=new THREE.Mesh(new THREE.BoxGeometry(.9,1.8,.2),new THREE.MeshStandardMaterial({color:0x2f4f6a,roughness:.6}));door.position.set(0,.9,-1.52);lh.add(door);
    const y=terrainLocal(LIGHTHOUSE.u,LIGHTHOUSE.v);lh.position.set(LIGHTHOUSE.u,y-.3,LIGHTHOUSE.v);add(lh);this.lighthouse=lh;
    this.colliders.push({x:ISLAND.x+LIGHTHOUSE.u,z:ISLAND.z+LIGHTHOUSE.v,r:1.8});
  }
  // ---------- consultas ----------
  ground(x,z){return this.exploded?-99:groundLocal(x-ISLAND.x,z-ISLAND.z);}
  // Empurra um círculo (jogador) para fora dos obstáculos; devolve a posição corrigida
  collide(x,z,r=.3){if(this.exploded)return [x,z];
    for(const c of this.colliders){if(c.r){const dx=x-c.x,dz=z-c.z,d=Math.hypot(dx,dz),m=c.r+r;if(d<m&&d>1e-5){x=c.x+dx/d*m;z=c.z+dz/d*m;}}
      else if(x>c.x0-r&&x<c.x1+r&&z>c.z0-r&&z<c.z1+r){const px=Math.min(x-(c.x0-r),(c.x1+r)-x),pz=Math.min(z-(c.z0-r),(c.z1+r)-z);if(px<pz)x=x-(c.x0-r)<(c.x1+r)-x?c.x0-r:c.x1+r;else z=z-(c.z0-r)<(c.z1+r)-z?c.z0-r:c.z1+r;}}
    return [x,z];}
  // ---------- o meteoro cai no meio da ilha: tudo vai pelos ares ----------
  explode(){
    if(this.exploded)return;this.exploded=true;let s=91;const r=()=>{s=(s*16807)%2147483647;return (s-1)/2147483646;};
    const flying=[],W=V(ISLAND.x,0,ISLAND.z),launch=(obj,pos,size,power=1)=>{const d=V(pos.x-ISLAND.x,0,pos.z-ISLAND.z),dist=d.length()||1;d.multiplyScalar(1/dist);
      const sp=(22+r()*38)*power*(1.2-Math.min(dist,70)/140),up=(26+r()*50)*power;
      flying.push({obj,v:V(d.x*sp+(r()-.5)*10,up,d.z*sp+(r()-.5)*10),w:V(r()-.5,r()-.5,r()-.5).normalize(),spin:(1+r()*4)/Math.max(.6,Math.sqrt(size)),delay:r()*.35+Math.min(dist,70)/400,size,alive:true});obj.visible=false;this.scene.add(obj);obj.position.copy(pos);};
    // casas e farol inteiros, girando
    for(const h of this.houses){const p=h.getWorldPosition(V());const o=h.clone();o.rotation.copy(h.rotation);launch(o,p.add(V(0,1,0)),7,.8);}
    {const p=this.lighthouse.getWorldPosition(V());const o=this.lighthouse.clone();launch(o,p,8,.9);}
    // painéis do mercado (amarelo-limão, azul, branco), tábuas do cais, árvores e pedaços de terra com grama
    const mat=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.85});
    const chunk=(colorTop,colorSide,sx,sy,sz)=>{const g=sculpt(new THREE.IcosahedronGeometry(1,1),v=>{v.multiplyScalar(.75+r()*.5);});g.scale(sx,sy,sz);return new THREE.Mesh(paint(g,(v,c)=>c.y>sy*.25?colorTop:colorSide,.12),mat);};
    for(let i=0;i<34;i++){const c=[[0xd8d52c,0xd8d52c],[0x1f4f98,0x2f6cc4],[0xf4f4f0,0xdddddd]][i%3];const m=new THREE.Mesh(new THREE.BoxGeometry(2+r()*4,.25,1.5+r()*3),new THREE.MeshStandardMaterial({color:c[0],flatShading:true,roughness:.6}));launch(m,W.clone().add(V(-14+r()*28,2+r()*5,6+r()*22)),4,1.1);}
    for(let i=0;i<30;i++){const m=new THREE.Mesh(new THREE.BoxGeometry(3.2,.08,.24),new THREE.MeshStandardMaterial({color:0x8d6b47,roughness:.9}));launch(m,W.clone().add(V((r()-.5)*3,1,-50-r()*30)),1.5,.7);}
    const tk=new Kit(),tm=swayMaterial({roughness:.8,side:THREE.DoubleSide});palm(tk,tm,0,0,0,6,.6,0,5);const palmObj=tk.build();const bk=new Kit();broadTree(bk,tm,0,0,0,6,[0xf2c12e,0xe9b224],3,true);const ipe=bk.build();
    for(let i=0;i<18;i++){const o=(i%3?palmObj:ipe).clone();const a=r()*6.28,d=20+r()*38;launch(o,W.clone().add(V(Math.cos(a)*d,2,Math.sin(a)*d)),5,.9);}
    for(let i=0;i<80;i++){const a=r()*6.28,d=Math.sqrt(r())*58,size=1.5+r()*5;const top=d>46?0xe6d3a1:[0x6b9a3c,0x4f7f2e,0x8aa94a][i%3];const m=chunk(top,0x6a4a2e,size,size*.6,size*.9);launch(m,W.clone().add(V(Math.cos(a)*d,1,Math.sin(a)*d)),size,1+r()*.4);}
    this.flying=flying;this.explodeT=0;
    // some tudo o que estava na ilha e o terreno vira uma cratera submersa
    for(const o of this.group.children)if(o!==this.terrain)o.visible=false;
    const p=this.terrain.geometry.attributes.position;for(let i=0;i<p.count;i++){const u=p.getX(i),v=p.getZ(i),d=Math.hypot(u,v),rim=Math.exp(-Math.pow((d-75)/9,2));p.setY(i,Math.min(p.getY(i),-6-7*Math.max(0,1-d/70))+rim*2.2-(d<75?0:0));}
    p.needsUpdate=true;this.terrain.geometry.computeVertexNormals();
    const c=this.terrain.geometry.attributes.color;for(let i=0;i<c.count;i++){const k=.35+.15*Math.random();c.setXYZ(i,.18*k*2,.13*k*2,.1*k*2);}c.needsUpdate=true;
    this.heightTex.image.data.fill(0);this.heightTex.needsUpdate=true;
  }
  updateDebris(t,dt){if(!this.flying)return;this.explodeT+=dt;
    for(const f of this.flying){if(!f.alive)continue;if(this.explodeT<f.delay)continue;f.obj.visible=true;f.v.y-=9.8*dt;f.v.multiplyScalar(Math.exp(-dt*.05));f.obj.position.addScaledVector(f.v,dt);f.obj.rotateOnWorldAxis(f.w,f.spin*dt);
      if(f.obj.position.y<-1&&f.v.y<0){f.alive=false;f.obj.visible=false;this.scene.remove(f.obj);if(this.onSplash)this.onSplash(f.obj.position.clone().setY(0),f.size);}}}
  update(t,dt,camera,people){
    if(this.exploded){this.updateDebris(t,dt);return;}
    // farol: gira devagar (um giro a cada ~11 s); o clarão cresce quando um dos fachos aponta para a câmera
    const on=(U.uRed.value||0)<.05?1:0;this.rotor.rotation.y=t*.57;this.rotor.visible=!!on;this.flare.visible=!!on;
    if(on&&camera){const lp=this.flare.getWorldPosition(this._lp||(this._lp=V())),to=camera.position.clone().sub(lp),d=to.length();to.normalize();const a=this.rotor.rotation.y,dir=V(Math.cos(a),0,-Math.sin(a));
      const k=Math.pow(Math.abs(to.dot(dir)),24);this.flare.scale.setScalar(3.5+d*.035+k*(16+d*.12));this.flare.material.opacity=.45+.55*k;this.sweep.intensity=2.2+(U.uStorm.value||0)*3;}
    this.water.position.y=P+.5+Math.sin(t*2)*.01;this.shop.update(t,dt,camera,people);
  }
}

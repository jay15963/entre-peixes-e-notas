import * as THREE from 'three';
import {Kit,loft,limb,ellipsoid,box,sweep,tube,paint,sculpt,reseed,V} from './geometry.js';

// Barco de pesca de tábuas sobrepostas (clinker), modelado sobre o mesmo perfil de casco que o shader do mar
// usa para não mostrar água dentro do barco (inHull em environment.js).
const HS=2.15,HY=.68,DECK=-.07;
export function hullHalfWidth(zq){const z=zq;if(z< -1.65)return THREE.MathUtils.lerp(.48,.67,(z+2)/.35);if(z< -1.1)return THREE.MathUtils.lerp(.67,.79,(z+1.65)/.55);if(z< -.45)return THREE.MathUtils.lerp(.79,.84,(z+1.1)/.65);if(z<.35)return THREE.MathUtils.lerp(.84,.83,(z+.45)/.8);if(z<1.05)return THREE.MathUtils.lerp(.83,.71,(z-.35)/.7);if(z<1.6)return THREE.MathUtils.lerp(.71,.49,(z-1.05)/.55);if(z<2)return THREE.MathUtils.lerp(.49,.2,(z-1.6)/.4);return THREE.MathUtils.lerp(.2,.025,(z-2)/.21);}
const bottomQ=zq=>.16+.11*Math.pow(Math.abs(zq)/2.21,3);
// Ponto do casco (coordenadas do barco): lado s=±1, estação zq, altura relativa t (0 fundo, 1 borda)
export function hullPoint(s,zq,t,offset=0){const w=hullHalfWidth(zq)*(.57+.43*t)*HS;return V(s*Math.max(w+offset,.004),(bottomQ(zq)+.64*t)*HS-HY,zq*HS);}
const deckT=zq=>((DECK+HY)/HS-bottomQ(zq))/.64;
const STATIONS=(()=>{const a=[];for(let i=0;i<=44;i++){const u=i/44;a.push(-2+4.21*(1-Math.pow(1-u,1.35)));}return a;})();
const WOOD=0x8d6541,WOOD_DARK=0x6e4b2e,VARNISH=0xa9713d,TEAL=0x2e6f74,WHITE=0xece6d8,RED=0x7a2b22,METAL=0x8d9397;
function strake(kit,mat,s,t0,t1,color,{inner=false,lap=.02}={}){
  const pos=[];for(let i=0;i<STATIONS.length-1;i++){const za=STATIONS[i],zb=STATIONS[i+1];const off=inner?-.028:0;
    const a=hullPoint(s,za,t0,off+(inner?0:lap)),b=hullPoint(s,zb,t0,off+(inner?0:lap)),c=hullPoint(s,zb,t1,off),d=hullPoint(s,za,t1,off);
    if((s>0)!==inner)pos.push(a,b,c,a,c,d);else pos.push(a,c,b,a,d,c);}
  const g=new THREE.BufferGeometry().setFromPoints(pos);g.computeVertexNormals();kit.add(mat,g,color,.07);
}
function nameTexture(){
  if(typeof document==='undefined')return null;const c=document.createElement('canvas');c.width=512;c.height=128;const x=c.getContext('2d');
  x.clearRect(0,0,512,128);x.fillStyle='#efe6d2';x.font='italic 700 58px Georgia, serif';x.textAlign='center';x.textBaseline='middle';x.fillText('Entre Peixes',256,52);x.font='600 24px Georgia, serif';x.fillText('— E NOTAS · SANTOS —',256,100);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}
export function makeBoat(){
  reseed(42);
  const wood=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.82,flatShading:true,side:THREE.DoubleSide});
  const paintM=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.5,flatShading:true,side:THREE.DoubleSide});
  const metal=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.35,metalness:.75,flatShading:true,side:THREE.DoubleSide});
  const rope=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:true,side:THREE.DoubleSide});
  const kit=new Kit();
  // ----- Casco: fiadas de tábuas com degrau de sobreposição -----
  const T=[0,.16,.32,.48,.63,.78,.9,1];const colors=[RED,RED,WHITE,TEAL,TEAL,TEAL,VARNISH];
  for(const s of [-1,1])for(let k=0;k<T.length-1;k++){strake(kit,paintM,s,T[k],T[k+1],colors[k]);strake(kit,wood,s,Math.max(T[k],.12),T[k+1],k%2?WOOD:WOOD_DARK,{inner:true});}
  // Fundo em V raso até a quilha
  {const pos=[];for(let i=0;i<STATIONS.length-1;i++){const za=STATIONS[i],zb=STATIONS[i+1];for(const s of [-1,1]){const a=hullPoint(s,za,0,.02),b=hullPoint(s,zb,0,.02),ka=V(0,a.y-.07,a.z),kb=V(0,b.y-.07,b.z);if(s>0)pos.push(ka,kb,b,ka,b,a);else pos.push(ka,a,b,ka,b,kb);}}
   const g=new THREE.BufferGeometry().setFromPoints(pos);g.computeVertexNormals();kit.add(paintM,g,RED,.05);}
  // Quilha e roda de proa subindo
  const keel=STATIONS.map(z=>{const p=hullPoint(1,z,0);return V(0,p.y-.1,p.z);});const bowTop=hullPoint(1,2.21,1.08);keel.push(V(0,bowTop.y-.9,bowTop.z+.12),V(0,bowTop.y-.3,bowTop.z+.16),V(0,bowTop.y+.08,bowTop.z+.1));
  kit.add(wood,sweep(keel,.07,.07),WOOD_DARK,.05);
  // Espelho de popa
  {const zq=-2,pts=[];for(let i=0;i<=8;i++)pts.push(hullPoint(1,zq,i/8,.02));const pos=[],c=V(0,hullPoint(1,zq,.5).y,zq*HS);const all=[...pts.map(p=>V(-p.x,p.y,p.z)).reverse(),V(0,pts[0].y-.07,pts[0].z),...pts];
   for(let i=0;i<all.length-1;i++){pos.push(c,all[i+1],all[i]);}const g=new THREE.BufferGeometry().setFromPoints(pos);g.translate(0,0,-.012);g.computeVertexNormals();kit.add(paintM,g,TEAL,.05);
   const gi=g.clone();gi.translate(0,0,.05);const p=gi.attributes.position;for(let i=0;i<p.count;i+=3){const x=p.getX(i+1),y=p.getY(i+1),z=p.getZ(i+1);p.setXYZ(i+1,p.getX(i+2),p.getY(i+2),p.getZ(i+2));p.setXYZ(i+2,x,y,z);}gi.computeVertexNormals();kit.add(wood,gi,WOOD,.05);}
  // Alcatrate (borda envernizada), verdugo e cantoneiras
  for(const s of [-1,1]){
    kit.add(wood,sweep(STATIONS.map(z=>hullPoint(s,z,1,.01).add(V(0,.03,0))),.085,.06),VARNISH,.05);
    kit.add(wood,sweep(STATIONS.map(z=>hullPoint(s,z,.9,.045)),.04,.05),WOOD_DARK,.05);
    kit.add(wood,sweep(STATIONS.filter(z=>z<2.05).map(z=>hullPoint(s,z,.95,-.06)),.035,.05),WOOD,.05);
  }
  kit.add(wood,sweep([hullPoint(-1,-2,1,.01).add(V(0,.03,.02)),hullPoint(1,-2,1,.01).add(V(0,.03,.02))],.09,.06),VARNISH,.05);
  // Cavernas
  for(let z=-1.85;z<2.0;z+=.26){const t0=Math.max(deckT(z)-.02,0),path=[];for(let i=0;i<=6;i++)path.push(hullPoint(-1,z,1-(1-t0)*i/6,-.045));const path2=[];for(let i=0;i<=6;i++)path2.push(hullPoint(1,z,t0+(1-t0)*i/6,-.045));
    kit.add(wood,sweep(path,.05,.032,{up:V(0,0,1)}),WOOD_DARK,.06);kit.add(wood,sweep(path2,.05,.032,{up:V(0,0,1)}),WOOD_DARK,.06);}
  // Piso de ripas
  for(let lane=-5;lane<=5;lane++){const xc=lane*.215;for(let i=0;i<STATIONS.length-1;i++){const za=STATIONS[i],zb=STATIONS[i+1],zm=(za+zb)/2;const half=hullPoint(1,zm,Math.max(deckT(zm),0)).x-.06;const x0=Math.max(xc-.095,-half),x1=Math.min(xc+.095,half);if(x1-x0<.03)continue;
    kit.add(wood,box([(x0+x1)/2,DECK-.02,zm*HS],[x1-x0,.04,(zb-za)*HS+.002]),lane%2?WOOD:0x9a7049,.04);}}
  // Bancos (mesmas posições do jogo) com mãos-francesas e pé central
  for(const [bz,w]of [[-2.84,1.29],[-.258,1.48],[2.279,1.225]]){const zq=bz/HS,t=((.79+HY)/HS-bottomQ(zq))/.64,half=hullPoint(1,zq,t,-.03).x;
    kit.add(wood,box([0,.765,bz],[half*2,.05,.6]),VARNISH,.05);kit.add(wood,box([0,.73,bz+.27],[half*2-.05,.04,.04]),WOOD_DARK,.05);
    kit.add(wood,box([0,.35,bz],[.08,.76,.08]),WOOD_DARK,.05);
    for(const s of [-1,1]){const g=new THREE.BufferGeometry().setFromPoints([V(s*(half-.01),.74,bz-.03),V(s*(half-.01),.4,bz-.03),V(s*(half-.3),.74,bz-.03),V(s*(half-.01),.74,bz+.03),V(s*(half-.3),.74,bz+.03),V(s*(half-.01),.4,bz+.03)]);g.computeVertexNormals();kit.add(wood,g,WOOD_DARK,.05);
      kit.add(metal,limb(V(s*(half+.02),1.08,bz),V(s*(half+.02),1.2,bz),.012,.012,6),METAL,.02);kit.add(metal,new THREE.TorusGeometry(.04,.009,4,10,Math.PI).translate(s*(half+.02),1.2,bz),METAL,.02);}}
  // Remos deitados sobre os bancos
  for(const s of [-1,1]){const x=s*.78;kit.add(wood,limb(V(x,.83,-2.6),V(x+s*.05,.83,2.1),.022,.022,6),VARNISH,.05);kit.add(wood,box([x+s*.06,.83,2.35],[.14,.018,.5]),VARNISH,.05);kit.add(wood,box([x,.83,-2.75],[.035,.035,.18]),WOOD_DARK,.05);}
  // Balde de alumínio, caixa de pesca, rede com boias e cabo enrolado
  const bucket=new THREE.LatheGeometry([V(.0,0),V(.17,0),V(.2,.34),V(.215,.35),V(.2,.36)],12);bucket.translate(.62,DECK,1.2);kit.add(metal,bucket,0xa7adb1,.06);
  kit.add(metal,new THREE.TorusGeometry(.2,.006,4,16,Math.PI).rotateY(Math.PI/2).translate(.62,DECK+.36,1.2),METAL,.02);
  kit.add(paintM,box([-.62,DECK+.1,1.35],[.42,.2,.26]),0x3f6b3a,.04);kit.add(paintM,box([-.62,DECK+.215,1.35],[.44,.04,.28]),0x2f5230,.04);kit.add(metal,sweep([V(-.72,DECK+.24,1.35),V(-.72,DECK+.29,1.35),V(-.52,DECK+.29,1.35),V(-.52,DECK+.24,1.35)],.018,.012),METAL,.02);
  kit.add(rope,sculpt(ellipsoid([.15,DECK+.1,3.35],[.42,.16,.55],14,8),v=>{v.y+=Math.sin(v.x*23)*Math.sin(v.z*19)*.035;v.x+=Math.sin(v.z*17)*.02;}),0x2f4d3b,.18);
  for(let i=0;i<5;i++)kit.add(paintM,ellipsoid([-.1+i*.11,DECK+.22+Math.sin(i)*.03,3.1+Math.cos(i*2)*.12],[.04,.03,.04],8,6),0xe86a24,.04);
  {const pts=[];for(let i=0;i<150;i++){const a=i*.4,r=.08+i*.0012;pts.push(V(-.45+Math.cos(a)*r,DECK+.02+Math.floor(i/16)*.012,2.9+Math.sin(a)*r));}kit.add(rope,tube(pts,.012,5),0xc9a86c,.12);}
  // Defensas penduradas por fora
  for(const z of [-1.2,1.1]){const top=hullPoint(1,z/HS,1,.03),h=V(top.x+.06,top.y-.45,z);kit.add(rope,limb(top,h.clone().add(V(0,.2,0)),.006,.006,4),0xc9a86c,.1);kit.add(paintM,loft([{y:h.y-.13,cx:h.x,cz:z,rx:.05,rz:.05},{y:h.y-.1,cx:h.x,cz:z,rx:.075,rz:.075},{y:h.y+.1,cx:h.x,cz:z,rx:.075,rz:.075},{y:h.y+.13,cx:h.x,cz:z,rx:.05,rz:.05}],{n:10}),0xf0ece3,.04);}
  // Cunhos de amarração
  for(const [x,z]of [[0,4.55],[.75,-4.1],[-.75,-4.1]]){const y=hullPoint(1,z/HS,1).y+.07;kit.add(metal,box([x,y,z],[.14,.025,.03]),METAL,.03);kit.add(metal,box([x,y-.02,z],[.04,.04,.03]),METAL,.03);}
  const group=kit.build();group.name='Barco de pesca';
  // Nome pintado na popa e nos costados da proa
  const tex=nameTexture();if(tex){const m=new THREE.MeshStandardMaterial({map:tex,transparent:true,roughness:.6,depthWrite:false});const back=new THREE.Mesh(new THREE.PlaneGeometry(1.1,.28),m);back.position.set(0,.72,-2*HS-.03);back.rotation.y=Math.PI;group.add(back);
    for(const s of [-1,1]){const p=hullPoint(s,1.55,.72,.035),q=new THREE.Mesh(new THREE.PlaneGeometry(.8,.2),m);q.position.copy(p);q.rotation.y=s*(Math.PI/2-.35);q.rotation.z=0;group.add(q);}}
  group.userData.bucket=V(.62,DECK,1.2);
  return group;
}
// Console do leme com roda de seis raios e manetes
export function addHelm(parent){
  const kit=new Kit(),wood=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.8,flatShading:true}),metal=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.3,metalness:.8,flatShading:true});
  kit.add(wood,box([0,.43,-2.62],[.46,.95,.3]),TEAL,.05).add(wood,box([0,.93,-2.62],[.52,.05,.36]),VARNISH,.04).add(wood,box([0,.4,-2.46],[.36,.6,.02]),WOOD_DARK,.04);
  kit.add(metal,ellipsoid([.15,.99,-2.58],[.05,.03,.05],8,5),0x20242a,.02).add(metal,limb(V(-.15,.95,-2.6),V(-.15,1.05,-2.66),.01,.01,5),METAL,.02);
  const console=kit.build();parent.add(console);
  const wheel=new THREE.Group(),wk=new Kit();
  wk.add(wood,new THREE.TorusGeometry(.24,.022,6,20),VARNISH,.05);wk.add(metal,new THREE.CylinderGeometry(.04,.04,.06,8).rotateX(Math.PI/2),METAL,.03);
  for(let i=0;i<6;i++){const a=i/6*Math.PI*2,d=V(Math.cos(a),Math.sin(a),0);wk.add(wood,limb(d.clone().multiplyScalar(.03),d.clone().multiplyScalar(.33),.012,.01,5),VARNISH,.05);wk.add(wood,ellipsoid([d.x*.34,d.y*.34,0],[.018,.018,.018],6,4),WOOD_DARK,.05);}
  wheel.add(wk.build());wheel.rotation.x=-.45;wheel.position.set(0,1.12,-2.8);parent.add(wheel);return wheel;
}
// Motor de popa com hélice que gira com a velocidade
export function addMotor(parent){
  const kit=new Kit(),plastic=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.35,metalness:.1,flatShading:true}),metal=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.4,metalness:.7,flatShading:true});
  const z=-2*HS-.2,top=hullPoint(1,-2,1).y;
  kit.add(metal,box([0,top-.02,-2*HS-.05],[.12,.16,.14]),0x2a2d31,.03);
  kit.add(plastic,sculpt(ellipsoid([0,top+.28,z-.08],[.17,.2,.24],12,8),v=>{if(v.y<top+.2)v.y=Math.max(v.y,top+.12);}),0xefeae0,.03);
  kit.add(plastic,box([0,top+.2,z-.08],[.35,.05,.46]),0xb3261e,.03);kit.add(plastic,box([0,top+.1,z-.07],[.3,.14,.36]),0x24272b,.03);
  kit.add(metal,box([0,top-.4,z-.05],[.08,.9,.12]),0x33373c,.03);kit.add(metal,box([0,-.33,z-.05],[.34,.02,.26]),0x33373c,.03);
  kit.add(metal,loft([{z:z-.24,cy:-.52,rx:.045,rz:.045},{z:z-.12,cy:-.52,rx:.06,rz:.06},{z:z+.1,cy:-.52,rx:.045,rz:.045}],{axis:'z',n:10}),0x33373c,.03);
  kit.add(metal,box([0,-.6,z-.05],[.02,.12,.18]),0x33373c,.03);
  kit.add(plastic,limb(V(0,top+.12,z+.05),V(0,top+.2,z+.55),.022,.018,6),0x24272b,.03);kit.add(plastic,limb(V(0,top+.2,z+.55),V(0,top+.21,z+.68),.03,.03,6),0xb3261e,.03);
  const g=kit.build();parent.add(g);
  const prop=new THREE.Group(),pk=new Kit();for(let i=0;i<3;i++){const b=sculpt(ellipsoid([0,.07,0],[.035,.075,.008],6,4),v=>{v.z+=v.y*.25;});b.rotateZ(i/3*Math.PI*2);pk.add(metal,b,0xb9a15c,.03);}pk.add(metal,ellipsoid([0,0,0],[.025,.025,.04],6,4),0x33373c);
  prop.add(pk.build());prop.position.set(0,-.52,z-.27);parent.add(prop);return {group:g,prop};
}
// Lanterna de popa: vidro emissivo e luz quente que balança com o barco.
export function addLantern(parent){
  const g=new THREE.Group(),iron=new THREE.MeshStandardMaterial({color:0x2b2521,metalness:.7,roughness:.45,flatShading:true});
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.025,.03,1.5,6),iron);pole.position.y=.75;g.add(pole);
  const arm=new THREE.Mesh(new THREE.BoxGeometry(.32,.025,.025),iron);arm.position.set(.15,1.48,0);g.add(arm);
  const hang=new THREE.Group();hang.position.set(.3,1.46,0);g.add(hang);
  const glass=new THREE.Mesh(new THREE.CylinderGeometry(.07,.08,.17,6),new THREE.MeshBasicMaterial({color:new THREE.Color(2.4,1.25,.42)}));glass.position.y=-.14;hang.add(glass);
  for(let i=0;i<6;i++){const bar=new THREE.Mesh(new THREE.BoxGeometry(.01,.19,.01),iron);const a=i/6*Math.PI*2;bar.position.set(Math.cos(a)*.078,-.14,Math.sin(a)*.078);hang.add(bar);}
  const cap=new THREE.Mesh(new THREE.ConeGeometry(.1,.07,6),iron);cap.position.y=-.03;hang.add(cap);const ring=new THREE.Mesh(new THREE.TorusGeometry(.02,.005,4,8),iron);ring.position.y=.01;hang.add(ring);
  const light=new THREE.PointLight(0xffa148,3.5,11,1.6);light.position.y=-.26;hang.add(light);
  g.position.set(-1.12,.55,-3.28);g.rotation.y=-.5;parent.add(g);g.userData={hang,light,glass};return g;
}

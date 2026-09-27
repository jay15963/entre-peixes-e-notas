import * as THREE from 'three';
import {Kit,loft,limb,ellipsoid,box,sculpt,sweep,paint,V} from './geometry.js';
import {Spring} from './animation.js';

// ================= Rifle de ferrolho com luneta =================
// Eixo +z = cano; origem no punho (mão do gatilho). O lado "direito" do atirador é −x (ferrolho e janela de ejeção).
// Peças separadas e móveis: ferrolho (gira e corre), carregador destacável, tampas da luneta.
const M=()=>({
  wood:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.5,flatShading:true}),
  blued:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.32,metalness:.85,flatShading:true}),
  steel:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.18,metalness:1,flatShading:true}),
  rubber:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.9,flatShading:true}),
  brass:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.25,metalness:1,flatShading:true}),
  lens:new THREE.MeshStandardMaterial({color:0x2a3b6a,metalness:.4,roughness:.02,emissive:0x0a1430,envMapIntensity:2})});
export function makeCartridge(mats=M(),kit=new Kit(),at=[0,0,0],dir=1){
  const [x,y,z]=at;kit.add(mats.brass,loft([{z:z-.03*dir,cy:y,cx:x,rx:.0062,rz:.0062},{z:z+.018*dir,cy:y,cx:x,rx:.006,rz:.006},{z:z+.024*dir,cy:y,cx:x,rx:.0042,rz:.0042},{z:z+.032*dir,cy:y,cx:x,rx:.0041,rz:.0041}],{axis:'z',n:8}),0xd9a441,.04);
  kit.add(mats.brass,loft([{z:z+.032*dir,cy:y,cx:x,rx:.0039,rz:.0039},{z:z+.045*dir,cy:y,cx:x,rx:.0028,rz:.0028},{z:z+.05*dir,cy:y,cx:x,rx:.0008,rz:.0008}],{axis:'z',n:8}),0xb86b3a,.04);return kit;}
export function makeRifle(){
  const mats=M(),kit=new Kit();
  // ----- coronha de nogueira: soleira de borracha, apoio de face, punho com quadriculado, telha longa -----
  const grain=(v,c)=>{const g=Math.sin(c.z*90+Math.sin(c.y*60)*2);const base=new THREE.Color(0x6b3a1c).multiplyScalar(.82+g*.1);const grip=c.z>-.12&&c.z<.02&&c.y<-.02,fore=c.z>.18&&c.z<.36;if((grip||fore)&&Math.sin(c.z*420)*Math.sin((c.y+c.x)*420)>.1)base.multiplyScalar(.72);return base;};
  kit.add(mats.wood,paint(loft([{z:-.42,cy:-.058,rx:.021,rz:.06,pow:3},{z:-.33,cy:-.05,rx:.022,rz:.055,pow:3},{z:-.2,cy:-.032,rx:.02,rz:.04,pow:3,up:.2},{z:-.1,cy:-.02,rx:.019,rz:.03,pow:3},{z:-.03,cy:-.012,rx:.021,rz:.026,pow:3},{z:.2,cy:-.014,rx:.023,rz:.024,pow:3},{z:.38,cy:-.012,rx:.021,rz:.02,pow:3},{z:.43,cy:-.008,rx:.014,rz:.014,pow:3}],{axis:'z',n:12}),grain,.02));
  kit.add(mats.wood,paint(sculpt(loft([{y:-.018,rx:.019,rz:.024},{y:-.07,rx:.017,rz:.022},{y:-.1,rx:.018,rz:.024}],{n:10}),v=>{v.z+=(v.y+.018)*.55-.045;}),grain,.02));// punho de pistola
  kit.add(mats.wood,paint(loft([{z:-.34,cy:.012,rx:.02,rz:.012,pow:3},{z:-.2,cy:.02,rx:.019,rz:.012,pow:3},{z:-.14,cy:.014,rx:.016,rz:.008,pow:3}],{axis:'z',n:10}),grain,.02));// apoio de face
  kit.add(mats.rubber,loft([{z:-.44,cy:-.058,rx:.022,rz:.062,pow:3},{z:-.42,cy:-.058,rx:.022,rz:.062,pow:3}],{axis:'z',n:12}),0x16171a,.03);
  kit.add(mats.blued,ellipsoid([0,-.108,-.07],[.019,.006,.024],8,4),0x1c1e21,.02);// capa do punho
  // ----- caixa da culatra, janela de ejeção, trilho, gatilho e guarda-mato -----
  kit.add(mats.blued,loft([{z:-.05,cy:.02,rx:.017,rz:.016,pow:2.4},{z:.18,cy:.02,rx:.017,rz:.016,pow:2.4},{z:.2,cy:.02,rx:.014,rz:.014,pow:2.4}],{axis:'z',n:12}),0x26292d,.02);
  kit.add(mats.steel,box([-.0175,.027,.06],[.004,.014,.07]),0x0b0c0d,.02);// janela de ejeção (recorte escuro)
  kit.add(mats.blued,box([0,.041,.07],[.012,.006,.24]),0x1d2023,.02);for(let i=0;i<10;i++)kit.add(mats.blued,box([0,.045,-.035+i*.024],[.013,.003,.008]),0x1d2023,.02);
  kit.add(mats.blued,sculpt(new THREE.TorusGeometry(.024,.0035,4,12,Math.PI),()=>{}).rotateY(Math.PI/2).rotateX(Math.PI).translate(0,-.018,.005),0x1d2023,.02);
  kit.add(mats.steel,sculpt(new THREE.BoxGeometry(.005,.028,.006,1,3,1),v=>{v.z+=(v.y*v.y)*8;}).translate(0,-.028,.0),0xa8adb2,.02);
  kit.add(mats.blued,box([.0,-.022,.1],[.009,.006,.012]),0x3a3e42,.02);// botão do carregador
  // ----- cano flutuante com freio de boca vazado e alça de bandoleira -----
  kit.add(mats.blued,limb(V(0,.02,.2),V(0,.02,.7),.0105,.0078,10),0x2b2e31,.02);
  kit.add(mats.blued,loft([{z:.7,cy:.02,rx:.011,rz:.011},{z:.76,cy:.02,rx:.011,rz:.011}],{axis:'z',n:10}),0x1d2023,.02);
  for(let i=0;i<3;i++)for(const s of [-1,1])kit.add(mats.steel,box([s*.0105,.02,.712+i*.016],[.002,.012,.008]),0x050505,.01);
  for(const [z,y]of [[.35,-.036],[-.3,-.1]]){kit.add(mats.steel,box([0,y,z],[.006,.012,.008]),0x8a8e92).add(mats.steel,new THREE.TorusGeometry(.009,.0022,4,10).rotateY(Math.PI/2).translate(0,y-.012,z),0x8a8e92);}
  // bandoleira de couro pendurada entre as alças
  const sl=[];for(let i=0;i<=12;i++){const t=i/12;sl.push(V(.0,-.05-.064*t-.1*Math.sin(t*Math.PI),.35-.65*t));}kit.add(mats.rubber,sweep(sl,.005,.024),0x5b3a22,.06);
  // ----- luneta: tubo, campana da objetiva, ocular com borracha, torres com serrilhado, anéis e bases -----
  const sc=.082;
  kit.add(mats.blued,loft([{z:-.13,cy:sc,rx:.016,rz:.016},{z:-.1,cy:sc,rx:.019,rz:.019},{z:-.075,cy:sc,rx:.0135,rz:.0135},{z:.14,cy:sc,rx:.0135,rz:.0135},{z:.18,cy:sc,rx:.023,rz:.023},{z:.24,cy:sc,rx:.024,rz:.024}],{axis:'z',n:16}),0x17191b,.02);
  kit.add(mats.rubber,loft([{z:-.155,cy:sc,rx:.0175,rz:.0175},{z:-.128,cy:sc,rx:.017,rz:.017}],{axis:'z',n:14,capStart:false}),0x0d0d0e,.02);
  kit.add(mats.blued,loft([{y:sc+.012,cx:0,cz:.035,rx:.0105,rz:.0105},{y:sc+.03,cx:0,cz:.035,rx:.0105,rz:.0105}],{n:12}),0x202326,.03);
  kit.add(mats.blued,limb(V(-.012,sc,.035),V(-.03,sc,.035),.0105,.0105,12),0x202326,.03);kit.add(mats.blued,limb(V(.012,sc,.03),V(.026,sc,.03),.008,.008,10),0x202326,.03);
  for(let i=0;i<5;i++)kit.add(mats.steel,new THREE.TorusGeometry(.0108,.0012,3,14).rotateX(Math.PI/2).translate(0,sc+.015+i*.003,.035),0x3b3f43,.02);
  for(const z of [-.04,.11]){kit.add(mats.blued,new THREE.TorusGeometry(.0158,.0035,4,16).translate(0,sc,z),0x121416,.02);kit.add(mats.blued,box([0,(sc+.045)/2,z],[.02,sc-.045,.012]),0x121416,.02);kit.add(mats.steel,box([-.013,sc-.006,z],[.004,.006,.008]),0x6a6e72);}
  const g=kit.build();
  // lentes (objetiva e ocular) com reflexo azulado
  const obj=new THREE.Mesh(new THREE.CircleGeometry(.021,20),mats.lens);obj.position.set(0,sc,.2405);g.add(obj);const ocu=new THREE.Mesh(new THREE.CircleGeometry(.014,16),mats.lens);ocu.position.set(0,sc,-.1552);ocu.rotation.y=Math.PI;g.add(ocu);
  // ----- ferrolho: corpo polido + alavanca com bola; gira (levanta) e corre para trás -----
  const bolt=new THREE.Group();bolt.position.set(0,.02,.02);const bk=new Kit();
  bk.add(mats.steel,limb(V(0,0,-.07),V(0,0,.13),.0078,.0078,10),0xc8ccd0,.03);bk.add(mats.steel,loft([{z:-.09,rx:.0085,rz:.0085},{z:-.07,rx:.008,rz:.008}],{axis:'z',n:10}),0x9aa0a6);
  bk.add(mats.steel,limb(V(-.006,0,-.035),V(-.045,-.018,-.05),.0042,.0038,6),0xb8bcc0,.03);bk.add(mats.steel,ellipsoid([-.048,-.02,-.052],[.0085,.0085,.0085],8,6),0x2a2d31,.02);
  const handle=bk.build();bolt.add(handle);const knob=new THREE.Object3D();knob.position.set(-.048,-.02,-.052);bolt.add(knob);g.add(bolt);
  // ----- carregador destacável (5 tiros), com os cartuchos à mostra por cima -----
  const mag=new THREE.Group();mag.position.set(0,-.012,.075);const mk=new Kit();
  mk.add(mats.blued,sculpt(new THREE.BoxGeometry(.03,.075,.07,1,2,1),v=>{v.z+=-(v.y+.0)*.18;}).translate(0,-.04,0),0x1d1f22,.02);mk.add(mats.blued,box([0,-.081,-.007],[.034,.008,.078]),0x121315,.02);
  makeCartridge(mats,mk,[-.004,-.001,.0]);makeCartridge(mats,mk,[.004,-.009,.002]);
  const magMesh=mk.build();mag.add(magMesh);g.add(mag);
  // âncoras de mão, olho, boca do cano e ejeção
  const A=(x,y,z,rx=0,ry=0,rz=0)=>{const o=new THREE.Object3D();o.position.set(x,y,z);o.rotation.set(rx,ry,rz);g.add(o);return o;};
  const muzzle=A(0,.02,.77),eye=A(0,sc,-.23),grip=A(-.02,-.05,-.08),fore=A(0,-.05,.29),magBottom=A(0,-.1,.075),port=A(-.02,.03,.06);
  // punhos das mãos em primeira pessoa (origem da mão = pulso): palma na lateral direita do punho; palma para cima sob o guarda-mão
  const gripW=A(-.031,-.007,-.1),foreW=A(-.05,-.051,.28),magW=A(-.05,-.118,.06);const knobW=new THREE.Object3D();knobW.position.set(-.068,-.025,-.14);bolt.add(knobW);
  g.userData={muzzle,eye,grip,fore,bolt,handle,knob,knobW,gripW,foreW,magW,mag,magHome:mag.position.clone(),magBottom,port,mats,scopeY:sc};
  return g;
}
// Pose das peças móveis. boltLift 0..1 (alavanca levantada), boltBack 0..1 (ferrolho recuado)
export function poseRifle(gun,{boltLift=0,boltBack=0}={}){const b=gun.userData.bolt;b.rotation.z=-boltLift*1.15;b.position.z=.02-boltBack*.085;}
// Linha do tempo do ciclo do ferrolho (após cada tiro) e da recarga: devolve pose das peças e das mãos.
export const CYCLE=.62,RELOAD=2.75;
const sm=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
function cyclePose(t){// t em segundos desde o início do ciclo
  const hand=sm(0,.11,t)*(1-sm(.5,.62,t)),lift=sm(.1,.18,t)*(1-sm(.42,.5,t)),back=sm(.19,.28,t)*(1-sm(.31,.41,t));
  return {rightToBolt:hand,boltLift:lift,boltBack:back,eject:t>=.26};}
export function rigState(kind,t){
  // kind: 'idle' | 'cycle' | 'reload'
  const s={rightToBolt:0,boltLift:0,boltBack:0,leftTarget:'fore',leftBlend:0,magState:'in',magOffset:0,roll:0,lower:0,events:[]};
  if(kind==='cycle')Object.assign(s,cyclePose(t));
  if(kind==='reload'){
    s.roll=sm(.05,.35,t)*(1-sm(2.4,2.72,t));s.lower=s.roll*.6;
    if(t<.55){s.leftTarget='mag';s.leftBlend=sm(.28,.52,t);}
    else if(t<1.05){s.leftTarget=t<.66?'mag':'pouch';s.leftBlend=t<.66?1:sm(.66,1,t);s.magState=t<.6?'in':'dropped';}
    else if(t<1.55){s.leftTarget='insert';s.leftBlend=1;s.magState='hand';s.magOffset=1-sm(1.3,1.52,t);if(t<1.3)s.leftBlend=sm(1.05,1.3,t);}
    else if(t<1.78){s.leftTarget='fore';s.leftBlend=1-sm(1.58,1.78,t);s.magState='in';}
    else if(t<1.78+CYCLE){Object.assign(s,cyclePose(t-1.78),{roll:s.roll,lower:s.lower});}
  }
  return s;
}

// ================= Braços em primeira pessoa =================
function makeHand(look,side){
  // mão com dedos articulados (3 falanges) e polegar; eixo +z = dedos, palma para −y
  const skin=new THREE.MeshStandardMaterial({color:look.skin,roughness:.6,flatShading:true}),root=new THREE.Group();
  const palm=new THREE.Mesh(new THREE.BoxGeometry(.078,.026,.085),skin);palm.position.z=.04;root.add(palm);
  const knuckle=new THREE.Mesh(new THREE.BoxGeometry(.078,.024,.02),skin);knuckle.position.set(0,.002,.085);root.add(knuckle);
  const fingers=[];for(let f=0;f<4;f++){let parent=root;const x=(-.029+f*.0195)*side,lens=[.036,.024,.02].map(l=>l*(f===3?.8:f===0?.95:1));const chain=[];
    for(let k=0;k<3;k++){const j=new THREE.Group();j.position.set(k?0:x,0,k?lens[k-1]:.092);const seg=new THREE.Mesh(new THREE.BoxGeometry(.0165,.017,lens[k]+.004),skin);seg.position.z=lens[k]/2;j.add(seg);parent.add(j);chain.push(j);parent=j;}
    const nail=new THREE.Mesh(new THREE.BoxGeometry(.012,.003,.01),new THREE.MeshStandardMaterial({color:new THREE.Color(look.skin).lerp(new THREE.Color(0xffe8e0),.5),roughness:.3}));nail.position.set(0,.009,lens[2]-.004);chain[2].add(nail);fingers.push(chain);}
  const t0=new THREE.Group();t0.position.set(.035*side,-.004,.03);t0.rotation.set(0,-.7*side,0);const ts=new THREE.Mesh(new THREE.BoxGeometry(.021,.02,.04),skin);ts.position.z=.02;t0.add(ts);const t1=new THREE.Group();t1.position.z=.04;const ts2=new THREE.Mesh(new THREE.BoxGeometry(.018,.018,.032),skin);ts2.position.z=.016;t1.add(ts2);t0.add(t1);root.add(t0);
  root.userData={fingers,thumb:[t0,t1]};return root;}
function curl(hand,amount,thumb=.6){for(const chain of hand.userData.fingers)chain.forEach((j,k)=>j.rotation.x=amount*(k?1.15:.9));const [t0,t1]=hand.userData.thumb;t0.rotation.x=thumb*.6;t1.rotation.x=thumb*.8;}
function makeArm(look){const sleeveColor=look.long?look.shirt:look.skin;const mat=new THREE.MeshStandardMaterial({color:sleeveColor,roughness:.85,flatShading:true});
  const upper=new THREE.Mesh(new THREE.CylinderGeometry(.052,.046,1,9).translate(0,.5,0),mat),fore=new THREE.Mesh(new THREE.CylinderGeometry(.044,.034,1,9).translate(0,.5,0),mat);
  const cuff=look.long?new THREE.Mesh(new THREE.CylinderGeometry(.042,.042,.03,9),new THREE.MeshStandardMaterial({color:look.shirtDark,roughness:.8,flatShading:true})):null;
  // camiseta: manga curta cobrindo só o começo do braço; antebraço de pele
  if(!look.long){fore.material=new THREE.MeshStandardMaterial({color:look.skin,roughness:.6,flatShading:true});upper.material=new THREE.MeshStandardMaterial({color:look.skin,roughness:.6,flatShading:true});}
  const sleeve=!look.long?new THREE.Mesh(new THREE.CylinderGeometry(.064,.06,.16,9).translate(0,.08,0),new THREE.MeshStandardMaterial({color:look.shirt,roughness:.85,flatShading:true})):null;
  const wrist=new THREE.Mesh(new THREE.BoxGeometry(.012,.012,.012),new THREE.MeshStandardMaterial({color:0x222222}));// relógio/pulseira no braço do gatilho (detalhe)
  return {upper,fore,cuff,sleeve,wrist};}
const _a=V(),_b=V(),_c=V(),_q=new THREE.Quaternion(),UP=V(0,1,0);
function place(mesh,a,b){const d=_c.copy(b).sub(a),len=d.length();mesh.position.copy(a);mesh.quaternion.setFromUnitVectors(UP,d.multiplyScalar(1/len));mesh.scale.set(1,len,1);}
// IK de dois ossos: ombro fixo, punho no alvo, cotovelo empurrado para o polo
export function twoBone(S,T,l1,l2,pole){const d=Math.min(T.distanceTo(S),l1+l2-1e-4),dir=_a.copy(T).sub(S).normalize();const cosA=(l1*l1+d*d-l2*l2)/(2*l1*d),sinA=Math.sqrt(Math.max(0,1-cosA*cosA));
  const bend=_b.copy(pole).sub(S);bend.addScaledVector(dir,-bend.dot(dir));if(bend.lengthSq()<1e-8)bend.set(0,-1,0);bend.normalize();return S.clone().addScaledVector(dir,l1*cosA).addScaledVector(bend,l1*sinA);}

// ================= Suporte no barco =================
export const RACK={x:-.93,z:-1.55,slots:[[-.95,-1.36],[-.95,-1.74]]};
export function addRack(parent){
  const kit=new Kit(),wood=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.8,flatShading:true});
  kit.add(wood,box([RACK.x+.02,.02,RACK.z],[.16,.08,.7]),0x6e4b2e,.05).add(wood,box([RACK.x+.04,.62,RACK.z],[.08,.06,.7]),0x8d6541,.05);
  for(const [x,z]of RACK.slots){kit.add(wood,box([x+.07,.62,z],[.03,.07,.06]),0x5a3c24,.03);}
  parent.add(kit.build());
  const rifles=RACK.slots.map(([x,z])=>{const r=makeRifle();r.rotation.x=-Math.PI/2+.08;r.rotation.z=.08;r.position.set(x+.05,.5,z);parent.add(r);return r;});
  return rifles;
}

// ================= Viewmodel (primeira pessoa, desenhado por cima de tudo) =================
// Fica numa cena própria que acompanha a câmera e é desenhada com o buffer de profundidade limpo:
// o cano nunca atravessa paredes, prateleiras ou o costado do barco.
function flashTexture(){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');const g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,250,220,1)');g.addColorStop(.25,'rgba(255,200,90,.9)');g.addColorStop(.6,'rgba(255,120,30,.25)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,128,128);
  x.globalCompositeOperation='lighter';for(let i=0;i<9;i++){const a=i/9*Math.PI*2+Math.random()*.3,l=40+Math.random()*24;x.strokeStyle='rgba(255,220,140,.8)';x.lineWidth=3+Math.random()*4;x.beginPath();x.moveTo(64,64);x.lineTo(64+Math.cos(a)*l,64+Math.sin(a)*l);x.stroke();}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
export class Viewmodel {
  constructor(camera){
    this.camera=camera;this.scene=new THREE.Scene();this.root=new THREE.Group();this.scene.add(this.root);
    this.hemi=new THREE.HemisphereLight(0xffcfab,0x193e49,1.4);this.sun=new THREE.DirectionalLight(0xffba69,2.5);this.sun.position.set(-1,1,-1);this.scene.add(this.hemi,this.sun,this.sun.target);
    this.holder=new THREE.Group();this.root.add(this.holder);this.gun=makeRifle();this.gun.rotation.y=Math.PI;this.holder.add(this.gun);this.gun.visible=false;
    this.aim=0;this.kick=new Spring(300,20);this.tilt=new Spring(240,18);this.side=new Spring(220,16);this.swayX=0;this.swayY=0;this.lastYaw=0;this.lastPitch=0;
    this.mode='idle';this.modeT=0;this.dropped=[];this.casings=[];this.look=null;this.arms=null;this.breath=0;
    // clarão: três planos cruzados com textura de estrela, brilho esférico e luz
    const ft=flashTexture(),fm=new THREE.MeshBasicMaterial({map:ft,color:new THREE.Color(4,3,1.8),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
    this.flash=new THREE.Group();for(let i=0;i<3;i++){const p=new THREE.Mesh(new THREE.PlaneGeometry(.34,.34),fm);if(i===1)p.rotation.y=Math.PI/2;if(i===2){p.rotation.x=Math.PI/2;p.scale.setScalar(.7);}this.flash.add(p);}
    const cone=new THREE.Mesh(new THREE.ConeGeometry(.05,.4,10,1,true).rotateX(Math.PI/2).translate(0,0,.2),new THREE.MeshBasicMaterial({map:ft,color:new THREE.Color(3,2,1),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));this.flash.add(cone);
    this.flash.position.copy(this.gun.userData.muzzle.position);this.flash.visible=false;this.gun.add(this.flash);this.flashMat=fm;
    this.light=new THREE.PointLight(0xffb060,0,3,2);this.light.position.set(0,.02,.8);this.gun.add(this.light);
    this.casingGeo=(()=>{const k=makeCartridge();return k.build().children[0].geometry;})();this.casingMat=new THREE.MeshStandardMaterial({color:0xd9a441,metalness:1,roughness:.25});
    this.onSound=null;
  }
  setLook(look){if(this.look===look)return;this.look=look;if(this.arms)for(const s of ['L','R'])for(const m of Object.values(this.arms[s]))if(m&&m.isObject3D)this.root.remove(m);
    this.arms={};for(const s of ['L','R']){const a=makeArm(look),hand=makeHand(look,s==='L'?1:-1);this.arms[s]={...a,hand};for(const m of [a.upper,a.fore,a.cuff,a.sleeve,hand])if(m)this.root.add(m);}this.arms.R.wrist.visible=false;}
  fire(){this.kick.kick(-10);this.tilt.kick(13);this.side.kick((Math.random()-.5)*6);this.flashT=0;this.flash.visible=true;this.flash.rotation.z=Math.random()*6;this.flash.scale.setScalar(.8+Math.random()*.5);this.mode='fired';this.modeT=0;}
  reload(){this.mode='reload';this.modeT=0;this.magSwapped=false;this.cycleEvents={};}
  emit(name){this.onSound?.(name);}
  update(dt,{visible,aiming,yaw,pitch,bob,moving=0,steady=false}){
    const show=visible;this.gun.visible=show;if(this.arms)for(const s of ['L','R'])for(const m of Object.values(this.arms[s]))if(m&&m.isObject3D)m.visible=show;
    // a cena do viewmodel segue a câmera
    this.camera.updateMatrixWorld();this.root.position.setFromMatrixPosition(this.camera.matrixWorld);this.root.quaternion.setFromRotationMatrix(this.camera.matrixWorld);this.root.updateMatrixWorld(true);
    this.updateCasings(dt);if(!show)return;
    this.modeT+=dt;const busy=this.mode==='reload'||this.mode==='cycle';
    if(this.mode==='fired'&&this.modeT>.14){this.mode='cycle';this.modeT=0;this.cycleEvents={};}
    const rig=this.mode==='cycle'?rigState('cycle',this.modeT):this.mode==='reload'?rigState('reload',this.modeT):rigState('idle',0);
    this.soundEvents(rig);
    if(this.mode==='cycle'&&this.modeT>=CYCLE)this.mode='idle';if(this.mode==='reload'&&this.modeT>=RELOAD)this.mode='idle';
    this.aim+=((aiming&&!busy?1:0)-this.aim)*(1-Math.exp(-dt*(aiming?11:15)));
    let dy=yaw-this.lastYaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));const dp=pitch-this.lastPitch;this.lastYaw=yaw;this.lastPitch=pitch;
    this.swayX+=(-dy*2.4-this.swayX)*(1-Math.exp(-dt*9));this.swayY+=(dp*2.2-this.swayY)*(1-Math.exp(-dt*9));
    const k=this.kick.update(0,dt),t=this.tilt.update(0,dt),sd=this.side.update(0,dt),a=this.aim,na=1-a*.85;
    // quadril: coronha baixa à direita; mira: ocular da luneta alinhada ao olho
    const hip=V(.19,-.235,-.4),ads=V(0,-this.gun.userData.scopeY,-.27);const pos=hip.lerp(ads,a);
    pos.x+=this.swayX*.05*na+Math.sin(bob)*.011*(1-a)+sd*.004+rig.roll*.04;pos.y+=Math.abs(Math.cos(bob))*.01*(1-a)-rig.lower*.12-moving*.01*(1-a);pos.z+=k*.013;
    this.holder.position.copy(pos);
    this.holder.rotation.set(-t*.014+this.swayY*.08*na+rig.lower*.4,this.swayX*.12*na+.05*(1-a)-rig.roll*.25,rig.roll*.75+sd*.01);
    poseRifle(this.gun,rig);
    // carregador: cai (vira objeto solto com gravidade), outro vem na mão esquerda e entra no encaixe
    const mag=this.gun.userData.mag;
    if(rig.magState==='dropped'&&!this.magSwapped){this.magSwapped=true;const drop=mag.clone();this.root.add(drop);mag.getWorldPosition(drop.position);this.root.worldToLocal(drop.position);drop.quaternion.copy(this.root.quaternion.clone().invert().multiply(mag.getWorldQuaternion(_q)));this.dropped.push({o:drop,v:V(-.2,-.4,.1),w:V(3,1,2),t:0});mag.visible=false;}
    if(rig.magState==='hand'||rig.magState==='in')mag.visible=true;
    this.gun.updateMatrixWorld(true);
    // mãos
    if(this.arms)this.poseArms(rig,dt);
    // clarão
    if(this.flashT!==undefined){this.flashT+=dt;const f=Math.max(0,1-this.flashT*16);this.flashMat.opacity=f;this.flash.children[3].material.opacity=f;this.light.intensity=f*8;if(f<=0)this.flash.visible=false;}
    for(const d of [...this.dropped]){d.t+=dt;d.v.y-=4*dt;d.o.position.addScaledVector(d.v,dt);d.o.rotation.x+=d.w.x*dt;d.o.rotation.z+=d.w.z*dt;if(d.t>1.2){this.root.remove(d.o);this.dropped.splice(this.dropped.indexOf(d),1);}}
  }
  soundEvents(rig){const e=this.cycleEvents||(this.cycleEvents={}),t=this.modeT,m=this.mode;const once=(key,cond,name,fn)=>{if(cond&&!e[key]){e[key]=true;this.emit(name);fn?.();}};
    const base=m==='reload'?1.78:0,ct=t-base;
    if(m==='cycle'||(m==='reload'&&ct>=0)){once('up',ct>.12,'boltUp');once('back',ct>.22,'boltBack',()=>{if(m==='cycle')this.eject();});once('fwd',ct>.33,'boltFwd');once('down',ct>.45,'boltDown');}
    if(m==='reload'){once('rel',t>.58,'magOut');once('drop',t>.95,'magDrop');once('pouch',t>1.05,'pouch');once('in',t>1.5,'magIn');once('slap',t>1.56,'magSlap');}}
  eject(){const port=this.gun.userData.port,p=port.getWorldPosition(V());this.root.worldToLocal(p);const c=new THREE.Mesh(this.casingGeo,this.casingMat);c.position.copy(p);this.root.add(c);
    this.casings.push({o:c,v:V(.9+Math.random()*.4,.9+Math.random()*.5,.25),w:V(20*Math.random(),25,10*Math.random()),t:0});}
  updateCasings(dt){for(const c of [...this.casings]){c.t+=dt;c.v.y-=5.5*dt;c.o.position.addScaledVector(c.v,dt);c.o.rotation.x+=c.w.x*dt;c.o.rotation.y+=c.w.y*dt;if(c.t>.9){if(!c.clink){c.clink=true;this.emit('casing');}this.root.remove(c.o);this.casings.splice(this.casings.indexOf(c),1);}}}
  poseArms(rig,dt){
    const g=this.gun.userData,toLocal=o=>this.root.worldToLocal(o.getWorldPosition(V()));
    const gunQ=this.root.quaternion.clone().invert().multiply(this.gun.getWorldQuaternion(new THREE.Quaternion()));
    // orientação da mão a partir de uma base no espaço do rifle: x, y (costas da mão) e z (dedos)
    const basis=(x,y,z)=>gunQ.clone().multiply(new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(...x).normalize(),V(...y).normalize(),V(...z).normalize())));
    const GRIP=basis([0,.5,.85],[-1,0,0],[0,-.85,.5]),FORE=basis([0,0,1],[0,-1,0],[1,0,0]),KNOB=basis([0,1,0],[-1,0,0],[0,0,1]);
    // mão direita (gatilho): punho ↔ bola do ferrolho
    let rp=toLocal(g.gripW),rq=GRIP;
    if(rig.rightToBolt>0){rp.lerp(toLocal(g.knobW),rig.rightToBolt);rq=rq.clone().slerp(KNOB,rig.rightToBolt);}
    // mão esquerda: guarda-mão ↔ carregador ↔ bolso (fora da tela) ↔ encaixe
    let lp=toLocal(g.foreW),lq=FORE;
    if(rig.leftBlend>0){let tp;
      if(rig.leftTarget==='mag')tp=toLocal(g.magW);
      else if(rig.leftTarget==='pouch')tp=V(-.12,-.5,-.2);
      else tp=toLocal(g.magW).add(V(0,-rig.magOffset*.09,0).applyQuaternion(gunQ));
      lp.lerp(tp,rig.leftBlend);}
    const mag=g.mag;if(rig.magState==='hand'){mag.position.copy(g.magHome).add(V(0,-rig.magOffset*.09,0));}else mag.position.copy(g.magHome);
    const shoulders={R:V(.21,-.32,.16),L:V(-.2,-.34,.1)},poles={R:V(.7,-.8,.1),L:V(-.8,-.7,.0)};
    for(const [s,p,q,curlAmt,thumb]of [['R',rp,rq,rig.rightToBolt>.5?.55:.95,.9],['L',lp,lq,rig.leftTarget==='pouch'&&rig.leftBlend>.6?1.1:.85,.4]]){const arm=this.arms[s];arm.hand.position.copy(p);arm.hand.quaternion.copy(q);curl(arm.hand,curlAmt,thumb);
      const wrist=p.clone(),S=shoulders[s].clone().add(V(0,-.02*this.aim,0)),E=twoBone(S,wrist,.3,.29,S.clone().add(poles[s]));
      place(arm.upper,S,E);place(arm.fore,E,wrist.clone().add(V(0,0,-.015).applyQuaternion(q)));if(arm.sleeve)place(arm.sleeve,S,S.clone().lerp(E,.5));if(arm.cuff){arm.cuff.position.copy(wrist.clone().lerp(E,.1));arm.cuff.quaternion.copy(arm.fore.quaternion);}}
  }
}
// Traçante do tiro, visível para todos.
export class ShotFX {
  constructor(scene){this.scene=scene;this.tracers=[];this.mat=new THREE.LineBasicMaterial({color:new THREE.Color(4,3,1.6),transparent:true,opacity:1,blending:THREE.AdditiveBlending,depthWrite:false});}
  tracer(from,to){const g=new THREE.BufferGeometry().setFromPoints([from,to]);const l=new THREE.Line(g,this.mat.clone());l.frustumCulled=false;this.scene.add(l);this.tracers.push({l,t:0});}
  update(dt){for(const tr of [...this.tracers]){tr.t+=dt;tr.l.material.opacity=Math.max(0,1-tr.t*9);if(tr.t>.15){this.scene.remove(tr.l);tr.l.geometry.dispose();this.tracers.splice(this.tracers.indexOf(tr),1);}}}
}

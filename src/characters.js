import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {JOINTS,faceMaterial} from './models.js';
import {Kit,loft,limb,ellipsoid,box,sculpt,sweep,paint,tint,reseed,V} from './geometry.js';

// Personagens esculpidos em código, low poly detalhado. O esqueleto (JOINTS) é o mesmo do ragdoll,
// e a cabeça mantém o espaço usado pela projeção da foto (olhos em y=1,638, x=±0,061).
const LOOKS=[
  {name:'Pescador vermelho',skin:0xc68f71,hair:0x241a17,shirt:0xa3241c,shirtDark:0x7e1a14,trim:0xf1ece2,pants:0x2b2d31,sock:0xefede6,shoe:0x1d1f22,sole:0xf2f0ea,top:'tee',emblem:true},
  {name:'Pescador azul',skin:0xd7aa90,hair:0x4a382c,shirt:0x213b52,shirtDark:0x182c3e,trim:0x0f1012,pants:0x25324a,sock:0x2b2d31,shoe:0x2a2c30,sole:0xe9e6de,top:'jacket',long:true,longPants:true},
  // Boné preto virado para trás, camiseta branca estampada, fone com fio e bermuda jeans
  {name:'Pescador de boné',skin:0xb47b58,hair:0x17110e,shirt:0xe9e7e1,shirtDark:0xc9c6bd,trim:0xf4f2ec,pants:0x44587a,sock:0xefede6,shoe:0x26282c,sole:0xf2f0ea,top:'tee',print:true,cap:{color:0x15171b,back:true},earphones:true},
  // Boné trucker branco com emblema, camisa jeans de manga longa lavada, calça escura
  {name:'Pescador do trucker',skin:0xc7987a,hair:0x2a1d16,shirt:0x2a3a58,shirtDark:0x1d2940,trim:0xcfc4ae,pants:0x26282e,sock:0x2b2d31,shoe:0xe7e3da,sole:0x2a2c30,top:'denim',long:true,longPants:true,cap:{color:0xf1efe9,mesh:0x16181c,patch:true}},
];
const S=v=>new THREE.Vector3(...v);
function mirror(fn){return [fn(-1),fn(1)];}
function hairShell(look,index){
  // Casca de cabelo: esfera maior com o rosto, as orelhas e a nuca recortados; mechas por deslocamento.
  const g=new THREE.SphereGeometry(1,26,18).toNonIndexed(),p=g.attributes.position,keep=[];
  const clump=(x,y,z)=>1+.07*Math.sin(x*57+1.3)*Math.sin(y*43+.7)*Math.sin(z*51+2.1)+.03*Math.sin(x*140+y*120);
  const R=[.134,.176,.152],C=[0,1.645,-.012];
  for(let i=0;i<p.count;i+=3){let cy=0,cz=0,cx=0;const tri=[];for(let j=0;j<3;j++){const x=p.getX(i+j)*R[0],y=p.getY(i+j)*R[1],z=p.getZ(i+j)*R[2];const k=clump(x,y,z);tri.push([C[0]+x*k,C[1]+y*k,C[2]+z*k]);cx+=C[0]+x;cy+=C[1]+y;cz+=C[2]+z;}
    cx/=3;cy/=3;cz/=3;
    const hairline=[1.735,1.742,1.725,1.73][index]??1.74,face=cz>.015&&cy<hairline+(Math.abs(cx)>.07?-.05:0),ear=Math.abs(cx)>.09&&cy<1.655&&cz>-.07,nape=cy<(cz<0?1.515:1.6);
    if(face||ear||nape)continue;keep.push(...tri.flat());}
  const out=new THREE.BufferGeometry();out.setAttribute('position',new THREE.Float32BufferAttribute(keep,3));out.computeVertexNormals();return out;
}
function headGeometry(){
  // Crânio esculpido: mandíbula afinando, queixo, nuca, testa, órbitas e nariz (o nariz recebe a foto e dá relevo).
  const g=new THREE.SphereGeometry(1,30,22);
  sculpt(g,v=>{let {x,y,z}=v;
    if(y<0){const k=Math.pow(-y,1.4);x*=1-.3*k;z*=1-.12*k*(z<0?1.4:0);if(z>0)z+=.05*k;}
    if(z<0)z*=1.1;if(z>0&&y>.15)z*=.94;
    x*=.123;y*=.168;z*=.138;
    const nose=Math.exp(-((x/.028)**2+((y+.045)/.034)**2))*(z>0?1:0);z+=nose*.03;
    for(const s of [-1,1]){const eye=Math.exp(-(((x-s*.061)/.028)**2+((y-.013)/.018)**2))*(z>0?1:0);z-=eye*.009;}
    const brow=Math.exp(-(((y-.04)/.02)**2))*(z>0?1:0)*Math.exp(-((x/.09)**2));z+=brow*.006;
    v.set(x,y+1.625,z+.006);});
  g.translate(0,-JOINTS.head.origin[1],0);return g;
}
function hand(kit,mat,side,look,wrist,down){
  // Palma + quatro dedos levemente curvados + polegar.
  const w=S(wrist),palm=w.clone().addScaledVector(down,.05);
  kit.add(mat,ellipsoid([palm.x,palm.y,palm.z],[.026,.05,.042],8,6),look.skin);
  for(let f=0;f<4;f++){const z=.028-f*.018,base=palm.clone().add(V(side*.004,-.04,z));const mid=base.clone().add(V(side*.004,-.028,.006));const tip=mid.clone().add(V(0,-.022,.012));
    kit.add(mat,limb(base,mid,.0085,.0078,5),look.skin).add(mat,limb(mid,tip,.0078,.0065,5),look.skin);}
  const tb=palm.clone().add(V(-side*.014,-.012,.03)),tt=tb.clone().add(V(-side*.012,-.03,.022));kit.add(mat,limb(tb,tt,.01,.008,5),look.skin);
}
function shoe(kit,mat,look,side){
  const x=side*.11;
  kit.add(mat,loft([{z:-.06,cx:x,cy:.018,rx:.045,rz:.018,pow:3},{z:.02,cx:x,cy:.018,rx:.052,rz:.02,pow:3},{z:.13,cx:x,cy:.018,rx:.05,rz:.02,pow:3},{z:.19,cx:x,cy:.02,rx:.035,rz:.016,pow:2.5}],{axis:'z',n:12}),look.sole);
  kit.add(mat,loft([{z:-.055,cx:x,cy:.07,rx:.042,rz:.045,pow:2.6},{z:.02,cx:x,cy:.075,rx:.05,rz:.05,pow:2.6},{z:.11,cx:x,cy:.052,rx:.048,rz:.03,pow:2.6},{z:.18,cx:x,cy:.04,rx:.033,rz:.02,pow:2.2}],{axis:'z',n:12}),look.shoe);
  for(let i=0;i<3;i++)kit.add(mat,box([x,.086-i*.009,.035+i*.025],[.05,.006,.008],[-.5,0,0]),look.sole,.02);
}
export function makeCharacter(assets,index){
  const look=LOOKS[index],root=new THREE.Group(),joints={};root.name=look.name;reseed(index+1);
  const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.78,metalness:0,flatShading:true});
  const kits=Object.fromEntries(Object.keys(JOINTS).map(k=>[k,new Kit()]));
  const shirt=look.shirt,jacket=look.top==='jacket',longSleeve=!!look.long,longPants=!!look.longPants;
  // ---------- Torso ----------
  const T=kits.torso;
  T.add(mat,loft([{y:.8,rx:.158,rz:.1},{y:.9,rx:.165,rz:.108},{y:1.0,rx:.16,rz:.104}],{n:16,capStart:true,capEnd:false}),look.pants);
  const body=[{y:.98,rx:.162,rz:.106},{y:1.06,rx:.155,rz:.1},{y:1.14,rx:.168,rz:.11,front:.08},{y:1.23,rx:.186,rz:.122,front:.12},{y:1.3,rx:.19,rz:.118,front:.06},{y:1.36,rx:.158,rz:.1},{y:1.405,rx:.078,rz:.066}];
  const printFn=(v,c)=>{if(look.print&&c.z>.07&&c.y>1.06&&c.y<1.3&&Math.abs(c.x)<.12&&Math.sin(c.x*70+Math.sin(c.y*40)*2)*Math.sin(c.y*55)>-.1)return 0x3a3b3f;return c.y<1.0?look.shirtDark:shirt;};
  T.add(mat,paint(loft(jacket||look.top==='denim'?body.map(r=>({...r,rx:r.rx+.01,rz:r.rz+.01})):body,{n:18}),printFn,look.top==='denim'?.16:.05));
  T.add(mat,limb(V(0,1.36,0),V(0,1.52,.005),.052,.047,10),look.skin);
  if(!jacket){
    T.add(mat,new THREE.TorusGeometry(.07,.013,5,16).rotateX(Math.PI/2).translate(0,1.39,.005),look.trim);
    if(look.emblem)T.add(mat,ellipsoid([.075,1.265,.135],[.02,.024,.006],8,6),0xe8d9a8);
    if(look.top==='denim'){T.add(mat,box([0,1.2,.13],[.012,.34,.006],[-.08,0,0]),look.trim,.03);for(let i=0;i<5;i++)T.add(mat,ellipsoid([0,1.34-i*.07,.137-i*.004],[.007,.007,.004],5,3),0xd8d0bd);for(const s of [-1,1])T.add(mat,box([s*.085,1.25,.132],[.07,.075,.008],[-.1,0,0]),look.shirtDark,.1);}
    T.add(mat,paint(loft([{y:.97,rx:.168,rz:.112},{y:1.0,rx:.168,rz:.112}],{n:18,capStart:false,capEnd:false}),()=>look.shirtDark));
  }else{
    T.add(mat,box([0,1.2,.128],[.07,.36,.012],[-.08,0,0]),look.trim);
    for(const s of [-1,1]){T.add(mat,box([s*.042,1.2,.135],[.008,.36,.006],[-.08,0,0]),0x9aa3ab,.02);
      T.add(mat,limb(V(s*.03,1.37,.12),V(s*.036,1.2,.14),.0045,.004,4),0xe8e6df);T.add(mat,box([s*.036,1.195,.141],[.012,.02,.012]),0xc9c1b0);
      T.add(mat,box([s*.11,1.02,.115],[.07,.06,.015],[-.1,s*.25,0]),look.shirtDark);}
    T.add(mat,sculpt(ellipsoid([0,1.39,-.1],[.15,.07,.085],12,8),v=>{v.z-=Math.max(0,v.y-1.39)*.4;}),look.shirtDark);
    T.add(mat,new THREE.TorusGeometry(.09,.02,6,16,Math.PI*1.2).rotateX(Math.PI/2).rotateY(Math.PI*1.4).translate(0,1.4,-.005),look.shirt);
  }
  // ---------- Cabeça ----------
  const H=kits.head;
  for(const s of [-1,1]){H.add(mat,sculpt(ellipsoid([s*.123,1.625,-.012],[.018,.04,.028],8,6),v=>{v.z+=(v.y-1.625)*-.15;}),look.skin);
    H.add(mat,ellipsoid([s*.127,1.622,-.008],[.008,.022,.014],6,4),new THREE.Color(look.skin).multiplyScalar(.75));}
  H.add(mat,paint(hairShell(look,index),v=>new THREE.Color(look.hair).multiplyScalar(.85+.3*Math.max(0,(v.y-1.6)*3)),.08));
  if(index===0){
    H.add(mat,sculpt(ellipsoid([-.015,1.785,.06],[.115,.052,.085],12,8),v=>{v.y+=Math.max(0,v.z-.06)*.5;v.x+=Math.max(0,v.z-.06)*-.4;}),look.hair,.1);
    for(const s of [-1,1])H.add(mat,box([s*.124,1.6,.03],[.012,.06,.022]),look.hair,.05);
  }else if(index===1){
    for(let i=0;i<6;i++){const x=-.085+i*.034;H.add(mat,sculpt(ellipsoid([x,1.748-Math.abs(x)*.25,.1-Math.abs(x)*.25],[.026,.034,.03],6,5),v=>{v.y-=Math.max(0,v.z-.1)*.6;}),look.hair,.1);}
  }
  if(look.cap){
    // Boné: copa em seis gomos (esfera achatada cortada), aba curva e botão; trucker com tela atrás e emblema
    const c=look.cap,crown=new THREE.SphereGeometry(1,18,10,0,Math.PI*2,0,Math.PI*.52).toNonIndexed();crown.scale(.142,.118,.158);crown.translate(0,1.7,-.005);
    const dir=c.back?-1:1;
    H.add(mat,paint(crown,(v,ce)=>c.mesh&&ce.z*dir<-.02?c.mesh:c.color,.05));
    const brim=new THREE.CylinderGeometry(.12,.12,.012,14,1,false,-Math.PI*.45,Math.PI*.9).toNonIndexed();brim.scale(1.05,1,1.1);sculpt(brim,v=>{v.y-=Math.pow(Math.abs(v.x)/.12,2)*.018;});if(dir<0)brim.rotateY(Math.PI);brim.rotateX(dir*.12);brim.translate(0,1.705,dir*.1);
    H.add(mat,brim,c.back?c.color:c.mesh||c.color,.03);
    H.add(mat,ellipsoid([0,1.82,-.005],[.014,.008,.014],6,4),c.mesh||c.color);
    if(c.patch){H.add(mat,new THREE.CircleGeometry(.045,16).translate(0,1.765,.142).rotateX(-.35),0xf4f2ec,.02);H.add(mat,new THREE.TorusGeometry(.04,.005,4,18).rotateX(-.35).translate(0,1.765,.143),0x121316,.02);H.add(mat,box([0,1.765,.147],[.028,.028,.004],[-.35,0,Math.PI/4]),0x121316,.02);}
    if(c.back){H.add(mat,box([0,1.695,.135],[.07,.018,.012],[-.2,0,0]),0x0d0e10,.02);for(let i=0;i<4;i++)H.add(mat,ellipsoid([-.024+i*.016,1.725,.13],[.012,.022,.014],5,4),look.hair,.1);}
  }
  if(look.earphones){
    // fones intra-auriculares brancos com fio descendo pelo pescoço até o peito
    for(const s of [-1,1])H.add(mat,ellipsoid([s*.128,1.61,.01],[.012,.012,.012],6,4),0xf2f2f0,.02);
    for(const s of [-1,1])T.add(mat,sweep([V(s*.125,1.6,.01),V(s*.1,1.5,.05),V(s*.07,1.4,.1),V(s*.04,1.3,.13),V(0,1.2,.14)],.005,.005),0xefefec,.02);
    T.add(mat,sweep([V(0,1.2,.14),V(.01,1.1,.13),V(.03,1.02,.12)],.005,.005),0xefefec,.02);
  }
  // ---------- Braços ----------
  for(const s of [-1,1]){const k=s<0?'L':'R',A=kits['arm'+k],F=kits['fore'+k];
    const sh=V(s*.215,1.31,0),el=V(s*.33,1.083,0),wr=V(s*.405,.855,.02),down=wr.clone().sub(el).normalize();
    A.add(mat,ellipsoid([s*.2,1.3,0],[.074,.068,.074],10,8),shirt);
    A.add(mat,limb(sh,el,.064,.052,9),look.skin);
    if(longSleeve)A.add(mat,limb(sh,el,.078,.068,9),shirt,look.top==='denim'?.14:.06);else{A.add(mat,limb(sh,sh.clone().lerp(el,.55),.08,.074,9),shirt);A.add(mat,limb(sh.clone().lerp(el,.52),sh.clone().lerp(el,.58),.076,.076,9),look.shirtDark);}
    F.add(mat,ellipsoid([el.x,el.y,el.z],[.053,.053,.053],8,6),longSleeve?shirt:look.skin);
    F.add(mat,limb(el,wr,.051,.039,9),look.skin);
    if(longSleeve){F.add(mat,limb(el,el.clone().lerp(wr,.82),.068,.06,9),shirt,look.top==='denim'?.14:.06);F.add(mat,limb(el.clone().lerp(wr,.8),el.clone().lerp(wr,.9),.056,.056,9),look.shirtDark);}
    hand(F,mat,s,look,[wr.x,wr.y,wr.z],down);
  }
  // ---------- Pernas ----------
  for(const s of [-1,1]){const k=s<0?'L':'R',Th=kits['thigh'+k],Sh=kits['shin'+k];
    const hip=V(s*.095,.9,0),knee=V(s*.105,.574,.01),ankle=V(s*.11,.085,-.005);
    Th.add(mat,limb(hip,knee,.095,.068,10),look.skin);
    if(longPants)Th.add(mat,limb(hip,knee,.103,.078,10),look.pants);else{Th.add(mat,limb(hip,hip.clone().lerp(knee,.82),.108,.096,10),look.pants);}
    Sh.add(mat,ellipsoid([knee.x,knee.y,knee.z+.01],[.058,.06,.06],8,6),longPants?look.pants:look.skin);
    Sh.add(mat,limb(knee,ankle,.062,.042,9),look.skin);
    Sh.add(mat,ellipsoid([knee.x,.42,-.022],[.056,.11,.05],8,6),longPants?look.pants:look.skin);
    if(longPants){Sh.add(mat,limb(knee,ankle.clone().add(V(0,.03,0)),.078,.07,10),look.pants);}
    else Sh.add(mat,limb(V(ankle.x,.09,ankle.z),V(ankle.x,.2,ankle.z),.043,.041,9),look.sock);
    shoe(Sh,mat,look,s);
  }
  for(const [key,d]of Object.entries(JOINTS)){const g=kits[key].build({origin:d.origin});g.name=key;const parent=d.parent?JOINTS[d.parent].origin:[0,0,0];g.position.fromArray(d.origin.map((v,i)=>v-parent[i]));joints[key]=g;(d.parent?joints[d.parent]:root).add(g);}
  // Rosto: crânio suavizado com a foto projetada
  const skinMat=new THREE.MeshStandardMaterial({color:look.skin});skinMat.color.set(look.skin);
  const face=new THREE.Mesh(headGeometry(),faceMaterial(assets,index,skinMat));face.name='Rosto fotografico';face.castShadow=true;face.receiveShadow=true;joints.head.add(face);
  // Vara articulada em segmentos: dobra de verdade com a tensão da linha
  const rod=new THREE.Group(),segs=[],rodMat=new THREE.MeshStandardMaterial({color:0x1d2320,roughness:.35,metalness:.4,flatShading:true});
  const handle=new THREE.Mesh(new THREE.CylinderGeometry(.016,.018,.3,7),new THREE.MeshStandardMaterial({color:0x8a6a45,roughness:.9,flatShading:true}));handle.position.y=.02;rod.add(handle);
  const reel=new THREE.Group(),metal=new THREE.MeshStandardMaterial({color:0x9aa1a6,metalness:.85,roughness:.28,flatShading:true});
  const spool=new THREE.Mesh(new THREE.CylinderGeometry(.038,.038,.034,12),metal);spool.rotation.z=Math.PI/2;reel.add(spool);
  const crank=new THREE.Group(),arm=new THREE.Mesh(new THREE.BoxGeometry(.008,.05,.008),metal);arm.position.y=.025;crank.add(arm);const knob=new THREE.Mesh(new THREE.SphereGeometry(.009,6,4),new THREE.MeshStandardMaterial({color:0x222222}));knob.position.set(.012,.05,0);crank.add(knob);crank.position.x=.022;reel.add(crank);
  reel.position.set(0,.1,.045);rod.add(reel);
  let parent=rod,y=.17;for(let i=0;i<6;i++){const seg=new THREE.Group();seg.position.y=i===0?y:.32;const len=.32,r0=.012-i*.0016,r1=.012-(i+1)*.0016;const m=new THREE.Mesh(new THREE.CylinderGeometry(Math.max(r1,.0022),Math.max(r0,.0025),len,6),rodMat);m.position.y=len/2;seg.add(m);
    const guide=new THREE.Mesh(new THREE.TorusGeometry(.008-i*.0008,.0015,4,8),metal);guide.position.set(0,len*.9,.012);seg.add(guide);parent.add(seg);segs.push(seg);parent=seg;}
  const tip=new THREE.Object3D();tip.position.y=.32;parent.add(tip);
  // empunhadura: a vara continua o antebraço e aponta para frente e para cima na pose de pesca
  rod.rotation.x=2.35;rod.position.set(-.078,-.29,.035);joints.foreL.add(rod);rod.visible=false;
  root.userData={joints,rod,tip,index,face,rodSegs:segs,crank,look};return root;
}
export {LOOKS};

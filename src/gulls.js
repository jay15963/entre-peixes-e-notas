import * as THREE from 'three';
import {Kit,loft,limb,ellipsoid,box,sculpt,paint,V as VV} from './geometry.js';
import {makeCatch} from './fish.js';

// Gaivotas ladras. Coordenadas no espaço do barco; o anfitrião simula e os demais interpolam.
// Regra clara: circulando lá no alto elas NÃO podem ser atingidas. Só a ladra pode — quando mergulha
// para o balde, quando paira pegando o peixe e quando foge carregando o peixe (pesada, devagar).
export const STATES=['away','circle','dive','grab','flee','dead'];
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
export const GULL_RADIUS=.55;
const CIRCLE_H=27,DIVE_SPEED=8.5,FLEE_SPEED=3.4,ESCAPE=46;
// ---------- modelo ----------
const MAT=()=>new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.75,side:THREE.DoubleSide});
function wingHalf(inner,side){
  // asa como placa fina com borda de ataque grossa e borda de fuga serrilhada (penas)
  const pts=inner?[[0,.08],[.34,.07],[.34,-.12],[.28,-.15],[.22,-.12],[.16,-.16],[.1,-.13],[.04,-.16],[0,-.13]]:[[0,.07],[.2,.05],[.42,-.02],[.44,-.05],[.38,-.07],[.3,-.06],[.26,-.1],[.2,-.08],[.14,-.12],[.08,-.1],[0,-.12]];
  const shape=new THREE.Shape(pts.map(([x,z])=>new THREE.Vector2(x,z)));const g=new THREE.ExtrudeGeometry(shape,{depth:.012,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,.006,0);
  if(side<0)g.scale(-1,1,1);
  return paint(g,(v,c)=>{const x=Math.abs(c.x);if(!inner&&x>.26){const spot=Math.hypot(x-.36,c.z+.02)<.03;return spot?0xf4f4f0:0x18191b;}return c.y>.004?(c.z>.03?0xa9b3bb:0x8f9aa3):0xeef0ee;},.04);
}
export function makeGull(){
  const root=new THREE.Group(),body=new THREE.Group();root.add(body);const mat=MAT(),k=new Kit();
  k.add(mat,paint(loft([{z:-.26,cy:.01,rx:.02,rz:.015},{z:-.16,cy:0,rx:.07,rz:.06},{z:0,cy:0,rx:.1,rz:.09},{z:.14,cy:.02,rx:.085,rz:.08},{z:.22,cy:.05,rx:.05,rz:.055}],{axis:'z',n:12}),(v,c)=>c.y>.03&&c.z<.14?0x96a1a9:0xf6f6f2,.03));
  k.add(mat,ellipsoid([0,.075,.25],[.058,.06,.07],10,8),0xf8f8f4,.02);
  k.add(mat,loft([{z:.3,cy:.07,rx:.018,rz:.02},{z:.36,cy:.068,rx:.012,rz:.014},{z:.39,cy:.06,rx:.006,rz:.009}],{axis:'z',n:8}),0xf2c230,.03);
  k.add(mat,ellipsoid([0,.058,.35],[.009,.007,.008],6,4),0xd82a1e,.02);// mancha vermelha do bico
  k.add(mat,sculpt(new THREE.ConeGeometry(.006,.02,5).rotateX(Math.PI/2),()=>{}).translate(0,.052,.395),0xe0b020);
  for(const s of [-1,1]){k.add(mat,ellipsoid([s*.045,.092,.28],[.012,.012,.012],6,4),0xf2e3a0,.02);k.add(mat,ellipsoid([s*.052,.093,.285],[.007,.008,.007],6,4),0x0a0a0a,.02);}
  // cauda em leque com a ponta branca
  const tail=new THREE.Shape([[0,0],[.07,-.02],[.08,-.12],[0,-.14],[-.08,-.12],[-.07,-.02]].map(([x,z])=>new THREE.Vector2(x,z)));const tg=new THREE.ExtrudeGeometry(tail,{depth:.01,bevelEnabled:false});tg.rotateX(Math.PI/2);tg.translate(0,.02,-.2);k.add(mat,paint(tg,(v,c)=>c.z<-.3?0xffffff:0xe8ebea,.03));
  body.add(k.build());
  // patas (recolhidas no voo, estendidas ao pegar o peixe)
  const legs=new THREE.Group();const lk=new Kit();for(const s of [-1,1]){lk.add(mat,limb(VV(s*.03,-.04,-.02),VV(s*.035,-.12,-.03),.008,.006,5),0xe89a7a);lk.add(mat,sculpt(new THREE.ConeGeometry(.025,.04,3).rotateX(Math.PI/2),()=>{}).translate(s*.035,-.125,0),0xe89a7a);}legs.add(lk.build());body.add(legs);
  // asas articuladas: ombro → punho
  const wings=[];for(const s of [-1,1]){const inner=new THREE.Group();inner.position.set(s*.07,.05,.04);const ik=new Kit();ik.add(mat,wingHalf(true,s));inner.add(ik.build());const outer=new THREE.Group();outer.position.set(s*.33,0,0);const ok=new Kit();ok.add(mat,wingHalf(false,s));outer.add(ok.build());inner.add(outer);body.add(inner);wings.push({inner,outer,s});}
  const fish=makeCatch(0);fish.scale.setScalar(.9);fish.rotation.set(0,Math.PI/2,Math.PI/2);fish.position.set(0,-.02,.42);fish.visible=false;body.add(fish);
  root.traverse(o=>{if(o.isMesh){o.castShadow=true;}});
  root.userData={body,wings,legs,fish};return root;
}
// Asas: batida com atraso entre braço e mão, planeio, mergulho com asas dobradas e pairar
function poseWings(g,{flap,fold=0,hover=0,glide=0}){for(const w of g.userData.wings){const s=w.s,a=Math.sin(flap),b=Math.sin(flap-.9);
  w.inner.rotation.z=s*(a*.75*(1-glide)+.08*glide)*(1-fold);w.outer.rotation.z=s*(b*.55*(1-glide)+.1*glide)*(1-fold)+s*fold*.3;
  w.inner.rotation.y=s*(-fold*1.05+hover*a*.35);w.outer.rotation.y=s*(-fold*1.2);w.inner.rotation.x=hover*(.4+a*.2);}}
// ---------- bando ----------
export class GullFlock {
  constructor(parent,bucket,count=4){
    this.parent=parent;this.bucket=bucket.clone().add(V(0,.35,0));this.gulls=[];
    for(let i=0;i<count;i++){const mesh=makeGull();mesh.scale.setScalar(1.35);mesh.visible=false;parent.add(mesh);
      this.gulls.push({id:i,state:'away',t:5+i*4+Math.random()*5,pos:V(0,CIRCLE_H,-60),vel:V(),seed:Math.random()*100,fish:false,mesh,target:V(0,CIRCLE_H,-60),spin:0,flap:Math.random()*6});}
    this.events=[];
  }
  thief(g){return g.state==='dive'||g.state==='grab'||(g.state==='flee'&&g.fish);}
  // ---------- simulação (anfitrião) ----------
  simulate(dt,{active,bucketCount,time,water}){
    const thieves=this.gulls.filter(g=>this.thief(g)&&g.state!=='flee').length,maxThieves=bucketCount>=5?2:1;
    for(const g of this.gulls){g.t-=dt;const p=g.pos;
      if(g.state==='away'){if(g.t<=0&&active){g.state='circle';g.t=5+Math.random()*6;const a=Math.random()*6.283;p.set(Math.cos(a)*60,CIRCLE_H+6,Math.sin(a)*60);g.vel.set(-Math.cos(a)*7,0,-Math.sin(a)*7);}continue;}
      if(g.state==='circle'){const a=time*.28+g.seed,r=19+Math.sin(g.seed)*4;const goal=V(Math.cos(a)*r,CIRCLE_H+Math.sin(time*.5+g.seed)*2.5+(g.id%2)*3,Math.sin(a)*r);this.steer(g,goal,8,dt,1.6);
        if(!active){g.state='flee';g.t=0;continue;}
        if(g.t<=0){if(bucketCount>0&&thieves<maxThieves){g.state='dive';g.t=9;this.events.push({name:'dive',gull:g.id});}else g.t=3+Math.random()*5;}}
      else if(g.state==='dive'){const d=this.bucket.clone().sub(p),dist=d.length();const side=V(-d.z,0,d.x).normalize();
        // descida longa e legível, com um leve zigue-zague que some perto do balde
        const weave=Math.min(1,dist/14)*1.4,goal=this.bucket.clone().addScaledVector(side,Math.sin(time*2.2+g.seed)*weave);
        this.steer(g,goal,DIVE_SPEED,dt,3.2);if(dist<1){g.state='grab';g.t=1.15;}if(g.t<=0||!active||bucketCount<=0){g.state='flee';}}
      else if(g.state==='grab'){p.lerp(this.bucket.clone().add(V(0,.3,0)),1-Math.exp(-dt*8));g.vel.multiplyScalar(.8);
        if(g.t<=0){if(bucketCount>0&&!g.fish){g.fish=true;bucketCount--;this.events.push({name:'stolen',gull:g.id});}g.state='flee';const a=Math.random()*6.283;g.vel.set(Math.cos(a)*2,1.2,Math.sin(a)*2);g.fleeDir=a;}}
      else if(g.state==='flee'){
        // com o peixe no bico ela fica pesada: voa devagar e sobe aos poucos (dá tempo de mirar)
        if(g.fish){const a=g.fleeDir??Math.atan2(p.z,p.x);const goal=V(Math.cos(a)*(Math.hypot(p.x,p.z)+12),Math.min(CIRCLE_H*.7,p.y+4),Math.sin(a)*(Math.hypot(p.x,p.z)+12)).add(V(Math.sin(time*1.3+g.seed)*1.5,Math.sin(time*2.1)*.6,Math.cos(time*1.1+g.seed)*1.5));this.steer(g,goal,FLEE_SPEED,dt,1.8);}
        else{const out=V(p.x,0,p.z).normalize();if(out.lengthSq()<.1)out.set(1,0,0);this.steer(g,p.clone().addScaledVector(out,20).add(V(0,8,0)),11,dt,3);}
        if(V(p.x,0,p.z).length()>ESCAPE){if(g.fish)this.events.push({name:'lost',gull:g.id});g.fish=false;g.state='away';g.t=8+Math.random()*9;}}
      else if(g.state==='dead'){g.vel.y-=11*dt;p.addScaledVector(g.vel,dt);g.spin+=dt*9;if(p.y<water(p)){this.events.push({name:'gullSplash',gull:g.id,pos:p.toArray()});g.state='away';g.t=10+Math.random()*8;g.fish=false;}}
    }
    return bucketCount;
  }
  steer(g,goal,speed,dt,agility){const want=goal.clone().sub(g.pos);const d=want.length();if(d>1e-3)want.multiplyScalar(speed/d);g.vel.lerp(want,1-Math.exp(-dt*agility));g.pos.addScaledVector(g.vel,dt);}
  kill(id){const g=this.gulls[id];if(!g||!this.thief(g))return null;const hadFish=g.fish;g.state='dead';g.vel.multiplyScalar(.35).add(V(0,2.5,0));g.spin=0;const overBoat=Math.abs(g.pos.x)<1.6&&Math.abs(g.pos.z)<4.4&&g.pos.y<9;g.fish=false;return {hadFish,overBoat,pos:g.pos.toArray()};}
  snapshot(){return this.gulls.map(g=>[STATES.indexOf(g.state),+g.pos.x.toFixed(2),+g.pos.y.toFixed(2),+g.pos.z.toFixed(2),+g.vel.x.toFixed(1),+g.vel.y.toFixed(1),+g.vel.z.toFixed(1),g.fish?1:0]);}
  apply(snap){snap?.forEach((s,i)=>{const g=this.gulls[i];if(!g)return;g.state=STATES[s[0]]||'away';g.target.set(s[1],s[2],s[3]);g.vel.set(s[4],s[5],s[6]);g.fish=!!s[7];if(g.pos.distanceTo(g.target)>8)g.pos.copy(g.target);});}
  // ---------- visual (todos) ----------
  render(dt,time,host){
    for(const g of this.gulls){const m=g.mesh;m.visible=g.state!=='away';if(!m.visible)continue;
      if(!host){g.target.addScaledVector(g.vel,dt);g.pos.lerp(g.target,1-Math.exp(-dt*10));if(g.state==='dead')g.spin+=dt*9;}
      m.position.copy(g.pos);const v=g.vel,sp=Math.hypot(v.x,v.z),yaw=Math.atan2(v.x,v.z),climb=Math.atan2(-v.y,Math.max(sp,.1));
      const b=m.userData.body,dist=g.pos.distanceTo(this.bucket);
      if(g.state==='dead'){m.rotation.set(g.spin,yaw,g.spin*.6);poseWings(m,{flap:1.3,glide:1});m.userData.legs.visible=true;m.userData.fish.visible=false;continue;}
      const hover=g.state==='grab'?1:0,dive=g.state==='dive'&&dist>4?1:0,heavy=g.state==='flee'&&g.fish;
      // banking nas curvas: inclina para dentro
      const bank=THREE.MathUtils.clamp((g.lastYaw!==undefined?Math.atan2(Math.sin(yaw-g.lastYaw),Math.cos(yaw-g.lastYaw))/Math.max(dt,1e-3):0)*-.35,-.8,.8);g.lastYaw=yaw;g.bank=THREE.MathUtils.lerp(g.bank||0,bank,1-Math.exp(-dt*4));
      m.rotation.set(hover?-.5:climb*.8,yaw,g.bank);
      const glide=g.state==='circle'?.5+.5*Math.sin(time*.4+g.seed):0;
      g.flap+=dt*(hover?24:heavy?15:dive?3:g.state==='flee'?12:8)*(1-glide*.8);
      poseWings(m,{flap:g.flap,fold:dive*.85,hover,glide});
      m.userData.legs.visible=hover||heavy;b.position.y=hover?Math.sin(g.flap)*.03:0;
      m.userData.fish.visible=g.fish;if(g.fish){m.userData.fish.rotation.z=Math.PI/2+Math.sin(time*9)*.4;}}
  }
  // Raio do tiro (espaço do mundo): só as ladras podem ser atingidas
  pick(ray,toWorld){let best=-1,bestT=1e9;const c=V();for(const g of this.gulls){if(!this.thief(g))continue;c.copy(g.pos);toWorld(c);const t=c.clone().sub(ray.origin).dot(ray.direction);if(t<0||t>180)continue;const d=ray.distanceSqToPoint(c);const r=GULL_RADIUS+t*.002;if(d<r*r&&t<bestT){bestT=t;best=g.id;}}return best;}
  thieves(toWorld){return this.gulls.filter(g=>this.thief(g)).map(g=>({id:g.id,pos:toWorld(g.pos.clone()),fish:g.fish,state:g.state}));}
}

import * as THREE from 'three';
import {Kit,loft,limb,ellipsoid,box,sculpt,V} from './geometry.js';
import {Spring} from './animation.js';

// Rifle de ferrolho com luneta. Eixo +z = cano; origem no punho (onde a mão segura).
export function makeRifle(){
  const kit=new Kit(),wood=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.55,flatShading:true}),metal=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.32,metalness:.85,flatShading:true});
  kit.add(wood,loft([{z:-.42,cy:-.07,rx:.02,rz:.06,pow:3},{z:-.3,cy:-.055,rx:.022,rz:.05,pow:3},{z:-.12,cy:-.02,rx:.018,rz:.028,pow:3},{z:-.02,cy:-.01,rx:.02,rz:.025,pow:3},{z:.35,cy:-.008,rx:.02,rz:.022,pow:3},{z:.42,cy:-.004,rx:.014,rz:.016,pow:3}],{axis:'z',n:10}),0x7a4a26,.05);
  kit.add(wood,box([0,-.085,-.42],[.042,.13,.02]),0x2a1d14,.03);
  kit.add(metal,limb(V(0,.015,-.03),V(0,.015,.72),.009,.007,8).rotateX(0),0x2b2e31,.03);
  kit.add(metal,box([0,.018,.05],[.03,.03,.16]),0x3a3e42,.03);kit.add(metal,limb(V(.018,.02,.02),V(.05,.02,.0),.004,.004,5),0x3a3e42);kit.add(metal,ellipsoid([.05,.02,0],[.008,.008,.008],6,4),0x3a3e42);
  kit.add(metal,sculpt(new THREE.TorusGeometry(.02,.004,4,10,Math.PI),v=>{}).rotateY(Math.PI/2).translate(0,-.02,-.02),0x2b2e31);
  kit.add(metal,loft([{z:-.08,cy:.07,rx:.018,rz:.018},{z:-.04,cy:.07,rx:.014,rz:.014},{z:.14,cy:.07,rx:.014,rz:.014},{z:.2,cy:.07,rx:.02,rz:.02}],{axis:'z',n:10}),0x17191b,.02);
  kit.add(metal,box([0,.047,-.02],[.012,.03,.012]),0x17191b).add(metal,box([0,.047,.13],[.012,.03,.012]),0x17191b);
  const g=kit.build();const muzzle=new THREE.Object3D();muzzle.position.set(0,.015,.73);g.add(muzzle);const eye=new THREE.Object3D();eye.position.set(0,.07,-.12);g.add(eye);
  g.userData={muzzle,eye};return g;
}
// Suporte de madeira contra o costado com dois rifles de pé.
export const RACK={x:-.93,z:-1.55,slots:[[-.95,-1.36],[-.95,-1.74]]};
export function addRack(parent){
  const kit=new Kit(),wood=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.8,flatShading:true});
  kit.add(wood,box([RACK.x+.02,.02,RACK.z],[.16,.08,.7]),0x6e4b2e,.05).add(wood,box([RACK.x+.04,.62,RACK.z],[.08,.06,.7]),0x8d6541,.05);
  for(const [x,z]of RACK.slots){kit.add(wood,box([x+.07,.62,z],[.03,.07,.06]),0x5a3c24,.03);}
  parent.add(kit.build());
  const rifles=RACK.slots.map(([x,z])=>{const r=makeRifle();r.rotation.x=-Math.PI/2+.08;r.rotation.z=.08;r.position.set(x+.05,.5,z);parent.add(r);return r;});
  return rifles;
}
// Arma em primeira pessoa: fica na câmera, balança com o passo e o mouse, centraliza ao mirar, recua ao atirar.
export class Viewmodel {
  constructor(camera,scene){
    this.camera=camera;this.gun=makeRifle();this.gun.visible=false;this.holder=new THREE.Group();this.holder.add(this.gun);camera.add(this.holder);if(!camera.parent)scene.add(camera);
    this.aim=0;this.kick=new Spring(300,20);this.tilt=new Spring(240,18);this.swayX=0;this.swayY=0;this.lastYaw=0;this.lastPitch=0;this.reload=0;
    this.flash=new THREE.Mesh(new THREE.PlaneGeometry(.22,.22),new THREE.MeshBasicMaterial({color:new THREE.Color(5,3.4,1.4),transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));this.flash.position.set(0,.015,.78);this.gun.add(this.flash);
    this.light=new THREE.PointLight(0xffb060,0,6,2);this.light.position.set(0,.02,.8);this.gun.add(this.light);
  }
  fire(){this.kick.kick(-9);this.tilt.kick(10);this.flashT=0;}
  update(dt,{visible,aiming,yaw,pitch,bob,reloading}){
    this.gun.visible=visible;if(!visible)return;
    this.aim+=((aiming&&!reloading?1:0)-this.aim)*(1-Math.exp(-dt*14));
    let dy=yaw-this.lastYaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));const dp=pitch-this.lastPitch;this.lastYaw=yaw;this.lastPitch=pitch;
    this.swayX+=(-dy*2.2-this.swayX)*(1-Math.exp(-dt*9));this.swayY+=(dp*2-this.swayY)*(1-Math.exp(-dt*9));
    const k=this.kick.update(0,dt),t=this.tilt.update(0,dt),a=this.aim,rl=reloading?Math.sin(Math.min(1,reloading)*Math.PI):0;
    const hip=V(.19,-.19,-.42),ads=V(0,-.07,-.24);this.holder.position.copy(hip.lerp(ads,a)).add(V(this.swayX*.05*(1-a*.7)+Math.sin(bob)*.012*(1-a),Math.abs(Math.cos(bob))*.01*(1-a)-rl*.12,k*.012));
    this.holder.rotation.set(-t*.012+this.swayY*.08*(1-a*.7)+rl*.6,this.swayX*.12*(1-a*.7)+.04*(1-a),rl*-.5);
    if(this.flashT!==undefined){this.flashT+=dt;const f=Math.max(0,1-this.flashT*14);this.flash.material.opacity=f;this.flash.rotation.z=Math.random()*6;this.flash.scale.setScalar(.7+Math.random()*.6);this.light.intensity=f*6;}
  }
}
// Traçante e fumaça do tiro, visíveis para todos.
export class ShotFX {
  constructor(scene){this.scene=scene;this.tracers=[];this.mat=new THREE.LineBasicMaterial({color:new THREE.Color(4,3,1.6),transparent:true,opacity:1,blending:THREE.AdditiveBlending,depthWrite:false});}
  tracer(from,to){const g=new THREE.BufferGeometry().setFromPoints([from,to]);const l=new THREE.Line(g,this.mat.clone());l.frustumCulled=false;this.scene.add(l);this.tracers.push({l,t:0});}
  update(dt){for(const tr of [...this.tracers]){tr.t+=dt;tr.l.material.opacity=Math.max(0,1-tr.t*9);if(tr.t>.15){this.scene.remove(tr.l);tr.l.geometry.dispose();this.tracers.splice(this.tracers.indexOf(tr),1);}}}
}

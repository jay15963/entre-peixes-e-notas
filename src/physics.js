import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import {JOINTS} from './models.js';
export class Ragdolls {
  constructor(scene){this.scene=scene;this.world=new CANNON.World({gravity:new CANNON.Vec3(0,-13,0)});this.world.broadphase=new CANNON.SAPBroadphase(this.world);this.world.solver.iterations=7;this.active=new Map();this.deck=new CANNON.Body({mass:0,type:CANNON.Body.KINEMATIC});this.deck.addShape(new CANNON.Box(new CANNON.Vec3(1.12,.08,3.50)),new CANNON.Vec3(0,-.16,0));for(const z of [-2.84,-.258,2.279])this.deck.addShape(new CANNON.Box(new CANNON.Vec3(1.22,.045,.31)),new CANNON.Vec3(0,.68,z));this.world.addBody(this.deck);}
  moveDeck(boat){this.deck.position.copy(boat.position);this.deck.quaternion.copy(boat.quaternion);this.deck.aabbNeedsUpdate=true;}
  snapshot(){return [...this.active].map(([id,r])=>({id,launched:r.launched,bodies:Object.fromEntries(Object.entries(r.bodies).map(([key,b])=>[key,[b.position.x,b.position.y,b.position.z,b.quaternion.x,b.quaternion.y,b.quaternion.z,b.quaternion.w,b.velocity.x,b.velocity.y,b.velocity.z]]))}));}
  // models: lista indexada ou função (o padeiro usa o id 'baker')
  sync(states,models){const get=typeof models==='function'?models:id=>models[id];for(const state of states||[]){if(!this.active.has(state.id)&&get(state.id))this.launch(state.id,get(state.id),[0,0,0]);const r=this.active.get(state.id);if(!r)continue;r.launched=state.launched;for(const [key,v]of Object.entries(state.bodies)){const b=r.bodies[key];if(!b)continue;b.position.set(...v.slice(0,3));b.quaternion.set(...v.slice(3,7));b.velocity.set(...v.slice(7,10));}}}
  launch(id,character,velocity){this.remove(id);character.updateMatrixWorld(true);const bodies={},groups={},constraints=[];
    for(const [name,d]of Object.entries(JOINTS)){
      const origin=new THREE.Vector3(...d.origin),center=new THREE.Vector3(...d.center),pivotToCenter=center.clone().sub(origin);const source=character.userData.joints[name];const worldCenter=source.localToWorld(pivotToCenter.clone());const q=source.getWorldQuaternion(new THREE.Quaternion());
      const body=new CANNON.Body({mass:name==='torso'?8:name==='head'?2:1.3,shape:new CANNON.Box(new CANNON.Vec3(...d.size.map(v=>v*.5))),position:new CANNON.Vec3(...worldCenter.toArray()),quaternion:new CANNON.Quaternion(q.x,q.y,q.z,q.w),linearDamping:.1,angularDamping:.2});
      body.velocity.set(...velocity);body.angularVelocity.set((Math.random()-.5)*8,(Math.random()-.5)*8,(Math.random()-.5)*8);this.world.addBody(body);bodies[name]=body;
      const group=new THREE.Group(),jointSet=new Set(Object.values(character.userData.joints));for(const child of source.children){if(jointSet.has(child)||child===character.userData.gun||child===character.userData.rod)continue;if(child.isMesh||child.isGroup){const copy=child.clone();copy.visible=true;copy.position.sub(pivotToCenter);group.add(copy);}}this.scene.add(group);groups[name]=group;
    }
    for(const [name,d]of Object.entries(JOINTS)){if(!d.parent)continue;const a=bodies[d.parent],b=bodies[name];const joint=character.userData.joints[name].getWorldPosition(new THREE.Vector3());const world=new CANNON.Vec3(...joint.toArray()),pa=a.pointToLocalFrame(world),pb=b.pointToLocalFrame(world);const constraint=new CANNON.ConeTwistConstraint(a,b,{pivotA:pa,pivotB:pb,axisA:new CANNON.Vec3(0,-1,0),axisB:new CANNON.Vec3(0,-1,0),angle:name==='head'?.45:1.05,twistAngle:.7,collideConnected:false,maxForce:1e5});this.world.addConstraint(constraint);constraints.push(constraint);}
    character.visible=false;this.active.set(id,{bodies,groups,constraints,character,age:0,launched:false});
  }
  update(dt,waterHeight,onWater){this.world.step(1/60,Math.min(dt,.05),3);for(const [id,r]of this.active){r.age+=dt;for(const name of Object.keys(r.bodies)){const b=r.bodies[name],g=r.groups[name];g.position.copy(b.position);g.quaternion.copy(b.quaternion);}const torso=r.bodies.torso;if(!r.launched&&torso.position.y<waterHeight(torso.position.x,torso.position.z)+.15){r.launched=true;const a=Math.random()*Math.PI*2,velocity=[Math.cos(a)*7,17+Math.random()*6,Math.sin(a)*7];for(const b of Object.values(r.bodies)){b.velocity.set(...velocity);b.angularVelocity.set(Math.random()*15,Math.random()*10,Math.random()*12);}onWater(id,new THREE.Vector3(torso.position.x,torso.position.y,torso.position.z),velocity);}}
  }
  remove(id){const r=this.active.get(id);if(!r)return;for(const c of r.constraints)this.world.removeConstraint(c);for(const b of Object.values(r.bodies))this.world.removeBody(b);for(const g of Object.values(r.groups))this.scene.remove(g);r.character.visible=true;this.active.delete(id);}
  clear(){for(const id of [...this.active.keys()])this.remove(id);}
  // Chão da ilha: heightfield do piso caminhável + caixas para paredes, balcões, casas e troncos
  addIsland(ground,{x0,z0,size,n=110},colliders=[]){this.removeIsland();const el=size/n,data=[];
    for(let i=0;i<=n;i++){const row=[];for(let j=0;j<=n;j++)row.push(Math.max(-8,ground(x0+i*el,z0+size-j*el)));data.push(row);}
    const hf=new CANNON.Body({mass:0});hf.addShape(new CANNON.Heightfield(data,{elementSize:el}));hf.quaternion.setFromEuler(-Math.PI/2,0,0);hf.position.set(x0,0,z0+size);this.world.addBody(hf);this.island=[hf];
    for(const c of colliders){const b=new CANNON.Body({mass:0});if(c.r)b.addShape(new CANNON.Cylinder(c.r,c.r,6,8));else b.addShape(new CANNON.Box(new CANNON.Vec3((c.x1-c.x0)/2,3,(c.z1-c.z0)/2)));
      const x=c.r?c.x:(c.x0+c.x1)/2,z=c.r?c.z:(c.z0+c.z1)/2;b.position.set(x,ground(x,z)+2.9,z);this.world.addBody(b);this.island.push(b);}}
  removeIsland(){for(const b of this.island||[])this.world.removeBody(b);this.island=[];}
}

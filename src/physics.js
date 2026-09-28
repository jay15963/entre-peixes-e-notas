import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import {JOINTS,realMaterial} from './models.js';
export class Ragdolls {
  constructor(scene){this.scene=scene;this.world=new CANNON.World({gravity:new CANNON.Vec3(0,-13,0)});this.world.broadphase=new CANNON.SAPBroadphase(this.world);this.world.solver.iterations=7;this.active=new Map();this.pull=new Map();this.deck=new CANNON.Body({mass:0,type:CANNON.Body.KINEMATIC});this.deck.addShape(new CANNON.Box(new CANNON.Vec3(1.12,.08,3.50)),new CANNON.Vec3(0,-.16,0));for(const z of [-2.84,-.258,2.279])this.deck.addShape(new CANNON.Box(new CANNON.Vec3(1.22,.045,.31)),new CANNON.Vec3(0,.68,z));this.world.addBody(this.deck);}
  moveDeck(boat){this.deck.position.copy(boat.position);this.deck.quaternion.copy(boat.quaternion);this.deck.aabbNeedsUpdate=true;}
  snapshot(){return [...this.active].map(([id,r])=>({id,launched:r.launched,bodies:Object.fromEntries(Object.entries(r.bodies).map(([key,b])=>[key,[b.position.x,b.position.y,b.position.z,b.quaternion.x,b.quaternion.y,b.quaternion.z,b.quaternion.w,b.velocity.x,b.velocity.y,b.velocity.z]]))}));}
  // models: lista indexada ou função (o padeiro usa o id 'baker')
  sync(states,models){const get=typeof models==='function'?models:id=>models[id];for(const state of states||[]){if(!this.active.has(state.id)&&get(state.id))this.launch(state.id,get(state.id),[0,0,0]);const r=this.active.get(state.id);if(!r)continue;if(state.launched&&!r.launched)r.launchAt=r.age-1;r.launched=state.launched;for(const [key,v]of Object.entries(state.bodies)){const b=r.bodies[key];if(!b)continue;b.position.set(...v.slice(0,3));b.quaternion.set(...v.slice(3,7));b.velocity.set(...v.slice(7,10));}}}
  launch(id,character,velocity){this.remove(id);character.updateMatrixWorld(true);const bodies={},groups={},constraints=[];
    for(const [name,d]of Object.entries(JOINTS)){
      const origin=new THREE.Vector3(...d.origin),center=new THREE.Vector3(...d.center),pivotToCenter=center.clone().sub(origin);const source=character.userData.joints[name];const worldCenter=source.localToWorld(pivotToCenter.clone());const q=source.getWorldQuaternion(new THREE.Quaternion());
      const body=new CANNON.Body({mass:name==='torso'?8:name==='head'?2:1.3,shape:new CANNON.Box(new CANNON.Vec3(...d.size.map(v=>v*.5))),position:new CANNON.Vec3(...worldCenter.toArray()),quaternion:new CANNON.Quaternion(q.x,q.y,q.z,q.w),linearDamping:.1,angularDamping:.2});
      body.velocity.set(...velocity);body.angularVelocity.set((Math.random()-.5)*8,(Math.random()-.5)*8,(Math.random()-.5)*8);this.world.addBody(body);bodies[name]=body;
      const group=new THREE.Group(),jointSet=new Set(Object.values(character.userData.joints));for(const child of source.children){if(jointSet.has(child)||child===character.userData.gun||child===character.userData.rod)continue;if(child.isMesh||child.isGroup){const copy=child.clone();copy.visible=true;const src=[];child.traverse(o=>src.push(o));let k=0;copy.traverse(o=>{const from=src[k++];if(o.isMesh&&from)o.material=realMaterial(from);});copy.position.sub(pivotToCenter);group.add(copy);}}this.scene.add(group);groups[name]=group;
    }
    for(const [name,d]of Object.entries(JOINTS)){if(!d.parent)continue;const a=bodies[d.parent],b=bodies[name];const joint=character.userData.joints[name].getWorldPosition(new THREE.Vector3());const world=new CANNON.Vec3(...joint.toArray()),pa=a.pointToLocalFrame(world),pb=b.pointToLocalFrame(world);const constraint=new CANNON.ConeTwistConstraint(a,b,{pivotA:pa,pivotB:pb,axisA:new CANNON.Vec3(0,-1,0),axisB:new CANNON.Vec3(0,-1,0),angle:name==='head'?.45:1.05,twistAngle:.7,collideConnected:false,maxForce:1e5});this.world.addConstraint(constraint);constraints.push(constraint);}
    // corpo que cai dentro do templo subterrâneo só enxerga o chão das salas (grupo 2); os outros, a superfície (grupo 1)
    const tp=bodies.torso.position,deep=!!this.deep?.(tp.x,tp.y,tp.z);for(const b of Object.values(bodies)){b.collisionFilterGroup=4;b.collisionFilterMask=deep?(2|4):(1|4);}
    character.visible=false;this.active.set(id,{bodies,groups,constraints,character,age:0,launched:false,deep});
  }
  update(dt,waterHeight,onWater){this.syncStatics();if(this.active.size||this.world.bodies.some(b=>b.type===CANNON.Body.DYNAMIC))this.world.step(1/60,Math.min(dt,.05),2);for(const [id,r]of this.active){r.age+=dt;for(const name of Object.keys(r.bodies)){const b=r.bodies[name],g=r.groups[name];g.position.copy(b.position);g.quaternion.copy(b.quaternion);}const torso=r.bodies.torso;
      // corpo dentro do templo: se atravessar parede ou piso, volta para a última posição boa (antes ele caía para fora das salas e ficava "à deriva")
      if(r.deep&&this.deepValid){const T=torso.position;if(this.deepValid(T.x,T.y,T.z))r.good=[T.x,T.y,T.z];else if(r.good){const dx=r.good[0]-T.x,dy=r.good[1]+.3-T.y,dz=r.good[2]-T.z;for(const b of Object.values(r.bodies)){b.position.x+=dx;b.position.y+=dy;b.position.z+=dz;b.velocity.set(0,0,0);b.angularVelocity.scale(.3,b.angularVelocity);}}}
      if(!r.launched&&!r.deep&&torso.position.y<waterHeight(torso.position.x,torso.position.z)+.15){r.launched=true;r.launchAt=r.age;const a=Math.random()*Math.PI*2,velocity=[Math.cos(a)*7,17+Math.random()*6,Math.sin(a)*7];for(const b of Object.values(r.bodies)){b.velocity.set(...velocity);b.angularVelocity.set(Math.random()*15,Math.random()*10,Math.random()*12);}onWater(id,new THREE.Vector3(torso.position.x,torso.position.y,torso.position.z),velocity);}
      // depois do voo, quem cai de volta no mar boia: empuxo proporcional à profundidade, água freando e ondas balançando
      const pl=this.pull.get(id),sink=(pl?.depth||0)-(pl?.float||0);if(r.launched&&r.age-(r.launchAt??-9)>.6){for(const b of Object.values(r.bodies)){const w=waterHeight(b.position.x,b.position.z);if(w<-50)continue;const depth=w+.14-sink-b.position.y;if(depth>0){b.velocity.y+=Math.min(depth,1.2)*60*dt;b.velocity.scale(Math.exp(-dt*2.2),b.velocity);b.angularVelocity.scale(Math.exp(-dt*1.5),b.angularVelocity);}}}
      // resgate: a corda puxa o corpo para quem está segurando
      const pull=pl;if(pull&&pull.speed>0){const d=new CANNON.Vec3(pull.x-torso.position.x,0,pull.z-torso.position.z),len=Math.hypot(d.x,d.z);if(len>.05){const sp=Math.min(pull.speed,len*2);for(const b of Object.values(r.bodies)){b.velocity.x+=(d.x/len*sp-b.velocity.x)*Math.min(1,dt*4);b.velocity.z+=(d.z/len*sp-b.velocity.z)*Math.min(1,dt*4);}}}
    }
  }
  remove(id){this.pull.delete(id);const r=this.active.get(id);if(!r)return;for(const c of r.constraints)this.world.removeConstraint(c);for(const b of Object.values(r.bodies))this.world.removeBody(b);for(const g of Object.values(r.groups))this.scene.remove(g);r.character.visible=true;this.active.delete(id);}
  clear(){for(const id of [...this.active.keys()])this.remove(id);}
  // Chão da ilha: heightfield do piso caminhável + caixas para paredes, balcões, casas e troncos.
  // Os colisores estáticos (milhares de troncos e colunas) NÃO ficam no mundo: ficam numa grade e só entram quando há um corpo
  // caído a até ~12 m (syncStatics). Com todos no mundo, o broadphase custava ~23 ms por passo e, com um ragdoll, o Cannon
  // entrava em subpassos e o jogo travava.
  staticBody(c,y,group){const b=new CANNON.Body({mass:0}),hy=c.hy;if(c.r)b.addShape(new CANNON.Cylinder(c.r,c.r,hy*2,8));else b.addShape(new CANNON.Box(new CANNON.Vec3((c.x1-c.x0)/2,hy,(c.z1-c.z0)/2)));
    const x=c.r?c.x:(c.x0+c.x1)/2,z=c.r?c.z:(c.z0+c.z1)/2;b.position.set(x,y,z);if(group)b.collisionFilterGroup=group;return {b,x,z,rad:c.r||Math.hypot(c.x1-c.x0,c.z1-c.z0)/2,on:false};}
  addStatic(s,tag){s.tag=tag;(this.statics||(this.statics=[])).push(s);const G=this.grid||(this.grid=new Map()),C=16;for(let i=Math.floor((s.x-s.rad)/C);i<=Math.floor((s.x+s.rad)/C);i++)for(let j=Math.floor((s.z-s.rad)/C);j<=Math.floor((s.z+s.rad)/C);j++){const k=i+','+j;(G.get(k)||G.set(k,[]).get(k)).push(s);}}
  syncStatics(){const on=this.onStatics||(this.onStatics=new Set()),need=new Set(),G=this.grid;if(G)for(const [,r] of this.active){const T=r.bodies.torso.position,C=16,R=12;
      for(let i=Math.floor((T.x-R)/C);i<=Math.floor((T.x+R)/C);i++)for(let j=Math.floor((T.z-R)/C);j<=Math.floor((T.z+R)/C);j++)for(const s of G.get(i+','+j)||[])if(!s.dead&&Math.hypot(s.x-T.x,s.z-T.z)<s.rad+R)need.add(s);}
    for(const s of need)if(!s.on){this.world.addBody(s.b);s.on=true;on.add(s);}
    for(const s of [...on])if(!need.has(s)){this.world.removeBody(s.b);s.on=false;on.delete(s);}}
  addIsland(ground,{x0,z0,size,n=110},colliders=[]){this.removeIsland();const el=size/n,data=[];
    for(let i=0;i<=n;i++){const row=[];for(let j=0;j<=n;j++)row.push(Math.max(-8,ground(x0+i*el,z0+size-j*el)));data.push(row);}
    const hf=new CANNON.Body({mass:0});hf.addShape(new CANNON.Heightfield(data,{elementSize:el}));hf.quaternion.setFromEuler(-Math.PI/2,0,0);hf.position.set(x0,0,z0+size);this.world.addBody(hf);this.island=[hf];
    for(const c of colliders){const x=c.r?c.x:(c.x0+c.x1)/2,z=c.r?c.z:(c.z0+c.z1)/2;this.addStatic(this.staticBody({...c,hy:3},ground(x,z)+2.9),'island');}}
  // segunda ilha (vulcão): heightfield e colunas próprias, que não somem com a explosão de Laguna
  addExtra(ground,{x0,z0,size,n=150},colliders=[]){const el=size/n,data=[];for(let i=0;i<=n;i++){const row=[];for(let j=0;j<=n;j++)row.push(Math.max(-8,ground(x0+i*el,z0+size-j*el)));data.push(row);}
    const hf=new CANNON.Body({mass:0});hf.addShape(new CANNON.Heightfield(data,{elementSize:el}));hf.quaternion.setFromEuler(-Math.PI/2,0,0);hf.position.set(x0,0,z0+size);this.world.addBody(hf);
    for(const c of colliders){const hy=Math.min(6,((c.y1??6)-(c.y0??0))/2),x=c.r?c.x:(c.x0+c.x1)/2,z=c.r?c.z:(c.z0+c.z1)/2;this.addStatic(this.staticBody({...c,hy},c.y0!=null&&c.y0>-40?c.y0+hy:ground(x,z)+hy-.1,c.pg===2?2:0),'extra');}}
  // salas subterrâneas: heightfield fino (0,5 m) só para os corpos que caíram lá dentro; rocha vira parede alta
  addDungeon(floor,{x0,z0,w,d,el=.5}){const nx=Math.round(w/el),nz=Math.round(d/el),F=[];for(let i=0;i<=nx;i++){const row=[];for(let j=0;j<=nz;j++)row.push(floor(x0+i*el,z0+d-j*el));F.push(row);}
    const data=F.map((row,i)=>row.map((f,j)=>{if(f!=null)return f;let m=-99;for(let a=-2;a<=2;a++)for(let b=-2;b<=2;b++){const q=F[i+a]?.[j+b];if(q!=null&&q>m)m=q;}return m>-99?m+9:40;}));
    const hf=new CANNON.Body({mass:0});hf.addShape(new CANNON.Heightfield(data,{elementSize:el}));hf.quaternion.setFromEuler(-Math.PI/2,0,0);hf.position.set(x0,0,z0+d);hf.collisionFilterGroup=2;this.world.addBody(hf);this.dungeon=hf;}
  removeIsland(){for(const b of this.island||[])this.world.removeBody(b);this.island=[];for(const st of this.statics||[])if(st.tag==='island'&&!st.dead){st.dead=true;if(st.on){this.world.removeBody(st.b);st.on=false;this.onStatics?.delete(st);}}}
}

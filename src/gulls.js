import * as THREE from 'three';
import {seagull} from './environment.js';
import {makeFish} from './fish.js';

// Gaivotas ladras. Coordenadas no espaço do barco. O anfitrião simula; os demais interpolam os snapshots.
// Difícil de propósito: mergulham rápido em zigue-zague, atacam em dupla, o alvo é pequeno e fogem subindo.
export const STATES=['away','circle','dive','grab','flee','dead'];
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
export const GULL_RADIUS=.42;
export class GullFlock {
  constructor(parent,bucket,count=4){
    this.parent=parent;this.bucket=bucket.clone().add(V(0,.35,0));this.gulls=[];
    for(let i=0;i<count;i++){const mesh=seagull();mesh.scale.setScalar(1.35);mesh.visible=false;parent.add(mesh);const fish=makeFish(0);fish.scale.setScalar(.8);fish.rotation.set(0,Math.PI/2,Math.PI/2);fish.position.set(0,-.12,.45);fish.visible=false;mesh.add(fish);
      this.gulls.push({id:i,state:'away',t:6+i*5+Math.random()*6,pos:V(0,20,-60),vel:V(),seed:Math.random()*100,fish:false,mesh,fishMesh:fish,target:V(0,20,-60),spin:0,flap:0});}
    this.events=[];
  }
  // ---------- simulação (anfitrião) ----------
  simulate(dt,{active,bucketCount,time,water}){
    for(const g of this.gulls){g.t-=dt;const p=g.pos,center=V(0,0,0);
      if(g.state==='away'){if(g.t<=0&&active){g.state='circle';g.t=3+Math.random()*4;const a=Math.random()*6.283;p.set(Math.cos(a)*55,22,Math.sin(a)*55);g.vel.set(-Math.cos(a)*8,0,-Math.sin(a)*8);}continue;}
      if(g.state==='circle'){const a=time*.55+g.seed,r=13+Math.sin(g.seed)*3;const goal=V(Math.cos(a)*r,13+Math.sin(time*.8+g.seed)*2,Math.sin(a)*r);this.steer(g,goal,10,dt,2.2);
        if(g.t<=0){if(bucketCount>0&&active){g.state='dive';g.t=6;}else{g.state='flee';g.t=0;}}}
      else if(g.state==='dive'){const d=this.bucket.clone().sub(p),dist=d.length();const side=V(-d.z,0,d.x).normalize();
        // zigue-zague lateral e vertical que diminui perto do balde
        const weave=Math.min(1,dist/9)*3.2,goal=this.bucket.clone().addScaledVector(side,Math.sin(time*5.5+g.seed)*weave).add(V(0,Math.cos(time*4.3+g.seed)*weave*.5,0));
        this.steer(g,goal,14.5,dt,6);if(dist<.9){g.state='grab';g.t=.6;}if(g.t<=0){g.state='flee';}}
      else if(g.state==='grab'){p.lerp(this.bucket.clone().add(V(0,.25,0)),1-Math.exp(-dt*10));g.vel.multiplyScalar(.8);if(g.t<=0){if(bucketCount>0&&!g.fish){g.fish=true;bucketCount--;this.events.push({name:'stolen',gull:g.id});}g.state='flee';const a=Math.random()*6.283;g.vel.set(Math.cos(a)*8,5,Math.sin(a)*8);}}
      else if(g.state==='flee'){const out=V(p.x,0,p.z).normalize();if(out.lengthSq()<.1)out.set(1,0,0);const goal=p.clone().addScaledVector(out,20).add(V(Math.sin(time*6+g.seed)*6,9,Math.cos(time*5+g.seed)*6));this.steer(g,goal,12,dt,4);
        if(V(p.x,0,p.z).length()>48){if(g.fish)this.events.push({name:'lost',gull:g.id});g.fish=false;g.state='away';g.t=7+Math.random()*9;}}
      else if(g.state==='dead'){g.vel.y-=11*dt;p.addScaledVector(g.vel,dt);g.spin+=dt*9;if(p.y<water(p)){this.events.push({name:'gullSplash',gull:g.id,pos:p.toArray()});g.state='away';g.t=9+Math.random()*8;g.fish=false;}}
    }
    return bucketCount;
  }
  steer(g,goal,speed,dt,agility){const want=goal.clone().sub(g.pos);const d=want.length();if(d>1e-3)want.multiplyScalar(speed/d);g.vel.lerp(want,1-Math.exp(-dt*agility));g.pos.addScaledVector(g.vel,dt);}
  kill(id){const g=this.gulls[id];if(!g||g.state==='away'||g.state==='dead')return null;const hadFish=g.fish;g.state='dead';g.vel.multiplyScalar(.35).add(V(0,2.5,0));g.spin=0;const overBoat=Math.abs(g.pos.x)<1.3&&Math.abs(g.pos.z)<3.8&&g.pos.y<6;g.fish=false;return {hadFish,overBoat,pos:g.pos.toArray()};}
  snapshot(){return this.gulls.map(g=>[STATES.indexOf(g.state),+g.pos.x.toFixed(2),+g.pos.y.toFixed(2),+g.pos.z.toFixed(2),+g.vel.x.toFixed(1),+g.vel.y.toFixed(1),+g.vel.z.toFixed(1),g.fish?1:0]);}
  apply(snap){snap?.forEach((s,i)=>{const g=this.gulls[i];if(!g)return;g.state=STATES[s[0]]||'away';g.target.set(s[1],s[2],s[3]);g.vel.set(s[4],s[5],s[6]);g.fish=!!s[7];if(g.pos.distanceTo(g.target)>8)g.pos.copy(g.target);});}
  // ---------- visual (todos) ----------
  render(dt,time,host){
    for(const g of this.gulls){const m=g.mesh;m.visible=g.state!=='away';if(!m.visible)continue;
      if(!host){g.target.addScaledVector(g.vel,dt);g.pos.lerp(g.target,1-Math.exp(-dt*10));if(g.state==='dead')g.spin+=dt*9;}
      m.position.copy(g.pos);const v=g.vel;const yaw=Math.atan2(v.x,v.z),climb=Math.atan2(-v.y,Math.hypot(v.x,v.z));
      m.rotation.set(g.state==='dead'?g.spin:climb*.8,yaw,g.state==='dead'?g.spin*.6:Math.sin(time*2+g.seed)*.2);
      const w=m.userData.wings,dive=g.state==='dive'&&V(g.pos.x,g.pos.y,g.pos.z).distanceTo(this.bucket)>3;g.flap+=dt*(g.state==='grab'?26:g.state==='flee'?18:dive?4:9);
      const f=g.state==='dead'?.9:dive?-.9+Math.sin(g.flap)*.08:Math.sin(g.flap)*(g.state==='grab'?.9:.6);w[0].rotation.z=f;w[1].rotation.z=-f;
      g.fishMesh.visible=g.fish;}
  }
  // Raio do tiro contra as gaivotas (no espaço do mundo); devolve o id mais próximo acertado
  pick(ray,toWorld){let best=-1,bestT=1e9;const c=V();for(const g of this.gulls){if(g.state==='away'||g.state==='dead')continue;c.copy(g.pos);toWorld(c);const t=c.clone().sub(ray.origin).dot(ray.direction);if(t<0||t>160)continue;const d=ray.distanceSqToPoint(c);const r=GULL_RADIUS+t*.0015;if(d<r*r&&t<bestT){bestT=t;best=g.id;}}return best;}
}

import * as THREE from 'three';
import {waveHeight,weatherAt,clamp,lerp} from './core.js';
import {makeCatch as makeFish,flop,SPECIES} from './fish.js';
import {Particles} from './cataclysm.js';
import {Spring} from './animation.js';

// Tudo o que se vê da pesca: boia, linha com tensão, peixe fisgado se debatendo, saltos, voo até a mão,
// o peixe exibido na frente da câmera e o balde que vai enchendo.
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const SEG=32;
export class FishingFX {
  constructor(scene){
    this.scene=scene;this.state=[];this.flights=[];this.bucket=[];this.onCard=null;
    this.spray=new Particles(scene,1600,{kind:2,dark:[.45,.55,.6],light:[.95,.97,1],opacity:.85,near:[.15,.9]});
    this.rings=[];
    for(let i=0;i<4;i++){
      const b=new THREE.Group(),red=new THREE.MeshStandardMaterial({color:0xff5a1f,emissive:0x5a1604,roughness:.35,flatShading:true}),white=new THREE.MeshStandardMaterial({color:0xf4efe6,roughness:.4,flatShading:true});
      const low=new THREE.Mesh(new THREE.SphereGeometry(.06,10,6,0,Math.PI*2,Math.PI/2,Math.PI/2),red);const up=new THREE.Mesh(new THREE.SphereGeometry(.06,10,6,0,Math.PI*2,0,Math.PI/2),white);const stick=new THREE.Mesh(new THREE.CylinderGeometry(.008,.012,.16,6),red);stick.position.y=.1;b.add(low,up,stick);b.visible=false;scene.add(b);
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(SEG*3),3));const line=new THREE.Line(g,new THREE.LineBasicMaterial({color:0xf3e6c0,transparent:true,opacity:.85}));line.frustumCulled=false;line.visible=false;scene.add(line);
      const ring=new THREE.Mesh(new THREE.RingGeometry(.9,1,32),new THREE.MeshBasicMaterial({color:0xdff3f0,transparent:true,opacity:0,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.visible=false;scene.add(ring);
      this.state.push({bobber:b,line,ring,ringAge:9,dip:new Spring(140,7),fish:null,species:-1,jumpT:9,fishPos:V(),lastPhase:'idle',thrash:0,run:0,runDir:1,cast:V(),lastSplash:0,slack:0});
    }
  }
  splash(pos,n=24,power=1,size=1){for(let i=0;i<n;i++){const a=Math.random()*6.283,s=(.6+Math.random()*1.6)*power;this.spray.emit(this.t||0,pos.x+Math.cos(a)*.08,pos.y,pos.z+Math.sin(a)*.08,Math.cos(a)*s,(1.6+Math.random()*2.6)*power,Math.sin(a)*s,.5+Math.random()*.5,.4,1,.03*size,.1*size,0);}}
  ring(i,pos){const s=this.state[i];s.ring.position.set(pos.x,pos.y+.02,pos.z);s.ringAge=0;s.ring.visible=true;}
  event(name,i,payload={}){const s=this.state[i];if(!s)return;
    if(name==='nibble'){s.dip.kick(-2.2);this.ring(i,s.bobber.position);this.splash(s.bobber.position,6,.35,.6);}
    if(name==='bite'){s.dip.kick(-4.5);this.splash(s.bobber.position,18,.7);this.ring(i,s.bobber.position);}
    if(name==='jump'&&s.fish){s.jumpT=0;this.splash(s.fishPos,30,1.1);}
    if(name==='run'){s.run=1.2;s.runDir=Math.random()<.5?-1:1;this.splash(s.fishPos,20,.9);}
    if(name==='escaped'&&s.fish){this.splash(s.fishPos,26,1);const f=s.fish;this.flights.push({fish:f,t:0,dur:.5,from:s.fishPos.clone(),to:s.fishPos.clone().add(V(0,-1.2,0)),kind:'dive'});s.fish=null;s.slack=1;}
    if(name==='caught'){const species=payload.species??s.species;let f=s.fish;if(!f){f=makeFish(Math.max(0,species));this.scene.add(f);}s.fish=null;this.splash(s.fishPos,40,1.3);
      this.flights.push({fish:f,t:0,dur:.6,from:s.fishPos.clone(),player:i,kind:'hand',species,weight:payload.weight||0});}
  }
  update(t,dt,{players,fishing,models,boat,camera,localId,cinematic,story}){
    this.t=t;const w=weatherAt(story??t);
    players.forEach((p,i)=>{const s=this.state[i],f=fishing[i],model=models[i];if(!s)return;
      const active=p.mode==='fish'&&!cinematic&&model?.visible&&f;s.bobber.visible=s.line.visible=!!active&&f.phase!=='reeling'||(!!active&&f.phase==='reeling');
      if(!active){s.bobber.visible=s.line.visible=false;if(s.fish&&(!f||f.phase!=='reeling')){this.scene.remove(s.fish);s.fish=null;}s.lastPhase=f?.phase||'idle';return;}
      // ponto de lançamento na água (coordenadas do barco → mundo)
      const cast=p.land?V(p.cx,0,p.cz):boat.localToWorld(V(p.cx,0,p.cz));cast.y=waveHeight(cast.x,cast.z,t,w.storm);s.cast.copy(cast);
      if(f.phase==='reeling'&&s.lastPhase!=='reeling'){s.fish=makeFish(Math.max(0,f.species??0));this.scene.add(s.fish);s.fishPos.copy(cast);s.species=f.species;this.splash(cast,36,1.2);}
      s.lastPhase=f.phase;
      const dip=s.dip.update(0,dt);let bob=cast.clone();bob.y+=.03+Math.sin(t*5.5+i)*.018+dip*.05;
      if(f.phase==='bite'){bob.y-=.16+Math.abs(Math.sin(t*26))*.08;if(t-s.lastSplash>.28){s.lastSplash=t;this.splash(bob,8,.45,.7);}}
      let end=bob;
      if(f.phase==='reeling'&&s.fish){
        // o peixe vem vindo com o progresso, nada de um lado ao outro e dá corridas
        const hand=p.land?V(p.x,0,p.z):boat.localToWorld(V(p.x,0,p.z)),toBoat=hand.clone().sub(cast);toBoat.y=0;const dist=toBoat.length();toBoat.normalize();const side=V(-toBoat.z,0,toBoat.x);
        s.run=Math.max(0,s.run-dt);const k=clamp(f.progress);
        const target=cast.clone().addScaledVector(toBoat,Math.min(dist-2.2,dist*k*.85)).addScaledVector(side,Math.sin(t*1.4+i)*1.4*(1-k*.6)+(s.run>0?s.runDir*2.2:0));
        s.fishPos.lerp(target,1-Math.exp(-dt*(s.run>0?3.5:1.6)));
        const water=waveHeight(s.fishPos.x,s.fishPos.z,t,w.storm);s.jumpT+=dt;
        const vel=target.clone().sub(s.fishPos);
        if(s.jumpT<1){const a=s.jumpT;s.fishPos.y=water+Math.sin(a*Math.PI)*(1+(SPECIES[s.species]?.len||.3)*1.5);s.fish.rotation.set(-Math.cos(a*Math.PI)*1.1,Math.atan2(vel.x,vel.z),a*Math.PI*2*(s.runDir));if(a+dt>=1)this.splash(V(s.fishPos.x,water,s.fishPos.z),30,1);}
        else{s.fishPos.y=water-.02+Math.sin(t*14)*.02;s.fish.rotation.set(0,Math.atan2(vel.x,vel.z)+Math.sin(t*9)*.4,Math.sin(t*7)*.3);s.thrash+=dt*(2+f.tension*6);if(s.thrash>1){s.thrash=0;this.splash(V(s.fishPos.x,water,s.fishPos.z),10+f.tension*14,.55+f.tension*.5,.8);}}
        s.fish.position.copy(s.fishPos);flop(s.fish,dt,s.jumpT<1?1:.45+f.tension*.5);end=s.fishPos.clone();s.bobber.position.copy(end).add(V(0,.25,0));s.bobber.visible=false;
      }else s.bobber.position.copy(bob);
      s.bobber.rotation.z=Math.sin(t*3+i)*.15+dip*.3;
      // linha: catenária frouxa esperando, reta e vibrando sob tensão
      const tip=model.userData.tip.getWorldPosition(V()),pos=s.line.geometry.attributes.position.array,tension=f.phase==='reeling'?f.tension:0,sag=f.phase==='reeling'?.08*(1-tension):f.phase==='bite'?.2:.55;
      for(let k=0;k<SEG;k++){const a=k/(SEG-1),vib=Math.sin(a*Math.PI)*Math.sin(t*60+a*9)*.012*tension;pos[k*3]=lerp(tip.x,end.x,a)+vib;pos[k*3+1]=lerp(tip.y,end.y,a)-Math.sin(a*Math.PI)*sag*(1-a*.35);pos[k*3+2]=lerp(tip.z,end.z,a)+vib;}
      s.line.geometry.attributes.position.needsUpdate=true;s.line.material.opacity=.65+tension*.3;
      if(s.ringAge<1.2){s.ringAge+=dt;const r=.1+s.ringAge*.9;s.ring.scale.setScalar(r);s.ring.material.opacity=(1-s.ringAge/1.2)*.5;}else s.ring.visible=false;
    });
    this.state.forEach(s=>{if(s.ringAge<1.2&&!s.bobber.visible){s.ringAge+=dt;if(s.ringAge>=1.2)s.ring.visible=false;}});
    // voos: da água para a mão, a exibição, e da mão para o balde
    for(const fl of [...this.flights]){fl.t+=dt;const a=clamp(fl.t/fl.dur),fish=fl.fish;flop(fish,dt,1);
      if(fl.kind==='dive'){fish.position.lerpVectors(fl.from,fl.to,a);fish.rotation.x=a*2;if(a>=1){this.scene.remove(fish);this.flights.splice(this.flights.indexOf(fl),1);}continue;}
      const model=models[fl.player],local=fl.player===localId;
      const hand=model?model.userData.joints.foreL.localToWorld(V(-.08,-.3,.05)):fl.from;
      const L=fish.userData.len||.3,show=local?camera.position.clone().add(V(.1,-.12-L*.15,-(.55+L*1.25)).applyQuaternion(camera.quaternion)):hand.clone().add(V(0,.35,0));
      if(fl.kind==='hand'){const to=show;fish.position.lerpVectors(fl.from,to,a);fish.position.y+=Math.sin(a*Math.PI)*1.6;fish.rotation.set(a*6,a*3,0);
        if(a>=1){fl.kind='show';fl.t=0;fl.dur=1.9;if(this.onCard&&local)this.onCard(fl.species,fl.weight);}}
      else if(fl.kind==='show'){fish.position.copy(show);if(local){fish.quaternion.copy(camera.quaternion);fish.rotateY(Math.PI/2+Math.sin(fl.t*2)*.3);fish.rotateX(Math.sin(fl.t*13)*.35);}else{fish.rotation.set(Math.sin(fl.t*13)*.4,fl.t,0);}
        if(a>=1){fl.kind='bucket';fl.t=0;fl.dur=.55;fl.from=fish.position.clone();}}
      else if(fl.kind==='bucket'){const b=boat.localToWorld(boat.userData.bucketLocal.clone().add(V(0,.3,0)));fish.position.lerpVectors(fl.from,b,a);fish.position.y+=Math.sin(a*Math.PI)*.8;fish.scale.setScalar(lerp(1,.75,a));
        if(a>=1){this.flights.splice(this.flights.indexOf(fl),1);this.scene.remove(fish);this.toBucket(fish,boat);if(this.onBucket)this.onBucket(b);}}
    }
    // peixes no balde: se debatem de vez em quando
    this.bucket.forEach((f,i)=>{const u=f.userData;u.next=(u.next??Math.random()*3)-dt;if(u.next<0){u.flop=.5;u.next=2+Math.random()*5;}u.flop=Math.max(0,(u.flop||0)-dt);flop(f,dt,u.flop>0?1:.05);f.position.y=u.baseY+(u.flop>0?Math.abs(Math.sin(u.flop*20))*.04:0);});
    this.spray.flush();
  }
  // Gaivota leva o peixe de cima do balde (o visual volta a bater com a contagem via syncBucket)
  steal(boat){const f=this.bucket.pop();if(f)boat.remove(f);return !!f;}
  pendingToBucket(){return this.flights.filter(f=>f.kind!=='dive').length;}
  // o balde mostra os últimos itens de verdade (lista de [espécie, kg])
  syncBucket(list,boat){const count=list.length,target=Math.min(12,Math.max(0,count-this.pendingToBucket()));while(this.bucket.length>target){boat.remove(this.bucket.pop());}while(this.bucket.length<target){const item=list[this.bucket.length+Math.max(0,count-12)];const f=makeFish(item?item[0]:0);this.toBucket(f,boat);}}
  toBucket(fish,boat){const L=fish.userData.len||.3;fish.scale.setScalar(Math.min(.72,.3/L));const n=this.bucket.length,a=n*2.4;fish.position.copy(boat.userData.bucketLocal).add(V(Math.cos(a)*.07,.14+Math.min(n,10)*.022,Math.sin(a)*.07));fish.rotation.set(-1.2+Math.random()*.4,a,Math.random()*.6);fish.userData.baseY=fish.position.y;boat.add(fish);this.bucket.push(fish);
    if(this.bucket.length>12){const old=this.bucket.shift();boat.remove(old);}}
}

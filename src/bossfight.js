import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {FluidSim} from './fluid.js';
import {Environment} from './environment.js';
import {Post} from './post.js';
import {U} from './shaders.js';
import {waveHeight} from './core.js';
import {makeBoat,addHelm,addMotor,addLantern} from './boat.js';
import {makeCharacter} from './characters.js';
import {Animator} from './animation.js';
import {makeRifle,ShotFX} from './weapons.js';
import {Sound} from './audio.js';
import {NessieFight,BattleMusic,MAX_HP,ZONES,ATTACK_NAMES} from './nessie-fight.js';

// Vitrine do ateliê: o mar em tempestade com a luta inteira acontecendo sozinha. O piloto automático desvia
// lendo o estado do boss (não há avisos na água) e dois atiradores miram nos pontos fracos.
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),damp=(a,b,k,dt)=>a+(b-a)*(1-Math.exp(-k*dt)),angDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b)),rnd=(a=0,b=1)=>a+Math.random()*(b-a);
export class BossArena {
  constructor(renderer,container,assets){
    this.renderer=renderer;this.container=container;this.active=false;this.time=0;
    const scene=this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(50,1,.1,2600);this.camera.position.set(34,16,40);
    this.controls=new OrbitControls(this.camera,renderer.domElement);this.controls.enableDamping=true;this.controls.minDistance=8;this.controls.maxDistance=170;this.controls.maxPolarAngle=Math.PI*.495;this.controls.enabled=false;this.controls.addEventListener('start',()=>{this.userT=6;});this.userT=0;
    this.fluid=new FluidSim(renderer,{resolution:256,size:300});this.env=new Environment(scene,renderer,this.fluid,'high');
    // mar aberto: sem ilha (textura "profunda"; o sampler vazio leria outra textura e desenharia manchas rasas)
    U.uIsland.value.set(0,1e6,230);if(!U.uIslandMap.value){const deep=new THREE.DataTexture(new Uint8Array([0,0,0,255]),1,1);deep.needsUpdate=true;U.uIslandMap.value=deep;}
    this.post=new Post(renderer,scene,this.camera,'high');
    this.shots=new ShotFX(scene);this.shotLight=new THREE.PointLight(0xffb060,0,30,2);scene.add(this.shotLight);
    const boat=this.boat=new THREE.Group();boat.add(makeBoat());this.helm=addHelm(boat);addMotor(boat);addLantern(boat);scene.add(boat);boat.userData.speed=0;
    const crew=(i,x,z,rifle)=>{const m=makeCharacter(assets,i);m.userData.anim=new Animator(m);m.position.set(x,-.07,z);boat.add(m);if(rifle){const g=makeRifle();m.userData.joints.torso.add(g);m.userData.gun=g;}m.traverse(o=>{if(o.isMesh)o.castShadow=true;});return m;};
    this.pilot=crew(0,0,-3.3,false);this.gunners=[crew(2,-.45,-.6,true),crew(4,.45,1.1,true)].map((m,k)=>({m,cool:1+k*.6,ammo:5,reload:0,yaw:0,pitch:0}));
    this.fight=new NessieFight(scene,{fluid:this.fluid,waves:(x,z,t)=>waveHeight(x,z,t,U.uStorm.value)});this.markers=[];
    this.buildHUD();this.restart();
  }
  restart(){this.B={x:0,z:0,vx:0,vz:0,heading:0};this.boatS={heading:0,speed:0,vx:0,vz:0,roll:0,pitch:0,rollV:0,pitchV:0,heave:0,heaveV:0,y:0};this.fight.begin(0,0);this.shake=0;this.flash=0;this.restartT=null;this.hesitate=0;if(this.music)this.music.stage=1;}
  hitBoat(power,from){const b=this.boatS,dx=this.B.x-from.x,dz=this.B.z-from.z,l=Math.hypot(dx,dz)||1;b.vx+=dx/l*7*power;b.vz+=dz/l*7*power;b.rollV+=(Math.random()<.5?-1:1)*3*power;b.pitchV-=1.6*power;b.heaveV+=5*power;this.shake=Math.max(this.shake,power);this.flash=.3;
    for(const g of this.gunners)g.m.userData.anim.flinch.kick(-8);this.pilot.userData.anim.flinch.kick(-8);this.sound?.effect('thud',{pos:this.boat.position});this.hitText('O BARCO FOI ATINGIDO!','#ff5a5a',this.boat.position.clone().add(V(0,3,0)),true);}
  // ---------------------------------------------------------------- piloto automático: desvia lendo o ataque em curso
  updateBoat(dt){const b=this.boatS,F=this.fight,A=F.attack||{},S=F.S,pos=V(this.B.x,0,this.B.z),boss=V(S.x,0,S.z),dist=pos.distanceTo(boss);
    let want=Math.atan2(boss.x-pos.x,boss.z-pos.z)+Math.PI/2+clamp((dist-26)*.04,-.6,.6),speed=4.5;const flee=(c,r)=>{if(pos.distanceTo(c)<r){want=Math.atan2(pos.x-c.x,pos.z-c.z)+.3;speed=7.5;}};
    if((A.name==='ram'||A.name==='tripleRam')&&A.phase===1){const lat=-(pos.x-S.x)*Math.cos(S.heading)+(pos.z-S.z)*Math.sin(S.heading);if(Math.abs(lat)<10){want=S.heading+(lat>0?-Math.PI/2:Math.PI/2);speed=7.5;}}
    if(A.name==='tail'&&A.at)flee(A.at,12);if(A.name==='cannon'&&A.aim&&A.t>A.charge-.6)flee(A.aim,9);if(A.name==='bite'&&A.at)flee(A.at,9);if(A.name==='whirlpool'&&A.c)flee(A.c,22);
    if(A.name==='wall'&&A.wall){want=Math.atan2(-A.wall.dx,-A.wall.dz);speed=3;}
    if(Math.random()<.003)this.hesitate=rnd(.5,1.4);if(this.hesitate>0){this.hesitate-=dt;speed=1;}
    b.heading+=clamp(angDiff(want,b.heading),-.8*dt,.8*dt);b.speed=damp(b.speed,speed,1.2,dt);let vx=Math.sin(b.heading)*b.speed+b.vx,vz=Math.cos(b.heading)*b.speed+b.vz;
    if(F.pull){const dx=F.pull.x-pos.x,dz=F.pull.z-pos.z,l=Math.hypot(dx,dz)||1;vx+=dx/l*F.pull.s;vz+=dz/l*F.pull.s;}
    this.B.x+=vx*dt;this.B.z+=vz*dt;this.B.vx=vx;this.B.vz=vz;this.B.heading=b.heading;b.vx*=Math.exp(-dt*1.2);b.vz*=Math.exp(-dt*1.2);const r=Math.hypot(this.B.x,this.B.z);if(r>95){this.B.x*=95/r;this.B.z*=95/r;}
    const h=b.heading,fx=Math.sin(h),fz=Math.cos(h),x=this.B.x,z=this.B.z,H=(a,c)=>F.waterH(x+a,z+c);const hb=H(fx*3.4,fz*3.4),hs=H(-fx*3.4,-fz*3.4),hr=H(fz*1.3,-fx*1.3),hl=H(-fz*1.3,fx*1.3),hc=H(0,0);
    b.rollV+=(-b.roll*14-b.rollV*2.4)*dt;b.roll+=b.rollV*dt;b.pitchV+=(-b.pitch*14-b.pitchV*2.4)*dt;b.pitch+=b.pitchV*dt;b.heaveV+=(-b.heave*10-b.heaveV*2)*dt;b.heave+=b.heaveV*dt;
    b.y=damp(b.y,(hb+hs+hr+hl+hc*2)/6*.9,5,dt);const boat=this.boat;boat.rotation.order='YXZ';boat.position.set(x,b.y+b.heave*.3,z);boat.rotation.set(clamp(-Math.atan2(hb-hs,6.8)*.85,-.45,.45)+b.pitch*.25,h,clamp(Math.atan2(hr-hl,2.6)*.8,-.5,.5)+b.roll*.3);boat.userData.speed=b.speed;boat.updateMatrixWorld(true);this.helm.rotation.z=clamp(angDiff(want,b.heading),-1,1)*2;}
  // ---------------------------------------------------------------- atiradores
  updateGunners(dt){const F=this.fight;for(const g of this.gunners){const m=g.m,anim=m.userData.anim;g.cool-=dt;g.reload=Math.max(0,g.reload-dt);
      const E=F.exposed||{},opts=[['eye',E.eye?4:0],['mouth',E.mouth?3:0],['gill',E.gill?2:0],['body',E.body?2:0],['spine',1]].filter(o=>o[1]);let sum=opts.reduce((s,o)=>s+o[1],0),x=Math.random()*sum,zone='spine';for(const o of opts){x-=o[1];if(x<0){zone=o[0];break;}}
      const head=F.rig.head,aim=zone==='eye'?head.localToWorld(F.rig.eyes[Math.random()<.5?0:1].clone()):zone==='mouth'?head.localToWorld(V(0,-.25,2.3)):zone==='gill'?F.toWorld(V(1.05,5.3,.6)):zone==='body'?F.toWorld(V(0,4.2,rnd(-9,-1))):F.toWorld(V(0,5.6,rnd(-12,-2)));
      const local=this.boat.worldToLocal(aim.clone()),mp=m.position,yaw=Math.atan2(local.x-mp.x,local.z-mp.z),dist=Math.hypot(local.x-mp.x,local.z-mp.z);g.yaw+=angDiff(yaw,g.yaw)*(1-Math.exp(-dt*5));g.pitch=damp(g.pitch,Math.atan2(local.y-1.5,dist),5,dt);m.rotation.y=g.yaw;
      anim.update(dt,{time:this.time+mp.z,grounded:true,rifle:true,aim:true,pitch:g.pitch,yaw:g.yaw,rig:{},roll:this.boat.rotation.z});
      if(!F.alive||F.dead||g.reload>0||g.cool>0||dist>90||aim.y<F.waterH(aim.x,aim.z))continue;g.cool=rnd(.8,1.3);g.ammo--;if(g.ammo<=0){g.ammo=5;g.reload=2.75;}anim.fire();
      const muzzle=m.userData.gun.userData.muzzle.getWorldPosition(V()),dir=aim.clone().sub(muzzle).normalize().add(V(rnd(-1,1),rnd(-1,1),rnd(-1,1)).multiplyScalar(zone==='eye'?.012:.006)).normalize(),hit=F.raycast(new THREE.Ray(muzzle,dir));
      const to=hit?hit.point:muzzle.clone().addScaledVector(dir,80);this.shots.tracer(muzzle,to);this.shotLight.position.copy(muzzle);this.shotLight.intensity=25;this.sound?.effect('gunshot',{pos:muzzle,far:true});
      if(hit){const ev=F.damage(hit.zone)||[];const Z=ZONES[hit.zone];this.hitText(`${Z.label} ×${String(Z.mult).replace('.',',')}`,Z.color,to,hit.zone==='eye');if(hit.zone==='eye')F.sfx('eyeHit',to);for(const e of ev)this.onEvent(e);
        for(let i=0;i<(hit.zone==='eye'?30:10);i++)F.embers.emit(U.uTime.value,to.x,to.y,to.z,rnd(-3,3),rnd(-1,3),rnd(-3,3),.5,2,.4,hit.zone==='eye'?.4:.18,.02,0);}}}
  onEvent(e){if(e.k==='boatHit')this.hitBoat(e.power,V(e.x,0,e.z));if(e.k==='boatRide'){this.boatS.pitchV-=3;this.boatS.heaveV+=7;this.hitText('PASSOU DE PROA!','#7dff6a',this.boat.position.clone().add(V(0,3,0)));}
    if(e.k==='stage'){this.banner(`ESTÁGIO ${e.n}`,['','A ESPREITA','A FÚRIA','A MATRIARCA FERIDA'][e.n]);if(this.music)this.music.stage=e.n;this.music?.hit();}
    if(e.k==='attack'){const name=ATTACK_NAMES[e.name];this.hud.attack.textContent=name||'';this.hud.attack.classList.toggle('show',!!name);if(['ram','tripleRam','tail','cannon','bite','wall','volley','rage'].includes(e.name))this.music?.riser();if(e.name==='rage'||e.name==='death')this.music?.hit();if(e.name==='death')this.banner('A MATRIARCA CAIU','A tripulação sobreviveu à tempestade');}
    if(e.k==='splash'&&e.col>15){this.music?.hit();this.shake=Math.max(this.shake,.6);}if(e.k==='finished')this.restartT=5;}
  hitText(text,color,at,big=false){const el=document.createElement('div');el.className='boss-hit'+(big?' big':'');el.textContent=text;el.style.color=color;this.hud.hits.appendChild(el);this.markers.push({el,at:at.clone(),t:0});}
  banner(text,sub=''){this.hud.banner.innerHTML=`<b>${text}</b>${sub?`<small>${sub}</small>`:''}`;this.hud.banner.classList.remove('show');void this.hud.banner.offsetWidth;this.hud.banner.classList.add('show');}
  buildHUD(){const root=document.createElement('div');root.className='boss-arena-hud';root.hidden=true;
    root.innerHTML=`<div class="bh-top"><span class="bh-name">NESSIE · A MATRIARCA DO ABISMO</span><div class="bh-bar"><i class="bh-trail"></i><i class="bh-fill"></i><em style="left:66%"></em><em style="left:33%"></em></div><span class="bh-stage">ESTÁGIO 1 · A ESPREITA</span></div>
      <div class="bh-attack"></div><div class="bh-banner"></div><div class="bh-hits"></div>
      <div class="bh-legend"><b>PONTOS FRACOS</b><span><i style="background:#ffd23c"></i>Olhos ×5</span><span><i style="background:#ff8a3c"></i>Garganta ×3</span><span><i style="background:#ff5ad0"></i>Guelras ×2</span><span><i style="background:#fff"></i>Corpo ×1</span><span><i style="background:#8fa9a3"></i>Espinhos ×0,25</span></div>
      <div class="bh-controls"><div><b>ESTÁGIO</b><button data-stage="1">1</button><button data-stage="2">2</button><button data-stage="3">3</button><button data-kill>Derrotar</button></div>
      <div><b>ATAQUE</b><button data-atk="ram">Investida</button><button data-atk="tripleRam">Em série</button><button data-atk="tail">Cauda</button><button data-atk="emerge">Rugido</button><button data-atk="cannon">Jato</button><button data-atk="whirlpool">Redemoinho</button><button data-atk="bite">Mordida</button><button data-atk="wall">Muralha</button><button data-atk="volley">Espinhos</button></div>
      <div><button data-cam>Câmera livre</button><button data-mute>Som: ligado</button></div></div>`;
    this.container.appendChild(root);const q=s=>root.querySelector(s);this.hud={root,fill:q('.bh-fill'),trail:q('.bh-trail'),stage:q('.bh-stage'),attack:q('.bh-attack'),banner:q('.bh-banner'),hits:q('.bh-hits')};this.hpShown=MAX_HP;
    root.querySelectorAll('[data-stage]').forEach(b=>b.onclick=()=>{const F=this.fight,n=Number(b.dataset.stage);F.stage=n;F.hp=MAX_HP*[1,.66,.33][n-1]-(n>1?1:0);F.stageDone=new Set([1,2,3].filter(s=>s<n));F.cursor=0;F.dead=false;this.onEvent({k:'stage',n});F.events=[];F.startAttack(n>1?'rage':'cruise');this.forward();});
    q('[data-kill]').onclick=()=>{const F=this.fight;F.hp=0;F.dead=true;F.events=[];F.startAttack('death');this.forward();};
    root.querySelectorAll('[data-atk]').forEach(b=>b.onclick=()=>{const F=this.fight;if(F.dead)return;F.pull=null;F.events=[];F.startAttack(b.dataset.atk);this.forward();});
    q('[data-cam]').onclick=e=>{this.freeCam=!this.freeCam;e.target.textContent=this.freeCam?'Câmera automática':'Câmera livre';};q('[data-mute]').onclick=e=>{if(!this.sound)return;const m=this.sound.toggle();e.target.textContent=m?'Som: desligado':'Som: ligado';};}
  forward(){for(const e of this.fight.events.splice(0))this.onEvent(e);}
  start(){if(this.active)return;this.active=true;this.saved={shadow:this.renderer.shadowMap.enabled,exposure:this.renderer.toneMappingExposure};this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.toneMappingExposure=.95;
    this.controls.enabled=true;this.hud.root.hidden=false;this.fluid.start(new THREE.Vector2(0,0),9);this.env.updateEnvMap();
    if(!this.sound){this.sound=new Sound();this.sound.start();this.fight.sound=this.sound;this.music=new BattleMusic(this.sound);this.env.onThunder=d=>this.sound.effect('thunder',{distance:d});}else this.sound.ctx.resume();this.music.stage=this.fight.stage;this.music.playing=true;}
  stop(){if(!this.active)return;this.active=false;this.controls.enabled=false;this.hud.root.hidden=true;this.renderer.shadowMap.enabled=this.saved.shadow;this.renderer.toneMappingExposure=this.saved.exposure;this.sound?.ctx.suspend();}
  setSize(w,h){this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.post.setSize(w,h);}
  update(dt){if(!this.active)return;dt=Math.min(dt,.05);this.time+=dt;const F=this.fight;
    if(this.restartT!=null){this.restartT-=dt;if(this.restartT<=0)this.restart();}
    for(const e of F.simulate(dt,this.B))this.onEvent(e);this.updateBoat(dt);F.render(dt,{camera:this.camera});this.updateGunners(dt);
    this.pilot.userData.anim.update(dt,{time:this.time,grounded:true,drive:true,steer:this.helm.rotation.z/2,yaw:0,roll:this.boat.rotation.z});this.shots.update(dt);this.shotLight.intensity*=Math.exp(-dt*30);
    // câmera: segue a ação e gira sozinha quando ninguém mexe
    const S=F.S,focus=V(this.B.x,1.5,this.B.z).lerp(V(S.x,Math.max(1,F.headWorld().y*.4),S.z),.42);this.controls.target.lerp(focus,1-Math.exp(-dt*2));this.userT-=dt;const auto=!this.freeCam&&this.userT<=0;this.controls.autoRotate=auto;this.controls.autoRotateSpeed=.35;
    if(auto){const d=this.camera.position.distanceTo(this.controls.target);if(d>55||d<22){const dir=this.camera.position.clone().sub(this.controls.target).normalize();this.camera.position.copy(this.controls.target).addScaledVector(dir,damp(d,38,1,dt));}}this.controls.update();
    this.env.update(this.time,dt,this.boat,this.camera,{story:78,red:F.redK,storm:1,focus:this.boat.position});this.fluid.update(dt);
    if(this.sound?.ctx){this.sound.listener(this.camera);this.sound.update(78,dt,{running:true,phase:'storm',storm:1,heave:this.boatS.heave,speed:this.boatS.speed,driving:true,meteor:0,tsu:0});this.music.stage=F.stage;this.music.tick();}
    this.hpShown=damp(this.hpShown,F.hp,3,dt);this.hud.fill.style.width=(F.hp/MAX_HP*100)+'%';this.hud.trail.style.width=(this.hpShown/MAX_HP*100)+'%';this.hud.root.classList.toggle('red',F.stage>2);this.hud.stage.textContent=`ESTÁGIO ${F.stage} · ${F.stageName}`;
    const rect=this.renderer.domElement.getBoundingClientRect();for(const m of [...this.markers]){m.t+=dt;m.at.y+=dt*1.2;const v=m.at.clone().project(this.camera);m.el.style.transform=`translate(${(v.x*.5+.5)*rect.width}px,${(-v.y*.5+.5)*rect.height}px) translate(-50%,-50%) scale(${1+Math.max(0,.3-m.t)})`;m.el.style.opacity=String(clamp(1.4-m.t*1.2));if(m.t>1.2||v.z>1){m.el.remove();this.markers.splice(this.markers.indexOf(m),1);}}
    this.shake=Math.max(0,this.shake-dt*1.3);this.flash=Math.max(0,this.flash-dt*2);
    const u=this.post.u;u.uAberration.value=.0016+this.shake*.007;u.uFlash.value=this.flash;u.uSaturation.value=1.05+F.redK*.18;u.uContrast.value=1.1;u.uVignette.value=1+F.redK*.2;u.uGrain.value=.05;u.uRed.value=U.uRed.value;u.uStorm.value=U.uStorm.value;this.post.bloom.strength=.45+F.redK*.3+this.flash;}
  render(dt){const s=this.shake,off=V(Math.sin(this.time*41),Math.sin(this.time*33+1),Math.sin(this.time*29+2)).multiplyScalar(s*.4);this.camera.position.add(off);this.post.render(dt);this.camera.position.sub(off);}
}

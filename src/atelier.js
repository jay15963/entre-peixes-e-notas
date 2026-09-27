import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {loadAssets} from './models.js';
import {makeCharacter,addBakerOutfit,LOOKS} from './characters.js';
import {makeBoat,addHelm,addMotor,addLantern} from './boat.js';
import {Animator} from './animation.js';
import {makeRifle,Viewmodel} from './weapons.js';
import {makeGull} from './gulls.js';
import {makeCatch,flop} from './fish.js';
import {CATCHES,TIERS} from './catalog.js';
import {Villagers} from './npcs.js';
const canvas=document.querySelector('canvas'),stage=document.querySelector('#stage'),renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x10272c);scene.add(new THREE.HemisphereLight(0xffe4bb,0x355265,2.5));const sun=new THREE.DirectionalLight(0xffd9a4,3);sun.position.set(-3,5,4);scene.add(sun);const camera=new THREE.PerspectiveCamera(42,1,.02,100),controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.minDistance=.15;controls.maxDistance=25;
const assets=await loadAssets();
const boatGroup=(()=>{const g=new THREE.Group();g.add(makeBoat());addHelm(g);addMotor(g);addLantern(g);return g;})();
const rifle=makeRifle(),gull=makeGull(),baker=addBakerOutfit(makeCharacter(assets,0));
const catches=new THREE.Group();CATCHES.forEach((c,i)=>{const f=makeCatch(i),L=f.userData.len||.3;f.scale.setScalar(Math.min(1.4,.45/L));f.position.set((i%7-3)*.62,.25+Math.floor(i/7)*.5,0);f.rotation.y=Math.PI/2;catches.add(f);});
// primeira pessoa: câmera fixa (o "olho") e o viewmodel ao redor dela; a câmera orbital olha de fora
const eye=new THREE.PerspectiveCamera(60,1,.05,10);eye.position.set(0,1,0);scene.add(eye);const vm=new Viewmodel(eye);vm.setLook(LOOKS[0]);vm.gun.visible=true;const fp=new THREE.Group();fp.add(vm.root);
const town=new THREE.Group(),vil=new Villagers(town,assets);vil.list.forEach((n,i)=>{n.model.visible=true;n.model.position.set((i%5-2)*.9,0,-Math.floor(i/5)*1.2);});
const models=[0,1,2,3,4].map(i=>makeCharacter(assets,i)).concat([boatGroup,rifle,gull,baker,catches,fp,town]);
const anims=models.slice(0,5).map(m=>new Animator(m)).concat([null,null,null,new Animator(baker)]).concat(vil.list.map(n=>n.model.userData.anim));
models.forEach(m=>scene.add(m));let selected=0,wire=false,aiming=false;
const views=[[0,.96,0,1,1.75,3.6],[0,.96,0,1,1.75,3.6],[0,.96,0,1,1.75,3.6],[0,.96,0,1,1.75,3.6],[0,.96,0,1,1.75,3.6],[0,.65,0,6,6.2,10],[0,.05,.15,.7,.35,.9],[0,0,0,1.2,.8,1.6],[0,.96,0,1,1.75,3.6],[0,1.2,0,0,1.6,4.8],[0,.85,-.3,.9,1.25,.6],[0,1.2,-1.8,0,2.2,4.2]];
function choose(i){selected=i;models.forEach((m,k)=>m.visible=i===k);const v=views[i];controls.target.set(v[0],v[1],v[2]);camera.position.set(v[3],v[4],v[5]);controls.update();document.querySelectorAll('[data-model]').forEach((b,k)=>b.classList.toggle('active',i===k));document.querySelector('#fp-tools').hidden=i!==10;}
document.querySelectorAll('[data-model]').forEach(b=>b.onclick=()=>choose(Number(b.dataset.model)));document.querySelector('#front').onclick=()=>{camera.position.set(0,selected===5?7:1,selected===5?9:3.8);controls.update()};document.querySelector('#back').onclick=()=>{camera.position.set(0,selected===5?7:1,selected===5?-9:-3.8);controls.update()};document.querySelector('#wire').onclick=()=>{wire=!wire;models.forEach(m=>m.traverse(o=>{if(o.isMesh)o.material.wireframe=wire;}));};document.querySelector('#reset').onclick=()=>choose(selected);
document.querySelector('#fp-fire').onclick=()=>vm.fire();document.querySelector('#fp-reload').onclick=()=>vm.reload();document.querySelector('#fp-aim').onclick=()=>{aiming=!aiming;};document.querySelector('#fp-eye').onclick=()=>{camera.position.set(0,1,0.001);controls.target.set(0,1,-1);controls.update();};
function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}new ResizeObserver(resize).observe(stage);resize();choose(0);let frame=0;const clock=new THREE.Clock();let time=0;
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);time+=dt;anims.forEach(a=>a?.update(dt,{time,grounded:true}));
  gull.userData.wings.forEach(w=>{const a=Math.sin(time*8),b=Math.sin(time*8-.9);w.inner.rotation.z=w.s*a*.75;w.outer.rotation.z=w.s*b*.55;});catches.children.forEach(f=>flop(f,dt,.4));
  if(selected===10){vm.gun.visible=true;vm.update(dt,{visible:true,aiming,yaw:0,pitch:0,bob:time*3,moving:0});}
  controls.update();renderer.render(scene,camera);if(++frame%30===0)document.querySelector('#stats').textContent=`WEBGL · ${renderer.info.render.calls} chamadas de desenho · ${renderer.info.render.triangles.toLocaleString('pt-BR')} triângulos`;}
animate();
// Exporta o modelo atual (já com a foto no rosto) em GLB, direto do navegador.
document.querySelector('#download').addEventListener('click',e=>{e.preventDefault();const names=['personagem-01','personagem-02','personagem-03','personagem-04','personagem-05','barco-de-pesca','rifle','gaivota','padeiro','pescados','primeira-pessoa','moradores'];new GLTFExporter().parse(models[selected],glb=>{const url=URL.createObjectURL(new Blob([glb],{type:'model/gltf-binary'}));const a=document.createElement('a');a.href=url;a.download=names[selected]+'.glb';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);},err=>console.error(err),{binary:true});});
window.__atelier={camera,controls,vm,choose,scene,rifle,gull,vil};

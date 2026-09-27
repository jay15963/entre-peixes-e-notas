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
import {CATCHES} from './catalog.js';
import {Villagers} from './npcs.js';
import {makeNessie} from './nessie.js';
import {BossArena} from './bossfight.js';
import {makeStoreCollection,animateStore} from './store-models.js';
import {STORE_ITEMS,STORE_CATEGORIES} from './store-catalog.js';
let arena=null;
const canvas=document.querySelector('canvas'),stage=document.querySelector('#stage'),renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x10272c);scene.add(new THREE.HemisphereLight(0xffe4bb,0x355265,2.5));const sun=new THREE.DirectionalLight(0xffd9a4,3);sun.position.set(-3,5,4);scene.add(sun);const camera=new THREE.PerspectiveCamera(42,1,.02,100),controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.minDistance=.15;controls.maxDistance=25;
const assets=await loadAssets();
camera.far=300;camera.updateProjectionMatrix();controls.maxDistance=120;
const rimLight=new THREE.DirectionalLight(0x78bfc1,2.2);rimLight.position.set(6,9,-8);scene.add(rimLight);
const boatGroup=(()=>{const g=new THREE.Group();g.add(makeBoat());addHelm(g);addMotor(g);addLantern(g);return g;})();
const rifle=makeRifle(),gull=makeGull(),baker=addBakerOutfit(makeCharacter(assets,0));
const catches=new THREE.Group();CATCHES.forEach((c,i)=>{const f=makeCatch(i),L=f.userData.len||.3;f.scale.setScalar(Math.min(1.4,.45/L));f.position.set((i%7-3)*.62,.25+Math.floor(i/7)*.5,0);f.rotation.y=Math.PI/2;catches.add(f);});
// primeira pessoa: câmera fixa (o "olho") e o viewmodel ao redor dela; a câmera orbital olha de fora
const eye=new THREE.PerspectiveCamera(60,1,.05,10);eye.position.set(0,1,0);scene.add(eye);const vm=new Viewmodel(eye);vm.setLook(LOOKS[0]);vm.gun.visible=true;const fp=new THREE.Group();fp.add(vm.root);
const town=new THREE.Group(),vil=new Villagers(town,assets);vil.list.forEach((n,i)=>{n.model.visible=true;n.model.position.set((i%5-2)*.9,0,-Math.floor(i/5)*1.2);});
const nessie=makeNessie(),store=makeStoreCollection();
let bossTriangles=0;nessie.traverse(o=>{if(o.isMesh)bossTriangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});
document.querySelector('#boss-triangles').textContent=`${Math.round(bossTriangles/1000)} mil`;
document.querySelector('#boss-length').textContent=`${nessie.userData.posedLengthMetres.toLocaleString('pt-BR',{maximumFractionDigits:1})} m`;
const models=[0,1,2,3,4].map(i=>makeCharacter(assets,i)).concat([boatGroup,rifle,gull,baker,catches,fp,town,nessie,store]);
const anims=models.slice(0,5).map(m=>new Animator(m)).concat([null,null,null,new Animator(baker)]).concat(vil.list.map(n=>n.model.userData.anim));
models.forEach(m=>scene.add(m));let selected=0,wire=false,aiming=false,focusedItem=null,motion=true,previewTime=0;
const $=s=>document.querySelector(s),labels=new THREE.Group();scene.add(labels);
// Labels belong to the display, not to exported assets.
store.children.forEach((holder,i)=>{
  const c=document.createElement('canvas');c.width=512;c.height=80;const ctx=c.getContext('2d');ctx.textAlign='center';ctx.fillStyle='#cbbd99';ctx.font='22px Arial';ctx.fillText(`${String(i+1).padStart(2,'0')} · ${STORE_ITEMS[i].name}`,256,42);
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false}));sprite.position.copy(holder.position).add(new THREE.Vector3(0,-.49,0));sprite.scale.set(1.06,.166,1);labels.add(sprite);
});
function frameObject(object,direction=new THREE.Vector3(1,.4,1.4)){
  object.updateWorldMatrix(true,true);const bounds=new THREE.Box3().setFromObject(object),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
  const outward=direction.clone().normalize(),right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),outward).normalize(),up=new THREE.Vector3().crossVectors(outward,right),tangent=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),tanV=tangent*.72,tanH=tangent*camera.aspect*.93;
  // Fit the actual mesh rather than the empty corners of a diagonal bounding box.
  let distance=0;const corner=new THREE.Vector3();object.traverse(o=>{if(!o.isMesh)return;const positions=o.geometry.attributes.position;for(let i=0;i<positions.count;i++){corner.fromBufferAttribute(positions,i).applyMatrix4(o.matrixWorld).sub(center);distance=Math.max(distance,Math.abs(corner.dot(right))/tanH+corner.dot(outward),Math.abs(corner.dot(up))/tanV+corner.dot(outward));}});
  controls.target.copy(center);camera.position.copy(center).addScaledVector(outward,distance*1.12+size.length()*.03);controls.update();
}
function collectionFrame(){const box=new THREE.Box3(new THREE.Vector3(-5.55,-1.2,-.45),new THREE.Vector3(5.55,4.55,.45)),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());const vertical=THREE.MathUtils.degToRad(camera.fov/2);const distance=Math.max(size.y/2/Math.tan(vertical),size.x/2/(Math.tan(vertical)*camera.aspect))*1.16;controls.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(0,0,distance));controls.update();}
function setMotion(on){motion=on;$('#motion').textContent=on?'Pausar animação':'Retomar animação';$('#motion').setAttribute('aria-pressed',String(on));}
const views=[[0,.96,0,1,1.75,3.6],[0,.96,0,1,1.75,3.6],[0,.96,0,1,1.75,3.6],[0,.96,0,1,1.75,3.6],[0,.96,0,1,1.75,3.6],[0,.65,0,6,6.2,10],[0,.05,.15,.7,.35,.9],[0,0,0,1.2,.8,1.6],[0,.96,0,1,1.75,3.6],[0,1.2,0,0,1.6,4.8],[0,.85,-.3,.9,1.25,.6],[0,1.2,-1.8,0,2.2,4.2]];
function choose(i){
  if(!models[i])return;if(arena?.active&&i!==12){arena.stop();controls.enabled=true;$('#boss-live').classList.remove('active');$('#boss-model').classList.add('active');}selected=i;focusedItem=null;models.forEach((m,k)=>m.visible=i===k);store.children.forEach(m=>m.visible=true);labels.visible=i===13;
  $('main').classList.toggle('has-details',i>=12);$('#details').hidden=i<12;$('#boss-details').hidden=i!==12;$('#store-details').hidden=i!==13;$('#motion-tools').hidden=i<12;$('#boss-head').hidden=i!==12;$('#all-items').hidden=true;$('#item-focus').hidden=true;$('#fp-tools').hidden=i!==10;
  $('#stage-caption').textContent=i===12?'Nessie / A Matriarca do Abismo':i===13?'50 peças. Cinco formas de explorar.':'';$('#stage-hint').textContent=i===12?'Boss 001 · escala em metros · arraste para orbitar':i===13?'Clique em uma peça ou selecione um nome no catálogo':'';
  document.querySelectorAll('[data-model]').forEach(b=>{const active=i===Number(b.dataset.model);b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});resize();
  if(i===12)frameObject(nessie,new THREE.Vector3(1,.36,.8));else if(i===13){renderCatalog();collectionFrame();}else{const v=views[i];controls.target.set(v[0],v[1],v[2]);camera.position.set(v[3],v[4],v[5]);controls.update();}
}
function focusItem(id){
  const index=STORE_ITEMS.findIndex(x=>x.id===id);if(index<0)return;if(selected!==13)choose(13);focusedItem=id;const item=STORE_ITEMS[index];
  store.children.forEach((m,i)=>m.visible=i===index);labels.visible=false;$('#all-items').hidden=false;$('#item-focus').hidden=false;
  $('#item-focus').innerHTML=`<span class="eyebrow">PEÇA ${String(item.number).padStart(2,'0')} / INSPEÇÃO</span><h3>${item.name}</h3><p>${item.description}</p><p class="effect">${item.effect}</p><span class="badge">Movimento: ${item.motion}</span>`;
  $('#stage-caption').textContent=item.name;$('#stage-hint').textContent=`${item.category} · ${item.motion}`;frameObject(store.children[index],new THREE.Vector3(.55,.3,1.8));renderCatalog();$('#details').scrollTop=0;
}
function renderCatalog(){
  const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),query=normalize($('#catalog-search').value),category=$('#category-filter').value;
  const items=STORE_ITEMS.filter(i=>(!category||category===i.category)&&normalize(`${i.name} ${i.description} ${i.effect}`).includes(query));$('#catalog-count').textContent=`${items.length} de 50 itens · selecione para inspecionar`;$('#empty-results').hidden=items.length>0;
  const list=$('#catalog-list');list.replaceChildren();let lastCategory='';for(const item of items){if(item.category!==lastCategory){const heading=document.createElement('h3');heading.textContent=item.category;list.append(heading);lastCategory=item.category;}const card=document.createElement('article');card.className='item-card';const button=document.createElement('button');button.textContent=`${String(item.number).padStart(2,'0')} · ${item.name}`;button.classList.toggle('active',focusedItem===item.id);button.setAttribute('aria-pressed',String(focusedItem===item.id));button.onclick=()=>focusItem(item.id);const description=document.createElement('p');description.textContent=item.description;const effect=document.createElement('p');effect.className='effect';effect.textContent=`Função proposta: ${item.effect}`;card.append(button,description,effect);list.append(card);}
}
STORE_CATEGORIES.forEach(c=>{const option=document.createElement('option');option.value=option.textContent=c;$('#category-filter').append(option);});$('#catalog-search').oninput=renderCatalog;$('#category-filter').onchange=renderCatalog;
document.querySelectorAll('[data-model]').forEach(b=>b.onclick=()=>choose(Number(b.dataset.model)));
function viewSide(back=false){if(selected>=12){const obj=focusedItem?store.children.find(m=>m.userData.itemId===focusedItem):models[selected];if(selected===13&&!focusedItem){collectionFrame();if(back)camera.position.z*=-1;}else frameObject(obj,new THREE.Vector3(0,.12,back?-1:1));}else camera.position.set(0,selected===5?7:1,selected===5?(back?-9:9):(back?-3.8:3.8));controls.update();}
$('#front').onclick=()=>viewSide();$('#back').onclick=()=>viewSide(true);$('#wire').onclick=()=>{wire=!wire;$('#wire').setAttribute('aria-pressed',String(wire));models.forEach(m=>m.traverse(o=>{if(o.isMesh)for(const mat of(Array.isArray(o.material)?o.material:[o.material]))mat.wireframe=wire;}));};$('#reset').onclick=()=>focusedItem?focusItem(focusedItem):choose(selected);
const cranialModel=nessie.getObjectByName('Crânio esculpido · Nessie');
function inspectHead(direction=new THREE.Vector3(.85,.25,1)){frameObject(cranialModel,direction);}
$('#motion').onclick=()=>setMotion(!motion);$('#rest-pose').onclick=()=>{setMotion(false);previewTime=0;nessie.pose(0,false);animateStore(store,0,false);$('#gape').value='11';$('#gape-value').textContent='11°';};$('#all-items').onclick=()=>choose(13);$('#boss-head').onclick=()=>inspectHead();
$('#head-front').onclick=()=>inspectHead(new THREE.Vector3(0,.12,1));$('#head-profile').onclick=()=>inspectHead(new THREE.Vector3(1,.1,.03));$('#head-quarter').onclick=()=>inspectHead();
$('#gape').oninput=e=>{setMotion(false);const degrees=Number(e.target.value);cranialModel.setGape(THREE.MathUtils.degToRad(degrees));$('#gape-value').textContent=`${degrees}°`;};
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let pointerStart=null;
canvas.addEventListener('pointerdown',e=>{pointerStart={x:e.clientX,y:e.clientY};});canvas.addEventListener('pointerup',e=>{if(selected!==13||focusedItem||!pointerStart||Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)>5)return;const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(store.children,true)[0];if(hit){let o=hit.object;while(o&&!o.userData.itemId)o=o.parent;if(o)focusItem(o.userData.itemId);}});
document.querySelector('#fp-fire').onclick=()=>vm.fire();document.querySelector('#fp-reload').onclick=()=>vm.reload();document.querySelector('#fp-aim').onclick=()=>{aiming=!aiming;};document.querySelector('#fp-eye').onclick=()=>{camera.position.set(0,1,0.001);controls.target.set(0,1,-1);controls.update();};
function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();arena?.setSize(w,h);}new ResizeObserver(resize).observe(stage);resize();choose(0);let frame=0;const clock=new THREE.Clock();let time=0;
// Luta da Nessie em funcionamento: cena própria (tempestade, mar simulado, tripulação, ataques e música)
function setBossMode(live){if(live){if(!arena)arena=new BossArena(renderer,stage,assets);controls.enabled=false;arena.start();resize();}else if(arena){arena.stop();controls.enabled=true;choose(12);}stage.classList.toggle('arena-on',live);$('#boss-live').classList.toggle('active',live);$('#boss-model').classList.toggle('active',!live);$('#motion-tools').hidden=live;$('#stage-caption').textContent=live?'Nessie · a luta em funcionamento':'Nessie / A Matriarca do Abismo';}
$('#boss-live').onclick=()=>setBossMode(true);$('#boss-model').onclick=()=>setBossMode(false);
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);time+=dt;
  if(arena?.active){arena.update(dt);arena.render(dt);if(++frame%30===0)document.querySelector('#stats').textContent=`WEBGL · ${renderer.info.render.calls} chamadas de desenho · luta da Nessie`;return;}anims.forEach(a=>a?.update(dt,{time,grounded:true}));
  gull.userData.wings.forEach(w=>{const a=Math.sin(time*8),b=Math.sin(time*8-.9);w.inner.rotation.z=w.s*a*.75;w.outer.rotation.z=w.s*b*.55;});catches.children.forEach(f=>flop(f,dt,.4));
  if(selected===10){vm.gun.visible=true;vm.update(dt,{visible:true,aiming,yaw:0,pitch:0,bob:time*3,moving:0});}
  if(motion){previewTime+=dt;if(selected===12)nessie.pose(previewTime);if(selected===13)store.children.forEach(h=>{if(h.visible)animateStore(h,previewTime);});}
  controls.update();renderer.render(scene,camera);if(++frame%30===0||frame===1)document.querySelector('#stats').textContent=`WEBGL · ${renderer.info.render.calls} chamadas de desenho · ${renderer.info.render.triangles.toLocaleString('pt-BR')} triângulos`;}
animate();
// Exporta o modelo atual (já com a foto no rosto) em GLB, direto do navegador.
document.querySelector('#download').addEventListener('click',e=>{e.preventDefault();const names=['personagem-01','personagem-02','personagem-03','personagem-04','personagem-05','barco-de-pesca','rifle','gaivota','padeiro','pescados','primeira-pessoa','moradores','nessie-matriarca','loja-50-itens'];let object=models[selected],name=names[selected];if(focusedItem){object=store.children.find(m=>m.userData.itemId===focusedItem).children[0].clone();object.position.set(0,0,0);object.scale.setScalar(1);name=focusedItem;}$('#export-status').textContent='Preparando GLB…';new GLTFExporter().parse(object,glb=>{const url=URL.createObjectURL(new Blob([glb],{type:'model/gltf-binary'}));const a=document.createElement('a');a.href=url;a.download=name+'.glb';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);$('#export-status').textContent='GLB exportado (pose atual).';},err=>{$('#export-status').textContent='Falha ao exportar o modelo.';console.error(err);},{binary:true});});
window.__atelier={get arena(){return arena;},setBossMode,camera,controls,vm,choose,focusItem,scene,rifle,gull,vil,nessie,store,renderer};
const initial=new URLSearchParams(location.search).get('model');if(initial==='nessie')choose(12);if(initial==='shop')choose(13);

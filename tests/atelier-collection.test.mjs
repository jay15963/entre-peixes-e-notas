import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {makeNessie} from '../src/nessie.js';
import {STORE_ITEMS,STORE_CATEGORIES} from '../src/store-catalog.js';
import {makeStoreItem,makeStoreCollection,animateStore} from '../src/store-models.js';

function audit(root){
  let triangles=0,meshes=0;
  root.traverse(o=>{
    if(!o.isMesh)return;meshes++;const g=o.geometry,p=g.getAttribute('position'),normal=g.getAttribute('normal');
    assert.ok(p&&normal,`${root.name}: missing geometry/normal`);
    for(const [key,a]of Object.entries(g.attributes))for(const n of a.array)assert.ok(Number.isFinite(n),`${root.name}: invalid ${key}`);
    if(g.index)for(const i of g.index.array)assert.ok(i>=0&&i<p.count,`${root.name}: invalid index`);
    triangles+=(g.index?.count??p.count)/3;
  });
  assert.ok(meshes>0);assert.ok(Number.isInteger(triangles));
  const bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3());
  assert.ok(size.toArray().every(x=>Number.isFinite(x)&&x>0));
  return {triangles,meshes,size};
}

test('Nessie has continuous indexed skin, giant dimensions and five working articulations',()=>{
  const boss=makeNessie(),{triangles,meshes,size}=audit(boss);
  assert.ok(triangles>100000);assert.ok(meshes<25);assert.ok(size.z>24&&size.x>13&&size.y>10);
  const skin=boss.children.find(o=>o.isMesh);assert.ok(skin.geometry.index);assert.equal(skin.geometry.attributes.position.count,193*96);
  const jaw=boss.getObjectByName('Mandíbula articulada');boss.pose(0,false);const before=jaw.rotation.x;boss.pose(3);assert.notEqual(jaw.rotation.x,before);
  const fins=boss.children.filter(o=>o.name.startsWith('Nadadeira'));assert.equal(fins.length,4);assert.ok(fins.every(f=>f.rotation.z!==0));
  boss.pose(0,false);assert.ok(fins.every(f=>f.rotation.z===0));assert.doesNotThrow(()=>JSON.stringify(boss.userData));
});

test('Catalog contains fifty distinct named models, proposed effects and live mechanisms',()=>{
  assert.equal(STORE_ITEMS.length,50);assert.equal(new Set(STORE_ITEMS.map(i=>i.id)).size,50);assert.equal(new Set(STORE_ITEMS.map(i=>i.name)).size,50);
  for(const c of STORE_CATEGORIES)assert.equal(STORE_ITEMS.filter(i=>i.category===c).length,10);
  let total=0;
  for(const item of STORE_ITEMS){
    assert.ok(item.effect.length>35&&item.description.length>35&&item.motion);
    const root=makeStoreItem(item.id),{triangles,meshes}=audit(root);total+=triangles;assert.ok(meshes<=12,`${item.id}: batching regression`);
    const joints=[];root.traverse(o=>{if(o.workshopMotion)joints.push(...o.workshopMotion);});assert.ok(joints.length,`${item.id}: missing articulated mechanism`);
    animateStore(root,1.37);assert.ok(joints.some(j=>Math.abs(j.group.rotation[j.axis])>.001),`${item.id}: inert animation`);
    animateStore(root,0,false);assert.ok(joints.every(j=>j.group.rotation[j.axis]===0));assert.doesNotThrow(()=>root.clone());
  }
  assert.ok(total<650000,'Whole gallery must stay within its triangle budget');
  assert.throws(()=>makeStoreItem('missing'),/Unknown workshop item/);
});

test('Gallery has exactly fifty independently selectable models in five rows',()=>{
  const group=makeStoreCollection();assert.equal(group.children.length,50);assert.equal(new Set(group.children.map(o=>o.position.y)).size,5);
  for(const holder of group.children){const b=new THREE.Box3().setFromObject(holder),size=b.getSize(new THREE.Vector3());assert.ok(Math.max(...size.toArray())<.81);assert.ok(holder.userData.itemId);}
});

// The new assets have vertex colors and no image dependencies. Verify a real GLB
// export, including an articulated item, so reference cycles cannot silently break it.
class BlobReader {
  readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}
  readAsDataURL(blob){blob.arrayBuffer().then(result=>{this.result=`data:${blob.type};base64,${Buffer.from(result).toString('base64')}`;this.onloadend?.();});}
}
test('Boss and articulated shop assets export as valid self-contained GLB',async()=>{
  const previous=globalThis.FileReader;globalThis.FileReader=BlobReader;
  try{for(const object of [makeNessie(),makeStoreItem('tackle')]){
    const data=await new GLTFExporter().parseAsync(object,{binary:true}),bytes=Buffer.from(data);
    assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(8),bytes.length);
    const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
    assert.ok(json.meshes.length>0);assert.ok(json.meshes.every(m=>m.primitives.every(p=>p.attributes.COLOR_0!==undefined&&p.attributes.NORMAL!==undefined)));
    assert.equal(json.images,undefined);assert.ok(json.nodes.some(n=>n.name===object.name));
  }}finally{if(previous===undefined)delete globalThis.FileReader;else globalThis.FileReader=previous;}
});

import * as THREE from 'three';
import {surface,hose,material,v} from './artisan.js';
import {makeNessieHead} from './nessie-head.js';
import {Kit} from './geometry.js';

// A single continuous body/neck/tail skin. Dimensions are metres; the museum never
// rescales the boss. Separate jaw and flippers have real hinge origins for posing.
const SPINE=[[-.8,2,-17],[-1.3,2.2,-14],[-.65,2.6,-11],[0,3,-8],[0,3.3,-5],[0,3.6,-2],[0,4.8,.3],[0,6.8,1.6],[0,9,2.1],[0,10.2,3.3],[0,10.25,4.7]];
const RADII=[[.025,.025],[.25,.3],[.7,.7],[1.6,1.35],[2.45,1.8],[2.25,1.8],[1.25,1.2],[.78,.85],[.65,.72],[.8,.77],[.9,.68]];
const C=new THREE.CatmullRomCurve3(SPINE.map(v));
function section(t){const k=t*(RADII.length-1),i=Math.min(RADII.length-2,Math.floor(k)),f=k-i;return RADII[i].map((r,j)=>THREE.MathUtils.lerp(r,RADII[i+1][j],f));}
function skinPoint(t,a,lift=0){const c=C.getPoint(t),tangent=C.getTangent(t),side=new THREE.Vector3(1,0,0),up=tangent.clone().cross(side).normalize(),[rx,ry]=section(t);return c.addScaledVector(side,Math.cos(a)*(rx+lift)).addScaledVector(up,Math.sin(a)*(ry+lift));}
function organic(points,widths,n=20,steps=40){const c=new THREE.CatmullRomCurve3(points.map(v)),f=c.computeFrenetFrames(steps,false);return surface(Array.from({length:steps+1},(_,j)=>{const t=j/steps,k=t*(widths.length-1),i=Math.min(widths.length-2,Math.floor(k)),r=THREE.MathUtils.lerp(widths[i],widths[i+1],k-i);return Array.from({length:n},(_,s)=>c.getPoint(t).addScaledVector(f.normals[j],Math.cos(s/n*Math.PI*2)*r).addScaledVector(f.binormals[j],Math.sin(s/n*Math.PI*2)*r).toArray());}));}
export function makeNessie(){
  const root=new THREE.Group();root.name='Nessie · A Matriarca do Abismo';
  const skin=material(0xffffff,.08,.61,{side:THREE.DoubleSide}),armor=material(0xffffff,.16,.55,{side:THREE.DoubleSide});
  const kit=new Kit(),rows=Array.from({length:193},(_,j)=>Array.from({length:96},(_,i)=>{const t=j/192,a=i/96*Math.PI*2,p=skinPoint(t,a);const grain=(Math.sin(i*2.19+j*1.76)*Math.sin(j*3.1+i*.7))*.019*Math.sin(Math.PI*t);return p.addScaledVector(p.clone().sub(C.getPoint(t)).normalize(),grain).toArray();}));
  const body=surface(rows,(p,j,i)=>{const a=i/96*Math.PI*2,belly=Math.max(0,-Math.sin(a)),mottle=Math.sin(p[2]*3.8+Math.sin(p[1]*8))*Math.sin(p[0]*9+p[1]*3);return new THREE.Color(0x264f49).lerp(new THREE.Color(0x89917a),Math.pow(belly,4)*.8).multiplyScalar(.86+mottle*.14);});
  const bodyMesh=new THREE.Mesh(body,skin);bodyMesh.name='Peau continue · queue, thorax et cou';root.add(bodyMesh);
  // Overlapping scutes lie directly on the body surface, with raised keels and
  // irregular edges. They are batched, not thousands of separate draw calls.
  for(let j=0;j<96;j++){const t=.14+j*.0085;for(let i=0;i<17;i++){const a=.1+i/16*(Math.PI-.2)+(j%2)*.065,dt=.0055,da=.078;const pts=[skinPoint(t-dt,a),skinPoint(t,a-da),skinPoint(t+dt,a),skinPoint(t,a+da),skinPoint(t,a,.04+.035*Math.sin(t*Math.PI))];const g=new THREE.BufferGeometry().setFromPoints([pts[0],pts[1],pts[4],pts[1],pts[2],pts[4],pts[2],pts[3],pts[4],pts[3],pts[0],pts[4]]);g.computeVertexNormals();kit.add(armor,g,j%7===0?0x607365:0x3a5c51,.11);}}
  // Ventral lamellae and lateral folds follow the same section as the skin.
  for(let j=0;j<45;j++){const t=.35+j*.013;kit.add(skin,hose(Array.from({length:12},(_,i)=>skinPoint(t,Math.PI+.2+i/11*(Math.PI-.4),.008).toArray()),.013,6,20),0x4b6857,.06);}
  for(let j=0;j<30;j++){const t=.22+j*.023,p=skinPoint(t,Math.PI/2,.01);kit.add(armor,organic([p.toArray(),[p.x,p.y+.3+.8*Math.sin(t*Math.PI),p.z-.17],[p.x,p.y+.45+Math.sin(t*Math.PI),p.z-.65]],[.16,.12,.005],10,12),0x788276,.07);}
  const head=makeNessieHead();root.add(head);
  const flippers=[];
  for(const s of [-1,1])for(const rear of [false,true]){
    const f=new THREE.Group();f.name=rear?'Nadadeira pélvica':'Nadadeira peitoral';f.position.set(s*(rear?1.5:1.9),3.05,rear?-7.6:-2.4);root.add(f);const fk=new Kit(),length=rear?3.5:4.9;
    const fr=Array.from({length:41},(_,j)=>{const t=j/40,x=s*t*length,width=Math.sin(Math.PI*t)*(.86-(rear?.1:0))+.025;return Array.from({length:40},(_,i)=>{const a=i/40*Math.PI*2;return [x,-t*.9+Math.sin(a)*.24*(1-t),-t*t*2.3+Math.cos(a)*width];});});
    fk.add(skin,surface(fr),0x355c52,.025);
    for(let k=0;k<9;k++)fk.add(armor,hose(Array.from({length:12},(_,j)=>{const t=j/11;return [s*t*length,-t*.9+.245*(1-t),-t*t*2.3+(k/8*2-1)*Math.sin(Math.PI*t)*.8];}),t=>.025*(1-t)+.005,6,24),0x6b8270,.03);
    f.add(fk.build());flippers.push({f,s,rear});
  }
  root.add(kit.build());root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  // Serializable export metadata; animation references stay outside userData.
  const dimensions=new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  root.userData={title:root.name,posedLengthMetres:dimensions.z,lore:'A Matriarca do Abismo. Uma sobrevivente ancestral coberta de cicatrizes e placas minerais.',previewOnly:true};
  root.pose=(time,active=true)=>{head.setGape(.19+(active?(1-Math.cos(time*.8))*.085:0));for(const {f,s,rear}of flippers)f.rotation.z=active?s*Math.sin(time*.65+(rear?1.2:0))*.075:0;};
  return root;
}

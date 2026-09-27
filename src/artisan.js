import * as THREE from 'three';
import {Kit} from './geometry.js';

// Mesh workshop: explicit profiles, indexed ring topology and beveled polygon extrusions.
// No primitive stand-ins: every component is built from its manufacturing/anatomical section.
export const v = p => new THREE.Vector3(...p);
export function material(color, metalness=0, roughness=.5, extra={}) {
  return new THREE.MeshStandardMaterial({color,metalness,roughness,vertexColors:true,...extra});
}
export const palette=()=>({
  steel:material(0xffffff,.85,.27),dark:material(0xffffff,.72,.38),
  brass:material(0xffffff,.8,.3),paint:material(0xffffff,.28,.4),
  rubber:material(0xffffff,0,.87),cloth:material(0xffffff,0,.94),
  wood:material(0xffffff,0,.56),glass:material(0xffffff,.35,.16),
  glow:material(0xffffff,.2,.3,{emissive:0x367f74,emissiveIntensity:.5})
});
export function surface(rows, color=()=>new THREE.Color(0xffffff), closed=true) {
  const p=[],uv=[],colors=[],indices=[],n=rows[0].length;
  rows.forEach((row,j)=>row.forEach((a,i)=>{p.push(...a);uv.push(i/(n-1),j/(rows.length-1));const c=color(a,j,i);colors.push(c.r,c.g,c.b);}));
  for(let j=0;j<rows.length-1;j++)for(let i=0;i<(closed?n:n-1);i++){
    const a=j*n+i,b=j*n+(i+1)%n,c=(j+1)*n+(i+1)%n,d=(j+1)*n+i;
    indices.push(a,b,d,b,c,d);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function lathe(profile,n=32) {
  // profile [radius,height]; winding points from the foot to the lip.
  return surface(profile.map(([r,y])=>Array.from({length:n},(_,i)=>{const a=-i/n*Math.PI*2;return [Math.cos(a)*r,y,Math.sin(a)*r];})));
}
export function hose(points,r=.01,n=10,steps=points.length===2?4:Math.min(48,points.length*6)) {
  const curve=new THREE.CatmullRomCurve3(points.map(v)),frames=curve.computeFrenetFrames(steps,false);
  const rows=Array.from({length:steps+1},(_,j)=>{
    const t=j/steps,c=curve.getPointAt(t),radius=typeof r==='function'?r(t):r;
    return Array.from({length:n},(_,i)=>{const a=i/n*Math.PI*2;return c.clone().addScaledVector(frames.normals[j],Math.cos(a)*radius).addScaledVector(frames.binormals[j],Math.sin(a)*radius).toArray();});
  });
  if(v(points[0]).distanceTo(v(points.at(-1)))>1e-5){rows.unshift(Array.from({length:n},()=>points[0]));rows.push(Array.from({length:n},()=>points.at(-1)));}
  return surface(rows);
}
export function polygon(points,depth=.02,bevel=.005) {
  const s=new THREE.Shape();s.moveTo(...points[0]);points.slice(1).forEach(p=>s.lineTo(...p));s.closePath();
  return new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:2,steps:1,curveSegments:12}).translate(0,0,-depth/2);
}
export function panel(w,h,d=.03,b=.015) {
  const x=w/2,y=h/2,c=Math.min(w,h)*.12;
  return polygon([[-x+c,-y],[x-c,-y],[x,-y+c],[x,y-c],[x-c,y],[-x+c,y],[-x,y-c],[-x,-y+c]],d,b);
}
export function ring(r,t=.01,n=40) {
  return lathe(Array.from({length:9},(_,j)=>{const a=j/8*Math.PI*2;return [r+Math.cos(a)*t,Math.sin(a)*t];}),n).rotateX(Math.PI/2);
}
export function place(g,p=[0,0,0],r=[0,0,0]) {g.rotateX(r[0]);g.rotateY(r[1]);g.rotateZ(r[2]);g.translate(...p);return g;}
export class Workshop {
  constructor(mats=palette()){this.m=mats;this.k=new Kit();this.root=new THREE.Group();this.moving=[];}
  add(g,type='steel',color=0xa9b8bc,p=[0,0,0],r=[0,0,0]){this.k.add(this.m[type],place(g,p,r),color,.015);return this;}
  plate(w,h,d,p,type='paint',color=0x27565a,r=[0,0,0]){return this.add(panel(w,h,d,Math.min(w,h)*.04),type,color,p,r);}
  turn(profile,p,type='steel',color=0xa9b8bc,r=[0,0,0],n=32){return this.add(lathe(profile,n),type,color,p,r);}
  wire(points,r=.009,type='steel',color=0xb9c8cd){return this.add(hose(points,r),type,color);}
  loop(radius,t,p,type='steel',color=0xb9c8cd,r=[0,0,0]){return this.add(ring(radius,t),type,color,p,r);}
  screw(p,size=.009,r=[Math.PI/2,0,0]){
    this.turn([[0,-size*.3],[size,-size*.3],[size,size*.3],[size*.7,size*.5],[0,size*.5]],p,'steel',0xb8c0bc,r,12);
    const q=v([0,size*.56,0]).applyEuler(new THREE.Euler(...r)).add(v(p));
    this.add(panel(size*1.25,size*.18,.001,0),'dark',0x131f23,q.toArray());return this;
  }
  rivets(w,h,z,count=4,center=[0,0]){for(let i=0;i<count;i++)for(const s of [-1,1])this.screw([center[0]+s*w/2,center[1]-h/2+i*h/(count-1),z],.007);return this;}
  grip(a,b,r=.025){this.wire([a,b],r,'rubber',0x272d2c);const A=v(a),B=v(b),q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),B.clone().sub(A).normalize());for(let i=1;i<15;i++){const g=ring(r*1.01,.0025,20).applyQuaternion(q).translate(...A.clone().lerp(B,i/15).toArray());this.add(g,'rubber',0x46504b);}return this;}
  joint(name,at,build,axis='x',amplitude=.6,mode='swing'){
    const child=new Workshop(this.m);build(child);const group=child.build();group.name=name;group.position.set(...at);this.root.add(group);this.moving.push({group,axis,amplitude,mode});return group;
  }
  build(){this.root.add(this.k.build());this.root.workshopMotion=this.moving;return this.root;}
}
export function animateWorkshop(root,time,active=true){for(const m of root.workshopMotion||[]){const value=active?(m.mode==='spin'?time*m.amplitude:m.mode==='open'?(1-Math.cos(time*1.3))*.5*m.amplitude:Math.sin(time*1.8)*m.amplitude):0;m.group.rotation[m.axis]=value;}}

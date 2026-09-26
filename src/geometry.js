import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
// Ferramentas de modelagem procedural low poly: tudo sai não indexado, com cor por vértice
// (variação sutil por face, como pintura à mão) e é agrupado por material.
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
let seed=1;const rand=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
export function reseed(s){seed=Math.max(1,Math.floor(s*9973)%2147483646);}
export function tint(geo,color,jitter=.06){
  const g=geo.index?geo.toNonIndexed():geo,n=g.attributes.position.count,c=new THREE.Color(color),arr=new Float32Array(n*3);
  for(let i=0;i<n;i+=3){const k=1+(rand()-.5)*2*jitter;for(let j=0;j<3;j++){arr[(i+j)*3]=c.r*k;arr[(i+j)*3+1]=c.g*k;arr[(i+j)*3+2]=c.b*k;}}
  g.setAttribute('color',new THREE.BufferAttribute(arr,3));if(g.attributes.uv)g.deleteAttribute('uv');return g;
}
// Cor por vértice definida por função da posição (degradês, faixas de tinta, barriga do peixe).
export function paint(geo,fn,jitter=.04){
  const g=geo.index?geo.toNonIndexed():geo,p=g.attributes.position,n=p.count,arr=new Float32Array(n*3),c=new THREE.Color(),v=V();
  for(let i=0;i<n;i+=3){const k=1+(rand()-.5)*2*jitter;const cx=(p.getX(i)+p.getX(i+1)+p.getX(i+2))/3,cy=(p.getY(i)+p.getY(i+1)+p.getY(i+2))/3,cz=(p.getZ(i)+p.getZ(i+1)+p.getZ(i+2))/3;
    for(let j=0;j<3;j++){v.set(p.getX(i+j),p.getY(i+j),p.getZ(i+j));c.set(fn(v,V(cx,cy,cz)));arr[(i+j)*3]=c.r*k;arr[(i+j)*3+1]=c.g*k;arr[(i+j)*3+2]=c.b*k;}}
  g.setAttribute('color',new THREE.BufferAttribute(arr,3));if(g.attributes.uv)g.deleteAttribute('uv');return g;
}
// Loft de anéis superelípticos: cada anel {y|z, cx, cy|cz, rx, rz, pow}. axis='y' empilha na vertical, 'z' ao longo do comprimento.
export function loft(rings,{n=14,axis='y',capStart=true,capEnd=true,twist=0}={}){
  const pos=[],ring=r=>{const pts=[],e=2/(r.pow||2.2);for(let i=0;i<n;i++){const a=i/n*Math.PI*2+twist,c=Math.cos(a),s=Math.sin(a);const x=Math.sign(c)*Math.pow(Math.abs(c),e)*r.rx,w=Math.sign(s)*Math.pow(Math.abs(s),e)*r.rz;
    pts.push(axis==='y'?V((r.cx||0)+x,r.y,(r.cz||0)+w+(r.front&&w>0?w*r.front:0)):V((r.cx||0)+x,(r.cy||0)+w*(r.up&&w>0?1+r.up:1),r.z));}return pts;};
  const R=rings.map(ring);
  for(let k=0;k<R.length-1;k++)for(let i=0;i<n;i++){const a=R[k][i],b=R[k][(i+1)%n],c=R[k+1][(i+1)%n],d=R[k+1][i];if(axis==='y')pos.push(a,d,c,a,c,b);else pos.push(a,b,c,a,c,d);}
  const cap=(P,flip)=>{const c=P.reduce((s,p)=>s.add(p),V()).multiplyScalar(1/P.length);for(let i=0;i<n;i++){const a=P[i],b=P[(i+1)%n];if(flip)pos.push(c,a,b);else pos.push(c,b,a);}};
  if(capStart)cap(R[0],axis==='y');if(capEnd)cap(R[R.length-1],axis!=='y');
  const g=new THREE.BufferGeometry().setFromPoints(pos);g.computeVertexNormals();return g;
}
// Membro cônico entre dois pontos, com tampas.
export function limb(a,b,ra,rb,seg=8){const d=b.clone().sub(a),len=d.length(),g=new THREE.CylinderGeometry(rb,ra,len,seg,1);g.translate(0,len/2,0);const q=new THREE.Quaternion().setFromUnitVectors(V(0,1,0),d.normalize());g.applyQuaternion(q);g.translate(a.x,a.y,a.z);return g;}
export function ellipsoid(c,r,w=12,h=8){const g=new THREE.SphereGeometry(1,w,h);g.scale(r[0],r[1],r[2]);g.translate(c[0],c[1],c[2]);return g;}
export function box(c,s,rot=[0,0,0]){const g=new THREE.BoxGeometry(s[0],s[1],s[2]);g.rotateX(rot[0]);g.rotateY(rot[1]);g.rotateZ(rot[2]);g.translate(c[0],c[1],c[2]);return g;}
// Varre um perfil retangular (w,h) ao longo de um caminho de pontos (trilhos, cavernas, cabos).
export function sweep(path,w,h,{up=V(0,1,0),closed=false}={}){
  const pos=[],frames=path.map((p,i)=>{const t=(path[Math.min(i+1,path.length-1)].clone().sub(path[Math.max(i-1,0)])).normalize();const side=t.clone().cross(up).normalize();if(side.lengthSq()<1e-6)side.set(1,0,0);const u=side.clone().cross(t).normalize();
    return [p.clone().addScaledVector(side,-w/2).addScaledVector(u,-h/2),p.clone().addScaledVector(side,w/2).addScaledVector(u,-h/2),p.clone().addScaledVector(side,w/2).addScaledVector(u,h/2),p.clone().addScaledVector(side,-w/2).addScaledVector(u,h/2)];});
  const count=closed?path.length:path.length-1;
  for(let k=0;k<count;k++){const A=frames[k],B=frames[(k+1)%path.length];for(let i=0;i<4;i++){const a=A[i],b=A[(i+1)%4],c=B[(i+1)%4],d=B[i];pos.push(a,b,c,a,c,d);}}
  if(!closed){const s=frames[0],e=frames[frames.length-1];pos.push(s[0],s[2],s[1],s[0],s[3],s[2],e[0],e[1],e[2],e[0],e[2],e[3]);}
  const g=new THREE.BufferGeometry().setFromPoints(pos);g.computeVertexNormals();return g;
}
export function tube(path,r,seg=6){const curve=new THREE.CatmullRomCurve3(path);return new THREE.TubeGeometry(curve,Math.max(4,path.length*4),r,seg,false);}
// Desloca vértices por função (esculpir), mantendo faces compartilhadas unidas.
export function sculpt(geo,fn){const p=geo.attributes.position,v=V();for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);fn(v);p.setXYZ(i,v.x,v.y,v.z);}geo.computeVertexNormals();return geo;}
// Coleção de peças por material; ao final, uma malha por material.
export class Kit {
  constructor(){this.parts=new Map();}
  add(material,geo,color,jitter){if(!geo)return this;let g=geo;if(color!==undefined)g=tint(g,color,jitter);else if(!g.attributes.color)g=tint(g,0xffffff,0);if(g.index)g=g.toNonIndexed();if(g.attributes.uv)g.deleteAttribute('uv');if(!g.attributes.normal)g.computeVertexNormals();if(!this.parts.has(material))this.parts.set(material,[]);this.parts.get(material).push(g);return this;}
  build({shadows=true,origin=[0,0,0]}={}){const group=new THREE.Group();for(const [m,geos]of this.parts){const merged=mergeGeometries(geos.map(g=>{for(const k of Object.keys(g.attributes))if(!['position','normal','color'].includes(k))g.deleteAttribute(k);return g;}));merged.translate(-origin[0],-origin[1],-origin[2]);const mesh=new THREE.Mesh(merged,m);mesh.castShadow=shadows;mesh.receiveShadow=true;group.add(mesh);geos.forEach(g=>g.dispose());}return group;}
}
export {V,rand};

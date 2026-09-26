import * as THREE from 'three';
import {Kit,loft,ellipsoid,limb,paint,reseed,V} from './geometry.js';

// Espécies: comprimento (m), faixa de peso (kg), dificuldade (0..1), raridade (peso relativo), cores.
export const SPECIES=[
  {name:'Sardinha',len:.22,kg:[.08,.2],diff:.15,rarity:30,top:0x2b4f73,side:0xb9c8d2,belly:0xf2f4f5,shape:'slim'},
  {name:'Tainha',len:.38,kg:[.5,1.3],diff:.3,rarity:24,top:0x4f5b62,side:0xa9b2b6,belly:0xe9ecea,shape:'slim',stripes:true},
  {name:'Pargo-rosa',len:.42,kg:[.9,2.6],diff:.45,rarity:16,top:0xb8433f,side:0xe07f74,belly:0xf5d6cf,shape:'deep'},
  {name:'Robalo',len:.58,kg:[1.4,4.2],diff:.55,rarity:13,top:0x3d4a45,side:0xc2c9c4,belly:0xf1f1ec,shape:'slim',line:true},
  {name:'Garoupa',len:.62,kg:[3,8.5],diff:.75,rarity:8,top:0x5a3b27,side:0x8d6446,belly:0xd9c3a3,shape:'deep',spots:true},
  {name:'Dourado',len:.85,kg:[4,11],diff:.9,rarity:5,top:0x2e7d5a,side:0xd8b93a,belly:0xf1e7a8,shape:'blunt',spots:true},
  {name:'Bota velha',len:.3,kg:[.6,.6],diff:.2,rarity:4,boot:true},
];
export function pickSpecies(r){const total=SPECIES.reduce((s,f)=>s+f.rarity,0);let x=r*total;for(let i=0;i<SPECIES.length;i++){x-=SPECIES[i].rarity;if(x<0)return i;}return 0;}
function flopMaterial(opts){
  const m=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,side:THREE.DoubleSide,...opts});
  m.userData.uniforms={uFlop:{value:0},uPhase:{value:0},uLen:{value:.3}};
  m.onBeforeCompile=s=>{Object.assign(s.uniforms,m.userData.uniforms);
    s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nuniform float uFlop,uPhase,uLen;').replace('#include <begin_vertex>',`#include <begin_vertex>
      float along=clamp((uLen*.45-transformed.z)/uLen,0.,1.2);
      // curva em C que alterna de lado + ondulação da cauda
      transformed.x+=uFlop*(sin(uPhase)*along*along*uLen*.9+sin(uPhase*1.7-along*5.)*along*uLen*.18);`);};
  m.customProgramCacheKey=()=>'flop';return m;
}
export function makeFish(index=0){
  const sp=SPECIES[index],L=sp.len||.3,kit=new Kit();reseed(index+7);
  const mat=flopMaterial({roughness:sp.boot?.9:.3,metalness:sp.boot?0:.45});
  if(sp.boot){
    kit.add(mat,loft([{z:-.1,cy:.12,rx:.055,rz:.07},{z:-.02,cy:.11,rx:.06,rz:.075},{z:.08,cy:.04,rx:.055,rz:.05},{z:.16,cy:.03,rx:.04,rz:.035}],{axis:'z',n:10}),0x4a3322,.12);
    kit.add(mat,loft([{y:.1,cx:0,cz:-.07,rx:.05,rz:.05},{y:.26,cx:0,cz:-.08,rx:.055,rz:.05}],{n:10}),0x4a3322,.12);
    kit.add(mat,loft([{z:-.11,cy:-.005,rx:.058,rz:.012},{z:.17,cy:-.005,rx:.042,rz:.012}],{axis:'z',n:8}),0x1f1a15,.1);
  }else{
    const deep=sp.shape==='deep'?1.35:sp.shape==='blunt'?1.2:1;
    const rings=[[-.5,.018,.04],[-.42,.03,.07],[-.25,.07,.16],[-.02,.1,.22],[.2,.095,.2],[.36,.07,.15],[.46,.035,.08],[.5,.01,.02]];
    const body=loft(rings.map(([z,w,h])=>({z:z*L,cy:0,rx:w*L,rz:h*L*deep*(sp.shape==='blunt'&&z>.25?1.25:1),pow:2.1})),{axis:'z',n:14});
    const top=new THREE.Color(sp.top),side=new THREE.Color(sp.side),belly=new THREE.Color(sp.belly);
    kit.add(mat,paint(body,(v,c)=>{const h=c.y/(L*.2*deep);let col=h>.25?top.clone().lerp(side,THREE.MathUtils.clamp(1-(h-.25)*2,0,1)):h>-.3?side.clone():side.clone().lerp(belly,THREE.MathUtils.clamp(-(h+.3)*2.5,0,1));
      if(sp.line&&Math.abs(h-.05)<.08)col=new THREE.Color(0x1c2224);if(sp.stripes&&h>0&&Math.sin(c.y*140)>.6)col.multiplyScalar(.75);if(sp.spots&&Math.sin(c.z*90)*Math.sin(c.y*110)>.55)col=sp.name==='Dourado'?new THREE.Color(0x2c6aa8):col.clone().multiplyScalar(.55);return col;},.05));
    const fin=(pts,color)=>{const g=new THREE.BufferGeometry().setFromPoints(pts.map(p=>V(p[0]*L,p[1]*L*deep,p[2]*L)));g.computeVertexNormals();kit.add(mat,g,color,.05);};
    const finCol=new THREE.Color(sp.top).lerp(new THREE.Color(sp.side),.4).getHex();
    fin([[0,0,-.47],[0,.19,-.66],[0,.03,-.56], [0,0,-.47],[0,.03,-.56],[0,-.19,-.66]],finCol);
    fin([[0,.2,.12],[0,.33,-.02],[0,.19,-.25], [0,.2,.12],[0,.19,-.25],[0,.21,.02]],finCol);
    fin([[0,-.19,-.1],[0,-.28,-.2],[0,-.16,-.3]],finCol);
    for(const s of [-1,1]){fin([[s*.09,-.05,.22],[s*.2,-.12,.08],[s*.1,-.09,.12]],finCol);
      kit.add(mat,ellipsoid([s*.075*L,.055*L*deep,.36*L],[.028*L,.03*L,.028*L],8,6),0xf2efe4,.02);kit.add(mat,ellipsoid([s*.088*L,.057*L*deep,.37*L],[.016*L,.018*L,.016*L],6,4),0x0c0d0e,.02);
      kit.add(mat,limb(V(s*.07*L,.02*L,.28*L),V(s*.06*L,-.09*L*deep,.3*L),.004,.004,4),new THREE.Color(sp.side).multiplyScalar(.7));}
    kit.add(mat,ellipsoid([0,-.035*L,.49*L],[.03*L,.012*L,.02*L],6,4),0x2a1a18,.02);
  }
  const g=kit.build();g.name=sp.name;const root=new THREE.Group();root.add(g);
  root.userData={species:index,mat,len:L,flop:0,phase:Math.random()*6};
  return root;
}
// Debater: fase avança rápido com a intensidade; corpo inteiro também dá pulos.
export function flop(fish,dt,intensity){const u=fish.userData,m=u.mat.userData.uniforms;u.phase+=dt*(6+intensity*16);m.uPhase.value=u.phase;m.uFlop.value=intensity;m.uLen.value=u.len;return u.phase;}

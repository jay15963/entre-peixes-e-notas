import * as THREE from 'three';
export const JOINTS={
  torso:{origin:[0,.98,0],center:[0,1.16,0],size:[.34,.43,.22],parent:null},
  head:{origin:[0,1.43,0],center:[0,1.65,0],size:[.25,.39,.24],parent:'torso'},
  armL:{origin:[-.215,1.31,0],center:[-.273,1.20,0],size:[.13,.26,.15],parent:'torso'},
  armR:{origin:[.215,1.31,0],center:[.273,1.20,0],size:[.13,.26,.15],parent:'torso'},
  foreL:{origin:[-.33,1.083,0],center:[-.385,.94,.02],size:[.10,.28,.10],parent:'armL'},
  foreR:{origin:[.33,1.083,0],center:[.385,.94,.02],size:[.10,.28,.10],parent:'armR'},
  thighL:{origin:[-.095,.87,0],center:[-.105,.72,0],size:[.17,.30,.18],parent:'torso'},
  thighR:{origin:[.095,.87,0],center:[.105,.72,0],size:[.17,.30,.18],parent:'torso'},
  shinL:{origin:[-.11,.574,0],center:[-.11,.29,.025],size:[.12,.51,.16],parent:'thighL'},
  shinR:{origin:[.11,.574,0],center:[.11,.29,.025],size:[.12,.51,.16],parent:'thighR'},
};
// Onde cada foto cai na cabeça: centro entre os olhos (u,v a partir do topo) e escala em "unidades de textura por metro".
// Medido nas fotos: olhos, ponta do nariz, boca e queixo alinhados à malha (olhos do modelo em x=±0,061, y=1,638).
export const FACE_FIT=[
  {u:.485,v:.512,su:2.21,sv:1.8,eyeY:1.638,mask:[.118,.158,1.6]},
  {u:.477,v:.413,su:1.33,sv:1.25,eyeY:1.638,mask:[.112,.155,1.6]},
];
// A foto já contém olhos, sobrancelhas, boca e barba: essas peças saem para não duplicar o rosto.
// Média da pele na foto (bochechas e testa), em espaço linear, para equilibrar a cor com a pele do modelo.
function faceAverage(image,fit){
  const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(image,0,0);
  const sum=[0,0,0];let n=0;const lin=v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);};
  for(const [dx,dy]of [[-.045,-.04],[.045,-.04],[0,.09],[-.06,-.07],[.06,-.07]]){const cu=fit.u+dx*fit.su,cv=fit.v+dy*fit.sv;const d=x.getImageData(Math.floor(cu*c.width)-3,Math.floor(cv*c.height)-3,6,6).data;for(let i=0;i<d.length;i+=4){sum[0]+=lin(d[i]);sum[1]+=lin(d[i+1]);sum[2]+=lin(d[i+2]);n++;}}
  return new THREE.Vector3(sum[0]/n,sum[1]/n,sum[2]/n);
}
export async function loadAssets(){
  const data=window.PESCA;
  const materials=data.materials.map(m=>new THREE.MeshStandardMaterial({color:new THREE.Color(...m.color).convertSRGBToLinear(),roughness:m.rough,metalness:m.metal,flatShading:true,side:THREE.DoubleSide}));
  const loader=new THREE.TextureLoader(),faces=await Promise.all([1,2].map(i=>loader.loadAsync(`${import.meta.env.BASE_URL}assets/rosto-0${i}.png`)));
  faces.forEach(t=>{t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;});
  const averages=typeof document==='undefined'?[new THREE.Vector3(.5,.4,.35),new THREE.Vector3(.5,.4,.35)]:faces.map((t,i)=>faceAverage(t.image,FACE_FIT[i]));
  return {data,materials,faces,averages};
}
// Material de pele com a foto projetada na própria malha da cabeça (não é um plano colado):
// projeção frontal em espaço do objeto, máscara elíptica e pela normal, e balanço de branco para a cor da pele.
export function faceMaterial(assets,index,skin){
  const fit=FACE_FIT[index],avg=assets.averages[index],base=skin.color;
  const gain=new THREE.Vector3(base.r/Math.max(avg.x,1e-3),base.g/Math.max(avg.y,1e-3),base.b/Math.max(avg.z,1e-3));
  const m=new THREE.MeshStandardMaterial({color:skin.color.clone(),roughness:.62,metalness:0});
  m.userData.face={fit,gain,map:assets.faces[index]};
  m.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{uFace:{value:assets.faces[index]},uFit:{value:new THREE.Vector4(fit.u,fit.v,fit.su,fit.sv)},uEyeY:{value:fit.eyeY-1.43},uMask:{value:new THREE.Vector3(...fit.mask)},uGain:{value:gain}});
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vFacePos;varying vec3 vFaceNormal;').replace('#include <begin_vertex>','#include <begin_vertex>\nvFacePos=position;vFaceNormal=normal;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vFacePos;varying vec3 vFaceNormal;uniform sampler2D uFace;uniform vec4 uFit;uniform float uEyeY;uniform vec3 uMask,uGain;')
      .replace('#include <map_fragment>',`
      vec2 fuv=vec2(uFit.x+vFacePos.x*uFit.z,1.-(uFit.y+(uEyeY-vFacePos.y)*uFit.w));
      // equilíbrio de branco: a média da pele na foto passa a ser exatamente a cor da pele do modelo
      vec3 graded=texture2D(uFace,fuv).rgb*uGain;
      vec2 e=vec2(vFacePos.x/uMask.x,(vFacePos.y-(uEyeY-.03))/uMask.y);
      float mask=1.-smoothstep(.72,1.,length(e));
      mask*=smoothstep(.05,.45,normalize(vFaceNormal).z);
      diffuseColor.rgb=mix(diffuseColor.rgb,graded,mask);
      `);
  };
  m.customProgramCacheKey=()=>'face-'+index;
  return m;
}
export function setFirstPerson(root,on){root.userData.joints.head.visible=!on;}
export {makeCharacter} from './characters.js';
export {makeBoat,addHelm,addLantern,addMotor} from './boat.js';
export {makeFish} from './fish.js';

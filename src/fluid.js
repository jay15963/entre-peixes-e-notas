import * as THREE from 'three';
// Simulação de altura de fluido na GPU (equação de onda amortecida em grade 2D, ping-pong).
// Canal R: altura (m). Canal G: velocidade vertical (m/s). Canal B: espuma acumulada.
const quadVertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const stepFragment=`precision highp float;
uniform sampler2D uState;uniform vec2 uTexel;uniform float uDt,uC2,uCell,uDamp;
varying vec2 vUv;
void main(){
  vec4 s=texture2D(uState,vUv);
  float hl=texture2D(uState,vUv-vec2(uTexel.x,0.)).r,hr=texture2D(uState,vUv+vec2(uTexel.x,0.)).r;
  float hd=texture2D(uState,vUv-vec2(0.,uTexel.y)).r,hu=texture2D(uState,vUv+vec2(0.,uTexel.y)).r;
  // Laplaciano de 9 pontos: frentes mais redondas e menos anisotropia da grade.
  float d1=texture2D(uState,vUv+uTexel).r+texture2D(uState,vUv-uTexel).r+texture2D(uState,vUv+vec2(uTexel.x,-uTexel.y)).r+texture2D(uState,vUv+vec2(-uTexel.x,uTexel.y)).r;
  float lap=(4.*(hl+hr+hd+hu)+d1-20.*s.r)/(6.*uCell*uCell);
  float v=(s.g+uC2*lap*uDt)*uDamp;
  float h=s.r+v*uDt;
  vec2 edge=min(vUv,1.-vUv);float sponge=smoothstep(0.,.06,min(edge.x,edge.y));
  h*=mix(.97,1.,sponge);v*=mix(.97,1.,sponge);
  float slope=length(vec2(hr-hl,hu-hd))/(2.*uCell);
  float foam=max(s.b*.992,smoothstep(.35,1.1,slope)+smoothstep(2.5,7.,abs(v))*.6);
  gl_FragColor=vec4(h,v,clamp(foam,0.,1.),1.);
}`;
const dropFragment=`precision highp float;
uniform sampler2D uState;uniform vec2 uCenter;uniform float uRadius,uDepth,uRim,uSize,uFoam;
varying vec2 vUv;
void main(){
  vec4 s=texture2D(uState,vUv);
  float r=length((vUv-.5)*uSize-uCenter);
  float crater=-uDepth*exp(-pow(r/uRadius,2.));
  float rim=uRim*exp(-pow((r-uRadius*1.35)/(uRadius*.35),2.));
  gl_FragColor=vec4(s.r+crater+rim,s.g,max(s.b,exp(-pow(r/(uRadius*1.6),2.))*uFoam),1.);
}`;
export class FluidSim {
  constructor(renderer,{resolution=256,size=640}={}){
    this.renderer=renderer;this.size=size;this.resolution=resolution;this.center=new THREE.Vector2();this.active=false;this.accumulator=0;
    const opts={type:THREE.HalfFloatType,format:THREE.RGBAFormat,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:false,stencilBuffer:false,wrapS:THREE.ClampToEdgeWrapping,wrapT:THREE.ClampToEdgeWrapping};
    this.targets=[new THREE.WebGLRenderTarget(resolution,resolution,opts),new THREE.WebGLRenderTarget(resolution,resolution,opts)];
    this.camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);this.scene=new THREE.Scene();
    this.stepMaterial=new THREE.ShaderMaterial({uniforms:{uState:{value:null},uTexel:{value:new THREE.Vector2(1/resolution,1/resolution)},uDt:{value:1/60},uC2:{value:64},uCell:{value:size/resolution},uDamp:{value:.9985}},vertexShader:quadVertex,fragmentShader:stepFragment,depthTest:false,depthWrite:false});
    this.dropMaterial=new THREE.ShaderMaterial({uniforms:{uState:{value:null},uCenter:{value:new THREE.Vector2()},uRadius:{value:10},uDepth:{value:1},uRim:{value:0},uSize:{value:size},uFoam:{value:1}},vertexShader:quadVertex,fragmentShader:dropFragment,depthTest:false,depthWrite:false});
    this.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.stepMaterial);this.quad.frustumCulled=false;this.scene.add(this.quad);
    this.uniforms={uSim:{value:this.targets[0].texture},uSimCenter:{value:this.center},uSimSize:{value:size},uSimOn:{value:0}};
    this.clear();
  }
  clear(){const old=this.renderer.getRenderTarget(),c=this.renderer.getClearColor(new THREE.Color()),a=this.renderer.getClearAlpha();this.renderer.setClearColor(0x000000,0);for(const t of this.targets){this.renderer.setRenderTarget(t);this.renderer.clear();}this.renderer.setRenderTarget(old);this.renderer.setClearColor(c,a);}
  start(center,speed){this.center.copy(center);this.active=true;this.uniforms.uSimOn.value=1;this.stepMaterial.uniforms.uC2.value=speed*speed;this.clear();}
  stop(){this.active=false;this.uniforms.uSimOn.value=0;}
  pass(material){const [src,dst]=this.targets;material.uniforms.uState.value=src.texture;this.quad.material=material;const old=this.renderer.getRenderTarget();this.renderer.setRenderTarget(dst);this.renderer.render(this.scene,this.camera);this.renderer.setRenderTarget(old);this.targets=[dst,src];this.uniforms.uSim.value=dst.texture;}
  // Perturbação em coordenadas do mundo (x,z).
  drop(x,z,radius,depth,rim=0,foam=1){if(!this.active)return;const u=this.dropMaterial.uniforms;u.uFoam.value=foam;u.uCenter.value.set(x-this.center.x,-(z-this.center.y));u.uRadius.value=radius;u.uDepth.value=depth;u.uRim.value=rim;this.pass(this.dropMaterial);}
  update(dt){if(!this.active)return;const step=1/60,cell=this.size/this.resolution,c=Math.sqrt(this.stepMaterial.uniforms.uC2.value),maxStep=.45*cell/Math.max(c,1e-3),sub=Math.max(1,Math.ceil(step/maxStep));this.stepMaterial.uniforms.uDt.value=step/sub;this.accumulator=Math.min(this.accumulator+dt,.1);while(this.accumulator>=step){for(let i=0;i<sub;i++)this.pass(this.stepMaterial);this.accumulator-=step;}}
}
// GLSL de amostragem usado pelo oceano. A textura usa v invertido (z do mundo cresce para "baixo").
export const fluidGLSL=`
uniform sampler2D uSim;uniform vec2 uSimCenter;uniform float uSimSize,uSimOn;
vec3 simSample(vec2 p){
  if(uSimOn<.5)return vec3(0.);
  vec2 uv=(vec2(p.x-uSimCenter.x,-(p.y-uSimCenter.y)))/uSimSize+.5;
  if(uv.x<0.||uv.y<0.||uv.x>1.||uv.y>1.)return vec3(0.);
  vec2 e=min(uv,1.-uv);float fade=smoothstep(0.,.05,min(e.x,e.y));
  return texture2D(uSim,uv).rgb*vec3(fade,fade,fade);
}`;

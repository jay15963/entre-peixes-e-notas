import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {SMAAPass} from 'three/addons/postprocessing/SMAAPass.js';

// Lente cinematográfica em HDR linear (antes do tone mapping do OutputPass).
const CinematicShader={
  uniforms:{tDiffuse:{value:null},uTime:{value:0},uFlash:{value:0},uAberration:{value:.0015},uRadial:{value:0},uCenter:{value:new THREE.Vector2(.5,.5)},uVignette:{value:.9},uGrain:{value:.035},uSaturation:{value:1.08},uContrast:{value:1.06},uTint:{value:new THREE.Vector3(1,1,1)},uExposure:{value:1},uLetterbox:{value:0},uRed:{value:0},uStorm:{value:0}},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform sampler2D tDiffuse;uniform float uTime,uFlash,uAberration,uRadial,uVignette,uGrain,uSaturation,uContrast,uExposure,uLetterbox,uRed,uStorm;uniform vec2 uCenter;uniform vec3 uTint;varying vec2 vUv;
float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){
  vec2 uv=vUv,d=uv-.5;float r2=dot(d,d);
  // Aberração cromática radial
  vec2 off=d*(uAberration*(1.+r2*4.));
  vec3 col;
  if(uRadial>.001){
    // Blur radial (zoom) a partir do ponto de impacto na tela
    vec3 acc=vec3(0.);vec2 dir=uv-uCenter;float tot=0.;
    for(int i=0;i<14;i++){float k=float(i)/13.;vec2 s=uv-dir*k*uRadial;float w=1.-k*.6;acc+=vec3(texture2D(tDiffuse,s+off).r,texture2D(tDiffuse,s).g,texture2D(tDiffuse,s-off).b)*w;tot+=w;}
    col=acc/tot;
  }else col=vec3(texture2D(tDiffuse,uv+off).r,texture2D(tDiffuse,uv).g,texture2D(tDiffuse,uv-off).b);
  col*=uExposure*uTint;
  // Gradação: contraste em log, saturação, sombras frias e altas luzes quentes
  float l=dot(col,vec3(.2126,.7152,.0722));
  col=mix(vec3(l),col,uSaturation);
  col=pow(max(col,0.)/.18,vec3(uContrast))*.18;
  vec3 shadowTint=mix(vec3(.94,1.,1.08),vec3(1.1,.9,.88),uRed);
  col*=mix(shadowTint,vec3(1.05,1.,.94),smoothstep(0.,.6,l));
  // Clarão do impacto
  col=mix(col,vec3(6.,5.6,5.)*(1.+col),clamp(uFlash,0.,1.)*.92);
  // Vinheta e grão
  col*=mix(1.,(1.-smoothstep(.2,.95,sqrt(r2)*1.25)),uVignette);
  col+=(h(uv*vec2(1920.,1080.)+fract(uTime)*97.)-.5)*uGrain*(.3+l);
  gl_FragColor=vec4(max(col,0.),1.);
}`};
export class Post {
  constructor(renderer,scene,camera,quality='high'){
    this.renderer=renderer;this.enabled=true;
    const size=renderer.getDrawingBufferSize(new THREE.Vector2());
    this.composer=new EffectComposer(renderer,new THREE.WebGLRenderTarget(size.x,size.y,{type:THREE.HalfFloatType}));
    this.composer.addPass(new RenderPass(scene,camera));
    this.bloom=new UnrealBloomPass(new THREE.Vector2(size.x/2,size.y/2),.4,.45,2.2);this.composer.addPass(this.bloom);
    // Um único pixel NaN/infinito contaminaria a tela inteira pelo bloom: o filtro de brilho descarta e limita picos.
    const hp=this.bloom.materialHighPassFilter;hp.fragmentShader=hp.fragmentShader.replace('vec4 texel = texture2D( tDiffuse, vUv );','vec4 texel = texture2D( tDiffuse, vUv );if(any(isnan(texel))||any(isinf(texel)))texel=vec4(0.);texel=min(texel,vec4(12.));');hp.needsUpdate=true;
    this.cinema=new ShaderPass(CinematicShader);this.composer.addPass(this.cinema);
    this.composer.addPass(new OutputPass());
    // Sem MSAA no alvo HDR (o bloom aditivo acumularia sobre o buffer multiamostrado): SMAA no fim da cadeia.
    if(quality!=='low')this.composer.addPass(new SMAAPass());
    this.u=this.cinema.uniforms;
  }
  setSize(w,h){this.composer.setPixelRatio(this.renderer.getPixelRatio());this.composer.setSize(w,h);}
  render(dt){this.u.uTime.value+=dt;this.composer.render(dt);}
}

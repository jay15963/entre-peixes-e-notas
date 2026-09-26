import * as THREE from 'three';
import {CONFIG,clamp,smooth,lerp,tsunamiRadius,tsunamiAmplitude} from './core.js';
import {U,noiseGLSL,skyGLSL} from './shaders.js';
import {fbm3} from './environment.js';

// Gerador determinístico: os dois jogadores veem os mesmos destroços.
function rng(seed){let s=seed>>>0;return()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}

// ---------- Partículas simuladas na GPU (billboards instanciados, buffer circular) ----------
const particleVertex=`
uniform float uTime;uniform vec3 uWind;
attribute vec3 aP0,aV;attribute vec4 aT;attribute vec4 aS;
varying float vF,vSeed,vDist;varying vec2 vUv;varying vec3 vWorld;
void main(){
  float age=uTime-aT.x,life=aT.y;
  if(age<0.||age>life){gl_Position=vec4(2.,2.,2.,1.);return;}
  float k=aT.z,g=aT.w;
  vec3 disp=k>0.?aV*(1.-exp(-k*age))/k:aV*age;
  vec3 pos=aP0+disp+vec3(0.,-4.9*g,0.)*age*age+uWind*age*aS.w;
  float f=age/life;vF=f;vSeed=aS.z;vWorld=pos;
  float size=mix(aS.x,aS.y,1.-(1.-f)*(1.-f));
  vec4 mv=viewMatrix*vec4(pos,1.);vDist=-mv.z;
  float a=aS.z*6.283+age*(aS.z-.5)*.6;vec2 c=position.xy;c=vec2(c.x*cos(a)-c.y*sin(a),c.x*sin(a)+c.y*cos(a));
  mv.xy+=c*size;vUv=position.xy+.5;
  gl_Position=projectionMatrix*mv;
}`;
const particleFragment=`
uniform float uOpacity,uGlow,uGlowRadius,uKind;uniform vec2 uNear;uniform vec3 uDark,uLight,uGlowPos,uGlowColor;
varying float vF,vSeed,vDist;varying vec2 vUv;varying vec3 vWorld;
${noiseGLSL}
void main(){
  vec2 p=vUv-.5;float d=length(p)*2.;
  float n=fbm(p*3.2+vSeed*17.+vF*.8);
  float shape=(1.-smoothstep(.25,1.,d+(n-.5)*.9));
  if(shape<.01)discard;
  vec3 col;float alpha;
  if(uKind<.5){ // fumaça / vapor iluminado
    float lit=clamp(.45+(n-.5)*1.3-p.y*.9,0.,1.);
    col=mix(uDark,uLight,lit);
    float gl=uGlow*exp(-length(vWorld-uGlowPos)/uGlowRadius);col+=uGlowColor*gl*(1.-lit*.4);
    alpha=shape*smoothstep(0.,.08,vF)*(1.-smoothstep(.55,1.,vF))*uOpacity;
  }else if(uKind<1.5){ // fogo: rampa de temperatura
    float temp=clamp(1.-vF*1.25+(n-.5)*.5,0.,1.);
    col=mix(vec3(.25,.04,.01),vec3(1.6,.55,.13),smoothstep(0.,.5,temp));col=mix(col,vec3(2.6,1.9,1.1),smoothstep(.65,1.,temp));
    alpha=shape*(1.-vF)*uOpacity*.45;col*=alpha;
  }else{ // borrifo d'água
    col=mix(uDark,uLight,clamp(.55+(n-.5)-p.y,0.,1.));
    float gl=uGlow*exp(-length(vWorld-uGlowPos)/uGlowRadius);col+=uGlowColor*gl;
    alpha=shape*smoothstep(0.,.05,vF)*(1.-vF)*uOpacity;
  }
  alpha*=smoothstep(uNear.x,uNear.y,vDist);if(uKind>.5&&uKind<1.5)col*=smoothstep(uNear.x,uNear.y,vDist);
  gl_FragColor=vec4(col,alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
export class Particles {
  constructor(scene,count,{kind=0,additive=false,dark=[.1,.1,.1],light=[.6,.6,.6],opacity=1,glowColor=[1,.4,.1],glowRadius=80,wind=[0,0,0],near=[3,40]}={}){
    const base=new THREE.PlaneGeometry(1,1),g=new THREE.InstancedBufferGeometry();g.index=base.index;g.setAttribute('position',base.attributes.position);g.instanceCount=count;
    this.count=count;this.head=0;this.a={};
    for(const [name,size]of [['aP0',3],['aV',3],['aT',4],['aS',4]]){const arr=new Float32Array(count*size);if(name==='aT')for(let i=0;i<count;i++)arr[i*4]=-1e9;const attr=new THREE.InstancedBufferAttribute(arr,size);attr.setUsage(THREE.DynamicDrawUsage);g.setAttribute(name,attr);this.a[name]=attr;}
    this.uniforms={uTime:U.uTime,uWind:{value:new THREE.Vector3(...wind)},uOpacity:{value:opacity},uGlow:{value:0},uGlowRadius:{value:glowRadius},uGlowPos:{value:new THREE.Vector3()},uGlowColor:{value:new THREE.Color(...glowColor)},uDark:{value:new THREE.Color(...dark)},uLight:{value:new THREE.Color(...light)},uKind:{value:kind},uNear:{value:new THREE.Vector2(...near)}};
    this.mesh=new THREE.Mesh(g,new THREE.ShaderMaterial({uniforms:this.uniforms,vertexShader:particleVertex,fragmentShader:particleFragment,transparent:true,depthWrite:false,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending}));
    this.mesh.frustumCulled=false;this.mesh.renderOrder=kind===1?3:2;scene.add(this.mesh);this.dirty=[];
  }
  // p0, v, [life, drag, gravityScale], [size0,size1,windScale]
  emit(time,x,y,z,vx,vy,vz,life,drag,grav,s0,s1,wind=0){
    const i=this.head;this.head=(this.head+1)%this.count;const {aP0,aV,aT,aS}=this.a;
    aP0.array.set([x,y,z],i*3);aV.array.set([vx,vy,vz],i*3);aT.array.set([time,life,drag,grav],i*4);aS.array.set([s0,s1,Math.random(),wind],i*4);this.dirty.push(i);
  }
  flush(){if(!this.dirty.length)return;let min=Infinity,max=-1;for(const i of this.dirty){min=Math.min(min,i);max=Math.max(max,i);}
    for(const [name,attr]of Object.entries(this.a)){const s=attr.itemSize;attr.clearUpdateRanges();attr.addUpdateRange(min*s,(max-min+1)*s);attr.needsUpdate=true;}this.dirty.length=0;}
}

// ---------- Meteoro ----------
function asteroidGeometry(){
  const g=new THREE.IcosahedronGeometry(1,4),p=g.attributes.position,v=new THREE.Vector3();
  const craters=[];const r=rng(7);for(let i=0;i<14;i++)craters.push([new THREE.Vector3(r()-.5,r()-.5,r()-.5).normalize(),.15+r()*.3,.05+r()*.08]);
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);const n=v.clone().normalize();let h=1+(fbm3(n.x*2.2,n.y*2.2,n.z*2.2,5)-.5)*.55;for(const [c,rad,depth]of craters){const d=n.distanceTo(c);if(d<rad){const x=d/rad;h-=depth*(1-x*x)-(x>.75?depth*.6*(1-Math.abs(x-.88)/.13):0);}}v.copy(n).multiplyScalar(h);v.x*=1.15;v.z*=.9;p.setXYZ(i,v.x,v.y,v.z);}
  return g.toNonIndexed();
}
const rockVertex=`varying vec3 vObj,vWorld;void main(){vObj=position;vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`;
const rockFragment=`uniform vec3 uVel;uniform float uHeat,uTime;varying vec3 vObj,vWorld;${noiseGLSL}
void main(){
  vec3 n=normalize(cross(dFdx(vWorld),dFdy(vWorld)));
  float front=max(dot(n,uVel),0.);
  float cr=abs(fbm3(vObj*3.2)-.5);float cracks=(1.-smoothstep(.0,.05,cr))*(.5+.5*noise3(vObj*9.+uTime));
  vec3 rock=vec3(.05,.035,.03)*(.6+.8*noise3(vObj*14.));
  vec3 light=vec3(.9,.25,.08)*max(dot(n,normalize(vec3(.2,1.,.4))),0.)*.3;
  vec3 hot=mix(vec3(3.,.7,.12),vec3(9.,6.,3.5),pow(front,3.));
  vec3 col=rock+light+cracks*vec3(4.,1.1,.2)*uHeat+hot*pow(front,1.6)*uHeat;
  gl_FragColor=vec4(col,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const glowVertex=`varying vec3 vN,vV,vObj;varying vec2 vUv;void main(){vUv=uv;vObj=position;vec4 w=modelViewMatrix*vec4(position,1.);vV=normalize(-w.xyz);vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*w;}`;
const sheathFragment=`uniform float uTime,uAlpha;varying vec3 vN,vV,vObj;varying vec2 vUv;${noiseGLSL}
void main(){float f=abs(dot(vN,vV));float rim=pow(1.-f,2.2);float n=noise3(vObj*4.+vec3(0.,0.,uTime*8.));
  float front=smoothstep(-.3,1.,vObj.z);vec3 col=mix(vec3(2.2,.55,.1),vec3(3.6,2.7,1.6),front);
  gl_FragColor=vec4(col*rim*(.55+.7*n)*uAlpha*(.35+.65*front),1.);}`;
// Cauda: fitas voltadas para a câmera ao longo do eixo do movimento (visíveis de qualquer ângulo).
const ribbonVertex=`uniform vec3 uHead,uAxis;uniform float uLen,uW0,uW1,uTime;varying vec2 vUv;varying float vNear;
void main(){vUv=uv;float along=1.-uv.y;// 0 na cabeça
  vec3 p=uHead+uAxis*(along*uLen);vec3 side=normalize(cross(uAxis,cameraPosition-p));
  float w=mix(uW0,uW1,pow(along,.7))*(1.+.12*sin(along*40.-uTime*9.));
  p+=side*(uv.x-.5)*w;vNear=smoothstep(40.,320.,length(cameraPosition-p));gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`;
const trailFragment=`uniform float uTime,uAlpha,uLayer;varying vec2 vUv;varying float vNear;${noiseGLSL}
void main(){float along=vUv.y;float x=abs(vUv.x-.5)*2.;float outer=step(.5,uLayer);
  float streak=fbm(vec2(vUv.x*mix(10.,6.,outer),along*mix(40.,22.,outer)-uTime*mix(9.,5.,outer)));
  float edge=x+(streak-.5)*mix(.35,.9,outer);
  float body=exp(-edge*edge*mix(9.,3.5,outer));
  float heat=pow(along,mix(7.,12.,outer));
  vec3 col=mix(vec3(.55,.07,.015),vec3(1.5,.42,.08),smoothstep(.0,.35,heat));col=mix(col,vec3(3.,2.4,1.6),smoothstep(.55,1.,heat)*(1.-outer*.6));
  float fade=smoothstep(0.,.55,along)*(1.-smoothstep(.985,1.,along));
  float a=body*fade*mix(.7+.5*streak,smoothstep(.3,.7,streak+along*.25),outer);
  gl_FragColor=vec4(col*a*uAlpha*vNear,1.);}`;

// ---------- Bola de fogo, coroa d'água e domo de choque ----------
const fireballVertex=`uniform float uTime,uCool;varying vec3 vObj,vWorld,vNrm;varying float vN;${noiseGLSL}
void main(){vec3 p=position;float n=fbm3(p*1.4+vec3(0.,-uTime*.45,0.));float n2=noise3(p*4.+uTime*.3);vN=n;p*=1.+(n-.5)*.95+(n2-.5)*.18;p.y*=1.+max(p.y,0.)*.25;vObj=p;vNrm=normalize(mat3(modelMatrix)*normalize(p));vec4 w=modelMatrix*vec4(p,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`;
const fireballFragment=`uniform float uTime,uCool,uAlpha;varying vec3 vObj,vWorld,vNrm;varying float vN;${noiseGLSL}
void main(){vec3 n=normalize(vNrm);vec3 v=normalize(cameraPosition-vWorld);float f=max(dot(n,v),0.);
  float d=fbm3(vObj*2.4+vec3(0.,-uTime*.9,uTime*.2));float cells=fbm3(vObj*6.+uTime*.5);
  float hot=clamp(1.-uCool*1.25,0.,1.);
  float temp=clamp(hot*(d*1.7-.35+cells*.35)+hot*hot*.35*pow(f,2.)-(vObj.y>0.?vObj.y*.15*uCool:0.),0.,1.3);
  vec3 smoke=mix(vec3(.05,.042,.04),vec3(.3,.27,.25),clamp(d*1.3-.2+n.y*.3,0.,1.))*(.6+.4*f);
  smoke+=vec3(1.1,.35,.07)*(1.-hot)*clamp(-n.y+.2,0.,1.)*(.6+cells*.6)*step(uCool,.999)*(1.-uCool*.6);
  smoke+=vec3(.25,.07,.02)*hot*(1.-f)*.5;
  vec3 col=mix(smoke,vec3(1.3,.25,.04),smoothstep(.15,.45,temp));col=mix(col,vec3(3.2,1.7,.5),smoothstep(.45,.8,temp));col=mix(col,vec3(6.,5.2,4.),smoothstep(.95,1.25,temp));
  gl_FragColor=vec4(col,uAlpha*smoothstep(.05,.5,f)*(.75+.25*d));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const crownVertex=`uniform float uTime,uAge,uRadius,uHeight,uFlare;varying vec2 vUv;varying vec3 vWorld;${noiseGLSL}
void main(){vUv=uv;float v=uv.y,ang=uv.x*6.2831853;float n=noise(vec2(uv.x*24.,v*3.+uAge*.4));
  float r=uRadius*(1.+.08*sin(ang*7.))+pow(v,1.6)*uFlare*(0.8+n*.5);float y=v*uHeight*(.85+.3*n);
  vec3 p=vec3(cos(ang)*r,y,sin(ang)*r);vec4 w=modelMatrix*vec4(p,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`;
const crownFragment=`uniform float uTime,uAge,uAlpha,uImpactLight;varying vec2 vUv;varying vec3 vWorld;${noiseGLSL}
void main(){float v=vUv.y;float n=fbm(vec2(vUv.x*40.,v*6.-uAge*.9));float holes=smoothstep(.35+v*.45,.45+v*.45,n);
  float a=holes*(1.-smoothstep(.55,1.,v))*uAlpha*(.55+.45*n);if(a<.01)discard;
  vec3 col=mix(vec3(.45,.55,.6),vec3(.95,.93,.9),n);col+=vec3(1.4,.55,.18)*uImpactLight*(1.-v*.5);
  gl_FragColor=vec4(col,a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const domeFragment=`uniform float uAlpha;varying vec3 vN,vV,vObj;varying vec2 vUv;${noiseGLSL}
void main(){float f=abs(dot(vN,vV));float rim=pow(1.-f,4.);float n=fbm(vUv*vec2(30.,8.));gl_FragColor=vec4(vec3(.95,.93,.9),rim*uAlpha*(.5+.6*n));}`;

// ---------- Lábio da tsunami (a parte que se enrola sobre a face) ----------
const lipVertex=`
uniform vec3 uImpact;uniform float uTsuR,uTsuH,uCurl,uPhi,uTime;
varying vec2 vUv;varying vec3 vWorld;varying float vThin;
${noiseGLSL}
void main(){
  vUv=uv;float th=(uv.x-.5)*1.9,phi=uPhi+th;float edge=pow(sin(uv.x*3.14159),.6);
  float v=uv.y,H=uTsuH,rho=H*.2*edge,c=uCurl;
  float wob=(noise(vec2(uv.x*40.,uTime*.4))-.5)*H*.04;
  vec2 C=vec2(2.,H*.86+wob);
  float b0=-.6,b1=1.5708+1.1*c;float s,y;
  if(v<.3){float k=v/.3;vec2 a=vec2(-30.,H*.84),b=C+rho*vec2(sin(b0),cos(b0));k=k*k*(3.-2.*k);s=mix(a.x,b.x,k);y=mix(a.y,b.y,k);}
  else{float k=(v-.3)/.7;float beta=mix(b0,b1,k);s=C.x+rho*sin(beta);y=C.y+rho*cos(beta);}
  y=mix(H*.7,y,edge);vThin=smoothstep(.45,1.,v);
  float r=uTsuR+s;vec3 p=vec3(uImpact.x+cos(phi)*r,y,uImpact.z+sin(phi)*r);
  vWorld=p;gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);
}`;
const lipFragment=`
varying vec2 vUv;varying vec3 vWorld;varying float vThin;
${skyGLSL}
void main(){
  vec3 n=normalize(cross(dFdx(vWorld),dFdy(vWorld)));vec3 eye=normalize(cameraPosition-vWorld);if(dot(n,eye)<0.)n=-n;
  float fres=.02+.98*pow(1.-max(dot(n,eye),0.),5.);vec3 r=reflect(-eye,n);r.y=abs(r.y)+.01;
  vec3 refl=skyColor(normalize(r),0.);
  vec3 body=mix(vec3(.004,.03,.04),vec3(.02,.2,.17),vThin);
  // Luz atravessando a água fina do lábio (vermelho do céu e do impacto)
  body+=vec3(.5,.16,.05)*vThin*vThin*(.3+uImpactLight*.4)+vec3(.04,.3,.22)*vThin*.4;
  vec3 col=mix(body,refl*.6,fres*.7);
  float streak=fbm(vec2(vUv.x*90.,vUv.y*6.-uTime*.6));
  float foam=smoothstep(.62,.86,streak)*(.12+.45*vThin)+smoothstep(.9,1.,vUv.y)*smoothstep(.35,.6,streak)*.85+smoothstep(.2,.36,vUv.y)*(1.-smoothstep(.36,.5,vUv.y))*smoothstep(.45,.7,streak)*.7;
  col=mix(col,vec3(.92,.9,.86)*(.6+.4*uImpactLight),clamp(foam,0.,.95));
  vec3 fogDir=normalize(vec3(-eye.x,0.,-eye.z));col=mix(col,skyGradient(fogDir),1.-exp(-length(cameraPosition-vWorld)*.0035));
  gl_FragColor=vec4(col,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Cataclysm {
  constructor(scene,fluid,quality='high'){
    this.scene=scene;this.fluid=fluid;this.impact=null;this.fired={};this.lastT=0;const hi=quality!=='low';
    // Meteoro
    this.meteor=new THREE.Group();this.meteor.visible=false;scene.add(this.meteor);
    this.rockMat=new THREE.ShaderMaterial({uniforms:{uVel:{value:new THREE.Vector3(0,0,1)},uHeat:{value:1},uTime:U.uTime},vertexShader:rockVertex,fragmentShader:rockFragment});
    this.rock=new THREE.Mesh(asteroidGeometry(),this.rockMat);this.rock.scale.setScalar(13);this.meteor.add(this.rock);
    const glowMat=(frag,extra={})=>new THREE.ShaderMaterial({uniforms:{uTime:U.uTime,uAlpha:{value:1},...extra},vertexShader:glowVertex,fragmentShader:frag,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
    this.head=new THREE.Group();this.meteor.add(this.head);
    this.sheath=new THREE.Mesh(new THREE.SphereGeometry(1,40,24),glowMat(sheathFragment));this.sheath.scale.set(16.5,16.5,23);this.sheath.position.z=-5;this.head.add(this.sheath);
    // Cauda ao longo de -z (a cabeça aponta para +z, na direção do movimento); uv.y=1 junto da cabeça.
    const ribbon=layer=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(1,1,1,120),new THREE.ShaderMaterial({uniforms:{uTime:U.uTime,uAlpha:{value:1},uLayer:{value:layer},uHead:{value:new THREE.Vector3()},uAxis:{value:new THREE.Vector3(0,1,0)},uLen:{value:100},uW0:{value:10},uW1:{value:40}},vertexShader:ribbonVertex,fragmentShader:trailFragment,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));m.frustumCulled=false;m.renderOrder=6;m.visible=false;scene.add(m);return m;};
    this.trailCore=ribbon(0);this.trailOuter=ribbon(1);
    this.meteorLight=new THREE.PointLight(0xff7a30,0,0,0);scene.add(this.meteorLight);
    // Partículas
    const n=hi?1:.5;
    this.smoke=new Particles(scene,Math.floor(5000*n),{kind:0,dark:[.03,.025,.025],light:[.26,.2,.19],opacity:.9,glowColor:[1.6,.5,.12],glowRadius:120,wind:[4,0,1.5]});
    this.steam=new Particles(scene,Math.floor(4000*n),{kind:0,dark:[.16,.13,.13],light:[.66,.58,.55],opacity:.62,glowColor:[2.2,.8,.25],glowRadius:260,wind:[5,0,2]});
    this.fire=new Particles(scene,Math.floor(4000*n),{kind:1,additive:true,opacity:1});
    this.spray=new Particles(scene,Math.floor(9000*n),{kind:2,dark:[.35,.4,.42],light:[.95,.95,.93],opacity:.42,glowColor:[1.4,.5,.15],glowRadius:220,wind:[3,0,1]});
    // Impacto
    this.fireGlow=new THREE.Mesh(new THREE.SphereGeometry(1,48,24),glowMat(`uniform float uTime,uAlpha;varying vec3 vN,vV,vObj;varying vec2 vUv;void main(){float f=abs(dot(vN,vV));gl_FragColor=vec4(vec3(2.2,.8,.2)*pow(f,2.5)*uAlpha,1.);}`));this.fireGlow.visible=false;scene.add(this.fireGlow);
    this.fireball=new THREE.Mesh(new THREE.IcosahedronGeometry(1,hi?5:4),new THREE.ShaderMaterial({uniforms:{uTime:U.uTime,uCool:{value:0},uAlpha:{value:1}},vertexShader:fireballVertex,fragmentShader:fireballFragment,transparent:true,depthWrite:false}));this.fireball.visible=false;scene.add(this.fireball);
    this.crown=new THREE.Mesh(new THREE.CylinderGeometry(1,1,1,128,40,true),new THREE.ShaderMaterial({uniforms:{uTime:U.uTime,uAge:{value:0},uRadius:{value:10},uHeight:{value:0},uFlare:{value:0},uAlpha:{value:1},uImpactLight:U.uImpactLight},vertexShader:crownVertex,fragmentShader:crownFragment,transparent:true,depthWrite:false,side:THREE.DoubleSide}));this.crown.visible=false;this.crown.frustumCulled=false;scene.add(this.crown);
    this.dome=new THREE.Mesh(new THREE.SphereGeometry(1,64,24,0,Math.PI*2,0,Math.PI/2),glowMat(domeFragment));this.dome.material.blending=THREE.NormalBlending;this.dome.visible=false;scene.add(this.dome);
    this.impactLight=new THREE.PointLight(0xff8a40,0,0,0);scene.add(this.impactLight);
    // Destroços incandescentes
    this.debris=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),new THREE.MeshStandardMaterial({color:0x1a1210,emissive:0xff4a08,emissiveIntensity:1.2,roughness:.9,flatShading:true}),48);this.debris.visible=false;this.debris.frustumCulled=false;scene.add(this.debris);this.debrisData=[];
    // Lábio da tsunami
    this.lip=new THREE.Mesh(new THREE.PlaneGeometry(1,1,hi?220:120,hi?36:22),new THREE.ShaderMaterial({uniforms:{...U,uCurl:{value:0},uPhi:{value:0}},vertexShader:lipVertex,fragmentShader:lipFragment,side:THREE.DoubleSide}));this.lip.visible=false;this.lip.frustumCulled=false;scene.add(this.lip);
    this.tmp=new THREE.Object3D();this.shock=0;this.onShock=null;this.onDebrisSplash=null;
  }
  setImpact(impact){this.impact=impact;U.uImpact.value.set(impact.x,0,impact.z);}
  meteorPath(t){const I=U.uImpact.value,a=clamp((t-CONFIG.asteroidAt)/(CONFIG.impactAt-CONFIG.asteroidAt),0,1),dir=new THREE.Vector3(-.5,.52,.69).normalize();return {pos:I.clone().addScaledVector(dir,1000*(1-a)),dir,a};}
  crest(t,phi,s=2){const I=U.uImpact.value,R=tsunamiRadius(t,this.impact.d)+s;return new THREE.Vector3(I.x+Math.cos(phi)*R,tsunamiAmplitude(t),I.z+Math.sin(phi)*R);}
  update(t,dt,boat,camera){
    if(!this.impact){this.meteor.visible=false;return;}
    const I=U.uImpact.value,ti=CONFIG.impactAt,age=t-ti,jumped=Math.abs(t-this.lastT)>1;this.lastT=t;
    // ----- Entrada do meteoro -----
    const flying=t>=CONFIG.asteroidAt&&t<ti;this.meteor.visible=this.trailCore.visible=this.trailOuter.visible=flying;
    if(flying){
      const {pos,dir,a}=this.meteorPath(t);this.meteor.position.copy(pos);this.head.lookAt(pos.clone().sub(dir));this.rock.rotation.x+=dt*.7;this.rock.rotation.y+=dt*.4;
      this.rockMat.uniforms.uVel.value.copy(dir).negate();this.rockMat.uniforms.uHeat.value=.4+a*.8;
      const len=500+a*900;for(const [m,l,w0,w1]of [[this.trailCore,len*.6,15,55],[this.trailOuter,len,28,140]]){const u=m.material.uniforms;u.uHead.value.copy(pos);u.uAxis.value.copy(dir);u.uLen.value=l;u.uW0.value=w0;u.uW1.value=w1;}
      this.trailCore.material.uniforms.uAlpha.value=.75+a*.3;this.trailOuter.material.uniforms.uAlpha.value=.4+a*.2;this.sheath.material.uniforms.uAlpha.value=.22+a*.2;
      U.uMeteorPos.value.copy(pos);U.uMeteorGlow.value=.2+a*a*1.1;this.meteorLight.position.copy(pos);this.meteorLight.intensity=1+a*a*5;
      // Rastro de fumaça persistente e fagulhas soltando do meteoro
      if(!jumped){const back=dir,steps=Math.ceil(dt*60*(this.fire.count>2000?3:2));for(let i=0;i<steps;i++){const j=90+Math.random()*120,px=pos.x+back.x*j+(Math.random()-.5)*14,py=pos.y+back.y*j+(Math.random()-.5)*14,pz=pos.z+back.z*j+(Math.random()-.5)*14;
        this.smoke.emit(t,px,py,pz,(Math.random()-.5)*3,(Math.random()-.2)*2,(Math.random()-.5)*3,40+Math.random()*20,.3,0,14+a*8,55+Math.random()*40,.6);
        this.fire.emit(t,px-back.x*(j-8),py-back.y*(j-8),pz-back.z*(j-8),back.x*40+(Math.random()-.5)*25,back.y*40+(Math.random()-.5)*25,back.z*40+(Math.random()-.5)*25,.6+Math.random()*1.1,1.2,.3,5+a*6,2,0);}
        if(Math.random()<dt*3*a)for(let k=0;k<8;k++)this.fire.emit(t,pos.x,pos.y,pos.z,(Math.random()-.5)*60,(Math.random()-.5)*60,(Math.random()-.5)*60,2+Math.random()*2,.4,1,4,1,0);}
      this.smoke.uniforms.uGlow.value=U.uMeteorGlow.value*1.2;this.smoke.uniforms.uGlowPos.value.copy(pos);
    }else{U.uMeteorGlow.value=0;this.meteorLight.intensity=0;}
    // ----- Impacto -----
    if(age>=0&&!this.fired.impact){this.fired.impact=true;this.startImpact(t,boat);}
    if(age>=0){
      U.uImpactAge.value=age;
      const light=Math.exp(-age*.35)*6+Math.exp(-age*3)*20;U.uImpactLight.value=Math.min(light,8)*.35+(age<32?.4:0);
      this.impactLight.position.set(I.x,40+age*4,I.z);this.impactLight.intensity=light*1.4;
      // Bola de fogo
      const fbR=70*(1-Math.exp(-age*2.2))+age*1.5;this.fireball.visible=age<22;this.fireball.position.set(I.x,fbR*.4+age*7,I.z);this.fireball.scale.set(fbR,fbR*.85,fbR);
      this.fireball.material.uniforms.uCool.value=clamp(age/6.5);
      this.fireGlow.visible=age<9;this.fireGlow.position.copy(this.fireball.position);this.fireGlow.scale.setScalar(fbR*1.35);this.fireGlow.material.uniforms.uAlpha.value=Math.exp(-age*.45)*.9;this.fireball.material.uniforms.uAlpha.value=1-smooth(14,22,age);
      // Coroa d'água: sobe, abre e desaba
      const rise=Math.min(age/3.2,1),fall=clamp((age-3.2)/7);this.crown.visible=age<12;const cu=this.crown.material.uniforms;cu.uAge.value=age;cu.uRadius.value=18+age*9;cu.uHeight.value=260*(1-Math.pow(1-rise,3))*(1-fall*fall*.85);cu.uFlare.value=40+age*14;cu.uAlpha.value=1-smooth(6,12,age);this.crown.position.set(I.x,-2,I.z);
      // Domo de condensação na velocidade do som
      const dr=343*age,boatDist=Math.hypot(boat.position.x-I.x,boat.position.z-I.z);this.dome.visible=dr<boatDist*.95;this.dome.position.set(I.x,0,I.z);this.dome.scale.set(dr,dr*.55,dr);this.dome.material.uniforms.uAlpha.value=(1-smooth(.55,.95,dr/boatDist))*.5;
      if(!this.fired.shock&&dr>=boatDist){this.fired.shock=true;if(this.onShock)this.onShock();}
      // Coluna de vapor e cogumelo, iluminados por baixo pela bola de fogo
      if(!jumped&&age<16){const rate=age<4?90:age<9?45:18,count=Math.ceil(rate*dt*(this.steam.count/4000));for(let i=0;i<count;i++){const a=Math.random()*6.283,rr=Math.random()*40*(1+age*.15);const up=age<6?30+Math.random()*40:10+Math.random()*15;
        this.steam.emit(t,I.x+Math.cos(a)*rr,Math.random()*30,I.z+Math.sin(a)*rr,Math.cos(a)*(6+age),up,Math.sin(a)*(6+age),22+Math.random()*16,.08,0,20+Math.random()*20,70+Math.random()*80,.7);
        if(age>2&&Math.random()<.5){const cap=260+Math.random()*80;this.steam.emit(t,I.x+Math.cos(a)*rr*.5,cap,I.z+Math.sin(a)*rr*.5,Math.cos(a)*(22+Math.random()*25),4+Math.random()*6,Math.sin(a)*(22+Math.random()*25),24+Math.random()*14,.12,0,45,130+Math.random()*80,.9);}}
        if(age<5)for(let i=0;i<Math.ceil(40*dt*(this.fire.count/4000));i++){const a=Math.random()*6.283;this.fire.emit(t,I.x+(Math.random()-.5)*30,20+Math.random()*60,I.z+(Math.random()-.5)*30,Math.cos(a)*20,25+Math.random()*40,Math.sin(a)*20,1.5+Math.random()*2,.8,0,30,70,0);}}
      this.steam.uniforms.uGlow.value=U.uImpactLight.value*1.6;this.steam.uniforms.uGlowPos.value.set(I.x,40,I.z);this.spray.uniforms.uGlow.value=U.uImpactLight.value;this.spray.uniforms.uGlowPos.value.set(I.x,40,I.z);
      this.smoke.uniforms.uGlow.value=U.uImpactLight.value*1.2;this.smoke.uniforms.uGlowPos.value.set(I.x,60,I.z);this.smoke.uniforms.uGlowRadius.value=400;
      this.updateDebris(t,dt,age,jumped);
      // ----- Tsunami -----
      const R=tsunamiRadius(t,this.impact.d),H=tsunamiAmplitude(t);U.uTsuOn.value=age<40?1:0;U.uTsuR.value=R;U.uTsuH.value=H;
      const phi=Math.atan2(boat.position.z-I.z,boat.position.x-I.x);const lu=this.lip.material.uniforms;lu.uPhi.value=phi;lu.uCurl.value=smooth(149,163,t);this.lip.visible=t>142&&t<CONFIG.hitAt+2;
      // Espuma e borrifos arrancados da crista pelo vento
      if(!jumped&&this.lip.visible){const k=smooth(142,160,t),count=Math.ceil(dt*(110+k*150)*(this.spray.count/9000));for(let i=0;i<count;i++){const off=(Math.random()-.5)*(Math.random()<.7?.35:1.2),p=this.crest(t,phi+off,-2+Math.random()*8+lu.uCurl.value*6);p.y*=.9+Math.random()*.14;
        const out=new THREE.Vector3(Math.cos(phi+off),0,Math.sin(phi+off));const sp=4+Math.random()*10;
        this.spray.emit(t,p.x,p.y,p.z,out.x*sp*(1.5+k),2+Math.random()*6,out.z*sp*(1.5+k),2.5+Math.random()*3,.35,.35,2+Math.random()*3,8+Math.random()*10,-1.2);}
        // névoa baixa na base da parede
        for(let i=0;i<Math.ceil(dt*60);i++){const off=(Math.random()-.5)*.4,p=this.crest(t,phi+off,4+Math.random()*8);this.spray.emit(t,p.x,1+Math.random()*6,p.z,Math.cos(phi+off)*9,4+Math.random()*4,Math.sin(phi+off)*9,2+Math.random()*1.5,.5,.2,4,14,0);}}
    }else{U.uImpactAge.value=-1;U.uImpactLight.value=0;U.uTsuOn.value=0;this.lip.visible=false;this.fireball.visible=this.fireGlow.visible=this.crown.visible=this.dome.visible=this.debris.visible=false;}
    this.smoke.flush();this.steam.flush();this.fire.flush();this.spray.flush();
  }
  startImpact(t,boat){
    const I=U.uImpact.value,r=rng(1234);
    // Simulação de fluido centrada entre o impacto e o barco, velocidade calibrada para a chegada em hitAt
    const center=new THREE.Vector2((I.x+boat.position.x)/2,(I.z+boat.position.z)/2);this.fluid.start(center,this.impact.d/(CONFIG.hitAt-CONFIG.impactAt)*.98);
    this.fluid.drop(I.x,I.z,26,34,10);this.fluid.drop(I.x,I.z,60,-6,0);
    // Coroa de borrifos: milhares de gotas balísticas
    const n=Math.floor(this.spray.count*.45);for(let i=0;i<n;i++){const a=r()*6.283,up=30+r()*55,out=8+r()*30,rr=15+r()*20;this.spray.emit(t,I.x+Math.cos(a)*rr,2,I.z+Math.sin(a)*rr,Math.cos(a)*out,up,Math.sin(a)*out,6+r()*6,.05,1,2+r()*3,9+r()*12,.5);}
    this.debrisData=[];for(let i=0;i<this.debris.count;i++){const a=r()*6.283,el=.55+r()*.75,sp=26+r()*24;this.debrisData.push({p:new THREE.Vector3(I.x,8,I.z),v:new THREE.Vector3(Math.cos(a)*Math.cos(el)*sp,Math.sin(el)*sp,Math.sin(a)*Math.cos(el)*sp),s:1.5+r()*3.5,alive:true,rot:r()*6});}
    this.debris.visible=true;
  }
  updateDebris(t,dt,age,jumped){
    if(!this.debris.visible)return;let alive=0;
    this.debrisData.forEach((d,i)=>{if(d.alive){const T=age,p=d.p.clone().addScaledVector(d.v,T);p.y+=-4.9*T*T;
      if(p.y<0&&T>.5){d.alive=false;if(!jumped){for(let k=0;k<50;k++){const a=Math.random()*6.283,s=4+Math.random()*10;this.spray.emit(t,p.x,0,p.z,Math.cos(a)*s,15+Math.random()*25,Math.sin(a)*s,3+Math.random()*2,.1,1,3,9,0);}this.fluid.drop(p.x,p.z,4+d.s,4+d.s*1.2,1);if(this.onDebrisSplash)this.onDebrisSplash(p);}}
      else{alive++;if(!jumped&&Math.random()<.8){this.fire.emit(t,p.x,p.y,p.z,0,0,0,.6+Math.random()*.6,0,0,d.s*2.2,d.s*.5,0);if(Math.random()<.5)this.smoke.emit(t,p.x,p.y,p.z,(Math.random()-.5)*2,2,(Math.random()-.5)*2,9+Math.random()*5,.2,0,d.s*2,d.s*9,.5);}}
      this.tmp.position.copy(p);this.tmp.rotation.set(d.rot+T*2,d.rot*2+T,0);this.tmp.scale.setScalar(d.alive?d.s:0);}
      else{this.tmp.scale.setScalar(0);}
      this.tmp.updateMatrix();this.debris.setMatrixAt(i,this.tmp.matrix);});
    this.debris.instanceMatrix.needsUpdate=true;if(!alive&&age>3)this.debris.visible=false;
  }
}

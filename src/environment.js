import * as THREE from 'three';
import {weatherAt,clamp,smooth,lerp,waveGLSL,tsunamiGLSL,CONFIG} from './core.js';
import {U,skyGLSL,skyVertex,skyFragment,noiseGLSL} from './shaders.js';
import {fluidGLSL} from './fluid.js';

// ---------- Oceano low poly facetado ----------
const oceanVertex=`
uniform float uTime,uStorm,uTsuR,uTsuH,uTsuOn,uSpeed,uHeading;uniform vec3 uImpact,uIsland;uniform vec2 uBoat;uniform sampler2D uIslandMap;
varying vec3 vWorld;varying float vFoam,vCrest,vSim,vWall,vDepth,vShore;varying vec2 vWallUV;
${waveGLSL}${tsunamiGLSL}${fluidGLSL}
void main(){
  vec3 p=(modelMatrix*vec4(position,1.)).xyz;
  float a=.16+uStorm*.95;
  float h=seaHeight(p.xz,uTime,uStorm);
  vCrest=clamp(h/(a*1.25),-1.,1.5);
  float foam=smoothstep(.62,1.08,vCrest)*(.35+uStorm*.9);
  // Ilha: o fundo sobe, as ondas grandes perdem força e as marolas correm para a praia e quebram
  vec2 iuv=(p.xz-uIsland.xy)/uIsland.z+.5;float hT=texture2D(uIslandMap,iuv).r*24.-12.;float depth=-hT;vDepth=depth;
  float near=1.-smoothstep(.4,6.,depth);h*=mix(1.,.35,near);
  float ph=depth*2.3+uTime*1.45+sin(p.x*.08+p.z*.05)*1.5;float sw=pow(max(0.,sin(ph)),4.)*(1.-smoothstep(.2,4.,depth))*smoothstep(-.6,.25,depth);
  h+=sw*(.32+uStorm*.4)-.04*near;vShore=sw;foam+=sw*1.4*(1.-smoothstep(.1,2.5,depth))+(1.-smoothstep(-.2,.45,depth))*1.1;
  vWall=0.;vWallUV=vec2(0.);
  if(uTsuOn>.5){
    vec2 dI=p.xz-uImpact.xz;float r=length(dI),s=r-uTsuR;
    float t=tsunamiProfile(s,uTsuH)*clamp((uTsuR-r+260.)/80.,0.,1.);
    // cristas agitadas no corpo da onda
    t+=sin(r*.35-uTime*3.)*.9*smoothstep(-120.,-10.,s)*(1.-smoothstep(-8.,8.,s))*uTsuH/40.;
    h+=t;vWall=clamp(t/max(uTsuH,1.),0.,1.2)*step(1.,uTsuH);vWallUV=vec2(atan(dI.y,dI.x)*uTsuR,s);
    foam+=smoothstep(.55,.95,vWall)*smoothstep(-30.,4.,s)*1.2;
  }
  vec3 sim=simSample(p.xz);h+=sim.r;vSim=sim.b;foam+=sim.b*1.2;
  // Esteira do barco
  vec2 d=p.xz-uBoat;vec2 l=vec2(d.x*cos(uHeading)-d.y*sin(uHeading),d.x*sin(uHeading)+d.y*cos(uHeading));
  float wake=exp(-abs(abs(l.x)-(-l.y*.18+1.1))*2.2)*smoothstep(-26.,-4.,l.y)*(1.-smoothstep(-2.,3.,l.y));
  wake+=exp(-l.x*l.x*.8)*smoothstep(-14.,-3.,l.y)*(1.-smoothstep(-3.,0.,l.y))*.8;
  foam+=wake*clamp(abs(uSpeed)*.3,0.,1.);
  vFoam=foam;p.y=h;vWorld=p;
  gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);
}`;
const oceanFragment=`
uniform float uSpeed,uHeading,uTsuOn,uTsuR,uTsuH;uniform vec2 uBoat;uniform mat4 uBoatInverse;
varying vec3 vWorld;varying float vFoam,vCrest,vSim,vWall,vDepth,vShore;varying vec2 vWallUV;
${skyGLSL}
bool inHull(vec3 p){vec3 q=((uBoatInverse*vec4(p,1.)).xyz+vec3(0.,.68,0.))/2.15;if(q.z< -2.||q.z>2.21)return false;float z=q.z;float w=.48;if(z< -1.65)w=mix(.48,.67,(z+2.)/.35);else if(z< -1.1)w=mix(.67,.79,(z+1.65)/.55);else if(z< -.45)w=mix(.79,.84,(z+1.1)/.65);else if(z<.35)w=mix(.84,.83,(z+.45)/.8);else if(z<1.05)w=mix(.83,.71,(z-.35)/.7);else if(z<1.6)w=mix(.71,.49,(z-1.05)/.55);else if(z<2.)w=mix(.49,.20,(z-1.6)/.4);else w=mix(.20,.025,(z-2.)/.21);float t=(q.y-.16-.11*pow(abs(z)/2.21,3.))/.64;return t>=0.&&t<=1.1&&abs(q.x)<w*(.57+.43*t)-.005;}
float hullDistance(vec3 p){vec3 q=(uBoatInverse*vec4(p,1.)).xyz;vec2 e=vec2(q.x/2.0,q.z/4.9);return length(e)-1.;}
void main(){
  if(inHull(vWorld))discard;
  vec3 fn=normalize(cross(dFdx(vWorld),dFdy(vWorld)));if(fn.y<0.)fn=-fn;
  float dist=length(cameraPosition-vWorld);
  // Micro detalhe e gotas de chuva perto da câmera
  vec2 q=vWorld.xz;
  vec3 n=fn;
  float detail=(1.-smoothstep(10.,60.,dist));
  n.xz+=(vec2(noise(q*2.3+uTime*.6),noise(q.yx*2.1-uTime*.5))-.5)*.12*detail;
  if(uStorm>.05){vec2 cell=floor(q*1.3);vec2 f=fract(q*1.3)-.5;float ph=hash12(cell);float age=fract(uTime*1.7+ph);float rr=length(f);float ring=sin((rr-age*.5)*60.)*exp(-age*4.)*(1.-smoothstep(.0,.5,rr))*step(.4,ph);n.xz+=f/max(rr,.01)*ring*.25*uStorm*detail;}
  n=normalize(n);
  vec3 eye=normalize(cameraPosition-vWorld);
  float cosv=max(dot(n,eye),0.);
  float fres=.02+.98*pow(1.-cosv,5.);
  vec3 r=reflect(-eye,n);r.y=abs(r.y)+.01;
  vec3 refl=skyColor(normalize(r),0.);
  // Corpo d'água e espalhamento subsuperficial nas cristas contra a luz
  vec3 deep=mix(vec3(.004,.05,.075),vec3(.006,.022,.032),uStorm);deep=mix(deep,vec3(.012,.02,.025),uRed*.5);
  vec3 sssCol=mix(vec3(.02,.35,.33),vec3(.03,.14,.15),uStorm);sssCol=mix(sssCol,vec3(.05,.2,.16),uRed*.5);
  vec3 L=normalize(uSunDir);
  float back=pow(max(dot(-eye,vec3(-L.x,0.,-L.z))*.5+.5,0.),3.);
  float sss=clamp(vCrest*.6+.3,0.,1.)*back*(1.-uStorm*.6);
  vec3 body=deep+sssCol*sss*.9+sssCol*.08*max(n.y,0.);
  // Parede da tsunami: corpo escuro, topo fino e translúcido (verde contra o brilho do impacto)
  float wall=smoothstep(.08,.35,vWall);
  if(wall>0.){float thin=smoothstep(.55,1.,vWall);vec3 glow=vec3(.05,.42,.3)*(.6+uImpactLight*.5)+vec3(.35,.12,.03)*uImpactLight*.4;
    body=mix(body,vec3(.004,.03,.04)+glow*thin*.9,wall);fres*=mix(1.,.55,wall);}
  body*=mix(.55,1.25,clamp(vCrest*.5+.5,0.,1.));
  // água rasa: turquesa sobre a areia, clareando até a beira
  float shallow=1.-smoothstep(.0,7.,vDepth);vec3 lagoon=mix(vec3(.02,.3,.3),vec3(.25,.55,.45),1.-smoothstep(0.,2.5,vDepth));lagoon*=(.45+.55*max(dot(n,normalize(uSunDir+vec3(0.,.5,0.))),0.))*mix(1.,.35,uStorm)*(1.-uRed*.4);
  body=mix(body,lagoon,shallow*(1.-wall));fres*=mix(1.,.6,shallow);
  vec3 col=mix(body,refl*mix(1.,.42,uRed)*mix(.75,1.,clamp(vCrest*.5+.5,0.,1.)),clamp(fres,0.,1.));
  // Especular do sol e brilhos
  float spec=pow(max(dot(r,L),0.),700.)*7.+pow(max(dot(r,L),0.),60.)*.5;spec*=smoothstep(0.,.04,L.y);
  col+=vec3(1.,.6,.3)*spec*(1.-uStorm*.95)*(1.-uRed*.7);
  // Luz do meteoro e do impacto sobre a água
  if(uMeteorGlow>0.){vec3 md=normalize(uMeteorPos-vWorld);col+=vec3(1.,.4,.1)*(pow(max(dot(r,md),0.),60.)*4.+pow(max(dot(n,md),0.),2.)*.08)*uMeteorGlow;}
  if(uImpactAge>=0.){vec3 id=normalize(uImpact+vec3(0.,40.,0.)-vWorld);col+=vec3(1.,.5,.2)*(pow(max(dot(r,id),0.),30.)*3.+.05)*uImpactLight;}
  // Espuma com textura de células
  float fpat=fbm3l(q*.9+vec2(uTime*.05,0.))*.6+noise(q*4.1)*.4;
  float foam=clamp(vFoam,0.,2.)*mix(1.,.25,smoothstep(50.,260.,dist)*(1.-smoothstep(.1,.4,vWall)));
  float wash=(1.-smoothstep(-.1,.35,vDepth));foam=max(foam,wash*1.2);
  float foamMask=smoothstep(.55-foam*.35,.8-foam*.3,fpat)*clamp(foam,0.,1.);
  if(vWall>.1){float streak=fbm3l(vec2(vWallUV.x*.09,vWorld.y*.05+uTime*.9))*.7+noise(vec2(vWallUV.x*.5,vWorld.y*.2+uTime*2.))*.3;
    foamMask=max(foamMask,smoothstep(.5,.72,streak)*smoothstep(.15,.5,vWall)*.9+smoothstep(.82,1.02,vWall)*smoothstep(.35,.6,fpat));}
  float hd=hullDistance(vWorld);foamMask=max(foamMask,(1.-smoothstep(0.,.25,hd))*smoothstep(.3,.8,fpat)*(.35+uStorm*.6+clamp(abs(uSpeed)*.15,0.,.5)));
  vec3 foamCol=mix(vec3(.95,.93,.88),vec3(.55,.6,.65),uStorm*.6);foamCol=mix(foamCol,vec3(1.,.55,.4),uRed*.35);
  foamCol*=.55+.45*max(dot(fn,normalize(L+vec3(0.,.6,0.))),0.);
  col=mix(col,foamCol*(1.+uFlash),clamp(foamMask,0.,.95));
  col+=vec3(.5,.55,.8)*uFlash*.25;
  // Neblina atmosférica que funde o mar ao horizonte do céu
  vec3 fogDir=normalize(vec3(-eye.x,.0,-eye.z));vec3 fogCol=skyGradient(fogDir);
  float fogAmt=1.-exp(-dist*mix(.0024,.005,uStorm)*(1.-smoothstep(.1,.5,vWall)*.6));
  col=mix(col,fogCol,clamp(fogAmt,0.,1.));
  gl_FragColor=vec4(col,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// ---------- Utilidades de geometria low poly ----------
function hash(n){const s=Math.sin(n*127.1)*43758.5453;return s-Math.floor(s);}
function vnoise3(x,y,z){const X=Math.floor(x),Y=Math.floor(y),Z=Math.floor(z),fx=x-X,fy=y-Y,fz=z-Z,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy),sz=fz*fz*(3-2*fz);const h=(i,j,k)=>hash(X+i+(Y+j)*57+(Z+k)*113);const l=(a,b,t)=>a+(b-a)*t;return l(l(l(h(0,0,0),h(1,0,0),sx),l(h(0,1,0),h(1,1,0),sx),sy),l(l(h(0,0,1),h(1,0,1),sx),l(h(0,1,1),h(1,1,1),sx),sy),sz);}
export function fbm3(x,y,z,o=4){let f=0,a=.5;for(let i=0;i<o;i++){f+=a*vnoise3(x,y,z);x*=2.03;y*=2.03;z*=2.03;a*=.5;}return f;}
function island(seed,scale){
  const g=new THREE.IcosahedronGeometry(1,3).toNonIndexed(),p=g.attributes.position,colors=[],v=new THREE.Vector3();
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);const n=fbm3(v.x*1.7+seed,v.y*1.7,v.z*1.7+seed*.3,4);let r=.75+n*.7;v.multiplyScalar(r);v.y=v.y<0?v.y*.2:Math.pow(v.y,1.35)*1.2;p.setXYZ(i,v.x*scale[0],v.y*scale[1],v.z*scale[2]);}
  g.computeVertexNormals();const nrm=g.attributes.normal;
  for(let i=0;i<p.count;i+=3){const y=(p.getY(i)+p.getY(i+1)+p.getY(i+2))/3,ny=(nrm.getY(i)+nrm.getY(i+1)+nrm.getY(i+2))/3,rnd=hash(i+seed);let c;
    if(y<scale[1]*.06)c=[.62,.52,.36];else if(ny>.62&&y<scale[1]*.8)c=rnd>.5?[.16,.27,.12]:[.2,.33,.14];else c=rnd>.5?[.26,.25,.24]:[.33,.31,.29];
    for(let k=0;k<3;k++)colors.push(...c.map(x=>x*(0.9+rnd*.2)));}
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));return g;
}
export function seagull(){
  const g=new THREE.Group(),white=new THREE.MeshStandardMaterial({color:0xf2eee8,flatShading:true,roughness:.8}),grey=new THREE.MeshStandardMaterial({color:0x6f757c,flatShading:true,roughness:.8});
  const body=new THREE.Mesh(new THREE.OctahedronGeometry(.5,0),white);body.scale.set(.28,.26,1);g.add(body);
  const beak=new THREE.Mesh(new THREE.ConeGeometry(.05,.22,4),new THREE.MeshStandardMaterial({color:0xe0a21c,flatShading:true}));beak.rotation.x=Math.PI/2;beak.position.z=.58;g.add(beak);
  const wingGeo=new THREE.BufferGeometry();wingGeo.setAttribute('position',new THREE.Float32BufferAttribute([0,0,.22, 0,0,-.2, .75,.05,-.05, .75,.05,-.05, 0,0,.22, .72,.04,.14, .75,.05,-.05, .72,.04,.14, 1.25,.0,-.12],3));wingGeo.computeVertexNormals();
  const wings=[];for(const s of [-1,1]){const pivot=new THREE.Group(),w=new THREE.Mesh(wingGeo,s>0?white:white);w.material=new THREE.MeshStandardMaterial({color:0xe8e6e1,flatShading:true,side:THREE.DoubleSide});const tip=new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute([.72,.04,.14, .75,.05,-.05, 1.25,.0,-.12],3)),grey);tip.material.side=THREE.DoubleSide;pivot.add(w,tip);pivot.scale.x=s;pivot.position.x=s*.08;g.add(pivot);wings.push(pivot);}
  g.userData.wings=wings;g.scale.setScalar(.9);return g;
}
function lightningGeometry(seed){
  // Raio ramificado: segmentos em fita, larguras decrescentes.
  const pts=[],rnd=(()=>{let s=seed*9301+49297;return()=>((s=(s*9301+49297)%233280)/233280);})();
  function branch(x,y,z,dx,dy,dz,len,width,depth){let px=x,py=y,pz=z;const steps=Math.floor(len/4);for(let i=0;i<steps;i++){const nx=px+dx*4+(rnd()-.5)*5,ny=py+dy*4,nz=pz+dz*4+(rnd()-.5)*5;pts.push([px,py,pz,nx,ny,nz,width*(1-i/steps*.6)]);if(depth<2&&rnd()<.14)branch(nx,ny,nz,dx+(rnd()-.5)*1.4,dy*.8,dz+(rnd()-.5)*1.4,len*.4,width*.45,depth+1);px=nx;py=ny;pz=nz;if(py<0)break;}}
  branch(0,120,0,0,-1,0,130,1.3,0);
  const pos=[],alpha=[];for(const [ax,ay,az,bx,by,bz,w]of pts){pos.push(ax-w,ay,az, bx-w,by,bz, bx+w,by,bz, ax-w,ay,az, bx+w,by,bz, ax+w,ay,az, ax,ay,az-w, bx,by,bz-w, bx,by,bz+w, ax,ay,az-w, bx,by,bz+w, ax,ay,az+w);for(let k=0;k<12;k++)alpha.push(w);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('width',new THREE.Float32BufferAttribute(alpha,1));return g;
}

export class Environment {
  constructor(scene,renderer,fluid,quality='high'){
    this.scene=scene;this.renderer=renderer;this.quality=quality;this.uniforms=U;
    Object.assign(U,fluid.uniforms);
    // Céu
    const skyMat=new THREE.ShaderMaterial({uniforms:U,vertexShader:skyVertex,fragmentShader:skyFragment,side:THREE.BackSide,depthWrite:false});
    this.sky=new THREE.Mesh(new THREE.SphereGeometry(900,48,24),skyMat);this.sky.renderOrder=-10;this.sky.frustumCulled=false;scene.add(this.sky);
    // Mapa de ambiente gerado a partir do próprio céu (reflexos em madeira molhada, metal e pele)
    this.envScene=new THREE.Scene();this.envSky=new THREE.Mesh(new THREE.SphereGeometry(100,32,16),new THREE.ShaderMaterial({uniforms:U,vertexShader:`varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 vDirection;${skyGLSL}
void main(){vec3 d=normalize(vDirection);vec3 col=min(skyGradient(d),vec3(2.5))*.8;gl_FragColor=vec4(col,1.);}`,side:THREE.BackSide,depthWrite:false}));this.envScene.add(this.envSky);
    this.pmrem=new THREE.PMREMGenerator(renderer);this.envTarget=null;this.envTimer=99;
    // Oceano: malha com densidade quadrática em torno da câmera
    const segments=quality==='low'?180:340,geo=new THREE.PlaneGeometry(1400,1400,segments,segments);geo.rotateX(-Math.PI/2);const gp=geo.attributes.position;
    for(let i=0;i<gp.count;i++)for(const axis of ['X','Z']){const p=gp['get'+axis](i);gp['set'+axis](i,Math.sign(p)*Math.pow(Math.abs(p)/700,2.2)*700);}
    geo.computeBoundingSphere();geo.boundingSphere.radius=1e5;
    this.ocean=new THREE.Mesh(geo,new THREE.ShaderMaterial({uniforms:U,vertexShader:oceanVertex,fragmentShader:oceanFragment}));this.ocean.frustumCulled=false;scene.add(this.ocean);
    // Luzes
    this.ambient=new THREE.HemisphereLight(0xffcfab,0x193e49,1.4);scene.add(this.ambient);
    this.sun=new THREE.DirectionalLight(0xffba69,3.2);this.sun.castShadow=true;const sm=quality==='low'?1024:2048;this.sun.shadow.mapSize.set(sm,sm);Object.assign(this.sun.shadow.camera,{left:-15,right:15,top:15,bottom:-15,near:1,far:140});this.sun.shadow.normalBias=.03;this.sun.shadow.bias=-.0004;this.sun.shadow.radius=3;scene.add(this.sun,this.sun.target);
    this.fill=new THREE.DirectionalLight(0x83b9cf,.6);this.fill.position.set(12,10,15);scene.add(this.fill);
    this.flashLight=new THREE.DirectionalLight(0xbcd0ff,0);scene.add(this.flashLight,this.flashLight.target);
    scene.fog=new THREE.FogExp2(0x9a5a3a,.0035);
    // Gaivotas
    this.birds=new THREE.Group();for(let i=0;i<6;i++){const b=seagull();b.userData.phase=i*1.37;b.userData.radius=30+i%3*8;b.userData.height=30+i%3*4;b.userData.speed=.1+(i%5)*.02;this.birds.add(b);}scene.add(this.birds);
    // Chuva: traços inclinados pelo vento, em uma única chamada
    const drops=quality==='low'?2500:6000,rpos=[],rseed=[];for(let i=0;i<drops;i++){const x=(Math.random()-.5)*50,y=Math.random()*30,z=(Math.random()-.5)*50,s=Math.random();rpos.push(x,y,z,x,y,z);rseed.push(s,0,s,1);}
    const rg=new THREE.BufferGeometry();rg.setAttribute('position',new THREE.Float32BufferAttribute(rpos,3));rg.setAttribute('seed',new THREE.Float32BufferAttribute(rseed,2));
    this.rain=new THREE.LineSegments(rg,new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uTime:U.uTime,uStorm:U.uStorm,uFlash:U.uFlash,uCam:{value:new THREE.Vector3()}},
      vertexShader:`uniform float uTime,uStorm;uniform vec3 uCam;attribute vec2 seed;varying float vFade,vEnd;void main(){vec3 p=position;float speed=17.+seed.x*6.;p.y=mod(p.y-uTime*speed,30.)-8.;p.x=mod(p.x-uCam.x+uTime*4.5+25.,50.)-25.+uCam.x;p.z=mod(p.z-uCam.z+25.,50.)-25.+uCam.z;p.y+=uCam.y;vec3 wind=vec3(4.5+uStorm*6.,-speed,1.5)*.035*(1.+uStorm);p-=wind*seed.y;vEnd=seed.y;vec4 mv=modelViewMatrix*vec4(p,1.);vFade=(1.-smoothstep(3.,40.,length(mv.xyz)))*smoothstep(.3,1.5,length(mv.xyz));gl_Position=projectionMatrix*mv;}`,
      fragmentShader:`uniform float uStorm,uFlash;varying float vFade,vEnd;void main(){gl_FragColor=vec4(vec3(.62,.7,.8)*(1.+uFlash*3.),smoothstep(.0,.6,uStorm)*.38*vFade*(1.-vEnd*.6));}`}));
    this.rain.frustumCulled=false;this.rain.visible=false;scene.add(this.rain);
    // Relâmpagos
    this.boltMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{uAlpha:{value:0}},vertexShader:`attribute float width;varying float vW;void main(){vW=width;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform float uAlpha;varying float vW;void main(){gl_FragColor=vec4(vec3(3.,3.4,5.)*uAlpha*(.4+vW),1.);}`});
    this.bolt=new THREE.Mesh(lightningGeometry(1),this.boltMat);this.bolt.visible=false;this.bolt.frustumCulled=false;scene.add(this.bolt);
    this.nextBolt=0;this.boltAge=9;this.onThunder=null;
    // Respingos (queda na água)
    const splashes=new THREE.BufferGeometry();this.splashArray=new Float32Array(260*3);splashes.setAttribute('position',new THREE.BufferAttribute(this.splashArray,3));
    this.splash=new THREE.Points(splashes,new THREE.PointsMaterial({color:0xe1f7ef,size:.12,transparent:true,opacity:.85,depthWrite:false}));this.splash.visible=false;this.splash.frustumCulled=false;this.splashTime=99;scene.add(this.splash);
  }
  burst(position){this.splash.position.copy(position);this.splashTime=0;this.splash.visible=true;}
  strike(t,camera){
    const a=Math.random()*Math.PI*2,d=90+Math.random()*190;const pos=new THREE.Vector3(camera.position.x+Math.cos(a)*d,0,camera.position.z+Math.sin(a)*d);
    this.bolt.geometry.dispose();this.bolt.geometry=lightningGeometry(Math.floor(Math.random()*1e4));this.bolt.position.copy(pos);this.bolt.lookAt(camera.position.x,0,camera.position.z);this.bolt.visible=true;this.boltAge=0;
    U.uFlashDir.value.copy(pos).setY(70).sub(camera.position).normalize();this.flashLight.position.copy(pos).setY(120);this.flashLight.target.position.copy(camera.position);
    if(this.onThunder)this.onThunder(d);
  }
  updateEnvMap(){const old=this.envTarget;this.envTarget=this.pmrem.fromScene(this.envScene,0,.1,200);this.scene.environment=this.envTarget.texture;this.scene.environmentIntensity=.55;if(old)old.dispose();}
  update(t,dt,boat,camera,flags={}){
    const st=flags.story??t,w=weatherAt(st);U.uTime.value=t;U.uStorm.value=w.storm;U.uRed.value=w.red;
    const sunset=clamp(st/60);U.uSunset.value=sunset;const elev=lerp(.13,.035,sunset);U.uSunDir.value.set(-.5,elev,-.86).normalize();
    // Relâmpagos: raios reais com trovão atrasado pela distância
    if(w.storm>.35&&st<136&&t>this.nextBolt&&!flags.paused){this.nextBolt=t+4+Math.random()*7*(1.3-w.storm);this.strike(t,camera);}
    if(this.bolt.visible){this.boltAge+=dt;const a=this.boltAge,flick=a<.35?(Math.sin(a*70)>-.2?1:.25):Math.max(0,1-(a-.35)*4);this.boltMat.uniforms.uAlpha.value=flick;U.uFlash.value=flick*.9;this.flashLight.intensity=flick*5;if(a>.6){this.bolt.visible=false;U.uFlash.value=0;this.flashLight.intensity=0;}}else if(!flags.impactFlash)U.uFlash.value=0;
    U.uBoat.value.set(boat.position.x,boat.position.z);U.uHeading.value=boat.rotation.y;U.uSpeed.value=boat.userData.speed||0;U.uBoatInverse.value.copy(boat.matrixWorld).invert();
    this.sky.position.copy(camera.position);this.ocean.position.x=Math.floor(camera.position.x/20)*20;this.ocean.position.z=Math.floor(camera.position.z/20)*20;
    // Iluminação por fase
    const sunCol=new THREE.Color().setRGB(1,lerp(.62,.45,sunset),lerp(.35,.2,sunset));
    this.sun.color.copy(sunCol).lerp(new THREE.Color(1,.25,.1),w.red);this.sun.intensity=lerp(3.4,2.4,sunset)*(1-w.storm*.9)*(1-w.red*.3)+w.red*1.2;
    const focus=flags.focus||boat.position;this.sun.position.copy(focus).addScaledVector(U.uSunDir.value,70);if(w.red>0)this.sun.position.copy(focus).add(new THREE.Vector3(-20,25*w.red+5,-50));this.sun.target.position.copy(focus);
    this.ambient.color.setRGB(lerp(1,.45,w.storm)+w.red*.4,lerp(.75,.55,w.storm)-w.red*.4,lerp(.6,.65,w.storm)-w.red*.4);this.ambient.groundColor.setRGB(.08,.2+w.storm*.02,.25-w.red*.1);this.ambient.intensity=lerp(1.35,.55,w.storm)+w.red*.35+U.uFlash.value*1.5;
    this.fill.intensity=.6-w.storm*.35;
    const fogCol=new THREE.Color(lerp(1.0,.07,w.storm),lerp(.42,.08,w.storm),lerp(.18,.1,w.storm)).lerp(new THREE.Color(.55,.07,.03),w.red);this.scene.fog.color.copy(fogCol);this.scene.fog.density=lerp(.0042,.009,w.storm);
    this.envTimer+=dt;if(this.envTimer>(st>118?.8:2.5)){this.envTimer=0;this.updateEnvMap();}
    this.rain.visible=w.storm>.05;this.rain.material.uniforms.uCam.value.copy(camera.position);
    for(const b of this.birds.children){const d=b.userData,a=t*d.speed+d.phase;b.position.set(boat.position.x+Math.cos(a)*d.radius+Math.sin(d.phase)*6,d.height+Math.sin(t*.7+d.phase)*1.2,boat.position.z+Math.sin(a)*d.radius);b.rotation.set(0,-a,Math.sin(t*.5+d.phase)*.25);const flap=Math.sin(t*(6+d.phase%1*2)+d.phase)*(Math.sin(t*.3+d.phase)>.2?.55:.08);d.wings[0].rotation.z=flap;d.wings[1].rotation.z=-flap;b.visible=w.storm<.55&&w.red<.1;}
    if(this.splash.visible){this.splashTime+=dt;const age=this.splashTime;for(let i=0;i<260;i++){const a=i*2.4,s=1+(i%7)*.32;this.splashArray[i*3]=Math.cos(a)*s*age;this.splashArray[i*3+1]=(3+i%5*.5)*age-5*age*age;this.splashArray[i*3+2]=Math.sin(a)*s*age;}this.splash.geometry.attributes.position.needsUpdate=true;this.splash.material.opacity=.9*(1-age/1.5);if(age>1.5)this.splash.visible=false;}
    return w;
  }
}

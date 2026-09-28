import * as THREE from 'three';
import {U} from './shaders.js';
import {VOLCANO,CONE,GLYPHS} from './volcano.js';

// ======================================================================================================
// Eclipse do Coração: o espetáculo depois do sacrifício (e no comando de teste). ~36 s, sincronizado pelo relógio do jogo.
//   0–6 s   a lava explode, um feixe de luz sobe da cratera e o sol volta a subir, chamado pelo Coração
//   2–12 s  a lua avança sobre o sol; a escuridão chega pelo céu a partir do lado do sol; estrelas, Via Láctea e nebulosas
//   12 s    segundo contato: contas de Baily e anel de diamante; totalidade: coroa animada, proeminências, anel de crepúsculo
//   12–19 s seis planetas deslizam até se alinhar; no alinhamento, fio de luz, círculo de runas e ondas de halo; auroras dançam
//   24 s    terceiro contato: outro anel de diamante; a luz volta e o meteoro nasce do fim do eclipse (25 s)
// Tudo é desenhado no céu (shaders.js: skyGradient escurece a névoa e o reflexo do mar; eclipseLayer desenha o resto).
// ======================================================================================================
export const ECLIPSE={dur:36,meteorAt:25,second:12,third:24,lock:19};
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const sm=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const lerp=(a,b,t)=>a+(b-a)*t;
// planetas: ângulo ao longo do arco (rad), raio aparente, desvio inicial (perpendicular / ao longo)
const PLANETS=[[.17,.011,.24,.05],[.27,.016,-.3,-.04],[.38,.013,.33,.06],[.52,.034,-.2,-.05],[.66,.015,.27,.04],[.84,.028,-.26,-.06]];
const Rs=.0245;

export class Eclipse {
  constructor(scene,volcano){this.scene=scene;this.v=volcano;this.k=-1;
    // feixe de energia da cratera até o eclipse: espiral de cores subindo, mais forte no eixo
    const L=900;const geo=new THREE.CylinderGeometry(20,2.2,L,48,64,true);geo.translate(0,L/2,0);
    this.beamMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,fog:false,uniforms:{uT:{value:0},uA:{value:0}},
      vertexShader:'varying vec2 vUv;varying vec3 vN;varying vec3 vW;void main(){vUv=uv;vN=normalize(mat3(modelMatrix)*normal);vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
      fragmentShader:`uniform float uT,uA;varying vec2 vUv;varying vec3 vN;varying vec3 vW;vec3 pal(float t){return .5+.5*cos(6.2832*(t+vec3(0.,.33,.67)));}
        void main(){vec3 vd=normalize(cameraPosition-vW);float face=pow(abs(dot(vN,vd)),1.6);float y=vUv.y;
          float sp=.5+.5*sin(vUv.x*6.2832*3.+y*90.-uT*7.);float sp2=.5+.5*sin(vUv.x*6.2832*5.-y*140.+uT*11.);
          vec3 c=mix(vec3(1.,.9,.7),pal(y*2.5-uT*.25),.55)*(.35+sp*.8+sp2*.4);float fade=pow(1.-y,1.4)*smoothstep(0.,.02,y);
          float near=smoothstep(18.,110.,length(cameraPosition-vW));gl_FragColor=vec4(c*face*fade*uA*.75*near,1.);}`});
    this.beam=new THREE.Mesh(geo,this.beamMat);this.beam.frustumCulled=false;this.beam.visible=false;scene.add(this.beam);
    // faíscas subindo em espiral pelo feixe (tudo na GPU)
    const N=900,pos=new Float32Array(N*3),seed=new Float32Array(N*4);for(let i=0;i<N;i++){seed.set([Math.random(),Math.random(),Math.random(),Math.random()],i*4);}
    const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(pos,3));pg.setAttribute('seed',new THREE.BufferAttribute(seed,4));
    this.sparkMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false,uniforms:{uT:{value:0},uA:{value:0},uO:{value:V()},uD:{value:V(0,1,0)},uX:{value:V(1,0,0)},uZ:{value:V(0,0,1)}},
      vertexShader:`attribute vec4 seed;uniform float uT,uA;uniform vec3 uO,uD,uX,uZ;varying vec3 vC;varying float vA;vec3 pal(float t){return .5+.5*cos(6.2832*(t+vec3(0.,.33,.67)));}
        void main(){float ph=fract(seed.x+uT*(.05+seed.y*.07));float h=ph*ph*520.;float ang=seed.z*6.2832+ph*(10.+seed.w*16.)+uT*.6;float r=(2.+h*.03)*(.4+seed.w*1.2);
          vec3 p=uO+uD*h+(uX*cos(ang)+uZ*sin(ang))*r;vec4 mv=viewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((2.+seed.w*5.)*(300./-mv.z),1.,14.);
          vC=mix(vec3(1.,.8,.45),pal(seed.x+ph),.6);vA=uA*(1.-ph)*smoothstep(0.,.05,ph)*smoothstep(6.,30.,-mv.z);}`,
      fragmentShader:'varying vec3 vC;varying float vA;void main(){vec2 q=gl_PointCoord-.5;float d=length(q);if(d>.5)discard;gl_FragColor=vec4(vC*(1.-d*2.)*vA*1.6,1.);}'});
    this.sparks=new THREE.Points(pg,this.sparkMat);this.sparks.frustumCulled=false;this.sparks.visible=false;scene.add(this.sparks);
    // clarão na boca da cratera
    const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.35,'rgba(255,255,255,.4)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64);
    this.flare=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),color:new THREE.Color(3,1.6,.7),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));this.flare.visible=false;this.flare.frustumCulled=false;scene.add(this.flare);
    this.planetDirs=PLANETS.map(()=>V());
    // anéis de runas girando e subindo pelo feixe
    const rc=document.createElement('canvas');rc.width=rc.height=512;const rx=rc.getContext('2d');rx.translate(256,256);rx.strokeStyle='rgba(255,255,255,.9)';rx.lineWidth=5;
    for(const rr of [175,250]){rx.beginPath();rx.arc(0,0,rr,0,6.283);rx.stroke();}rx.font='bold 46px serif';rx.fillStyle='#fff';rx.textAlign='center';rx.textBaseline='middle';
    for(let i=0;i<20;i++){rx.save();rx.rotate(i/20*6.283);rx.fillText(GLYPHS[i%GLYPHS.length],0,-212);rx.restore();}
    const runeTex=new THREE.CanvasTexture(rc);this.runes=Array.from({length:6},(_,i)=>{const m=new THREE.Mesh(new THREE.RingGeometry(6.6,10.2,64,1),new THREE.MeshBasicMaterial({map:runeTex,color:new THREE.Color().setHSL(i/6,.9,.62),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,fog:false,opacity:0}));m.visible=false;m.frustumCulled=false;scene.add(m);return m;});
    // pilares de luz na borda da cratera (acendem no alinhamento)
    const pg2=new THREE.CylinderGeometry(.5,1.1,340,10,1,true).translate(0,170,0);this.pillarMat=[];
    this.pillars=Array.from({length:8},(_,i)=>{const a=i/8*6.283,u=CONE.u+Math.cos(a)*(CONE.cr+3),w=CONE.v+Math.sin(a)*(CONE.cr+3);
      const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,fog:false,uniforms:{uT:{value:0},uA:{value:0},uC:{value:new THREE.Color().setHSL(i/8,.85,.6)}},
        vertexShader:'varying vec2 vUv;varying vec3 vN;varying vec3 vW;void main(){vUv=uv;vN=normalize(mat3(modelMatrix)*normal);vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
        fragmentShader:'uniform float uT,uA;uniform vec3 uC;varying vec2 vUv;varying vec3 vN;varying vec3 vW;void main(){float f=pow(abs(dot(vN,normalize(cameraPosition-vW))),2.);float y=vUv.y;float b=.6+.4*sin(y*60.-uT*9.);float near=smoothstep(20.,120.,length(cameraPosition-vW));gl_FragColor=vec4((uC*1.4+vec3(.2))*f*b*pow(1.-y,1.2)*uA*.55*near,1.);}'});
      const m=new THREE.Mesh(pg2,mat);m.position.set(VOLCANO.x+u,(volcano?.hAt(u,w)??80)-1,VOLCANO.z+w);m.visible=false;m.frustumCulled=false;scene.add(m);this.pillarMat.push(mat);return m;});
    // onda de luz que corre pelo mar a partir do vulcão no alinhamento
    this.wave=new THREE.Mesh(new THREE.RingGeometry(.94,1,160,1).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:new THREE.Color(1.6,1.2,2.2),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,fog:false,opacity:0}));
    this.wave.visible=false;this.wave.frustumCulled=false;scene.add(this.wave);}
  // fatores da linha do tempo em k segundos (também usados pelo ambiente para apagar a luz)
  static timeline(k){const E=ECLIPSE;if(k<0||k>E.dur)return null;
    const s=k<E.second?lerp(3.4,0,sm(2,E.second+.2,k)):k<E.third-.4?0:-lerp(0,3.4,sm(E.third-.4,33,k));
    const cov=Math.max(0,1-Math.abs(s)/2.05),dark=Math.min(1,Math.pow(cov,2.6)*1.02);
    return {s,dark,lift:sm(0,6,k)*(1-sm(27,35,k)),corona:sm(E.second-.8,E.second+.4,k)*(1-sm(E.third-.2,E.third+1.6,k)),aurora:sm(E.second+.5,16,k)*(1-sm(25,31,k)),
      align:sm(E.second,E.lock,k),planets:sm(6,10,k)*(1-sm(27,33,k)),line:sm(E.lock,E.lock+.6,k)*(1-sm(E.third,28,k)),ring:k>=E.lock?k-E.lock:-1,
      d2:Math.exp(-Math.pow((k-(E.second-.05))/.32,2))+Math.exp(-Math.pow((k-(E.second-.9))/.18,2))*.25,d3:Math.exp(-Math.pow((k-(E.third+.1))/.32,2)),
      cons:sm(13,18.5,k)*(1-sm(27,31,k)),rain:sm(E.lock-.5,E.lock+.5,k)*(1-sm(24,28,k)),pillars:sm(E.lock,E.lock+.5,k)*(1-sm(26,31,k)),wave:k>=E.lock?k-E.lock:-1,
      beam:sm(.3,2.5,k)*(1-sm(28,34,k))*(1+.6*Math.exp(-Math.pow((k-E.lock)/.6,2))),on:sm(0,.6,k)*(1-sm(34,E.dur,k))};}
  // k = segundos desde o começo (null/negativo = desligado). Roda depois do ambiente (usa o sol já erguido).
  update(k,dt,camera){const T=Eclipse.timeline(k);U.uEclOn.value=T?T.on:0;
    if(!T){if(this.k>=0){this.beam.visible=this.sparks.visible=this.flare.visible=this.wave.visible=false;for(const m of [...this.runes,...this.pillars])m.visible=false;U.uEclConst.value=0;U.uEclRain.value=0;U.uEclDark.value=0;U.uEclCorona.value=0;U.uEclDiamond.value.w=0;U.uEclLine.value=0;U.uEclRing.value=-1;for(const p of U.uPlanets.value)p.w=0;if(this.v?.lavaMat)this.v.lavaMat.uniforms.uBoost.value=0;}this.k=-1;return;}
    this.k=k;const S=U.uSunDir.value.clone().normalize(),up=V(0,1,0),ux=V().crossVectors(S,up).normalize(),uy=V().crossVectors(ux,S);
    U.uEclT.value=k;U.uEclDark.value=T.dark;U.uEclCorona.value=T.corona;U.uEclAurora.value=T.aurora;U.uEclAlign.value=T.align;U.uEclRing.value=T.ring;U.uEclLine.value=T.line;
    // a lua chega do alto à esquerda e sai pelo outro lado
    const a0=2.35,md=ux.clone().multiplyScalar(Math.cos(a0)).addScaledVector(uy,Math.sin(a0));U.uEclMoon.value.copy(S).addScaledVector(md,T.s*Rs).normalize();
    // anel de diamante: último ponto do sol antes da totalidade (lado para onde a lua vai) e primeiro depois (lado de onde ela veio)
    const dw=T.d2+T.d3;U.uEclDiamond.value.set(...S.clone().addScaledVector(md,(T.d2>T.d3?-1:1)*Rs*.98).normalize().toArray(),dw*1.3);
    // arco dos planetas: sobe para a esquerda a partir do sol
    const b=1.95,Tn=ux.clone().multiplyScalar(Math.cos(b)).addScaledVector(uy,Math.sin(b)).normalize(),N=V().crossVectors(S,Tn).normalize();
    U.uEclTan.value.copy(Tn);U.uEclAxis.value.copy(N);U.uEclArc.value=PLANETS.at(-1)[0]+.02;
    PLANETS.forEach(([a,r,o,j],i)=>{const free=1-T.align,wob=Math.sin(k*.4+i*1.7)*.02*free;const base=S.clone().multiplyScalar(Math.cos(a+j*free)).addScaledVector(Tn,Math.sin(a+j*free));
      const dir=base.addScaledVector(N,(o+wob)*free).normalize();this.planetDirs[i].copy(dir);U.uPlanets.value[i].set(dir.x,dir.y,dir.z,r*T.planets*(1+.08*Math.exp(-Math.pow((k-ECLIPSE.lock-.2)/.35,2))));});
    // feixe e faíscas saindo da lava em direção ao eclipse
    const L=this.v?.lavaY??90,O=V(VOLCANO.x+CONE.u,L,VOLCANO.z+CONE.v);this.beam.visible=T.beam>.01;this.beam.position.copy(O);this.beam.quaternion.setFromUnitVectors(up,S);
    this.beamMat.uniforms.uT.value=k;this.beamMat.uniforms.uA.value=T.beam;
    this.sparks.visible=T.beam>.01;const su=this.sparkMat.uniforms;su.uT.value=k;su.uA.value=Math.min(1,T.beam);su.uO.value.copy(O);su.uD.value.copy(S);su.uX.value.copy(ux);su.uZ.value.copy(uy);
    this.flare.visible=T.beam>.01;this.flare.position.copy(O).add(V(0,3,0));this.flare.scale.setScalar(12+T.beam*14+Math.sin(k*9)*2);this.flare.material.opacity=Math.min(1,T.beam)*.7;
    if(this.v?.lavaMat)this.v.lavaMat.uniforms.uBoost.value=T.beam*.45;
    U.uEclConst.value=T.cons;U.uEclRain.value=T.rain;
    const q=new THREE.Quaternion().setFromUnitVectors(V(0,0,1),S);
    this.runes.forEach((m,i)=>{const ph=(k*.1+i/6)%1,a=Math.sin(ph*Math.PI)*Math.min(1,T.beam)*.42*(1-.6*T.corona);m.visible=a>.01;if(!m.visible)return;m.position.copy(O).addScaledVector(S,8+ph*150);m.quaternion.copy(q);m.rotateZ(k*(i%2?.6:-.6));m.scale.setScalar(.8+ph*1.4);m.material.opacity=a;});
    this.pillars.forEach((m,i)=>{m.visible=T.pillars>.01;this.pillarMat[i].uniforms.uT.value=k;this.pillarMat[i].uniforms.uA.value=T.pillars*(.75+.25*Math.sin(k*3+i));});
    this.wave.visible=T.wave>=0&&T.wave<12;if(this.wave.visible){const R=20+T.wave*110;this.wave.position.set(VOLCANO.x+CONE.u,1.2,VOLCANO.z+CONE.v);this.wave.scale.setScalar(R);this.wave.material.opacity=Math.max(0,1-T.wave/12)*1.2;}}
}

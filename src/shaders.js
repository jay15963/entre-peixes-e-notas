import * as THREE from 'three';
// Uniformes globais compartilhados entre céu, mar, efeitos do meteoro e pós-processamento.
export const U={
  uTime:{value:0},uStorm:{value:0},uRed:{value:0},uFlash:{value:0},uFlashDir:{value:new THREE.Vector3(0,.3,-1)},
  uSunDir:{value:new THREE.Vector3(-.48,.1,-.86).normalize()},uSunset:{value:0},
  uMeteorPos:{value:new THREE.Vector3(0,-1e4,0)},uMeteorGlow:{value:0},
  uImpact:{value:new THREE.Vector3(0,0,-235)},uImpactAge:{value:-1},uImpactLight:{value:0},
  uTsuR:{value:0},uTsuH:{value:0},uTsuOn:{value:0},
  uBoat:{value:new THREE.Vector2()},uHeading:{value:0},uSpeed:{value:0},uBoatInverse:{value:new THREE.Matrix4()},
  uIslandMap:{value:null},uIsland:{value:new THREE.Vector3(0,118,230)},
  // segunda ilha (vulcão): mesmo esquema de mapa de altura para o mar raso e as ondas quebrando
  uIslandMap2:{value:null},uIsland2:{value:new THREE.Vector3(0,1e6,1)},
  // Nessie sob a água: posição, rumo e força da sombra (x,z,rumo,sombra) e da espuma em volta do corpo
  uBoss:{value:new THREE.Vector4(0,0,0,0)},uBossFoam:{value:0},
  // Eclipse do Coração (sacrifício): escuridão, lua, coroa, anel de diamante, planetas alinhando, auroras, halos
  uEclOn:{value:0},uEclDark:{value:0},uEclCorona:{value:0},uEclAlign:{value:0},uEclAurora:{value:0},uEclT:{value:0},uEclRing:{value:-1},uEclLine:{value:0},uEclArc:{value:0},
  uEclMoon:{value:new THREE.Vector3(0,1,0)},uEclDiamond:{value:new THREE.Vector4(0,1,0,0)},uEclAxis:{value:new THREE.Vector3(1,0,0)},uEclTan:{value:new THREE.Vector3(0,1,0)},
  uPlanets:{value:Array.from({length:6},()=>new THREE.Vector4(0,1,0,0))},
};
export const noiseGLSL=`
float hash12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
float hash13(vec3 p3){p3=fract(p3*.1031);p3+=dot(p3,p3.zyx+31.32);return fract((p3.x+p3.y)*p3.z);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash12(i),hash12(i+vec2(1,0)),f.x),mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),f.x),f.y);}
float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(mix(hash13(i),hash13(i+vec3(1,0,0)),f.x),mix(hash13(i+vec3(0,1,0)),hash13(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash13(i+vec3(0,0,1)),hash13(i+vec3(1,0,1)),f.x),mix(hash13(i+vec3(0,1,1)),hash13(i+vec3(1,1,1)),f.x),f.y),f.z);}
const mat2 ROT=mat2(1.6,1.2,-1.2,1.6);
float fbm(vec2 p){float f=0.,a=.5;for(int i=0;i<5;i++){f+=a*noise(p);p=ROT*p;a*=.5;}return f;}
float fbm3l(vec2 p){float f=0.,a=.5;for(int i=0;i<3;i++){f+=a*noise(p);p=ROT*p;a*=.5;}return f/.875;}
float fbm3(vec3 p){float f=0.,a=.5;for(int i=0;i<5;i++){f+=a*noise3(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return f;}
`;
// Céu físico estilizado: gradiente de Rayleigh, halo de Mie, cinturão de Vênus, nuvens iluminadas,
// cirros, estrelas, cortinas de chuva, brilho do meteoro e do impacto. Mesma função reflete no mar.
export const skyGLSL=`
uniform float uTime,uStorm,uRed,uFlash,uSunset,uMeteorGlow,uImpactAge,uImpactLight;
uniform vec3 uSunDir,uFlashDir,uMeteorPos,uImpact;
uniform float uEclOn,uEclDark,uEclCorona,uEclAlign,uEclAurora,uEclT,uEclRing,uEclLine,uEclArc;uniform vec3 uEclMoon,uEclAxis,uEclTan;uniform vec4 uEclDiamond;uniform vec4 uPlanets[6];
${noiseGLSL}
vec3 eclPal(float t){return .5+.5*cos(6.2832*(t+vec3(0.,.33,.67)));}
vec3 skyGradient(vec3 d){
  float h=d.y,sd=dot(d,uSunDir),toward=dot(normalize(d.xz+1e-4),normalize(uSunDir.xz+1e-4))*.5+.5;
  float hp=max(h,0.);
  vec3 zenith=mix(vec3(.035,.07,.2),vec3(.018,.03,.09),uSunset);
  vec3 mid=mix(vec3(.28,.2,.42),vec3(.2,.1,.28),uSunset);
  vec3 horizonSun=mix(vec3(1.45,.52,.14),vec3(1.3,.3,.07),uSunset);
  vec3 horizonAnti=vec3(.46,.28,.42);
  vec3 horizon=mix(horizonAnti,horizonSun,pow(toward,2.2));
  vec3 col=mix(horizon,mid,smoothstep(0.,.3,hp));
  col=mix(col,zenith,smoothstep(.22,.9,hp));
  // Cinturão de Vênus e sombra da Terra no lado oposto ao sol
  float anti=1.-toward;
  col+=vec3(.5,.22,.3)*anti*exp(-pow((hp-.13)/.07,2.))*.55;
  col=mix(col,vec3(.12,.12,.25),anti*(1.-smoothstep(0.,.06,hp))*.45);
  // Halo de Mie
  float s=max(sd,0.);
  col+=vec3(1.,.42,.12)*(pow(s,6.)*.45+pow(s,48.)*1.4)*(1.-uStorm*.9);
  // Tempestade e céu vermelho
  vec3 stormCol=mix(vec3(.06,.075,.1),vec3(.02,.028,.04),smoothstep(0.,.6,hp));
  col=mix(col,stormCol,uStorm*.94);
  vec3 redCol=mix(vec3(.95,.12,.03),vec3(.14,.01,.025),smoothstep(-.02,.7,hp));
  col=mix(col,redCol,uRed*.9);
  // Brilho do meteoro na direção dele
  vec3 md=uMeteorPos-cameraPosition;float ml=length(md);
  if(uMeteorGlow>0.){float m=max(dot(d,md/ml),0.);col+=vec3(1.,.42,.12)*(pow(m,80.)*.9+pow(m,12.)*.07)*uMeteorGlow;}
  // Impacto: domo de luz no horizonte
  if(uImpactAge>=0.){vec3 id=normalize(uImpact-cameraPosition+vec3(0.,20.,0.));float m=max(dot(d,id),0.);col+=vec3(1.,.55,.25)*(pow(m,8.)*2.2+pow(m,2.)*.4)*uImpactLight;}
  if(uEclOn>0.){float front=clamp(uEclDark*2.3-(1.-dot(d,uSunDir))*.6,0.,1.);float hy=max(h,0.);
    vec3 night=mix(vec3(.02,.014,.05),vec3(.004,.004,.016),smoothstep(0.,.55,hy));
    night+=vec3(1.,.36,.14)*exp(-hy*16.)*.42+vec3(.75,.22,.55)*exp(-hy*5.)*.1;
    col=mix(col,night,front*smoothstep(.0,.2,uEclOn));}
  return col;
}
// ---------- camada do eclipse: estrelas, Via Láctea, nebulosas, auroras, planetas, coroa, lua, anéis, runas ----------
vec3 eclipseLayer(vec3 d,vec3 col,float detail){
  float dk=uEclDark*uEclOn,h=d.y,up=smoothstep(-.02,.06,h);vec3 S=uSunDir;vec3 add=vec3(0.);
  if(dk>.01){
    for(int L=0;L<2;L++){float sc=L==0?80.:190.;vec3 p=d*sc,c=floor(p),f=fract(p);float hs=hash13(c+float(L)*17.);
      if(hs>(L==0?.8:.9)){vec3 o=vec3(hash13(c+3.1),hash13(c+7.7),hash13(c+11.3))*.6+.2;float r=length(f-o),mag=pow(hash13(c+19.9),3.),sz=(L==0?.06:.08)+mag*.12;
        float tw=.6+.4*sin(uTime*(2.+hs*6.)+hs*40.);vec3 sc2=mix(vec3(.6,.72,1.),vec3(1.,.86,.62),hash13(c+23.));sc2=mix(sc2,vec3(1.,.45,.4),step(.94,hash13(c+29.)));
        add+=sc2*(1.-smoothstep(sz*.25,sz,r))*(L==0?1.8:1.)*(.35+mag*2.4)*tw;}}
    vec3 B=normalize(vec3(.35,.62,.7));float ac=dot(d,B),band=exp(-ac*ac*12.);
    float n1=fbm3(d*3.2+vec3(uEclT*.012,0.,0.)),n2=detail>.5?fbm3(d*8.5+3.1):.5;
    vec3 neb=mix(vec3(.38,.08,.6),vec3(.04,.5,.62),smoothstep(.3,.7,n1));neb=mix(neb,vec3(1.,.28,.58),smoothstep(.55,.8,n2)*.7);
    add+=neb*band*(.3+n1)*(1.-smoothstep(.45,.62,n2)*.6)*1.3+vec3(.9,.86,1.)*band*pow(n2,3.)*.7;
    if(detail>.5)add+=eclPal(n1*1.4+uEclT*.02)*pow(smoothstep(.52,.86,fbm3(d*2.2-7.)),2.)*.45;
    add*=up*dk;
    // auroras: cortinas que dançam, verde embaixo e magenta em cima, com raios verticais
    if(uEclAurora>0.&&h>0.){float az=atan(d.x,d.z),a=0.,base=.07+.05*sin(az*2.+uEclT*.3);vec2 cz=vec2(cos(az),sin(az));
      for(int k=0;k<2;k++){float fk=float(k),wav=noise(cz*(2.2+fk*1.4)+vec2(uEclT*(.15+fk*.1),fk*7.+uEclT*.05)),y0=base+wav*.13+fk*.05;
        float rays=.5+.5*noise(cz*24.+vec2(fk*13.,uEclT*.7));a+=smoothstep(y0-.012,y0+.02,h)*exp(-(h-y0)*mix(6.,3.2,fk))*rays*(k==0?1.:.65);}
      vec3 cA=mix(vec3(.1,1.,.45),vec3(.9,.25,1.),smoothstep(base+.02,base+.32,h));cA=mix(cA,eclPal(cz.x*.35+cz.y*.2+uEclT*.05),.3);add+=cA*a*uEclAurora*1.1;}
    // estrelas cadentes
    if(detail>.5)for(int k=0;k<6;k++){float fk=float(k),cyc=uEclT*.33+fk*.173,id=floor(cyc),ph=fract(cyc);if(ph>.3)continue;
      vec3 a0=normalize(vec3(hash12(vec2(id,fk))*2.-1.,.4+hash12(vec2(fk,id+3.))*.6,hash12(vec2(id+7.,fk))*2.-1.));vec3 dir=normalize(cross(a0,vec3(hash12(vec2(id,2.))-.5,1.,hash12(vec2(4.,id))-.5)));
      float pp=ph/.3;vec3 hd=normalize(a0+dir*pp*.55),tl=normalize(a0+dir*max(pp-.14,0.)*.55),ab=hd-tl;float tt=clamp(dot(d-tl,ab)/max(dot(ab,ab),1e-6),0.,1.),ds=length(d-tl-ab*tt);
      add+=mix(vec3(.6,.8,1.),eclPal(fk*.17),.5)*exp(-ds*ds*3e5)*tt*(1.-pp)*2.5*dk;}}
  // fio de luz do alinhamento (arco que passa pelos planetas até o eclipse), com pulsos correndo
  if(uEclLine>0.){float dl=dot(d,uEclAxis),along=atan(dot(d,uEclTan),dot(d,S));
    if(along>-.02&&along<uEclArc){float ln=exp(-dl*dl*6e5)*1.4+exp(-dl*dl*2.5e4)*.3;add+=mix(vec3(1.,.86,.55),eclPal(along*.9-uEclT*.35),.55)*ln*(.55+.45*sin(along*70.-uEclT*9.))*uEclLine;}}
  // planetas (luz vinda do sol eclipsado + brilho próprio mágico); Saturno com anéis
  for(int i=0;i<6;i++){vec4 P=uPlanets[i];if(P.w<=0.)continue;vec3 pd=P.xyz,dv=d-pd;float rr=P.w;if(length(dv)>rr*6.)continue;
    vec3 ux=normalize(cross(pd,vec3(0.,1.,0.))),uy=cross(ux,pd);vec2 q=vec2(dot(dv,ux),dot(dv,uy))/rr;float l=length(q);
    vec3 pc=i==0?vec3(.75,.7,.68):i==1?vec3(1.,.88,.62):i==2?vec3(1.,.42,.25):i==3?vec3(.95,.72,.5):i==4?vec3(.35,.55,1.):vec3(.95,.82,.55);
    add+=pc*exp(-max(l-1.,0.)*1.1)*.55*step(1.,l)*(.6+uEclAlign*1.4);
    float ringA=0.;vec3 ringC=vec3(0.);if(i==5){vec2 rq=vec2(q.x*.94+q.y*.34,-q.x*.34+q.y*.94);float er=length(vec2(rq.x,rq.y*3.4));ringA=smoothstep(1.32,1.42,er)*(1.-smoothstep(2.2,2.32,er))*(.55+.45*sin(er*34.))*(l>1.||rq.y<0.?1.:0.);ringC=mix(vec3(.9,.8,.6),vec3(.7,.6,.45),fract(er*3.));}
    if(l<1.){vec3 nr=vec3(q,sqrt(1.-l*l)),Ls=normalize(vec3(dot(S-pd,ux),dot(S-pd,uy),.35));float df=clamp(dot(nr,Ls),0.,1.);
      float bands=.5+.5*sin(q.y*(i==3?22.:i==5?16.:6.)+noise(q*5.+float(i))*3.);vec3 surf=pc*mix(.7,1.15,bands);if(i==2)surf*=.75+.5*noise(q*7.);if(i==4)surf=mix(surf,vec3(.6,.85,1.),noise(q*4.)*.4);if(i==3&&length(q-vec2(.35,-.3))<.16)surf=vec3(.9,.35,.2);
      col=surf*(.5+df*1.1)+pc*pow(1.-nr.z,2.2)*1.6;add*=0.;}
    add+=ringC*ringA*.9;}
  // sol, lua, coroa, proeminências, anéis de halo, runas e anel de diamante (coordenadas do disco solar, raio 1 = sol)
  vec3 ux=normalize(cross(S,vec3(0.,1.,0.))),uy=cross(ux,S);float Rs=.0245;vec2 q=vec2(dot(d-S,ux),dot(d-S,uy))/Rs;float r=length(q),th=atan(q.y,q.x);
  if(r<16.){vec2 m=vec2(dot(uEclMoon-S,ux),dot(uEclMoon-S,uy))/Rs;float ml=length(q-m),Rm=1.045,mm=1.-smoothstep(Rm-.02,Rm+.02,ml);
    float co=uEclCorona;
    if(co>0.){float st=pow(noise(vec2(th*3.,uEclT*.05))*.6+noise(vec2(th*9.,uEclT*.1+3.))*.4,2.2);float x=max(r-1.,0.);
      float cor=exp(-x*2.4)*1.3+exp(-x*.5)*st*1.4+exp(-x*.22)*.07+pow(abs(sin(th*7.+uEclT*.12)),26.)*exp(-x*.15)*.34;
      vec3 cc=mix(vec3(1.,.97,.93),eclPal(th/6.2832+uEclT*.03+r*.06),smoothstep(1.4,5.,r)*.85);add+=cc*cor*co*2.*(1.-mm)*step(.98,r)*(1.-smoothstep(8.,15.,r));
      add+=vec3(1.,.18,.38)*smoothstep(.62,.8,noise(vec2(th*14.,uEclT*.2)))*exp(-x*9.)*step(.99,r)*co*3.5*(1.-mm);
      add+=vec3(1.,.35,.55)*exp(-pow((ml-Rm)*70.,2.))*co*1.2;
      // círculo de runas girando e segundo anel pontilhado (magia do alinhamento)
      float ra=uEclAlign*co;if(ra>0.){float c1=exp(-pow((r-5.6)*9.,2.))*.8+step(abs(r-6.05),.22)*smoothstep(.36,.0,abs(fract(th*36./6.2832+uEclT*.012)-.5))*.9;
        float c2=exp(-pow((r-7.4)*12.,2.))*smoothstep(.3,.0,abs(fract(th*72./6.2832-uEclT*.02)-.5))*1.2;add+=(vec3(1.,.78,.4)*c1+eclPal(th*.3+uEclT*.1)*c2)*ra;}}
    if(uEclRing>=0.)for(int k=0;k<3;k++){float tk=uEclRing-float(k)*.55;if(tk<0.)continue;float rr=1.8+tk*6.;add+=eclPal(r*.035+float(k)*.22+uEclT*.1)*exp(-pow((r-rr)*2.,2.))*exp(-tk*.38)*.55;}
    col=mix(col,vec3(.004,.004,.009)+vec3(.02,.028,.05)*co*(1.-ml/Rm),mm*smoothstep(0.,.3,uEclOn));}
  if(uEclDiamond.w>0.){vec3 D=uEclDiamond.xyz;vec2 fq=vec2(dot(d-D,ux),dot(d-D,uy))/Rs;float dd=length(fq);
    float fl=exp(-dd*dd*30.)*7.+exp(-dd*2.2)*.9+(exp(-abs(fq.y)*50.)*exp(-abs(fq.x)*.6)+exp(-abs(fq.x)*50.)*exp(-abs(fq.y)*.6))*1.3;
    vec2 f2=vec2(fq.x+fq.y,fq.x-fq.y)*.707;fl+=(exp(-abs(f2.y)*70.)*exp(-abs(f2.x)*1.2)+exp(-abs(f2.x)*70.)*exp(-abs(f2.y)*1.2))*.6;
    add+=vec3(1.,.97,.9)*fl*uEclDiamond.w;}
  return col+add;
}
float cloudDensity(vec2 uv,float detail){
  vec2 w=vec2(fbm3l(uv*.5+uTime*.004),fbm3l(uv*.5+7.3-uTime*.003));
  float base=detail>.5?fbm(uv+w*1.3):fbm3l(uv+w*1.3);
  float cover=mix(.52,.3,uStorm)-uRed*.04+uEclOn*.5;
  return smoothstep(cover,cover+mix(.24,.18,uStorm),base);
}
vec3 skyColor(vec3 d,float detail){
  vec3 col=skyGradient(d);
  float h=d.y,sd=max(dot(d,uSunDir),0.);
  // Disco solar achatado pela refração perto do horizonte, com escurecimento de borda
  vec3 dd=normalize(vec3(d.x,uSunDir.y+(d.y-uSunDir.y)*1.25,d.z));float disc=smoothstep(.99955,.9997,dot(dd,uSunDir));
  col=mix(col,vec3(9.,4.6,1.7)*(.7+.3*smoothstep(.9996,.99995,dot(dd,uSunDir))),disc*(1.-uStorm)*(1.-uRed)*smoothstep(-.01,.01,h));
  // Estrelas no zênite
  // pontos redondos com posição sorteada dentro da célula (o hash com a célula deslocada evita fileiras alinhadas);
  // somem de vez com nuvens de tempestade e com o céu vermelho
  float starVis=(1.-smoothstep(.02,.25,uStorm))*(1.-smoothstep(0.,.2,uRed));
  if(h>.25&&starVis>0.){vec2 sp=d.xz/(h+.3)*180.;vec2 cell=floor(sp);float st=hash12(cell*1.37+vec2(17.3,91.7));vec2 off=vec2(hash12(cell+vec2(3.1,7.7)),hash12(cell+vec2(11.9,5.3)))*.6+.2;
    float r=length(fract(sp)-off);float tw=.6+.4*sin(uTime*3.+st*60.);col+=vec3(.9,.9,1.)*step(.9975,st)*(1.-smoothstep(.06,.16,r))*smoothstep(.25,.7,h)*tw*.9*starVis;}
  if(h>0.){
    vec2 uv=d.xz/(h+.12)*1.4+vec2(uTime*mix(.012,.045,uStorm),uTime*.004);
    float dens=cloudDensity(uv,detail)*smoothstep(0.,.1,h);
    float toward=pow(max(dot(normalize(d.xz+1e-4),normalize(uSunDir.xz+1e-4)),0.),3.);
    // Luz através da nuvem: amostra deslocada em direção ao sol
    float lit=1.-cloudDensity(uv+normalize(uSunDir.xz)*.18,0.)*.8;
    vec3 under=mix(vec3(.34,.16,.26),vec3(1.25,.45,.2),toward*.8+.2)*mix(1.,.6,smoothstep(.2,.6,h));
    vec3 top=mix(vec3(1.4,.8,.45),vec3(2.1,1.1,.45),toward);
    vec3 cc=mix(under,top,lit*lit*(.4+toward*.6));
    cc+=vec3(2.,.9,.3)*pow(sd,12.)*(1.-dens)*2.2;
    vec3 stormC=mix(vec3(.022,.026,.034),vec3(.075,.085,.1),lit);
    cc=mix(cc,stormC,uStorm);
    cc=mix(cc,mix(vec3(.12,.012,.01),vec3(.85,.17,.04),lit*.6+.4*(1.-smoothstep(0.,.35,h))),uRed*.85);
    col=mix(col,cc,dens*.96);
    // Cirros altos
    float ci=smoothstep(.55,.85,fbm3l(vec2(uv.x*.6,uv.y*3.)+3.1))*smoothstep(.08,.4,h)*(1.-uStorm);
    col+=mix(vec3(.5,.2,.15),vec3(1.2,.6,.3),toward)*ci*.28*(1.-dens);
    // Relâmpago iluminando as nuvens por dentro
    float f=max(dot(d,uFlashDir),0.);col+=vec3(.55,.6,.85)*uFlash*(pow(f,10.)*3.5*(.3+dens)+.18);
  }
  // Cortinas de chuva no horizonte durante a tempestade
  float curtain=(1.-smoothstep(.0,.25,abs(h-.02)))*smoothstep(.45,.75,noise(vec2(atan(d.x,d.z)*14.,uTime*.05)))*uStorm;
  col=mix(col,vec3(.05,.06,.075),curtain*.55);
  if(h<0.)col=mix(col,skyGradient(vec3(d.x,0.,d.z))*.7,(1.-smoothstep(-.1,0.,h)));
  if(uEclOn>0.)col=eclipseLayer(d,col,detail);
  return col;
}`;
export const skyVertex=`varying vec3 vDirection;void main(){vDirection=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}`;
export const skyFragment=`varying vec3 vDirection;${skyGLSL}
void main(){vec3 d=normalize(vDirection);vec3 col=skyColor(d,1.);col+=(hash12(gl_FragCoord.xy+uTime)-.5)/255.;gl_FragColor=vec4(col,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;

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
${noiseGLSL}
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
  return col;
}
float cloudDensity(vec2 uv,float detail){
  vec2 w=vec2(fbm3l(uv*.5+uTime*.004),fbm3l(uv*.5+7.3-uTime*.003));
  float base=detail>.5?fbm(uv+w*1.3):fbm3l(uv+w*1.3);
  float cover=mix(.52,.3,uStorm)-uRed*.04;
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
  return col;
}`;
export const skyVertex=`varying vec3 vDirection;void main(){vDirection=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}`;
export const skyFragment=`varying vec3 vDirection;${skyGLSL}
void main(){vec3 d=normalize(vDirection);vec3 col=skyColor(d,1.);col+=(hash12(gl_FragCoord.xy+uTime)-.5)/255.;gl_FragColor=vec4(col,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;

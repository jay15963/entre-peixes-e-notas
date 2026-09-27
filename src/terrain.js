// Ilha central: função de altura pura (sem three.js) usada pelo visual, pela física, pela colisão,
// pelo casco do barco e pelas ondas quebrando na praia. Coordenadas locais u (leste) e v (norte a partir do centro).
export const ISLAND={x:0,z:118,size:230,plateau:1.6};
export const DOCK={u0:-1.6,u1:1.6,v0:-81,v1:-47,y:.78,rampFrom:-49,rampTo:-56};
// Vaga do barco: encostado no lado leste do cais, proa apontando para o mar aberto (−z)
export const BERTH={u:3.3,v:-70,heading:Math.PI};
export const SHOP={u0:-16,u1:16,v0:4,v1:28,floor:1.74};
// Cabeços de amarração no lado leste do cais (onde o barco encosta): alvos da corda
export const BOLLARDS=[-78,-72,-66,-60].map(v=>({u:1.25,v,y:.78+.26}));
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
function hash(i,j){let h=Math.imul(i|0,374761393)+Math.imul(j|0,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;}
function vnoise(x,y){const i=Math.floor(x),j=Math.floor(y),fx=x-i,fy=y-j,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);const a=hash(i,j),b=hash(i+1,j),c=hash(i,j+1),d=hash(i+1,j+1);return a+(b-a)*sx+(c-a)*sy+(a-b-c+d)*sx*sy;}
export function fbm2(x,y,o=4){let f=0,a=.5;for(let i=0;i<o;i++){f+=a*vnoise(x,y);x=x*2.03+7.1;y=y*2.03+3.7;a*=.5;}return f/(1-Math.pow(.5,o));}
// Raio da linha d'água por direção: praia sul quase reta (vila e cais), promontório rochoso a oeste
export function shoreRadius(a){
  let r=62+7*Math.sin(3*a+1.1)+4*Math.sin(5*a+2.3)+2.2*Math.sin(9*a+.4)+1.2*Math.sin(15*a+1.7);
  const south=Math.exp(-Math.pow((a+Math.PI/2)/.55,2));r=r*(1-south)+57.5*south;
  const west=Math.exp(-Math.pow(Math.atan2(Math.sin(a-Math.PI*.93),Math.cos(a-Math.PI*.93))/.28,2));r+=west*14;
  return r;
}
const gauss=(u,v,cu,cv,r)=>Math.exp(-((u-cu)**2+(v-cv)**2)/(r*r));
function box(u,v,u0,u1,v0,v1,soft){return smooth(u0-soft,u0,u)*(1-smooth(u1,u1+soft,u))*smooth(v0-soft,v0,v)*(1-smooth(v1,v1+soft,v));}
// Áreas planas construídas: rua, praça, calçadão, lotes das casas e o terreno do mercado
export const HOUSES=[
  {u:-10.5,v:-39,w:7.4,d:8.6,face:1,color:0xf0c35a,roof:0xb4552f,floors:1,trim:0xfdf8ec,door:0x2f6d8c},
  {u:-10.5,v:-27.5,w:7,d:8,face:1,color:0xea9aa0,roof:0xa84a2c,floors:2,trim:0xffffff,door:0x7a3b2a},
  {u:-10.5,v:-16.5,w:7.2,d:8.4,face:1,color:0x86b8d8,roof:0xb65a33,floors:1,trim:0xfdfaf2,door:0xf2c14e},
  {u:10.5,v:-39,w:7.2,d:8.2,face:-1,color:0x9dd3b4,roof:0xa9502d,floors:1,trim:0xffffff,door:0xc2452f},
  {u:10.5,v:-27.5,w:7.6,d:8.6,face:-1,color:0xf2efe6,roof:0xb45c35,floors:2,trim:0x2f6fa8,door:0x2f6fa8},
  {u:10.5,v:-16.5,w:7,d:8,face:-1,color:0xeb8d52,roof:0xa34a2b,floors:1,trim:0xfff7e6,door:0x3c7a5a},
  // casas de frente para o mar (rot = rotação do grupo; a fachada olha para −v)
  {u:-21,v:-39,w:7.4,d:8,rot:Math.PI/2,color:0xf6e27a,roof:0xb4552f,floors:2,trim:0x2f6fa8,door:0x2f6fa8,bougainvillea:true},
  {u:21,v:-39,w:7,d:8,rot:Math.PI/2,color:0x7fc7c0,roof:0xa84a2c,floors:1,trim:0xffffff,door:0xe06a3a},
  {u:-30,v:-35.5,w:7,d:7.6,rot:Math.PI/2,color:0xf3b0c3,roof:0xa9502d,floors:1,trim:0xffffff,door:0x3c6a9a},
  {u:30,v:-35.5,w:7.2,d:7.6,rot:Math.PI/2,color:0xfaf4e4,roof:0xb65a33,floors:1,trim:0x3a8a5a,door:0x3a8a5a,bougainvillea:true},
  // Rua da Figueira, à esquerda do mercado (quem chega pelo cais): casas dos dois lados de uma travessa de pedra
  {u:24.6,v:8.5,w:7.2,d:7.6,face:1,color:0xc9e3a4,roof:0xb4552f,floors:1,trim:0xffffff,door:0x7a3b2a},
  {u:24.6,v:19,w:7,d:7.6,face:1,color:0xf4c7a1,roof:0xa84a2c,floors:2,trim:0xfdf8ec,door:0x2f6d8c,bougainvillea:true},
  {u:24.6,v:29.5,w:7.2,d:7.4,face:1,color:0xa9c7e8,roof:0xb65a33,floors:1,trim:0xffffff,door:0xc2452f},
  {u:37.6,v:10,w:7.4,d:7.6,face:-1,color:0xf7ecd0,roof:0xa9502d,floors:2,trim:0x2f6fa8,door:0x2f6fa8},
  {u:37.6,v:21.5,w:7,d:7.4,face:-1,color:0xe7a3b6,roof:0xb4552f,floors:1,trim:0xffffff,door:0x3c7a5a},
];
export const LANE={u:31,u0:28.6,u1:33.4,v0:-6,v1:33};
// igrejinha açoriana de frente para o chafariz da praça
export const CHURCH={u:-31,v:-4,d:14,w:9};
export function footprint(h){const r=h.rot??(h.face>0?0:Math.PI),swap=Math.abs(Math.sin(r))>.5;return swap?[h.w/2,h.d/2]:[h.d/2,h.w/2];}
export function flatMask(u,v){
  let m=box(u,v,-5.6,5.6,-50,4,2.5);// rua com calçadas até a praça
  m=Math.max(m,box(u,v,-33,33,-51.5,-45.5,2));// calçadão da orla
  m=Math.max(m,box(u,v,-24,24,-11,4,3));// praça e estacionamento
  m=Math.max(m,box(u,v,SHOP.u0-3,SHOP.u1+3,SHOP.v0-1,SHOP.v1+3,3));
  m=Math.max(m,box(u,v,LANE.u0-.5,LANE.u1+.5,LANE.v0,LANE.v1,2.5));
  for(const h of HOUSES){const [a,b]=footprint(h);m=Math.max(m,box(u,v,h.u-a-2,h.u+a+2,h.v-b-2,h.v+b+2,2.5));}
  m=Math.max(m,box(u,v,CHURCH.u-CHURCH.d/2-1.5,CHURCH.u+CHURCH.d/2+4,CHURCH.v-CHURCH.w/2-3,CHURCH.v+CHURCH.w/2+2,2.5));
  return m;
}
// Trilha de terra até o farol
export function pathMask(u,v){if(v<SHOP.v1)return 0;const cu=-19+Math.sin(v*.09)*3,d=Math.abs(u-cu);return (1-smooth(1.1,2.2,d))*smooth(SHOP.v1,SHOP.v1+4,v)*(1-smooth(40,44,v));}
export const LIGHTHOUSE={u:-10,v:44};
export function terrainLocal(u,v){
  const r=Math.hypot(u,v),a=Math.atan2(v,u),R=shoreRadius(a),s=r/R;
  // perfil: platô, praia, plataforma submersa e mar aberto
  let h=ISLAND.plateau*(1-smooth(.78,1.0,s));
  h-=4.5*smooth(1.0,1.32,s)+5*smooth(1.3,1.9,s)+.5*smooth(.96,1.06,s);
  const land=1-smooth(.82,.98,s);
  // morros: farol ao norte, colina a leste, promontório rochoso a oeste
  h+=land*(10.5*gauss(u,v,LIGHTHOUSE.u,LIGHTHOUSE.v,20)+3.6*gauss(u,v,34,14,15)+2.4*gauss(u,v,-30,20,14));
  const west=gauss(u,v,-66,-6,16);h+=west*(7+fbm2(u*.18,v*.18)*6)*smooth(.7,1.15,s+.2);
  h+=land*(fbm2(u*.06+3,v*.06)-.5)*1.6+(fbm2(u*.35,v*.35)-.5)*.18;
  const flat=flatMask(u,v);h=h*(1-flat)+ISLAND.plateau*flat;
  const path=pathMask(u,v);h-=path*.12;
  return h;
}
export function terrainHeight(x,z){return terrainLocal(x-ISLAND.x,z-ISLAND.z);}
// Piso caminhável (terreno + cais + calçadas + mercado). Retorna a altura do chão em coordenadas do mundo.
export function dockFloor(u,v){if(u<DOCK.u0||u>DOCK.u1||v<DOCK.v0||v>DOCK.v1)return -99;if(v>DOCK.rampFrom)return ISLAND.plateau;if(v>DOCK.rampTo)return DOCK.y+(ISLAND.plateau-DOCK.y)*(v-DOCK.rampTo)/(DOCK.rampFrom-DOCK.rampTo);return DOCK.y;}
export function groundLocal(u,v){
  let g=terrainLocal(u,v);
  g=Math.max(g,dockFloor(u,v));
  if(u>=SHOP.u0&&u<=SHOP.u1&&v>=SHOP.v0&&v<=SHOP.v1)g=SHOP.floor;
  else if(Math.abs(u)>3.5&&Math.abs(u)<5.5&&v>-45.5&&v<-11)g=ISLAND.plateau+.12;// calçadas
  return g;
}
export function groundHeight(x,z){return groundLocal(x-ISLAND.x,z-ISLAND.z);}

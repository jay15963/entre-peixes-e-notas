// Loja do Pescador (supermercado Althoff): preço, tipo e regra de cada um dos 50 itens do catálogo.
// Dados puros (sem three.js): o anfitrião, a interface e os testes usam as mesmas tabelas.
// kind: passive (vale enquanto está na mochila) · tool (usa com o botão esquerdo) · charges (usos que acabam)
//       bait (isca: vai no anzol e gasta um uso por lançamento) · boat (instalado no barco para a tripulação) · place (fica no mundo)
import {STORE_ITEMS,STORE_CATEGORIES} from './store-catalog.js';
import {CATCHES} from './catalog.js';
import {clamp} from './core.js';

const D={
  rod:{price:220,kind:'passive',rule:'Lança a 11 m (antes 7 m) e a linha aguenta 35% mais tensão com peixes acima de 5 kg.'},
  reel:{price:260,kind:'passive',rule:'Recolhe 30% mais rápido e o freio segura 25% da tensão.'},
  harpoon:{price:340,kind:'charges',uses:3,rule:'Mire na Nessie (até 70 m) para prendê-la ao barco por 8 s: ela fica lenta e leva 50% mais dano. Num peixe de 8 kg ou mais na linha, arpoa e adianta 40% da briga.'},
  net:{price:90,kind:'tool',cool:2,rule:'Com um peixe de até 3 kg na linha, clique: o passaguá tira ele da água na hora.'},
  gaff:{price:120,kind:'tool',cool:2,rule:'Peixe de 3 kg ou mais já perto do casco (55% da briga): clique para embarcar na hora.'},
  knife:{price:70,kind:'tool',cool:1,rule:'Filete o último pescado do balde: vira 3 iscas de corte (mordida mais rápida) e uma provisão (+12% de velocidade por 60 s).'},
  pliers:{price:60,kind:'passive',rule:'Se a linha arrebentar você não perde a isca, e cada lixo pescado rende R$ 3 em peças recuperadas.'},
  tackle:{price:150,kind:'passive',rule:'Iscas ficam na maleta (não ocupam espaço na mochila) e rendem 50% mais usos.'},
  line:{price:140,kind:'passive',rule:'Peixes raros ×1,6, épicos ×1,8 e lendários ×2; mordida 15% mais rápida.'},
  scale:{price:80,kind:'passive',rule:'Mostra espécie, peso e valor do que está na linha e o valor do balde.'},
  sonar:{price:450,kind:'boat',rule:'Painel no HUD com os cardumes e as silhuetas grandes sob o barco (gasta energia).'},
  compass:{price:60,kind:'passive',rule:'Bússola no topo da tela com a direção de Laguna, das marcas e das boias.'},
  sextant:{price:160,kind:'tool',cool:1,rule:'Mire em qualquer ponto até 600 m e clique para marcar (até 3 marcas da tripulação).'},
  scope:{price:110,kind:'tool',cool:.3,rule:'Clique para usar a luneta (zoom 5×): identifica cardumes, algas, boias, gaivotas e a Nessie à distância.'},
  radio:{price:280,kind:'boat',rule:'Avisos de clima e pistas dos eventos do lago no HUD (gasta energia).'},
  beacon:{price:45,kind:'charges',uses:1,rule:'Clique mirando na água (até 25 m): a boia pisca e aparece para toda a tripulação.'},
  depth:{price:95,kind:'passive',rule:'Mostra a profundidade na mira. Em água funda (20 m+) as espécies de fundo vêm ×2.'},
  chart:{price:120,kind:'passive',rule:'Minimapa com a rota percorrida, a ilha, o barco, marcas, boias, armadilhas e algas.'},
  barometer:{price:130,kind:'boat',rule:'Barômetro no HUD: pressão, tendência e o tempo até a tempestade chegar ou passar.'},
  camera:{price:230,kind:'tool',cool:2,rule:'Tire fotos: a Nessie vale R$ 350 (1ª foto de cada luta), peixes épicos ou lendários na linha R$ 60 e o meteoro R$ 500.'},
  anchor:{price:240,kind:'boat',rule:'E na âncora da proa: o barco para de derivar, balança menos e a pesca a bordo rende 10% mais. Recolher leva 3,5 s.'},
  winch:{price:380,kind:'boat',rule:'Recolhe a âncora na hora; peixes de 8 kg+ e o baú do tesouro sobem 50% mais rápido a bordo; +1 captura por armadilha.'},
  motor:{price:900,kind:'boat',rule:'Velocidade máxima 5 → 8,5 m/s. Gasta combustível (vem com o tanque cheio).'},
  propeller:{price:210,kind:'boat',rule:'O barco atravessa as algas sem perder velocidade e ganha 8% de velocidade máxima.'},
  rudder:{price:170,kind:'boat',rule:'Leme maior: o barco vira 35% mais rápido (ótimo para desviar da Nessie).'},
  pump:{price:260,kind:'boat',rule:'Tira 3% de água do porão por segundo, automaticamente.'},
  battery:{price:200,kind:'boat',rule:'Sonar e rádio duram 3× mais com a mesma carga (a energia volta com o motor ligado ou atracado).'},
  repair:{price:150,kind:'charges',uses:1,rule:'A bordo e fora de combate: +40% de resistência do casco.'},
  fuel:{price:55,kind:'charges',uses:1,rule:'A bordo: +50% de combustível no Motor Rabeta-40.'},
  drogue:{price:160,kind:'boat',rule:'E na âncora de deriva (popa): deriva ÷5, balanço ÷2 e a proa se alinha às ondas.'},
  lantern:{price:120,kind:'boat',rule:'Luz forte no convés (E liga/desliga). Acesa, peixes pequenos ×1,6 e mordida 15% mais rápida (o dobro na tempestade).'},
  torch:{price:90,kind:'tool',cool:.3,rule:'Clique para acender: ilumina a água e revela tesouros submersos, cardumes e a Nessie sob a superfície.'},
  flask:{price:45,kind:'charges',uses:3,rule:'Um gole: tira o frio, recupera o fôlego e aquece por 90 s.'},
  stove:{price:190,kind:'tool',cool:4,rule:'Cozinha o último peixe do balde: refeição para quem está perto (até 5 min, melhor com peixe caro): +15% de velocidade e de pesca.'},
  medkit:{price:110,kind:'charges',uses:2,rule:'+60 de vida e trata o ferimento (em terra, perto de Laguna, a vida volta sozinha).'},
  vest:{price:130,kind:'passive',rule:'Na água você aguenta 45 s (antes 20 s) e nada 15% mais rápido.'},
  oxygen:{price:240,kind:'passive',rule:'Fôlego debaixo d’água: 12 s → 75 s.'},
  fins:{price:150,kind:'passive',rule:'Nada 2,6× mais rápido e mergulha mais fundo.'},
  pack:{price:170,kind:'passive',rule:'+4 espaços na mochila; as iscas não molham quando você cai no mar.'},
  tent:{price:260,kind:'place',rule:'Clique em terra para armar a barraca: vira seu ponto de retorno; E nela descansa (vida cheia, sem frio, +10% de velocidade).'},
  lure:{price:60,kind:'bait',uses:5,rule:'Isca: predadores (robalo, espada, garoupa, dourado, atum, marlim) ×3 e metade do lixo.'},
  frog:{price:50,kind:'bait',uses:5,rule:'Isca: nas algas, predadores ×4 e mordida 30% mais rápida; fora delas ×1,3.'},
  shrimp:{price:40,kind:'bait',uses:6,rule:'Isca: espécies de fundo ×2,5 e permite lançar rente às pedras (água rasa).'},
  spinner:{price:45,kind:'bait',uses:5,rule:'Isca: mordida 20% mais rápida; na tempestade (água turva) 50% e raros ×1,5.'},
  chum:{price:70,kind:'charges',uses:1,rule:'Clique mirando na água: um cardume fica ali por 2 min (mordida 55% mais rápida, quase sem lixo).'},
  rattle:{price:320,kind:'charges',uses:1,rule:'Chama a Nessie na hora (se o evento estiver armado); senão atrai lendários ×4 e épicos ×2 por 90 s.'},
  decoy:{price:180,kind:'charges',uses:1,rule:'Clique mirando na água: a Nessie persegue o chamariz por 12 s e as gaivotas somem por 40 s.'},
  hydrophone:{price:290,kind:'passive',rule:'Ouve a Nessie: direção, distância e o aviso do próximo ataque.'},
  flare:{price:75,kind:'charges',uses:2,rule:'Dispare para o alto: luz por 15 s, gaivotas e Nessie marcadas para todos e a posição do barco no HUD por 60 s.'},
  trap:{price:210,kind:'place',rule:'Clique na água (até 12 m, 2 m de fundo): a cada 45 s pega uma lagosta ou caranguejo (até 4). E na boia recolhe.'},
};
// fora da loja: itens que dependiam de vida, frio, casco ou alagamento (sistemas que o jogo não tem)
export const REMOVED=new Set(['medkit','flask','repair','pump','tent']);
export const ITEMS=Object.fromEntries(STORE_ITEMS.filter(it=>!REMOVED.has(it.id)).map(it=>{const d=D[it.id];return [it.id,{...it,...d,price:Math.round(d.price*2.5/5)*5,rule:d.kind==='boat'?d.rule+' Melhoria do barco: com ela na mochila, segure E olhando o barco para instalar (some se o barco reaparecer no cais).':d.rule,status:'À venda na Loja do Pescador'}];}));
// isca de corte: sai da faca (não é vendida)
ITEMS.cut={id:'cut',name:'Isca de corte',description:'Pedaços frescos de peixe.',effect:'Mordida 40% mais rápida.',kind:'bait',uses:3,price:0,rule:'Isca: mordida 40% mais rápida.',category:'Iscas e caçada',number:0};
export const ITEM_IDS=STORE_ITEMS.filter(i=>!REMOVED.has(i.id)).map(i=>i.id);
export {STORE_CATEGORIES};
export const BASE_SLOTS=8,PACK_SLOTS=4,CART_MAX=6;
export const CATEGORY_SHORT=['PESCA DE PRECISÃO','NAVEGAÇÃO E PESQUISA','OFICINA DE BORDO','EXPEDIÇÃO E SOBREVIVÊNCIA','ISCAS E CAÇADA'];
export const USABLE=new Set(Object.values(ITEMS).filter(i=>i.kind==='tool'||i.kind==='charges'||i.kind==='bait'||i.kind==='place').map(i=>i.id));

// ---------- inventário (p.inv = [[id,usos],...]) ----------
export const invHas=(p,id)=>!!(p?.inv||[]).find(e=>e[0]===id);
export const invUses=(p,id)=>(p?.inv||[]).find(e=>e[0]===id)?.[1]||0;
export function slotsOf(p){return BASE_SLOTS+(invHas(p,'pack')?PACK_SLOTS:0);}
// iscas vão para a maleta (se tiver): não ocupam espaço
export function usedSlots(p){const tackle=invHas(p,'tackle');return (p.inv||[]).filter(e=>!(tackle&&ITEMS[e[0]]?.kind==='bait')).length;}
// Pode comprar/receber? devolve null ou o motivo
export function cannotAdd(p,id,gear={}){const it=ITEMS[id];if(!it)return 'Item desconhecido.';
  if(it.kind==='boat'&&gear[id])return 'Já está instalado no barco.';
  const has=invHas(p,id);if(has&&(it.kind==='passive'||it.kind==='tool'||it.kind==='place'||it.kind==='boat'))return 'Você já tem.';
  if(has)return null;const tackle=invHas(p,'tackle');if(it.kind==='bait'&&tackle)return null;
  return usedSlots(p)>=slotsOf(p)?'Mochila cheia.':null;}
export function addItem(p,id,gear={}){const it=ITEMS[id],why=cannotAdd(p,id,gear);if(why)return why;
  p.inv=p.inv||[];const uses=it.uses?Math.round(it.uses*(it.kind==='bait'&&invHas(p,'tackle')?1.5:1)):0;const e=p.inv.find(q=>q[0]===id);if(e)e[1]+=uses;else p.inv.push([id,uses]);return null;}
export function consume(p,id,n=1){const e=(p.inv||[]).find(q=>q[0]===id);if(!e)return false;e[1]-=n;if(e[1]<=0){p.inv.splice(p.inv.indexOf(e),1);if(p.bait===id)p.bait=null;}return true;}
// o que a cesta do supermercado aceita: repete só o que tem usos (iscas, cargas)
export function cartBlock(p,id,gear,cart=[]){const it=ITEMS[id];if(!it)return 'Item desconhecido.';if(cart.length>=CART_MAX)return `A cesta leva ${CART_MAX} itens.`;
  if(cart.includes(id)&&(it.kind==='passive'||it.kind==='tool'||it.kind==='place'||it.kind==='boat'))return 'Esse já está na cesta.';
  if(it.kind==='boat')return gear[id]?'Já instalado no barco.':null;
  if(invHas(p,id)&&(it.kind==='passive'||it.kind==='tool'||it.kind==='place'))return 'Você já tem esse.';return null;}
export const cartTotal=ids=>ids.reduce((s,id)=>s+(ITEMS[id]?.price||0),0);

// ---------- grupos de espécies (índices de CATCHES) ----------
const idx=n=>CATCHES.findIndex(c=>c.name===n);
export const PREDATORS=['Robalo','Peixe-espada','Garoupa','Dourado','Atum-azul','Marlim-azul'].map(idx);
export const BOTTOM=['Corvina','Pargo-rosa','Linguado','Garoupa','Arraia'].map(idx);
export const SMALL=['Sardinha','Tainha'].map(idx);
export const CRUSTACEANS=CATCHES.map((c,i)=>c.kind==='crustacean'?i:-1).filter(i=>i>=0);

// ---------- pesca: modificadores do lançamento (anfitrião) ----------
// ctx: {inv:Set, bait, gear, depth, weeds, school, storm, lantern, onBoat, anchored, rattle, fed}
export function fishingMods(ctx){
  const inv=ctx.inv||new Set(),gear=ctx.gear||{},w=CATCHES.map(c=>c.rarity>0?1:0);let wait=1,reel=1,tension=1,heavy=1;
  const mul=(list,k)=>{for(const i of list)if(i>=0)w[i]*=k;},tier=(t,k)=>CATCHES.forEach((c,i)=>{if(c.tier===t)w[i]*=k;}),kind=(t,k)=>CATCHES.forEach((c,i)=>{if(c.kind===t)w[i]*=k;});
  if(inv.has('rod'))heavy*=.65;
  if(inv.has('reel')){reel*=1.3;tension*=.75;}
  if(inv.has('line')){tier('raro',1.6);tier('epico',1.8);tier('lendario',2);wait*=.85;}
  if(inv.has('depth')&&ctx.depth>=20)mul(BOTTOM,2);
  if(ctx.onBoat&&ctx.anchored)reel*=1.1;
  if(ctx.onBoat&&gear.lantern&&ctx.lantern){const k=ctx.storm>.4?2:1;mul(SMALL,1+.6*k);CATCHES.forEach((c,i)=>{if(c.tier==='incomum'&&c.kind==='fish')w[i]*=1+.3*k;});wait*=1-.15*k;}
  const b=ctx.bait;
  if(b==='lure'){mul(PREDATORS,3);kind('junk',.5);}
  if(b==='frog'){if(ctx.weeds){mul(PREDATORS,4);wait*=.7;}else mul(PREDATORS,1.3);}
  if(b==='shrimp')mul(BOTTOM,2.5);
  if(b==='spinner'){if(ctx.storm>.4){wait*=.5;tier('raro',1.5);}else wait*=.8;}
  if(b==='cut')wait*=.6;
  if(ctx.school){wait*=.45;kind('junk',.25);}
  if(ctx.rattle){tier('lendario',4);tier('epico',2);}
  if(ctx.fed)reel*=1.15;
  return {w,wait,reel,tension,heavy};
}
// sorteio com pesos (r em [0,1))
export function pickWeighted(r,w){const total=w.reduce((s,x)=>s+x*1,0);let x=r*total;for(let i=0;i<w.length;i++){x-=w[i];if(x<0&&w[i]>0)return i;}return 0;}

// ---------- mar ----------
// Profundidade: perto da ilha vem do relevo; longe cai até ~70 m (determinístico, igual em todas as máquinas)
export function depthAt(x,z,ground,island={x:0,z:118,size:230}){const g=ground?ground(x,z):-99;const r=Math.hypot(x-island.x,z-island.z),edge=island.size*.5;
  const far=clamp((r-edge*.8)/(edge*1.6));const open=6+far*64+Math.sin(x*.021+z*.013)*4+Math.sin(x*.057-z*.041)*2;
  return Math.max(0,g>-7.9?-g:open);}
// Cardumes: se movem devagar em círculos em volta da ilha (todas as máquinas calculam igual)
export function schoolsAt(t){const out=[];for(let i=0;i<6;i++){const a=i*1.047+t*.004*(i%2?1:-1)+Math.sin(t*.01+i)*.3,r=150+i*22+Math.sin(t*.013+i*2)*25;out.push({x:Math.sin(a)*r,z:118+Math.cos(a)*r,r:12+i%3*3,id:i});}return out;}
// Sons/efeitos de uso por item (nome do efeito em audio.js)
export const USE_SOUND={harpoon:'harpoon',net:'splash',gaff:'thud',knife:'knife',camera:'shutter',flare:'flare',beacon:'plop',chum:'plop',decoy:'plop',trap:'plop',flask:'gulp',medkit:'zip',stove:'sizzle',repair:'wrench',fuel:'glug',scope:'click',torch:'click',sextant:'click',tent:'tent',rattle:'rattle'};

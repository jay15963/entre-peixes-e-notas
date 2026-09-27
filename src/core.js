import {CATCHES} from './catalog.js';
export const CONFIG = Object.freeze({
  stormAt:60, asteroidAt:120, impactAt:137, embraceAt:145, kissAt:152, hitAt:164, titleAt:167.5,
  impactDistance:235, boatScale:2.15, deckY:-.07, eyeHeight:1.62, walkSpeed:2.6, runSpeed:6.4,
  respawnAfter:3.5, fixedStep:1/60, slapRange:1.7, protocol:5, maxPlayers:5, characters:5, balyTime:30, rampTime:8
});
export const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const lerp=(a,b,t)=>a+(b-a)*t;
export const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
// Tempo de história: o jogo agora é infinito. Antes do meteoro, o clima alterna calmaria (~3,5 min) e
// tempestade (~1,5 min). Quando o anfitrião aperta TAB, a história acelera até o meteoro em rampTime segundos
// e segue a linha do tempo original (impacto, onda, despedida, apagão).
// storm: evento de tempestade chamado pelo anfitrião ({at, dur}): entra em 20 s, dura, e acalma em 20 s. Sem evento, o mar fica calmo.
export const STORM_TIME=150;
export function storyTime(t,trig,storm=null){
  if(!trig){if(!storm)return 45;const k=t-storm.at,d=storm.dur??STORM_TIME;return 45+55*smooth(0,20,k)*(1-smooth(d-20,d,k));}
  const k=t-trig.at;if(k<CONFIG.rampTime)return lerp(trig.from,CONFIG.asteroidAt,smooth(0,CONFIG.rampTime,k));return CONFIG.asteroidAt+(k-CONFIG.rampTime);
}
export function phaseAt(t){return t<60?'sunset':t<120?'storm':t<137?'asteroid':t<145?'wave':t<164?'farewell':t<167.5?'blackout':'title'}
// fade é um corte seco: a tela apaga no quadro exato em que a onda alcança o barco.
export function weatherAt(t){return {storm:smooth(60,85,t)*(1-smooth(120,130,t)*.45),red:smooth(120,126,t),wave:smooth(137,164,t),fade:t>=CONFIG.hitAt?1:0,phase:phaseAt(t)};}

// Ondas direcionais: a mesma tabela alimenta a CPU (flutuação do barco) e o shader do oceano.
// [direção x, direção z, comprimento de onda, amplitude relativa, velocidade, nitidez da crista]
export const WAVES=[
  [.83,.55,34,1,1.0,1.6],[-.62,.78,21,.52,1.1,1.8],[.29,-.96,13,.3,1.25,2.0],
  [.97,-.24,8.5,.17,1.4,2.2],[-.86,-.51,5.3,.09,1.6,2.4],[.45,.89,3.4,.05,1.8,2.6]
];
const waveK=WAVES.map(w=>2*Math.PI/w[2]),waveW=WAVES.map((w,i)=>Math.sqrt(9.81*waveK[i])*w[4]*.55);
export function seaAmplitude(storm){return .16+storm*.95;}
export function waveHeight(x,z,t,storm=0){
  const a=seaAmplitude(storm);let h=0;
  for(let i=0;i<WAVES.length;i++){const w=WAVES[i],s=Math.sin((x*w[0]+z*w[1])*waveK[i]-t*waveW[i]);h+=a*w[3]*(2*Math.pow((s+1)/2,w[5])-.72);}
  return h;
}
export const waveGLSL=`
float seaHeight(vec2 p,float t,float storm){
  float a=${'.16'}+storm*.95;float h=0.;
${WAVES.map((w,i)=>`  h+=a*${w[3].toFixed(3)}*(2.*pow((sin(dot(p,vec2(${w[0].toFixed(3)},${w[1].toFixed(3)}))*${waveK[i].toFixed(5)}-t*${waveW[i].toFixed(5)})+1.)*.5,${w[5].toFixed(2)})-.72);`).join('\n')}
  return h;
}`;

// Tsunami: frente radial analítica sincronizada para tocar o barco exatamente em hitAt.
// A simulação de fluido (fluid.js) acrescenta os anéis caóticos sobre esta frente.
// Em hitAt a face da onda está exatamente na proa (≈4,6 m à frente do centro do barco): é nesse quadro que a tela apaga.
export const BOW_OFFSET=4.6;
export function tsunamiRadius(t,distance){const a=clamp((t-CONFIG.impactAt)/(CONFIG.hitAt-CONFIG.impactAt),0,1.2);return Math.max(distance-BOW_OFFSET,0)*(.08+.92*Math.pow(a,1.12))*(a>0?1:0);}
export function tsunamiAmplitude(t){const a=clamp((t-CONFIG.impactAt)/(CONFIG.hitAt-CONFIG.impactAt),0,1.2);return a<=0?0:lerp(9,46,Math.pow(a,1.6));}
export function tsunamiProfile(s,H){
  // s>0: à frente da parede (face íngreme e o mar recuando); s<0: corpo longo da onda
  if(s>0)return H*Math.exp(-Math.pow(s/6.5,1.7))-H*.16*Math.exp(-Math.pow((s-38)/26,2));
  return H*(Math.exp(-Math.pow(s/70,2))*.8+.2*Math.exp(s/120))*(1+.06*Math.exp(-Math.pow((s+6)/6,2)));
}
export function tsunamiHeight(x,z,t,impact){
  if(!impact||t<CONFIG.impactAt)return 0;
  const r=Math.hypot(x-impact.x,z-impact.z),R=tsunamiRadius(t,impact.d);
  return tsunamiProfile(r-R,tsunamiAmplitude(t))*clamp((R-r+260)/80,0,1);
}
export const tsunamiGLSL=`
float tsunamiProfile(float s,float H){
  if(s>0.)return H*exp(-pow(s/6.5,1.7))-H*.16*exp(-pow((s-38.)/26.,2.));
  return H*(exp(-pow(s/70.,2.))*.8+.2*exp(s/120.))*(1.+.06*exp(-pow((s+6.)/6.,2.)));
}`;
// Largura útil do convés: segue o casco (o mesmo perfil de boat.js e do shader do mar) na altura do piso,
// menos a largura do corpo, para os pés nunca atravessarem o costado.
function hullHalf(zq){const L=(a,b,t)=>a+(b-a)*t;if(zq< -1.65)return L(.48,.67,(zq+2)/.35);if(zq< -1.1)return L(.67,.79,(zq+1.65)/.55);if(zq< -.45)return L(.79,.84,(zq+1.1)/.65);if(zq<.35)return L(.84,.83,(zq+.45)/.8);if(zq<1.05)return L(.83,.71,(zq-.35)/.7);if(zq<1.6)return L(.71,.49,(zq-1.05)/.55);if(zq<2)return L(.49,.2,(zq-1.6)/.4);return L(.2,.025,(zq-2)/.21);}
export function deckHalfWidth(z){const zq=z/2.15,t=Math.max(0,((-.07+.68)/2.15-(.16+.11*Math.pow(Math.abs(zq)/2.21,3)))/.64);return hullHalf(zq)*(.57+.43*(t+.12))*2.15;}
export function insideBoat(x,z){return Math.abs(z)<3.6 && Math.abs(x)<deckHalfWidth(z)-.2;}
// Lobby: de 2 a 5 pescadores, cada um com um personagem diferente; começa quando todos marcam pronto.
export class Lobby {
  constructor(mode='online'){this.mode=mode;this.players=new Map();}
  join(id,character){if(!Number.isInteger(character)||character<0||character>=CONFIG.characters)throw Error('Personagem invalido');if(!this.players.has(id)&&this.players.size>=CONFIG.maxPlayers)throw Error('Barco cheio');for(const [key,p]of this.players)if(key!==id&&p.character===character)throw Error('Personagem ocupado');const prev=this.players.get(id);this.players.set(id,{id,character,ready:prev?.ready&&prev.character===character||false});}
  freeCharacter(prefer=0){const used=new Set([...this.players.values()].map(p=>p.character));if(!used.has(prefer))return prefer;for(let c=0;c<CONFIG.characters;c++)if(!used.has(c))return c;return -1;}
  ready(id,value){const p=this.players.get(id);if(p)p.ready=!!value;}
  leave(id){this.players.delete(id);}
  get canStart(){const n=this.players.size;return (this.mode==='solo'?n===1:n>=2)&&[...this.players.values()].every(p=>p.ready);}
  snapshot(){return [...this.players.values()].map(p=>({...p})).sort((a,b)=>a.id-b.id);}
}
// Pesca: cada lançamento sorteia a espécie e o peso. O peixe tem "corridas" (puxões para um lado),
// o ponteiro tem inércia, a faixa verde encolhe com a dificuldade e fisgar rápido dá vantagem.
export const FISH_TABLE=CATCHES.map(c=>({diff:c.diff,kg:c.kg,rarity:c.rarity}));
export function pickFish(r){const total=FISH_TABLE.reduce((s,f)=>s+f.rarity,0);let x=r*total;for(let i=0;i<FISH_TABLE.length;i++){x-=FISH_TABLE[i].rarity;if(x<0)return i;}return 0;}
function pickWeightedFish(r,w){const total=w.reduce((a,b)=>a+b,0);let x=r*total;for(let i=0;i<w.length;i++){x-=w[i];if(x<0&&w[i]>0)return i;}return 0;}
export class Fishing {
  constructor(random=Math.random){this.random=random;this.reset();this.caught=0;this.lastSpecies=-1;this.lastWeight=0;}
  // ajuda externa (passaguá, bicheiro, arpão): adianta a briga ou tira da água na hora
  assist(k){if(this.phase!=='reeling')return false;this.bonus=(this.bonus||0)+k;return true;}
  reset(){this.bonus=0;this.assistK=1;this.phase='idle';this.timer=0;this.progress=0;this.tension=.3;this.target=.5;this.needle=.5;this.vel=0;this.run=0;this.runDir=1;this.biteAge=0;this.perfect=false;this.species=-1;this.weight=0;this.combo=0;}
  get zone(){return this.species<0?.18:.2-FISH_TABLE[this.species].diff*.065;}
  // mods (loja): pesos por espécie, espera, velocidade de recolher e tensão (ver store.js fishingMods)
  cast(mods=null){if(this.phase!=='idle')return false;this.mods=mods;this.phase='waiting';this.timer=(2.5+this.random()*4)*(mods?.wait??1);this.species=mods?.w?pickWeightedFish(this.random(),mods.w):pickFish(this.random());const k=FISH_TABLE[this.species].kg;this.weight=Math.round((k[0]+(k[1]-k[0])*this.random())*100)/100;return true;}
  reel(){if(this.phase==='bite'){this.phase='reeling';this.perfect=this.biteAge<.45;this.progress=this.perfect?.12:0;this.timer=0;return true;}return false;}
  // combo: tempo contínuo na faixa verde acelera o progresso (até 1,6x); boost = efeito do Baly
  step(dt,held,time,boost=false){
    if(this.phase==='waiting'){this.timer-=dt;if(this.timer<=0){this.phase='bite';this.timer=2;this.biteAge=0;return 'bite';}if(this.timer<1.8&&this.random()>1-dt*1.3)return 'nibble';}
    else if(this.phase==='bite'){this.timer-=dt;this.biteAge+=dt;if(this.timer<=0){this.reset();return 'escaped';}}
    else if(this.phase==='reeling'){
      const d=FISH_TABLE[this.species]?.diff??.2;this.timer+=dt;let event=null;
      if(this.run<=0&&this.random()>1-dt*(.12+d*.4)){this.run=.7+d*1.3;this.runDir=this.random()<.5?-1:1;event='run';}
      if(this.run>0)this.run-=dt;
      const base=.5+Math.sin(time*(1.2+d*.9))*(.18+d*.08)+Math.sin(time*3.1+1)*.05*d;
      const goal=clamp(base+(this.run>0?this.runDir*(.22+d*.12):0),.08,.92);this.target+=(goal-this.target)*Math.min(1,dt*(this.run>0?4.5:2.6));
      if(boost)dt*=1.35;
      this.vel+=(held?1.9:-1.5)*dt;this.vel*=Math.exp(-dt*2.2);this.needle+=this.vel*dt;if(this.needle<0||this.needle>1){this.needle=clamp(this.needle);this.vel=0;}
      const accurate=Math.abs(this.needle-this.target)<this.zone;
      this.combo=accurate?this.combo+dt:Math.max(0,this.combo-dt*3);const mult=1+Math.min(this.combo/2.5,1)*.6;
      const M=this.mods||{},tk=(M.tension??1)*(this.weight>5?(M.heavy??1):1);
      this.progress=clamp(this.progress+(accurate?.22*(1-d*.35)*mult*(boost?1.4:1)*(M.reel??1)*(this.assistK||1):-.06)*dt+(this.bonus||0));this.bonus=0;
      this.tension=clamp(this.tension+(accurate?-.28:(.3+(this.run>0?.22:0))*tk)*dt);
      if(this.progress>=1){this.caught++;this.lastSpecies=this.species;this.lastWeight=this.weight;this.reset();return 'caught';}
      if(this.tension>=1||this.timer>30){this.lastSpecies=this.species;this.reset();return 'escaped';}
      if(!event&&this.random()>1-dt*(.18+d*.2))event='jump';
      return event;
    }
    return null;
  }
}
export const SPAWNS=[[-.45,-1.1],[.45,-1.1],[-.45,1.2],[.45,1.2],[0,.55]];
export function newPlayer(id,character){const s=SPAWNS[id%SPAWNS.length];return {id,character,x:s[0],z:s[1],land:0,baly:0,rifle:-1,ammo:5,reload:0,yaw:0,pitch:0,mode:'walk',fish:0,slap:0,ragTime:0,height:0,vy:0,speed:0,tp:0,cx:0,cz:0};}
// yaw é relativo ao barco; x/z/h são a posição prevista pelo próprio cliente (movimento com autoridade local).
export function inputPacket(input){const n=(v,a,b)=>clamp(Number(v)||0,a,b);return {type:'input',v:CONFIG.protocol,x:n(input.x,-1,1),z:n(input.z,-1,1),yaw:n(input.yaw,-1e4,1e4),pitch:n(input.pitch,-1.6,1.6),px:n(input.px,-4000,4000),pz:n(input.pz,-4000,4000),ph:n(input.ph,-20,60),land:input.land?1:0,speed:n(input.speed,0,8),tp:Math.floor(n(input.tp,0,1e6)),run:!!input.run,interact:!!input.interact,cast:!!input.cast,slap:!!input.slap,jump:!!input.jump,reel:!!input.reel,fall:!!input.fall,fire:!!input.fire,aim:!!input.aim,gull:Math.floor(n(input.gull,-1,31)),ray:Array.isArray(input.ray)?input.ray.slice(0,6).map(v=>n(v,-1e4,1e4)):null,throwAt:Math.floor(n(input.throwAt??-1,-1,200)),target:Math.floor(n(input.target??-1,-1,200)),boss:Math.floor(n(input.boss??-1,-1,4)),bossPt:Array.isArray(input.bossPt)?input.bossPt.slice(0,3).map(v=>n(v,-1e4,1e4)):null,throwOk:!!input.throwOk,shoo:Math.floor(n(input.shoo,0,2)),strum:Array.isArray(input.strum)?input.strum.slice(0,8).map(v=>Math.floor(n(v,0,127))):null,sel:Math.floor(n(input.sel??-1,-1,20)),use:!!input.use,scan:!!input.scan,pay:!!input.pay,aimPt:Array.isArray(input.aimPt)?input.aimPt.slice(0,3).map(v=>n(v,-1e4,1e4)):null,dive:!!input.dive,climb:!!input.climb,photo:Math.floor(n(input.photo??0,0,15))};}
export function validPacket(p){return p&&p.v===CONFIG.protocol&&['hello','welcome','pick','ready','start','input','snapshot','lobby','event','bye','song','relay','full'].includes(p.type);}

// ---------- Corda: laço girando sobre a cabeça ----------
// O laço gira a uma velocidade fixa; acerta quem soltar com o laço na frente (ângulo 0). A janela encolhe com a distância.
export const ROPE={max:24,min:2,length:7.5,flight:.85,omega:5.6};
export function ropeWindow(dist){const k=clamp((dist-ROPE.min)/(ROPE.max-ROPE.min));return lerp(1.5,.2,Math.pow(k,.75));}
export function ropeAngle(t){const a=(t*ROPE.omega)%(Math.PI*2);return a>Math.PI?a-Math.PI*2:a;}
export function ropeHit(t,dist){return dist<=ROPE.max&&Math.abs(ropeAngle(t))<ropeWindow(dist)/2;}
// ---------- Deriva do barco solto: corrente e vento mudam devagar; na tempestade ele vai longe ----------
export function driftAt(t,storm){const a=t*.013+Math.sin(t*.051)*1.3,s=.1+storm*1.4+.04*Math.sin(t*.3);return {x:Math.sin(a)*s,z:Math.cos(a)*s,yaw:(Math.sin(t*.07)*.02+Math.sin(t*.23)*.012)*(1+storm*3)};}
// ---------- Espantar a gaivota que agarrou o balde na sua mão (difícil de propósito: o rifle é a arma certa) ----------
export class Shoo {
  constructor(random=Math.random){this.random=random;this.reset();}
  reset(){this.active=false;this.progress=0;this.grip=0;this.needle=.5;this.vel=0;this.target=.5;this.t=0;this.seed=0;}
  start(){this.reset();this.active=true;this.seed=this.random()*100;}
  get zone(){return .1;}
  step(dt,held){
    if(!this.active)return null;this.t+=dt;const t=this.t,s=this.seed;
    // calibrado: um robô com reflexo perfeito sempre ganha; com o reflexo de uma pessoa (~0,2 s) ganha metade das vezes
    const goal=clamp(.5+.28*Math.sin(t*1.3+s)+.07*Math.sin(t*3.3+s*2)+.015*Math.sin(t*11.3+s),.06,.94);this.target+=(goal-this.target)*Math.min(1,dt*6);
    this.vel+=(held?2.5:-2.1)*dt;this.vel*=Math.exp(-dt*1.5);this.needle+=this.vel*dt;if(this.needle<0||this.needle>1){this.needle=clamp(this.needle);this.vel=0;}
    const inZone=Math.abs(this.needle-this.target)<this.zone;
    this.progress=clamp(this.progress+(inZone?.45:-.1)*dt);this.grip=clamp(this.grip+dt/6.5);
    if(this.progress>=1){this.active=false;return 'win';}
    if(this.grip>=1){this.active=false;return 'lose';}
    return null;
  }
}
export const DROWN_TIME=20;

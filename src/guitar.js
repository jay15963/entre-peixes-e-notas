// Violão do barco: minigame de ritmo (quatro trilhas, D F J K) em que quem toca faz a música da partida.
// Cada acerto toca a nota da melodia (e o acorde no começo do compasso) para quem estiver perto.
// Só entram músicas em domínio público (tradicionais, cantigas de marinheiro, clássicos) e composições originais do jogo.
const N={C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11};
const midi=s=>{const m=/^([A-G][#b]?)(\d)$/.exec(s);return 12*(Number(m[2])+1)+N[m[1]];};
// melodia: "nota:duração" em tempos; "-" é pausa. acordes: um por compasso (tríade fechada numa região grave)
function parse(src){const out=[];let t=0;for(const tok of src.trim().split(/\s+/)){if(tok==='|')continue;const [n,d]=tok.split(':');const len=Number(d||1);if(n!=='-')out.push([t,midi(n),len]);t+=len;}return {notes:out,beats:t};}
const CH={C:['C3','E3','G3'],G:['G2','D3','G3'],G7:['G2','B2','F3'],F:['F2','C3','F3'],Am:['A2','E3','A3'],Dm:['D3','F3','A3'],E:['E2','B2','E3'],E7:['E2','B2','D3'],D:['D3','F#3','A3'],D7:['D3','F#3','C4'],Em:['E2','B2','E3'],A:['A2','E3','A3'],C7:['C3','E3','Bb3'],Bm:['B2','D3','F#3'],'F#':['F#2','C#3','F#3']};
// Dificuldade: janela de acerto (s), tempo que a nota leva para cair (s), chance de nota dupla e ajuste do andamento
export const TIERS={
  facil:{label:'FÁCIL',color:'#58d27a',window:.24,travel:2.3,pairs:0,tempo:1},
  medio:{label:'MÉDIO',color:'#ffd23c',window:.21,travel:1.9,pairs:0,tempo:1},
  dificil:{label:'DIFÍCIL',color:'#ff8a3c',window:.18,travel:1.55,pairs:.4,tempo:1},
  extremo:{label:'EXTREMO',color:'#ff4a6a',window:.15,travel:1.25,pairs:.65,tempo:1.06},
};
function song(name,credit,theme,tier,bpm,bar,melody,chords,opts={}){const {notes,beats}=parse(melody);const ch=chords.trim().split(/\s+/).filter(c=>c!=='|');return {name,credit,theme,tier,bpm,bar,notes,beats,chords:ch.map(c=>CH[c].map(midi)),...opts};}
export const SONGS=[
  // ---------- fácil ----------
  song('Brilha, Brilha, Estrelinha','tradicional','cantiga','facil',96,4,
    'C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2 G4 G4 F4 F4 E4 E4 D4:2 G4 G4 F4 F4 E4 E4 D4:2 C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2',
    'C F C G C G C G C G C G C F C G'),
  song('Rema, Rema, Remador','tradicional (Row, Row, Row Your Boat)','barco','facil',100,3,
    'C4:1.5 C4:1.5 C4 D4:.5 E4:1.5 E4 D4:.5 E4 F4:.5 G4:3 C5:.5 C5:.5 C5:.5 G4:.5 G4:.5 G4:.5 E4:.5 E4:.5 E4:.5 C4:.5 C4:.5 C4:.5 G4 F4:.5 E4 D4:.5 C4:3',
    'C C C C C C G C'),
  song('Frère Jacques','tradicional francesa','cantiga','facil',112,4,
    'C4 D4 E4 C4 C4 D4 E4 C4 E4 F4 G4:2 E4 F4 G4:2 G4:.5 A4:.5 G4:.5 F4:.5 E4 C4 G4:.5 A4:.5 G4:.5 F4:.5 E4 C4 C4 G3 C4:2 C4 G3 C4:2',
    'C C C C C C C C C C C C'),
  song('Canção do Pescador','original · Entre peixes e Notas','pesca','facil',108,3,
    'E4 G4 C5:2 B4 A4 G4:2 E4 F4 A4 D5:2 C5 B4 C5:3 E4 G4 C5:2 D5 E5 D5:2 C5 A4 B4 G4 C5:3',
    'C G F C C G F C'),
  // ---------- médio ----------
  song('Ode à Alegria','L. van Beethoven (1824)','clássico','medio',120,4,
    'E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4:1.5 D4:.5 D4:2 E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4:1.5 C4:.5 C4:2 D4 D4 E4 C4 D4 E4:.5 F4:.5 E4 C4 D4 E4:.5 F4:.5 E4 D4 C4 D4 G3:2 E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4:1.5 C4:.5 C4:2',
    'C G C G C G C G G C G C G C G C C G C G'),
  song('Meu Bem Está Além do Mar','tradicional escocesa (My Bonnie)','mar','medio',126,3,
    'G4 E5:1.5 D5:.5 C5 D5 C5 A4 G4 E4:2 G4 E5:1.5 D5:.5 C5 C5 B4 C5 D5:3 - - G4 E5:1.5 D5:.5 C5 D5 C5 A4 G4 E4:2 G4 A4 D5 C5 B4 A4 B4 C5:3',
    'C C F C C D G G C C F C Am D G C'),
  song('O Marinheiro Bêbado','cantiga de marinheiro (Drunken Sailor)','pirata','medio',128,4,
    'A4:.5 A4:.25 A4:.25 A4:.5 A4:.25 A4:.25 A4:.5 D4:.5 F4:.5 A4:.5 G4:.5 G4:.25 G4:.25 G4:.5 G4:.25 G4:.25 G4:.5 C4:.5 E4:.5 G4:.5 A4:.5 A4:.25 A4:.25 A4:.5 A4:.25 A4:.25 A4:.5 B4:.5 C5:.5 D5:.5 C5:.5 A4:.5 G4:.5 E4:.5 D4 D4 A4 A4:.5 A4:.5 A4:.5 D4:.5 F4:.5 A4:.5 G4 G4:.5 G4:.5 G4:.5 C4:.5 E4:.5 G4:.5 A4 A4:.5 A4:.5 A4:.5 B4:.5 C5:.5 D5:.5 C5:.5 A4:.5 G4:.5 E4:.5 D4 D4',
    'Dm C Dm Dm Dm C Dm Dm'),
  // ---------- difícil ----------
  song('Scarborough Fair','tradicional inglesa','balada','dificil',132,3,
    'D4:2 D4 A4:2 A4 E4:1.5 F4:.5 E4 D4:3 - A4 C5:2 B4 G4 A4:2 - A4:3 - - D5:2 D5 D5:2 C5 A4 A4 G4 F4 E4 C4 D4:2 A4 G4:2 F4 E4 D4 C4 D4:3 - - -',
    'Dm Dm C Dm Dm F C Dm Dm F Dm C F C Dm Dm'),
  song('Greensleeves','tradicional inglesa (séc. XVI)','balada','dificil',150,3,
    'A4 C5:2 D5 E5:1.5 F5:.5 E5 D5:2 B4 G4:1.5 A4:.5 B4 C5:2 A4 A4:1.5 G#4:.5 A4 B4:2 G#4 E4:2 A4 C5:2 D5 E5:1.5 F5:.5 E5 D5:2 B4 G4:1.5 A4:.5 B4 C5:1.5 B4:.5 A4 G#4:1.5 F#4:.5 G#4 A4:3 A4:2',
    'Am Am C G Em Am Am E7 E Am C G Em Am E7 Am Am'),
  song('Saque em Laguna','original · shanty de pirata','pirata','dificil',140,4,
    'A4:.5 E4:.5 A4:.5 C5:.5 B4:.5 A4:.5 G#4:.5 E4:.5 B4:.5 D5:.5 C5:.5 B4:.5 A4:.5 C5:.5 E5:.5 A5 G5:.5 F5:.5 E5:.5 D5:.5 C5:.5 B4:.5 A4 E4:.5 A4:.5 C5:.5 E5:.5 D5:.5 C5:.5 B4:.5 G#4:.5 A4:2',
    'Am E Am Am E Am E Am'),
  // ---------- extremo ----------
  song('Laguna ao Entardecer','original · Entre peixes e Notas','pesca','extremo',142,4,
    'G4:.5 B4:.5 D5:.5 B4:.5 G4:.5 B4:.5 D5 E5:.5 D5:.5 B4:.5 G4:.5 A4 B4 C5:.5 E5:.5 G5:.5 E5:.5 C5:.5 E5:.5 G5 F#5:.5 E5:.5 D5:.5 C5:.5 B4 A4 G4:.5 B4:.5 D5:.5 G5:.5 F#5:.5 D5:.5 A4:.5 F#4:.5 G4:.5 A4:.5 B4:.5 D5:.5 E5 D5 E5:.5 G5:.5 E5:.5 D5:.5 B4:.5 A4:.5 G4 A4:.5 B4:.5 C5:.5 D5:.5 E5:.5 F#5:.5 G5:2 D5:.5 G5:.5 D5:.5 B4:.5 G4:2',
    'G G C D G D Em C Am D G G'),
  // Grieg (1875): o tema dos trolls do salão do rei da montanha, acelerando até o fim
  song('No Salão do Rei da Montanha','E. Grieg (1875) · saga nórdica','viking','extremo',120,4,
    'B3:.5 C#4:.5 D4:.5 E4:.5 F#4:.5 D4:.5 F#4 F4:.5 C#4:.5 F4 E4:.5 C4:.5 E4 B3:.5 C#4:.5 D4:.5 E4:.5 F#4:.5 D4:.5 F#4:.5 B4:.5 A4:.5 F#4:.5 D4:.5 F#4:.5 A4:2 B3:.5 C#4:.5 D4:.5 E4:.5 F#4:.5 D4:.5 F#4 F4:.5 C#4:.5 F4 E4:.5 C4:.5 E4 B3:.5 C#4:.5 D4:.5 E4:.5 F#4:.5 D4:.5 F#4:.5 B4:.5 A4:.5 F#4:.5 D4:.5 F#4:.5 A4:2 F#4:.5 G#4:.5 A#4:.5 B4:.5 C#5:.5 A#4:.5 C#5 D5:.5 A#4:.5 D5 C#5:.5 A#4:.5 C#5 F#4:.5 G#4:.5 A#4:.5 B4:.5 C#5:.5 A#4:.5 C#5:.5 F#5:.5 E5:.5 C#5:.5 A#4:.5 C#5:.5 E5:2',
    'Bm F# Bm F# Bm F# Bm F# F# F# F# F#',{accel:.45}),
  // Wagner (1856): a cavalgada das valquírias da mitologia nórdica
  song('Cavalgada das Valquírias','R. Wagner (1856) · mitologia nórdica','viking','extremo',112,3,
    'F#4:.5 B4:.25 D5:1 B4:.5 D5:.25 F#5:1 D5:.5 F#5:.25 A5:1.5 A4:1.5 D5:.5 F#5:.25 A5:1 F#5:.5 A5:.25 C#6:1 A5:.5 C#6:.25 E6:1.5 E5:1.5 F#4:.5 B4:.25 D5:1 B4:.5 D5:.25 F#5:1 D5:.5 F#5:.25 A5:1.5 A4:1.5 C#5:.5 F#5:.25 A5:1 F#5:.5 A5:.25 C#6:1 A5:.5 C#6:.25 F#6:3',
    'Bm Bm D D A A F# F# Bm Bm D D A A F# F#'),
];
export const LANE_KEYS=['KeyD','KeyF','KeyJ','KeyK'],LANE_LABELS=['D','F','J','K'],LANE_COLORS=['#58d27a','#ff5a5a','#ffd23c','#4fb6ff'];
const MILESTONES=[10,25,50,100,150,200];
const rgba=(hex,a)=>{const n=parseInt(hex.slice(1),16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`;};
export class GuitarHero {
  constructor(){this.active=false;this.state='menu';this.sel=0;this.best={};this.flash=[0,0,0,0];this.feedback=null;this.fx=[];this.big=null;this.shake=0;this.missFlash=0;this.song=null;}
  start(){this.active=true;this.state='menu';this.fx=[];}
  stop(){this.active=false;this.state='menu';}
  get tier(){return TIERS[this.song?.tier||'facil'];}
  play(i){const s=SONGS[(i+SONGS.length)%SONGS.length],T=TIERS[s.tier];this.sel=SONGS.indexOf(s);this.song=s;this.state='play';this.tempo=s.bpm*T.tempo;const spb=60/this.tempo;
    const lo=Math.min(...s.notes.map(n=>n[1])),hi=Math.max(...s.notes.map(n=>n[1])),span=Math.max(1,hi-lo+1);
    this.lead=3;this.t=-this.lead;this.window=T.window;this.travel=T.travel;
    // músicas curtas tocam duas vezes seguidas; "accel" acelera o andamento ao longo da música (Grieg)
    const reps=s.beats*spb<28?2:1,src=[];for(let r=0;r<reps;r++)for(const [b,m,len]of s.notes)src.push([b+r*s.beats,m,len]);const B=s.beats*reps,k=s.accel||0,time=b=>spb*(b-k*b*b/(2*B));
    this.notes=src.map(([b,m,len])=>{const lane=Math.min(3,Math.floor((m-lo)/span*4));const bar=Math.floor(b/s.bar);return {time:time(b),midi:m,lane,len:len*spb,chord:(Math.abs(b%s.bar)<1e-6)?s.chords[bar%s.chords.length]:null,hit:false,missed:false};});
    let seed=this.sel*7+3;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
    if(T.pairs)for(const n of this.notes)if(n.chord&&rnd()<T.pairs)n.pair=(n.lane+2)%4;
    this.end=this.notes[this.notes.length-1].time+2.5;this.score=0;this.combo=0;this.maxCombo=0;this.hits=0;this.total=this.notes.reduce((q,n)=>q+(n.pair!==undefined?2:1),0);this.card=3;this.fx=[];this.big=null;}
  get mult(){return 1+Math.min(3,Math.floor(this.combo/8));}
  // nav: {up,down,ok,back} no menu; lanes: trilhas apertadas neste quadro. Devolve as notas a tocar e eventos.
  update(dt,lanes=[],nav={}){const out={play:[],miss:0,ghost:0,click:0};if(!this.active)return out;
    this.flash=this.flash.map(f=>Math.max(0,f-dt*4));this.shake=Math.max(0,this.shake-dt*3);this.missFlash=Math.max(0,this.missFlash-dt*3);if(this.feedback)this.feedback.t-=dt;if(this.big)this.big.t-=dt;
    for(const f of this.fx)f.t+=dt;this.fx=this.fx.filter(f=>f.t<f.life);
    if(this.state!=='play'){
      if(nav.up){this.sel=(this.sel+SONGS.length-1)%SONGS.length;out.click++;}if(nav.down){this.sel=(this.sel+1)%SONGS.length;out.click++;}
      if(nav.ok){if(this.state==='result')this.state='menu';else this.play(this.sel);out.click++;}
      for(const l of lanes)this.flash[l]=1;return out;}
    if(nav.back){this.state='menu';out.click++;return out;}
    this.t+=dt;this.card=Math.max(0,this.card-dt);
    for(const lane of lanes){this.flash[lane]=1;let best=null,bd=1e9;for(const n of this.notes){if(n.missed)continue;const ls=n.pair!==undefined?[n.lane,n.pair]:[n.lane];if(!ls.includes(lane))continue;if(n.hit&&(n.pair===undefined||n.hitPair))continue;const d=Math.abs(n.time-this.t);if(d<this.window&&d<bd){bd=d;best=n;}}
      if(best){const isPair=best.pair===lane&&best.hit;if(isPair)best.hitPair=true;else best.hit=true;this.hits++;this.combo++;const was=this.maxCombo;this.maxCombo=Math.max(this.maxCombo,this.combo);const perfect=bd<this.window*.45;this.score+=(perfect?100:60)*this.mult;
        this.feedback={text:perfect?'PERFEITO!':'BOM',t:.6,good:true,perfect};this.fx.push({kind:'burst',lane,t:0,life:.45,perfect});
        if(MILESTONES.includes(this.combo)){this.big={text:`COMBO ${this.combo}!`,t:1.4,life:1.4};out.milestone=this.combo;}else if(this.combo%8===0&&this.combo<=24){this.big={text:`MULTIPLICADOR x${this.mult}`,t:1.1,life:1.1};out.milestone=this.combo;}
        if(!isPair)out.play.push(best.midi,...(best.chord||[]));}
      else{if(this.combo>=10)this.fx.push({kind:'break',t:0,life:.6});this.combo=0;out.ghost++;this.feedback={text:'NOTA FORA',t:.5,good:false};this.shake=.5;}}
    for(const n of this.notes)if(!n.hit&&!n.missed&&this.t-n.time>this.window){n.missed=true;if(this.combo>=10)this.fx.push({kind:'break',t:0,life:.6});this.combo=0;out.miss++;this.feedback={text:'ERROU',t:.5,good:false};this.missFlash=1;this.shake=.4;}
    if(this.t>this.end){const acc=this.hits/this.total,stars=acc>=.97?5:acc>=.9?4:acc>=.78?3:acc>=.6?2:1;out.finished={name:this.song.name,acc,best:this.maxCombo,score:this.score,stars};
      const key=this.song.name;if(!this.best[key]||this.best[key].score<this.score)this.best[key]={score:this.score,stars};this.result=out.finished;this.state='result';}
    return out;}
  draw(ctx,w,h){ctx.clearRect(0,0,w,h);if(!this.active)return;if(this.state==='play')this.drawPlay(ctx,w,h);else this.drawMenu(ctx,w,h);}
  drawMenu(ctx,w,h){
    ctx.save();ctx.fillStyle='rgba(8,24,30,.9)';this.round(ctx,6,6,w-12,h-12,16);ctx.fill();ctx.strokeStyle='rgba(229,192,140,.35)';ctx.lineWidth=1.5;ctx.stroke();
    ctx.textAlign='left';ctx.textBaseline='alphabetic';
    if(this.state==='result'&&this.result){const r=this.result;ctx.textAlign='center';ctx.fillStyle='#ffdda9';ctx.font=`italic 700 ${w*.055|0}px Georgia`;ctx.fillText(r.name,w/2,h*.2);
      ctx.font=`${w*.08|0}px Arial`;ctx.fillStyle='#ffd23c';ctx.fillText('★'.repeat(r.stars)+'☆'.repeat(5-r.stars),w/2,h*.4);
      ctx.fillStyle='#f6ead6';ctx.font=`700 ${w*.05|0}px Georgia`;ctx.fillText(r.score.toLocaleString('pt-BR')+' pontos',w/2,h*.56);ctx.font=`600 ${w*.032|0}px Arial`;ctx.fillStyle='#b8c7bf';ctx.fillText(`${Math.round(r.acc*100)}% de acerto · maior combo ${r.best}`,w/2,h*.66);
      ctx.fillStyle='#e5c08c';ctx.fillText('ENTER · voltar à lista de músicas     E · largar o violão',w/2,h*.86);ctx.restore();return;}
    ctx.fillStyle='#e5c08c';ctx.font=`700 ${w*.024|0}px Arial`;ctx.fillText('ESCOLHA A MÚSICA',w*.05,h*.085);ctx.textAlign='right';ctx.fillStyle='#8fa9a3';ctx.fillText('W/S escolher · ENTER tocar · E largar',w*.95,h*.085);ctx.textAlign='left';
    const rows=7,rh=(h*.82)/rows,start=Math.max(0,Math.min(SONGS.length-rows,this.sel-3));
    for(let k=0;k<rows&&start+k<SONGS.length;k++){const i=start+k,s=SONGS[i],T=TIERS[s.tier],y=h*.12+k*rh,on=i===this.sel;
      if(on){const g=ctx.createLinearGradient(0,0,w,0);g.addColorStop(0,rgba(T.color,.28));g.addColorStop(1,rgba(T.color,.04));ctx.fillStyle=g;this.round(ctx,w*.03,y+2,w*.94,rh-4,10);ctx.fill();ctx.strokeStyle=T.color;ctx.lineWidth=2;ctx.stroke();}
      ctx.fillStyle=on?'#fff':'#e6ddc8';ctx.font=`${on?'italic 700':'600'} ${w*.034|0}px Georgia`;ctx.fillText(s.name,w*.06,y+rh*.47);
      ctx.fillStyle='#8fa9a3';ctx.font=`${w*.022|0}px Arial`;ctx.fillText(`${s.credit} · ${s.theme}`,w*.06,y+rh*.8);
      ctx.fillStyle=rgba(T.color,.18);this.round(ctx,w*.73,y+rh*.24,w*.2,rh*.46,rh*.23);ctx.fill();ctx.fillStyle=T.color;ctx.font=`900 ${w*.024|0}px Arial`;ctx.textAlign='center';ctx.fillText(T.label,w*.83,y+rh*.56);ctx.textAlign='left';
      const b=this.best[s.name];if(b){ctx.fillStyle='#ffd23c';ctx.font=`${w*.022|0}px Arial`;ctx.textAlign='right';ctx.fillText('★'.repeat(b.stars),w*.71,y+rh*.56);ctx.textAlign='left';}}
    ctx.restore();}
  drawPlay(ctx,w,h){
    const T=this.tier,sx=this.shake>0?(Math.random()-.5)*10*this.shake:0;ctx.save();ctx.translate(sx,0);
    const top=h*.08,line=h*.78,cx=w/2,wTop=w*.2,wBot=w*.82,mult=this.mult,hot=mult>=4;
    const X=(lane,y)=>{const k=(y-top)/(line-top),ww=wTop+(wBot-wTop)*k;return cx-ww/2+ww*(lane+.5)/4;},W=y=>wTop+(wBot-wTop)*((y-top)/(line-top));
    // estrada: fundo, faixas coloridas por trilha, bordas que brilham com o multiplicador
    let g=ctx.createLinearGradient(0,top,0,h);g.addColorStop(0,'rgba(8,24,30,0)');g.addColorStop(.25,'rgba(8,24,30,.78)');g.addColorStop(1,'rgba(6,18,24,.95)');ctx.fillStyle=g;
    ctx.beginPath();ctx.moveTo(cx-wTop/2,top);ctx.lineTo(cx+wTop/2,top);ctx.lineTo(cx+wBot/2*1.12,h);ctx.lineTo(cx-wBot/2*1.12,h);ctx.fill();
    for(let l=0;l<4;l++){ctx.beginPath();ctx.moveTo(cx-wTop/2+wTop*l/4,top);ctx.lineTo(cx-wTop/2+wTop*(l+1)/4,top);ctx.lineTo(cx-wBot/2+wBot*(l+1)/4,line);ctx.lineTo(cx-wBot/2+wBot*l/4,line);ctx.closePath();ctx.fillStyle=rgba(LANE_COLORS[l],.05+this.flash[l]*.18);ctx.fill();}
    if(this.missFlash>0){ctx.fillStyle=`rgba(255,40,60,${this.missFlash*.18})`;ctx.fillRect(0,0,w,h);}
    const rail=hot?'#ff6ae0':mult>=3?'#ffd23c':mult>=2?'#4fb6ff':'rgba(255,236,200,.35)';ctx.strokeStyle=rail;ctx.lineWidth=hot?4:2.5;ctx.shadowColor=rail;ctx.shadowBlur=hot?18:mult>1?10:0;
    for(const s of [-1,1]){ctx.beginPath();ctx.moveTo(cx+s*wTop/2,top);ctx.lineTo(cx+s*wBot/2,line);ctx.stroke();}ctx.shadowBlur=0;
    // trastes passando (sensação de velocidade)
    ctx.strokeStyle='rgba(255,236,200,.1)';ctx.lineWidth=1;const spb=60/this.tempo;for(let b=Math.floor(this.t/spb);b<(this.t+this.travel)/spb+1;b++){const dtm=b*spb-this.t;if(dtm<0)continue;const k=1-dtm/this.travel,y=top+(line-top)*k*k,ww=W(y);ctx.beginPath();ctx.moveTo(cx-ww/2,y);ctx.lineTo(cx+ww/2,y);ctx.stroke();}
    for(let l=1;l<4;l++){ctx.strokeStyle='rgba(255,236,200,.14)';ctx.beginPath();ctx.moveTo(cx-wTop/2+wTop*l/4,top);ctx.lineTo(cx-wBot/2+wBot*l/4,line);ctx.stroke();}
    // linha de acerto e alvos
    ctx.strokeStyle='rgba(255,255,255,.5)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(cx-wBot/2,line);ctx.lineTo(cx+wBot/2,line);ctx.stroke();
    const R=w*.048;for(let l=0;l<4;l++){const x=X(l,line),f=this.flash[l];ctx.beginPath();ctx.arc(x,line,R,0,Math.PI*2);ctx.fillStyle=rgba(LANE_COLORS[l],.12+f*.55);ctx.fill();ctx.lineWidth=4;ctx.strokeStyle=LANE_COLORS[l];ctx.shadowColor=LANE_COLORS[l];ctx.shadowBlur=8+f*20;ctx.stroke();ctx.shadowBlur=0;
      ctx.beginPath();ctx.arc(x,line,R*.55,0,Math.PI*2);ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineWidth=2;ctx.stroke();
      ctx.fillStyle='#f6ead6';ctx.font=`900 ${w*.032|0}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(LANE_LABELS[l],x,line+R*1.75);}
    // notas caindo (a perspectiva acelera perto da linha), com brilho
    for(const n of this.notes){if(n.hit&&(n.pair===undefined||n.hitPair))continue;const dtm=n.time-this.t;if(dtm>this.travel||dtm<-.3)continue;const k=1-dtm/this.travel,kk=Math.max(0,k),y=top+(line-top)*kk*kk+(k>1?(k-1)*(h-line)*3:0),s=w*(.012+.036*Math.min(1.1,kk));
      for(const lane of n.pair!==undefined?[n.lane,n.pair]:[n.lane]){if(lane===n.pair&&n.hitPair)continue;if(lane===n.lane&&n.hit)continue;const x=X(lane,y),c=n.missed?'#555a5e':LANE_COLORS[lane];
        ctx.shadowColor=c;ctx.shadowBlur=n.missed?0:12;ctx.beginPath();ctx.ellipse(x,y,s,s*.62,0,0,Math.PI*2);ctx.fillStyle=c;ctx.fill();ctx.shadowBlur=0;ctx.lineWidth=2.5;ctx.strokeStyle='rgba(255,255,255,.9)';ctx.stroke();
        ctx.beginPath();ctx.ellipse(x,y-s*.16,s*.5,s*.2,0,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,.6)';ctx.fill();}
      if(n.pair!==undefined&&!n.missed){ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(X(n.lane,y),y);ctx.lineTo(X(n.pair,y),y);ctx.stroke();}}
    // explosões de acerto: anel que abre e faíscas
    for(const f of this.fx){const a=f.t/f.life;if(f.kind==='burst'){const x=X(f.lane,line),c=LANE_COLORS[f.lane];ctx.globalAlpha=1-a;ctx.strokeStyle=f.perfect?'#fff':c;ctx.lineWidth=5*(1-a)+1;ctx.beginPath();ctx.arc(x,line,R*(1+a*1.6),0,Math.PI*2);ctx.stroke();
        for(let i=0;i<8;i++){const an=i/8*Math.PI*2+f.lane,d=R*(.6+a*2.2);ctx.fillStyle=i%2?c:'#fff';ctx.fillRect(x+Math.cos(an)*d-2,line+Math.sin(an)*d*.6-2,4,4);}ctx.globalAlpha=1;}
      else if(f.kind==='break'){ctx.globalAlpha=1-a;ctx.fillStyle='#ff5a6a';ctx.font=`900 ${w*.045|0}px Arial`;ctx.textAlign='center';ctx.fillText('COMBO PERDIDO',cx,line-h*.28-a*20);ctx.globalAlpha=1;}}
    // painel: pontos, combo com anel do multiplicador, andamento e progresso da música
    ctx.textBaseline='alphabetic';ctx.textAlign='left';ctx.fillStyle='#f6ead6';ctx.font=`700 ${w*.045|0}px Georgia`;ctx.fillText(this.score.toLocaleString('pt-BR'),w*.03,h*.12);
    const mx=w*.1,my=h*.3,mr=w*.06,prog=mult>=4?1:(this.combo%8)/8;ctx.lineWidth=6;ctx.strokeStyle='rgba(255,255,255,.12)';ctx.beginPath();ctx.arc(mx,my,mr,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle=rail;ctx.shadowColor=rail;ctx.shadowBlur=hot?16:6;ctx.beginPath();ctx.arc(mx,my,mr,-Math.PI/2,-Math.PI/2+prog*Math.PI*2);ctx.stroke();ctx.shadowBlur=0;
    ctx.textAlign='center';ctx.fillStyle=mult>1?rail:'#f6ead6';ctx.font=`900 ${w*.05|0}px Arial`;ctx.fillText('x'+mult,mx,my+w*.017);ctx.fillStyle='#f6ead6';ctx.font=`900 ${w*.036|0}px Arial`;ctx.fillText(String(this.combo),mx,my+mr+w*.05);ctx.fillStyle='#8fa9a3';ctx.font=`700 ${w*.02|0}px Arial`;ctx.fillText('COMBO',mx,my+mr+w*.075);
    ctx.textAlign='right';ctx.fillStyle=T.color;ctx.font=`900 ${w*.024|0}px Arial`;ctx.fillText(T.label,w*.97,h*.07);ctx.fillStyle='#f6ead6';ctx.font=`600 ${w*.024|0}px Arial`;ctx.fillText(`${Math.round(this.tempo)} BPM · Q volta à lista`,w*.97,h*.12);
    const p=Math.max(0,Math.min(1,this.t/this.end));ctx.fillStyle='rgba(255,255,255,.12)';ctx.fillRect(w*.72,h*.145,w*.25,4);ctx.fillStyle=T.color;ctx.fillRect(w*.72,h*.145,w*.25*p,4);
    if(this.card>0||this.t<0){ctx.textAlign='center';ctx.globalAlpha=Math.min(1,Math.max(this.card,-this.t));ctx.font=`italic 700 ${w*.058|0}px Georgia`;ctx.fillStyle='#ffdda9';ctx.fillText(this.song.name,cx,h*.36);ctx.font=`${w*.028|0}px Arial`;ctx.fillStyle='#b8c7bf';ctx.fillText(this.song.credit,cx,h*.43);
      if(this.t<0){ctx.font=`900 ${w*.08|0}px Arial`;ctx.fillStyle='#fff';ctx.fillText(String(Math.ceil(-this.t)),cx,h*.58);}ctx.globalAlpha=1;}
    if(this.feedback&&this.feedback.t>0){ctx.textAlign='center';ctx.globalAlpha=Math.min(1,this.feedback.t*3);ctx.font=`900 ${w*(this.feedback.perfect?.056:.048)|0}px Arial`;ctx.fillStyle=this.feedback.perfect?'#fff6a8':this.feedback.good?'#7dff6a':'#ff6a5a';ctx.fillText(this.feedback.text,cx,line-h*.13);ctx.globalAlpha=1;}
    // marco de combo: texto grande que pula e brilha
    if(this.big&&this.big.t>0){const a=1-this.big.t/this.big.life,sc=a<.15?.5+a/.15*.7:1.2-Math.min(.2,(a-.15)*.4);ctx.save();ctx.translate(cx,h*.3);ctx.scale(sc,sc);ctx.textAlign='center';ctx.globalAlpha=Math.min(1,this.big.t*2);ctx.font=`italic 900 ${w*.075|0}px Arial`;ctx.shadowColor=rail==='rgba(255,236,200,.35)'?'#ffd23c':rail;ctx.shadowBlur=24;ctx.fillStyle='#fff';ctx.fillText(this.big.text,0,0);ctx.restore();}
    ctx.restore();}
  round(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
}

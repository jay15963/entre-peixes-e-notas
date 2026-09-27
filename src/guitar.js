// Violão do barco: minigame de ritmo (quatro trilhas, D F J K) em que quem toca faz a música da partida.
// Cada acerto toca a nota da melodia (e o acorde no começo do compasso) para quem estiver perto.
// As músicas são domínio público (tradicionais e clássicas) ou composições originais do jogo.
const N={C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11};
const midi=s=>{const m=/^([A-G][#b]?)(\d)$/.exec(s);return 12*(Number(m[2])+1)+N[m[1]];};
// melodia: "nota:duração" em tempos; "-" é pausa. acordes: um por compasso (tríade fechada numa região grave)
function parse(src){const out=[];let t=0;for(const tok of src.trim().split(/\s+/)){if(tok==='|')continue;const [n,d]=tok.split(':');const len=Number(d||1);if(n!=='-')out.push([t,midi(n),len]);t+=len;}return {notes:out,beats:t};}
const CH={C:['C3','E3','G3'],G:['G2','D3','G3'],G7:['G2','B2','F3'],F:['F2','C3','F3'],Am:['A2','E3','A3'],Dm:['D3','F3','A3'],E:['E2','B2','E3'],E7:['E2','B2','D3'],D:['D3','F#3','A3'],Em:['E2','B2','E3'],A:['A2','E3','A3'],C7:['C3','E3','Bb3'],Bm:['B2','D3','F#3']};
function song(name,credit,bpm,bar,melody,chords,level){const {notes,beats}=parse(melody);const ch=chords.trim().split(/\s+/).filter(c=>c!=='|');return {name,credit,bpm,bar,notes,beats,chords:ch.map(c=>CH[c].map(midi)),level};}
export const SONGS=[
  song('Brilha, Brilha, Estrelinha','tradicional',96,4,
    'C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2 G4 G4 F4 F4 E4 E4 D4:2 G4 G4 F4 F4 E4 E4 D4:2 C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2',
    'C F C G C G C G C G C G C F C G',0),
  song('Frère Jacques','tradicional francesa',112,4,
    'C4 D4 E4 C4 C4 D4 E4 C4 E4 F4 G4:2 E4 F4 G4:2 G4:.5 A4:.5 G4:.5 F4:.5 E4 C4 G4:.5 A4:.5 G4:.5 F4:.5 E4 C4 C4 G3 C4:2 C4 G3 C4:2',
    'C C C C C C C C C C C C',1),
  song('Ode à Alegria','L. van Beethoven (1824)',120,4,
    'E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4:1.5 D4:.5 D4:2 E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4:1.5 C4:.5 C4:2 D4 D4 E4 C4 D4 E4:.5 F4:.5 E4 C4 D4 E4:.5 F4:.5 E4 D4 C4 D4 G3:2 E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4:1.5 C4:.5 C4:2',
    'C G C G C G C G G C G C G C G C C G C G',2),
  song('Scarborough Fair','tradicional inglesa',132,3,
    'D4:2 D4 A4:2 A4 E4:1.5 F4:.5 E4 D4:3 - A4 C5:2 B4 G4 A4:2 - A4:3 - - D5:2 D5 D5:2 C5 A4 A4 G4 F4 E4 C4 D4:2 A4 G4:2 F4 E4 D4 C4 D4:3 - - -',
    'Dm Dm C Dm Dm F C Dm Dm F Dm C F C Dm Dm',3),
  song('Greensleeves','tradicional inglesa (séc. XVI)',150,3,
    'A4 C5:2 D5 E5:1.5 F5:.5 E5 D5:2 B4 G4:1.5 A4:.5 B4 C5:2 A4 A4:1.5 G#4:.5 A4 B4:2 G#4 E4:2 A4 C5:2 D5 E5:1.5 F5:.5 E5 D5:2 B4 G4:1.5 A4:.5 B4 C5:1.5 B4:.5 A4 G#4:1.5 F#4:.5 G#4 A4:3 A4:2',
    'Am Am C G Em Am Am E7 E Am C G Em Am E7 Am Am',4),
  // original do jogo: arpejos rápidos em sol maior, sobe de tom no fim
  song('Laguna ao Entardecer','original · Entre peixes e Notas',138,4,
    'G4:.5 B4:.5 D5:.5 B4:.5 G4:.5 B4:.5 D5 E5:.5 D5:.5 B4:.5 G4:.5 A4 B4 C5:.5 E5:.5 G5:.5 E5:.5 C5:.5 E5:.5 G5 F#5:.5 E5:.5 D5:.5 C5:.5 B4 A4 G4:.5 B4:.5 D5:.5 G5:.5 F#5:.5 D5:.5 A4:.5 F#4:.5 G4:.5 A4:.5 B4:.5 D5:.5 E5 D5 E5:.5 G5:.5 E5:.5 D5:.5 B4:.5 A4:.5 G4 A4:.5 B4:.5 C5:.5 D5:.5 E5:.5 F#5:.5 G5:2 D5:.5 G5:.5 D5:.5 B4:.5 G4:2',
    'G G C D G D Em C Am D G G',5),
];
export const LANE_KEYS=['KeyD','KeyF','KeyJ','KeyK'],LANE_LABELS=['D','F','J','K'],LANE_COLORS=['#58d27a','#ff5a5a','#ffd23c','#4fb6ff'];
export class GuitarHero {
  constructor(){this.round=0;this.active=false;this.flash=[0,0,0,0];this.feedback=null;}
  start(){this.round=0;this.active=true;this.load();}
  stop(){this.active=false;}
  load(){const s=SONGS[this.round%SONGS.length],loop=Math.floor(this.round/SONGS.length);this.song=s;this.tempo=s.bpm*(1+loop*.12+this.round*.015);const spb=60/this.tempo;
    const lo=Math.min(...s.notes.map(n=>n[1])),hi=Math.max(...s.notes.map(n=>n[1])),span=Math.max(1,hi-lo+1);
    this.lead=2.8;this.t=-this.lead;this.window=Math.max(.075,.14-this.round*.008);this.travel=Math.max(.9,1.8-this.round*.1);// segundos que a nota leva do topo à linha
    // músicas curtas tocam duas vezes seguidas (a segunda volta já no embalo)
    const reps=s.beats*spb<28?2:1,src=[];for(let r=0;r<reps;r++)for(const [b,m,len]of s.notes)src.push([b+r*s.beats,m,len]);
    this.notes=src.map(([b,m,len])=>{const lane=Math.min(3,Math.floor((m-lo)/span*4));const bar=Math.floor(b/s.bar);return {time:b*spb,midi:m,lane,len:len*spb,chord:(Math.abs(b%s.bar)<1e-6)?s.chords[bar%s.chords.length]:null,hit:false,missed:false};});
    // músicas mais difíceis (e voltas seguintes) ganham notas duplas no começo do compasso
    if(s.level+loop>=3)for(const n of this.notes)if(n.chord&&Math.random()<.6){n.pair=(n.lane+2)%4;}
    this.end=this.notes[this.notes.length-1].time+2.5;this.score=0;this.combo=0;this.best=0;this.hits=0;this.total=this.notes.reduce((k,n)=>k+(n.pair!==undefined?2:1),0);this.done=false;this.card=3;}
  get mult(){return 1+Math.min(3,Math.floor(this.combo/8));}
  // pressed: trilhas apertadas neste quadro. Devolve as notas a tocar e os erros.
  update(dt,pressed){const out={play:[],miss:0,ghost:0};if(!this.active)return out;this.t+=dt;this.card=Math.max(0,this.card-dt);this.flash=this.flash.map(f=>Math.max(0,f-dt*4));if(this.feedback)this.feedback.t-=dt;
    for(const lane of pressed){this.flash[lane]=1;let best=null,bd=1e9;for(const n of this.notes){if(n.missed)continue;const lanes=n.pair!==undefined?[n.lane,n.pair]:[n.lane];if(!lanes.includes(lane))continue;if(n.hit&&(n.pair===undefined||n.hitPair))continue;const d=Math.abs(n.time-this.t);if(d<this.window&&d<bd){bd=d;best=n;}}
      if(best){const isPair=best.pair===lane&&best.hit;if(isPair)best.hitPair=true;else best.hit=true;this.hits++;this.combo++;this.best=Math.max(this.best,this.combo);const perfect=bd<this.window*.4;this.score+=(perfect?100:60)*this.mult;this.feedback={text:perfect?'PERFEITO!':'BOM',t:.6,good:true};
        if(!isPair)out.play.push(best.midi,...(best.chord||[]));}
      else{this.combo=0;out.ghost++;this.feedback={text:'NOTA FORA',t:.5,good:false};}}
    for(const n of this.notes)if(!n.hit&&!n.missed&&this.t-n.time>this.window){n.missed=true;this.combo=0;out.miss++;this.feedback={text:'ERROU',t:.5,good:false};}
    if(this.t>this.end&&!this.done){this.done=true;out.finished={name:this.song.name,acc:this.hits/this.total,best:this.best,score:this.score};this.round++;setTimeout(()=>{if(this.active)this.load();},2500);}
    return out;}
  // Estrada de notas em perspectiva num canvas 2D
  draw(ctx,w,h){ctx.clearRect(0,0,w,h);if(!this.active||!this.song)return;const top=h*.06,line=h*.8,cx=w/2,wTop=w*.16,wBot=w*.8;
    const X=(lane,y)=>{const k=(y-top)/(line-top),ww=wTop+(wBot-wTop)*Math.max(0,k);return cx-ww/2+ww*(lane+.5)/4;};
    const g=ctx.createLinearGradient(0,top,0,h);g.addColorStop(0,'rgba(10,30,38,0)');g.addColorStop(.3,'rgba(10,30,38,.72)');g.addColorStop(1,'rgba(8,24,30,.92)');
    ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(cx-wTop/2,top);ctx.lineTo(cx+wTop/2,top);ctx.lineTo(cx+wBot/2*1.1,h);ctx.lineTo(cx-wBot/2*1.1,h);ctx.fill();
    // trastes passando (dá sensação de velocidade)
    ctx.strokeStyle='rgba(255,236,200,.08)';ctx.lineWidth=1;const spb=60/this.tempo;for(let b=Math.floor(this.t/spb);b<(this.t+this.travel)/spb+1;b++){const dtm=b*spb-this.t;if(dtm<0)continue;const k=1-dtm/this.travel,y=top+(line-top)*k*k;const ww=wTop+(wBot-wTop)*((y-top)/(line-top));ctx.beginPath();ctx.moveTo(cx-ww/2,y);ctx.lineTo(cx+ww/2,y);ctx.stroke();}
    for(let l=0;l<=4;l++){ctx.strokeStyle='rgba(255,236,200,.18)';ctx.beginPath();ctx.moveTo(cx-wTop/2+wTop*l/4,top);ctx.lineTo(cx-wBot/2+wBot*l/4,line);ctx.stroke();}
    // alvos
    for(let l=0;l<4;l++){const x=X(l,line),f=this.flash[l];ctx.beginPath();ctx.arc(x,line,w*.045,0,Math.PI*2);ctx.strokeStyle=LANE_COLORS[l];ctx.lineWidth=3;ctx.stroke();if(f>0){ctx.fillStyle=LANE_COLORS[l]+Math.round(f*160).toString(16).padStart(2,'0');ctx.fill();}
      ctx.fillStyle='#f6ead6';ctx.font=`700 ${Math.round(w*.032)}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(LANE_LABELS[l],x,line+w*.075);}
    // notas caindo (aceleram perto da linha: perspectiva)
    for(const n of this.notes){if(n.hit&&(n.pair===undefined||n.hitPair))continue;const dtm=n.time-this.t;if(dtm>this.travel||dtm<-.25)continue;const k=1-dtm/this.travel,y=top+(line-top)*Math.max(0,k)*Math.max(0,k)+(k>1?(k-1)*(h-line)*3:0);const s=w*(.012+.034*Math.max(0,Math.min(1.1,k)));
      for(const lane of n.pair!==undefined?[n.lane,n.pair]:[n.lane]){if(lane===n.pair&&n.hitPair)continue;if(lane===n.lane&&n.hit)continue;const x=X(lane,y);ctx.beginPath();ctx.ellipse(x,y,s,s*.62,0,0,Math.PI*2);ctx.fillStyle=n.missed?'#5b5b5b':LANE_COLORS[lane];ctx.fill();ctx.lineWidth=2;ctx.strokeStyle='rgba(255,255,255,.85)';ctx.stroke();
        ctx.beginPath();ctx.ellipse(x,y-s*.15,s*.45,s*.2,0,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,.55)';ctx.fill();}}
    // placar
    ctx.textAlign='left';ctx.fillStyle='#f6ead6';ctx.font=`700 ${Math.round(w*.04)}px Georgia`;ctx.fillText(this.score.toLocaleString('pt-BR'),w*.03,h*.12);
    ctx.font=`600 ${Math.round(w*.028)}px Arial`;ctx.fillStyle='#e5c08c';ctx.fillText(`COMBO ${this.combo} · x${this.mult}`,w*.03,h*.2);
    ctx.textAlign='right';ctx.fillStyle='#f6ead6';ctx.fillText(`${Math.round(this.tempo)} BPM · MÚSICA ${this.round+1}`,w*.97,h*.12);
    if(this.card>0||this.t<0){ctx.textAlign='center';ctx.globalAlpha=Math.min(1,Math.max(this.card,-this.t));ctx.font=`italic 700 ${Math.round(w*.055)}px Georgia`;ctx.fillStyle='#ffdda9';ctx.fillText(this.song.name,cx,h*.36);ctx.font=`${Math.round(w*.03)}px Arial`;ctx.fillStyle='#b8c7bf';ctx.fillText(this.song.credit,cx,h*.44);ctx.globalAlpha=1;}
    if(this.feedback&&this.feedback.t>0){ctx.textAlign='center';ctx.globalAlpha=Math.min(1,this.feedback.t*3);ctx.font=`900 ${Math.round(w*.05)}px Arial`;ctx.fillStyle=this.feedback.good?'#7dff6a':'#ff6a5a';ctx.fillText(this.feedback.text,cx,line-h*.12);ctx.globalAlpha=1;}
    if(this.done){ctx.textAlign='center';ctx.font=`italic 700 ${Math.round(w*.05)}px Georgia`;ctx.fillStyle='#ffdda9';ctx.fillText('Próxima música: mais rápida!',cx,h*.4);}
  }
}

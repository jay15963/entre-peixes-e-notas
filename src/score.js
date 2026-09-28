// ======================================================================================================
// Trilha do Eclipse do Coração: ~35 s sintetizados na hora (Web Audio), sincronizados com o espetáculo (eclipse.js).
// Ré menor, 90 BPM. Percussão taiko, metais com filtro abrindo, coro com formantes ("ah"), cordas em ostinato, gongo e sinos.
//   Ato I   0–12 s   o chamado: Dm–B♭–F–C, coro e metais crescendo, cordas entram, tambores dobram, prato em crescendo
//   11,9 s           anel de diamante: sinos, e um respiro de silêncio
//   Ato II  12–19 s  totalidade: tutti em Ré menor, melodia heroica nos metais, galope das cordas, rufar até o alinhamento
//   Ato III 19–24 s  o alinhamento: Ré MAIOR, fanfarra, cascata de sinos, D–G–D/F♯–A
//   Ato IV  24–35 s  a luz volta e o céu escurece de novo: cluster grave, coro descendo, batidas de coração até o meteoro
// A música normal do jogo abaixa durante a trilha e volta depois.
// ======================================================================================================
const NOTE=n=>440*Math.pow(2,(n-69)/12);
export function eclipseScore(S){const ctx=S.ctx;if(!ctx)return;const t0=ctx.currentTime+.05,B=60/90;
  if(S.eclBus){const old=S.eclBus;old.gain.setTargetAtTime(0,ctx.currentTime,.25);setTimeout(()=>{try{old.disconnect();}catch{}},2500);}
  const bus=ctx.createGain();bus.gain.value=.85;bus.connect(S.bus);const rv=ctx.createGain();rv.gain.value=.6;bus.connect(rv).connect(S.revSend);S.eclBus=bus;
  if(S.music){S.music.gain.setTargetAtTime(.06,t0,.6);S.music.gain.setTargetAtTime(.55,t0+35,1.5);}
  // ----- instrumentos -----
  const voice=(midi,when,dur,{type='sawtooth',gain=.04,att=.02,rel=.3,cut=1800,cutTo=null,q=.8,det=[0],filter='lowpass',vib=0}={})=>{const t=t0+when,f=ctx.createBiquadFilter(),g=ctx.createGain();
    f.type=filter;f.frequency.setValueAtTime(cut,t);if(cutTo)f.frequency.linearRampToValueAtTime(cutTo,t+Math.max(.05,att*1.5));f.Q.value=q;
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(gain,t+att);g.gain.setValueAtTime(gain,t+Math.max(att,dur-rel));g.gain.linearRampToValueAtTime(0,t+dur);f.connect(g).connect(bus);
    for(const d of det){const o=ctx.createOscillator();o.type=type;o.frequency.value=NOTE(midi);o.detune.value=d;
      if(vib){const l=ctx.createOscillator(),lg=ctx.createGain();l.frequency.value=4.6+Math.random()*1.2;lg.gain.value=vib;l.connect(lg).connect(o.detune);l.start(t);l.stop(t+dur+.1);}
      o.connect(f);o.start(t);o.stop(t+dur+.1);}};
  const noise=(buf,when,dur,{type='highpass',freq=4000,to=null,q=.7,gain=.2,att=.01}={})=>{const t=t0+when,s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();s.buffer=buf;f.type=type;f.frequency.setValueAtTime(freq,t);if(to)f.frequency.exponentialRampToValueAtTime(to,t+dur);f.Q.value=q;
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(gain,t+att);g.gain.exponentialRampToValueAtTime(.0001,t+Math.max(att+.02,dur));s.connect(f).connect(g).connect(bus);s.start(t,Math.random()*2);s.stop(t+dur+.1);};
  const taiko=(when,g=1)=>{const t=t0+when,o=ctx.createOscillator(),og=ctx.createGain();o.type='sine';o.frequency.setValueAtTime(96,t);o.frequency.exponentialRampToValueAtTime(40,t+.4);og.gain.setValueAtTime(0,t);og.gain.linearRampToValueAtTime(.85*g,t+.004);og.gain.exponentialRampToValueAtTime(.001,t+1);o.connect(og).connect(bus);o.start(t);o.stop(t+1.05);
    noise(S.brown,when,.3,{type:'lowpass',freq:700,gain:.7*g,att:.003});noise(S.white,when,.07,{type:'bandpass',freq:1600,gain:.14*g,att:.002});};
  const small=(when,g=.5)=>{noise(S.white,when,.09,{type:'bandpass',freq:2600,q:1.5,gain:.2*g,att:.002});noise(S.brown,when,.12,{type:'lowpass',freq:500,gain:.3*g,att:.002});};
  const gong=(when,g=1)=>{[55,82.4,110.5,148,196,262,349].forEach((f,i)=>{const t=t0+when,o=ctx.createOscillator(),og=ctx.createGain();o.type='sine';o.frequency.setValueAtTime(f*1.025,t);o.frequency.exponentialRampToValueAtTime(f,t+2);
      og.gain.setValueAtTime(0,t);og.gain.linearRampToValueAtTime(.11*g/(1+i*.35),t+.02);og.gain.exponentialRampToValueAtTime(.001,t+6.5-i*.6);o.connect(og).connect(bus);o.start(t);o.stop(t+6.6);});noise(S.pink,when,4.5,{type:'bandpass',freq:500,q:.5,gain:.22*g,att:.01});};
  const swell=(when,dur,g=.22)=>noise(S.white,when,dur,{type:'highpass',freq:2800,gain:g,att:dur*.96});
  const riser=(when,dur,from=160,to=1800,g=.035)=>{const t=t0+when,o=ctx.createOscillator(),og=ctx.createGain();o.type='sawtooth';o.frequency.setValueAtTime(from,t);o.frequency.exponentialRampToValueAtTime(to,t+dur);og.gain.setValueAtTime(0,t);og.gain.linearRampToValueAtTime(g,t+dur*.9);og.gain.linearRampToValueAtTime(0,t+dur);const f=ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=1200;f.Q.value=.6;o.connect(f).connect(og).connect(bus);o.start(t);o.stop(t+dur+.05);};
  const choir=(notes,when,dur,g=.02)=>notes.forEach(n=>{const a=Math.min(1.1,dur*.3),r=Math.min(1.4,dur*.35);voice(n,when,dur,{gain:g,att:a,rel:r,cut:780,filter:'bandpass',q:1.8,det:[-10,0,9],vib:7});voice(n,when,dur,{gain:g*.55,att:a,rel:r,cut:1180,filter:'bandpass',q:2.4,det:[-5,6],vib:7});});
  const brass=(notes,when,dur,g=.04,open=2600)=>notes.forEach(n=>voice(n,when,dur,{gain:g,att:.1,rel:.22,cut:420,cutTo:open,q:1.3,det:[-7,7],vib:4}));
  const horn=(n,when,dur,g=.05)=>voice(n,when,dur,{gain:g,att:.06,rel:.18,cut:700,cutTo:3200,q:1.1,det:[-6,0,6],vib:9});
  const bass=(n,when,dur,g=.07)=>voice(n,when,dur,{gain:g,att:.08,rel:.4,cut:320,q:.9,det:[-4,4]});
  const bell=(n,when,g=.055)=>{voice(n,when,2.6,{type:'sine',gain:g,att:.003,rel:2.5,cut:9000});voice(n+19,when,1.4,{type:'sine',gain:g*.3,att:.003,rel:1.3,cut:9000});voice(n+12,when,1.8,{type:'triangle',gain:g*.25,att:.003,rel:1.7,cut:9000});};
  const arp=(notes,from,to,step,g,pat=[0,1,2,1,3,1,2,1])=>{let i=0;for(let t=from;t<to-1e-3;t+=step,i++)voice(notes[pat[i%pat.length]%notes.length],t,step*.9,{gain:g,att:.008,rel:step*.35,cut:2600,q:.6,det:[-5,5]});};
  // ----- Ato I: o chamado (0–12 s) -----
  taiko(0,1.4);gong(0,.8);brass([38,45],0,4.5,.045,1400);choir([50,57],.3,4.5,.018);
  const I=[[38,[62,65,69],[50,53,57,62]],[34,[62,65,70],[46,50,53,58]],[41,[60,65,69],[53,57,60,65]],[36,[60,64,67],[48,52,55,60]]];
  I.forEach(([root,ch,ar],c)=>{const t=c*4*B;bass(root,t,4*B,.06);if(c>0)choir(ch,t,4*B+.2,.017+c*.002);if(c>=1)brass([root+12,root+19],t+.1,4*B-.1,.028+c*.006,900+c*500);if(c>=1)arp(ar.map(n=>n+12),t,t+4*B,B/4,.009+c*.003);});
  const I2=[[38,[62,65,69,74]],[34,[62,65,70,74]]];I2.forEach(([root,ch],c)=>{const t=16*B+c*2*B;bass(root,t,2*B,.07);choir(ch,t,2*B+.1,.024);brass([root+12,root+19,root+24],t,2*B,.045,2400);arp([62,65,69,74],t,t+2*B,B/4,.02);});
  for(let b=3;b<18;b++){const t=b*B;taiko(t,b%4===0?1:.55);if(b>=12)small(t+B/2,.5);if(b>=15){small(t+B/4,.35);small(t+3*B/4,.35);}}
  swell(8.6,3.3,.25);riser(9.8,2.1,140,1500,.03);
  [[86,11.88],[93,11.93],[98,12.0]].forEach(([n,w])=>bell(n,w,.07));
  // ----- Ato II: totalidade (12,2–19 s) -----
  const T0=12.2;taiko(T0,1.5);taiko(T0+.1,1.1);gong(T0,1.3);
  const II=[[38,[50,57,62,65,69,74]],[43,[55,62,67,70,74]],[45,[57,61,64,69,73]]];
  II.forEach(([root,ch],c)=>{const t=T0+c*4*B,d=c<2?4*B:3.2*B;bass(root,t,d,.08);bass(root-12,t,d,.05);choir(ch,t,d+.1,.024);brass([root+12,root+19],t,d,.04,2200);arp(ch.slice(-4).map(n=>n+(c===2?0:0)),t,t+d,B/4,.017,[0,0,1,0,0,2,0,3]);});
  const mel=[[74,1],[77,.5],[76,.5],[74,1],[69,1],[70,1],[72,.5],[74,.5],[67,2],[69,1],[73,1],[76,.5],[79,.25]];let mt=T0;for(const [n,b]of mel){horn(n,mt,b*B*.98,.052);horn(n-12,mt,b*B*.98,.03);mt+=b*B;}
  for(let b=0;b<10;b++){const t=T0+b*B;taiko(t,b%2?.7:1.1);small(t+B/2,.45);}for(let i=0;i<12;i++)small(17.55+i*B/8,.3+i*.05);
  swell(16.4,2.6,.3);riser(17.3,1.7,200,2400,.035);
  // ----- Ato III: o alinhamento, Ré MAIOR (19–24 s) -----
  const L=19;gong(L,1.5);taiko(L,1.6);taiko(L+.12,1.2);taiko(L+.24,1);noise(S.white,L,3.5,{type:'highpass',freq:5000,gain:.28,att:.01});
  const III=[[38,[50,57,62,66,69,74,78]],[43,[55,62,67,71,74,79]],[42,[54,57,62,66,69,74]],[45,[57,61,64,69,73,76]]];
  III.forEach(([root,ch],c)=>{const t=L+c*2*B;bass(root,t,2*B,.085);bass(root-12,t,2*B,.05);choir(ch,t,2*B+.2,.026);brass([root+12,root+19,root+24],t,2*B,.05,3200);arp(ch.slice(-4),t,t+2*B,B/4,.02,[0,1,2,3,2,1,2,3]);taiko(t,1);small(t+B,.6);});
  const fan=[[74,1],[69,.5],[74,.5],[78,1],[76,.5],[74,.5],[81,2]];let ft=L+.02;for(const [n,b]of fan){horn(n,ft,b*B*.98,.058);horn(n-12,ft,b*B*.98,.035);ft+=b*B;}
  for(let i=0;i<22;i++){const n=[86,88,90,93,95,98,100][Math.floor(Math.random()*7)];bell(n,L+.2+Math.random()*4.6,.03);}
  // ----- Ato IV: a luz volta, o céu escurece de novo (24–35 s) -----
  bell(98,24,.08);bell(105,24.05,.05);
  voice(38,24.4,10,{gain:.05,att:3,rel:2,cut:260,cutTo:900,q:1.4,det:[-8,8],vib:3});voice(39,26,8.5,{gain:.035,att:3,rel:2,cut:260,cutTo:800,q:1.4,det:[-8,8]});
  choir([62,65,69],24.5,4,.02);choir([62,65,70],28.3,3.2,.02);choir([63,67,70],31.3,3.6,.022);
  for(let t=25.2;t<33.5;t+=1/16)voice(Math.floor(t*16)%2?50:57,t,1/16,{gain:.008+(t-25)*.0012,att:.004,rel:.02,cut:1400,q:.6});
  for(let t=25.4,i=0;t<33.5;t+=1.55,i++){taiko(t,.8-i*.05);taiko(t+.26,.55-i*.04);}
  swell(31.5,3.2,.26);riser(32.6,2,90,900,.03);}

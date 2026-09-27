// Áudio 100% sintetizado: ambiente em camadas, música generativa (violão Karplus-Strong + pads),
// efeitos posicionais 3D e a trilha do cataclismo, com corte seco quando a onda atinge o barco.
const NOTE=n=>440*Math.pow(2,(n-69)/12);
const CHORDS={
  sunset:[[43,55,59,62,66],[40,52,55,59,62,66],[36,52,55,59,64],[38,54,57,62,64]],// Gmaj7 Em9 Cmaj7 D6/9
  storm:[[40,52,55,59],[36,48,55,60,63],[33,45,52,57,60],[35,47,51,54,57]],// Em Cm(add) Am B7
  farewell:[[36,48,55,60,64],[35,50,55,59,62],[33,48,52,57,60],[29,45,53,57,60],[31,47,55,59,62],[28,47,52,55,59],[33,45,52,57,60],[31,50,55,59,62]]
};
const MELODY=[74,76,79,81,79,76,74,71,74,76,78,79,81,83,86];
export class Sound {
  constructor(){this.ctx=null;this.muted=false;this.nextBeat=0;this.beat=0;this.plucks=new Map();this.cut=false;this.lastStep=0;this.meteorStage=0;this.volume=Number(localStorage.getItem('peixes-vol')??.8);if(!Number.isFinite(this.volume))this.volume=.8;this.musicLevel=Number(localStorage.getItem('peixes-music')??1);if(!Number.isFinite(this.musicLevel))this.musicLevel=1;}
  setVolume(v){this.volume=v;try{localStorage.setItem('peixes-vol',v);}catch{}if(this.master&&!this.cut)this.master.gain.setTargetAtTime(this.muted?0:v,this.ctx.currentTime,.05);}
  setMusic(v){this.musicLevel=v;try{localStorage.setItem('peixes-music',v);}catch{}if(this.guitarBus)this.guitarBus.gain.setTargetAtTime(v,this.ctx.currentTime,.05);}
  start(){
    if(this.ctx){this.ctx.resume();return;}
    const ctx=this.ctx=new AudioContext({latencyHint:'interactive'});
    this.master=ctx.createGain();this.master.gain.value=this.muted?0:this.volume;
    this.comp=ctx.createDynamicsCompressor();this.comp.threshold.value=-14;this.comp.knee.value=12;this.comp.ratio.value=4;this.comp.attack.value=.004;this.comp.release.value=.25;
    this.muffle=ctx.createBiquadFilter();this.muffle.type='lowpass';this.muffle.frequency.value=20000;this.muffle.Q.value=.5;
    this.bus=ctx.createGain();this.bus.connect(this.muffle).connect(this.comp).connect(this.master).connect(ctx.destination);
    this.reverb=ctx.createConvolver();this.reverb.buffer=this.impulse(3.8,2.6);this.revSend=ctx.createGain();this.revSend.gain.value=.9;this.revSend.connect(this.reverb).connect(this.muffle);
    this.music=ctx.createGain();this.music.gain.value=.55;this.music.connect(this.bus);const mr=ctx.createGain();mr.gain.value=.5;this.music.connect(mr).connect(this.revSend);
    this.white=this.noise('white',4);this.pink=this.noise('pink',4);this.brown=this.noise('brown',6);
    // Camadas contínuas
    this.oceanL=this.bed(this.brown,'lowpass',380,.7,-.6);this.oceanR=this.bed(this.brown,'lowpass',420,.7,.6,1.3);
    this.foam=this.bed(this.pink,'bandpass',1500,.7,0,.7);
    this.wind=this.bed(this.pink,'bandpass',600,1.3,.3,2.1);this.whistle=this.bed(this.white,'bandpass',2300,16,-.2,.4);
    this.rain=this.bed(this.white,'highpass',2600,.4,0,3.1);this.rainLow=this.bed(this.pink,'bandpass',800,.8,0,1.9);
    this.roar=this.bed(this.brown,'lowpass',80,.8,0,.2);this.roar2=this.bed(this.pink,'lowpass',200,.7,0,1.1);
    this.tsunami=this.bed(this.brown,'lowpass',120,.6,0,2.4);this.tsuHiss=this.bed(this.pink,'bandpass',900,.5,0,.9);
    // Motor de popa
    const mo=ctx.createOscillator(),mo2=ctx.createOscillator(),mf=ctx.createBiquadFilter(),mg=ctx.createGain();mo.type='sawtooth';mo2.type='square';mo.frequency.value=34;mo2.frequency.value=68.5;mf.type='lowpass';mf.frequency.value=260;mf.Q.value=3;mg.gain.value=0;mo.connect(mf);const m2g=ctx.createGain();m2g.gain.value=.3;mo2.connect(m2g).connect(mf);mf.connect(mg).connect(this.bus);mo.start();mo2.start();this.motor={osc:mo,osc2:mo2,filter:mf,gain:mg};
    // Pad sustentado da música
    this.pad=[];for(let i=0;i<5;i++){const o1=ctx.createOscillator(),o2=ctx.createOscillator(),f=ctx.createBiquadFilter(),g=ctx.createGain();o1.type='sawtooth';o2.type='sawtooth';o2.detune.value=9;o1.detune.value=-7;f.type='lowpass';f.frequency.value=700;f.Q.value=.4;g.gain.value=0;o1.connect(f);o2.connect(f);f.connect(g).connect(this.music);o1.start();o2.start();this.pad.push({o1,o2,f,g});}
    this.tinnitus=ctx.createOscillator();this.tinnitus.frequency.value=3700;this.tinnitusGain=ctx.createGain();this.tinnitusGain.gain.value=0;this.tinnitus.connect(this.tinnitusGain).connect(this.master);this.tinnitus.start();
    // violão tocado pelos jogadores: barramento próprio (volume da música) e som posicional
    this.guitarBus=ctx.createGain();this.guitarBus.gain.value=this.musicLevel;this.guitarBus.connect(this.bus);const gr=ctx.createGain();gr.gain.value=.35;this.guitarBus.connect(gr).connect(this.revSend);
    this.nextBeat=ctx.currentTime+.2;
  }
  impulse(seconds,decay){const ctx=this.ctx,len=Math.floor(ctx.sampleRate*seconds),b=ctx.createBuffer(2,len,ctx.sampleRate);for(let c=0;c<2;c++){const d=b.getChannelData(c);for(let i=0;i<len;i++){const t=i/len;d[i]=(Math.random()*2-1)*Math.pow(1-t,decay)*(i<ctx.sampleRate*.012?.4:1);}}return b;}
  noise(kind,seconds){const ctx=this.ctx,len=Math.floor(ctx.sampleRate*seconds),b=ctx.createBuffer(1,len,ctx.sampleRate),d=b.getChannelData(0);let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,last=0;
    for(let i=0;i<len;i++){const w=Math.random()*2-1;if(kind==='white')d[i]=w*.5;else if(kind==='pink'){b0=.99886*b0+w*.0555179;b1=.99332*b1+w*.0750759;b2=.969*b2+w*.153852;b3=.8665*b3+w*.3104856;b4=.55*b4+w*.5329522;b5=-.7616*b5-w*.016898;d[i]=(b0+b1+b2+b3+b4+b5+w*.5362)*.11;}else{last=(last+.02*w)/1.02;d[i]=last*3.5;}}
    // suaviza a emenda do loop
    const f=Math.floor(ctx.sampleRate*.05);for(let i=0;i<f;i++){const k=i/f;d[len-f+i]=d[len-f+i]*(1-k)+d[i]*k;}return b;}
  bed(buffer,type,freq,q,pan=0,offset=0){const ctx=this.ctx,s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain(),p=ctx.createStereoPanner();s.buffer=buffer;s.loop=true;f.type=type;f.frequency.value=freq;f.Q.value=q;g.gain.value=0;p.pan.value=pan;s.connect(f).connect(g).connect(p).connect(this.bus);s.start(0,offset%buffer.duration);return {source:s,filter:f,gain:g,pan:p};}
  set(node,param,value,tc=.3){if(this.ctx)node[param].setTargetAtTime(value,this.ctx.currentTime,tc);}
  toggle(){this.muted=!this.muted;if(this.master)this.master.gain.setTargetAtTime(this.muted?0:this.volume,this.ctx.currentTime,.1);return this.muted;}
  listener(camera){if(!this.ctx)return;const l=this.ctx.listener,p=camera.position,f=camera.getWorldDirection(this._f||(this._f=camera.position.clone())),t=this.ctx.currentTime;if(l.positionX){l.positionX.setTargetAtTime(p.x,t,.02);l.positionY.setTargetAtTime(p.y,t,.02);l.positionZ.setTargetAtTime(p.z,t,.02);l.forwardX.setTargetAtTime(f.x,t,.02);l.forwardY.setTargetAtTime(f.y,t,.02);l.forwardZ.setTargetAtTime(f.z,t,.02);l.upX.value=0;l.upY.value=1;l.upZ.value=0;}else{l.setPosition(p.x,p.y,p.z);l.setOrientation(f.x,f.y,f.z,0,1,0);}}
  out(pos,reverb=.2){const ctx=this.ctx,g=ctx.createGain();if(pos){const p=ctx.createPanner();p.panningModel='HRTF';p.distanceModel='inverse';p.refDistance=2;p.rolloffFactor=.8;p.positionX.value=pos.x;p.positionY.value=pos.y;p.positionZ.value=pos.z;g.connect(p).connect(this.bus);if(reverb){const r=ctx.createGain();r.gain.value=reverb;p.connect(r).connect(this.revSend);}}else{g.connect(this.bus);if(reverb){const r=ctx.createGain();r.gain.value=reverb;g.connect(r).connect(this.revSend);}}return g;}
  env(g,t,a,peak,d,end=.0001){g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(peak,t+a);g.gain.exponentialRampToValueAtTime(end,t+a+d);}
  burst(buffer,{type='bandpass',freq=1000,q=1,to=null,dur=.3,attack=.005,gain=.5,pos=null,reverb=.2,when=0,rate=1}={}){const ctx=this.ctx,t=ctx.currentTime+when,s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();s.buffer=buffer;s.playbackRate.value=rate;f.type=type;f.frequency.setValueAtTime(freq,t);if(to)f.frequency.exponentialRampToValueAtTime(to,t+dur);f.Q.value=q;s.connect(f).connect(g).connect(this.out(pos,reverb));this.env(g,t,attack,gain,dur);s.start(t,Math.random()*2);s.stop(t+attack+dur+.1);}
  tone(freq,{type='sine',dur=.3,attack=.005,gain=.2,to=null,pos=null,reverb=.2,when=0,dest=null}={}){const ctx=this.ctx,t=ctx.currentTime+when,o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);if(to)o.frequency.exponentialRampToValueAtTime(to,t+dur);o.connect(g).connect(dest||this.out(pos,reverb));this.env(g,t,attack,gain,dur);o.start(t);o.stop(t+attack+dur+.1);}
  // Violão: Karplus-Strong pré-calculado por nota
  pluckBuffer(midi){if(this.plucks.has(midi))return this.plucks.get(midi);const sr=this.ctx.sampleRate,len=Math.floor(sr*3.2),b=this.ctx.createBuffer(1,len,sr),d=b.getChannelData(0),p=Math.max(2,Math.round(sr/NOTE(midi))),line=new Float32Array(p);for(let i=0;i<p;i++)line[i]=(Math.random()*2-1)*(.6+.4*Math.sin(i/p*Math.PI));let idx=0,prev=0;const damp=.996-Math.max(0,midi-60)*.0004;
    for(let i=0;i<len;i++){const cur=line[idx];const next=(cur+prev)*.5*damp;prev=cur;line[idx]=next;d[i]=cur;idx=(idx+1)%p;}
    // corpo do violão: leve realce de graves
    this.plucks.set(midi,b);return b;}
  pluck(midi,when,gain=.22,pan=0){const ctx=this.ctx,s=ctx.createBufferSource(),g=ctx.createGain(),f=ctx.createBiquadFilter(),p=ctx.createStereoPanner();s.buffer=this.pluckBuffer(midi);f.type='lowpass';f.frequency.value=2600+Math.random()*800;g.gain.value=gain;p.pan.value=pan;s.connect(f).connect(g).connect(p).connect(this.music);s.start(when);}
  // Violão: nota da melodia + acorde dedilhado, saindo do violão de quem toca (mais longe = mais baixo)
  guitar(notes,pos,{gain=.34}={}){if(!this.ctx||this.cut||!notes?.length)return;const ctx=this.ctx,now=ctx.currentTime,p=ctx.createPanner();p.panningModel='HRTF';p.distanceModel='inverse';p.refDistance=2.5;p.rolloffFactor=1.35;p.maxDistance=120;
    if(pos){p.positionX.value=pos.x;p.positionY.value=pos.y;p.positionZ.value=pos.z;}p.connect(this.guitarBus);
    const body=ctx.createBiquadFilter();body.type='peaking';body.frequency.value=220;body.gain.value=5;body.Q.value=.9;body.connect(p);
    notes.forEach((n,i)=>{const s=ctx.createBufferSource(),g=ctx.createGain(),f=ctx.createBiquadFilter();s.buffer=this.pluckBuffer(n);f.type='lowpass';f.frequency.value=i===0?3400:2200;g.gain.value=i===0?gain:gain*.42;s.connect(f).connect(g).connect(body);s.start(now+(i===0?0:.012+i*.022));s.stop(now+3.4);});
    setTimeout(()=>{try{p.disconnect();}catch{}},4000);}
  deadNote(pos){if(!this.ctx||this.cut)return;this.burst(this.brown,{type:'bandpass',freq:180,q:2,dur:.09,attack:.002,gain:.5,pos,reverb:.05});this.burst(this.white,{type:'bandpass',freq:2400,q:3,dur:.04,gain:.18,pos});}
  padChord(notes,when,level,bright=700,glide=1.6){notes.forEach((n,i)=>{const v=this.pad[i];if(!v)return;const f=NOTE(n+12*(n<45?1:0));v.o1.frequency.setTargetAtTime(f,when,.05);v.o2.frequency.setTargetAtTime(f*1.003,when,.05);v.g.gain.setTargetAtTime(level/(1+i*.25),when,glide);v.f.frequency.setTargetAtTime(bright,when,1);});for(let i=notes.length;i<this.pad.length;i++)this.pad[i].g.gain.setTargetAtTime(0,when,.8);}
  scheduleMusic(t,phase){
    const ctx=this.ctx;if(this.cut)return;
    while(this.nextBeat<ctx.currentTime+.25){
      const when=this.nextBeat,b=this.beat++;
      if(phase==='sunset'){const bpm=72,step=60/bpm/2;this.nextBeat+=step;const ch=CHORDS.sunset[Math.floor(b/16)%4];if(b%16===0)this.padChord(ch,when,.028,900);
        const pat=[0,2,3,4,1,3,2,4];const n=ch[pat[b%8]%ch.length]+(b%8===0?0:12);this.pluck(n,when+(Math.random()-.5)*.012,b%8===0?.26:.16,(b%2?.25:-.25));
        if(b%32>=16&&b%4===2&&Math.random()<.6)this.pluck(MELODY[(b*7+Math.floor(b/32))%MELODY.length],when,.14,.1);}
      else if(phase==='storm'){const step=60/64;this.nextBeat+=step;const ch=CHORDS.storm[Math.floor(b/8)%4];if(b%8===0){this.padChord(ch,when,.035,420);this.pluck(ch[0],when,.3,-.2);}if(b%4===2&&Math.random()<.5)this.pluck(ch[1+Math.floor(Math.random()*(ch.length-1))]+12,when,.09,.3);}
      else if(phase==='asteroid'){this.nextBeat+=2;this.padChord([26,38,45,50,51],when,.05,300+(t-120)*40,3);}
      else if(phase==='wave'){this.nextBeat+=1;this.padChord([26,38],when,0.0001,200,.4);}
      else if(phase==='farewell'){const step=60/58;this.nextBeat+=step;const k=Math.max(0,(t-145)/19),ch=CHORDS.farewell[Math.floor(b/4)%8];if(b%4===0){this.padChord(ch,when,.03+k*.05,600+k*1800,1.2);this.pluck(ch[0],when,.3,-.1);}
        this.pluck(ch[1+b%(ch.length-1)]+12,when+.02,.12+k*.08,b%2?.3:-.3);if(b%4===2)this.pluck(ch[ch.length-1]+24,when+step*.5,.08+k*.08,.1);}
      else {this.nextBeat+=.5;this.padChord([],when,0);}
    }
  }
  update(t,dt,s){
    if(!this.ctx)return;const now=this.ctx.currentTime;
    if(s.phase!==this.phase){this.phase=s.phase;this.beat=0;this.nextBeat=Math.max(this.nextBeat,now+.05);}
    if(this.cut){return;}
    // em jogo não há trilha automática: a música é o violão que algum pescador toca; só o cataclismo mantém a trilha
    if(!s.running)this.scheduleMusic(t,'sunset');else if(['asteroid','wave','farewell','blackout','title'].includes(s.phase))this.scheduleMusic(t,s.phase);else if(this.pad)this.padChord([],now,0);
    const storm=s.storm,swell=.5+.5*Math.sin(t*.42)*Math.sin(t*.13+1),heave=Math.min(1,Math.abs(s.heave||0));
    this.set(this.oceanL.gain,'gain',.16+swell*.12+storm*.35+s.tsu*.2,.4);this.set(this.oceanR.gain,'gain',.16+(1-swell)*.12+storm*.35,.4);
    this.set(this.oceanL.filter,'frequency',320+storm*500+heave*200,.5);this.set(this.foam.gain,'gain',.035+swell*.03+storm*.12,.5);
    this.set(this.wind.gain,'gain',.03+storm*.32,.8);this.set(this.wind.filter,'frequency',450+storm*700+Math.sin(t*.7)*storm*300,.6);this.set(this.whistle.gain,'gain',storm*storm*.05*(.5+.5*Math.sin(t*.35)),.8);
    this.set(this.rain.gain,'gain',storm*.12,1);this.set(this.rainLow.gain,'gain',storm*.08,1);
    this.set(this.roar.gain,'gain',s.meteor*s.meteor*.9,.3);this.set(this.roar.filter,'frequency',60+s.meteor*380,.3);this.set(this.roar2.gain,'gain',s.meteor*s.meteor*s.meteor*.35,.3);
    this.set(this.tsunami.gain,'gain',s.tsu*s.tsu*1.1,.3);this.set(this.tsunami.filter,'frequency',90+s.tsu*s.tsu*900,.3);this.set(this.tsuHiss.gain,'gain',s.tsu*s.tsu*s.tsu*.45,.3);
    const sp=Math.abs(s.speed||0);this.set(this.motor.gain,'gain',s.driving?.05+sp*.03:0,.2);this.set(this.motor.osc,'frequency',30+sp*9,.2);this.set(this.motor.osc2,'frequency',61+sp*18,.2);
    // crepitar do meteoro
    if(s.meteor>.05&&Math.random()<dt*20*s.meteor)this.burst(this.white,{type:'highpass',freq:1500+Math.random()*2000,dur:.03+Math.random()*.05,gain:.05+s.meteor*.12,reverb:.3});
    if(s.meteor>.7&&this.meteorStage===0){this.meteorStage=1;this.sonicBoom(0);}
    // gaivotas no pôr do sol
    if(s.phase==='sunset'&&s.running&&Math.random()<dt*.07)this.gull();
    // tábuas rangendo com o balanço
    if(Math.random()<dt*(.12+storm*.5))this.creak();
  }
  // ----- Efeitos -----
  effect(name,o={}){
    if(!this.ctx||this.cut)return;const pos=o.pos||null;
    if(name==='slap'){this.burst(this.white,{type:'bandpass',freq:2600,q:.9,dur:.07,attack:.001,gain:.9,pos,reverb:.25});this.tone(170,{type:'sine',dur:.09,gain:.4,to:90,pos});this.burst(this.pink,{type:'bandpass',freq:500,to:1800,q:1,dur:.12,gain:.12,pos,when:-.0});}
    if(name==='whoosh')this.burst(this.pink,{type:'bandpass',freq:300,to:1400,q:2,dur:.22,attack:.08,gain:.2,pos});
    if(name==='splash'){this.burst(this.white,{type:'bandpass',freq:1800,to:300,q:.7,dur:.9,attack:.01,gain:.8,pos,reverb:.35});this.burst(this.brown,{type:'lowpass',freq:500,dur:.6,gain:.9,pos});for(let i=0;i<8;i++)this.tone(900+Math.random()*1800,{type:'sine',dur:.05,gain:.05,to:400,pos,when:.15+Math.random()*.9});}
    if(name==='launch'){this.burst(this.pink,{type:'bandpass',freq:400,to:2600,q:3,dur:.8,attack:.05,gain:.35,pos});this.tone(300,{type:'triangle',dur:.7,gain:.1,to:1200,pos});}
    if(name==='cast'){this.burst(this.pink,{type:'bandpass',freq:2500,to:700,q:4,dur:.35,attack:.02,gain:.25});for(let i=0;i<10;i++)this.burst(this.white,{type:'highpass',freq:4000,dur:.012,gain:.12,when:.1+i*.04});this.burst(this.white,{type:'bandpass',freq:1200,q:2,dur:.18,gain:.2,when:.75,pos});}
    if(name==='run'){for(let i=0;i<26;i++)this.burst(this.white,{type:'bandpass',freq:3200+Math.random()*900,q:6,dur:.014,attack:.001,gain:.13,when:i*.028,reverb:.05});this.tone(1400,{type:'sawtooth',dur:.7,gain:.025,to:600});this.burst(this.white,{type:'bandpass',freq:1600,to:500,q:1,dur:.5,gain:.35,pos,reverb:.3});}
    if(name==='snap'){this.burst(this.white,{type:'highpass',freq:5000,dur:.05,attack:.001,gain:.6,reverb:.2});this.tone(2600,{type:'triangle',dur:.25,gain:.12,to:300});this.burst(this.pink,{type:'bandpass',freq:900,to:3000,q:2,dur:.3,attack:.02,gain:.2});}
    if(name==='bucket'){this.tone(460,{type:'triangle',dur:.35,gain:.12,pos,reverb:.2});this.tone(1120,{type:'sine',dur:.5,gain:.05,pos});this.burst(this.white,{type:'bandpass',freq:1500,q:1.5,dur:.2,gain:.25,pos});for(let i=0;i<4;i++)this.burst(this.brown,{type:'lowpass',freq:700,dur:.06,gain:.25,when:.12+i*.11,pos});}
    if(name==='gunshot'){// estalo supersônico, sopro da boca, estrondo grave, cauda longa e ecos batendo na água e na ilha
      const far=o.far?1:0,g=far?.45:1;
      this.burst(this.white,{type:'highpass',freq:3200,dur:.018,attack:.0005,gain:1.6*g,pos,reverb:.1});this.burst(this.white,{type:'bandpass',freq:1800,q:.6,dur:.05,attack:.0008,gain:1.1*g,pos,reverb:.3,when:.004});
      this.burst(this.brown,{type:'lowpass',freq:2200,to:140,dur:.42,attack:.0008,gain:2*g,pos,reverb:.8});this.burst(this.pink,{type:'bandpass',freq:420,q:.7,dur:.28,attack:.001,gain:.9*g,pos,reverb:.6});
      this.tone(78,{type:'sine',dur:.32,gain:.9*g,to:34,pos});this.tone(160,{type:'triangle',dur:.08,gain:.35*g,to:60,pos});
      [[.16,.42],[.38,.26],[.7,.16],[1.15,.09]].forEach(([w,k])=>this.burst(this.brown,{type:'lowpass',freq:700,to:160,dur:.55,attack:.01,gain:k*g,when:w+Math.random()*.05,reverb:.95}));}
    if(name==='boltUp')this.burst(this.white,{type:'bandpass',freq:2600,q:5,dur:.025,attack:.001,gain:.45,pos,reverb:.05});
    if(name==='boltBack'){this.burst(this.white,{type:'bandpass',freq:1700,to:2600,q:3,dur:.07,attack:.002,gain:.5,pos,reverb:.05});this.tone(900,{type:'square',dur:.02,gain:.05,pos});}
    if(name==='boltFwd'){this.burst(this.white,{type:'bandpass',freq:2400,to:1500,q:3,dur:.06,attack:.002,gain:.5,pos,reverb:.05});this.burst(this.white,{type:'bandpass',freq:3400,q:6,dur:.02,gain:.5,when:.06,pos});}
    if(name==='boltDown')this.burst(this.white,{type:'bandpass',freq:3000,q:6,dur:.03,attack:.001,gain:.55,pos,reverb:.05});
    if(name==='magOut'){this.burst(this.white,{type:'bandpass',freq:2200,q:4,dur:.03,gain:.45,pos});this.burst(this.pink,{type:'bandpass',freq:900,q:2,dur:.08,gain:.3,when:.03,pos});}
    if(name==='magDrop')this.burst(this.brown,{type:'lowpass',freq:500,dur:.12,attack:.002,gain:.4,pos,reverb:.2});
    if(name==='pouch')this.burst(this.pink,{type:'bandpass',freq:700,q:1.2,dur:.18,attack:.02,gain:.25,pos});
    if(name==='magIn'){this.burst(this.white,{type:'bandpass',freq:1600,q:3,dur:.05,gain:.6,pos});this.tone(420,{type:'triangle',dur:.05,gain:.12,pos});}
    if(name==='magSlap'){this.burst(this.white,{type:'bandpass',freq:1100,q:1.5,dur:.04,attack:.001,gain:.6,pos});this.burst(this.brown,{type:'lowpass',freq:300,dur:.08,gain:.4,pos});}
    if(name==='casing'){for(let i=0;i<3;i++)this.tone(3800+Math.random()*1500,{type:'sine',dur:.08,gain:.05/(i+1),when:i*.09+Math.random()*.03,pos});}
    if(name==='reveal'){// fanfarra que cresce com a raridade
      const tier=o.tier||0,now=this.ctx.currentTime,notes=[[72,76,79],[72,76,79,84],[72,76,79,84,88],[72,76,79,83,86,91],[72,76,79,84,88,91,96]][Math.min(4,tier)];
      notes.forEach((n,i)=>{this.pluck(n,now+i*.06,.3,(i%2?.3:-.3));this.tone(NOTE(n),{type:'triangle',dur:.25,gain:.05+tier*.015,when:i*.06,reverb:.5});});
      if(tier>=3){for(let i=0;i<14;i++)this.tone(2000+Math.random()*3000,{type:'sine',dur:.12,gain:.03,when:.3+Math.random()*.9,reverb:.6});this.burst(this.white,{type:'highpass',freq:6000,dur:1.2,attack:.2,gain:.08,reverb:.8});}}
    if(name==='junk'){const now=this.ctx.currentTime;[60,59,58,57].forEach((n,i)=>this.tone(NOTE(n),{type:'sawtooth',dur:.18,gain:.05,when:i*.16,to:NOTE(n)*.97}));this.pluck(48,now+.64,.25);}
    if(name==='coin'){const k=o.big?1.4:1;[0,.07,.14].forEach((w,i)=>this.tone([1976,2637,3136][i],{type:'square',dur:.12,gain:.05*k,when:w,reverb:.2}));}
    if(name==='cash'){this.burst(this.white,{type:'bandpass',freq:2500,q:2,dur:.05,gain:.4});this.tone(2093,{type:'triangle',dur:.6,gain:.18,when:.08,reverb:.4});this.tone(3136,{type:'sine',dur:.5,gain:.1,when:.1,reverb:.4});for(let i=0;i<10;i++)this.tone(2400+Math.random()*1800,{type:'sine',dur:.06,gain:.05,when:.2+i*.05});}
    if(name==='combo'){const n=o.level||1;this.tone(NOTE(72+n*4),{type:'square',dur:.09,gain:.06});this.tone(NOTE(79+n*4),{type:'square',dur:.12,gain:.05,when:.07});}
    if(name==='baly'){// lata abrindo: estalo, chiado do gás e a batida acelerada começa
      this.burst(this.white,{type:'highpass',freq:3000,dur:.05,attack:.001,gain:.8});this.burst(this.white,{type:'bandpass',freq:5000,to:2500,q:1,dur:.9,attack:.01,gain:.35,when:.04});
      for(let i=0;i<30;i++)this.tone(3000+Math.random()*4000,{type:'sine',dur:.02,gain:.03,when:.1+Math.random()*1.2});}
    if(name==='dive'){this.gullCall(pos,1.4);}
    if(name==='door')this.burst(this.pink,{type:'bandpass',freq:500,to:900,q:1,dur:.6,attack:.1,gain:.12,pos});
    if(name==='thud'){this.burst(this.brown,{type:'lowpass',freq:260,dur:.5,attack:.003,gain:1.1,pos,reverb:.4});this.creak();this.creak();}
    if(name==='alarm'){const now=this.ctx.currentTime;for(let i=0;i<6;i++)this.tone(i%2?740:988,{type:'sawtooth',dur:.28,gain:.08,when:i*.3,reverb:.5});}
    if(name==='gull'){const now=this.ctx.currentTime,g=this.out(pos,.4);for(let i=0;i<3;i++){const t=now+i*.22,o=this.ctx.createOscillator(),a=this.ctx.createGain(),base=1250+Math.random()*300;o.type='sawtooth';o.frequency.setValueAtTime(base,t);o.frequency.linearRampToValueAtTime(base*1.7,t+.05);o.frequency.exponentialRampToValueAtTime(base*.6,t+.2);const f=this.ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=2200;f.Q.value=2;o.connect(f).connect(a).connect(g);this.env(a,t,.01,.12,.2);o.start(t);o.stop(t+.25);}}
    if(name==='feathers'){this.burst(this.pink,{type:'bandpass',freq:1200,q:.7,dur:.25,attack:.005,gain:.5,pos});this.gull&&this.effect('gull',{pos});}
    if(name==='hitmark')this.tone(1800,{type:'square',dur:.05,gain:.08,reverb:0});
    // saída de chamada (o padeiro some): dois tons descendo, bem arredondados
    if(name==='leave'){[[659.3,0],[440,.13]].forEach(([f,w])=>{this.tone(f,{type:'sine',dur:.16,attack:.008,gain:.22,when:w,reverb:.1,pos});this.tone(f*2,{type:'sine',dur:.08,attack:.005,gain:.03,when:w,reverb:.1,pos});});}
    if(name==='join'){[[440,0],[659.3,.13]].forEach(([f,w])=>this.tone(f,{type:'sine',dur:.16,attack:.008,gain:.2,when:w,reverb:.1,pos}));}
    if(name==='puff'){this.burst(this.pink,{type:'lowpass',freq:900,to:200,dur:.5,attack:.01,gain:.35,pos,reverb:.2});}
    if(name==='blip')this.tone(520+Math.random()*120,{type:'square',dur:.025,attack:.002,gain:.025,reverb:0});
    if(name==='swing')this.burst(this.pink,{type:'bandpass',freq:500+(o.k||0)*400,to:900,q:3,dur:.18,attack:.05,gain:.12,pos});
    if(name==='ropeThrow')this.burst(this.pink,{type:'bandpass',freq:300,to:1600,q:2,dur:.5,attack:.03,gain:.3,pos});
    if(name==='ropeTie'){this.burst(this.brown,{type:'lowpass',freq:700,dur:.12,attack:.002,gain:.5,pos,reverb:.1});this.creak();this.tone(180,{type:'triangle',dur:.12,gain:.15,pos});}
    if(name==='ropeMiss')this.burst(this.white,{type:'bandpass',freq:1400,to:400,q:.8,dur:.5,gain:.4,pos,reverb:.3});
    if(name==='rescue'){const now=this.ctx.currentTime;[60,64,67,72].forEach((n,i)=>this.pluck(n,now+i*.08,.26,i%2?.3:-.3));}
    if(name==='shoo'){this.burst(this.pink,{type:'bandpass',freq:700,to:300,q:1.5,dur:.12,attack:.01,gain:.35,pos});}
    if(name==='song'){const now=this.ctx.currentTime;[67,71,74,79].forEach((n,i)=>this.pluck(n,now+i*.06,.25,0));}
    if(name==='rack'){this.burst(this.white,{type:'bandpass',freq:1500,q:3,dur:.08,gain:.35,pos});this.tone(220,{type:'triangle',dur:.1,gain:.2,pos});}
    if(name==='plop')this.tone(700,{type:'sine',dur:.12,gain:.25,to:180,pos});
    if(name==='bite'){this.tone(620,{type:'sine',dur:.1,gain:.3,to:160,pos});this.tone(520,{type:'sine',dur:.1,gain:.25,to:140,pos,when:.14});this.tone(1318,{type:'triangle',dur:.25,gain:.12,when:.02});}
    if(name==='tick')this.burst(this.white,{type:'highpass',freq:3500,dur:.012,attack:.001,gain:.08,reverb:0});
    if(name==='fish'){const now=this.ctx.currentTime;[67,71,74,79,83].forEach((n,i)=>this.pluck(n,now+i*.07,.28,i%2?.3:-.3));this.burst(this.white,{type:'bandpass',freq:1400,to:500,dur:.4,gain:.3,pos});}
    if(name==='escaped'){const now=this.ctx.currentTime;[64,62,59,55].forEach((n,i)=>this.pluck(n,now+i*.14,.2));}
    if(name==='step')this.burst(this.brown,{type:'lowpass',freq:260+Math.random()*80,dur:.07,attack:.002,gain:.28+Math.random()*.1,reverb:.05});
    if(name==='land'){this.burst(this.brown,{type:'lowpass',freq:220,dur:.16,attack:.002,gain:.6,reverb:.08});this.creak();}
    if(name==='helm'){this.tone(140,{type:'triangle',dur:.12,gain:.3,to:90});this.burst(this.white,{type:'bandpass',freq:900,q:3,dur:.06,gain:.2});}
    if(name==='thunder')this.thunder(o.distance||200);
    if(name==='shock'){// frente de choque passando pelo barco
      this.burst(this.brown,{type:'lowpass',freq:1600,to:60,dur:4.5,attack:.004,gain:1.4,reverb:.6});this.burst(this.white,{type:'lowpass',freq:6000,to:300,dur:1.4,attack:.002,gain:.8,reverb:.4});this.tone(48,{type:'sine',dur:5,gain:.9,to:22,reverb:.3});this.tone(32,{type:'triangle',dur:6,gain:.6,to:18,reverb:.2});
      for(let i=0;i<30;i++)this.burst(this.white,{type:'highpass',freq:1200+Math.random()*3000,dur:.04+Math.random()*.1,gain:.1+Math.random()*.2,when:.3+Math.random()*4,reverb:.4});
      // zumbido e audição abafada depois do estrondo
      const t=this.ctx.currentTime;this.muffle.frequency.cancelScheduledValues(t);this.muffle.frequency.setValueAtTime(20000,t);this.muffle.frequency.exponentialRampToValueAtTime(380,t+.25);this.muffle.frequency.setValueAtTime(380,t+2.5);this.muffle.frequency.exponentialRampToValueAtTime(20000,t+8);
      this.tinnitusGain.gain.cancelScheduledValues(t);this.tinnitusGain.gain.setValueAtTime(0,t+.2);this.tinnitusGain.gain.linearRampToValueAtTime(.035,t+.6);this.tinnitusGain.gain.exponentialRampToValueAtTime(.0001,t+7);}
    if(name==='flash'){this.burst(this.white,{type:'highpass',freq:8000,dur:.3,gain:.05});}
    if(name==='debris')this.burst(this.brown,{type:'lowpass',freq:500,dur:1.2,gain:.35,pos,reverb:.5});
    // ----- mercado e itens da Loja do Pescador -----
    if(name==='beep'){this.tone(2730,{type:'square',dur:.09,attack:.002,gain:.07,pos,reverb:.1});}
    if(name==='error'){this.tone(330,{type:'square',dur:.18,gain:.07,pos});this.tone(262,{type:'square',dur:.25,gain:.07,pos,when:.2});}
    if(name==='card'){this.tone(1568,{type:'sine',dur:.08,gain:.08,pos});this.tone(2093,{type:'sine',dur:.12,gain:.08,pos,when:.1});}
    if(name==='printer'){for(let i=0;i<22;i++)this.burst(this.white,{type:'bandpass',freq:2600+Math.random()*600,q:4,dur:.02,gain:.09,when:i*.035,pos});this.burst(this.white,{type:'highpass',freq:3000,dur:.08,gain:.1,when:.8,pos});}
    if(name==='gate'){const now=this.ctx.currentTime;for(let i=0;i<4;i++)this.tone(i%2?880:1175,{type:'square',dur:.16,gain:.06,when:i*.18,pos,reverb:.4});}
    if(name==='pick'){this.burst(this.pink,{type:'bandpass',freq:1100,q:1.5,dur:.08,gain:.2,pos});this.tone(520,{type:'triangle',dur:.06,gain:.05,pos});}
    if(name==='put'){this.burst(this.brown,{type:'lowpass',freq:700,dur:.1,gain:.35,pos});this.burst(this.pink,{type:'bandpass',freq:900,q:2,dur:.06,gain:.12,pos});}
    if(name==='cartDrop'){this.burst(this.white,{type:'bandpass',freq:1900,q:3,dur:.06,gain:.3,pos});for(let i=0;i<3;i++)this.tone(1600+Math.random()*900,{type:'triangle',dur:.12,gain:.03,when:.02+i*.04,pos});this.burst(this.brown,{type:'lowpass',freq:500,dur:.12,gain:.25,pos});}
    if(name==='cartGrab'){this.burst(this.white,{type:'bandpass',freq:2400,q:5,dur:.05,gain:.25,pos});for(let i=0;i<4;i++)this.tone(2200+Math.random()*1500,{type:'triangle',dur:.2,gain:.025,when:i*.03,pos});}
    if(name==='cartRoll'){const k=o.k||.5;this.burst(this.brown,{type:'lowpass',freq:260+k*200,dur:.3,attack:.05,gain:.12+k*.12,pos});if(Math.random()<.35)this.tone(1800+Math.random()*1400,{type:'triangle',dur:.08,gain:.015*k,pos});}
    if(name==='zip'){this.burst(this.white,{type:'bandpass',freq:1800,to:4200,q:3,dur:.3,attack:.02,gain:.18,pos});}
    if(name==='wrench'){for(let i=0;i<5;i++){this.burst(this.white,{type:'bandpass',freq:3200,q:6,dur:.03,gain:.25,when:i*.12,pos});this.tone(1200,{type:'triangle',dur:.05,gain:.04,when:i*.12,pos});}this.tone(880,{type:'triangle',dur:.6,gain:.06,when:.65,pos,reverb:.3});}
    if(name==='harpoon'){this.burst(this.white,{type:'bandpass',freq:900,to:3000,q:1,dur:.25,attack:.002,gain:.7,pos,reverb:.2});this.burst(this.pink,{type:'bandpass',freq:500,to:2500,q:2,dur:.7,gain:.25,when:.05,pos});this.tone(160,{type:'sine',dur:.2,gain:.3,to:60,pos});}
    if(name==='knife'){this.burst(this.white,{type:'bandpass',freq:4200,to:2500,q:4,dur:.18,gain:.2,pos});this.burst(this.brown,{type:'lowpass',freq:400,dur:.08,gain:.3,when:.15,pos});}
    if(name==='shutter'){this.burst(this.white,{type:'bandpass',freq:3500,q:3,dur:.03,gain:.5,pos});this.burst(this.white,{type:'bandpass',freq:2200,q:3,dur:.04,gain:.35,when:.06,pos});this.tone(4000,{type:'sine',dur:.4,gain:.02,to:6000,when:.1});}
    if(name==='flare'){this.burst(this.white,{type:'lowpass',freq:3000,to:400,dur:.3,attack:.002,gain:1,pos,reverb:.4});this.burst(this.pink,{type:'bandpass',freq:600,to:3000,q:2,dur:1.6,attack:.05,gain:.3,when:.1,pos,reverb:.5});this.burst(this.white,{type:'highpass',freq:4000,dur:6,attack:.5,gain:.05,when:.4,pos});}
    if(name==='sizzle'){this.burst(this.white,{type:'highpass',freq:3500,dur:2.2,attack:.05,gain:.18,pos});for(let i=0;i<14;i++)this.burst(this.white,{type:'bandpass',freq:5000,q:8,dur:.02,gain:.2,when:Math.random()*2,pos});}
    if(name==='gulp'){for(let i=0;i<3;i++)this.tone(220,{type:'sine',dur:.12,gain:.18,to:120,when:i*.28,pos});this.burst(this.pink,{type:'lowpass',freq:500,dur:.3,gain:.12,when:.9,pos});}
    if(name==='glug'){for(let i=0;i<7;i++)this.tone(300+Math.random()*120,{type:'sine',dur:.1,gain:.12,to:140,when:i*.14,pos});}
    if(name==='click')this.burst(this.white,{type:'bandpass',freq:2800,q:5,dur:.02,attack:.001,gain:.3,pos});
    if(name==='tent'){this.burst(this.pink,{type:'bandpass',freq:500,to:1300,q:1,dur:.6,attack:.1,gain:.3,pos});this.burst(this.brown,{type:'lowpass',freq:400,dur:.15,gain:.3,when:.6,pos});}
    if(name==='rattle'){for(let i=0;i<40;i++)this.burst(this.white,{type:'bandpass',freq:1400+Math.random()*800,q:6,dur:.02,gain:.12,when:i*.04,pos});this.tone(55,{type:'sine',dur:3,gain:.3,to:38,when:.4,reverb:.9});}
    if(name==='anchor'){for(let i=0;i<16;i++)this.burst(this.white,{type:'bandpass',freq:1800+Math.random()*600,q:5,dur:.03,gain:.2,when:i*.06,pos});this.burst(this.brown,{type:'lowpass',freq:600,dur:1,gain:.6,when:1,pos,reverb:.4});}
    if(name==='winch'){for(let i=0;i<30;i++)this.burst(this.white,{type:'bandpass',freq:2600,q:7,dur:.02,gain:.15,when:i*.11,pos});}
    if(name==='static'){this.burst(this.white,{type:'bandpass',freq:2500,q:.8,dur:.35,attack:.01,gain:.06});}
    if(name==='hit'){// a onda atinge: um único golpe e silêncio absoluto
      const t=this.ctx.currentTime;this.burst(this.white,{type:'lowpass',freq:3000,dur:.35,attack:.002,gain:1.5,reverb:0});this.burst(this.brown,{type:'lowpass',freq:400,dur:.4,attack:.002,gain:1.8,reverb:0});
      this.cut=true;this.master.gain.cancelScheduledValues(t);this.master.gain.setValueAtTime(this.muted?0:this.volume,t);this.master.gain.setValueAtTime(this.muted?0:this.volume,t+.12);this.master.gain.linearRampToValueAtTime(0,t+.16);
      this.revSend.gain.setValueAtTime(0,t+.16);}
  }
  thunder(distance){const delay=Math.min(distance/343,1.2+Math.random()*.4),near=Math.max(0,1-distance/260);
    if(near>.3)this.burst(this.white,{type:'highpass',freq:1800,dur:.25,attack:.001,gain:.6*near,when:delay,reverb:.6});
    for(let i=0;i<4;i++)this.burst(this.brown,{type:'lowpass',freq:900*(.4+near)-i*120,to:90,dur:2.2+Math.random()*2.5,attack:.05+i*.15,gain:(.7+near*.6)/(1+i*.4),when:delay+i*(.25+Math.random()*.5),reverb:.9});}
  sonicBoom(when){this.burst(this.brown,{type:'lowpass',freq:900,to:80,dur:1.2,attack:.003,gain:1.1,when,reverb:.8});this.burst(this.brown,{type:'lowpass',freq:900,to:80,dur:1.4,attack:.003,gain:.9,when:when+.22,reverb:.8});}
  gull(){const now=this.ctx.currentTime,pan=(Math.random()-.5)*1.4,base=1100+Math.random()*400,g=this.ctx.createStereoPanner();g.pan.value=pan;g.connect(this.bus);const r=this.ctx.createGain();r.gain.value=.4;g.connect(r).connect(this.revSend);
    for(let i=0;i<2+Math.floor(Math.random()*3);i++){const t=now+i*.28,o=this.ctx.createOscillator(),m=this.ctx.createOscillator(),mg=this.ctx.createGain(),a=this.ctx.createGain();o.type='triangle';m.frequency.value=38;mg.gain.value=90;m.connect(mg).connect(o.frequency);o.frequency.setValueAtTime(base,t);o.frequency.linearRampToValueAtTime(base*1.55,t+.06);o.frequency.exponentialRampToValueAtTime(base*.75,t+.22);o.connect(a).connect(g);this.env(a,t,.02,.03,.22);o.start(t);m.start(t);o.stop(t+.3);m.stop(t+.3);}}
  gullCall(pos,k=1){const now=this.ctx.currentTime,g=this.out(pos,.4);for(let i=0;i<4;i++){const t=now+i*.2,o=this.ctx.createOscillator(),a=this.ctx.createGain(),base=(1250+Math.random()*300)*k/1.2;o.type='sawtooth';o.frequency.setValueAtTime(base,t);o.frequency.linearRampToValueAtTime(base*1.8,t+.05);o.frequency.exponentialRampToValueAtTime(base*.55,t+.19);const f=this.ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=2300;f.Q.value=2;o.connect(f).connect(a).connect(g);this.env(a,t,.01,.16,.18);o.start(t);o.stop(t+.25);}}
  // batida eletrônica enquanto dura o efeito do Baly (150 bpm: bumbo, chimbal e baixo)
  balyBeat(active){if(!this.ctx)return;const now=this.ctx.currentTime;if(!active){this.balyNext=0;return;}if(!this.balyNext||this.balyNext<now)this.balyNext=now+.05;
    while(this.balyNext<now+.2){const t=this.balyNext,b=(this.balyStep=(this.balyStep||0)+1),step=60/150/2;this.balyNext+=step;
      if(b%2===0){const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.frequency.setValueAtTime(150,t);o.frequency.exponentialRampToValueAtTime(45,t+.12);o.connect(g).connect(this.bus);g.gain.setValueAtTime(.5,t);g.gain.exponentialRampToValueAtTime(.001,t+.16);o.start(t);o.stop(t+.2);}
      const s=this.ctx.createBufferSource(),f=this.ctx.createBiquadFilter(),g=this.ctx.createGain();s.buffer=this.white;f.type='highpass';f.frequency.value=8000;s.connect(f).connect(g).connect(this.bus);g.gain.setValueAtTime(b%2?.09:.05,t);g.gain.exponentialRampToValueAtTime(.001,t+.04);s.start(t,Math.random());s.stop(t+.05);
      if(b%4===1){const o=this.ctx.createOscillator(),g2=this.ctx.createGain(),fl=this.ctx.createBiquadFilter();o.type='sawtooth';o.frequency.value=[55,55,65.4,49][Math.floor(b/8)%4];fl.type='lowpass';fl.frequency.value=600;o.connect(fl).connect(g2).connect(this.bus);g2.gain.setValueAtTime(.12,t);g2.gain.exponentialRampToValueAtTime(.001,t+.3);o.start(t);o.stop(t+.32);}}}
  creak(){const now=this.ctx.currentTime,o=this.ctx.createOscillator(),f=this.ctx.createBiquadFilter(),g=this.ctx.createGain(),lfo=this.ctx.createOscillator(),lg=this.ctx.createGain(),base=90+Math.random()*140,d=.25+Math.random()*.5;o.type='sawtooth';o.frequency.setValueAtTime(base,now);o.frequency.linearRampToValueAtTime(base*(1+(Math.random()-.5)*.4),now+d);lfo.frequency.value=22+Math.random()*30;lg.gain.value=base*.3;lfo.connect(lg).connect(o.frequency);f.type='bandpass';f.frequency.value=600+Math.random()*700;f.Q.value=9;o.connect(f).connect(g).connect(this.out(null,.1));this.env(g,now,.05,.035,d);o.start(now);lfo.start(now);o.stop(now+d+.1);lfo.stop(now+d+.1);}
  // Linha do tempo do cataclismo, disparada pelo jogo
  impact(delay){if(!this.ctx||this.cut)return;this.effect('flash');}
  finalChord(){if(!this.ctx)return;// "até o último acorde": o som volta só para o acorde final
    this.cut=false;const t=this.ctx.currentTime;this.master.gain.cancelScheduledValues(t);this.master.gain.setValueAtTime(0,t);this.master.gain.linearRampToValueAtTime(this.muted?0:this.volume,t+.05);this.revSend.gain.setValueAtTime(.9,t);
    for(const b of [this.oceanL,this.oceanR,this.foam,this.wind,this.whistle,this.rain,this.rainLow,this.roar,this.roar2,this.tsunami,this.tsuHiss])b.gain.gain.setValueAtTime(0,t);this.motor.gain.gain.setValueAtTime(0,t);this.padChord([],t,0);
    this.muffle.frequency.cancelScheduledValues(t);this.muffle.frequency.setValueAtTime(20000,t);this.tinnitusGain.gain.cancelScheduledValues(t);this.tinnitusGain.gain.setValueAtTime(0,t);
    [43,50,55,59,62,67].forEach((n,i)=>this.pluck(n,t+.4+i*.045,.3,(i-2.5)*.12));this.cut=true;}
}

// Animação procedural por camadas. Nada é keyframe: tudo sai de fase de passada, molas e curvas de easing,
// o que dá peso (antecipação, exagero, acompanhamento) e reage à velocidade, curva, pulo e balanço do barco.
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const damp=(a,b,k,dt)=>a+(b-a)*(1-Math.exp(-k*dt));
const easeOut=t=>1-Math.pow(1-clamp(t),3),easeIn=t=>Math.pow(clamp(t),3),smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
const easeOutBack=t=>{t=clamp(t);const c=2.2;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2);};
export class Spring{constructor(k=160,d=14){this.x=0;this.v=0;this.k=k;this.d=d;}update(target,dt){const h=Math.min(dt,1/30);this.v+=((target-this.x)*this.k-this.v*this.d)*h;this.x+=this.v*h;return this.x;}kick(v){this.v+=v;}}
export class Animator{
  constructor(root){this.root=root;this.phase=0;this.speed=0;this.accel=0;this.turn=0;this.prevYaw=null;this.airT=0;this.grounded=true;
    this.land=new Spring(170,13);this.castT=9;this.hookT=9;this.crank=0;this.bend=0;this.tug=new Spring(220,9);this.headYaw=0;this.headPitch=0;this.idleLook=0;this.flinch=new Spring(200,10);this.rest=0;}
  castNow(){this.castT=0;}
  fire(){(this.recoil=this.recoil||new Spring(260,16)).kick(-7);}
  hookNow(){this.hookT=0;this.tug.kick(-6);}
  update(dt,o){
    const j=this.root.userData.joints,t=o.time||0;for(const g of Object.values(j))g.rotation.set(0,0,0);j.torso.position.y=.98;
    // ----- velocidade, aceleração e curva -----
    const prev=this.speed;this.speed=damp(this.speed,o.speed||0,9,dt);this.accel=damp(this.accel,(this.speed-prev)/Math.max(dt,1e-3),6,dt);
    if(this.prevYaw===null)this.prevYaw=o.yaw||0;let dy=(o.yaw||0)-this.prevYaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));this.prevYaw=o.yaw||0;this.turn=damp(this.turn,clamp(dy/Math.max(dt,1e-3),-8,8),8,dt);
    const run=this.speed>2,w=clamp(this.speed/1.5,0,1.35),cycle=run?2.2:1.45;this.phase+=dt*Math.PI*2*this.speed/cycle;const p=this.phase;
    const strafe=clamp(o.strafe||0,-1,1),fwd=1-Math.abs(strafe)*.6,A=(run?.7:.5)*Math.min(w,1.2);
    // ----- pernas: balanço, joelho na fase aérea, passo lateral -----
    // passada assimétrica: a coxa sobe mais à frente do que estende atrás; joelho dobra na fase aérea
    const hipL=-Math.sin(p),hipR=Math.sin(p),sw=h=>h<0?h:h*.5;
    j.thighL.rotation.x=sw(hipL)*A*fwd-.04*w;j.thighR.rotation.x=sw(hipR)*A*fwd-.04*w;
    j.shinL.rotation.x=Math.max(0,Math.cos(p))*A*1.45+.08*w;j.shinR.rotation.x=Math.max(0,-Math.cos(p))*A*1.45+.08*w;
    j.thighL.rotation.z=-Math.sin(p)*A*.5*strafe;j.thighR.rotation.z=Math.sin(p)*A*.5*strafe;
    // ----- quadril e tronco -----
    const bob=Math.cos(2*p)*.024*Math.min(w,1.2);
    j.torso.rotation.y=Math.sin(p)*.11*w;j.torso.rotation.z=Math.sin(p)*.035*w;
    j.torso.rotation.x=.05*w+(run?.1:0)+clamp(this.accel*.05,-.12,.14);
    j.torso.rotation.z+=clamp(-this.turn*.035*Math.min(1,w+.2),-.14,.14)-(o.roll||0)*.55;
    // ----- braços opostos às pernas -----
    j.armL.rotation.x=Math.sin(p)*(run?.7:.42)*w;j.armR.rotation.x=-Math.sin(p)*(run?.7:.42)*w;
    j.foreL.rotation.x=-(.18+.3*w+(run?.55:0))-Math.max(0,-Math.sin(p))*.35*w;j.foreR.rotation.x=-(.18+.3*w+(run?.55:0))-Math.max(0,Math.sin(p))*.35*w;
    j.armL.rotation.z=.2-.05*w;j.armR.rotation.z=-.2+.05*w;j.foreL.rotation.z=-.08;j.foreR.rotation.z=.08;
    // ----- ocioso: respiração, troca de peso, olhar vagando -----
    const idle=1-clamp(w*2),breathe=Math.sin(t*1.7)*.02;
    j.torso.rotation.x+=breathe*.4*idle;j.torso.rotation.z+=Math.sin(t*.45)*.018*idle;j.armL.rotation.z-=breathe*idle;j.armR.rotation.z+=breathe*idle;
    j.thighL.rotation.z+=Math.sin(t*.45)*.02*idle;j.thighR.rotation.z+=Math.sin(t*.45)*.02*idle;
    // ----- pulo e aterrissagem com mola -----
    if(!o.grounded){this.airT+=dt;const k=smooth(this.airT/.18);j.thighL.rotation.x=-.75*k;j.thighR.rotation.x=-.25*k;j.shinL.rotation.x=1.1*k;j.shinR.rotation.x=.55*k;j.armL.rotation.z=-.7*k;j.armR.rotation.z=.7*k;j.armL.rotation.x=-.3*k;j.armR.rotation.x=-.3*k;}
    else if(!this.grounded){this.land.kick(-2.2-Math.min(this.airT,1)*2);this.airT=0;}
    this.grounded=!!o.grounded;const sq=this.land.update(0,dt);
    j.torso.position.y+=bob+sq*.06;j.thighL.rotation.x+=sq*.6;j.thighR.rotation.x+=sq*.6;j.shinL.rotation.x-=sq*1.1;j.shinR.rotation.x-=sq*1.1;j.torso.rotation.x-=sq*.25;
    // ----- leme -----
    if(o.drive){j.armL.rotation.x=-1.0;j.armR.rotation.x=-1.0;j.foreL.rotation.x=-.5;j.foreR.rotation.x=-.5;j.armL.rotation.z=.3+(o.steer||0)*.25;j.armR.rotation.z=-.3+(o.steer||0)*.25;j.torso.rotation.x+=.08;}
    // ----- pesca -----
    const rod=this.root.userData.rod,segs=this.root.userData.rodSegs;const fishing=o.fishing&&o.fishing!=='idle';this.castT+=dt;this.hookT+=dt;
    rod.visible=fishing||this.castT<1;let bend=0;
    if(rod.visible){
      const tension=o.tension||0,reeling=o.fishing==='reeling';
      let ax=-.8,fx=-.62;
      // arremesso: antecipação para trás, chicote, acomodação
      if(this.castT<1){const c=this.castT;if(c<.38){const e=easeOut(c/.38);ax=-.8-1.7*e;j.torso.rotation.y+=.3*e;j.torso.rotation.x-=.12*e;bend=-.25*e;}else if(c<.52){const e=easeIn((c-.38)/.14);ax=-2.5+2.2*e;j.torso.rotation.y+=.3-.45*e;j.torso.rotation.x+=-.12+.28*e;bend=-.25+1.1*e;}else{const e=easeOutBack((c-.52)/.48);ax=-.3-.5*e;j.torso.rotation.y+=-.15*(1-e);j.torso.rotation.x+=.16*(1-e);bend=.85*(1-e)-.2*Math.sin((c-.52)*30)*(1-e);}}
      // fisgada: puxão para cima
      if(this.hookT<.6){const e=Math.sin(clamp(this.hookT/.6)*Math.PI);ax-=.9*e;j.torso.rotation.x-=.18*e;}
      const tug=this.tug.update(0,dt);
      if(o.fishing==='bite')bend+=.35+Math.sin(t*38)*.12;
      if(reeling){this.crank+=dt*(o.reelHeld?15:3.5);ax+=tension*.45+tug*.1;j.torso.rotation.x-=.1+tension*.16;j.thighL.rotation.x-=.12;j.shinL.rotation.x+=.2;const shake=(Math.sin(t*47)+Math.sin(t*31.3))*.025*tension;ax+=shake;j.torso.rotation.z+=shake*.6;bend+=.25+tension*.95+Math.max(0,-tug)*.15;}
      else if(o.fishing==='waiting')bend+=.12+Math.sin(t*2.3)*.03;
      // braço da vara (esquerdo do modelo = direita da tela em primeira pessoa) e braço do molinete
      j.armL.rotation.x=ax;j.armL.rotation.z=-.12;j.foreL.rotation.x=fx;
      j.armR.rotation.x=-.55+(reeling?Math.sin(this.crank)*.12:0);j.armR.rotation.z=-.4;j.foreR.rotation.x=-1.05+(reeling?Math.cos(this.crank)*.18:0);j.foreR.rotation.y=-.35;
      this.root.userData.crank.rotation.x=this.crank;
    }
    this.bend=damp(this.bend,bend,14,dt);segs.forEach((s,i)=>{s.rotation.x=this.bend*(.08+i*.05);});
    // ----- rifle: coronha no ombro, mão de apoio no guarda-mão, mira segue o olhar, recuo com mola -----
    if(o.rifle){const aim=this.aim=damp(this.aim||0,o.aim?1:0,10,dt),pitch=clamp(o.pitch||0,-.9,1.1),rc=this.recoil=(this.recoil||new Spring(260,16));const r=rc.update(0,dt);
      j.armL.rotation.x=-1.3-pitch*.85-aim*.12+r*.35;j.armL.rotation.z=-.08;j.foreL.rotation.x=-.45;j.armR.rotation.x=-1.4-pitch*.85+r*.3;j.armR.rotation.z=-.55;j.foreR.rotation.x=-.25;j.foreR.rotation.y=-.35;
      j.torso.rotation.y+=.18;j.torso.rotation.x+=-r*.08;j.head.rotation.y-=.12;const gun=this.root.userData.gun;if(gun)gun.visible=!o.hideGun;this.root.userData.rod.visible=false;}
    else if(this.root.userData.gun)this.root.userData.gun.visible=false;
    // ----- tapa: antecipação, golpe rápido, acompanhamento com sobra -----
    if(o.slap>0){const k=1-o.slap;
      // mão do tapa: o braço que aparece à direita da tela em primeira pessoa (esquerdo do modelo)
      if(k<.3){const e=easeOut(k/.3);j.armL.rotation.x=-1.2*e;j.armL.rotation.z=-1.2*e;j.armL.rotation.y=.7*e;j.foreL.rotation.x=-1.3*e;j.torso.rotation.y-=.5*e;j.torso.rotation.x-=.06*e;j.head.rotation.y+=.2*e;}
      else if(k<.44){const s=easeIn((k-.3)/.14);j.armL.rotation.x=-1.2-.15*s;j.armL.rotation.z=-1.2+.75*s;j.armL.rotation.y=.7-2.1*s;j.foreL.rotation.x=-1.3+1.2*s;j.torso.rotation.y-=.5-1.15*s;j.torso.rotation.x+=.08*s;}
      else{const f=(k-.44)/.56,a=Math.pow(1-f,2),osc=Math.sin(f*9)*(1-f)*.15;j.armL.rotation.x=-1.35*a;j.armL.rotation.z=-.45*a;j.armL.rotation.y=-1.4*a-osc;j.foreL.rotation.x=-.1*a;j.torso.rotation.y-=-.65*a+osc*.5;}
    }
    // ----- tomou um susto (quando o outro erra o tapa por perto) -----
    const fl=this.flinch.update(0,dt);j.torso.rotation.x+=fl*.2;j.head.rotation.x+=fl*.3;
    // ----- abraço e beijo -----
    if(o.embrace>0){const e=o.embrace;rod.visible=false;j.armL.rotation.x=-1.25*e;j.armR.rotation.x=-1.3*e;j.armL.rotation.z=-.3*e;j.armR.rotation.z=.3*e;j.foreL.rotation.y=.9*e;j.foreR.rotation.y=-.9*e;j.foreL.rotation.x=-.5*e;j.foreR.rotation.x=-.5*e;j.head.rotation.z=(o.kiss||0)*.16;j.head.rotation.x=(o.kiss||0)*.12;j.torso.rotation.x=(o.kiss||0)*.05;}
    // ----- cabeça: estabiliza contra o tronco e olha para o alvo (já limitado a ±60°) -----
    const look=o.look;this.idleLook=damp(this.idleLook,Math.sin(t*.31+this.root.userData.index*2)*.25*idle,1.5,dt);
    this.headYaw=damp(this.headYaw,look?look.yaw:this.idleLook+clamp(this.turn*.08,-.35,.35),look?7:4,dt);this.headPitch=damp(this.headPitch,look?look.pitch:0,6,dt);
    // além de ~63°, o resto da virada vai para o tronco (pescoço não gira como coruja)
    const neck=1.1,extra=Math.sign(this.headYaw)*Math.max(0,Math.abs(this.headYaw)-neck);j.torso.rotation.y+=extra*.85;
    j.head.rotation.y+=this.headYaw-extra*.85-j.torso.rotation.y*.85+extra*.85*.85;j.head.rotation.x+=-(o.pitch||0)*.7+this.headPitch-j.torso.rotation.x*.5;j.head.rotation.z-=j.torso.rotation.z*.6;
  }
}
// Olhar entre personagens: vira se o outro estiver à frente ou de lado (cone de 140°), com trava de 100°;
// a partir de ~63° a torção é dividida com o tronco. Atrás das costas, volta para frente.
export const LOOK_LIMIT=Math.PI*100/180,LOOK_CONE=Math.PI*140/180;
export function lookAngles(fromPos,fromYaw,toPos){
  const dx=toPos.x-fromPos.x,dz=toPos.z-fromPos.z,dy=toPos.y-fromPos.y,dist=Math.hypot(dx,dz);if(dist>7||dist<.2)return null;
  let yaw=Math.atan2(dx,dz)-fromYaw;yaw=Math.atan2(Math.sin(yaw),Math.cos(yaw));if(Math.abs(yaw)>LOOK_CONE)return null;
  return {yaw:clamp(yaw,-LOOK_LIMIT,LOOK_LIMIT),pitch:clamp(-Math.atan2(dy,dist),-.45,.45)};
}

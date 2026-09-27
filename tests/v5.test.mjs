import test from 'node:test';
import assert from 'node:assert/strict';
import {ROPE,ropeWindow,ropeAngle,ropeHit,driftAt,Shoo,inputPacket,CONFIG} from '../src/core.js';
import {SONGS,GuitarHero} from '../src/guitar.js';

test('Laço: janela larga perto, estreita longe, e nada além do alcance máximo',()=>{
  assert.ok(ropeWindow(3)>ropeWindow(12));assert.ok(ropeWindow(12)>ropeWindow(ROPE.max));
  assert.equal(ropeHit(0,5),true);// laço na frente, perto
  assert.equal(ropeHit(Math.PI/ROPE.omega,5),false);// laço atrás
  assert.equal(ropeHit(0,ROPE.max+1),false);
  assert.ok(Math.abs(ropeAngle(Math.PI*2/ROPE.omega))<1e-6);
});
test('Deriva: na tempestade o barco solto vai bem mais longe que na calmaria',()=>{
  const speed=s=>{let sum=0;for(let t=0;t<600;t+=5){const d=driftAt(t,s);sum+=Math.hypot(d.x,d.z);}return sum;};
  assert.ok(speed(1)>speed(0)*5);
});
test('Espantar a gaivota: sem reagir ela leva o peixe; seguindo a faixa dá para ganhar',()=>{
  const idle=new Shoo(()=>.3);idle.start();let r=null;for(let i=0;i<60*10&&!r;i++)r=idle.step(1/60,false);assert.equal(r,'lose');
  const pro=new Shoo(()=>.3);pro.start();r=null;for(let i=0;i<60*10&&!r;i++)r=pro.step(1/60,pro.needle+pro.vel*.25<pro.target);assert.equal(r,'win');
});
test('Violão: músicas de todas as dificuldades e tocar perfeito acerta todas as notas',()=>{
  assert.ok(SONGS.length>=12);for(const t of ['facil','medio','dificil','extremo'])assert.ok(SONGS.some(s=>s.tier===t),t);for(const s of SONGS){assert.ok(s.notes.length>10,s.name);assert.ok(s.chords.every(c=>c.length===3));}
  const g=new GuitarHero();g.start();g.play(0);let played=0,finished=null;
  for(let i=0;i<60*80&&!finished;i++){const pressed=[];for(const n of g.notes){if(!n.hit&&Math.abs(n.time-g.t)<.009)pressed.push(n.lane);if(n.pair!==undefined&&!n.hitPair&&n.hit&&Math.abs(n.time-g.t)<.009)pressed.push(n.pair);}const out=g.update(1/60,pressed);played+=out.play.length;if(out.finished)finished=out.finished;}
  assert.ok(finished);assert.ok(finished.acc>.95,String(finished.acc));assert.ok(played>0);g.stop();
});
test('Pacote de entrada: corda, espantar e notas do violão ficam limitados',()=>{
  const p=inputPacket({throwAt:999,throwOk:1,shoo:7,strum:[60,64,67,500,-3,1,2,3,4,5]});
  assert.equal(p.throwAt,200);assert.equal(p.throwOk,true);assert.equal(p.shoo,2);assert.equal(p.strum.length,8);assert.ok(p.strum.every(n=>n>=0&&n<=127));
  assert.equal(inputPacket({}).throwAt,-1);assert.equal(CONFIG.maxPlayers,5);
});

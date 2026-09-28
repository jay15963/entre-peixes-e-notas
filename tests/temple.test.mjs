import test from 'node:test';
import assert from 'node:assert/strict';
import {L1T,l1Glyph,l1Cell,BLADE_G,BUTTONS,BUTTON_ORDER,MIRRORS,MIRROR_START,beamPath,ROOMS,LEVELS} from '../src/volcano.js';

test('nível 1: o caminho da lua liga a entrada ao fundo sem diagonais e é o único glifo seguro', () => {
  const path=new Set(L1T.path.map(([r,c])=>r+','+c));
  assert.ok(L1T.path.some(([r])=>r===0)&&L1T.path.some(([r])=>r===L1T.rows-1));
  for(let i=1;i<L1T.path.length;i++){const [a,b]=L1T.path[i-1],[c,d]=L1T.path[i];assert.equal(Math.abs(a-c)+Math.abs(b-d),1,'passo sem diagonal');}
  for(let r=0;r<L1T.rows;r++)for(let c=0;c<L1T.cols;c++)assert.equal(l1Glyph(r,c)===L1T.safe,path.has(r+','+c));
  assert.deepEqual(l1Cell(L1T.x0,L1T.z0).map(v=>v||0),[0,0]);assert.equal(l1Cell(40,-21.5),null);
});

test('nível 2: a ordem dos botões é a ordem dos glifos das lâminas', () => {
  assert.equal(new Set(BUTTON_ORDER).size,4);
  BUTTON_ORDER.forEach((b,i)=>assert.equal(BUTTONS[b].g,BLADE_G[i]));
});

test('nível 3: começa sem luz no sol e tem solução com giros de 45°', () => {
  assert.equal(beamPath(MIRROR_START).hit,false);
  let found=null;for(let n=0;n<8**MIRRORS.length&&!found;n++){const m=MIRRORS.map((_,i)=>Math.floor(n/8**i)%8);if(beamPath(m).hit)found=m;}
  assert.ok(found,'existe uma combinação que leva a luz ao disco');
  assert.equal(beamPath([6,5,3,3]).hit,true);
});

test('nível 4: o estrado do altar é piso (degraus de no máximo 0,6 m)', () => {
  const dais=ROOMS.filter(r=>r.dais).map(r=>r.f);assert.equal(dais.length,3);
  [LEVELS[3],...dais].reduce((a,b)=>{assert.ok(b-a<=.6);return b;});
});

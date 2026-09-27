import test from 'node:test';
import assert from 'node:assert/strict';
import {ITEMS,ITEM_IDS,REMOVED,fishingMods,PREDATORS,addItem,cannotAdd,consume,slotsOf} from '../src/store.js';
import {Fishing} from '../src/core.js';
import {CATCHES} from '../src/catalog.js';

test('Loja: 45 itens à venda, sem os que dependiam de vida, frio, casco ou alagamento',()=>{
  assert.equal(ITEM_IDS.length,45);for(const id of ['medkit','flask','repair','pump','tent']){assert.ok(REMOVED.has(id));assert.equal(ITEMS[id],undefined);}
  for(const id of ITEM_IDS){const it=ITEMS[id];assert.ok(it.price>0&&it.rule&&it.kind,id);assert.ok(!/vida|frio|porão|alag|resistência/i.test(it.rule),id+': '+it.rule);}
});
test('Mochila: 8 espaços, +4 com a mochila estanque, iscas somam usos e acabam',()=>{
  const p={inv:[]};for(let i=0;i<8;i++)assert.equal(addItem(p,['rod','reel','net','gaff','knife','pliers','line','scale'][i]),null);
  assert.equal(cannotAdd(p,'compass'),'Mochila cheia.');assert.equal(slotsOf(p),8);
  const q={inv:[]};addItem(q,'lure');addItem(q,'lure');assert.equal(q.inv[0][1],10);q.bait='lure';for(let i=0;i<10;i++)consume(q,'lure');assert.equal(q.inv.length,0);assert.equal(q.bait,null);
});
test('Iscas e vara mudam o sorteio e a briga do peixe',()=>{
  const base=fishingMods({}),lure=fishingMods({inv:new Set(['rod','reel']),bait:'lure'});
  for(const i of PREDATORS)assert.equal(lure.w[i],base.w[i]*3);assert.ok(lure.reel>1&&lure.tension<1&&lure.heavy<1);
  assert.equal(base.w[CATCHES.findIndex(c=>c.name==='Lagosta')],0,'lagosta só vem da armadilha');
  const f=new Fishing(()=>.5);f.cast({...base,w:base.w.map((w,i)=>i===PREDATORS[0]?1:0)});assert.equal(f.species,PREDATORS[0]);
  f.phase='reeling';f.assist(2);let r=null;for(let k=0;k<5&&!r;k++)r=f.step(1/60,true,0);assert.equal(r,'caught','passaguá/bicheiro tiram o peixe da água');
});

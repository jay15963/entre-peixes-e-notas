import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Market,NEW_MARKET,CART_MAX,SCAN_TIME} from '../src/market.js';
import {Gear,NEW_EQ,newStatus} from '../src/items.js';
import {ITEMS} from '../src/store.js';
import {ISLAND,SHOP} from '../src/terrain.js';
import {NessieFight,MAX_HP} from '../src/nessie-fight.js';

function marketFixture(){
  const p={id:0,net:0,x:ISLAND.x,z:ISLAND.z+8,height:SHOP.floor,land:1,mode:'walk',yaw:0,tp:0,...newStatus()};
  const events=[],c={world:{mk:NEW_MARKET(),eq:NEW_EQ(),money:1000},players:[p],localId:0,elapsed:10,
    boatState:{x:200,z:0},island:{collide:(x,z)=>[x,z]},ground:()=>SHOP.floor,
    worldOf:(q,h=0)=>new THREE.Vector3(q.x,q.height+h,q.z),worldYaw:q=>q.yaw,
    shopLanes:[{u:0,v:8,scan:[0,2,8],pay:[0,2,8]}],
    stateEvent:(name,e)=>events.push(e),toastFor(){},toast(){},sound:{effect(){}},
    handsFree:q=>!q.hold&&q.cartH<0&&q.ride<0,me:()=>p};
  c.gear=new Gear(c);const market=new Market(c);c.market=market;
  const cart=c.world.mk.carts[0];Object.assign(cart,{x:p.x,z:p.z+1,h:0});p.cartH=0;
  const item=id=>({u:c.world.mk.uid++,id,s:0});
  return {p,c,market,cart,item,events};
}

test('Carrinho: itens não pagos bloqueiam a porta, pagos liberam a saída',()=>{
  const {p,market,cart,item}=marketFixture();cart.it.push(item('rod'));p.z=ISLAND.z+SHOP.v0+1.5;p.yaw=Math.PI;
  assert.equal(market.canMove(p,p.x,ISLAND.z+SHOP.v0+.8),false);
  cart.it[0].s=1;assert.equal(market.canMove(p,p.x,ISLAND.z+SHOP.v0+.8),false,'escaneado ainda não é pago');
  cart.it[0].s=2;assert.equal(market.canMove(p,p.x,ISLAND.z+SHOP.v0-.2),true);
});
test('Carrinho: girar parado e levar passageiro não contorna o bloqueio',()=>{
  const {p,c,market,cart,item}=marketFixture();p.z=ISLAND.z+SHOP.v0+.7;p.yaw=Math.PI;
  Object.assign(cart,{x:p.x,z:p.z+1,yaw:0});const before=[cart.x,cart.z];
  c.players.push({...newStatus(),id:1,ride:0,hold:item('rod'),mode:'ride'});
  market.hostTick(1);assert.deepEqual([cart.x,cart.z],before);assert.equal(market.unpaid(p),true);
});
test('Carrinho cheio recusa item também pelo puxador, sem perder a mão',()=>{
  const {p,market,cart,item}=marketFixture();p.cartH=-1;cart.h=-1;cart.it=Array.from({length:CART_MAX},()=>item('rod'));p.hold=item('reel');
  market.interact(p,60);assert.equal(cart.it.length,CART_MAX);assert.equal(p.hold.id,'reel');
});
test('Autoatendimento exige leitura, limita repetição e cobra uma única vez',()=>{
  const {p,c,market,cart,item}=marketFixture();cart.it.push(item('rod'),item('reel'));
  market.pay(p);assert.equal(c.world.money,1000);
  market.scan(p);market.scan(p);assert.deepEqual(cart.it.map(q=>q.s),[1,0]);
  c.elapsed+=SCAN_TIME+.01;market.scan(p);market.pay(p);
  assert.equal(c.world.money,1000-ITEMS.rod.price-ITEMS.reel.price);assert.equal(cart.it.length,0);
  assert.deepEqual(p.inv.map(q=>q[0]),['rod','reel']);const paid=c.world.money;market.pay(p);assert.equal(c.world.money,paid);
});
test('Saldo insuficiente não libera mercadoria e caixa abandonado desfaz leituras',()=>{
  const {p,c,market,cart,item}=marketFixture();cart.it.push(item('rod'));market.scan(p);c.world.money=0;market.pay(p);
  assert.equal(cart.it[0].s,1);assert.equal(p.inv.length,0);p.x+=20;c.elapsed+=4;market.hostTick(.1);
  assert.equal(cart.it[0].s,0);assert.equal(c.world.mk.lanes[0].o,-1);
});
test('Mercadoria transferida para outra mão ou chão não duplica ao pagar',()=>{
  const {p,c,market,cart,item}=marketFixture();cart.it.push(item('rod'),item('reel'));market.scan(p);c.elapsed+=1;market.scan(p);
  const q={...newStatus(),id:1,hold:cart.it.shift()};c.players.push(q);c.world.mk.ground.push(cart.it.pop());
  market.pay(p);assert.equal(q.hold,null);assert.equal(c.world.mk.ground.length,0);assert.equal(p.inv.length,2);
});

function fightFixture(stage=3){
  // Exercise the real authority simulation without spending GPU time on visual effects.
  const f=Object.create(NessieFight.prototype);f.reset(0,0);f.stage=stage;f.alive=true;f.time=0;f.events=[];f.walls=[];
  f.boat={x:0,z:0,vx:0,vz:0,heading:0};f.emit=e=>f.events.push(e);
  f.headWorld=()=>new THREE.Vector3(f.S.x,8,f.S.z);
  f.rig={head:{localToWorld:v=>v.add(new THREE.Vector3(f.S.x,8,f.S.z))}};
  return f;
}
function runAttack(name,moving){const f=fightFixture();f.startAttack(name);const hits=[];let x=0,speed=0;
  for(let t=0;t<7&&f.attack.name===name;t+=1/60){if(moving&&t>1){speed=Math.min(5,speed+(2.2-speed*.24)/60);x+=speed/60;}
    hits.push(...f.simulate(1/60,{x,z:0,vx:speed,vz:0,heading:Math.PI/2}).filter(e=>e.k==='boatHit'));}
  return hits;
}
for(const name of ['tail','bite','cannon'])test(`Nessie ${name}: barco básico escapa com reação de 1 s, parado recebe dano`,()=>{
  assert.ok(runAttack(name,false).length>0);assert.equal(runAttack(name,true).length,0);
});
test('Nessie: avisos, velocidade e pausas permitem reagir no último estágio',()=>{
  const f=fightFixture();f.startAttack('tripleRam');assert.equal(f.attack.count,2);assert.ok(f.attack.warn>=3.2);
  assert.equal(f.warningData().length,4);assert.ok(12*f.speedK()<=12.600001);
  f.lastName='whirlpool';assert.equal(f.nextAttack(),'cruise');f.startAttack('cruise');assert.ok(f.attack.dur>=4.7);
});
test('Nessie: dano progride de estágio sem invulnerabilidade por sequência pendente',()=>{
  const f=fightFixture(1);f.startAttack('cruise');f.hp=MAX_HP*.66+5;const events=f.damage('eye');
  assert.equal(f.stage,2);assert.ok(f.hp<MAX_HP*.66);assert.ok(events.some(e=>e.k==='stage'));
  f.stage=3;f.hp=1;f.damage('body');assert.equal(f.dead,true);assert.equal(f.hp,0);
});

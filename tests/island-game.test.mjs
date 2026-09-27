import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {storyTime,weatherAt,CONFIG,Fishing,inputPacket} from '../src/core.js';
import {groundHeight,terrainHeight,ISLAND,DOCK,BERTH,SHOP} from '../src/terrain.js';
import {CATCHES,catchValue,BALY,TIERS} from '../src/catalog.js';
import {GullFlock} from '../src/gulls.js';

test('Jogo infinito: clima alterna calmaria e tempestade até o anfitrião chamar o meteoro',()=>{
  for(let t=0;t<2000;t+=7){const s=storyTime(t,null);assert.ok(s<CONFIG.asteroidAt,'sem meteoro sem TAB');}
  assert.equal(weatherAt(storyTime(10,null)).phase,'sunset');assert.ok(weatherAt(storyTime(260,null)).storm>.9,'tempestade no ciclo');assert.equal(weatherAt(storyTime(330+10,null)).phase,'sunset');
  const trig={at:500,from:storyTime(500,null)};assert.equal(storyTime(500+CONFIG.rampTime,trig),CONFIG.asteroidAt);
  assert.equal(storyTime(500+CONFIG.rampTime+(CONFIG.impactAt-CONFIG.asteroidAt),trig),CONFIG.impactAt);
});
test('Ilha: cais e vila são chão firme, o mar em volta é fundo e a vaga do barco está livre',()=>{
  const I=ISLAND;assert.ok(groundHeight(I.x,I.z+DOCK.v0+2)>.7,'ponta do cais');assert.ok(Math.abs(groundHeight(I.x,I.z-30)-I.plateau)<.01,'rua');
  assert.equal(groundHeight(I.x,I.z+15),SHOP.floor,'piso do mercado');assert.ok(terrainHeight(I.x+BERTH.u,I.z+BERTH.v)<-1.5,'água funda na vaga');
  assert.ok(groundHeight(I.x+150,I.z)<-5,'mar aberto');
});
test('Catálogo: peixes valem por kg, tesouros valem fixo, lixo não vale nada e existe a lata de Baly',()=>{
  assert.ok(CATCHES.length>=25);for(const c of CATCHES)assert.ok(TIERS[c.tier],c.name);
  const robalo=CATCHES.findIndex(c=>c.name==='Robalo');assert.equal(catchValue(robalo,2),84);
  assert.equal(catchValue(CATCHES.findIndex(c=>c.name==='Bota velha'),.6),0);assert.equal(CATCHES[BALY].shape,'baly');
});
test('Combo na faixa verde acelera a pesca e o Baly acelera ainda mais',()=>{
  // quadros até pegar o peixe mantendo a marca sempre na faixa (combo máximo)
  const run=boost=>{const f=new Fishing(()=>.5);f.cast();f.phase='reeling';f.species=1;let t=0;for(let i=0;i<3000;i++){f.target=.5;f.needle=.5;f.vel=0;f.run=1;if(f.step(1/60,false,t+=1/60,boost)==='caught')return i;}return 1e9;};
  const noCombo=(()=>{const f=new Fishing(()=>.5);f.cast();f.phase='reeling';f.species=1;let t=0;for(let i=0;i<3000;i++){f.target=.5;f.needle=.5;f.vel=0;f.run=1;f.combo=0;if(f.step(1/60,false,t+=1/60)==='caught')return i;}return 1e9;})();
  const plain=run(false),baly=run(true);assert.ok(plain<noCombo*.8,`combo ${plain} < ${noCombo}`);assert.ok(baly<plain*.75,`baly ${baly} < ${plain}`);
});
test('Gaivotas: circulando lá no alto não podem ser atingidas; só a ladra (mergulho, balde, fuga com peixe)',()=>{
  const flock=new GullFlock(new THREE.Group(),new THREE.Vector3(.6,0,1.2),4);let bucket=5,sawThief=false,stole=false;
  for(let i=0;i<60*90;i++){const t=i/60;bucket=flock.simulate(1/60,{active:true,bucketCount:bucket,time:t,water:()=>-.2});
    for(const g of flock.gulls){if(g.state==='circle'){assert.ok(g.pos.y>18,'alto');assert.equal(flock.thief(g),false);assert.equal(flock.kill(g.id),null);}
      if(flock.thief(g))sawThief=true;if(g.state==='flee'&&g.fish){stole=true;assert.ok(g.vel.length()<4.5,'lenta com o peixe');}}
    flock.events.length=0;}
  assert.ok(sawThief,'alguma ladra apareceu');assert.ok(stole,'alguma roubou');
  const calm=new GullFlock(new THREE.Group(),new THREE.Vector3(),2);for(let i=0;i<60*60;i++)calm.simulate(1/60,{active:false,bucketCount:3,time:i/60,water:()=>-.2});assert.ok(calm.gulls.every(g=>!calm.thief(g)),'na tempestade (inativas) ninguém ataca');
});
test('Pacote de entrada aceita posição em terra (mundo) do convidado',()=>{const p=inputPacket({px:12,pz:130,ph:1.7,land:1});assert.equal(p.pz,130);assert.equal(p.land,1);});

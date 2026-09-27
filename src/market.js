import * as THREE from 'three';
import {Kit,box,limb,loft,V} from './geometry.js';
import {ISLAND,SHOP} from './terrain.js';
import {ITEMS} from './store.js';
import {money} from './catalog.js';

// Mercado com carrinhos de verdade (estilo REPO): pega o carrinho pelo puxador, empurra (ele balança nas curvas),
// joga os itens da prateleira dentro, passa um por um no leitor segurando E e paga na maquininha.
// A porta não deixa sair item sem pagar (nem na mão nem no carrinho). Itens pessoais vão para a mochila de quem pagou;
// equipamento de barco fica no carrinho e é instalado quando chega perto do barco.
// Estado (anfitrião → snapshot): world.mk = {carts:[{x,z,yaw,h,it:[{u,id,s}]}], ground:[{u,id,s,x,y,z}], lanes:[{o,l,m,t}], uid}
// s: 0 não pago · 1 passado no leitor · 2 pago
export const CART_REACH=.95,CART_MAX=10,SCAN_TIME=.75;
const angDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const inStore=(x,z,pad=0)=>{const u=x-ISLAND.x,v=z-ISLAND.z;return u>SHOP.u0-pad&&u<SHOP.u1+pad&&v>SHOP.v0-pad&&v<SHOP.v1+pad;};
export const NEW_MARKET=()=>({carts:[[10.6,-1.5],[11.4,-1.5],[12.2,-1.5],[13,-1.5],[10.6,-2.9],[11.4,-2.9]].map(([u,dv])=>({x:ISLAND.x+u,z:ISLAND.z+SHOP.v0+dv,yaw:Math.PI,h:-1,it:[]})),ground:[],lanes:[0,1,2,3].map(()=>({o:-1,l:[],m:'idle',t:0})),uid:1});
// ---------- modelo do carrinho: cesto de arame, puxador azul, cadeirinha, rodízios ----------
export function makeCart(){const k=new Kit(),steel=new THREE.MeshStandardMaterial({vertexColors:true,metalness:.8,roughness:.3}),plastic=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.5}),S=0xc9ced3;
  const W=.56,L=.86,H0=.52,H1=.98;
  for(let i=0;i<=8;i++){const z=-L/2+i*L/8;for(const x of [-W/2,W/2])k.add(steel,limb(V(x,H0,z),V(x*1.06,H1,z*1.04),.007,.007,4),S);}
  for(let i=0;i<=6;i++){const x=-W/2+i*W/6;for(const z of [-L/2,L/2])k.add(steel,limb(V(x,H0,z),V(x*1.06,H1,z*1.04),.007,.007,4),S);}
  for(const y of [H0,H0+.16,H0+.31,H1]){const s=1+(y-H0)/(H1-H0)*.05;for(const z of [-L/2,L/2])k.add(steel,box([0,y,z*s],[W*s,.012,.012]),S);for(const x of [-W/2,W/2])k.add(steel,box([x*s,y,0],[.012,.012,L*s]),S);}
  for(let i=0;i<=6;i++)k.add(steel,box([-W/2+i*W/6,H0,0],[.008,.008,L]),S);for(let i=0;i<=8;i++)k.add(steel,box([0,H0,-L/2+i*L/8],[W,.008,.008]),S);
  // chassi, bandeja de baixo e rodízios
  for(const x of [-.22,.22]){k.add(steel,limb(V(x,.1,.42),V(x,.1,-.42),.014,.014,6),S).add(steel,limb(V(x,.1,-.42),V(x*1.1,H1+.05,-.5),.014,.014,6),S);}
  k.add(steel,box([0,.16,0],[.42,.012,.7]),S);for(let i=0;i<7;i++)k.add(steel,box([-.18+i*.06,.165,0],[.006,.01,.7]),S);
  for(const x of [-.22,.22])for(const z of [-.4,.4]){k.add(steel,limb(V(x,.1,z),V(x,.07,z),.012,.012,6),S).add(plastic,new THREE.CylinderGeometry(.05,.05,.035,14).rotateZ(Math.PI/2).translate(x,.05,z),0x1d1f22).add(plastic,new THREE.CylinderGeometry(.03,.03,.04,10).rotateZ(Math.PI/2).translate(x,.05,z),0x8a9098);}
  // puxador azul com a faixa amarela do Althoff e a cadeirinha dobrável
  k.add(plastic,limb(V(-W/2-.03,H1+.06,-L/2-.08),V(W/2+.03,H1+.06,-L/2-.08),.022,.022,12).rotateY(0),0x2c6db8).add(plastic,box([0,H1+.06,-L/2-.08],[.12,.05,.05]),0xf3d73a);
  for(const x of [-W/2,W/2])k.add(steel,limb(V(x*1.06,H1,-L/2*1.04),V(x+Math.sign(x)*.03,H1+.06,-L/2-.08),.01,.01,5),S);
  k.add(plastic,box([0,H1-.12,-L/2+.02],[W-.06,.2,.012]),0xd62028);
  const g=k.build();g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});const root=new THREE.Group();root.add(g);
  const hid=new THREE.MeshBasicMaterial({visible:false});
  const handle=new THREE.Mesh(new THREE.BoxGeometry(.8,.28,.3),hid);handle.position.set(0,H1+.04,-.5);root.add(handle);
  const basket=new THREE.Mesh(new THREE.BoxGeometry(.66,.55,.9),hid);basket.position.set(0,.76,0);root.add(basket);
  const load=new THREE.Group();load.position.set(0,H0+.02,0);root.add(load);
  root.userData={handle,basket,load,shown:''};return root;}
// ---------- módulo ----------
export class Market {
  constructor(ctx){this.c=ctx;this.carts=[];this.groundObjs=[];this.scanT=0;this.scanLane=-1;this.gateT=0;this.laneKey=['','','',''];this.flash=[];this.miniCache={};this.scanTimes=new Map();}
  get w(){return this.c.world.mk;}
  // modelo pequeno do item (compartilha a geometria da vitrine) com o maior lado = size
  mini(id,size=.3){const src=this.c.itemModel(id);const g=new THREE.Group(),m=src.clone();g.add(m);m.position.set(0,0,0);m.rotation.set(0,0,0);m.scale.set(1,1,1);m.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(m),s=b.getSize(V()),k=size/Math.max(s.x,s.y,s.z,1e-3);m.scale.setScalar(k);m.updateMatrixWorld(true);b.setFromObject(m);const c=b.getCenter(V());m.position.set(-c.x,-b.min.y,-c.z);g.traverse(o=>{if(o.isMesh){o.castShadow=false;}});return g;}
  // ---------- quem segura o quê ----------
  unpaid(p){if(p.hold&&p.hold.s<2)return true;const c=p.cartH>=0?this.w.carts[p.cartH]:null;return !!c&&(c.it.some(i=>i.s<2)||this.c.players.some(q=>q.ride===p.cartH&&q.hold?.s<2));}
  handsBusy(p){return !!p.hold||p.cartH>=0||p.ride>=0;}
  // movimento com carrinho ou item não pago: a porta segura (e o carrinho não atravessa parede)
  cartBlocked(c,x,z){const [ax,az]=this.c.island.collide(x,z,.42);
    if(Math.hypot(ax-x,az-z)>.04)return true;
    const unpaid=c.it.some(i=>i.s<2)||this.c.players.some(q=>q.ride>=0&&this.w.carts[q.ride]===c&&q.hold?.s<2);
    return unpaid&&!inStore(x,z,-.45);}
  canMove(p,nx,nz){if(!p.land||!this.w)return true;
    const cart=p.cartH>=0?this.w.carts[p.cartH]:null;
    if(cart){const yaw=this.c.worldYaw(p),cx=nx+Math.sin(yaw)*CART_REACH,cz=nz+Math.cos(yaw)*CART_REACH;
      if(this.cartBlocked(cart,cx,cz)){if(this.unpaid(p))this.gate(p);return false;}}
    if(p.hold?.s<2&&!inStore(nx,nz,-.3)){this.gate(p);return false;}
    return true;}
  gate(p){if(p.id!==this.c.localId)return;const t=this.c.elapsed;if(t-this.gateT<1.4)return;this.gateT=t;this.c.sound.effect('gate',{pos:V(ISLAND.x,SHOP.floor+2,ISLAND.z+SHOP.v0)});this.c.toast('🚨 A porta não abre: tem item sem pagar. Passe no caixa de autoatendimento primeiro.');this.doorAlarm=1.2;}
  // ---------- alvos de interação (raio do centro da tela) ----------
  targets(){const out=[];const sr=this.c.showroom;if(sr)for(const s of sr.slots)if(s.proxy)out.push([100+sr.slots.indexOf(s),s.proxy]);
    this.carts.forEach((o,i)=>{out.push([60+i,o.userData.handle]);out.push([70+i,o.userData.basket]);});
    this.groundObjs.forEach((o,i)=>{if(o.visible)out.push([80+i,o]);});
    for(const px of this.c.laneProxies){out.push([11,px.scan]);out.push([12,px.pay]);}return out;}
  laneOf(pos){let best=-1,bd=1e9;this.c.shopLanes.forEach((l,i)=>{const d=Math.hypot(pos.x-(ISLAND.x+l.u),pos.z-(ISLAND.z+l.v));if(d<bd){bd=d;best=i;}});return bd<3.2?best:-1;}
  // carrinhos ao alcance do caixa i (o que o jogador empurra ou algum estacionado ao lado)
  cartsNear(i,p){const l=this.c.shopLanes[i],lx=ISLAND.x+l.u,lz=ISLAND.z+l.v;return this.w.carts.map((c,k)=>[c,k]).filter(([c,k])=>k===p.cartH||(c.h<0&&Math.hypot(c.x-lx,c.z-lz)<3.6));}
  nextToScan(i,p){if(p.hold&&p.hold.s===0)return p.hold;for(const [c]of this.cartsNear(i,p)){const it=c.it.find(q=>q.s===0);if(it)return it;}return null;}
  laneItems(i){const L=this.w.lanes[i];const all=[];for(const q of this.c.players){if(q.hold)all.push(q.hold);}for(const c of this.w.carts)all.push(...c.it);all.push(...this.w.ground);return L.l.map(u=>all.find(q=>q.u===u)).filter(Boolean);}
  pos(code,p){const w=this.w;if(code>=100){const s=this.c.showroom?.slots[code-100];return s?.proxy?s.proxy.getWorldPosition(V()):null;}
    if(code>=60&&code<80){const c=w.carts[(code-60)%10];return c?V(c.x,this.c.ground(c.x,c.z)+.8,c.z):null;}
    if(code>=80&&code<100){const g=w.ground[code-80];return g?V(g.x,g.y,g.z):null;}
    if(code===11||code===12){const pw=this.c.worldOf(p);const i=this.laneOf(pw);if(i<0)return null;const l=this.c.shopLanes[i];return V(...(code===11?l.scan:l.pay)).add(V(ISLAND.x,0,ISLAND.z));}return null;}
  label(code,p){const w=this.w,free=this.c.handsFree(p);
    if(code>=100){const s=this.c.showroom?.slots[code-100];if(!s)return null;const it=ITEMS[s.id];const tag=`${it.name} · ${money(it.price)}`;
      if(p.hold&&p.hold.id===s.id&&p.hold.s===0)return ['Devolver à prateleira · '+it.name,1];if(p.cartH>=0)return [(w.carts[p.cartH].it.length>=CART_MAX?'Carrinho cheio · ':'Pôr no carrinho · ')+tag,w.carts[p.cartH].it.length<CART_MAX?1:0];return free?['Pegar · '+tag,1]:['Mãos ocupadas',0];}
    if(code>=60&&code<70){const i=code-60,c=w.carts[i];if(!c)return null;if(c.h===p.id)return ['Soltar o carrinho',1];if(c.h>=0)return free?['Subir no carrinho (carona!)',1]:['Mãos ocupadas',0];return free?['Empurrar o carrinho',1]:p.hold?(c.it.length<CART_MAX?['Pôr no carrinho',1]:['Carrinho cheio',0]):['Mãos ocupadas',0];}
    if(code>=70&&code<80){const i=code-70,c=w.carts[i];if(!c)return null;if(p.hold)return c.it.length<CART_MAX?['Pôr no carrinho · '+ITEMS[p.hold.id].name,1]:['Carrinho cheio',0];if(!c.it.length)return c.h<0&&free?['Empurrar o carrinho',1]:null;const last=c.it[c.it.length-1];return free||p.cartH===i?[`Tirar do carrinho · ${ITEMS[last.id].name}${last.s===2?' (pago)':''}`,1]:['Mãos ocupadas',0];}
    if(code>=80&&code<100){const g=w.ground[code-80];if(!g)return null;return free?['Pegar · '+ITEMS[g.id].name+(g.s===2?' (pago)':''),1]:['Mãos ocupadas',0];}
    if(code===11){const i=this.laneOf(this.c.worldOf(p));if(i<0)return null;const L=w.lanes[i];if(L.o>=0&&L.o!==p.id&&L.m!=='idle')return ['Caixa ocupado',0];const n=this.nextToScan(i,p);return n?[`Segure E · passar ${ITEMS[n.id].name} no leitor`,1]:['Traga os itens (na mão ou no carrinho ao lado)',0];}
    if(code===12){const i=this.laneOf(this.c.worldOf(p));if(i<0)return null;const L=w.lanes[i];if(L.o!==p.id||!L.l.length)return ['Maquininha · passe os itens primeiro',0];const tot=this.laneItems(i).filter(q=>q.s===1).reduce((s,q)=>s+ITEMS[q.id].price,0);return [`Pagar ${money(tot)} com o cartão da tripulação`,1];}
    return null;}
  // ---------- anfitrião ----------
  interact(p,code){const w=this.w,C=this.c;if(!w)return false;
    const handled=code>=60&&code<200||code===11||code===12;
    // o que está na mão: carrinho (solta) ou item (larga no chão) quando o alvo não é do mercado
    if(!handled){if(p.cartH>=0){this.release(p);return true;}if(p.hold){this.drop(p);return true;}if(p.ride>=0){this.unride(p);return true;}return false;}
    const at=this.pos(code,p);if(!at||at.distanceTo(C.worldOf(p,1.2))>3.8)return true;const lab=this.label(code,p);if(!lab)return true;if(!lab[1]){C.toastFor(p.id,lab[0]+'.');return true;}
    if(code>=100){if(!p.land||!inStore(p.x,p.z,-.3)){this.gate(p);return true;}const s=C.showroom.slots[code-100];if(p.hold&&p.hold.id===s.id&&p.hold.s===0){p.hold=null;C.stateEvent('mk',{k:'shelf',id:p.id,item:s.id,put:1});return true;}
      const item={u:w.uid++,id:s.id,s:0};if(p.cartH>=0){w.carts[p.cartH].it.push(item);C.stateEvent('mk',{k:'toCart',id:p.id,item:s.id,cart:p.cartH,from:at.toArray()});}else{p.hold=item;C.stateEvent('mk',{k:'shelf',id:p.id,item:s.id});}return true;}
    if(code>=60&&code<70){const i=code-60,c=w.carts[i];if(c.h===p.id){this.release(p);return true;}if(c.h>=0){this.ride(p,i);return true;}if(p.hold&&!C.handsFree({...p,hold:null})){return true;}
      if(p.hold){if(c.it.length>=CART_MAX)return true;if(p.hold.s<2&&!inStore(c.x,c.z,-.45)){this.gate(p);return true;}c.it.push(p.hold);C.stateEvent('mk',{k:'toCart',id:p.id,item:p.hold.id,cart:i});p.hold=null;return true;}
      c.h=p.id;p.cartH=i;C.stateEvent('mk',{k:'grab',id:p.id,cart:i});return true;}
    if(code>=70&&code<80){const i=code-70,c=w.carts[i];if(p.hold){if(c.it.length>=CART_MAX)return true;if(p.hold.s<2&&!inStore(c.x,c.z,-.45)){this.gate(p);return true;}c.it.push(p.hold);C.stateEvent('mk',{k:'toCart',id:p.id,item:p.hold.id,cart:i});p.hold=null;return true;}
      if(!c.it.length){if(c.h<0){c.h=p.id;p.cartH=i;C.stateEvent('mk',{k:'grab',id:p.id,cart:i});}return true;}
      if(p.hold)return true;const it=c.it.pop();this.take(p,it);return true;}
    if(code>=80&&code<100){const g=w.ground.splice(code-80,1)[0];if(g)this.take(p,{u:g.u,id:g.id,s:g.s});return true;}
    if(code===12){this.pay(p);return true;}
    return true;}// SCAN: só segurando E (entrada 'scan')
  // pegar um item: pago e pessoal vai direto para a mochila; o resto fica na mão
  take(p,it){const C=this.c;if(it.s===2&&ITEMS[it.id].kind!=='boat'){const why=C.gear.addItem(p,it.id);if(!why){C.stateEvent('mk',{k:'bag',id:p.id,item:it.id});return;}C.toastFor(p.id,why+' Ficou na mão.');}
    p.hold=it;C.stateEvent('mk',{k:'hand',id:p.id,item:it.id});}
  drop(p){const C=this.c,w=this.w,it=p.hold;if(!it)return;p.hold=null;const pw=C.worldOf(p),yaw=C.worldYaw(p);let x=pw.x+Math.sin(yaw)*.5,z=pw.z+Math.cos(yaw)*.5;
    if(!p.land){// no barco: equipamento pago é instalado; o resto vai para o chão do convés... ou para a mochila
      if(it.s===2&&ITEMS[it.id].kind==='boat'){this.install(p,it.id);return;}}
    if(it.s<2&&!inStore(x,z,-.3)){x=pw.x;z=pw.z;}const g=C.ground(x,z);if(!p.land||g<-.3){x=pw.x;z=pw.z;}w.ground.push({u:it.u,id:it.id,s:it.s,x:+x.toFixed(2),y:+(Math.max(g,pw.y)).toFixed(2),z:+z.toFixed(2)});if(w.ground.length>20)w.ground.shift();C.stateEvent('mk',{k:'drop',id:p.id,item:it.id});}
  release(p){const c=this.w.carts[p.cartH];if(c)c.h=-1;p.cartH=-1;this.c.stateEvent('mk',{k:'release',id:p.id});}
  ride(p,i){const c=this.w.carts[i];if(this.c.players.some(q=>q.ride===i))return this.c.toastFor(p.id,'Já tem alguém de carona.');p.ride=i;p.mode='ride';p.tp++;this.c.stateEvent('mk',{k:'ride',id:p.id,cart:i});}
  unride(p){const c=this.w.carts[p.ride];p.ride=-1;p.mode='walk';p.tp++;if(c){const [x,z]=this.c.island.collide(c.x+Math.cos(c.yaw)*.8,c.z-Math.sin(c.yaw)*.8,.3);p.x=x;p.z=z;p.height=this.c.ground(x,z);}p.vy=3;this.c.stateEvent('mk',{k:'unride',id:p.id});}
  dropAll(p){if(p.cartH>=0)this.release(p);if(p.hold)this.drop(p);if(p.ride>=0)this.unride(p);}
  scan(p){const C=this.c,w=this.w;if(C.elapsed-(this.scanTimes.get(p.id)??-Infinity)<SCAN_TIME)return;const i=this.laneOf(C.worldOf(p));if(i<0)return;const L=w.lanes[i];if(L.o>=0&&L.o!==p.id&&L.m!=='idle')return;
    const it=this.nextToScan(i,p);if(!it)return;const why=C.gear.cannotOwn(p,it.id,w.lanes[i].l.map(u=>this.laneItems(i).find(q=>q.u===u)?.id).filter(Boolean));
    if(why){C.stateEvent('mk',{k:'deny',id:p.id,lane:i,item:it.id,why});return;}
    this.scanTimes.set(p.id,C.elapsed);it.s=1;if(L.o!==p.id){L.o=p.id;L.l=[];}L.l.push(it.u);L.m='scan';L.t=C.elapsed;C.stateEvent('mk',{k:'scan',id:p.id,lane:i,item:it.id});}
  pay(p){const C=this.c,w=this.w;const i=this.laneOf(C.worldOf(p));if(i<0)return;const L=w.lanes[i];if(L.o!==p.id)return;const items=this.laneItems(i).filter(q=>q.s===1);if(!items.length)return;
    const total=items.reduce((s,q)=>s+ITEMS[q.id].price,0);if(C.world.money+1e-6<total){L.m='fail';L.t=C.elapsed;C.stateEvent('mk',{k:'fail',id:p.id,lane:i,total,money:C.world.money});return;}
    C.world.money=Math.round((C.world.money-total)*100)/100;const bagged=[],boat=[];
    for(const it of items){it.s=2;const kind=ITEMS[it.id].kind;if(kind==='boat'){boat.push(it.id);continue;}
      // pessoal: sai do carrinho/mão direto para a mochila de quem pagou
      if(!C.gear.addItem(p,it.id)){bagged.push(it.id);for(const q of C.players)if(q.hold===it)q.hold=null;w.ground=w.ground.filter(q=>q!==it);for(const c of w.carts){const k=c.it.indexOf(it);if(k>=0)c.it.splice(k,1);}}}
    L.m='done';L.t=C.elapsed;L.l=[];C.stateEvent('mk',{k:'paid',id:p.id,lane:i,total,money:C.world.money,bagged,boat});}
  install(p,id){const C=this.c;const why=C.gear.install(id);C.stateEvent('mk',{k:'install',id:p?.id??-1,item:id,why:why||''});}
  hostTick(dt){const C=this.c,w=this.w;if(!w)return;const t=C.elapsed,boat=C.boatState;
    for(let i=0;i<w.carts.length;i++){const c=w.carts[i];
      if(c.h>=0){const q=C.players[c.h];if(!q||q.cartH!==i||q.mode!=='walk'||!q.land){if(q)q.cartH=-1;c.h=-1;}
        else{const pw=C.worldOf(q),want=C.worldYaw(q);const yaw=c.yaw+angDiff(want,c.yaw)*Math.min(1,dt*7),x=pw.x+Math.sin(yaw)*CART_REACH,z=pw.z+Math.cos(yaw)*CART_REACH;if(!this.cartBlocked(c,x,z)){c.yaw=yaw;c.x=x;c.z=z;}else if(this.unpaid(q))this.gate(q);}}
      // equipamento pago chegou ao barco (carrinho estacionado no cais ao lado): instala
      if(c.it.some(q=>q.s===2&&ITEMS[q.id].kind==='boat')&&Math.hypot(c.x-boat.x,c.z-boat.z)<9){for(const q of c.it.filter(q=>q.s===2&&ITEMS[q.id].kind==='boat')){c.it.splice(c.it.indexOf(q),1);this.install(C.players[c.h]||null,q.id);}}}
    for(const q of C.players){if(q.ride>=0){const c=w.carts[q.ride];if(!c||q.mode!=='ride'){q.ride=-1;if(q.mode==='ride')q.mode='walk';continue;}q.land=1;q.x=c.x;q.z=c.z;q.height=C.ground(c.x,c.z)+.45;q.speed=0;}
      if(q.hold&&q.hold.s===2&&ITEMS[q.hold.id].kind==='boat'&&!q.land&&q.mode!=='ragdoll'){const id=q.hold.id;q.hold=null;this.install(q,id);}
      // item não pago fora da loja (tapa, queda, teletransporte): volta para a prateleira
      if(q.hold&&q.hold.s<2&&q.land&&!inStore(q.x,q.z,.2)&&q.mode!=='ride'){q.hold=null;C.stateEvent('mk',{k:'shelf',id:q.id,put:1,alarm:1});}}
    for(let i=0;i<w.lanes.length;i++){const L=w.lanes[i];if((L.m==='done'&&t-L.t>4.5)||(L.m==='fail'&&t-L.t>3)){L.m=L.l.length?'scan':'idle';if(!L.l.length)L.o=-1;}
      if(L.m==='scan'){const o=C.players[L.o];if(!o||Math.hypot(C.worldOf(o).x-(ISLAND.x+C.shopLanes[i].u),C.worldOf(o).z-(ISLAND.z+C.shopLanes[i].v))>7){for(const it of this.laneItems(i))if(it.s===1)it.s=0;L.o=-1;L.l=[];L.m='idle';}}}
    w.ground=w.ground.filter(g=>!(g.s<2&&!inStore(g.x,g.z,.5)));}
  // ---------- cliente: segurar E no leitor ----------
  localControls(controls,dt,hover,keys){const p=this.c.me();if(!p)return;const on=hover?.code===11&&hover.ok&&keys.has('KeyE');
    if(on){this.scanT+=dt;if(this.scanT>=SCAN_TIME){controls.scan=true;this.scanT=-.35;}}else this.scanT=Math.min(this.scanT,0)+dt>0?0:this.scanT+dt;
    if(p.ride>=0&&controls.jump)controls.interact=true;}
  get scanning(){return Math.max(0,this.scanT)/SCAN_TIME;}
  // ---------- eventos (todos) ----------
  event(e){const C=this.c,pl=C.players[e.id],pos=pl?C.worldOf(pl,1):null,mine=e.id===C.localId,name=e.item?ITEMS[e.item]?.name:'';
    const lanePos=i=>{const l=C.shopLanes[i];return V(ISLAND.x+l.u,SHOP.floor+1,ISLAND.z+l.v);};
    if(e.k==='shelf'){C.sound.effect(e.put?'put':'pick',{pos});if(mine&&!e.alarm)C.toast(e.put?'Devolvido à prateleira.':`${name} na mão · E num carrinho guarda · passe no caixa para comprar`);if(e.alarm){C.sound.effect('gate',{pos});if(mine)C.toast('O alarme apitou: item sem pagar voltou para a prateleira.');}}
    if(e.k==='toCart'){C.sound.effect('cartDrop',{pos});if(e.from)this.flash.push({id:e.item,from:V(...e.from),cart:e.cart,t:0});if(mine)C.toast(`${name} no carrinho.`);}
    if(e.k==='grab'){C.sound.effect('cartGrab',{pos});if(mine)C.toast('Carrinho na mão · ande para empurrar · E solta · E nas prateleiras joga o item dentro');}
    if(e.k==='release')C.sound.effect('cartGrab',{pos});
    if(e.k==='ride'){C.sound.effect('cartGrab',{pos});if(mine)C.toast('De carona no carrinho! ESPAÇO desce.');}
    if(e.k==='unride')C.sound.effect('land',{pos});
    if(e.k==='hand'){C.sound.effect('pick',{pos});}
    if(e.k==='bag'){C.sound.effect('zip',{pos});if(mine)C.toast(`${name} guardado na mochila.`);}
    if(e.k==='drop'){C.sound.effect('put',{pos});}
    if(e.k==='scan'){const lp=lanePos(e.lane);C.sound.effect('beep',{pos:lp});C.shopLaneObjs[e.lane]?.beep();}
    if(e.k==='deny'){C.sound.effect('error',{pos:lanePos(e.lane)});if(mine)C.toast(`${name}: ${e.why}`);}
    if(e.k==='fail'){C.sound.effect('error',{pos:lanePos(e.lane)});if(mine)C.toast(`Saldo insuficiente: o total é ${money(e.total)} e a tripulação tem ${money(e.money)}.`);}
    if(e.k==='paid'){const lp=lanePos(e.lane),L=C.shopLaneObjs[e.lane];L?.tapCard();L?.printReceipt();C.world.money=e.money;C.sound.effect('card',{pos:lp});setTimeout(()=>C.sound.effect('printer',{pos:lp}),450);setTimeout(()=>C.sound.effect('cash'),900);
      if(mine){C.toast(`Pago: ${money(e.total)}.`+(e.bagged.length?` Na mochila: ${e.bagged.map(i=>ITEMS[i].name).join(', ')}.`:'')+(e.boat.length?` Leve até o barco para instalar: ${e.boat.map(i=>ITEMS[i].name).join(', ')}.`:''));C.confetti('#6fb83a',30);}
      else C.toast(`Pescador ${(pl?.net??0)+1} comprou ${money(e.total)} na Loja do Pescador.`);}
    if(e.k==='install'){C.sound.effect('wrench',{pos:C.boat.position});C.toast(e.why?`${name}: ${e.why}`:`${name} instalado no barco!`);if(!e.why)C.confetti('#4fd1ff',24);}}
  // ---------- visual ----------
  render(t,dt){const C=this.c,w=this.w;if(!w)return;const scene=C.scene,me=C.me();
    while(this.carts.length<w.carts.length){const m=makeCart();scene.add(m);m.userData.disp=null;this.carts.push(m);}
    w.carts.forEach((c,i)=>{const m=this.carts[i];m.visible=!C.island.exploded;let x=c.x,z=c.z,yaw=c.yaw;
      // o carrinho de quem sou eu segue a minha posição prevista (sem atraso da rede), com o mesmo balanço
      if(c.h===C.localId&&me&&me.land){const pw=C.worldOf(me),want=C.worldYaw(me),d=m.userData.local??=yaw;m.userData.local=d+angDiff(want,d)*Math.min(1,dt*7);const ny=m.userData.local,nx=pw.x+Math.sin(ny)*CART_REACH,nz=pw.z+Math.cos(ny)*CART_REACH;if(!this.cartBlocked(c,nx,nz)){yaw=ny;x=nx;z=nz;}else m.userData.local=c.yaw;}else m.userData.local=null;
      const d=m.userData.disp||(m.userData.disp={x,z,yaw});const k=c.h===C.localId?1:Math.min(1,dt*10);const px=d.x,pz=d.z;d.x+=(x-d.x)*k;d.z+=(z-d.z)*k;d.yaw+=angDiff(yaw,d.yaw)*k;
      const sp=Math.hypot(d.x-px,d.z-pz)/Math.max(dt,1e-3);m.position.set(d.x,C.ground(d.x,d.z),d.z);m.rotation.set(0,d.yaw,Math.sin(t*14)*.012*Math.min(sp,3));
      if(sp>.4){m.userData.rollT=(m.userData.rollT||0)-dt;if(m.userData.rollT<=0&&me&&m.position.distanceTo(C.camera.position)<18){m.userData.rollT=.28;C.sound.effect('cartRoll',{pos:m.position,k:Math.min(1,sp/4)});}}
      const key=c.it.map(q=>q.id+q.s).join(',');if(key!==m.userData.shown){m.userData.shown=key;const load=m.userData.load;load.clear();c.it.forEach((q,n)=>{const g=this.mini(q.id,.26);g.position.set(-.16+(n%3)*.16,Math.floor(n/6)*.2,-.24+(Math.floor(n/3)%2)*.26+(n>=6?.12:0));g.rotation.y=n*1.3;load.add(g);if(q.s===2){const tag=new THREE.Mesh(new THREE.PlaneGeometry(.08,.05),new THREE.MeshBasicMaterial({color:0x40d060}));tag.position.set(0,.3,0);g.add(tag);}});}});
    // itens no chão
    while(this.groundObjs.length<w.ground.length){const o=new THREE.Group();scene.add(o);this.groundObjs.push(o);}
    this.groundObjs.forEach((o,i)=>{const g=w.ground[i];o.visible=!!g;if(!g)return;const key=g.u+':'+g.id;if(o.userData.key!==key){o.userData.key=key;o.clear();const m=this.mini(g.id,.4);o.add(m);const hit=new THREE.Mesh(new THREE.BoxGeometry(.5,.4,.5),new THREE.MeshBasicMaterial({visible:false}));hit.position.y=.2;o.add(hit);}o.position.set(g.x,g.y,g.z);o.rotation.y=g.u;});
    // itens voando da prateleira para o carrinho
    for(const f of [...this.flash]){f.t+=dt*2.6;if(!f.obj){f.obj=this.mini(f.id,.26);scene.add(f.obj);}const to=this.carts[f.cart]?.position.clone().add(V(0,.7,0))||f.from;const k=Math.min(1,f.t);f.obj.position.lerpVectors(f.from,to,k);f.obj.position.y+=Math.sin(k*Math.PI)*.5;f.obj.rotation.y+=dt*9;if(k>=1){scene.remove(f.obj);this.flash.splice(this.flash.indexOf(f),1);}}
    // telas dos caixas
    w.lanes.forEach((L,i)=>{const obj=C.shopLaneObjs[i];if(!obj)return;const items=this.laneItems(i),o=C.players[L.o];const pend=o?this.cartsNear(i,o).reduce((s,[c])=>s+c.it.filter(q=>q.s===0).length,0)+(o.hold&&o.hold.s===0?1:0):0;
      const st=L.m==='idle'?null:{mode:L.m==='scan'&&this.payingLane===i?'pay':L.m,who:o?`Pescador ${(o.net??o.id)+1}`:'',money:C.world.money,items:items.map(q=>({name:ITEMS[q.id].name,price:ITEMS[q.id].price})),total:items.filter(q=>q.s===1).reduce((s,q)=>s+ITEMS[q.id].price,0)||items.reduce((s,q)=>s+ITEMS[q.id].price,0),pending:pend};
      const key=JSON.stringify(st);if(key!==this.laneKey[i]){this.laneKey[i]=key;obj.draw(st);}obj.mode=this.doorAlarm>0&&i===0?'alarm':L.m;});
    this.doorAlarm=Math.max(0,(this.doorAlarm||0)-dt);}
}

import * as THREE from 'three';
import {Kit,loft,limb,ellipsoid,box,sculpt,V} from './geometry.js';
import {ITEMS,ITEM_IDS,CATEGORY_SHORT,STORE_CATEGORIES} from './store.js';
const idsOf=cat=>ITEM_IDS.filter(id=>ITEMS[id].category===STORE_CATEGORIES[cat]);
import {money} from './catalog.js';

// Loja do Pescador dentro do Althoff: dois expositores de madeira (quatro faces, uma categoria por face),
// vitrine de iscas no corredor central e os caixas de autoatendimento redesenhados (leitor bióptico com
// laser, tela sensível ao toque com a lista, maquininha, impressora de cupom, balança de ensacar e torre de luz).
const WOOD=0x5b3a23,WOOD_LIGHT=0x8a5f3a,BRASS=0xc8a15a,NAVY=0x1d3354,IVORY=0xf3ead7;
const CAT_COLOR=['#2f7fc4','#2a9d8f','#c8662e','#6a8f2e','#b23a48'];
const COL_W=1.9,U_FACE=.31;
export function priceTag(canvasTex,item,color){return canvasTex(256,104,(c,w,h)=>{c.fillStyle='#fffdf4';c.fillRect(0,0,w,h);c.fillStyle=color;c.fillRect(0,0,12,h);c.fillStyle='#f3d73a';c.fillRect(12,h-14,w-12,14);
  c.fillStyle='#1b2430';c.textAlign='left';c.font='bold 21px Arial';let name=item.name;while(c.measureText(name).width>w-32&&name.length>4)name=name.slice(0,-2)+'…';c.fillText(name,22,28);
  c.fillStyle='#d62028';c.font='bold 44px Arial';c.fillText(money(item.price),20,74);c.fillStyle='#6a7380';c.font='bold 14px Arial';c.textAlign='right';c.fillText('Nº '+String(item.number).padStart(2,'0'),w-10,26);});}
// ----- expositores -----
export function buildFixtures({inn,im,imMetal,glass,group,colliders,canvasTex,F}){
  const slots=[],tags=new THREE.Group();group.add(tags);
  const header=(text,color)=>canvasTex(1024,64,(c,w,h)=>{c.fillStyle='#1d3354';c.fillRect(0,0,w,h);c.fillStyle=color;c.fillRect(0,h-8,w,8);c.fillStyle='#f3ead7';c.font='bold 38px Georgia';c.textAlign='center';c.textBaseline='middle';c.fillText('⚓  '+text+'  ⚓',w/2,h/2-3);});
  const faces=[[-5.5,1,0],[-5.5,-1,1],[5.5,-1,2],[5.5,1,3]];
  for(const su of [-5.5,5.5]){const va=11,vb=20.5,mid=(va+vb)/2,len=vb-va;
    inn.add(im,box([su,F+.09,mid],[1.26,.18,len]),0x2b1d14,.03).add(im,box([su,F+1.2,mid],[.07,2.1,len]),WOOD,.04);
    for(let k=0;k<=5;k+=5)inn.add(im,box([su,F+1.13,va+k*COL_W],[1.26,2.1,.05]),WOOD_LIGHT,.03);
    inn.add(im,box([su,F+2.22,mid],[1.34,.1,len+.12]),0x2b1d14,.02).add(imMetal,box([su,F+2.29,mid],[1.2,.04,len]),BRASS,.02);
    for(const s of [-1,1]){
      // tábuas: fundo (sobre o rodapé) e prateleira do meio, com trilho de latão na frente
      for(const y of [F+.22,F+1.16]){inn.add(im,box([su+s*U_FACE,y,mid],[.58,.05,len]),WOOD_LIGHT,.03).add(imMetal,box([su+s*.61,y-.015,mid],[.025,.075,len]),BRASS,.02);}
      // painel de fundo perfurado (pegboard) em cada face
      inn.add(im,box([su+s*.045,F+1.2,mid],[.01,1.95,len-.1]),0xd9c9a8,.02);
      const glow=new THREE.Mesh(new THREE.BoxGeometry(.36,.012,len-.1),new THREE.MeshStandardMaterial({color:0xfff4d8,emissive:0xffd9a0,emissiveIntensity:2.2}));glow.position.set(su+s*.36,F+1.13,mid);group.add(glow);
      const glow2=glow.clone();glow2.position.y=F+2.16;group.add(glow2);
      const face=faces.find(f=>f[0]===su&&f[1]===s),cat=face[2];
      const sign=new THREE.Mesh(new THREE.PlaneGeometry(len,.36),new THREE.MeshStandardMaterial({map:header(CATEGORY_SHORT[cat],CAT_COLOR[cat]),emissive:0xffffff,emissiveIntensity:.25,roughness:.6}));sign.material.emissiveMap=sign.material.map;
      sign.position.set(su+s*.68,F+2.43,mid);sign.rotation.y=s*Math.PI/2;group.add(sign);inn.add(im,box([su+s*.66,F+2.43,mid],[.03,.42,len+.06]),0x2b1d14,.02);
      // itens da categoria em duas fileiras, colunas do tamanho certo para não sobrar buraco
      const ids=idsOf(cat),cols=Math.ceil(ids.length/2),cw=len/cols;
      ids.forEach((id,n)=>{const row=n<cols?1:0,col=n%cols,v=va+cw*(col+.5),base=row?F+1.185:F+.245,h=row?.93:.86;
        slots.push({id,u:su+s*U_FACE,v,y:base,rot:s*Math.PI/2,w:cw-.2,h,d:.52,face:s,axis:'u',cat});
        const tag=new THREE.Mesh(new THREE.PlaneGeometry(.36,.146),new THREE.MeshStandardMaterial({map:priceTag(canvasTex,ITEMS[id],CAT_COLOR[cat]),roughness:.5,emissive:0xffffff,emissiveIntensity:.18}));tag.material.emissiveMap=tag.material.map;
        tag.position.set(su+s*.626,base-.02,v);tag.rotation.y=s*Math.PI/2;tags.add(tag);});}
    colliders.push({x0:su-.66,x1:su+.66,z0:va,z1:vb});}
  // ----- vitrine de iscas (categoria 5) no corredor central -----
  const cv=9.9,cw=4.4;inn.add(im,box([0,F+.42,cv],[cw,.84,1.1]),WOOD,.04).add(imMetal,box([0,F+.86,cv],[cw+.04,.05,1.14]),BRASS,.02).add(im,box([0,F+.06,cv],[cw-.1,.12,1.0]),0x2b1d14,.02);
  for(const s of [-1,1])inn.add(im,box([0,F+.45,cv+s*.556],[cw-.2,.62,.02]),WOOD_LIGHT,.04);
  for(const x of [-cw/2,cw/2])for(const z of [-.52,.52])inn.add(imMetal,box([x,F+1.15,cv+z],[.03,.55,.03]),BRASS,.02);
  inn.add(imMetal,box([0,F+1.43,cv],[cw+.03,.03,1.08]),BRASS,.02);
  const vit=new THREE.Mesh(new THREE.BoxGeometry(cw,.55,1.06),glass);vit.position.set(0,F+1.155,cv);vit.renderOrder=5;group.add(vit);
  const cglow=new THREE.Mesh(new THREE.BoxGeometry(cw-.1,.012,.9),new THREE.MeshStandardMaterial({color:0xfff4d8,emissive:0xffd9a0,emissiveIntensity:2.4}));cglow.position.set(0,F+1.41,cv);group.add(cglow);
  const bait=idsOf(4),half=Math.ceil(bait.length/2);bait.forEach((id,n)=>{const side=n<half?-1:1,col=n%half,u=-cw/2+cw/half*(col+.5),v=cv+side*.25;
    slots.push({id,u,v,y:F+.89,rot:side<0?Math.PI:0,w:.8,h:.5,d:.5,face:side,axis:'v',cat:4});
    const tag=new THREE.Mesh(new THREE.PlaneGeometry(.36,.146),new THREE.MeshStandardMaterial({map:priceTag(canvasTex,ITEMS[id],CAT_COLOR[4]),roughness:.5,emissive:0xffffff,emissiveIntensity:.18}));tag.material.emissiveMap=tag.material.map;
    tag.position.set(u,F+.66,cv+side*.568);tag.rotation.y=side<0?Math.PI:0;tags.add(tag);});
  colliders.push({x0:-cw/2-.05,x1:cw/2+.05,z0:cv-.6,z1:cv+.6});
  // placa pendurada da loja: madeira escura, letras douradas, um peixe e uma âncora
  const signTex=canvasTex(1024,256,(c,w,h)=>{const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#3a2616');g.addColorStop(1,'#241509');c.fillStyle=g;c.fillRect(0,0,w,h);c.strokeStyle='#c8a15a';c.lineWidth=10;c.strokeRect(12,12,w-24,h-24);
    c.fillStyle='#f0cf7a';c.font='bold 96px Georgia';c.textAlign='center';c.textBaseline='middle';c.fillText('LOJA DO PESCADOR',w/2,h/2-18);c.font='italic 34px Georgia';c.fillStyle='#e8dcc0';c.fillText('equipamento de verdade para quem vive do mar',w/2,h/2+58);});
  const sm=new THREE.MeshStandardMaterial({map:signTex,emissive:0xffffff,emissiveMap:signTex,emissiveIntensity:.35,roughness:.55});
  for(const s of [-1,1]){const p=new THREE.Mesh(new THREE.PlaneGeometry(4.4,1.1),sm);p.position.set(0,F+4,11.6+s*.03);p.rotation.y=s<0?Math.PI:0;group.add(p);}
  inn.add(im,box([0,F+4,11.6],[4.5,1.18,.05]),0x241509,.02);for(const x of [-2,2])inn.add(imMetal,limb(V(x,F+4.55,11.6),V(x,F+6.05,11.6),.01,.01,4),0x777777);
  return {slots,tags};
}
// ----- vitrine: modelos 3D dos 50 itens nas prateleiras (construídos uma vez, sem sombra projetada) -----
export class Showroom {
  constructor(parent,slots,makeItem){this.group=new THREE.Group();this.group.name='Loja do Pescador · vitrine';parent.add(this.group);this.slots=slots;this.make=makeItem;this.built=0;this.models={};this.anchors=[];}
  // monta o item i dentro da célula: gira para a frente da prateleira, deita os altos e escala para caber
  buildOne(i){const s=this.slots[i],model=this.make(s.id),holder=new THREE.Group();holder.add(model);
    const b=new THREE.Box3().setFromObject(model),size=b.getSize(V());if(size.y>s.h*.92&&size.x<size.y*.9){model.rotation.z=Math.PI/2;model.updateMatrixWorld(true);b.setFromObject(model);b.getSize(size);}
    const k=Math.min(1,s.w*.9/size.x,s.h*.9/size.y,s.d*1.5/size.z);model.scale.multiplyScalar(k);model.updateMatrixWorld(true);b.setFromObject(model);const c=b.getCenter(V());model.position.sub(V(c.x,b.min.y,c.z));
    holder.position.set(s.u,s.y+.005,s.v);holder.rotation.y=s.rot;model.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=true;}});this.group.add(holder);this.models[s.id]=model;this.anchors[i]=holder;
    // área de clique = a célula inteira (mirar num anzol fino seria injusto)
    const proxy=new THREE.Mesh(new THREE.BoxGeometry(s.axis==='u'?.56:Math.min(.82,s.w),s.h*.95,s.axis==='u'?s.w*.95:.5),new THREE.MeshBasicMaterial({visible:false}));
    if(s.axis==='u')proxy.position.set(s.u,s.y+s.h*.48,s.v);else proxy.position.set(s.u,s.y+s.h*.48,s.v);this.group.add(proxy);proxy.userData.slot=i;s.proxy=proxy;s.holder=holder;this.built++;}
  buildAll(){for(let i=0;i<this.slots.length;i++)if(!this.anchors[i])this.buildOne(i);}
  // gira devagar o item olhado (vitrine viva) e mostra quem está na cesta de alguém
  update(t,dt,{hoverSlot=-1,taken=new Set()}={}){for(let i=0;i<this.anchors.length;i++){const h=this.anchors[i];if(!h)continue;const s=this.slots[i];const want=i===hoverSlot?Math.sin(t*1.6)*.5:0;h.rotation.y+=(s.rot+want-h.rotation.y)*Math.min(1,dt*4);h.visible=!taken.has(s.id)||i===hoverSlot;}}
}
// ----- caixa de autoatendimento -----
// Cliente fica do lado -u; a tela olha para -u. z local = v (+ entrada da fila, - área de ensacar).
export function buildLane({inn,im,imMetal,group,colliders,canvasTex,drawLogo,F,u,v,n}){
  const L=(x,y,z)=>[u+x,F+y,v+z];
  // gabinete: frente azul com filete amarelo, tampo inox, rodapé preto e cantos arredondados
  inn.add(imMetal,box(L(.02,.47,-.18),[.84,.9,1.5]),0xe9eaec,.02).add(im,box(L(-.41,.47,-.18),[.02,.82,1.46]),0x2c6db8,.02).add(im,box(L(-.422,.62,-.18),[.01,.07,1.46]),0xf3d73a,.01).add(im,box(L(-.41,.06,-.18),[.05,.12,1.5]),0x1d1f22,.02);
  for(const z of [-.93,.57])inn.add(imMetal,loft([{y:F+.02,rx:.43,rz:.02},{y:F+.92,rx:.43,rz:.02}],{n:10}).translate(u+.02,0,v+z),0xd9dcdf,.02);
  inn.add(imMetal,box(L(.02,.935,-.18),[.88,.03,1.54]),0xc9ced3,.02);
  // prateleira da cesta (entrada) com tapete de borracha
  inn.add(imMetal,box(L(.02,.36,1.02),[.8,.72,.9]),0xe9eaec,.02).add(im,box(L(-.39,.36,1.02),[.02,.66,.86]),0x2c6db8,.02).add(im,box(L(.02,.73,1.02),[.78,.02,.84]),0x1b1c1e,.05);
  for(let i=0;i<7;i++)inn.add(im,box(L(.02,.745,.68+i*.11),[.74,.01,.03]),0x2a2b2d,.02);
  // leitor bióptico: vidro horizontal no tampo + torre vertical com janela vermelha
  inn.add(imMetal,box(L(.0,.945,-.18),[.46,.012,.4]),0x2b2e33,.02);
  const glassMat=new THREE.MeshStandardMaterial({color:0x200404,emissive:0xff1a1a,emissiveIntensity:.8,roughness:.05,metalness:.3});
  const hg=new THREE.Mesh(new THREE.PlaneGeometry(.36,.3),glassMat);hg.rotation.x=-Math.PI/2;hg.position.set(...L(0,.953,-.18));group.add(hg);
  inn.add(imMetal,box(L(.26,1.16,-.18),[.14,.44,.44]),0x1d1f22,.02).add(imMetal,box(L(.26,1.39,-.18),[.16,.03,.46]),0x2b2e33,.02);
  const vg=new THREE.Mesh(new THREE.PlaneGeometry(.34,.28),glassMat);vg.rotation.y=-Math.PI/2;vg.position.set(...L(.188,1.17,-.18));group.add(vg);
  // leque de laser (linhas aditivas) que acende quando um item passa
  const lp=[];for(let i=0;i<14;i++){const a=i/14*Math.PI;lp.push(V(Math.cos(a)*.17,0,Math.sin(a)*.14-.07),V(-Math.cos(a)*.17,0,-Math.sin(a)*.14+.07));}
  for(let i=0;i<10;i++){const y=.03+i*.024;lp.push(V(.16,y,-.15+i*.03),V(-.18,y+.05,.15-i*.03));}
  const laserMat=new THREE.LineBasicMaterial({color:new THREE.Color(3,.15,.1),transparent:true,opacity:.25,blending:THREE.AdditiveBlending,depthWrite:false});
  const laser=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lp),laserMat);laser.position.set(...L(0,.958,-.18));laser.frustumCulled=false;group.add(laser);
  // leitor de mão no suporte (decoração)
  inn.add(im,box(L(.33,1.0,.25),[.08,.06,.12]),0x1d1f22,.02).add(im,box(L(.33,1.06,.22),[.05,.12,.05],[.4,0,0]),0x1d1f22,.02).add(im,box(L(.33,1.12,.25),[.07,.05,.1]),0xf3d73a,.02);
  // tela sensível ao toque num braço, inclinada para o cliente
  inn.add(imMetal,limb(V(...L(.3,.94,-.02)),V(...L(.3,1.5,-.02)),.03,.025,8),0x2b2e33).add(imMetal,box(L(.3,1.5,-.02),[.08,.08,.08]),0x1d1f22,.02);
  const mon=new THREE.Group();mon.position.set(...L(.25,1.62,-.02));mon.rotation.set(0,-Math.PI/2,0);mon.rotateX(-.3);group.add(mon);
  const bez=new THREE.Mesh(new THREE.BoxGeometry(.58,.44,.045),new THREE.MeshStandardMaterial({color:0x17191c,roughness:.4,metalness:.3}));bez.position.z=-.024;mon.add(bez);
  const sc=document.createElement('canvas');sc.width=512;sc.height=384;const ctx=sc.getContext('2d');const tex=new THREE.CanvasTexture(sc);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=8;
  const scr=new THREE.Mesh(new THREE.PlaneGeometry(.53,.4),new THREE.MeshStandardMaterial({map:tex,emissive:0xffffff,emissiveMap:tex,emissiveIntensity:.95,roughness:.25}));scr.position.z=.001;mon.add(scr);
  const logoBar=new THREE.Mesh(new THREE.PlaneGeometry(.2,.028),new THREE.MeshStandardMaterial({color:0x2c6db8,emissive:0x2c6db8,emissiveIntensity:.4}));logoBar.position.set(0,-.205,.001);mon.add(logoBar);
  // impressora de cupom (fenda) e o papel que sai
  inn.add(imMetal,box(L(.3,1.06,-.62),[.18,.2,.2]),0xdfe2e5,.02).add(im,box(L(.21,1.1,-.62),[.01,.012,.12]),0x111111,.01);
  const paper=new THREE.Mesh(new THREE.PlaneGeometry(.1,.3).translate(0,-.15,0),new THREE.MeshStandardMaterial({color:0xfbfbf6,roughness:.9,side:THREE.DoubleSide}));paper.position.set(...L(.205,1.105,-.62));paper.rotation.set(0,-Math.PI/2,0);paper.scale.y=.001;group.add(paper);
  // maquininha de cartão no suporte giratório, virada para o cliente
  inn.add(imMetal,limb(V(...L(-.2,.94,-.72)),V(...L(-.2,1.03,-.72)),.02,.02,8),0x2b2e33);
  const pad=new THREE.Group();pad.position.set(...L(-.2,1.1,-.72));pad.rotation.set(0,-Math.PI/2,0);pad.rotateX(-.55);group.add(pad);
  const pb=new THREE.Mesh(new THREE.BoxGeometry(.09,.17,.035),new THREE.MeshStandardMaterial({color:0x222529,roughness:.45}));pad.add(pb);
  const padMat=new THREE.MeshStandardMaterial({color:0x061006,emissive:0x40ff70,emissiveIntensity:.8});const ps=new THREE.Mesh(new THREE.PlaneGeometry(.07,.045),padMat);ps.position.set(0,.05,.018);pad.add(ps);
  for(let i=0;i<12;i++){const k=new THREE.Mesh(new THREE.BoxGeometry(.017,.011,.006),new THREE.MeshStandardMaterial({color:i===9?0xd62028:i===11?0x2fa84a:0xd8dade,roughness:.5}));k.position.set(-.022+(i%3)*.022,.005-Math.floor(i/3)*.017,.019);pad.add(k);}
  const card=new THREE.Mesh(new THREE.BoxGeometry(.055,.004,.085),new THREE.MeshStandardMaterial({color:0x2c6db8,metalness:.4,roughness:.3}));card.visible=false;group.add(card);
  // balança de ensacar com porta-sacolas e uma sacola aberta
  inn.add(imMetal,box(L(.02,.4,-1.75),[.82,.8,.96]),0xe9eaec,.02).add(im,box(L(-.41,.4,-1.75),[.02,.72,.92]),0x2c6db8,.02).add(imMetal,box(L(.02,.815,-1.75),[.76,.03,.9]),0xb9c0c6,.02);
  for(const z of [-1.35,-2.15])inn.add(imMetal,limb(V(...L(.28,.83,z)),V(...L(.28,1.32,z)),.012,.012,6),0x9aa0a6);inn.add(imMetal,limb(V(...L(.28,1.32,-1.35)),V(...L(.28,1.32,-2.15)),.012,.012,6),0x9aa0a6);
  inn.add(im,sculpt(new THREE.CylinderGeometry(.19,.16,.42,14,3,true),q=>{q.x*=1+Math.sin(q.y*18+q.z*9)*.04;q.z*=.75;}).translate(u+.1,F+1.05,v-1.75),0xf4f4f0,.05);
  // torre de luz com a lâmpada (verde livre · amarelo em uso · vermelho alarme) e o número do caixa
  inn.add(imMetal,limb(V(...L(.32,.94,.95)),V(...L(.32,2.2,.95)),.028,.028,8),0x2b2e33);
  const lampMat=new THREE.MeshStandardMaterial({color:0x103010,emissive:0x40ff70,emissiveIntensity:1.6,roughness:.3,transparent:true,opacity:.92});
  const lamp=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,.18,18),lampMat);lamp.position.set(...L(.32,2.3,.95));group.add(lamp);
  inn.add(imMetal,new THREE.CylinderGeometry(.085,.085,.03,18).translate(...L(.32,2.2,.95)),0x1d1f22,.02).add(imMetal,new THREE.CylinderGeometry(.08,.06,.04,18).translate(...L(.32,2.41,.95)),0x1d1f22,.02);
  const num=new THREE.Mesh(new THREE.CylinderGeometry(.17,.17,.05,24).rotateZ(Math.PI/2),new THREE.MeshStandardMaterial({map:canvasTex(128,128,(c)=>{c.fillStyle='#2c6db8';c.fillRect(0,0,128,128);c.fillStyle='#fff';c.font='bold 88px Arial';c.textAlign='center';c.textBaseline='middle';c.fillText(String(n),64,70);}),emissive:0xffffff,emissiveIntensity:.35}));num.material.emissiveMap=num.material.map;num.position.set(...L(.32,2.62,.95));group.add(num);
  const sticker=new THREE.Mesh(new THREE.PlaneGeometry(.5,.16),new THREE.MeshStandardMaterial({map:canvasTex(320,100,(c,w,h)=>{c.fillStyle='#f3d73a';c.fillRect(0,0,w,h);c.fillStyle='#1f4f98';c.font='bold 30px Arial';c.textAlign='center';c.fillText('AUTOATENDIMENTO',w/2,42);c.font='bold 22px Arial';c.fillText('passe · pague · leve',w/2,78);}),roughness:.6}));
  sticker.position.set(...L(-.425,.78,-.18));sticker.rotation.y=-Math.PI/2;group.add(sticker);
  colliders.push({x0:u-.45,x1:u+.45,z0:v-2.3,z1:v+1.5});
  // ---------- estado vivo ----------
  const lane={n,u,v,scan:[u+.05,F+1.08,v-.18],pay:[u-.2,F+1.1,v-.72],screenAt:[u+.25,F+1.62,v-.02],flash:0,print:0,cardT:0,state:null,
    draw(st){this.state=st;const c=ctx,w=512,h=384;c.fillStyle='#eef2f6';c.fillRect(0,0,w,h);c.fillStyle='#2c6db8';c.fillRect(0,0,w,58);drawLogo(c,98,44,36,{sub:false,color:'#f3d73a'});
      c.fillStyle='#fff';c.font='bold 20px Arial';c.textAlign='right';c.fillText('CAIXA '+n,w-16,36);
      const mode=st?.mode||'idle';
      if(mode==='idle'){c.fillStyle='#1f2a36';c.textAlign='center';c.font='bold 30px Arial';c.fillText('Bem-vindo!',w/2,128);c.font='22px Arial';c.fillText('Pegue os itens na Loja do Pescador',w/2,172);c.fillText('e segure cada um sobre o leitor.',w/2,202);
        c.fillStyle='#6fb83a';c.beginPath();c.roundRect(136,250,240,64,14);c.fill();c.fillStyle='#fff';c.font='bold 24px Arial';c.fillText('PASSE O PRIMEIRO ITEM',w/2,290);return;}
      c.textAlign='left';c.fillStyle='#1f2a36';c.font='bold 17px Arial';c.fillText(st.who||'',16,84);c.textAlign='right';c.fillStyle='#6a7380';c.font='15px Arial';c.fillText('Saldo da tripulação '+money(st.money||0),w-16,84);
      const list=st.items||[];c.textAlign='left';const top=98,rowH=30,start=Math.max(0,list.length-6);
      for(let i=start;i<list.length;i++){const y=top+(i-start)*rowH;c.fillStyle=(i%2)?'#ffffff':'#f4f7fa';c.fillRect(12,y,w-24,rowH-2);c.fillStyle='#1f2a36';c.font='18px Arial';c.fillText(String(i+1).padStart(2,'0')+'  '+list[i].name,22,y+21);c.textAlign='right';c.font='bold 18px Arial';c.fillText(money(list[i].price),w-22,y+21);c.textAlign='left';}
      if(st.pending){c.fillStyle='#8a94a0';c.font='italic 16px Arial';c.fillText(`+ ${st.pending} na cesta para passar`,22,top+Math.min(6,list.length)*rowH+18);}
      c.fillStyle='#1d3354';c.fillRect(0,h-92,w,92);c.fillStyle='#fff';c.font='bold 20px Arial';c.fillText('TOTAL',20,h-56);c.textAlign='right';c.font='bold 38px Arial';c.fillStyle='#f3d73a';c.fillText(money(st.total||0),w-20,h-46);
      c.textAlign='center';c.font='bold 17px Arial';
      const msg={scan:['#6fb83a','Segure o próximo item no leitor · E na maquininha paga'],pay:['#2c6db8','Aproxime o cartão na maquininha…'],done:['#6fb83a','PAGO! Retire o cupom · volte sempre'],fail:['#d62028','SALDO INSUFICIENTE · devolva algo na prateleira'],alarm:['#d62028','ATENÇÃO: chame um atendente']}[mode]||['#6fb83a',''];
      c.fillStyle=msg[0];c.fillRect(0,h-22,w,22);c.fillStyle='#fff';c.fillText(msg[1],w/2,h-6);tex.needsUpdate=true;},
    beep(){this.flash=1;},printReceipt(){this.print=.001;},tapCard(){this.cardT=1.4;},
    update(t,dt,mode){this.flash=Math.max(0,this.flash-dt*3.5);laserMat.opacity=.18+this.flash*.8+Math.sin(t*40)*.03;laser.rotation.y=Math.sin(t*3)*.25;glassMat.emissiveIntensity=.7+this.flash*2.5;
      const col=mode==='alarm'||mode==='fail'?[0xff2a20,0x401010]:mode&&mode!=='idle'?[0xffc21a,0x403010]:[0x40ff70,0x103010];lampMat.emissive.setHex(col[0]);lampMat.color.setHex(col[1]);lampMat.emissiveIntensity=mode==='alarm'?(Math.sin(t*14)>0?3.5:.4):1.6;
      if(this.print>0){this.print=Math.min(1,this.print+dt*.9);paper.scale.y=this.print;}else paper.scale.y=.001;if(mode!=='done'&&this.print>=1)this.print=0;
      if(this.cardT>0){this.cardT-=dt;card.visible=true;const k=Math.min(1,(1.4-this.cardT)/.5)*(this.cardT>.3?1:this.cardT/.3);card.position.set(u-.2-.25*(1-k),F+1.18,v-.72);card.rotation.set(0,0,-.55*k);}else card.visible=false;
      padMat.emissiveIntensity=mode==='pay'?1.3+Math.sin(t*8)*.4:.8;}};
  lane.draw(null);return lane;
}
// ----- ícones: cada item fotografado numa mesa de estúdio (renderer próprio, descartado depois) -----
export function renderIcons(ids,makeItem,size=128){const out={};if(typeof document==='undefined')return out;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;let r;try{r=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,preserveDrawingBuffer:true});}catch{return out;}
  r.outputColorSpace=THREE.SRGBColorSpace;r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.15;r.setClearColor(0x000000,0);
  const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xfff6e8,0x3a4250,2.2));const key=new THREE.DirectionalLight(0xffffff,2.6);key.position.set(2,3,4);scene.add(key);const rim=new THREE.DirectionalLight(0x9fd0ff,1.4);rim.position.set(-3,1,-2);scene.add(rim);
  const cam=new THREE.PerspectiveCamera(30,1,.01,50);
  for(const id of ids){try{const m=makeItem(id),g=new THREE.Group();g.add(m);g.rotation.set(.35,-.6,0);g.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(g),c=b.getCenter(V()),s=b.getSize(V()).length();g.position.sub(c);scene.add(g);
      cam.position.set(0,0,s*1.75);cam.lookAt(0,0,0);r.render(scene,cam);out[id]=canvas.toDataURL('image/png');scene.remove(g);}catch(e){console.warn('ícone',id,e);}}
  r.dispose();r.forceContextLoss?.();return out;}
// isca de corte (não tem modelo na loja): desenho
export function cutIcon(size=128){if(typeof document==='undefined')return '';const c=document.createElement('canvas');c.width=c.height=size;const x=c.getContext('2d');x.translate(size/2,size/2);
  for(let i=0;i<3;i++){x.save();x.rotate(-.5+i*.45);x.translate(-18+i*18,-6+i*8);const g=x.createLinearGradient(-26,0,26,0);g.addColorStop(0,'#d98a7a');g.addColorStop(.5,'#f2c1b0');g.addColorStop(1,'#b8584a');x.fillStyle=g;x.beginPath();x.roundRect(-26,-14,52,28,9);x.fill();x.fillStyle='#8a9aa6';x.fillRect(-26,-14,52,7);x.restore();}
  return c.toDataURL();}

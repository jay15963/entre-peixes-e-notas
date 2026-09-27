import * as THREE from 'three';
// Corda com física de Verlet (pontos com inércia + restrições de comprimento), desenhada como um tubo trançado
// que é refeito a cada quadro. Serve para o laço girando, o arremesso, a amarração no cais e o resgate.
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
function ropeTexture(){
  if(typeof document==='undefined')return null;const c=document.createElement('canvas');c.width=64;c.height=64;const x=c.getContext('2d');
  x.fillStyle='#b8925a';x.fillRect(0,0,64,64);
  // três pernas torcidas: faixas diagonais claras e escuras
  for(let i=-2;i<6;i++){x.fillStyle=i%3===0?'#8a6a3a':i%3===1?'#d4b27a':'#a8834c';x.beginPath();x.moveTo(i*21,0);x.lineTo(i*21+21,0);x.lineTo(i*21+21+64,64);x.lineTo(i*21+64,64);x.fill();}
  x.globalAlpha=.25;for(let i=0;i<200;i++){x.fillStyle=Math.random()<.5?'#fff':'#3a2a14';x.fillRect(Math.random()*64,Math.random()*64,1,2);}
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;return t;
}
export class Rope {
  constructor(parent,{segments=30,radius=.017,radial=6}={}){
    this.n=segments;this.radial=radial;this.radius=radius;this.p=[];this.o=[];for(let i=0;i<=segments;i++){this.p.push(V());this.o.push(V());}
    const N=segments+1,R=radial;this.pos=new Float32Array(N*R*3);this.nor=new Float32Array(N*R*3);const uv=new Float32Array(N*R*2),idx=[];
    for(let i=0;i<N;i++)for(let j=0;j<R;j++){uv[(i*R+j)*2]=j/R;uv[(i*R+j)*2+1]=i*.9;}
    for(let i=0;i<segments;i++)for(let j=0;j<R;j++){const a=i*R+j,b=i*R+(j+1)%R,c=(i+1)*R+j,d=(i+1)*R+(j+1)%R;idx.push(a,b,c,b,d,c);}
    const g=new THREE.BufferGeometry();g.setIndex(idx);g.setAttribute('position',new THREE.BufferAttribute(this.pos,3));g.setAttribute('normal',new THREE.BufferAttribute(this.nor,3));g.setAttribute('uv',new THREE.BufferAttribute(uv,2));
    this.mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({map:ropeTexture(),roughness:.95,color:0xffffff}));this.mesh.frustumCulled=false;this.mesh.castShadow=true;parent.add(this.mesh);
    // laço na ponta (argola de corda)
    this.loop=new THREE.Mesh(new THREE.TorusGeometry(.3,.02,6,20),this.mesh.material);this.loop.castShadow=true;parent.add(this.loop);
    this.mesh.visible=this.loop.visible=false;this.ready=false;this.len=5;
  }
  set visible(v){this.mesh.visible=this.loop.visible=v;}
  get visible(){return this.mesh.visible;}
  reset(a,b){for(let i=0;i<=this.n;i++){this.p[i].lerpVectors(a,b,i/this.n);this.o[i].copy(this.p[i]);}this.ready=true;}
  // a: ponta presa (mão ou cunho); b: outra ponta presa ou null (solta); floor(x,z) devolve o chão/água
  step(dt,a,b,len,floor,{loopDir=null,loopR=.3}={}){
    if(!this.ready)this.reset(a,b||a.clone().add(V(0,-len,0)));
    const n=this.n,seg=len/n,h=Math.min(dt,1/30),sub=2,hs=h/sub;this.len=len;
    for(let s=0;s<sub;s++){
      for(let i=0;i<=n;i++){const p=this.p[i],o=this.o[i];if(i===0||(i===n&&b))continue;const vx=(p.x-o.x)*.985,vy=(p.y-o.y)*.985,vz=(p.z-o.z)*.985;o.copy(p);p.x+=vx;p.y+=vy-9.8*hs*hs;p.z+=vz;}
      for(let it=0;it<14;it++){this.p[0].copy(a);if(b)this.p[n].copy(b);
        for(let i=0;i<n;i++){const p=this.p[i],q=this.p[i+1],dx=q.x-p.x,dy=q.y-p.y,dz=q.z-p.z,d=Math.sqrt(dx*dx+dy*dy+dz*dz)||1e-6;if(d<=seg)continue;const k=(d-seg)/d*.5,wp=i===0?0:1,wq=(i+1===n&&b)?0:1,sum=wp+wq||1;
          p.x+=dx*k*2*wp/sum;p.y+=dy*k*2*wp/sum;p.z+=dz*k*2*wp/sum;q.x-=dx*k*2*wq/sum;q.y-=dy*k*2*wq/sum;q.z-=dz*k*2*wq/sum;}
        if(floor)for(let i=1;i<=n;i++){const p=this.p[i],f=floor(p.x,p.z);if(p.y<f){p.y=f;const o=this.o[i];o.x+=(p.x-o.x)*.35;o.z+=(p.z-o.z)*.35;}}}
    }
    this.build(loopDir,loopR);
  }
  build(loopDir,loopR){
    const n=this.n,R=this.radial,T=V(),N=V(0,1,0),B=V(),tmp=V();
    for(let i=0;i<=n;i++){const p=this.p[i],q=this.p[Math.min(n,i+1)],r=this.p[Math.max(0,i-1)];T.subVectors(q,r).normalize();if(T.lengthSq()<1e-6)T.set(0,0,1);
      // transporte paralelo do normal ao longo da corda (sem torção brusca)
      tmp.copy(N).addScaledVector(T,-N.dot(T));if(tmp.lengthSq()<1e-6)tmp.set(1,0,0).addScaledVector(T,-T.x);N.copy(tmp.normalize());B.crossVectors(T,N);
      for(let j=0;j<R;j++){const a=j/R*Math.PI*2,c=Math.cos(a),s=Math.sin(a),k=(i*R+j)*3;const nx=N.x*c+B.x*s,ny=N.y*c+B.y*s,nz=N.z*c+B.z*s;
        this.pos[k]=p.x+nx*this.radius;this.pos[k+1]=p.y+ny*this.radius;this.pos[k+2]=p.z+nz*this.radius;this.nor[k]=nx;this.nor[k+1]=ny;this.nor[k+2]=nz;}}
    const g=this.mesh.geometry;g.attributes.position.needsUpdate=true;g.attributes.normal.needsUpdate=true;g.computeBoundingSphere();
    // argola: deitada ao redor do cabeço, ou de pé girando no ar
    const end=this.p[n];this.loop.position.copy(end);this.loop.scale.setScalar(loopR/.3);
    if(loopDir){this.loop.quaternion.setFromUnitVectors(V(0,0,1),loopDir);}else{const d=V().subVectors(this.p[n],this.p[n-1]).normalize();this.loop.quaternion.setFromUnitVectors(V(0,0,1),d.lengthSq()?d:V(0,1,0));}
  }
  end(){return this.p[this.n];}
}
// Rolo de corda (em repouso no convés ou na mão)
export function makeCoil(){const g=new THREE.Group(),m=new THREE.MeshStandardMaterial({map:ropeTexture(),roughness:.95});
  for(let i=0;i<5;i++){const t=new THREE.Mesh(new THREE.TorusGeometry(.2+i*.012,.022,6,22),m);t.rotation.x=Math.PI/2+(Math.random()-.5)*.25;t.rotation.y=(Math.random()-.5)*.2;t.position.y=i*.028;t.castShadow=true;g.add(t);}
  return g;}

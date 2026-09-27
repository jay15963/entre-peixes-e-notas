import * as THREE from 'three';
import {surface,material,hose,v} from './artisan.js';
import {Kit} from './geometry.js';

// Coordinates are in metres, relative to the occiput at (0, 10, 4.3).
// The skull and mandibular shells are authored separately, with lips, sockets,
// tooth roots and soft tissues sharing the same anatomical section functions.
const TAU=Math.PI*2;
const clamp=THREE.MathUtils.clamp;
const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const gauss=(x,c,w)=>Math.exp(-(((x-c)/w)**2));
const skullSections=[
  [-.7,.73,-.42,.92],[-.28,.99,-.41,1.15],[.25,1.29,-.43,1.22],
  [.72,1.39,-.44,1.09],[1.18,1.28,-.43,.88],[1.62,1.02,-.40,.61],
  [2.13,.84,-.35,.44],[2.66,.79,-.30,.43],[3.05,.77,-.25,.45],
  [3.34,.61,-.22,.34],[3.58,.35,-.20,.19],[3.68,.012,-.13,-.1]
];
function section(z,table=skullSections){
  let i=0;while(i<table.length-2&&z>table[i+1][0])i++;
  const a=table[i],b=table[i+1],p=table[Math.max(0,i-1)],q=table[Math.min(table.length-1,i+2)],t=clamp((z-a[0])/(b[0]-a[0]),0,1);
  return a.slice(1).map((x,k)=>{const j=k+1,m0=(b[j]-p[j])/(b[0]-p[0])*(b[0]-a[0]),m1=(q[j]-a[j])/(q[0]-a[0])*(b[0]-a[0]);return (2*t**3-3*t*t+1)*x+(t**3-2*t*t+t)*m0+(-2*t**3+3*t*t)*b[j]+(t**3-t*t)*m1;});
}
export function cranialSurface(z,a,lift=0){
  const [w,lip,top]=section(z),sn=Math.sin(a),cs=Math.cos(a),upper=Math.max(0,sn);
  let x=Math.sign(cs)*Math.abs(cs)**.77*w,y=lip+(sn>=0?(top-lip)*upper**.78:-.105*(-sn)**.8);
  // Sculpt the orbit into the actual skull. Broad depressions under the brow
  // and behind the masseter prevent a balloon-like, uniformly convex head.
  const orbit=gauss(z,1.05,.36)*gauss(upper,.58,.20);
  x-=Math.sign(x)*orbit*.205;
  y-=gauss(z,1.19,.42)*gauss(upper,.78,.22)*.105;
  y+=gauss(z,2.4,.9)*gauss(Math.abs(cs),.38,.19)*.095; // paired nasal ridges
  const narialCavity=gauss(z,2.97,.17)*gauss(upper,Math.sin(.67),.11);
  x-=Math.sign(x)*narialCavity*.06;y-=narialCavity*.10;
  const relief=(Math.sin(z*47+cs*19)*Math.sin(a*39-z*13)+Math.sin(z*81+a*57)*.3)*.0035;
  x+=cs*(relief+lift);y+=sn*(relief+lift);
  return new THREE.Vector3(x,y,z);
}
function paint(g,fn){const p=g.attributes.position,colors=[];for(let i=0;i<p.count;i++){const c=fn(p.getX(i),p.getY(i),p.getZ(i),i);colors.push(c.r,c.g,c.b);}g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));return g;}
function skinColor(x,y,z){
  const mottling=Math.sin(z*12+x*19+Math.sin(y*17))*Math.sin(y*23-x*7);
  const freckle=Math.max(0,Math.sin(z*61+x*47)*Math.cos(y*59-z*16));
  return new THREE.Color(0x304d40).lerp(new THREE.Color(0x697158),clamp((.1-y)*.45,0,.5)).multiplyScalar(.90+mottling*.13-freckle*.15);
}
function swept(points,radii,{segments=16,steps=36,flatten=1,grooves=0}={}){
  const c=new THREE.CatmullRomCurve3(points.map(v)),frames=c.computeFrenetFrames(steps,false);
  return surface(Array.from({length:steps+1},(_,j)=>{const t=j/steps,k=t*(radii.length-1),i=Math.min(radii.length-2,Math.floor(k)),r=THREE.MathUtils.lerp(radii[i],radii[i+1],k-i),center=c.getPoint(t);
    return Array.from({length:segments},(_,s)=>{const a=s/segments*TAU,rr=r*(1+grooves*Math.sin(a*7+t*8));return center.clone().addScaledVector(frames.normals[j],Math.cos(a)*rr).addScaledVector(frames.binormals[j],Math.sin(a)*rr*flatten).toArray();});}));
}
// Beveled dermal plate: three irregular concentric polygon loops and a domed
// center. Its perimeter follows the skull instead of hovering above it.
function shield(z,a,dz,da,index,height=.026){
  const outline=Array.from({length:7},(_,k)=>{const t=k/7*TAU,r=.86+hash(index*17+k)*.23;return [Math.cos(t)*dz*r,Math.sin(t)*da*r];});
  const rows=[1,.78,.3,0].map((r,j)=>outline.map(([u,b])=>cranialSurface(z+u*r,a+b*r,[.002,height*.75,height,height*.82][j]).toArray()));
  return paint(surface(rows),(x,y,zz)=>skinColor(x,y,zz).multiplyScalar(.92+hash(index)*.22));
}
function irisPatch(center,n,u,up,r,kind){
  return surface(Array.from({length:13},(_,j)=>{const t=j/12;return Array.from({length:64},(_,i)=>{const a=i/64*TAU;const horizontal=kind==='pupil'?r*.17:r;return center.clone().addScaledVector(u,Math.cos(a)*horizontal*t).addScaledVector(up,Math.sin(a)*r*t).addScaledVector(n,.014*(1-t*t)).toArray();});}),(_,j,i)=>{
    if(kind==='pupil')return new THREE.Color(0x040a08);
    const radial=Math.sin(i*2.4+j*.43)*.18+Math.sin(i*.91)*.12,edge=j>10?.58:1;
    return new THREE.Color(0xa58a39).lerp(new THREE.Color(0x4e3820),j/12*.5).multiplyScalar((.9+radial)*edge);
  });
}
function makeOrbit(kit,m,s){
  const a=s===1?.63:Math.PI-.63,center=cranialSurface(1.08,a,.027),n=new THREE.Vector3(s*.94,.16,.3).normalize(),u=new THREE.Vector3(-s*.3,0,.94).normalize(),up=new THREE.Vector3().crossVectors(n,u).normalize().multiplyScalar(-s);
  function aperture(t,scale=1,depth=0){const x=Math.cos(t)*.238*scale,y=Math.sin(t)*.112*scale-.18*x;return center.clone().addScaledVector(u,x).addScaledVector(up,y).addScaledVector(n,depth);}
  const socket=surface([1,1.25,1.65,2.1].map((scale,j)=>Array.from({length:64},(_,i)=>aperture(i/64*TAU,scale,[.054,.061,.003,-.12][j]).toArray())));
  kit.add(m.skin,paint(socket,skinColor));
  const cornea=surface(Array.from({length:13},(_,j)=>Array.from({length:64},(_,i)=>aperture(i/64*TAU,j/12,.052+.022*(1-(j/12)**2)).toArray())));
  kit.add(m.eye,cornea,0x252b1b,0);
  const eyeCenter=center.clone().addScaledVector(n,.085).addScaledVector(u,.035);
  kit.add(m.eye,irisPatch(eyeCenter,n,u,up,.083,'iris'));
  kit.add(m.eye,irisPatch(eyeCenter.clone().addScaledVector(n,.017),n,u,up,.067,'pupil'));
  // Upper lid is a heavy, slanted fold, lower lid is a thin wet rim.
  for(const upper of [true,false]){
    const path=Array.from({length:25},(_,i)=>aperture((upper?0:Math.PI)+i/24*Math.PI,1.05,.079).toArray());
    kit.add(upper?m.skin:m.wet,hose(path,t=>(upper?.022:.008)*Math.sin(Math.PI*t)+.004,10,32),upper?0x354c3a:0x596045,.018);
  }
  // Broad supraorbital ridge merges back into the temporal fossa; no separate
  // cartoon eyebrow or protruding spherical eyeball.
  kit.add(m.armor,paint(swept([[s*.89,.62,1.65],[s*1.15,.91,1.13],[s*1.28,1.02,.55],[s*1.18,1.05,.05]],[.012,.17,.22,.015],{flatten:.6,grooves:.09}),skinColor));
  return center;
}
function makeNaris(kit,m,s){
  const center=cranialSurface(2.97,s===1?.67:Math.PI-.67,.015),n=new THREE.Vector3(s*.52,.84,.12).normalize(),u=new THREE.Vector3(.85,-s*.52,0).normalize(),up=new THREE.Vector3().crossVectors(n,u).normalize();
  center.addScaledVector(n,.10);
  const rows=[0,.55,1,1.25,1.6].map((r,j)=>Array.from({length:40},(_,i)=>{const a=i/40*TAU;return center.clone().addScaledVector(u,Math.cos(a)*.09*r).addScaledVector(up,Math.sin(a)*.155*r).addScaledVector(n,[-.036,-.03,.009,.052,-.025][j]).toArray();}));
  const g=surface(rows,(_,j)=>new THREE.Color(j<2?0x081711:j===2?0x202e24:0x3e5341));kit.add(m.skin,g);
}
function tooth(points,radius,length,index){
  const g=swept(points,[radius,radius*.84,radius*.41,.0006],{segments:14,steps:22,grooves:.045});
  return paint(g,(x,y,z,i)=>{
    const row=Math.floor(i/14)/22,base=new THREE.Color(0x817958),tip=new THREE.Color(0xc7c8a4),stain=.88+.08*Math.sin(z*46+x*21)+.045*Math.cos(i%14*3);
    return base.lerp(tip,clamp(row*1.8,0,1)).multiplyScalar(stain*(index%9===0?.85:1));
  });
}

const jawSections=[[0,.85,-.03,-.33],[.4,1.15,-.035,-.42],[.9,1.11,.005,-.43],[1.5,.95,.035,-.36],[2.1,.78,.09,-.26],[2.65,.735,.13,-.21],[3.02,.56,.14,-.16],[3.22,.18,.14,.055],[3.32,.01,.14,.11]];
function jawPoint(z,a,lift=0){const [w,rim,base]=section(z,jawSections),sn=Math.sin(a);return new THREE.Vector3(Math.cos(a)*w,rim+(sn<0?(rim-base)*sn:.014*sn),z).addScaledVector(new THREE.Vector3(Math.cos(a),Math.sin(a),0),lift);}
function buildMandible(m){
  const jaw=new THREE.Group();jaw.name='Mandíbula articulada';jaw.position.set(0,-.51,.3);const k=new Kit();
  const shell=surface(Array.from({length:81},(_,j)=>Array.from({length:80},(_,i)=>jawPoint(j/80*3.32,i/80*TAU).toArray())));
  k.add(m.skin,paint(shell,(x,y,z)=>skinColor(x,y-.4,z).multiplyScalar(.9)));
  // The oral floor is a concave mucosal sheet with a recessed tongue. It meets
  // the lip curve on both sides instead of intersecting the teeth as a plank.
  const floor=surface(Array.from({length:61},(_,j)=>{const z=.04+j/60*3.25,[w,rim]=section(z,jawSections);return Array.from({length:33},(_,i)=>{const u=i/32*2-1;return [u*w*.95,rim+.034-.11*(1-u*u),z];});}),undefined,false);
  k.add(m.wet,paint(floor,(x,y,z)=>new THREE.Color(0x402c2a).multiplyScalar(.84+.10*Math.sin(z*23+x*16))));
  const tongue=swept([[0,-.115,.2],[0,-.085,1.1],[0,.015,2.1],[0,.1,2.8]],[.035,.25,.16,.002],{segments:32,steps:48,flatten:.2});k.add(m.wet,tongue,0x664038,.025);
  for(const s of [-1,1]){
    const lip=Array.from({length:49},(_,i)=>{const z=.03+i/48*3.25,[w,rim]=section(z,jawSections);return [s*w*.976,rim+.033,z];});k.add(m.wet,hose(lip,.04,12,64),0x515540,.025);
    for(let j=0;j<27;j++){const z=.15+j*.102,[w,rim]=section(z,jawSections);k.add(m.skin,hose([[s*w*.97,rim-.035,z-.03],[s*w*1.015,rim-.07,z],[s*w*.94,rim-.15,z+.04]],.012,6,10),j%3?0x52664f:0x758068,.04);}
    // Interleaved teeth are rooted into the alveolar ridge. Variable size,
    // backwards curvature and one damaged crown avoid a uniform picket fence.
    for(let i=0;i<19;i++){
      const z=.25+i*.147,[w,rim]=section(z,jawSections),x=s*w*.86,length=(.17+.14*Math.sin(i*.83)**2)*(i===6?1.45:1)*(s<0&&i===12?.43:1),r=.047+(i%4)*.004;
      const points=[[x,rim-.025,z],[x*.985,rim+length*.35,z-.02],[x*.955,rim+length*.82,z-.075],[x*.93,rim+length,z-.14]];
      k.add(m.ivory,tooth(points,r,length,i));k.add(m.wet,hose([[x-.035,rim+.025,z],[x,rim+.039,z+.032],[x+.035,rim+.025,z]],.012,8,10),0x655642,.02);
    }
    for(let i=0;i<10;i++){const z=.2+i*.21,[w,rim]=section(z,jawSections);k.add(m.skin,swept([[s*w*.95,rim-.1,z],[s*w*.998,rim-.22,z-.045],[s*w*.92,rim-.29,z-.15]],[.025,.026,.001],{segments:10,steps:12}),0x3e5240,.04);}
  }
  jaw.add(k.build());return jaw;
}

export function makeNessieHead(){
  const head=new THREE.Group();head.name='Crânio esculpido · Nessie';head.position.set(0,10,4.3);
  const m={skin:material(0xffffff,.025,.68,{side:THREE.DoubleSide}),armor:material(0xffffff,.045,.62,{side:THREE.DoubleSide}),ivory:material(0xffffff,.025,.39),wet:material(0xffffff,.025,.3,{side:THREE.DoubleSide}),eye:material(0xffffff,.05,.13,{side:THREE.DoubleSide})};
  const kit=new Kit();
  const skull=surface(Array.from({length:145},(_,j)=>Array.from({length:112},(_,i)=>cranialSurface(-.7+j/144*4.38,i/112*TAU).toArray())));
  const skullMesh=new THREE.Mesh(paint(skull,skinColor),m.skin);skullMesh.name='Crânio contínuo com órbitas esculpidas';head.add(skullMesh);
  // Fine irregular scales belong to cheeks and muzzle; the vault instead has
  // larger interlocking plates. Leave the orbital depression unobstructed.
  for(let j=0;j<54;j++)for(let i=0;i<23;i++){
    const z=-.36+j*.069+(hash(j*53+i)-.5)*.026,a=.055+i/22*(Math.PI-.11)+(j%2)*.054;
    if(z<1.58&&Math.sin(a)>.78)continue;
    if(Math.abs(z-1.05)<.48&&Math.abs(Math.sin(a)-.58)<.26)continue;
    if(Math.abs(z-2.97)<.24&&Math.abs(Math.sin(a)-Math.sin(.67))<.18)continue;
    kit.add(m.skin,shield(z,a,.034+hash(i*24+j)*.012,.053+hash(j*8+i)*.018,j*29+i,.011+hash(i+j)*.014));
  }
  for(let j=0;j<10;j++)for(let i=0;i<5;i++){
    const z=-.42+j*.18,a=.90+i*.34+(j%2)*.09;kit.add(m.armor,shield(z,a,.12,.18,j*7+i, .045+hash(j*11+i)*.04));
  }
  // Paired temporal crests grow out of the back of the skull. Asymmetrical
  // chipped ends, longitudinal fluting and dark roots replace smooth horns.
  for(const s of [-1,1]){
    const crest=swept([[s*.77,.98,.45],[s*1.00,1.24,-.12],[s*1.12,1.4,-.67],[s*(s<0?1.05:1.2),s<0?1.43:1.63,s<0?-1.05:-1.22]],[.25,.23,.14,s<0?.047:.003],{segments:28,steps:52,flatten:.6,grooves:.15});
    kit.add(m.armor,paint(crest,(x,y,z)=>new THREE.Color(0x354c3b).lerp(new THREE.Color(0x898970),clamp((-.1-z)*.7,0,.8)).multiplyScalar(.87+.10*Math.sin(z*42+x*27))));
    // Masseter tendon, cheek shields and rearward sensory spurs.
    kit.add(m.skin,paint(swept([[s*1.07,-.34,.84],[s*1.34,.05,.62],[s*1.25,.43,.1],[s*.89,.57,-.5]],[.03,.15,.21,.03],{flatten:.65}),skinColor));
    for(let j=0;j<5;j++)kit.add(m.armor,paint(swept([[s*(1.2-j*.07),.4-j*.15,.27-j*.13],[s*(1.5-j*.06),.41-j*.14,-.08-j*.14],[s*(1.62-j*.06),.43-j*.14,-.43-j*.15]],[.10,.095,.001],{segments:16,steps:24,flatten:.65,grooves:.08}),skinColor));
    makeOrbit(kit,m,s);makeNaris(kit,m,s);
    const lip=Array.from({length:65},(_,i)=>{const z=.02+i/64*3.54,[w,y]=section(z);return [s*w*.985,y-.013,z];});
    kit.add(m.wet,hose(lip,.046,14,72),0x414b36,.02);
    // Raised sensory pits are nested in the thick labial skin, not scattered
    // floating dots. These stay away from the orbit and narial openings.
    for(let j=0;j<26;j++){const z=1.53+j*.077,[w,y]=section(z);kit.add(m.skin,swept([[s*w*.982,y+.055,z],[s*w*1.004,y+.06,z],[s*w*1.008,y+.06,z]],[.022,.015,.001],{segments:10,steps:6}),0x263e2d,.03);}
    for(let i=0;i<20;i++){
      const z=.17+i*.165,[w,y]=section(z),x=s*w*.88,length=(.19+.19*Math.sin(i*.72)**2)*(i===4||i===13?1.38:1)*(s===1&&i===9?.47:1),r=.052+(i%3)*.007;
      kit.add(m.ivory,tooth([[x,y+.034,z],[x*.99,y-length*.27,z-.009],[x*.97,y-length*.72,z-.067],[x*.94,y-length,z-.145]],r,length,i));
      kit.add(m.wet,hose([[x-.04,y,z],[x,y-.033,z+.04],[x+.04,y,z]],.018,8,10),0x6a5945,.025);
    }
  }
  // A vaulted palate follows the upper dental arch and includes transverse
  // palatal folds. The throat remains dark and recessed behind the molars.
  const palate=surface(Array.from({length:61},(_,j)=>{const z=.02+j/60*3.51,[w,y]=section(z);return Array.from({length:37},(_,i)=>{const u=i/36*2-1;return [u*w*.94,y-.045+.13*(1-u*u),z];});}),undefined,false);kit.add(m.wet,palate,0x302422,.02);
  for(let j=0;j<15;j++){const z=.28+j*.19,[w,y]=section(z);kit.add(m.wet,hose(Array.from({length:15},(_,i)=>{const u=i/14*2-1;return [u*w*.7,y+.04-.05*u*u,z+.045*(1-u*u)];}),.014,6,20),0x4c3630,.025);}
  // Two old diagonal scars interrupt the plate pattern; edge variation is
  // deterministic and the healing tissue is geometrically raised.
  for(let j=0;j<3;j++){
    const points=Array.from({length:24},(_,i)=>cranialSurface(.38+i/23*.83,.93+j*.13+i/23*.24,.037).toArray());
    kit.add(m.skin,hose(points,t=>.007+.015*Math.sin(Math.PI*t),8,32),0x858069,.015);
    for(let k=3;k<21;k+=3){const z=.38+k/23*.83,a=.93+j*.13+k/23*.24;kit.add(m.skin,hose([cranialSurface(z-.014,a-.03,.04).toArray(),cranialSurface(z+.016,a+.025,.04).toArray()],.006,6,4),0x5c6450,.02);}
  }
  head.add(kit.build());const jaw=buildMandible(m);head.add(jaw);
  // Flexible mouth corners span between the fixed upper lip and the jaw hinge.
  const membranes=[];
  for(const s of [-1,1]){
    const geometry=surface(Array.from({length:17},(_,j)=>Array.from({length:17},(_,i)=>[0,0,0])),(_,j,i)=>new THREE.Color(0x3e4030).multiplyScalar(.85+.1*Math.sin(j+i)) ,false);
    const mesh=new THREE.Mesh(geometry,m.wet);mesh.name='Comissura bucal '+s;head.add(mesh);membranes.push({mesh,s});
  }
  // Cache the attachment rows; a moving jaw must not allocate hundreds of vectors each frame.
  const rows=membranes.map(({s})=>Array.from({length:17},(_,j)=>{
    const along=j/16,z=.035+along*.62,[width,y]=section(z+.3),[jw,jy]=section(z,jawSections);
    return {upper:new THREE.Vector3(s*width*.92,y-.02,z+.3),lower:new THREE.Vector3(s*jw*.92,jy+.005,z),bulge:s*.035*Math.sin(along*Math.PI)};
  }));
  const lowerPoint=new THREE.Vector3();let lastGape=Infinity;
  head.setGape=angle=>{
    if(Math.abs(angle-lastGape)<.0005)return;lastGape=angle;
    jaw.rotation.x=angle;jaw.updateMatrix();
    membranes.forEach(({mesh},k)=>{const p=mesh.geometry.attributes.position;
      for(let j=0;j<17;j++){const row=rows[k][j],u=row.upper,l=lowerPoint.copy(row.lower).applyMatrix4(jaw.matrix);
        for(let i=0;i<17;i++){const t=i/16;p.setXYZ(j*17+i,u.x+(l.x-u.x)*t-Math.sin(Math.PI*t)*row.bulge,u.y+(l.y-u.y)*t,u.z+(l.z-u.z)*t);}}
      p.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.boundingSphere??=new THREE.Sphere(new THREE.Vector3(0,0,.4),3);
    });
  };
  head.setGape(.19);head.userData={revision:2,anatomy:'Recessed orbits, cranial vault, masseter, narial rims, alveolar ridges, palate and flexible oral commissures',upperTeeth:40,lowerTeeth:38};
  return head;
}

// Opt-in development harness: /?teste=0&diagnostico=1. Never imported in production.
export function diagnostics(C){
  const panel=document.createElement('aside');panel.id='game-diagnostics';
  panel.style.cssText='position:fixed;z-index:25;left:12px;top:8px;background:#061b26ee;color:#aee0cf;padding:8px;border:1px solid #446d70;border-radius:5px;font:10px monospace;max-width:800px';
  const stats=document.createElement('output');stats.style.display='block';panel.append(stats);
  let samples=[],all=[],max=0,slow=0,seconds=0,last=0,spikes=[];
  const reset=()=>{samples=[];all=[];max=0;slow=0;seconds=0;last=0;spikes=[];};
  for(const [label,fn]of Object.entries(C.actions)){const b=document.createElement('button');b.textContent=label;b.style.cssText='font:10px Arial;padding:5px 9px;margin:6px 5px 0 0;';b.onclick=()=>{fn();reset();};panel.append(b);}
  const clear=document.createElement('button');clear.textContent='Zerar medição';clear.onclick=reset;clear.style.cssText='font:10px Arial;padding:5px;margin:6px 0 0';panel.append(clear);document.body.append(panel);
  return {frame(dt){const ms=dt*1000;seconds+=dt;max=Math.max(ms,max);if(ms>50){slow++;spikes.push(`${seconds.toFixed(1)}s:${ms.toFixed(0)}ms/${C.renderer.info.programs.length}p`);if(spikes.length>5)spikes.shift();}samples.push(ms);if(samples.length>180)samples.shift();all.push(ms);if(all.length>36000)all.shift();
    if(seconds-last<.5)return;last=seconds;const sorted=[...all].sort((a,b)=>a-b),mean=samples.reduce((a,b)=>a+b,0)/samples.length;
    const memory=C.renderer.info.memory;stats.textContent=`${seconds.toFixed(0)} s | ${(1000/mean).toFixed(0)} FPS | p95 ${sorted[Math.floor(sorted.length*.95)].toFixed(1)} ms | maior ${max.toFixed(1)} ms | >50 ms: ${slow} | geometria ${memory.geometries} | texturas ${memory.textures} | programas ${C.renderer.info.programs.length} | picos ${spikes.join(" ")}`;
  }};
}

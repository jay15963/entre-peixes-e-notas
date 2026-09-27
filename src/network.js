import {CONFIG,validPacket} from './core.js';
const encode=p=>btoa(unescape(encodeURIComponent(JSON.stringify(p))));
const decode=s=>JSON.parse(decodeURIComponent(escape(atob(s.trim()))));
// STUN públicos: permitem atravessar NAT domésticos pela internet (sem VPN). Redes muito restritas ainda precisariam de TURN.
export const ICE_SERVERS=[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302','stun:stun2.l.google.com:19302']},{urls:'stun:stun.cloudflare.com:3478'},{urls:'stun:global.stun.twilio.com:3478'},{urls:'stun:stun.nextcloud.com:443'}];
// Diagnóstico da rede (só STUN, nada sai do navegador além do pedido de endereço): tipo de NAT e quantos adaptadores
export async function probeNat(){if(typeof RTCPeerConnection==='undefined')return '';const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun.cloudflare.com:3478'}]});pc.createDataChannel('x');const cands=[];
  pc.onicecandidate=e=>{if(e.candidate)cands.push(e.candidate);};await pc.setLocalDescription(await pc.createOffer());await new Promise(r=>{const t=setTimeout(r,4000);pc.onicegatheringstatechange=()=>{if(pc.iceGatheringState==='complete'){clearTimeout(t);r();}};});pc.close();
  const srflx=cands.filter(c=>c.type==='srflx'),ports=new Set(srflx.map(c=>c.relatedPort+'>'+c.port)),hosts=new Set(cands.filter(c=>c.type==='host').map(c=>c.address)).size;
  const byBase={};for(const c of srflx){(byBase[c.relatedPort]??=new Set()).add(c.port);}const symmetric=Object.values(byBase).some(s=>s.size>1);
  return (!srflx.length?'sem resposta STUN (firewall bloqueando UDP?)':symmetric?'NAT simétrico/CGNAT (difícil de alcançar)':'NAT comum (bom)')+(hosts>2?` · ${hosts} adaptadores de rede (VPN/virtuais atrapalham)`:'');}
const ROOM_PREFIX='entre-peixes-e-notas-v3-';
const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function roomCode(){let s='';const r=crypto.getRandomValues(new Uint8Array(5));for(const b of r)s+=ALPHABET[b%ALPHABET.length];return s;}
// Topologia em estrela: o anfitrião (id 0) fala com até 3 convidados (ids 1..3); convidados só falam com o anfitrião.
// onMessage(pacote, deQuem) · onStatus('connected'|'peer-join'|'peer-leave'|'disconnected'|'error'|'full', id)
export class Transport {
  constructor(onMessage,onStatus){this.onMessage=onMessage;this.onStatus=onStatus;this.host=false;this.peers=new Map();this.bridged=new Map();this.bridgeOf=new Map();this.link=null;this.broker=null;this.local=null;this.pc=null;this.ping=0;this.key=Math.random().toString(36).slice(2);}
  get connected(){return this.host?this.peers.size>0:!!this.link?.open;}
  freeId(){for(let i=1;i<CONFIG.maxPlayers;i++)if(!this.peers.has(i))return i;return -1;}
  deliver(raw,from){try{const p=typeof raw==='string'?JSON.parse(raw):raw;if(p.type==='ping'){this.sendTo(from,{type:'pong',at:p.at});return;}if(p.type==='pong'){this.ping=performance.now()-p.at;return;}if(validPacket(p))this.onMessage(p,from);}catch{this.onStatus('invalid')}}
  startPing(){clearInterval(this.pingTimer);this.pingTimer=setInterval(()=>this.send({type:'ping',at:performance.now()}),2000);}
  // Anfitrião registra um convidado (qualquer transporte que saiba enviar e fechar)
  addPeer(send,close,via='direto'){const id=this.freeId();if(id<0){send({type:'full',v:CONFIG.protocol});setTimeout(close,300);this.onStatus('full');return -1;}this.peers.set(id,{send,close});this.startPing();send({type:'welcome',id,v:CONFIG.protocol});this.onStatus('peer-join',id);return id;}
  dropPeer(id){if(!this.peers.has(id))return;this.peers.delete(id);this.onStatus('peer-leave',id);
    // quem entrou pela ponte desse jogador cai junto
    for(const [pid,via]of [...this.bridgeOf])if(via===id){this.bridgeOf.delete(pid);for(const [k,v]of [...this.bridged])if(v===pid)this.bridged.delete(k);this.dropPeer(pid);}}
  // ----- Sala com código curto -----
  // PeerJS só apresenta os navegadores; os dados vão direto entre as máquinas. Não existe servidor carregando a partida.
  // Três caminhos correm AO MESMO TEMPO e vale o primeiro que abrir:
  //  1) direto: quem entra liga para o anfitrião;
  //  2) chamada invertida: se a ligação não abre em 5 s, o anfitrião liga DE VOLTA para quem está entrando
  //     (tem redes em que só funciona a ligação que o outro lado começa — era o caso de "entro na sala dele, ele não entra na minha");
  //  3) ponte: outro convidado que já está na sala repassa os pacotes — e ele também liga de volta se preciso.
  async room(code,host){
    this.close();this.host=host;code=code.toUpperCase();this.code=code;const {Peer}=await import('peerjs');this.Peer=Peer;probeNat().then(d=>{this.diag=d;this.onStatus('diag',d);}).catch(()=>{});
    if(host)return this.hostRoom(code);
    await this.openBroker();
    return new Promise((resolve,reject)=>{let done=false,tries=[];const T0=performance.now();
      const win=(conn,via)=>{if(done){try{conn.close();}catch{}return;}done=true;clearTimeout(timer);clearTimeout(bridgeTimer);for(const t of tries)if(t!==conn)try{t.close();}catch{}
        this.link=conn;this.via=via;this.startPing();
        conn.on('data',d=>{if(d?.type==='full'){this.onStatus('full');return;}if(d?.type==='relay'){this.bridgeOut(d);return;}this.deliver(d,0);});
        conn.on('close',()=>{if(this.link===conn){this.link=null;this.onStatus('disconnected');}});
        if(via==='direto')this.registerBridge(code);this.onStatus('connected');resolve(code);};
      const fail=e=>{if(done)return;done=true;clearTimeout(timer);clearTimeout(bridgeTimer);for(const t of tries)try{t.close();}catch{}this.broker?.off('connection',onIn);reject(e);};
      // ligação invertida: o anfitrião (ou uma ponte) ligou para mim
      const onIn=conn=>{const m=conn.metadata||{};if(m.room!==code||!m.rev)return;tries.push(conn);conn.on('open',()=>win(conn,m.bridge?'ponte':'direto'));};this.broker.on('connection',onIn);
      const call=(target,bridge)=>{const conn=this.broker.connect(target,{reliable:true,serialization:'json',metadata:{room:code,back:1}});tries.push(conn);conn.on('open',()=>win(conn,bridge?'ponte':'direto'));/* diagnóstico: simula a rede em que só a ligação do outro lado abre */if(globalThis.__peixesTesteVolta)setTimeout(()=>conn.close(),30);return conn;};
      const onErr=e=>{if(e.type==='peer-unavailable'&&String(e.message||'').trim().endsWith(ROOM_PREFIX+code)&&!globalThis.__peixesForcarPonte){const er=Error('Sala não encontrada. Confira o código.');er.fatal=true;fail(er);}else if(e.type==='network'||e.type==='server-error'){const er=Error('Sem acesso ao servidor de salas. Tente de novo.');er.fatal=true;fail(er);}};
      this.broker.on('error',onErr);
      if(!globalThis.__peixesForcarPonte)call(ROOM_PREFIX+code,false);
      const bridgeTimer=setTimeout(()=>{if(done)return;this.onStatus('trying','ponte');for(let n=1;n<CONFIG.maxPlayers;n++)call(ROOM_PREFIX+code+'-r'+n,true);},globalThis.__peixesForcarPonte?0:3500);
      const timer=setTimeout(()=>fail(Error('Não abriu nenhum caminho até a sala (nem direto, nem de volta, nem por ponte). '+(this.diag?`Sua rede: ${this.diag}. `:'')+'Peça para quem entra em todas as salas também estar na sala: ele vira ponte e liga de volta para você.')),28000);});
  }
  openBroker(){return new Promise((resolve,reject)=>{const peer=new this.Peer(undefined,{config:{iceServers:ICE_SERVERS},debug:0});this.broker=peer;peer.on('disconnected',()=>{try{peer.reconnect();}catch{}});
    const t=setTimeout(()=>{const e=Error('O servidor de salas não respondeu. Tente de novo em instantes.');e.fatal=true;reject(e);},12000);peer.once('open',()=>{clearTimeout(t);resolve();});
    peer.once('error',e=>{if(!peer.open){clearTimeout(t);const er=Error('Sem acesso ao servidor de salas.');er.fatal=true;reject(er);}});});}
  // quem recebe (anfitrião ou ponte): se a ligação não abre em 5 s, liga de volta; a primeira que abrir fica, a outra fecha
  // (quem entra fecha os caminhos que perderam; aqui toda ligação que abre é aceita e agrupada por quem ligou)
  answerWithCallback(peer,conn,code,bridge,onOpen){const m=conn.metadata||{},who=conn.peer;let opened=false;
    conn.on('open',()=>{opened=true;onOpen(conn,who);});
    if(m.back&&m.room===code)setTimeout(()=>{if(opened||peer.destroyed)return;const back=peer.connect(who,{reliable:true,serialization:'json',metadata:{room:code,rev:1,bridge:bridge?1:0}});back.on('open',()=>onOpen(back,who));},5000);}
  hostRoom(code){return new Promise((resolve,reject)=>{
    const peer=new this.Peer(ROOM_PREFIX+code,{config:{iceServers:ICE_SERVERS},debug:0});this.broker=peer;const timeout=setTimeout(()=>reject(Error('O servidor de salas não respondeu. Tente de novo em instantes.')),15000);
    peer.on('open',()=>{clearTimeout(timeout);resolve(code);});
    peer.on('error',e=>{clearTimeout(timeout);const msg=e.type==='unavailable-id'?'Esse código já está em uso. Crie outra sala.':e.type==='network'||e.type==='server-error'?'Sem acesso ao servidor de salas. Use a conexão manual.':'Falha na sala: '+e.type;if(e.type==='peer-unavailable')return;if(!this.connected)reject(Error(msg));else this.onStatus('error');});
    const remotes=new Map();
    peer.on('connection',first=>this.answerWithCallback(peer,first,code,false,(conn,who)=>{let r=remotes.get(who);if(!r){r={pid:-1,conns:new Set(),pref:null};remotes.set(who,r);}r.conns.add(conn);
      if(r.pid<0){r.pid=this.addPeer(p=>{const c=r.pref?.open?r.pref:[...r.conns].find(c=>c.open);if(!c)return;const dc=c.dataChannel;if(!dc||dc.bufferedAmount<256000)c.send(p);},()=>{for(const c of r.conns)c.close();});if(r.pid<0){remotes.delete(who);return;}}
      conn.on('data',d=>{if(r.pid<0)return;r.pref=conn;if(d?.type==='hello')conn.send({type:'welcome',id:r.pid,v:CONFIG.protocol});if(d?.type==='relay')this.bridgeIn(r.pid,d);else this.deliver(d,r.pid);});
      conn.on('close',()=>{r.conns.delete(conn);if(r.pref===conn)r.pref=null;if(!r.conns.size&&remotes.get(who)===r){remotes.delete(who);this.dropPeer(r.pid);}});}));
    peer.on('disconnected',()=>{try{peer.reconnect();}catch{}});
  });}
  // Anfitrião: pacote de alguém que chegou pela ponte "via" (outro convidado)
  bridgeIn(via,p){const inner=p.data;if(!inner||typeof p.from!=='string')return;const key=via+':'+p.from;let id=this.bridged.get(key);
    if(id===undefined){if(inner.type!=='hello')return;const bridge=()=>this.peers.get(via);
      id=this.addPeer(q=>bridge()?.send({type:'relay',to:p.from,data:q,v:CONFIG.protocol}),()=>bridge()?.send({type:'relay',to:p.from,data:{type:'bye',v:CONFIG.protocol},v:CONFIG.protocol}),'ponte');
      if(id<0)return;this.bridged.set(key,id);this.bridgeOf.set(id,via);}
    if(inner.type==='bye'){this.bridged.delete(key);this.bridgeOf.delete(id);this.dropPeer(id);return;}this.deliver(inner,id);}
  // Convidado conectado direto vira ponte: registra "sala-rN" e repassa pacotes entre quem chegar e o anfitrião (e liga de volta se preciso)
  registerBridge(code){this.bridges=new Map();const tryId=n=>{if(n>=CONFIG.maxPlayers||!this.link)return;const peer=new this.Peer(ROOM_PREFIX+code+'-r'+n,{config:{iceServers:ICE_SERVERS},debug:0});
      peer.on('error',e=>{if(e.type==='unavailable-id'){peer.destroy();tryId(n+1);}});
      peer.on('open',()=>{this.bridgePeer=peer;});peer.on('disconnected',()=>{try{peer.reconnect();}catch{}});
      peer.on('connection',first=>this.answerWithCallback(peer,first,code,true,conn=>{const key=Math.random().toString(36).slice(2,10);this.bridges.set(key,conn);
        conn.on('data',d=>{if(this.link?.open)this.link.send({type:'relay',from:key,data:d,v:CONFIG.protocol});});
        conn.on('close',()=>{this.bridges.delete(key);if(this.link?.open)this.link.send({type:'relay',from:key,data:{type:'bye',v:CONFIG.protocol},v:CONFIG.protocol});});}));};
    tryId(1);}
  bridgeOut(p){const conn=this.bridges?.get(p.to);if(!conn||!p.data)return;const dc=conn.dataChannel;if(!dc||dc.bufferedAmount<256000)conn.send(p.data);if(p.data.type==='bye')setTimeout(()=>conn.close(),200);}
  // ----- Troca manual de códigos (um convidado; sem servidor além dos STUN) -----
  channelTo(channel){channel.onmessage=e=>{if(this.host){this.deliver(e.data,this.manualId);}else this.deliver(e.data,0);};channel.onclose=()=>{if(this.host)this.dropPeer(this.manualId);else{this.onStatus('disconnected');}};channel.onerror=()=>this.onStatus('error');
    channel.onopen=()=>{if(this.host)this.manualId=this.addPeer(p=>{if(channel.readyState==='open'&&channel.bufferedAmount<256000)channel.send(JSON.stringify(p));},()=>channel.close());else{this.link={open:true,send:p=>{if(channel.readyState==='open')channel.send(JSON.stringify(p));},close:()=>channel.close()};this.startPing();this.onStatus('connected');}};}
  async init(host){this.close();this.host=host;this.pc=new RTCPeerConnection({iceServers:ICE_SERVERS});this.pc.ondatachannel=e=>this.channelTo(e.channel);if(host)this.channelTo(this.pc.createDataChannel('peixes',{ordered:true}));}
  async ice(){if(this.pc.iceGatheringState==='complete')return;await new Promise(resolve=>{const timeout=setTimeout(resolve,5000);const handler=()=>{if(this.pc.iceGatheringState==='complete'){clearTimeout(timeout);this.pc.removeEventListener('icegatheringstatechange',handler);resolve();}};this.pc.addEventListener('icegatheringstatechange',handler);});}
  async offer(){await this.init(true);await this.pc.setLocalDescription(await this.pc.createOffer());await this.ice();return encode(this.pc.localDescription);}
  async answer(code){const offer=decode(code);if(offer.type!=='offer'||typeof offer.sdp!=='string')throw Error('Cole o convite do anfitrião.');await this.init(false);await this.pc.setRemoteDescription(offer);await this.pc.setLocalDescription(await this.pc.createAnswer());await this.ice();return encode(this.pc.localDescription);}
  async accept(code){const answer=decode(code);if(answer.type!=='answer'||!this.pc)throw Error('Gere um convite e cole a resposta do convidado.');await this.pc.setRemoteDescription(answer);}
  // ----- Teste local em abas (BroadcastChannel com endereçamento) -----
  tabs(room,host){this.close();this.host=host;const ch=this.local=new BroadcastChannel('peixes-v3-'+room),me=host?'host':this.key,keys=new Map();
    const post=(p,to)=>ch.postMessage({...p,v:CONFIG.protocol,_from:me,_to:to});
    ch.onmessage=e=>{const p=e.data;if(!p||p._from===me)return;
      if(host){if(p._to&&p._to!=='host')return;if(p.type==='hello'&&!keys.has(p._from)){const key=p._from;const id=this.addPeer(q=>post(q,key),()=>post({type:'bye'},key));if(id>=0)keys.set(key,id);else return;}
        const id=keys.get(p._from);if(id===undefined)return;if(p.type==='bye'){keys.delete(p._from);this.dropPeer(id);return;}this.deliver(p,id);}
      else{if(p._from!=='host'||(p._to&&p._to!==me))return;if(p.type==='full'){this.onStatus('full');return;}if(!this.link){this.link={open:true,send:q=>post(q,'host'),close:()=>post({type:'bye'},'host')};this.startPing();this.onStatus('connected');}this.deliver(p,0);}};
    if(!host){post({type:'hello'},'host');this.helloTimer=setInterval(()=>{if(!this.link)post({type:'hello'},'host');},600);}}
  // host: para todos (to indefinido) ou para um; convidado: sempre para o anfitrião
  send(packet,to){const p={...packet,v:CONFIG.protocol};if(this.host){if(to===undefined){for(const peer of this.peers.values())peer.send(p);}else this.peers.get(to)?.send(p);}else this.link?.send(p);}
  sendTo(id,packet){if(this.host)this.send(packet,id);else this.send(packet);}
  close(){clearInterval(this.helloTimer);clearInterval(this.pingTimer);try{for(const c of this.bridges?.values()||[])c.close();this.bridgePeer?.destroy();}catch{}this.bridgePeer=null;this.bridges=null;this.bridged.clear();this.bridgeOf.clear();this.via=null;try{if(!this.host)this.link?.close();for(const p of this.peers.values())p.close();}catch{}this.local?.close();this.local=null;try{this.pc?.close();this.broker?.destroy();}catch{}this.pc=null;this.broker=null;this.link=null;this.peers.clear();}
}

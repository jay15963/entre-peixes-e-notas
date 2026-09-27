import {CONFIG,validPacket} from './core.js';
const encode=p=>btoa(unescape(encodeURIComponent(JSON.stringify(p))));
const decode=s=>JSON.parse(decodeURIComponent(escape(atob(s.trim()))));
// STUN públicos: permitem atravessar NAT domésticos pela internet (sem VPN). Redes muito restritas ainda precisariam de TURN.
export const ICE_SERVERS=[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']},{urls:'stun:stun.cloudflare.com:3478'}];
const ROOM_PREFIX='entre-peixes-e-notas-v3-';
const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function roomCode(){let s='';const r=crypto.getRandomValues(new Uint8Array(5));for(const b of r)s+=ALPHABET[b%ALPHABET.length];return s;}
// Topologia em estrela: o anfitrião (id 0) fala com até 3 convidados (ids 1..3); convidados só falam com o anfitrião.
// onMessage(pacote, deQuem) · onStatus('connected'|'peer-join'|'peer-leave'|'disconnected'|'error'|'full', id)
export class Transport {
  constructor(onMessage,onStatus){this.onMessage=onMessage;this.onStatus=onStatus;this.host=false;this.peers=new Map();this.link=null;this.broker=null;this.local=null;this.pc=null;this.ping=0;this.key=Math.random().toString(36).slice(2);}
  get connected(){return this.host?this.peers.size>0:!!this.link?.open;}
  freeId(){for(let i=1;i<CONFIG.maxPlayers;i++)if(!this.peers.has(i))return i;return -1;}
  deliver(raw,from){try{const p=typeof raw==='string'?JSON.parse(raw):raw;if(p.type==='ping'){this.sendTo(from,{type:'pong',at:p.at});return;}if(p.type==='pong'){this.ping=performance.now()-p.at;return;}if(validPacket(p))this.onMessage(p,from);}catch{this.onStatus('invalid')}}
  startPing(){clearInterval(this.pingTimer);this.pingTimer=setInterval(()=>this.send({type:'ping',at:performance.now()}),2000);}
  // Anfitrião registra um convidado (qualquer transporte que saiba enviar e fechar)
  addPeer(send,close){const id=this.freeId();if(id<0){send({type:'full',v:CONFIG.protocol});setTimeout(close,300);this.onStatus('full');return -1;}this.peers.set(id,{send,close});this.startPing();send({type:'welcome',id,v:CONFIG.protocol});this.onStatus('peer-join',id);return id;}
  dropPeer(id){if(!this.peers.has(id))return;this.peers.delete(id);this.onStatus('peer-leave',id);}
  // ----- Sala com código curto (PeerJS só para a sinalização; os dados vão direto entre os navegadores) -----
  async room(code,host){
    this.close();this.host=host;const {Peer}=await import('peerjs');
    return new Promise((resolve,reject)=>{
      const id=ROOM_PREFIX+code.toUpperCase();const timeout=setTimeout(()=>reject(Error('O servidor de salas não respondeu. Tente a conexão manual.')),15000);
      const peer=new Peer(host?id:undefined,{config:{iceServers:ICE_SERVERS},debug:0});this.broker=peer;
      peer.on('error',e=>{clearTimeout(timeout);const msg=e.type==='unavailable-id'?'Esse código já está em uso. Crie outra sala.':e.type==='peer-unavailable'?'Sala não encontrada. Confira o código.':e.type==='network'||e.type==='server-error'?'Sem acesso ao servidor de salas. Use a conexão manual.':'Falha na conexão: '+e.type;if(!this.connected)reject(Error(msg));else this.onStatus('error');});
      peer.on('open',()=>{if(host){clearTimeout(timeout);resolve(code);return;}
        const conn=peer.connect(id,{reliable:true,serialization:'json'});this.link=conn;
        conn.on('open',()=>{clearTimeout(timeout);this.startPing();this.onStatus('connected');resolve(code);});conn.on('data',d=>{if(d?.type==='full'){this.onStatus('full');return;}this.deliver(d,0);});conn.on('close',()=>{this.link=null;this.onStatus('disconnected');});conn.on('error',()=>this.onStatus('error'));});
      if(host)peer.on('connection',conn=>{let pid=-1;conn.on('open',()=>{pid=this.addPeer(p=>{const dc=conn.dataChannel;if(!dc||dc.bufferedAmount<256000)conn.send(p);},()=>conn.close());});conn.on('data',d=>{if(pid>=0)this.deliver(d,pid);});conn.on('close',()=>{if(pid>=0)this.dropPeer(pid);});});
      peer.on('disconnected',()=>{try{peer.reconnect();}catch{}});
    });
  }
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
  close(){clearInterval(this.helloTimer);clearInterval(this.pingTimer);try{if(!this.host)this.link?.close();for(const p of this.peers.values())p.close();}catch{}this.local?.close();this.local=null;try{this.pc?.close();this.broker?.destroy();}catch{}this.pc=null;this.broker=null;this.link=null;this.peers.clear();}
}

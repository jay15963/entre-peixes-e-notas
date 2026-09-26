import {CONFIG,validPacket} from './core.js';
const encode=p=>btoa(unescape(encodeURIComponent(JSON.stringify(p))));
const decode=s=>JSON.parse(decodeURIComponent(escape(atob(s.trim()))));
// STUN públicos: permitem atravessar NAT domésticos pela internet (sem VPN). Redes muito restritas ainda precisariam de TURN.
export const ICE_SERVERS=[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']},{urls:'stun:stun.cloudflare.com:3478'}];
const ROOM_PREFIX='entre-peixes-e-notas-v2-';
const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function roomCode(){let s='';const r=crypto.getRandomValues(new Uint8Array(5));for(const b of r)s+=ALPHABET[b%ALPHABET.length];return s;}
export class Transport {
  constructor(onMessage,onStatus){this.onMessage=onMessage;this.onStatus=onStatus;this.host=false;this.connected=false;this.channel=null;this.peer=null;this.local=null;this.broker=null;this.conn=null;this.ping=0;}
  deliver(raw){try{const p=typeof raw==='string'?JSON.parse(raw):raw;if(p.type==='ping'){this.send({type:'pong',at:p.at});return;}if(p.type==='pong'){this.ping=performance.now()-p.at;return;}if(validPacket(p))this.onMessage(p);}catch{this.onStatus('invalid')}}
  opened(){this.connected=true;this.onStatus('connected');clearInterval(this.pingTimer);this.pingTimer=setInterval(()=>this.send({type:'ping',at:performance.now()}),2000);}
  closed(){if(!this.connected)return;this.connected=false;clearInterval(this.pingTimer);this.onStatus('disconnected');}
  // ----- Sala com código curto (PeerJS apenas para a sinalização; os dados vão direto entre os navegadores) -----
  async room(code,host){
    this.close();this.host=host;const {Peer}=await import('peerjs');
    return new Promise((resolve,reject)=>{
      const id=ROOM_PREFIX+code.toUpperCase();const timeout=setTimeout(()=>reject(Error('O servidor de salas não respondeu. Tente a conexão manual.')),15000);
      const peer=new Peer(host?id:undefined,{config:{iceServers:ICE_SERVERS},debug:0});this.broker=peer;
      peer.on('error',e=>{clearTimeout(timeout);const msg=e.type==='unavailable-id'?'Esse código já está em uso. Crie outra sala.':e.type==='peer-unavailable'?'Sala não encontrada. Confira o código.':e.type==='network'||e.type==='server-error'?'Sem acesso ao servidor de salas. Use a conexão manual.':'Falha na conexão: '+e.type;if(!this.connected)reject(Error(msg));else this.onStatus('error');});
      const attach=conn=>{this.conn=conn;conn.on('open',()=>{clearTimeout(timeout);this.opened();resolve(code);});conn.on('data',d=>this.deliver(d));conn.on('close',()=>this.closed());conn.on('error',()=>this.onStatus('error'));};
      peer.on('open',()=>{if(host){clearTimeout(timeout);resolve(code);}else attach(peer.connect(id,{reliable:true,serialization:'json'}));});
      if(host)peer.on('connection',conn=>{if(this.conn&&this.conn.open){conn.close();return;}attach(conn);});
      peer.on('disconnected',()=>{if(this.connected)try{peer.reconnect();}catch{}});
    });
  }
  // ----- Troca manual de códigos (sem nenhum servidor além dos STUN) -----
  configure(channel){this.channel=channel;channel.onopen=()=>this.opened();channel.onclose=()=>this.closed();channel.onerror=()=>this.onStatus('error');channel.onmessage=e=>this.deliver(e.data);}
  async init(host){this.close();this.host=host;this.peer=new RTCPeerConnection({iceServers:ICE_SERVERS});this.peer.onconnectionstatechange=()=>{if(['failed','closed'].includes(this.peer?.connectionState))this.closed();};this.peer.ondatachannel=e=>this.configure(e.channel);if(host)this.configure(this.peer.createDataChannel('peixes',{ordered:true}));}
  async ice(){if(this.peer.iceGatheringState==='complete')return;await new Promise(resolve=>{const timeout=setTimeout(resolve,5000);const handler=()=>{if(this.peer.iceGatheringState==='complete'){clearTimeout(timeout);this.peer.removeEventListener('icegatheringstatechange',handler);resolve();}};this.peer.addEventListener('icegatheringstatechange',handler);});}
  async offer(){await this.init(true);await this.peer.setLocalDescription(await this.peer.createOffer());await this.ice();return encode(this.peer.localDescription);}
  async answer(code){const offer=decode(code);if(offer.type!=='offer'||typeof offer.sdp!=='string')throw Error('Cole o convite do anfitrião.');await this.init(false);await this.peer.setRemoteDescription(offer);await this.peer.setLocalDescription(await this.peer.createAnswer());await this.ice();return encode(this.peer.localDescription);}
  async accept(code){const answer=decode(code);if(answer.type!=='answer'||!this.peer)throw Error('Gere um convite e cole a resposta do convidado.');await this.peer.setRemoteDescription(answer);}
  // ----- Teste local em duas abas -----
  tabs(room,host){this.close();this.host=host;this.local=new BroadcastChannel('peixes-v2-'+room);this.local.onmessage=e=>{const p=e.data;if(p?.type==='hello'&&!this.connected){this.opened();this.send({type:'hello'});}this.deliver(p);};this.send({type:'hello'});this.helloTimer=setInterval(()=>{if(!this.connected)this.send({type:'hello'})},600);}
  send(packet){const p={...packet,v:CONFIG.protocol};if(this.local)this.local.postMessage(p);else if(this.conn?.open){const dc=this.conn.dataChannel;if(!dc||dc.bufferedAmount<256000)this.conn.send(p);}else if(this.channel?.readyState==='open'&&this.channel.bufferedAmount<256000)this.channel.send(JSON.stringify(p));}
  close(){clearInterval(this.helloTimer);clearInterval(this.pingTimer);this.local?.close();this.local=null;this.channel?.close();this.peer?.close();try{this.conn?.close();this.broker?.destroy();}catch{}this.conn=null;this.broker=null;this.channel=null;this.peer=null;this.connected=false;}
}

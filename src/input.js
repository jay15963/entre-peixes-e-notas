// Primeira pessoa: pointer lock com olhar pelo mouse. Botão direito dá o tapa, E assume o leme, F pesca.
export class Input {
  constructor(canvas){
    this.canvas=canvas;this.keys=new Set();this.edges=new Set();this.yaw=Math.PI;this.pitch=-.05;this.enabled=false;this.sensitivity=Number(localStorage.getItem('peixes-sens'))||1;this.locked=false;this.onLockChange=null;this.aimScale=1;this.mouseSlap=false;
    const mapped=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyE','KeyF','KeyJ','KeyK','KeyQ','Enter','Backspace','ShiftLeft','ShiftRight','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9','Digit0','KeyC'];this.wheel=0;
    window.addEventListener('keydown',e=>{if(!this.enabled||e.target.closest?.('input,textarea,select,button,a,[contenteditable=true]'))return;if(mapped.includes(e.code)){e.preventDefault();if(!this.keys.has(e.code))this.edges.add(e.code);this.keys.add(e.code);}});
    window.addEventListener('keyup',e=>this.keys.delete(e.code));window.addEventListener('blur',()=>this.clear());
    this.buttons=new Set();canvas.addEventListener('mousedown',e=>{if(!this.enabled)return;if(!this.locked){this.lock();return;}this.buttons.add(e.button);if(e.button===2){this.edges.add('Slap');e.preventDefault();}if(e.button===0)this.edges.add('Fire');});window.addEventListener('mouseup',e=>this.buttons.delete(e.button));
    canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('wheel',e=>{if(this.enabled&&this.locked){this.wheel+=Math.sign(e.deltaY);e.preventDefault();}},{passive:false});
    document.addEventListener('mousemove',e=>{if(!this.locked||!this.enabled)return;const k=.0022*this.sensitivity*(this.aimScale||1);this.yaw-=e.movementX*k;this.pitch=Math.max(-1.45,Math.min(1.45,this.pitch-e.movementY*k));});
    document.addEventListener('pointerlockchange',()=>{this.locked=document.pointerLockElement===canvas;if(!this.locked)this.keys.clear();if(this.onLockChange)this.onLockChange(this.locked);});
  }
  lock(){const plain=()=>{try{this.canvas.requestPointerLock()?.catch?.(()=>{});}catch{}};try{const r=this.canvas.requestPointerLock({unadjustedMovement:true});if(r&&r.catch)r.catch(plain);}catch{plain();}}
  unlock(){if(document.pointerLockElement)document.exitPointerLock();}
  pressed(key){const p=this.edges.has(key);this.edges.delete(key);return p;}
  // trilhas do violão (D F J K): lidas antes de F virar "lançar"
  read(){const lanes=[];['KeyD','KeyF','KeyJ','KeyK'].forEach((k,i)=>{if(this.edges.has(k))lanes.push(i);});this.edges.delete('KeyD');this.edges.delete('KeyJ');this.edges.delete('KeyK');
    // navegação dos menus do violão (W/S, ENTER ou ESPAÇO, Q)
    const nav={up:this.edges.has('KeyW')||this.pressed('ArrowUp'),down:this.edges.has('KeyS')||this.pressed('ArrowDown'),ok:this.pressed('Enter')||this.edges.has('Space'),back:this.pressed('KeyQ')||this.pressed('Backspace')};this.edges.delete('KeyW');this.edges.delete('KeyS');let slot=-1;for(let d=0;d<10;d++)if(this.pressed('Digit'+((d+1)%10)))slot=d;const wheel=Math.sign(this.wheel);this.wheel=0;return {slot,wheel,upHeld:this.keys.has('Space'),downHeld:this.keys.has('KeyC'),lanes,nav,x:(this.keys.has('KeyD')||this.keys.has('ArrowRight')?1:0)-(this.keys.has('KeyA')||this.keys.has('ArrowLeft')?1:0),z:(this.keys.has('KeyW')||this.keys.has('ArrowUp')?1:0)-(this.keys.has('KeyS')||this.keys.has('ArrowDown')?1:0),run:this.keys.has('ShiftLeft')||this.keys.has('ShiftRight'),interact:this.pressed('KeyE'),cast:this.pressed('KeyF'),slap:this.pressed('Slap'),fire:this.pressed('Fire'),aim:this.buttons.has(2),jump:this.pressed('Space'),reel:this.keys.has('KeyF'),yaw:this.yaw,pitch:this.pitch};}
  clear(){this.wheel=0;this.keys.clear();this.edges.clear();this.buttons?.clear();}
}

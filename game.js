'use strict';

/*
  6AM — NÃO DEIXE ENTRAR
  V2 — pixel horror feito sem bibliotecas externas.
  A arte é desenhada em Canvas para o projeto poder ir inteiro para o GitHub Pages.
*/

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const W = canvas.width, H = canvas.height;

const PAL = {
  void:'#05060a', night:'#0a0d14', sky:'#111723', moon:'#d6d0c3', cloud:'#191d27',
  wall:'#393138', wallDark:'#242129', wallLit:'#51434a', floor:'#645048', floorAlt:'#5c4943',
  seam:'#493a38', wood:'#694f44', woodDark:'#463530', brass:'#b49a69', glass:'#1b2730',
  skin:'#c58f78', skinShadow:'#8c5d50', shirt:'#31405a', shirtHi:'#4b6383', pants:'#252934',
  shoe:'#17181e', white:'#eee7de', text:'#b7aea8', dim:'#696168', red:'#a93d4b', redDark:'#641f29',
  green:'#7d9a76', amber:'#b69b60', purple:'#51405d', black:'#111118'
};

const rooms = {
  hall:{x:34,y:72,w:168,h:286,name:'CORREDOR',floor:0},
  living:{x:202,y:72,w:250,h:142,name:'SALA',floor:1},
  kitchen:{x:452,y:72,w:282,h:142,name:'COZINHA',floor:2},
  bedroom:{x:202,y:214,w:250,h:144,name:'QUARTO',floor:1},
  bathroom:{x:452,y:214,w:282,h:144,name:'BANHEIRO',floor:2},
  porch:{x:34,y:358,w:700,h:38,name:'VARANDA',floor:3}
};

const entries = [
  {id:'front',label:'PORTA DA FRENTE',type:'porta',x:102,y:352,w:42,h:8,room:'hall',out:'sul'},
  {id:'back',label:'PORTA DOS FUNDOS',type:'porta',x:726,y:270,w:8,h:46,room:'bathroom',out:'leste'},
  {id:'living',label:'JANELA DA SALA',type:'janela',x:272,y:68,w:54,h:8,room:'living',out:'norte'},
  {id:'kitchen',label:'JANELA DA COZINHA',type:'janela',x:590,y:68,w:62,h:8,room:'kitchen',out:'norte'},
  {id:'bedroom',label:'JANELA DO QUARTO',type:'janela',x:272,y:354,w:54,h:8,room:'bedroom',out:'sul'},
  {id:'bath',label:'JANELA DO BANHEIRO',type:'janela',x:450,y:262,w:8,h:44,room:'bathroom',out:'oeste'}
];

const FORM = {
  dog:{key:'dog',name:'CÃO NEGRO',sub:'Ele usa sons para fazer você olhar para o lugar errado.',color:'#14151c',glow:'#a68d72'},
  panther:{key:'panther',name:'PANTERA',sub:'Na escuridão, a casa parece maior do que é.',color:'#101019',glow:'#7f718a'},
  wolf:{key:'wolf',name:'LOBO',sub:'Ele aprendeu que as trancas cedem mais rápido do que você imagina.',color:'#24252c',glow:'#98959e'},
  demon:{key:'demon',name:'BAPHOMET',sub:'Agora ele não precisa mais fingir ser outra coisa.',color:'#3d222d',glow:'#b24c5a'}
};
const schedule = ['dog','dog','panther','panther','wolf','wolf','demon','demon'];

const state = {
  scene:'title',
  t:0,
  last:0,
  elapsed:0,
  hour:22,
  minute:0,
  form:'dog',
  cut:0,
  cutClick:false,
  fade:0,
  player:{x:112,y:198,dir:1,step:0},
  locks:{},
  study:{},
  targetEntry:null,
  threatDistance:0,
  threatVisible:0,
  threatPhase:0,
  flashlight:false,
  battery:100,
  power:100,
  blackout:0,
  observe:false,
  observeTime:0,
  panic:0,
  cameraShake:0,
  message:'',
  messageTime:0,
  subtitle:'',
  events:[],
  eventCooldown:3,
  kills:0,
  deaths:0,
  hint:{dog:false,panther:false,wolf:false,demon:false},
  deathCause:'',
  winLine:'',
  toastTime:0,
  audio:null,
  audioOK:false,
  muted:false
};

for(const e of entries){state.locks[e.id]=1;state.study[e.id]=0;}

const keys = new Set();

function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function lerp(a,b,t){return a+(b-a)*t;}
function rnd(a,b){return a+Math.random()*(b-a);}
function pick(arr){return arr[(Math.random()*arr.length)|0];}
function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
function stroke(x,y,w,h,c,l=1){ctx.strokeStyle=c;ctx.lineWidth=l;ctx.strokeRect(Math.round(x)+.5,Math.round(y)+.5,Math.round(w)-1,Math.round(h)-1);}
function txt(s,x,y,size=12,c=PAL.white,align='left',alpha=1){ctx.save();ctx.globalAlpha=alpha;ctx.font=`${size}px monospace`;ctx.textAlign=align;ctx.textBaseline='top';ctx.fillStyle=c;ctx.fillText(s,Math.round(x),Math.round(y));ctx.restore();}
function circle(x,y,r,c){ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
function line(x1,y1,x2,y2,c,l=1){ctx.strokeStyle=c;ctx.lineWidth=l;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}

function currentIndex(){
  const h=state.hour;
  return h>=22?h-22:h+2;
}
function diff(){return clamp(currentIndex()/8,0,1);}
function timeText(){return `${String(state.hour).padStart(2,'0')}:${String(Math.floor(state.minute)).padStart(2,'0')}`;}
function roomAt(x,y){
  for(const r of Object.values(rooms)) if(x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h) return r;
  return null;
}
function nearbyEntry(){
  let best=null,bd=Infinity;
  for(const e of entries){
    const ex=e.x+e.w/2,ey=e.y+e.h/2;
    const d=Math.hypot(state.player.x-ex,state.player.y-ey);
    if(d<42&&d<bd){bd=d;best=e;}
  }
  return best;
}
function showMessage(s,time=3,sub=''){state.message=s;state.messageTime=time;state.subtitle=sub;}

function audioInit(){
  if(state.audioOK||state.muted)return;
  try{
    state.audio=new (window.AudioContext||window.webkitAudioContext)();
    state.audioOK=true;
  }catch{}
}
function beep(freq,dur=.1,type='square',vol=.02,slide=0){
  if(!state.audioOK||!state.audio||state.muted)return;
  const o=state.audio.createOscillator(),g=state.audio.createGain();
  o.type=type;o.frequency.value=freq;
  if(slide)o.frequency.linearRampToValueAtTime(freq+slide,state.audio.currentTime+dur);
  g.gain.value=vol;g.gain.exponentialRampToValueAtTime(.0001,state.audio.currentTime+dur);
  o.connect(g);g.connect(state.audio.destination);o.start();o.stop(state.audio.currentTime+dur);
}
function sound(k){
  switch(k){
    case 'step':beep(95,.035,'square',.012);break;
    case 'lock':beep(288,.06,'square',.025);beep(420,.08,'square',.02);break;
    case 'knock':beep(54,.09,'square',.04);setTimeout(()=>beep(43,.12,'square',.03),70);break;
    case 'whisper':beep(240,.4,'sine',.008,-150);break;
    case 'flicker':beep(80,.25,'sawtooth',.025,-25);break;
    case 'stinger':beep(55,.55,'sawtooth',.04,-25);break;
    case 'win':beep(523,.1,'square',.022);beep(659,.12,'square',.018);beep(784,.26,'square',.02);break;
    case 'click':beep(190,.05,'square',.012);break;
  }
}

function resetGame(){
  state.scene='intro';state.elapsed=0;state.hour=22;state.minute=0;state.form='dog';state.cut=0;state.cutClick=false;state.fade=0;
  state.player={x:112,y:198,dir:1,step:0};state.targetEntry=null;state.threatDistance=0;state.threatVisible=0;state.threatPhase=0;
  state.flashlight=false;state.battery=100;state.power=100;state.blackout=0;state.observe=false;state.observeTime=0;state.panic=0;state.cameraShake=0;
  state.message='';state.messageTime=0;state.subtitle='';state.events=[];state.eventCooldown=2.5;state.kills=0;state.deaths=0;state.hint={dog:false,panther:false,wolf:false,demon:false};state.deathCause='';state.winLine='';
  for(const e of entries){state.locks[e.id]=1;state.study[e.id]=0;}
  chooseTarget(true);audioInit();
}
function begin(){
  state.scene='play';state.elapsed=0;state.hour=22;state.minute=0;state.form='dog';
  showMessage('Aguente até 06:00. Não deixe nenhuma entrada aberta.',4,'TRANCAR É MAIS FÁCIL DO QUE CONFIAR NA ESCURIDÃO.');
  sound('stinger');
}

function startFromTitle(){audioInit();resetGame();}

function progressTime(dt){
  state.elapsed+=dt;
  // 8 minutos de jogo real = 8 horas in-game. Cada hora dura 60 segundos.
  const total=state.elapsed;
  const idx=Math.floor(total/60);
  const mins=total%60;
  const h=(22+idx)%24;
  if(h!==state.hour){state.hour=h;onHour();}
  state.minute=mins;
  if(state.elapsed>=480) win();
}
function onHour(){
  if(state.hour===6){win();return;}
  const idx=currentIndex();
  state.form=schedule[clamp(idx,0,7)];
  const lines={
    dog:'Tem um cachorro no quintal. Pelo menos é isso que você ouviu.',
    panther:'As luzes piscaram. Uma sombra atravessou o corredor.',
    wolf:'As trancas estão cedendo mais rápido agora.',
    demon:'Você finalmente pode vê-lo sem que ele precise se esconder.'
  };
  showMessage(lines[state.form],4,FORM[state.form].sub);sound('flicker');state.cameraShake=.2;
}

function chooseTarget(force=false){
  if(!force && state.targetEntry && Math.random()>.42)return;
  const candidates=entries.slice().sort((a,b)=>state.locks[a.id]-state.locks[b.id]);
  const pool=candidates.slice(0,3+Math.floor(diff()*3));
  let e=pick(pool.length?pool:entries);
  if(state.targetEntry&&entries.length>1){let tries=0;while(e.id===state.targetEntry&&tries++<8)e=pick(pool);}
  state.targetEntry=e.id;state.threatDistance=1;state.threatPhase=0;
}

function movePlayer(dt){
  if(state.observe)return;
  let dx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0);
  let dy=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);
  if(!dx&&!dy)return;
  const m=Math.hypot(dx,dy);dx/=m;dy/=m;
  const sp=(state.panic>75?79:92)*(state.blackout>0?.78:1);
  const ox=state.player.x,oy=state.player.y;
  state.player.x=clamp(state.player.x+dx*sp*dt,45,722);
  state.player.y=clamp(state.player.y+dy*sp*dt,82,349);
  if(Math.hypot(state.player.x-ox,state.player.y-oy)>1){state.player.step+=dt*9;if(Math.random()<dt*1.9)sound('step');}
  if(dx<0)state.player.dir=-1;if(dx>0)state.player.dir=1;
}

function repair(dt){
  const e=nearbyEntry();if(!e)return;
  if(state.locks[e.id]>=.999 && !keys.has('e'))return;
  if(keys.has('e')||keys.has(' ')){
    const before=state.locks[e.id];
    const rate=state.form==='wolf'?.72:.95;
    state.locks[e.id]=clamp(state.locks[e.id]+dt*rate,0,1);
    state.study[e.id]=clamp(state.study[e.id]-dt*.9,0,1);
    if(before<.98&&state.locks[e.id]>=.98)sound('lock');
  }
}

function lockDecay(dt){
  const d=diff();
  for(const e of entries){
    let studyRate=.004 + d*.012;
    if(state.form==='wolf')studyRate*=1.8;
    if(state.form==='demon')studyRate*=1.45;
    state.study[e.id]=clamp(state.study[e.id]+dt*studyRate,0,1);
    let drain=.004 + state.study[e.id]*.014;
    if(e.id===state.targetEntry)drain*=1.9;
    if(state.form==='wolf')drain*=1.75;
    if(state.form==='demon')drain*=1.35;
    if(state.observe)drain*=.86;
    state.locks[e.id]=clamp(state.locks[e.id]-dt*drain,0,1);
  }
}

function threatAI(dt){
  state.threatPhase+=dt;
  const e=entries.find(x=>x.id===state.targetEntry);if(!e)return;
  const d=diff();
  const weak=state.locks[e.id];
  const pressure=(1-weak)*(0.5+d*.7);
  state.threatDistance=clamp(state.threatDistance+dt*(.02+pressure*.12),0,1);
  if(state.threatDistance>.9&&weak<.22){state.threatDistance=0;onThreatPush(e);}

  const cadence = state.form==='dog'?4.5:state.form==='panther'?5.0:state.form==='wolf'?3.2:2.7;
  if(state.threatPhase>cadence){
    state.threatPhase=0;
    if(state.form==='dog')dogTrick(e);
    else if(state.form==='panther')pantherTrick(e);
    else if(state.form==='wolf')wolfTrick(e);
    else demonTrick(e);
  }
  if(weak<.12&&Math.random()<dt*(.01+d*.03)){
    state.panic=clamp(state.panic+12,0,100);state.cameraShake=.18;sound('knock');
  }
}

function onThreatPush(e){
  state.locks[e.id]=clamp(state.locks[e.id]-.12,0,1);
  state.panic=clamp(state.panic+18,0,100);state.cameraShake=.35;sound('knock');
  showMessage('A tranca quase cedeu.',2.2,e.label);
  if(state.locks[e.id]<=.03){
    state.kills++;
    die(`A ${e.type} foi a porta que faltou trancar.`);
  }
}
function dogTrick(){
  state.hint.dog=true;
  const r=pick(['hall','living','kitchen','bedroom','bathroom']);
  state.events.push({kind:'bark',room:r,ttl:4.2,t:0});sound('knock');
  showMessage('Um latido veio de dentro da casa.',2.8,'NÃO É ELE. ELE QUER QUE VOCÊ SAIA DA SUA ROTINA.');
}
function pantherTrick(){
  state.hint.panther=true;
  const e=pick(entries);
  state.study[e.id]=clamp(state.study[e.id]+.22,0,1);
  state.power=clamp(state.power-25,20,100);
  if(state.blackout<=0&&Math.random()<.8){state.blackout=rnd(2.7,5.0);sound('flicker');}
  state.events.push({kind:'rush',room:'hall',ttl:2.5,t:0});
  showMessage('A sombra correu quando as luzes piscaram.',2.8,'NÃO SIGA. VERIFIQUE AS ENTRADAS.');
}
function wolfTrick(){
  state.hint.wolf=true;
  const arr=entries.slice().sort((a,b)=>state.locks[a.id]-state.locks[b.id]).slice(0,2);
  arr.forEach(e=>state.locks[e.id]=clamp(state.locks[e.id]-.11,0,1));
  state.events.push({kind:'howl',room:'hall',ttl:3.5,t:0});sound('flicker');
  showMessage('Duas trancas vibraram ao mesmo tempo.',3,'O LOBO NÃO PRECISA ENTRAR. BASTA CANSAR VOCÊ.');
}
function demonTrick(e){
  state.hint.demon=true;
  if(Math.random()<.5){
    state.events.push({kind:'voice',room:'bedroom',ttl:5,t:0});sound('whisper');
    showMessage('Uma voz familiar chamou você do quarto.',3.4,'SEUS PAIS NÃO ESTÃO EM CASA.');
  }else{
    state.locks[e.id]=clamp(state.locks[e.id]-.2,0,1);
    state.study[e.id]=clamp(state.study[e.id]+.18,0,1);sound('lock');
    showMessage('Você ouviu o mecanismo girar sozinho.',2.5,e.label);
  }
  state.panic=clamp(state.panic+15,0,100);state.cameraShake=.22;
}

function ambient(dt){
  state.eventCooldown-=dt;
  for(const ev of state.events)ev.t+=dt;
  state.events=state.events.filter(ev=>ev.t<ev.ttl);
  if(state.eventCooldown<=0){
    const chance=.07+diff()*.12;
    if(Math.random()<chance){
      const room=pick(['living','kitchen','bedroom','bathroom','hall']);
      const kind=pick(['creak','steps','knock','scratch']);
      state.events.push({kind,room,ttl:rnd(2.5,4.7),t:0});
      if(kind==='knock')sound('knock');
    }
    state.eventCooldown=6-diff()*2;
  }
}

function updatePanic(dt){
  const targetEntry=entries.find(e=>e.id===state.targetEntry);
  const danger=targetEntry&&state.locks[targetEntry.id]<.25;
  let target=danger?46:0;
  if(state.form==='demon'&&state.hint.demon)target+=20;
  if(state.blackout>0)target+=16;
  state.panic=lerp(state.panic,target,dt*.75);
}
function updateBlackout(dt){
  if(state.blackout>0){state.blackout-=dt;if(state.blackout<=0){state.power=100;sound('flicker');showMessage('A luz voltou.',1.6);}}
}
function useFlashlight(){
  audioInit();
  if(state.blackout>0||state.battery<=0)return;
  state.flashlight=!state.flashlight;sound('click');
}
function observe(on){state.observe=on;}

function update(dt){
  state.t+=dt;
  if(state.scene==='title')return;
  if(state.scene==='intro'){updateIntro(dt);return;}
  if(state.scene!=='play')return;
  if(state.messageTime>0)state.messageTime-=dt;
  updateBlackout(dt);
  progressTime(dt);
  if(state.scene!=='play')return;
  movePlayer(dt);repair(dt);lockDecay(dt);threatAI(dt);ambient(dt);updatePanic(dt);
  if(state.flashlight){
    state.battery=clamp(state.battery-dt*(1.1+(state.form==='panther'?.35:0)),0,100);
    if(state.battery<=0){state.flashlight=false;showMessage('A lanterna morreu.',2);}
  }
  state.cameraShake=Math.max(0,state.cameraShake-dt*.55);
  state.toastTime=Math.max(0,state.toastTime-dt);
}

function updateIntro(dt){
  state.cut+=dt;
  if(state.cut>.8&&!state.cutClick){sound('click');state.cutClick=true;}
  if(state.cut>2.8&&state.cut<2.9)sound('knock');
  if(state.cut>5.3&&state.cut<5.4)sound('whisper');
  if(state.cut>7.8){begin();}
}
function die(cause){
  if(state.scene!=='play')return;
  state.scene='death';state.deathCause=cause;state.deaths++;state.cameraShake=.5;sound('stinger');
}
function win(){
  if(state.scene==='win')return;
  state.scene='win';state.winLine='Os pais chegaram às 06:00. A casa parece inteira — exceto por uma coisa.';sound('win');
}

// ---------- DRAW: TITLE ----------
function drawTitle(){
  rect(0,0,W,H,PAL.void);
  // Moon + cloud bands
  circle(620,92,43,PAL.moon);circle(638,83,36,PAL.void);
  rect(0,310,W,122,'#07090e');
  // House silhouette
  rect(130,160,500,170,'#161821');
  rect(112,175,536,155,'#20222b');
  rect(105,176,550,8,'#32333a');
  rect(324,196,88,134,'#090b10');
  rect(166,206,74,52,'#0a0b0f');rect(488,206,86,52,'#0a0b0f');
  // One warm window
  rect(186,224,36,23,'#514737');rect(495,223,48,22,'#4e443a');
  // tree silhouettes
  for(let i=0;i<7;i++){
    const x=28+i*92;
    rect(x,145,10,188,'#0c0e13');
    circle(x+5,128,33,'#0d1016');circle(x-10,148,26,'#0d1016');circle(x+20,149,26,'#0d1016');
  }
  // Baphomet in distance
  drawBaphomet(546,242,1.45,true,Math.floor(state.t*3));
  // Title
  txt('6',384,37,58,PAL.white,'center');
  txt('AM',417,37,58,PAL.white,'left');
  txt('NÃO DEIXE ENTRAR',384,101,16,'#9e9590','center');
  txt('uma casa · uma criança · oito horas',384,122,9,'#655f64','center');
  // Button
  const pulse=(Math.sin(state.t*3)+1)/2;
  rect(245,344,278,42,`rgb(${67+Math.floor(18*pulse)},27,34)`);
  stroke(245,344,278,42,'#a1434e');
  txt('ENTER  —  COMEÇAR',384,358,11,PAL.white,'center');
  txt('WASD  mover · E  reforçar · F  lanterna · Q  observar',384,402,7,'#5e5960','center');
}

// ---------- DRAW: INTRO ----------
function drawIntro(){
  rect(0,0,W,H,PAL.void);
  const t=state.cut;
  if(t<2.6){
    // Kitchen / departure scene
    rect(0,0,W,H,'#0e1015');
    rect(50,50,668,330,'#2c292f');rect(66,66,636,298,'#4d4142');
    rect(50,314,668,66,'#383034');
    // table and chairs
    rect(150,212,190,16,'#4b3935');rect(174,228,12,66,'#2c2427');rect(302,228,12,66,'#2c2427');
    drawParent(90,272,1.15);drawParent(634,272,1.15);
    drawChild(384,282,1.05);
    txt('22:00',384,22,13,PAL.text,'center');
    txt('"Tranque tudo antes de dormir."',384,337,10,PAL.white,'center');
  }else if(t<5.2){
    rect(0,0,W,H,'#06080d');
    rect(0,278,W,154,'#0b0d12');
    // road
    rect(262,160,244,272,'#161920');
    for(let i=0;i<9;i++)rect(386,174+i*34,22,10,'#48444b');
    // house
    rect(86,112,594,224,'#24262f');rect(108,96,556,24,'#30323a');
    rect(351,154,80,182,'#0c0e13');
    // car moving away
    const cx=state.cut<3.4?210:lerp(210,82,(state.cut-3.4)/1.8);
    rect(cx,245,80,34,'#2e3038');rect(cx+13,234,54,17,'#3b3c43');
    circle(cx+15,278,8,'#08090e');circle(cx+65,278,8,'#08090e');
    rect(cx+6,255,10,4,'#8e6f58');
    txt('o carro foi embora.',384,24,10,PAL.text,'center');
    txt('a casa ficou quieta.',384,39,8,PAL.dim,'center');
  }else{
    rect(0,0,W,H,'#030409');
    rect(0,303,W,129,'#090b10');
    // house at night
    rect(110,120,548,214,'#1c1e27');rect(94,105,580,22,'#292b33');
    rect(346,158,76,176,'#090b10');rect(182,176,70,48,'#080a0e');rect(491,176,79,48,'#080a0e');
    // far trees
    for(let i=0;i<12;i++){const x=i*73;rect(x,137,8,195,'#080a0e');circle(x+5,119,29,'#090b10');}
    drawBaphomet(612,276,1.55,true,Math.floor(state.t*4));
    txt('mas alguma coisa já estava olhando.',384,26,11,'#b8ada6','center');
    txt('há meses.',384,44,11,'#756d71','center');
    txt('VOCÊ NÃO ESTÁ SOZINHO.',384,384,8,PAL.red,'center');
  }
  const p=clamp((t-1.8)/1.2,0,1); if(p>0)rect(0,0,W,H,`rgba(0,0,0,${.35*p})`);
}

// ---------- DRAW: WORLD ----------
function drawWorld(){
  ctx.save();
  const sx=state.cameraShake>0?(Math.random()-.5)*state.cameraShake*13:0;
  const sy=state.cameraShake>0?(Math.random()-.5)*state.cameraShake*8:0;
  ctx.translate(sx,sy);
  rect(0,0,W,H,PAL.night);
  drawYard();
  drawHouse();
  drawFurniture();
  drawEntries();
  drawEvents();
  drawThreat();
  drawPlayer();
  drawLighting();
  ctx.restore();
  drawHUD();
}

function drawYard(){
  rect(0,0,W,72,'#0b0d14');
  // moon / clouds
  circle(650,45,29,PAL.moon);circle(660,39,24,'#0b0d14');
  for(let i=0;i<8;i++){
    const x=i*97+20;rect(x,45,58,3,'#11151e');rect(x+18,39,38,3,'#11151e');
  }
  // yard strips
  rect(0,358,W,74,'#080b0e');
  for(let i=0;i<40;i++){
    const x=(i*41)%W,y=365+(i%6)*9;
    rect(x,y,3,1,i%4===0?'#202a22':'#14191a');
  }
  // outside windows glow hints
  for(const e of entries){if(e.out==='norte')rect(e.x,e.y-2,e.w,2,'#64563d');}
}

function drawHouse(){
  // Outer masonry
  rect(28,66,712,300,PAL.wallDark);
  rect(34,72,700,286,PAL.wall);
  rect(38,76,692,278,PAL.floorAlt);
  // rooms
  for(const r of Object.values(rooms)){
    if(r.name==='VARANDA')continue;
    rect(r.x,r.y,r.w,r.h,r.floor===1? '#665149':r.floor===2?'#5b4b47':'#604d47');
    // top trim
    rect(r.x,r.y,r.w,5,PAL.wallLit);
    rect(r.x,r.y,r.w,2,'#65555a');
    // tile/floor seams
    for(let y=r.y+14;y<r.y+r.h-4;y+=16)rect(r.x+5,y,r.w-10,1,PAL.seam);
    for(let x=r.x+16;x<r.x+r.w-4;x+=32)rect(x,r.y+7,1,r.h-14,'rgba(30,26,29,.12)');
  }
  // walls / door openings between rooms
  rect(197,72,5,142,PAL.wallDark);rect(197,204,5,10,PAL.floorAlt);
  rect(447,72,5,142,PAL.wallDark);rect(447,204,5,10,PAL.floorAlt);
  rect(447,214,5,144,PAL.wallDark);rect(447,214,5,20,PAL.floorAlt);
  rect(197,214,5,144,PAL.wallDark);
  // corridor stripes
  for(let y=88;y<347;y+=18)rect(44,y,148,1,'#4b3c3b');
  // rugs
  rect(69,132,97,81,'#4d3c40');stroke(69,132,97,81,'#6e5555');
  rect(85,147,65,50,'#69504d');
}

function drawFurniture(){
  // Hall console + framed family photo
  rect(72,92,92,17,'#3a2b2d');rect(77,109,7,13,PAL.woodDark);rect(152,109,7,13,PAL.woodDark);
  rect(102,99,25,28,'#222028');stroke(102,99,25,28,'#76605b');
  // Living sofa
  rect(225,111,112,42,'#40343a');rect(233,105,96,10,'#564246');rect(232,151,7,11,PAL.woodDark);rect(324,151,7,11,PAL.woodDark);
  rect(355,110,61,31,'#3a3035');rect(360,106,51,7,'#554149');
  // coffee table + cup
  rect(276,167,95,10,'#463533');rect(288,177,8,21,PAL.woodDark);rect(352,177,8,21,PAL.woodDark);
  rect(328,158,8,9,'#777064');
  // Kitchen counters, sink, stove, fridge
  rect(469,102,244,22,'#3e3336');rect(469,124,244,10,'#29262b');
  rect(476,78,44,20,'#51444a');rect(535,78,52,20,'#51444a');rect(606,78,64,20,'#51444a');
  rect(688,82,29,72,'#343038');rect(689,90,27,3,'#4d4549');
  rect(488,140,52,34,'#363136');rect(568,142,48,40,'#373135');rect(639,139,55,45,'#3a3134');
  // Bedroom bed, nightstand, toy
  rect(225,244,120,64,'#41343a');rect(225,238,120,10,'#62484d');
  rect(235,231,38,17,'#927a73');rect(239,237,29,8,'#b09287');
  rect(356,274,53,14,'#3a2d30');rect(362,288,6,16,PAL.woodDark);rect(396,288,6,16,PAL.woodDark);
  rect(382,230,15,14,'#5d4547');rect(386,226,8,7,'#7a5755'); // toy
  // Bathroom tub, sink, toilet
  rect(472,236,95,37,'#666369');rect(480,242,79,23,'#7d7a7e');rect(478,240,83,4,'#918e91');
  rect(599,242,51,27,'#3c3437');rect(605,237,39,8,'#5b4b4c');
  rect(664,286,42,35,'#3b3337');rect(670,293,27,17,'#625459');
  // Curtains
  curtains(257,77,88,24);curtains(579,77,93,24);curtains(257,329,86,25);
  // little wall clock
  circle(111,76,10,'#9b887e');circle(111,76,7,'#2d2b30');line(111,76,111,71,'#c0aa98',1);line(111,76,115,79,'#c0aa98',1);
}
function curtains(x,y,w,h){rect(x,y,w,h,'#26232a');rect(x+3,y,10,h,'#43313d');rect(x+w-13,y,10,h,'#43313d');line(x+w/2,y+2,x+w/2,y+h-2,'#6a4f57');}

function drawEntries(){
  for(const e of entries){
    const l=state.locks[e.id];
    const target=e.id===state.targetEntry;
    // frame
    if(e.type==='porta'){
      rect(e.x,e.y,e.w,e.h,'#17151b');
      rect(e.x+3,e.y+1,e.w-6,e.h-2,'#754f42');
      rect(e.x+7,e.y+2,e.w-18,e.h-4,'#392a29');
      rect(e.x+e.w-11,e.y+2,4,4,PAL.brass);
    } else {
      rect(e.x,e.y,e.w,e.h,'#191b20');
      const panes=Math.max(2,Math.floor(e.w>e.h?e.w/15:e.h/15));
      if(e.w>e.h){
        for(let i=0;i<panes;i++)rect(e.x+3+i*(e.w-6)/panes,e.y+2,(e.w-6)/panes-3,e.h-4,l>.45?PAL.glass:'#2c1e22');
        for(let i=1;i<panes;i++)rect(e.x+3+i*(e.w-6)/panes,e.y,2,e.h,'#4b464a');
      }else{
        for(let i=0;i<panes;i++)rect(e.x+2,e.y+3+i*(e.h-6)/panes,e.w-4,(e.h-6)/panes-3,l>.45?PAL.glass:'#2c1e22');
        for(let i=1;i<panes;i++)rect(e.x,e.y+3+i*(e.h-6)/panes,e.w,2,'#4b464a');
      }
    }
    // lock durability bracket
    const bx=e.x+(e.w>e.h?0:-6),by=e.y+(e.h>e.w?0:-6);
    const bw=e.w>e.h?e.w:5,bh=e.h>e.w?5:e.h;
    rect(bx,by,bw,bh,'#17161b');
    if(e.w>e.h)rect(bx,by,bw*l,bh,l<.28?PAL.red:l<.58?PAL.amber:PAL.green);else rect(bx,by,bw,bh*l,l<.28?PAL.red:l<.58?PAL.amber:PAL.green);
    if(target){
      const pulse=(Math.sin(state.t*8)+1)/2;
      stroke(e.x-3,e.y-3,e.w+6,e.h+6,`rgba(178,67,78,${.4+.6*pulse})`,2);
    }
  }
}

function drawEvents(){
  for(const ev of state.events){
    const r=rooms[ev.room];if(!r)continue;
    const x=r.x+r.w/2,y=r.y+r.h/2-4;
    const a=1-ev.t/ev.ttl;
    ctx.save();ctx.globalAlpha=a;
    if(ev.kind==='bark'){
      txt('WOOF!',x,y,11,PAL.text,'center');
      circle(x-22,y+18,2,PAL.dim);circle(x+21,y+18,2,PAL.dim);
    }else if(ev.kind==='rush'){
      for(let i=0;i<4;i++)line(x-24+i*12,y+18,x-5+i*12,y+8,PAL.dim,1);
    }else if(ev.kind==='howl')txt('AOUUU',x,y,11,PAL.text,'center');
    else if(ev.kind==='voice')txt('...vem cá...',x,y,10,'#a99898','center');
    else if(ev.kind==='knock')txt('KNOCK',x,y,9,PAL.text,'center');
    else if(ev.kind==='scratch')txt('SCRR...',x,y,9,PAL.dim,'center');
    else if(ev.kind==='steps')txt('TAP',x,y,9,PAL.dim,'center');
    else txt('CRR...',x,y,9,PAL.dim,'center');
    ctx.restore();
  }
}

function drawThreat(){
  const e=entries.find(x=>x.id===state.targetEntry);if(!e)return;
  let x=e.x+e.w/2,y=e.y+e.h/2;
  if(e.y<100)y+=22;else if(e.y>340)y-=22;else if(e.x<120)x+=22;else x-=22;
  const close=state.locks[e.id]<.42||state.observe;
  let visible=close;
  if(state.form==='panther')visible=state.flashlight||Math.sin(state.t*2.2)>.55;
  if(state.form==='dog')visible=state.flashlight||Math.sin(state.t*1.9)>.15;
  if(!visible)return;
  const flick=1+Math.sin(state.t*10)*.04;
  if(state.form==='dog')drawDog(x,y,1.25*flick);
  else if(state.form==='panther')drawPanther(x,y,1.25*flick);
  else if(state.form==='wolf')drawWolf(x,y,1.23*flick);
  else drawBaphomet(x,y,1.44*flick,true,Math.floor(state.t*4));
}

function drawDog(x,y,s){
  ctx.save();ctx.translate(Math.round(x),Math.round(y));
  const c=FORM.dog.color;
  rect(-19*s,-7*s,35*s,15*s,c);rect(-11*s,-15*s,17*s,11*s,c);rect(-19*s,-12*s,8*s,6*s,c);rect(6*s,-13*s,6*s,5*s,c);
  rect(-11*s,6*s,5*s,12*s,c);rect(8*s,6*s,5*s,12*s,c);rect(16*s,-3*s,11*s,4*s,c);
  rect(-5*s,-10*s,3*s,3*s,PAL.brass);rect(3*s,-10*s,3*s,3*s,PAL.brass);
  ctx.restore();
}
function drawPanther(x,y,s){
  ctx.save();ctx.translate(Math.round(x),Math.round(y));
  const c=FORM.panther.color;
  rect(-22*s,-7*s,38*s,14*s,c);rect(-14*s,-16*s,19*s,11*s,c);rect(1*s,-20*s,6*s,7*s,c);rect(14*s,-11*s,22*s,5*s,c);
  rect(-12*s,5*s,5*s,14*s,c);rect(7*s,5*s,5*s,14*s,c);rect(23*s,1*s,6*s,10*s,c);
  rect(-8*s,-12*s,3*s,3*s,'#81728c');rect(1*s,-12*s,3*s,3*s,'#81728c');
  ctx.restore();
}
function drawWolf(x,y,s){
  ctx.save();ctx.translate(Math.round(x),Math.round(y));
  const c=FORM.wolf.color;
  rect(-20*s,-7*s,37*s,15*s,c);rect(-13*s,-17*s,19*s,11*s,c);rect(-10*s,-23*s,5*s,8*s,c);rect(2*s,-23*s,5*s,8*s,c);rect(13*s,-12*s,15*s,6*s,c);
  rect(-11*s,6*s,5*s,14*s,c);rect(8*s,6*s,5*s,14*s,c);rect(22*s,0,7*s,10*s,c);
  rect(-7*s,-13*s,3*s,3*s,PAL.brass);rect(3*s,-13*s,3*s,3*s,PAL.brass);
  ctx.restore();
}
function drawBaphomet(x,y,s,full=false,frame=0){
  ctx.save();ctx.translate(Math.round(x),Math.round(y));
  const c=FORM.demon.color;
  // shadow/body
  rect(-17*s,5*s,34*s,38*s,c);rect(-24*s,-13*s,48*s,23*s,c);rect(-15*s,-26*s,30*s,15*s,c);
  // ears/horns
  rect(-25*s,-28*s,11*s,12*s,c);rect(14*s,-28*s,11*s,12*s,c);rect(-12*s,-38*s,5*s,14*s,c);rect(7*s,-38*s,5*s,14*s,c);
  // arms + legs
  if(full){rect(-33*s,0,10*s,5*s,c);rect(23*s,0,10*s,5*s,c);}
  rect(-10*s,35*s,6*s,12*s,c);rect(4*s,35*s,6*s,12*s,c);
  // face and eyes
  rect(-9*s,-11*s,6*s,5*s,PAL.brass);rect(3*s,-11*s,6*s,5*s,PAL.brass);
  if(frame%2===0){rect(-7*s,-1*s,14*s,2*s,'#22141d');rect(-4*s,4*s,3*s,2*s,'#22141d');rect(1*s,4*s,3*s,2*s,'#22141d');}
  // chest sigil
  rect(-3*s,12*s,6*s,10*s,'#28151d');rect(-8*s,16*s,16*s,3*s,'#28151d');
  ctx.restore();
}

function drawPlayer(){
  const p=state.player;const bob=Math.sin(p.step)*1;
  // shadow
  rect(p.x-8,p.y+15,16,3,'rgba(0,0,0,.35)');
  rect(p.x-5,p.y-16+bob,10,9,PAL.skin);rect(p.x-7,p.y-7+bob,14,16,PAL.shirt);rect(p.x-6,p.y+9,5,12,PAL.pants);rect(p.x+1,p.y+9,5,12,PAL.pants);rect(p.x-7,p.y+19,6,3,PAL.shoe);rect(p.x+1,p.y+19,6,3,PAL.shoe);
  // hair
  rect(p.x-7,p.y-18+bob,14,5,'#171820');rect(p.x-9,p.y-15+bob,3,6,'#171820');
  // shirt stripe and flashlight
  rect(p.x-3,p.y-4+bob,6,2,PAL.shirtHi);
  if(state.flashlight)rect(p.x+(p.dir>0?8:-11),p.y-1,3,3,PAL.brass);
}

function drawLighting(){
  const px=state.player.x,py=state.player.y;
  // dark overlay with radial light around player
  const blackout=state.blackout>0;
  const light=state.flashlight&&!blackout;
  const r=light?215:120;
  const g=ctx.createRadialGradient(px,py,20,px,py,r);
  g.addColorStop(0,'rgba(0,0,0,0)');
  g.addColorStop(.48,blackout?'rgba(0,0,0,.16)':'rgba(0,0,0,.18)');
  g.addColorStop(1,`rgba(0,0,0,${blackout?.82:.66})`);
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  if(light){
    ctx.save();ctx.globalAlpha=.18;
    ctx.fillStyle='#e7dac0';ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px+state.player.dir*160,py-55);ctx.lineTo(px+state.player.dir*160,py+55);ctx.closePath();ctx.fill();ctx.restore();
  }
  if(state.panic>55){ctx.fillStyle=`rgba(126,18,34,${.04+Math.sin(state.t*10)*.02})`;ctx.fillRect(0,0,W,H);}
}

function drawHUD(){
  // top strip
  rect(0,0,W,56,'rgba(5,6,9,.94)');
  rect(0,55,W,2,'#2c2830');
  txt('6AM',18,12,13,PAL.white);txt('NÃO DEIXE ENTRAR',61,14,7,'#686167');
  txt(timeText(),384,9,22,PAL.white,'center');
  const form=FORM[state.form];txt(form.name,748,12,9,state.form==='demon'?PAL.red:PAL.text,'right');
  txt('NOITE 01',748,27,6,'#5b565d','right');
  // battery
  txt('LAN',620,43,6,'#59545a');rect(640,44,86,6,'#19171c');rect(640,44,86*state.battery/100,6,state.battery<20?PAL.red:PAL.amber);
  // entrance panel
  const panelW=150,panelH=35;const startX=13,startY=72;
  for(let i=0;i<entries.length;i++){
    const e=entries[i],col=i%3,row=Math.floor(i/3),x=startX+col*(panelW+6),y=startY+row*(panelH+5);
    rect(x,y,panelW,panelH,'rgba(10,10,14,.78)');
    const l=state.locks[e.id];
    txt(`${i+1}  ${e.type==='porta'?'PORTA':'JANELA'}`,x+7,y+5,6,e.id===state.targetEntry?PAL.red:PAL.dim);
    rect(x+7,y+19,panelW-14,5,'#1c191e');rect(x+7,y+19,(panelW-14)*l,5,l<.28?PAL.red:l<.58?PAL.amber:PAL.green);
  }
  // lower prompt
  const e=nearbyEntry();
  if(e){
    rect(13,366,365,37,'rgba(7,7,10,.93)');stroke(13,366,365,37,'#302b31');
    txt(e.label,24,373,8,PAL.white);txt('SEGURE  E  PARA REFORÇAR A TRAVA',24,387,7,PAL.dim);
  }
  // message box
  if(state.messageTime>0){
    rect(205,338,358,57,'rgba(6,6,9,.93)');stroke(205,338,358,57,'#3b343b');
    txt(state.message,384,349,8,PAL.white,'center');
    if(state.subtitle)txt(state.subtitle,384,366,6,'#7e7576','center');
  }
  // observe mode
  if(state.observe){
    rect(302,120,164,51,'rgba(7,7,10,.92)');stroke(302,120,164,51,'#55494c');
    txt('OBSERVANDO',384,131,9,PAL.white,'center');
    const target=entries.find(e=>e.id===state.targetEntry);
    if(target)txt(`${target.label} · ${Math.round(state.locks[target.id]*100)}%`,384,148,7,PAL.amber,'center');
  }
  // panic vignette UI
  if(state.panic>65)txt('NÃO OLHE PARA O CORREDOR.',384,58,6,PAL.red,'center');
}

function drawDeath(){
  rect(0,0,W,H,'rgba(26,2,7,.76)');
  // restrained pixel gore
  for(let i=0;i<80;i++){
    const x=(i*91+Math.floor(state.t*23))%W,y=(i*47+31)%H,s=1+(i%4);
    rect(x,y,s,s,i%3?PAL.redDark:PAL.red);
  }
  drawBaphomet(384,170,2.35,true,Math.floor(state.t*6));
  txt('ENTROU.',384,286,26,PAL.white,'center');
  txt('VOCÊ NÃO CHEGOU ÀS 06:00',384,319,9,'#bdb3ad','center');
  txt(state.deathCause,384,340,7,'#80767a','center');
  rect(277,374,214,31,'#58222b');txt('R  —  TENTAR NOVAMENTE',384,384,8,PAL.white,'center');
}
function drawWin(){
  rect(0,0,W,H,'#090c11');
  // dawn house
  rect(0,230,W,202,'#10161b');
  rect(112,128,560,210,'#2e3438');rect(100,112,584,22,'#414448');
  rect(337,154,90,184,'#12161a');
  rect(177,179,68,48,'#9b8059');rect(501,179,82,48,'#9b8059');
  // sunrise
  circle(620,110,42,'#c1a66f');rect(0,184,W,6,'#9c8464');
  txt('06:00',384,36,28,PAL.white,'center');
  txt('A luz voltou.',384,92,14,PAL.white,'center');
  txt(state.winLine,384,117,8,'#887e7b','center');
  txt('Você ouve o carro na rua.',384,145,8,'#aaa09a','center');
  // tiny suspicious handprint
  rect(563,207,18,3,'#4d3134');rect(568,201,3,8,'#4d3134');rect(574,200,3,9,'#4d3134');rect(580,202,3,7,'#4d3134');
  rect(276,374,216,31,'#343438');txt('R  —  JOGAR NOVAMENTE',384,384,8,PAL.white,'center');
}
function drawPause(){
  rect(0,0,W,H,'rgba(0,0,0,.63)');txt('PAUSADO',384,170,24,PAL.white,'center');txt('P para continuar',384,206,8,PAL.text,'center');
}
function draw(){
  ctx.clearRect(0,0,W,H);
  if(state.scene==='title')drawTitle();
  else if(state.scene==='intro')drawIntro();
  else if(state.scene==='play')drawWorld();
  else if(state.scene==='death'){drawWorld();drawDeath();}
  else if(state.scene==='win')drawWin();
  // CRT border / scan lines internal
  ctx.save();ctx.globalAlpha=.03;for(let y=0;y<H;y+=4)rect(0,y,W,1,'#fff');ctx.restore();
  if(state.scene==='play'&&state._paused)drawPause();
}

window.addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();
  if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();
  keys.add(k);audioInit();
  if(state.scene==='title'&&(k==='enter'||k===' ')){startFromTitle();return;}
  if(state.scene==='intro'&&(k==='enter'||k===' ')){state.cut=8;return;}
  if((state.scene==='death'||state.scene==='win')&&k==='r'){resetGame();return;}
  if(state.scene==='play'){
    if(k==='p'){ if(state.scene==='play') state.observe=false; state._paused=!state._paused; return; }
    if(k==='f')useFlashlight();
  }
});
window.addEventListener('keyup',e=>{
  const k=e.key.toLowerCase();keys.delete(k);
});
window.addEventListener('blur',()=>{keys.clear();state.observe=false;});

// Special pause wrapper: keeps draw readable while stopping simulation.
const rawUpdate=update;
function gameUpdate(dt){if(state._paused)return;rawUpdate(dt);}
function loop(now){const dt=Math.min(.05,(now-(state.last||now))/1000);state.last=now;gameUpdate(dt);draw();requestAnimationFrame(loop);}

// Hold Q to observe.
window.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='q'&&state.scene==='play'){state.observe=true;state.observeTime=0;}});
window.addEventListener('keyup',e=>{if(e.key.toLowerCase()==='q'){state.observe=false;}});

state.scene='title';
requestAnimationFrame(loop);

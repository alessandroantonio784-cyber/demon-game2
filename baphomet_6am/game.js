'use strict';

// 6AM — NÃO DEIXE ENTRAR
// Jogo completo em HTML5 Canvas + JavaScript puro.
// Sem bibliotecas externas: pronto para GitHub Pages.

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const W = canvas.width, H = canvas.height;

const keys = new Set();
let audio = null;
let audioReady = false;

const C = {
  bg:'#06070a', ink:'#09090c', black:'#101017', wall:'#2c2930', wall2:'#454048',
  floor:'#5b4a43', floor2:'#655149', seam:'#4d3f3a', skin:'#c9a38f', skin2:'#8f6b5d',
  shirt:'#272632', pants:'#1b1a22', white:'#ece6de', muted:'#a19a95', faint:'#655f62',
  red:'#a93a49', red2:'#6d2330', gold:'#c9b374', green:'#7f9b77', blue:'#66788f',
  shadow:'#17151d', moon:'#c8c0af'
};

const rooms = {
  hall:{x:20,y:30,w:110,h:210,name:'CORREDOR'},
  living:{x:130,y:30,w:165,h:98,name:'SALA'},
  kitchen:{x:295,y:30,w:165,h:98,name:'COZINHA'},
  bedroom:{x:130,y:128,w:165,h:112,name:'QUARTO'},
  bath:{x:295,y:128,w:165,h:112,name:'BANHEIRO'}
};

const entrances = [
  {id:'front',name:'PORTA DA FRENTE',x:62,y:232,w:30,h:8,room:'hall',kind:'porta'},
  {id:'back',name:'PORTA DOS FUNDOS',x:452,y:154,w:8,h:35,room:'bath',kind:'porta'},
  {id:'livingWindow',name:'JANELA DA SALA',x:170,y:30,w:42,h:7,room:'living',kind:'janela'},
  {id:'kitchenWindow',name:'JANELA DA COZINHA',x:345,y:30,w:42,h:7,room:'kitchen',kind:'janela'},
  {id:'bedWindow',name:'JANELA DO QUARTO',x:170,y:233,w:42,h:7,room:'bedroom',kind:'janela'},
  {id:'bathWindow',name:'JANELA DO BANHEIRO',x:452,y:198,w:8,h:35,room:'bath',kind:'janela'}
];

const FORMS = {
  dog:{name:'CÃO NEGRO',subtitle:'ELE QUER QUE VOCÊ OLHE PARA O LUGAR ERRADO',color:'#17151b',speed:1.00},
  panther:{name:'PANTERA',subtitle:'QUANDO A LUZ FALHA, ELA SE MOVE',color:'#0d0d13',speed:1.16},
  wolf:{name:'LOBO',subtitle:'ELE NÃO PARA DE TESTAR AS TRANCAS',color:'#26262e',speed:1.08},
  demon:{name:'BAPHOMET',subtitle:'AGORA ELE ENTENDE VOCÊ',color:'#3a222a',speed:0.98}
};

const FORM_ORDER = ['dog','panther','wolf','demon'];

const game = {
  state:'menu', paused:false,
  elapsed:0, hour:22, minute:0,
  form:'dog', formIndex:0,
  cutscene:0, fade:0,
  player:{x:76,y:185,speed:72,facing:1},
  locks:{}, study:{},
  threat:{entry:null,studyTimer:0,pressure:0},
  events:[], eventCooldown:5,
  message:'', messageTimer:0, messageQueue:[],
  flashlight:false, battery:100, power:100, powerDown:0,
  panic:0, heartbeat:0, shake:0,
  hints:{dog:false,panther:false,wolf:false,demon:false},
  deathReason:'', endingText:'',
  titleBlink:0,
  started:false,
  seed:Math.random()*9999
};

function resetGame(){
  game.state='cutscene'; game.paused=false; game.elapsed=0; game.hour=22; game.minute=0;
  game.form='dog'; game.formIndex=0; game.cutscene=0; game.fade=0; game.message=''; game.messageTimer=0; game.messageQueue=[];
  game.player={x:76,y:185,speed:72,facing:1}; game.threat={entry:null,studyTimer:0,pressure:0};
  game.events=[]; game.eventCooldown=4.2; game.flashlight=false; game.battery=100; game.power=100; game.powerDown=0;
  game.panic=0; game.heartbeat=0; game.shake=0; game.deathReason=''; game.endingText='';
  game.hints={dog:false,panther:false,wolf:false,demon:false};
  for(const e of entrances){game.locks[e.id]=1; game.study[e.id]=0;}
  pickThreat(true); ensureAudio();
}

function startGame(){
  game.state='play'; game.started=true; showMessage('Aguente até 06:00. Reforce as entradas antes que ele aprenda sua rotina.',5);
  sfx('low');
}

function ensureAudio(){
  if(audioReady) return;
  try{
    audio = new (window.AudioContext||window.webkitAudioContext)();
    audioReady=true;
  }catch{}
}

function tone(freq,dur=.08,type='square',vol=.018,slide=0){
  if(!audioReady || !audio) return;
  const o=audio.createOscillator(), g=audio.createGain();
  o.type=type; o.frequency.value=freq;
  if(slide) o.frequency.linearRampToValueAtTime(freq+slide,audio.currentTime+dur);
  g.gain.value=vol; g.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+dur);
  o.connect(g); g.connect(audio.destination); o.start(); o.stop(audio.currentTime+dur);
}

function sfx(kind){
  switch(kind){
    case 'lock': tone(310,.05,'square',.02); tone(470,.07,'square',.016); break;
    case 'unlock': tone(180,.12,'sawtooth',.018,-60); break;
    case 'knock': tone(72,.09,'square',.035); tone(56,.14,'square',.025); break;
    case 'step': tone(105,.035,'square',.01); break;
    case 'whisper': tone(220,.3,'sine',.008,-100); break;
    case 'alarm': tone(150,.18,'square',.03); tone(92,.25,'square',.022); break;
    case 'low': tone(74,.3,'sine',.02,-18); break;
    case 'win': tone(523,.12,'square',.025); tone(659,.16,'square',.022); tone(784,.24,'square',.022); break;
    case 'death': tone(62,.65,'sawtooth',.035,-30); break;
  }
}

function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function lerp(a,b,t){return a+(b-a)*t;}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function roomAt(x,y){
  for(const r of Object.values(rooms)) if(x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h) return r;
  return null;
}
function currentHourIndex(){
  // 22,23,00,01,02,03,04,05,06 => 0..8
  const h=game.hour; return h>=22?h-22:h+2;
}
function difficulty(){return clamp(currentHourIndex()/8,0,1);}
function inFinalHour(){return game.hour===5;}
function formatTime(){
  const hh=(game.hour%12)||12, mm=Math.floor(game.minute);
  return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')} ${game.hour<12?'AM':'PM'}`;
}
function showMessage(text,sec=3){game.message=text;game.messageTimer=sec;}

function pickThreat(force=false){
  if(!force && Math.random()<.55 && game.threat.entry) return;
  const weak=entrances.filter(e=>game.locks[e.id]<.9);
  const source=weak.length?weak:entrances;
  let choice=source[Math.floor(Math.random()*source.length)];
  if(game.threat.entry && source.length>1){
    let tries=0; while(choice.id===game.threat.entry && tries++<8) choice=source[Math.floor(Math.random()*source.length)];
  }
  game.threat.entry=choice.id; game.threat.studyTimer=0; game.threat.pressure=0;
}

function nearEntrance(){
  let best=null, bestD=Infinity;
  for(const e of entrances){
    const cx=e.x+e.w/2, cy=e.y+e.h/2;
    const d=Math.hypot(game.player.x-cx,game.player.y-cy);
    if(d<34 && d<bestD){best=e;bestD=d;}
  }
  return best;
}

function update(dt){
  game.titleBlink+=dt;
  if(game.state==='menu') return;
  if(game.state==='cutscene'){updateCutscene(dt);return;}
  if(game.state!=='play'||game.paused)return;
  game.elapsed+=dt;
  game.messageTimer=Math.max(0,game.messageTimer-dt);
  game.eventCooldown-=dt;
  game.heartbeat+=dt;
  game.shake=Math.max(0,game.shake-dt*7);

  // 8 minutos reais = 8 horas; fácil de testar e ainda permite uma noite completa.
  const realMinutes = game.elapsed * (8*60)/(8*60);
  const desiredMinute = realMinutes % 60;
  game.minute = desiredMinute;
  const targetHour = 22 + Math.floor(realMinutes/60);
  const normalized = targetHour>=24?targetHour-24:targetHour;
  if(normalized!==game.hour){ game.hour=normalized; onHourChange(); }
  if(game.elapsed>=8*60){winGame();return;}

  updatePlayer(dt);
  updateLights(dt);
  updateLocks(dt);
  updateThreat(dt);
  updateEvents(dt);
  updatePanic(dt);

  if(game.flashlight){
    game.battery=clamp(game.battery-dt*(1.15+(game.form==='panther'?.35:0)),0,100);
    if(game.battery<=0){game.flashlight=false;showMessage('A lanterna morreu.',2.2);sfx('alarm');}
  }
}

function updatePlayer(dt){
  let dx=0,dy=0;
  if(keys.has('w')||keys.has('arrowup'))dy--;
  if(keys.has('s')||keys.has('arrowdown'))dy++;
  if(keys.has('a')||keys.has('arrowleft')){dx--;game.player.facing=-1;}
  if(keys.has('d')||keys.has('arrowright')){dx++;game.player.facing=1;}
  const mag=Math.hypot(dx,dy)||1;
  let sp=game.player.speed;
  if(game.panic>70) sp*=.92;
  game.player.x += dx/mag*sp*dt;
  game.player.y += dy/mag*sp*dt;
  game.player.x=clamp(game.player.x,28,452); game.player.y=clamp(game.player.y,40,232);
  if(Math.abs(dx)+Math.abs(dy)>0 && Math.random()<dt*2.2) sfx('step');
}

function updateLights(dt){
  if(game.form==='panther' && game.powerDown<=0 && Math.random()<dt*(0.025+difficulty()*0.05)){
    game.powerDown=5.5+difficulty()*3;
    game.power=35;
    game.hints.panther=true;
    showMessage('As luzes piscaram. Na escuridão, alguma coisa correu pelo corredor.',3.2);
    sfx('alarm');
  }
  if(game.powerDown>0){
    game.powerDown-=dt;
    if(game.powerDown<=0){game.power=100;sfx('low');showMessage('A energia voltou.',1.7);}
  }
}

function updateLocks(dt){
  const ent=nearEntrance();
  if(ent && (keys.has('e')||keys.has(' '))){
    const old=game.locks[ent.id];
    game.locks[ent.id]=clamp(old+dt*(2.6+(game.form==='wolf'?-0.35:0)),0,1);
    game.study[ent.id]=clamp(game.study[ent.id]-dt*2.6,0,1);
    if(game.locks[ent.id]>=.99 && old<.99) sfx('lock');
  }

  const diff=difficulty();
  for(const e of entrances){
    let pressure=.03 + diff*.07;
    if(game.form==='wolf') pressure*=1.85;
    if(game.form==='demon') pressure*=1.18;
    game.study[e.id]=clamp(game.study[e.id]+dt*pressure,0,1);
    const weak=Math.max(0,game.study[e.id]-.2);
    game.locks[e.id]=clamp(game.locks[e.id]-dt*(.018+weak*.095*FORMS[game.form].speed),0,1);
  }
}

function updateThreat(dt){
  if(!game.threat.entry || Math.random()<dt*(.018+difficulty()*.02)) pickThreat();
  const ent=entrances.find(e=>e.id===game.threat.entry); if(!ent)return;
  const diff=difficulty();
  game.threat.studyTimer += dt*(.4+diff*.9)*FORMS[game.form].speed;

  if(game.form==='dog' && game.threat.studyTimer>3.8){
    game.threat.studyTimer=0; dogAbility();
  }
  if(game.form==='panther' && game.threat.studyTimer>4.7){
    game.threat.studyTimer=0; pantherAbility();
  }
  if(game.form==='wolf' && game.threat.studyTimer>3.1){
    game.threat.studyTimer=0; wolfAbility();
  }
  if(game.form==='demon' && game.threat.studyTimer>2.8){
    game.threat.studyTimer=0; demonAbility();
  }

  const threshold=.16 + diff*.07;
  if(game.locks[ent.id]<threshold){
    game.threat.pressure += dt*(.28+diff*.55);
  }else{
    game.threat.pressure=Math.max(0,game.threat.pressure-dt*.36);
  }
  if(game.locks[ent.id]<=.05 && game.threat.pressure>3.3){
    die(`A ${ent.kind} cedeu antes de você conseguir voltar.`);return;
  }

  if(game.locks[ent.id]<.3 && Math.random()<dt*(.02+diff*.04)){
    game.panic=clamp(game.panic+9,0,100); game.shake=Math.max(game.shake,.12);
  }
}

function dogAbility(){
  game.hints.dog=true;
  const r=Object.keys(rooms)[Math.floor(Math.random()*Object.keys(rooms).length)];
  game.events.push({kind:'bark',room:r,life:4.5,t:0});
  showMessage('Um latido veio de dentro da casa. Não corra para investigar.',2.8);
  sfx('knock');
}

function pantherAbility(){
  game.hints.panther=true;
  game.power=clamp(game.power-30,10,100);
  const e=entrances[Math.floor(Math.random()*entrances.length)];
  game.study[e.id]=clamp(game.study[e.id]+.32,0,1);
  showMessage('Uma sombra passou pela parede. Confira as trancas, não a sombra.',2.7);
  sfx('whisper');
}

function wolfAbility(){
  game.hints.wolf=true;
  const weak=entrances.slice().sort((a,b)=>game.locks[a.id]-game.locks[b.id]).slice(0,2);
  for(const e of weak) game.locks[e.id]=clamp(game.locks[e.id]-.18,0,1);
  game.events.push({kind:'howl',room:'hall',life:3.4,t:0});
  showMessage('O uivo fez duas trancas vibrarem ao mesmo tempo.',2.7);
  game.panic=clamp(game.panic+7,0,100); sfx('alarm');
}

function demonAbility(){
  game.hints.demon=true;
  const fakeVoice = Math.random()<.5;
  if(fakeVoice){
    game.events.push({kind:'voice',room:'bedroom',life:4.5,t:0});
    showMessage('Uma voz conhecida chama você do quarto. Você mora sozinho esta noite.',3.4);
  }else{
    const e=entrances[Math.floor(Math.random()*entrances.length)];
    game.locks[e.id]=clamp(game.locks[e.id]-.26,0,1);
    game.study[e.id]=clamp(game.study[e.id]+.42,0,1);
    showMessage('A tranca girou sozinha.',2.2);
  }
  sfx('whisper'); game.panic=clamp(game.panic+12,0,100); game.shake=.2;
}

function createAmbientEvent(){
  const names=Object.keys(rooms); const room=names[Math.floor(Math.random()*names.length)];
  const pool=game.form==='dog'?['creak','steps','knock']:['creak','steps','knock','scrape'];
  game.events.push({kind:pool[Math.floor(Math.random()*pool.length)],room,life:3.4+Math.random()*2,t:0});
}

function updateEvents(dt){
  for(const ev of game.events) ev.t+=dt;
  game.events=game.events.filter(e=>e.t<e.life);
  if(game.eventCooldown<=0){
    const chance=.095+difficulty()*.13;
    if(Math.random()<chance) createAmbientEvent();
    game.eventCooldown=5.5-difficulty()*1.9;
  }
}

function updatePanic(dt){
  const danger=game.threat.entry && game.locks[game.threat.entry]<.24?1:0;
  const room=roomAt(game.player.x,game.player.y);
  let target=(danger?48:0)+(game.form==='demon'&&game.hints.demon?15:0);
  if(!room)target+=10;
  game.panic=lerp(game.panic,target,dt*.7);
  game.heartbeat += dt*(danger?2.1:0.65);
  if(danger && Math.sin(game.heartbeat*8)>.92) sfx('low');
}

function onHourChange(){
  if(game.hour===6){winGame();return;}
  game.formIndex=clamp(currentHourIndex()>=3?Math.floor((currentHourIndex())/2):0,0,3);
  // Form schedule: 22-23 dog, 00-01 panther, 02-03 wolf, 04-05 demon.
  if(game.hour===22||game.hour===23) game.formIndex=0;
  if(game.hour===0||game.hour===1) game.formIndex=1;
  if(game.hour===2||game.hour===3) game.formIndex=2;
  if(game.hour===4||game.hour===5) game.formIndex=3;
  game.form=FORM_ORDER[game.formIndex];
  const messages={
    dog:'O CÃO NEGRO começou a brincar com seus sentidos. Sons falsos agora vêm de dentro.',
    panther:'A PANTERA chegou. Quando a luz falhar, não confie nos seus olhos.',
    wolf:'O LOBO chegou. Ele não precisa correr: as trancas fazem o trabalho por ele.',
    demon:'Agora é BAPHOMET. Ele estudou você por meses. Esta noite é a prova.'
  };
  showMessage(messages[game.form],5); sfx('alarm'); game.shake=.16;
}

function toggleFlashlight(){
  if(game.state!=='play'||game.paused||game.powerDown>0)return;
  if(game.battery<=0)return;
  game.flashlight=!game.flashlight;
  sfx('lock');
}

function die(reason){
  if(game.state!=='play')return;
  game.state='death';game.deathReason=reason;game.fade=0;game.shake=.3;sfx('death');
}

function winGame(){
  if(game.state==='win')return;
  game.state='win';game.endingText='Os pais voltaram. A casa está inteira. A janela da sala ficou aberta um centímetro.';sfx('win');
}

function updateCutscene(dt){
  game.cutscene+=dt;
  if(game.cutscene>.65&&game.cutscene<.75)sfx('low');
  if(game.cutscene>2.1&&game.cutscene<2.2)sfx('lock');
  if(game.cutscene>4.1&&game.cutscene<4.2)sfx('whisper');
  if(game.cutscene>6.6)startGame();
}

function draw(){
  ctx.clearRect(0,0,W,H);
  if(game.state==='menu')drawMenu();
  else if(game.state==='cutscene')drawCutscene();
  else {drawWorld();if(game.state==='death')drawDeath();if(game.state==='win')drawWin();if(game.paused)drawPause();}
  drawScanlines();
}

function px(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
function line(x1,y1,x2,y2,c,w=1){ctx.strokeStyle=c;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
function text(str,x,y,size=10,c=C.white,align='left'){ctx.font=`${size}px monospace`;ctx.fillStyle=c;ctx.textAlign=align;ctx.textBaseline='top';ctx.fillText(str,Math.round(x),Math.round(y));}

function drawMenu(){
  px(0,0,W,H,'#05060a');
  // Distant house
  px(88,98,300,105,'#18161d'); px(75,112,326,91,'#242029'); px(92,88,286,22,'#302a34');
  px(124,131,32,45,'#0c0d11'); px(317,129,42,28,'#111118');
  px(172,122,30,24,'#101016'); px(335,122,30,24,'#101016');
  // Moon
  ctx.fillStyle=C.moon;ctx.beginPath();ctx.arc(385,53,24,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#05060a';ctx.beginPath();ctx.arc(395,46,20,0,Math.PI*2);ctx.fill();
  // Creature silhouette
  drawBaphomet(266,107,2.6,true,0);
  text('6AM',240,20,34,'#eee6de','center');
  text('NÃO DEIXE ENTRAR',240,61,13,'#a69f99','center');
  text('uma criança • uma casa • oito horas',240,78,8,'#665f64','center');
  const pulse=(Math.sin(game.titleBlink*3)+1)/2;
  px(160,198,160,25,`rgb(${122+Math.round(25*pulse)},38,48)`);
  text('ENTER — COMEÇAR',240,204,10,'#fff4ec','center');
  text('WASD mover  •  E reforçar  •  F lanterna  •  P pausa',240,236,7,'#5f5960','center');
  text('v1.0 — sem dependências externas',240,250,6,'#47434a','center');
}

function drawCutscene(){
  const t=game.cutscene;
  px(0,0,W,H,'#05060a');
  if(t<2.0){
    px(44,35,392,192,'#25232b'); px(52,42,376,178,'#5a4a48');
    px(206,96,70,94,'#29262d');
    drawPerson(150,158,.95);drawPerson(330,158,1.0);
    px(103,112,28,8,'#3a3032');px(350,113,23,7,'#3a3032');
    text('22:00',240,16,12,'#d7d0c8','center');
    text('"Tranque a casa quando a gente sair."',240,231,9,'#ece4dc','center');
  }else if(t<4.1){
    px(0,0,W,H,'#05060a');
    px(0,166,W,104,'#121318');
    px(74,77,330,93,'#25212a');px(94,60,290,20,'#302a33');
    px(211,99,58,82,'#0f1015');
    px(115,187,250,4,'#1d1e23');
    text('o carro desaparece na curva.',240,18,10,'#bdb5af','center');
    text('a rua fica quieta.',240,32,8,'#777176','center');
  }else if(t<6.6){
    px(0,0,W,H,'#040508');
    // Road
    px(0,165,W,105,'#101116');
    for(let i=0;i<10;i++)px(i*56+10,218,32,2,'#514a47');
    px(108,86,264,95,'#242029');px(128,70,224,18,'#312b34');
    px(218,107,44,72,'#0d0e13');
    drawBaphomet(386,150,1.35,true,0);
    text('mas alguma coisa já estava olhando.',240,18,11,'#ddd4cc','center');
    text('há meses.',240,34,11,'#8f8883','center');
    if(t>5.0)text('VOCÊ SENTE QUE ELA ESPEROU VOCÊ FICAR SOZINHO.',240,236,7,'#9a303f','center');
  }
}

function drawWorld(){
  const sx=game.shake>0?(Math.random()-.5)*game.shake*8:0;
  const sy=game.shake>0?(Math.random()-.5)*game.shake*8:0;
  ctx.save();ctx.translate(sx,sy);
  px(0,0,W,H,'#08090d');
  drawExterior(); drawRooms(); drawFurniture(); drawEntrances(); drawEvents(); drawThreat(); drawPlayer(); drawVignette();
  ctx.restore();
  drawHUD();
}

function drawExterior(){
  px(0,0,W,30,'#10111a');px(0,240,W,30,'#07080b');
  // faint rain / stars
  for(let i=0;i<38;i++){
    const x=(i*83)%W,y=7+(i*17)%18;
    px(x,y,1,1,i%3===0?'#6b6671':'#2c2b34');
  }
  px(0,30,20,210,'#13141b');px(460,30,20,210,'#101117');
  // yard patches
  for(let i=0;i<18;i++){
    const x=(i*51+13)%W,y=242+(i%3)*6;
    px(x,y,3,1,'#24252b');
  }
}

function drawRooms(){
  for(const r of Object.values(rooms)){
    px(r.x,r.y,r.w,r.h,C.floor2);
    px(r.x,r.y,r.w,3,C.wall2);px(r.x,r.y,3,r.h,C.wall2);px(r.x+r.w-3,r.y,3,r.h,C.wall2);px(r.x,r.y+r.h-3,r.w,3,C.wall2);
    for(let yy=r.y+10;yy<r.y+r.h-5;yy+=13)px(r.x+5,yy,r.w-10,1,C.seam);
    for(let xx=r.x+9;xx<r.x+r.w-7;xx+=26)px(xx,r.y+6,1,r.h-12,'rgba(20,18,22,.12)');
  }
}

function drawFurniture(){
  // Living room
  px(154,61,68,27,'#42383a');px(156,57,64,6,'#584748');px(158,88,4,16,'#27232a');px(214,88,4,16,'#27232a');
  px(238,56,37,23,'#3c3335');px(243,52,27,5,'#4f4142');
  // Kitchen counters
  px(309,58,130,18,'#3f3738');px(309,80,130,8,'#2b272b');
  px(318,91,25,19,'#302b30');px(355,91,25,19,'#302b30');px(392,91,35,19,'#332d30');
  px(325,46,18,8,'#665450');px(386,45,25,8,'#5e504c');
  // Bedroom bed and toy
  px(154,157,66,45,'#3e3238');px(154,157,66,8,'#5e4549');px(160,153,23,11,'#8f7b76');
  px(228,182,30,6,'#342c31');px(232,176,22,5,'#45383b');
  px(147,216,13,8,'#4e3d3d');px(148,211,11,6,'#6a5050');
  // Bathroom
  px(311,153,43,24,'#55535a');px(315,157,35,16,'#78757a');
  px(383,174,38,37,'#383136');px(390,181,24,4,'#4f4042');
  // Corridor painting and tiny family photo
  px(47,53,49,35,'#29252c');px(51,57,41,27,'#4b3e43');px(66,65,10,9,'#1b1a20');
  px(91,98,23,29,'#2d282e');px(95,102,15,17,'#5a4a4d');
}

function drawEntrances(){
  for(const e of entrances){
    const l=game.locks[e.id];
    const threatened=e.id===game.threat.entry;
    const weak=l<.45;
    px(e.x,e.y,e.w,e.h,'#17151a');
    if(e.w>e.h){
      for(let i=0;i<e.w;i+=6)px(e.x+i,e.y+1,3,e.h-2,weak?'#5a383b':'#8a7364');
      if(l>.92)px(e.x+e.w-6,e.y+2,3,e.h-4,C.gold);
    }else{
      for(let i=0;i<e.h;i+=6)px(e.x+1,e.y+i,e.w-2,3,weak?'#5a383b':'#8a7364');
      if(l>.92)px(e.x+1,e.y+e.h/2,e.w-2,3,C.gold);
    }
    if(threatened){
      const pulse=Math.floor(game.heartbeat*4)%2===0;
      if(pulse)px(e.x-3,e.y-3,e.w+6,2,C.red);
      text(weak?'!!':'!',e.x+e.w/2,e.y-13,8,C.red,'center');
    }
  }
}

function drawEvents(){
  for(const ev of game.events){
    const r=rooms[ev.room];if(!r)continue;
    const x=r.x+r.w/2,y=r.y+r.h/2;
    const pulse=1+Math.sin(ev.t*7)*.25;
    if(ev.kind==='voice') text('...psst...',x,y,7,'#b7a4a0','center');
    else if(ev.kind==='bark') text('WOOF',x,y,8,'#c8c0ba','center');
    else if(ev.kind==='howl') text('AOUUU',x,y,8,'#c8c0ba','center');
    else if(ev.kind==='scrape')text('SCRR...',x,y,7,'#bdb6b0','center');
    else if(ev.kind==='knock')text('KNOCK',x,y,7,'#cfc5bf','center');
    else if(ev.kind==='steps')text('TAP',x,y,7,'#b7aea8','center');
    else text('CRR...',x,y,7,'#9f9893','center');
    px(x-2* pulse,y+10,4*pulse,1,'#7f7872');
  }
}

function drawThreat(){
  const e=entrances.find(x=>x.id===game.threat.entry);if(!e)return;
  let x=e.x+e.w/2,y=e.y+e.h/2;
  if(e.y<50)y+=16;else if(e.y>220)y-=15;else if(e.x<100)x+=15;else x-=15;
  const visible = game.form!=='panther' || game.flashlight || Math.sin(game.elapsed*2.4)>.2;
  if(!visible)return;
  if(game.form==='dog'||game.form==='wolf')drawAnimal(x,y,1.1,game.form);
  else if(game.form==='panther')drawAnimal(x,y,1.2,'panther');
  else drawBaphomet(x,y,1.25,false,Math.floor(game.elapsed*4)%2);
}

function drawAnimal(x,y,s,type){
  ctx.save();ctx.translate(Math.round(x),Math.round(y));const c=FORMS[type].color;
  if(type==='dog'){
    px(-12*s,-5*s,23*s,10*s,c);px(-8*s,-12*s,11*s,8*s,c);px(-16*s,-8*s,5*s,4*s,c);px(8*s,-10*s,5*s,4*s,c);px(-9*s,4*s,4*s,9*s,c);px(7*s,4*s,4*s,9*s,c);
  }else if(type==='wolf'){
    px(-13*s,-6*s,27*s,11*s,c);px(-8*s,-15*s,14*s,10*s,c);px(-9*s,-19*s,4*s,7*s,c);px(3*s,-19*s,4*s,7*s,c);px(12*s,-8*s,8*s,4*s,c);px(-10*s,4*s,4*s,10*s,c);px(7*s,4*s,4*s,10*s,c);
  }else{
    px(-15*s,-6*s,30*s,10*s,c);px(-9*s,-14*s,18*s,10*s,c);px(-12*s,-18*s,6*s,6*s,c);px(6*s,-18*s,6*s,6*s,c);px(-14*s,3*s,5*s,10*s,c);px(8*s,3*s,5*s,10*s,c);
  }
  px(-4*s,-8*s,3*s,3*s,C.gold);px(3*s,-8*s,3*s,3*s,C.gold);ctx.restore();
}

function drawBaphomet(x,y,s=1,full=false,frame=0){
  ctx.save();ctx.translate(Math.round(x),Math.round(y));
  const c='#36202b';
  px(-11*s,10*s,22*s,28*s,c);px(-15*s,-2*s,30*s,19*s,c);px(-11*s,-11*s,22*s,11*s,c);
  px(-19*s,-14*s,9*s,10*s,c);px(10*s,-14*s,9*s,10*s,c);
  px(-7*s,-23*s,4*s,12*s,c);px(3*s,-23*s,4*s,12*s,c);
  if(full){px(-23*s,3*s,9*s,3*s,c);px(14*s,3*s,9*s,3*s,c);px(-6*s,30*s,4*s,9*s,c);px(2*s,30*s,4*s,9*s,c);}
  px(-5*s,-4*s,3*s,3*s,C.gold);px(2*s,-4*s,3*s,3*s,C.gold);
  if(frame%2===0){px(-7*s,4*s,14*s,2*s,'#21131b');px(-4*s,8*s,3*s,2*s,'#21131b');px(1*s,8*s,3*s,2*s,'#21131b');}
  ctx.restore();
}

function drawPerson(x,y,s=1){
  px(x-4*s,y-11*s,8*s,7*s,C.skin);px(x-5*s,y-5*s,10*s,14*s,C.shirt);px(x-4*s,y+9*s,4*s,11*s,C.pants);px(x,y+9*s,4*s,11*s,C.pants);px(x-5*s,y-14*s,10*s,4*s,'#16161c');
}

function drawPlayer(){
  const p=game.player;const bob=Math.sin(game.elapsed*8)*.4;
  px(p.x-4,p.y-10+bob,8,7,C.skin);px(p.x-6,p.y-5+bob,12,14,C.shirt);px(p.x-5,p.y+9,4,11,C.pants);px(p.x+1,p.y+9,4,11,C.pants);px(p.x-7,p.y-13+bob,14,4,'#16161d');
  // tiny flashlight in hand when on
  if(game.flashlight){px(p.x+(p.facing>0?7:-9),p.y+1,3,2,C.gold);}
}

function drawVignette(){
  const cx=game.player.x,cy=game.player.y;
  const light=game.flashlight&&!game.powerDown;
  const alpha=light?.28:game.powerDown>.1?.48:.40;
  const g=ctx.createRadialGradient(cx,cy,light?45:25,cx,cy,light?160:105);
  g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,`rgba(0,0,0,${alpha})`);
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  if(game.powerDown>0){
    px(0,0,W,H,`rgba(19,10,22,${.12+Math.sin(game.elapsed*18)*.02})`);
  }
}

function drawHUD(){
  px(0,0,W,28,'rgba(6,6,9,.94)');
  text(formatTime(),10,7,11,C.white);
  text(FORMS[game.form].name,240,7,8,game.form==='demon'?C.red:C.muted,'center');
  text(`TRANCAS ${entrances.filter(e=>game.locks[e.id]>.92).length}/6`,470,7,8,C.muted,'right');

  // lock bars
  const baseY=34;
  for(let i=0;i<entrances.length;i++){
    const e=entrances[i],x=12+(i%3)*156,y=baseY+Math.floor(i/3)*13;
    text(`${i+1}`,x,y,6,C.faint);
    px(x+10,y+1,118,5,'#1a171c');
    px(x+10,y+1,118*game.locks[e.id],5,game.locks[e.id]<.3?C.red:game.locks[e.id]<.62?C.gold:C.green);
  }

  if(game.flashlight||game.battery<40){
    text(`LAN: ${Math.floor(game.battery)}%`,362,248,7,game.battery<20?C.red:C.muted);
  }
  const ent=nearEntrance();
  if(ent){
    px(12,221,190,28,'rgba(4,4,7,.88)');
    text(ent.name,18,225,7,C.white);
    text('SEGURE E / ESPAÇO PARA REFORÇAR',18,236,6,C.muted);
  }
  if(game.messageTimer>0){
    const width=400; px(40,111,width,43,'rgba(5,5,8,.92)');
    text(game.message,240,123,8,C.white,'center');
    text(FORMS[game.form].subtitle,240,136,6,C.faint,'center');
  }
  if(game.panic>55){
    const alpha=(Math.sin(game.elapsed*9)+1)/12;
    px(0,28,W,210,`rgba(120,20,35,${alpha})`);
  }
}

function drawDeath(){
  px(0,0,W,H,'rgba(19,0,4,.70)');
  // light pixel gore: splatters/blocks only
  for(let i=0;i<52;i++){
    const x=(i*71+Math.floor(game.elapsed*13))%W;
    const y=(i*43+17)%H;
    const s=(i%4)+1;
    px(x,y,s,s,i%3===0?'#7f2834':'#5a2029');
  }
  drawBaphomet(240,104,2.35,true,0);
  text('VOCÊ NÃO CHEGOU ÀS 06:00',240,158,13,C.white,'center');
  text(game.deathReason,240,177,8,C.muted,'center');
  px(146,206,188,24,'#722b37');text('R — TENTAR NOVAMENTE',240,212,8,'#fff2eb','center');
}

function drawWin(){
  px(0,0,W,H,'#07090d');
  px(60,52,360,160,'#262b31');px(76,69,328,126,'#4d5358');
  px(214,93,52,102,'#272b31');
  // faint sunrise
  ctx.fillStyle='#b8ad99';ctx.globalAlpha=.15;ctx.beginPath();ctx.arc(397,74,34,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  text('06:00 AM',240,20,18,C.white,'center');
  text('A luz voltou.',240,79,12,C.white,'center');
  text('Os pais chegaram.',240,96,9,C.muted,'center');
  text('A casa parece normal.',240,112,8,C.faint,'center');
  text('quase.',240,126,8,C.red,'center');
  px(150,177,180,24,'#4b4744');text('R — JOGAR NOVAMENTE',240,183,8,C.white,'center');
}

function drawPause(){
  px(0,0,W,H,'rgba(0,0,0,.58)');
  text('PAUSADO',240,99,20,C.white,'center');
  text('P para continuar',240,126,8,C.muted,'center');
}

function drawScanlines(){
  ctx.fillStyle='rgba(255,255,255,.018)';
  for(let y=0;y<H;y+=4)ctx.fillRect(0,y,W,1);
  ctx.strokeStyle='rgba(255,255,255,.025)';ctx.strokeRect(.5,.5,W-1,H-1);
}

window.addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();
  if(['arrowup','arrowdown','arrowleft','arrowright',' ','e','f','p','r','enter'].includes(k))e.preventDefault();
  keys.add(k);ensureAudio();
  if(k==='enter'&&game.state==='menu'){resetGame();return;}
  if(k==='p'&&game.state==='play'){game.paused=!game.paused;return;}
  if(k==='f'){toggleFlashlight();return;}
  if(k==='r'&&(game.state==='death'||game.state==='win')){resetGame();return;}
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));

function loop(now){
  const dt=Math.min(.05,(now-(game.last||now))/1000);game.last=now;
  update(dt);draw();requestAnimationFrame(loop);
}

resetGame();game.state='menu';
requestAnimationFrame(loop);

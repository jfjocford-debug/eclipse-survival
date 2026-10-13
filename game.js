import {Engine} from './engine/loop.js';
import {Input} from './engine/input.js';
import {ECS} from './ecs/world.js';
import {World} from './world/generator.js';
import {Renderer} from './render/renderer.js';
import {AIController} from './ai/controller.js';
import {updateNeeds} from './systems/needs.js';
import {updateWeather} from './systems/weather.js';
import {attack,updateCombat} from './systems/combat.js';
import {UI} from './ui/hud.js';
import {Visibility} from './world/visibility.js';
import {loadGame,saveGame,clearSave,exportSave,importSave} from './save/indexedDB.js';
import {ITEMS,RECIPES} from './data/items.js';

export function createState(){
 return {version:1,seed:74219,time:9*60,day:1,elapsed:0,paused:false,dead:false,
  weather:{type:'overcast',intensity:.25,temperature:16},
  player:{id:1,x:7.5,y:7.5,dirX:1,dirY:0,health:100,hunger:86,thirst:82,energy:100,stamina:100,bleeding:0,infection:0,inventory:[{id:'bat',qty:1},{id:'water',qty:2},{id:'beans',qty:2},{id:'bandage',qty:2},{id:'plank',qty:4},{id:'nails',qty:8},{id:'hammer',qty:1}],equipped:'bat',skills:{strength:0,fitness:0,crafting:0},kills:0},
  zombies:[],particles:[],messages:[],worldChanges:{},objectives:{looted:0,crafted:0,barricaded:0},stats:{distance:0},settings:{sound:true},noise:0,saveStatus:'Preparing save…'};
}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export class Game{
 constructor(){this.state=createState();this.lastSave=0;this.lastFrame=performance.now();this.saveBusy=false;this.attackHeld=0;this.spawned=new Set();this.audio=null;this.resting=false;this._listeners=[];}
 async init(){
  this.canvas=document.getElementById('game-canvas');
  if(!this.canvas){this.canvas=document.createElement('canvas');this.canvas.id='game-canvas';document.body.prepend(this.canvas);}
  let saved=null;
  try{saved=await loadGame();}catch(e){console.warn('Load failed',e);this.persistenceBlocked=true;this.state.saveStatus='Existing save could not be read';}
  if(saved)this.restore(saved);
  this.world=new World(this.state.seed,this.state.worldChanges);this.world.update(this.state.player.x,this.state.player.y);
  this.renderer=new Renderer(this.canvas,this.world);this.input=new Input(this.canvas);this.ai=new AIController(this.world);
  if(!saved)this.spawnInitial();
  this.initEntities();
  this.ui=new UI(this);this.ui.mount();
  this.engine=new Engine({update:dt=>this.update(dt),render:alpha=>this.render(alpha)});
  const onResize=()=>this.renderer.resize();window.addEventListener('resize',onResize);this.renderer.resize();
  document.addEventListener('visibilitychange',()=>{if(document.hidden){if(!this.state.paused&&!this.state.dead)this.action('pause');this.save();this.ui.update(this.state);}});
  window.addEventListener('pagehide',()=>this.save());
  this.notify(saved?'Survivor restored. Your story continues.':'Find supplies. Secure a shelter. Survive the night.');
  if(this.persistenceBlocked)this.notify('Existing save could not be read and has been preserved. Start a new survivor or import a backup to resume saving.');
  else if(!saved)await this.save();else this.state.saveStatus='Survivor restored';
  this.updateNearby();this.ui.update(this.state);
 }
 restore(saved){
  const fresh=createState();
  this.state={...fresh,...saved,player:{...fresh.player,...saved.player,skills:{...fresh.player.skills,...saved.player?.skills}},objectives:{...fresh.objectives,...saved.objectives},stats:{...fresh.stats,...saved.stats},settings:{...fresh.settings,...saved.settings},messages:[],particles:[],paused:false};
  this.state.dead=this.state.player.health<=0;this.state.nearby=null;this._deathHandled=this.state.dead;
  this.spawned=new Set(this.state.spawnedChunks||[]);
 }
 start(){this.render(0);this.engine.start();}
 initEntities(){
  this.ecs=new ECS();this.entityIds=new Map();
  this.ecs.create({survivor:this.state.player,position:this.state.player});
  this.syncEntities();
 }
 syncEntities(){
  for(const z of this.state.zombies){if(!this.entityIds.has(z.id)){this.entityIds.set(z.id,this.ecs.create({zombie:z,position:z}));}}
  const actors=[];
  for(const [id,z] of this.ecs.query('zombie')){
   if(z.health<=0&&distance(z,this.state.player)>42){this.ecs.remove(id);this.entityIds.delete(z.id);}
   else actors.push(z);
  }
  this.state.zombies=actors;
 }
 getItem(id){return ITEMS[id]||{name:id,category:'Supply',weight:.1,description:''};}
 count(id){return this.state.player.inventory.find(i=>i.id===id)?.qty||0;}
 addItem(id,qty=1){const a=this.state.player.inventory.find(i=>i.id===id);if(a)a.qty+=qty;else this.state.player.inventory.push({id,qty});}
 removeItem(id,qty=1){const a=this.state.player.inventory.find(i=>i.id===id);if(!a||a.qty<qty)return false;a.qty-=qty;this.state.player.inventory=this.state.player.inventory.filter(i=>i.qty>0);return true;}
 getRecipes(){return RECIPES.map(r=>({...r,canCraft:r.ingredients.every(i=>this.count(i.id)>=i.qty)}));}
 canReach(prop){
  const p=this.state.player,tx=prop.x+.5,ty=prop.y+.5,d=Math.hypot(tx-p.x,ty-p.y);
  for(let t=.2;t<d-.6;t+=.2){if(this.world.isBlocked(p.x+(tx-p.x)*t/d,p.y+(ty-p.y)*t/d))return false;}
  return true;
 }
 getNearbyLoot(){const p=this.findLoot();return p?.loot?.filter(i=>i.qty>0)||[];}
 findLoot(){return this.world.getNearby(this.state.player.x,this.state.player.y,2.2).filter(p=>p.loot?.some(i=>i.qty>0)&&!p.looted&&this.canReach(p)).sort((a,b)=>distance(a,this.state.player)-distance(b,this.state.player))[0];}
 nearestOpening(){return this.world.getNearby(this.state.player.x,this.state.player.y,2.4).filter(p=>(p.type==='door'||p.type==='window')&&this.canReach(p)).sort((a,b)=>distance(a,this.state.player)-distance(b,this.state.player))[0];}
 notify(text){if(!text)return;this.state.messages.push({text,at:performance.now()});this.state.messages=this.state.messages.slice(-5);this.ui?.notify?.(text);}
 spawnInitial(){
  const places=[[17.5,10.5],[20.5,13.5],[21.5,8.5],[25.5,18.5],[27.5,16.5],[13.5,24.5],[29.5,7.5],[7.5,25.5],[-5.5,16.5]];
  this.state.zombies=places.filter(([x,y])=>!this.world.isBlocked(x,y)).map(([x,y],i)=>({id:100+i,x,y,health:80,mode:'idle',dirX:0,dirY:1,attackCooldown:0}));
  for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)this.spawned.add(x+','+y);
 }
 spawnExplored(){
  const p=this.state.player,cx=Math.floor(p.x/16),cy=Math.floor(p.y/16);
  const key=cx+','+cy;if(this.spawned.has(key))return;this.spawned.add(key);
  let seed=(cx*73856093^cy*19349663^this.state.seed)>>>0;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<6&&this.state.zombies.filter(z=>z.health>0).length<100;i++){
   const x=cx*16+random()*28-6,y=cy*16+random()*28-6;
   if(!this.world.isBlocked(x,y)&&Math.hypot(x-p.x,y-p.y)>9)this.state.zombies.push({id:Date.now()+i,x,y,health:80,mode:'idle',dirX:1,dirY:0,attackCooldown:0});
  }
 }
 updateNearby(){
  const p=this.state.player;
  this.state.nearby=this.findLoot()||this.nearestOpening()||this.world.getNearby(p.x,p.y,1.8).find(o=>o.type==='bed')||null;
  this.state.location=this.world.getLocation?.(p.x,p.y)||this.world.getTile(p.x,p.y).room||'Cedar County outskirts';
 }
 update(dt){
  const s=this.state,p=s.player;
  if(this.input.consume('escape')){if(s.paused){this.ui.toggle?.('close');s.paused=false;}else this.action('pause');}
  for(const [key,action] of [['i','inventory'],['c','crafting'],['m','map'],['k','skills'],['h','help']])if(this.input.consume(key))this.action(action);
  if(this.input.consume('p')){if(s.paused){this.ui.toggle('close');this.action('resume');}else this.action('pause');}
  const wheel=this.input.consumeWheel?.()||0;if(wheel)this.action(wheel>0?'zoomOut':'zoomIn');
  if(this.input.consume('+')||this.input.consume('='))this.action('zoomIn');if(this.input.consume('-'))this.action('zoomOut');
  if(s.paused||s.dead){if(s.dead)this.ui.update(s);return;}
  s.elapsed+=dt;
  const move=this.input.movement();
  let mx=move.x+move.y,my=move.y-move.x,mag=Math.hypot(mx,my);
  const running=this.input.keys.has('shift')&&p.stamina>8;
  const sneaking=this.input.keys.has('z');
  s.sneaking=sneaking;s.running=running&&mag>0;p.running=s.running;p.sneaking=sneaking;p.resting=this.resting;
  if(mag>0){
   this.resting=false;mx/=mag;my/=mag;
   const speed=(running?3.5:sneaking?1.05:2.05)*(p.energy<15?.7:1);
   const dx=mx*speed*dt,dy=my*speed*dt,oldX=p.x,oldY=p.y;
   if(this.canMove(p.x+dx,p.y))p.x+=dx;
   if(this.canMove(p.x,p.y+dy))p.y+=dy;
   p.dirX=mx;p.dirY=my;p.moving=true;
   s.stats.distance+=Math.hypot(p.x-oldX,p.y-oldY);
   s.noise=Math.max(s.noise,running?9:sneaking?.6:3);
   if(running)p.skills.fitness+=dt*.025;
  }else p.moving=false;
  if(this.resting){
   if(s.zombies.some(z=>z.health>0&&distance(z,p)<5)){this.resting=false;this.notify('Too dangerous to rest.');}
   else{p.energy=Math.min(100,p.energy+dt*1.6);p.health=Math.min(100,p.health+dt*.1);}
  }
  this.world.update(p.x,p.y);this.spawnExplored();this.syncEntities();this.updateNearby();
  if(this.input.consume('e'))this.action('interact');
  if(this.input.consume('f'))this.action('loot');
  if(this.input.consume('b'))this.action('barricade');
  if(this.input.consume('v'))this.action('build');
  if(this.input.consume('x'))this.action('dismantle');
  if(this.input.consume('r'))this.action('rest');
  if(this.input.consume('5'))this.action('inventory');
  for(const [key,id] of [['1',p.equipped],['2','water'],['3','beans'],['4','bandage']])if(this.input.consume(key)){if(key==='1')this.doAttack();else this.action('use',id);}
  if(this.input.consume(' '))this.doAttack();
  this.attackHeld-=dt;
  if(this.input.pointer.down&&this.attackHeld<=0){
   const target=this.renderer.screenToWorld(this.input.pointer.x,this.input.pointer.y);
   const dx=target.x-p.x,dy=target.y-p.y,d=Math.hypot(dx,dy);if(d>.1){p.dirX=dx/d;p.dirY=dy/d;}
   this.doAttack(target);this.attackHeld=.42;
  }
  updateWeather(s,dt);updateNeeds(s,dt);this.ai.update(s,dt);updateCombat(s,dt);
  if(p.health<=0&&!this._deathHandled){this._deathHandled=true;s.dead=true;p.health=0;this.notify('Your survivor has fallen.');this.save();}
  if(s.elapsed-this.lastSave>15){this.lastSave=s.elapsed;this.save();}
 }
 canMove(x,y){const r=.22;return ![[x-r,y-r],[x+r,y-r],[x-r,y+r],[x+r,y+r]].some(([xx,yy])=>this.world.isBlocked(xx,yy));}
 doAttack(target){
  this.resting=false;const out=attack(this.state,this.world,target);
  if(out?.message)this.notify(out.message);
  if(out?.hit)this.tone(72,.08,'sawtooth',.06);else this.tone(150,.025,'triangle',.02);
 }
 // What the player can see (world/visibility.js). A new world means a new survivor, so a new memory.
 updateVisibility(){
  if(this.visibilityWorld!==this.world){this.visibility=new Visibility(this.world);this.visibilityWorld=this.world;}
  const p=this.state.player,w=this.state.weather;
  this.renderer.visibility=this.visibility.update({x:p.x,y:p.y,daylight:w?.daylight,weather:w});
 }
 render(alpha){
  const now=performance.now(),dt=now-this.lastFrame;this.lastFrame=now;
  this.state.render={fps:Math.round(this.engine?.fps||1000/Math.max(dt,1)),zoom:this.renderer.zoom};
  this.state.resting=this.resting;
  this.updateVisibility();
  this.renderer.render(this.state,alpha);this.ui.update(this.state);
 }
 async save(){
  if(this.persistenceBlocked)return;if(this.saveBusy){this.saveQueued=true;return;}this.saveBusy=true;
  try{this.state.worldChanges=this.world?.serialize()||this.state.worldChanges;this.state.spawnedChunks=[...this.spawned];this.state.saveStatus='Saving…';this.ui?.setSaveStatus?.('saving');await saveGame(this.state);this.ui?.setSaveStatus?.('saved');this.state.saveStatus='Saved just now';this.state.savedAt=Date.now();}
  catch(e){this.ui?.setSaveStatus?.('error');this.state.saveStatus='Save failed — export a backup';this.notify('Could not save in this browser. Export a backup from the pause menu.');console.warn(e);}
  finally{this.saveBusy=false;if(this.saveQueued){this.saveQueued=false;this.save();}}
 }
 async action(name,payload){
  const s=this.state,p=s.player;
  if(['inventory','crafting','skills','map','help'].includes(name)){this.ui.toggle(name);return;}
  if(name==='pause'){if(payload?.source==='ui'){s.paused=true;this.input?.clear();}else this.ui.toggle('pause');return;}
  if(name==='resume'){s.paused=false;this.input?.clear();return;}
  if(name==='save'){await this.save();return;}
  if(name==='export'){s.worldChanges=this.world.serialize();s.spawnedChunks=[...this.spawned];return exportSave(s);}
  if(name==='import'){
   const wasBlocked=this.persistenceBlocked;
   try{
    const next=await importSave(payload);
    // A reload fires pagehide; the old survivor must not overwrite this import.
    this.persistenceBlocked=true;this.saveQueued=false;
    await saveGame(next);location.reload();
   }catch(e){this.persistenceBlocked=wasBlocked;this.notify('Import failed: '+e.message);}return;
  }
  if(name==='restart'){
   await clearSave();this.persistenceBlocked=false;this.resting=false;this.attackHeld=0;this.ai.destroy();this.restore(createState());this.world=new World(this.state.seed,{});this.world.update(this.state.player.x,this.state.player.y);this.renderer.world=this.world;this.renderer.groundBlood?.clear();this.renderer.actorMotion?.clear();this.renderer.cameraReady=false;this.ai=new AIController(this.world);this.spawnInitial();this.initEntities();this.ui.toggle('close');this.state.paused=false;this.lastSave=0;await this.save();this.notify('A new survivor. A new chance.');return;
  }
  if(name==='zoomIn'||name==='zoomOut'){this.renderer.setZoom(this.renderer.zooms[this.renderer.zoomMode]+(name==='zoomIn'?.1:-.1));return;}
  if(name==='sound'){s.settings.sound=!s.settings.sound;if(s.settings.sound)this.tone(440,.1);return;}
  if(s.dead)return;
  if(name==='attack'){this.doAttack();return;}
  if(name==='equip'){const id=typeof payload==='string'?payload:payload?.id;if(this.count(id)&&['bat','axe','pistol'].includes(id)){p.equipped=id;this.notify(this.getItem(id).name+' equipped.');}return;}
  if(name==='use'){
   const id=typeof payload==='string'?payload:payload?.id;
   if(!this.count(id)){this.notify('No '+this.getItem(id).name.toLowerCase()+' remaining.');return;}
   if(['bat','axe','pistol'].includes(id))return this.action('equip',id);
   if(id==='water'){if(p.thirst>=99){this.notify('You are already hydrated.');return;}p.thirst=Math.min(100,p.thirst+38);}
   else if(id==='beans'){if(p.hunger>=99){this.notify('You are already well fed.');return;}p.hunger=Math.min(100,p.hunger+32);p.energy=Math.min(100,p.energy+8);}
   else if(id==='bandage'){if(p.health>=100&&!p.bleeding){this.notify('No injuries to bandage.');return;}p.bleeding=0;p.health=Math.min(100,p.health+12);}
   else{this.notify('Use this supply in crafting or barricading.');return;}
   this.removeItem(id);this.notify(this.getItem(id).name+' used.');this.tone(340,.08);this.save();return;
  }
  if(name==='craft'){
   const id=typeof payload==='string'?payload:payload?.id,r=this.getRecipes().find(r=>r.id===id);
   if(!r?.canCraft){this.notify('Gather the missing materials first.');return;}
   r.ingredients.forEach(i=>this.removeItem(i.id,i.qty));this.addItem(r.result.id,r.result.qty);p.skills.crafting+=12;s.objectives.crafted++;this.notify('Crafted '+r.name.toLowerCase()+'.');this.tone(540,.08);this.save();return;
  }
  if(name==='loot'){
   const prop=this.findLoot();if(!prop){this.notify('No supplies within reach.');return;}
   const items=prop.loot.filter(i=>i.qty>0);items.forEach(i=>this.addItem(i.id,i.qty));prop.loot=[];prop.looted=true;s.objectives.looted++;
   this.notify('Collected '+items.map(i=>i.qty+' '+this.getItem(i.id).name.toLowerCase()).join(', ')+'.');this.updateNearby();this.tone(460,.065);this.save();return;
  }
  if(name==='interact'){
   if(this.findLoot())return this.action('loot');
   const door=this.nearestOpening();
   if(door){if(door.barricaded){this.notify('Barricaded. Press B to remove a plank.');return;}door.open=!door.open;door.blocked=!door.open;this.notify(door.open?'Opened '+door.type+'.':'Closed '+door.type+'.');s.noise=4;this.save();return;}
   if(this.world.getNearby(p.x,p.y,2).some(o=>o.type==='bed'))return this.action('rest');
   this.notify('Move closer to a container, door, or window.');return;
  }
  if(name==='barricade'){
   const door=this.nearestOpening();if(!door){this.notify('Stand beside a door or window to barricade it.');return;}
   if(!this.count('hammer')){this.notify('You need a hammer.');return;}
   if(door.barricaded){door.barricaded--;this.addItem('plank');this.notify('Removed one plank.');}
   else{if(this.count('plank')<1||this.count('nails')<4){this.notify('Requires 1 plank and 4 nails.');return;}this.removeItem('plank');this.removeItem('nails',4);door.barricaded=(door.barricaded||0)+1;door.open=false;door.blocked=true;p.skills.crafting+=8;s.objectives.barricaded++;this.notify('Opening secured with a plank.');}
   s.noise=12;this.tone(115,.1,'square',.03);this.save();return;
  }
  if(name==='build'){
   if(!this.count('hammer')||this.count('plank')<2||this.count('nails')<4){this.notify('Building requires a hammer, 2 planks, and 4 nails.');return;}
   const x=Math.floor(p.x)+(Math.abs(p.dirX)>.4?Math.sign(p.dirX):0),y=Math.floor(p.y)+(Math.abs(p.dirY)>.4?Math.sign(p.dirY):0);
   if(this.world.isBlocked(x+.5,y+.5)||s.zombies.some(z=>z.health>0&&Math.hypot(z.x-x-.5,z.y-y-.5)<.9)){this.notify('The space ahead must be clear.');return;}
   const prop=this.world.placeProp({x,y,type:'fence',label:'Wooden barrier',blocked:true,health:100,color:'#786248',built:true});
   if(!prop){this.notify('Cannot build here.');return;}
   this.removeItem('plank',2);this.removeItem('nails',4);p.skills.crafting+=15;s.objectives.barricaded++;s.noise=12;
   this.notify('Wooden barrier built. Press X nearby to dismantle it.');this.save();return;
  }
  if(name==='dismantle'){
   if(!this.count('hammer')&&!this.count('axe')){this.notify('You need a hammer or axe.');return;}
   if((p.attackCooldown||0)>0)return;
   const prop=this.world.getNearby(p.x,p.y,1.9).filter(o=>['fence','wall','door','window','debris'].includes(o.type)&&this.canReach(o)).sort((a,b)=>distance(a,p)-distance(b,p))[0];
   if(!prop){this.notify('Stand closer to a wall, opening, or barrier.');return;}
   if(p.stamina<8){this.notify('Too exhausted. Rest before dismantling.');return;}
   const result=this.world.damageProp(prop.id,this.count('axe')?40:25);p.stamina-=8;p.attackCooldown=.6;s.noise=14;
   if(result?.destroyed){this.addItem('plank');p.skills.crafting+=5;this.notify('Structure dismantled. Salvaged one plank.');}
   else this.notify('Damaged structure. Keep dismantling to clear it.');
   this.tone(100,.09,'square',.03);this.save();return;
  }
  if(name==='rest'){
   this.resting=!this.resting;this.notify(this.resting?'Resting. Moving will interrupt.':'Rest interrupted.');return;
  }
 }
 tone(freq,duration,type='sine',volume=.035){
  if(!this.state.settings.sound)return;
  try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return;this.audio||=new C();if(this.audio.state==='suspended')this.audio.resume();const o=this.audio.createOscillator(),g=this.audio.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(volume,this.audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,this.audio.currentTime+duration);o.connect(g);g.connect(this.audio.destination);o.start();o.stop(this.audio.currentTime+duration);}catch{}
 }
}

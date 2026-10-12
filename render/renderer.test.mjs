import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { World } from '../world/generator.js';

let calls=0;
const numericMethods=new Set(['moveTo','lineTo','ellipse','arc','rect','fillRect','clearRect','strokeRect','translate','rotate','scale','transform','setTransform']);
function context() {
  return new Proxy({}, {
    get(target,key) {
      if(key==='measureText')return text=>({width:String(text).length*4});
      if(key==='getImageData')return (x,y,width,height)=>({data:new Uint8ClampedArray(width*height*4).fill(150),width,height});
      if(key==='createRadialGradient'||key==='createLinearGradient')return (...values)=>{
        assert.ok(values.every(Number.isFinite),`${key} must have finite coordinates`);return {addColorStop(){}};
      };
      if(key==='drawImage')return (image,...values)=>{assert.ok(image);assert.ok(values.every(Number.isFinite));calls++;};
      if(key in target)return target[key];
      return (...values)=>{if(numericMethods.has(key))assert.ok(values.every(value=>typeof value==='boolean'||Number.isFinite(value)),`${String(key)} has invalid coordinates ${values}`);calls++;};
    },
    set(target,key,value) {target[key]=value;return true;}
  });
}
class Canvas {
  constructor(width=1280,height=800){this.width=width;this.height=height;this.cssWidth=width;this.cssHeight=height;this.context=context();}
  getContext(){return this.context;}
  getBoundingClientRect(){return {width:this.cssWidth,height:this.cssHeight};}
}
globalThis.OffscreenCanvas=Canvas;
const {Renderer}=await import('./renderer.js');
const {cropToAlpha}=await import('./primitives.js');
const world=new World(74219);world.update(7.5,7.5);
const state={time:540,elapsed:0,weather:{type:'overcast',intensity:.25},player:{id:1,x:7.5,y:7.5,dirX:1,dirY:0,health:100,equipped:'bat'},zombies:[],particles:[]};

test('CSS projection round trips after camera movement, resize, DPR and zoom',()=>{
  const canvas=new Canvas(),renderer=new Renderer(canvas,world);
  for(const zoom of [.55,1,1.18,2.1])for(const camera of [[7.5,7.5],[-19.2,31.8],[420,-912]]) {
    renderer.camera={x:camera[0],y:camera[1]};renderer.setZoom(zoom);
    for(const [x,y] of [[0,0],[7.5,9.3],[-72.3,8.1],[420,-912]]) {
      const screen=renderer.worldToScreen(x,y),roundtrip=renderer.screenToWorld(screen.x,screen.y);
      assert.ok(Math.abs(roundtrip.x-x)<1e-9);assert.ok(Math.abs(roundtrip.y-y)<1e-9);
    }
  }
  canvas.cssWidth=860;canvas.cssHeight=620;globalThis.devicePixelRatio=2;renderer.resize();
  assert.equal(canvas.width,1720);assert.equal(renderer.width,860);
  const center=renderer.worldToScreen(renderer.camera.x,renderer.camera.y);assert.equal(center.x,430);assert.equal(center.y,334.8);
  renderer.setZoom(8);assert.equal(renderer.zoom,2.1);renderer.setZoom(.01);assert.equal(renderer.zoom,.55);
  delete globalThis.devicePixelRatio;
});

test('real generated worlds render all prop types, combat, night, rain and fog with finite geometry',()=>{
  const renderer=new Renderer(new Canvas(),world);
  const props=['wall','door','window','tree','crate','shelf','bed','table','chair','sofa','counter','car','lamp','debris','fence'];
  for(const type of props)for(const rotation of [0,1])for(const cutaway of [false,true]) {
    const o={id:type,x:4,y:4,type,rotation,cutaway,w:2,h:1,barricaded:3,open:rotation===1,looted:cutaway};
    renderer.props.get(o);
  }
  for(const [x,y] of [[7.5,7.5],[39,8],[-25,8],[7,-24],[42,42]]) {
    world.update(x,y);state.player.x=x;state.player.y=y;
    state.zombies=[{id:30,x:x+2,y:y+2,health:45,dirX:-1,dirY:0,hitTimer:.3},{id:32,x:x-2,y:y+2,health:0,deathTimer:5}];
    state.nearby=world.getNearby(x,y,3).find(o=>o.type==='crate');
    for(const type of ['overcast','rain','fog']) {
      state.weather={type,intensity:.9};state.time=type==='rain'?1380:540;state.elapsed+=.02;
      state.lastAttack={x,y,dirX:1,dirY:0,weapon:type==='fog'?'pistol':'axe',ttl:.2,duration:.3,range:1.5};
      state.particles=['blood','spark','muzzle','dust'].map((type,index)=>({type,x:x+.1*index,y,z:.5,life:.4,maxLife:1,size:2}));
      renderer.render(state,.5);
    }
  }
  assert.ok(calls>10000);assert.ok(renderer.props.cache.size<=420);assert.ok(renderer.stats.tiles>0);
  assert.ok(renderer.groundBlood.size>0);renderer.destroy();assert.equal(renderer.props.cache.size,0);
});

test('eight supplied survivor assets have valid PNG signatures',()=>{
  for(let i=0;i<8;i++) {
    const bytes=fs.readFileSync(new URL(`../assets/survivor/face-${i}.png`,import.meta.url));
    assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),80);assert.equal(bytes.readUInt32BE(20),144);
  }
});

test('infected reuse loaded directional sprites through a bounded variant cache',()=>{
  const renderer=new Renderer(new Canvas(),world),art=renderer.characters;
  art.images=Array.from({length:8},()=>({complete:true,naturalWidth:80,naturalHeight:144}));
  for(let id=0;id<4;id++)for(let i=0;i<8;i++) {
    const angle=i*Math.PI/4,dx=Math.cos(angle)+Math.sin(angle)*2,dy=Math.sin(angle)*2-Math.cos(angle);
    art.draw(renderer.ctx,{id,x:0,y:0,health:80,dirX:dx,dirY:dy},100,100,{moving:true,phase:1.3,elapsed:4});
  }
  assert.equal(art.infected.size,32);
  art.draw(renderer.ctx,{id:0,health:80,dirX:1,dirY:0},100,100,{moving:true,phase:2,elapsed:4});
  assert.equal(art.infected.size,32);renderer.destroy();assert.equal(art.infected.size,0);
});

test('ground cache reuses static paint while panning and rebuilds on viewport, zoom and world changes',()=>{
  const canvas=new Canvas(),localWorld=new World(74219),renderer=new Renderer(canvas,localWorld);
  renderer.reduceMotion=true;
  const local={...state,player:{...state.player,x:7.5,y:7.5},zombies:[],particles:[],lastAttack:null};
  let draws=0;
  const draw=renderer.tiles.draw.bind(renderer.tiles);
  renderer.tiles.draw=(...args)=>{draws++;return draw(...args);};
  localWorld.update(7.5,7.5);renderer.render(local);assert.ok(draws>500);
  const first=renderer.groundLayer;
  draws=0;renderer.render(local);assert.equal(draws,0);assert.equal(renderer.groundLayer,first);
  local.player.x+=1;renderer.render(local);assert.equal(draws,0);assert.equal(renderer.groundLayer,first);
  local.player.x+=15;localWorld.update(local.player.x,local.player.y);renderer.render(local);assert.ok(draws>500);assert.notEqual(renderer.groundLayer,first);
  draws=0;renderer.setZoom(1.5);renderer.render(local);assert.ok(draws>500);assert.equal(renderer.groundLayer.zoom,1.5);
  canvas.cssWidth=900;renderer.resize();assert.equal(renderer.groundLayer,null);renderer.render(local);assert.equal(renderer.groundLayer.canvas.width,1284);
  const replacement=new World(123);renderer.world=replacement;renderer.render(local);assert.equal(renderer.groundLayer.world,replacement);
  renderer.cacheGround=false;draws=0;renderer.render(local);assert.ok(draws>100);renderer.destroy();assert.equal(renderer.groundLayer,null);
});

test('alpha crop preserves world anchors, retains antialias padding, and tolerates limited canvas APIs',()=>{
  const width=20,height=30,data=new Uint8ClampedArray(width*height*4);
  for(const [x,y,alpha] of [[7,11,1],[12,18,255],[9,13,200]])data[(y*width+x)*4+3]=alpha;
  const canvas={width,height,getContext:()=>({getImageData:()=>({data})})};
  const crop=cropToAlpha(canvas,10,25);
  assert.equal(crop.canvas.width,8);assert.equal(crop.canvas.height,10);
  assert.equal(crop.ox,4);assert.equal(crop.oy,15);
  // Old pixel (9,13) becomes (3,3): both land on precisely the same screen point.
  assert.equal(500-crop.ox+3,500-10+9);assert.equal(600-crop.oy+3,600-25+13);
  const edgeData=new Uint8ClampedArray(width*height*4);edgeData[3]=1;
  const edge=cropToAlpha({width,height,getContext:()=>({getImageData:()=>({data:edgeData})})},10,25);
  assert.equal(edge.canvas.width,2);assert.equal(edge.canvas.height,2);assert.equal(edge.ox,10);assert.equal(edge.oy,25);
  for(const getContext of [()=>({}),()=>({getImageData:()=>({})}),()=>({getImageData(){throw new Error('No pixel reads');}}),()=>({getImageData:()=>({data:new Uint8ClampedArray(width*height*4)})})]) {
    const source={width,height,getContext};const fallback=cropToAlpha(source,10,25);
    assert.equal(fallback.canvas,source);assert.equal(fallback.ox,10);assert.equal(fallback.oy,25);
  }
});

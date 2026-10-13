import { TILE_W, TILE_H, HEIGHT, IsoPainter, clamp, hash, surface, polygon, ellipse, line } from './primitives.js';
import { TileAtlas } from './tiles.js';
import { PropAtlas } from './props.js';
import { CharacterArt } from './characters.js';

const FOG_SCALE=6;
const ZOOM_RANGE={outdoor:[.6,1.8],indoor:[1.3,2.8]};
const FOG_COLOR='7,12,15';
// How opaque the fog is over each kind of tile. Hidden shapes stay faintly visible by design.
const FOG={hidden:.9,remembered:.74,silhouette:.62,edge:.55,dark:.5};

/** Canvas2D world renderer. Public projection methods always use CSS pixels. */
export class Renderer {
  constructor(canvas, world) {
    this.canvas=canvas;this.world=world;
    this.ctx=canvas.getContext('2d',{alpha:false});
    if(!this.ctx)throw new Error('Deadfall requires a Canvas 2D compatible browser.');
    this.zooms={outdoor:1.18,indoor:2.4};this.zoomMode='outdoor';this.zoom=this.zooms.outdoor;this.camera={x:7.5,y:7.5};this.cameraReady=false;
    this.width=1;this.height=1;this.dpr=1;this.origin={x:0,y:0};
    this.tiles=new TileAtlas();this.props=new PropAtlas();this.characters=new CharacterArt();
    this.actorMotion=new Map();this.groundBlood=new Map();this.lastElapsed=0;this.lastNow=0;
    this.cacheGround=true;this.groundLayer=null;
    // Visibility (world/visibility.js): the game sets `visibility` each frame; `fogEnabled=false` shows everything for debugging.
    this.visibility=null;this.fogEnabled=true;this.fogCanvas=surface(1,1);this.fogCtx=this.fogCanvas.getContext('2d');
    this.lightCanvas=surface(1,1);this.lightCtx=this.lightCanvas.getContext('2d');
    this.reduceMotion=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
    this._destroyed=false;
    this.resize();
  }
  resize() {
    const rect=this.canvas.getBoundingClientRect?.();
    this.width=Math.max(1,Math.round(rect?.width||globalThis.innerWidth||this.canvas.width||1280));
    this.height=Math.max(1,Math.round(rect?.height||globalThis.innerHeight||this.canvas.height||720));
    this.dpr=Math.min(2,globalThis.devicePixelRatio||1);
    this.canvas.width=Math.round(this.width*this.dpr);this.canvas.height=Math.round(this.height*this.dpr);
    // The half-resolution lighting mask is smooth and cheap even on retina displays.
    this.lightCanvas.width=Math.ceil(this.width*.5);this.lightCanvas.height=Math.ceil(this.height*.5);
    this.fogCanvas.width=Math.ceil(this.width/FOG_SCALE);this.fogCanvas.height=Math.ceil(this.height/FOG_SCALE);
    this._setOrigin();
    this._vignette=null;
    this.groundLayer=null;
  }
  /** Zoom is remembered per side: the street is wide, rooms are close and contained. */
  setZoom(value) {
    if(Number.isFinite(value)){const r=ZOOM_RANGE[this.zoomMode];this.zoom=this.zooms[this.zoomMode]=clamp(value,r[0],r[1]);}
    this._setOrigin();return this.zoom;
  }
  /** Ease toward the zoom of the side the player is on. Steps are quantised so the ground cache is rebuilt rarely. */
  _easeZoom(dt) {
    const target=this.zooms[this.zoomMode],gap=target-this.zoom;
    if(Math.abs(gap)<.015){this.zoom=target;return;}
    if(this.reduceMotion){this.zoom=target;return;}
    const step=gap*(1-Math.exp(-dt*7));
    this.zoom=Math.round((this.zoom+step)/.03)*.03;
    if(Math.abs(target-this.zoom)<.03)this.zoom=target;
  }
  _setOrigin() {this.origin.x=this.width*.5;this.origin.y=this.height*.54;}
  worldToScreen(x,y,z=0) {
    return {x:this.origin.x+(x-y-this.camera.x+this.camera.y)*TILE_W*.5*this.zoom,
      y:this.origin.y+((x+y-this.camera.x-this.camera.y)*TILE_H*.5-z*HEIGHT)*this.zoom};
  }
  screenToWorld(x,y) {
    const dx=(x-this.origin.x)/(TILE_W*.5*this.zoom),dy=(y-this.origin.y)/(TILE_H*.5*this.zoom);
    return {x:this.camera.x+(dx+dy)*.5,y:this.camera.y+(dy-dx)*.5};
  }
  _point(x,y,z=0) {return [(x-y)*32,(x+y)*16-z*HEIGHT];}
  _visible(x,y,padding=160) {
    const s=this.worldToScreen(x,y);return s.x>-padding&&s.x<this.width+padding&&s.y>-60&&s.y<this.height+padding;
  }
  render(state,alpha=1) {
    if(this._destroyed||!state?.player)return;
    const ctx=this.ctx,p=state.player,elapsed=Number.isFinite(state.elapsed)?state.elapsed:0;
    const now=typeof performance==='undefined'?Date.now():performance.now();
    const dt=this.lastNow?clamp((now-this.lastNow)/1000,0,.1):1/60;this.lastNow=now;
    if(!this.cameraReady||Math.hypot(p.x-this.camera.x,p.y-this.camera.y)>25) {this.camera.x=p.x;this.camera.y=p.y;this.cameraReady=true;}
    const follow=this.reduceMotion?1:1-Math.exp(-dt*9);
    this.camera.x+=(p.x-this.camera.x)*follow;this.camera.y+=(p.y-this.camera.y)*follow;
    this.zoomMode=this.fogEnabled&&this.visibility?.mode==='indoor'?'indoor':'outdoor';
    this._easeZoom(dt);
    this._setOrigin();
    const radius=clamp(Math.ceil((this.width/64+this.height/32)/this.zoom*.5)+4,20,44);
    const tiles=this.world.getVisibleTiles(p.x,p.y,radius);
    const props=this.world.getProps(p.x,p.y,radius).filter(o=>this._visible(o.x,o.y));
    const night=this._night(state.time??540);
    ctx.setTransform(this.dpr,0,0,this.dpr,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
    ctx.fillStyle='#2d382e';ctx.fillRect(0,0,this.width,this.height);
    ctx.save();ctx.translate(this.origin.x,this.origin.y);ctx.scale(this.zoom,this.zoom);
    ctx.translate(-(this.camera.x-this.camera.y)*32,-(this.camera.x+this.camera.y)*16);
    ctx.imageSmoothingEnabled=true;
    this._drawGround(ctx,tiles,radius);
    this._propShadows(ctx,props,night);
    this._windowShafts(ctx,props,night);
    this._blood(ctx,state);
    if(state.nearby)this._interaction(ctx,state.nearby,elapsed);
    // Each object's ground contact determines its depth; actors interleave with furniture.
    const objects=props.map(prop=>({kind:'prop',object:prop,depth:prop.x+prop.y+((prop.w||1)+(prop.h||1))*.5}));
    const vis=this.fogEnabled?this.visibility:null;
    for(const zombie of state.zombies||[]) {
      const seen=vis?vis.entityState(zombie.x,zombie.y):'full';
      if(seen!=='none'&&this._visible(zombie.x,zombie.y))objects.push({kind:'actor',object:zombie,depth:zombie.x+zombie.y+.03,shape:seen==='shape'});
    }
    objects.push({kind:'player',object:p,depth:p.x+p.y+.04});
    objects.sort((a,b)=>a.depth-b.depth||(a.kind==='prop'?-1:1));
    const liveIds=new Set();
    for(const entry of objects) {
      const o=entry.object,q=this._point(o.x,o.y);
      if(entry.kind==='prop') {
        const obstructs=o.type==='tree'&&o.x+o.y>p.x+p.y&&Math.abs((o.x-o.y)-(p.x-p.y))<1.25&&o.x+o.y-p.x-p.y<6;
        if(obstructs)ctx.globalAlpha=.38;
        this.props.draw(ctx,o,...q);ctx.globalAlpha=1;
        if(o.type==='wall'&&o.label&&!o.cutaway)this._wallSign(ctx,o);
      } else {
        const isPlayer=entry.kind==='player';
        const key=`${isPlayer?'p':'z'}${o.id}`;liveIds.add(key);
        let motion=this.actorMotion.get(key);
        if(!motion) {motion={x:o.x,y:o.y,phase:0,moving:false};this.actorMotion.set(key,motion);}
        const movement=Math.hypot(o.x-motion.x,o.y-motion.y);
        motion.phase+=Math.min(movement,.3)*7;motion.moving=movement>.001||(isPlayer&&o.moving);
        motion.x=o.x;motion.y=o.y;
        if(entry.shape)ctx.globalAlpha=.5;
        ellipse(ctx,q[0]+3,q[1]+1,isPlayer?12:11,5,'rgba(13,22,17,.33)');
        if(isPlayer&&o.health>0)this._playerMarker(ctx,o,q,state);
        this.characters.draw(ctx,o,...q,{player:isPlayer,phase:this.reduceMotion?0:motion.phase,moving:motion.moving&&!state.paused,elapsed:this.reduceMotion?0:elapsed});
        ctx.globalAlpha=1;
        if(!entry.shape&&!isPlayer&&o.health>0&&o.health<75&&(o.hitTimer>0||Math.hypot(o.x-p.x,o.y-p.y)<3.5)) {
          ctx.fillStyle='rgba(20,27,21,.8)';ctx.fillRect(q[0]-10,q[1]-70,20,2);
          ctx.fillStyle='#ad805a';ctx.fillRect(q[0]-10,q[1]-70,20*clamp(o.health/80,0,1),2);
        }
      }
    }
    for(const key of this.actorMotion.keys())if(!liveIds.has(key))this.actorMotion.delete(key);
    this._attack(ctx,state);
    this._particles(ctx,state.particles||[]);
    ctx.restore();
    this._fog(vis,tiles,props);
    this._lighting(state,props,night,elapsed);
    this._weather(state,elapsed,night);
    this._vignettePass(state);
    this.lastElapsed=elapsed;
    this.stats={tiles:tiles.length,props:props.length,actors:liveIds.size,cachedTiles:this.tiles.cache.size,cachedProps:this.props.cache.size};
  }
  /**
   * Dark fog over everything the player cannot see. Drawn at a quarter of the resolution and scaled up,
   * which softens its edges. Remembered places and hidden places keep faint shapes; see FOG.
   */
  _fog(vis,tiles,props) {
    if(!vis)return;
    const f=this.fogCtx,w=this.fogCanvas.width,h=this.fogCanvas.height,k=1/FOG_SCALE;
    f.setTransform(1,0,0,1,0,0);f.globalCompositeOperation='source-over';f.clearRect(0,0,w,h);
    const indoor=vis.mode==='indoor',base=indoor?1:FOG.hidden;
    // Inside, everything outside the room is fully hidden. Outside, the town keeps faint shapes but interiors are sealed.
    f.fillStyle=`rgba(${FOG_COLOR},${base})`;f.fillRect(0,0,w,h);
    f.globalCompositeOperation='destination-out';
    const hw0=TILE_W*.5*this.zoom*k,hw=hw0,hh=TILE_H*.5*this.zoom*k;
    const cut=(tx,ty,alpha,lift=0,wide=1)=>{
      const s=this.worldToScreen(tx+.5,ty+.5);const cx=s.x*k,cy=(s.y-lift*this.zoom)*k,hw=hw0*wide;
      if(cx<-hw||cx>w+hw||cy<-hh||cy>h+hh)return;
      f.fillStyle=`rgba(0,0,0,${clamp(1-alpha/base,0,1)})`;
      f.beginPath();f.moveTo(cx,cy-hh);f.lineTo(cx+hw,cy);f.lineTo(cx,cy+hh);f.lineTo(cx-hw,cy);f.closePath();f.fill();
    };
    const cutAt=(tx,ty,lift)=>cut(tx,ty,0,lift);
    if(!indoor) {
      f.globalCompositeOperation='source-over';f.fillStyle=`rgba(${FOG_COLOR},1)`;
      const seal=(tx,ty,lift=0)=>{
        const s=this.worldToScreen(tx+.5,ty+.5),cx=s.x*k,cy=(s.y-lift*this.zoom)*k;
        if(cx<-hw||cx>w+hw||cy<-hh||cy>h+hh)return;
        f.beginPath();f.moveTo(cx,cy-hh);f.lineTo(cx+hw,cy);f.lineTo(cx,cy+hh);f.lineTo(cx-hw,cy);f.closePath();f.fill();
      };
      for(const t of tiles||[])if(t.room&&!vis.tiles.has(t.x+','+t.y))seal(t.x,t.y);
      // Tall walls belong to the interior too: their inner faces are hidden unless the wall tile is in view.
      for(const o of props||[]){
        if(o.type!=='wall'||o.cutaway||!(o.buildingId??o.room))continue;
        if(vis.tiles.has(o.x+','+o.y))continue;
        for(let j=0;j<=10;j++)seal(o.x,o.y,j*HEIGHT*.25);
      }
      f.globalCompositeOperation='destination-out';
    }
    // Remembered tiles first, then what is in view on top.
    const memory=vis.memory,reach=Math.ceil((this.width/64+this.height/32)/this.zoom*.5)+6,ox=Math.floor(this.camera.x),oy=Math.floor(this.camera.y);
    if(memory)for(let y=oy-reach;y<=oy+reach;y++){const row=memory.rows.get(y);if(!row)continue;for(let x=ox-reach;x<=ox+reach;x++)if(row.has(x))cut(x,y,FOG.remembered);}
    const tileAlpha=tile=>{
      if(tile.state==='silhouette')return FOG.silhouette;
      return Math.max(tile.fade*FOG.edge,clamp((.45-tile.light)/.45,0,1)*FOG.dark);
    };
    for(const [id,tile] of vis.tiles) {
      const c=id.indexOf(','),x=+id.slice(0,c),y=+id.slice(c+1),alpha=tileAlpha(tile);
      cut(x,y,alpha);
      // A tall wall rises over the tiles behind it on screen, so its face must be clear as well.
      if(tile.rise>.5&&alpha<.2)for(let j=1;j<=Math.ceil(tile.rise*4);j++)cutAt(x,y,j*HEIGHT*.25);
    }
    // Trees, cars, furniture and lamps also rise above their ground tile. Clear the space they occupy so a
    // prop standing in view is never sliced by the fog that lies over the tile behind it.
    for(const o of props||[]) {
      if(o.type==='wall'||o.type==='door'||o.type==='window')continue;
      const rotated=o.rotation===1||o.rotation===90||o.rotation===270,fw=rotated?(o.h||1):(o.w||1),fd=rotated?(o.w||1):(o.h||1);
      const reach=Math.min(220,this.props.get(o).oy-6),wide=o.type==='tree'?1.7:1;
      for(let dy=0;dy<fd;dy++)for(let dx=0;dx<fw;dx++) {
        const tile=vis.tiles.get((o.x+dx)+','+(o.y+dy));
        if(!tile||tile.state!=='visible')continue;
        const alpha=tileAlpha(tile);
        for(let lift=14;lift<reach;lift+=14)cut(o.x+dx,o.y+dy,alpha,lift,wide);
      }
    }
    this.ctx.save();this.ctx.imageSmoothingEnabled=true;
    this.ctx.drawImage(this.fogCanvas,0,0,this.width,this.height);this.ctx.restore();
  }
  _night(minutes) {
    const hour=((minutes%1440)+1440)%1440/60;
    if(hour>=8&&hour<=17)return 0;
    if(hour<5||hour>21)return 1;
    return hour<8?clamp((8-hour)/3,0,1):clamp((hour-17)/4,0,1);
  }
  _drawGround(ctx,tiles,radius) {
    if(!this.cacheGround) {
      for(const tile of tiles) {
        if(!this._visible(tile.x+.5,tile.y+.5,70))continue;
        this.tiles.draw(ctx,tile,...this._point(tile.x,tile.y));
        if(tile.type==='road')this._roadMarkings(ctx,tile);
      }
      this._floorDetails(ctx,tiles);return;
    }
    const margin=192;
    let ground=this.groundLayer;
    const offset=ground?{x:((ground.x-ground.y)-(this.camera.x-this.camera.y))*32*this.zoom,y:((ground.x+ground.y)-(this.camera.x+this.camera.y))*16*this.zoom}:{x:0,y:0};
    if(!ground||ground.zoom!==this.zoom||ground.world!==this.world||Math.abs(offset.x)>margin-64||Math.abs(offset.y)>margin-64) {
      const canvas=ground?.canvas||surface(1,1);
      canvas.width=this.width+margin*2;canvas.height=this.height+margin*2;
      const gc=canvas.getContext('2d',{alpha:false});
      gc.setTransform(1,0,0,1,0,0);gc.fillStyle='#2d382e';gc.fillRect(0,0,canvas.width,canvas.height);
      gc.setTransform(this.zoom,0,0,this.zoom,margin+this.origin.x-(this.camera.x-this.camera.y)*32*this.zoom,margin+this.origin.y-(this.camera.x+this.camera.y)*16*this.zoom);
      const expanded=this.world.getVisibleTiles(this.camera.x,this.camera.y,radius+Math.ceil(margin/(16*this.zoom)));
      const keep=[];
      for(const tile of expanded) {
        const q=this.worldToScreen(tile.x+.5,tile.y+.5);
        if(q.x< -margin-70||q.x>this.width+margin+70||q.y< -margin-40||q.y>this.height+margin+40)continue;
        keep.push(tile);this.tiles.draw(gc,tile,...this._point(tile.x,tile.y));
        if(tile.type==='road')this._roadMarkings(gc,tile);
      }
      this._floorDetails(gc,keep,margin+50);
      ground=this.groundLayer={canvas,x:this.camera.x,y:this.camera.y,zoom:this.zoom,world:this.world};
      offset.x=0;offset.y=0;
    }
    ctx.save();ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(ground.canvas,Math.round(offset.x)-margin,Math.round(offset.y)-margin);
    ctx.restore();
  }
  _roadMarkings(ctx,tile) {
    const mx=((tile.x%32)+32)%32,my=((tile.y%32)+32)%32;
    const p=new IsoPainter(ctx,...this._point(tile.x,tile.y));
    if(mx===21&&!(my>=19&&my<=24)&&((tile.y%4+4)%4)<2)p.ground(.8,.02,.055,.96,'#a39862',.003);
    if(my===21&&!(mx>=19&&mx<=24)&&((tile.x%4+4)%4)<2)p.ground(.02,.8,.96,.055,'#a39862',.003);
    if(mx===19)p.ground(.14,0,.025,1,'rgba(181,183,157,.24)',.005);
    if(my===19)p.ground(0,.14,1,.025,'rgba(181,183,157,.24)',.005);
  }
  _floorDetails(ctx,tiles,padding=50) {
    for(const tile of tiles) {
      const screen=this.worldToScreen(tile.x,tile.y);
      if(tile.type!=='floor'||screen.x< -padding||screen.x>this.width+padding||screen.y< -padding||screen.y>this.height+padding)continue;
      const q=this._point(tile.x,tile.y),p=new IsoPainter(ctx,...q),n=hash(tile.x,tile.y,648);
      if(tile.rug) {
        p.ground(0,0,1,1,tile.rug,.01);
        for(let i=0;i<6;i++)p.line([[0,i/6,.012],[1,i/6,.012]],'rgba(204,176,130,.10)',.65);
        p.face([[.5,.18,.013],[.82,.5,.013],[.5,.82,.013],[.18,.5,.013]],'rgba(193,161,111,.13)');
        for(const [dx,dy,points] of [[-1,0,[[.08,0,.014],[.08,1,.014]]],[1,0,[[.92,0,.014],[.92,1,.014]]],[0,-1,[[0,.08,.014],[1,.08,.014]]],[0,1,[[0,.92,.014],[1,.92,.014]]]]) {
          if(this.world.getTile(tile.x+dx,tile.y+dy).rug!==tile.rug)p.line(points,'rgba(209,184,135,.35)',1.4);
        }
      }
      if(n>.968) {
        p.ground(.25,.31,.28,.31,'#a4a18a',.006);
        for(let i=0;i<3;i++)p.line([[.29,.36+i*.05,.008],[.49,.36+i*.05,.008]],'#6d7262',.6);
      } else if(n<.018) {
        for(let i=0;i<4;i++){const a=p.point(.2+hash(i,tile.x,772)*.5,.2+hash(i,tile.y,185)*.5);ellipse(ctx,a[0],a[1],2+i*.6,1+i*.3,'rgba(23,29,21,.22)');}
      }
    }
  }
  _propShadows(ctx,props,night) {
    for(const o of props) {
      const p=new IsoPainter(ctx,...this._point(o.x,o.y));
      const w=o.w||1,d=o.h||1;
      if(o.type==='wall'||o.type==='window') {
        const alongY=o.rotation===1||o.rotation===90;
        if(!o.cutaway) {
          if(alongY)p.ground(.45,.03,.9,d,'rgba(15,25,20,.14)');
          else p.ground(.03,.46,w,.9,'rgba(15,25,20,.14)');
        }
      } else if(o.type==='tree') {
        const q=p.point(.7,.65);ellipse(ctx,q[0]+18,q[1]+8,37,16,'rgba(16,28,19,.23)');
      } else if(o.type!=='debris'&&o.type!=='door') {
        const q=p.point(w*.53,d*.6);ellipse(ctx,q[0]+6,q[1]+2,(w+d)*14,(w+d)*6,'rgba(14,22,17,.23)');
      }
    }
  }
  _windowShafts(ctx,props,night) {
    for(const o of props) {
      if(o.type!=='window'||o.cutaway)continue;
      const p=new IsoPainter(ctx,...this._point(o.x,o.y),o.rotation===1||o.rotation===90?1:0);
      const intensity=.055+night*.015;
      const start=.72,end=3.9;
      p.face([[.1,start,.013],[.88,start,.013],[1.35,end,.013],[.22,end,.013]],`rgba(219,169,85,${intensity})`);
      for(let i=0;i<3;i++)p.ground(.15+i*.25,.8,.10,2.5,`rgba(245,197,112,${intensity*.7})`,.015);
    }
  }
  _wallSign(ctx,prop) {
    const label=String(prop.label).replace(/\s+wall$/i,'').toUpperCase();
    if(label.length<3)return;
    const q=this._point(prop.x+.18,prop.y+.64,1.65);
    ctx.save();ctx.translate(...q);
    const rotated=prop.rotation===1||prop.rotation===90;
    ctx.transform(rotated?-1:1,.5,0,1,0,0);
    if(rotated)ctx.scale(-1,1);
    ctx.font='600 6px monospace';const width=Math.min(92,ctx.measureText(label).width+8);
    ctx.fillStyle='#3c493c';ctx.fillRect(-3,-7,width,11);ctx.strokeStyle='#9c9a78';ctx.lineWidth=.45;ctx.strokeRect(-3,-7,width,11);
    ctx.fillStyle='#d5c69b';ctx.fillText(label,1,1,width-6);ctx.restore();
  }
  _interaction(ctx,prop,elapsed) {
    const p=new IsoPainter(ctx,...this._point(prop.x,prop.y));
    const w=prop.w||1,d=prop.h||1,alpha=this.reduceMotion?.65:.45+Math.sin(elapsed*3)*.12;
    p.face([[.03,.03,.025],[w-.03,.03,.025],[w-.03,d-.03,.025],[.03,d-.03,.025]],`rgba(215,179,95,${alpha*.13})`);
    const length=.19,color=`rgba(220,192,123,${alpha})`;
    for(const [x,y,sx,sy] of [[0,0,1,1],[w,0,-1,1],[w,d,-1,-1],[0,d,1,-1]])p.line([[x+sx*length,y,.025],[x,y,.025],[x,y+sy*length,.025]],color,1.2);
  }
  _playerMarker(ctx,p,q,state) {
    ctx.strokeStyle=state.sneaking?'rgba(154,180,153,.5)':'rgba(219,199,141,.4)';ctx.lineWidth=.8;
    ctx.beginPath();ctx.ellipse(q[0],q[1],13,6,0,.1,Math.PI*.9);ctx.stroke();
    const dx=(p.dirX??1)-(p.dirY??0),dy=((p.dirX??1)+(p.dirY??0))*.5,len=Math.hypot(dx,dy)||1;
    const ux=dx/len,uy=dy/len;
    polygon(ctx,[[q[0]+ux*18,q[1]+uy*9],[q[0]+ux*13-uy*2,q[1]+uy*6+ux*2],[q[0]+ux*13+uy*2,q[1]+uy*6-ux*2]],'rgba(228,207,143,.7)');
  }
  _blood(ctx,state) {
    for(const z of state.zombies||[]) {
      if(z.health>0)continue;
      if(!this.groundBlood.has(z.id))this.groundBlood.set(z.id,{x:z.x,y:z.y,at:state.elapsed||0});
    }
    if(this.groundBlood.size>240)this.groundBlood.delete(this.groundBlood.keys().next().value);
    for(const [id,b] of this.groundBlood) {
      if(!this._visible(b.x,b.y))continue;
      const q=this._point(b.x,b.y);
      for(let i=0;i<7;i++) {const x=q[0]+(hash(id,i,32)-.5)*30,y=q[1]+(hash(id,i,81)-.5)*12;ellipse(ctx,x,y,3+hash(i,id,56)*5,1.5+hash(i,id,98)*2,'rgba(83,36,27,.65)');}
    }
  }
  _attack(ctx,state) {
    const a=state.lastAttack;if(!a||a.ttl<=0)return;
    const q=this._point(a.x,a.y,.9),ratio=clamp(a.ttl/(a.duration||.3),0,1);
    const dx=(a.dirX??1)-(a.dirY??0),dy=((a.dirX??1)+(a.dirY??0))*.5,angle=Math.atan2(dy,dx);
    ctx.save();ctx.translate(...q);ctx.rotate(angle);
    if(a.weapon==='pistol') {
      const range=Math.min(280,(a.range||8)*26);
      line(ctx,[[12,0],[range,0]],`rgba(233,210,140,${ratio*.5})`,1);
    } else {
      ctx.scale(1,.62);ctx.beginPath();ctx.arc(0,0,(a.range||1.5)*24,-.95,.95);
      ctx.strokeStyle=`rgba(219,220,190,${ratio*.32})`;ctx.lineWidth=2.4;ctx.stroke();
    }
    ctx.restore();
  }
  _particles(ctx,particles) {
    for(const part of particles) {
      if(!Number.isFinite(part.x)||!Number.isFinite(part.y)||part.life<=0)continue;
      const q=this._point(part.x,part.y,part.z||0),life=clamp(part.life/(part.maxLife||1),0,1);
      ctx.globalAlpha=life;ctx.fillStyle=part.color||(part.type==='blood'?'#853f30':'#d9c491');
      const size=clamp(part.size||2,.7,7);
      if(part.type==='muzzle') {ellipse(ctx,q[0],q[1],size*2,size,'#ffdea0');}
      else if(part.type==='dust')ellipse(ctx,q[0],q[1],size*2,size,'rgba(163,163,131,.4)');
      else ctx.fillRect(q[0]-size*.5,q[1]-size*.5,size,size);
    }
    ctx.globalAlpha=1;
  }
  _lighting(state,props,night,elapsed) {
    const vis=this.fogEnabled?this.visibility:null;
    const ctx=this.ctx,lctx=this.lightCtx,w=this.lightCanvas.width,h=this.lightCanvas.height;
    const cloud=state.weather?.type==='overcast'?.045:state.weather?.type==='rain'?.075:0;
    lctx.setTransform(1,0,0,1,0,0);lctx.clearRect(0,0,w,h);
    lctx.globalCompositeOperation='source-over';lctx.fillStyle=`rgba(12,24,30,${.055+cloud+night*.65})`;lctx.fillRect(0,0,w,h);
    const lamps=props.filter(o=>o.type==='lamp'&&o.lit!==false&&(!vis||vis.state(o.x,o.y)!=='hidden'&&vis.state(o.x,o.y)!=='remembered')).slice(0,28);
    const sources=lamps.map(o=>({x:o.x+.5,y:o.y+.5,z:.85,r:132}));
    // A survivor's close visibility keeps navigation readable through the darkest hours.
    sources.push({x:state.player.x,y:state.player.y,z:.4,r:110,player:true});
    lctx.globalCompositeOperation='destination-out';
    for(const source of sources) {
      const q=this.worldToScreen(source.x,source.y,source.z),r=source.r*this.zoom*.5;
      const gradient=lctx.createRadialGradient(q.x*.5,q.y*.5,0,q.x*.5,q.y*.5,r);
      gradient.addColorStop(0,`rgba(0,0,0,${source.player?.4:.92})`);gradient.addColorStop(.4,`rgba(0,0,0,${source.player?.2:.65})`);gradient.addColorStop(1,'rgba(0,0,0,0)');
      lctx.fillStyle=gradient;lctx.fillRect(q.x*.5-r,q.y*.5-r,r*2,r*2);
    }
    lctx.globalCompositeOperation='source-over';
    ctx.drawImage(this.lightCanvas,0,0,this.width,this.height);
    ctx.save();ctx.globalCompositeOperation='screen';
    for(const source of sources) {
      if(source.player)continue;
      const q=this.worldToScreen(source.x,source.y,source.z),r=source.r*this.zoom;
      const flicker=this.reduceMotion?1:1+.04*Math.sin(elapsed*7.8+source.x)+.025*Math.sin(elapsed*19);
      const g=ctx.createRadialGradient(q.x,q.y,1,q.x,q.y,r);
      g.addColorStop(0,`rgba(247,174,72,${(.19+night*.1)*flicker})`);g.addColorStop(.35,'rgba(224,139,49,.055)');g.addColorStop(1,'rgba(198,119,44,0)');
      ctx.fillStyle=g;ctx.fillRect(q.x-r,q.y-r,r*2,r*2);
      const core=ctx.createRadialGradient(q.x,q.y,0,q.x,q.y,12*this.zoom);
      core.addColorStop(0,'rgba(255,220,128,.3)');core.addColorStop(1,'rgba(255,201,101,0)');ctx.fillStyle=core;ctx.fillRect(q.x-15*this.zoom,q.y-15*this.zoom,30*this.zoom,30*this.zoom);
    }
    ctx.restore();
  }
  _weather(state,elapsed,night) {
    const ctx=this.ctx,weather=state.weather||{},type=weather.type||'overcast';
    if(type==='rain'||type==='storm') {
      const intensity=clamp(weather.intensity??.5,.1,1),count=Math.floor(60+intensity*135),t=this.reduceMotion?0:elapsed;
      ctx.strokeStyle=`rgba(168,188,182,${.13+intensity*.08})`;ctx.lineWidth=.65;
      ctx.beginPath();
      for(let i=0;i<count;i++) {
        const x=(hash(i,61,372)*this.width-t*65*(.7+hash(i,43,611))%(this.width+80)+this.width+80)%(this.width+80)-40;
        const y=(hash(i,51,922)*this.height+t*(340+hash(i,13,881)*180))%(this.height+80)-40;
        const ground=this.screenToWorld(x,y+14);
        if(this.world.getTile(ground.x,ground.y).type==='floor')continue;
        ctx.moveTo(x,y);ctx.lineTo(x-4,y+12+intensity*8);
      }
      ctx.stroke();
      // Ground splashes are sparse and do not cross the indoor floor.
      for(let i=0;i<18;i++) {
        const x=hash(i,16,18)*this.width,y=hash(i,31,77)*this.height;
        const world=this.screenToWorld(x,y);if(this.world.getTile(world.x,world.y).type==='floor')continue;
        const life=(elapsed*1.7+hash(i,0,39))%1;
        ctx.strokeStyle=`rgba(178,195,180,${(1-life)*.18})`;ctx.beginPath();ctx.ellipse(x,y,life*6+1,life*2+.5,0,0,Math.PI*2);ctx.stroke();
      }
    }
    if(type==='fog'||type==='mist') {
      const g=ctx.createLinearGradient(0,0,this.width,this.height);g.addColorStop(0,'rgba(156,177,165,.14)');g.addColorStop(.5,'rgba(153,173,162,.05)');g.addColorStop(1,'rgba(171,179,154,.17)');ctx.fillStyle=g;ctx.fillRect(0,0,this.width,this.height);
    }
    // Windborne dust catches the lanterns, with deterministic positions and no state writes.
    if(!this.reduceMotion)for(let i=0;i<18;i++) {
      const x=(hash(i,9,11)*this.width+elapsed*(2+i%3))%this.width,y=(hash(i,71,19)*this.height+Math.sin(elapsed*.23+i)*8);
      ctx.fillStyle=`rgba(218,216,174,${.06+hash(i,0,12)*.08})`;ctx.fillRect(x,y,1,1);
    }
  }
  _vignettePass(state) {
    const ctx=this.ctx;
    if(!this._vignette) {
      this._vignette=ctx.createRadialGradient(this.width*.5,this.height*.51,this.height*.14,this.width*.5,this.height*.51,Math.max(this.width,this.height)*.66);
      this._vignette.addColorStop(0,'rgba(4,12,10,0)');this._vignette.addColorStop(.55,'rgba(4,12,10,.025)');this._vignette.addColorStop(1,'rgba(4,12,10,.4)');
    }
    ctx.fillStyle=this._vignette;ctx.fillRect(0,0,this.width,this.height);
    if((state.player.hurtTimer||0)>0||state.player.health<25) {
      const hurt=clamp((state.player.hurtTimer||0)*.5+(state.player.health<25?.16:0),0,.4);
      const gradient=ctx.createRadialGradient(this.width*.5,this.height*.5,this.height*.26,this.width*.5,this.height*.5,this.width*.62);
      gradient.addColorStop(0,'rgba(107,23,12,0)');gradient.addColorStop(1,`rgba(122,32,18,${hurt})`);ctx.fillStyle=gradient;ctx.fillRect(0,0,this.width,this.height);
    }
  }
  destroy() {this._destroyed=true;this.groundLayer=null;this.actorMotion.clear();this.groundBlood.clear();this.tiles.cache.clear();this.props.cache.clear();this.characters.cache.clear();this.characters.infected.clear();}
}

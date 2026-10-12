import { IsoPainter, hash, surface, polygon, shade } from './primitives.js';

const GRASS = ['#454d35','#424a33','#485038','#3f4832','#48503a','#424b36'];
const ASPHALT = ['#3f4542','#424744','#3e4441','#414642'];
const TIMBER = ['#66513d','#6c5540','#614c39','#715740','#63503b','#6b513b'];
const STONE = ['#77796c','#73766b','#7d7d70','#74776b'];

/** Tile sprites are generated once per material/variation. No frame-time texture noise. */
export class TileAtlas {
  constructor() { this.cache = new Map(); }
  get(tile) {
    const variant = Math.floor(hash(tile.x, tile.y, 127) * 12);
    const style = tile.floorStyle || (typeof tile.room === 'string' && /clinic|market|garage|diner/i.test(tile.room) ? 'tile' : 'wood');
    const key = `${tile.type}:${style}:${tile.color||''}:${variant}`;
    if (!this.cache.has(key)) this.cache.set(key, this.bake(tile.type, style, variant, tile.color));
    return this.cache.get(key);
  }
  bake(type, style, seed, tint) {
    const cv = surface(68, 36), ctx = cv.getContext('2d');
    const p = new IsoPainter(ctx, 34, 2);
    let color = type === 'road' ? ASPHALT[seed % 4] : type === 'floor' ? TIMBER[seed % 6] : type === 'sidewalk' ? STONE[seed % 4] : type === 'dirt' ? '#625b43' : GRASS[seed % 6];
    if (type === 'floor' && /tile|check|linoleum|concrete/i.test(style)) color = tint||'#69716a';
    // A subpixel bleed removes dark diamond seams when the atlas is zoomed.
    p.ground(-.018,-.018,1.036,1.036,color);
    ctx.save(); polygon(ctx, [[34,2],[66,18],[34,34],[2,18]], null); ctx.clip();
    if (type === 'floor') {
      if (/concrete/i.test(style)) {
        p.ground(.01,.01,.98,.98,shade(tint||'#777d72',seed-10));
        if(seed%3===1)p.line([[.01,.16,0],[.27,.44,0],[.35,.46,0],[.64,.9,0]],'rgba(32,43,34,.34)',.7);
        p.line([[0,0,0],[0,1,0],[1,1,0]],'rgba(37,47,38,.15)',.6);
      } else if (/tile|check|linoleum/i.test(style)) {
        for(let y=0;y<2;y++) for(let x=0;x<2;x++) {
          const dark=/check/i.test(style)?-45:-15;
          p.ground(x*.5+.012,y*.5+.012,.48,.48,shade(tint||'#858d7a',(x+y)%2?dark:4));
          p.line([[x*.5,y*.5,0],[x*.5+.5,y*.5,0]],'rgba(222,221,179,.12)',.6);
        }
      } else {
        for (let y=0;y<5;y++) {
          const tone = TIMBER[Math.floor(hash(seed,y,72)*6)];
          p.ground(0,y*.2+.01,1,.183,tone);
          p.line([[0,y*.2+.195,0],[1,y*.2+.195,0]],'rgba(18,14,10,.45)',.7);
          const seam = ((y+seed)%3)*.31+.1;
          p.line([[seam,y*.2,0],[seam,y*.2+.2,0]],'rgba(18,14,10,.38)',.7);
          for(let n=0;n<4;n++) {
            const a=hash(seed+y,n,8), b=hash(n,y+seed,17);
            p.line([[a,y*.2+b*.18,.001],[Math.min(1,a+.25),y*.2+b*.18,.001]],'rgba(218,172,109,.1)',.45);
          }
        }
      }
    } else if(type === 'sidewalk') {
      p.line([[0,0,0],[1,0,0],[1,1,0]],'rgba(203,204,176,.16)',1);
      p.line([[0,0,0],[0,1,0],[1,1,0]],'rgba(26,34,28,.3)',1);
      if(seed%4===1) p.line([[.1,.3,0],[.4,.45,0],[.47,.72,0],[.9,.78,0]],'#555e51',.6);
    }
    // Fine mineral grain, individual grass blades, dust and occasional worn marks.
    for(let n=0;n<(type==='grass'?60:34);n++) {
      const a=hash(n,seed,801), b=hash(n,seed,107), q=p.point(a,b);
      ctx.fillStyle= n%3 ? 'rgba(10,17,13,.13)' : 'rgba(223,220,169,.12)';
      ctx.fillRect(q[0],q[1],type==='floor'?1.4:1,.65);
      if(type==='grass'&&n%4===0) {
        p.line([[a,b,.01],[a-.02,b-.01,.04+hash(n,seed,981)*.045]],n%8?'#647052':'#333e2a',.8);
      }
    }
    if(type==='road'&&seed%4===0) {
      p.line([[.1,.1,0],[.34,.42,0],[.2,.61,0],[.5,.84,0],[.55,1,0]],'rgba(14,22,20,.5)',.8);
      p.line([[.34,.42,0],[.66,.37,0]],'rgba(14,22,20,.5)',.6);
    }
    if(type==='grass'&&seed===3) {
      for(let n=0;n<5;n++) {const q=p.point(.25+hash(n,seed,5)*.3,.2+hash(n,seed,7)*.4);ctx.fillStyle='#93916a';ctx.fillRect(q[0],q[1],1.2,1.2);}
    }
    ctx.restore();
    return cv;
  }
  draw(ctx, tile, x, y) { ctx.drawImage(this.get(tile), x-34, y-2); }
}

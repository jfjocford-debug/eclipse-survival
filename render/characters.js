import { surface, hash, ellipse, polygon, line, clamp } from './primitives.js';

const FACES = [6,0,4,1,7,2,5,3]; // clockwise screen E, SE, S, SW, W, NW, N, NE
const SHIRTS = ['#616d5a','#776252','#50686b','#767263'];
const SKINS = ['#9b9e77','#959779','#a0a17e','#8e9678'];
export function facing(dx = 1, dy = 0) {
  const angle = Math.atan2((dx + dy) * .5, dx - dy);
  return ((Math.round(angle / (Math.PI / 4)) + 8) % 8);
}
export class CharacterArt {
  constructor() {
    this.images = [];
    this.cache = new Map();
    this.infected = new Map();
    if (typeof Image !== 'undefined') for(let i=0;i<8;i++) {
      const image=new Image();image.decoding='async';image.src=new URL(`../assets/survivor/face-${i}.png`,import.meta.url).href;
      this.images.push(image);
    }
  }
  draw(ctx, actor, x, y, {player = false, phase = 0, moving = false, elapsed = 0} = {}) {
    if(actor.health<=0) {this.corpse(ctx,actor,x,y,player);return;}
    const dir=facing(actor.dirX,actor.dirY), image=this.images[FACES[dir]], swing=Math.sin(phase);
    const bob=moving?Math.abs(swing)*1.2:Math.sin(elapsed*2.7+(actor.id||0))*.35;
    ctx.save();ctx.translate(x,y);
    if(player&&image?.complete&&image.naturalWidth>0) {
      ctx.translate(0,-bob);
      // The supplied, original eight-view sprite remains pixel crisp at game scale.
      ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
      const hurt=actor.hurtTimer>0;
      if(hurt&&Math.sin(elapsed*38)>.1)ctx.globalAlpha=.62;
      ctx.drawImage(image,-18.33,-63.8,36.66,66);
      if(actor.equipped) this.weapon(ctx,actor,dir,phase);
    } else if(!player&&image?.complete&&image.naturalWidth>0) {
      const variant=((actor.id||0)%4+4)%4;
      const key=`${FACES[dir]}:${variant}`;
      let sprite=this.infected.get(key);
      if(!sprite){sprite=this.bakeInfected(image,variant);this.infected.set(key,sprite);}
      // A slight forward shear and uneven step gives the same anatomy a shambling gait.
      const lean=-Math.cos(dir*Math.PI/4)*(.055+(moving?.035:0));
      ctx.transform(1,0,lean,.94,0,-bob*.65);
      ctx.rotate(moving?swing*.018:Math.sin(elapsed*1.2+(actor.id||0))*.008);
      ctx.drawImage(sprite,-18.33,-63.8,36.66,66);
    } else {
      const frame=moving?Math.floor((phase%(Math.PI*2)+Math.PI*2)/(Math.PI/2))%4:0;
      const key=`${player?1:0}:${dir}:${frame}:${(actor.id||0)%4}`;
      let sprite=this.cache.get(key);
      if(!sprite) {sprite=this.bakeHuman(dir,frame,(actor.id||0)%4,player);this.cache.set(key,sprite);}
      ctx.drawImage(sprite,-38,-75-bob);
      if(player)this.weapon(ctx,actor,dir,phase);
    }
    if(!player&&actor.hitTimer>0){ctx.strokeStyle='rgba(221,165,130,.55)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,-34,13,Math.PI*1.1,Math.PI*1.9);ctx.stroke();}
    ctx.restore();
  }
  bakeInfected(image,variant) {
    const cv=surface(80,144),ctx=cv.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(image,0,0,80,144);
    const pixels=ctx.getImageData(0,0,80,144),data=pixels.data;
    const shirts=[[.67,.7,.64],[.6,.68,.7],[.72,.63,.52],[.56,.61,.58]];
    for(let y=0;y<144;y++)for(let x=0;x<80;x++) {
      const i=(y*80+x)*4;if(!data[i+3])continue;
      const r=data[i],g=data[i+1],b=data[i+2],l=r*.29+g*.59+b*.12;
      const tone=y>36&&y<84?shirts[variant]:[.74,.79,.68];
      data[i]=l*tone[0]+r*.14;data[i+1]=l*tone[1]+g*.12;data[i+2]=l*tone[2]+b*.12;
    }
    ctx.putImageData(pixels,0,0);
    ctx.globalCompositeOperation='source-atop';
    // Deterministic stains retain the original silhouette and directional shading.
    for(let i=0;i<16;i++) {
      const x=24+hash(i,variant,516)*31,y=34+hash(i,variant,113)*73;
      ctx.globalAlpha=.18+hash(i,variant,813)*.28;
      polygon(ctx,[[x,y],[x+2,y-2],[x+5,y+1],[x+3,y+7],[x+1,y+4]],'#682f27');
    }
    ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
    return cv;
  }
  weapon(ctx,actor,dir) {
    const dx=(actor.dirX??1)-(actor.dirY??0),dy=((actor.dirX??1)+(actor.dirY??0))*.5;
    const norm=Math.hypot(dx,dy)||1, attack=clamp((actor.attackTimer||0)/(actor.attackDuration||.32),0,1);
    const angle=Math.atan2(dy,dx)+(attack?Math.sin(attack*Math.PI)*1.3-.5:0);
    const handX=dir>3?-9:9,handY=-29;
    ctx.save();ctx.translate(handX,handY);ctx.rotate(angle);
    if(actor.equipped==='pistol') {
      polygon(ctx,[[0,-1],[3,-4],[12,-4],[12,0],[4,0],[3,4],[0,4]],'#4c5550','#222a27',.6);
      line(ctx,[[4,-4],[11,-4]],'#a4aaa0',.6);
    } else {
      const length=actor.equipped==='axe'?24:23;
      line(ctx,[[0,0],[length,-3]],'#282c23',4.3);
      line(ctx,[[0,-.6],[length,-3.5]],'#ad8c59',2.5);
      if(actor.equipped==='axe')polygon(ctx,[[length-5,-4],[length-3,-11],[length+3,-11],[length+5,-4],[length,-1]],'#a9aaa0','#424a43',.6);
      else line(ctx,[[11,-2.2],[length,-3.4]],'#c0a773',4);
      line(ctx,[[-1,0],[3,-.5]],'#c2a47e',3.8);
    }
    ctx.restore();
  }
  bakeHuman(dir,frame,seed,player) {
    const cv=surface(76,82),ctx=cv.getContext('2d');ctx.translate(38,75);
    const a=dir*Math.PI/4, side=Math.cos(a), forward=Math.sin(a),step=Math.sin(frame*Math.PI/2)*3;
    const shirt=player?'#8b8974':SHIRTS[seed],skin=player?'#bd9f7c':SKINS[seed];
    const limb=(pts,col,w)=>{line(ctx,pts,'#252d26',w+1.4);line(ctx,pts,col,w);};
    ctx.lineCap='round';ctx.lineJoin='round';
    // Weight shifts, staggered knees and reaching arms make infected readable at distance.
    limb([[-4,-24],[-5-step*.4,-12],[-5+step,-2]],'#424e4b',5);
    limb([[4,-24],[5+step*.35,-13],[5-step,-1]],'#4b5550',5);
    line(ctx,[[-7+step,0],[-2+step,0]],'#272e27',4);
    line(ctx,[[3-step,1],[8-step,1]],'#272e27',4);
    const reach=player?0:5;
    limb([[-6,-43],[-10+side*reach,-34],[-9+side*reach*2,-26-forward*3]],shirt,4.5);
    limb([[6,-42],[10+side*reach,-34],[9+side*reach*2,-28-forward*3]],shirt,4.5);
    limb([[-9+side*reach*2,-27-forward*3],[-10+side*reach*2,-23-forward*3]],skin,3.1);
    limb([[9+side*reach*2,-29-forward*3],[10+side*reach*2,-25-forward*3]],skin,3.1);
    polygon(ctx,[[-6,-47],[5,-47],[9,-39],[7,-26],[2,-24],[-7,-26],[-8,-39]],shirt,'#333e30',.8);
    line(ctx,[[-6,-42],[-4,-28]],'rgba(219,221,177,.18)',1.3);
    line(ctx,[[4,-41],[5,-28]],'rgba(10,24,19,.28)',2);
    line(ctx,[[-6,-26],[6,-26]],'#3a3d30',2);
    ctx.fillStyle='#a49d74';ctx.fillRect(-1,-27,2,2);
    if(!player) {
      polygon(ctx,[[-5,-42],[0,-40],[-2,-35],[2,-31],[-1,-27],[-5,-30]],'#754b3d');
      line(ctx,[[5,-38],[2,-34]],'#303e30',1.3);
      line(ctx,[[-5,-14],[-2,-12]],'#8d9276',1.5);
    }
    limb([[0,-48],[0,-45]],skin,4);
    polygon(ctx,[[-4+side,-57],[-3+side,-61],[3+side,-62],[6+side,-57],[5+side,-51],[1+side,-47],[-3+side,-50]],skin,'#424a36',.7);
    polygon(ctx,[[-5+side,-55],[-4+side,-61],[0+side,-64],[5+side,-62],[6+side,-57],[2+side,-59],[-1+side,-56]],seed%2?'#4a4d38':'#5e5940');
    if(forward>-.5) {
      const eyeX=side*2;
      line(ctx,[[eyeX-2,-54],[eyeX,-54]],'#303c2d',1.2);
      line(ctx,[[eyeX+2,-54],[eyeX+3,-54]],'#303c2d',1);
      line(ctx,[[eyeX-1,-50],[eyeX+2,-50]],player?'#7d6a51':'#725848',1.1);
      ctx.fillStyle='#bab892';ctx.fillRect(eyeX,-54,1,1);
    }
    return cv;
  }
  corpse(ctx,actor,x,y,player) {
    const seed=(actor.id||0)%4;
    ctx.save();ctx.translate(x,y);ctx.rotate(hash(actor.id||0,2,56)*.8-.4);
    ellipse(ctx,0,1,22,7,'rgba(31,31,20,.38)');
    ellipse(ctx,4,1,18,7,player?'#613b31':'#563930');
    line(ctx,[[-1,0],[-15,2],[-26,0]],'#424d45',5);
    line(ctx,[[-1,2],[-14,6],[-25,6]],'#38463c',5);
    polygon(ctx,[[-8,-4],[8,-4],[13,2],[8,7],[-7,6]],player?'#8b8974':SHIRTS[seed],'#273329',1);
    line(ctx,[[4,-3],[-3,-8],[-8,-7]],SKINS[seed],3);
    ellipse(ctx,15,2,5.3,4.2,player?'#b49873':SKINS[seed]);
    ellipse(ctx,17,1,3,3,'#494d36');ctx.restore();
  }
}

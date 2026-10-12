import { IsoPainter, hash, surface, ellipse, polygon, line, shade, cropToAlpha } from './primitives.js';

const WALLS = ['#8c8871','#898273','#8e8670','#797c69'];
const WOOD = '#765c3c';

export class PropAtlas {
  constructor() { this.cache = new Map(); }
  get(prop) {
    const variant = Math.floor(hash(prop.x, prop.y, 56) * 4);
    const key = [prop.type,prop.w||1,prop.h||1,prop.rotation||0,prop.color||'',prop.variant||'',prop.lit===false?0:1,prop.open?1:0,prop.cutaway?1:0,prop.barricaded||0,prop.looted?1:0,variant].join(':');
    let entry = this.cache.get(key);
    if (!entry) {
      entry = this.bake(prop, variant);
      // Bounded cache also accommodates a long, streaming exploration session.
      if (this.cache.size >= 420) this.cache.delete(this.cache.keys().next().value);
      this.cache.set(key, entry);
    }
    return entry;
  }
  draw(ctx, prop, x, y) {
    const item=this.get(prop); ctx.drawImage(item.canvas,x-item.ox,y-item.oy);
  }
  bake(prop, seed) {
    const width=prop.w||1, depth=prop.h||1;
    const cv=surface(Math.ceil((width+depth)*32+128),Math.ceil((width+depth)*16+190));
    const ctx=cv.getContext('2d'), ox=depth*32+64, oy=154;
    const rotated=prop.rotation===1||prop.rotation===90||prop.rotation===270;
    const p=new IsoPainter(ctx,ox,oy,rotated?1:0);
    const w=rotated?depth:width, d=rotated?width:depth;
    const color=prop.color||WOOD;
    const box=(...args)=>p.box(...args);
    const plank=(x,y,z,ww,dd,hh,col=color)=>box(x,y,z,ww,dd,hh,col,{grain:7});
    const leg=(x,y,h=.65,col='#51432e')=>box(x,y,0,.075,.075,h,col);
    const paper=(x,y,z,ww=.28,dd=.2)=>{
      p.ground(x,y,ww,dd,'#c1b897',z);
      for(let i=0;i<3;i++) p.line([[x+.04,y+.04+i*.04,z+.003],[x+ww-.04,y+.04+i*.04,z+.003]],'#7d806e',.45);
    };
    const bottle=(x,y,z,col='#5d7464')=>{
      box(x,y,z,.11,.1,.23,col);box(x+.025,y+.025,z+.23,.06,.05,.09,col);box(x+.025,y+.025,z+.3,.06,.05,.025,'#bbb69a');
      box(x-.002,y+.002,z+.06,.114,.105,.07,'#b6ae8d');
    };
    switch(prop.type) {
      case 'wall': {
        const h=prop.cutaway?.24:2.5, col=prop.color||WALLS[seed];
        box(0,.38,0,w,.24,h,col);
        plank(0,.37,0,w,.28,.14,'#464d43');
        plank(0,.37,h-.09,w,.28,.1,'#414b42');
        if(!prop.cutaway) {
          // Two-tone plaster with a chair rail and visible, irregular weathering.
          box(0,.619,.17,w,.018,.6,'#666d5b');
          plank(0,.62,.77,w,.025,.045,'#a29d7e');
          for(let i=0;i<19;i++) {
            const x=hash(seed,i,33)*w,z=.86+hash(seed,i,66)*1.42;
            p.line([[x,.645,z],[x+.035,.645,z+.02+hash(i,seed,789)*.08]],'rgba(33,37,27,.13)',.65);
          }
          if(seed===2) p.line([[.17,.65,2.4],[.22,.65,2.19],[.18,.65,1.95],[.28,.65,1.85]],'rgba(36,39,29,.3)',.8);
        }
        break;
      }
      case 'door': {
        const h=prop.cutaway?1.4:2.25;
        box(.02,.4,0,.09,.22,h,'#454b3e');box(.89,.4,0,.09,.22,h,'#454b3e');
        if(!prop.cutaway) box(.01,.4,h-.1,.98,.22,.13,'#aaa087');
        p.ground(.1,.35,.8,.36,'#82795e');
        if(prop.open) {
          plank(.08,.5,0,.10,.82,h-.1,'#5f7064');
          box(.08,1.2,.8,.14,.035,.05,'#b8ab73');
        } else {
          plank(.12,.43,.02,.76,.11,h-.08,prop.color||'#637466');
          // Recessed upper/lower wood panels and brass door handle.
          box(.22,.54,.18,.55,.014,.48,'#536457');
          if(h>1.5) box(.22,.54,.95,.55,.014,.85,'#536457');
          box(.74,.56,.88,.08,.04,.045,'#c4af70');
        }
        for(let i=0;i<(prop.barricaded||0);i++) {
          const z=.3+i*.36;
          plank(-.02,.63,z,1.05,.07,.13,'#8b704d');
          for(const x of [.1,.86]) box(x,.706,z+.065,.028,.005,.025,'#b8b9a1');
        }
        break;
      }
      case 'window': {
        const h=prop.cutaway?.32:2.5,col=prop.color||WALLS[seed];
        if(prop.cutaway) {box(0,.38,0,1,.25,h,col);plank(-.02,.35,h,1.04,.31,.07,'#50574a');break;}
        box(0,.38,0,1,.24,.88,col);box(0,.38,2.16,1,.24,.34,col);
        box(0,.38,.88,.12,.24,1.3,col);box(.88,.38,.88,.12,.24,1.3,col);
        p.face([[.13,.53,.93],[.87,.53,.93],[.87,.53,2.15],[.13,.53,2.15]],'#5e7470');
        p.face([[.15,.535,.96],[.48,.535,.96],[.48,.535,2.1],[.15,.535,2.1]],'#809089');
        p.face([[.17,.54,1.03],[.25,.54,1.03],[.65,.54,2.1],[.57,.54,2.1]],'rgba(232,222,176,.17)');
        for(const x of [.1,.49,.86]) plank(x,.57,.85,.045,.12,1.34,'#444c40');
        for(const z of [.88,1.52,2.12]) plank(.1,.57,z,.81,.12,.045,'#444c40');
        plank(.02,.36,.83,.97,.42,.08,'#97927c');
        for(let i=0;i<(prop.barricaded||0);i++) {
          const z=.99+i*.31;
          plank(.035,.72,z,.94,.065,.17,'#8e704b');
          for(const x of [.12,.83]) box(x,.79,z+.07,.03,.005,.027,'#b5b8a3');
        }
        break;
      }
      case 'crate': {
        const ww=Math.max(.65,w-.18),dd=Math.max(.6,d-.2),h=.57;
        plank(.09,.1,0,ww,dd,h,prop.color||'#887246');
        for(let i=1;i<4;i++) {
          p.line([[.1,.1+dd,.12*i],[.1+ww,.1+dd,.12*i]],'rgba(31,29,20,.6)',1);
          p.line([[.1+ww,.1,.12*i],[.1+ww,.1+dd,.12*i]],'rgba(31,29,20,.6)',1);
        }
        for(const x of [.15,ww-.04]) plank(x,.08,.01,.07,dd+.04,.6,'#a18a5b');
        if(prop.looted) {p.ground(.22,.22,ww-.26,dd-.23,'#3a3526',.605);plank(.12,.05,.63,ww,.16,.06,'#7d6946');}
        else {
          paper(.29,.18,.578,.31,.25);
          const a=p.point(.42,.1+dd+.01,.29);ctx.save();ctx.translate(...a);ctx.transform(1,.5,0,1,0,0);ctx.font='bold 5px monospace';ctx.fillStyle='#302d23';ctx.fillText('SUPPLY',-10,0);ctx.restore();
        }
        break;
      }
      case 'shelf': {
        const ww=Math.max(.85,w-.12),dd=Math.min(.58,d-.1),hh=1.8;
        if(prop.variant==='fridge') {
          box(.1,.06,.03,.8,.78,1.77,prop.color||'#b8b9a3');
          box(.12,.85,.09,.75,.028,1.14,'#a7af9a');box(.12,.85,1.27,.75,.028,.47,'#b2b8a1');
          box(.72,.889,.77,.035,.055,.31,'#515e52');box(.72,.889,1.36,.035,.055,.23,'#515e52');
          box(.22,.884,1.01,.2,.008,.12,'#c7baa0');
          p.line([[.25,.895,1.07],[.38,.895,1.07]],'#8c7557',.7);
          for(let i=0;i<4;i++)p.line([[.22,.885,.16+i*.035],[.65,.885,.16+i*.035]],'#737f6c',.6);
          if(prop.looted)p.line([[.12,.886,1.26],[.87,.886,1.26]],'#283c31',1.8);
          break;
        }
        box(.06,.08,0,ww,dd,hh,'#3d4a41');
        // Open front, thin uprights, shelves and stocked silhouettes.
        p.face([[.1,.08+dd,.1],[.02+ww,.08+dd,.1],[.02+ww,.08+dd,1.74],[.1,.08+dd,1.74]],'#28352f');
        for(const z of [.04,.59,1.14,1.69]) {
          plank(.05,.06,z,ww+.03,dd+.12,.055,'#71806a');
          if(z<1.5&&!prop.looted) for(let j=0;j<Math.ceil(ww*3);j++) {
            const x=.16+j*.27;
            if(j%3===0) bottle(x,.18,z+.06,['#607965','#8f6347','#65757e'][(j+seed)%3]);
            else if(j%3===1) {box(x,.16,z+.06,.2,.27,.25,'#9a825c');p.line([[x+.06,.445,z+.1],[x+.15,.445,z+.1]],'#4c4938',1.5);}
            else for(let k=0;k<3;k++)box(x+k*.06,.2,z+.06,.045,.2,.28+k*.03,['#776148','#526c65','#8d7959'][k]);
          }
        }
        for(const x of [.05,ww+.02])box(x,.08+dd,0,.045,.05,hh,'#84917a');
        break;
      }
      case 'table': {
        const ww=w-.16,dd=d-.16;
        for(const x of [.1,ww-.01])for(const y of [.1,dd-.01])leg(x,y,.75);
        plank(.06,.06,.73,ww+.08,dd+.08,.095,prop.color||'#7a5b3d');
        paper(.19,.18,.83,.4,.29);
        p.line([[.23,.2,.834],[.34,.25,.834],[.4,.21,.834],[.54,.36,.834]],'#667b69',.9);
        bottle(Math.max(.64,ww-.2),Math.max(.42,dd-.22),.83,'#636c57');
        box(.27,dd-.21,.83,.19,.14,.04,'#827154');
        break;
      }
      case 'chair': {
        for(const x of [.25,.64])for(const y of [.25,.64])leg(x,y,.46);
        plank(.22,.22,.45,.52,.53,.075,'#735d40');
        for(const x of [.23,.67])box(x,.23,.48,.055,.06,.64,'#665238');
        plank(.22,.23,.88,.51,.06,.22,'#816b49');
        break;
      }
      case 'bed': {
        const ww=Math.max(.85,w-.1),dd=Math.max(.85,d-.1),col=prop.color||'#677563';
        for(const x of [.08,ww-.04])for(const y of [.08,dd-.04])leg(x,y,.35,'#49534a');
        box(.05,.05,.21,ww,dd,.2,'#574d3d');box(.08,.08,.4,ww-.06,dd-.06,.2,'#c2bea0');
        box(.09,.37,.6,ww-.08,Math.max(.3,dd-.38),.055,col);
        for(let i=0;i<5;i++)p.line([[.12,.4+i*(dd-.45)/5,.66],[ww,.4+i*(dd-.45)/5,.66]],'rgba(24,36,29,.19)',1);
        box(.17,.12,.62,ww-.24,.28,.105,'#d2c9a9');
        box(.05,.04,.26,ww,.08,.55,'#4c5a4e');
        break;
      }
      case 'sofa': {
        const ww=Math.max(.9,w-.1),dd=d-.1,col=prop.color||'#66664e';
        for(const x of [.14,ww-.14])for(const y of [.14,dd-.1])leg(x,y,.2);
        box(.05,.06,.17,ww,dd,.36,col);box(.05,.06,.5,ww,.2,.54,col);
        for(const x of [.05,ww-.08])box(x,.23,.51,.14,dd-.16,.29,col);
        const cushions=Math.max(1,Math.round(ww));
        for(let i=0;i<cushions;i++)box(.21+i*(ww-.28)/cushions,.29,.54,(ww-.32)/cushions-.035,dd-.29,.105,shade(col,10));
        p.line([[.23,.273,.77],[ww-.12,.273,.77]],'rgba(209,199,150,.2)',.7);
        break;
      }
      case 'counter': {
        const ww=w-.04,dd=d-.04;
        box(.02,.02,.06,ww,dd,.88,prop.color||'#6c7562');
        for(let i=0;i<Math.max(1,Math.round(ww));i++) {
          const cw=ww/Math.max(1,Math.round(ww));
          box(.05+i*cw,dd+.021,.14,cw-.07,.018,.57,'#626c5a');
          box(.12+i*cw,dd+.047,.62,.19,.026,.025,'#c0b69a');
        }
        box(0,0,.94,ww+.04,dd+.04,.075,'#aaa590');
        if(prop.variant==='sink') {p.ground(.15,.16,.48,.38,'#3c514c',1.018);p.ground(.19,.19,.4,.3,'#8b9b90',1.022);box(.36,.07,1.02,.045,.045,.25,'#c5c4af');box(.36,.07,1.23,.045,.24,.035,'#a9b4a5');}
        else {paper(.2,.2,1.02);bottle(.66,.24,1.02);}
        break;
      }
      case 'car': {
        // The long footprint is always the chassis axis, regardless of world rotation.
        const c=new IsoPainter(ctx,ox,oy,width>depth?1:0);
        const ww=Math.max(.9,Math.min(width,depth)-.1),dd=Math.max(1.8,Math.max(width,depth)-.1),col=prop.color||['#785b47','#526d65','#a69a75','#655d54'][seed];
        for(const x of [.03,ww-.17])for(const y of [.25,dd-.55])c.box(x,y,.06,.2,.4,.38,'#222a27');
        c.box(.13,.04,.29,ww-.2,dd,.4,col);c.box(.13,.12,.69,ww-.2,dd-.16,.105,col);
        c.box(.23,dd*.34,.78,ww-.4,dd*.43,.46,col);
        // Both visible glazing planes; inset pillars retain the battered body color.
        c.face([[ww-.166,dd*.37,.83],[ww-.166,dd*.72,.83],[ww-.166,dd*.72,1.17],[ww-.166,dd*.37,1.17]],'#334a48');
        c.face([[.28,dd*.775,.85],[ww-.22,dd*.775,.85],[ww-.25,dd*.775,1.17],[.31,dd*.775,1.17]],'#3e5350');
        c.line([[ww-.163,dd*.56,.83],[ww-.163,dd*.56,1.2]],col,2);
        c.line([[.35,dd*.778,.91],[ww-.37,dd*.778,1.1]],'rgba(170,193,168,.19)',1);
        c.box(.16,.02,.36,ww-.25,.055,.1,'#647269');c.box(.16,dd+.01,.35,ww-.25,.05,.1,'#647269');
        for(const x of [.21,ww-.38]) {c.box(x,.015,.52,.15,.04,.08,'#d4c792');c.box(x,dd+.025,.52,.13,.025,.075,'#8c4e37');}
        c.line([[ww-.12,.27,.66],[ww-.12,dd-.13,.66]],'rgba(230,217,173,.24)',.8);
        c.line([[.33,.16,.806],[ww-.23,dd*.24,.806]],'rgba(80,46,28,.45)',1.5);
        c.box(ww-.145,dd*.6,.69,.035,.13,.028,'#b5b49a');
        break;
      }
      case 'lamp': {
        const floorLamp=/street|pole/i.test(prop.label||''),h=floorLamp?2.6:.74;
        box(.41,.4,0,.2,.2,.075,'#323e34');box(.485,.475,.07,.045,.045,h,'#4b5140');
        box(.36,.35,h,.29,.28,.04,'#373d30');box(.41,.4,h+.04,.18,.18,.29,prop.lit===false?'#697366':'#d8b977');
        box(.35,.34,h+.33,.31,.31,.06,'#414a37');
        for(const x of [.39,.57])box(x,.58,h+.05,.025,.02,.29,'#5b6144');
        if(prop.lit!==false){const pt=p.point(.51,.51,h+.2);ellipse(ctx,pt[0],pt[1],2,4,'#fff1b3');}
        break;
      }
      case 'fence': {
        const h=.97;
        for(let i=0;i<5;i++) {
          const x=i*.21;
          plank(x,.43,0,.125,.10,h+(i%2?.02:0),prop.color||'#77785c');
          p.face([[x,.43,h],[x+.125,.43,h],[x+.065,.43,h+.11]],'#8f8d6c');
        }
        for(const z of [.25,.7])plank(0,.53,z,1,.055,.075,'#5f694e');
        break;
      }
      case 'tree': {
        const center=p.point(.5,.5), trunkHeight=1.75+seed*.18;
        box(.42,.43,0,.16,.16,trunkHeight,'#4e503a');
        p.line([[.5,.5,.45],[.26,.32,1.5]],'#424a34',3);
        p.line([[.5,.5,.85],[.77,.67,2]],'#5b5e3e',3);
        const cx=center[0],cy=center[1]-trunkHeight*32-12;
        if(prop.variant==='pine') {
          for(let layer=0;layer<5;layer++) {
            const z=layer*14,r=34-layer*5;
            const pts=[[cx,cy-z-18],[cx-r*.34,cy-z-4],[cx-r*.26,cy-z-3],[cx-r*.75,cy-z+11],[cx-r*.54,cy-z+9],[cx-r,cy-z+23],[cx-r*.44,cy-z+20],[cx-r*.1,cy-z+26],[cx+r*.6,cy-z+22],[cx+r,cy-z+18],[cx+r*.67,cy-z+6],[cx+r*.38,cy-z-3]];
            polygon(ctx,pts,['#2b4034','#304a3b','#36503c','#3d5940','#496147'][layer]);
            for(let n=0;n<14;n++) {
              const xx=cx+(hash(n,seed,12+layer)-.5)*r*1.5,yy=cy-z+hash(n,seed,51+layer)*18;
              line(ctx,[[xx-3,yy+1],[xx+2,yy]],'rgba(131,149,98,.16)',.8);
            }
          }
          break;
        }
        // Ragged, layered canopy with individual clusters catches the north light.
        for(let layer=0;layer<3;layer++) {
          const points=[],radius=39-layer*5;
          for(let i=0;i<22;i++) {
            const a=i/22*Math.PI*2,r=radius*(.72+hash(i,seed,11+layer)*.3);
            points.push([cx+Math.cos(a)*r+(layer-1)*4,cy+Math.sin(a)*r*.63-layer*9]);
          }
          polygon(ctx,points,['#293d2d','#344b33','#42563a'][layer]);
        }
        for(let n=0;n<135;n++) {
          const angle=hash(n,seed,882)*Math.PI*2, r=Math.sqrt(hash(n,seed,982))*34;
          const xx=cx+Math.cos(angle)*r,yy=cy-10+Math.sin(angle)*r*.69;
          ctx.fillStyle=['#506143','#60704c','#3e5538','#263c2c'][n%4];
          ctx.fillRect(xx,yy,1+hash(n,seed,22)*3,1.2+hash(n,seed,9)*2);
        }
        for(let i=0;i<3;i++)p.line([[.45,.5,.2],[.25+i*.25,.6,.01]],'#596044',1.5);
        break;
      }
      case 'debris': {
        for(let i=0;i<5;i++) {
          const x=.1+hash(i,seed,19)*.63,y=.1+hash(i,seed,131)*.65;
          if(i%2)paper(x,y,.025,.15,.17);else box(x,y,0,.10,.12,.07,['#72735d','#785f3e','#4b5e4e'][i%3]);
        }
        break;
      }
      default: box(.15,.15,0,w-.3,d-.3,.4,'#757359');
    }
    return cropToAlpha(cv,ox,oy,1);
  }
}

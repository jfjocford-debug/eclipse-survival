/** Original, dependency-free isometric drawing primitives. Distances are metres. */
export const TILE_W = 64;
export const TILE_H = 32;
export const HEIGHT = 32;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function hash(x, y = 0, seed = 0) {
  let n = Math.imul((x * 8191) | 0, 374761393) ^ Math.imul((y * 8191) | 0, 668265263) ^ (seed | 0);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
export function shade(hex, amount) {
  const h = hex.replace('#', '');
  const value = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  if (!Number.isFinite(value)) return hex;
  return `rgb(${clamp((value >> 16) + amount, 0, 255)},${clamp(((value >> 8) & 255) + amount, 0, 255)},${clamp((value & 255) + amount, 0, 255)})`;
}
export function surface(width, height) {
  const canvas = typeof document === 'undefined' ? new OffscreenCanvas(width, height) : document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  return canvas;
}
/** Trim empty atlas pixels once, retaining the exact projected anchor and an AA guard. */
export function cropToAlpha(canvas, ox, oy, padding = 1) {
  const original = { canvas, ox, oy };
  const width=canvas.width,height=canvas.height;
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1)return original;
  try {
    const ctx=canvas.getContext('2d');
    if(typeof ctx?.getImageData!=='function')return original;
    const pixels=ctx.getImageData(0,0,width,height)?.data;
    if(!pixels||pixels.length<width*height*4)return original;
    let left=width,top=height,right=-1,bottom=-1;
    for(let y=0;y<height;y++) {
      const row=y*width*4;
      for(let x=0;x<width;x++) {
        if(!pixels[row+x*4+3])continue;
        if(x<left)left=x;if(x>right)right=x;
        if(y<top)top=y;bottom=y;
      }
    }
    if(right<left)return original;
    const guard=Math.max(1,Math.ceil(padding));
    left=Math.max(0,left-guard);top=Math.max(0,top-guard);
    right=Math.min(width,right+guard+1);bottom=Math.min(height,bottom+guard+1);
    if(left===0&&top===0&&right===width&&bottom===height)return original;
    const trimmed=surface(right-left,bottom-top),target=trimmed.getContext('2d');
    if(typeof target?.drawImage!=='function')return original;
    target.drawImage(canvas,left,top,trimmed.width,trimmed.height,0,0,trimmed.width,trimmed.height);
    return {canvas:trimmed,ox:ox-left,oy:oy-top};
  } catch {
    // Drawing remains available in restricted canvas environments and API mocks.
    return original;
  }
}
export function polygon(ctx, pts, fill, stroke = null, width = 1) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}
export function line(ctx, pts, color, width = 1) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}
export function ellipse(ctx, x, y, rx, ry, color) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
}
/** A small geometry painter; local x/y span one tile, z is height. */
export class IsoPainter {
  constructor(ctx, ox = 0, oy = 0, rotation = 0) { this.ctx = ctx; this.ox = ox; this.oy = oy; this.rotation = rotation; }
  point(x, y, z = 0) {
    if (this.rotation) [x, y] = [y, x];
    return [this.ox + (x - y) * 32, this.oy + (x + y) * 16 - z * HEIGHT];
  }
  face(points, color, stroke = null) { polygon(this.ctx, points.map(p => this.point(...p)), color, stroke, .6); }
  line(points, color, width = 1) { line(this.ctx, points.map(p => this.point(...p)), color, width); }
  box(x, y, z, w, d, h, color, options = {}) {
    const x1 = x + w, y1 = y + d, z1 = z + h;
    const outline = options.outline === false ? null : 'rgba(13,16,13,.24)';
    this.face([[x,y1,z],[x1,y1,z],[x1,y1,z1],[x,y1,z1]], shade(color, this.rotation ? -28 : -14), outline);
    this.face([[x1,y,z],[x1,y1,z],[x1,y1,z1],[x1,y,z1]], shade(color, this.rotation ? -14 : -28), outline);
    this.face([[x,y,z1],[x1,y,z1],[x1,y1,z1],[x,y1,z1]], shade(color, 11), outline);
    if (options.grain) {
      for (let i = 0; i < options.grain; i++) {
        const a = hash(i, w, 91), b = hash(i, d, 23);
        this.line([[x+a*w,y+b*d,z1+.003],[x+Math.min(1,a+.15)*w,y+b*d,z1+.003]], 'rgba(236,204,144,.1)', .55);
      }
    }
  }
  ground(x, y, w, d, color, z = .005) {
    this.face([[x,y,z],[x+w,y,z],[x+w,y+d,z],[x,y+d,z]], color);
  }
}

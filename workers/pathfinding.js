/** Collision-grid A*: run by the AI worker, never by the animation thread. */
export function blocked(grid, x, y) {
  const tx = Math.floor(x) - grid.x;
  const ty = Math.floor(y) - grid.y;
  return tx < 0 || ty < 0 || tx >= grid.width || ty >= grid.height ||
    grid.cells[ty * grid.width + tx] !== 0;
}

/** Supercover ray: touching a blocked diagonal corner does not grant visibility. */
export function lineOfSight(grid, ax, ay, bx, by) {
  if (!grid || blocked(grid, ax, ay) || blocked(grid, bx, by)) return false;
  const dx = bx - ax, dy = by - ay;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) * 6));
  let lastX = Math.floor(ax), lastY = Math.floor(ay);
  for (let i = 1; i <= steps; i++) {
    const x = Math.floor(ax + dx * i / steps), y = Math.floor(ay + dy * i / steps);
    if (blocked(grid, x, y)) return false;
    if (x !== lastX && y !== lastY &&
      (blocked(grid, x, lastY) || blocked(grid, lastX, y))) return false;
    lastX = x; lastY = y;
  }
  return true;
}

export function clearPassage(grid, ax, ay, bx, by, radius = 0.2) {
  const len = Math.hypot(bx - ax, by - ay) || 1;
  const ox = -(by - ay) / len * radius, oy = (bx - ax) / len * radius;
  return lineOfSight(grid, ax, ay, bx, by) &&
    lineOfSight(grid, ax + ox, ay + oy, bx + ox, by + oy) &&
    lineOfSight(grid, ax - ox, ay - oy, bx - ox, by - oy);
}

class MinHeap {
  constructor() { this.nodes = []; }
  push(node) {
    const a = this.nodes;
    let i = a.length;
    a.push(node);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= node.f) break;
      a[i] = a[p]; i = p;
    }
    a[i] = node;
  }
  pop() {
    const a = this.nodes, first = a[0], last = a.pop();
    if (a.length) {
      let i = 0;
      while (i * 2 + 1 < a.length) {
        let c = i * 2 + 1;
        if (c + 1 < a.length && a[c + 1].f < a[c].f) c++;
        if (last.f <= a[c].f) break;
        a[i] = a[c]; i = c;
      }
      a[i] = last;
    }
    return first;
  }
}

const DIRECTIONS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [-1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, -1, Math.SQRT2]];

/** Returns tile-center waypoints excluding the starting tile, or [] if unreachable. */
export function findPath(grid, sx, sy, gx, gy, maxVisited = 2400) {
  sx = Math.floor(sx); sy = Math.floor(sy); gx = Math.floor(gx); gy = Math.floor(gy);
  if (!grid || blocked(grid, sx, sy) || blocked(grid, gx, gy)) return [];
  if (sx === gx && sy === gy) return [{ x: gx + 0.5, y: gy + 0.5 }];
  const width = grid.width, size = width * grid.height;
  const index = (x, y) => (y - grid.y) * width + x - grid.x;
  const start = index(sx, sy), goal = index(gx, gy);
  const costs = new Float32Array(size).fill(Infinity);
  const parents = new Int32Array(size).fill(-1);
  const closed = new Uint8Array(size);
  const heuristic = (x, y) => {
    const dx = Math.abs(gx - x), dy = Math.abs(gy - y);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };
  const open = new MinHeap();
  costs[start] = 0;
  open.push({ i: start, x: sx, y: sy, f: heuristic(sx, sy) });
  let visited = 0;
  while (open.nodes.length && visited++ < maxVisited) {
    const node = open.pop();
    if (closed[node.i]) continue;
    if (node.i === goal) {
      const path = [];
      for (let i = goal; i !== start; i = parents[i]) {
        if (i < 0) return [];
        path.push({ x: grid.x + i % width + 0.5, y: grid.y + Math.floor(i / width) + 0.5 });
      }
      return path.reverse();
    }
    closed[node.i] = 1;
    for (const [dx, dy, step] of DIRECTIONS) {
      const x = node.x + dx, y = node.y + dy;
      if (blocked(grid, x, y)) continue;
      if (dx && dy && (blocked(grid, node.x + dx, node.y) || blocked(grid, node.x, node.y + dy))) continue;
      const next = index(x, y), cost = costs[node.i] + step;
      if (closed[next] || cost >= costs[next]) continue;
      costs[next] = cost; parents[next] = node.i;
      open.push({ i: next, x, y, f: cost + heuristic(x, y) });
    }
  }
  return [];
}

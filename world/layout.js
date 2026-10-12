// Pure, seeded town blueprints. Geometry never depends on chunk load order.
export const BLOCK_SIZE = 32;

export function hash(seed, x, y, salt = 0) {
  let value = (seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(salt, 1274126177)) >>> 0;
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return (value ^ (value >>> 16)) >>> 0;
}

export function random(seed, x, y, salt = 0) {
  return hash(seed, x, y, salt) / 4294967296;
}

export function mod(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

const PALETTES = {
  home: { wall: '#b4a991', floor: '#796048', style: 'wood' },
  clinic: { wall: '#a3b8af', floor: '#8c9b93', style: 'tile' },
  hardware: { wall: '#a29b82', floor: '#747064', style: 'concrete' },
  diner: { wall: '#a5ada0', floor: '#928f7d', style: 'checker' },
  market: { wall: '#b0aa91', floor: '#929180', style: 'tile' },
  station: { wall: '#b8a38b', floor: '#857564', style: 'tile' },
  garage: { wall: '#929890', floor: '#777d76', style: 'concrete' },
  apartments: { wall: '#b2a18d', floor: '#7c6552', style: 'wood' },
  warehouse: { wall: '#939585', floor: '#74786f', style: 'concrete' },
};

const LANDMARKS = {
  '0,0': ['home', 'Morrow House', 11, 11],
  '1,0': ['clinic', 'Mercy Pharmacy', 13, 12],
  '0,-1': ['hardware', 'Hollis Hardware', 13, 13],
  '1,-1': ['diner', 'Last Stop Diner', 13, 11],
  '-1,0': ['market', 'Juniper Market', 14, 13],
  '0,1': ['station', 'Station No. 4', 13, 13],
  '1,1': ['garage', 'Black Pine Auto', 14, 13],
  '-1,-1': ['apartments', 'The Lantern Apartments', 13, 13],
  '-1,1': ['home', 'Garden House', 12, 12],
};

const NAMES = {
  home: ['Ash', 'Hawthorn', 'Cedar', 'Wren', 'Hollow', 'Birch'],
  clinic: ['Pinecrest', 'Hopewell', 'Riverside', 'Westgate'],
  hardware: ['Miller’s', 'Briar', 'All Season', 'Cornerstone'],
  diner: ['Bluebird', 'Night Owl', 'The Wayfarer', 'Maple'],
  market: ['Harvest', 'Fairview', 'Oak Street', 'Wells'],
  station: ['Ranger', 'County', 'Northside', 'Watch'],
  garage: ['Garrison', 'Summit', 'Crest', 'Two Brothers'],
  apartments: ['Redwood', 'Fairhaven', 'Shady Grove', 'Foxglove'],
  warehouse: ['Millstone', 'Horizon', 'Union', 'Briarwood'],
};
const SUFFIX = {
  home: 'House', clinic: 'Medical', hardware: 'Hardware', diner: 'Diner',
  market: 'Market', station: 'Station', garage: 'Auto', apartments: 'Apartments', warehouse: 'Storage',
};

const LOOT = {
  kitchen: [['beans', 1, 3], ['water', 1, 2], ['cloth', 0, 2]],
  medicine: [['bandage', 2, 4], ['water', 1, 2], ['cloth', 1, 3]],
  tools: [['nails', 3, 8], ['plank', 1, 3], ['hammer', 0, 1], ['scrap', 1, 3]],
  weapons: [['ammo', 2, 6], ['pistol', 0, 1], ['bandage', 0, 1]],
  bedroom: [['cloth', 1, 3], ['bandage', 0, 1], ['water', 0, 1]],
  workshop: [['scrap', 2, 4], ['nails', 2, 5], ['axe', 0, 1]],
  vehicle: [['water', 0, 1], ['cloth', 0, 2], ['scrap', 1, 2]],
};

function makeLoot(seed, x, y, category, salt = 0) {
  return LOOT[category].map(([id, min, max], index) => ({
    id, qty: min + Math.floor(random(seed, x, y, salt + index + 1) * (max - min + 1)),
  })).filter(item => item.qty > 0);
}

export function baseTerrain(x, y) {
  const lx = mod(x, BLOCK_SIZE);
  const ly = mod(y, BLOCK_SIZE);
  if ((lx >= 19 && lx <= 24) || (ly >= 19 && ly <= 24)) return 'road';
  if ((lx >= 17 && lx <= 26) || (ly >= 17 && ly <= 26)) return 'sidewalk';
  return 'grass';
}

function contains(rect, x, y) {
  return x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
}

export function makeBlock(seed, bx, by) {
  const ox = bx * BLOCK_SIZE;
  const oy = by * BLOCK_SIZE;
  const key = `${bx},${by}`;
  const landmark = LANDMARKS[key];
  const types = Object.keys(PALETTES);
  const type = landmark?.[0] || types[hash(seed, bx, by, 13) % types.length];
  const name = landmark?.[1] || `${NAMES[type][hash(seed, bx, by, 17) % NAMES[type].length]} ${SUFFIX[type]}`;
  const w = landmark?.[2] || 11 + hash(seed, bx, by, 21) % 4;
  const h = landmark?.[3] || 11 + hash(seed, bx, by, 23) % 4;
  const palette = PALETTES[type];
  const building = {
    id: `building:${key}`, x: ox + 2, y: oy + 2, w, h,
    name, type, room: name, ...palette,
    safehouse: bx === 0 && by === 0,
  };
  const props = [];
  const paths = [];
  const x0 = building.x;
  const y0 = building.y;
  const x1 = x0 + w - 1;
  const y1 = y0 + h - 1;
  const mx = x0 + Math.floor(w / 2);
  const my = y0 + Math.floor(h / 2);

  function add(type, x, y, options = {}) {
    const prop = {
      id: `${type}:${x}:${y}`, x, y, type, w: 1, h: 1, rotation: 0,
      blocked: !['lamp', 'debris'].includes(type), ...options,
    };
    if (contains(building, x, y)) {
      prop.room = building.room;
      prop.buildingId = building.id;
    }
    props.push(prop);
    return prop;
  }

  function furniture(type, x, y, options = {}, category) {
    const prop = add(type, x, y, options);
    if (category) {
      prop.loot = makeLoot(seed, x, y, category);
      prop.looted = false;
    }
    return prop;
  }

  // Whole-tile walls make collision and navigation agree. Near walls are rendered
  // as low cutaways; their physical wall remains intact.
  for (let x = x0; x <= x1; x++) {
    for (const [y, side] of [[y0, 'north'], [y1, 'south']]) {
      const isWindow = x === x0 + 3 || x === x1 - 3;
      const isDoor = !building.safehouse && side === 'south' && x === mx;
      const wallType = isDoor ? 'door' : isWindow ? 'window' : 'wall';
      add(wallType, x, y, {
        color: palette.wall, rotation: 0, side, cutaway: side === 'south',
        ...(wallType === 'wall' ? {} : { open: false, barricaded: 0 }),
        ...(isDoor ? { label: `${name} · rear door` } : {}),
        ...(side === 'north' && x === mx ? { label: name, sign: type !== 'home' } : {}),
      });
    }
  }
  for (let y = y0 + 1; y < y1; y++) {
    for (const [x, side] of [[x0, 'west'], [x1, 'east']]) {
      const isDoor = side === 'east' && y === my;
      const isWindow = !isDoor && (y === y0 + 3 || y === y1 - 3);
      const wallType = isDoor ? 'door' : isWindow ? 'window' : 'wall';
      add(wallType, x, y, {
        color: palette.wall, rotation: 1, side, cutaway: side === 'east',
        ...(wallType === 'wall' ? {} : { open: false, barricaded: 0 }),
        ...(isDoor ? { label: building.safehouse ? 'Safehouse door' : `${name} · entrance` } : {}),
      });
    }
  }
  // Clear approaches join every exterior entrance to the public sidewalk.
  paths.push({ x: x1 + 1, y: my, w: ox + 19 - x1 - 1, h: 1, type: 'sidewalk' });
  if (!building.safehouse) paths.push({ x: mx, y: y1 + 1, w: 1, h: oy + 19 - y1 - 1, type: 'sidewalk' });

  const stool = (x, y, rotation = 0) => furniture('chair', x, y, { color: '#695541', rotation });
  const shelf = (x, y, category, label, options = {}) => furniture('shelf', x, y, { label, color: '#72634b', ...options }, category);
  const crate = (x, y, category, label) => furniture('crate', x, y, { label, color: '#85704b' }, category);
  const counter = (x, y, category, label, options = {}) => furniture('counter', x, y, { label, color: '#a39b7d', ...options }, category);
  const lamp = (x, y, color = '#edc789') => furniture('lamp', x, y, { color, lit: true, intensity: 0.65, label: 'Emergency lamp' });

  if (building.safehouse) {
    counter(3, 3, 'kitchen', 'Kitchen cupboards');
    counter(4, 3, null, 'Sink', { variant: 'sink' });
    counter(5, 3, 'kitchen', 'Pantry');
    shelf(3, 4, 'kitchen', 'Refrigerator', { color: '#bdc1ad', variant: 'fridge' });
    furniture('table', 8, 4, { w: 2, color: '#957449', label: 'Dining table' }, 'kitchen');
    stool(8, 5); stool(9, 5);
    const supplies = crate(6, 7, 'tools', 'Emergency supplies');
    supplies.loot = [{ id: 'water', qty: 2 }, { id: 'beans', qty: 2 }, { id: 'bandage', qty: 2 }, { id: 'nails', qty: 6 }, { id: 'cloth', qty: 2 }];
    furniture('sofa', 3, 9, { w: 2, color: '#69725e', label: 'Worn sofa' });
    furniture('table', 4, 10, { color: '#7b6044', label: 'Coffee table' });
    furniture('bed', 9, 9, { h: 2, color: '#838d79', label: 'Safehouse bed' });
    counter(10, 10, 'bedroom', 'Bedside cabinet', { color: '#7e654c' });
    shelf(3, 6, 'bedroom', 'Hall cupboard');
    lamp(10, 3); lamp(3, 8);
    building.rugs = [{ x: 3, y: 8, w: 4, h: 4, color: '#755847' }, { x: 8, y: 8, w: 3, h: 4, color: '#646850' }];
  } else if (type === 'home' || type === 'apartments') {
    counter(x0 + 1, y0 + 1, 'kitchen', 'Kitchen cupboards');
    counter(x0 + 2, y0 + 1, null, 'Sink', { variant: 'sink' });
    shelf(x0 + 1, y0 + 2, 'kitchen', 'Pantry', { color: '#939987', variant: 'fridge' });
    furniture('table', x1 - 4, y0 + 2, { w: 2, color: '#987649', label: 'Dining table' }, 'kitchen');
    stool(x1 - 4, y0 + 3); stool(x1 - 3, y0 + 3);
    furniture('sofa', x0 + 1, y1 - 3, { w: 2, color: '#778077', label: 'Sofa' });
    furniture('table', x0 + 2, y1 - 2, { color: '#826340', label: 'Coffee table' });
    furniture('bed', x1 - 3, y1 - 3, { h: 2, color: '#8e8b79', label: 'Bed' });
    counter(x1 - 2, y1 - 2, 'bedroom', 'Bedside cabinet');
    shelf(x0 + 1, y0 + 4, 'bedroom', 'Hall cupboard');
    lamp(x1 - 1, y0 + 1);
    if (type === 'apartments') furniture('bed', x1 - 5, y1 - 3, { h: 2, color: '#827282', label: 'Guest bed' });
    building.rugs = [{ x: x0 + 1, y: y1 - 4, w: 4, h: 4, color: '#6a6252' }];
  } else if (type === 'clinic') {
    for (let dx = 1; dx <= 4; dx++) shelf(x0 + dx, y0 + 1, 'medicine', 'Medical cabinet', { color: '#a5b5a6' });
    counter(x1 - 3, y0 + 3, 'medicine', 'Pharmacy counter', { w: 2, color: '#a9b7a9' });
    for (const dx of [2, 5, 8]) {
      furniture('bed', x0 + dx, y1 - 3, { h: 2, color: '#b3c2ad', label: 'Examination bed' });
    }
    stool(x1 - 2, y0 + 4);
    crate(x0 + 1, my - 1, 'medicine', 'Medical delivery');
    lamp(x1 - 1, y0 + 1, '#c3ded0');
  } else if (type === 'hardware' || type === 'warehouse') {
    for (const dx of [1, 4, 7]) {
      shelf(x0 + dx, y0 + 1, 'tools', 'Hardware shelf', { h: 2, color: '#7c8175' });
      crate(x0 + dx, y1 - 2, 'workshop', 'Workshop supplies');
    }
    counter(x1 - 3, y0 + 3, 'tools', 'Tool counter', { w: 2, color: '#8e8875' });
    crate(x1 - 2, y1 - 4, 'tools', 'Timber offcuts');
    lamp(x1 - 1, y0 + 1);
  } else if (type === 'diner') {
    for (const dx of [1, 2, 3, 4]) counter(x0 + dx, y0 + 1, 'kitchen', dx === 2 ? 'Griddle' : 'Kitchen counter');
    shelf(x0 + 1, y0 + 2, 'kitchen', 'Walk-in pantry', { color: '#a6b3a4', variant: 'fridge' });
    for (const dx of [3, 7]) {
      furniture('table', x0 + dx, y1 - 3, { color: '#bfb397', label: 'Diner table' });
      furniture('sofa', x0 + dx, y1 - 2, { color: '#8c5547', label: 'Vinyl booth' });
      stool(x0 + dx + 1, y1 - 3, 1);
    }
    counter(x1 - 3, y0 + 3, 'kitchen', 'Service counter', { w: 2, color: '#b6b89d' });
    lamp(x1 - 1, y0 + 1);
  } else if (type === 'market') {
    for (const dx of [2, 5, 8]) {
      shelf(x0 + dx, y0 + 2, 'kitchen', 'Grocery shelf', { h: 2, color: '#909381' });
      shelf(x0 + dx, y1 - 3, 'kitchen', 'Grocery shelf', { h: 2, color: '#909381' });
    }
    counter(x1 - 2, my - 2, 'kitchen', 'Checkout', { color: '#afb49c' });
    crate(x0 + 1, my + 1, 'kitchen', 'Canned goods');
    lamp(x1 - 1, y0 + 1, '#d6dfb6');
  } else if (type === 'station') {
    for (const dx of [1, 3, 5]) shelf(x0 + dx, y0 + 1, 'weapons', 'Equipment locker', { color: '#7b897f' });
    furniture('table', x0 + 2, y1 - 3, { w: 2, color: '#8f8061', label: 'Duty desk' }, 'bedroom');
    stool(x0 + 3, y1 - 2);
    furniture('sofa', x1 - 4, y1 - 2, { w: 2, color: '#56685c', label: 'Station bench' });
    counter(x1 - 3, y0 + 3, 'medicine', 'First-aid station', { w: 2 });
    lamp(x1 - 1, y0 + 1);
  } else if (type === 'garage') {
    for (const dx of [1, 3, 5]) shelf(x0 + dx, y0 + 1, 'workshop', 'Tool cabinet', { color: '#7f8277' });
    furniture('car', x0 + 2, y1 - 4, { w: 3, h: 2, color: '#7d7765', rotation: 0, label: 'Stripped station wagon', variant: 'wreck' }, 'vehicle');
    counter(x1 - 4, y1 - 2, 'workshop', 'Workbench', { w: 3, color: '#8d7958' });
    crate(x1 - 2, y0 + 3, 'tools', 'Spare parts');
    lamp(x1 - 1, y0 + 1);
  }

  // Rear-yard detail. Gates always align with a clear route to the street.
  if (type === 'home' || type === 'apartments') {
    for (let lx = 0; lx <= 16; lx++) {
      if (lx < 7 || lx > 10) add('fence', ox + lx, oy + 16, { color: '#837b5f', rotation: 0, cutaway: true });
    }
    for (let ly = 1; ly < 16; ly++) {
      if (ly !== 7 && ly !== 8) add('fence', ox, oy + ly, { color: '#837b5f', rotation: 1 });
    }
  }

  const occupied = (x, y) => props.some(prop => contains(prop, x, y));
  const clearGround = (x, y) => !contains(building, x, y) && !paths.some(path => contains(path, x, y)) && !occupied(x, y);
  for (let index = 0; index < 18; index++) {
    const lx = hash(seed, bx, by, 100 + index * 2) % 32;
    const ly = hash(seed, bx, by, 101 + index * 2) % 32;
    const x = ox + lx;
    const y = oy + ly;
    if (baseTerrain(x, y) !== 'grass' || !clearGround(x, y)) continue;
    // Preserve the broad lawn immediately outside the safehouse's front door.
    if (building.safehouse && lx >= 11 && lx <= 18 && ly >= 5 && ly <= 10) continue;
    add('tree', x, y, { color: index % 3 ? '#50644b' : '#697447', variant: index % 3 ? 'pine' : 'oak', height: 1.5 + random(seed, x, y, 4), label: 'Tree' });
  }

  // Parked vehicles sit at road edges; both traffic lanes and crossings stay open.
  const carColor = ['#7c8880', '#a58a63', '#7e4f45', '#6a777f'][hash(seed, bx, by, 303) % 4];
  furniture('car', ox + 24, oy + 10, { w: 2, h: 3, rotation: 1, color: carColor, label: 'Abandoned sedan' }, 'vehicle');
  if (hash(seed, bx, by, 305) % 3 !== 0) {
    furniture('car', ox + 8, oy + 24, { w: 3, h: 2, rotation: 0, color: '#858377', label: 'Delivery car' }, 'vehicle');
  }
  add('lamp', ox + 17, oy + 15, { label: 'Streetlight', color: '#d7bd80', variant: 'street', lit: false, height: 2 });
  add('lamp', ox + 27, oy + 26, { label: 'Streetlight', color: '#d7bd80', variant: 'street', lit: false, height: 2 });
  for (let index = 0; index < 7; index++) {
    const x = ox + 17 + hash(seed, bx, by, 400 + index * 2) % 11;
    const y = oy + 2 + hash(seed, bx, by, 401 + index * 2) % 27;
    if (occupied(x, y) || paths.some(path => contains(path, x, y))) continue;
    add('debris', x, y, { color: '#777464', variant: index % 3 ? 'litter' : 'rubble' });
  }

  return { key, x: ox, y: oy, buildings: [building], props, paths };
}

export function terrainInBlock(block, x, y, seed) {
  const building = block.buildings.find(candidate => contains(candidate, x, y));
  const variant = hash(seed, x, y, 611) % 8;
  if (building) {
    const rug = building.rugs?.find(candidate => contains(candidate, x, y));
    return {
      x, y, type: 'floor', blocked: false, room: building.room,
      buildingId: building.id, floorStyle: building.style, color: building.floor,
      variant, ...(rug ? { rug: rug.color } : {}),
    };
  }
  const path = block.paths.find(candidate => contains(candidate, x, y));
  const type = path?.type || baseTerrain(x, y);
  const lx = mod(x, BLOCK_SIZE);
  const ly = mod(y, BLOCK_SIZE);
  const vertical = lx >= 19 && lx <= 24;
  const horizontal = ly >= 19 && ly <= 24;
  return {
    x, y, type, blocked: false, variant,
    ...(type === 'road' ? {
      roadAxis: vertical && horizontal ? 'junction' : vertical ? 'y' : 'x',
      lane: (vertical && lx === 21 && !horizontal) || (horizontal && ly === 21 && !vertical),
      crosswalk: (vertical && (ly === 18 || ly === 25)) || (horizontal && (lx === 18 || lx === 25)),
    } : {}),
  };
}

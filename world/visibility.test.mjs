import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from './generator.js';
import { Visibility, VisibilityMemory, RULES, clarity, outdoorRadius } from './visibility.js';

/** A small fake town: one 7 x 6 building at (10,10) with a door in the south wall and a window in the west wall. */
function town({ door = false, windowBarricaded = 0, lamp = null, windows = true } = {}) {
  const X0 = 10, Y0 = 10, W = 7, H = 6, ID = 'building:test';
  const props = [];
  const add = (type, x, y, extra = {}) => props.push({ id: `${type}:${x}:${y}`, type, x, y, w: 1, h: 1, buildingId: ID, room: 'Test', ...extra });
  for (let x = X0; x < X0 + W; x++) for (const y of [Y0, Y0 + H - 1]) add('wall', x, y);
  for (let y = Y0 + 1; y < Y0 + H - 1; y++) for (const x of [X0, X0 + W - 1]) add('wall', x, y);
  const swap = (x, y, type, extra) => { const i = props.findIndex(p => p.x === x && p.y === y); props[i] = { ...props[i], id: `${type}:${x}:${y}`, type, open: false, barricaded: 0, ...extra }; };
  swap(13, 15, 'door', { open: door });
  if (windows) swap(10, 13, 'window', { barricaded: windowBarricaded });
  if (lamp) add('lamp', lamp[0], lamp[1], { lit: true });
  return {
    props,
    getTile: (x, y) => {
      x = Math.floor(x); y = Math.floor(y);
      const inside = x >= X0 && x < X0 + W && y >= Y0 && y < Y0 + H;
      return inside ? { type: 'floor', room: 'Test', buildingId: ID } : { type: 'grass' };
    },
    getProps: () => props,
  };
}
const DAY = { daylight: 1, weather: { type: 'clear', intensity: 0.05 } };
const NIGHT = { daylight: 0.12, weather: { type: 'clear', intensity: 0.05 } };
const see = (field, x, y) => field.state(x, y);
const inside = { x: 13.5, y: 12.5 };

test('indoors in daylight you see the whole room, bounded by its walls', () => {
  const v = new Visibility(town({ door: true }));
  const f = v.update({ ...inside, ...DAY });
  assert.equal(f.mode, 'indoor');
  for (let y = 11; y <= 14; y++) for (let x = 11; x <= 15; x++) assert.equal(see(f, x, y), 'visible', `room tile ${x},${y}`);
  assert.equal(see(f, 10, 11), 'visible', 'the wall itself is seen');
  assert.equal(see(f, 25, 12), 'hidden', 'far beyond the building is hidden');
});

test('from inside, every wall of the room is seen, corners included', () => {
  const f = new Visibility(town({ door: true })).update({ ...inside, ...DAY });
  for (let x = 10; x <= 16; x++) for (const y of [10, 15]) assert.equal(see(f, x, y), 'visible', `wall ${x},${y}`);
  for (let y = 10; y <= 15; y++) for (const x of [10, 16]) assert.equal(see(f, x, y), 'visible', `wall ${x},${y}`);
});

test('a closed door and barricaded window hide everything outside', () => {
  const v = new Visibility(town({ door: false, windowBarricaded: 1 }));
  const f = v.update({ ...inside, ...DAY });
  for (let y = 5; y <= 25; y++) for (let x = 3; x <= 24; x++) {
    const outside = x < 10 || x > 16 || y < 10 || y > 15;
    if (outside) assert.equal(see(f, x, y), 'hidden', `outside tile ${x},${y} must stay hidden`);
  }
});

test('an open door makes a cone that widens with distance', () => {
  const v = new Visibility(town({ door: true, windowBarricaded: 1 }));
  const f = v.update({ x: 13.5, y: 12.5, ...DAY });
  assert.equal(see(f, 13, 16), 'visible', 'straight through the door');
  assert.equal(see(f, 13, 18), 'visible');
  assert.equal(see(f, 8, 16), 'hidden', 'beside the building');
  const width = y => { let n = 0; for (let x = 0; x < 30; x++) if (see(f, x, y) === 'visible') n++; return n; };
  assert.ok(width(18) > width(16), 'the cone is wider farther out');
  assert.equal(see(f, 25, 16), 'hidden', 'outside the cone');
});

test('a clear window shows the outside; barricading it takes the view away', () => {
  const clear = new Visibility(town({ windowBarricaded: 0 })).update({ x: 13.5, y: 13.5, ...DAY });
  assert.notEqual(see(clear, 7, 13), 'hidden', 'looking west through the window');
  const boarded = new Visibility(town({ windowBarricaded: 2 })).update({ x: 13.5, y: 13.5, ...DAY });
  assert.equal(see(boarded, 7, 13), 'hidden');
});

test('a dark room stays dark until a lamp is lit', () => {
  const sealed = { door: false, windowBarricaded: 1 };
  const dark = new Visibility(town(sealed)).update({ ...inside, ...DAY });
  assert.equal(see(dark, 14, 14), 'hidden', 'across a sealed unlit room');
  assert.equal(see(dark, 13, 13), 'visible', 'the tiles right next to you can still be felt');
  const lit = new Visibility(town({ ...sealed, lamp: [14, 13] })).update({ ...inside, ...DAY });
  assert.equal(see(lit, 14, 14), 'visible', 'a lit lamp reveals the room');
  assert.ok(lit.light(14, 13) > dark.light(14, 14));
});

test('outdoors the radius is small and shrinks at night and in bad weather', () => {
  const open = { getTile: () => ({ type: 'grass' }), getProps: () => [] };
  const count = view => { const f = new Visibility(open).update({ x: 0.5, y: 0.5, ...view }); let n = 0; for (const [, t] of f.tiles) if (t.state === 'visible') n++; return n; };
  const day = count(DAY), night = count(NIGHT);
  const fog = count({ daylight: 1, weather: { type: 'fog', intensity: 0.8 } });
  const storm = count({ daylight: 1, weather: { type: 'storm', intensity: 0.9 } });
  assert.ok(night < day / 3, `night ${night} should be far below day ${day}`);
  assert.ok(fog < day && storm < day);
  assert.ok(fog < storm, 'fog hides more than a storm');
  assert.ok(outdoorRadius(1, DAY.weather) > outdoorRadius(0.12, DAY.weather));
  assert.ok(clarity({ type: 'fog', intensity: 0.8 }) < clarity({ type: 'clear', intensity: 0.05 }));
  const f = new Visibility(open).update({ x: 0.5, y: 0.5, ...DAY });
  assert.equal(see(f, 30, 0), 'hidden', 'fog of war beyond the radius');
});

test('at night a window shows a silhouette, not detail', () => {
  const world = town({ door: false, windows: true });
  const v = new Visibility(world);
  // Standing outside the west window at night, looking in at the unlit room.
  const f = v.update({ x: 8.5, y: 13.5, ...NIGHT });
  assert.equal(see(f, 12, 13), 'silhouette', 'a shape in the dark room');
  assert.equal(f.entityState(12, 13), 'shape');
  assert.equal(f.entityState(8, 13), 'full', 'right beside you');
  // With the lamp lit, the same tile shows detail.
  const lit = new Visibility(town({ windows: true, lamp: [12, 13] })).update({ x: 8.5, y: 13.5, ...NIGHT });
  assert.equal(see(lit, 12, 13), 'visible');
});

test('seen places are remembered faintly after the player leaves', () => {
  const v = new Visibility(town({ door: false, windowBarricaded: 1, lamp: [13, 12] }));
  const inRoom = v.update({ ...inside, ...DAY });
  assert.equal(see(inRoom, 14, 13), 'visible');
  const outside = v.update({ x: 4.5, y: 4.5, ...DAY });
  assert.equal(see(outside, 14, 13), 'remembered');
  assert.equal(see(outside, 40, 40), 'hidden', 'never seen stays hidden');
  assert.equal(outside.entityState(14, 13), 'none', 'a remembered tile does not show actors');
});

test('silhouettes are not remembered as seen', () => {
  const v = new Visibility(town({ windows: true }));
  v.update({ x: 8.5, y: 13.5, ...NIGHT });
  assert.equal(v.memory.has(12, 13), false);
});

test('memory survives saving and loading in compact form', () => {
  const memory = new VisibilityMemory();
  for (let x = 3; x <= 9; x++) memory.add(x, 5);
  memory.add(20, 5); memory.add(21, 6);
  const runs = memory.serialize();
  assert.deepEqual(runs, [[5, 3, 9], [5, 20, 20], [6, 21, 21]]);
  const back = VisibilityMemory.deserialize(JSON.parse(JSON.stringify(runs)));
  assert.equal(back.count, memory.count);
  assert.ok(back.has(9, 5) && back.has(21, 6) && !back.has(10, 5));
  assert.equal(VisibilityMemory.deserialize('garbage').count, 0);
  assert.equal(VisibilityMemory.deserialize([[1, 5, 2], [1, 'a', 3], [1, 0, 99999]]).count, 0, 'malformed runs are ignored');
});

test('the real safehouse: closed up, nothing outside is visible; open the door and a cone appears', () => {
  const world = new World(74219);
  world.update(7.5, 7.5);
  for (const prop of world.getProps(7.5, 7.5, 16)) if (prop.type === 'window' || prop.type === 'door') { prop.barricaded = 1; prop.open = false; }
  const v = new Visibility(world);
  const sealed = v.update({ x: 7.5, y: 7.5, ...DAY });
  const houseTiles = [...sealed.tiles.keys()].map(k => k.split(',').map(Number));
  assert.ok(houseTiles.length > 40, `the room should be visible, saw ${houseTiles.length} tiles`);
  for (const [x, y] of houseTiles) {
    const t = world.getTile(x, y);
    assert.ok(t.room === 'Morrow House', `${x},${y} is ${t.room || t.type}, outside the room`);
  }
  const door = world.getProps(7.5, 7.5, 16).find(p => p.id === 'door:12:7');
  door.barricaded = 0; door.open = true;
  const opened = new Visibility(world).update({ x: 9.5, y: 7.5, ...DAY });
  const outdoors = [...opened.tiles.keys()].map(k => k.split(',').map(Number)).filter(([x, y]) => !world.getTile(x, y).room);
  assert.ok(outdoors.length > 5, 'tiles outside are visible through the open door');
});

test('destroying a wall opens the view', () => {
  const world = new World(74219);
  world.update(7.5, 7.5);
  for (const prop of world.getProps(7.5, 7.5, 16)) if (prop.type === 'window' || prop.type === 'door') { prop.barricaded = 1; prop.open = false; }
  const before = new Visibility(world).update({ x: 9.5, y: 6.5, ...DAY }).state(14, 6);
  world.destroyProp('wall:12:6');
  const after = new Visibility(world).update({ x: 9.5, y: 6.5, ...DAY }).state(14, 6);
  assert.equal(before, 'hidden');
  assert.equal(after, 'visible');
});

test('computing visibility is fast enough to run every frame', () => {
  const world = new World(74219);
  world.update(7.5, 7.5);
  const v = new Visibility(world);
  v.update({ x: 7.5, y: 7.5, ...DAY });
  const start = performance.now();
  const runs = 50;
  for (let i = 0; i < runs; i++) v.update({ x: 7.5 + (i % 5) * 0.4, y: 7.5, ...DAY });
  const average = (performance.now() - start) / runs;
  assert.ok(average < 8, `average ${average.toFixed(2)} ms per update`);
});

test('rules are exposed and frozen', () => {
  assert.ok(Object.isFrozen(RULES));
  assert.ok(RULES.nightRadius < RULES.dayRadius);
});

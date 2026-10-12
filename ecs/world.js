/**
 * Sparse component storage. Components remain ordinary game-owned JSON values.
 *
 * const actors = new ECS();
 * const id = actors.create({ position: { x: 7.5, y: 7.5 }, health: 100 });
 * actors.add(id, 'velocity', { x: 0, y: 0 });
 * for (const [id, position, velocity] of actors.query('position', 'velocity')) {}
 */
export class ECS {
  constructor() {
    this.entities = new Set();
    this.components = new Map();
    this._nextId = 1;
  }

  get size() { return this.entities.size; }

  /** Create an entity with an automatically allocated numeric ID. */
  create(components = {}) {
    while (this.entities.has(this._nextId)) this._nextId += 1;
    const id = this._nextId++;
    return this.add(id, components);
  }

  /**
   * add(id, name, value) sets a component, creating the entity if necessary.
   * add(id, { name: value, ... }) adds a batch of components.
   * add({ name: value, ... }) is shorthand for create(components).
   */
  add(id, component, value) {
    if (id !== null && typeof id === 'object' && !Array.isArray(id)) return this.create(id);
    this._checkId(id);
    let entries;
    if (component === undefined) entries = [];
    else if (typeof component === 'string') entries = [[component, value]];
    else if (component !== null && typeof component === 'object' && !Array.isArray(component)) {
      entries = Object.entries(component);
    } else throw new TypeError('Components must be named with a string or supplied as an object.');
    for (const [name] of entries) this._checkName(name);
    this.entities.add(id);
    for (const [name, data] of entries) {
      let store = this.components.get(name);
      if (!store) this.components.set(name, store = new Map());
      store.set(id, data);
    }
    return id;
  }

  get(id, component) {
    return this.components.get(component)?.get(id);
  }

  has(id, component) {
    return component === undefined ? this.entities.has(id) : Boolean(this.components.get(component)?.has(id));
  }

  /** Remove one component, or remove the entire entity when no name is supplied. */
  remove(id, component) {
    if (component !== undefined) {
      const store = this.components.get(component);
      if (!store) return false;
      const removed = store.delete(id);
      if (!store.size) this.components.delete(component);
      return removed;
    }
    if (!this.entities.delete(id)) return false;
    for (const [name, store] of this.components) {
      store.delete(id);
      if (!store.size) this.components.delete(name);
    }
    return true;
  }

  /**
   * Iterate [entityId, ...componentValues] in the requested component order.
   * Uses the smallest store as the candidate set. The query is live: component
   * changes are visible on subsequent iterations. query() visits every entity.
   */
  *query(...names) {
    if (names.length === 1 && Array.isArray(names[0])) names = names[0];
    if (!names.length) {
      for (const id of this.entities) yield [id];
      return;
    }
    let candidates;
    const stores = [];
    for (const name of names) {
      this._checkName(name);
      const store = this.components.get(name);
      if (!store?.size) return;
      stores.push(store);
      if (!candidates || store.size < candidates.size) candidates = store;
    }
    for (const id of candidates.keys()) {
      if (this.entities.has(id) && stores.every(store => store.has(id))) {
        yield [id, ...stores.map(store => store.get(id))];
      }
    }
  }

  clear() {
    this.entities.clear();
    this.components.clear();
    // Do not recycle IDs: callers may still hold references to deleted entities.
  }

  _checkId(id) {
    if ((typeof id === 'number' && Number.isSafeInteger(id) && id >= 0) ||
        (typeof id === 'string' && id.length > 0)) return;
    throw new TypeError('Entity IDs must be nonnegative safe integers or nonempty strings.');
  }

  _checkName(name) {
    if (typeof name !== 'string' || name.length === 0) {
      throw new TypeError('Component names must be nonempty strings.');
    }
  }
}

export default ECS;

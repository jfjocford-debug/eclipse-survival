import { icon } from './icons.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const clamp = value => Math.max(0, Math.min(100, Number(value) || 0));
const pad = value => String(Math.floor(value)).padStart(2, '0');
const title = value => String(value || '').replace(/(^|[ _-])\w/g, s => s.toUpperCase()).replace(/[_-]/g, ' ');
const NAV = [['inventory','bag','Inventory','I'],['crafting','craft','Crafting','C'],['skills','skills','Skills','K'],['map','map','Map','M']];
const NEEDS = [['health','heart','Health'],['stamina','bolt','Stamina'],['hunger','food','Hunger'],['thirst','water','Thirst'],['energy','moon','Energy']];
const WEAPONS = new Set(['bat','axe','pistol']);
const CONSUMABLES = new Set(['water','beans','bandage']);

/** DOM HUD. The simulation remains authoritative; every gameplay button uses game.action. */
export class UI {
  constructor(game) {
    this.game = game;
    this.root = null;
    this.panel = null;
    this.category = 'all';
    this.selected = null;
    this.toasts = [];
    this._toastId = 0;
    this.journalOpen = true;
    this._lastUpdate = -Infinity;
    this._lastMap = -Infinity;
    this._modalSignature = '';
    this._resumeOnClose = false;
    this._transition = false;
    this._confirmRestart = false;
    this._destroyed = false;
    this._cache = new Map();
  }

  mount() {
    if (this.root) return this;
    this.root = document.getElementById('ui-root');
    if (!this.root) { this.root = document.createElement('div'); this.root.id = 'ui-root'; document.body.append(this.root); }
    this.root.innerHTML = `
      <header class="topbar">
        <div class="wordmark">${icon('mark','brand-symbol')}<div><h1>DEADFALL<span class="brand-dot">.</span></h1><p>SURVIVAL SANDBOX</p></div></div>
        <div class="location-block">${icon('pin')}<div><span class="eyebrow">CURRENT LOCATION</span><span id="hud-location">The outskirts</span></div></div>
        <div class="world-clock"><div class="clock-date"><span class="eyebrow" id="hud-day">DAY 01</span><strong id="hud-time">09:00</strong></div><div class="weather-block"><span id="hud-weather-icon">${icon('cloud')}</span><div><span id="hud-temperature">16° C</span><span class="muted" id="hud-weather">Overcast</span></div></div></div>
        <button class="icon-button pause-button" data-panel="pause" title="Pause · Escape" aria-label="Pause game">${icon('pause')}</button>
      </header>
      <aside class="survivor-panel panel-surface" aria-label="Survivor condition">
        <div class="section-topline"><span class="eyebrow">YOUR SURVIVOR</span><span id="hud-condition" class="condition">Stable</span></div>
        <div class="vitals">${NEEDS.map(([id, glyph, label]) => `<div class="vital vital-${id}" id="vital-${id}" title="${label}: higher is better"><div class="vital-label">${icon(glyph)}<span>${label}</span><strong id="value-${id}">100</strong></div><div class="meter" role="meter" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100" id="meter-${id}"><span id="bar-${id}"></span></div></div>`).join('')}</div>
        <div class="condition-notes" id="hud-condition-notes"></div>
        <div class="noise-line">${icon('eye')}<span id="hud-stance">Walking</span><span class="noise-meter" id="hud-noise" aria-label="Noise level">${'<i></i>'.repeat(5)}</span></div>
      </aside>
      <nav class="tool-rail" aria-label="Survivor tools">${NAV.map(([id,glyph,label,key]) => `<button data-panel="${id}" class="rail-button" aria-label="${label}" title="${label} · ${key}">${icon(glyph)}<span>${label}</span><kbd>${key}</kbd></button>`).join('')}</nav>
      <aside class="journal panel-surface" id="field-journal">
        <button class="journal-heading" data-ui="journal" aria-expanded="true" aria-controls="journal-content"><span>${icon('journal')}<span class="eyebrow">FIELD JOURNAL</span></span>${icon('down','journal-chevron')}</button>
        <div id="journal-content"><div class="journal-chapter"><span class="chapter-number">01</span><div><h2>One more day.</h2><p>Start with the essentials.</p></div></div>
          <ol class="objectives" id="hud-objectives"></ol>
          <div class="journal-footer"><span id="hud-objective-count">0 / 3 complete</span><span class="objective-progress"><i id="hud-objective-progress"></i></span></div>
        </div>
      </aside>
      <div class="notification-stack" id="hud-notifications" role="status" aria-live="polite" aria-atomic="false"></div>
      <div class="minimap-block"><button class="minimap-button panel-surface" data-panel="map" title="Open local map · M" aria-label="Open local map"><div class="minimap-title"><span class="eyebrow">LOCAL AREA</span><span>N ↑</span></div><canvas id="hud-minimap" width="184" height="150" aria-hidden="true"></canvas><div class="minimap-caption"><span id="hud-coordinates">7, 7</span><kbd>M</kbd></div></button></div>
      <div class="view-tools"><button class="icon-button" data-action="zoomOut" title="Zoom out · −" aria-label="Zoom out">${icon('minus')}</button><span id="hud-zoom">100%</span><button class="icon-button" data-action="zoomIn" title="Zoom in · +" aria-label="Zoom in">${icon('plus')}</button><span class="tool-divider"></span><button class="icon-button" data-action="sound" id="hud-sound" title="Toggle sound" aria-label="Mute sound">${icon('sound')}</button></div>
      <div class="interaction-hint" id="hud-interaction"></div>
      <section class="quick-access" aria-label="Quick access"><div class="quick-access-caption"><span>QUICK ACCESS</span><span class="caption-line"></span></div><div class="hotbar" id="hud-hotbar"></div></section>
      <footer class="hud-footer"><div class="control-hints"><span><kbd>W A S D</kbd> Move</span><span><kbd>SHIFT</kbd> Sprint</span><span><kbd>CLICK</kbd> Attack</span><button data-panel="help" class="text-button">All controls ${icon('help')}</button></div><button class="save-indicator text-button" id="hud-save" data-action="save" title="Save now">${icon('save')}<span>Autosave enabled</span></button></footer>
      <div id="modal-root"></div>
      <input id="save-import-input" type="file" accept=".json,application/json" hidden aria-label="Import a saved survivor">
    `;
    this._click = event => this._handleClick(event);
    this._change = event => this._handleChange(event);
    this._keydown = event => this._handleKeydown(event);
    this.root.addEventListener('click', this._click);
    this.root.addEventListener('change', this._change);
    document.addEventListener('keydown', this._keydown);
    this.update(this.game.state, true);
    return this;
  }

  _set(id, text) {
    if (this._cache.get(id) === String(text)) return;
    const element = document.getElementById(id);
    if (element) { element.textContent = text; this._cache.set(id, String(text)); }
  }

  update(state, force = false) {
    if (!this.root || this._destroyed || !state?.player) return;
    const now = performance.now();
    if (!force && now - this._lastUpdate < 100) return;
    this._lastUpdate = now;
    const p = state.player;
    const minutes = ((Math.floor(state.time || 0) % 1440) + 1440) % 1440;
    this._set('hud-time', `${pad(minutes / 60)}:${pad(minutes % 60)}`);
    this._set('hud-day', `DAY ${pad(state.day || 1)}`);
    this._set('hud-location', title(state.location || this.game.world?.getTile?.(p.x, p.y)?.room || 'The outskirts'));
    this._set('hud-temperature', `${Math.round(state.weather?.temperature ?? 16)}° C`);
    const weather = state.weather?.type || 'overcast';
    this._set('hud-weather', title(weather));
    if (weather !== this._weather) {
      this._weather = weather;
      document.getElementById('hud-weather-icon').innerHTML = icon(/rain|storm/i.test(weather) ? 'rain' : /clear|sun/i.test(weather) ? 'sun' : 'cloud');
    }
    for (const [id] of NEEDS) {
      const value = clamp(p[id]);
      this._set(`value-${id}`, Math.ceil(value));
      document.getElementById(`bar-${id}`).style.width = `${value}%`;
      document.getElementById(`meter-${id}`).setAttribute('aria-valuenow', String(Math.ceil(value)));
      document.getElementById(`vital-${id}`).classList.toggle('is-low', value < 25);
    }
    const condition = state.dead ? 'Deceased' : p.bleeding > 0 ? 'Bleeding' : p.infection > 0 ? 'Infected' : p.health < 30 ? 'Critical' : p.health < 65 ? 'Injured' : 'Stable';
    this._set('hud-condition', condition);
    document.getElementById('hud-condition').classList.toggle('danger-text', condition !== 'Stable');
    const warnings = [p.bleeding > 0 && 'Bleeding · use a bandage', p.infection > 0 && 'Infection', p.thirst < 20 && 'Dehydrated', p.hunger < 20 && 'Starving', p.energy < 20 && 'Exhausted'].filter(Boolean);
    this._set('hud-condition-notes', warnings.join(' / '));
    this._set('hud-stance', state.resting ? 'Resting' : state.sneaking ? 'Sneaking' : state.running ? 'Sprinting' : p.moving ? 'Walking' : 'Standing still');
    const noise = Math.min(5, Math.ceil((state.noise || 0) / 2.4));
    Array.from(document.getElementById('hud-noise').children).forEach((e, i) => e.classList.toggle('active', i < noise));
    const objectives = [
      ['looted','Scavenge supplies','Search a nearby container'],
      ['crafted','Make something useful','Craft a tool or bandage'],
      ['barricaded','Secure your shelter','Barricade a door or window'],
    ];
    const completed = objectives.filter(([id]) => (state.objectives?.[id] || 0) > 0).length;
    const objectiveKey = objectives.map(([id]) => Boolean(state.objectives?.[id])).join(',');
    if (objectiveKey !== this._objectiveKey) {
      this._objectiveKey = objectiveKey;
      document.getElementById('hud-objectives').innerHTML = objectives.map(([id,label,desc]) => `<li class="${state.objectives?.[id] > 0 ? 'complete' : ''}"><span class="objective-check">${state.objectives?.[id] > 0 ? icon('check') : ''}</span><div><strong>${label}</strong><p>${desc}</p></div></li>`).join('');
      this._set('hud-objective-count', `${completed} / 3 complete`);
      document.getElementById('hud-objective-progress').style.width = `${completed / 3 * 100}%`;
    }
    const sound = state.settings?.sound !== false;
    if (sound !== this._sound) {
      this._sound = sound;
      const button = document.getElementById('hud-sound');
      button.innerHTML = icon(sound ? 'sound' : 'muted');
      button.setAttribute('aria-label', sound ? 'Mute sound' : 'Enable sound');
      button.setAttribute('aria-pressed', String(sound));
    }
    this._set('hud-zoom', `${Math.round((state.render?.zoom || this.game.renderer?.zoom || 1) * 100)}%`);
    this._set('hud-coordinates', `${Math.floor(p.x)}, ${Math.floor(p.y)}`);
    this._renderSaveStatus(state);
    this._renderHotbar(state);
    this._renderInteraction(state);
    this._renderToasts(now);
    if (state.dead && this.panel !== 'death') this._openDeath();
    if (!state.dead && this.panel === 'death') this.close(true);
    if (state.paused && !this.panel && !state.dead) this.toggle('pause');
    if (this.panel) this._renderPanel(state);
    if (now - this._lastMap > (this.panel === 'map' ? 400 : 1100) || force) {
      this._lastMap = now;
      this._drawMap(document.getElementById('hud-minimap'), state, 21, false);
      if (this.panel === 'map') this._drawMap(document.getElementById('full-map'), state, 42, true);
    }
  }

  _renderSaveStatus(state) {
    const status = this._saveStatus || state.saveStatus || 'Autosave enabled';
    let label = status;
    if (status === 'saved' || /^Saved/i.test(status)) {
      const seconds = Math.max(0, Math.floor((Date.now() - (state.savedAt || Date.now())) / 1000));
      label = seconds < 8 ? 'Saved just now' : seconds < 60 ? `Saved ${seconds}s ago` : `Saved ${Math.floor(seconds / 60)}m ago`;
    } else if (status === 'saving') label = 'Saving…';
    else if (status === 'error') label = 'Save failed · export backup';
    const button = document.getElementById('hud-save');
    button.classList.toggle('save-error', /error|failed|unavailable/i.test(status));
    if (button.lastElementChild.textContent !== label) button.lastElementChild.textContent = label;
  }

  setSaveStatus(status) { this._saveStatus = status; this._lastUpdate = -Infinity; }

  _renderHotbar(state) {
    const p = state.player;
    const count = id => (p.inventory || []).filter(i => i.id === id).reduce((sum,i) => sum + i.qty,0);
    const weapon = p.equipped || 'bat';
    const entries = [[weapon,1,'attack',''],['water',2,'use','water'],['beans',3,'use','beans'],['bandage',4,'use','bandage']];
    const signature = `${weapon}|${entries.map(([id]) => count(id)).join(',')}`;
    if (signature === this._hotbarKey) return;
    this._hotbarKey = signature;
    document.getElementById('hud-hotbar').innerHTML = entries.map(([id,key,action,payload], index) => {
      const qty = count(id), item = this.game.getItem(id);
      return `<button class="hotbar-slot ${index === 0 ? 'equipped' : ''} ${qty === 0 ? 'empty' : ''}" data-action="${action}" ${payload ? `data-payload="${payload}"` : ''} title="${esc(item.name)} · ${key}${index === 0 ? ' attack' : ' use'}" aria-label="${index === 0 ? 'Attack with' : 'Use'} ${esc(item.name)}" ${qty === 0 ? 'disabled' : ''}><kbd>${key}</kbd>${icon(id)}<span class="slot-quantity">${index === 0 ? icon('check') : '×' + qty}</span><span class="slot-label">${index === 0 ? 'Equipped' : id === 'beans' ? 'Eat' : id === 'water' ? 'Drink' : 'Heal'}</span></button>`;
    }).join('') + `<button class="hotbar-slot inventory-slot" data-panel="inventory" title="Inventory · I / 5" aria-label="Open inventory"><kbd>5</kbd>${icon('bag')}<span class="slot-label">Inventory</span></button>`;
  }

  _renderInteraction(state) {
    const nearby = state.nearby;
    let html = '';
    if (state.resting) html = `<span class="interaction-icon">${icon('moon')}</span><div><strong>Taking a breath</strong><span>Restoring energy · move to stop</span></div>`;
    else if (nearby) {
      const loot = nearby.loot?.some(i => i.qty > 0) && !nearby.looted;
      const opening = ['door','window'].includes(nearby.type);
      const label = nearby.label || title(nearby.type);
      let verb = loot ? 'Search' : opening ? nearby.barricaded ? 'Barricaded' : nearby.open ? 'Close' : 'Open' : nearby.type === 'bed' ? 'Rest' : 'Interact';
      html = `<button class="interaction-primary" data-action="interact"><kbd>E</kbd><div><strong>${esc(label)}</strong><span>${verb}${loot ? ' for supplies' : ''}</span></div></button>${opening ? `<button class="interaction-secondary" data-action="barricade" title="${nearby.barricaded ? 'Remove barricade' : 'Requires hammer, 1 plank, 4 nails'}"><kbd>B</kbd>${nearby.barricaded ? 'Remove plank' : 'Barricade'}</button>` : ''}`;
    }
    const element = document.getElementById('hud-interaction');
    if (this._interactionKey !== html) { element.innerHTML = html; element.classList.toggle('visible', Boolean(html)); this._interactionKey = html; }
  }

  notify(text) {
    if (!text) return;
    const now = performance.now();
    if (this.toasts.at(-1)?.text === String(text) && now - this.toasts.at(-1).at < 1000) return;
    this.toasts.push({text: String(text), at: now, id: ++this._toastId});
    this.toasts = this.toasts.slice(-3);
    if (this.root) this._renderToasts(now);
  }

  _renderToasts(now) {
    this.toasts = this.toasts.filter(toast => now - toast.at < 5400);
    const key = this.toasts.map(t => t.id).join(',');
    if (key === this._toastKey) return;
    this._toastKey = key;
    document.getElementById('hud-notifications').innerHTML = this.toasts.map(toast => `<div class="toast">${icon('chevron')}<span>${esc(toast.text)}</span></div>`).join('');
  }

  toggle(panel) {
    if (this._transition || this._destroyed) return;
    if (panel === 'close' || !panel) { this.close(); return; }
    if (!['inventory','crafting','skills','map','help','pause','death'].includes(panel)) return;
    if (this.game.state.dead && panel !== 'death') return;
    if (this.panel === panel) { this.close(); return; }
    if (!this.panel) {
      this._resumeOnClose = !this.game.state.paused || panel === 'pause';
      this._previousFocus = document.activeElement;
    }
    this.panel = panel;
    this._confirmRestart = false;
    this._modalSignature = '';
    this._transition = true;
    this.game.action('pause', {source:'ui'});
    this._transition = false;
    this.root.classList.add('has-modal');
    this._renderPanel(this.game.state, true);
    requestAnimationFrame(() => document.querySelector('#modal-root .modal-close, #modal-root button')?.focus());
  }

  close(forceResume = false) {
    if (this.panel === 'death' && this.game.state.dead) return;
    const resume = forceResume || this._resumeOnClose || this.panel === 'pause';
    this.panel = null;
    this._modalSignature = '';
    this._confirmRestart = false;
    if (this.root) { document.getElementById('modal-root').innerHTML = ''; this.root.classList.remove('has-modal'); }
    this._transition = true;
    if (resume) this.game.action('resume', {source:'ui'});
    this._transition = false;
    this._previousFocus?.isConnected ? this._previousFocus.focus({preventScroll:true}) : this.game.canvas?.focus({preventScroll:true});
  }

  _openDeath() {
    this.panel = 'death'; this._modalSignature = ''; this.root.classList.add('has-modal');
    requestAnimationFrame(() => document.querySelector('.modal-death button')?.focus());
  }

  _renderPanel(state, force = false) {
    if (!this.panel) return;
    const p = state.player;
    const loot = this.panel === 'inventory' ? (this.game.getNearbyLoot?.() || []) : [];
    const recipes = this.panel === 'crafting' ? (this.game.getRecipes?.() || []) : [];
    const signature = JSON.stringify([this.panel,this.category,this.selected,this._confirmRestart,p.inventory,p.equipped,p.skills,loot,recipes.map(r=>r.canCraft),state.settings?.sound,state.dead]);
    if (!force && signature === this._modalSignature) return;
    this._modalSignature = signature;
    const titles = {inventory:['YOUR BELONGINGS','Inventory'],crafting:['RECIPES & CONSTRUCTION','Crafting'],skills:['EXPERIENCE','Survivor skills'],map:['NEARBY TERRAIN','Local map'],help:['A SURVIVOR’S FIELD GUIDE','Controls & survival'],pause:['SURVIVOR OPTIONS','Game paused'],death:['SURVIVOR RECORD','Your survivor has fallen.']};
    const [eyebrow, heading] = titles[this.panel];
    const oldContent = document.querySelector('.modal-content');
    const scrollTop = oldContent?.scrollTop || 0;
    const active = document.activeElement;
    const focusKey = active?.dataset?.focusKey;
    const nav = !['pause','death','help'].includes(this.panel) ? `<nav class="modal-tabs" aria-label="Survivor panels">${NAV.map(([id,glyph,label,key])=>`<button class="${this.panel === id ? 'active' : ''}" data-panel="${id}" ${this.panel===id?'aria-current="page"':''}>${icon(glyph)}${label}<kbd>${key}</kbd></button>`).join('')}</nav>` : '';
    const body = this.panel === 'inventory' ? this._inventory(p,loot) : this.panel === 'crafting' ? this._crafting(p,recipes) : this.panel === 'skills' ? this._skills(p) : this.panel === 'map' ? this._mapPanel(p) : this.panel === 'help' ? this._help() : this.panel === 'death' ? this._death(state) : this._pause(state);
    document.getElementById('modal-root').innerHTML = `<div class="modal-backdrop" data-backdrop="true"><section class="modal modal-${this.panel}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal-header"><div><p class="eyebrow">${eyebrow}</p><h2 id="modal-title">${heading}</h2></div>${this.panel !== 'death' ? `<button class="icon-button modal-close" data-ui="close" aria-label="Close panel" title="Close · Escape">${icon('close')}</button>` : icon('skull','death-symbol')}</header>${nav}<div class="modal-content">${body}</div>${this.panel !== 'death' ? `<footer class="modal-footer"><span>${icon('pause')} Simulation paused</span><button class="text-button" data-ui="resume">Return to survival <kbd>ESC</kbd></button></footer>` : ''}</section></div>`;
    document.querySelector('.modal-content').scrollTop = scrollTop;
    if (focusKey) Array.from(document.querySelectorAll('[data-focus-key]')).find(el => el.dataset.focusKey === focusKey)?.focus({preventScroll:true});
    if (this.panel === 'map') this._drawMap(document.getElementById('full-map'),state,42,true);
  }

  _inventory(player, loot) {
    const inventory = player.inventory || [];
    const weight = inventory.reduce((sum,item) => sum + (this.game.getItem(item.id).weight || 0) * item.qty,0);
    const categories = [['all','All items'],['supply','Supplies'],['gear','Equipment'],['material','Materials']];
    const filtered = inventory.filter(item => {const c=this.game.getItem(item.id).category?.toLowerCase();return this.category==='all'||this.category==='supply'&&['consumable','medical','supply'].includes(c)||this.category==='gear'&&['weapon','tool','ammunition'].includes(c)||this.category==='material'&&c==='material';});
    const selectedEntry = inventory.find(i => i.id === this.selected) || filtered[0];
    const selected = selectedEntry ? this.game.getItem(selectedEntry.id) : null;
    const selectedId = selectedEntry?.id;
    const action = WEAPONS.has(selectedId) ? 'equip' : CONSUMABLES.has(selectedId) ? 'use' : null;
    return `<div class="inventory-toolbar"><span>${icon('bag')} Backpack <strong>${inventory.reduce((n,i)=>n+i.qty,0)} items</strong></span><span class="muted">Carried weight <strong>${weight.toFixed(1)} kg</strong></span></div>
      <div class="inventory-layout"><div class="backpack"><div class="filter-row">${categories.map(([id,label])=>`<button data-ui="filter" data-value="${id}" class="filter-button ${this.category===id?'active':''}" data-focus-key="filter-${id}">${label}</button>`).join('')}</div>
      <div class="item-grid">${filtered.length ? filtered.map(entry=>{const item=this.game.getItem(entry.id);return `<button class="item-card ${selectedId===entry.id?'selected':''}" data-ui="select" data-value="${esc(entry.id)}" data-focus-key="item-${esc(entry.id)}" aria-pressed="${selectedId===entry.id}"><span class="item-quantity">×${entry.qty}</span><span class="item-art">${icon(entry.id)}</span><strong>${esc(item.name)}</strong><span>${player.equipped===entry.id?'<span class="equipped-text">Equipped</span>':esc(item.category)}</span></button>`;}).join('') : '<div class="empty-state">No items in this category.</div>'}</div>
      ${selected ? `<div class="item-detail"><div class="detail-icon">${icon(selectedId)}</div><div><span class="eyebrow">${esc(selected.category)} · ${Number(selected.weight || 0).toFixed(2)} KG EACH</span><h3>${esc(selected.name)}</h3><p>${esc(selected.description)}</p></div>${action?`<button class="button button-primary" data-action="${action}" data-payload="${esc(selectedId)}" data-focus-key="item-use" ${action==='equip'&&player.equipped===selectedId?'disabled':''}>${action==='equip'?(player.equipped===selectedId?'Equipped':'Equip'):selectedId==='water'?'Drink':selectedId==='beans'?'Eat':'Apply'} ${icon(action==='equip'?'check':'chevron')}</button>`:''}</div>`:''}</div>
      <aside class="nearby-loot"><div class="section-topline"><h3>Within reach</h3>${icon('target')}</div><p class="muted">${loot.length ? 'Supplies in a nearby container.' : 'Move close to furniture or a container to find supplies.'}</p><div class="loot-items">${loot.map(i=>`<div>${icon(i.id)}<span>${esc(this.game.getItem(i.id).name)}</span><strong>×${i.qty}</strong></div>`).join('') || `<div class="loot-empty">${icon('bag')}<span>Nothing nearby</span></div>`}</div><button class="button button-primary loot-button" data-action="loot" data-focus-key="loot-all" ${loot.length?'':'disabled'}>${icon('bag')} Take all <kbd>F</kbd></button><p class="small-note">Keep water and a clean bandage close.</p></aside></div>`;
  }

  _crafting(player, recipes) {
    const count = id => (player.inventory || []).filter(i=>i.id===id).reduce((sum,i)=>sum+i.qty,0);
    return `<p class="panel-intro">A few scavenged parts can make the difference. Craft supplies from the materials in your backpack.</p><div class="recipe-list">${recipes.length ? recipes.map(recipe=>`<article class="recipe-card"><div class="recipe-icon">${icon(recipe.result.id)}</div><div class="recipe-info"><span class="eyebrow">MAKES ${recipe.result.qty} · ${esc(this.game.getItem(recipe.result.id).category)}</span><h3>${esc(recipe.name)}</h3><p>${esc(recipe.description)}</p><div class="recipe-ingredients">${recipe.ingredients.map(i=>`<span class="ingredient ${count(i.id)>=i.qty?'available':'missing'}">${icon(i.id)}${esc(this.game.getItem(i.id).name)} <strong>${count(i.id)} / ${i.qty}</strong></span>`).join('')}</div></div><button class="button ${recipe.canCraft?'button-primary':''}" data-action="craft" data-payload="${esc(recipe.id)}" data-focus-key="craft-${esc(recipe.id)}" ${recipe.canCraft?'':'disabled'}>${icon('craft')} Craft</button></article>`).join('') : '<div class="empty-state">No recipes available.</div>'}</div><div class="field-tip build-tip">${icon('home')}<p><strong>Build a wooden barrier.</strong> Place a barrier on the tile in front of you. Requires 2 planks, 4 nails, and a hammer. Use <kbd>X</kbd> to dismantle nearby furniture.</p><button class="button button-primary" data-action="build" data-focus-key="build-barrier" ${count('plank')>=2&&count('nails')>=4&&count('hammer')>=1?'':'disabled'}>Build barrier <kbd>V</kbd></button></div><div class="field-tip">${icon('shield')}<p><strong>Secure an opening.</strong> Stand beside a door or window and press <kbd>B</kbd>. A hammer, one plank, and four nails make a barricade.</p></div>`;
  }

  _skills(player) {
    const skills = [['strength','bat','Strength','Build experience through combat.'],['fitness','bolt','Fitness','Build experience by sprinting and exploring.'],['crafting','craft','Crafting','Build experience by crafting supplies and barricading openings.']];
    return `<p class="panel-intro">Every hard-earned lesson stays with this survivor. Experience is gained by doing.</p><div class="skills-list">${skills.map(([id,glyph,name,description])=>{const xp=Math.max(0,Number(player.skills?.[id])||0);return `<article class="skill-card"><div class="skill-icon">${icon(glyph)}</div><div><div class="skill-heading"><h3>${name}</h3><span><strong>${Math.floor(xp)}</strong> XP</span></div><p>${description}</p><div class="skill-ticks" aria-label="${Math.floor(xp)} experience">${Array.from({length:10},(_,i)=>`<span style="--fill:${Math.max(0,Math.min(100,(xp%100-i*10)*10))}%"></span>`).join('')}</div><span class="small-note">${Math.floor(xp / 100) * 100}–${Math.floor(xp / 100) * 100 + 100} experience milestone</span></div></article>`;}).join('')}</div><div class="survivor-stats"><div><strong>${player.kills||0}</strong><span>Infected killed</span></div><div><strong>${Math.floor(this.game.state.stats?.distance||0)}</strong><span>Tiles travelled</span></div><div><strong>${Math.max(0,(this.game.state.day||1)-1)}</strong><span>Days survived</span></div></div>`;
  }

  _mapPanel(player) {
    return `<div class="map-toolbar"><span>${icon('pin')} ${esc(title(this.game.state.location||'The outskirts'))}</span><span class="mono">${Math.floor(player.x)}, ${Math.floor(player.y)}</span></div><div class="large-map"><canvas id="full-map" width="900" height="560" aria-label="Local terrain map with your position and nearby infected"></canvas><span class="map-north">N<br>↑</span><span class="map-scale">84 × 84 tiles</span></div><div class="map-legend"><span><i class="legend-player"></i>You</span><span><i class="legend-building"></i>Buildings</span><span><i class="legend-road"></i>Roads</span><span><i class="legend-hostile"></i>Nearby infected</span></div><p class="small-note">Local terrain around your current position. Infected are shown within 12 tiles.</p>`;
  }

  _help() {
    const groups = [
      ['Movement',[['W A S D / ↑ ↓ ← →','Move'],['SHIFT','Sprint · uses stamina'],['HOLD Z','Sneak · make less noise'],['R','Rest · movement interrupts']]],
      ['Interaction',[['MOUSE','Aim'],['CLICK / SPACE / 1','Attack'],['E','Search / open / close'],['F','Take all nearby supplies'],['B','Add / remove a barricade'],['V','Build a wooden barrier'],['X','Dismantle nearby furniture']]],
      ['Survivor',[['I / 5','Inventory'],['C','Crafting'],['K','Skills'],['M','Local map'],['2 / 3 / 4','Drink / eat / bandage']]],
      ['Game',[['ESC / P','Pause / resume'],['WHEEL / + / −','Zoom in / out'],['H','Open this field guide']]],
    ];
    return `<div class="help-intro"><span class="help-intro-icon">${icon('home')}</span><div><h3>Getting started</h3><p>Search the safehouse, collect supplies, and secure an opening before you head into town. Keep an eye on your needs and leave yourself a way out.</p></div></div><div class="control-groups">${groups.map(([name,keys])=>`<section><h3>${name}</h3>${keys.map(([key,label])=>`<div class="key-row"><span>${label}</span><kbd>${key}</kbd></div>`).join('')}</section>`).join('')}</div><div class="field-tip">${icon('eye')}<p>Running and gunshots attract the infected. Walk when you can, sneak when you must, and rest somewhere safe. Higher survival meters are better.</p></div><p class="small-note">Your survivor and world save automatically in this browser. Export a backup from the pause menu to keep a copy.</p>`;
  }

  _pause(state) {
    return `<div class="pause-intro"><p>The world can wait a moment.</p><span class="muted">Day ${state.day||1} · ${esc(title(state.location||'The outskirts'))}</span></div><button class="button button-primary resume-button" data-ui="resume">${icon('play')} Return to survival <kbd>ESC</kbd></button><div class="pause-actions"><button class="button" data-action="save" data-focus-key="save-now">${icon('save')} Save now</button><button class="button" data-panel="help">${icon('help')} Controls & survival</button><button class="button" data-action="export">${icon('export')} Export survivor</button><button class="button" data-ui="import">${icon('import')} Import survivor</button><button class="button" data-action="sound" data-focus-key="sound">${icon(state.settings?.sound===false?'muted':'sound')} Sound <span class="button-value">${state.settings?.sound===false?'Off':'On'}</span></button><button class="button" data-panel="skills">${icon('skills')} Survivor skills</button></div><p class="small-note">Progress saves automatically in this browser. Importing replaces the current survivor.</p>${this._confirmRestart?`<div class="restart-confirm"><p>Start a new story? This replaces your current survivor and world.</p><div><button class="button" data-ui="cancel-restart">Keep surviving</button><button class="button button-danger" data-action="restart">Start over</button></div></div>`:`<button class="text-button restart-link" data-ui="confirm-restart">Start a new survivor ${icon('chevron')}</button>`}`;
  }

  _death(state) {
    const minutes = Math.max(0,Math.floor(state.elapsed||0));
    return `<p class="death-copy">The town carries on without you.</p><div class="death-stats"><div><strong>${Math.max(0,(state.day||1)-1)}</strong><span>Days survived</span></div><div><strong>${state.player.kills||0}</strong><span>Infected killed</span></div><div><strong>${pad(minutes/60)}:${pad(minutes%60)}</strong><span>Time played</span></div></div><p class="muted">A fresh start. The same unforgiving streets.</p><button class="button button-primary resume-button" data-action="restart">${icon('play')} Begin a new story</button><button class="text-button death-export" data-action="export">${icon('export')} Export this survivor</button>`;
  }

  _drawMap(canvas, state, radius, large) {
    if (!canvas || !this.game.world) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const width=canvas.width,height=canvas.height,p=state.player,size=Math.min(width,height)/(radius*2),originX=width/2-p.x*size,originY=height/2-p.y*size;
    ctx.fillStyle='#1d2421';ctx.fillRect(0,0,width,height);
    const colors={grass:'#303a30',road:'#484b44',floor:'#7a7360',sidewalk:'#636357',dirt:'#514c38'};
    const world=this.game.world,vis=this.game.visibility;
    // Only ground the survivor has seen is drawn; the rest of the map stays blank.
    const explored=(x,y)=>!vis||vis.memory.has(x,y)||Boolean(vis.field?.entry(x,y));
    const tiles=(world.getVisibleTiles?.(p.x,p.y,radius)||[]).filter(t=>explored(t.x,t.y));
    for(const tile of tiles){const x=originX+tile.x*size,y=originY+tile.y*size;if(x<-size||y<-size||x>width||y>height)continue;ctx.fillStyle=colors[tile.type]||colors.grass;ctx.fillRect(Math.floor(x),Math.floor(y),Math.ceil(size)+.2,Math.ceil(size)+.2);}
    const props=world.getProps?.(p.x,p.y,radius)||[];
    for(const prop of props){if(!explored(prop.x,prop.y))continue;if(!['wall','door','window','tree','car','fence'].includes(prop.type))continue;ctx.fillStyle=prop.type==='wall'?'#a19a81':prop.type==='tree'?'#222e23':prop.type==='door'||prop.type==='window'?'#b08f58':'#5a665a';ctx.fillRect(originX+prop.x*size,originY+prop.y*size,Math.max(1,size*(prop.w||1)),Math.max(1,size*(prop.h||1)));}
    ctx.strokeStyle='rgba(205,206,174,.07)';ctx.lineWidth=1;
    for(let x=Math.floor(p.x-radius);x<p.x+radius;x+=8){ctx.beginPath();ctx.moveTo(originX+x*size,0);ctx.lineTo(originX+x*size,height);ctx.stroke();}
    for(let y=Math.floor(p.y-radius);y<p.y+radius;y+=8){ctx.beginPath();ctx.moveTo(0,originY+y*size);ctx.lineTo(width,originY+y*size);ctx.stroke();}
    for(const zombie of state.zombies||[]){if(zombie.health<=0||Math.hypot(zombie.x-p.x,zombie.y-p.y)>12)continue;if(this.game.visibility?.field&&this.game.visibility.field.entityState(zombie.x,zombie.y)!=='full')continue;ctx.fillStyle='#cf7970';ctx.beginPath();ctx.arc(originX+zombie.x*size,originY+zombie.y*size,large?3:2,0,Math.PI*2);ctx.fill();}
    const px=width/2,py=height/2;
    ctx.strokeStyle='rgba(225,202,153,.2)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(px,py,large?19:12,0,Math.PI*2);ctx.stroke();
    ctx.save();ctx.translate(px,py);ctx.rotate(Math.atan2(p.dirY||0,p.dirX||1)+Math.PI/2);ctx.fillStyle='#edce8f';ctx.shadowColor='#161b15';ctx.shadowBlur=5;ctx.beginPath();const marker=large?8:5;ctx.moveTo(0,-marker);ctx.lineTo(marker*.75,marker*.7);ctx.lineTo(0,marker*.3);ctx.lineTo(-marker*.75,marker*.7);ctx.closePath();ctx.fill();ctx.restore();
    const gradient=ctx.createRadialGradient(px,py,Math.min(width,height)*.2,px,py,Math.max(width,height)*.65);gradient.addColorStop(0,'transparent');gradient.addColorStop(1,'rgba(12,17,13,.55)');ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
  }

  async _handleClick(event) {
    const target=event.target.closest('button');
    if (!target || target.disabled) { if(event.target.dataset.backdrop && this.panel!=='death')this.close();return; }
    if (target.dataset.panel) { await this.game.action(target.dataset.panel); return; }
    const command=target.dataset.ui;
    if(command==='close'){this.close();return;}
    if(command==='resume'){this.close(true);return;}
    if(command==='journal'){this.journalOpen=!this.journalOpen;document.getElementById('field-journal').classList.toggle('collapsed',!this.journalOpen);target.setAttribute('aria-expanded',String(this.journalOpen));return;}
    if(command==='filter'){this.category=target.dataset.value;this.selected=null;this._renderPanel(this.game.state,true);return;}
    if(command==='select'){this.selected=target.dataset.value;this._renderPanel(this.game.state,true);return;}
    if(command==='import'){document.getElementById('save-import-input').click();return;}
    if(command==='confirm-restart'||command==='cancel-restart'){this._confirmRestart=command==='confirm-restart';this._renderPanel(this.game.state,true);return;}
    if(target.dataset.action){
      target.disabled=true;
      try{await this.game.action(target.dataset.action,target.dataset.payload);}
      catch(error){this.notify(error?.message||'That action could not be completed.');}
      finally{if(target.isConnected)target.disabled=false;this.update(this.game.state,true);}
    }
  }

  async _handleChange(event) {
    if(event.target.id!=='save-import-input'||!event.target.files?.length)return;
    const file=event.target.files[0];
    try{await this.game.action('import',file);}catch(error){this.notify(error?.message||'Could not import this survivor.');}
    event.target.value='';
  }

  _handleKeydown(event) {
    if (!this.panel || event.key !== 'Tab') return;
    const focusable=Array.from(document.querySelectorAll('#modal-root button:not([disabled]), #modal-root [tabindex="0"]'));
    if(!focusable.length)return;
    const first=focusable[0],last=focusable.at(-1);
    if(event.shiftKey&&(document.activeElement===first||!focusable.includes(document.activeElement))){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&(document.activeElement===last||!focusable.includes(document.activeElement))){event.preventDefault();first.focus();}
  }

  destroy() {
    this._destroyed=true;
    this.root?.removeEventListener('click',this._click);
    this.root?.removeEventListener('change',this._change);
    document.removeEventListener('keydown',this._keydown);
    if(this.root){this.root.innerHTML='';this.root.classList.remove('has-modal');}
    this.root=null;this.toasts=[];this._cache.clear();
  }
}

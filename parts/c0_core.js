/* ============================================================
   LUMORA — c0_core: utils, input, save, achievements
   ============================================================ */
const TAU = Math.PI * 2;
const T = 48; // tile size (px)

const U = {
  clamp: (v, a, b) => v < a ? a : (v > b ? b : v),
  lerp: (a, b, t) => a + (b - a) * t,
  damp: (a, b, lambda, dt) => U.lerp(a, b, 1 - Math.exp(-lambda * dt)),
  rand: (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a),
  randInt: (a, b) => Math.floor(U.rand(a, b + 1)),
  pick: arr => arr[Math.floor(Math.random() * arr.length)],
  dist: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1),
  overlaps: (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y,
  fmtTime(ms) {
    const t = Math.max(0, Math.floor(ms));
    const m = Math.floor(t / 60000), s = Math.floor((t % 60000) / 1000), d = Math.floor((t % 1000) / 10);
    return m + ':' + String(s).padStart(2, '0') + '.' + String(d).padStart(2, '0');
  },
  esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
};

/* Layer constants — the heart of NEXORA */
const LY = { MATERIA: 0, ENERGY: 1, INVERSE: 2, SHADOW: 3 };
const LAYER_META = [
  { id: 0, key: 'MATERIA', fa: 'لایه مادی', color: '#59f2e0' },
  { id: 1, key: 'ENERGY', fa: 'لایه انرژی', color: '#f472b6' },
  { id: 2, key: 'INVERSE', fa: 'لایه وارونه', color: '#ffd76a' },
  { id: 3, key: 'SHADOW', fa: 'لایه سایه', color: '#9f7aea' },
];

/* ---------------- DDA — hidden adaptive difficulty ----------------
   Silently rates the player from deaths/wins/timing (no UI, no prompt)
   and scales enemies/boss so the game stays beatable but challenging. */
const DDA = {
  MIN: 0.15, MAX: 1.0,
  band() { const s = DDA.skill(); return s < 0.35 ? 'novice' : (s > 0.7 ? 'veteran' : 'normal'); },
  skill() { return (Save.data.dda && Save.data.dda.skill) || 0.5; },
  onDeath() {
    const d = Save.data.dda; if (!d) return;
    d.deaths++; d.streak--; d.skill = Math.max(DDA.MIN, d.skill - 0.045); Save.saveSoon();
  },
  onWin(ms, par) {
    const d = Save.data.dda; if (!d) return;
    d.wins++; d.streak++;
    let delta = 0.05;
    if (par && ms) { if (ms <= par) delta += 0.02; else if (ms > par * 1.5) delta -= 0.02; }
    d.skill = Math.min(DDA.MAX, d.skill + delta); Save.saveSoon();
  },
  /* multipliers — skill 0.15 → easiest, 1.0 → full challenge */
  mEnemySpeed() { const s = DDA.skill(); return 0.78 + 0.34 * s; },
  mFireRate() { const s = DDA.skill(); return 1.5 - 0.65 * s; },
  mBossHp() { const s = DDA.skill(); return 0.8 + 0.5 * s; },
  mProjectiles() { const s = DDA.skill(); return Math.round(4 + 3.2 * s); },
};

/* ---------------- Input ---------------- */
const Input = {
  down: new Set(), pressed: new Set(), virtual: {},
  _map: {
    left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
    jump: ['Space', 'KeyW', 'ArrowUp', 'KeyZ'],
    slide: ['ShiftLeft', 'ShiftRight', 'KeyS', 'ArrowDown'],
    switchPrev: ['KeyQ'], switchNext: ['KeyE', 'KeyX'],
    pause: ['Escape', 'KeyP'],
    layer1: ['Digit1'], layer2: ['Digit2'], layer3: ['Digit3'], layer4: ['Digit4'],
  },
  _inText(el) {
    if (!el || !el.tagName) return false;
    const t = el.tagName;
    return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || el.isContentEditable;
  },
  applyBindings() { // user keybinds from settings (null = defaults)
    const b = (typeof Save !== 'undefined' && Save.data && Save.data.settings && Save.data.settings.bindings) || null;
    if (!b) { for (const a in Input._defaults) Input._map[a] = Input._defaults[a].slice(); return; }
    for (const a in Input._defaults) {
      Input._map[a] = (Array.isArray(b[a]) && b[a].length) ? b[a].slice() : Input._defaults[a].slice();
    }
  },
  _defaults: null,
  init() {
    window.addEventListener('keydown', e => {
      if (e.repeat || Input._inText(e.target)) return; // never steal typing (chat, name, settings)
      const c = e.code;
      Input.down.add(c); Input.pressed.add(c);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(c)) e.preventDefault();
    });
    window.addEventListener('keyup', e => { if (!Input._inText(e.target)) Input.down.delete(e.code); });
    window.addEventListener('blur', () => { Input.down.clear(); });
    Input._defaults = JSON.parse(JSON.stringify(Input._map));
    Input.applyBindings();
  },
  isDown(action) {
    if (Input.virtual[action]) return true;
    const codes = Input._map[action];
    if (!codes) return false;
    for (const c of codes) if (Input.down.has(c)) return true;
    return false;
  },
  wasPressed(action) {
    const codes = Input._map[action];
    if (!codes) return false;
    for (const c of codes) if (Input.pressed.has(c)) return true;
    return false;
  },
  endFrame() { Input.pressed.clear(); },
  // touch buttons call these
  vPress(action) { Input.virtual[action] = true; Input.pressed.add('V:' + action); },
  vRelease(action) { Input.virtual[action] = false; },
  wasVPressed(action) { return Input.pressed.has('V:' + action); },
};

/* ---------------- Save ---------------- */
const SAVE_KEY = 'lumora.save.v1';
const Save = {
  data: null, _t: 0,
  fresh() {
    return {
      ver: 1,
      settings: { music: 0.75, sfx: 0.9, shake: true, particles: 'high', touch: 'auto', lang: 'fa', fps: false, crt: false, signaling: '', motion: true },
      coins: 0,
      shop: { owned: ['sk-default', 'ht-none', 'cp-none', 'tr-none', 'au-none'], equipped: { skin: 'sk-default', hat: 'ht-none', cape: 'cp-none', trail: 'tr-none', aura: 'au-none' } },
      dda: { skill: 0.5, deaths: 0, wins: 0, streak: 0 },
      ghosts: {},
      missions: null,
      daily: null,
      progress: { levels: {}, unlockedWorlds: 1 },
      stats: { crystals: 0, switches: 0, doubleJumps: 0, shadowTime: 0, inverseTime: 0, deaths: 0, orbs: 0, playTime: 0, perfect: 0, defeated: 0 },
      ach: {},
    };
  },
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) { Save.data = Object.assign(Save.fresh(), JSON.parse(raw)); }
      else Save.data = Save.fresh();
    } catch (e) { Save.data = Save.fresh(); }
    // deep-merge missing keys
    const f = Save.fresh();
    for (const k of Object.keys(f)) if (Save.data[k] === undefined) Save.data[k] = f[k];
    for (const k of Object.keys(f.settings)) if (Save.data.settings[k] === undefined) Save.data.settings[k] = f.settings[k];
    for (const k of Object.keys(f.stats)) if (Save.data.stats[k] === undefined) Save.data.stats[k] = f.stats[k];
    if (!Save.data.shop || !Save.data.shop.owned) Save.data.shop = { owned: ['sk-default', 'ht-none', 'cp-none', 'tr-none', 'au-none'], equipped: { skin: 'sk-default', hat: 'ht-none', cape: 'cp-none', trail: 'tr-none', aura: 'au-none' } };
    if (!Save.data.dda) Save.data.dda = { skill: 0.5, deaths: 0, wins: 0, streak: 0 };
    const e0 = Save.data.shop.equipped = Save.data.shop.equipped || {};
    Save.data.shop.equipped = { skin: e0.skin || 'sk-default', hat: e0.hat || 'ht-none', cape: e0.cape || 'cp-none', trail: e0.trail || 'tr-none', aura: e0.aura || 'au-none' };
    if (typeof Save.data.coins !== 'number') Save.data.coins = 0;
    if (!Save.data.progress.levels) Save.data.progress.levels = {};
    return Save.data;
  },
  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(Save.data)); } catch (e) { /* private mode */ }
  },
  saveSoon() { clearTimeout(Save._t); Save._t = setTimeout(Save.save, 400); },
  reset() { Save.data = Save.fresh(); Save.save(); },
  level(id) {
    const L = Save.data.progress.levels;
    if (!L[id]) L[id] = { done: false, best: 0, crystals: {}, orb: false, score: 0, rank: '' };
    return L[id];
  },
  crystalsIn(id) { const r = Save.level(id); return Object.keys(r.crystals).length; },
  isUnlocked(w, idx) { // world w (1-based), level idx (0-based)
    if (w > Save.data.progress.unlockedWorlds) return false;
    if (idx === 0) return true;
    return Save.level(w + '-' + idx).done;
  },
  worldUnlocked(w) { return w <= Save.data.progress.unlockedWorlds; },
};

/* Abilities unlock from progression */
const Abilities = {
  defs: [
    { id: 'doubleJump', fa: 'گام منشوری', en: 'PRISM STEP', after: '1-1', icon: 'jump' },
    { id: 'slide', fa: 'سُرِ پژواک', en: 'ECHO SLIDE', after: '1-2', icon: 'slide' },
    { id: 'wallClimb', fa: 'چسبیدن به دیوار', en: 'CLING', after: '2-1', icon: 'climb' },
    { id: 'overcharge', fa: 'اَبشارژ نکسورا', en: 'OVERCHARGE', after: '2-2', icon: 'bolt' },
  ],
  has(id) {
    const d = Abilities.defs.find(x => x.id === id);
    if (!d) return false;
    return !!Save.level(d.after).done;
  },
  maxEnergy() { return Abilities.has('overcharge') ? 130 : 100; },
  regenRate() { return Abilities.has('overcharge') ? 7 : 5; },
};

/* ---------------- Achievements ---------------- */
const ACH = {
  defs: [
    { id: 'first_light', fa: 'نور نخستین', en: 'FIRST LIGHT', de: 'Complete your first level.', desc: 'اولین مرحله را کامل کن.', icon: 'M12 2 L20 12 L12 22 L4 12 Z' },
    { id: 'layer_walker', fa: 'راهرونده لایه‌ها', en: 'LAYER WALKER', de: 'Travel between layers 50 times.', desc: '۵۰ بار بین لایه‌ها سفر کن.', icon: 'M12 3 L15 9 L12 21 L9 9 Z M4 9 h4 M16 9 h4' },
    { id: 'crystal_heart', fa: 'قلب کریستالی', en: 'CRYSTAL HEART', de: 'Collect 100 crystals.', desc: '۱۰۰ کریستال جمع کن.', icon: 'M12 21 C5 14 3 9 7 6 C9 5 11 6 12 8 C13 6 15 5 17 6 C21 9 19 14 12 21 Z' },
    { id: 'untouchable', fa: 'دست‌نیافتنی', en: 'UNTOUCHABLE', de: 'Finish a level without taking damage.', desc: 'یک مرحله را بدون آسیب کامل کن.', icon: 'M12 3 a9 9 0 1 0 0 18 a9 9 0 1 0 0-18 M8 12 h8' },
    { id: 'speedrunner', fa: 'تندرو', en: 'SPEEDRUNNER', de: 'Beat a level under par time.', desc: 'رکورد زمان یک مرحله را زیر پار ثبت کن.', icon: 'M12 21 a8 8 0 1 1 0-16 a8 8 0 0 1 0 16 Z M12 9 v4 l3 2' },
    { id: 'secret_seeker', fa: 'جست‌وجوگر رازها', en: 'SECRET SEEKER', de: 'Find 5 Lumara orbs.', desc: '۵ گوی لومارا را پیدا کن.', icon: 'M15 9 a6 6 0 1 0 -6 6 M11 11 a3 3 0 1 1 3 -3' },
    { id: 'double_trouble', fa: 'پرش دوبل', en: 'DOUBLE TROUBLE', de: 'Perform 100 double jumps.', desc: '۱۰۰ بار پرش دوم بزن.', icon: 'M6 18 Q12 4 18 18 M12 8 v6' },
    { id: 'shadow_dancer', fa: 'رقصنده سایه', en: 'SHADOW DANCER', desc: '۶۰ ثانیه در لایه سایه بمان.', icon: 'M4 12 h16 M12 4 v16 M6 6 l3 3 M18 6 l-3 3' },
    { id: 'gravity_well', fa: 'چاه گرانش', en: 'GRAVITY WELL', desc: '۶۰ ثانیه در لایه وارونه بمان.', icon: 'M12 4 v8 M7 12 a5 5 0 0 0 10 0 M12 20 h.01' },
    { id: 'world_wanderer', fa: 'سیاح جهان‌ها', en: 'WORLD WANDERER', desc: 'همه جهان‌ها را باز کن.', icon: 'M12 3 a9 9 0 1 0 0 18 a9 9 0 0 0 0-18 M3 12 h18 M12 3 c3 3 3 15 0 18' },
    { id: 'wardens_fall', fa: 'سقوط نگهبان', en: "WARDEN'S FALL", desc: 'نگهبان لایه‌ها را شکست بده.', icon: 'M5 5 l6 6 M19 5 l-6 6 M5 19 l6 -6 M19 19 l-6 -6 M12 9 v6' },
    { id: 'lumora_ascendant', fa: 'لومورای بلندمرتبه', en: 'ASCENDANT', desc: 'همه مراحل، همه کریستال‌ها و همه گوی‌ها.', icon: 'M12 2 L14 9 L21 9 L15.5 13.5 L17.5 21 L12 16.5 L6.5 21 L8.5 13.5 L3 9 L10 9 Z' },
  ],
  unlock(id) {
    if (Save.data.ach[id]) return false;
    Save.data.ach[id] = true; Save.saveSoon();
    Save.data.coins = (Save.data.coins || 0) + 80;
    const d = ACH.defs.find(a => a.id === id);
    if (d && typeof UI !== 'undefined') UI.toast(d.fa, 'دستاورد باز شد — ' + d.en, 'gold');
    if (typeof AudioSys !== 'undefined') AudioSys.sfx('unlock');
    return true;
  },
  check() {
    const s = Save.data.stats, P = Save.data.progress;
    const totalCrystals = LEVELS.reduce((n, l) => n + Object.keys(Save.level(l.id).crystals).length, 0);
    const totalOrbs = LEVELS.reduce((n, l) => n + (Save.level(l.id).orb ? 1 : 0), 0);
    const allDone = LEVELS.every(l => Save.level(l.id).done);
    const maxCrystals = LEVELS.reduce((n, l) => n + l.crystals.length, 0);
    const cond = {
      first_light: Save.level('1-1').done,
      layer_walker: s.switches >= 50,
      crystal_heart: totalCrystals >= 100 || s.crystals >= 100,
      untouchable: s.perfect >= 1,
      speedrunner: LEVELS.some(l => { const r = Save.level(l.id); return r.done && r.best > 0 && l.par && r.best <= l.par * 1000; }),
      secret_seeker: totalOrbs >= 5 || s.orbs >= 5,
      double_trouble: s.doubleJumps >= 100,
      shadow_dancer: s.shadowTime >= 60,
      gravity_well: s.inverseTime >= 60,
      world_wanderer: P.unlockedWorlds >= 5,
      wardens_fall: s.defeated >= 1,
      lumora_ascendant: allDone && totalCrystals >= maxCrystals && totalOrbs >= LEVELS.length,
    };
    for (const id in cond) if (cond[id]) ACH.unlock(id);
  },
};

/* API exposed for tests (node) and debugging (browser) */
const API = {
  U, LY, LAYER_META, Input, Save, Abilities, ACH,
  get LEVELS() { return typeof LEVELS !== 'undefined' ? LEVELS : []; },
  get WORLDS() { return typeof WORLDS !== 'undefined' ? WORLDS : []; },
  validateLevels: () => typeof validateLevels !== 'undefined' ? validateLevels() : [],
  headlessRun: (id, sec, script) => typeof headlessRun !== 'undefined' ? headlessRun(id, sec, script) : null,
  get Game() { return typeof Game !== 'undefined' ? Game : null; },
  levelDef: id => typeof levelDef !== 'undefined' ? levelDef(id) : null,
  get InfiniteGen() { return typeof InfiniteGen !== 'undefined' ? InfiniteGen : null; },
  get Shots() { return typeof Shots !== 'undefined' ? Shots : null; },
  hazardHit: (...a) => typeof hazardHit !== 'undefined' ? hazardHit(...a) : null,
  buildWorld: d => typeof buildWorld !== 'undefined' ? buildWorld(d) : null,
  get MP() { return typeof MP !== 'undefined' ? MP : null; },
};
if (typeof window !== 'undefined') { window.LUM = API; window.Input = Input;  window.DDA = DDA; }

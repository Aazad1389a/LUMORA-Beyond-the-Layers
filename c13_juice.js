/* ============================================================
   LUMORA — c13_juice: REMASTER layer v3.0
   • Juice — slow-motion, zoom pulse, chromatic aberration, speed lines
   • Combo — chain crystals within a window → multiplier + score
   • Scorer — level score + S/A/B/C/D rank
   • Ghost — records best run, replays it as a translucent rival
   • Missions — 3 rotating daily challenges with coin rewards
   • Daily — seeded "run of the day" (same level for everyone)
   Runtime-only module: safe in headless tests (DOM calls guarded).
   ============================================================ */

/* ---------- Juice: full-screen cinematic FX ---------- */
const Juice = {
  tScale: 1, tTarget: 1, tHold: 0,
  zoom: 1, zoomT: 0, aberr: 0, speedT: 0,
  slowmo(scale, hold) {
    if (Save.data && Save.data.settings && Save.data.settings.motion === false) return;
    Juice.tTarget = scale; Juice.tHold = hold;
  },
  pulse(z) {
    if (Save.data && Save.data.settings && Save.data.settings.motion === false) return;
    Juice.zoom = z; Juice.zoomT = 1;
  },
  hit(ab) {
    if (Save.data && Save.data.settings && Save.data.settings.motion === false) return;
    Juice.aberr = Math.max(Juice.aberr, ab);
  },
  update(dt) {
    if (Juice.tHold > 0) { Juice.tHold -= dt; Juice.tScale = Juice.tTarget; }
    else Juice.tScale = U.damp(Juice.tScale, 1, 3.2, dt);
    Juice.zoomT = Math.max(0, Juice.zoomT - dt * 1.7);
    Juice.aberr = Math.max(0, Juice.aberr - dt * 2.2);
  },
  /* zoom pulse around screen center — applied to the world pass */
  ctxApply(ctx, view) {
    if (Juice.zoomT <= 0.001) return;
    const z = 1 + (Juice.zoom - 1) * Juice.zoomT * Juice.zoomT;
    ctx.translate(view.w / 2, view.h / 2);
    ctx.scale(z, z);
    ctx.translate(-view.w / 2, -view.h / 2);
  },
  /* chromatic aberration: two additive offset blits of the frame itself */
  drawAberr(ctx, view) {
    if (Juice.aberr <= 0.02) return;
    const cnv = ctx.canvas, off = 5 * Juice.aberr * DPRS.s;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.14 * Juice.aberr;
    try {
      ctx.drawImage(cnv, -off, 0, cnv.width, cnv.height, -off / DPRS.s, 0, view.w, view.h);
      ctx.drawImage(cnv, off, 0, cnv.width, cnv.height, off / DPRS.s, 0, view.w, view.h);
    } catch (e) { /* cross-origin or size race — ignore */ }
    ctx.restore();
  },
  /* anime speed-lines when really moving */
  drawSpeed(ctx, view, p) {
    if (!Save.data || !Save.data.settings || Save.data.settings.motion === false) return;
    if (typeof PerfMon !== 'undefined' && PerfMon.level > 0) return;
    const spd = p ? Math.abs(p.vx || 0) : 0;
    if (spd < 430 && Juice.speedT <= 0) return;
    Juice.speedT = spd > 430 ? 0.12 : Juice.speedT - 0.016;
    const a = U.clamp((spd - 390) / 340, 0, 0.3) * Math.min(1, Juice.speedT / 0.06);
    const now = performance.now();
    ctx.save();
    ctx.strokeStyle = 'rgba(214,232,255,0.85)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 11; i++) {
      const y = ((i * 83 + now * 0.22) % view.h + view.h) % view.h;
      const len = 55 + (i % 4) * 44;
      const dir = (p && p.vx < 0) ? 1 : -1;
      const x = ((i * 173 + now * (0.9 + (i % 3) * 0.35)) % (view.w + 260) + view.w + 260) % (view.w + 260) - 130;
      ctx.globalAlpha = a * (0.35 + (i % 3) * 0.28);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len * dir, y); ctx.stroke();
    }
    ctx.restore();
  },
};

/* ---------- Combo: chained pickups → multiplier ---------- */
const Combo = {
  n: 0, t: 0, best: 0, WINDOW: 2.6,
  mult() { return Math.min(4, 1 + 0.25 * Math.max(0, Combo.n - 1)); },
  bump(x, y, weight) {
    Combo.n += weight;
    Combo.t = Combo.WINDOW;
    Combo.best = Math.max(Combo.best, Combo.n);
    const mult = Combo.mult();
    Game.score = (Game.score || 0) + Math.round(100 * mult);
    AudioSys.sfx('combo', Combo.n);
    Parts.wave(x, y, '#ffd76a', 60 + Math.min(240, Combo.n * 10));
    if (Combo.n >= 5) Juice.pulse(1.02);
    UI.syncCombo(Combo.n, mult, 1);
    Missions.event('combo', Combo.n);
  },
  onCrystal(x, y) { Combo.bump(x, y, 1); },
  onOrb(x, y) { Combo.bump(x, y, 3); },
  update(dt) {
    if (Combo.t <= 0) return;
    Combo.t -= dt;
    if (Combo.t <= 0) { Combo.n = 0; UI.syncCombo(0, 1, 0); }
    else UI.syncCombo(Combo.n, Combo.mult(), Combo.t / Combo.WINDOW);
  },
  reset() { Combo.n = 0; Combo.t = 0; Combo.best = 0; UI.syncCombo(0, 1, 0); },
};

/* ---------- Scorer: score + S/A/B/C/D rank ---------- */
const Scorer = {
  RANKS: ['S', 'A', 'B', 'C', 'D'],
  better(a, b) { return Scorer.RANKS.indexOf(a) < Scorer.RANKS.indexOf(b); },
  finalize() {
    const L = Game.level;
    const rec = Save.level(L.id);
    const cryN = Object.keys(rec.crystals).length, cryT = L.crystals.length;
    let s = Game.score || 0;
    s += cryN * 150;
    if (cryN === cryT && cryT > 0) s += 500;
    if (Game.damageTaken === 0 && (Game.deathsRun || 0) === 0) s += 400;
    s += Math.max(0, Math.round((L.par * 1.6 - Game.levelTime) * 12));
    s += Math.min(Combo.best, 12) * 120;
    Game.score = s;
    return s;
  },
  rank(score, L) {
    const base = L.crystals.length * 150 + 400;
    if (score >= base * 2.0) return 'S';
    if (score >= base * 1.6) return 'A';
    if (score >= base * 1.25) return 'B';
    if (score >= base * 0.9) return 'C';
    return 'D';
  },
};

/* ---------- Ghost: race your best run ---------- */
const Ghost = {
  buf: [], acc: 0, INTERVAL: 0.15, CAP: 900, replay: null,
  recordable() {
    const id = Game.level && Game.level.id;
    return id && !Game.level.infinite && /^\d+-\d+$/.test(id);
  },
  start() { Ghost.buf = []; Ghost.acc = 0; },
  tick(dt, p) {
    if (!Ghost.recordable() || p.dead) return;
    Ghost.acc += dt;
    if (Ghost.acc >= Ghost.INTERVAL && Ghost.buf.length < Ghost.CAP) {
      Ghost.acc = 0;
      const m = p.curLayer * 10 + (p.gravSign < 0 ? 5 : 0) + (p.face < 0 ? 2 : 0) + (p.sliding ? 1 : 0);
      Ghost.buf.push(Math.round(p.x), Math.round(p.y), m);
    }
  },
  /* save when this run beat the record */
  save(id, ms) {
    if (!Ghost.recordable()) return;
    const rec = Save.level(id);
    if (ms <= (rec.best || Infinity) && Ghost.buf.length > 12) { // <=: the record run itself becomes the ghost
      try { Save.data.ghosts[id] = { t: Math.round(ms), p: Ghost.buf }; } catch (e) { /* quota */ }
    }
  },
  decode(m) {
    return { layer: Math.floor(m / 10), gs: (m % 10) >= 5 ? -1 : 1, face: ((m % 10) % 5) >= 2 ? -1 : 1, slide: (m % 2) === 1 };
  },
  startReplay(id) {
    const g = Save.data.ghosts && Save.data.ghosts[id];
    if (g && g.p && g.p.length >= 9) Ghost.replay = { pts: g.p, t: 0, i: 0, best: g.t };
    else Ghost.replay = null;
    if (Ghost.replay) {
      UI.toast('روح رکورد 👻', I18N.lang === 'en' ? 'Racing the ghost of your best run!' : 'با روحِ بهترین رکورد خودت مسابقه می‌دهی!', 'cy');
    }
  },
  stopReplay() { Ghost.replay = null; },
  update(dt) {
    const R = Ghost.replay;
    if (!R) return;
    R.t += dt;
    R.i = Math.min(R.pts.length / 3 - 1, Math.floor(R.t / Ghost.INTERVAL));
    if (R.i >= R.pts.length / 3 - 1) {
      Ghost.replay = null;
      UI.toast('روح رکورد', I18N.lang === 'en' ? 'The ghost finished — can you beat it?' : 'روح زودتر رسید — دفعه‌ی بعد سبقت بگیر!', 'gold');
    }
  },
  cur() {
    const R = Ghost.replay;
    if (!R) return null;
    const i3 = R.i * 3;
    const ax = R.pts[i3], ay = R.pts[i3 + 1], am = Ghost.decode(R.pts[i3 + 2]);
    const j3 = (Math.min(R.pts.length / 3 - 1, R.i + 1)) * 3;
    const bx = R.pts[j3], by = R.pts[j3 + 1];
    const k = (R.t / Ghost.INTERVAL) % 1;
    return { x: ax + (bx - ax) * k, y: ay + (by - ay) * k, m: am };
  },
};

/* ---------- Missions: 3 rotating daily challenges ---------- */
const Missions = {
  POOL: [
    { id: 'cry15', fa: '۱۵ کریستال جمع کن', en: 'Collect 15 crystals', goal: 15, ev: 'crystal', reward: 60 },
    { id: 'cry40', fa: '۴۰ کریستال جمع کن', en: 'Collect 40 crystals', goal: 40, ev: 'crystal', reward: 130 },
    { id: 'nodeath', fa: 'یک مرحله را بدون آسیب و مرگ تمام کن', en: 'Finish a level unhurt', goal: 1, ev: 'nodeath', reward: 90 },
    { id: 'combo6', fa: 'به کمبو ×۶ برس', en: 'Reach a ×6 combo', goal: 6, ev: 'combo', reward: 100 },
    { id: 'orb1', fa: 'یک گوی لومارا پیدا کن', en: 'Find a LUMARA orb', goal: 1, ev: 'orb', reward: 110 },
    { id: 'win2', fa: '۲ مرحله را تمام کن', en: 'Finish 2 levels', goal: 2, ev: 'win', reward: 90 },
    { id: 'srank', fa: 'یک رتبه‌ی S بگیر', en: 'Earn an S rank', goal: 1, ev: 'rankS', reward: 160 },
    { id: 'switch20', fa: '۲۰ بار لایه عوض کن', en: 'Shift layers 20 times', goal: 20, ev: 'switch', reward: 80 },
    { id: 'stomp5', fa: '۵ دشمن را با لگد نابود کن', en: 'Stomp 5 enemies', goal: 5, ev: 'stomp', reward: 90 },
    { id: 'underpar', fa: 'یک مرحله را زیر پارِ زمان تمام کن', en: 'Beat a level under par', goal: 1, ev: 'underpar', reward: 120 },
  ],
  ensure() {
    const today = new Date().toISOString().slice(0, 10);
    const M = Save.data.missions;
    if (M && M.date === today && M.list && M.list.length === 3) return;
    const rnd = seedRng(parseInt(today.split('-').join(''), 10) || 42);
    const pool = Missions.POOL.slice();
    const picks = [];
    while (picks.length < 3 && pool.length) picks.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    Save.data.missions = { date: today, list: picks.map(p => ({ id: p.id, prog: 0, done: false })) };
    Save.saveSoon();
  },
  def(id) { return Missions.POOL.find(p => p.id === id); },
  event(ev, val) {
    Missions.ensure();
    const M = Save.data.missions;
    let changed = false;
    for (const m of M.list) {
      if (m.done) continue;
      const d = Missions.def(m.id);
      if (!d || d.ev !== ev) continue;
      m.prog = (ev === 'combo') ? Math.max(m.prog, val || 0) : m.prog + (val || 1);
      if (m.prog >= d.goal) {
        m.done = true; m.prog = d.goal; changed = true;
        Coins.add(d.reward, true);
        AudioSys.sfx('rankS');
        UI.toast('ماموریت کامل شد 🎯', (I18N.lang === 'en' ? d.en : d.fa) + ' — 🪙 +' + d.reward, 'gold');
      }
    }
    if (changed) Save.saveSoon();
  },
};

/* ---------- Daily: run of the day (shared seed) ---------- */
const Daily = {
  stamp() { const d = new Date(); return '' + d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2); },
  id() { return 'INF-MP' + Daily.stamp(); },
  start() { AudioSys.sfx('uiClick'); Game.startLevel(Daily.id()); },
  best() { const D = Save.data.daily; return (D && D.id === Daily.id() && D.best) || 0; },
  record(ms) {
    const id = Daily.id();
    const D = Save.data.daily;
    if (!D || D.id !== id) Save.data.daily = { id, best: Math.round(ms) };
    else D.best = Math.min(D.best || Infinity, Math.round(ms));
    Save.saveSoon();
  },
  isDaily() { return Game.level && Game.level.id === Daily.id(); },
};

/* ---------- game hooks (assigned onto Game) ---------- */
Game.deathsRun = 0;
Game.score = 0;
Game.timeScale = 1;

const _killPlayer = Game.killPlayer.bind(Game);
Game.killPlayer = function () {
  const was = Game.player && Game.player.dead;
  _killPlayer();
  if (!was && Game.player && Game.player.dead) {
    Game.deathsRun++;
    Juice.slowmo(0.3, 0.5);
    Juice.hit(0.85);
    Combo.reset();
  }
};

Game.remasterStartLevel = function () {
  Game.score = 0; Game.deathsRun = 0;
  Combo.reset();
  Ghost.start();
  UI.syncScore && UI.syncScore(0);
  if (typeof UI.syncMissionHud === 'function') UI.syncMissionHud();
  Ghost.startReplay(Game.level.id);
};

Game.remasterComplete = function (first, rec, ms, par) {
  const score = Scorer.finalize();
  const rank = Scorer.rank(score, Game.level);
  if (!rec.score || score > rec.score) rec.score = score;
  if (!rec.rank || Scorer.better(rank, rec.rank)) rec.rank = rank;
  if (rank === 'S') Missions.event('rankS');
  Missions.event('win');
  if (Game.damageTaken === 0 && Game.deathsRun === 0) Missions.event('nodeath');
  if (ms <= par * 1000) Missions.event('underpar');
  Ghost.save(Game.level.id, ms);
  if (Daily.isDaily()) Daily.record(ms);
  Juice.pulse(1.07);
  if (rank === 'S') { AudioSys.sfx('rankS'); Juice.slowmo(0.45, 0.35); }
  return { score, rank };
};

Game.remasterDraw = function (ctx, view, p) {
  Juice.drawAberr(ctx, view);
  Juice.drawSpeed(ctx, view, p);
};

if (typeof API !== 'undefined') { API.Coins = typeof Coins !== 'undefined' ? Coins : null; API.makeEnemy = typeof makeEnemy !== 'undefined' ? makeEnemy : null; API.Player = typeof Player !== 'undefined' ? Player : null; API.buildWorld = typeof buildWorld !== 'undefined' ? buildWorld : null; API.Juice = Juice; API.Combo = Combo; API.Scorer = Scorer; API.Ghost = Ghost; API.Missions = Missions; API.Daily = Daily; }
if (typeof window !== 'undefined') { window.Juice = Juice; window.Combo = Combo; window.Missions = Missions; window.Ghost = Ghost; window.Daily = Daily; }

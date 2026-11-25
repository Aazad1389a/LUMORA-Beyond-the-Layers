/* ============================================================
   LUMORA — c7_main: game state machine, loop, boot
   ============================================================ */
const Game = {
  state: 'boot', canvas: null, ctx: null, dpr: 1, dprCap: 2,
  view: { w: 1280, h: 720, s: 1, camx: 0, camy: 0 },
  world: null, player: null, level: null,
  levelTime: 0, hitstop: 0, deathT: 0, damageTaken: 0,
  menuT: 0, tGlobal: 0, lastFrame: 0, running: false,

  /* ---------- boot ---------- */
  boot() {
    Game.canvas = document.getElementById('game');
    Game.ctx = Game.canvas.getContext('2d');
    Input.init();
    Save.load();
    UI.init();
    UI.applyTouch();
    if (typeof MP !== 'undefined') MP.init();
    Game.resize();
    window.addEventListener('resize', () => Game.resize());
    window.addEventListener('beforeunload', () => Save.save());
    document.addEventListener('visibilitychange', () => { if (document.hidden) Save.save(); });

    const start = () => {
      if (Game.state !== 'boot') return;
      AudioSys.init(); AudioSys.resume();
      Game.setState('menu');
      AudioSys.playMusic('menu');
      UI.refreshMenuStats();
    };
    document.getElementById('scr-splash').addEventListener('click', start);
    window.addEventListener('keydown', start, { once: false });
    window.addEventListener('pointerdown', start, { once: false });
    setInterval(() => { if (Save.data) Save.save(); }, 12000);
    Game.running = true;
    Game.lastFrame = performance.now();
    requestAnimationFrame(Game.loop);
  },

  /* REMOTE UPDATE CHECK: the game is one static HTML file. When the operator
     replaces the hosted file (new data-build stamp), players already in the
     menu get a non-blocking "update available" toast — one refresh ships it. */
  _lastUC: 0,
  _updateNotified: false,
  checkRemoteUpdate() {
    if (this._updateNotified) return; // one toast per session is enough
    if (Date.now() - this._lastUC < 60000) return; // throttle: max 1 probe/min
    this._lastUC = Date.now();
    if (typeof location === 'undefined' || typeof fetch !== 'function') return;
    if (!location.protocol.startsWith('http')) return; // file:// — no remote to compare
    const mine = document.documentElement.getAttribute('data-build') || '';
    setTimeout(() => {
      fetch(location.href, { cache: 'no-store' }).then(r => r.ok ? r.text() : Promise.reject(0)).then(t => {
        const m = t.match(/data-build="([^"]+)"/);
        if (m && m[1] && m[1] !== mine) {
          const en = typeof I18N !== 'undefined' && I18N.lang === 'en';
          this._updateNotified = true;
          UI.toast(en ? 'UPDATE AVAILABLE' : 'بروزرسانی در دسترس',
            en ? 'New version ' + m[1] + ' is live — reload the page to update.' : 'نسخه‌ی ' + m[1] + ' منتشر شده — صفحه را دوباره باز کن تا بروز شود.', 'gold');
          AudioSys.sfx('goal');
          Parts.wave(innerWidth / 2, innerHeight / 2, '#ffd76a', 220);
        }
      }).catch(() => {});
    }, 2500);
  },

  setState(s) {
    Game.state = s;
    if (s === 'menu') { UI.show('scr-menu'); UI.hud(false); UI.refreshMenuStats(); this.checkRemoteUpdate(); }
    if (s === 'play') { UI.hideAll(); UI.hud(true); }
    if (s === 'paused') UI.show('scr-pause');
  },

  resize() {
    const cssW = window.innerWidth, cssH = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, Game.dprCap || 2);
    Game.dpr = dpr;
    const c = Game.canvas;
    if (!c) return;
    c.width = Math.round(cssW * dpr); c.height = Math.round(cssH * dpr);
    c.style.width = cssW + 'px'; c.style.height = cssH + 'px';
    const s = cssH / 720;
    Game.view.s = s; Game.view.w = cssW / s; Game.view.h = 720;
    DPRS.s = dpr * s;
  },

  /* ---------- level flow ---------- */
  startLevel(id) {
    const def = levelDef(id);
    if (!def) return;
    Game.level = def;
    Game.world = buildWorld(def);
    Game.player = new Player(Game.world);
    Game.levelTime = 0; Game.damageTaken = 0; Game.deathT = 0;
    Shots.clear(); Parts.list.length = 0;
    Game.world.curLayer = def.layerStart || 0;
    Cam.update(0.016, { x: Game.player.x, y: Game.player.y, vx: 0 }, Game.view.w, 720, Game.world, true);
    if (def.boss) {
      const b = makeEnemy('boss', def.boss[0] * T, def.boss[1] * T, 0, Game.world);
      Game.world.enemies.push(b); Game.world.boss = b;
    }
    Game.setState('play');
    if (typeof Combo !== 'undefined') Game.remasterStartLevel();
    UI.syncTag(def);
    UI.syncCrystals(Object.keys(Save.level(def.id).crystals).length);
    UI.syncLayer(Game.player.curLayer);
    UI.syncAbilities();
    UI.bossBar(false);
    UI.tip(null);
    let lvlName = I18N.lang === 'en' ? def.name : (def.nameFa || def.name);
    let intro = def.intro || '';
    if (def.infinite) { intro = TR('inf-intro', def.n, def.diff); lvlName = TR('inf-name', def.n); }
    UI.toast(lvlName, intro, 'cy');
    AudioSys.playMusic(def.music);
    Save.saveSoon();
  },
  restartLevel() { Game.startLevel(Game.level.id); },
  nextLevel() {
    const curId = Game.level.id;
    if (curId.startsWith('INF-')) {
      const nn = (parseInt(curId.split('-')[1], 10) || 1) + 1;
      Save.data.infiniteBest = Math.max(Save.data.infiniteBest || 0, nn - 1);
      Save.saveSoon();
      Game.startLevel('INF-' + nn);
      return;
    }
    const idx = LEVELS.findIndex(l => l.id === Game.level.id);
    const nx = LEVELS[idx + 1];
    if (nx) Game.startLevel(nx.id); else Game.toMenu();
  },
  toMenu() {
    Save.save();
    Game.world = null; Game.player = null;
    Parts.list.length = 0; Shots.clear();
    UI.tip(null); UI.bossBar(false);
    Game.setState('menu');
    AudioSys.playMusic('menu');
  },
  togglePause() {
    if (Game.state === 'play') {
      Game.setState('paused');
      UI.el.pauseLevel.textContent = Game.level ? Game.level.id + ' — ' + Game.level.name.toUpperCase() : '';
    } else if (Game.state === 'paused') Game.setState('play');
  },
  switchNext() { if (Game.player) Game.player.switchLayer(1); },

  killPlayer() {
    const p = Game.player;
    if (!p || p.dead) return;
    p.dead = true; Game.deathT = 0.95;
    Juice.slowmo(0.28, 0.5); Juice.hit(0.9);
    Save.data.stats.deaths++;
    if (typeof DDA !== 'undefined') DDA.onDeath();
    AudioSys.sfx('hurt'); AudioSys.sfx('boom');
    Cam.shake(9, 0.4);
    Parts.burst(p.x + 15, p.y + 27, 26, { color: ['#ff6b7a', '#ffd76a', '#fff'], sp0: 100, sp1: 340, l0: 0.4, l1: 0.9, type: 'shard' });
    // death animation: the head is tossed away
    Game.headFx = { x: p.x + 4, y: p.y + 12, vx: -(p.face || 1) * 150 + U.rand(-60, 60), vy: -480, vr: U.rand(-9, 9), rot: 0, t: 0, layer: p.curLayer };
    UI.vignette();
    Save.saveSoon();
  },
  respawn() {
    const p = Game.player, w = Game.world;
    Game.headFx = null;
    const cp = p.checkpoint;
    p.x = cp.x; p.y = cp.y; p.vx = 0; p.vy = 0;
    p.curLayer = cp.layer || 0; p.gravSign = (p.curLayer === LY.INVERSE) ? -1 : 1;
    p.energy = Abilities.maxEnergy(); p.dead = false; p.invuln = 1.6;
    p.sliding = false; p.rideMover = null;
    Shots.clear();
    Cam.update(0.016, p, Game.view.w, 720, w, true);
    UI.syncLayer(p.curLayer);
    Parts.wave(p.x + 15, p.y + 27, LAYER_META[p.curLayer].color, 200);
  },

  completeLevel() {
    const L = Game.level, rec = Save.level(L.id);
    const first = !rec.done;
    rec.done = true;
    const ms = Math.round(Game.levelTime * 1000);
    if (!rec.best || ms < rec.best) rec.best = ms;
    if (Game.damageTaken === 0) Save.data.stats.perfect++;
    // next world unlocks only when EVERY level of this world is done
    const worldLvls = LEVELS.filter(l => l.world === L.world);
    if (worldLvls.every(l => Save.level(l.id).done)) {
      Save.data.progress.unlockedWorlds = Math.max(Save.data.progress.unlockedWorlds, Math.min(10, L.world + 1));
    }
    ACH.check(); Save.save();
    UI.hud(false); UI.tip(null); UI.bossBar(false);
    Game.state = 'complete';
    const cry = Object.keys(rec.crystals).length, cryT = L.crystals.length;
    const par = L.par * 1000;
    const medal = ms <= par ? '🥇' : (ms <= par * 1.4 ? '🥈' : '🥉');
    let rem = { score: 0, rank: '' };
    if (typeof Combo !== 'undefined') {
      rem = Game.remasterComplete(first, rec, ms, par);
    }
    const earned = 40 + (ms <= par ? 25 : 0) + (first ? 20 : 0) + (rem.rank === 'S' ? 80 : rem.rank === 'A' ? 40 : 0);
    Coins.add(earned, true);
    const rb = document.getElementById('rank-badge');
    if (rb && rem.rank) {
      rb.textContent = rem.rank;
      rb.className = 'rank-badge r-' + rem.rank + (rem.rank === 'S' ? ' pop' : '');
      rb.style.display = 'flex';
      rb.setAttribute('title', TR('cs-rank', rem.score));
    } else if (rb) rb.style.display = 'none';
    if (typeof DDA !== 'undefined') DDA.onWin(ms, par);
    if (L.id === '10-3') {
      const vs = document.getElementById('victory-stats'); if (vs) vs.innerHTML =
        Game.statRow(TR('v-time'), U.fmtTime(ms)) + Game.statRow(TR('cs-crystals'), '✦ ' + cry + ' / ' + cryT) +
        Game.statRow(TR('v-switches'), Save.data.stats.switches) + Game.statRow(TR('v-ach'), Object.keys(Save.data.ach).length + ' / ' + ACH.defs.length);
      if (UI.el.hud) UI.show('scr-victory');
      AudioSys.playMusic('menu');
      return;
    }
    const cs = document.getElementById('complete-stats'); if (cs) cs.innerHTML =
      (typeof Combo !== 'undefined' ? '<div class="stat-row rank-row"><span>' + TR('cs-rank', '') + '</span><b class="rank-mini r-' + rem.rank + '">' + rem.rank + '</b></div>' : '') +
      Game.statRow(TR('cs-time'), U.fmtTime(ms) + ' <span class="medal">' + medal + '</span>') +
      Game.statRow(TR('cs-best'), U.fmtTime(rec.best)) +
      Game.statRow(TR('cs-crystals'), '✦ ' + cry + ' / ' + cryT) +
      Game.statRow(TR('cs-orb'), rec.orb ? TR('cs-orb-found') : TR('cs-orb-hidden')) +
      Game.statRow(first ? TR('cs-status') : TR('cs-tip'), first ? TR('cs-new') : (Game.damageTaken === 0 ? TR('cs-perfect') : TR('cs-try-perfect'))) +
      Game.statRow(TR('cs-coins'), '🪙 +' + earned);
    if (UI.el.hud) UI.show('scr-complete');
    AudioSys.sfx('goal');
  },
  statRow(label, val) { return '<div class="stat-row"><span>' + label + '</span><b>' + val + '</b></div>'; },

  checkPickups(p, w, dt) {
    const px = p.x + 15, py = p.y + 27, dtp = dt || 0.016;
    for (const c of w.crystals) {
      if (c.taken) continue;
      // gentle magnet pull toward the player
      const dx = px - c.x, dy = py - c.y, d = Math.hypot(dx, dy);
      if (d < 130 && d > 1) {
        const pull = Math.min(190, 5000 / Math.max(d, 20)) * dtp;
        c.x += dx / d * pull; c.y += dy / d * pull;
      }
      if (Math.abs(c.x - px) < 34 && Math.abs(c.y - py) < 40) {
        c.taken = true;
        const rec = Save.level(w.id);
        rec.crystals[c.id] = true;
        if (c.orb) { rec.orb = true; Save.data.stats.orbs++; Coins.add(60, true); AudioSys.sfx('orb'); UI.toast('گوی لومارا · LUMARA ORB', I18N.lang === 'en' ? 'A secret of the layers revealed' : 'رازی از دل لایه‌ها آشکار شد', 'gold'); if (typeof Combo !== 'undefined') { Combo.onOrb(c.x, c.y); Missions.event('orb'); } }
        else {
          AudioSys.sfx('pickup');
          Coins.add(5, true);
          if (typeof Combo !== 'undefined') { Combo.onCrystal(c.x, c.y); Missions.event('crystal'); }
          p.energy = Math.min(p.max, p.energy + 12);
          Parts.burst(c.x, c.y, 10, { color: ['#59f2e0', '#c8fff4'], sp0: 40, sp1: 160, l0: 0.3, l1: 0.6, type: 'shard', s0: 2, s1: 5 });
        }
        UI.syncCrystals(Object.keys(rec.crystals).length);
        Parts.wave(c.x, c.y, c.orb ? '#ffd76a' : '#59f2e0', c.orb ? 160 : 60);
        ACH.check(); Save.saveSoon();
      }
    }
    // gate
    const g = w.gate;
    if (!g.locked && U.overlaps(p.rect(), g)) {
      Parts.burst(g.x + 26, g.y + 48, 26, { color: ['#ffd76a', '#fff0c0', '#59f2e0'], sp0: 60, sp1: 260, l0: 0.4, l1: 0.9, type: 'shard', s0: 2, s1: 6 });
      Parts.wave(g.x + 26, g.y + 48, '#ffd76a', 220);
      Cam.shake(6);
      Game.hitstop = 0.12;
      Game.completeLevel();
    }
  },

  /* ---------- per-frame update ---------- */
  updatePlay(dt) {
    const w = Game.world, p = Game.player;
    if (!w || !p) return;
    Game.levelTime += dt;
    // tossed-head death animation
    const hf = Game.headFx;
    if (hf) {
      hf.t += dt; hf.vy += 2500 * dt;
      hf.x += hf.vx * dt; hf.y += hf.vy * dt;
      hf.rot += hf.vr * dt;
      if (hf.t > 1.6) Game.headFx = null;
    }
    // multiplayer: local tick + remote ghost interpolation
    if (typeof MP !== 'undefined' && MP.state === 'game') { MP.tickLocal(dt); MP.tickGhosts(dt); MP.tickVoices(); }
    if (typeof NEXORA !== 'undefined') NEXORA.pollGamepad();
    // movers
    for (const m of w.movers) {
      const t = w.time;
      const px = m.x, py = m.y;
      const k = 0.5 + 0.5 * Math.sin(t * TAU / m.period + m.ph);
      m.x = m.bx + m.dx * k; m.y = m.by + m.dy * k;
      m.dxf = m.x - px; m.dyf = m.y - py;
    }
    w.time += dt;
    // player input: layer switching
    if (Input.wasPressed('switchNext') || Input.wasVPressed('switchNext')) p.switchLayer(1);
    if (Input.wasPressed('switchPrev')) p.switchLayer(-1);
    for (let i = 0; i < 4; i++) {
      if (Input.wasPressed('layer' + (i + 1)) && p.curLayer !== i) p.switchLayer(i - p.curLayer);
    }
    if (!p.dead) p.update(dt, w);
    else {
      Game.deathT -= dt;
      if (Game.deathT <= 0) Game.respawn();
    }
    // enemies
    for (const e of w.enemies) e.update(dt, w, p, p.curLayer);
    if (w.boss && !w.boss.dead) {
      const inArena = p.x > w.boss.arenaX0;
      UI.bossBar(inArena);
      if (inArena) {
        UI.syncBoss(Math.max(0, w.boss.hp) / w.boss.maxHp);
        if (Game._bossMusic !== true) { Game._bossMusic = true; AudioSys.playMusic('boss'); }
      }
    }
    Shots.update(dt, w);
    Parts.update(dt);
    Cam.update(dt, p, Game.view.w, 720, w, false);
    if (typeof Combo !== 'undefined') {
      Combo.update(dt);
      Ghost.tick(dt, p);
      Ghost.update(dt);
      if (Game.score !== Game._lastScore) { Game._lastScore = Game.score; UI.syncScore(Game.score); }
    }
    // world-specific ambient particles
    Game._ambT = (Game._ambT || 0) + dt;
    if (Game._ambT > 0.14) {
      Game._ambT = 0;
      const wd = w.def.world;
      const amb = PALETTES[wd] ? PALETTES[wd].amb : '#8fd8ff';
      const x = Cam.x + U.rand(0, Game.view.w), y = Cam.y + U.rand(0, 720);
      if (wd === 2) Parts.spawn({ x, y: Cam.y + 730, vx: U.rand(-10, 10), vy: U.rand(18, 42), life: U.rand(2, 3.5), size: U.rand(1.5, 3), color: amb, type: 'dust' });
      else if (wd === 3) Parts.spawn({ x, y, vx: U.rand(-20, 20), vy: U.rand(-14, 14), life: U.rand(2.5, 4), size: U.rand(2, 4), color: amb, type: 'shard' });
      else Parts.spawn({ x, y, vx: U.rand(-12, 12), vy: U.rand(-30, -10), life: U.rand(1.8, 3.2), size: U.rand(1.5, 3), color: amb, type: 'dust' });
    }
    // signs tip
    let bestSign = null, bestD = 1e9;
    for (const sg of w.signs) {
      const d = Math.abs(sg.x - (p.x + 15));
      if (d < 80 && d < bestD) { bestD = d; bestSign = sg; }
    }
    if (bestSign) {
      const sx = (bestSign.x - Cam.x) * Game.view.s, sy = (bestSign.y - Cam.y) * Game.view.s;
      UI.tip(bestSign.text, sx, sy);
    } else UI.tip(null);
    const tms = (Game.levelTime * 1000) | 0;
    if (tms - (Game._lastTimer === undefined ? -999 : Game._lastTimer) >= 90) { Game._lastTimer = tms; UI.syncTimer(tms); }
  },

  /* ---------- drawing ---------- */
  drawPlay() {
    const ctx = Game.ctx, w = Game.world, p = Game.player, view = Game.view;
    const [shx, shy] = Cam.off();
    const camx = Cam.x + shx, camy = Cam.y + shy;
    view.camx = camx; view.camy = camy;
    view.worldId = w.def.world;
    drawBackground(ctx, w, { x: camx, y: camy }, view.w, view.h, Game.tGlobal);
    ctx.save();
    if (typeof Combo !== 'undefined') Juice.ctxApply(ctx, view);
    ctx.translate(-camx, -camy);
    const pal = PALETTES[w.def.world] || PALETTES[0];
    drawVoidMist(ctx, w, view, Game.tGlobal);
    drawMotes(ctx, w, Game.tGlobal, view);
    for (const d of w.decos) drawDeco(ctx, d, pal, Game.tGlobal, view);
    for (const r of w.solidsAll) drawSolid(ctx, r, p.curLayer, Game.tGlobal, view);
    for (const r of w.solidsByLayer[p.curLayer]) drawSolid(ctx, r, p.curLayer, Game.tGlobal, view);
    drawMovers(ctx, w, p.curLayer, Game.tGlobal, view);
    drawHazards(ctx, w, p.curLayer, Game.tGlobal, view);
    drawCheckpoints(ctx, w, Game.tGlobal, view);
    for (const sg of w.signs) drawSign(ctx, sg, Game.tGlobal, view);
    drawGate(ctx, w, Game.tGlobal, p.curLayer, view);
    drawCrystals(ctx, w, Game.tGlobal, p.curLayer, view);
    for (const e of w.enemies) drawEnemy(ctx, e, Game.tGlobal, p.curLayer, view);
    drawShots(ctx, p.curLayer, view);
    if (typeof MP !== 'undefined' && MP.state === 'game') MP.drawGhosts(ctx, p, Game.tGlobal);
    if (typeof Ghost !== 'undefined' && Ghost.replay) drawGhostRunner(ctx, Ghost.cur(), Game.tGlobal);
    if (!p.dead) drawPlayer(ctx, p, Game.tGlobal);
    if (Game.headFx) drawDeadHead(ctx, Game.headFx);
    Parts.draw(ctx);
    ctx.restore();
    drawLighting(ctx, w, p, view, Game.tGlobal);
    drawForeground(ctx, w.def.world, { x: camx, y: camy }, view.w, view.h, Game.tGlobal);
    drawLayerFX(ctx, p, view, Game.tGlobal);
    if (typeof Combo !== 'undefined') Game.remasterDraw(ctx, view, p);
  },

  drawMenuAmbient(dt) {
    const ctx = Game.ctx, view = Game.view;
    const fakeCam = { x: Game.menuT * 30, y: 0 };
    drawBackground(ctx, { def: { world: 0 } }, fakeCam, view.w, view.h, Game.menuT);
    // floating diamonds
    if (Math.random() < 0.08) {
      Parts.spawn({ x: U.rand(0, view.w), y: view.h + 20, vx: U.rand(-10, 10), vy: U.rand(-40, -16), life: U.rand(3, 6), size: U.rand(3, 7), color: U.pick(['rgba(89,242,224,0.5)', 'rgba(255,215,106,0.45)', 'rgba(167,139,250,0.4)']), type: 'shard' });
    }
    Parts.update(dt);
    ctx.save();
    Parts.draw(ctx);
    ctx.restore();
    // soft light columns
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const x = view.w * (0.25 + 0.25 * i) + Math.sin(Game.menuT * 0.4 + i * 2) * 60;
      const g2 = ctx.createLinearGradient(x, 0, x, view.h);
      g2.addColorStop(0, 'rgba(89,242,224,0.06)'); g2.addColorStop(1, 'rgba(89,242,224,0)');
      ctx.fillStyle = g2; ctx.fillRect(x - 90, 0, 180, view.h);
    }
    ctx.restore();
  },

  loop(now) {
    requestAnimationFrame(Game.loop);
    let dt = (now - Game.lastFrame) / 1000;
    Game.lastFrame = now;
    if (Save.data.settings.fps) {
      Game.fpsAcc = (Game.fpsAcc || 0) + dt; Game.fpsN = (Game.fpsN || 0) + 1;
      if (Game.fpsAcc >= 0.5) {
        const el = document.getElementById('fps-counter');
        if (el) el.textContent = Math.round(Game.fpsN / Game.fpsAcc) + ' FPS';
        Game.fpsAcc = 0; Game.fpsN = 0;
      }
    }
    dt = Math.min(dt, 1 / 30);
    if (dt <= 0) return;
    if (typeof document !== 'undefined' && document.hidden) { return; } // save battery: full pause when tab hidden
    Game.tGlobal += dt;
    const ctx = Game.ctx;
    if (!ctx) return;
    ctx.setTransform(Game.dpr * Game.view.s, 0, 0, Game.dpr * Game.view.s, 0, 0);
    ctx.clearRect(0, 0, Game.view.w, Game.view.h);

    if (Game.state === 'boot') {
      Game.menuT += dt;
      Game.drawMenuAmbient(dt);
    } else if (Game.state === 'menu' || Game.state === 'victory' || Game.state === 'complete') {
      Game.menuT += dt;
      Game.drawMenuAmbient(dt);
    } else if (Game.state === 'play') {
      if (Game.hitstop > 0) {
        Game.hitstop -= dt;
      } else {
        // real-time substeps: frame-rate independent physics, no slow-motion
        const ts = (typeof Juice !== 'undefined') ? Juice.tScale : 1;
        const sdt = dt * ts;
        Juice.update(dt); // juice itself runs on real time
        const n = Math.min(8, Math.max(1, Math.ceil(sdt / (1 / 60))));
        const h = sdt / n;
        for (let i = 0; i < n; i++) Game.updatePlay(h);
      }
      Game.drawPlay();
    } else if (Game.state === 'paused') {
      Game.drawPlay();
    }
    if (Game.state === 'play' || Game.state === 'paused') PerfMon.frame(dt);
    Input.endFrame();
  },
};

/* ---------- performance monitor: auto quality when FPS drops ---------- */
const PerfMon = {
  ema: 60, acc: 0, level: 0,
  frame(dt) {
    PerfMon.ema = PerfMon.ema * 0.96 + (1 / Math.max(dt, 0.001)) * 0.04;
    PerfMon.acc += dt;
    if (PerfMon.acc >= 3) {
      PerfMon.acc = 0;
      if (PerfMon.ema < 46 && PerfMon.level < 1) { PerfMon.level = 1; Game.applyPerfLevel(); }
      else if (PerfMon.ema < 32 && PerfMon.level < 2) { PerfMon.level = 2; Game.applyPerfLevel(); }
    }
  },
};
Game.applyPerfLevel = function () {
  Game.dprCap = PerfMon.level === 0 ? 2 : PerfMon.level === 1 ? 1.5 : 1;
  Save.data.settings.particles = PerfMon.level === 0 ? 'high' : PerfMon.level === 1 ? 'medium' : 'low';
  Game.resize();
};

/* ---------- headless run (node testing) ---------- */
function headlessRun(id, seconds, script) {
  const errors = [];
  try {
    if (!Save.data) Save.load();
    const def = levelDef(id);
    if (!def) { errors.push('no def for ' + id); return errors; }
    Game.world = buildWorld(def);
    Game.level = def;
    Game.player = new Player(Game.world);
    if (def.boss) {
      const b = makeEnemy('boss', def.boss[0] * T, def.boss[1] * T, 0, Game.world);
      if (typeof DDA !== 'undefined') { b.hp = Math.round(16 * DDA.mBossHp()); b.maxHp = b.hp; }
      Game.world.enemies.push(b); Game.world.boss = b;
    }
    Game.levelTime = 0;
    const dt = 1 / 60;
    const frames = Math.round(seconds * 60);
    for (let i = 0; i < frames; i++) {
      try {
        if (script) script(Input, i, Game.player);
        Game.updatePlay(dt);
        Input.endFrame();
        if (Game.state === 'complete') break;
      } catch (e) { errors.push('frame ' + i + ': ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e)); break; }
    }
    const p = Game.player;
    return { errors, time: Game.levelTime, pos: { x: p.x, y: p.y }, layer: p.curLayer, state: Game.state, energy: p.energy };
  } catch (e) {
    errors.push('setup: ' + (e && e.stack ? e.stack : e));
    return { errors };
  }
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => Game.boot());
  else Game.boot();
}

/* debug/test handle */
if (typeof window !== 'undefined') { window.Game = Game; window.PerfMon = PerfMon; window.Save = Save; window.UI = UI; }

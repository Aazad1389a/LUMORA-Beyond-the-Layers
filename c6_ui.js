/* ============================================================
   LUMORA — c6_ui: DOM UI controller (menus, HUD, toasts)
   ============================================================ */
const UI = {
  el: {}, screens: {}, confirmCb: null, returnTo: 'menu',
  ACH_ICONS: {
    jump: 'M6 18 Q12 4 18 18', slide: 'M4 15 h9 a3 3 0 0 0 0-6 H8 M15 9 l4 3 -4 3', climb: 'M6 20 V6 M6 6 l3 3 M6 6 l-3 3 M12 20 V10 M12 10 l3 3 M12 10 l-3 3', bolt: 'M13 2 L5 13 h6 l-2 9 8-11 h-6 Z',
  },
  init() {
    const $ = id => document.getElementById(id);
    UI.el = {
      hud: $('hud'), energyFill: $('energy-fill'), crystal: $('crystal-count'), timer: $('timer'),
      layerPill: $('layer-pill'), abilityChips: $('ability-chips'), levelTag: $('level-tag'),
      bossbar: $('bossbar'), bossFill: $('boss-fill'), tip: $('tip'), toasts: $('toasts'), fader: $('fader'),
      menuStats: $('menu-stats'), worldGrid: $('world-grid'), levelList: $('level-list'),
      levelsTitle: $('levels-title'), levelsSub: $('levels-sub'), achGrid: $('ach-grid'), achCount: $('ach-count'),
      pauseLevel: $('pause-level'), completeStats: $('complete-stats'), victoryStats: $('victory-stats'),
      vignette: null, score: $('score-count'),
    };
    ['scr-splash', 'scr-menu', 'scr-worlds', 'scr-levels', 'scr-settings', 'scr-ach', 'scr-pause', 'scr-complete', 'scr-victory', 'scr-confirm', 'scr-mp', 'scr-credits', 'scr-missions', 'scr-mpres', 'scr-shop']
      .forEach(id => UI.screens[id] = $(id));
    I18N.lang = (Save.data && Save.data.settings && Save.data.settings.lang) || 'fa';
    const TIPS = [
      ['کریستال‌های پشت سر هم = کمبو و امتیاز چندبرابر', 'Chain crystals fast = combo multiplier'],
      ['روح رکورد، بهترین مسیر تو را دوباره می‌دود', 'Race the ghost of your best run'],
      ['در لایه‌ی سایه فقط نورها راه را نشان می‌دهند', 'In the shadow layer, lights show the way'],
      ['لایه‌ی معکوس گرانش را وارونه می‌کند — سقف زمین است', 'Inverse layer flips gravity — ceilings are floors'],
      ['دشمنان لایه‌ی فعلی با جابه‌جایی لایه متلاشی می‌شوند', 'Shifting layers shatters enemies of that layer'],
      ['سقف زمانی هر مرحله رتبه‌ی S می‌دهد', 'Finish under par for an S rank'],
      ['چالش روز برای همه یکسان است — رکورد بزن!', 'The daily run is the same for everyone'],
      ['لگد روی دشمن = پرش مجدد و انرژی بیشتر', 'Stomp enemies to bounce and save energy'],
    ];
    let tipI = Math.floor(Math.random() * TIPS.length);
    const tipEl = document.getElementById('splash-tip');
    const showTip = () => { if (!tipEl) return; tipEl.textContent = TIPS[tipI % TIPS.length][I18N.lang === 'en' ? 1 : 0]; tipEl.classList.remove('show'); void tipEl.offsetWidth; tipEl.classList.add('show'); };
    showTip();
    setInterval(() => { if (Game.state !== 'boot') return; tipI++; showTip(); }, 2800);
    I18N.apply();
    UI.buildLayerPill(); UI.buildAbilityChips();
    UI.bindButtons(); UI.bindSettings(); UI.bindTouch();
    UI.refreshMenuStats();
    UI.menuBg();
    UI.menuChar();
    UI.applyFx();
    UI.buildBinds();
    window.addEventListener('keydown', e => {
      if (e.code !== 'Escape' || Input._inText(e.target)) return;
      if (Game.state === 'play') Game.togglePause();
    });
  },
  show(id) { for (const k in UI.screens) UI.screens[k].classList.toggle('active', k === id); },

  /* generative menu art: drifting diamond constellation (world colors) */
  _bgNodes: null,
  menuBg() {
    const cv = document.getElementById('menu-bg');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    let t = 0, frame = 0;
    const COLORS = WORLDS.map(w => w.color).concat(['#e8ecf5']);
    const fit = () => { cv.width = cv.offsetWidth || 1280; cv.height = cv.offsetHeight || 720; };
    fit();
    window.addEventListener('resize', fit);
    if (!UI._bgNodes) {
      UI._bgNodes = [];
      for (let i = 0; i < 42; i++) {
        const a = Math.random() * TAU, sp = 6 + Math.random() * 16;
        UI._bgNodes.push({ x: Math.random(), y: Math.random(), s: 3 + Math.random() * 7, c: COLORS[i % COLORS.length], vx: Math.cos(a) * sp / 9000, vy: Math.sin(a) * sp / 9000, ph: Math.random() * TAU });
      }
    }
    const draw = () => {
      frame++;
      if (frame % 2 === 0) return requestAnimationFrame(draw);
      const active = document.getElementById('scr-menu').classList.contains('active');
      if (!active || document.hidden) return requestAnimationFrame(draw);
      t += 0.016;
      const W = cv.width, H = cv.height;
      ctx.clearRect(0, 0, W, H);
      const g = ctx.createRadialGradient(W * 0.5, H * 0.42, 40, W * 0.5, H * 0.42, Math.max(W, H) * 0.75);
      g.addColorStop(0, 'rgba(38,28,88,0.55)');
      g.addColorStop(1, 'rgba(10,10,26,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      const nodes = UI._bgNodes;
      for (const n of nodes) {
        n.x += n.vx * (1 + Math.sin(t * 0.7 + n.ph) * 0.5);
        n.y += n.vy * (1 + Math.cos(t * 0.7 + n.ph) * 0.5);
        if (n.x < -0.05) n.x = 1.05; if (n.x > 1.05) n.x = -0.05;
        if (n.y < -0.05) n.y = 1.05; if (n.y > 1.05) n.y = -0.05;
      }
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = (a.x - b.x) * W, dy = (a.y - b.y) * H, d2 = dx * dx + dy * dy;
        if (d2 < 44100) {
          ctx.strokeStyle = 'rgba(120,140,220,' + (0.13 * (1 - d2 / 44100)).toFixed(3) + ')';
          ctx.beginPath(); ctx.moveTo(a.x * W, a.y * H); ctx.lineTo(b.x * W, b.y * H); ctx.stroke();
        }
      }
      for (const n of nodes) {
        const sz = n.s * (1 + Math.sin(t * 1.6 + n.ph) * 0.3);
        ctx.save();
        ctx.translate(n.x * W, n.y * H);
        ctx.rotate(t * 0.6 + n.ph);
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = n.c;
        ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
        ctx.restore();
      }
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  },
  hideAll() { for (const k in UI.screens) UI.screens[k].classList.remove('active'); },

  /* ------- main menu ------- */
  refreshMenuStats() { if (!UI.el.hud) return;
    const s = Save.data.stats;
    const total = LEVELS.reduce((n, l) => n + l.crystals.length, 0);
    const got = LEVELS.reduce((n, l) => n + Object.keys(Save.level(l.id).crystals).length, 0);
    if (UI.el.menuStats) UI.el.menuStats.textContent = '✦ ' + got + ' / ' + total + ' ' + TR('crystals-lbl') + ' · ✧ ' + Object.keys(Save.data.ach).length + ' / ' + ACH.defs.length + ' ' + TR('ach-lbl');
    const anyProgress = got > 0 || LEVELS.some(l => Save.level(l.id).done);
    const c = document.getElementById('btn-continue');
    if (c) c.style.opacity = anyProgress ? '1' : '0.45';
    UI.syncCoins();
  },
  bindButtons() {
    const bind = (id, fn, hover) => {
      const el = document.getElementById(id); if (!el) return;
      el.addEventListener('click', () => { AudioSys.sfx('uiClick'); fn(); });
      if (hover !== false) el.addEventListener('mouseenter', () => AudioSys.sfx('uiHover'));
    };
    bind('btn-continue', () => { UI.continueGame(); });
    bind('btn-new', () => {
      const has = LEVELS.some(l => Save.level(l.id).done) || Save.data.stats.crystals > 0;
      if (has) UI.confirm(I18N.lang === 'en' ? 'New game' : 'شروع بازی جدید', I18N.lang === 'en' ? 'Current progress will be wiped. Sure?' : 'پیشرفت فعلی پاک می‌شود. مطمئنی؟', () => { Save.reset(); Game.startLevel('1-1'); });
      else Game.startLevel('1-1');
    });
    bind('btn-worlds', () => { UI.buildWorlds(); UI.show('scr-worlds'); });
    bind('btn-multi', () => { AudioSys.sfx('uiClick'); if (typeof MP !== 'undefined') MP.init(); UI.show('scr-mp'); });
    bind('btn-shop', () => { ShopUI.build(); UI.show('scr-shop'); });
    bind('btn-shop-back', () => { UI.show('scr-menu'); UI.refreshMenuStats(); });
    bind('btn-infinite', () => { AudioSys.sfx('uiClick'); Game.startLevel('INF-' + Math.max(1, (Save.data.infiniteBest || 0) + 1)); });
    bind('btn-settings', () => { UI.buildBinds();  UI.returnTo = 'scr-menu'; UI.show('scr-settings');  });
    bind('btn-ach', () => { UI.buildAch(); UI.show('scr-ach'); });
    bind('btn-credits', () => { UI.buildCredits(); UI.show('scr-credits'); });
    bind('btn-credits-back', () => UI.show('scr-menu'));
    bind('btn-daily', () => { AudioSys.sfx('uiClick'); Daily.start(); });
    bind('btn-missions', () => { AudioSys.sfx('uiClick'); UI.buildMissions(); UI.show('scr-missions'); });
    bind('btn-missions-back', () => UI.show('scr-menu'));
    const motionT = document.getElementById('set-motion');
    if (motionT) {
      motionT.classList.toggle('on', Save.data.settings.motion !== false);
      motionT.addEventListener('click', () => {
        const on = !motionT.classList.contains('on');
        motionT.classList.toggle('on', on);
        Save.data.settings.motion = on; Save.saveSoon(); AudioSys.sfx('uiClick');
      });
    }
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || Game.state !== 'menu') return;
      const from = { 'scr-levels': 'scr-worlds', 'scr-worlds': 'scr-menu', 'scr-shop': 'scr-menu', 'scr-settings': 'scr-menu', 'scr-ach': 'scr-menu', 'scr-credits': 'scr-menu', 'scr-mp': 'scr-menu' };
      for (const [scr, back] of Object.entries(from)) {
        if (document.getElementById(scr).classList.contains('active')) { UI.show(back); AudioSys.sfx('uiClick'); break; }
      }
    });
    bind('btn-exit', () => UI.confirm('خروج', 'از LUMORA خارج می‌شوید؟', () => {
      Save.save();
      UI.el.fader.classList.add('on');
      setTimeout(() => { try { window.close(); } catch (e) {} document.body.innerHTML = '<div style="display:flex;height:100vh;align-items:center;justify-content:center;color:#8b93a7;font-family:sans-serif;letter-spacing:.1em">LUMORA — بازگشت دوباره خوش آمد می‌دارد ✦</div>'; }, 300);
    }));
    bind('btn-worlds-back', () => UI.show('scr-menu'));
    bind('btn-levels-back', () => UI.show('scr-worlds'));
    bind('btn-settings-back', () => UI.show(UI.returnTo || 'scr-menu'));
    bind('btn-ach-back', () => UI.show('scr-menu'));
    bind('btn-resume', () => Game.togglePause());
    bind('btn-restart', () => { Game.restartLevel(); });
    bind('btn-pause-settings', () => { UI.returnTo = 'scr-pause'; UI.show('scr-settings'); });
    bind('btn-quit', () => { Game.toMenu(); });
    bind('btn-next', () => Game.nextLevel());
    bind('btn-replay', () => Game.restartLevel());
    bind('btn-complete-menu', () => Game.toMenu());
    bind('btn-victory-menu', () => Game.toMenu());
    bind('confirm-yes', () => { UI.screens['scr-confirm'].classList.remove('active'); const cb = UI.confirmCb; UI.confirmCb = null; if (cb) cb(); });
    bind('confirm-no', () => { UI.screens['scr-confirm'].classList.remove('active'); UI.confirmCb = null; });
  },
  confirm(title, text, cb) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-text').textContent = text;
    UI.confirmCb = cb;
    UI.screens['scr-confirm'].classList.add('active');
  },
  buildCredits() {
    const en = I18N.lang === 'en';
    const feats = en
      ? ['Custom Canvas2D engine + procedural WebAudio soundtrack', '10 worlds — ' + LEVELS.length + ' handcrafted levels + endless generator', 'Layer-shifting physics across 4 dimensions', 'Online multiplayer up to 6 (rooms, voice, 3 modes)', 'Shop with 28 cosmetics · 12 achievements', 'Hidden adaptive difficulty — silently tuned to you']
      : ['موتور اختصاصی Canvas2D + موسیقی پروسیجرال WebAudio', '۱۰ جهان — ' + LEVELS.length + ' مرحله‌ی دست‌ساز + مولد بی‌نهایت', 'فیزیک جابه‌جایی لایه در ۴ بُعد', 'مولتی‌پلیر آنلاین تا ۶ نفر (روم، صدا، ۳ مود)', 'فروشگاه با ۲۸ آیتم ظاهری · ۱۲ دستاورد', 'سختی تطبیقی مخفی — بی‌سروصدا با شما تنظیم می‌شود'];
    const rows = [
      [en ? 'GAME' : 'بازی', 'LUMORA — ' + (en ? 'Beyond the Layers' : 'فراتر از لایه‌ها')],
      [en ? 'STUDIO' : 'استودیو', 'NEXORA PLATFORM'],
      [en ? 'ENGINE' : 'موتور', en ? 'In-house Canvas2D + WebAudio' : 'داخلی — Canvas2D + WebAudio'],
      [en ? 'VERSION' : 'نسخه', 'v3.1 REMASTERED WORLDS'],
    ];
    let h = '';
    for (const [k, v] of rows) h += '<div class="credit-row"><span class="cr-k">' + k + '</span><span class="cr-v">' + v + '</span></div>';
    h += '<div class="credit-feats">' + feats.map(f => '<div class="cr-feat">✦ ' + f + '</div>').join('') + '</div>';
    h += '<div class="credit-note">' + (en ? 'Crafted with Canvas, WebAudio and love for platformers.' : 'ساخته‌شده با Canvas، WebAudio و عشق به پلتفرمرها.') + '</div>';
    document.getElementById('credits-body').innerHTML = h;
  },

  continueGame() {
    // first not-done level in unlocked worlds
    for (const L of LEVELS) {
      if (!Save.level(L.id).done && Save.worldUnlocked(L.world)) { Game.startLevel(L.id); return; }
    }
    UI.buildWorlds(); UI.show('scr-worlds');
  },

  /* ------- world select ------- */
  buildWorlds() {
    const grid = UI.el.worldGrid; grid.innerHTML = '';
    for (const wd of WORLDS) {
      const unlocked = Save.worldUnlocked(wd.id);
      const lv = LEVELS.filter(l => l.world === wd.id);
      const done = lv.filter(l => Save.level(l.id).done).length;
      const cry = lv.reduce((n, l) => n + Object.keys(Save.level(l.id).crystals).length, 0);
      const cryT = lv.reduce((n, l) => n + l.crystals.length, 0);
      const card = document.createElement('div');
      card.className = 'world-card' + (unlocked ? '' : ' locked');
      card.style.setProperty('--wc', wd.color);
      card.innerHTML = '<div class="wc-num">WORLD ' + wd.id + '</div>'
        + '<div class="wc-name">' + wd.en + '</div><div class="wc-fa">' + wd.fa + '</div>'
        + '<div class="wc-bar"><div class="wc-fill" style="width:' + (lv.length ? (done / lv.length * 100) : 0) + '%"></div></div>'
        + '<div class="wc-meta"><span>' + (unlocked ? done + '/' + lv.length + ' LEVELS' : 'LOCKED') + '</span><span>✦ ' + cry + '/' + cryT + '</span></div>';
      if (unlocked) card.addEventListener('click', () => { AudioSys.sfx('uiClick'); UI.buildLevels(wd); UI.show('scr-levels'); });
      grid.appendChild(card);
    }
  },
  buildLevels(wd) {
    UI.el.levelsTitle.textContent = I18N.lang === 'en' ? wd.en : wd.fa;
    UI.el.levelsSub.textContent = 'WORLD ' + wd.id + ' — ' + wd.en.toUpperCase();
    const list = UI.el.levelList; list.innerHTML = '';
    LEVELS.filter(l => l.world === wd.id).forEach((L, i) => {
      const unlocked = Save.isUnlocked(L.world, i);
      const rec = Save.level(L.id);
      const row = document.createElement('div');
      row.className = 'level-row' + (unlocked ? '' : ' locked');
      row.innerHTML = '<div class="lr-name">' + (i + 1) + '. ' + L.nameFa + '<small>' + L.name.toUpperCase() + '</small></div>'
        + '<div class="lr-meta">'
        + (rec.done ? '<span class="done-badge">✓ DONE</span>' : '')
        + '<span>✦ ' + Object.keys(rec.crystals).length + '/' + L.crystals.length + '</span>'
        + (rec.orb ? '<span>✧ ORB</span>' : '')
        + '<span>' + (rec.best ? U.fmtTime(rec.best) : '--:--') + '</span>'
        + (rec.rank ? '<span class="rank-mini r-' + rec.rank + '">' + rec.rank + '</span>' : '') + '</div>';
      if (unlocked) row.addEventListener('click', () => { AudioSys.sfx('uiClick'); Game.startLevel(L.id); });
      list.appendChild(row);
    });
  },

  /* ------- achievements ------- */
  buildAch() {
    const grid = UI.el.achGrid; grid.innerHTML = '';
    let n = 0;
    for (const a of ACH.defs) {
      const got = !!Save.data.ach[a.id]; if (got) n++;
      const card = document.createElement('div');
      card.className = 'ach-card' + (got ? ' unlocked' : '');
      const nm = I18N.lang === 'en' ? a.en : a.fa;
      const ds = I18N.lang === 'en' && a.de ? a.de : a.desc;
      card.innerHTML = '<div class="ach-ico"><svg viewBox="0 0 24 24"><path d="' + a.icon + '"/></svg></div>'
        + '<div><div class="ach-name">' + nm + '</div><div class="ach-desc">' + ds + '</div></div>';
      grid.appendChild(card);
    }
    UI.el.achCount.textContent = n + ' / ' + ACH.defs.length;
  },

  /* ------- settings ------- */
  bindSettings() {
    const s = Save.data.settings;
    const music = document.getElementById('set-music'), sfxr = document.getElementById('set-sfx');
    music.value = Math.round(s.music * 100); sfxr.value = Math.round(s.sfx * 100);
    document.getElementById('val-music').textContent = music.value;
    document.getElementById('val-sfx').textContent = sfxr.value;
    music.addEventListener('input', () => { AudioSys.setVolumes(music.value / 100, sfxr.value / 100); document.getElementById('val-music').textContent = music.value; Save.saveSoon(); });
    sfxr.addEventListener('input', () => { AudioSys.setVolumes(music.value / 100, sfxr.value / 100); document.getElementById('val-sfx').textContent = sfxr.value; AudioSys.sfx('pickup'); Save.saveSoon(); });
    const shake = document.getElementById('set-shake');
    shake.classList.toggle('on', s.shake);
    shake.addEventListener('click', () => { s.shake = !s.shake; shake.classList.toggle('on', s.shake); Save.saveSoon(); AudioSys.sfx('uiClick'); });
    const parts = document.getElementById('set-particles');
    parts.value = s.particles;
    parts.addEventListener('change', () => { s.particles = parts.value; Save.saveSoon(); AudioSys.sfx('uiClick'); });
    const touch = document.getElementById('set-touch');
    touch.value = s.touch;
    touch.addEventListener('change', () => { s.touch = touch.value; Save.saveSoon(); UI.applyTouch(); AudioSys.sfx('uiClick'); });
    document.getElementById('set-reset').addEventListener('click', () => {
      UI.confirm(TR('cf-reset-t'), TR('cf-reset-d'), () => { Save.reset(); UI.refreshMenuStats(); UI.toast(TR('cf-reset-t'), TR('cf-reset-ok'), 'cy'); });
    });
    // language / fps counter / crt filter / custom signaling
    const lang = document.getElementById('set-lang');
    lang.value = Save.data.settings.lang || 'fa';
    lang.addEventListener('change', () => I18N.setLang(lang.value));
    const fpsT = document.getElementById('set-fps'), crtT = document.getElementById('set-crt');
    fpsT.classList.toggle('on', !!Save.data.settings.fps);
    crtT.classList.toggle('on', !!Save.data.settings.crt);
    fpsT.addEventListener('click', () => { Save.data.settings.fps = !Save.data.settings.fps; fpsT.classList.toggle('on', Save.data.settings.fps); UI.applyFx(); Save.saveSoon(); AudioSys.sfx('uiClick'); });
    crtT.addEventListener('click', () => { Save.data.settings.crt = !Save.data.settings.crt; crtT.classList.toggle('on', Save.data.settings.crt); UI.applyFx(); Save.saveSoon(); AudioSys.sfx('uiClick'); });
    const sig = document.getElementById('set-signaling');
    sig.value = Save.data.settings.signaling || '';
    sig.addEventListener('change', () => { Save.data.settings.signaling = sig.value.trim(); Save.saveSoon(); AudioSys.sfx('uiClick'); });
  },
  /* ------- keybinds ------- */
  BIND_ACTS: [
    ['left', 'act-left'], ['right', 'act-right'], ['jump', 'act-jump'], ['slide', 'act-slide'],
    ['switchPrev', 'act-prev'], ['switchNext', 'act-next'], ['pause', 'act-pause'],
    ['layer1', 'act-l1'], ['layer2', 'act-l2'], ['layer3', 'act-l3'], ['layer4', 'act-l4'],
  ],
  keyName(code) {
    const M = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'Space', Escape: 'Esc', ShiftLeft: 'Shift', ShiftRight: 'Shift' };
    if (M[code]) return M[code];
    let m = code && code.match(/^(Key|Digit)(.+)$/);
    if (m) return m[2];
    return code || '?';
  },
  buildBinds() {
    const box = document.getElementById('bind-rows');
    if (!box) return;
    const b = Save.data.settings.bindings || {};
    box.innerHTML = UI.BIND_ACTS.map(([a, k]) => {
      const codes = (Array.isArray(b[a]) && b[a].length) ? b[a] : Input._defaults[a];
      return '<div class="set-row"><span class="set-label">' + TR(k) + '</span><button class="bind-key" data-act="' + a + '">' + codes.map(UI.keyName).join(' / ') + '</button><span class="set-val"></span></div>';
    }).join('');
    box.querySelectorAll('.bind-key').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('listen')) return;
        btn.classList.add('listen');
        btn.textContent = TR('bind-press');
        const onKey = (e) => {
          e.preventDefault(); e.stopPropagation();
          window.removeEventListener('keydown', onKey, true);
          if (e.code !== 'Escape') {
            const s = Save.data.settings;
            s.bindings = s.bindings || {};
            s.bindings[btn.dataset.act] = [e.code];
            Save.save();
            Input.applyBindings();
            AudioSys.sfx('uiClick');
          }
          UI.buildBinds();
        };
        window.addEventListener('keydown', onKey, true);
      });
    });
    const rst = document.getElementById('bind-reset');
    if (rst && !rst._bound) {
      rst._bound = true;
      rst.addEventListener('click', () => { Save.data.settings.bindings = null; Save.save(); Input.applyBindings(); UI.buildBinds(); AudioSys.sfx('uiClick'); });
    }
  },

  /* ------- animated character preview on menu ------- */
  _charT: 0,
  menuChar() {
    const cv = document.getElementById('menu-char');
    if (!cv) return;
    const g = cv.getContext('2d');
    let t = 0, frame = 0;
    const draw = () => {
      frame++;
      if (frame % 2 === 0) return requestAnimationFrame(draw);
      const active = document.getElementById('scr-menu').classList.contains('active');
      if (!active || document.hidden) return requestAnimationFrame(draw);
      t += 0.016;
      const cos = (typeof Cos !== 'undefined') ? Save.data.shop.equipped : null;
      Cos.paintPreview(cv, cos, t);
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  },

  applyFx() {
    const crt = document.getElementById('crt-overlay'), fps = document.getElementById('fps-counter');
    if (crt) crt.style.display = Save.data.settings.crt ? '' : 'none';
    if (fps) fps.style.display = Save.data.settings.fps ? '' : 'none';
  },

  /* ------- HUD ------- */
  buildLayerPill() {
    const pill = UI.el.layerPill;
    pill.innerHTML = '<div class="layer-dots">' + LAYER_META.map(m => '<i data-l="' + m.id + '"></i>').join('') + '</div>'
      + '<div class="layer-name" id="layer-name"></div>';
  },
  syncLayer(l) {
    if (typeof NEXORA !== 'undefined') NEXORA.sync(l);
  },
  buildAbilityChips() {
    const defs = [
      { id: 'doubleJump', fa: 'پرش دوم', icon: 'jump' },
      { id: 'slide', fa: 'سُر', icon: 'slide' },
      { id: 'wallClimb', fa: 'چسبیدن', icon: 'climb' },
      { id: 'overcharge', fa: 'اَبشارژ', icon: 'bolt' },
    ];
    UI.el.abilityChips.innerHTML = defs.map(d =>
      '<div class="ab-chip" data-ab="' + d.id + '"><svg viewBox="0 0 24 24"><path d="' + UI.ACH_ICONS[d.icon] + '"/></svg><span>' + d.fa + '</span></div>').join('');
  },
  syncAbilities() { if (!UI.el.hud) return;
    UI.el.abilityChips.querySelectorAll('.ab-chip').forEach(ch => {
      ch.classList.toggle('have', Abilities.has(ch.dataset.ab));
    });
  },
  flashAbility(id) {
    if (!UI.el.hud) return;
    const ch = UI.el.abilityChips.querySelector('[data-ab="' + id + '"]');
    if (!ch) return;
    ch.classList.remove('flash'); void ch.offsetWidth; ch.classList.add('flash');
  },
  syncEnergy(r) {
    const f = UI.el.energyFill;
    if (!f) return;
    f.style.transform = 'scaleX(' + U.clamp(r, 0, 1) + ')';
    f.classList.toggle('low', r < 0.3);
  },
  energyLow(v) { if (!UI.el.hud) return; if (UI._energyLow !== v) { UI._energyLow = v; if (v) UI.el.layerPill.animate([{ opacity: 1 }, { opacity: 0.6 }, { opacity: 1 }], { duration: 600, iterations: 1 }); } },
  energyDeny() { if (!UI.el.hud) return; UI.el.energyFill.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(2.2)' }, { filter: 'brightness(1)' }], { duration: 250 }); },
  syncCrystals(n) { if (!UI.el.hud) return; UI.el.crystal.textContent = n; },
  syncTimer(ms) { if (!UI.el.hud) return; UI.el.timer.textContent = U.fmtTime(ms); },
  syncCoins() {
    const s = document.getElementById('shop-coins'), m = document.getElementById('menu-coins');
    const txt = '🪙 ' + (Save.data.coins || 0);
    if (s) s.textContent = txt;
    if (m) m.textContent = txt;
  },
  syncTag(L) { if (!UI.el.hud) return; const nm = I18N.lang === 'en' ? L.name : (L.nameFa || L.name);
    UI.el.levelTag.innerHTML = '<b>WORLD ' + L.world + ' · ' + L.id + '</b>' + nm; },
  bossBar(v) { if (!UI.el.hud) return; UI.el.bossbar.classList.toggle('hidden', !v); },
  syncBoss(r) { if (!UI.el.hud) return; UI.el.bossFill.style.transform = 'scaleX(' + U.clamp(r, 0, 1) + ')'; },
  syncScore(s) { if (!UI.el.score) return; UI.el.score.textContent = (s || 0).toLocaleString('en-US'); },
  syncCombo(n, mult, k) {
    const el = document.getElementById('combo');
    if (!el) return;
    if (!n) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    document.getElementById('combo-n').textContent = '×' + n;
    document.getElementById('combo-m').textContent = '×' + (Math.round(mult * 10) / 10);
    const fill = document.getElementById('combo-fill');
    if (fill) fill.style.transform = 'scaleX(' + U.clamp(k, 0, 1) + ')';
    el.classList.toggle('hot', n >= 6);
  },
  syncMissionHud() { /* reserved: missions surface via toasts + panel */ },
  buildMissions() {
    Missions.ensure();
    const en = I18N.lang === 'en';
    const list = document.getElementById('mission-list');
    if (!list) return;
    let h = '';
    for (const m of Save.data.missions.list) {
      const d = Missions.def(m.id);
      if (!d) continue;
      const pct = Math.round(m.prog / d.goal * 100);
      h += '<div class="mission-row' + (m.done ? ' done' : '') + '">'
        + '<div class="mi-name">' + (en ? d.en : d.fa) + '</div>'
        + '<div class="mi-bar"><i style="width:' + pct + '%"></i></div>'
        + '<div class="mi-meta"><span>' + Math.min(m.prog, d.goal) + ' / ' + d.goal + '</span>'
        + (m.done ? '<b class="mi-done">✓ 🪙 +' + d.reward + '</b>' : '<b>🪙 +' + d.reward + '</b>') + '</div></div>';
    }
    list.innerHTML = h;
    document.getElementById('missions-date').textContent = new Date().toLocaleDateString(en ? 'en-US' : 'fa-IR');
  },
  hud(v) { if (!UI.el.hud) return; UI.el.hud.classList.toggle('on', v);
    const nx = document.getElementById('nexora'); if (nx) nx.style.display = v ? '' : 'none';
    if (v && typeof NEXORA !== 'undefined') NEXORA.init();
  },

  /* ------- toast / tip / fader ------- */
  toast(title, sub, kind) { if (!UI.el.hud) return;
    const t = document.createElement('div');
    t.className = 'toast' + (kind === 'cy' ? ' cy' : '');
    const icon = kind === 'gold' ? 'M12 2 L14 9 L21 9 L15.5 13.5 L17.5 21 L12 16.5 L6.5 21 L8.5 13.5 L3 9 L10 9 Z' : 'M5 12 h14 M13 6 l6 6 -6 6';
    t.innerHTML = '<div class="t-ico"><svg viewBox="0 0 24 24"><path d="' + icon + '"/></svg></div>'
      + '<div><div class="t-title">' + U.esc(title) + '</div><div class="t-sub">' + U.esc(sub || '') + '</div></div>';
    UI.el.toasts.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  },
  tip(text, sx, sy) { if (!UI.el.hud) return;
    const tip = UI.el.tip;
    if (text === null) { tip.classList.add('hidden'); return; }
    tip.textContent = text;
    tip.style.left = sx + 'px'; tip.style.top = (sy - 84) + 'px';
    tip.classList.remove('hidden');
  },
  fade(on, cb) {
    UI.el.fader.classList.add('on');
    setTimeout(() => { if (cb) cb(); UI.el.fader.classList.remove('on'); }, 340);
  },
  vignette() { if (!UI.el.hud) return;
    const v = document.getElementById('hud');
    let el = document.getElementById('dv');
    if (!el) { el = document.createElement('div'); el.id = 'dv'; el.className = 'death-vignette'; v.appendChild(el); }
    el.classList.add('on');
    clearTimeout(UI._vT); UI._vT = setTimeout(() => el.classList.remove('on'), 320);
  },

  /* ------- touch controls ------- */
  bindTouch() {
    const mk = (id, action) => {
      const el = document.getElementById(id);
      if (!el) return;
      const press = e => { e.preventDefault(); el.classList.add('held'); Input.vPress(action); };
      const rel = e => { e.preventDefault(); el.classList.remove('held'); Input.vRelease(action); };
      el.addEventListener('pointerdown', press);
      el.addEventListener('pointerup', rel);
      el.addEventListener('pointercancel', rel);
      el.addEventListener('pointerleave', rel);
    };
    mk('t-left', 'left'); mk('t-right', 'right');
    mk('t-jump', 'jump'); mk('t-slide', 'slide');
    document.getElementById('t-switch').addEventListener('pointerdown', e => { e.preventDefault(); Game.switchNext(); });
  },
  applyTouch() {
    const mode = Save.data.settings.touch;
    const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    const on = mode === 'on' || (mode === 'auto' && isTouch);
    document.getElementById('touch').classList.toggle('hidden', !on);
  },
};

/* ============================================================
   LUMORA — c9_infinite: seeded procedural level generator
   Same seed ⇒ identical level (required for multiplayer races).
   ============================================================ */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const InfiniteGen = {
  cache: new Map(),
  get(id) {
    if (InfiniteGen.cache.has(id)) return InfiniteGen.cache.get(id);
    if (!id || !id.startsWith('INF-')) return null;
    const parts = id.split('-');
    let n, seed;
    if ((parts[1] || '').slice(0, 2) === 'MP') { n = 3; seed = InfiniteGen.seedFrom(parts[1].slice(2) + (parts[2] || '')); }
    else { n = parseInt(parts[1], 10) || 1; seed = 8191 + n * 7919; }
    const def = InfiniteGen.generate(n, seed, id);
    if (InfiniteGen.cache.size > 24) InfiniteGen.cache.clear();
    InfiniteGen.cache.set(id, def);
    return def;
  },
  seedFrom(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return Math.abs(h) || 12345;
  },
  generate(n, seed, id) {
    const R = mulberry32(seed);
    const diff = Math.min(10, 1 + Math.floor((n - 1) / 2));
    const W = Math.min(180, 88 + n * 5);
    const G = 16; // ground-top row (ground rect y = 16*T)
    const world = ((n - 1) % 5) + 1;
    const solids = [], hazards = [], enemies = [], crystals = [], orbs = [],
      movers = [], checkpoints = [], signs = [], decos = [];
    let x = 9, lastCp = 0, orbPlaced = false;

    const ground = (x0, x1, top) => { solids.push([x0, top || G, x1 - x0 + 1, 22 - (top || G), 'a']); };
    const maybeCp = () => { if (x - lastCp > 24) { checkpoints.push([x - 1, G]); lastCp = x; } };
    const sprinkle = (x0, x1) => {
      for (let i = x0; i <= x1; i++) if (R() < 0.22) crystals.push([i, G - 1 - Math.floor(R() * 2)]);
    };

    // start zone
    ground(0, 9);
    signs.push([3, G, 'آغاز — ' + n]);
    decos.push(['torch', 6, G]);
    if (R() < 0.6) crystals.push([5, G - 1]);

    const endX = W - 10;
    while (x < endX) {
      const roll = R();
      if (roll < 0.24) { // flat run with threats
        const len = 6 + Math.floor(R() * 5);
        ground(x, x + len);
        if (R() < 0.55) hazards.push(['spike', x + 2 + Math.floor(R() * Math.max(1, len - 3)), G - 1, 1 + Math.floor(R() * 2), 0]);
        if (diff >= 2 && R() < 0.45 && len >= 6) hazards.push(['electro', x + 1 + Math.floor(R() * (len - 2)), G, 2, 0.3, 0]);
        if (diff >= 2 && R() < 0.4 && len >= 7) {
          solids.push([x + len - 2, G - 3, 2, 3, 'a']);
          enemies.push(['sentry', x + len - 1, G - 1, 0]);
        }
        if (R() < 0.5) enemies.push(['wisp', x + 2 + Math.floor(R() * Math.max(1, len - 3)), G - 4, 0]);
        if (R() < 0.45) decos.push(['flag', x + 1, G]);
        sprinkle(x, x + len);
        x += len + 1;
      } else if (roll < 0.46) { // pit (void or shallow spiky floor) + optional blade
        const gap = 2 + Math.floor(R() * Math.min(4, 2 + diff));
        if (R() < 0.5) { solids.push([x, 18, gap, 4, 'a']); hazards.push(['spike', x, 17, gap, 0]); }
        if (diff >= 2 && R() < 0.6) hazards.push(['blade', x + Math.floor(gap / 2), G - 4, 0, 0, 0]);
        if (R() < 0.35) enemies.push(['wisp', x + Math.floor(gap / 2), G - 6, 0]);
        ground(x + gap, x + gap);
        sprinkle(x + gap, x + gap + 1);
        x += gap + 1;
      } else if (roll < 0.63) { // platform hop over the void
        const k = 3 + Math.floor(R() * 2);
        let px = x, py = G - 1 - Math.floor(R() * 2);
        for (let i = 0; i < k; i++) {
          const pl = 2 + Math.floor(R() * 2);
          solids.push([px, py, pl, 0.6, 'a']);
          if (R() < 0.55) crystals.push([px + Math.floor(pl / 2), py - 1]);
          if (diff >= 1 && R() < 0.3) enemies.push(['wisp', px + 1, py - 3, 0]);
          px += pl + 2 + Math.floor(R() * 2);
          py = Math.max(9, Math.min(G - 1, py + (R() < 0.5 ? -2 : 2)));
        }
        ground(px, px + 2);
        x = px + 3;
      } else if (roll < 0.76) { // climb wall + ledge
        const h2 = 4 + Math.floor(R() * 3);
        solids.push([x + 1, G - h2, 1.2, h2, 'c']);
        solids.push([x + 1, G - h2 - 1, 4, 1, 'a']);
        if (diff >= 1 && R() < 0.6) enemies.push(['crawler', x + 3, G - h2 - 2, 0]);
        if (R() < 0.5) crystals.push([x + 2, G - h2 - 2]);
        if (!orbPlaced && R() < 0.5 && diff >= 1) { orbs.push([x + 2, G - h2 - 3]); orbPlaced = true; }
        ground(x + 1, x + 6);
        x += 7;
      } else if (roll < 0.88) { // mover crossing a wide gap
        const gap = 6 + Math.floor(R() * 4);
        movers.push([x + 1, G - 1, 3, 0.6, gap - 4.2, 0, 3.4 + R() * 1.3, 'a']);
        if (diff >= 3 && R() < 0.5) hazards.push(['blade', x + Math.floor(gap / 2), G - 6, 0, 0, 0]);
        ground(x + gap, x + gap + 2);
        sprinkle(x + gap, x + gap + 2);
        x += gap + 3;
      } else { // low ceiling corridor: spikes + blade
        const len = 7 + Math.floor(R() * 4);
        ground(x, x + len);
        solids.push([x - 1, G - 5, len + 2, 1, 'a']);
        hazards.push(['spike', x + 2, G - 1, 1 + Math.floor(R() * 2), 0]);
        if (diff >= 2) hazards.push(['blade', x + 4 + Math.floor(R() * 2), G - 3, 0, 0, 0]);
        if (diff >= 3 && R() < 0.4) enemies.push(['sentry', x + len - 1, G - 1, 0]);
        x += len + 1;
      }
      maybeCp();
    }

    // end zone + gate
    ground(x, W - 1);
    decos.push(['torch', x + 2, G]);
    decos.push(['torch', W - 6, G]);
    decos.push(['flag', W - 7, G]);
    const gate = [W - 4, G];
    if (!orbPlaced) {
      solids.push([x + 2, G - 5, 3, 0.6, 'a']);
      orbs.push([x + 3, G - 6]);
    }

    return {
      id, world, w: W, h: 22, par: Math.round(W * 1.15 + 30), music: 'w' + world,
      name: 'Infinite ' + n, nameFa: 'بی‌نهایت ' + n,
      intro: 'مرحله‌ی تولیدشده‌ی شماره ' + n + ' — سختی ' + diff + '/10',
      spawn: [2, G - 2], layerStart: 0, gate,
      solids, hazards, oneway: [], enemies: enemies.map(e => [e[0], e[1], e[2], 0]), crystals, orbs, movers, checkpoints, signs, decos,
      infinite: true, n, diff,
    };
  },
};

/* unified level lookup: handcrafted first, then generated */
function levelDef(id) {
  return LEVELS.find(l => l.id === id) || InfiniteGen.get(id);
}

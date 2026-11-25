/* ============================================================
   LUMORA — c5_render: palettes, sprite-cache system, parallax
   All static art is baked ONCE into offscreen canvases; per-frame
   work is plain drawImage (no shadowBlur / gradients in hot path).
   ============================================================ */
const PALETTES = {
  0: { sky: ['#0a1230', '#101a3c', '#060a18'], far: '#141e42', mid: '#0e1630', near: '#090d20', fg: '#060a18', accent: '#59f2e0', glow: 'rgba(89,242,224,.10)', star: '#9fd8ff', aurora: true, rays: true, amb: '#8fd8ff' },
  1: { sky: ['#07242f', '#0c3c46', '#04121e'], far: '#0e3a44', mid: '#0a2e38', near: '#06222c', fg: '#041820', accent: '#59f2e0', glow: 'rgba(89,242,224,.12)', star: '#bfeee8', aurora: true, rays: true, amb: '#9fe8dc' },
  2: { sky: ['#2e1c0c', '#4a2e14', '#160c06'], far: '#4a3418', mid: '#37260f', near: '#221705', fg: '#180f04', accent: '#f0b060', glow: 'rgba(240,176,96,.12)', star: '#ffe2b0', aurora: false, rays: true, amb: '#e8c890' },
  3: { sky: ['#160a2e', '#22104a', '#0a0518'], far: '#2c1a5e', mid: '#201240', near: '#140a2a', fg: '#0c0620', accent: '#a78bfa', glow: 'rgba(167,139,250,.12)', star: '#d8ccff', aurora: true, rays: false, amb: '#c4b0ff' },
  4: { sky: ['#0b0e22', '#131634', '#050612'], far: '#1a1e46', mid: '#12142e', near: '#0a0c1e', fg: '#06081a', accent: '#9f7aea', glow: 'rgba(159,122,234,.10)', star: '#b7c4ff', aurora: true, rays: false, amb: '#b0a0ff' },
  5: { sky: ['#1a0e02', '#2e1c06', '#0a0502'], far: '#3a2a0e', mid: '#281a08', near: '#190f05', fg: '#0e0803', accent: '#ffd76a', glow: 'rgba(255,215,106,.15)', star: '#ffe9b8', aurora: false, rays: true, amb: '#ffe4a8', fx: 'gears' },
  6: { sky: ['#20080a', '#38100e', '#0c0303'], far: '#42141a', mid: '#2e0c10', near: '#1e0709', fg: '#120404', accent: '#ff8a5c', glow: 'rgba(255,138,92,.14)', star: '#ffcdb0', aurora: false, rays: true, amb: '#ffbc9c', fx: 'embers' },
  7: { sky: ['#01081a', '#04203a', '#00040f'], far: '#06304e', mid: '#032035', near: '#021222', fg: '#010a16', accent: '#22d3ee', glow: 'rgba(34,211,238,.14)', star: '#a5ecff', aurora: true, rays: true, amb: '#8fe4ff', fx: 'deep' },
  8: { sky: ['#021810', '#063020', '#010c08'], far: '#0a4430', mid: '#073022', near: '#051c12', fg: '#03100a', accent: '#3ce6a4', glow: 'rgba(60,230,164,.14)', star: '#c4ffe8', aurora: true, rays: false, amb: '#a4ffdc', fx: 'orbit' },
  9: { sky: ['#3a1e08', '#6b3d12', '#180c04'], far: '#7a4a18', mid: '#58330f', near: '#38200a', fg: '#201204', accent: '#ffca6a', glow: 'rgba(255,202,106,.16)', star: '#fff3d0', aurora: false, rays: true, amb: '#ffd98c', fx: 'solar' },
  10: { sky: ['#0c0f22', '#181e40', '#04050f'], far: '#262e56', mid: '#1a2144', near: '#0e1330', fg: '#080a1c', accent: '#e8ecf5', glow: 'rgba(232,236,245,.13)', star: '#ffffff', aurora: true, rays: true, amb: '#dce4ff', fx: 'nexus' },
};

const LAYER_TILE_STYLE = {
  0: { fill: 'rgba(23,42,64,0.96)', fill2: 'rgba(13,26,44,0.98)', hi: 'rgba(120,190,220,0.55)', edge: 'rgba(89,242,224,0.5)', glow: 'rgba(89,242,224,0.25)' },
  1: { fill: 'rgba(120,32,84,0.42)', fill2: 'rgba(70,14,48,0.5)', hi: 'rgba(255,160,215,0.8)', edge: 'rgba(244,114,182,0.85)', glow: 'rgba(244,114,182,0.5)' },
  2: { fill: 'rgba(96,66,16,0.5)', fill2: 'rgba(56,36,8,0.6)', hi: 'rgba(255,225,150,0.8)', edge: 'rgba(255,215,106,0.85)', glow: 'rgba(255,215,106,0.45)' },
  3: { fill: 'rgba(48,34,96,0.55)', fill2: 'rgba(26,16,56,0.65)', hi: 'rgba(200,180,255,0.7)', edge: 'rgba(159,122,234,0.85)', glow: 'rgba(159,122,234,0.5)' },
  a: { fill: 'rgba(30,44,66,0.97)', fill2: 'rgba(16,26,44,0.99)', hi: 'rgba(150,190,225,0.5)', edge: 'rgba(110,160,200,0.4)', glow: 'rgba(120,170,210,0.2)' },
  c: { fill: 'rgba(46,36,22,0.97)', fill2: 'rgba(26,20,10,0.99)', hi: 'rgba(255,215,140,0.6)', edge: 'rgba(255,215,106,0.55)', glow: 'rgba(255,200,100,0.3)' },
};

/* ---------- seeded RNG for deterministic baked detail ---------- */
function seedRng(seed) { let s = (seed | 0) || 1; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

/* ---------- sprite cache ---------- */
const Sprites = {
  map: new Map(),
  get(key, w, h, drawFn) {
    let c = Sprites.map.get(key);
    if (!c) {
      if (Sprites.map.size > 500) Sprites.map.clear();
      c = document.createElement('canvas');
      c.width = Math.max(2, Math.ceil(w)); c.height = Math.max(2, Math.ceil(h));
      drawFn(c.getContext('2d'), c);
      Sprites.map.set(key, c);
    }
    return c;
  },
};

function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const PAD = 18;
function bakeSolid(r, layerKey, worldId) {
  const key = 'S' + worldId + '|' + layerKey + '|' + r.w + 'x' + r.h + '|' + ((r.x * 7 + r.y * 13) % 97);
  return Sprites.get(key, r.w + PAD * 2, r.h + PAD * 2, (g) => {
    const pal = PALETTES[worldId] || PALETTES[0];
    const st = LAYER_TILE_STYLE[layerKey];
    const rnd = seedRng(r.x * 31 + r.y * 17 + worldId * 5 + 7);
    const W = r.w, H = r.h;
    // outer glow (baked once)
    g.shadowColor = st.glow; g.shadowBlur = 16;
    rr(g, PAD, PAD, W, H, 7); g.fillStyle = st.fill; g.fill();
    g.shadowBlur = 0;
    // body gradient
    const grad = g.createLinearGradient(0, PAD, 0, PAD + H);
    grad.addColorStop(0, st.hi); grad.addColorStop(0.1, st.fill); grad.addColorStop(1, st.fill2);
    rr(g, PAD, PAD, W, H, 7); g.fillStyle = grad; g.fill();
    // inner bevel
    g.strokeStyle = 'rgba(255,255,255,0.10)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(PAD + 3, PAD + H - 4); g.lineTo(PAD + 3, PAD + 3); g.lineTo(PAD + W - 4, PAD + 3); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.28)';
    g.beginPath(); g.moveTo(PAD + W - 3, PAD + 4); g.lineTo(PAD + W - 3, PAD + H - 3); g.lineTo(PAD + 4, PAD + H - 3); g.stroke();
    // edge + top light
    g.strokeStyle = st.edge; g.lineWidth = 1.6;
    rr(g, PAD, PAD, W, H, 7); g.stroke();
    g.strokeStyle = st.hi; g.lineWidth = 2;
    g.beginPath(); g.moveTo(PAD + 4, PAD + 1.5); g.lineTo(PAD + W - 4, PAD + 1.5); g.stroke();

    /* per-layer ornament */
    if (layerKey === '2') { // inverse hatch
      g.strokeStyle = st.edge; g.lineWidth = 1; g.globalAlpha = 0.5;
      for (let x = -H; x < W; x += 24) { g.beginPath(); g.moveTo(PAD + x, PAD + H); g.lineTo(PAD + x + H, PAD); g.stroke(); }
      g.globalAlpha = 1;
    } else if (layerKey === '1') { // energy circuit
      g.fillStyle = st.edge;
      for (let y = PAD + 16; y < PAD + H - 10; y += 24) {
        g.globalAlpha = 0.5;
        g.fillRect(PAD + 12, y, W - 24, 1.4);
        g.globalAlpha = 0.9;
        for (let x = PAD + 18; x < PAD + W - 14; x += 42) { g.fillRect(x, y - 2.5, 4, 4); }
      }
      g.globalAlpha = 1;
    } else if (layerKey === '3') { // shadow eyes
      for (let x = PAD + 16; x < PAD + W - 20; x += 44) {
        const y = PAD + 16 + rnd() * (H - 34);
        g.globalAlpha = 0.6; g.strokeStyle = st.edge; g.lineWidth = 1.4;
        g.beginPath(); g.moveTo(x - 7, y); g.quadraticCurveTo(x, y - 8, x + 7, y); g.quadraticCurveTo(x, y + 8, x - 7, y); g.stroke();
        g.fillStyle = st.edge; g.beginPath(); g.arc(x, y, 2.2, 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
    } else if (layerKey === 'c') { // climb chevrons + chain
      g.strokeStyle = st.hi; g.lineWidth = 2;
      for (let y = PAD + 14; y < PAD + H - 8; y += 22) {
        g.beginPath(); g.moveTo(PAD + 8, y); g.lineTo(PAD + 16, y + 8); g.lineTo(PAD + 24, y); g.stroke();
        if (W > 60) { g.beginPath(); g.moveTo(PAD + W - 24, y); g.lineTo(PAD + W - 16, y + 8); g.lineTo(PAD + W - 8, y); g.stroke(); }
      }
    } else { // materia / all-layer stone
      // brick seams
      g.strokeStyle = 'rgba(255,255,255,0.06)'; g.lineWidth = 1;
      for (let y = PAD + 30; y < PAD + H; y += 34) { g.beginPath(); g.moveTo(PAD + 4, y); g.lineTo(PAD + W - 4, y); g.stroke(); }
      for (let y = PAD + 30, k = 0; y < PAD + H; y += 34, k++) {
        for (let x = PAD + ((k % 2) ? 20 : 40); x < PAD + W; x += 58) { g.beginPath(); g.moveTo(x, y - 34); g.lineTo(x, y); g.stroke(); }
      }
      // cracks
      g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1;
      const nC = Math.max(1, Math.floor(W / 130));
      for (let i = 0; i < nC; i++) {
        let cx = PAD + 20 + rnd() * (W - 40), cy = PAD + 10 + rnd() * (H - 20);
        g.beginPath(); g.moveTo(cx, cy);
        for (let s = 0; s < 4; s++) { cx += (rnd() - 0.5) * 22; cy += rnd() * 12; g.lineTo(cx, cy); }
        g.stroke();
      }
      // rivets
      if (W > 40 && H > 30) {
        g.fillStyle = 'rgba(255,255,255,0.16)';
        for (const [rx, ry] of [[8, 8], [W - 12, 8], [8, H - 12], [W - 12, H - 12]]) { g.beginPath(); g.arc(PAD + rx, PAD + ry, 2, 0, TAU); g.fill(); }
      }
      // world-flavored top decoration
      const topDecor = (x) => {
        const bx = PAD + x, by = PAD + 1;
        if (worldId === 1 || worldId === 0) { // crystal grass tufts + micro shards
          g.strokeStyle = 'rgba(120,240,220,0.8)'; g.lineWidth = 1.6;
          const h2 = 5 + rnd() * 8;
          g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx - 3, by - h2 * 0.7, bx - 1, by - h2); g.stroke();
          g.beginPath(); g.moveTo(bx + 4, by); g.quadraticCurveTo(bx + 6, by - h2 * 0.6, bx + 8, by - h2 * 0.8); g.stroke();
          if (rnd() < 0.4) {
            g.fillStyle = pal.accent; g.globalAlpha = 0.9;
            const s = 3 + rnd() * 4;
            g.beginPath(); g.moveTo(bx + 12, by - s); g.lineTo(bx + 12 + s * 0.6, by); g.lineTo(bx + 12, by + 1); g.lineTo(bx + 12 - s * 0.6, by); g.closePath(); g.fill();
            g.globalAlpha = 1;
          }
        } else if (worldId === 2) { // sandstone blocks + gold lichen
          g.fillStyle = 'rgba(255,215,130,0.5)';
          if (rnd() < 0.5) { g.beginPath(); g.arc(bx + 8, by - 2, 1.8 + rnd() * 1.6, 0, TAU); g.fill(); }
          g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1;
          g.beginPath(); g.moveTo(bx, by + 2); g.lineTo(bx + 10, by + 2); g.stroke();
        } else if (worldId === 3) { // floating runes
          g.strokeStyle = 'rgba(200,180,255,0.7)'; g.lineWidth = 1.4;
          if (rnd() < 0.55) { g.strokeRect(bx + 2, by - 9, 8, 8); g.beginPath(); g.moveTo(bx + 2, by - 9); g.lineTo(bx + 10, by - 1); g.stroke(); }
        } else if (worldId === 4) { // glowing moss
          g.fillStyle = 'rgba(159,122,234,0.75)';
          for (let m = 0; m < 3; m++) { g.beginPath(); g.arc(bx + m * 5 + rnd() * 3, by - 1 - rnd() * 3, 1.6 + rnd() * 1.6, 0, TAU); g.fill(); }
        } else { // gold filigree
          g.strokeStyle = 'rgba(255,215,106,0.85)'; g.lineWidth = 1.4;
          g.beginPath(); g.moveTo(bx, by - 6); g.quadraticCurveTo(bx + 5, by - 12, bx + 10, by - 6); g.stroke();
          g.beginPath(); g.arc(bx + 5, by - 7, 2, 0, TAU); g.stroke();
        }
      };
      const nD = Math.floor(W / 34);
      for (let i = 0; i < nD; i++) topDecor(6 + rnd() * (W - 12));
    }
  });
}

function drawSolid(ctx, r, layerId, t, view) {
  const key = r.layer === 'a' ? 'a' : (r.layer === 'c' ? 'c' : r.layer);
  const isActive = (key === 'a' || key === 'c' || key === layerId);
  if (key === 3 && !isActive) return;
  if (r.x > view.camx + view.w + PAD || r.x + r.w < view.camx - PAD || r.y > view.camy + view.h + PAD || r.y + r.h < view.camy - PAD) return;
  const sprite = r._sp && r._sp.k === key ? r._sp.c : null;
  const baked = sprite || bakeSolid(r, key, view.worldId || 0);
  if (!sprite) r._sp = { k: key, c: baked };
  ctx.globalAlpha = isActive ? 1 : (key === 1 ? 0.18 : 0.2);
  ctx.drawImage(baked, r.x - PAD, r.y - PAD);
  ctx.globalAlpha = 1;
}

/* ---------- hazards ---------- */
function bakeSpikes(hz) {
  const key = 'H' + hz.w + '|' + hz.h + '|' + Math.round(hz.x) % 89;
  return Sprites.get(key, hz.w + PAD * 2, hz.h + PAD * 2, (g) => {
    const n = Math.max(1, Math.round(hz.w / 16));
    const sw = hz.w / n;
    const grad = g.createLinearGradient(0, PAD, 0, PAD + hz.h);
    grad.addColorStop(0, '#f2f6ff'); grad.addColorStop(1, '#7f92b8');
    for (let i = 0; i < n; i++) {
      const x = PAD + i * sw;
      g.shadowColor = 'rgba(255,107,122,0.5)'; g.shadowBlur = 8;
      g.fillStyle = grad;
      g.beginPath(); g.moveTo(x + 1, PAD + hz.h); g.lineTo(x + sw / 2, PAD + 2); g.lineTo(x + sw - 1, PAD + hz.h); g.closePath(); g.fill();
      g.shadowBlur = 0;
      g.strokeStyle = 'rgba(0,0,0,0.4)'; g.stroke();
      g.fillStyle = 'rgba(255,107,122,0.6)';
      g.beginPath(); g.moveTo(x + sw / 2, PAD + 4); g.lineTo(x + sw / 2 + 3, PAD + hz.h - 8); g.lineTo(x + sw / 2 - 3, PAD + hz.h - 8); g.closePath(); g.fill();
    }
  });
}
const bladeSprite = Sprites.get('BLADE', 60, 60, (g) => {
  g.translate(30, 30);
  const grad = g.createRadialGradient(0, 0, 4, 0, 0, 26);
  grad.addColorStop(0, '#e8ecf5'); grad.addColorStop(1, '#7d8fb5');
  g.fillStyle = grad;
  for (let i = 0; i < 4; i++) {
    g.save(); g.rotate(i * TAU / 4);
    g.beginPath();
    g.moveTo(-6, 0); g.quadraticCurveTo(-2, -20, 0, -27); g.quadraticCurveTo(4, -18, 6, 0);
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,107,122,0.85)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-4, -20); g.lineTo(0, -27); g.lineTo(4, -20); g.stroke();
    g.restore();
  }
  g.fillStyle = '#2a3550';
  g.beginPath(); g.arc(0, 0, 8, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,107,122,0.7)'; g.lineWidth = 2;
  g.beginPath(); g.arc(0, 0, 8, 0, TAU); g.stroke();
});
function drawHazards(ctx, w, layerId, t, view) {
  for (const hz of w.hazards) {
    const active = (hz.layer === 'a' || hz.layer === layerId);
    if (hz.layer === 3 && !active) continue;
    if (hz.x > view.camx + view.w + 60 || hz.x + hz.w < view.camx - 60) continue;
    if (hz.type === 'blade') {
      if (!active) continue;
      ctx.drawImage(Glow.sprite('#ff6b7a', 34), hz.x - 34, hz.y - 34);
      for (let k = 2; k >= 1; k--) { // motion trail afterimages
        ctx.save();
        ctx.globalAlpha = 0.22 - k * 0.07;
        ctx.translate(hz.x, hz.y);
        ctx.rotate((hz.t - k * 0.13) * 9);
        ctx.drawImage(bladeSprite, -30, -30);
        ctx.restore();
      }
      ctx.save();
      ctx.translate(hz.x, hz.y);
      ctx.rotate(hz.t * 9);
      ctx.drawImage(bladeSprite, -30, -30);
      ctx.restore();
      continue;
    }
    if (hz.type === 'electro') {
      const panel = Sprites.get('EL' + Math.round(hz.w), Math.max(2, Math.round(hz.w)), 16, (g) => {
        const W2 = g.canvas.width;
        g.fillStyle = 'rgba(16,22,40,0.95)';
        g.fillRect(0, 0, W2, 16);
        g.strokeStyle = 'rgba(140,170,220,0.5)'; g.lineWidth = 1.4;
        g.strokeRect(0.7, 0.7, W2 - 1.4, 14.6);
        const rnd = seedRng(Math.round(hz.w) * 13 + 7);
        g.strokeStyle = 'rgba(0,0,0,0.55)';
        for (let i = 0; i < Math.floor(W2 / 22) + 2; i++) { // cracks
          let cx2 = rnd() * W2, cy2 = 3 + rnd() * 9;
          g.beginPath(); g.moveTo(cx2, cy2);
          for (let s2 = 0; s2 < 3; s2++) { cx2 += (rnd() - 0.5) * 12; cy2 += (rnd() - 0.5) * 6; g.lineTo(cx2, cy2); }
          g.stroke();
        }
        g.fillStyle = '#ff6b7a';
        g.fillRect(2, 4, 3, 8); g.fillRect(W2 - 5, 4, 3, 8); // terminals
      });
      if (!active) { ctx.globalAlpha = 0.16; ctx.drawImage(panel, hz.x, hz.y); ctx.globalAlpha = 1; continue; }
      ctx.drawImage(panel, hz.x, hz.y);
      if (hz.warn) {
        ctx.globalAlpha = 0.4 + Math.sin(t * 26) * 0.3;
        ctx.drawImage(Glow.sprite('#ffd76a', 24), hz.x + hz.w / 2 - 24, hz.y - 16);
        ctx.fillStyle = '#ffe2a0';
        for (let i = 0; i < 3; i++) ctx.fillRect(hz.x + ((t * 90 + i * 37) % hz.w), hz.y - 2 - (i % 2) * 5, 2, 4);
        ctx.globalAlpha = 1;
      }
      if (hz.hot) {
        ctx.globalAlpha = 0.75;
        ctx.drawImage(Glow.sprite('#9fd4ff', 40 + hz.w / 2), hz.x + hz.w / 2 - (40 + hz.w / 2), hz.y - 40);
        ctx.globalAlpha = 1;
        for (let a = 0; a < 3; a++) { // jagged lightning arcs
          const x0 = hz.x + (a / 3) * hz.w, x1 = hz.x + ((a + 1) / 3) * hz.w;
          ctx.strokeStyle = a % 2 ? 'rgba(190,230,255,0.95)' : 'rgba(255,255,255,0.85)';
          ctx.lineWidth = a % 2 ? 2.4 : 1.2;
          ctx.beginPath(); ctx.moveTo(x0, hz.y + 2);
          for (let s2 = 1; s2 <= 6; s2++) ctx.lineTo(x0 + ((x1 - x0) * s2) / 6, hz.y + 2 + (Math.random() - 0.5) * 14);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(220,240,255,0.85)';
        ctx.fillRect(hz.x + 2, hz.y + 5, 3, 3); ctx.fillRect(hz.x + hz.w - 5, hz.y + 5, 3, 3);
      }
      continue;
    }
    if (hz.type === 'spike') {
      ctx.globalAlpha = active ? 1 : 0.16;
      ctx.drawImage(bakeSpikes(hz), hz.x - PAD, hz.y - PAD);
    } else if (hz.type === 'pulse') {
      const on = Math.sin(hz.t * 2.2) > 0;
      ctx.globalAlpha = (active ? 1 : 0.15) * (on ? 0.8 : 0.22);
      ctx.fillStyle = on ? '#ff6b7a' : '#5a2e38';
      rr(ctx, hz.x, hz.y, hz.w, hz.h, 8); ctx.fill();
      ctx.strokeStyle = 'rgba(255,150,160,0.6)'; ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

/* ---------- movers ---------- */
function bakeMover(w0, h0) {
  return Sprites.get('M' + w0 + 'x' + h0, w0 + PAD * 2, h0 + PAD * 2, (g) => {
    g.shadowColor = 'rgba(140,190,255,0.55)'; g.shadowBlur = 14;
    rr(g, PAD, PAD, w0, h0, 9);
    const grad = g.createLinearGradient(0, PAD, 0, PAD + h0);
    grad.addColorStop(0, 'rgba(170,205,255,0.9)'); grad.addColorStop(0.2, 'rgba(40,62,105,0.95)'); grad.addColorStop(1, 'rgba(16,26,52,0.95)');
    g.fillStyle = grad; g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = 'rgba(160,200,255,0.85)'; g.lineWidth = 1.6; rr(g, PAD, PAD, w0, h0, 9); g.stroke();
    g.fillStyle = 'rgba(180,215,255,0.9)';
    for (let x = PAD + 10; x < PAD + w0 - 8; x += 30) g.fillRect(x, PAD + 2.5, 12, 2.4);
    g.fillStyle = 'rgba(255,215,106,0.9)';
    g.fillRect(PAD + 6, PAD + h0 / 2 - 1.5, 3, 3); g.fillRect(PAD + w0 - 9, PAD + h0 / 2 - 1.5, 3, 3);
  });
}
function drawMovers(ctx, w, layerId, t, view) {
  for (const m of w.movers) {
    const active = (m.layer === 'a' || m.layer === layerId);
    if (m.x > view.camx + view.w + 60 || m.x + m.w < view.camx - 60) continue;
    ctx.globalAlpha = active ? 1 : 0.16;
    ctx.drawImage(bakeMover(Math.round(m.w), Math.round(m.h)), m.x - PAD, m.y - PAD);
    ctx.globalAlpha = 1;
  }
}

/* ---------- gate / checkpoint / sign ---------- */
function drawGate(ctx, w, t, layerId, view) {
  const g = w.gate;
  if (g.x > view.camx + view.w + 120 || g.x + g.w < view.camx - 120) return;
  const cx = g.x + g.w / 2, cy = g.y + g.h / 2;
  const col = g.locked ? 'rgba(120,130,160,0.7)' : '#ffd76a';
  ctx.save();
  ctx.translate(cx, cy);
  const pulse = 1 + Math.sin(t * 2.4) * 0.06;
  ctx.shadowColor = col; ctx.shadowBlur = g.locked ? 8 : 26;
  for (let i = 0; i < 3; i++) {
    const s = (26 + i * 14) * pulse;
    ctx.save(); ctx.rotate(t * (0.5 + i * 0.35) * (i % 2 ? -1 : 1) + 0.78);
    ctx.globalAlpha = g.locked ? 0.5 : 0.9 - i * 0.15;
    ctx.strokeStyle = col; ctx.lineWidth = 3 - i * 0.6;
    ctx.strokeRect(-s, -s, s * 2, s * 2);
    ctx.restore();
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = g.locked ? 0.35 : 0.95;
  ctx.drawImage(Glow.sprite(g.locked ? '#aab4d8' : '#fff0c0', 34), -34, -34);
  if (!g.locked) {
    ctx.fillStyle = '#ffd76a';
    for (let i = 0; i < 4; i++) {
      const a = t * 1.4 + i * TAU / 4;
      ctx.save(); ctx.translate(Math.cos(a) * 46, Math.sin(a) * 46); ctx.rotate(a);
      ctx.fillRect(-3, -3, 6, 6); ctx.restore();
    }
  }
  ctx.restore();
}

const ckptSprite = Sprites.get('CK', 40, 60, (g) => {
  g.strokeStyle = '#8ca0c8'; g.lineWidth = 2.4;
  g.translate(20, 58);
  g.beginPath(); g.moveTo(0, -46); g.lineTo(12, -16); g.lineTo(0, -4); g.lineTo(-12, -16); g.closePath(); g.stroke();
});
function drawCheckpoints(ctx, w, t, view) {
  for (const cp of w.checkpoints) {
    if (cp.x > view.camx + view.w + 60 || cp.x < view.camx - 60) continue;
    const on = cp.on;
    if (on) ctx.drawImage(Glow.sprite('#ffd76a', 44), cp.x - 44, cp.y - 62);
    ctx.save();
    ctx.translate(cp.x, cp.y - 58);
    const s = 1 + (on ? Math.sin(t * 3) * 0.08 : 0);
    ctx.scale(s, s);
    ctx.globalAlpha = on ? 1 : 0.75;
    ctx.drawImage(ckptSprite, -20, -30);
    if (on) {
      ctx.globalAlpha = 0.8; ctx.fillStyle = '#ffd76a';
      ctx.save(); ctx.scale(0.86, 0.86); ctx.beginPath(); ctx.moveTo(0, -46); ctx.lineTo(12, -16); ctx.lineTo(0, -4); ctx.lineTo(-12, -16); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    ctx.restore();
    if (on && Math.random() < 0.06) Parts.spawn({ x: cp.x + U.rand(-10, 10), y: cp.y - U.rand(20, 50), vx: 0, vy: -26, life: 0.9, size: 2, color: '#ffd76a' });
  }
}

const signSprite = Sprites.get('SG', 34, 44, (g) => {
  g.fillStyle = 'rgba(20,28,50,0.92)'; g.strokeStyle = 'rgba(255,215,106,0.55)'; g.lineWidth = 1.6;
  rr(g, 8, 4, 18, 24, 5); g.fill(); g.stroke();
  g.fillStyle = '#ffd76a'; g.font = 'bold 13px sans-serif'; g.textAlign = 'center';
  g.fillText('?', 17, 21);
});
function drawSign(ctx, sg, t, view) {
  if (sg.x > view.camx + view.w + 40 || sg.x < view.camx - 40) return;
  const bob = Math.sin(t * 2.6 + sg.x) * 3;
  ctx.drawImage(Glow.sprite('#ffd76a', 26), sg.x - 26, sg.y - 32 + bob - 26);
  ctx.drawImage(signSprite, sg.x - 17, sg.y - 32 + bob);
}

/* ---------- decorations (cached sprites) ---------- */
const torchPole = Sprites.get('TP', 10, 30, (g) => {
  g.fillStyle = '#3a2a1a'; g.fillRect(3, 2, 4, 26);
  g.fillStyle = '#59452c'; g.fillRect(3, 2, 1.6, 26);
});
function drawMotes(ctx, w, t, view) { // drifting ambient light motes
  if (PerfMon.level > 1) return;
  const n = 26;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const seed = i * 127.31;
    const wx = (seed * 13.7 % w.pw + t * (7 + (i % 5) * 6)) % w.pw;
    const wy = ((seed * 7.7) % w.ph + Math.sin(t * 0.5 + i) * 26) % w.ph;
    const sx = wx - view.camx, sy = wy - view.camy;
    if (sx < -20 || sx > view.w + 20 || sy < -20 || sy > view.h + 20) continue;
    ctx.globalAlpha = Math.max(0, 0.09 + 0.10 * Math.sin(t * 1.4 + i * 1.7));
    ctx.fillStyle = i % 3 ? '#bfe9ff' : '#ffd76a';
    ctx.beginPath(); ctx.arc(sx, sy, 1.3 + (i % 3) * 0.7, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function drawDeco(ctx, d, pal, t, view) {
  if (d.x > view.camx + view.w + 80 || d.x < view.camx - 80) return;
  const s = d.s || 1;
  if (d.type === 'shard') {
    ctx.save();
    ctx.translate(d.x, d.y + Math.sin(t * 1.2 + d.x) * 5);
    ctx.rotate(t * 0.4 + d.x);
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = pal.accent; ctx.lineWidth = 1.4;
    const sz = 10 * s;
    ctx.strokeRect(-sz, -sz, sz * 2, sz * 2);
    ctx.globalAlpha = 0.25;
    ctx.strokeRect(-sz * 0.55, -sz * 0.55, sz * 1.1, sz * 1.1);
    ctx.restore();
  } else if (d.type === 'torch') {
    const fl = 1 + Math.sin(t * 7 + d.x) * 0.22;
    ctx.drawImage(torchPole, d.x - 5, d.y - 28);
    ctx.drawImage(Glow.sprite('#ffb04c', 26 * fl), d.x - 26 * fl, d.y - 58);
    ctx.fillStyle = '#ffdd9a';
    ctx.beginPath();
    ctx.moveTo(d.x - 4, d.y - 28);
    ctx.quadraticCurveTo(d.x - 6 * fl, d.y - 40, d.x, d.y - 44 * fl);
    ctx.quadraticCurveTo(d.x + 6 * fl, d.y - 40, d.x + 4, d.y - 28);
    ctx.closePath(); ctx.fill();
  } else if (d.type === 'flag') {
    const col = pal.accent || '#59f2e0';
    ctx.strokeStyle = 'rgba(140,160,200,0.85)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x, d.y - 56 * s); ctx.stroke();
    const W2 = 26 * s, H2 = 15 * s, tipY = d.y - 54 * s;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(d.x, tipY);
    for (let i = 1; i <= 4; i++) ctx.lineTo(d.x + (W2 * i) / 4, tipY + Math.sin(t * 5 + d.x * 0.05 + i) * 3.2 * (i / 4) - i * 0.7);
    for (let i = 4; i >= 0; i--) ctx.lineTo(d.x + (W2 * i) / 4, tipY + H2 + Math.sin(t * 5 + d.x * 0.05 + i + 0.7) * 3.2 * (i / 4) - i * 0.7);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(10,14,28,0.45)'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(d.x + 3, tipY + 4);
    for (let i = 1; i <= 4; i++) ctx.lineTo(d.x + (W2 * i) / 4, tipY + 4 + Math.sin(t * 5 + d.x * 0.05 + i) * 3.2 * (i / 4) - i * 0.7);
    ctx.stroke();
  } else if (d.type === 'pillar') {
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(d.x - 12, d.y - 100 * s, 24, 100 * s);
    ctx.strokeStyle = 'rgba(255,255,255,0.13)';
    ctx.strokeRect(d.x - 12, d.y - 100 * s, 24, 100 * s);
    ctx.beginPath(); ctx.moveTo(d.x - 16, d.y - 100 * s); ctx.lineTo(d.x + 16, d.y - 100 * s); ctx.stroke();
    ctx.globalAlpha = 1;
  } else if (d.type === 'arch') {
    ctx.globalAlpha = 0.32;
    ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(d.x, d.y, 46, Math.PI, TAU); ctx.stroke();
    ctx.lineWidth = 2; ctx.globalAlpha = 0.2;
    ctx.beginPath(); ctx.arc(d.x, d.y, 34, Math.PI, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  } else if (d.type === 'lantern') {
    const bob = Math.sin(t * 1.8 + d.x) * 5;
    ctx.drawImage(Glow.sprite('#9f7aea', 30), d.x - 30, d.y + bob - 30);
    ctx.fillStyle = '#c9b8ff';
    ctx.beginPath(); ctx.arc(d.x, d.y + bob, 5, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(200,184,255,0.4)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(d.x, d.y - 14); ctx.lineTo(d.x, d.y + bob - 8); ctx.stroke();
  } else if (d.type === 'rune') {
    ctx.globalAlpha = 0.5 + Math.sin(t * 2) * 0.2;
    ctx.strokeStyle = pal.accent; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(d.x - 8, d.y + 8); ctx.lineTo(d.x, d.y - 10); ctx.lineTo(d.x + 8, d.y + 8); ctx.moveTo(d.x - 4, d.y + 2); ctx.lineTo(d.x + 4, d.y + 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

/* ---------- parallax background (all baked) ---------- */
const BG = { cache: {}, compose: null, composeKey: '', skyGrad: null, hzGrad: null };
function bgFor(worldId) {
  if (BG.cache[worldId]) return BG.cache[worldId];
  const pal = PALETTES[worldId] || PALETTES[0];
  const mk = (draw, half) => {
    const c = document.createElement('canvas');
    c.width = half ? 512 : 1024; c.height = half ? 360 : 720;
    const g = c.getContext('2d');
    if (half) g.scale(0.5, 0.5);
    draw(g);
    return c;
  };
  const rnd = seedRng(worldId * 777 + 13);
  const silh = (g, color, gen) => { g.fillStyle = color; gen(); };
  const far = mk(g => silh(g, pal.far, () => {
    if (worldId === 1 || worldId === 0) {
      for (let i = 0; i < 26; i++) { const x = rnd() * 1024, h = 130 + rnd() * 240, wd = 26 + rnd() * 50; g.beginPath(); g.moveTo(x - wd / 2, 720); g.lineTo(x, 720 - h - Math.sin(i) * 30); g.lineTo(x + wd / 2, 720); g.closePath(); g.fill(); }
      for (let i = 0; i < 12; i++) { const x = rnd() * 1024, y = 140 + rnd() * 300, s = 10 + rnd() * 26; g.save(); g.translate(x, y); g.rotate(rnd() * TAU); g.globalAlpha = 0.5; g.strokeStyle = pal.accent; g.strokeRect(-s, -s, s * 2, s * 2); g.restore(); }
    } else if (worldId === 2) {
      for (let i = 0; i < 18; i++) { const x = rnd() * 1024, w2 = 40 + rnd() * 70, h = 180 + rnd() * 300; g.fillRect(x, 720 - h, w2, h); g.beginPath(); g.moveTo(x - 6, 720 - h); g.lineTo(x + w2 / 2, 720 - h - 30 - rnd() * 40); g.lineTo(x + w2 + 6, 720 - h); g.closePath(); g.fill(); }
    } else if (worldId === 3) {
      for (let i = 0; i < 14; i++) { const x = rnd() * 1024, y = 120 + rnd() * 260, s = 40 + rnd() * 80; g.beginPath(); g.moveTo(x - s, y); g.lineTo(x + s, y); g.lineTo(x, y + s * 1.6); g.closePath(); g.fill(); }
    } else if (worldId === 4) {
      for (let i = 0; i < 20; i++) { const x = rnd() * 1024, w2 = 30 + rnd() * 60, h = 220 + rnd() * 320; g.beginPath(); g.moveTo(x, 720); g.lineTo(x - w2 / 2, 720 - h * 0.7); g.lineTo(x, 720 - h); g.lineTo(x + w2 / 2, 720 - h * 0.7); g.closePath(); g.fill(); }
    } else {
      for (let i = 0; i < 16; i++) { const x = rnd() * 1024, w2 = 34 + rnd() * 50, h = 200 + rnd() * 320; g.save(); g.translate(x, 720 - h / 2); g.rotate((rnd() - 0.5) * 0.14); g.fillRect(-w2 / 2, -h / 2, w2, h); g.restore(); }
    }
  }, true));
  const mid = mk(g => silh(g, pal.mid, () => {
    for (let i = 0; i < 30; i++) { const x = rnd() * 1024, h = 90 + rnd() * 200, wd = 18 + rnd() * 40; g.beginPath(); g.moveTo(x - wd / 2, 720); g.lineTo(x, 720 - h); g.lineTo(x + wd / 2, 720); g.closePath(); g.fill(); }
    if (worldId === 4) { for (let i = 0; i < 10; i++) { const x = rnd() * 1024, y = 100 + rnd() * 260; g.globalAlpha = 0.5; g.strokeStyle = pal.accent; g.beginPath(); g.arc(x, y, 8 + rnd() * 10, 0, TAU); g.stroke(); g.globalAlpha = 1; } }
    if (worldId === 3) { for (let i = 0; i < 8; i++) { const x = rnd() * 1024, y = 100 + rnd() * 300, s = 26 + rnd() * 40; g.save(); g.translate(x, y); g.rotate(0.78); g.globalAlpha = 0.6; g.strokeStyle = pal.accent; g.lineWidth = 2; g.strokeRect(-s, -s, s * 2, s * 2); g.restore(); g.globalAlpha = 1; } }
    if (worldId === 2) { for (let i = 0; i < 12; i++) { const x = rnd() * 1024, y = 200 + rnd() * 300, w2 = 60 + rnd() * 80; g.globalAlpha = 0.4; g.beginPath(); g.arc(x, y, w2 / 2, Math.PI, TAU); g.stroke(); g.globalAlpha = 1; } }
    if (worldId === 5) { // giant gear silhouettes
      for (let i = 0; i < 4; i++) {
        const x = rnd() * 1024, y = 160 + rnd() * 260, r = 60 + rnd() * 90;
        g.save(); g.translate(x, y);
        g.beginPath(); g.arc(0, 0, r, 0, TAU); g.arc(0, 0, r * 0.4, 0, TAU);
        g.fill();
        for (let k = 0; k < 10; k++) { g.save(); g.rotate(k * TAU / 10); g.fillRect(-r * 0.09, -r - r * 0.16, r * 0.18, r * 0.2); g.restore(); }
        g.restore();
      }
    }
    if (worldId === 6) { // foundry chimneys + pipes
      for (let i = 0; i < 9; i++) { const x = rnd() * 1024, w2 = 26 + rnd() * 34, h = 180 + rnd() * 300; g.fillRect(x, 720 - h, w2, h); g.fillRect(x - 8, 720 - h, w2 + 16, 14); }
      for (let i = 0; i < 5; i++) { const y = 220 + rnd() * 300; g.fillRect(0, y, 1024, 10); }
    }
    if (worldId === 7) { // abyss kelp + sunken columns
      for (let i = 0; i < 12; i++) {
        const x = rnd() * 1024, h = 220 + rnd() * 320;
        g.beginPath(); g.moveTo(x, 720);
        for (let y = 0; y < h; y += 24) g.quadraticCurveTo(x + Math.sin(y / 40 + i) * 22, 720 - y, x + Math.sin((y + 24) / 40 + i) * 16, 720 - y - 24);
        g.stroke();
      }
      for (let i = 0; i < 6; i++) { const x = rnd() * 1024; g.fillRect(x, 720 - (200 + rnd() * 300), 18, 720); }
    }
    if (worldId === 9) { // temple pillars + step ziggurat
      for (let i = 0; i < 8; i++) { const x = rnd() * 1024, h = 260 + rnd() * 300, w2 = 30 + rnd() * 20; g.fillRect(x, 720 - h, w2, h); g.fillRect(x - 10, 720 - h, w2 + 20, 16); g.fillRect(x - 10, 720 - 14, w2 + 20, 16); }
      for (let i = 0; i < 3; i++) { const x = rnd() * 1024, y = 560 + i * 40; for (let s = 0; s < 4; s++) g.fillRect(x - s * 34, y - s * 26, 120 + s * 68, 26); }
    }
    if (worldId === 10) { // hex nexus nodes
      for (let i = 0; i < 10; i++) {
        const x = rnd() * 1024, y = 120 + rnd() * 320, s = 22 + rnd() * 40;
        g.save(); g.translate(x, y); g.beginPath();
        for (let k = 0; k < 6; k++) { const a = k * TAU / 6; g[k ? 'lineTo' : 'moveTo'](Math.cos(a) * s, Math.sin(a) * s); }
        g.closePath(); g.fill();
        g.globalAlpha = 0.4; g.fillStyle = pal.accent; g.beginPath(); g.arc(0, 0, s * 0.3, 0, TAU); g.fill(); g.globalAlpha = 1;
        g.restore();
      }
    }
  }, true));
  const near = mk(g => silh(g, pal.near, () => {
    for (let i = 0; i < 16; i++) { const x = rnd() * 1024, h = 70 + rnd() * 140, wd = 30 + rnd() * 60; g.beginPath(); g.moveTo(x - wd / 2, 720); g.lineTo(x, 720 - h); g.lineTo(x + wd / 2, 720); g.closePath(); g.fill(); }
  }, true));
  // foreground silhouettes (drawn in FRONT of the world for depth)
  const fore = mk(g => silh(g, pal.fg || pal.near, () => {
    for (let i = 0; i < 14; i++) { const x = rnd() * 1024, h = 55 + rnd() * 130, wd = 90 + rnd() * 190; g.beginPath(); g.moveTo(x - wd / 2, 720); g.quadraticCurveTo(x - wd * 0.22, 720 - h * 0.85, x, 720 - h); g.quadraticCurveTo(x + wd * 0.22, 720 - h * 0.85, x + wd / 2, 720); g.closePath(); g.fill(); }
    for (let i = 0; i < 5; i++) { const x = rnd() * 1024, y = 10 + rnd() * 70, s = 18 + rnd() * 30; g.save(); g.translate(x, y); g.rotate(rnd() * TAU); g.globalAlpha = 0.55; g.fillRect(-s * 0.3, -s * 0.3, s * 0.6, s * 0.6); g.restore(); g.globalAlpha = 1; }
  }, true));
  // stars
  const stars = mk(g => {
    for (let i = 0; i < 110; i++) {
      const x = rnd() * 1024, y = rnd() * 360;
      g.globalAlpha = 0.25 + rnd() * 0.6;
      g.fillStyle = rnd() < 0.12 ? pal.accent : pal.star;
      const s = rnd() < 0.85 ? 2 : 3;
      g.fillRect(x, y, s, s);
    }
    for (let i = 0; i < 7; i++) {
      const x = rnd() * 1024, y = rnd() * 300, s = 4 + rnd() * 4;
      g.globalAlpha = 0.5; g.strokeStyle = pal.star; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x - s, y); g.lineTo(x + s, y); g.moveTo(x, y - s); g.lineTo(x, y + s); g.stroke();
    }
    g.globalAlpha = 1;
  }, true);
  // aurora ribbons
  const aurora = mk(g => {
    for (let k = 0; k < 3; k++) {
      const y0 = 60 + k * 55, amp = 26 + k * 10, ph = k * 2.1;
      const grad = g.createLinearGradient(0, y0 - amp - 30, 0, y0 + amp + 40);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.5, k === 1 ? 'rgba(167,139,250,0.14)' : hexA0(pal.accent, 0.13));
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.beginPath(); g.moveTo(0, y0 + amp + 40);
      for (let x = 0; x <= 1024; x += 16) g.lineTo(x, y0 + Math.sin(x / 180 + ph) * amp);
      g.lineTo(1024, y0 + amp + 40); g.closePath(); g.fill();
    }
  }, true);
  // god rays
  const rays = mk(g => {
    for (let i = 0; i < 7; i++) {
      const x = 80 + i * 150 + rnd() * 40, wd = 46 + rnd() * 60, slant = 140 + rnd() * 90;
      const grad = g.createLinearGradient(x, 0, x + slant, 720);
      grad.addColorStop(0, hexA0(pal.accent, 0.085));
      grad.addColorStop(0.6, hexA0(pal.accent, 0.03));
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x + wd, 0); g.lineTo(x + wd + slant, 720); g.lineTo(x + slant, 720); g.closePath(); g.fill();
    }
  }, true);
  // void mist strip
  const mist = mk(g => {
    const grad = g.createLinearGradient(0, 0, 0, 120);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, hexA0(pal.far, 0.9));
    g.fillStyle = grad; g.fillRect(0, 0, 512, 120);
    g.globalAlpha = 0.5;
    for (let i = 0; i < 26; i++) {
      const x = rnd() * 512, y = 30 + rnd() * 80, r = 14 + rnd() * 34;
      g.fillStyle = hexA0(pal.far, 0.5);
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
  });
  BG.cache[worldId] = { far, mid, near, fore, stars, aurora: pal.aurora ? aurora : null, rays: pal.rays ? rays : null, mist, pal };
  return BG.cache[worldId];
}
function hexA0(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}

/* ---------- per-world animated FX (gears / embers / bubbles / orbits / sun / stars) ---------- */
const gearSprite = Sprites.get('GEARFX', 140, 140, (g) => {
  g.translate(70, 70);
  g.strokeStyle = 'rgba(255,215,106,0.5)'; g.fillStyle = 'rgba(255,215,106,0.10)'; g.lineWidth = 3;
  g.beginPath(); g.arc(0, 0, 52, 0, TAU); g.fill(); g.stroke();
  g.beginPath(); g.arc(0, 0, 20, 0, TAU); g.stroke();
  for (let k = 0; k < 10; k++) { g.save(); g.rotate(k * TAU / 10); g.strokeRect(-7, -62, 14, 12); g.restore(); }
});
const nexusRing = Sprites.get('NEXUSFX', 220, 220, (g) => {
  g.translate(110, 110);
  g.strokeStyle = 'rgba(232,236,245,0.4)'; g.lineWidth = 2.4;
  g.beginPath(); g.arc(0, 0, 96, 0, TAU); g.stroke();
  g.globalAlpha = 0.5; g.setLineDash([26, 16]);
  g.beginPath(); g.arc(0, 0, 74, 0, TAU); g.stroke();
  g.setLineDash([]); g.globalAlpha = 1;
  for (let k = 0; k < 8; k++) { const a = k * TAU / 8; g.fillStyle = k % 2 ? 'rgba(232,236,245,0.7)' : 'rgba(34,211,238,0.6)'; g.beginPath(); g.arc(Math.cos(a) * 96, Math.sin(a) * 96, 4, 0, TAU); g.fill(); }
});
function drawWorldFX(ctx, worldId, view, camx, camy, t) {
  if (PerfMon.level > 1) return;
  const pal = PALETTES[worldId] || PALETTES[0];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const fx = pal.fx;
  if (fx === 'gears') { // W5: two colossal slow gears + rising gold dust
    const p = 0.18;
    for (let i = 0; i < 2; i++) {
      const gx = ((i * 900 - camx * p - t * (6 + i * 4)) % (view.w + 500) + view.w + 500) % (view.w + 500) - 250;
      const gy = view.h * (0.3 + i * 0.28) - camy * p;
      ctx.save(); ctx.translate(gx, gy); ctx.rotate(t * (0.06 + i * 0.04) * (i ? -1 : 1));
      ctx.globalAlpha = 0.4; ctx.drawImage(gearSprite, -70, -70, 140, 140); ctx.restore();
    }
  } else if (fx === 'embers') { // W6: rising embers + drifting smoke glow
    for (let i = 0; i < 26; i++) {
      const s = i * 127.31;
      const x = ((s * 17.3) % view.w + view.w) % view.w + Math.sin(t * 0.7 + i) * 30 - camx * 0.1;
      const y = view.h - ((s * 13.1 + t * (26 + (i % 5) * 12)) % (view.h + 80)) ;
      ctx.globalAlpha = 0.5 * Math.sin(Math.PI * ((s * 13.1 + t * 30) % (view.h + 80)) / (view.h + 80));
      ctx.fillStyle = i % 3 ? '#ff9a5c' : '#ffd76a';
      ctx.beginPath(); ctx.arc((x + view.w) % view.w, y, 1.6 + (i % 3) * 0.9, 0, TAU); ctx.fill();
    }
  } else if (fx === 'deep') { // W7: rising bubbles + sweeping light shafts
    for (let i = 0; i < 20; i++) {
      const s = i * 91.7;
      const x = ((s * 23.7) % view.w + Math.sin(t * 0.9 + i * 2) * 26 - camx * 0.08 + view.w * 3) % view.w;
      const y = view.h - ((s * 11.3 + t * (34 + (i % 4) * 16)) % (view.h + 60));
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = 'rgba(165,236,255,0.8)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(x, y, 2 + (i % 4) * 2.2, 0, TAU); ctx.stroke();
    }
    const sw = ((t * 26) % (view.w + 400)) - 200;
    const gr = ctx.createLinearGradient(sw, 0, sw + 180, view.h);
    gr.addColorStop(0, 'rgba(120,220,255,0)'); gr.addColorStop(0.5, 'rgba(120,220,255,0.07)'); gr.addColorStop(1, 'rgba(120,220,255,0)');
    ctx.globalAlpha = 1; ctx.fillStyle = gr;
    ctx.beginPath(); ctx.moveTo(sw, 0); ctx.lineTo(sw + 90, 0); ctx.lineTo(sw + 270, view.h); ctx.lineTo(sw + 90, view.h); ctx.closePath(); ctx.fill();
  } else if (fx === 'orbit') { // W8: slow orbiting shard constellations
    for (let c = 0; c < 2; c++) {
      const cx = view.w * (0.3 + c * 0.42) - (camx * 0.12) % (view.w * 0.5), cy = view.h * 0.35 + Math.sin(t * 0.4 + c) * 30;
      for (let i = 0; i < 7; i++) {
        const a = t * (0.16 + c * 0.05) + i * TAU / 7;
        const r = 70 + i * 16;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.6;
        ctx.save(); ctx.translate(x, y); ctx.rotate(a);
        ctx.globalAlpha = 0.4; ctx.fillStyle = '#3ce6a4';
        ctx.fillRect(-3, -3, 6, 6); ctx.restore();
      }
    }
  } else if (fx === 'solar') { // W9: rotating sun disc + heat streaks
    const sx = view.w * 0.72 - camx * 0.06, sy = view.h * 0.24;
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(t * 0.05);
    for (let i = 0; i < 12; i++) {
      ctx.rotate(TAU / 12);
      const gr = ctx.createLinearGradient(0, 0, 0, -190);
      gr.addColorStop(0, 'rgba(255,202,106,0.14)'); gr.addColorStop(1, 'rgba(255,202,106,0)');
      ctx.fillStyle = gr; ctx.fillRect(-9, -190, 18, 190);
    }
    ctx.globalAlpha = 0.9; ctx.drawImage(Glow.sprite('#ffca6a', 90), -90, -90);
    ctx.restore();
  } else if (fx === 'nexus') { // W10: colossal nexus ring + falling star streaks
    const rx = view.w * 0.62 - (camx * 0.1) % view.w, ry = view.h * 0.3 - camy * 0.06;
    ctx.save(); ctx.translate(rx, ry); ctx.rotate(t * 0.03);
    ctx.globalAlpha = 0.35; ctx.drawImage(nexusRing, -110, -110); ctx.restore();
    for (let i = 0; i < 5; i++) {
      const s = i * 211.3, cyc = (t * 0.5 + s) % 3;
      if (cyc > 1.2) continue;
      const x = ((s * 61.7) % view.w + view.w) % view.w, y = cyc / 1.2 * view.h;
      ctx.globalAlpha = 0.7 * Math.sin(Math.PI * (cyc / 1.2));
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 26, y - 60); ctx.stroke();
    }
  }
  ctx.restore();
}

function drawBackground(ctx, w, cam, viewW, viewH, t) {
  const worldId = w.def.world;
  const bg = bgFor(worldId);
  const pal = bg.pal;
  // composite the whole sky stack at HALF resolution, then 1 upscaled blit
  const cw = Math.ceil(viewW / 2), ch = Math.ceil(viewH / 2);
  const ck = worldId + '_' + cw;
  let cp = BG.compose;
  if (!cp || BG.composeKey !== ck) {
    cp = BG.compose = document.createElement('canvas');
    cp.width = cw; cp.height = ch;
    BG.composeKey = ck; BG.skyGrad = null; BG.hzGrad = null;
  }
  const g2 = cp.getContext('2d');
  if (!BG.skyGrad) {
    const sg = g2.createLinearGradient(0, 0, 0, viewH);
    sg.addColorStop(0, pal.sky[0]); sg.addColorStop(0.55, pal.sky[1]); sg.addColorStop(1, pal.sky[2]);
    BG.skyGrad = sg;
    const hg = g2.createLinearGradient(0, viewH * 0.5, 0, viewH);
    hg.addColorStop(0, 'rgba(0,0,0,0)'); hg.addColorStop(1, pal.glow);
    BG.hzGrad = hg;
  }
  g2.setTransform(0.5, 0, 0, 0.5, 0, 0);
  g2.fillStyle = BG.skyGrad; g2.fillRect(0, 0, viewW, viewH);
  const iw = bg.stars.width * 2, ih = bg.stars.height * 2;
  let sx = -((cam.x * 0.06) % iw); if (sx > 0) sx -= iw;
  const sy = -cam.y * 0.04;
  for (let x = sx; x < viewW; x += iw) g2.drawImage(bg.stars, x, sy, iw, ih);
  if (bg.aurora) {
    g2.globalAlpha = 0.55 + Math.sin(t * 0.4) * 0.25;
    const aw = bg.aurora.width * 2, ah = bg.aurora.height * 2;
    let ax = -((cam.x * 0.08 + t * 14) % aw); if (ax > 0) ax -= aw;
    for (let x = ax; x < viewW; x += aw) g2.drawImage(bg.aurora, x, 60 - cam.y * 0.03, aw, ah);
    g2.globalAlpha = 1;
  }
  if (bg.rays) {
    g2.globalCompositeOperation = 'lighter';
    g2.globalAlpha = 0.5 + Math.sin(t * 0.3) * 0.2;
    const rw = bg.rays.width * 2, rh = bg.rays.height * 2;
    let rx = -((cam.x * 0.1 + t * 6) % rw); if (rx > 0) rx -= rw;
    for (let x = rx; x < viewW; x += rw) g2.drawImage(bg.rays, x, -cam.y * 0.05, rw, rh);
    g2.globalCompositeOperation = 'source-over';
    g2.globalAlpha = 1;
  }
  const layers = [[bg.far, 0.16, 0.94], [bg.mid, 0.32, 0.97], [bg.near, 0.52, 1]];
  for (const [img, f, yAnchor] of layers) {
    const iw2 = img.width * 2, ih2 = img.height * 2;
    let ox = -((cam.x * f) % iw2); if (ox > 0) ox -= iw2;
    const oy = viewH - ih2 * yAnchor - (cam.y * f * 0.1);
    for (let x = ox; x < viewW; x += iw2) g2.drawImage(img, x, oy, iw2, ih2);
  }
  g2.fillStyle = BG.hzGrad; g2.fillRect(0, viewH * 0.5, viewW, viewH * 0.5);
  g2.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(cp, 0, 0, viewW, viewH);
  // drifting background creatures (flapping silhouettes, parallax 0.15)
  if (!BG.critters) BG.critters = {};
  let cr = BG.critters[worldId];
  if (!cr) {
    cr = BG.critters[worldId] = [];
    const rnd2 = seedRng(worldId * 31 + 5);
    for (let i = 0; i < 7; i++) cr.push({ x: rnd2() * 1600, y: 50 + rnd2() * 250, s: 0.55 + rnd2() * 0.7, sp: 10 + rnd2() * 16, ph: rnd2() * TAU });
  }
  ctx.strokeStyle = hexA0(pal.near, 0.8);
  ctx.lineWidth = 2;
  for (const b of cr) {
    const bx = ((b.x - t * b.sp - cam.x * 0.15) % (viewW + 240) + viewW + 240) % (viewW + 240) - 120;
    const by = b.y + Math.sin(t * 0.6 + b.ph) * 14 - cam.y * 0.08;
    const fl = Math.sin(t * 6 + b.ph) * 0.7 + 1;
    const s = b.s * 8;
    ctx.beginPath();
    ctx.moveTo(bx - s, by + fl * s * 0.35);
    ctx.quadraticCurveTo(bx - s * 0.5, by - fl * s * 0.45, bx, by);
    ctx.quadraticCurveTo(bx + s * 0.5, by - fl * s * 0.45, bx + s, by + fl * s * 0.35);
    ctx.stroke();
  }
  // world weather: sand streaks (2) / drifting fog (4)
  if (worldId === 2) {
    if (!BG.sand) { BG.sand = []; const r2 = seedRng(99); for (let i = 0; i < 12; i++) BG.sand.push({ y: 60 + r2() * 520, len: 70 + r2() * 110, sp: 260 + r2() * 220, ph: r2() * 1000 }); }
    ctx.strokeStyle = 'rgba(240,200,140,0.14)'; ctx.lineWidth = 2;
    for (const s of BG.sand) {
      const sy = s.y + Math.sin(t * 0.8 + s.ph) * 10 - cam.y * 0.1;
      const sx = ((s.ph * 97 - t * s.sp - cam.x * 0.35) % (viewW + 300) + viewW + 300) % (viewW + 300) - 150;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + s.len, sy + s.len * 0.08); ctx.stroke();
    }
  } else if (worldId === 4) {
    const fog = Sprites.get('FOG4', 256, 128, (g) => {
      const gr = g.createRadialGradient(128, 64, 8, 128, 64, 120);
      gr.addColorStop(0, 'rgba(84,96,170,0.32)'); gr.addColorStop(1, 'rgba(84,96,170,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
    });
    if (!BG.fog) { BG.fog = []; const r3 = seedRng(777); for (let i = 0; i < 5; i++) BG.fog.push({ x: r3() * 1200, y: 60 + r3() * 420, sp: 8 + r3() * 10, s: 1 + r3() * 1.6, ph: r3() * TAU }); }
    for (const f of BG.fog) {
      const fx = ((f.x - t * f.sp - cam.x * 0.2) % (viewW + 520) + viewW + 520) % (viewW + 520) - 260;
      const fy = f.y + Math.sin(t * 0.5 + f.ph) * 16 - cam.y * 0.06;
      ctx.globalAlpha = 0.7;
      ctx.drawImage(fog, fx, fy, 256 * f.s, 128 * f.s);
    }
    ctx.globalAlpha = 1;
  }
  drawWorldFX(ctx, worldId, { w: viewW, h: viewH }, cam.x, cam.y, t);
  // twinkle overlay (a few cheap rects on the main canvas)
  ctx.fillStyle = pal.star;
  for (let i = 0; i < 12; i++) {
    const tw = Math.sin(t * (0.8 + (i % 5) * 0.3) + i * 2.4);
    if (tw > 0.2) {
      ctx.globalAlpha = tw * 0.8;
      const px = ((i * 173 + 40 - cam.x * 0.06) % viewW + viewW) % viewW;
      const py = ((i * 97 + 20 - cam.y * 0.04) % 300 + 300) % 300;
      ctx.fillRect(px, py, 2, 2);
    }
  }
  ctx.globalAlpha = 1;
}

/* foreground depth layer — drawn AFTER the world */
function drawForeground(ctx, worldId, cam, viewW, viewH, t) {
  const bg = bgFor(worldId);
  const sc = viewH / 720;
  const iw = bg.fore.width * sc, ih = bg.fore.height * sc;
  let ox = -((cam.x * 0.78) % iw); if (ox > 0) ox -= iw;
  const oy = viewH - ih - (cam.y * 0.2);
  ctx.globalAlpha = 0.5;
  for (let x = ox; x < viewW; x += iw) ctx.drawImage(bg.fore, x, oy, iw, ih);
  ctx.globalAlpha = 1;
}

/* void mist along the level bottom (world space) */
function drawVoidMist(ctx, w, view, t) {
  const bg = bgFor(w.def.world);
  const yTop = w.ph - 110;
  if (yTop > view.camy + view.h || yTop + 120 < view.camy) return;
  const drift = (t * 10) % 512;
  ctx.globalAlpha = 0.85;
  for (let x = view.camx - 512 + (512 - drift); x < view.camx + view.w + 512; x += 512) {
    ctx.drawImage(bg.mist, Math.round(x), yTop);
  }
  ctx.globalAlpha = 1;
}

/* ============================================================
   LUMORA — c5_draw: character, enemies, pickups, lighting, FX
   Glow-lights and static art come from cached sprites; the hot
   path avoids shadowBlur and per-frame gradient creation.
   ============================================================ */
const Glow = {
  map: new Map(),
  sprite(color, r) {
    const key = color + '|' + Math.round(r);
    let c = Glow.map.get(key);
    if (!c) {
      if (Glow.map.size > 140) Glow.map.clear();
      c = document.createElement('canvas');
      c.width = c.height = Math.round(r) * 2;
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(r, r, 1, r, r, r);
      grad.addColorStop(0, Glow.rgba(color, 0.85));
      grad.addColorStop(0.45, Glow.rgba(color, 0.3));
      grad.addColorStop(1, Glow.rgba(color, 0));
      g.fillStyle = grad;
      g.fillRect(0, 0, c.width, c.height);
      Glow.map.set(key, c);
    }
    return c;
  },
  rgba(color, a) {
    if (color[0] === '#') {
      const n = parseInt(color.slice(1), 16);
      return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
    }
    return color;
  },
};

/* ---------- player ---------- */
/* ------- movement trail FX engine (ribbon / lightning / petals / spectrum) ------- */
function drawTrailFx(ctx, p, t) {
  if (typeof Cos === 'undefined' || !p || !p._trailBuf || p._trailBuf.length < 2) return;
  const st = Cos.forP(p).trail;
  if (!st || st === 'tr-none') return;
  const buf = p._trailBuf;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (st === 'tr-volt') { // jagged storm arcs
    ctx.strokeStyle = 'rgba(125,211,252,0.75)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < buf.length - 1; i++) {
      const a = buf[i], b = buf[i + 1];
      const mx = (a.x + b.x) / 2 + U.rand(-10, 10), my = (a.y + b.y) / 2 + U.rand(-10, 10);
      ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(mx, my, b.x, b.y);
    }
    ctx.stroke();
    ctx.globalAlpha = 0.55; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.stroke();
  } else if (st === 'tr-petal') { // swirling petals
    for (let i = 0; i < buf.length; i++) {
      const q = buf[i], k = 1 - i / buf.length;
      ctx.globalAlpha = 0.7 * k;
      ctx.fillStyle = i % 2 ? '#f9a8d4' : '#fbcfe8';
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.a + t * 4);
      ctx.beginPath(); ctx.ellipse(0, 0, 6.5 * k + 2, 3 * k + 1.2, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
  } else { // tapered glow ribbon — light / stars / flame / galaxy spectrum
    const PAL = { 'tr-light': null, 'tr-stars': null, 'tr-flame': null, 'tr-galaxy': null };
    if (!(st in PAL)) { ctx.restore(); return; }
    for (let i = 0; i < buf.length - 1; i++) {
      const a = buf[i], b = buf[i + 1], k = 1 - i / buf.length;
      let col;
      if (st === 'tr-galaxy') col = 'hsla(' + ((t * 130 + i * 26) % 360) + ',90%,72%,' + (0.5 * k).toFixed(3) + ')';
      else if (st === 'tr-flame') col = 'rgba(255,' + Math.round(120 + 90 * k) + ',60,' + (0.45 * k).toFixed(3) + ')';
      else if (st === 'tr-stars') col = 'rgba(255,215,106,' + (0.42 * k).toFixed(3) + ')';
      else col = 'rgba(191,233,255,' + (0.4 * k).toFixed(3) + ')';
      ctx.strokeStyle = col;
      ctx.lineWidth = 9.5 * k + 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }
  ctx.restore();
}

function drawPlayer(ctx, p, t) {
  const cos = (typeof Cos !== 'undefined') ? Cos.forP(p) : null;
  const skin = cos ? Cos.find('skins', cos.skin) : { c1: '#f4f7ff', c2: '#8fa3c8' };
  const layerCol = LAYER_META[p.curLayer].color;
  const cx = p.x + p.w / 2;
  const feetY = p.gravSign > 0 ? p.y + p.boxH : p.y;
  const flicker = p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0;
  if (flicker) ctx.globalAlpha = 0.4;

  // soft aura under the character (cached sprite)
  ctx.drawImage(Glow.sprite(layerCol, 44), cx - 44, feetY - 30);

  // scarf (behind body)
  ctx.save();
  ctx.strokeStyle = 'rgba(255,120,140,0.85)';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(p.scarf[0].x, p.scarf[0].y);
  for (let i = 1; i < p.scarf.length; i++) { const s = p.scarf[i]; ctx.lineWidth = 7 - (i / p.scarf.length) * 5.4; ctx.lineTo(s.x, s.y); }
  ctx.stroke();
  ctx.restore();

  drawTrailFx(ctx, p, t);

  const runCycle = p.anim === 'run' ? Math.sin(p.animT * 14) : 0;
  const bob = p.anim === 'idle' ? Math.sin(p.animT * 2.6) * 2.4 : 0;
  let sx = p.squash, sy = p.stretch;
  if (p.anim === 'slide') { sx = 1.35; sy = 0.55; }
  if (p.anim === 'wall') { sx = 0.85; sy = 1.12; }

  ctx.save();
  ctx.translate(cx, feetY);
  ctx.scale(p.face * sx, (p.gravSign > 0 ? 1 : -1) * sy);
  const H = 54, W = 30;
  Cos.auraDraw(ctx, p, cos, t);
  Cos.capeDraw(ctx, cos, t, p.anim === 'run');
  const bodyGrad = ctx.createLinearGradient(0, -H, 0, 0);
  bodyGrad.addColorStop(0, skin.c1);
  bodyGrad.addColorStop(0.55, skin.c1);
  bodyGrad.addColorStop(1, skin.c2);
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(-W / 2 + 3, 0);
  ctx.quadraticCurveTo(-W / 2 - 3, -H * 0.45, -W / 2 + 6, -H * 0.72 - runCycle * 2);
  ctx.quadraticCurveTo(-4, -H - 4 + bob, W / 2 - 5, -H * 0.7 + runCycle * 2);
  ctx.quadraticCurveTo(W / 2 + 3, -H * 0.4, W / 2 - 3, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = layerCol; ctx.lineWidth = 2;
  ctx.stroke();
  // hood tip
  const headY = -H - 10 + bob * 0.5;
  ctx.fillStyle = '#aebfd8';
  ctx.beginPath(); ctx.moveTo(-10, headY - 4); ctx.quadraticCurveTo(-2, headY - 18, 8, headY - 6); ctx.quadraticCurveTo(-2, headY - 8, -10, headY - 4); ctx.fill();
  // head
  ctx.fillStyle = '#f8faff';
  ctx.beginPath(); ctx.arc(1, headY, 12, 0, TAU); ctx.fill();
  ctx.strokeStyle = layerCol; ctx.lineWidth = 1.8; ctx.stroke();
  // eyes
  ctx.fillStyle = '#101528';
  const eyeY = headY - 1, blink = (Math.sin(t * 1.1) > 0.97) ? 0.15 : 1;
  ctx.save(); ctx.translate(4, eyeY); ctx.scale(1, blink);
  ctx.beginPath(); ctx.ellipse(0, 0, 3.2, 4.2, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(8, 0.6, 2.6, 3.6, 0, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.fillStyle = layerCol;
  ctx.globalAlpha *= 0.9;
  ctx.beginPath(); ctx.arc(4.4, eyeY + 0.6, 1.3, 0, TAU); ctx.fill();
  Cos.hatDraw(ctx, cos);
  ctx.restore();

  // prism ring on double jump
  if (p.dblFx > 0) {
    ctx.save();
    ctx.globalAlpha = p.dblFx;
    ctx.strokeStyle = '#7dd3fc'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(cx, feetY - 30, 26 * (1.4 - p.dblFx * 0.5), 34 * (1.4 - p.dblFx * 0.5), 0, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/* ---------- best-run ghost (remastered rival) ---------- */
function drawGhostRunner(ctx, g, t) {
  if (!g || !isFinite(g.x)) return;
  const col = LAYER_META[g.m.layer].color;
  const h = g.m.slide ? 28 : 54;
  const fy = g.m.gs > 0 ? g.y + h : g.y;
  ctx.save();
  ctx.globalAlpha = 0.42 + Math.sin(t * 5) * 0.07;
  ctx.drawImage(Glow.sprite(col, 36), g.x + 15 - 36, fy - 34);
  ctx.translate(g.x + 15, fy);
  ctx.scale(g.m.face || 1, g.m.gs > 0 ? 1 : -1);
  ctx.strokeStyle = col; ctx.lineWidth = 2.2;
  ctx.fillStyle = 'rgba(150,205,255,0.22)';
  rr(ctx, -15, -h, 30, h, 9); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(1, -h - 9, 11, 0, TAU); ctx.stroke();
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(4, -h - 10, 3, 0, TAU); ctx.fill();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(-14, -h - 9); ctx.lineTo(-26, -h - 9); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  ctx.globalAlpha = 1;
}

/* ---------- tossed head on death ---------- */
function drawDeadHead(ctx, hf) {
  ctx.save();
  ctx.translate(hf.x, hf.y);
  ctx.rotate(hf.rot);
  ctx.globalAlpha = Math.max(0, 1 - Math.max(0, hf.t - 1.1) / 0.5);
  ctx.drawImage(Glow.sprite('#ff6b7a', 26), -26, -26);
  ctx.fillStyle = '#f8faff';
  ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.fill();
  ctx.strokeStyle = LAYER_META[hf.layer].color; ctx.lineWidth = 1.8; ctx.stroke();
  ctx.fillStyle = '#aebfd8';
  ctx.beginPath(); ctx.moveTo(-10, -6); ctx.quadraticCurveTo(-2, -18, 8, -6); ctx.quadraticCurveTo(-2, -8, -10, -6); ctx.fill();
  ctx.strokeStyle = '#101528'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(2, -3); ctx.lineTo(8, 3); ctx.moveTo(8, -3); ctx.lineTo(2, 3);
  ctx.stroke();
  ctx.restore();
}

/* ---------- enemies ---------- */
const enemyGlowCache = {};
function drawEnemy(ctx, e, t, layerId, view) {
  if (e.dead) return;
  const col = LAYER_META[e.layer].color;
  const active = e.layer === layerId;
  if (e.x > view.camx + view.w + 90 || e.x < view.camx - 90 || e.y > view.camy + view.h + 90 || e.y < view.camy - 90) return;
  ctx.save();
  ctx.translate(e.x, e.y);
  if (!active) { ctx.globalAlpha = 0.14; }
  if (e instanceof Wisp) {
    const fl = Math.sin(e.t * 6) * 0.15 + 1;
    ctx.drawImage(Glow.sprite(col, 30 * fl), -30 * fl, -30 * fl);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, -22 * fl);
    ctx.quadraticCurveTo(16, -4, 8, 16);
    ctx.quadraticCurveTo(0, 24, -8, 16);
    ctx.quadraticCurveTo(-16, -4, 0, -22 * fl);
    ctx.fill();
    ctx.fillStyle = 'rgba(10,14,30,0.9)';
    ctx.beginPath(); ctx.ellipse(-4, 0, 2.6, 4, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(4, 0, 2.6, 4, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(0, 2, 11, 0.35, Math.PI - 0.35); ctx.stroke();
  } else if (e instanceof Crawler) {
    ctx.drawImage(Glow.sprite(col, 26), -26, -26);
    ctx.fillStyle = '#2a3550';
    ctx.beginPath(); ctx.ellipse(0, 0, 22, 15, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.fillStyle = col;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 12 - 5, -12); ctx.lineTo(i * 12, -22 - Math.sin(e.t * 8 + i) * 3); ctx.lineTo(i * 12 + 5, -12);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#ff6b7a';
    ctx.beginPath(); ctx.arc(e.dir * 10, -2, 3.4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#0c1020';
    for (let i = 0; i < 4; i++) ctx.fillRect(-16 + i * 8, 10, 5, 6);
  } else if (e instanceof Sentry) {
    ctx.drawImage(Glow.sprite(col, 30), -30, -30);
    ctx.fillStyle = '#313d5e';
    rr(ctx, -18, -16, 36, 32, 9); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#101528';
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ctx.fill();
    const aim = e.aim || 0;
    ctx.fillStyle = active ? '#ff6b7a' : col;
    ctx.beginPath(); ctx.arc(Math.cos(aim) * 4, Math.sin(aim) * 4, 5, 0, TAU); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(Math.cos(aim) * 9, Math.sin(aim) * 9); ctx.lineTo(Math.cos(aim) * 19, Math.sin(aim) * 19); ctx.stroke();
    if (e.locking && active) { // aim-lock telegraph: dodge by moving!
      ctx.save();
      ctx.globalAlpha *= 0.35 + Math.sin(e.t * 40) * 0.25;
      ctx.strokeStyle = '#ff6b7a'; ctx.lineWidth = 1.5;
      ctx.setLineDash([7, 6]);
      const lx = Math.cos(e.lockedAim), ly = Math.sin(e.lockedAim);
      ctx.beginPath(); ctx.moveTo(lx * 22, ly * 22); ctx.lineTo(lx * 540, ly * 540); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
    if (e.cd < 0.4 && active) {
      ctx.globalAlpha *= 0.6 + Math.sin(e.t * 30) * 0.4;
      ctx.fillStyle = '#ff6b7a';
      ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.fill();
    }
  } else if (e instanceof Mirage) {
    // phase-stalker: dormant = faint ember, flicker = strobing, hunt = full ghost
    let a = 1;
    if (e.state === 'dormant') a = 0.3 + Math.sin(e.t * 2) * 0.1;
    else if (e.state === 'flicker') a = (Math.floor(e.t * 16) % 2) ? 0.85 : 0.15;
    else a = 0.9 + Math.sin(e.t * 6) * 0.1;
    ctx.globalAlpha *= a;
    // afterimages while hunting
    if (e.state === 'hunt') {
      for (let k = 1; k <= 2; k++) {
        ctx.save();
        ctx.globalAlpha *= (0.16 / k);
        ctx.translate(Math.cos(e.t * 3 + k) * 10, Math.sin(e.t * 3.6 + k) * 10);
        drawMirageBody(ctx, col);
        ctx.restore();
      }
    }
    drawMirageBody(ctx, col);
    if (e.state === 'flicker') { // "about to shift!" tell
      ctx.globalAlpha = 0.5 + Math.sin(e.t * 30) * 0.4;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, 30, 0, TAU); ctx.stroke();
    }
  } else if (e instanceof Boss) {
    const shielded = Game.player && Game.player.curLayer !== e.layer;
    // telegraph ring in the boss's current layer color — shields read at a glance
    ctx.save();
    ctx.globalAlpha = shielded ? 0.5 : 0.95;
    ctx.strokeStyle = shielded ? '#8892b8' : LAYER_META[e.layer].color;
    ctx.lineWidth = 3.5;
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -e.t * 40;
    ctx.beginPath(); ctx.arc(0, 0, 78 + Math.sin(e.t * 3) * 5, 0, TAU); ctx.stroke();
    ctx.restore();
    ctx.drawImage(Glow.sprite(shielded ? '#8892b8' : LAYER_META[e.layer].color, 110), -110, -110);
    const g2 = ctx.createRadialGradient(0, -10, 10, 0, 0, 64);
    g2.addColorStop(0, shielded ? '#a8b2d8' : '#8a1f38');
    g2.addColorStop(1, shielded ? '#3a4260' : '#2a0c18');
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.moveTo(-52, -30); ctx.quadraticCurveTo(-60, 10, -30, 48);
    ctx.quadraticCurveTo(0, 66, 30, 48); ctx.quadraticCurveTo(60, 10, 52, -30);
    ctx.quadraticCurveTo(24, -58, -52, -30);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = shielded ? 'rgba(150,170,220,0.9)' : 'rgba(255,107,122,0.9)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#1a0e18';
    for (let i = -2; i <= 2; i++) {
      ctx.save(); ctx.translate(i * 20, -44 - Math.abs(i) * -6); ctx.rotate(i * 0.3);
      ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(6, 4); ctx.lineTo(-6, 4); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    const pu = 1 + Math.sin(e.t * 5) * 0.15;
    ctx.fillStyle = shielded ? '#7dd3fc' : '#ffd76a';
    ctx.beginPath(); ctx.ellipse(0, -8, 14 * pu, 18 * pu, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#0c0a14';
    ctx.beginPath(); ctx.ellipse(0, -8, 6 * pu, 9 * pu, 0, 0, TAU); ctx.fill();
    if (e.hitFlash > 0) { ctx.globalAlpha = e.hitFlash * 2; ctx.fillStyle = '#fff'; rr(ctx, -56, -56, 112, 112, 30); ctx.fill(); }
    if (e.state === 'laser' && e.laserOn) {
      ctx.globalAlpha = 0.9;
      const ly = e.laserY - e.y;
      const lg = ctx.createLinearGradient(0, ly - 26, 0, ly + 26);
      lg.addColorStop(0, 'rgba(255,107,122,0)'); lg.addColorStop(0.5, 'rgba(255,107,122,0.95)'); lg.addColorStop(1, 'rgba(255,107,122,0)');
      ctx.fillStyle = lg;
      ctx.fillRect(-2400, ly - 26, 5200, 52);
    }
  }
  ctx.restore();
}

function drawMirageBody(ctx, col) {
  ctx.drawImage(Glow.sprite(col, 30), -30, -30);
  ctx.fillStyle = 'rgba(10,12,26,0.55)';
  ctx.strokeStyle = col; ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(0, -22); ctx.lineTo(16, 0); ctx.lineTo(0, 22); ctx.lineTo(-16, 0);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(7, 0); ctx.lineTo(0, 10); ctx.lineTo(-7, 0); ctx.closePath(); ctx.fill();
  // eye slit — it is WATCHING
  ctx.fillStyle = '#ff6b7a';
  ctx.fillRect(-5, -2, 10, 2.6);
}

function drawShots(ctx, layerId, view) {
  for (const s of Shots.list) {
    if (s.layer !== layerId) continue;
    if (s.x > view.camx + view.w + 40 || s.x < view.camx - 40) continue;
    ctx.drawImage(Glow.sprite(s.color, 16), s.x - 16, s.y - 16);
    ctx.fillStyle = s.color;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 0.45, 0, TAU); ctx.fill();
  }
}

/* ---------- pickups ---------- */
const crystalSprite = Sprites.get('CR', 40, 44, (g) => {
  g.translate(20, 22);
  g.shadowColor = '#59f2e0'; g.shadowBlur = 12;
  const g2 = g.createLinearGradient(0, -12, 0, 14);
  g2.addColorStop(0, '#c8fff4'); g2.addColorStop(1, '#18c9b8');
  g.fillStyle = g2;
  g.beginPath(); g.moveTo(0, -12); g.lineTo(8, 0); g.lineTo(0, 14); g.lineTo(-8, 0); g.closePath(); g.fill();
  g.shadowBlur = 0;
  g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 1; g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.45)';
  g.beginPath(); g.moveTo(0, -12); g.lineTo(0, 14); g.stroke();
});
const orbSprite = Sprites.get('OR', 56, 56, (g) => {
  g.translate(28, 28);
  g.shadowColor = '#ffd76a'; g.shadowBlur = 18;
  g.strokeStyle = '#ffd76a'; g.lineWidth = 2;
  g.beginPath(); g.arc(0, 0, 13, 0, TAU); g.stroke();
  g.fillStyle = 'rgba(255,215,106,0.95)';
  g.beginPath(); g.arc(0, 0, 7, 0, TAU); g.fill();
  g.shadowBlur = 0;
  g.globalAlpha = 0.7;
  g.beginPath(); g.ellipse(0, 0, 19, 7, 0, 0, TAU); g.stroke();
  g.beginPath(); g.ellipse(0, 0, 7, 19, 0, 0, TAU); g.stroke();
});
function drawCrystals(ctx, w, t, layerId, view) {
  for (const c of w.crystals) {
    if (c.taken) continue;
    if (c.x > view.camx + view.w + 50 || c.x < view.camx - 50) continue;
    const bob = Math.sin(t * 2.4 + c.t) * 4;
    ctx.drawImage(Glow.sprite(c.orb ? '#ffd76a' : '#59f2e0', 26), c.x - 26, c.y + bob - 26);
    if (c.orb) {
      ctx.save();
      ctx.translate(c.x, c.y + bob);
      ctx.rotate(t * 1.2);
      ctx.drawImage(orbSprite, -28, -28);
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(c.x, c.y + bob);
      ctx.rotate(Math.sin(t + c.t) * 0.25);
      ctx.drawImage(crystalSprite, -20, -22);
      ctx.restore();
    }
  }
}

/* ---------- lighting ---------- */
const Light = { canvas: null };
function drawLighting(ctx, w, p, view, t) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const d of w.decos) {
    if (d.type === 'torch') {
      const dx = d.x - view.camx, dy = d.y - 34 - view.camy;
      if (dx < -80 || dx > view.w + 80) continue;
      const fl = 0.9 + Math.sin(t * 7 + d.x) * 0.15;
      ctx.globalAlpha = 0.5;
      ctx.drawImage(Glow.sprite('#ffa04c', 92 * fl), dx - 92 * fl, dy - 92 * fl);
    } else if (d.type === 'lantern') {
      const dx = d.x - view.camx, dy = d.y - view.camy;
      if (dx < -80 || dx > view.w + 80) continue;
      ctx.globalAlpha = 0.45;
      ctx.drawImage(Glow.sprite('#9f7aea', 74), dx - 74, dy - 74);
    }
  }
  const px = p.x + 15 - view.camx, py = p.y + p.boxH / 2 - view.camy;
  if (isFinite(px) && isFinite(py)) {
    ctx.globalAlpha = 0.4;
    ctx.drawImage(Glow.sprite(LAYER_META[p.curLayer].color, 130), px - 130, py - 130);
  }
  ctx.restore();

  // shadow-layer darkness (holes punched with cached glow sprites)
  if (p.curLayer === LY.SHADOW) {
    if (!Light.canvas) Light.canvas = document.createElement('canvas');
    const lc = Light.canvas;
    const lw = Math.ceil(view.w), lh = 720;
    if (lc.width !== lw || lc.height !== lh) { lc.width = lw; lc.height = lh; }
    const lg = lc.getContext('2d');
    lg.globalCompositeOperation = 'source-over';
    lg.clearRect(0, 0, lw, lh);
    lg.fillStyle = 'rgba(2,4,14,0.93)';
    lg.fillRect(0, 0, lw, lh);
    lg.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r, a) => {
      if (x < -r || x > lw + r) return;
      lg.globalAlpha = a;
      lg.drawImage(Glow.sprite('#ffffff', r), x - r, y - r);
    };
    hole(px, py, 200, 1);
    hole(px, py, 340, 0.4);
    const g = w.gate;
    hole(g.x + 26 - view.camx, g.y + 48 - view.camy, 130, 0.75);
    for (const c of w.crystals) { if (!c.taken) hole(c.x - view.camx, c.y - view.camy, 64, 0.5); }
    for (const d of w.decos) { if (d.type === 'lantern') hole(d.x - view.camx, d.y - view.camy, 84, 0.65); }
    for (const cp of w.checkpoints) { if (cp.on) hole(cp.x - view.camx, cp.y - 40 - view.camy, 90, 0.6); }
    lg.globalAlpha = 1;
    ctx.drawImage(lc, 0, 0);
  }
}
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}

/* ---------- full-screen FX: vignette + grain (cached) ---------- */
let grainPattern = null;
function getGrain(ctx) {
  if (grainPattern) return grainPattern;
  const c = document.createElement('canvas');
  c.width = c.height = 160;
  const g = c.getContext('2d');
  const img = g.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 14;
  }
  g.putImageData(img, 0, 0);
  grainPattern = ctx.createPattern(c, 'repeat');
  return grainPattern;
}
function drawLayerFX(ctx, p, view, t) {
  const f = Math.max(0, p.shiftFlash);
  if (f > 0) {
    const col = LAYER_META[p.curLayer].color;
    ctx.fillStyle = hexA(col, f * 0.16);
    ctx.fillRect(0, 0, view.w, view.h);
    if (f > 0.4 && typeof ctx.canvas !== 'undefined') {
      const cnv = ctx.canvas;
      for (let i = 0; i < 6; i++) {
        const sy = U.rand(0, view.h), hh = U.rand(6, 26), off = U.rand(-24, 24) * f;
        try { ctx.drawImage(cnv, 0, sy * DPRS.s, cnv.width, hh * DPRS.s, off, sy, view.w, hh); } catch (err) { /* ignore */ }
      }
    }
  }
  // vignette (cached sprite scaled to view)
  const vg = Sprites.get('VG' + Math.round(view.w), 512, 288, (g) => {
    const grad = g.createRadialGradient(256, 144, 120, 256, 144, 260);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(2,4,10,0.6)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 288);
  });
  ctx.drawImage(vg, 0, 0, view.w, view.h);
  // film grain (skipped on low quality)
  if (Save.data.settings.particles !== 'low') {
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = getGrain(ctx);
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.globalAlpha = 1;
  }
}

const DPRS = { s: 1 };

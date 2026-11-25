/* ============================================================
   LUMORA — c3_engine: world build, collision, camera, particles
   ============================================================ */
const PHYS = {
  GRAV: 2500, GRAV_FALL: 2950, MAX_FALL: 1160,
  RUN: 360, ACC_G: 2800, ACC_A: 1900, FRIC_G: 2600, FRIC_A: 480,
  JUMP_V: -960, DJUMP_V: -860, JUMP_CUT: 0.42,
  COYOTE: 0.1, BUFFER: 0.14,
  WALL_SLIDE: 190, WALLJUMP_X: 430, WALLJUMP_Y: -830,
  CLIMB_UP: 175, CLIMB_DOWN: 245, CLIMB_DRAIN: 7,
  SLIDE_BOOST: 545, SLIDE_END: 235, SLIDE_H: 28, SLIDE_CD: 0.3,
  STOMP_V: -620, STOMP_HOLD: -790,
  SWITCH_COST: 22, SWITCH_LOCK: 0.12, HIT_COST: 35, INVULN: 1.1,
  REGEN: 5, REGEN_ENERGY_LAYER: 16, SHADE_KILL_R: 150,
};

/* ---------- build world from level def ---------- */
function buildWorld(def) {
  const w = {
    def, id: def.id, pw: def.w * T, ph: def.h * T,
    solidsAll: [], solidsByLayer: [[], [], [], []],
    hazards: [], movers: [], crystals: [], checkpoints: [], signs: [], decos: [],
    enemies: [], spawn: { x: (def.spawn[0] + 0.5) * T, y: def.spawn[1] * T },
    gate: { x: (def.gate[0] + 0.5) * T - 26, y: (def.gate[1] - 2) * T, w: 52, h: 96, locked: !!def.gateLocked },
    bossDef: def.boss || null, curLayer: def.layerStart || 0, time: 0,
  };
  for (const s of def.solids) {
    const r = { x: s[0] * T, y: s[1] * T, w: s[2] * T, h: s[3] * T, layer: s[4], climb: s[4] === 'c' };
    if (r.layer === 'a' || r.layer === 'c') w.solidsAll.push(r);
    else w.solidsByLayer[r.layer].push(r);
  }
  for (const ow of def.oneway) {
    w.solidsByLayer[ow[3] === undefined ? 0 : ow[3]].push({ x: ow[0] * T, y: ow[1] * T, w: ow[2] * T, h: 10, oneway: true });
  }
  for (const hz of def.hazards) {
    const layer = hz[5] === undefined ? (hz[4] === undefined ? 0 : hz[4]) : hz[5];
    // format [type,x,y,w,layer] when h omitted
    let ty = hz[0], hx = hz[1], hy = hz[2], hw = hz[3], hh = 1, hl = hz[4];
    if (hz.length >= 6 && typeof hz[4] === 'number') { hh = hz[4]; hl = hz[5]; }
    if (ty === 'blade') {
      // ['blade', tx, ty, 0, 0, layer] — spinning blade anchored at tile center
      const cx = (hx + 0.5) * T, cy = (hy + 0.5) * T, r = 26 + (hw || 0);
      w.hazards.push({ type: 'blade', x: cx, y: cy, r, w: r * 2, h: r * 2, layer: hl === undefined ? 0 : hl, t: U.rand(0, 6) });
      continue;
    }
    const built = { type: ty, x: hx * T, y: hy * T, w: hw * T, h: (hh || 1) * T, layer: hl === undefined ? 0 : hl, t: U.rand(0, 6) };
    if (ty === 'electro') built.h = Math.min(built.h, 15); // thin floor panel
    w.hazards.push(built);
  }
  for (const mv of def.movers) {
    w.movers.push({ bx: mv[0] * T, by: mv[1] * T, w: mv[2] * T, h: mv[3] * T, dx: mv[4] * T, dy: mv[5] * T,
      period: mv[6], layer: mv[7], x: mv[0] * T, y: mv[1] * T, dxf: 0, dyf: 0, ph: U.rand(0, TAU) });
  }
  def.crystals.forEach((c, i) => w.crystals.push({ id: def.id + 'c' + i, x: (c[0] + 0.5) * T, y: (c[1] + 0.5) * T, taken: false, t: U.rand(0, TAU) }));
  def.orbs.forEach((o, i) => w.crystals.push({ id: def.id + 'o' + i, x: (o[0] + 0.5) * T, y: (o[1] + 0.5) * T, taken: false, t: U.rand(0, TAU), orb: true }));
  def.checkpoints.forEach(cp => w.checkpoints.push({ x: (cp[0] + 0.5) * T, y: cp[1] * T, on: false }));
  def.signs.forEach(sg => w.signs.push({ x: (sg[0] + 0.5) * T, y: sg[1] * T, text: sg[2] }));
  def.decos.forEach(d => w.decos.push({ type: d[0], x: (d[0 + 1]) * T, y: d[2] * T, s: d[3] || 1 }));
  for (const e of def.enemies) {
    w.enemies.push(makeEnemy(e[0], (e[1] + 0.5) * T, (e[2] + 1) * T, e[3], w));
  }
  return w;
}

/* ---------- collision ---------- */
function solidsFor(w, layer) {
  return w.solidsByLayer[layer].concat(w.solidsAll);
}
function moverRects(w, layer) {
  const out = [];
  for (const m of w.movers) if (m.layer === 'a' || m.layer === layer) out.push(m);
  return out;
}

function moveBody(e, w, layer, dx, dy, gravSign) {
  const res = { ground: false, ceil: false, wallL: false, wallR: false, climb: false, onMover: null };
  const bh = (e.boxH !== undefined && e.boxH !== null) ? e.boxH : e.h;
  const B = () => ({ x: e.x, y: e.y, w: e.w, h: bh });
  const solids = solidsFor(w, layer), movers = moverRects(w, layer);
  const all = solids; // movers handled below
  // horizontal
  e.x += dx;
  for (const r of all) {
    if (r.oneway) continue;
    if (U.overlaps(B(), r)) {
      if (dx > 0) { e.x = r.x - e.w; res.wallR = true; }
      else if (dx < 0) { e.x = r.x + r.w; res.wallL = true; }
      if (r.climb) res.climb = true;
    }
  }
  for (const m of movers) {
    if (U.overlaps(B(), m)) {
      if (dx > 0) { e.x = m.x - e.w; res.wallR = true; }
      else if (dx < 0) { e.x = m.x + m.w; res.wallL = true; }
    }
  }
  // vertical
  const prevBottom = e.y + bh - dy, prevTop = e.y - dy;
  e.y += dy;
  for (const r of all) {
    if (!U.overlaps(B(), r)) continue;
    if (r.oneway) {
      if (gravSign > 0 && dy > 0 && prevBottom <= r.y + 4) { e.y = r.y - bh; res.ground = true; e.vy = 0; }
      continue;
    }
    if (dy > 0) { e.y = r.y - bh; if (gravSign > 0) res.ground = true; else res.ceil = true; e.vy = 0; }
    else if (dy < 0) { e.y = r.y + r.h; if (gravSign < 0) res.ground = true; else res.ceil = true; e.vy = 0; }
  }
  for (const m of movers) {
    if (!U.overlaps(B(), m)) continue;
    if (dy > 0) { e.y = m.y - bh; if (gravSign > 0) { res.ground = true; res.onMover = m; } else res.ceil = true; e.vy = 0; }
    else if (dy < 0) { e.y = m.y + m.h; if (gravSign < 0) { res.ground = true; res.onMover = m; } else res.ceil = true; e.vy = 0; }
  }
  return res;
}

function groundedAt(e, w, layer, gravSign) {
  // probe 3px below feet (direction-aware)
  const probe = { x: e.x + 2, y: gravSign > 0 ? e.y + e.h - 2 : e.y - 2, w: e.w - 4, h: 6 };
  for (const r of solidsFor(w, layer)) { if (r.oneway) continue; if (U.overlaps(probe, r)) return true; }
  for (const m of moverRects(w, layer)) if (U.overlaps(probe, m)) return true;
  return false;
}

function touchingWall(e, w, layer, dir) {
  const probe = { x: e.x + (dir > 0 ? e.w - 2 : -2), y: e.y + 4, w: 6, h: e.h - 8 };
  let climb = false;
  for (const r of solidsFor(w, layer)) { if (r.oneway) continue; if (U.overlaps(probe, r)) { if (r.climb) climb = true; else return { wall: true, climb: false }; } }
  return { wall: false, climb };
}

function hazardHit(e, w, layer, dt) {
  const d = dt || 0.016;
  const ecx = e.x + (e.w || e.h || 20) / 2;
  for (const hz of w.hazards) {
    if (hz.layer !== 'a' && hz.layer !== layer) continue;
    if (hz.type === 'spike') { if (U.overlaps(e, hz)) return { dmg: 50, kx: ecx < hz.x + hz.w / 2 ? -300 : 300 }; continue; }
    if (hz.type === 'pulse') { hz.t += d; if (Math.sin(hz.t * 2.2) < 0) continue; if (U.overlaps(e, hz)) return { dmg: 50, kx: ecx < hz.x + hz.w / 2 ? -300 : 300 }; continue; }
    if (hz.type === 'laser') { hz.t += d; if ((hz.t % 3) <= 1.8) continue; if (U.overlaps(e, hz)) return { dmg: 50, kx: ecx < hz.x + hz.w / 2 ? -300 : 300 }; continue; }
    if (hz.type === 'blade') { // deadly spinning blade: circle vs AABB
      hz.t += d;
      const cx = Math.max(e.x, Math.min(hz.x, e.x + (e.w || 20))), cy = Math.max(e.y, Math.min(hz.y, e.y + (e.h || 20)));
      const ddx = cx - hz.x, ddy = cy - hz.y, rr = hz.r - 6;
      if (ddx * ddx + ddy * ddy < rr * rr) return { dmg: 999, kx: ecx < hz.x ? -420 : 420 };
      continue;
    }
    if (hz.type === 'electro') { // broken electric floor panel: warn -> HOT cycle
      hz.t += d;
      const cyc = hz.t % 2.6;
      hz.warn = cyc >= 1.5 && cyc < 1.9;
      hz.hot = cyc >= 1.9;
      if (hz.hot && U.overlaps(e, hz)) return { dmg: 60, kx: ecx < hz.x + hz.w / 2 ? -320 : 320 };
      continue;
    }
  }
  return null;
}

/* ---------- camera ---------- */
const Cam = {
  x: 0, y: 0, shakeT: 0, shakeA: 0, vx: 0,
  update(dt, target, viewW, viewH, w, instant) {
    const look = U.clamp((target.vx || 0) * 0.22, -110, 110);
    const tx = (target.x || 0) + (target.w || 0) / 2 + look - viewW / 2;
    const ty = (target.y || 0) + (target.h || 0) / 2 - viewH / 2 - 40;
    if (!isFinite(tx) || !isFinite(ty)) return;
    if (instant) { Cam.x = tx; Cam.y = ty; }
    else {
      Cam.x = U.damp(Cam.x, tx, 6.5, dt);
      Cam.y = U.damp(Cam.y, ty, 4.5, dt);
    }
    Cam.x = U.clamp(Cam.x, 0, Math.max(0, w.pw - viewW));
    Cam.y = U.clamp(Cam.y, 0, Math.max(0, w.ph - viewH));
    Cam.shakeT = Math.max(0, Cam.shakeT - dt);
  },
  shake(a, t) { if (!Save.data.settings.shake) return; Cam.shakeA = a; Cam.shakeT = t; },
  off() {
    if (Cam.shakeT <= 0) return [0, 0];
    const k = Cam.shakeT * Cam.shakeA;
    return [U.rand(-k, k), U.rand(-k, k)];
  },
};

/* ---------- particles ---------- */
const Parts = {
  list: [], cap: 900,
  capFor() {
    const q = Save.data.settings.particles;
    return q === 'low' ? 220 : q === 'medium' ? 500 : 900;
  },
  spawn(o) {
    if (Parts.list.length >= Parts.capFor()) Parts.list.shift();
    Parts.list.push(Object.assign({ vx: 0, vy: 0, life: 0.6, max: 0.6, size: 3, color: '#fff', type: 'spark', grav: 0, rot: U.rand(0, TAU), vr: U.rand(-3, 3) }, o, { max: o.life || 0.6 }));
  },
  burst(x, y, n, opt) {
    for (let i = 0; i < n; i++) {
      const a = U.rand(0, TAU), sp = U.rand(opt.sp0 || 40, opt.sp1 || 200);
      Parts.spawn({ x, y, vx: Math.cos(a) * sp + (opt.vx || 0), vy: Math.sin(a) * sp + (opt.vy || 0),
        life: U.rand(opt.l0 || 0.3, opt.l1 || 0.8), size: U.rand(opt.s0 || 2, opt.s1 || 5),
        color: Array.isArray(opt.color) ? U.pick(opt.color) : (opt.color || '#fff'),
        type: opt.type || 'spark', grav: opt.grav || 0 });
    }
  },
  wave(x, y, color, maxR) { Parts.spawn({ x, y, type: 'wave', life: 0.5, size: 8, maxR: maxR || 260, color }); },
  update(dt) {
    const L = Parts.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.life -= dt;
      if (p.life <= 0) { L.splice(i, 1); continue; }
      if (p.type === 'wave') continue;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += (p.grav || 0) * dt;
      p.vx *= (1 - 1.6 * dt); p.vy *= (1 - (p.grav ? 0 : 1.6) * dt);
      p.rot += p.vr * dt;
    }
  },
  draw(ctx) {
    for (const p of Parts.list) {
      const a = U.clamp(p.life / p.max, 0, 1);
      if (p.type === 'wave') {
        const t = 1 - a, r = p.size + (p.maxR - p.size) * (1 - Math.pow(1 - t, 2.4));
        ctx.globalAlpha = a * 0.9;
        ctx.strokeStyle = p.color; ctx.lineWidth = 3.5 * a + 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.stroke();
        continue;
      }
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.type === 'shard') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.beginPath(); ctx.moveTo(0, -p.size); ctx.lineTo(p.size * 0.7, 0); ctx.lineTo(0, p.size); ctx.lineTo(-p.size * 0.7, 0); ctx.closePath(); ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (p.type === 'dust' ? 1 : a), 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  },
};

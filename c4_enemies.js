/* ============================================================
   LUMORA — c4_enemies: wisps, crawlers, sentries, projectiles, boss
   Enemy semantics: x,y = CENTER of the collision box; e.rect() = AABB.
   ============================================================ */
const Shots = {
  list: [],
  spawn(x, y, vx, vy, layer, color, opts) {
    const o = opts || {};
    Shots.list.push({ x, y, vx, vy, r: 7, layer, color: color || '#ff8fa3', life: o.life || 4, t: 0, grace: o.grace || 0 });
  },
  // push a spawn point out of solid tiles along its direction so shots never die inside the shooter's own block
  freeSpawn(w, layer, x, y, dx, dy) {
    let px = x, py = y;
    const box = (bx, by) => ({ x: bx - 7, y: by - 7, w: 14, h: 14 });
    for (let i = 0; i < 12; i++) {
      let inside = false;
      for (const r of solidsFor(w, layer)) if (U.overlaps(box(px, py), r)) { inside = true; break; }
      if (!inside) return { x: px, y: py, ok: true };
      px += dx * 6; py += dy * 6;
    }
    return { x: px, y: py, ok: false };
  },
  update(dt, w) {
    for (let i = Shots.list.length - 1; i >= 0; i--) {
      const s = Shots.list[i];
      s.life -= dt; s.t += dt;
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.life <= 0) { Shots.list.splice(i, 1); continue; }
      if (Game.player && !Game.player.dead && Game.player.curLayer === s.layer) {
        const b = Game.player.rect();
        if (U.overlaps({ x: s.x - s.r, y: s.y - s.r, w: s.r * 2, h: s.r * 2 }, b)) {
          Game.player.hurt(30, Math.sign(s.vx) * 200 || 240);
          Shots.list.splice(i, 1); continue;
        }
      }
      if (s.t >= s.grace) {
        let hitWall = false;
        for (const r of solidsFor(w, s.layer)) if (U.overlaps({ x: s.x - s.r, y: s.y - s.r, w: s.r * 2, h: s.r * 2 }, r)) { hitWall = true; break; }
        if (hitWall) { Parts.burst(s.x, s.y, 6, { color: [s.color, '#fff'], sp0: 30, sp1: 120, l0: 0.15, l1: 0.4 }); Shots.list.splice(i, 1); }
      }
    }
  },
  clear() { Shots.list.length = 0; },
};

function makeEnemy(type, x, y, layer, w) {
  // x,y here = anchor point on the ground (tile center, ground top)
  if (type === 'wisp') return new Wisp(x, y - 44, layer, w);
  if (type === 'crawler') return new Crawler(x, y - 15, layer, w);
  if (type === 'sentry') return new Sentry(x, y - 20, layer, w);
  if (type === 'mirage') return new Mirage(x, y - 26, layer, w);
  if (type === 'boss') return new Boss(x, y, layer, w);
  return new Wisp(x, y - 44, layer, w);
}

class EnemyBase {
  constructor(x, y, layer) {
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.layer = layer; this.dead = false; this.t = U.rand(0, 10);
    this.hitFlash = 0; this.active = false; this.noStomp = false;
  }
  rect() { return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h }; }
  stomp() {
    this.dead = true;
    Save.data.stats.defeated++;
    AudioSys.sfx('stomp'); AudioSys.sfx('kill');
    Parts.burst(this.x, this.y, 16, { color: [LAYER_META[this.layer].color, '#fff'], sp0: 80, sp1: 260, l0: 0.3, l1: 0.7, type: 'shard', s0: 2, s1: 6 });
    Cam.shake(3, 0.15);
    ACH.check(); Save.saveSoon();
  }
  dissolve() {
    if (this.dead) return;
    this.dead = true;
    Save.data.stats.defeated++;
    AudioSys.sfx('kill');
    Parts.wave(this.x, this.y, LAYER_META[this.layer].color, 120);
    Parts.burst(this.x, this.y, 20, { color: [LAYER_META[this.layer].color, '#ffffff'], sp0: 60, sp1: 280, l0: 0.3, l1: 0.8, type: 'shard', s0: 2, s1: 7 });
    ACH.check(); Save.saveSoon();
  }
  baseUpdate(dt, w, player, layer) {
    this.t += dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    this.active = (this.layer === layer);
  }
}

class Wisp extends EnemyBase {
  constructor(x, y, layer, w) {
    super(x, y, layer);
    this.w = 34; this.h = 40; this.bx = x; this.y0 = y; this.range = 110; this.ph = U.rand(0, TAU);
    this.mode = 'drift'; this.dashT = U.rand(3, 6); this.dashVx = 0; this.dashVy = 0;
  }
  update(dt, w, player, layer) {
    this.baseUpdate(dt, w, player, layer);
    if (!this.active || this.dead) return;
    const col = LAYER_META[this.layer].color;
    if (Math.random() < 0.1) Parts.spawn({ x: this.x + U.rand(-8, 8), y: this.y + U.rand(0, 20), vx: 0, vy: -20, life: 0.5, size: 2.5, color: col });
    // SMART: player-aware drift + telegraphed dash (remaster AI)
    // scoped to worlds >=5: early worlds keep the classic tutorial drift
    const smart = Game.level ? Game.level.world >= 5 : false;
    const px = smart && player && !player.dead ? player.x + 15 : null;
    const py = player && !player.dead ? player.y + player.boxH / 2 : null;
    const dx = px !== null ? px - this.x : 0, dy = py !== null ? py - this.y : 0;
    const d = Math.hypot(dx, dy);
    if (this.mode === 'dash') {
      this.dashT -= dt;
      this.x += this.dashVx * dt; this.y += this.dashVy * dt;
      // keep inside the world / out of solids
      const box = { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h };
      for (const r of solidsFor(w, this.layer)) {
        if (!r.oneway && U.overlaps(box, r)) { this.mode = 'drift'; this.dashT = U.rand(4, 7); break; }
      }
      if (this.x < 24 || this.x > w.pw - 24) this.mode = 'drift';
      if (this.dashT <= 0) { this.mode = 'drift'; this.dashT = U.rand(4, 7); }
      Parts.spawn({ x: this.x, y: this.y + 8, vx: -this.dashVx * 0.15, vy: -this.dashVy * 0.15, life: 0.3, size: 3, color: col });
      return;
    }
    if (this.mode === 'aim') {
      this.dashT -= dt;
      if (px !== null) this.aimA = Math.atan2(dy, dx); // track during telegraph
      if (this.dashT <= 0) {
        this.mode = 'dash'; this.dashT = 0.55;
        const sp = 300 * (typeof DDA !== 'undefined' ? DDA.mEnemySpeed() : 1);
        this.dashVx = Math.cos(this.aimA) * sp; this.dashVy = Math.sin(this.aimA) * sp;
        AudioSys.sfx('warn');
        Parts.burst(this.x, this.y, 8, { color: [col, '#fff'], sp0: 60, sp1: 160, l0: 0.15, l1: 0.35 });
      }
      return;
    }
    // drift: lazy sine far from the player, homing float when the player is near
    this.dashT -= dt;
    if (px !== null && d < 260) {
      // orbit the player at a respectful radius — menacing, never body-blocking
      const RING = 120, hom = 52 * (typeof DDA !== 'undefined' ? DDA.mEnemySpeed() : 1);
      const push = (d - RING) / RING; // <0 → back off, >0 → close in
      let nx = this.x + (dx / d) * hom * push * dt + Math.cos(this.t * 1.6 + this.ph) * 30 * dt;
      let ny = this.y + (dy / d) * hom * 0.55 * push * dt + Math.sin(this.t * 1.9 + this.ph) * 30 * dt;
      const box = { x: nx - this.w / 2, y: ny - this.h / 2, w: this.w, h: this.h };
      let blocked = false;
      for (const r of solidsFor(w, this.layer)) if (!r.oneway && U.overlaps(box, r)) { blocked = true; break; }
      if (!blocked && nx > 20 && nx < w.pw - 20) { this.x = nx; this.y = ny; }
    } else {
      this.x = this.bx + Math.sin(this.t * 1.1 + this.ph) * this.range;
      this.y = this.y0 + Math.sin(this.t * 1.7 + this.ph) * 14;
    }
    if (px !== null && d < 300 && this.dashT <= 0) { this.mode = 'aim'; this.dashT = 0.65; AudioSys.sfx('lock'); }
  }
}

class Crawler extends EnemyBase {
  constructor(x, y, layer, w) {
    super(x, y, layer);
    this.w = 44; this.h = 30; this.dir = Math.random() < 0.5 ? -1 : 1; this.speed = 130;
    this.alert = 0;
  }
  update(dt, w, player, layer) {
    this.baseUpdate(dt, w, player, layer);
    if (!this.active || this.dead) return;
    // SMART: spots the player on its layer at ground level and hunts (remaster AI)
    // worlds >=5 only — crawlers elsewhere stay classic patrollers
    let spd = this.speed;
    if (Game.level && Game.level.world >= 5 && player && !player.dead && player.curLayer === this.layer) {
      const dx = (player.x + 15) - this.x;
      const dy = Math.abs((player.y + player.boxH) - (this.y + this.h / 2));
      if (Math.abs(dx) < 250 && dy < 110) {
        this.dir = Math.sign(dx) || this.dir;
        spd = this.speed * 1.7 * (typeof DDA !== 'undefined' ? DDA.mEnemySpeed() : 1);
        if (this.alert <= 0) { this.alert = 1.2; AudioSys.sfx('lock'); Parts.burst(this.x, this.y - 20, 5, { color: '#ff6b7a', sp0: 30, sp1: 90, l0: 0.2, l1: 0.4 }); }
      }
    }
    if (this.alert > 0) this.alert -= dt;
    this.x += this.dir * spd * dt;
    // turn at ledges / walls
    const probe = { x: this.x + (this.dir > 0 ? this.w / 2 + 2 : -this.w / 2 - 8), y: this.y + this.h / 2 + 2, w: 6, h: 10 };
    let groundAhead = false;
    for (const r of solidsFor(w, this.layer)) if (U.overlaps(probe, r)) groundAhead = true;
    const wallProbe = { x: this.x + (this.dir > 0 ? this.w / 2 - 2 : -this.w / 2 - 2), y: this.y - this.h / 2 + 4, w: 6, h: this.h - 8 };
    let wallAhead = false;
    for (const r of solidsFor(w, this.layer)) if (U.overlaps(wallProbe, r)) wallAhead = true;
    if (!groundAhead || wallAhead) { this.dir *= -1; this.x += this.dir * 4; }
  }
}

class Sentry extends EnemyBase {
  constructor(x, y, layer, w) {
    super(x, y, layer);
    this.w = 40; this.h = 40; this.cd = U.rand(1, 2.4); this.aim = 0;
    this.locking = false; this.lockedAim = 0; this.lockT = 0;
  }
  update(dt, w, player, layer) {
    this.baseUpdate(dt, w, player, layer);
    if (!this.active || this.dead) return;
    if (player && !player.dead && player.curLayer === this.layer) {
      const dx = (player.x + 15) - this.x, dy = (player.y + player.boxH / 2) - this.y;
      const d = Math.hypot(dx, dy);
      this.aim = Math.atan2(dy, dx);
      if (d < 620) {
        this.cd -= dt;
        if (this.cd <= 0.5 && !this.locking) {
          // LOCK with PREDICTIVE LEAD (remaster AI): aim where the player WILL be.
          // The frozen line stays dodgeable — keep moving after the lock!
          // Worlds >=5 only; earlier sentries keep the plain aim.
          const smart = Game.level ? Game.level.world >= 5 : false;
          const pvx = smart ? (player.vx || 0) : 0;
          const flightT = d / (330 * (typeof DDA !== 'undefined' ? DDA.mEnemySpeed() : 1));
          const lead = smart ? U.clamp(flightT * 0.85, 0, 0.85) : 0;
          const fx = dx + pvx * lead, fy = dy + (player.vy || 0) * lead * 0.5;
          this.locking = true;
          this.lockedAim = Math.atan2(fy, fx);
          this.lockT = 0.5;
        }
        if (this.locking) this.lockT -= dt;
        if (this.cd <= 0) {
          this.cd = 2.3 * DDA.mFireRate(); this.locking = false;
          const dxm = Math.cos(this.lockedAim), dym = Math.sin(this.lockedAim);
          const sp = Shots.freeSpawn(w, this.layer, this.x + dxm * 26, this.y + dym * 26, dxm, dym);
          if (sp.ok) {
            const sSp = 330 * DDA.mEnemySpeed();
            Shots.spawn(sp.x, sp.y, dxm * sSp, dym * sSp, this.layer, undefined, { grace: 0.07 });
            AudioSys.sfx('shoot');
            Parts.burst(sp.x, sp.y, 5, { color: ['#ff8fa3', '#fff'], sp0: 20, sp1: 90, l0: 0.1, l1: 0.3 });
          }
        }
      } else { this.locking = false; }
    } else { this.locking = false; }
  }
}

/* MIRAGE — the remaster's hunter: a phase-shifting stalker.
   Dormant on its home layer, then flickers, SHIFTS ITS OWN LAYER toward the
   player, and hunts on the player's layer. Counterplay: shift layers — the
   player's layer switch shatters it (SHADE_KILL radius). */
class Mirage extends EnemyBase {
  constructor(x, y, layer, w) {
    super(x, y, layer);
    this.w = 36; this.h = 36; this.homeLayer = layer; this.homeX = x; this.homeY = y;
    this.state = 'dormant'; this.stateT = U.rand(3, 5); this.shiftFrom = layer;
  }
  update(dt, w, player, layer) {
    this.baseUpdate(dt, w, player, layer);
    if (this.dead) return;
    const col = LAYER_META[this.layer].color;
    this.stateT -= dt;
    if (this.state === 'dormant') {
      // hover gently at home
      this.x = this.homeX + Math.sin(this.t * 0.9) * 24;
      this.y = this.homeY + Math.sin(this.t * 1.3) * 10;
      if (this.stateT <= 0 && player && !player.dead) {
        this.state = 'flicker'; this.stateT = 0.8; this.shiftFrom = this.layer;
        AudioSys.sfx('warn');
        Parts.burst(this.x, this.y, 10, { color: [col, '#fff'], sp0: 40, sp1: 140, l0: 0.2, l1: 0.5, type: 'shard' });
      }
    } else if (this.state === 'flicker') { // telegraph: hard to see, about to jump layers
      if (this.stateT <= 0) {
        this.layer = player.curLayer; // phase into the player's world
        this.state = 'hunt'; this.stateT = 3.2;
        Parts.wave(this.x, this.y, LAYER_META[this.layer].color, 90);
        AudioSys.sfx('switch');
      }
    } else if (this.state === 'hunt') {
      // slow homing — stompable, beatable, but relentless
      const px = player.x + 15, py = player.y + player.boxH / 2;
      const dx = px - this.x, dy = py - this.y, d = Math.hypot(dx, dy) || 1;
      const sp = 96 * (typeof DDA !== 'undefined' ? DDA.mEnemySpeed() : 1);
      const nx = this.x + (dx / d) * sp * dt + Math.cos(this.t * 3) * 30 * dt;
      const ny = this.y + (dy / d) * sp * dt + Math.sin(this.t * 3.6) * 30 * dt;
      const box = { x: nx - this.w / 2, y: ny - this.h / 2, w: this.w, h: this.h };
      let blocked = false;
      for (const r of solidsFor(w, this.layer)) if (!r.oneway && U.overlaps(box, r)) { blocked = true; break; }
      if (!blocked && nx > 20 && nx < w.pw - 20 && ny > 20 && ny < w.ph - 20) { this.x = nx; this.y = ny; }
      if (Math.random() < 0.3) Parts.spawn({ x: this.x + U.rand(-8, 8), y: this.y + U.rand(-8, 8), vx: 0, vy: 0, life: 0.35, size: 2.5, color: LAYER_META[this.layer].color });
      if (this.stateT <= 0) { // exhaust → retreat home
        this.layer = this.homeLayer;
        this.state = 'dormant'; this.stateT = U.rand(4, 6);
        Parts.wave(this.x, this.y, col, 80);
      }
    }
  }
  stomp() { super.stomp(); }
}

class Boss extends EnemyBase {
  constructor(x, y, layer, w) {
    super(x, y, 0);
    this.w = 120; this.h = 110; this.bx = x; this.by = y;
    const hpBase = 16;
    this.hp = Math.round(hpBase * DDA.mBossHp()); this.maxHp = this.hp;
    this.phase = 0; this.state = 'idle'; this.stateT = 1.6;
    this.cycleT = 5; this.aim = 0; this.stagger = 0;
    this.arenaX0 = 106 * T; this.arenaX1 = 143 * T;
    this.laserY = y; this.laserOn = false;
    this.defeatedFlag = false; this.hitCd = 0;
  }
  stomp() { if (!this.dead && !this.defeatedFlag) this.damage(3); }
  dissolve() { if (!this.dead && !this.defeatedFlag) this.damage(2); }
  update(dt, w, player, layer) {
    if (this.dead || this.defeatedFlag) return;
    this.t += dt;
    const P = Game.player;
    if (!P) return;
    if (this.hitCd > 0) this.hitCd -= dt;
    // boss shifts layers; vulnerable only when player matches its layer
    this.cycleT -= dt;
    if (this.stagger > 0) this.stagger -= dt;
    if (this.cycleT <= 0) {
      this.cycleT = 7.5;
      this.layer = (this.layer + 1) % 4;
      UI.toast('نگهبان', 'به لایه ' + LAYER_META[this.layer].fa + ' رفت — به او بپیوند تا سپرش بشکند', 'cy');
      AudioSys.sfx('warn');
    }
    // when the player is on the boss's layer the boss slows down — readable attack window
    const vulnerable = Game.player && Game.player.curLayer === this.layer;
    const amp = vulnerable ? 0.72 : 1;
    this.x = this.bx + Math.sin(this.t * 0.42) * 200 * amp;
    this.y = this.by + Math.sin(this.t * 0.6) * 44 * amp;
    if (this.stateT > 0 && this.stagger <= 0) this.stateT -= dt;

    if (this.stateT <= 0 && this.stagger <= 0) {
      this.phase = (this.phase + 1) % 4;
      if (this.phase === 1) { // radial shards
        this.state = 'burst'; this.stateT = 1.2;
        const n = Math.max(4, Math.round(7 * (0.75 + 0.5 * DDA.skill())));
        const sp = 190 * DDA.mEnemySpeed();
        for (let i = 0; i < n; i++) {
          const a = TAU * i / n + this.t;
          Shots.spawn(this.x, this.y, Math.cos(a) * sp, Math.sin(a) * sp, this.layer, '#ff8fa3');
        }
        AudioSys.sfx('boom'); Cam.shake(4, 0.2);
      } else if (this.phase === 2) { // laser sweep
        this.state = 'laser'; this.stateT = 2.6;
        this.laserY = P.y + 20;
        AudioSys.sfx('warn');
      } else if (this.phase === 3) { // summon wisps (capped so the arena never floods)
        this.state = 'summon'; this.stateT = 1.4;
        const alive = w.enemies.filter(e => e instanceof Wisp && !e.dead).length;
        if (alive < 3) {
          const wsp = new Wisp(this.x + U.rand(-140, 140), this.y + U.rand(-30, 30), this.layer, w);
          w.enemies.push(wsp);
        }
        AudioSys.sfx('switch');
      } else { this.state = 'idle'; this.stateT = 1.1; }
    }
    if (this.state === 'laser') {
      this.laserOn = this.stateT < 1.7;
      this.laserY = U.damp(this.laserY, P.y + 20, 0.75, dt);
      if (this.laserOn) {
        const zone = { x: this.arenaX0, y: this.laserY - 22, w: this.arenaX1 - this.arenaX0, h: 44 };
        if (U.overlaps(P.rect(), zone)) P.hurt(22, 0);
        if (Math.random() < 0.4) Parts.spawn({ x: U.rand(this.arenaX0, this.arenaX1), y: this.laserY, vx: 0, vy: U.rand(-60, 60), life: 0.4, size: 3, color: '#ff6b7a' });
      }
    }
  }
  damage(n) {
    if (this.dead || this.defeatedFlag) return;
    this.hp -= n; this.hitFlash = 0.3; this.hitCd = 0.35;
    this.stagger = 0.9; // readable reward window after a hit
    AudioSys.sfx('bossHit'); Cam.shake(5, 0.25);
    Parts.burst(this.x, this.y, 18, { color: ['#ff6b7a', '#ffd76a', '#fff'], sp0: 100, sp1: 300, l0: 0.3, l1: 0.7, type: 'shard' });
    UI.syncBoss(Math.max(0, this.hp) / this.maxHp);
    if (this.hp <= 0) this.defeat();
  }
  defeat() {
    this.defeatedFlag = true; this.dead = true;
    Save.data.stats.defeated++;
    AudioSys.sfx('boom'); AudioSys.sfx('goal');
    Cam.shake(12, 0.8); Game.hitstop = 0.4;
    const bx = this.x, by = this.y;
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        Parts.burst(bx + U.rand(-80, 80), by + U.rand(-60, 60), 30, { color: ['#ff6b7a', '#ffd76a', '#59f2e0', '#fff'], sp0: 100, sp1: 420, l0: 0.5, l1: 1.2, type: 'shard', s0: 3, s1: 8 });
      }, i * 220);
    }
    const gate = Game.world.gate;
    if (gate) {
      gate.locked = false;
      Parts.wave(gate.x + 26, gate.y + 40, '#ffd76a', 400);
    }
    UI.bossBar(false);
    UI.toast('نگهبان شکست خورد', 'دروازه لایه نهایی باز شد', 'gold');
    ACH.check(); Save.saveSoon();
  }
}

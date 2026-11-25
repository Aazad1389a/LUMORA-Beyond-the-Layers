/* ============================================================
   LUMORA — c4_player: LUMORA movement kit + NEXORA layer shift
   Box semantics: this.y = TOP of collision box. boxH = sliding?28:54.
   ============================================================ */
class Player {
  constructor(world) {
    const sp = world.spawn;
    Object.assign(this, {
      w: 30, h: 54, x: sp.x - 15, y: sp.y - 54, vx: 0, vy: 0,
      face: 1, onGround: false, coyote: 0, jbuf: 0, jumps: 0,
      sliding: false, slideT: 0, slideCd: 0, wallDir: 0, wallCoyote: 0,
      energy: 100, max: Abilities.maxEnergy(), invuln: 0, hurtT: 0,
      anim: 'idle', animT: 0, shiftLock: 0, shiftFlash: 0, ghostT: 0,
      lastSafe: { x: sp.x - 15, y: sp.y - 54 }, safeT: 0,
      scarf: [], trailT: 0, deathT: 0, dead: false, squash: 1, stretch: 1,
      dblFx: 0, landFx: 0, climbFx: 0, curLayer: world.curLayer, gravSign: 1,
      wasGround: false, checkpoint: { x: sp.x - 15, y: sp.y - 54, layer: 0 },
      boxH: 54, cutApplied: false, rideMover: null,
    });
    for (let i = 0; i < 9; i++) this.scarf.push({ x: this.x + 15, y: this.y + 14 });
  }
  rect() { return { x: this.x, y: this.y, w: this.w, h: this.boxH }; }
  hurt(amount, kx) {
    if (this.invuln > 0 || this.dead) return false;
    this.energy = Math.max(0, this.energy - amount);
    this.invuln = PHYS.INVULN; this.hurtT = 0.35;
    this.vx = kx || (this.face * -260); this.vy = this.gravSign > 0 ? -420 : 420;
    AudioSys.sfx('hurt'); Cam.shake(7, 0.3);
    Parts.burst(this.x + 15, this.y + this.boxH / 2, 14, { color: ['#ff6b7a', '#ffb3bb'], sp0: 80, sp1: 240, l0: 0.3, l1: 0.7 });
    UI.vignette();
    if (this.energy <= 0) Game.killPlayer();
    return true;
  }
  switchLayer(dir) { this.switchLayerTo(((this.curLayer + dir) % 4 + 4) % 4); }
  switchLayerTo(target) { // absolute target — used by NEXORA rings + Q/E/1-4
    if (this.shiftLock > 0 || this.dead) return;
    const next = Math.max(0, Math.min(3, target | 0));
    const cur = this.curLayer;
    if (next === cur) return;
    if (this.energy < PHYS.SWITCH_COST) { AudioSys.sfx('deny'); UI.energyDeny(); return; }
    this.energy -= PHYS.SWITCH_COST;
    Save.data.stats.switches++;
    if (typeof Missions !== 'undefined') Missions.event('switch');
    this.curLayer = next;
    this.shiftLock = PHYS.SWITCH_LOCK; this.shiftFlash = 1;
    const meta = LAYER_META[next];
    AudioSys.sfx('switch');
    Parts.wave(this.x + 15, this.y + this.boxH / 2, meta.color, 300);
    Parts.burst(this.x + 15, this.y + this.boxH / 2, 18, { color: [meta.color, '#ffffff'], sp0: 120, sp1: 320, l0: 0.25, l1: 0.6, type: 'shard', s0: 3, s1: 7 });
    Cam.shake(3.5, 0.18);
    Game.hitstop = 0.07;
    UI.syncLayer(next);
    if (typeof NEXORA !== 'undefined') NEXORA.onSwitch(next);
    // enemies of the NEW layer nearby shatter (they cannot hold form)
    for (const e of Game.world.enemies) {
      if (e.layer === next && !e.dead && U.dist(this.x, this.y, e.x, e.y) < PHYS.SHADE_KILL_R) e.dissolve();
    }
    // gravity flips in INVERSE
    this.gravSign = (next === LY.INVERSE) ? -1 : 1;
    if (next === LY.INVERSE) this.vy = Math.min(this.vy, 0) - 60;
    else if (cur === LY.INVERSE) this.vy = Math.max(this.vy, 0);
    // unstick: if now inside a solid, revert to last safe position
    const box = this.rect();
    let stuck = false;
    for (const so of solidsFor(Game.world, next)) if (!so.oneway && U.overlaps(box, so)) { stuck = true; break; }
    if (stuck) {
      this.x = this.lastSafe.x; this.y = this.lastSafe.y; this.vx = 0; this.vy = 0;
      Parts.burst(this.x + 15, this.y + 27, 10, { color: ['#ffffff', meta.color], sp0: 60, sp1: 160 });
    }
    ACH.check(); Save.saveSoon();
  }
  killFall() { Game.killPlayer(); }

  update(dt, w) {
    if (this.dead) return;
    const layer = this.curLayer, gs = this.gravSign;
    this.animT += dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.shiftLock > 0) this.shiftLock -= dt;
    if (this.shiftFlash > 0) this.shiftFlash -= dt * 2.4;
    if (this.dblFx > 0) this.dblFx -= dt * 3;
    if (this.slideCd > 0) this.slideCd -= dt;
    const regen = (layer === LY.ENERGY ? PHYS.REGEN_ENERGY_LAYER : Abilities.regenRate());
    if (this.invuln <= 0) this.energy = Math.min(this.max, this.energy + regen * dt);

    const left = Input.isDown('left'), right = Input.isDown('right');
    const moveDir = (right ? 1 : 0) - (left ? 1 : 0);
    const jumpPress = Input.wasPressed('jump') || Input.wasVPressed('jump');
    if (jumpPress) this.jbuf = PHYS.BUFFER;
    if (this.jbuf > 0) this.jbuf -= dt;
    if (this.coyote > 0) this.coyote -= dt;
    const wantSlide = Input.isDown('slide');

    /* ------- slide (enter/exit adjust box height around fixed feet) ------- */
    if (Abilities.has('slide')) {
      if (!this.sliding && wantSlide && this.onGround && Math.abs(this.vx) > 210 && this.slideCd <= 0) {
        this.sliding = true;
        this.vx = Math.sign(this.vx || this.face) * PHYS.SLIDE_BOOST;
        this.y += this.h - PHYS.SLIDE_H; // box top drops, feet stay
        this.boxH = PHYS.SLIDE_H;
        AudioSys.sfx('slide');
        UI.flashAbility('slide');
      }
      if (this.sliding) {
        this.slideT += dt;
        const stopSlide = !wantSlide || Math.abs(this.vx) < PHYS.SLIDE_END;
        if (stopSlide) {
          // can we stand? full box must be free
          const full = { x: this.x, y: this.y - (this.h - PHYS.SLIDE_H), w: this.w, h: this.h };
          let blocked = false;
          for (const so of solidsFor(w, layer)) if (!so.oneway && U.overlaps(full, so)) { blocked = true; break; }
          if (!blocked) {
            this.sliding = false; this.slideCd = PHYS.SLIDE_CD;
            this.y -= this.h - PHYS.SLIDE_H; this.boxH = this.h;
          }
        }
      }
    } else if (this.sliding) { this.sliding = false; this.boxH = this.h; }

    /* ------- horizontal ------- */
    if (!this.sliding) {
      const acc = this.onGround ? PHYS.ACC_G : PHYS.ACC_A;
      if (moveDir !== 0) {
        this.vx += moveDir * acc * dt;
        this.face = moveDir;
        const runCap = PHYS.RUN * (this.mpMul || 1);
        if (Math.abs(this.vx) > runCap) this.vx = Math.sign(this.vx) * runCap;
      } else {
        const fr = (this.onGround ? PHYS.FRIC_G : PHYS.FRIC_A) * dt;
        if (Math.abs(this.vx) <= fr) this.vx = 0; else this.vx -= Math.sign(this.vx) * fr;
      }
    } else {
      const fr = 300 * dt;
      if (Math.abs(this.vx) <= fr) this.vx = 0; else this.vx -= Math.sign(this.vx) * fr;
    }

    /* ------- wall detection ------- */
    const bodyNow = this.rect();
    let wallTouch = 0, onClimb = false;
    {
      const L2 = touchingWall(bodyNow, w, layer, -1), R2 = touchingWall(bodyNow, w, layer, 1);
      if (L2.wall) wallTouch = -1;
      if (R2.wall) wallTouch = 1;
      if (L2.climb && (moveDir < 0 || Abilities.has('wallClimb'))) { wallTouch = -1; onClimb = true; }
      if (R2.climb && (moveDir > 0 || Abilities.has('wallClimb'))) { wallTouch = 1; onClimb = true; }
    }
    this.wallDir = wallTouch;

    /* ------- gravity ------- */
    const falling = gs > 0 ? this.vy > 40 : this.vy < -40;
    const g = (falling ? PHYS.GRAV_FALL : PHYS.GRAV) * gs;
    if (!this.sliding || !this.onGround) this.vy += g * dt;
    this.vy = U.clamp(this.vy, -PHYS.MAX_FALL, PHYS.MAX_FALL);

    /* ------- climb (CLING, marked walls) ------- */
    this.climbing = false;
    if (Abilities.has('wallClimb') && onClimb && wallTouch !== 0 && !this.onGround) {
      let cv = 0;
      if (wantSlide) cv = PHYS.CLIMB_DOWN;
      else if (moveDir !== 0) cv = -PHYS.CLIMB_UP;
      this.vy = cv * gs; // gravity fully overridden while clinging
      this.climbing = true;
      this.energy = Math.max(0, this.energy - PHYS.CLIMB_DRAIN * dt);
      this.anim = 'climb';
      UI.flashAbility('climb');
      this.climbFx += dt;
      if (this.climbFx > 0.09) {
        this.climbFx = 0;
        Parts.burst(this.x + (wallTouch > 0 ? this.w : 0), this.y + U.rand(8, this.boxH - 8), 1, { color: LAYER_META[layer].color, sp0: 10, sp1: 60, l0: 0.2, l1: 0.5, s0: 1.5, s1: 3, grav: 200 * gs });
      }
    }

    /* ------- wall slide ------- */
    if (wallTouch !== 0 && !onClimb && !this.onGround && ((gs > 0 && this.vy > 0) || (gs < 0 && this.vy < 0)) && moveDir === wallTouch) {
      this.vy = Math.sign(this.vy) * Math.min(Math.abs(this.vy), PHYS.WALL_SLIDE);
      this.wallCoyote = 0.08;
      this.anim = 'wall';
      if (Math.random() < 0.25) Parts.burst(this.x + (wallTouch > 0 ? this.w : 0), this.y + U.rand(8, this.boxH - 8), 1, { color: '#cfd8ff', sp0: 5, sp1: 40, l0: 0.2, l1: 0.4, grav: 150 * gs });
    }
    if (this.wallCoyote > 0) this.wallCoyote -= dt;

    /* ------- jumping ------- */
    if (this.jbuf > 0) {
      if (this.onGround || this.coyote > 0) {
        this.vy = PHYS.JUMP_V * gs;
        this.onGround = false; this.coyote = 0; this.jbuf = 0; this.jumps = 1; this.cutApplied = false;
        if (this.sliding) { this.sliding = false; this.slideCd = PHYS.SLIDE_CD; this.vx *= 1.15; this.y -= this.h - PHYS.SLIDE_H; this.boxH = this.h; }
        AudioSys.sfx('jump');
        Parts.burst(this.x + 15, this.y + (gs > 0 ? this.boxH : 0), 7, { color: ['#bfe9ff', '#ffffff'], sp0: 30, sp1: 130, l0: 0.2, l1: 0.45, grav: 300 * gs, s0: 1.5, s1: 3.5 });
        Parts.wave(this.x + 15, this.y + (gs > 0 ? this.boxH : 0), '#bfe9ff', 70);
        this.stretch = 1.25; this.squash = 0.8;
      } else if (wallTouch !== 0 && (Abilities.has('wallClimb') || this.wallCoyote > 0)) {
        this.vy = PHYS.WALLJUMP_Y * gs;
        this.vx = -wallTouch * PHYS.WALLJUMP_X;
        this.face = -wallTouch; this.jbuf = 0; this.jumps = 1; this.cutApplied = false;
        AudioSys.sfx('jump'); AudioSys.sfx('wall');
        Parts.burst(this.x + (wallTouch > 0 ? this.w : 0), this.y + this.boxH / 2, 9, { color: ['#bfe9ff', '#fff'], sp0: 60, sp1: 200, l0: 0.2, l1: 0.5, grav: 250 * gs });
        this.stretch = 1.2;
      } else if (this.jumps < 2 && Abilities.has('doubleJump')) {
        this.jumps = 2; this.jbuf = 0; this.cutApplied = false;
        this.vy = PHYS.DJUMP_V * gs;
        Save.data.stats.doubleJumps++;
        AudioSys.sfx('djump');
        this.dblFx = 1;
        Parts.wave(this.x + 15, this.y + this.boxH / 2, '#a5f3fc', 90);
        Parts.burst(this.x + 15, this.y + this.boxH / 2, 12, { color: ['#7dd3fc', '#e0f2fe', '#59f2e0'], sp0: 60, sp1: 180, l0: 0.25, l1: 0.6, type: 'shard', s0: 2, s1: 5 });
        UI.flashAbility('doubleJump');
        ACH.check(); Save.saveSoon();
      }
    }
    // variable jump height — cut applied ONCE per jump
    const holdingJump = Input.isDown('jump');
    const rising = (gs > 0 && this.vy < -120) || (gs < 0 && this.vy > 120);
    if (!holdingJump && rising && !this.cutApplied && !this.climbing) { this.vy *= (1 - PHYS.JUMP_CUT); this.cutApplied = true; }

    /* ------- integrate + collide ------- */
    const wasG = this.onGround;
    if (this.rideMover) { this.x += this.rideMover.dxf; this.y += this.rideMover.dyf; }
    // cosmetic trail (light / starfall) — cheap, gated by perf level
    if (typeof Cos !== 'undefined' && typeof PerfMon !== 'undefined' && PerfMon.level <= 1) {
      const eq = Save.data.shop.equipped;
      const spd = Math.hypot(this.vx, this.vy);
      // ribbon buffer — world-space points for drawTrailFx
      this._tbT = (this._tbT || 0) + dt;
      if (this._tbT > 0.018) {
        this._tbT = 0;
        if (spd > 170) {
          this._trailBuf = this._trailBuf || [];
          this._trailBuf.unshift({ x: this.x + 15, y: this.y + this.boxH / 2, a: this.animT * 6 });
          if (this._trailBuf.length > 13) this._trailBuf.length = 13;
        } else if (this._trailBuf && this._trailBuf.length) this._trailBuf.pop();
      }
      const TRC = {
        'tr-light': ['#bfe9ff', '#ffffff', 'dust', 0.32, 0],
        'tr-stars': ['#ffd76a', '#ffffff', 'shard', 0.55, -50],
        'tr-flame': ['#ff9a4c', '#ff5a3c', 'shard', 0.4, -80],
        'tr-volt': ['#7dd3fc', '#e0f2fe', 'shard', 0.22, -20],
        'tr-petal': ['#f9a8d4', '#fbcfe8', 'shard', 0.6, -30],
        'tr-galaxy': ['#b388ff', '#22d3ee', 'shard', 0.5, -40],
      };
      const tc = TRC[eq.trail];
      if (tc) {
        this._trailAcc = (this._trailAcc || 0) + dt;
        if (this._trailAcc > 0.05) {
          this._trailAcc = 0;
          if (spd > 150) {
            Parts.spawn({ x: this.x + 15 - this.face * 12 + U.rand(-6, 6), y: this.y + this.boxH / 2 + U.rand(-8, 8),
              vx: -this.vx * 0.06 + U.rand(-30, 30), vy: -this.vy * 0.06 + tc[4] + U.rand(-20, 20),
              life: tc[3], size: tc[2] === 'dust' ? 5 : 3.4, color: Math.random() < 0.5 ? tc[0] : tc[1], type: tc[2] });
          }
        }
      }
      // sprint speed-streaks
      if (this.onGround && Math.abs(this.vx) > 320 && Math.random() < 0.3) {
        Parts.spawn({ x: this.x + 15 - this.face * 16, y: this.y + this.boxH * 0.55, vx: -this.face * 190, vy: U.rand(-14, 14), life: 0.22, size: 2.2, color: '#d8e6ff', type: 'dust' });
      }
    }
    const res = moveBody(this, w, layer, this.vx * dt, this.vy * dt, gs);
    this.rideMover = res.onMover;
    this.onGround = res.ground;
    if (res.ground) { this.coyote = 0.1; this.jumps = 0; this.cutApplied = false; }
    if (!wasG && res.ground) {
      AudioSys.sfx('land', Math.min(1, Math.abs(this.vy) / 900 + 0.2));
      this.squash = 1.35; this.stretch = 0.7;
      Parts.burst(this.x + 15, this.y + (gs > 0 ? this.boxH : 0), 8, { color: ['#9fb4d8', '#e2e8f0'], sp0: 20, sp1: 110, l0: 0.2, l1: 0.5, grav: 260 * gs, type: 'dust', s0: 2, s1: 4.5 });
      // HEAVY landing: shockwave ring + dust halo on hard impacts
      if (Math.abs(this.vy) > 620 && typeof PerfMon !== 'undefined' && PerfMon.level <= 1) {
        Parts.wave(this.x + 15, this.y + (gs > 0 ? this.boxH : 0), '#bfe9ff', 180);
        Parts.burst(this.x + 15, this.y + (gs > 0 ? this.boxH : 0), 16, { color: ['#e2e8f0', '#7dd3fc'], sp0: 60, sp1: 240, l0: 0.25, l1: 0.6, grav: 320 * gs, type: 'dust', s0: 3, s1: 6 });
        Cam.shake(3, 0.12);
      }
    }
    if (res.ground && Math.abs(this.vx) > 120 && Math.random() < 0.2) {
      Parts.spawn({ x: this.x + 15 - this.face * 10, y: this.y + (gs > 0 ? this.boxH - 4 : 4), vx: -this.face * 40, vy: -30 * gs, life: 0.35, size: 2.5, color: '#aebcd8', type: 'dust' });
    }

    /* ------- hazards / out of bounds ------- */
    const body = this.rect();
    const hzd = hazardHit(body, w, layer, dt);
    if (hzd) this.hurt(hzd.dmg, hzd.kx);
    if (this.y > w.ph + 160 || this.y < -260) { this.killFall(); return; }

    /* ------- last safe spot ------- */
    this.safeT += dt;
    if (this.safeT > 0.35 && this.onGround && !this.sliding) {
      this.safeT = 0;
      this.lastSafe = { x: this.x, y: this.y };
    }

    /* ------- checkpoints / gate / pickups ------- */
    for (const cp of w.checkpoints) {
      if (!cp.on && Math.abs(this.x - cp.x) < 40 && Math.abs(this.y - cp.y) < 90) {
        cp.on = true;
        this.checkpoint = { x: cp.x - 15, y: cp.y - this.h, layer };
        AudioSys.sfx('checkpoint');
        Parts.wave(cp.x, cp.y - 40, '#ffd76a', 140);
        UI.toast('ایستگاه انرژی', 'نقطه بازگشت ثبت شد', 'cy');
        Save.saveSoon();
      }
    }
    Game.checkPickups(this, w, dt);
    if (this.invuln <= 0) {
      for (const e of w.enemies) {
        if (e.dead || e.layer !== layer) continue;
        const er = e.rect();
        if (U.overlaps(body, er)) {
          const stomp = gs > 0 ? (this.vy > 120 && this.y + this.boxH - this.vy * dt <= er.y + 16)
                               : (this.vy < -120 && this.y - this.vy * dt >= er.y + er.h - 16);
          if (stomp && !e.noStomp) {
            e.stomp();
            if (typeof Missions !== 'undefined') Missions.event('stomp');
            this.vy = (Input.isDown('jump') ? PHYS.STOMP_HOLD : PHYS.STOMP_V) * gs;
            this.jumps = 1; this.cutApplied = false;
          } else this.hurt(35, Math.sign(this.x - e.x) * 280 || 280);
        }
      }
    }

    /* ------- scarf ------- */
    this.trailT += dt;
    if (this.trailT > 0.016) {
      this.trailT = 0;
      const head = { x: this.x + 15 - this.face * 12, y: this.y + 16 + Math.sin(this.animT * 3) * 2 };
      let px = head.x, py = head.y;
      for (const s of this.scarf) { s.x = U.damp(s.x, px, 22, 0.016); s.y = U.damp(s.y, py, 22, 0.016); px = s.x; py = s.y; }
    }

    /* ------- animation state ------- */
    if (this.hurtT > 0) this.anim = 'hurt';
    else if (!this.onGround) this.anim = (this.anim === 'climb' && onClimb) ? 'climb' : ((gs > 0 ? this.vy < 0 : this.vy > 0) ? 'jump' : 'fall');
    else if (this.sliding) this.anim = 'slide';
    else this.anim = Math.abs(this.vx) > 30 ? 'run' : 'idle';

    this.squash = U.damp(this.squash, 1, 10, dt);
    this.stretch = U.damp(this.stretch, 1, 10, dt);

    if (layer === LY.SHADOW) Save.data.stats.shadowTime += dt;
    if (layer === LY.INVERSE) Save.data.stats.inverseTime += dt;

    const er = this.energy / this.max;
    if (Math.abs(er - (this._lastE === undefined ? -1 : this._lastE)) > 0.015) { this._lastE = er; UI.syncEnergy(er); }
    UI.energyLow(this.energy < 30);
  }
}

/* ============================================================
   LUMORA — c11_nexora: NEXORA Interactive Layer Switching System
   Identity: one LARGE ring (Main Layer) + THREE smaller rings
   around it (Layers 01/02/03). Hollow rings, identical stroke,
   no text or icons inside the rings. Tooltip on hover, glow on
   hover, soft highlight on active, energy/morph on switch.
   Works live (game keeps running) + gamepad d-pad support.
   ============================================================ */
const NEXORA = {
  built: false, nodes: [], tip: null, label: null, cur: 0,
  /* geometry — big ring central & lower, three small rings arcing above it */
  GEO: {
    big: { cx: 100, cy: 112, r: 40 },
    small: [ { cx: 44, cy: 76, r: 16 }, { cx: 100, cy: 40, r: 16 }, { cx: 156, cy: 76, r: 16 } ],
    stroke: 4.5,
  },
  init() {
    if (NEXORA.built) return;
    const host = document.getElementById('nexora');
    if (!host) return;
    const g = NEXORA.GEO, sw = g.stroke;
    let svg = '<svg viewBox="0 0 200 175" aria-hidden="true">';
    svg += '<circle class="nx-halo" id="nx-halo-big" cx="' + g.big.cx + '" cy="' + g.big.cy + '" r="' + (g.big.r + 8) + '" style="--c:' + LAYER_META[0].color + '"/>';
    for (let i = 0; i < 3; i++) {
      const s = g.small[i];
      svg += '<circle class="nx-halo" id="nx-halo-' + (i + 1) + '" cx="' + s.cx + '" cy="' + s.cy + '" r="' + (s.r + 8) + '" style="--c:' + LAYER_META[i + 1].color + '"/>';
    }
    // big ring = Main Layer (always the visual anchor)
    svg += '<g class="nx-node" data-layer="0" style="--c:' + LAYER_META[0].color + '">'
      + '<circle class="nx-ring nx-big" cx="' + g.big.cx + '" cy="' + g.big.cy + '" r="' + g.big.r + '" stroke-width="' + sw + '"/></g>';
    // three small rings = Layers 01 / 02 / 03
    for (let i = 0; i < 3; i++) {
      const s = g.small[i];
      svg += '<g class="nx-node nx-small" data-layer="' + (i + 1) + '" style="--c:' + LAYER_META[i + 1].color + '">'
        + '<circle class="nx-ring" cx="' + s.cx + '" cy="' + s.cy + '" r="' + s.r + '" stroke-width="' + sw + '"/></g>';
    }
    svg += '</svg>';
    host.innerHTML = svg + '<div class="nx-tip" id="nx-tip"></div><div class="nx-label" id="nx-label"></div>';
    NEXORA.tip = document.getElementById('nx-tip');
    NEXORA.label = document.getElementById('nx-label');
    host.querySelectorAll('.nx-node').forEach(node => {
      const l = +node.dataset.layer;
      node.addEventListener('click', (e) => { e.stopPropagation(); NEXORA.select(l); });
      node.addEventListener('mouseenter', () => NEXORA.showTip(l, node));
      node.addEventListener('mouseleave', () => NEXORA.hideTip());
      node.addEventListener('touchstart', (e) => { NEXORA.select(l); }, { passive: true });
    });
    NEXORA.built = true;
    NEXORA.sync(0);
  },
  name(l) { return I18N.lang === 'en' ? LAYER_META[l].key : LAYER_META[l].fa; },
  showTip(l, node) {
    if (!NEXORA.tip) return;
    NEXORA.tip.textContent = NEXORA.name(l);
    NEXORA.tip.classList.add('on');
    const host = document.getElementById('nexora');
    const svg = host.querySelector('svg'), box = host.getBoundingClientRect();
    const geo = l === 0 ? NEXORA.GEO.big : NEXORA.GEO.small[l - 1];
    const px = geo.cx / 200, py = (geo.cy - NEXORA.GEO.small[l === 0 ? 0 : l - 1].r - 8) / 175;
    const sx = box.left + px * box.width, sy = box.top + (geo.cy - 62) / 175 * box.height;
    NEXORA.tip.style.left = Math.max(4, sx - box.left - 40) + 'px';
    NEXORA.tip.style.top = Math.max(-26, (geo.cy - 60) / 175 * box.height) + 'px';
  },
  hideTip() { if (NEXORA.tip) NEXORA.tip.classList.remove('on'); },
  select(l) {
    if (Game.state !== 'play' || !Game.player || Game.player.dead) return;
    if (Game.player.curLayer === l) { NEXORA.pulse(l); return; }
    Game.player.switchLayerTo(l); // real in-game layer change, game keeps running
  },
  pulse(l) { // already on this layer — subtle breathing highlight
    if (typeof document === 'undefined' || !document.getElementById) return;
    const h = document.getElementById('nx-halo-' + (l === 0 ? 'big' : l));
    if (!h) return;
    h.classList.remove('fire'); void h.getBBox && h.getBoundingClientRect(); h.classList.add('fire');
    setTimeout(() => h.classList.remove('fire'), 450);
  },
  onSwitch(l) { // called by Player.switchLayerTo — energy/morph transition
    if (typeof document === 'undefined' || !document.getElementById) return;
    const host = document.getElementById('nexora');
    if (!host) return;
    host.classList.remove('morphing'); void host.offsetWidth; host.classList.add('morphing');
    setTimeout(() => host.classList.remove('morphing'), 520);
    NEXORA.pulse(l);
    NEXORA.sync(l);
  },
  sync(l) {
    if (typeof document === 'undefined' || !document.querySelectorAll) return; // headless test stubs
    NEXORA.cur = l;
    document.querySelectorAll('.nx-node').forEach(n => n.classList.toggle('on', +n.dataset.layer === l));
    document.querySelectorAll('.nx-halo').forEach(h => {
      const hl = h.id === 'nx-halo-big' ? 0 : +h.id.split('-')[2];
      h.classList.toggle('on', hl === l);
    });
    if (NEXORA.label) {
      NEXORA.label.textContent = NEXORA.name(l);
      NEXORA.label.style.color = LAYER_META[l].color;
      NEXORA.label.classList.remove('flash'); void NEXORA.label.offsetWidth; NEXORA.label.classList.add('flash');
    }
  },
  /* gamepad d-pad: left/up/right pick layers 1/2/3, down returns to Main */
  _gpPrev: {},
  pollGamepad() {
    if (Game.state !== 'play' || !navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    const gp = pads && pads[0];
    if (!gp) return;
    const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
    const now = { 12: b(12), 13: b(13), 14: b(14), 15: b(15) };
    const edge = (i) => now[i] && !NEXORA._gpPrev[i];
    if (edge(14)) NEXORA.select(1);
    if (edge(12)) NEXORA.select(2);
    if (edge(15)) NEXORA.select(3);
    if (edge(13)) NEXORA.select(0);
    NEXORA._gpPrev = now;
  },
};
if (typeof window !== 'undefined') window.NEXORA = NEXORA;

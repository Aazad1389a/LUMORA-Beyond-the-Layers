/* ============================================================
   LUMORA — c12_shop: shop, coins economy, character cosmetics
   All items are procedural art-code (no external assets).
   Categories: skins / hats / capes / trails / auras
   Cosmetics apply to local player AND multiplayer ghosts.
   ============================================================ */
const SHOP = {
  cats: [
    { id: 'skins', fa: 'اسکین', en: 'Skins' },
    { id: 'hats', fa: 'کلاه', en: 'Hats' },
    { id: 'capes', fa: 'شنل', en: 'Capes' },
    { id: 'trails', fa: 'ردپا', en: 'Trails' },
    { id: 'auras', fa: 'هاله', en: 'Auras' },
  ],
  items: {
    skins: [
      { id: 'sk-default', fa: 'کلاسیک', en: 'Classic', price: 0, c1: '#f4f7ff', c2: '#8fa3c8' },
      { id: 'sk-ember', fa: 'آتشین', en: 'Ember', price: 120, c1: '#ffe9d0', c2: '#e06a3a' },
      { id: 'sk-jade', fa: 'زمرد', en: 'Jade', price: 120, c1: '#e2fff2', c2: '#2fae7e' },
      { id: 'sk-violet', fa: 'بنفش نئون', en: 'Neon Violet', price: 180, c1: '#f3e9ff', c2: '#8b5cf6' },
      { id: 'sk-rose', fa: 'مرجانی', en: 'Coral', price: 180, c1: '#ffeef2', c2: '#ef5d8f' },
      { id: 'sk-void', fa: 'مه سایه', en: 'Void', price: 320, c1: '#dfe6ff', c2: '#4c3a9e' },
    ],
    hats: [
      { id: 'ht-none', fa: 'بدون کلاه', en: 'None', price: 0 },
      { id: 'ht-antenna', fa: 'آنتن نکسورا', en: 'NEXORA Antenna', price: 220 },
      { id: 'ht-wizard', fa: 'کلاه جادویی', en: 'Wizard Hat', price: 150 },
      { id: 'ht-crown', fa: 'تاج', en: 'Crown', price: 400 },
      { id: 'ht-horns', fa: 'شاخ اهریمن', en: 'Fiend Horns', price: 260 },
      { id: 'ht-holo', fa: 'کلاه هولوگرام', en: 'Holo Visor', price: 320 },
    ],
    capes: [
      { id: 'cp-none', fa: 'بدون شنل', en: 'None', price: 0 },
      { id: 'cp-flame', fa: 'شنل آتشین', en: 'Flame Cape', price: 260, c: '#ff9a4c' },
      { id: 'cp-crystal', fa: 'بال کریستالی', en: 'Crystal Wings', price: 340, c: '#59f2e0' },
      { id: 'cp-galaxy', fa: 'شنل کهکشانی', en: 'Galaxy Cape', price: 420, c: '#b388ff' },
    ],
    trails: [
      { id: 'tr-none', fa: 'بدون رد', en: 'None', price: 0 },
      { id: 'tr-light', fa: 'رد نور', en: 'Light Trail', price: 150 },
      { id: 'tr-stars', fa: 'ستاره‌باران', en: 'Starfall', price: 280 },
      { id: 'tr-flame', fa: 'شعله‌ور', en: 'Inferno Trail', price: 320 },
      { id: 'tr-volt', fa: 'رعد', en: 'Storm Trail', price: 350 },
      { id: 'tr-petal', fa: 'گلبرگ', en: 'Petal Trail', price: 300 },
      { id: 'tr-galaxy', fa: 'کهکشان', en: 'Galaxy Trail', price: 480 },
    ],
    auras: [
      { id: 'au-none', fa: 'بدون هاله', en: 'None', price: 0 },
      { id: 'au-plasma', fa: 'هاله پلاسما', en: 'Plasma Aura', price: 220, c: '#22d3ee' },
      { id: 'au-gold', fa: 'هاله سلطنتی', en: 'Royal Aura', price: 420, c: '#ffd76a' },
      { id: 'au-inferno', fa: 'هاله شعله', en: 'Inferno Aura', price: 360, c: '#ff7a3c' },
      { id: 'au-nebula', fa: 'هاله سحابی', en: 'Nebula Aura', price: 480, c: '#b388ff' },
    ],
  },
};

const Cos = {
  SLOT: { skins: 'skin', hats: 'hat', capes: 'cape', trails: 'trail', auras: 'aura' },
  defaults() {
    return { owned: ['sk-default', 'ht-none', 'cp-none', 'tr-none', 'au-none'],
      equipped: { skin: 'sk-default', hat: 'ht-none', cape: 'cp-none', trail: 'tr-none', aura: 'au-none' } };
  },
  /* cosmetics for a player-like object: remote players carry p.cos */
  forP(p) {
    if (p && p.cos) return p.cos; // remote payload {skin,hat,cape,aura}
    return (Save.data.shop && Save.data.shop.equipped) || Cos.defaults().equipped;
  },
  find(cat, id) { return SHOP.items[cat].find(i => i.id === id) || SHOP.items[cat][0]; },
  owned(id) { return !!(Save.data.shop && Save.data.shop.owned.includes(id)); },
  buy(item, cat) {
    if (Cos.owned(item.id)) return 'owned';
    if (Save.data.coins < item.price) return 'poor';
    Save.data.coins -= item.price;
    Save.data.shop.owned.push(item.id);
    Save.data.shop.equipped[Cos.SLOT[cat]] = item.id;
    Save.save();
    return 'bought';
  },
  equip(cat, id) { if (Cos.owned(id)) { Save.data.shop.equipped[Cos.SLOT[cat]] = id; Save.save(); } },
  /* payload for multiplayer */
  payload() {
    const e = Save.data.shop.equipped;
    return { skin: e.skin, hat: e.hat, cape: e.cape, aura: e.aura };
  },
  /* ------- painters (shared by game + shop preview) ------- */
  auraDraw(ctx, p, cos, t) {
    if (!cos || cos.aura === 'au-none') return;
    const c = Cos.find('auras', cos.aura).c || '#22d3ee';
    const r = 40 + Math.sin(t * 2.6) * 5;
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = c; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.ellipse(0, -27, r, r * 1.18, 0, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 0.28;
    ctx.drawImage(Glow.sprite(c, 56), -56, -56);
    ctx.restore();
  },
  capeDraw(ctx, cos, t, moving) {
    if (!cos || cos.cape === 'cp-none') return;
    const item = Cos.find('capes', cos.cape);
    const c = item.c || '#ff9a4c';
    const wob = Math.sin(t * 6 + 1) * (moving ? 6 : 3);
    ctx.save();
    if (item.id === 'cp-crystal') {
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = c;
      ctx.beginPath(); // crystal wings
      ctx.moveTo(-8, -44);
      ctx.lineTo(-26, -34 + wob * 0.4); ctx.lineTo(-20, -22); ctx.lineTo(-6, -26);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(-8, -42);
      ctx.lineTo(-30, -26 + wob * 0.6); ctx.lineTo(-16, -14); ctx.lineTo(-5, -22);
      ctx.closePath(); ctx.fill();
    } else if (item.id === 'cp-galaxy') {
      ctx.globalAlpha = 0.9;
      const g = ctx.createLinearGradient(0, -46, -30, -8);
      g.addColorStop(0, '#b388ff'); g.addColorStop(0.5, '#22d3ee'); g.addColorStop(1, 'rgba(255,215,106,0.05)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-6, -44);
      ctx.quadraticCurveTo(-26, -38 + wob * 0.5, -32 - wob, -22);
      ctx.quadraticCurveTo(-22, -12, -8 - wob * 0.5, -6);
      ctx.quadraticCurveTo(-8, -24, -4, -40);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (let i = 0; i < 5; i++) { const sx = -10 - i * 5, sy = -34 + Math.sin(i * 2 + t * 3) * 6; ctx.fillRect(sx, sy, 1.8, 1.8); }
    } else {
      const g = ctx.createLinearGradient(0, -44, -34, -8);
      g.addColorStop(0, c); g.addColorStop(1, 'rgba(255,60,40,0.05)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-6, -44);
      ctx.quadraticCurveTo(-24, -40 + wob * 0.5, -30 - wob, -26);
      ctx.quadraticCurveTo(-24, -16, -10 - wob * 0.6, -8);
      ctx.quadraticCurveTo(-8, -24, -4, -40);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  },
  hatDraw(ctx, cos) {
    if (!cos || cos.hat === 'ht-none') return;
    ctx.save();
    if (cos.hat === 'ht-wizard') {
      ctx.fillStyle = '#5b3fd4';
      ctx.beginPath();
      ctx.moveTo(-13, -8); ctx.quadraticCurveTo(-2, -30, 4, -34); ctx.quadraticCurveTo(6, -18, 13, -8);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd76a';
      ctx.beginPath(); ctx.arc(2, -26, 2.4, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3c2a96';
      ctx.fillRect(-15, -9, 30, 5);
    } else if (cos.hat === 'ht-crown') {
      ctx.fillStyle = '#ffd76a';
      ctx.beginPath();
      ctx.moveTo(-11, -9); ctx.lineTo(-11, -17); ctx.lineTo(-5, -12); ctx.lineTo(0, -19);
      ctx.lineTo(5, -12); ctx.lineTo(11, -17); ctx.lineTo(11, -9);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff6b7a';
      ctx.beginPath(); ctx.arc(0, -14, 1.8, 0, TAU); ctx.fill();
    } else if (cos.hat === 'ht-horns') {
      ctx.fillStyle = '#e8ecf5';
      ctx.beginPath(); ctx.moveTo(-9, -8); ctx.quadraticCurveTo(-20, -16, -14, -26); ctx.quadraticCurveTo(-9, -18, -4, -10); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(9, -8); ctx.quadraticCurveTo(20, -16, 14, -26); ctx.quadraticCurveTo(9, -18, 4, -10); ctx.closePath(); ctx.fill();
    } else if (cos.hat === 'ht-holo') {
      const hg = ctx.createLinearGradient(-14, -18, 14, -2);
      hg.addColorStop(0, 'rgba(89,242,224,0.85)'); hg.addColorStop(0.5, 'rgba(244,114,182,0.85)'); hg.addColorStop(1, 'rgba(255,215,106,0.85)');
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.ellipse(1, -11, 14, 7, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.5;
      ctx.fillRect(-14, -14, 28, 3);
    } else if (cos.hat === 'ht-antenna') {
      ctx.strokeStyle = '#8ca0c8'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(3, -24); ctx.stroke();
      ctx.strokeStyle = '#59f2e0'; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(3, -28, 4.5, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  },
  /* ------- shop preview (static mini render) ------- */
  paintPreview(cv, cos, t2) {
    const tt = (typeof t2 === 'number') ? t2 : 1.2;
    const g = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    g.clearRect(0, 0, W, H);
    const skin = Cos.find('skins', cos.skin);
    g.save();
    g.translate(W / 2, H - 8);
    g.scale(1.05, 1.05);
    Cos.auraDraw(g, null, cos, tt);
    Cos.capeDraw(g, cos, tt, false);
    g.translate(0, Math.sin(tt * 2.6) * 2.4);
    const H2 = 54, W2 = 30;
    const grad = g.createLinearGradient(0, -H2, 0, 0);
    grad.addColorStop(0, skin.c1); grad.addColorStop(0.55, skin.c1); grad.addColorStop(1, skin.c2);
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(-W2 / 2 + 3, 0);
    g.quadraticCurveTo(-W2 / 2 - 3, -H2 * 0.45, -W2 / 2 + 6, -H2 * 0.72);
    g.quadraticCurveTo(-4, -H2 - 4, W2 / 2 - 5, -H2 * 0.7);
    g.quadraticCurveTo(W2 / 2 + 3, -H2 * 0.4, W2 / 2 - 3, 0);
    g.closePath(); g.fill();
    g.strokeStyle = '#59f2e0'; g.lineWidth = 2; g.stroke();
    const headY = -H2 - 10;
    g.fillStyle = skin.c1;
    g.beginPath(); g.arc(1, headY, 12, 0, TAU); g.fill();
    g.strokeStyle = '#59f2e0'; g.lineWidth = 1.8; g.stroke();
    g.fillStyle = '#101528';
    g.beginPath(); g.ellipse(4, headY - 1, 3.2, 4.2, 0, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(8, headY - 0.4, 2.6, 3.6, 0, 0, TAU); g.fill();
    g.translate(0, 0);
    Cos.hatDraw(g, cos);
    g.restore();
  },
};

const Coins = {
  add(n, silent) {
    if (!n) return;
    Save.data.coins = (Save.data.coins || 0) + n;
    Save.saveSoon();
    if (!silent && typeof UI !== 'undefined') UI.syncCoins();
  },
};
if (typeof window !== 'undefined') { window.SHOP = SHOP; window.Cos = Cos; window.Coins = Coins; }


const ShopUI = {
  build() {
    const grid = document.getElementById('shop-grid');
    if (!grid) return;
    document.getElementById('shop-coins').textContent = '🪙 ' + (Save.data.coins || 0);
    let html = '';
    for (const cat of SHOP.cats) {
      html += '<div class="shop-cat"><h3>' + (I18N.lang === 'en' ? cat.en : cat.fa) + '</h3><div class="shop-row">';
      for (const it of SHOP.items[cat.id]) {
        const owned = Cos.owned(it.id);
        const equipped = Save.data.shop.equipped[Cos.SLOT[cat.id]] === it.id;
        const nm = I18N.lang === 'en' ? it.en : it.fa;
        let btn;
        if (equipped) btn = '<button class="sbtn eq" disabled>' + TR('shop-on') + '</button>';
        else if (owned) btn = '<button class="sbtn wear" data-act="equip" data-cat="' + cat.id + '" data-id="' + it.id + '">' + TR('shop-wear') + '</button>';
        else btn = '<button class="sbtn buy' + (Save.data.coins < it.price ? ' poor' : '') + '" data-act="buy" data-cat="' + cat.id + '" data-id="' + it.id + '">' + TR('shop-buy') + ' 🪙' + it.price + '</button>';
        html += '<div class="shop-card' + (equipped ? ' on' : '') + '">'
          + '<canvas width="76" height="84" data-prev="' + cat.id + ':' + it.id + '"></canvas>'
          + '<div class="sc-name">' + nm + '</div>'
          + (owned ? '' : '<div class="sc-price">🪙 ' + it.price + '</div>')
          + btn + '</div>';
      }
      html += '</div></div>';
    }
    grid.innerHTML = html;
    grid.querySelectorAll('canvas[data-prev]').forEach(cv => {
      const [cat, id] = cv.dataset.prev.split(':');
      const cos = Object.assign({}, Save.data.shop.equipped);
      cos[Cos.SLOT[cat]] = id;
      Cos.paintPreview(cv, cos);
    });
    grid.querySelectorAll('.sbtn[data-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cat = btn.dataset.cat, id = btn.dataset.id;
        const item = Cos.find(cat, id);
        if (btn.dataset.act === 'buy') {
          const res = Cos.buy(item, cat);
          if (res === 'bought') { AudioSys.sfx('unlock'); UI.toast(TR('shop-t'), TR('shop-bought') + ' — ' + (I18N.lang === 'en' ? item.en : item.fa), 'gold'); }
          else { AudioSys.sfx('deny'); UI.toast(TR('shop-t'), TR('shop-poor'), 'red'); return; }
        } else { Cos.equip(cat, id); AudioSys.sfx('uiClick'); }
        ShopUI.build();
      });
    });
  },
};
if (typeof window !== 'undefined') window.ShopUI = ShopUI;

/* ============================================================
   LUMORA — c8_multi: online multiplayer over PeerJS
   Rooms (host-authoritative star topology), voice chat (WebRTC
   media mesh), 3 modes: race / dodge / hunt. Lobby up to 6.
   Pure helpers (touchCheck, huntCheck, rankings) are unit-tested.
   ============================================================ */
const MP = {
  MAX_PLAYERS: 6, proto: 2,
  COLORS: ['#59f2e0', '#ffd76a', '#ff8fa3', '#9fd4ff', '#b6a8ff', '#8dff9e'],
  state: 'off',            // off | connecting | lobby | game | results
  isHost: false, roomCode: null, myId: null,
  peer: null, conns: [], hostConn: null,
  players: {},             // id -> {name,color,ready,mic,deaths,finished,finishTime,hunter,caughtAt}
  order: [],
  mode: 'race', roundTime: 120, left: 0, timeAcc: 0, sendAcc: 0,
  levelId: null, hunterId: null,
  chat: [],
  voice: { stream: null, ptt: true, calls: {}, vol: 0.8 },
  ghosts: {},              // id -> interpolated remote player
  myName: 'لومورا',
};

MP.makeCode = () => {
  const CH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 4; i++) c += CH[Math.floor(Math.random() * CH.length)];
  return c;
};

/* ---------- pure logic (unit-tested in node) ---------- */
// dodge mode: any two alive players (same layer) within TOUCH_R both die
MP.TOUCH_R = 26;
MP.touchCheck = function (list) {
  const dead = [];
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (!a.alive) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (!b.alive || a.L !== b.L) continue;
      if (a.invuln > 0 || b.invuln > 0) continue;
      const dx = a.x - b.x, dy = a.y - b.y;
      if (dx * dx + dy * dy < MP.TOUCH_R * MP.TOUCH_R) { if (!dead.includes(a.id)) dead.push(a.id); if (!dead.includes(b.id)) dead.push(b.id); }
    }
  }
  return dead;
};
// hunt mode: ids of alive prey within CATCH_R of any alive hunter
MP.CATCH_R = 30;
MP.huntCheck = function (list) {
  const caught = [];
  for (const p of list) {
    if (!p.alive || p.invuln > 0 || p.hunter) continue;
    for (const h of list) {
      if (!h.alive || !h.hunter || h.L !== p.L) continue;
      const dx = p.x - h.x, dy = p.y - h.y;
      if (dx * dx + dy * dy < MP.CATCH_R * MP.CATCH_R) { caught.push(p.id); break; }
    }
  }
  return caught;
};
MP.rankRace = function (players) {
  return Object.entries(players)
    .map(([id, p]) => ({ id, name: p.name, color: p.color, val: p.finished ? p.finishTime : null }))
    .sort((a, b) => (a.val === null ? Infinity : a.val) - (b.val === null ? Infinity : b.val));
};
MP.rankDodge = function (players) {
  return Object.entries(players)
    .map(([id, p]) => ({ id, name: p.name, color: p.color, val: p.deaths }))
    .sort((a, b) => a.val - b.val);
};
MP.rankHunt = function (players) {
  return Object.entries(players)
    .map(([id, p]) => ({ id, name: p.name, color: p.color, val: p.caughtAt === null || p.caughtAt === undefined ? -1 : p.caughtAt, prey: !p.hunter }))
    .sort((a, b) => (b.prey ? 1 : 0) - (a.prey ? 1 : 0) || (b.val === -1 ? 9e9 : b.val) - (a.val === -1 ? 9e9 : a.val));
};

/* ---------- networking ---------- */
MP.ERR_FA = {
  'peer-unavailable': 'روم با این کد پیدا نشد — کد را بررسی کنید',
  'network': 'ارتباط با سرور سیگنالینگ قطع شد',
  'server-error': 'سرور سیگنالینگ موقتا در دسترس نیست',
  'socket-error': 'اتصال سوکت برقرار نشد — تلاش مجدد…',
  'socket-closed': 'اتصال سوکت بسته شد — تلاش مجدد…',
  'browser-incompatible': 'مرورگر شما WebRTC را پشتیبانی نمی‌کند',
  'ssl-unavailable': 'اتصال امن برقرار نشد — اینترنت را بررسی کنید',
};
MP.errText = (e) => MP.ERR_FA[e && e.type] || ('خطای شبکه: ' + ((e && (e.type || e.message)) || e));
MP.ICE = { iceServers: [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: 'stun:stun.cloudflare.com:3478' },
] };
MP.peerOpts = function () {
  const o = { config: MP.ICE, debug: 0 };
  const s = ((Save.data && Save.data.settings && Save.data.settings.signaling) || '').trim();
  if (s) { // custom PeerServer, e.g. myserver.example.com:9000/lumora
    const m = s.match(/^([^:\/]+)(?::(\d+))?(\/.*)?$/);
    if (m) { o.host = m[1]; o.port = m[2] ? +m[2] : 443; o.path = m[3] || '/'; o.secure = +o.port === 443; o.key = 'lumora'; }
  }
  return o;
};
MP.ensurePeerJS = function () {
  if (window.Peer) return Promise.resolve(window.Peer);
  /* the bundle already embeds PeerJS in its own script tag; if THAT failed to
     parse on an old browser, try CDNs in order before giving up */
  const CDNS = [
    'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js',
    'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js',
  ];
  return new Promise((res, rej) => {
    let i = 0;
    const tryNext = () => {
      if (window.Peer) return res(window.Peer);
      if (i >= CDNS.length) return rej(new Error('کتابخانه‌ی شبکه بارگذاری نشد'));
      const s = document.createElement('script');
      s.src = CDNS[i++];
      s.onload = () => window.Peer ? res(window.Peer) : tryNext();
      s.onerror = () => tryNext();
      document.head.appendChild(s);
    };
    tryNext();
    setTimeout(() => rej(new Error('timeout')), 15000);
  });
};
MP.broadcast = function (obj, exceptConn) {
  for (const c of MP.conns) { if (c === exceptConn || !c.open) continue; try { c.send(obj); } catch (e) { /* ignore */ } }
};
MP.roster = function () {
  const ps = {};
  for (const id of MP.order) { const p = MP.players[id]; ps[id] = { name: p.name, color: p.color, mic: p.mic, ready: true, cos: p.cos || null }; }
  MP.broadcast({ t: 'roster', order: MP.order, ps, mode: MP.mode, roundTime: MP.roundTime });
  MP.uiLobby();
};
MP.host = async function (attempt) {
  attempt = attempt || 0;
  try {
    const Peer = await MP.ensurePeerJS();
    MP.reset();
    MP.isHost = true;
    MP.roomCode = MP.makeCode();
    MP.myId = 'HOST';
    MP.myName = (document.getElementById('mp-name').value || 'لومورا').slice(0, 12);
    MP.setState('connecting');
    MP.netStatus('ساخت روم…');
    const peer = new Peer('LUMORA-R-' + MP.roomCode, MP.peerOpts());
    MP.peer = peer;
    peer.on('open', () => {
      MP.players['HOST'] = { name: MP.myName, color: MP.COLORS[0], mic: false, deaths: 0, finished: false, finishTime: null, hunter: false, caughtAt: null };
      MP.order = ['HOST'];
      MP.setState('lobby');
      MP.netStatus('روم آماده است — کد را برای دوستان بفرستید');
      MP.sysChat(TR('sys-created', MP.roomCode));
      MP.uiLobby();
    });
    peer.on('connection', (c) => {
      MP.conns.push(c);
      c.on('data', (d) => MP.hostData(c, d));
      c.on('close', () => MP.hostDrop(c));
      c.on('error', () => MP.hostDrop(c));
    });
    peer.on('error', (e) => {
      if (e.type === 'unavailable' && attempt < 3) { try { peer.destroy(); } catch (er) {} MP.host(attempt + 1); return; } // code collision: pick a new code
      MP.netStatus(MP.errText(e));
      MP.setState('off');
    });
  } catch (e) { MP.netStatus(e.message || 'اتصال ناموفق'); MP.setState('off'); }
};
MP.join = async function (code, attempt) {
  attempt = attempt || 0;
  try {
    const Peer = await MP.ensurePeerJS();
    MP.reset();
    MP.isHost = false;
    MP.roomCode = (code || '').toUpperCase().trim();
    if (!/^[A-Z0-9]{4}$/.test(MP.roomCode)) { MP.netStatus('کد روم نامعتبر است — ۴ حرف انگلیسی/عدد'); return; }
    MP.myId = 'C-' + Math.random().toString(36).slice(2, 8);
    MP.myName = (document.getElementById('mp-name').value || 'لومورا').slice(0, 12);
    MP.setState('connecting');
    MP.netStatus('اتصال به روم ' + MP.roomCode + '…');
    const peer = new Peer(MP.peerOpts());
    MP.peer = peer;
    peer.on('open', () => {
      const c = peer.connect('LUMORA-R-' + MP.roomCode, { reliable: true });
      MP.hostConn = c;
      c.on('open', () => { c.send({ t: 'hi', name: MP.myName, id: MP.myId, cos: (typeof Cos !== 'undefined' ? Cos.payload() : null) }); MP.setState('lobby'); MP.netStatus('متصل!'); MP.ping = 0; });
      c.on('data', (d) => MP.clientData(d));
      c.on('close', () => {
        if ((MP.state === 'game' || MP.state === 'lobby') && attempt < 1) { MP.netStatus('اتصال قطع شد — اتصال مجدد…'); MP.join(MP.roomCode, attempt + 1); return; }
        if (MP.state !== 'off') { MP.netStatus('میزبان روم را بست'); MP.setState('off'); }
      });
      c.on('error', () => { if (attempt < 1) { MP.join(MP.roomCode, attempt + 1); return; } MP.netStatus('خطای اتصال'); MP.setState('off'); });
      setTimeout(() => { if (MP.state === 'connecting') { MP.netStatus('روم پاسخ نداد — میزبان باید آنلاین باشد'); MP.setState('off'); } }, 12000);
    });
    peer.on('error', (e) => {
      const transient = ['network', 'socket-error', 'socket-closed', 'server-error'].includes(e.type);
      if (transient && attempt < 1) { MP.netStatus(MP.errText(e)); setTimeout(() => MP.join(MP.roomCode, attempt + 1), 1600); return; }
      MP.netStatus(MP.errText(e));
      MP.setState('off');
    });
  } catch (e) { MP.netStatus(e.message || 'اتصال ناموفق'); MP.setState('off'); }
};
MP.hostData = function (c, d) {
  if (!d || typeof d !== 'object') return;
  if (d.t === 'hi') {
    if (MP.order.length >= MP.MAX_PLAYERS) { try { c.send({ t: 'full' }); } catch (e) {} setTimeout(() => c.close(), 200); return; }
    const pid = (d.id || c.peer).slice(0, 16);
    MP.players[pid] = { name: ('' + (d.name || 'مهمان')).slice(0, 12), color: MP.COLORS[MP.order.length % MP.COLORS.length], mic: false, deaths: 0, finished: false, finishTime: null, hunter: false, caughtAt: null, conn: c, peerId: c.peer, cos: d.cos || null };
    MP.order.push(pid);
    MP.sysChat(TR('sys-joined', MP.players[pid] ? MP.players[pid].name : d.name));
    MP.roster();
    MP.voiceConnectTo(pid, c.peer);
  } else if (d.t === 's') { const p = MP.players[d.id]; if (p) p.in = d; }
  else if (d.t === 'chat') {
    const pid = d.id || MP.order.find(id => MP.players[id] && MP.players[id].conn === c);
    const pname = MP.players[pid] ? MP.players[pid].name : '?';
    MP.addChat(pname, d.m);
    MP.broadcast({ t: 'chat', n: pname, m: d.m }, c);
  }
  else if (d.t === 'fin') { const p = MP.players[d.id]; if (p && !p.finished) { p.finished = true; p.finishTime = d.v; MP.sysChat(TR('sys-finish', p.name, d.v.toFixed(1) + 's')); MP.broadcast({ t: 'fin', id: d.id, v: d.v }, c); if (MP.order.every(id => MP.players[id].finished)) MP.endRound(); } }
  else if (d.t === 'died') { const p = MP.players[d.id]; if (p && MP.state === 'game') { p.deaths++; MP.broadcast({ t: 'deaths', d: MP.order.map(id => [id, MP.players[id].deaths]) }, c); } }
  else if (d.t === 'caught') { MP.hostCatch(d.id); }
  else if (d.t === 'mic') { const p = MP.players[d.id]; if (p) { p.mic = !!d.on; MP.roster(); } }
  else if (d.t === 'ping') { try { c.send({ t: 'pong', ts: d.ts }); } catch (e) {} }
  else if (d.t === 'pong') { MP.ping = Date.now() - d.ts; }
};
MP.hostDrop = function (c) {
  const idx = MP.conns.indexOf(c);
  if (idx >= 0) MP.conns.splice(idx, 1);
  const pid = MP.order.find(id => MP.players[id] && MP.players[id].conn === c);
  if (pid) {
    MP.sysChat(TR('sys-left', MP.players[pid].name));
    delete MP.players[pid];
    MP.order = MP.order.filter(id => id !== pid);
    MP.roster();
    if (MP.state === 'game' && MP.hunterId === pid && MP.mode === 'hunt') MP.hostCatch(null, pid); // reassign if needed
  }
};
MP.clientData = function (d) {
  if (!d || typeof d !== 'object') return;
  if (d.t === 'roster') {
    MP.order = d.order.slice();
    const changed = MP.order.length !== Object.keys(MP.players).length;
    MP.players = {};
    for (const id of MP.order) {
      const src = d.ps[id] || {};
      MP.players[id] = { name: src.name, color: src.color, mic: src.mic, deaths: MP.players[id] ? MP.players[id].deaths : 0, finished: false, finishTime: null, hunter: false, caughtAt: null };
    }
    if (MP.players[MP.myId]) MP.players[MP.myId].mic = MP.voice.stream ? MP.players[MP.myId].mic : false;
    if (changed) MP.voiceSyncAll();
    MP.uiLobby();
  } else if (d.t === 'full') { MP.netStatus('روم پر است (حداکثر ۶ نفر)'); MP.setState('off'); }
  else if (d.t === 'chat') MP.addChat(d.n, d.m);
  else if (d.t === 'start') MP.beginGame(d);
  else if (d.t === 'S') MP.applySnapshot(d);
  else if (d.t === 'time') MP.left = d.v;
  else if (d.t === 'fin') { const p = MP.players[d.id]; if (p && !p.finished) { p.finished = true; p.finishTime = d.v; MP.sysChat(TR('sys-finish', p.name, d.v.toFixed(1) + 's')); } }
  else if (d.t === 'die') MP.remoteDie(d);
  else if (d.t === 'role') { const p = MP.players[d.id]; if (p) { p.hunter = !!d.h; p.caughtAt = d.h ? (d.at || 0) : null; MP.uiGameHud(); } }
  else if (d.t === 'deaths') { for (const [id, n] of d.d) { if (MP.players[id]) MP.players[id].deaths = n; } MP.uiGameHud(); }
  else if (d.t === 'end') MP.showResults(d.results);
  else if (d.t === 'ping') { if (MP.hostConn && MP.hostConn.open) { try { MP.hostConn.send({ t: 'pong', ts: d.ts }); } catch (e) {} } }
  else if (d.t === 'pong') { MP.ping = Date.now() - d.ts; }
};
MP.hostCatch = function (caughtId, replacedId) {
  if (MP.state !== 'game' || MP.mode !== 'hunt') return;
  if (caughtId) {
    const p = MP.players[caughtId];
    if (!p || p.hunter) return;
    p.hunter = true; p.caughtAt = MP.roundTime - MP.left;
    MP.broadcast({ t: 'role', id: caughtId, h: true, at: p.caughtAt });
    const hunted = TR('sys-hunted', p.name);
    MP.sysChat(hunted);
    MP.broadcast({ t: 'chat', n: 'سامانه', m: hunted });
  }
  MP.uiGameHud();
};

/* ---------- game start / rounds ---------- */
MP.hostStart = function () {
  if (!MP.isHost || MP.state !== 'lobby') return;
  const time = Math.max(30, Math.min(600, parseInt(document.getElementById('mp-time').value, 10) || 120));
  MP.roundTime = time; MP.left = time;
  MP.mode = document.getElementById('mp-mode').value;
  MP.levelId = 'INF-MP-' + MP.roomCode;
  let hunterId = null;
  if (MP.mode === 'hunt') {
    let h = 0;
    for (let i = 0; i < MP.roomCode.length; i++) h = (h * 31 + MP.roomCode.charCodeAt(i)) | 0;
    hunterId = MP.order[Math.abs(h) % MP.order.length];
    MP.hunterId = hunterId;
    MP.players[hunterId].hunter = true;
  }
  for (const id of MP.order) { const p = MP.players[id]; p.deaths = 0; p.finished = false; p.finishTime = null; if (MP.mode !== 'hunt') p.hunter = false; p.caughtAt = null; }
  const payload = { t: 'start', mode: MP.mode, time, levelId: MP.levelId, hunterId, order: MP.order, ps: MP.order.map(id => [id, MP.players[id].hunter]), names: MP.order.map(id => MP.players[id].name) };
  MP.broadcast(payload);
  MP.beginGame(payload);
};
MP.beginGame = function (d) {
  MP.mode = d.mode; MP.roundTime = d.time; MP.left = d.time;
  MP.levelId = d.levelId; MP.hunterId = d.hunterId || null;
  MP.players = {};
  for (const id of d.order) {
    const mine = id === MP.myId;
    const name = mine ? MP.myName : ((d.names && d.names[d.order.indexOf(id)]) || 'پلیر');
    MP.players[id] = { name, color: MP.COLORS[(d.order.indexOf(id)) % MP.COLORS.length], mic: false, deaths: 0, finished: false, finishTime: null, hunter: false, caughtAt: null };
  }
  for (const [id, h] of d.ps || []) if (MP.players[id]) MP.players[id].hunter = !!h;
  MP.ghosts = {};
  MP.setState('game');
  UI.show(null);
  Game.startLevel(MP.levelId);
  UI.show('scr-play'); // ensure HUD visible
  MP.uiGameHud();
  if (MP.mode === 'hunt') {
    const meH = MP.players[MP.myId] && MP.players[MP.myId].hunter;
    UI.toast(meH ? TR('toast-hunter-you') : TR('toast-hunt'), meH ? TR('toast-hunter-you-d') : TR('toast-hunt-d'), meH ? 'red' : 'gold');
  } else if (MP.mode === 'dodge') {
    UI.toast(TR('toast-dodge'), TR('toast-dodge-d'), 'cy');
  } else {
    UI.toast(TR('toast-race'), TR('toast-race-d'), 'gold');
  }
  MP.sysChat(TR('sys-started', TR('mode-' + MP.mode), MP.roundTime));
};
MP.endRound = function () {
  if (!MP.isHost) return;
  const results = MP.mode === 'race' ? MP.rankRace(MP.players) : MP.mode === 'dodge' ? MP.rankDodge(MP.players) : MP.rankHunt(MP.players);
  MP.broadcast({ t: 'end', results });
  MP.showResults(results);
};
MP.showResults = function (results) {
  MP.setState('results');
  if (results && results[0] && results[0].id === MP.myId && typeof Coins !== 'undefined') Coins.add(30); // round win reward
  MP.results = results || [];
  const el = document.getElementById('mpres-rows');
  if (el) {
    el.innerHTML = MP.results.map((r, i) =>
      '<div class="stat-row' + (i === 0 ? ' mp-win' : '') + '"><span style="color:' + r.color + '">' + (i + 1) + '. ' + r.name + (i === 0 ? ' 👑' : '') + '</span><b>' +
      (MP.mode === 'race' ? (r.val === null ? TR('mp-unranked') : r.val.toFixed(1) + 's') : MP.mode === 'dodge' ? TR('mp-deaths', r.val) : (r.prey ? TR('mp-survivor') : TR('mp-hunted-at', r.val))) + '</b></div>'
    ).join('');
  }
  UI.show('scr-mpres');
  AudioSys.sfx('goal');
};
MP.leave = function () {
  MP.reset();
  MP.setState('off');
  MP.netStatus('روم ترک شد');
};
MP.reset = function () {
  for (const c of MP.conns) { try { c.close(); } catch (e) {} }
  MP.conns = [];
  if (MP.hostConn) { try { MP.hostConn.close(); } catch (e) {} }
  MP.hostConn = null;
  if (MP.peer) { try { MP.peer.destroy(); } catch (e) {} }
  MP.peer = null;
  MP.players = {}; MP.order = []; MP.ghosts = {};
  MP.isHost = false; MP.roomCode = null; MP.hostId = null;
  MP.voiceDropAll();
};
MP.setState = function (s) {
  MP.state = s;
  const panel = document.getElementById('scr-mp');
  if (!panel) return;
  document.getElementById('mp-connect').style.display = (s === 'off' || s === 'connecting') ? '' : 'none';
  document.getElementById('mp-lobby').style.display = (s === 'lobby' || s === 'connecting') ? '' : 'none';
  document.getElementById('mp-start').style.display = MP.isHost && s === 'lobby' ? '' : 'none';
  if (s === 'lobby' || s === 'game' || s === 'results') document.getElementById('mp-room-code').textContent = MP.roomCode || '—';
  if (s === 'game' || s === 'results') { UI.show(null); }
};

/* ---------- per-frame (called from updatePlay) ---------- */
MP.tickLocal = function (dt) {
  if (MP.state !== 'game') return;
  const p = Game.player;
  if (!p) return;
  // hunter speed bonus
  p.mpMul = (MP.mode === 'hunt' && MP.players[MP.myId] && MP.players[MP.myId].hunter) ? 1.18 : 1;
  // send my state at 20Hz
  MP.sendAcc += dt;
  if (MP.sendAcc >= 0.05) {
    MP.sendAcc = 0;
    const st = { t: 's', id: MP.myId, x: Math.round(p.x), y: Math.round(p.y), f: p.face, L: p.curLayer, d: p.dead ? 1 : 0, a: p.anim, v: Math.round(p.invuln * 10) };
    if (MP.isHost) { const me = MP.players[MP.myId]; if (me) me.in = st; }
    else if (MP.hostConn && MP.hostConn.open) { try { MP.hostConn.send(st); } catch (e) {} }
  }
  // mode logic (local detection for responsiveness; host keeps score)
  if (!p.dead && p.invuln <= 0) {
    const others = [];
    for (const id of MP.order) {
      if (id === MP.myId) continue;
      const g = MP.ghosts[id];
      if (!g) continue;
      others.push({ id, x: g.x, y: g.y, L: g.L, alive: !g.d, hunter: (MP.players[id] || {}).hunter === true, invuln: 0 });
    }
    const me = { id: MP.myId, x: p.x + 15, y: p.y + p.boxH / 2, L: p.curLayer, alive: !p.dead, hunter: MP.players[MP.myId] ? MP.players[MP.myId].hunter : false, invuln: p.invuln };
    if (MP.mode === 'dodge') {
      const pair = [{ ...me }];
      for (const o of others) pair.push({ ...o, x: o.x, y: o.y });
      const dead = MP.touchCheck(pair);
      if (dead.includes(MP.myId) && !p.dead) { MP.sendMsg({ t: 'died', id: MP.myId }); Game.killPlayer(); }
    } else if (MP.mode === 'hunt') {
      const list = [{ ...me }];
      for (const o of others) list.push({ ...o });
      const caught = MP.huntCheck(list);
      if (caught.includes(MP.myId) && !me.hunter) MP.sendMsg({ t: 'caught', id: MP.myId });
    }
  }
  // race: gate check
  if (MP.mode === 'race' && !p.dead) {
    const w = Game.world;
    if (w && !MP.players[MP.myId].finished && U.overlaps(p.rect(), w.gate)) {
      MP.players[MP.myId].finished = true;
      MP.players[MP.myId].finishTime = Game.levelTime;
      MP.sendMsg({ t: 'fin', id: MP.myId, v: Game.levelTime });
      UI.toast(TR('toast-finish'), TR('toast-your-time', Game.levelTime.toFixed(1) + 's'), 'gold');
    }
  }
  // host: relay states, timer, roster pings
  if (MP.isHost) {
    const ps = [];
    for (const id of MP.order) { const rec = MP.players[id]; if (rec && rec.in) ps.push({ id, x: rec.in.x, y: rec.in.y, f: rec.in.f, L: rec.in.L, d: rec.in.d, a: rec.in.a, v: rec.in.v }); }
    MP.applySnapshot({ ps }); // host renders remote players too
    MP.broadcast({ t: 'S', ps });
    MP.left -= dt;
    MP.timeAcc += dt;
    if (MP.timeAcc >= 0.5) { MP.timeAcc = 0; MP.broadcast({ t: 'time', v: Math.max(0, MP.left) }); }
    if (MP.left <= 0) MP.endRound();
    MP.pingAcc = (MP.pingAcc || 0) + dt;
    if (MP.pingAcc >= 2) { MP.pingAcc = 0; MP.broadcast({ t: 'ping', ts: Date.now() }); }
  } else {
    MP.left -= dt; // client-side countdown, corrected by host each 0.5s
    MP.pingAcc = (MP.pingAcc || 0) + dt;
    if (MP.pingAcc >= 2) { MP.pingAcc = 0; if (MP.hostConn && MP.hostConn.open) { try { MP.hostConn.send({ t: 'ping', ts: Date.now() }); } catch (e) {} } }
  }
  MP.hudAcc = (MP.hudAcc || 0) + dt;
  if (MP.hudAcc >= 0.25) { MP.hudAcc = 0; MP.uiGameHud(); }
};
MP.sendMsg = function (obj) {
  if (MP.isHost) MP.hostData({ peer: 'self' }, obj);
  else if (MP.hostConn && MP.hostConn.open) { try { MP.hostConn.send(obj); } catch (e) {} }
};
MP.applySnapshot = function (S) {
  for (const st of S.ps) {
    if (st.id === MP.myId) continue;
    let g = MP.ghosts[st.id];
    if (!g) {
      g = MP.ghosts[st.id] = {
        x: st.x, y: st.y, tx: st.x, ty: st.y, face: st.f || 1, L: st.L || 0, d: st.d || 0,
        anim: st.a || 'idle', animT: 0, invuln: 0, w: 30, boxH: 54, gravSign: 1, curLayer: st.L || 0,
        squash: 1, stretch: 1, scarf: [], dblFx: 0, sliding: false,
      };
      for (let i = 0; i < 12; i++) g.scarf.push({ x: st.x, y: st.y });
    }
    g.tx = st.x; g.ty = st.y; g.faceT = st.f || 1; g.L = st.L || 0; g.curLayer = st.L || 0; g.d = st.d || 0;
    g.anim = st.a || 'idle'; g.invuln = (st.v || 0) / 10;
  }
};
MP.tickGhosts = function (dt) {
  for (const id in MP.ghosts) {
    const g = MP.ghosts[id];
    const k = 1 - Math.exp(-dt * 12);
    g.x += (g.tx - g.x) * k;
    g.y += (g.ty - g.y) * k;
    if (g.faceT) { g.face += (g.faceT - g.face) * k * 2; }
    g.animT += dt;
    // scarf trail
    g.scarf.unshift({ x: g.x + 15 - g.face * 12, y: g.y + 18 });
    if (g.scarf.length > 12) g.scarf.pop();
  }
};

/* ---------- remote death (dodge: the OTHER player's side tells us) ---------- */
MP.remoteDie = function (d) {
  // dodge double-kill: if I was part of the pair, die too
  if (MP.mode === 'dodge' && d.ids && d.ids.includes(MP.myId) && Game.player && !Game.player.dead && Game.player.invuln <= 0) {
    Game.killPlayer();
  }
};

/* ---------- voice chat (WebRTC mesh) ---------- */
MP.micToggle = async function () {
  const btn = document.getElementById('mp-mic');
  if (MP.voice.stream) {
    MP.voice.stream.getTracks().forEach(tr => tr.stop());
    MP.voice.stream = null;
    MP.voiceDropAll();
    if (btn) btn.textContent = TR('mp-mic-off');
    MP.sendMsg({ t: 'mic', id: MP.myId, on: false });
    if (MP.isHost) { const me = MP.players[MP.myId]; if (me) me.mic = false; MP.roster(); }
    return;
  }
  try {
    MP.voice.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    if (btn) btn.textContent = TR('mp-mic-on');
    MP.sendMsg({ t: 'mic', id: MP.myId, on: true });
    if (MP.isHost) { const me = MP.players[MP.myId]; if (me) me.mic = true; MP.roster(); }
    MP.voiceSyncAll();
  } catch (e) {
    MP.netStatus('دسترسی به میکروفن داده نشد');
  }
};
MP.voiceSyncAll = function () {
  if (!MP.voice.stream || !MP.peer || !MP.peer.open) return;
  const ids = [];
  if (MP.isHost) { for (const id of MP.order) { const rec = MP.players[id]; if (rec && rec.peerId) ids.push(rec.peerId); } }
  else if (MP.order.length) ids.push('LUMORA-R-' + MP.roomCode);
  for (const pid of ids) MP.voiceConnectTo(pid, pid);
};
MP.voiceConnectTo = function (pid, remotePeerId) {
  if (!MP.voice.stream || !MP.peer || !MP.peer.open || pid === MP.myId) return;
  if (MP.voice.calls[pid]) return;
  try {
    const call = MP.peer.call(remotePeerId, MP.voice.stream);
    if (!call) return;
    MP.voice.calls[pid] = call;
    call.on('stream', (remote) => MP.attachAudio(pid, remote));
    call.on('close', () => { delete MP.voice.calls[pid]; });
    call.on('error', () => { delete MP.voice.calls[pid]; });
  } catch (e) { /* ignore */ }
};
MP.attachAudio = function (pid, stream) {
  if (!MP.voice.audioEls) MP.voice.audioEls = {};
  if (MP.voice.audioEls[pid]) { MP.voice.audioEls[pid].srcObject = stream; return; }
  const a = new Audio();
  a.srcObject = stream;
  a.volume = MP.voice.vol;
  a.autoplay = true;
  MP.voice.audioEls[pid] = a;
  a.play().catch(() => {});
  // speaking detector: RMS level of the remote stream
  try {
    if (!MP._actx) MP._actx = new (window.AudioContext || window.webkitAudioContext)();
    if (!MP.voice.analysers) MP.voice.analysers = {};
    const src2 = MP._actx.createMediaStreamSource(stream);
    const an = MP._actx.createAnalyser();
    an.fftSize = 256; an.smoothingTimeConstant = 0.5;
    src2.connect(an);
    MP.voice.analysers[pid] = an;
    if (!MP.speaking) MP.speaking = {};
  } catch (e) { /* analyser optional */
  }
};
MP.tickVoices = function () {
  if (!MP.voice.analysers || !MP.speaking) return;
  for (const pid in MP.voice.analysers) {
    const an = MP.voice.analysers[pid];
    const buf = MP._voiceBuf || (MP._voiceBuf = new Uint8Array(256));
    an.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i += 2) { const v = (buf[i] - 128) / 128; sum += v * v; }
    MP.speaking[pid] = Math.sqrt(sum / (buf.length / 2)) > 0.09;
  }
};
MP.voiceDropAll = function () {
  for (const k in MP.voice.calls) { try { MP.voice.calls[k].close(); } catch (e) {} }
  MP.voice.calls = {};
  MP.voice.analysers = {};
  MP.speaking = {};
  if (MP.voice.audioEls) { for (const k in MP.voice.audioEls) { try { MP.voice.audioEls[k].srcObject = null; } catch (e) {} } MP.voice.audioEls = {}; }
};
MP.setPTT = function (on) {
  MP.voice.ptt = on;
  MP.applyMicGate();
};
MP.applyMicGate = function () {
  if (!MP.voice.stream) return;
  const live = MP.voice.ptt ? MP.pttDown : true;
  MP.voice.stream.getAudioTracks().forEach(tr => { tr.enabled = !!live; });
};
MP.pttDown = false;

/* ---------- chat ---------- */
MP.addChat = function (name, msg) {
  MP.chat.push({ n: name, m: msg });
  if (MP.chat.length > 60) MP.chat.shift();
  MP.uiChat();
};
MP.sysChat = function (m) { MP.addChat('سامانه', m); };
MP.sendChat = function () {
  const inp = document.getElementById('mp-chat');
  const m = (inp.value || '').trim().slice(0, 120);
  if (!m) return;
  inp.value = '';
  MP.addChat(MP.myName, m);
  MP.broadcast({ t: 'chat', n: MP.myName, m });
  if (!MP.isHost && MP.hostConn && MP.hostConn.open) { try { MP.hostConn.send({ t: 'chat', m }); } catch (e) {} }
};

/* ---------- UI glue ---------- */
MP.netStatus = function (m) { const el = document.getElementById('mp-net-status'); if (el) el.textContent = m || ''; };
MP.uiLobby = function () {
  const ul = document.getElementById('mp-players');
  if (!ul) return;
  ul.innerHTML = MP.order.map(id => {
    const p = MP.players[id];
    if (!p) return '';
    const me = id === MP.myId;
    return '<li><span style="color:' + p.color + '">' + (me ? '★ ' : '') + p.name + '</span>' +
      (p.mic ? '<b class="mp-mic">🎙</b>' : '') + (MP.isHost && me ? ' <small>(میزبان)</small>' : '') + '</li>';
  }).join('');
  const cnt = document.getElementById('mp-count');
  if (cnt) cnt.textContent = MP.order.length + '/6' + (typeof MP.ping === 'number' && MP.ping > 0 ? ' · ' + TR('mp-ping', MP.ping) : '');
  document.getElementById('mp-mode').value = MP.mode;
  document.getElementById('mp-time').value = MP.roundTime;
};
MP.uiChat = function () {
  const el = document.getElementById('mp-chat-log');
  if (!el) return;
  el.innerHTML = MP.chat.slice(-14).map(c => '<div><b style="color:#59f2e0">' + c.n + ':</b> ' + c.m + '</div>').join('');
  el.scrollTop = el.scrollHeight;
};
MP.uiGameHud = function () {
  const hud = document.getElementById('mp-hud');
  if (!hud) return;
  const show = MP.state === 'game';
  hud.style.display = show ? '' : 'none';
  if (!show) return;
  const rows = MP.mode === 'race' ? MP.rankRace(MP.players) : MP.mode === 'dodge' ? MP.rankDodge(MP.players) : MP.rankHunt(MP.players);
  const t = Math.max(0, Math.ceil(MP.left));
  hud.innerHTML =
    '<div class="mp-timer' + (t <= 10 ? ' mp-urgent' : '') + '">' + Math.floor(t / 60) + ':' + ('0' + (t % 60)).slice(-2) + '</div>' +
    '<div class="mp-stand">' + rows.slice(0, 6).map((r, i) =>
      '<div' + (r.id === MP.myId ? ' class="mp-me"' : '') + '><span style="color:' + r.color + '">' + r.name + '</span><b>' +
      (MP.mode === 'race' ? (r.val === null ? '…' : r.val.toFixed(1) + 's') : MP.mode === 'dodge' ? r.val + '✖' : (r.prey ? 'شکار' : 'شکارچی')) + '</b></div>'
    ).join('') + '</div>' +
    (MP.mode === 'hunt' && MP.players[MP.myId] && MP.players[MP.myId].hunter ? '<div class="mp-role mp-hunter">' + (I18N.lang === 'en' ? 'YOU ARE THE HUNTER' : 'شما شکارچی هستید') + '</div>' : '');
};
MP.init = function () {
  const q = id => document.getElementById(id);
  if (!q('scr-mp')) return;
  if (Save.data && Save.data.profile && Save.data.profile.name) MP.myName = Save.data.profile.name;
  q('mp-name').value = MP.myName;
  q('mp-name').addEventListener('change', () => {
    MP.myName = (q('mp-name').value || 'لومورا').slice(0, 12);
    Save.data.profile = Save.data.profile || {};
    Save.data.profile.name = MP.myName;
    Save.saveSoon();
  });
  q('mp-host').addEventListener('click', () => { AudioSys.sfx('uiClick'); MP.host(); });
  q('mp-join').addEventListener('click', () => { AudioSys.sfx('uiClick'); MP.join(q('mp-code').value); });
  q('mp-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') MP.join(q('mp-code').value); });
  q('mp-start').addEventListener('click', () => { AudioSys.sfx('goal'); MP.hostStart(); });
  q('mp-leave').addEventListener('click', () => { AudioSys.sfx('uiClick'); MP.leave(); UI.show('scr-menu'); });
  q('mp-back').addEventListener('click', () => { AudioSys.sfx('uiClick'); UI.show('scr-menu'); });
  q('mpres-lobby').addEventListener('click', () => { if (MP.isHost && MP.order.length) { MP.state = 'lobby'; MP.uiLobby(); UI.show('scr-mp'); } else { MP.setState('lobby'); UI.show('scr-mp'); } });
  q('mpres-exit').addEventListener('click', () => { MP.leave(); UI.show('scr-menu'); });
  q('mp-copy').addEventListener('click', () => {
    try { navigator.clipboard.writeText(MP.roomCode); MP.netStatus('کد کپی شد: ' + MP.roomCode); } catch (e) {}
  });
  q('mp-mode').addEventListener('change', () => { MP.mode = q('mp-mode').value; if (MP.isHost) MP.roster(); });
  for (const v of [60, 120, 180, 300]) {
    const b = q('mp-t' + v);
    if (b) b.addEventListener('click', () => { q('mp-time').value = v; MP.roundTime = v; if (MP.isHost) MP.roster(); });
  }
  q('mp-mic').addEventListener('click', () => { AudioSys.sfx('uiClick'); MP.micToggle(); });
  q('mp-ptt').addEventListener('change', () => MP.setPTT(q('mp-ptt').checked));
  q('mp-vol').addEventListener('input', () => {
    MP.voice.vol = q('mp-vol').value / 100;
    if (MP.voice.audioEls) for (const k in MP.voice.audioEls) MP.voice.audioEls[k].volume = MP.voice.vol;
  });
  q('mp-chat-send').addEventListener('click', () => MP.sendChat());
  q('mp-chat').addEventListener('keydown', (e) => { if (e.key === 'Enter') MP.sendChat(); });
  // push-to-talk
  window.addEventListener('keydown', (e) => { if (e.code === 'KeyC' && MP.state === 'game' && MP.voice.stream) { MP.pttDown = true; MP.applyMicGate(); } });
  window.addEventListener('keyup', (e) => { if (e.code === 'KeyC') { MP.pttDown = false; MP.applyMicGate(); } });
  MP.applyMicGate();
};
/* remote players drawn with the real character renderer + name tag + role aura */
MP.drawGhosts = function (ctx, localP, t) {
  for (const id in MP.ghosts) {
    if (id === MP.myId) continue;
    const g = MP.ghosts[id];
    const rec = MP.players[id];
    if (!rec || !g) continue;
    const sameLayer = g.L === localP.curLayer;
    ctx.save();
    if (!sameLayer) ctx.globalAlpha = 0.14;
    if (g.d) ctx.globalAlpha *= 0.0;
    const gp = {
      x: g.x, y: g.y, w: 30, boxH: 54, face: g.face >= 0 ? 1 : -1, gravSign: 1, curLayer: g.curLayer, cos: rec.cos || null,
      invuln: 0, anim: g.anim, animT: g.animT, squash: 1, stretch: 1, scarf: g.scarf, dblFx: 0, sliding: false,
    };
    if (rec.hunter && MP.mode === 'hunt') ctx.drawImage(Glow.sprite('#ff6b7a', 64), g.x - 2, g.y - 16);
    else if (MP.mode === 'hunt') ctx.drawImage(Glow.sprite('#ffd76a', 50), g.x + 2, g.y - 10);
    drawPlayer(ctx, gp, t);
    if (sameLayer && MP.speaking && MP.speaking[id]) { // voice pulse ring
      ctx.strokeStyle = 'rgba(141,255,158,' + (0.55 + Math.sin(t * 12) * 0.3).toFixed(2) + ')';
      ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(g.x + 15, g.y + 14, 27 + Math.sin(t * 8) * 2.5, 0, TAU); ctx.stroke();
    }
    if (sameLayer && !g.d) {
      ctx.font = 'bold 11px Vazirmatn, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(10,14,28,0.72)';
      const tag = rec.name;
      const tw = ctx.measureText(tag).width + 10;
      ctx.fillRect(g.x + 15 - tw / 2, g.y - 22, tw, 15);
      ctx.fillStyle = rec.color;
      ctx.fillText(tag, g.x + 15, g.y - 11);
    }
    ctx.restore();
  }
};
if (typeof window !== 'undefined') window.MP = MP;

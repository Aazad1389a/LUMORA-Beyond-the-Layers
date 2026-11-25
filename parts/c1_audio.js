/* ============================================================
   LUMORA — c1_audio: procedural music per world + SFX synth
   ============================================================ */
const AudioSys = {
  ctx: null, master: null, musicBus: null, sfxBus: null,
  _seq: null, _track: null, _started: false, _noise: null,

  init() {
    if (AudioSys.ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      AudioSys.ctx = new AC();
      const c = AudioSys.ctx;
      AudioSys.master = c.createGain(); AudioSys.master.gain.value = 0.9; AudioSys.master.connect(c.destination);
      AudioSys.musicBus = c.createGain(); AudioSys.musicBus.connect(AudioSys.master);
      AudioSys.sfxBus = c.createGain(); AudioSys.sfxBus.connect(AudioSys.master);
      AudioSys._echo = c.createDelay(0.6); AudioSys._echo.delayTime.value = 0.28;
      AudioSys._echoFb = c.createGain(); AudioSys._echoFb.gain.value = 0.34;
      AudioSys._echoWet = c.createGain(); AudioSys._echoWet.gain.value = 0.25;
      AudioSys._echo.connect(AudioSys._echoFb); AudioSys._echoFb.connect(AudioSys._echo);
      AudioSys._echo.connect(AudioSys._echoWet); AudioSys._echoWet.connect(AudioSys.master);
      // noise buffer
      const len = c.sampleRate * 1.2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      AudioSys._noise = buf;
      AudioSys.applyVolumes();
      return true;
    } catch (e) { return false; }
  },
  resume() { if (AudioSys.ctx && AudioSys.ctx.state === 'suspended') AudioSys.ctx.resume(); },
  applyVolumes() {
    if (!AudioSys.ctx) return;
    const s = Save.data.settings;
    AudioSys.musicBus.gain.value = s.music * 0.5;
    AudioSys.sfxBus.gain.value = s.sfx * 0.9;
  },
  setVolumes(m, sfx) { Save.data.settings.music = m; Save.data.settings.sfx = sfx; AudioSys.applyVolumes(); },

  /* ---------- low-level voice helpers ---------- */
  _osc(type, freq, t0, dur, vol, bus, dest2, glideTo) {
    const c = AudioSys.ctx; if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(bus);
    if (dest2) g.connect(dest2);
    o.start(t0); o.stop(t0 + dur + 0.05);
  },
  _hit(t0, dur, vol, filterType, freq, bus) {
    const c = AudioSys.ctx; if (!c) return;
    const src = c.createBufferSource(); src.buffer = AudioSys._noise; src.loop = true;
    const f = c.createBiquadFilter(); f.type = filterType; f.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(bus);
    src.start(t0); src.stop(t0 + dur + 0.05);
  },
  _tone(freq, dur, vol, type, when, glide, sendEcho) {
    const c = AudioSys.ctx; if (!c) return;
    const t0 = when !== undefined ? when : c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t0);
    if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(20, glide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(AudioSys.sfxBus);
    if (sendEcho) g.connect(AudioSys._echo);
    o.start(t0); o.stop(t0 + dur + 0.06);
  },
  _noiseHit(dur, vol, filterType, freq, when) {
    const c = AudioSys.ctx; if (!c) return;
    const t0 = when !== undefined ? when : c.currentTime;
    AudioSys._hit(t0, dur, vol, filterType, freq, AudioSys.sfxBus);
  },

  /* ---------- SFX palette ---------- */
  _lastCombo: 0,
  sfx(name, a) {
    if (!AudioSys.ctx) return;
    const c = AudioSys.ctx, t = c.currentTime;
    switch (name) {
      case 'jump': AudioSys._tone(300, 0.16, 0.16, 'sine', t, 620); AudioSys._noiseHit(0.08, 0.05, 'highpass', 3000); break;
      case 'djump':
        AudioSys._tone(520, 0.2, 0.15, 'triangle', t, 940); AudioSys._tone(780, 0.24, 0.1, 'sine', t + 0.03, 1240);
        AudioSys._noiseHit(0.14, 0.05, 'highpass', 4200); break;
      case 'land': AudioSys._noiseHit(0.1, 0.09 + (a || 0) * 0.06, 'lowpass', 700); AudioSys._tone(120, 0.08, 0.08, 'sine', t, 70); break;
      case 'combo': { // pitch rises with the chain — juiciest feedback in the game
        const f = 392 * Math.pow(1.0594631, Math.min(16, (a || 1)));
        AudioSys._tone(f, 0.09, 0.13, 'triangle', t, f * 1.3); AudioSys._tone(f * 2, 0.07, 0.05, 'sine', t + 0.02);
        break; }
      case 'rankS': // little fanfare
        AudioSys._tone(523, 0.16, 0.15, 'triangle', t, 784); AudioSys._tone(784, 0.18, 0.13, 'triangle', t + 0.11, 1046);
        AudioSys._tone(1046, 0.3, 0.11, 'sine', t + 0.23); AudioSys._tone(1568, 0.4, 0.07, 'sine', t + 0.23); break;
      case 'slide': AudioSys._noiseHit(0.3, 0.1, 'bandpass', 1400); break;
      case 'wall': AudioSys._noiseHit(0.07, 0.06, 'bandpass', 2200); break;
      case 'pickup': {
        const now = performance.now(); const combo = (now - AudioSys._lastCombo < 900) ? Math.min(7, AudioSys._comboN = (AudioSys._comboN || 0) + 1) : (AudioSys._comboN = 0);
        AudioSys._lastCombo = now;
        const f = 660 * Math.pow(2, combo / 12);
        AudioSys._tone(f, 0.14, 0.14, 'sine', t, f * 1.5, true); AudioSys._tone(f * 2, 0.1, 0.07, 'triangle', t + 0.02);
        break;
      }
      case 'orb': AudioSys._tone(520, 0.5, 0.16, 'sine', t, 1040, true); AudioSys._tone(780, 0.6, 0.12, 'triangle', t + 0.08, 1560, true); AudioSys._tone(1170, 0.7, 0.08, 'sine', t + 0.16, 2080, true); break;
      case 'energy': AudioSys._tone(440, 0.2, 0.12, 'sine', t, 880); break;
      case 'switch':
        AudioSys._tone(200, 0.3, 0.2, 'sawtooth', t, 900); AudioSys._noiseHit(0.25, 0.12, 'highpass', 1800);
        AudioSys._tone(1400, 0.35, 0.07, 'sine', t + 0.05, 2400, true); break;
      case 'deny': AudioSys._tone(180, 0.12, 0.16, 'square', t, 140); AudioSys._tone(140, 0.14, 0.14, 'square', t + 0.1, 100); break;
      case 'hurt': AudioSys._tone(320, 0.22, 0.22, 'sawtooth', t, 110); AudioSys._noiseHit(0.18, 0.14, 'bandpass', 900); break;
      case 'stomp': AudioSys._tone(200, 0.12, 0.2, 'square', t, 90); AudioSys._noiseHit(0.1, 0.1, 'lowpass', 900); AudioSys._tone(660, 0.12, 0.1, 'sine', t + 0.05, 990); break;
      case 'kill': AudioSys._tone(880, 0.25, 0.12, 'sine', t, 220, true); AudioSys._noiseHit(0.2, 0.12, 'highpass', 1500); break;
      case 'shoot': AudioSys._tone(920, 0.1, 0.08, 'square', t, 480); break;
      case 'checkpoint': AudioSys._tone(523, 0.3, 0.12, 'sine', t, 523, true); AudioSys._tone(784, 0.35, 0.1, 'sine', t + 0.12, 784, true); AudioSys._tone(1046, 0.4, 0.09, 'triangle', t + 0.24, 1046, true); break;
      case 'goal': [523, 659, 784, 1046].forEach((f, i) => AudioSys._tone(f, 0.5, 0.13, 'triangle', t + i * 0.09, undefined, true)); AudioSys._noiseHit(0.5, 0.06, 'highpass', 3000, t + 0.3); break;
      case 'unlock': [392, 523, 659, 880, 1318].forEach((f, i) => AudioSys._tone(f, 0.4, 0.11, 'sine', t + i * 0.07, undefined, true)); break;
      case 'uiHover': AudioSys._tone(740, 0.05, 0.045, 'sine', t); break;
      case 'uiClick': AudioSys._tone(620, 0.09, 0.1, 'triangle', t, 880); AudioSys._noiseHit(0.04, 0.03, 'highpass', 4000); break;
      case 'bossHit': AudioSys._tone(150, 0.25, 0.24, 'sawtooth', t, 60); AudioSys._noiseHit(0.2, 0.15, 'lowpass', 500); AudioSys._tone(980, 0.15, 0.1, 'sine', t + 0.02, 490); break;
      case 'boom': AudioSys._tone(90, 0.7, 0.3, 'sine', t, 35); AudioSys._noiseHit(0.6, 0.22, 'lowpass', 400); break;
      case 'warn': AudioSys._tone(220, 0.3, 0.12, 'square', t, 220); AudioSys._tone(220, 0.3, 0.12, 'square', t + 0.35, 220); break;
    }
  },

  /* ---------- Music engine ---------- */
  TRACKS: {
    menu: { bpm: 62, root: 55, scale: [0, 3, 5, 7, 10], chords: [[0, 2, 4], [3, 0, 2], [4, 1, 3], [2, 4, 1]], pad: 'sine', arp: 'triangle', bass: 'sine', drums: null, density: 0.4, echo: 0.5 },
    w1: { bpm: 96, root: 60, scale: [0, 2, 4, 7, 9], chords: [[0, 2, 4], [1, 3, 0], [4, 2, 1], [3, 1, 4]], pad: 'triangle', arp: 'sine', bass: 'triangle', drums: 'light', density: 0.7, echo: 0.35 },
    w2: { bpm: 84, root: 57, scale: [0, 2, 3, 5, 7, 10], chords: [[0, 2, 4], [5, 1, 3], [3, 5, 1], [4, 0, 2]], pad: 'sawtooth', arp: 'square', bass: 'triangle', drums: 'mid', density: 0.6, echo: 0.4 },
    w3: { bpm: 74, root: 53, scale: [0, 2, 4, 6, 8, 10], chords: [[0, 2, 4], [3, 5, 1], [2, 4, 0], [5, 1, 3]], pad: 'sawtooth', arp: 'sine', bass: 'sine', drums: 'mid', density: 0.55, echo: 0.5 },
    w4: { bpm: 66, root: 49, scale: [0, 2, 3, 7, 8], chords: [[0, 2, 3], [1, 3, 0], [4, 2, 1], [0, 1, 2]], pad: 'sawtooth', arp: 'triangle', bass: 'sine', drums: 'dark', density: 0.45, echo: 0.6 },
    w5: { bpm: 118, root: 55, scale: [0, 2, 4, 5, 7, 9, 11], chords: [[0, 2, 4], [5, 3, 1], [4, 6, 2], [1, 4, 6]], pad: 'sawtooth', arp: 'square', bass: 'sawtooth', drums: 'full', density: 0.85, echo: 0.3 },
    boss: { bpm: 132, root: 50, scale: [0, 1, 4, 6, 7, 10], chords: [[0, 2, 4], [1, 3, 5], [4, 0, 2], [5, 1, 3]], pad: 'sawtooth', arp: 'square', bass: 'sawtooth', drums: 'full', density: 1, echo: 0.25 },
  },
  _step: 0, _nextT: 0, _timer: null, _chordIdx: 0,

  playMusic(name) {
    if (!AudioSys.ctx) { AudioSys._track = name; return; }
    if (AudioSys._track === name && AudioSys._timer) return;
    AudioSys._track = name;
    AudioSys._step = 0; AudioSys._chordIdx = 0;
    AudioSys._nextT = AudioSys.ctx.currentTime + 0.06;
    clearInterval(AudioSys._timer);
    AudioSys._timer = setInterval(AudioSys._schedule, 40);
  },
  stopMusic() { clearInterval(AudioSys._timer); AudioSys._timer = null; AudioSys._track = null; },
  _schedule() {
    const c = AudioSys.ctx; if (!c || !AudioSys._track) return;
    const tr = AudioSys.TRACKS[AudioSys._track]; if (!tr) return;
    const spb = 60 / tr.bpm / 4; // 16th
    while (AudioSys._nextT < c.currentTime + 0.14) {
      AudioSys._playStep(tr, AudioSys._step, AudioSys._nextT, spb);
      AudioSys._step++;
      AudioSys._nextT += spb;
    }
  },
  _playStep(tr, step, t, spb) {
    const c = AudioSys.ctx;
    const s16 = step % 16, bar = Math.floor(step / 16);
    const chord = tr.chords[bar % tr.chords.length];
    if (s16 === 0) AudioSys._chordIdx = (AudioSys._chordIdx + 1) % 64;
    const noteHz = (semi) => 440 * Math.pow(2, (tr.root - 69 + semi) / 12);
    // Pad on bar start
    if (s16 === 0) {
      for (const ci of chord) {
        const f = noteHz(tr.scale[ci % tr.scale.length]);
        AudioSys._pad(f, t, spb * 15, 0.05, tr.pad);
      }
      // bass
      const bf = noteHz(tr.scale[chord[0] % tr.scale.length] - 24);
      AudioSys._osc(tr.bass, bf, t, spb * 6, 0.14, AudioSys.musicBus);
      AudioSys._osc(tr.bass, bf, t + spb * 8, spb * 6, 0.12, AudioSys.musicBus);
    }
    // Arp
    const dens = tr.density;
    if (Math.random() < dens * 0.9) {
      const ci = chord[(step * 3) % chord.length];
      const f = noteHz(tr.scale[ci % tr.scale.length] + 12 * (1 + (step % 5 === 3 ? 1 : 0)));
      AudioSys._osc(tr.arp, f, t, spb * 2.2, 0.055, AudioSys.musicBus, AudioSys._echo);
    }
    // drums
    if (tr.drums) {
      const kick = s16 === 0 || s16 === 8 || (tr.drums === 'full' && s16 === 10);
      if (kick) AudioSys._drum(t, 0.1, 0.22, 'lowpass', 200, 110, 40);
      const hat = tr.drums === 'light' ? (s16 % 4 === 2) : (s16 % 2 === 0);
      if (hat) AudioSys._hit(t, 0.03, tr.drums === 'full' ? 0.05 : 0.028, 'highpass', 7000, AudioSys.musicBus);
      if ((tr.drums === 'mid' || tr.drums === 'full') && s16 === 12) AudioSys._hit(t, 0.14, 0.09, 'bandpass', 1800, AudioSys.musicBus);
      if (tr.drums === 'dark' && s16 === 0 && bar % 2 === 0) AudioSys._drum(t, 0.2, 0.3, 'lowpass', 160, 90, 35);
    }
  },
  _pad(freq, t0, dur, vol, type) {
    const c = AudioSys.ctx; if (!c) return;
    const g = c.createGain(), f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 900;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + dur * 0.3);
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    f.connect(g); g.connect(AudioSys.musicBus); g.connect(AudioSys._echo);
    for (const det of [-4, 3]) {
      const o = c.createOscillator();
      o.type = type; o.frequency.value = freq * Math.pow(2, det / 1200);
      o.connect(f); o.start(t0); o.stop(t0 + dur + 0.1);
    }
  },
  _drum(t, dur, vol, filterType, freq, f0, f1) {
    const c = AudioSys.ctx; if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(AudioSys.musicBus); o.start(t); o.stop(t + dur + 0.05);
    AudioSys._hit(t, dur * 0.6, vol * 0.4, filterType, freq, AudioSys.musicBus);
  },
};

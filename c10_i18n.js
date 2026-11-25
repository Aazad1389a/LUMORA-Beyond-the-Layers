/* ============================================================
   LUMORA — c10_i18n: bilingual UI (فارسی / English)
   data-i18n  → textContent · data-i18n-ph → placeholder
   T(key, ...args) → dynamic strings, {0} {1} placeholders
   ============================================================ */
const I18N = {
  STR: {
    /* menu */
    'btn-continue': ['ادامه بازی', 'CONTINUE'],
    'btn-new': ['بازی جدید', 'NEW GAME'],
    'btn-worlds': ['انتخاب جهان', 'WORLD SELECTION'],
    'btn-multi': ['مولتی‌پلیر آنلاین', 'ONLINE MULTIPLAYER'],
    'btn-infinite': ['مراحل بی‌نهایت', 'INFINITE LEVELS'],
    'btn-settings': ['تنظیمات', 'SETTINGS'],
    'btn-ach': ['دستاوردها', 'ACHIEVEMENTS'],
    'btn-exit': ['خروج', 'EXIT'],
    'menu-keys': ['حرکت ← → · پرش Space · لایه‌ها Q / E یا 1-4 · سُرخوردن S', 'Move ← → · Jump Space · Layers Q / E or 1-4 · Slide S'],
    /* panels */
    'ttl-worlds': ['جهان‌ها', 'WORLDS'],
    'ttl-settings': ['تنظیمات', 'SETTINGS'],
    'ttl-ach': ['دستاوردها', 'ACHIEVEMENTS'],
    'ttl-credits': ['عوامل سازنده', 'CREDITS'],
    'btn-daily': ['چالش روز', 'DAILY RUN'],
    'btn-missions': ['چالش‌ها', 'MISSIONS'],
    'ttl-missions': ['چالش‌های روز', 'DAILY MISSIONS'],
    'st-motion': ['حرکات سینمایی', 'Cinematic Motion'],
    'cs-rank': ['رتبه', 'RANK'],
    'btn-credits': ['عوامل سازنده', 'CREDITS'],
    'ttl-pause': ['توقف', 'PAUSED'],
    'ttl-complete': ['مرحله کامل شد!', 'LEVEL COMPLETE!'],
    'ttl-victory': ['پیروزی!', 'VICTORY!'],
    'ttl-mp': ['مولتی‌پلیر آنلاین — تا ۶ نفر', 'ONLINE MULTIPLAYER — UP TO 6'],
    'ttl-mpres': ['نتیجه‌ی راند', 'ROUND RESULTS'],
    'back': ['بازگشت', 'BACK'],
    /* pause */
    'p-resume': ['ادامه', 'RESUME'],
    'p-restart': ['شروع دوباره مرحله', 'RESTART LEVEL'],
    'p-settings': ['تنظیمات', 'SETTINGS'],
    'p-quit': ['خروج به منو', 'QUIT TO MENU'],
    /* settings */
    'st-audio': ['صدا', 'AUDIO'],
    'st-video': ['نمایش', 'DISPLAY'],
    'st-gameplay': ['گیم‌پلی', 'GAMEPLAY'],
    'st-lang': ['زبان', 'LANGUAGE'],
    'st-net': ['شبکه', 'NETWORK'],
    'st-data': ['داده‌ها', 'DATA'],
    'st-music': ['موسیقی', 'Music'],
    'st-sfx': ['جلوه‌های صوتی', 'Sound FX'],
    'st-shake': ['لرزش دوربین', 'Camera shake'],
    'st-fps': ['نمایش FPS', 'FPS counter'],
    'st-crt': ['فیلتر CRT', 'CRT filter'],
    'st-particles': ['کیفیت ذرات', 'Particle quality'],
    'pq-high': ['بالا', 'High'], 'pq-medium': ['متوسط', 'Medium'], 'pq-low': ['کم', 'Low'],
    'st-touch': ['کنترل لمسی', 'Touch controls'],
    'tc-auto': ['خودکار', 'Auto'], 'tc-on': ['روشن', 'On'], 'tc-off': ['خاموش', 'Off'],
    'st-signal': ['سرور سیگنالینگ دلخواه', 'Custom signaling server'],
    'st-signal-h': ['خالی = سرور پیش‌فرض', 'empty = default server'],
    'st-save': ['پیشرفت بازی به‌صورت خودکار ذخیره می‌شود', 'Progress saves automatically'],
    'st-reset': ['پاک‌کردن پیشرفت', 'Reset progress'],
    /* multiplayer */
    'mp-name-ph': ['نام شما', 'Your name'],
    'mp-host': ['ساخت روم', 'CREATE ROOM'],
    'mp-join': ['پیوستن', 'JOIN'],
    'mp-code-ph': ['کد روم (۴ حرف)', 'room code (4 chars)'],
    'mp-room': ['کد روم:', 'Room code:'],
    'mp-copy': ['کپی', 'Copy'],
    'mp-mode': ['مود بازی:', 'Game mode:'],
    'md-race': ['🏁 مسابقه تا دروازه', '🏁 Race to the gate'],
    'md-dodge': ['⚔️ جاخالی (برخورد = مرگ)', '⚔️ Dodge (touch = death)'],
    'md-hunt': ['🩸 شکارچی و شکار', '🩸 Hunter & prey'],
    'mp-time': ['زمان راند (ثانیه):', 'Round time (sec):'],
    'mp-mic-on': ['🎙 میکروفن روشن (قطع)', '🎙 Mic ON (mute)'],
    'mp-mic-off': ['🎙 فعال‌سازی میکروفن', '🎙 Enable microphone'],
    'mp-ptt': ['Push-to-Talk (کلید C)', 'Push-to-Talk (C key)'],
    'mp-chat-ph': ['پیام در چت…', 'Type a message…'],
    'mp-send': ['ارسال', 'Send'],
    'mp-start': ['شروع بازی', 'START GAME'],
    'mp-leave': ['ترک روم', 'LEAVE ROOM'],
    'mpres-lobby': ['بازگشت به لابی', 'BACK TO LOBBY'],
    'mpres-exit': ['منوی اصلی', 'MAIN MENU'],
    /* dynamic */
    'sys-created': ['روم ساخته شد. کد: {0}', 'Room created. Code: {0}'],
    'sys-joined': ['{0} به روم پیوست', '{0} joined the room'],
    'sys-left': ['{0} روم را ترک کرد', '{0} left the room'],
    'sys-started': ['بازی شروع شد — مود: {0} — زمان: {1}s', 'Game started — mode: {0} — time: {1}s'],
    'mode-race': ['مسابقه', 'Race'], 'mode-dodge': ['جاخالی', 'Dodge'], 'mode-hunt': ['شکارچی', 'Hunter'],
    'sys-finish': ['🏁 {0} دروازه را در {1} رد کرد!', '🏁 {0} passed the gate in {1}!'],
    'sys-hunted': ['🩸 {0} شکار شد و شکارچی شد!', '🩸 {0} was caught and became a hunter!'],
    'toast-race': ['مسابقه!', 'RACE!'],
    'toast-race-d': ['اولین نفری باش که به دروازه می‌رسد', 'Be the first to reach the gate'],
    'toast-dodge': ['جاخالی!', 'DODGE!'],
    'toast-dodge-d': ['برخورد با هر پلیر دیگری = مرگ هر دو. کمترین مرگ برنده است', 'Touching any player kills both. Fewest deaths wins'],
    'toast-hunt': ['شکارچی در میان شماست!', 'A hunter is among you!'],
    'toast-hunt-d': ['فرار کن تا پایان زمان', 'Stay away until the timer ends'],
    'toast-hunter-you': ['شما شکارچی هستید!', 'YOU ARE THE HUNTER!'],
    'toast-hunter-you-d': ['همه را بگیر', 'Catch them all'],
    'toast-finish': ['پایان!', 'FINISH!'],
    'toast-your-time': ['زمان شما: {0}', 'Your time: {0}'],
    'inf-name': ['بی‌نهایت {0}', 'Infinite {0}'],
    'inf-intro': ['مرحله‌ی تولیدشده‌ی شماره {0} — سختی {1}/10', 'Generated level {0} — difficulty {1}/10'],
    'mp-win': ['برنده', 'WINNER'],
    'mp-unranked': ['ناکام', 'DNF'],
    'mp-deaths': ['{0} مرگ', '{0} deaths'],
    'mp-survivor': ['بازمانده', 'Survivor'],
    'mp-hunted-at': ['شکارچی از {0}s', 'hunted at {0}s'],
    'mp-ping': ['پینگ: {0}ms', 'ping: {0}ms'],
    'cs-time': ['زمان', 'Time'], 'cs-best': ['بهترین رکورد', 'Best'],
    'cs-crystals': ['کریستال‌ها', 'Crystals'], 'cs-orb': ['گوی لومارا', 'Lumara orb'],
    'cs-orb-found': ['✧ پیدا شد', '✧ found'], 'cs-orb-hidden': ['✧ پنهان مانده', '✧ hidden'],
    'cs-status': ['وضعیت', 'Status'], 'cs-tip': ['نکته', 'Tip'],
    'cs-new': ['مرحله جدید آشکار شد', 'New level unlocked'],
    'cs-perfect': ['بدون آسیب! عالی بود', 'No damage! Perfect'],
    'cs-try-perfect': ['بدون‌آسیب را امتحان کن', 'Try a no-damage run'],
    'st-keys': ['کنترل‌ها', 'CONTROLS'],
    'bind-reset': ['بازنشانی دکمه‌ها', 'Reset keys'],
    'bind-press': ['یک کلید بزن…', 'press a key…'],
    'act-left': ['حرکت چپ', 'Move left'], 'act-right': ['حرکت راست', 'Move right'],
    'act-jump': ['پرش', 'Jump'], 'act-slide': ['سُرخوردن', 'Slide'],
    'act-prev': ['لایه قبلی', 'Prev layer'], 'act-next': ['لایه بعدی', 'Next layer'],
    'act-pause': ['توقف', 'Pause'],
    'act-l1': ['لایه ۱ (مادی)', 'Layer 1 (Materia)'], 'act-l2': ['لایه ۲ (انرژی)', 'Layer 2 (Energy)'],
    'act-l3': ['لایه ۳ (وارونه)', 'Layer 3 (Inverse)'], 'act-l4': ['لایه ۴ (سایه)', 'Layer 4 (Shadow)'],
    'ttl-shop': ['فروشگاه', 'SHOP'],
    'btn-shop': ['فروشگاه', 'SHOP'],
    'shop-t': ['فروشگاه', 'Shop'],
    'shop-bought': ['خریده شد', 'Purchased'],
    'shop-poor': ['سکه کافی نداری', 'Not enough coins'],
    'shop-buy': ['خرید', 'Buy'],
    'shop-wear': ['پوشیدن', 'Wear'],
    'shop-on': ['پوشیده ✓', 'Worn ✓'],
    'cs-coins': ['سکه‌ها', 'Coins'],
    'c-next': ['مرحله بعدی', 'NEXT LEVEL'], 'c-replay': ['تکرار مرحله', 'REPLAY'], 'c-menu': ['منو', 'MENU'],
    'v-time': ['زمان نهایی', 'Final time'], 'v-switches': ['سفرهای لایه‌ای', 'Layer travels'],
    'v-ach': ['دستاوردها', 'Achievements'],
    /* reset confirm */
    'cf-yes': ['بله', 'YES'], 'cf-no': ['خیر', 'NO'],
    'cf-reset-t': ['پاک‌کردن پیشرفت', 'Reset progress'],
    'cf-reset-d': ['همه مراحل، کریستال‌ها و دستاوردها پاک می‌شوند. مطمئنی؟', 'All levels, crystals and achievements are wiped. Sure?'],
    'cf-reset-ok': ['پیشرفت پاک شد', 'Progress wiped'],
    'crystals-lbl': ['کریستال', 'CRYSTALS'],
    'ach-lbl': ['دستاورد', 'ACHIEVEMENTS'],
    'yes': ['بله، پاک کن', 'Yes, wipe'],
    'no': ['نه', 'No'],
  },
  lang: 'fa',
  T(key, ...a) {
    const rec = I18N.STR[key];
    let s = rec ? rec[I18N.lang === 'en' ? 1 : 0] : key;
    for (let i = 0; i < a.length; i++) s = s.replace('{' + i + '}', a[i]);
    return s;
  },
  apply() {
    document.body.dataset.lang = I18N.lang;
    document.documentElement.lang = I18N.lang === 'en' ? 'en' : 'fa';
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const rec = I18N.STR[el.dataset.i18n];
      if (rec) el.textContent = rec[I18N.lang === 'en' ? 1 : 0];
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
      const rec = I18N.STR[el.dataset.i18nPh];
      if (rec) el.placeholder = rec[I18N.lang === 'en' ? 1 : 0];
    });
  },
  setLang(l) {
    I18N.lang = l === 'en' ? 'en' : 'fa';
    Save.data.settings.lang = I18N.lang;
    Save.saveSoon();
    I18N.apply();
    if (typeof UI !== 'undefined') { UI.refreshMenuStats(); UI.buildAch && UI.buildAch(); if (document.getElementById('scr-worlds').classList.contains('active')) UI.buildWorlds(); }
    if (typeof MP !== 'undefined') MP.uiLobby && MP.uiLobby();
    AudioSys.sfx('uiClick');
  },
};
function TR(key, ...a) { return I18N.T(key, ...a); } // TR = translate (T is the tile-size constant)
if (typeof window !== 'undefined') { window.I18N = I18N; window.TR = TR; }

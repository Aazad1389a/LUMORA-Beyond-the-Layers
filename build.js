#!/usr/bin/env node
/* LUMORA build script: concatenates modular parts into a single self-contained HTML file. */
const fs = require('fs');
const path = require('path');

const PARTS_DIR = path.join(__dirname, 'parts');
/* LUMORA_OUT lets CI redirect the output dir without touching the default local path. */
const OUT_DIR = process.env.LUMORA_OUT || path.join('/home/z/my-project/download');

const JS_ORDER = [
  '_peerjs_lib.js',
  'c0_core.js',
  'c10_i18n.js',
  'c11_nexora.js',
  'c12_shop.js',
  'c1_audio.js',
  'c2_levels_a.js',
  'c2_levels_b.js',
  'c2_levels_c.js',
  'c3_engine.js',
  'c4_player.js',
  'c4_enemies.js',
  'c5_render.js',
  'c5_draw.js',
  'c6_ui.js',
  'c7_main.js',
  'c9_infinite.js',
  'c8_multi.js',
  'c13_juice.js',
];

function read(f) { return fs.readFileSync(path.join(PARTS_DIR, f), 'utf8'); }

function buildBrowser() {
  const shell = read('shell.html');
  const css = read('style.css');
  let html = shell.replace('/*__CSS__*/', css);
  /* PeerJS goes into its OWN script tag: if an old browser cannot parse it,
     the single-player game still boots — MP just falls back to CDN. */
  html = html.replace('/*__PEERJS__*/', read('_peerjs_lib.js'));
  const js = JS_ORDER.filter(f => f !== '_peerjs_lib.js')
    .map(f => `/* ===== ${f} ===== */\n` + read(f)).join('\n');
  const wrapped = `(()=>{\n'use strict';\n${js}\n})();`;
  html = html.replace('/*__JS__*/', wrapped);
  return html;
}

function buildTest() {
  const js = JS_ORDER.map(f => read(f)).join('\n');
  return `module.exports=(function(){\n'use strict';\n${js}\nreturn (typeof API!=='undefined')?API:null;\n})();`;
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const mode = process.argv[2] || 'browser';
  if (mode === 'test') {
    const out = path.join(__dirname, '.test_bundle.cjs');
    fs.writeFileSync(out, buildTest());
    console.log('test bundle ->', out);
    return;
  }
  const html = buildBrowser();
  const out = path.join(OUT_DIR, 'LUMORA_Beyond_the_Layers.html');
  fs.writeFileSync(out, html);
  console.log('built ->', out, (html.length / 1024).toFixed(1) + ' KB');
}

main();

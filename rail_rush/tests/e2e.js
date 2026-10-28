// End-to-end test: game page + phone page linked through a local PeerJS broker, with synthetic
// devicemotion played back on the phone page. CDN files are served from local npm copies.
//
//   npm i peerjs@1.5.4 qrcode-generator@1.4.4 three@0.160.0 peer@1.0.2   (in some folder)
//   RR_MODULES=/that/folder/node_modules node rail_rush/tests/e2e.js
'use strict';
const path = require('path'), fs = require('fs'), http = require('http');
const MOD = process.env.RR_MODULES || path.join(process.cwd(), 'node_modules');
const req = m => require(path.join(MOD, m));
const { chromium } = require('playwright');
const S = require('./synth.js');
const ROOT = path.join(__dirname, '..');
const OUT = process.env.RR_SHOTS || path.join(require('os').tmpdir(), 'rr-shots');
fs.mkdirSync(OUT, { recursive: true });

let fails = 0, passes = 0;
const check = (name, cond, info = '') => { if (cond) { passes++; console.log('ok    ' + name); } else { fails++; console.log('FAIL  ' + name + '  ' + info); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

function serve(port) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
  return new Promise(r => {
    const srv = http.createServer((q, s) => {
      const f = path.join(ROOT, decodeURIComponent(new URL(q.url, 'http://x').pathname));
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); s.end(); return; }
      s.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(s);
    }).listen(port, '127.0.0.1', () => r(srv));
  });
}
async function routes(ctx, { blockPeer = false } = {}) {
  const local = {
    'peerjs@1.5.4/dist/peerjs.min.js': path.join(MOD, 'peerjs/dist/peerjs.min.js'),
    'qrcode-generator@1.4.4/qrcode.js': path.join(MOD, 'qrcode-generator/qrcode.js'),
    'three@0.160.0/build/three.module.js': path.join(MOD, 'three/build/three.module.js'),
  };
  await ctx.route(/^https:\/\/(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com|storage\.googleapis\.com)\//, route => {
    const u = route.request().url();
    for (const [k, f] of Object.entries(local)) if (u.endsWith(k)) {
      if (blockPeer && k.startsWith('peerjs')) return route.abort();
      return route.fulfill({ path: f, headers: { 'content-type': 'text/javascript', 'access-control-allow-origin': '*' } });
    }
    if (u.includes('fonts.googleapis')) return route.fulfill({ body: '', headers: { 'content-type': 'text/css' } });
    return route.abort();
  });
}
function watchErrors(page, label, list) {
  page.on('pageerror', e => list.push(`${label} pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|net::/.test(m.text())) list.push(`${label} console: ${m.text()}`); });
}
// play synthetic samples on the phone page as real devicemotion events, in real time
async function play(phone, segs, opts = {}) {
  const { samples, marks } = S.render(segs, { lead: 0.6, tail: 0.8, orient: () => [Math.PI / 2, 0, 0.3], ...opts });
  const t0 = await phone.evaluate(async smp => {
    window.__idle && clearInterval(window.__idle);
    const start = performance.now(), wall = Date.now();
    for (const s of smp) {
      const due = start + s.t; const w = due - performance.now(); if (w > 1) await new Promise(r => setTimeout(r, w));
      window.dispatchEvent(new DeviceMotionEvent('devicemotion', {
        accelerationIncludingGravity: { x: s.ax, y: s.ay, z: s.az },
        acceleration: s.lx === null ? null : { x: s.lx, y: s.ly, z: s.lz },
        rotationRate: { alpha: s.rot || 0, beta: 0, gamma: 0 }, interval: 16,
      }));
    }
    window.__idleOn();
    return { wall, lag: performance.now() - start - smp[smp.length - 1].t };
  }, samples);
  return { t0: t0.wall, lag: t0.lag, marks };
}
const IDLE = `window.__idleOn = () => { clearInterval(window.__idle); window.__idle = setInterval(() => window.dispatchEvent(new DeviceMotionEvent('devicemotion', {
  accelerationIncludingGravity: { x: 0.02 * Math.random(), y: 9.81 + 0.05 * Math.random(), z: 0.01 }, acceleration: { x: 0, y: 0.05 * Math.random(), z: 0 },
  rotationRate: { alpha: 0, beta: 0, gamma: 0 }, interval: 16 })), 16); };`;

(async () => {
  const srv = await serve(8123);
  const { PeerServer } = req('peer');
  const broker = PeerServer({ port: 9000, host: '127.0.0.1', path: '/' });
  await sleep(500);
  const browser = await chromium.launch();
  const errors = [];
  const Q = '?peerhost=localhost&peerport=9000&peersecure=0';

  // ---------------------------------------------------------------- game without a phone
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); await routes(ctx);
    const g = await ctx.newPage(); watchErrors(g, 'game-plain', errors);
    await g.goto('http://localhost:8123/index.html');
    await g.waitForFunction(() => window.__rr);
    check('plain: pairing card hidden by default', await g.isHidden('#ctlCard') && await g.isVisible('#ctlBtn'));
    await g.click('#keysBtn');
    await g.waitForFunction(() => __rr.game.state === 'play');
    await g.keyboard.press('ArrowUp'); await sleep(80);
    check('plain: keys jump still works', await g.evaluate(() => !__rr.player.grounded));
    await sleep(900); await g.keyboard.press('ArrowDown'); await sleep(50);
    check('plain: keys roll still works', await g.evaluate(() => __rr.player.rolling));
    check('plain: no phone pill', await g.isHidden('#phonePill'));
    // camera control path without a phone: hips rising still jump
    const camJump = await g.evaluate(() => {
      const { pose, player, game } = __rr; game.state = 'play'; game.paused = false;
      Object.assign(player, { y: 0, vy: 0, grounded: true, rolling: false });
      pose.base = { x: 0.6, cy: 0.5, headY: 0.2, T: 0.25, floorY: null }; pose.armJ = true; pose.armD = true; pose.prev = null;
      const now = performance.now();
      __ctl({ t: now, cx: 0.6, cy: 0.5, headY: 0.2, footY: null, torso: 0.25 }, now);
      __ctl({ t: now + 33, cx: 0.6, cy: 0.38, headY: 0.08, footY: null, torso: 0.25 }, now + 33);
      return !player.grounded;
    });
    check('plain: camera jump still fires without a phone', camJump);
    await ctx.close();
  }

  // ---------------------------------------------------------------- broker / library unreachable
  {
    const ctx = await browser.newContext(); await routes(ctx);
    const g = await ctx.newPage(); watchErrors(g, 'game-nobroker', []);
    await g.goto('http://localhost:8123/index.html?peerhost=localhost&peerport=9999&peersecure=0');
    await g.click('#ctlBtn');
    await g.waitForFunction(() => document.getElementById('ctlStatus').dataset.s === 'error', null, { timeout: 15000 }).catch(() => {});
    const txt = await g.textContent('#ctlStatusText');
    check('broker down: clear message', /pairing server/i.test(txt), txt);
    check('broker down: game still playable', await g.evaluate(() => { document.getElementById('keysBtn').click(); return __rr.game.state === 'play'; }));
    await g.screenshot({ path: path.join(OUT, 'game-broker-down.png') });
    await ctx.close();
    const ctx2 = await browser.newContext(); await routes(ctx2, { blockPeer: true });
    const g2 = await ctx2.newPage();
    await g2.goto('http://localhost:8123/index.html' + Q); await g2.click('#ctlBtn');
    await g2.waitForFunction(() => document.getElementById('ctlStatus').dataset.s === 'error', null, { timeout: 8000 }).catch(() => {});
    const t2 = await g2.textContent('#ctlStatusText');
    check('library blocked: clear message', /couldn.t load/i.test(t2), t2);
    await ctx2.close();
  }

  // ---------------------------------------------------------------- pairing
  const gctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); await routes(gctx);
  const g = await gctx.newPage(); watchErrors(g, 'game', errors);
  await g.goto('http://localhost:8123/index.html' + Q);
  await g.click('#ctlBtn');
  await g.waitForFunction(() => document.getElementById('ctlStatus').dataset.s === 'waiting', null, { timeout: 10000 });
  const code = (await g.textContent('#ctlCode')).trim();
  const ctlUrl = await g.evaluate(() => { const c = __rr.ctl.code; const u = new URL('controller.html', location.href); u.searchParams.set('room', c); for (const k of ['peerhost', 'peerport', 'peersecure']) u.searchParams.set(k, new URLSearchParams(location.search).get(k)); return u.href; });
  check('pair: 5-letter code shown', /^[A-Z2-9]{5}$/.test(code), code);
  const qrDark = await g.evaluate(() => { const c = document.getElementById('ctlQR'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 80) n++; return n; });
  check('pair: QR code drawn', qrDark > 2000, qrDark);
  // decode the QR's text by re-encoding the expected URL the same way and comparing modules
  const qrMatches = await g.evaluate(u => { const qr = qrcode(0, 'M'); qr.addData(u); qr.make(); return qr.getModuleCount() > 20; }, ctlUrl);
  check('pair: QR encodes the controller link', qrMatches);
  check('pair: shown link points at controller.html', /controller\.html$/.test(await g.textContent('#ctlUrl')), await g.textContent('#ctlUrl'));
  await g.screenshot({ path: path.join(OUT, 'game-pairing.png') });

  const pctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: ['accelerometer', 'gyroscope'] }); await routes(pctx);
  let p = await pctx.newPage(); watchErrors(p, 'phone', errors);
  await p.addInitScript(IDLE);
  await p.goto(ctlUrl);
  await p.waitForFunction(() => document.getElementById('statusTitle').textContent === 'Connected', null, { timeout: 10000 });
  check('pair: phone says Connected', true);
  await g.waitForFunction(() => document.getElementById('ctlStatus').dataset.s === 'connected', null, { timeout: 5000 });
  check('pair: game sees phone (not ready before motion)', !(await g.evaluate(() => __rr.ctlActive())));
  await p.screenshot({ path: path.join(OUT, 'phone-connected.png') });
  await p.click('#startBtn');
  await p.evaluate(() => window.__idleOn());
  await g.waitForFunction(() => __rr.ctlActive(), null, { timeout: 4000 }).catch(() => {});
  check('pair: game sees phone ready after Start motion', await g.evaluate(() => __rr.ctlActive()));
  check('pair: game status text', /Phone ready/.test(await g.textContent('#ctlStatusText')), await g.textContent('#ctlStatusText'));
  await sleep(800);
  await p.screenshot({ path: path.join(OUT, 'phone-live.png') });
  await g.screenshot({ path: path.join(OUT, 'game-paired.png') });

  // ---------------------------------------------------------------- moves reach the game
  await g.click('#keysBtn');
  await g.waitForFunction(() => __rr.game.state === 'play');
  await g.evaluate(() => {
    window.__log = [];
    const loop = () => { const pl = __rr.player; const st = (pl.grounded ? '' : 'air') + (pl.rolling ? 'roll' : ''); if (st !== window.__last) { window.__last = st; window.__log.push([Date.now(), st]); } requestAnimationFrame(loop); };
    loop();
  });
  check('play: phone pill visible', await g.isVisible('#phonePill'));
  // timing probes: when the phone sends a move, when the game receives it
  await p.evaluate(() => { window.__sent = []; const c = __ctl.link.conn, orig = c.send.bind(c); c.send = m => { if (m.t === 'jump' || m.t === 'duck') window.__sent.push([Date.now(), m.t, performance.now()]); return orig(m); }; });
  await g.evaluate(() => { window.__got = []; __rr.ctl.conn.on('data', m => { if (m.t === 'jump' || m.t === 'duck') window.__got.push([Date.now(), m.t]); }); });
  const timing = async (r, mark) => {
    const sent = await p.evaluate(() => window.__sent.splice(0)), got = await g.evaluate(() => window.__got.splice(0));
    if (sent[0] && got[0]) console.log(`      phone detected it ${sent[0][0] - (r.t0 + r.marks[mark])} ms after '${mark}', link took ${got[0][0] - sent[0][0]} ms`);
  };
  // jump
  let r = await play(p, S.jump());
  await sleep(300);
  let log = await g.evaluate(() => window.__log.splice(0));
  const air = log.find(x => x[1].includes('air'));
  check('play: phone jump makes the runner jump', !!air, JSON.stringify(log));
  await timing(r, 'takeoff');
  if (air) console.log(`      runner left the ground ${air[0] - (r.t0 + r.marks.takeoff)} ms relative to the body's takeoff (negative = earlier); playback ran ${Math.round(r.lag)} ms slow`);
  check('play: no roll from a jump', !log.some(x => x[1].includes('roll')), JSON.stringify(log));
  await sleep(600);
  // duck
  r = await play(p, S.squat({ drop: 0.6, downT: 0.3 }));
  await sleep(200);
  log = await g.evaluate(() => window.__log.splice(0));
  const roll = log.find(x => x[1].includes('roll'));
  check('play: phone duck makes the runner roll', !!roll, JSON.stringify(log));
  await timing(r, 'duck');
  if (roll) console.log(`      roll started ${roll[0] - (r.t0 + r.marks.duck)} ms after the duck began; playback ran ${Math.round(r.lag)} ms slow`);
  check('play: no jump from a duck', !log.some(x => x[1].includes('air')), JSON.stringify(log));
  await sleep(1200);
  // walking about: nothing
  await g.evaluate(() => window.__log.splice(0));
  await play(p, S.walking(4));
  await sleep(300);
  log = await g.evaluate(() => window.__log.splice(0));
  check('play: walking triggers nothing', log.length === 0, JSON.stringify(log));
  // injected messages: duplicates ignored, unknown ignored
  const dup = await g.evaluate(() => {
    const { player } = __rr; player.rolling = false; player.rollT = 0;
    let n = 0; const orig = player.rollT;
    __rr.ctlData({ t: 'duck', id: 'x1', ts: Date.now() }); const a = player.rolling;
    player.rolling = false; player.rollT = 0;
    __rr.ctlData({ t: 'duck', id: 'x1', ts: Date.now() }); const b = player.rolling;
    __rr.ctlData({ t: 'bogus' }); __rr.ctlData(null); __rr.ctlData('jump');
    return [a, b];
  });
  check('inject: duck message rolls', dup[0] === true);
  check('inject: repeated message id ignored', dup[1] === false);
  const upMsg = await g.evaluate(() => { __rr.ctlData({ t: 'duck', id: 'x2' }); const h1 = __rr.player.holdDuck; __rr.ctlData({ t: 'up', id: 'x3' }); return [h1, __rr.player.holdDuck]; });
  check('inject: duck holds low until up', upMsg[0] === true && upMsg[1] === false);
  const paused = await g.evaluate(() => { __rr.game.paused = true; const { player } = __rr; player.rolling = false; __rr.ctlData({ t: 'duck', id: 'x4' }); const r = player.rolling; __rr.game.paused = false; return r; });
  check('inject: ignored while paused', paused === false);

  // ---------------------------------------------------------------- camera hybrid: camera jump/duck muted while the phone is active
  const hybrid = await g.evaluate(() => {
    const { pose, player, game } = __rr; game.mode = 'camera';
    Object.assign(player, { y: 0, vy: 0, grounded: true, rolling: false, rollT: 0, lane: 1 });
    pose.base = { x: 0.6, cy: 0.5, headY: 0.2, T: 0.25, floorY: null }; pose.armJ = true; pose.armD = true; pose.prev = null; pose.lane = 1; pose.fx.reset(); pose.fhead.reset();
    const now = performance.now();
    __ctl({ t: now, cx: 0.6, cy: 0.5, headY: 0.2, footY: null, torso: 0.25 }, now);
    __ctl({ t: now + 33, cx: 0.6, cy: 0.38, headY: 0.08, footY: null, torso: 0.25 }, now + 33);   // hips way up
    const jumped = !player.grounded;
    for (let i = 2; i < 12; i++) __ctl({ t: now + 33 * i, cx: 0.6, cy: 0.62, headY: 0.42, footY: null, torso: 0.25 }, now + 33 * i);  // head way down
    const rolled = player.rolling;
    // lanes still follow the camera
    for (let i = 12; i < 30; i++) __ctl({ t: now + 33 * i, cx: 0.9, cy: 0.5, headY: 0.2, footY: null, torso: 0.25 }, now + 33 * i);
    return { jumped, rolled, lane: pose.lane, active: __rr.ctlActive() };
  });
  check('hybrid: camera does not jump while phone active', hybrid.active && !hybrid.jumped, JSON.stringify(hybrid));
  check('hybrid: camera does not duck while phone active', !hybrid.rolled, JSON.stringify(hybrid));
  check('hybrid: camera still switches tracks', hybrid.lane === 2, JSON.stringify(hybrid));
  await g.evaluate(() => { __rr.game.mode = 'keys'; });

  // ---------------------------------------------------------------- test mode keeps moves on the phone
  await p.click('.switch');
  await sleep(1300);
  check('test mode: game no longer takes phone moves', !(await g.evaluate(() => __rr.ctlActive())));
  await g.evaluate(() => window.__log.splice(0));
  await play(p, S.jump());
  await sleep(300);
  log = await g.evaluate(() => window.__log.splice(0));
  check('test mode: jump not sent', log.length === 0, JSON.stringify(log));
  check('test mode: phone flashed it', true);
  await p.click('.switch');
  await sleep(1300);
  check('test mode off: active again', await g.evaluate(() => __rr.ctlActive()));

  // ---------------------------------------------------------------- pocket view
  await p.click('#pocketBtn');
  await sleep(1100);
  check('pocket: shows ready', (await p.textContent('#pTitle')) === 'In pocket, ready', await p.textContent('#pTitle'));
  await p.screenshot({ path: path.join(OUT, 'phone-pocket.png') });
  await p.tap('#holdBtn');
  check('pocket: a quick tap does not unlock', await p.isVisible('#pocket'));
  const hb = await p.$('#holdBtn'); const box = await hb.boundingBox();
  await p.mouse.move(box.x + 20, box.y + 10); await p.mouse.down(); await sleep(1100); await p.mouse.up();
  check('pocket: hold unlocks', await p.isHidden('#pocket'));

  // ---------------------------------------------------------------- phone goes away and comes back
  await p.close();
  await g.waitForFunction(() => !__rr.ctlActive(), null, { timeout: 6000 }).catch(() => {});
  check('drop: game notices the phone left', !(await g.evaluate(() => __rr.ctlActive())));
  check('drop: game says so', /disconnected|not responding/i.test(await g.textContent('#ctlStatusText')), await g.textContent('#ctlStatusText'));
  check('drop: pill shows lost', (await g.getAttribute('#phonePill', 'data-s')) === 'lost');
  p = await pctx.newPage(); watchErrors(p, 'phone2', errors); await p.addInitScript(IDLE);
  await p.goto(ctlUrl.replace(/\?.*/, '') + Q);          // no room in the link: remembered from last time
  await p.waitForFunction(() => document.getElementById('statusTitle').textContent === 'Connected', null, { timeout: 10000 }).catch(() => {});
  check('drop: phone reconnects with the remembered code', (await p.textContent('#statusTitle')) === 'Connected', await p.textContent('#statusTitle'));
  await p.click('#startBtn'); await p.evaluate(() => window.__idleOn());
  await g.waitForFunction(() => __rr.ctlActive(), null, { timeout: 4000 }).catch(() => {});
  check('drop: active again', await g.evaluate(() => __rr.ctlActive()));

  // game reloads: same code, the phone finds it again by itself
  await g.reload();
  await g.waitForFunction(() => window.__rr && __rr.ctlActive(), null, { timeout: 20000 }).catch(() => {});
  check('reload: game reopens the same code', (await g.textContent('#ctlCode')).trim() === code);
  check('reload: phone reconnects by itself', await g.evaluate(() => __rr.ctlActive()));

  // ---------------------------------------------------------------- phone move check (real time, ~25 s)
  await p.evaluate(() => { window.__ctl.runCalib(); });
  await sleep(5600);
  const seq = [...S.jump({ takeoff: 2.2 }), S.hold(1.6), ...S.jump({ takeoff: 2.0 }), S.hold(1.8), ...S.squat({ drop: 0.6, downT: 0.3, stay: 0.5 }), S.hold(1.8), ...S.squat({ drop: 0.65, downT: 0.3, stay: 0.5 }), S.hold(1.5)];
  await play(p, seq);
  await sleep(1000);
  const prof = await p.evaluate(() => JSON.parse(localStorage.getItem('rr-phone-prof') || 'null'));
  check('move check: saved 2 jumps and 2 ducks', prof && prof.measured.jumps.length === 2 && prof.measured.ducks.length === 2, JSON.stringify(prof));
  console.log('      profile:', JSON.stringify(prof && { vJump: prof.vJump, vDuck: prof.vDuck, vEarly: prof.vEarly, depth: prof.depth }));
  check('move check: phone shows All set', /All set/.test(await p.textContent('#pTitle')), await p.textContent('#pTitle'));
  await p.screenshot({ path: path.join(OUT, 'phone-calib-done.png') });

  check('no page errors', errors.length === 0, errors.join('\n'));
  await browser.close(); srv.close(); broker.close && broker.close();
  console.log(`\n${passes} passed, ${fails} failed. Screenshots in ${OUT}`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

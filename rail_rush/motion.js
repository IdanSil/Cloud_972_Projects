/* Rail Rush pocket controller: jump / duck detection from phone motion.
 *
 * Works however the phone sits in the pocket:
 *   1. Find "down": gravity comes from the phone's own sensor fusion when it reports
 *      `acceleration` (gravity removed), otherwise from a low-pass filter on
 *      `accelerationIncludingGravity` that only learns while the phone is not being shaken.
 *   2. Vertical acceleration = acceleration projected onto the gravity axis (m/s², + is up).
 *   3. Vertical speed = leaky integral of that, reset whenever the body is still.
 *
 *   Jump: fires during push-off, as soon as upward speed passes the jump line while still
 *         pushing up (before the feet leave the floor). Free-fall (the phone feels weightless)
 *         is the backup trigger and confirms the jump.
 *   Duck: downward speed passes the duck line, then the body stops low without bouncing
 *         straight back up (a jump's dip turns around at once, so it never fires a duck).
 *         A very fast drop fires straight away. Landing from a jump is ignored.
 *
 * Plain script: sets window.RRMotion in the browser, module.exports in Node (tests).
 */
(function (root) {
  'use strict';
  const G0 = 9.81;
  const SENS = [0.7, 0.85, 1, 1.2, 1.45];
  const DEFAULT_PROF = { vJump: 1.0, vDuck: 0.45, vEarly: 1.5, depth: 0.3 };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ok = v => typeof v === 'number' && isFinite(v);

  // Turn a DeviceMotionEvent into a plain sample. t in ms.
  function fromEvent(e, t) {
    const g = e.accelerationIncludingGravity || {}, a = e.acceleration || {}, r = e.rotationRate || {};
    return {
      t, ax: g.x, ay: g.y, az: g.z,
      lx: a.x, ly: a.y, lz: a.z,
      rot: ok(r.alpha) ? Math.hypot(r.alpha, r.beta || 0, r.gamma || 0) : null,
    };
  }

  function createDetector(opts = {}) {
    const d = {
      prof: { ...DEFAULT_PROF, ...(opts.prof || {}) },
      sens: opts.sens || 1,
      // signal state
      t: null, g: null, G: G0, n: 0, fused: false,
      av: 0, avRaw: 0, v: 0, mag: G0, quietT: 0,
      ffT: 0, vHist: [], pushT: 0, sink: 0, z: 0, zHist: [],
      fallOnly: !!opts.fallOnly,  // move check: only count jumps that leave the floor
      // decision state
      mode: 'ready',            // ready | air | low
      modeT: 0, sawFall: false, landT: 0,
      down: null,               // descent being watched for a duck
      lastDuckT: -1e9,
    };

    d.thresholds = () => {
      const p = d.prof, s = d.sens;
      return {
        vJump: clamp(p.vJump, 0.6, 1.8) / s,
        vDuck: clamp(p.vDuck, 0.3, 1.0) / s,
        vEarly: clamp(p.vEarly, 1.0, 3.0) / Math.sqrt(s),
        push: 2.5,             // m/s² still pushing up when the jump fires...
        pushT: 0.08,           // ...and has been for this long (s)
        depth: clamp(p.depth || 0.3, 0.15, 0.6) / s,   // m: sunk this far = a duck, even mid-way down
        minDepth: 0.14 / s,                            // m: a duck sinks at least this far (walking bobs ~3 cm)
        fall: 0.45 * G0,       // |a| below this = weightless
      };
    };
    d.setSens = s => { d.sens = s; };
    d.setProfile = p => { d.prof = { ...DEFAULT_PROF, ...(p || {}) }; };
    d.reset = () => {
      Object.assign(d, { t: null, g: null, n: 0, av: 0, v: 0, ffT: 0, vHist: [], pushT: 0, sink: 0, z: 0, zHist: [], mode: 'ready', modeT: 0, down: null, quietT: 0, lastDuckT: -1e9 });
    };

    // Feed one sample; returns the events it fired (usually none).
    d.push = s => {
      const out = [];
      if (!ok(s.ax) || !ok(s.ay) || !ok(s.az)) return out;
      if (d.t === null) { d.t = s.t; d.g = [s.ax, s.ay, s.az]; return out; }
      const dt = clamp((s.t - d.t) / 1000, 0.001, 0.1); d.t = s.t; d.n++;
      const T = d.thresholds();

      // --- 1. gravity
      const a = [s.ax, s.ay, s.az];
      const mag = Math.hypot(a[0], a[1], a[2]); d.mag = mag;
      let gv = null;
      if (ok(s.lx) && ok(s.ly) && ok(s.lz)) {
        const f = [a[0] - s.lx, a[1] - s.ly, a[2] - s.lz], fm = Math.hypot(f[0], f[1], f[2]);
        if (fm > 0.7 * G0 && fm < 1.3 * G0) gv = f;          // gyro-fused gravity from the phone
      }
      d.fused = !!gv;
      // Low-pass gravity: learn quickly while the phone is steady, almost freeze while it is shaken
      const still = Math.abs(mag - d.G) < 1.2 && (s.rot === null || s.rot === undefined || s.rot < 200);
      const tau = d.n < 20 ? 0.05 : still ? 0.35 : 3;
      const k = 1 - Math.exp(-dt / tau);
      for (let i = 0; i < 3; i++) d.g[i] += (a[i] - d.g[i]) * k;
      if (still && d.n > 20) d.G += (mag - d.G) * (1 - Math.exp(-dt / 4));  // sensor scale differs a little per phone
      const g = gv || d.g, gm = Math.hypot(g[0], g[1], g[2]) || 1;

      // --- 2. vertical acceleration (+ up), whatever the sign convention of the browser.
      // With the phone's fused gravity: project onto it. Low-pass only (no gyro): the gravity
      // estimate lags when the phone swings in the pocket, so the projection reads as sinking;
      // use |a| − g there instead, which does not care which way the phone points.
      const proj = (a[0] * g[0] + a[1] * g[1] + a[2] * g[2]) / gm - (gv ? gm : d.G);
      let av = gv ? proj : mag - d.G;
      d.avRaw = av;
      d.av += (av - d.av) * (1 - Math.exp(-dt / 0.02));   // trim sensor noise, keep it quick
      av = d.av;

      // --- 3. vertical speed: leaky integral, pulled to zero while the body is still
      d.v = d.v * Math.exp(-dt / 2.5) + av * dt;
      d.quietT = Math.abs(av) < 1.0 ? d.quietT + dt : 0;
      if (d.quietT > 0.15) d.v *= Math.exp(-dt / 0.08);
      d.vHist.push([s.t, d.v]);
      while (d.vHist.length && s.t - d.vHist[0][0] > 450) d.vHist.shift();
      // how long the body has been pushing up hard (a jump pushes for 150–350 ms, a stomp for 50)
      d.pushT = d.avRaw > 2.5 ? d.pushT + dt : 0;
      // rough height (leaky) and how far the body has sunk below its recent high point (m)
      d.z = d.z * Math.exp(-dt / 1.5) + d.v * dt;
      d.zHist.push([s.t, d.z]);
      while (d.zHist.length && s.t - d.zHist[0][0] > 900) d.zHist.shift();
      d.sink = d.zHist.reduce((m, p) => Math.max(m, p[1]), -9) - d.z;

      // weightless?
      if (mag < T.fall) d.ffT += dt; else d.ffT = 0;

      const fire = (type, src) => { const e = { type, t: s.t, src }; out.push(e); return e; };
      d.modeT += dt;

      // --- 4. decisions
      if (d.mode === 'air') {
        // wait for the landing (free-fall ended) and a moment to settle
        if (d.ffT > 0.04) d.sawFall = true;
        if (d.sawFall && !d.landT && mag > 1.3 * G0) d.landT = s.t;
        const settled = d.landT ? s.t - d.landT > 300 && Math.abs(av) < 4
          : d.modeT > 0.9 && Math.abs(av) < 3;            // pushed up but never left the floor
        if (settled || d.modeT > 2) { d.mode = 'ready'; d.v = 0; d.down = null; d.modeT = 0; }
        return out;
      }

      const sinceDuck = s.t - d.lastDuckT;
      const vJump = T.vJump * (d.mode === 'low' || sinceDuck < 1200 ? 1.3 : 1)    // standing up is not a jump
        * (d.fused ? 1 : 1.15);                                                    // |a| − g reads a little high
      const maxV = d.vHist.reduce((m, p) => Math.max(m, p[1]), -9);
      const pushed = !d.fallOnly && d.v > vJump && av > T.push && d.pushT >= T.pushT;
      const flew = d.ffT >= 0.06 && maxV > 0.4 * T.vJump;
      if (pushed || flew) {
        fire('jump', pushed ? 'push' : 'fall');
        d.mode = 'air'; d.modeT = 0; d.sawFall = d.ffT > 0.04; d.landT = 0; d.down = null;
        return out;
      }

      if (d.mode === 'low') {
        // stay low until they rise again (or a while passes)
        if (d.v > 0.3 || d.modeT > 1.6) { fire('up', d.v > 0.3 ? 'rise' : 'timeout'); d.mode = 'ready'; d.modeT = 0; d.down = null; }
        return out;
      }

      // ready: watch for a duck
      if (!d.down) {
        if (d.v < -T.vDuck && d.ffT === 0) d.down = { vmin: d.v, hold: 0, t0: s.t, peak: 0 };
      } else {
        const dn = d.down;
        if (d.v < dn.vmin) { dn.vmin = d.v; dn.peak = 0; }                       // braking peak counts from the fastest point down
        dn.peak = Math.max(dn.peak, av);
        if (d.v > 0.2 || d.ffT > 0.03 || s.t - dn.t0 > 1200) d.down = null;       // bounced back up: a jump's dip, not a duck
        else if (d.v < -T.vEarly) duckNow('fast');
        else if (d.sink > T.depth && d.v < -0.2) duckNow('deep');
        // braking eases off while still sinking: a squat settling (a jump keeps pushing harder through the bottom)
        else if (d.sink > T.minDepth && dn.peak > 1.5 && av < 0.9 * dn.peak && d.v > 0.6 * dn.vmin && d.v < -0.02) duckNow('brake');
        else if (d.sink > T.minDepth && d.v > 0.35 * dn.vmin && d.v < 0.25 && Math.abs(av) < 2.5) { dn.hold += dt; if (dn.hold >= 0.05) duckNow('stop'); }
        else dn.hold = 0;
      }
      function duckNow(src) {
        fire('duck', src);
        d.lastDuckT = s.t; d.mode = 'low'; d.modeT = 0; d.down = null;
      }
      return out;
    };
    return d;
  }

  // ---- move check: jump twice, duck twice. Feed it samples; it reports what it measured.
  function createCalibrator() {
    const det = createDetector({ fallOnly: true, prof: { vDuck: 0.3, vEarly: 9, depth: 9 } }); // whole jumps, gentle ducks
    const c = { det, jumps: [], ducks: [], phase: 'jump', stage: null, win: [] };
    c.push = s => {
      const ev = det.push(s);
      c.win.push([s.t, det.v, det.sink]);
      while (c.win.length && s.t - c.win[0][0] > 900) c.win.shift();
      if (c.stage) c.stage.depth = Math.max(c.stage.depth, det.sink);
      const got = [];
      for (const e of ev) {
        if (c.phase === 'jump' && e.type === 'jump') {
          // takeoff speed = top speed of the push; dip = lowest speed and deepest sink before it
          let vmax = 0, imax = 0;
          c.win.forEach((p, i) => { if (p[1] > vmax) { vmax = p[1]; imax = i; } });
          const before = c.win.slice(0, imax + 1);
          c.jumps.push({ v: vmax, dip: -Math.min(0, ...before.map(p => p[1])), dipDepth: Math.max(0, ...before.map(p => p[2])) });
          got.push('jump');
          if (c.jumps.length >= 2) c.phase = 'duck';
        } else if (c.phase === 'duck' && e.type === 'duck') {
          c.stage = { vmin: Math.min(0, ...c.win.map(p => p[1])), depth: Math.max(0, ...c.win.map(p => p[2])) };
        } else if (c.phase === 'duck' && e.type === 'up' && c.stage) {
          c.ducks.push({ v: -c.stage.vmin, depth: c.stage.depth }); c.stage = null; got.push('duck');
          if (c.ducks.length >= 2) c.phase = 'done';
        }
      }
      return got;
    };
    // thresholds from what was measured; anything missing keeps its default
    c.profile = () => {
      const p = { ...DEFAULT_PROF };
      const r2 = x => Math.round(x * 100) / 100;
      if (c.jumps.length) p.vJump = r2(clamp(Math.min(...c.jumps.map(j => j.v)) * 0.45, 0.6, 1.5));
      const dip = c.jumps.length ? Math.max(...c.jumps.map(j => j.dip)) : 0.8;
      const dipDepth = c.jumps.length ? Math.max(...c.jumps.map(j => j.dipDepth)) : 0.15;
      if (c.ducks.length) {
        const vd = Math.min(...c.ducks.map(x => x.v)), dd = Math.min(...c.ducks.map(x => x.depth));
        p.vDuck = r2(clamp(vd * 0.5, 0.3, 0.9));
        // fire mid-way down only when this player's ducks are clearly faster / deeper than their jump dips
        p.vEarly = r2(vd > dip * 1.5 ? clamp(Math.max(dip * 1.3, vd * 0.8), 1.0, 3.0) : 3.0);
        p.depth = r2(dd > dipDepth * 1.6 ? clamp(Math.max(dipDepth * 1.3, dd * 0.6), 0.15, 0.6) : 0.3);
      }
      p.measured = { jumps: c.jumps.map(j => ({ v: r2(j.v), dip: r2(j.dip), dipDepth: r2(j.dipDepth) })), ducks: c.ducks.map(x => ({ v: r2(x.v), depth: r2(x.depth) })) };
      return p;
    };
    return c;
  }

  const api = { createDetector, createCalibrator, fromEvent, DEFAULT_PROF, SENS, G0 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RRMotion = api;
})(typeof window !== 'undefined' ? window : this);

// Synthetic devicemotion samples for testing the pocket-controller detector.
// Movements are described in the world frame (z up, m/s² of the body), then seen through a
// phone held at any (changing) orientation, with sensor noise, like a phone in a pocket.
'use strict';
const G = 9.81;

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function gauss(r) { return Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r()); }

// half-sine pulse of peak A lasting T; area = 2AT/π
const hs = (A, T) => ({ dur: T, f: t => [0, 0, A * Math.sin(Math.PI * t / T)] });
const hold = (T, z = 0) => ({ dur: T, f: () => [0, 0, z] });
const fall = T => ({ dur: T, f: () => [0, 0, -G], ff: true });

// Countermovement jump. takeoff = upward speed when leaving the floor (m/s).
function jump({ takeoff = 2.4, dip = 0.5, dipT = 0.22, pushT = 0.3, landT = 0.14 } = {}) {
  const vDip = dip * G * dipT * 2 / Math.PI;           // downward speed at the bottom of the dip
  const pushA = (vDip + takeoff) * Math.PI / (2 * pushT);
  const air = 2 * takeoff / G;
  const landA = takeoff * Math.PI / (2 * landT);
  const segs = [];
  if (dip > 0) segs.push(hs(-dip * G, dipT));
  segs.push({ ...hs(pushA, pushT), mark: 'push' });
  segs.push({ ...fall(air), mark: 'takeoff' });
  segs.push({ ...hs(landA, landT), mark: 'land' });
  segs.push(hs(-0.25 * G, 0.18), hs(0.25 * G, 0.18));   // knees soak up the landing
  return segs;
}
// Duck: drop, stop low, stay, stand up.
function squat({ drop = 0.45, downT = 0.3, stay = 0.6, upA = 0.35, upT = 0.35 } = {}) {
  return [
    { ...hs(-drop * G, downT), mark: 'duck' }, hs(drop * G, downT), hold(stay),
    hs(upA * G, upT), hs(-upA * G, upT),
  ];
}
// a hard foot stomp seen at the hip: sharp spike, no flight
const stomp = () => [{ dur: 0.06, f: t => [0, 0, 3 * G * Math.sin(Math.PI * t / 0.06)] }, hs(-0.4 * G, 0.1)];
// a heavy step down: the hip sinks a little, then the foot hits hard
const heavyStep = () => [hs(-0.35 * G, 0.18), { dur: 0.05, f: t => [0, 0, 2.6 * G * Math.sin(Math.PI * t / 0.05)] }, hs(-0.25 * G, 0.1)];

// Generic periodic movement (walking, marching, side steps) for `dur` seconds.
function periodic(dur, fn) { return [{ dur, f: fn }]; }
const walking = (dur, amp = 0.35) => periodic(dur, t => [
  0.2 * G * Math.cos(2 * Math.PI * 1 * t), 0.1 * G * Math.cos(2 * Math.PI * 2 * t),
  amp * G * Math.cos(2 * Math.PI * 2 * t) + (((t * 2) % 1) < 0.04 ? 0.8 * G : -0.8 * G * 0.04 / 0.96),   // heel strikes (zero mean)
]);
const sideSteps = (dur) => periodic(dur, t => {
  // step every 0.9 s: sideways push and stop, small vertical bob
  const ph = (t % 0.9) / 0.9, dir = Math.floor(t / 0.9) % 2 ? 1 : -1;
  const lat = ph < 0.25 ? dir * 0.45 * G * Math.sin(Math.PI * ph / 0.25) : ph < 0.5 ? -dir * 0.45 * G * Math.sin(Math.PI * (ph - 0.25) / 0.25) : 0;
  const vert = ph < 0.5 ? -0.18 * G * Math.sin(2 * Math.PI * ph / 0.5) : 0;
  return [lat, 0, vert];
});

// Render segments into samples. orient(t) -> [roll, pitch, yaw] (rad) of the phone.
function render(segs, { hz = 60, seed = 1, noise = 0.25, flip = false, fused = true, orient = () => [0.3, 1.2, 0.5], lead = 1, tail = 1.2, jitter = 0.15 } = {}) {
  const r = rng(seed), dt0 = 1 / hz;
  const plan = [hold(lead), ...segs, hold(tail)];
  const marks = {}; let t0 = 0;
  for (const s of plan) { if (s.mark && marks[s.mark] === undefined) marks[s.mark] = t0 * 1000; s.t0 = t0; t0 += s.dur; }
  const total = t0, out = [];
  let t = 0, prevO = orient(0);
  while (t < total) {
    const seg = plan.find(s => t >= s.t0 && t < s.t0 + s.dur) || plan[plan.length - 1];
    const aw = seg.f(t - seg.t0);                       // body acceleration, world frame
    const o = orient(t);
    const sf = [aw[0], aw[1], aw[2] + G];               // specific force: what an accelerometer feels
    const R = rot(o);
    const toPhone = v => [0, 1, 2].map(i => R[0][i] * v[0] + R[1][i] * v[1] + R[2][i] * v[2]); // Rᵀv
    const sgn = flip ? -1 : 1;                          // iOS has reported the opposite sign
    const n = () => gauss(r) * noise;
    const aig = toPhone(sf).map(x => sgn * x + n());
    const lin = toPhone(aw).map(x => sgn * x + n() * 0.6);
    const rot_ = Math.hypot(o[0] - prevO[0], o[1] - prevO[1], o[2] - prevO[2]) / dt0 * 180 / Math.PI; prevO = o;
    out.push({ t: t * 1000, ax: aig[0], ay: aig[1], az: aig[2], lx: fused ? lin[0] : null, ly: fused ? lin[1] : null, lz: fused ? lin[2] : null, rot: fused ? rot_ : null });
    t += dt0 * (1 + (r() - 0.5) * jitter);
  }
  return { samples: out, marks, total: total * 1000 };
}
function rot([a, b, c]) {
  const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cc = Math.cos(c), sc = Math.sin(c);
  const Rx = [[1, 0, 0], [0, ca, -sa], [0, sa, ca]], Ry = [[cb, 0, sb], [0, 1, 0], [-sb, 0, cb]], Rz = [[cc, -sc, 0], [sc, cc, 0], [0, 0, 1]];
  const m = (A, B) => A.map((row, i) => B[0].map((_, j) => row.reduce((s, _, k) => s + A[i][k] * B[k][j], 0)));
  return m(Rz, m(Ry, Rx)); // phone → world
}

module.exports = { G, hs, hold, fall, jump, squat, stomp, heavyStep, walking, sideSteps, periodic, render };

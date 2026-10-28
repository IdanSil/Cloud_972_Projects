// Unit tests for the pocket-controller motion detector, fed with synthetic devicemotion data.
// Run: node rail_rush/tests/motion.test.js
'use strict';
const M = require('../motion.js');
const S = require('./synth.js');

let fails = 0, passes = 0;
const lat = [];

function run(segs, opts = {}, detOpts = {}) {
  const { samples, marks } = S.render(segs, opts);
  const det = M.createDetector(detOpts);
  const ev = [];
  for (const s of samples) for (const e of det.push(s)) ev.push(e);
  return { ev, marks, det };
}
const count = (ev, type) => ev.filter(e => e.type === type).length;
function check(name, cond, info = '') {
  if (cond) passes++; else { fails++; console.log(`FAIL  ${name}  ${info}`); }
}

// Orientations: upright in a front pocket, upside down, sideways, flat in a back pocket, tilted
const ORIENTS = {
  frontPocket: () => [Math.PI / 2, 0, 0.3],
  upsideDown: () => [-Math.PI / 2, 0.2, 2.0],
  sideways: () => [0.2, Math.PI / 2, 1.1],
  flatBack: () => [0, 0.05, 0],
  tilted: () => [0.7, 0.9, -0.6],
  // thigh swings while the knees bend and straighten (± 25°)
  swinging: t => [Math.PI / 2 + 0.45 * Math.sin(2 * Math.PI * 1.6 * t), 0.1, 0.3],
};
const VARIANTS = [];
for (const [oname, orient] of Object.entries(ORIENTS))
  for (const fused of [true, false])
    for (const flip of [false, true]) VARIANTS.push({ name: `${oname}/${fused ? 'fused' : 'lowpass'}/${flip ? 'ios-sign' : 'spec-sign'}`, opts: { orient, fused, flip } });

let seed = 7;
const each = (fn) => VARIANTS.forEach(v => fn(v, { ...v.opts, seed: seed++ }));

// ---- jumps: exactly one jump, never a duck
const JUMPS = {
  normal: S.jump(),
  small: S.jump({ takeoff: 1.6, dip: 0.35 }),
  big: S.jump({ takeoff: 2.9, dip: 0.7, dipT: 0.28 }),
  deepDip: S.jump({ takeoff: 2.2, dip: 0.6, dipT: 0.3, pushT: 0.36 }),
  noDip: S.jump({ takeoff: 2.0, dip: 0 }),
  quick: S.jump({ takeoff: 2.0, dip: 0.6, dipT: 0.15, pushT: 0.2 }),
};
for (const [jn, segs] of Object.entries(JUMPS)) each((v, o) => {
  const { ev, marks } = run(segs, o);
  const ok = count(ev, 'jump') === 1 && count(ev, 'duck') === 0;
  check(`jump:${jn} ${v.name}`, ok, JSON.stringify(ev.map(e => e.type + '@' + Math.round(e.t))));
  const j = ev.find(e => e.type === 'jump');
  if (j) lat.push({ kind: jn, src: j.src, ms: j.t - marks.takeoff });
});

// ---- ducks: exactly one duck, never a jump
const DUCKS = {
  normal: S.squat(),
  fast: S.squat({ drop: 0.7, downT: 0.22 }),
  slowish: S.squat({ drop: 0.3, downT: 0.4 }),
  bob: S.squat({ drop: 0.6, downT: 0.22, stay: 0.08, upA: 0.5, upT: 0.25 }),
  longHold: S.squat({ stay: 1.5 }),
  deep: S.squat({ drop: 0.62, downT: 0.3 }),
  hard: S.squat({ drop: 0.9, downT: 0.25 }),
};
const duckLat = [];
for (const [dn, segs] of Object.entries(DUCKS)) each((v, o) => {
  const { ev, marks } = run(segs, o);
  check(`duck:${dn} ${v.name}`, count(ev, 'duck') === 1 && count(ev, 'jump') === 0, JSON.stringify(ev.map(e => e.type + '@' + Math.round(e.t))));
  const d = ev.find(e => e.type === 'duck');
  if (d) duckLat.push({ kind: dn, src: d.src, ms: d.t - marks.duck });
});

// ---- things that must not trigger anything
const QUIET = {
  standing: [S.hold(5)],
  walking: S.walking(8),
  brisk: S.walking(6, 0.5),
  sideSteps: S.sideSteps(8),
  stomps: [...S.stomp(), S.hold(0.8), ...S.stomp(), S.hold(0.8), ...S.stomp()],
  heavySteps: [...S.heavyStep(), S.hold(0.6), ...S.heavyStep(), S.hold(0.6), ...S.heavyStep()],
};
for (const [qn, segs] of Object.entries(QUIET)) each((v, o) => {
  const { ev } = run(segs, o);
  check(`quiet:${qn} ${v.name} seed=${o.seed}`, count(ev, 'jump') + count(ev, 'duck') === 0, JSON.stringify(ev.map(e => e.type + ':' + e.src + '@' + Math.round(e.t))));
});
// walking while the phone swings in the pocket
for (const fused of [true, false]) for (const flip of [false, true]) {
  const { ev } = run(S.walking(8), { fused, flip, seed: seed++, orient: t => [Math.PI / 2 + 0.5 * Math.sin(2 * Math.PI * t), 0.2 * Math.sin(2 * Math.PI * 2 * t), 0.3] });
  check(`quiet:walk+swing ${fused} ${flip}`, ev.length === 0, JSON.stringify(ev));
}
// phone turning over in the pocket (slow and quick), body still
const turns = {
  halfTurn: t => [Math.PI / 2 + Math.PI * Math.min(1, Math.max(0, t - 1.5) / 1.2), 0.1, 0.3],
  quickFlip: t => [0.3 + Math.PI * Math.min(1, Math.max(0, t - 1.5) / 0.4), 0.2, 0],
  fumble: t => [Math.PI / 2 + 0.9 * Math.sin(3.1 * t) * (t > 1 && t < 4 ? 1 : 0), 0.6 * Math.sin(2.3 * t) * (t > 1 && t < 4 ? 1 : 0), 0.4 * Math.sin(1.7 * t)],
  pocketSlip: t => [Math.PI / 2 + (t > 2 ? 0.9 : 0) * Math.min(1, (t - 2) / 0.15), 0, 0],
};
for (const [tn, orient] of Object.entries(turns)) for (const fused of [true, false]) for (const flip of [false, true]) {
  const { ev } = run([S.hold(5)], { fused, flip, orient, seed: seed++ });
  check(`quiet:rotate:${tn} ${fused ? 'fused' : 'lowpass'} ${flip ? 'ios' : 'spec'}`, ev.filter(e => e.type !== 'up').length === 0, JSON.stringify(ev));
}

// ---- sequences
each((v, o) => {
  const segs = [...S.jump(), S.hold(0.5), ...S.jump({ takeoff: 2 }), S.hold(0.5), ...S.jump({ takeoff: 2.6 })];
  const { ev } = run(segs, o);
  check(`seq:3 jumps ${v.name}`, count(ev, 'jump') === 3 && count(ev, 'duck') === 0, JSON.stringify(ev.map(e => e.type + '@' + Math.round(e.t))));
});
each((v, o) => {
  const segs = [...S.squat({ stay: 0.3 }), S.hold(0.7), ...S.jump(), S.hold(0.6), ...S.squat()];
  const { ev } = run(segs, o);
  const types = ev.filter(e => e.type !== 'up').map(e => e.type).join(',');
  check(`seq:duck,jump,duck ${v.name}`, types === 'duck,jump,duck', types);
});
each((v, o) => {
  // walking into a jump: still exactly one jump
  const { ev } = run([...S.walking(3), ...S.jump(), ...S.walking(3)], o);
  check(`seq:walk-jump-walk ${v.name}`, count(ev, 'jump') === 1 && count(ev, 'duck') === 0, JSON.stringify(ev.map(e => e.type + ':' + e.src + '@' + Math.round(e.t))));
});

// ---- sample rate and sensitivity
for (const hz of [30, 50, 100]) {
  const { ev } = run(S.jump(), { hz, seed: seed++ });
  check(`rate ${hz}Hz jump`, count(ev, 'jump') === 1 && count(ev, 'duck') === 0, JSON.stringify(ev));
  const d = run(S.squat(), { hz, seed: seed++ });
  check(`rate ${hz}Hz duck`, count(d.ev, 'duck') === 1 && count(d.ev, 'jump') === 0, JSON.stringify(d.ev));
}
for (const s of M.SENS) {
  const q = run(S.walking(8, s > 1.3 ? 0.35 : 0.5), { seed: seed++ }, { sens: s });
  check(`sens ${s} brisk walk quiet`, q.ev.length === 0, JSON.stringify(q.ev));
  const j = run(S.jump({ takeoff: 1.7, dip: 0.35 }), { seed: seed++ }, { sens: s });
  check(`sens ${s} small jump`, count(j.ev, 'jump') === 1, JSON.stringify(j.ev));
}

// ---- calibrator: two jumps, two ducks -> a profile
{
  const segs = [S.hold(1), ...S.jump({ takeoff: 2.2 }), S.hold(1), ...S.jump({ takeoff: 2.0 }), S.hold(1), ...S.squat({ drop: 0.6, downT: 0.32 }), S.hold(1), ...S.squat({ drop: 0.65, downT: 0.3 })];
  const { samples } = S.render(segs, { seed: 99, orient: ORIENTS.tilted });
  const c = M.createCalibrator(); const got = [];
  for (const s of samples) got.push(...c.push(s));
  const p = c.profile();
  check('calib: saw 2 jumps 2 ducks', got.join(',') === 'jump,jump,duck,duck' && c.phase === 'done', got.join(','));
  check('calib: jump line sensible', p.vJump > 0.6 && p.vJump < 1.3, JSON.stringify(p));
  check('calib: duck line sensible', p.vDuck >= 0.3 && p.vDuck < 0.8, JSON.stringify(p));
  console.log('Move check result:', JSON.stringify(p));
  // calibrated detector still behaves
  const j = run(S.jump({ takeoff: 2.0 }), { seed: 5 }, { prof: p });
  const d = run(S.squat(), { seed: 6 }, { prof: p });
  const w = run(S.walking(8), { seed: 8 }, { prof: p });
  check('calib: profile works', count(j.ev, 'jump') === 1 && count(d.ev, 'duck') === 1 && w.ev.length === 0, JSON.stringify([j.ev, d.ev, w.ev]));
  // with the calibrated profile, a deep duck can fire on the way down
  const dd = run(S.squat({ drop: 0.6, downT: 0.32 }), { seed: 11 }, { prof: p });
  const dd0 = run(S.squat({ drop: 0.6, downT: 0.32 }), { seed: 11 });
  console.log(`Deep duck fired after ${Math.round(dd0.ev[0].t - dd0.marks.duck)} ms with defaults, ${Math.round(dd.ev[0].t - dd.marks.duck)} ms after the move check (${dd.ev[0].src})`);
  // calibrated profile over the random jumps: no ducks sneak in
  let bad = 0;
  for (let i = 0; i < 40; i++) { const r = run(S.jump({ takeoff: 1.8 + (i % 5) * 0.2, dip: 0.3 + (i % 4) * 0.1 }), { seed: 500 + i }, { prof: p }); if (count(r.ev, 'jump') !== 1 || count(r.ev, 'duck')) bad++; }
  check('calib: jumps clean with profile', bad === 0, bad + ' bad');
}

// ---- randomized sweep: random sizes, orientations, noise and sample rates
{
  const R = (() => { let x = 12345; return () => ((x = (x * 1103515245 + 12345) >>> 0) / 4294967296); })();
  const U = (a, b) => a + (b - a) * R();
  const randOrient = () => { const o = [U(-3, 3), U(-1.5, 1.5), U(-3, 3)], w = U(0, 0.5), f = U(0.8, 2); return t => [o[0] + w * Math.sin(2 * Math.PI * f * t), o[1], o[2]]; };
  const tally = { jump: [0, 0], duck: [0, 0], quiet: [0, 0] };
  const N = 150;
  for (let i = 0; i < N; i++) {
    const base = { orient: randOrient(), seed: 1000 + i, noise: U(0.15, 0.5), hz: [50, 60, 60, 100][i % 4], flip: R() < 0.5, fused: R() < 0.8 };
    const j = run(S.jump({ takeoff: U(1.5, 3), dip: U(0, 0.65), dipT: U(0.15, 0.3), pushT: U(0.2, 0.35) }), base);
    tally.jump[0]++; if (count(j.ev, 'jump') === 1 && count(j.ev, 'duck') === 0) tally.jump[1]++;
    // a duck that sinks 20–60 cm (depth = 2·a·T²/π), at most 1 g down
    const downT = U(0.2, 0.4), depth = U(0.2, 0.6);
    const dp = { drop: Math.min(1, depth * Math.PI / (2 * 9.81 * downT * downT)), downT, stay: U(0.1, 1), upA: U(0.25, 0.45), upT: U(0.25, 0.45) };
    const d = run(S.squat(dp), base);
    tally.duck[0]++; if (count(d.ev, 'duck') === 1 && count(d.ev, 'jump') === 0) tally.duck[1]++;
    else if (process.env.VERBOSE) console.log('duck miss', JSON.stringify(dp), 'depth', (2 * dp.drop * 9.81 * dp.downT ** 2 / Math.PI).toFixed(2), base.fused, base.noise.toFixed(2), d.ev.map(e => e.type + ':' + e.src).join());
    const q = run(i % 3 === 0 ? S.walking(6, U(0.2, 0.45)) : i % 3 === 1 ? S.sideSteps(6) : [S.hold(4)], base);
    tally.quiet[0]++; if (count(q.ev, 'jump') + count(q.ev, 'duck') === 0) tally.quiet[1]++;
  }
  const pct = k => (100 * tally[k][1] / tally[k][0]).toFixed(1) + '%';
  console.log(`Random sweep (${N} each): jumps right ${pct('jump')}, ducks right ${pct('duck')}, walking/side steps/standing with no false trigger ${pct('quiet')}`);
  check('sweep: jumps >= 97%', tally.jump[1] / N >= 0.97, pct('jump'));
  check('sweep: ducks >= 95%', tally.duck[1] / N >= 0.95, pct('duck'));
  check('sweep: quiet >= 97%', tally.quiet[1] / N >= 0.97, pct('quiet'));
}

// ---- report
const stats = arr => { const ms = arr.map(x => x.ms).sort((a, b) => a - b); return ms.length ? `median ${Math.round(ms[ms.length >> 1])} ms, worst ${Math.round(ms[ms.length - 1])} ms, n=${ms.length}` : 'none'; };
console.log('\nJump fired relative to takeoff (negative = before the feet leave the floor):');
for (const k of Object.keys(JUMPS)) console.log(`  ${k.padEnd(8)} ${stats(lat.filter(x => x.kind === k))}   via ${[...new Set(lat.filter(x => x.kind === k).map(x => x.src))].join('/')}`);
console.log('Duck fired after the drop starts:');
for (const k of Object.keys(DUCKS)) console.log(`  ${k.padEnd(8)} ${stats(duckLat.filter(x => x.kind === k))}   via ${[...new Set(duckLat.filter(x => x.kind === k).map(x => x.src))].join('/')}`);
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);

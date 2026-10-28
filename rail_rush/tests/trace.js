// Print the detector's signals for one synthetic movement: node tests/trace.js "S.squat({drop:0.7,downT:0.22})" [fused] [flip]
const M = require('../motion.js'), S = require('./synth.js');
const segs = eval(process.argv[2] || 'S.jump()');
const { samples, marks } = S.render(segs, { fused: process.argv[3] !== 'lowpass', flip: process.argv[4] === 'flip', seed: 3 });
const det = M.createDetector(); console.log('marks', marks);
let i = 0;
for (const s of samples) {
  const ev = det.push(s);
  if (s.t > 900 && (i++ % 2 === 0 || ev.length)) console.log(`${Math.round(s.t)}\tav ${det.av.toFixed(1)}\tv ${det.v.toFixed(2)}\tsink ${det.sink.toFixed(2)}\t|a| ${det.mag.toFixed(1)}\t${det.mode}\t${det.down ? 'down vmin ' + det.down.vmin.toFixed(2) + ' hold ' + det.down.hold.toFixed(2) : ''}\t${ev.map(e => e.type + ':' + e.src).join(' ')}`);
}

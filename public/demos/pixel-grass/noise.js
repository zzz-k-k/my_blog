// Deterministic periodic value noise for this WebGL teaching adaptation.
// Godot uses FastNoiseLite; this deliberately uses a different, inspectable generator.
// BEGIN noise
const fract = x => x - Math.floor(x);
function hash(x, y, seed) {
  return fract(Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453);
}
function valueNoise(x, y, period, seed) {
  const ix = Math.floor(x), iy = Math.floor(y);
  let fx = fract(x), fy = fract(y);
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const at = (a, b) => hash((a + period) % period, (b + period) % period, seed);
  const top = at(ix, iy) * (1 - fx) + at(ix + 1, iy) * fx;
  const bottom = at(ix, iy + 1) * (1 - fx) + at(ix + 1, iy + 1) * fx;
  return top * (1 - fy) + bottom * fy;
}
export function makeNoise(seed, size = 256) {
  const bytes = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let value = 0, weight = 0;
    for (let octave = 0; octave < 4; octave++) {
      const period = 4 * 2 ** octave, amplitude = 0.5 ** octave;
      value += amplitude * valueNoise(x / size * period, y / size * period, period, seed);
      weight += amplitude;
    }
    const v = Math.round(value / weight * 255), i = (y * size + x) * 4;
    bytes.set([v, v, v, 255], i);
  }
  return { bytes, size };
}
// END noise

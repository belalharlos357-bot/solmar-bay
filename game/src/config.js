// Solmar Bay — shared tuning, city layout and small math helpers.
export const WORLD = {
  half: 220,            // ground plane half-size in world units
  streetStep: 40,       // distance between street centre lines
  streetCount: 9,       // streets each way: -160 .. 160
  roadWidth: 10,
  block: 27,            // building block size between roads
  beachZ: 182,          // sand starts here (south edge)
  waterZ: 196,          // water starts here
};
export const STREETS = []; // street centre-line coordinates
for (let i = 0; i < WORLD.streetCount; i += 1) STREETS.push(-160 + i * WORLD.streetStep);

export const TUNE = {
  walkSpeed: 6.5,
  sprintSpeed: 10.5,
  carAccel: 26,
  carBrake: 42,
  carReverse: 14,
  carTopSpeed: 38,     // ~137 km/h feel
  carTurn: 1.9,
  trafficSpeed: 9,
  policeSpeed: 42,
  healthMax: 100,
  shotCooldown: 0.28,
  wantedDecay: 1.1,    // heat per second while quiet
  bustedRange: 4.5,
};

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
/** Shortest-arc angle lerp, for headings. */
export function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
export function dist2(ax, az, bx, bz) {
  const dx = ax - bx, dz = az - bz;
  return dx * dx + dz * dz;
}
/** Is (x,z) on a road (within road width of a street line)? */
export function onRoad(x, z) {
  const hw = WORLD.roadWidth / 2 + 1.5;
  for (const s of STREETS) {
    if (Math.abs(x - s) < hw || Math.abs(z - s) < hw) return true;
  }
  return false;
}
/** Nearest street coordinate to a value. */
export function nearestStreet(v) {
  let best = STREETS[0];
  for (const s of STREETS) if (Math.abs(s - v) < Math.abs(best - v)) best = s;
  return best;
}

import { MODEL, advance, potential } from './physics.js?revision=2517ad9ee71f';

// Time reversal of an outward trajectory is an inward trajectory in this
// stationary potential. Zero angular momentum gives the requested straight
// radial infall; gravity sets the speed along the line, not a decorative curl.
export function buildTrajectory(mu, outerRadius, variant = 0) {
  const outerSpeed = .21 + variant * .11;
  const momentum = 0;
  const energy = outerSpeed * outerSpeed / 2 + potential(outerRadius, 0, mu);
  const tangential = momentum / MODEL.innerRadius;
  const radial = Math.sqrt(2 * (energy - potential(MODEL.innerRadius, 0, mu)) - tangential * tangential);
  const particle = { x: MODEL.innerRadius, y: 0, vx: radial, vy: tangential };
  const initial = { ...particle };
  const points = [{ x: particle.x, y: particle.y, t: 0 }];
  let time = 0, steps = 0;
  while (Math.hypot(particle.x, particle.y) < outerRadius && steps < 20000) {
    const radius = Math.hypot(particle.x, particle.y);
    const dt = MODEL.step / (radius < .30 ? 8 : radius < .6 ? 2 : 1);
    advance(particle, dt, mu);
    time += dt;
    steps++;
    const last = points[points.length - 1];
    // Keep fine geometry near the core and fewer samples on nearly straight
    // outer paths. Integration accuracy stays independent of render density.
    if (Math.hypot(particle.x - last.x, particle.y - last.y) > .003 + radius * .035) {
      points.push({ x: particle.x, y: particle.y, t: time });
    }
  }
  points.push({ x: particle.x, y: particle.y, t: time });
  return { points, duration: time, initial, final: { ...particle } };
}

export function pointAtTime(profile, time) {
  const points = profile.points;
  if (time <= 0) return points[0];
  if (time >= profile.duration) return points[points.length - 1];
  let low = 0, high = points.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (points[middle].t > time) high = middle; else low = middle;
  }
  const a = points[low], b = points[high];
  const fraction = (time - a.t) / (b.t - a.t);
  return { x: a.x + (b.x - a.x) * fraction, y: a.y + (b.y - a.y) * fraction };
}

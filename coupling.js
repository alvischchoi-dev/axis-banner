// Plummer-softened Newtonian pair acceleration. The same pair is evaluated
// once: m_i*a_i + m_j*a_j = 0, without a strongest-source force cap.
// Reference: NVIDIA GPU Gems 3, Chapter 31, sections 31.2 and 31.3.
export const PAIR_GRAVITY = Object.freeze({ G: .0014, epsilon: .09, step: 1 / 240 });

export function pairAccelerations(bodies, G = PAIR_GRAVITY.G, epsilon = PAIR_GRAVITY.epsilon) {
  const result = bodies.map(() => ({ x: 0, y: 0 }));
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
    const a = bodies[i], b = bodies[j];
    if (a.mass <= 0 || b.mass <= 0) continue;
    const dx = b.x - a.x, dy = b.y - a.y;
    const r2 = dx * dx + dy * dy + epsilon * epsilon;
    const force = G / (r2 * Math.sqrt(r2));
    result[i].x += force * b.mass * dx;
    result[i].y += force * b.mass * dy;
    result[j].x -= force * a.mass * dx;
    result[j].y -= force * a.mass * dy;
  }
  return result;
}

// Kick / drift / kick preserves momentum through the attraction. Production
// advects the markers with the existing inward flow between kicks; without
// that optional callback this is an isolated conservative N-body integrator.
export function advancePairBodies(bodies, dt, afterDrift, options = PAIR_GRAVITY) {
  const before = pairAccelerations(bodies, options.G, options.epsilon);
  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i];
    body.vx += before[i].x * dt * .5;
    body.vy += before[i].y * dt * .5;
    body.x += body.vx * dt;
    body.y += body.vy * dt;
  }
  afterDrift?.();
  const after = pairAccelerations(bodies, options.G, options.epsilon);
  for (let i = 0; i < bodies.length; i++) {
    bodies[i].vx += after[i].x * dt * .5;
    bodies[i].vy += after[i].y * dt * .5;
  }
}

// Raw summed field, independent of rendering saturation. Gravity always
// points toward each source and has a balanced point between equal masses.
export function gravitationalField(x, y, sources, G = 1, epsilon = PAIR_GRAVITY.epsilon) {
  let ax = 0, ay = 0;
  for (const source of sources) {
    const dx = source.x - x, dy = source.y - y;
    const r2 = dx * dx + dy * dy + epsilon * epsilon;
    const coefficient = G * source.mass / (r2 * Math.sqrt(r2));
    ax += coefficient * dx;
    ay += coefficient * dy;
  }
  return { x: ax, y: ay };
}

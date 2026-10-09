// Normalized Newtonian potential: Phi = -mu / sqrt(r^2 + epsilon^2).
// Its gradient gives inward acceleration. Softening regularizes the origin;
// particles never enter it because the luminous region is an inner boundary.
export const MODEL = Object.freeze({ mu: 0.052, epsilon: 0.004, innerRadius: 0.033, step: 1 / 240 });

export function potential(x, y, mu = MODEL.mu, epsilon = MODEL.epsilon) {
  return -mu / Math.sqrt(x * x + y * y + epsilon * epsilon);
}

export function acceleration(x, y, mu = MODEL.mu, epsilon = MODEL.epsilon) {
  const r2 = x * x + y * y + epsilon * epsilon;
  const factor = -mu / (r2 * Math.sqrt(r2));
  return { x: factor * x, y: factor * y };
}

// Velocity Verlet with finer substeps near the steep central potential.
// No artificial drag, speed cap, or outward "gravity". Tempo scales time only.
export function advance(particle, dt = MODEL.step, mu = MODEL.mu, epsilon = MODEL.epsilon, attractor = null) {
  const substeps = particle.x * particle.x + particle.y * particle.y < 0.18 * 0.18 ? 16 : 1;
  for (let i = 0; i < substeps; i++) verlet(particle, dt / substeps, mu, epsilon, attractor);
  return particle;
}

function verlet(particle, dt, mu, epsilon, attractor) {
  let r2 = particle.x * particle.x + particle.y * particle.y + epsilon * epsilon;
  let factor = -mu / (r2 * Math.sqrt(r2));
  let ax = factor * particle.x, ay = factor * particle.y;
  if (attractor && attractor.mu > 0) {
    const dx = particle.x - attractor.x, dy = particle.y - attractor.y;
    const distance2 = dx * dx + dy * dy + attractor.epsilon * attractor.epsilon;
    const influence = -attractor.mu / (distance2 * Math.sqrt(distance2));
    ax += influence * dx;
    ay += influence * dy;
  }
  particle.vx += ax * dt * 0.5;
  particle.vy += ay * dt * 0.5;
  particle.x += particle.vx * dt;
  particle.y += particle.vy * dt;
  r2 = particle.x * particle.x + particle.y * particle.y + epsilon * epsilon;
  factor = -mu / (r2 * Math.sqrt(r2));
  ax = factor * particle.x;
  ay = factor * particle.y;
  if (attractor && attractor.mu > 0) {
    const dx = particle.x - attractor.x, dy = particle.y - attractor.y;
    const distance2 = dx * dx + dy * dy + attractor.epsilon * attractor.epsilon;
    const influence = -attractor.mu / (distance2 * Math.sqrt(distance2));
    ax += influence * dx;
    ay += influence * dy;
  }
  particle.vx += ax * dt * 0.5;
  particle.vy += ay * dt * 0.5;
}

export function specificEnergy(particle, mu = MODEL.mu, epsilon = MODEL.epsilon, attractor = null) {
  const pointerPotential = attractor && attractor.mu > 0
    ? potential(particle.x - attractor.x, particle.y - attractor.y, attractor.mu, attractor.epsilon)
    : 0;
  return (particle.vx * particle.vx + particle.vy * particle.vy) / 2 + potential(particle.x, particle.y, mu, epsilon) + pointerPotential;
}

export function angularMomentum(particle) {
  return particle.x * particle.vy - particle.y * particle.vx;
}

export function seededRandom(seed = 153707670) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let result = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    result = (result + Math.imul(result ^ (result >>> 7), 61 | result)) ^ result;
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

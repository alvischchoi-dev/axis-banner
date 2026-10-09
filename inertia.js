// Exact damped mass/spring integration for a target held over dt. Light has
// displacement AND velocity: a reversal cannot reset its existing momentum.
// Node layout: base x/y, displacement x/y, velocity x/y.
export function responseKernel(dt, omega, damping = 1) {
  const rate = omega * damping;
  const frequency = omega * Math.sqrt(Math.max(0, 1 - damping * damping));
  const sine = frequency > 1e-8 ? Math.sin(frequency * dt) / frequency : dt;
  const cosine = Math.cos(frequency * dt);
  const decay = Math.exp(-rate * dt);
  return {
    position: decay * (cosine + rate * sine),
    velocity: decay * sine,
    acceleration: -decay * omega * omega * sine,
    retention: decay * (cosine - rate * sine),
  };
}

export function settleNode(nodes, index, targetX, targetY, dt, omega, kernel = responseKernel(dt, omega)) {
  for (let axis = 0; axis < 2; axis++) {
    const target = axis === 0 ? targetX : targetY;
    const displacement = nodes[index + 2 + axis] - target;
    const velocity = nodes[index + 4 + axis];
    nodes[index + 2 + axis] = target + displacement * kernel.position + velocity * kernel.velocity;
    nodes[index + 4 + axis] = displacement * kernel.acceleration + velocity * kernel.retention;
    if (target === 0 && Math.abs(nodes[index + 2 + axis]) < 1e-7 && Math.abs(nodes[index + 4 + axis]) < 1e-6) {
      nodes[index + 2 + axis] = nodes[index + 4 + axis] = 0;
    }
  }
}

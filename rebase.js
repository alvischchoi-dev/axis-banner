// Transfer a filament's displacement and velocity, never its animation clock.
export function rebaseFocus(focus, xFactor, yFactor) {
  for (const key of ['x', 'targetX', 'anchorX', 'sampleX']) focus[key] *= xFactor;
  for (const key of ['y', 'targetY', 'anchorY', 'sampleY']) focus[key] *= yFactor;
  for (let i = 0; i < focus.position.length; i++) focus.position[i] *= i % 2 ? yFactor : xFactor;
  for (const well of focus.history) { well.x *= xFactor; well.y *= yFactor; }
  const paceScale = Math.sqrt(xFactor * yFactor);
  focus.inputSpeed *= paceScale; focus.pointerSpeed *= paceScale;
}

export function rebaseRay(ray, previous, next, xFactor, yFactor) {
  const oldNodes = ray.nodes;
  const directionX = ray.cos * xFactor, directionY = ray.sin * yFactor;
  const stretch = Math.hypot(directionX, directionY);
  ray.cos = directionX / stretch; ray.sin = directionY / stretch;
  const nodes = new Float64Array(next.points.length * 6);
  let n = 0;
  for (let i = 0; i < next.points.length; i++) {
    const radius = next.points[i].x, oldRadius = radius / stretch;
    while (n < previous.points.length - 2 && previous.points[n + 1].x < oldRadius) n++;
    const a = previous.points[n], b = previous.points[n + 1];
    const u = Math.max(0, Math.min(1, (oldRadius - a.x) / (b.x - a.x)));
    nodes[i * 6] = radius * ray.cos; nodes[i * 6 + 1] = radius * ray.sin;
    for (let component = 2; component < 6; component++) {
      const factor = component % 2 ? yFactor : xFactor;
      nodes[i * 6 + component] = (oldNodes[n * 6 + component] * (1 - u) + oldNodes[(n + 1) * 6 + component] * u) * factor;
    }
  }
  ray.nodes = nodes;
  ray.screen = new Float64Array(next.points.length * 2);
  ray.curves = new Float64Array((next.points.length - 1) * 8);
  ray.dirty = true;
  return stretch;
}

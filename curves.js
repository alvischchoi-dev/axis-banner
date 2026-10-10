// Shared cubic Hermite geometry for both continuous filaments and pulses.
// Exact trimming prevents straight joins between successive bright slices.
export function resampleTrajectory(profile, spacing = .045) {
  const source = profile.points, points = [{ ...source[0] }];
  let n = 0;
  for (let radius = source[0].x + spacing; radius < source.at(-1).x; radius += spacing) {
    while (source[n + 1].x < radius) n++;
    const a = source[n], b = source[n + 1], u = (radius - a.x) / (b.x - a.x);
    points.push({ x: radius, y: 0, t: a.t + (b.t - a.t) * u });
  }
  points.push({ ...source.at(-1) });
  return { ...profile, points };
}
export function cubicSegments(points, xy, output = new Float64Array((points.length - 1) * 8)) {
  const slope = (i, axis) => {
    const a = Math.max(0, i - 1), b = Math.min(points.length - 1, i + 1);
    return (xy[b * 2 + axis] - xy[a * 2 + axis]) / (points[b].t - points[a].t);
  };
  for (let i = 0; i < points.length - 1; i++) {
    const dt = (points[i + 1].t - points[i].t) / 3, n = i * 8;
    for (let axis = 0; axis < 2; axis++) {
      const a = xy[i * 2 + axis], b = xy[(i + 1) * 2 + axis];
      output[n + axis] = a;
      output[n + 2 + axis] = a + slope(i, axis) * dt;
      output[n + 4 + axis] = b - slope(i + 1, axis) * dt;
      output[n + 6 + axis] = b;
    }
  }
  return output;
}
export function cubicPoint(curves, n, t) {
  const q = 1 - t;
  return { x: q ** 3 * curves[n] + 3 * q * q * t * curves[n + 2] + 3 * q * t * t * curves[n + 4] + t ** 3 * curves[n + 6],
    y: q ** 3 * curves[n + 1] + 3 * q * q * t * curves[n + 3] + 3 * q * t * t * curves[n + 5] + t ** 3 * curves[n + 7] };
}
export function trimmedCubic(curves, n, a = 0, b = 1) {
  const first = cubicPoint(curves, n, a), last = cubicPoint(curves, n, b), span = b - a;
  const derivative = (t, axis) => {
    const q = 1 - t;
    return 3 * (q * q * (curves[n + 2 + axis] - curves[n + axis]) + 2 * q * t * (curves[n + 4 + axis] - curves[n + 2 + axis]) + t * t * (curves[n + 6 + axis] - curves[n + 4 + axis]));
  };
  return [first.x + derivative(a, 0) * span / 3, first.y + derivative(a, 1) * span / 3,
    last.x - derivative(b, 0) * span / 3, last.y - derivative(b, 1) * span / 3, last.x, last.y];
}
export function segmentAtTime(points, time) {
  let low = 0, high = points.length - 1;
  while (high - low > 1) { const mid = (low + high) >> 1; if (points[mid].t > time) high = mid; else low = mid; }
  return low;
}

// A Bezier stays inside its control-point hull. The last intersecting hull
// is therefore an exact drawing bound; simulation and dot carriers stay full.
export function visibleEndTime(points, curves, width, height, bleed = 2) {
  for (let i = points.length - 2; i >= 0; i--) {
    const n = i * 8;
    if (Math.max(curves[n], curves[n+2], curves[n+4], curves[n+6]) < -bleed
      || Math.min(curves[n], curves[n+2], curves[n+4], curves[n+6]) > width + bleed
      || Math.max(curves[n+1], curves[n+3], curves[n+5], curves[n+7]) < -bleed
      || Math.min(curves[n+1], curves[n+3], curves[n+5], curves[n+7]) > height + bleed) continue;
    return points[i + 1].t;
  }
  return 0;
}

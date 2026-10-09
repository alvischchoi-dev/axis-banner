// A streak lives until its whole body has left the visible trajectory. The
// leading tip crossing the core must not reset the still-visible tail.
export function streakHead(phase, duration, length, flow) {
  const time = phase * (duration + length);
  return flow === 'converge' ? time - length : time;
}

export function streakPhase(phase, dt, duration, length, flow) {
  const direction = flow === 'converge' ? -1 : 1;
  return (phase + direction * dt / (duration + length) + 1) % 1;
}

export function visibleInterval(head, length, duration, flow) {
  const tail = head + (flow === 'converge' ? length : -length);
  const start = Math.max(0, Math.min(head, tail));
  const end = Math.min(duration, Math.max(head, tail));
  return { start, end, length: Math.max(0, end - start) };
}

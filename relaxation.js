import { responseKernel, settleNode } from './inertia.js?revision=d6dc44b14a08';

export const RETURN_RESPONSE = Object.freeze({
  // Faster attraction uses a lower return ratio to retain the prior unwind.
  localRatio: .40,
  released: 2.4,
  spread: .35,
  dwellWeight: .55,
});

// Attraction follows promptly; returning to the original path has its own
// slower spring. The released response is independent of cursor reaction
// speed, and a charged hover leaves a longer unwind. Never reset velocity.
export function filamentResponse(dt, followOmega, released = false, charge = 0, variation = .5) {
  const returnOmega = released
    ? (RETURN_RESPONSE.released + RETURN_RESPONSE.spread * variation) / (1 + RETURN_RESPONSE.dwellWeight * charge)
    : followOmega * RETURN_RESPONSE.localRatio;
  return {
    followOmega, returnOmega,
    follow: responseKernel(dt, followOmega, 1),
    returning: responseKernel(dt, returnOmega, 1),
  };
}

export function settleFilamentNode(nodes, index, targetX, targetY, dt, response, released = false) {
  const returning = released || (targetX === 0 && targetY === 0);
  settleNode(nodes, index, targetX, targetY, dt,
    returning ? response.returnOmega : response.followOmega,
    returning ? response.returning : response.follow);
}

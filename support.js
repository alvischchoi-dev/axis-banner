// Reuse a support box so unchanged, distant nodes need no force samples.
// Velocities and displaced nodes still settle even after a source departs.
function include(box, ray, source, radius, active) {
  if (!active) return;
  const along = Math.max(0, source.x * ray.cos + source.y * ray.sin);
  const dx = source.x - along * ray.cos, dy = source.y - along * ray.sin;
  if (dx * dx + dy * dy >= radius * radius) return;
  box.lowX = Math.min(box.lowX, source.x - radius);
  box.highX = Math.max(box.highX, source.x + radius);
  box.lowY = Math.min(box.lowY, source.y - radius);
  box.highY = Math.max(box.highY, source.y + radius);
  box.active = true;
}
export function supportBounds(ray, cursor, fields, placements, box = {}) {
  box.lowX = box.lowY = Infinity; box.highX = box.highY = -Infinity; box.active = false;
  include(box, ray, cursor, cursor.radius, cursor.influence >= .003);
  for (const well of fields) include(box, ray, well, well.radius, well.influence >= .003);
  for (const placement of placements) include(box, ray, placement, .6, true);
  return box;
}

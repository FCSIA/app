export type Point = { x: number; y: number };
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export const pathLength = (path: Point[]) => path.slice(1).reduce((sum, point, i) => sum + distance(path[i], point), 0);

/** Add a head position, preserve corners, and trim only the tail. */
export function moveSnakePath(path: Point[], head: Point, length: number): Point[] {
  const result = [head];
  // Straight movement extends the first segment instead of accumulating a
  // vertex on every animation frame.
  const first = path[0];
  const second = path[1];
  const straight = second && ((head.x === first.x && first.x === second.x) || (head.y === first.y && first.y === second.y));
  const route = straight ? path.slice(1) : path;
  let remaining = length;
  for (const point of route) {
    const last = result[result.length - 1];
    const segment = distance(last, point);
    if (segment < 0.000001) continue;
    if (segment >= remaining) {
      result.push({ x: last.x + (point.x - last.x) * remaining / segment, y: last.y + (point.y - last.y) * remaining / segment });
      break;
    }
    result.push(point);
    remaining -= segment;
  }
  return result;
}

/** Minimum centerline distance, optionally skipping the connected neck. */
export function distanceToPath(point: Point, path: Point[], skip = 0): number {
  let nearest = Infinity;
  for (let i = 1; i < path.length; i++) {
    let a = path[i - 1];
    const b = path[i];
    const segment = distance(a, b);
    if (segment < 0.000001) continue;
    if (skip >= segment) { skip -= segment; continue; }
    if (skip > 0) {
      a = { x: a.x + (b.x - a.x) * skip / segment, y: a.y + (b.y - a.y) * skip / segment };
      skip = 0;
    }
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const fraction = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)));
    nearest = Math.min(nearest, distance(point, { x: a.x + dx * fraction, y: a.y + dy * fraction }));
  }
  return nearest;
}

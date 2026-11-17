import { describe, expect, it } from "vitest";
import { distanceToPath, moveSnakePath, pathLength } from "./snake-motion";

describe("snake path", () => {
  it("extends straight segments without accumulating per-frame vertices", () => {
    let path = [{ x: 5.5, y: 4.5 }, { x: 3.5, y: 4.5 }];
    for (let i = 1; i <= 100; i++) path = moveSnakePath(path, { x: 5.5 + i / 100, y: 4.5 }, 2);
    expect(path).toHaveLength(2);
    expect(pathLength(path)).toBeCloseTo(2);
  });
  it("keeps right-angle corners and trims only the tail", () => {
    const path = moveSnakePath([{ x: 5.5, y: 4.5 }, { x: 3.5, y: 4.5 }], { x: 5.5, y: 4.25 }, 2);
    expect(path).toEqual([{ x: 5.5, y: 4.25 }, { x: 5.5, y: 4.5 }, { x: 3.75, y: 4.5 }]);
    expect(pathLength(path)).toBeCloseTo(2);
  });
  it("grows gradually by keeping the tail still", () => {
    const path = moveSnakePath([{ x: 5.5, y: 4.5 }, { x: 3.5, y: 4.5 }], { x: 5.75, y: 4.5 }, 3);
    expect(path.at(-1)).toEqual({ x: 3.5, y: 4.5 });
    expect(pathLength(path)).toBeCloseTo(2.25);
  });
  it("measures occupied segments and can exclude the connected neck", () => {
    const path = [{ x: 5.5, y: 4.5 }, { x: 3.5, y: 4.5 }];
    expect(distanceToPath({ x: 4.5, y: 4.75 }, path)).toBeCloseTo(0.25);
    expect(distanceToPath(path[0], path, 1.25)).toBeCloseTo(1.25);
    expect(distanceToPath(path[0], path, 3)).toBe(Infinity);
  });
});

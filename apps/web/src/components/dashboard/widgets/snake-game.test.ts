import { describe, expect, it } from "vitest";
import { advanceSnake, createSnakeGame, snakeSnapshot, steerSnake, tickMs, type Direction } from "./snake-game";
import { pathLength } from "./snake-motion";

function playing(score = 0) {
  const game = createSnakeGame(64, 64);
  game.status = "playing";
  game.food = 0;
  game.score = score;
  return game;
}
const headDistance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe("continuous Snake simulation", () => {
  it.each([0, 8, 80])("applies a first turn at every sampled phase of the movement interval (score %i)", score => {
    for (const phase of [0, 0.1, 0.5, 0.9]) {
      const game = playing(score);
      let delay = phase * tickMs(score);
      while (delay > 0) { const elapsed = Math.min(delay, 16); advanceSnake(game, elapsed); delay -= elapsed; }
      const before = { ...game.path[0] };
      steerSnake(game, "up");
      advanceSnake(game, 1000 / 60);
      expect(game.direction).toBe("up");
      expect(game.path[0].x).toBeCloseTo(before.x);
      expect(game.path[0].y).toBeCloseTo(before.y - (1000 / 60) / tickMs(score));
    }
  });

  it.each([0, 8, 80])("rapid steering has exactly the same travel budget as straight movement (score %i)", score => {
    const straight = playing(score);
    const turning = playing(score);
    let straightTravel = 0;
    let turningTravel = 0;
    // A staircase stays clear of the growing body at every tested score.
    const directions: Direction[] = ["up", "right"];
    for (let i = 0; i < 80; i++) {
      const before = { ...straight.path[0] };
      advanceSnake(straight, 10);
      straightTravel += headDistance(before, straight.path[0]);
      steerSnake(turning, directions[i % directions.length]);
      // Substeps expose path distance even on a frame that crosses a corner.
      for (let j = 0; j < 10; j++) {
        const previous = { ...turning.path[0] };
        advanceSnake(turning, 1);
        turningTravel += headDistance(previous, turning.path[0]);
      }
      expect(turning.status).toBe("playing");
      expect(turningTravel).toBeCloseTo(straightTravel, 6);
    }
  });

  it("buffers quick combinations without reversing or creating a tiny U-turn", () => {
    const game = playing();
    steerSnake(game, "left");
    expect(game.turns).toEqual([]);
    steerSnake(game, "up");
    steerSnake(game, "left");
    steerSnake(game, "down");
    expect(game.turns).toEqual(["up", "left"]);
    advanceSnake(game, 16);
    expect(game.direction).toBe("up");
    for (let i = 0; i < 11; i++) advanceSnake(game, 16);
    expect(game.direction).toBe("left");
    expect(game.status).toBe("playing");
    expect(pathLength(game.path)).toBeCloseTo(2);
  });

  it("does not move while paused and resumes from exactly the same position", () => {
    const game = playing();
    advanceSnake(game, 16);
    game.status = "paused";
    const before = structuredClone(game);
    steerSnake(game, "up");
    expect(advanceSnake(game, 10000)).toBe(false);
    expect(game).toEqual(before);
    game.status = "playing";
    advanceSnake(game, 16);
    expect(game.path[0].x - before.path[0].x).toBeCloseTo(16 / 180);
  });

  it("grows, places food away from the body, and changes speed only after eating", () => {
    const game = playing();
    const head = game.path[0];
    game.food = Math.floor(head.y) * game.width + Math.floor(head.x) + 1;
    const initialTail = { ...game.path.at(-1)! };
    let changed = false;
    for (let i = 0; i < 7; i++) changed = advanceSnake(game, 16, () => 0) || changed;
    expect(changed).toBe(true);
    expect(game.score).toBe(1);
    expect(game.food).toBe(0);
    expect(pathLength(game.path)).toBeGreaterThan(2);
    // Tail stops receding once growth begins, rather than teleporting.
    expect(game.path.at(-1)!.x).toBeGreaterThanOrEqual(initialTail.x);
    expect(tickMs(game.score)).toBeLessThan(tickMs(0));
    expect(snakeSnapshot(game)).toEqual({ score: 1, food: 0, status: "playing" });
  });

  it("detects walls and self collision without advancing through them", () => {
    const wall = playing();
    wall.path = [{ x: 63.55, y: 10.5 }, { x: 61.55, y: 10.5 }];
    expect(advanceSnake(wall, 16)).toBe(true);
    expect(wall.status).toBe("over");
    const self = playing();
    self.path = [{ x: 10.5, y: 10.5 }, { x: 8.5, y: 10.5 }, { x: 8.5, y: 8.5 }, { x: 12.5, y: 8.5 }, { x: 12.5, y: 11.5 }, { x: 11, y: 11.5 }, { x: 11, y: 9.5 }];
    expect(advanceSnake(self, 16)).toBe(true);
    expect(self.status).toBe("over");
  });

  it("bounds a stalled frame instead of jumping forward by seconds", () => {
    const game = playing();
    const before = { ...game.path[0] };
    advanceSnake(game, 10000);
    expect(headDistance(before, game.path[0])).toBeCloseTo(50 / 180);
  });
});

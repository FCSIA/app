import { afterEach, describe, expect, it, vi } from "vitest";
import { startSnakeClock } from "./snake-clock";
import { advanceSnake, createSnakeGame, steerSnake } from "./snake-game";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function frameDriver() {
  let now = 0;
  let id = 0;
  const frames = new Map<number, FrameRequestCallback>();
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++id, callback); return id; });
  vi.stubGlobal("cancelAnimationFrame", (handle: number) => frames.delete(handle));
  return (elapsed: number) => {
    now += elapsed;
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach(frame => frame(now));
  };
}

describe("snake frame clock", () => {
  it("steers and draws on the very next frame without adding travel", () => {
    const frame = frameDriver();
    const game = createSnakeGame(64, 64);
    game.status = "playing";
    game.food = 0;
    const drawn: { x: number; y: number }[] = [];
    const clock = startSnakeClock(elapsed => { advanceSnake(game, elapsed); drawn.push({ ...game.path[0] }); });
    frame(16);
    const before = { ...game.path[0] };
    steerSnake(game, "up");
    frame(16);
    expect(drawn.at(-1)?.x).toBeCloseTo(before.x);
    expect(drawn.at(-1)?.y).toBeCloseTo(before.y - 16 / 180);
    clock.stop();
  });
  it("cancels discarded StrictMode mounts and stops all subsequent updates", () => {
    const frame = frameDriver();
    const move = vi.fn();
    startSnakeClock(move).stop();
    const clock = startSnakeClock(move);
    frame(16);
    expect(move).toHaveBeenCalledExactlyOnceWith(16);
    clock.stop();
    frame(1000);
    expect(move).toHaveBeenCalledTimes(1);
  });
  it("starts a fresh time baseline after resume", () => {
    const frame = frameDriver();
    const move = vi.fn();
    startSnakeClock(move).stop();
    frame(10000);
    const clock = startSnakeClock(move);
    frame(16);
    expect(move).toHaveBeenCalledExactlyOnceWith(16);
    clock.stop();
  });
});

import { distanceToPath, moveSnakePath, type Point } from "./snake-motion";

export type Direction = "up" | "down" | "left" | "right";
export type SnakeStatus = "ready" | "playing" | "paused" | "over" | "won";
export type SnakeSnapshot = { food: number; score: number; status: SnakeStatus };
export type SnakeGame = SnakeSnapshot & {
  width: number;
  height: number;
  path: Point[];
  direction: Direction;
  turns: Direction[];
  sinceTurn: number;
};
const opposite: Record<Direction, Direction> = { up: "down", down: "up", left: "right", right: "left" };
const velocity = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

export const tickMs = (score: number) => Math.round(80 + 100 * Math.exp(-score / 8));
export const snakeSnapshot = ({ food, score, status }: SnakeGame): SnakeSnapshot => ({ food, score, status });

export function createSnakeGame(width: number, height: number): SnakeGame {
  const x = Math.floor(width / 2) + 0.5;
  const y = Math.floor(height / 2) + 0.5;
  return {
    width, height, path: [{ x, y }, { x: x - 2, y }], direction: "right",
    turns: [], sinceTurn: 1, food: Math.floor(y) * width + Math.floor(x) + 3,
    score: 0, status: "ready",
  };
}

export function steerSnake(game: SnakeGame, direction: Direction) {
  if (game.status !== "playing") return;
  const last = game.turns.at(-1) ?? game.direction;
  if (direction === last || direction === opposite[last] || game.turns.length >= 2) return;
  game.turns.push(direction);
}

/** One authoritative movement pass. Input changes heading, never distance.
 * The first turn starts at the visible head on the next frame. Consecutive
 * turns retain a cell of clearance to keep rapid combos from folding the body.
 */
export function advanceSnake(game: SnakeGame, elapsedMs: number, random = Math.random): boolean {
  if (game.status !== "playing") return false;
  const beforeScore = game.score;
  let remainingMs = Math.max(0, Math.min(50, elapsedMs));
  while (remainingMs > 0.000001 && game.status === "playing") {
    if (game.turns.length && game.sinceTurn >= 1 - 0.000001) {
      game.direction = game.turns.shift()!;
      game.sinceTurn = 0;
    }
    const duration = tickMs(game.score);
    let distance = Math.min(0.1, remainingMs / duration);
    if (game.turns.length && game.sinceTurn < 1) distance = Math.min(distance, 1 - game.sinceTurn);
    const head = game.path[0];
    const delta = velocity[game.direction];
    const next = { x: head.x + delta.x * distance, y: head.y + delta.y * distance };
    // The same radius is used for the visible body (0.82 cell wide).
    if (next.x < 0.41 || next.x > game.width - 0.41 || next.y < 0.41 || next.y > game.height - 0.41 || distanceToPath(next, game.path, 1.25) < 0.76) {
      game.status = "over";
      break;
    }
    const food = { x: game.food % game.width + 0.5, y: Math.floor(game.food / game.width) + 0.5 };
    const eating = Math.hypot(next.x - food.x, next.y - food.y) <= 0.5;
    if (eating) game.score++;
    game.path = moveSnakePath(game.path, next, game.score + 2);
    game.sinceTurn += distance;
    remainingMs -= distance * duration;
    if (eating) {
      const free = Array.from({ length: game.width * game.height }, (_, cell) => cell).filter(cell =>
        distanceToPath({ x: cell % game.width + 0.5, y: Math.floor(cell / game.width) + 0.5 }, game.path) > 0.91);
      if (!free.length || game.score >= game.width * game.height - 3) game.status = "won";
      else game.food = free[Math.min(free.length - 1, Math.floor(random() * free.length))];
    }
  }
  return game.score !== beforeScore || game.status !== "playing";
}

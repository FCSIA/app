"use client";

import { useLayoutEffect, useRef } from "react";
import { advanceSnake, snakeSnapshot, type SnakeGame, type SnakeSnapshot } from "./snake-game";
import { startSnakeClock } from "./snake-clock";

const rotation = { right: 0, down: 90, left: 180, up: 270 };

/** Draw the authoritative simulation directly: no trailing interpolation clock. */
export function SnakeBody({ simulation, playing, onChange }: {
  simulation: SnakeGame;
  playing: boolean;
  onChange: (snapshot: SnakeSnapshot) => void;
}) {
  const body = useRef<SVGPolylineElement>(null);
  const eyes = useRef<SVGGElement>(null);

  useLayoutEffect(() => {
    const draw = () => {
      const { path, direction } = simulation;
      body.current?.setAttribute("points", path.map(({ x, y }) => `${x},${y}`).join(" "));
      eyes.current?.setAttribute("transform", `translate(${path[0].x} ${path[0].y}) rotate(${rotation[direction]})`);
    };
    draw();
    if (!playing) return;
    // Movement is essential gameplay, including under reduced motion. There is
    // no decorative tween or second animation that can delay a player's turn.
    const clock = startSnakeClock(elapsed => {
      const changed = advanceSnake(simulation, elapsed);
      draw();
      if (changed) onChange(snakeSnapshot(simulation));
    });
    return () => clock.stop();
  }, [simulation, playing, onChange]);

  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 size-full" viewBox={`0 0 ${simulation.width} ${simulation.height}`}>
      <polyline ref={body} fill="none" className="stroke-primary" strokeWidth="0.82" strokeLinecap="round" strokeLinejoin="round" />
      <g ref={eyes} className="fill-primary-foreground">
        <circle cx="0.14" cy="-0.16" r="0.055" />
        <circle cx="0.14" cy="0.16" r="0.055" />
      </g>
    </svg>
  );
}

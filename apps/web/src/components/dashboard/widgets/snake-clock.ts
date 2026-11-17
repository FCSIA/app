/** A single frame clock drives both simulation and drawing. */
export function startSnakeClock(frame: (elapsedMs: number) => void) {
  let stopped = false;
  let previous = performance.now();
  let handle: number;
  const advance = (now: number) => {
    if (stopped) return;
    const elapsed = Math.max(0, now - previous);
    previous = now;
    frame(elapsed);
    if (!stopped) handle = requestAnimationFrame(advance);
  };
  handle = requestAnimationFrame(advance);
  return {
    stop() { stopped = true; cancelAnimationFrame(handle); },
  };
}

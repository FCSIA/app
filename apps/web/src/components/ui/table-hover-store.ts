/** Table-local hover publication; geometry and exact-hit activation stay in IA's hook. */
export function createTableHoverStore() {
  let active: number | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => active,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    set(next: number | null) {
      if (next === active) return;
      active = next;
      listeners.forEach((listener) => listener());
    },
  };
}

/** 2 lifts text and hides the border; 1 only hides the adjoining border. */
export function tableRowHoverState(active: number | null, index?: number) {
  if (active === null) return 0;
  if (index === undefined) return active === 0 ? 1 : 0;
  if (index === active) return 2;
  return index === active - 1 ? 1 : 0;
}

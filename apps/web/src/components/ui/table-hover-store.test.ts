import { describe, expect, test } from 'vitest';
import { createTableHoverStore, tableRowHoverState } from './table-hover-store';

describe('Table selective hover snapshots', () => {
  test('only changed row snapshots invalidate when moving across a large table', () => {
    const store = createTableHoverStore();
    const indices = [undefined, ...Array.from({ length: 250 }, (_, i) => i)];
    let snapshots = indices.map(i => tableRowHoverState(store.get(), i));
    const changed: number[] = [];
    const unsubscribe = store.subscribe(() => {
      const next = indices.map(i => tableRowHoverState(store.get(), i));
      changed.push(next.filter((value, i) => value !== snapshots[i]).length);
      snapshots = next;
    });
    store.set(100);
    store.set(101);
    store.set(101);
    store.set(null);
    expect(changed).toEqual([2, 3, 2]);
    unsubscribe();
    store.set(0);
    expect(changed).toHaveLength(3);
  });

  test('header border responds only to the first row; clearing restores every border', () => {
    expect(tableRowHoverState(0)).toBe(1);
    expect(tableRowHoverState(1)).toBe(0);
    expect(tableRowHoverState(1, 0)).toBe(1);
    expect(tableRowHoverState(1, 1)).toBe(2);
    expect(tableRowHoverState(null, 1)).toBe(0);
    expect(createTableHoverStore().get()).toBeNull();
  });
});

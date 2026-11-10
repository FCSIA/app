// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import {
  useDataTable,
  DataTable,
  DataTableColumnHeader,
  DataTableSearch,
  DataTablePagination,
  selectColumn,
  type ColumnDef,
} from './data-table';
import type { RowModel, Table } from '@tanstack/react-table';

type Person = { id: string; name: string };
const people = [
  { id: 'owner', name: 'Zoe' },
  { id: 'member', name: 'Ada' },
  { id: 'guest', name: 'Ben' },
];
const columns: ColumnDef<Person>[] = [
  selectColumn<Person>(),
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
  },
];
let table: Table<Person>;
let root: Root;
let container: HTMLDivElement;
function Fixture({ remote = false }: { remote?: boolean }) {
  table = useDataTable({
    data: people,
    columns,
    pageSize: 2,
    getRowId: (row) => row.id,
    enableRowSelection: (row) => row.original.id !== 'owner',
    manualPagination: remote,
  });
  return (
    <>
      <DataTableSearch table={table} />
      <DataTable table={table} />
      {!remote && <DataTablePagination table={table} />}
    </>
  );
}
beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(window, 'matchMedia', {
    value: vi.fn(() => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    })),
  });
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
    unobserve() {}
  };
});
afterEach(async () => {
  if (root) await act(() => root.unmount());
  container?.remove();
});
async function mount(remote = false) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(() => root.render(<Fixture remote={remote} />));
}
// TanStack lazily computes row models and queues pagination resets. Read them
// inside act so those queued state updates settle before the next interaction.
async function rowIds(model: () => RowModel<Person> = () => table.getRowModel()) {
  let ids: string[] = [];
  await act(async () => {
    ids = model().rows.map((row) => row.id);
  });
  return ids;
}
test('native sorting, search and pagination use accessor values and stable row IDs', async () => {
  await mount();
  expect(await rowIds()).toEqual([
    'owner',
    'member',
  ]);
  await act(() =>
    Array.from(container.querySelectorAll<HTMLButtonElement>('thead button'))
      .find((button) => button.textContent === 'Name')!
      .click(),
  );
  expect(await rowIds()).toEqual([
    'member',
    'guest',
  ]);
  await act(() => table.nextPage());
  expect(await rowIds()).toEqual(['owner']);
  const search = container.querySelector<HTMLInputElement>(
    'input[type="search"]',
  )!;
  await act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )!.set!.call(search, 'Ada');
    search.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(await rowIds(() => table.getFilteredRowModel())).toEqual([
    'member',
  ]);
  expect(container.textContent).toContain('Ada');
});
test('native select-all respects permission predicates across all loaded pages', async () => {
  await mount();
  await act(() => table.toggleAllRowsSelected(true));
  expect(table.getState().rowSelection).toEqual({ member: true, guest: true });
  expect(table.getRow('owner').getCanSelect()).toBe(false);
  await act(() => table.nextPage());
  expect(await rowIds(() => table.getSelectedRowModel())).toEqual([
    'member',
    'guest',
  ]);
});
test('manual cursor pages are not sliced again by the client', async () => {
  await mount(true);
  expect(table.getRowModel().rows).toHaveLength(3);
  expect(container.querySelector('tbody')!.rows).toHaveLength(3);
});

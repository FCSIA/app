import { format } from 'date-fns';

export const AUDIT_FETCH_LIMIT = 50;

export function formatRoleLabel(role: string) {
  return role.replace(/_/g, ' ');
}

export function formatPathwayLabel(pathway?: string | null) {
  return pathway ? pathway.replace(/_/g, ' ') : '—';
}

export function formatDateTime(value?: string | number | null) {
  if (!value) return 'Never';
  return format(new Date(value), 'MMM d, yyyy h:mm a');
}

/** Compact table date: "Nov 4" this year, "Nov 4, 2025" otherwise. */
export function formatShortDate(value: string | number) {
  const date = new Date(value);
  return format(
    date,
    date.getFullYear() === new Date().getFullYear() ? 'MMM d' : 'MMM d, yyyy',
  );
}

export function refreshWrappedResultTitle(generated: number, skipped: number) {
  if (generated === 0 && skipped > 0) return 'Wrapped snapshots already current';
  return `Generated ${generated} Wrapped snapshot${generated === 1 ? '' : 's'}`;
}


export function escapeCsvCell(value: unknown) {
  const rawValue = String(value ?? '');
  const stringValue = /^[\t ]*[=+\-@]/.test(rawValue) ? `'${rawValue}` : rawValue;
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export function downloadCsv(filename: string, rows: Array<Array<unknown>>, headers: string[]) {
  const content = [
    headers.map((header) => escapeCsvCell(header)).join(','),
    ...rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(',')),
  ].join('\n');

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

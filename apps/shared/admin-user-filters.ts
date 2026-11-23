import { GRADE_LEVELS, PATHWAY_OPTIONS } from './labels';
import { APP_ROLES, ROLE_LABELS } from './roles';

const choices = (...pairs: [string, string][]) => pairs.map(([value, label]) => ({ value, label }));

export const USER_FILTERS = {
  grade: { label: 'Grade', any: 'Any grade', options: GRADE_LEVELS.map((grade) => ({ value: String(grade), label: `Grade ${grade}` })) },
  major: { label: 'Major', any: 'Any major', options: PATHWAY_OPTIONS },
  minor: { label: 'Minor', any: 'Any minor', options: PATHWAY_OPTIONS },
  role: { label: 'Role', any: 'Any role', options: APP_ROLES.map((value) => ({ value, label: ROLE_LABELS[value] })) },
  status: { label: 'Status', any: 'Any status', options: choices(['active', 'Active'], ['inactive', 'Inactive']) },
  flex: { label: 'Flex credits', any: 'Any progress', options: choices(['none', 'No credits'], ['in-progress', 'In progress'], ['complete', 'Requirement met']) },
  password: { label: 'Password', any: 'Any password state', options: choices(['reset', 'Reset required'], ['ready', 'Ready']) },
};

export type UserFilter = keyof typeof USER_FILTERS;
export const USER_FILTER_KEYS = Object.keys(USER_FILTERS) as UserFilter[];
export type UserFilters = Partial<Record<UserFilter, string[]>>;
export type UserSearchTerm = { field: UserFilter | 'text' | 'name' | 'id' | 'email'; value: string; exclude: boolean };

const normalize = (value: string) => value.trim().toLowerCase().replace(/[ _-]+/g, '');
const isFilter = (field: string): field is UserFilter => Object.hasOwn(USER_FILTERS, field);

export function parseUserSearch(input: string): { terms: UserSearchTerm[]; error?: string } {
  if (input.length > 500) return { terms: [], error: 'Keep search under 500 characters.' };
  const terms: UserSearchTerm[] = [];
  const pattern = /(-?)(?:([a-z]+):)?("(?:[^"\\]|\\["\\])*"|(?!-?[a-z]+:")[^\s"]+)/giy;
  let position = 0;
  while (position < input.length) {
    if (/\s/.test(input[position]!)) {
      position++;
      continue;
    }
    pattern.lastIndex = position;
    const match = pattern.exec(input);
    if (!match || (pattern.lastIndex < input.length && !/\s/.test(input[pattern.lastIndex]!))) {
      return { terms: [], error: 'Close quoted phrases and separate terms with spaces.' };
    }
    position = pattern.lastIndex;
    const field = match[2]?.toLowerCase() ?? 'text';
    const raw = match[3]!;
    const value = raw.startsWith('"') ? raw.slice(1, -1).replace(/\\(["\\])/g, '$1').trim() : raw;
    if (!value || /^[a-z]+:$/i.test(value)) return { terms: [], error: 'Enter a value after the field name.' };
    if (isFilter(field)) {
      const option = USER_FILTERS[field].options.find((option) =>
        normalize(option.value) === normalize(value) || normalize(option.label) === normalize(value),
      );
      if (!option) return { terms: [], error: `Choose a value for ${USER_FILTERS[field].label.toLowerCase()}.` };
      terms.push({ field, value: option.value, exclude: match[1] === '-' });
    } else if (field === 'text' || field === 'name' || field === 'id' || field === 'email') {
      terms.push({ field, value, exclude: match[1] === '-' });
    } else {
      return { terms: [], error: `Unknown search field “${field}”.` };
    }
    if (terms.length > 20) return { terms: [], error: 'Use at most 20 search terms.' };
  }
  return { terms };
}

# DataTable integration and upstream proposal

The November 9 registry install uses the project's Radix flavor, Tailwind v4,
`@/` alias and Inter variable font. Shared Fluid dependency updates are retained.
No issue, message or PR has been sent upstream.

## What is installed

DataTable's runtime source is the published registry source. The only local
change is removing one ESLint suppression for `react-hooks/incompatible-library`:
the project's older ESLint plugin does not define that rule. The existing
`"use no memo"` directives remain. See `data-table-installed.diff` for the entire
difference. There are no local DataTable geometry, search, header, menu or row
height overrides.

Audit, users, feedback, moderation, analytics table views and CSV previews use
`useDataTable`, stable record IDs and column definitions with real accessors.
`AdminDataTable` is the documented search / columns / table / pagination
composition; it receives a table instance and owns no feature data or state.
Audit uses its existing server search, query syntax, date/person/action/record
filters and detail sheet. Desktop filter menus remain beside their headers;
the phone drawer remains phone-only. Audit keeps the backend's newest-first
order rather than presenting a sort of one fetched subset as a global sort.

Users keep server cursor paging and selection keyed by user IDs. The custom
footer remains an explicit product cursor footer; no TanStack methods are
replaced. Audit uses native pages over explicitly labeled loaded records and
an explicit Load older activity action. CSV and analytics use client paging,
sorting and filtering. Feedback and moderation retain their existing product
search predicates, queue/status actions, dialogs and pending states.

## Why hover and selection radii differed

Fluid's rounded shape uses the `rounded-lg` class for hover and numeric `8` for
animated selections. This app had remapped `--radius-lg` to its legacy
`--radius: 1rem`: hover became 16px while selection stayed 8px. The header's
pressed layer uses that same named class, so changing only the hover component
would have left another mismatch. The app's shared Tailwind radius ladder now
uses 4/6/8px for sm/md/lg, matching Fluid. No component-specific radius override
is needed. A regression compiles the actual app CSS and compares hover and
pressed radii with Fluid's numeric selection radius.

Other narrow dependency adaptations: full-color references in Button, Badge
and Switch use the app's existing `--color-*` bridge to HSL theme channels;
DropdownContent forwards Radix `onCloseAutoFocus`, preserving focus handoff to
composers and the custom date-range popup. Existing adapted Dialog, DatePicker,
Calendar, CommandMenu, ScrollArea and Tabs contracts remain in place.

## Proposed DataTableColumnHeader addition — not applied

`ColumnDef.header` already accepts arbitrary React content. Custom filters do
not require changing the DataTable renderer. IA currently composes the same
approved label + Fluid filter button + DropdownContent pattern through that
slot. A small upstream API would centralize that anatomy and avoid each app
recreating the trigger wiring:

```tsx
<DataTableColumnHeader
  column={column}
  title="Person"
  filter={{
    active: Boolean(actorId),
    content: <DropdownContent>{personFilterItems}</DropdownContent>,
  }}
/>
```

The proposed optional `filter` contains `active`, an optional accessible `label`,
and `content`. The title keeps Fluid's existing three-state sorting and
Shift-click behavior. The adjacent native filter trigger owns its own menu,
focus and active state. Unsortable columns can still filter. No change is
required at existing callsites. Exact draft source changes are in
`data-table-header-filter.proposal.patch` (paths target our installed copy).
This is a review proposal, not a tested or installed extension.

Custom ordering already fits TanStack's public `sortingFn`, controlled
`state.sorting`, `onSortingChange` and `manualSorting` options through
`useDataTable`; another sort callback in the header would duplicate that state.
A server-backed column should only advertise sorting once its query supports
that order across the full result set.

## Remaining search composition gap

Audit's structured query parser, server search and visible error messages remain.
The old token suggestions (people, actions, record types and dates) are **not
currently present** in native `DataTableSearch`. Its public API cannot forward
input refs, ARIA attributes or input events to `CommandInputSlot`; nesting the
existing search component would give the command the outer span instead of the
actual input. Recreating command keyboard handling at a page would be another
unsafe parallel implementation.

A second upstream proposal is a supported input composition boundary: an input
ref and input props, with composed event handlers, or an input slot that keeps
DataTableSearch's native visual anatomy and table filter binding. It must allow
a combobox to own ARIA/keyboard focus while preserving native search behavior,
including ArrowDown into rows when suggestions are closed. This needs an API
decision and interaction tests before implementation. The header-filter draft
does not solve this gap.

Useful requests to the creator:

- Consider the optional header filter API above, including keyboard, active,
  disabled and open states, and interaction with column dragging/resizing.
- Add the search input composition boundary described above so structured-query
  suggestions can be retained without replacing the native search UI.
- Forward DropdownContent's standard Radix close-focus callback so menu actions
  can transfer focus without app-specific wrappers.
- Document or namespace the radius/color token contract: stock shadcn projects
  often remap Tailwind radius aliases and store colors as HSL channels. Static
  classes and numeric animation values must resolve to the same geometry.

Browser rendering and design-owner review remain separate from TypeScript,
lint, CSS-contract and DOM regression checks.

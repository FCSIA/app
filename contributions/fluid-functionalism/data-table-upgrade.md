# DataTable dependency upgrade and proposed integration

The shared Radix dependency upgrade is local. Admin tables are not migrated yet.
DataTable itself is not installed in the app source; its proposed changes are
reviewable in `data-table-proposed.patch` and have not been applied.

Registry inspected: https://www.fluidfunctionalism.com/r/radix/data-table.json
DataTable source SHA-256: `ae0d433d8a4e7fe7111661127bb71ae5a8a45d7c1807c796739cc2f986bd7a81` (2026-11-09).

## Dependency disposition

Merged newer Table, hover publication, merge/split backgrounds, Checkbox, Input,
Select, Dropdown/MenuItem, Combobox, icon vocabulary, shape and type-scale contracts.
Pinned motion to 12.38.0 to match the existing framer-motion runtime; mismatched
versions produced incompatible animation types across shared consumers.

Preserved project adapters for Button (sizes, badges), Switch (controlled change
callback, native control), Dialog (composition and positioning), CommandMenu
(composed dialog slots), ScrollArea (viewport refs), Tabs (value-based composition),
Calendar/DatePicker (navigation, native reset and disabled serialization), Badge
(HSL tokens and neutral boundaries), and Tooltip (reduced motion).
These adapters already provide the behavior needed by the remaining dependency
family; replacing them with the registry would remove product capabilities.
Kept the existing theme CSS rather than installing upstream global token defaults.
Normalized the registry highlight path to the existing ui adapter.

Table retains interactive/selected row props, header filters, selected semantics,
and inheritable font weights. The newer hover hook publishes per-row snapshots;
a 250-row mounted regression verifies one row commits on entry and only the old
and new row commit on movement, with existing row DOM nodes retained.
Dropdown retains close-focus callbacks and destructive MenuItem semantics.
Select and Dropdown retain reduced-motion popup entry/exit.
Users now passes Checkbox indeterminacy explicitly; Search maps its density into
Input's new default/compact ladder.

## Exact proposed DataTable changes

See `data-table-proposed.patch`. This is an app integration patch, not an
upstream-ready contribution (its active row uses IA's retained TableRow selected
contract, and its Button/Switch changes target IA's existing adapters).

1. Forward aria-label, aria-labelledby, aria-describedby to the native table.
2. Add activeRowId, independent of checkbox selection, and pass an active boolean
   through the memoized row so changing the open record updates affected rows.
3. Integrate Wrap text with IA Switch's onCheckedChange and wrapperClassName.
4. Integrate the bulk-action Button with IA's existing sm/lg size API.

No new invalidation prop is needed: upstream already compares column definitions.
Memoize columns with all external dependencies (drafts, permission state, mutation
state) so closures and memoized cells refresh correctly.
No query, pagination, selection, or business-action engine belongs in DataTable.
Use TanStack manual modes and stable record IDs. Cursor/accumulating views retain
an app footer; upstream DataTablePagination currently computes counts from loaded
rows. Do not use it to imply an exact query-wide total or known last page.
Query-wide select-all requires a server-side selection model; selectColumn only
knows rows present in the supplied data. Keep scope explicit at each callsite.

## Creator requests

Useful reusable upstream additions: native table naming/description props and
an active/current row distinct from checkbox selection. Separately, propose a
server pagination footer contract for known/unknown totals and cursor availability
before using the stock footer with remote data. IA-specific Button/Switch adapter
changes do not require an upstream change.

Material visuals and real-browser/assistive-technology behavior still await human
review. No backend deployment or upstream issue/PR is part of this work.

## Verification

Web typecheck and lint pass; all 38 UI-library regressions pass; production build
passes. The preview starts on port 3000. Browser interaction, authenticated admin
flows and human visual approval have not been performed. The proposed DataTable
patch is a review artifact, not an implemented or behavior-tested migration.

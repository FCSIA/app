# DataTable dependency upgrade and proposed integration

The shared Radix dependency upgrade is local. Admin tables are not migrated yet.
DataTable itself is not installed in the app source. The former proposed source
patch was withdrawn at the owner's request and was never applied.

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

## DataTable source policy

The owner withdrew the proposed source patch on 2026-11-09. It was never applied
and has been removed. Keep DataTable's upstream visuals and documented public
composition. Do not add activeRowId, row visual overrides, or page-level cell
padding to compensate for integration problems. DataTable remains uninstalled;
admin migration is still pending, not represented by this dependency upgrade.

Use column definitions and upstream row-action composition. External cell state
belongs in memoized column dependencies. Use TanStack manual modes and stable
record IDs for remote data; keep cursor pagination in an app footer where needed.
Do not imply that loaded rows are the entire server result.

The audit height regression came from placing a 28px button directly in the new
Table's padded cell. Upstream DataTableRowActions constrains its action to a
`flex h-[1lh] items-center justify-end` wrapper; the audit Details control now
uses the same composition. No row-height or padding override was added.

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
passes. The initial web-only preview failed because the auth backend was offline.
After the owner authorized repair, root `bun run dev` started this checkout's
local deployment `local-ia_app-ia_app-7` on 3210/3211 and web on port 3000.
Convex reports functions ready; GET /login returns HTTP 200. No reset, seed,
shared deployment or production deployment was performed.
Browser interaction, authenticated admin
flows and human visual approval have not been performed. The DataTable migration remains pending.

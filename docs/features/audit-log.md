---
tags: [feature, audit, admin]
---

# Audit Log

[Home](../index.md)

The audit log records significant actions for staff review. Read/unread changes
are personal state and do not create events; historical entries remain available.
Admin-facing reads require ADMIN, SUPER_ADMIN, or SUPPORT_STAFF.

## Review activity

`/admin/audit` opens the log. Legacy `/admin?tab=audit` links still work. Admin
sections use a grouped sidebar on desktop, an icon rail at intermediate widths,
and a section picker on smaller screens. Audit filters remain in the URL when
switching sections.

The table separates When, Person, Action, and Record. Every row is one line.
The Record column shows what the action affected, and each kind of record has
its own shape (`auditRecordView` in `apps/shared/audit-record.ts`) so rows sort
by eye before they are read: another person shows their avatar and opens the
profile preview; the actor's own account reads "Own account"; a message is
quoted behind a rule, after its reaction emoji or a reply mark; feedback shows
its issue number and the status it moved to; a sign-in lock names the locked
account (resolved from its `auth:` key) and the failure count; a named record
is plain text; a record known only by its type is muted. Club and channel
context follow in muted type on wide panes and stay in the opened event.
Columns never widen the table past the pane: long text cuts short instead.
Day headings group events and each row shows the
time to the minute. The expanded row shows seconds, the time-zone offset, and
stored JSON.
Neutral category icons identify six domains: People & access, Clubs & chat,
Announcements, Moderation, Schedules, and Flex & events. Destructive action text
uses the destructive token. Selecting a row or its keyboard-accessible Details
button opens the event; closing Details returns focus to the opener.

Person controls open the shared profile preview with a filter action, full
profile, Open in Users, and Copy ID. Users links open the exact account through
the existing staff permission gate. Live records and parent context are links;
unavailable records keep saved names/previews without a dead primary link.
Original IDs, action codes, metadata, and timestamps remain in the collapsed
Technical details section. Meaningful message changes, CSV counts, role changes,
and other allowlisted metadata are shown outside that section. Whiteboard
snapshots remain available.

On phones, the same native DataTable keeps its column semantics and horizontal
scrolling. Filters are in the desktop toolbar and the phone drawer. The Next
arrow also fetches older activity when it reaches the end of loaded results.

Staff can open **View workshop activity** from a Flex Friday workshop. The link
scopes the log to that workshop’s changes, registrations, cancellations, and
assignments. Each event remains a separate row. New enrollment events save
the workshop ID and title at the time of the event, so a cancellation or rename
doesn’t erase that context. Older enrollment events can be included where the
original registration or assignment still resolves to that workshop, or a
later cancellation saved the workshop ID.

## Filters and search

When, Person, Action, and Record toolbar controls open their own menus.
Category and action checklists support multiple choices: choices within one
checklist combine with OR, and separate filters combine with AND. Category
changes remove selected actions outside the selected domains. Exact person and
record filters use stable IDs. Date controls include both selected local days.
Each explicit filter has a removable chip; Clear all resets the search and fields.

The main search accepts text and structured terms. Typing a supported field
prefix opens Command suggestions for people, actions, types, loaded records,
sources, or date examples. Arrow keys and Enter select a suggestion. Invalid
unfinished queries show an error and keep the last applied URL and results.
Typed fields replace the corresponding explicit field filter; explicit fields
remove corresponding typed terms, avoiding contradictory duplicate controls.

```text
person:"Eniola Famakinwa" action:"Posted a message"
type:message -action:reaction "room assignments"
record:Robotics after:2026-10-01 before:2026-10-02
source:system
```

Supported fields are `person`, `action`, `type`, `record`, `text`, `source`,
`after`, and `before`. Terms combine with AND, match case-insensitive substrings,
and support double-quoted phrases; prefix a term with `-` to exclude it. Plain
words search recorded fields. `source` accepts `person` or `system`. Structured
dates include both UTC calendar days; date-picker fields use local time.
Original action codes remain searchable even if a future code has no registry entry.

`audit_` search parameters store the query, exact actor/record, selected actions
and categories, source, record type, workshop scope, and dates. Reloading or
sharing a valid URL restores those filters. Previous results remain visible while filters refresh,
scoped to the signed-in identity, with an Updating status. Initial loading uses
skeleton rows while retaining the table header.

## Backend and historical rollout

Every application audit writer calls `logAuditEvent` with a required actor ID or
explicit `"system"`. The helper records semantic category, impersonation
provenance, and both aggregate entries atomically. Missing historical actors are
Unknown (not recorded), not automatically System; a missing current actor is a
Former user. System classification requires explicit provenance or a known
automatic action. A source scan test rejects direct domain audit inserts.

`listFilteredPage` chooses indexed workshop, actor, record/type, category,
action, or date ranges. Multiple actions/categories and historical type aliases merge ordered index
streams before pagination. Remaining predicates run before pagination through
`convex-helpers` streams with a 100-audit-row / 2 MiB page read budget. Context
and actor resolution are memoized per request. Selective text searches can
return a partial or empty page at that budget. Next continues the cursor. The
legacy `list` API still hydrates and filters its bounded feed.

The `@convex-dev/aggregate` category and actor indexes provide exact totals for
category, actor, and date filters. Other combinations, including actions, record
type/ID, source, and free text, show a candidate-range denominator explicitly
labelled events in range, not an exact match total. True exact totals for those
predicates need additional aggregate/search indexes or a complete scan; the
current query deliberately avoids an unbounded count scan.

Historical indexing is a separate deployment operation. The bounded, idempotent
`internal.audit.migrations.backfill` processes 100 records per transaction,
backfills category, recovers legacy CLUB_JOINED actors from retained `meta.userId`
when possible, inserts missing aggregate entries, and schedules the next page.
Only completion marks `auditIndexState` key `v1` ready. Until then category queries
fall back to chronological filtering and the UI shows loaded counts. Other lost
human attribution cannot be reconstructed. This repair did not deploy or invoke
the migration. Deploy/run only against an explicitly authorized target.

### Typed events

Every action has one spec in `apps/convex/src/audit/_spec.ts`: the record type
it names and the shape of its `meta`. `logAuditEvent` takes the action and
derives the rest, so writers no longer pass `entityType`, and a `meta` field
the spec doesn't declare fails to typecheck. The table's target validator is
built from the same specs: one variant per action with a literal action,
record type and category. `AUDIT_RECORD_TYPES` in `apps/shared/audit.ts` is the
one spelling of each record type; `AUDIT_ENTITY_TYPES` keeps the older
spellings so filters still match rows not yet migrated. Retired actions
(`ANNOUNCEMENT_READ`, `ANNOUNCEMENT_UNREAD`) stay in the list so stored rows
read and validate, and writers can't log them.

The system marker and the impersonating administrator are top-level fields
(`source`, `impersonatedByUserId`), not `meta`. Role rows record the role's
name (`roleName`) as it was, permission rows whether permissions were granted
or removed (`enabled`), and `schedule.updated` whose schedule it is (`userId`).
The context resolver turns these into `context.person` and a `Role` link, so
the Record column shows "person → role · club" and "Own schedule".

Rollout, one release apart:

1. Deploy this release. The widened validator is enforced and the target is
   staged (`schema.ts`), so the deploy doesn't scan the table.
2. Run `convex run audit/migrations:typeAuditEvents '{"dryRun":true}'`, then
   without `dryRun`. It is idempotent: canonical record types, provenance out
   of `meta`, message counts derived from older rows that stored full text,
   schedule owners, and role names from the role's own create/rename rows.
3. Redeploy unchanged. Fixing rows doesn't clear a failed stage; a redeploy
   re-validates. `npx convex deploy --dry-run` should report it validated.
4. In the next release, replace the enforced validator with
   `auditEventsTargetValidator()`, drop `.staged()`, and drop the reads that
   still accept the old spellings and `meta.auditSource`.

Every row exported from production on 2026-11-25 (2,253) passed the target
validator after this migration in a local dry run; IDs were checked as
strings there, so the staged validation is the check that each names the
right table. Rows written before previews stored the whole message text in
`meta.body`/`previousBody`; the migration keeps a 240-character preview and
the lengths, as newer rows do, and removes the full text.

## Source and API

- Backend: `apps/convex/src/audit/`
- Shared registry, labels, metadata presentation and grammar: `apps/shared/audit.ts`
- Web: `apps/web/src/app/admin/_hooks/use-admin-audit.ts` and `_components/audit/`
- Shared person preview: `apps/web/src/components/users/person-trigger.tsx`
- `api.audit.events.list`: bounded legacy/mobile read
- `api.audit.events.listFilteredPage`: filtered stream-cursor history; each
  request reads at most 100 audit rows or about 2 MiB, so sparse searches can
  return partial or empty pages with a cursor to continue
- `api.audit.events.listPage`: legacy native-cursor history for open clients
- `api.audit.events.listFilterOptions`: static action/type registry
- `api.audit.events.counts`: readiness-gated totals and category facets
- `api.audit.events.get`: full event and record preview

## Related

- [October 22 repair ledger](../reference/ui-audit-log-repairs-2026-10-22.md)
- [October 20 UI review](../reference/audit-ui-review-2026-10-20.md)
- [Users and admin](users-admin.md)
- [Moderation](moderation.md)
- [Indexes and search](../database/indexes-and-search.md)

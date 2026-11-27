# IA App taste file (v0 draft)

Input to ui-proof. One line per rule; every rule says how it's checked. `check:` is a
script in the harness, `question` is asked of the reviewing model, and `eye` means
the owner. `staged` rules warn and `enforced` rules block "done". "From" names the
correction (audit-log-stats/defects.csv ids) or the doc it came from. Draft: the
owner hasn't reviewed it yet. It replaces the taste content of `design-context.md`,
`ui-quality-guide.md` and `design-principles.md`, not the process in
`WEB_UI_WORKFLOW.md`.

## People

Students, teachers, club sponsors and school administrators, through the school day,
on phones and computers. Admin pages are for staff who are not necessarily
technical. Quality bar: flagship, not MVP; readable density; restrained colour.

## Screens

**Audit log** (`/admin/audit`). Who: admins and support staff. Why: see who did
what, to which record, and when; follow up on one person or change. They decide
whether something needs action, then open the person, the record or a filter. Leave
out: request-log detail up front; technical data lives in the opened event.

**Users** (`/admin/users`), still to confirm with the owner. Who: admins and
support staff. Why: find an account and check its roles, status and access. They
decide to change roles, reset a password or deactivate. Leave out: roster detail
columns by default.

## Rules

| id | Rule | Checked by | Stage | From |
|---|---|---|---|---|
| fit-width | No sideways page scroll at 1366px and up; columns cut text before the table widens | check:overflow | enforced | Nov 25 prod, guide §3 |
| one-line-rows | List rows are one line; long content cuts short, never wraps | check:rowHeight | enforced | Nov 25 prod |
| column-balance | No column runs half empty while another cuts text | check:columnDensity | staged | 20 (6 reports) |
| badges-whole | Badges are never cut; the column grows or the table scrolls | check:cutText | enforced | Users, Nov 26 |
| anchors-stable | Opening a menu or panel never shifts the page | eye | staged | 17, design-context |
| sticky | Header row, toolbar and pagination stay in view while the list scrolls; the header never covers a day label | check:sticky | enforced | 35, 38, 46 |
| pagination-close | Pagination sits within 8px of the frame's bottom edge | check:paginationGap | staged | 37 (12px was too far) |
| one-edge-owner | Each edge has one owner: no border on a shadow, no seam where controls join | check:seam | enforced | 16, design-context |
| no-nesting | Nothing opened contains another surface or disclosure | check:nesting | enforced | 06 |
| one-surface-open | An opened event continues the table's surface; no new background or border | question | staged | 08, 15, 27 |
| no-static-shadow | Shadows only on floating things | question | staged | 21, design-principles |
| same-radius | Joined, selected, hover and selection shapes keep the control's radius | check:joinedRadius | staged | 34, 50 |
| top-edge | Raised controls and code blocks have Fluid's 1px reflected top edge | eye | staged | 58, Jamik |
| one-family | The app's font everywhere, previews included | check:fonts | enforced | 03, 52 |
| quiet-hierarchy | Field names muted, values bright; at most three type roles in a detail | question | staged | 02, 29 |
| restrained-hues | Action colours come from theme tones, muted on dark | eye | staged | 12 |
| states-distinct | Tags and badges stay distinct from hover and selection fills | question | staged | 28, design-context |
| earns-its-place | Every word, icon and container earns its place; cut what a non-technical admin wouldn't miss | question | staged | 09, 40, 47, design-context |
| say-once | Each fact appears once per view; the opened item adds detail, never repeats the row | question | staged | 11, 55, design-context |
| icons-distinguish | An icon is only worth its space if it changes with meaning: at most two actions per icon | check:iconShare | enforced | 01 |
| records-differ | In a mixed feed, each kind of record has its own shape | question | staged | 53, design-context |
| audience-real | Name the actual people or owner, never a category or the viewer | question | staged | 57, design-context |
| label-meaning | Column labels say the role ("Actor"), not just the type ("Person") | question | staged | 54 |
| one-entry | One way to reach each filter or action | question | staged | 39, owner's open item |
| truthful-counts | A count says exactly what it counts | question | staged | 41, 47 |
| pointer-on-target | What you can click shows a pointer; the element that responds owns the hover | check:pointer | enforced | 13, design-context |
| no-hover-leak | Pointing at a popup or a separator lights nothing beneath it | check:menuHoverLeak | staged (noisy) | 44, 45 |
| menus-short | Menus never scroll; a long list becomes a search | check:menuScroll | enforced | 07, 42 |
| popovers-contain | Content stays inside its popover | check:popoverOverflow | enforced | 10 |
| shared-picker | Filters and their search use the shared Fluid picker, surface included | eye | staged | 33, 43, 49 |
| quiet-feedback | Copying confirms in place, not with a toast | eye | staged | 31 |
| eased-motion | Opening and closing ease; nothing pops or lags | eye | staged | 19, 22, 32 |
| history-works | Moving between records keeps back and forward working | eye | staged | 25 |

## Accepted exceptions

- The stored-JSON disclosure in an opened audit event (`cca27423`) is allowed by `no-nesting`.

## References

- **Jamik's audit log.** What the owner valued:
  - muted field names with bright values in filter buttons;
  - the 1px reflected top edge;
  - one continuous surface for an opened event;
  - avatars for people;
  - readable verbs.
- **Fluid's rendered examples** for every primitive in use.

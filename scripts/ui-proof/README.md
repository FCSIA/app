# ui-proof: IA adapter

Renders the real admin pages from any commit, the way staff see them: the real
components and app frame, with busy data. Then it checks them and captures every
common state for review. It is the IA part of the `ui-proof` agent skill, which holds
the procedure, the principle cards and the tools that work on any project.

- **Setup:** `bun install` (brings `playwright-core`) and any Chromium. Helium, Chrome
  or Chromium are found automatically; otherwise set `UI_PROOF_BROWSER` or run
  `bunx playwright-core install chromium`.
- **Data:** `data.ts` is invented but shaped like production: about 2,250 audit
  events in production's mix and about 600 users. Never put real names, messages or
  links in it; this repository is public.
- **Stubs:** `stubs/` replaces Convex, auth and the router. Queries return stable
  objects, as Convex does. Totals and counts come from the stub, so confirm any
  finding about counts in the real app.

| Command | What it does |
|---|---|
| `[SECTION=audit\|users] ./rev.sh <commit> <name>` | Builds that commit's admin page into `out/<name>` with `git archive`, so no worktree is needed |
| `[SECTION=…] node states.cjs out/<name> <dir> '<filter query>'` | Captures the fixed set of states (default, each toolbar popup, opened, scrolled, filtered, hovered, 900px), each as a PNG plus an inventory |
| `SECTION=… W=1550 node shoot.cjs out/<name> <pages> <label>` | Pages through results: sideways overflow, row heights, text cut per column |
| `node probe.cjs out/<name>` | Audit page: icon reuse, menu scroll, popover overflow, filter seam, nested surfaces |
| `node probe2.cjs out/<name>` | Audit page: column density, pointer on triggers, sticky header and toolbar, pagination gap, joined radius, narrow detail, hover leaks |

`taste.md` is IA's taste file. It is a draft for the design owner to review. Each
rule says how it is checked: a script here, a question for a reviewing model, or
the owner's eye.

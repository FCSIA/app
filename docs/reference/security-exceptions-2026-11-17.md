---
tags: [reference, security, dependencies]
---

# Dependency audit reassessment, November 17, 2026

Contributor Validation [43985567802](https://github.com/FCSIA/ia-app/actions/runs/43985567802)
failed on the November 16 UTC exception deadline. Its other validation jobs
passed. Re-fetched all ten exception records from OSV and npm release metadata
on November 17 UTC, then scanned all 2,320 locked package instances, including
development dependencies. The unfiltered scan also exposed eight newly indexed
advisories that the failed expiry test had prevented CI from reaching.

## Compatible security updates

- Upgrade Next.js 16.4.3 to **16.4.6**, including matching `@next/env` and SWC
  packages. [GHSA-mfr8-8qww-v76h](https://github.com/advisories/GHSA-mfr8-8qww-v76h)
  affects versions before 16.4.5 and describes cache data crossing root-param
  boundaries. This adopts the current patch release in the existing 16.4 line.
- Upgrade Hono 4.13.12 to **4.13.19**. The five findings fixed in 4.13.16 cover
  [CSS interpolation](https://github.com/advisories/GHSA-3gg2-335m-rxc6),
  [ping-request CSRF](https://github.com/advisories/GHSA-46wx-v44x-9hh2),
  [multipart validation](https://github.com/advisories/GHSA-4h7h-rv7c-7m2v),
  [mount paths](https://github.com/advisories/GHSA-4m76-xfj5-7975), and
  [wildcard middleware](https://github.com/advisories/GHSA-h7mg-cq63-vhpq).
- Upgrade `@hono/node-server` 2.1.3 to **2.1.8**. Both findings are fixed in
  2.1.6: [raw-backslash path normalization](https://github.com/advisories/GHSA-jpvv-r467-5p4w)
  and [WebSocket upgrade socket errors](https://github.com/advisories/GHSA-qv5m-9pm6-hqp3).
  The locked MCP SDK accepts `^1.19.9 || ^2.0.5`; this remains in its existing
  supported major. Hono likewise remains in the SDK's supported version range.

The manifests pin these reviewed patches. Inventory/security tests reject a
different resolved version of any of these three packages. No exception is
added for these eight findings.

## Withdrawn advisory and remaining exceptions

Remove the deepmerge [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4)
exception: OSV records its withdrawal at November 16, 2026, 18:55:38 UTC. Retain
the existing source/CJS/UMD hardening patch and poisoned-source/target tests.
The exact advisory allowlist now explicitly rejects restoring this exception.

Renew the remaining **nine** advisory-specific exceptions through
**January 16, 2027, 00:00 UTC**, a 60-day review window. Owner @rebanto, exact
package versions, source-patch checks, auth configuration guards, and the
absolute expiration failure remain enforced. No package-wide override or
severity exclusion is introduced. The [October 30 assessment](security-exceptions-2026-10-30.md)
describes the mitigations; this review supersedes its dates and upstream snapshot.

- Minimatch still requires 11.0.1+ for the upstream fix; latest is 11.0.9.
  The patched 9.0.9/10.2.6 CJS/ESM implementations retain the preprocessing
  bounds and ordinary matching behavior. Legacy 3.1.5 remains outside the
  affected range, which starts at 7.0.0.
- Glob still requires 14.0.2+; latest is 14.0.6. The patched 10.5.0/13.0.6
  generations retain all four cancellation exits and ordinary traversal.
  Legacy 7.2.3 remains outside the affected range. Their fixed major upgrades
  change the matcher/dependency generation and require caller migration.
- Both sandbox records still describe gf3's old isolation package with an
  unbounded OSV range. The installed 4.4.0 package is Vercel's CLI; provenance
  and every locked instance remain guarded. A newer Vercel CLI version alone
  does not resolve the package-identity mismatch.
- Zod's fixed range remains 4.6.6+; application instances stay at 4.6.7.
  No patched Zod 3 release exists. The two nested CLI-tooling versions remain
  3.22.4/3.25.76 with the previously documented residual oversized-input risk.
- The four Better Auth advisory ranges are unchanged. The guarded 1.6.22
  configuration uses the Convex adapter and excludes the affected PostgreSQL,
  Magic Link/social OAuth, and OAuth Proxy implementations. The CLI wrapper
  does call Better Auth's `deviceAuthorization()` plugin. PR #238 corrects the
  earlier non-applicability claim: issuance permits only `fcsia-cli` without
  scopes, trusted stored client/scope are checked again before lookup and
  approval, and the existing approval warning identifies the client and its
  full access within the account's permissions. Tests reject hidden scopes and
  other clients, including old codes and direct approval calls. This is a local
  mitigation of GHSA-q84f-53jg-9ppm, not an upstream package fix. The exact
  configured plugin list is still tested. Installed Convex integration 0.12.2 requires Better
  Auth `>=1.6.9 <1.7.0`. Available integration 0.13.0 supports
  `>=1.7.16 <1.8.0`, and current Better Auth is 1.7.25. Removing these four
  configuration-specific exceptions requires that coordinated auth migration;
  this renewal does not claim those upstream flaws are patched in 1.6.22.

## Validation

- Frozen install and all **21** inventory/security regressions pass with Bun
  1.4.4 and Node 24.22.1. The previously failing absolute-expiry check now
  also enforces a 60–90-day review window and the withdrawn advisory's removal.
- The full inventory contains **2,320** locked package instances. After the
  upgrades, an unfiltered scan reports **14 package/advisory pairs across the
  nine reviewed advisories**. The eight newly indexed findings are gone.
- OSV-Scanner 2.5.1, verified against its published Windows SHA-256 checksum,
  exits **0** with `osv-scanner.toml` and returns an empty results array.
  This is no unreviewed finding in this inventory, not zero residual risk.
- Workspace lint/typechecks and the complete production build pass. The broad
  local test command encounters two existing Windows-specific CLI fixture
  assumptions: POSIX file mode 0600 and colon-separated PATH lookup. Neither
  fixture nor CLI behavior is changed by this repair; Linux CI independently
  runs the complete suite.
- The other workspace suites pass: **1,031 tests passed, eight OCR fixture tests
  skipped**, including 583 Convex tests and 300 web tests. The CLI's local run
  passes 116 tests and encounters only the two platform assumptions above.

Raw advisory/registry responses, scan inventories/results, and local check logs
are retained in this worktree's `.tmp/ci-snake-audit/`. No shared backend or
production deployment is changed by this repair.

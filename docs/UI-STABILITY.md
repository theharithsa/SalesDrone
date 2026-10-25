# UI stability review — v1.6.1 maintenance

This review accompanies the user-authorized same-version maintenance deployment on 25 October 2026. It records tested behavior, not a claim that every browser, device and failure permutation is defect-free. Production records were not used as fixtures. The original v1.6.1 tag remains unchanged; commit SHA and Actions run distinguish this deployment.

## Findings and changes

| Observed/source finding | Change |
| --- | --- |
| Conversation cards centered far from their heading | Anchor timeline and inline composer to the same left edge; keep a readable maximum width |
| Full-page notes require opening a modal | Inline Write a comment field in Comments; compact overlay retains its dialog |
| Drafts could be lost by unmounting content on tab changes | Keep the per-lead/account composer mounted while switching tabs; drafts remain memory-only |
| Uncertain submissions need a safe retry | Preserve original note/version/key on unchanged retry; disable blank and duplicate in-flight writes |
| Earlier activity can finish after another lead opens | Guard session/detail epochs, deduplicate pages and lock the current request |
| Late refresh failure can clear a newly selected lead | Guard selected identity and epochs; show a recoverable error for network failures, clear inaccessible records on access/not-found failures |
| Deep-link loading/error can show unrelated list content | Dedicated loading/unavailable state with Return to leads |
| A dismissed form can close a new dialog when its old request finishes | Synchronous submit lock plus mounted-completion callback guards |
| Reopened inbox can briefly display old cached rows | Clear rows/cursor before loading and guard read/navigation completions by generation |
| Long badges and task text can crowd adjacent controls | Bound and wrap identity badges/task text; preserve flexible columns |
| Emoji/whitespace names can produce broken avatar initials | Grapheme-aware initials with an explicit missing-name fallback |
| Blocked storage can interrupt sign-in cleanup or rendering | Guard optional browser storage; explain import resume limitations |
| Single conversation shown as “1 entries” | Correct singular count |

## Browser verification

All changes are exercised with fictional guest-demo data or actual components in isolated fixtures. Phone/tablet tests use the actual application in same-origin frames with measured inner viewports; browser viewport override was ineffective and was reset. These are browser breakpoint tests, not physical-device certification.

| Surface | Checks performed |
| --- | --- |
| Full lead Comments | Type multiline text, switch Tasks/Comments, retain draft, post, clear successful draft, show new timeline entry; heading/timeline left edges match |
| Slow/error composer fixture | Simulated connection failure preserves draft; retry retains same key/version; double-click during delay creates one request; leaving lead clears the old draft |
| Shared task forms | Actual task edit updates title and closes normally; delayed delete form dismissal does not close a replacement form |
| Leads | Empty search, clear/reset, table width identical before/after overlay, keyboard maximum resize, Escape closes and restores focus |
| Main sidebar | Collapse/expand; all navigation icons share the same horizontal origin |
| Notifications | Open as overlay without route change, mark read/unread, close and restore bell focus; a delayed synthetic destination request stays cancelled after closing the overlay |
| Dashboard | Navigate from task flow, charts/summary render without page overflow |
| Admin settings and imports | Actual SettingsPage renders all personal, Manage fields, AvinyaIntelligence, policy, tokens, people and About sections with synthetic responses; actual CSV parser maps two fictional rows and discussion columns without overflow. No live writes |
| Settings | At 390px use More, Settings and native section selector; Appearance renders without overflow; retain section through 768px and 1024px frame changes |
| Responsive lead | 390 × 844 frame: composer text is 16px, no page overflow, typing/posting and Tasks/Review remain usable with fixed navigation |
| Long content | Plausible compound name, long email/company text, long stage badge; missing/short names, Unicode/emoji initials |
| Shared shell | Light/dark checks; existing focus-managed dialogs, startup recovery boundary, reduced-motion rules and touch input sizing reviewed |

## Verification boundaries

- Physical iOS/Android keyboard, safe-area and push-banner behavior require real-device checks and are not certified here.
- Google OAuth was not reauthenticated in this sweep. Existing authentication tests and production read-only checks verify release/access boundaries; prior sign-in evidence is separate.
- No live lead changes, invitations, token generation, imports or administrator policy writes were performed. Administrative services retain their existing contract/policy tests and receive a source-level lifecycle review plus isolated component rendering checks.
- Same-version authorization is pinned to one exact prior commit and tested to reject a different base. It is not a standing exemption from release versioning.
- Browser fixtures are temporary and excluded from the release. Current guide screenshots are reviewed synthetic captures with measured viewport/hash metadata.

See [product handbook](PRODUCT-GUIDE.md), [lead workspace](LEAD-BLADE.md), [API](API.md) and [observability](observability.md). Actual post-deployment evidence is retained by GitHub Actions, separately from this review. Documentation now verifies source commit as well as version so same-version maintenance cannot pass against stale pages; changed screenshot URLs use reviewed content hashes to avoid stale browser cache.

## Follow-up maintenance: activity tabs

All is now the default view, retaining every loaded activity together with review information and recipient-private tasks. Comments filters only note entries (including imported discussion comments), Calls only call entries; Tasks and Review remain focused views. Filtering preserves source order and review state without duplicating cards. Empty filtered views keep Earlier activity available. The inline draft remains mounted across all five tabs, and All/Comments share the same input. Tab keyboard navigation wraps over five items; narrow screens scroll only the tab strip. No API, permission or telemetry expansion is needed. The original release tag remains immutable and the new explicit maintenance authorization is bound to its own immediate base.

# Natural Assistant replies and research gutters

The response presenter combines only exact server-produced Grounded count sentences with matching unfiltered current scope. Counts remain deterministic server results. Other parts share one conversational message; missing setup and partial results remain explicit, and supporting scope/date context is collapsed under Answer details. Part-specific results and citations retain their existing IDs, cursors and current-access checks. No API, business event, provider call or permissions change is needed.

The Hygiene page omitted the shared page-body wrapper. Restoring it gives desktop 32px, intermediate 24px and phone 16px side padding, a centered maximum width, and aligned headings/options/report panels. Inner card spacing remains separate.

Focused component checks cover one message, disclosure interaction, part-specific results and stale/current history. Presentation tests cover grounded counts, zero, filtered/date/different-scope protection and visible partial/setup limitations. Browser review uses fictional real-component adapters, never live leads or provider inference.

Measured browser dimensions: Assistant 360x800, 390x500, 768x900, 1024x600, 1280x900, 1920x900 and 2560x1100 CSS pixels. Hygiene additionally measured 898x700 and 901x700 around its 900px layout boundary. All had no document horizontal overflow. Dark theme with 125% application display scale was checked at 390x500; history dialog stayed inside the viewport and Hygiene retained its phone gutters. Browser zoom was 70%, with native overrides compensated and actual CSS dimensions measured. Native capture dimensions are recorded separately. This is not physical-device/Safari certification.

Required PR checks, deployment and tenant-search evidence remain separate from local browser observations. Existing unrelated public captures retain historical versions.

# SalesDrone interface design system

The project design skill is [salesdrone-interface](../skills/salesdrone-interface/SKILL.md).
This is a responsive web adaptation of [Apple’s official typography guidance](https://developer.apple.com/design/human-interface-guidelines/typography), reviewed 2026-10-26. It is not a claim of native Dynamic Type support or platform certification.

## Typography without replacing fonts

Keep Google Sans headings/lead first names, Manrope body and monospace phone numbers.
Book mode keeps its serif stack and monospace phone exception. No font files or
families change for the typography correction.

Use semantic roles in `apps/web/src/design-system.css`, loaded after palette and
component styles. Native Apple points are not CSS `pt`; the web tokens use `rem`
with a default 16px root. They respond to browser default-text preferences and
zoom. Do not prevent pinch zoom or use `text-size-adjust: none`.

| Role | Phone/tablet default CSS size | Leading | Purpose |
| --- | --- | --- | --- |
| Page title | 28px | 1.22 | One main title, not marketing display type |
| Section / lead identity | 22px | 1.28–1.3 | Related content and the person’s name |
| Body / editable text | 17px | 1.35–1.55 | Reading and form values |
| Callout / actions | 16px | 1.35–1.45 | Buttons and primary labels |
| Supporting / list context | 15px | 1.35–1.45 | Company, location, tabs and secondary controls |
| Caption / metadata | 13px | 1.4–1.45 | Time, help, section labels; never primary body text |
| Bottom navigation | 12px | 1.35 | Short labels paired with icons |

Desktop uses a 16px body and 34px main title. Long-form passages have a bounded
measure. Maintain readable weight, modest heading tracking and near-zero body
tracking. Do not copy San Francisco’s numeric tracking tables onto other fonts.
A platform minimum is a floor, not the default body size. Form values stay at least
16px at normal browser settings. Touch actions have 44px minimum targets; a small
caption does not justify a small hit area.

## Layout and disclosure

Search is immediately available. Filters groups search-field, stage, source and
custom-column conditions behind one native disclosure, with an active-condition
count. Filtering, export scope and permissions are unchanged. On phones these
controls stack at full width rather than truncating long labels into half columns.
Stage shortcuts scroll locally without widening the document. Lead cards retain
normal name typography, contact information and Edit.

At widths up to 1000 CSS pixels, opening a lead navigates to `/leads/{id}`. The
original list is hidden, with no desktop-sheet offset. At larger widths the table
stays unchanged behind the resizable inspection overlay. Expanding opens the
same dedicated lead route. Back to leads and browser Back keep navigation coherent.
A desktop panel left open during a resize also becomes a full-width detail view.

Stage and assignment are at the top. At narrow widths they stack; native selects
have bounded width. The identity uses a small avatar, inline wrapping name and
company beneath. The journey is horizontally scrollable on narrow screens;
it describes current stages, not fabricated historical conversion. All, Comments,
Calls, Tasks and Review retain their existing contracts and keyboard behavior.

## Verification and release rules

Use actual synthetic application screens, never customer screenshots. Measure
320/375/390/430px phones, 768px tablet and desktop. Exercise lead open/back,
filters, Edit, reminder dialog, tabs and both palettes/Book mode. Verify long and
unbroken names/assignees, no page overflow, local journey scrolling, large text
and keyboard focus. Test browser zoom separately from default-text preferences;
changing root font size is not proof of a native accessibility setting.

Refresh affected reviewed public screenshots and their hashes/version. Update
interface/Book mode skills, handbook, settings-reference descriptions and release
impact plan. Pure visual/navigation changes need no new REST endpoint, PAT scope,
setting-change audit or conversion event. Preserve existing RUM, backend audit,
metrics/traces/logs/outboxes and deployment reporting. Report only observed results;
physical-device checks and tenant queries remain separate verification.

## Shared third-party references

Nine [Wondel Design & UX skills](../skills/WONDEL-SOURCE.md) are installed in the
canonical project skills folder, exposed through `.agents/skills`. Their licence
and source revision are retained. They supplement this project contract and official
sources; their suggestions cannot override a user’s typography/branding choices.

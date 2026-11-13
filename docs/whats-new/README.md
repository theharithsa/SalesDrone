# SalesDrone roadmap and release notes

[Roadmap](https://theharithsa.github.io/SalesDrone/roadmap.html) · [Release notes](https://theharithsa.github.io/SalesDrone/releases.html) · [Sprint Delivery](https://github.com/users/theharithsa/projects/4/views/10)

Update `roadmap.json` when a sprint window changes. Keep the dependency diagram aligned with the work in GitHub. Workspace isolation and SDR migration precede the invoicing pilot, followed by the public signup decision. The [Astryx workspace epic](https://github.com/theharithsa/SalesDrone/issues/213) starts with these public pages and moves through workspace navigation, leads and tasks, then the remaining screens. Its sprint dates are pending review of the documentation pilot.

`CHANGELOG.md` defines version URLs and details. `releases.json` adds optional reader-facing highlights and verified publication dates in Asia/Kolkata. The Pages workflow supplies the GitHub publication dates, including the current release. Unverified entries remain available under their original version URLs with the changelog date. Keep historical screenshots attached to their reviewed version.

The pages use [Astryx](https://astryx.atmeta.com/docs/getting-started) Core and Neutral theme v0.7.15 at build time. `scripts/whats-new.mjs` pre-renders the pages with React. Only the small local search script runs in the browser. The release detail follows Astryx’s detail-page pattern with a separate contents rail. Use `npx @astryxdesign/cli@0.7.15 build` and `component <Name>` to review the upstream guidance before editing. Keep the neutral theme and Open Sans scoped to these pages.

Run `npm run docs:build` and `node --test tests/whats-new.test.ts`. Serve `site/.build` locally and inspect the roadmap, the searchable archive, a historical detail page, and relative links at phone and desktop widths. The dependency flow uses ordered HTML so each step stays readable and keyboard navigable.

## Illustrations

Both illustrations were created with the built-in ImageGen tool and visually reviewed at source size and in the browser. They are concept art. The build publishes only the two named WebP derivatives, each 1200 × 800 pixels.

- [Flight plan](../../site/assets/roadmap/flight-plan.webp) depicts a blue survey drone above a folded ivory paper map with three cobalt waypoints. The prompt asked for an editorial, three-quarter view with warm paper, subtle shadows, and no text or logos.
- [Workspace redesign](../../site/assets/roadmap/workspace-redesign.webp) depicts three overlapping cobalt and periwinkle paper UI panels for navigation, lead details and tasks. The prompt asked for precisely aligned paper cutouts, studio shadows and abstract UI marks without text or logos.

## Publish an upcoming feature

Write a customer-facing issue title and a one-line paragraph under `## Public summary`. Apply `roadmap-public` to opt those two fields into the public site. The Pages workflow fetches all pages of open labeled issues, excludes PRs, and passes them to the static generator. GitHub issue events refresh Pages, and a daily run reconciles missed updates. The workflow uses the published source and does not deploy the app. Remove the label to withdraw a feature from both pages. Keep the offline preview list for the two illustrated examples current when changing their copy. See the [delivery workflow](../SDLC.md).

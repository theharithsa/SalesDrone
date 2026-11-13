import { createElement as h, Fragment } from 'react';
import { Card, HStack, VStack } from '@astryxdesign/core/Layout';
import { heading, paragraph, link, buttonLink, page, repository } from './public-docs-layout.mjs';

const source = repository + '/blob/main/';
const sections = [
  ['lifecycle', 'Lifecycle'],
  ['delivery', 'Build and review'],
  ['release', 'Production release'],
  ['runtime', 'Runtime architecture'],
  ['observability', 'Observability'],
  ['roadmap', 'Public roadmap'],
  ['recovery', 'Failure recovery'],
  ['example', 'Worked example'],
  ['tools', 'Tools and skills'],
];

const stages = [
  ['Intake', 'Define the outcome', 'Open an issue with acceptance criteria. Use an epic for related work, a Project sprint for timing, and a milestone for the release scope.'],
  ['Plan', 'Set the release scope', 'Resolve material decisions and choose the smallest version change that fits. Assign the scoped issues before advancing the candidate.'],
  ['Build', 'Implement on a branch', 'Follow the owning module skill. Update contracts, permissions, tests, changelog, and the release impact plan where applicable.'],
  ['Verify', 'Check the exact PR commit', 'Run focused tests and browser reviews locally. GitHub Actions runs the shared gates against the PR head. Failed checks send the work back to the branch.'],
  ['Release', 'Merge and publish', 'After authorization, merge through the PR. The main workflow verifies the merged commit, deploys production, then publishes the GitHub release and Pages.'],
  ['Operate', 'Verify and recover', 'Compare the live version and SHA, confirm public docs, review telemetry evidence, and recover from the phase that failed.'],
];

const rollout = [
  ['Verify main', 'Check the merged commit, scoped issues and release plan.'],
  ['Stage Hosting', 'Validate the candidate Hosting preview before production changes.'],
  ['Prepare data services', 'Deploy Firestore rules and indexes, wait until indexes are ready, then deploy Storage rules.'],
  ['Deploy backend', 'Deploy Cloud Functions and verify the API ingress before the Hosting cutover.'],
  ['Promote and smoke-test', 'Promote the verified Hosting candidate and check the live SHA, API contract and protected endpoints.'],
  ['Publish and report', 'Publish the GitHub release and curated Pages. Record CI, deployment and observability outcomes.'],
];

const roadmap = [
  ['Review public copy', 'Write a customer-facing issue title and one-line Public summary. Apply roadmap-public once both are ready.'],
  ['Refresh Pages', 'An eligible issue change or the daily reconciliation fetches open approved issues and rebuilds the static public docs from the published source.'],
  ['Show Upcoming', 'Roadmap and Release notes show the approved summary. A matching sprint milestone supplies the target window.'],
];

const workflowJobs = [
  ['verify', 'PRs and main', 'Installs pinned dependencies, runs the CI check suite and retains sanitized evidence. PR verification runs without deployment or Dynatrace secrets.'],
  ['deploy', 'Main after verify', 'Uses GitHub OIDC and Google Workload Identity Federation. Stages Hosting, deploys the production services, checks the live app and publishes the GitHub release on success.'],
  ['documentation', 'After successful deploy', 'Calls public-docs.yml. Builds the curated static site and checks the Pages version and SHA. The same workflow can also run for approved issue changes.'],
  ['observe', 'Main after job outcomes settle', 'Reads the retained CI artifacts and reports the workflow, checks and executed test cases to Dynatrace, including failures and skips.'],
];

const runtime = [
  ['Browser', 'React workspace', 'Loads static assets from Firebase Hosting. Google sign-in uses Firebase Auth. App Check attests app requests.'],
  ['Routing', 'Firebase Hosting', 'Serves salesdrone.in and routes /api/** through the Cloud Run ingress. The API documentation has its own static route.'],
  ['Ingress', 'Cloud Run', 'Checks request parsing and size boundaries and forwards supported API requests to the Firebase HTTPS function.'],
  ['API', 'Express on Firebase Functions', 'Applies membership, capabilities and lead-level access. The API validates inputs and owns domain operations.'],
  ['Data', 'Firestore and Cloud Storage', 'Firestore stores lead, task and other workspace state. Cloud Storage holds private attachments with access controlled by the app.'],
  ['Background', 'Scheduled Firebase Functions', 'Workers dispatch reminders through Firebase Cloud Messaging, analyze notes, process lead intelligence and export telemetry. Gemini supports scoped server-side AI features.'],
];

const signals = [
  ['Browser RUM', 'Dynatrace RUM records approved navigation, API action outcomes and bounded errors.'],
  ['API, ingress and workers', 'OpenTelemetry carries traces, structured logs and metrics. Trace context connects supported request hops.'],
  ['Committed business events', 'Firestore transactions save audit and semantic events to an outbox. The exporter sends them with stable event IDs.'],
  ['GitHub Actions', 'Deployment and runner results produce release, CI and test-case evidence. Shared release and commit metadata ties those records to the deployed build.'],
];

const evidence = [
  ['Source control', 'GitHub issue, PR and merge SHA', 'Establishes scope, approval and exactly what merged.'],
  ['Build and tests', 'Actions check results and sanitized test artifacts', 'Shows which checks ran, passed, failed, or were skipped.'],
  ['Application and docs', 'Live version metadata, API smoke tests, and Pages commit stamp', 'Shows which revision users can reach. Check app and docs separately.'],
  ['Dynatrace ingest', 'OTLP receipts, rejection counts, deployment and CI event receipts', 'Shows what Dynatrace accepted.'],
  ['Dynatrace tenant', 'Read-only query results and native trace or RUM navigation', 'Shows whether accepted data can be found and whether native links work.'],
];

const tools = [
  ['Intake and delivery', 'GitHub Issues, Projects, Actions and Releases', 'App Launchpad, SalesDrone Release and Release Readiness'],
  ['UI and public docs', 'React, TypeScript, Vite, Astryx and static GitHub Pages', 'SalesDrone Interface, Documentation and Product Guide'],
  ['API and data', 'Express, Firebase Auth and App Check, Functions, Firestore, Storage and Cloud Run ingress', 'Owning domain skill, Data Platform, API Integrations and FinOps'],
  ['Verification', 'Node test runner, Vitest, Testing Library, Java 21, Firebase emulators and isolated Chromium', 'SalesDrone Testing, CodeQL and GitGuardian'],
  ['Observability', 'OpenTelemetry, Dynatrace RUM, BizEvents and Actions evidence', 'dt-obs and SalesDrone Observability'],
];

const failures = [
  ['A PR check fails', 'Read the failing job and its retained artifacts. Fix the cause on the branch and verify the new head before merge.'],
  ['Staging or index readiness fails', 'Check which deployment steps ran and the version users can reach. Retry a verified transient failure only when its effects are understood.'],
  ['Backend changed before Hosting switched', 'Treat this as a partial deployment. Check Functions, ingress and Hosting revisions together. Follow the forward recovery procedure before retrying.'],
  ['Pages or telemetry fails after deployment', 'Keep the app deployment result separate. Diagnose the docs or signal failure and rerun only the affected workflow when possible.'],
  ['A live release needs reverting', 'Prepare a forward release with the reviewed revert and confirm compatibility with stored data and queued work. Keep the original tag and deployment evidence.'],
];

const art = (name, loading) => h('img', {
  className: 'editorial-image', src: 'assets/sdlc/' + name + '.webp',
  width: 1200, height: 800, alt: '', loading,
});

function block(id, title, ...children) {
  return h(VStack, { as: 'section', gap: 4, id },
    heading(2, title, 'sdlc-section-title'), ...children);
}

function flow(label, steps) {
  return h('ol', { 'aria-label': label, className: 'sdlc-flow' },
    steps.map(([label, title, description = title], index) =>
      h('li', { key: label },
        h(Card, { padding: 4, className: 'sdlc-step' },
          h(VStack, { gap: 2 },
            paragraph('Step ' + (index + 1), 'kicker'),
            heading(3, label),
            description !== title && paragraph(title),
            paragraph(description, 'muted'))))));
}

function notes(items, label) {
  return h('dl', { className: 'sdlc-notes', 'aria-label': label },
    items.map(([title, primary, detail]) =>
      h(VStack, { as: 'div', key: title, gap: 2 },
        h('dt', null, title), h('dd', null, primary), detail && h('dd', { className: 'muted' }, detail))));
}

export function renderSdlcGuide() {
  return page('SalesDrone delivery workflow', 'SDLC', h(Fragment, null,
    h(Card, { className: 'editorial-card sdlc-hero', padding: 0 },
      h(VStack, { gap: 4, className: 'editorial-copy' },
        paragraph('Engineering handbook', 'kicker'),
        heading(1, 'From issue to production', 'display-heading'),
        paragraph('How SalesDrone plans, builds, verifies and releases a change, and what to check when something goes wrong.', 'lede'),
        h(HStack, { wrap: 'wrap', gap: 2 },
          buttonLink('#lifecycle', 'Explore the workflow', 'primary'),
          buttonLink(source + 'docs/SDLC.md', 'Repository guide'))),
      art('delivery-workflow', 'eager')),
    h(HStack, { as: 'nav', wrap: 'wrap', gap: 2, className: 'sdlc-contents', 'aria-label': 'On this page' },
      sections.map(([id, label]) => link('#' + id, label, { key: id }))),
    block('lifecycle', 'The delivery lifecycle',
      flow('Delivery lifecycle from intake to operations', stages)),
    block('delivery', 'What must be ready before merge',
      h(VStack, { gap: 3, className: 'sdlc-gate' },
        h(Card, { padding: 4, className: 'sdlc-gate-question' },
          heading(3, 'Did the exact PR commit pass its checks?')),
        h('ul', { className: 'sdlc-branches', 'aria-label': 'PR verification outcomes' },
          h('li', null, h(Card, { padding: 4 },
            h(VStack, { gap: 2 }, paragraph('Yes', 'kicker'), heading(3, 'Merge after approval'),
              paragraph('Merge through GitHub. The merged commit starts a new main workflow.', 'muted')))),
          h('li', null, h(Card, { padding: 4 },
            h(VStack, { gap: 2 }, paragraph('No or pending', 'kicker'), heading(3, 'Keep the PR open'),
              paragraph('Fix the failure or wait for the pending job. Verify the updated head before merging.', 'muted')))))),
      notes([
        ['Issue and milestone', 'Use an issue with acceptance criteria and a version milestone with the release scope. Use SemVer once for the candidate and keep that version through review.'],
        ['Change and contracts', 'Review AGENTS.md and the owning skills. For API work, define the versioned contract, access rules, errors, and audit behavior. Document applicable data, cost and compatibility impacts.'],
        ['Verification', 'Use synthetic data. Run unit, API and component checks, and Firebase emulators when behavior crosses auth or persistence boundaries. For UI, inspect reflow, keyboard use, and enlarged text in an isolated browser.'],
        ['Pull request', 'Link the issue with a closing reference, update the changelog and impact plan, and review checks against the exact PR head. Required checks and authorization must be in place before merge.'],
      ], 'Readiness before merge'),
      link(source + 'docs/RELEASE-GOVERNANCE.md', 'Read the release governance policy')),
    block('release', 'What happens after merge',
      paragraph('GitHub Actions uses workload identity for deployment. The Firebase app and the public documentation have separate verification steps.', 'muted'),
      flow('Production release sequence', rollout),
      heading(3, 'GitHub Actions job dependencies'),
      paragraph('On main, verify → deploy → documentation. The observe job waits for all three outcomes, including failures and skips.', 'muted'),
      notes(workflowJobs, 'Jobs in the main GitHub workflow'),
      h(HStack, { gap: 3, wrap: 'wrap' },
        link(source + '.github/workflows/deploy.yml', 'Open deploy.yml'),
        link(source + '.github/workflows/public-docs.yml', 'Open public-docs.yml'))),
    block('runtime', 'How requests move through SalesDrone',
      flow('Request path from browser to data services', runtime.slice(0, 5)),
      notes([runtime[5].slice(1), ['Public documentation', 'GitHub Pages serves the roadmap, handbook, release notes and this guide as static HTML. It builds from the repository and GitHub metadata.']], 'Background services and documentation'),
      link(source + 'firebase.json', 'Open Firebase Hosting and routing configuration')),
    block('observability', 'What each signal proves',
      h(Card, { padding: 0, className: 'editorial-card sdlc-evidence' },
        h(VStack, { className: 'editorial-copy', gap: 3 },
          heading(3, 'Follow the same commit across systems'),
          paragraph('Use the version, commit SHA and workflow run to connect release evidence. Browser observations describe the client experience. The server confirms committed business writes. CI reports checks and executed test cases from runner evidence.', 'muted')),
        art('verification-evidence', 'lazy')),
      h(VStack, { gap: 3, className: 'sdlc-signal-map' },
        h('ul', { className: 'sdlc-sources', 'aria-label': 'Independent sources of telemetry' },
          signals.map(([title, description]) => h('li', { key: title },
            h(Card, { padding: 4 }, h(VStack, { gap: 2 },
              heading(3, title), paragraph(description, 'muted')))))),
        h(Card, { padding: 4, className: 'sdlc-gate-question' },
          heading(3, 'Dynatrace'),
          paragraph('Check ingest receipts, then query the tenant for visibility and linkage.', 'muted'))),
      paragraph('Use the workflow run and commit to compare CI and runtime evidence. Use a trace ID or request ID for a request investigation and confirm native parent linkage separately. Logs and events exclude customer text, credentials and prompts.', 'muted'),
      notes(evidence, 'Sources of delivery evidence'),
      link(source + 'docs/OBSERVABILITY-JOURNEYS.md', 'Read the observability contract')),
    block('roadmap', 'How an issue reaches the public roadmap',
      flow('Public roadmap publishing sequence', roadmap),
      paragraph('Closing the issue or removing the label removes it from Upcoming. A shipped change belongs in the versioned changelog and its published GitHub release. The issue-triggered workflow updates Pages without deploying the app.', 'muted'),
      h(HStack, { gap: 3, wrap: 'wrap' }, link('roadmap.html', 'Open the roadmap'), link('releases.html#upcoming', 'See Upcoming'))),
    block('recovery', 'Where to go when a gate fails',
      notes(failures, 'Failure recovery decisions'),
      link(source + 'docs/RELEASE.md', 'Open the release and recovery runbook')),
    block('example', 'Worked example: email notifications',
      paragraph('Email notifications are planned for invitations, lead assignments, completed tasks, lead outcomes and daily reminders. The approved issue already appears under Upcoming.'),
      paragraph('Before implementation, confirm recipients, default preferences, time zone and provider. A delivery PR would define how committed events queue mail, test permission changes and duplicate events, and verify delivery with a controlled inbox. When it ships, the published changelog would describe the supported notifications.'),
      link(repository + '/issues/217', 'Follow email notifications on GitHub')),
    block('tools', 'Tools and skills by stage',
      paragraph('Developers use App Launchpad to plan issue-linked delivery, the repository skills to follow local module rules, and dt-obs to plan and verify telemetry. Codex can apply those skills during development. Production runs the application code and the configured services.'),
      notes(tools, 'Tools and skills'),
      heading(3, 'Useful local commands'),
      notes([
        ['Run the app', h('code', null, 'npm run dev'), 'Starts the development workspace. Use synthetic data for demos and QA.'],
        ['Check a change', h('code', null, 'npm run qa -- quick'), 'Runs the quick suite for tests, types, docs and release readiness. Use the integration suite for Auth and Firestore emulators.'],
        ['Build public docs', h('code', null, 'npm run docs:build'), 'Generates the curated site in site/.build, including this page.'],
        ['Validate monitoring definitions', h('code', null, 'npm run obs:check'), 'Checks generated monitoring content for drift. Live Dynatrace queries require separate tenant access.'],
      ], 'Local development and verification commands'),
      link(source + 'skill-tree.md', 'Open the SalesDrone skill tree'))),
  { stylesheet: 'sdlc.css' });
}

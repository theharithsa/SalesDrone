import { createElement as h, Fragment } from 'react';
import { Card, HStack, VStack } from '@astryxdesign/core/Layout';
import { heading, paragraph, link, buttonLink, page, repository } from './public-docs-layout.mjs';

import { foundations, stageHandovers, checkExplanations, requestWalkthrough, telemetryTerms, preproduction, workedExample, glossary, learningSources } from './sdlc-learning.mjs';

const source = repository + '/blob/main/';
const sections = [
  ['lifecycle', 'End-to-end flow'],
  ['handovers', 'Every stage explained'],
  ['delivery', 'Build and review'],
  ['release', 'Production release'],
  ['runtime', 'Runtime architecture'],
  ['observability', 'Observability'],
  ['roadmap', 'Public roadmap'],
  ['recovery', 'Failure recovery'],
  ['example', 'Worked example'],
  ['preproduction', 'Pre-production plan'],
  ['tools', 'Tools and skills'],
  ['glossary', 'Terms and further reading'],
];

const deliveryMap = [
  ['Plan the change', 'GitHub issue, acceptance criteria and release milestone.', '#delivery',
    ['Optional public roadmap', 'Approved issue → Pages refresh → Upcoming. This branch can run before implementation.', '#roadmap']],
  ['Build and open a PR', 'Use the relevant skills, implement on a branch, and link the issue.', '#delivery'],
  ['Verify the PR', 'GitHub Actions checks the exact PR commit. Continue after checks pass and merge is approved.', '#delivery',
    ['Checks fail or are pending', 'Keep the PR open. For failures, return to step 2, fix the branch, and verify the updated commit.', '#sdlc-step-2']],
  ['Merge and verify main', 'Merge through GitHub. Actions verifies the merged commit again before deploying.', '#release'],
  ['Deploy and verify production', 'Stage Firebase Hosting → prepare Firestore and Storage → deploy Functions and verify Cloud Run ingress → promote Hosting → check the live app.', '#release',
    ['A release gate fails', 'Stop at the failed gate. Inspect the live revisions and use the recovery runbook before retrying.', '#recovery']],
  ['Publish the release and docs', 'After the deployment job succeeds, the GitHub release is available and the documentation job publishes and verifies Pages.', '#release'],
  ['Review delivery and runtime evidence', 'The observe job reports verification, deployment and docs outcomes, including failures or skips. Live app telemetry reaches Dynatrace separately.', '#observability',
    ['Runtime signals', 'Browser RUM, backend logs, traces and metrics, and committed events also feed Dynatrace.', '#runtime']],
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

const chapterIntros = {
  lifecycle: 'One connected route from an idea to the live app. Follow the solid line; side branches explain publishing, failures and monitoring.',
  handovers: 'What arrives, what happens, what leaves, and the condition for moving on. Read these as a handover between people and tools.',
  preproduction: 'The agreed next step: rehearse changes with synthetic data, then promote verified code. These gates are planned, not active today.',
  glossary: 'Plain-language definitions for the terms used above, with references for deeper learning.',
  delivery: 'A pull request is the handover between implementation and a production release.',
  release: 'The merged commit travels through a sequence of gates. Hosting promotion happens only after the backend is ready.',
  runtime: 'Two different journeys: shipping code to production, and handling a customer request once it gets there.',
  observability: 'Connect the change to its behavior in production. Each system supplies a different piece of evidence.',
  roadmap: 'Approved plans can reach customers before the feature is built, without redeploying the app.',
  recovery: 'Find the failed gate and the live revision first. Then choose the smallest safe recovery.',
  example: 'Follow a planned feature through the same process, from a public issue to a verified release.',
  tools: 'A practical reference for the services, development tools and skills used along the way.',
};
const iconPaths = {
  plan: 'M8 4h8v4H8z M7 6H5v15h14V6h-2 M8 12h8 M8 16h5',
  build: 'm8 8-4 4 4 4 m8-8 4 4-4 4 m-3-11-2 14',
  check: 'M12 3 3 7v6c0 5 9 9 9 9s9-4 9-9V7z m-5 9 3 3 5-6',
  merge: 'M6 3v13 M6 8c9 0 12 2 12 8 M3 19a3 3 0 1 0 6 0a3 3 0 1 0-6 0 M15 19a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
  deploy: 'M12 16V3 m-5 5 5-5 5 5 M4 14v7h16v-7',
  docs: 'M3 4h7l2 2 2-2h7v16h-7l-2 2-2-2H3z M12 6v16',
  observe: 'M3 12h4l3-7 4 14 3-7h4',
};
const icon = (name) => h('svg', {viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:1.6, strokeLinecap:'round', strokeLinejoin:'round', 'aria-hidden':true}, h('path', {d:iconPaths[name]}));
function block(id, title, ...children) {
  const number = String(sections.findIndex(([key]) => key === id) + 1).padStart(2, '0');
  return h('section', {id, className:'sdlc-chapter'},
    h('header', {className:'sdlc-chapter-heading'},
      h('span', {className:'sdlc-chapter-number', 'aria-hidden':true}, number),
      h('div', null, heading(2, title, 'sdlc-section-title'), paragraph(chapterIntros[id], 'sdlc-chapter-intro'))),
    h('div', {className:'sdlc-chapter-content'}, ...children));
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

function lifecycleDiagram() {
  const labels = ['GitHub · Plan', 'Local branch · Build', 'GitHub Actions · Quality gate', 'GitHub · Merge', 'Firebase & Cloud Run · Release', 'GitHub Pages · Publish', 'Dynatrace · Observe'];
  const icons = ['plan','build','check','merge','deploy','docs','observe'];
  return h('figure', { className: 'sdlc-map', 'aria-labelledby': 'sdlc-map-caption' },
    h('figcaption', { id: 'sdlc-map-caption' },
      h('span', null, 'Delivery map'), h('span', {className:'sdlc-map-legend'}, 'Solid line: release path · Dashed line: related action')),
    h('ol', { className: 'sdlc-map-path' },
      deliveryMap.map(([title, description, href, branch], index) =>
        h('li', { key: title, id: 'sdlc-step-' + (index + 1), className: 'sdlc-map-row' },
          h('span', { className: 'sdlc-map-number', 'aria-hidden': true }, icon(icons[index])),
          h('div', {className:'sdlc-map-stage'},
            paragraph(String(index + 1).padStart(2, '0') + ' / ' + labels[index], 'kicker'),
            heading(3, link(href, title)), paragraph(description, 'muted')),
          branch && h('aside', { className: 'sdlc-map-branch' + (index === 2 || index === 4 ? ' sdlc-map-warning' : '') },
            heading(4, link(branch[2], branch[0])), paragraph(branch[1], 'muted'))))),
    h('div', {className:'sdlc-map-return'}, icon('observe'),
      paragraph('Production feedback informs the next issue. The cycle begins again.')));
}

function jobDiagram() {
  return h('figure', {className:'sdlc-jobs', 'aria-label':'GitHub Actions dependencies on main'},
    h('figcaption', null, 'On a push to main'),
    h('ol', {className:'sdlc-job-path'}, ['verify','deploy','documentation'].map((job,i) =>
      h('li', {key:job}, h('span', {className:'kicker'}, '0' + (i + 1)), h('code',null,job),
        paragraph(['Checks the merged commit','Releases and verifies the app','Publishes and checks Pages'][i])))),
    h('div', {className:'sdlc-job-observe'}, icon('observe'), h('code',null,'observe'),
      paragraph('Waits for all three outcomes, including failures and skips. Sends the delivery evidence to Dynatrace.')));
}

function notes(items, label) {
  return h('dl', { className: 'sdlc-notes', 'aria-label': label },
    items.map(([title, primary, detail]) =>
      h(VStack, { as: 'div', key: title, gap: 2 },
        h('dt', null, title), h('dd', null, primary), detail && h('dd', { className: 'muted' }, detail))));
}

export function renderSdlcGuide() {
  return page('SalesDrone delivery workflow', 'SDLC', h(Fragment, null,
    h('section', { className: 'editorial-card sdlc-hero' },
      h(VStack, { gap: 4, className: 'editorial-copy' },
        paragraph('SalesDrone / Engineering handbook', 'kicker'),
        heading(1, h(Fragment,null,'From issue',h('br'), 'to ',h('em',null,'production.')), 'display-heading'),
        paragraph('The people, tools and checks behind every release. A field guide to how SalesDrone is built, shipped and operated.', 'lede'),
        h(HStack, { wrap: 'wrap', gap: 2 },
          buttonLink('#lifecycle', 'Explore the workflow', 'primary'),
          buttonLink(source + 'docs/SDLC.md', 'Repository guide'))),
      h('div', {className:'sdlc-hero-art'}, art('delivery-workflow', 'eager'),
        h('span', {className:'sdlc-art-caption'}, 'Plan → Build → Verify → Release → Observe'))),
    h('div', {className:'sdlc-reading-layout'},
    h('nav', {className:'sdlc-contents', 'aria-label':'Guide chapters'},
      paragraph('IN THIS GUIDE', 'kicker'),
      h('ol', null, sections.map(([id,label],i) => h('li',{key:id},link('#'+id,h(Fragment,null,h('span',{'aria-hidden':true},String(i+1).padStart(2,'0')),label))))),
      h('div', {className:'sdlc-nav-note'},paragraph('Built from the source'), paragraph('Workflow and service links open the implementation in GitHub.', 'muted'))),
    h('div', {className:'sdlc-article'},
    block('lifecycle', 'The whole delivery flow', foundations(), lifecycleDiagram()),
    block('handovers', 'Every stage, from input to outcome', stageHandovers()),
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
      heading(3, 'What do the checks actually tell us?'),
      notes(checkExplanations, 'Purpose of the verification suites'),
      link(source + 'docs/RELEASE-GOVERNANCE.md', 'Read the release governance policy')),
    block('release', 'What happens after merge',
      paragraph('GitHub Actions uses workload identity for deployment. The Firebase app and the public documentation have separate verification steps.', 'muted'),
      flow('Production release sequence', rollout),
      heading(3, 'GitHub Actions job dependencies'),
      jobDiagram(),
      notes(workflowJobs, 'Jobs in the main GitHub workflow'),
      h(HStack, { gap: 3, wrap: 'wrap' },
        link(source + '.github/workflows/deploy.yml', 'Open deploy.yml'),
        link(source + '.github/workflows/public-docs.yml', 'Open public-docs.yml'))),
    block('runtime', 'How requests move through SalesDrone',
      flow('Request path from browser to data services', runtime.slice(0, 5)),
      notes([runtime[5].slice(1), ['Public documentation', 'GitHub Pages serves the roadmap, handbook, release notes and this guide as static HTML. It builds from the repository and GitHub metadata.']], 'Background services and documentation'),
      requestWalkthrough(),
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
      heading(3, 'Read the signals in plain language'),
      notes(telemetryTerms, 'What monitoring terms mean'),
      notes(evidence, 'Sources of delivery evidence'),
      link(source + 'docs/OBSERVABILITY-JOURNEYS.md', 'Read the observability contract')),
    block('roadmap', 'How an issue reaches the public roadmap',
      flow('Public roadmap publishing sequence', roadmap),
      paragraph('Closing the issue or removing the label removes it from Upcoming. A shipped change belongs in the versioned changelog and its published GitHub release. The issue-triggered workflow updates Pages without deploying the app.', 'muted'),
      h(HStack, { gap: 3, wrap: 'wrap' }, link('roadmap.html', 'Open the roadmap'), link('releases.html#upcoming', 'See Upcoming'))),
    block('recovery', 'Where to go when a gate fails',
      notes(failures, 'Failure recovery decisions'),
      link(source + 'docs/RELEASE.md', 'Open the release and recovery runbook')),
    block('example', 'Worked example: a daily email reminder', workedExample()),
    block('preproduction', 'The planned pre-production path', preproduction()),
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
      link(source + 'skill-tree.md', 'Open the SalesDrone skill tree')),
    block('glossary', 'A field guide to the vocabulary',
      notes(glossary, 'Delivery vocabulary'),
      heading(3, 'Further reading and sources'),
      paragraph('The workflow above is based on SalesDrone’s checked-in implementation. These references explain the broader lifecycle, teaching approach and platform constraints. The pre-production chapter describes a proposal, not deployed infrastructure.'),
      h('ul', {className:'sdlc-source-links'}, learningSources.map(([title,url]) => h('li',{key:url},link(url,title)))))))),
  { stylesheet: 'sdlc.css', mainClass: 'sdlc-page' });
}

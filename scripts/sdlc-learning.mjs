// Reader-facing explanations: keep the deployed path separate from proposed infrastructure.
import { createElement as h } from 'react';
import { heading, paragraph, link, repository } from './public-docs-layout.mjs';

export function foundations() {
  return h('div', {className:'sdlc-primer'},
    paragraph('SDLC means software development life cycle. It is the repeatable route from “we need this” to “people can use it, and we know it works.” Read the map first, then follow the numbered stages. No cloud experience is assumed.'),
    h('div', {className:'sdlc-primer-grid'},
      h('div',null,heading(3,'Three things travel separately'),
        paragraph('Code is the set of instructions developers edit. A build turns those instructions into files that a browser or server can run. Data is the saved information—leads, comments and tasks—which normally stays in the database when code changes.')),
      h('div',null,heading(3,'Three different places'),
        paragraph('Local means a developer’s computer. GitHub stores the reviewed source and runs automated checks. Production means the running services reached through salesdrone.in. Saving a file locally or pushing it to GitHub does not by itself update the live app.'))),
    h('aside',{className:'sdlc-callout'},heading(3,'Who does what?'),
      paragraph('The product owner defines the outcome and resolves business choices. The developer changes code and supplies test evidence. The reviewer checks the proposed change. GitHub Actions executes repeatable checks and deployment steps. The release owner confirms the live result; the operator investigates runtime problems. One person may hold several roles, but the handoffs still matter.')));
}

const stages = [
  ['01','Describe the problem', 'A user report, a bug, or an agreed feature request.',
    'The product owner and developer create a GitHub issue. Write the visible outcome and examples of success and failure. Group related work under an epic. A sprint is a time window for work; a release milestone groups what will ship together. Resolve permissions, privacy and cost choices before coding.',
    'An assigned issue with acceptance criteria, scope, dependencies and a target milestone.',
    'A reviewer can tell what will be different for a user. If a material decision is missing, ask the owner and keep the dependent work open.'],
  ['02','Design, implement and push', 'The agreed issue and the current repository instructions.',
    'The developer creates a branch, an independent line of code changes. Read AGENTS.md and the module skills first. Sketch the interaction; for API work, specify inputs, outputs, access rules and errors. Implement with synthetic data. Update tests, user docs, the changelog and release impact plan. Save logical changes as commits, then push the branch to GitHub.',
    'A pull request (PR): a proposed set of commits, linked to its issue, with an explanation and evidence.',
    'The diff contains only intended files and no credentials or customer exports. A push shares the proposal; it does not authorize a production deployment.'],
  ['03','Check and review the proposal', 'The exact commit at the tip of the PR branch.',
    'GitHub Actions starts a fresh runner and installs the locked dependency versions. Automated checks exercise behavior and validate contracts, types, security and documentation. A human or authorized reviewer reads the diff and inspects visible changes in a browser. A green test cannot establish that spacing or Safari behavior is acceptable.',
    'Check results, browser evidence, retained artifacts and a reviewed PR.',
    'All required checks pass for the current commit and merge is authorized. A new commit needs fresh checks. A failed test sends the work back to the branch, not around the gate.'],
  ['04','Merge the approved code', 'A reviewed PR whose current checks pass.',
    'Merge through GitHub into main. GitHub records a new merged source revision; its SHA is a fingerprint used to identify exactly what is being released. The production workflow starts and verifies that merged result again because it may include changes made on main while the PR was being reviewed.',
    'A merged commit and a new main workflow run.',
    'Main verification passes before the deploy job starts. “Merged” means the repository accepted the code; users may still be running the previous release.'],
  ['05','Build, deploy and check the live app', 'Verified main source and authorized deployment identity.',
    'Actions builds the candidate and stages the frontend on a temporary Hosting channel. It prepares Firestore rules and indexes, waits for required indexes, deploys Storage rules, then deploys the backend and verifies ingress. Only then does it promote Hosting. Live version and API probes check what customers can reach. The release sequence below shows those gates in order.',
    'Deployed service revisions, an accessible app and sanitized deployment evidence.',
    'The published version and commit match, and protected endpoints enforce access. If a step fails, inspect which services changed before retrying: a deployment can be partial.'],
  ['06','Publish what shipped', 'A successful deployment job and its release identity.',
    'The deploy job publishes the GitHub release after its required checks succeed. A separate documentation job builds the curated public site and verifies its version and commit stamp. Release notes explain shipped changes. The roadmap describes approved future work; an item appearing there does not mean it is available.',
    'A versioned release, readable release notes and a separately verified documentation site.',
    'Check both URLs and source identities. A Pages failure is a documentation failure even if the app deployment succeeded; preserve that distinction in the report.'],
  ['07','Observe, learn and recover', 'The running app, workflow results and telemetry receipts.',
    'The observe job reports CI and test outcomes, including failures or skips. Browser and backend instrumentation send runtime signals to Dynatrace. The operator compares timing, errors and committed events with the release identity. Investigate failed user journeys and turn confirmed defects into new issues with reproduction steps.',
    'Evidence about actual operation, an incident or improvement issue when needed, and a recovery decision.',
    'Accepted telemetry must be queried separately to prove it is searchable. A rollback of a published release is a reviewed forward release of reverted code, with data compatibility checked—not an overwritten tag.'],
];
export function stageHandovers() {
  return h('ol',{className:'sdlc-handovers','aria-label':'Detailed stage handoffs'},stages.map(([n,title,input,action,output,gate]) =>
    h('li',{key:n},heading(3,n+' / '+title),h('dl',null,
      ...[['Starts with',input],['What people and tools do',action],['Produces',output],['Ready to continue when',gate]].map(([label,text]) =>
        h('div',{key:label},h('dt',null,label),h('dd',null,text)))))));
}

export const checkExplanations = [
  ['Unit and API checks','Exercise calculations and request behavior with known inputs. Example: a member without export permission receives a denial rather than a file.'],
  ['Component and browser checks','Components check controls and state changes. Browser review checks the assembled screen, keyboard operation, narrow layouts, enlarged text and real rendering. Desktop Safari coverage is recorded separately from Chromium and from physical-device Safari.'],
  ['Firebase emulators','Run isolated local Auth and Firestore services to exercise persistence and access behavior. Test records stay synthetic; passing an emulator check is not proof of production configuration.'],
  ['Types, lint and contracts','Types catch incompatible values; lint catches code problems; contract checks detect unintended API changes. These protect integrations and the MCP adapter as well as the UI.'],
  ['Security, build and release readiness','Secret scanning and dependency/security checks look for exposure and known problems. Builds prove deployable artifacts can be generated. Readiness checks tie version, milestone, docs and declared release impacts together.'],
];

export function requestWalkthrough() {
  return h('aside',{className:'sdlc-callout'},heading(3,'Example: a member completes a task'),
    paragraph('The browser sends an API request carrying the member’s Firebase session and App Check token. Hosting routes the request to ingress, which checks request boundaries and forwards it. The API checks membership, lead access, task permissions and the submitted comment before accepting the change.'),
    paragraph('A successful database transaction saves the task state and its audit/outbox records together. The API returns a response; the browser shows success. A background exporter later delivers the committed event to Dynatrace. A failed permission check returns an error and does not complete the task.'),
    paragraph('This is the runtime flow. It happens for customer actions after deployment. The GitHub delivery flow runs when developers ship code; ordinary users do not trigger a GitHub build when they save a task.'));
}
export const telemetryTerms = [
  ['Log','A timestamped account of a bounded event, such as an API validation failure. It explains what happened without storing private request bodies.'],
  ['Trace and span','A trace connects related work for one operation. A span records one part, such as the API handling a request. Parent links and shared trace IDs help locate the slow or failing step.'],
  ['Metric','An aggregate measurement over time, such as request duration or error count. It shows trends; it does not explain every individual failure.'],
  ['RUM','Real User Monitoring describes browser experience, navigation and supported request outcomes. It does not prove a database write committed.'],
  ['Audit event and outbox','A committed audit record states that an authorized business change happened. An outbox is a saved queue entry that lets a worker send the event later and retry safely.'],
];

export function preproduction() {
  return h('div',{className:'sdlc-preprod'},
    h('aside',{className:'sdlc-callout sdlc-planned'},paragraph('PLANNED · NOT ACTIVATED', 'kicker'),heading(3,'A rehearsal environment before production'),
      paragraph('Pre-production will run synthetic leads and tasks in the existing Firebase project, with a separate named Firestore database and isolated runtime resources. This release publishes the plan and issues only. The branch gate, resources, test data and owner Admin membership are not provisioned.')),
    h('figure',{className:'sdlc-promotion'},h('figcaption',null,'Planned promotion route — code moves; customer data stays put'),
      h('ol',null,...[
        ['Feature PR','Review the proposed change and run checks.'],
        ['pre-prod branch','Deploy only to isolated test resources.'],
        ['Acceptance gate','Verify synthetic journeys, Safari, access isolation, cost and telemetry.'],
        ['Promotion PR → main','Confirm the reviewed source is the one that passed acceptance.'],
        ['Production Actions','Recheck, deploy to salesdrone.in and verify the live result.'],
      ].map(([title,body])=>h('li',{key:title},heading(3,title),paragraph(body)))),
      paragraph('If acceptance fails, fix the feature and repeat pre-production checks. A new source change invalidates the earlier acceptance evidence.')),
    paragraph('A second database is not a second Firebase project. Auth identities, project-level quotas and billing are still shared, and a named database does not receive another free daily allowance. Separate Functions, ingress, attachment storage, worker targets and scoped service identities must prevent test operations from touching production.'),
    paragraph('The requested owner will receive Admin membership only inside pre-production after identity verification. Fixtures will be explicitly fake and bounded. Notifications will be suppressed except for controlled tests. Browser caches will use the separate origin, and the app will display a clear pre-production banner.'),
    paragraph('Dynatrace will use the same endpoint and secret references. Pre-production RUM, traces, logs, metrics and delivery events will carry deployment.environment.name = pre-production; production will retain production. This separates investigation without changing tenant configuration.'),
    h('ol',{className:'sdlc-plan-links'},...[
      [223,'1. Isolate runtime and data','Remove production fallbacks and prove effective access boundaries.'],
      [224,'2. Seed synthetic data','Use idempotent fixtures and grant only the verified pre-production owner.'],
      [225,'3. Add branch promotion','Bind promotion to tested source and environment-specific deployment identity.'],
      [226,'4. Prove the gates','Measure usage, verify signals and test failures before activating the production gate.'],
    ].map(([id,title,body])=>h('li',{key:id},link(repository+'/issues/'+id,title),paragraph(body)))),
    link(repository+'/issues/222','Track the pre-production epic'),
    link(repository+'/blob/main/docs/PRE-PRODUCTION-PLAN.md','Read the resource, permissions and acceptance plan'));
}

export function workedExample() {
  return h('div',{className:'sdlc-example'},
    paragraph('Example only: email reminders are planned, not shipped by this documentation release. Imagine the requirement “Send a member one daily reminder of overdue tasks.” Follow one artifact through the whole process:'),
    h('ol',null,...[
      ['Issue','Write who receives mail, when their day begins, opt-out behavior and which tasks they may see. Resolve provider and recipient rules before implementation. Link the work to the email epic and release milestone.'],
      ['Design and branch','Define a queue record for an eligible reminder, a duplicate-prevention key and permission checks at send time. Sketch the preference control and explain it in user documentation.'],
      ['Implementation PR','Add the preference and worker behavior, tests, docs, changelog and cost budget. The PR explains the before/after behavior and links its issue. No real customers receive development mail.'],
      ['Verification','Use synthetic tasks and a controlled inbox. Test duplicate retries, time-zone boundaries, revoked access, opted-out users and a mail-provider failure. Inspect the preference on desktop and phone.'],
      ['Review and release','Checks must pass for the reviewed commit. Today, merging main starts the production sequence. Once the planned pre-production gate exists, the same source must first pass the synthetic environment before its promotion PR.'],
      ['Live evidence and learning','Confirm the deployed version and an authorized controlled delivery. Compare queue, delivery and failure signals. A defect becomes a new issue; a provider receipt alone does not prove a human read the email.'],
    ].map(([title,body])=>h('li',{key:title},heading(3,title),paragraph(body)))),
    link(repository+'/issues/217','Follow planned email notifications'));
}

export const glossary = [
  ['Repository / branch / commit','The repository is the shared code history. A branch isolates a proposed change. A commit is a saved revision; its SHA identifies it precisely.'],
  ['Pull request / merge','A PR asks to add a branch’s changes to another branch. Merge accepts those changes into that target. Deployment is a later operation.'],
  ['CI / CD / workflow / job','Continuous integration checks changes automatically. Continuous delivery prepares checked changes for release. In GitHub Actions, a workflow is an automation definition; a job is a group of steps run on a runner.'],
  ['Artifact / deployment / release','An artifact is a produced file or evidence bundle. Deployment installs a revision into an environment. A release is the named, documented version made available to users.'],
  ['Frontend / backend / API','The frontend is what the browser presents. The backend enforces rules and accesses stored data. The API is the agreed request/response interface between them and external integrations.'],
  ['Hosting / Functions / ingress','Hosting serves web assets and routes requests. Functions runs server code. Ingress is SalesDrone’s HTTP entry layer before the API function.'],
  ['Firestore / index / Storage','Firestore stores structured documents; an index supports queries efficiently. Cloud Storage holds files such as private attachments. Database rules and file rules are separate.'],
  ['Auth / App Check / authorization','Auth identifies the signed-in person. App Check attests the calling application. Authorization decides whether that person may perform this operation on this record. One does not replace the others.'],
  ['OIDC / Workload Identity Federation','A short-lived identity exchange lets a trusted GitHub workflow obtain scoped Google access. It avoids storing a long-lived service-account key in the repository.'],
  ['Environment / synthetic data / smoke test','An environment is a running app and its resources. Synthetic data is invented test data. A smoke test is a short check of essential behavior, not exhaustive acceptance.'],
  ['SemVer / milestone / sprint / epic','Version numbers communicate release impact: major.minor.patch. A milestone groups an outcome or release; a sprint schedules a time window; an epic groups dependent issues. Their scopes should agree without being interchangeable.'],
];
export const learningSources = [
  ['Atlassian: software development life cycle','https://www.atlassian.com/agile/software-development/sdlc'],
  ['Diátaxis: explaining concepts','https://diataxis.fr/explanation/'],
  ['Diátaxis: teaching with a worked journey','https://diataxis.fr/tutorials/'],
  ['Firebase: development environments','https://firebase.google.com/docs/projects/dev-workflows/overview-environments'],
  ['Firebase: multiple Hosting sites and shared project resources','https://firebase.google.com/docs/hosting/multisites'],
  ['Firestore: named databases','https://firebase.google.com/docs/firestore/manage-databases'],
  ['Firestore: quotas and free database allowance','https://firebase.google.com/docs/firestore/quotas'],
  ['GitHub: deployment environments','https://docs.github.com/en/actions/concepts/workflows-and-actions/deployment-environments'],
];

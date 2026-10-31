import { pathToFileURL } from 'node:url';
// A skipped, cancelled, missing or failed required phase cannot report success.
export const deploymentPhases = [
  'firestore',
  'indexes',
  'storage',
  'functions',
  'ingress',
  'hosting',
  'published',
  'postcheck',
];
export function deploymentOutcome(outcomes) {
  return deploymentPhases.every((phase) => outcomes[phase] === 'success')
    ? 'succeeded'
    : 'failed';
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(
    deploymentOutcome(
      Object.fromEntries(
        deploymentPhases.map((phase) => [
          phase,
          process.env['DEPLOY_' + phase.toUpperCase()],
        ]),
      ),
    ),
  );

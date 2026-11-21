// One-time operator setup using the existing authorized Firebase CLI session.
import assert from 'node:assert/strict';
import { cloud } from './cloud-access.mjs';
import { productionRuntime } from '../functions/src/runtime-identity.js';

const { project, accountId, email, database, bucket } = productionRuntime;
const member = 'serviceAccount:' + email;
const deployer = `serviceAccount:salesdrone-github-deploy@${project}.iam.gserviceaccount.com`;
const projectPolicy = `https://cloudresourcemanager.googleapis.com/v1/projects/${project}`;
const accountURL = `https://iam.googleapis.com/v1/projects/${project}/serviceAccounts/${email}`;
const rolesURL = `https://iam.googleapis.com/v1/projects/${project}/roles`;
const supportRole = 'salesdroneRuntimeSupport';
const permissions = ['cloudmessaging.messages.create', 'firebaseauth.users.get'];

async function ensure(url, create) {
  try {
    return await cloud(url);
  } catch (error) {
    if (error.status !== 404) throw error;
    return create();
  }
}

async function grant(url, role, grantee, { condition, get, put } = {}) {
  const getPolicy = get ?? (() => cloud(url + ':getIamPolicy', {
    method: 'POST', body: JSON.stringify({ options: { requestedPolicyVersion: 3 } }),
  }));
  const setPolicy = put ?? ((policy) => cloud(url + ':setIamPolicy', {
    method: 'POST', body: JSON.stringify({ policy }),
  }));
  const policy = await getPolicy();
  policy.bindings ??= [];
  let binding = policy.bindings.find(item =>
    item.role === role &&
    (condition ? item.condition?.expression === condition.expression : !item.condition),
  );
  if (binding?.members.includes(grantee)) return;
  if (!binding) {
    binding = { role, members: [], ...(condition ? { condition } : {}) };
    policy.bindings.push(binding);
  }
  if (condition) policy.version = 3;
  binding.members.push(grantee);
  await setPolicy(policy);
}

async function provision() {
  const role = await ensure(rolesURL + '/' + supportRole, () => cloud(rolesURL, {
    method: 'POST',
    body: JSON.stringify({
      roleId: supportRole,
      role: { title: 'SalesDrone runtime Auth and push', stage: 'GA', includedPermissions: permissions },
    }),
  }));
  assert.deepEqual([...role.includedPermissions].sort(), permissions);
  const account = await ensure(accountURL, () => cloud(`https://iam.googleapis.com/v1/projects/${project}/serviceAccounts`, {
    method: 'POST', body: JSON.stringify({ accountId, serviceAccount: { displayName: 'SalesDrone production runtime' } }),
  }));
  assert.equal(account.email, email);
  assert.ok(!account.disabled, 'Production runtime identity is disabled');
  await grant(projectPolicy, 'roles/datastore.user', member, { condition: {
    title: 'SalesDrone production database only',
    expression: `resource.name == "projects/${project}/databases/${database}"`,
  } });
  await grant(projectPolicy, role.name, member);
  await grant(accountURL, 'roles/iam.serviceAccountUser', deployer);
  const storageIAM = `https://storage.googleapis.com/storage/v1/b/${bucket}/iam`;
  await grant(storageIAM, 'roles/storage.objectAdmin', member, {
    get: () => cloud(storageIAM + '?optionsRequestedPolicyVersion=3'),
    put: (policy) => cloud(storageIAM, { method: 'PUT', body: JSON.stringify(policy) }),
  });
  for (const name of ['CURSOR_SECRET', 'DYNATRACE_API_TOKEN', 'GEMINI_API_KEY']) {
    const secret = `https://secretmanager.googleapis.com/v1/projects/${project}/secrets/${name}`;
    await grant(secret, 'roles/secretmanager.secretAccessor', member, {
      get: () => cloud(secret + ':getIamPolicy?options.requestedPolicyVersion=3'),
    });
  }
  console.log('Production runtime identity provisioned with database, bucket and secret boundaries.');
}

if (process.argv.length !== 3 || process.argv[2] !== '--apply' || process.env.GCP_PROJECT_ID !== project) {
  throw Error('This operator command requires the SalesDrone project and --apply');
}
try {
  await provision();
} catch (error) {
  console.error('Production runtime provisioning did not finish (' + (error.status || error.name) + ').');
  if (error.status === 400) console.error(error.message.slice(0, 300));
  process.exitCode = 1;
}

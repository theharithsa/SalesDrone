import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
for (const environment of ['production', 'pre-production']) {
  test(`deployment notifier emits safe CloudEvents and native SDLC events for ${environment}`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'salesdrone-biz-'));
    try {
      await writeFile(
        join(root, 'deployment.json'),
        JSON.stringify({
          version: '1.6.2',
          commit: 'fixture',
          repository: 'fixture/repo',
          runId: 'fixture-run',
          runAttempt: '1',
          functions: [],
          ...(environment === 'pre-production' ? { environment } : {}),
        }),
      );
      const shim = join(root, 'fetch.mjs');
      await writeFile(
        shim,
        `globalThis.fetch=async(url,options)=>{
      if(!url.startsWith('https://fixture.live.dynatrace.com/'))throw Error('Unexpected destination');
      const body=JSON.parse(options.body?.toString?.()||'{}');
      if(url.endsWith('/bizevents/ingest')){
        if(options.headers['Content-Type']!=='application/cloudevent+json'||body.type!=='com.avinyatech.salesdrone.deployment.succeeded'||body.source!==body.data['event.provider']||body.data['deployment.environment.name']!==${JSON.stringify(environment)})throw Error('Invalid CloudEvent');
        return new Response('',{status:202});
      }
      if(url.endsWith('/platform/ingest/v1/events.sdlc')){
        if(options.headers['Content-Type']!=='application/json'||body['event.type']!=='deployment'||body['service.namespace']!=='avinyatech'||body['event.status']!=='finished'||body['deployment.environment.name']!==${JSON.stringify(environment)}||body['cicd.deployment.release_stage']!==${JSON.stringify(environment)})throw Error('Invalid marker');
        return new Response('',{status:202});
      }
      if(url.includes('/otlp/v1/'))return new Response(null,{status:200,headers:{'Content-Type':'application/x-protobuf'}});
      throw Error('Unknown operation');
    };`,
      );
      // Protobuf transport is binary, not JSON. Avoid parsing bodies until a BizEvent/marker request.
      let content = await readFile(shim, 'utf8');
      content = content.replace(
        "const body=JSON.parse(options.body?.toString?.()||'{}');",
        "const body=url.includes('/otlp/v1/')?{}:JSON.parse(options.body);",
      );
      await writeFile(shim, content);
      const r = spawnSync(
        process.execPath,
        [
          '--import',
          shim,
          fileURLToPath(
            new URL('../scripts/notify-deployment.mjs', import.meta.url),
          ),
        ],
        {
          cwd: root,
          encoding: 'utf8',
          timeout: 30000,
          env: {
            ...process.env,
            DYNATRACE_API_TOKEN: 'synthetic-fixture',
            DYNATRACE_TENANT_URL: 'https://fixture.live.dynatrace.com',
            DEPLOYMENT_OUTCOME: 'succeeded',
          },
        },
      );
      assert.equal(r.status, 0, r.stderr);
      const receipt = JSON.parse(
        await readFile(join(root, 'monitoring.json'), 'utf8'),
      );
      assert.equal(receipt.accepted, true);
      assert.equal(receipt.bizEventStatus, 202);
      assert.ok(!JSON.stringify(receipt).includes('synthetic-fixture'));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}

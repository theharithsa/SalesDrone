// Read-only operator diagnostics. Project-specific IAM, no customer payloads or secrets.
import { cloud } from './cloud-access.mjs';
const root =
  'https://firestore.googleapis.com/v1/projects/sales-drone-avinya/databases/(default)/documents/workspaces/avinyatech';
const statuses = {};
for (const status of ['Pending', 'Sending', 'Delivered', 'Rejected']) {
  const r = await cloud(root + ':runAggregationQuery', {
    method: 'POST',
    body: JSON.stringify({
      structuredAggregationQuery: {
        structuredQuery: {
          from: [{ collectionId: 'telemetryOutbox' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'status' },
              op: 'EQUAL',
              value: { stringValue: status },
            },
          },
        },
        aggregations: [{ alias: 'count', count: {} }],
      },
    }),
  });
  statuses[status] = Number(
    r[0]?.result?.aggregateFields?.count?.integerValue || 0,
  );
}
const rows = await cloud(root + ':runQuery', {
  method: 'POST',
  body: JSON.stringify({
    structuredQuery: {
      from: [{ collectionId: 'telemetryOutbox' }],
      select: {
        fields: [
          'status',
          'lastStatus',
          'attemptCount',
          'createdAt',
          'deliveryFormat',
          'event.type',
        ].map((fieldPath) => ({ fieldPath })),
      },
      orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
      limit: 20,
    },
  }),
});
const recent = rows
  .filter((r) => r.document)
  .map((r) => {
    const f = r.document.fields;
    return {
      status: f.status?.stringValue,
      httpStatus: Number(f.lastStatus?.integerValue || 0),
      attempts: Number(f.attemptCount?.integerValue || 0),
      createdAt: f.createdAt?.stringValue,
      format: f.deliveryFormat?.stringValue || 'legacy-json',
      type: f.event?.mapValue?.fields?.type?.stringValue,
    };
  });
console.log(
  JSON.stringify(
    {
      project: 'sales-drone-avinya',
      checkedAt: new Date().toISOString(),
      statuses,
      recent,
      tenantSearchability:
        'Not established by outbox acceptance. Query the intended Dynatrace tenant separately.',
    },
    null,
    2,
  ),
);

/** Fictional component preview only. Never included by the production entry. */
import { useCallback, useRef, useState } from 'react';
import ImportReviewPanel from '../features/ImportReviewPanel';
const initialJob = {
  id: 'synthetic-review',
  filename: 'Northstar enquiries.csv',
  sheet: 'Enquiries',
  formatVersion: 3,
  status: 'Preview',
  duplicateMode: 'update',
  version: 1,
  createdByName: 'Alex Morgan',
  createdAt: '2026-10-30T09:00:00.000Z',
  updatedAt: '2026-10-30T09:00:00.000Z',
  total: 2,
  offset: 0,
  pending: 1,
  imported: 0,
  updated: 0,
  unchanged: 0,
  skipped: 0,
  invalid: 0,
  reviewOffset: 2,
  planCounts: { Update: 1, Duplicate: 1 },
};
const initialRows = [
  {
    index: 0,
    sourceRow: 2,
    row: { name: 'Asha Raman', phone: '+12025550123' },
    classification: 'Update',
    reason: 'Source and team changed this value.',
    decision: 'pending',
    mapped: ['name', 'phone', 'company'],
    leadId: 'fictional-asha',
    candidates: [
      {
        id: 'fictional-asha',
        name: 'Asha Raman',
        phone: '+12025550123',
        company: 'Northstar Buildworks',
      },
    ],
    changes: [
      {
        key: 'company',
        previous: 'Northstar Projects',
        current: 'Northstar Buildworks',
        incoming: 'Northstar Construction',
        conflict: true,
      },
    ],
    commentChanges: [],
  },
  {
    index: 1,
    sourceRow: 3,
    row: { name: 'Jamie Chen', phone: '+12025550124' },
    classification: 'Duplicate',
    reason: 'Existing name and contact match.',
    decision: 'skip',
    mapped: ['name', 'phone'],
    candidates: [
      {
        id: 'fictional-jamie',
        name: 'Jamie Chen',
        phone: '+12025550124',
        company: 'Cedar Studio',
      },
    ],
    changes: [],
    commentChanges: [],
  },
];
export default function ImportReviewFixture() {
  const [job, setJob] = useState<any>(initialJob);
  const server = useRef({ job: initialJob, rows: initialRows as any[] });
  const request = useCallback(
    async (path: string, method = 'GET', body: any = {}) => {
      const { job, rows } = server.current;
      if (method === 'GET' && path.startsWith('/imports?'))
        return { items: [job], nextCursor: null };
      if (method === 'GET' && /\/(rows|report)/.test(path))
        return { items: rows, nextCursor: null };
      if (method === 'GET') return job;
      if (method === 'PATCH') {
        const index = Number(path.split('/').pop());
        server.current.rows = rows.map((r) =>
          r.index === index
            ? {
                ...r,
                decision: body.action === 'skip' ? 'skip' : 'accept',
                incomingFields: body.incomingFields,
                clearFields: body.clearFields,
              }
            : r,
        );
        const next = { ...job, version: job.version + 1, pending: 0 };
        server.current.job = next;
        return next;
      }
      throw Error('Visual preview only. No database writes.');
    },
    [],
  );
  return (
    <>
      <p className="notice">
        Fictional review preview · No server connection or database writes
      </p>
      <ImportReviewPanel
        request={request}
        job={job}
        onJob={setJob}
        onSource={() => {}}
        canWrite
        canDelete={false}
        onImported={() => {}}
      />
    </>
  );
}

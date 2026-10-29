/** Development entry only. Real components, fictional in-memory data, no API transport. */
import React, { useCallback, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import SettingsPage from '../features/SettingsPage';
import ImportPage from '../features/ImportPage';
import { Brand, Loading, Modal } from '../components/UI';
import { LeadForm, CallForm, TaskForm } from '../components/Forms';
import TaskEditForm from '../components/TaskEditForm';
import { demoData } from '../lib/demo';
import { defaultFieldOptions, type FieldOptions } from '../lib/field-options';
import type { Session } from '../lib/types';
import { TOKEN_SCOPES } from '../../../../functions/src/api-scopes.js';
import '@fontsource-variable/manrope';
import '@fontsource-variable/inter';
import '@fontsource-variable/source-sans-3';
import '@fontsource-variable/lora';
import '../material/fonts.css';
import '../material/tokens.css';
import '../material/base.css';
import '../material/controls.css';
import '../material/shell.css';
import '../material/workspaces.css';
import '../material/dashboard.css';
import '../material/settings.css';
import '../material/login.css';
const initialSession: Session = {
  mode: 'live',
  identity: {
    uid: 'design-admin',
    email: 'admin@example.com',
    name: 'Alex Morgan',
  },
  member: {
    id: 'design-admin',
    role: 'Admin',
    active: true,
    capabilities: [],
    scope: 'all',
    version: 1,
  },
  preferences: {
    appearance: 'light',
    timezone: 'Asia/Kolkata',
    bookMode: false,
    fontStyle: 'standard',
    displayScale: 100,
    automaticReminders: true,
    reminderTime: '09:00',
    nextWeekRule: 'seven_days',
    moveWeekends: true,
  },
};
const values: Record<string, any> = {
  '/workspace-settings': {
    version: 1,
    exportsEnabled: true,
    assignedOnly: true,
  },
  '/ai-settings': {
    version: 1,
    instructions: '',
    insightMode: 'manual',
    usingDefault: true,
    defaultInstructions:
      'Prioritize overdue follow-ups, useful next steps and missing qualification context. Ground every insight in permitted workspace data.',
  },
  '/scoring-settings': {
    version: 1,
    enabled: true,
    factors: [
      {
        id: 'fit-example',
        label: 'Commercial business profile',
        group: 'fit',
        weight: 15,
        description:
          'Explicitly reported commercial contractor or developer. Do not infer from the name alone.',
        enabled: true,
      },
      {
        id: 'intent-example',
        label: 'Material quote requested',
        group: 'intent',
        weight: 20,
        description:
          'Customer supplied a detailed request for an estimate or material quote.',
        enabled: true,
      },
      {
        id: 'risk-example',
        label: 'Outside delivery coverage',
        group: 'risk',
        weight: 10,
        description: 'Project confirmed outside the delivery radius.',
        enabled: true,
      },
    ],
  },
  '/members': {
    items: [
      {
        id: 'design-admin',
        uid: 'design-admin',
        name: 'Alex Morgan',
        email: 'admin@example.com',
        role: 'Admin',
        scope: 'all',
        capabilities: [
          'leads:read',
          'leads:create',
          'leads:edit',
          'activities:write',
          'tasks:write',
          'members:write',
          'assignments:write',
        ],
        active: true,
        version: 1,
      },
      {
        id: 'design-sdr',
        uid: 'design-sdr',
        name: 'Sam Rivera',
        email: 'sam@example.com',
        role: 'SDR',
        scope: 'assigned',
        capabilities: ['leads:read', 'activities:write', 'tasks:write'],
        active: true,
        version: 1,
      },
    ],
    nextCursor: null,
  },
  '/invitations': { items: [], nextCursor: null },
  '/personal-access-tokens': {
    items: [],
    nextCursor: null,
    availableScopes: TOKEN_SCOPES,
  },
  '/imports': { items: [], nextCursor: null },
};
const formSamples = demoData();
let resetPreview = false;
let previewResetJob: any = null;
function AdminReview() {
  const [formPreview, setFormPreview] = useState('');
  const previewSave = async () => {
    throw Error('Form preview only. Nothing is saved.');
  };
  const closeForm = () => setFormPreview('');
  const [session, setSession] = useState(initialSession),
    [config, setConfig] = useState<FieldOptions>(
      structuredClone(defaultFieldOptions),
    ),
    [importing, setImporting] = useState(false);
  useEffect(() => {
    const root = document.documentElement,
      p = session.preferences;
    root.dataset.colorScheme = p.appearance === 'dark' ? 'dark' : 'light';
    root.dataset.theme = p.appearance;
    root.dataset.readingMode = p.bookMode ? 'book' : 'standard';
    root.dataset.fontStyle = p.fontStyle || 'standard';
    root.style.setProperty(
      '--interface-scale',
      String((p.displayScale || 100) / 100),
    );
  }, [session.preferences]);
  const request = useCallback(
    async (path: string, method = 'GET', body: any = {}) => {
      const key = path.split('?')[0];
      if (key === '/lead-data-reset/preview')
        return {
          previewId: '11111111-1111-4111-8111-111111111111',
          expiresAt: new Date(Date.now() + 600000).toISOString(),
          counts: { leads: 96, archived: 35 },
        };
      if (key === '/lead-data-reset' && method === 'POST') {
        if (body.confirmation !== 'DELETE ALL LEADS')
          throw Error('Confirmation required');
        previewResetJob = {
          id: 'synthetic-reset',
          status: 'Waiting',
          phase: 'reminderDeliveries',
          version: 1,
          deletedRecords: 0,
          deletedFiles: 0,
          lastError: null,
        };
        resetPreview = true;
        return previewResetJob;
      }
      if (key === '/lead-data-reset')
        return { active: resetPreview, job: previewResetJob };
      if (key === '/archived-leads') {
        const offset = Number(
          new URLSearchParams(path.split('?')[1]).get('cursor') || 0,
        );
        const rows = formSamples.leads.slice(0, 35).map((lead, i) => ({
          ...lead,
          archived: true,
          archivedAt: i ? '2026-10-29T10:00:00Z' : undefined,
        }));
        return {
          items: rows.slice(offset, offset + 30),
          nextCursor: offset + 30 < rows.length ? String(offset + 30) : null,
        };
      }
      if (key === '/me') return structuredClone(body);
      if (
        method !== 'GET' &&
        (key === '/invitations' || key.startsWith('/members/'))
      )
        throw Error('Access grants are disabled in the local design preview.');
      if (key === '/personal-access-tokens' && method !== 'GET')
        throw Error('Tokens are not issued by the local design preview.');
      if (key.startsWith('/devices'))
        throw Error(
          'Device registration is disabled in the local design preview.',
        );
      if (key === '/field-options') {
        if (method !== 'GET')
          setConfig((old) => ({ ...old, ...body, version: old.version + 1 }));
        return {
          ...config,
          ...body,
          version: config.version + Number(method !== 'GET'),
        };
      }
      if (method !== 'GET') {
        if (values[key])
          values[key] = {
            ...values[key],
            ...body,
            version: (values[key].version || 1) + 1,
          };
        else throw Error('This local preview does not write records.');
      }
      if (!(key in values))
        throw Error(
          'This operation is not available in the local design preview.',
        );
      return structuredClone(values[key]);
    },
    [config],
  );
  if (new URLSearchParams(window.location.search).get('preview') === 'startup')
    return (
      <div className="startup">
        <Brand full />
        <Loading />
      </div>
    );
  return (
    <>
      <div className="review-admin-banner">
        <strong>Fictional admin workspace</strong>
        <span>
          In-memory settings preview. No live API calls, tokens or real access
          grants.
        </span>
        <button className="text-button" onClick={() => setImporting((v) => !v)}>
          {importing ? 'Settings preview' : 'Import preview'}
        </button>
        {['New enquiry', 'Log call', 'Reminder', 'Edit task'].map((name) => (
          <button
            key={name}
            className="text-button"
            onClick={() => setFormPreview(name)}
          >
            {name}
          </button>
        ))}
        <a className="text-button" href="/">
          Back to app
        </a>
      </div>
      <Modal
        open={!!formPreview}
        onClose={closeForm}
        title={formPreview}
        description="Fictional form preview. Validation works; saving does not write records."
        wide={formPreview === 'New enquiry' || formPreview === 'Log call'}
      >
        {formPreview === 'New enquiry' ? (
          <LeadForm
            config={config}
            choices={config.values}
            onSave={previewSave}
            onCancel={closeForm}
          />
        ) : null}
        {formPreview === 'Log call' ? (
          <CallForm
            lead={formSamples.leads[0]}
            config={config}
            choices={config.values}
            onSave={previewSave}
            onCancel={closeForm}
          />
        ) : null}
        {formPreview === 'Reminder' ? (
          <TaskForm
            leadId={formSamples.leads[0].id}
            onSave={previewSave}
            onCancel={closeForm}
          />
        ) : null}
        {formPreview === 'Edit task' ? (
          <TaskEditForm
            task={formSamples.tasks[0]}
            onSave={previewSave}
            onCancel={closeForm}
          />
        ) : null}
      </Modal>
      {importing ? (
        <ImportPage demo request={request} onImported={() => {}} />
      ) : (
        <SettingsPage
          session={session}
          demo={false}
          previewOnly
          devices={[]}
          request={request}
          onRefresh={() => {}}
          fieldOptions={config}
          onFieldOptions={setConfig}
          onPreferences={(p) =>
            setSession((s) => ({
              ...s,
              preferences: { ...s.preferences, ...p },
            }))
          }
        />
      )}
    </>
  );
}
if (import.meta.env.DEV)
  createRoot(document.getElementById('root')!).render(<AdminReview />);

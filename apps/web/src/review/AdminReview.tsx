import LeadAssistantPage from "../features/LeadAssistantPage";
import LeadAssistantPrototype from './LeadAssistantPrototype';
import '../research.css';
import ResearchPage from '../features/ResearchPage';
import { researchFixture } from './ResearchFixture';
/** Development entry only. Real components, fictional in-memory data, no API transport. */
import React, { useCallback, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import SettingsPage from '../features/SettingsPage';
import ImportPage from '../features/ImportPage';
import DashboardPage from '../features/DashboardPage';
import ImportReviewFixture from './ImportReviewFixture';
import { Avatar, Brand, LeadName, Loading, Modal } from '../components/UI';
import LeadBlade from '../components/LeadBlade';
import Assignment from '../components/Assignment';
import { ScoreBadge } from '../components/LeadScore';
import { ChevronLeft, Pencil } from 'lucide-react';
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
    capabilities: ['leads:read','leads:edit'],
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
  '/lead-research-settings': {version:1,convertedStages:['Won'],failedStages:['Disqualified'],archiveReviewStages:['Disqualified'],inactivityDays:90,timezone:'Asia/Kolkata',indexingEnabled:true},
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
  const [headerLead, setHeaderLead] = useState({
    ...formSamples.leads[0],
    id: 'synthetic-header',
    name: 'Asha Raman',
    company: 'Northstar Buildworks',
    assignedToUid: null as string | null,
    stage: 'Won',
  });
  const [formPreview, setFormPreview] = useState('');
  const previewSave = async () => {
    throw Error('Form preview only. Nothing is saved.');
  };
  const closeForm = () => setFormPreview('');
  const [session, setSession] = useState(initialSession),
    [config, setConfig] = useState<FieldOptions>(
      () => {
        const fields=structuredClone(defaultFieldOptions);
        const query=new URLSearchParams(location.search);
        if(query.get('preview')==='lead-form-selects')fields.customFields.push({id:'cf_preview_product',label:'Product',type:'select',options:['Sample board','Sample panel'],required:false,deleted:false});
        if(['dashboard-fields','import-fields'].includes(query.get('preview')||'')){
          fields.labels={...fields.labels,zone:'Zone'};
          fields.values.zone=['North','South'];
          fields.customFields.push({id:'cf_preview_campaign',label:query.has('longLabels')?('Campaign '+ 'segmentation'.repeat(6)).slice(0,80):'Campaign',type:'text',options:[],required:false,deleted:false});
        }
        return fields;
      },
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
      if(key.startsWith('/lead-hygiene/')||key.startsWith('/lead-assistant/'))return structuredClone(researchFixture(path,method,body));
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
      if (key.endsWith('/restore') && method === 'POST') return {ok:true};
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
  const headerRequest = useCallback(async (path: string, method = 'GET', body?: any) => {
    if (path === '/leads/synthetic-header/assignment' && method === 'PATCH') {
      setHeaderLead((old) => ({ ...old, assignedToUid: body.assignedToUid }));
      return {};
    }
    return request(path, method, body);
  }, [request]);
  if (new URLSearchParams(window.location.search).get('preview') === 'assistant-agent')return <LeadAssistantPrototype/>;
  if (new URLSearchParams(window.location.search).get('preview') === 'lead-header')
    return <>
      <div className="review-admin-banner">Fictional lead header · in-memory preview only</div>
      <LeadBlade
        fullPage={!new URLSearchParams(window.location.search).has('overlay')}
        onClose={() => { window.location.href = '/design-admin.html'; }}
        onExpand={() => { window.location.href = '/design-admin.html?preview=lead-header'; }}
        toolbar={<>
          <button className="text-button" aria-label="Back to leads"><ChevronLeft size={16}/><span className="lead-action-label">Back to leads</span></button>
          <button className="button detail-edit-button" aria-label="Edit lead"><Pencil size={16}/><span className="lead-action-label">Edit lead</span></button>
        </>}
        identity={<div className="detail-profile">
          <Avatar name={headerLead.name}/><h2><LeadName name={headerLead.name} detail/></h2><p>{headerLead.company}</p>
          <div className="lead-header-score"><span>Lead score</span><ScoreBadge/></div>
        </div>}
        workflow={<>
          <div className="detail-section"><h3>Sales stage</h3>
            <select aria-label="Update lead stage" value={headerLead.stage} onChange={e => setHeaderLead(old=>({...old,stage:e.target.value}))}>
              {config.values.stage.map(stage=><option key={stage}>{stage}</option>)}
            </select>
          </div>
          <Assignment compact lead={headerLead} request={headerRequest} onSaved={async()=>{}}/>
        </>}
      ><p className="notice">Synthetic layout preview. No customer records or live API calls.</p></LeadBlade>
    </>;
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
          Synthetic settings / mapping preview. Use fictional files only. No live API calls, tokens or real access
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
      {['hygiene','assistant'].includes(new URLSearchParams(location.search).get('preview')||'') ? new URLSearchParams(location.search).get('preview')==='assistant'?<LeadAssistantPage request={request} demo={false}/>:<ResearchPage mode='hygiene' request={request} demo={false} canRun canAI admin/> : new URLSearchParams(location.search).get('preview') === 'dashboard-fields' ? (
        <DashboardPage demo config={{...config,hiddenFields:[...new Set([...config.hiddenFields,'stage'])]}} request={request} firstName="Explorer" timezone="Asia/Kolkata" sample={(()=>{const data=demoData();return {...data,leads:data.leads.map((lead,i)=>({...lead,zone:['North','South'][i%2],legacyStatus:['Awaiting drawings','Quoted','Under review'][i%3],customFields:{...lead.customFields,cf_preview_campaign:['Spring','Partner'][i%2]}}))}})()} refreshKey={0} stageOrder={config.values.stage} onStage={()=>{}} onCategory={()=>{}} onLead={async()=>{}} onTask={async()=>{}} onTasks={()=>{}}/>
      ) : new URLSearchParams(location.search).get('preview') === 'import-review' ? (<ImportReviewFixture />) : importing || new URLSearchParams(location.search).get('preview') === 'import-fields' ? (
        <><p className="notice">Mapping preview only. Use fictional files. Field setup stays in memory; server import validation and commits are unavailable.</p><ImportPage demo={false} config={config} canManageFields onFieldOptions={setConfig} request={request} onImported={() => {}} /></>
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

import CustomFieldInputs from './CustomFieldInputs';
import {
  defaultFieldOptions,
  FieldOptions,
  withCurrent,
  orderedFields,
  type CustomField,
  labelFor,
} from '../lib/field-options';
import { Children, isValidElement, useState, type FormEvent, type ReactElement, type ReactNode } from 'react';
import { localInstant } from '../lib/dates';
import {Lead, dateOnly} from '../lib/types';
import { ErrorMessage, SaveButton, useSubmit } from './UI';
const inputData = (e: FormEvent<HTMLFormElement>) =>
  Object.fromEntries(new FormData(e.currentTarget));
function arrangeFormFields(
  config: FieldOptions,
  standard: ReactElement<{ children?: ReactNode }>,
  custom: CustomField[] = [],
  values?: Lead['customFields'],
) {
  const controls: { id: string; control: ReactElement }[] = [];
  Children.forEach(standard.props.children, (control) => {
    if (isValidElement(control) && typeof control.key === 'string')
      controls.push({ id: control.key, control });
  });
  return orderedFields(config, [
    ...controls,
    ...custom.map((field) => ({ id: field.id, control: <CustomFieldInputs key={field.id} fields={[field]} values={values} /> })),
  ], (field) => field.id).map((field) => field.control);
}

export function LeadForm({
  lead,
  onSave,
  onCancel,
  admin = false,
  choices = defaultFieldOptions.values,
  config = defaultFieldOptions,
}: {
  config?: FieldOptions;
  lead?: Lead;
  onSave: (data: any, key: string) => Promise<void>;
  onCancel: () => void;
  admin?: boolean;
  choices?: FieldOptions['values'];
}) {
  const visible = (key: string) => !config.hiddenFields.includes(key);
  const [again, setAgain] = useState(false),
    [allowDuplicate, setAllowDuplicate] = useState(false),
    [reset, setReset] = useState(0);
  const submit = useSubmit(async (data, key, isCurrent) => {
    await onSave(data, key);
    if (!isCurrent()) return;
    if (!again) onCancel();
    else setReset((n) => n + 1);
  });
  return (
    <form
      key={reset}
      onSubmit={(e) => {
        e.preventDefault();
        const d = inputData(e);
        const customFields: Record<string, string | number | boolean | null> =
          {};
        for (const f of config.customFields.filter((f) => !f.deleted)) {
          const raw = d['custom:' + f.id];
          customFields[f.id] =
            f.type === 'checkbox'
              ? raw === 'on'
              : raw === undefined || raw === ''
                ? null
                : f.type === 'number'
                  ? Number(raw)
                  : String(raw);
          delete d['custom:' + f.id];
        }
        if (lead && !d.comments) delete d.comments;
        if (!lead) d.name ??= '';
        // Hidden country-code controls still use the configured default for new contacts.
        if (!lead && !visible('countryCode'))
          d.countryCode = choices.countryCode[0];
        submit.run({
          ...d,
          customFields,
          tags: lead?.tags || [],
          ...(lead ? { expectedVersion: lead.version } : { allowDuplicate }),
        });
      }}
    >
      <datalist id="workspace-location-options">
        {choices.location.map((v) => (
          <option key={v}>{v}</option>
        ))}
      </datalist>
      <datalist id="workspace-sector-options">
        {choices.zone.map((v) => (
          <option key={v}>{v}</option>
        ))}
      </datalist>
      <div className="form-grid">{arrangeFormFields(config, <>

        {visible('source') ? (
          <label key="source" className="material-field">
            <span className="field-label">{labelFor(config, 'source')}</span>
            <select name="source" defaultValue={lead?.source || ''} required={!lead && choices.source.length > 0}>
              <option value="">Choose an enquiry source</option>
              {withCurrent(choices.source, lead?.source).map((source) => (
                <option key={source}>{source}</option>
              ))}
            </select>
          </label>
        ) : null}
        {visible('name') ? <label key="name" className="material-field">
          <span className="field-label">{labelFor(config, 'name')}</span>
          <input
            name="name"
            autoFocus
            maxLength={200}
            defaultValue={lead?.name}
            autoComplete="name"
          />
        </label> : null}
        {!lead || visible('phone') ? (
          <label key="phone" className="material-field">
            <span className="field-label">{labelFor(config, 'phone')}</span>
            <input
              name="phone"
              required={!lead || (!lead.needsReview && !lead.email && !visible('email'))}
              type="tel"
              maxLength={40}
              defaultValue={lead?.phone}
              autoComplete="tel"
            />
            {lead?.originalPhone ? (
              <small>Original: {lead.originalPhone}</small>
            ) : null}
          </label>
        ) : null}
        {visible('company') ? (
          <label key="company" className="material-field">
            <span className="field-label">{labelFor(config, 'company')}</span>
            <input
              name="company"
              maxLength={200}
              defaultValue={lead?.company}
              autoComplete="organization"
            />
          </label>
        ) : null}
        {visible('location') ? (
          <label key="location" className="material-field">
            <span className="field-label">{labelFor(config, 'location')}</span>
            <input
              name="location"
              list="workspace-location-options"
              maxLength={200}
              defaultValue={lead?.location}
            />
          </label>
        ) : null}
        {visible('zone') ? (
          <label key="zone" className="material-field">
            <span className="field-label">{labelFor(config, 'zone')}</span>
            <input
              name="zone"
              list="workspace-sector-options"
              maxLength={200}
              defaultValue={lead?.zone}
            />
          </label>
        ) : null}
        <label key="enquiryDate" className="material-field">
          <span className="field-label">{labelFor(config, 'enquiryDate')}</span>
          <input
            name="enquiryDate"
            type="date"
            required={!lead?.needsReview}
            defaultValue={lead ? lead.enquiryDate : dateOnly()}
          />
          {lead?.originalEnquiryDate ? (
            <small>Original: {lead.originalEnquiryDate}</small>
          ) : null}
        </label>
        {visible('legacyStatus') ? (
          <label key="legacyStatus" className="material-field">
            <span className="field-label">
              {labelFor(config, 'legacyStatus')}
            </span>
            <input
              name="legacyStatus"
              list="enquiry-statuses"
              maxLength={200}
              defaultValue={lead?.legacyStatus}
            />
            <datalist id="enquiry-statuses">
              {choices.legacyStatus.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </datalist>
          </label>
        ) : null}
        {lead || visible('stage') ? (
          <label key="stage" className="material-field">
            <span className="field-label">{labelFor(config, 'stage')}</span>
            <select name="stage" defaultValue={lead?.stage || 'New'}>
              {withCurrent(choices.stage, lead?.stage).map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
        ) : null}
        {visible('initialDiscussion') ? (
          <label key="initialDiscussion" className="material-field full">
            <span className="field-label">
              {labelFor(config, 'initialDiscussion')}
            </span>
            <textarea
              name="initialDiscussion"
              rows={3}
              maxLength={4000}
              defaultValue={lead?.initialDiscussion}
            />
          </label>
        ) : null}

        {visible('email') ? (
          <label key="email" className="material-field">
            <span className="field-label">{labelFor(config, 'email')}</span>
            <input
              name="email"
              required={!!lead && !lead.needsReview && !visible('phone') && !lead.phone}
              type="email"
              maxLength={200}
              defaultValue={lead?.email}
            />
          </label>
        ) : null}
        {visible('countryCode') ? (
          <label key="countryCode" className="material-field">
            <span className="field-label">{labelFor(config, 'countryCode')}</span>
            <select
              name="countryCode"
              defaultValue={lead?.countryCode || choices.countryCode[0]}
            >
              {withCurrent(choices.countryCode, lead?.countryCode).map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
        ) : null}
        {lead && visible('comments') ? (
          <label key="comments" className="material-field full">
            <span className="field-label">Add a comment</span>
            <textarea
              name="comments"
              rows={3}
              maxLength={4000}
              placeholder="A new entry in this lead’s timeline"
            />
          </label>
        ) : null}
      </>,
      config.customFields.filter((field) => !field.deleted),
      lead?.customFields,
    )}</div>
      <p className="field-hint">
        New initial discussions and comments are checked for dated follow-ups
        when automatic reminders are enabled. Manual reminders remain available.
      </p>
      {admin && lead?.needsReview ? (
        <p className="field-hint">
          This legacy enquiry needs review. Preserve missing values until
          confirmed; clear review in lead details after correcting the record.
        </p>
      ) : null}
      <ErrorMessage error={submit.error} />
      {!lead && submit.error.toLowerCase().includes('already exists') ? (
        <label className="check">
          <input
            type="checkbox"
            checked={allowDuplicate}
            onChange={(e) => setAllowDuplicate(e.target.checked)}
          />
          Create a separate lead despite the duplicate contact
        </label>
      ) : null}
      <div className="form-footer">
        {!lead ? (
          <label className="check">
            <input
              type="checkbox"
              checked={again}
              onChange={(e) => setAgain(e.target.checked)}
            />
            Save and add another
          </label>
        ) : (
          <span />
        )}
        <div>
          <button
            className="button"
            type="button"
            onClick={onCancel}
            disabled={submit.busy}
          >
            Cancel
          </button>
          <SaveButton
            busy={submit.busy}
            label={lead ? 'Save changes' : 'Create enquiry'}
          />
        </div>
      </div>
    </form>
  );
}
export function CallForm({
  lead,
  onSave,
  onCancel,
  canEdit = true,
  canTask = true,
  choices = defaultFieldOptions.values,
  config = defaultFieldOptions,
}: {
  lead: Lead;
  onSave: (data: any, key: string) => Promise<void>;
  onCancel: () => void;
  canEdit?: boolean;
  canTask?: boolean;
  choices?: FieldOptions['values'];
  config?: FieldOptions;
}) {
  const [followUp, setFollowUp] = useState(false);
  const [disposition, setDisposition] = useState('None');
  const submit = useSubmit(async (d, k, isCurrent) => {
    if (d.followUp?.localDueAt) {
      d.followUp.dueAt = localInstant(d.followUp.localDueAt);
      delete d.followUp.localDueAt;
    }
    if (d.localDueAt) {
      d.dueAt = localInstant(d.localDueAt);
      delete d.localDueAt;
    }
    await onSave(d, k);
    if (isCurrent()) onCancel();
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const d = inputData(e);
        const payload: any = {
          type: 'call',
          expectedVersion: lead.version,
          outcome: d.outcome,
          disposition,
          notes: d.notes,
        };
        if (d.durationSeconds)
          payload.durationSeconds = Number(d.durationSeconds);
        if (canEdit && d.stage !== lead.stage) payload.stage = d.stage;
        if (followUp)
          payload.followUp = {
            title: d.title,
            localDueAt: String(d.dueAt),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            kind: 'outreach',
          };
        submit.run(payload);
      }}
    >
      <div className="form-grid">{arrangeFormFields(config, <>
        <label key="outcome" className="material-field">
          <span className="field-label">{labelFor(config, 'outcome')}</span>
          <select name="outcome" autoFocus>
            {choices.outcome.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label key="disposition" className="material-field">
          <span className="field-label">{labelFor(config, 'disposition')}</span>
          <select
            value={disposition}
            onChange={(e) => {
              setDisposition(e.target.value);
              if (e.target.value === 'Do not contact') setFollowUp(false);
            }}
          >
            {choices.disposition.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label key="durationSeconds" className="material-field">
          <span className="field-label">Duration (seconds, optional)</span>
          <input
            type="number"
            min="0"
            max="86400"
            name="durationSeconds"
            placeholder="Enter if known"
          />
        </label>
        {canEdit ? (
          <label key="stage" className="material-field">
            <span className="field-label">{labelFor(config, 'stage')}</span>
            <select name="stage" defaultValue={lead.stage}>
              {withCurrent(choices.stage, lead?.stage).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        ) : null}
        <label key="notes" className="material-field full">
          <span className="field-label">Conversation notes</span>
          <textarea
            name="notes"
            rows={4}
            maxLength={4000}
            placeholder="What did you discuss? What should happen next?"
          />
        </label>
        </>)}
        {canTask && disposition !== 'Do not contact' ? (
          <label className="check full">
            <input
              type="checkbox"
              checked={followUp}
              onChange={(e) => setFollowUp(e.target.checked)}
            />{' '}
            Add a follow-up reminder
          </label>
        ) : null}
        {followUp ? (
          <>
            <label className="material-field">
              <span className="field-label">Next action</span>
              <input
                name="title"
                required
                maxLength={250}
                placeholder="e.g. Share the product overview"
              />
            </label>
            <label className="material-field">
              <span className="field-label">Remind me</span>
              <input name="dueAt" type="datetime-local" required />
            </label>
            <p className="field-hint full">
              Time is in your device timezone:{' '}
              {Intl.DateTimeFormat().resolvedOptions().timeZone}.
            </p>
          </>
        ) : null}
      </div>
      <ErrorMessage error={submit.error} />
      <div className="form-footer">
        <p className="field-hint">
          Dated follow-ups in comments are checked automatically. A manual
          reminder takes priority.
        </p>
        <div>
          <button
            type="button"
            className="button"
            onClick={onCancel}
            disabled={submit.busy}
          >
            Cancel
          </button>
          <SaveButton busy={submit.busy} label="Save call" />
        </div>
      </div>
    </form>
  );
}
export function TaskForm({
  leadId,
  onSave,
  onCancel,
}: {
  leadId?: string;
  onSave: (data: any, key: string) => Promise<void>;
  onCancel: () => void;
}) {
  const submit = useSubmit(async (d, k, isCurrent) => {
    if (d.followUp?.localDueAt) {
      d.followUp.dueAt = localInstant(d.followUp.localDueAt);
      delete d.followUp.localDueAt;
    }
    if (d.localDueAt) {
      d.dueAt = localInstant(d.localDueAt);
      delete d.localDueAt;
    }
    await onSave(d, k);
    if (isCurrent()) onCancel();
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const d = inputData(e);
        submit.run({
          title: d.title,
          localDueAt: String(d.dueAt),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          kind: d.kind,
          ...(leadId ? { leadId } : {}),
        });
      }}
    >
      <div className="form-grid">
        <label className="material-field full">
          <span className="field-label">What would you like to remember?</span>
          <input
            required
            name="title"
            maxLength={250}
            autoFocus
            placeholder="e.g. Follow up on the enquiry"
          />
        </label>
        <label className="material-field">
          <span className="field-label">Due date and time</span>
          <input name="dueAt" type="datetime-local" required />
        </label>
        <label className="material-field">
          <span className="field-label">Task type</span>
          <select
            name="kind"
            defaultValue={leadId ? 'outreach' : 'administrative'}
          >
            <option value="outreach">Outreach</option>
            <option value="administrative">Administrative</option>
          </select>
        </label>
      </div>
      <p className="field-hint">
        Entered in {Intl.DateTimeFormat().resolvedOptions().timeZone}. Push is
        optional; the task always stays in your list.
      </p>
      <ErrorMessage error={submit.error} />
      <div className="form-footer">
        <span />
        <div>
          <button className="button" type="button" onClick={onCancel}>
            Cancel
          </button>
          <SaveButton busy={submit.busy} label="Set reminder" />
        </div>
      </div>
    </form>
  );
}
export function NoteForm({
  onSave,
  onCancel,
}: {
  onSave: (data: any, key: string) => Promise<void>;
  onCancel: () => void;
}) {
  const submit = useSubmit(async (d, k, isCurrent) => {
    if (d.followUp?.localDueAt) {
      d.followUp.dueAt = localInstant(d.followUp.localDueAt);
      delete d.followUp.localDueAt;
    }
    if (d.localDueAt) {
      d.dueAt = localInstant(d.localDueAt);
      delete d.localDueAt;
    }
    await onSave(d, k);
    if (isCurrent()) onCancel();
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit.run(inputData(e));
      }}
    >
      <label className="material-field">
        <span className="field-label">Comment</span>
        <textarea
          name="notes"
          required
          autoFocus
          maxLength={4000}
          rows={5}
          placeholder="e.g. Call them next week, or email the proposal tomorrow at 11 AM"
        />
      </label>
      <p className="field-hint">
        Clear, dated follow-ups are scheduled in the background when automatic
        reminders are enabled in Settings.
      </p>
      <ErrorMessage error={submit.error} />
      <div className="form-footer">
        <span />
        <div>
          <button className="button" type="button" onClick={onCancel}>
            Cancel
          </button>
          <SaveButton busy={submit.busy} label="Add comment" />
        </div>
      </div>
    </form>
  );
}
export function RescheduleForm({
  task,
  action = 'reschedule',
  initialDueAt,
  onSave,
  onCancel,
}: {
  task: import('../lib/types').Task;
  action?: 'reschedule' | 'complete' | 'reopen';
  initialDueAt?: string;
  onSave: (data: any, key: string) => Promise<void>;
  onCancel: () => void;
}) {
  const submit = useSubmit(async (d, k, isCurrent) => {
    await onSave(
      {
        expectedVersion: task.version,
        comment: d.comment,
        ...(action === 'complete' ? { state: 'Completed' } : {
          dueAt: localInstant(d.dueAt),
          ...(action === 'reopen' ? { state: 'Pending' } : {}),
        }),
      },
      k,
    );
    if (isCurrent()) onCancel();
  });
  const value = new Date(action === 'reopen' ? Math.max(Date.parse(task.dueAt), Date.now() + 3600000) : initialDueAt || task.dueAt);
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit.run(inputData(e));
      }}
    >
      {action !== 'complete' ? <>
      <label className="material-field">
        <span className="field-label">New date and time</span>
        <input
          name="dueAt"
          type="datetime-local"
          required
          defaultValue={local}
        />
      </label>
      <p className="field-hint">
        Time is in {Intl.DateTimeFormat().resolvedOptions().timeZone}.
      </p>
      </> : null}
      <label className="material-field">
        <span className="field-label">Comment</span>
        <textarea name="comment" required maxLength={500} rows={3} />
      </label>
      <ErrorMessage error={submit.error} />
      <div className="form-footer">
        <button className="button" type="button" onClick={onCancel}>
          Cancel
        </button>
        <SaveButton busy={submit.busy} label={action === 'complete' ? 'Complete task' : action === 'reopen' ? 'Reopen task' : 'Reschedule reminder'} />
      </div>
    </form>
  );
}
export function CorrectionForm({
  activity,
  onSave,
  onCancel,
  choices = defaultFieldOptions.values,
}: {
  activity: import('../lib/types').Entity;
  choices?: FieldOptions['values'];
  onSave: (data: any, key: string) => Promise<void>;
  onCancel: () => void;
}) {
  const submit = useSubmit(async (d, k, isCurrent) => {
    await onSave(
      { ...d, type: activity.type, expectedRevision: activity.revision },
      k,
    );
    if (isCurrent()) onCancel();
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit.run(inputData(e));
      }}
    >
      <div className="form-grid">
        {activity.type === 'call' ? (
          <>
            <label className="material-field">
              <span className="field-label">Call outcome</span>
              <select name="outcome" defaultValue={activity.outcome}>
                {withCurrent(choices.outcome, activity.outcome).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="material-field">
              <span className="field-label">Disposition</span>
              <select
                name="disposition"
                defaultValue={activity.disposition || 'None'}
              >
                {choices.disposition.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </>
        ) : null}
        <label className="material-field full">
          <span className="field-label">Notes</span>
          <textarea
            name="notes"
            rows={4}
            maxLength={4000}
            defaultValue={activity.notes}
          />
        </label>
      </div>
      <p className="field-hint">
        The original entry is retained. An untouched automatic reminder is
        replaced when this note changes. Reminders you edited manually are
        preserved. Contact restrictions are managed separately.
      </p>
      <ErrorMessage error={submit.error} />
      <div className="form-footer">
        <button className="button" type="button" onClick={onCancel}>
          Cancel
        </button>
        <SaveButton busy={submit.busy} label="Save correction" />
      </div>
    </form>
  );
}

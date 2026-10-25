import CustomFieldInputs from './CustomFieldInputs';
import {
  defaultFieldOptions,
  FieldOptions,
  withCurrent,
  labelFor,
} from '../lib/field-options';
import { FormEvent, useState } from 'react';
import { localInstant } from '../lib/dates';
import { Lead, stages, outcomes, dateOnly } from '../lib/types';
import { ErrorMessage, SaveButton, useSubmit } from './UI';
const inputData = (e: FormEvent<HTMLFormElement>) =>
  Object.fromEntries(new FormData(e.currentTarget));
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
        submit.run({
          ...d,
          customFields,
          tags: lead?.tags || [],
          ...(lead ? { expectedVersion: lead.version } : { allowDuplicate }),
        });
      }}
    >
      <datalist id="workspace-source-options">
        {choices.source.map((v) => (
          <option key={v}>{v}</option>
        ))}
      </datalist>
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
      <div className="form-grid">
        {visible('source') ? (
          <label>
            {labelFor(config, 'source')}
            <input
              name="source"
              list="workspace-source-options"
              maxLength={200}
              defaultValue={lead?.source || choices.source[0] || ''}
            />
          </label>
        ) : null}
        <label>
          {labelFor(config, 'name')}
          <input
            name="name"
            required={!lead?.needsReview}
            autoFocus
            maxLength={200}
            defaultValue={lead?.name}
            autoComplete="name"
          />
        </label>
        <label>
          {labelFor(config, 'phone')}
          <input
            name="phone"
            type="tel"
            maxLength={40}
            defaultValue={lead?.phone}
            autoComplete="tel"
          />
          {lead?.originalPhone ? (
            <small>Original: {lead.originalPhone}</small>
          ) : null}
        </label>
        {visible('company') ? (
          <label>
            {labelFor(config, 'company')}
            <input
              name="company"
              maxLength={200}
              defaultValue={lead?.company}
              autoComplete="organization"
            />
          </label>
        ) : null}
        {visible('location') ? (
          <label>
            {labelFor(config, 'location')}
            <input
              name="location"
              list="workspace-location-options"
              maxLength={200}
              defaultValue={lead?.location}
            />
          </label>
        ) : null}
        {visible('zone') ? (
          <label>
            {labelFor(config, 'zone')}
            <input
              name="zone"
              list="workspace-sector-options"
              maxLength={200}
              defaultValue={lead?.zone}
            />
          </label>
        ) : null}
        <label>
          {labelFor(config, 'enquiryDate')}
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
          <label>
            {labelFor(config, 'legacyStatus')}
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
        <label>
          {labelFor(config, 'stage')}
          <select name="stage" defaultValue={lead?.stage || 'New'}>
            {withCurrent(choices.stage, lead?.stage).map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        {visible('initialDiscussion') ? (
          <label className="full">
            {labelFor(config, 'initialDiscussion')}
            <textarea
              name="initialDiscussion"
              rows={3}
              maxLength={4000}
              defaultValue={lead?.initialDiscussion}
            />
          </label>
        ) : null}
      </div>

      <div className="form-grid">
        <label>
          {labelFor(config, 'email')}
          <input
            name="email"
            type="email"
            maxLength={200}
            defaultValue={lead?.email}
          />
        </label>
        <label>
          {labelFor(config, 'countryCode')}
          <select
            name="countryCode"
            defaultValue={lead?.countryCode || choices.countryCode[0]}
          >
            {withCurrent(choices.countryCode, lead?.countryCode).map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        {lead ? (
          <label className="full">
            Add a comment
            <textarea
              name="comments"
              rows={3}
              maxLength={4000}
              placeholder="A new entry in this lead’s timeline"
            />
          </label>
        ) : null}
      </div>
      {config.customFields.some((f) => !f.deleted) ? (
        <fieldset className="custom-field-inputs">
          <legend>Additional information</legend>
          <div className="form-grid">
            <CustomFieldInputs
              fields={config.customFields}
              values={lead?.customFields}
            />
          </div>
        </fieldset>
      ) : null}
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
      <div className="form-grid">
        <label>
          {labelFor(config, 'outcome')}
          <select name="outcome" autoFocus>
            {choices.outcome.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          {labelFor(config, 'disposition')}
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
        <label>
          Duration (seconds, optional)
          <input
            type="number"
            min="0"
            max="86400"
            name="durationSeconds"
            placeholder="Enter if known"
          />
        </label>
        {canEdit ? (
          <label>
            {labelFor(config, 'stage')}
            <select name="stage" defaultValue={lead.stage}>
              {withCurrent(choices.stage, lead?.stage).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="full">
          Conversation notes
          <textarea
            name="notes"
            rows={4}
            maxLength={4000}
            placeholder="What did you discuss? What should happen next?"
          />
        </label>
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
            <label>
              Next action
              <input
                name="title"
                required
                maxLength={250}
                placeholder="e.g. Share the product overview"
              />
            </label>
            <label>
              Remind me
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
        <label className="full">
          What would you like to remember?
          <input
            required
            name="title"
            maxLength={250}
            autoFocus
            placeholder="e.g. Follow up on the enquiry"
          />
        </label>
        <label>
          Due date and time
          <input name="dueAt" type="datetime-local" required />
        </label>
        <label>
          Task type
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
      <label>
        Comment
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
  onSave,
  onCancel,
}: {
  task: import('../lib/types').Task;
  onSave: (data: any, key: string) => Promise<void>;
  onCancel: () => void;
}) {
  const submit = useSubmit(async (d, k, isCurrent) => {
    await onSave(
      { dueAt: localInstant(d.dueAt), expectedVersion: task.version },
      k,
    );
    if (isCurrent()) onCancel();
  });
  const value = new Date(task.dueAt);
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
      <label>
        New date and time
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
      <ErrorMessage error={submit.error} />
      <div className="form-footer">
        <button className="button" type="button" onClick={onCancel}>
          Cancel
        </button>
        <SaveButton busy={submit.busy} label="Reschedule reminder" />
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
            <label>
              Call outcome
              <select name="outcome" defaultValue={activity.outcome}>
                {withCurrent(choices.outcome, activity.outcome).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Disposition
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
        <label className="full">
          Notes
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

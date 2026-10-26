import { displayScales, normalizeDisplayScale } from '../lib/display-scale';
import { interfaceFonts, normalizeFontStyle } from '../lib/fonts';
import settingsSections from '../lib/settings-sections.json';
import WorkspacePolicySettings from './WorkspacePolicySettings';
import AIPersonalizationSettings from './AIPersonalizationSettings';
import aboutStoryIllustration from '../../../../assets/salesdrone-guide-illustrations/04-the-story-behind-each-row.png';
import DeveloperSettings from './DeveloperSettings';
import { APP_VERSION } from '../lib/version';
import PeopleSettings from './PeopleSettings';
import ScoringSettings from './ScoringSettings';
import LeadFieldManager from './LeadFieldManager';
import FieldOptionsEditor from './FieldOptionsEditor';
import { FieldOptions } from '../lib/field-options';
import { useState, useEffect } from 'react';
import {
  Bell,
  Monitor,
  BookOpen,
  Sun,
  Moon,
  Smartphone,
  ShieldCheck,
  Check,
  ExternalLink,
  UserRound,
  SlidersHorizontal,
  ListFilter,
  Info,
  ChevronRight,
  Sparkles,
  CodeXml,
} from 'lucide-react';
import { Session, Entity } from '../lib/types';
import { Avatar, ErrorMessage, SaveButton, useSubmit } from '../components/UI';
import { enablePush, revokeThisDevice } from '../lib/api';
export default function SettingsPage({
  session,
  guestPreferences,
  demo,
  devices,
  request,
  onRefresh,
  onPreferences,
  fieldOptions,
  onFieldOptions,
  initialSection,
  onWorkspacePolicyChanged,
}: {
  initialSection?: string;
  onWorkspacePolicyChanged?: () => void;
  session: Session | null;
  guestPreferences?: Partial<Session['preferences']>;
  fieldOptions: FieldOptions;
  onFieldOptions: (options: FieldOptions) => void;
  demo: boolean;
  devices: Entity[];
  request: (p: string, m?: string, b?: any, k?: string) => Promise<any>;
  onRefresh: () => void;
  onPreferences: (p: any) => void;
}) {
  const isAdmin = !demo && session?.member?.role === 'Admin';
  const icons: Record<string, typeof UserRound> = {
    profile: UserRound,
    appearance: Monitor,
    notifications: Smartphone,
    workspace: ShieldCheck,
    fields: SlidersHorizontal,
    choices: ListFilter,
    ai: SlidersHorizontal,
    reminders: Bell,
    scoring: SlidersHorizontal,
    developer: CodeXml,
    access: ShieldCheck,
    about: Info,
  };
  const sections = settingsSections
    .filter((item) => !item.admin || isAdmin)
    .map((item) => ({ ...item, icon: icons[item.id] }));
  const fieldIds = ['fields', 'choices'];
  const fieldSections = sections.filter(
    (item) => item.group === 'manageFields',
  );
  const aiIds = ['ai', 'reminders', 'scoring'];
  const aiSections = sections
    .filter((item) => aiIds.includes(item.id))
    .sort((a, b) => aiIds.indexOf(a.id) - aiIds.indexOf(b.id));
  const [section, setSection] = useState(() => {
    const desired =
      initialSection ||
      new URLSearchParams(window.location.search).get('section') ||
      'profile';
    return sections.some((item) => item.id === desired) ? desired : 'profile';
  });
  const [aiExpanded, setAIExpanded] = useState(() =>
    aiIds.includes(
      initialSection ||
        new URLSearchParams(window.location.search).get('section') ||
        '',
    ),
  );
  const [fieldsExpanded, setFieldsExpanded] = useState(() =>
    fieldIds.includes(
      initialSection ||
        new URLSearchParams(window.location.search).get('section') ||
        '',
    ),
  );
  const currentSection = sections.find((s) => s.id === section) || sections[0];
  const personalSections = sections.filter((item) =>
    ['profile', 'appearance', 'notifications'].includes(item.id),
  );
  const workspaceSections = sections.filter((item) =>
    ['workspace', 'developer', 'access'].includes(item.id),
  );
  const chooseSection = (id: string) => {
    setSection(id);
    setMessage('');
    if (aiIds.includes(id)) setAIExpanded(true);
    if (fieldIds.includes(id)) setFieldsExpanded(true);
  };
  const navButton = (item: (typeof sections)[number]) => (
    <button
      key={item.id}
      aria-current={currentSection.id === item.id ? 'page' : undefined}
      onClick={() => chooseSection(item.id)}
    >
      <item.icon size={18} />
      <span>{item.label}</span>
      <ChevronRight size={15} />
    </button>
  );
  const preferences = (!demo && session?.preferences) || {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    appearance: 'system',
    bookMode: false,
    ...guestPreferences,
  };
  const [displayScale, setDisplayScale] = useState(() =>
    normalizeDisplayScale(preferences.displayScale),
  );
  useEffect(
    () => setDisplayScale(normalizeDisplayScale(preferences.displayScale)),
    [preferences.displayScale],
  );
  const [fontStyle, setFontStyle] = useState(() =>
    normalizeFontStyle(preferences.fontStyle),
  );
  useEffect(
    () => setFontStyle(normalizeFontStyle(preferences.fontStyle)),
    [preferences.fontStyle],
  );
  const [bookMode, setBookMode] = useState(preferences.bookMode === true);
  useEffect(
    () => setBookMode(preferences.bookMode === true),
    [preferences.bookMode],
  );
  const [appearance, setAppearance] = useState(preferences.appearance),
    [timezone, setTimezone] = useState(preferences.timezone),
    [automaticReminders, setAutomaticReminders] = useState(
      session?.preferences.automaticReminders !== false,
    ),
    [reminderTime, setReminderTime] = useState(
      session?.preferences.reminderTime || '10:00',
    ),
    [nextWeekRule, setNextWeekRule] = useState(
      session?.preferences.nextWeekRule || 'seven_days',
    ),
    [moveWeekends, setMoveWeekends] = useState(
      session?.preferences.moveWeekends || false,
    ),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  useEffect(
    () => setAppearance(preferences.appearance),
    [preferences.appearance],
  );
  const submit = useSubmit(async (data) => {
    const settings = {
      ...data,
      bookMode,
      fontStyle,
      displayScale,
      automaticReminders,
      reminderTime,
      nextWeekRule,
      moveWeekends,
    };
    if (!demo) await request('/me', 'PATCH', settings);
    onPreferences(settings);
    setMessage('Preferences saved.');
  });
  async function push() {
    setBusy(true);
    setError('');
    try {
      await enablePush(navigator.platform + ' browser');
      setMessage('Notifications enabled for this device.');
      onRefresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function deviceAction(d: Entity, action: 'test' | 'revoke') {
    setError('');
    try {
      if (action === 'test') {
        await request('/devices/' + d.id + '/test', 'POST', {});
        setMessage('Test notification sent to the delivery service.');
      } else {
        if (d.id === localStorage.getItem('salesdrone.device'))
          await revokeThisDevice();
        else await request('/devices/' + d.id, 'DELETE');
        onRefresh();
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="page-body settings-page">
      <div className="page-title">
        <div>
          <span className="eyebrow">MAKE IT YOURS</span>
          <h1>Settings</h1>
          <p>A workspace that fits the way you work.</p>
          <a
            className="text-button"
            href="https://theharithsa.github.io/SalesDrone/settings.html"
            target="_blank"
            rel="noreferrer"
          >
            Read the settings guide <ExternalLink size={14} />
          </a>
        </div>
      </div>
      <div className="settings-layout">
        <label className="settings-section-select">
          Settings section
          <select
            value={currentSection.id}
            onChange={(e) => {
              chooseSection(e.target.value);
            }}
          >
            <optgroup label="Personal">
              {personalSections.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </optgroup>
            {workspaceSections.length ? (
              <optgroup label="Workspace · Admin">
                {workspaceSections.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {fieldSections.length ? (
              <optgroup label="Manage fields">
                {fieldSections.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </optgroup>
            ) : null}
            <optgroup label="AvinyaIntelligence">
              {aiSections.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Product">
              <option value="about">About SalesDrone</option>
            </optgroup>
          </select>
        </label>
        <nav className="settings-navigation" aria-label="Settings sections">
          <span className="eyebrow">PERSONAL</span>
          {personalSections.map(navButton)}
          {workspaceSections.length ? (
            <>
              <span className="eyebrow">WORKSPACE · ADMIN</span>
              {workspaceSections.map(navButton)}
            </>
          ) : null}
          {fieldSections.length ? (
            <div
              className={
                'settings-ai-group' +
                (fieldIds.includes(currentSection.id) ? ' is-active' : '')
              }
            >
              <button
                type="button"
                className="settings-ai-toggle"
                aria-expanded={fieldsExpanded}
                aria-controls="settings-field-children"
                onClick={() => setFieldsExpanded((v) => !v)}
              >
                <SlidersHorizontal size={18} />
                <span>Manage fields</span>
                <ChevronRight
                  size={15}
                  className={fieldsExpanded ? 'expanded' : ''}
                />
              </button>
              <div
                id="settings-field-children"
                className="settings-ai-children"
                hidden={!fieldsExpanded}
              >
                {fieldSections.map(navButton)}
              </div>
            </div>
          ) : null}
          <div
            className={
              'settings-ai-group' +
              (aiIds.includes(currentSection.id) ? ' is-active' : '')
            }
          >
            <button
              type="button"
              className="settings-ai-toggle"
              aria-expanded={aiExpanded}
              aria-controls="settings-ai-children"
              onClick={() => setAIExpanded((v) => !v)}
            >
              <Sparkles size={18} />
              <span>AvinyaIntelligence</span>
              <ChevronRight
                size={15}
                className={aiExpanded ? 'expanded' : ''}
              />
            </button>
            <div
              id="settings-ai-children"
              className="settings-ai-children"
              hidden={!aiExpanded}
            >
              {aiSections.map(navButton)}
            </div>
          </div>
          <span className="eyebrow">PRODUCT</span>
          {sections.filter((item) => item.id === 'about').map(navButton)}
        </nav>
        <div className="settings-content">
          <div className="settings-section-header">
            <span className="eyebrow">
              {fieldIds.includes(currentSection.id)
                ? 'MANAGE FIELDS'
                : aiIds.includes(currentSection.id)
                  ? 'AVINYAINTELLIGENCE'
                  : workspaceSections.some(
                        (item) => item.id === currentSection.id,
                      )
                    ? 'WORKSPACE SETTINGS'
                    : 'YOUR SETTINGS'}
            </span>
            <h2>{currentSection.label}</h2>
            <p>{currentSection.description}</p>
          </div>
          {message && section !== 'notifications' ? (
            <p className="success-message" role="status">
              {message}
            </p>
          ) : null}
          {isAdmin && section === 'workspace' ? (
            <WorkspacePolicySettings
              request={request}
              onChanged={onWorkspacePolicyChanged || onRefresh}
            />
          ) : null}
          {isAdmin && section === 'fields' ? (
            <LeadFieldManager
              config={fieldOptions}
              request={request}
              onChanged={onFieldOptions}
            />
          ) : null}
          {isAdmin && section === 'choices' ? (
            <FieldOptionsEditor
              config={fieldOptions}
              request={request}
              onChanged={onFieldOptions}
            />
          ) : null}
          {section === 'profile' ? (
            <section className="panel profile-panel">
              <Avatar
                name={session?.identity.name || 'Demo User'}
                photoURL={session?.identity.photoURL}
              />
              <div>
                <h2>{session?.identity.name || 'Sample workspace'}</h2>
                <p>
                  {session?.identity.email ||
                    'Fictional data. A real feel for the workflow.'}
                </p>
              </div>
              <span className="role-label">
                <ShieldCheck size={14} />
                {demo ? 'Demo' : session?.member?.role}
              </span>
            </section>
          ) : null}
          {section === 'profile' ? (
            <section className="panel">
              <h3>Connected with Google</h3>
              <p className="field-hint">
                Your name and profile photo come from your Google account. If a
                photo is unavailable, your initials appear instead.
              </p>
              <dl className="profile-facts">
                <div>
                  <dt>Email address</dt>
                  <dd>{session?.identity.email || 'Demo workspace'}</dd>
                </div>
                <div>
                  <dt>Workspace role</dt>
                  <dd>{demo ? 'Demo' : session?.member?.role}</dd>
                </div>
              </dl>
            </section>
          ) : null}
          {['appearance', 'reminders'].includes(section) ? (
            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>
                    {section === 'appearance'
                      ? 'Appearance & time'
                      : 'Reminders from your notes'}
                  </h2>
                  <p>
                    {section === 'appearance'
                      ? 'Use your system preference or choose your own.'
                      : 'Set defaults for automatic follow-ups.'}
                  </p>
                </div>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submit.run({ appearance, timezone });
                }}
              >
                {section === 'appearance' ? (
                  <>
                    <div className="appearance-options">
                      {[
                        ['system', Monitor, 'System'],
                        ['light', Sun, 'Light'],
                        ['dark', Moon, 'Dark'],
                      ].map(([value, Icon, label]) => {
                        const I = Icon as typeof Monitor;
                        return (
                          <button
                            key={String(value)}
                            type="button"
                            aria-pressed={appearance === value}
                            className={appearance === value ? 'selected' : ''}
                            onClick={() =>
                              setAppearance(value as typeof appearance)
                            }
                          >
                            <I size={22} />
                            {String(label)}
                            {appearance === value ? <Check size={14} /> : null}
                          </button>
                        );
                      })}
                    </div>
                    <section
                      className="display-scale-settings"
                      aria-labelledby="display-scale-heading"
                    >
                      <h3 id="display-scale-heading">Display scale</h3>
                      <label>
                        Desktop display zoom
                        <select
                          value={displayScale}
                          onChange={(e) =>
                            setDisplayScale(
                              normalizeDisplayScale(Number(e.target.value)),
                            )
                          }
                          aria-describedby="display-scale-help"
                        >
                          {displayScales.map((scale) => (
                            <option key={scale} value={scale}>
                              {scale}%
                              {scale === 100
                                ? ' — Standard'
                                : scale < 100
                                  ? ' — More content'
                                  : ' — Larger'}
                            </option>
                          ))}
                        </select>
                      </label>
                      <p className="field-hint" id="display-scale-help">
                        Applies after saving on desktop screens with a mouse or
                        trackpad. Touch and narrow layouts stay at 100% for
                        comfortable controls. Browser zoom remains available.
                        Choose 100% to reset.
                      </p>
                    </section>
                    <section
                      className="interface-font-settings"
                      aria-labelledby="interface-font-heading"
                    >
                      <h3 id="interface-font-heading">Interface font</h3>
                      <label>
                        Font style
                        <select
                          value={fontStyle}
                          onChange={(e) =>
                            setFontStyle(normalizeFontStyle(e.target.value))
                          }
                          aria-describedby="interface-font-help"
                        >
                          {interfaceFonts.map((font) => (
                            <option key={font.id} value={font.id}>
                              {font.label} — {font.description}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div
                        className="interface-font-preview"
                        data-preview-font={fontStyle}
                      >
                        <strong>A conversation worth following up</strong>
                        <p>
                          Call next Tuesday to discuss the proposal. Keep every
                          next step clear.
                        </p>
                        <small>Customer activity · 10:30 am · 0123456789</small>
                      </div>
                      <p id="interface-font-help" className="field-hint">
                        Preview only until you save. Personal to your account.
                        Branding and phone-number fonts stay consistent. Book
                        mode uses its own serif font; your choice returns when
                        Book mode is off.
                      </p>
                    </section>
                    <label className="book-mode-control">
                      <span className="book-mode-emblem" aria-hidden="true">
                        <BookOpen size={24} />
                      </span>
                      <span>
                        <strong>Book mode</strong>
                        <small>
                          Warm paper, quiet colours and serif fonts throughout
                          the workspace. Works with Light, Dark or System.
                        </small>
                      </span>
                      <input
                        type="checkbox"
                        role="switch"
                        checked={bookMode}
                        onChange={(e) => setBookMode(e.target.checked)}
                        aria-label="Book mode"
                        aria-describedby="book-mode-help"
                      />
                    </label>
                    <p id="book-mode-help" className="field-hint">
                      Personal to you. Choose Save changes to apply; turning it
                      off restores your selected interface font.
                    </p>
                    <label className="timezone-field">
                      Display timezone
                      <input
                        value={timezone}
                        list="timezones"
                        onChange={(e) => setTimezone(e.target.value)}
                        required
                      />
                      <datalist id="timezones">
                        {[
                          'Asia/Kolkata',
                          'Asia/Dubai',
                          'Asia/Singapore',
                          'Europe/London',
                          'America/New_York',
                          'America/Los_Angeles',
                          'Australia/Sydney',
                          'Etc/UTC',
                        ].map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </datalist>
                    </label>
                    <p className="field-hint">
                      Reminder forms label the device timezone used when
                      entering dates.
                    </p>
                  </>
                ) : null}
                {section === 'reminders' ? (
                  <div className="automatic-settings">
                    <h3>Reminders from your notes</h3>
                    <p className="field-hint">
                      New call comments and lead notes are checked in the
                      background. Clear, dated follow-ups become reminders;
                      unclear instructions ask for a date. Manual reminders take
                      priority.
                    </p>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={automaticReminders}
                        onChange={(e) =>
                          setAutomaticReminders(e.target.checked)
                        }
                      />{' '}
                      Automatically schedule follow-ups from notes
                    </label>
                    <p className="field-hint">
                      The relevant note is sent to Google Gemini for
                      interpretation. Contact profiles and other lead history
                      are not sent. Changes apply to new notes; turning this off
                      also stops pending analysis.
                    </p>
                    <div className="form-grid">
                      <label>
                        Default time
                        <input
                          type="time"
                          required
                          value={reminderTime}
                          onChange={(e) => setReminderTime(e.target.value)}
                        />
                      </label>
                      <label>
                        “Next week” means
                        <select
                          value={nextWeekRule}
                          onChange={(e) =>
                            setNextWeekRule(
                              e.target.value as typeof nextWeekRule,
                            )
                          }
                        >
                          <option value="seven_days">
                            Seven days after the note
                          </option>
                          <option value="next_monday">Next Monday</option>
                        </select>
                      </label>
                    </div>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={moveWeekends}
                        onChange={(e) => setMoveWeekends(e.target.checked)}
                      />{' '}
                      Move relative dates without a specified time to the next
                      working day when they fall on a weekend
                    </label>
                    <p className="field-hint">
                      Automatic dates use your display timezone above. Exact
                      dates and named weekdays are kept as written.
                    </p>
                  </div>
                ) : null}
                <ErrorMessage error={submit.error} />
                <SaveButton busy={submit.busy} />
              </form>
            </section>
          ) : null}
          {section === 'notifications' ? (
            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>
                    <Bell size={18} /> A little nudge, at the right time.
                  </h2>
                  <p>
                    Your reminders stay in the app. Push brings them to your
                    device, too.
                  </p>
                </div>
                <button
                  className="button primary"
                  onClick={push}
                  disabled={busy || demo}
                >
                  {busy ? 'Enabling…' : 'Enable notifications'}
                </button>
              </div>
              <div className="notice subtle">
                <Smartphone size={20} />
                <div>
                  <strong>Using an iPhone or iPad?</strong>
                  <p>
                    Add SalesDrone to your Home Screen, open it there, then
                    enable notifications. Supported OS versions start at 16.4.
                    Browser and OS settings can delay delivery.
                  </p>
                </div>
              </div>
              {devices.length ? (
                <div className="device-list">
                  {devices.map((d) => (
                    <div key={d.id}>
                      <Monitor size={20} />
                      <div>
                        <strong>{d.label}</strong>
                        <small>
                          {d.enabled ? 'Enabled' : 'Needs re-enabling'}
                        </small>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => deviceAction(d, 'test')}
                      >
                        Send test
                      </button>
                      <button
                        className="text-button danger"
                        onClick={() => deviceAction(d, 'revoke')}
                      >
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="field-hint">
                  No notification devices registered.
                </p>
              )}
              <ErrorMessage error={error} />
              {message ? (
                <p className="success-message" role="status">
                  <Check size={16} />
                  {message}
                </p>
              ) : null}
            </section>
          ) : null}
          {isAdmin && section === 'ai' ? (
            <AIPersonalizationSettings request={request} />
          ) : null}
          {isAdmin && section === 'scoring' ? (
            <ScoringSettings request={request} />
          ) : null}
          {isAdmin && section === 'developer' ? (
            <DeveloperSettings request={request} />
          ) : null}
          {isAdmin && section === 'access' ? (
            <PeopleSettings request={request} />
          ) : null}
          {section === 'about' ? (
            <section className="about-salesdrone">
              <article className="panel about-story">
                <span className="eyebrow">WHY WE BUILT SALESDRONE</span>
                <h3>Built for the people growing a small business.</h3>
                <figure className="about-story-illustration">
                  <img
                    src={aboutStoryIllustration}
                    width={1672}
                    height={941}
                    alt="A small character stitches enquiry, conversation and next-step cards into a spreadsheet row, keeping the story behind each lead together."
                  />
                  <figcaption>
                    The story behind each row. The next step within reach.
                  </figcaption>
                </figure>
                <p>
                  Small companies have plenty of software to choose from. Yet
                  for many founders, independent businesses and small sales
                  teams, Excel is still where the work feels most comfortable.
                  It is familiar, flexible and already part of the day.
                </p>
                <p>
                  The challenge is keeping the story behind each row. An enquiry
                  turns into a call, a discussion needs a follow-up, and useful
                  context can end up spread across spreadsheets, messages and
                  memory. Staying on top of it all becomes another job.
                </p>
                <p>
                  SalesDrone was built to make that work feel simpler. It brings
                  leads, conversations and follow-ups into one intuitive
                  workspace, starting with the spreadsheets people already use.
                  It is for founders, SDRs and anyone in a small team who is
                  building customer relationships alongside the rest of their
                  work.
                </p>
                <p>
                  AI adds a useful starting point: turning clear follow-up notes
                  into reminders and surfacing insights that help people decide
                  where to focus. The aim is to give every promising enquiry the
                  attention it needs as it moves toward a sale.
                </p>
                <aside
                  className="about-mission"
                  aria-labelledby="about-mission-title"
                >
                  <h4 id="about-mission-title">Our mission</h4>
                  <p>
                    Simplify the everyday workflow of small-business founders
                    and their teams, so they can spend more time with customers
                    and less time keeping track of the work.
                  </p>
                </aside>
                <p>
                  SalesDrone is currently used internally and shaped by everyday
                  experience. More modules and updates are planned as we learn
                  from the people using it. This is our first chapter.
                </p>
              </article>
              <div className="brand-attribution">
                <strong>SalesDrone by AvinyaTech</strong>
                <span>Part of Avinya Enterprises · v{APP_VERSION}</span>
                <a
                  href="https://firebase.google.com/support/privacy"
                  target="_blank"
                  rel="noreferrer"
                >
                  Built on Firebase <ExternalLink size={12} />
                </a>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

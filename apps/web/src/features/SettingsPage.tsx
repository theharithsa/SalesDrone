import { accentPalettes, normalizeAccent } from '../lib/accent';
import { UsageAnalyticsPreference } from '../components/UsageAnalytics';
import LeadFieldLayoutSettings from '../components/LeadFieldLayoutSettings';
import ResearchSettings from './ResearchSettings';
import LeadDataSettings from './LeadDataSettings';
import ArchivedLeadsSettings from './ArchivedLeadsSettings';
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
import { useState, useEffect, useRef } from 'react';
import { SettingsDirectory, settingsGroups, type SettingsLocation } from './SettingsDirectory';
import {
  ArrowLeft,
  Bell,
  Monitor,
  BookOpen,
  Sun,
  Moon,
  ShieldCheck,
  Smartphone,
  Check,
  ExternalLink,
} from 'lucide-react';
import { Session, Entity, Lead } from '../lib/types';
import { Avatar, ErrorMessage, Modal, SaveButton, useSubmit } from '../components/UI';
import { enablePush, revokeThisDevice } from '../lib/api';
const cleanDraft = { dirty: false, busy: false };
function readSettingsLocation(): SettingsLocation {
  const params = new URLSearchParams(window.location.search);
  return { section: params.get('section') || undefined, group: params.get('group') || undefined };
}
export default function SettingsPage({
  previewOnly = false,
  onOpenLead,
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
  previewOnly?: boolean;
  onOpenLead?: (lead: Lead) => void;
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
  const canUseIntelligence = demo || session?.member?.leadFeatureAccess?.intelligence !== false;
  const sections = settingsSections.filter((item) => !item.admin || isAdmin);
  const [location, setLocation] = useState(() => initialSection ? { section: initialSection } : readSettingsLocation());
  const [sectionDraft, setSectionDraft] = useState(cleanDraft);
  const navigationHandler = useRef<() => void>(() => {});
  const settingsPath = useRef(window.location.pathname);
  const [pendingDestination, setPendingDestination] = useState<SettingsLocation | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const focusHeading = useRef(false);
  const currentSection = sections.find((item) => item.id === location.section);
  const section = currentSection?.id;
  const group = sections.some((item) => item.group === location.group) ? location.group : undefined;
  const href = (next: SettingsLocation) => {
    const url = new URL(window.location.href);
    if (url.pathname === '/members') url.pathname = '/settings';
    url.searchParams.delete('section');
    url.searchParams.delete('group');
    if (next.section) url.searchParams.set('section', next.section);
    if (next.group) url.searchParams.set('group', next.group);
    return url.pathname + url.search + url.hash;
  };
  useEffect(() => {
    const next = readSettingsLocation();
    setLocation(next.section || next.group ? next : { section: initialSection });
  }, [initialSection]);
  useEffect(() => {
    const restore = () => navigationHandler.current();
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  useEffect(() => {
    if (!focusHeading.current) return;
    focusHeading.current = false;
    heading.current?.focus();
    window.scrollTo(0, 0);
  }, [location]);
  const [demoReminderPreferences, setDemoReminderPreferences] = useState<Partial<Session['preferences']>>({});
  const preferences = (!demo && session?.preferences) || {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    appearance: 'system',
    bookMode: false,
    ...guestPreferences,
    ...demoReminderPreferences,
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
  const [accentPalette, setAccentPalette] = useState(() => normalizeAccent(preferences.accentPalette));
  useEffect(() => setAccentPalette(normalizeAccent(preferences.accentPalette)), [preferences.accentPalette]);
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
  useEffect(() => setTimezone(preferences.timezone), [preferences.timezone]);
  const reminderDefaults = {
    automaticReminders: preferences.automaticReminders !== false,
    reminderTime: preferences.reminderTime || '10:00',
    nextWeekRule: preferences.nextWeekRule || 'seven_days',
    moveWeekends: preferences.moveWeekends || false,
  };
  const appearanceDefaults = {
    appearance: preferences.appearance,
    timezone: preferences.timezone,
    bookMode: preferences.bookMode === true,
    fontStyle: normalizeFontStyle(preferences.fontStyle),
    accentPalette: normalizeAccent(preferences.accentPalette),
    displayScale: normalizeDisplayScale(preferences.displayScale),
  };
  const appearanceDraft = { appearance, timezone, bookMode, fontStyle, accentPalette, displayScale };
  const reminderDraft = { automaticReminders, reminderTime, nextWeekRule, moveWeekends };
  const savingAppearance = section === 'appearance';
  const preferenceEditor = savingAppearance || section === 'reminders';
  const preferenceDirty = preferenceEditor && JSON.stringify(savingAppearance ? appearanceDraft : reminderDraft)
    !== JSON.stringify(savingAppearance ? appearanceDefaults : reminderDefaults);
  const submit = useSubmit(async (settings, _key, isCurrent) => {
    if (!demo) await request('/me', 'PATCH', settings);
    if (isCurrent()) {
      if (demo && !savingAppearance) setDemoReminderPreferences(settings);
      onPreferences({ ...preferences, ...settings });
      setMessage('Preferences saved.');
    }
  });

  function discardPreferences() {
    setAppearance(appearanceDefaults.appearance);
    setTimezone(appearanceDefaults.timezone);
    setBookMode(appearanceDefaults.bookMode);
    setFontStyle(appearanceDefaults.fontStyle);
    setAccentPalette(appearanceDefaults.accentPalette);
    setDisplayScale(appearanceDefaults.displayScale);
    setAutomaticReminders(reminderDefaults.automaticReminders);
    setReminderTime(reminderDefaults.reminderTime);
    setNextWeekRule(reminderDefaults.nextWeekRule);
    setMoveWeekends(reminderDefaults.moveWeekends);
  }
  function navigate(next: SettingsLocation) {
    discardPreferences();
    setSectionDraft(cleanDraft);
    setMessage('');
    setError('');
    focusHeading.current = true;
    window.history.pushState({}, '', href(next));
    settingsPath.current = window.location.pathname;
    setLocation(next);
  }
  function chooseDestination(next: SettingsLocation) {
    if (next.section === section && next.group === group) return;
    if (sectionDraft.busy || submit.busy) return;
    if (sectionDraft.dirty || preferenceDirty) {
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setPendingDestination(next);
    } else navigate(next);
  }
  navigationHandler.current = () => {
    if (window.location.pathname !== settingsPath.current) return;
    const next = readSettingsLocation();
    if (next.section === location.section && next.group === location.group) return;
    if (sectionDraft.dirty || preferenceDirty || sectionDraft.busy || submit.busy) {
      window.history.pushState({}, '', href(location));
      chooseDestination(next);
      return;
    }
    discardPreferences();
    focusHeading.current = true;
    setLocation(next);
    setMessage('');
    setError('');
  };
  async function push() {
    if (previewOnly) return;
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
    <div className="page-body settings-page" data-section={section}>
      <header className="settings-masthead">
        <div>
          <h1 ref={!section ? heading : undefined} tabIndex={-1}>Settings</h1>
          <p>Manage your preferences and workspace.</p>
        </div>
        <a className="text-button" href="https://theharithsa.github.io/SalesDrone/settings.html"
          target="_blank" rel="noreferrer">Settings guide <ExternalLink size={14} /></a>
      </header>
      <div className="settings-layout">
        <SettingsDirectory sections={sections} selected={currentSection} group={group} href={href} onNavigate={chooseDestination} />
        {currentSection && <div className="settings-content">
          <div className="settings-section-header">
            <a className="text-button settings-back" href={href({ group: currentSection.group })} onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              chooseDestination({ group: currentSection.group });
            }}>
              <ArrowLeft size={18} aria-hidden="true" /> {settingsGroups.find((item) => item.id === currentSection.group)?.label}
            </a>
            <h2 ref={heading} tabIndex={-1}>{currentSection.label}</h2>
            <p>{currentSection.description}</p>
          </div>
          {message && !preferenceDirty && section !== 'notifications' ? (
            <p className="success-message" role="status">
              {message}
            </p>
          ) : null}
          {section === 'archives' ? (
            <ArchivedLeadsSettings request={request} onOpenLead={onOpenLead} canRestore={demo || !!session?.member?.capabilities.includes('leads:edit')} onRestored={onRefresh} />
          ) : null}
          {isAdmin && section === 'data' ? (
            <LeadDataSettings request={request} onChanged={onRefresh} />
          ) : null}
          {isAdmin && (section === 'workspace' || section === 'lead-features') ? (
            <WorkspacePolicySettings
              key={section}
              featureAccess={section === 'lead-features'}
              request={request}
              onChanged={onWorkspacePolicyChanged || onRefresh}
            />
          ) : null}
          {isAdmin && section === 'fields' ? (
            <LeadFieldManager
              config={fieldOptions}
              request={request}
              onChanged={onFieldOptions}
              onOpenLayout={(id) => chooseDestination({ section: id })}
            />
          ) : null}
          {isAdmin && (section === 'field-order' || section === 'lead-header') ? (
            <LeadFieldLayoutSettings key={section} config={fieldOptions}
              mode={section === 'field-order' ? 'order' : 'header'}
              request={request} onChanged={onFieldOptions} onEditingChange={setSectionDraft} />
          ) : null}
          {isAdmin && section === 'choices' ? (
            <FieldOptionsEditor
              config={fieldOptions}
              request={request}
              onChanged={onFieldOptions}
              onEditingChange={setSectionDraft}
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
          {preferenceEditor ? (
            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>
                    {section === 'appearance'
                      ? 'Display and regional settings'
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
                  if (preferenceDirty) void submit.run(savingAppearance ? appearanceDraft : reminderDraft);
                }}
              >
                <fieldset className="settings-preference-fields" disabled={submit.busy}>
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
                    <section className="accent-settings" aria-labelledby="accent-heading">
                      <h3 id="accent-heading">Accent palette</h3>
                      <div className="accent-options">
                        {accentPalettes.map((palette) => (
                          <button key={palette.id} type="button" className="accent-option"
                            aria-pressed={accentPalette === palette.id}
                            onClick={() => setAccentPalette(palette.id)}>
                            <span className="accent-swatches" aria-hidden="true">
                              {palette.colors.map((color) => <span key={color} style={{ backgroundColor: color }} />)}
                            </span>
                            <span>{palette.label}</span>
                            {accentPalette === palette.id && <Check size={16} aria-hidden="true" />}
                          </button>
                        ))}
                      </div>
                      <p className="field-hint">The workspace and SalesDrone mark change when you save.</p>
                    </section>
                    <section
                      className="display-scale-settings"
                      aria-labelledby="display-scale-heading"
                    >
                      <h3 id="display-scale-heading">Display scale</h3>
                      <label>
                        Display zoom
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
                        Applies after saving on phones, tablets and desktops.
                        Touch controls retain a usable minimum size. Browser and
                        pinch zoom remain available. Choose 100% to reset.
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
                        mode uses its own handwriting fonts; your choice returns when
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
                          A handwritten notebook for your workspace, with section tabs, paper pages and a lead index.
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
                {section === 'reminders' && !canUseIntelligence ? (
                  <p>Your administrator has turned off AvinyaIntelligence for members. You can still schedule reminders manually.</p>
                ) : null}
                {section === 'reminders' && canUseIntelligence ? (
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
                      Automatic dates use your display timezone in Appearance & time. Exact
                      dates and named weekdays are kept as written.
                    </p>
                  </div>
                ) : null}
                </fieldset>
                <ErrorMessage error={submit.error} />
                <div className="form-footer settings-save-actions">
                  <span>{preferenceDirty ? 'Unsaved changes' : ''}</span>
                  <div>
                    <button className="button" type="button" disabled={!preferenceDirty || submit.busy} onClick={discardPreferences}>Discard changes</button>
                    <SaveButton busy={submit.busy} disabled={!preferenceDirty} />
                  </div>
                </div>
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
                  disabled={busy || demo || previewOnly}
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
          {isAdmin && section === 'research' ? <ResearchSettings request={request} fieldOptions={fieldOptions}/>:null}
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
              {!demo && session?.mode === 'live' ? <UsageAnalyticsPreference /> : null}
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
        </div>}
      </div>
      <Modal open={pendingDestination !== null} onClose={() => setPendingDestination(null)}
        title="Discard unsaved changes?" description="Your saved settings will still apply." returnFocusRef={returnFocus}>
        <div className="form-footer settings-save-actions">
          <button className="button" onClick={() => setPendingDestination(null)}>Keep editing</button>
          <button className="button primary" onClick={() => {
            if (!pendingDestination) return;
            navigate(pendingDestination);
            setPendingDestination(null);
          }}>Discard changes</button>
        </div>
      </Modal>
    </div>
  );
}

import LeadFiles from './features/LeadFiles';
import InfiniteLeadLoader from './components/InfiniteLeadLoader';
import { appendUniqueRows } from './lib/lead-pagination';
import { normalizeDisplayScale, scaleFromCSS } from './lib/display-scale';
import { normalizeFontStyle } from './lib/fonts';
import { resolveVisualPreferences } from './lib/appearance';
import { readStored, writeStored, removeStored } from './lib/browser-storage';
import InlineCommentComposer from './components/InlineCommentComposer';
import LeadTaskTab from './components/LeadTaskTab';
import {
  leadPathId,
  reviewActivities,
  filterLeadActivities,
  leadWorkspaceTabs,
  tabAfterLeadLoad,
  type LeadWorkspaceTab,
} from './lib/lead-workspace';
import Assignment from './components/Assignment';
import LeadBlade from './components/LeadBlade';
import LeadReportExport from './features/LeadReportExport';
import NotificationsPage from './features/NotificationsPage';
import { setRumIdentity, rumPage } from './lib/rum';
import NotificationOverlay from './components/NotificationOverlay';
import LeadJourney from './components/LeadJourney';
import { APP_VERSION } from './lib/version';
import LeadScore, { ScoreBadge } from './components/LeadScore';
import ThemeToggle from './components/ThemeToggle';
import TaskEditForm from './components/TaskEditForm';
import TaskDeleteForm from './components/TaskDeleteForm';
import {
  defaultFieldOptions,
  FieldOptions,
  withCurrent,
  labelFor,
} from './lib/field-options';
import LeadFilters from './components/LeadFilters';
import MobileLeadFilters from './components/MobileLeadFilters';
import LeadBatchEditor from './features/LeadBatchEditor';
import {
  ColumnFilter,
  matchesColumnFilters,
  worksheetColumns,
} from './lib/lead-fields';
import AutomaticReminder from './components/AutomaticReminder';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
  Archive,
  Ban,
  LayoutDashboard,
  UsersRound,
  ListTodo,
  Bell,
  Settings,
  Plus,
  Pencil,
  Search,
  ArrowUpRight,
  ChevronRight,
  ChevronLeft,
  Phone,
  MoreHorizontal,
  Upload,
  LogOut,
  Check,
  Clock,
  CalendarDays,
  ArrowRight,
  RefreshCw,
  FileText,
  Paperclip,
  BookOpen,
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  LoaderCircle,
  PhoneCall,
  Filter,
  X,
} from 'lucide-react';
import { auth, login, redirectLogin, finishRedirect } from './lib/firebase';
import { api, ApiError, revokeThisDevice } from './lib/api';
import {Lead, Task, Entity, Session, displayDate} from './lib/types';
import { demoData, demoSummary } from './lib/demo';
import {
  Avatar,
  LeadName,
  Badge,
  Brand,
  Empty,
  ErrorMessage,
  Loading,
  Modal,
} from './components/UI';
import {
  CallForm,
  LeadForm,
  NoteForm,
  TaskForm,
  RescheduleForm,
  CorrectionForm,
} from './components/Forms';
const DashboardPage = lazy(() => import('./features/DashboardPage'));

const ImportPage = lazy(() => import('./features/ImportPage'));
const SettingsPage = lazy(() => import('./features/SettingsPage'));
type Page =
  | 'today'
  | 'leads'
  | 'tasks'
  | 'notifications'
  | 'imports'
  | 'members'
  | 'settings';
type Data = {
  leads: Lead[];
  tasks: Task[];
  activities: Entity[];
  notifications: Entity[];
  members: Entity[];
  devices: Entity[];
  invitations: Entity[];
};
const blank: Data = {
  leads: [],
  tasks: [],
  activities: [],
  notifications: [],
  members: [],
  devices: [],
  invitations: [],
};
const nav = [
  { id: 'today', label: 'Today', icon: LayoutDashboard },
  { id: 'leads', label: 'Leads', icon: UsersRound },
  { id: 'tasks', label: 'Tasks', icon: ListTodo },
  { id: 'notifications', label: 'Notifications', icon: Bell },
] as const;
export default function App() {
  const [session, setSession] = useState<Session | null>(null),
    [guest, setGuest] = useState(false),
    [inboxHasUnread, setInboxHasUnread] = useState(false),
    [authReady, setAuthReady] = useState(false),
    [sessionBusy, setSessionBusy] = useState(false),
    [page, setPage] = useState<Page>('today'),
    [data, setData] = useState<Data>(blank),
    [summary, setSummary] = useState<any>({}),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [toast, setToast] = useState(''),
    [selected, setSelected] = useState<Lead | null>(null),
    [routeLeadId, setRouteLeadId] = useState(() =>
      leadPathId(window.location.pathname),
    ),
    [leadTab, setLeadTab] = useState<LeadWorkspaceTab>('all'),
    [timeline, setTimeline] = useState<Entity[]>([]),
    [timelineCursor, setTimelineCursor] = useState<string | null>(null),
    [modal, setModal] = useState<
      | 'lead'
      | 'edit'
      | 'call'
      | 'task'
      | 'note'
      | 'command'
      | 'edittask'
      | 'deletetask'
      | 'reschedule'
      | 'taskdetail'
      | 'correction'
      | null
    >(null),
    [search, setSearch] = useState(''),
    [searchDraft, setSearchDraft] = useState(''),
    [searchField, setSearchField] = useState('name'),
    [columnFilters, setColumnFilters] = useState<ColumnFilter[]>([]),
    [stage, setStage] = useState(''),
    [source, setSource] = useState(''),
    [taskFilter, setTaskFilter] = useState('Pending'),
    [nextCursor, setNextCursor] = useState<string | null>(null),
    [demoLeadLimit, setDemoLeadLimit] = useState(30),
    [listLoadError, setListLoadError] = useState(false),
    [menu, setMenu] = useState(false),
    [leadMoreOpen, setLeadMoreOpen] = useState(false),
    [sidebarCollapsed, setSidebarCollapsed] = useState(
      () =>
        readStored('localStorage', 'salesdrone.sidebarCollapsed') === 'true',
    ),
    [detailBusy, setDetailBusy] = useState(
      !!leadPathId(window.location.pathname),
    ),
    [mutationBusy, setMutationBusy] = useState(false);
  const [focusedTask, setFocusedTask] = useState<Task | null>(null),
    [leadTasks, setLeadTasks] = useState<Task[]>([]),
    [selectedActivity, setSelectedActivity] = useState<Entity | null>(null);
  const [fieldOptions, setFieldOptions] =
    useState<FieldOptions>(defaultFieldOptions);
  const [guestAppearance, setGuestAppearance] = useState<
    'system' | 'light' | 'dark'
  >(() => {
    try {
      const v = localStorage.getItem('salesdrone.theme');
      return v === 'light' || v === 'dark' ? v : 'system';
    } catch {
      return 'system';
    }
  });
  const [guestBookMode, setGuestBookMode] = useState(
    () => readStored('localStorage', 'salesdrone.guestBookMode') === 'true',
  );
  const [guestFontStyle, setGuestFontStyle] = useState(() =>
    normalizeFontStyle(readStored('localStorage', 'salesdrone.guestFontStyle')),
  );
  const [guestDisplayScale, setGuestDisplayScale] = useState(() =>
    normalizeDisplayScale(
      Number(readStored('localStorage', 'salesdrone.guestDisplayScale')),
    ),
  );
  const [detailScore, setDetailScore] = useState<{
    id: string;
    report: any;
  } | null>(null);
  const acceptScore = useCallback((id: string, report: any) => {
    if (selectedIdRef.current === id) setDetailScore({ id, report });
  }, []);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const [leadScores, setLeadScores] = useState<Record<string, any>>({});
  const [themeBusy, setThemeBusy] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  const [compact, setCompact] = useState(
    () => window.matchMedia('(max-width: 599.99px)').matches,
  );
  useEffect(() => {
    const media = window.matchMedia('(max-width: 599.99px)');
    const change = () => setCompact(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  const demo = guest || session?.mode === 'demo';
  const active = guest || !!session;
  useEffect(
    () =>
      setRumIdentity(
        !demo && session?.mode === 'live' ? session.identity.uid : null,
        !demo && session?.mode === 'live' ? session.identity.email : null,
      ),
    [session?.identity.uid, session?.identity.email, session?.mode, demo],
  );
  useEffect(() => {
    rumPage('/' + page);
  }, [page]);
  const admin = !demo && session?.member?.role === 'Admin';
  const importAccess =
    !demo &&
    !!session?.member?.capabilities?.some(
      (c: string) => c === 'imports:read' || c === 'imports:write',
    );
  const generation = useRef(0);
  const leadActionsRoot = useRef<HTMLDivElement>(null);
  const leadMoreTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!leadMoreOpen) return;
    const outside = (event: PointerEvent) => {
      if (!leadActionsRoot.current?.contains(event.target as Node))
        setLeadMoreOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [leadMoreOpen]);
  const listEpoch = useRef(0);
  const pendingList = useRef<number | null>(null);
  const detailEpoch = useRef(0);
  const leadTabRef = useRef(leadTab);
  leadTabRef.current = leadTab;
  const selectedIdRef = useRef(selected?.id);
  selectedIdRef.current = selected?.id;
  const timelineMoreLock = useRef(false);
  const timelineMoreRequest = useRef(0);
  const [timelineMoreBusy, setTimelineMoreBusy] = useState(false);
  const demoRef = useRef<Data>(demoData());
  const guestRef = useRef(guest);
  guestRef.current = guest;
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const can = (c: string) => demo || session?.member?.capabilities.includes(c);
  const notify = (message: string) => setToast(message);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  const resolveSession = useCallback(async () => {
    const g = ++generation.current;
    setSessionBusy(true);
    setError('');
    try {
      const result = await api<Session>('/me');
      if (g !== generation.current) return;
      if (sessionRef.current?.identity.uid !== result.identity.uid)
        setColumnFilters([]);
      setInboxOpen(false);
      setSession(result);
      setGuest(false);
      setData(blank);
      setSelected(null);
      setTimeline([]);
      removeStored('sessionStorage', 'salesdrone.import');
      if (result.mode === 'demo') demoRef.current = demoData();
    } catch (e) {
      if (g === generation.current) {
        setSession(null);
        setData(blank);
        setError((e as Error).message);
      }
    } finally {
      if (g === generation.current) {
        setAuthReady(true);
        setSessionBusy(false);
      }
    }
  }, []);
  useEffect(() => {
    finishRedirect().catch((e) => setError(e.message));
    return onAuthStateChanged(auth, (user) => {
      if (user) void resolveSession();
      else {
        generation.current++;
        setSession(null);
        setData(guestRef.current ? demoRef.current : blank);
        setSelected(null);
        setTimeline([]);
        setAuthReady(true);
        setSessionBusy(false);
      }
    });
  }, [resolveSession]);
  useEffect(() => {
    if (!session || demo) return;
    const recheck = async () => {
      try {
        const next = await api<Session>('/me');
        const current = sessionRef.current;
        if (!current || current.identity.uid !== next.identity.uid) return;
        if (
          next.mode !== current.mode ||
          next.member?.version !== current.member?.version ||
          next.member?.accessPolicyVersion !==
            current.member?.accessPolicyVersion ||
          next.member?.scope !== current.member?.scope
        ) {
          generation.current++;
          setData(blank);
          setSelected(null);
          setTimeline([]);
          setSession(next);
        }
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          setData(blank);
          setSelected(null);
          setSession(null);
          setError(e.message);
        }
      }
    };
    const timer = setInterval(recheck, 60000);
    window.addEventListener('focus', recheck);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', recheck);
    };
  }, [session, demo]);
  const { appearance, bookMode, fontStyle, displayScale } =
    resolveVisualPreferences(session?.preferences || null, demo, {
      appearance: guestAppearance,
      bookMode: guestBookMode,
      fontStyle: guestFontStyle,
      displayScale: guestDisplayScale,
    });
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme = appearance;
      document.documentElement.dataset.fontStyle = fontStyle;
      document.documentElement.style.setProperty(
        '--interface-scale',
        String(displayScale / 100),
      );
      const dark =
        appearance === 'dark' || (appearance === 'system' && media.matches);
      document.documentElement.dataset.colorScheme = dark ? 'dark' : 'light';
      document.documentElement.dataset.readingMode = bookMode
        ? 'book'
        : 'standard';
      document
        .querySelectorAll('meta[name="theme-color"]')
        .forEach((meta) =>
          meta.setAttribute(
            'content',
            bookMode
              ? dark
                ? '#211e19'
                : '#f4eddf'
              : dark
                ? '#141923'
                : '#f7f9fc',
          ),
        );
    };
    apply();
    try {
      localStorage.setItem('salesdrone.theme', appearance);
    } catch {}
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [appearance, bookMode, fontStyle, displayScale]);
  async function changeTheme(next: 'light' | 'dark') {
    if (demo || !session) {
      setGuestAppearance(next);
      return;
    }
    const current = session,
      epoch = generation.current;
    setThemeBusy(true);
    setSession({
      ...current,
      preferences: { ...current.preferences, appearance: next },
    });
    try {
      await request('/me', 'PATCH', {
        ...current.preferences,
        appearance: next,
      });
    } catch (e) {
      if (epoch === generation.current) {
        setSession((s) =>
          s
            ? {
                ...s,
                preferences: {
                  ...s.preferences,
                  appearance: current.preferences.appearance,
                },
              }
            : s,
        );
        setError((e as Error).message);
      }
    } finally {
      setThemeBusy(false);
    }
  }
  useEffect(() => {
    const keyboard = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && menu) {
        setMenu(false);
        return;
      }
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === 'k' &&
        active &&
        !(
          e.target instanceof HTMLElement &&
          e.target.closest('input,textarea,select,[contenteditable=true]')
        )
      ) {
        e.preventDefault();
        setModal('command');
      }
    };
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  }, [active, menu]);
  useEffect(() => {
    if (!session || demo) return;
    let off: (() => void) | undefined;
    let alive = true;
    import('firebase/messaging')
      .then(async (m) => {
        if ((await m.isSupported()) && alive) {
          off = m.onMessage(m.getMessaging(), (payload) => {
            notify(payload.data?.body || 'A workspace update is ready.');
            window.dispatchEvent(new Event('salesdrone:inbox'));
            void loadRef.current();
          });
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
      off?.();
    };
  }, [session, demo]);
  const request = useCallback(
    async (path: string, method = 'GET', body?: any, key?: string) => {
      if (!demo) {
        try {
          const result = await api(path, method, body, key);
          setOnline(true);
          return result;
        } catch (e) {
          if (
            e instanceof ApiError &&
            (e.status === 401 || e.code === 'DEMO_ONLY')
          ) {
            setData(blank);
            setSelected(null);
            void resolveSession();
          }
          throw e;
        }
      }
      let d = demoRef.current;
      const parts = path.split('?')[0].split('/').filter(Boolean);
      const collection = parts[0],
        id = parts[1];
      let result: any = { ok: true };
      if (collection === 'archived-leads' && method === 'GET') {
        const params = new URLSearchParams(path.split('?')[1]);
        const offset = Number(params.get('cursor') || 0);
        const rows = d.leads.filter((l) => l.archived);
        return {
          items: rows.slice(offset, offset + 30),
          nextCursor: rows.length > offset + 30 ? String(offset + 30) : null,
        };
      }
      if (collection === 'leads' && id === 'batch' && method === 'POST') {
        if (!body.items?.length || body.items.length > 25)
          throw Error('Select 1–25 leads.');
        if (
          !Object.keys(body.changes || {}).length &&
          body.assignedToUid === undefined
        )
          throw Error('Choose at least one change.');
        const rows = body.items.map((item: any) => {
          const l = d.leads.find((l) => l.id === item.id);
          if (!l || l.version !== item.expectedVersion)
            throw Error('A selected lead changed. Refresh and preview again.');
          const changes = {
            ...body.changes,
            ...(body.assignedToUid !== undefined
              ? { assignedToUid: body.assignedToUid }
              : {}),
          };
          return {
            id: l.id,
            name: l.name,
            version: l.version + 1,
            changed:
              JSON.stringify(
                Object.fromEntries(
                  Object.keys(changes).map((k) => [k, l[k] ?? null]),
                ),
              ) !== JSON.stringify(changes),
            before: Object.fromEntries(
              Object.keys(changes).map((k) => [k, l[k] ?? null]),
            ),
            after: changes,
          };
        });
        if (parts[2] !== 'preview') {
          d = {
            ...d,
            leads: d.leads.map((l) => {
              const row = rows.find((r: any) => r.id === l.id);
              return row?.changed
                ? { ...l, ...row.after, version: l.version + 1 }
                : l;
            }),
          };
          demoRef.current = d;
          setData(d);
        }
        return {
          count: rows.length,
          changedCount: rows.filter((r: any) => r.changed).length,
          items: rows,
        };
      }
      if (method === 'GET') {
        if (parts[2] === 'activities')
          return {
            items: d.activities.filter((a) => a.leadId === id),
            nextCursor: null,
          };
        if (collection === 'tasks' && path.includes('?leadId=')) {
          const target = new URL('http://localhost' + path).searchParams.get(
            'leadId',
          );
          return {
            items: d.tasks.filter(
              (t) => t.leadId === target && t.state === 'Pending',
            ),
            nextCursor: null,
          };
        }
        if (collection === 'leads' && id)
          return d.leads.find((l) => l.id === id);
        if (collection === 'tasks' && id)
          return d.tasks.find((t) => t.id === id);
        return { items: (d as any)[collection] || [], nextCursor: null };
      }
      if (collection === 'leads' && method === 'POST' && !id) {
        if (!body.phone && !body.email)
          throw Error('Add a phone number or email.');
        if (
          !body.allowDuplicate &&
          d.leads.some(
            (l) =>
              (body.email && l.email === body.email) ||
              (body.phone && l.phone === body.phone),
          )
        )
          throw Error('A lead with this contact already exists.');
        result = {
          ...body,
          id: 'demo-' + crypto.randomUUID(),
          version: 1,
          createdAt: new Date().toISOString(),
          assignedToUid: 'demo',
          doNotContact: false,
          needsReview: false,
        };
        d = {
          ...d,
          leads: [result, ...d.leads],
          notifications: [
            {
              id: 'demo-lead-' + result.id,
              kind: 'lead_created',
              leadId: result.id,
              taskId: null,
              title: 'A new lead is ready for you',
              createdAt: result.createdAt,
              readAt: null,
            },
            ...d.notifications,
          ],
          activities: body.comments
            ? [
                {
                  id: crypto.randomUUID(),
                  leadId: result.id,
                  type: 'note',
                  notes: body.comments,
                  createdAt: new Date().toISOString(),
                },
                ...d.activities,
              ]
            : d.activities,
        };
      } else if (collection === 'leads' && method === 'PATCH' && !parts[2]) {
        result = {
          ...d.leads.find((l) => l.id === id),
          ...body,
          version: body.expectedVersion + 1,
        };
        d = { ...d, leads: d.leads.map((l) => (l.id === id ? result : l)) };
      } else if (collection === 'leads' && parts[2] === 'activities') {
        const l = d.leads.find((l) => l.id === id)!;
        const activity = {
          ...body,
          id: 'demo-' + crypto.randomUUID(),
          leadId: id,
          createdAt: new Date().toISOString(),
          revision: 1,
        };
        const lead = {
          ...l,
          stage: body.stage || l.stage,
          version: l.version + 1,
          lastCallOutcome: body.outcome || l.lastCallOutcome,
          ...(body.disposition === 'Do not contact'
            ? { doNotContact: true, suppressionReason: body.notes }
            : {}),
        };
        d = {
          ...d,
          activities: [activity, ...d.activities],
          leads: d.leads.map((x) => (x.id === id ? lead : x)),
          tasks:
            body.disposition === 'Do not contact'
              ? d.tasks.map((t) =>
                  t.leadId === id && t.kind === 'outreach'
                    ? { ...t, state: 'Cancelled' }
                    : t,
                )
              : d.tasks,
        };
        if (body.followUp)
          d = {
            ...d,
            tasks: [
              {
                ...body.followUp,
                id: crypto.randomUUID(),
                leadId: id,
                state: 'Pending',
                version: 1,
              },
              ...d.tasks,
            ],
          };
        result = { activity, lead };
      } else if (collection === 'tasks' && method === 'POST') {
        result = {
          ...body,
          id: crypto.randomUUID(),
          state: 'Pending',
          version: 1,
        };
        d = { ...d, tasks: [result, ...d.tasks] };
      } else if (collection === 'tasks' && method === 'PATCH') {
        result = {
          ...d.tasks.find((t) => t.id === id),
          ...body,
          version: body.expectedVersion + 1,
        };
        d = { ...d, tasks: d.tasks.map((t) => (t.id === id ? result : t)) };
      } else if (collection === 'tasks' && method === 'DELETE') {
        result = { ok: true };
        d = { ...d, tasks: d.tasks.filter((t) => t.id !== id) };
      } else if (collection === 'leads' && parts[2] === 'archive') {
        d = {
          ...d,
          leads: d.leads.map((l) =>
            l.id === id
              ? {
                  ...l,
                  archived: true,
                  archivedAt: new Date().toISOString(),
                  version: l.version + 1,
                }
              : l,
          ),
          tasks: d.tasks.map((t) =>
            t.leadId === id && t.state === 'Pending'
              ? { ...t, state: 'Cancelled', version: t.version + 1 }
              : t,
          ),
        };
      } else if (collection === 'activities' && parts[2] === 'corrections') {
        result = {
          ...d.activities.find((a) => a.id === id),
          ...body,
          revision: body.expectedRevision + 1,
        };
        d = {
          ...d,
          activities: d.activities.map((a) => (a.id === id ? result : a)),
        };
      } else if (collection === 'notifications') {
        d = {
          ...d,
          notifications: d.notifications.map((n) =>
            n.id === id
              ? {
                  ...n,
                  readAt:
                    body?.read === false ? null : new Date().toISOString(),
                }
              : n,
          ),
        };
      } else if (collection !== 'me')
        throw Error(
          'This action is available only in an authorized live workspace.',
        );
      demoRef.current = d;
      setData(d);
      setSummary(demoSummary(d.leads, d.tasks, d.activities));
      return result;
    },
    [demo, resolveSession],
  );
  const load = useCallback(
    async (append = false) => {
      if (!active) return;
      if (demo) {
        setData(demoRef.current);
        setSummary(
          demoSummary(
            demoRef.current.leads,
            demoRef.current.tasks,
            demoRef.current.activities,
          ),
        );
        setLoading(false);
        setListLoadError(false);
        return;
      }
      if (append && (pendingList.current !== null || !nextCursor)) return;
      const g = generation.current;
      const epoch = ++listEpoch.current;
      pendingList.current = epoch;
      setListLoadError(false);
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ limit: '30' });
        if (page === 'leads') {
          params.set('filters', JSON.stringify(columnFilters));
          if (stage) params.set('stage', stage);
          if (source) params.set('source', source);
          if (search) {
            params.set('search', search);
            params.set('field', searchField);
          }
        }
        if (page === 'tasks') params.set('state', taskFilter);
        if (append && nextCursor) params.set('cursor', nextCursor);
        const endpoint =
          page === 'leads'
            ? '/leads'
            : page === 'tasks'
              ? '/tasks'
              : page === 'notifications'
                ? '/notifications'
                : page === 'members'
                  ? '/members'
                  : page === 'settings'
                    ? '/devices'
                    : null;
        if (endpoint) {
          const result = await request(endpoint + '?' + params);
          if (g !== generation.current || epoch !== listEpoch.current) return;
          const field = endpoint.slice(1) as keyof Data;
          setData((d) => ({
            ...d,
            [field]: append
              ? appendUniqueRows(d[field], result.items)
              : result.items,
          }));
          setNextCursor(result.nextCursor);
          if (page === 'members') {
            const inv = await request('/invitations');
            if (g === generation.current && epoch === listEpoch.current)
              setData((d) => ({ ...d, invitations: inv.items }));
          }
        } else if (page === 'today') {
          const [leads, tasks, stats] = await Promise.all([
            request('/leads?limit=6'),
            request('/tasks?state=Pending&limit=100'),
            request('/summary'),
          ]);
          if (g !== generation.current || epoch !== listEpoch.current) return;
          setData((d) => ({ ...d, leads: leads.items, tasks: tasks.items }));
          setSummary(stats);
        }
        if (page === 'leads' && !append) {
          const stats = await request('/summary');
          if (g === generation.current && epoch === listEpoch.current)
            setSummary(stats);
        }
      } catch (e) {
        if (g === generation.current && epoch === listEpoch.current) {
          setListLoadError(true);
          setError((e as Error).message);
        }
      } finally {
        if (pendingList.current === epoch) pendingList.current = null;
        if (g === generation.current && epoch === listEpoch.current)
          setLoading(false);
      }
    },
    [
      active,
      demo,
      page,
      stage,
      source,
      search,
      searchField,
      columnFilters,
      taskFilter,
      nextCursor,
      request,
    ],
  );
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    setNextCursor(null);
    setDemoLeadLimit(30);
    void loadRef.current();
  }, [
    active,
    demo,
    page,
    stage,
    source,
    search,
    searchField,
    columnFilters,
    taskFilter,
    session?.member?.version,
  ]);
  useEffect(() => {
    if (!active || demo) {
      setFieldOptions(defaultFieldOptions);
      return;
    }
    let alive = true;
    request('/field-options')
      .then((config) => {
        if (alive) setFieldOptions(config);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [active, demo, session?.identity.uid, request]);
  useEffect(() => {
    if (!active) {
      setInboxHasUnread(false);
      return;
    }
    if (demo || page === 'notifications') {
      setInboxHasUnread(data.notifications.some((n) => !n.readAt));
      return;
    }
    let alive = true,
      running = false;
    async function syncInbox() {
      if (running || document.visibilityState !== 'visible') return;
      running = true;
      try {
        const result = await request('/notifications?limit=100');
        if (alive)
          setInboxHasUnread(result.items.some((n: Entity) => !n.readAt));
      } catch {
        /* Main page actions surface connection errors. */
      } finally {
        running = false;
      }
    }
    void syncInbox();
    const timer = setInterval(() => void syncInbox(), 60000);
    window.addEventListener('focus', syncInbox);
    window.addEventListener('salesdrone:inbox', syncInbox);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener('focus', syncInbox);
      window.removeEventListener('salesdrone:inbox', syncInbox);
    };
  }, [active, demo, page, session?.identity.uid, request, data.notifications]);
  async function refresh() {
    setDashboardRefreshKey((k) => k + 1);
    const currentGeneration = generation.current;
    const currentDetail = detailEpoch.current;
    await loadRef.current();
    if (selected && selectedIdRef.current === selected.id)
      try {
        const [l, a, t] = await Promise.all([
          request('/leads/' + selected.id),
          request('/leads/' + selected.id + '/activities'),
          request('/tasks?leadId=' + selected.id + '&state=Pending&limit=10'),
        ]);
        if (
          currentGeneration !== generation.current ||
          currentDetail !== detailEpoch.current
        )
          return;
        setSelected(l);
        setTimeline(a.items);
        setLeadTasks(t.items);
        setTimelineCursor(a.nextCursor);
      } catch (e) {
        if (
          currentGeneration === generation.current &&
          currentDetail === detailEpoch.current &&
          selectedIdRef.current === selected?.id
        ) {
          if (e instanceof ApiError && [401, 403, 404].includes(e.status)) {
            selectedIdRef.current = undefined;
            setSelected(null);
            setTimeline([]);
            setLeadTasks([]);
          }
          setError((e as Error).message);
        }
      }
  }
  const pendingAutomatic = timeline.some(
    (a) => a.autoReminder?.status === 'Pending',
  );
  useEffect(() => {
    if (demo || !selected || !pendingAutomatic) return;
    let alive = true,
      running = false;
    const id = selected.id,
      epoch = detailEpoch.current,
      current = generation.current;
    const timer = setInterval(async () => {
      if (running || document.visibilityState !== 'visible') return;
      running = true;
      try {
        const [a, t] = await Promise.all([
          request('/leads/' + id + '/activities?limit=100'),
          request('/tasks?leadId=' + id + '&state=Pending&limit=10'),
        ]);
        if (
          alive &&
          epoch === detailEpoch.current &&
          current === generation.current
        ) {
          const fresh = new Map<string, Entity>(
            a.items.map((item: Entity) => [item.id, item]),
          );
          setTimeline((old) => old.map((item) => fresh.get(item.id) || item));
          setLeadTasks(t.items);
        }
      } catch {
        /* The main refresh action reports connection failures. */
      } finally {
        running = false;
      }
    }, 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [demo, selected?.id, pendingAutomatic, request]);
  async function chooseLead(lead: Lead, initialTab: LeadWorkspaceTab = 'all') {
    if (!lead?.id) {
      setError('This lead is unavailable. Return to Leads and refresh.');
      return;
    }
    const epoch = ++detailEpoch.current;
    selectedIdRef.current = lead.id;
    timelineMoreRequest.current++;
    timelineMoreLock.current = false;
    setTimelineMoreBusy(false);
    setSelected(lead);
    setLeadTab(initialTab);
    if (window.matchMedia('(max-width: 599.99px)').matches)
      window.scrollTo(0, 0);
    setLeadTasks([]);
    setTimeline([]);
    setTimelineCursor(null);
    setDetailBusy(true);
    const current = generation.current;
    try {
      const [l, a, t] = await Promise.all([
        request('/leads/' + lead.id),
        request('/leads/' + lead.id + '/activities'),
        request('/tasks?leadId=' + lead.id + '&state=Pending&limit=10'),
      ]);
      if (current === generation.current && epoch === detailEpoch.current) {
        setSelected(l);
        setTimeline(a.items);
        setLeadTasks(t.items);
        setTimelineCursor(a.nextCursor);
        return l;
      }
    } catch (e) {
      if (current === generation.current && epoch === detailEpoch.current) {
        setError((e as Error).message);
        setSelected(null);
      }
    } finally {
      if (epoch === detailEpoch.current) setDetailBusy(false);
    }
  }
  async function inspectLead(lead: Lead) {
    if (window.matchMedia('(max-width: 1000.99px)').matches && lead?.id) {
      detailEpoch.current++;
      setSelected(null);
      setDetailBusy(true);
      setPage('leads');
      setLeadTab('all');
      const nextPath = '/leads/' + encodeURIComponent(lead.id);
      if (window.location.pathname !== nextPath)
        window.history.pushState({}, '', nextPath);
      setRouteLeadId(lead.id);
      window.scrollTo(0, 0);
      // Reopening the current route does not rerun its effect. Refresh it directly.
      if (routeLeadId === lead.id) return chooseLead(lead);
      return;
    }
    return chooseLead(lead);
  }
  async function openTask(t: Task) {
    setFocusedTask(t);
    setModal('taskdetail');
  }
  useEffect(() => {
    if (!active) return;
    const identityEpoch = generation.current;
    const params = new URLSearchParams(window.location.search);
    const leadId = routeLeadId || params.get('lead');
    const id = params.get('task');
    if (leadId) {
      let alive = true;
      setDetailBusy(true);
      if (routeLeadId && selectedIdRef.current !== routeLeadId) {
        detailEpoch.current++;
        selectedIdRef.current = undefined;
        setSelected(null);
        setTimeline([]);
        setLeadTasks([]);
      }
      request('/leads/' + encodeURIComponent(leadId))
        .then((l) => {
          if (alive && identityEpoch === generation.current) {
            setPage('leads');
            return chooseLead(
              l,
              tabAfterLeadLoad(leadTabRef.current, selectedIdRef.current, l.id),
            );
          }
        })
        .catch((e) => {
          if (alive && identityEpoch === generation.current)
            setError(e.message);
        })
        .finally(() => {
          if (alive && identityEpoch === generation.current)
            setDetailBusy(false);
        });
      return () => {
        alive = false;
      };
    }
    if (!id || demo) return;
    let alive = true;
    request('/tasks/' + encodeURIComponent(id))
      .then((t) => {
        if (alive && identityEpoch === generation.current) {
          setFocusedTask(t);
          setModal('taskdetail');
        }
      })
      .catch((e) => {
        if (alive && identityEpoch === generation.current) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [active, demo, request, session?.identity.uid, routeLeadId]);
  useEffect(() => {
    const sync = () => {
      const id = leadPathId(window.location.pathname);
      detailEpoch.current++;
      setRouteLeadId(id);
      setLeadTab('all');
      if (id) setPage('leads');
      else {
        detailEpoch.current++;
        setSelected(null);
        const p = window.location.pathname.slice(1);
        if (['today', 'leads', 'tasks', 'settings', 'imports'].includes(p))
          setPage(p as Page);
      }
    };
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  function closeLead() {
    detailEpoch.current++;
    selectedIdRef.current = undefined;
    timelineMoreRequest.current++;
    timelineMoreLock.current = false;
    setTimelineMoreBusy(false);
    setSelected(null);
    if (routeLeadId) {
      window.history.pushState({}, '', '/leads');
      setRouteLeadId(null);
    }
  }
  function expandLead() {
    if (!selected) return;
    window.history.pushState(
      {},
      '',
      '/leads/' + encodeURIComponent(selected.id),
    );
    setRouteLeadId(selected.id);
    setLeadTab('all');
    window.scrollTo(0, 0);
  }
  function go(p: Page) {
    if (p === 'notifications') {
      setInboxOpen(true);
      setMenu(false);
      return;
    }
    listEpoch.current++;
    detailEpoch.current++;
    setPage(p);
    selectedIdRef.current = undefined;
    setRouteLeadId(null);
    setSelected(null);
    setMenu(false);
    setError('');
    setNextCursor(null);
    window.history.pushState({}, '', `/${p}`);
    window.scrollTo(0, 0);
  }
  useEffect(() => {
    const p = (
      leadPathId(window.location.pathname)
        ? 'leads'
        : window.location.pathname.slice(1)
    ) as Page;
    if (
      [
        'today',
        'leads',
        'tasks',
        'notifications',
        'imports',
        'settings',
      ].includes(p)
    )
      setPage(p);
  }, []);
  async function authAction(redirect = false) {
    setError('');
    setSessionBusy(true);
    try {
      await (redirect ? redirectLogin() : login());
    } catch (e) {
      setError((e as Error).message);
      setSessionBusy(false);
    }
  }
  async function logout() {
    try {
      if (!demo) await revokeThisDevice();
    } catch {
      /* Generic push previews never contain lead data. */
    } finally {
      generation.current++;
      setData(blank);
      setSelected(null);
      setTimeline([]);
      setGuest(false);
      setColumnFilters([]);
      setSession(null);
      demoRef.current = demoData();
      removeStored('sessionStorage', 'salesdrone.import');
      await signOut(auth);
    }
  }
  async function taskChange(t: Task, patch: any) {
    setMutationBusy(true);
    try {
      await request('/tasks/' + t.id, 'PATCH', {
        expectedVersion: t.version,
        ...patch,
      });
      notify(
        patch.state === 'Completed'
          ? 'Task completed. One less thing on your list.'
          : 'Reminder updated.',
      );
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMutationBusy(false);
    }
  }
  async function leadAction(patch: any) {
    if (!selected) return;
    setMutationBusy(true);
    try {
      await request('/leads/' + selected.id, 'PATCH', {
        expectedVersion: selected.version,
        ...patch,
      });
      await refresh();
      notify('Lead updated.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMutationBusy(false);
    }
  }
  const timezone =
    session?.preferences.timezone ||
    Intl.DateTimeFormat().resolvedOptions().timeZone;
  const filteredDemoLeads = demo
    ? data.leads.filter(
        (l) =>
          !l.archived &&
          matchesColumnFilters(l, columnFilters) &&
          (!stage || l.stage === stage) &&
          (!source || l.source === source) &&
          (!search ||
            String(l[searchField] || '')
              .toLowerCase()
              .includes(search.toLowerCase())),
      )
    : data.leads;
  const visibleLeads = demo
    ? filteredDemoLeads.slice(0, demoLeadLimit)
    : data.leads;
  const leadQueryKey = JSON.stringify([
    session?.identity.uid,
    demo,
    stage,
    source,
    search,
    searchField,
    columnFilters,
  ]);
  const leadMoreCursor = demo
    ? demoLeadLimit < filteredDemoLeads.length
      ? 'sample:' + demoLeadLimit
      : null
    : nextCursor;
  const scoreIds = visibleLeads.map((l) => l.id + ':' + l.version).join(',');
  useEffect(() => {
    setLeadScores({});
    if (demo || page !== 'leads' || !data.leads.length) return;
    let alive = true;
    const get = () =>
      Promise.all(
        Array.from({ length: Math.ceil(data.leads.length / 100) }, (_, i) =>
          request(
            '/lead-scores?ids=' +
              data.leads
                .slice(i * 100, (i + 1) * 100)
                .map((l) => l.id)
                .join(','),
          ),
        ),
      )
        .then((results) => {
          if (alive)
            setLeadScores(
              Object.fromEntries(
                results.flatMap((r) => r.items).map((v: any) => [v.leadId, v]),
              ),
            );
        })
        .catch(() => {});
    void get();
    const timer = setInterval(() => void get(), 30000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [
    request,
    demo,
    page,
    scoreIds,
    session?.identity.uid,
    session?.member?.version,
  ]);
  const visibleTasks = (
    demo ? data.tasks.filter((t) => t.state === taskFilter) : data.tasks
  ).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const todayTasks = data.tasks
    .filter(
      (t) => t.state === 'Pending' && Date.parse(t.dueAt) <= todayEnd.getTime(),
    )
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const sourceOptions = [
    ...new Set([
      ...fieldOptions.values.source,
      ...data.leads.map((lead) => lead.source).filter(Boolean),
    ]),
  ];
  if (!authReady)
    return (
      <div className="startup">
        <Brand full />
        <Loading />
      </div>
    );
  if (!active)
    return (
      <div className="login-page">
        <div className="login-top">
          <Brand full />
          <div className="login-top-actions">
            <ThemeToggle
              appearance={appearance}
              onChange={(next) => void changeTheme(next)}
              busy={themeBusy}
            />
          </div>
        </div>
        <div className="login-content">
          <div className="login-copy">
            <span className="eyebrow">
              A LITTLE CLARITY. A LOT OF MOMENTUM.
            </span>
            <h1>
              <span className="conversation-script">Good conversations.</span>
              <br />
              <em>Better follow-through.</em>
            </h1>
            <p>
              Your enquiries, calls, and next steps.
              <br />
              Together in one calm workspace.
            </p>
            <div className="login-art" aria-label="Illustrative sales workflow">
              <div className="login-art-row">
                <span>01</span>
                <span>
                  <strong>Capture an enquiry</strong>
                  <small>One place for every conversation</small>
                </span>
                <span className="badge">New</span>
              </div>
              <div className="login-art-row">
                <span>02</span>
                <span>
                  <strong>Keep the next step clear</strong>
                  <small>Notes, calls and timely follow-ups</small>
                </span>
                <span className="badge">Working</span>
              </div>
              <div className="login-art-row">
                <span>03</span>
                <span>
                  <strong>Build the relationship</strong>
                  <small>From first contact to the right opportunity</small>
                </span>
                <span className="badge stage-qualified">Qualified</span>
              </div>
            </div>
            <div className="login-benefits">
              <span>
                <UsersRound size={17} /> Know your leads.
              </span>
              <span>
                <PhoneCall size={17} /> Keep the context.
              </span>
              <span>
                <Bell size={17} /> Remember the next step.
              </span>
            </div>
          </div>
          <section className="login-card">
            <span className="login-icon">
              <ArrowUpRight size={28} />
            </span>
            <h2>Welcome to SalesDrone</h2>
            <p>Sign in to pick up where you left off.</p>
            <button
              className="button google-button"
              disabled={sessionBusy}
              onClick={() => authAction()}
            >
              {sessionBusy ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <GoogleIcon />
              )}
              Continue with Google
            </button>
            <button className="text-button" onClick={() => authAction(true)}>
              Having trouble? Use redirect sign-in
            </button>
            <div className="login-divider">
              <span>or take a look around</span>
            </div>
            <button
              className="button demo-button"
              onClick={() => {
                setGuest(true);
                setPage('today');
                demoRef.current = demoData();
                setError('');
              }}
            >
              Explore the demo <ArrowRight size={16} />
            </button>
            <p className="login-fine">
              Live access is managed by your administrator.
              <br />
              Other accounts can explore with sample data.
            </p>
            <ErrorMessage error={error} />
          </section>
        </div>
        <footer className="login-bottom">
          <span>SalesDrone by AvinyaTech</span>
          <span>Built for a more focused workday.</span>
        </footer>
      </div>
    );
  return (
    <div
      className={'app-shell ' + (sidebarCollapsed ? 'sidebar-collapsed' : '')}
    >
      <a className="skip-link" href="#main-content">
        Skip to workspace
      </a>
      <aside
        className={'sidebar ' + (menu ? 'mobile-open' : '')}
        inert={compact && !menu}
      >
        <div className="sidebar-brand">
          <Brand />
          <button
            className="icon-button mobile-only"
            aria-label="Close navigation"
            onClick={() => setMenu(false)}
          >
            <X size={20} />
          </button>
        </div>
        <button
          aria-label="Quick navigation"
          title="Quick navigation"
          className="quick-search"
          onClick={() => setModal('command')}
        >
          <Search size={16} />
          <span>Quick navigation</span>
          <kbd>⌘ K</kbd>
        </button>
        <span className="nav-section">WORKSPACE</span>
        <nav aria-label="Main navigation">
          {nav.map((n) => (
            <button
              key={n.id}
              aria-label={n.label}
              title={n.label}
              className={page === n.id ? 'nav-item active' : 'nav-item'}
              onClick={() => go(n.id)}
              aria-current={page === n.id ? 'page' : undefined}
            >
              <n.icon size={19} />
              <span>{n.label}</span>
              {n.id === 'tasks' && todayTasks.length ? (
                <small>{todayTasks.length}</small>
              ) : null}
              {n.id === 'notifications' && inboxHasUnread ? (
                <i className="notification-dot" />
              ) : null}
            </button>
          ))}
        </nav>
        {importAccess ? (
          <>
            <span className="nav-section second">MANAGE</span>
            <nav aria-label="Administration">
              <button
                aria-label="Import enquiries"
                title="Import enquiries"
                className={'nav-item ' + (page === 'imports' ? 'active' : '')}
                onClick={() => go('imports')}
              >
                <Upload size={19} />
                <span>Import enquiries</span>
              </button>
            </nav>
          </>
        ) : null}
        <div className="sidebar-bottom">
          {can('tasks:write') ? (
            <button
              className="nav-item"
              aria-label="Set a reminder"
              title="Set a reminder"
              onClick={() => {
                setMenu(false);
                setModal('task');
              }}
            >
              <Bell size={19} />
              <span>Set a reminder</span>
            </button>
          ) : null}
          <button
            className="nav-item sidebar-collapse-control desktop-only"
            aria-label={
              sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'
            }
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!sidebarCollapsed}
            onClick={() => {
              setSidebarCollapsed(!sidebarCollapsed);
              writeStored(
                'localStorage',
                'salesdrone.sidebarCollapsed',
                String(!sidebarCollapsed),
              );
            }}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen size={19} />
            ) : (
              <PanelLeftClose size={19} />
            )}
            <span>{sidebarCollapsed ? 'Expand menu' : 'Collapse menu'}</span>
          </button>
          <a
            className="nav-item documentation-link"
            href="https://theharithsa.github.io/SalesDrone/product.html"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Documentation"
            title="Documentation"
          >
            <BookOpen size={19} />
            <span>Documentation</span>
          </a>
          <button
            aria-label="Settings"
            title="Settings"
            className={
              'nav-item ' +
              (['settings', 'members'].includes(page) ? 'active' : '')
            }
            onClick={() => go('settings')}
          >
            <Settings size={19} />
            <span>Settings</span>
          </button>
          <div className="sidebar-profile">
            <Avatar
              small
              name={session?.identity.name || 'Demo User'}
              photoURL={session?.identity.photoURL}
            />
            <div>
              <strong>
                {demo
                  ? 'Demo workspace'
                  : session?.identity.name?.split(' ')[0]}
              </strong>
              <small>{demo ? 'Sample data only' : session?.member?.role}</small>
            </div>
            <button
              className="icon-button"
              onClick={logout}
              aria-label="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
          <small className="sidebar-attribution">
            by AvinyaTech · Avinya Enterprises · v{APP_VERSION}
          </small>
        </div>
      </aside>
      {menu ? (
        <div className="mobile-nav-scrim" onClick={() => setMenu(false)} />
      ) : null}
      <div className="main-shell" inert={compact && menu}>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-only"
              onClick={() => setMenu(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>
              {
                {
                  today: 'Today',
                  leads: 'Leads',
                  tasks: 'Tasks',
                  notifications: 'Notifications',
                  settings: 'Settings',
                  imports: 'Import enquiries',
                  members: 'Settings',
                }[page]
              }
            </strong>
          </div>
          <div className="topbar-actions">
            <span className="today-date">
              <CalendarDays size={14} />
              {new Intl.DateTimeFormat('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                timeZone: timezone,
              }).format(new Date())}
            </span>
            <button
              className="icon-button"
              aria-label="Refresh workspace"
              onClick={() => void refresh()}
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
            </button>
            <NotificationOverlay
              key={
                (session?.identity.uid || 'demo') +
                ':' +
                (session?.member?.version || 0) +
                ':' +
                (session?.member?.accessPolicyVersion || 1)
              }
              open={inboxOpen}
              onOpenChange={setInboxOpen}
              timezone={timezone}
              request={request}
              onChanged={() =>
                window.dispatchEvent(new Event('salesdrone:inbox'))
              }
              onOpen={async (n, isCurrent) => {
                const epoch = generation.current;
                if (n.kind?.startsWith('lead_')) {
                  const lead = await request('/leads/' + n.leadId);
                  if (epoch !== generation.current || !isCurrent()) return;
                  go('leads');
                  await inspectLead(lead);
                } else {
                  const task = await request('/tasks/' + n.taskId);
                  if (epoch !== generation.current || !isCurrent()) return;
                  setFocusedTask(task);
                  setModal('taskdetail');
                }
              }}
              trigger={
                <button
                  className="icon-button"
                  aria-label="Open notifications"
                  title={
                    inboxHasUnread
                      ? 'You have unread notifications'
                      : 'Notifications'
                  }
                >
                  <Bell size={18} />
                  {inboxHasUnread ? (
                    <span
                      className="header-notification-dot"
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
              }
            />
            <Avatar
              name={session?.identity.name || 'Demo User'}
              photoURL={session?.identity.photoURL}
              small
            />
            <ThemeToggle
              appearance={appearance}
              onChange={(next) => void changeTheme(next)}
              busy={themeBusy}
            />
          </div>
        </header>
        {demo ? (
          <div className="demo-banner">
            <span>
              <span className="demo-indicator" />{' '}
              <strong>Demo — sample data</strong>
              <span className="demo-description">
                Explore freely. Changes reset when you leave.
              </span>
            </span>
            <button
              className="text-button"
              onClick={() => {
                demoRef.current = demoData();
                setSelected(null);
                setData(demoRef.current);
                setSummary(
                  demoSummary(
                    demoRef.current.leads,
                    demoRef.current.tasks,
                    demoRef.current.activities,
                  ),
                );
                notify('Demo reset.');
              }}
            >
              Reset demo
            </button>
          </div>
        ) : null}
        {session?.invitation && demo ? (
          <div className="notice invitation-banner">
            <ShieldCheck size={20} />
            <span>You have been granted {session.invitation.role} access.</span>
            <button
              className="button primary"
              onClick={async () => {
                try {
                  await api(
                    '/invitations/' + session.invitation!.id + '/accept',
                    'POST',
                    {},
                  );
                  await resolveSession();
                  notify('Welcome to your live workspace.');
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Accept live access
            </button>
          </div>
        ) : null}
        {error ? (
          <div className="global-error">
            <ErrorMessage error={error} />
            <button className="text-button" onClick={() => void refresh()}>
              Try again
            </button>
          </div>
        ) : null}
        {!online && !demo ? (
          <div className="notice offline-notice" role="status">
            Connection may be unavailable. Your unsaved text stays on this page;
            saving will report any connection problem.
          </div>
        ) : null}
        <main id="main-content">
          <Suspense fallback={<Loading />}>
            {page === 'today' ? (
              <DashboardPage
                key={
                  (session?.identity.uid || 'demo') +
                  ':' +
                  (session?.member?.version || 0) +
                  ':' +
                  (session?.member?.accessPolicyVersion || 1)
                }
                request={request}
                demo={!!demo}
                firstName={
                  demo
                    ? 'Explorer'
                    : session?.identity.name.split(' ')[0] || 'Hello'
                }
                timezone={timezone}
                stageOrder={fieldOptions.values.stage}
                onStage={(value) => {
                  setStage(value);
                  setSource('');
                  setSearch('');
                  setSearchDraft('');
                  setColumnFilters([]);
                  go('leads');
                }}
                sample={data}
                refreshKey={dashboardRefreshKey}
                onNew={can('leads:create') ? () => setModal('lead') : undefined}
                onTasks={() => go('tasks')}
                onLead={async (id) => {
                  const epoch = generation.current;
                  const lead = await request('/leads/' + id);
                  if (epoch !== generation.current) return;
                  go('leads');
                  await inspectLead(lead);
                }}
                onTask={async (id) => {
                  const epoch = generation.current;
                  const task = await request('/tasks/' + id);
                  if (epoch !== generation.current) return;
                  await openTask(task);
                }}
              />
            ) : null}
            {page === 'leads' ? (
              <div
                className={
                  'leads-page ' +
                  (routeLeadId
                    ? 'lead-page-mode'
                    : selected
                      ? 'lead-overlay-mode'
                      : '')
                }
              >
                <div className="page-body leads-main" hidden={!!routeLeadId}>
                  <div className="page-title">
                    <div>
                      <span className="eyebrow">
                        RELATIONSHIPS IN THE MAKING
                      </span>
                      <h1>
                        Leads
                        <span
                          className="heading-count"
                          aria-label={`${summary.total ?? data.leads.length} leads within your access`}
                          title={`${summary.total ?? data.leads.length} leads`}
                        >
                          <span className="lead-count-full">
                            {summary.total ?? data.leads.length}
                          </span>
                          <span className="lead-count-short" aria-hidden="true">
                            {new Intl.NumberFormat('en', {
                              notation: 'compact',
                              maximumFractionDigits: 0,
                            }).format(summary.total ?? data.leads.length)}
                          </span>
                        </span>
                      </h1>
                      <p>
                        Capture enquiries, keep the context and move the next
                        step forward.
                      </p>
                    </div>
                    <div className="title-actions lead-collection-actions">
                      {demo ||
                      session?.workspaceSettings?.exportsEnabled !== false ||
                      admin ? (
                        <div
                          className="lead-secondary-actions"
                          ref={leadActionsRoot}
                          onBlur={(event) => {
                            if (
                              !event.currentTarget.contains(
                                event.relatedTarget as Node,
                              )
                            )
                              setLeadMoreOpen(false);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Escape') {
                              setLeadMoreOpen(false);
                              leadMoreTrigger.current?.focus();
                              event.stopPropagation();
                            }
                          }}
                        >
                          <button
                            type="button"
                            ref={leadMoreTrigger}
                            className="icon-button lead-more-button"
                            aria-label="More lead actions"
                            title="More lead actions"
                            aria-expanded={leadMoreOpen}
                            aria-controls="lead-extra-actions"
                            onClick={() => setLeadMoreOpen(!leadMoreOpen)}
                          >
                            <MoreHorizontal size={20} />
                          </button>
                          <div
                            id="lead-extra-actions"
                            className={
                              'lead-action-popover' +
                              (leadMoreOpen ? ' open' : '')
                            }
                            onClick={(event) => {
                              if (
                                (event.target as HTMLElement).closest('button')
                              )
                                setLeadMoreOpen(false);
                            }}
                          >
                            {demo ||
                            session?.workspaceSettings?.exportsEnabled !==
                              false ? (
                              <LeadReportExport
                                menuTriggerRef={leadMoreTrigger}
                                request={request}
                                config={fieldOptions}
                                criteria={{
                                  filters: columnFilters,
                                  ...(stage ? { stage } : {}),
                                  ...(source ? { source } : {}),
                                  ...(search
                                    ? { search, field: searchField }
                                    : {}),
                                }}
                                demo={demo}
                                demoLeads={filteredDemoLeads}
                                key={
                                  session?.member?.accessPolicyVersion || 'demo'
                                }
                              />
                            ) : null}
                            {importAccess ? (
                              <button
                                className="button"
                                onClick={() => go('imports')}
                              >
                                <Upload size={16} /> Import
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                      {can('leads:create') ? (
                        <button
                          className="button primary lead-create-button"
                          aria-label="New enquiry"
                          title="New enquiry"
                          onClick={() => setModal('lead')}
                        >
                          <Plus size={18} />
                          <span className="lead-create-label-desktop">
                            New enquiry
                          </span>
                          <span className="lead-create-label-mobile">New</span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="lead-search-row">
                    <form
                      className="search-field"
                      onSubmit={(e) => {
                        e.preventDefault();
                        setSearch(searchDraft);
                      }}
                    >
                      <Search size={17} />
                      <input
                        aria-label="Search leads"
                        placeholder="Search leads…"
                        value={searchDraft}
                        onChange={(e) => {
                          setSearchDraft(e.target.value);
                          if (!e.target.value) setSearch('');
                        }}
                      />
                      <button
                        type="submit"
                        className="search-submit"
                        aria-label="Run search"
                      >
                        <ArrowRight size={15} />
                      </button>
                    </form>
                  </div>
                  <MobileLeadFilters
                    key={session?.identity.uid || 'demo'}
                    config={fieldOptions}
                    sources={sourceOptions}
                    applied={{
                      searchField,
                      stage,
                      source,
                      filters: columnFilters,
                    }}
                    onApply={(values) => {
                      setSearchField(values.searchField);
                      setStage(values.stage);
                      setSource(values.source);
                      setColumnFilters(values.filters);
                    }}
                  />
                  <details className="lead-filters-disclosure">
                    <summary>
                      <Filter size={16} /> Filters
                      {columnFilters.length || stage || source ? (
                        <span className="filter-count">
                          {columnFilters.length +
                            Number(!!stage) +
                            Number(!!source)}{' '}
                          active
                        </span>
                      ) : null}
                    </summary>
                    <div className="leads-toolbar">
                      <select
                        aria-label="Search field"
                        value={searchField}
                        onChange={(e) => setSearchField(e.target.value)}
                      >
                        <option value="name">
                          {labelFor(fieldOptions, 'name')}
                        </option>
                        <option value="company">
                          {labelFor(fieldOptions, 'company')}
                        </option>
                        <option value="phone">
                          {labelFor(fieldOptions, 'phone')}
                        </option>
                        <option value="email">
                          {labelFor(fieldOptions, 'email')}
                        </option>
                        <option value="location">
                          {labelFor(fieldOptions, 'location')}
                        </option>
                        <option value="zone">
                          {labelFor(fieldOptions, 'zone')}
                        </option>
                      </select>
                      <select
                        aria-label="Filter stage"
                        value={stage}
                        onChange={(e) => setStage(e.target.value)}
                      >
                        <option value="">
                          All {labelFor(fieldOptions, 'stage').toLowerCase()}
                        </option>
                        {withCurrent(
                          fieldOptions.values.stage,
                          selected?.stage,
                        ).map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                      <select
                        aria-label="Filter source"
                        value={source}
                        onChange={(e) => setSource(e.target.value)}
                      >
                        <option value="">
                          All {labelFor(fieldOptions, 'source').toLowerCase()}
                        </option>
                        {sourceOptions.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <LeadFilters
                      config={fieldOptions}
                      key={session?.identity.uid || 'demo'}
                      applied={columnFilters}
                      onApply={setColumnFilters}
                    />
                  </details>
                  <div className="mobile-lead-list-bar">
                    <label>
                      <span className="sr-only">Quick stage filter</span>
                      <select
                        aria-label="Quick stage filter"
                        value={stage}
                        onChange={(event) => setStage(event.target.value)}
                      >
                        <option value="">All stages</option>
                        {fieldOptions.values.stage.map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                    </label>
                    <span aria-live="polite">{visibleLeads.length} loaded</span>
                  </div>
                  <div
                    className="stage-tabs"
                    role="group"
                    aria-label="Quick stage filter"
                  >
                    {['', ...fieldOptions.values.stage.slice(0, 4)].map((s) => (
                      <button
                        key={s}
                        className={stage === s ? 'active' : ''}
                        onClick={() => setStage(s)}
                      >
                        {s || 'All leads'}
                      </button>
                    ))}
                  </div>
                  <section className="panel leads-table">
                    {loading && !visibleLeads.length ? (
                      <Loading />
                    ) : visibleLeads.length ? (
                      <LeadBatchEditor
                        key={leadQueryKey}
                        canEdit={!!can('leads:edit')}
                        canAssign={!!can('assignments:write')}
                        request={request}
                        onDone={() => void load()}
                        config={fieldOptions}
                        scores={leadScores}
                        leads={visibleLeads}
                        selectedId={selected?.id || null}
                        onSelect={inspectLead}
                      />
                    ) : (
                      <Empty
                        title={
                          nextCursor
                            ? 'More records remain to scan.'
                            : columnFilters.length || search || stage || source
                              ? 'No leads match these filters.'
                              : 'No leads here yet.'
                        }
                        action={
                          can('leads:create') ? (
                            <button
                              className="button"
                              onClick={() => setModal('lead')}
                            >
                              Create an enquiry
                            </button>
                          ) : null
                        }
                      >
                        Try a different filter, or add your next opportunity.
                      </Empty>
                    )}
                    <div className="panel-footer">
                      <span>
                        {visibleLeads.length} {demo ? 'sample ' : ''}leads shown
                      </span>
                      <InfiniteLeadLoader
                        key={leadQueryKey}
                        cursor={leadMoreCursor}
                        busy={loading}
                        error={listLoadError}
                        onLoad={() => {
                          if (demo) setDemoLeadLimit((limit) => limit + 30);
                          else void loadRef.current(!!nextCursor);
                        }}
                      />
                    </div>
                  </section>
                </div>
                {routeLeadId && !selected ? (
                  <div className="lead-route-state">
                    {detailBusy ? (
                      <Loading />
                    ) : (
                      <Empty title="This lead is unavailable.">
                        It may have been archived, or your access may have
                        changed.
                      </Empty>
                    )}
                    <button className="button" onClick={() => go('leads')}>
                      Return to leads
                    </button>
                  </div>
                ) : null}
                {selected ? (
                  <LeadBlade
                    fullPage={!!routeLeadId}
                    onExpand={expandLead}
                    onClose={closeLead}
                    toolbar={
                      <>
                        <button
                          className="text-button"
                          aria-label="Back to leads"
                          title="Back to leads"
                          onClick={() => {
                            closeLead();
                          }}
                        >
                          <ChevronLeft size={16} />
                          <span className="lead-action-label">
                            Back to leads
                          </span>
                        </button>
                        {!routeLeadId && (
                          <button
                            className="button detail-files-button"
                            aria-label="Files"
                            title="Files"
                            onClick={() => {
                              expandLead();
                              setLeadTab('files');
                            }}
                          >
                            <Paperclip size={16} />
                            <span className="lead-action-label">Files</span>
                          </button>
                        )}
                        {can('leads:edit') ? (
                          <button
                            className="button detail-edit-button"
                            aria-label="Edit lead"
                            title="Edit lead"
                            onClick={() => setModal('edit')}
                          >
                            <Pencil size={16} />
                            <span className="lead-action-label">Edit lead</span>
                          </button>
                        ) : null}
                      </>
                    }
                    identity={
                      <div className="detail-profile">
                        <Avatar name={selected.name} />
                        <h2>
                          <LeadName name={selected.name} detail />
                        </h2>
                        <p>{selected.company || 'Independent enquiry'}</p>
                        <div className="lead-header-score">
                          <span>Lead score</span>
                          <ScoreBadge
                            score={
                              detailScore?.id === selected.id
                                ? detailScore.report
                                : leadScores[selected.id]
                            }
                          />
                        </div>
                      </div>
                    }
                    workflow={
                      <>
                        <div className="detail-section">
                          <h3>
                            {labelFor(fieldOptions, 'stage', 'Sales stage')}
                          </h3>
                          {can('leads:edit') ? (
                            <select
                              aria-label="Update lead stage"
                              value={selected.stage}
                              disabled={mutationBusy || detailBusy}
                              onChange={(e) =>
                                void leadAction({ stage: e.target.value })
                              }
                            >
                              {withCurrent(
                                fieldOptions.values.stage,
                                selected.stage,
                              ).map((s) => (
                                <option key={s}>{s}</option>
                              ))}
                            </select>
                          ) : (
                            <Badge stage={selected.stage} />
                          )}
                        </div>
                        {admin ? (
                          <Assignment
                            key={selected.id}
                            compact
                            lead={selected}
                            request={request}
                            onSaved={refresh}
                          />
                        ) : (
                          <div className="assignment-control">
                            <h3>Assigned to</h3>
                            <span>
                              {selected.assignedToUid ===
                                session?.identity.uid ||
                              (demo && selected.assignedToUid === 'demo')
                                ? 'You'
                                : selected.assignedToUid
                                  ? 'Assigned member'
                                  : 'Unassigned'}
                            </span>
                          </div>
                        )}
                      </>
                    }
                  >
                    <LeadJourney
                      key={'journey:' + selected.id}
                      lead={selected}
                      stages={fieldOptions.values.stage}
                      request={request}
                      timezone={timezone}
                      demo={!!demo}
                    />
                    <div className="lead-work-layout">
                      <details className="lead-context" open={!compact}>
                        <summary>Details &amp; qualification</summary>
                        <LeadScore
                          key={selected.id}
                          leadId={selected.id}
                          version={selected.version}
                          request={request}
                          onReport={acceptScore}
                          canRefresh={!!can('leads:edit')}
                          timezone={timezone}
                          demo={demo}
                        />
                        {selected.doNotContact ? (
                          <div className="detail-warning">
                            Do not contact · {selected.suppressionReason}
                          </div>
                        ) : selected.needsReview ? (
                          <div className="detail-warning">
                            Contact needs review before outreach.
                          </div>
                        ) : null}
                        {!routeLeadId ? (
                          <div className="detail-actions">
                            {can('activities:write') ? (
                              <button
                                className="button primary"
                                disabled={
                                  selected.doNotContact ||
                                  selected.needsReview ||
                                  detailBusy
                                }
                                onClick={() => setModal('call')}
                              >
                                <Phone size={15} /> Log call
                              </button>
                            ) : null}
                            {can('tasks:write') ? (
                              <button
                                className="button"
                                onClick={() => setModal('task')}
                                disabled={detailBusy}
                              >
                                <Bell size={15} /> Remind me
                              </button>
                            ) : null}
                            {can('activities:write') ? (
                              <button
                                className="button"
                                aria-label="Add comment"
                                onClick={() => setModal('note')}
                                disabled={detailBusy}
                              >
                                <FileText size={18} /> Add comment
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                        <div className="detail-section contact-info">
                          <div className="worksheet-details">
                            <h3>LEAD INFORMATION</h3>
                            <dl>
                              {worksheetColumns
                                .filter(
                                  ([field]) =>
                                    !fieldOptions.hiddenFields.includes(
                                      field,
                                    ) &&
                                    ![
                                      'initialDiscussion',
                                      'followUp1',
                                      'followUp2',
                                      'followUp3',
                                      'followUp4',
                                    ].includes(field),
                                )
                                .map(([field, label]) => (
                                  <div key={field}>
                                    <dt>
                                      {labelFor(fieldOptions, field, label)}
                                    </dt>
                                    <dd
                                      className={
                                        field === 'phone'
                                          ? 'phone-number'
                                          : undefined
                                      }
                                    >
                                      {field === 'name' ? (
                                        <LeadName name={selected.name} />
                                      ) : field === 'enquiryDate' ? (
                                        displayDate(selected.enquiryDate)
                                      ) : field === 'phone' ? (
                                        !demo &&
                                        selected.phone &&
                                        !selected.doNotContact &&
                                        !selected.needsReview ? (
                                          <a href={'tel:' + selected.phone}>
                                            {selected.phone}
                                          </a>
                                        ) : (
                                          selected.phone ||
                                          selected.originalPhone ||
                                          'Not recorded'
                                        )
                                      ) : (
                                        String(
                                          selected[field] || 'Not recorded',
                                        )
                                      )}
                                    </dd>
                                  </div>
                                ))}
                              {!fieldOptions.hiddenFields.includes('email') ? (
                                <div>
                                  <dt>
                                    {labelFor(fieldOptions, 'email', 'Email')}
                                  </dt>
                                  <dd>
                                    {!demo &&
                                    selected.email &&
                                    !selected.doNotContact &&
                                    !selected.needsReview ? (
                                      <a href={'mailto:' + selected.email}>
                                        {selected.email}
                                      </a>
                                    ) : (
                                      selected.email || 'Not recorded'
                                    )}
                                  </dd>
                                </div>
                              ) : null}
                            </dl>
                          </div>
                          {fieldOptions.customFields.some(
                            (f) =>
                              !f.deleted ||
                              selected.customFields?.[f.id] !== undefined,
                          ) ? (
                            <details className="worksheet-details" open>
                              <summary>Additional information</summary>
                              <dl>
                                {fieldOptions.customFields
                                  .filter(
                                    (f) =>
                                      !f.deleted ||
                                      selected.customFields?.[f.id] !==
                                        undefined,
                                  )
                                  .map((f) => (
                                    <div key={f.id}>
                                      <dt>
                                        {f.label}
                                        {f.deleted ? ' (removed field)' : ''}
                                      </dt>
                                      <dd>
                                        {typeof selected.customFields?.[
                                          f.id
                                        ] === 'boolean'
                                          ? selected.customFields[f.id]
                                            ? 'Yes'
                                            : 'No'
                                          : String(
                                              selected.customFields?.[f.id] ??
                                                'Not recorded',
                                            )}
                                      </dd>
                                    </div>
                                  ))}
                              </dl>
                            </details>
                          ) : null}
                        </div>
                      </details>
                      <div className="lead-activity-area">
                        {!routeLeadId && leadTasks.length ? (
                          <div className="detail-section">
                            <h3>YOUR UPCOMING FOLLOW-UPS</h3>
                            {leadTasks.map((t) => (
                              <button
                                className="lead-task"
                                key={t.id}
                                onClick={() => openTask(t)}
                              >
                                <Bell size={14} />
                                <span>
                                  {t.title}
                                  <small>
                                    {displayDate(t.dueAt, timezone)}
                                  </small>
                                </span>
                                <ChevronRight size={14} />
                              </button>
                            ))}
                          </div>
                        ) : null}
                        {routeLeadId ? (
                          <>
                            <div className="lead-page-actions">
                              {can('activities:write') ? (
                                <>
                                  <button
                                    className="button"
                                    disabled={
                                      selected.doNotContact ||
                                      selected.needsReview ||
                                      detailBusy
                                    }
                                    onClick={() => setModal('call')}
                                  >
                                    <Phone size={16} /> Log call
                                  </button>
                                </>
                              ) : null}
                              {can('tasks:write') ? (
                                <button
                                  className="button"
                                  onClick={() => setModal('task')}
                                >
                                  <Bell size={16} /> Remind me
                                </button>
                              ) : null}
                            </div>
                            <div
                              className="lead-work-tabs"
                              role="tablist"
                              aria-label="Lead workspace"
                            >
                              {leadWorkspaceTabs.map((tab, index) => (
                                <button
                                  key={tab}
                                  id={'lead-tab-' + tab}
                                  role="tab"
                                  aria-selected={leadTab === tab}
                                  aria-controls={'lead-panel-' + tab}
                                  tabIndex={leadTab === tab ? 0 : -1}
                                  onKeyDown={(e) => {
                                    const tabs = leadWorkspaceTabs;
                                    const next =
                                      e.key === 'ArrowRight'
                                        ? (index + 1) % tabs.length
                                        : e.key === 'ArrowLeft'
                                          ? (index + tabs.length - 1) %
                                            tabs.length
                                          : e.key === 'Home'
                                            ? 0
                                            : e.key === 'End'
                                              ? tabs.length - 1
                                              : -1;
                                    if (next >= 0) {
                                      e.preventDefault();
                                      setLeadTab(tabs[next]);
                                      document
                                        .getElementById(
                                          'lead-tab-' + tabs[next],
                                        )
                                        ?.focus();
                                    }
                                  }}
                                  onClick={() => setLeadTab(tab)}
                                >
                                  {tab === 'all'
                                    ? 'All'
                                    : tab === 'calls'
                                      ? 'Calls'
                                      : tab === 'comments'
                                        ? 'Comments'
                                        : tab === 'tasks'
                                          ? 'Tasks'
                                          : tab === 'files'
                                            ? 'Files'
                                            : 'Review'}
                                  {tab === 'review' &&
                                  (selected.needsReview ||
                                    reviewActivities(timeline).length > 0)
                                    ? ' •'
                                    : ''}
                                </button>
                              ))}
                            </div>
                          </>
                        ) : null}
                        <div
                          className="lead-work-panel"
                          role={routeLeadId ? 'tabpanel' : undefined}
                          id={routeLeadId ? 'lead-panel-' + leadTab : undefined}
                          aria-labelledby={
                            routeLeadId ? 'lead-tab-' + leadTab : undefined
                          }
                          tabIndex={routeLeadId ? 0 : undefined}
                        >
                          {routeLeadId &&
                          (leadTab === 'review' ||
                            (leadTab === 'all' &&
                              (selected.needsReview ||
                                selected.doNotContact ||
                                reviewActivities(timeline).length > 0))) ? (
                            <section className="lead-review-intro">
                              <h3>Needs attention</h3>
                              <p>
                                {selected.needsReview
                                  ? 'Contact details need review before outreach. Check and edit the details, then clear the review flag below.'
                                  : 'Contact details have no review flag.'}
                              </p>
                              {selected.doNotContact ? (
                                <p>
                                  Do not contact:{' '}
                                  {selected.suppressionReason ||
                                    'Outreach is paused.'}
                                </p>
                              ) : null}
                              <p>
                                Follow-ups needing a date, failed analysis and
                                pending checks appear below. Load earlier
                                activity to inspect older entries. Tasks belong
                                to their recipient; this view does not expose
                                another member’s private reminders.
                              </p>
                            </section>
                          ) : null}
                          {routeLeadId && can('activities:write') ? (
                            <div
                              className="lead-composer-region"
                              id="lead-inline-composer"
                              hidden={
                                leadTab !== 'comments' && leadTab !== 'all'
                              }
                            >
                              <InlineCommentComposer
                                key={
                                  (session?.identity.uid || 'demo') +
                                  ':' +
                                  selected.id
                                }
                                leadId={selected.id}
                                version={selected.version}
                                request={request}
                                onSaved={refresh}
                                disabled={detailBusy}
                              />
                            </div>
                          ) : null}
                          {!routeLeadId ||
                          (leadTab !== 'tasks' && leadTab !== 'files') ? (
                            <div
                              className={
                                'detail-section lead-conversations ' +
                                (routeLeadId ? 'conversation-workspace' : '')
                              }
                            >
                              <div className="detail-section-title">
                                <h3>
                                  {routeLeadId && leadTab === 'review'
                                    ? 'FOLLOW-UP REVIEW'
                                    : routeLeadId && leadTab === 'calls'
                                      ? 'CALL HISTORY'
                                      : routeLeadId && leadTab === 'comments'
                                        ? 'COMMENTS'
                                        : 'ALL ACTIVITY'}
                                </h3>
                                <span>
                                  {
                                    filterLeadActivities(
                                      timeline,
                                      routeLeadId ? leadTab : 'all',
                                    ).length
                                  }{' '}
                                  {filterLeadActivities(
                                    timeline,
                                    routeLeadId ? leadTab : 'all',
                                  ).length === 1
                                    ? 'entry'
                                    : 'entries'}
                                </span>
                              </div>
                              {detailBusy ? (
                                <Loading />
                              ) : filterLeadActivities(
                                  timeline,
                                  routeLeadId ? leadTab : 'all',
                                ).length ? (
                                <div className="timeline">
                                  {filterLeadActivities(
                                    timeline,
                                    routeLeadId ? leadTab : 'all',
                                  ).map((a) => (
                                    <div key={a.id} className="timeline-item">
                                      <span
                                        className={
                                          'timeline-icon ' +
                                          (a.type === 'call' ? 'call' : '')
                                        }
                                      >
                                        {a.type === 'call' ? (
                                          <Phone size={13} />
                                        ) : (
                                          <FileText size={13} />
                                        )}
                                      </span>
                                      <div>
                                        <strong>
                                          {a.type === 'call'
                                            ? a.outcome
                                            : a.type === 'note'
                                              ? a.sourceColumn || 'Comment'
                                              : 'Lead updated'}
                                        </strong>
                                        <time>
                                          {a.imported
                                            ? 'Imported history · original date not recorded'
                                            : displayDate(
                                                a.createdAt,
                                                timezone,
                                              )}
                                        </time>
                                        <p className="comment-body">
                                          {a.notes}
                                        </p>
                                        <AutomaticReminder
                                          key={a.id + '_' + a.revision}
                                          activity={a}
                                          timezone={timezone}
                                          canManage={
                                            !demo &&
                                            can('tasks:write') &&
                                            a.autoReminder?.ownerUid ===
                                              session?.member?.uid
                                          }
                                          onAction={async (body) => {
                                            await request(
                                              '/activities/' +
                                                a.id +
                                                '/automatic-reminder',
                                              'PATCH',
                                              body,
                                            );
                                            await refresh();
                                          }}
                                        />
                                        {['call', 'note'].includes(a.type) &&
                                        a.revision &&
                                        can('activities:write') ? (
                                          <button
                                            className="text-button correction-button"
                                            onClick={() => {
                                              setSelectedActivity(a);
                                              setModal('correction');
                                            }}
                                          >
                                            Correct entry
                                          </button>
                                        ) : null}
                                        {a.disposition &&
                                        a.disposition !== 'None' ? (
                                          <span className="timeline-disposition">
                                            {a.disposition}
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="field-hint">
                                  {routeLeadId && leadTab === 'review'
                                    ? 'No follow-ups need review in the loaded activity. Use Earlier activity to check older entries.'
                                    : routeLeadId && leadTab === 'calls'
                                      ? 'No calls in the loaded activity. Log a call or load earlier activity.'
                                      : routeLeadId && leadTab === 'comments'
                                        ? 'No comments in the loaded activity. Write a comment or load earlier activity.'
                                        : 'No activity yet. Start with a conversation or a note.'}
                                </p>
                              )}
                              {timelineCursor ? (
                                <button
                                  className="text-button"
                                  disabled={timelineMoreBusy}
                                  onClick={async () => {
                                    if (timelineMoreLock.current) return;
                                    timelineMoreLock.current = true;
                                    setTimelineMoreBusy(true);
                                    const token = ++timelineMoreRequest.current;
                                    const epoch = detailEpoch.current,
                                      current = generation.current;
                                    try {
                                      const a = await request(
                                        '/leads/' +
                                          selected.id +
                                          '/activities?cursor=' +
                                          encodeURIComponent(timelineCursor),
                                      );
                                      if (
                                        epoch !== detailEpoch.current ||
                                        current !== generation.current
                                      )
                                        return;
                                      setTimeline((t) => [
                                        ...new Map(
                                          [...t, ...a.items].map((item) => [
                                            item.id,
                                            item,
                                          ]),
                                        ).values(),
                                      ]);
                                      setTimelineCursor(a.nextCursor);
                                    } catch (e) {
                                      if (
                                        epoch === detailEpoch.current &&
                                        current === generation.current
                                      )
                                        setError((e as Error).message);
                                    } finally {
                                      if (
                                        token === timelineMoreRequest.current
                                      ) {
                                        timelineMoreLock.current = false;
                                        setTimelineMoreBusy(false);
                                      }
                                    }
                                  }}
                                >
                                  Earlier activity
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                          {routeLeadId && leadTab === 'files' ? (
                            <LeadFiles
                              key={'files:' + selected.id}
                              leadId={selected.id}
                              request={request}
                              demo={demo}
                              canEdit={!!can('leads:edit')}
                            />
                          ) : null}
                          {routeLeadId && leadTab === 'tasks' ? (
                            <section>
                              <LeadTaskTab
                                refreshKey={dashboardRefreshKey}
                                key={selected.id}
                                leadId={selected.id}
                                request={request}
                                timezone={timezone}
                                onOpen={openTask}
                              />
                            </section>
                          ) : null}
                        </div>
                      </div>
                      {can('leads:edit') ? (
                        <div className="detail-section detail-admin-actions">
                          {selected.needsReview ? (
                            <button
                              className="button"
                              type="button"
                              disabled={mutationBusy || detailBusy}
                              onClick={() =>
                                void leadAction({ needsReview: false })
                              }
                            >
                              Clear contact review
                            </button>
                          ) : null}
                          <button
                            className="button lead-contact-action"
                            type="button"
                            disabled={mutationBusy || detailBusy}
                            onClick={() => {
                              if (selected.doNotContact)
                                void leadAction({
                                  doNotContact: false,
                                  suppressionReason: '',
                                });
                              else {
                                const reason = window.prompt(
                                  'Reason for marking do not contact:',
                                );
                                if (reason?.trim())
                                  void leadAction({
                                    doNotContact: true,
                                    suppressionReason: reason.trim(),
                                  });
                              }
                            }}
                          >
                            <Ban size={18} aria-hidden="true" />
                            {selected.doNotContact
                              ? 'Remove do-not-contact flag'
                              : 'Mark as do not contact'}
                          </button>
                          <button
                            className="button lead-archive-action"
                            type="button"
                            disabled={mutationBusy || detailBusy}
                            onClick={async () => {
                              try {
                                await request(
                                  '/leads/' + selected.id + '/archive',
                                  'POST',
                                  { expectedVersion: selected.version },
                                );
                                closeLead();
                                await loadRef.current();
                                notify(
                                  'Lead archived. Pending outreach was cancelled.',
                                );
                              } catch (e) {
                                setError((e as Error).message);
                              }
                            }}
                          >
                            <Archive size={18} aria-hidden="true" /> Archive
                            lead
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </LeadBlade>
                ) : null}
              </div>
            ) : null}
            {page === 'tasks' ? (
              <div className="page-body tasks-page">
                <div className="page-title">
                  <div>
                    <h1>Tasks</h1>
                    <p>Your follow-ups, organised by what needs attention.</p>
                  </div>
                  {can('tasks:write') ? (
                    <button
                      className="button primary task-create-button"
                      aria-label="Add reminder"
                      title="Add reminder"
                      onClick={() => setModal('task')}
                    >
                      <Plus size={18} />
                      <span className="task-create-label-desktop">
                        Add reminder
                      </span>
                      <span className="task-create-label-mobile">New</span>
                    </button>
                  ) : null}
                </div>
                <div className="task-list-toolbar">
                  <div
                    className="stage-tabs task-status-tabs"
                    role="group"
                    aria-label="Task status"
                  >
                    {['Pending', 'Completed', 'Cancelled'].map((s) => (
                      <button
                        key={s}
                        aria-pressed={taskFilter === s}
                        onClick={() => setTaskFilter(s)}
                        className={taskFilter === s ? 'active' : ''}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <label className="task-status-picker">
                    <span className="sr-only">Task status</span>
                    <select
                      aria-label="Task status"
                      value={taskFilter}
                      onChange={(event) => setTaskFilter(event.target.value)}
                    >
                      {['Pending', 'Completed', 'Cancelled'].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <span className="task-loaded-count" aria-live="polite">
                    {visibleTasks.length} loaded
                  </span>
                </div>
                <section
                  className="panel tasks-panel"
                  aria-label={`${taskFilter} tasks`}
                >
                  <div className="task-list-context">
                    <Clock size={14} aria-hidden="true" />
                    <span>Times in {timezone}</span>
                  </div>
                  {loading && !visibleTasks.length ? (
                    <Loading />
                  ) : visibleTasks.length ? (
                    visibleTasks.map((t) => (
                      <TaskRow
                        key={t.id}
                        task={t}
                        lead={data.leads.find((l) => l.id === t.leadId)}
                        timezone={timezone}
                        onOpen={() => openTask(t)}
                        onComplete={() => taskChange(t, { state: 'Completed' })}
                        onEdit={() => {
                          setFocusedTask(t);
                          setModal('edittask');
                        }}
                        onDelete={() => {
                          setFocusedTask(t);
                          setModal('deletetask');
                        }}
                        onCancel={() => taskChange(t, { state: 'Cancelled' })}
                        onSnooze={() =>
                          taskChange(t, {
                            dueAt: new Date(Date.now() + 3600000).toISOString(),
                          })
                        }
                        onReschedule={() => {
                          setFocusedTask(t);
                          setModal('reschedule');
                        }}
                        disabled={mutationBusy || !can('tasks:write')}
                      />
                    ))
                  ) : (
                    <Empty title="A little breathing room.">
                      Your {taskFilter.toLowerCase()} tasks will appear here.
                    </Empty>
                  )}
                  {nextCursor && !demo ? (
                    <div className="panel-footer">
                      <span />
                      <button
                        className="text-button"
                        disabled={loading}
                        onClick={() => void load(true)}
                      >
                        Load more
                      </button>
                    </div>
                  ) : null}
                </section>
              </div>
            ) : null}
            {page === 'notifications' ? (
              <Suspense fallback={<Loading />}>
                <NotificationsPage
                  items={data.notifications}
                  loading={loading}
                  timezone={timezone}
                  hasMore={!!nextCursor && !demo}
                  onMore={() => void load(true)}
                  onRead={async (n, read) => {
                    const identityEpoch = generation.current;
                    await request('/notifications/' + n.id, 'PATCH', { read });
                    if (identityEpoch !== generation.current) return;
                    const readAt = read ? new Date().toISOString() : null;
                    setData((old) => ({
                      ...old,
                      notifications: old.notifications.map((item) =>
                        item.id === n.id ? { ...item, readAt } : item,
                      ),
                    }));
                  }}
                  onOpen={async (n) => {
                    const identityEpoch = generation.current;
                    const navigationEpoch = listEpoch.current;
                    if (n.kind?.startsWith('lead_')) {
                      const lead = await request('/leads/' + n.leadId);
                      if (
                        identityEpoch !== generation.current ||
                        navigationEpoch !== listEpoch.current
                      )
                        return;
                      go('leads');
                      await inspectLead(lead);
                    } else {
                      const task = await request('/tasks/' + n.taskId);
                      if (
                        identityEpoch !== generation.current ||
                        navigationEpoch !== listEpoch.current
                      )
                        return;
                      setFocusedTask(task);
                      setModal('taskdetail');
                    }
                  }}
                />
              </Suspense>
            ) : null}
            {page === 'imports' ? (
              <ImportPage
                config={fieldOptions}
                choices={fieldOptions.values}
                demo={!!demo}
                canWrite={
                  !!session?.member?.capabilities.includes('imports:write')
                }
                canDelete={!!admin}
                request={request}
                onImported={() =>
                  notify('Import complete. Your pipeline is ready.')
                }
              />
            ) : null}
            {page === 'settings' || page === 'members' ? (
              <SettingsPage
                onOpenLead={(lead) => {
                  setPage('leads');
                  void inspectLead(lead);
                }}
                onWorkspacePolicyChanged={() => void resolveSession()}
                initialSection={page === 'members' ? 'access' : undefined}
                session={session}
                guestPreferences={{
                  appearance,
                  bookMode,
                  fontStyle,
                  displayScale,
                  timezone,
                }}
                demo={demo}
                devices={data.devices}
                fieldOptions={fieldOptions}
                onFieldOptions={setFieldOptions}
                request={request}
                onRefresh={() => void refresh()}
                onPreferences={(p) => {
                  document.documentElement.dataset.theme = p.appearance;
                  if (session && !demo)
                    setSession({ ...session, preferences: p });
                  else {
                    setGuestAppearance(p.appearance);
                    setGuestBookMode(p.bookMode === true);
                    setGuestFontStyle(normalizeFontStyle(p.fontStyle));
                    setGuestDisplayScale(normalizeDisplayScale(p.displayScale));
                    writeStored(
                      'localStorage',
                      'salesdrone.guestDisplayScale',
                      String(normalizeDisplayScale(p.displayScale)),
                    );
                    writeStored(
                      'localStorage',
                      'salesdrone.guestFontStyle',
                      normalizeFontStyle(p.fontStyle),
                    );
                    writeStored(
                      'localStorage',
                      'salesdrone.guestBookMode',
                      String(p.bookMode === true),
                    );
                  }
                  notify('Preferences saved.');
                }}
              />
            ) : null}
          </Suspense>
        </main>
      </div>
      <nav
        className="bottom-nav"
        aria-label="Mobile navigation"
        inert={compact && menu}
      >
        {nav.slice(0, 3).map((n) => (
          <button
            key={n.id}
            className={page === n.id ? 'active' : ''}
            onClick={() => go(n.id)}
          >
            <n.icon size={20} />
            <span>{n.label}</span>
          </button>
        ))}
        <button
          className={page === 'settings' ? 'active' : ''}
          onClick={() => setMenu(true)}
        >
          <MoreHorizontal size={21} />
          <span>More</span>
        </button>
      </nav>
      {toast ? (
        <div className="toast" role="status">
          <span>
            <Check size={14} />
          </span>
          {toast}
        </div>
      ) : null}
      <Modal
        open={modal === 'lead' || modal === 'edit'}
        onClose={() => setModal(null)}
        title={modal === 'edit' ? 'Edit enquiry' : 'New enquiry'}
        description={
          modal === 'edit'
            ? 'Keep contact details and enquiry context up to date.'
            : 'Add the details. We’ll keep the next steps together.'
        }
        wide
      >
        {modal === 'lead' || modal === 'edit' ? (
          <LeadForm
            config={fieldOptions}
            lead={modal === 'edit' ? selected || undefined : undefined}
            admin={admin}
            choices={fieldOptions.values}
            onCancel={() => setModal(null)}
            onSave={async (d, k) => {
              await request(
                modal === 'edit' ? '/leads/' + selected!.id : '/leads',
                modal === 'edit' ? 'PATCH' : 'POST',
                d,
                k,
              );
              notify(
                modal === 'edit'
                  ? 'Enquiry updated.'
                  : 'Enquiry created. Ready for its first conversation.',
              );
              await refresh();
            }}
          />
        ) : null}
      </Modal>
      <Modal
        open={modal === 'call'}
        onClose={() => setModal(null)}
        title="How did the conversation go?"
        description={selected ? `${selected.name} · ${selected.company}` : ''}
      >
        {selected && modal === 'call' ? (
          <CallForm
            config={fieldOptions}
            lead={selected}
            choices={fieldOptions.values}
            canEdit={can('leads:edit')}
            canTask={can('tasks:write')}
            onCancel={() => setModal(null)}
            onSave={async (d, k) => {
              await request(
                '/leads/' + selected.id + '/activities',
                'POST',
                d,
                k,
              );
              await refresh();
              notify(
                'Call saved. Any dated follow-up in your comment will be checked in the background.',
              );
            }}
          />
        ) : null}
      </Modal>
      <Modal
        open={modal === 'task'}
        onClose={() => setModal(null)}
        title="Give it a next step."
        description={
          selected
            ? `A reminder for ${selected.name}.`
            : 'A little reminder for whatever comes next.'
        }
      >
        {modal === 'task' ? (
          <TaskForm
            leadId={selected?.id}
            onCancel={() => setModal(null)}
            onSave={async (d, k) => {
              await request('/tasks', 'POST', d, k);
              await refresh();
              notify('Reminder set.');
            }}
          />
        ) : null}
      </Modal>
      <Modal
        open={modal === 'note'}
        onClose={() => setModal(null)}
        title="Add a comment"
        description="Each comment is saved as a new entry in this lead’s timeline."
      >
        {selected && modal === 'note' ? (
          <NoteForm
            onCancel={() => setModal(null)}
            onSave={async (d, k) => {
              await request(
                '/leads/' + selected.id + '/activities',
                'POST',
                {
                  type: 'note',
                  notes: d.notes,
                  expectedVersion: selected.version,
                },
                k,
              );
              await refresh();
              notify(
                'Note saved. Any dated follow-up will be checked in the background.',
              );
            }}
          />
        ) : null}
      </Modal>
      <Modal
        open={modal === 'edittask'}
        onClose={() => setModal(null)}
        title="Edit task"
        description="Update the title, timing or task type."
      >
        {focusedTask && modal === 'edittask' ? (
          <TaskEditForm
            task={focusedTask}
            onCancel={() => setModal(null)}
            onSave={async (data) => {
              await request('/tasks/' + focusedTask.id, 'PATCH', data);
              await refresh();
              notify('Task updated.');
            }}
          />
        ) : null}
      </Modal>
      <Modal
        open={modal === 'deletetask'}
        onClose={() => setModal(null)}
        title="Delete task"
        description="Remove this task and cancel its pending reminder."
      >
        {focusedTask && modal === 'deletetask' ? (
          <TaskDeleteForm
            task={focusedTask}
            onCancel={() => setModal(null)}
            onDelete={async () => {
              await request('/tasks/' + focusedTask.id, 'DELETE', {
                expectedVersion: focusedTask.version,
              });
              await refresh();
              notify('Task deleted.');
            }}
          />
        ) : null}
      </Modal>
      <Modal
        open={modal === 'reschedule'}
        onClose={() => setModal(null)}
        title="Find a better time."
        description={focusedTask?.title}
      >
        {focusedTask && modal === 'reschedule' ? (
          <RescheduleForm
            task={focusedTask}
            onCancel={() => setModal(null)}
            onSave={async (d) => {
              await request('/tasks/' + focusedTask.id, 'PATCH', d);
              await refresh();
              notify('Reminder rescheduled.');
            }}
          />
        ) : null}
      </Modal>
      <Modal
        open={modal === 'taskdetail'}
        onClose={() => setModal(null)}
        title={focusedTask?.title || 'Reminder'}
        description={
          focusedTask
            ? displayDate(focusedTask.dueAt, timezone)
            : 'Reminder details'
        }
      >
        {focusedTask ? (
          <div>
            <p className="field-hint">
              {focusedTask.state} ·{' '}
              {focusedTask.kind === 'outreach' ? 'Outreach' : 'Administrative'}
            </p>
            {focusedTask.leadId ? (
              <button
                className="button"
                onClick={async () => {
                  try {
                    const lead = await request('/leads/' + focusedTask.leadId);
                    setModal(null);
                    go('leads');
                    await chooseLead(lead);
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Open lead <ArrowUpRight size={15} />
              </button>
            ) : null}
            {can('tasks:write') &&
            (demo || focusedTask.recipientUid === session?.member?.uid) ? (
              <div className="task-detail-actions">
                <button className="button" onClick={() => setModal('edittask')}>
                  Edit task
                </button>
                <button
                  className="button danger"
                  onClick={() => setModal('deletetask')}
                >
                  Delete task
                </button>
              </div>
            ) : null}
            {focusedTask.state === 'Pending' && can('tasks:write') ? (
              <div className="form-footer">
                <button
                  className="button"
                  onClick={() => setModal('reschedule')}
                >
                  Reschedule
                </button>
                <button
                  className="button primary"
                  disabled={mutationBusy}
                  onClick={async () => {
                    await taskChange(focusedTask, { state: 'Completed' });
                    setModal(null);
                  }}
                >
                  Complete task <Check size={15} />
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
      <Modal
        open={modal === 'correction'}
        onClose={() => setModal(null)}
        title={
          selectedActivity?.type === 'note'
            ? 'Correct a note'
            : 'Correct a call entry'
        }
        description="Keep the record accurate while preserving its history."
      >
        {selectedActivity && modal === 'correction' ? (
          <CorrectionForm
            activity={selectedActivity}
            choices={fieldOptions.values}
            onCancel={() => setModal(null)}
            onSave={async (d, k) => {
              await request(
                '/activities/' + selectedActivity.id + '/corrections',
                'POST',
                d,
                k,
              );
              await refresh();
              notify(
                'Activity corrected. Any automatic reminder will be checked again.',
              );
            }}
          />
        ) : null}
      </Modal>
      <Modal
        open={modal === 'command'}
        onClose={() => setModal(null)}
        title="Where would you like to go?"
        description="Quick navigation · Cmd/Ctrl+K"
      >
        <div className="command-list">
          {[
            ...nav,
            { id: 'settings', label: 'Settings', icon: Settings },
            ...(importAccess
              ? [{ id: 'imports', label: 'Imports and history', icon: Upload }]
              : []),
            ...(admin
              ? [
                  {
                    id: 'members',
                    label: 'People & permissions',
                    icon: ShieldCheck,
                  },
                ]
              : []),
          ].map((n) => (
            <button
              key={n.id}
              onClick={() => {
                go(n.id as Page);
                setModal(null);
              }}
            >
              <n.icon size={18} />
              {n.label}
              <ArrowUpRight size={15} />
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.6 4.6 0 0 1-2 3v2.5h3.3c1.9-1.8 2.9-4.3 2.9-7.4Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.7-5.6-4.1H3v2.6A10.1 10.1 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.4 14a6 6 0 0 1 0-4V7.4H3a10 10 0 0 0 0 9.2L6.4 14Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.9c1.5 0 2.8.5 3.9 1.5l2.9-2.9A9.6 9.6 0 0 0 12 2a10.1 10.1 0 0 0-9 5.4L6.4 10A5.9 5.9 0 0 1 12 5.9Z"
      />
    </svg>
  );
}

function TaskRow({
  task,
  lead,
  timezone,
  onOpen,
  onComplete,
  onSnooze,
  onCancel,
  onReschedule,
  onEdit,
  onDelete,
  disabled,
}: {
  task: Task;
  lead?: Lead;
  timezone: string;
  onOpen: () => void;
  onComplete: () => void;
  onSnooze: () => void;
  onCancel?: () => void;
  onReschedule?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  disabled: boolean;
}) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!menuOpen) return;
    const outside = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node))
        menuRef.current.open = false;
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [menuOpen]);
  const overdue =
    task.state === 'Pending' && Date.parse(task.dueAt) < Date.now();
  return (
    <div className="task-row" data-state={task.state}>
      <button
        className={
          'task-check ' + (task.state === 'Completed' ? 'complete' : '')
        }
        aria-label={
          (task.state === 'Completed'
            ? 'Completed: '
            : task.state === 'Cancelled'
              ? 'Cancelled: '
              : 'Complete ') + task.title
        }
        disabled={disabled || task.state !== 'Pending'}
        onClick={onComplete}
      >
        <span className="task-check-symbol" aria-hidden="true">
          {task.state === 'Completed' ? (
            <Check size={14} />
          ) : task.state === 'Cancelled' ? (
            <X size={14} />
          ) : null}
        </span>
      </button>
      <button className="task-body" onClick={onOpen} aria-label={task.title}>
        <span className="task-title">{task.title}</span>
        <span className="task-context">
          {lead ? (
            <LeadName name={lead.name} />
          ) : task.leadId ? (
            'Lead follow-up'
          ) : (
            'Personal reminder'
          )}
          {lead?.company ? (
            <>
              <i>·</i>
              {lead.company}
            </>
          ) : null}
        </span>
      </button>
      <div className="task-time">
        <span className={overdue ? 'overdue' : ''}>
          {overdue ? <span className="overdue-dot" /> : <Clock size={12} />}{' '}
          <time dateTime={task.dueAt}>{displayDate(task.dueAt, timezone)}</time>
        </span>
        {overdue ? (
          <small>Overdue</small>
        ) : task.state !== 'Pending' ? (
          <small>{task.state}</small>
        ) : null}
      </div>
      {task.state === 'Pending' || onEdit || onDelete ? (
        <details
          ref={menuRef}
          className="task-menu"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.currentTarget.open = false;
              event.currentTarget.querySelector('summary')?.focus();
              event.stopPropagation();
            }
          }}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node))
              event.currentTarget.open = false;
          }}
          onToggle={(event) => {
            const details = event.currentTarget;
            setMenuOpen(details.open);
            if (!details.open) return;
            const menu = details.querySelector(
              ':scope > div',
            ) as HTMLElement | null;
            const trigger = details.querySelector('summary');
            if (!menu || !trigger) return;
            details.dataset.placement = 'below';
            const anchor = trigger.getBoundingClientRect();
            const top = Math.max(
              0,
              document.querySelector('.topbar')?.getBoundingClientRect()
                .bottom || 0,
            );
            const navigation = document
              .querySelector('.bottom-nav')
              ?.getBoundingClientRect();
            const bottom =
              navigation && navigation.height
                ? navigation.top
                : window.innerHeight;
            const above = Math.max(0, anchor.top - top - 8);
            const below = Math.max(0, bottom - anchor.bottom - 8);
            const placeAbove =
              menu.scrollHeight *
                scaleFromCSS(getComputedStyle(document.documentElement).zoom) >
                below && above > below;
            details.dataset.placement = placeAbove ? 'above' : 'below';
            menu.style.setProperty(
              '--task-menu-room',
              Math.max(
                1,
                (placeAbove ? above : below) /
                  scaleFromCSS(getComputedStyle(document.documentElement).zoom),
              ) + 'px',
            );
          }}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest('button')) {
              event.currentTarget.open = false;
              event.currentTarget.querySelector('summary')?.focus();
            }
          }}
        >
          <summary aria-label={'Actions for ' + task.title}>
            <MoreHorizontal size={18} />
          </summary>
          <div>
            {onEdit ? (
              <button onClick={onEdit} disabled={disabled}>
                Edit task
              </button>
            ) : null}
            {task.state === 'Pending' ? (
              <>
                <button onClick={onSnooze} disabled={disabled}>
                  Snooze 1 hour
                </button>
                {onReschedule ? (
                  <button onClick={onReschedule} disabled={disabled}>
                    Reschedule
                  </button>
                ) : null}
                {onCancel ? (
                  <button onClick={onCancel} disabled={disabled}>
                    Cancel task
                  </button>
                ) : null}
              </>
            ) : null}
            {onDelete ? (
              <button className="danger" onClick={onDelete} disabled={disabled}>
                Delete task
              </button>
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}

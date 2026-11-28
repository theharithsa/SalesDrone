import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '../lib/types';
import {
  ArrowDown, ArrowRight, BookOpen, ChartNoAxesCombined, Download, FileSpreadsheet, KeyRound,
  Laptop, ListTodo, Mail, Maximize2, Play, SlidersHorizontal, Smartphone, UsersRound, X,
} from 'lucide-react';
import { Brand } from './UI';

const docs = 'https://theharithsa.github.io/SalesDrone/';

const stories = [
  {
    id: 'leads',
    name: 'Leads & companies',
    icon: UsersRound,
    title: 'See where each enquiry stands.',
    description: 'Search across contact details and comments, then open the full record for the context behind the next call.',
    screens: [
      { label: 'Lead list', image: 'leads', alt: 'SalesDrone Leads worksheet with customer names, sales stages, scores, and phone numbers' },
      { label: 'Lead record', image: 'record', alt: 'Lead details, stage journey, and activity for a fictional enquiry' },
    ],
    details: [
      ['Find the right leads', 'Filter by stage, source, assignee, or a configured field. Change the stage right from the list.'],
      ['Keep the whole history', 'See stage changes, calls, comments, shared tasks, and reminders on the lead timeline. Keep related files with the record.'],
      ['Work by company', 'See enquiries grouped by organisation and add a lead directly to its company.'],
    ],
  },
  {
    id: 'follow-ups',
    name: 'Tasks & reminders',
    icon: ListTodo,
    title: 'Know who owns the next step.',
    description: 'Assign follow-ups to teammates, keep personal reminders private, and see what is due from the same workspace.',
    screens: [
      { label: 'Task list', image: 'tasks', alt: 'SalesDrone Tasks showing the linked lead, responsible person, due date, and reschedule action' },
      { label: 'Reminder form', image: 'reminder', alt: 'Set a reminder form with timing, recipient and notes for a lead follow-up' },
    ],
    details: [
      ['Follow through together', 'Open the linked lead from Tasks. Complete, reschedule, or reopen shared work with a comment when your access allows it.'],
      ['Set a reminder', 'Choose a follow-up date and time yourself, or review an automatic reminder detected in a note when that feature is enabled.'],
      ['Keep deadlines visible', 'Use in-app notifications and supported device push. Opt into daily task reminders or a weekly recap by email when available.'],
    ],
  },
  {
    id: 'insights',
    name: 'Reporting',
    icon: ChartNoAxesCombined,
    title: 'Decide what needs attention.',
    description: 'See the current pipeline, compare groups such as sales stages or enquiry sources, and open the leads behind a count.',
    screens: [
      { label: 'Team overview', image: 'team', alt: 'SalesDrone Team overview with workload totals, task completion, and recorded activity charts' },
    ],
    details: [
      ['See how the team is working', 'Admins can review assigned leads, task progress, and recorded activity using preset or custom date ranges.'],
      ['Compare the pipeline', 'Group leads by configured fields and drill into the current counts from Today.'],
      ['Review recorded activity', 'Admin Team views show recorded comments, calls, and task work by member in the selected time window.'],
    ],
  },
  {
    id: 'email',
    name: 'Email & digests',
    icon: Mail,
    title: 'Keep email with the lead.',
    description: 'When your workspace enables Email Beta, send formatted messages and receive replies in SalesDrone.',
    screens: [
      { label: 'Email inbox', image: 'email', alt: 'SalesDrone Email Beta with mailbox filters, a conversation list, and a formatted reply' },
    ],
    details: [
      ['Compose and reply', 'Use the formatting toolbar to add headings, lists, and links. Read HTML messages or switch to plain text.'],
      ['Open the linked lead', 'Read the thread alongside the lead’s calls, comments, and shared tasks as you prepare the next follow-up.'],
      ['Stay up to date', 'Workspace notifications can cover invitations, assignments, and stage outcomes. Daily reminders and weekly recaps summarize task work when enabled.'],
    ],
  },
] as const;

const intelligence = [
  {
    id: 'lead-assistant',
    title: 'Lead Assistant',
    text: 'Ask how many leads closed or which follow-ups are due next week. The assistant uses records you can access and includes supporting sources when available.',
    image: 'assistant',
    alt: 'Lead Assistant conversation using fictional lead records and source links',
  },
  {
    id: 'lead-score',
    title: 'Lead score',
    text: 'See the evidence behind each score. Fit, intent, and reported risks help you prioritize. Leads with too little evidence can remain unscored.',
    image: 'score',
    alt: 'Lead score panel with separate fit, intent, and risk values and evidence',
  },
  {
    id: 'lead-hygiene',
    title: 'Lead Hygiene',
    text: 'Review shared phone numbers, missing details, and possible archive candidates. Open the affected leads before acting on a finding.',
    image: 'hygiene',
    alt: 'Lead Hygiene report with contact matches and archive review findings',
  },
] as const;

const workspace = [
  { icon: SlidersHorizontal, title: 'Custom fields & layouts', text: 'Configure dropdowns, multi-selects, and phone fields. Set the order for forms and tables, and choose which details appear in the lead header.' },
  { icon: KeyRound, title: 'Workspace access', text: 'Admins control membership, lead scope, AvinyaIntelligence, and who can export. API integrations use scoped tokens and a documented contract.' },
];

const featureLinks = [
  ['tour', 'Video tour'], ['lead-intelligence', 'Lead Intelligence'],
  ['import-export', 'Import & export'], ['appearance', 'Appearance'], ['install-app', 'Install app'],
];

const screenSizes = {
  dashboard: [1360, 760],
  leads: [1134, 640],
  export: [560, 660],
  record: [1102, 670],
  tasks: [1134, 675],
  team: [1134, 720],
  assistant: [740, 298],
  score: [579, 422],
  hygiene: [989, 565],
  import: [850, 824],
  email: [1360, 715],
  appearance: [1000, 494],
  book: [1360, 494],
  reminder: [560, 538],
  phone: [390, 790],
} as const;

function Screen({ name, alt, darkMedia, eager = false }: {
  name: keyof typeof screenSizes;
  alt: string;
  darkMedia: string;
  eager?: boolean;
}) {
  const [width, height] = screenSizes[name];
  const [actualSize, setActualSize] = useState(false);
  const light = '/product-home/' + name;
  const dark = '/product-home/dark/' + name;
  return <Dialog.Root onOpenChange={(open) => { if (!open) setActualSize(false); }}>
    <Dialog.Trigger className="home-screen-trigger" aria-label={'Enlarge screenshot: ' + alt}>
      <picture>
        <source media={darkMedia} srcSet={`${dark}.webp 1x, ${dark}@2x.webp 2x`} />
        <img
          src={light + '.webp'}
          srcSet={`${light}.webp 1x, ${light}@2x.webp 2x`}
          alt=""
          width={width}
          height={height}
          loading={eager ? undefined : 'lazy'}
          decoding="async"
          fetchPriority={eager ? 'high' : undefined}
        />
      </picture>
      <span className="home-screen-enlarge" aria-hidden="true"><Maximize2 size={16} /></span>
    </Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="dialog-overlay" />
      <Dialog.Content className="dialog home-screen-dialog">
        <div className="home-screen-toolbar">
          <Dialog.Title>Product screenshot</Dialog.Title>
          <Dialog.Description className="sr-only">{alt}</Dialog.Description>
          <button type="button" className="button home-screen-size" aria-pressed={actualSize} onClick={() => setActualSize(!actualSize)}>
            Actual size
          </button>
          <Dialog.Close className="icon-button" aria-label="Close screenshot"><X size={20} /></Dialog.Close>
        </div>
        <div className="home-screen-image" data-actual-size={actualSize} tabIndex={0} role="region" aria-label="Screenshot preview">
          <picture>
            <source media={darkMedia} srcSet={dark + '@2x.webp'} />
            <img src={light + '@2x.webp'} alt={alt} width={width} height={height} />
          </picture>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

function storyFromHash() {
  return stories.find((story) => '#' + story.id === window.location.hash);
}

function ProductExplorer({ darkMedia }: { darkMedia: string }) {
  const [story, setStory] = useState(() => storyFromHash() ?? stories[0]);
  const [screenIndex, setScreenIndex] = useState(0);
  const screen = story.screens[screenIndex] ?? story.screens[0];

  useEffect(() => {
    const followLink = () => {
      const linkedStory = storyFromHash();
      if (linkedStory) {
        setStory(linkedStory);
        setScreenIndex(0);
      }
    };
    window.addEventListener('hashchange', followLink);
    return () => window.removeEventListener('hashchange', followLink);
  }, []);

  return <section className="home-explorer home-boundary" aria-labelledby="explorer-title">
    <div className="home-story-heading">
      <h2 id="explorer-title">Follow the work, from lead to close.</h2>
      <p>Choose a part of the workspace to see how it works.</p>
    </div>
    <div className="home-explorer-shell">
      <div className="home-chapters" role="group" aria-label="Workspace walkthrough">
        {stories.map((chapter) => <button
          className="home-chapter"
          id={chapter.id}
          key={chapter.id}
          type="button"
          aria-pressed={story.id === chapter.id}
          aria-controls="workspace-preview"
          onClick={() => {
            if (chapter.id === story.id) return;
            setStory(chapter);
            setScreenIndex(0);
            window.history.replaceState(window.history.state, '', '#' + chapter.id);
          }}
        >
          <chapter.icon size={19} aria-hidden="true" />
          <span>{chapter.name}</span>
          <ArrowRight className="home-chapter-arrow" size={16} aria-hidden="true" />
        </button>)}
      </div>

      <div className="home-explorer-panel" id="workspace-preview">
        <div className="home-explorer-copy" aria-live="polite">
          <h3>{story.title}</h3>
          <p>{story.description}</p>
        </div>
        <div className="home-explorer-preview">
          <div className="home-explorer-toolbar">
            {story.screens.length > 1
              ? <div className="home-preview-options" role="group" aria-label="Workspace preview">
                {story.screens.map(({ label }, index) => <button
                  type="button"
                  key={label}
                  aria-pressed={screenIndex === index}
                  onClick={() => setScreenIndex(index)}
                >{label}</button>)}
              </div>
              : <span>{screen.label}</span>}
          </div>
          <div className="home-explorer-screen" key={screen.image}>
            <Screen darkMedia={darkMedia} name={screen.image} alt={screen.alt} />
          </div>
        </div>
        <dl className="home-story-details">
          {story.details.map(([title, description]) => <div key={title}><dt>{title}</dt><dd>{description}</dd></div>)}
        </dl>
      </div>
    </div>
  </section>;
}

export default function ProductHome({ appearance, appearanceMode, signIn, onDemo }: {
  appearance: ReactNode;
  appearanceMode: Session['preferences']['appearance'];
  signIn: ReactNode;
  onDemo: () => void;
}) {
  const main = useRef<HTMLElement>(null);
  const [deviceDark, setDeviceDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  const darkPoster = appearanceMode === 'dark' || (appearanceMode === 'system' && deviceDark);
  const darkMedia = appearanceMode === 'dark' ? 'all'
    : appearanceMode === 'light' ? 'not all' : '(prefers-color-scheme: dark)';

  useEffect(() => {
    const query = matchMedia('(prefers-color-scheme: dark)');
    const update = () => setDeviceDark(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    // Fragment targets may mount after the browser's initial anchor lookup.
    const destination = document.getElementById(window.location.hash.slice(1));
    if (destination && main.current?.contains(destination)) {
      destination.scrollIntoView({ behavior: 'instant' });
    }
  }, []);

  useEffect(() => {
    if (!main.current || !('IntersectionObserver' in window) ||
      matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        (entry.target as HTMLElement).dataset.homeEntered = '';
        observer.unobserve(entry.target);
      }
    }, { threshold: .1 });
    for (const figure of main.current.querySelectorAll('.home-intelligence-grid figure, .home-data-grid figure, .home-appearance-grid')) {
      if (figure.getBoundingClientRect().top >= window.innerHeight) observer.observe(figure);
    }
    return () => observer.disconnect();
  }, []);

  return <div className="login-page product-home" id="top">
    <a className="skip-link" href="#sign-in">Skip to sign-in</a>
    <header className="login-top home-boundary">
      <Brand full />
      <nav className="home-nav" aria-label="Product">
        <a href="#leads">Leads</a>
        <a href="#email">Email</a>
        <a href="#lead-intelligence">Lead Intelligence</a>
        <a href="#install-app">Install app</a>
      </nav>
      <div className="login-top-actions">
        {appearance}
        <a className="button home-sign-in-link" href="#sign-in">Sign in</a>
      </div>
    </header>
    <main ref={main}>
      <section className="home-hero home-boundary" aria-labelledby="product-title">
        <div className="home-intro">
          <div className="home-intro-copy">
            <h1 id="product-title">From first enquiry<br /> to next follow-up.</h1>
            <p>SalesDrone gives sales teams one place to track leads, keep conversations in context, and follow through on shared work.</p>
            <div className="home-intro-links">
              <a className="home-scroll-link" href="#leads">Explore the product <ArrowDown size={16} aria-hidden="true" /></a>
              <a className="home-scroll-link home-tour-link" href="#tour"><Play size={16} aria-hidden="true" /> Watch the tour</a>
            </div>
          </div>
          {signIn}
        </div>
        <figure className="home-hero-preview">
          <div className="home-hero-screen">
            <Screen darkMedia={darkMedia} name="dashboard" alt="SalesDrone overview with pipeline, reminders and outreach at a glance" eager />
          </div>
          <div className="home-hero-phone">
            <Screen darkMedia={darkMedia} name="phone" alt="Phone layout showing a lead follow-up, its due date, and a reschedule action" />
          </div>
          <figcaption>Desktop and phone with sample data. Select a screenshot to enlarge it.</figcaption>
        </figure>
      </section>

      <nav className="home-feature-index home-boundary" aria-label="Explore SalesDrone">
        {featureLinks.map(([id, label]) => <a key={id} href={'#' + id}>{label}</a>)}
      </nav>

      <ProductExplorer darkMedia={darkMedia} />

      <section id="tour" className="home-tour home-workspace home-boundary" aria-labelledby="tour-title">
        <div className="home-story-heading">
          <h2 id="tour-title">Take a product tour.</h2>
          <p>Follow a sample enquiry from the pipeline to its lead record, set a reminder, and see Email and Lead Assistant in action.</p>
          <details className="home-tour-transcript">
            <summary>Tour transcript</summary>
            <ol>
              <li>Open Today to see the pipeline and upcoming follow-ups.</li>
              <li>Search Leads and open a record to review its stage and history.</li>
              <li>Use Remind me and choose a date for the follow-up.</li>
              <li>Read email threads tied to a lead and ask Lead Assistant about patterns in recorded notes.</li>
            </ol>
          </details>
        </div>
        <video
          className="home-tour-video"
          aria-label="SalesDrone product tour"
          controls
          playsInline
          preload="none"
          width={1280}
          height={800}
          poster={darkPoster ? '/product-home/dark/dashboard.webp' : '/product-home/tour-poster.webp'}
        >
          <source src="/product-home/salesdrone-tour.mp4" type="video/mp4" />
          <track kind="captions" src="/product-home/salesdrone-tour.en.vtt" srcLang="en" label="English" default />
          <a href="/product-home/salesdrone-tour.mp4">Download the SalesDrone tour</a>
        </video>
      </section>

      <section id="lead-intelligence" className="home-workspace home-boundary" aria-labelledby="intelligence-title">
        <div className="home-story-heading">
          <p className="home-kicker">AvinyaIntelligence</p>
          <h2 id="intelligence-title">Lead Intelligence</h2>
          <p>Ask a question, review qualification evidence, or check where your lead data needs attention. Availability follows workspace permissions.</p>
        </div>
        <div className="home-intelligence-grid">
          {intelligence.map((feature) => <article key={feature.id} id={feature.id} className="home-feature-card">
            <div>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </div>
            <figure><Screen darkMedia={darkMedia} name={feature.image} alt={feature.alt} /></figure>
          </article>)}
        </div>
      </section>

      <section id="import-export" className="home-workspace home-boundary" aria-labelledby="data-title">
        <div className="home-story-heading">
          <h2 id="data-title">Import & export leads</h2>
          <p>Use your existing spreadsheet and export the records you’re authorised to work with.</p>
        </div>
        <div className="home-workspace-grid home-data-grid">
          <article className="home-feature-card">
            <FileSpreadsheet size={23} aria-hidden="true" />
            <h3>Import Excel or CSV</h3>
            <p>Map columns and sales stages. Preview updates and possible duplicates before applying changes.</p>
            <figure><Screen darkMedia={darkMedia} name="import" alt="Workbook import review showing a possible duplicate and proposed changes" /></figure>
          </article>
          <article className="home-feature-card">
            <Download size={23} aria-hidden="true" />
            <h3>Export to Excel</h3>
            <p>Download the leads that match your current filters, with configured columns and comments. Export access is managed by your Admin.</p>
            <figure><Screen darkMedia={darkMedia} name="export" alt="SalesDrone export dialog showing export options" /></figure>
          </article>
        </div>
      </section>

      <section id="appearance" className="home-appearance home-workspace home-boundary" aria-labelledby="appearance-title">
        <div className="home-story-heading">
          <h2 id="appearance-title">Choose how SalesDrone looks.</h2>
          <p>Switch between light and dark, choose an accent or monochrome, and adjust the font and display scale. Book mode uses handwritten typography and bound pages.</p>
        </div>
        <div className="home-appearance-grid">
          <figure>
            <figcaption><SlidersHorizontal size={18} aria-hidden="true" /> Appearance settings</figcaption>
            <div className="home-appearance-frame">
              <Screen darkMedia={darkMedia} name="appearance" alt="Appearance settings with accent choices and interface preferences" />
            </div>
          </figure>
          <figure>
            <figcaption><BookOpen size={18} aria-hidden="true" /> Book mode</figcaption>
            <div className="home-appearance-frame">
              <Screen darkMedia={darkMedia} name="book" alt="The SalesDrone Tasks page shown in Book mode" />
            </div>
          </figure>
        </div>
      </section>

      <section id="workspace" className="home-workspace home-boundary" aria-labelledby="workspace-title">
        <div className="home-story-heading">
          <h2 id="workspace-title">Configure your workspace.</h2>
        </div>
        <div className="home-workspace-grid">
          {workspace.map(({ icon: Icon, title, text }) => <article key={title} className="home-feature-card">
            <Icon size={23} aria-hidden="true" />
            <h3>{title}</h3>
            <p>{text}</p>
          </article>)}
        </div>
      </section>

      <section id="install-app" className="home-workspace home-boundary" aria-labelledby="install-title">
        <div className="home-story-heading">
          <p className="home-kicker">Progressive web app</p>
          <h2 id="install-title">Install SalesDrone on your device.</h2>
          <p>Open the same workspace from the Mac Dock or your Android home screen.</p>
        </div>
        <div className="home-workspace-grid">
          <article className="home-feature-card">
            <Laptop size={23} aria-hidden="true" />
            <h3>Mac</h3>
            <p>On macOS Sonoma or later, open SalesDrone in Safari and choose <strong>File → Add to Dock</strong>.</p>
          </article>
          <article className="home-feature-card">
            <Smartphone size={23} aria-hidden="true" />
            <h3>Android</h3>
            <p>Open SalesDrone in Chrome. From the browser menu, choose the install or Add to Home screen option and confirm.</p>
          </article>
        </div>
      </section>

      <section className="home-try home-boundary" aria-labelledby="try-title">
        <div className="home-try-card">
          <div>
            <h2 id="try-title">Try a day in SalesDrone.</h2>
            <p>Open a sample lead, explore its timeline, and try a follow-up with fictional records.</p>
          </div>
          <div className="home-try-actions">
            <button className="button primary" type="button" onClick={onDemo}>Open sample workspace <ArrowRight size={17} aria-hidden="true" /></button>
            <a className="button" href="#sign-in">Go to sign-in</a>
          </div>
        </div>
      </section>
    </main>
    <footer className="home-footer home-boundary">
      <span>SalesDrone by AvinyaTech</span>
      <nav aria-label="Product resources">
        <a href={docs + 'product.html'}>Product guide</a>
        <a href={docs + 'roadmap.html'}>Roadmap</a>
        <a href={docs + 'releases.html'}>Release notes</a>
        <a href="/api/docs">API reference</a>
      </nav>
    </footer>
  </div>;
}

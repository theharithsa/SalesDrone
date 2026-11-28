import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '../lib/types';
import {
  ArrowDown, ArrowRight, Download, FileSpreadsheet, KeyRound,
  Laptop, Maximize2, SlidersHorizontal, Smartphone, X,
} from 'lucide-react';
import { Brand } from './UI';

const docs = 'https://theharithsa.github.io/SalesDrone/';

const stories = [
  {
    id: 'leads',
    name: 'Leads & companies',
    title: 'See where each enquiry stands.',
    description: 'Search across contact details and comments, then open the full record for the context behind the next call.',
    image: 'leads',
    alt: 'SalesDrone Leads worksheet with customer names, sales stages, scores, and phone numbers',
    details: [
      ['Find the right leads', 'Filter by stage, source, assignee, or a configured field. Change the stage right from the list.'],
      ['Keep the whole history', 'See stage changes, calls, comments, shared tasks, and reminders on the lead timeline. Keep related files with the record.'],
      ['Work by company', 'See enquiries grouped by organisation and add a lead directly to its company.'],
    ],
  },
  {
    id: 'follow-ups',
    name: 'Tasks & reminders',
    title: 'Know who owns the next step.',
    description: 'Assign follow-ups to teammates, keep personal reminders private, and see what is due from the same workspace.',
    image: 'tasks',
    alt: 'SalesDrone Tasks showing the linked lead, responsible person, due date, and reschedule action',
    details: [
      ['Follow through together', 'Open the linked lead from Tasks. Complete, reschedule, or reopen shared work with a comment when your access allows it.'],
      ['Set a reminder', 'Choose a follow-up date and time yourself, or review an automatic reminder detected in a note when that feature is enabled.'],
      ['Keep deadlines visible', 'Use in-app notifications and supported device push. Opt into daily task reminders or a weekly recap by email when available.'],
    ],
  },
  {
    id: 'insights',
    name: 'Reporting',
    title: 'Decide what needs attention.',
    description: 'See the current pipeline, compare groups such as sales stages or enquiry sources, and open the leads behind a count.',
    image: 'team',
    alt: 'SalesDrone Team overview with workload totals, task completion, and recorded activity charts',
    details: [
      ['See how the team is working', 'Admins can review assigned leads, task progress, and recorded activity using preset or custom date ranges.'],
      ['Compare the pipeline', 'Group leads by configured fields and drill into the current counts from Today.'],
      ['Review recorded activity', 'Admin Team views show recorded comments, calls, and task work by member in the selected time window.'],
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
  ['leads', 'Leads'], ['follow-ups', 'Tasks & reminders'], ['email', 'Email & digests'],
  ['lead-intelligence', 'Lead Intelligence'], ['lead-score', 'Lead score'], ['lead-hygiene', 'Lead Hygiene'],
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
  reminder: [560, 440],
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

export default function ProductHome({ appearance, appearanceMode, signIn, onDemo }: {
  appearance: ReactNode;
  appearanceMode: Session['preferences']['appearance'];
  signIn: ReactNode;
  onDemo: () => void;
}) {
  const main = useRef<HTMLElement>(null);
  const darkMedia = appearanceMode === 'dark' ? 'all'
    : appearanceMode === 'light' ? 'not all' : '(prefers-color-scheme: dark)';

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
    for (const figure of main.current.querySelectorAll('.home-story figure, .home-workspace figure')) {
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
            <a className="home-scroll-link" href="#leads">Explore the product <ArrowDown size={16} aria-hidden="true" /></a>
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

      <div className="home-stories">
        {stories.map((story) => <section key={story.id} id={story.id} className="home-story home-boundary" aria-labelledby={story.id + '-title'}>
          <div className="home-story-heading">
            <p className="home-kicker">{story.name}</p>
            <h2 id={story.id + '-title'}>{story.title}</h2>
            <p>{story.description}</p>
          </div>
          <div className={story.id === 'follow-ups' ? 'home-screenshot-pair' : 'home-wide-screens'}>
            <figure className="home-showcase"><Screen darkMedia={darkMedia} name={story.image} alt={story.alt} /></figure>
            {story.id === 'leads' && <figure className="home-showcase"><Screen darkMedia={darkMedia} name="record" alt="Lead details, stage journey, and activity for a fictional enquiry" /></figure>}
            {story.id === 'follow-ups' && <figure className="home-showcase"><Screen darkMedia={darkMedia} name="reminder" alt="Set a reminder form with timing, recipient and notes for a lead follow-up" /></figure>}
          </div>
          <dl className="home-story-details">
            {story.details.map(([title, description]) => <div key={title}><dt>{title}</dt><dd>{description}</dd></div>)}
          </dl>
        </section>)}
      </div>

      <section id="email" className="home-workspace home-boundary" aria-labelledby="email-title">
        <div className="home-story-heading">
          <p className="home-kicker">Email & digests</p>
          <h2 id="email-title">Keep email with the lead.</h2>
          <p>When your workspace enables Email Beta, send formatted messages and receive replies in SalesDrone.</p>
        </div>
        <figure className="home-showcase"><Screen darkMedia={darkMedia} name="email" alt="SalesDrone Email Beta with mailbox filters, a conversation list, and a formatted reply" /></figure>
        <dl className="home-story-details">
          <div><dt>Compose and reply</dt><dd>Use the formatting toolbar to add headings, lists, and links. Read HTML messages or switch to plain text.</dd></div>
          <div><dt>Open the linked lead</dt><dd>Read the thread alongside the lead’s calls, comments, and shared tasks as you prepare the next follow-up.</dd></div>
          <div><dt>Stay up to date</dt><dd>Workspace notifications can cover invitations, assignments, and stage outcomes. Daily reminders and weekly recaps summarize task work when enabled.</dd></div>
        </dl>
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

      <section id="appearance" className="home-workspace home-boundary" aria-labelledby="appearance-title">
        <div className="home-story-heading">
          <h2 id="appearance-title">Choose how SalesDrone looks.</h2>
          <p>Switch between light and dark, choose an accent or monochrome, and adjust the font and display scale. Book mode uses handwritten typography and bound pages.</p>
        </div>
        <div className="home-workspace-grid">
          <figure className="home-showcase"><Screen darkMedia={darkMedia} name="appearance" alt="Appearance settings with accent choices and interface preferences" /></figure>
          <figure className="home-showcase"><Screen darkMedia={darkMedia} name="book" alt="The SalesDrone Tasks page shown in Book mode" /></figure>
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

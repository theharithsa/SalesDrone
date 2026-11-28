import type { ReactNode } from 'react';
import {
  ArrowDown, ArrowRight, Building2, Columns3,
  FileSpreadsheet, KeyRound, Mail, SlidersHorizontal,
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
    name: 'Tasks & email',
    title: 'Know who owns the next step.',
    description: 'Assign follow-ups to teammates, keep personal reminders private, and see what is due from the same workspace.',
    image: 'tasks',
    alt: 'SalesDrone Tasks showing the linked lead, responsible person, due date, and reschedule action',
    details: [
      ['Follow through together', 'Open the linked lead from Tasks. Complete, reschedule, or reopen shared work with a comment when your access allows it.'],
      ['Keep deadlines visible', 'Get workspace notifications and opt into due-task email reminders and weekly recaps when your workspace enables them.'],
      ['Reply in context', 'With Email Beta enabled, compose formatted email and read replies in a conversation linked to a lead.'],
    ],
  },
  {
    id: 'insights',
    name: 'Reporting & intelligence',
    title: 'Decide what needs attention.',
    description: 'See the current pipeline, compare groups such as sales stages or enquiry sources, and open the leads behind a count.',
    image: 'team',
    alt: 'SalesDrone Team overview with workload totals, task completion, and recorded activity charts',
    details: [
      ['See how the team is working', 'Admins can review assigned leads, task progress, and recorded activity using preset or custom date ranges.'],
      ['Ask about your leads', 'Use Lead Assistant for questions about accessible records. Review the supporting lead details and the evidence behind a score.'],
      ['Keep the list healthy', 'Use Lead Hygiene to review shared contact details, missing information, and possible archive candidates.'],
    ],
  },
] as const;

const workspace = [
  { icon: FileSpreadsheet, title: 'Filtered Excel reports', text: 'Export the leads that match your filters, with comments and configured field order where available.' },
  { icon: SlidersHorizontal, title: 'Custom fields & layouts', text: 'Configure dropdowns, multi-selects, and phone fields. Set the order for forms and tables, and choose which details appear in the lead header.' },
  { icon: KeyRound, title: 'Workspace access', text: 'Admins control membership, lead scope, AvinyaIntelligence, and who can export. API integrations use scoped tokens and a documented contract.' },
  { icon: Columns3, title: 'Make it yours', text: 'Choose your font, accent, and display scale. Book mode gives the workspace a quieter reading layout.' },
];

function Screen({ name, alt, eager = false }: { name: string; alt: string; eager?: boolean }) {
  return <img
    src={'/product-home/' + name + '.webp'}
    alt={alt}
    width={name === 'phone' ? 390 : 1280}
    height={name === 'phone' ? 810 : 800}
    loading={eager ? undefined : 'lazy'}
    decoding="async"
    fetchPriority={eager ? 'high' : undefined}
  />;
}

export default function ProductHome({ appearance, signIn, onDemo }: {
  appearance: ReactNode;
  signIn: ReactNode;
  onDemo: () => void;
}) {
  return <div className="login-page product-home" id="top">
    <a className="skip-link" href="#sign-in">Skip to sign-in</a>
    <header className="login-top home-boundary">
      <Brand full />
      <nav className="home-nav" aria-label="Product">
        <a href="#leads">Leads</a>
        <a href="#follow-ups">Follow-ups</a>
        <a href="#insights">Insights</a>
        <a href="#workspace">Workspace</a>
      </nav>
      <div className="login-top-actions">
        {appearance}
        <a className="button home-sign-in-link" href="#sign-in">Sign in</a>
      </div>
    </header>
    <main>
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
            <Screen name="dashboard" alt="SalesDrone overview with pipeline, reminders and outreach at a glance" eager />
          </div>
          <div className="home-hero-phone">
            <Screen name="phone" alt="Phone layout showing a lead follow-up, its due date, and a reschedule action" />
          </div>
          <figcaption>SalesDrone on desktop and phone, shown with sample data.</figcaption>
        </figure>
      </section>

      <div className="home-stories">
        {stories.map((story) => <section key={story.id} id={story.id} className="home-story home-boundary" aria-labelledby={story.id + '-title'}>
          <div className="home-story-heading">
            <p className="home-kicker">{story.name}</p>
            <h2 id={story.id + '-title'}>{story.title}</h2>
            <p>{story.description}</p>
          </div>
          <figure className="home-showcase"><Screen name={story.image} alt={story.alt} /></figure>
          <dl className="home-story-details">
            {story.details.map(([title, description]) => <div key={title}><dt>{title}</dt><dd>{description}</dd></div>)}
          </dl>
        </section>)}
      </div>

      <section id="workspace" className="home-workspace home-boundary" aria-labelledby="workspace-title">
        <div className="home-story-heading">
          <p className="home-kicker">Workspace setup</p>
          <h2 id="workspace-title">Set up SalesDrone around your process.</h2>
          <p>Bring in existing leads, define what the team tracks, and grant people the access they need.</p>
        </div>
        <article className="home-import-card">
          <div>
            <FileSpreadsheet size={23} aria-hidden="true" />
            <h3>Bring your spreadsheet with you.</h3>
            <p>Import Excel or CSV, map the columns and sales stages, and review duplicate matches before applying changes. Export a filtered report for offline work when your access allows it.</p>
          </div>
          <figure><Screen name="import" alt="An import review with duplicate matches and individual field changes to approve" /></figure>
        </article>
        <div className="home-workspace-grid">
          <article className="home-feature-card home-feature-wide">
            <Building2 size={23} aria-hidden="true" />
            <h3>One record from first contact onward</h3>
            <p>Open a lead to see its contact details, stage history, and activity before a call or handoff.</p>
            <figure><Screen name="record" alt="A sample lead record with contact information, lead journey, and activity" /></figure>
          </article>
          <article className="home-feature-card home-feature-wide">
            <Mail size={23} aria-hidden="true" />
            <h3>Lead conversations in Email Beta</h3>
            <p>Read an HTML reply alongside the conversation list. Compose with formatting and jump back to the linked lead.</p>
            <figure><Screen name="email" alt="SalesDrone Email Beta showing mailbox filters, a conversation list, and an HTML reply" /></figure>
          </article>
          {workspace.map(({ icon: Icon, title, text }) => <article key={title} className="home-feature-card">
            <Icon size={23} aria-hidden="true" />
            <h3>{title}</h3>
            <p>{text}</p>
          </article>)}
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

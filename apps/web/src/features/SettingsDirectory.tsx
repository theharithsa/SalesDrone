import { ArrowLeft, ChevronRight, Info, Search, Settings2, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { useEffect, useState, type MouseEvent } from 'react';
import catalog from '../lib/settings-sections.json';

export type SettingsSection = (typeof catalog)[number];
export const settingsGroups = [
  { id: 'manageFields', label: 'Lead fields', description: 'Set up the enquiry form and choose how lead information appears.', icon: Settings2 },
  { id: 'personal', label: 'Personal', description: 'Manage your account, display and devices.', icon: UserRound },
  { id: 'workspace', label: 'Workspace', description: 'Manage access, integrations and lead data.', icon: ShieldCheck },
  { id: 'intelligence', label: 'Intelligence', description: 'Set up insights, reminders, scoring and research.', icon: Sparkles },
  { id: 'product', label: 'About', description: 'Get to know SalesDrone.', icon: Info },
];
export type SettingsLocation = { section?: string; group?: string };
const searchTerms: Record<string, string> = {
  fields: 'field definitions custom built-in enquiry form add remove',
  'field-order': 'arrange reorder columns table export move order enquiry form',
  'lead-header': 'lead details phone number company extra fields under name',
  choices: 'dropdown choices options stage source',
  appearance: 'font zoom display scale theme book mode timezone',
  archives: 'archive restore',
};

export function SettingsDirectory({ sections, selected, group, href, onNavigate }: {
  sections: SettingsSection[];
  selected?: SettingsSection;
  group?: string;
  href: (location: SettingsLocation) => string;
  onNavigate: (location: SettingsLocation) => void;
}) {
  const [search, setSearch] = useState('');
  useEffect(() => { if (group) setSearch(''); }, [group]);
  const available = settingsGroups.filter((entry) => sections.some((section) => section.group === entry.id));
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const match = (item: SettingsSection) => words.every((word) =>
    [item.label, item.description, searchTerms[item.id], available.find((entry) => entry.id === item.group)?.label]
      .join(' ').toLowerCase().includes(word));
  const groups = available.filter((entry) => words.length || !group || group === entry.id);
  const matches = sections.filter(match).length;
  const follow = (event: MouseEvent<HTMLAnchorElement>, location: SettingsLocation) => {
    if (event.button || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    onNavigate(location);
  };
  return (
    <>
      <nav className="settings-directory-rail" aria-label="Settings categories">
        <a href={href({})} aria-current={!selected && !group ? 'page' : undefined} onClick={(event) => follow(event, {})}>
          <Settings2 size={18} aria-hidden="true" /> All settings
        </a>
        {available.map(({ id, label, icon: Icon }) => (
          <a key={id} href={href({ group: id })} aria-current={(selected?.group || group) === id ? 'location' : undefined}
            onClick={(event) => { if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) setSearch(''); follow(event, { group: id }); }}>
            <Icon size={18} aria-hidden="true" /> {label}
          </a>
        ))}
      </nav>
      {!selected && (
        <div className="settings-directory">
          {group && <a className="text-button settings-back" href={href({})} onClick={(event) => follow(event, {})}><ArrowLeft size={18} /> All settings</a>}
          <label className="settings-search">
            <Search size={20} aria-hidden="true" />
            <span className="sr-only">Search settings</span>
            <input type="search" value={search} placeholder="Search settings" onChange={(event) => setSearch(event.target.value)} />
          </label>
          {words.length > 0 && <p className="settings-search-status" role="status">{matches ? matches + (matches === 1 ? ' setting found' : ' settings found') : 'No settings match your search.'}</p>}
          {groups.map(({ id, label, description, icon: Icon }) => {
            const entries = sections.filter((item) => item.group === id && match(item));
            if (!entries.length) return null;
            return (
              <section className="settings-directory-group" key={id} aria-labelledby={'settings-group-' + id}>
                <header>
                  <div className="settings-group-icon"><Icon size={20} aria-hidden="true" /></div>
                  <div>
                    <h2 id={'settings-group-' + id}>{label}</h2>
                    <p>{description}</p>
                  </div>
                </header>
                <ul>
                  {entries.map((item) => (
                    <li key={item.id}>
                      <a href={href({ section: item.id })} onClick={(event) => follow(event, { section: item.id })}>
                        <span><strong>{item.label}</strong><small>{item.description}</small></span>
                        <ChevronRight size={18} aria-hidden="true" />
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

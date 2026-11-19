import { Fragment, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Activity, ArrowLeft, ArrowRight, Bookmark, BookOpenText, Building2, CalendarDays, CheckCircle2, ChevronRight, Circle, Filter, Layers, LockKeyhole, Search, Shuffle, X } from 'lucide-react';
import { problemResources, referenceProblemCount, sheetCompanies } from '../features/dsa-sheet.ts';
import type { DsaDifficulty, DsaPanel, DsaSheetEntry } from '../features/dsa-sheet-types.ts';
import { readStoredIds } from '../features/learning-tracks.ts';
import { DsaProblemDialog } from './DsaProblemDialog.tsx';
import { LearningDialog } from './LearningDialog.tsx';
import './dsa-practice-sheet.css';

const modes = [
  { id: 'company', label: 'Company Asked', icon: Building2 },
  { id: 'pattern', label: 'Pattern Based', icon: Layers },
  { id: 'frequency', label: 'Asked Frequency', icon: Activity },
] as const;
const difficulties = ['Easy', 'Medium', 'Hard'] as const;
const companies = [...sheetCompanies.global, ...sheetCompanies.indian].sort();
const pageSizes = ['all', '12', '24'] as const;
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const emptyFilters = { search: '', company: '', difficulty: '', topic: '', status: '', bookmarked: false };
type Filters = typeof emptyFilters;
type Mode = typeof modes[number]['id'];
type PageSize = typeof pageSizes[number];

function SheetProgress({ entries, completed, locked, onSignIn }: {
  entries: DsaSheetEntry[]; completed: Set<string>; locked: boolean; onSignIn: () => void;
}) {
  const count = entries.filter(entry => completed.has(entry.id)).length;
  function byDifficulty(difficulty: DsaDifficulty) {
    const matches = entries.filter(entry => entry.problem.difficulty === difficulty);
    return { total: matches.length, done: matches.filter(entry => completed.has(entry.id)).length };
  }

  return <section className="dsa-progress" aria-label="DSA sheet progress">
    <h3>Your Progress</h3>
    <div className="dsa-progress-main"><div><strong>{count}</strong> / {entries.length}</div>
      <progress aria-label="DSA problems solved" value={count} max={entries.length} /></div>
    <div className="dsa-progress-levels">{difficulties.map(difficulty => {
      const { done, total } = byDifficulty(difficulty);
      return <div key={difficulty} data-difficulty={difficulty}>
        <small>{difficulty}</small><span>{done} / {total}</span>
        <progress aria-label={difficulty + ' problems solved'} value={done} max={total || 1} />
      </div>;
    })}</div>
    {locked && <button className="dsa-text-button" type="button" onClick={onSignIn}>Sign in for all {entries.length} problems</button>}
  </section>;
}

function CompanyPlan({ companies, selected, counts, close, apply }: {
  companies: string[]; selected: string; counts: Map<string, number>; close: () => void; apply: (company: string, days: number) => void;
}) {
  const [company, setCompany] = useState(selected || 'Amazon');
  const [days, setDays] = useState(30);
  return <LearningDialog title="Build a company prep plan" close={close} className="dsa-practice-dialog">
    <div className="dsa-modal-content">
      <p>Choose a company and a timeline to focus your practice on its tagged problems.</p>
      <label className="dsa-field">Target company<select value={company} onChange={event => setCompany(event.target.value)}>
        {companies.map(name => <option key={name}>{name}</option>)}
      </select></label>
      <h3>How long do you have?</h3>
      <div className="dsa-plan-options" role="group" aria-label="Timeline in days">
        {[[30, 'Focused'], [90, 'Balanced'], [180, 'In-depth']].map(([value, title]) =>
          <button type="button" key={value} aria-pressed={days === value} onClick={() => setDays(Number(value))}>
            <strong>{value}</strong>{' days · '}{title}
          </button>)}
      </div>
      <p>{counts.get(company) ?? 0} curated problems for {company} over {days} days.</p>
    </div>
    <div className="dsa-modal-actions"><button className="button button-primary button-small" type="button" onClick={() => apply(company, days)}>
      Start prep plan<ArrowRight size={16} aria-hidden />
    </button></div>
  </LearningDialog>;
}

function PracticeTable({ rows, mode, solved, bookmarked, locked, dailyOrder, open, toggleSolved, toggleBookmark, company, topic, filterDifficulty }: {
  rows: DsaSheetEntry[]; mode: Mode; solved: Set<string>; bookmarked: Set<string>; locked: boolean; dailyOrder: number;
  open: (entry: DsaSheetEntry, panel: DsaPanel) => void; toggleSolved: (entry: DsaSheetEntry) => void;
  toggleBookmark: (entry: DsaSheetEntry) => void; company: (name: string) => void; topic: (name: string) => void;
  filterDifficulty: (difficulty: DsaDifficulty) => void;
}) {
  return <div className="dsa-table-wrap"><table aria-label="DSA practice problems">
    <thead><tr><th scope="col">Problem</th><th scope="col">Difficulty</th><th scope="col">{mode === 'frequency' ? 'Frequency' : 'Companies'}</th>
      <th scope="col">Topics</th><th scope="col">Resources</th></tr></thead>
    <tbody>{rows.map((entry, index) => {
      const { difficulty, order, companies, frequency } = entry.problem;
      const { leetCode, geeksForGeeks } = problemResources(entry);
      const done = solved.has(entry.id);
      const saved = bookmarked.has(entry.id);
      const daily = order === dailyOrder;
      const newTopic = mode === 'pattern' && entry.topic !== rows[index - 1]?.topic;
      return <Fragment key={entry.id}>
        {newTopic && <tr className="dsa-group-row"><th colSpan={5}>{entry.topic}</th></tr>}
        <tr data-featured={daily}>
        <th scope="row"><div className="dsa-problem-cell">
          <button type="button" className="dsa-icon dsa-status" data-on={done} aria-pressed={done}
            aria-label={(done ? 'Mark unsolved: ' : 'Mark solved: ') + entry.title} onClick={() => toggleSolved(entry)}>
            {locked ? <LockKeyhole size={14} aria-hidden /> : done ? <CheckCircle2 size={15} aria-hidden /> : <Circle size={15} aria-hidden />}
          </button>
          <button type="button" className="dsa-problem-title" onClick={() => open(entry, 'description')}>
            <span aria-hidden>{order}. </span>{entry.title}{daily && <small title="Problem of the day" aria-hidden>POTD</small>}
          </button>
        </div></th>
        <td><button type="button" className="dsa-difficulty" data-difficulty={difficulty} title={'Filter by ' + difficulty}
          onClick={() => filterDifficulty(difficulty)}>{difficulty}</button></td>
        <td className="dsa-table-company">{mode === 'frequency' ? <span className="dsa-frequency">
          {frequency === undefined ? '—' : frequency >= 70 ? '●●● High' : frequency >= 40 ? '●●○ Med' : '●○○ Low'}
        </span> : companies.length ? <button type="button" className="dsa-company-link" title={companies.join(', ')} onClick={() => company(companies[0])}>
          {companies[0]}<small> +{companies.length - 1}</small>
        </button> : '—'}</td>
        <td className="dsa-table-topic"><button type="button" className="dsa-topic" onClick={() => topic(entry.topic)}>{entry.topic}</button></td>
        <td><div className="dsa-resources">
          {leetCode && (locked
            ? <button type="button" className="dsa-resource-link" aria-label={'LeetCode resources for ' + entry.title} onClick={() => open(entry, 'resources')}>LC</button>
            : <a className="dsa-resource-link" aria-label={'LeetCode resources for ' + entry.title} href={leetCode} target="_blank" rel="noopener noreferrer">LC</a>)}
          {locked
            ? <button type="button" className="dsa-resource-link" aria-label={'GeeksforGeeks resources for ' + entry.title} onClick={() => open(entry, 'resources')}>GFG</button>
            : <a className="dsa-resource-link" aria-label={'GeeksforGeeks resources for ' + entry.title} href={geeksForGeeks} target="_blank" rel="noopener noreferrer">GFG</a>}
          <button type="button" className="dsa-icon" aria-label={'View approach for ' + entry.title} onClick={() => open(entry, 'approach')}><BookOpenText size={16} aria-hidden /></button>
          <button type="button" className="dsa-icon dsa-save" aria-pressed={saved} aria-label={(saved ? 'Remove bookmark: ' : 'Bookmark: ') + entry.title}
            onClick={() => toggleBookmark(entry)}><Bookmark size={16} aria-hidden /></button>
        </div></td>
        </tr>
      </Fragment>;
    })}</tbody>
  </table></div>;
}

export function DsaPracticeSheet({ entries, previewLimit, progressKey, completed, initial, initialPanel, boundary, onSignIn, onToggle, onReset }: {
  entries: DsaSheetEntry[]; previewLimit?: number; progressKey?: string; completed: string[]; initial?: DsaSheetEntry;
  initialPanel: DsaPanel; boundary?: ReactNode; onSignIn: (entry?: DsaSheetEntry, panel?: DsaPanel) => void;
  onToggle: (id: string) => void; onReset: () => void;
}) {
  const locked = !progressKey;
  const bookmarkKey = progressKey && progressKey + ':bookmarks';
  const [saved, setSaved] = useState(() => readStoredIds(bookmarkKey) ?? []);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [mode, setMode] = useState<Mode>('company');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [region, setRegion] = useState<keyof typeof sheetCompanies>('global');
  const [companySearch, setCompanySearch] = useState('');
  const [selected, setSelected] = useState<{ entry: DsaSheetEntry; panel: DsaPanel } | null>(() => initial ? { entry: initial, panel: initialPanel } : null);
  const [plan, setPlan] = useState<{ company: string; days: number } | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [dailyOrder] = useState(() => Math.floor(Date.now() / 86_400_000) % referenceProblemCount + 1);
  const problemInput = useRef<HTMLInputElement>(null);
  const companyInput = useRef<HTMLInputElement>(null);
  const filterId = useId();

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(''), 2500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if (event.key !== '/' || event.ctrlKey || event.altKey || event.metaKey) return;
      if (event.target instanceof HTMLElement && (event.target.isContentEditable || event.target.closest('input, select, textarea, dialog'))) return;
      if (document.querySelector('dialog[open]')) return;
      event.preventDefault();
      problemInput.current?.focus();
    }
    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, []);

  const solved = new Set(completed);
  const bookmarked = new Set(saved);
  const available = entries.slice(0, previewLimit ?? entries.length);
  const topics = Array.from(new Set(available.map(entry => entry.topic))).sort();
  const q = normalize(filters.search);
  const results = available.filter(entry => {
    const { companies, difficulty, order } = entry.problem;
    const haystack = normalize([entry.title, order, entry.topic, ...companies].join(' '));
    return (!q || haystack.includes(q)) && (!filters.company || companies.includes(filters.company)) &&
      (!filters.difficulty || filters.difficulty === difficulty) && (!filters.topic || filters.topic === entry.topic) &&
      (!filters.status || solved.has(entry.id) === (filters.status === 'solved')) && (!filters.bookmarked || bookmarked.has(entry.id));
  });
  if (mode === 'pattern') results.sort((a, b) => a.topic.localeCompare(b.topic) || a.problem.order - b.problem.order);
  if (mode === 'frequency') results.sort((a, b) => (b.problem.frequency ?? -1) - (a.problem.frequency ?? -1));
  const limit = pageSize === 'all' || locked ? undefined : Number(pageSize);
  const pageCount = limit ? Math.max(1, Math.ceil(results.length / limit)) : 1;
  const currentPage = Math.min(page, pageCount);
  const start = limit ? (currentPage - 1) * limit : 0;
  const shown = limit ? results.slice(start, start + limit) : results;
  const companyCounts = new Map<string, number>();
  for (const entry of entries) for (const name of entry.problem.companies) companyCounts.set(name, (companyCounts.get(name) ?? 0) + 1);
  const companyQuery = normalize(companySearch);
  const companyResults = companyQuery ? companies.filter(name => normalize(name).includes(companyQuery)) : sheetCompanies[region];

  function changeFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters(previous => ({ ...previous, [key]: value }));
    setPage(1);
    if (key === 'company' && value !== plan?.company) setPlan(null);
  }

  function clearFilters() {
    setFilters(emptyFilters);
    setPage(1);
    setPlan(null);
  }

  function open(entry: DsaSheetEntry, panel: DsaPanel) {
    if (locked) onSignIn(entry, panel);
    else setSelected({ entry, panel });
  }

  function toggleSolved(entry: DsaSheetEntry) {
    if (locked) onSignIn(entry);
    else onToggle(entry.id);
  }

  function toggleBookmark(entry: DsaSheetEntry) {
    if (!bookmarkKey) { onSignIn(entry); return; }
    const stored = readStoredIds(bookmarkKey) ?? saved;
    const next = bookmarked.has(entry.id) ? stored.filter(id => id !== entry.id) : [...new Set([...stored, entry.id])];
    setSaved(next);
    try { localStorage.setItem(bookmarkKey, JSON.stringify(next)); } catch { /* Keep bookmarks in this tab when storage is unavailable. */ }
    setNotice(bookmarked.has(entry.id) ? 'Bookmark removed' : 'Problem bookmarked');
  }

  function pickRandom() {
    const unsolved = results.filter(entry => !solved.has(entry.id));
    const pool = unsolved.length ? unsolved : results;
    const item = pool[Math.floor(Math.random() * pool.length)];
    if (item) open(item, 'description');
    else setNotice('No matching problems. Clear a filter to try again.');
  }

  function selectCompany(name: string) {
    changeFilter('company', filters.company === name ? '' : name);
  }

  return <div className="dsa-practice">
    <section className="dsa-practice-main" aria-label="DSA practice set">
      <div className="dsa-practice-hero">
        <div className="dsa-practice-intro"><h2>DSA Practice Sheet</h2>
          <p>Work through the {referenceProblemCount}-problem interview sheet by company or pattern, open solution resources, and track your progress.</p>
          <div className="dsa-modes" role="group" aria-label="Practice view">
            {modes.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={mode === id} onClick={() => { setMode(id); setPage(1); }}>
              <Icon size={15} aria-hidden />{label}
            </button>)}
          </div>
        </div>
        <SheetProgress entries={entries} completed={solved} locked={locked} onSignIn={onSignIn} />
      </div>
      <div className="dsa-toolbar">
        <label className="dsa-search"><Search size={15} aria-hidden /><input type="search" aria-label="Search problems" aria-keyshortcuts="/"
          placeholder="Search problems" ref={problemInput} value={filters.search} onChange={event => changeFilter('search', event.target.value)} /></label>
        <div className="dsa-toolbar-actions">
          <small>{locked ? results.length + ' of ' + entries.length + ' problems in preview' :
            results.length + (results.length === 1 ? ' problem' : ' problems')}</small>
          {!locked && <select className="dsa-page-size" aria-label="Problems per page" value={pageSize} onChange={event => {
            setPageSize(event.target.value as PageSize);
            setPage(1);
          }}>
            {pageSizes.map(size => <option key={size} value={size}>{size === 'all' ? 'Show all' : size + ' per page'}</option>)}
          </select>}
          <button type="button" className="dsa-icon dsa-company-jump" aria-label="Find companies" onClick={() => companyInput.current?.focus()}><Building2 size={15} aria-hidden /></button>
          <button type="button" className="dsa-icon" aria-label="Filter problems" aria-expanded={filterOpen} aria-controls={filterId}
            onClick={() => setFilterOpen(!filterOpen)}><Filter size={15} aria-hidden /></button>
          <button type="button" className="dsa-icon" aria-label="Pick a random problem" onClick={pickRandom}><Shuffle size={16} aria-hidden /></button>
          <button type="button" className="dsa-icon dsa-save" aria-label="Show bookmarked problems" aria-pressed={filters.bookmarked}
            onClick={() => locked ? onSignIn() : changeFilter('bookmarked', !filters.bookmarked)}><Bookmark size={16} aria-hidden /></button>
        </div>
      </div>
      <div className="dsa-filters" id={filterId} hidden={!filterOpen}>
        <label className="dsa-field">Company<select value={filters.company} onChange={event => changeFilter('company', event.target.value)}>
          <option value="">All companies</option>{companies.map(name => <option key={name}>{name}</option>)}
        </select></label>
        <label className="dsa-field">Difficulty<select value={filters.difficulty} onChange={event => changeFilter('difficulty', event.target.value)}>
          <option value="">All difficulties</option>{difficulties.map(value => <option key={value}>{value}</option>)}
        </select></label>
        <label className="dsa-field">Topic or pattern<select value={filters.topic} onChange={event => changeFilter('topic', event.target.value)}>
          <option value="">All topics</option>{topics.map(value => <option key={value}>{value}</option>)}
        </select></label>
        <label className="dsa-field">Status<select value={filters.status} onChange={event => changeFilter('status', event.target.value)}>
          <option value="">All problems</option><option value="unsolved">Not solved</option><option value="solved">Solved</option>
        </select></label>
        <button type="button" className="dsa-text-button" onClick={clearFilters}>Reset filters</button>
      </div>
      {(filters.company || filters.topic || filters.difficulty || filters.status || filters.bookmarked) && <div className="dsa-chips">
        {filters.company && <button type="button" onClick={() => changeFilter('company', '')}>{plan ? plan.days + '-day ' + plan.company + ' plan' : filters.company}<X size={12} aria-hidden /></button>}
        {filters.topic && <button type="button" onClick={() => changeFilter('topic', '')}>{filters.topic}<X size={12} aria-hidden /></button>}
        {filters.difficulty && <button type="button" onClick={() => changeFilter('difficulty', '')}>{filters.difficulty}<X size={12} aria-hidden /></button>}
        {filters.status && <button type="button" onClick={() => changeFilter('status', '')}>{filters.status === 'solved' ? 'Solved' : 'Not solved'}<X size={12} aria-hidden /></button>}
        {filters.bookmarked && <button type="button" onClick={() => changeFilter('bookmarked', false)}>Bookmarked<X size={12} aria-hidden /></button>}
      </div>}
      {filters.company && <p className="dsa-note">{results.length} matching problems tagged with {filters.company} in this sheet.</p>}
      {mode === 'pattern' && <p className="dsa-note">Problems grouped by topic. Choose a topic to focus your practice.</p>}
      {mode === 'frequency' && <p className="dsa-note">Frequency labels use the sample ranking supplied with the sheet.</p>}
      {results.length ? <>
        <PracticeTable rows={shown} mode={mode} locked={locked} solved={solved} bookmarked={bookmarked} dailyOrder={dailyOrder}
          open={open} toggleSolved={toggleSolved} toggleBookmark={toggleBookmark} company={selectCompany} topic={name => changeFilter('topic', name)}
          filterDifficulty={difficulty => changeFilter('difficulty', difficulty)} />
        <div className="dsa-table-footer">
          <span>{limit || locked ? 'Showing ' + (start + 1) + '–' + (start + shown.length) + ' of ' + (locked ? entries.length : results.length) :
            'Showing all ' + results.length + (results.length === 1 ? ' problem' : ' problems')}</span>
          {limit && <div className="dsa-pagination"><button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ArrowLeft size={13} />Previous</button>
            <span>{currentPage} / {pageCount}</span><button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next<ArrowRight size={13} /></button></div>}
        </div>
      </> : <div className="dsa-empty"><h3>No problems found</h3><p>Try another company, topic, or search term.</p>
        <button type="button" className="dsa-text-button" onClick={clearFilters}>Clear filters</button></div>}
      {boundary}
    </section>
    <aside className="dsa-practice-sidebar">
      <section className="dsa-company-plan">
        <div><span>Company Prep</span><h3>Practice company-specific questions</h3></div><Building2 size={44} aria-hidden />
        <p><Layers size={14} aria-hidden /> {referenceProblemCount} problems by pattern <CalendarDays size={14} aria-hidden /> 30 / 90 / 180 days</p>
        <button type="button" onClick={() => locked ? onSignIn() : setPlanOpen(true)}>Explore Company Prep<ChevronRight size={15} aria-hidden /></button>
      </section>
      <section className="dsa-company-panel" aria-label="Top Companies">
        <header><h3>Top Companies</h3><small>{companyCounts.size} tagged</small></header>
        <label className="dsa-search"><Search size={14} aria-hidden /><input type="search" aria-label="Search companies" placeholder="Search companies"
          ref={companyInput} value={companySearch} onChange={event => setCompanySearch(event.target.value)} /></label>
        <div className="dsa-region" role="group" aria-label="Company region">
          {(['global', 'indian'] as const).map(value => <button key={value} type="button" aria-pressed={region === value}
            onClick={() => { setRegion(value); setCompanySearch(''); }}>{value === 'global' ? 'Global' : 'Indian'}</button>)}
        </div>
        <div className="dsa-companies">
          <button type="button" aria-pressed={!filters.company} onClick={() => changeFilter('company', '')}>All<b>{entries.length}</b></button>
          {companyResults.map(name => <button key={name} type="button" aria-pressed={filters.company === name} onClick={() => selectCompany(name)}>
            {name}<b>{companyCounts.get(name) ?? 0}</b>
          </button>)}
          {companyResults.length === 0 && <p className="dsa-note">No matching companies.</p>}
        </div>
      </section>
      {!locked && <div className="dsa-reset-progress">
        <p>Your solved problems and bookmarks are saved in this browser.</p>
        <button type="button" className="dsa-text-button" onClick={() => setResetOpen(true)}>Reset practice progress</button>
      </div>}
    </aside>
    {selected && !locked && <DsaProblemDialog key={selected.entry.id + ':' + selected.panel} entry={selected.entry} initialPanel={selected.panel}
      done={solved.has(selected.entry.id)} saved={bookmarked.has(selected.entry.id)} companyCounts={companyCounts} close={() => setSelected(null)}
      toggleDone={() => toggleSolved(selected.entry)} toggleSaved={() => toggleBookmark(selected.entry)}
      related={entries.filter(entry => entry.topic === selected.entry.topic && entry.id !== selected.entry.id).slice(0, 6)}
      openRelated={entry => open(entry, 'description')}
      selectCompany={name => { changeFilter('company', name); setSelected(null); }} />}
    {planOpen && <CompanyPlan companies={companies} selected={filters.company} counts={companyCounts} close={() => setPlanOpen(false)}
      apply={(company, days) => {
        clearFilters();
        setFilters({ ...emptyFilters, company });
        setPlan({ company, days });
        setPlanOpen(false);
        setNotice(days + '-day ' + company + ' plan ready.');
      }} />}
    {resetOpen && <LearningDialog title="Reset practice progress?" close={() => setResetOpen(false)} className="dsa-practice-dialog">
      <p>Clear your solved sheet problems and bookmarks for this account on this browser?</p>
      <div className="dsa-modal-actions">
        <button type="button" className="button button-secondary button-small" onClick={() => setResetOpen(false)}>Cancel</button>
        <button type="button" className="button button-danger button-small" onClick={() => {
          onReset();
          setSaved([]);
          if (bookmarkKey) {
            try { localStorage.removeItem(bookmarkKey); } catch { /* Keep the updated state in this tab. */ }
          }
          setResetOpen(false);
          setNotice('Practice progress reset.');
        }}>Reset progress</button>
      </div>
    </LearningDialog>}
    {notice && <p className="dsa-toast" role="status">{notice}</p>}
  </div>;
}


import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Bookmark, Check } from 'lucide-react';
import type { LearningDetail } from '../../../shared/learning.ts';
import { problemResources } from '../features/dsa-sheet.ts';
import { referenceDetails, topicGuidance } from '../features/dsa-sheet-content.ts';
import type { DsaPanel, DsaSheetEntry } from '../features/dsa-sheet-types.ts';
import { api } from '../services/api.ts';
import { LearningDialog } from './LearningDialog.tsx';
import { ErrorNotice, Loading } from './ui.tsx';

const panels: { id: DsaPanel; label: string }[] = [
  { id: 'description', label: 'Description' }, { id: 'approach', label: 'Approach' },
  { id: 'companies', label: 'Companies' }, { id: 'resources', label: 'Resources' },
];

export function DsaProblemDialog({ entry, related, initialPanel, done, saved, companyCounts, close, toggleDone, toggleSaved, selectCompany, openRelated }: {
  entry: DsaSheetEntry; initialPanel: DsaPanel; done: boolean; saved: boolean; companyCounts: Map<string, number>;
  related: DsaSheetEntry[]; openRelated: (entry: DsaSheetEntry) => void;
  close: () => void; toggleDone: () => void; toggleSaved: () => void; selectCompany: (company: string) => void;
}) {
  const [panel, setPanel] = useState(initialPanel);
  const [copyMessage, setCopyMessage] = useState('');
  const { slug, difficulty, companies, original, gfgOnly } = entry.problem;
  const reference = slug ? referenceDetails[slug] : undefined;
  const showNotes = Boolean(original && !reference && (panel === 'description' || panel === 'approach'));
  const details = useQuery({
    queryKey: ['learning-detail', 'dsa', entry.id],
    queryFn: () => api<LearningDetail>('/learning/dsa/' + entry.id),
    enabled: showNotes,
    staleTime: 5 * 60_000,
  });
  const example = reference?.example ?? details.data?.notes.find(note => note.title === 'Example')?.text;
  const approach = reference?.approach ?? details.data?.notes.find(note => note.title === 'Approach')?.text ?? topicGuidance[entry.topic];
  const { leetCode, geeksForGeeks, video } = problemResources(entry);

  async function copySolution() {
    if (!reference) return;
    try {
      await navigator.clipboard.writeText(reference.code);
      setCopyMessage('Solution copied.');
    } catch {
      setCopyMessage('Select the code to copy it manually.');
    }
  }

  return <LearningDialog title={entry.title} close={close} className="dsa-practice-dialog">
    <div className="dsa-modal-meta"><span className="dsa-difficulty" data-difficulty={difficulty}>{difficulty}</span><span>{entry.topic}</span>
      {companies.length > 0 && <span>· {companies.length} company tags</span>}
    </div>
    <div className="dsa-modal-tabs" role="group" aria-label="Problem details">
      {panels.map(tab => <button key={tab.id} type="button" aria-pressed={panel === tab.id} onClick={() => setPanel(tab.id)}>{tab.label}</button>)}
    </div>
    <div className="dsa-modal-content">
      {showNotes && <>
        {details.isLoading && <Loading label="Loading problem notes…" />}
        <ErrorNotice error={details.error} retry={() => void details.refetch()} />
      </>}
      {panel === 'description' && <>
        <h3>Problem statement</h3><p>{reference?.description ?? details.data?.summary ?? entry.summary}</p>
        {example && <><h3>Example</h3><pre>{example}</pre></>}
        {reference && <><h3>Before you start</h3><p>Consider edge cases and analyze time and space complexity. Open the coding editor for the full constraints and tests.</p></>}
        {!example && leetCode && <><h3>Practice checklist</h3><ol>
          <li>Review the inputs, outputs, and constraints in the problem editor.</li>
          <li>Start with a brute-force solution.</li>
          <li>Identify the {entry.topic.toLowerCase()} technique that improves it.</li>
          <li>Test edge cases and explain the time and space complexity.</li>
        </ol></>}
      </>}
      {panel === 'approach' && <>
        <h3>{reference || details.data ? 'Approach' : 'Pattern guide: ' + entry.topic}</h3>
        <p>{approach ?? 'Describe the invariant your solution maintains and test the smallest valid input before coding.'}</p>
        {reference && <><div className="dsa-code-heading"><h3>Python solution</h3>
          <button type="button" className="button button-secondary button-small" onClick={() => void copySolution()}>Copy</button>
        </div><pre>{reference.code}</pre><p>{reference.complexity}</p>{copyMessage && <p role="status">{copyMessage}</p>}</>}
        {!reference && !details.data && <><h3>Try it yourself</h3>
          <p>Write down your state, invariant, and stopping condition before coding. The Resources tab links to walkthroughs and related problems.</p>
        </>}
        {details.data?.notes.filter(note => note.title !== 'Example' && note.title !== 'Approach').map(note =>
          <div key={note.title}><h3>{note.title}</h3><p>{note.text}</p></div>)}
      </>}
      {panel === 'companies' && <>
        <h3>Company tags</h3>
        {companies.length ? <div className="dsa-companies">
          {companies.map(company => <button key={company} type="button" onClick={() => selectCompany(company)}>
            {company}<b>{companyCounts.get(company) ?? 0}</b>
          </button>)}
        </div> : <p>This practice problem has no company tags.</p>}
        {companies.length > 0 && <p className="dsa-note">The supplied sheet uses sample company tags for practice.</p>}
      </>}
      {panel === 'resources' && <>
        <h3>Solve this problem</h3>
        <div className="dsa-resource-grid">
          {leetCode && <div><strong>LeetCode</strong><p>{gfgOnly ? 'Search for an equivalent coding problem.' : 'Open the statement, constraints, and coding editor.'}</p>
            <a className="button button-primary button-small" href={leetCode} target="_blank" rel="noopener noreferrer">
              {gfgOnly ? 'Search LeetCode' : 'Open LeetCode'}<ArrowUpRight size={14} aria-hidden />
            </a></div>}
          <div><strong>GeeksforGeeks</strong><p>Find practice problems and explanations.</p>
            <a className="button button-secondary button-small" href={geeksForGeeks} target="_blank" rel="noopener noreferrer">
              Open GFG<ArrowUpRight size={14} aria-hidden />
            </a></div>
          <div><strong>Video solutions</strong><p>Find walkthroughs for this problem on YouTube.</p>
            <a className="button button-secondary button-small" href={video} target="_blank" rel="noopener noreferrer">
              Watch solutions<ArrowUpRight size={14} aria-hidden />
            </a></div>
        </div>
        <h3>Related {entry.topic} problems</h3>
        {related.length ? <div className="dsa-companies">
          {related.map(problem => <button key={problem.id} type="button" onClick={() => openRelated(problem)}>
            <span aria-hidden>{problem.problem.order}.</span>{problem.title}
          </button>)}
        </div> : <p>There are no related problems in this topic.</p>}
      </>}
    </div>
    <div className="dsa-modal-actions">
      <button className="button button-secondary button-small" type="button" aria-pressed={saved} onClick={toggleSaved}>
        <Bookmark size={15} aria-hidden />{saved ? 'Bookmarked' : 'Bookmark'}
      </button>
      <button className="button button-secondary button-small" type="button" aria-pressed={done} onClick={toggleDone}>
        <Check size={15} aria-hidden />{done ? 'Solved' : 'Mark as solved'}
      </button>
      {leetCode && <a className="button button-primary button-small" href={leetCode} target="_blank" rel="noopener noreferrer">
        {gfgOnly ? 'Search on LeetCode' : 'Solve on LeetCode'}<ArrowUpRight size={15} aria-hidden />
      </a>}
    </div>
  </LearningDialog>;
}


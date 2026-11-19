import { randomUUID } from 'node:crypto';
import { fork } from 'node:child_process';
import { z } from 'zod';
import { maxUploadBytes, type List, type Resume, type RoleAnalysis } from '../../../shared/contracts.ts';
import type { SavedAnalysis, SavedResume, Store } from '../db/store.ts';
import { AppError, missing } from '../errors.ts';
import type { CoachingAI } from './ai/coaching.ts';

const skillAliases: Record<string, string[]> = {
  JavaScript: ['javascript', 'ecmascript'], TypeScript: ['typescript'], React: ['react', 'reactjs', 'react.js'],
  'Next.js': ['next.js', 'nextjs'], 'Node.js': ['node.js', 'nodejs'], Express: ['express.js', 'expressjs', 'express'],
  MongoDB: ['mongodb', 'mongoose'], SQL: ['sql'], PostgreSQL: ['postgresql', 'postgres'], MySQL: ['mysql'],
  Redis: ['redis'], Python: ['python'], Django: ['django'], Java: ['java'], Spring: ['spring boot', 'spring framework'],
  'C#': ['c#', 'asp.net'], '.NET': ['.net', 'dotnet'], 'C++': ['c++'], Rust: ['rust'], Go: ['golang', 'go programming'],
  HTML: ['html', 'html5'], CSS: ['css', 'css3'], Tailwind: ['tailwind', 'tailwindcss'],
  Testing: ['testing', 'vitest', 'jest', 'playwright', 'cypress'], Git: ['git', 'github'],
  Docker: ['docker', 'containers'], Kubernetes: ['kubernetes', 'k8s'], AWS: ['aws', 'amazon web services'],
  Azure: ['azure'], 'Google Cloud': ['gcp', 'google cloud'], 'CI/CD': ['ci/cd', 'github actions'],
  REST: ['rest', 'restful'], GraphQL: ['graphql'], Microservices: ['microservices'], WebSockets: ['websocket', 'websockets'],
  Accessibility: ['accessibility', 'wcag', 'a11y'], 'System design': ['system design', 'distributed systems'],
  Security: ['security', 'oauth', 'jwt', 'owasp'], 'Data structures': ['data structures', 'algorithms'],
  LangChain: ['langchain', 'langgraph'], 'Machine learning': ['machine learning', 'pytorch', 'tensorflow'],
};

export const skillList = z.array(z.string().trim().min(1).max(60)).max(35);
export const resumeEdit = z.object({ label: z.string().trim().min(2).max(90), skills: skillList }).strict();
export const analysisInput = z.object({
  title: z.string().trim().min(2).max(90),
  description: z.string().trim().min(20).max(8000),
  resumeId: z.uuid().optional(),
}).strict();

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function contains(text: string, term: string) {
  return new RegExp('(?:^|[^a-z0-9])' + escapeRegex(term) + '(?=$|[^a-z0-9])', 'i').test(text);
}

export function extractSkills(text: string) {
  return Object.entries(skillAliases)
    .filter(([, aliases]) => aliases.some(alias => contains(text, alias)))
    .map(([skill]) => skill).slice(0, 35);
}

export function localRoleAnalysis(description: string) {
  const sections = description.split(/\b(?:nice to have|preferred qualifications|preferred skills|bonus qualifications)\b/i);
  const required = extractSkills(sections[0] ?? '');
  const preferred = extractSkills(sections.slice(1).join('\n')).filter(skill => !required.includes(skill));
  return { required, preferred, topics: [...required, ...preferred].slice(0, 8) };
}

let activeParses = 0;

async function pdfText(file: Express.Multer.File | undefined) {
  if (!file) throw new AppError(400, 'FILE_REQUIRED', 'Choose a PDF resume.');
  if (file.size > maxUploadBytes) throw new AppError(413, 'FILE_TOO_LARGE', 'PDF resumes must be 4 MB or smaller.');
  if (file.mimetype !== 'application/pdf' || !/\.pdf$/i.test(file.originalname) || file.buffer.subarray(0, 5).toString() !== '%PDF-') {
    throw new AppError(415, 'INVALID_FILE', 'Only valid PDF resumes are supported.');
  }
  if (activeParses >= 2) throw new AppError(429, 'PARSER_BUSY', 'Resume processing is busy. Try again in a moment.');
  activeParses++;
  try {
    const fileName = import.meta.url.endsWith('.ts') ? 'pdf-worker.ts' : 'pdf-worker.js';
    const worker = fork(new URL(fileName, import.meta.url), [], {
      execArgv: ['--max-old-space-size=128'], serialization: 'advanced',
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      env: { SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP },
    });
    const result = await new Promise<{ text?: string; error?: string }>(resolve => {
      const timer = setTimeout(() => {
        worker.kill('SIGKILL');
        resolve({ error: 'This PDF took too long to process.' });
      }, 5000);
      const finish = (value: { text?: string; error?: string }) => {
        clearTimeout(timer);
        resolve(value);
      };
      worker.once('message', finish);
      worker.once('error', () => finish({ error: 'This PDF could not be read.' }));
      worker.once('exit', () => finish({ error: 'This PDF could not be read.' }));
      worker.send(file.buffer, error => {
        if (error) {
          worker.kill();
          finish({ error: 'This PDF could not be read.' });
        }
      });
    });
    if (result.error || !result.text || result.text.length < 20) {
      throw new AppError(422, 'INVALID_PDF', result.error ?? 'This PDF has no usable text. Upload a text-based PDF.');
    }
    return result.text;
  } finally {
    activeParses--;
  }
}

const exposedResume = ({ id, label, skills, createdAt }: SavedResume): Resume => ({ id, label, skills, createdAt });
const exposedAnalysis = ({ owner: _owner, sortKey: _key, ...data }: SavedAnalysis): RoleAnalysis => data;

export async function listLibrary<T extends { id: string; sortKey: string; owner: string }, R>(
  collection: { list(where: Partial<T>, options: { sort: keyof T & string; limit: number; before?: { field: keyof T & string; value: string } }): Promise<T[]> },
  owner: string, cursor: string | undefined, expose: (item: T) => R,
): Promise<List<R>> {
  const size = 12;
  const rows = await collection.list({ owner } as Partial<T>, {
    sort: 'sortKey', limit: size + 1, before: cursor ? { field: 'sortKey', value: cursor } : undefined,
  });
  return { items: rows.slice(0, size).map(expose), nextCursor: rows.length > size ? rows[size - 1]?.sortKey ?? null : null };
}

export function resumeService(store: Store, ai: CoachingAI) {
  return {
    list: (owner: string, cursor?: string) => listLibrary(store.resumes, owner, cursor, exposedResume),
    async get(owner: string, id: string) {
      const record = await store.resumes.get({ owner, id });
      return record ? exposedResume(record) : missing();
    },
    async upload(owner: string, file?: Express.Multer.File) {
      const text = await pdfText(file);
      const id = randomUUID();
      const createdAt = new Date().toISOString();
      const label = (file?.originalname ?? 'Resume').split(/[\\/]/).at(-1)?.replace(/\.pdf$/i, '').trim().slice(0, 90) || 'Resume';
      return exposedResume(await store.resumes.insert({
        id, owner, label, createdAt, sortKey: createdAt + '_' + id, skills: extractSkills(text),
      }));
    },
    async edit(owner: string, id: string, input: z.infer<typeof resumeEdit>) {
      const unique = new Map(input.skills.map(skill => [skill.toLowerCase(), skill]));
      const record = await store.resumes.update({ owner, id }, { label: input.label, skills: [...unique.values()] });
      return record ? exposedResume(record) : missing();
    },
    async remove(owner: string, id: string) {
      if (!await store.resumes.remove({ owner, id })) missing();
    },
    listAnalyses: (owner: string, cursor?: string) => listLibrary(store.analyses, owner, cursor, exposedAnalysis),
    async analysis(owner: string, id: string) {
      const record = await store.analyses.get({ owner, id });
      return record ? exposedAnalysis(record) : missing();
    },
    async analyze(owner: string, input: z.infer<typeof analysisInput>) {
      const resume = input.resumeId ? await store.resumes.get({ owner, id: input.resumeId }) : null;
      if (input.resumeId && !resume) missing();
      const description = input.description.replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/ig, '[email removed]')
        .replace(/https?:\/\/[^\s]+/ig, '[link removed]');
      const analysis = await ai.analyze(description, resume?.skills ?? []);
      const required = [...new Set(analysis.required)].filter(skill => contains(description, skill) || extractSkills(description).includes(skill));
      const preferred = [...new Set(analysis.preferred)].filter(skill => !required.includes(skill)
        && (contains(description, skill) || extractSkills(description).includes(skill)));
      const known = new Set(resume?.skills.map(skill => skill.toLowerCase()) ?? []);
      const hasSkill = (skill: string) => known.has(skill.toLowerCase()) || resume?.skills.some(item =>
        skillAliases[skill]?.some(alias => alias.toLowerCase() === item.toLowerCase()));
      const matches = [...required, ...preferred].filter(hasSkill);
      const gaps = required.filter(skill => !hasSkill(skill));
      const topics = [...new Set([...gaps, ...analysis.topics, ...matches])].slice(0, 8);
      const id = randomUUID();
      const createdAt = new Date().toISOString();
      return exposedAnalysis(await store.analyses.insert({
        id, owner, sortKey: createdAt + '_' + id, createdAt, title: input.title, resumeId: resume?.id ?? null,
        required, preferred, matches, gaps, topics,
      }));
    },
    async removeAnalysis(owner: string, id: string) {
      if (!await store.analyses.remove({ owner, id })) missing();
    },
  };
}

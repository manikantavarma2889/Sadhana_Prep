import { createConnection, Schema, type Model } from 'mongoose';
import type {
  AnswerFeedback, InterviewSettings, Provider, Question, ReportStatus, Resume, RoleAnalysis,
  Status, Turn, User,
} from '../../../shared/contracts.ts';

export type Account = User & {
  passwordHash: string | null; createdAt: string; googleSub?: string;
  credentialVersion?: string; resetHash?: string | null; resetExpiresAt?: number | null;
};
export type RefreshSession = {
  id: string; owner: string; tokenHash: string; oldHashes: string[]; expiresAt: Date; revoked: boolean;
  credentialVersion?: string;
};
export type SavedResume = Resume & { owner: string; sortKey: string };
export type SavedAnalysis = RoleAnalysis & { owner: string; sortKey: string };
export type PlanItem = Question & { criterion: string };
export type RecordedTurn = Turn & { criterion: string; planIndex: number };
export type Interview = InterviewSettings & {
  id: string;
  owner: string;
  createKey: string;
  createHash: string;
  sortKey: string;
  provider: Provider;
  model: string | null;
  rubric: string;
  role: string | null;
  topics: string[];
  status: Status;
  startedAt: string;
  deadlineAt: string;
  completedAt: string | null;
  revision: number;
  planIndex: number;
  plan: PlanItem[];
  question: PlanItem | null;
  turns: RecordedTurn[];
  submissions: { key: string; hash: string; revision: number }[];
  feedback: AnswerFeedback[];
  failedTurns: { turnId: string; attempts: number }[];
  reportStatus: ReportStatus;
  reportWake: number | null;
  reportLease: string | null;
  score: number | null;
};

type RecordId = { id: string };
type Query<T> = Partial<T>;
type Compare<T> = { field: keyof T & string; value: string | number; inclusive?: boolean };
type Find<T> = { sort?: keyof T & string; ascending?: boolean; limit?: number; before?: Compare<T> };
type Index = { fields: Record<string, 1 | -1>; unique?: boolean; sparse?: boolean; expireAfterSeconds?: number };

export class DuplicateRecord extends Error {}

export interface Collection<T extends RecordId> {
  get(where: Query<T>): Promise<T | null>;
  list(where: Query<T>, options?: Find<T>): Promise<T[]>;
  insert(record: T): Promise<T>;
  update(where: Query<T>, patch: Partial<T>): Promise<T | null>;
  remove(where: Query<T>): Promise<boolean>;
}

export type Store = {
  accounts: Collection<Account>;
  refresh: Collection<RefreshSession>;
  resumes: Collection<SavedResume>;
  analyses: Collection<SavedAnalysis>;
  interviews: Collection<Interview>;
  ready(): Promise<boolean>;
  close(): Promise<void>;
};

const idIndex: Index = { fields: { id: 1 }, unique: true };
const accountIndexes: Index[] = [idIndex, { fields: { email: 1 }, unique: true }, { fields: { googleSub: 1 }, unique: true, sparse: true }];
const refreshIndexes: Index[] = [idIndex, { fields: { expiresAt: 1 }, expireAfterSeconds: 0 }];
const libraryIndexes: Index[] = [idIndex, { fields: { owner: 1, sortKey: -1 } }];
const interviewIndexes: Index[] = [
  ...libraryIndexes,
  { fields: { owner: 1, createKey: 1 }, unique: true },
  { fields: { owner: 1, track: 1, difficulty: 1, provider: 1, model: 1, rubric: 1, reportStatus: 1, sortKey: -1 } },
  { fields: { provider: 1, model: 1, reportStatus: 1, reportWake: 1 } },
];

function memoryCollection<T extends RecordId>(indexes: Index[]): Collection<T> {
  const records = new Map<string, T>();
  function matches(record: T, where: Query<T>) {
    return Object.entries(where).every(([key, value]) => (record[key as keyof T] ?? null) === (value ?? null));
  }
  function compare(a: unknown, b: unknown) {
    if (a === b) return 0;
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return String(a) < String(b) ? -1 : 1;
  }
  const find = (where: Query<T>) => [...records.values()].find(record => matches(record, where));
  return {
    async get(where) {
      const record = find(where);
      return record ? structuredClone(record) : null;
    },
    async list(where, { sort, ascending = false, limit = 50, before } = {}) {
      const found = [...records.values()].filter(record => {
        if (!matches(record, where)) return false;
        if (!before) return true;
        const result = compare(record[before.field], before.value);
        return result < 0 || (before.inclusive && result === 0);
      });
      if (sort) found.sort((a, b) => compare(a[sort], b[sort]) * (ascending ? 1 : -1));
      return found.slice(0, limit).map(record => structuredClone(record));
    },
    async insert(record) {
      for (const index of indexes.filter(index => index.unique)) {
        const fields = Object.keys(index.fields) as (keyof T)[];
        if (index.sparse && fields.every(field => record[field] === undefined)) continue;
        const exists = [...records.values()].some(current =>
          fields.every(field => current[field] === record[field]));
        if (exists) throw new DuplicateRecord();
      }
      records.set(record.id, structuredClone(record));
      return structuredClone(record);
    },
    async update(where, patch) {
      const record = find(where);
      if (!record) return null;
      const next = { ...record, ...structuredClone(patch) };
      records.set(record.id, next);
      return structuredClone(next);
    },
    async remove(where) {
      const record = find(where);
      return record ? records.delete(record.id) : false;
    },
  };
}

export function memoryStore(): Store {
  return {
    accounts: memoryCollection(accountIndexes),
    refresh: memoryCollection(refreshIndexes),
    resumes: memoryCollection(libraryIndexes),
    analyses: memoryCollection(libraryIndexes),
    interviews: memoryCollection(interviewIndexes),
    async ready() { return true; },
    async close() {},
  };
}

function mongoCollection<T extends RecordId>(model: Model<Record<string, unknown>>): Collection<T> {
  const output = (record: unknown) => record as T;
  return {
    async get(where) {
      const record = await model.findOne(where).select('-_id').lean().exec();
      return record ? output(record) : null;
    },
    async list(where, { sort, ascending = false, limit = 50, before } = {}) {
      const filter = before ? { ...where, [before.field]: { [before.inclusive ? '$lte' : '$lt']: before.value } } : where;
      const query = model.find(filter).select('-_id').limit(limit);
      if (sort) query.sort({ [sort]: ascending ? 1 : -1 });
      return (await query.lean().exec()).map(output);
    },
    async insert(record) {
      try {
        await model.create(record);
        return record;
      } catch (error) {
        if (typeof error === 'object' && error && 'code' in error && error.code === 11000) throw new DuplicateRecord();
        throw error;
      }
    },
    async update(where, patch) {
      const record = await model.findOneAndUpdate(where, { $set: patch }, { returnDocument: 'after' })
        .select('-_id').lean().exec();
      return record ? output(record) : null;
    },
    async remove(where) {
      return (await model.deleteOne(where).exec()).deletedCount === 1;
    },
  };
}

export async function connectStore(uri: string): Promise<Store> {
  const connection = createConnection(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 20 });
  try {
    await connection.asPromise();
    function collection<T extends RecordId>(name: string, definition: Record<string, unknown>, indexes: Index[]) {
      const schema = new Schema<Record<string, unknown>>({ id: { type: String, required: true }, ...definition }, {
        id: false, versionKey: false, bufferCommands: false,
      });
      for (const { fields, ...options } of indexes) schema.index(fields, options);
      return { model: connection.model<Record<string, unknown>>(name, schema, name), wrap: mongoCollection<T> };
    }
    const accounts = collection<Account>('users', {
      email: String, name: String, role: String, passwordHash: String, createdAt: String, voiceEnabled: Boolean,
      googleSub: String, credentialVersion: String, resetHash: String, resetExpiresAt: Number,
    }, accountIndexes);
    const refresh = collection<RefreshSession>('refresh_sessions', {
      owner: String, tokenHash: String, oldHashes: [String], revoked: Boolean, expiresAt: Date,
      credentialVersion: String,
    }, refreshIndexes);
    const resumes = collection<SavedResume>('resumes', {
      owner: String, sortKey: String, label: String, skills: [String], createdAt: String,
    }, libraryIndexes);
    const analyses = collection<SavedAnalysis>('role_analyses', {
      owner: String, sortKey: String, title: String, resumeId: String, createdAt: String,
      required: [String], preferred: [String], matches: [String], gaps: [String], topics: [String],
    }, libraryIndexes);
    const mixed = Schema.Types.Mixed;
    const interviews = collection<Interview>('interview_sessions', {
      owner: String, createKey: String, createHash: String, sortKey: String, track: String, difficulty: String,
      minutes: Number, analysisId: String, role: String, topics: [String], provider: String, model: String, rubric: String,
      status: String, startedAt: String, deadlineAt: String, completedAt: String, revision: Number,
      planIndex: Number, plan: [mixed], question: mixed, turns: [mixed], submissions: [mixed], feedback: [mixed],
      failedTurns: [mixed], reportStatus: String, reportLease: String, reportWake: Number, score: Number,
    }, interviewIndexes);
    await Promise.all([accounts, refresh, resumes, analyses, interviews].map(({ model }) => model.init()));
    return {
      accounts: accounts.wrap(accounts.model), refresh: refresh.wrap(refresh.model),
      resumes: resumes.wrap(resumes.model), analyses: analyses.wrap(analyses.model),
      interviews: interviews.wrap(interviews.model),
      async ready() { return connection.readyState === 1; },
      async close() { await connection.close(); },
    };
  } catch (error) {
    await connection.close();
    throw error;
  }
}

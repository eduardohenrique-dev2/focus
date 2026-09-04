import type { SupabaseClient, User, Session } from "@supabase/supabase-js";
import type { Database } from "./types";

type LocalRow = Record<string, unknown>;
type LocalDatabase = Record<string, LocalRow[]>;
type FilterFn = (row: LocalRow) => boolean;
type AuthListener = (event: string, session: Session | null) => void;

const DB_KEY = "focus.local.db.v1";
const USER_KEY = "focus.local.auth.user.v1";
const SIGNED_OUT_KEY = "focus.local.auth.signed-out.v1";
const LOCAL_USER_ID = "00000000-0000-4000-8000-000000000001";

let memoryDb: LocalDatabase = {};
let memoryUser: User | null = null;
let memorySignedOut = false;
const authListeners = new Set<AuthListener>();

function hasBrowserStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function uuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function readJson<T>(key: string, fallback: T): T {
  if (!hasBrowserStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (!hasBrowserStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function readDb(): LocalDatabase {
  if (!hasBrowserStorage()) return memoryDb;
  return readJson<LocalDatabase>(DB_KEY, {});
}

function writeDb(db: LocalDatabase) {
  memoryDb = db;
  writeJson(DB_KEY, db);
}

function makeDefaultUser(email = "local@focus.app", fullName = "Usuário local"): User {
  const created = nowIso();
  return {
    id: LOCAL_USER_ID,
    app_metadata: { provider: "local", providers: ["local"] },
    user_metadata: { full_name: fullName, name: fullName },
    aud: "authenticated",
    created_at: created,
    email,
    role: "authenticated",
    updated_at: created,
  } as User;
}

function readSignedOut() {
  if (!hasBrowserStorage()) return memorySignedOut;
  return window.localStorage.getItem(SIGNED_OUT_KEY) === "1";
}

function writeSignedOut(value: boolean) {
  memorySignedOut = value;
  if (hasBrowserStorage()) window.localStorage.setItem(SIGNED_OUT_KEY, value ? "1" : "0");
}

function readUser(): User | null {
  if (readSignedOut()) return null;
  if (!hasBrowserStorage()) {
    memoryUser ??= makeDefaultUser();
    return memoryUser;
  }

  const stored = readJson<User | null>(USER_KEY, null);
  if (stored) return stored;

  const user = makeDefaultUser();
  writeJson(USER_KEY, user);
  return user;
}

function writeUser(user: User | null) {
  memoryUser = user;
  if (hasBrowserStorage()) {
    if (user) writeJson(USER_KEY, user);
    else window.localStorage.removeItem(USER_KEY);
  }
}

function makeSession(user: User | null): Session | null {
  if (!user) return null;
  return {
    access_token: "focus-local-access-token",
    refresh_token: "focus-local-refresh-token",
    expires_in: 60 * 60 * 24 * 365,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
    token_type: "bearer",
    user,
  } as Session;
}

function emitAuth(event: string, session: Session | null) {
  authListeners.forEach((listener) => listener(event, session));
}

const tableDefaults: Record<string, () => LocalRow> = {
  tasks: () => ({ status: "todo", priority: "medium", order_index: 0, due_date: null, completed_at: null, description: null }),
  notes: () => ({ title: "Sem título", content: "", is_pinned: false }),
  projects: () => ({ status: "active", color: null, description: null }),
  project_columns: () => ({ order_index: 0 }),
  project_cards: () => ({ description: null, order_index: 0 }),
  habits: () => ({ frequency: "daily", target_count: 1, is_active: true, color: null }),
  habit_logs: () => ({ count: 1 }),
  goals: () => ({ status: "active", progress: 0, target_value: 100, current_value: 0 }),
  calendar_events: () => ({ all_day: false, color: null, description: null, location: null }),
  reminders: () => ({ is_done: false, message: null }),
  notifications: () => ({ is_read: false }),
  finance_accounts: () => ({ balance: 0, currency: "BRL", type: "checking" }),
  finance_transactions: () => ({ occurred_at: nowIso(), category: null, account_id: null, type: "expense" }),
  study_subjects: () => ({ color: null, description: null }),
  study_sessions: () => ({ duration_minutes: 25, completed_at: null }),
  flashcards: () => ({ interval_days: 0, ease_factor: 2.5, repetitions: 0, next_review_at: nowIso() }),
  profiles: () => ({ full_name: "Usuário local", avatar_url: null, preferred_ai_model: null }),
};

function normalizeRow(table: string, input: LocalRow): LocalRow {
  const stamp = nowIso();
  return {
    ...(tableDefaults[table]?.() ?? {}),
    id: typeof input.id === "string" ? input.id : uuid(),
    created_at: input.created_at ?? stamp,
    updated_at: input.updated_at ?? stamp,
    ...input,
  };
}

function compareValue(left: unknown, right: unknown) {
  if (left === right) return 0;
  if (left == null) return -1;
  if (right == null) return 1;
  const leftNumber = typeof left === "number" ? left : Number.NaN;
  const rightNumber = typeof right === "number" ? right : Number.NaN;
  if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber)) return leftNumber - rightNumber;
  return String(left).localeCompare(String(right));
}

function matchLike(value: unknown, pattern: unknown, insensitive = false) {
  const source = String(value ?? "");
  const target = String(pattern ?? "");
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replaceAll("%", ".*").replaceAll("_", ".");
  const regex = new RegExp(`^${escaped}$`, insensitive ? "i" : undefined);
  return regex.test(source);
}

class LocalQueryBuilder {
  private operation: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private payload: LocalRow | LocalRow[] | null = null;
  private filters: FilterFn[] = [];
  private orders: { column: string; ascending: boolean }[] = [];
  private maxRows: number | null = null;
  private rangeValue: [number, number] | null = null;
  private singleValue = false;
  private maybeSingleValue = false;
  private returnRows = false;
  private countRequested = false;

  constructor(private readonly table: string) {}

  select(_columns = "*", options?: { count?: string; head?: boolean }) {
    if (this.operation === "select") this.operation = "select";
    else this.returnRows = true;
    this.countRequested = Boolean(options?.count);
    return this;
  }

  insert(values: LocalRow | LocalRow[]) {
    this.operation = "insert";
    this.payload = values;
    return this;
  }

  update(values: LocalRow) {
    this.operation = "update";
    this.payload = values;
    return this;
  }

  delete() {
    this.operation = "delete";
    return this;
  }

  upsert(values: LocalRow | LocalRow[]) {
    this.operation = "upsert";
    this.payload = values;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push((row) => row[column] !== value);
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  gt(column: string, value: unknown) {
    this.filters.push((row) => compareValue(row[column], value) > 0);
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters.push((row) => compareValue(row[column], value) >= 0);
    return this;
  }

  lt(column: string, value: unknown) {
    this.filters.push((row) => compareValue(row[column], value) < 0);
    return this;
  }

  lte(column: string, value: unknown) {
    this.filters.push((row) => compareValue(row[column], value) <= 0);
    return this;
  }

  like(column: string, value: unknown) {
    this.filters.push((row) => matchLike(row[column], value));
    return this;
  }

  ilike(column: string, value: unknown) {
    this.filters.push((row) => matchLike(row[column], value, true));
    return this;
  }

  contains(column: string, value: unknown) {
    this.filters.push((row) => {
      const current = row[column];
      if (Array.isArray(current) && Array.isArray(value)) return value.every((item) => current.includes(item));
      if (current && value && typeof current === "object" && typeof value === "object") {
        return Object.entries(value as LocalRow).every(([key, item]) => (current as LocalRow)[key] === item);
      }
      return false;
    });
    return this;
  }

  match(values: LocalRow) {
    Object.entries(values).forEach(([column, value]) => this.eq(column, value));
    return this;
  }

  not(column: string, operator: string, value: unknown) {
    if (operator === "eq") return this.neq(column, value);
    if (operator === "is") {
      this.filters.push((row) => row[column] !== value);
      return this;
    }
    if (operator === "in" && Array.isArray(value)) {
      this.filters.push((row) => !value.includes(row[column]));
      return this;
    }
    return this;
  }

  or(expression: string) {
    const clauses = expression.split(",").map((part) => part.trim()).filter(Boolean);
    this.filters.push((row) => clauses.some((clause) => {
      const [column, operator, ...rest] = clause.split(".");
      const raw = rest.join(".");
      if (operator === "eq") return String(row[column]) === raw;
      if (operator === "neq") return String(row[column]) !== raw;
      if (operator === "is") return raw === "null" ? row[column] == null : String(row[column]) === raw;
      if (operator === "ilike") return matchLike(row[column], raw, true);
      if (operator === "like") return matchLike(row[column], raw);
      return false;
    }));
    return this;
  }

  filter(column: string, operator: string, value: unknown) {
    if (operator === "eq") return this.eq(column, value);
    if (operator === "neq") return this.neq(column, value);
    if (operator === "gt") return this.gt(column, value);
    if (operator === "gte") return this.gte(column, value);
    if (operator === "lt") return this.lt(column, value);
    if (operator === "lte") return this.lte(column, value);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orders.push({ column, ascending: options?.ascending ?? true });
    return this;
  }

  limit(count: number) {
    this.maxRows = count;
    return this;
  }

  range(from: number, to: number) {
    this.rangeValue = [from, to];
    return this;
  }

  single() {
    this.singleValue = true;
    return this;
  }

  maybeSingle() {
    this.maybeSingleValue = true;
    return this;
  }

  throwOnError() {
    return this;
  }

  abortSignal(_signal: AbortSignal) {
    return this;
  }

  returns() {
    return this;
  }

  private matches(row: LocalRow) {
    return this.filters.every((filter) => filter(row));
  }

  private sortRows(rows: LocalRow[]) {
    if (!this.orders.length) return rows;
    return [...rows].sort((a, b) => {
      for (const order of this.orders) {
        const result = compareValue(a[order.column], b[order.column]);
        if (result !== 0) return order.ascending ? result : -result;
      }
      return 0;
    });
  }

  private trimRows(rows: LocalRow[]) {
    let result = this.sortRows(rows);
    if (this.rangeValue) result = result.slice(this.rangeValue[0], this.rangeValue[1] + 1);
    if (this.maxRows != null) result = result.slice(0, this.maxRows);
    return result;
  }

  private shape(rows: LocalRow[], count?: number) {
    const data = this.singleValue || this.maybeSingleValue ? (rows[0] ?? null) : rows;
    return { data, error: null, count: this.countRequested ? (count ?? rows.length) : null, status: 200, statusText: "OK" };
  }

  private async execute() {
    const db = readDb();
    const current = db[this.table] ?? [];

    if (this.operation === "select") {
      const matched = current.filter((row) => this.matches(row));
      return this.shape(this.trimRows(matched), matched.length);
    }

    if (this.operation === "insert") {
      const inputs = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}];
      const inserted = inputs.map((row) => normalizeRow(this.table, row));
      db[this.table] = [...current, ...inserted];
      writeDb(db);
      return this.shape(this.returnRows ? inserted : []);
    }

    if (this.operation === "update") {
      const updated: LocalRow[] = [];
      db[this.table] = current.map((row) => {
        if (!this.matches(row)) return row;
        const next = { ...row, ...(this.payload as LocalRow), updated_at: nowIso() };
        updated.push(next);
        return next;
      });
      writeDb(db);
      return this.shape(this.returnRows ? updated : []);
    }

    if (this.operation === "delete") {
      const removed = current.filter((row) => this.matches(row));
      db[this.table] = current.filter((row) => !this.matches(row));
      if (this.table === "projects") {
        const ids = new Set(removed.map((row) => row.id));
        db.project_columns = (db.project_columns ?? []).filter((row) => !ids.has(row.project_id));
        db.project_cards = (db.project_cards ?? []).filter((row) => !ids.has(row.project_id));
      }
      if (this.table === "project_columns") {
        const ids = new Set(removed.map((row) => row.id));
        db.project_cards = (db.project_cards ?? []).filter((row) => !ids.has(row.column_id));
      }
      writeDb(db);
      return this.shape(this.returnRows ? removed : []);
    }

    const inputs = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}];
    const changed: LocalRow[] = [];
    const nextRows = [...current];
    for (const input of inputs) {
      const index = typeof input.id === "string" ? nextRows.findIndex((row) => row.id === input.id) : -1;
      if (index >= 0) {
        const next = { ...nextRows[index], ...input, updated_at: nowIso() };
        nextRows[index] = next;
        changed.push(next);
      } else {
        const next = normalizeRow(this.table, input);
        nextRows.push(next);
        changed.push(next);
      }
    }
    db[this.table] = nextRows;
    writeDb(db);
    return this.shape(this.returnRows ? changed : []);
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }
}

function createChannel(name: string) {
  const channel = {
    topic: name,
    on: () => channel,
    subscribe: () => channel,
    unsubscribe: async () => "ok",
  };
  return channel;
}

export function createLocalClient(): SupabaseClient<Database> {
  const auth = {
    getSession: async () => ({ data: { session: makeSession(readUser()) }, error: null }),
    getUser: async () => ({ data: { user: readUser() }, error: null }),
    onAuthStateChange: (callback: AuthListener) => {
      authListeners.add(callback);
      const session = makeSession(readUser());
      if (typeof queueMicrotask === "function") queueMicrotask(() => callback("INITIAL_SESSION", session));
      return { data: { subscription: { unsubscribe: () => authListeners.delete(callback) } } };
    },
    signInWithPassword: async ({ email }: { email: string; password: string }) => {
      const current = readJson<User | null>(USER_KEY, null);
      const fullName = String(current?.user_metadata?.full_name ?? email.split("@")[0] ?? "Usuário local");
      const user = { ...(current ?? makeDefaultUser(email, fullName)), email, updated_at: nowIso() } as User;
      writeUser(user);
      writeSignedOut(false);
      const session = makeSession(user);
      emitAuth("SIGNED_IN", session);
      return { data: { user, session }, error: null };
    },
    signUp: async ({ email, options }: { email: string; password: string; options?: { data?: Record<string, unknown> } }) => {
      const fullName = String(options?.data?.full_name ?? email.split("@")[0] ?? "Usuário local");
      const user = makeDefaultUser(email, fullName);
      writeUser(user);
      writeSignedOut(false);
      const session = makeSession(user);
      emitAuth("SIGNED_IN", session);
      return { data: { user, session }, error: null };
    },
    signOut: async () => {
      writeSignedOut(true);
      emitAuth("SIGNED_OUT", null);
      return { error: null };
    },
    resetPasswordForEmail: async () => ({ data: {}, error: null }),
    updateUser: async (attributes: { email?: string; password?: string; data?: Record<string, unknown> }) => {
      const current = readUser() ?? makeDefaultUser();
      const user = {
        ...current,
        ...(attributes.email ? { email: attributes.email } : {}),
        user_metadata: { ...current.user_metadata, ...(attributes.data ?? {}) },
        updated_at: nowIso(),
      } as User;
      writeUser(user);
      writeSignedOut(false);
      const session = makeSession(user);
      emitAuth("USER_UPDATED", session);
      return { data: { user }, error: null };
    },
  };

  const client = {
    auth,
    from: (table: string) => new LocalQueryBuilder(table),
    channel: (name: string) => createChannel(name),
    removeChannel: async () => "ok",
    removeAllChannels: async () => [],
    getChannels: () => [],
    rpc: async () => ({ data: null, error: null }),
    functions: {
      invoke: async () => ({ data: null, error: { message: "Funções remotas não estão disponíveis no modo local." } }),
    },
  };

  return client as unknown as SupabaseClient<Database>;
}

export function clearLocalDatabase() {
  memoryDb = {};
  if (hasBrowserStorage()) window.localStorage.removeItem(DB_KEY);
}

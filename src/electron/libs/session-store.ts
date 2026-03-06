import initSqlJs, { Database as SqlJsDatabase } from "sql.js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import type { SessionStatus, StreamMessage } from "../types.js";

export type PendingPermission = {
  toolUseId: string;
  toolName: string;
  input: unknown;
  resolve: (result: { behavior: "allow" | "deny"; updatedInput?: unknown; message?: string }) => void;
};

export type Session = {
  id: string;
  title: string;
  claudeSessionId?: string;
  status: SessionStatus;
  cwd?: string;
  allowedTools?: string;
  lastPrompt?: string;
  pendingPermissions: Map<string, PendingPermission>;
  abortController?: AbortController;
};

export type StoredSession = {
  id: string;
  title: string;
  status: SessionStatus;
  cwd?: string;
  allowedTools?: string;
  lastPrompt?: string;
  claudeSessionId?: string;
  createdAt: number;
  updatedAt: number;
};

export type SessionHistory = {
  session: StoredSession;
  messages: StreamMessage[];
};

import { createRequire } from "module";
const require = createRequire(import.meta.url);

// Singleton SQL.js instance
let SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null;

async function initSqlJsOnce(): Promise<Awaited<ReturnType<typeof initSqlJs>>> {
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: (file: string) => {
        // In Electron, we need to locate the wasm file
        // It should be in node_modules/sql.js/dist/
        try {
          return require.resolve(`sql.js/dist/${file}`);
        } catch {
          // Fallback for different module resolution
          return `${require.resolve('sql.js').replace(/\/[^/]*$/, '')}/${file}`;
        }
      }
    });
  }
  return SQL;
}

export class SessionStore {
  private sessions = new Map<string, Session>();
  private db: SqlJsDatabase | null = null;
  private dbPath: string;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    // Start initialization asynchronously
    this.initPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;
    
    const SQL = await initSqlJsOnce();
    
    // Load existing database or create new one
    if (existsSync(this.dbPath)) {
      const fileBuffer = readFileSync(this.dbPath);
      this.db = new SQL.Database(fileBuffer);
    } else {
      this.db = new SQL.Database();
    }
    
    // Create tables
    this.db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT,
        claude_session_id TEXT,
        status TEXT NOT NULL,
        cwd TEXT,
        allowed_tools TEXT,
        last_prompt TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      )
    `);
    this.db.run(`CREATE INDEX IF NOT EXISTS messages_session_id ON messages(session_id)`);
    
    this.saveDb();
    this.loadSessions();
    this.initialized = true;
  }

  private saveDb(): void {
    if (!this.db) return;
    const data = this.db.export();
    const buffer = Buffer.from(data);
    
    // Ensure directory exists
    const dir = dirname(this.dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    
    writeFileSync(this.dbPath, buffer);
  }

  private ensureReady(): void {
    if (!this.initialized || !this.db) {
      throw new Error("SessionStore not initialized. Call await sessionStore.ready() first.");
    }
  }

  async ready(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  createSession(options: { cwd?: string; allowedTools?: string; prompt?: string; title: string }): Session {
    this.ensureReady();
    const id = crypto.randomUUID();
    const now = Date.now();
    const session: Session = {
      id,
      title: options.title,
      status: "idle",
      cwd: options.cwd,
      allowedTools: options.allowedTools,
      lastPrompt: options.prompt,
      pendingPermissions: new Map()
    };
    this.sessions.set(id, session);
    
    this.db!.run(
      `INSERT INTO sessions (id, title, claude_session_id, status, cwd, allowed_tools, last_prompt, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        session.title,
        session.claudeSessionId ?? null,
        session.status,
        session.cwd ?? null,
        session.allowedTools ?? null,
        session.lastPrompt ?? null,
        now,
        now
      ]
    );
    this.saveDb();
    
    return session;
  }

  getSession(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  listSessions(): StoredSession[] {
    this.ensureReady();
    const rows = this.executeQuery(
      `SELECT id, title, claude_session_id, status, cwd, allowed_tools, last_prompt, created_at, updated_at
       FROM sessions
       ORDER BY updated_at DESC`
    );
    return rows.map((row) => ({
      id: String(row.id),
      title: String(row.title),
      status: row.status as SessionStatus,
      cwd: row.cwd ? String(row.cwd) : undefined,
      allowedTools: row.allowed_tools ? String(row.allowed_tools) : undefined,
      lastPrompt: row.last_prompt ? String(row.last_prompt) : undefined,
      claudeSessionId: row.claude_session_id ? String(row.claude_session_id) : undefined,
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at)
    }));
  }

  listRecentCwds(limit = 8): string[] {
    this.ensureReady();
    const rows = this.executeQuery(
      `SELECT cwd, MAX(updated_at) as latest
       FROM sessions
       WHERE cwd IS NOT NULL AND TRIM(cwd) != ''
       GROUP BY cwd
       ORDER BY latest DESC
       LIMIT ?`,
      [limit]
    );
    return rows.map((row) => String(row.cwd));
  }

  getSessionHistory(id: string): SessionHistory | null {
    this.ensureReady();
    const sessionRows = this.executeQuery(
      `SELECT id, title, claude_session_id, status, cwd, allowed_tools, last_prompt, created_at, updated_at
       FROM sessions
       WHERE id = ?`,
      [id]
    );
    
    if (sessionRows.length === 0) return null;
    
    const sessionRow = sessionRows[0];
    
    const messageRows = this.executeQuery(
      `SELECT data FROM messages WHERE session_id = ? ORDER BY created_at ASC`,
      [id]
    );
    const messages = messageRows.map((row) => JSON.parse(String(row.data)) as StreamMessage);

    return {
      session: {
        id: String(sessionRow.id),
        title: String(sessionRow.title),
        status: sessionRow.status as SessionStatus,
        cwd: sessionRow.cwd ? String(sessionRow.cwd) : undefined,
        allowedTools: sessionRow.allowed_tools ? String(sessionRow.allowed_tools) : undefined,
        lastPrompt: sessionRow.last_prompt ? String(sessionRow.last_prompt) : undefined,
        claudeSessionId: sessionRow.claude_session_id ? String(sessionRow.claude_session_id) : undefined,
        createdAt: Number(sessionRow.created_at),
        updatedAt: Number(sessionRow.updated_at)
      },
      messages
    };
  }

  updateSession(id: string, updates: Partial<Session>): Session | undefined {
    this.ensureReady();
    const session = this.sessions.get(id);
    if (!session) return undefined;
    Object.assign(session, updates);
    this.persistSession(id, updates);
    return session;
  }

  setAbortController(id: string, controller: AbortController | undefined): void {
    const session = this.sessions.get(id);
    if (!session) return;
    session.abortController = controller;
  }

  recordMessage(sessionId: string, message: StreamMessage): void {
    this.ensureReady();
    const id = ('uuid' in message && message.uuid) ? String(message.uuid) : crypto.randomUUID();
    this.db!.run(
      `INSERT OR IGNORE INTO messages (id, session_id, data, created_at) VALUES (?, ?, ?, ?)`,
      [id, sessionId, JSON.stringify(message), Date.now()]
    );
    this.saveDb();
  }

  deleteSession(id: string): boolean {
    this.ensureReady();
    const existing = this.sessions.get(id);
    if (existing) {
      this.sessions.delete(id);
    }
    this.db!.run(`DELETE FROM messages WHERE session_id = ?`, [id]);
    this.db!.run(`DELETE FROM sessions WHERE id = ?`, [id]);
    this.saveDb();
    return Boolean(existing);
  }

  private persistSession(id: string, updates: Partial<Session>): void {
    const fields: string[] = [];
    const values: Array<string | number | null> = [];
    const updatable = {
      claudeSessionId: "claude_session_id",
      status: "status",
      cwd: "cwd",
      allowedTools: "allowed_tools",
      lastPrompt: "last_prompt"
    } as const;

    for (const key of Object.keys(updates) as Array<keyof typeof updatable>) {
      const column = updatable[key];
      if (!column) continue;
      fields.push(`${column} = ?`);
      const value = updates[key];
      values.push(value === undefined ? null : (value as string));
    }

    if (fields.length === 0) return;
    fields.push("updated_at = ?");
    values.push(Date.now());
    values.push(id);
    
    this.db!.run(`UPDATE sessions SET ${fields.join(", ")} WHERE id = ?`, values);
    this.saveDb();
  }

  private loadSessions(): void {
    const rows = this.executeQuery(
      `SELECT id, title, claude_session_id, status, cwd, allowed_tools, last_prompt
       FROM sessions`
    );
    for (const row of rows) {
      const session: Session = {
        id: String(row.id),
        title: String(row.title),
        claudeSessionId: row.claude_session_id ? String(row.claude_session_id) : undefined,
        status: row.status as SessionStatus,
        cwd: row.cwd ? String(row.cwd) : undefined,
        allowedTools: row.allowed_tools ? String(row.allowed_tools) : undefined,
        lastPrompt: row.last_prompt ? String(row.last_prompt) : undefined,
        pendingPermissions: new Map()
      };
      this.sessions.set(session.id, session);
    }
  }

  private executeQuery(sql: string, params: (string | number | null)[] = []): Record<string, unknown>[] {
    if (!this.db) return [];
    
    const stmt = this.db.prepare(sql);
    if (params.length > 0) {
      stmt.bind(params);
    }
    
    const results: Record<string, unknown>[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push(row);
    }
    stmt.free();
    
    return results;
  }

  close(): void {
    if (this.db) {
      this.saveDb();
      this.db.close();
      this.db = null;
    }
  }
}
// A stand-in for Cloudflare D1 built on Node's built-in SQLite, used only for local testing.
import { DatabaseSync } from "node:sqlite";

class Stmt {
  constructor(db, sql, args = []) { this.db = db; this.sql = sql; this.args = args; }
  bind(...args) { return new Stmt(this.db, this.sql, args); }
  _p() { return this.db.prepare(this.sql); }
  _args() { return this.args.map((a) => (a === undefined ? null : typeof a === "boolean" ? (a ? 1 : 0) : a)); }
  _named() {
    // D1 uses ?1, ?2 … ; node:sqlite accepts these as anonymous positional when passed as an array of values.
    return this._args();
  }
  _run() {
    const s = this._p();
    const a = this._named();
    if (/\breturning\b/i.test(this.sql) || /^\s*select/i.test(this.sql)) return { rows: s.all(...a) };
    const r = s.run(...a);
    return { rows: [], meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
  }
  async first(col) { const { rows } = this._run(); const r = rows[0] ? { ...rows[0] } : null; return col ? r?.[col] ?? null : r; }
  async all() { const { rows } = this._run(); return { results: rows.map((r) => ({ ...r })), success: true }; }
  async run() { const r = this._run(); return { success: true, meta: r.meta || { changes: r.rows.length } }; }
}
export function makeD1(file = ":memory:") {
  const db = new DatabaseSync(file);
  return {
    prepare: (sql) => new Stmt(db, sql),
    async batch(stmts) {
      db.exec("BEGIN");
      try { const out = []; for (const s of stmts) out.push(await s.all()); db.exec("COMMIT"); return out; }
      catch (e) { db.exec("ROLLBACK"); throw e; }
    },
    raw: db,
  };
}

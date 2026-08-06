"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = exports.query = void 0;
const sqlite3_1 = __importDefault(require("sqlite3"));
const path_1 = __importDefault(require("path"));
/**
 * Where the SQLite file lives.
 *
 * `DB_PATH` should point at a mounted persistent disk in production. Without
 * one, most hosts hand the process an ephemeral filesystem that is wiped on
 * every deploy and restart — the API keeps answering, but every saved board
 * silently disappears. Falls back to the repo copy for local development.
 */
const dbPath = process.env.DB_PATH ||
    (process.env.VERCEL
        ? path_1.default.join('/tmp', 'syncsketch.db')
        : path_1.default.resolve(__dirname, '../syncsketch.db'));
const db = new sqlite3_1.default.Database(dbPath, (err) => {
    if (err) {
        console.error('Database connection failed:', err);
    }
    else {
        console.log('Connected to SQLite database at:', dbPath);
    }
});
// Initialize Schema
db.serialize(() => {
    // 1. Boards Library Table
    db.run(`
    CREATE TABLE IF NOT EXISTS boards (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      favorite INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
    // 2. Elements Table (Saves elements dynamically)
    db.run(`
    CREATE TABLE IF NOT EXISTS board_elements (
      id TEXT NOT NULL,
      board_id TEXT NOT NULL,
      data TEXT NOT NULL,
      PRIMARY KEY (id, board_id),
      FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
    )
  `);
    // 3. Version Snapshots Table
    db.run(`
    CREATE TABLE IF NOT EXISTS board_versions (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL,
      name TEXT NOT NULL,
      data TEXT NOT NULL,
      is_autosave INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
    )
  `);
});
// Helper wrapper for DB queries
const query = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err)
                reject(err);
            else
                resolve(rows);
        });
    });
};
exports.query = query;
const run = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err)
                reject(err);
            else
                resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
};
exports.run = run;
exports.default = db;

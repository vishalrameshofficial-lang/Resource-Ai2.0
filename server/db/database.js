import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeDatabase } from './schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolved DB file path
const isVercel = !!process.env.VERCEL;
const defaultDbPath = isVercel ? '/tmp/resourceai.db' : './server/data/resourceai.db';
const rawDbPath = process.env.DATABASE_PATH || defaultDbPath;
const dbPath = path.isAbsolute(rawDbPath) 
  ? rawDbPath 
  : path.resolve(process.cwd(), rawDbPath);

// Ensure directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// In Vercel serverless, copy pre-seeded database if /tmp database does not exist
if (isVercel && !fs.existsSync(dbPath)) {
  const seedCandidates = [
    path.resolve(process.cwd(), 'server/data/resourceai.db'),
    path.resolve(__dirname, '../data/resourceai.db')
  ];
  for (const candidate of seedCandidates) {
    if (fs.existsSync(candidate)) {
      try {
        fs.copyFileSync(candidate, dbPath);
        console.log(`[DB] Copied seeded database from ${candidate} to ${dbPath}`);
        break;
      } catch (e) {
        console.warn('[DB] Failed to copy seed DB:', e.message);
      }
    }
  }
}

let dbInstance = null;

export function getDatabase() {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(dbPath);
    // Enable WAL mode for high concurrency & foreign keys
    try {
      dbInstance.exec('PRAGMA journal_mode = WAL;');
      dbInstance.exec('PRAGMA foreign_keys = ON;');
    } catch (err) {
      console.warn('[DB] Warning setting PRAGMA:', err.message);
    }
    console.log(`[DB] Connected to native node:sqlite database at: ${dbPath}`);
    try {
      initializeDatabase();
    } catch (err) {
      console.warn('[DB] Auto-initialize database warning:', err.message);
    }
  }
  return dbInstance;
}

export function closeDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    console.log('[DB] Database connection closed.');
  }
}

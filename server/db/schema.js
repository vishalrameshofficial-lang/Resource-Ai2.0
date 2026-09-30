import { getDatabase } from './database.js';
import bcrypt from 'bcryptjs';

export function initializeDatabase() {
  const db = getDatabase();

  console.log('[DB] Initializing database schema...');

  // 1. Emergency Requests Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS emergency_requests (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      request_id TEXT UNIQUE NOT NULL,
      caller_name TEXT,
      caller_phone TEXT NOT NULL,
      caller_language TEXT NOT NULL,
      emergency_category TEXT NOT NULL,
      description TEXT NOT NULL,
      location TEXT NOT NULL,
      landmark TEXT,
      latitude REAL,
      longitude REAL,
      affected_people_count INTEGER NOT NULL DEFAULT 1,
      resources_needed TEXT NOT NULL,
      urgency TEXT NOT NULL,
      immediate_danger INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'NEW',
      admin_notes TEXT,
      government_reference TEXT,
      created_from_call_id TEXT
    );
  `);

  // 2. Call Sessions Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS call_sessions (
      id TEXT PRIMARY KEY,
      call_sid TEXT,
      stream_sid TEXT,
      caller_phone TEXT,
      exotel_number TEXT,
      started_at TEXT,
      ended_at TEXT,
      language TEXT,
      transcript TEXT,
      recording_url TEXT,
      ai_summary TEXT,
      status TEXT,
      request_id TEXT,
      metadata TEXT,
      query TEXT,
      summary TEXT,
      department TEXT,
      required_service TEXT,
      required_resources TEXT,
      priority TEXT,
      location TEXT,
      affected_people TEXT,
      classification_confidence REAL,
      classification_status TEXT,
      telephony_source_ip TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Migrate call_sessions table if columns are missing in existing databases
  try {
    const tableInfo = db.prepare(`PRAGMA table_info(call_sessions)`).all();
    const existingColumns = new Set(tableInfo.map(col => col.name));

    const columnsToAdd = [
      { name: 'recording_url', type: 'TEXT' },
      { name: 'query', type: 'TEXT' },
      { name: 'summary', type: 'TEXT' },
      { name: 'department', type: 'TEXT' },
      { name: 'required_service', type: 'TEXT' },
      { name: 'required_resources', type: 'TEXT' },
      { name: 'priority', type: 'TEXT' },
      { name: 'location', type: 'TEXT' },
      { name: 'affected_people', type: 'TEXT' },
      { name: 'classification_confidence', type: 'REAL' },
      { name: 'classification_status', type: 'TEXT' },
      { name: 'telephony_source_ip', type: 'TEXT' }
    ];

    for (const col of columnsToAdd) {
      if (!existingColumns.has(col.name)) {
        db.exec(`ALTER TABLE call_sessions ADD COLUMN ${col.name} ${col.type}`);
        console.log(`[DB] Added column ${col.name} to call_sessions`);
      }
    }
  } catch (err) {
    console.warn('[DB] Migration error for call_sessions columns:', err.message);
  }

  // 3. Dispatch Timeline Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS dispatch_timeline (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      status TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      actor TEXT NOT NULL,
      government_reference TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // 4. Admin Users Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'OPERATOR',
      created_at TEXT NOT NULL
    );
  `);

  // Create helpful indexes for performance
  try {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_requests_status ON emergency_requests(status);
      CREATE INDEX IF NOT EXISTS idx_requests_created ON emergency_requests(created_at);
      CREATE INDEX IF NOT EXISTS idx_requests_urgency ON emergency_requests(urgency);
      CREATE INDEX IF NOT EXISTS idx_calls_sid ON call_sessions(call_sid);
      CREATE INDEX IF NOT EXISTS idx_calls_dept ON call_sessions(department);
      CREATE INDEX IF NOT EXISTS idx_calls_priority ON call_sessions(priority);
      CREATE INDEX IF NOT EXISTS idx_timeline_request ON dispatch_timeline(request_id);
    `);
  } catch (err) {
    console.warn('[DB] Index creation warning:', err.message);
  }

  // Pre-seed default administrative users if not existing
  seedDefaultUsers(db);

  // Purge any fake, test, or sample records to ensure 100% real live calls only
  try {
    db.exec(`
      DELETE FROM dispatch_timeline WHERE 
        request_id LIKE 'REQ-2026-890%' OR 
        request_id NOT IN (SELECT request_id FROM emergency_requests WHERE caller_phone NOT IN ('+919876543210', '+919944332211', '+919988776655'));
      DELETE FROM emergency_requests WHERE 
        id LIKE 'req-sample-%' OR 
        request_id LIKE 'REQ-2026-890%' OR 
        caller_phone IN ('+919876543210', '+919944332211', '+919988776655');
      DELETE FROM call_sessions WHERE 
        id LIKE 'test_%' OR 
        id LIKE 'call-sample-%' OR 
        call_sid LIKE 'test_%' OR 
        call_sid LIKE 'exo_test_%' OR 
        call_sid LIKE 'exo_an_%' OR 
        call_sid LIKE 'exo_patch_%' OR 
        call_sid LIKE 'exo_call_%' OR 
        caller_phone IN ('+919876543210', '+919944332211', '+919988776655');
    `);
  } catch (err) {
    console.warn('[DB] Fake/Sample records cleanup warning:', err.message);
  }

  console.log('[DB] Schema initialization complete. Real-time calls only mode active.');
}

function seedDefaultUsers(db) {
  const checkUserStmt = db.prepare('SELECT id FROM users WHERE email = ?');
  const existingAdmin = checkUserStmt.get('admin@resourceai.org');

  if (!existingAdmin) {
    const salt = bcrypt.genSaltSync(10);
    const adminHash = bcrypt.hashSync('admin123', salt);
    const operatorHash = bcrypt.hashSync('operator123', salt);
    const viewerHash = bcrypt.hashSync('viewer123', salt);
    const now = new Date().toISOString();

    const insertUser = db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertUser.run('usr-admin-01', 'admin@resourceai.org', adminHash, 'Emergency Commander', 'ADMIN', now);
    insertUser.run('usr-oper-01', 'operator@resourceai.org', operatorHash, 'Relief Dispatch Operator', 'OPERATOR', now);
    insertUser.run('usr-view-01', 'viewer@resourceai.org', viewerHash, 'Relief Monitor', 'VIEWER', now);
    console.log('[DB] Seeded default users: admin@resourceai.org, operator@resourceai.org, viewer@resourceai.org');
  }
}


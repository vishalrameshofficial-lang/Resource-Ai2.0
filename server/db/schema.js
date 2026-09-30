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

  // Purge any legacy sample/demo records from database to ensure production clean state
  try {
    db.exec(`
      DELETE FROM emergency_requests WHERE id LIKE 'req-sample-%';
      DELETE FROM call_sessions WHERE id LIKE 'call-sample-%' OR call_sid = 'exo_call_10928301';
      DELETE FROM dispatch_timeline WHERE id LIKE 'time-%' AND request_id LIKE 'REQ-2026-890%';
    `);
  } catch (err) {
    console.warn('[DB] Sample cleanup warning:', err.message);
  }

  console.log('[DB] Schema initialization complete.');
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

function seedSampleEmergenciesIfEmpty(db) {
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM emergency_requests');
  const res = countStmt.get();
  if (res && res.count === 0) {
    console.log('[DB] Seeding realistic sample emergency requests for dashboard initial demo...');
    const now = new Date();

    const samples = [
      {
        id: 'req-sample-01',
        request_id: 'REQ-2026-8901',
        caller_name: 'Muthu Kumar',
        caller_phone: '+919876543210',
        caller_language: 'Tamil',
        emergency_category: 'flood',
        description: 'Thamirabarani river overflow entered residential areas. Ground floor submerged. 35 people stranded on 1st floor terraces.',
        location: 'Kurukkuthoorai, Tirunelveli',
        landmark: 'Near Murugan Temple Ghat',
        latitude: 8.7274,
        longitude: 77.7275,
        affected_people_count: 35,
        resources_needed: JSON.stringify([
          { item: 'Inflatable Rescue Boat', quantity: 2, unit: 'boats' },
          { item: 'Drinking Water', quantity: 100, unit: 'litres' },
          { item: 'Dry Rations', quantity: 35, unit: 'packets' }
        ]),
        urgency: 'HIGH',
        immediate_danger: 1,
        source: 'AI VOICE',
        status: 'VERIFIED',
        admin_notes: 'Relief squad alerted. Water level currently stable but access roads flooded.',
        government_reference: 'TN-SDRF-2026-4421',
        created_from_call_id: 'call-sample-01',
        created_at: new Date(now.getTime() - 25 * 60000).toISOString(),
        updated_at: new Date(now.getTime() - 15 * 60000).toISOString()
      },
      {
        id: 'req-sample-02',
        request_id: 'REQ-2026-8902',
        caller_name: 'Pooja Sharma',
        caller_phone: '+919845012345',
        caller_language: 'Hindi',
        emergency_category: 'landslide',
        description: 'Debris blockage on bypass road trapping 4 passenger vehicles with elderly passengers.',
        location: 'Kullu-Manali Highway Km 18',
        landmark: 'Near Beas bridge toll plaza',
        latitude: 31.9579,
        longitude: 77.1095,
        affected_people_count: 14,
        resources_needed: JSON.stringify([
          { item: 'Earth Moving JCB', quantity: 1, unit: 'vehicles' },
          { item: 'Medical First Aid Kit', quantity: 4, unit: 'kits' },
          { item: 'Thermal Blankets', quantity: 20, unit: 'blankets' }
        ]),
        urgency: 'HIGH',
        immediate_danger: 0,
        source: 'AI VOICE',
        status: 'FORWARDED_TO_GOVERNMENT',
        admin_notes: 'Forwarded to District Disaster Management Authority (DDMA). JCB dispatched from control depot.',
        government_reference: 'HP-DDMA-KLL-789',
        created_from_call_id: 'call-sample-02',
        created_at: new Date(now.getTime() - 45 * 60000).toISOString(),
        updated_at: new Date(now.getTime() - 10 * 60000).toISOString()
      },
      {
        id: 'req-sample-03',
        request_id: 'REQ-2026-8903',
        caller_name: 'Ananya Roy',
        caller_phone: '+919711223344',
        caller_language: 'Bengali',
        emergency_category: 'cyclone',
        description: 'Roof blown off community shelter in coastal ward. Power line snapped nearby sparking.',
        location: 'Digha Coastal Ward 4',
        landmark: 'Behind Old Lighthouse',
        latitude: 21.6266,
        longitude: 87.5074,
        affected_people_count: 50,
        resources_needed: JSON.stringify([
          { item: 'Tarpaulin Sheets', quantity: 20, unit: 'sheets' },
          { item: 'Emergency Lighting', quantity: 6, unit: 'units' },
          { item: 'Cooked Meals', quantity: 60, unit: 'packets' }
        ]),
        urgency: 'MEDIUM',
        immediate_danger: 1,
        source: 'WEB',
        status: 'NEW',
        admin_notes: null,
        government_reference: null,
        created_from_call_id: null,
        created_at: new Date(now.getTime() - 10 * 60000).toISOString(),
        updated_at: new Date(now.getTime() - 10 * 60000).toISOString()
      },
      {
        id: 'req-sample-04',
        request_id: 'REQ-2026-8904',
        caller_name: 'Kavitha Rao',
        caller_phone: '+919900112233',
        caller_language: 'Telugu',
        emergency_category: 'medical',
        description: 'Pregnant woman in labor unable to cross inundated drainage canal. Needs urgent medical extraction.',
        location: 'Bhimavaram Rural Sector 2',
        landmark: 'Opposite Primary Health Center',
        latitude: 16.5449,
        longitude: 81.5212,
        affected_people_count: 2,
        resources_needed: JSON.stringify([
          { item: 'Ambulance / High-Clearance Vehicle', quantity: 1, unit: 'vehicles' },
          { item: 'Paramedic Team', quantity: 1, unit: 'teams' }
        ]),
        urgency: 'CRITICAL',
        immediate_danger: 1,
        source: 'AI VOICE',
        status: 'RESOURCE_ALLOCATED',
        admin_notes: '108 Ambulance Unit 42 dispatched with midwife.',
        government_reference: 'AP-108-DISP-902',
        created_from_call_id: 'call-sample-04',
        created_at: new Date(now.getTime() - 55 * 60000).toISOString(),
        updated_at: new Date(now.getTime() - 5 * 60000).toISOString()
      },
      {
        id: 'req-sample-05',
        request_id: 'REQ-2026-8905',
        caller_name: 'David Gomez',
        caller_phone: '+919810987654',
        caller_language: 'English',
        emergency_category: 'building_collapse',
        description: 'Old godown wall collapsed during heavy rain. 3 workers rescued, relief kits delivered.',
        location: 'Fort Kochi Mattancherry',
        landmark: 'Spice Market Road',
        latitude: 9.9577,
        longitude: 76.2421,
        affected_people_count: 6,
        resources_needed: JSON.stringify([
          { item: 'First Aid', quantity: 3, unit: 'kits' },
          { item: 'Temporary Shelter Kits', quantity: 2, unit: 'kits' }
        ]),
        urgency: 'HIGH',
        immediate_danger: 0,
        source: 'AI VOICE',
        status: 'DELIVERED',
        admin_notes: 'Action completed by local Fire and Rescue team. All 6 individuals stabilized.',
        government_reference: 'KL-FRS-KCH-112',
        created_from_call_id: 'call-sample-05',
        created_at: new Date(now.getTime() - 180 * 60000).toISOString(),
        updated_at: new Date(now.getTime() - 30 * 60000).toISOString()
      }
    ];

    const insertReq = db.prepare(`
      INSERT INTO emergency_requests (
        id, created_at, updated_at, request_id, caller_name, caller_phone,
        caller_language, emergency_category, description, location, landmark,
        latitude, longitude, affected_people_count, resources_needed, urgency,
        immediate_danger, source, status, admin_notes, government_reference, created_from_call_id
      ) VALUES (
        @id, @created_at, @updated_at, @request_id, @caller_name, @caller_phone,
        @caller_language, @emergency_category, @description, @location, @landmark,
        @latitude, @longitude, @affected_people_count, @resources_needed, @urgency,
        @immediate_danger, @source, @status, @admin_notes, @government_reference, @created_from_call_id
      )
    `);

    for (const s of samples) {
      insertReq.run(s);
    }

    // Also seed sample calls
    const insertCall = db.prepare(`
      INSERT INTO call_sessions (
        id, call_sid, stream_sid, caller_phone, exotel_number, started_at, ended_at,
        language, transcript, ai_summary, status, request_id, metadata,
        query, summary, department, required_service, required_resources,
        priority, location, affected_people, classification_confidence,
        classification_status, telephony_source_ip, created_at
      ) VALUES (
        @id, @call_sid, @stream_sid, @caller_phone, @exotel_number, @started_at, @ended_at,
        @language, @transcript, @ai_summary, @status, @request_id, @metadata,
        @query, @summary, @department, @required_service, @required_resources,
        @priority, @location, @affected_people, @classification_confidence,
        @classification_status, @telephony_source_ip, @created_at
      )
    `);

    insertCall.run({
      id: 'call-sample-01',
      call_sid: 'exo_call_10928301',
      stream_sid: 'exo_str_9981203',
      caller_phone: '+919876543210',
      exotel_number: '+918047359000',
      started_at: new Date(now.getTime() - 28 * 60000).toISOString(),
      ended_at: new Date(now.getTime() - 25 * 60000).toISOString(),
      language: 'Tamil',
      transcript: JSON.stringify([
        { role: 'assistant', text: 'வணக்கம், இது ResourceAI அவசர உதவி மையம். உங்கள் அவசர நிலையைப் பதிவு செய்ய நான் உதவுகிறேன். என்ன நடந்தது என்று கூறுங்கள்.' },
        { role: 'caller', text: 'திருநெல்வேலி அருகே எங்கள் பகுதியில் வெள்ளப்பெருக்கு ஏற்பட்டுள்ளது. உணவு மற்றும் குடிநீர் தேவை.' },
        { role: 'assistant', text: 'மிகவும் வருந்துகிறோம். நீங்கள் இருக்கும் பகுதி அல்லது அருகிலுள்ள அடையாளத்தைக் கூற முடியுமா?' },
        { role: 'caller', text: 'குறுக்குத்துறை முருகன் கோவில் படித்துறை அருகே, 35 பேர் மாடியில் தவித்துக் கொண்டுள்ளோம்.' },
        { role: 'assistant', text: 'உங்கள் கோரிக்கையை உறுதிப்படுத்துகிறேன். குறுக்குத்துறை அருகே 35 பேர், படகு, உணவு மற்றும் குடிநீர் தேவை. சரியா?' },
        { role: 'caller', text: 'ஆம், மிக அவசரம்.' },
        { role: 'assistant', text: 'நன்றி. உங்கள் அவசர கோரிக்கை பதிவு செய்யப்பட்டுள்ளது. உங்கள் கோரிக்கை எண் REQ-2026-8901.' }
      ]),
      ai_summary: 'Flood in Kurukkuthoorai, Tirunelveli. 35 people stranded on terrace. Needs 2 rescue boats, 100L water, food. Immediate danger high.',
      status: 'COMPLETED',
      request_id: 'REQ-2026-8901',
      metadata: JSON.stringify({ durationSec: 184, confidence: 0.98, exotelFlow: 'agentstream_voicebot_v1' }),
      query: 'திருநெல்வேலி அருகே எங்கள் பகுதியில் வெள்ளப்பெருக்கு ஏற்பட்டுள்ளது. குறுக்குத்துறை முருகன் கோவில் படித்துறை அருகே, 35 பேர் மாடியில் தவித்துக் கொண்டுள்ளோம்.',
      summary: 'Severe flood in Kurukkuthoorai, Tirunelveli. 35 people stranded requiring rescue boats, drinking water and food.',
      department: 'Disaster Management',
      required_service: 'Flood Extraction & Rescue',
      required_resources: JSON.stringify(['Rescue Boat', 'Drinking Water', 'Food Supplies']),
      priority: 'Critical',
      location: 'Kurukkuthoorai, Tirunelveli',
      affected_people: '35',
      classification_confidence: 0.98,
      classification_status: 'completed',
      telephony_source_ip: 'Not available',
      created_at: new Date(now.getTime() - 28 * 60000).toISOString()
    });

    // Seed sample dispatch timeline for sample 1
    const insertTimeline = db.prepare(`
      INSERT INTO dispatch_timeline (id, request_id, status, title, description, actor, government_reference, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertTimeline.run(
      'time-01',
      'REQ-2026-8901',
      'NEW',
      'Emergency Request Recorded',
      'Recorded automatically via Exotel AI Voice Agent in Tamil',
      'AI VOICE',
      null,
      new Date(now.getTime() - 25 * 60000).toISOString()
    );
    insertTimeline.run(
      'time-02',
      'REQ-2026-8901',
      'VERIFIED',
      'Request Verified by Relief Officer',
      'Emergency verified with local flood monitoring station. Priority escalated.',
      'ADMIN',
      'TN-SDRF-2026-4421',
      new Date(now.getTime() - 15 * 60000).toISOString()
    );
  }
}

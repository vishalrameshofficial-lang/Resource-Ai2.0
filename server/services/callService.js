import { getDatabase } from '../db/database.js';
import { conversationRegistry } from '../ai/conversationManager.js';

function parseCallRow(r) {
  if (!r) return null;
  let parsedResources = [];
  try {
    if (r.required_resources) {
      parsedResources = typeof r.required_resources === 'string'
        ? JSON.parse(r.required_resources)
        : r.required_resources;
    }
  } catch (err) {
    if (typeof r.required_resources === 'string' && r.required_resources.trim()) {
      parsedResources = r.required_resources.split(',').map(s => s.trim()).filter(Boolean);
    }
  }

  return {
    ...r,
    transcript: r.transcript ? JSON.parse(r.transcript) : [],
    metadata: r.metadata ? JSON.parse(r.metadata) : {},
    recording_url: r.recording_url || null,
    required_resources: Array.isArray(parsedResources) ? parsedResources : [],
    telephony_source_ip: r.telephony_source_ip || 'Not available'
  };
}

export class CallService {
  getAllCalls(filters = {}) {
    const db = getDatabase();
    let query = 'SELECT * FROM call_sessions WHERE 1=1';
    const params = [];

    if (filters.department && filters.department !== 'ALL') {
      query += ' AND department = ?';
      params.push(filters.department);
    }
    if (filters.priority && filters.priority !== 'ALL') {
      query += ' AND priority = ?';
      params.push(filters.priority);
    }
    if (filters.language && filters.language !== 'ALL') {
      query += ' AND language = ?';
      params.push(filters.language);
    }
    if (filters.status && filters.status !== 'ALL') {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.location && filters.location !== 'ALL') {
      query += ' AND location LIKE ?';
      params.push(`%${filters.location}%`);
    }

    query += ' ORDER BY created_at DESC';
    const rows = db.prepare(query).all(...params);
    return rows.map(parseCallRow);
  }

  getActiveLiveCalls() {
    return conversationRegistry.getAllActiveSessions();
  }

  getCallById(idOrSid) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM call_sessions WHERE id = ? OR call_sid = ? OR stream_sid = ?');
    const r = stmt.get(idOrSid, idOrSid, idOrSid);
    return parseCallRow(r);
  }

  saveCallSession(session) {
    const db = getDatabase();
    const now = new Date().toISOString();

    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO call_sessions (
        id, call_sid, stream_sid, caller_phone, exotel_number,
        started_at, ended_at, language, transcript, recording_url, ai_summary,
        status, request_id, metadata,
        query, summary, department, required_service, required_resources,
        priority, location, affected_people, classification_confidence,
        classification_status, telephony_source_ip, created_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?
      )
    `);

    // Extract resources as serialized JSON array
    let resourcesJson = '[]';
    const resources = session.required_resources || session.requiredResources || session.metadata?.classification?.required_resources;
    if (Array.isArray(resources)) {
      resourcesJson = JSON.stringify(resources);
    } else if (typeof resources === 'string') {
      resourcesJson = resources.startsWith('[') ? resources : JSON.stringify([resources]);
    }

    const sourceIp = session.telephony_source_ip || session.telephonySourceIp || session.metadata?.telephony_source_ip || 'Not available';

    insertStmt.run(
      session.id,
      session.callSid || session.call_sid || null,
      session.streamSid || session.stream_sid || null,
      session.callerPhone || session.caller_phone || null,
      session.exotelNumber || session.exotel_number || null,
      session.startedAt || session.started_at || now,
      session.endedAt || session.ended_at || now,
      session.language || 'English',
      JSON.stringify(session.transcript || []),
      session.recording_url || session.recordingUrl || null,
      session.aiSummary || session.ai_summary || session.summary || `Emergency call processed in ${session.language || 'English'}`,
      session.status || 'COMPLETED',
      session.requestId || session.request_id || null,
      JSON.stringify(session.metadata || {}),
      session.query || session.metadata?.classification?.query || null,
      session.summary || session.metadata?.classification?.summary || session.aiSummary || null,
      session.department || session.metadata?.classification?.department || null,
      session.required_service || session.requiredService || session.metadata?.classification?.required_service || null,
      resourcesJson,
      session.priority || session.metadata?.classification?.priority || null,
      session.location || session.metadata?.classification?.location || 'Not mentioned',
      session.affected_people || session.affectedPeople || session.metadata?.classification?.affected_people || 'Not mentioned',
      session.classification_confidence ?? session.classificationConfidence ?? session.metadata?.classification?.confidence ?? 0.0,
      session.classification_status || session.classificationStatus || 'completed',
      sourceIp,
      session.createdAt || session.created_at || now
    );
  }

  updateCallClassification(id, updates) {
    const db = getDatabase();
    const existing = this.getCallById(id);
    if (!existing) return null;

    const fields = [];
    const values = [];

    if (updates.department !== undefined) {
      fields.push('department = ?');
      values.push(updates.department);
    }
    if (updates.required_service !== undefined) {
      fields.push('required_service = ?');
      values.push(updates.required_service);
    }
    if (updates.required_resources !== undefined) {
      fields.push('required_resources = ?');
      const val = Array.isArray(updates.required_resources)
        ? JSON.stringify(updates.required_resources)
        : JSON.stringify([updates.required_resources]);
      values.push(val);
    }
    if (updates.priority !== undefined) {
      fields.push('priority = ?');
      values.push(updates.priority);
    }
    if (updates.location !== undefined) {
      fields.push('location = ?');
      values.push(updates.location);
    }
    if (updates.affected_people !== undefined) {
      fields.push('affected_people = ?');
      values.push(updates.affected_people);
    }
    if (updates.summary !== undefined) {
      fields.push('summary = ?');
      values.push(updates.summary);
    }
    if (updates.query !== undefined) {
      fields.push('query = ?');
      values.push(updates.query);
    }

    if (fields.length === 0) return existing;

    values.push(id);
    const sql = `UPDATE call_sessions SET ${fields.join(', ')} WHERE id = ?`;
    db.prepare(sql).run(...values);

    return this.getCallById(id);
  }

  getDepartmentStats() {
    const db = getDatabase();
    const calls = this.getAllCalls();

    const DEPARTMENTS = [
      'Water & Sanitation',
      'Fire & Rescue',
      'Medical / Healthcare',
      'Food & Essential Supplies',
      'Shelter & Evacuation',
      'Electricity',
      'Roads & Transportation',
      'Police / Security',
      'Waste Management',
      'Disaster Management',
      'Government Services',
      'Other / Unclassified'
    ];

    // Department counts
    const departmentCounts = {};
    const departmentResources = {};
    DEPARTMENTS.forEach(dept => {
      departmentCounts[dept] = 0;
      departmentResources[dept] = {};
    });

    const priorityCounts = {
      Critical: 0,
      High: 0,
      Medium: 0,
      Low: 0,
      Unknown: 0
    };

    for (const call of calls) {
      const dept = call.department || 'Other / Unclassified';
      if (departmentCounts[dept] !== undefined) {
        departmentCounts[dept]++;
      } else {
        departmentCounts['Other / Unclassified'] = (departmentCounts['Other / Unclassified'] || 0) + 1;
      }

      const p = call.priority || 'Unknown';
      if (priorityCounts[p] !== undefined) {
        priorityCounts[p]++;
      } else {
        priorityCounts.Unknown++;
      }

      // Aggregate required resources for this department
      if (Array.isArray(call.required_resources) && call.required_resources.length > 0) {
        const targetDept = departmentResources[dept] ? dept : 'Other / Unclassified';
        for (const res of call.required_resources) {
          if (!res) continue;
          departmentResources[targetDept][res] = (departmentResources[targetDept][res] || 0) + 1;
        }
      }
    }

    // Format for client view
    const departmentCards = DEPARTMENTS.map(dept => ({
      name: dept,
      count: departmentCounts[dept] || 0,
      resources: Object.entries(departmentResources[dept] || {}).map(([item, count]) => ({ item, count }))
    }));

    return {
      totalCalls: calls.length,
      departments: departmentCards,
      priorityCounts
    };
  }
}

export const callService = new CallService();
